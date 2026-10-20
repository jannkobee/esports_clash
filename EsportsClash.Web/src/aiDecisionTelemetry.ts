export interface AIDecisionSnapshot {
  healthFraction: number;
  gold: number;
  netWorth?: number;
  cs: number;
  kills: number;
  deaths: number;
  damageDealt: number;
  goldGap?: number;
  netWorthGap?: number;
  outnumbered?: number;
  isUnderTower?: number;
  combosExecuted?: number;
  combosLethal?: number;
  peelCount?: number;
  ccChainCount?: number;
  objectiveDamage?: number;
}

export interface AIDecisionOutcome {
  horizonSeconds: number;
  healthChange: number;
  goldGain: number;
  csGain: number;
  killGain: number;
  deathGain: number;
  damageGain: number;
  /** Bounded descriptive proxy [-1, 1]. Never a proven causal reward. */
  progress: number;
  wasGapped?: boolean;
  wasOutnumbered?: boolean;
  comboExecuted?: boolean;
  comboLethal?: boolean;
  peelOrRescue?: boolean;
  effectiveCcChain?: boolean;
  objectiveConversion?: boolean;
  gappedRecovery?: boolean;
  avoidableOverstay?: boolean;
  wastedCombo?: boolean;
  /** Dense shaped credit assignment score incorporating asymmetric death penalties and combo bonuses. */
  shapedReward?: number;
}

export interface AIDecisionRecord {
  second: number;
  actorId: string;
  team: 'blue' | 'red';
  selected?: string;
  contextKey?: string;
  /** Snapshot of the card and live context used by the learned preference. */
  features?: Readonly<Record<string, number>>;
  snapshot?: AIDecisionSnapshot;
  outcome?: AIDecisionOutcome;
  /** The zero-learned-factor selection using this exact candidate set and commitment. */
  zeroPolicySelected?: string;
  /** Optional offline incumbent selection from the same candidates and commitment. */
  referencePolicySelected?: string;
  experiment?: { incumbent: string; alternate: string;
    pair: string; arm: 'incumbent' | 'alternate';
    propensity: .5; utilityGap: number };
  experimentGate?: string;
  learnedSuppressedReason?: 'low-health' | 'dangerous-fight';
  selectionReason?: string;
  zeroPolicyReason?: string;
  heldAction?: string;
  candidates: readonly { key: string; available: boolean; priority?: string; reason: string;
    baselineUtility?: number; actualUtility?: number; learnedFactor?: number }[];
}

const clamp = (value: number, min = -1, max = 1) => Math.max(min, Math.min(max, Number.isFinite(value) ? value : 0));

/**
 * Consolidated canonical reward calculation.
 * Aligns with OpenAI Five / MOBA RL baselines (hero death: -1.0 to -1.5, kill: +1.0, peel: +0.5).
 * Prevents extreme diverging multipliers that cause permanent retreat or throw loops.
 */
export function computeDecisionOutcomeReward(
  outcome: AIDecisionOutcome,
  actorTeam: 'blue' | 'red',
  winner?: 'blue' | 'red'
): number {
  // 1. Hero Death Penalty: OpenAI Five baseline (-1.0 to -1.4)
  if (outcome.deathGain > 0) {
    let penalty = -1.2;
    if (outcome.wasGapped) penalty -= 0.3;       // reckless fight when behind
    if (outcome.wasOutnumbered) penalty -= 0.3;  // suicidal 1vX engage
    if (outcome.avoidableOverstay) penalty -= 0.2;
    if (winner && winner !== actorTeam) penalty -= 0.2;
    return Math.max(-2.5, penalty);
  }

  // 2. Combat & Objective Progress
  let reward = 0;
  if (outcome.killGain > 0) reward += 1.0 * outcome.killGain;
  if (outcome.damageGain > 0) reward += Math.min(0.6, (outcome.damageGain / 400) * 0.3);
  if (outcome.goldGain > 0) reward += Math.min(0.4, (outcome.goldGain / 300) * 0.2);
  if (outcome.csGain > 0) reward += Math.min(0.4, (outcome.csGain / 2) * 0.2);
  if (outcome.healthChange !== 0) reward += clamp(outcome.healthChange, -1, 1) * 0.25;

  // 3. Ability Combo Execution
  if (outcome.comboExecuted) {
    reward += outcome.comboLethal ? 1.8 : 1.2;
  }

  // 4. Tactical Signals with Anti-Farming Verification
  if (outcome.peelOrRescue) reward += 0.5;
  if (outcome.effectiveCcChain) reward += 0.4;
  if (outcome.objectiveConversion) reward += 0.8;
  if (outcome.gappedRecovery) reward += 0.6; // active CS/defense under tower while gapped
  if (outcome.wastedCombo) reward -= 0.4;

  // 5. Team Victory Contribution
  if (winner) {
    reward += (actorTeam === winner ? 0.35 : -0.35);
  }

  return Math.max(-2.5, Math.min(3.0, reward));
}

export function decisionOutcome(
  start: AIDecisionRecord,
  end: AIDecisionRecord,
  options?: { allowShortOnDeath?: boolean }
): AIDecisionOutcome | undefined {
  const a = start.snapshot, b = end.snapshot;
  const horizonSeconds = Math.round((end.second - start.second) * 100) / 100;
  const baseKeys: (keyof AIDecisionSnapshot)[] = ['healthFraction', 'gold', 'cs', 'kills', 'deaths', 'damageDealt'];
  if (!a || !b || start.actorId !== end.actorId
    || !baseKeys.every(k => Number.isFinite(a[k]) && Number.isFinite(b[k]))) return undefined;

  const deathGain = Math.max(0, b.deaths - a.deaths);
  const minHorizon = (deathGain > 0 && options?.allowShortOnDeath) ? 0.5 : 2;
  if (horizonSeconds < minHorizon || horizonSeconds > 6) return undefined;

  const healthChange = b.healthFraction - a.healthFraction;
  const goldGain = Math.max(0, b.gold - a.gold);
  const csGain = Math.max(0, b.cs - a.cs);
  const killGain = Math.max(0, b.kills - a.kills);
  const damageGain = Math.max(0, b.damageDealt - a.damageDealt);

  const wasGapped = (a.netWorthGap !== undefined ? a.netWorthGap < -1000 : (a.goldGap ?? 0) < -1000);
  const wasOutnumbered = (a.outnumbered ?? 0) > 0;
  const comboExecuted = (b.combosExecuted ?? 0) > (a.combosExecuted ?? 0);
  const comboLethal = (b.combosLethal ?? 0) > (a.combosLethal ?? 0);
  const peelOrRescue = (b.peelCount ?? 0) > (a.peelCount ?? 0);
  const effectiveCcChain = (b.ccChainCount ?? 0) > (a.ccChainCount ?? 0);
  const objectiveConversion = (b.objectiveDamage ?? 0) > (a.objectiveDamage ?? 0) + 150;
  const gappedRecovery = wasGapped && deathGain === 0 && (csGain > 0 || goldGain > 80);
  const avoidableOverstay = deathGain > 0 && wasOutnumbered && (a.isUnderTower ?? 0) > 0;

  const outcome: AIDecisionOutcome = {
    horizonSeconds,
    healthChange,
    goldGain,
    csGain,
    killGain,
    deathGain,
    damageGain,
    progress: 0,
    wasGapped,
    wasOutnumbered,
    comboExecuted,
    comboLethal,
    peelOrRescue,
    effectiveCcChain,
    objectiveConversion,
    gappedRecovery,
    avoidableOverstay,
  };

  outcome.shapedReward = computeDecisionOutcomeReward(outcome, start.team);
  outcome.progress = clamp(outcome.shapedReward / 2.0, -1, 1);
  return outcome;
}

/** Sample persistent decisions so the ring spans useful match time instead of 240 render ticks. */
export function shouldRecordAIDecision(records: readonly AIDecisionRecord[], record: AIDecisionRecord): boolean {
  if (record.experiment) return true;
  const previous = records.findLast(item => item.actorId === record.actorId);
  if (previous && record.second - previous.second < 2 && previous.selected === record.selected
    && previous.contextKey === record.contextKey && previous.candidates.length === record.candidates.length
    && previous.candidates.every((item, index) => item.key === record.candidates[index].key
      && item.available === record.candidates[index].available)) return false;
  return true;
}

export function recordAIDecision(records: AIDecisionRecord[], record: AIDecisionRecord, limit = 240) {
  if (!shouldRecordAIDecision(records, record)) return;
  for (let index = records.length - 1; index >= 0; index--) {
    const prior = records[index];
    if (record.second - prior.second > 6) break;
    if (prior.actorId === record.actorId && !prior.outcome && !prior.experiment)
      prior.outcome = decisionOutcome(prior, record);
  }
  records.push(record);
  if (records.length > limit) records.splice(0, records.length - limit);
}

/**
 * Evaluates pending decisions at simulation clock intervals, on champion death,
 * or at terminal match end, guaranteeing decisions are not lost to respawn timers.
 */
export function settlePendingAIDecisions(
  records: AIDecisionRecord[],
  currentSecond: number,
  currentSnapshots: Map<string, AIDecisionSnapshot>,
  options: { forceTerminal?: boolean; actorDied?: string } = {}
): void {
  for (let index = records.length - 1; index >= 0; index--) {
    const prior = records[index];
    if (prior.outcome) continue;
    const snapshot = currentSnapshots.get(prior.actorId);
    if (!snapshot) continue;
    const elapsed = currentSecond - prior.second;
    if (elapsed > 6.5) break;

    const isActorDeath = options.actorDied === prior.actorId || ((snapshot.deaths ?? 0) > (prior.snapshot?.deaths ?? 0));
    const isTargetHorizon = elapsed >= 4.5;
    const isTerminal = Boolean(options.forceTerminal) && elapsed >= 0.5;

    if (isActorDeath || isTargetHorizon || isTerminal) {
      const syntheticEnd: AIDecisionRecord = {
        second: currentSecond,
        actorId: prior.actorId,
        team: prior.team,
        candidates: [],
        snapshot,
      };
      prior.outcome = decisionOutcome(prior, syntheticEnd, { allowShortOnDeath: isActorDeath });
    }
  }
}

/** Evaluation assignments get a fixed follow-up even if no further macro decision is sampled. */
export function settleExperimentOutcome(records: AIDecisionRecord[], end: AIDecisionRecord) {
  for (let index = records.length - 1; index >= 0; index--) {
    const prior = records[index];
    if (end.second - prior.second > 6) break;
    if (prior.experiment && !prior.outcome && prior.actorId === end.actorId
      && end.second - prior.second >= 3) prior.outcome = decisionOutcome(prior, end);
  }
}
