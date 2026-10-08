import { test } from 'node:test';
import assert from 'node:assert/strict';
import { kebab, pngs } from './vendor.ts';

test('kebab turns folder names into keys', () => {
  assert.equal(kebab('Blonde Woman'), 'blonde-woman');
  assert.equal(kebab('  Old Man '), 'old-man');
  assert.equal(kebab('Punk Kid Boy'), 'punk-kid-boy');
});

test('pngs keeps sprite sheets, drops shadows and other files, sorted', () => {
  assert.deepEqual(pngs(['b.png', 'a_shadow.png', 'a.png', 'notes.txt', 'C.PNG']), ['C.PNG', 'a.png', 'b.png']);
});
