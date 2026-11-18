/**
 * Just enough CBOR (RFC 8949) to read App Attest's attestation and assertion objects: unsigned and
 * negative integers, byte and text strings, arrays, maps, tags (skipped) and the simple values.
 * Definite lengths only, which is all Apple sends. A library would be the Worker's only dependency
 * besides @yada/schema, for about sixty lines.
 */

export type Cbor = number | Uint8Array | string | Cbor[] | { [key: string]: Cbor } | boolean | null | undefined;

export function decodeCbor(bytes: Uint8Array): Cbor {
  const [value, end] = item(bytes, 0);
  if (end !== bytes.length) throw new Error("cbor: trailing bytes");
  return value;
}

function item(b: Uint8Array, at: number): [Cbor, number] {
  const head = b[at];
  if (head === undefined) throw new Error("cbor: truncated");
  const major = head >> 5;
  const [arg, next] = argument(b, at + 1, head & 0x1f);
  switch (major) {
    case 0:
      return [arg, next];
    case 1:
      return [-1 - arg, next];
    case 2:
      return [take(b, next, arg), next + arg];
    case 3:
      return [new TextDecoder().decode(take(b, next, arg)), next + arg];
    case 4: {
      const out: Cbor[] = [];
      let p = next;
      for (let i = 0; i < arg; i++) {
        const [v, q] = item(b, p);
        out.push(v);
        p = q;
      }
      return [out, p];
    }
    case 5: {
      const out: { [key: string]: Cbor } = {};
      let p = next;
      for (let i = 0; i < arg; i++) {
        const [k, q] = item(b, p);
        const [v, r] = item(b, q);
        out[String(k)] = v;
        p = r;
      }
      return [out, p];
    }
    case 6:
      return item(b, next);
    default:
      if ((head & 0x1f) === 20) return [false, next];
      if ((head & 0x1f) === 21) return [true, next];
      if ((head & 0x1f) === 22) return [null, next];
      if ((head & 0x1f) === 23) return [undefined, next];
      throw new Error("cbor: unsupported simple value");
  }
}

function argument(b: Uint8Array, at: number, info: number): [number, number] {
  if (info < 24) return [info, at];
  const size = info === 24 ? 1 : info === 25 ? 2 : info === 26 ? 4 : info === 27 ? 8 : 0;
  if (size === 0) throw new Error("cbor: indefinite length");
  if (at + size > b.length) throw new Error("cbor: truncated");
  let n = 0;
  for (let i = 0; i < size; i++) n = n * 256 + (b[at + i] ?? 0);
  if (!Number.isSafeInteger(n)) throw new Error("cbor: integer too large");
  return [n, at + size];
}

function take(b: Uint8Array, at: number, length: number): Uint8Array {
  if (at + length > b.length) throw new Error("cbor: truncated");
  return b.subarray(at, at + length);
}
