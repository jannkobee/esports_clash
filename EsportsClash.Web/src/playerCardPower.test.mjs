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
