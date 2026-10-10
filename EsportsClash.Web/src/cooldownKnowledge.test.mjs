import test from 'node:test';
import assert from 'node:assert/strict';
import { createEnemyCooldownMemory, isObservedCooling, observeCooldownRise } from './cooldownKnowledge.ts';
import { shouldRetreatLosingFight } from './fightSurvivalRules.ts';
import { chooseTeamfightTarget } from './combatDecision.ts';
import { CHAMPIONS } from './mockData.ts';

const kit = name => CHAMPIONS.find(champion => champion.name === name);
const fighter = (id, name, team, x, hp, iq) => ({
  id, team, x, y: 350, hp, maxHp: 1000, shield: 0, isAlive: true,
  level: 8, mana: 100, cd1: 0, cd2: 0, cdUlt: 0, stunTimer: 0,
  champion: kit(name), player: { stats: { iq, tf: 85, clu: 85 } }
});

test('a team remembers only a witnessed cooldown rise', () => {
  const memory = createEnemyCooldownMemory();
  const actor = { id: 'enemy', team: 'red', cd1: 0, cd2: 0, cdUlt: 0 };
  let previous = observeCooldownRise(memory, undefined, actor, 10, false);
  actor.cdUlt = 35;
  previous = observeCooldownRise(memory, previous, actor, 11, false);
  assert.equal(isObservedCooling(memory.blue, actor.id, 'ultimate', 20), false);
  actor.cdUlt = 0;
  previous = observeCooldownRise(memory, previous, actor, 46, true);
  actor.cdUlt = 35;
  observeCooldownRise(memory, previous, actor, 47, true);
  assert.equal(isObservedCooling(memory.blue, actor.id, 'ultimate', 60), true);
  assert.equal(isObservedCooling(memory.red, actor.id, 'ultimate', 60), false);
  assert.equal(isObservedCooling(memory.blue, actor.id, 'ultimate', 83), false);
});

test('a global ultimate reveals its own cooldown without revealing unseen basic casts', () => {
  const memory = createEnemyCooldownMemory();
  const previous = { skill1: 0, skill2: 0, ultimate: 0 };
  observeCooldownRise(memory, previous, { id: 'enemy', team: 'red', cd1: 5, cd2: 6, cdUlt: 30 }, 10, false, true);
  assert.equal(isObservedCooling(memory.blue, 'enemy', 'ultimate', 20), true);
  assert.equal(isObservedCooling(memory.blue, 'enemy', 'skill1', 11), false);
  assert.equal(isObservedCooling(memory.blue, 'enemy', 'skill2', 11), false);
});

test('world-class card uses observed ultimate downtime but still retreats when it can lose', () => {
  const unit = fighter('blue', 'Faelith', 'blue', 100, 240, 90);
  const enemy = fighter('enemy', 'Stonebranch', 'red', 145, 1000, 85);
  assert.equal(shouldRetreatLosingFight(unit, [unit], [enemy]), true);
  const memory = createEnemyCooldownMemory();
  memory.blue.enemy = { ultimate: 80 };
  assert.equal(shouldRetreatLosingFight(unit, [unit], [enemy], memory, 20, 'blue'), false);
  unit.player.stats.iq = 45;
  assert.equal(shouldRetreatLosingFight(unit, [unit], [enemy], memory, 20, 'blue'), true);
});

test('an easy last hit does not lure an isolated card into a lost teamfight', () => {
  const unit = fighter('blue', 'Faelith', 'blue', 100, 250, 95);
  const victim = fighter('victim', 'Stonebranch', 'red', 145, 40, 80);
  const reinforcements = [165, 180, 200].map((x, index) =>
    fighter(`enemy-${index}`, 'Cloudtail', 'red', x, 950, 80));
  assert.equal(shouldRetreatLosingFight(unit, [unit], [victim, ...reinforcements]), true);
  assert.equal(shouldRetreatLosingFight(unit, [unit], [victim]), false);
});

test('elite cards focus a visible enemy whose ultimate was spent', () => {
  const unit = fighter('blue', 'Faelith', 'blue', 100, 900, 95);
  unit.cd1 = 20;
  const first = fighter('first', 'Cloudtail', 'red', 145, 900, 80);
  const exposed = fighter('exposed', 'Stonebranch', 'red', 55, 900, 80);
  const memory = createEnemyCooldownMemory();
  memory.blue.exposed = { ultimate: 70 };
  assert.equal(chooseTeamfightTarget(unit, [first, exposed], [unit], 150,
    { cooldownMemory: memory, matchSecond: 20 })?.id, 'exposed');
  unit.player.stats.iq = 45;
  assert.equal(chooseTeamfightTarget(unit, [first, exposed], [unit], 150,
    { cooldownMemory: memory, matchSecond: 20 })?.id, 'first');
});
