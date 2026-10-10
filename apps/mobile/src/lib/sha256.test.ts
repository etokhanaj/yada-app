import { createHash, randomBytes } from "node:crypto";
import { describe, expect, it } from "vitest";

import { CHUNK, sha256Hex, verifySha256 } from "./sha256";

const node = (data: Uint8Array) => createHash("sha256").update(data).digest("hex");

describe("sha256Hex", () => {
  it("matches the FIPS 180-2 vectors", async () => {
    expect(await sha256Hex(new Uint8Array())).toBe("e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855");
    expect(await sha256Hex(new TextEncoder().encode("abc"))).toBe("ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad");
  });

  it("agrees with node:crypto across block and chunk boundaries and at download size", async () => {
    for (const n of [1, 55, 56, 63, 64, 65, 119, 1000, CHUNK - 1, CHUNK, CHUNK + 1, 2 * CHUNK + 65, 7_500_000]) {
      const data = new Uint8Array(randomBytes(n));
      expect(await sha256Hex(data)).toBe(node(data));
    }
  });

  it("hashes a view into a larger buffer by its own bytes only", async () => {
    const whole = new Uint8Array(randomBytes(CHUNK + 300));
    const view = whole.subarray(100, CHUNK + 200);
    expect(await sha256Hex(view)).toBe(node(view));
  });

  it("yields between chunks, so the progress UI keeps rendering", async () => {
    let ran = false;
    setTimeout(() => {
      ran = true;
    }, 0);
    await sha256Hex(new Uint8Array(CHUNK + 64));
    expect(ran).toBe(true);
  });
});

describe("verifySha256", () => {
  const data = new TextEncoder().encode("In the beginning was the Word");

  it("accepts the right digest and nothing else", async () => {
    expect(await verifySha256(data, node(data))).toBe(true);
    expect(await verifySha256(data, node(new TextEncoder().encode("In the beginning was the word")))).toBe(false);
  });

  it("never verifies a malformed digest", async () => {
    expect(await verifySha256(data, node(data).toUpperCase())).toBe(false);
    expect(await verifySha256(data, "")).toBe(false);
  });
});
