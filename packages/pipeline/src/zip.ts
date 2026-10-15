/**
 * The files of a zip, read in memory: stored and deflated entries, each checked against its CRC-32.
 * The grammars are read from their pinned zips rather than an extracted tree no pin covers (code review,
 * 15 Oct 2026). No zip64, encryption or multi-disk archives: the door43 archives use none, and an
 * archive that does is refused rather than half read.
 */

import { crc32, inflateRawSync } from "node:zlib";

export class ZipRefused extends Error {}

const EOCD = 0x06054b50;
const CENTRAL = 0x02014b50;
const LOCAL = 0x04034b50;

/** Entry name -> contents, directories left out. */
export function readZip(buf: Buffer): Map<string, Buffer> {
  let eocd = -1;
  for (let i = buf.length - 22; i >= Math.max(0, buf.length - 22 - 0xffff); i--) {
    if (buf.readUInt32LE(i) === EOCD) {
      eocd = i;
      break;
    }
  }
  if (eocd < 0) throw new ZipRefused("no end of central directory");
  const count = buf.readUInt16LE(eocd + 10);
  let at = buf.readUInt32LE(eocd + 16);
  if (count === 0xffff || at === 0xffffffff) throw new ZipRefused("zip64 archives are not read");
  const out = new Map<string, Buffer>();
  for (let k = 0; k < count; k++) {
    if (buf.readUInt32LE(at) !== CENTRAL) throw new ZipRefused(`central directory entry ${k} is malformed`);
    const flags = buf.readUInt16LE(at + 8);
    const method = buf.readUInt16LE(at + 10);
    const crc = buf.readUInt32LE(at + 16);
    const size = buf.readUInt32LE(at + 20);
    const nameLen = buf.readUInt16LE(at + 28);
    const extraLen = buf.readUInt16LE(at + 30);
    const commentLen = buf.readUInt16LE(at + 32);
    const local = buf.readUInt32LE(at + 42);
    const name = buf.toString("utf8", at + 46, at + 46 + nameLen);
    at += 46 + nameLen + extraLen + commentLen;
    if (name.endsWith("/")) continue;
    if ((flags & 1) !== 0) throw new ZipRefused(`${name} is encrypted`);
    if (buf.readUInt32LE(local) !== LOCAL) throw new ZipRefused(`${name}'s local header is malformed`);
    const start = local + 30 + buf.readUInt16LE(local + 26) + buf.readUInt16LE(local + 28);
    const raw = buf.subarray(start, start + size);
    const data = method === 0 ? Buffer.from(raw) : method === 8 ? inflateRawSync(raw) : null;
    if (data === null) throw new ZipRefused(`${name} uses compression method ${method}`);
    if (crc32(data) >>> 0 !== crc) throw new ZipRefused(`${name} fails its CRC-32`);
    out.set(name, data);
  }
  return out;
}
