import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildSector, CAMPUS_SOLID, cbLink, edgeLinks, mergeOsmLayers, sectors } from './campus.ts';
import { atlasId, CARS_LEFT, CARS_RIGHT, DECOR, DECOR_TUFTS, SIGN, TREES } from './campus-atlas.ts';
import { GRASS, rasterize } from './grid.ts';
import type { CampusData } from './osm-data.ts';
import { parseAreas, type TiledObject } from '../src/areas.ts';

const sq = (x0: number, y0: number, x1: number, y1: number): [number, number][] => [[x0, y0], [x1, y0], [x1, y1], [x0, y1], [x0, y0]];
// retângulo de 680×400 m → grade 340×200 → setores 160: 3 colunas (160, 160, 20) × 2 linhas (160, 40)
const base: CampusData = {
  origin: [0, 0, 1, 1], boundary: [sq(0, 0, 680, 400)], buildings: [], parking: [], green: [], water: [], roads: [], paths: [], trees: [], bbox: [0, 0, 680, 400],
};

test('sectors cut the grid in 160×160 pieces named by position, keeping the remainders', () => {
  const s = sectors(rasterize(base));
  assert.deepEqual(s.map(x => `${x.name}:${x.w}x${x.h}`), [
    'campus-0-0:160x160', 'campus-1-0:160x160', 'campus-2-0:20x160',
    'campus-0-1:160x40', 'campus-1-1:160x40', 'campus-2-1:20x40',
  ]);
});

test('edge links pair a door on each side with an entry two tiles inside the other side', () => {
  const g = rasterize(base), [a, b] = sectors(g);
  const links = edgeLinks(g, a, b);
  assert.equal(links.length, 39);
  const [l] = links;
  assert.deepEqual([l.doorA.col, l.doorA.row, l.doorA.w, l.doorA.h], [159, 2, 1, 4]);
  assert.deepEqual(l.doorA.props, { map: 'campus-1-0', entry: 'de-campus-0-0-0' });
  assert.deepEqual([l.entryB.name, l.entryB.col], ['de-campus-0-0-0', 2]);
  assert.deepEqual(l.doorB.props, { map: 'campus-0-0', entry: 'de-campus-1-0-0' });
  assert.deepEqual([l.entryA.name, l.entryA.col], ['de-campus-1-0-0', 157]);
  assert.equal(links.at(-1)!.doorA.row + links.at(-1)!.doorA.h!, 158); // 2 tiles livres na ponta
  assert.deepEqual(edgeLinks(g, a, sectors(g)[2]), []);
});

test('edge links skip stretches blocked on either side', () => {
  const blocked = { ...base, buildings: [{ n: '', p: sq(300, 0, 340, 400) }] }; // prédio sobre a divisa x=320 m
  const g = rasterize(blocked), [a, b] = sectors(g);
  assert.equal(edgeLinks(g, a, b).length, 0);
});

test('buildSector makes 7 tile layers of the sector size, the areas layer and the minimap property', () => {
  const g = rasterize(base), all = sectors(g), s = all[0];
  const map = buildSector(g, base, s, all);
  const tiles = map.layers.filter(l => l.type === 'tilelayer') as { name: string; data: number[] }[];
  assert.deepEqual(tiles.map(l => l.name), ['osm-chao', 'osm-calcada', 'osm-grama', 'osm-terreno', 'osm-detalhes', 'osm-objetos', 'osm-copas']);
  for (const l of tiles) assert.equal(l.data.length, 160 * 160);
  assert.deepEqual(map.properties.map(p => p.name), ['name', 'minimap']);
  assert.equal(map.properties[1].value, 'maps/campus-0-0.mini.png');
  const areas = parseAreas((map.layers.find(l => l.type === 'objectgroup') as unknown as { objects: TiledObject[] }).objects);
  assert.deepEqual(areas.warnings, []);
  assert.deepEqual(buildSector(g, base, s, all), map, 'determinístico');
});

test('the CB building gets the door to the corridor, the arrival entry and the guard; cbLink finds its sector', () => {
  const withCb = { ...base, buildings: [{ n: 'CB', p: sq(100, 100, 140, 120) }] };
  const g = rasterize(withCb), all = sectors(g);
  const map = buildSector(g, withCb, all[0], all);
  const objects = (map.layers.find(l => l.type === 'objectgroup') as unknown as { objects: TiledObject[] }).objects;
  const door = objects.find(o => o.name === 'porta-cb');
  assert.deepEqual(door?.properties?.map(p => [p.name, p.value]), [['map', 'cb-corredor'], ['entry', 'porta-campus']]);
  assert.ok(objects.some(o => o.type === 'entry' && o.name === 'cb'));
  assert.ok(objects.some(o => o.type === 'npc' && o.name === 'vigilante'));
  assert.deepEqual(cbLink(g, withCb), { map: 'campus-0-0', entry: 'cb' });
});

test('collision: roofs, cars, sign feet and tree trunks block; tree canopies and sign tops do not', () => {
  const t = TREES[0];
  assert.ok(CAMPUS_SOLID.includes(atlasId(t.at[0], t.at[1] + t.h - 1)));
  assert.ok(!CAMPUS_SOLID.includes(atlasId(t.at[0], t.at[1])));
  assert.ok(CAMPUS_SOLID.includes(atlasId(CARS_LEFT[0].at[0], CARS_LEFT[0].at[1])));
  assert.ok(CAMPUS_SOLID.includes(atlasId(SIGN.at[0], SIGN.at[1] + 1)));
  assert.ok(!CAMPUS_SOLID.includes(atlasId(SIGN.at[0], SIGN.at[1])));
});

const gidsIn = (map: ReturnType<typeof buildSector>, name: string) => new Set((map.layers.find(l => l.name === name) as { data: number[] }).data.filter(Boolean));
const carGids = (stamps: typeof CARS_LEFT) => stamps.map(s => 1 + atlasId(s.at[0], s.at[1]));

test('cars always park sideways, whatever the lot shape', () => {
  const tall = { ...base, parking: [sq(20, 20, 60, 140)] }, wide = { ...base, parking: [sq(20, 20, 140, 60)] };
  for (const d of [tall, wide]) {
    const g = rasterize(d), all = sectors(g), objs = gidsIn(buildSector(g, d, all[0], all), 'osm-objetos');
    assert.ok([...carGids(CARS_LEFT), ...carGids(CARS_RIGHT)].some(id => objs.has(id)), 'deveria ter carros de lado');
  }
});

test('cars and trees never cover a door, an entry or the tile around them', () => {
  const lot = { ...base, parking: [sq(280, 0, 360, 400)] }; // estacionamento sobre a divisa x = 320 m
  const g = rasterize(lot), all = sectors(g);
  for (const s of all.slice(0, 2)) {
    const map = buildSector(g, lot, s, all);
    const covered = (name: string) => (map.layers.find(l => l.name === name) as { data: number[] }).data;
    const objs = covered('osm-objetos'), tops = covered('osm-copas');
    assert.ok(objs.some(Boolean), 'deveria ter carros no estacionamento');
    const objects = (map.layers.find(l => l.type === 'objectgroup') as unknown as { objects: { name: string; type: string; x: number; y: number; width: number; height: number }[] }).objects;
    for (const o of objects.filter(o => o.type === 'door' || o.type === 'entry')) {
      for (let y = o.y / 16 - 1; y <= (o.y + o.height) / 16; y++) for (let x = o.x / 16 - 1; x <= (o.x + o.width) / 16; x++) {
        if (x < 0 || y < 0 || x >= s.w || y >= s.h) continue;
        assert.equal(objs[y * s.w + x] || tops[y * s.w + x], 0, `${s.name}: ${o.type} "${o.name}" coberto em (${x},${y})`);
      }
    }
  }
});

test('a point of interest becomes a sign on the nearest walkable cell of its sector', () => {
  const withBuilding = { ...base, buildings: [{ n: '', p: sq(100, 100, 140, 140) }] };
  const g = rasterize(withBuilding), all = sectors(g);
  const map = buildSector(g, withBuilding, all[0], all, [{ name: 'museu', x: 120, y: 120, text: 'Museu do Carro' }]);
  const objects = (map.layers.find(l => l.type === 'objectgroup') as unknown as { objects: (TiledObject & { x: number; y: number })[] }).objects;
  const sign = objects.find(o => o.name === 'ponto-museu')!;
  assert.deepEqual(sign.properties?.map(p => p.value), ['Museu do Carro']);
  const [i, j] = [sign.x / 16, sign.y / 16];
  assert.ok(g.cls[j * g.w + i] !== 5, 'placa não pode ficar dentro do prédio');
  assert.ok(Math.hypot(i - 60, j - 60) <= 10.5, `placa longe demais do ponto (${i},${j})`); // prédio vai até 10 células do centro
  const tiles = (name: string) => (map.layers.find(l => l.name === name) as { data: number[] }).data;
  assert.equal(tiles('osm-objetos')[j * 160 + i], 1 + atlasId(SIGN.at[0], SIGN.at[1] + 1), 'pé da placa na célula da área');
  assert.equal(tiles('osm-copas')[(j - 1) * 160 + i], 1 + atlasId(SIGN.at[0], SIGN.at[1]), 'topo da placa por cima');
});

test('regenerating keeps manual layers, areas and tilesets, and only swaps the osm-* layers in place', () => {
  const g = rasterize(base), all = sectors(g), fresh = buildSector(g, base, all[0], all);
  const old = structuredClone(fresh);
  const manualLayer = { type: 'tilelayer', id: 20, name: 'fachadas', x: 0, y: 0, width: 160, height: 160, opacity: 1, visible: true, data: new Array(160 * 160).fill(1000) };
  const manualAreas = { type: 'objectgroup', id: 21, name: 'areas', draworder: 'topdown', x: 0, y: 0, opacity: 1, visible: true, objects: [{ id: 5000, name: 'placa', type: 'sign', x: 0, y: 0, width: 16, height: 16, rotation: 0, visible: true, properties: [] }] };
  old.layers.splice(4, 0, manualLayer as never);
  old.layers.push(manualAreas as never);
  old.tilesets.push({ ...old.tilesets[0], name: 'fachadas-ufrn', firstgid: 2000 });
  (old.layers.find(l => l.name === 'osm-grama') as { data: number[] }).data.fill(7);
  const merged = mergeOsmLayers(old, fresh);
  assert.deepEqual(merged.layers.map(l => l.name), ['osm-chao', 'osm-calcada', 'osm-grama', 'osm-terreno', 'fachadas', 'osm-detalhes', 'osm-objetos', 'osm-copas', 'osm-areas', 'areas']);
  assert.deepEqual((merged.layers.find(l => l.name === 'osm-grama') as { data: number[] }).data, (fresh.layers.find(l => l.name === 'osm-grama') as { data: number[] }).data);
  assert.equal(merged.layers.find(l => l.name === 'fachadas'), manualLayer as never);
  assert.ok(merged.tilesets.some(t => t.name === 'fachadas-ufrn'));
  const ids = merged.layers.flatMap(l => ('objects' in l ? (l.objects as { id: number }[]).map(o => o.id) : []));
  assert.equal(new Set(ids).size, ids.length, 'ids de objeto repetidos');
  assert.ok(Math.min(...(merged.layers.find(l => l.name === 'osm-areas') as { objects: { id: number }[] }).objects.map(o => o.id)) > 5000);
  assert.equal(merged.nextobjectid, Math.max(...ids) + 1);
  assert.equal(new Set(merged.layers.map(l => l.id)).size, merged.layers.length, 'ids de camada repetidos');
  const clash = structuredClone(old);
  clash.tilesets[1].firstgid = 500;
  assert.throws(() => mergeOsmLayers(clash, fresh), /colide/);
});

test('a manual layer whose id collides with a generated one: layer ids stay unique and nextlayerid passes them all', () => {
  const g = rasterize(base), all = sectors(g), fresh = buildSector(g, base, all[0], all);
  const old = structuredClone(fresh);
  old.layers.splice(4, 0, { type: 'tilelayer', id: 7, name: 'fachadas', x: 0, y: 0, width: 160, height: 160, opacity: 1, visible: true, data: new Array(160 * 160).fill(1000) } as never);
  const merged = mergeOsmLayers(old, fresh);
  const ids = merged.layers.map(l => l.id);
  assert.equal(new Set(ids).size, ids.length, 'ids de camada repetidos');
  assert.ok(ids.every(id => id < merged.nextlayerid), 'nextlayerid deve ser maior que todos os ids de camada');
});

test('scattered decor and trees follow their odds: 5% of the grass decorated, 1 in 4 of those a flower, every tree model used', () => {
  const g = rasterize(base), all = sectors(g), s = all[0], map = buildSector(g, base, s, all);
  const layer = (name: string) => (map.layers.find(l => l.name === name) as { data: number[] }).data;
  let grass = 0;
  for (let j = 0; j < s.h; j++) for (let i = 0; i < s.w; i++) if (g.cls[(s.y0 + j) * g.w + s.x0 + i] === GRASS) grass++;
  const decorated = layer('osm-detalhes').filter(Boolean), flowers = new Set(DECOR.slice(DECOR_TUFTS).map(d => 1 + atlasId(d.at[0], d.at[1])));
  assert.ok(decorated.length / grass > 0.04 && decorated.length / grass < 0.06, `enfeites em ${(100 * decorated.length / grass).toFixed(1)}% da grama, esperado ~5%`);
  const flowerShare = decorated.filter(id => flowers.has(id)).length / decorated.length;
  assert.ok(flowerShare > 0.2 && flowerShare < 0.3, `flores em ${(100 * flowerShare).toFixed(1)}% dos enfeites, esperado ~25%`);
  const canopies = new Set(layer('osm-copas'));
  for (const [n, t] of TREES.entries()) assert.ok(canopies.has(1 + atlasId(t.at[0], t.at[1])), `modelo de árvore ${n} nunca apareceu no setor`);
});
