import test from 'node:test';
import assert from 'node:assert/strict';
import { CHAMPIONS, INITIAL_PLAYERS } from './mockData.ts';
import { createDevRandomMatch } from './devRandomMode.ts';

test('developer random mode creates a deterministic draft-free 5v5 with unique avatars and players', () => {
  const first = createDevRandomMatch(INITIAL_PLAYERS, CHAMPIONS, 73021);
  const replay = createDevRandomMatch(INITIAL_PLAYERS, CHAMPIONS, 73021);
  const all = [...first.blue, ...first.red];

  assert.deepEqual(first, replay);
  assert.equal(first.blue.length, 5);
  assert.equal(first.red.length, 5);
  assert.equal(new Set(all.map(entry => entry.player.id)).size, 10);
  assert.equal(new Set(all.map(entry => entry.champion.id)).size, 10);
  for (const { player } of all) {
    assert.equal(player.ovr, 100);
    assert.equal(player.tier, 'GOAT');
    assert.deepEqual(Object.values(player.stats), [100, 100, 100, 100, 100, 100]);
    assert.equal(player.playableRoles.length, 6);
  }
});

test('developer random mode changes the matchup when its seed changes', () => {
  const first = createDevRandomMatch(INITIAL_PLAYERS, CHAMPIONS, 111);
  const second = createDevRandomMatch(INITIAL_PLAYERS, CHAMPIONS, 222);
  const signature = match => [...match.blue, ...match.red]
    .map(entry => `${entry.player.id}:${entry.champion.id}`).join('|');

  assert.notEqual(signature(first), signature(second));
});

test('developer random mode rejects pools that cannot fill ten unique slots', () => {
  assert.throws(() => createDevRandomMatch(INITIAL_PLAYERS.slice(0, 9), CHAMPIONS, 1), /ten player cards/);
  assert.throws(() => createDevRandomMatch(INITIAL_PLAYERS, CHAMPIONS.slice(0, 9), 1), /ten avatars/);
});
