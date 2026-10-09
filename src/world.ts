import Phaser from 'phaser';
import { areaObjects, contains, entryPoint, near, parseAreas, type Area, type TiledObject } from './areas.ts';
import { dirFromVelocity, limezuFrames, pixelserialFrames, type Dir } from './anims.ts';
import { layerUrls, saveCharacter, type Character, type Parts } from './character.ts';
import { composeLayers } from './compose.ts';
import { openDialog, press, reveal, type Dialog } from './dialog.ts';
import * as ui from './ui.ts';

const SPEED = 80, RUN = 150, ZOOM = 3, TALK_PAD = 16, FEET = 12;
const DIRS: Dir[] = ['right', 'up', 'left', 'down'];
type Point = { x: number; y: number };
export type WorldData = { map: string; entry: string; pos?: Point; prev?: { map: string; entry: string } };
type RawMap = { tilesets: { name: string }[]; layers: { type: string; name: string; objects?: TiledObject[] }[] };
type Keys = Record<'up' | 'down' | 'left' | 'right' | 'w' | 'a' | 's' | 'd' | 'run' | 'e' | 'z' | 'say' | 'esc' | 'mute' | 'edit', Phaser.Input.Keyboard.Key>;

/** Lê uma propriedade do Tiled, venha como array [{name, value}] ou como objeto. */
function prop(props: unknown, name: string): unknown {
  if (Array.isArray(props)) return props.find(p => p?.name === name)?.value;
  return (props as Record<string, unknown> | undefined)?.[name];
}

export class World extends Phaser.Scene {
  private here!: WorldData;
  private player!: Phaser.Physics.Arcade.Sprite;
  private keys!: Keys;
  private areas: Area[] = [];
  private inside = new Set<Area>();
  private panelArea: Extract<Area, { kind: 'website' }> | null = null;
  private sounds = new Map<Area, Phaser.Sound.BaseSound>();
  private dialog: Dialog | null = null;
  private facing: Dir = 'down';
  private leaving = false;
  private busy = false;
  private balloon = { text: '', until: 0 };
  private ready = false;
  private mapSize = { w: 1, h: 1 };

  constructor() {
    super('world');
  }

  init(data: WorldData): void {
    // A mesma instância é reaproveitada a cada restart: zera tudo aqui.
    this.here = data;
    this.areas = [];
    this.inside = new Set();
    this.panelArea = null;
    this.sounds = new Map();
    this.dialog = null;
    this.facing = 'down';
    this.leaving = false;
    this.busy = false;
    this.balloon = { text: '', until: 0 };
    this.ready = false;
  }

  preload(): void {
    const key = `map:${this.here.map}`;
    if (!this.cache.tilemap.exists(key)) this.load.tilemapTiledJSON(key, `maps/${this.here.map}.tmj`);
  }

  create(): void {
    const key = `map:${this.here.map}`;
    if (!this.cache.tilemap.exists(key)) return this.fail(`Mapa "${this.here.map}" não encontrado`);
    // Tilesets carregados sob demanda pelo nome (tilesets/<nome>.png): mapa novo do Tiled não precisa de código.
    const raw = this.cache.tilemap.get(key).data as RawMap;
    const missing = raw.tilesets.map(t => t.name).filter(n => !this.textures.exists(n));
    if (!missing.length) return this.build(key, raw);
    missing.forEach(n => this.load.image(n, `tilesets/${n}.png`));
    this.load.once(Phaser.Loader.Events.COMPLETE, () => {
      missing.filter(n => !this.textures.exists(n)).forEach(n => console.warn(`[areas] tileset "${n}" não encontrado em tilesets/${n}.png`));
      this.build(key, raw);
    });
    this.load.start();
  }

  private build(key: string, raw: RawMap): void {
    const map = this.make.tilemap({ key });
    this.mapSize = { w: map.widthInPixels, h: map.heightInPixels };
    const tilesets = map.tilesets.map(t => map.addTilesetImage(t.name, t.name)).filter(t => t !== null);
    const solid = map.layers.map(l => {
      const layer = map.createLayer(l.name, tilesets) as Phaser.Tilemaps.TilemapLayer;
      return layer.setDepth(prop(l.properties, 'above') === true ? 10 : 0).setCollisionByProperty({ collides: true });
    });

    // O Phaser 4.2.1 descarta o campo `class` dos objetos; lê-se o JSON cru (cache: { format, data }).
    const parsed = parseAreas(areaObjects(raw.layers));
    parsed.warnings.forEach(w => console.warn(w));
    this.areas = parsed.areas;

    this.player = this.makePlayer(map);
    solid.forEach(l => this.physics.add.collider(this.player, l));
    for (const a of this.areas) if (a.kind === 'npc') this.addNpc(a);

    this.physics.world.setBounds(0, 0, map.widthInPixels, map.heightInPixels);
    this.cameras.main.setZoom(ZOOM).startFollow(this.player, true).fadeIn(200);
    const fit = () => this.fitCamera(map);
    fit();
    this.scale.on(Phaser.Scale.Events.RESIZE, fit);

    this.keys = this.input.keyboard!.addKeys({
      up: 'UP', down: 'DOWN', left: 'LEFT', right: 'RIGHT', w: 'W', a: 'A', s: 'S', d: 'D',
      run: 'SHIFT', e: 'E', z: 'Z', say: 'ENTER', esc: 'ESC', mute: 'M', edit: 'C',
    }) as Keys;

    // Quem nasce dentro de uma área (ex.: perto da porta) não dispara o "entrou" dela.
    this.inside = new Set(this.areas.filter(a => contains(a.rect, this.player.x, this.player.y + FEET)));

    const missing = [...new Set(this.areas.flatMap(a => (a.kind === 'sound' && !this.cache.audio.exists(a.src) ? [a.src] : [])))];
    if (missing.length) {
      missing.forEach(src => this.load.audio(src, src));
      this.load.start();
    }

    const title = String(prop(map.properties, 'name') ?? '').trim();
    if (!title) console.warn(`[areas] mapa "${this.here.map}" sem propriedade "name"`);
    ui.showBanner(title || this.here.map);
    const minimap = String(prop(map.properties, 'minimap') ?? '');
    ui.showMinimap(minimap || null, title || this.here.map);
    this.ready = true;
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.scale.off(Phaser.Scale.Events.RESIZE, fit);
      this.sound.removeAll();
      ui.showDialog(null);
      ui.showPrompt(null);
      ui.closePanel();
      ui.showMinimap(null, '');
    });
  }

  update(time: number): void {
    if (this.leaving || this.busy || !this.ready) return;
    const k = this.keys, down = Phaser.Input.Keyboard.JustDown;
    const act = down(k.e) || down(k.z);
    if (down(k.mute)) this.sound.mute = !this.sound.mute;
    if (down(k.esc)) {
      this.dialog = null;
      ui.showDialog(null);
      ui.closePanel();
    }

    if (this.dialog) {
      this.player.setVelocity(0, 0);
      this.dialog = act ? press(this.dialog) : reveal(this.dialog, 1);
      ui.showDialog(this.dialog);
      this.animate(false);
      return this.overlays(time);
    }
    if (down(k.edit)) return this.editCharacter();
    if (down(k.say)) return this.say();

    const vx = Number(k.right.isDown || k.d.isDown) - Number(k.left.isDown || k.a.isDown);
    const vy = Number(k.down.isDown || k.s.isDown) - Number(k.up.isDown || k.w.isDown);
    const speed = (k.run.isDown ? RUN : SPEED) * (vx && vy ? Math.SQRT1_2 : 1);
    this.player.setVelocity(vx * speed, vy * speed);
    this.facing = dirFromVelocity(vx, vy, this.facing);
    this.animate(vx !== 0 || vy !== 0);

    const fx = this.player.x, fy = this.player.y + FEET;
    const now = new Set(this.areas.filter(a => contains(a.rect, fx, fy)));
    for (const a of now) if (!this.inside.has(a)) this.enter(a);
    this.inside = now;
    if (this.leaving) return;
    const pa = this.panelArea;
    if (pa && !(pa.trigger === 'enter' ? now.has(pa) : near(pa.rect, fx, fy, TALK_PAD))) {
      ui.closePanel();
      this.panelArea = null;
    }

    const target = this.areas.find(a => (a.kind === 'sign' || a.kind === 'npc' || (a.kind === 'website' && a.trigger === 'key')) && near(a.rect, fx, fy, TALK_PAD));
    ui.showPrompt(target ? this.toScreen(target.rect.x + target.rect.w / 2, target.rect.y - (target.kind === 'npc' ? 26 : 2)) : null);
    if (act && target) this.interact(target);
    this.syncSounds();
    this.overlays(time);
  }

  private makePlayer(map: Phaser.Tilemaps.Tilemap): Phaser.Physics.Arcade.Sprite {
    const img = this.registry.get('playerImage') as HTMLImageElement;
    const version = this.registry.get('playerVersion') as number, tex = `player-v${version}`, old = `player-v${version - 1}`;
    // cada edição de personagem gera uma textura nova (~2,4 MB); a anterior já não tem sprite usando
    if (this.textures.exists(old)) {
      for (const d of DIRS) for (const a of ['idle', 'walk']) this.anims.remove(`${old}-${a}-${d}`);
      this.textures.remove(old);
    }
    if (!this.textures.exists(tex)) this.textures.addSpriteSheet(tex, img, { frameWidth: 16, frameHeight: 32 });
    const cols = Math.floor(img.width / 16);
    for (const d of DIRS) {
      for (const a of ['idle', 'walk'] as const) {
        const key = `${tex}-${a}-${d}`;
        if (!this.anims.exists(key)) this.anims.create({ key, frames: this.anims.generateFrameNumbers(tex, { frames: limezuFrames(a, d, cols) }), frameRate: a === 'walk' ? 10 : 5, repeat: -1 });
      }
    }
    if (!this.here.pos && !this.areas.some(a => a.kind === 'entry' && a.name === this.here.entry)) {
      console.warn(`[world] mapa "${this.here.map}" sem entry "${this.here.entry}"; usando "default"`);
    }
    const spawn = this.here.pos ?? entryPoint(this.areas, this.here.entry) ?? { x: map.widthInPixels / 2, y: map.heightInPixels / 2 };
    const s = this.physics.add.sprite(spawn.x, spawn.y - FEET, tex, limezuFrames('idle', 'down', cols)[0]);
    (s.body as Phaser.Physics.Arcade.Body).setSize(10, 6).setOffset(3, 25);
    return s.setCollideWorldBounds(true);
  }

  private addNpc(a: Extract<Area, { kind: 'npc' }>): void {
    const tex = `npc:${a.sprite}`;
    if (!this.textures.exists(tex)) return console.warn(`[areas] npc "${a.name}" com sprite desconhecido "${a.sprite}"`);
    const anim = `${tex}-idle-down`;
    if (!this.anims.exists(anim)) this.anims.create({ key: anim, frames: this.anims.generateFrameNumbers(tex, { frames: pixelserialFrames('idle', 'down') }), frameRate: 4, repeat: -1 });
    const npc = this.physics.add.sprite(a.rect.x + a.rect.w / 2, a.rect.y + a.rect.h, tex).setOrigin(0.5, 1).setImmovable(true);
    // O corpo desce ~12 px além dos pés visuais, para o jogador parar abaixo do NPC sem cobri-lo por inteiro.
    (npc.body as Phaser.Physics.Arcade.Body).setSize(12, 20).setOffset(10, 22);
    // Profundidade pelos pés VISUAIS (topo do sprite + 22 + 8 = npc.y - 2), não pela base do corpo (body.bottom está desatualizado na criação).
    npc.setDepth(5 + (npc.y - 2) / 10000).play(anim);
    this.physics.add.collider(this.player, npc);
  }

  /** O Phaser gruda no canto um mapa menor que a tela; limites com pelo menos o tamanho da vista centralizam. */
  private fitCamera(map: Phaser.Tilemaps.Tilemap): void {
    const cam = this.cameras.main;
    const w = Math.max(map.widthInPixels, cam.width / ZOOM), h = Math.max(map.heightInPixels, cam.height / ZOOM);
    cam.setBounds((map.widthInPixels - w) / 2, (map.heightInPixels - h) / 2, w, h);
  }

  private animate(walking: boolean): void {
    this.player.anims.play(`${this.player.texture.key}-${walking ? 'walk' : 'idle'}-${this.facing}`, true);
    this.player.setDepth(5 + (this.player.body as Phaser.Physics.Arcade.Body).bottom / 10000);
  }

  private enter(a: Area): void {
    if (a.kind === 'door') this.go({ map: a.map, entry: a.entry });
    else if (a.kind === 'website' && a.trigger === 'enter') this.openSite(a);
  }

  private openSite(a: Extract<Area, { kind: 'website' }>): void {
    this.panelArea = a;
    ui.openPanel(a.url);
  }

  private interact(a: Area): void {
    if (a.kind === 'website') return this.openSite(a);
    if (a.kind !== 'sign' && a.kind !== 'npc') return;
    this.dialog = openDialog(a.kind === 'npc' ? a.label : '', a.pages);
    ui.showPrompt(null);
    ui.showDialog(this.dialog);
  }

  private go(next: { map: string; entry: string }): void {
    if (this.leaving) return; // duas portas no mesmo quadro (ex.: canto de setor) disparam uma vez só
    this.leaving = true;
    this.player.setVelocity(0, 0);
    this.cameras.main.fadeOut(200);
    this.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => {
      this.scene.restart({ ...next, prev: { map: this.here.map, entry: this.here.entry } } satisfies WorldData);
    });
  }

  private fail(msg: string): void {
    this.leaving = true;
    console.warn(`[world] ${msg}`);
    ui.showBanner(msg);
    const back = this.here.prev;
    if (back) this.time.delayedCall(1200, () => this.scene.restart(back satisfies WorldData));
  }

  private say(): void {
    this.pause();
    ui.openSay(text => { this.balloon = { text, until: this.time.now + 5000 }; }, () => this.resume());
  }

  private editCharacter(): void {
    this.pause();
    ui.openCreator(this.registry.get('parts') as Parts, this.registry.get('character') as Character, async next => {
      try {
        const img = await composeLayers(layerUrls(next.look));
        saveCharacter(next);
        this.registry.set({ character: next, playerImage: img, playerVersion: (this.registry.get('playerVersion') as number) + 1 });
        this.scene.restart({ map: this.here.map, entry: this.here.entry, pos: { x: this.player.x, y: this.player.y + FEET } } satisfies WorldData);
      } catch (err) {
        console.error(err);
        this.resume();
      }
    }, () => this.resume());
  }

  private pause(): void {
    this.busy = true;
    this.player.setVelocity(0, 0);
    this.animate(false);
    ui.showPrompt(null);
  }

  private resume(): void {
    this.busy = false;
    this.input.keyboard!.resetKeys();
  }

  private syncSounds(): void {
    for (const a of this.areas) {
      if (a.kind !== 'sound') continue;
      const playing = this.sounds.get(a), want = this.inside.has(a);
      if (want && !playing && this.cache.audio.exists(a.src)) {
        const snd = this.sound.add(a.src, { loop: true, volume: 0 });
        snd.play();
        this.tweens.add({ targets: snd, volume: a.volume, duration: 600 });
        this.sounds.set(a, snd);
      } else if (!want && playing) {
        this.sounds.delete(a);
        this.tweens.add({ targets: playing, volume: 0, duration: 600, onComplete: () => playing.destroy() });
      }
    }
  }

  private overlays(time: number): void {
    const head = this.toScreen(this.player.x, this.player.y - 18);
    ui.showTag((this.registry.get('character') as Character).name, head);
    ui.moveMinimapDot(this.player.x / this.mapSize.w, (this.player.y + FEET) / this.mapSize.h);
    ui.showBalloon(time < this.balloon.until ? this.balloon.text : null, { x: head.x, y: head.y - 26 });
  }

  private toScreen(x: number, y: number): Point {
    const cam = this.cameras.main;
    return { x: (x - cam.worldView.x) * cam.zoom, y: (y - cam.worldView.y) * cam.zoom };
  }
}
