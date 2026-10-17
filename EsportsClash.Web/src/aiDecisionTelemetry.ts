export interface AIDecisionSnapshot {
  healthFraction: number;
  gold: number;
  cs: number;
  kills: number;
  deaths: number;
  damageDealt: number;
}

export interface AIDecisionOutcome {
  horizonSeconds: number;
  healthChange: number;
  goldGain: number;
  csGain: number;
  killGain: number;
  deathGain: number;
  damageGain: number;
  /** Bounded descriptive proxy. Never a proven causal reward. */
  progress: number;
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

const clamp = (value: number) => Math.max(-1, Math.min(1, value));

export function decisionOutcome(start: AIDecisionRecord, end: AIDecisionRecord): AIDecisionOutcome | undefined {
  const a = start.snapshot, b = end.snapshot;
  const horizonSeconds = end.second - start.second;
  if (!a || !b || start.actorId !== end.actorId || horizonSeconds < 2 || horizonSeconds > 6
    || !Object.values(a).every(Number.isFinite) || !Object.values(b).every(Number.isFinite)) return undefined;
  const healthChange = b.healthFraction - a.healthFraction;
  const goldGain = Math.max(0, b.gold - a.gold);
  const csGain = Math.max(0, b.cs - a.cs);
  const killGain = Math.max(0, b.kills - a.kills);
  const deathGain = Math.max(0, b.deaths - a.deaths);
  const damageGain = Math.max(0, b.damageDealt - a.damageDealt);
  const progress = clamp(Math.min(1, damageGain / 300) * .3 + Math.min(1, goldGain / 200) * .15
    + Math.min(1, csGain / 2) * .15 + Math.min(1, killGain) * .35
    - Math.min(1, deathGain) * .8 + clamp(healthChange) * .35);
  return { horizonSeconds, healthChange, goldGain, csGain, killGain, deathGain, damageGain, progress };
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

/** Evaluation assignments get a fixed follow-up even if no further macro decision is sampled. */
export function settleExperimentOutcome(records: AIDecisionRecord[], end: AIDecisionRecord) {
  for (let index = records.length - 1; index >= 0; index--) {
    const prior = records[index];
    if (end.second - prior.second > 6) break;
    if (prior.experiment && !prior.outcome && prior.actorId === end.actorId
      && end.second - prior.second >= 3) prior.outcome = decisionOutcome(prior, end);
  }
}
