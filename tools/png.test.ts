import { test } from 'node:test';
import assert from 'node:assert/strict';
import { inflateSync } from 'node:zlib';
import { encodePng } from './png.ts';

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
