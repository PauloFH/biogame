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
