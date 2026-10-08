import { test } from 'node:test';
import assert from 'node:assert/strict';
import { openDialog, press, reveal, visibleText, type Dialog } from './dialog.ts';

test('openDialog without pages returns null', () => {
  assert.equal(openDialog('x', []), null);
});

test('reveal shows letters up to the end of the page', () => {
  const d = openDialog('', ['Olá'])!;
  assert.equal(visibleText(reveal(d, 2)), 'Ol');
  assert.equal(visibleText(reveal(reveal(d, 2), 5)), 'Olá');
});

test('press completes the page first, then advances, then closes', () => {
  let d = openDialog('Prof', ['Olá', 'Tchau'])!;
  d = press(d)!;
  assert.equal(visibleText(d), 'Olá');
  d = press(d)!;
  assert.equal(d.page, 1);
  assert.equal(visibleText(d), '');
  d = press(d)!;
  assert.equal(visibleText(d), 'Tchau');
  assert.equal(press(d), null);
});

test('mashing the key never skips an unread page: two presses per page', () => {
  let d: Dialog | null = openDialog('', ['a', 'b', 'c']);
  let presses = 0;
  while (d) {
    d = press(d);
    presses++;
  }
  assert.equal(presses, 6);
});
