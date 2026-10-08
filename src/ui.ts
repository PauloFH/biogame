import { visibleText, type Dialog } from './dialog.ts';
import { cleanName, cycle, layerUrls, type Character, type PartKind, type Parts } from './character.ts';
import { composeLayers } from './compose.ts';

export type Point = { x: number; y: number };
const el = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;
const LABELS: Record<PartKind, string> = { body: 'Corpo', eyes: 'Olhos', outfit: 'Roupa', hair: 'Cabelo', acc: 'Acessório' };

/** O Phaser escuta teclas no window; o que se digita num campo não pode chegar até ele. */
export function shieldKeys(input: HTMLElement): void {
  for (const type of ['keydown', 'keyup'] as const) input.addEventListener(type, e => e.stopPropagation());
}

export function initUi(): void {
  shieldKeys(el('say-input'));
  shieldKeys(el('creator-name'));
  el('panel-close').onclick = closePanel;
  el('credits-close').onclick = () => { el('credits').hidden = true; };
  el('creator-credits').onclick = () => { el('credits').hidden = false; };
  for (const row of document.querySelectorAll<HTMLElement>('#creator .row')) row.querySelector('span')!.textContent = LABELS[row.dataset.part as PartKind];
}

function place(node: HTMLElement, p: Point | null): void {
  node.hidden = !p;
  if (p) {
    node.style.left = `${p.x}px`;
    node.style.top = `${p.y}px`;
  }
}

export function showDialog(d: Dialog | null): void {
  el('dialog').hidden = !d;
  if (!d) return;
  el('dialog-label').textContent = d.label;
  el('dialog-text').textContent = visibleText(d);
  el('dialog-next').hidden = d.shown < d.pages[d.page].length;
}

let bannerTimer = 0;
export function showBanner(text: string): void {
  const b = el('banner');
  b.textContent = text;
  b.hidden = false;
  b.style.animation = 'none';
  void b.offsetWidth;
  b.style.animation = '';
  clearTimeout(bannerTimer);
  bannerTimer = window.setTimeout(() => { b.hidden = true; }, 3000);
}

export const showPrompt = (p: Point | null): void => place(el('prompt'), p);

export function showTag(name: string, p: Point): void {
  el('tag').textContent = name;
  place(el('tag'), p);
}

export function showBalloon(text: string | null, p: Point): void {
  if (text) el('balloon').textContent = text;
  place(el('balloon'), text ? p : null);
}

export function openSay(onSubmit: (text: string) => void, onClose: () => void): void {
  const form = el<HTMLFormElement>('say'), input = el<HTMLInputElement>('say-input');
  const close = () => {
    form.onsubmit = null;
    input.onkeydown = null;
    input.onblur = null;
    form.hidden = true;
    input.blur();
    onClose();
  };
  form.hidden = false;
  input.value = '';
  input.focus();
  form.onsubmit = e => {
    e.preventDefault();
    const text = input.value.trim().slice(0, 60);
    if (text) onSubmit(text);
    close();
  };
  input.onkeydown = e => { if (e.key === 'Escape') close(); };
  input.onblur = close;
}

export function openPanel(url: string): void {
  el('panel').hidden = false;
  el<HTMLAnchorElement>('panel-open').href = url;
  const frame = el<HTMLIFrameElement>('panel-frame');
  if (frame.src !== url) frame.src = url;
}

export function closePanel(): void {
  if (el('panel').hidden) return;
  el('panel').hidden = true;
  el<HTMLIFrameElement>('panel-frame').src = 'about:blank';
}

/** Tela de criação. Preview anima a caminhada olhando para baixo (linha 2, quadros 18-23). */
export function openCreator(parts: Parts, initial: Character, onPlay: (c: Character) => void, onCancel?: () => void): void {
  const box = el('creator'), name = el<HTMLInputElement>('creator-name');
  const ctx = el<HTMLCanvasElement>('creator-preview').getContext('2d')!;
  let look = { ...initial.look }, sheet: HTMLImageElement | null = null, frame = 0, version = 0;
  const redraw = async () => {
    const v = ++version;
    try {
      const img = await composeLayers(layerUrls(look));
      if (v === version) sheet = img;
    } catch (err) {
      console.error(err);
    }
  };
  const timer = window.setInterval(() => {
    if (!sheet) return;
    frame = (frame + 1) % 6;
    ctx.clearRect(0, 0, 16, 32);
    ctx.drawImage(sheet, (18 + frame) * 16, 64, 16, 32, 0, 0, 16, 32);
  }, 140);
  for (const row of box.querySelectorAll<HTMLElement>('.row')) {
    const kind = row.dataset.part as PartKind;
    for (const b of row.querySelectorAll<HTMLButtonElement>('button')) {
      b.onclick = () => {
        look = { ...look, [kind]: cycle(parts, kind, look[kind], Number(b.dataset.dir) as 1 | -1) };
        void redraw();
      };
    }
  }
  const finish = (then: () => void) => {
    clearInterval(timer);
    box.hidden = true;
    document.removeEventListener('keydown', onKey, true);
    then();
  };
  // Captura: roda antes do stopPropagation do campo de nome, senão Esc no campo não cancelaria.
  const onKey = (e: KeyboardEvent) => { if (onCancel && e.key === 'Escape' && el('credits').hidden) finish(onCancel); };
  el('creator-play').onclick = () => finish(() => onPlay({ name: cleanName(name.value), look }));
  if (onCancel) document.addEventListener('keydown', onKey, true);
  name.value = initial.name;
  box.hidden = false;
  void redraw();
}
