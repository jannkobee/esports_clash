import test from 'node:test';
import assert from 'node:assert/strict';
import { chooseTeamfightTarget, isChannelingAbility, isEnemyCaughtInAlliedChannel, isUnitVisibleTo, shouldContestBoss, shouldUseSecondSkill, shouldUseSkill, shouldUseUltimate } from './combatDecision.ts';

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

test('One-Tap God hunts an exposed carry only when IQ and isolation allow', () => {
  const tank = fighter('tank', 50, 70, 100, 'Tank');
  const carry = fighter('carry', 50, 260, 100, 'Marksman');
  const hunter = fighter('hunter', 85);
  hunter.player.badges = ['One-Tap God'];
  assert.equal(chooseTeamfightTarget(hunter, [tank, carry], [], 150)?.id, 'carry');

  const guard = fighter('guard', 50, 265, 100, 'Tank');
  assert.equal(chooseTeamfightTarget(hunter, [tank, carry, guard], [], 150)?.id, 'tank');
  hunter.player.stats.iq = 40;
  assert.equal(chooseTeamfightTarget(hunter, [tank, carry], [], 150)?.id, 'tank');
});

test('Ice in Veins retains a reachable fight target after control ends', () => {
  const steady = fighter('steady', 85);
  steady.player.badges = ['Ice in Veins'];
  const first = fighter('first', 50, 90, 100, 'Tank');
  const second = fighter('second', 50, 70, 10, 'Marksman');
  steady.traitFocusId = first.id;
  steady.iceFocusTimer = 1;
  assert.equal(chooseTeamfightTarget(steady, [first, second], [], 150)?.id, 'first');
  steady.iceFocusTimer = 0;
  assert.equal(chooseTeamfightTarget(steady, [first, second], [], 150)?.id, 'second');
  steady.iceFocusTimer = 1;
  steady.traitFocusId = first.id;
  first.isAlive = false;
  assert.equal(chooseTeamfightTarget(steady, [first, second], [], 150)?.id, 'second');
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

test('bush concealment hides targets from outside observers unless revealed, face-checked, or sharing bush', () => {
  const observer = fighter('observer', 70, 100);
  const target = fighter('target', 70, 200);
  target.isInBush = true;
  target.currentBushId = 'bush_mid_north';

  // 1. Outside observer at 100px distance cannot see target in bush
  assert.equal(isUnitVisibleTo(target, observer), false);
  // chooseTeamfightTarget will not acquire hidden target
  assert.equal(chooseTeamfightTarget(observer, [target], [], 250), undefined);

  // 2. Observer sharing the same bush can see target
  observer.isInBush = true;
  observer.currentBushId = 'bush_mid_north';
  assert.equal(isUnitVisibleTo(target, observer), true);

  // 3. Observer in a different bush cannot see target
  observer.currentBushId = 'bush_mid_south';
  assert.equal(isUnitVisibleTo(target, observer), false);

  // 4. Face check within 55px reveals target
  observer.isInBush = false;
  observer.currentBushId = undefined;
  observer.x = 160; // distance 40px <= 55px
  assert.equal(isUnitVisibleTo(target, observer), true);

  // 5. Revealed timer (recent attack or spell cast) reveals target even at range
  observer.x = 0; // distance 200px > 55px
  target.revealedTimer = 1.8;
  assert.equal(isUnitVisibleTo(target, observer), true);
  assert.equal(chooseTeamfightTarget(observer, [target], [], 250)?.id, 'target');
});

test('isChannelingAbility correctly identifies channeled abilities', () => {
  const normal = fighter('normal', 70);
  assert.equal(isChannelingAbility(normal), false);
  const nullweaver = fighter('nullweaver', 70);
  nullweaver.blackHole = { x: 200, y: 0, remaining: 3, tick: 0 };
  assert.equal(isChannelingAbility(nullweaver), true);
  const corsara = fighter('corsara', 70);
  corsara.corsaraBarrage = { remaining: 3, tick: 0, facing: 'right' };
  assert.equal(isChannelingAbility(corsara), true);
  const cloudtail = fighter('cloudtail', 70);
  cloudtail.monkeySpin = { remaining: 2, tick: 0, hitIds: [] };
  assert.equal(isChannelingAbility(cloudtail), true);
});

test('allies do not defensively peel around an ally who is channeling an ability', () => {
  const tank = fighter('tank', 80, 0, 100, 'Tank');
  const enemyNearChanneler = fighter('enemy_near', 50, 40, 100, 'Tank');
  const enemyTrapped = fighter('enemy_trapped', 50, 150, 60, 'Marksman');

  // Channeling Nullweaver at x = 30
  const nullweaver = fighter('nullweaver', 80, 30, 100, 'Mage');
  nullweaver.blackHole = { x: 150, y: 0, remaining: 2.5, tick: 0 };

  // When Nullweaver is channeling, tank prioritizes the trapped enemy in the black hole, not peeling enemy_near
  const target = chooseTeamfightTarget(tank, [enemyNearChanneler, enemyTrapped], [nullweaver], 150);
  assert.equal(target?.id, 'enemy_trapped');
});

test('allies prioritize enemies caught in allied channeled abilities for follow-up engage', () => {
  const allyMelee = fighter('ally_melee', 70, 0, 100, 'Fighter');
  const enemyFar = fighter('enemy_far', 50, 100, 100, 'Tank');
  const enemyInBarrage = fighter('enemy_barrage', 50, 220, 80, 'Marksman');

  const corsara = fighter('corsara', 80, 50, 100, 'Marksman');
  corsara.corsaraBarrage = { remaining: 2.5, tick: 0, facing: 'right' };

  const target = chooseTeamfightTarget(allyMelee, [enemyFar, enemyInBarrage], [corsara], 150);
  assert.equal(target?.id, 'enemy_barrage');
});

test('shouldUseUltimate commits follow-up ultimate against enemies caught in allied channel', () => {
  const highIqUnit = fighter('high', 95, 0, 100);
  const target = fighter('target', 50, 80, 100);
  const corsara = fighter('corsara', 80, 0, 100, 'Marksman');
  corsara.corsaraBarrage = { remaining: 2.5, tick: 0, facing: 'right' };

  // Without channel or crowd, high IQ holds ultimate against 100% HP target in a 1v1
  assert.equal(shouldUseUltimate(highIqUnit, target, [target], [highIqUnit]), false);
  // With allied channel hitting the target, ultimate is committed for follow-up
  assert.equal(shouldUseUltimate(highIqUnit, target, [target], [highIqUnit, corsara]), true);
});

test('Tequoia casts Nature Link when multiple enemies are clumped without worrying about allied counts', () => {
  const tequoia = fighter('tequoia', 80, 0, 100, 'Mage');
  tequoia.champion.name = 'Tequoia';
  tequoia.champion.skill2 = { name: 'Nature Link', cooldown: 11, damage: 0, damageType: 'Magic' };

  const targetEnemy = fighter('target_enemy', 50, 100, 100);
  const clumpedEnemy = fighter('clumped_enemy', 50, 140, 100);
  const alliedMelee = fighter('allied_melee', 80, 110, 100, 'Tank');
  const alliedCarry = fighter('allied_carry', 80, 115, 100, 'Marksman');

  // Even with 2 allies clustered right next to targetEnemy, Tequoia casts because Nature Link only affects enemies
  assert.equal(shouldUseSecondSkill(tequoia, targetEnemy, [targetEnemy, clumpedEnemy], [tequoia, alliedMelee, alliedCarry], 180), true);

  // If only 1 enemy is present outside teamfight, Tequoia holds Nature Link
  assert.equal(shouldUseSecondSkill(tequoia, targetEnemy, [targetEnemy], [tequoia], 180), false);
});

