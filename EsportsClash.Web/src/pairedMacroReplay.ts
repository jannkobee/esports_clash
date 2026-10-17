import type { MacroExperimentAssignment } from './safeMacroExperiment.ts';
import { loadAdaptivePolicy, type AdaptivePolicy } from './adaptivePolicy.ts';
import { loadTaskContextPolicy, type TaskContextPolicy } from './taskContextPolicy.ts';
import { loadConfidenceTaskPolicy, type ConfidenceTaskPolicy } from './taskConfidencePolicy.ts';

export interface PairedMacroTarget {
  actorId: string;
  second: number;
  incumbent: string;
  alternate: string;
  fingerprint: string;
  arm: 'incumbent' | 'alternate' | 'reward';
  horizonSeconds?: number;
  rewardPolicy?: AdaptivePolicy;
  rewardTaskPolicy?: TaskContextPolicy;
  rewardConfidencePolicy?: ConfidenceTaskPolicy;
}

/** Evaluation-only exact-predecision context digest. This is not a gameplay score. */
export const serializePairedState = (state: unknown): string | undefined =>
  JSON.stringify(state, (_key, item) => item instanceof Map
    ? { $map: [...item.entries()] } : item instanceof Set ? { $set: [...item.values()] } : item);

export function pairedStateFingerprint(state: unknown): string {
  const value = serializePairedState(state);
  if (!value) return 'unavailable';
  let first = 2166136261, second = 0x9e3779b9;
  for (let index = 0; index < value.length; index++) {
    const char = value.charCodeAt(index);
    first = Math.imul(first ^ char, 16777619);
    second = Math.imul(second ^ char, 2246822519);
  }
  return `${value.length}:${(first >>> 0).toString(16)}:${(second >>> 0).toString(16)}`;
}

export function parsePairedMacroTarget(raw: string | null): PairedMacroTarget | undefined {
  if (!raw) return undefined;
  try {
    const item: unknown = JSON.parse(raw);
    if (!item || typeof item !== 'object') return undefined;
    const target = item as Record<string, unknown>;
    if (typeof target.actorId !== 'string' || !/^(blue|red)_[a-zA-Z0-9_-]+$/.test(target.actorId)
      || typeof target.second !== 'number' || !Number.isFinite(target.second) || target.second < 0
      || typeof target.incumbent !== 'string' || typeof target.alternate !== 'string'
      || !['fight', 'wave', 'regroup', 'farm', 'push'].includes(target.incumbent)
      || !['fight', 'wave', 'regroup', 'farm', 'push'].includes(target.alternate)
      || target.incumbent === target.alternate
      || typeof target.fingerprint !== 'string' || !/^\d+:[0-9a-f]+:[0-9a-f]+$/.test(target.fingerprint)
      || (target.arm !== 'incumbent' && target.arm !== 'alternate' && target.arm !== 'reward')
      || (target.horizonSeconds !== undefined && (typeof target.horizonSeconds !== 'number'
        || !Number.isFinite(target.horizonSeconds) || target.horizonSeconds < 3
        || target.horizonSeconds > 30))) return undefined;
    if (target.arm === 'reward') {
      if ([target.rewardPolicy, target.rewardTaskPolicy, target.rewardConfidencePolicy]
        .filter(value => value !== undefined).length !== 1) return undefined;
      if (target.rewardConfidencePolicy) {
        const model = loadConfidenceTaskPolicy(target.rewardConfidencePolicy);
        if (!model) return undefined;
        return { ...target, rewardConfidencePolicy: model } as unknown as PairedMacroTarget;
      }
      if (target.rewardTaskPolicy) {
        const model = loadTaskContextPolicy(target.rewardTaskPolicy);
        if (!model || target.rewardPolicy) return undefined;
        return { ...target, rewardTaskPolicy: model } as unknown as PairedMacroTarget;
      }
      if (!target.rewardPolicy || typeof target.rewardPolicy !== 'object'
        || (target.rewardPolicy as { version?: number }).version !== 2
        || (target.rewardPolicy as { kind?: unknown }).kind !== undefined) return undefined;
      return { ...target, rewardPolicy: loadAdaptivePolicy(target.rewardPolicy) } as unknown as PairedMacroTarget;
    }
    return target as unknown as PairedMacroTarget;
  } catch { return undefined; }
}

export function pairedMacroTargetMatches(target: PairedMacroTarget, actorId: string, second: number,
  assignment: MacroExperimentAssignment, fingerprint: string): boolean {
  return target.actorId === actorId && Math.abs(target.second - second) < 1e-6
    && target.incumbent === assignment.incumbent && target.alternate === assignment.alternate
    && target.fingerprint === fingerprint;
}
