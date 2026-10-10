import test from 'node:test';
import assert from 'node:assert/strict';
import {
  abilityTargetingDetails,
  aetherisUltimateDurationAtRank,
  findAetherisInnateAlly
} from './aetherisAbilities.ts';

test('Aetheris ultimate duration scales from five to eight seconds by rank', () => {
  assert.deepEqual([1, 2, 3, 4].map(aetherisUltimateDurationAtRank), [5, 6, 7, 8]);
  assert.equal(aetherisUltimateDurationAtRank(0), 5);
  assert.equal(aetherisUltimateDurationAtRank(5), 8);
});

test('ability targeting details distinguish unit, ally, self and ground casts', () => {
  assert.match(abilityTargetingDetails({ targeting: 'ground' }), /Ground-targeted/);
  assert.match(abilityTargetingDetails({ targeting: 'unit' }), /point-and-click/);
  assert.match(abilityTargetingDetails({ targeting: 'ally' }), /allied avatar/);
  assert.match(abilityTargetingDetails({ targeting: 'self' }), /around the casting avatar/);
});

test('Aetheris innate links to the closest living ally on its own team within range', () => {
  const aetheris = { id: 'a', team: 'blue', x: 100, y: 100 };
  const ally = (id, team, x, isAlive = true) => ({ id, team, x, y: 100, isAlive });
  assert.equal(findAetherisInnateAlly(aetheris, [
    ally('far', 'blue', 320),
    ally('near', 'blue', 180),
    ally('enemy', 'red', 110),
    ally('dead', 'blue', 105, false),
    ally('out-of-range', 'blue', 500)
  ])?.id, 'near');
});
