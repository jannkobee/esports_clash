import test from 'node:test';
import assert from 'node:assert/strict';
import { adaptiveObservation } from './adaptiveObservation.ts';
import { adaptiveFeatures } from './adaptivePolicy.ts';

test('learned observations cannot depend on private opponent economy or hidden levels', () => {
  const own = { ownLevel: 6, kills: 1, deaths: 0, outnumbered: false };
  const a = adaptiveObservation({ ...own, visibleOpponents: [{ level: 5, gold: 100 }], hiddenOpponents: [{ level: 1 }] });
  const b = adaptiveObservation({ ...own, visibleOpponents: [{ level: 5, gold: 10000 }], hiddenOpponents: [{ level: 18 }] });
  assert.deepEqual(a, b);
  assert.equal(a.levelGap, 1);
  const player = { id: 'p_test', stats: { iq: 80, tf: 70, lan: 60, flx: 50 }, preferredRole: 'Mage' };
  const features = adaptiveFeatures(player, { primaryRole: 'Mage' }, .9, .8, a);
  for (const key of ['goldGap', 'netWorthGap', 'cardMemory:gappedDiscipline']) assert.equal(features[key], undefined);
});

test('no visible opponents means unknown level contrast, retaining own personality context', () => {
  const memory = { lessons: { survivalPatience: .8 } };
  const observation = adaptiveObservation({ ownLevel: 6, kills: 0, deaths: 3, outnumbered: true,
    visibleOpponents: [], cardMemory: memory });
  assert.equal(observation.levelGap, undefined);
  assert.equal(observation.cardMemory, memory);
  assert.equal(observation.isFeeding, true);
  assert.equal(observation.outnumbered, true);
});
