import { defaultCharacter, loadSavedRaw, parseSaved, saveCharacter, type Character, type Parts } from './character.ts';
import { initUi, openCreator } from './ui.ts';

async function getJson<T>(url: string): Promise<T> {
  const r = await fetch(url);
  if (!r.ok) throw new Error(`${url} → ${r.status}. Rodou "npm run vendor"?`);
  return r.json() as Promise<T>;
}

async function main(): Promise<void> {
  initUi();
  const parts = await getJson<Parts>('sprites/character/manifest.json');
  const character = parseSaved(loadSavedRaw(), parts) ?? await new Promise<Character>(done => openCreator(parts, defaultCharacter(parts), done));
  saveCharacter(character);
  console.log('personagem', character);
}

main().catch((err: unknown) => {
  console.error(err);
  const p = document.createElement('p');
  p.className = 'fatal';
  p.textContent = `Erro ao iniciar: ${err instanceof Error ? err.message : String(err)}`;
  document.body.append(p);
});
