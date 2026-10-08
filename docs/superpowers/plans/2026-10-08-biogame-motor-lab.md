# Biogame: Motor + Laboratório do CB (Plano 1 de 3) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Jogo rodando no navegador em que o jogador cria um personagem (camadas do LimeZu), nasce no laboratório de Biofísica do CB, anda com colisão, conversa com NPCs em caixas de diálogo estilo GBA, lê placas, abre um site no painel lateral, fala com balão, ouve o som ambiente e atravessa a porta para o corredor e de volta.

**Architecture:** Site estático (Vite + TypeScript + Phaser 4). Uma única cena `World` carrega qualquer mapa `.tmj` do Tiled; o comportamento vem das áreas da camada de objetos `areas` (convenção da spec). Interface em HTML/CSS por cima do canvas. Toda a lógica testável (áreas, personagem, animações, diálogo, gerador de mapas, PNG) fica em módulos puros sem Phaser, testados com `node --test`. Ferramentas em `tools/` geram os tiles próprios (PNG feito por código), copiam os assets comprados de `vendor/` para `public/` e montam os mapas iniciais a partir de desenhos ASCII.

**Tech Stack:** Node 26 (roda `.ts` direto), TypeScript 7.0.2, Vite 8.3.4, Phaser 4.2.1, Tiled (formato JSON `.tmj`), fonte Pixelify Sans (OFL).

**Spec:** `docs/superpowers/specs/2026-10-08-biogame-mapa-design.md` (com a referência visual `2026-10-08-biogame-referencia-visual.jpg`).

**Planos seguintes (fora deste):** Plano 2: campus gerado do OpenStreetMap em setores, estacionamentos com carros, árvores, minimapa, créditos OSM e Modern Exteriors. Plano 3: fachadas caprichadas dos prédios nomeados e identidade da UFRN (brasão, placas, letreiros).

## Global Constraints

- Dependência de runtime única: `phaser@4.2.1`. Dev: `typescript@7.0.2`, `vite@8.3.4`, `@types/node`. Nada mais.
- Testes com `node --test` (sem framework). Arquivos de teste ao lado do código: `*.test.ts`.
- Imports relativos sempre com extensão `.ts` (exigência do Node ao rodar TS direto); tipos com `import type`.
- Sintaxe TS só "apagável" (`erasableSyntaxOnly`): sem `enum`, `namespace` ou parameter properties.
- Tiles de **16×16**, câmera com **zoom 3×**, `pixelArt: true`.
- Arquivos derivados de assets comprados (LimeZu, PixelSerial) **nunca** vão para o git: `vendor/`, `public/tilesets/limezu-*`, `public/sprites/`.
- **Nenhum asset da Nintendo.** Só o estilo GBA da referência.
- Convenção do Tiled exatamente como na spec: camada de objetos `areas`; Classes `entry`, `door`, `sign`, `npc`, `website`, `sound`; todo mapa tem entry `default` e propriedade de mapa `name`.
- Erros de mapa viram `console.warn` com prefixo `[areas]` e o jogo continua.
- Controles: setas/WASD andar, Shift correr, **E ou Z** interagir/avançar, Enter balão (até **60** caracteres, some em **~5 s**), Esc fecha, M som, C editar personagem.
- Único estado salvo: o personagem, em `localStorage` na chave `biogame.character`.
- Painel de site sempre com link **"abrir em nova aba"**.
- Caminhos de assets no código são relativos (sem `/` inicial), porque o build usa `--base ./`.
- Commits terminam com `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

## Review Focus

1. **Personagem salvo corrompido ou desatualizado** (JSON quebrado, peça que saiu do manifesto, `localStorage` bloqueado em aba privada): o jogo abre o criador com o padrão em vez de travar. Fixado em Task 3 (`parseSaved`) e Task 3 (`saveCharacter`/`loadSavedRaw` com try/catch).
2. **Digitar no balão ou no nome do personagem** (W, A, S, D, E, Z, M, C dentro do campo) não move o jogador nem dispara atalhos. Fixado em Task 8 (`shieldKeys`) e conferido no navegador na Task 10.
3. **Erros de autoria de mapa** (propriedade faltando, Class desconhecida, `url` não-http como `javascript:`, mapa sem `default`): aviso no console e o resto do mapa funciona. Fixado em Task 5.
4. **Porta mal configurada ou entrada colada na porta**: nunca deixar o jogador "quicando" entre mapas; porta para mapa inexistente volta ao anterior; `entry` inexistente cai no `default`. Fixado em Task 5 (`entryPoint`), Task 6 (lint dos mapas) e Task 9 (`fail`, conjunto `inside` inicial).
5. **Apertar E/Z repetidamente no diálogo**: o primeiro aperto completa a página, o seguinte avança; nenhuma página é pulada sem aparecer inteira, e fechar o diálogo não o reabre no mesmo aperto. Fixado em Task 7.

---

## Estrutura de arquivos

```
package.json, tsconfig.json, index.html, .gitignore
src/
  main.ts            boot: manifestos, criador, cria o jogo (cena Boot + World)
  style.css          visual GBA da interface
  fonts/             Pixelify Sans + OFL.txt
  areas.ts           Tiled → áreas tipadas (puro)            + areas.test.ts
  character.ts       personagem: validar, ciclar peças, URLs (puro) + character.test.ts
  anims.ts           índices de quadros LimeZu/PixelSerial (puro) + anims.test.ts
  dialog.ts          máquina de estados do diálogo (puro)     + dialog.test.ts
  compose.ts         empilha camadas PNG numa imagem (DOM)
  ui.ts              diálogo, banner, prompt, tag, balão, painel, criador, créditos (DOM)
  world.ts           cena Phaser: mapa, colisão, jogador, NPCs, áreas, som
tools/
  png.ts             codificador PNG (node:zlib)              + png.test.ts
  pix.ts             "tela" de pixels para desenhar tiles
  lab-tiles.ts       índices do tileset ufrn-lab
  tilegen.ts         gera public/tilesets/ufrn-lab.png e public/audio/lab-hum.wav
  vendor.ts          copia assets comprados para public/ + manifestos + vendor.test.ts
  maps.ts            gera public/maps/*.tmj a partir de ASCII  + maps.test.ts
public/
  tilesets/ufrn-lab.png       (gerado, versionado)
  audio/lab-hum.wav           (gerado, versionado)
  maps/cb-lab.tmj, cb-corredor.tmj   (gerados, versionados; depois editáveis no Tiled)
  tilesets/limezu-*.png, sprites/    (copiados de vendor/, fora do git)
```

---

### Task 1: Esqueleto do projeto

**Files:**
- Create: `package.json`, `tsconfig.json`, `index.html`, `src/style.css`, `src/main.ts`, `src/fonts/PixelifySans.ttf`, `src/fonts/OFL.txt`
- Modify: `.gitignore`

**Interfaces:**
- Produces: scripts `npm run dev | build | test | vendor | tiles | maps`; elementos HTML com os ids usados por `ui.ts` (Task 8): `game`, `ui`, `banner`, `dialog`, `dialog-label`, `dialog-text`, `dialog-next`, `prompt`, `tag`, `balloon`, `say`, `say-input`, `panel`, `panel-open`, `panel-close`, `panel-frame`, `creator`, `creator-preview`, `creator-name`, `creator-play`, `creator-credits`, `credits`, `credits-close`; linhas do criador `.row[data-part=body|eyes|outfit|hair|acc]` com botões `data-dir="-1"`/`"1"` e um `<span>`.

- [ ] **Step 1: Iniciar o repositório e o package.json**

```bash
cd /home/paulorh/projects/biogame
git init
```

Criar `package.json`:

```json
{
  "name": "biogame",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc --noEmit && vite build --base ./",
    "test": "node --test \"src/**/*.test.ts\" \"tools/**/*.test.ts\"",
    "vendor": "node tools/vendor.ts",
    "tiles": "node tools/tilegen.ts",
    "maps": "node tools/maps.ts"
  }
}
```

```bash
npm install --save-exact phaser@4.2.1
npm install --save-exact -D typescript@7.0.2 vite@8.3.4 @types/node
```

- [ ] **Step 2: tsconfig.json**

```json
{
  "compilerOptions": {
    "target": "ES2023",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "lib": ["ES2023", "DOM", "DOM.Iterable"],
    "types": ["node"],
    "strict": true,
    "noEmit": true,
    "allowImportingTsExtensions": true,
    "verbatimModuleSyntax": true,
    "erasableSyntaxOnly": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "resolveJsonModule": true
  },
  "include": ["src", "tools"]
}
```

- [ ] **Step 3: .gitignore**

Substituir o conteúdo por:

```
# assets comprados: a licença proíbe redistribuir (gerados por npm run vendor)
vendor/
public/tilesets/limezu-*
public/sprites/
# ferramentas locais
.superpowers/
.playwright-mcp/
.omc/
node_modules/
dist/
```

- [ ] **Step 4: Fonte pixel (OFL)**

```bash
mkdir -p src/fonts
curl -fL -o src/fonts/PixelifySans.ttf "https://raw.githubusercontent.com/google/fonts/main/ofl/pixelifysans/PixelifySans%5Bwght%5D.ttf"
curl -fL -o src/fonts/OFL.txt "https://raw.githubusercontent.com/google/fonts/main/ofl/pixelifysans/OFL.txt"
```

- [ ] **Step 5: index.html**

```html
<!doctype html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Biogame · UFRN</title>
  <link rel="icon" href="data:,">
  <link rel="stylesheet" href="/src/style.css">
</head>
<body>
  <div id="game"></div>
  <div id="ui">
    <div id="banner" class="gba" hidden></div>
    <div id="dialog" class="gba" hidden>
      <div id="dialog-label"></div>
      <div id="dialog-text"></div>
      <span id="dialog-next">▼</span>
    </div>
    <div id="prompt" hidden>Z</div>
    <div id="tag" hidden></div>
    <div id="balloon" hidden></div>
    <form id="say" hidden><input id="say-input" maxlength="60" placeholder="Fale algo e aperte Enter" autocomplete="off"></form>
    <aside id="panel" class="gba" hidden>
      <header>
        <a id="panel-open" target="_blank" rel="noopener">abrir em nova aba ↗</a>
        <button id="panel-close" type="button">Esc ✕</button>
      </header>
      <iframe id="panel-frame" title="Site" sandbox="allow-scripts allow-same-origin allow-forms allow-popups"></iframe>
    </aside>
    <section id="creator" class="gba" hidden>
      <h1>Biogame · UFRN</h1>
      <canvas id="creator-preview" width="16" height="32"></canvas>
      <label>Nome <input id="creator-name" maxlength="16" autocomplete="off"></label>
      <div class="row" data-part="body"><button type="button" data-dir="-1">◀</button><span></span><button type="button" data-dir="1">▶</button></div>
      <div class="row" data-part="eyes"><button type="button" data-dir="-1">◀</button><span></span><button type="button" data-dir="1">▶</button></div>
      <div class="row" data-part="outfit"><button type="button" data-dir="-1">◀</button><span></span><button type="button" data-dir="1">▶</button></div>
      <div class="row" data-part="hair"><button type="button" data-dir="-1">◀</button><span></span><button type="button" data-dir="1">▶</button></div>
      <div class="row" data-part="acc"><button type="button" data-dir="-1">◀</button><span></span><button type="button" data-dir="1">▶</button></div>
      <button id="creator-play" type="button">Jogar ▶</button>
      <button id="creator-credits" type="button">Créditos</button>
    </section>
    <section id="credits" class="gba" hidden>
      <h2>Créditos</h2>
      <ul>
        <li>Cenários e personagem: LimeZu (Modern Interiors, Modern Office) · limezu.itch.io</li>
        <li>NPCs: PixelSerial (RPG Top-Down Character Pack) · pixelserial.itch.io</li>
        <li>Fonte: Pixelify Sans (SIL Open Font License)</li>
        <li>Equipamentos de laboratório, sons e código: equipe Biogame</li>
      </ul>
      <button id="credits-close" type="button">Voltar</button>
    </section>
  </div>
  <script type="module" src="/src/main.ts"></script>
</body>
</html>
```

- [ ] **Step 6: src/style.css**

```css
@font-face { font-family: 'Pixelify'; src: url('./fonts/PixelifySans.ttf') format('truetype'); font-display: block; }
:root { --ink: #1d2235; --paper: #f8f8f0; --frame: #2f4f8f; --frame-in: #8fb0e8; --shadow: rgba(0, 0, 0, .35); }
* { box-sizing: border-box; }
html, body { margin: 0; height: 100%; overflow: hidden; background: #1d1f2b; }
#game { position: fixed; inset: 0; }
#ui { position: fixed; inset: 0; pointer-events: none; font-family: 'Pixelify', monospace; color: var(--ink); }
#ui .gba, #ui form, #ui button, #ui input, #ui a, #ui iframe { pointer-events: auto; }
[hidden] { display: none !important; }
.gba { background: var(--paper); border: 4px solid var(--frame); border-radius: 14px; box-shadow: inset 0 0 0 3px var(--frame-in), 0 4px 0 var(--shadow); }

#dialog { position: absolute; left: 50%; bottom: 20px; transform: translateX(-50%); width: min(760px, calc(100% - 32px)); min-height: 104px; padding: 20px 30px; font-size: 26px; line-height: 1.35; }
#dialog-label { position: absolute; top: -18px; left: 18px; padding: 2px 10px; font-size: 18px; background: var(--frame); color: #fff; border-radius: 8px; }
#dialog-label:empty { display: none; }
#dialog-next { position: absolute; right: 18px; bottom: 10px; animation: bob .8s steps(2) infinite; }
@keyframes bob { 50% { transform: translateY(-4px); } }

#banner { position: absolute; top: 16px; left: 16px; padding: 8px 18px; font-size: 22px; animation: slide 3s ease forwards; }
@keyframes slide { 0% { transform: translateY(-140%); } 10%, 85% { transform: none; } 100% { transform: translateY(-140%); } }

#prompt, #tag, #balloon { position: absolute; transform: translate(-50%, -100%); white-space: nowrap; }
#prompt { font-size: 18px; padding: 2px 8px; background: #fff; border: 3px solid var(--frame); border-radius: 6px; animation: bob .8s steps(2) infinite; }
#tag { font-size: 16px; padding: 1px 8px; color: #fff; background: rgba(20, 24, 40, .75); border-radius: 8px; }
#balloon { font-size: 18px; padding: 6px 12px; background: #fff; border: 3px solid var(--ink); border-radius: 12px; }

#say { position: absolute; left: 50%; bottom: 20px; transform: translateX(-50%); }
#say input { font: inherit; font-size: 22px; width: min(560px, 90vw); padding: 10px 14px; border: 4px solid var(--frame); border-radius: 12px; }

#panel { position: absolute; top: 16px; right: 16px; bottom: 16px; width: min(560px, 45vw); display: flex; flex-direction: column; overflow: hidden; }
#panel header { display: flex; justify-content: space-between; align-items: center; padding: 8px 14px; font-size: 18px; background: var(--frame); color: #fff; }
#panel header a { color: #ffe680; }
#panel iframe { flex: 1; border: 0; background: #fff; }
#ui button { font: inherit; cursor: pointer; }

#creator, #credits { position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); padding: 24px 32px; font-size: 22px; width: min(520px, calc(100% - 32px)); }
#creator h1 { margin: 0 0 12px; font-size: 30px; text-align: center; }
#creator-preview { display: block; margin: 0 auto 12px; width: 96px; height: 192px; image-rendering: pixelated; background: #dfe8f5; border-radius: 10px; }
#creator label { display: flex; justify-content: space-between; align-items: center; gap: 12px; margin-bottom: 8px; }
#creator input { font: inherit; width: 220px; padding: 4px 8px; border: 3px solid var(--frame); border-radius: 8px; }
#creator .row { display: flex; align-items: center; justify-content: space-between; margin: 6px 0; }
#creator .row button { width: 48px; font-size: 20px; padding: 2px; background: var(--paper); border: 3px solid var(--frame); border-radius: 8px; }
#creator-play { display: block; width: 100%; margin-top: 14px; padding: 10px; font-size: 24px; color: #fff; background: #3fae5a; border: 4px solid #2a7a3e; border-radius: 12px; }
#creator-credits, #credits-close { margin-top: 8px; width: 100%; background: none; border: 0; text-decoration: underline; font-size: 18px; color: var(--ink); }
#credits ul { padding-left: 20px; font-size: 18px; line-height: 1.5; }
.fatal { position: fixed; left: 16px; right: 16px; bottom: 16px; padding: 12px; color: #fff; background: #b8322f; font: 16px monospace; }
```

- [ ] **Step 7: src/main.ts mínimo (só prova que o Phaser sobe)**

```ts
import Phaser from 'phaser';

new Phaser.Game({ type: Phaser.WEBGL, parent: 'game', pixelArt: true, backgroundColor: '#1d1f2b', scale: { mode: Phaser.Scale.RESIZE } });
```

- [ ] **Step 8: Verificar build e dev**

Run: `npm run build`
Expected: termina sem erros de tipo e cria `dist/`.

Se o `tsc` reclamar do `import Phaser from 'phaser'` (módulo `export =`), trocar por `import * as Phaser from 'phaser'` neste e nos próximos arquivos; o build ESM do Phaser 4.2.1 exporta os namespaces nomeados e o default.

Run: `npm run dev` (em segundo plano) e abrir `http://localhost:5173`.
Expected: tela azul-escura (#1d1f2b) ocupando a janela, console sem erros.

- [ ] **Step 9: Commit**

```bash
git add package.json package-lock.json tsconfig.json index.html .gitignore src docs
git commit -m "chore: esqueleto Vite + TypeScript + Phaser 4 e spec do Biogame

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 2: PNG por código e tileset do laboratório

**Files:**
- Create: `tools/png.ts`, `tools/png.test.ts`, `tools/pix.ts`, `tools/lab-tiles.ts`, `tools/tilegen.ts`
- Generates (versionados): `public/tilesets/ufrn-lab.png`, `public/audio/lab-hum.wav`

**Interfaces:**
- Produces: `encodePng(width: number, height: number, rgba: Uint8Array): Buffer`; `class Pix { w; h; data; px(x, y, hex); rect(x, y, w, h, hex); alpha(x, y): number; outline(x0, y0, w, h, hex); png(): Buffer }`; `LAB` (índices nomeados), `LAB_COLS = 8`, `LAB_ROWS = 4`, `LAB_SOLID: number[]` em `tools/lab-tiles.ts`.

- [ ] **Step 1: Teste do codificador PNG**

`tools/png.test.ts`:

```ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { inflateSync } from 'node:zlib';
import { encodePng } from './png.ts';

test('writes signature, IHDR with size and RGBA, and a valid IEND', () => {
  const png = encodePng(2, 1, new Uint8Array([255, 0, 0, 255, 0, 0, 255, 128]));
  assert.deepEqual([...png.subarray(0, 8)], [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  assert.equal(png.toString('ascii', 12, 16), 'IHDR');
  assert.equal(png.readUInt32BE(16), 2);
  assert.equal(png.readUInt32BE(20), 1);
  assert.equal(png[24], 8);
  assert.equal(png[25], 6);
  assert.equal(png.toString('ascii', png.length - 8, png.length - 4), 'IEND');
  assert.equal(png.readUInt32BE(png.length - 4), 0xae426082);
});

test('pixel rows survive deflate with filter byte 0', () => {
  const rgba = new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8]);
  const png = encodePng(1, 2, rgba);
  const len = png.readUInt32BE(33);
  assert.equal(png.toString('ascii', 37, 41), 'IDAT');
  assert.deepEqual([...inflateSync(png.subarray(41, 41 + len))], [0, 1, 2, 3, 4, 0, 5, 6, 7, 8]);
});

test('rejects a buffer of the wrong size', () => {
  assert.throws(() => encodePng(2, 2, new Uint8Array(4)), /esperava 16 bytes/);
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `node --test tools/png.test.ts`
Expected: FAIL, `Cannot find module` para `./png.ts`.

- [ ] **Step 3: Implementar `tools/png.ts`**

```ts
import { crc32, deflateSync } from 'node:zlib';

function chunk(type: string, data: Buffer): Buffer {
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}

/** Codifica pixels RGBA de 8 bits em PNG (filtro 0 em todas as linhas). */
export function encodePng(width: number, height: number, rgba: Uint8Array): Buffer {
  if (rgba.length !== width * height * 4) throw new Error(`esperava ${width * height * 4} bytes, veio ${rgba.length}`);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  const stride = width * 4;
  const raw = Buffer.alloc((stride + 1) * height);
  for (let y = 0; y < height; y++) raw.set(rgba.subarray(y * stride, (y + 1) * stride), y * (stride + 1) + 1);
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw)),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}
```

- [ ] **Step 4: Rodar e ver passar**

Run: `node --test tools/png.test.ts`
Expected: PASS (3 testes).

- [ ] **Step 5: `tools/pix.ts`**

```ts
import { encodePng } from './png.ts';

const parse = (hex: string): number[] => {
  const h = hex.replace('#', '');
  const n = (i: number) => parseInt(h.slice(i, i + 2), 16);
  return [n(0), n(2), n(4), h.length === 8 ? n(6) : 255];
};

/** Tela de pixels RGBA para desenhar tiles por código. */
export class Pix {
  readonly w: number;
  readonly h: number;
  readonly data: Uint8Array;

  constructor(w: number, h: number) {
    this.w = w;
    this.h = h;
    this.data = new Uint8Array(w * h * 4);
  }

  px(x: number, y: number, hex: string): void {
    if (x < 0 || y < 0 || x >= this.w || y >= this.h) return;
    this.data.set(parse(hex), (y * this.w + x) * 4);
  }

  rect(x: number, y: number, w: number, h: number, hex: string): void {
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) this.px(x + i, y + j, hex);
  }

  alpha(x: number, y: number): number {
    return x < 0 || y < 0 || x >= this.w || y >= this.h ? 0 : this.data[(y * this.w + x) * 4 + 3];
  }

  /** Contorno de 1px em volta do que já está desenhado dentro da região (estilo GBA). */
  outline(x0: number, y0: number, w: number, h: number, hex: string): void {
    const filled = (x: number, y: number) => x >= x0 && y >= y0 && x < x0 + w && y < y0 + h && this.alpha(x, y) > 0;
    const edge: [number, number][] = [];
    for (let y = y0; y < y0 + h; y++) for (let x = x0; x < x0 + w; x++)
      if (!filled(x, y) && (filled(x - 1, y) || filled(x + 1, y) || filled(x, y - 1) || filled(x, y + 1))) edge.push([x, y]);
    for (const [x, y] of edge) this.px(x, y, hex);
  }

  png(): Buffer {
    return encodePng(this.w, this.h, this.data);
  }
}
```

- [ ] **Step 6: `tools/lab-tiles.ts`**

```ts
/** Índices dos tiles de public/tilesets/ufrn-lab.png (8 colunas × 4 linhas de 16×16). */
export const LAB = {
  void: 0, cap: 1, mat: 2, benchTopL: 3, benchTopM: 4, benchTopR: 5, benchFrontL: 6, benchFrontM: 7,
  benchFrontR: 8, microscope: 9, flaskRed: 10, flaskGreen: 11, flaskBlue: 12, beaker: 13, tubeRack: 14, computer: 15,
  lockerTop: 16, windowTop: 17, lockerBottom: 24, windowBottom: 25,
} as const;

export const LAB_COLS = 8;
export const LAB_ROWS = 4;

/** Tiles que bloqueiam passagem (viram `collides: true` no tileset). */
export const LAB_SOLID: number[] = [
  LAB.void, LAB.cap, LAB.benchTopL, LAB.benchTopM, LAB.benchTopR,
  LAB.benchFrontL, LAB.benchFrontM, LAB.benchFrontR, LAB.lockerTop, LAB.lockerBottom,
];
```

- [ ] **Step 7: `tools/tilegen.ts`**

```ts
import { mkdirSync, writeFileSync } from 'node:fs';
import { Pix } from './pix.ts';
import { LAB, LAB_COLS, LAB_ROWS } from './lab-tiles.ts';

const OUTLINE = '#1f2129';
const at = (id: number): [number, number] => [(id % LAB_COLS) * 16, Math.floor(id / LAB_COLS) * 16];

function bench(p: Pix, id: number, front: boolean, left: boolean, right: boolean): void {
  const [x, y] = at(id);
  if (front) {
    p.rect(x, y, 16, 12, '#3d6fb6');
    p.rect(x, y, 16, 1, '#2a4f8a');
    p.rect(x, y + 1, 16, 1, '#5a8bd0');
    p.rect(x + 7, y + 2, 2, 10, '#2a4f8a');
    p.rect(x + 4, y + 6, 2, 1, '#e8edf5');
    p.rect(x + 10, y + 6, 2, 1, '#e8edf5');
    p.rect(x, y + 12, 16, 2, '#2a3550');
    p.rect(x, y + 14, 16, 2, '#00000040');
  } else {
    p.rect(x, y, 16, 1, '#3a3f4f');
    p.rect(x, y + 1, 16, 1, '#ffffff');
    p.rect(x, y + 2, 16, 11, '#eef1f5');
    p.rect(x, y + 13, 16, 3, '#c9d0da');
    for (let i = 1; i < 16; i += 5) p.px(x + i, y + 5 + (i % 3), '#e0e5ec');
  }
  const edge = front ? '#22304a' : '#3a3f4f', h = front ? 14 : 16;
  if (left) p.rect(x, y, 1, h, edge);
  if (right) p.rect(x + 15, y, 1, h, edge);
}

function flask(p: Pix, id: number, liquid: string, light: string): void {
  const [x, y] = at(id);
  p.rect(x + 6, y + 2, 4, 1, '#b9c9d2');
  p.rect(x + 7, y + 3, 2, 4, '#d9f1fb');
  for (let j = 0; j < 7; j++) {
    const half = 1 + Math.floor(j / 2);
    p.rect(x + 7 - half, y + 7 + j, (half + 1) * 2, 1, j >= 3 ? liquid : '#d9f1fb');
  }
  p.px(x + 6, y + 9, '#ffffff');
  p.px(x + 7, y + 11, light);
  p.outline(x, y, 16, 16, OUTLINE);
}

function drawLab(p: Pix): void {
  let [x, y] = at(LAB.void);
  p.rect(x, y, 16, 16, '#1e1f29');

  [x, y] = at(LAB.cap);
  p.rect(x, y, 16, 16, '#4b4d5c');
  for (let j = 0; j < 16; j++) for (let i = 0; i < 16; i++) if ((i + j * 3) % 7 === 0) p.px(x + i, y + j, '#444655');
  p.rect(x, y, 16, 1, '#5d6070');

  [x, y] = at(LAB.mat);
  p.rect(x + 1, y + 3, 14, 11, '#7a1f1d');
  p.rect(x + 2, y + 4, 12, 9, '#b8322f');
  for (let i = 3; i < 13; i += 3) p.rect(x + i, y + 5, 1, 7, '#d2524a');

  bench(p, LAB.benchTopL, false, true, false);
  bench(p, LAB.benchTopM, false, false, false);
  bench(p, LAB.benchTopR, false, false, true);
  bench(p, LAB.benchFrontL, true, true, false);
  bench(p, LAB.benchFrontM, true, false, false);
  bench(p, LAB.benchFrontR, true, false, true);

  [x, y] = at(LAB.microscope);
  p.rect(x + 3, y + 12, 10, 2, '#2b2e38');
  p.rect(x + 4, y + 12, 8, 1, '#4a4f5c');
  p.rect(x + 9, y + 4, 2, 8, '#e9edf2');
  p.rect(x + 10, y + 4, 1, 8, '#b7bec8');
  p.rect(x + 4, y + 9, 6, 1, '#3a3e48');
  p.rect(x + 5, y + 3, 3, 6, '#3d4250');
  p.rect(x + 5, y + 3, 1, 6, '#5a606c');
  p.rect(x + 4, y + 1, 5, 2, '#2a2e36');
  p.px(x + 5, y + 1, '#6a707c');
  p.px(x + 11, y + 8, '#3a3e48');
  p.outline(x, y, 16, 16, OUTLINE);

  flask(p, LAB.flaskRed, '#e35d5d', '#ffb3b3');
  flask(p, LAB.flaskGreen, '#5fbf5a', '#bff0b8');
  flask(p, LAB.flaskBlue, '#4f8fe0', '#b8d6ff');

  [x, y] = at(LAB.beaker);
  p.rect(x + 5, y + 5, 6, 9, '#d9f1fb');
  p.rect(x + 5, y + 10, 6, 4, '#7fc6ef');
  p.px(x + 4, y + 5, '#d9f1fb');
  p.rect(x + 6, y + 6, 1, 6, '#ffffff');
  p.outline(x, y, 16, 16, OUTLINE);

  [x, y] = at(LAB.tubeRack);
  ['#e35d5d', '#f2c14e', '#7bc96f', '#a678de'].forEach((c, i) => {
    p.rect(x + 3 + i * 3, y + 4, 2, 7, '#d9f1fb');
    p.rect(x + 3 + i * 3, y + 8, 2, 3, c);
  });
  p.rect(x + 2, y + 10, 12, 3, '#c9ced6');
  p.rect(x + 2, y + 10, 12, 1, '#e7ebf0');
  p.outline(x, y, 16, 16, OUTLINE);

  [x, y] = at(LAB.computer);
  p.rect(x + 2, y + 1, 12, 9, '#d9d2bf');
  p.rect(x + 2, y + 1, 12, 1, '#eee8d8');
  p.rect(x + 13, y + 1, 1, 9, '#b8b09a');
  p.rect(x + 4, y + 3, 8, 5, '#2e3b52');
  p.rect(x + 5, y + 4, 3, 1, '#5b7fa8');
  p.rect(x + 5, y + 5, 5, 1, '#3f5577');
  p.rect(x + 6, y + 10, 4, 1, '#b8b09a');
  p.rect(x + 3, y + 11, 10, 3, '#c9c1ab');
  for (let i = 4; i < 12; i += 2) p.px(x + i, y + 12, '#a39b85');
  p.outline(x, y, 16, 16, OUTLINE);

  [x, y] = at(LAB.lockerTop);
  p.rect(x + 1, y + 1, 14, 15, '#9aa1ad');
  p.rect(x + 1, y + 1, 14, 1, '#c3c8d1');
  p.rect(x + 8, y + 1, 1, 15, '#7d8492');
  for (const r of [4, 6, 8]) { p.rect(x + 3, y + r, 3, 1, '#7d8492'); p.rect(x + 10, y + r, 3, 1, '#7d8492'); }
  p.outline(x, y, 16, 16, OUTLINE);

  [x, y] = at(LAB.lockerBottom);
  p.rect(x + 1, y, 14, 14, '#9aa1ad');
  p.rect(x + 8, y, 1, 14, '#7d8492');
  p.rect(x + 6, y + 3, 1, 2, '#e8edf5');
  p.rect(x + 9, y + 3, 1, 2, '#e8edf5');
  p.rect(x + 1, y + 13, 14, 1, '#7d8492');
  p.outline(x, y, 16, 16, OUTLINE);
  p.rect(x + 1, y + 15, 14, 1, '#00000040');

  [x, y] = at(LAB.windowTop);
  p.rect(x + 1, y + 2, 14, 14, '#3c3f4c');
  for (let j = 0; j < 13; j++) p.rect(x + 2, y + 3 + j, 12, 1, j < 6 ? '#a9dcf5' : '#8fd0f0');
  p.rect(x + 3, y + 4, 3, 1, '#ffffff');
  p.rect(x + 4, y + 5, 4, 1, '#e6f6fd');

  [x, y] = at(LAB.windowBottom);
  p.rect(x + 1, y, 14, 12, '#3c3f4c');
  p.rect(x + 2, y, 12, 11, '#8fd0f0');
  for (const [cx, cy, r] of [[4, 6, 4], [9, 4, 4], [13, 7, 3], [7, 9, 3]]) {
    for (let j = -r; j <= r; j++) for (let i = -r; i <= r; i++) {
      const X = cx + i, Y = cy + j;
      if (i * i + j * j <= r * r && X >= 2 && X <= 13 && Y >= 0 && Y <= 10) p.px(x + X, y + Y, i + j < -1 ? '#6cbf4f' : '#3f8f3f');
    }
  }
  p.rect(x + 10, y + 5, 2, 2, '#7a5a3a');
  p.px(x + 12, y + 6, '#7a5a3a');
  p.px(x + 12, y + 7, '#7a5a3a');
  p.rect(x, y + 11, 16, 2, '#d8d2c4');
  p.rect(x, y + 13, 16, 1, '#a8a294');
}

/** Zumbido de laboratório: 60 Hz + harmônico + ruído filtrado; 2 s que emendam em loop. */
function labHum(seconds = 2, rate = 22050): Buffer {
  const n = seconds * rate, wav = Buffer.alloc(44 + n * 2);
  wav.write('RIFF', 0);
  wav.writeUInt32LE(36 + n * 2, 4);
  wav.write('WAVEfmt ', 8);
  wav.writeUInt32LE(16, 16);
  wav.writeUInt16LE(1, 20);
  wav.writeUInt16LE(1, 22);
  wav.writeUInt32LE(rate, 24);
  wav.writeUInt32LE(rate * 2, 28);
  wav.writeUInt16LE(2, 32);
  wav.writeUInt16LE(16, 34);
  wav.write('data', 36);
  wav.writeUInt32LE(n * 2, 40);
  let seed = 1, lp = 0;
  for (let i = 0; i < n; i++) {
    const t = i / rate;
    seed = (Math.imul(seed, 1103515245) + 12345) & 0x7fffffff;
    lp += ((seed / 0x7fffffff) * 2 - 1 - lp) * 0.05;
    const v = 0.12 * Math.sin(2 * Math.PI * 60 * t) + 0.04 * Math.sin(2 * Math.PI * 120 * t) + 0.25 * lp;
    wav.writeInt16LE(Math.round(Math.max(-1, Math.min(1, v)) * 32767), 44 + i * 2);
  }
  return wav;
}

const sheet = new Pix(LAB_COLS * 16, LAB_ROWS * 16);
drawLab(sheet);
mkdirSync('public/tilesets', { recursive: true });
mkdirSync('public/audio', { recursive: true });
writeFileSync('public/tilesets/ufrn-lab.png', sheet.png());
writeFileSync('public/audio/lab-hum.wav', labHum());
console.log('ok: public/tilesets/ufrn-lab.png, public/audio/lab-hum.wav');
```

- [ ] **Step 8: Gerar e conferir visualmente**

Run: `npm run tiles`
Expected: `ok: public/tilesets/ufrn-lab.png, public/audio/lab-hum.wav`.

Abrir `public/tilesets/ufrn-lab.png` (ferramenta Read mostra a imagem) e conferir, linha 1: fundo escuro, bloco cinza (cap), tapete vermelho, três tampos brancos de bancada, dois frentes azuis; linha 2: frente azul direita, microscópio, frascos vermelho/verde/azul, béquer, estante de tubos, computador bege; linha 3: topo do armário cinza, topo da janela (céu); linha 4: base do armário, base da janela com árvores e o sagui. Objetos com contorno escuro de 1px.

Run: `node --test tools/png.test.ts`
Expected: PASS.

- [ ] **Step 9: Commit**

```bash
git add tools/png.ts tools/png.test.ts tools/pix.ts tools/lab-tiles.ts tools/tilegen.ts public/tilesets/ufrn-lab.png public/audio/lab-hum.wav
git commit -m "feat: gerador de tiles do laboratório e som ambiente por código

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 3: Personagem e animações (lógica pura)

**Files:**
- Create: `src/character.ts`, `src/character.test.ts`, `src/anims.ts`, `src/anims.test.ts`

**Interfaces:**
- Produces (`src/character.ts`): `type PartKind = 'body' | 'eyes' | 'outfit' | 'hair' | 'acc'`; `PART_KINDS: PartKind[]` (ordem de empilhamento); `PART_DIRS: Record<PartKind, string>`; `type Parts = Record<PartKind, string[]>`; `type Look = Record<PartKind, string>` (`acc: ''` = sem acessório); `type Character = { name: string; look: Look }`; `STORAGE_KEY = 'biogame.character'`; `NAME_MAX = 16`; `cleanName(raw: string): string`; `defaultCharacter(parts: Parts): Character`; `parseSaved(raw: string | null, parts: Parts): Character | null`; `cycle(parts: Parts, kind: PartKind, current: string, dir: 1 | -1): string`; `layerUrls(look: Look): string[]`; `saveCharacter(c: Character): void`; `loadSavedRaw(): string | null`.
- Produces (`src/anims.ts`): `type Dir = 'right' | 'up' | 'left' | 'down'`; `limezuFrames(anim: 'idle' | 'walk', dir: Dir, cols: number): number[]`; `pixelserialFrames(anim: 'idle' | 'walk', dir: Dir): number[]`; `dirFromVelocity(vx: number, vy: number, prev: Dir): Dir`.

- [ ] **Step 1: Testes do personagem**

`src/character.test.ts`:

```ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cleanName, cycle, defaultCharacter, layerUrls, parseSaved, type Parts } from './character.ts';

const parts: Parts = {
  body: ['Body_01.png', 'Body_02.png'],
  eyes: ['Eyes_01.png'],
  outfit: ['Outfit_01_01.png', 'Outfit_02_01.png'],
  hair: ['Hairstyle_01_01.png'],
  acc: ['Accessory_01_Ladybug_01.png'],
};
const valid = { name: 'Ana', look: { body: 'Body_02.png', eyes: 'Eyes_01.png', outfit: 'Outfit_02_01.png', hair: 'Hairstyle_01_01.png', acc: '' } };

test('parseSaved accepts a valid save', () => {
  assert.deepEqual(parseSaved(JSON.stringify(valid), parts), valid);
});

test('parseSaved returns null for missing, broken or foreign data', () => {
  for (const raw of [null, '', '{', '42', '"oi"', 'null', JSON.stringify({ name: 'x' }), JSON.stringify({ name: 1, look: valid.look })]) {
    assert.equal(parseSaved(raw, parts), null, String(raw));
  }
});

test('parseSaved returns null when a part is no longer in the manifest', () => {
  const stale = { ...valid, look: { ...valid.look, hair: 'Hairstyle_99_01.png' } };
  assert.equal(parseSaved(JSON.stringify(stale), parts), null);
});

test('parseSaved cleans the name', () => {
  assert.equal(parseSaved(JSON.stringify({ ...valid, name: '   Maria   da   Silva Pereira Souza  ' }), parts)?.name, 'Maria da Silva P');
  assert.equal(parseSaved(JSON.stringify({ ...valid, name: '   ' }), parts)?.name, 'Calouro');
});

test('cycle wraps both ways and the accessory list starts with "none"', () => {
  assert.equal(cycle(parts, 'body', 'Body_02.png', 1), 'Body_01.png');
  assert.equal(cycle(parts, 'body', 'Body_01.png', -1), 'Body_02.png');
  assert.equal(cycle(parts, 'acc', '', 1), 'Accessory_01_Ladybug_01.png');
  assert.equal(cycle(parts, 'acc', 'Accessory_01_Ladybug_01.png', 1), '');
});

test('layerUrls stacks body → eyes → outfit → hair → acc and skips "no accessory"', () => {
  assert.deepEqual(layerUrls(valid.look), [
    'sprites/character/bodies/Body_02.png',
    'sprites/character/eyes/Eyes_01.png',
    'sprites/character/outfits/Outfit_02_01.png',
    'sprites/character/hairstyles/Hairstyle_01_01.png',
  ]);
  assert.equal(layerUrls({ ...valid.look, acc: 'Accessory_01_Ladybug_01.png' }).at(-1), 'sprites/character/accessories/Accessory_01_Ladybug_01.png');
});

test('defaultCharacter picks the first of each part and no accessory', () => {
  assert.deepEqual(defaultCharacter(parts), {
    name: 'Calouro',
    look: { body: 'Body_01.png', eyes: 'Eyes_01.png', outfit: 'Outfit_01_01.png', hair: 'Hairstyle_01_01.png', acc: '' },
  });
});

test('cleanName collapses spaces, trims and caps at 16', () => {
  assert.equal(cleanName('  a   b  '), 'a b');
  assert.equal(cleanName('x'.repeat(30)).length, 16);
});
```

- [ ] **Step 2: Testes das animações**

`src/anims.test.ts`:

```ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { dirFromVelocity, limezuFrames, pixelserialFrames } from './anims.ts';

test('LimeZu: row 1 idle, row 2 walk, 6 frames per direction in order right, up, left, down', () => {
  assert.deepEqual(limezuFrames('idle', 'right', 56), [56, 57, 58, 59, 60, 61]);
  assert.deepEqual(limezuFrames('walk', 'down', 56), [130, 131, 132, 133, 134, 135]);
  assert.deepEqual(limezuFrames('walk', 'up', 57), [120, 121, 122, 123, 124, 125]);
});

test('PixelSerial: rows 0-3 idle, 4-7 walk, order down, left, right, up, 4 frames', () => {
  assert.deepEqual(pixelserialFrames('idle', 'down'), [0, 1, 2, 3]);
  assert.deepEqual(pixelserialFrames('walk', 'up'), [28, 29, 30, 31]);
  assert.deepEqual(pixelserialFrames('walk', 'left'), [20, 21, 22, 23]);
});

test('dirFromVelocity keeps the previous direction when stopped and prefers the larger axis', () => {
  assert.equal(dirFromVelocity(0, 0, 'left'), 'left');
  assert.equal(dirFromVelocity(1, 0, 'up'), 'right');
  assert.equal(dirFromVelocity(-1, 0, 'up'), 'left');
  assert.equal(dirFromVelocity(0, 1, 'up'), 'down');
  assert.equal(dirFromVelocity(0.5, -1, 'down'), 'up');
});
```

- [ ] **Step 3: Rodar e ver falhar**

Run: `node --test src/character.test.ts src/anims.test.ts`
Expected: FAIL, módulos `./character.ts` e `./anims.ts` não existem.

- [ ] **Step 4: Implementar `src/character.ts`**

```ts
export type PartKind = 'body' | 'eyes' | 'outfit' | 'hair' | 'acc';
/** Ordem de empilhamento das camadas (a do gerador do LimeZu). */
export const PART_KINDS: PartKind[] = ['body', 'eyes', 'outfit', 'hair', 'acc'];
/** Pasta de cada peça em public/sprites/character/. */
export const PART_DIRS: Record<PartKind, string> = { body: 'bodies', eyes: 'eyes', outfit: 'outfits', hair: 'hairstyles', acc: 'accessories' };

export type Parts = Record<PartKind, string[]>;
/** Nome do arquivo de cada peça; `acc: ''` = sem acessório. */
export type Look = Record<PartKind, string>;
export type Character = { name: string; look: Look };

export const STORAGE_KEY = 'biogame.character';
export const NAME_MAX = 16;

export function cleanName(raw: string): string {
  return raw.replace(/\s+/g, ' ').trim().slice(0, NAME_MAX) || 'Calouro';
}

export function defaultCharacter(parts: Parts): Character {
  return { name: 'Calouro', look: { body: parts.body[0], eyes: parts.eyes[0], outfit: parts.outfit[0], hair: parts.hair[0], acc: '' } };
}

/** Lê o que veio do localStorage; null se ausente, corrompido ou com peça que não existe mais. */
export function parseSaved(raw: string | null, parts: Parts): Character | null {
  if (!raw) return null;
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    return null;
  }
  if (typeof data !== 'object' || data === null) return null;
  const { name, look } = data as { name?: unknown; look?: unknown };
  if (typeof name !== 'string' || typeof look !== 'object' || look === null) return null;
  const out = {} as Look;
  for (const k of PART_KINDS) {
    const v = (look as Record<string, unknown>)[k];
    if (typeof v !== 'string') return null;
    if (!(k === 'acc' && v === '') && !parts[k].includes(v)) return null;
    out[k] = v;
  }
  return { name: cleanName(name), look: out };
}

/** Próxima opção da peça, com volta. Acessório começa por '' (nenhum). */
export function cycle(parts: Parts, kind: PartKind, current: string, dir: 1 | -1): string {
  const list = kind === 'acc' ? ['', ...parts.acc] : parts[kind];
  const i = Math.max(0, list.indexOf(current));
  return list[(i + dir + list.length) % list.length];
}

export function layerUrls(look: Look): string[] {
  return PART_KINDS.filter(k => look[k]).map(k => `sprites/character/${PART_DIRS[k]}/${look[k]}`);
}

export function saveCharacter(c: Character): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(c));
  } catch {
    // ponytail: sem storage (aba privada/bloqueado) o jogo segue sem salvar; não há onde avisar melhor na v1
  }
}

export function loadSavedRaw(): string | null {
  try {
    return localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}
```

- [ ] **Step 5: Implementar `src/anims.ts`**

```ts
export type Dir = 'right' | 'up' | 'left' | 'down';

const LIMEZU_ORDER: Dir[] = ['right', 'up', 'left', 'down'];
const PIXELSERIAL_ORDER: Dir[] = ['down', 'left', 'right', 'up'];

/** LimeZu (quadro 16×32): linha 1 = idle, linha 2 = walk, 6 quadros por direção. `cols` = largura da folha / 16. */
export function limezuFrames(anim: 'idle' | 'walk', dir: Dir, cols: number): number[] {
  const start = (anim === 'idle' ? 1 : 2) * cols + LIMEZU_ORDER.indexOf(dir) * 6;
  return [0, 1, 2, 3, 4, 5].map(i => start + i);
}

/** PixelSerial (quadro 32×32, 4 colunas): linhas 0-3 idle, 4-7 walk, 4 quadros. */
export function pixelserialFrames(anim: 'idle' | 'walk', dir: Dir): number[] {
  const row = (anim === 'idle' ? 0 : 4) + PIXELSERIAL_ORDER.indexOf(dir);
  return [0, 1, 2, 3].map(i => row * 4 + i);
}

export function dirFromVelocity(vx: number, vy: number, prev: Dir): Dir {
  if (vx === 0 && vy === 0) return prev;
  if (Math.abs(vx) > Math.abs(vy)) return vx > 0 ? 'right' : 'left';
  return vy > 0 ? 'down' : 'up';
}
```

- [ ] **Step 6: Rodar e ver passar**

Run: `node --test src/character.test.ts src/anims.test.ts`
Expected: PASS (todos).

- [ ] **Step 7: Commit**

```bash
git add src/character.ts src/character.test.ts src/anims.ts src/anims.test.ts
git commit -m "feat: personagem em camadas e quadros de animação (lógica pura)

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 4: Copiar os assets comprados para public/

**Files:**
- Create: `tools/vendor.ts`, `tools/vendor.test.ts`
- Generates (fora do git): `public/tilesets/limezu-floors.png`, `public/tilesets/limezu-walls.png`, `public/sprites/character/{bodies,eyes,outfits,hairstyles,accessories}/*.png`, `public/sprites/character/manifest.json` (formato `Parts`), `public/sprites/npc/<nome>.png`, `public/sprites/npc/manifest.json` (`string[]`)

**Interfaces:**
- Consumes: `PART_KINDS`, `PART_DIRS`, `type Parts` de `src/character.ts`.
- Produces: `kebab(s: string): string`; `pngs(files: string[]): string[]`; nomes de NPC em kebab-case (`old-man`, `blonde-woman`, `policeman`…), usados nos mapas e no carregamento.

- [ ] **Step 1: Garantir que os zips estão extraídos**

Se `vendor/x/` não existir (clone novo), extrair cada zip numa pasta própria:

```bash
for z in vendor/zips/*.zip; do n=$(basename "$z" .zip | tr ' ' '_'); mkdir -p "vendor/x/$n" && unzip -q -o "$z" -d "vendor/x/$n"; done
```

Expected: pastas `vendor/x/moderninteriors-win`, `vendor/x/RPG_Top_Down_Character_Asset_Pack_-_FULL`, entre outras.

- [ ] **Step 2: Teste dos auxiliares**

`tools/vendor.test.ts`:

```ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { kebab, pngs } from './vendor.ts';

test('kebab turns folder names into keys', () => {
  assert.equal(kebab('Blonde Woman'), 'blonde-woman');
  assert.equal(kebab('  Old Man '), 'old-man');
  assert.equal(kebab('Punk Kid Boy'), 'punk-kid-boy');
});

test('pngs keeps sprite sheets, drops shadows and other files, sorted', () => {
  assert.deepEqual(pngs(['b.png', 'a_shadow.png', 'a.png', 'notes.txt', 'C.PNG']), ['C.PNG', 'a.png', 'b.png']);
});
```

- [ ] **Step 3: Rodar e ver falhar**

Run: `node --test tools/vendor.test.ts`
Expected: FAIL, `./vendor.ts` não existe.

- [ ] **Step 4: Implementar `tools/vendor.ts`**

```ts
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
```

- [ ] **Step 5: Rodar testes e a cópia**

Run: `node --test tools/vendor.test.ts`
Expected: PASS.

Run: `npm run vendor`
Expected: `ok: body=9 eyes=7 outfit=132 hair=200 acc=84 npcs=29`.

Run: `git status --short public/`
Expected: nada de `public/sprites` nem `public/tilesets/limezu-*` aparece (está no `.gitignore`).

- [ ] **Step 6: Commit**

```bash
git add tools/vendor.ts tools/vendor.test.ts
git commit -m "feat: copia tilesets e sprites comprados para public/ com manifestos

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 5: Áreas do Tiled

**Files:**
- Create: `src/areas.ts`, `src/areas.test.ts`

**Interfaces:**
- Produces: `type Rect = { x: number; y: number; w: number; h: number }`; `type Area` (união discriminada por `kind`: `entry` | `door {map, entry}` | `sign {pages}` | `npc {label, sprite, pages}` | `website {url, trigger: 'enter' | 'key'}` | `sound {src, volume}`, todas com `name` e `rect`); `type TiledObject`; `paginate(text: string): string[]`; `contains(r: Rect, x: number, y: number): boolean`; `near(r: Rect, x: number, y: number, pad: number): boolean`; `entryPoint(areas: Area[], name: string): { x: number; y: number } | null`; `parseAreas(objects: TiledObject[]): { areas: Area[]; warnings: string[] }`.

- [ ] **Step 1: Testes**

`src/areas.test.ts`:

```ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { contains, entryPoint, near, paginate, parseAreas, type TiledObject } from './areas.ts';

const obj = (type: string, name: string, props: Record<string, unknown> = {}, x = 0, y = 0): TiledObject => ({
  type, name, x, y, width: 16, height: 16,
  properties: Object.entries(props).map(([n, value]) => ({ name: n, type: typeof value === 'number' ? 'float' : 'string', value })),
});

test('parses every kind with valid properties', () => {
  const { areas, warnings } = parseAreas([
    obj('entry', 'default'),
    obj('door', 'porta', { map: 'cb-corredor', entry: 'porta-lab' }),
    obj('sign', 'micro', { text: 'Olá\n---\nTchau' }),
    obj('npc', 'prof', { name: 'Prof. Bezerra', sprite: 'old-man', text: 'Bem-vindo!' }),
    obj('website', 'pc', { url: 'https://www.ufrn.br/', trigger: 'enter' }),
    obj('sound', 'hum', { src: 'audio/lab-hum.wav', volume: 0.3 }),
  ]);
  assert.deepEqual(warnings, []);
  assert.deepEqual(areas.map(a => a.kind), ['entry', 'door', 'sign', 'npc', 'website', 'sound']);
  const [, door, sign, npc, site, sound] = areas;
  assert.ok(door.kind === 'door' && door.map === 'cb-corredor' && door.entry === 'porta-lab');
  assert.ok(sign.kind === 'sign');
  assert.deepEqual(sign.pages, ['Olá', 'Tchau']);
  assert.ok(npc.kind === 'npc' && npc.label === 'Prof. Bezerra' && npc.sprite === 'old-man');
  assert.ok(site.kind === 'website' && site.trigger === 'enter');
  assert.ok(sound.kind === 'sound' && sound.volume === 0.3);
  assert.deepEqual(areas[0].rect, { x: 0, y: 0, w: 16, h: 16 });
});

test('a missing required property warns with the object name and skips that area', () => {
  const { areas, warnings } = parseAreas([obj('entry', 'default'), obj('door', 'porta-lab'), obj('npc', 'ze', { text: 'oi' })]);
  assert.deepEqual(areas.map(a => a.kind), ['entry']);
  assert.deepEqual(warnings, ['[areas] door "porta-lab" sem propriedade "map"', '[areas] npc "ze" sem propriedade "sprite"']);
});

test('unknown or missing Class warns and the rest still parses', () => {
  const { areas, warnings } = parseAreas([obj('entry', 'default'), obj('teleporte', 'x'), obj('', 'enfeite')]);
  assert.equal(areas.length, 1);
  assert.deepEqual(warnings, ['[areas] Class desconhecida "teleporte" em "x"', '[areas] objeto "enfeite" sem Class']);
});

test('website only accepts http(s) urls', () => {
  const { areas, warnings } = parseAreas([obj('entry', 'default'), obj('website', 'mal', { url: 'javascript:alert(1)' })]);
  assert.equal(areas.length, 1);
  assert.match(warnings[0], /url inválida/);
});

test('defaults: door entry → default, website trigger → key (warns if invalid), sound volume clamped', () => {
  const { areas, warnings } = parseAreas([
    obj('entry', 'default'),
    obj('door', 'p', { map: 'x' }),
    obj('website', 's', { url: 'https://a.b', trigger: 'pisar' }),
    obj('sound', 'alto', { src: 'a.wav', volume: 7 }),
    obj('sound', 'padrao', { src: 'b.wav' }),
  ]);
  const [, door, site, loud, plain] = areas;
  assert.ok(door.kind === 'door' && door.entry === 'default');
  assert.ok(site.kind === 'website' && site.trigger === 'key');
  assert.ok(loud.kind === 'sound' && loud.volume === 1);
  assert.ok(plain.kind === 'sound' && plain.volume === 0.5);
  assert.deepEqual(warnings, ['[areas] website "s" com trigger inválido "pisar", usando "key"']);
});

test('reads the Class from the "class" field too', () => {
  const o = obj('', 'default');
  delete o.type;
  o.class = 'entry';
  assert.equal(parseAreas([o]).areas[0].kind, 'entry');
});

test('warns when the map has no default entry', () => {
  assert.deepEqual(parseAreas([obj('entry', 'porta')]).warnings, ['[areas] mapa sem entry "default"']);
});

test('entryPoint returns the center, falls back to default, null without entries', () => {
  const { areas } = parseAreas([obj('entry', 'default', {}, 32, 48), obj('entry', 'porta', {}, 0, 0)]);
  assert.deepEqual(entryPoint(areas, 'porta'), { x: 8, y: 8 });
  assert.deepEqual(entryPoint(areas, 'nao-existe'), { x: 40, y: 56 });
  assert.equal(entryPoint([], 'default'), null);
});

test('contains is half-open and near expands by pad', () => {
  const r = { x: 0, y: 0, w: 16, h: 16 };
  assert.equal(contains(r, 0, 0), true);
  assert.equal(contains(r, 16, 8), false);
  assert.equal(near(r, 20, 8, 5), true);
  assert.equal(near(r, 22, 8, 5), false);
});

test('paginate splits on lines with only ---, trims and drops empty pages', () => {
  assert.deepEqual(paginate('a\n---\n\n---\n  b  '), ['a', 'b']);
  assert.deepEqual(paginate('sem separador'), ['sem separador']);
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `node --test src/areas.test.ts`
Expected: FAIL, `./areas.ts` não existe.

- [ ] **Step 3: Implementar `src/areas.ts`**

```ts
export type Rect = { x: number; y: number; w: number; h: number };

type Base = { name: string; rect: Rect };
export type Area =
  | (Base & { kind: 'entry' })
  | (Base & { kind: 'door'; map: string; entry: string })
  | (Base & { kind: 'sign'; pages: string[] })
  | (Base & { kind: 'npc'; label: string; sprite: string; pages: string[] })
  | (Base & { kind: 'website'; url: string; trigger: 'enter' | 'key' })
  | (Base & { kind: 'sound'; src: string; volume: number });

export type TiledProperty = { name: string; type?: string; value: unknown };
export type TiledObject = {
  name?: string; type?: string; class?: string;
  x: number; y: number; width?: number; height?: number;
  properties?: TiledProperty[];
};

/** Separa o texto em páginas nas linhas que têm só `---`. */
export function paginate(text: string): string[] {
  return text.split(/^\s*---\s*$/m).map(p => p.trim()).filter(Boolean);
}

export function contains(r: Rect, x: number, y: number): boolean {
  return x >= r.x && x < r.x + r.w && y >= r.y && y < r.y + r.h;
}

export function near(r: Rect, x: number, y: number, pad: number): boolean {
  return contains({ x: r.x - pad, y: r.y - pad, w: r.w + 2 * pad, h: r.h + 2 * pad }, x, y);
}

/** Centro da entry pedida; se não existir, a `default`; sem entries, null. */
export function entryPoint(areas: Area[], name: string): { x: number; y: number } | null {
  const e = areas.find(a => a.kind === 'entry' && a.name === name) ?? areas.find(a => a.kind === 'entry' && a.name === 'default');
  return e ? { x: e.rect.x + e.rect.w / 2, y: e.rect.y + e.rect.h / 2 } : null;
}

export function parseAreas(objects: TiledObject[]): { areas: Area[]; warnings: string[] } {
  const areas: Area[] = [], warnings: string[] = [];
  for (const o of objects) {
    const kind = o.type || o.class || '';
    const name = o.name || '(sem nome)';
    const props = new Map((o.properties ?? []).map(p => [p.name, p.value]));
    const str = (k: string) => {
      const v = props.get(k);
      return typeof v === 'string' ? v.trim() : '';
    };
    const need = (...keys: string[]) => {
      const missing = keys.filter(k => !str(k));
      for (const k of missing) warnings.push(`[areas] ${kind} "${name}" sem propriedade "${k}"`);
      return missing.length === 0;
    };
    const rect = { x: o.x, y: o.y, w: o.width ?? 0, h: o.height ?? 0 };
    switch (kind) {
      case 'entry':
        areas.push({ kind, name, rect });
        break;
      case 'door':
        if (need('map')) areas.push({ kind, name, rect, map: str('map'), entry: str('entry') || 'default' });
        break;
      case 'sign':
        if (need('text')) areas.push({ kind, name, rect, pages: paginate(str('text')) });
        break;
      case 'npc':
        if (need('sprite', 'text')) areas.push({ kind, name, rect, label: str('name') || name, sprite: str('sprite'), pages: paginate(str('text')) });
        break;
      case 'website': {
        if (!need('url')) break;
        const url = str('url');
        if (!/^https?:\/\//i.test(url)) {
          warnings.push(`[areas] website "${name}" com url inválida (use http/https): ${url}`);
          break;
        }
        const t = str('trigger');
        if (t && t !== 'enter' && t !== 'key') warnings.push(`[areas] website "${name}" com trigger inválido "${t}", usando "key"`);
        areas.push({ kind, name, rect, url, trigger: t === 'enter' ? 'enter' : 'key' });
        break;
      }
      case 'sound': {
        if (!need('src')) break;
        const v = Number(props.get('volume') ?? 0.5);
        areas.push({ kind, name, rect, src: str('src'), volume: Number.isFinite(v) ? Math.min(1, Math.max(0, v)) : 0.5 });
        break;
      }
      default:
        warnings.push(kind ? `[areas] Class desconhecida "${kind}" em "${name}"` : `[areas] objeto "${name}" sem Class`);
    }
  }
  if (!areas.some(a => a.kind === 'entry' && a.name === 'default')) warnings.push('[areas] mapa sem entry "default"');
  return { areas, warnings };
}
```

- [ ] **Step 4: Rodar e ver passar**

Run: `node --test src/areas.test.ts`
Expected: PASS (10 testes).

- [ ] **Step 5: Commit**

```bash
git add src/areas.ts src/areas.test.ts
git commit -m "feat: leitura tipada das áreas do Tiled com avisos de autoria

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 6: Mapas do laboratório e do corredor

**Files:**
- Create: `tools/maps.ts`, `tools/maps.test.ts`
- Generates (versionados): `public/maps/cb-lab.tmj`, `public/maps/cb-corredor.tmj`

**Interfaces:**
- Consumes: `LAB`, `LAB_COLS`, `LAB_ROWS`, `LAB_SOLID` de `tools/lab-tiles.ts`; `parseAreas`, `contains`, `TiledObject` de `src/areas.ts` (só no teste).
- Produces: `type MapSpec = { name: string; title: string; base: string[]; items: string[]; areas: AreaSpec[] }`; `type AreaSpec = { type: string; name: string; col: number; row: number; w?: number; h?: number; props?: Record<string, string | number> }`; `buildMap(spec: MapSpec)` (retorna o JSON do Tiled); `LAB_MAP`, `CORRIDOR_MAP`, `MAPS`. Mapas `.tmj` com tilesets embutidos `limezu-floors` (firstgid 1), `limezu-walls` (601), `ufrn-lab` (1881); camadas `floor`, `walls`, `furniture`, `items`, `areas`; propriedade de mapa `name`.

Legenda do ASCII `base`: `#` parede grossa (cap), `W` face de parede LimeZu (topo/base e pontas automáticos), `.` piso, `M` piso + tapete, `b` tampo de bancada, `f` frente de bancada (pontas automáticas). Legenda de `items`: `.` vazio, `m` microscópio, `r`/`g`/`u` frasco vermelho/verde/azul, `k` béquer, `t` estante de tubos, `c` computador, `w`/`v` janela (topo/base), `L`/`l` armário (topo/base).

- [ ] **Step 1: Testes (formato e "lint" dos mapas)**

`tools/maps.test.ts`:

```ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildMap, LAB_MAP, MAPS, type MapSpec } from './maps.ts';
import { contains, parseAreas, type Area, type TiledObject } from '../src/areas.ts';

type Built = ReturnType<typeof buildMap>;
const tileLayer = (m: Built, name: string) => m.layers.find(l => l.name === name) as { data: number[] };
const areasOf = (m: Built) => parseAreas((m.layers.find(l => l.name === 'areas') as { objects: TiledObject[] }).objects);
const built = MAPS.map(spec => ({ spec, map: buildMap(spec) }));

test('every tile layer has width × height cells', () => {
  for (const { map } of built) {
    for (const name of ['floor', 'walls', 'furniture', 'items']) assert.equal(tileLayer(map, name).data.length, map.width * map.height, `${name}`);
  }
});

test('lab uses the expected gids for floor, wall ends, cap, benches and items', () => {
  const lab = buildMap(LAB_MAP);
  const at = (layer: string, x: number, y: number) => tileLayer(lab, layer).data[y * lab.width + x];
  assert.equal(at('floor', 1, 3), 1 + 31 * 15 + 13);
  assert.equal(at('floor', 3, 4), 1 + 30 * 15 + 12);
  assert.equal(at('walls', 1, 1), 601 + 14 * 32 + 0);
  assert.equal(at('walls', 2, 1), 601 + 14 * 32 + 1);
  assert.equal(at('walls', 24, 2), 601 + 15 * 32 + 2);
  assert.equal(at('walls', 0, 0), 1881 + 1);
  assert.equal(at('furniture', 3, 5), 1881 + 3);
  assert.equal(at('furniture', 4, 5), 1881 + 4);
  assert.equal(at('furniture', 10, 5), 1881 + 5);
  assert.equal(at('furniture', 3, 6), 1881 + 6);
  assert.equal(at('items', 3, 5), 1881 + 9);
  assert.equal(at('floor', 0, 0), 0);
});

test('the areas of every map parse without warnings', () => {
  for (const { spec, map } of built) assert.deepEqual(areasOf(map).warnings, [], spec.name);
});

test('no entry sits inside a door (the player would bounce between maps)', () => {
  for (const { spec, map } of built) {
    const areas = areasOf(map).areas;
    for (const e of areas.filter(a => a.kind === 'entry')) {
      const c = { x: e.rect.x + e.rect.w / 2, y: e.rect.y + e.rect.h / 2 };
      for (const d of areas.filter(a => a.kind === 'door')) assert.equal(contains(d.rect, c.x, c.y), false, `${spec.name}: ${e.name} dentro de ${d.name}`);
    }
  }
});

test('every door points to a built map and an entry that exists there', () => {
  const entries = new Map(built.map(({ spec, map }) => [spec.name, areasOf(map).areas.filter(a => a.kind === 'entry').map(a => a.name)]));
  for (const { spec, map } of built) {
    for (const d of areasOf(map).areas.filter((a): a is Extract<Area, { kind: 'door' }> => a.kind === 'door')) {
      assert.ok(entries.has(d.map), `${spec.name}: porta para mapa inexistente ${d.map}`);
      assert.ok(entries.get(d.map)!.includes(d.entry), `${spec.name}: entry ${d.entry} não existe em ${d.map}`);
    }
  }
});

test('rejects rows of the wrong width and unknown characters', () => {
  const ok: MapSpec = { name: 't', title: 'T', base: ['###', '#.#', '###'], items: ['...', '...', '...'], areas: [] };
  assert.doesNotThrow(() => buildMap(ok));
  assert.throws(() => buildMap({ ...ok, base: ['###', '#.', '###'] }), /colunas/);
  assert.throws(() => buildMap({ ...ok, base: ['###', '#?#', '###'] }), /caractere desconhecido/);
  assert.throws(() => buildMap({ ...ok, items: ['...', '.z.', '...'] }), /item desconhecido/);
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `node --test tools/maps.test.ts`
Expected: FAIL, `./maps.ts` não existe.

- [ ] **Step 3: Implementar `tools/maps.ts`**

```ts
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
```

- [ ] **Step 4: Rodar e ver passar**

Run: `node --test tools/maps.test.ts`
Expected: PASS (6 testes).

- [ ] **Step 5: Gerar os mapas**

Run: `npm run maps`
Expected: `ok: public/maps/cb-lab.tmj` e `ok: public/maps/cb-corredor.tmj`.

Run: `npm test`
Expected: todos os testes de `src/` e `tools/` passam.

- [ ] **Step 6: Commit**

```bash
git add tools/maps.ts tools/maps.test.ts public/maps
git commit -m "feat: mapas do laboratório e do corredor gerados a partir de ASCII

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 7: Diálogo (máquina de estados)

**Files:**
- Create: `src/dialog.ts`, `src/dialog.test.ts`

**Interfaces:**
- Produces: `type Dialog = { label: string; pages: string[]; page: number; shown: number }`; `openDialog(label: string, pages: string[]): Dialog | null`; `reveal(d: Dialog, n: number): Dialog`; `press(d: Dialog): Dialog | null`; `visibleText(d: Dialog): string`.

- [ ] **Step 1: Testes**

`src/dialog.test.ts`:

```ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { openDialog, press, reveal, visibleText, type Dialog } from './dialog.ts';

test('openDialog without pages returns null', () => {
  assert.equal(openDialog('x', []), null);
});

test('reveal shows letters up to the end of the page', () => {
  const d = openDialog('', ['Olá'])!;
  assert.equal(visibleText(reveal(d, 2)), 'Ol');
  assert.equal(visibleText(reveal(reveal(d, 2), 5)), 'Olá');
});

test('press completes the page first, then advances, then closes', () => {
  let d = openDialog('Prof', ['Olá', 'Tchau'])!;
  d = press(d)!;
  assert.equal(visibleText(d), 'Olá');
  d = press(d)!;
  assert.equal(d.page, 1);
  assert.equal(visibleText(d), '');
  d = press(d)!;
  assert.equal(visibleText(d), 'Tchau');
  assert.equal(press(d), null);
});

test('mashing the key never skips an unread page: two presses per page', () => {
  let d: Dialog | null = openDialog('', ['a', 'b', 'c']);
  let presses = 0;
  while (d) {
    d = press(d);
    presses++;
  }
  assert.equal(presses, 6);
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `node --test src/dialog.test.ts`
Expected: FAIL, `./dialog.ts` não existe.

- [ ] **Step 3: Implementar `src/dialog.ts`**

```ts
export type Dialog = { label: string; pages: string[]; page: number; shown: number };

export function openDialog(label: string, pages: string[]): Dialog | null {
  return pages.length ? { label, pages, page: 0, shown: 0 } : null;
}

/** Revela mais `n` letras da página atual (efeito máquina de escrever). */
export function reveal(d: Dialog, n: number): Dialog {
  return { ...d, shown: Math.min(d.pages[d.page].length, d.shown + n) };
}

/** Tecla de ação: completa a página; se já completa, avança; depois da última, fecha (null). */
export function press(d: Dialog): Dialog | null {
  if (d.shown < d.pages[d.page].length) return { ...d, shown: d.pages[d.page].length };
  return d.page + 1 < d.pages.length ? { ...d, page: d.page + 1, shown: 0 } : null;
}

export const visibleText = (d: Dialog): string => d.pages[d.page].slice(0, d.shown);
```

- [ ] **Step 4: Rodar e ver passar**

Run: `node --test src/dialog.test.ts`
Expected: PASS (4 testes).

- [ ] **Step 5: Commit**

```bash
git add src/dialog.ts src/dialog.test.ts
git commit -m "feat: diálogo com páginas e máquina de escrever

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 8: Interface (DOM) e criador de personagem

**Files:**
- Create: `src/compose.ts`, `src/ui.ts`
- Modify: `src/main.ts` (substitui o conteúdo da Task 1)

**Interfaces:**
- Consumes: `Dialog`, `visibleText` (Task 7); `PART_KINDS`, `PartKind`, `Parts`, `Character`, `cycle`, `cleanName`, `layerUrls`, `defaultCharacter`, `parseSaved`, `saveCharacter`, `loadSavedRaw` (Task 3).
- Produces (`src/compose.ts`): `loadImage(src: string): Promise<HTMLImageElement>`; `composeLayers(urls: string[]): Promise<HTMLImageElement>`.
- Produces (`src/ui.ts`): `type Point = { x: number; y: number }`; `initUi(): void`; `shieldKeys(input: HTMLElement): void`; `showDialog(d: Dialog | null): void`; `showBanner(text: string): void`; `showPrompt(p: Point | null): void`; `showTag(name: string, p: Point): void`; `showBalloon(text: string | null, p: Point): void`; `openSay(onSubmit: (text: string) => void, onClose: () => void): void`; `openPanel(url: string): void`; `closePanel(): void`; `openCreator(parts: Parts, initial: Character, onPlay: (c: Character) => void, onCancel?: () => void): void`.

- [ ] **Step 1: `src/compose.ts`**

```ts
export function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`não carregou ${src}`));
    img.src = src;
  });
}

/** Empilha camadas com o mesmo layout de quadros numa imagem só (para o Phaser e o preview). */
export async function composeLayers(urls: string[]): Promise<HTMLImageElement> {
  const imgs = await Promise.all(urls.map(loadImage));
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(...imgs.map(i => i.width));
  canvas.height = Math.max(...imgs.map(i => i.height));
  const ctx = canvas.getContext('2d')!;
  for (const img of imgs) ctx.drawImage(img, 0, 0);
  return loadImage(canvas.toDataURL());
}
```

- [ ] **Step 2: `src/ui.ts`**

```ts
import { visibleText, type Dialog } from './dialog.ts';
import { cleanName, cycle, layerUrls, type Character, type PartKind, type Parts } from './character.ts';
import { composeLayers } from './compose.ts';

export type Point = { x: number; y: number };
const el = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;
const LABELS: Record<PartKind, string> = { body: 'Corpo', eyes: 'Olhos', outfit: 'Roupa', hair: 'Cabelo', acc: 'Acessório' };

/** O Phaser escuta teclas no window; o que se digita num campo não pode chegar até ele. */
export function shieldKeys(input: HTMLElement): void {
  for (const type of ['keydown', 'keyup'] as const) input.addEventListener(type, e => e.stopPropagation());
}

export function initUi(): void {
  shieldKeys(el('say-input'));
  shieldKeys(el('creator-name'));
  el('panel-close').onclick = closePanel;
  el('credits-close').onclick = () => { el('credits').hidden = true; };
  el('creator-credits').onclick = () => { el('credits').hidden = false; };
  for (const row of document.querySelectorAll<HTMLElement>('#creator .row')) row.querySelector('span')!.textContent = LABELS[row.dataset.part as PartKind];
}

function place(node: HTMLElement, p: Point | null): void {
  node.hidden = !p;
  if (p) {
    node.style.left = `${p.x}px`;
    node.style.top = `${p.y}px`;
  }
}

export function showDialog(d: Dialog | null): void {
  el('dialog').hidden = !d;
  if (!d) return;
  el('dialog-label').textContent = d.label;
  el('dialog-text').textContent = visibleText(d);
  el('dialog-next').hidden = d.shown < d.pages[d.page].length;
}

let bannerTimer = 0;
export function showBanner(text: string): void {
  const b = el('banner');
  b.textContent = text;
  b.hidden = false;
  b.style.animation = 'none';
  void b.offsetWidth;
  b.style.animation = '';
  clearTimeout(bannerTimer);
  bannerTimer = window.setTimeout(() => { b.hidden = true; }, 3000);
}

export const showPrompt = (p: Point | null): void => place(el('prompt'), p);

export function showTag(name: string, p: Point): void {
  el('tag').textContent = name;
  place(el('tag'), p);
}

export function showBalloon(text: string | null, p: Point): void {
  if (text) el('balloon').textContent = text;
  place(el('balloon'), text ? p : null);
}

export function openSay(onSubmit: (text: string) => void, onClose: () => void): void {
  const form = el<HTMLFormElement>('say'), input = el<HTMLInputElement>('say-input');
  const close = () => {
    form.onsubmit = null;
    input.onkeydown = null;
    input.onblur = null;
    form.hidden = true;
    input.blur();
    onClose();
  };
  form.hidden = false;
  input.value = '';
  input.focus();
  form.onsubmit = e => {
    e.preventDefault();
    const text = input.value.trim().slice(0, 60);
    if (text) onSubmit(text);
    close();
  };
  input.onkeydown = e => { if (e.key === 'Escape') close(); };
  input.onblur = close;
}

export function openPanel(url: string): void {
  el('panel').hidden = false;
  el<HTMLAnchorElement>('panel-open').href = url;
  const frame = el<HTMLIFrameElement>('panel-frame');
  if (frame.src !== url) frame.src = url;
}

export function closePanel(): void {
  if (el('panel').hidden) return;
  el('panel').hidden = true;
  el<HTMLIFrameElement>('panel-frame').src = 'about:blank';
}

/** Tela de criação. Preview anima a caminhada olhando para baixo (linha 2, quadros 18-23). */
export function openCreator(parts: Parts, initial: Character, onPlay: (c: Character) => void, onCancel?: () => void): void {
  const box = el('creator'), name = el<HTMLInputElement>('creator-name');
  const ctx = el<HTMLCanvasElement>('creator-preview').getContext('2d')!;
  let look = { ...initial.look }, sheet: HTMLImageElement | null = null, frame = 0, version = 0;
  const redraw = async () => {
    const v = ++version;
    try {
      const img = await composeLayers(layerUrls(look));
      if (v === version) sheet = img;
    } catch (err) {
      console.error(err);
    }
  };
  const timer = window.setInterval(() => {
    if (!sheet) return;
    frame = (frame + 1) % 6;
    ctx.clearRect(0, 0, 16, 32);
    ctx.drawImage(sheet, (18 + frame) * 16, 64, 16, 32, 0, 0, 16, 32);
  }, 140);
  for (const row of box.querySelectorAll<HTMLElement>('.row')) {
    const kind = row.dataset.part as PartKind;
    for (const b of row.querySelectorAll<HTMLButtonElement>('button')) {
      b.onclick = () => {
        look = { ...look, [kind]: cycle(parts, kind, look[kind], Number(b.dataset.dir) as 1 | -1) };
        void redraw();
      };
    }
  }
  const finish = (then: () => void) => {
    clearInterval(timer);
    box.hidden = true;
    document.onkeydown = null;
    then();
  };
  el('creator-play').onclick = () => finish(() => onPlay({ name: cleanName(name.value), look }));
  document.onkeydown = onCancel ? e => { if (e.key === 'Escape' && el('credits').hidden) finish(onCancel); } : null;
  name.value = initial.name;
  box.hidden = false;
  void redraw();
}
```

- [ ] **Step 3: `src/main.ts` provisório (só o criador)**

```ts
import { defaultCharacter, loadSavedRaw, parseSaved, saveCharacter, type Character, type Parts } from './character.ts';
import { initUi, openCreator } from './ui.ts';

async function getJson<T>(url: string): Promise<T> {
  const r = await fetch(url);
  if (!r.ok) throw new Error(`${url} → ${r.status}. Rodou "npm run vendor"?`);
  return r.json() as Promise<T>;
}

async function main(): Promise<void> {
  initUi();
  const parts = await getJson<Parts>('sprites/character/manifest.json');
  const character = parseSaved(loadSavedRaw(), parts) ?? await new Promise<Character>(done => openCreator(parts, defaultCharacter(parts), done));
  saveCharacter(character);
  console.log('personagem', character);
}

main().catch((err: unknown) => {
  console.error(err);
  const p = document.createElement('p');
  p.className = 'fatal';
  p.textContent = `Erro ao iniciar: ${err instanceof Error ? err.message : String(err)}`;
  document.body.append(p);
});
```

- [ ] **Step 4: Conferir no navegador**

Run: `npx tsc --noEmit`
Expected: sem erros.

Com `npm run dev` rodando, abrir `http://localhost:5173` numa aba anônima (sem `localStorage`).
Expected:
- A tela "Biogame · UFRN" aparece com o boneco andando no preview, campo Nome = "Calouro" e as linhas Corpo, Olhos, Roupa, Cabelo e Acessório.
- Clicar ▶ em Cabelo e Roupa muda o boneco em menos de 1 s.
- "Créditos" abre a lista e "Voltar" fecha.
- Digitar "Ana" e clicar "Jogar ▶" fecha a tela, e o console mostra `personagem {name: 'Ana', …}`.
- Recarregar: o criador **não** aparece e o console mostra o mesmo personagem.
- No console: `localStorage.setItem('biogame.character', '{quebrado')` e recarregar: o criador volta a aparecer com o padrão, sem erro.

- [ ] **Step 5: Commit**

```bash
git add src/compose.ts src/ui.ts src/main.ts
git commit -m "feat: interface GBA e criador de personagem em camadas

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 9: Cena do mundo

**Files:**
- Create: `src/world.ts`
- Modify: `src/main.ts` (versão final)

**Interfaces:**
- Consumes: tudo de `areas.ts`, `anims.ts`, `character.ts`, `compose.ts`, `dialog.ts`, `ui.ts`; texturas `limezu-floors`, `limezu-walls`, `ufrn-lab`, `npc:<nome>` carregadas pela cena `boot`; registry `parts`, `npcs`, `character`, `playerImage`, `playerVersion`.
- Produces: `class World extends Phaser.Scene` (chave `'world'`); `type WorldData = { map: string; entry: string; pos?: { x: number; y: number }; prev?: { map: string; entry: string } }`. Em dev, `window.game` aponta para o `Phaser.Game` (usado na Task 10).

- [ ] **Step 1: `src/world.ts`**

```ts
import Phaser from 'phaser';
import { contains, entryPoint, near, parseAreas, type Area, type TiledObject } from './areas.ts';
import { dirFromVelocity, limezuFrames, pixelserialFrames, type Dir } from './anims.ts';
import { layerUrls, saveCharacter, type Character, type Parts } from './character.ts';
import { composeLayers } from './compose.ts';
import { openDialog, press, reveal, type Dialog } from './dialog.ts';
import * as ui from './ui.ts';

const SPEED = 80, RUN = 150, ZOOM = 3, TALK_PAD = 10, FEET = 12;
const DIRS: Dir[] = ['right', 'up', 'left', 'down'];
type Point = { x: number; y: number };
export type WorldData = { map: string; entry: string; pos?: Point; prev?: { map: string; entry: string } };
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
  private sounds = new Map<Area, Phaser.Sound.BaseSound>();
  private dialog: Dialog | null = null;
  private facing: Dir = 'down';
  private leaving = false;
  private busy = false;
  private balloon = { text: '', until: 0 };

  constructor() {
    super('world');
  }

  init(data: WorldData): void {
    // A mesma instância é reaproveitada a cada restart: zera tudo aqui.
    this.here = data;
    this.areas = [];
    this.inside = new Set();
    this.sounds = new Map();
    this.dialog = null;
    this.facing = 'down';
    this.leaving = false;
    this.busy = false;
    this.balloon = { text: '', until: 0 };
  }

  preload(): void {
    const key = `map:${this.here.map}`;
    if (!this.cache.tilemap.exists(key)) this.load.tilemapTiledJSON(key, `maps/${this.here.map}.tmj`);
  }

  create(): void {
    const key = `map:${this.here.map}`;
    if (!this.cache.tilemap.exists(key)) return this.fail(`Mapa "${this.here.map}" não encontrado`);
    const map = this.make.tilemap({ key });
    const tilesets = map.tilesets.map(t => map.addTilesetImage(t.name, t.name)).filter(t => t !== null);
    const solid = map.layers.map(l => {
      const layer = map.createLayer(l.name, tilesets) as Phaser.Tilemaps.TilemapLayer;
      return layer.setDepth(prop(l.properties, 'above') === true ? 10 : 0).setCollisionByProperty({ collides: true });
    });

    const parsed = parseAreas((map.getObjectLayer('areas')?.objects ?? []) as TiledObject[]);
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

    ui.showBanner(String(prop(map.properties, 'name') ?? this.here.map));
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.scale.off(Phaser.Scale.Events.RESIZE, fit);
      this.sounds.forEach(s => s.destroy());
      ui.showDialog(null);
      ui.showPrompt(null);
      ui.closePanel();
    });
  }

  update(time: number): void {
    if (this.leaving || this.busy) return;
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
    for (const a of this.inside) if (!now.has(a) && a.kind === 'website') ui.closePanel();
    this.inside = now;
    if (this.leaving) return;

    const target = this.areas.find(a => (a.kind === 'sign' || a.kind === 'npc' || (a.kind === 'website' && a.trigger === 'key')) && near(a.rect, fx, fy, TALK_PAD));
    ui.showPrompt(target ? this.toScreen(target.rect.x + target.rect.w / 2, target.rect.y - (target.kind === 'npc' ? 26 : 2)) : null);
    if (act && target) this.interact(target);
    this.syncSounds();
    this.overlays(time);
  }

  private makePlayer(map: Phaser.Tilemaps.Tilemap): Phaser.Physics.Arcade.Sprite {
    const img = this.registry.get('playerImage') as HTMLImageElement;
    const tex = `player-v${this.registry.get('playerVersion') as number}`;
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
    (npc.body as Phaser.Physics.Arcade.Body).setSize(12, 8).setOffset(10, 22);
    npc.setDepth(5 + npc.y / 10000).play(anim);
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
    this.player.setDepth(5 + this.player.y / 10000);
  }

  private enter(a: Area): void {
    if (a.kind === 'door') this.go({ map: a.map, entry: a.entry });
    else if (a.kind === 'website' && a.trigger === 'enter') ui.openPanel(a.url);
  }

  private interact(a: Area): void {
    if (a.kind === 'website') return ui.openPanel(a.url);
    if (a.kind !== 'sign' && a.kind !== 'npc') return;
    this.dialog = openDialog(a.kind === 'npc' ? a.label : '', a.pages);
    ui.showPrompt(null);
    ui.showDialog(this.dialog);
  }

  private go(next: { map: string; entry: string }): void {
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
    ui.showBalloon(time < this.balloon.until ? this.balloon.text : null, { x: head.x, y: head.y - 26 });
  }

  private toScreen(x: number, y: number): Point {
    const cam = this.cameras.main;
    return { x: (x - cam.worldView.x) * cam.zoom, y: (y - cam.worldView.y) * cam.zoom };
  }
}
```

- [ ] **Step 2: `src/main.ts` final**

```ts
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
```

- [ ] **Step 3: Tipos e build**

Run: `npm run build`
Expected: sem erros de tipo; `dist/` gerado.

Run: `npm test`
Expected: todos passam.

- [ ] **Step 4: Conferir no navegador**

Com `npm run dev`, abrir `http://localhost:5173` (com personagem já salvo da Task 8).
Expected:
- O banner "CB · Laboratório de Biofísica" desliza no canto superior esquerdo.
- O laboratório aparece com zoom 3×: piso azul-acinzentado, parede bege com faixa laranja, janelas com árvores, armários, duas fileiras de bancadas brancas com frente azul, microscópios, frascos e computadores.
- O Prof. Bezerra (idoso do PixelSerial) aparece no topo do corredor central, e a Monitora no meio.
- O jogador anda com setas/WASD, corre com Shift e não atravessa paredes, bancadas, armários nem NPCs.
- Perto do professor aparece o "Z": apertar Z abre "Seja bem-vindo…" letra a letra; Z completa, Z vai à página 2, Z fecha.
- Perto do microscópio, Z abre a placa. Perto do computador, Z abre o painel do site com "abrir em nova aba ↗"; Esc fecha.
- Enter abre o campo; digitar "wasd ezmc" e Enter: o boneco não se mexeu, o som não mutou, o criador não abriu, e o balão "wasd ezmc" aparece por ~5 s.
- O zumbido toca (depois da primeira tecla, se o navegador bloquear áudio); M muta e desmuta.
- C abre o criador; trocar o cabelo e "Jogar ▶": o boneco muda no mesmo lugar.
- Andar até o tapete e descer pela abertura: fade e banner "CB · Corredor", nascendo abaixo da passagem; subir pela passagem volta ao lab, perto do tapete, sem voltar sozinho para o corredor.
- Console sem erros e sem avisos `[areas]`.

- [ ] **Step 5: Commit**

```bash
git add src/world.ts src/main.ts
git commit -m "feat: cena do mundo com colisão, NPCs, diálogo, portas, painel, balão e som

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 10: Verificação ponta a ponta e comparação com a referência

**Files:**
- Modify (só se a verificação achar problema): os arquivos da task responsável.

**Interfaces:**
- Consumes: `window.game` (dev); cena `'world'` com campos `player`, `dialog`, `busy` (privados no TS, acessíveis em JS).

- [ ] **Step 1: Subir o servidor**

Run (em segundo plano): `npm run dev -- --port 5173 --strictPort`

- [ ] **Step 2: Roteiro com o Playwright (MCP)**

Executar com as ferramentas `browser_*` do Playwright:

1. `browser_navigate` para `http://localhost:5173`, depois `browser_evaluate`: `localStorage.clear(); location.reload()`.
2. `browser_click` em "Jogar ▶". Esperar 1 s.
3. `browser_evaluate`: `(() => { const w = game.scene.getScene('world'); return { x: w.player.x, y: w.player.y }; })()`. Guardar como A.
4. `browser_press_key` Enter, depois digitar `wasd ezmc` (`browser_type` no campo `#say-input`) e `browser_press_key` Enter.
5. `browser_evaluate` de novo. **Esperado:** posição igual a A, `game.sound.mute === false`, `#creator` oculto e `#balloon` visível com "wasd ezmc".
6. Segurar `ArrowUp` por 400 ms (`browser_press_key` repetido) até o "Z" aparecer sobre o professor; `browser_press_key` z três vezes. **Esperado:** `#dialog` visível e depois oculto; `game.scene.getScene('world').dialog === null` no fim.
7. `browser_take_screenshot` da página inteira em `.playwright-mcp/biogame-lab.png`.
8. Teleportar até o corredor: `browser_evaluate` `game.scene.getScene('world').scene.restart({ map: 'cb-corredor', entry: 'porta-lab' })`; esperar 500 ms; screenshot `.playwright-mcp/biogame-corredor.png`.
9. Mapa inexistente: `browser_evaluate` `game.scene.getScene('world').scene.restart({ map: 'nao-existe', entry: 'default', prev: { map: 'cb-lab', entry: 'default' } })`; esperar 2 s. **Esperado:** banner `Mapa "nao-existe" não encontrado` e volta ao laboratório.
10. `browser_console_messages` (nível warning). **Esperado:** nenhum `[areas]`; um único `[world] Mapa "nao-existe" não encontrado`, acompanhado do erro do Phaser `Failed to process file … map:nao-existe` e de um `SyntaxError` de JSON (em dev o Vite devolve o `index.html` para arquivo inexistente). O aviso do navegador sobre `allow-scripts` + `allow-same-origin` no iframe é esperado: o sandbox fica de propósito, sem `allow-top-navigation`, para que um site aberto no painel não consiga tirar o jogador da página.

- [ ] **Step 3: Comparar com a referência**

Abrir lado a lado `.playwright-mcp/biogame-lab.png` e `docs/superpowers/specs/2026-10-08-biogame-referencia-visual.jpg`. Conferir: piso claro em grade, paredes bege com faixa, bancadas brancas com frente azul, equipamentos sobre as bancadas, NPC de jaleco/idoso no topo, caixa de diálogo de borda dupla. Se algum tile do LimeZu escolhido destoar (ex.: a parede da linha 14/15 não ser a bege com faixa), ajustar só a constante em `tools/maps.ts` (`floorGid` ou `wallId`), rodar `npm run maps -- --force`, `npm test` e repetir o Step 2.

- [ ] **Step 4: Checagem final**

Run: `npm test && npm run build`
Expected: tudo passa.

Run: `git status --short`
Expected: nenhum arquivo de `vendor/`, `public/sprites/` ou `public/tilesets/limezu-*` listado.

Run: `grep -rn "TODO\|FIXME\|test.skip\|\.only(" src tools`
Expected: nada.

- [ ] **Step 5: Commit (se houve ajuste)**

```bash
git add -A
git commit -m "fix: ajustes da verificação ponta a ponta do laboratório

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```
