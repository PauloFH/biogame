// Baixa o Campus Central da UFRN do OpenStreetMap e grava um recorte compacto, em metros,
// em tools/data/campus.json. Dados © colaboradores do OpenStreetMap (ODbL).
import { mkdirSync, writeFileSync } from 'node:fs';

export const RELATION = 1715536; // "UFRN - Campus Central"
/** oeste, sul, leste, norte (graus) — um pouco maior que o contorno do campus. */
export const BBOX = [-35.2125, -5.8465, -35.1945, -5.831] as const;

export type Pt = [number, number];
export type OsmElement = {
  type: 'node' | 'way' | 'relation'; id: number; lat?: number; lon?: number;
  nodes?: number[]; tags?: Record<string, string>; members?: { type: string; ref: number; role: string }[];
};
/** Metros a partir do centro do campus; x para leste, y para o sul. `origin` = [lon0, lat0, m/grau lon, m/grau lat]. */
export type CampusData = {
  origin: [number, number, number, number]; boundary: Pt[][]; buildings: { n: string; p: Pt[] }[]; parking: Pt[][]; green: Pt[][]; water: Pt[][];
  roads: { c: string; p: Pt[] }[]; paths: Pt[][]; trees: Pt[]; bbox: [number, number, number, number];
};

const PATHS = new Set(['footway', 'path', 'pedestrian', 'steps', 'corridor', 'cycleway']);
const GREEN = new Set(['park', 'garden', 'pitch', 'grass', 'forest', 'meadow', 'wood', 'scrub', 'grassland']);

/** Junta os ways "outer" da relação em anéis fechados. */
function rings(rel: OsmElement, ways: Map<number, OsmElement>): number[][] {
  const segs = (rel.members ?? []).filter(m => m.type === 'way' && m.role === 'outer').map(m => [...(ways.get(m.ref)?.nodes ?? [])]).filter(s => s.length);
  const out: number[][] = [];
  while (segs.length) {
    const ring = segs.shift()!;
    while (ring[0] !== ring[ring.length - 1]) {
      const i = segs.findIndex(s => s[0] === ring[ring.length - 1] || s[s.length - 1] === ring[ring.length - 1]);
      if (i < 0) break;
      const [s] = segs.splice(i, 1);
      ring.push(...(s[0] === ring[ring.length - 1] ? s : [...s].reverse()).slice(1));
    }
    out.push(ring);
  }
  return out;
}

/** Converte longitude/latitude para os metros do campus (mesma projeção do recorte). */
export function toMeters([lon0, lat0, kx, ky]: CampusData['origin'], lon: number, lat: number): Pt {
  return [Math.round((lon - lon0) * kx), Math.round((lat0 - lat) * ky)];
}

export function insideRings(rs: Pt[][], [x, y]: Pt): boolean {
  let hit = false;
  for (const r of rs) {
    for (let i = 0, j = r.length - 1; i < r.length; j = i++) {
      const [xi, yi] = r[i], [xj, yj] = r[j];
      if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) hit = !hit;
    }
  }
  return hit;
}

/** Recorta os elementos do OSM ao contorno da relação e converte para metros. Puro. */
export function trim(elements: OsmElement[], relationId: number = RELATION): CampusData {
  const nodes = new Map(elements.filter(e => e.type === 'node').map(e => [e.id, [e.lon!, e.lat!] as Pt]));
  const ways = new Map(elements.filter(e => e.type === 'way').map(e => [e.id, e]));
  const rel = elements.find(e => e.type === 'relation' && e.id === relationId);
  if (!rel) throw new Error(`relação ${relationId} não encontrada`);
  const geo = rings(rel, ways).map(r => r.map(id => nodes.get(id)).filter((p): p is Pt => !!p));
  const all = geo.flat();
  const lon0 = all.reduce((s, p) => s + p[0], 0) / all.length, lat0 = all.reduce((s, p) => s + p[1], 0) / all.length;
  const kx = 111320 * Math.cos((lat0 * Math.PI) / 180), ky = 110540;
  const m = ([lon, lat]: Pt): Pt => toMeters([lon0, lat0, kx, ky], lon, lat);
  const out: CampusData = { origin: [lon0, lat0, kx, ky], boundary: geo.map(r => r.map(m)), buildings: [], parking: [], green: [], water: [], roads: [], paths: [], trees: [], bbox: [0, 0, 0, 0] };
  for (const e of elements) {
    const t = e.tags ?? {};
    if (e.type === 'node') {
      if (t.natural === 'tree' && insideRings(geo, [e.lon!, e.lat!])) out.trees.push(m([e.lon!, e.lat!]));
      continue;
    }
    if (e.type !== 'way' || e.id === undefined || geo.length === 0) continue;
    const pts = (e.nodes ?? []).map(id => nodes.get(id)).filter((p): p is Pt => !!p);
    if (!pts.length || (rel.members ?? []).some(mb => mb.ref === e.id)) continue;
    const c: Pt = [pts.reduce((s, p) => s + p[0], 0) / pts.length, pts.reduce((s, p) => s + p[1], 0) / pts.length];
    if (!insideRings(geo, c) && !pts.some(p => insideRings(geo, p))) continue;
    const poly = pts.map(m);
    if (t.building) out.buildings.push({ n: t.name ?? '', p: poly });
    else if (t.amenity === 'parking') out.parking.push(poly);
    else if (t.leisure === 'swimming_pool' || t.natural === 'water') out.water.push(poly);
    else if (GREEN.has(t.leisure) || GREEN.has(t.landuse) || GREEN.has(t.natural)) out.green.push(poly);
    else if (PATHS.has(t.highway)) out.paths.push(poly);
    else if (t.highway) out.roads.push({ c: t.highway, p: poly });
  }
  const xs = out.boundary.flat().map(p => p[0]), ys = out.boundary.flat().map(p => p[1]);
  out.bbox = [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)];
  return out;
}

async function elementsOf(url: string): Promise<OsmElement[]> {
  const r = await fetch(url, { headers: { 'User-Agent': 'biogame/1.0 (jogo educacional da UFRN)' } });
  if (!r.ok) throw new Error(`${url} → ${r.status}`);
  return ((await r.json()) as { elements: OsmElement[] }).elements;
}

async function main(): Promise<void> {
  const api = 'https://api.openstreetmap.org/api/0.6';
  const [map, rel] = await Promise.all([elementsOf(`${api}/map.json?bbox=${BBOX.join(',')}`), elementsOf(`${api}/relation/${RELATION}/full.json`)]);
  const data = trim([...map, ...rel]);
  mkdirSync('tools/data', { recursive: true });
  writeFileSync('tools/data/campus.json', JSON.stringify(data));
  console.log(`ok: tools/data/campus.json — ${data.buildings.length} prédios, ${data.parking.length} estacionamentos, ${data.trees.length} árvores`);
}

if (import.meta.main) await main();
