import test from 'node:test';
import assert from 'node:assert/strict';
import { CHAMPIONS, INITIAL_COACHES, INITIAL_PLAYERS } from './mockData.ts';
import { abilityRank, abilityDamageMultiplier, abilityCooldownMultiplier } from './skillProgression.ts';
import { chooseCoachPick, chooseCoachTeamPick, draftLineups, DRAFT_TURNS } from './draftRules.ts';
import { createRoom, joinRoom, getRoom, submitDraftTurn } from '../server.mjs';

test('opening abilities are weak and rank up at level milestones', () => {
  assert.equal(abilityRank(3, 'skill1'), 1);
  assert.equal(abilityRank(3, 'skill2'), 1);
  assert.equal(abilityRank(5, 'ultimate'), 0);
  assert.equal(abilityRank(6, 'ultimate'), 1);
  assert.equal(abilityRank(16, 'ultimate'), 3);
  assert.ok(abilityDamageMultiplier(3, 'skill1') < 0.5);
  assert.ok(abilityDamageMultiplier(9, 'skill1') > 1);
  assert.ok(abilityDamageMultiplier(16, 'ultimate') > abilityDamageMultiplier(6, 'ultimate'));
  assert.ok(abilityCooldownMultiplier(3, 'skill1') > abilityCooldownMultiplier(9, 'skill1'));
});

test('coach draft values role and team composition and does not lock to one marksman', () => {
  const player = INITIAL_PLAYERS[6];
  const marksmen = CHAMPIONS.filter(champion => champion.primaryRole === 'Marksman');
  const selections = new Set(Array.from({ length: 40 }, (_, seed) =>
    chooseCoachPick(marksmen, player, [], [], INITIAL_COACHES[1], seed)?.name));
  assert.ok(selections.size > 1, 'different drafts should permit more than one marksman');
  const mage = INITIAL_PLAYERS[5];
  const selected = chooseCoachPick(CHAMPIONS, mage, [], [], INITIAL_COACHES[1], 7);
  assert.equal(selected?.primaryRole === 'Mage' || selected?.secondaryRole === 'Mage', true);
  const rivalMarksmen = new Set();
  for (let seed = 0; seed < 40; seed++) {
    const unavailable = new Set(CHAMPIONS.filter(champion =>
      ['Valkira', 'Kage', 'Kyumi', 'Kindra', 'Renn'].includes(champion.name)).map(champion => champion.id));
    const picks = [];
    for (let turn = 0; turn < 5; turn++) {
      const pick = chooseCoachTeamPick(CHAMPIONS, INITIAL_PLAYERS.slice(5, 10), picks,
        unavailable, INITIAL_COACHES[1], seed + turn * 23);
      assert.ok(pick);
      picks.push(pick);
      unavailable.add(pick.championId);
    }
    rivalMarksmen.add(CHAMPIONS.find(champion => champion.id === picks.find(pick => pick.slot === 1).championId).name);
  }
  assert.ok(rivalMarksmen.size >= 2, 'the rival marksman should vary across drafts');
});

test('online server owns alternating turns and rejects stale, duplicate, and unauthorized picks', () => {
  const host = createRoom(INITIAL_PLAYERS.slice(0, 5), INITIAL_COACHES[0]);
  const guest = joinRoom(host.room.roomCode, INITIAL_PLAYERS.slice(5, 10), INITIAL_COACHES[1]);
  assert.equal(getRoom(host.room.roomCode, host.token).ready, true);
  assert.throws(() => getRoom(host.room.roomCode, 'invalid'));
  assert.throws(() => submitDraftTurn(host.room.roomCode, guest.token, CHAMPIONS[0].id, 0, 1), /Wait for your draft turn/);
  let room = submitDraftTurn(host.room.roomCode, host.token, CHAMPIONS[0].id, 0, 1);
  assert.throws(() => submitDraftTurn(host.room.roomCode, host.token, CHAMPIONS[1].id, 0, 1), /Draft changed/);
  assert.throws(() => submitDraftTurn(host.room.roomCode, guest.token, CHAMPIONS[0].id, 0, room.revision), /already banned/);
  for (let turnIndex = 1; turnIndex < DRAFT_TURNS.length; turnIndex++) {
    const side = DRAFT_TURNS[turnIndex].side;
    const token = side === 'blue' ? host.token : guest.token;
    const slot = room.picks[side].length;
    room = submitDraftTurn(host.room.roomCode, token, CHAMPIONS[turnIndex].id, slot, room.revision);
  }
  assert.equal(room.turnIndex, DRAFT_TURNS.length);
  const lineups = draftLineups(room, CHAMPIONS);
  assert.equal(lineups.blue.length, 5);
  assert.equal(lineups.red.length, 5);
  assert.equal(new Set([...lineups.blue, ...lineups.red].map(pick => pick.champion.id)).size, 10);
  assert.throws(() => submitDraftTurn(host.room.roomCode, host.token, CHAMPIONS[15].id, 0, room.revision), /already complete/);
});
