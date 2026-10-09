export interface Point { x: number; y: number }

export function segmentHitsCircle(start: Point, end: Point, center: Point, radius: number): boolean {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const lengthSquared = dx * dx + dy * dy;
  const t = lengthSquared === 0 ? 0 : Math.max(0, Math.min(1,
    ((center.x - start.x) * dx + (center.y - start.y) * dy) / lengthSquared));
  return Math.hypot(center.x - start.x - dx * t, center.y - start.y - dy * t) <= radius;
}

export function aimAtCast(
  caster: Point, target: Point & { vx: number; vy: number }, speed: number,
  mechanics: number, random: () => number = Math.random
): Point {
  const skill = Math.max(0, Math.min(100, mechanics));
  const travelTime = Math.min(0.65, Math.hypot(target.x - caster.x, target.y - caster.y) / speed);
  const lead = travelTime * Math.max(0, (skill - 35) / 65);
  const error = Math.max(0, (85 - skill) * 0.55);
  return {
    x: target.x + target.vx * lead + (random() * 2 - 1) * error,
    y: target.y + target.vy * lead + (random() * 2 - 1) * error,
  };
}

export function dodgeProbability(defenderLan: number, defenderIq: number, attackerLan: number): number {
  return Math.max(0.02, Math.min(0.7,
    0.08 + (defenderLan - 50) * 0.009 + (defenderIq - 50) * 0.003 - (attackerLan - 70) * 0.003));
}
