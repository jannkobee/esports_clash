import test from 'node:test';
import assert from 'node:assert/strict';
import { aimAtCast, dodgeProbability, segmentHitsCircle } from './skillshotRules.ts';
import { AVATAR_COMBOS, comboPracticeNeeded } from './avatarCombos.ts';
import { ADDITIONAL_CHAMPIONS } from './additionalChampions.ts';

test('a projectile only hits a champion intersecting its traveled path', () => {
  assert.equal(segmentHitsCircle({ x: 0, y: 0 }, { x: 50, y: 0 }, { x: 30, y: 5 }, 8), true);
  assert.equal(segmentHitsCircle({ x: 0, y: 0 }, { x: 50, y: 0 }, { x: 30, y: 25 }, 8), false);
  assert.equal(segmentHitsCircle({ x: 0, y: 0 }, { x: 50, y: 0 }, { x: 100, y: 0 }, 8), false);
});

test('better mechanics lead a moving target more accurately and improve dodge odds', () => {
  const target = { x: 200, y: 100, vx: 80, vy: 0 };
  const novice = aimAtCast({ x: 0, y: 100 }, target, 400, 35, () => 0.5);
  const expert = aimAtCast({ x: 0, y: 100 }, target, 400, 95, () => 0.5);
  assert.equal(novice.x, 200);
  assert.ok(expert.x > novice.x);
  assert.ok(dodgeProbability(95, 90, 70) > dodgeProbability(45, 45, 70));
});

test('high skill players learn an avatar combo while low skill players do not', () => {
  const player = (lan, tf, flx, iq) => ({ stats: { lan, tf, flx, iq }, signatureChampions: ['Veyara'] });
  assert.equal(comboPracticeNeeded(player(96, 94, 90, 88), 'Veyara'), 2);
  assert.equal(comboPracticeNeeded(player(65, 68, 70, 80), 'Veyara'), null);
  for (const champion of ADDITIONAL_CHAMPIONS) assert.ok(AVATAR_COMBOS[champion.name]);
  assert.equal(Object.keys(AVATAR_COMBOS).length, 30);
});
