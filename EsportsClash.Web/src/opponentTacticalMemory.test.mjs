import test from 'node:test';
import assert from 'node:assert/strict';
import { createOpponentTacticalMemory, observeOpponentTacticalMemory, readOpponentTacticalMemory } from './opponentTacticalMemory.ts';

test('visible focus and retreat observations expire and unseen attackers are ignored', () => {
  const memory = createOpponentTacticalMemory();
  observeOpponentTacticalMemory({ memory, viewer: 'blue', now: 10,
    visibleOpponents: [{ id: 'red', team: 'red', vx: 60, vy: 0 }],
    observedFocuses: [{ attackerId: 'red', targetId: 'blue', second: 10 }, { attackerId: 'hidden', targetId: 'blue', second: 10 }] });
  assert.deepEqual(readOpponentTacticalMemory(memory, 'blue', 'red', 'blue', 10.2), { retreating: true, focusingActor: true });
  assert.deepEqual(readOpponentTacticalMemory(memory, 'blue', 'red', 'blue', 11), { retreating: false, focusingActor: false });
  assert.deepEqual(readOpponentTacticalMemory(memory, 'blue', 'hidden', 'blue', 10.2), { retreating: false, focusingActor: false });
});
