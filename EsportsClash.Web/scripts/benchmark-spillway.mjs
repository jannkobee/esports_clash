import os from 'node:os';
import { Worker, isMainThread, parentPort, workerData } from 'node:worker_threads';
import { FpsLiveSimulation } from '../src/fps/fpsLiveSimulation.ts';
import { SPILLWAY_MAP_RUNTIME } from '../src/fps/fpsSpillwayMap.ts';
import { baselineCards, baselineIdentity } from '../src/testSupport/fpsBaselineFixtures.mjs';

function parseArgs(argv) {
  let rounds = 300;
  let seedStart = 1001;
  let workers = Math.max(1, Math.min(8, os.cpus().length - 1 || 1));
  for (const arg of argv) {
    if (arg.startsWith('--rounds=')) rounds = Math.max(1, Number(arg.slice(9)) || 300);
    else if (arg.startsWith('--seed=')) seedStart = Math.max(1, Number(arg.slice(7)) || 1001);
    else if (arg.startsWith('--workers=')) workers = Math.max(1, Number(arg.slice(10)) || 1);
  }
  return { rounds, seedStart, workers };
}

function emptyStats() {
  return {
    rounds: 0,
    matches: 0,
    ticks: 0,
    tWins: 0,
    ctWins: 0,
    plantsA: 0,
    plantsB: 0,
    detonations: 0,
    defuses: 0,
    eliminations: 0,
    timeExpired: 0,
    stuckEvents: 0,
    oobEvents: 0,
    nanEvents: 0,
    firstContactSum: 0,
    firstContactCount: 0,
    roundDurationSum: 0,
    durationCount: 0,
    upperDeckSamples: 0,
  };
}

function mergeStats(acc, s) {
  for (const key of Object.keys(acc)) acc[key] += s[key];
}

function runWorkerRange(roundQuota, startSeed) {
  const stats = emptyStats();
  const bounds = SPILLWAY_MAP_RUNTIME.definition.bounds;
  let seed = startSeed;

  while (stats.rounds < roundQuota) {
    let lastRound = 0;
    let roundLiveStartedAt = null;
    let recordedFirstContact = false;
    let roundPlantedSite = null;
    let prevAliveCount = 10;
    let matchFinished = false;
    const stillStart = new Map();
    const stillAnchor = new Map();
    const flaggedStuckThisRound = new Set();

    const cards = structuredClone(baselineCards);
    const sim = new FpsLiveSimulation(
      cards.slice(0, 5),
      cards.slice(5),
      seed,
      structuredClone(baselineIdentity),
      {
        mapId: 'spillway',
        onRoundComplete: info => {
          if (stats.rounds >= roundQuota) return;
          stats.rounds++;
          if (info.winner === info.attackTeam) stats.tWins++;
          else stats.ctWins++;

          if (roundLiveStartedAt !== null) {
            stats.roundDurationSum += Math.max(0, info.time - roundLiveStartedAt);
            stats.durationCount++;
          }

          const reason = (info.reason ?? '').toLowerCase();
          if (reason.includes('detonat') || reason.includes('explod')) stats.detonations++;
          else if (reason.includes('defus')) stats.defuses++;
          else if (reason.includes('time') || reason.includes('expir')) stats.timeExpired++;
          else stats.eliminations++;
        },
      },
    );
    seed++;
    stats.matches++;

    let localTicks = 0;
    while (stats.rounds < roundQuota && !matchFinished) {
      sim.step();
      stats.ticks++;
      localTicks++;

      // Sample snapshot at 5Hz (every 6 ticks at 30Hz) to audit positions/stalls without per-tick allocation overhead
      if (localTicks % 6 !== 0) continue;
      const f = sim.snapshot();
      if (f.phase === 'finished') {
        matchFinished = true;
        break;
      }

      if (f.round !== lastRound) {
        lastRound = f.round;
        roundLiveStartedAt = null;
        recordedFirstContact = false;
        roundPlantedSite = null;
        prevAliveCount = 10;
        stillStart.clear();
        stillAnchor.clear();
        flaggedStuckThisRound.clear();
      }

      if (f.phase === 'live') {
        if (roundLiveStartedAt === null) roundLiveStartedAt = f.time;

        if (!roundPlantedSite && f.bomb.status === 'planted') {
          roundPlantedSite = f.bomb.site ?? (f.bomb.x < 5 ? 'A' : 'B');
          if (roundPlantedSite === 'A') stats.plantsA++;
          else stats.plantsB++;
        }

        const aliveCount = f.players.reduce((n, p) => n + (p.hp > 0 ? 1 : 0), 0);
        if (!recordedFirstContact && aliveCount < prevAliveCount && roundLiveStartedAt !== null) {
          recordedFirstContact = true;
          stats.firstContactSum += Math.max(0, f.time - roundLiveStartedAt);
          stats.firstContactCount++;
        }
        prevAliveCount = aliveCount;

        for (const p of f.players) {
          if (!Number.isFinite(p.x) || !Number.isFinite(p.z) || !Number.isFinite(p.yaw)) {
            stats.nanEvents++;
            continue;
          }
          if (p.x < bounds.clampMinX - 0.5 || p.x > bounds.clampMaxX + 0.5 || p.z < bounds.clampMinZ - 0.5 || p.z > bounds.clampMaxZ + 0.5) {
            stats.oobEvents++;
          }
          if (p.hp <= 0) continue;
          if (p.level === 'upper') stats.upperDeckSamples++;

          const tryingToMove = /Moving|Advancing|Rotating|Retaking|Pushing|Flanking|Clearing|Entering/i.test(p.action ?? '');
          if (tryingToMove && p.channel <= 0) {
            const prev = stillAnchor.get(p.id);
            const displaced = prev ? Math.hypot(p.x - prev.x, p.z - prev.z) : 99;
            if (!prev || displaced > 0.35) {
              stillAnchor.set(p.id, { x: p.x, z: p.z });
              stillStart.set(p.id, f.time);
            } else if (f.time - (stillStart.get(p.id) ?? f.time) >= 6.0 && !flaggedStuckThisRound.has(p.id)) {
              stats.stuckEvents++;
              flaggedStuckThisRound.add(p.id);
            }
          } else {
            stillAnchor.delete(p.id);
            stillStart.delete(p.id);
          }
        }
      }
    }
  }
  return stats;
}

if (isMainThread) {
  const { rounds, seedStart, workers } = parseArgs(process.argv.slice(2));
  const startedAt = performance.now();
  const baseQuota = Math.floor(rounds / workers);
  const remainder = rounds % workers;

  console.log(`Running ${rounds.toLocaleString()} headless Spillway rounds across ${workers} worker thread(s)...`);

  const jobs = Array.from({ length: workers }, (_, wi) => new Promise((resolve, reject) => {
    const quota = baseQuota + (wi < remainder ? 1 : 0);
    const workerSeed = seedStart + wi * 10000;
    const worker = new Worker(new URL(import.meta.url), {
      workerData: { quota, workerSeed },
      execArgv: ['--experimental-strip-types'],
    });
    worker.on('message', resolve);
    worker.on('error', reject);
    worker.on('exit', code => {
      if (code !== 0) reject(new Error(`Benchmark worker ${wi} exited with code ${code}`));
    });
  }));

  Promise.all(jobs).then(results => {
    const total = emptyStats();
    for (const r of results) mergeStats(total, r);
    const elapsedSec = (performance.now() - startedAt) / 1000;
    const totalPlants = total.plantsA + total.plantsB || 1;
    const tRate = (total.tWins / Math.max(1, total.rounds)) * 100;
    const ctRate = (total.ctWins / Math.max(1, total.rounds)) * 100;
    const aShare = (total.plantsA / totalPlants) * 100;
    const bShare = (total.plantsB / totalPlants) * 100;

    console.log('\n=== SPILLWAY HEADLESS BENCHMARK REPORT ===');
    console.log(`Rounds completed:     ${total.rounds} (across ${total.matches} matches)`);
    console.log(`Total sim ticks:      ${total.ticks.toLocaleString()} (${(total.ticks / elapsedSec).toFixed(0)} ticks/s)`);
    console.log(`Wall time:            ${elapsedSec.toFixed(2)} s (${(total.rounds / elapsedSec).toFixed(1)} rounds/s)`);
    console.log(`CT win rate:          ${ctRate.toFixed(2)}% (${total.ctWins})`);
    console.log(`T win rate:           ${tRate.toFixed(2)}% (${total.tWins})`);
    console.log(`Bomb plants:          ${total.plantsA + total.plantsB} (${((total.plantsA + total.plantsB) / total.rounds * 100).toFixed(1)}% of rounds)`);
    console.log(`  Site A (HQ) share:  ${aShare.toFixed(2)}% (${total.plantsA})`);
    console.log(`  Site B (Pump) share:${bShare.toFixed(2)}% (${total.plantsB})`);
    console.log(`Outcomes:             Elim ${total.eliminations} | Detonated ${total.detonations} | Defused ${total.defuses} | Time ${total.timeExpired}`);
    console.log(`Avg 1st kill time:    ${(total.firstContactSum / Math.max(1, total.firstContactCount)).toFixed(2)} s`);
    console.log(`Avg round duration:   ${(total.roundDurationSum / Math.max(1, total.durationCount)).toFixed(2)} s`);
    console.log(`Control Deck upper:   ${total.upperDeckSamples.toLocaleString()} samples recorded on overlapping upper deck`);
    console.log(`Integrity checks:     NaN=${total.nanEvents} | OOB=${total.oobEvents} | LocomotionStalls=${total.stuckEvents} (${(total.stuckEvents / Math.max(1, total.rounds) * 100).toFixed(3)}%)`);
  });
} else {
  const { quota, workerSeed } = workerData;
  const stats = runWorkerRange(quota, workerSeed);
  parentPort.postMessage(stats);
}
