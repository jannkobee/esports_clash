export type DecisiveActionKind =
  | 'champion'
  | 'structure'
  | 'minion'
  | 'camp'
  | 'objective'
  | 'defend'
  | 'regroup'
  | 'stage'
  | 'relic'
  | 'push'
  | 'hold';

export type ActionFailureReason = 'unavailable' | 'unsafe' | 'unreachable' | 'non-progressing';
export type ActionExecutionMode = 'move' | 'execute' | 'hold';

export interface DecisiveActionIntent {
  key: string;
  kind: DecisiveActionKind;
  targetId: string;
  targetX: number;
  targetY: number;
  contextKey: string;
  committedUntil: number;
  startedAt: number;
  lastProgressAt: number;
  lastX: number;
  lastY: number;
  bestDistance: number;
  mode: ActionExecutionMode;
  switchCount: number;
  switchWindowStartedAt: number;
}

export interface DecisiveActionFailure {
  key: string;
  reason: ActionFailureReason;
  contextKey: string;
  failedAt: number;
  retryAfter: number;
}

export interface DecisiveActionCandidate {
  id: string;
  x: number;
  y: number;
  contextKey: string;
  available?: boolean;
  safe?: boolean;
  reachable?: boolean;
}

const FAILURE_RETRY_SECONDS: Record<ActionFailureReason, number> = {
  unavailable: 0.65,
  unsafe: 1.6,
  unreachable: 2.4,
  'non-progressing': 1.35,
};

const MAX_CANDIDATES_PER_PASS = 12;
const MAX_FAILURE_RECORDS = 12;
const SWITCH_WINDOW_SECONDS = 2.4;
const REPEATED_SWITCH_THRESHOLD = 3;
const DEFAULT_COMMIT_SECONDS = 0.75;
const REPEATED_SWITCH_COMMIT_SECONDS = 1.15;
const NO_PROGRESS_SECONDS = 0.9;
const FAILURE_HISTORY_SECONDS = 8;

export function decisiveActionKey(kind: DecisiveActionKind, targetId: string): string {
  return `${kind}:${targetId}`;
}

export function pruneActionFailures(
  failures: readonly DecisiveActionFailure[] | undefined,
  now: number,
): DecisiveActionFailure[] {
  return (failures ?? []).filter(failure => failure.failedAt + FAILURE_HISTORY_SECONDS > now)
    .slice(-MAX_FAILURE_RECORDS);
}

export function recordActionFailure(
  failures: readonly DecisiveActionFailure[] | undefined,
  intent: Pick<DecisiveActionIntent, 'key' | 'contextKey'>,
  reason: ActionFailureReason,
  now: number,
): DecisiveActionFailure[] {
  const next = pruneActionFailures(failures, now).filter(failure => failure.key !== intent.key);
  next.push({
    key: intent.key,
    reason,
    contextKey: intent.contextKey,
    failedAt: now,
    retryAfter: now + FAILURE_RETRY_SECONDS[reason],
  });
  return next.slice(-MAX_FAILURE_RECORDS);
}

/** A material context change immediately releases a retry block. */
export function isActionRetryBlocked(
  failures: readonly DecisiveActionFailure[] | undefined,
  key: string,
  now: number,
  contextKey: string,
): boolean {
  return (failures ?? []).some(failure => failure.key === key
    && failure.retryAfter > now && failure.contextKey === contextKey);
}

/**
 * Keep a still-viable target for the commitment window. Candidate evaluation is
 * deliberately bounded and preserves caller order, so this layer neither adds
 * an unbounded decision pass nor consumes gameplay RNG.
 */
export function chooseCommittedActionTarget<T extends DecisiveActionCandidate>(input: {
  intent?: DecisiveActionIntent;
  kind: DecisiveActionKind;
  preferred?: T;
  candidates: readonly T[];
  failures?: readonly DecisiveActionFailure[];
  now: number;
}): T | undefined {
  const viable = input.candidates.slice(0, MAX_CANDIDATES_PER_PASS).filter(candidate =>
    candidate.available !== false && candidate.safe !== false && candidate.reachable !== false
    && !isActionRetryBlocked(input.failures, decisiveActionKey(input.kind, candidate.id),
      input.now, candidate.contextKey));
  const held = input.intent?.kind === input.kind && input.intent.committedUntil > input.now
    ? viable.find(candidate => candidate.id === input.intent?.targetId
      && candidate.contextKey === input.intent?.contextKey)
    : undefined;
  if (held) return held;
  if (input.preferred) {
    const preferred = viable.find(candidate => candidate.id === input.preferred?.id);
    if (preferred) return preferred;
  }
  return viable[0];
}

export function beginOrContinueAction(input: {
  intent?: DecisiveActionIntent;
  kind: DecisiveActionKind;
  target: { id: string; x: number; y: number };
  actor: { x: number; y: number };
  contextKey: string;
  mode: ActionExecutionMode;
  now: number;
  commitSeconds?: number;
}): DecisiveActionIntent {
  const key = decisiveActionKey(input.kind, input.target.id);
  const distance = Math.hypot(input.target.x - input.actor.x, input.target.y - input.actor.y);
  if (input.intent?.key === key) {
    return {
      ...input.intent,
      targetX: input.target.x,
      targetY: input.target.y,
      contextKey: input.contextKey,
      mode: input.mode,
    };
  }

  const insideSwitchWindow = !!input.intent
    && input.now - input.intent.switchWindowStartedAt <= SWITCH_WINDOW_SECONDS;
  const switchCount = insideSwitchWindow ? input.intent!.switchCount + 1 : 0;
  const switchWindowStartedAt = insideSwitchWindow
    ? input.intent!.switchWindowStartedAt : input.now;
  const commitSeconds = Math.max(input.commitSeconds ?? DEFAULT_COMMIT_SECONDS,
    switchCount >= REPEATED_SWITCH_THRESHOLD ? REPEATED_SWITCH_COMMIT_SECONDS : 0);
  return {
    key,
    kind: input.kind,
    targetId: input.target.id,
    targetX: input.target.x,
    targetY: input.target.y,
    contextKey: input.contextKey,
    committedUntil: input.now + commitSeconds,
    startedAt: input.now,
    lastProgressAt: input.now,
    lastX: input.actor.x,
    lastY: input.actor.y,
    bestDistance: Number.isFinite(distance) ? distance : Infinity,
    mode: input.mode,
    switchCount,
    switchWindowStartedAt,
  };
}

export function inspectActionProgress(input: {
  intent?: DecisiveActionIntent;
  failures?: readonly DecisiveActionFailure[];
  actor: { x: number; y: number };
  target?: { x: number; y: number };
  now: number;
  emergencyInterrupt: boolean;
  available: boolean;
  safe: boolean;
  reachable: boolean;
}): { intent?: DecisiveActionIntent; failures: DecisiveActionFailure[]; failedReason?: ActionFailureReason } {
  const failures = pruneActionFailures(input.failures, input.now);
  const intent = input.intent;
  if (!intent || input.emergencyInterrupt) return { intent: undefined, failures };

  const fail = (reason: ActionFailureReason) => ({
    intent: undefined,
    failures: recordActionFailure(failures, intent, reason, input.now),
    failedReason: reason,
  });
  if (!input.available || !input.target) return fail('unavailable');
  if (!input.safe) return fail('unsafe');
  if (!input.reachable) return fail('unreachable');

  const distance = Math.hypot(input.target.x - input.actor.x, input.target.y - input.actor.y);
  if (intent.mode !== 'move') {
    return { intent: { ...intent, targetX: input.target.x, targetY: input.target.y,
      lastProgressAt: input.now, lastX: input.actor.x, lastY: input.actor.y,
      bestDistance: Math.min(intent.bestDistance, distance) }, failures };
  }

  const actorProgress = Math.hypot(input.actor.x - intent.lastX, input.actor.y - intent.lastY);
  const targetProgress = intent.bestDistance - distance;
  if (actorProgress >= 4 || targetProgress >= 4) {
    return { intent: { ...intent, targetX: input.target.x, targetY: input.target.y,
      lastProgressAt: input.now, lastX: input.actor.x, lastY: input.actor.y,
      bestDistance: Math.min(intent.bestDistance, distance) }, failures };
  }
  if (input.now - intent.lastProgressAt >= NO_PROGRESS_SECONDS) return fail('non-progressing');
  return { intent: { ...intent, targetX: input.target.x, targetY: input.target.y }, failures };
}

export function isRepeatedlySwitching(intent: DecisiveActionIntent | undefined): boolean {
  return (intent?.switchCount ?? 0) >= REPEATED_SWITCH_THRESHOLD;
}
