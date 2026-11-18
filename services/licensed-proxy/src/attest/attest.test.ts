/**
 * App Attest on a chain made here: a stand-in root, intermediate and leaf built with WebCrypto in
 * Apple's shapes, so every check runs for real without a device. Apple's own root is only parsed.
 */

import { describe, expect, it } from "vitest";

import { decodeCbor } from "./cbor";
import { OID, parseCertificate } from "./der";
import { AttestKey, CHALLENGE_MS, type KeyStorage } from "./keys";
import { appleRoot, sha256, toB64 } from "./verify";

const APP_ID = "TEAM123456.studio.yada.reader";
const NOW = new Date("2026-11-18T12:00:00Z");

// --- DER and CBOR writers (test only) -------------------------------------------------------------

const cat = (...parts: Uint8Array[]) => {
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let at = 0;
  for (const p of parts) {
    out.set(p, at);
    at += p.length;
  }
  return out;
};
const bytes = (...b: number[]) => Uint8Array.from(b);
const text = (s: string) => new TextEncoder().encode(s);

function tlv(tag: number, ...parts: Uint8Array[]): Uint8Array {
  const value = cat(...parts);
  const n = value.length;
  const length = n < 128 ? bytes(n) : n < 256 ? bytes(0x81, n) : bytes(0x82, n >> 8, n & 0xff);
  return cat(bytes(tag), length, value);
}
const seq = (...p: Uint8Array[]) => tlv(0x30, ...p);
function oidDer(dotted: string): Uint8Array {
  const [a = 0, b = 0, ...rest] = dotted.split(".").map(Number);
  const out = [40 * a + b];
  for (const n of rest) {
    const chunk = [n & 0x7f];
    for (let v = Math.floor(n / 128); v > 0; v = Math.floor(v / 128)) chunk.unshift((v & 0x7f) | 0x80);
    out.push(...chunk);
  }
  return tlv(0x06, Uint8Array.from(out));
}
const integer = (b: Uint8Array) => tlv(0x02, (b[0] ?? 0) & 0x80 ? cat(bytes(0), b) : b);
const name = (cn: string) => seq(tlv(0x31, seq(oidDer("2.5.4.3"), tlv(0x0c, text(cn)))));
const utc = (d: Date) => tlv(0x17, text(`${d.toISOString().slice(2, 19).replace(/[-:T]/g, "")}Z`));

function derSignature(raw: Uint8Array): Uint8Array {
  const half = raw.length / 2;
  const trim = (v: Uint8Array) => {
    let i = 0;
    while (i < v.length - 1 && v[i] === 0) i++;
    return v.subarray(i);
  };
  return seq(integer(trim(raw.subarray(0, half))), integer(trim(raw.subarray(half))));
}

type Pair = CryptoKeyPair;
const p384 = () => crypto.subtle.generateKey({ name: "ECDSA", namedCurve: "P-384" }, true, ["sign", "verify"]) as Promise<Pair>;
const p256 = () => crypto.subtle.generateKey({ name: "ECDSA", namedCurve: "P-256" }, true, ["sign", "verify"]) as Promise<Pair>;

async function certificate(opts: {
  subject: string;
  issuer: string;
  key: Pair;
  signer: Pair;
  hash: "SHA-256" | "SHA-384";
  extensions?: Uint8Array[];
  notAfter?: Date;
}): Promise<Uint8Array> {
  const alg = seq(oidDer(opts.hash === "SHA-384" ? OID.ecdsaSha384 : OID.ecdsaSha256));
  const spki = new Uint8Array((await crypto.subtle.exportKey("spki", opts.key.publicKey)) as ArrayBuffer);
  const tbs = seq(
    tlv(0xa0, integer(bytes(2))),
    integer(bytes(1)),
    alg,
    name(opts.issuer),
    seq(utc(new Date("2026-01-01T00:00:00Z")), utc(opts.notAfter ?? new Date("2027-01-01T00:00:00Z"))),
    name(opts.subject),
    spki,
    ...(opts.extensions === undefined ? [] : [tlv(0xa3, seq(...opts.extensions))]),
  );
  const raw = new Uint8Array(await crypto.subtle.sign({ name: "ECDSA", hash: opts.hash }, opts.signer.privateKey, tbs));
  return seq(tbs, alg, tlv(0x03, bytes(0), derSignature(raw)));
}

function cbor(v: unknown): Uint8Array {
  const head = (major: number, n: number) =>
    n < 24 ? bytes((major << 5) | n) : n < 256 ? bytes((major << 5) | 24, n) : bytes((major << 5) | 25, n >> 8, n & 0xff);
  if (v instanceof Uint8Array) return cat(head(2, v.length), v);
  if (typeof v === "string") return cat(head(3, text(v).length), text(v));
  if (Array.isArray(v)) return cat(head(4, v.length), ...v.map(cbor));
  const entries = Object.entries(v as Record<string, unknown>);
  return cat(head(5, entries.length), ...entries.flatMap(([k, x]) => [cbor(k), cbor(x)]));
}

// --- A device ---------------------------------------------------------------------------------------

interface Device {
  readonly keyId: string;
  readonly key: Pair;
  readonly rootDer: Uint8Array;
  attest(challenge: string, over?: { appId?: string; aaguid?: string; leafNotAfter?: Date }): Promise<string>;
  assertion(clientData: string, counter: number, appId?: string): Promise<string>;
}

async function device(): Promise<Device> {
  const root = await p384();
  const ca = await p384();
  const key = await p256();
  const rootDer = await certificate({ subject: "Test Root", issuer: "Test Root", key: root, signer: root, hash: "SHA-384" });
  const point = new Uint8Array((await crypto.subtle.exportKey("raw", key.publicKey)) as ArrayBuffer);
  const keyIdBytes = await sha256(point);
  const keyId = toB64(keyIdBytes);
  const authHead = async (appId: string, flags: number, counter: number) =>
    cat(await sha256(text(appId)), bytes(flags, counter >>> 24, (counter >> 16) & 0xff, (counter >> 8) & 0xff, counter & 0xff));
  return {
    keyId,
    key,
    rootDer,
    async attest(challenge, over = {}) {
      const authData = cat(await authHead(over.appId ?? APP_ID, 0x40, 0), text(over.aaguid ?? "appattest\0\0\0\0\0\0\0"), bytes(0, 32), keyIdBytes);
      const nonce = await sha256(cat(authData, await sha256(text(challenge))));
      const ext = seq(oidDer(OID.appAttestNonce), tlv(0x04, seq(tlv(0xa1, tlv(0x04, nonce)))));
      const intermediate = await certificate({ subject: "Test CA", issuer: "Test Root", key: ca, signer: root, hash: "SHA-384" });
      const leaf = await certificate({ subject: keyId, issuer: "Test CA", key, signer: ca, hash: "SHA-256", extensions: [ext], ...(over.leafNotAfter === undefined ? {} : { notAfter: over.leafNotAfter }) });
      return toB64(cbor({ fmt: "apple-appattest", attStmt: { x5c: [leaf, intermediate], receipt: bytes(1) }, authData }));
    },
    async assertion(clientData, counter, appId = APP_ID) {
      const authenticatorData = await authHead(appId, 0x00, counter);
      const nonce = await sha256(cat(authenticatorData, await sha256(text(clientData))));
      const raw = new Uint8Array(await crypto.subtle.sign({ name: "ECDSA", hash: "SHA-256" }, key.privateKey, nonce));
      return toB64(cbor({ signature: derSignature(raw), authenticatorData }));
    },
  };
}

function memory(): KeyStorage {
  const map = new Map<string, unknown>();
  return {
    get: async <T>(k: string) => map.get(k) as T | undefined,
    put: async (k, v) => void map.set(k, structuredClone(v)),
    delete: async (k) => map.delete(k),
  };
}

const keyFor = (d: Device, now = () => NOW) => new AttestKey({ storage: memory(), appId: APP_ID, now, rootDer: d.rootDer });

describe("App Attest", () => {
  it("parses Apple's root: P-384, self-issued, valid until 2045", () => {
    const root = parseCertificate(appleRoot());
    expect(root.curve).toBe(OID.p384);
    expect(root.issuer).toEqual(root.subject);
    expect(root.notAfter.toISOString()).toBe("2045-03-15T00:00:00.000Z");
  });

  it("reads CBOR maps, byte strings and integers", () => {
    expect(decodeCbor(cbor({ a: bytes(1, 2), b: ["x"] }))).toEqual({ a: bytes(1, 2), b: ["x"] });
  });

  it("proves a key once, then takes assertions whose counter rises, and refuses replays", async () => {
    const d = await device();
    const key = keyFor(d);
    expect(await key.register(d.keyId, await d.attest(await key.challenge()))).toBe(true);
    expect(await key.assert("GET /v1/chapter/NLT/JHN.3", await d.assertion("GET /v1/chapter/NLT/JHN.3", 1))).toBe(true);
    const second = await d.assertion("GET /v1/chapter/NLT/JHN.4", 2);
    expect(await key.assert("GET /v1/chapter/NLT/JHN.4", second)).toBe(true);
    expect(await key.assert("GET /v1/chapter/NLT/JHN.4", second)).toBe(false);
    expect(await key.assert("GET /v1/chapter/NLT/JHN.5", await d.assertion("GET /v1/chapter/NLT/JHN.4", 3))).toBe(false);
    expect(await key.assert("GET /v1/chapter/NLT/JHN.5", await d.assertion("GET /v1/chapter/NLT/JHN.5", 3, "OTHER.app"))).toBe(false);
  });

  it("refuses a second attestation for a key already proved", async () => {
    const d = await device();
    const key = keyFor(d);
    expect(await key.register(d.keyId, await d.attest(await key.challenge()))).toBe(true);
    expect(await key.register(d.keyId, await d.attest(await key.challenge()))).toBe(false);
  });

  it("refuses another app, an unknown environment, a stale or reused challenge, and an expired leaf", async () => {
    const d = await device();
    const cases: Array<(key: AttestKey) => Promise<string>> = [
      async (key) => d.attest(await key.challenge(), { appId: "OTHER.app" }),
      async (key) => d.attest(await key.challenge(), { aaguid: "somethingelse!!!" }),
      async (key) => d.attest(await key.challenge(), { leafNotAfter: new Date("2026-06-01T00:00:00Z") }),
      async () => d.attest("not-the-challenge"),
    ];
    for (const make of cases) {
      const key = keyFor(d);
      expect(await key.register(d.keyId, await make(key))).toBe(false);
    }
    let now = NOW;
    const late = keyFor(d, () => now);
    const att = await d.attest(await late.challenge());
    now = new Date(NOW.getTime() + CHALLENGE_MS + 1);
    expect(await late.register(d.keyId, att)).toBe(false);
  });

  it("refuses a chain that doesn't end at the pinned root, and a key id that isn't the leaf's", async () => {
    const d = await device();
    const other = await device();
    const key = new AttestKey({ storage: memory(), appId: APP_ID, now: () => NOW, rootDer: other.rootDer });
    expect(await key.register(d.keyId, await d.attest(await key.challenge()))).toBe(false);
    const mine = keyFor(d);
    expect(await mine.register(other.keyId, await d.attest(await mine.challenge()))).toBe(false);
  });

  it("takes no assertion for a key never proved", async () => {
    const d = await device();
    expect(await keyFor(d).assert("GET /x", await d.assertion("GET /x", 1))).toBe(false);
  });
});
