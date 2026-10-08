import { cpSync, existsSync, mkdirSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { PART_DIRS, PART_KINDS, type PartKind, type Parts } from '../src/character.ts';

const X = 'vendor/x';
const CG = `${X}/moderninteriors-win/2_Characters/Character_Generator`;
const ROOM = `${X}/moderninteriors-win/1_Interiors/16x16/Room_Builder_subfiles`;
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
  console.log(`ok: ${PART_KINDS.map(k => `${k}=${parts[k].length}`).join(' ')} npcs=${npcs.length}`);
}

if (import.meta.main) main();
