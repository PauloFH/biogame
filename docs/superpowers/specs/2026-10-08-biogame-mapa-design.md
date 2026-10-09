# Biogame: mini WorkAdventure da UFRN (v1: campus e motor)

> **Status:** aprovada em 2026-10-08 (ajustada depois com a referência visual e os arquivos comprados,
> e de novo com o protótipo do campus aprovado pelo usuário no Plano 2).
> Mockups da conversa (só locais): `.superpowers/brainstorm/*/content/telas-v{1,2,3}.html`.

## Objetivo

Jogo educacional no navegador, top-down, com a mecânica do **WorkAdventure** e o visual da
**referência visual** (pixel art estilo Pokémon de GBA).

**Referência visual oficial** (só local, fora do git: `2026-10-08-biogame-referencia-visual.jpg`
nesta pasta; tem um personagem no estilo Pokémon e o brasão da UFRN, então não vai para o
repositório público). O que importa nela: tiles 16×16 com contorno e sombreado estilo
GBA; caixas de diálogo de borda dupla arredondada; banner com o nome do local no canto superior
esquerdo; minimapa com o nome do setor no canto superior direito; identidade da UFRN (brasão,
placas como DACB, janela para a Mata dos Saguis). **Nenhum asset da Nintendo** (sprites,
personagens, o protagonista de boné vermelho): só o estilo.

Ambientado no
**Campus Central da UFRN** reconstruído a partir de dados reais (OpenStreetMap). O jogador
cria um personagem, anda pelo campus, entra no laboratório do CB e interage com objetos,
NPCs e sites. Os **minigames ficam para um projeto seguinte**; a v1 é o campus e o motor
onde eles vão se encaixar.

Sem servidor e sem multiplayer.

### Decisões

| Tema | Decisão |
|---|---|
| Propósito | Educacional (conteúdo dos minigames definido depois) |
| Mapa v1 | Campus Central **inteiro**, layout real do OSM, **todos os prédios com nome têm fachada caprichada**; interior só do laboratório do CB |
| Arte | **LimeZu** (Modern Interiors, Exteriors, Office, comprados) + **PixelSerial** (NPCs) + **arte gerada por código no mesmo estilo** para o que falta (equipamentos de laboratório, identidade visual da UFRN, caixas de diálogo GBA) |
| Interações v1 | Portas entre mapas, placas, NPCs com diálogo, painel com site/iframe, balão de fala, som ambiente por área |
| Stack | Vite + TypeScript + **Phaser 4.2** + Tiled; deploy estático |
| Licenças | Créditos **LimeZu** e **OpenStreetMap (ODbL)** obrigatórios numa tela de créditos. PNGs do LimeZu **nunca** vão para o git. Tiles do WorkAdventure **não** podem ser usados (licença restrita a mapas do WA). |

### Fora da v1

Multiplayer · minigames · backend · controle por toque (só teclado) · salvar progresso além do
personagem · interiores além do laboratório (portas dos outros prédios mostram uma placa
"em breve").

---

## Parte 1: Arquitetura

```
index.html            ← canvas do Phaser + camadas HTML (diálogo, painel, criador)
public/
  maps/               ← campus-<col>-<lin>.tmj + .mini.png (campus em setores), cb-lab.tmj, cb-corredor.tmj
  tilesets/ufrn-*.png ← tilesets gerados por nós (versionados)
  tilesets/limezu-*.png ← montados a partir de vendor/ (fora do git)
  audio/
vendor/               ← zips/ comprados e x/ extraídos (fora do git)
tools/
  osm-data.ts         ← baixa o OSM e grava o recorte em metros (tools/data/campus.json, versionado)
  grid.ts, campus.ts  ← rasteriza em células de 2 m, corta em setores, monta as camadas osm-*
  osm.ts              ← CLI: grava os setores (.tmj + minimapa) sem apagar o trabalho manual
  tilegen.ts          ← gera os PNGs ufrn-* de public/tilesets/
  vendor.ts           ← copia os PNGs do LimeZu e monta o atlas limezu-campus
src/
  main.ts             ← configuração do Phaser
  World.ts            ← a única cena: carrega um mapa, jogador, colisão, câmera
  player.ts           ← movimento + sprite do personagem a partir das camadas
  areas.ts            ← lê as áreas do Tiled e diz o que cada uma faz
  ui.ts               ← diálogo, painel iframe, balão, criador de personagem (DOM)
```

- **Uma cena só.** `World` recebe `{ map, entry }`. Porta (ou borda de setor) = reiniciar a
  cena com outro mapa. Mapa novo é só um arquivo do Tiled, sem código.
- **Interface em HTML/CSS** por cima do canvas, no estilo GBA da referência (diálogo, banner,
  minimapa).
- **`areas.ts`** transforma objetos do Tiled em lista tipada de áreas: é a lógica central e
  leva teste.

### Campus em setores

O Phaser cria um objeto `Tile` por célula ao carregar o mapa, inclusive as vazias (conferido
no código do 4.2.1). O campus num mapa só (~930×690 tiles por camada) daria milhões de
objetos. Por isso:

- **Escala: 2 m por tile** (confirmada no protótipo: os carros de 4×3 tiles cabem nas vagas
  reais). Só as distâncias e as pegadas dos prédios seguem o OSM; pessoas, carros e móveis
  mantêm o tamanho do sprite. O campus inteiro dá uma grade de ~932×687 tiles.
- A grade é **cortada em setores de 160×160 tiles**, nomeados pela posição
  (`campus-<coluna>-<linha>`). Setores só com área fora do campus não viram mapa. Resultado:
  22 setores. O banner de cada um mostra o maior prédio com nome dele (`Campus · CB`).
- As bordas entre setores são pares de `door` + `entry`: um trecho de 4 tiles andável dos dois
  lados vira uma porta na borda, com a entrada 2 tiles para dentro do vizinho, na mesma
  altura. Atravessar é só um fade curto.
- Medido no protótipo: 160×160 com `TilemapLayer` normal roda a 60 FPS com ~90 MB de heap.
  `TilemapGPULayer` não é necessário.

### Pipeline do mapa

```
 OSM (API 0.6) ──► osm-data.ts ──► campus.json ──► osm.ts ──► campus-*.tmj
                                   pontos.json ──┘           │  camadas osm-*: chão, calçada,
                                                              │  grama, terreno (estacionamento,
                                                              │  telhado = pegada com colisão, água,
                                                              │  mata), detalhes, objetos (carros,
                                                              │  troncos, placas), copas, osm-areas
                                                              ▼
                                    Tiled (à mão): fachadas sobre as pegadas,
                                    decoração, áreas (portas, placas, NPCs, sons)
                                                     │
                                                     ▼
                                              jogo carrega o setor
```

**Regra de ouro:** `tools/osm.ts` só escreve nas camadas com prefixo `osm-`. Regerar o OSM
nunca apaga o trabalho manual feito no Tiled: num setor que já existe, cada camada `osm-*` é
trocada no lugar onde estava, e camadas, áreas, tilesets e propriedades manuais ficam. Um
tileset manual com `firstgid` dentro da faixa do gerado dá erro, com a instrução de movê-lo.

**Pontos de interesse** (`tools/data/pontos.json`): nome, lat/lon e texto. Cada um vira uma
placa (`sign`) na célula andável mais próxima. Primeiro ponto: o Museu do Carro da ECT, na Rua
da Tecnologia, ao sul do estacionamento da ECT. Prédios com nome no OSM também ganham uma placa
com o nome em frente à fachada. O CB ganha a porta para o corredor e o vigilante.

### Arte

- **LimeZu** é a base: chão, ruas, carros, vegetação, prédios modulares, interiores,
  personagens e interface.
- **Campus:** o `vendor.ts` monta um atlas único (`limezu-campus.png`) com o que o gerador usa:
  - autotiles "blob" de 47 peças do Modern Exteriors (layout Godot): gramado, calçada,
    estacionamento, telhado, mata e água;
  - carros 1–6, **sempre de lado**, em fileiras;
  - 8 árvores de rua, tufos de grama e flores;
  - a placa de informação que marca toda área `sign` do campus.
- **PixelSerial RPG Top-Down Character Pack** (já comprado): NPCs prontos, só os de tema
  moderno (policial → vigilante, executivo → professor etc.), com caminhada em 4 direções.
  Não serve para o criador de personagem (não tem camadas).
- **`tools/tilegen.ts`** gera o que falta no mesmo estilo (o mockup v3 mostrou que funciona):
  bancadas, microscópios, capela de exaustão, vidrarias, letreiros e faixa azul da UFRN,
  elementos de fachada específicos dos marcos.
- **Volume:** cerca de 80 prédios com nome no OSM recebem fachada caprichada; cerca de 110
  sem nome recebem fachada genérica (variações). O plano de implementação fatia isso por setor.

### Deploy

`vite build` local, que precisa de `vendor/` (fora do git), e publica a pasta `dist/`
(GitHub Pages ou similar). Servir os PNGs dentro do jogo publicado é uso normal permitido
pela licença; o proibido é distribuir o pacote em si.

---

## Parte 2: Convenção do mapa no Tiled

O comportamento mora nas propriedades do Tiled, como no WA. Tiles de **16×16** (o jogo
aplica zoom 3×). Todo mapa tem a propriedade `name` (texto do banner do local).

### Camadas de tiles

- Camadas `osm-*` são geradas, **não editar à mão** (serão sobrescritas). Nos setores:
  `osm-chao`, `osm-calcada`, `osm-grama`, `osm-terreno`, `osm-detalhes`, `osm-objetos`,
  `osm-copas`.
- As demais são manuais, desenhadas na ordem normal (camada nova pode ficar entre as `osm-*`;
  a posição se mantém ao regerar).
- Camada com propriedade `above: true` é desenhada **por cima** do jogador (copa de árvore,
  telhado, batente de porta).
- **Colisão no tileset:** tile que bloqueia recebe `collides: true` uma vez no tileset.
  No campus, já colidem: telhados (as pegadas dos prédios), mata, água, carros, a linha do
  tronco das árvores e o pé das placas.
- **Tilesets:** o jogo carrega `tilesets/<nome>.png` pelo nome do tileset no `.tmj`, sob
  demanda. Tileset novo no Tiled = PNG com o mesmo nome em `public/tilesets/`, sem código.
  Faltando o PNG: aviso `[areas]` e o mapa abre sem aquela arte.
- Propriedades do mapa: `name` (banner) e, nos setores, `minimap` (imagem do setor, 1 pixel
  por tile, gerada pelo `tools/osm.ts`).

### Camadas de objetos `areas` e `osm-areas`

As áreas são lidas das duas camadas de objetos: `areas` (feita à mão) e `osm-areas` (gerada:
entradas, passagens entre setores, placas dos prédios e dos pontos, porta do CB; não editar).

| Class | Propriedades | Comportamento |
|---|---|---|
| `entry` | *(nome do objeto = id)* | Onde o jogador aparece. Todo mapa precisa de um `default`. |
| `door` | `map`, `entry` | Ao **pisar**: fade e carrega `map` no ponto `entry`. Também usada nas bordas entre setores. |
| `sign` | `text` | Perto + **E**: caixa de texto. Linha `---` separa páginas. |
| `npc` | `name`, `sprite`, `text` | Desenha o NPC parado (bloqueia passagem). Perto + **E/Z**: diálogo com o nome dele. `sprite` = nome do personagem em kebab-case (ex.: `old-man`). |
| `website` | `url`, `trigger` (`enter` \| `key`) | Painel lateral com iframe. Fecha ao sair da área ou com **Esc**. |
| `sound` | `src`, `volume` | Loop enquanto o jogador está dentro, com fade. Área do tamanho do mapa = música do mapa. |

- **Erros de mapa não quebram o jogo:** Class desconhecida ou propriedade faltando vira
  aviso no console com o nome do objeto, ex. `[areas] door "porta-lab" sem propriedade "map"`.
- **Iframe:** muitos sites bloqueiam (o SIGAA provavelmente). O painel sempre mostra
  **"abrir em nova aba"**.

---

## Parte 3: Personagem, interface e testes

### Personagem

- **Primeira visita:** tela de criação com nome + partes (corpo/pele, cabelo, roupa,
  acessório), setas ◀ ▶ e preview animado. Salvo em `localStorage`. Tecla **C** reabre.
- **Partes:** camadas do gerador de personagem do Modern Interiors (PNGs soltos em
  `2_Characters/Character_Generator`): 9 corpos, olhos, 132 roupas, 200 cabelos, acessórios.
  Empilhadas **nesta ordem**: corpo → olhos → roupa → cabelo → acessório, e "assadas" numa
  textura única ao entrar no mundo (um sprite, uma animação).
- **Folha de animação** (16×16): quadro de 16×32; linha 1 = idle, linha 2 = walk, cada uma
  com 4 direções × 6 quadros, na ordem direita, cima, esquerda, baixo. Também há sentar,
  celular, ler etc. para uso futuro.
- **NPCs prontos (PixelSerial):** quadros de 32×32, 4 direções, idle e walk com 4 quadros.
  Testado lado a lado com o LimeZu: mesma densidade de pixel, cabeça um pouco maior; serve.
- Nome acima da cabeça, como no WA.

### Interface e controles

| Tecla | Ação |
|---|---|
| Setas / WASD | Andar |
| Shift | Correr (o campus é grande) |
| E ou Z | Interagir; avançar diálogo |
| Enter | Escrever balão de fala (até 60 caracteres, some em ~5 s) |
| Esc | Fechar diálogo/painel |
| M | Liga/desliga som |
| C | Editar personagem |

- Indicador de interação sobre placa/NPC quando perto.
- **Diálogo estilo GBA** da referência: caixa de borda dupla arredondada, texto aparecendo
  letra a letra, ▼ para avançar. Gerado por nós (CSS + fonte pixel), sem pacote de UI.
- **Banner do local** (canto superior esquerdo) com o nome do mapa/área ao entrar
  (propriedade `name` do mapa no Tiled).
- **Minimapa** (canto superior direito): imagem pequena do setor gerada pelo `tools/osm.ts`,
  com um ponto no jogador e o nome do setor embaixo.
- Pixel art nítido: `pixelArt: true` + zoom inteiro da câmera (3×, como na referência).
- **Áudio:** o clique em "Jogar" na tela de criação destrava o som (política dos navegadores).
- **Tela de créditos:** LimeZu, OpenStreetMap, fontes.

### Testes e verificação

- **`areas.ts`:** `node --test` (Node 26 roda TS direto) com um JSON mínimo do Tiled: tipos
  válidos, propriedade faltando → aviso, Class desconhecida → aviso.
- **Gerador do campus:** testes com um recorte OSM minúsculo (fixture) e com campus sintéticos.
  Eles conferem:
  - o recorte e a projeção;
  - a rasterização;
  - os setores e as passagens;
  - as camadas e áreas geradas;
  - que carros e árvores não tapam passagens;
  - que camadas manuais ficam intactas ao regerar.

  O lint dos mapas roda sobre todos os `.tmj` publicados.
- **No navegador** (Playwright): criar personagem, andar até a borda do setor, trocar de mapa,
  entrar no lab, abrir placa e NPC, tirar screenshot.

### Pré-requisitos (feito em 2026-10-08)

- Comprados e em `vendor/zips/`: Modern Interiors (completo), Modern Exteriors, Modern Office
  Revamped, Character Generator 2.0 Linux, PixelSerial RPG Top-Down Character Pack (completo).
  Extraídos em `vendor/x/`. Modern User Interface **não** foi comprado (diálogo é gerado).
  Arquivos que não usamos (versões RPG Maker, instalador Windows) ficam em `vendor/extras/`.
- Instalar o [Tiled](https://www.mapeditor.org/) para quem for editar mapa.

### Confirmado com os arquivos (2026-10-08)

- As versões 32×32 e 48×48 do LimeZu são ampliações da 16×16 (diferença medida: 0 a 0,7% dos
  pixels). Usamos **16×16 com zoom 3×**.
- Temas úteis do Exteriors: escola, veículos, hospital, escritório, jardim, prédios genéricos e
  modulares, terrenos de cidade. Do Interiors: sala de aula e biblioteca, auditório, hospital,
  museu (Museu de Morfologia), cozinha (RU).

### Medido no protótipo do campus (2026-10-08)

- Escala: 2 m/tile; os carros de lado (4×3 tiles) cabem nas vagas reais dos estacionamentos.
- Setor de 160×160 tiles: 60 FPS, ~90 MB de heap, troca de setor sem engasgo. A geração dos
  22 setores leva menos de 1 s.
