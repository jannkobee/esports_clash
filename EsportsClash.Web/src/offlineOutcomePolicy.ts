import { loadAdaptivePolicy, type AdaptiveAction, type AdaptivePolicy } from './adaptivePolicy.ts';
import type { AIDecisionRecord } from './aiDecisionTelemetry.ts';

const actions = new Set<AdaptiveAction>(['fight', 'wave', 'regroup', 'farm', 'push']);
const isAction = (value: string): value is AdaptiveAction => actions.has(value as AdaptiveAction);
const clamp = (value: number, limit: number) => Math.max(-limit, Math.min(limit, value));

export interface OfflineOutcomeFit {
  policy: AdaptivePolicy;
  eligible: number;
  independent: number;
  comparableGroups: number;
  comparedSamples: number;
  byAction: Partial<Record<AdaptiveAction, number>>;
}

/** Observational candidate only. Different selected actions must share an actor, legal set, tier, and health band. */
export function fitOfflineOutcomePolicy(start: AdaptivePolicy, records: readonly AIDecisionRecord[]): OfflineOutcomeFit {
  const policy = loadAdaptivePolicy(start);
  const base = loadAdaptivePolicy(start);
  const grouped = new Map<string, AIDecisionRecord[]>();
  const lastAccepted = new Map<string, number>();
  const byAction: Partial<Record<AdaptiveAction, number>> = {};
  let eligible = 0;
  let independent = 0;
  for (const record of [...records].sort((a, b) => a.second - b.second)) {
    const selected = record.selected;
    if (!selected || !isAction(selected) || !record.outcome || record.learnedSuppressedReason
      || !record.features || !record.snapshot || record.snapshot.healthFraction < .3
      || !Number.isFinite(record.outcome.progress) || !Number.isFinite(record.outcome.horizonSeconds)
      || record.outcome.horizonSeconds < 2 || record.outcome.horizonSeconds > 6) continue;
    const chosen = record.candidates.find(candidate => candidate.key === selected && candidate.available);
    if (!chosen) continue;
    const peers = record.candidates.filter(candidate => candidate.available && candidate.priority === chosen.priority
      && isAction(candidate.key)).map(candidate => candidate.key).sort();
    if (peers.length < 2) continue;
    eligible++;
    // Outcomes of adjacent samples overlap. Retain at most one four-second window per actor.
    if (record.second - (lastAccepted.get(record.actorId) ?? -Infinity) < 4) continue;
    lastAccepted.set(record.actorId, record.second);
    independent++;
    byAction[selected] = (byAction[selected] ?? 0) + 1;
    const band = Math.min(3, Math.floor(record.snapshot.healthFraction * 4));
    const key = `${record.actorId}|${chosen.priority}|${peers.join(',')}|${band}`;
    const group = grouped.get(key) ?? [];
    group.push(record);
    grouped.set(key, group);
  }

  let comparableGroups = 0;
  let comparedSamples = 0;
  const updates: { action: AdaptiveAction; features: Readonly<Record<string, number>>; effect: number }[] = [];
  for (const group of grouped.values()) {
    const byChoice = new Map<AdaptiveAction, AIDecisionRecord[]>();
    for (const record of group) {
      const action = record.selected as AdaptiveAction;
      const samples = byChoice.get(action) ?? [];
      samples.push(record);
      byChoice.set(action, samples);
    }
    const comparable = [...byChoice].filter(([, samples]) => samples.length >= 3);
    if (comparable.length < 2) continue;
    comparableGroups++;
    comparedSamples += comparable.reduce((sum, [, samples]) => sum + samples.length, 0);
    const means = comparable.map(([action, samples]) => ({ action, samples,
      mean: samples.reduce((sum, item) => sum + item.outcome!.progress / item.outcome!.horizonSeconds, 0) / samples.length }));
    const center = means.reduce((sum, item) => sum + item.mean, 0) / means.length;
    for (const { action, samples, mean } of means) {
      // Cap an observed association. Do not treat passive gold or a local outcome as causal credit.
      const effect = clamp(mean - center, .2);
      const representative = samples[Math.floor(samples.length / 2)];
      updates.push({ action, features: representative.features!, effect });
    }
  }
  if (updates.length) {
    const scale = 2 / updates.length;
    for (const update of updates) for (const [key, value] of Object.entries(update.features)) {
      if (!Number.isFinite(value) || !Object.hasOwn(policy.weights[update.action], key)
        && !/^(bias|iq|teamfight|lane|flexibility|health|mana|roleFit|role:(Tank|Mage|Marksman|Support|Fighter|Assassin)|personality:[a-z_]+|card:[a-zA-Z0-9_-]+)$/.test(key)) continue;
      const initial = base.weights[update.action][key] ?? 0;
      const proposed = (policy.weights[update.action][key] ?? 0) + update.effect * scale * clamp(value, 1);
      policy.weights[update.action][key] = clamp(initial + clamp(proposed - initial, .12), 1);
    }
  }
  return { policy, eligible,
    independent, comparableGroups, comparedSamples, byAction };
}
