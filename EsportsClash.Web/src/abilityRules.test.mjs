import test from 'node:test';
import assert from 'node:assert/strict';
import { ALL_ITEMS } from './itemsData.ts';
import {
  abilityDamageFromStats,
  abilityItemStats,
  maxMana,
  manaRegen,
  skill1ManaCost,
  ultimateManaCost,
  ultimateBaseCooldown,
} from './abilityRules.ts';
import { shouldUseSecondSkill } from './combatDecision.ts';

function unit(name, level = 6) {
  return {
    id: name, x: 0, y: 0, hp: 500, maxHp: 1000, mana: 120, level,
    cd1: 0, cd2: 0, cdUlt: 0, stunTimer: 0, teamChemistry: 80,
    items: [], isAlive: true, player: { stats: { iq: 82, tf: 80 } },
    champion: { name, ad: 70, primaryRole: 'Mage',
      skill1: { damage: 120 }, skill2: { damage: 0 }, ultimate: { damage: 300 } }
  };
}

test('Raijin ultimate trades a short 3 to 1 second cooldown for repeated mana cost', () => {
  const raijin = unit('Raijin');
  assert.equal(ultimateBaseCooldown(raijin), 3);
  assert.equal(ultimateManaCost(raijin), 58);
  raijin.level = 18;
  assert.equal(ultimateBaseCooldown(raijin), 1);
  assert.equal(ultimateManaCost(raijin), 73);
  raijin.items = [{ stats: { mana: 90, manaRegen: 1.8 } }, { stats: { mana: 130, manaRegen: 2.4 } }];
  assert.equal(maxMana(raijin), 320);
  assert.equal(manaRegen(raijin), 4.2);
});

test('a defensive Skill 2 can fire when the enemy is beyond its self cast range', () => {
  const renn = unit('Renn');
  const enemy = unit('Enemy'); enemy.x = 240;
  const ally = unit('Ally'); ally.x = 75; ally.hp = 300;
  assert.equal(shouldUseSecondSkill(renn, enemy, [enemy], [renn, ally], 170), true);
  const raijin = unit('Raijin'); raijin.champion.skill2.damage = 75;
  assert.equal(shouldUseSecondSkill(raijin, enemy, [enemy], [raijin], 120), false);
});

test('Cinderlock can afford all three Q stages before itemizing mana', () => {
  const cinder = unit('Cinderlock');
  assert.equal(skill1ManaCost(cinder) * 3, 60);
  assert.equal(shouldUseSecondSkill(cinder, { ...unit('Enemy'), x: 180 }, [unit('Enemy')], [cinder], 0), true);
});

test('item bonus AD and AP increase role-scaled ability damage', () => {
  const marksman = unit('Carry');
  marksman.champion.primaryRole = 'Marksman';
  marksman.champion.skill1.damage = 100;
  const greatsword = ALL_ITEMS.find(item => item.id === 'item_bf_sword');
  assert.ok(greatsword);
  marksman.items = [greatsword, { stats: { ad: 25, ap: 20 } }];
  const itemStats = abilityItemStats(marksman);
  assert.deepEqual(itemStats, { bonusAd: 65, bonusAp: 20 });
  assert.equal(
    abilityDamageFromStats(100, marksman.champion, 'skill1', itemStats.bonusAd, itemStats.bonusAp),
    128.4,
  );
  assert.equal(
    abilityDamageFromStats(100, marksman.champion, 'skill1', greatsword.stats.ad ?? 0, 0),
    114.4,
  );
});

test('individual abilities can override their default AD and AP ratios', () => {
  const mage = unit('Mage');
  mage.champion.skill2.adRatio = 0.5;
  mage.champion.skill2.apRatio = 0.8;
  assert.equal(abilityDamageFromStats(100, mage.champion, 'skill2', 40, 50), 160);
  assert.equal(abilityDamageFromStats(100, mage.champion, 'skill1', 40, 50), 128.2);
});

test('stat scaling never turns a zero-damage utility ability into a damage spell', () => {
  const tank = unit('Tank');
  tank.champion.primaryRole = 'Tank';
  tank.champion.skill2.damage = 0;
  assert.equal(abilityDamageFromStats(0, tank.champion, 'skill2', 100, 100), 0);
});
