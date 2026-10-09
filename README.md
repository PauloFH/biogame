# Biogame · UFRN

Jogo educacional no navegador, top-down, em pixel art no estilo GBA, ambientado no Campus Central da UFRN (Natal). A mecânica é inspirada no WorkAdventure: você cria o personagem, anda pelo campus reconstruído a partir do OpenStreetMap, entra no laboratório de Biofísica do CB, conversa com NPCs, lê placas e abre sites. Sem servidor e sem multiplayer.

## Rodar

Requer Node 24.2 ou mais novo, que roda os `.ts` das ferramentas direto.

Os gráficos de cenário e personagens vêm de pacotes pagos e **não estão no repositório**:

- LimeZu: Modern Interiors, Modern Exteriors e Modern Office ([limezu.itch.io](https://limezu.itch.io));
- PixelSerial: RPG Top-Down Character Pack ([pixelserial.itch.io](https://pixelserial.itch.io)).

Extraia os pacotes em `vendor/x/` (os caminhos esperados estão no topo de `tools/vendor.ts`) e rode:

```bash
npm install
npm run vendor
npm run dev
```

`npm run vendor` monta `public/tilesets/limezu-*` e `public/sprites/` a partir de `vendor/`. Os dois ficam fora do git.

| Script | O que faz |
|---|---|
| `npm test` | testes (`node --test`) |
| `npm run build` | checagem de tipos e build estático em `dist/` |
| `npm run osm:fetch` | baixa o campus da API do OpenStreetMap para `tools/data/campus.json` |
| `npm run osm` | gera os setores do campus em `public/maps/campus-*.tmj`, sem apagar o que foi editado à mão no Tiled |
| `npm run maps` / `npm run tiles` | geram o laboratório, o corredor e os tiles próprios |

Mapas são arquivos do [Tiled](https://www.mapeditor.org/); a convenção de camadas e áreas está em `docs/superpowers/specs/`.

## Créditos e licenças

- **Mapa do campus:** dados © colaboradores do OpenStreetMap, disponíveis sob a [Open Database License (ODbL)](https://www.openstreetmap.org/copyright). `tools/data/campus.json` e `public/maps/campus-*` são derivados desses dados e estão sob a mesma ODbL.
- **Fonte:** Pixelify Sans, sob a SIL Open Font License (`src/fonts/OFL.txt`).
- **Arte LimeZu e PixelSerial:** licença dos autores; não é redistribuída aqui.
- O estilo visual se inspira nos jogos de GBA. O projeto não tem nenhuma afiliação com a Nintendo e não usa nenhum asset dela.
