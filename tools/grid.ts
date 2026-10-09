// Rasteriza o recorte do OSM numa grade de células (1 célula = 1 tile do jogo).
import type { CampusData, Pt } from './osm-data.ts';

export const OUT = 0, GRASS = 1, PAVE = 2, ROAD = 3, PARK = 4, BLD = 5, WATER = 6;
export const METERS_PER_TILE = 2;
/** Largura da pista em metros por tipo de via do OSM. */
const ROAD_WIDTH: Record<string, number> = { trunk: 16, primary: 14, secondary: 12, tertiary: 9, residential: 7, unclassified: 7, living_street: 6, service: 5 };
const SIDEWALK = 3, PATH_WIDTH = 3;

export type Grid = { w: number; h: number; x0: number; y0: number; mpt: number; cls: Uint8Array; bld: Int32Array; lot: Int32Array };

/** Preenche (regra par-ímpar) as células cujo centro cai dentro dos anéis. */
function scanFill(g: Grid, rs: Pt[][], set: (k: number) => void): void {
  const ys = rs.flat().map(p => p[1]);
  const j0 = Math.max(0, Math.floor((Math.min(...ys) - g.y0) / g.mpt)), j1 = Math.min(g.h - 1, Math.ceil((Math.max(...ys) - g.y0) / g.mpt));
  for (let j = j0; j <= j1; j++) {
    const y = g.y0 + (j + 0.5) * g.mpt, xs: number[] = [];
    for (const r of rs) {
      for (let a = 0, b = r.length - 1; a < r.length; b = a++) {
        const [xa, ya] = r[a], [xb, yb] = r[b];
        if (ya > y !== yb > y) xs.push(xa + ((y - ya) * (xb - xa)) / (yb - ya));
      }
    }
    xs.sort((p, q) => p - q);
    for (let k = 0; k + 1 < xs.length; k += 2) {
      const i0 = Math.max(0, Math.ceil((xs[k] - g.x0) / g.mpt - 0.5)), i1 = Math.min(g.w - 1, Math.floor((xs[k + 1] - g.x0) / g.mpt - 0.5));
      for (let i = i0; i <= i1; i++) set(j * g.w + i);
    }
  }
}

/** Marca as células cujo centro está a até `width/2` metros da linha. */
function stroke(g: Grid, pts: Pt[], width: number, set: (k: number) => void): void {
  const r = width / 2;
  for (let s = 0; s + 1 < pts.length; s++) {
    const [ax, ay] = pts[s], [bx, by] = pts[s + 1], dx = bx - ax, dy = by - ay, len2 = dx * dx + dy * dy || 1;
    const i0 = Math.max(0, Math.floor((Math.min(ax, bx) - r - g.x0) / g.mpt)), i1 = Math.min(g.w - 1, Math.ceil((Math.max(ax, bx) + r - g.x0) / g.mpt));
    const j0 = Math.max(0, Math.floor((Math.min(ay, by) - r - g.y0) / g.mpt)), j1 = Math.min(g.h - 1, Math.ceil((Math.max(ay, by) + r - g.y0) / g.mpt));
    for (let j = j0; j <= j1; j++) {
      for (let i = i0; i <= i1; i++) {
        const px = g.x0 + (i + 0.5) * g.mpt, py = g.y0 + (j + 0.5) * g.mpt;
        const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / len2));
        if (Math.hypot(px - ax - t * dx, py - ay - t * dy) <= r) set(j * g.w + i);
      }
    }
  }
}

export function rasterize(d: CampusData, mpt: number = METERS_PER_TILE): Grid {
  const [x0, y0, x1, y1] = d.bbox, w = Math.ceil((x1 - x0) / mpt), h = Math.ceil((y1 - y0) / mpt);
  const g: Grid = { w, h, x0, y0, mpt, cls: new Uint8Array(w * h), bld: new Int32Array(w * h).fill(-1), lot: new Int32Array(w * h).fill(-1) };
  const inCampus = (k: number) => g.cls[k] !== OUT;
  scanFill(g, d.boundary, k => { g.cls[k] = GRASS; });
  const paint = (v: number) => (k: number) => { if (inCampus(k)) g.cls[k] = v; };
  for (const p of d.paths) stroke(g, p, PATH_WIDTH, paint(PAVE));
  for (const r of d.roads) stroke(g, r.p, (ROAD_WIDTH[r.c] ?? 4) + 2 * SIDEWALK, k => { if (inCampus(k) && g.cls[k] !== ROAD) g.cls[k] = PAVE; });
  for (const r of d.roads) stroke(g, r.p, ROAD_WIDTH[r.c] ?? 4, paint(ROAD));
  d.parking.forEach((p, n) => scanFill(g, [p], k => { if (inCampus(k)) { g.cls[k] = PARK; g.lot[k] = n; } }));
  for (const p of d.water) scanFill(g, [p], paint(WATER));
  d.buildings.forEach((b, n) => scanFill(g, [b.p], k => { if (inCampus(k)) { g.cls[k] = BLD; g.bld[k] = n; } }));
  return g;
}

export const cellAt = (g: Grid, i: number, j: number): number => (i < 0 || j < 0 || i >= g.w || j >= g.h ? OUT : g.cls[j * g.w + i]);
export const walkable = (c: number): boolean => c === GRASS || c === PAVE || c === ROAD || c === PARK;
