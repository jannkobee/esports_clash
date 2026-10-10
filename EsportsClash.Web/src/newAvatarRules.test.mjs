import test from 'node:test';
import assert from 'node:assert/strict';
import { CHAMPIONS } from './mockData.ts';
import { ADDITIONAL_CHAMPIONS } from './additionalChampions.ts';
import { BLACK_HOLE_RADIUS } from './blackHoleCounterplay.ts';
import { getSkillCastRange } from './skillRangeRules.ts';
import { shouldUseUltimate, shouldUseSecondSkill } from './combatDecision.ts';
import { shouldRetreatLosingFight } from './fightSurvivalRules.ts';

const kit = name => CHAMPIONS.find(champion => champion.name === name);
const fighter = (name, id, x, hp = 900, iq = 90) => ({
  id, x, y: 350, hp, maxHp: 1100, shield: 0, isAlive: true,
  level: 8, mana: 100, cd1: 0, cd2: 0, cdUlt: 0, stunTimer: 0,
  teamChemistry: 80, champion: kit(name),
  player: { stats: { iq, tf: 85, clu: 85, lan: 85, flx: 85 } },
});

test('six original avatars have distinct themes, complete kits, and tactical roles', () => {
  const additions = ADDITIONAL_CHAMPIONS.slice(-6);
  assert.deepEqual(additions.map(champion => champion.name),
    ['Faelith', 'Oathmute', 'Cloudtail', 'Stonebranch', 'Stepstone', 'Skybreaker']);
  assert.equal(new Set(additions.map(champion => champion.basis)).size, 6);
  assert.ok(additions.every(champion => champion.name !== champion.basis));
  assert.equal(kit('Cloudtail').primaryRole, 'Fighter');
  assert.equal(kit('Stonebranch').primaryRole, 'Fighter');
  assert.equal(kit('Oathmute').skill2.damageType, 'Magic');
  assert.equal(kit('Stepstone').primaryRole, 'Fighter');
  assert.equal(kit('Stepstone').ultimate.name, 'Bellbreak Kick');
  assert.match(kit('Stepstone').ultimate.desc, /toward nearby allies/);
  assert.equal(kit('Skybreaker').primaryRole, 'Marksman');
  assert.ok(kit('Stepstone').displayName);
  assert.ok(kit('Skybreaker').displayName);
});

test('compact Singularity Well has a reachable cast but a smaller danger area', () => {
  assert.equal(BLACK_HOLE_RADIUS, 105);
  assert.equal(getSkillCastRange('Nullweaver', 'ultimate', 175), 175);
});

test('Corsara waits for a lined-up teamfight and Oathmute interrupts channels', () => {
  const corsara = fighter('Corsara', 'corsara', 100);
  const enemy = fighter('Cloudtail', 'enemy', 245);
  const nearby = fighter('Stonebranch', 'nearby', 260);
  assert.equal(shouldUseUltimate(corsara, enemy, [enemy], [corsara], 270), false);
  assert.equal(shouldUseUltimate(corsara, enemy, [enemy, nearby], [corsara], 270), true);
  nearby.y = 570;
  assert.equal(shouldUseUltimate(corsara, enemy, [enemy, nearby], [corsara], 270), false);

  const oathmute = fighter('Oathmute', 'oathmute', 100);
  enemy.blackHole = { x: 245, y: 350, remaining: 2, tick: 0 };
  assert.equal(shouldUseSecondSkill(oathmute, enemy, [enemy], [oathmute], 180), true);
  assert.equal(shouldUseUltimate(oathmute, enemy, [enemy], [oathmute], 9999), true);
});

test('Faelith protects a threatened ally while a card retreats from an unwinnable fight', () => {
  const faelith = fighter('Faelith', 'faelith', 100);
  const ally = fighter('Oathmute', 'ally', 130, 300);
  const enemy = fighter('Stonebranch', 'enemy', 180);
  assert.equal(shouldUseUltimate(faelith, enemy, [enemy], [faelith, ally], 215), true);
  const weak = fighter('Faelith', 'weak', 100, 250);
  const strong = fighter('Stonebranch', 'strong', 145, 1000);
  const second = fighter('Cloudtail', 'second', 180, 900);
  assert.equal(shouldRetreatLosingFight(weak, [weak], [strong, second]), true);
  strong.hp = 50;
  second.x = 500;
  assert.equal(shouldRetreatLosingFight(weak, [weak], [strong, second]), false);
});
