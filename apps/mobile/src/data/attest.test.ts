/** The App Attest flow with the native module and the proxy faked: no device, no network. */

import { describe, expect, it, vi } from "vitest";

import { ASSERTION_HEADER, type AttestNative, clientData, createAttestor, KEY_HEADER } from "./attest";

function native(over: Partial<AttestNative> = {}): AttestNative & { saved: string | null } {
  const n: AttestNative & { saved: string | null } = {
    saved: null as string | null,
    isSupported: () => true,
    savedKeyId: () => n.saved,
    saveKeyId: (k: string) => {
      n.saved = k;
    },
    forgetKeyId: () => {
      n.saved = null;
    },
    generateKey: vi.fn(async () => "key-1"),
    attestKey: vi.fn(async (_k: string, c: string) => `attested:${c}`),
    generateAssertion: vi.fn(async (k: string, d: string) => `${k}|${d}`),
    ...over,
  };
  return n;
}

const reply = (status: number, body: unknown = {}) => ({ ok: status < 300, status, json: async () => body });

function proxy(registerStatus = 204) {
  return vi.fn(async (url: string, init: { body: string }) => {
    if (url.endsWith("/v1/attest/challenge")) return reply(200, { challenge: "c1" });
    expect(JSON.parse(init.body)).toEqual({ keyId: "key-1", attestation: "attested:c1" });
    return reply(registerStatus);
  });
}

describe("createAttestor", () => {
  it("signs over the method, path and query exactly as sent", () => {
    expect(clientData("https://p.example.workers.dev/v1/search/NLT?q=grace%20upon")).toBe("GET /v1/search/NLT?q=grace%20upon");
  });

  it("proves a key once, then asserts each request with it", async () => {
    const n = native();
    const post = proxy();
    const a = createAttestor(n, "https://p.example/", post);
    const [one, two] = await Promise.all([a.headers("https://p.example/v1/chapter/NLT/JHN.3"), a.headers("https://p.example/v1/chapter/NLT/JHN.4")]);
    expect(one).toEqual({ [KEY_HEADER]: "key-1", [ASSERTION_HEADER]: "key-1|GET /v1/chapter/NLT/JHN.3" });
    expect(two[ASSERTION_HEADER]).toBe("key-1|GET /v1/chapter/NLT/JHN.4");
    expect(n.generateKey).toHaveBeenCalledTimes(1);
    expect(post).toHaveBeenCalledTimes(2);
    expect(n.saved).toBe("key-1");
  });

  it("sends no proof where App Attest is missing, and keeps no key the proxy refused", async () => {
    expect(await createAttestor(null, "https://p.example", proxy()).headers("https://p.example/v1/x")).toEqual({});
    expect(await createAttestor(native({ isSupported: () => false }), "https://p.example", proxy()).headers("https://p.example/v1/x")).toEqual({});
    const n = native();
    expect(await createAttestor(n, "https://p.example", proxy(401)).headers("https://p.example/v1/x")).toEqual({});
    expect(n.saved).toBeNull();
  });

  it("drops a key iOS can no longer sign with, or the proxy refused, and proves a new one next time", async () => {
    const n = native({ generateAssertion: vi.fn(async () => Promise.reject(new Error("invalidKey"))) });
    n.saved = "old";
    const a = createAttestor(n, "https://p.example", proxy());
    expect(await a.headers("https://p.example/v1/x")).toEqual({});
    expect(n.saved).toBeNull();
    n.saved = "old";
    a.reset();
    expect(n.saved).toBeNull();
  });
});
