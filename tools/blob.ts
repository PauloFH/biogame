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
