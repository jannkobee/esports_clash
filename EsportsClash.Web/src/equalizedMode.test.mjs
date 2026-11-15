import test from 'node:test';
import assert from 'node:assert/strict';
import {
  EQUALIZED_COACH_BLUE,
  EQUALIZED_COACH_RED,
  createEqualizedRoster,
  equalizePlayerCard,
  getEqualizedPlayerPool,
} from './equalizedMode.ts';
import { INITIAL_PLAYERS } from './mockData.ts';

test('Equalized rosters lock every player to identical stats (100 OVR / GOAT)', () => {
  const players = createEqualizedRoster('blue');
  assert.equal(players.length, 5);

  for (const player of players) {
    assert.equal(player.ovr, 100);
    assert.equal(player.tier, 'GOAT');
    assert.equal(player.morale, 100);
    assert.equal(player.fatigue, 0);
    for (const stat of Object.values(player.stats)) {
      assert.equal(stat, 100);
    }
  }
});

test('Equalized mode keeps legacy Cardrel and parody alias identities', () => {
  const blue = createEqualizedRoster('blue');
  const red = createEqualizedRoster('red');
  const cardrel = blue.find(p => p.name === 'Cardrel');
  assert.ok(cardrel);
  assert.equal(cardrel.realName, 'Caedrel');
  assert.ok(red.some(p => p.name === 'Zypoo'));
  assert.ok(red.some(p => p.name === 'd4nk'));
  assert.ok(blue.some(p => p.name === 'p1mple'));

  const equalized = equalizePlayerCard(INITIAL_PLAYERS[0]);
  assert.equal(equalized.ovr, 100);
  assert.equal(equalized.tier, 'GOAT');
  for (const stat of Object.values(equalized.stats)) assert.equal(stat, 100);
});

test('Equalized coaches share identical rating and zero ban advantage', () => {
  assert.equal(EQUALIZED_COACH_BLUE.style, EQUALIZED_COACH_RED.style);
  assert.equal(EQUALIZED_COACH_BLUE.chemistryBonus, EQUALIZED_COACH_RED.chemistryBonus);
  assert.equal(EQUALIZED_COACH_BLUE.playbookBonus, EQUALIZED_COACH_RED.playbookBonus);
  assert.equal(EQUALIZED_COACH_BLUE.extraBans, 0);
  assert.equal(EQUALIZED_COACH_RED.extraBans, 0);
});

test('Equalized player pool contains neutral 100 OVR players', () => {
  const pool = getEqualizedPlayerPool();
  assert.equal(pool.length, INITIAL_PLAYERS.length);
  for (const p of pool) {
    assert.equal(p.ovr, 100);
  }
});
