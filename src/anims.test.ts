import { test } from 'node:test';
import assert from 'node:assert/strict';
import { dirFromVelocity, limezuFrames, pixelserialFrames } from './anims.ts';

test('LimeZu: row 1 idle, row 2 walk, 6 frames per direction in order right, up, left, down', () => {
  assert.deepEqual(limezuFrames('idle', 'right', 56), [56, 57, 58, 59, 60, 61]);
  assert.deepEqual(limezuFrames('walk', 'down', 56), [130, 131, 132, 133, 134, 135]);
  assert.deepEqual(limezuFrames('walk', 'up', 57), [120, 121, 122, 123, 124, 125]);
});

test('PixelSerial: rows 0-3 idle, 4-7 walk, order down, left, right, up, 4 frames', () => {
  assert.deepEqual(pixelserialFrames('idle', 'down'), [0, 1, 2, 3]);
  assert.deepEqual(pixelserialFrames('walk', 'up'), [28, 29, 30, 31]);
  assert.deepEqual(pixelserialFrames('walk', 'left'), [20, 21, 22, 23]);
});

test('dirFromVelocity keeps the previous direction when stopped and prefers the larger axis', () => {
  assert.equal(dirFromVelocity(0, 0, 'left'), 'left');
  assert.equal(dirFromVelocity(1, 0, 'up'), 'right');
  assert.equal(dirFromVelocity(-1, 0, 'up'), 'left');
  assert.equal(dirFromVelocity(0, 1, 'up'), 'down');
  assert.equal(dirFromVelocity(0.5, -1, 'down'), 'up');
});
