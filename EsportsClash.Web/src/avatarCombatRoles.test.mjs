import test from 'node:test';
import assert from 'node:assert/strict';
import { ADDITIONAL_CHAMPIONS } from './additionalChampions.ts';
import { getAvatarCombatProfile, getAreaControlProfile, chooseAreaControlTarget, chooseOpeningControlTarget, shouldCommitAreaControlUltimate } from './avatarCombatRoles.ts';
import { shouldUseUltimate, chooseTeamfightTarget } from './combatDecision.ts';

const kit = name => ADDITIONAL_CHAMPIONS.find(champion => champion.name === name);
const unit = (id, champion, x, y = 0, iq = 88, tf = 86) => ({
  id, champion, player: { stats: { iq, tf, clu: 80 } }, x, y,
  hp: 1000, maxHp: 1000, mana: 100, level: 6, cdUlt: 0,
  isAlive: true, isInBush: false, stunTimer: 0, knockupTimer: 0
});

test('Stonewake has multiple visible combat types without changing its base kit', () => {
  const stonewake = kit('Stonewake');
  const profile = getAvatarCombatProfile(stonewake);
  assert.equal(profile.Initiator, 3);
  assert.equal(profile.Disabler, 3);
  assert.equal(profile.Durable, 2);
  assert.equal(profile.Carry, 0);
  assert.equal(stonewake.hp, 1380);
});

test('a skilled Stonewake saves Quake Chorus for a real cluster or emergency peel', () => {
  const stonewake = unit('stonewake', kit('Stonewake'), 0);
  const enemyOne = unit('enemy-one', kit('Veyara'), 95);
  const enemyTwo = unit('enemy-two', kit('Soulscourge'), 125);
  const ally = unit('ally', kit('Soulscourge'), -80);
  const profile = getAreaControlProfile(stonewake.champion);
  assert.equal(shouldCommitAreaControlUltimate(stonewake, enemyOne, [enemyOne], [stonewake, ally], profile), false);
  assert.equal(shouldUseUltimate(stonewake, enemyOne, [enemyOne], [stonewake, ally], 320), false);
  assert.equal(shouldUseUltimate(stonewake, enemyOne, [enemyOne, enemyTwo], [stonewake, ally], 320), true);
  enemyOne.x = 200;
  enemyTwo.x = 225;
  assert.equal(shouldUseUltimate(stonewake, enemyOne, [enemyOne, enemyTwo], [stonewake, ally], 320), false);
  enemyOne.x = 95;
  enemyTwo.x = 400;
  ally.hp = 250;
  ally.x = 100;
  assert.equal(shouldUseUltimate(stonewake, enemyOne, [enemyOne, enemyTwo], [stonewake, ally], 320), true);
  ally.hp = 1000;
  stonewake.player.stats.iq = 30;
  stonewake.player.stats.tf = 30;
  stonewake.hp = 600;
  assert.equal(shouldUseUltimate(stonewake, enemyOne, [enemyOne], [stonewake], 320), true);
});

test('a skilled area disabler selects the clustered target instead of the closest isolated enemy', () => {
  const caster = unit('nullweaver', kit('Nullweaver'), 0);
  const isolated = unit('isolated', kit('Veyara'), -10);
  const groupedOne = unit('grouped-one', kit('Solenne'), 145);
  const groupedTwo = unit('grouped-two', kit('Veyara'), 160);
  const enemies = [isolated, groupedOne, groupedTwo];
  const profile = getAreaControlProfile(caster.champion);
  assert.equal(chooseAreaControlTarget(caster, enemies, 320, profile)?.id, 'grouped-one');
  assert.equal(chooseTeamfightTarget(caster, enemies, [caster], 150)?.id, 'grouped-one');
});

test('Stonewake aims Faultline through a group when the player can read the opening', () => {
  const caster = unit('stonewake', kit('Stonewake'), 0);
  const isolated = unit('isolated', kit('Veyara'), 40, 100);
  const first = unit('first', kit('Solenne'), 115);
  const second = unit('second', kit('Veyara'), 140);
  caster.cdUlt = 20;
  caster.cd1 = 0;
  assert.equal(chooseOpeningControlTarget(caster, [isolated, first, second], 160)?.id, 'first');
  assert.equal(chooseTeamfightTarget(caster, [isolated, first, second], [caster], 75)?.id, 'first');
  caster.player.stats.iq = 35;
  assert.notEqual(chooseTeamfightTarget(caster, [isolated, first, second], [caster], 75)?.id, 'first');
});
