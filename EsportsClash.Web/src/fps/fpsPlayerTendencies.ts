import catalog from './fps-player-tendencies-v4.json' with { type: 'json' };
import { fpsBehaviorPreferences, fpsIdentityHash, type FpsPersonality, type FpsObservedBehavior, type FpsBehaviorMetric } from './fpsPlayerArchitecture.ts';
import type { FpsCoach, FpsGameplan, FpsTeamChemistry } from './fpsIdentity.ts';

export interface FpsTendencyDefinition {
  key: string;
  label: string;
  high: string;
  low: string;
}

export interface FpsTendencyCategory {
  id: string;
  label: string;
  tendencies: readonly FpsTendencyDefinition[];
}

export interface FpsIglPreset {
  id: string;
  name: string;
  summary: string;
  weakness: string;
  values: Record<string, number>;
}

export const FPS_TENDENCY_CATALOG = catalog as unknown as {
  version: number;
  iglCategories: readonly FpsTendencyCategory[];
  individualCategories: readonly FpsTendencyCategory[];
  iglPresets: readonly FpsIglPreset[];
};

export const FPS_IGL_TENDENCIES: readonly (FpsTendencyDefinition & { category: string })[] =
  FPS_TENDENCY_CATALOG.iglCategories.flatMap(cat => cat.tendencies.map(t => ({ ...t, category: cat.id })));

export const FPS_INDIVIDUAL_TENDENCIES: readonly (FpsTendencyDefinition & { category: string })[] =
  FPS_TENDENCY_CATALOG.individualCategories.flatMap(cat => cat.tendencies.map(t => ({ ...t, category: cat.id })));

export const FPS_ALL_TENDENCY_KEYS: readonly string[] = [
  ...FPS_IGL_TENDENCIES.map(t => t.key),
  ...FPS_INDIVIDUAL_TENDENCIES.map(t => t.key),
];

export type FpsTendencyValues = Record<string, number>;

export interface FpsTendencyContext {
  coach?: Partial<FpsCoach>;
  plan?: Partial<FpsGameplan>;
  chemistry?: Partial<FpsTeamChemistry>;
  familiarity?: number;
  isIgl?: boolean;
  /** Current lawful situational pressure 0..1 (clutch, outnumbered, objective timer). */
  pressure?: number;
  /** Personality pressure sensitivity 0..1 (fpsBehaviorPreferences). */
  pressureSensitivity?: number;
}

const PRESSURE_IMPULSIVE = new Set(['wideSwing', 'repeekPersistence', 'duelInitiative', 'smokeSpam', 'sprayCommitment', 'desperationCommitment', 'clutchAggression', 'outnumberedRisk']);
const PRESSURE_COMPOSED = new Set(['playDiscipline', 'triggerPatience', 'informationVerification', 'clutchPatience', 'angleIsolation', 'timeManagement']);

const clamp100 = (n: number) => Math.round(Math.max(0, Math.min(100, n)));
const clamp01 = (n: number) => Math.max(0, Math.min(1, n));

type DnaLike = {
  riskTolerance: number;
  emotionalStability: number;
  coachability: number;
  tacticalDiscipline: number;
  adaptability: number;
  creativity: number;
  confidenceVolatility: number;
  socialTrust: number;
  leadershipInitiative: number;
  competitiveDrive: number;
  teamOrientation: number;
  preparationPreference: number;
};

const DEFAULT_DNA: DnaLike = {
  riskTolerance: 50,
  emotionalStability: 50,
  coachability: 50,
  tacticalDiscipline: 50,
  adaptability: 50,
  creativity: 50,
  confidenceVolatility: 50,
  socialTrust: 50,
  leadershipInitiative: 50,
  competitiveDrive: 50,
  teamOrientation: 50,
  preparationPreference: 50,
};

/**
 * Deterministic 0–100 natural tendency derivation from 4D personality and stable DNA.
 * Never reads attributes (Rifling, Sniping, Entry, Utility, Positioning, Shotcalling) or K/D.
 */
export function deriveFpsTendencies(
  personality: FpsPersonality,
  dnaInput?: Partial<DnaLike>,
  overrides?: Record<string, number>,
): FpsTendencyValues {
  const p = fpsBehaviorPreferences(personality);
  const d: DnaLike = { ...DEFAULT_DNA, ...dnaInput };
  const dnaSig = `${d.riskTolerance}:${d.creativity}:${d.tacticalDiscipline}:${d.teamOrientation}:${d.leadershipInitiative}:${d.adaptability}`;
  const init = p.initiative * 100;
  const coord = p.coordination * 100;
  const delib = p.deliberation * 100;
  const reass = p.reassessment * 100;
  const press = p.pressureSensitivity * 100;
  const inst = (1 - p.deliberation) * 100;
  const indiv = (1 - p.coordination) * 100;

  const jitter = (key: string, span = 14) => {
    const h = fpsIdentityHash(`${personality.id}:${dnaSig}:${key}`);
    return ((h % 1000) / 999 - 0.5) * span;
  };

  // Category-grounded weights so every catalog channel reflects personality + DNA naturally,
  // while allowing independent habits (e.g. wideSwing & jigglePeek) to coexist.
  const base: Record<string, number> = {
    // IGL A: Tactical calling
    structuredCalling: 0.45 * delib + 0.25 * coord + 0.30 * d.tacticalDiscipline,
    defaultPreference: 0.50 * delib + 0.25 * (100 - init) + 0.25 * d.preparationPreference,
    rushCalling: 0.50 * init + 0.25 * inst + 0.25 * d.riskTolerance,
    contactCalling: 0.40 * (100 - init) + 0.30 * d.creativity + 0.30 * inst,
    splitCalling: 0.35 * reass + 0.35 * d.creativity + 0.30 * coord,
    fakeCalling: 0.40 * d.creativity + 0.35 * reass + 0.25 * delib,
    utilityHeavyCalling: 0.45 * delib + 0.35 * coord + 0.20 * d.preparationPreference,
    mapControlCalling: 0.40 * delib + 0.35 * d.preparationPreference + 0.25 * coord,
    pickBasedCalling: 0.45 * init + 0.30 * indiv + 0.25 * d.riskTolerance,
    lateRoundCalling: 0.50 * delib + 0.30 * (100 - init) + 0.20 * d.emotionalStability,
    tacticalComplexity: 0.45 * delib + 0.35 * d.preparationPreference + 0.20 * d.creativity,
    strategyVariation: 0.45 * reass + 0.35 * d.creativity + 0.20 * d.adaptability,
    // IGL B: Leadership
    micromanagement: 0.40 * coord + 0.35 * d.tacticalDiscipline + 0.25 * (100 - d.socialTrust),
    delegation: 0.40 * d.socialTrust + 0.35 * indiv + 0.25 * reass,
    playerAutonomy: 0.40 * indiv + 0.35 * d.creativity + 0.25 * d.socialTrust,
    consultativeCalling: 0.45 * coord + 0.35 * d.socialTrust + 0.20 * reass,
    decisiveCalling: 0.45 * inst + 0.30 * init + 0.25 * d.leadershipInitiative,
    informationDemand: 0.45 * delib + 0.30 * reass + 0.25 * coord,
    communicationIntensity: 0.40 * coord + 0.35 * d.teamOrientation + 0.25 * d.leadershipInitiative,
    conflictResolution: 0.45 * coord + 0.30 * d.socialTrust + 0.25 * d.emotionalStability,
    responsibilitySharing: 0.45 * coord + 0.35 * d.socialTrust + 0.20 * d.teamOrientation,
    leadFromFront: 0.55 * init + 0.25 * d.competitiveDrive + 0.20 * d.riskTolerance,
    teamProtection: 0.50 * coord + 0.30 * (100 - init) + 0.20 * d.teamOrientation,
    authorityAssertion: 0.40 * d.leadershipInitiative + 0.35 * d.tacticalDiscipline + 0.25 * (100 - d.socialTrust),
    // IGL C: Mid-round calling
    midroundAdaptation: 0.55 * reass + 0.25 * d.adaptability + 0.20 * d.creativity,
    rotationCalling: 0.45 * reass + 0.30 * inst + 0.25 * d.adaptability,
    opportunityCalling: 0.45 * init + 0.35 * reass + 0.20 * inst,
    failedExecuteRecovery: 0.45 * reass + 0.30 * d.adaptability + 0.25 * d.emotionalStability,
    regroupPreference: 0.50 * coord + 0.30 * delib + 0.20 * d.tacticalDiscipline,
    tempoSwitching: 0.45 * reass + 0.30 * d.creativity + 0.25 * init,
    riskCalling: 0.50 * d.riskTolerance + 0.30 * init + 0.20 * inst,
    uncertaintyTolerance: 0.45 * inst + 0.30 * d.riskTolerance + 0.25 * reass,
    timeManagement: 0.50 * delib + 0.30 * d.tacticalDiscipline + 0.20 * d.emotionalStability,
    numericalAdvantageProtection: 0.50 * (100 - d.riskTolerance) + 0.30 * delib + 0.20 * coord,
    comebackCalling: 0.45 * d.creativity + 0.30 * d.riskTolerance + 0.25 * reass,
    saveCalling: 0.45 * (100 - init) + 0.35 * delib + 0.20 * (100 - d.riskTolerance),
    // IGL D: Player utilization
    starUtilization: 0.40 * d.competitiveDrive + 0.30 * indiv + 0.30 * d.adaptability,
    balancedUtilization: 0.55 * coord + 0.25 * d.teamOrientation + 0.20 * delib,
    strengthExploitation: 0.45 * reass + 0.30 * d.adaptability + 0.25 * coord,
    weaknessProtection: 0.45 * coord + 0.30 * (100 - d.riskTolerance) + 0.25 * delib,
    spawnExploitation: 0.45 * init + 0.30 * reass + 0.25 * d.adaptability,
    utilityDelegation: 0.50 * coord + 0.30 * d.teamOrientation + 0.20 * delib,
    secondaryCallerTrust: 0.45 * d.socialTrust + 0.30 * coord + 0.25 * reass,
    lurkTrust: 0.40 * d.socialTrust + 0.35 * indiv + 0.25 * (100 - d.tacticalDiscipline),
    sniperPriority: 0.40 * delib + 0.30 * d.preparationPreference + 0.30 * (100 - init),
    entrySupportPriority: 0.45 * coord + 0.30 * init + 0.25 * d.teamOrientation,
    roleFlexibility: 0.50 * reass + 0.30 * d.adaptability + 0.20 * d.creativity,
    individualPlayAllowance: 0.45 * indiv + 0.30 * d.creativity + 0.25 * d.socialTrust,
  };

  // Individual A-N defaults computed cleanly by category affinity
  const individualWeights: Record<string, number> = {
    // A. Peeking & engagement
    wideSwing: 0.50 * init + 0.25 * inst + 0.25 * d.riskTolerance,
    jigglePeek: 0.45 * delib + 0.30 * (100 - init) + 0.25 * d.preparationPreference,
    shoulderBait: 0.40 * delib + 0.35 * d.creativity + 0.25 * reass,
    jumpPeek: 0.45 * d.creativity + 0.30 * init + 0.25 * d.riskTolerance,
    crouchPeek: 0.45 * delib + 0.30 * d.tacticalDiscipline + 0.25 * init,
    prefire: 0.45 * init + 0.30 * d.preparationPreference + 0.25 * inst,
    repeekPersistence: 0.45 * init + 0.30 * d.competitiveDrive + 0.25 * (press * 0.4 + d.riskTolerance * 0.6),
    duelInitiative: 0.60 * init + 0.20 * indiv + 0.20 * d.competitiveDrive,
    peekDelay: 0.50 * (100 - init) + 0.30 * d.creativity + 0.20 * delib,
    angleIsolation: 0.55 * delib + 0.25 * d.tacticalDiscipline + 0.20 * (100 - press),
    advantageSeeking: 0.45 * (100 - init) + 0.35 * delib + 0.20 * (100 - d.riskTolerance),
    distractionPeek: 0.40 * coord + 0.35 * d.creativity + 0.25 * reass,
    // B. Gunfight & shooting
    sprayCommitment: 0.45 * init + 0.30 * inst + 0.25 * d.competitiveDrive,
    burstPreference: 0.50 * delib + 0.30 * d.tacticalDiscipline + 0.20 * (100 - press),
    tapPreference: 0.45 * (100 - init) + 0.35 * delib + 0.20 * d.emotionalStability,
    crouchSpray: 0.45 * delib + 0.30 * d.tacticalDiscipline + 0.25 * inst,
    sprayTransfer: 0.45 * init + 0.30 * d.riskTolerance + 0.25 * inst,
    triggerPatience: 0.50 * (100 - init) + 0.30 * delib + 0.20 * d.emotionalStability,
    smokeSpam: 0.45 * init + 0.30 * d.riskTolerance + 0.25 * inst,
    wallbang: 0.40 * d.creativity + 0.35 * init + 0.25 * d.preparationPreference,
    suppressiveFire: 0.40 * coord + 0.35 * init + 0.25 * d.teamOrientation,
    reloadFrequency: 0.45 * delib + 0.30 * (100 - d.riskTolerance) + 0.25 * press,
    sidearmTransition: 0.40 * reass + 0.35 * inst + 0.25 * d.adaptability,
    targetSwitching: 0.45 * reass + 0.35 * inst + 0.20 * init,
    postShotReposition: 0.45 * (100 - init) + 0.30 * reass + 0.25 * d.adaptability,
    // C. Movement
    knifeMobility: 0.45 * init + 0.35 * d.riskTolerance + 0.20 * inst,
    silentMovement: 0.50 * (100 - init) + 0.30 * delib + 0.20 * d.tacticalDiscipline,
    movementTricks: 0.50 * d.creativity + 0.30 * init + 0.20 * d.riskTolerance,
    elevationSeeking: 0.45 * d.creativity + 0.30 * reass + 0.25 * indiv,
    boostSeeking: 0.50 * coord + 0.30 * d.creativity + 0.20 * d.teamOrientation,
    shortcutPreference: 0.45 * init + 0.30 * d.creativity + 0.25 * d.adaptability,
    routeVariation: 0.50 * reass + 0.30 * d.creativity + 0.20 * d.adaptability,
    movementBaiting: 0.45 * d.creativity + 0.30 * delib + 0.25 * reass,
    exposureMinimization: 0.50 * (100 - d.riskTolerance) + 0.30 * delib + 0.20 * coord,
    weaponReadyTravel: 0.50 * (100 - d.riskTolerance) + 0.30 * delib + 0.20 * d.tacticalDiscipline,
    // D. Positioning & map control
    earlyAggression: 0.60 * init + 0.20 * d.riskTolerance + 0.20 * inst,
    offAnglePreference: 0.45 * d.creativity + 0.30 * indiv + 0.25 * reass,
    forwardPositioning: 0.55 * init + 0.25 * d.riskTolerance + 0.20 * d.competitiveDrive,
    anchorPersistence: 0.50 * (100 - init) + 0.30 * d.tacticalDiscipline + 0.20 * coord,
    lurkFlank: 0.50 * indiv + 0.25 * (100 - init) + 0.25 * d.creativity,
    flankWatch: 0.45 * coord + 0.35 * delib + 0.20 * (100 - init),
    repositionFrequency: 0.50 * reass + 0.30 * d.adaptability + 0.20 * d.creativity,
    mapControlInitiative: 0.45 * init + 0.30 * indiv + 0.25 * d.leadershipInitiative,
    deepControl: 0.50 * init + 0.30 * d.riskTolerance + 0.20 * indiv,
    positionConcealment: 0.50 * (100 - init) + 0.30 * delib + 0.20 * d.tacticalDiscipline,
    spaceCreation: 0.50 * init + 0.30 * coord + 0.20 * d.competitiveDrive,
    retreatTiming: 0.45 * (100 - init) + 0.35 * (100 - d.riskTolerance) + 0.20 * delib,
    informationPush: 0.45 * init + 0.35 * reass + 0.20 * d.riskTolerance,
    // E. Utility usage
    openingUtility: 0.45 * init + 0.30 * delib + 0.25 * d.preparationPreference,
    utilityConservation: 0.50 * (100 - init) + 0.30 * delib + 0.20 * (100 - d.riskTolerance),
    selfFlash: 0.55 * indiv + 0.25 * init + 0.20 * d.riskTolerance,
    supportFlash: 0.60 * coord + 0.25 * d.teamOrientation + 0.15 * delib,
    popFlashPreference: 0.45 * d.creativity + 0.30 * d.preparationPreference + 0.25 * coord,
    flashFollowup: 0.55 * init + 0.25 * coord + 0.20 * inst,
    visionDenial: 0.45 * delib + 0.35 * coord + 0.20 * d.tacticalDiscipline,
    smokePush: 0.50 * init + 0.30 * d.riskTolerance + 0.20 * inst,
    smokeClearing: 0.40 * coord + 0.35 * init + 0.25 * reass,
    smokeExtinguish: 0.45 * coord + 0.35 * d.tacticalDiscipline + 0.20 * delib,
    damageUtility: 0.45 * init + 0.30 * d.competitiveDrive + 0.25 * inst,
    displacementUtility: 0.45 * delib + 0.30 * d.preparationPreference + 0.25 * init,
    delayUtility: 0.50 * (100 - init) + 0.30 * delib + 0.20 * d.tacticalDiscipline,
    counterUtility: 0.50 * reass + 0.30 * d.adaptability + 0.20 * delib,
    predictiveUtility: 0.45 * d.creativity + 0.30 * inst + 0.25 * d.preparationPreference,
    utilitySharing: 0.60 * coord + 0.25 * d.teamOrientation + 0.15 * d.socialTrust,
    utilityStockpiling: 0.50 * coord + 0.30 * delib + 0.20 * d.tacticalDiscipline,
    utilityRecovery: 0.40 * d.tacticalDiscipline + 0.35 * (100 - init) + 0.25 * coord,
    utilityCombination: 0.45 * coord + 0.35 * delib + 0.20 * d.creativity,
    lineupPreference: 0.50 * delib + 0.30 * d.preparationPreference + 0.20 * coord,
    postPlantUtility: 0.50 * (100 - init) + 0.30 * delib + 0.20 * d.tacticalDiscipline,
    // F. Teamwork & coordination
    tradePriority: 0.60 * coord + 0.25 * d.teamOrientation + 0.15 * init,
    packSpacing: 0.60 * coord + 0.25 * d.tacticalDiscipline + 0.15 * delib,
    synchronizedPeek: 0.55 * coord + 0.25 * delib + 0.20 * d.socialTrust,
    crossfirePreference: 0.50 * coord + 0.30 * (100 - init) + 0.20 * delib,
    teammateCover: 0.60 * coord + 0.25 * d.teamOrientation + 0.15 * d.socialTrust,
    contactFollowup: 0.45 * init + 0.35 * coord + 0.20 * inst,
    baitAndSwitch: 0.45 * coord + 0.35 * d.creativity + 0.20 * delib,
    sacrificialEntry: 0.45 * coord + 0.35 * init + 0.20 * d.teamOrientation,
    supportInitiative: 0.55 * coord + 0.25 * reass + 0.20 * d.teamOrientation,
    supportRequest: 0.45 * coord + 0.30 * d.socialTrust + 0.25 * delib,
    equipmentSharing: 0.60 * coord + 0.25 * d.teamOrientation + 0.15 * d.socialTrust,
    teammateRescue: 0.55 * coord + 0.25 * d.teamOrientation + 0.20 * d.riskTolerance,
    teamRegroup: 0.55 * coord + 0.25 * delib + 0.20 * d.tacticalDiscipline,
    jointDisengagement: 0.55 * coord + 0.25 * (100 - init) + 0.20 * delib,
    // G. Information & communication
    activeInformation: 0.45 * init + 0.35 * reass + 0.20 * d.adaptability,
    visualConfirmation: 0.50 * delib + 0.30 * (100 - d.riskTolerance) + 0.20 * d.preparationPreference,
    audioInvestigation: 0.45 * reass + 0.30 * d.adaptability + 0.25 * init,
    utilityTracking: 0.50 * delib + 0.30 * d.preparationPreference + 0.20 * coord,
    enemyAccounting: 0.50 * delib + 0.30 * d.tacticalDiscipline + 0.20 * reass,
    calloutFrequency: 0.50 * coord + 0.30 * d.teamOrientation + 0.20 * d.leadershipInitiative,
    uncertainCallouts: 0.45 * inst + 0.30 * coord + 0.25 * d.riskTolerance,
    informationVerification: 0.55 * delib + 0.25 * d.preparationPreference + 0.20 * (100 - inst),
    reactionTesting: 0.45 * d.creativity + 0.30 * reass + 0.25 * init,
    patternAttention: 0.45 * delib + 0.35 * reass + 0.20 * d.adaptability,
    informationSharing: 0.60 * coord + 0.25 * d.teamOrientation + 0.15 * d.socialTrust,
    informationRetention: 0.55 * delib + 0.25 * d.preparationPreference + 0.20 * d.emotionalStability,
    // H. Deception & manipulation
    fakePeek: 0.45 * d.creativity + 0.30 * delib + 0.25 * reass,
    fakeFootsteps: 0.45 * d.creativity + 0.30 * indiv + 0.25 * reass,
    fakeRotation: 0.45 * d.creativity + 0.30 * delib + 0.25 * coord,
    fakeUtility: 0.45 * d.creativity + 0.30 * delib + 0.25 * reass,
    fakeExecute: 0.45 * d.creativity + 0.30 * delib + 0.25 * coord,
    fakeRetreat: 0.45 * d.creativity + 0.30 * init + 0.25 * reass,
    fakePlant: 0.45 * d.creativity + 0.35 * delib + 0.20 * d.riskTolerance,
    fakeDefuse: 0.45 * d.creativity + 0.35 * delib + 0.20 * d.riskTolerance,
    decoyUsage: 0.50 * d.creativity + 0.25 * reass + 0.25 * delib,
    soundMasking: 0.45 * delib + 0.35 * d.creativity + 0.20 * d.tacticalDiscipline,
    conditioning: 0.45 * delib + 0.35 * d.creativity + 0.20 * reass,
    intentConcealment: 0.50 * (100 - init) + 0.30 * delib + 0.20 * d.creativity,
    // I. Bomb & objective
    plantUrgency: 0.50 * init + 0.30 * inst + 0.20 * d.tacticalDiscipline,
    safePlant: 0.50 * (100 - d.riskTolerance) + 0.30 * delib + 0.20 * coord,
    openPlant: 0.45 * delib + 0.30 * d.riskTolerance + 0.25 * coord,
    bombProtection: 0.60 * coord + 0.25 * d.teamOrientation + 0.15 * delib,
    bombRecovery: 0.45 * init + 0.30 * coord + 0.25 * d.competitiveDrive,
    postPlantHide: 0.55 * (100 - init) + 0.25 * delib + 0.20 * (100 - d.riskTolerance),
    postPlantHunt: 0.55 * init + 0.25 * d.riskTolerance + 0.20 * indiv,
    postPlantReposition: 0.50 * reass + 0.30 * d.adaptability + 0.20 * d.creativity,
    defuseCommitment: 0.45 * d.emotionalStability + 0.30 * (100 - press) + 0.25 * d.riskTolerance,
    smokeDefuse: 0.50 * delib + 0.30 * d.creativity + 0.20 * (100 - init),
    defuseProtection: 0.60 * coord + 0.25 * d.teamOrientation + 0.15 * delib,
    timerPressure: 0.50 * delib + 0.30 * (100 - init) + 0.20 * d.tacticalDiscipline,
    objectivePriority: 0.55 * coord + 0.25 * d.tacticalDiscipline + 0.20 * delib,
    // J. Sniper-specific
    aggressiveAWP: 0.55 * init + 0.25 * d.riskTolerance + 0.20 * inst,
    openingPick: 0.55 * init + 0.25 * indiv + 0.20 * d.competitiveDrive,
    scopePersistence: 0.50 * (100 - init) + 0.30 * delib + 0.20 * d.tacticalDiscipline,
    sniperRepeek: 0.50 * init + 0.30 * d.riskTolerance + 0.20 * inst,
    sniperRotation: 0.50 * reass + 0.30 * d.adaptability + 0.20 * d.creativity,
    closeRangeAWP: 0.45 * init + 0.35 * d.riskTolerance + 0.20 * inst,
    noScopeAttempt: 0.45 * inst + 0.35 * d.riskTolerance + 0.20 * init,
    sniperPreservation: 0.55 * (100 - d.riskTolerance) + 0.25 * delib + 0.20 * (100 - init),
    sniperOffAngle: 0.50 * d.creativity + 0.25 * indiv + 0.25 * reass,
    secondShotCommitment: 0.50 * init + 0.30 * d.competitiveDrive + 0.20 * inst,
    // K. Round pacing & tactics
    fastTempo: 0.55 * init + 0.25 * inst + 0.20 * d.riskTolerance,
    contactPlay: 0.45 * (100 - init) + 0.30 * d.creativity + 0.25 * inst,
    delayedExecution: 0.50 * delib + 0.30 * (100 - init) + 0.20 * d.preparationPreference,
    rotationProactivity: 0.45 * reass + 0.35 * inst + 0.20 * init,
    rotationCommitment: 0.45 * delib + 0.30 * d.tacticalDiscipline + 0.25 * (100 - reass),
    siteRehit: 0.45 * d.creativity + 0.30 * reass + 0.25 * init,
    splitPreference: 0.45 * coord + 0.35 * reass + 0.20 * d.creativity,
    retakePreference: 0.45 * coord + 0.35 * delib + 0.20 * (100 - init),
    counterAggression: 0.50 * init + 0.30 * d.riskTolerance + 0.20 * reass,
    territoryRecovery: 0.45 * init + 0.30 * coord + 0.25 * reass,
    planPersistence: 0.55 * delib + 0.25 * d.tacticalDiscipline + 0.20 * (100 - reass),
    midroundInitiative: 0.45 * d.leadershipInitiative + 0.30 * reass + 0.25 * init,
    playDiscipline: 0.50 * coord + 0.35 * d.tacticalDiscipline + 0.15 * delib,
    opportunityExploitation: 0.45 * indiv + 0.35 * reass + 0.20 * inst,
    tacticalVariation: 0.50 * reass + 0.30 * d.creativity + 0.20 * d.adaptability,
    // L. Economy & equipment
    economicRisk: 0.50 * d.riskTolerance + 0.30 * init + 0.20 * inst,
    forceBuyPreference: 0.50 * init + 0.30 * d.riskTolerance + 0.20 * inst,
    weaponInvestment: 0.50 * indiv + 0.30 * init + 0.20 * d.competitiveDrive,
    utilityInvestment: 0.55 * coord + 0.25 * delib + 0.20 * d.preparationPreference,
    armorPriority: 0.50 * (100 - d.riskTolerance) + 0.30 * delib + 0.20 * d.tacticalDiscipline,
    weaponScavenge: 0.45 * init + 0.30 * d.adaptability + 0.25 * d.competitiveDrive,
    weaponDenial: 0.45 * d.competitiveDrive + 0.30 * init + 0.25 * coord,
    weaponJuggling: 0.45 * coord + 0.35 * d.tacticalDiscipline + 0.20 * delib,
    savePreference: 0.50 * (100 - init) + 0.30 * (100 - d.riskTolerance) + 0.20 * delib,
    exitFrag: 0.50 * indiv + 0.30 * d.competitiveDrive + 0.20 * init,
    saveHunting: 0.55 * init + 0.25 * d.riskTolerance + 0.20 * d.competitiveDrive,
    teamEconomicSupport: 0.60 * coord + 0.25 * d.teamOrientation + 0.15 * d.socialTrust,
    loadoutExperimentation: 0.55 * d.creativity + 0.25 * reass + 0.20 * d.riskTolerance,
    // M. Clutch & high-pressure
    clutchIsolation: 0.50 * delib + 0.30 * d.emotionalStability + 0.20 * (100 - press),
    clutchAggression: 0.55 * init + 0.25 * d.riskTolerance + 0.20 * inst,
    clutchPatience: 0.55 * (100 - init) + 0.25 * delib + 0.20 * d.emotionalStability,
    clutchReposition: 0.50 * reass + 0.30 * d.adaptability + 0.20 * d.creativity,
    clutchDeception: 0.50 * d.creativity + 0.30 * reass + 0.20 * delib,
    clutchUtility: 0.50 * delib + 0.30 * d.preparationPreference + 0.20 * d.adaptability,
    outnumberedRisk: 0.50 * init + 0.30 * d.riskTolerance + 0.20 * d.competitiveDrive,
    advantageProtection: 0.50 * (100 - d.riskTolerance) + 0.30 * coord + 0.20 * delib,
    soloInitiative: 0.55 * indiv + 0.25 * init + 0.20 * d.leadershipInitiative,
    desperationCommitment: 0.45 * d.riskTolerance + 0.30 * d.creativity + 0.25 * inst,
    // N. Adaptation & opponent exploitation
    opponentAdaptation: 0.55 * reass + 0.30 * d.adaptability + 0.15 * d.creativity,
    failedExecuteAdjustment: 0.50 * reass + 0.30 * d.adaptability + 0.20 * d.emotionalStability,
    antiAggression: 0.45 * delib + 0.30 * reass + 0.25 * d.preparationPreference,
    passivityExploitation: 0.50 * init + 0.30 * reass + 0.20 * d.adaptability,
    weakLinkTargeting: 0.45 * reass + 0.30 * d.preparationPreference + 0.25 * d.competitiveDrive,
    starAvoidance: 0.45 * (100 - d.riskTolerance) + 0.30 * reass + 0.25 * delib,
    timingExploitation: 0.45 * delib + 0.35 * reass + 0.20 * d.creativity,
    counterConditioning: 0.50 * d.creativity + 0.30 * reass + 0.20 * d.adaptability,
    selfCorrection: 0.45 * d.adaptability + 0.30 * reass + 0.25 * d.emotionalStability,
    improvisation: 0.45 * inst + 0.35 * d.creativity + 0.20 * indiv,
  };

  const result: FpsTendencyValues = {};
  for (const key of FPS_ALL_TENDENCY_KEYS) {
    const raw = (base[key] ?? individualWeights[key] ?? 50) + jitter(key, 12);
    const over = overrides?.[key];
    result[key] = clamp100(over !== undefined && Number.isFinite(over) ? over : raw);
  }
  return result;
}

/**
 * Effective 0..1 tendency in live context: Coaching, Gameplan, Familiarity and Chemistry
 * modulate the effective expression without mutating natural tendencies.
 */
export function effectiveTendency(
  natural: FpsTendencyValues,
  key: string,
  ctx: FpsTendencyContext = {},
): number {
  const base = clamp01((natural[key] ?? 50) / 100);
  const fam = clamp01(ctx.familiarity ?? 0.5);
  const adherence = clamp01(0.25 + fam * 0.25 + (ctx.chemistry?.trust ?? 0.5) * 0.25 + (ctx.chemistry?.leadershipAcceptance ?? 0.5) * 0.25);
  let target = base;
  const plan = ctx.plan, coach = ctx.coach;
  if (plan || coach) {
    if (['rushCalling', 'fastTempo', 'earlyAggression', 'duelInitiative', 'wideSwing'].includes(key)) {
      const sys = ((plan?.tempo ?? 0.5) + (plan?.aggression ?? 0.5) + (coach?.aggression ?? 0.5)) / 3;
      target = base * (1 - adherence * 0.28) + sys * (adherence * 0.28);
    } else if (['structuredCalling', 'playDiscipline', 'utilityHeavyCalling', 'lineupPreference', 'defaultPreference'].includes(key)) {
      const sys = ((plan?.structure ?? 0.5) + (plan?.preparation ?? 0.5) + (coach?.preparation ?? 0.5)) / 3;
      target = base * (1 - adherence * 0.28) + sys * (adherence * 0.28);
    } else if (['playerAutonomy', 'improvisation', 'individualPlayAllowance', 'lurkFlank', 'opportunityExploitation'].includes(key)) {
      const sys = ((plan?.freedom ?? 0.5) + (coach?.freedom ?? 0.5)) / 2;
      target = base * (1 - adherence * 0.25) + sys * (adherence * 0.25);
    } else if (['saveCalling', 'savePreference', 'economicRisk'].includes(key)) {
      const econ = ((plan?.economy ?? 0.5) + (coach?.economy ?? 0.5)) / 2;
      const sys = key === 'economicRisk' ? 1 - econ : econ;
      target = base * (1 - adherence * 0.25) + sys * (adherence * 0.25);
    }
  }
  // Pressure changes expression (impulse vs composure), never capability: bounded ±0.12 shift.
  const pressure = clamp01(ctx.pressure ?? 0);
  if (pressure > 0) {
    const shift = pressure * clamp01(ctx.pressureSensitivity ?? 0.45) * 0.12;
    if (PRESSURE_IMPULSIVE.has(key)) target += shift;
    else if (PRESSURE_COMPOSED.has(key)) target -= shift;
  }
  return clamp01(target);
}

export type CallResponseAction = 'follow' | 'follow_adjusted' | 'pursue_independent' | 'delay_or_report';

export interface CallResponseInput {
  playDiscipline: number;       // 0..100
  trustInIgl: number;           // 0..100
  tacticalFreedom: number;      // 0..100
  independentOpportunity: number; // 0..100
  callSuitability: number;      // 0..100
  immediateDanger: number;      // 0..100 (e.g. spotted AWPer/smoke blocking route)
}

/**
 * Contextual call acceptance (Section 05).
 * Autonomy is not blind disobedience: danger triggers delay/smoke-request/report.
 */
export function evaluateCallResponse(
  input: CallResponseInput,
  random: () => number,
): { action: CallResponseAction; probabilities: Record<CallResponseAction, number> } {
  const disc = clamp01(input.playDiscipline / 100);
  const trust = clamp01(input.trustInIgl / 100);
  const free = clamp01(input.tacticalFreedom / 100);
  const opp = clamp01(input.independentOpportunity / 100);
  const suit = clamp01(input.callSuitability / 100);
  const danger = clamp01(input.immediateDanger / 100);

  const raw: Record<CallResponseAction, number> = {
    follow: Math.exp(1.1 * disc + 1.0 * trust + 0.9 * suit - 0.8 * opp - 1.1 * danger),
    follow_adjusted: Math.exp(0.7 * disc + 0.6 * trust + 0.5 * free + 0.5 * danger),
    pursue_independent: Math.exp(1.2 * opp + 1.0 * free - 0.9 * disc - 0.5 * trust),
    delay_or_report: Math.exp(1.4 * danger + 0.4 * (1 - suit) + 0.3 * disc - 0.4 * opp),
  };
  const sum = raw.follow + raw.follow_adjusted + raw.pursue_independent + raw.delay_or_report || 1;
  const probabilities: Record<CallResponseAction, number> = {
    follow: raw.follow / sum,
    follow_adjusted: raw.follow_adjusted / sum,
    pursue_independent: raw.pursue_independent / sum,
    delay_or_report: raw.delay_or_report / sum,
  };
  let roll = random();
  let action: CallResponseAction = 'follow';
  for (const key of ['follow', 'follow_adjusted', 'pursue_independent', 'delay_or_report'] as const) {
    roll -= probabilities[key];
    if (roll <= 0) {
      action = key;
      break;
    }
  }
  return { action, probabilities };
}

export function describeIglLeadershipIdentity(t: FpsTendencyValues): {
  label: string;
  summary: string;
  potentialWeakness: string;
} {
  const struct = (t.structuredCalling + t.utilityHeavyCalling + t.defaultPreference) / 3;
  const aggro = (t.leadFromFront + t.rushCalling + t.riskCalling) / 3;
  const adapt = (t.midroundAdaptation + t.tempoSwitching + t.opportunityCalling) / 3;
  const deleg = (t.delegation + t.playerAutonomy + t.secondaryCallerTrust) / 3;

  const candidates = [
    {
      score: struct,
      label: 'Tactical Architect',
      summary: 'Rehearsed defaults, synchronized utility, disciplined spacing and structured executes.',
      potentialWeakness: 'Can struggle when opponents repeatedly disrupt structure.',
    },
    {
      score: aggro,
      label: 'Fragging Playmaker',
      summary: 'Fast commitments, aggressive openings, momentum-driven attacks and proactive combat.',
      potentialWeakness: 'Risk of overcommitment and thin preparation against disciplined defenses.',
    },
    {
      score: adapt,
      label: 'Adaptive Mastermind',
      summary: 'Information-driven defaults, frequent mid-round pivots and opponent-specific adjustments.',
      potentialWeakness: 'Teammates with low adaptability may struggle to keep up with frequent changes.',
    },
    {
      score: deleg,
      label: 'Player-Centric Facilitator',
      summary: 'Distributed decision-making, high player freedom and tactics built around roster strengths.',
      potentialWeakness: 'Can lack direction when independent plays fail to create openings.',
    },
  ].sort((a, b) => b.score - a.score);

  return {
    label: candidates[0].label,
    summary: candidates[0].summary,
    potentialWeakness: candidates[0].potentialWeakness,
  };
}

export function topSignatureTendencies(
  values: FpsTendencyValues,
  isIgl = false,
  count = 3,
): { key: string; label: string; value: number }[] {
  const pool = isIgl ? [...FPS_IGL_TENDENCIES, ...FPS_INDIVIDUAL_TENDENCIES] : FPS_INDIVIDUAL_TENDENCIES;
  return pool
    .map(def => ({ key: def.key, label: def.label, value: values[def.key] ?? 50 }))
    .sort((a, b) => Math.abs(b.value - 50) - Math.abs(a.value - 50) || b.value - a.value || a.key.localeCompare(b.key))
    .slice(0, count);
}

export interface TeamIdentityComparison {
  dimensions: {
    key: string;
    label: string;
    intended: number;
    leadership: number;
    observed: number | null;
  }[];
}

export function computeTeamIdentityComparison(
  plan: FpsGameplan,
  coach: Partial<FpsCoach>,
  iglTendencies: FpsTendencyValues,
  observedRoster?: readonly (FpsObservedBehavior | undefined)[],
): TeamIdentityComparison {
  const rate = (metric: FpsBehaviorMetric): number | null => {
    if (!observedRoster?.length) return null;
    let opp = 0, att = 0;
    for (const obs of observedRoster) {
      const m = obs?.metrics[metric];
      if (m) {
        opp += m.opportunities;
        att += m.attempts;
      }
    }
    return opp >= 15 ? Math.round((att / opp) * 100) : null;
  };

  const dims = [
    {
      key: 'aggression',
      label: 'Aggression',
      intended: clamp100(((plan.aggression + (coach.aggression ?? plan.aggression)) / 2) * 100),
      leadership: clamp100((iglTendencies.riskCalling + iglTendencies.leadFromFront + iglTendencies.opportunityCalling) / 3),
      observed: rate('risk'),
    },
    {
      key: 'tempo',
      label: 'Tempo',
      intended: clamp100(((plan.tempo + (coach.tempo ?? plan.tempo)) / 2) * 100),
      leadership: clamp100((iglTendencies.rushCalling + (100 - iglTendencies.lateRoundCalling)) / 2),
      observed: rate('firstContact'),
    },
    {
      key: 'discipline',
      label: 'Discipline',
      intended: clamp100(((plan.structure + (coach.rigidity ?? plan.structure)) / 2) * 100),
      leadership: clamp100((iglTendencies.structuredCalling + iglTendencies.micromanagement + iglTendencies.regroupPreference) / 3),
      observed: rate('strategyCompliance'),
    },
    {
      key: 'utility',
      label: 'Utility coordination',
      intended: clamp100(((plan.preparation + (coach.preparation ?? plan.preparation)) / 2) * 100),
      leadership: clamp100((iglTendencies.utilityHeavyCalling + iglTendencies.entrySupportPriority + iglTendencies.utilityDelegation) / 3),
      observed: rate('utilitySupport'),
    },
    {
      key: 'freedom',
      label: 'Player freedom',
      intended: clamp100(((plan.freedom + (coach.freedom ?? plan.freedom)) / 2) * 100),
      leadership: clamp100((iglTendencies.playerAutonomy + iglTendencies.delegation + iglTendencies.individualPlayAllowance) / 3),
      observed: rate('improvisation'),
    },
    {
      key: 'adaptability',
      label: 'Adaptability',
      intended: clamp100(((plan.freedom * 0.5 + (coach.adaptability ?? 0.5) * 0.5)) * 100),
      leadership: clamp100((iglTendencies.midroundAdaptation + iglTendencies.tempoSwitching + iglTendencies.strategyVariation) / 3),
      observed: rate('opponentAdjustment'),
    },
    {
      key: 'economy',
      label: 'Economic discipline',
      intended: clamp100(((plan.economy + (coach.economy ?? plan.economy)) / 2) * 100),
      leadership: clamp100((iglTendencies.saveCalling + iglTendencies.numericalAdvantageProtection) / 2),
      observed: null,
    },
  ];
  return { dimensions: dims };
}

export interface TeamDynamicFinding {
  id: string;
  title: string;
  severity: 'synergy' | 'watch' | 'friction';
  observation: string;
  action: string;
}

/**
 * Role-pair & leadership diagnostics (Section 16).
 * Never averages five unrelated profiles into one score.
 */
export function analyzeTeamDynamics(input: {
  plan: FpsGameplan;
  coach: Partial<FpsCoach>;
  igl?: { name: string; tendencies: FpsTendencyValues };
  entry?: { name: string; tendencies: FpsTendencyValues };
  support?: { name: string; tendencies: FpsTendencyValues };
  lurker?: { name: string; tendencies: FpsTendencyValues };
  rotators?: readonly { name: string; tendencies: FpsTendencyValues }[];
  roster: readonly { name: string; tendencies: FpsTendencyValues }[];
}): TeamDynamicFinding[] {
  const findings: TeamDynamicFinding[] = [];
  const { plan, coach, igl, entry, support, lurker, rotators = [], roster } = input;

  if (entry && support) {
    const entryRush = (entry.tendencies.earlyAggression + (100 - entry.tendencies.playDiscipline)) / 2;
    const supportFlash = (support.tendencies.supportFlash + support.tendencies.lineupPreference) / 2;
    if (entryRush >= 68 && supportFlash >= 62 && entry.tendencies.playDiscipline <= 45) {
      findings.push({
        id: 'entry-support-mismatch',
        title: 'Entry–Support timing mismatch',
        severity: 'friction',
        observation: `${entry.name} frequently initiates engagements before ${support.name}'s supporting flash arrives.`,
        action: 'Set entry instruction to balanced/support or pair with higher utility-wait discipline.',
      });
    } else if (entry.tendencies.flashFollowup >= 62 && support.tendencies.supportFlash >= 62) {
      findings.push({
        id: 'entry-support-sync',
        title: 'Synchronized Entry–Support timing',
        severity: 'synergy',
        observation: `${entry.name} times swings cleanly off ${support.name}'s pop-flashes.`,
        action: 'Preserve this entry-support pairing on execute sides.',
      });
    }
  }

  if (igl) {
    const coachStruct = ((plan.structure + (coach.preparation ?? plan.preparation)) / 2) * 100;
    const iglFreedom = (igl.tendencies.playerAutonomy + igl.tendencies.delegation) / 2;
    if (coachStruct >= 68 && iglFreedom >= 64 && igl.tendencies.structuredCalling <= 48) {
      findings.push({
        id: 'coach-igl-conflict',
        title: 'Conflicting leadership philosophy',
        severity: 'friction',
        observation: `IGL ${igl.name} favors autonomous gameplay while the gameplan emphasizes rehearsed tactical structures.`,
        action: 'Increase tactical freedom in the gameplan or select a more structured IGL.',
      });
    }
    const secondaryOptions = roster.filter(p => p.name !== igl.name && p.tendencies.midroundInitiative >= 62);
    if (igl.tendencies.leadFromFront >= 72 && secondaryOptions.length === 0) {
      findings.push({
        id: 'insufficient-secondary-calling',
        title: 'Insufficient secondary calling',
        severity: 'watch',
        observation: `Aggressive IGL ${igl.name} frequently enters early fights, leaving the team light on mid-round secondary callers.`,
        action: 'Develop or assign a secondary voice with mid-round initiative on support/rotator.',
      });
    }
  }

  const fastRotators = rotators.filter(r => r.tendencies.rotationProactivity >= 68 && r.tendencies.informationVerification <= 45);
  if (fastRotators.length >= 2) {
    findings.push({
      id: 'premature-rotations',
      title: 'Premature defensive rotations',
      severity: 'watch',
      observation: `${fastRotators.map(r => r.name).join(' & ')} tend to rotate on preliminary cues, risking opposite-site gaps.`,
      action: 'Reinforce anchor discipline or pair with an IGL who demands stronger confirmation.',
    });
  }

  if (lurker && igl && lurker.tendencies.lurkFlank >= 62 && igl.tendencies.lurkTrust >= 58) {
    findings.push({
      id: 'lurker-integration',
      title: 'Effective lurker integration',
      severity: 'synergy',
      observation: `${lurker.name} applies late flank pressure while ${igl.name} trusts independent split timings.`,
      action: 'Maintain lurker autonomy during defaults and split executes.',
    });
  }

  return findings;
}

export const FPS_OBSERVED_TEAM_CATEGORIES = ['opening', 'execution', 'midround', 'defense', 'coordination', 'economy', 'psychology', 'objective', 'leadership'] as const;
export type FpsObservedTeamCategory = typeof FPS_OBSERVED_TEAM_CATEGORIES[number];
export const FPS_OBSERVED_TEAM_CATEGORY_LABELS: Record<FpsObservedTeamCategory, string> = {
  opening: 'Opening', execution: 'Execution', midround: 'Mid-round', defense: 'Defense', coordination: 'Coordination',
  economy: 'Economy', psychology: 'Opponent reading', objective: 'Objective', leadership: 'Leadership adherence',
};

/** Minimum per-metric opportunities before a metric may inform an observed team category. */
export const FPS_OBSERVED_TEAM_MIN_OPPORTUNITIES = 15;
/** Minimum recorded player-match appearances before the observed team identity is shown at all. */
export const FPS_OBSERVED_TEAM_MIN_MATCHES = 5;

export type FpsObservedTeamTendencies = Record<FpsObservedTeamCategory, number | null> & {
  samples: number;
  /** True only when appearances and at least one category meet the sample thresholds. */
  sufficient: boolean;
};

/**
 * Computes Section 13's 9 observed collective team tendency categories strictly from recorded match behavior
 * opportunities (never by averaging hidden individual profiles). A category stays null until its metrics
 * have enough opportunities; insufficient data is never back-filled with a neutral value.
 */
export function computeObservedTeamTendencies(
  behaviors: readonly (FpsObservedBehavior | undefined)[],
  options: { minMatches?: number } = {},
): FpsObservedTeamTendencies {
  const records = behaviors.filter((b): b is FpsObservedBehavior => !!b);
  const rate = (metric: FpsBehaviorMetric): number | null => {
    let obs = 0;
    let opp = 0;
    for (const b of records) {
      const m = b.metrics[metric];
      if (!m) continue;
      obs += m.attempts;
      opp += m.opportunities;
    }
    return opp >= FPS_OBSERVED_TEAM_MIN_OPPORTUNITIES ? (obs / opp) * 100 : null;
  };
  /** Weighted blend over the metrics that met the threshold; null when none did. */
  const blend = (parts: readonly [number | null, number][]): number | null => {
    let total = 0, weight = 0;
    for (const [value, w] of parts) if (value !== null) { total += value * w; weight += w; }
    return weight > 0 ? clamp100(total / weight) : null;
  };
  const inv = (v: number | null) => (v === null ? null : 100 - v);
  const totalSamples = records.reduce((sum, b) => sum + b.matches, 0);
  const engagement = rate('engagement');
  const firstContact = rate('firstContact');
  const utilitySupport = rate('utilitySupport');
  const coordination = rate('coordination');
  const retake = rate('retake');
  const rotation = rate('rotation');
  const compliance = rate('strategyCompliance');
  const improv = rate('improvisation');
  const failedAdj = rate('failedExecuteAdjustment');
  const oppAdj = rate('opponentAdjustment');
  const risk = rate('risk');
  const lurkTiming = rate('lurkTiming');
  const sacrifice = rate('sacrifice');

  const categories: Record<FpsObservedTeamCategory, number | null> = {
    opening: blend([[engagement, 0.45], [firstContact, 0.55]]),
    execution: blend([[utilitySupport, 0.50], [compliance, 0.50]]),
    midround: blend([[failedAdj, 0.55], [improv, 0.45]]),
    defense: blend([[retake, 0.55], [inv(rotation), 0.45]]),
    coordination: blend([[coordination, 0.50], [sacrifice, 0.15], [compliance, 0.35]]),
    economy: blend([[inv(risk), 0.65], [compliance, 0.35]]),
    psychology: blend([[oppAdj, 0.55], [lurkTiming, 0.45]]),
    objective: blend([[compliance, 0.55], [retake, 0.45]]),
    leadership: blend([[compliance, 0.55], [coordination, 0.45]]),
  };
  if (totalSamples < (options.minMatches ?? FPS_OBSERVED_TEAM_MIN_MATCHES)) for (const key of FPS_OBSERVED_TEAM_CATEGORIES) categories[key] = null;
  return {
    ...categories,
    samples: totalSamples,
    sufficient: FPS_OBSERVED_TEAM_CATEGORIES.some(key => categories[key] !== null),
  };
}
