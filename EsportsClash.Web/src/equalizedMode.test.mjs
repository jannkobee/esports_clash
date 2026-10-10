import test from 'node:test';
import assert from 'node:assert/strict';
import { createEqualizedRoster, EQUALIZED_COACH_BLUE, EQUALIZED_COACH_RED } from './equalizedMode.ts';
import { playerCardCombatPower, createRatedAvatar } from './playerCardPower.ts';
import { CHAMPIONS } from './mockData.ts';

test('createEqualizedRoster generates 5 GOAT players with 100 OVR and 100 in all stats', () => {
  const blueRoster = createEqualizedRoster('blue');
  const redRoster = createEqualizedRoster('red');

  assert.equal(blueRoster.length, 5);
  assert.equal(redRoster.length, 5);

  for (const player of [...blueRoster, ...redRoster]) {
    assert.equal(player.ovr, 100);
    assert.equal(player.tier, 'GOAT');
    assert.equal(player.stats.lan, 100);
    assert.equal(player.stats.tf, 100);
    assert.equal(player.stats.iq, 100);
    assert.equal(player.stats.clu, 100);
    assert.equal(player.stats.sta, 100);
    assert.equal(player.stats.flx, 100);
    assert.deepEqual(player.playableRoles, ['Tank', 'Mage', 'Marksman', 'Support', 'Fighter', 'Assassin']);
    assert.equal(player.signatureChampions.length, CHAMPIONS.length);
  }
});

test('Cardrel is preserved as parody alias in Blue roster per AGENTS.md invariant', () => {
  const blueRoster = createEqualizedRoster('blue');
  const cardrel = blueRoster.find(p => p.name === 'Cardrel');
  assert.ok(cardrel, 'Cardrel must be present in the equalized roster');
  assert.equal(cardrel.realName, 'Caedrel');
});

test('Equalized players produce identical max combat power (1.05) across all avatars and roles', () => {
  const blueRoster = createEqualizedRoster('blue');
  const redRoster = createEqualizedRoster('red');

  for (const avatar of CHAMPIONS.slice(0, 10)) {
    const bluePower = playerCardCombatPower(blueRoster[0], avatar);
    const redPower = playerCardCombatPower(redRoster[0], avatar);

    assert.equal(bluePower, redPower);
    assert.ok(Math.abs(bluePower - 1.05) < 1e-6);

    const blueAvatar = createRatedAvatar(blueRoster[0], avatar);
    const redAvatar = createRatedAvatar(redRoster[0], avatar);

    assert.equal(blueAvatar.hp, redAvatar.hp);
    assert.equal(blueAvatar.ad, redAvatar.ad);
    assert.equal(blueAvatar.armor, redAvatar.armor);
    assert.equal(blueAvatar.mr, redAvatar.mr);
    assert.equal(blueAvatar.skill1.damage, redAvatar.skill1.damage);
  }
});

test('Equalized coaches have identical tactical bonuses ensuring pure draft fairness', () => {
  assert.equal(EQUALIZED_COACH_BLUE.playbookBonus, EQUALIZED_COACH_RED.playbookBonus);
  assert.equal(EQUALIZED_COACH_BLUE.chemistryBonus, EQUALIZED_COACH_RED.chemistryBonus);
  assert.equal(EQUALIZED_COACH_BLUE.style, EQUALIZED_COACH_RED.style);
  assert.equal(EQUALIZED_COACH_BLUE.extraBans, EQUALIZED_COACH_RED.extraBans);
});
