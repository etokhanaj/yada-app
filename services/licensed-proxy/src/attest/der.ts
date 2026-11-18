/**
 * Just enough DER and X.509 to check App Attest's two-certificate chain against Apple's root:
 * each certificate's signed bytes, signature, public key, names, validity and extensions. WebCrypto
 * does the cryptography; this only finds the bytes.
 */

export interface Node {
  readonly tag: number;
  /** The whole element, header included (what a signature covers, for the TBS certificate). */
  readonly raw: Uint8Array;
  readonly value: Uint8Array;
}

export function readNode(bytes: Uint8Array, at = 0): { node: Node; end: number } {
  const tag = bytes[at];
  const first = bytes[at + 1];
  if (tag === undefined || first === undefined) throw new Error("der: truncated");
  let length = first;
  let header = 2;
  if (first & 0x80) {
    const size = first & 0x7f;
    if (size === 0 || size > 4) throw new Error("der: length");
    length = 0;
    for (let i = 0; i < size; i++) length = length * 256 + (bytes[at + 2 + i] ?? 0);
    header += size;
  }
  const end = at + header + length;
  if (end > bytes.length) throw new Error("der: truncated");
  return { node: { tag, raw: bytes.subarray(at, end), value: bytes.subarray(at + header, end) }, end };
}

export function children(node: Node): Node[] {
  const out: Node[] = [];
  let at = 0;
  while (at < node.value.length) {
    const { node: child, end } = readNode(node.value, at);
    out.push(child);
    at = end;
  }
  return out;
}

export function oid(node: Node): string {
  const v = node.value;
  const parts: number[] = [];
  let n = 0;
  for (const byte of v) {
    n = n * 128 + (byte & 0x7f);
    if ((byte & 0x80) === 0) {
      if (parts.length === 0) parts.push(Math.min(2, Math.floor(n / 40)), n - Math.min(2, Math.floor(n / 40)) * 40);
      else parts.push(n);
      n = 0;
    }
  }
  return parts.join(".");
}

export const OID = {
  ecdsaSha256: "1.2.840.10045.4.3.2",
  ecdsaSha384: "1.2.840.10045.4.3.3",
  p256: "1.2.840.10045.3.1.7",
  p384: "1.3.132.0.34",
  /** Apple's App Attest nonce extension. */
  appAttestNonce: "1.2.840.113635.100.8.2",
} as const;

export interface Certificate {
  readonly tbs: Uint8Array;
  readonly signatureAlgorithm: string;
  /** DER-encoded ECDSA signature (the BIT STRING's content, unused-bits byte dropped). */
  readonly signature: Uint8Array;
  readonly issuer: Uint8Array;
  readonly subject: Uint8Array;
  readonly notBefore: Date;
  readonly notAfter: Date;
  /** SubjectPublicKeyInfo, for `importKey("spki")`. */
  readonly spki: Uint8Array;
  readonly curve: string;
  /** The public key's BIT STRING content: an uncompressed point, 0x04 || X || Y. */
  readonly point: Uint8Array;
  readonly extensions: ReadonlyMap<string, Uint8Array>;
}

export function parseCertificate(der: Uint8Array): Certificate {
  const [tbsNode, algNode, sigNode] = children(readNode(der).node);
  if (tbsNode === undefined || algNode === undefined || sigNode === undefined) throw new Error("x509: shape");
  const tbs = children(tbsNode);
  // [0] version is present on every v3 certificate; skip it when there.
  const fields = tbs[0]?.tag === 0xa0 ? tbs.slice(1) : tbs;
  const [, , issuer, validity, subject, spki] = fields;
  if (issuer === undefined || validity === undefined || subject === undefined || spki === undefined) throw new Error("x509: tbs");
  const [notBefore, notAfter] = children(validity).map(time);
  const [spkiAlg, spkiKey] = children(spki);
  const curveNode = spkiAlg === undefined ? undefined : children(spkiAlg)[1];
  if (notBefore === undefined || notAfter === undefined || spkiKey === undefined || curveNode === undefined) throw new Error("x509: fields");

  const extensions = new Map<string, Uint8Array>();
  const extWrapper = fields.find((f) => f.tag === 0xa3);
  const extList = extWrapper === undefined ? undefined : children(extWrapper)[0];
  for (const ext of extList === undefined ? [] : children(extList)) {
    const parts = children(ext);
    const id = parts[0];
    const value = parts[parts.length - 1];
    if (id !== undefined && value !== undefined) extensions.set(oid(id), value.value);
  }

  const algId = children(algNode)[0];
  if (algId === undefined) throw new Error("x509: algorithm");
  return {
    tbs: tbsNode.raw,
    signatureAlgorithm: oid(algId),
    signature: sigNode.value.subarray(1),
    issuer: issuer.raw,
    subject: subject.raw,
    notBefore,
    notAfter,
    spki: spki.raw,
    curve: oid(curveNode),
    point: spkiKey.value.subarray(1),
    extensions,
  };
}

/** UTCTime (YYMMDDHHMMSSZ) or GeneralizedTime (YYYYMMDDHHMMSSZ). */
function time(node: Node): Date {
  const s = new TextDecoder().decode(node.value);
  const full = node.tag === 0x17 ? `${Number(s.slice(0, 2)) < 50 ? "20" : "19"}${s}` : s;
  const m = /^(\d{4})(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})Z$/.exec(full);
  if (m === null) throw new Error("x509: time");
  return new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]), Number(m[4]), Number(m[5]), Number(m[6])));
}

/** WebCrypto wants ECDSA signatures as r || s, each padded to the curve's size; X.509 and App Attest send DER. */
export function rawSignature(der: Uint8Array, size: number): Uint8Array {
  const [r, s] = children(readNode(der).node);
  if (r === undefined || s === undefined) throw new Error("der: signature");
  const out = new Uint8Array(size * 2);
  const put = (v: Uint8Array, offset: number) => {
    let i = 0;
    while (i < v.length - 1 && v[i] === 0) i++;
    const trimmed = v.subarray(i);
    if (trimmed.length > size) throw new Error("der: signature size");
    out.set(trimmed, offset + size - trimmed.length);
  };
  put(r.value, 0);
  put(s.value, size);
  return out;
}

export function pemToDer(pem: string): Uint8Array {
  const b64 = pem.replace(/-----[A-Z ]+-----/g, "").replace(/\s+/g, "");
  return Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
}
