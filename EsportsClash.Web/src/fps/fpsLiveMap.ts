import { hasFpsLineOfSight, segmentHitsWall, type FpsPoint, type FpsTerrainLevel, type FpsWall, type LiveSurfaceAcoustic } from './fpsSpatialWorld.ts';
import {
  FONTESSA_TERRAIN_RUNTIME,
  LIVE_B_APARTMENTS,
  LIVE_BRIDGE,
  LIVE_BRIDGE_VAULTS,
  LIVE_CANAL_CROSSINGS,
  LIVE_MID_WINDOW,
  LIVE_RIVER,
  LIVE_TERRAIN_SOLIDS,
  createLiveTerrainRuntime,
  type LiveTerrainRuntime,
} from './fpsLiveTerrain.ts';
import { VILLAGE_MARKET_STALLS } from './fpsVillageMarketLayout.ts';
import { liveVillageAsset } from './fpsVillageDesign.ts';
import { LIVE_AUTHORED_SMOKE_LINEUPS, type LiveSmokeLineup } from './fpsSmokeLineupDefinitions.ts';
import { LIVE_WINDOW_FURNITURE } from './fpsMidWindowInterior.ts';
import { createLiveGeometryIndex } from './fpsStaticGeometry.ts';
import { FONTESSA_SKY_ATMOSPHERE } from './fpsLiveGraphics.ts';
import type {
  LiveElevationDrop,
  LiveJumpablePerch,
  LiveMapDefinition,
  LiveMapRuntime,
  LiveRadialShape,
  LiveSolid,
  LiveWallIntersection,
  LiveWorldPoint,
} from './fpsLiveMapTypes.ts';

export type {
  LiveSolid,
  LiveWorldPoint,
  LiveWallIntersection,
  LiveElevationDrop,
  LiveJumpablePerch,
  LiveMapDefinition,
  LiveMapRuntime,
} from './fpsLiveMapTypes.ts';

export const LIVE_ACTOR_RADIUS = .35;
export const distance = (a: FpsPoint, b: FpsPoint) => Math.hypot(a.x - b.x, a.z - b.z);
export const LIVE_MAX_CROUCH_JUMP_STEP = .88;

const fontessaSolid = (
  id: string, x: number, z: number, width: number, depth: number, height: number, _color: string, bulletPenetration = 0,
): LiveSolid => ({
  id, minX: x - width / 2, maxX: x + width / 2, minZ: z - depth / 2, maxZ: z + depth / 2,
  height, color: liveVillageAsset(id).color, bulletPenetration,
});

function radialShapeHit(from: LiveWorldPoint, to: LiveWorldPoint, shape: LiveRadialShape): number | undefined {
  const dx = to.x - from.x, dy = to.y - from.y, dz = to.z - from.z;
  const cuts = [0, 1];
  if (Math.abs(dy) > 1e-10) for (const y of [shape.minY, shape.maxY]) {
    const t = (y - from.y) / dy;
    if (t > 0 && t < 1) cuts.push(t);
  }
  const a = dx * dx + dz * dz, b = 2 * ((from.x - shape.x) * dx + (from.z - shape.z) * dz);
  const addCircleRoots = (radius: number) => {
    const c = (from.x - shape.x) ** 2 + (from.z - shape.z) ** 2 - radius * radius;
    if (a < 1e-12) return;
    const discriminant = b * b - 4 * a * c;
    if (discriminant < 0) return;
    const root = Math.sqrt(discriminant);
    for (const t of [(-b - root) / (2 * a), (-b + root) / (2 * a)]) if (t > 0 && t < 1) cuts.push(t);
  };
  addCircleRoots(shape.radius);
  if (shape.innerRadius) addCircleRoots(shape.innerRadius);
  cuts.sort((left, right) => left - right);
  for (let i = 0; i < cuts.length - 1; i++) {
    const start = cuts[i], end = cuts[i + 1], mid = (start + end) / 2;
    const x = from.x + dx * mid - shape.x, z = from.z + dz * mid - shape.z, y = from.y + dy * mid;
    const r2 = x * x + z * z;
    if (y < shape.minY || y > shape.maxY || r2 > shape.radius * shape.radius
      || (shape.innerRadius !== undefined && r2 < shape.innerRadius * shape.innerRadius)) continue;
    return start;
  }
  return undefined;
}

function boxSegmentHit(from: LiveWorldPoint, to: LiveWorldPoint, wall: LiveSolid): number | undefined {
  let enter = 0, exit = 1;
  for (let axis = 0; axis < 3; axis++) {
    const origin = axis === 0 ? from.x : axis === 1 ? from.z : from.y;
    const delta = axis === 0 ? to.x - from.x : axis === 1 ? to.z - from.z : to.y - from.y;
    const min = axis === 0 ? wall.minX : axis === 1 ? wall.minZ : wall.baseY ?? 0;
    const max = axis === 0 ? wall.maxX : axis === 1 ? wall.maxZ : wall.height;
    if (Math.abs(delta) < 1e-10) { if (origin < min || origin > max) return undefined; continue; }
    const a = (min - origin) / delta, b = (max - origin) / delta;
    enter = Math.max(enter, Math.min(a, b)); exit = Math.min(exit, Math.max(a, b));
    if (enter > exit) return undefined;
  }
  return enter <= exit ? enter : undefined;
}

function rememberBounded<T>(cache: Map<string, T>, key: string, value: T, limit: number): T {
  if (cache.size >= limit) cache.delete(cache.keys().next().value!);
  cache.set(key, value); return value;
}

export function createLiveMapRuntime(definition: LiveMapDefinition, existingTerrain?: LiveTerrainRuntime): LiveMapRuntime {
  const terrain = existingTerrain ?? createLiveTerrainRuntime(definition.terrainSpec);
  const walls = definition.solids;
  const movementSolids = definition.movementSolids ?? definition.solids;
  const collisionSolids = definition.collisionSolids ?? [...definition.solids, ...terrain.terrainSolids];
  const movementSolidsAt = createLiveGeometryIndex(movementSolids);
  const collisionSolidsAt = createLiveGeometryIndex(collisionSolids);
  const wallLookup = new Map<string, LiveSolid>(collisionSolids.map(w => [w.id, w]));
  const bounds = definition.bounds;

  const actorSolids = (point: FpsPoint, feetY = terrain.groundHeight(point), height = 1.72, crouchJump = false): LiveSolid[] => {
    const floor = terrain.groundHeight(point);
    const climbFloor = crouchJump
      ? Math.max(feetY, floor + Math.min(LIVE_MAX_CROUCH_JUMP_STEP, feetY - floor + .26))
      : feetY;
    return movementSolids.filter(w => {
      if (w.height <= feetY + .01 || (w.baseY ?? 0) >= feetY + height) return false;
      if (crouchJump && w.height <= climbFloor + .01 && w.height - floor <= LIVE_MAX_CROUCH_JUMP_STEP && !w.id.includes('bridge')) return false;
      return true;
    });
  };

  const supportHeight = (point: FpsPoint, feetY: number, crouchJump = false): number => {
    let floor = terrain.groundHeight(point);
    const reach = crouchJump ? feetY + .24 : feetY;
    for (const wall of movementSolids) {
      if (wall.height <= floor) continue;
      if (crouchJump && wall.height > floor + LIVE_MAX_CROUCH_JUMP_STEP) continue;
      if (wall.height <= reach + .015 && segmentHitsWall(point, point, wall, LIVE_ACTOR_RADIUS - .001)) floor = wall.height;
    }
    return floor;
  };

  const bodyPathClear = (a: FpsPoint, b: FpsPoint, radius: number): boolean => {
    const floorA = terrain.groundHeight(a), floorB = terrain.groundHeight(b);
    const low = Math.min(floorA, floorB), high = Math.max(floorA, floorB) + 1.72;
    return !movementSolidsAt(a, b, radius).some(w => {
      if (w.height <= low + .01 || (w.baseY ?? 0) >= high || !segmentHitsWall(a, b, w, radius)) return false;
      if ((w.baseY ?? 0) === 0 && w.height > Math.max(floorA, floorB) + .01) return true;
      let enter = 0, exit = 1;
      for (let axis = 0; axis < 2; axis++) {
        const origin = axis === 0 ? a.x : a.z, delta = axis === 0 ? b.x - a.x : b.z - a.z;
        if (Math.abs(delta) < 1e-10) continue;
        const u = ((axis === 0 ? w.minX : w.minZ) - radius - origin) / delta;
        const v = ((axis === 0 ? w.maxX : w.maxZ) + radius - origin) / delta;
        enter = Math.max(enter, Math.min(u, v)); exit = Math.min(exit, Math.max(u, v));
      }
      for (const t of [enter, (enter + exit) / 2, exit]) {
        const feet = terrain.groundHeight({ x: a.x + (b.x - a.x) * t, z: a.z + (b.z - a.z) * t, level: a.level });
        if (w.height > feet + .01 && (w.baseY ?? 0) < feet + 1.72) return true;
      }
      return false;
    });
  };

  const clear = (a: FpsPoint, b: FpsPoint) => terrain.terrainPathClear(a, b) && bodyPathClear(a, b, LIVE_ACTOR_RADIUS + .08);
  const movementSegmentClear = (a: FpsPoint, b: FpsPoint) => terrain.terrainPathClear(a, b) && bodyPathClear(a, b, LIVE_ACTOR_RADIUS - .00001);
  const walkable = (point: FpsPoint) =>
    point.x >= bounds.clampMinX && point.x <= bounds.clampMaxX
    && point.z >= bounds.clampMinZ && point.z <= bounds.clampMaxZ
    && clear(point, point);

  const nodes: FpsPoint[] = [];
  const grid = new Map<string, number>();
  const gridKey = (p: FpsPoint) => `${p.x},${p.z},${p.level ?? 'street'}`;

  for (const level of definition.nav.levels) {
    const step = level === 'street' ? definition.nav.defaultStep : definition.nav.fineLevelStep;
    for (let z = bounds.navMinZ; z <= bounds.navMaxZ; z += step) {
      for (let x = bounds.navMinX; x <= bounds.navMaxX; x += step) {
        const point: FpsPoint = level === 'street' ? { x, z } : { x, z, level };
        if (clear(point, point)) {
          grid.set(gridKey(point), nodes.length);
          nodes.push(point);
        }
      }
    }
  }
  const fractionalFineNodes: FpsPoint[] = [];
  for (const raw of definition.nav.fineNodes) {
    const point: FpsPoint = raw.level === 'street' ? { x: raw.x, z: raw.z } : { ...raw };
    if (clear(point, point) && !grid.has(gridKey(point))) {
      grid.set(gridKey(point), nodes.length);
      nodes.push(point);
    }
    if (!Number.isInteger(point.x) || !Number.isInteger(point.z)) {
      fractionalFineNodes.push(point);
    }
  }

  const neighbors: number[][] = nodes.map(p => {
    const step = p.level === 'street' ? definition.nav.defaultStep : definition.nav.fineLevelStep;
    const offsets = p.level === 'canal'
      ? [[step, 0], [-step, 0], [0, step], [0, -step]]
      : [[2, 0], [-2, 0], [0, 2], [0, -2], [1, 0], [-1, 0], [0, 1], [0, -1]];
    const adjacent = offsets.flatMap(([x, z]) => {
      const next = grid.get(gridKey({ ...p, x: p.x + x, z: p.z + z }));
      return next !== undefined && clear(p, nodes[next]) ? [next] : [];
    });
    if (p.level !== 'canal') {
      const diag = p.level === 'upper'
        ? [[1, 1], [1, -1], [-1, 1], [-1, -1]]
        : [[2, 2], [2, -2], [-2, 2], [-2, -2], [1, 1], [1, -1], [-1, 1], [-1, -1]];
      for (const [dx, dz] of diag) {
        const next = grid.get(gridKey({ ...p, x: p.x + dx, z: p.z + dz }));
        if (next !== undefined && clear(p, nodes[next]) && clear(p, { ...p, x: p.x + dx }) && clear(p, { ...p, z: p.z + dz })) {
          adjacent.push(next);
        }
      }
    }
    for (const [mouth, street] of definition.nav.fineLinks) {
      for (const [a, b] of [[mouth, street], [street, mouth]]) {
        if (gridKey(p) !== gridKey(a)) continue;
        const next = grid.get(gridKey(b));
        if (next !== undefined && clear(p, b) && !adjacent.includes(next)) adjacent.push(next);
      }
    }
    for (const otherLevel of definition.nav.levels) {
      if (otherLevel === (p.level ?? 'street')) continue;
      const opposite = grid.get(gridKey({ x: p.x, z: p.z, level: otherLevel === 'street' ? undefined : otherLevel }));
      if (opposite !== undefined && terrain.terrainConnector(p, nodes[opposite]) && clear(p, nodes[opposite])) {
        if (!adjacent.includes(opposite)) adjacent.push(opposite);
      }
    }
    return adjacent;
  });

  const endpointCache = new Map<string, number>();
  const staticPathCache = new Map<string, FpsPoint[]>();
  const predecessors: number[][] = nodes.map(() => []);
  neighbors.forEach((next, from) => next.forEach(to => predecessors[to].push(from)));
  const goalDistanceCache = new Map<number, Int32Array>();

  const goalDistances = (goal: number): Int32Array => {
    const cached = goalDistanceCache.get(goal);
    if (cached) return cached;
    const hops = new Int32Array(nodes.length).fill(-1), queue = new Int32Array(nodes.length);
    let head = 0, tail = 1;
    queue[0] = goal; hops[goal] = 0;
    while (head < tail) {
      const at = queue[head++];
      for (const previous of predecessors[at]) if (hops[previous] < 0) {
        hops[previous] = hops[at] + 1;
        queue[tail++] = previous;
      }
    }
    if (goalDistanceCache.size >= 32) goalDistanceCache.delete(goalDistanceCache.keys().next().value!);
    goalDistanceCache.set(goal, hops);
    return hops;
  };

  const wallSegmentHit = (from: LiveWorldPoint, to: LiveWorldPoint, wall: LiveSolid): number | undefined => {
    const radial = definition.radialShapesById[wall.id];
    if (radial) {
      let nearest: number | undefined;
      for (const shape of radial.shapes) {
        const hit = radialShapeHit(from, to, shape);
        if (hit !== undefined && (nearest === undefined || hit < nearest)) nearest = hit;
      }
      return nearest;
    }
    return boxSegmentHit(from, to, wall);
  };

  const wallIntersections = (from: LiveWorldPoint, to: LiveWorldPoint): LiveWallIntersection[] =>
    collisionSolidsAt(from, to).flatMap(wall => {
      const t = wallSegmentHit(from, to, wall);
      return t === undefined ? [] : [{ wall, t }];
    }).sort((a, b) => a.t - b.t);

  const sightline = (
    a: FpsPoint, b: FpsPoint, eyeA = 1.6 + terrain.groundHeight(a), eyeB = 1.6 + terrain.groundHeight(b),
  ): boolean => {
    const from = { x: a.x, y: eyeA, z: a.z }, to = { x: b.x, y: eyeB, z: b.z };
    const minX = Math.min(a.x, b.x), maxX = Math.max(a.x, b.x);
    const minZ = Math.min(a.z, b.z), maxZ = Math.max(a.z, b.z);
    const minY = Math.min(eyeA, eyeB), maxY = Math.max(eyeA, eyeB);
    for (const wall of collisionSolidsAt(a, b)) {
      const maxH = definition.radialShapesById[wall.id]?.maxHeight ?? wall.height;
      if (maxX < wall.minX || minX > wall.maxX || maxZ < wall.minZ || minZ > wall.maxZ
        || maxY < (wall.baseY ?? 0) || minY > maxH) continue;
      if (wallSegmentHit(from, to, wall) !== undefined) return false;
    }
    return true;
  };

  const grenadeSightline = (from: FpsPoint & { y: number }, to: FpsPoint & { y: number }): boolean =>
    !collisionSolidsAt(from, to).some(w => {
      let enter = 0, exit = 1;
      for (const [origin, delta, min, max] of [
        [from.x, to.x - from.x, w.minX, w.maxX],
        [from.z, to.z - from.z, w.minZ, w.maxZ],
        [from.y, to.y - from.y, w.baseY ?? 0, w.height],
      ]) {
        if (Math.abs(delta) < 1e-9) { if (origin < min || origin > max) return false; }
        else {
          const a = (min - origin) / delta, b = (max - origin) / delta;
          enter = Math.max(enter, Math.min(a, b)); exit = Math.min(exit, Math.max(a, b));
          if (enter > exit) return false;
        }
      }
      return enter <= exit;
    });

  const safePoint = (point: FpsPoint): FpsPoint => {
    const clamped: FpsPoint = {
      x: Math.max(bounds.clampMinX, Math.min(bounds.clampMaxX, point.x)),
      z: Math.max(bounds.clampMinZ, Math.min(bounds.clampMaxZ, point.z)),
      level: point.level,
    };
    if (walkable(clamped)) return { ...clamped };
    const sameLevel = nodes.filter(p => (p.level ?? 'street') === (point.level ?? 'street'));
    const pool = sameLevel.length ? sameLevel : nodes;
    return { ...pool.reduce((best, node) => distance(clamped, node) < distance(clamped, best) ? node : best, pool[0]) };
  };

  const findPath = (
    from: FpsPoint, destination: FpsPoint, threats: readonly FpsPoint[] = [], caution = 0, heatAt?: (point: FpsPoint) => number,
  ): FpsPoint[] => {
    const to = walkable(destination) ? destination : safePoint(destination);
    const fromHasMargin = walkable(from);
    if (!fromHasMargin && !bodyPathClear(from, from, LIVE_ACTOR_RADIUS)) return [];
    const departureClear = (target: FpsPoint) => fromHasMargin ? clear(from, target)
      : terrain.terrainPathClear(from, target) && bodyPathClear(from, target, LIVE_ACTOR_RADIUS);
    if (departureClear(to) && !threats.length && !heatAt) return [{ ...to }];
    const pathKey = (threats.length || heatAt) ? '' : `${gridKey(from)}>${gridKey(to)}`;
    const cached = pathKey ? staticPathCache.get(pathKey) : undefined;
    if (cached) return cached.map(point => ({ ...point }));
    const nearest = (p: FpsPoint, departing = false) => {
      const key = `${departing && !fromHasMargin ? 'physical' : 'margin'}:${gridKey(p)}`;
      const saved = endpointCache.get(key);
      if (saved !== undefined) return saved;
      let best = -1, cost = Infinity;
      const step = p.level === 'canal' || p.level === 'upper' ? definition.nav.fineLevelStep : definition.nav.defaultStep;
      const cx = Math.round(p.x / step) * step, cz = Math.round(p.z / step) * step;
      const offset = Math.max(Math.abs(p.x - cx), Math.abs(p.z - cz));
      const limit = Math.ceil(Math.max(
        Math.abs(cx - bounds.navMaxX), Math.abs(cx - bounds.navMinX),
        Math.abs(cz - bounds.navMaxZ), Math.abs(cz - bounds.navMinZ),
      ) / step);
      const consider = (x: number, z: number) => {
        const index = grid.get(gridKey({ ...p, x, z }));
        if (index === undefined) return;
        const node = nodes[index], d = distance(p, node);
        if ((d < cost || (d === cost && index < best)) && (departing ? departureClear(node) : clear(p, node))) {
          best = index; cost = d;
        }
      };
      if (p.level !== 'canal') {
        for (const point of fractionalFineNodes) if ((point.level ?? 'street') === (p.level ?? 'street')) consider(point.x, point.z);
        const rx = Math.round(p.x), rz = Math.round(p.z);
        for (let ox = -1; ox <= 1; ox++) for (let oz = -1; oz <= 1; oz++) consider(rx + ox, rz + oz);
      }
      for (let ring = 0; ring <= limit; ring++) {
        if (ring === 0) consider(cx, cz);
        else {
          for (let x = cx - ring * step; x <= cx + ring * step; x += step) {
            consider(x, cz - ring * step); consider(x, cz + ring * step);
          }
          for (let z = cz - ring * step + step; z < cz + ring * step; z += step) {
            consider(cx - ring * step, z); consider(cx + ring * step, z);
          }
        }
        if (cost < step * (ring + 1) - offset) break;
      }
      return rememberBounded(endpointCache, key, best, 1024);
    };

    const start = nearest(from, true), end = nearest(to);
    if (start < 0 || end < 0) { if (pathKey) rememberBounded(staticPathCache, pathKey, [], 256); return []; }
    const remaining = goalDistances(end);
    if (remaining[start] < 0) { if (pathKey) rememberBounded(staticPathCache, pathKey, [], 256); return []; }

    const parent = new Int32Array(nodes.length).fill(-1);
    const cost = new Float64Array(nodes.length).fill(Infinity);
    const open: { node: number; score: number }[] = [];
    const compare = (a: { node: number; score: number }, b: { node: number; score: number }) =>
      a.score - b.score || remaining[a.node] - remaining[b.node] || a.node - b.node;
    const push = (item: { node: number; score: number }) => {
      let i = open.length; open.push(item);
      while (i > 0) { const p = (i - 1) >> 1; if (compare(open[p], item) <= 0) break; open[i] = open[p]; i = p; }
      open[i] = item;
    };
    const pop = () => {
      const result = open[0], last = open.pop()!;
      if (open.length) {
        let i = 0;
        while (i * 2 + 1 < open.length) {
          let c = i * 2 + 1;
          if (c + 1 < open.length && compare(open[c + 1], open[c]) < 0) c++;
          if (compare(open[c], last) >= 0) break;
          open[i] = open[c]; i = c;
        }
        open[i] = last;
      }
      return result;
    };
    const closed = new Set<number>(), exposure = new Map<number, number>();
    cost[start] = 0; parent[start] = start; push({ node: start, score: distance(nodes[start], nodes[end]) });
    while (open.length) {
      const { node } = pop();
      if (closed.has(node)) continue;
      if (node === end) break;
      closed.add(node);
      for (const next of neighbors[node]) {
        if (closed.has(next) || remaining[next] < 0) continue;
        if (!exposure.has(next)) {
          const sightExposure = threats.reduce((sum, t) =>
            sum + (distance(t, nodes[next]) < 45 && sightline(t, nodes[next]) ? Math.max(0, caution) * 3 : 0), 0);
          const dynamicHeat = heatAt ? Math.min(8, Math.max(0, heatAt(nodes[next])) * (1.2 + Math.max(0, caution) * 2.5)) : 0;
          exposure.set(next, sightExposure + dynamicHeat);
        }
        const value = cost[node] + distance(nodes[node], nodes[next]) + exposure.get(next)!;
        if (value < cost[next]) {
          cost[next] = value; parent[next] = node;
          push({ node: next, score: value + distance(nodes[next], nodes[end]) });
        }
      }
    }
    if (parent[end] < 0) { if (pathKey) rememberBounded(staticPathCache, pathKey, [], 256); return []; }
    const path: FpsPoint[] = [{ ...to }];
    for (let at = end; at !== start; at = parent[at]) path.push(nodes[at]);
    path.push(nodes[start]); path.reverse();
    const result: FpsPoint[] = [];
    let anchor = from;
    for (let i = 0; i < path.length;) {
      let far = i;
      while (far + 1 < path.length
        && (anchor === from ? departureClear(path[far + 1]) : clear(anchor, path[far + 1]))
        && (!threats.length || distance(anchor, path[far + 1]) < 4)) far++;
      result.push({ ...path[far] }); anchor = path[far]; i = far + 1;
    }
    if (pathKey) rememberBounded(staticPathCache, pathKey, result.map(point => ({ ...point })), 256);
    return result;
  };

  const pathLength = (from: FpsPoint, to: FpsPoint): number => {
    const path = findPath(from, to);
    if (!path.length) return Infinity;
    let total = 0, previous = from;
    for (const point of path) { total += distance(previous, point); previous = point; }
    return total;
  };

  const coverEscapePenalty = (point: FpsPoint, threat: FpsPoint): number => {
    const dirs: [number, number][] = [[1.6, 0], [-1.6, 0], [0, 1.6], [0, -1.6]];
    let clearExits = 0;
    for (const [dx, dz] of dirs) {
      const mid = { x: point.x + dx * .5, z: point.z + dz * .5, level: point.level };
      const exit = { x: point.x + dx, z: point.z + dz, level: point.level };
      if (walkable(mid) && walkable(exit)) clearExits++;
    }
    const dx = point.x - threat.x, dz = point.z - threat.z, len = Math.hypot(dx, dz) || 1;
    const retreat = { x: point.x + (dx / len) * 1.8, z: point.z + (dz / len) * 1.8, level: point.level };
    const retreatMid = { x: point.x + (dx / len) * .9, z: point.z + (dz / len) * .9, level: point.level };
    const retreatSafe = walkable(retreatMid) && walkable(retreat) && !sightline(threat, retreat);
    return (clearExits <= 1 ? 4.5 : clearExits === 2 ? 1.2 : 0) + (retreatSafe ? 0 : 1.8);
  };

  const findCover = (
    from: FpsPoint, threat: FpsPoint, allies: readonly FpsPoint[], quality?: number, knownThreats: readonly FpsPoint[] = [], heatAt?: (point: FpsPoint) => number,
  ): FpsPoint | undefined => {
    const fromFloor = terrain.groundHeight(from);
    const candidates = walls
      .filter(w => !w.id.endsWith('wall') && (w.baseY ?? 0) <= fromFloor + 1.5 && w.height >= fromFloor + .45)
      .flatMap(w => [
        { x: w.minX - .9, z: w.minZ - .9 }, { x: w.maxX + .9, z: w.minZ - .9 },
        { x: w.minX - .9, z: w.maxZ + .9 }, { x: w.maxX + .9, z: w.maxZ + .9 },
      ])
      .map(p => ({ ...p, level: from.level }))
      .filter(p => walkable(p) && distance(from, p) < 12 && !sightline(threat, p));
    const eqsScale = quality ?? 1;
    let best: FpsPoint | undefined, bestScore = Infinity;
    for (const point of candidates) {
      const allyPenalty = allies.filter(ally => distance(point, ally) < 2).length * 5;
      const crossfire = quality === undefined ? 0 : knownThreats.reduce((sum, t) => sum + (sightline(t, point) ? 12 : 0), 0) * quality;
      const escapePenalty = eqsScale > 0 ? coverEscapePenalty(point, threat) * eqsScale : 0;
      const heatPenalty = heatAt && eqsScale > 0 ? Math.max(0, heatAt(point)) * 6 * eqsScale : 0;
      const score = distance(from, point) + allyPenalty + crossfire + escapePenalty + heatPenalty;
      if (score < bestScore) { bestScore = score; best = point; }
    }
    return best;
  };

  const findPeek = (from: FpsPoint, contact: FpsPoint): FpsPoint | undefined => {
    if (sightline(from, contact)) return undefined;
    const candidates: FpsPoint[] = [];
    for (const radius of [1.2, 2, 2.8]) for (let i = 0; i < 12; i++) {
      const p: FpsPoint = { x: from.x + Math.cos(i * Math.PI / 6) * radius, z: from.z + Math.sin(i * Math.PI / 6) * radius, level: from.level };
      if (walkable(p) && clear(from, p) && sightline(p, contact)) candidates.push(p);
    }
    return candidates.sort((a, b) => distance(from, a) - distance(from, b))[0];
  };

  const clearAngles = (from: FpsPoint, toward: FpsPoint): { id: string; point: FpsPoint }[] => {
    const dx = toward.x - from.x, dz = toward.z - from.z, len = Math.hypot(dx, dz) || 1;
    const fromFloor = terrain.groundHeight(from);
    return walls
      .filter(w => !w.id.endsWith('wall') && (w.baseY ?? 0) <= fromFloor + 1.5 && w.height >= fromFloor + .45)
      .flatMap(w => [
        { id: `${w.id}:sw`, point: { x: w.minX - .65, z: w.minZ - .65 } },
        { id: `${w.id}:se`, point: { x: w.maxX + .65, z: w.minZ - .65 } },
        { id: `${w.id}:nw`, point: { x: w.minX - .65, z: w.maxZ + .65 } },
        { id: `${w.id}:ne`, point: { x: w.maxX + .65, z: w.maxZ + .65 } },
      ])
      .map(c => ({ ...c, point: { ...c.point, level: from.level } }))
      .filter(({ point: p }) =>
        distance(from, p) > 1 && distance(from, p) < 7 && walkable(p)
        && sightline(from, p) && ((p.x - from.x) * dx + (p.z - from.z) * dz) / len > 0)
      .sort((a, b) => distance(from, a.point) - distance(from, b.point));
  };

  const callout = (p: FpsPoint): string => {
    const list = definition.tactical.callouts;
    let nearest = list[0], best = distance(p, nearest) + ((nearest.level ?? 'street') === (p.level ?? 'street') ? 0 : 8);
    for (let i = 1; i < list.length; i++) {
      const candidate = list[i];
      const levelPenalty = (candidate.level ?? 'street') === (p.level ?? 'street') ? 0 : 8;
      const d = distance(p, candidate) + levelPenalty;
      if (d < best) { best = d; nearest = candidate; }
    }
    return nearest.name;
  };

  const jumpablePerches: readonly LiveJumpablePerch[] = walls.flatMap(w => {
    const x = Number(((w.minX + w.maxX) / 2).toFixed(2));
    const z = Number(((w.minZ + w.maxZ) / 2).toFixed(2));
    if (definition.perchIgnorePattern.test(w.id)) return [];
    if (w.maxX - w.minX < .85 || w.maxZ - w.minZ < .85) return [];
    const base = w.baseY ?? 0;
    const sampleLevel: FpsTerrainLevel | undefined = terrain.upperArea({ x, z })
      && Math.abs(base - terrain.groundHeight({ x, z, level: 'upper' })) <= .12 ? 'upper' : undefined;
    const floor = terrain.groundHeight({ x, z, level: sampleLevel });
    const relTop = w.height - floor;
    if (Math.abs(base - floor) > .12 || relTop < .4 || relTop > .84) return [];
    const overhead = walls.some(o => o !== w && (o.baseY ?? 0) >= w.height && (o.baseY ?? 0) < w.height + 1.85
      && o.maxX > w.minX && o.minX < w.maxX && o.maxZ > w.minZ && o.minZ < w.maxZ);
    if (overhead) return [];
    const approaches: FpsPoint[] = [
      { x, z: Number((w.minZ - .72).toFixed(2)), level: sampleLevel },
      { x, z: Number((w.maxZ + .72).toFixed(2)), level: sampleLevel },
      { x: Number((w.minX - .72).toFixed(2)), z, level: sampleLevel },
      { x: Number((w.maxX + .72).toFixed(2)), z, level: sampleLevel },
    ].filter(a => walkable(a) && Math.abs(terrain.groundHeight(a) - floor) <= .3);
    if (!approaches.length) return [];
    return [{
      id: w.id,
      name: definition.resolveAssetStyle(w.id).purpose,
      top: { x, z, level: sampleLevel },
      height: w.height,
      minX: w.minX,
      maxX: w.maxX,
      minZ: w.minZ,
      maxZ: w.maxZ,
      approach: approaches[0],
      approaches,
    }];
  });

  const surfaceAt = (point: FpsPoint, y?: number): LiveSurfaceAcoustic => {
    const level: FpsTerrainLevel = point.level ?? 'street';
    const terrainSurf = terrain.surfaceAt(point, y);
    if (terrainSurf === 'water') return 'water';
    if (definition.tactical.surfaceRegions) {
      for (const r of definition.tactical.surfaceRegions) {
        if ((r.level ?? 'street') !== level) continue;
        if (point.x >= r.minX && point.x <= r.maxX && point.z >= r.minZ && point.z <= r.maxZ) return r.surface;
      }
    }
    if (terrainSurf !== (definition.terrainSpec.baseSurface ?? 'stone')) return terrainSurf;
    return definition.audio.defaultSurface;
  };

  return {
    id: definition.id,
    definition,
    terrain,
    walls,
    movementSolids,
    collisionSolids,
    movementSolidsAt,
    collisionSolidsAt,
    wallLookup,
    navNodes: nodes,
    neighbors,
    elevationDrops: definition.elevationDrops,
    jumpablePerches,
    authoredSmokeLineups: definition.authoredSmokeLineups,
    openingLineups: definition.authoredSmokeLineups.filter(l => l.phase === 'opening'),
    smokeLineups: definition.authoredSmokeLineups.filter(l => l.phase === 'execute'),
    walkable,
    movementSegmentClear,
    safePoint,
    actorSolids,
    supportHeight,
    findPath,
    pathLength,
    wallSegmentHit,
    wallIntersections,
    sightline,
    grenadeSightline,
    findCover,
    findPeek,
    clearAngles,
    callout,
    intelArea: definition.tactical.intelClassify,
    surfaceAt,
    learningCompatibility: definition.learningCompatibility ?? `${definition.id}-v1`,
  };
}

// =============================================================================
// Fontessa Village Map Definition & Backwards-Compatible Exports
// =============================================================================
const fontessaSolids: LiveSolid[] = [
  ...[-1, 1].flatMap(side => [[-47, LIVE_RIVER.minZ], [LIVE_RIVER.maxZ, 47]].map(([a, b], i) => ({
    ...fontessaSolid(`${side < 0 ? 'west' : 'east'}-wall-${i}`, side * 36.5, (a + b) / 2, 1, b - a, 1.25, '#b9ad92'),
    minZ: a, maxZ: b,
  }))),
  ...([-1, 1].flatMap(side => [
    fontessaSolid(`south-wall-${side}`, side * 21.25, -46.5, 31.5, 1, 1.3, '#b9ad92'),
    fontessaSolid(`port-quay-${side}`, side * 20.5, 44.2, 27, .4, .85, '#c6b99d'),
  ])),
  fontessaSolid('restaurant-south-wall', 0, -40, 18, .3, 4.4, '#bba283'),
  ...[-1, 1].flatMap(side => [
    fontessaSolid(`restaurant-front-${side}`, side * 6, -29.5, 6, .3, 4.4, '#bba283'),
    fontessaSolid(`restaurant-side-rear-${side}`, side * 9, -38, .3, 4, 4.4, '#bba283'),
    fontessaSolid(`restaurant-side-front-${side}`, side * 9, -30.7, .3, 2.4, 4.4, '#bba283'),
    fontessaSolid(`restaurant-table-${side}`, side * 6, -37, 1.7, 1.2, .82, '#806347', .4),
  ]),
  ...LIVE_CANAL_CROSSINGS.filter((_, i) => i !== 2 && i !== 4).flatMap((bridge, i) => [-1, 1].map(side => ({
    ...fontessaSolid(`canal-crossing-${i}-${side}`, side < 0 ? bridge.minX - .12 : bridge.maxX + .12, .3, .24, 5, .85, '#aa826a'),
    baseY: -.18,
  }))),
  fontessaSolid('port-customs-west', -18, 41, 5, 5, 5.6, '#c2ab83'),
  fontessaSolid('port-customs-east', 18, 41, 5, 5, 6.4, '#c2ab83'),
  fontessaSolid('port-landing-head', 0, 44.1, 14, .35, .85, '#c6b99d'),
  { ...fontessaSolid('restaurant-door-lintel', 0, -29.5, 6, .3, 4.4, '#bba283'), baseY: 2.7 },
  fontessaSolid('restaurant-service-counter', 0, -39.2, 7, .65, .95, '#806347', .4),
  { ...fontessaSolid('restaurant-roof', 0, -34.75, 18.4, 10.9, 4.65, '#a97451'), baseY: 4.4, cutawayGroup: 'roof' },
  ...[-1, 1].map(side => fontessaSolid(`restaurant-outside-table-${side}`, side * 6.5, -26.8, 1.4, 1.2, .78, '#806347', .4)),
  fontessaSolid('restaurant-menu-stand', -10.5, -30.8, .65, .45, 1.2, '#806347', .4),
  { ...fontessaSolid('restaurant-teal-awning', 0, -28.9, 18.8, 1.8, 3.25, '#48776c'), baseY: 3.05 },
  ...[-1, 1].flatMap(side => [
    { ...fontessaSolid(`bridge-parapet-${side}-river`, side * 1.65, (LIVE_RIVER.minZ + LIVE_RIVER.maxZ) / 2, .22, LIVE_RIVER.maxZ - LIVE_RIVER.minZ + .1, LIVE_BRIDGE.parapetY, '#aa826a'), baseY: LIVE_BRIDGE.deckY },
    { ...fontessaSolid(`bridge-parapet-${side}-bank`, side * 1.65, 4.25, .22, 2.7, LIVE_BRIDGE.parapetY, '#aa826a'), baseY: LIVE_BRIDGE.deckY },
  ]),
  { ...fontessaSolid('canal-bank-retaining-west', -10.1, 5.72, 16.8, .24, 0, '#979982'), baseY: -1.4 },
  { ...fontessaSolid('canal-bank-retaining-east', 10.25, 5.72, 17.1, .24, 0, '#979982'), baseY: -1.4 },
  { ...fontessaSolid('canal-bank-retaining-market-end', 24.8, 5.72, 7.2, .24, 0, '#979982'), baseY: -1.4 },
  { ...fontessaSolid('canal-river-curb', 4.95, 2.9, 50.9, .2, -.75, '#979982'), baseY: -1.9 },
  { ...fontessaSolid('canal-bank-end-west', -20.65, 4.25, .2, 2.7, 0, '#979982'), baseY: -1.4 },
  ...[-18, -12, -6, 3, 9, 15, 22, 27].map(x => ({ ...fontessaSolid(`canal-bollard-${x}`, x, 3.04, .16, .16, -.35, '#787b69'), baseY: -1.4 })),
  fontessaSolid('loading-office', -22, -27, 8, 6, 4, '#b6aa91'),
  fontessaSolid('pump-house', 22, -27, 8, 6, 4, '#b6aa91'),
  fontessaSolid('mid-approach-screen', 0, -25, 4, 3, 3, '#859596'),
  fontessaSolid('mid-west-lower', -4.75, -15, 5.5, 6, 5.5, '#b6ac92'),
  fontessaSolid('mid-west-upper', -4.75, -5, 5.5, 6, 5.5, '#b6ac92'),
  fontessaSolid('apartments-south', -12.5, -12, 5, 12, 8, '#b6ac92'),
  fontessaSolid('apartments-north', -11.5, 14, 9, 16, 7, '#b0a38a'),
  fontessaSolid('customs-warehouse-east', 8.5, -10, 11, 16, 8, '#98aaa8'),
  fontessaSolid('freight-office-east', 10.3, 14, 11.4, 16, 7, '#90a6ac'),
  fontessaSolid('b-logs', 14, -11, 3, 4, 1.8, '#a36f50', .42),
  fontessaSolid('b-car', 18, -14.5, 4, 3, 2.4, '#537778'),
  fontessaSolid('west-container', -25, 11, 6, 8, 3, '#537778', .28),
  fontessaSolid('east-container', 24.5, 11.1, 7, 7.4, 8.4, '#a36f50'),
  fontessaSolid('west-outer-gate', -35, 5.5, 2, 4.2, 3.5, '#9e9682'),
  fontessaSolid('east-outer-gate', 35, -11, 2, 8, 3.5, '#8da1a8'),
  fontessaSolid('west-lane-dogleg', -32, -15, 8, 3, 3, '#9e9682'),
  fontessaSolid('east-lane-dogleg', 29.6, -14, 1.6, 2.8, 1.8, '#8da1a8'),
  fontessaSolid('west-staging-cover', -17, -20, 3, 3, 2.4, '#697c79'),
  fontessaSolid('east-staging-cover', 18, -20, 3, 3, 2.4, '#947c5f'),
  fontessaSolid('a-generator', -28.65, 13.0, 1.3, 3.6, 2.5, '#627577'),
  fontessaSolid('a-pit-revetment', -30.5, 16, 1.9, 1.1, .68, '#8b927f'),
  fontessaSolid('a-crates', -28, 20, 5, 5, 6.4, '#9a805a'),
  fontessaSolid('a-screen', -16.2, 33.5, 4, 8, 5.2, '#536b71'),
  fontessaSolid('a-retake-cover', -11, 34, 4, 3, 2.5, '#8b927f'),
  fontessaSolid('a-loggia-wall', -23, 31, 9.6, 9.2, 8.2, '#b86455'),
  fontessaSolid('a-loggia-west-column', -27.5, 26, .45, .45, 3.8, '#cfc3a7'),
  fontessaSolid('a-loggia-center-column', -24.6, 26, .45, .45, 3.8, '#cfc3a7'),
  fontessaSolid('a-loggia-east-column', -21.4, 26, .45, .45, 3.8, '#cfc3a7'),
  fontessaSolid('a-loggia-outer-column', -18.5, 26, .45, .45, 3.8, '#cfc3a7'),
  ...VILLAGE_MARKET_STALLS.flatMap(stall => [
    fontessaSolid(`market-stall-${stall.id}`, stall.x, stall.z, stall.w, stall.d, 1.02, stall.color, .38),
    { ...fontessaSolid(`market-canopy-${stall.id}`, stall.x, stall.z, stall.w + .5, stall.d + 1, 2.74, stall.canvas), baseY: 2.65 },
    ...[-1, 1].flatMap(side => [-1, 1].map(face =>
      fontessaSolid(`market-post-${stall.id}-${side}-${face}`, stall.x + side * (stall.w / 2 + .14), stall.z + face * (stall.d / 2 + .36), .08, .08, 2.65, '#8c7651'))),
  ]),
  fontessaSolid('b-canal-house', 25, -6.4, 6, 8.4, 9.4, '#c18777'),
  fontessaSolid('b-market-west-house', 14.2, 19.1, 4.4, 6.2, 8.8, '#c18777'),
  { ...fontessaSolid('b-sottoportego', 18.5, 9.5, 5, 3.4, 3.3, '#c6b99d'), baseY: 3.05 },
  fontessaSolid('b-fountain', 23, 21, 4.6, 4.6, 1.5, '#6e807e'),
  fontessaSolid('b-coffins', 14.6, 25, 2.8, 2.6, 2.8, '#a77a55', .38),
  fontessaSolid('b-screen', 17, 28, 5, 3, 7.8, '#b5a36d'),
  fontessaSolid('b-dark-wall', 30, 24, 4, 3, 7.6, '#a99267'),
  fontessaSolid('b-retake-cover', 27, 34, 4, 3, 6.4, '#8b927f'),
  fontessaSolid('mid-window-front-sill', .6, 17, 4.8, .24, LIVE_MID_WINDOW.sillY, '#ba8068'),
  fontessaSolid('mid-window-front-pier-west', -4.5, 17, .24, .24, 5.4, '#ba8068'),
  fontessaSolid('mid-window-front-pier-center', -1.65, 17, .3, .24, 5.4, '#ba8068'),
  fontessaSolid('mid-window-front-pier-east', 3.75, 17, 1.5, .24, 5.4, '#ba8068'),
  { ...fontessaSolid('mid-window-front-lintel', .6, 17, 4.8, .24, 5.4, '#ba8068'), baseY: LIVE_MID_WINDOW.lintelY },
  { ...fontessaSolid('mid-window-t-door-lintel', -3.1, 17, 2.6, .24, 5.4, '#ba8068'), baseY: 2.6 },
  fontessaSolid('mid-window-t-stair-wall', -1.68, 19.7, .24, 5.4, 2.65, '#ba8068'),
  fontessaSolid('mid-window-side-1', 4.5, 21.75, .24, 9.74, 5.4, '#ba8068'),
  fontessaSolid('mid-window-side-west-front', -4.5, 19.54, .24, 5.32, 5.4, '#ba8068'),
  { ...fontessaSolid('mid-window-side-door-lintel', -4.5, 24.35, .24, 4.3, 5.4, '#ba8068'), baseY: 4.3 },
  fontessaSolid('mid-window-passage-south', -5.85, 22.2, 2.7, .24, 5.4, '#ba8068'),
  fontessaSolid('mid-window-passage-north-return', -5.85, 26.5, 2.7, .24, 5.4, '#ba8068'),
  ...[-1, 1].map(side => fontessaSolid(`mid-window-passage-west-jamb-${side}`, -7.2, 24.3 + side * 1.99, .24, .32, 5.4, '#ba8068')),
  { ...fontessaSolid('mid-window-passage-exit-lintel', -7.2, 24.3, .24, 3.6, 5.4, '#ba8068'), baseY: 4.3 },
  { ...fontessaSolid('mid-window-passage-roof', -5.85, 24.35, 2.94, 4.54, 5.62, '#ba8068'), baseY: 5.4, cutawayGroup: 'roof' },
  fontessaSolid('mid-window-civic-south-wall', -11.35, 22.2, 8.3, .24, 5.4, '#ba8068'),
  fontessaSolid('mid-window-civic-north-wall', -11.35, 26.5, 8.3, .24, 5.4, '#ba8068'),
  ...[-1, 1].map(side => fontessaSolid(`mid-window-civic-door-jamb-${side}`, -15.5, 24.35 + side * 1.99, .24, .32, 5.4, '#ba8068')),
  { ...fontessaSolid('mid-window-civic-door-header', -15.5, 24.3, .24, 3.6, 5.4, '#ba8068'), baseY: 2.6 },
  { ...fontessaSolid('mid-window-civic-roof', -11.35, 24.35, 8.54, 4.54, 5.62, '#a66b4d'), baseY: 5.4, cutawayGroup: 'roof' },
  fontessaSolid('mid-window-rear-wall', -1.65, 26.5, 5.7, .24, 5.4, '#ba8068'),
  { ...fontessaSolid('mid-window-ct-door-header', 2.85, 26.5, 3.3, .24, 5.4, '#ba8068'), baseY: 2.8 },
  fontessaSolid('mid-window-interior-gallery-rail', 1.12, 23.7, .16, 5.6, 2.65, '#ba8068'),
  ...LIVE_WINDOW_FURNITURE.map(item => ({
    ...fontessaSolid(item.id, item.x, item.z, item.width, item.depth, item.baseY + item.height, item.color, .35),
    baseY: item.baseY,
  })),
  { ...fontessaSolid('mid-window-roof', 0, 21.75, 9.4, 10, 5.62, '#a66b4d'), baseY: 5.4, cutawayGroup: 'roof' },
  fontessaSolid('north-divider', 0, 33, 8, 6, 4, '#a9a291'),
  ...([-1, 1].flatMap(side => [-37, 40].flatMap(z => [
    fontessaSolid(`spawn-bench-${side}-${z}`, side * 13, z, 3.4, 1.05, .7, '#987d55'),
    { ...fontessaSolid(`spawn-bench-${side}-${z}-back`, side * 13, z + (z < 0 ? -.42 : .42), 3.4, .12, 1.35, '#987d55'), baseY: .7 },
  ]))),
  fontessaSolid('market-residential-wing', 38.5, -8, 10, 44, 6.6, '#c4ab8e'),
  ...([{ id: '0', minZ: -27.5, maxZ: -18.5 }, { id: '1', minZ: -10.5, maxZ: -3.5 }, { id: '2', minZ: 2.5, maxZ: 7.5 }].map(p => ({
    ...fontessaSolid(`market-gallery-parapet-${p.id}`, 30.4, (p.minZ + p.maxZ) / 2, .2, p.maxZ - p.minZ, 2.5, '#cfc1a2'),
    baseY: 1.8,
  }))),
  fontessaSolid('village-tree-civic', -22, -4, .72, .72, 3.6, '#6b5840'),
  fontessaSolid('village-tree-arrival', 10, -37, .8, .8, 4.2, '#6b5840'),
  fontessaSolid('village-tree-market', 29, 30, .7, .7, 3.5, '#6b5840'),
  fontessaSolid('village-tree-guard', -9, 39, .72, .72, 3.6, '#6b5840'),
  fontessaSolid('village-bin-inn', -16.9, -28, .65, .65, 1.05, '#536d65'),
  fontessaSolid('village-bin-bakery', -7.9, -16, .6, .6, 1.05, '#536d65'),
  fontessaSolid('village-bin-market', 27.2, 16, .6, .6, 1.05, '#536d65'),
  fontessaSolid('village-bin-civic', -28.8, 28, .6, .6, 1.05, '#536d65'),
  fontessaSolid('b-apartments-back', 38.5, 18, 10, 8.4, 7, '#acb8b5'),
  { ...fontessaSolid('b-apartments-parapet', 30.4, 18.3, .24, 7, 2.52, '#cfbea0'), baseY: 1.8 },
  { ...fontessaSolid('b-apartments-north-rail', 31.9, 21.8, 3.24, .24, 2.52, '#cfbea0'), baseY: 1.8 },
  { ...fontessaSolid('b-apartments-column-s', 30.4, 14.9, .28, .28, 4.35, '#d4c6a7'), baseY: 1.8 },
  { ...fontessaSolid('b-apartments-column-n', 30.4, 21.6, .28, .28, 4.35, '#d4c6a7'), baseY: 1.8 },
];

export const LIVE_FPS_MAP = {
  id: 'fontessa-village-v12',
  name: 'Fontessa',
  width: 72,
  depth: 92,
  spawns: { attackers: { x: 0, z: -30.5 }, defenders: { x: 0, z: 41 } },
  sites: { A: { x: -23, z: 21 }, B: { x: 23, z: 21 } } satisfies Record<string, FpsPoint>,
  solids: fontessaSolids,
};

export const LIVE_TACTICAL = {
  A: {
    staging: [{ x: -20, z: -12 }, { x: -30, z: -12 }],
    rally: [{ x: -19, z: -7 }, { x: -31, z: -7 }],
    entries: [{ x: -18, z: 9 }, { x: -30, z: 7 }],
    flash: { x: -21, z: 14 },
    smoke: { x: -21, z: 31 },
    holds: [{ x: -23, z: 24 }, { x: -31, z: 25 }, { x: -14, z: 23 }],
    postPlant: [{ x: -20, z: 15 }, { x: -30, z: 14 }, { x: -26, z: 24 }, { x: -13, z: 24 }, { x: -19, z: 9 }],
  },
  B: {
    staging: [{ x: 20, z: -12 }, { x: 31, z: -10 }],
    rally: [{ x: 19, z: -7 }, { x: 31, z: -7 }],
    entries: [{ x: 20, z: 10 }, { x: 31, z: 9 }],
    flash: { x: 21, z: 15 },
    smoke: { x: 24, z: 31 },
    holds: [{ x: 23, z: 29 }, { x: 32, z: 26 }, { x: 18, z: 24 }, LIVE_B_APARTMENTS.hold],
    postPlant: [{ x: 20, z: 14 }, LIVE_B_APARTMENTS.hold, { x: 23, z: 28 }, { x: 19, z: 26 }, { x: 19, z: 8 }],
  },
};

export const LIVE_OPENING_LINEUPS = LIVE_AUTHORED_SMOKE_LINEUPS.filter(l => l.phase === 'opening');
export const LIVE_SMOKE_LINEUPS = LIVE_AUTHORED_SMOKE_LINEUPS.filter(l => l.phase === 'execute');
export const LIVE_MID = {
  approach: { x: 0, z: -21 },
  control: { x: 0, z: 1 },
  underpass: { west: { x: -8.7, z: -10 }, east: { x: 0, z: -10 } },
  window: LIVE_MID_WINDOW,
  splits: { A: { x: -19, z: 5 }, B: { x: 19, z: 5 } },
};
export const LIVE_MARKET_PASSAGE = { south: { x: 16.9, z: 18 }, center: { x: 16.9, z: 20 }, north: { x: 18, z: 24 } };
export const LIVE_CHOKES = [
  { name: 'A main', center: { x: -19, z: 7 }, width: 6, axis: 'x' },
  { name: 'A outer', center: { x: -31, z: 7 }, width: 6, axis: 'x' },
  { name: 'B main', center: { x: 18.5, z: 8 }, width: 4.9, axis: 'x' },
  { name: 'B outer', center: { x: 31, z: 9 }, width: 6, axis: 'x' },
  { name: 'Mid gate', center: { x: 0, z: -12 }, width: 6, axis: 'x' },
] as const;
export const LIVE_CALLOUTS = [
  { name: 'Jade Lantern restaurant', x: 0, z: -38 },
  { name: 'Bakery lane', x: 18, z: -16 },
  { name: 'Firewood store', x: 14, z: -11 },
  { name: 'Street kiosk', x: 18, z: -2 },
  { name: 'Market approach', x: 24, z: 4 },
  { name: 'Market entrance', x: 20, z: 8 },
  { name: 'Public fountain', x: 23, z: 21 },
  { name: 'B apartments gallery', ...LIVE_B_APARTMENTS.hold },
  { name: 'B apartments stairs', x: 32, z: 10.5 },
  { name: 'Flower seller', x: 15, z: 26 },
  { name: 'Grocer corner', x: 31, z: 28 },
  { name: 'Market guard street', x: 23, z: 36 },
  { name: 'Market rear lane', x: 12, z: 35 },
  { name: 'Customs port / CT quay', x: 0, z: 41 },
  { name: 'Civic passage', x: -4, z: 22 },
  { name: 'Customs Mid window', ...LIVE_MID_WINDOW.hold },
  { name: 'Town-hall approach', x: -12, z: 8 },
  { name: 'West homes', x: -12, z: -4 },
  { name: 'A balcony', x: -16, z: 14 },
  { name: 'Carpenter lane', x: -20, z: -10 },
  { name: 'Courtyard bench', x: -30, z: 14 },
  { name: 'Town-hall courtyard', x: -23, z: 21 },
  { name: 'Town-hall rear', x: -24, z: 30 },
  { name: 'Mid lane', x: 0, z: -8 },
  { name: 'Second mid canal', x: -8, z: -16 },
  { name: 'Residential passage', x: -5, z: -10 },
  { name: 'Canal stone bridge', x: 0, z: 2 },
];

const FOUNTAIN_SHAPES: readonly LiveRadialShape[] = [
  { x: 23, z: 21, minY: .03, maxY: .27, radius: 2.125 },
  { x: 23, z: 21, minY: .26, maxY: .86, radius: 2.01, innerRadius: 1.84 },
  { x: 23, z: 21, minY: .76, maxY: .98, radius: 2.05, innerRadius: 1.70 },
  { x: 23, z: 21, minY: .85, maxY: 1.51, radius: .36 },
  { x: 23, z: 21, minY: 1.48, maxY: 1.72, radius: .71 },
  { x: 23, z: 21, minY: 1.75, maxY: 2.17, radius: .20 },
  { x: 23, z: 21, minY: 2.04, maxY: 2.36, radius: .16 },
];

export const LIVE_BOOST_SPOTS: LiveBoostSpot[] = [];
export interface LiveBoostSpot {
  id: string;
  name: string;
  site: 'A' | 'B' | 'Mid';
  x: number;
  z: number;
  height: number;
  team: 'ct' | 't' | 'both';
  yaw: number;
  description: string;
}

export const LIVE_ELEVATION_DROPS: readonly LiveElevationDrop[] = [
  {
    id: 'mid-window-drop', name: 'Mid window drop',
    from: { minX: -1.4, maxX: 2.8, minZ: 17.1, maxZ: 20.4 },
    landing: { x: 0.6, z: 15.1 }, minForwardDot: 0.35,
  },
  {
    id: 'b-apartments-west-drop', name: 'B apartments west drop',
    from: { minX: 30.4, maxX: 33.4, minZ: 14.8, maxZ: 17.6 },
    landing: { x: 28.0, z: 17.0 }, minForwardDot: 0.35,
  },
  {
    id: 'b-apartments-north-drop', name: 'B apartments north drop',
    from: { minX: 32.2, maxX: 33.4, minZ: 19.5, maxZ: 21.8 },
    landing: { x: 32.8, z: 23.6 }, minForwardDot: 0.35,
  },
  {
    id: 'market-terrace-drop', name: 'Market gallery drop',
    from: { minX: 30.4, maxX: 33.4, minZ: -17.5, maxZ: -15.0 },
    landing: { x: 28.0, z: -15.8 }, minForwardDot: 0.35,
  },
  {
    id: 'bridge-canal-drop', name: 'Bridge to canal bank drop',
    from: { minX: -1.6, maxX: 1.6, minZ: 2.9, maxZ: 5.6 },
    landing: { x: 3.1, z: 4.2, level: 'canal' }, minForwardDot: 0.35,
  },
];

const marketPassageNodes: FpsPoint[] = Array.from({ length: 8 }, (_, i) => ({ x: 16.9, z: 16 + i }));
const fontessaFineNodes: FpsPoint[] = [
  ...Array.from({ length: 8 }, (_, i) => ({ x: -9, z: -20 + i * 2 })),
  ...Array.from({ length: 6 }, (_, i) => ({ x: -8 + i * 2, z: -11 })),
  ...Array.from({ length: 9 }, (_, i) => ({ x: 0, z: 17 + i })),
  ...Array.from({ length: 12 }, (_, i) => ({ x: 2, z: 18 + i })),
  ...Array.from({ length: 12 }, (_, i) => ({ x: 3, z: 18 + i })),
  ...Array.from({ length: 9 }, (_, i) => ({ x: -4 + i, z: 29 })),
  ...Array.from({ length: 4 }, (_, i) => ({ x: -6 + i * 2, z: 23 })),
  ...Array.from({ length: 11 }, (_, i) => ({ x: -16 + i, z: 24 })),
  ...Array.from({ length: 11 }, (_, i) => ({ x: -3, z: 15 + i })),
  { x: -4, z: 24 },
  ...Array.from({ length: 5 }, (_, i) => ({ x: -17, z: 24 + i })),
  ...marketPassageNodes,
  ...Array.from({ length: 9 }, (_, i) => ({ x: 10 + i, z: 23 })),
  ...Array.from({ length: 6 }, (_, i) => ({ x: 11, z: 23 + i })),
  ...Array.from({ length: 7 }, (_, xIdx) => Array.from({ length: 17 }, (_, zIdx) => ({ x: -34 + xIdx, z: 7 + zIdx }))).flat(),
  ...Array.from({ length: 9 }, (_, i) => ({ x: 21 + i, z: 6 })),
  ...Array.from({ length: 3 }, (_, xIdx) => Array.from({ length: 24 }, (_, zIdx) => ({ x: 28 + xIdx, z: -12 + zIdx }))).flat(),
];
const fontessaFineLinks: [FpsPoint, FpsPoint][] = [
  [marketPassageNodes[0], { x: 18, z: 16 }],
  [marketPassageNodes[7], { x: 18, z: 24 }],
  [marketPassageNodes[7], { x: 16, z: 23 }],
  [marketPassageNodes[7], { x: 18, z: 23 }],
  [{ x: 28, z: 6 }, { x: 29, z: 8 }],
];

export const FONTESSA_MAP_DEFINITION: LiveMapDefinition = {
  id: 'fontessa',
  runtimeId: LIVE_FPS_MAP.id,
  name: LIVE_FPS_MAP.name,
  width: LIVE_FPS_MAP.width,
  depth: LIVE_FPS_MAP.depth,
  bounds: {
    minX: -36, maxX: 36, minZ: -46, maxZ: 46,
    clampMinX: -34, clampMaxX: 34, clampMinZ: -43, clampMaxZ: 43,
    navMinX: -34, navMaxX: 34, navMinZ: -42, navMaxZ: 42,
  },
  influenceGrid: { minX: -36, minZ: -44, cols: 18, rows: 22, cellSize: 4 },
  spawns: LIVE_FPS_MAP.spawns,
  sites: LIVE_FPS_MAP.sites,
  solids: LIVE_FPS_MAP.solids,
  movementSolids: [...LIVE_FPS_MAP.solids, ...LIVE_BRIDGE_VAULTS, ...LIVE_TERRAIN_SOLIDS.filter(w => w.id.includes('-cheek-'))],
  collisionSolids: [...LIVE_FPS_MAP.solids, ...LIVE_TERRAIN_SOLIDS],
  terrainSpec: {
    id: 'fontessa',
    bounds: { minX: -36, maxX: 36, minZ: -46, maxZ: 50, cellSize: 4 },
    groundPatches: FONTESSA_TERRAIN_RUNTIME.groundPatches,
  },
  radialShapesById: {
    'b-fountain': { maxHeight: 2.36, shapes: FOUNTAIN_SHAPES },
  },
  elevationDrops: LIVE_ELEVATION_DROPS,
  perchIgnorePattern: /wall|quay|port-|spawn-|canal-|restaurant-table/,
  resolveAssetStyle: (id: string) => liveVillageAsset(id),
  tactical: {
    A: {
      ...LIVE_TACTICAL.A,
      retakeEntrances: [{ x: -12.5, z: 26 }, { x: -31, z: 27 }, { x: -19, z: 9 }],
      postPlantCheeky: [{ x: -31, z: 25 }, { x: -17, z: 20 }, { x: -30, z: 23 }],
      retakeExtras: [{ x: -29, z: 16 }, { x: -34, z: 16 }, { x: -25, z: 26 }],
      retakeStaging: [{ x: -14, z: 36 }, { x: -24, z: 36 }, { x: -8, z: 31 }],
      plantChoices: [
        { x: -23, z: 18.1, style: 'for main' },
        { x: -20.1, z: 21, style: 'for middle' },
        { x: -23, z: 23.9, style: 'for guard street' },
        { x: -24.8, z: 20, style: 'safe civic cover' },
      ],
    },
    B: {
      ...LIVE_TACTICAL.B,
      retakeEntrances: [{ x: 20, z: 32 }, { x: 31, z: 29 }, { x: 20, z: 10 }],
      postPlantCheeky: [{ x: 22, z: 29 }, { x: 29.8, z: 19 }, { x: 19.5, z: 16 }],
      retakeExtras: [LIVE_MARKET_PASSAGE.north, LIVE_MARKET_PASSAGE.center, { x: 14.5, z: 23 }, { x: 11.5, z: 25 }],
      retakeStaging: [{ x: 12, z: 36 }, { x: 24, z: 36 }, { x: 17, z: 34 }],
      plantChoices: [
        { x: 23, z: 18.1, style: 'for main' },
        { x: 20.1, z: 21, style: 'for catwalk' },
        { x: 23, z: 23.9, style: 'for guard street' },
        { x: 25.9, z: 21, style: 'for gallery' },
      ],
    },
    mid: LIVE_MID,
    chokes: LIVE_CHOKES,
    callouts: LIVE_CALLOUTS,
    intelClassify: (point: FpsPoint) => point.z > -18 && point.x < -10 ? 'A' : point.z > -18 && point.x > 10 ? 'B' : 'Mid',
    assaultExtras: (site, from) => [
      ...(from.z >= -18 ? (site === 'A' ? [
        { key: 'A:west-flank', point: { x: -34, z: 12 }, purpose: 'flank' as const },
        { key: 'A:pit-pocket', point: { x: -29, z: 16 }, purpose: 'entry' as const },
        ...(from.z < 4 ? [{ key: 'A:mid-underpass', point: { x: -8.5, z: -8 }, purpose: 'flank' as const }] : []),
      ] : [
        { key: 'B:flower-alley', point: { x: 14.5, z: 23 }, purpose: 'flank' as const },
        { key: 'B:apartments-ramp', point: { x: 32, z: 14 }, purpose: 'entry' as const },
        ...(from.z < 4 ? [{ key: 'B:banana-car', point: { x: 20, z: -4 }, purpose: 'clear' as const }] : []),
      ]) : []),
      ...(site === 'B' && from.z < 19 ? [{ key: 'B:market-passage', point: LIVE_MARKET_PASSAGE.center, purpose: 'flank' as const }] : []),
      ...(from.z < 3 ? [{ key: `${site}:mid-split`, point: LIVE_MID.splits[site], purpose: 'flank' as const }] : []),
    ],
    anchorPoints: {
      A: [{ x: -31, z: 25 }, { x: -23, z: 24 }],
      B: [{ x: 23, z: 29 }, { x: 32, z: 26 }],
    },
    lurkPoints: {
      A: [{ x: -12.5, z: -4 }, { x: -18, z: 8 }],
      B: [{ x: 14, z: -11 }, { x: 20, z: 10 }],
    },
    spawnDirection: { attackForwardSign: 1, defendForwardSign: -1, spawnSpreadAxis: 'x' },
  },
  authoredSmokeLineups: LIVE_AUTHORED_SMOKE_LINEUPS,
  nav: {
    defaultStep: 2,
    fineLevelStep: 1,
    levels: ['street', 'canal'],
    fineNodes: fontessaFineNodes,
    fineLinks: fontessaFineLinks,
  },
  audio: {
    defaultSurface: 'stone',
    reverbWet: .26,
    reverbDelayMs: 65,
    lowpassHz: 7500,
    gunshotTailDecay: .22,
  },
  atmosphere: {
    sky: FONTESSA_SKY_ATMOSPHERE,
    sunDirection: { x: .58, y: -1, z: .42 },
    sunHex: '#fff3db',
    sunIntensity: 1.55,
    hemiSkyHex: '#d7e7f0',
    hemiGroundHex: '#8d7a64',
    hemiIntensity: .84,
    fogHex: '#bfd1d5',
    fogDensity: .0022,
    baseGroundHex: '#cabfa5',
    baseGroundSurface: 'stone',
  },
  broadcast: {
    displayName: 'Fontessa',
    subtitle: 'Mediterranean Canal Quarter',
    themeTag: 'Signal Circuit',
    radarViewBox: { minX: 0, minY: 0, width: 72, height: 92 },
    overviewCamera: { position: { x: 0, y: 78, z: -3 }, target: { x: 0, y: 0, z: 2 }, fov: .78 },
    showcasePoses: [
      { position: { x: 0, y: 31, z: -38 }, target: { x: 0, y: 2.5, z: 8 }, label: 'Fontessa Overview' },
      { position: { x: -34, y: 18, z: -14 }, target: { x: -16, y: 2, z: 18 }, label: 'A Civic Courtyard' },
      { position: { x: 34, y: 18, z: -14 }, target: { x: 16, y: 2, z: 18 }, label: 'B Fountain Market' },
    ],
    freezeShowcaseCenter: { x: 0, z: 4, height: 48 },
    pipAnchorHeights: { A: 2.35, B: 3.9 },
  },
};

export const FONTESSA_MAP_RUNTIME: LiveMapRuntime = createLiveMapRuntime(FONTESSA_MAP_DEFINITION, FONTESSA_TERRAIN_RUNTIME);

export const LIVE_COLLISION_SOLIDS: readonly LiveSolid[] = FONTESSA_MAP_RUNTIME.collisionSolids;
export const liveCallout = FONTESSA_MAP_RUNTIME.callout;
export const liveActorSolids = FONTESSA_MAP_RUNTIME.actorSolids;
export const liveSupportHeight = FONTESSA_MAP_RUNTIME.supportHeight;
export const liveMovementSegmentClear = FONTESSA_MAP_RUNTIME.movementSegmentClear;
export const liveWalkable = FONTESSA_MAP_RUNTIME.walkable;
export const findLivePath = FONTESSA_MAP_RUNTIME.findPath;
export const safeLivePoint = FONTESSA_MAP_RUNTIME.safePoint;
export const findLiveCover = FONTESSA_MAP_RUNTIME.findCover;
export const liveWallSegmentHit = FONTESSA_MAP_RUNTIME.wallSegmentHit;
export const liveWallIntersections = FONTESSA_MAP_RUNTIME.wallIntersections;
export const liveSightline = FONTESSA_MAP_RUNTIME.sightline;
export const livePathLength = FONTESSA_MAP_RUNTIME.pathLength;
export const findLivePeek = FONTESSA_MAP_RUNTIME.findPeek;
export const liveClearAngles = FONTESSA_MAP_RUNTIME.clearAngles;
export const LIVE_JUMPABLE_PERCHES: readonly LiveJumpablePerch[] = FONTESSA_MAP_RUNTIME.jumpablePerches;
