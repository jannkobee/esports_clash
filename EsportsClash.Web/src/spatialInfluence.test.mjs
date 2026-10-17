import test from 'node:test';
import assert from 'node:assert/strict';
import { createSpatialInfluence } from './spatialInfluence.ts';

const unit = (team, x, y, hp = 100) => ({ team, x, y, hp, maxHp: 100, isAlive: true });
const tower = (team, x) => ({ team, x, y: 380, range: 220, type: 'outer_tower', isAlive: true });

test('retreat and objective approaches read more threat near visible enemies and towers', () => {
  const field = createSpatialInfluence({ team: 'blue', allies: [unit('blue', 500, 380)],
    enemies: [unit('red', 1450, 380)], structures: [tower('red', 1600), tower('blue', 400)] });
  assert.ok(field.at({ x: 1450, y: 380 }).threat > field.at({ x: 700, y: 380 }).threat);
  assert.ok(field.approach({ x: 700, y: 380 }, { x: 1550, y: 380 }).threat > .2);
});

test('allied cover remains a score read and does not erase enemy threat', () => {
  const field = createSpatialInfluence({ team: 'blue', allies: [unit('blue', 900, 380)],
    enemies: [unit('red', 980, 380)], structures: [tower('blue', 850)] });
  const read = field.at({ x: 900, y: 380 });
  assert.ok(read.cover > 0 && read.threat > 0);
});
