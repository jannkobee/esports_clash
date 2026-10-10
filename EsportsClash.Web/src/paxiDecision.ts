export function shouldPaxiEscapeJaunt(actor: { x: number; y: number; hp: number; maxHp: number },
  orb: { x: number; y: number }, enemies: readonly { x: number; y: number }[], wellX: number): boolean {
  if (actor.hp / actor.maxHp > 0.48 || enemies.length === 0) return false;
  const currentThreat = Math.min(...enemies.map(enemy => Math.hypot(actor.x - enemy.x, actor.y - enemy.y)));
  const orbThreat = Math.min(...enemies.map(enemy => Math.hypot(orb.x - enemy.x, orb.y - enemy.y)));
  return Math.abs(wellX - orb.x) + 40 < Math.abs(wellX - actor.x)
    && orbThreat > currentThreat + 30;
}
