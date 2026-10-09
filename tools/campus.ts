// Corta a grade do campus em setores e monta cada setor como mapa do Tiled (camadas osm-*).
import { blobMask, GODOT_BLOB } from './blob.ts';
import { ATLAS_COLS, ATLAS_ROWS, atlasId, BLOB_AT, CARS_LEFT, CARS_RIGHT, DECOR, DECOR_TUFTS, PLAIN, SIGN, TREES, type BlobName, type Stamp } from './campus-atlas.ts';
import { BLD, cellAt, GRASS, OUT, PARK, PAVE, ROAD, WATER, walkable, type Grid } from './grid.ts';
import type { CampusData } from './osm-data.ts';
import { areaLayer, prop, tiledMap, tileLayer, tileset, type AreaSpec, type Sheet } from './tiled.ts';

export const SECTOR = 160;
export type Sector = { name: string; cx: number; cy: number; x0: number; y0: number; w: number; h: number };
/** Ponto de interesse (tools/data/pontos.json) já em metros do campus: vira uma placa no lugar andável mais próximo. */
export type Ponto = { name: string; x: number; y: number; text: string };
const SHEET: Sheet = { firstgid: 1, name: 'limezu-campus', columns: ATLAS_COLS, rows: ATLAS_ROWS };
const gid = (c: number, r: number) => SHEET.firstgid + atlasId(c, r);
const blobGid = (b: BlobName, mask: number) => gid(BLOB_AT[b][0] + GODOT_BLOB[mask][0], BLOB_AT[b][1] + GODOT_BLOB[mask][1]);
const cellsOf = (s: Stamp, rows: number[] = Array.from({ length: s.h }, (_, r) => r)) =>
  rows.flatMap(r => Array.from({ length: s.w }, (_, c) => atlasId(s.at[0] + c, s.at[1] + r)));

/** Ids locais do atlas que bloqueiam: telhados, mata, água, carros, o pé das placas e a linha do tronco das árvores. */
export const CAMPUS_SOLID: number[] = [
  ...(['roof', 'forest', 'water'] as const).flatMap(b => Object.values(GODOT_BLOB).map(([c, r]) => atlasId(BLOB_AT[b][0] + c, BLOB_AT[b][1] + r))),
  ...[...CARS_LEFT, ...CARS_RIGHT].flatMap(s => cellsOf(s)),
  ...cellsOf(SIGN, [SIGN.h - 1]),
  ...TREES.flatMap(s => cellsOf(s, [s.h - 1])),
];

export function sectors(g: Grid): Sector[] {
  const out: Sector[] = [];
  for (let cy = 0; cy * SECTOR < g.h; cy++) {
    for (let cx = 0; cx * SECTOR < g.w; cx++) {
      const x0 = cx * SECTOR, y0 = cy * SECTOR, w = Math.min(SECTOR, g.w - x0), h = Math.min(SECTOR, g.h - y0);
      let any = false;
      for (let j = y0; j < y0 + h && !any; j++) for (let i = x0; i < x0 + w; i++) if (g.cls[j * g.w + i] !== OUT) { any = true; break; }
      if (any) out.push({ name: `campus-${cx}-${cy}`, cx, cy, x0, y0, w, h });
    }
  }
  return out;
}

const hash = (i: number, j: number, salt: number) => {
  let h = Math.imul(i, 374761393) + Math.imul(j, 668265263) + Math.imul(salt, 0x9e3779b1);
  h = Math.imul(h ^ (h >>> 16), 0x85ebca6b);
  h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
};

type Link = { doorA: AreaSpec; entryA: AreaSpec; doorB: AreaSpec; entryB: AreaSpec };
/** Passagens entre dois setores vizinhos: um par porta+entrada por trecho de 4 tiles andável dos dois lados. */
export function edgeLinks(g: Grid, a: Sector, b: Sector): Link[] {
  const horizontal = b.cx === a.cx + 1 && b.cy === a.cy, vertical = b.cy === a.cy + 1 && b.cx === a.cx;
  if (!horizontal && !vertical) return [];
  const len = horizontal ? a.h : a.w, links: Link[] = [];
  // 2 tiles livres em cada ponta: assim nenhuma porta ou entrada cai no canto, onde encostaria na borda perpendicular
  for (let k = 0; 2 + k * 4 < len - 2; k++) {
    const start = 2 + k * 4, span = Math.min(4, len - 2 - start);
    // u = posição ao longo da borda; a borda de A é a última coluna/linha dela, a de B a primeira
    const ok = (u: number) => [-2, -1, 0, 1, 2, 3].every(d => walkable(horizontal ? cellAt(g, b.x0 + d - 1, u) : cellAt(g, u, b.y0 + d - 1)));
    const base = (horizontal ? a.y0 : a.x0) + start;
    const u = Array.from({ length: span }, (_, n) => base + n).find(ok);
    if (u === undefined) continue;
    const at = (s: Sector, along: number, across: number): Pick<AreaSpec, 'col' | 'row'> =>
      horizontal ? { col: across - s.x0, row: along - s.y0 } : { col: along - s.x0, row: across - s.y0 };
    const edgeA = horizontal ? a.x0 + a.w - 1 : a.y0 + a.h - 1, edgeB = horizontal ? b.x0 : b.y0;
    const strip = horizontal ? { w: 1, h: span } : { w: span, h: 1 };
    links.push({
      doorA: { type: 'door', name: `para-${b.name}-${k}`, ...at(a, base, edgeA), ...strip, props: { map: b.name, entry: `de-${a.name}-${k}` } },
      entryA: { type: 'entry', name: `de-${b.name}-${k}`, ...at(a, u, edgeA - 2) },
      doorB: { type: 'door', name: `para-${a.name}-${k}`, ...at(b, base, edgeB), ...strip, props: { map: a.name, entry: `de-${b.name}-${k}` } },
      entryB: { type: 'entry', name: `de-${a.name}-${k}`, ...at(b, u, edgeB + 2) },
    });
  }
  return links;
}

/** Primeira célula andável abaixo do centro da base de um prédio (onde ficam porta e placa). */
function frontOf(g: Grid, s: Sector, n: number): [number, number] | null {
  let minI = Infinity, maxI = -1, maxJ = -1;
  for (let j = s.y0; j < s.y0 + s.h; j++) for (let i = s.x0; i < s.x0 + s.w; i++) if (g.bld[j * g.w + i] === n) { minI = Math.min(minI, i); maxI = Math.max(maxI, i); maxJ = Math.max(maxJ, j); }
  if (maxI < 0) return null;
  const i = Math.round((minI + maxI) / 2);
  for (let j = maxJ + 1; j <= maxJ + 4 && j < s.y0 + s.h; j++) if (walkable(cellAt(g, i, j))) return [i, j];
  return null;
}

export const CB_NAME = 'CB';
/** Setor e entrada do campus que ligam com o corredor do CB. */
export function cbLink(g: Grid, d: CampusData): { map: string; entry: string } {
  const n = d.buildings.findIndex(b => b.n === CB_NAME);
  const s = sectors(g).find(sec => frontOf(g, sec, n));
  if (!s) throw new Error('CB sem frente andável no campus');
  return { map: s.name, entry: 'cb' };
}

export function buildSector(g: Grid, d: CampusData, s: Sector, all: Sector[], pontos: Ponto[] = []) {
  const W = s.w, H = s.h, cls = (i: number, j: number) => cellAt(g, s.x0 + i, s.y0 + j);
  const busy = new Uint8Array(W * H);
  const free = (i: number, j: number) => i >= 0 && j >= 0 && i < W && j < H && !busy[j * W + i];
  const occupy = (i: number, j: number, w: number, h: number) => { for (let y = j; y < j + h; y++) for (let x = i; x < i + w; x++) if (x >= 0 && y >= 0 && x < W && y < H) busy[y * W + x] = 1; };

  // áreas primeiro: cada uma reserva, ao ser criada, a própria célula, 1 tile em volta e 2 acima, para árvores, carros e placas posteriores não taparem portas e entradas
  const areas: AreaSpec[] = [];
  const add = (a: AreaSpec) => { areas.push(a); occupy(a.col - 1, a.row - 2, (a.w ?? 1) + 2, (a.h ?? 1) + 3); };
  /** Célula andável e livre (fora da reserva das áreas já criadas) do setor mais próxima (distância euclidiana) de (i, j). */
  const near = (i: number, j: number): [number, number] => {
    let best: [number, number] = [i, j], bestD = Infinity;
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const dist = (x - i) ** 2 + (y - j) ** 2;
      if (dist < bestD && walkable(cls(x, y)) && free(x, y)) { best = [x, y]; bestD = dist; }
    }
    return best;
  };
  const [ci, cj] = near(Math.floor(W / 2), Math.floor(H / 2)); // a primeira área: tudo está livre
  add({ type: 'entry', name: 'default', col: ci, row: cj });
  for (const o of all) {
    for (const l of edgeLinks(g, s, o)) { add(l.doorA); add(l.entryA); }
    for (const l of edgeLinks(g, o, s)) { add(l.doorB); add(l.entryB); }
  }
  let largest = { n: '', size: 0 };
  d.buildings.forEach((b, n) => {
    if (!b.n) return;
    let size = 0;
    for (let j = s.y0; j < s.y0 + H; j++) for (let i = s.x0; i < s.x0 + W; i++) if (g.bld[j * g.w + i] === n) size++;
    if (size > largest.size) largest = { n: b.n, size };
    const f = frontOf(g, s, n);
    if (!f) return;
    const [i, j] = [f[0] - s.x0, f[1] - s.y0];
    if (b.n === CB_NAME) {
      add({ type: 'door', name: 'porta-cb', col: i, row: j, props: { map: 'cb-corredor', entry: 'porta-campus' } });
      const below = [2, 3, 4, 5].map(dy => j + dy).find(y => walkable(cls(i, y)));
      if (below !== undefined) add({ type: 'entry', name: 'cb', col: i, row: below });
      if (walkable(cls(i + 2, j + 1))) add({ type: 'npc', name: 'vigilante', col: i + 2, row: j + 1, props: { name: 'Vigilante', sprite: 'policeman', text: 'Bem-vindo ao Campus Central da UFRN!\n---\nEsse é o Centro de Biociências. O laboratório de Biofísica fica lá dentro.' } });
    } else {
      // a placa desce até 3 linhas para fugir de entradas e portas; sem célula andável e livre na coluna, vai para a mais próxima até 7 células (near cai em (i, j) quando não acha: confere de novo); sem nenhuma, fica sem placa
      const row = [0, 1, 2, 3].map(dy => j + dy).find(y => walkable(cls(i, y)) && free(i, y));
      const [ni, nj] = row !== undefined ? [i, row] : near(i, j);
      if (Math.hypot(ni - i, nj - j) <= 7 && walkable(cls(ni, nj)) && free(ni, nj)) add({ type: 'sign', name: `placa-${n}`, col: ni, row: nj, props: { text: b.n } });
    }
  });
  for (const p of pontos) {
    const fi = Math.floor((p.x - g.x0) / g.mpt) - s.x0, fj = Math.floor((p.y - g.y0) / g.mpt) - s.y0;
    if (fi < 0 || fj < 0 || fi >= W || fj >= H) continue;
    const [i, j] = near(fi, fj);
    add({ type: 'sign', name: `ponto-${p.name}`, col: i, row: j, props: { text: p.text } });
  }

  const layer = () => new Array<number>(W * H).fill(0);
  const chao = layer(), calcada = layer(), grama = layer(), terreno = layer(), detalhes = layer(), objetos = layer(), copas = layer();
  const isRoad = (c: number) => c === ROAD || c === PARK;
  const blobAt = (i: number, j: number, inside: (c: number) => boolean) => blobMask((dx, dy) => inside(cls(i + dx, j + dy)));
  for (let j = 0; j < H; j++) {
    for (let i = 0; i < W; i++) {
      const c = cls(i, j), k = j * W + i;
      if (isRoad(c)) chao[k] = gid(PLAIN.asphalt.at[0], PLAIN.asphalt.at[1]);
      if (c === PAVE) calcada[k] = blobGid('sidewalk', blobAt(i, j, x => !isRoad(x)));
      if (c === GRASS) grama[k] = gid(PLAIN.grass.at[0], PLAIN.grass.at[1]);
      else if (c === PAVE || isRoad(c)) {
        const m = blobAt(i, j, x => x !== GRASS && x !== OUT);
        if (m !== 255) grama[k] = blobGid('grass', m);
      }
      if (c === PARK) terreno[k] = blobGid('parking', blobAt(i, j, x => x === PARK));
      else if (c === BLD) terreno[k] = blobGid('roof', blobAt(i, j, x => x === BLD));
      else if (c === WATER) terreno[k] = blobGid('water', blobAt(i, j, x => x === WATER));
      else if (c === OUT) terreno[k] = blobGid('forest', blobAt(i, j, x => x === OUT));
      if (c === GRASS && hash(s.x0 + i, s.y0 + j, 6) < 0.05) {
        const pick = hash(s.x0 + i, s.y0 + j, 7), flowers = DECOR.length - DECOR_TUFTS;
        const n = pick < 0.25 ? DECOR_TUFTS + Math.floor((pick / 0.25) * flowers) : Math.floor(((pick - 0.25) / 0.75) * DECOR_TUFTS);
        detalhes[k] = gid(DECOR[n].at[0], DECOR[n].at[1]);
      }
    }
  }

  const stamp = (st: Stamp, i: number, j: number, canopyRows: number) => {
    for (let r = 0; r < st.h; r++) for (let c = 0; c < st.w; c++) {
      const into = r < canopyRows ? copas : objetos;
      into[(j + r) * W + i + c] = gid(st.at[0] + c, st.at[1] + r);
    }
    occupy(i, j, st.w, st.h);
  };
  const fits = (i: number, j: number, w: number, h: number, ok: (c: number) => boolean, footRows = h) => {
    for (let y = j; y < j + h; y++) for (let x = i; x < i + w; x++) if (!free(x, y) || (y >= j + h - footRows && !ok(cls(x, y)))) return false;
    return true;
  };
  const tryTree = (fi: number, fj: number, salt: number) => {
    const t = TREES[Math.floor(hash(fi, fj, salt) * TREES.length)], i = fi - Math.floor(t.w / 2), j = fj - t.h + 1;
    if (fits(i, j, t.w, t.h, c => c === GRASS, 1)) stamp(t, i, j, t.h - 1);
  };
  // placa visível em cada área de placa: o pé fica na célula da área (bloqueia; fala-se de perto), o topo por cima
  for (const a of areas) if (a.type === 'sign' && a.row >= SIGN.h - 1) stamp(SIGN, a.col, a.row - SIGN.h + 1, SIGN.h - 1);
  for (const [x, y] of d.trees) {
    const fi = Math.floor((x - g.x0) / g.mpt) - s.x0, fj = Math.floor((y - g.y0) / g.mpt) - s.y0;
    if (fi >= 0 && fj >= 0 && fi < W && fj < H) tryTree(fi, fj, 1);
  }
  for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) if (cls(i, j) === GRASS && hash(s.x0 + i, s.y0 + j, 2) < 0.012) tryTree(i, j, 3);
  // Carros sempre de lado, em fileiras de 4×3 com 1 tile de folga; a frente alterna por coluna.
  for (let j = 0; j < H; j++) {
    for (let i = 0; i < W; i++) {
      const gi = s.x0 + i, gj = s.y0 + j, lot = g.lot[gj * g.w + gi];
      if (lot < 0 || hash(gi, gj, 4) > 0.65 || gi % 5 || gj % 4 || !fits(i, j, 4, 3, c => c === PARK)) continue;
      const cars = (gi / 5) % 2 ? CARS_RIGHT : CARS_LEFT;
      stamp(cars[Math.floor(hash(gi, gj, 5) * cars.length)], i, j, 0);
    }
  }

  const title = largest.n ? `Campus · ${largest.n}` : 'Campus Central';
  return tiledMap(W, H, [prop('name', title), prop('minimap', `maps/${s.name}.mini.png`)], [tileset(SHEET, CAMPUS_SOLID)], [
    tileLayer(1, 'osm-chao', W, H, chao), tileLayer(2, 'osm-calcada', W, H, calcada), tileLayer(3, 'osm-grama', W, H, grama),
    tileLayer(4, 'osm-terreno', W, H, terreno), tileLayer(5, 'osm-detalhes', W, H, detalhes), tileLayer(6, 'osm-objetos', W, H, objetos),
    tileLayer(7, 'osm-copas', W, H, copas, [prop('above', true)]), areaLayer(8, areas, 'osm-areas'),
  ]);
}

/** Cores do minimapa por classe (OUT, GRASS, PAVE, ROAD, PARK, BLD, WATER). */
export const MINIMAP_COLORS = ['#2f4a2f', '#7fbf6a', '#d8d4c8', '#55555f', '#6f6f7a', '#e8dcc0', '#4aa3e0'];

type MapJson = {
  width: number; height: number;
  layers: { id: number; name: string; type: string; objects?: { id: number }[] }[];
  tilesets: { name: string; firstgid: number; tilecount: number }[];
  properties?: { name: string }[]; nextlayerid: number; nextobjectid: number;
};
/**
 * Regera só as camadas osm-* de um mapa que já existe, cada uma no lugar onde estava na pilha.
 * Camadas, áreas, tilesets e propriedades feitos à mão no Tiled ficam intactos (numa propriedade de mesmo nome, vale a do arquivo existente).
 */
export function mergeOsmLayers<M extends MapJson>(existing: M, generated: M): M {
  if (existing.width !== generated.width || existing.height !== generated.height) throw new Error(`o mapa existente tem ${existing.width}×${existing.height} tiles e o setor gerado ${generated.width}×${generated.height}: o tamanho do setor mudou e as camadas feitas à mão ficariam desalinhadas; ajuste o mapa no Tiled ou apague o arquivo para gerar de novo`);
  const fresh = new Map(generated.layers.map(l => [l.name, l]));
  const layers = existing.layers.flatMap(l => (l.name.startsWith('osm-') ? (fresh.has(l.name) ? [fresh.get(l.name)!] : []) : [l]));
  for (const l of generated.layers) if (!layers.includes(l)) layers.push(l);
  const manual = layers.filter(l => !l.name.startsWith('osm-'));
  let lastId = Math.max(0, ...layers.map(l => l.id));
  const taken = new Set(manual.map(l => l.id));
  let lastObject = Math.max(0, ...manual.flatMap(l => (l.objects ?? []).map(o => o.id)));
  const merged = layers.map(l => {
    if (!l.name.startsWith('osm-')) return l;
    const id = taken.has(l.id) ? ++lastId : l.id;
    lastId = Math.max(lastId, id);
    return { ...l, id, ...(l.objects ? { objects: l.objects.map(o => ({ ...o, id: ++lastObject })) } : {}) };
  });
  const ours = new Set(generated.tilesets.map(t => t.name));
  const end = Math.max(...generated.tilesets.map(t => t.firstgid + t.tilecount));
  const extra = existing.tilesets.filter(t => !ours.has(t.name));
  for (const t of extra) if (t.firstgid < end) throw new Error(`tileset "${t.name}" (firstgid ${t.firstgid}) colide com o gerado (vai até ${end - 1}); mova-o no Tiled para firstgid ≥ ${end}`);
  const props = new Set((existing.properties ?? []).map(p => p.name));
  return {
    ...existing, ...generated,
    layers: merged, tilesets: [...generated.tilesets, ...extra],
    properties: [...(existing.properties ?? []), ...(generated.properties ?? []).filter(p => !props.has(p.name))],
    nextlayerid: 1 + Math.max(...merged.map(l => l.id)),
    nextobjectid: 1 + Math.max(lastObject, ...merged.flatMap(l => (l.objects ?? []).map(o => o.id))),
  };
}
