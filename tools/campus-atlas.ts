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
