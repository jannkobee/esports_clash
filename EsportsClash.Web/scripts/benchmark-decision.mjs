import assert from 'node:assert/strict';
import { performance } from 'node:perf_hooks';
import { chooseCommittedActionTarget, isActionRetryBlocked, decisiveActionKey } from '../src/decisionActionRecovery.ts';

// Archived pre-migration arbitration is used only as a measurement/reference oracle.
function legacy(input) {
  const viable = input.candidates.slice(0, 12).filter(candidate => candidate.available !== false
    && candidate.safe !== false && candidate.reachable !== false
    && !isActionRetryBlocked(input.failures, decisiveActionKey(input.kind, candidate.id), input.now, candidate.contextKey));
  const held = input.intent?.kind === input.kind && input.intent.committedUntil > input.now
    ? viable.find(candidate => candidate.id === input.intent.targetId && candidate.contextKey === input.intent.contextKey) : undefined;
  return held || viable.find(candidate => candidate.id === input.preferred?.id) || viable[0];
}
const fixtures = Array.from({ length: 256 }, (_, flags) => {
  const candidates = Array.from({ length: 12 }, (_, i) => ({ id: String(i), x: i * 20, y: 350,
    contextKey: i === 2 && flags & 1 ? 'changed' : 'stable',
    available: i !== 2 || !(flags & 2), safe: i !== 2 || !(flags & 4), reachable: i !== 2 || !(flags & 8) }));
  return { kind: 'champion', candidates, preferred: candidates[flags % 12], now: 10,
    intent: flags & 16 ? { kind: 'champion', key: 'champion:2', targetId: '2', contextKey: 'stable', committedUntil: flags & 32 ? 11 : 9 } : undefined,
    failures: flags & 64 ? [{ key: 'champion:2', contextKey: 'stable', retryAfter: flags & 128 ? 11 : 9 }] : [] };
});
for (const fixture of fixtures) assert.equal(chooseCommittedActionTarget(fixture), legacy(fixture));
for (let i = 0; i < 10000; i++) chooseCommittedActionTarget(fixtures[i % fixtures.length]);
const measure = fn => {
  const samples = [];
  for (let pass = 0; pass < 5; pass++) {
    const started = performance.now();
    for (let i = 0; i < 50000; i++) fn(fixtures[i % fixtures.length]);
    samples.push((performance.now() - started) / 50000);
  }
  return samples.sort((a, b) => a - b)[2];
};
const before = measure(legacy), after = measure(chooseCommittedActionTarget);
console.log(JSON.stringify({ equivalenceCases: fixtures.length, candidatesPerPass: 12,
  legacyMedianMsPerCall: before, utilityMedianMsPerCall: after,
  addedMsFor50CallsPerTick: (after - before) * 50,
  caveat: 'Microbenchmark of selection only; excludes candidate generation, pathfinding, React and full live tick.' }, null, 2));
