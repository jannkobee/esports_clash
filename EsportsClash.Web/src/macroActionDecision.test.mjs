import test from 'node:test';
import assert from 'node:assert/strict';
import { chooseMacroAction, nextMacroCommitment } from './macroActionDecision.ts';

const action = (action, available = true, priority = 'tactical', factors = { tactical: .5 }) => ({
  action, available, priority, factors, contextKey: 'stable', reason: 'existing policy gate',
});
const choose = candidates => chooseMacroAction({ actorAvailable: true, now: 100, candidates });

test('a legal Nexus finish outranks optional wave, farm, push, and objective work', () => {
  const result = choose([action('wave', true, 'tactical', { tactical: .9 }),
    action('farm', true, 'optional', { strategic: 1 }), action('objective', true, 'tactical', { strategic: 1 }),
    action('finish', true, 'finish', { strategic: .1 })]);
  assert.equal(result.selected?.value, 'finish');
});

test('a validated base emergency outranks fighting and farming, while a rejected call does not', () => {
  const candidates = [action('fight', true, 'tactical', { tactical: 1 }),
    action('farm', true, 'optional', { strategic: 1 }), action('defend', true, 'emergency', { tactical: .1 })];
  assert.equal(choose(candidates).selected?.value, 'defend');
  candidates[2].available = false;
  assert.equal(choose(candidates).selected?.value, 'fight');
});

test('a legal active fight outranks wave and push but never an emergency or finish', () => {
  const candidates = [action('fight', true, 'tactical', { tactical: .9 }),
    action('wave', true, 'tactical', { tactical: .7 }), action('push', true, 'optional', { strategic: .8 })];
  assert.equal(choose(candidates).selected?.value, 'fight');
  candidates.push(action('retreat', true, 'emergency', { danger: 1 }));
  assert.equal(choose(candidates).selected?.value, 'retreat');
});

test('the bridge is deterministic and does not invent an action when every existing gate failed', () => {
  const candidates = [action('finish', false, 'finish'), action('defend', false, 'emergency'), action('farm', false, 'optional')];
  assert.equal(choose(candidates).selected, undefined);
  assert.deepEqual(choose(candidates), choose(candidates));
});

test('a legal macro action is retained briefly, but a higher-priority emergency interrupts it', () => {
  const candidates = [action('fight', true, 'tactical', { tactical: .4 }), action('wave', true, 'tactical', { tactical: 1 })];
  const commitment = { action: 'fight', contextKey: 'stable', until: 101 };
  assert.equal(chooseMacroAction({ actorAvailable: true, now: 100, candidates, commitment }).selected?.value, 'fight');
  candidates.push(action('defend', true, 'emergency', { tactical: .1 }));
  assert.equal(chooseMacroAction({ actorAvailable: true, now: 100, candidates, commitment }).selected?.value, 'defend');
});

test('a held macro action retains its original expiry instead of renewing every tick', () => {
  const fight = action('fight');
  const first = nextMacroCommitment(fight, 'utility', undefined, 10);
  assert.equal(first.until, 10.65);
  const held = nextMacroCommitment(fight, 'commitment', first, 10.3);
  assert.equal(held.until, first.until);
  const reopened = nextMacroCommitment(fight, 'utility', held, 10.66);
  assert.equal(reopened.until, 11.31);
});

test('a validated recovery recall beats a relic, while a relic remains available when recall is rejected', () => {
  const candidates = [action('retreat', true, 'emergency', { danger: .8, tactical: .2 }),
    action('relic', true, 'tactical', { tactical: 1, travel: .2 })];
  assert.equal(choose(candidates).selected?.value, 'retreat');
  candidates[0].available = false;
  assert.equal(choose(candidates).selected?.value, 'relic');
});
