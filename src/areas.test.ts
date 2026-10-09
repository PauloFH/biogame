import { test } from 'node:test';
import assert from 'node:assert/strict';
import { areaObjects, contains, entryPoint, near, paginate, parseAreas, type TiledObject } from './areas.ts';

const obj = (type: string, name: string, props: Record<string, unknown> = {}, x = 0, y = 0): TiledObject => ({
  type, name, x, y, width: 16, height: 16,
  properties: Object.entries(props).map(([n, value]) => ({ name: n, type: typeof value === 'number' ? 'float' : 'string', value })),
});

test('parses every kind with valid properties', () => {
  const { areas, warnings } = parseAreas([
    obj('entry', 'default'),
    obj('door', 'porta', { map: 'cb-corredor', entry: 'porta-lab' }),
    obj('sign', 'micro', { text: 'Olá\n---\nTchau' }),
    obj('npc', 'prof', { name: 'Prof. Bezerra', sprite: 'old-man', text: 'Bem-vindo!' }),
    obj('website', 'pc', { url: 'https://www.ufrn.br/', trigger: 'enter' }),
    obj('sound', 'hum', { src: 'audio/lab-hum.wav', volume: 0.3 }),
  ]);
  assert.deepEqual(warnings, []);
  assert.deepEqual(areas.map(a => a.kind), ['entry', 'door', 'sign', 'npc', 'website', 'sound']);
  const [, door, sign, npc, site, sound] = areas;
  assert.ok(door.kind === 'door' && door.map === 'cb-corredor' && door.entry === 'porta-lab');
  assert.ok(sign.kind === 'sign');
  assert.deepEqual(sign.pages, ['Olá', 'Tchau']);
  assert.ok(npc.kind === 'npc' && npc.label === 'Prof. Bezerra' && npc.sprite === 'old-man');
  assert.ok(site.kind === 'website' && site.trigger === 'enter');
  assert.ok(sound.kind === 'sound' && sound.volume === 0.3);
  assert.deepEqual(areas[0].rect, { x: 0, y: 0, w: 16, h: 16 });
});

test('a missing required property warns with the object name and skips that area', () => {
  const { areas, warnings } = parseAreas([obj('entry', 'default'), obj('door', 'porta-lab'), obj('npc', 'ze', { text: 'oi' })]);
  assert.deepEqual(areas.map(a => a.kind), ['entry']);
  assert.deepEqual(warnings, ['[areas] door "porta-lab" sem propriedade "map"', '[areas] npc "ze" sem propriedade "sprite"']);
});

test('unknown or missing Class warns and the rest still parses', () => {
  const { areas, warnings } = parseAreas([obj('entry', 'default'), obj('teleporte', 'x'), obj('', 'enfeite')]);
  assert.equal(areas.length, 1);
  assert.deepEqual(warnings, ['[areas] Class desconhecida "teleporte" em "x"', '[areas] objeto "enfeite" sem Class']);
});

test('website only accepts http(s) urls', () => {
  const { areas, warnings } = parseAreas([obj('entry', 'default'), obj('website', 'mal', { url: 'javascript:alert(1)' })]);
  assert.equal(areas.length, 1);
  assert.match(warnings[0], /url inválida/);
});

test('defaults: door entry → default, website trigger → key (warns if invalid), sound volume clamped', () => {
  const { areas, warnings } = parseAreas([
    obj('entry', 'default'),
    obj('door', 'p', { map: 'x' }),
    obj('website', 's', { url: 'https://a.b', trigger: 'pisar' }),
    obj('sound', 'alto', { src: 'a.wav', volume: 7 }),
    obj('sound', 'padrao', { src: 'b.wav' }),
  ]);
  const [, door, site, loud, plain] = areas;
  assert.ok(door.kind === 'door' && door.entry === 'default');
  assert.ok(site.kind === 'website' && site.trigger === 'key');
  assert.ok(loud.kind === 'sound' && loud.volume === 1);
  assert.ok(plain.kind === 'sound' && plain.volume === 0.5);
  assert.deepEqual(warnings, ['[areas] website "s" com trigger inválido "pisar", usando "key"']);
});

test('reads the Class from the "class" field too', () => {
  const o = obj('', 'default');
  delete o.type;
  o.class = 'entry';
  assert.equal(parseAreas([o]).areas[0].kind, 'entry');
});

test('warns when the map has no default entry', () => {
  assert.deepEqual(parseAreas([obj('entry', 'porta')]).warnings, ['[areas] mapa sem entry "default"']);
});

test('entryPoint returns the center, falls back to default, null without entries', () => {
  const { areas } = parseAreas([obj('entry', 'default', {}, 32, 48), obj('entry', 'porta', {}, 0, 0)]);
  assert.deepEqual(entryPoint(areas, 'porta'), { x: 8, y: 8 });
  assert.deepEqual(entryPoint(areas, 'nao-existe'), { x: 40, y: 56 });
  assert.equal(entryPoint([], 'default'), null);
});

test('contains is half-open and near expands by pad', () => {
  const r = { x: 0, y: 0, w: 16, h: 16 };
  assert.equal(contains(r, 0, 0), true);
  assert.equal(contains(r, 16, 8), false);
  assert.equal(near(r, 20, 8, 5), true);
  assert.equal(near(r, 22, 8, 5), false);
});

test('paginate splits on lines with only ---, trims and drops empty pages', () => {
  assert.deepEqual(paginate('a\n---\n\n---\n  b  '), ['a', 'b']);
  assert.deepEqual(paginate('sem separador'), ['sem separador']);
});

test('areaObjects joins the hand-made "areas" layer and the generated "osm-areas" layer, ignoring the rest', () => {
  const layers = [
    { type: 'objectgroup', name: 'osm-areas', objects: [obj('entry', 'default')] },
    { type: 'tilelayer', name: 'areas' },
    { type: 'objectgroup', name: 'notas', objects: [obj('sign', 'rascunho')] },
    { type: 'objectgroup', name: 'areas', objects: [obj('sign', 'placa')] },
  ];
  assert.deepEqual(areaObjects(layers).map(o => o.name), ['default', 'placa']);
});
