import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildMap, LAB_MAP, MAPS, type MapSpec } from './maps.ts';
import { contains, parseAreas, type Area, type TiledObject } from '../src/areas.ts';

type Built = ReturnType<typeof buildMap>;
const tileLayer = (m: Built, name: string) => m.layers.find(l => l.name === name) as { data: number[] };
const areasOf = (m: Built) => parseAreas((m.layers.find(l => l.name === 'areas') as { objects: TiledObject[] }).objects);
const built = MAPS.map(spec => ({ spec, map: buildMap(spec) }));

test('every tile layer has width × height cells', () => {
  for (const { map } of built) {
    for (const name of ['floor', 'walls', 'furniture', 'items']) assert.equal(tileLayer(map, name).data.length, map.width * map.height, `${name}`);
  }
});

test('lab uses the expected gids for floor, wall ends, cap, benches and items', () => {
  const lab = buildMap(LAB_MAP);
  const at = (layer: string, x: number, y: number) => tileLayer(lab, layer).data[y * lab.width + x];
  assert.equal(at('floor', 1, 3), 1 + 31 * 15 + 13);
  assert.equal(at('floor', 3, 4), 1 + 30 * 15 + 12);
  assert.equal(at('walls', 1, 1), 601 + 14 * 32 + 0);
  assert.equal(at('walls', 2, 1), 601 + 14 * 32 + 1);
  assert.equal(at('walls', 24, 2), 601 + 15 * 32 + 2);
  assert.equal(at('walls', 0, 0), 1881 + 1);
  assert.equal(at('furniture', 3, 5), 1881 + 3);
  assert.equal(at('furniture', 4, 5), 1881 + 4);
  assert.equal(at('furniture', 10, 5), 1881 + 5);
  assert.equal(at('furniture', 3, 6), 1881 + 6);
  assert.equal(at('items', 3, 5), 1881 + 9);
  assert.equal(at('floor', 0, 0), 0);
});

test('the areas of every map parse without warnings', () => {
  for (const { spec, map } of built) assert.deepEqual(areasOf(map).warnings, [], spec.name);
});

test('no entry sits inside a door (the player would bounce between maps)', () => {
  for (const { spec, map } of built) {
    const areas = areasOf(map).areas;
    for (const e of areas.filter(a => a.kind === 'entry')) {
      const c = { x: e.rect.x + e.rect.w / 2, y: e.rect.y + e.rect.h / 2 };
      for (const d of areas.filter(a => a.kind === 'door')) assert.equal(contains(d.rect, c.x, c.y), false, `${spec.name}: ${e.name} dentro de ${d.name}`);
    }
  }
});

test('every door points to a built map and an entry that exists there', () => {
  const entries = new Map(built.map(({ spec, map }) => [spec.name, areasOf(map).areas.filter(a => a.kind === 'entry').map(a => a.name)]));
  for (const { spec, map } of built) {
    for (const d of areasOf(map).areas.filter((a): a is Extract<Area, { kind: 'door' }> => a.kind === 'door')) {
      assert.ok(entries.has(d.map), `${spec.name}: porta para mapa inexistente ${d.map}`);
      assert.ok(entries.get(d.map)!.includes(d.entry), `${spec.name}: entry ${d.entry} não existe em ${d.map}`);
    }
  }
});

test('rejects rows of the wrong width and unknown characters', () => {
  const ok: MapSpec = { name: 't', title: 'T', base: ['###', '#.#', '###'], items: ['...', '...', '...'], areas: [] };
  assert.doesNotThrow(() => buildMap(ok));
  assert.throws(() => buildMap({ ...ok, base: ['###', '#.', '###'] }), /colunas/);
  assert.throws(() => buildMap({ ...ok, base: ['###', '#?#', '###'] }), /caractere desconhecido/);
  assert.throws(() => buildMap({ ...ok, items: ['...', '.z.', '...'] }), /item desconhecido/);
});
