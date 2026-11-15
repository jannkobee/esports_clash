import type { FpsPoint } from './fpsSpatialWorld.ts';

export type LiveBlackboardKind =
  | 'smoke_lineup'
  | 'throw_utility'
  | 'hold_lane'
  | 'entry_space'
  | 'trade_follow'
  | 'lurk_cut'
  | 'probe_lane'
  | 'cover_plant'
  | 'defuse_bomb'
  | 'cover_defuser';

export interface LiveBlackboardClaim {
  actorId: string;
  kind: LiveBlackboardKind;
  key: string;
  point: FpsPoint;
  until: number;
  priority: number;
}

export interface LiveTacticalBlackboard {
  claims: Map<string, LiveBlackboardClaim>;
}

const ASSIGNMENT_KINDS: ReadonlySet<LiveBlackboardKind> = new Set([
  'hold_lane',
  'entry_space',
  'trade_follow',
  'lurk_cut',
  'probe_lane',
  'cover_plant',
  'defuse_bomb',
  'cover_defuser',
]);

const DEFAULT_EXCLUSIVE_KINDS: ReadonlySet<LiveBlackboardKind> = new Set([
  'smoke_lineup',
  'throw_utility',
  'defuse_bomb',
]);

export function createTacticalBlackboard(): LiveTacticalBlackboard {
  return { claims: new Map() };
}

export function resetTacticalBlackboard(board: LiveTacticalBlackboard): void {
  board.claims.clear();
}

export function purgeBlackboard(board: LiveTacticalBlackboard, now: number): void {
  for (const [id, claim] of board.claims) {
    if (claim.until <= now) board.claims.delete(id);
  }
}

export function postBlackboardClaim(
  board: LiveTacticalBlackboard,
  claim: LiveBlackboardClaim,
  now: number,
  exclusive = DEFAULT_EXCLUSIVE_KINDS.has(claim.kind),
): boolean {
  if (claim.until <= now) return false;
  purgeBlackboard(board, now);

  if (exclusive) {
    for (const [existingKey, existing] of board.claims) {
      if (existing.actorId === claim.actorId) continue;
      if (existing.kind === claim.kind && existing.key === claim.key) {
        if (existing.priority >= claim.priority) return false;
        board.claims.delete(existingKey);
      }
    }
  }

  // Keep at most one active tactical assignment claim per actor so lane switches release prior claims cleanly.
  if (ASSIGNMENT_KINDS.has(claim.kind)) {
    for (const [existingKey, existing] of board.claims) {
      if (existing.actorId === claim.actorId && ASSIGNMENT_KINDS.has(existing.kind) && existing.kind !== claim.kind) {
        board.claims.delete(existingKey);
      }
    }
  }

  board.claims.set(`${claim.actorId}:${claim.kind}`, {
    ...claim,
    point: { ...claim.point },
  });
  return true;
}

export function releaseActorBlackboard(
  board: LiveTacticalBlackboard,
  actorId: string,
  kinds?: readonly LiveBlackboardKind[],
): void {
  const filter = kinds ? new Set(kinds) : undefined;
  for (const [id, claim] of board.claims) {
    if (claim.actorId !== actorId) continue;
    if (!filter || filter.has(claim.kind)) board.claims.delete(id);
  }
}

export function hasBlackboardClaim(
  board: LiveTacticalBlackboard,
  kind: LiveBlackboardKind,
  key: string,
  now: number,
  excludeActorId?: string,
): boolean {
  for (const [id, claim] of board.claims) {
    if (claim.until <= now) {
      board.claims.delete(id);
      continue;
    }
    if (excludeActorId && claim.actorId === excludeActorId) continue;
    if (claim.kind === kind && claim.key === key) return true;
  }
  return false;
}

export function countBlackboardClaims(
  board: LiveTacticalBlackboard,
  kind: LiveBlackboardKind,
  keyPrefix: string,
  now: number,
  excludeActorId?: string,
): number {
  let count = 0;
  for (const [id, claim] of board.claims) {
    if (claim.until <= now) {
      board.claims.delete(id);
      continue;
    }
    if (excludeActorId && claim.actorId === excludeActorId) continue;
    if (claim.kind === kind && claim.key.startsWith(keyPrefix)) count++;
  }
  return count;
}

export function blackboardClaimedPoints(
  board: LiveTacticalBlackboard,
  now: number,
  excludeActorId?: string,
  kinds?: readonly LiveBlackboardKind[],
): FpsPoint[] {
  const filter = kinds ? new Set(kinds) : undefined;
  const points: FpsPoint[] = [];
  for (const [id, claim] of board.claims) {
    if (claim.until <= now) {
      board.claims.delete(id);
      continue;
    }
    if (excludeActorId && claim.actorId === excludeActorId) continue;
    if (!filter || filter.has(claim.kind)) points.push(claim.point);
  }
  return points;
}
