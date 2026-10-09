import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Pix } from './pix.ts';

test('blit copies a rectangle of another image and clips at the edges of both', () => {
  // origem 3×2 com o índice do pixel no canal vermelho
  const src = { width: 3, height: 2, data: new Uint8Array(3 * 2 * 4).map((_, i) => (i % 4 === 0 ? i / 4 + 1 : 255)) };
  const dst = new Pix(4, 3);
  dst.blit(src, 1, 0, 2, 2, 0, 1); // pixels 2,3 / 5,6 em (0,1)
  dst.blit(src, 0, 0, 3, 2, 3, 2); // sobra para fora: só o pixel 1 cabe, em (3,2)
  const red = (x: number, y: number) => dst.data[(y * 4 + x) * 4];
  assert.deepEqual([red(0, 1), red(1, 1), red(0, 2), red(1, 2)], [2, 3, 5, 6]);
  assert.equal(red(3, 2), 1);
  assert.equal(red(2, 1), 0, 'fora do retângulo fica intacto');
});
