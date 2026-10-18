import test from 'node:test';
import assert from 'node:assert/strict';
import { acceptOnlineSnapshot, interpolateSpectatorFrame } from './onlineSpectator.ts';

const versions = { rules_version: 'approved', policy_version: 'baseline' };
const frame = () => ({ second: 30, champions: Array.from({ length: 10 }, (_, i) => ({ id: String(i), x: i * 100, y: 380, isAlive: true })),
  minions: [], structures: [], camps: [], dragon: {}, projectiles: [], spells: [], wards: [] });
const message = () => ({ type: 'snapshot', schema: 1, match_id: 'match', sequence: 20, versions, snapshot: { frame: frame() } });
test('spectators accept a reconnect baseline and reject foreign, stale, mismatched or corrupt frames', () => {
  assert.ok(acceptOnlineSnapshot(message(), 'match', versions, 1));
  assert.ok(!acceptOnlineSnapshot(message(), 'another-match', versions, 1));
  assert.ok(!acceptOnlineSnapshot(message(), 'match', versions, 20));
  assert.ok(!acceptOnlineSnapshot(message(), 'match', { ...versions, policy_version: 'unapproved' }, 1));
  const corrupt = message(); corrupt.snapshot.frame.champions[0].x = Infinity;
  assert.ok(!acceptOnlineSnapshot(corrupt, 'match', versions, 1));
});
test('spectator interpolation never extrapolates, mutates input or revives dead actors', () => {
  const a = frame(), b = frame(); b.second = 31; b.champions[0].x = 100; b.champions[1].isAlive = false;
  const before = JSON.stringify([a, b]);
  assert.equal(interpolateSpectatorFrame(a, b, .5).champions[0].x, 50);
  assert.equal(interpolateSpectatorFrame(a, b, 5).champions[0].x, 100);
  assert.equal(interpolateSpectatorFrame(a, b, -5).champions[0].x, 0);
  assert.equal(interpolateSpectatorFrame(a, b, .5).champions[1].isAlive, false);
  assert.equal(JSON.stringify([a, b]), before);
});
