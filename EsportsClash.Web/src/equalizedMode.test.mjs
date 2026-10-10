import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createEqualizedRoster,
  EQUALIZED_COACH_BLUE,
  EQUALIZED_COACH_RED,
  equalizePlayerCard,
  getEqualizedPlayerPool,
  chooseEqualizedPlayerPick,
  PLAYER_DRAFT_TURNS,
  TEAM_SLOTS
} from './equalizedMode.ts';
import { playerCardCombatPower, createRatedAvatar } from './playerCardPower.ts';
import { CHAMPIONS, INITIAL_PLAYERS } from './mockData.ts';

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

test('getEqualizedPlayerPool returns all 63 cards equalized to 100 OVR GOAT tier', () => {
  const pool = getEqualizedPlayerPool();
  assert.equal(pool.length, INITIAL_PLAYERS.length);
  assert.equal(pool.length, 63);

  for (const card of pool) {
    assert.equal(card.ovr, 100);
    assert.equal(card.tier, 'GOAT');
    assert.equal(card.stats.lan, 100);
    assert.equal(card.stats.tf, 100);
    assert.equal(card.stats.iq, 100);
    assert.equal(card.stats.clu, 100);
    assert.equal(card.stats.sta, 100);
    assert.equal(card.stats.flx, 100);
    assert.deepEqual(card.playableRoles, ['Tank', 'Mage', 'Marksman', 'Support', 'Fighter', 'Assassin']);
  }

  // Cardrel check
  const cardrel = pool.find(c => c.name === 'Cardrel');
  assert.ok(cardrel, 'Cardrel must be in the equalized draft pool');
  assert.equal(cardrel.realName, 'Caedrel');
});

test('PLAYER_DRAFT_TURNS has exactly 10 snake draft turns, 5 for Blue and 5 for Red', () => {
  assert.equal(PLAYER_DRAFT_TURNS.length, 10);
  const blueTurns = PLAYER_DRAFT_TURNS.filter(t => t.side === 'blue');
  const redTurns = PLAYER_DRAFT_TURNS.filter(t => t.side === 'red');
  assert.equal(blueTurns.length, 5);
  assert.equal(redTurns.length, 5);
});

test('chooseEqualizedPlayerPick fills complementary empty roles without duplicate picks', () => {
  const pool = getEqualizedPlayerPool();
  const blueTeam = [null, null, null, null, null];
  const redTeam = [null, null, null, null, null];
  const used = new Set();

  for (let t = 0; t < PLAYER_DRAFT_TURNS.length; t++) {
    const turn = PLAYER_DRAFT_TURNS[t];
    const currentTeam = turn.side === 'blue' ? blueTeam : redTeam;
    const opponentTeam = turn.side === 'blue' ? redTeam : blueTeam;
    const available = pool.filter(c => !used.has(c.id));

    const pick = chooseEqualizedPlayerPick(available, currentTeam, opponentTeam, 42 + t);
    assert.ok(pick, `Turn ${t} should produce a valid pick`);
    assert.ok(!used.has(pick.card.id), 'Picked card must not have been previously drafted');
    assert.equal(currentTeam[pick.slot], null, 'Picked slot must have been empty');

    currentTeam[pick.slot] = pick.card;
    used.add(pick.card.id);
  }

  // Both teams should now be completely filled with 5 valid 100 OVR players
  assert.equal(blueTeam.filter(p => p !== null).length, 5);
  assert.equal(redTeam.filter(p => p !== null).length, 5);
  assert.equal(used.size, 10);
});
