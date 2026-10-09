import test from 'node:test';
import assert from 'node:assert/strict';
import { chooseTeamfightTarget, shouldContestBoss, shouldUseSecondSkill, shouldUseSkill, shouldUseUltimate } from './combatDecision.ts';

function fighter(id, iq, x = 0, hp = 100, role = 'Mage') {
  return {
    id, x, y: 0, hp, maxHp: 100, isAlive: true, mana: 100, level: 6,
    cd1: 0, cd2: 0, cdUlt: 0, champion: { ad: 30, primaryRole: role, skill1: { damage: 50 }, skill2: { damage: 70 } },
    player: { stats: { iq, lan: 70, tf: 70 } },
  };
}

test('high IQ recognizes a reachable low-health carry while low IQ takes the nearest target', () => {
  const tank = fighter('tank', 50, 80, 100, 'Tank');
  const carry = fighter('carry', 50, 160, 20, 'Marksman');
  assert.equal(chooseTeamfightTarget(fighter('low', 20), [tank, carry], [], 150)?.id, 'tank');
  assert.equal(chooseTeamfightTarget(fighter('high', 95), [tank, carry], [], 150)?.id, 'carry');
});

test('high IQ saves a ready ultimate for impact and still uses it in a teamfight', () => {
  const target = fighter('target', 50, 70, 95);
  const high = fighter('high', 95);
  assert.equal(shouldUseUltimate(high, target, [target], [high]), false);
  assert.equal(shouldUseUltimate(fighter('low', 20), target, [target], [],), true);
  assert.equal(shouldUseUltimate(high, target, [target, fighter('second', 50, 85)], [high]), true);
});

test('high IQ avoids spending a skill on a basic-attack finish', () => {
  const target = fighter('target', 50, 70, 20);
  assert.equal(shouldUseSkill(fighter('high', 95), target, [target], 150), false);
  assert.equal(shouldUseSkill(fighter('low', 20), target, [target], 150), true);
});

test('high IQ preserves mana for a ready ultimate unless skill secures the kill', () => {
  const high = fighter('high', 95);
  const healthyTarget = fighter('healthy', 50, 70, 90);
  const finishableTarget = fighter('finishable', 50, 70, 40);
  assert.equal(shouldUseSkill(high, healthyTarget, [healthyTarget], 150), false);
  assert.equal(shouldUseSkill(high, finishableTarget, [finishableTarget], 150), true);
});

test('second skill usage considers IQ and the fight', () => {
  const target = fighter('target', 50, 70, 95);
  const low = fighter('low', 20);
  const high = fighter('high', 95);
  high.mana = 45;
  assert.equal(shouldUseSecondSkill(low, target, [target], [low], 150), true);
  assert.equal(shouldUseSecondSkill(high, target, [target], [high], 150), false);
  assert.equal(shouldUseSecondSkill(high, target, [target, fighter('second', 50, 90)], [high], 150), true);
});

test('boss contest requires sufficient IQ, health, and nearby teammates', () => {
  const high = fighter('high', 95);
  const allies = [high, fighter('a', 50, 20), fighter('b', 50, 30)];
  assert.equal(shouldContestBoss(high, allies, [], 0.7, 60), true);
  assert.equal(shouldContestBoss(high, allies, [], 1, 100), true);
  assert.equal(shouldContestBoss(high, allies, [], 1, 30), false);
  assert.equal(shouldContestBoss(fighter('low', 40), allies, [], 0.4, 100), false);
  assert.equal(shouldContestBoss(high, [high], [], 0.7, 100), false);
});
