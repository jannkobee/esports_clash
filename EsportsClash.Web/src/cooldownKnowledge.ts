export type TeamSide = 'blue' | 'red';
export type KnownSlot = 'skill1' | 'skill2' | 'ultimate';
export type CooldownSnapshot = Record<KnownSlot, number>;
export type EnemyCooldownMemory = Record<TeamSide, Record<string, Partial<Record<KnownSlot, number>>>>;

export const createEnemyCooldownMemory = (): EnemyCooldownMemory => ({ blue: {}, red: {} });

/** Record only cooldowns whose cast was visible to the opposing team. */
export function observeCooldownRise(memory: EnemyCooldownMemory, previous: CooldownSnapshot | undefined,
  actor: { id: string; team: TeamSide; cd1: number; cd2: number; cdUlt: number },
  second: number, witnessed: boolean, globallyHeardUltimate = false): CooldownSnapshot {
  const current = { skill1: actor.cd1, skill2: actor.cd2, ultimate: actor.cdUlt };
  if ((!witnessed && !globallyHeardUltimate) || !previous) return current;
  const viewer = actor.team === 'blue' ? 'red' : 'blue';
  for (const slot of ['skill1', 'skill2', 'ultimate'] as const) {
    if ((witnessed || (slot === 'ultimate' && globallyHeardUltimate))
      && current[slot] > previous[slot] + 0.35 && current[slot] > 0.75) {
      (memory[viewer][actor.id] ??= {})[slot] = second + current[slot];
    }
  }
  return current;
}

export function isObservedCooling(memory: Record<string, Partial<Record<KnownSlot, number>>> | undefined,
  enemyId: string, slot: KnownSlot, second: number): boolean {
  return (memory?.[enemyId]?.[slot] ?? 0) > second;
}
