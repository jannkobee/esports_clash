import test from 'node:test';
import assert from 'node:assert/strict';
import { consumeFixedSteps, createMatchRandom, rerollAfterBalanceGame, resolveNeutralKillCredit, resolveTurretKillReward, SIMULATION_STEP, summarizeMatchReports } from './matchReplay.ts';

test('a seed produces the same random decisions on a rematch', () => {
  const first = createMatchRandom(12345);
  const second = createMatchRandom(12345);
  assert.deepEqual(Array.from({ length: 100 }, first), Array.from({ length: 100 }, second));
  assert.notDeepEqual(Array.from({ length: 3 }, createMatchRandom(4)), Array.from({ length: 3 }, createMatchRandom(5)));
});

test('fixed game steps are independent of frame grouping and playback speed', () => {
  const one = { current: 0 };
  const four = { current: 0 };
  const oneSteps = Array.from({ length: 120 }, () => consumeFixedSteps(one, 1 / 60, 1, false)).reduce((a, b) => a + b, 0);
  const fourSteps = Array.from({ length: 30 }, () => consumeFixedSteps(four, 1 / 60, 4, false)).reduce((a, b) => a + b, 0);
  assert.equal(oneSteps, 60);
  assert.equal(fourSteps, 60);
  assert.equal(oneSteps * SIMULATION_STEP, fourSteps * SIMULATION_STEP);
  assert.equal(consumeFixedSteps(one, 1, 4, true), 0);
});

test('balance games share a seed across a side-swapped pair', () => {
  assert.equal(rerollAfterBalanceGame(25), false);
  assert.equal(rerollAfterBalanceGame(24), true);
  assert.equal(rerollAfterBalanceGame(2), true);
});

test('neutral kill goes to the last recent opposing attacker', () => {
  const champions = [{ id: 'old', team: 'red' }, { id: 'latest', team: 'red' }, { id: 'ally', team: 'blue' }];
  assert.equal(resolveNeutralKillCredit({ attackerId: 'latest', second: 22 }, 'blue', 27, champions)?.id, 'latest');
  assert.equal(resolveNeutralKillCredit({ attackerId: 'latest', second: 22 }, 'blue', 33, champions), null);
  assert.equal(resolveNeutralKillCredit({ attackerId: 'ally', second: 22 }, 'blue', 27, champions), null);
  assert.equal(resolveNeutralKillCredit(undefined, 'blue', 27, champions), null);
});

test('turret kill goes to last attacker within 10s; if >10s turret executes and splits 300g to turret team', () => {
  const champions = [
    { id: 'red_1', team: 'red', gold: 500, kills: 0 },
    { id: 'red_2', team: 'red', gold: 500, kills: 0 },
    { id: 'red_3', team: 'red', gold: 500, kills: 0 },
    { id: 'red_4', team: 'red', gold: 500, kills: 0 },
    { id: 'red_5', team: 'red', gold: 500, kills: 0 },
    { id: 'blue_1', team: 'blue', gold: 500, kills: 0 },
  ];

  // Case 1: Enemy damaged victim 6 seconds ago (<= 10s) -> killer gets credit, split gold is 0
  const hitWithin10s = { team: 'blue', lastEnemyDamage: { attackerId: 'red_2', second: 44 } };
  const res1 = resolveTurretKillReward(hitWithin10s, 50, champions, 10, 300);
  assert.equal(res1.killer?.id, 'red_2');
  assert.equal(res1.splitGoldPerAlly, 0);
  assert.equal(res1.turretTeam, 'red');

  // Case 2: Exactly 10.0 seconds -> still within window, enemy gets credit
  const hitExactly10s = { team: 'blue', lastEnemyDamage: { attackerId: 'red_2', second: 40 } };
  const res2 = resolveTurretKillReward(hitExactly10s, 50, champions, 10, 300);
  assert.equal(res2.killer?.id, 'red_2');
  assert.equal(res2.splitGoldPerAlly, 0);

  // Case 3: Elapsed time is 11 seconds (> 10s) -> killer is null, red team splits 300g (60g each for 5 allies)
  const hitExpired = { team: 'blue', lastEnemyDamage: { attackerId: 'red_2', second: 39 } };
  const res3 = resolveTurretKillReward(hitExpired, 50, champions, 10, 300);
  assert.equal(res3.killer, null);
  assert.equal(res3.turretTeam, 'red');
  assert.equal(res3.splitGoldPerAlly, 60);
  assert.equal(res3.turretAllies.length, 5);

  // Case 4: No enemy damage ever recorded -> killer is null, red team splits 300g (60g each)
  const noHit = { team: 'blue', lastEnemyDamage: undefined };
  const res4 = resolveTurretKillReward(noHit, 50, champions, 10, 300);
  assert.equal(res4.killer, null);
  assert.equal(res4.splitGoldPerAlly, 60);
});


test('balance summary uses completed match samples without inventing missing rates', () => {
  const base = { version: 1, seed: 1, draft: { blue: [], red: [] }, winner: 'blue', durationSeconds: 900,
    blueRating: 95, redRating: 80, fullBuildsAt15: 3,
    itemCounts: { 8: [4, 3, 3, 2, 3, 3, 2, 3, 2, 3], 12: [6, 5, 5, 4, 5, 5, 4, 5, 4, 5] },
    blueKills: 9, redKills: 4,
    skillshotsFired: 10, skillshotsHit: 5, events: [
      { second: 60, type: 'jungle', text: 'BLUE team claimed blue buff' },
      { second: 600, type: 'dragon', text: 'DRAGON SLAIN' }
    ] };
  const summary = summarizeMatchReports([base, { ...base, seed: 2, winner: 'red', durationSeconds: 1200,
    fullBuildsAt15: 1, skillshotsFired: 10, skillshotsHit: 7 }]);
  assert.equal(summary.matches, 2);
  assert.equal(summary.blueWinRate, 0.5);
  assert.equal(summary.skillshotHitRate, 0.6);
  assert.equal(summary.averageFullBuildsAt15, 2);
  assert.equal(summary.matchesAt15, 2);
  assert.equal(summary.itemTimings[8].matches, 2);
  assert.equal(summary.itemTimings[8].bestFarmerItems, 4);
  assert.equal(summary.itemTimings[12].matches, 2);
  assert.equal(summary.itemTimings[12].bestFarmerItems, 6);
  assert.equal(summary.itemTimings[13].matches, 0);
  assert.equal(summary.averageObjectiveTime, 10);
  assert.equal(summary.higherRatedWinRate, 0.5);
  assert.equal(summarizeMatchReports([]).skillshotHitRate, 0);
  assert.equal(summarizeMatchReports([{ ...base, durationSeconds: 300, fullBuildsAt15: null }]).matchesAt15, 0);
  assert.equal(summarizeMatchReports([{ ...base, itemCounts: undefined }]).itemTimings[8].matches, 0);
  const withInsights = { ...base, insights: { players: { p: { casts: { skill1: 4, skill2: 3, ultimate: 1 },
    manaBlocks: 2, blackHoleInterrupts: 1, escapeJaunts: 1 } }, timeline: [] } };
  assert.equal(summarizeMatchReports([base, withInsights]).averageSkill2Casts, 3);
  assert.equal(summarizeMatchReports([withInsights]).blackHoleInterrupts, 1);
  assert.equal(summarizeMatchReports([withInsights]).paxiEscapeJaunts, 1);
});
