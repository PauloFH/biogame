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
