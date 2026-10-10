import test from 'node:test';
import assert from 'node:assert/strict';
import { maxMana, manaRegen, skill1ManaCost, ultimateManaCost, ultimateBaseCooldown } from './abilityRules.ts';
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
