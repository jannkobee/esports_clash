import type { LiveAnticipation, LiveMotionObservation } from './fpsLiveAnticipation.ts';
import type { FpsAudioCue } from './fpsBroadcastAudio.ts';
import type { FpsMentalState, FpsSkillDiagnostics } from './fpsDetailedExecution.ts';
import type { FpsPrimaryRole, TacticalAction, FpsTendencyValues, CallResponseAction } from './fpsIdentity.ts';
import type { LiveSkills } from './fpsLiveAttributes.ts';
import type { LiveBuyMode } from './fpsLiveEconomy.ts';
import type { LiveGrenade, LiveGrenadeKind, LiveThrowStyle } from './fpsLiveGrenades.ts';
import type { LiveManualAim, LiveAimZone } from './fpsLiveGunplay.ts';
import type { LiveImpact } from './fpsLiveImpact.ts';
import type { LiveIntelContact, LiveIntelMemory } from './fpsLiveIntel.ts';
import type { FpsLearningOptions, FpsLearningStats } from './fpsLiveLearning.ts';
import type { LiveJumpablePerch } from './fpsLiveMap.ts';
import type { LiveMapId } from './fpsLiveMapTypes.ts';
import type { FpsMechanicsOptions, FpsMechanicsStats } from './fpsLiveMechanicsLearning.ts';
import type { LiveStance } from './fpsLiveMovement.ts';
import type { FpsMovementOptions, FpsMovementStats } from './fpsLiveMovementLearning.ts';
import type { planLiveBombEscape } from './fpsLivePlanning.ts';
import type { FpsObservedRound, FpsOpponentModel, FpsPlaybookChange, FpsPlaybookRound, FpsTeamPlaybook } from './fpsLivePlaybook.ts';
import type { LiveAttackPhase, LiveAttackStyle, LiveDefenseSetup, LiveTacticArchetype } from './fpsLiveTactics.ts';
import type { LiveTerritoryAssignment } from './fpsLiveTerritory.ts';
import type { LiveFlankTimingState, LivePunishWindow } from './fpsLiveTiming.ts';
import type { LiveEquippedWeapon, LiveWeapon } from './fpsLiveWeapons.ts';
import type { FpsOpponentPattern } from './fpsOpponentPatterns.ts';
import type { FpsObservedBehavior, FpsPersonality, FpsPosition } from './fpsPlayerArchitecture.ts';
import type { FpsRoundDuty } from './fpsRoundResponsibilities.ts';
import type { FpsAbility, FpsSkillProfile } from './fpsSkillProfile.ts';
import type { FpsPoint } from './fpsSpatialWorld.ts';
import type { FpsTeamId } from './fpsTypes.ts';
import type { FpsThrowPlan, FpsUtilityLearningOptions, FpsUtilityLearningStats } from './fpsUtilityBrain.ts';
import type { FpsUtilityIntent } from './fpsUtilityPurpose.ts';

export interface LivePlayer extends FpsPoint {
  id: string; name: string; team: FpsTeamId; attacking: boolean; role: FpsPrimaryRole; yaw: number; pitch?: number;
  hp: number; armor: number; cash: number; weapon: LiveWeapon; ammo: number; reserve: number; reload: number; reloadDuration: number; reloadSilent: boolean;
  kills: number; deaths: number; assists?: number; action: string; bomb: boolean; kit: boolean; flash: number; smoke: number; incendiary: number; he: number;
  blinded: number; channel: number; personality: string; personalityDimensions?: FpsPersonality; position?: FpsPosition; naturalIdentity?: string; observedIdentity?: string; behavior?: FpsObservedBehavior; iglIdentity?: { label: string; summary: string }; topTendencies?: { key: string; label: string; value: number }[]; callResponse?: CallResponseAction; lastShot: number;
  /** This round's job (entry, trade, support, lurk, anchor, AWP) and why; the roster position is `position`. */
  duty?: FpsRoundDuty; dutyReason?: string;
  throwAt?: number; throwKind?: LiveGrenadeKind; throwStyle?: LiveThrowStyle;
  utilityPrep?: { kind: LiveGrenadeKind; releaseAt: number; purpose?: string; objective?: string; phase?: 'equip' | 'pin' | 'ready'; target?: FpsPoint; throwStyle?: LiveThrowStyle; flightTime?: number; lineupId?: string; launchYaw?: number; launchPitch?: number }; teamKills?: number;
  callout: string; intent: string; skills: LiveSkills; exertion: number;
  impact: LiveImpact;
  speed: number; stance: LiveStance; crouch: boolean;
  jump?: boolean; jumpY?: number; jumpVy?: number; groundY?: number; radioAt?: number; radioMessage?: string; recoilYaw?: number; recoilPitch?: number;
  equipped: LiveEquippedWeapon; weaponReady: number; lastSwing: number;
  primaryWeapon?: LiveWeapon; secondaryWeapon?: LiveWeapon; secondaryAmmo?: number; secondaryReserve?: number; meleeWeapon?: 'knife';
  scopeState?: 'hip' | 'raising' | 'scoped' | 'lowering' | 'cycling'; scopeLevel?: number; scopeUntil?: number; plantStyle?: string;
  information: string; enemyRemaining?: number; actionSkill?: { ability: FpsAbility; value: number; estimated: boolean };
  skillProfile?: { version: 2; revision: number; source: FpsSkillProfile['source'] }; diagnostics?: FpsSkillDiagnostics; mental?: FpsMentalState;
}

export interface LiveActor extends LivePlayer {
  pitch: number; preferSniper?: boolean;
  bombEscape?: { point: FpsPoint }; escapeCheckAt?: number; escapePlan?: ReturnType<typeof planLiveBombEscape>;
  buyLook?: { point: FpsPoint; until: number };
  reaction: number; slot: number; target?: string; acquired: number; nextShot: number;
  nextThink: number; decision: TacticalAction; goal?: FpsPoint; path: FpsPoint[]; contact?: FpsPoint;
  contactAt: number; lastMoved: number; utilityAt: number; damageAt: number; flashedBy?: string;
  smokeLineupGoal?: FpsPoint;
  smokeLineupId?: string; smokeLineupUntil?: number; smokeLineupRetryAt?: number;
  smokeLineupFailures?: number;
  /** Hand-driven crosshair for the current duel target, and the shot index of the current spray. */
  manualAim?: LiveManualAim; sprayIndex?: number; /** Mid-spray switch to a new enemy: the trigger stays down, so the pattern index is kept until then. */ sprayTransferUntil?: number;
  /** A launch spot this player chose or remembered for the current smoke target. */
  smokeLineupSpot?: FpsPoint; smokeLineupMoves?: number;
  seenAt: number; nextSense: number; burst: number; pressure: number; retreatUntil: number;
  reportAt: number; stuckFor: number; watchPoint?: FpsPoint;
  engagementShots: number; engagementDamaged: boolean; openingAttempted: boolean;
  vx: number; vz: number; nextFootstep: number; nextAudioFootstep: number; stillSince: number; wasCrouched: boolean; nextPeek: number; peek?: { home: FpsPoint; out: FpsPoint; back: boolean; until: number; pause: number; style: 'shoulder' | 'crouch-swing' | 'ferrari' | 'double-pump' | 'bait' | 'fake'; pumps: number; prefired: number };
  jump: boolean; jumpY: number; jumpVy: number; nextJump: number; jumpQueued: boolean; jumpChain: number; strafeDirection: 1 | -1; strafeUntil: number; glockBurstRemaining: number;
  cleared: Set<string>; clearUntil: number; clearPoint?: FpsPoint; lookAwayUntil: number;
  crouch: boolean; crouchUntil: number;
  lookAwayPoint?: FpsPoint & { y?: number }; lookAwayStarts?: number;
  aimPoint?: FpsPoint; sampledHeadY?: number; preparedPitch?: number; scopeHoldUntil?: number; postAssignment?: { point: FpsPoint; watch: FpsPoint; reason: string; until: number }; damageLedger?: Map<string, { damage: number; at: number }>; reactionVariation: number; equipUntil: number; swingAt?: number;
  aimFocus?: { point: FpsPoint; eyeY?: number; source: 'contact' | 'route' | 'hold' | 'clear'; until: number; from: FpsPoint };
  intel: LiveIntelMemory; intelManaged: boolean; sentReports: Map<string, number>;
  profile?: FpsSkillProfile; motor: FpsSkillDiagnostics; mentalState: FpsMentalState; patterns: FpsOpponentPattern[];
  pendingCues: { at: number; contact: LiveIntelContact }[]; recoil: number; recoilPitch: number; brakeAt?: number; preparedError: number; panicUntil?: number; flickOvershoot?: number;
  previousSight?: FpsPoint & { at: number; id: string }; trackingPoint?: FpsPoint; planAssessmentAt?: number;
  motionSamples: Map<string, LiveMotionObservation>; anticipation?: LiveAnticipation; prefireAt?: number;
  visualCueAt?: number; shotCommitUntil?: number; targetCommitUntil?: number; sidearmUntil?: number; retakeWaitUntil?: number;
  probeGoal?: string; probeVisited: Set<string>; holdingSince?: number;
  tacticalChoice?: { key: string; phase: string; until: number; point?: FpsPoint };
  /** Teammate this player is trading behind, kept until that teammate is gone or far, so the role does not flicker. */
  follow?: { id: string; until: number };
  /** The IGL order this player's call response belongs to: one response per call, not a new dice roll every think. */
  callResponseOrder?: number;
  trafficYield?: { point: FpsPoint; until: number }; routeRepairAt?: number;
  suppression?: { smokeId: number; key: string; startedAt: number; shots: number; burstShots: number; nextBurstAt: number };
  freezeDelay?: number; buyAt?: number; postRoamAt?: number; fakeDefuseDone?: boolean; halfDefuseDone?: boolean; fakeDefuseHoldUntil?: number; fakePlantDone?: boolean; fakePlantHoldUntil?: number; triggerDisciplineUntil?: number;
  approachUntil?: number; radioAt?: number; acknowledgedOrder?: number; strafeSettleUntil?: number;
  knownSmokes: LiveSmoke[]; flashWindow?: { point: FpsPoint; opens: number; expires: number };
  reloadRounds: number;
  routeEvidence?: string; routeUpdatedAt?: number; objectiveUrgent?: boolean;
  holsteredPrimary?: { weapon: LiveWeapon; ammo: number; reserve: number; nextShot?: number };
  sidearmLoadout?: { weapon: LiveWeapon; ammo: number; reserve: number; nextShot?: number };
  lastDropAt?: number;
  /** When the optic finished raising: a bolt-action shot needs a brief look through the scope first. */
  scopedAt?: number;
  /** Passing an item to a teammate: turn to face them, then drop/toss it (never a teleport). */
  handoff?: { point: FpsPoint; recipientId?: string; readyAt: number; giveUpAt: number; label: string; release: () => void };
  lastFireCallAt?: number;
  underFireAt?: number; underFireFrom?: FpsPoint; underFireKind?: 'hit' | 'near-miss'; underFireCount?: number; lastUnderFireRadioAt?: number;
  vaultDrop?: { target: FpsPoint; landingY: number; clearanceY: number; startedAt: number; until: number };
  utilityPreparation?: { kind: LiveGrenadeKind; target: FpsPoint; aimTarget?: FpsPoint; throwPlan?: FpsThrowPlan; believed?: LiveGrenade; startedAt: number; equipAt: number; readyAt: number; throwStyle: LiveThrowStyle; flightTime?: number; lineupId?: string; launchYaw: number; launchPitch: number; pinHeard?: boolean; intent?: FpsUtilityIntent };
  heardDefuseAt?: number;
  perchGoal?: LiveJumpablePerch;
  noticedEnemies: { id: string; x: number; z: number; level?: FpsPoint['level']; hp: number; reload: number; blinded: number; lastShot: number; channel: number }[];
  tendencies: FpsTendencyValues;
  callResponse?: CallResponseAction;
  /**
   * Round responsibility, re-elected for the whole team as the round changes. `base` is the roster
   * role it was elected against; `pending` is a handover still being communicated.
   */
  roundDuty?: { duty: FpsRoundDuty; base: FpsPrimaryRole; since: number; reason: string; home?: 'A' | 'B'; pending?: { duty: FpsRoundDuty; at: number; reason: string; home?: 'A' | 'B' } };
  /** Teammate whose device this player is covering while the carrier is isolated. */
  escortId?: string;
  /** The entry this player is paired to trade this round (closes the gap, keeps trade spacing). */
  tradeFor?: string;
  /** Seconds the entry has already held this round waiting for the trade (bounded). */
  entryWaited?: number;
  /** A committed swing onto a fallen teammate's lawfully called killer position, from when the call lands. */
  tradeSwing?: { point: FpsPoint; at: number; until: number; victim: string; via: FpsPoint; take?: FpsPoint };
  /** Active trade-window context preserved after tradeSwing launches a peek so anticipation & counter-strafe stay active. */
  tradeContext?: { point: FpsPoint; until: number; victim: string };
  /** The call this player already questioned on the radio (one report per call). */
  hesitatedOrder?: number;
  recentDeathSpots?: { round: number; x: number; z: number; level?: FpsPoint['level'] }[];
  progressAnchor?: FpsPoint;
  progressAt?: number;
  anticipatedReadiness?: { targetId: string; perceptionScale: number };
  turnedFromFlashBy?: string;
  turnedFromFlashUntil?: number;
  aimPartial?: boolean;
  sampledAimZone?: LiveAimZone;
  /** Lawful exposure clock: last time this actor fired, threw loud utility, sprinted near intel, or exchanged direct sight. */
  lastExposedAt?: number;
  territoryTask?: LiveTerritoryAssignment;
  flankTiming?: LiveFlankTimingState;
  punishWindow?: LivePunishWindow;
}

export interface LiveRoundTelemetry {
  round: number; winner: FpsTeamId; attackTeam: FpsTeamId; reason: string; planted: boolean; time: number;
  /** Plays called this round (family names plus play ids) and where the round went. */
  tactic?: LiveTacticArchetype; defenseSetup?: LiveDefenseSetup; site?: 'A' | 'B'; firstBloodSite?: 'A' | 'B' | 'Mid'; attackPlayId?: string; defensePlayId?: string;
}

/** One team's persisted playbook for this map, plus its lawful cross-match opponent model. */
export interface FpsPlaybookOptions {
  mode: 'learn' | 'frozen'; model?: FpsTeamPlaybook; opponents?: FpsOpponentModel;
  /** Opponent identity (its lineage key): results against it drive counter-strategies. */
  opponent?: string;
  onRound?: (update: FpsPlaybookUpdate) => void;
}
export interface FpsPlaybookUpdate { round: FpsPlaybookRound; observed?: { opponent: string; seen: FpsObservedRound }; change: FpsPlaybookChange }
/** Headless diagnostics only (balance ablations); gameplay code never sets these. */
export interface LiveSimulationDiagnostics {
  /** Crosshair snaps to the aim point once the perception delay has passed. */ snapAim?: boolean;
  /** Skip the hidden consistency trait (skills use their own values). */ noConsistency?: boolean;
  /** Ablation: the roster role is the round job (no election, handovers, escorts, elected flasher, entry trade wait or anchor fallback). */ staticRoles?: boolean;
}
export interface LiveSimulationOptions {
  diagnostics?: LiveSimulationDiagnostics; mapId?: LiveMapId; utilityLearning?: FpsUtilityLearningOptions; episodeId?: string;
  onRoundComplete?: (round: LiveRoundTelemetry) => void;
  teamLearning?: Partial<Record<FpsTeamId, {
    /** This team's persisted playbook (plays chosen and learned per team). */ playbook?: FpsPlaybookOptions;
    /** This team's own utility brain (team lineage); without it both teams share `utilityLearning`. */ utilityLearning?: FpsUtilityLearningOptions;
    learning?: FpsLearningOptions; mechanicsLearning?: FpsMechanicsOptions; movementLearning?: FpsMovementOptions;
  }>>;
  skillProfiles?: Record<string, FpsSkillProfile>; learning?: FpsLearningOptions; mechanicsLearning?: FpsMechanicsOptions; movementLearning?: FpsMovementOptions;
}
export interface DroppedWeapon extends FpsPoint { id: number; weapon: LiveWeapon; ammo: number; reserve: number; y?: number; airUntil?: number; from?: FpsPoint; fromY?: number; reservedFor?: string; at?: number; droppedBy?: string }
export interface LiveDroppedUtility extends FpsPoint { id: number; kind: LiveGrenadeKind; team: FpsTeamId; at: number; from?: FpsPoint; fromY?: number; airUntil?: number; reservedFor?: string }
/** Cosmetic fatal-hit metadata; never used by perception, targeting or damage. */
export interface LiveFatalImpact { region: 'head' | 'torso' | 'legs' | 'blast' | 'burn'; point: { x: number; y: number; z: number }; direction: { x: number; y: number; z: number }; strength: number }
export interface LiveCorpse extends FpsPoint { id: number; playerId: string; attacking: boolean; at: number; y: number; yaw: number; vx: number; vz: number; vy?: number; crouch: boolean; impact?: LiveFatalImpact }
export interface LiveTeamReport { id: number; team: FpsTeamId; actorId: string; name: string; at: number; message: string; category: 'contact' | 'utility' | 'plan' | 'objective'; confidence: 'confirmed' | 'reported' | 'plan' }
export interface LiveEvent {
  id: number; time: number; kind: 'kill' | 'round' | 'objective' | 'utility' | 'economy'; text: string;
  team?: FpsTeamId; actorId?: string; targetId?: string; headshot?: boolean; weapon?: LiveEquippedWeapon; wallbang?: boolean; noScope?: boolean;
}
export interface LiveShot { id: number; time: number; actorId: string; weapon: LiveWeapon; from: FpsPoint; to: FpsPoint; fromY: number; toY: number; team: FpsTeamId; targetId?: string; hitRegion?: 'head' | 'body' }
export interface LiveSmoke extends FpsPoint { id: number; startedAt: number; expires: number; radius: number; y: number; disturbedUntil?: number; disturbance?: number; blastUntil?: number }
export interface LiveFire extends FpsPoint { id: number; ownerId: string; team: FpsTeamId; startedAt: number; expires: number; nextDamageAt: number; radius: number }
export interface LiveBlast extends FpsPoint { id: number; startedAt: number; endsAt: number; radius: number }
export interface LiveBloodMark extends FpsPoint { id: number; startedAt: number; region: 'head' | 'body'; radius: number }
export interface LiveTeamPlan { buy: LiveBuyMode; buyReason: string; style: LiveAttackStyle | 'defense'; phase: LiveAttackPhase | 'hold'; site?: 'A' | 'B'; information: string; forces?: { allies: number; enemies: number } }
export interface LiveFireCue { id: number; playerId: string; at: number; bearing: number; kind: 'hit' | 'near-miss'; strength: number }
export interface LiveSnapshot {
  version: 'hexatrick-live-exhibition-v19'; mapId: LiveMapId; mapName: string; time: number; round: number;
  phase: 'freeze' | 'live' | 'post' | 'finished'; remaining: number; score: Record<FpsTeamId, number>;
  winner?: FpsTeamId; roundWinner?: FpsTeamId; roundReason: string; attackTeam: FpsTeamId;
  players: LivePlayer[]; events: LiveEvent[]; shots: LiveShot[]; smokes: LiveSmoke[]; fires: LiveFire[]; blasts: LiveBlast[]; bloodMarks: LiveBloodMark[];
  grenades: LiveGrenade[]; teams: Record<FpsTeamId, LiveTeamPlan>;
  droppedWeapons: DroppedWeapon[]; droppedUtility?: LiveDroppedUtility[]; droppedKits?: { id: number; x: number; z: number; level?: FpsPoint['level'] }[]; corpses?: LiveCorpse[]; teamReports?: LiveTeamReport[]; fireCues?: LiveFireCue[];
  bomb: { level?: FpsPoint['level']; status: 'carried' | 'dropped' | 'planted' | 'defused' | 'exploded'; x: number; z: number; remaining: number; site?: 'A' | 'B'; plantStyle?: string };
  learning?: FpsLearningStats; mechanicsLearning?: FpsMechanicsStats; movementLearning?: FpsMovementStats; utilityLearning?: FpsUtilityLearningStats; utilityLearningByTeam?: Record<FpsTeamId, FpsUtilityLearningStats>;
}
