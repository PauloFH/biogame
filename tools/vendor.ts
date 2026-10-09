import { cpSync, existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { PART_DIRS, PART_KINDS, type PartKind, type Parts } from '../src/character.ts';
import { ATLAS_COLS, ATLAS_ROWS, BLOB_AT, BLOB_SOURCE, CAR_IDS, CARS_LEFT, CARS_RIGHT, DECOR, DECOR_FILES, PLAIN, SIGN, SIGN_FILE, TREE_SPECS, TREES, type BlobName, type Stamp } from './campus-atlas.ts';
import { Pix } from './pix.ts';
import { decodePng } from './png.ts';

const X = 'vendor/x';
const CG = `${X}/moderninteriors-win/2_Characters/Character_Generator`;
const ROOM = `${X}/moderninteriors-win/1_Interiors/16x16/Room_Builder_subfiles`;
const EXT = `${X}/modernexteriors-win/Modern_Exteriors_16x16`;
const PS = `${X}/RPG_Top_Down_Character_Asset_Pack_-_FULL/RPG Top Down Characters - Full version`;
const CG_DIRS: Record<PartKind, string> = { body: 'Bodies', eyes: 'Eyes', outfit: 'Outfits', hair: 'Hairstyles', acc: 'Accessories' };

export const kebab = (s: string): string => s.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
export const pngs = (files: string[]): string[] => files.filter(f => /\.png$/i.test(f) && !/_shadow\.png$/i.test(f)).sort();

function main(): void {
  if (!existsSync(X)) throw new Error('vendor/x não existe: extraia os zips de vendor/zips (ver Task 4, Step 1)');
  mkdirSync('public/tilesets', { recursive: true });
  cpSync(`${ROOM}/Room_Builder_Floors_16x16.png`, 'public/tilesets/limezu-floors.png');
  cpSync(`${ROOM}/Room_Builder_Walls_16x16.png`, 'public/tilesets/limezu-walls.png');

  const parts = {} as Parts;
  for (const k of PART_KINDS) {
    const src = `${CG}/${CG_DIRS[k]}/16x16`, dst = `public/sprites/character/${PART_DIRS[k]}`;
    mkdirSync(dst, { recursive: true });
    parts[k] = pngs(readdirSync(src));
    for (const f of parts[k]) cpSync(join(src, f), join(dst, f));
  }
  writeFileSync('public/sprites/character/manifest.json', JSON.stringify(parts));

  const npcs: string[] = [];
  mkdirSync('public/sprites/npc', { recursive: true });
  for (const dir of readdirSync(PS).sort()) {
    const [sheet] = pngs(readdirSync(join(PS, dir)));
    if (!sheet) continue;
    const key = kebab(dir);
    npcs.push(key);
    cpSync(join(PS, dir, sheet), `public/sprites/npc/${key}.png`);
  }
  writeFileSync('public/sprites/npc/manifest.json', JSON.stringify(npcs));
  buildCampusAtlas();
  console.log(`ok: ${PART_KINDS.map(k => `${k}=${parts[k].length}`).join(' ')} npcs=${npcs.length}`);
}

/** Monta public/tilesets/limezu-campus.png com só o que o gerador do campus usa, no layout de campus-atlas.ts. */
function buildCampusAtlas(): void {
  const atlas = new Pix(ATLAS_COLS * 16, ATLAS_ROWS * 16);
  const png = (path: string) => decodePng(readFileSync(path));
  const godot = png(`${EXT}/Autotiles_16x16/Godot_Autotiles_16x16.png`);
  for (const b of Object.keys(BLOB_AT) as BlobName[]) atlas.blit(godot, 0, BLOB_SOURCE[b] * 64, 192, 64, BLOB_AT[b][0] * 16, BLOB_AT[b][1] * 16);
  for (const t of Object.values(PLAIN)) atlas.blit(png(`${EXT}/ME_Theme_Sorter_16x16/${t.sheet}`), t.from[0] * 16, t.from[1] * 16, 16, 16, t.at[0] * 16, t.at[1] * 16);
  const stamp = (path: string, s: Stamp) => {
    const img = png(path);
    if (img.width !== s.w * 16 || img.height !== s.h * 16) throw new Error(`${path}: esperava ${s.w * 16}×${s.h * 16}, veio ${img.width}×${img.height}`);
    atlas.blit(img, 0, 0, img.width, img.height, s.at[0] * 16, s.at[1] * 16);
  };
  const cars = `${EXT}/ME_Theme_Sorter_16x16/10_Vehicles_Singles_16x16/ME_Singles_Vehicles_16x16_Car`;
  CAR_IDS.forEach((id, i) => {
    stamp(`${cars}_Left_${id}.png`, CARS_LEFT[i]);
    stamp(`${cars}_Right_${id}.png`, CARS_RIGHT[i]);
  });
  const singles = `${EXT}/Modern_Exteriors_Complete_Singles_16x16`;
  TREE_SPECS.forEach((t, i) => stamp(`${singles}/ME_Singles_City_Props_16x16_Tree_${t.id}.png`, TREES[i]));
  DECOR_FILES.forEach((f, i) => stamp(`${singles}/${f}`, DECOR[i]));
  stamp(`${singles}/${SIGN_FILE}`, SIGN);
  writeFileSync('public/tilesets/limezu-campus.png', atlas.png());
}

if (import.meta.main) main();
