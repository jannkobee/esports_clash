import test from 'node:test';
import assert from 'node:assert/strict';
import { selectUtilityDecision, scoreUtility, MAX_UTILITY_CANDIDATES } from './utilityDecision.ts';
import { chooseCommittedActionTarget } from './decisionActionRecovery.ts';

const candidate = (key, priority = 'tactical', factors = { tactical: .5 }, rejected) => ({
  key, priority, factors, rejected, contextKey: 'v1', value: key, reason: 'fixture policy',
});
const decide = (candidates, extra = {}) => selectUtilityDecision({ actorAvailable: true, now: 10, candidates, ...extra });

test('mechanical rejection cannot be bought with personality or utility', () => {
  for (const gate of ['dead-target', 'stasis', 'no-mana', 'cooldown', 'nexus-shield', 'range', 'unreachable', 'no-vision']) {
    const result = decide([candidate('illegal', 'emergency', { strategic: 1e9, personality: 1e9 }, gate), candidate('hold')]);
    assert.equal(result.selected.key, 'hold');
    assert.equal(result.traces[0].rejected, gate);
  }
});
test('finish outranks optional farming, shopping, chase and objective preferences', () => {
  const result = decide([candidate('farm', 'optional', { strategic: 1 }), candidate('chase'),
    candidate('objective'), candidate('finish', 'finish', { strategic: .1 })]);
  assert.equal(result.selected.key, 'finish');
});
test('real emergency interrupts a committed finish but rejected emergencies cannot', () => {
  const candidates = [candidate('finish', 'finish'), candidate('defend', 'emergency')];
  const commitment = { key: 'finish', contextKey: 'v1', until: 12 };
  assert.equal(decide(candidates, { commitment }).selected.key, 'defend');
  candidates[1].rejected = 'defense-unavailable';
  assert.equal(decide(candidates, { commitment }).selected.key, 'finish');
});
test('commitment retains a legal target until expiry, context change or illegality', () => {
  const commitment = { key: 'held', contextKey: 'v1', until: 11 };
  const candidates = [candidate('better', 'tactical', { tactical: 1 }), candidate('held')];
  assert.equal(decide(candidates, { commitment }).reason, 'commitment');
  assert.equal(decide(candidates, { commitment, now: 11 }).selected.key, 'better');
  candidates[1].contextKey = 'changed';
  assert.equal(decide(candidates, { commitment }).selected.key, 'better');
  candidates[1].contextKey = 'v1'; candidates[1].rejected = 'untargetable';
  assert.equal(decide(candidates, { commitment }).selected.key, 'better');
});
test('factors are bounded, costs nonnegative, invalid scores rejected, trace sums explain scores', () => {
  assert.deepEqual(scoreUtility({ tactical: 1e9 }), scoreUtility({ tactical: 1 }));
  assert.equal(scoreUtility({ danger: -1 }).utility, 0);
  for (const value of [NaN, Infinity, -Infinity])
    assert.equal(decide([candidate('invalid', 'tactical', { tactical: value })]).reason, 'no-legal-action');
  const result = decide([candidate('a', 'tactical', { strategic: .6, personality: 1, danger: .2 })]);
  assert.equal(Object.values(result.traces[0].contributions).reduce((a, b) => a + b, 0), result.traces[0].utility);
});
test('dead actors cannot act and empty sets do not invent a fallback', () => {
  assert.equal(decide([candidate('a')], { actorAvailable: false }).selected, undefined);
  assert.equal(decide([]).reason, 'no-legal-action');
});
test('bounded stable selection consumes no randomness and does not mutate inputs', () => {
  const candidates = Array.from({ length: 40 }, (_, i) => candidate(String(i)));
  const before = structuredClone(candidates);
  const result = decide(candidates);
  assert.equal(result.selected.key, '0');
  assert.equal(result.traces.length, MAX_UTILITY_CANDIDATES);
  assert.equal(result.truncated, 8);
  assert.deepEqual(decide(candidates), result);
  assert.deepEqual(candidates, before);
  const quiet = decide(candidates, { explain: false });
  assert.equal(quiet.selected, result.selected);
  assert.equal(quiet.reason, result.reason);
  assert.deepEqual(quiet.traces, []);
});
test('personality can decide a close legal choice but cannot overwhelm clear tactical differences', () => {
  assert.equal(decide([candidate('steady', 'tactical', { tactical: .6 }),
    candidate('preferred', 'tactical', { tactical: .5, personality: 1 })]).selected.key, 'preferred');
  assert.equal(decide([candidate('steady', 'tactical', { tactical: 1 }),
    candidate('preferred', 'tactical', { tactical: .2, personality: 1, mood: 1 })]).selected.key, 'steady');
});
test('existing live action-recovery adapter accepts normalized scores and enforces its retry gates', () => {
  const a = { id: 'a', x: 0, y: 0, contextKey: 'v1', utility: { tactical: .2 } };
  const b = { ...a, id: 'b', utility: { tactical: .9 } };
  const input = { kind: 'champion', preferred: a, candidates: [a, b], now: 10 };
  assert.equal(chooseCommittedActionTarget(input).id, 'b');
  assert.equal(chooseCommittedActionTarget({ ...input,
    failures: [{ key: 'champion:b', contextKey: 'v1', failedAt: 9, retryAfter: 11, reason: 'unreachable' }] }).id, 'a');
});
