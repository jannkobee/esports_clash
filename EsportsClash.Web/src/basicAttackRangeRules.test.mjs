import assert from 'node:assert/strict';
import test from 'node:test';
import { CHAMPIONS } from './mockData.ts';
import { getSkillCastRange } from './skillRangeRules.ts';
import { laneAdvanceLimit } from './teamTempoRules.ts';
import {
  STRUCTURE_HIT_RADIUS,
  canBasicAttackStructure,
  getChampionBasicAttackRange,
  getStructureBasicAttackReach,
} from './basicAttackRangeRules.ts';

const champion = name => CHAMPIONS.find(candidate => candidate.name === name);
const structure = (type, range) => ({ type, range, x: 0, y: 0 });

test('all playable avatars resolve finite basic reach with meaningful melee and ranged separation', () => {
  for (const avatar of CHAMPIONS) {
    const range = getChampionBasicAttackRange(avatar);
    assert.ok(Number.isFinite(range) && range >= 40 && range <= 205, `${avatar.name}: ${range}`);
  }

  assert.equal(getChampionBasicAttackRange(champion('Solana')), 40);
  assert.equal(getChampionBasicAttackRange(champion('Buck')), 95);
  assert.equal(getChampionBasicAttackRange(champion('Astra')), 195);
  assert.equal(getChampionBasicAttackRange(champion('Solenne')), 205);
  assert.equal(getChampionBasicAttackRange(champion('Kaelen')), 182,
    'an unmapped ranged kit must not silently fall back to melee reach');
});

test('card attributes cannot alter physical basic-attack range', () => {
  const astra = champion('Astra');
  assert.equal(getChampionBasicAttackRange({ ...astra, iq: 1, tf: 1, ovr: 1 }), 195);
  assert.equal(getChampionBasicAttackRange({ ...astra, iq: 99, tf: 99, ovr: 99 }), 195);
});

test('structure contact radii are explicit and armed structures cannot be hit outside retaliation range', () => {
  const tower = structure('outer_tower', 135);
  const nexus = structure('nexus', 190);
  const barracks = structure('barracks', 0);

  assert.equal(STRUCTURE_HIT_RADIUS.outer_tower, 32);
  assert.equal(getStructureBasicAttackReach(40, tower), 72);
  assert.equal(getStructureBasicAttackReach(195, tower), 135);
  assert.equal(getStructureBasicAttackReach(195, nexus), 190);
  assert.equal(getStructureBasicAttackReach(195, barracks), 230);
  assert.equal(canBasicAttackStructure({ x: 135, y: 0, attackRange: 195 }, tower), true);
  assert.equal(canBasicAttackStructure({ x: 135.01, y: 0, attackRange: 195 }, tower), false);
});

test('the no-wave turret perimeter is outside basic siege reach', () => {
  const tower = { ...structure('outer_tower', 135), x: 1550 };
  const holdX = laneAdvanceLimit({
    team: 'blue', waveCount: 0, structureX: tower.x, structureRange: tower.range,
    exposedNexus: false, objectiveFight: false,
  });

  assert.equal(holdX, 1387);
  assert.equal(canBasicAttackStructure({ x: holdX, y: 0, attackRange: 205 }, tower), false,
    'a ranged avatar must wait for a wave instead of damaging a tower from the safe tether');
});

test('tower reach cap does not shorten long-range abilities', () => {
  const astraAttackRange = getChampionBasicAttackRange(champion('Astra'));
  assert.equal(getStructureBasicAttackReach(astraAttackRange, structure('outer_tower', 135)), 135);
  assert.equal(getSkillCastRange('Astra', 'ultimate', astraAttackRange), 550);
  assert.equal(getSkillCastRange('Aetherbolt', 'ultimate', 205), 430);
});

