import { test } from 'node:test';
import assert from 'node:assert/strict';
import { BLD, cellAt, GRASS, OUT, PARK, PAVE, rasterize, ROAD, walkable, WATER } from './grid.ts';
import type { CampusData } from './osm-data.ts';

const sq = (x0: number, y0: number, x1: number, y1: number): [number, number][] => [[x0, y0], [x1, y0], [x1, y1], [x0, y1], [x0, y0]];
// campus triangular de 40 m (20×20 células de 2 m): tudo com x + y > 40 fica fora
const data: CampusData = {
  origin: [0, 0, 1, 1],
  boundary: [[[0, 0], [40, 0], [0, 40], [0, 0]]],
  buildings: [{ n: 'CB', p: sq(10, 10, 16, 16) }],
  parking: [sq(2, 20, 8, 26)],
  green: [],
  water: [sq(2, 30, 6, 34)],
  roads: [{ c: 'service', p: [[0, 6], [30, 6]] }],
  paths: [],
  trees: [],
  bbox: [0, 0, 40, 40],
};

test('rasterize builds a 20×20 grid and leaves cells outside the boundary as OUT', () => {
  const g = rasterize(data, 2);
  assert.equal(g.w, 20);
  assert.equal(g.h, 20);
  assert.equal(cellAt(g, 19, 19), OUT);
  assert.equal(cellAt(g, 0, 9), GRASS);
  assert.equal(cellAt(g, -1, 0), OUT);
  assert.equal(cellAt(g, 0, 20), OUT);
});

test('roads get asphalt in the middle and a sidewalk ring', () => {
  const g = rasterize(data, 2);
  assert.equal(cellAt(g, 1, 2), ROAD); // centro y=5, a 1 m da via
  assert.equal(cellAt(g, 1, 3), ROAD);
  assert.equal(cellAt(g, 1, 1), PAVE); // y=3, a 3 m: calçada
  assert.equal(cellAt(g, 1, 5), PAVE); // y=11, a 5 m: calçada
  assert.equal(cellAt(g, 1, 6), GRASS); // y=13, a 7 m: fora da calçada
});

test('parking, water and buildings are painted with the building index', () => {
  const g = rasterize(data, 2);
  assert.equal(cellAt(g, 2, 11), PARK);
  assert.equal(cellAt(g, 1, 15), WATER);
  assert.equal(cellAt(g, 6, 6), BLD);
  assert.equal(g.bld[6 * g.w + 6], 0);
  assert.equal(g.bld[0], -1);
});

test('walkable is everything but outside, buildings and water', () => {
  assert.deepEqual([OUT, GRASS, PAVE, ROAD, PARK, BLD, WATER].map(walkable), [false, true, true, true, true, false, false]);
});
