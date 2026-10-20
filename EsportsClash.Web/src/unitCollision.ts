/** Ground-plane movement contacts. Visual meshes never determine hitboxes. */
export type CollisionPoint = { x: number; y: number };
export type CollisionBody = {
  id: string;
  from: CollisionPoint;
  to: CollisionPoint;
  radius: number;
  terrainRadius?: number;
  /** Creeps keep personal space through steering, but never form a solid wall. */
  soft?: boolean;
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
 * Soft creep contacts steer ahead of contact and separate at rest, without
 * clipping walking movement against a creep. Avatar contacts remain swept.
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
    // Solid walking contacts do not displace their targets. Soft creeps restore
    // their own space and yield to stationary avatars, rather than nudging them.
    const neighbours = nearby(body, p, 4).filter(other => body.soft || !other.soft || other.locked);
    let rx = 0, ry = 0;
    for (const other of neighbours) {
      const d = distance(p, other), penetration = body.radius + other.radius - d;
      if (penetration <= SKIN) continue;
      const normal = d > .00001 ? { x: (p.x - other.x) / d, y: (p.y - other.y) / d } : coincidentNormal(body.id, other.id);
      rx += normal.x * penetration; ry += normal.y * penetration;
    }
    const repairLength = Math.hypot(rx, ry);
    if (repairLength > .00001) {
      const intendedLength = distance(body.from, body.to);
      const recoverySpeed = body.soft ? Math.min(36, body.radius * 3.6) : 36;
      const length = Math.min(repairLength, recoverySpeed * Math.min(dt, 1 / 15),
        intendedLength > .00001 ? intendedLength : Infinity);
      const penalty = (point: CollisionPoint) => neighbours.reduce((sum, other) => sum + Math.max(0, body.radius + other.radius - distance(point, other)) ** 2, 0);
      const beforePenalty = penalty(p);
      // A full separation step can overshoot between several close neighbours.
      // Shorten it until the whole cluster gains space instead of freezing.
      for (let attempt = 0; attempt < (body.soft ? 6 : 1); attempt++) {
        const step = length / 2 ** attempt;
        const repaired = { x: p.x + rx / repairLength * step, y: p.y + ry / repairLength * step };
        const createsOverlap = neighbours.some(other => !body.soft && !other.soft && distance(p, other) >= body.radius + other.radius - SKIN
          && distance(repaired, other) < body.radius + other.radius - SKIN);
        if (!createsOverlap && walkable(repaired) && penalty(repaired) < beforePenalty) { p = repaired; break; }
      }
    }

    const intendedX = body.to.x - body.from.x, intendedY = body.to.y - body.from.y;
    const intendedLength = Math.hypot(intendedX, intendedY), repairDistance = distance(p, body.from);
    // Recovery spends the moving actor's existing step budget; it cannot grant a
    // speed boost to a freshly spawned creep or a walker emerging from a blink.
    const scale = intendedLength > .00001 ? Math.max(0, intendedLength - repairDistance) / intendedLength : 0;
    let dx = intendedX * scale, dy = intendedY * scale;
    const movementLength = Math.hypot(dx, dy);
    if (movementLength > .00001) {
      const heading = { x: dx / movementLength, y: dy / movementLength };
      const lookAhead = Math.max(body.radius * 2, movementLength / dt * .35);
      let threat: PositionedBody | undefined, firstContact = lookAhead;
      for (const other of nearby(body, p, lookAhead)) {
        if (!body.soft && !other.soft) continue;
        const ox = other.x - p.x, oy = other.y - p.y;
        const along = ox * heading.x + oy * heading.y;
        const across = ox * -heading.y + oy * heading.x;
        const clearance = body.radius + other.radius + Math.min(body.radius, other.radius) * .15;
        if (along <= 0 || Math.abs(across) >= clearance) continue;
        const contact = along - Math.sqrt(clearance * clearance - across * across);
        if (contact < firstContact) { threat = other; firstContact = contact; }
      }
      if (threat) {
        const ox = threat.x - p.x, oy = threat.y - p.y, d = Math.hypot(ox, oy);
        const clearance = body.radius + threat.radius + Math.min(body.radius, threat.radius) * .15;
        const angle = Math.asin(Math.min(1, clearance / d));
        const across = ox * -heading.y + oy * heading.x;
        // Choose the nearer side; exact head-on traffic consistently keeps right.
        const side = Math.abs(across) > Math.min(body.radius, threat.radius) * .05 ? -Math.sign(across) : 1;
        for (const sign of [side, -side]) {
          const cosine = Math.cos(angle), sine = Math.sin(angle) * sign;
          const sx = (ox * cosine - oy * sine) / d * movementLength;
          const sy = (ox * sine + oy * cosine) / d * movementLength;
          if (!walkable({ x: p.x + sx, y: p.y + sy })) continue;
          dx = sx; dy = sy;
          break;
        }
      }
    }
    const length = Math.hypot(dx, dy), steps = Math.max(1, Math.ceil(length / 4));
    for (let step = 0; step < steps && length > .00001; step++) {
      let vx = dx / steps, vy = dy / steps;
      for (let contact = 0; contact < 4; contact++) {
        const speed = Math.hypot(vx, vy);
        if (speed < .00001) break;
        let hit: PositionedBody | undefined, fraction = 1;
        for (const other of nearby(body, p, speed)) {
          // Soft contacts may compress while passing through a bottleneck;
          // steering and bounded separation restore space instead of blocking.
          if (body.soft || other.soft) continue;
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
