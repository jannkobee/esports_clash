import test from 'node:test';
import assert from 'node:assert/strict';
import { CHAMPIONS, INITIAL_PLAYERS } from './mockData.ts';
import { createRatedAvatar, playerCardCombatPower } from './playerCardPower.ts';

const fighter = CHAMPIONS.find(avatar => avatar.primaryRole === 'Fighter');
const elite = INITIAL_PLAYERS.find(player => player.name === 'TheSpicy');
const rookie = INITIAL_PLAYERS.find(player => player.name === 'PixelRookie');

test('higher rated player cards make the same avatar stronger without changing its source kit', () => {
  const originalHp = fighter.hp;
  const originalSkill = fighter.skill1.damage;
  const eliteAvatar = createRatedAvatar(elite, fighter);
  const rookieAvatar = createRatedAvatar(rookie, fighter);
  assert.ok(eliteAvatar.hp > rookieAvatar.hp);
  assert.ok(eliteAvatar.ad > rookieAvatar.ad);
  assert.ok(eliteAvatar.aspd > rookieAvatar.aspd);
  assert.ok(eliteAvatar.skill1.damage > rookieAvatar.skill1.damage);
  assert.equal(fighter.hp, originalHp);
  assert.equal(fighter.skill1.damage, originalSkill);
});

test('displayed overall rating, role fit and signature familiarity each affect combat power', () => {
  const base = { ...rookie, signatureChampions: [] };
  const upgraded = { ...base, ovr: base.ovr + 20 };
  assert.ok(playerCardCombatPower(upgraded, fighter) > playerCardCombatPower(base, fighter));
  const onRole = { ...base, preferredRole: fighter.primaryRole };
  assert.ok(playerCardCombatPower(onRole, fighter) > playerCardCombatPower(base, fighter));
  const signature = { ...onRole, signatureChampions: [fighter.name] };
  assert.ok(playerCardCombatPower(signature, fighter) > playerCardCombatPower(onRole, fighter));
});

test('evolved player cards with multiple playableRoles gain full on-role power across all unlocked roles', () => {
  const marksman = CHAMPIONS.find(avatar => avatar.primaryRole === 'Marksman');
  const support = CHAMPIONS.find(avatar => avatar.primaryRole === 'Support');

  // Player starts with preferredRole Mage only
  const singleRolePlayer = {
    ...rookie,
    role: 'Mage',
    preferredRole: 'Mage',
    playableRoles: ['Mage'],
    signatureChampions: []
  };

  // Evolved player has unlocked Marksman and Support
  const evolvedPlayer = {
    ...singleRolePlayer,
    playableRoles: ['Mage', 'Marksman', 'Support'],
    isEvo: true,
    evolutionLevel: 2
  };

  const powerOffRoleMarksman = playerCardCombatPower(singleRolePlayer, marksman);
  const powerOnRoleMarksman = playerCardCombatPower(evolvedPlayer, marksman);
  assert.ok(powerOnRoleMarksman > powerOffRoleMarksman, 'Evolved marksman proficiency provides on-role combat bonus');

  const powerOffRoleSupport = playerCardCombatPower(singleRolePlayer, support);
  const powerOnRoleSupport = playerCardCombatPower(evolvedPlayer, support);
  assert.ok(powerOnRoleSupport > powerOffRoleSupport, 'Evolved support proficiency provides on-role combat bonus');
});
