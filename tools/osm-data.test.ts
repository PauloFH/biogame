import { test } from 'node:test';
import assert from 'node:assert/strict';
import { insideRings, toMeters, trim, type OsmElement } from './osm-data.ts';

// Quadrado de ~1,1 km perto do campus: dois ways "outer", o segundo invertido, para testar a junção.
const node = (id: number, lon: number, lat: number, tags?: Record<string, string>): OsmElement => ({ type: 'node', id, lon, lat, tags });
const way = (id: number, nodes: number[], tags?: Record<string, string>): OsmElement => ({ type: 'way', id, nodes, tags });
const fixture: OsmElement[] = [
  node(1, -35.2, -5.84), node(2, -35.19, -5.84), node(3, -35.19, -5.83), node(4, -35.2, -5.83),
  way(10, [1, 2, 3]), way(11, [1, 4, 3]),
  { type: 'relation', id: 99, members: [{ type: 'way', ref: 10, role: 'outer' }, { type: 'way', ref: 11, role: 'outer' }] },
  node(20, -35.196, -5.836), node(21, -35.195, -5.836), node(22, -35.195, -5.835), node(23, -35.196, -5.835),
  way(30, [20, 21, 22, 23, 20], { building: 'yes', name: 'CB' }),
  way(31, [20, 21, 22, 20], { amenity: 'parking' }),
  way(32, [20, 22], { highway: 'service' }),
  way(33, [21, 23], { highway: 'footway' }),
  way(34, [20, 21, 22, 20], { leisure: 'swimming_pool' }),
  way(35, [20, 21, 22, 20], { leisure: 'park' }),
  node(40, -35.194, -5.837, { natural: 'tree' }), node(41, -35.1, -5.9, { natural: 'tree' }),
  node(50, -35.1, -5.9), node(51, -35.09, -5.9), node(52, -35.09, -5.89),
  way(36, [50, 51, 52, 50], { building: 'yes', name: 'Fora' }),
];

test('trim keeps only what is inside the relation, by kind', () => {
  const d = trim(fixture, 99);
  assert.equal(d.boundary.length, 1);
  assert.deepEqual(d.buildings.map(b => b.n), ['CB']);
  assert.equal(d.parking.length, 1);
  assert.deepEqual(d.roads.map(r => r.c), ['service']);
  assert.equal(d.paths.length, 1);
  assert.equal(d.water.length, 1);
  assert.equal(d.green.length, 1);
  assert.equal(d.trees.length, 1);
});

test('trim joins the outer ways into one closed ring and projects to metres with y pointing south', () => {
  const d = trim(fixture, 99);
  const ring = d.boundary[0];
  assert.deepEqual(ring[0], ring[ring.length - 1]);
  assert.equal(ring.length, 5);
  const [x0, y0, x1, y1] = d.bbox;
  assert.ok(x1 - x0 > 1000 && x1 - x0 < 1200, `largura ${x1 - x0}`);
  assert.ok(y1 - y0 > 1000 && y1 - y0 < 1200, `altura ${y1 - y0}`);
  assert.equal(toMeters(d.origin, -35.2, -5.83)[1], y0, 'borda norte (lat -5.83) = menor y');
  assert.equal(toMeters(d.origin, -35.2, -5.84)[1], y1, 'borda sul (lat -5.84) = maior y');
  assert.ok(y0 < y1);
});

test('trim fails clearly when the relation is missing', () => {
  assert.throws(() => trim(fixture, 12345), /relação 12345 não encontrada/);
});

test('insideRings uses the even-odd rule', () => {
  const sq: [number, number][] = [[0, 0], [10, 0], [10, 10], [0, 10], [0, 0]];
  assert.equal(insideRings([sq], [5, 5]), true);
  assert.equal(insideRings([sq], [15, 5]), false);
  const hole: [number, number][] = [[3, 3], [7, 3], [7, 7], [3, 7], [3, 3]];
  assert.equal(insideRings([sq, hole], [5, 5]), false);
});

test('toMeters uses the same projection as the trimmed data', () => {
  const d = trim(fixture, 99);
  assert.deepEqual(toMeters(d.origin, d.origin[0], d.origin[1]), [0, 0]);
  const [x, y] = toMeters(d.origin, -35.19, -5.84);
  assert.ok(x > 0 && y > 0, 'leste e sul são positivos');
});
