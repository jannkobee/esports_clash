import test from 'node:test';
import assert from 'node:assert/strict';
import { advanceSimulationClock } from './simulationClock.ts';

test('game clock remains continuous when playback speed changes', () => {
  const clock = { current: 104 };
  assert.equal(advanceSimulationClock(clock, 0.05, 1, false), 0.05);
  assert.equal(clock.current, 104.05);
  assert.equal(advanceSimulationClock(clock, 0.05, 4, false), 0.2);
  assert.equal(clock.current, 104.25);
  assert.equal(advanceSimulationClock(clock, 0.05, 2, true), 0);
  assert.equal(clock.current, 104.25);
  assert.equal(advanceSimulationClock(clock, 5, 4, false), 0.4);
  assert.equal(clock.current, 104.65);
});
