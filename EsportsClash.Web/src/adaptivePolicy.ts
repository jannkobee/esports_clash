import type { AIDecisionRecord } from './aiDecisionTelemetry.ts';
import type { ChampionKit, PlayerCard } from './types.ts';

export type AdaptiveAction = 'fight' | 'wave' | 'regroup' | 'farm' | 'push';
export type AdaptiveFeatures = Record<string, number>;
export interface AdaptivePolicy { version: 2; matches: number; weights: Record<AdaptiveAction, AdaptiveFeatures>; }
const ACTIONS: AdaptiveAction[] = ['fight', 'wave', 'regroup', 'farm', 'push'];
const clamp = (value: number) => Math.max(-1, Math.min(1, value));
const unit = (value: number) => Number.isFinite(value) ? Math.max(0, Math.min(1, value)) : 0;
const isAction = (key: string): key is AdaptiveAction => ACTIONS.includes(key as AdaptiveAction);
const featureKey = (key: string) => /^(bias|iq|teamfight|lane|flexibility|health|mana|roleFit|role:(Tank|Mage|Marksman|Support|Fighter|Assassin)|personality:[a-z_]+|card:[a-zA-Z0-9_-]+)$/.test(key);

export const createAdaptivePolicy = (): AdaptivePolicy => ({ version: 2, matches: 0,
  weights: { fight: {}, wave: {}, regroup: {}, farm: {}, push: {} } });

/** Treat browser storage as untrusted; migrate the previous global-only policy. */
export function loadAdaptivePolicy(value: unknown): AdaptivePolicy {
  const policy = createAdaptivePolicy();
  if (!value || typeof value !== 'object') return policy;
  const input = value as { version?: unknown; matches?: unknown; weights?: unknown };
  if ((input.version !== 1 && input.version !== 2) || !input.weights || typeof input.weights !== 'object') return policy;
  policy.matches = typeof input.matches === 'number' && Number.isFinite(input.matches)
    ? Math.max(0, Math.min(100000, Math.floor(input.matches))) : 0;
  const weights = input.weights as Record<string, unknown>;
  for (const action of ACTIONS) {
    const source = weights[action];
    if (input.version === 1) {
      if (typeof source === 'number' && Number.isFinite(source)) policy.weights[action].bias = clamp(source);
    } else if (source && typeof source === 'object') {
      for (const [key, weight] of Object.entries(source).slice(0, 128))
        if (featureKey(key) && typeof weight === 'number' && Number.isFinite(weight))
          policy.weights[action][key] = clamp(weight);
    }
  }
  return policy;
}

/** Card identity, attributes, role fit, personalities, and current resources are context, never combat stats. */
export function adaptiveFeatures(player: PlayerCard, champion: ChampionKit, healthFraction: number, manaFraction: number): AdaptiveFeatures {
  const role = champion.primaryRole;
  const preferred = player.preferredRole ?? player.role;
  const fit = preferred === role ? 1 : player.playableRoles?.includes(role) ? .65
    : champion.secondaryRole && (preferred === champion.secondaryRole || player.playableRoles?.includes(champion.secondaryRole)) ? .4 : 0;
  const features: AdaptiveFeatures = {
    bias: 1, iq: unit(player.stats.iq / 100), teamfight: unit(player.stats.tf / 100),
    lane: unit(player.stats.lan / 100), flexibility: unit(player.stats.flx / 100),
    health: unit(healthFraction), mana: unit(manaFraction), roleFit: fit,
    [`role:${role}`]: 1,
  };
  if (/^[a-zA-Z0-9_-]+$/.test(player.id)) features[`card:${player.id}`] = 1;
  if (player.primaryPersonality) features[`personality:${player.primaryPersonality}`] = 1;
  if (player.secondaryPersonality) features[`personality:${player.secondaryPersonality}`] = .5;
  return features;
}

export function adaptivePolicyScore(policy: AdaptivePolicy, action: AdaptiveAction, features: AdaptiveFeatures): number {
  const weights = policy.weights[action];
  let score = 0;
  for (const [key, value] of Object.entries(features))
    if (featureKey(key) && Number.isFinite(value)) score += (weights[key] ?? 0) * clamp(value);
  return clamp(score);
}

/** Learned preferences must not decide marginal macro choices during an urgent survival window. */
export function adaptivePreferenceAllowed(healthFraction: number, dangerousFight: boolean): boolean {
  return Number.isFinite(healthFraction) && healthFraction >= .3 && !dangerousFight;
}

/** One bounded contrastive update per actor/match. Winner is a weak proxy, not proof each action was good. */
export function trainAdaptivePolicy(policy: AdaptivePolicy, records: readonly AIDecisionRecord[], winner: 'blue' | 'red'): AdaptivePolicy {
  const next = loadAdaptivePolicy(policy);
  next.matches++;
  const eligible = records.filter(record => record.selected && isAction(record.selected)
    && record.features && record.candidates.some(candidate => candidate.key === record.selected && candidate.available)
    && record.candidates.some(candidate => candidate.key !== record.selected && isAction(candidate.key)
      && candidate.available && candidate.priority === record.candidates.find(item => item.key === record.selected)?.priority));
  const actorCounts = new Map<string, number>();
  for (const record of eligible) actorCounts.set(record.actorId, (actorCounts.get(record.actorId) ?? 0) + 1);
  for (const record of eligible) {
    const selected = record.selected as AdaptiveAction;
    const tier = record.candidates.find(candidate => candidate.key === selected)?.priority;
    const alternatives = record.candidates.filter(candidate => candidate.key !== selected && isAction(candidate.key)
      && candidate.available && candidate.priority === tier);
    const reward = record.team === winner ? 1 : -1;
    const step = .02 * reward / (actorCounts.get(record.actorId) ?? 1);
    for (const [key, rawValue] of Object.entries(record.features ?? {})) {
      if (!featureKey(key) || !Number.isFinite(rawValue)) continue;
      const value = clamp(rawValue);
      next.weights[selected][key] = clamp((next.weights[selected][key] ?? 0) + step * value);
      for (const alternative of alternatives) {
        const action = alternative.key as AdaptiveAction;
        next.weights[action][key] = clamp((next.weights[action][key] ?? 0) - step * value / alternatives.length);
      }
    }
  }
  return next;
}
