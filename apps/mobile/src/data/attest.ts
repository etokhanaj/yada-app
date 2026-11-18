/**
 * Proof for the licensed proxy that a request comes from genuine Yada (App Attest; John, 18 Nov 2026:
 * the source is public, so the proxy can't trust a bare request). Once per install: make a Secure
 * Enclave key, fetch a challenge, have Apple attest the key over it, and send that to the proxy. Then
 * every request carries an assertion over its own method, path and query, which the proxy checks
 * (services/licensed-proxy/src/attest). Nothing here says who the reader is: the key is random.
 *
 * Pure: the native module and fetch are passed in, so tests run without a device.
 */

export interface AttestNative {
  isSupported(): boolean;
  savedKeyId(): string | null;
  saveKeyId(keyId: string): void;
  forgetKeyId(): void;
  generateKey(): Promise<string>;
  attestKey(keyId: string, challenge: string): Promise<string>;
  generateAssertion(keyId: string, clientData: string): Promise<string>;
}

type Post = (url: string, init: { method: "POST"; headers: Record<string, string>; body: string }) => Promise<{ ok: boolean; status: number; json(): Promise<unknown> }>;

export interface Attestor {
  /** Headers proving a GET of `url`; none where App Attest isn't available or the proxy wouldn't take the key. */
  headers(url: string): Promise<Record<string, string>>;
  /** The proxy refused the key (it may have been lost on the server): prove a new one next time. */
  reset(): void;
}

export const KEY_HEADER = "Yada-Key-Id";
export const ASSERTION_HEADER = "Yada-Assertion";

/** What the proxy signs over: `GET /v1/chapter/NLT/JHN.3`, the path and query exactly as sent. */
export function clientData(url: string): string {
  return `GET ${url.replace(/^[a-z]+:\/\/[^/]+/i, "") || "/"}`;
}

export function createAttestor(native: AttestNative | null, base: string, post: Post): Attestor {
  const root = base.replace(/\/+$/, "");
  let proving: Promise<string | null> | null = null;

  const prove = async (n: AttestNative): Promise<string | null> => {
    const keyId = await n.generateKey();
    const json = { "Content-Type": "application/json" };
    const issued = await post(`${root}/v1/attest/challenge`, { method: "POST", headers: json, body: JSON.stringify({ keyId }) });
    const challenge = issued.ok ? ((await issued.json()) as { challenge?: unknown }).challenge : undefined;
    if (typeof challenge !== "string") return null;
    const attestation = await n.attestKey(keyId, challenge);
    const registered = await post(`${root}/v1/attest`, { method: "POST", headers: json, body: JSON.stringify({ keyId, attestation }) });
    if (!registered.ok) return null;
    n.saveKeyId(keyId);
    return keyId;
  };

  /** One proof at a time: chapters opened together share it. A failure is tried again on the next request. */
  const keyId = async (n: AttestNative): Promise<string | null> => {
    const saved = n.savedKeyId();
    if (saved !== null) return saved;
    proving ??= prove(n)
      .catch(() => null)
      .finally(() => {
        proving = null;
      });
    return proving;
  };

  return {
    async headers(url): Promise<Record<string, string>> {
      if (native === null || !native.isSupported()) return {};
      try {
        const id = await keyId(native);
        if (id === null) return {};
        return { [KEY_HEADER]: id, [ASSERTION_HEADER]: await native.generateAssertion(id, clientData(url)) };
      } catch {
        // A key iOS no longer holds (restored backup, reinstall) can't sign: prove a new one next time.
        native.forgetKeyId();
        return {};
      }
    },
    reset() {
      native?.forgetKeyId();
    },
  };
}
