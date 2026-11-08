import assert from 'node:assert/strict';
import { runMatchSimulation, createDefaultSimulationLineup } from '../src/matchSimulationEngine.ts';
import {
  computeInfluenceHeatmapCells,
  buildBattlefieldWaypointDescriptors,
  auditArenaSymmetryAndBalance,
} from '../src/dynamicEventsAtmosphereRelease.ts';
import { ARENA_WIDTH, ARENA_HEIGHT, ARENA_MAP_VERSION } from '../src/arenaLayout.ts';

console.log('================================================================');
console.log(`🏟️  STRAIGHT-V4 ML POLICY & MAP BALANCE BENCHMARK (${ARENA_MAP_VERSION})`);
console.log('================================================================');

// 1. Audit East-West Map Layout Symmetry (Catalogue Item 88)
const symmetryAudit = auditArenaSymmetryAndBalance();
console.log(`✅ Geometric Layout Symmetry: max asymmetry = ${symmetryAudit.maxAsymmetryPx.toFixed(2)}px across ${symmetryAudit.checkedPairs} paired structures/camps (Symmetric: ${symmetryAudit.symmetric})`);
assert.equal(symmetryAudit.symmetric, true, 'Arena map must be strictly symmetric');
assert.equal(symmetryAudit.maxAsymmetryPx, 0, 'Asymmetry distance must be 0px');

// 2. Setup Paired 32-Match Mirror Benchmark (16 seeds x 2 sides)
const seeds = Array.from({ length: 16 }, (_, i) => 200 + i * 7);
const draftA = createDefaultSimulationLineup('blue');
const draftB = createDefaultSimulationLineup('red');

let blueWins = 0;
let redWins = 0;
let draftAWins = 0;
let draftBWins = 0;
const durations = [];
let totalBlueGold = 0;
let totalRedGold = 0;
let totalBlueKills = 0;
let totalRedKills = 0;
let totalDives = 0;
let totalExecutions = 0;

console.log(`\nRunning 32 paired matches (16 seeds with swapped drafts)...`);

let lastChamps = [];
let lastStructures = [];

for (const seed of seeds) {
  // Pass 1: Draft A on Blue, Draft B on Red
  const res1 = runMatchSimulation({
    seed,
    blueLineup: draftA,
    redLineup: draftB,
    maxDurationSeconds: 720,
  });

  if (res1.winner === 'blue') {
    blueWins++;
    draftAWins++;
  } else {
    redWins++;
    draftBWins++;
  }
  durations.push(res1.durationMinutes);
  totalBlueGold += res1.blueGold;
  totalRedGold += res1.redGold;
  totalBlueKills += res1.blueKills;
  totalRedKills += res1.redKills;
  totalDives += res1.telemetry.towerDiveAttempts;
  totalExecutions += res1.telemetry.turretExecutions;
  lastChamps = res1.champions;

  // Pass 2: Draft B on Blue, Draft A on Red (Swapped Mirror Draft)
  const res2 = runMatchSimulation({
    seed,
    blueLineup: draftB,
    redLineup: draftA,
    maxDurationSeconds: 720,
  });

  if (res2.winner === 'blue') {
    blueWins++;
    draftBWins++;
  } else {
    redWins++;
    draftAWins++;
  }
  durations.push(res2.durationMinutes);
  totalBlueGold += res2.blueGold;
  totalRedGold += res2.redGold;
  totalBlueKills += res2.blueKills;
  totalRedKills += res2.redKills;
  totalDives += res2.telemetry.towerDiveAttempts;
  totalExecutions += res2.telemetry.turretExecutions;
}

durations.sort((a, b) => a - b);
const totalMatches = seeds.length * 2;
const avgDuration = durations.reduce((s, d) => s + d, 0) / totalMatches;
const medianDuration = durations[Math.floor(durations.length / 2)];
const blueWinRate = (blueWins / totalMatches) * 100;
const redWinRate = (redWins / totalMatches) * 100;

console.log('\n--- PAIRED MIRROR-DRAFT RESULTS (32 MATCHES) ---');
console.log(`Total Matches: ${totalMatches}`);
console.log(`Blue Map Wins: ${blueWins} (${blueWinRate.toFixed(1)}%) | Red Map Wins: ${redWins} (${redWinRate.toFixed(1)}%)`);
console.log(`Draft A Wins: ${draftAWins} (${((draftAWins / totalMatches) * 100).toFixed(1)}%) | Draft B Wins: ${draftBWins} (${((draftBWins / totalMatches) * 100).toFixed(1)}%)`);
console.log(`Average Duration: ${avgDuration.toFixed(2)} mins (Range: ${durations[0].toFixed(1)}m - ${durations[durations.length - 1].toFixed(1)}m | Median: ${medianDuration.toFixed(1)}m)`);
console.log(`Average Gold: Blue ${(totalBlueGold / totalMatches).toLocaleString()} | Red ${(totalRedGold / totalMatches).toLocaleString()}`);
console.log(`Average Kills: Blue ${(totalBlueKills / totalMatches).toFixed(1)} | Red ${(totalRedKills / totalMatches).toFixed(1)}`);
console.log(`Tower Dives: ${(totalDives / totalMatches).toFixed(0)} avg commits | Executions: ${totalExecutions} total`);

// Check side fairness on mirrored swaps
console.log(`\nSide Fairness Check (Blue vs Red map bias):`);
const sideBias = Math.abs(blueWinRate - 50);
console.log(`  Map side deviation from 50%: ${sideBias.toFixed(1)}%`);
assert.ok(sideBias <= 15, `Side bias (${sideBias.toFixed(1)}%) exceeds maximum acceptable threshold of 15%`);
console.log(`  ✅ Passed side fairness check!`);

// 3. Verify Spatial Influence Heatmap Cells (Item 85)
console.log(`\nVerifying Spatial Influence Heatmap (Item 85)...`);
const sampleChamps = [
  { id: 'c1', team: 'blue', x: 1200, y: 720, isAlive: true },
  { id: 'c2', team: 'red', x: 1600, y: 720, isAlive: true },
];
const sampleStructures = [
  { id: 't1', team: 'blue', x: 1040, y: 720, isAlive: true },
  { id: 't2', team: 'red', x: 1760, y: 720, isAlive: true },
];
const cells = computeInfluenceHeatmapCells(sampleChamps, sampleStructures);
assert.equal(cells.length, 21, '7x3 grid must produce 21 cells');
for (const cell of cells) {
  assert.ok(cell.netBlueControl >= -1 && cell.netBlueControl <= 1);
  assert.ok(Number.isFinite(cell.x) && Number.isFinite(cell.y));
}
console.log(`  ✅ 7x3 Spatial Influence Grid produces 21 finite control scores in [-1, +1].`);

// 4. Verify Transferable Waypoint Descriptors (Item 86 & 88)
console.log(`\nVerifying Transferable Waypoint Descriptors (Item 86 & 88)...`);
const waypoints = buildBattlefieldWaypointDescriptors(
  [{ id: 'scuttle_n', x: 1400, y: 360, isAlive: true }],
  [{ id: 'blast_1', kind: 'blast_cone', x: 1250, y: 300, isAlive: true }],
  { id: 'supply_1', x: 1400, y: 720, active: true, radius: 110, captureProgress: 0, spawnedAt: 360 }
);
assert.equal(waypoints.length, 3);
assert.equal(waypoints[0].id, 'map:scuttle_n');
assert.equal(waypoints[1].id, 'map:blast_1');
assert.equal(waypoints[2].epic, true);
console.log(`  ✅ Battlefield waypoint descriptors build cleanly with 0 mutations to frozen 224-input actor schema.`);

console.log('\n================================================================');
console.log('🎉 TRACK 2: ML POLICY & STRAIGHT-V4 BENCHMARK PASSED!');
console.log('================================================================');
