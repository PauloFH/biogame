import { test } from 'node:test';
import assert from 'node:assert/strict';
import { crc32, deflateSync, inflateSync } from 'node:zlib';
import { decodePng, encodePng } from './png.ts';

test('writes signature, IHDR with size and RGBA, and a valid IEND', () => {
  const png = encodePng(2, 1, new Uint8Array([255, 0, 0, 255, 0, 0, 255, 128]));
  assert.deepEqual([...png.subarray(0, 8)], [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  assert.equal(png.toString('ascii', 12, 16), 'IHDR');
  assert.equal(png.readUInt32BE(16), 2);
  assert.equal(png.readUInt32BE(20), 1);
  assert.equal(png[24], 8);
  assert.equal(png[25], 6);
  assert.equal(png.toString('ascii', png.length - 8, png.length - 4), 'IEND');
  assert.equal(png.readUInt32BE(png.length - 4), 0xae426082);
});

test('pixel rows survive deflate with filter byte 0', () => {
  const rgba = new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8]);
  const png = encodePng(1, 2, rgba);
  const len = png.readUInt32BE(33);
  assert.equal(png.toString('ascii', 37, 41), 'IDAT');
  assert.deepEqual([...inflateSync(png.subarray(41, 41 + len))], [0, 1, 2, 3, 4, 0, 5, 6, 7, 8]);
});

test('rejects a buffer of the wrong size', () => {
  assert.throws(() => encodePng(2, 2, new Uint8Array(4)), /esperava 16 bytes/);
});

test('decodePng reads back what encodePng wrote', () => {
  const rgba = new Uint8Array(3 * 2 * 4).map((_, i) => (i * 37) & 255);
  const img = decodePng(encodePng(3, 2, rgba));
  assert.equal(img.width, 3);
  assert.equal(img.height, 2);
  assert.deepEqual([...img.data], [...rgba]);
});

test('decodePng undoes the Sub, Up, Average and Paeth filters', () => {
  const w = 2, h = 5, stride = w * 4;
  const rgba = new Uint8Array(w * h * 4).map((_, i) => (i * 53 + 7) & 255);
  const px = (x: number, y: number) => (x < 0 || y < 0 ? 0 : rgba[y * stride + x]);
  const raw: number[] = [];
  for (let y = 0; y < h; y++) {
    const f = y; // filtros 0..4, um por linha
    raw.push(f);
    for (let x = 0; x < stride; x++) {
      const a = px(x - 4, y), b = px(x, y - 1), c = px(x - 4, y - 1), v = rgba[y * stride + x];
      const p = a + b - c, pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c);
      const pred = [0, a, b, (a + b) >> 1, pa <= pb && pa <= pc ? a : pb <= pc ? b : c][f];
      raw.push((v - pred) & 255);
    }
  }
  const png = encodePng(w, h, rgba);
  const idatLen = png.readUInt32BE(33);
  const crafted = Buffer.concat([png.subarray(0, 33), chunkFor('IDAT', deflateSync(Buffer.from(raw))), png.subarray(33 + 12 + idatLen)]);
  assert.deepEqual([...decodePng(crafted).data], [...rgba]);
});

test('decodePng rejects formats it does not handle', () => {
  const png = encodePng(1, 1, new Uint8Array(4));
  png[25] = 2; // tipo de cor RGB
  assert.throws(() => decodePng(png), /não suportado/);
});

function chunkFor(type: string, data: Buffer): Buffer {
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}
