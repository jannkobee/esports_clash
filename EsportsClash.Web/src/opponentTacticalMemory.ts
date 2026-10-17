export type MemoryTeam = 'blue' | 'red';

export interface OpponentTacticalMemoryEntry {
  focusTargetId?: string;
  focusUntil?: number;
  retreatingUntil?: number;
}
export type OpponentTacticalMemory = Record<MemoryTeam, Record<string, OpponentTacticalMemoryEntry>>;

export const createOpponentTacticalMemory = (): OpponentTacticalMemory => ({ blue: {}, red: {} });

/** Records only current visible motion and damage that the observing team saw. */
export function observeOpponentTacticalMemory(input: {
  memory: OpponentTacticalMemory;
  viewer: MemoryTeam;
  now: number;
  visibleOpponents: readonly { id: string; team: MemoryTeam; vx: number; vy: number }[];
  observedFocuses: readonly { attackerId: string; targetId: string; second: number }[];
}) {
  const entries = input.memory[input.viewer];
  const visibleIds = new Set(input.visibleOpponents.map(opponent => opponent.id));
  for (const opponent of input.visibleOpponents) {
    const entry = entries[opponent.id] ??= {};
    const homeDirection = opponent.team === 'blue' ? -1 : 1;
    if (Math.hypot(opponent.vx, opponent.vy) >= 25 && opponent.vx * homeDirection > 18)
      entry.retreatingUntil = input.now + .9;
  }
  for (const focus of input.observedFocuses) {
    if (input.now - focus.second > 2.5 || !visibleIds.has(focus.attackerId)) continue;
    const entry = entries[focus.attackerId] ??= {};
    entry.focusTargetId = focus.targetId;
    entry.focusUntil = input.now + .85;
  }
}

export function readOpponentTacticalMemory(memory: OpponentTacticalMemory, viewer: MemoryTeam,
  opponentId: string | undefined, actorId: string, now: number) {
  const entry = opponentId ? memory[viewer][opponentId] : undefined;
  return {
    retreating: !!entry && (entry.retreatingUntil ?? 0) > now,
    focusingActor: !!entry && entry.focusTargetId === actorId && (entry.focusUntil ?? 0) > now,
  };
}
