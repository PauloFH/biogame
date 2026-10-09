import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ATLAS_COLS, ATLAS_ROWS, atlasId, BLOB_AT, CARS_LEFT, CARS_RIGHT, DECOR, DECOR_FILES, PLAIN, SIGN, TREES, type Stamp } from './campus-atlas.ts';

test('every piece of the campus atlas fits the sheet and none overlaps another', () => {
  const pieces: Stamp[] = [
    ...Object.values(BLOB_AT).map(at => ({ at, w: 12, h: 4 })),
    ...Object.values(PLAIN).map(p => ({ at: [p.at[0], p.at[1]] as [number, number], w: 1, h: 1 })),
    ...CARS_LEFT, ...CARS_RIGHT, ...TREES, ...DECOR, SIGN,
  ];
  const owner = new Map<number, number>();
  pieces.forEach((p, n) => {
    for (let r = 0; r < p.h; r++) for (let c = 0; c < p.w; c++) {
      const [x, y] = [p.at[0] + c, p.at[1] + r];
      assert.ok(x < ATLAS_COLS && y < ATLAS_ROWS, `peça ${n} sai da folha em (${x},${y})`);
      assert.ok(!owner.has(atlasId(x, y)), `peças ${owner.get(atlasId(x, y))} e ${n} se sobrepõem em (${x},${y})`);
      owner.set(atlasId(x, y), n);
    }
  });
  assert.equal(DECOR.length, DECOR_FILES.length);
});
