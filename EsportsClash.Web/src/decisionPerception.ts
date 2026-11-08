import type { AramChampionUnit } from './types';
import { SWEEPER_RADIUS, WARD_SPECS } from './visionRules.ts';

/** Recomputed per actor: earlier actors may kill, reveal, or recall this tick.
 * Keep this visibility policy distinct from short-range combat visibility.
 * Preserve roster order for deterministic target ties. Never cache live state.
 */
export function perceiveChampions(unit: AramChampionUnit, champions: readonly AramChampionUnit[],
  wards: readonly { team: string; bushId?: string; kind?: string; x?: number; y?: number; hp?: number; disabled?: boolean }[]) {
  const enemies: AramChampionUnit[] = [];
  const allies: AramChampionUnit[] = [];
  const localEnemies: AramChampionUnit[] = [];
  const localAllies: AramChampionUnit[] = [];
  const availableAllies: AramChampionUnit[] = [];
  for (const actor of champions) {
    if (!actor.isAlive) continue;
    const distance = Math.hypot(actor.x - unit.x, actor.y - unit.y);
    if (actor.team === unit.team) {
      allies.push(actor);
      const available = !actor.isRecalling && !actor.recallIntent && actor.committedState !== 'retreat';
      if (available) availableAllies.push(actor);
      if ((actor.id === unit.id || available) && distance <= 400) localAllies.push(actor);
    } else {
      const revealedByTrueSight =
        (actor.revealedTimer ?? 0) > 0 ||
        wards.some(w => w.team === unit.team && !w.disabled && (w.hp ?? 1) > 0 && w.kind === 'control' && w.x !== undefined && w.y !== undefined && Math.hypot(w.x - actor.x, w.y - actor.y) <= WARD_SPECS.control.visionRadius) ||
        champions.some(a => a.team === unit.team && a.isAlive && (a.sweeperTimer ?? 0) > 0 && Math.hypot(a.x - actor.x, a.y - actor.y) <= SWEEPER_RADIUS);
      const stealthOk = (actor.stealthTimer ?? 0) <= 0 || distance < 48 || revealedByTrueSight;
      const bushOk = !actor.isInBush || revealedByTrueSight
        || wards.some(w => w.team === unit.team && !w.disabled && (w.hp ?? 1) > 0 && w.bushId === actor.currentBushId)
        || champions.some(a => a.team === unit.team && a.isAlive && a.currentBushId === actor.currentBushId);
      if (stealthOk && bushOk) {
        enemies.push(actor);
        if (distance <= 400) localEnemies.push(actor);
      }
    }
  }
  return { enemies, allies, localEnemies, localAllies, availableAllies };
}
