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
