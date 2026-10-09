import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadCampus, loadPontos, pontosOf } from './osm.ts';

test('points of interest convert lat/lon to metres and reject missing or non-numeric coordinates', () => {
  const d = loadCampus(), ok = { name: 'a', lat: d.origin[1], lon: d.origin[0], text: 'A' };
  assert.deepEqual(pontosOf(d, [ok]), [{ name: 'a', x: 0, y: 0, text: 'A' }]);
  assert.throws(() => pontosOf(d, [{ ...ok, lat: undefined as never }]), /ponto "a" sem lat\/lon válidos/);
  assert.throws(() => pontosOf(d, [{ ...ok, lon: null as never }]), /ponto "a"/);
  assert.throws(() => pontosOf(d, [{ ...ok, lon: '-35.2' as never }]), /ponto "a"/);
  assert.ok(loadPontos(d).every(p => Number.isFinite(p.x) && Number.isFinite(p.y)), 'pontos.json do jogo é válido');
});
