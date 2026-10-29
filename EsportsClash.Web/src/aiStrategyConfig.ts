import type { MacroActionCandidate } from './macroActionDecision.ts';

/** Strategy only. No action availability, tiers, commitments or combat rules. */
export interface AIStrategyConfig {
  kind: 'macro-strategy'; version: 1;
  farmStrategic: number; farmTactical: number; farmConversionTactical: number;
  pushStrategic: number; pushTempoStrategic: number;
}
export const AI_STRATEGY_BOUNDS = Object.freeze({ farmStrategic: [.32, .52], farmTactical: [.26, .46],
  farmConversionTactical: [.55, .75], pushStrategic: [.08, .28], pushTempoStrategic: [.52, .72] } as const);
export const DEFAULT_AI_STRATEGY: Readonly<AIStrategyConfig> = Object.freeze({ kind: 'macro-strategy', version: 1,
  farmStrategic: .42, farmTactical: .36, farmConversionTactical: .65, pushStrategic: .18, pushTempoStrategic: .62 });

export function loadAIStrategyConfig(raw: unknown): AIStrategyConfig | undefined {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return undefined;
  const item = raw as AIStrategyConfig;
  const keys = Object.keys(AI_STRATEGY_BOUNDS) as (keyof typeof AI_STRATEGY_BOUNDS)[];
  if (item.kind !== 'macro-strategy' || item.version !== 1 || Object.keys(item).length !== keys.length + 2
    || !keys.every(key => Object.hasOwn(item, key) && typeof item[key] === 'number' && Number.isFinite(item[key])
      && item[key] >= AI_STRATEGY_BOUNDS[key][0] && item[key] <= AI_STRATEGY_BOUNDS[key][1])
    || item.farmConversionTactical < item.farmTactical + .09 || item.pushTempoStrategic < item.pushStrategic + .2) return undefined;
  return { ...item };
}

/** Preserve every caller-owned legality and survival gate and personality term.
 * Defaults reproduce the existing factors bit for bit. */
export function configureMacroStrategy<T extends MacroActionCandidate>(candidates: readonly T[], config: AIStrategyConfig,
  context: { tempoPush: boolean; postFightFarm: boolean }): T[] {
  return candidates.map(candidate => {
    if (!candidate.available || candidate.priority !== 'optional') return candidate;
    if (candidate.action === 'farm') return { ...candidate, factors: { ...candidate.factors,
      strategic: config.farmStrategic, tactical: context.postFightFarm ? config.farmConversionTactical : config.farmTactical } };
    if (candidate.action === 'push') return { ...candidate, factors: { ...candidate.factors,
      strategic: context.tempoPush ? config.pushTempoStrategic : config.pushStrategic } };
    return candidate;
  });
}
