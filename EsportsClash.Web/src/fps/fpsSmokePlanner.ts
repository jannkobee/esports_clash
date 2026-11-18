import type {FpsPoint} from './fpsSpatialWorld.ts';
import type {LiveMapRuntime} from './fpsLiveMapTypes.ts';
import type {LiveSmokeLineup} from './fpsSmokeLineupDefinitions.ts';
import {LIVE_UTILITY_RULES} from './fpsLiveGrenades.ts';

/**
 * Smokes the players work out for themselves.
 *
 * Nothing here is a stored lineup. A smoke is worth throwing when it cuts sightlines the team will have
 * to cross: lines from where the other side watches (or will come from) to where this team must be
 * exposed. For a given side, area and purpose the planner lists those lines from the map's tactical
 * knowledge plus anything the team has lawfully seen this round, samples points along them, scores each
 * point by how many dangerous lines one smoke there would block, and picks a set greedily so smokes do
 * not overlap. It then picks a staging spot on the team's own side that the watchers cannot see, close
 * enough to throw from. The thrower still calculates the actual arc (and moves for a cleaner lane)
 * when they get there, and the utility brain remembers what worked from each spot.
 */

export type LiveSmokePurpose = 'opening' | 'execute' | 'control';
export interface LiveSmokeDangerPoint extends FpsPoint {weight?: number}
export interface LiveSmokePlanRequest {
  attacking: boolean;
  purpose: LiveSmokePurpose;
  area: 'A' | 'B' | 'Mid';
  /** Where opponents watch from or will arrive from. */
  watchers: readonly LiveSmokeDangerPoint[];
  /** Where this team has to be seen (entries, plant spots, crossings). */
  exposures: readonly LiveSmokeDangerPoint[];
  /** The team's own side of the map, used to keep staging spots behind the smoke. */
  home: FpsPoint;
  count: number;
}
export interface LiveSmokeCandidate {target: FpsPoint; score: number; blocks: number[]}

const EYE = 1.6;
const dist = (a: FpsPoint, b: FpsPoint) => Math.hypot(a.x - b.x, a.z - b.z);
function segmentDistance(a: FpsPoint, b: FpsPoint, p: FpsPoint): number {
  const dx = b.x - a.x, dz = b.z - a.z, len = dx * dx + dz * dz || 1;
  const t = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.z - a.z) * dz) / len));
  return Math.hypot(p.x - (a.x + dx * t), p.z - (a.z + dz * t));
}

interface DangerLine {from: FpsPoint; to: FpsPoint; weight: number}

/** Every watcher→exposure pair with a real sightline is a line this team would have to cross under fire. */
export function liveSmokeDangerLines(runtime: LiveMapRuntime, watchers: readonly LiveSmokeDangerPoint[], exposures: readonly LiveSmokeDangerPoint[]): DangerLine[] {
  const lines: DangerLine[] = [];
  for (const w of watchers) for (const e of exposures) {
    const d = dist(w, e);
    if (d < 5 || d > 50) continue;
    if (!runtime.sightline(w, e, runtime.terrain.groundHeight(w) + EYE, runtime.terrain.groundHeight(e) + EYE)) continue;
    lines.push({from: w, to: e, weight: (w.weight ?? 1) * (e.weight ?? 1)});
  }
  return lines;
}

function floorPoint(runtime: LiveMapRuntime, p: FpsPoint, level: FpsPoint['level']): FpsPoint | undefined {
  for (const candidate of [{x: p.x, z: p.z, level}, {x: p.x, z: p.z}] as FpsPoint[]) {
    if (runtime.walkable(candidate)) return candidate;
  }
  const safe = runtime.safePoint({x: p.x, z: p.z, level});
  return dist(safe, p) < 1.2 ? safe : undefined;
}

/** Score smoke positions by the danger lines they would block, without blinding the team's own path. */
export function scoreLiveSmokeCandidates(runtime: LiveMapRuntime, lines: readonly DangerLine[], exposures: readonly FpsPoint[]): LiveSmokeCandidate[] {
  const radius = LIVE_UTILITY_RULES.smokeRadius, block = radius * .72;
  const raw: FpsPoint[] = [];
  for (const line of lines) {
    for (const t of [.3, .45, .6, .75, .9]) {
      const p = {x: line.to.x + (line.from.x - line.to.x) * t, z: line.to.z + (line.from.z - line.to.z) * t};
      const nearer = t > .5 ? line.from : line.to;
      const floor = floorPoint(runtime, p, nearer.level);
      if (floor) raw.push(floor);
    }
  }
  const candidates: LiveSmokeCandidate[] = [];
  for (const p of raw) {
    if (candidates.some(c => dist(c.target, p) < 1.4 && c.target.level === p.level)) continue;
    // A smoke on top of where the team must walk blinds them rather than the opponents.
    const ownPath = Math.min(...exposures.map(e => dist(e, p)));
    if (ownPath < 4) continue;
    const blocks: number[] = [];let score = 0;
    lines.forEach((line, i) => {
      if (segmentDistance(line.from, line.to, p) > block) return;
      // The cloud only blocks a line if it sits between the two ends, not behind a watcher.
      if (dist(p, line.from) < 1.5) return;
      blocks.push(i);score += line.weight;
    });
    if (score <= 0) continue;
    candidates.push({target: p, score: score - (ownPath < radius + 1 ? .35 : 0), blocks});
  }
  return candidates.sort((a, b) => b.score - a.score || a.target.x - b.target.x || a.target.z - b.target.z);
}

/** Pick non-overlapping smokes greedily; `random` chooses among near-equal options so rounds vary. */
export function chooseLiveSmokeSet(candidates: readonly LiveSmokeCandidate[], lines: readonly DangerLine[], count: number, random?: () => number): LiveSmokeCandidate[] {
  const covered = new Set<number>(), chosen: LiveSmokeCandidate[] = [];
  for (let n = 0; n < count; n++) {
    const scored = candidates
      .filter(c => !chosen.some(o => dist(o.target, c.target) < LIVE_UTILITY_RULES.smokeRadius * 1.5))
      .map(c => ({c, value: c.blocks.reduce((s, i) => s + (covered.has(i) ? 0 : lines[i].weight), 0)}))
      .filter(e => e.value > 0)
      .sort((a, b) => b.value - a.value);
    if (!scored.length) break;
    const best = scored[0].value;
    const close = scored.filter(e => e.value >= best * .82).slice(0, 4);
    const pick = random && close.length > 1 ? close[Math.min(close.length - 1, Math.floor(random() * close.length))] : close[0];
    chosen.push(pick.c);
    for (const i of pick.c.blocks) covered.add(i);
  }
  return chosen;
}

/**
 * A staging spot for a throw: on the team's side of the smoke, out of the watchers' sight, at a range a
 * player throws from (8–24 m). The thrower refines the exact spot on arrival.
 */
export function liveSmokeStagingSpot(runtime: LiveMapRuntime, target: FpsPoint, watchers: readonly FpsPoint[], home: FpsPoint): FpsPoint | undefined {
  const homeToTarget = dist(home, target);
  let best: {p: FpsPoint; score: number} | undefined;
  for (const node of runtime.navNodes) {
    const d = dist(node, target);
    if (d < 7 || d > 24) continue;
    if (dist(home, node) > homeToTarget - 2) continue;
    const eye = runtime.terrain.groundHeight(node) + EYE;
    const seen = watchers.filter(w => dist(w, node) < 45 && runtime.sightline(w, node, runtime.terrain.groundHeight(w) + EYE, eye)).length;
    // Prefer hidden spots at a comfortable range, a short way out from the team's side.
    const score = seen * 6 + Math.abs(d - 14) * .25 + dist(home, node) * .02;
    if (!best || score < best.score) best = {p: {x: node.x, z: node.z, ...(node.level ? {level: node.level} : {})}, score};
  }
  return best?.p;
}

const keyFor = (attacking: boolean, purpose: LiveSmokePurpose, area: string, p: FpsPoint) =>
  `calc:${attacking ? 't' : 'ct'}:${purpose}:${area}:${Math.round(p.x)},${Math.round(p.z)}${p.level ? `:${p.level}` : ''}`;

const staticCache = new WeakMap<LiveMapRuntime, Map<string, {lines: DangerLine[]; candidates: LiveSmokeCandidate[]; staging: Map<string, FpsPoint | null>}>>();

/** Work out the smokes for one purpose. Static map knowledge is cached; lawful round evidence is added per call. */
export function planLiveSmokes(runtime: LiveMapRuntime, request: LiveSmokePlanRequest, random?: () => number): LiveSmokeLineup[] {
  const cacheKey = JSON.stringify([request.attacking, request.purpose, request.area, request.watchers.map(w => [Math.round(w.x * 2), Math.round(w.z * 2), w.level ?? '', w.weight ?? 1]),
    request.exposures.map(e => [Math.round(e.x * 2), Math.round(e.z * 2), e.level ?? '', e.weight ?? 1])]);
  let mapCache = staticCache.get(runtime);
  if (!mapCache) {mapCache = new Map();staticCache.set(runtime, mapCache);}
  let entry = mapCache.get(cacheKey);
  if (!entry) {
    const lines = liveSmokeDangerLines(runtime, request.watchers, request.exposures);
    entry = {lines, candidates: scoreLiveSmokeCandidates(runtime, lines, request.exposures), staging: new Map()};
    if (mapCache.size > 256) mapCache.clear();
    mapCache.set(cacheKey, entry);
  }
  const chosen = chooseLiveSmokeSet(entry.candidates, entry.lines, request.count, random);
  const out: LiveSmokeLineup[] = [];
  for (const c of chosen) {
    // Staging depends only on static geometry for this request, so it is worked out once per target.
    const targetKey = `${c.target.x},${c.target.z},${c.target.level ?? ""}`;
    let position = entry.staging.get(targetKey);
    if (position === undefined) {position = liveSmokeStagingSpot(runtime, c.target, request.watchers, request.home) ?? null;entry.staging.set(targetKey, position);}
    if (!position) continue;
    const id = keyFor(request.attacking, request.purpose, request.area, c.target);
    out.push({id, name: `${runtime.callout(position)} to ${runtime.callout(c.target)}`, phase: request.purpose, attacking: request.attacking, site: request.area,
      position, target: {...c.target}, mapId: runtime.id});
  }
  return out;
}

/**
 * The danger picture each side reasons about, from the map's tactical knowledge (where the other side
 * holds, rotates and enters). `evidence` adds lawful sightings/reports from this round.
 */
export function liveSmokeRequest(runtime: LiveMapRuntime, attacking: boolean, purpose: LiveSmokePurpose, area: 'A' | 'B' | 'Mid',
  evidence: readonly LiveSmokeDangerPoint[] = []): LiveSmokePlanRequest {
  const t = runtime.definition.tactical, spawns = runtime.definition.spawns, home = attacking ? spawns.attackers : spawns.defenders;
  const w = (points: readonly FpsPoint[], weight: number) => points.map(p => ({...p, weight}));
  let watchers: LiveSmokeDangerPoint[] = [], exposures: LiveSmokeDangerPoint[] = [], count = 1;
  if (area === 'Mid') {
    const window = t.mid.window;
    watchers = attacking ? [...w([window.hold], 1.4), ...w([window.watch, t.mid.control], 1)] : [...w([t.mid.approach], 1.3), ...w([t.mid.underpass.west, t.mid.underpass.east], 1)];
    exposures = attacking ? [...w([t.mid.approach, t.mid.control], 1), ...w([t.mid.splits.A, t.mid.splits.B], .8)] : [...w([t.mid.control, window.hold], 1)];
  } else {
    const site = t[area];
    if (attacking && purpose === 'execute') {
      watchers = [...w(site.holds, 1), ...w(runtime.definition.tactical.anchorPoints[area], 1), ...w(site.retakeEntrances, 1.2)];
      exposures = [...w(site.entries, 1.2), ...w(site.postPlant.slice(0, 2), .8)];
      count = 3;
    } else if (attacking) {
      watchers = [...w(site.entries, 1.1), ...w(site.holds.slice(0, 2), .8)];
      exposures = w(site.staging, 1);
    } else {
      watchers = [...w(site.staging, 1.2), ...w(site.rally, .8)];
      exposures = [...w(site.entries, 1), ...w(site.holds.slice(0, 3), .9)];
    }
  }
  return {attacking, purpose, area, watchers: [...watchers, ...evidence], exposures, home, count};
}
