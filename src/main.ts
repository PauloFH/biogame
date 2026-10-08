/// <reference types="vite/client" />
import Phaser from 'phaser';
import { World, type WorldData } from './world.ts';
import { defaultCharacter, layerUrls, loadSavedRaw, parseSaved, saveCharacter, type Character, type Parts } from './character.ts';
import { composeLayers } from './compose.ts';
import { initUi, openCreator } from './ui.ts';

const TILESETS = ['limezu-floors', 'limezu-walls', 'ufrn-lab'];
const START: WorldData = { map: 'cb-lab', entry: 'default' };

class Boot extends Phaser.Scene {
  constructor() {
    super('boot');
  }

  preload(): void {
    for (const t of TILESETS) this.load.image(t, `tilesets/${t}.png`);
    for (const n of this.registry.get('npcs') as string[]) this.load.spritesheet(`npc:${n}`, `sprites/npc/${n}.png`, { frameWidth: 32, frameHeight: 32 });
  }

  create(): void {
    this.scene.start('world', START);
  }
}

async function getJson<T>(url: string): Promise<T> {
  const r = await fetch(url);
  if (!r.ok) throw new Error(`${url} → ${r.status}. Rodou "npm run vendor"?`);
  return r.json() as Promise<T>;
}

async function main(): Promise<void> {
  initUi();
  const [parts, npcs] = await Promise.all([getJson<Parts>('sprites/character/manifest.json'), getJson<string[]>('sprites/npc/manifest.json')]);
  const character = parseSaved(loadSavedRaw(), parts) ?? await new Promise<Character>(done => openCreator(parts, defaultCharacter(parts), done));
  saveCharacter(character);
  const playerImage = await composeLayers(layerUrls(character.look));
  const game = new Phaser.Game({
    type: Phaser.WEBGL,
    parent: 'game',
    pixelArt: true,
    backgroundColor: '#1d1f2b',
    scale: { mode: Phaser.Scale.RESIZE, width: window.innerWidth, height: window.innerHeight },
    physics: { default: 'arcade' },
    scene: [Boot, World],
    callbacks: { preBoot: g => g.registry.set({ parts, npcs, character, playerImage, playerVersion: 1 }) },
  });
  if (import.meta.env.DEV) Object.assign(window, { game });
}

main().catch((err: unknown) => {
  console.error(err);
  const p = document.createElement('p');
  p.className = 'fatal';
  p.textContent = `Erro ao iniciar: ${err instanceof Error ? err.message : String(err)}`;
  document.body.append(p);
});
