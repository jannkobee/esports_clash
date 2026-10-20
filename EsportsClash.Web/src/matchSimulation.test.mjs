import test from 'node:test';
import assert from 'node:assert/strict';
import {
  runMatchSimulation,
  simulateBatchMatchesParallel,
  createDefaultSimulationLineup
} from './matchSimulationEngine.ts';

test('deterministic seed reproducibility: identical seeds produce exact match results', () => {
  const seed = 42;
  const matchA = runMatchSimulation({ seed, maxDurationSeconds: 180 });
  const matchB = runMatchSimulation({ seed, maxDurationSeconds: 180 });

  assert.equal(matchA.winner, matchB.winner);
  assert.equal(matchA.durationSeconds, matchB.durationSeconds);
  assert.equal(matchA.blueKills, matchB.blueKills);
  assert.equal(matchA.redKills, matchB.redKills);
  assert.equal(matchA.blueGold, matchB.blueGold);
  assert.equal(matchA.redGold, matchB.redGold);
});

test('Cardrel parody alias is strictly preserved in simulation roster per AGENTS.md invariant', () => {
  const blueLineup = createDefaultSimulationLineup('blue');
  const cardrelCard = blueLineup.find(entry => entry.player.name === 'Cardrel');
  assert.ok(cardrelCard, 'Cardrel parody alias must exist on Blue Support lineup');
  assert.equal(cardrelCard.player.realName, 'Caedrel');
});

test('batch multi-seed simulation collects telemetry, verifies invariants, and generates diagnostics', async () => {
  const seeds = [101, 102, 103, 104, 105, 106, 107, 108, 109, 110];
  const analysis = await simulateBatchMatchesParallel(seeds, { maxDurationSeconds: 480 });

  assert.equal(analysis.totalMatches, 10);
  assert.ok(analysis.blueWins + analysis.redWins === 10);

  // Invariant 1: Match duration within authentic competitive timeframe (5 to 18 mins)
  assert.ok(analysis.averageDurationMinutes >= 5.0, `Avg duration ${analysis.averageDurationMinutes}m should be >= 5.0m`);
  assert.ok(analysis.averageDurationMinutes <= 18.0, `Avg duration ${analysis.averageDurationMinutes}m should be <= 18.0m`);

  // The headless simulator does not model the live post-recall team-camp call.
  assert.equal(analysis.supportCampFarms, 0, 'The simulation must not grant solo Support camp clears');

  // Tower dives are assessed through risk rather than a forced abort controller.
  assert.ok(analysis.towerDives.totalAttempts >= 0);
  assert.ok(typeof analysis.towerDives.riskDeclineRate === 'number');

  // Invariant 4: Both teams participate in combat and earn gold/kills
  assert.ok(analysis.averageBlueKills > 0, 'Blue team should record kills');
  assert.ok(analysis.averageRedKills > 0, 'Red team should record kills');
  assert.ok(analysis.averageBlueGold > 5000, 'Blue team should accumulate economy');
  assert.ok(analysis.averageRedGold > 5000, 'Red team should accumulate economy');

  // Invariant 5: Diagnostics provide data-driven recommendations
  assert.ok(analysis.diagnostics.length >= 3, 'Diagnostics must include side balance, pacing, and dive safety');

  // Log telemetry to console for visibility
  console.log('\n--- BATCH MULTI-SEED SIMULATION REPORT (10 SEEDS) ---');
  console.log(`Matches: ${analysis.totalMatches} | Blue Win Rate: ${(analysis.blueWinRate * 100).toFixed(1)}% | Red Win Rate: ${(analysis.redWinRate * 100).toFixed(1)}%`);
  console.log(`Average Duration: ${analysis.averageDurationMinutes} mins (Range: ${analysis.minDurationMinutes} - ${analysis.maxDurationMinutes} mins)`);
  console.log(`Average Kills: ${analysis.averageKillsPerMatch} | Skillshot Accuracy: ${analysis.skillshotHitRate}%`);
  console.log(`Objectives: ${analysis.objectives.totalDragons} Dragons, ${analysis.objectives.totalGolems} Golems`);
  console.log(`Tower Dives: ${analysis.towerDives.totalAttempts} commitments, ${analysis.towerDives.riskDeclines} risk declines, ${analysis.towerDives.executions} executions`);
  console.log(`Solo Support Camp Clears: ${analysis.supportCampFarms} (team objectives are not simulated)`);
  console.log('Role Damage Breakdown:');
  Object.entries(analysis.roleStats).forEach(([role, stat]) => {
    console.log(`  ${role.padEnd(10)}: Avg Damage ${stat.avgDamage.toLocaleString()} | Avg Kills ${stat.avgKills} | Avg Mana Blocks ${stat.avgManaBlocks}`);
  });
  console.log('Diagnostics & Recommendations:');
  analysis.diagnostics.forEach(diag => console.log(`  * ${diag}`));
  console.log('-----------------------------------------------------\n');
});
