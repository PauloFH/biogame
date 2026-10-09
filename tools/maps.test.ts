import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { buildMap, LAB_MAP, MAPS } from './maps.ts';
import type { MapSpec } from './maps.ts';
import { areaObjects, contains, parseAreas } from '../src/areas.ts';
import type { Area, TiledObject } from '../src/areas.ts';

type Built = ReturnType<typeof buildMap>;
/** Só o que o lint lê de um .tmj publicado. `name` é o nome do arquivo sem `.tmj`. */
type Shipped = { name: string; layers: { type: string; name: string; objects?: TiledObject[] }[] };
const tileLayer = (m: Built, name: string) => m.layers.find(l => l.name === name) as { data: number[] };
const built = MAPS.map(spec => ({ spec, map: buildMap(spec) }));

const MAPS_DIR = new URL('../public/maps/', import.meta.url);
/** Os .tmj publicados, lidos do disco: é isso que o jogo carrega, não o que `buildMap` produziria agora. */
function shippedMaps(): Shipped[] {
  return readdirSync(MAPS_DIR).filter(f => f.endsWith('.tmj')).sort().map(f => ({
    name: f.slice(0, -'.tmj'.length),
    layers: (JSON.parse(readFileSync(new URL(f, MAPS_DIR), 'utf8')) as { layers: Shipped['layers'] }).layers,
  }));
}
const shippedAreas = (m: Shipped) => {
  assert.ok(m.layers.some(l => l.type === 'objectgroup' && (l.name === 'areas' || l.name === 'osm-areas')), `${m.name}: sem camada de áreas`);
  return parseAreas(areaObjects(m.layers));
};

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

test('public/maps has a shipped .tmj for every spec in MAPS', () => {
  const names = shippedMaps().map(m => m.name);
  assert.ok(names.length > 0, 'public/maps está vazio: rode npm run maps');
  for (const spec of MAPS) assert.ok(names.includes(spec.name), `falta public/maps/${spec.name}.tmj: rode npm run maps`);
});

test('the areas of every map parse without warnings', () => {
  for (const m of shippedMaps()) assert.deepEqual(shippedAreas(m).warnings, [], m.name);
});

test('no entry sits inside a door (the player would bounce between maps)', () => {
  for (const m of shippedMaps()) {
    const areas = shippedAreas(m).areas;
    for (const e of areas.filter(a => a.kind === 'entry')) {
      const c = { x: e.rect.x + e.rect.w / 2, y: e.rect.y + e.rect.h / 2 };
      for (const d of areas.filter(a => a.kind === 'door')) assert.equal(contains(d.rect, c.x, c.y), false, `${m.name}: ${e.name} dentro de ${d.name}`);
    }
  }
});

test('every door points to a built map and an entry that exists there', () => {
  const maps = shippedMaps();
  const entries = new Map(maps.map(m => [m.name, shippedAreas(m).areas.filter(a => a.kind === 'entry').map(a => a.name)]));
  for (const m of maps) {
    for (const d of shippedAreas(m).areas.filter((a): a is Extract<Area, { kind: 'door' }> => a.kind === 'door')) {
      assert.ok(entries.has(d.map), `${m.name}: porta para mapa inexistente ${d.map}`);
      assert.ok(entries.get(d.map)!.includes(d.entry), `${m.name}: entry ${d.entry} não existe em ${d.map}`);
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
