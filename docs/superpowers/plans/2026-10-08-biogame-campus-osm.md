# Biogame: Campus do OpenStreetMap (Plano 2 de 3) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** O Campus Central da UFRN inteiro, gerado do OpenStreetMap em 22 setores de 160×160 tiles com a arte do LimeZu (gramado, calçadas, ruas, estacionamentos com carros de lado, árvores, telhados), ligados entre si pelas bordas e à porta do corredor do CB, com placas visíveis (prédios com nome e pontos de interesse, como o Museu do Carro da ECT), minimapa do setor e créditos do OpenStreetMap.

**Architecture:** Pipeline offline em `tools/`: `osm-data.ts` baixa o OSM e grava um recorte em metros (`tools/data/campus.json`, versionado); `grid.ts` rasteriza em células de 2 m; `campus.ts` corta a grade em setores e monta cada um como `.tmj` só com camadas `osm-*`; `mergeOsmLayers` aplica a regra de ouro (regerar nunca apaga o que foi feito à mão no Tiled); `vendor.ts` monta um atlas único `limezu-campus.png` (fora do git) com os autotiles "blob" do Godot, carros, árvores, enfeites e a placa. No jogo, a cena `World` passa a carregar os tilesets pelo nome, sob demanda, lê as áreas de `areas` + `osm-areas` e mostra o minimapa.

**Tech Stack:** o mesmo do Plano 1: Node 26 (roda `.ts` direto), TypeScript 7.0.2, Vite 8.3.4, Phaser 4.2.1, Tiled (`.tmj`). Dados da API 0.6 do OpenStreetMap. Nenhuma dependência nova.

**Spec:** `docs/superpowers/specs/2026-10-08-biogame-mapa-design.md` (com a referência visual `2026-10-08-biogame-referencia-visual.jpg`).

**Origem do código:** todo o código abaixo foi escrito e validado num protótipo antes deste plano:

- 65 testes; `tsc` e build limpos.
- Jogado no navegador a 60 FPS com ~90 MB de heap.
- O usuário aprovou o visual, incluindo os carros de lado e a placa do Museu do Carro.

Os valores (larguras de via, sementes do hash, posições no atlas) foram calibrados olhando o resultado e devem ser copiados como estão.

**Plano seguinte (fora deste):** Plano 3, com as fachadas caprichadas dos prédios sobre as pegadas `osm-terreno` e a identidade da UFRN (brasão, placas, letreiros). Também ficam para depois: as portas dos outros prédios ("em breve") e a tela de "em breve".

## Global Constraints

- Dependência de runtime única: `phaser@4.2.1`. Dev: `typescript@7.0.2`, `vite@8.3.4`, `@types/node`. Nada mais (o decodificador de PNG é próprio, com `node:zlib`).
- Testes com `node --test` (sem framework), em `*.test.ts` ao lado do código. Nomes de teste em inglês; comentários, mensagens de erro e textos do jogo em português (como no código existente).
- Imports relativos sempre com extensão `.ts`; tipos com `import type`. Sintaxe TS só "apagável" (`erasableSyntaxOnly`): sem `enum`, `namespace` ou parameter properties.
- Tiles de **16×16**, câmera com **zoom 3×**, `pixelArt: true`.
- Arquivos derivados de assets comprados (LimeZu, PixelSerial) **nunca** vão para o git: `vendor/`, `public/tilesets/limezu-*` (inclui o novo `limezu-campus.png`), `public/sprites/`.
- Versionados (gerados, sem asset comprado): `tools/data/campus.json`, `public/maps/campus-*.tmj`, `public/maps/campus-*.mini.png`.
- **Nenhum asset da Nintendo.** Só o estilo GBA da referência.
- OpenStreetMap:
  - crédito "dados © colaboradores do OpenStreetMap (ODbL)" na tela de créditos;
  - dados da API principal `https://api.openstreetmap.org/api/0.6`, com `User-Agent` identificando o jogo;
  - Overpass não: estava instável no protótipo.
- Escala: **2 m por tile** (`METERS_PER_TILE = 2`).
- Setores de **160×160** tiles (`SECTOR = 160`), nomeados `campus-<coluna>-<linha>`.
- **Regra de ouro:** o gerador só escreve camadas com prefixo `osm-`:
  - camadas de tiles: `osm-chao`, `osm-calcada`, `osm-grama`, `osm-terreno`, `osm-detalhes`, `osm-objetos` e `osm-copas` (`above: true`);
  - camada de objetos: `osm-areas`.
  - Regerar preserva camadas, áreas, tilesets e propriedades feitos à mão.
- Convenção do Tiled da spec:
  - Classes `entry`, `door`, `sign`, `npc`, `website`, `sound`, lidas das camadas de objetos `areas` (à mão) **e** `osm-areas` (gerada);
  - todo mapa tem entry `default` e propriedade `name`;
  - os setores também têm a propriedade `minimap`.
- Erros de mapa viram `console.warn` com prefixo `[areas]` e o jogo continua.
- Caminhos de assets no código são relativos (sem `/` inicial), porque o build usa `--base ./`.
- Nunca parar nem usar o servidor de desenvolvimento do usuário. Para conferir no navegador, subir outro: `npx vite --port 5198 --strictPort`.
- Commits terminam com `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

## Review Focus

1. **Atravessar a borda entre setores** (correndo, na diagonal, no canto onde duas bordas se encontram). O esperado:
   - o mapa troca uma vez só;
   - o jogador chega do outro lado na mesma altura;
   - nunca nasce dentro de parede nem em cima de outra porta.

   Fixado em três tarefas:
   - Task 7: em `edgeLinks`, a entrada fica 2 tiles para dentro, as pontas têm 2 tiles de margem e o trecho precisa ser andável dos dois lados.
   - Task 9: o lint dos 22 setores publicados (nenhuma entrada dentro de porta; toda porta aponta para entrada que existe).
   - Task 10: `go()` ignora a segunda porta no mesmo quadro.
2. **Regerar o campus depois de editar um setor no Tiled** (camada nova, áreas novas, tileset novo, propriedade nova). Nada manual some. Um tileset manual com `firstgid` sobreposto ao gerado dá erro claro em vez de corromper o mapa. Fixado em Task 8.
3. **Clone sem os assets comprados** (sem `public/tilesets/limezu-campus.png`). O campus abre com o aviso `[areas] tileset "limezu-campus" não encontrado`; o chão fica escuro, mas o jogador e o minimapa aparecem e nada trava. Conferido no protótipo; a Task 10 repete no navegador, interceptando o PNG.
4. **Ponto de interesse que cai dentro de um prédio ou fora do campus.** A placa vai para a célula andável mais próxima; fora do campus dá o aviso `[osm] ponto "<nome>" fora do campus` e a geração segue. Fixado em Task 7 (teste do ponto no meio de um prédio) e Task 9 (aviso no `osm.ts`).
5. **Carros e árvores tapando passagens.** Nenhum carro ou árvore cobre uma porta, uma entrada ou o tile em volta delas (inclusive o degrau entre a porta da borda e a entrada). O poste da placa bloqueia só a própria célula, e dá para falar com ela chegando por baixo. Fixado em Task 7 (teste do estacionamento sobre a divisa; teste do pé da placa) e Task 10 (navegador: falar com a placa do museu).

---

## Estrutura de arquivos

```
tools/
  png.ts            + decodePng (RGBA 8 bits)                  png.test.ts (+3 testes)
  pix.ts            + blit                                      pix.test.ts (novo)
  blob.ts           tabela do autotile blob 47 (layout Godot)   blob.test.ts
  campus-atlas.ts   layout da folha limezu-campus.png           campus-atlas.test.ts
  vendor.ts         + buildCampusAtlas()
  osm-data.ts       baixa o OSM e grava tools/data/campus.json  osm-data.test.ts
  data/campus.json  recorte do campus em metros (versionado)
  data/pontos.json  pontos de interesse escritos à mão (lat/lon → placa)
  grid.ts           rasteriza o recorte em células de 2 m       grid.test.ts
  tiled.ts          montagem do .tmj (extraída do maps.ts)
  campus.ts         setores, passagens, montagem do setor, merge  campus.test.ts
  osm.ts            CLI: gera public/maps/campus-*.tmj + .mini.png
  maps.ts           usa tiled.ts; corredor ganha a porta para o campus
src/
  areas.ts          + areaObjects (areas + osm-areas)          areas.test.ts (+1)
  world.ts          tilesets sob demanda, minimapa, osm-areas, textura antiga removida
  ui.ts             + showMinimap, moveMinimapDot
  main.ts           sem a lista fixa de tilesets
  style.css, index.html   minimapa + créditos OSM/Exteriors
public/maps/        campus-*.tmj e campus-*.mini.png (gerados, versionados), cb-corredor.tmj regerado
```

---

### Task 1: Ler PNG e copiar retângulos

O atlas do campus é montado a partir dos PNGs do Modern Exteriors; para isso, `tools/` precisa ler PNG (hoje só escreve) e copiar retângulos de uma imagem para a "tela" `Pix`.

**Files:**
- Modify: `tools/png.ts`, `tools/png.test.ts`, `tools/pix.ts`
- Create: `tools/pix.test.ts`

**Interfaces:**
- Produces: `export type RgbaImage = { width: number; height: number; data: Uint8Array }` e `export function decodePng(buf: Buffer): RgbaImage` em `tools/png.ts`; método `Pix.blit(src: RgbaImage, sx: number, sy: number, w: number, h: number, dx: number, dy: number): void` em `tools/pix.ts`.

- [ ] **Step 1: Escrever os testes que falham**

Aplicar em `tools/png.test.ts`:

```diff
diff --git a/tools/png.test.ts b/tools/png.test.ts
index 98b81aa..8b2b043 100644
--- a/tools/png.test.ts
+++ b/tools/png.test.ts
@@ -1,7 +1,7 @@
 import { test } from 'node:test';
 import assert from 'node:assert/strict';
-import { inflateSync } from 'node:zlib';
-import { encodePng } from './png.ts';
+import { crc32, deflateSync, inflateSync } from 'node:zlib';
+import { decodePng, encodePng } from './png.ts';
 
 test('writes signature, IHDR with size and RGBA, and a valid IEND', () => {
   const png = encodePng(2, 1, new Uint8Array([255, 0, 0, 255, 0, 0, 255, 128]));
@@ -26,3 +26,47 @@ test('pixel rows survive deflate with filter byte 0', () => {
 test('rejects a buffer of the wrong size', () => {
   assert.throws(() => encodePng(2, 2, new Uint8Array(4)), /esperava 16 bytes/);
 });
+
+test('decodePng reads back what encodePng wrote', () => {
+  const rgba = new Uint8Array(3 * 2 * 4).map((_, i) => (i * 37) & 255);
+  const img = decodePng(encodePng(3, 2, rgba));
+  assert.equal(img.width, 3);
+  assert.equal(img.height, 2);
+  assert.deepEqual([...img.data], [...rgba]);
+});
+
+test('decodePng undoes the Sub, Up, Average and Paeth filters', () => {
+  const w = 2, h = 5, stride = w * 4;
+  const rgba = new Uint8Array(w * h * 4).map((_, i) => (i * 53 + 7) & 255);
+  const px = (x: number, y: number) => (x < 0 || y < 0 ? 0 : rgba[y * stride + x]);
+  const raw: number[] = [];
+  for (let y = 0; y < h; y++) {
+    const f = y; // filtros 0..4, um por linha
+    raw.push(f);
+    for (let x = 0; x < stride; x++) {
+      const a = px(x - 4, y), b = px(x, y - 1), c = px(x - 4, y - 1), v = rgba[y * stride + x];
+      const p = a + b - c, pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c);
+      const pred = [0, a, b, (a + b) >> 1, pa <= pb && pa <= pc ? a : pb <= pc ? b : c][f];
+      raw.push((v - pred) & 255);
+    }
+  }
+  const png = encodePng(w, h, rgba);
+  const idatLen = png.readUInt32BE(33);
+  const crafted = Buffer.concat([png.subarray(0, 33), chunkFor('IDAT', deflateSync(Buffer.from(raw))), png.subarray(33 + 12 + idatLen)]);
+  assert.deepEqual([...decodePng(crafted).data], [...rgba]);
+});
+
+test('decodePng rejects formats it does not handle', () => {
+  const png = encodePng(1, 1, new Uint8Array(4));
+  png[25] = 2; // tipo de cor RGB
+  assert.throws(() => decodePng(png), /não suportado/);
+});
+
+function chunkFor(type: string, data: Buffer): Buffer {
+  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
+  const len = Buffer.alloc(4);
+  len.writeUInt32BE(data.length);
+  const crc = Buffer.alloc(4);
+  crc.writeUInt32BE(crc32(body));
+  return Buffer.concat([len, body, crc]);
+}
```

Criar `tools/pix.test.ts`:

```ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Pix } from './pix.ts';

test('blit copies a rectangle of another image and clips at the edges of both', () => {
  // origem 3×2 com o índice do pixel no canal vermelho
  const src = { width: 3, height: 2, data: new Uint8Array(3 * 2 * 4).map((_, i) => (i % 4 === 0 ? i / 4 + 1 : 255)) };
  const dst = new Pix(4, 3);
  dst.blit(src, 1, 0, 2, 2, 0, 1); // pixels 2,3 / 5,6 em (0,1)
  dst.blit(src, 0, 0, 3, 2, 3, 2); // sobra para fora: só o pixel 1 cabe, em (3,2)
  const red = (x: number, y: number) => dst.data[(y * 4 + x) * 4];
  assert.deepEqual([red(0, 1), red(1, 1), red(0, 2), red(1, 2)], [2, 3, 5, 6]);
  assert.equal(red(3, 2), 1);
  assert.equal(red(2, 1), 0, 'fora do retângulo fica intacto');
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `node --test tools/png.test.ts tools/pix.test.ts`
Expected: FAIL (`decodePng` não exportado; `dst.blit is not a function`).

- [ ] **Step 3: Implementar**

Aplicar em `tools/png.ts`:

```diff
diff --git a/tools/png.ts b/tools/png.ts
index b2965a0..dd99e2f 100644
--- a/tools/png.ts
+++ b/tools/png.ts
@@ -1,4 +1,6 @@
-import { crc32, deflateSync } from 'node:zlib';
+import { crc32, deflateSync, inflateSync } from 'node:zlib';
+
+export type RgbaImage = { width: number; height: number; data: Uint8Array };
 
 function chunk(type: string, data: Buffer): Buffer {
   const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
@@ -27,3 +29,37 @@ export function encodePng(width: number, height: number, rgba: Uint8Array): Buff
     chunk('IEND', Buffer.alloc(0)),
   ]);
 }
+
+/** Lê PNG RGBA de 8 bits sem entrelaçamento (o formato de todos os PNGs do LimeZu) e desfaz os 5 filtros. */
+export function decodePng(buf: Buffer): RgbaImage {
+  if (buf.readUInt32BE(0) !== 0x89504e47) throw new Error('não é um PNG');
+  let pos = 8, width = 0, height = 0;
+  const idat: Buffer[] = [];
+  while (pos < buf.length) {
+    const len = buf.readUInt32BE(pos), type = buf.toString('ascii', pos + 4, pos + 8), data = buf.subarray(pos + 8, pos + 8 + len);
+    if (type === 'IHDR') {
+      width = data.readUInt32BE(0);
+      height = data.readUInt32BE(4);
+      if (data[8] !== 8 || data[9] !== 6 || data[12] !== 0) throw new Error(`PNG não suportado: profundidade ${data[8]}, tipo ${data[9]}, entrelaçado ${data[12]} (só RGBA 8 bits)`);
+    } else if (type === 'IDAT') idat.push(data);
+    else if (type === 'IEND') break;
+    pos += 12 + len;
+  }
+  const raw = inflateSync(Buffer.concat(idat)), stride = width * 4, out = new Uint8Array(stride * height);
+  for (let y = 0; y < height; y++) {
+    const filter = raw[y * (stride + 1)], line = y * (stride + 1) + 1, o = y * stride;
+    for (let x = 0; x < stride; x++) {
+      const a = x >= 4 ? out[o + x - 4] : 0, b = y > 0 ? out[o - stride + x] : 0, c = x >= 4 && y > 0 ? out[o - stride + x - 4] : 0;
+      let v = raw[line + x];
+      if (filter === 1) v += a;
+      else if (filter === 2) v += b;
+      else if (filter === 3) v += (a + b) >> 1;
+      else if (filter === 4) {
+        const p = a + b - c, pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c);
+        v += pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
+      }
+      out[o + x] = v & 255;
+    }
+  }
+  return { width, height, data: out };
+}
```

Aplicar em `tools/pix.ts`:

```diff
diff --git a/tools/pix.ts b/tools/pix.ts
index c565a65..cb98e28 100644
--- a/tools/pix.ts
+++ b/tools/pix.ts
@@ -1,4 +1,4 @@
-import { encodePng } from './png.ts';
+import { encodePng, type RgbaImage } from './png.ts';
 
 const parse = (hex: string): number[] => {
   const h = hex.replace('#', '');
@@ -40,6 +40,15 @@ export class Pix {
     for (const [x, y] of edge) this.px(x, y, hex);
   }
 
+  /** Copia um retângulo de uma imagem (sem misturar alpha). */
+  blit(src: RgbaImage, sx: number, sy: number, w: number, h: number, dx: number, dy: number): void {
+    for (let j = 0; j < h; j++) {
+      if (sy + j >= src.height || dy + j >= this.h) break;
+      const from = ((sy + j) * src.width + sx) * 4;
+      this.data.set(src.data.subarray(from, from + Math.min(w, src.width - sx, this.w - dx) * 4), ((dy + j) * this.w + dx) * 4);
+    }
+  }
+
   png(): Buffer {
     return encodePng(this.w, this.h, this.data);
   }
```

- [ ] **Step 4: Rodar e ver passar**

Run: `node --test tools/png.test.ts tools/pix.test.ts && npx tsc --noEmit`
Expected: PASS (7 testes), tsc sem erros.

- [ ] **Step 5: Commit**

```bash
git add tools/png.ts tools/png.test.ts tools/pix.ts tools/pix.test.ts
git commit -m "feat(tools): decodePng e Pix.blit para montar atlas a partir dos PNGs do LimeZu

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 2: Tabela do autotile blob

Os `Godot_Autotiles_16x16.png` do Modern Exteriors trazem 26 blocos de 12×4 tiles no layout Godot "3x3 minimal" (47 formas). A tabela abaixo foi medida nos pixels do autotile #5. A célula (10,1) do bloco não é usada; (9,2) é o "miolo" cheio.

**Files:**
- Create: `tools/blob.ts`, `tools/blob.test.ts`

**Interfaces:**
- Produces: constantes de bits `N=1, NE=2, E=4, SE=8, S=16, SW=32, W=64, NW=128`; `GODOT_BLOB: Record<number, [number, number]>` (máscara normalizada → [coluna, linha] no bloco 12×4); `blobMask(is: (dx: number, dy: number) => boolean): number` (canto só conta se as duas bordas que o formam contam).

- [ ] **Step 1: Escrever o teste que falha**

Criar `tools/blob.test.ts`:

```ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { blobMask, E, GODOT_BLOB, N, NE, S, W } from './blob.ts';

test('every one of the 256 neighbour combinations maps to a cell of the 12×4 block', () => {
  for (let bits = 0; bits < 256; bits++) {
    const dirs = [[0, -1], [1, -1], [1, 0], [1, 1], [0, 1], [-1, 1], [-1, 0], [-1, -1]];
    const m = blobMask((dx, dy) => (bits >> dirs.findIndex(([x, y]) => x === dx && y === dy)) & 1 ? true : false);
    const cell = GODOT_BLOB[m];
    assert.ok(cell, `máscara ${m} (bits ${bits}) sem célula`);
    assert.ok(cell[0] >= 0 && cell[0] < 12 && cell[1] >= 0 && cell[1] < 4);
  }
});

test('the table has the 47 blob shapes, each in its own cell, never the unused cell (10,1)', () => {
  const cells = Object.values(GODOT_BLOB).map(([c, r]) => `${c},${r}`);
  assert.equal(cells.length, 47);
  assert.equal(new Set(cells).size, 47);
  assert.ok(!cells.includes('10,1'));
});

test('a corner only counts when both edges that form it are set', () => {
  assert.equal(blobMask((dx, dy) => dx === 1 && dy === -1), 0);
  assert.equal(blobMask((dx, dy) => (dx === 0 && dy === -1) || (dx === 1 && dy === -1)), N);
  assert.equal(blobMask((dx, dy) => (dx === 0 && dy === -1) || (dx === 1 && dy === 0) || (dx === 1 && dy === -1)), N | E | NE);
  assert.equal(blobMask(() => true), 255);
  assert.equal(blobMask((dx, dy) => dy === 0), E | W);
  assert.equal(blobMask((dx) => dx === 0), N | S);
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `node --test tools/blob.test.ts`
Expected: FAIL (`Cannot find module './blob.ts'`).

- [ ] **Step 3: Implementar**

Criar `tools/blob.ts`:

```ts
// Autotile "blob" de 47 peças no layout Godot 3x3 minimal (bloco 12×4), o formato dos
// Godot_Autotiles do Modern Exteriors. Bits = vizinhos que também são do terreno.
export const N = 1, NE = 2, E = 4, SE = 8, S = 16, SW = 32, W = 64, NW = 128;

/** Máscara normalizada → [coluna, linha] dentro do bloco 12×4 (medido nos pixels do autotile #5). */
export const GODOT_BLOB: Record<number, [number, number]> = {
  0: [0, 3], 1: [0, 2], 4: [1, 3], 5: [1, 2], 7: [8, 3], 16: [0, 0], 17: [0, 1], 20: [1, 0], 21: [1, 1], 23: [4, 2],
  28: [8, 0], 29: [4, 1], 31: [8, 1], 64: [3, 3], 65: [3, 2], 68: [2, 3], 69: [2, 2], 71: [5, 3], 80: [3, 0], 81: [3, 1],
  84: [2, 0], 85: [2, 1], 87: [7, 0], 92: [5, 0], 93: [7, 3], 95: [8, 2], 112: [11, 0], 113: [7, 1], 116: [6, 0], 117: [4, 3],
  119: [9, 1], 124: [10, 0], 125: [9, 0], 127: [5, 1], 193: [11, 3], 197: [6, 3], 199: [9, 3], 209: [7, 2], 213: [4, 0], 215: [10, 3],
  221: [10, 2], 223: [5, 2], 241: [11, 2], 245: [11, 1], 247: [6, 2], 253: [6, 1], 255: [9, 2],
};

/** Máscara dos 8 vizinhos; um canto só conta se as duas bordas que o formam também são do terreno. */
export function blobMask(is: (dx: number, dy: number) => boolean): number {
  let m = 0;
  if (is(0, -1)) m |= N;
  if (is(1, 0)) m |= E;
  if (is(0, 1)) m |= S;
  if (is(-1, 0)) m |= W;
  if (m & N && m & E && is(1, -1)) m |= NE;
  if (m & S && m & E && is(1, 1)) m |= SE;
  if (m & S && m & W && is(-1, 1)) m |= SW;
  if (m & N && m & W && is(-1, -1)) m |= NW;
  return m;
}
```

- [ ] **Step 4: Rodar e ver passar**

Run: `node --test tools/blob.test.ts`
Expected: PASS (3 testes).

- [ ] **Step 5: Commit**

```bash
git add tools/blob.ts tools/blob.test.ts
git commit -m "feat(tools): tabela do autotile blob de 47 peças no layout Godot

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 3: Atlas do campus

Uma folha só, `public/tilesets/limezu-campus.png` (32×24 tiles = 512×384 px), com tudo o que o gerador usa. É montada pelo `npm run vendor` a partir de `vendor/` e fica fora do git (padrão `public/tilesets/limezu-*` do `.gitignore`).

Ela contém:

- 6 blocos blob: gramado #5, calçada #20, estacionamento #24, telhado #19, mata #11 e água #2;
- 2 tiles lisos: grama e asfalto;
- carros 1–6 de lado, nas duas direções;
- 8 árvores de rua;
- 11 enfeites de gramado: 6 tufos e 5 flores (os `Props_Grass` 3–7 são terra e ficam de fora);
- a placa de informação.

**Files:**
- Create: `tools/campus-atlas.ts`, `tools/campus-atlas.test.ts`
- Modify: `tools/vendor.ts`

**Interfaces:**
- Consumes: `decodePng`, `RgbaImage` (Task 1), `Pix.blit` (Task 1).
- Produces, em `tools/campus-atlas.ts`:
  - `ATLAS_COLS = 32`, `ATLAS_ROWS = 24`;
  - `type BlobName = 'grass' | 'sidewalk' | 'parking' | 'roof' | 'forest' | 'water'`, `BLOB_SOURCE`, `BLOB_AT`;
  - `PLAIN.grass`, `PLAIN.asphalt`;
  - `type Stamp = { at: [number, number]; w: number; h: number }`;
  - `CAR_IDS`, `CARS_LEFT`, `CARS_RIGHT` (4×3);
  - `TREE_SPECS`, `TREES`;
  - `DECOR_TUFTS = 6`, `DECOR_FILES`, `DECOR`;
  - `SIGN_FILE`, `SIGN` (1×2);
  - `atlasId(col, row) = row * 32 + col`.

- [ ] **Step 1: Escrever o teste que falha**

Criar `tools/campus-atlas.test.ts`:

```ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ATLAS_COLS, ATLAS_ROWS, atlasId, BLOB_AT, CARS_LEFT, CARS_RIGHT, DECOR, DECOR_FILES, PLAIN, SIGN, TREES, type Stamp } from './campus-atlas.ts';

test('every piece of the campus atlas fits the sheet and none overlaps another', () => {
  const pieces: Stamp[] = [
    ...Object.values(BLOB_AT).map(at => ({ at, w: 12, h: 4 })),
    ...Object.values(PLAIN).map(p => ({ at: [p.at[0], p.at[1]] as [number, number], w: 1, h: 1 })),
    ...CARS_LEFT, ...CARS_RIGHT, ...TREES, ...DECOR, SIGN,
  ];
  const owner = new Map<number, number>();
  pieces.forEach((p, n) => {
    for (let r = 0; r < p.h; r++) for (let c = 0; c < p.w; c++) {
      const [x, y] = [p.at[0] + c, p.at[1] + r];
      assert.ok(x < ATLAS_COLS && y < ATLAS_ROWS, `peça ${n} sai da folha em (${x},${y})`);
      assert.ok(!owner.has(atlasId(x, y)), `peças ${owner.get(atlasId(x, y))} e ${n} se sobrepõem em (${x},${y})`);
      owner.set(atlasId(x, y), n);
    }
  });
  assert.equal(DECOR.length, DECOR_FILES.length);
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `node --test tools/campus-atlas.test.ts`
Expected: FAIL (`Cannot find module './campus-atlas.ts'`).

- [ ] **Step 3: Implementar o layout**

Criar `tools/campus-atlas.ts`:

```ts
// Layout da folha public/tilesets/limezu-campus.png (montada pelo vendor.ts a partir do Modern
// Exteriors). Em tiles de 16×16; 32 colunas.
export const ATLAS_COLS = 32;
export const ATLAS_ROWS = 24;

export type BlobName = 'grass' | 'sidewalk' | 'parking' | 'roof' | 'forest' | 'water';
/** Índice do bloco 12×4 dentro de Godot_Autotiles_16x16.png. */
export const BLOB_SOURCE: Record<BlobName, number> = { grass: 5, sidewalk: 20, parking: 24, roof: 19, forest: 11, water: 2 };
/** Canto superior esquerdo [coluna, linha] de cada bloco na folha. */
export const BLOB_AT: Record<BlobName, [number, number]> = {
  grass: [0, 0], sidewalk: [12, 0], parking: [0, 4], roof: [12, 4], forest: [0, 8], water: [12, 8],
};
/** Tiles lisos: [coluna, linha] na folha e de onde vêm. */
export const PLAIN = {
  grass: { at: [24, 0], sheet: '1_Terrains_and_Fences_16x16.png', from: [19, 8] },
  asphalt: { at: [25, 0], sheet: '2_City_Terrains_16x16.png', from: [0, 5] },
} as const;

export type Stamp = { at: [number, number]; w: number; h: number };
/** Carros vistos de cima, sempre de lado (sprite 64×48 = 4×3 tiles): frente para a esquerda (linha 12) e para a direita (linha 15). */
export const CAR_IDS = [1, 2, 3, 4, 5, 6];
export const CARS_LEFT: Stamp[] = CAR_IDS.map((_, i) => ({ at: [i * 4, 12], w: 4, h: 3 }));
export const CARS_RIGHT: Stamp[] = CAR_IDS.map((_, i) => ({ at: [i * 4, 15], w: 4, h: 3 }));
/** Árvores de rua sem vaso (City_Props Tree_N), com o tamanho do sprite em tiles. */
export const TREE_SPECS = [
  { id: 1, w: 2, h: 3 }, { id: 2, w: 2, h: 3 }, { id: 3, w: 2, h: 3 }, { id: 4, w: 2, h: 3 },
  { id: 5, w: 2, h: 4 }, { id: 6, w: 2, h: 4 }, { id: 11, w: 3, h: 4 }, { id: 12, w: 3, h: 4 },
];
export const TREES: Stamp[] = TREE_SPECS.reduce<Stamp[]>((acc, t) => {
  const x = acc.length ? acc[acc.length - 1].at[0] + acc[acc.length - 1].w : 0;
  return [...acc, { at: [x, 18], w: t.w, h: t.h }];
}, []);

/** Enfeites de 1 tile para o gramado (Complete_Singles): 6 tufos de grama e 5 flores pequenas (os Props_Grass 3-7 são terra). */
export const DECOR_TUFTS = 6;
export const DECOR_FILES = [
  ...[1, 2, 8, 9, 10, 11].map(n => `ME_Singles_Terrains_and_Fences_16x16_Props_Grass_${n}.png`),
  ...['Light_Blue', 'Pink', 'Red', 'White', 'Yellow'].map(c => `ME_Singles_Garden_16x16_Small_${c}_Flower.png`),
];
export const DECOR: Stamp[] = DECOR_FILES.map((_, i) => ({ at: [i, 22], w: 1, h: 1 }));
/** Placa de informação (City_Props Info_Sign_2, 16×32) que marca placas de prédio e pontos de interesse. */
export const SIGN_FILE = 'ME_Singles_City_Props_16x16_Info_Sign_2.png';
export const SIGN: Stamp = { at: [DECOR_FILES.length, 22], w: 1, h: 2 };

export const atlasId = (col: number, row: number): number => row * ATLAS_COLS + col;
```

- [ ] **Step 4: Rodar e ver passar**

Run: `node --test tools/campus-atlas.test.ts`
Expected: PASS.

- [ ] **Step 5: Montar a folha no vendor**

Aplicar em `tools/vendor.ts` (cada carimbo confere o tamanho do PNG e lança erro se não bater, então um arquivo trocado no pacote não passa calado):

```diff
diff --git a/tools/vendor.ts b/tools/vendor.ts
index eac363c..ff8323a 100644
--- a/tools/vendor.ts
+++ b/tools/vendor.ts
@@ -1,10 +1,14 @@
-import { cpSync, existsSync, mkdirSync, readdirSync, writeFileSync } from 'node:fs';
+import { cpSync, existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
 import { join } from 'node:path';
 import { PART_DIRS, PART_KINDS, type PartKind, type Parts } from '../src/character.ts';
+import { ATLAS_COLS, ATLAS_ROWS, BLOB_AT, BLOB_SOURCE, CAR_IDS, CARS_LEFT, CARS_RIGHT, DECOR, DECOR_FILES, PLAIN, SIGN, SIGN_FILE, TREE_SPECS, TREES, type BlobName, type Stamp } from './campus-atlas.ts';
+import { Pix } from './pix.ts';
+import { decodePng } from './png.ts';
 
 const X = 'vendor/x';
 const CG = `${X}/moderninteriors-win/2_Characters/Character_Generator`;
 const ROOM = `${X}/moderninteriors-win/1_Interiors/16x16/Room_Builder_subfiles`;
+const EXT = `${X}/modernexteriors-win/Modern_Exteriors_16x16`;
 const PS = `${X}/RPG_Top_Down_Character_Asset_Pack_-_FULL/RPG Top Down Characters - Full version`;
 const CG_DIRS: Record<PartKind, string> = { body: 'Bodies', eyes: 'Eyes', outfit: 'Outfits', hair: 'Hairstyles', acc: 'Accessories' };
 
@@ -36,7 +40,32 @@ function main(): void {
     cpSync(join(PS, dir, sheet), `public/sprites/npc/${key}.png`);
   }
   writeFileSync('public/sprites/npc/manifest.json', JSON.stringify(npcs));
+  buildCampusAtlas();
   console.log(`ok: ${PART_KINDS.map(k => `${k}=${parts[k].length}`).join(' ')} npcs=${npcs.length}`);
 }
 
+/** Monta public/tilesets/limezu-campus.png com só o que o gerador do campus usa, no layout de campus-atlas.ts. */
+function buildCampusAtlas(): void {
+  const atlas = new Pix(ATLAS_COLS * 16, ATLAS_ROWS * 16);
+  const png = (path: string) => decodePng(readFileSync(path));
+  const godot = png(`${EXT}/Autotiles_16x16/Godot_Autotiles_16x16.png`);
+  for (const b of Object.keys(BLOB_AT) as BlobName[]) atlas.blit(godot, 0, BLOB_SOURCE[b] * 64, 192, 64, BLOB_AT[b][0] * 16, BLOB_AT[b][1] * 16);
+  for (const t of Object.values(PLAIN)) atlas.blit(png(`${EXT}/ME_Theme_Sorter_16x16/${t.sheet}`), t.from[0] * 16, t.from[1] * 16, 16, 16, t.at[0] * 16, t.at[1] * 16);
+  const stamp = (path: string, s: Stamp) => {
+    const img = png(path);
+    if (img.width !== s.w * 16 || img.height !== s.h * 16) throw new Error(`${path}: esperava ${s.w * 16}×${s.h * 16}, veio ${img.width}×${img.height}`);
+    atlas.blit(img, 0, 0, img.width, img.height, s.at[0] * 16, s.at[1] * 16);
+  };
+  const cars = `${EXT}/ME_Theme_Sorter_16x16/10_Vehicles_Singles_16x16/ME_Singles_Vehicles_16x16_Car`;
+  CAR_IDS.forEach((id, i) => {
+    stamp(`${cars}_Left_${id}.png`, CARS_LEFT[i]);
+    stamp(`${cars}_Right_${id}.png`, CARS_RIGHT[i]);
+  });
+  const singles = `${EXT}/Modern_Exteriors_Complete_Singles_16x16`;
+  TREE_SPECS.forEach((t, i) => stamp(`${singles}/ME_Singles_City_Props_16x16_Tree_${t.id}.png`, TREES[i]));
+  DECOR_FILES.forEach((f, i) => stamp(`${singles}/${f}`, DECOR[i]));
+  stamp(`${singles}/${SIGN_FILE}`, SIGN);
+  writeFileSync('public/tilesets/limezu-campus.png', atlas.png());
+}
+
 if (import.meta.main) main();
```

- [ ] **Step 6: Gerar e conferir a folha**

Run: `npm run vendor && file public/tilesets/limezu-campus.png && git status --short public/tilesets`
Expected: `ok: body=9 eyes=7 outfit=132 hair=200 acc=84 npcs=29`, depois `PNG image data, 512 x 384, 8-bit/color RGBA`, e **nenhuma** linha do `git status` (o PNG é ignorado). Abrir a imagem e conferir:

- na faixa de cima, os 6 blocos blob;
- no meio, 6 carros virados para a esquerda e 6 para a direita;
- abaixo, as 8 árvores;
- na última faixa, os 11 enfeites e a placa.

- [ ] **Step 7: Commit**

```bash
git add tools/campus-atlas.ts tools/campus-atlas.test.ts tools/vendor.ts
git commit -m "feat(tools): atlas limezu-campus com autotiles, carros, árvores, enfeites e placa

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 4: Recorte do OpenStreetMap

Baixa a relação 1715536 ("UFRN - Campus Central") e tudo dentro de uma caixa um pouco maior, recorta ao contorno do campus e grava em metros a partir do centro (x para leste, y para o sul).

`origin` guarda a projeção, para converter depois os pontos de interesse dados em lat/lon. O teste usa uma fixture minúscula. O arquivo real é gerado uma vez pela rede e versionado.

**Files:**
- Create: `tools/osm-data.ts`, `tools/osm-data.test.ts`, `tools/data/campus.json` (gerado)
- Modify: `package.json`

**Interfaces:**
- Produces: `RELATION = 1715536`; `BBOX`; `type Pt = [number, number]`; `type OsmElement`; `type CampusData = { origin: [lon0, lat0, mPorGrauLon, mPorGrauLat]; boundary: Pt[][]; buildings: { n: string; p: Pt[] }[]; parking: Pt[][]; green: Pt[][]; water: Pt[][]; roads: { c: string; p: Pt[] }[]; paths: Pt[][]; trees: Pt[]; bbox: [x0, y0, x1, y1] }`; `toMeters(origin, lon, lat): Pt`; `insideRings(rs: Pt[][], pt: Pt): boolean`; `trim(elements: OsmElement[], relationId?: number): CampusData`; script `npm run osm:fetch`.

- [ ] **Step 1: Escrever o teste que falha**

Criar `tools/osm-data.test.ts`:

```ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { insideRings, toMeters, trim, type OsmElement } from './osm-data.ts';

// Quadrado de ~1,1 km perto do campus: dois ways "outer", o segundo invertido, para testar a junção.
const node = (id: number, lon: number, lat: number, tags?: Record<string, string>): OsmElement => ({ type: 'node', id, lon, lat, tags });
const way = (id: number, nodes: number[], tags?: Record<string, string>): OsmElement => ({ type: 'way', id, nodes, tags });
const fixture: OsmElement[] = [
  node(1, -35.2, -5.84), node(2, -35.19, -5.84), node(3, -35.19, -5.83), node(4, -35.2, -5.83),
  way(10, [1, 2, 3]), way(11, [1, 4, 3]),
  { type: 'relation', id: 99, members: [{ type: 'way', ref: 10, role: 'outer' }, { type: 'way', ref: 11, role: 'outer' }] },
  node(20, -35.196, -5.836), node(21, -35.195, -5.836), node(22, -35.195, -5.835), node(23, -35.196, -5.835),
  way(30, [20, 21, 22, 23, 20], { building: 'yes', name: 'CB' }),
  way(31, [20, 21, 22, 20], { amenity: 'parking' }),
  way(32, [20, 22], { highway: 'service' }),
  way(33, [21, 23], { highway: 'footway' }),
  way(34, [20, 21, 22, 20], { leisure: 'swimming_pool' }),
  way(35, [20, 21, 22, 20], { leisure: 'park' }),
  node(40, -35.194, -5.837, { natural: 'tree' }), node(41, -35.1, -5.9, { natural: 'tree' }),
  node(50, -35.1, -5.9), node(51, -35.09, -5.9), node(52, -35.09, -5.89),
  way(36, [50, 51, 52, 50], { building: 'yes', name: 'Fora' }),
];

test('trim keeps only what is inside the relation, by kind', () => {
  const d = trim(fixture, 99);
  assert.equal(d.boundary.length, 1);
  assert.deepEqual(d.buildings.map(b => b.n), ['CB']);
  assert.equal(d.parking.length, 1);
  assert.deepEqual(d.roads.map(r => r.c), ['service']);
  assert.equal(d.paths.length, 1);
  assert.equal(d.water.length, 1);
  assert.equal(d.green.length, 1);
  assert.equal(d.trees.length, 1);
});

test('trim joins the outer ways into one closed ring and projects to metres with y pointing south', () => {
  const d = trim(fixture, 99);
  const ring = d.boundary[0];
  assert.deepEqual(ring[0], ring[ring.length - 1]);
  assert.equal(ring.length, 5);
  const [x0, y0, x1, y1] = d.bbox;
  assert.ok(x1 - x0 > 1000 && x1 - x0 < 1200, `largura ${x1 - x0}`);
  assert.ok(y1 - y0 > 1000 && y1 - y0 < 1200, `altura ${y1 - y0}`);
  const north = d.boundary[0].find(p => p[1] === y0), south = d.boundary[0].find(p => p[1] === y1);
  assert.ok(north && south);
});

test('trim fails clearly when the relation is missing', () => {
  assert.throws(() => trim(fixture, 12345), /relação 12345 não encontrada/);
});

test('insideRings uses the even-odd rule', () => {
  const sq: [number, number][] = [[0, 0], [10, 0], [10, 10], [0, 10], [0, 0]];
  assert.equal(insideRings([sq], [5, 5]), true);
  assert.equal(insideRings([sq], [15, 5]), false);
  const hole: [number, number][] = [[3, 3], [7, 3], [7, 7], [3, 7], [3, 3]];
  assert.equal(insideRings([sq, hole], [5, 5]), false);
});

test('toMeters uses the same projection as the trimmed data', () => {
  const d = trim(fixture, 99);
  assert.deepEqual(toMeters(d.origin, d.origin[0], d.origin[1]), [0, 0]);
  const [x, y] = toMeters(d.origin, -35.19, -5.84);
  assert.ok(x > 0 && y > 0, 'leste e sul são positivos');
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `node --test tools/osm-data.test.ts`
Expected: FAIL (`Cannot find module './osm-data.ts'`).

- [ ] **Step 3: Implementar**

Criar `tools/osm-data.ts`:

```ts
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
```

Em `package.json`, acrescentar o script (depois de `"maps"`):

```json
    "maps": "node tools/maps.ts",
    "osm:fetch": "node tools/osm-data.ts"
```

- [ ] **Step 4: Rodar e ver passar**

Run: `node --test tools/osm-data.test.ts && npx tsc --noEmit`
Expected: PASS (5 testes).

- [ ] **Step 5: Baixar o campus de verdade**

Run: `npm run osm:fetch`
Expected: `ok: tools/data/campus.json — N prédios, N estacionamentos, N árvores`. No protótipo deu 189 prédios, 28 estacionamentos e 527 árvores, ~92 KB; números um pouco diferentes significam que alguém editou o OSM desde então, e não tem problema. Se a API responder erro (status ≠ 200) ou não houver rede, tentar de novo em alguns minutos. Se continuar falhando, reportar BLOCKED com a mensagem do erro.

Conferir que existe um prédio chamado `CB`: `node -e "const d=JSON.parse(require('fs').readFileSync('tools/data/campus.json'));console.log(d.buildings.filter(b=>b.n==='CB').length)"` deve imprimir `1`.

- [ ] **Step 6: Commit**

```bash
git add tools/osm-data.ts tools/osm-data.test.ts tools/data/campus.json package.json
git commit -m "feat(tools): recorte do Campus Central do OpenStreetMap em metros (ODbL)

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 5: Grade do campus

Rasteriza o recorte numa grade em que cada célula é 1 tile do jogo (2 m). A pintura segue esta ordem, e cada etapa pode cobrir a anterior:

1. contorno → gramado;
2. caminhos de pedestre → calçada;
3. vias com o anel de calçada → calçada;
4. pista das vias → asfalto;
5. estacionamentos (guardando o índice do lote);
6. água;
7. prédios (guardando o índice do prédio).

**Files:**
- Create: `tools/grid.ts`, `tools/grid.test.ts`

**Interfaces:**
- Consumes: `CampusData`, `Pt` (Task 4).
- Produces: classes `OUT=0, GRASS=1, PAVE=2, ROAD=3, PARK=4, BLD=5, WATER=6`; `METERS_PER_TILE = 2`; `type Grid = { w; h; x0; y0; mpt; cls: Uint8Array; bld: Int32Array; lot: Int32Array }` (`bld`/`lot` = índice em `d.buildings`/`d.parking`, ou −1); `rasterize(d: CampusData, mpt?: number): Grid`; `cellAt(g, i, j): number` (OUT fora da grade); `walkable(c): boolean` (GRASS, PAVE, ROAD, PARK).

- [ ] **Step 1: Escrever o teste que falha**

Criar `tools/grid.test.ts`:

```ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { BLD, cellAt, GRASS, OUT, PARK, PAVE, rasterize, ROAD, walkable, WATER } from './grid.ts';
import type { CampusData } from './osm-data.ts';

const sq = (x0: number, y0: number, x1: number, y1: number): [number, number][] => [[x0, y0], [x1, y0], [x1, y1], [x0, y1], [x0, y0]];
// campus triangular de 40 m (20×20 células de 2 m): tudo com x + y > 40 fica fora
const data: CampusData = {
  origin: [0, 0, 1, 1],
  boundary: [[[0, 0], [40, 0], [0, 40], [0, 0]]],
  buildings: [{ n: 'CB', p: sq(10, 10, 16, 16) }],
  parking: [sq(2, 20, 8, 26)],
  green: [],
  water: [sq(2, 30, 6, 34)],
  roads: [{ c: 'service', p: [[0, 6], [30, 6]] }],
  paths: [],
  trees: [],
  bbox: [0, 0, 40, 40],
};

test('rasterize builds a 20×20 grid and leaves cells outside the boundary as OUT', () => {
  const g = rasterize(data, 2);
  assert.equal(g.w, 20);
  assert.equal(g.h, 20);
  assert.equal(cellAt(g, 19, 19), OUT);
  assert.equal(cellAt(g, 0, 9), GRASS);
  assert.equal(cellAt(g, -1, 0), OUT);
  assert.equal(cellAt(g, 0, 20), OUT);
});

test('roads get asphalt in the middle and a sidewalk ring', () => {
  const g = rasterize(data, 2);
  assert.equal(cellAt(g, 1, 2), ROAD); // centro y=5, a 1 m da via
  assert.equal(cellAt(g, 1, 3), ROAD);
  assert.equal(cellAt(g, 1, 1), PAVE); // y=3, a 3 m: calçada
  assert.equal(cellAt(g, 1, 5), PAVE); // y=11, a 5 m: calçada
  assert.equal(cellAt(g, 1, 6), GRASS); // y=13, a 7 m: fora da calçada
});

test('parking, water and buildings are painted with the building index', () => {
  const g = rasterize(data, 2);
  assert.equal(cellAt(g, 2, 11), PARK);
  assert.equal(cellAt(g, 1, 15), WATER);
  assert.equal(cellAt(g, 6, 6), BLD);
  assert.equal(g.bld[6 * g.w + 6], 0);
  assert.equal(g.bld[0], -1);
});

test('walkable is everything but outside, buildings and water', () => {
  assert.deepEqual([OUT, GRASS, PAVE, ROAD, PARK, BLD, WATER].map(walkable), [false, true, true, true, true, false, false]);
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `node --test tools/grid.test.ts`
Expected: FAIL (`Cannot find module './grid.ts'`).

- [ ] **Step 3: Implementar**

Criar `tools/grid.ts`:

```ts
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
```

- [ ] **Step 4: Rodar e ver passar**

Run: `node --test tools/grid.test.ts && npx tsc --noEmit`
Expected: PASS (4 testes).

- [ ] **Step 5: Commit**

```bash
git add tools/grid.ts tools/grid.test.ts
git commit -m "feat(tools): rasteriza o recorte do OSM em células de 2 m

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 6: Montagem do .tmj compartilhada

O `maps.ts` monta o JSON do Tiled por dentro de `buildMap`. Os setores do campus precisam da mesma montagem, então ela sai para `tools/tiled.ts`. Refatoração pura: os mapas do lab e do corredor saem **byte a byte iguais** (conferido no protótipo).

**Files:**
- Create: `tools/tiled.ts`
- Modify: `tools/maps.ts`

**Interfaces:**
- Produces, em `tools/tiled.ts`:
  - `T = 16`;
  - `type AreaSpec = { type; name; col; row; w?; h?; props?: Record<string, string | number> }` (passa a morar aqui; o `maps.ts` deixa de exportá-lo);
  - `type Sheet = { firstgid; name; columns; rows }`;
  - `prop(name, value)`;
  - `tileset(s: Sheet, solid: number[])`;
  - `tileLayer(id, name, w, h, data, props = [])`;
  - `areaLayer(id, areas: AreaSpec[], name = 'areas', firstObjectId = 1)`;
  - tipos `TileLayerJson`, `AreaLayerJson`;
  - `tiledMap(w, h, props, tilesets, layers)` (`nextlayerid` = nº de camadas + 1; `nextobjectid` = maior id de objeto + 1).

- [ ] **Step 1: Criar `tools/tiled.ts`**

```ts
// Montagem do JSON de mapa do Tiled (formato .tmj) usado pelos geradores de mapa.
export const T = 16;
export type AreaSpec = { type: string; name: string; col: number; row: number; w?: number; h?: number; props?: Record<string, string | number> };
export type Sheet = { firstgid: number; name: string; columns: number; rows: number };
type Prop = { name: string; type: 'string' | 'float' | 'bool'; value: string | number | boolean };

export const prop = (name: string, value: string | number | boolean): Prop => ({
  name, type: typeof value === 'number' ? 'float' : typeof value === 'boolean' ? 'bool' : 'string', value,
});

/** Tileset embutido (o Phaser não lê tilesets externos); `solid` = ids locais que recebem collides. */
export const tileset = (s: Sheet, solid: number[]) => ({
  firstgid: s.firstgid, name: s.name, image: `../tilesets/${s.name}.png`, imagewidth: s.columns * T, imageheight: s.rows * T,
  tilewidth: T, tileheight: T, columns: s.columns, tilecount: s.columns * s.rows, margin: 0, spacing: 0,
  tiles: solid.map(id => ({ id, properties: [prop('collides', true)] })),
});

export const tileLayer = (id: number, name: string, w: number, h: number, data: number[], props: Prop[] = []) => ({
  type: 'tilelayer', id, name, x: 0, y: 0, width: w, height: h, opacity: 1, visible: true, data, ...(props.length ? { properties: props } : {}),
});

export const areaLayer = (id: number, areas: AreaSpec[], name = 'areas', firstObjectId = 1) => ({
  type: 'objectgroup', id, name, draworder: 'topdown', x: 0, y: 0, opacity: 1, visible: true,
  objects: areas.map((a, i) => ({
    id: firstObjectId + i, name: a.name, type: a.type, x: a.col * T, y: a.row * T, width: (a.w ?? 1) * T, height: (a.h ?? 1) * T, rotation: 0, visible: true,
    properties: Object.entries(a.props ?? {}).map(([name, value]) => prop(name, value)),
  })),
});

export type TileLayerJson = ReturnType<typeof tileLayer>;
export type AreaLayerJson = ReturnType<typeof areaLayer>;

export const tiledMap = (w: number, h: number, props: Prop[], tilesets: ReturnType<typeof tileset>[], layers: (TileLayerJson | AreaLayerJson)[]) => ({
  type: 'map', version: '1.10', tiledversion: '1.11.2', orientation: 'orthogonal', renderorder: 'right-down', infinite: false,
  width: w, height: h, tilewidth: T, tileheight: T, nextlayerid: layers.length + 1,
  nextobjectid: 1 + Math.max(0, ...layers.flatMap(l => ('objects' in l ? l.objects.map(o => o.id) : []))),
  properties: props, tilesets, layers,
});
```

- [ ] **Step 2: Usar no `maps.ts`**

Aplicar em `tools/maps.ts`:

```diff
diff --git a/tools/maps.ts b/tools/maps.ts
--- a/tools/maps.ts
+++ b/tools/maps.ts
@@ -1,10 +1,8 @@
 import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
 import { LAB, LAB_COLS, LAB_ROWS, LAB_SOLID } from './lab-tiles.ts';
+import { areaLayer, prop, tiledMap, tileLayer, tileset, type AreaSpec, type Sheet } from './tiled.ts';
 
-const T = 16;
-export type AreaSpec = { type: string; name: string; col: number; row: number; w?: number; h?: number; props?: Record<string, string | number> };
 export type MapSpec = { name: string; title: string; base: string[]; items: string[]; areas: AreaSpec[] };
-type Sheet = { firstgid: number; name: string; columns: number; rows: number };
 
 const FLOORS: Sheet = { firstgid: 1, name: 'limezu-floors', columns: 15, rows: 40 };
 const WALLS: Sheet = { firstgid: 601, name: 'limezu-walls', columns: 32, rows: 40 };
@@ -51,26 +49,10 @@ export function buildMap(spec: MapSpec) {
       items.push(it === '.' ? 0 : ufrn(ITEMS[it]));
     }
   }
-  const tileLayer = (id: number, name: string, data: number[]) => ({ type: 'tilelayer', id, name, x: 0, y: 0, width: w, height: h, opacity: 1, visible: true, data });
-  const tileset = (s: Sheet, solid: number[]) => ({
-    firstgid: s.firstgid, name: s.name, image: `../tilesets/${s.name}.png`, imagewidth: s.columns * T, imageheight: s.rows * T,
-    tilewidth: T, tileheight: T, columns: s.columns, tilecount: s.columns * s.rows, margin: 0, spacing: 0,
-    tiles: solid.map(id => ({ id, properties: [{ name: 'collides', type: 'bool', value: true }] })),
-  });
-  const objects = spec.areas.map((a, i) => ({
-    id: i + 1, name: a.name, type: a.type, x: a.col * T, y: a.row * T, width: (a.w ?? 1) * T, height: (a.h ?? 1) * T, rotation: 0, visible: true,
-    properties: Object.entries(a.props ?? {}).map(([name, value]) => ({ name, type: typeof value === 'number' ? 'float' : 'string', value })),
-  }));
-  return {
-    type: 'map', version: '1.10', tiledversion: '1.11.2', orientation: 'orthogonal', renderorder: 'right-down', infinite: false,
-    width: w, height: h, tilewidth: T, tileheight: T, nextlayerid: 6, nextobjectid: objects.length + 1,
-    properties: [{ name: 'name', type: 'string', value: spec.title }],
-    tilesets: [tileset(FLOORS, []), tileset(WALLS, WALL_SOLID), tileset(UFRN, LAB_SOLID)],
-    layers: [
-      tileLayer(1, 'floor', floor), tileLayer(2, 'walls', walls), tileLayer(3, 'furniture', furniture), tileLayer(4, 'items', items),
-      { type: 'objectgroup', id: 5, name: 'areas', draworder: 'topdown', x: 0, y: 0, opacity: 1, visible: true, objects },
-    ],
-  };
+  return tiledMap(w, h, [prop('name', spec.title)], [tileset(FLOORS, []), tileset(WALLS, WALL_SOLID), tileset(UFRN, LAB_SOLID)], [
+    tileLayer(1, 'floor', w, h, floor), tileLayer(2, 'walls', w, h, walls), tileLayer(3, 'furniture', w, h, furniture), tileLayer(4, 'items', w, h, items),
+    areaLayer(5, spec.areas),
+  ]);
 }
 
 const row = (fill: string, w: number, edge = '#') => edge + fill.repeat(w - 2) + edge;
```

- [ ] **Step 3: Conferir que nada mudou**

Run: `npx tsc --noEmit && npm test && npm run maps -- --force && git status --short public/maps`
Expected: tsc limpo, todos os testes passam, e o `git status` **não lista nada** (`cb-lab.tmj` e `cb-corredor.tmj` regerados idênticos). Se aparecer diferença, a refatoração mudou o JSON: comparar com `git diff public/maps` e corrigir até sumir.

- [ ] **Step 4: Commit**

```bash
git add tools/tiled.ts tools/maps.ts
git commit -m "refactor(tools): montagem do .tmj em tiled.ts, compartilhada com o campus

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 7: Setores do campus

O coração do gerador. `campus.ts` corta a grade em setores de 160×160 (os que são só "fora do campus" não viram mapa) e monta cada setor como mapa do Tiled.

**Passagens nas bordas.** Para cada vizinho a leste ou ao sul, a borda vira trechos de 4 tiles. Em cada trecho andável dos dois lados entra um par:

- uma porta na última coluna ou linha de um setor;
- uma entrada 2 tiles para dentro do outro setor, na mesma altura;
- o mesmo par no sentido contrário.

As pontas da borda têm 2 tiles livres, para nenhuma porta encostar na borda perpendicular.

**Camadas de tiles** (nesta ordem):

| Camada | O que leva |
|---|---|
| `osm-chao` | asfalto sob ruas e estacionamentos |
| `osm-calcada` | calçada em blob |
| `osm-grama` | grama lisa; blob de grama na borda das áreas pavimentadas |
| `osm-terreno` | estacionamento, telhado, água e mata em blob |
| `osm-detalhes` | 5% do gramado com enfeites; 1 em 4 é flor |
| `osm-objetos` | carros, a linha do tronco das árvores e o pé das placas |
| `osm-copas` | copa das árvores e topo das placas, desenhada por cima do jogador |

**Camada `osm-areas`:**

- entrada `default` na célula andável mais próxima do centro;
- as passagens das bordas;
- uma placa `placa-<n>` em frente de cada prédio com nome;
- no CB:
  - porta `porta-cb` para o corredor (`cb-corredor`, entrada `porta-campus`);
  - entrada `cb` logo abaixo da porta;
  - NPC `vigilante`;
- uma placa `ponto-<nome>` para cada ponto de interesse, na célula andável mais próxima.

**Árvores** são as do OSM, mais uma salpicada determinística. **Carros** ficam sempre de lado, em fileiras de 4×3 com folga de 1 tile, e a frente alterna por coluna.

Cada área reserva a própria célula, 1 tile em volta e 2 acima, para árvore e carro nunca taparem passagens nem placas.

Tudo é determinístico: um hash das coordenadas, sem `Math.random`.

**Files:**
- Create: `tools/campus.ts`, `tools/campus.test.ts`

**Interfaces:**
- Consumes:
  - `GODOT_BLOB`, `blobMask` (Task 2);
  - todo o `campus-atlas.ts` (Task 3);
  - `CampusData` (Task 4);
  - `Grid`, classes, `cellAt`, `walkable`, `rasterize` (Task 5);
  - `areaLayer`, `prop`, `tiledMap`, `tileLayer`, `tileset`, `AreaSpec`, `Sheet` (Task 6).
- Produces:
  - `SECTOR = 160`;
  - `type Sector = { name; cx; cy; x0; y0; w; h }`;
  - `type Ponto = { name; x; y; text }` (já em metros);
  - `CAMPUS_SOLID: number[]` (ids locais com `collides`);
  - `sectors(g: Grid): Sector[]`;
  - `edgeLinks(g, a, b): { doorA; entryA; doorB; entryB }[]`;
  - `CB_NAME = 'CB'`;
  - `cbLink(g, d): { map: string; entry: 'cb' }` (lança erro se o CB não tiver frente andável);
  - `buildSector(g, d, s, all, pontos = [])`, que retorna o mapa do Tiled com as propriedades `name` = `Campus · <maior prédio com nome do setor>` (ou `Campus Central`) e `minimap` = `maps/<setor>.mini.png`;
  - `MINIMAP_COLORS` (uma cor por classe da grade).

- [ ] **Step 1: Escrever os testes que falham**

Criar `tools/campus.test.ts`:

```ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildSector, CAMPUS_SOLID, cbLink, edgeLinks, sectors } from './campus.ts';
import { atlasId, CARS_LEFT, CARS_RIGHT, SIGN, TREES } from './campus-atlas.ts';
import { rasterize } from './grid.ts';
import type { CampusData } from './osm-data.ts';
import { parseAreas, type TiledObject } from '../src/areas.ts';

const sq = (x0: number, y0: number, x1: number, y1: number): [number, number][] => [[x0, y0], [x1, y0], [x1, y1], [x0, y1], [x0, y0]];
// retângulo de 680×400 m → grade 340×200 → setores 160: 3 colunas (160, 160, 20) × 2 linhas (160, 40)
const base: CampusData = {
  origin: [0, 0, 1, 1], boundary: [sq(0, 0, 680, 400)], buildings: [], parking: [], green: [], water: [], roads: [], paths: [], trees: [], bbox: [0, 0, 680, 400],
};

test('sectors cut the grid in 160×160 pieces named by position, keeping the remainders', () => {
  const s = sectors(rasterize(base));
  assert.deepEqual(s.map(x => `${x.name}:${x.w}x${x.h}`), [
    'campus-0-0:160x160', 'campus-1-0:160x160', 'campus-2-0:20x160',
    'campus-0-1:160x40', 'campus-1-1:160x40', 'campus-2-1:20x40',
  ]);
});

test('edge links pair a door on each side with an entry two tiles inside the other side', () => {
  const g = rasterize(base), [a, b] = sectors(g);
  const links = edgeLinks(g, a, b);
  assert.equal(links.length, 39);
  const [l] = links;
  assert.deepEqual([l.doorA.col, l.doorA.row, l.doorA.w, l.doorA.h], [159, 2, 1, 4]);
  assert.deepEqual(l.doorA.props, { map: 'campus-1-0', entry: 'de-campus-0-0-0' });
  assert.deepEqual([l.entryB.name, l.entryB.col], ['de-campus-0-0-0', 2]);
  assert.deepEqual(l.doorB.props, { map: 'campus-0-0', entry: 'de-campus-1-0-0' });
  assert.deepEqual([l.entryA.name, l.entryA.col], ['de-campus-1-0-0', 157]);
  assert.equal(links.at(-1)!.doorA.row + links.at(-1)!.doorA.h!, 158); // 2 tiles livres na ponta
  assert.deepEqual(edgeLinks(g, a, sectors(g)[2]), []);
});

test('edge links skip stretches blocked on either side', () => {
  const blocked = { ...base, buildings: [{ n: '', p: sq(300, 0, 340, 400) }] }; // prédio sobre a divisa x=320 m
  const g = rasterize(blocked), [a, b] = sectors(g);
  assert.equal(edgeLinks(g, a, b).length, 0);
});

test('buildSector makes 7 tile layers of the sector size, the areas layer and the minimap property', () => {
  const g = rasterize(base), all = sectors(g), s = all[0];
  const map = buildSector(g, base, s, all);
  const tiles = map.layers.filter(l => l.type === 'tilelayer') as { name: string; data: number[] }[];
  assert.deepEqual(tiles.map(l => l.name), ['osm-chao', 'osm-calcada', 'osm-grama', 'osm-terreno', 'osm-detalhes', 'osm-objetos', 'osm-copas']);
  for (const l of tiles) assert.equal(l.data.length, 160 * 160);
  assert.deepEqual(map.properties.map(p => p.name), ['name', 'minimap']);
  assert.equal(map.properties[1].value, 'maps/campus-0-0.mini.png');
  const areas = parseAreas((map.layers.find(l => l.type === 'objectgroup') as unknown as { objects: TiledObject[] }).objects);
  assert.deepEqual(areas.warnings, []);
  assert.deepEqual(buildSector(g, base, s, all), map, 'determinístico');
});

test('the CB building gets the door to the corridor, the arrival entry and the guard; cbLink finds its sector', () => {
  const withCb = { ...base, buildings: [{ n: 'CB', p: sq(100, 100, 140, 120) }] };
  const g = rasterize(withCb), all = sectors(g);
  const map = buildSector(g, withCb, all[0], all);
  const objects = (map.layers.find(l => l.type === 'objectgroup') as unknown as { objects: TiledObject[] }).objects;
  const door = objects.find(o => o.name === 'porta-cb');
  assert.deepEqual(door?.properties?.map(p => [p.name, p.value]), [['map', 'cb-corredor'], ['entry', 'porta-campus']]);
  assert.ok(objects.some(o => o.type === 'entry' && o.name === 'cb'));
  assert.ok(objects.some(o => o.type === 'npc' && o.name === 'vigilante'));
  assert.deepEqual(cbLink(g, withCb), { map: 'campus-0-0', entry: 'cb' });
});

test('collision: roofs, cars, sign feet and tree trunks block; tree canopies and sign tops do not', () => {
  const t = TREES[0];
  assert.ok(CAMPUS_SOLID.includes(atlasId(t.at[0], t.at[1] + t.h - 1)));
  assert.ok(!CAMPUS_SOLID.includes(atlasId(t.at[0], t.at[1])));
  assert.ok(CAMPUS_SOLID.includes(atlasId(CARS_LEFT[0].at[0], CARS_LEFT[0].at[1])));
  assert.ok(CAMPUS_SOLID.includes(atlasId(SIGN.at[0], SIGN.at[1] + 1)));
  assert.ok(!CAMPUS_SOLID.includes(atlasId(SIGN.at[0], SIGN.at[1])));
});

const gidsIn = (map: ReturnType<typeof buildSector>, name: string) => new Set((map.layers.find(l => l.name === name) as { data: number[] }).data.filter(Boolean));
const carGids = (stamps: typeof CARS_LEFT) => stamps.map(s => 1 + atlasId(s.at[0], s.at[1]));

test('cars always park sideways, whatever the lot shape', () => {
  const tall = { ...base, parking: [sq(20, 20, 60, 140)] }, wide = { ...base, parking: [sq(20, 20, 140, 60)] };
  for (const d of [tall, wide]) {
    const g = rasterize(d), all = sectors(g), objs = gidsIn(buildSector(g, d, all[0], all), 'osm-objetos');
    assert.ok([...carGids(CARS_LEFT), ...carGids(CARS_RIGHT)].some(id => objs.has(id)), 'deveria ter carros de lado');
  }
});

test('cars and trees never cover a door, an entry or the tile around them', () => {
  const lot = { ...base, parking: [sq(280, 0, 360, 400)] }; // estacionamento sobre a divisa x = 320 m
  const g = rasterize(lot), all = sectors(g);
  for (const s of all.slice(0, 2)) {
    const map = buildSector(g, lot, s, all);
    const covered = (name: string) => (map.layers.find(l => l.name === name) as { data: number[] }).data;
    const objs = covered('osm-objetos'), tops = covered('osm-copas');
    assert.ok(objs.some(Boolean), 'deveria ter carros no estacionamento');
    const objects = (map.layers.find(l => l.type === 'objectgroup') as unknown as { objects: { name: string; type: string; x: number; y: number; width: number; height: number }[] }).objects;
    for (const o of objects.filter(o => o.type === 'door' || o.type === 'entry')) {
      for (let y = o.y / 16 - 1; y <= (o.y + o.height) / 16; y++) for (let x = o.x / 16 - 1; x <= (o.x + o.width) / 16; x++) {
        if (x < 0 || y < 0 || x >= s.w || y >= s.h) continue;
        assert.equal(objs[y * s.w + x] || tops[y * s.w + x], 0, `${s.name}: ${o.type} "${o.name}" coberto em (${x},${y})`);
      }
    }
  }
});

test('a point of interest becomes a sign on the nearest walkable cell of its sector', () => {
  const withBuilding = { ...base, buildings: [{ n: '', p: sq(100, 100, 140, 140) }] };
  const g = rasterize(withBuilding), all = sectors(g);
  const map = buildSector(g, withBuilding, all[0], all, [{ name: 'museu', x: 120, y: 120, text: 'Museu do Carro' }]);
  const objects = (map.layers.find(l => l.type === 'objectgroup') as unknown as { objects: (TiledObject & { x: number; y: number })[] }).objects;
  const sign = objects.find(o => o.name === 'ponto-museu')!;
  assert.deepEqual(sign.properties?.map(p => p.value), ['Museu do Carro']);
  const [i, j] = [sign.x / 16, sign.y / 16];
  assert.ok(g.cls[j * g.w + i] !== 5, 'placa não pode ficar dentro do prédio');
  assert.ok(Math.hypot(i - 60, j - 60) <= 10.5, `placa longe demais do ponto (${i},${j})`); // prédio vai até 10 células do centro
  const tiles = (name: string) => (map.layers.find(l => l.name === name) as { data: number[] }).data;
  assert.equal(tiles('osm-objetos')[j * 160 + i], 1 + atlasId(SIGN.at[0], SIGN.at[1] + 1), 'pé da placa na célula da área');
  assert.equal(tiles('osm-copas')[(j - 1) * 160 + i], 1 + atlasId(SIGN.at[0], SIGN.at[1]), 'topo da placa por cima');
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `node --test tools/campus.test.ts`
Expected: FAIL (`Cannot find module './campus.ts'`).

- [ ] **Step 3: Implementar**

Criar `tools/campus.ts`:

```ts
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
  let h = Math.imul(i, 374761393) + Math.imul(j, 668265263) + Math.imul(salt, 2147483647);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
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

  // áreas primeiro: cada uma reserva a própria célula, 1 tile em volta e 2 acima, para árvores e carros não taparem portas, entradas e placas
  const areas: AreaSpec[] = [];
  /** Célula andável do setor mais próxima (distância euclidiana) de (i, j). */
  const near = (i: number, j: number): [number, number] => {
    let best: [number, number] = [i, j], bestD = Infinity;
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const dist = (x - i) ** 2 + (y - j) ** 2;
      if (dist < bestD && walkable(cls(x, y))) { best = [x, y]; bestD = dist; }
    }
    return best;
  };
  const [ci, cj] = near(Math.floor(W / 2), Math.floor(H / 2));
  areas.push({ type: 'entry', name: 'default', col: ci, row: cj });
  for (const o of all) {
    for (const l of edgeLinks(g, s, o)) areas.push(l.doorA, l.entryA);
    for (const l of edgeLinks(g, o, s)) areas.push(l.doorB, l.entryB);
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
      areas.push({ type: 'door', name: 'porta-cb', col: i, row: j, props: { map: 'cb-corredor', entry: 'porta-campus' } });
      const below = [2, 3, 4, 5].map(dy => j + dy).find(y => walkable(cls(i, y)));
      if (below !== undefined) areas.push({ type: 'entry', name: 'cb', col: i, row: below });
      if (walkable(cls(i + 2, j + 1))) areas.push({ type: 'npc', name: 'vigilante', col: i + 2, row: j + 1, props: { name: 'Vigilante', sprite: 'policeman', text: 'Bem-vindo ao Campus Central da UFRN!\n---\nEsse é o Centro de Biociências. O laboratório de Biofísica fica lá dentro.' } });
    } else {
      areas.push({ type: 'sign', name: `placa-${n}`, col: i, row: j, props: { text: b.n } });
    }
  });
  for (const p of pontos) {
    const fi = Math.floor((p.x - g.x0) / g.mpt) - s.x0, fj = Math.floor((p.y - g.y0) / g.mpt) - s.y0;
    if (fi < 0 || fj < 0 || fi >= W || fj >= H) continue;
    const [i, j] = near(fi, fj);
    areas.push({ type: 'sign', name: `ponto-${p.name}`, col: i, row: j, props: { text: p.text } });
  }
  for (const a of areas) occupy(a.col - 1, a.row - 2, (a.w ?? 1) + 2, (a.h ?? 1) + 3);

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
```

- [ ] **Step 4: Rodar e ver passar**

Run: `node --test tools/campus.test.ts && npx tsc --noEmit`
Expected: PASS (9 testes).

- [ ] **Step 5: Commit**

```bash
git add tools/campus.ts tools/campus.test.ts
git commit -m "feat(tools): setores do campus com passagens, carros, árvores, placas e o CB

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 8: Regerar sem apagar o trabalho manual

Regra de ouro da spec. Quando o setor já existe (alguém pode ter desenhado fachadas ou posto áreas no Tiled), `mergeOsmLayers` faz o seguinte:

- troca cada camada `osm-*` no lugar onde ela estava na pilha;
- remove as `osm-*` que deixaram de existir e acrescenta as novas no fim;
- mantém intactos as camadas e áreas manuais, os tilesets extras e as propriedades extras;
- renumera ids de camada que colidirem;
- renumera os objetos gerados acima do maior id manual;
- lança erro claro se um tileset manual começa dentro da faixa de gids do gerado.

**Files:**
- Modify: `tools/campus.ts`, `tools/campus.test.ts`

**Interfaces:**
- Consumes: `buildSector`, `sectors` (Task 7), `rasterize` (Task 5).
- Produces: `mergeOsmLayers<M extends MapJson>(existing: M, generated: M): M`.

- [ ] **Step 1: Escrever o teste que falha**

Em `tools/campus.test.ts`, acrescentar `mergeOsmLayers` ao import de `./campus.ts`:

```ts
import { buildSector, CAMPUS_SOLID, cbLink, edgeLinks, mergeOsmLayers, sectors } from './campus.ts';
```

E acrescentar no fim do arquivo:

```ts
test('regenerating keeps manual layers, areas and tilesets, and only swaps the osm-* layers in place', () => {
  const g = rasterize(base), all = sectors(g), fresh = buildSector(g, base, all[0], all);
  const old = structuredClone(fresh);
  const manualLayer = { type: 'tilelayer', id: 20, name: 'fachadas', x: 0, y: 0, width: 160, height: 160, opacity: 1, visible: true, data: new Array(160 * 160).fill(1000) };
  const manualAreas = { type: 'objectgroup', id: 21, name: 'areas', draworder: 'topdown', x: 0, y: 0, opacity: 1, visible: true, objects: [{ id: 5000, name: 'placa', type: 'sign', x: 0, y: 0, width: 16, height: 16, rotation: 0, visible: true, properties: [] }] };
  old.layers.splice(4, 0, manualLayer as never);
  old.layers.push(manualAreas as never);
  old.tilesets.push({ ...old.tilesets[0], name: 'fachadas-ufrn', firstgid: 2000 });
  (old.layers.find(l => l.name === 'osm-grama') as { data: number[] }).data.fill(7);
  const merged = mergeOsmLayers(old, fresh);
  assert.deepEqual(merged.layers.map(l => l.name), ['osm-chao', 'osm-calcada', 'osm-grama', 'osm-terreno', 'fachadas', 'osm-detalhes', 'osm-objetos', 'osm-copas', 'osm-areas', 'areas']);
  assert.deepEqual((merged.layers.find(l => l.name === 'osm-grama') as { data: number[] }).data, (fresh.layers.find(l => l.name === 'osm-grama') as { data: number[] }).data);
  assert.equal(merged.layers.find(l => l.name === 'fachadas'), manualLayer as never);
  assert.ok(merged.tilesets.some(t => t.name === 'fachadas-ufrn'));
  const ids = merged.layers.flatMap(l => ('objects' in l ? (l.objects as { id: number }[]).map(o => o.id) : []));
  assert.equal(new Set(ids).size, ids.length, 'ids de objeto repetidos');
  assert.ok(Math.min(...(merged.layers.find(l => l.name === 'osm-areas') as { objects: { id: number }[] }).objects.map(o => o.id)) > 5000);
  assert.equal(merged.nextobjectid, Math.max(...ids) + 1);
  assert.equal(new Set(merged.layers.map(l => l.id)).size, merged.layers.length, 'ids de camada repetidos');
  const clash = structuredClone(old);
  clash.tilesets[1].firstgid = 500;
  assert.throws(() => mergeOsmLayers(clash, fresh), /colide/);
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `node --test tools/campus.test.ts`
Expected: FAIL (`mergeOsmLayers` não exportado).

- [ ] **Step 3: Implementar**

Acrescentar no fim de `tools/campus.ts`:

```ts
type MapJson = {
  layers: { id: number; name: string; type: string; objects?: { id: number }[] }[];
  tilesets: { name: string; firstgid: number; tilecount: number }[];
  properties: { name: string }[]; nextlayerid: number; nextobjectid: number;
};
/**
 * Regera só as camadas osm-* de um mapa que já existe, cada uma no lugar onde estava na pilha.
 * Camadas, áreas, tilesets e propriedades feitos à mão no Tiled ficam intactos.
 */
export function mergeOsmLayers<M extends MapJson>(existing: M, generated: M): M {
  const fresh = new Map(generated.layers.map(l => [l.name, l]));
  const layers = existing.layers.flatMap(l => (l.name.startsWith('osm-') ? (fresh.has(l.name) ? [fresh.get(l.name)!] : []) : [l]));
  for (const l of generated.layers) if (!layers.includes(l)) layers.push(l);
  const manual = layers.filter(l => !l.name.startsWith('osm-'));
  let lastId = Math.max(0, ...manual.map(l => l.id));
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
  const props = new Set(generated.properties.map(p => p.name));
  return {
    ...existing, ...generated,
    layers: merged, tilesets: [...generated.tilesets, ...extra],
    properties: [...generated.properties, ...existing.properties.filter(p => !props.has(p.name))],
    nextlayerid: 1 + Math.max(...merged.map(l => l.id)),
    nextobjectid: 1 + Math.max(lastObject, ...merged.flatMap(l => (l.objects ?? []).map(o => o.id))),
  };
}
```

- [ ] **Step 4: Rodar e ver passar**

Run: `node --test tools/campus.test.ts && npx tsc --noEmit`
Expected: PASS (10 testes).

- [ ] **Step 5: Commit**

```bash
git add tools/campus.ts tools/campus.test.ts
git commit -m "feat(tools): regerar o campus troca só as camadas osm-* (regra de ouro)

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 9: Publicar os setores ligados ao corredor

Liga tudo:

- a CLI `npm run osm` gera os 22 setores e os minimapas;
- os pontos de interesse vêm de `tools/data/pontos.json`;
- o corredor do CB ganha uma abertura na parede direita com a porta para o setor do CB, no lugar da placa "em breve";
- o lint dos mapas passa a ler as duas camadas de áreas.

Tudo isso vai num commit só, porque o lint de "toda porta aponta para uma entrada que existe" só passa com os setores e o corredor publicados juntos.

**Files:**
- Create: `tools/osm.ts`, `tools/data/pontos.json`
- Modify: `src/areas.ts`, `src/areas.test.ts`, `tools/maps.ts`, `tools/maps.test.ts`, `package.json`
- Generated: `public/maps/campus-*.tmj`, `public/maps/campus-*.mini.png`, `public/maps/cb-corredor.tmj`

**Interfaces:**
- Consumes: `buildSector`, `mergeOsmLayers`, `MINIMAP_COLORS`, `sectors`, `cbLink`, `Ponto` (Tasks 7–8); `rasterize` (Task 5); `toMeters`, `CampusData` (Task 4); `Pix` (Task 1).
- Produces:
  - `areaObjects(layers: { type: string; name: string; objects?: TiledObject[] }[]): TiledObject[]` em `src/areas.ts` (usada pela Task 10);
  - `loadCampus(): CampusData` e `loadPontos(d): Ponto[]` em `tools/osm.ts`;
  - script `npm run osm`;
  - no corredor, a entrada `porta-campus` e a porta `campus` (2 tiles de altura na coluna 19, linhas 4–5).

- [ ] **Step 1: Teste de `areaObjects` (falha)**

Aplicar em `src/areas.test.ts`:

```diff
diff --git a/src/areas.test.ts b/src/areas.test.ts
index 97549c6..98eda11 100644
--- a/src/areas.test.ts
+++ b/src/areas.test.ts
@@ -1,6 +1,6 @@
 import { test } from 'node:test';
 import assert from 'node:assert/strict';
-import { contains, entryPoint, near, paginate, parseAreas, type TiledObject } from './areas.ts';
+import { areaObjects, contains, entryPoint, near, paginate, parseAreas, type TiledObject } from './areas.ts';
 
 const obj = (type: string, name: string, props: Record<string, unknown> = {}, x = 0, y = 0): TiledObject => ({
   type, name, x, y, width: 16, height: 16,
@@ -92,3 +92,13 @@ test('paginate splits on lines with only ---, trims and drops empty pages', () =
   assert.deepEqual(paginate('a\n---\n\n---\n  b  '), ['a', 'b']);
   assert.deepEqual(paginate('sem separador'), ['sem separador']);
 });
+
+test('areaObjects joins the hand-made "areas" layer and the generated "osm-areas" layer, ignoring the rest', () => {
+  const layers = [
+    { type: 'objectgroup', name: 'osm-areas', objects: [obj('entry', 'default')] },
+    { type: 'tilelayer', name: 'areas' },
+    { type: 'objectgroup', name: 'notas', objects: [obj('sign', 'rascunho')] },
+    { type: 'objectgroup', name: 'areas', objects: [obj('sign', 'placa')] },
+  ];
+  assert.deepEqual(areaObjects(layers).map(o => o.name), ['default', 'placa']);
+});
```

Run: `node --test src/areas.test.ts`
Expected: FAIL (`areaObjects` não exportado).

- [ ] **Step 2: Implementar `areaObjects`**

Aplicar em `src/areas.ts`:

```diff
diff --git a/src/areas.ts b/src/areas.ts
index e5619cb..24ceea3 100644
--- a/src/areas.ts
+++ b/src/areas.ts
@@ -35,6 +35,11 @@ export function entryPoint(areas: Area[], name: string): { x: number; y: number
   return e ? { x: e.rect.x + e.rect.w / 2, y: e.rect.y + e.rect.h / 2 } : null;
 }
 
+/** Objetos das camadas de áreas: "areas" (feita à mão no Tiled) e "osm-areas" (gerada pelo tools/osm.ts). */
+export function areaObjects(layers: { type: string; name: string; objects?: TiledObject[] }[]): TiledObject[] {
+  return layers.filter(l => l.type === 'objectgroup' && (l.name === 'areas' || l.name === 'osm-areas')).flatMap(l => l.objects ?? []);
+}
+
 export function parseAreas(objects: TiledObject[]): { areas: Area[]; warnings: string[] } {
   const areas: Area[] = [], warnings: string[] = [];
   for (const o of objects) {
```

Run: `node --test src/areas.test.ts`
Expected: PASS (11 testes).

- [ ] **Step 3: Lint dos mapas lê `areas` e `osm-areas`**

Aplicar em `tools/maps.test.ts`:

```diff
diff --git a/tools/maps.test.ts b/tools/maps.test.ts
index 695ff4b..629d470 100644
--- a/tools/maps.test.ts
+++ b/tools/maps.test.ts
@@ -3,12 +3,12 @@ import assert from 'node:assert/strict';
 import { readdirSync, readFileSync } from 'node:fs';
 import { buildMap, LAB_MAP, MAPS } from './maps.ts';
 import type { MapSpec } from './maps.ts';
-import { contains, parseAreas } from '../src/areas.ts';
+import { areaObjects, contains, parseAreas } from '../src/areas.ts';
 import type { Area, TiledObject } from '../src/areas.ts';
 
 type Built = ReturnType<typeof buildMap>;
 /** Só o que o lint lê de um .tmj publicado. `name` é o nome do arquivo sem `.tmj`. */
-type Shipped = { name: string; layers: { name: string; objects?: TiledObject[] }[] };
+type Shipped = { name: string; layers: { type: string; name: string; objects?: TiledObject[] }[] };
 const tileLayer = (m: Built, name: string) => m.layers.find(l => l.name === name) as { data: number[] };
 const built = MAPS.map(spec => ({ spec, map: buildMap(spec) }));
 
@@ -21,9 +21,8 @@ function shippedMaps(): Shipped[] {
   }));
 }
 const shippedAreas = (m: Shipped) => {
-  const layer = m.layers.find(l => l.name === 'areas');
-  assert.ok(layer?.objects, `${m.name}: sem camada areas`);
-  return parseAreas(layer.objects);
+  assert.ok(m.layers.some(l => l.type === 'objectgroup' && (l.name === 'areas' || l.name === 'osm-areas')), `${m.name}: sem camada de áreas`);
+  return parseAreas(areaObjects(m.layers));
 };
 
 test('every tile layer has width × height cells', () => {
```

- [ ] **Step 4: Pontos de interesse e CLI**

Criar `tools/data/pontos.json`. Para acrescentar outro ponto depois, basta uma linha com o lat/lon do Google Maps ou do OSM; `---` separa as páginas do texto.

```json
[
  { "name": "museu-do-carro", "lat": -5.84342, "lon": -35.19852, "text": "Museu do Carro da ECT\n---\nEscola de Ciência e Tecnologia da UFRN." }
]
```

Criar `tools/osm.ts`:

```ts
// Gera os setores do campus (public/maps/campus-X-Y.tmj + minimapa .mini.png) a partir de tools/data/campus.json.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { buildSector, mergeOsmLayers, MINIMAP_COLORS, sectors, type Ponto } from './campus.ts';
import { rasterize } from './grid.ts';
import { toMeters, type CampusData } from './osm-data.ts';
import { Pix } from './pix.ts';

export const loadCampus = (): CampusData => JSON.parse(readFileSync(new URL('./data/campus.json', import.meta.url), 'utf8'));
/** Pontos de interesse escritos à mão (lat/lon do Google Maps/OSM), convertidos para metros do campus. */
export function loadPontos(d: CampusData): Ponto[] {
  const raw = JSON.parse(readFileSync(new URL('./data/pontos.json', import.meta.url), 'utf8')) as { name: string; lat: number; lon: number; text: string }[];
  return raw.map(p => { const [x, y] = toMeters(d.origin, p.lon, p.lat); return { name: p.name, x, y, text: p.text }; });
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
```

Em `package.json`, acrescentar o script `osm` (entre `"maps"` e `"osm:fetch"`):

```json
    "maps": "node tools/maps.ts",
    "osm": "node tools/osm.ts",
    "osm:fetch": "node tools/osm-data.ts"
```

- [ ] **Step 5: Porta do corredor para o campus**

Aplicar em `tools/maps.ts`:

```diff
diff --git a/tools/maps.ts b/tools/maps.ts
--- a/tools/maps.ts
+++ b/tools/maps.ts
@@ -1,8 +1,14 @@
 import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
+import { cbLink } from './campus.ts';
+import { rasterize } from './grid.ts';
 import { LAB, LAB_COLS, LAB_ROWS, LAB_SOLID } from './lab-tiles.ts';
+import { loadCampus } from './osm.ts';
 import { areaLayer, prop, tiledMap, tileLayer, tileset, type AreaSpec, type Sheet } from './tiled.ts';
 
 export type MapSpec = { name: string; title: string; base: string[]; items: string[]; areas: AreaSpec[] };
+const campus = loadCampus();
+/** Onde a porta do corredor leva no campus (setor do CB, entrada "cb"). */
+const CB_LINK = cbLink(rasterize(campus), campus);
 
 const FLOORS: Sheet = { firstgid: 1, name: 'limezu-floors', columns: 15, rows: 40 };
 const WALLS: Sheet = { firstgid: 601, name: 'limezu-walls', columns: 32, rows: 40 };
@@ -116,8 +122,8 @@ export const CORRIDOR_MAP: MapSpec = {
     '#WWWWWWWW..WWWWWWWW#',
     '#WWWWWWWW..WWWWWWWW#',
     row('.', 20),
-    row('.', 20),
-    row('.', 20),
+    '#' + '.'.repeat(19),
+    '#' + '.'.repeat(19),
     row('.', 20),
     row('.', 20),
     '#'.repeat(20),
@@ -132,7 +138,8 @@ export const CORRIDOR_MAP: MapSpec = {
     { type: 'entry', name: 'default', col: 9, row: 5, w: 2 },
     { type: 'entry', name: 'porta-lab', col: 9, row: 3, w: 2 },
     { type: 'door', name: 'voltar', col: 9, row: 0, w: 2, props: { map: 'cb-lab', entry: 'porta-corredor' } },
-    { type: 'sign', name: 'saida', col: 17, row: 4, props: { text: 'Saída para o campus.\n---\nEm breve: o Campus Central inteiro!' } },
+    { type: 'entry', name: 'porta-campus', col: 17, row: 4 },
+    { type: 'door', name: 'campus', col: 19, row: 4, h: 2, props: { map: CB_LINK.map, entry: CB_LINK.entry } },
     { type: 'sound', name: 'zumbido', col: 0, row: 0, w: 20, h: 9, props: { src: 'audio/lab-hum.wav', volume: 0.1 } },
   ],
 };
```

- [ ] **Step 6: Gerar os mapas**

Run: `npm run osm && npm run maps -- --force && git status --short public/maps | grep -v campus-; ls public/maps/campus-*.tmj public/maps/campus-*.mini.png | wc -l`
Expected:

- `ok: 22 setores (932×687 tiles, 2 m por tile), 1 pontos`, sem aviso `[osm] ponto … fora do campus`. Se o OSM foi editado desde o protótipo, o número de setores ou o tamanho podem variar um pouco.
- o `git status` filtrado mostra só ` M public/maps/cb-corredor.tmj` (`cb-lab.tmj` **não** aparece);
- a contagem dá `44` (22 `campus-*.tmj` + 22 `campus-*.mini.png`).

Rodar `npm run osm` de novo deve dar o mesmo resultado: o segundo run passa pelo `mergeOsmLayers`, e `git status` não mostra mudança nos setores além dos já listados.

- [ ] **Step 7: Rodar tudo**

Run: `npm test && npx tsc --noEmit`
Expected: PASS em tudo. O lint de mapas agora roda nos 24 mapas publicados: áreas sem aviso, nenhuma entrada dentro de porta, toda porta aponta para mapa e entrada que existem.

- [ ] **Step 8: Commit**

Os 22 `.tmj` somam ~9 MB (JSON compacto). É esperado: são a base que o Tiled vai editar no Plano 3.

```bash
git add tools/osm.ts tools/data/pontos.json src/areas.ts src/areas.test.ts tools/maps.ts tools/maps.test.ts package.json public/maps
git commit -m "feat: campus gerado do OSM em 22 setores, ligado ao corredor do CB

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 10: O jogo carrega o campus

A cena passa por cinco mudanças:

- os tilesets são carregados pelo nome que está no `.tmj` (`tilesets/<nome>.png`), sob demanda; sai a lista fixa do `main.ts`;
- as áreas são lidas de `areas` + `osm-areas`;
- a cena mostra o minimapa do setor (canto superior direito, com ponto no jogador e nome embaixo);
- duas portas no mesmo quadro disparam uma vez só;
- cada edição de personagem remove a textura anterior (~2,4 MB), pendência do Plano 1.

Os créditos ganham o Modern Exteriors e o OpenStreetMap.

**Files:**
- Modify: `src/world.ts`, `src/ui.ts`, `src/main.ts`, `src/style.css`, `index.html`

**Interfaces:**
- Consumes: `areaObjects` (Task 9); a propriedade de mapa `minimap` (Task 7).
- Produces, em `src/ui.ts`:
  - `showMinimap(src: string | null, label: string): void` (`null` esconde);
  - `moveMinimapDot(u: number, v: number): void` (frações 0..1).

- [ ] **Step 1: HTML do minimapa e créditos**

Aplicar em `index.html`:

```diff
diff --git a/index.html b/index.html
index ca3af36..aab8f10 100644
--- a/index.html
+++ b/index.html
@@ -11,6 +11,10 @@
   <div id="game"></div>
   <div id="ui">
     <div id="banner" class="gba" hidden></div>
+    <div id="minimap" class="gba" hidden>
+      <div id="minimap-map"><img id="minimap-img" alt="Minimapa"><span id="minimap-dot"></span></div>
+      <div id="minimap-label"></div>
+    </div>
     <div id="dialog" class="gba" hidden>
       <div id="dialog-label"></div>
       <div id="dialog-text"></div>
@@ -42,7 +46,8 @@
     <section id="credits" class="gba" hidden>
       <h2>Créditos</h2>
       <ul>
-        <li>Cenários e personagem: LimeZu (Modern Interiors, Modern Office) · limezu.itch.io</li>
+        <li>Cenários e personagem: LimeZu (Modern Interiors, Modern Exteriors, Modern Office) · limezu.itch.io</li>
+        <li>Mapa do campus: dados © colaboradores do OpenStreetMap (ODbL) · openstreetmap.org/copyright</li>
         <li>NPCs: PixelSerial (RPG Top-Down Character Pack) · pixelserial.itch.io</li>
         <li>Fonte: Pixelify Sans (SIL Open Font License)</li>
         <li>Equipamentos de laboratório, sons e código: equipe Biogame</li>
```

- [ ] **Step 2: Estilo do minimapa**

Aplicar em `src/style.css`:

```diff
diff --git a/src/style.css b/src/style.css
index 3b37031..aab1d23 100644
--- a/src/style.css
+++ b/src/style.css
@@ -17,6 +17,11 @@ html, body { margin: 0; height: 100%; overflow: hidden; background: #1d1f2b; }
 #banner { position: absolute; top: 16px; left: 16px; padding: 8px 18px; font-size: 22px; animation: slide 3s ease forwards; }
 @keyframes slide { 0% { transform: translateY(-140%); } 10%, 85% { transform: none; } 100% { transform: translateY(-140%); } }
 
+#minimap { position: absolute; top: 16px; right: 16px; padding: 8px; font-size: 16px; text-align: center; }
+#minimap-map { position: relative; width: 160px; line-height: 0; }
+#minimap-img { width: 100%; image-rendering: pixelated; border-radius: 6px; }
+#minimap-dot { position: absolute; width: 8px; height: 8px; margin: -4px 0 0 -4px; border-radius: 50%; background: #e0303a; border: 2px solid #fff; }
+#minimap-label { margin-top: 6px; max-width: 160px; }
 #prompt, #tag, #balloon { position: absolute; transform: translate(-50%, -100%); white-space: nowrap; }
 #prompt { font-size: 18px; padding: 2px 8px; background: #fff; border: 3px solid var(--frame); border-radius: 6px; animation: bob .8s steps(2) infinite; }
 #tag { font-size: 16px; padding: 1px 8px; color: #fff; background: rgba(20, 24, 40, .75); border-radius: 8px; }
```

- [ ] **Step 3: Funções da interface**

Aplicar em `src/ui.ts`:

```diff
diff --git a/src/ui.ts b/src/ui.ts
index 1da32f9..c462fd6 100644
--- a/src/ui.ts
+++ b/src/ui.ts
@@ -143,3 +143,18 @@ export function openCreator(parts: Parts, initial: Character, onPlay: (c: Charac
   box.hidden = false;
   void redraw();
 }
+
+/** Minimapa do setor (canto superior direito); `null` esconde. */
+export function showMinimap(src: string | null, label: string): void {
+  el('minimap').hidden = !src;
+  if (!src) return;
+  el<HTMLImageElement>('minimap-img').src = src;
+  el('minimap-label').textContent = label;
+}
+
+/** Ponto do jogador no minimapa, em frações (0..1) da largura e da altura do mapa. */
+export function moveMinimapDot(u: number, v: number): void {
+  const dot = el('minimap-dot');
+  dot.style.left = `${Math.max(0, Math.min(1, u)) * 100}%`;
+  dot.style.top = `${Math.max(0, Math.min(1, v)) * 100}%`;
+}
```

- [ ] **Step 4: Sem lista fixa de tilesets**

Aplicar em `src/main.ts`:

```diff
diff --git a/src/main.ts b/src/main.ts
index a424e96..1d1062e 100644
--- a/src/main.ts
+++ b/src/main.ts
@@ -5,7 +5,6 @@ import { defaultCharacter, layerUrls, loadSavedRaw, parseSaved, saveCharacter, t
 import { composeLayers } from './compose.ts';
 import { initUi, openCreator } from './ui.ts';
 
-const TILESETS = ['limezu-floors', 'limezu-walls', 'ufrn-lab'];
 const START: WorldData = { map: 'cb-lab', entry: 'default' };
 
 class Boot extends Phaser.Scene {
@@ -14,7 +13,6 @@ class Boot extends Phaser.Scene {
   }
 
   preload(): void {
-    for (const t of TILESETS) this.load.image(t, `tilesets/${t}.png`);
     for (const n of this.registry.get('npcs') as string[]) this.load.spritesheet(`npc:${n}`, `sprites/npc/${n}.png`, { frameWidth: 32, frameHeight: 32 });
   }
 
```

- [ ] **Step 5: A cena**

Aplicar em `src/world.ts`:

```diff
diff --git a/src/world.ts b/src/world.ts
index 4069e3f..8c9bcdc 100644
--- a/src/world.ts
+++ b/src/world.ts
@@ -1,5 +1,5 @@
 import Phaser from 'phaser';
-import { contains, entryPoint, near, parseAreas, type Area, type TiledObject } from './areas.ts';
+import { areaObjects, contains, entryPoint, near, parseAreas, type Area, type TiledObject } from './areas.ts';
 import { dirFromVelocity, limezuFrames, pixelserialFrames, type Dir } from './anims.ts';
 import { layerUrls, saveCharacter, type Character, type Parts } from './character.ts';
 import { composeLayers } from './compose.ts';
@@ -10,6 +10,7 @@ const SPEED = 80, RUN = 150, ZOOM = 3, TALK_PAD = 16, FEET = 12;
 const DIRS: Dir[] = ['right', 'up', 'left', 'down'];
 type Point = { x: number; y: number };
 export type WorldData = { map: string; entry: string; pos?: Point; prev?: { map: string; entry: string } };
+type RawMap = { tilesets: { name: string }[]; layers: { type: string; name: string; objects?: TiledObject[] }[] };
 type Keys = Record<'up' | 'down' | 'left' | 'right' | 'w' | 'a' | 's' | 'd' | 'run' | 'e' | 'z' | 'say' | 'esc' | 'mute' | 'edit', Phaser.Input.Keyboard.Key>;
 
 /** Lê uma propriedade do Tiled, venha como array [{name, value}] ou como objeto. */
@@ -31,6 +32,8 @@ export class World extends Phaser.Scene {
   private leaving = false;
   private busy = false;
   private balloon = { text: '', until: 0 };
+  private ready = false;
+  private mapSize = { w: 1, h: 1 };
 
   constructor() {
     super('world');
@@ -48,6 +51,7 @@ export class World extends Phaser.Scene {
     this.leaving = false;
     this.busy = false;
     this.balloon = { text: '', until: 0 };
+    this.ready = false;
   }
 
   preload(): void {
@@ -58,7 +62,21 @@ export class World extends Phaser.Scene {
   create(): void {
     const key = `map:${this.here.map}`;
     if (!this.cache.tilemap.exists(key)) return this.fail(`Mapa "${this.here.map}" não encontrado`);
+    // Tilesets carregados sob demanda pelo nome (tilesets/<nome>.png): mapa novo do Tiled não precisa de código.
+    const raw = this.cache.tilemap.get(key).data as RawMap;
+    const missing = raw.tilesets.map(t => t.name).filter(n => !this.textures.exists(n));
+    if (!missing.length) return this.build(key, raw);
+    missing.forEach(n => this.load.image(n, `tilesets/${n}.png`));
+    this.load.once(Phaser.Loader.Events.COMPLETE, () => {
+      missing.filter(n => !this.textures.exists(n)).forEach(n => console.warn(`[areas] tileset "${n}" não encontrado em tilesets/${n}.png`));
+      this.build(key, raw);
+    });
+    this.load.start();
+  }
+
+  private build(key: string, raw: RawMap): void {
     const map = this.make.tilemap({ key });
+    this.mapSize = { w: map.widthInPixels, h: map.heightInPixels };
     const tilesets = map.tilesets.map(t => map.addTilesetImage(t.name, t.name)).filter(t => t !== null);
     const solid = map.layers.map(l => {
       const layer = map.createLayer(l.name, tilesets) as Phaser.Tilemaps.TilemapLayer;
@@ -66,8 +84,7 @@ export class World extends Phaser.Scene {
     });
 
     // O Phaser 4.2.1 descarta o campo `class` dos objetos; lê-se o JSON cru (cache: { format, data }).
-    const raw = this.cache.tilemap.get(key).data as { layers: { type: string; name: string; objects?: TiledObject[] }[] };
-    const parsed = parseAreas(raw.layers.find(l => l.type === 'objectgroup' && l.name === 'areas')?.objects ?? []);
+    const parsed = parseAreas(areaObjects(raw.layers));
     parsed.warnings.forEach(w => console.warn(w));
     this.areas = parsed.areas;
 
@@ -98,17 +115,21 @@ export class World extends Phaser.Scene {
     const title = String(prop(map.properties, 'name') ?? '').trim();
     if (!title) console.warn(`[areas] mapa "${this.here.map}" sem propriedade "name"`);
     ui.showBanner(title || this.here.map);
+    const minimap = String(prop(map.properties, 'minimap') ?? '');
+    ui.showMinimap(minimap || null, title || this.here.map);
+    this.ready = true;
     this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
       this.scale.off(Phaser.Scale.Events.RESIZE, fit);
       this.sound.removeAll();
       ui.showDialog(null);
       ui.showPrompt(null);
       ui.closePanel();
+      ui.showMinimap(null, '');
     });
   }
 
   update(time: number): void {
-    if (this.leaving || this.busy) return;
+    if (this.leaving || this.busy || !this.ready) return;
     const k = this.keys, down = Phaser.Input.Keyboard.JustDown;
     const act = down(k.e) || down(k.z);
     if (down(k.mute)) this.sound.mute = !this.sound.mute;
@@ -155,7 +176,12 @@ export class World extends Phaser.Scene {
 
   private makePlayer(map: Phaser.Tilemaps.Tilemap): Phaser.Physics.Arcade.Sprite {
     const img = this.registry.get('playerImage') as HTMLImageElement;
-    const tex = `player-v${this.registry.get('playerVersion') as number}`;
+    const version = this.registry.get('playerVersion') as number, tex = `player-v${version}`, old = `player-v${version - 1}`;
+    // cada edição de personagem gera uma textura nova (~2,4 MB); a anterior já não tem sprite usando
+    if (this.textures.exists(old)) {
+      for (const d of DIRS) for (const a of ['idle', 'walk']) this.anims.remove(`${old}-${a}-${d}`);
+      this.textures.remove(old);
+    }
     if (!this.textures.exists(tex)) this.textures.addSpriteSheet(tex, img, { frameWidth: 16, frameHeight: 32 });
     const cols = Math.floor(img.width / 16);
     for (const d of DIRS) {
@@ -217,6 +243,7 @@ export class World extends Phaser.Scene {
   }
 
   private go(next: { map: string; entry: string }): void {
+    if (this.leaving) return; // duas portas no mesmo quadro (ex.: canto de setor) disparam uma vez só
     this.leaving = true;
     this.player.setVelocity(0, 0);
     this.cameras.main.fadeOut(200);
@@ -284,6 +311,7 @@ export class World extends Phaser.Scene {
   private overlays(time: number): void {
     const head = this.toScreen(this.player.x, this.player.y - 18);
     ui.showTag((this.registry.get('character') as Character).name, head);
+    ui.moveMinimapDot(this.player.x / this.mapSize.w, (this.player.y + FEET) / this.mapSize.h);
     ui.showBalloon(time < this.balloon.until ? this.balloon.text : null, { x: head.x, y: head.y - 26 });
   }
 
```

- [ ] **Step 6: Testes, tipos e build**

Run: `npm test && npm run build`
Expected: todos os testes passam (65), `tsc` limpo, build gera `dist/` (o aviso de tamanho de chunk do Phaser é o mesmo do Plano 1).

- [ ] **Step 7: Conferir no navegador**

Subir um servidor só seu (nunca o do usuário): `npx vite --port 5198 --strictPort` em background. Rodar `npm run vendor` antes, se `public/tilesets/limezu-campus.png` não existir.

Atenção ao Playwright e ao Phaser:

- **Teclas:** o `browser_press_key` aperta e solta no mesmo quadro, e o Phaser 4.2.1 perde o `JustDown`. Use `browser_run_code_unsafe` com `page.keyboard.down`, espera de ≥120 ms e `page.keyboard.up`.
- **Criador:** o personagem fica salvo em `localStorage`, então o criador só abre na primeira visita.

Os roteiros abaixo começam o jogo direto num mapa: eles interceptam `maps/cb-lab.tmj` e servem outro mapa no lugar, opcionalmente movendo a entrada `default`.

Salvar como `.playwright-mcp/check-campus.js` (pasta ignorada pelo git) e rodar com `browser_run_code_unsafe` (`filename`):

```js
async (page) => {
  const BASE = 'http://localhost:5198/';
  const hold = async (k, ms) => { await page.keyboard.down(k); await page.waitForTimeout(ms); await page.keyboard.up(k); };
  const log = [];
  page.on('console', m => { if (m.type() === 'warning' || m.type() === 'error') log.push(`${m.type()}: ${m.text()}`); });
  page.on('pageerror', e => log.push(`pageerror: ${e}`));
  const startAt = async (map, move) => {
    await page.unrouteAll();
    await page.route('**/maps/cb-lab.tmj', async route => {
      const json = await (await page.request.get(`${BASE}maps/${map}.tmj`)).json();
      if (move) for (const l of json.layers) for (const o of l.objects ?? []) if (o.name === 'default') Object.assign(o, move(json));
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(json) });
    });
    await page.goto(BASE);
    await page.waitForTimeout(3000);
    if (await page.isVisible('#creator')) { await page.click('#creator-play'); await page.waitForTimeout(3000); }
  };
  const ui = () => page.evaluate(() => ({
    banner: document.getElementById('banner').textContent,
    minimap: !document.getElementById('minimap').hidden && document.getElementById('minimap-label').textContent,
    prompt: !document.getElementById('prompt').hidden,
    dialog: !document.getElementById('dialog').hidden && document.getElementById('dialog-text').textContent,
  }));
  const out = {};
  // 1) corredor → porta da direita → campus
  await startAt('cb-corredor');
  await hold('ArrowRight', 2600);
  await page.waitForTimeout(2500);
  out.corridorToCampus = await ui();
  // 2) placa do museu: nasce 2 tiles abaixo dela, sobe, fala
  await startAt('campus-4-4', json => {
    const sign = json.layers.flatMap(l => l.objects ?? []).find(o => o.name === 'ponto-museu-do-carro');
    return { x: sign.x, y: sign.y + 32 };
  });
  await hold('ArrowUp', 250);
  await page.waitForTimeout(300);
  const nearSign = await ui();
  await hold('z', 120);
  await page.waitForTimeout(1500);
  out.museum = { prompt: nearSign.prompt, ...(await ui()) };
  await page.screenshot({ path: '/home/paulorh/projects/biogame/.playwright-mcp/check-museum.png' });
  out.log = log.filter(l => !l.includes('GL Driver') && !l.includes('sandbox'));
  return out;
}
```

Expected:

- `corridorToCampus.banner` e `corridorToCampus.minimap` = `"Campus · CB"`;
- `museum.dialog` = `"Museu do Carro da ECT"`;
- `log` sem `pageerror`, sem erro e sem aviso `[areas]` (os avisos de AudioContext são normais).

Abrir `.playwright-mcp/check-museum.png` e conferir:

- carros de lado nos estacionamentos;
- a placa cinza logo acima do jogador;
- o minimapa no canto superior direito com o nome do setor;
- a caixa de diálogo GBA.

Depois, rodar dois roteiros curtos com `browser_run_code_unsafe`:

```js
// clone sem assets comprados: o campus abre com aviso e sem travar
async (page) => {
  const log = [];
  page.on('console', m => log.push(`${m.type()}: ${m.text()}`));
  page.on('pageerror', e => log.push(`pageerror: ${e}`));
  await page.unrouteAll();
  await page.route('**/maps/cb-lab.tmj', async r => r.fulfill({ status: 200, contentType: 'application/json', body: await (await page.request.get('http://localhost:5198/maps/campus-3-3.tmj')).body() }));
  await page.route('**/tilesets/limezu-campus.png', r => r.fulfill({ status: 404, body: '' }));
  await page.goto('http://localhost:5198/');
  await page.waitForTimeout(4000);
  return { minimap: await page.isVisible('#minimap'), log: log.filter(l => l.includes('[areas]') || l.startsWith('pageerror')) };
}
```

Expected: `minimap: true` e `log` com uma única linha, o aviso `[areas] tileset "limezu-campus" não encontrado em tilesets/limezu-campus.png`, sem `pageerror`.

```js
// editar o personagem 3 vezes seguidas (a textura anterior é removida a cada vez)
async (page) => {
  const errors = [];
  page.on('pageerror', e => errors.push(String(e)));
  await page.unrouteAll();
  await page.goto('http://localhost:5198/');
  await page.waitForTimeout(3000);
  if (await page.isVisible('#creator')) { await page.click('#creator-play'); await page.waitForTimeout(3000); }
  const rounds = [];
  for (let i = 0; i < 3; i++) {
    await page.keyboard.down('c'); await page.waitForTimeout(120); await page.keyboard.up('c');
    await page.waitForTimeout(500);
    const open = await page.isVisible('#creator');
    if (open) { await page.click('.row[data-part=hair] button[data-dir="1"]'); await page.click('#creator-play'); await page.waitForTimeout(2500); }
    rounds.push(open);
  }
  return { rounds, errors };
}
```

Expected: `rounds: [true, true, true]`, `errors: []`, e numa screenshot o jogador aparece com o cabelo novo.

Parar o servidor da porta 5198 no fim.

- [ ] **Step 8: Commit**

```bash
git add src/world.ts src/ui.ts src/main.ts src/style.css index.html
git commit -m "feat: jogo carrega o campus (tilesets sob demanda, osm-areas, minimapa, créditos OSM)

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

