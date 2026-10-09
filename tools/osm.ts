// Gera os setores do campus (public/maps/campus-X-Y.tmj + minimapa .mini.png) a partir de tools/data/campus.json.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { buildSector, mergeOsmLayers, MINIMAP_COLORS, sectors, type Ponto } from './campus.ts';
import { rasterize } from './grid.ts';
import { toMeters, type CampusData } from './osm-data.ts';
import { Pix } from './pix.ts';

export const loadCampus = (): CampusData => JSON.parse(readFileSync(new URL('./data/campus.json', import.meta.url), 'utf8'));
/** Pontos de interesse escritos à mão (lat/lon do Google Maps/OSM), convertidos para metros do campus. */
export const loadPontos = (d: CampusData): Ponto[] => pontosOf(d, JSON.parse(readFileSync(new URL('./data/pontos.json', import.meta.url), 'utf8')));
export function pontosOf(d: CampusData, raw: { name: string; lat: number; lon: number; text: string }[]): Ponto[] {
  return raw.map(p => {
    if (!Number.isFinite(p.lat) || !Number.isFinite(p.lon)) throw new Error(`ponto "${p.name}" sem lat/lon válidos em tools/data/pontos.json (lat: ${p.lat}, lon: ${p.lon})`);
    const [x, y] = toMeters(d.origin, p.lon, p.lat);
    return { name: p.name, x, y, text: p.text };
  });
}

function main(): void {
  const d = loadCampus(), g = rasterize(d), all = sectors(g), pontos = loadPontos(d);
  mkdirSync('public/maps', { recursive: true });
  for (const s of all) {
    const file = `public/maps/${s.name}.tmj`;
    const mini = new Pix(s.w, s.h);
    for (let j = 0; j < s.h; j++) for (let i = 0; i < s.w; i++) mini.px(i, j, MINIMAP_COLORS[g.cls[(s.y0 + j) * g.w + s.x0 + i]]);
    writeFileSync(`public/maps/${s.name}.mini.png`, mini.png());
    const fresh = buildSector(g, d, s, all, pontos);
    // Regra de ouro: num mapa que já existe, só as camadas osm-* são trocadas.
    writeFileSync(file, JSON.stringify(existsSync(file) ? mergeOsmLayers(JSON.parse(readFileSync(file, 'utf8')), fresh) : fresh));
  }
  for (const p of pontos) {
    const i = Math.floor((p.x - g.x0) / g.mpt), j = Math.floor((p.y - g.y0) / g.mpt);
    if (!all.some(s => i >= s.x0 && j >= s.y0 && i < s.x0 + s.w && j < s.y0 + s.h)) console.warn(`[osm] ponto "${p.name}" fora do campus`);
  }
  console.log(`ok: ${all.length} setores (${g.w}×${g.h} tiles, ${g.mpt} m por tile), ${pontos.length} pontos`);
}

if (import.meta.main) main();
