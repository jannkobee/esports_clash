/** Ground-plane movement contacts. Visual meshes never determine hitboxes. */
export type CollisionPoint = { x: number; y: number };
export type CollisionBody = {
  id: string;
  from: CollisionPoint;
  to: CollisionPoint;
  radius: number;
  terrainRadius?: number;
  /** Recall/control/ability movement is authoritative; other walkers go around it. */
  locked?: boolean;
};
type PositionedBody = CollisionBody & CollisionPoint;
const SKIN = .03;
const CELL = 96;
const distance = (a: CollisionPoint, b: CollisionPoint) => Math.hypot(a.x - b.x, a.y - b.y);
const order = (a: string, b: string) => a < b ? -1 : a > b ? 1 : 0;

function coincidentNormal(a: string, b: string): CollisionPoint {
  const key = order(a, b) < 0 ? `${a}|${b}` : `${b}|${a}`;
  let hash = 2166136261;
  for (let i = 0; i < key.length; i++) hash = Math.imul(hash ^ key.charCodeAt(i), 16777619);
  const angle = (hash >>> 0) / 4294967296 * Math.PI * 2;
  const sign = order(a, b) < 0 ? 1 : -1;
  return { x: Math.cos(angle) * sign, y: Math.sin(angle) * sign };
}

/**
 * Resolve each walker's own swept displacement, never push its collision target.
 * Sorted IDs and a shared spatial grid make replay independent of input order.
 * Already-invalid overlaps (spawn/blink) recover gradually, bounded by dt.
 */
export function resolveCrowdMovement(
  bodies: readonly CollisionBody[], dt: number,
  isWalkable: (point: CollisionPoint, radius: number) => boolean = () => true,
): Map<string, CollisionPoint> {
  const actors: PositionedBody[] = bodies.map(body => ({ ...body,
    x: body.locked ? body.to.x : body.from.x, y: body.locked ? body.to.y : body.from.y,
  })).sort((a, b) => order(a.id, b.id));
  const grid = new Map<string, Set<PositionedBody>>();
  const cell = (x: number, y: number) => `${Math.floor(x / CELL)},${Math.floor(y / CELL)}`;
  const insert = (body: PositionedBody) => {
    const key = cell(body.x, body.y);
    if (!grid.has(key)) grid.set(key, new Set());
    grid.get(key)!.add(body);
  };
  actors.forEach(insert);
  const maximumRadius = Math.max(0, ...actors.map(body => body.radius));
  const nearby = (body: PositionedBody, p: CollisionPoint, reach: number) => {
    const padding = reach + body.radius + maximumRadius + SKIN;
    const found: PositionedBody[] = [];
    for (let x = Math.floor((p.x - padding) / CELL); x <= Math.floor((p.x + padding) / CELL); x++) {
      for (let y = Math.floor((p.y - padding) / CELL); y <= Math.floor((p.y + padding) / CELL); y++) {
        for (const other of grid.get(`${x},${y}`) ?? []) {
          const limit = reach + body.radius + other.radius + SKIN;
          if (other !== body && (p.x - other.x) ** 2 + (p.y - other.y) ** 2 <= limit * limit) found.push(other);
        }
      }
    }
    return found.sort((a, b) => order(a.id, b.id));
  };

  for (const body of actors) {
    if (body.locked || dt <= 0) continue;
    const walkable = (point: CollisionPoint) => isWalkable(point, body.terrainRadius ?? body.radius);
    const oldCell = cell(body.x, body.y);
    let p = { x: body.x, y: body.y };
    // No recovery ever moves a previously clear stationary target. In particular,
    // walking into an attacking/recalling teammate cannot knock them aside.
    const neighbours = nearby(body, p, 4);
    let rx = 0, ry = 0;
    for (const other of neighbours) {
      const d = distance(p, other), penetration = body.radius + other.radius - d;
      if (penetration <= SKIN) continue;
      const normal = d > .00001 ? { x: (p.x - other.x) / d, y: (p.y - other.y) / d } : coincidentNormal(body.id, other.id);
      rx += normal.x * penetration; ry += normal.y * penetration;
    }
    const repairLength = Math.hypot(rx, ry);
    if (repairLength > .00001) {
      const length = Math.min(repairLength, 36 * Math.min(dt, 1 / 15));
      const repaired = { x: p.x + rx / repairLength * length, y: p.y + ry / repairLength * length };
      const penalty = (point: CollisionPoint) => neighbours.reduce((sum, other) => sum + Math.max(0, body.radius + other.radius - distance(point, other)) ** 2, 0);
      const createsOverlap = neighbours.some(other => distance(p, other) >= body.radius + other.radius - SKIN
        && distance(repaired, other) < body.radius + other.radius - SKIN);
      if (!createsOverlap && walkable(repaired) && penalty(repaired) < penalty(p)) p = repaired;
    }

    const intendedX = body.to.x - body.from.x, intendedY = body.to.y - body.from.y;
    const intendedLength = Math.hypot(intendedX, intendedY), repairDistance = distance(p, body.from);
    // Recovery spends the moving actor's existing step budget; it cannot grant a
    // speed boost to a freshly spawned creep or a walker emerging from a blink.
    const scale = intendedLength > .00001 ? Math.max(0, intendedLength - repairDistance) / intendedLength : 0;
    const dx = intendedX * scale, dy = intendedY * scale;
    const length = Math.hypot(dx, dy), steps = Math.max(1, Math.ceil(length / 4));
    for (let step = 0; step < steps && length > .00001; step++) {
      let vx = dx / steps, vy = dy / steps;
      for (let contact = 0; contact < 4; contact++) {
        const speed = Math.hypot(vx, vy);
        if (speed < .00001) break;
        let hit: PositionedBody | undefined, fraction = 1;
        for (const other of nearby(body, p, speed)) {
          const ox = p.x - other.x, oy = p.y - other.y, radius = body.radius + other.radius + SKIN;
          const dot = ox * vx + oy * vy, c = ox * ox + oy * oy - radius * radius;
          // Existing overlaps may move outward, but cannot deepen while walking.
          if (dot >= 0) continue;
          const discriminant = dot * dot - speed * speed * c;
          if (discriminant < 0) continue;
          const t = c <= 0 ? 0 : (-dot - Math.sqrt(discriminant)) / (speed * speed);
          if (t >= 0 && t < fraction) { hit = other; fraction = t; }
        }
        const travel = Math.max(0, fraction - (hit ? SKIN / speed : 0));
        const next = { x: p.x + vx * travel, y: p.y + vy * travel };
        if (walkable(next)) p = next;
        else break;
        if (!hit) break;
        const d = distance(p, hit);
        const normal = d > .00001 ? { x: (p.x - hit.x) / d, y: (p.y - hit.y) / d } : coincidentNormal(body.id, hit.id);
        const tx = -normal.y, ty = normal.x, tangentDot = vx * tx + vy * ty;
        // Head-on contacts consistently pass clockwise; no random left/right flip.
        let sign = Math.abs(tangentDot) > speed * .05 ? Math.sign(tangentDot) : 1;
        const remaining = speed * (1 - fraction);
        if (!walkable({ x: p.x + tx * remaining * sign, y: p.y + ty * remaining * sign })) sign *= -1;
        vx = tx * remaining * sign; vy = ty * remaining * sign;
      }
    }
    grid.get(oldCell)?.delete(body);
    body.x = p.x; body.y = p.y; insert(body);
  }
  return new Map(actors.map(body => [body.id, { x: body.x, y: body.y }]));
}

export const CHAMPION_BODY_RADIUS = 17;
export function creepBodyRadius(unit: { type?: string; siegeGolem?: boolean; summonedBearOwnerId?: string; prismWardenOwnerId?: string }): number {
  return unit.siegeGolem ? 28 : unit.summonedBearOwnerId ? 17 : unit.prismWardenOwnerId ? 16 : unit.type === 'cannon' ? 14 : 10;
}
