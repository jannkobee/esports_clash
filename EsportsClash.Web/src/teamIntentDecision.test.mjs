import test from 'node:test';
import assert from 'node:assert/strict';
import { coordinateTeamIntent, teamIntentRole } from './teamIntentDecision.ts';

const call = (intent, available = true, priority = 'tactical', factors = { tactical: .5 }) => ({
  intent, available, priority, factors, contextKey: `${intent}:stable`, reason: 'existing policy gate',
});
const decide = candidates => coordinateTeamIntent({ now: 20, candidates });

test('validated defense and objective finishes outrank ordinary team calls', () => {
  const candidates = [call('fight', true, 'tactical', { tactical: 1 }), call('push', true, 'optional'),
    call('objective', true, 'finish', { strategic: .2 })];
  assert.equal(decide(candidates).selected?.value, 'objective');
  candidates.push(call('defend', true, 'emergency', { tactical: .1 }));
  assert.equal(decide(candidates).selected?.value, 'defend');
});

test('a shared call commits only while its context remains legal', () => {
  const candidates = [call('fight', true, 'tactical', { tactical: .3 }), call('regroup', true, 'tactical', { tactical: 1 })];
  const held = coordinateTeamIntent({ now: 20, candidates, commitment: { intent: 'fight', contextKey: 'fight:stable', until: 20.5 } });
  assert.equal(held.selected?.value, 'fight');
  candidates[0].available = false;
  assert.equal(coordinateTeamIntent({ now: 20, candidates, commitment: { intent: 'fight', contextKey: 'fight:stable', until: 20.5 } }).selected?.value, 'regroup');
});

test('supports use a fight call as a legal regroup-and-peel preference', () => {
  assert.equal(teamIntentRole('fight', 'Support'), 'regroup');
  assert.equal(teamIntentRole('fight', 'Fighter'), 'fight');
});
