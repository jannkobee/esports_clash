import test from 'node:test';
import assert from 'node:assert/strict';
import { chooseBaseDefense, shouldStandAndDefendBase, shouldLeaveWellToDefend,
  shouldRecallToDefendBase, shouldInterruptRecallForDefense } from './baseDefenseRules.ts';
import { ARENA_WIDTH, NEXUS_X, NEXUS_TOWER_X, OUTER_TOWER_X } from './arenaLayout.ts';

const actor = { team: 'blue', x: 1500, y: 380 };
const building = (type, x, hp = 100) => ({ id: type, team: 'blue', type, x, y: 380,
  hp, maxHp: 100, range: 135, isAlive: true });
const enemy = x => ({ id: `enemy${x}`, team: 'red', x, y: 380, isAlive: true });
const nexus = building('nexus', NEXUS_X.blue);
const tier3 = building('nexus_tower', NEXUS_TOWER_X.blue);
const outer = building('outer_tower', OUTER_TOWER_X.blue);

test('Nexus and tier 3 threats recruit across the wider map ahead of outer towers', () => {
  assert.equal(chooseBaseDefense(actor, [outer, tier3, nexus],
    [enemy(outer.x), enemy(tier3.x), enemy(nexus.x)], []).building.id, nexus.id);
  assert.equal(chooseBaseDefense(actor, [outer, tier3],
    [enemy(outer.x), enemy(tier3.x)], []).building.id, tier3.id);
  assert.equal(chooseBaseDefense({ ...actor, x: 2500 }, [outer], [enemy(outer.x)], []), undefined);
});

test('siege waves trigger defense without champions; dead, unscouted, absent and allied threats do not', () => {
  assert.equal(chooseBaseDefense(actor, [nexus], [], [enemy(nexus.x)]).urgent, true);
  assert.equal(chooseBaseDefense(actor, [nexus], [], []), undefined);
  assert.equal(chooseBaseDefense(actor, [nexus], [{ ...enemy(nexus.x), isAlive: false }], []), undefined);
  assert.equal(chooseBaseDefense(actor, [nexus], [{ ...enemy(nexus.x), team: 'blue' }], []), undefined);
  assert.equal(chooseBaseDefense(actor, [nexus], [], [{ ...enemy(nexus.x), isAlive: false }]), undefined);
  assert.equal(chooseBaseDefense(actor, [nexus], [], [{ ...enemy(nexus.x), team: 'blue' }]), undefined);
  assert.equal(chooseBaseDefense(actor, [{ ...nexus, isAlive: false }], [enemy(nexus.x)], []), undefined);
  assert.equal(chooseBaseDefense(actor, [{ ...nexus, team: 'red' }], [enemy(nexus.x)], []), undefined);
  assert.equal(chooseBaseDefense(actor, [{ ...nexus, hp: 5 }], [], []), undefined,
    'low HP is not proof of an ongoing attack');
});

test('defense priorities and home-side rally positions are mirrored', () => {
  const blue = chooseBaseDefense(actor, [tier3], [enemy(tier3.x)], []);
  const red = chooseBaseDefense({ ...actor, team: 'red', x: ARENA_WIDTH - actor.x },
    [{ ...tier3, team: 'red', x: ARENA_WIDTH - tier3.x }],
    [{ ...enemy(tier3.x), team: 'blue', x: ARENA_WIDTH - tier3.x }], []);
  assert.equal(blue.score, red.score);
  assert.equal(blue.rally.x + red.rally.x, ARENA_WIDTH);
});

test('overlapping structure ranges do not confuse a front tower siege with a nexus attack', () => {
  const towerOnly = chooseBaseDefense(actor, [nexus, tier3], [enemy(tier3.x)], []);
  assert.equal(towerOnly?.building.id, tier3.id);
  assert.equal(towerOnly?.attackers.length, 1);
  const nexusOnly = chooseBaseDefense(actor, [nexus, tier3], [enemy(nexus.x)], []);
  assert.equal(nexusOnly?.building.id, nexus.id);
  assert.equal(nexusOnly?.attackers.length, 1);
  const waveOnly = chooseBaseDefense(actor, [nexus, tier3], [], [enemy(tier3.x)]);
  assert.equal(waveOnly?.building.id, tier3.id);
});

test('defense maintains limited detection hysteresis, then fully releases the call', () => {
  const atEdge = enemy(nexus.x + 285 + 20);
  assert.equal(chooseBaseDefense(actor, [nexus], [atEdge], []), undefined);
  assert.equal(chooseBaseDefense(actor, [nexus], [atEdge], [], nexus.id)?.building.id, nexus.id);
  assert.equal(chooseBaseDefense(actor, [nexus], [enemy(nexus.x + 321)], [], nexus.id), undefined);
  assert.equal(chooseBaseDefense(actor, [nexus], [], [], nexus.id), undefined);
});

test('champions defend when viable; do not suicide under tower fire or losing fights', () => {
  const call = { urgent: true, critical: true };
  const ready = { healthFraction: 0.7, losingFight: false, outnumbered: false,
    diveAborting: false, takingTurretFire: false };
  assert.equal(shouldStandAndDefendBase(call, ready), true);
  assert.equal(shouldStandAndDefendBase(undefined, ready), false);
  assert.equal(shouldStandAndDefendBase(call, { ...ready, healthFraction: 0.25 }), false);
  assert.equal(shouldStandAndDefendBase(call, { ...ready, losingFight: true }), false);
  assert.equal(shouldStandAndDefendBase(call, { ...ready, diveAborting: true }), false);
  assert.equal(shouldStandAndDefendBase(call, { ...ready, takingTurretFire: true }), false);
  assert.equal(shouldStandAndDefendBase(call, { ...ready, outnumbered: true, healthFraction: 0.55 }), false);
  assert.equal(shouldStandAndDefendBase(call, { ...ready, outnumbered: true }), true);
  assert.equal(shouldStandAndDefendBase({ urgent: false, critical: false },
    { ...ready, healthFraction: 0.42 }), false);
});

test('well recovery has a minimum combat-ready threshold during a core siege', () => {
  const call = { urgent: true, critical: true };
  assert.equal(shouldLeaveWellToDefend(call, { healthFraction: 0.8, manaFraction: 0.4 }), true);
  assert.equal(shouldLeaveWellToDefend(call, { healthFraction: 0.4, manaFraction: 0.4 }), false);
  assert.equal(shouldLeaveWellToDefend(call, { healthFraction: 0.8, manaFraction: 0.1 }), false);
  assert.equal(shouldLeaveWellToDefend(undefined, { healthFraction: 1, manaFraction: 1 }), false);
  assert.equal(shouldLeaveWellToDefend({ urgent: false, critical: false },
    { healthFraction: 0.8, manaFraction: 0.4 }), false);
});

test('distant safe defenders recall faster; nearby defenders walk and finish short channels', () => {
  const call = { urgent: true, critical: true };
  const travel = { position: { x: 1500, y: 380 }, rally: { x: 160, y: 380 },
    well: { x: 80, y: 380 }, movementSpeed: 100, channelSeconds: 2.5, canChannel: true };
  assert.equal(shouldRecallToDefendBase(call, travel), true);
  assert.equal(shouldRecallToDefendBase(call, { ...travel, canChannel: false }), false);
  assert.equal(shouldRecallToDefendBase(undefined, travel), false);
  assert.equal(shouldRecallToDefendBase(call,
    { ...travel, position: { x: 400, y: 380 } }), false);
  assert.equal(shouldInterruptRecallForDefense(call, {
    ...travel, position: { x: 300, y: 380 }, channelRemaining: 2.5, healthy: true,
  }), true);
  assert.equal(shouldInterruptRecallForDefense(call, {
    ...travel, position: { x: 300, y: 380 }, channelRemaining: 0.2, healthy: true,
  }), false);
  assert.equal(shouldInterruptRecallForDefense(call, {
    ...travel, position: { x: 300, y: 380 }, channelRemaining: 2.5, healthy: false,
  }), false);
});

test('recall travel-time decisions are symmetric for red and blue sides', () => {
  const call = { urgent: true, critical: true };
  const blue = { position: { x: 1300, y: 380 }, rally: { x: 160, y: 380 },
    well: { x: 80, y: 380 }, movementSpeed: 100, channelSeconds: 2.5, canChannel: true };
  const mirrored = Object.fromEntries(Object.entries(blue).map(([key, value]) =>
    value && typeof value === 'object' && 'x' in value
      ? [key, { x: ARENA_WIDTH - value.x, y: value.y }] : [key, value]));
  assert.equal(shouldRecallToDefendBase(call, blue), shouldRecallToDefendBase(call, mirrored));
  assert.equal(shouldInterruptRecallForDefense(call, { ...blue, channelRemaining: 1, healthy: true }),
    shouldInterruptRecallForDefense(call, { ...mirrored, channelRemaining: 1, healthy: true }));
});

test('unknown types and corrupt maxHP do not create NaN priority', () => {
  const unknown = { ...building('other', 500), maxHp: 0 };
  const call = chooseBaseDefense({ ...actor, x: 500 }, [unknown], [enemy(500)], []);
  assert.equal(call?.score, 2);
  assert.equal(call?.urgent, false);
});
