import { writeFile } from 'node:fs/promises';
import { performance } from 'node:perf_hooks';
import { createDefaultSimulationLineup, createSimulationState, stepSimulation } from '../src/matchSimulationEngine.ts';
import { SIMULATION_STEP } from '../src/matchReplay.ts';

// Observational runner: no forced time-limit winner, no policy mutation, no RNG draws.
const results = [];
for (const seed of [101, 102, 103, 104, 105]) for (const swapped of [false, true]) {
  const blue = createDefaultSimulationLineup('blue'), red = createDefaultSimulationLineup('red');
  const sim = createSimulationState({ seed, blueLineup: swapped ? red : blue, redLineup: swapped ? blue : red });
  let ticks = 0, switches = 0, recallInterruptions = 0, towerDeaths = 0;
  const previous = new Map();
  const started = performance.now();
  while (!sim.matchFinished && sim.matchTime < 1200) {
    stepSimulation(sim, SIMULATION_STEP); ticks++;
    for (const actor of sim.champions) {
      const before = previous.get(actor.id);
      const action = actor.actionIntent?.key ?? actor.committedState ?? actor.animState;
      if (before && before.action !== action) switches++;
      if (before?.recalling && !actor.isRecalling && actor.isAlive && actor.hp < actor.maxHp
        && Math.hypot(before.x - actor.x, before.y - actor.y) < 400) recallInterruptions++;
      if (before?.alive && !actor.isAlive && sim.structures.some(t => t.team !== actor.team && t.isAlive
        && Math.hypot(t.x - actor.x, t.y - actor.y) <= t.range)) towerDeaths++;
      previous.set(actor.id, { action, recalling: actor.isRecalling, alive: actor.isAlive, x: actor.x, y: actor.y });
    }
  }
  const wallMs = performance.now() - started;
  results.push({ seed, swapped, completed: sim.matchFinished, winner: sim.winner, seconds: sim.matchTime,
    ticks, wallMs, msPerTickIncludingObservation: wallMs / ticks,
    deaths: sim.champions.reduce((sum, actor) => sum + actor.deaths, 0),
    actionOrAnimationSwitches: switches, recallInterruptionHeuristic: recallInterruptions,
    deathsInsideEnemyStructureRange: towerDeaths, telemetry: sim.telemetry,
    damage: sim.champions.map(a => ({ player: a.player.id, champion: a.champion.name, team: a.team, damage: a.damageDealt })) });
}
const output = { version: 1, engine: 'simplified-headless', maxSeconds: 1200, results,
  limitations: ['Animation switches include farming and attacks; not equivalent to decision switches.',
    'Deaths in structure range are not proof of turret lethal attribution.',
    'Recall interruptions are a position/health heuristic, not event-attributed.',
    'No live parity: headless omits full ability/projectile/Conflux/psychology execution.',
    'Teamfight durations, objective contests/conversion, Nexus opportunities, cancellations, path failures and unnecessary farming are not instrumented; no fabricated zeros.'] };
await writeFile(new URL('../../docs/ai-baseline.json', import.meta.url), JSON.stringify(output, null, 2) + '\n');
console.log(JSON.stringify({ matches: results.length, completed: results.filter(r => r.completed).length,
  blueWins: results.filter(r => r.winner === 'blue').length, redWins: results.filter(r => r.winner === 'red').length,
  averageSeconds: results.reduce((s, r) => s + r.seconds, 0) / results.length,
  averageMsPerTick: results.reduce((s, r) => s + r.msPerTickIncludingObservation, 0) / results.length }));
