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
