export type PartKind = 'body' | 'eyes' | 'outfit' | 'hair' | 'acc';
/** Ordem de empilhamento das camadas (a do gerador do LimeZu). */
export const PART_KINDS: PartKind[] = ['body', 'eyes', 'outfit', 'hair', 'acc'];
/** Pasta de cada peça em public/sprites/character/. */
export const PART_DIRS: Record<PartKind, string> = { body: 'bodies', eyes: 'eyes', outfit: 'outfits', hair: 'hairstyles', acc: 'accessories' };

export type Parts = Record<PartKind, string[]>;
/** Nome do arquivo de cada peça; `acc: ''` = sem acessório. */
export type Look = Record<PartKind, string>;
export type Character = { name: string; look: Look };

export const STORAGE_KEY = 'biogame.character';
export const NAME_MAX = 16;

export function cleanName(raw: string): string {
  return raw.replace(/\s+/g, ' ').trim().slice(0, NAME_MAX) || 'Calouro';
}

export function defaultCharacter(parts: Parts): Character {
  return { name: 'Calouro', look: { body: parts.body[0], eyes: parts.eyes[0], outfit: parts.outfit[0], hair: parts.hair[0], acc: '' } };
}

/** Lê o que veio do localStorage; null se ausente, corrompido ou com peça que não existe mais. */
export function parseSaved(raw: string | null, parts: Parts): Character | null {
  if (!raw) return null;
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    return null;
  }
  if (typeof data !== 'object' || data === null) return null;
  const { name, look } = data as { name?: unknown; look?: unknown };
  if (typeof name !== 'string' || typeof look !== 'object' || look === null) return null;
  const out = {} as Look;
  for (const k of PART_KINDS) {
    const v = (look as Record<string, unknown>)[k];
    if (typeof v !== 'string') return null;
    if (!(k === 'acc' && v === '') && !parts[k].includes(v)) return null;
    out[k] = v;
  }
  return { name: cleanName(name), look: out };
}

/** Próxima opção da peça, com volta. Acessório começa por '' (nenhum). */
export function cycle(parts: Parts, kind: PartKind, current: string, dir: 1 | -1): string {
  const list = kind === 'acc' ? ['', ...parts.acc] : parts[kind];
  const i = Math.max(0, list.indexOf(current));
  return list[(i + dir + list.length) % list.length];
}

export function layerUrls(look: Look): string[] {
  return PART_KINDS.filter(k => look[k]).map(k => `sprites/character/${PART_DIRS[k]}/${look[k]}`);
}

export function saveCharacter(c: Character): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(c));
  } catch {
    // ponytail: sem storage (aba privada/bloqueado) o jogo segue sem salvar; não há onde avisar melhor na v1
  }
}

export function loadSavedRaw(): string | null {
  try {
    return localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}
