import { scoreUtility } from './utilityDecision.ts';
import type { MacroActionCandidate, MacroActionKind } from './macroActionDecision.ts';
import type { AdaptiveAction } from './adaptivePolicy.ts';

const ACTIONS = new Set<MacroActionKind>(['fight', 'wave', 'regroup', 'farm', 'push']);
const isAction = (action: MacroActionKind): action is AdaptiveAction => ACTIONS.has(action);

/** Separate evaluation RNG; it never advances the match's gameplay RNG. */
export function createExperimentRandom(seed: number): () => number {
  let state = (Number.isFinite(seed) ? Math.floor(seed) : 1) >>> 0;
  if (!state) state = 1;
  return () => {
    state ^= state << 13;
    state ^= state >>> 17;
    state ^= state << 5;
    return (state >>> 0) / 4294967296;
  };
}

export interface MacroExperimentAssignment {
  selected: AdaptiveAction;
  incumbent: AdaptiveAction;
  alternate: AdaptiveAction;
  pair: string;
  arm: 'incumbent' | 'alternate';
  propensity: .5;
  utilityGap: number;
}

export interface SafeMacroExperimentInput {
  enabled: boolean;
  now: number;
  lastAssignmentSecond: number;
  healthFraction: number;
  dangerousFight: boolean;
  insideEnemyTower: boolean;
  objectiveFight: boolean;
  defending: boolean;
  influenceThreat: number;
  survival: number;
  enemyDistance: number;
  incumbent?: MacroActionKind;
  selectionReason: string;
  candidates: readonly MacroActionCandidate[];
  randomDraw: number;
}

function eligiblePair(input: SafeMacroExperimentInput): { incumbent: AdaptiveAction;
  alternate: AdaptiveAction; utilityGap: number } | undefined {
  const incumbent = input.incumbent;
  if (!incumbent || !isAction(incumbent)) return undefined;
  const first = input.candidates.find(candidate => candidate.action === incumbent && candidate.available);
  if (!first) return undefined;
  const firstScore = scoreUtility(first.factors, false);
  if (!firstScore.valid) return undefined;
  const alternatives = input.candidates.filter(candidate => candidate.available
    && candidate.action !== incumbent && isAction(candidate.action) && candidate.priority === first.priority)
    .map(candidate => ({ candidate, score: scoreUtility(candidate.factors, false) }))
    .filter(item => item.score.valid)
    .sort((a, b) => b.score.utility - a.score.utility);
  const other = alternatives[0];
  if (!other || !isAction(other.candidate.action)) return undefined;
  return { incumbent, alternate: other.candidate.action,
    utilityGap: Math.abs(firstScore.utility - other.score.utility) };
}

export function inspectSafeMacroExperiment(input: SafeMacroExperimentInput): {
  gates: string[]; pair?: { incumbent: AdaptiveAction; alternate: AdaptiveAction; utilityGap: number };
} {
  const gates: string[] = [];
  if (!input.enabled) gates.push('disabled');
  if (!Number.isFinite(input.now) || input.now - input.lastAssignmentSecond < 4) gates.push('cooldown');
  if (!Number.isFinite(input.healthFraction) || input.healthFraction < .7) gates.push('health');
  if (input.dangerousFight) gates.push('danger');
  if (input.insideEnemyTower) gates.push('tower');
  if (input.objectiveFight) gates.push('objective');
  if (input.defending) gates.push('defense');
  if (input.selectionReason !== 'utility') gates.push('commitment');
  const pair = eligiblePair(input);
  if (!pair) return { gates: [...gates, 'legal-pair'] };
  if (!Number.isFinite(input.influenceThreat) || input.influenceThreat > .7) gates.push('influence');
  if (pair.incumbent === 'fight' || pair.alternate === 'fight') {
    if (!Number.isFinite(input.survival) || input.survival < .55) gates.push('survival');
  } else if (Number.isNaN(input.enemyDistance) || input.enemyDistance < 180) gates.push('enemy-near');
  if (pair.utilityGap > .1) gates.push('utility-gap');
  return { gates, pair };
}

export function safeMacroExperimentGate(input: SafeMacroExperimentInput): string | undefined {
  return inspectSafeMacroExperiment(input).gates[0];
}

/** Evaluation fixture only: randomize between close, already-legal same-tier actions. */
export function assignSafeMacroExperiment(input: SafeMacroExperimentInput): MacroExperimentAssignment | undefined {
  if (safeMacroExperimentGate(input) || !Number.isFinite(input.randomDraw)
    || input.randomDraw < 0 || input.randomDraw >= 1) return undefined;
  const pair = eligiblePair(input);
  if (!pair) return undefined;
  const arm = input.randomDraw < .5 ? 'incumbent' : 'alternate';
  return { ...pair, selected: arm === 'incumbent' ? pair.incumbent : pair.alternate,
    pair: [pair.incumbent, pair.alternate].sort().join('-'), arm, propensity: .5 };
}
