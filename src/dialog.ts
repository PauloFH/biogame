export type Dialog = { label: string; pages: string[]; page: number; shown: number };

export function openDialog(label: string, pages: string[]): Dialog | null {
  return pages.length ? { label, pages, page: 0, shown: 0 } : null;
}

/** Revela mais `n` letras da página atual (efeito máquina de escrever). */
export function reveal(d: Dialog, n: number): Dialog {
  return { ...d, shown: Math.min(d.pages[d.page].length, d.shown + n) };
}

/** Tecla de ação: completa a página; se já completa, avança; depois da última, fecha (null). */
export function press(d: Dialog): Dialog | null {
  if (d.shown < d.pages[d.page].length) return { ...d, shown: d.pages[d.page].length };
  return d.page + 1 < d.pages.length ? { ...d, page: d.page + 1, shown: 0 } : null;
}

export const visibleText = (d: Dialog): string => d.pages[d.page].slice(0, d.shown);
