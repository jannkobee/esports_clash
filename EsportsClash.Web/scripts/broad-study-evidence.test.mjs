import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { validateBroadCase } from './broad-study-evidence.mjs';
const raw = JSON.parse(await readFile('../docs/ml-team-train-137-d0-original.json', 'utf8'));
raw.afterSeconds = 120; raw.draftLineup = [{ playerId: 'fixture', championId: 'fixture' }];
const item = { seed: 137, draft: 0, swapped: false, afterSeconds: 120, scoutSeconds: 240 };
const plan = { horizonSeconds: 30, pair: 'farm-push', drafts: { 0: raw.draftLineup } };

test('broader collector independently verifies same-state controls, lineup and recomputed labels', () => {
  assert.equal(validateBroadCase(raw, item, plan).status, 'valid');
  for (const corrupt of [
    value => value.draftLineup[0].playerId = 'wrong-player',
    value => value.replays[1].event.followupStateFingerprint = 'different',
    value => value.replays[2].event.actorStart.hpFraction = .1,
    value => value.replays[2].event.teamOutcome.reward = .99,
    value => value.replays[0].record.selected = 'push',
    value => value.afterSeconds = 600,
  ]) { const value = structuredClone(raw); corrupt(value); assert.throws(() => validateBroadCase(value, item, plan)); }
});

test('missing opportunities and failed controls cannot be silently counted as usable training data', () => {
  assert.equal(validateBroadCase({ ...raw, validPair: false }, item, plan).status, 'invalid-controls');
  assert.equal(validateBroadCase({ ...raw, validPair: false, scout: {} }, item, plan).status, 'no-target');
});
