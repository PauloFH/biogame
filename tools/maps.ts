import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { LAB, LAB_COLS, LAB_ROWS, LAB_SOLID } from './lab-tiles.ts';

const T = 16;
export type AreaSpec = { type: string; name: string; col: number; row: number; w?: number; h?: number; props?: Record<string, string | number> };
export type MapSpec = { name: string; title: string; base: string[]; items: string[]; areas: AreaSpec[] };
type Sheet = { firstgid: number; name: string; columns: number; rows: number };

const FLOORS: Sheet = { firstgid: 1, name: 'limezu-floors', columns: 15, rows: 40 };
const WALLS: Sheet = { firstgid: 601, name: 'limezu-walls', columns: 32, rows: 40 };
const UFRN: Sheet = { firstgid: 1881, name: 'ufrn-lab', columns: LAB_COLS, rows: LAB_ROWS };

/** Piso azul-acinzentado: bloco 3×2 nas colunas 12-14, linhas 30-31 de Room_Builder_Floors_16x16. */
const floorGid = (x: number, y: number) => FLOORS.firstgid + (30 + (y % 2)) * FLOORS.columns + 12 + (x % 3);
/** Parede bege com faixa laranja: linhas 14 (topo) e 15 (base), colunas 0/1/2 = ponta esquerda/meio/ponta direita. */
const wallId = (top: boolean, pos: 0 | 1 | 2) => (top ? 14 : 15) * WALLS.columns + pos;
const WALL_SOLID = [true, false].flatMap(top => ([0, 1, 2] as const).map(pos => wallId(top, pos)));
const ITEMS: Record<string, number> = {
  m: LAB.microscope, r: LAB.flaskRed, g: LAB.flaskGreen, u: LAB.flaskBlue, k: LAB.beaker, t: LAB.tubeRack,
  c: LAB.computer, w: LAB.windowTop, v: LAB.windowBottom, L: LAB.lockerTop, l: LAB.lockerBottom,
};
const ufrn = (id: number) => UFRN.firstgid + id;
/** 0 = ponta esquerda, 1 = meio, 2 = ponta direita, olhando os vizinhos com o mesmo caractere. */
const piece = (row: string, x: number, ch: string): 0 | 1 | 2 => (row[x - 1] !== ch ? 0 : row[x + 1] !== ch ? 2 : 1);

export function buildMap(spec: MapSpec) {
  const h = spec.base.length, w = spec.base[0].length;
  if (spec.items.length !== h) throw new Error(`${spec.name}: items tem ${spec.items.length} linhas, esperado ${h}`);
  [...spec.base, ...spec.items].forEach((row, i) => {
    if (row.length !== w) throw new Error(`${spec.name}: linha ${i % h} tem ${row.length} colunas, esperado ${w}`);
  });
  const floor: number[] = [], walls: number[] = [], furniture: number[] = [], items: number[] = [];
  for (let y = 0; y < h; y++) {
    const row = spec.base[y];
    for (let x = 0; x < w; x++) {
      let f = 0, wl = 0, fu = 0;
      switch (row[x]) {
        case '#': wl = ufrn(LAB.cap); break;
        case 'W': wl = WALLS.firstgid + wallId(spec.base[y - 1]?.[x] !== 'W', piece(row, x, 'W')); break;
        case '.': f = floorGid(x, y); break;
        case 'M': f = floorGid(x, y); fu = ufrn(LAB.mat); break;
        case 'b': f = floorGid(x, y); fu = ufrn([LAB.benchTopL, LAB.benchTopM, LAB.benchTopR][piece(row, x, 'b')]); break;
        case 'f': f = floorGid(x, y); fu = ufrn([LAB.benchFrontL, LAB.benchFrontM, LAB.benchFrontR][piece(row, x, 'f')]); break;
        default: throw new Error(`${spec.name}: caractere desconhecido "${row[x]}" em (${x},${y})`);
      }
      const it = spec.items[y][x];
      if (it !== '.' && !(it in ITEMS)) throw new Error(`${spec.name}: item desconhecido "${it}" em (${x},${y})`);
      floor.push(f);
      walls.push(wl);
      furniture.push(fu);
      items.push(it === '.' ? 0 : ufrn(ITEMS[it]));
    }
  }
  const tileLayer = (id: number, name: string, data: number[]) => ({ type: 'tilelayer', id, name, x: 0, y: 0, width: w, height: h, opacity: 1, visible: true, data });
  const tileset = (s: Sheet, solid: number[]) => ({
    firstgid: s.firstgid, name: s.name, image: `../tilesets/${s.name}.png`, imagewidth: s.columns * T, imageheight: s.rows * T,
    tilewidth: T, tileheight: T, columns: s.columns, tilecount: s.columns * s.rows, margin: 0, spacing: 0,
    tiles: solid.map(id => ({ id, properties: [{ name: 'collides', type: 'bool', value: true }] })),
  });
  const objects = spec.areas.map((a, i) => ({
    id: i + 1, name: a.name, type: a.type, x: a.col * T, y: a.row * T, width: (a.w ?? 1) * T, height: (a.h ?? 1) * T, rotation: 0, visible: true,
    properties: Object.entries(a.props ?? {}).map(([name, value]) => ({ name, type: typeof value === 'number' ? 'float' : 'string', value })),
  }));
  return {
    type: 'map', version: '1.10', tiledversion: '1.11.2', orientation: 'orthogonal', renderorder: 'right-down', infinite: false,
    width: w, height: h, tilewidth: T, tileheight: T, nextlayerid: 6, nextobjectid: objects.length + 1,
    properties: [{ name: 'name', type: 'string', value: spec.title }],
    tilesets: [tileset(FLOORS, []), tileset(WALLS, WALL_SOLID), tileset(UFRN, LAB_SOLID)],
    layers: [
      tileLayer(1, 'floor', floor), tileLayer(2, 'walls', walls), tileLayer(3, 'furniture', furniture), tileLayer(4, 'items', items),
      { type: 'objectgroup', id: 5, name: 'areas', draworder: 'topdown', x: 0, y: 0, opacity: 1, visible: true, objects },
    ],
  };
}

const row = (fill: string, w: number, edge = '#') => edge + fill.repeat(w - 2) + edge;

export const LAB_MAP: MapSpec = {
  name: 'cb-lab',
  title: 'CB · Laboratório de Biofísica',
  base: [
    '#'.repeat(26),
    row('W', 26),
    row('W', 26),
    row('.', 26),
    row('.', 26),
    '#..bbbbbbbb....bbbbbbbb..#',
    '#..ffffffff....ffffffff..#',
    row('.', 26),
    row('.', 26),
    '#..bbbbbbbb....bbbbbbbb..#',
    '#..ffffffff....ffffffff..#',
    row('.', 26),
    row('.', 26),
    row('.', 26),
    '#...........MM...........#',
    '############..############',
  ],
  items: [
    '.'.repeat(26),
    '....w...w........w...w....',
    '.LL.v...v........v...v.LL.',
    '.ll....................ll.',
    '.'.repeat(26),
    '...mrtc.gmu....mucc.kgr...',
    '.'.repeat(26),
    '.'.repeat(26),
    '.'.repeat(26),
    '...km.cgrtm....m.cgukcr...',
    '.'.repeat(26),
    '.'.repeat(26),
    '.'.repeat(26),
    '.'.repeat(26),
    '.'.repeat(26),
    '.'.repeat(26),
  ],
  areas: [
    { type: 'entry', name: 'default', col: 12, row: 12, w: 2 },
    { type: 'entry', name: 'porta-corredor', col: 12, row: 13, w: 2 },
    { type: 'door', name: 'porta', col: 12, row: 15, w: 2, props: { map: 'cb-corredor', entry: 'porta-lab' } },
    { type: 'npc', name: 'professor', col: 12, row: 3, props: { name: 'Prof. Bezerra', sprite: 'old-man', text: 'Seja bem-vindo ao CB/UFRN! Este é o laboratório de Biofísica Prática.\n---\nChegue perto das bancadas e aperte Z (ou E) para conhecer os equipamentos.' } },
    { type: 'npc', name: 'monitora', col: 13, row: 7, props: { name: 'Monitora', sprite: 'blonde-woman', text: 'Oi! Sou monitora de Biofísica.\n---\nOs minigames de microscopia chegam em breve!' } },
    { type: 'sign', name: 'microscopio', col: 3, row: 5, h: 2, props: { text: 'Microscópio de Biofísica.\n---\nEm breve: minigame de microscopia!' } },
    { type: 'website', name: 'computador', col: 17, row: 5, h: 2, props: { url: 'https://www.ufrn.br/', trigger: 'key' } },
    { type: 'sound', name: 'zumbido', col: 0, row: 0, w: 26, h: 16, props: { src: 'audio/lab-hum.wav', volume: 0.25 } },
  ],
};

export const CORRIDOR_MAP: MapSpec = {
  name: 'cb-corredor',
  title: 'CB · Corredor',
  base: [
    '#########..#########',
    '#WWWWWWWW..WWWWWWWW#',
    '#WWWWWWWW..WWWWWWWW#',
    row('.', 20),
    row('.', 20),
    row('.', 20),
    row('.', 20),
    row('.', 20),
    '#'.repeat(20),
  ],
  items: [
    '.'.repeat(20),
    '....w..........w....',
    '....v..........v....',
    ...Array.from({ length: 6 }, () => '.'.repeat(20)),
  ],
  areas: [
    { type: 'entry', name: 'default', col: 9, row: 5, w: 2 },
    { type: 'entry', name: 'porta-lab', col: 9, row: 3, w: 2 },
    { type: 'door', name: 'voltar', col: 9, row: 0, w: 2, props: { map: 'cb-lab', entry: 'porta-corredor' } },
    { type: 'sign', name: 'saida', col: 17, row: 4, props: { text: 'Saída para o campus.\n---\nEm breve: o Campus Central inteiro!' } },
    { type: 'sound', name: 'zumbido', col: 0, row: 0, w: 20, h: 9, props: { src: 'audio/lab-hum.wav', volume: 0.1 } },
  ],
};

export const MAPS = [LAB_MAP, CORRIDOR_MAP];

function main(): void {
  const force = process.argv.includes('--force');
  mkdirSync('public/maps', { recursive: true });
  for (const spec of MAPS) {
    const file = `public/maps/${spec.name}.tmj`;
    if (existsSync(file) && !force) {
      console.log(`pulei ${file} (já existe; use "npm run maps -- --force" para sobrescrever edições do Tiled)`);
      continue;
    }
    writeFileSync(file, JSON.stringify(buildMap(spec), null, 1));
    console.log(`ok: ${file}`);
  }
}

if (import.meta.main) main();
