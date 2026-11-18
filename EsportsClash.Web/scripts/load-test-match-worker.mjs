// Load test for official live 3D matches through the real match worker (one process per match, as on the server).
// Usage: node scripts/load-test-match-worker.mjs --matches=24 --concurrency=12 [--bundle=../tmp/fps-engine.mjs] [--out=../tmp/load-test]
// Reports wall time, CPU seconds and peak memory per match, replay size, and the cores needed for 1,000 matches.
import { spawn } from 'node:child_process';
import { readFileSync, writeFileSync, mkdirSync, rmSync, readdirSync, statSync } from 'node:fs';
import { resolve } from 'node:path';
import { createHash } from 'node:crypto';
import { cpus } from 'node:os';
import { FPS_T_POSITIONS, FPS_CT_POSITIONS, generateFpsPersonality } from '../src/fps/fpsPlayerArchitecture.ts';
import { generatePlayerDNA } from '../src/fps/fpsIdentity.ts';

const arg = (k, f) => process.argv.find(v => v.startsWith(`--${k}=`))?.split('=')[1] ?? f;
const matches = Number(arg('matches', '12')), concurrency = Number(arg('concurrency', String(cpus().length)));
const bundle = arg('bundle', ''), out = resolve(arg('out', '../tmp/load-test'));
const worker = resolve('../infrastructure/online/fps-match-worker.mjs');
const catalogPath = resolve('../EsportsClash.Api/resources/game/catalog.json');
const catalog = JSON.parse(readFileSync(catalogPath, 'utf8'));
rmSync(out, { recursive: true, force: true }); mkdirSync(out, { recursive: true });
const team = { coach: { tempo: .5, rigidity: .5, aggression: .5, preparation: .5, freedom: .5, economy: .5, communication: .5, leadership: .5, adaptability: .5, development: .5 },
  plan: { tempo: .5, structure: .5, aggression: .5, preparation: .5, freedom: .5, economy: .5 }, chemistry: { trust: .5, communication: .5, understanding: .5, leadershipAcceptance: .5, roleCompetition: .5 } };
const hex = (n, len) => n.toString(16).padStart(len, '0');
const folders = [];
for (let m = 0; m < matches; m++) {
  const seed = 1000 + m * 7919, id = `${hex(m, 8)}-0000-4000-8000-${hex(seed, 12)}`;
  const cards = Array.from({ length: 10 }, (_, i) => catalog.cards[(m * 3 + i) % catalog.cards.length]);
  const slot = (c, i) => ({ card_id: c.id, instance_id: `${hex(m, 8)}-1111-4000-8000-${hex(i, 12)}` });
  const blue = cards.slice(0, 5).map((c, i) => slot(c, i)), red = cards.slice(5).map((c, i) => slot(c, i + 5));
  const players = {}, profiles = {};
  [...blue, ...red].forEach((s, i) => {
    players[s.instance_id] = { id: s.instance_id, personality: generateFpsPersonality(s.instance_id), assignments: { t: FPS_T_POSITIONS[i % 5], ct: FPS_CT_POSITIONS[i % 5] }, dna: generatePlayerDNA(s.instance_id), roleSuitability: .5, familiarity: .3 };
    const base = 45 + (seed * (i + 3)) % 40;
    profiles[s.instance_id] = { name: `Alias${m}-${i}`, tier: 'Gold', ovr: base, stats: { rifling: base, sniping: base - 5, entry: base + 3, utility: base - 2, positioning: base + 1, shotcalling: base - 4 }, nationality: { code: 'NL' } };
  });
  const plan = { schema: 1, match_id: id, mode: 'normal', seed, game_mode: 'fps_mr15_v1', fps: { format: 'MR15_TACTICAL_FPS', rules_version: 1, simulation_version: 5, map_id: ['fontessa', 'spillway'][seed % 2] },
    versions: {}, blue, red, player_profile_schema: 1, player_profiles: profiles, fps_identity: { players, teams: { blue: team, red: team } } };
  const folder = resolve(out, id); mkdirSync(folder);
  writeFileSync(resolve(folder, 'allocation.json'), JSON.stringify({ plan, plan_hash: createHash('sha256').update(JSON.stringify(plan)).digest('hex') }));
  folders.push(folder);
}
const results = [];
const started = Date.now();
let next = 0;
const run = () => new Promise(done => {
  const folder = folders[next++];
  if (!folder) return done();
  const child = spawn(process.execPath, [...(bundle ? [] : ['--experimental-strip-types']), worker, folder],
    { cwd: process.cwd(), env: { ...process.env, ONLINE_CATALOG_PATH: catalogPath, FPS_ENGINE_BUNDLE: bundle ? resolve(bundle) : '/nonexistent' } });
  let output = '';
  child.stdout.on('data', d => { output += d; }); child.stderr.on('data', d => { output += d; });
  child.on('close', code => {
    const line = output.split('\n').find(l => l.startsWith('{"completed"'));
    const replay = resolve(folder, 'replay');
    let replayBytes = 0; try { for (const f of readdirSync(replay)) replayBytes += statSync(resolve(replay, f)).size; } catch { /* failed run */ }
    const state = JSON.parse(readFileSync(resolve(folder, 'state.json'), 'utf8'));
    results.push({ ok: code === 0 && !!line, ...(line ? JSON.parse(line) : { error: output.slice(-300) }), replayMB: replayBytes / 1e6,
      broadcastMin: (state.result?.report?.broadcastSeconds ?? 0) / 60 });
    run().then(done);
  });
});
await Promise.all(Array.from({ length: Math.min(concurrency, matches) }, run));
const wall = (Date.now() - started) / 1000, ok = results.filter(r => r.ok);
const avg = k => ok.reduce((s, r) => s + r[k], 0) / Math.max(1, ok.length);
const cpuPerMatch = avg('cpu_seconds');
console.log(JSON.stringify({
  matches, concurrency, completed: ok.length, failed: results.length - ok.length, wallSeconds: Math.round(wall),
  matchesPerHour: Math.round(ok.length / wall * 3600),
  cpuSecondsPerMatch: Math.round(cpuPerMatch), maxCpuSeconds: Math.round(Math.max(...ok.map(r => r.cpu_seconds))),
  peakRssMB: Math.max(...ok.map(r => r.max_rss_mb)), avgReplayMB: +avg('replayMB').toFixed(2), avgBroadcastMinutes: +avg('broadcastMin').toFixed(1),
  // Capacity for 1,000 simultaneous kickoffs at this per-match CPU cost (ideal scaling, no contention headroom).
  coresFor1000In90Minutes: Math.ceil(1000 * cpuPerMatch / (90 * 60)), coresFor1000RealTime: Math.ceil(1000 * cpuPerMatch / (avg('broadcastMin') * 60)),
  replayGBFor1000: +(1000 * avg('replayMB') / 1000).toFixed(1),
  ...(results.length - ok.length ? { errors: results.filter(r => !r.ok).map(r => r.error).slice(0, 3) } : {}),
}, null, 1));
