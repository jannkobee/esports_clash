import test from 'node:test';
import assert from 'node:assert/strict';
import { chooseKnownJungleCamp, neutralAttackRange, shouldFocusExposedNexus, shouldPressWonFight,
  choosePostRecallTeamCamp, shouldStartPostRecallCampObjective, shareJungleCampRewards } from './macroFarmRules.ts';

const camps = [
  { id: 'home', type: 'blue_buff', x: 530, y: 150, homeX: 485, homeY: 145, isAlive: true },
  { id: 'enemy', type: 'red_buff', x: 1515, y: 145, isAlive: true },
];
const actor = {
  x: 800, y: 380, team: 'blue', hpFraction: 0.9, iq: 82,
  jungleStrength: 2, gameSeconds: 90, nearbyEnemyCount: 0,
  nearestLaneEnemyDistance: 500, urgentStructurePush: false,
};

test('neutral attacks keep a short reach without changing champion attack range', () => {
  assert.equal(neutralAttackRange(205), 130);
  assert.equal(neutralAttackRange(205, true), 145);
  assert.equal(neutralAttackRange(50), 50);
});

test('a jungler routes to a known camp home without a vision requirement', () => {
  assert.equal(chooseKnownJungleCamp(camps, actor)?.id, 'home');
  assert.equal(chooseKnownJungleCamp(camps, { ...actor, x: 10, y: 600 }), undefined);
});

test('lane pressure, enemy threat, and a nexus finish window cancel camp farming', () => {
  assert.equal(chooseKnownJungleCamp(camps, { ...actor, nearestLaneEnemyDistance: 160 }), undefined);
  assert.equal(chooseKnownJungleCamp(camps, { ...actor, nearbyEnemyCount: 1 }), undefined);
  assert.equal(chooseKnownJungleCamp(camps, { ...actor, urgentStructurePush: true }), undefined);
});

test('a chosen farm route survives distance changes but never overrides safety or a teamfight', () => {
  const alternative = { id: 'closer', type: 'wolves', x: 760, y: 500, isAlive: true };
  const options = [...camps, alternative];
  assert.equal(chooseKnownJungleCamp(options, actor)?.id, 'closer');
  const committed = { ...actor, currentCampId: 'home' };
  assert.equal(chooseKnownJungleCamp(options, committed)?.id, 'home');
  assert.equal(chooseKnownJungleCamp(options.map(c => c.id === 'home' ? { ...c, isAlive: false } : c), committed)?.id, 'closer');
  for (const danger of [{ nearbyEnemyCount: 1 }, { hpFraction: 0.4 },
    { nearestLaneEnemyDistance: 180 }, { urgentStructurePush: true }, { alliedFight: true }]) {
    assert.equal(chooseKnownJungleCamp(options, { ...committed, ...danger }), undefined);
    assert.equal(chooseKnownJungleCamp(options, { ...committed, teamObjective: true, role: 'Support', ...danger }), undefined);
  }
});

test('supports join a coordinated post-recall camp objective but do not solo farm', () => {
  assert.equal(chooseKnownJungleCamp(camps, { ...actor, role: 'Support' }), undefined);
  assert.equal(chooseKnownJungleCamp(camps, { ...actor, supportStrength: 3 }), undefined);
  assert.equal(chooseKnownJungleCamp(camps, { ...actor, role: 'Support', supportStrength: 2 }), undefined);
  assert.equal(chooseKnownJungleCamp(camps, {
    ...actor, x: 65, y: 380, role: 'Support', supportStrength: 3, teamObjective: true,
  })?.id, 'home');
});

test('post-recall camp calls need a healthy group, a live camp, and a safe map', () => {
  const call = { recentlyRecalledAllies: 2, livingAllies: 5, healthyAllies: 3,
    campAvailable: true, activeThreat: false, activePush: false };
  assert.equal(shouldStartPostRecallCampObjective(call), true);
  assert.equal(shouldStartPostRecallCampObjective({ ...call, recentlyRecalledAllies: 1 }), false);
  assert.equal(shouldStartPostRecallCampObjective({ ...call, livingAllies: 2 }), false);
  assert.equal(shouldStartPostRecallCampObjective({ ...call, campAvailable: false }), false);
  assert.equal(shouldStartPostRecallCampObjective({ ...call, activeThreat: true }), false);
  assert.equal(shouldStartPostRecallCampObjective({ ...call, activePush: true }), false);
});

test('a post-recall group receives one shared, nearby home-side camp', () => {
  const expandedCamps = [
    ...camps,
    { id: 'blue-far', type: 'wolves', x: 680, y: 590, isAlive: true },
    { id: 'red-near', type: 'blue_buff', x: 1620, y: 145, isAlive: true },
    { id: 'red-far', type: 'red_buff', x: 1515, y: 600, isAlive: true },
  ];
  assert.equal(choosePostRecallTeamCamp(expandedCamps, 'blue', [
    { x: 210, y: 380 }, { x: 230, y: 380 },
  ])?.id, 'home');
  assert.equal(choosePostRecallTeamCamp(expandedCamps, 'red', [
    { x: 1770, y: 380 }, { x: 1790, y: 380 },
  ])?.id, 'red-near');
  assert.equal(choosePostRecallTeamCamp(expandedCamps, 'blue', [{ x: 220, y: 380 }]), undefined);
});

test('jungle camp gold and experience are shared without multiplying the bounty', () => {
  const rewards = shareJungleCampRewards(85, 110, ['blue-1', 'blue-2', 'blue-1'], 'blue-2');
  assert.deepEqual(rewards, [
    { id: 'blue-1', gold: 42, xp: 55 },
    { id: 'blue-2', gold: 43, xp: 55 },
  ]);
  assert.equal(rewards.reduce((sum, share) => sum + share.gold, 0), 85);
  assert.equal(rewards.reduce((sum, share) => sum + share.xp, 0), 110);
});

test('an exposed low-health nexus becomes a finish objective, informed by card and coach', () => {
  const nexus = { isAlive: true, hp: 2800, maxHp: 7500 };
  assert.equal(shouldFocusExposedNexus(nexus, true, 90, 12), true);
  assert.equal(shouldFocusExposedNexus(nexus, true, 30, 4), false);
  assert.equal(shouldFocusExposedNexus(nexus, false, 90, 12), false);
  assert.equal(shouldFocusExposedNexus({ ...nexus, isAlive: false }, true, 90, 12), false);
});

test('a won fight sends healthy survivors to structures before shopping or farming', () => {
  const opportunity = { secondsSinceTeamKill: 6, aliveAllies: 4, aliveEnemies: 1,
    healthFraction: 0.62, nearestStructureDistance: 450, iq: 86, coachMacro: 15, losingFight: false };
  assert.equal(shouldPressWonFight(opportunity), true);
  assert.equal(shouldPressWonFight({ ...opportunity, aliveEnemies: 4 }), false);
  assert.equal(shouldPressWonFight({ ...opportunity, healthFraction: 0.2 }), false);
  assert.equal(shouldPressWonFight({ ...opportunity, losingFight: true }), false);
  assert.equal(shouldPressWonFight({ ...opportunity, nearestStructureDistance: 950 }), false);
  assert.equal(shouldPressWonFight({ ...opportunity, secondsSinceTeamKill: 19 }), false);
  assert.equal(shouldPressWonFight({ ...opportunity, iq: 45, coachMacro: 5,
    healthFraction: 0.42 }), false);
});
