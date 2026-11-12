import test from 'node:test';
import assert from 'node:assert/strict';
import {
  EQUALIZED_COACH_BLUE,
  EQUALIZED_COACH_RED,
  PLAYER_DRAFT_TURNS,
  chooseEqualizedPlayerPick,
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
    assert.deepEqual(player.playableRoles, ['Tank', 'Mage', 'Marksman', 'Support', 'Fighter', 'Assassin']);
    assert.deepEqual(player.signatureChampions, []);
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

  const equalized = equalizePlayerCard({
    ...INITIAL_PLAYERS[0],
    signatureChampions: ['c_astra'],
  });
  assert.equal(equalized.ovr, 100);
  assert.equal(equalized.tier, 'GOAT');
  assert.deepEqual(equalized.signatureChampions, []);
  for (const stat of Object.values(equalized.stats)) assert.equal(stat, 100);
});

test('Equalized coaches share identical rating and zero ban advantage', () => {
  assert.equal(EQUALIZED_COACH_BLUE.style, EQUALIZED_COACH_RED.style);
  assert.equal(EQUALIZED_COACH_BLUE.chemistryBonus, EQUALIZED_COACH_RED.chemistryBonus);
  assert.equal(EQUALIZED_COACH_BLUE.playbookBonus, EQUALIZED_COACH_RED.playbookBonus);
  assert.equal(EQUALIZED_COACH_BLUE.extraBans, 0);
  assert.equal(EQUALIZED_COACH_RED.extraBans, 0);
});

test('Equalized player pool contains neutral 100 OVR players and alternating turn picks work', () => {
  const pool = getEqualizedPlayerPool();
  assert.equal(pool.length, INITIAL_PLAYERS.length);
  assert.equal(PLAYER_DRAFT_TURNS.length, 10);
  for (const p of pool) {
    assert.equal(p.ovr, 100);
  }

  const pick1 = chooseEqualizedPlayerPick(pool, [null, null, null, null, null], [null, null, null, null, null]);
  assert.ok(pick1);
  const remaining = pool.filter(p => p.id !== pick1.card.id);
  const team = [null, null, null, null, null];
  team[pick1.slot] = pick1.card;
  const pick2 = chooseEqualizedPlayerPick(remaining, team, [null, null, null, null, null]);
  assert.ok(pick2);
  assert.notEqual(pick1.card.id, pick2.card.id);
});
