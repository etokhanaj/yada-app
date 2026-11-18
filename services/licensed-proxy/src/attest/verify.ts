/**
 * App Attest (Apple, "Validating apps that connect to your server"): the proxy serves licensed text only
 * to genuine Yada on a real Apple device, so the source going public (John, 18 Nov 2026) doesn't hand
 * anyone a way to spend the API.Bible plan's month of calls and leave readers on the BSB.
 *
 * Once per install the app proves a new Secure Enclave key with Apple's attestation (verifyAttestation);
 * the proxy keeps that key's public half and a counter. Each request then carries an assertion, a
 * signature over the request by that key (verifyAssertion), and the counter must rise, so an assertion
 * can't be replayed. Neither step learns anything about the reader: the key is random per install.
 *
 * Pure: the root certificate, the app id and the clock are passed in, so tests run on a chain they make.
 */

import { decodeCbor } from "./cbor";
import { OID, parseCertificate, pemToDer, rawSignature, type Certificate } from "./der";

/** Apple App Attestation Root CA, from apple.com/certificateauthority (SHA-256 1C:B9:82:3B:…:42:C9:32). */
export const APPLE_ROOT_PEM = `-----BEGIN CERTIFICATE-----
MIICITCCAaegAwIBAgIQC/O+DvHN0uD7jG5yH2IXmDAKBggqhkjOPQQDAzBSMSYw
JAYDVQQDDB1BcHBsZSBBcHAgQXR0ZXN0YXRpb24gUm9vdCBDQTETMBEGA1UECgwK
QXBwbGUgSW5jLjETMBEGA1UECAwKQ2FsaWZvcm5pYTAeFw0yMDAzMTgxODMyNTNa
Fw00NTAzMTUwMDAwMDBaMFIxJjAkBgNVBAMMHUFwcGxlIEFwcCBBdHRlc3RhdGlv
biBSb290IENBMRMwEQYDVQQKDApBcHBsZSBJbmMuMRMwEQYDVQQIDApDYWxpZm9y
bmlhMHYwEAYHKoZIzj0CAQYFK4EEACIDYgAERTHhmLW07ATaFQIEVwTtT4dyctdh
NbJhFs/Ii2FdCgAHGbpphY3+d8qjuDngIN3WVhQUBHAoMeQ/cLiP1sOUtgjqK9au
Yen1mMEvRq9Sk3Jm5X8U62H+xTD3FE9TgS41o0IwQDAPBgNVHRMBAf8EBTADAQH/
MB0GA1UdDgQWBBSskRBTM72+aEH/pwyp5frq5eWKoTAOBgNVHQ8BAf8EBAMCAQYw
CgYIKoZIzj0EAwMDaAAwZQIwQgFGnByvsiVbpTKwSga0kP0e8EeDS4+sQmTvb7vn
53O5+FRXgeLhpJ06ysC5PrOyAjEAp5U4xDgEgllF7En3VcE3iexZZtKeYnpqtijV
oyFraWVIyd/dganmrduC1bmTBGwD
-----END CERTIFICATE-----`;

export interface AttestConfig {
  /** `{TEAM_ID}.{bundle id}`, whose SHA-256 is the authenticator data's rpIdHash. */
  readonly appId: string;
  readonly rootDer: Uint8Array;
  readonly now: Date;
}

export const appleRoot = (): Uint8Array => pemToDer(APPLE_ROOT_PEM);

/** "appattest" then seven zeros (production: TestFlight and the App Store), or "appattestdevelop" (development builds). */
const AAGUIDS = ["appattest\0\0\0\0\0\0\0", "appattestdevelop"];

export async function verifyAttestation(config: AttestConfig, keyId: string, challenge: string, attestationB64: string): Promise<{ point: Uint8Array } | null> {
  try {
    const att = decodeCbor(fromB64(attestationB64));
    if (!isMap(att) || att.fmt !== "apple-appattest" || !isMap(att.attStmt) || !(att.authData instanceof Uint8Array)) return null;
    const x5c = att.attStmt.x5c;
    if (!Array.isArray(x5c) || !(x5c[0] instanceof Uint8Array) || !(x5c[1] instanceof Uint8Array)) return null;
    const leaf = parseCertificate(x5c[0]);
    const intermediate = parseCertificate(x5c[1]);
    const root = parseCertificate(config.rootDer);
    if (!(await signedBy(intermediate, root, config.now)) || !(await signedBy(leaf, intermediate, config.now))) return null;

    const authData = att.authData;
    const nonce = await sha256(concat(authData, await sha256(utf8(challenge))));
    if (!equal(nonceOf(leaf), nonce)) return null;

    const keyIdBytes = fromB64(keyId);
    if (!equal(await sha256(leaf.point), keyIdBytes)) return null;
    const auth = parseAuthData(authData);
    if (auth === null || !equal(auth.rpIdHash, await sha256(utf8(config.appId))) || auth.counter !== 0) return null;
    if (auth.aaguid === null || !AAGUIDS.includes(new TextDecoder().decode(auth.aaguid))) return null;
    if (auth.credentialId === null || !equal(auth.credentialId, keyIdBytes)) return null;
    return { point: leaf.point };
  } catch {
    return null;
  }
}

/** The new counter when the assertion is good and later than `counter`, else null. */
export async function verifyAssertion(appId: string, point: Uint8Array, counter: number, clientData: string, assertionB64: string): Promise<number | null> {
  try {
    const assertion = decodeCbor(fromB64(assertionB64));
    if (!isMap(assertion) || !(assertion.signature instanceof Uint8Array) || !(assertion.authenticatorData instanceof Uint8Array)) return null;
    const authData = assertion.authenticatorData;
    const nonce = await sha256(concat(authData, await sha256(utf8(clientData))));
    const key = await crypto.subtle.importKey("raw", point, { name: "ECDSA", namedCurve: "P-256" }, false, ["verify"]);
    const ok = await crypto.subtle.verify({ name: "ECDSA", hash: "SHA-256" }, key, rawSignature(assertion.signature, 32), nonce);
    const auth = parseAuthData(authData);
    if (!ok || auth === null || !equal(auth.rpIdHash, await sha256(utf8(appId))) || auth.counter <= counter) return null;
    return auth.counter;
  } catch {
    return null;
  }
}

async function signedBy(cert: Certificate, issuer: Certificate, now: Date): Promise<boolean> {
  if (!equal(cert.issuer, issuer.subject) || now < cert.notBefore || now > cert.notAfter || now < issuer.notBefore || now > issuer.notAfter) return false;
  const curve = issuer.curve === OID.p384 ? { namedCurve: "P-384", size: 48 } : issuer.curve === OID.p256 ? { namedCurve: "P-256", size: 32 } : null;
  const hash = cert.signatureAlgorithm === OID.ecdsaSha384 ? "SHA-384" : cert.signatureAlgorithm === OID.ecdsaSha256 ? "SHA-256" : null;
  if (curve === null || hash === null) return false;
  const key = await crypto.subtle.importKey("spki", issuer.spki, { name: "ECDSA", namedCurve: curve.namedCurve }, false, ["verify"]);
  return crypto.subtle.verify({ name: "ECDSA", hash }, key, rawSignature(cert.signature, curve.size), cert.tbs);
}

/** The extension holds SEQUENCE { [1] { OCTET STRING nonce } }. */
function nonceOf(leaf: Certificate): Uint8Array {
  const ext = leaf.extensions.get(OID.appAttestNonce);
  if (ext === undefined) return new Uint8Array();
  // Fixed shape (30 24 A1 22 04 20 + 32 bytes), so the last 32 bytes behind an 04 20 header.
  const at = ext.length - 34;
  return at >= 0 && ext[at] === 0x04 && ext[at + 1] === 0x20 ? ext.subarray(at + 2) : new Uint8Array();
}

interface AuthData {
  readonly rpIdHash: Uint8Array;
  readonly counter: number;
  readonly aaguid: Uint8Array | null;
  readonly credentialId: Uint8Array | null;
}

function parseAuthData(a: Uint8Array): AuthData | null {
  if (a.length < 37) return null;
  const counter = (((a[33] ?? 0) << 24) >>> 0) + ((a[34] ?? 0) << 16) + ((a[35] ?? 0) << 8) + (a[36] ?? 0);
  if (((a[32] ?? 0) & 0x40) === 0 || a.length < 55) return { rpIdHash: a.subarray(0, 32), counter, aaguid: null, credentialId: null };
  const length = ((a[53] ?? 0) << 8) + (a[54] ?? 0);
  if (a.length < 55 + length) return null;
  return { rpIdHash: a.subarray(0, 32), counter, aaguid: a.subarray(37, 53), credentialId: a.subarray(55, 55 + length) };
}

const isMap = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v) && !(v instanceof Uint8Array);
const utf8 = (s: string) => new TextEncoder().encode(s);
export const sha256 = async (b: Uint8Array) => new Uint8Array(await crypto.subtle.digest("SHA-256", b));
export const fromB64 = (s: string) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));
export const toB64 = (b: Uint8Array) => btoa(String.fromCharCode(...b));

function concat(a: Uint8Array, b: Uint8Array): Uint8Array {
  const out = new Uint8Array(a.length + b.length);
  out.set(a);
  out.set(b, a.length);
  return out;
}

function equal(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length || a.length === 0) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= (a[i] ?? 0) ^ (b[i] ?? 0);
  return diff === 0;
}
