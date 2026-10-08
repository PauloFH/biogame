import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cleanName, cycle, defaultCharacter, layerUrls, parseSaved, type Parts } from './character.ts';

const parts: Parts = {
  body: ['Body_01.png', 'Body_02.png'],
  eyes: ['Eyes_01.png'],
  outfit: ['Outfit_01_01.png', 'Outfit_02_01.png'],
  hair: ['Hairstyle_01_01.png'],
  acc: ['Accessory_01_Ladybug_01.png'],
};
const valid = { name: 'Ana', look: { body: 'Body_02.png', eyes: 'Eyes_01.png', outfit: 'Outfit_02_01.png', hair: 'Hairstyle_01_01.png', acc: '' } };

test('parseSaved accepts a valid save', () => {
  assert.deepEqual(parseSaved(JSON.stringify(valid), parts), valid);
});

test('parseSaved returns null for missing, broken or foreign data', () => {
  for (const raw of [null, '', '{', '42', '"oi"', 'null', JSON.stringify({ name: 'x' }), JSON.stringify({ name: 1, look: valid.look })]) {
    assert.equal(parseSaved(raw, parts), null, String(raw));
  }
});

test('parseSaved returns null when a part is no longer in the manifest', () => {
  const stale = { ...valid, look: { ...valid.look, hair: 'Hairstyle_99_01.png' } };
  assert.equal(parseSaved(JSON.stringify(stale), parts), null);
});

test('parseSaved cleans the name', () => {
  assert.equal(parseSaved(JSON.stringify({ ...valid, name: '   Maria   da   Silva Pereira Souza  ' }), parts)?.name, 'Maria da Silva P');
  assert.equal(parseSaved(JSON.stringify({ ...valid, name: '   ' }), parts)?.name, 'Calouro');
});

test('cycle wraps both ways and the accessory list starts with "none"', () => {
  assert.equal(cycle(parts, 'body', 'Body_02.png', 1), 'Body_01.png');
  assert.equal(cycle(parts, 'body', 'Body_01.png', -1), 'Body_02.png');
  assert.equal(cycle(parts, 'acc', '', 1), 'Accessory_01_Ladybug_01.png');
  assert.equal(cycle(parts, 'acc', 'Accessory_01_Ladybug_01.png', 1), '');
});

test('layerUrls stacks body → eyes → outfit → hair → acc and skips "no accessory"', () => {
  assert.deepEqual(layerUrls(valid.look), [
    'sprites/character/bodies/Body_02.png',
    'sprites/character/eyes/Eyes_01.png',
    'sprites/character/outfits/Outfit_02_01.png',
    'sprites/character/hairstyles/Hairstyle_01_01.png',
  ]);
  assert.equal(layerUrls({ ...valid.look, acc: 'Accessory_01_Ladybug_01.png' }).at(-1), 'sprites/character/accessories/Accessory_01_Ladybug_01.png');
});

test('defaultCharacter picks the first of each part and no accessory', () => {
  assert.deepEqual(defaultCharacter(parts), {
    name: 'Calouro',
    look: { body: 'Body_01.png', eyes: 'Eyes_01.png', outfit: 'Outfit_01_01.png', hair: 'Hairstyle_01_01.png', acc: '' },
  });
});

test('cleanName collapses spaces, trims and caps at 16', () => {
  assert.equal(cleanName('  a   b  '), 'a b');
  assert.equal(cleanName('x'.repeat(30)).length, 16);
});
