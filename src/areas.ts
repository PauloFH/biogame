export type Rect = { x: number; y: number; w: number; h: number };

type Base = { name: string; rect: Rect };
export type Area =
  | (Base & { kind: 'entry' })
  | (Base & { kind: 'door'; map: string; entry: string })
  | (Base & { kind: 'sign'; pages: string[] })
  | (Base & { kind: 'npc'; label: string; sprite: string; pages: string[] })
  | (Base & { kind: 'website'; url: string; trigger: 'enter' | 'key' })
  | (Base & { kind: 'sound'; src: string; volume: number });

export type TiledProperty = { name: string; type?: string; value: unknown };
export type TiledObject = {
  name?: string; type?: string; class?: string;
  x: number; y: number; width?: number; height?: number;
  properties?: TiledProperty[];
};

/** Separa o texto em páginas nas linhas que têm só `---`. */
export function paginate(text: string): string[] {
  return text.split(/^\s*---\s*$/m).map(p => p.trim()).filter(Boolean);
}

export function contains(r: Rect, x: number, y: number): boolean {
  return x >= r.x && x < r.x + r.w && y >= r.y && y < r.y + r.h;
}

export function near(r: Rect, x: number, y: number, pad: number): boolean {
  return contains({ x: r.x - pad, y: r.y - pad, w: r.w + 2 * pad, h: r.h + 2 * pad }, x, y);
}

/** Centro da entry pedida; se não existir, a `default`; sem entries, null. */
export function entryPoint(areas: Area[], name: string): { x: number; y: number } | null {
  const e = areas.find(a => a.kind === 'entry' && a.name === name) ?? areas.find(a => a.kind === 'entry' && a.name === 'default');
  return e ? { x: e.rect.x + e.rect.w / 2, y: e.rect.y + e.rect.h / 2 } : null;
}

export function parseAreas(objects: TiledObject[]): { areas: Area[]; warnings: string[] } {
  const areas: Area[] = [], warnings: string[] = [];
  for (const o of objects) {
    const kind = o.type || o.class || '';
    const name = o.name || '(sem nome)';
    const props = new Map((o.properties ?? []).map(p => [p.name, p.value]));
    const str = (k: string) => {
      const v = props.get(k);
      return typeof v === 'string' ? v.trim() : '';
    };
    const need = (...keys: string[]) => {
      const missing = keys.filter(k => !str(k));
      for (const k of missing) warnings.push(`[areas] ${kind} "${name}" sem propriedade "${k}"`);
      return missing.length === 0;
    };
    const rect = { x: o.x, y: o.y, w: o.width ?? 0, h: o.height ?? 0 };
    switch (kind) {
      case 'entry':
        areas.push({ kind, name, rect });
        break;
      case 'door':
        if (need('map')) areas.push({ kind, name, rect, map: str('map'), entry: str('entry') || 'default' });
        break;
      case 'sign':
        if (need('text')) areas.push({ kind, name, rect, pages: paginate(str('text')) });
        break;
      case 'npc':
        if (need('sprite', 'text')) areas.push({ kind, name, rect, label: str('name') || name, sprite: str('sprite'), pages: paginate(str('text')) });
        break;
      case 'website': {
        if (!need('url')) break;
        const url = str('url');
        if (!/^https?:\/\//i.test(url)) {
          warnings.push(`[areas] website "${name}" com url inválida (use http/https): ${url}`);
          break;
        }
        const t = str('trigger');
        if (t && t !== 'enter' && t !== 'key') warnings.push(`[areas] website "${name}" com trigger inválido "${t}", usando "key"`);
        areas.push({ kind, name, rect, url, trigger: t === 'enter' ? 'enter' : 'key' });
        break;
      }
      case 'sound': {
        if (!need('src')) break;
        const v = Number(props.get('volume') ?? 0.5);
        areas.push({ kind, name, rect, src: str('src'), volume: Number.isFinite(v) ? Math.min(1, Math.max(0, v)) : 0.5 });
        break;
      }
      default:
        warnings.push(kind ? `[areas] Class desconhecida "${kind}" em "${name}"` : `[areas] objeto "${name}" sem Class`);
    }
  }
  if (!areas.some(a => a.kind === 'entry' && a.name === 'default')) warnings.push('[areas] mapa sem entry "default"');
  return { areas, warnings };
}
