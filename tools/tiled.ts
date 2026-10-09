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
