import { test } from 'node:test';
import assert from 'node:assert/strict';
import { blobMask, E, GODOT_BLOB, N, NE, S, W } from './blob.ts';

test('every one of the 256 neighbour combinations maps to a cell of the 12×4 block', () => {
  for (let bits = 0; bits < 256; bits++) {
    const dirs = [[0, -1], [1, -1], [1, 0], [1, 1], [0, 1], [-1, 1], [-1, 0], [-1, -1]];
    const m = blobMask((dx, dy) => (bits >> dirs.findIndex(([x, y]) => x === dx && y === dy)) & 1 ? true : false);
    const cell = GODOT_BLOB[m];
    assert.ok(cell, `máscara ${m} (bits ${bits}) sem célula`);
    assert.ok(cell[0] >= 0 && cell[0] < 12 && cell[1] >= 0 && cell[1] < 4);
  }
});

test('the table has the 47 blob shapes, each in its own cell, never the unused cell (10,1)', () => {
  const cells = Object.values(GODOT_BLOB).map(([c, r]) => `${c},${r}`);
  assert.equal(cells.length, 47);
  assert.equal(new Set(cells).size, 47);
  assert.ok(!cells.includes('10,1'));
});

test('a corner only counts when both edges that form it are set', () => {
  assert.equal(blobMask((dx, dy) => dx === 1 && dy === -1), 0);
  assert.equal(blobMask((dx, dy) => (dx === 0 && dy === -1) || (dx === 1 && dy === -1)), N);
  assert.equal(blobMask((dx, dy) => (dx === 0 && dy === -1) || (dx === 1 && dy === 0) || (dx === 1 && dy === -1)), N | E | NE);
  assert.equal(blobMask(() => true), 255);
  assert.equal(blobMask((dx, dy) => dy === 0), E | W);
  assert.equal(blobMask((dx) => dx === 0), N | S);
});
