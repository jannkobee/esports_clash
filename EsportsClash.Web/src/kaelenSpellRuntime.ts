import type { KaelenInvokedSpell } from './kaelenAbilities.ts';

type Point = { x: number; y: number };
export type KaelenCast = { spellId: string; origin: Point; aim: Point; elapsed: number; hitIds: string[]; resolved: boolean };
export function kaelenCastPosition(cast: KaelenCast, spell: KaelenInvokedSpell): Point & { radius: number } {
  const length = Math.hypot(cast.aim.x - cast.origin.x, cast.aim.y - cast.origin.y);
  if (spell.shape !== 'line' && spell.shape !== 'snowball') return { ...cast.aim, radius: spell.radius };
  const travel = Math.min(spell.range, Math.max(0, cast.elapsed - spell.delay) * spell.speed);
  const fraction = travel / Math.max(1, length);
  return { x: cast.origin.x + (cast.aim.x - cast.origin.x) * fraction,
    y: cast.origin.y + (cast.aim.y - cast.origin.y) * fraction,
    radius: spell.shape === 'snowball' ? 22 + 26 * travel / spell.range : spell.radius };
}
export function kaelenCastLifetime(spell: KaelenInvokedSpell) {
  return spell.delay + (spell.speed > 0 ? spell.range / spell.speed : 0) + 0.3;
}

/** Swept collision prevents fast missiles skipping a target between fixed steps. */
export function advanceKaelenCast<T extends Point & { id: string; isAlive: boolean; zhonyaActive?: boolean; untargetableTimer?: number }>(
  cast: KaelenCast, spell: KaelenInvokedSpell, dt: number, enemies: readonly T[],
): T[] {
  const before = kaelenCastPosition(cast, spell);
  const previousTime = cast.elapsed;
  cast.elapsed += dt;
  if (cast.resolved || cast.elapsed < spell.delay) return [];
  const after = kaelenCastPosition(cast, spell);
  const moving = spell.speed > 0;
  const dx = after.x - before.x, dy = after.y - before.y;
  const lengthSquared = dx * dx + dy * dy;
  const hits = enemies.filter(enemy => {
    if (!enemy.isAlive || enemy.zhonyaActive || (enemy.untargetableTimer ?? 0) > 0 || cast.hitIds.includes(enemy.id)) return false;
    const t = moving && lengthSquared > 0
      ? Math.max(0, Math.min(1, ((enemy.x - before.x) * dx + (enemy.y - before.y) * dy) / lengthSquared)) : 1;
    return Math.hypot(enemy.x - (before.x + dx * t), enemy.y - (before.y + dy * t)) <= after.radius + (moving ? 13 : 0);
  });
  cast.hitIds.push(...hits.map(enemy => enemy.id));
  if (!moving || previousTime >= spell.delay + spell.range / spell.speed || cast.elapsed >= spell.delay + spell.range / spell.speed) cast.resolved = true;
  return hits;
}
