import {LIVE_C4_RULES,liveC4Damage} from './fpsLiveBomb.ts';
import {anticipateLiveContact,recordLiveMotion,type LiveMotionObservation,type LiveAnticipation} from './fpsLiveAnticipation.ts';
import type { PlayerCard } from '../types.ts';
import type { FpsIdentityExperiment, FpsTeamId } from './fpsTypes.ts';
import { evaluatePlayerAction, type FpsPrimaryRole, type TacticalAction } from './fpsIdentity.ts';
import { hydrateFpsIdentityContext, observedPersonalityTriggers } from './fpsIdentityMatch.ts';
import {fpsExecutionRole,naturalFpsIdentity,fpsBehaviorPreferences,emptyFpsObservedBehavior,observeFpsBehavior,observedFpsIdentity,type FpsPosition,type FpsObservedBehavior} from './fpsPlayerArchitecture.ts';
import { moveFpsActor, segmentHitsWall, type FpsPoint } from './fpsSpatialWorld.ts';
import { LIVE_ACTOR_RADIUS, type LiveJumpablePerch, distance } from './fpsLiveMap.ts';
import type { LiveMapId, LiveMapRuntime, LiveSolid } from './fpsLiveMapTypes.ts';
import { getLiveMapRuntime } from './fpsLiveMapRegistry.ts';
import { solveLiveGrenadeThrow, solveLiveSmokeThrow, solveLivePopFlash, type LiveSmokeLineup } from './fpsLiveLineups.ts';
import { rankLiveSmokeLineups, canReachLiveOpeningLineup } from './fpsLiveLineupDecisions.ts';
import { liveActorHeadY, liveRayDirection, traceLiveActorHit } from './fpsLiveBallistics.ts';
import { LIVE_STEP_HEIGHT } from './fpsLiveTerrain.ts';
import { liveSkills, liveDecisionInterval, liveReactionTime, livePressure, liveAimSpread, liveReportDelay, type LiveSkills } from './fpsLiveAttributes.ts';
import { emptyLiveImpact, type LiveImpact } from './fpsLiveImpact.ts';
import { LIVE_WEAPONS, LIVE_WEAPON_TIERS, LIVE_KNIFE, liveDrawTime, liveWeaponRecoilKick, advanceLiveRecoil, type LiveWeapon, type LiveEquippedWeapon } from './fpsLiveWeapons.ts';
import { buyLiveTeam, canCarryLiveUtility, type LiveBuyMode, type LiveBuyPlayer } from './fpsLiveEconomy.ts';
import { advanceLiveVelocity, liveShotSpeedLimit, liveAccurateShotReady, liveAccuracySettleTime, LIVE_RUN_SPEED, LIVE_WALK_SPEED, LIVE_CROUCH_SPEED, LIVE_JUMP_VELOCITY, advanceLiveJump, type LiveStance } from './fpsLiveMovement.ts';
import { chooseLiveTactic, chooseLiveDefenseSetup, createLiveProtocol, liveOrderActive, type LiveInformationOrder, type LiveAttackProtocol, type LiveAttackStyle, type LiveAttackPhase, type LiveTacticArchetype, type LiveDefenseSetup, type LiveRoundHistory } from './fpsLiveTactics.ts';
import { LIVE_UTILITY_RULES, LIVE_UTILITY_FUSES, LIVE_HE_RULES, LIVE_FRIENDLY_FIRE_RULES, predictLiveGrenade, launchLiveGrenade, stepLiveGrenade, liveGrenadeSightline, computeLiveThrowAngles, grenadeHitHorizontalSurface, isGrenadeOnSupportSurface, type LiveGrenade, type LiveGrenadeKind, type LiveThrowStyle } from './fpsLiveGrenades.ts';
import { advanceLiveAimYaw, liveRouteLookAhead } from './fpsLiveAim.ts';
import { emptyLiveIntel, rememberLiveIntel, strongestLiveIntel, assessLiveIntel, clearLiveIntel, liveIntelArea, describeLiveIntel, liveIntelBeliefs, hasObservedBomb, inferEnemyWeaponProfile, type LiveIntelContact, type LiveIntelMemory, type LiveWeaponHint } from './fpsLiveIntel.ts';
import { fpsSkillProfileFromAttributes, pinFpsSkillProfile, fpsAbilityUnit, fpsActionAbility, fpsSkillRandom, type FpsSkillProfile, type FpsAbility, type FpsExecutionChannel } from './fpsSkillProfile.ts';
import { detailedReactionDelay, detailedSenseInterval, detailedAimYaw, detailedInputError, preparedAngleError, detailedThrowPoint, tickFpsMentalState, advanceDetailedRecoil, emptyFpsSkillDiagnostics, type FpsMentalState, type FpsSkillDiagnostics } from './fpsDetailedExecution.ts';
import { createLiveInfluenceGrid, resetLiveInfluenceGrid, recordInfluenceDanger, stampInfluenceFov, hasActiveInfluenceHeat, sampleInfluenceDanger, sampleInfluenceUncertainty, type LiveTeamInfluenceGrid } from './fpsLiveInfluenceMap.ts';
import { createTacticalBlackboard, resetTacticalBlackboard, postBlackboardClaim, releaseActorBlackboard, hasBlackboardClaim, blackboardClaimedPoints, type LiveTacticalBlackboard, type LiveBlackboardKind } from './fpsLiveBlackboard.ts';
import { createUtilityPrepBt, createDuelMicroBt, tickBt, type BtNode } from './fpsBehaviorTree.ts';
import { recordFpsOpponentPattern, knownFpsTendency, knownFpsPattern, interpretFpsInformation, type FpsOpponentPattern } from './fpsOpponentPatterns.ts';
import { canInvestigateLiveContact, shouldFakeLiveDefuse, chooseLiveApproach, liveAssaultApproaches, liveRetakeApproaches, liveCombatStrafe, liveSmokeOccludes, shouldCommitLivePlant, type LiveApproach } from './fpsLiveBrain.ts';
import { assignLiveObjective, planLiveBombEscape, createLiveRoutePlanner, liveRouteEvidenceKey, planLivePlant, planLivePostPlant, livePlantSite, LIVE_PLANT_RULES } from './fpsLivePlanning.ts';
import type { FpsAudioCue } from './fpsBroadcastAudio.ts';
import { FpsLiveLearner, fpsLearningModelHash, type FpsLearningOptions, type FpsLearningStats } from './fpsLiveLearning.ts';
import { FpsLiveMechanicsLearner, fpsFireContext, type FpsFireCadence, type FpsMechanicsOptions, type FpsMechanicsStats } from './fpsLiveMechanicsLearning.ts';
import { FpsLiveMovementLearner, fpsMovementContext, type FpsMovementAction, type FpsPeekMovementAction, type FpsMovementOptions, type FpsMovementStats } from './fpsLiveMovementLearning.ts';
export { LIVE_WEAPONS } from './fpsLiveWeapons.ts';
export type { LiveWeapon } from './fpsLiveWeapons.ts';

export const LIVE_FPS_STEP = 1/30;
export interface LivePlayer extends FpsPoint {
  id:string; name:string; team:FpsTeamId; attacking:boolean; role:FpsPrimaryRole; yaw:number;pitch?:number;
  hp:number; armor:number; cash:number; weapon:LiveWeapon; ammo:number; reserve:number; reload:number;reloadDuration:number;reloadSilent:boolean;
  kills:number; deaths:number; assists?:number; action:string; bomb:boolean; kit:boolean; flash:number; smoke:number; incendiary:number;he:number;
  blinded:number; channel:number; personality:string;personalityDimensions?:import('./fpsPlayerArchitecture.ts').FpsPersonality;position?:FpsPosition;naturalIdentity?:string;observedIdentity?:string;behavior?:FpsObservedBehavior;lastShot:number;
  throwAt?:number;throwKind?:LiveGrenadeKind;throwStyle?:LiveThrowStyle;
  utilityPrep?:{kind:LiveGrenadeKind;releaseAt:number;phase?:'equip'|'pin'|'ready';target?:FpsPoint;throwStyle?:LiveThrowStyle;flightTime?:number;lineupId?:string;launchYaw?:number;launchPitch?:number};teamKills?:number;
  callout:string; intent:string; skills:LiveSkills; exertion:number;
  impact:LiveImpact;
  speed:number;stance:LiveStance;crouch:boolean;
  jump?:boolean;jumpY?:number;jumpVy?:number;groundY?:number;radioAt?:number;radioMessage?:string;recoilYaw?:number;recoilPitch?:number;
  equipped:LiveEquippedWeapon;weaponReady:number;lastSwing:number;
  primaryWeapon?:LiveWeapon;secondaryWeapon?:LiveWeapon;secondaryAmmo?:number;secondaryReserve?:number;meleeWeapon?:'knife';
  scopeState?:'hip'|'raising'|'scoped'|'lowering'|'cycling';scopeLevel?:number;scopeUntil?:number;plantStyle?:string;
  information:string;enemyRemaining?:number;actionSkill?:{ability:FpsAbility;value:number;estimated:boolean};
  skillProfile?:{version:2;revision:number;source:FpsSkillProfile['source']};diagnostics?:FpsSkillDiagnostics;mental?:FpsMentalState;
}
interface Actor extends LivePlayer {
  pitch:number;preferSniper?:boolean;
  bombEscape?:{point:FpsPoint};escapeCheckAt?:number;escapePlan?:ReturnType<typeof planLiveBombEscape>;
  buyLook?:{point:FpsPoint;until:number};
  reaction:number; slot:number; target?:string; acquired:number; nextShot:number;
  nextThink:number; decision:TacticalAction; goal?:FpsPoint; path:FpsPoint[]; contact?:FpsPoint;
  contactAt:number; lastMoved:number; utilityAt:number; damageAt:number; flashedBy?:string;
  smokeLineupGoal?:FpsPoint;
  smokeLineupId?:string;smokeLineupUntil?:number;smokeLineupRetryAt?:number;
  seenAt:number;nextSense:number;burst:number;pressure:number;retreatUntil:number;
  reportAt:number;stuckFor:number;watchPoint?:FpsPoint;
  engagementShots:number;engagementDamaged:boolean;openingAttempted:boolean;
  vx:number;vz:number;nextFootstep:number;nextAudioFootstep:number;stillSince:number;wasCrouched:boolean;nextPeek:number;peek?:{home:FpsPoint;out:FpsPoint;back:boolean;until:number;pause:number;style:'shoulder'|'crouch-swing'|'ferrari'|'double-pump'|'bait'|'fake';pumps:number;prefired:number};
  jump:boolean;jumpY:number;jumpVy:number;nextJump:number;jumpQueued:boolean;jumpChain:number;strafeDirection:1|-1;strafeUntil:number;glockBurstRemaining:number;
  cleared:Set<string>;clearUntil:number;clearPoint?:FpsPoint;lookAwayUntil:number;
  crouch:boolean;crouchUntil:number;
  lookAwayPoint?:FpsPoint&{y?:number};lookAwayStarts?:number;
  aimPoint?:FpsPoint;sampledHeadY?:number;preparedPitch?:number;scopeHoldUntil?:number;postAssignment?:{point:FpsPoint;watch:FpsPoint;reason:string;until:number};damageLedger?:Map<string,{damage:number;at:number}>;reactionVariation:number;equipUntil:number;swingAt?:number;
  aimFocus?:{point:FpsPoint;eyeY?:number;source:'contact'|'route'|'hold'|'clear';until:number;from:FpsPoint};
  intel:LiveIntelMemory;intelManaged:boolean;sentReports:Map<string,number>;
  profile?:FpsSkillProfile;motor:FpsSkillDiagnostics;mentalState:FpsMentalState;patterns:FpsOpponentPattern[];
  pendingCues:{at:number;contact:LiveIntelContact}[];recoil:number;recoilPitch:number;brakeAt?:number;preparedError:number;panicUntil?:number;flickOvershoot?:number;
  previousSight?:FpsPoint&{at:number;id:string};trackingPoint?:FpsPoint;planAssessmentAt?:number;
  motionSamples:Map<string,LiveMotionObservation>;anticipation?:LiveAnticipation;prefireAt?:number;
  visualCueAt?:number;shotCommitUntil?:number;targetCommitUntil?:number;sidearmUntil?:number;retakeWaitUntil?:number;
  probeGoal?:string;probeVisited:Set<string>;holdingSince?:number;
  tacticalChoice?:{key:string;phase:string;until:number};
  trafficYield?:{point:FpsPoint;until:number};routeRepairAt?:number;
  suppression?:{smokeId:number;key:string;startedAt:number;shots:number;burstShots:number;nextBurstAt:number};
  freezeDelay?:number;buyAt?:number;postRoamAt?:number;fakeDefuseDone?:boolean;halfDefuseDone?:boolean;fakeDefuseHoldUntil?:number;fakePlantDone?:boolean;fakePlantHoldUntil?:number;triggerDisciplineUntil?:number;
  approachUntil?:number;radioAt?:number;acknowledgedOrder?:number;strafeSettleUntil?:number;
  knownSmokes:LiveSmoke[];flashWindow?:{point:FpsPoint;opens:number;expires:number};
  reloadRounds:number;
  routeEvidence?:string;routeUpdatedAt?:number;objectiveUrgent?:boolean;
  holsteredPrimary?:{weapon:LiveWeapon;ammo:number;reserve:number;nextShot?:number};
  sidearmLoadout?:{weapon:LiveWeapon;ammo:number;reserve:number;nextShot?:number};
  lastDropAt?:number;
  lastFireCallAt?:number;
  vaultDrop?:{target:FpsPoint;landingY:number;clearanceY:number;startedAt:number;until:number};
  utilityPreparation?:{kind:LiveGrenadeKind;target:FpsPoint;aimTarget?:FpsPoint;startedAt:number;equipAt:number;readyAt:number;throwStyle:LiveThrowStyle;flightTime?:number;lineupId?:string;launchYaw:number;launchPitch:number;pinHeard?:boolean};
  heardDefuseAt?:number;
  perchGoal?:LiveJumpablePerch;
  noticedEnemies:{id:string;x:number;z:number;level?:FpsPoint['level'];hp:number;reload:number;blinded:number;lastShot:number;channel:number}[];
}
export interface LiveRoundTelemetry {round:number;winner:FpsTeamId;attackTeam:FpsTeamId;reason:string;planted:boolean;time:number}
export interface LiveSimulationOptions {mapId?:LiveMapId;episodeId?:string;onRoundComplete?:(round:LiveRoundTelemetry)=>void;teamLearning?:Partial<Record<FpsTeamId,{learning?:FpsLearningOptions;mechanicsLearning?:FpsMechanicsOptions;movementLearning?:FpsMovementOptions}>>;skillProfiles?:Record<string,FpsSkillProfile>;learning?:FpsLearningOptions;mechanicsLearning?:FpsMechanicsOptions;movementLearning?:FpsMovementOptions}
export interface DroppedWeapon extends FpsPoint { id:number; weapon:LiveWeapon; ammo:number; reserve:number;y?:number;airUntil?:number;from?:FpsPoint;fromY?:number;reservedFor?:string;at?:number;droppedBy?:string }
export interface LiveDroppedUtility extends FpsPoint {id:number;kind:LiveGrenadeKind;team:FpsTeamId;at:number;from?:FpsPoint;fromY?:number;airUntil?:number;reservedFor?:string}
/** Cosmetic fatal-hit metadata; never used by perception, targeting or damage. */
export interface LiveFatalImpact {region:'head'|'torso'|'legs'|'blast'|'burn';point:{x:number;y:number;z:number};direction:{x:number;y:number;z:number};strength:number}
export interface LiveCorpse extends FpsPoint {id:number;playerId:string;attacking:boolean;at:number;y:number;yaw:number;vx:number;vz:number;vy?:number;crouch:boolean;impact?:LiveFatalImpact}
export interface LiveTeamReport {id:number;team:FpsTeamId;actorId:string;name:string;at:number;message:string;category:'contact'|'utility'|'plan'|'objective';confidence:'confirmed'|'reported'|'plan'}
export interface LiveEvent {
  id:number; time:number; kind:'kill'|'round'|'objective'|'utility'|'economy'; text:string;
  team?:FpsTeamId; actorId?:string; targetId?:string; headshot?:boolean; weapon?:LiveEquippedWeapon;wallbang?:boolean;noScope?:boolean;
}
export interface LiveShot { id:number; time:number; actorId:string;weapon:LiveWeapon;from:FpsPoint;to:FpsPoint;fromY:number;toY:number;team:FpsTeamId;targetId?:string;hitRegion?:'head'|'body' }
export interface LiveSmoke extends FpsPoint { id:number; startedAt:number; expires:number; radius:number;y:number;disturbedUntil?:number;disturbance?:number;blastUntil?:number }
export interface LiveFire extends FpsPoint { id:number; ownerId:string; team:FpsTeamId; startedAt:number; expires:number; nextDamageAt:number; radius:number }
export interface LiveBlast extends FpsPoint {id:number;startedAt:number;endsAt:number;radius:number}
export interface LiveBloodMark extends FpsPoint {id:number;startedAt:number;region:'head'|'body';radius:number}
export interface LiveTeamPlan {buy:LiveBuyMode;buyReason:string;style:LiveAttackStyle|'defense';phase:LiveAttackPhase|'hold';site?:'A'|'B';information:string;forces?:{allies:number;enemies:number}}
export interface LiveFireCue {id:number;playerId:string;at:number;bearing:number;kind:'hit'|'near-miss';strength:number}
export interface LiveSnapshot {
  version:'hexatrick-live-exhibition-v19'; mapId:LiveMapId; mapName:string; time:number; round:number;
  phase:'freeze'|'live'|'post'|'finished'; remaining:number; score:Record<FpsTeamId,number>;
  winner?:FpsTeamId; roundWinner?:FpsTeamId; roundReason:string; attackTeam:FpsTeamId;
  players:LivePlayer[]; events:LiveEvent[]; shots:LiveShot[]; smokes:LiveSmoke[]; fires:LiveFire[];blasts:LiveBlast[];bloodMarks:LiveBloodMark[];
  grenades:LiveGrenade[];teams:Record<FpsTeamId,LiveTeamPlan>;
  droppedWeapons:DroppedWeapon[];droppedUtility?:LiveDroppedUtility[];droppedKits?:{id:number;x:number;z:number;level?:FpsPoint['level']}[];corpses?:LiveCorpse[];teamReports?:LiveTeamReport[];fireCues?:LiveFireCue[];
  bomb:{level?:FpsPoint['level'];status:'carried'|'dropped'|'planted'|'defused'|'exploded';x:number;z:number;remaining:number;site?:'A'|'B';plantStyle?:string};
  learning?:FpsLearningStats;mechanicsLearning?:FpsMechanicsStats;movementLearning?:FpsMovementStats;
}
const other=(team:FpsTeamId):FpsTeamId=>team==='blue'?'red':'blue';
const clamp=(x:number,min:number,max:number)=>Math.max(min,Math.min(max,x));
const localHash=(text:string)=>{let h=2166136261;for(let i=0;i<text.length;i++)h=Math.imul(h^text.charCodeAt(i),16777619);return(h>>>0).toString(16).padStart(8,'0');};
const angle=(a:number)=>Math.atan2(Math.sin(a),Math.cos(a));
const heading=(a:FpsPoint,b:FpsPoint)=>Math.atan2(b.x-a.x,b.z-a.z);
const LIVE_MAX_DROP_THROW_DIST=4.8;
const LIVE_INTERACT_PICKUP_DIST=2.35;
const SMOKE_LINEUP_COMMS:Record<string,{prep:string;thrown:string}>={
  'mid-window':{prep:'Smoking window right now, hold your peek',thrown:'Smoking window — wait for it to bloom, then take mid!'},
  'mid-delay':{prep:'Lining up mid bridge smoke to stall them',thrown:'Smoking mid bridge to stall their crunch — hold your cross!'},
  'a-arch':{prep:'Lining up A arch smoke for the exec',thrown:'Smoking A arch — wait a second, get ready to swing!'},
  'a-library':{prep:'Lining up library cross smoke',thrown:"Smoking library cross — don't swing early, let it bloom."},
  'b-speedway':{prep:'Setting up market cross smoke for B hit',thrown:'Smoking market cross — ready to crunch site!'},
  'b-church':{prep:'Lining up church return smoke on B',thrown:'Smoking church return — scale up with me bro!'},
  'restaurant-civic':{prep:'Lining up opening A main smoke',thrown:'Smoking A main off spawn — watch for early aggression.'},
  'restaurant-market':{prep:'Lining up early B market smoke',thrown:'Smoking B banana off spawn — taking early space.'},
  'guard-civic':{prep:'Lining up A main delay smoke',thrown:'Smoking A main early to buy us time — hold your angle.'},
  'guard-market':{prep:'Lining up B choke delay smoke',thrown:'Smoking B choke off spawn — tell me if you hear steps.'},
  'sw-t-mid-screen':{prep:'Lining up Mid screen smoke from Service Yard',thrown:'Smoking Mid courtyard — cross toward Kiosk once it blooms!'},
  'sw-t-canal-cross':{prep:'Smoking Canal crossing from Service Yard',thrown:'Canal smoke down — cross into Short/Tunnel safely.'},
  'sw-t-plaza-park':{prep:'Lining up Parkhouse gap smoke from Plaza',thrown:'Smoking Parkhouse cross — scale up Promenade or Mid.'},
  'sw-t-connector':{prep:'Smoking Connector mouth from Mid',thrown:'Smoking Connector mouth — watch the lower flank.'},
  'sw-a-ct-bank':{prep:'Lining up HQ CT Gate smoke from Terrace',thrown:'Smoking HQ CT Gate — swing Site A together!'},
  'sw-a-truck-back':{prep:'Lining up Response Truck rear smoke',thrown:'Smoking truck rear — isolate the HQ anchor.'},
  'sw-a-dumpster':{prep:'Lining up HQ electrical cross smoke',thrown:'Smoking electrical cross — push onto HQ plant!'},
  'sw-b-control-deck':{prep:'Lining up Control Deck Heaven smoke',thrown:'Smoking Control Deck heaven — scale into Pump Station!'},
  'sw-b-service-exit':{prep:'Smoking CT Service exit from Canal Bridge',thrown:'Service exit smoked — isolate B site.'},
  'sw-b-pillar-cross':{prep:'Smoking B Silo cross from Main Tunnel',thrown:'Silo cross down — push out of Main Tunnel!'},
  'sw-ct-a-long':{prep:'Lining up A Long Terrace delay smoke',thrown:'Smoking A Long Terrace — hold Kiosk cross.'},
  'sw-ct-b-main':{prep:'Lining up Main Tunnel delay smoke',thrown:'Smoking Main Tunnel mouth — watch Short Canal.'},
  'sw-ct-b-short':{prep:'Smoking Short Sluice from Control Deck',thrown:'Short Sluice smoked off spawn — play off Control Deck.'},
  'sw-ct-mid-control':{prep:'Smoking Mid Control from Kiosk North',thrown:'Mid Control smoked — reset your angle.'},
};
function closestShotApproach(point:{x:number;y:number;z:number},from:{x:number;y:number;z:number},to:{x:number;y:number;z:number}) {
  const dx=to.x-from.x,dy=to.y-from.y,dz=to.z-from.z,length=dx*dx+dy*dy+dz*dz||1;
  const t=clamp(((point.x-from.x)*dx+(point.y-from.y)*dy+(point.z-from.z)*dz)/length,0,1);
  const x=from.x+dx*t,y=from.y+dy*t,z=from.z+dz*t;
  return {distance:Math.hypot(point.x-x,point.y-y,point.z-z),x,z};
}

const COVER_DESCRIPTOR_RULES: readonly [RegExp, string][] = [
  [/car/, 'behind car'],
  [/truck/, 'behind truck'],
  [/van/, 'behind van'],
  [/tree/, 'behind tree'],
  [/fountain/, 'behind fountain'],
  [/sandbag|flood-bags/, 'behind sandbags'],
  [/silo|pillar/, 'behind pillar'],
  [/pump/, 'behind pump'],
  [/pallet|crate|dice/, 'behind crates'],
  [/control-box|utility-box|cabinet|box/, 'by electrical box'],
  [/kiosk/, 'by kiosk'],
  [/booth|hut/, 'by booth'],
  [/planter|bench|barrier|baffle/, 'behind barrier'],
];

/** Describe the nearest tactile landmark near an observed position for concise death callouts. */
export function describeNearbyDeathCover(solids: readonly LiveSolid[], point: FpsPoint, groundY: number): string {
  let bestDist = 5.5;
  let bestLabel = '';
  for (const solid of solids) {
    if (solid.cutawayGroup === 'roof' || solid.cutawayGroup === 'ceiling') continue;
    if (solid.id.includes('underfill') || solid.id.includes('outer')) continue;
    if ((solid.baseY ?? 0) > groundY + 1.8 || solid.height < groundY + 0.45) continue;
    let label = '';
    for (const [pattern, text] of COVER_DESCRIPTOR_RULES) {
      if (pattern.test(solid.id)) {
        label = text;
        break;
      }
    }
    if (!label) continue;
    const dx = point.x < solid.minX ? solid.minX - point.x : point.x > solid.maxX ? point.x - solid.maxX : 0;
    const dz = point.z < solid.minZ ? solid.minZ - point.z : point.z > solid.maxZ ? point.z - solid.maxZ : 0;
    const dist = Math.hypot(dx, dz);
    if (dist < bestDist) {
      bestDist = dist;
      bestLabel = label;
    }
  }
  return bestLabel;
}

/** Browser-local live exhibition. Never creates an official match report or career write. */
export class FpsLiveSimulation {
  private readonly map:LiveMapRuntime;
  private actors:Actor[];
  private identity:FpsIdentityExperiment;
  private randomState:number;
  private tickNumber=0;
  private friendlyDamage=0;
  private sequence=0;
  private time=0;
  private round=1;
  private phase:LiveSnapshot['phase']='freeze';
  private remaining=15;
  private score={blue:0,red:0};
  private losses={blue:0,red:0};
  private winner?:FpsTeamId;
  private roundWinner?:FpsTeamId;
  private roundReason='';
  private attackTeam:FpsTeamId='red';
  private site:'A'|'B'='A';
  private liveElapsed=0;
  private roundLiveAt=0;
  private bomb:LiveSnapshot['bomb']={status:'carried',x:0,z:-38,remaining:40};
  private nextBombTick=-1;
  private events:LiveEvent[]=[];
  private shots:LiveShot[]=[];
  private smokes:LiveSmoke[]=[];
  private fires:LiveFire[]=[];
  private blasts:LiveBlast[]=[];
  private bloodMarks:LiveBloodMark[]=[];
  private droppedWeapons:DroppedWeapon[]=[];
  private droppedUtility:LiveDroppedUtility[]=[];private droppedKits:{id:number;x:number;z:number;level?:FpsPoint['level']}[]=[];private corpses:LiveCorpse[]=[];private teamReports:LiveTeamReport[]=[];private firstBloodArea?:'A'|'B'|'Mid';
  private reports:{team:FpsTeamId;at:number;source:string;contact:LiveIntelContact}[]=[];
  private informationOrders:Record<FpsTeamId,LiveInformationOrder>={blue:{mode:'hold',responders:[],until:0,strength:0,reason:'Hold the opening setup'},red:{mode:'hold',responders:[],until:0,strength:0,reason:'Gather information in the default'}};
  private influenceGrids!:Record<FpsTeamId,LiveTeamInfluenceGrid>;
  private blackboards:Record<FpsTeamId,LiveTacticalBlackboard>={blue:createTacticalBlackboard(),red:createTacticalBlackboard()};
  private corpseDangerRecorded=new Set<string>();
  private utilityPrepTree?:BtNode<{actor:Actor}>;
  private duelMicroTree?:BtNode<{actor:Actor;target:Actor;dt:number}>;

  private influenceGrid(team:FpsTeamId):LiveTeamInfluenceGrid {
    if(!this.influenceGrids)this.influenceGrids={blue:createLiveInfluenceGrid(this.time,this.map.definition.influenceGrid),red:createLiveInfluenceGrid(this.time,this.map.definition.influenceGrid)};
    return this.influenceGrids[team];
  }
  private teamBlackboard(team:FpsTeamId):LiveTacticalBlackboard {
    if(!this.blackboards)this.blackboards={blue:createTacticalBlackboard(),red:createTacticalBlackboard()};
    return this.blackboards[team];
  }
  private heatSampler(team:FpsTeamId):((point:FpsPoint)=>number)|undefined {
    const grid=this.influenceGrid(team);
    return hasActiveInfluenceHeat(grid,this.time)?(point:FpsPoint)=>sampleInfluenceDanger(grid,point,this.time):undefined;
  }
  private uncertaintySampler(team:FpsTeamId):(point:FpsPoint)=>number {
    const grid=this.influenceGrid(team);
    return (point:FpsPoint)=>sampleInfluenceUncertainty(grid,point,this.time);
  }
  private planCommit=0;
  private nextInformationProbe:Record<FpsTeamId,number>={blue:0,red:0};
  private roundSiteKills:Record<FpsTeamId,number>={blue:0,red:0};
  private confirmedDeaths=new Set<string>();
  private eliminations:{killer:string;victim:string;team:FpsTeamId;at:number;traded:boolean}[]=[];
  private protocol!:LiveAttackProtocol;
  private roundHistory:LiveRoundHistory[]=[];
  private tacticArchetype:LiveTacticArchetype='default_pick';
  private defenseSetup:LiveDefenseSetup='standard';
  private roundVariant=0;
  private fakeSite?:'A'|'B';
  private postPlantPlanterId?:string;
  private grenades:LiveGrenade[]=[];
  private flashSightings=new Map<number,Map<string,number>>();
  private audioCues:FpsAudioCue[]=[];
  private fireCues:LiveFireCue[]=[];private fireCueSequence=0;
  private noiseMasks:{x:number;z:number;until:number;radius:number}[]=[];
  private openingSmokeTeams=new Set<FpsTeamId>();
  private completedSmokeLineups=new Set<string>();
  private teamBuys:Record<FpsTeamId,{mode:LiveBuyMode;reason:string}>={blue:{mode:'pistol',reason:''},red:{mode:'pistol',reason:''}};
  private pendingBuys=new Map<string,LiveBuyPlayer>();
  private detailed:boolean;
  private observationRandom:()=>number;
  private executionRandom:()=>number;
  private worldRandom:()=>number;
  private learner?:FpsLiveLearner;
  private mechanicsLearner?:FpsLiveMechanicsLearner;
  private movementLearnerGlobal?:FpsLiveMovementLearner;
  private teamLearners:Partial<Record<FpsTeamId,FpsLiveLearner>>={};
  private teamMechanics:Partial<Record<FpsTeamId,FpsLiveMechanicsLearner>>={};
  private teamMovement:Partial<Record<FpsTeamId,FpsLiveMovementLearner>>={};
  private onRoundComplete?:LiveSimulationOptions['onRoundComplete'];
  private routeLearner(team:FpsTeamId){return this.teamLearners[team]??this.learner;}
  private combatLearner(team:FpsTeamId){return this.teamMechanics[team]??this.mechanicsLearner;}
  private movementLearner(team:FpsTeamId){return this.teamMovement[team]??this.movementLearnerGlobal;}
  private learningRandom:()=>number;
  private mechanicsRandom:()=>number;
  private movementRandom:()=>number;
  private learningEpisode='';
  private learningPlansRemaining=1;
  private navigationWarmups:{from:FpsPoint;to:FpsPoint}[]=[];
  private navigationWarmIndex=0;

  constructor(blue:PlayerCard[],red:PlayerCard[],seed:number,identity:FpsIdentityExperiment,options:LiveSimulationOptions={}) {
    if(blue.length!==5 || red.length!==5 || new Set([...blue,...red].map(p=>p.id)).size!==10) throw Error('A live exhibition needs ten distinct players.');
    if(!Number.isInteger(seed) || seed<1 || seed>2147483647) throw Error('Invalid exhibition seed.');
    this.map=getLiveMapRuntime(options.mapId??'fontessa');
    this.influenceGrids={blue:createLiveInfluenceGrid(0,this.map.definition.influenceGrid),red:createLiveInfluenceGrid(0,this.map.definition.influenceGrid)};
    this.bomb={status:'carried',x:this.map.definition.spawns.attackers.x,z:this.map.definition.spawns.attackers.z,level:this.map.definition.spawns.attackers.level,remaining:40};
    this.identity=hydrateFpsIdentityContext(identity,[...blue,...red].map(p=>p.id));
    this.randomState=seed;
    this.detailed=true;
    if(options.skillProfiles&&Object.keys(options.skillProfiles).length!==10)throw Error('Detailed exhibitions require exactly ten versioned skill profiles.');
    this.observationRandom=this.detailed?fpsSkillRandom(seed,'observation-v1'):this.random;
    this.executionRandom=this.detailed?fpsSkillRandom(seed,'execution-v1'):this.random;
    this.worldRandom=this.detailed?fpsSkillRandom(seed,'world-v1'):this.random;
    this.learningRandom=fpsSkillRandom(seed,'navigation-learning-v1');
    this.mechanicsRandom=fpsSkillRandom(seed,'combat-mechanics-learning-v1');
    const movementRandom=fpsSkillRandom(seed,'movement-choice-learning-v1');
    this.movementRandom=movementRandom;
    if(options.learning)this.learner=new FpsLiveLearner(options.learning,this.map);
    if(options.mechanicsLearning)this.mechanicsLearner=new FpsLiveMechanicsLearner(options.mechanicsLearning);
    if(options.movementLearning)this.movementLearnerGlobal=new FpsLiveMovementLearner(options.movementLearning);
    this.onRoundComplete=options.onRoundComplete;
    for(const team of ['blue','red'] as const){
      const settings=options.teamLearning?.[team];
      if(settings?.learning)this.teamLearners[team]=new FpsLiveLearner(settings.learning,this.map);
      if(settings?.mechanicsLearning)this.teamMechanics[team]=new FpsLiveMechanicsLearner(settings.mechanicsLearning);
      if(settings?.movementLearning)this.teamMovement[team]=new FpsLiveMovementLearner(settings.movementLearning);
    }
    const learningState=[this.learner?fpsLearningModelHash(this.learner.initial):'',this.mechanicsLearner?localHash(JSON.stringify(this.mechanicsLearner.initial)): '',
      this.movementLearnerGlobal?localHash(JSON.stringify(this.movementLearnerGlobal.model)): ''].join(':');
    this.learningEpisode=options.episodeId??`${seed}:${localHash(learningState)}`;
    if(this.learningEpisode.length>80)throw Error('Episode identifier too long');
    this.actors=[...blue,...red].map<Actor>((card,index)=>({
      id:card.id,name:card.name,team:index<5?'blue':'red',attacking:index>=5,role:'trade',slot:index%5,
      x:0,z:0,yaw:0,pitch:0,hp:100,armor:0,cash:800,weapon:'pistol',ammo:12,reserve:60,reload:0,reloadDuration:0,reloadSilent:false,reloadRounds:0,
      kills:0,deaths:0,assists:0,scopeState:'hip',scopeLevel:0,scopeUntil:0,damageLedger:new Map(),action:'Buying',bomb:false,kit:false,flash:0,smoke:0,incendiary:0,he:0,blinded:0,channel:0,
      personality:this.identity.players[card.id].personality.name,behavior:emptyFpsObservedBehavior(),
      reaction:.45-clamp((card.stats.positioning??50)/100,0,1)*.2,
      skills:liveSkills(card.stats),exertion:0,callout:this.map.callout(this.map.definition.spawns.attackers),intent:'Prepare the round',
      impact:emptyLiveImpact(),engagementShots:0,engagementDamaged:false,openingAttempted:false,
      speed:0,stance:'hold',crouch:false,crouchUntil:0,vx:0,vz:0,nextFootstep:0,nextAudioFootstep:0,stillSince:0,wasCrouched:false,nextPeek:0,cleared:new Set(),clearUntil:0,lookAwayUntil:0,
      jump:false,jumpY:0,jumpVy:0,nextJump:0,jumpQueued:false,jumpChain:0,strafeDirection:1,strafeUntil:0,glockBurstRemaining:0,
      equipped:'pistol',weaponReady:0,lastSwing:-100,reactionVariation:1,equipUntil:0,
      information:'No current contact — watch the assigned angle',intel:emptyLiveIntel(),intelManaged:false,sentReports:new Map(),
      profile:options.skillProfiles?pinFpsSkillProfile(options.skillProfiles[card.id],card.id):pinFpsSkillProfile(fpsSkillProfileFromAttributes(card.id,card.stats,seed,'2026-11-14T00:00:00.000Z'),card.id),
      motor:emptyFpsSkillDiagnostics(),mentalState:{setback:0,attentionDebt:0,exertion:0},patterns:[],pendingCues:[],recoil:0,recoilPitch:0,preparedError:0,panicUntil:0,flickOvershoot:0,
      motionSamples:new Map(),prefireAt:0,noticedEnemies:[],probeVisited:new Set(),knownSmokes:[],
      acquired:0,nextShot:0,nextThink:0,decision:'prepare',path:[],contactAt:-100,
      lastMoved:-100,lastShot:-100,utilityAt:0,damageAt:-100,
      seenAt:-100,nextSense:0,burst:0,pressure:0,retreatUntil:0,reportAt:-100,stuckFor:0,
    }));
    this.startRound();
  }

  private random=()=>{
    let n=this.randomState+=0x6D2B79F5;
    n=Math.imul(n^(n>>>15),n|1);n^=n+Math.imul(n^(n>>>7),n|61);
    return ((n^(n>>>14))>>>0)/4294967296;
  };
  private skill(p:Actor,key:FpsExecutionChannel,legacy:number):number {return p.profile?fpsAbilityUnit(p.profile,key,LIVE_WEAPONS[p.weapon].category==='sniper'):legacy;}
  private reactionDelay(p:Actor):number {return p.profile?detailedReactionDelay(p.profile,LIVE_WEAPONS[p.weapon].category==='sniper'):liveReactionTime(p.skills,p.pressure,p.exertion);}
  private emit(kind:LiveEvent['kind'],text:string,team?:FpsTeamId,actorId?:string,targetId?:string,headshot?:boolean,weapon?:LiveEquippedWeapon) {
    this.events.push({id:++this.sequence,time:this.time,kind,text,team,actorId,targetId,headshot,weapon});
    if(this.events.length>100)this.events.shift();
  }
  private startRound() {
    for(const learner of Object.values(this.teamLearners))learner.abandonRound();
    for(const learner of Object.values(this.teamMechanics))learner.abandonRound();
    for(const learner of Object.values(this.teamMovement))learner.abandonRound();
    this.learner?.abandonRound();
    this.mechanicsLearner?.abandonRound();
    this.movementLearnerGlobal?.abandonRound();
    this.phase='freeze';this.remaining=15;this.liveElapsed=0;this.roundWinner=undefined;this.roundReason='';
    this.nextBombTick=-1;
    // Regulation: Red attacks in 1..15, Blue attacks in 16..30 (side swap). Overtime MR3 swaps every 3 rounds.
    this.attackTeam=this.round<=30?(this.round<=15?'red':'blue'):((Math.floor((this.round-31)/3)%2)===0?'red':'blue');
    const reset=this.round===1 || this.round===16 || (this.round>=31 && (this.round-31)%3===0);
    
    // Adaptive strategy selection from round history
    // Defenders can adapt to confirmed plants, not the opponents' unexecuted calls.
    const recentAttacks=this.roundHistory.filter(h=>h.attackTeam===this.attackTeam&&h.bombPlanted).slice(-4);
    const bAttacks=recentAttacks.filter(h=>h.attackSite==='B').length;
    const aAttacks=recentAttacks.filter(h=>h.attackSite==='A').length;
    const recentFirstBloods={
      A:this.roundHistory.slice(-6).filter(h=>h.attackTeam===this.attackTeam&&h.firstBloodSite==='A').length,
      B:this.roundHistory.slice(-6).filter(h=>h.attackTeam===this.attackTeam&&h.firstBloodSite==='B').length,
      Mid:this.roundHistory.slice(-6).filter(h=>h.attackTeam===this.attackTeam&&h.firstBloodSite==='Mid').length,
    };
    const isPistol=this.round===1||this.round===16;
    const atkPlan=this.identity.teams[this.attackTeam].plan;
    const defPlan=this.identity.teams[other(this.attackTeam)].plan;
    const archetype=chooseLiveTactic(this.roundHistory,this.attackTeam,isPistol,this.worldRandom,atkPlan,recentFirstBloods);
    let rv=Math.imul((this.randomState^(this.round*0x9e3779b1))|1,0x85ebca6b);
    rv^=rv>>>13;rv=Math.imul(rv,0xc2b2ae35);
    this.roundVariant=((rv^(rv>>>16))>>>0)/4294967296;
    this.tacticArchetype=archetype;
    if(archetype==='rush_a'||archetype==='split_a')this.site='A';
    else if(archetype==='rush_b'||archetype==='split_b')this.site='B';
    else this.site=this.worldRandom()<.5?'A':'B';
    this.fakeSite=archetype==='fake_execute'?(this.site==='A'?'B':'A'):undefined;

    const defenseSetup=chooseLiveDefenseSetup(this.roundHistory,this.attackTeam,{A:aAttacks,B:bAttacks},this.worldRandom,recentFirstBloods,defPlan);
    this.defenseSetup=defenseSetup;

    this.nextInformationProbe={blue:this.time+25,red:this.time+25};
    this.completedSmokeLineups.clear();
    this.openingSmokeTeams.clear();this.corpseDangerRecorded.clear();resetLiveInfluenceGrid(this.influenceGrid('blue'),this.time);resetLiveInfluenceGrid(this.influenceGrid('red'),this.time);resetTacticalBlackboard(this.teamBlackboard('blue'));resetTacticalBlackboard(this.teamBlackboard('red'));this.droppedUtility=[];this.droppedKits=[];this.firstBloodArea=undefined;this.corpses=[];this.teamReports=[];this.smokes=[];this.fires=[];this.blasts=[];this.bloodMarks=[];this.postPlantPlanterId=undefined;this.shots=[];this.noiseMasks=[];this.reports=[];this.droppedWeapons=[];this.pendingBuys.clear();this.planCommit=0;this.roundSiteKills={blue:0,red:0};this.eliminations=[];this.confirmedDeaths.clear();this.grenades=[];this.flashSightings.clear();this.fireCues=[];
    if(reset)this.losses={blue:0,red:0};
    for(const p of this.actors) {
      this.restorePrimary(p);
      p.attacking=p.team===this.attackTeam;
      if(reset){p.cash=this.round>=31?10000:800;p.weapon=p.attacking?'glock':'usp_s';p.ammo=LIVE_WEAPONS[p.weapon].magazine;p.reserve=LIVE_WEAPONS[p.weapon].reserve;p.equipped=p.weapon;p.sidearmLoadout={weapon:p.weapon,ammo:p.ammo,reserve:p.reserve};p.armor=0;p.kit=false;p.flash=0;p.smoke=0;p.incendiary=0;p.he=0;}
      if(p.hp<=0){p.weapon=p.attacking?'glock':'usp_s';p.ammo=LIVE_WEAPONS[p.weapon].magazine;p.reserve=LIVE_WEAPONS[p.weapon].reserve;p.equipped=p.weapon;p.sidearmLoadout={weapon:p.weapon,ammo:p.ammo,reserve:p.reserve};p.armor=0;p.kit=false;p.flash=0;p.smoke=0;p.incendiary=0;p.he=0;}
      if(!p.sidearmLoadout){const side:LiveWeapon=p.attacking?'glock':'usp_s';p.sidearmLoadout={weapon:side,ammo:LIVE_WEAPONS[side].magazine,reserve:LIVE_WEAPONS[side].reserve};}
      p.vaultDrop=undefined;
      if(p.attacking) {
        const spawn=this.map.definition.spawns.attackers;
        const pt=this.map.safePoint({x:spawn.x+(p.slot-2)*2.2,z:spawn.z-(p.slot%2)*1.4,level:spawn.level});
        p.x=pt.x;p.z=pt.z;p.level=pt.level;
        p.yaw=0;
      } else {
        if(this.map.id==='fontessa') {
          if(p.slot<=1) {
            p.x=-3.5-p.slot*2.0;
            p.z=40.0+p.slot*1.5;
          } else if(p.slot===2) {
            p.x=0;
            p.z=42.0;
          } else {
            p.x=3.5+(p.slot-3)*2.2;
            p.z=40.0+(p.slot-3)*1.5;
          }
          p.level=undefined;
        } else {
          const spawn=this.map.definition.spawns.defenders;
          const pt=this.map.safePoint({x:spawn.x+(p.slot-2)*2.1,z:spawn.z-(p.slot%2)*1.2,level:spawn.level});
          p.x=pt.x;p.z=pt.z;p.level=pt.level;
        }
        p.yaw=Math.PI;
      }
      p.freezeDelay=p.slot*0.08;
      p.groundY=this.map.terrain.groundHeight(p);p.jumpY=p.groundY;p.jumpVy=0;p.jump=false;
      p.bombEscape=undefined;p.escapePlan=undefined;p.escapeCheckAt=0;p.buyLook=undefined;
      p.scopeState='hip';p.scopeLevel=0;p.scopeUntil=0;p.scopeHoldUntil=0;p.postAssignment=undefined;p.sampledHeadY=undefined;p.damageLedger?.clear();p.plantStyle=undefined;
      p.motionSamples.clear();p.anticipation=undefined;p.prefireAt=0;
      p.shotCommitUntil=0;p.targetCommitUntil=0;p.sidearmUntil=0;p.retakeWaitUntil=undefined;p.suppression=undefined;
      p.approachUntil=0;p.tacticalChoice=undefined;p.trafficYield=undefined;p.routeRepairAt=0;p.radioAt=-100;p.acknowledgedOrder=undefined;p.strafeSettleUntil=0;p.knownSmokes=[];p.flashWindow=undefined;p.lookAwayStarts=undefined;p.smokeLineupGoal=undefined;p.lastDropAt=-100;p.heardDefuseAt=undefined;p.perchGoal=undefined;
      p.routeEvidence=undefined;p.routeUpdatedAt=undefined;p.objectiveUrgent=false;
      if(reset)p.patterns=[];
      p.fakeDefuseDone=false;
      p.halfDefuseDone=false;
      p.fakeDefuseHoldUntil=undefined;
      p.fakePlantDone=false;
      p.fakePlantHoldUntil=undefined;
      p.triggerDisciplineUntil=undefined;
      p.heardDefuseAt=undefined;
      p.position=this.identity.players[p.id].assignments![p.attacking?'t':'ct'];p.role=fpsExecutionRole(p.position);p.preferSniper=p.position.endsWith('FLEX')&&p.profile!.values.sniping>p.profile!.values.rifling;p.naturalIdentity=naturalFpsIdentity(this.identity.players[p.id].personality,p.position);
      p.hp=100;p.reload=0;p.reloadDuration=0;p.reloadSilent=false;p.reloadRounds=0;p.blinded=0;p.channel=0;p.bomb=false;p.path=[];p.goal=undefined;p.contact=undefined;
      p.target=undefined;p.flashedBy=undefined;p.nextThink=this.time;p.nextShot=this.time;p.contactAt=-100;p.lastMoved=-100;p.lastShot=-100;
      p.nextSense=this.time;p.seenAt=-100;p.burst=0;p.pressure=0;p.retreatUntil=0;p.reportAt=-100;p.stuckFor=0;
      p.watchPoint=undefined;p.aimFocus=undefined;p.exertion=p.profile?p.mentalState.exertion:0;p.intent='Prepare the round';
      p.engagementShots=0;p.engagementDamaged=false;p.openingAttempted=false;
      p.smokeLineupId=undefined;p.smokeLineupGoal=undefined;p.smokeLineupUntil=undefined;p.smokeLineupRetryAt=0;
      p.vx=0;p.vz=0;p.speed=0;p.stance='hold';p.crouch=false;p.crouchUntil=0;p.peek=undefined;p.nextPeek=this.time+17;p.nextFootstep=0;p.nextAudioFootstep=0;p.stillSince=this.time;p.wasCrouched=false;
      p.jump=false;p.jumpY=p.groundY??0;p.jumpVy=0;p.nextJump=this.time+5.5+this.executionRandom()*3.0;p.jumpQueued=false;p.jumpChain=0;p.strafeDirection=1;p.strafeUntil=0;p.glockBurstRemaining=0;
      p.cleared.clear();p.clearUntil=0;p.clearPoint=undefined;p.lookAwayUntil=0;p.lookAwayPoint=undefined;p.probeGoal=undefined;p.probeVisited.clear();p.holdingSince=undefined;p.utilityPreparation=undefined;p.throwAt=undefined;p.throwKind=undefined;p.throwStyle=undefined;
      p.utilityAt=this.time+15;p.throwAt=undefined;p.throwKind=undefined;p.damageAt=-100;p.action='Buying';p.decision='prepare';
      p.buyAt=this.time+0.8+p.slot*.72+(p.team==='red'?.18:0);
      p.aimPoint=undefined;p.reactionVariation=1;p.swingAt=undefined;p.lastSwing=-100;p.equipUntil=0;p.weaponReady=0;
      p.intel=emptyLiveIntel();p.intelManaged=false;p.sentReports.clear();p.information='No current contact — watch the assigned angle';
      p.pendingCues=[];p.recoil=0;p.recoilPitch=0;p.brakeAt=undefined;p.preparedError=0;p.panicUntil=0;p.flickOvershoot=0;p.previousSight=undefined;p.trackingPoint=undefined;p.planAssessmentAt=undefined;p.visualCueAt=undefined;p.noticedEnemies=[];
    }
    for(const team of ['blue','red'] as const) {
      // These are our authored opening lanes, never the opponents' hidden purchases or positions.
      const teamActors=this.actors.filter(p=>p.team===team).map(p=>{
        const site=p.attacking?this.site:this.defenseHome(p);
        const midHold=!p.attacking&&p.position==='CT_FLEX'&&['standard','retake_setup','mid_push'].includes(this.defenseSetup);
        const gallery=!p.attacking&&p.position==='CT_ANCHOR_B'&&['standard','stack_b'].includes(this.defenseSetup);
        const mobile=!p.attacking&&(this.defenseSetup==='aggressive_banana'&&p.slot>=3||this.defenseSetup==='mid_push'&&[2,4].includes(p.slot));
        const tactical=this.map.definition.tactical;
        const hold=!p.attacking&&!mobile?(midHold?tactical.mid.window.hold:gallery?(tactical.B.holds[3]??tactical.B.holds[0])
          :p.role==='anchor'?(tactical.anchorPoints[site][0]):undefined):undefined;
        const approaches=midHold?[tactical.mid.control,tactical.mid.approach]:[...tactical[site].entries,...tactical[site].rally];
        const ranges=hold?approaches.filter(pt=>this.map.sightline(hold,pt,this.map.terrain.groundHeight(hold)+1.6,this.map.terrain.groundHeight(pt)+1.3)).map(pt=>distance(hold,pt)):[];
        const expectedRange=ranges.length?Math.max(...ranges):site==='A'?24:p.attacking?12:26;
        return {...p,sidearm:p.sidearmLoadout?.weapon,expectedRange,holdChoke:!!hold&&p.role==='anchor'&&!gallery&&!midHold&&ranges.length>0&&expectedRange<=22};
      });
      const result=buyLiveTeam(teamActors,this.identity.teams[team].plan,this.round,this.losses[team],this.score[other(team)]>=15||this.round===15||this.round===30,this.actors.filter(p=>p.team===team).reduce((sum,p)=>sum+this.skill(p,'economyJudgment',p.skills.gameSense),0)/5);
      for(const bought of result.players)this.pendingBuys.set(bought.id,bought);
      this.teamBuys[team]={mode:result.mode,reason:result.reason};
      this.emit('economy',`${team==='blue'?'Blue Five':'Red Five'} · ${result.mode.toUpperCase()} buy`,team);
      for(const gift of result.gifts)this.emit('economy',`${this.actors.find(a=>a.id===gift.from)!.name} equips ${this.actors.find(a=>a.id===gift.to)!.name} with ${LIVE_WEAPONS[gift.weapon].name}`,team,gift.from,gift.to);
    }
    this.protocol=createLiveProtocol(this.site,this.time+15,this.tacticArchetype,this.defenseSetup);
    const defReason=defenseSetup==='stack_b'?'Ts favored B — stacking B Basin with delay smokes'
      :defenseSetup==='stack_a'?'Ts favored A — stacking A site crossfires'
      :defenseSetup==='aggressive_banana'?'Taking early Banana contest with utility'
      :defenseSetup==='mid_push'?'Pushing Mid / Underpass to catch Ts off guard'
      :defenseSetup==='retake_setup'?'Flexible connector setup — keep a fast rotate ready'
      :'Standard 2-1-2 defense setup — hold opening angles';
    const atkReason=`Initial lean ${this.site} - gather information, create space and adapt to the call`;

    for(const team of ['blue','red'] as const) {
      this.informationOrders[team]={
        mode:'hold',
        responders:[],
        until:0,
        strength:0,
        reason:team===this.attackTeam?atkReason:defReason,
      };
    }
    for(const p of this.actors)p.equipped=p.weapon;
    // Keep the utility specialist bomb-free so they can pool smokes and throw execute lineups while teammates execute.
    const attackers=this.actors.filter(p=>p.attacking);
    const carrier=attackers.find(p=>p.role==='trade'||p.role==='caller')??attackers.find(p=>p.role==='lurker')??attackers.find(p=>p.role!=='entry'&&p.role!=='support')??attackers.find(p=>p.role==='support')??attackers[0]!;
    carrier.bomb=true;this.bomb={status:'carried',x:carrier.x,z:carrier.z,level:carrier.level,remaining:40};
    const t=this.map.definition.tactical;
    const publicGoals=[...t.A.entries,...t.A.holds,...t.B.entries,...t.B.holds,
      t.mid.control,t.mid.window.hold,t.mid.splits.A,t.mid.splits.B];
    this.navigationWarmups=this.actors.flatMap(actor=>publicGoals.map(to=>({from:{x:actor.x,z:actor.z,level:actor.level},to})));
    this.navigationWarmIndex=0;
    this.emit('round',`Round ${this.round} · buy phase`,this.attackTeam);
  }

  /** Roster plus publicly confirmed deaths. This deliberately never counts hidden living bodies. */
  private knownEnemyCount(team:FpsTeamId):number {
    return this.actors.filter(actor=>actor.team!==team&&!this.confirmedDeaths.has(actor.id)).length;
  }
  private duelCommitted(p:Actor):boolean {
    return (!!p.target&&this.time-p.seenAt<.4)||this.time-p.lastShot<.3||this.time-p.damageAt<.4;
  }
  private allyBlocksShot(p:Actor,target:Actor):boolean {
    const aim=p.profile?(p.trackingPoint??p.aimPoint??target):(p.aimPoint??target);
    const from={x:p.x,y:(p.crouch?1.08:1.6)+p.jumpY,z:p.z};
    const range=distance(p,aim),pitch=Math.atan2(liveActorHeadY(target)-from.y,range||1);
    const direction=liveRayDirection(heading(p,aim),pitch);
    return this.actors.some(ally=>ally!==p&&ally.team===p.team&&ally.hp>0
      &&!!traceLiveActorHit(from,direction,Math.hypot(range,liveActorHeadY(target)-from.y),ally));
  }
  private shouldTurnFromFlash(p:Actor):boolean {
    const point=p.lookAwayPoint;
    if(!point||this.time<(p.lookAwayStarts??0)||this.time>=p.lookAwayUntil)return false;
    const eye=(p.crouch?1.08:1.6)+p.jumpY,y=point.y??this.map.terrain.groundHeight(point)+1.6;
    return Math.hypot(distance(p,point),eye-y)<LIVE_UTILITY_RULES.flashRadius
      &&liveGrenadeSightline({...point,y},{x:p.x,y:eye,z:p.z},this.map);
  }
  private flashSafeYaw(p:Actor):number {
    const bearing=heading(p,p.lookAwayPoint??p),relative=angle(p.yaw-bearing);
    if(Math.abs(relative)>=Math.PI*.58)return p.yaw;
    return angle(bearing+(relative<0?-1:1)*Math.PI*.58);
  }
  private utilitySpecialist(allies:Actor[],allowBomb=false):Actor|undefined {
    return [...allies].filter(a=>a.hp>0&&(allowBomb||!a.bomb)&&a.role!=='entry')
      .sort((a,b)=>Number(b.role==='support')-Number(a.role==='support')
        ||this.skill(b,'utilityExecution',b.skills.teamwork)-this.skill(a,'utilityExecution',a.skills.teamwork)
        ||Number(b.role==='caller')-Number(a.role==='caller')
        ||a.slot-b.slot)[0];
  }
  private nextUncoveredSmokeLineups(team:FpsTeamId):LiveSmokeLineup[] {
    const order=this.informationOrders[team],targetSite=order.site??this.site;
    const rush=(this.tacticArchetype==='rush_a'||this.tacticArchetype==='rush_b')&&this.roundVariant<.55;
    const list:LiveSmokeLineup[]=[];
    if(!this.openingSmokeTeams.has(team)&&!rush&&this.liveElapsed<=18){
      const mid=this.tacticArchetype==='mid_control'||((this.tacticArchetype==='split_a'||this.tacticArchetype==='split_b')&&this.roundVariant<.6);
      const openSite=this.fakeSite&&this.roundVariant<.65?this.fakeSite:targetSite;
      const open=this.map.authoredSmokeLineups.find(l=>l.attacking&&(mid?(l.id==='mid-window'||(l.phase==='opening'&&l.site==='Mid')):l.phase==='opening'&&l.site===openSite));
      if(open&&!this.smokeLineupCovered(team,open))list.push(open);
    }
    for(const l of this.map.authoredSmokeLineups){
      if(l.attacking&&l.phase==='execute'&&l.site===targetSite&&!order.smokeLineupDone?.includes(l.id)&&!this.smokeLineupCovered(team,l)&&!list.includes(l))list.push(l);
    }
    return list;
  }
  private designatedDefuserId(allies:readonly Actor[]):string|undefined {
    if(this.bomb.status!=='planted'||!allies.length||allies[0].attacking)return undefined;
    return assignLiveObjective([...allies],this.bomb,this.bomb.remaining,true,this.map)?.id;
  }
  private stickingFinalDefuse(p:Actor,allies?:readonly Actor[]):boolean {
    if(p.attacking||this.bomb.status!=='planted')return false;
    const squad=allies??this.actors.filter(a=>a.team===p.team&&a.hp>0);
    if(p.id!==this.designatedDefuserId(squad))return false;
    const needed=p.channel>0?Math.min(this.bomb.remaining,Math.max(0,(p.kit?5:10)-p.channel)):this.bomb.remaining;
    return this.bomb.remaining<=(p.kit?5.4:10.4)&&p.hp>needed*42;
  }
  private isWeaponUpgradeFor(player:Actor,w:DroppedWeapon):boolean {
    if(w.ammo+w.reserve<=0)return false;
    const tier=LIVE_WEAPON_TIERS;
    if(player.preferSniper&&w.weapon==='sniper'&&player.weapon!=='sniper')return true;
    if(LIVE_WEAPONS[player.weapon].category==='pistol'){
      if(LIVE_WEAPONS[w.weapon].category!=='pistol')return true;
      const currentSide=player.sidearmLoadout?.weapon??player.weapon;
      return tier[w.weapon]>Math.max(tier[player.weapon],tier[currentSide]);
    }
    if(tier[w.weapon]>tier[player.weapon])return true;
    const side=player.sidearmLoadout?.weapon;
    return LIVE_WEAPONS[w.weapon].category==='pistol'&&!!side&&tier[w.weapon]>tier[side];
  }
  private isInCoverForDrop(p:Actor):boolean {
    return !p.target&&!this.duelCommitted(p)&&!this.inImmediateFight(p)
      &&this.time-p.seenAt>1.2&&this.time-p.damageAt>1.5
      &&!this.activeFireAt(p,.5,p.jumpY);
  }
  private computeDropLandingPoint(donor:Actor,target:FpsPoint):FpsPoint {
    const dx=target.x-donor.x,dz=target.z-donor.z,d=Math.hypot(dx,dz);
    const level=d<=LIVE_MAX_DROP_THROW_DIST?target.level:donor.level;
    const from={x:donor.x,y:donor.jumpY+1.1,z:donor.z};
    if(d<=1e-4){
      return this.map.safePoint({x:donor.x+Math.sin(donor.yaw)*1.1,z:donor.z+Math.cos(donor.yaw)*1.1,level:donor.level});
    }
    const maxDist=Math.min(d,LIVE_MAX_DROP_THROW_DIST);
    for(const scale of [1,.8,.6,.4]){
      const dist=maxDist*scale;
      const cand=this.map.safePoint({
        x:scale===1&&d<=LIVE_MAX_DROP_THROW_DIST?target.x:donor.x+dx/d*dist,
        z:scale===1&&d<=LIVE_MAX_DROP_THROW_DIST?target.z:donor.z+dz/d*dist,
        level:scale===1?level:donor.level,
      });
      if(liveGrenadeSightline(from,{x:cand.x,y:this.map.terrain.groundHeight(cand)+.5,z:cand.z},this.map))return cand;
    }
    return this.map.safePoint({x:donor.x+dx/d*Math.min(1.1,maxDist),z:donor.z+dz/d*Math.min(1.1,maxDist),level:donor.level});
  }
  private canInteractPickup(p:Actor,item:FpsPoint,reservedFor?:string):boolean {
    if(Math.abs(p.jumpY-this.map.terrain.groundHeight(item))>=.8)return false;
    const d=distance(p,item);
    if(d<1.4)return this.map.sightline(p,item);
    if(d>LIVE_INTERACT_PICKUP_DIST||!this.map.sightline(p,item))return false;
    const facing=Math.cos(angle(heading(p,item)-p.yaw))>Math.cos(.85);
    const aimedGoal=!!p.goal&&distance(p.goal,item)<1.1;
    return reservedFor===p.id||aimedGoal||facing;
  }
  private activeFireAt(pt:FpsPoint,pad=.45,groundY?:number):LiveFire|undefined {
    const y=groundY??this.map.terrain.groundHeight(pt);
    return this.fires.find(f=>f.expires>this.time&&distance(pt,f)<=Math.max(f.radius,LIVE_UTILITY_RULES.fireRadius*.6)+pad&&Math.abs(y-this.map.terrain.groundHeight(f))<1.2);
  }
  private escapeFirePoint(p:Actor,fire:LiveFire,preferredGoal?:FpsPoint):FpsPoint {
    const safeR=Math.max(fire.radius,LIVE_UTILITY_RULES.fireRadius)+.75;
    const baseYaw=distance(p,fire)>.12?heading(fire,p):preferredGoal?heading(p,preferredGoal):p.yaw+Math.PI;
    const offsets=[0,.55,-.55,1.1,-1.1,1.7,-1.7,Math.PI*.75,-Math.PI*.75];
    let best:FpsPoint|undefined,bestScore=Infinity;
    for(const off of offsets){
      const a=baseYaw+off;
      const cand=this.map.safePoint({x:fire.x+Math.sin(a)*(safeR+.8),z:fire.z+Math.cos(a)*(safeR+.8),level:p.level});
      if(this.activeFireAt(cand,.35)||!this.map.movementSegmentClear(p,cand))continue;
      const score=distance(p,cand)+(preferredGoal?distance(cand,preferredGoal)*.35:0);
      if(score<bestScore){bestScore=score;best=cand;}
    }
    if(best)return best;
    for(const off of offsets){
      const a=baseYaw+off;
      const cand=this.map.safePoint({x:fire.x+Math.sin(a)*(safeR+1.4),z:fire.z+Math.cos(a)*(safeR+1.4),level:p.level});
      if(!this.activeFireAt(cand,.3))return cand;
    }
    return this.map.safePoint({x:p.x+Math.sin(baseYaw)*2.5,z:p.z+Math.cos(baseYaw)*2.5,level:p.level});
  }
  private funnelTeamSmokes(team:FpsTeamId):void {
    const freezePrep=this.phase==='freeze'&&this.remaining<=3.2&&this.remaining>.4;
    if((this.phase!=='live'&&!freezePrep)||this.bomb.status!=='carried'||team!==this.attackTeam)return;
    const allies=this.actors.filter(a=>a.team===team&&a.hp>0);
    if(allies.length<2)return;
    const util=this.utilitySpecialist(allies);
    if(!util||util.bomb||util.channel>0||this.duelCommitted(util)||this.inImmediateFight(util)||this.activeFireAt(util,.5,util.jumpY))return;
    const order=this.informationOrders[team],executing=this.phase==='live'&&order.mode==='execute'&&liveOrderActive(order,this.time);
    const staging=freezePrep||(this.liveElapsed>=.35&&this.remaining>18);
    if(!staging&&!(executing&&order.executePhase!=='breach'))return;
    if(executing&&order.executePhase==='breach')return;
    const upcoming=this.nextUncoveredSmokeLineups(team);
    if(!executing&&(this.tacticArchetype==='rush_a'||this.tacticArchetype==='rush_b')&&this.roundVariant<.55&&!upcoming.length)return;
    const targetPool=Math.min(3,upcoming.length);
    if(targetPool<=0)return;
    const activeId=util.smokeLineupId??upcoming[0]?.id;
    const secondLineup=util.smoke>0?upcoming.find(l=>l.id!==activeId&&!this.droppedUtility.some(w=>w.team===team&&w.kind==='smoke'&&distance(w,l.position)<2.2)):undefined;
    const primaryLineup=upcoming.find(l=>l.id===activeId)??upcoming[0];
    const targetLineup=secondLineup??primaryLineup;
    const pooledCount=this.droppedUtility.filter(w=>w.team===team&&w.kind==='smoke'&&(w.reservedFor===util.id||distance(w,util)<2.5||(!!targetLineup&&distance(w,targetLineup.position)<3))).length;
    if(util.smoke+pooledCount>=Math.min(3,targetPool))return;
    const spotSight=(a:Actor,pt:FpsPoint)=>liveGrenadeSightline({x:a.x,y:1.5+a.jumpY,z:a.z},{x:pt.x,y:this.map.terrain.groundHeight(pt)+.95,z:pt.z},this.map);
    const atUtilAnchor=util.smokeLineupGoal&&distance(util,util.smokeLineupGoal)<6?util.smokeLineupGoal:util;
    const utilAtPrimary=!!primaryLineup&&distance(util,primaryLineup.position)<5.5;
    const canStageSpot=(a:Actor)=>!!targetLineup&&(!utilAtPrimary||distance(a,util)>8)&&distance(util,targetLineup.position)>=5.5&&distance(a,targetLineup.position)<=6.5&&spotSight(a,targetLineup.position);
    const donors=allies.filter(a=>a!==util&&!a.bomb&&a.smoke>0&&!a.smokeLineupId&&!a.utilityPreparation&&a.channel===0
      &&!(this.fakeSite&&a.role==='lurker')&&this.isInCoverForDrop(a))
      .filter(a=>{
        if(canStageSpot(a))return true;
        const nearUtil=distance(a,atUtilAnchor)<=6.5&&this.map.sightline(a,util);
        if(!nearUtil)return false;
        // During freeze, only funnel at spawn if the first lineup launches from spawn/near; execute smokes stay in pockets until teammates reach staging range.
        if(this.phase==='freeze')return !!primaryLineup&&distance(util,primaryLineup.position)<14;
        const poolLineup=targetLineup??primaryLineup;
        return !poolLineup||distance(util,poolLineup.position)<24||distance(a,poolLineup.position)<22;
      })
      .sort((a,b)=>{
        const aSpot=canStageSpot(a)?0:1;
        const bSpot=canStageSpot(b)?0:1;
        return aSpot-bSpot||Number(b.role!=='entry')-Number(a.role!=='entry')||distance(a,targetLineup?.position??util)-distance(b,targetLineup?.position??util)||a.slot-b.slot;
      });
    const donor=donors[0];
    if(!donor)return;
    const stageAtSpot=canStageSpot(donor);
    const anchor=stageAtSpot?targetLineup!.position:atUtilAnchor;
    const rawDrop=this.map.safePoint({x:anchor.x+(donor.slot%2?1:-1)*.32,z:anchor.z-.22,level:anchor.level??util.level});
    const dropPoint=this.computeDropLandingPoint(donor,rawDrop);
    const flight=clamp(distance(donor,dropPoint)/14,.35,1.15);
    this.droppedUtility.push({
      id:++this.sequence,kind:'smoke',team:donor.team,at:this.time,
      x:dropPoint.x,z:dropPoint.z,level:dropPoint.level,
      from:{x:donor.x,z:donor.z,level:donor.level},fromY:donor.jumpY+1.1,airUntil:this.time+flight,
      reservedFor:util.id,
    });
    donor.smoke--;donor.lastDropAt=this.time;donor.action='Dropping smoke for teammate';
    donor.buyLook={point:{x:dropPoint.x,z:dropPoint.z},until:this.time+.6};
    util.nextThink=Math.min(util.nextThink,this.time+.35);
    this.radio(donor,stageAtSpot?`Staged a smoke on ${this.map.callout(dropPoint)} lineup for ${util.name}!`:`Dropped my smoke for ${util.name} — line 'em up while we set up!`);
    this.emit('economy',`${donor.name} ${stageAtSpot?`drops a smoke at ${this.map.callout(dropPoint)}`:'drops a spare smoke'} for ${util.name}`,donor.team,donor.id,util.id);
  }
  private openingUtility(p:Actor):boolean {
    if(this.openingSmokeTeams.has(p.team)||this.liveElapsed>18||p.bomb||p.smoke<=0||this.duelCommitted(p)||p.channel>0||this.time<(p.smokeLineupRetryAt??0)||this.skill(p,'informationReading',p.skills.gameSense)<.35)return false;
    if(this.actors.some(a=>a!==p&&a.team===p.team&&a.hp>0&&a.smokeLineupId
      &&this.map.authoredSmokeLineups.some(l=>l.id===a.smokeLineupId&&(l.phase==='opening'||l.id==='mid-window'))))return false;
    // Dynamic opening variation: rush plays often skip slow spawn smokes to hit before rotates, while split/fake plays diversify targets.
    if(p.attacking&&(this.tacticArchetype==='rush_a'||this.tacticArchetype==='rush_b')&&this.roundVariant<.55)return false;
    if(!p.attacking&&this.defenseSetup==='standard'&&this.roundVariant<.28)return false;
    const same=this.actors.filter(a=>a.team===p.team&&a.hp>0&&a.smoke>0&&!a.bomb&&!this.duelCommitted(a)
      &&a.channel===0&&this.skill(a,'informationReading',a.skills.gameSense)>=.35)
      .sort((a,b)=>Number(b.role==='support')-Number(a.role==='support')||a.slot-b.slot);
    const lead=same[0];if(!lead)return false;
    const mid=p.attacking&&(this.tacticArchetype==='mid_control'
      ||((this.tacticArchetype==='split_a'||this.tacticArchetype==='split_b')&&this.roundVariant<.6)
      ||(this.tacticArchetype==='default_pick'&&this.roundVariant>.78&&same.length>1));
    const targetSite=p.attacking&&this.fakeSite&&this.roundVariant<.65?this.fakeSite:(p.attacking?this.site:this.defenseHome(lead));
    const ctMid=!p.attacking&&this.defenseSetup==='mid_push'&&this.roundVariant<.55;
    const lineup=this.map.authoredSmokeLineups.find(l=>l.attacking===p.attacking&&(mid?(l.id==='mid-window'||(l.phase==='opening'&&l.site==='Mid')):ctMid?(l.id==='mid-delay'||l.site==='Mid'):l.phase==='opening'&&l.site===targetSite));
    if(!lineup)return false;
    const eligible=same.filter(a=>!this.inImmediateFight(a)).map(actor=>({actor,travel:this.map.pathLength(actor,lineup.position)}))
      .filter(({actor,travel})=>canReachLiveOpeningLineup(travel,this.liveElapsed,this.remaining,
        this.skill(actor,'utilityExecution',actor.skills.teamwork),distance(lineup.position,lineup.target)))
      .sort((a,b)=>Number(b.actor.role==='support')-Number(a.actor.role==='support')||a.travel-b.travel||a.actor.slot-b.actor.slot);
    if(eligible[0]?.actor!==p)return false;
    return this.assignSmokeLineup(p,lineup);
  }
  private clearSmokeLineup(p:Actor):void {
    p.smokeLineupId=undefined;p.smokeLineupGoal=undefined;p.smokeLineupUntil=undefined;
    releaseActorBlackboard(this.teamBlackboard(p.team),p.id,['smoke_lineup']);
  }
  private smokeLineupCovered(team:FpsTeamId,lineup:LiveSmokeLineup):boolean {
    return this.completedSmokeLineups.has(`${team}:${lineup.id}`)
      ||this.actors.some(a=>a.team===team&&a.hp>0&&a.knownSmokes.some(s=>s.expires>this.time+3&&distance(s,lineup.target)<s.radius))
      ||this.grenades.some(g=>g.team===team&&g.kind==='smoke'&&distance(predictLiveGrenade(g,this.time,this.map),lineup.target)<2);
  }
  private assignSmokeLineup(p:Actor,lineup:LiveSmokeLineup):boolean {
    if(this.smokeLineupCovered(p.team,lineup)||this.time<(p.smokeLineupRetryAt??0))return false;
    if(hasBlackboardClaim(this.teamBlackboard(p.team),'smoke_lineup',lineup.id,this.time,p.id))return false;
    if(p.smokeLineupId!==lineup.id){
      if(!Number.isFinite(this.map.pathLength(p,lineup.position)))return false;
      p.smokeLineupId=lineup.id;p.smokeLineupUntil=this.time+12;
      p.peek=undefined;p.clearUntil=0;this.routeLearner(p.team)?.close(p,this.time);
      postBlackboardClaim(this.teamBlackboard(p.team),{actorId:p.id,kind:'smoke_lineup',key:lineup.id,point:lineup.position,until:this.time+12,priority:p.role==='support'?3:2},this.time);
    }
    return this.workSmokeLineup(p,lineup);
  }
  private aimSmokeLineup(p:Actor,lineup:LiveSmokeLineup,dt=LIVE_FPS_STEP):boolean {
    const baseHeight=1.55+(p.groundY??this.map.terrain.groundHeight(p));
    const hand=this.utilityHandPoint(p,lineup.target);
    const solution=solveLiveSmokeThrow(hand,lineup.target,baseHeight,undefined,undefined,this.map);
    const clearSight=liveGrenadeSightline({x:hand.x,y:baseHeight,z:hand.z},{x:lineup.target.x,y:this.map.terrain.groundHeight(lineup.target)+.45,z:lineup.target.z},this.map);
    const desiredYaw=solution?.launchYaw??heading(p,lineup.target);
    const directPitch=clamp(Math.atan2(this.map.terrain.groundHeight(lineup.target)+.45-baseHeight,Math.max(.5,distance(p,lineup.target))),-.45,.55);
    const desiredPitch=solution?.launchPitch??(clearSight?directPitch:.68);
    this.turn(p,desiredYaw);
    p.pitch+=(desiredPitch-p.pitch)*(1-Math.exp(-14*dt));
    p.watchPoint={...lineup.target};p.aimFocus={point:{...lineup.target},source:'hold',until:this.time+1,from:{x:p.x,z:p.z}};
    p.action='Calculating smoke lineup';
    p.intent=desiredPitch>.38?'Look up to clear the obstruction and set the smoke trajectory':'Aim along the clear corridor and prepare the smoke throw';
    if(p.speed>.35||Math.abs(angle(desiredYaw-p.yaw))>.1||this.time<(p.smokeLineupRetryAt??0))return true;
    p.smokeLineupRetryAt=this.time+1;
    this.throwUtility(p,'smoke',lineup.target,solution?.throwStyle,lineup.id);
    return true;
  }
  private workSmokeLineup(p:Actor,lineup:LiveSmokeLineup):boolean {
    if(p.smoke<=0||p.bomb||this.bomb.status!=='carried'||this.remaining<18||this.time>(p.smokeLineupUntil??0)
      ||this.duelCommitted(p)||this.inImmediateFight(p)||this.smokeLineupCovered(p.team,lineup)){
      this.clearSmokeLineup(p);p.smokeLineupRetryAt=this.time+2;return false;
    }
    p.smokeLineupGoal={...lineup.position};p.crouch=false;
    if(p.utilityPreparation)return true;
    if(distance(p,lineup.position)>.55)return true;
    return this.aimSmokeLineup(p,lineup);
  }
  private updateExecute():void {
    const order=this.informationOrders[this.attackTeam];
    if(order.mode!=='execute'||!liveOrderActive(order,this.time)||this.bomb.status!=='carried')return;
    const allies=this.actors.filter(actor=>actor.team===this.attackTeam&&actor.hp>0);
    const positions=this.map.definition.tactical[order.site??this.site],age=this.time-(order.phaseAt??this.time);
    const sitePt=this.map.definition.sites[this.site];
    const entry=allies.find(actor=>actor.id===order.entryId)
      ??allies.filter(actor=>!actor.bomb).sort((a,b)=>Number(b.role==='entry')-Number(a.role==='entry')||distance(a,sitePt)-distance(b,sitePt))[0];
    order.entryId=entry?.id;
    const release=()=>{
      order.executePhase='breach';order.phaseAt=this.time;order.until=this.time+10;
      for(const actor of allies)if(actor.smokeLineupId&&!actor.utilityPreparation)this.clearSmokeLineup(actor);
      // Leave active aim, peeks, recoil recovery and combat movement untouched.
      for(const actor of allies)if(!this.duelCommitted(actor))actor.nextThink=Math.min(actor.nextThink,this.time+.12);
      const caller=allies.find(actor=>actor.id===order.callerId)??allies[0];
      if(caller)this.radio(caller,`Execute ${this.site}. ${allies.length} against ${this.knownEnemyCount(caller.team)}; trade the entry and bring the device.`,true);
    };
    if(order.executePhase==='regroup'){
      const grouped=allies.filter(actor=>positions.entries.some(point=>distance(actor,{x:point.x,z:point.z-4,level:point.level})<7)
        ||!!actor.goal&&distance(actor,actor.goal)<4&&distance(actor,sitePt)<24);
      const entryFight=allies.some(actor=>this.duelCommitted(actor)&&(actor===entry||positions.entries.some(point=>distance(actor,point)<10)));
      if(this.remaining<20||entryFight){release();return;}
      const teamwork=allies.reduce((sum,actor)=>sum+this.skill(actor,'coordination',actor.skills.teamwork),0)/Math.max(1,allies.length);
      const carrier=allies.find(actor=>actor.bomb),carrierReady=!carrier||distance(carrier,sitePt)<25;
      if(grouped.length<Math.min(3,allies.length)||!carrierReady){
        if(age<4.5+(1-teamwork)*2)return;
        // A split team should keep taking reachable space, not announce a breach
        // because a timer expired while the carrier is still crossing the map.
        order.mode='recheck';order.until=this.time+2;order.reason='Regroup incomplete; keep taking space and bring the device';
        return;
      }
      order.executePhase='utility';order.phaseAt=this.time;return;
    }
    if(order.executePhase!=='utility')return;
    if(this.remaining<20||age>12||!!entry&&this.duelCommitted(entry)){release();return;}
    if(allies.some(actor=>actor.utilityPreparation))return;
    if(this.time<(order.nextUtilityAt??0))return;
    order.nextUtilityAt=this.time+.2;
    const specialist=this.utilitySpecialist(allies);
    const candidates=allies.filter(actor=>actor!==entry&&!actor.bomb&&!actor.channel&&!actor.reload
      &&actor.weaponReady===0&&this.time>=actor.utilityAt&&!this.inImmediateFight(actor))
      .sort((a,b)=>Number(b===specialist)-Number(a===specialist)||Number(b.role==='support')-Number(a.role==='support')||Number(b.role==='caller')-Number(a.role==='caller')||a.slot-b.slot);
    const authored=this.map.authoredSmokeLineups.filter(lineup=>lineup.phase==='execute'&&lineup.site===this.site);
    const reference=specialist??entry??allies[0],caller=allies.find(actor=>actor.id===order.callerId)??reference;
    const lineups=order.smokeLineupOrder?order.smokeLineupOrder.flatMap(id=>authored.filter(l=>l.id===id))
      :reference?rankLiveSmokeLineups(authored,{from:reference,beliefs:liveIntelBeliefs(caller.intel,this.time),travelTo:point=>{
        const routes=candidates.filter(actor=>actor.smoke>0).map(actor=>{
          const travel=this.map.pathLength(actor,point);return travel<(actor===specialist?26:20)?travel:Infinity;
        });
        return routes.length?Math.min(...routes):Infinity;
      }}):authored;
    order.smokeLineupOrder??=lineups.map(l=>l.id);
    const sent=order.smokesSent??0,done=order.smokeLineupDone??=lineups.slice(0,sent).map(l=>l.id);
    const smokeLimit=sent===0?lineups.length:((this.tacticArchetype==='rush_a'||this.tacticArchetype==='rush_b')&&this.roundVariant<.45?1:lineups.length);
    if(done.length<smokeLimit){
      const lineup=lineups.find(l=>!done.includes(l.id))!;
      if(this.smokeLineupCovered(this.attackTeam,lineup)){
        done.push(lineup.id);
        if(this.completedSmokeLineups.has(`${this.attackTeam}:${lineup.id}`))order.smokesSent=sent+1;
        return;
      }
      const assigned=allies.find(actor=>actor.smokeLineupId===lineup.id);
      if(assigned){
        if(this.workSmokeLineup(assigned,lineup))return;
        done.push(lineup.id);return;
      }
      // Prefer the designated utility player for all execute smokes so the other four teammates hold space and execute together.
      const throwers=candidates.filter(actor=>actor.smoke>0&&!actor.smokeLineupId&&this.time>=(actor.smokeLineupRetryAt??0))
        .map(actor=>({actor,travel:this.map.pathLength(actor,lineup.position)}))
        .filter(a=>a.travel<(a.actor===specialist?26:20))
        .sort((a,b)=>Number(b.actor===specialist)-Number(a.actor===specialist)||a.travel-b.travel||Number(b.actor.role==='support')-Number(a.actor.role==='support')||a.actor.slot-b.actor.slot);
      const thrower=throwers[0]?.actor;
      if(thrower&&this.assignSmokeLineup(thrower,lineup)){thrower.nextThink=this.time;return;}
      const droppedForSpecialist=!!specialist&&specialist.hp>0&&!specialist.bomb
        &&this.droppedUtility.some(w=>w.team===this.attackTeam&&w.kind==='smoke'&&(!w.reservedFor||w.reservedFor===specialist.id)&&(distance(w,specialist)<16||distance(w,lineup.position)<4));
      if((!droppedForSpecialist&&!allies.some(actor=>actor.smoke>0&&!actor.bomb&&actor!==entry))||age>8)done.push(lineup.id);
      return;
    }
    if(!order.flashSent){
      const thrower=candidates.find(actor=>actor.flash>0&&distance(actor,positions.flash)<26);
      if(!thrower||this.throwUtility(thrower,'flash',positions.flash)||age>4.5)order.flashSent=true;
      return;
    }
    if(this.time>=Math.max((order.phaseAt??this.time)+1.2,order.breachAt??0)
      &&(!entry||entry.equipped===entry.weapon&&entry.weaponReady===0))release();
  }
  private executeGoal(p:Actor,allies:Actor[]):FpsPoint|undefined {
    const order=this.informationOrders[p.team];
    if(!p.attacking||order.mode!=='execute'||!liveOrderActive(order,this.time)||this.bomb.status!=='carried'
      ||this.duelCommitted(p)||p.channel>0||allies.some(a=>a.bomb&&(a.channel>0||a.equipped==='bomb'))||p.retreatUntil>this.time||this.remaining<15)return;
    if(p.bomb)return;
    const siteKey=order.site??this.site,site=this.map.definition.sites[siteKey],breaching=order.executePhase==='breach';
    const candidates=liveAssaultApproaches(siteKey,p,this.map);
    if(!breaching&&order.executePhase==='utility'&&p.role==='lurker'&&this.tacticArchetype!=='rush_a'&&this.tacticArchetype!=='rush_b'&&this.roundVariant<.65){
      const flank=candidates.find(c=>c.purpose==='flank');
      if(flank){p.intent=`Hold ${flank.key} split angle while utility lines up`;return flank.point;}
    }
    const options=breaching?candidates:candidates.filter(c=>c.purpose==='entry'||c.purpose==='flank').map(c=>({
      ...c,point:this.map.safePoint({x:c.point.x,z:c.point.z-(c.purpose==='entry'?1.6:0),level:c.point.level})}));
    const selected=this.selectTacticalApproach(p,options,allies,breaching?'breach':'regroup',site,this.remaining);
    if(!selected)return;
    const leader=allies.find(actor=>actor.id===order.entryId),preferences=fpsBehaviorPreferences(this.identity.players[p.id].personality);
    if(breaching&&leader&&leader!==p&&distance(leader,selected.point)<12&&distance(p,leader)<12
      &&preferences.coordination>.5&&p.decision!=='improvise'&&['trade','caller','support'].includes(p.role)){
      const d=distance(leader,site)||1,spacing=(p.role==='support'?4:2.7)+(1-this.skill(p,'trading',p.skills.teamwork))*1.8,side=p.slot%2?-.65:.65;
      p.intent='Follow the entry with an open firing lane and trade distance';
      return this.map.safePoint({x:leader.x+(leader.x-site.x)/d*spacing+(leader.z-site.z)/d*side,
        z:leader.z+(leader.z-site.z)/d*spacing-(leader.x-site.x)/d*side,level:leader.level});
    }
    p.intent=breaching?`Choose ${selected.key} to clear site with the team`
      :order.executePhase==='utility'?`Cover utility from ${selected.key}`:`Regroup through ${selected.key}; keep trade support`;
    return selected.point;
  }
  private selectTacticalApproach(p:Actor,candidates:LiveApproach[],allies:Actor[],phase:'regroup'|'breach'|'retake',objective:FpsPoint,remaining:number):LiveApproach|undefined {
    const preferences=fpsBehaviorPreferences(this.identity.players[p.id].personality),previous=p.tacticalChoice;
    const heatAt=this.heatSampler(p.team),uncertaintyAt=this.uncertaintySampler(p.team);
    const beliefs=liveIntelBeliefs(p.intel,this.time),routeTo=createLiveRoutePlanner(p,beliefs,0,heatAt,this.map);
    const claimedGoals=blackboardClaimedPoints(this.teamBlackboard(p.team),this.time,p.id);
    const selected=chooseLiveApproach(candidates,{position:p,role:p.role,remaining,judgment:this.skill(p,'decisionMaking',p.skills.gameSense),
      behavior:preferences,decision:p.decision,allies:allies.filter(a=>a!==p),alliedGoals:[...allies.filter(a=>a!==p&&a.goal).map(a=>a.goal!),...claimedGoals],
      beliefs,routeTo,previous:previous?.phase===phase?previous.key:undefined,committed:previous?.phase===phase&&this.time<previous.until,
      visited:new Set(),execute:phase!=='retake',phase,objective,health:p.hp,
      entrySkill:this.skill(p,'peeking',p.skills.mechanics),utilitySkill:this.skill(p,'utilityExecution',p.skills.teamwork),
      firepower:this.skill(p,'precision',p.skills.mechanics),preferredRange:LIVE_WEAPONS[p.weapon].category==='sniper'?16:p.role==='entry'?6:p.hp<45?12:9,heatAt,uncertaintyAt},this.worldRandom);
    if(selected&&(!previous||previous.phase!==phase||previous.key!==selected.key||this.time>=previous.until))
      p.tacticalChoice={key:selected.key,phase,until:this.time+1.5+preferences.deliberation*2};
    return selected;
  }
  private updateProtocol() {
    const phase:LiveAttackPhase=this.bomb.status==='planted'?'post-plant'
      :this.actors.some(p=>p.attacking&&p.hp>0&&(p.target!==undefined||distance(p,this.map.definition.sites[this.site])<16))?'entry':'default';
    if(phase!==this.protocol.phase){this.protocol.phase=phase;this.protocol.phaseAt=this.time;}
  }
  private inImmediateFight(p:Actor):boolean {
    if(this.time-p.damageAt<1.35)return true;
    const selected=this.actors.find(enemy=>enemy.id===p.target&&enemy.team!==p.team&&enemy.hp>0);
    if(selected&&distance(p,selected)<22&&(this.visible(p,selected,false)||this.time-p.acquired<1.2))return true;
    return this.actors.some(enemy=>enemy.team!==p.team&&enemy.hp>0&&distance(p,enemy)<22&&this.visible(p,enemy));
  }
  private utilityHandPoint(p:Actor,target:FpsPoint):FpsPoint {
    const yaw=heading(p,target);
    return {level:p.level,x:p.x+Math.sin(yaw)*.2+Math.cos(yaw)*.16,z:p.z+Math.cos(yaw)*.2-Math.sin(yaw)*.16};
  }
  private previewUtility(p:Actor,kind:LiveGrenadeKind,target:FpsPoint,style:LiveThrowStyle,equipDelay=.55,flightTime?:number):LiveGrenade {
    const releaseAt=this.time+equipDelay+.2;
    const momentum={x:0,z:0};
    const baseHeight=1.55+(p.groundY??this.map.terrain.groundHeight(p));
    return predictLiveGrenade(launchLiveGrenade(-1,kind,p.id,p.team,this.utilityHandPoint(p,target),target,releaseAt,false,style,baseHeight,momentum,flightTime,this.map),releaseAt,this.map);
  }
  private safeUtilitySetup(p:Actor,kind:LiveGrenadeKind,forecast:LiveGrenade):boolean {
    const allies=this.actors.filter(a=>a.team===p.team&&a.hp>0);
    if(kind==='flash'&&allies.some(a=>{
      const eye=(a.crouch?1.08:1.6)+a.jumpY;
      const exposed=Math.hypot(distance(a,forecast),forecast.y-eye)<LIVE_UTILITY_RULES.flashRadius
        &&liveGrenadeSightline(forecast,{x:a.x,y:eye,z:a.z},this.map);
      return exposed&&(a.channel>0||this.duelCommitted(a)&&Math.cos(angle(heading(a,forecast)-a.yaw))>0);
    }))return false;
    const hazardRadius=kind==='he'?LIVE_HE_RULES.damageRadius:kind==='incendiary'?LIVE_UTILITY_RULES.fireRadius:0;
    if(hazardRadius>0&&allies.some(a=>distance(a,forecast)<hazardRadius))return false;
    return true;
  }
  private prepareFlashTeam(p:Actor,forecast:LiveGrenade):void {
    const comm=this.skill(p,'communication',p.skills.teamwork),teamChem=this.identity.teams[p.team].chemistry.communication;
    for(const ally of this.actors.filter(a=>a.team===p.team&&a.hp>0&&distance(a,forecast)<22)){
      const eye=(ally.crouch?1.08:1.6)+ally.jumpY;
      const exposed=Math.hypot(distance(ally,forecast),forecast.y-eye)<LIVE_UTILITY_RULES.flashRadius
        &&liveGrenadeSightline(forecast,{x:ally.x,y:eye,z:ally.z},this.map);
      const allyCoord=this.skill(ally,'coordination',ally.skills.teamwork);
      // Low communication/chemistry or mid-duel distraction can miss the turn-away warning cleanly.
      const warningChance=ally===p?1:Math.min(.97,.42+comm*.35+teamChem*.15+allyCoord*.1-(this.duelCommitted(ally)?.32:0));
      if(exposed&&Math.cos(angle(heading(ally,forecast)-ally.yaw))>-.25&&this.executionRandom()<warningChance){
        const delay=.12+(1-comm)*.3+(1-teamChem)*.15;
        ally.lookAwayStarts=Math.max(this.time+delay,forecast.detonateAt-.45);
        ally.lookAwayUntil=forecast.detonateAt+.04;ally.lookAwayPoint={x:forecast.x,y:forecast.y,z:forecast.z};
      }
      if(ally!==p&&!this.duelCommitted(ally)){
        const release=.02+(1-allyCoord)*.25;
        ally.flashWindow={point:{x:forecast.x,z:forecast.z},opens:forecast.detonateAt+release,expires:forecast.detonateAt+1.15};
        ally.decision='pressure';
        ally.watchPoint={x:forecast.x,z:forecast.z};
        ally.nextThink=Math.min(ally.nextThink,forecast.detonateAt+release);
        if(ally.profile)ally.motor.entryReleaseDelay=release;
      }
    }
  }
  private chooseUtilityThrowStyle(p:Actor,kind:LiveGrenadeKind,target:FpsPoint,authoredStyle?:LiveThrowStyle):LiveThrowStyle {
    if(authoredStyle)return authoredStyle;
    if(p.jump&&p.crouch)return 'crouch-jump';
    if(p.jump&&p.speed>2.4)return 'run-jump';
    if(p.jump&&p.speed>.55)return 'walk-jump';
    if(p.jump)return 'jump';
    if(p.crouch)return 'crouch';
    const range=distance(p,target),blockedThrow=!this.map.sightline(p,target);
    const dropHeight=this.map.terrain.groundHeight(p)-this.map.terrain.groundHeight(target);
    if(!blockedThrow&&(range<7.8||(dropHeight>=.85&&range<13.5)||((kind==='smoke'||kind==='flash')&&range<9.2&&p.speed<2.2)))return 'underhand';
    if(range>35.5)return p.speed>2.4?'run-jump':'walk-jump';
    if(range>29.5||(blockedThrow&&range>22))return p.speed>.65?'walk-jump':'jump';
    if(p.speed>2.5)return 'running-bounce';
    if(!blockedThrow&&range<12.2)return 'medium';
    if(!blockedThrow&&range<=24.5)return p.speed>.65?'walk':'standard';
    if(p.speed>.65||range>25.5)return 'walk';
    return blockedThrow?'overhead':'standard';
  }
  private throwUtility(p:Actor,kind:LiveGrenadeKind,target:FpsPoint,authoredStyle?:LiveThrowStyle,lineupId?:string):boolean {
    if(p.utilityPreparation)return p.utilityPreparation.kind===kind&&(!lineupId||p.utilityPreparation.lineupId===lineupId);
    const postThrowLock=(p.throwAt!==undefined&&this.time-p.throwAt<.65)||(p.weaponReady>0&&p.equipped!==p.weapon&&p.equipped!=='knife');
    if(p.hp<=0||p.channel>0||p.reload>0||postThrowLock||this.time<p.utilityAt||distance(p,target)>44||p[kind]<=0||this.inImmediateFight(p))return false;
    if(kind==='smoke'&&(p.knownSmokes.some(s=>s.expires>this.time+2&&distance(s,target)<s.radius)||this.grenades.some(g=>g.team===p.team&&g.kind==='smoke'&&distance(predictLiveGrenade(g,this.time,this.map),target)<3)))return false;
    let throwStyle=this.chooseUtilityThrowStyle(p,kind,target,authoredStyle);
    const desired=target;
    if(p.profile)target=detailedThrowPoint(p.profile,p,target,this.executionRandom);
    const preferredSmokeStyle=authoredStyle??(throwStyle==='underhand'?'underhand':undefined);
    const baseHeight=1.55+(p.groundY??this.map.terrain.groundHeight(p));
    const hand=this.utilityHandPoint(p,target),tol=kind==='flash'?2.5:3;
    const busyAllies=kind==='flash'
      ?this.actors.filter(a=>a!==p&&a.team===p.team&&a.hp>0&&(a.channel>0||this.duelCommitted(a)))
        .map(a=>({x:a.x,z:a.z,yaw:a.yaw,crouch:a.crouch,jumpY:a.jumpY}))
      :[];
    let solution=kind==='smoke'?solveLiveSmokeThrow(hand,target,baseHeight,preferredSmokeStyle,undefined,this.map):undefined;
    if(kind==='smoke'&&!solution&&(authoredStyle||lineupId||p.profile)){
      const slack=Math.min(1.65,Math.max(.9,distance(desired,target)+.45));
      solution=solveLiveSmokeThrow(hand,target,baseHeight,preferredSmokeStyle,slack,this.map);
      if(!solution&&lineupId)solution=solveLiveSmokeThrow(hand,{x:(desired.x+target.x)*.5,z:(desired.z+target.z)*.5},baseHeight,preferredSmokeStyle,slack,this.map);
    }
    if(kind==='flash'&&!authoredStyle){
      const pop=solveLivePopFlash(hand,target,baseHeight,busyAllies,this.map);
      if(pop&&this.safeUtilitySetup(p,'flash',pop.forecast))solution=pop;
    }
    if(kind==='smoke'&&!solution)return false;
    if(solution)throwStyle=solution.throwStyle;
    const draw=liveDrawTime(kind),pin=.48+(1-this.skill(p,'utilityExecution',p.skills.mechanics))*.30,setup=draw+pin;
    const targetEye={x:target.x,y:this.map.terrain.groundHeight(target)+1.5,z:target.z};
    const onTarget=(g:LiveGrenade)=>distance(g,target)<=tol||((kind==='flash'||kind==='he')&&distance(g,target)<=tol+(kind==='flash'?2.5:0)&&g.y-this.map.terrain.groundHeight(target)>=.04&&g.y-this.map.terrain.groundHeight(target)<=(kind==='flash'?9.5:7.5)&&liveGrenadeSightline(g,targetEye,this.map));
    let previewLaunch=solution?undefined:launchLiveGrenade(-1,kind,p.id,p.team,hand,target,this.time+setup+.2,false,throwStyle,baseHeight,{x:0,z:0},undefined,this.map);
    let forecast=solution?.forecast??predictLiveGrenade(previewLaunch!,this.time+setup+.2,this.map);
    if(!solution&&!authoredStyle&&(!onTarget(forecast)||!this.safeUtilitySetup(p,kind,forecast))){
      for(const fallback of ['standard','medium','overhead','underhand'] as const){
        if(fallback===throwStyle)continue;
        const cand=launchLiveGrenade(-1,kind,p.id,p.team,hand,target,this.time+setup+.2,false,fallback,baseHeight,{x:0,z:0},undefined,this.map);
        const fCand=predictLiveGrenade(cand,this.time+setup+.2,this.map);
        if(onTarget(fCand)&&this.safeUtilitySetup(p,kind,fCand)){throwStyle=fallback;previewLaunch=cand;forecast=fCand;break;}
      }
      if(!onTarget(forecast)||!this.safeUtilitySetup(p,kind,forecast)){
        const solved=solveLiveGrenadeThrow(kind,hand,target,baseHeight,undefined,tol,this.map);
        if(solved&&this.safeUtilitySetup(p,kind,solved.forecast)){
          solution=solved;throwStyle=solved.throwStyle;forecast=solved.forecast;
        }
      }
    }
    if((!solution&&!onTarget(forecast))||!this.safeUtilitySetup(p,kind,forecast))return false;
    if(p.profile){p.motor.throws++;p.motor.throwErrorSum+=distance(desired,target);}
    const launchAngles=solution?{yaw:solution.launchYaw,pitch:solution.launchPitch}:computeLiveThrowAngles(previewLaunch!);
    const nearbyMate=this.actors.find(a=>a!==p&&a.team===p.team&&a.hp>0&&distance(p,a)<18);
    const lineupComm=lineupId?SMOKE_LINEUP_COMMS[lineupId]:undefined;
    p.utilityPreparation={kind,target:{...target},...(solution?.aimTarget?{aimTarget:{...solution.aimTarget}}:{}),startedAt:this.time,equipAt:this.time+draw,readyAt:this.time+setup,throwStyle,flightTime:solution?.flightTime,lineupId,launchYaw:launchAngles.yaw,launchPitch:launchAngles.pitch,pinHeard:false};
    postBlackboardClaim(this.teamBlackboard(p.team),{actorId:p.id,kind:kind==='smoke'&&lineupId?'smoke_lineup':'throw_utility',key:lineupId??`${kind}:${Math.round(target.x/4)}:${Math.round(target.z/4)}`,point:target,until:this.time+setup+2.2,priority:p.role==='support'?3:1},this.time,false);
    this.equip(p,kind);
    p.throwKind=kind;p.throwStyle=throwStyle;p.weaponReady=setup;p.equipUntil=this.time+setup+.65;p.action=`Setting up ${kind}`;p.intent='Equip utility, check teammates, then release';
    this.radio(p,lineupComm?lineupComm.prep:kind==='flash'?(nearbyMate?`Flashing for you ${nearbyMate.name}, get ready to swing on the pop!`:'Flashing out — turn away and swing on the pop!'):kind==='smoke'?`Smoking ${this.map.callout(forecast)} for us — hold your angle.`:`Preparing ${kind} for ${this.map.callout(forecast)} — hold the lane.`);
    this.emit('utility',`${p.name} equips ${kind}`,p.team,p.id);
    return true;
  }
  private cancelUtilityPreparation(p:Actor):void {
    p.utilityPreparation=undefined;p.throwKind=undefined;p.throwAt=undefined;p.throwStyle=undefined;p.equipUntil=this.time;
    releaseActorBlackboard(this.teamBlackboard(p.team),p.id,['throw_utility','smoke_lineup']);
    this.equip(p,p.weapon);p.utilityAt=Math.max(p.utilityAt,this.time+1.5);p.action='Drawing weapon after cancelled utility';
  }
  private releaseUtilityPreparation(p:Actor):void {
    const preparation=p.utilityPreparation;if(!preparation)return;
    if(p.hp<=0||p[preparation.kind]<=0||this.inImmediateFight(p)||(!!this.activeFireAt(p,.5,p.jumpY)&&!this.stickingFinalDefuse(p))){this.cancelUtilityPreparation(p);return;}
    if(this.time<preparation.readyAt)return;
    if(!preparation.pinHeard){preparation.pinHeard=true;this.hear(p,11,'utility');}
    const aimTarget=preparation.aimTarget??preparation.target;
    const forecast=this.previewUtility(p,preparation.kind,aimTarget,preparation.throwStyle,0,preparation.flightTime);
    if(!this.safeUtilitySetup(p,preparation.kind,forecast)||preparation.kind==='smoke'
      &&(distance(forecast,preparation.target)>1.5||forecast.y>this.map.terrain.groundHeight(preparation.target)+.6)){this.cancelUtilityPreparation(p);return;}
    const target=preparation.target,kind=preparation.kind,releaseAt=this.time+.2;
    const order=this.informationOrders[p.team];
    const chainExecuteUtility=order.mode==='execute'&&order.executePhase==='utility'&&this.actors.some(a=>a.team===p.team&&a.hp>0&&a!==p);
    p.utilityPreparation=undefined;p[kind]--;p.utilityAt=this.time+(chainExecuteUtility?.9:8);p.throwAt=this.time;p.throwKind=kind;p.throwStyle=preparation.throwStyle;
    releaseActorBlackboard(this.teamBlackboard(p.team),p.id,['smoke_lineup']);
    postBlackboardClaim(this.teamBlackboard(p.team),{actorId:p.id,kind:'throw_utility',key:`${kind}:${Math.round(target.x/4)}:${Math.round(target.z/4)}`,point:target,until:releaseAt+1.8,priority:p.role==='support'?3:1},this.time,false);
    p.equipped=kind;p.weaponReady=.65;p.equipUntil=this.time+.65;
    const handPoint=this.utilityHandPoint(p,aimTarget);
    const baseHeight=1.55+(p.groundY??this.map.terrain.groundHeight(p));
    const grenade=launchLiveGrenade(++this.sequence,kind,p.id,p.team,handPoint,aimTarget,releaseAt,false,preparation.throwStyle,baseHeight,{x:0,z:0},preparation.flightTime,this.map);
    const isJumpThrow=preparation.throwStyle==='jump'||preparation.throwStyle==='crouch-jump'||preparation.throwStyle==='walk-jump'||preparation.throwStyle==='run-jump';
    if(isJumpThrow&&!p.jump){
      p.jump=true;p.jumpVy=LIVE_JUMP_VELOCITY;
      this.jumpSound(p,'takeoff');
    }
    if(preparation.throwStyle==='walk-jump'||preparation.throwStyle==='run-jump'||preparation.throwStyle==='walk'||preparation.throwStyle==='step'){
      const impulseSpeed=preparation.throwStyle==='run-jump'?3.6:preparation.throwStyle==='walk-jump'?2.2:1.65;
      p.vx=Math.sin(preparation.launchYaw)*impulseSpeed;p.vz=Math.cos(preparation.launchYaw)*impulseSpeed;p.speed=impulseSpeed;
    }
    if(isJumpThrow)p.action=preparation.throwStyle==='walk-jump'?'Walk-jump throwing':preparation.throwStyle==='run-jump'?'Run-jump throwing':'Jump throwing';
    this.grenades.push(grenade);
    this.audioCues.push({kind:'grenadeThrow',grenade:kind,throwStyle:preparation.throwStyle,x:handPoint.x,y:baseHeight,z:handPoint.z});
    const lineup=this.map.authoredSmokeLineups.find(l=>l.id===preparation.lineupId);
    const lineupComm=lineup?SMOKE_LINEUP_COMMS[lineup.id]:undefined;
    if(lineup){
      this.completedSmokeLineups.add(`${p.team}:${lineup.id}`);
      if(lineup.phase==='opening'||lineup.id==='mid-window'&&this.liveElapsed<30)this.openingSmokeTeams.add(p.team);
      this.clearSmokeLineup(p);
      this.radio(p,lineupComm?lineupComm.thrown:`${lineup.name} smoke released — play off it.`,true);
    }
    if(order.mode==='execute'&&order.executePhase==='utility')order.breachAt=Math.max(order.breachAt??0,grenade.detonateAt+(kind==='flash'?.14:kind==='smoke'?1.2:.05));
    const landing=predictLiveGrenade(grenade,this.time,this.map);
    const nearbyMate=this.actors.find(a=>a!==p&&a.team===p.team&&a.hp>0&&distance(p,a)<18);
    if(kind==='flash')this.prepareFlashTeam(p,landing);
    if(!lineup){
      this.radio(p,kind==='flash'?(nearbyMate?`Flashing for you bro, swing on the pop!`:`Flash out ${this.map.callout(landing)} — turn away, swinging now!`):kind==='smoke'?`Smoking ${this.map.callout(landing)} — watch the edges!`:kind==='he'?`HE out ${this.map.callout(landing)}, play off the blast!`:`Mollying ${this.map.callout(landing)} to flush them out!`,true);
    }
    this.emit('utility',`${p.name} throws ${kind}`,p.team,p.id);
  }
  private disturbSmoke(smoke:LiveSmoke,strength:number,until:number) {
    smoke.disturbance=Math.max(smoke.disturbance??0,strength);
    smoke.disturbedUntil=Math.max(smoke.disturbedUntil??0,until);
  }
  private extinguishFire(point:FpsPoint) {
    const count=this.fires.filter(fire=>distance(point,fire)<=LIVE_HE_RULES.smokeClearanceRadius).length;
    if(!count)return;
    this.fires=this.fires.filter(fire=>distance(point,fire)>LIVE_HE_RULES.smokeClearanceRadius);
    this.emit('utility',`Smoke extinguishes ${count===1?'incendiary fire':`${count} incendiary zones`}`);
  }
  private cancelReload(p:Actor):void {
    if(p.reload>0)p.reserve+=p.reloadRounds;
    p.reload=0;p.reloadDuration=0;p.reloadSilent=false;p.reloadRounds=0;
  }
  private beginReload(p:Actor) {
    const weapon=LIVE_WEAPONS[p.weapon];
    if(p.utilityPreparation||p.weaponReady>0||p.reload>0||p.reserve<=0||p.ammo>=weapon.magazine)return;
    if(p.equipped!==p.weapon){this.equip(p,p.weapon);return;}
    const nearbyEnemy=liveIntelBeliefs(p.intel,this.time).some(contact=>contact.certainty>.3&&contact.age<4&&distance(contact,p)<20);
    const visiblePressure=this.actors.some(a=>a.team!==p.team&&a.hp>0&&distance(a,p)<20&&this.visible(p,a,false));
    const livingAllies=this.actors.filter(a=>a.team===p.team&&a.hp>0).length;
    const livingEnemies=this.knownEnemyCount(p.team);
    const clutch=livingAllies<=1&&livingEnemies>=1&&livingEnemies<=2;
    const silent=!visiblePressure&&(clutch||nearbyEnemy||p.role==='lurker');
    p.reloadRounds=Math.min(weapon.magazine-p.ammo,p.reserve);
    p.reserve-=p.reloadRounds;
    p.reloadSilent=silent;
    p.reloadDuration=weapon.reload*(silent?1.55:1);
    p.reload=p.reloadDuration;
    if(!silent){
      this.audioCues.push({kind:'reload',x:p.x,z:p.z});
      this.hear(p,17,'reload');
    }
  }
  private stepGrenades(dt:number) {
    for(const grenade of this.grenades) {
      const frameStart=this.time-dt;
      if(this.time<=grenade.releaseAt)continue;
      const flightStart=Math.max(frameStart,grenade.releaseAt);
      const flightEnd=Math.min(this.time,grenade.detonateAt);
      const before={x:grenade.x,y:grenade.y,z:grenade.z,level:grenade.level,vy:grenade.vy};
      if(flightEnd>flightStart)stepLiveGrenade(grenade,flightEnd-flightStart,this.map);
      if(grenade.kind==='incendiary'&&grenadeHitHorizontalSurface(before,grenade,this.map)){
        grenade.detonateAt=Math.min(grenade.detonateAt,this.time);
      }
      if(grenade.kind==='smoke'&&this.time>=grenade.detonateAt&&!isGrenadeOnSupportSurface(grenade,this.map)
        &&this.time-grenade.releaseAt<LIVE_UTILITY_FUSES.smokeMaxFlight){
        grenade.detonateAt=this.time+dt;continue;
      }
      if(this.time<grenade.detonateAt)continue;
      this.flashSightings.delete(grenade.id);
      // Sample the detonation cue before its new smoke/flash blocks the observer's perception.
      const cueObservers=this.actors.filter(a=>a.team!==grenade.team&&a.hp>0&&distance(a,grenade)<24&&this.observablePoint(a,grenade));
      let fireLabel='Incendiary spreads';
      if(grenade.kind==='smoke'){
        this.smokes.push({id:grenade.id,x:grenade.x,z:grenade.z,level:grenade.level,y:grenade.y+1.35,startedAt:this.time,radius:.05,expires:this.time+LIVE_UTILITY_RULES.smokeDuration});
        this.audioCues.push({kind:'smokeBloom',x:grenade.x,y:grenade.y,z:grenade.z});
        this.extinguishFire(grenade);
        for(const ally of this.actors.filter(a=>a.team===grenade.team&&a.hp>0&&distance(a,grenade)<22&&!this.duelCommitted(a))){
          ally.nextThink=Math.min(ally.nextThink,this.time+.05);
        }
      } else if(grenade.kind==='incendiary'){
        const ownerActor=this.actors.find(a=>a.id===grenade.actorId);
        const isMolotov=ownerActor?ownerActor.attacking:grenade.team===this.attackTeam;
        const floorBelow=Math.max(this.map.terrain.groundHeight(grenade),this.map.supportHeight(grenade,grenade.y));
        const groundContact=grenade.y-floorBelow<=2.2;
        const coveredBySmoke=this.smokes.some(smoke=>distance(smoke,grenade)<LIVE_HE_RULES.smokeClearanceRadius);
        const burnDuration=isMolotov?LIVE_UTILITY_FUSES.molotovDuration:LIVE_UTILITY_FUSES.incendiaryDuration;
        fireLabel=isMolotov?(groundContact?'Molotov spreads':'Molotov burns out'):(groundContact?'Incendiary spreads':'Incendiary airbursts');
        if(groundContact&&!coveredBySmoke){this.fires.push({id:grenade.id,ownerId:grenade.actorId,team:grenade.team,x:grenade.x,z:grenade.z,level:grenade.level,startedAt:this.time,nextDamageAt:this.time+.25,radius:.55,expires:this.time+burnDuration});this.audioCues.push({kind:'fireIgnite',x:grenade.x,y:grenade.y,z:grenade.z});}
      } else if(grenade.kind==='flash') {
        this.audioCues.push({kind:'flashPop',x:grenade.x,y:grenade.y,z:grenade.z});
        for(const actor of this.actors.filter(a=>a.hp>0)) {
          const eyeY=(actor.crouch?1.08:1.6)+(actor.jumpY??0);
          const range=Math.hypot(distance(actor,grenade),grenade.y-eyeY);
          if(range>=LIVE_UTILITY_RULES.flashRadius||!liveGrenadeSightline(grenade,{x:actor.x,y:eyeY,z:actor.z},this.map))continue;
          const facing=Math.cos(angle(heading(actor,grenade)-actor.yaw));
          const lookScale=facing>=.45?1:facing<=0?0:facing/.45;
          const duration=(LIVE_UTILITY_RULES.flashTurnedDuration+(LIVE_UTILITY_RULES.flashFacingDuration-LIVE_UTILITY_RULES.flashTurnedDuration)*lookScale)*Math.max(.25,1-range/16);
          if(duration>=actor.blinded){actor.blinded=duration;actor.flashedBy=grenade.actorId;}
        }
      } else {
        this.blasts.push({id:grenade.id,x:grenade.x,z:grenade.z,level:grenade.level,startedAt:this.time,endsAt:this.time+.48,radius:LIVE_HE_RULES.damageRadius});
        this.audioCues.push({kind:'heExplode',x:grenade.x,y:grenade.y,z:grenade.z});
        for(const smoke of this.smokes)if(distance(smoke,grenade)<smoke.radius+LIVE_HE_RULES.smokeClearanceRadius){
          this.disturbSmoke(smoke,LIVE_HE_RULES.smokeDisturbance,this.time+LIVE_HE_RULES.smokeDisturbance);
          smoke.blastUntil=Math.max(smoke.blastUntil??0,this.time+LIVE_HE_RULES.smokeDisturbance);
          for(const ally of this.actors.filter(a=>a.team===grenade.team&&a.hp>0&&!this.duelCommitted(a)&&distance(a,smoke)<18)){
            ally.flashWindow={point:{x:smoke.x,z:smoke.z},opens:this.time+.04,expires:this.time+.95};
            ally.decision='pressure';ally.watchPoint={x:smoke.x,z:smoke.z};ally.nextThink=this.time;
          }
        }
        const owner=this.actors.find(actor=>actor.id===grenade.actorId);
        if(owner)for(const actor of this.actors.filter(a=>a.hp>0)){
          const eyeY=(actor.crouch?1.08:1.6)+(actor.jumpY??0);
          const range=Math.hypot(distance(actor,grenade),grenade.y-eyeY);
          if(range>=LIVE_HE_RULES.damageRadius)continue;
          let damage=LIVE_HE_RULES.maxDamage*Math.pow(1-range/LIVE_HE_RULES.damageRadius,.55);
          if(!liveGrenadeSightline(grenade,{x:actor.x,y:eyeY,z:actor.z},this.map))damage*=LIVE_HE_RULES.wallDamageScale;
          if(actor.armor>0)damage*=.78;
          const friendlyScale=actor.team===grenade.team?(actor.id===owner.id?LIVE_FRIENDLY_FIRE_RULES.selfUtilityDamageScale:LIVE_FRIENDLY_FIRE_RULES.teammateUtilityDamageScale):1;
          const horizontal=distance(grenade,actor)||1;
          this.damage(owner,actor,damage,false,'he',false,undefined,friendlyScale,undefined,
            {region:'blast',point:{x:grenade.x,y:grenade.y,z:grenade.z},direction:{x:(actor.x-grenade.x)/horizontal,y:.4,z:(actor.z-grenade.z)/horizontal},strength:clamp(damage/55,.6,1.4)});
        }
      }
      this.emit('utility',`${grenade.kind==='flash'?'Flash detonates':grenade.kind==='smoke'?'Smoke blooms':grenade.kind==='he'?'HE explodes':fireLabel} · ${this.map.callout(grenade)}`,grenade.team,grenade.actorId);
      // A visible/audible hostile utility cue suggests pressure, never an identified enemy count.
      for(const listener of cueObservers){
        this.observeIntel(listener,
          {key:`utility:${Math.round(grenade.x/6)}:${Math.round(grenade.z/6)}`,observerId:listener.id,source:'utility',utilityKind:grenade.kind,
            x:grenade.x,z:grenade.z,observed:this.time,confidence:.4,uncertainty:3});
      }
    }
    this.grenades=this.grenades.filter(g=>g.detonateAt>this.time);
    this.blasts=this.blasts.filter(blast=>blast.endsAt>this.time);
  }

  step() {
    if(this.phase==='finished')return;
    this.learningPlansRemaining=1;
    const dt=LIVE_FPS_STEP;this.time+=dt;this.tickNumber++;
    this.shots=this.shots.filter(s=>this.time-s.time<.18);
    this.fireCues=this.fireCues.filter(cue=>this.time-cue.at<1.1);
    this.smokes=this.smokes.filter(s=>s.expires>this.time);
    for(const smoke of this.smokes){
      const spread=Math.min(1,Math.max(0,(this.time-smoke.startedAt)/LIVE_UTILITY_RULES.smokeSpread));
      const fade=Math.min(1,Math.max(0,(smoke.expires-this.time)/1.5));
      const disturbance=(smoke.disturbedUntil??0)>this.time?Math.max(0,(smoke.disturbance??0)-dt*.85):0;
      smoke.disturbance=disturbance;
      // Only HE blasts carve the smoke radius; bullet tracers never wobble/shrink the cloud.
      const blastClear=(smoke.blastUntil??0)>this.time?Math.max(.28,1-.56*disturbance):1;
      smoke.radius=LIVE_UTILITY_RULES.smokeRadius*spread*fade*blastClear;
    }
    this.fires=this.fires.filter(f=>f.expires>this.time);
    for(const fire of this.fires){
      const spread=Math.min(1,Math.max(0,(this.time-fire.startedAt)/LIVE_UTILITY_RULES.fireSpread));
      const fade=Math.min(1,Math.max(0,(fire.expires-this.time)/1.2));
      fire.radius=LIVE_UTILITY_RULES.fireRadius*spread*Math.min(1,fade+.2);
    }
    if(this.phase==='freeze'){
      for(const p of this.actors){
        const buy=this.pendingBuys.get(p.id);
        if(!buy||this.time<(p.buyAt??Infinity))continue;
        const oldWeapon=p.weapon,oldAmmo=p.ammo,oldReserve=p.reserve;
        Object.assign(p,{cash:buy.cash,armor:buy.armor,kit:buy.kit,flash:buy.flash,smoke:buy.smoke,incendiary:buy.incendiary,he:buy.he});
        if(buy.giftFrom){
          const donor=this.actors.find(a=>a.id===buy.giftFrom)!;
          this.droppedWeapons.push({id:++this.sequence,weapon:buy.weapon,ammo:LIVE_WEAPONS[buy.weapon].magazine,reserve:LIVE_WEAPONS[buy.weapon].reserve,x:p.x,z:p.z,level:p.level,from:{x:donor.x,z:donor.z,level:donor.level},fromY:donor.jumpY+1.1,airUntil:this.time+.7,reservedFor:p.id});
          donor.buyLook={point:{x:p.x,z:p.z},until:this.time+1};p.buyLook={point:{x:donor.x,z:donor.z},until:this.time+1};
          donor.action='Passing a bought weapon';
          this.radio(donor,`Dropped you ${LIVE_WEAPONS[buy.weapon].name} ${p.name}, go crazy bro!`);
        }else{if(LIVE_WEAPONS[oldWeapon].category==='pistol'&&LIVE_WEAPONS[buy.weapon].category!=='pistol')p.sidearmLoadout={weapon:oldWeapon,ammo:oldAmmo,reserve:oldReserve};else if(oldWeapon!==buy.weapon&&LIVE_WEAPONS[oldWeapon].category!=='pistol')this.droppedWeapons.push({id:++this.sequence,weapon:oldWeapon,ammo:oldAmmo,reserve:oldReserve,x:p.x,z:p.z,level:p.level});p.weapon=buy.weapon;p.ammo=buy.restock||oldWeapon!==buy.weapon?LIVE_WEAPONS[p.weapon].magazine:oldAmmo;p.reserve=buy.restock||oldWeapon!==buy.weapon?LIVE_WEAPONS[p.weapon].reserve:oldReserve;if(LIVE_WEAPONS[p.weapon].category==='pistol')p.sidearmLoadout={weapon:p.weapon,ammo:p.ammo,reserve:p.reserve};else if(buy.sidearm&&buy.sidearm!==p.sidearmLoadout?.weapon)p.sidearmLoadout={weapon:buy.sidearm,ammo:LIVE_WEAPONS[buy.sidearm].magazine,reserve:LIVE_WEAPONS[buy.sidearm].reserve};else if(!p.sidearmLoadout){const side:LiveWeapon=p.attacking?'glock':'usp_s';p.sidearmLoadout={weapon:side,ammo:LIVE_WEAPONS[side].magazine,reserve:LIVE_WEAPONS[side].reserve};}}
        for(const [i,kind] of (buy.utilityStock??[]).entries()){
          const recipient=this.actors.filter(a=>{if(a===p||a.team!==p.team||distance(a,p)>=10)return false;const planned={...(this.pendingBuys.get(a.id)??a)};for(const item of this.droppedUtility)if(item.reservedFor===a.id)planned[item.kind]++;return canCarryLiveUtility(planned,kind);})
            .sort((a,b)=>(a[kind]-b[kind])||distance(a,p)-distance(b,p))[0];
          const point=recipient??{x:p.x+(i-1)*.35,z:p.z-.7,level:p.level};
          this.droppedUtility.push({id:++this.sequence,kind,team:p.team,at:this.time,x:point.x,z:point.z,level:point.level,
            ...(recipient?{from:{x:p.x,z:p.z,level:p.level},fromY:p.jumpY+1.1,airUntil:this.time+.7,reservedFor:recipient.id}:{})});
          if(recipient){p.buyLook={point:{x:recipient.x,z:recipient.z},until:this.time+1};recipient.buyLook={point:{x:p.x,z:p.z},until:this.time+1};}
        }
        p.equipped=p.weapon;p.buyAt=undefined;p.action='Checking equipment';this.pendingBuys.delete(p.id);
        const sideNote=buy.sidearm&&buy.sidearm!==p.weapon&&buy.sidearm!==(p.attacking?'glock':'usp_s')?` · ${LIVE_WEAPONS[buy.sidearm].name}`:'';
        this.emit('economy',`${p.name} finished buying ${LIVE_WEAPONS[p.weapon].name}${sideNote}${p.armor?' · armor':''}${p.kit?' · defuse kit':''}`,p.team,p.id,undefined,undefined,p.weapon);
      }
    }
    if(this.phase==='freeze'){
      const warmup=this.navigationWarmups[this.navigationWarmIndex++];
      if(warmup)this.map.findPath(warmup.from,warmup.to);
      this.funnelTeamSmokes(this.attackTeam);
      this.updateBuyOrientation(dt);
      for(const p of this.actors){if(p.hp<=0)continue;this.advanceElevation(p,dt);p.weaponReady=Math.max(0,p.weaponReady-dt);}
    }
    this.collectGroundEquipment();
    if(this.phase==='freeze' || this.phase==='post') {
      for(const p of this.actors)if(p.profile){p.mentalState=tickFpsMentalState(p.profile,p.mentalState,dt,0,false,0);p.exertion=p.mentalState.exertion;}
      if(this.phase==='post')this.stepPostRound(dt);
      this.remaining=Math.max(0,this.remaining-dt);
      if(this.remaining<1e-8) {
        if(this.phase==='freeze'){
          this.phase='live';this.remaining=115;this.roundLiveAt=this.time;
          this.corpseDangerRecorded.clear();
          resetLiveInfluenceGrid(this.influenceGrid('blue'),this.time);
          resetLiveInfluenceGrid(this.influenceGrid('red'),this.time);
          resetTacticalBlackboard(this.teamBlackboard('blue'));
          resetTacticalBlackboard(this.teamBlackboard('red'));
          // Spread opening route construction over ten ticks; perception,
          // motor reaction and gunfire continue at the normal fixed rate.
          for(const p of this.actors){
            p.crouch=false;p.pitch=0;p.weaponReady=0;p.equipped=p.weapon;p.buyLook=undefined;
            p.nextThink=this.time+(p.slot*2+(p.attacking?1:0))*LIVE_FPS_STEP;
          }
          this.emit('round','Round live');
        }
        else {this.round++;this.startRound();}
      }
      return;
    }
    this.liveElapsed+=dt;
    this.noiseMasks=this.noiseMasks.filter(mask=>mask.until>this.time);
    this.funnelTeamSmokes(this.attackTeam);
    if(this.tickNumber%4===0)this.stepLiveDrops();
    this.updateExecute();
    this.updateProtocol();
    for(const actor of this.actors){
      if(actor.hp>0&&this.activeFireAt(actor,.5,actor.jumpY)&&!this.stickingFinalDefuse(actor)){
        actor.crouch=false;actor.peek=undefined;actor.clearUntil=0;
        if(actor.smokeLineupId)this.clearSmokeLineup(actor);
        actor.nextThink=Math.min(actor.nextThink,this.time);
      }
      if(actor.utilityPreparation)this.releaseUtilityPreparation(actor);
    }
    if(this.grenades.some(g=>g.kind==='flash'&&g.releaseAt<=this.time&&g.detonateAt>this.time)){
      for(const grenade of this.grenades){
        if(grenade.kind!=='flash'||grenade.releaseAt>this.time||grenade.detonateAt<=this.time)continue;
        let seenMap=this.flashSightings.get(grenade.id);
        if(!seenMap){seenMap=new Map();this.flashSightings.set(grenade.id,seenMap);}
        for(const actor of this.actors){
          if(actor.team===grenade.team||actor.hp<=0||actor.blinded>=.2||this.duelCommitted(actor))continue;
          const eyeY=(actor.crouch?1.08:1.6)+(actor.jumpY??0);
          if(Math.hypot(distance(actor,grenade),grenade.y-eyeY)>=LIVE_UTILITY_RULES.flashRadius+2)continue;
          if(Math.cos(angle(heading(actor,grenade)-actor.yaw))<=.32||!liveGrenadeSightline(grenade,{x:actor.x,y:eyeY,z:actor.z},this.map))continue;
          const nextSeen=(seenMap.get(actor.id)??0)+dt;
          seenMap.set(actor.id,nextSeen);
          const react=this.skill(actor,'reactions',actor.skills.mechanics),aware=this.skill(actor,'awareness',actor.skills.gameSense);
          const dodgeAfter=.24+(1-react)*.22+(1-aware)*.12;
          if(nextSeen>=dodgeAfter&&grenade.detonateAt-this.time<=.38){
            actor.lookAwayStarts=Math.min(actor.lookAwayStarts??this.time,this.time);
            actor.lookAwayUntil=Math.max(actor.lookAwayUntil,grenade.detonateAt+.04);
            actor.lookAwayPoint={x:grenade.x,y:grenade.y,z:grenade.z};
          }
        }
      }
    }
    this.stepGrenades(dt);
    for(const fire of this.fires){
      if(this.time<fire.nextDamageAt)continue;
      fire.nextDamageAt=this.time+.25;
      const owner=this.actors.find(p=>p.id===fire.ownerId);
      if(!owner)continue;
      for(const target of this.actors){
        if(target.hp<=0||distance(target,fire)>fire.radius)continue;
        const friendlyScale=target.team===fire.team?(target.id===owner.id?LIVE_FRIENDLY_FIRE_RULES.selfUtilityDamageScale:LIVE_FRIENDLY_FIRE_RULES.teammateUtilityDamageScale):1;
        this.damage(owner,target,LIVE_UTILITY_RULES.fireDamagePerSecond*.25,false,'incendiary',false,undefined,friendlyScale,undefined,
          {region:'burn',point:{x:target.x,y:target.jumpY+.5,z:target.z},direction:{x:Math.sin(target.yaw),y:-.25,z:Math.cos(target.yaw)},strength:.45});
      }
    }
    for(const report of this.reports.filter(r=>r.at<=this.time)) {
      for(const ally of this.actors.filter(a=>a.team===report.team&&a.id!==report.source&&a.hp>0)) {
        // Receipt does not reset the sighting's clock, identify an unseen sound source, or grant a firing target.
        this.observeIntel(ally,{...report.contact,via:report.source},false);
        ally.nextThink=Math.min(ally.nextThink,this.time+.15);
      }
    }
    this.reports=this.reports.filter(r=>r.at>this.time);
    if(this.bomb.status==='planted'){
      this.bomb.remaining=Math.max(0,this.bomb.remaining-dt);
      if(this.time>=this.nextBombTick){
        const urgency=this.bomb.remaining<=4?'final':this.bomb.remaining<=13?'urgent':'normal';
        this.audioCues.push({kind:'bombTick',urgency,x:this.bomb.x,z:this.bomb.z});
        const interval=this.bomb.remaining<=4?.14:this.bomb.remaining<=10?.28:this.bomb.remaining<=20?.5:.9;
        this.nextBombTick=this.time+interval;
      }
    }
    else this.remaining=Math.max(0,this.remaining-dt);
    // Rotate update order to avoid giving the same slot every simultaneous shot advantage.
    const start=this.tickNumber%this.actors.length;
    for(let n=0;n<this.actors.length;n++) {
      const p=this.actors[(start+n)%this.actors.length];
      if(p.hp<=0)continue;
      if(p.profile){
        p.mentalState=tickFpsMentalState(p.profile,p.mentalState,dt,p.speed,!!p.target,Math.min(this.liveElapsed,this.time-Math.max(p.seenAt,p.contactAt)));p.exertion=p.mentalState.exertion;
        p.recoil=advanceDetailedRecoil(p.recoil,p.profile,dt,this.time-p.lastShot);
        p.recoilPitch=advanceDetailedRecoil(p.recoilPitch,p.profile,dt,this.time-p.lastShot);
        const available=this.actors.some(t=>t.team!==p.team&&t.hp>0&&this.visible(p,t));
        if(available&&p.visualCueAt===undefined)p.visualCueAt=this.time;
        if(!available)p.visualCueAt=undefined;
        for(const cue of p.pendingCues.filter(c=>c.at<=this.time))this.observeIntel(p,cue.contact);
        p.pendingCues=p.pendingCues.filter(c=>c.at>this.time);
      }else {
        p.exertion=clamp(p.exertion+(p.speed>2.5?.025:p.speed>.2?.008:-.06)*dt,0,1);
        p.recoil=advanceLiveRecoil(p.recoil,p.skills.recoilControl,dt,this.time-p.lastShot);
        p.recoilPitch=advanceLiveRecoil(p.recoilPitch,p.skills.recoilControl,dt,this.time-p.lastShot);
      }
      this.advanceElevation(p,dt);
      if(this.time-p.lastShot>.55)p.burst=0;
      p.blinded=Math.max(0,p.blinded-dt);
      p.weaponReady=Math.max(0,p.weaponReady-dt);
      if(p.swingAt!==undefined&&this.time>=p.swingAt){p.swingAt=undefined;if(p.equipped==='knife'&&p.blinded<.2)this.strikeKnife(p);}
      if(p.reload>0){p.reload=Math.max(0,p.reload-dt);if(p.reload===0){p.ammo+=p.reloadRounds;p.reloadRounds=0;p.reloadSilent=false;}}
      if(p.throwAt!==undefined&&this.time-p.throwAt>.65){p.throwAt=undefined;p.throwKind=undefined;p.throwStyle=undefined;}
      if((p.equipped==='flash'||p.equipped==='smoke'||p.equipped==='incendiary'||p.equipped==='he')&&this.time>=p.equipUntil){this.equip(p,p.weapon);}
      if(this.time>=p.nextSense){this.perceive(p);p.nextSense=this.time+(p.profile?detailedSenseInterval(p.profile,p.mentalState):.12+(1-p.skills.gameSense)*.18);}
      if(this.time>=p.nextThink){this.decide(p);p.nextThink=this.time+(p.profile?.55+(1-this.skill(p,'decisionMaking',p.skills.gameSense))*.55:liveDecisionInterval(p.skills));}
      if(this.updateBombEscape(p,dt))continue;
      if(p.utilityPreparation){
        tickBt(this.getUtilityPrepBt(),{actor:p});
        continue;
      }
      const target=this.actors.find(t=>t.id===p.target&&t.hp>0);
      this.chooseEquipment(p,target);this.updateAiming(p,target);
      const urgentChannel=!p.attacking&&p.channel>0&&this.time-p.damageAt>.4&&this.bomb.remaining<(p.kit?7:12);
      const plantOpportunity=p.bomb&&this.bomb.status==='carried'&&livePlantSite(p,this.map)!==undefined;
      if(plantOpportunity||p.channel>0)this.routeLearner(p.team)?.close(p,this.time);
      if((plantOpportunity||urgentChannel)&&this.objective(p,dt))continue;
      if(target && this.visible(p,target,false)) {
        this.routeLearner(p.team)?.close(p,this.time);
        tickBt(this.getDuelMicroBt(),{actor:p,target,dt});
        continue;
      }
      if(this.objective(p,dt))continue;
      p.channel=0;
      const contactFresh=this.time-p.contactAt<3+this.skill(p,'informationReading',p.skills.gameSense)*3;
      const covered=p.contact&&!this.map.sightline(p,p.contact);
      if(!p.holsteredPrimary&&p.sidearmLoadout&&p.sidearmLoadout.ammo<LIVE_WEAPONS[p.sidearmLoadout.weapon].magazine&&p.sidearmLoadout.reserve>0&&p.ammo===LIVE_WEAPONS[p.weapon].magazine&&!p.reload&&this.time-p.contactAt>6&&this.time-p.damageAt>6){const fill=Math.min(p.sidearmLoadout.reserve,LIVE_WEAPONS[p.sidearmLoadout.weapon].magazine-p.sidearmLoadout.ammo);p.sidearmLoadout.ammo+=fill;p.sidearmLoadout.reserve-=fill;}
      if(p.ammo<LIVE_WEAPONS[p.weapon].magazine*(.2+(1-this.skill(p,'decisionMaking',p.skills.gameSense))*.25) && p.reserve>0 && !p.reload && (p.ammo===0||!contactFresh||covered))this.beginReload(p);
      if(!p.jump && (p.speed>1.3 || p.action==='Taking space' || p.action==='Rotating' || p.action==='Disengaging' || p.equipped==='knife')) {
        p.crouch=false;
      } else if(!p.jump && this.time>p.crouchUntil && p.burst===0 && p.speed>0.35) {
        p.crouch=false;
      }
      this.move(p,dt);
      if(p.blinded>.22&&!p.target){
        if(p.blinded>.85)this.radio(p,'Full blind — backing behind cover!');
        if(this.time-p.damageAt<.6)p.crouch=true;
        if(p.contact&&distance(p,p.contact)<11&&p.ammo>4&&p.equipped===p.weapon&&p.weaponReady===0&&!p.reload&&this.time>=p.nextShot
          &&fpsBehaviorPreferences(this.identity.players[p.id].personality).initiative>.62){
          const panic={id:`blind:${p.id}`,team:other(p.team),x:p.contact.x,z:p.contact.z,yaw:0,hp:100,blinded:0,lastShot:-100,channel:0,flashedBy:undefined,crouch:false,jumpY:this.map.terrain.groundHeight(p.contact),speed:0} as Actor;
          this.fire(p,panic);p.action='Flashed — suppressing to escape';
        }
      }
      if(p.equipped==='knife'&&this.heardBombDefuseActive(p)&&distance(p,this.bomb)<=LIVE_KNIFE.reach+.85&&p.blinded<.25){
        const sweepYaw=heading(p,this.bomb)+Math.sin(this.time*7)*.28;
        this.turn(p,sweepYaw);
        if(p.weaponReady===0&&this.time>=p.nextShot&&Math.abs(angle(sweepYaw-p.yaw))<.4){
          p.lastSwing=this.time;p.swingAt=this.time+LIVE_KNIFE.windup;p.nextShot=this.time+LIVE_KNIFE.interval;
          p.action='Slashing bomb smoke';
        }
      }
      this.tryInformationFire(p);
      const prediction=p.anticipation;
      if(prediction&&prediction.prefire&&prediction.until>this.time&&prediction.shots<2&&this.time>=(p.prefireAt??0)
        &&!p.target&&!p.bomb&&!p.reload&&!p.channel&&p.equipped===p.weapon&&p.weaponReady===0&&p.blinded<.2
        &&p.ammo>Math.max(3,LIVE_WEAPONS[p.weapon].magazine*.2)
        &&p.intel.contacts.some(contact=>contact.key===prediction.key&&contact.observed===prediction.observed)
        &&liveAccurateShotReady(p.weapon,p.speed,p.jump,this.time-p.stillSince,p.crouch,distance(p,prediction))
        &&p.speed<=liveShotSpeedLimit(p.weapon,p.profile?.5:p.skills.mechanics)&&this.time>=p.nextShot
        &&this.map.sightline(p,prediction)&&Math.abs(angle(heading(p,prediction)-p.yaw))<.06){
        const ghost={id:`prediction:${p.id}`,team:other(p.team),x:prediction.x,z:prediction.z,hp:100,yaw:0,blinded:0,lastShot:-100,channel:0,crouch:false,jumpY:this.map.terrain.groundHeight(prediction),speed:0} as Actor;
        p.pitch=Math.atan2(1.3+this.map.terrain.groundHeight(prediction)-((p.crouch?1.08:1.6)+p.jumpY),distance(p,prediction));
        prediction.shots++;p.prefireAt=this.time+.35+(1-this.skill(p,'timing',p.skills.gameSense))*.65;
        this.fire(p,ghost);p.action='Pre-firing the predicted crossing';
      }
      if(p.bomb&&this.bomb.status==='carried'){this.bomb.x=p.x;this.bomb.z=p.z;this.bomb.level=p.level;}
      if(this.droppedWeapons.length>0 && !p.holsteredPrimary && !p.utilityPreparation && p.throwAt===undefined && p.weaponReady===0 && p.reload===0) {
        this.tryScavengeWeapon(p,false);
      }
    }
    if(this.bomb.status==='planted' && this.bomb.remaining<=0){this.explodeBomb();this.bomb.status='exploded';this.finishRound(this.attackTeam,'Device detonated');return;}
    if(this.bomb.status==='defused'){this.finishRound(other(this.attackTeam),'Device defused');return;}
    if(!this.actors.some(p=>!p.attacking&&p.hp>0)){this.finishRound(this.attackTeam,'Defenders eliminated');return;}
    if(this.bomb.status!=='planted' && !this.actors.some(p=>p.attacking&&p.hp>0)){this.finishRound(other(this.attackTeam),'Attackers eliminated');return;}
    if(this.bomb.status!=='planted' && this.remaining<=0)this.finishRound(other(this.attackTeam),'Time expired');
  }

  /** Freeze locks feet at spawn, while allowing players to look, jump in place, crouch, inspect weapons, and share drops. */
  private updateBuyOrientation(dt:number):void {
    for(const p of this.actors){
      if(p.hp<=0)continue;
      if(p.buyLook&&p.buyLook.until>=this.time){
        this.turn(p,heading(p,p.buyLook.point));p.pitch+=(0-p.pitch)*(1-Math.exp(-8*dt));
        if(!this.pendingBuys.has(p.id))p.action='Coordinating equipment';
        p.intent='Look toward the teammate receiving or sharing equipment';
        continue;
      }
      const outgoing=this.actors.filter(a=>this.pendingBuys.get(a.id)?.giftFrom===p.id).sort((a,b)=>(a.buyAt??0)-(b.buyAt??0))[0];
      const incoming=this.actors.find(a=>a.id===this.pendingBuys.get(p.id)?.giftFrom),teammate=outgoing??incoming;
      if(teammate){
        p.buyLook={point:{x:teammate.x,z:teammate.z},until:Math.max(this.time+.8,(outgoing?.buyAt??p.buyAt??this.time)+.8)};
        this.turn(p,heading(p,p.buyLook.point));p.pitch+=(0-p.pitch)*(1-Math.exp(-8*dt));
        continue;
      }
      if(p.buyAt!==undefined){
        const mate=this.actors.find(a=>a.team===p.team&&a.slot===(p.slot+1)%5);
        if(mate){p.buyLook={point:{x:mate.x,z:mate.z},until:p.buyAt+.7};this.turn(p,heading(p,p.buyLook.point));}
        continue;
      }
      // Once buying finishes, operatives warm up without walking away from spawn.
      if(this.remaining<=1.2){
        p.crouch=false;
        p.pitch+=(0-p.pitch)*(1-Math.exp(-10*dt));
        const rolloutYaw=p.attacking?(this.site==='A'?-0.35:0.35):Math.PI;
        this.turn(p,rolloutYaw);
        p.action='Ready for rollout';
        p.intent='Prepare to sprint out of spawn on round live';
        continue;
      }
      const phase=Math.floor((this.time+p.slot*.85)/2.1)%4;
      if(phase===0||phase===2){
        const mate=this.actors.find(a=>a.team===p.team&&a.slot===(p.slot+1+(phase===2?1:0))%5);
        if(mate)this.turn(p,heading(p,mate));
      }else{
        const rolloutYaw=(p.attacking?0:Math.PI)+Math.sin(this.time*1.3+p.slot*1.9)*.55;
        this.turn(p,rolloutYaw);
      }
      const desiredPitch=Math.sin(this.time*2.9+p.slot*1.4)*.08;
      p.pitch+=(desiredPitch-p.pitch)*(1-Math.exp(-8*dt));
      p.crouch=((Math.floor((this.time+p.slot*.65)*1.5))%6===0)&&!p.jump;
      if(!p.jump&&!p.crouch&&this.remaining>2.2&&(this.tickNumber+p.slot*23)%105===0){
        p.jump=true;p.jumpVy=LIVE_JUMP_VELOCITY;this.jumpSound(p,'takeoff');
        p.action='Bunny-hop warmup';p.intent='Warm up movement in place before freeze ends';
      }else if(!p.jump&&p.weaponReady===0&&(this.tickNumber+p.slot*31)%84===0){
        this.equip(p,p.equipped==='knife'?p.weapon:'knife');
        p.action=p.equipped==='knife'?'Inspecting knife':'Inspecting weapon';
        p.intent='Check equipment and warm up aim during buy phase';
      }else if(!p.jump){
        p.action=p.crouch?'Crouch warmup':phase===0||phase===2?'Checking teammate loadout':p.equipped==='knife'?'Inspecting knife':'Warming up aim';
        p.intent='Interact and warm up in place while freeze timer counts down';
      }
    }
  }

  private collectGroundEquipment():void {
    for(const item of this.droppedUtility){
      if(!item.reservedFor)continue;
      const owner=this.actors.find(a=>a.id===item.reservedFor&&a.hp>0);
      const stagedForLineup=!!owner&&this.map.authoredSmokeLineups.some(l=>!this.completedSmokeLineups.has(`${owner.team}:${l.id}`)&&distance(item,l.position)<4);
      if(!owner||(this.phase==='live'&&this.time-item.at>35)||(this.phase==='live'&&!stagedForLineup&&distance(owner,item)>12))item.reservedFor=undefined;
    }
    for(const w of this.droppedWeapons){
      if(!w.reservedFor)continue;
      const owner=this.actors.find(a=>a.id===w.reservedFor&&a.hp>0);
      if(!owner||(this.phase==='live'&&w.at!==undefined&&this.time-w.at>10))w.reservedFor=undefined;
    }
    for(const p of this.actors.filter(a=>a.hp>0)){
      const gift=this.droppedWeapons.find(w=>w.reservedFor===p.id&&this.time>=(w.airUntil??0)&&this.canInteractPickup(p,w,w.reservedFor));
      if(gift){
        const giftPistol=LIVE_WEAPONS[gift.weapon].category==='pistol';
        const holdsPistol=LIVE_WEAPONS[p.weapon].category==='pistol';
        if(giftPistol&&!holdsPistol){
          if(p.sidearmLoadout&&LIVE_WEAPON_TIERS[p.sidearmLoadout.weapon]>1.2&&p.sidearmLoadout.weapon!==gift.weapon){
            this.droppedWeapons.push({id:++this.sequence,weapon:p.sidearmLoadout.weapon,ammo:p.sidearmLoadout.ammo,reserve:p.sidearmLoadout.reserve,x:p.x,z:p.z,level:p.level,at:this.time,droppedBy:p.id});
          }
          p.sidearmLoadout={weapon:gift.weapon,ammo:gift.ammo,reserve:gift.reserve};
        }else if(giftPistol&&holdsPistol){
          if(LIVE_WEAPON_TIERS[p.weapon]>1.2&&p.weapon!==gift.weapon){
            this.droppedWeapons.push({id:++this.sequence,weapon:p.weapon,ammo:p.ammo,reserve:p.reserve,x:p.x,z:p.z,level:p.level,at:this.time,droppedBy:p.id});
          }
          p.weapon=gift.weapon;p.ammo=gift.ammo;p.reserve=gift.reserve;p.sidearmLoadout={weapon:gift.weapon,ammo:gift.ammo,reserve:gift.reserve};this.equip(p,p.weapon);
        }else{
          if(holdsPistol&&!giftPistol)p.sidearmLoadout={weapon:p.weapon,ammo:p.ammo,reserve:p.reserve};
          else if(!holdsPistol&&p.weapon!==gift.weapon)this.droppedWeapons.push({id:++this.sequence,weapon:p.weapon,ammo:p.ammo,reserve:p.reserve,x:p.x,z:p.z,level:p.level,at:this.time,droppedBy:p.id});
          p.weapon=gift.weapon;p.ammo=gift.ammo;p.reserve=gift.reserve;this.equip(p,p.weapon);
        }
        this.droppedWeapons=this.droppedWeapons.filter(w=>w!==gift);p.action='Catching teammate weapon';
      }
      if(p.utilityPreparation||p.reload||p.channel||this.duelCommitted(p))continue;
      if(!p.attacking&&!p.kit){
        const kitIdx=this.droppedKits.findIndex(k=>this.canInteractPickup(p,k));
        if(kitIdx>=0){this.droppedKits.splice(kitIdx,1);p.kit=true;this.emit('economy',`${p.name} recovered a defuse kit`,p.team,p.id);}
      }
      const index=this.droppedUtility.findIndex(w=>(this.phase==='freeze'?w.team===p.team:true)&&(w.reservedFor===p.id||p.weaponReady===0)&&this.time>=(w.airUntil??0)&&(!w.reservedFor||w.reservedFor===p.id)&&canCarryLiveUtility(p,w.kind)&&this.canInteractPickup(p,w,w.reservedFor));
      if(index>=0){const [item]=this.droppedUtility.splice(index,1);p[item.kind]++;this.emit('economy',`${p.name} collected a dropped ${item.kind}`,p.team,p.id);}
    }
  }
  /** Mid-round sharing: drop spare utility (to teammates or execute lineups) and upgraded guns/sidearms out of combat. */
  private stepLiveDrops():void {
    if(this.phase!=='live'||this.remaining<12)return;
    const tier=LIVE_WEAPON_TIERS;
    const throwSight=(a:Actor,pt:FpsPoint,y=1.1)=>liveGrenadeSightline({x:a.x,y:1.5+a.jumpY,z:a.z},{x:pt.x,y:this.map.terrain.groundHeight(pt)+y,z:pt.z},this.map);
    for(const team of ['blue','red'] as const){
      const allies=this.actors.filter(a=>a.team===team&&a.hp>0);
      if(allies.length<2)continue;
      const upcomingLineups=team===this.attackTeam?this.nextUncoveredSmokeLineups(team):[];
      for(const donor of allies){
        if(donor.channel>0||donor.reload>0||donor.weaponReady>0||donor.utilityPreparation||donor.smokeLineupId
          ||!this.isInCoverForDrop(donor)||this.time-(donor.lastDropAt??-100)<3.5)continue;
        const nearbyMates=allies.filter(r=>r!==donor&&!r.utilityPreparation&&r.channel===0&&!this.duelCommitted(r)&&!this.inImmediateFight(r)
          &&!this.activeFireAt(r,.5,r.jumpY)&&distance(donor,r)<=6.5&&throwSight(donor,r));
        let dropped=false;
        for(const kind of ['smoke','flash','incendiary','he'] as const){
          if(donor[kind]<=0)continue;
          if(this.droppedUtility.some(w=>w.team===team&&w.kind===kind&&distance(w,donor)<6))continue;
          const specialist=kind==='smoke'&&team===this.attackTeam?this.utilitySpecialist(allies):undefined;
          if(kind==='smoke'&&donor!==specialist&&upcomingLineups.length){
            const spot=upcomingLineups.find(l=>!this.droppedUtility.some(w=>w.team===team&&w.kind==='smoke'&&distance(w,l.position)<2.8));
            if(spot&&distance(donor,spot.position)<=6.5&&throwSight(donor,spot.position,.95)){
              const rawPt=this.map.safePoint({x:spot.position.x+(donor.slot%2?.28:-.28),z:spot.position.z-.18,level:spot.position.level});
              const pt=this.computeDropLandingPoint(donor,rawPt);
              this.droppedUtility.push({id:++this.sequence,kind:'smoke',team,at:this.time,x:pt.x,z:pt.z,level:pt.level,
                from:{x:donor.x,z:donor.z,level:donor.level},fromY:donor.jumpY+1.1,airUntil:this.time+clamp(distance(donor,pt)/14,.35,1.05),
                reservedFor:specialist?.id});
              donor.smoke--;donor.lastDropAt=this.time;donor.action='Dropping smoke for execute';
              donor.buyLook={point:{x:pt.x,z:pt.z},until:this.time+.5};
              this.radio(donor,`Dropped my smoke at ${this.map.callout(pt)} throw spot!`);
              this.emit('economy',`${donor.name} drops a smoke at ${this.map.callout(pt)}`,team,donor.id,specialist?.id);
              dropped=true;break;
            }
          }
          const recipient=nearbyMates.filter(r=>canCarryLiveUtility(r,kind)&&!this.droppedUtility.some(w=>w.reservedFor===r.id&&w.kind===kind))
            .filter(r=>{
              if(donor.bomb&&!r.bomb)return true;
              if(donor.hp<42&&r.hp>=65&&r[kind]===0)return true;
              if(kind==='flash'&&donor.flash>=2&&r.flash===0&&['entry','trade','support'].includes(r.role))return true;
              if(kind==='smoke'&&!donor.attacking&&this.bomb.status==='planted'&&r[kind]===0&&distance(r,this.bomb)<=distance(donor,this.bomb))return true;
              if(kind==='flash'&&(donor.role==='anchor'||donor.role==='lurker')&&r.role==='entry'&&r.flash===0&&distance(r,this.map.definition.sites[this.site])<20)return true;
              return false;
            })
            .sort((a,b)=>(a[kind]-b[kind])||distance(donor,a)-distance(donor,b)||a.slot-b.slot)[0];
          if(!recipient)continue;
          const rawPt=this.map.safePoint({x:recipient.x+(donor.x<recipient.x?-.25:.25),z:recipient.z-.18,level:recipient.level});
          const pt=this.computeDropLandingPoint(donor,rawPt);
          this.droppedUtility.push({id:++this.sequence,kind,team,at:this.time,x:pt.x,z:pt.z,level:pt.level,
            from:{x:donor.x,z:donor.z,level:donor.level},fromY:donor.jumpY+1.1,airUntil:this.time+clamp(distance(donor,pt)/14,.35,.85),
            reservedFor:recipient.id});
          donor[kind]--;donor.lastDropAt=this.time;donor.action=`Dropping ${kind}`;
          donor.buyLook={point:{x:recipient.x,z:recipient.z},until:this.time+.5};
          this.radio(donor,`Dropped you a ${kind} ${recipient.name}!`);
          this.emit('economy',`${donor.name} drops a ${kind} to ${recipient.name}`,team,donor.id,recipient.id);
          dropped=true;break;
        }
        if(dropped)continue;
        if(donor.holsteredPrimary||this.time-donor.lastShot<2)continue;
        const awper=!donor.preferSniper&&donor.role!=='sniper'&&donor.weapon==='sniper'
          ?nearbyMates.find(r=>(r.preferSniper||r.role==='sniper')&&tier[r.weapon]<tier.sniper&&r.hp>=40&&!this.droppedWeapons.some(w=>w.reservedFor===r.id)):undefined;
        const lowHpRifleRecipient=!awper&&donor.hp<28&&tier[donor.weapon]>=4
          ?nearbyMates.filter(r=>r.hp>=70&&tier[r.weapon]<tier[donor.weapon]&&!this.droppedWeapons.some(w=>w.reservedFor===r.id))
            .sort((a,b)=>tier[a.weapon]-tier[b.weapon]||distance(donor,a)-distance(donor,b))[0]:undefined;
        const weaponRecipient=awper??lowHpRifleRecipient;
        if(weaponRecipient&&(donor.sidearmLoadout?.ammo??0)>0){
          const rawPt=this.map.safePoint({x:weaponRecipient.x+(donor.x<weaponRecipient.x?-.2:.2),z:weaponRecipient.z-.15,level:weaponRecipient.level});
          const pt=this.computeDropLandingPoint(donor,rawPt);
          this.droppedWeapons.push({id:++this.sequence,weapon:donor.weapon,ammo:donor.ammo,reserve:donor.reserve,
            x:pt.x,z:pt.z,level:pt.level,from:{x:donor.x,z:donor.z,level:donor.level},fromY:donor.jumpY+1.1,
            airUntil:this.time+clamp(distance(donor,pt)/13,.35,.9),reservedFor:weaponRecipient.id,at:this.time,droppedBy:donor.id});
          const droppedName=LIVE_WEAPONS[donor.weapon].name;
          const fallback=donor.sidearmLoadout!;
          donor.weapon=fallback.weapon;donor.ammo=fallback.ammo;donor.reserve=fallback.reserve;
          this.equip(donor,donor.weapon);donor.weaponReady=Math.max(donor.weaponReady,.25);donor.lastDropAt=this.time;donor.action='Dropping weapon for teammate';
          this.radio(donor,`Tossed you ${droppedName} ${weaponRecipient.name}!`);
          this.emit('economy',`${donor.name} drops ${droppedName} to ${weaponRecipient.name}`,team,donor.id,weaponRecipient.id,undefined,fallback.weapon);
          continue;
        }
        const side=donor.sidearmLoadout;
        if(LIVE_WEAPONS[donor.weapon].category!=='pistol'&&side&&tier[side.weapon]>1.2&&side.ammo>0){
          const starter=donor.attacking?'glock':'usp_s';
          const ecoMate=nearbyMates.find(r=>LIVE_WEAPONS[r.weapon].category==='pistol'&&tier[r.weapon]<tier[side.weapon]&&r.hp>=50&&!this.droppedWeapons.some(w=>w.reservedFor===r.id));
          if(ecoMate){
            const rawPt=this.map.safePoint({x:ecoMate.x,z:ecoMate.z-.15,level:ecoMate.level});
            const pt=this.computeDropLandingPoint(donor,rawPt);
            this.droppedWeapons.push({id:++this.sequence,weapon:side.weapon,ammo:side.ammo,reserve:side.reserve,
              x:pt.x,z:pt.z,level:pt.level,from:{x:donor.x,z:donor.z,level:donor.level},fromY:donor.jumpY+1.1,
              airUntil:this.time+clamp(distance(donor,pt)/13,.35,.85),reservedFor:ecoMate.id,at:this.time,droppedBy:donor.id});
            const sideName=LIVE_WEAPONS[side.weapon].name;
            donor.sidearmLoadout={weapon:starter,ammo:LIVE_WEAPONS[starter].magazine,reserve:LIVE_WEAPONS[starter].reserve};
            donor.lastDropAt=this.time;donor.action=`Dropping ${sideName}`;
            this.radio(donor,`Dropped you my ${sideName} ${ecoMate.name}!`);
            this.emit('economy',`${donor.name} drops ${sideName} to ${ecoMate.name}`,team,donor.id,ecoMate.id,undefined,side.weapon);
          }
        }
      }
    }
  }
  private getUtilityPrepBt():BtNode<{actor:Actor}> {
    if(!this.utilityPrepTree){
      this.utilityPrepTree=createUtilityPrepBt({
        hasPrep:ctx=>!!ctx.actor.utilityPreparation,
        shouldCancelForDanger:ctx=>ctx.actor.hp<=0||this.inImmediateFight(ctx.actor)||(!!this.activeFireAt(ctx.actor,.5,ctx.actor.jumpY)&&!this.stickingFinalDefuse(ctx.actor)),
        cancelPrep:ctx=>this.cancelUtilityPreparation(ctx.actor),
        isReadyToRelease:ctx=>this.time>=ctx.actor.utilityPreparation!.readyAt,
        releasePrep:ctx=>this.releaseUtilityPreparation(ctx.actor),
        aimAndPullPin:ctx=>{
          const p=ctx.actor,prep=p.utilityPreparation!;
          p.channel=0;this.applyMotion(p,{x:0,z:0},LIVE_FPS_STEP,'brake');
          this.turn(p,prep.launchYaw);
          p.pitch+=(prep.launchPitch-p.pitch)*(1-Math.exp(-14*LIVE_FPS_STEP));
          if(this.time>=prep.equipAt&&!prep.pinHeard){prep.pinHeard=true;this.hear(p,11,'utility');}
          p.action=this.time<prep.equipAt?`Equipping ${prep.kind}`:prep.lineupId?'Aiming lineup trajectory':`Pulling ${prep.kind} pin`;
        },
      });
    }
    return this.utilityPrepTree;
  }
  private getDuelMicroBt():BtNode<{actor:Actor;target:Actor;dt:number}> {
    if(!this.duelMicroTree){
      this.duelMicroTree=createDuelMicroBt({
        hasTarget:ctx=>this.visible(ctx.actor,ctx.target,false),
        shouldTurnAwayFromFlash:ctx=>(!!ctx.actor.vaultDrop||this.time-ctx.actor.acquired>=ctx.actor.reaction)&&this.shouldTurnFromFlash(ctx.actor),
        turnAwayFromFlash:ctx=>{
          const {actor:p,target,dt}=ctx;
          this.beginPostReactionDuel(p,target);
          if(p.equipped==='knife'){this.handleDuelKnife(p,target,dt);return;}
          this.stepDuelMovement(p,target,dt);
          this.turn(p,this.flashSafeYaw(p));
          p.action=p.weaponReady>0?'Drawing weapon':'Turning from friendly flash';
        },
        isReacting:ctx=>!ctx.actor.vaultDrop&&this.time-ctx.actor.acquired<ctx.actor.reaction,
        handleReactionWait:ctx=>{this.applyMotion(ctx.actor,{x:ctx.actor.vx,z:ctx.actor.vz},ctx.dt,ctx.actor.stance);ctx.actor.action='Responding to contact';},
        shouldReloadOrSwapSidearm:ctx=>ctx.actor.equipped==='knife'||ctx.actor.ammo===0,
        handleReloadOrSidearm:ctx=>{
          const {actor:p,target,dt}=ctx;
          this.beginPostReactionDuel(p,target);
          if(p.equipped==='knife'){this.handleDuelKnife(p,target,dt);return;}
          if(!p.holsteredPrimary&&LIVE_WEAPONS[p.weapon].category!=='pistol'&&(p.sidearmLoadout?.ammo??1)>0){
            this.drawSidearm(p);this.radio(p,'Out of ammo — switching to pistol!');p.nextThink=this.time;
          }else if(p.reserve>0&&!p.reload){
            this.beginReload(p);p.nextThink=this.time;
          }
          this.stepDuelMovement(p,target,dt);
          this.updateDuelAimAndFire(p,target,dt,false);
        },
        shouldHoldTriggerDiscipline:ctx=>!ctx.actor.reload&&ctx.actor.retreatUntil<=this.time&&!(ctx.actor.peek?.back)&&!this.allyBlocksShot(ctx.actor,ctx.target)&&this.checkTriggerDiscipline(ctx.actor,ctx.target),
        handleTriggerDiscipline:ctx=>{
          const {actor:p,target,dt}=ctx;
          this.beginPostReactionDuel(p,target);
          this.stepDuelMovement(p,target,dt);
          this.updateDuelAimAndFire(p,target,dt,false);
          p.action='Trigger discipline';
        },
        shouldHoldOrRepositionCover:ctx=>this.needsDuelCoverOrStep(ctx.actor,ctx.target),
        handleCoverOrReposition:ctx=>{
          const {actor:p,target,dt}=ctx;
          this.beginPostReactionDuel(p,target);
          this.stepDuelMovement(p,target,dt);
          this.updateDuelAimAndFire(p,target,dt,true);
        },
        stepCombatStrafe:ctx=>{
          this.beginPostReactionDuel(ctx.actor,ctx.target);
          this.stepDuelMovement(ctx.actor,ctx.target,ctx.dt);
        },
        aimAndFire:ctx=>this.updateDuelAimAndFire(ctx.actor,ctx.target,ctx.dt,true),
      });
    }
    return this.duelMicroTree;
  }
  private beginPostReactionDuel(p:Actor,target:Actor):void {
    if(p.profile&&p.motor.responseAt<p.acquired)p.motor.responseAt=this.time;
    p.channel=0;
    p.action=p.reload>0?(p.reloadSilent?'Silent reloading':'Reloading'):'Engaging';
    if(p.crouch&&this.time>p.crouchUntil&&this.time-p.lastShot>.3)p.crouch=false;
    if(!p.crouch&&p.burst>=3&&distance(p,target)>8&&['rifle','heavy'].includes(LIVE_WEAPONS[p.weapon].category??'')){
      p.crouch=true;p.crouchUntil=this.time+.85;
    }
  }
  private handleDuelKnife(p:Actor,target:Actor,dt:number):void {
    const d=distance(p,target),aim=p.profile?(p.trackingPoint??p.aimPoint??p.contact??p):(p.aimPoint??p.contact??p);
    this.turn(p,heading(p,aim));
    if(d>1.05&&d<2.2&&(p.ammo===0&&p.reserve===0||this.heardBombDefuseActive(p)))this.applyMotion(p,{x:(aim.x-p.x)/(distance(p,aim)||1)*LIVE_WALK_SPEED,z:(aim.z-p.z)/(distance(p,aim)||1)*LIVE_WALK_SPEED},dt,'peek');
    else this.applyMotion(p,{x:0,z:0},dt,'brake');
    p.action=p.weaponReady>0?'Drawing knife':'Knife ready';
    if(d<LIVE_KNIFE.reach+.25&&p.weaponReady===0&&this.time>=p.nextShot&&this.time-p.acquired>=p.reaction&&Math.abs(angle(heading(p,aim)-p.yaw))<.25){
      p.lastSwing=this.time;p.swingAt=this.time+LIVE_KNIFE.windup;p.nextShot=this.time+LIVE_KNIFE.interval;p.action='Knife swing';
    }
  }
  private needsDuelCoverOrStep(p:Actor,target:Actor):boolean {
    const peekBack=!!(p.peek&&(p.peek.back||p.hp<35||this.time>=(p.shotCommitUntil??0)&&this.time-p.acquired>p.reaction+.3&&(p.hp<55||p.decision!=='pressure')));
    return peekBack||this.allyBlocksShot(p,target)||p.retreatUntil>this.time||p.reload>0;
  }
  private checkTriggerDiscipline(p:Actor,target:Actor):boolean {
    const enemyFacingAway=Math.cos(target.yaw-heading(target,p))<-0.45;
    const enemyUnaware=this.time-target.lastShot>1&&this.time-p.damageAt>1;
    if(enemyFacingAway&&enemyUnaware&&distance(p,target)>6&&p.hp>=50&&p.engagementShots===0&&!p.triggerDisciplineUntil){
      p.triggerDisciplineUntil=this.time+.12+(1-this.skill(p,'precision',p.skills.mechanics))*.13;
      p.action='Trigger discipline';
      p.radioAt=this.time;p.radioMessage='Behind them — trigger discipline, lining up headshot!';
      this.emit('objective',`${p.name}: "[RADIO] Behind them — trigger discipline, lining up headshot!"`,p.team,p.id);
    }
    return !!(p.triggerDisciplineUntil&&this.time<p.triggerDisciplineUntil&&this.time-p.damageAt>.35&&this.time-target.lastShot>.35);
  }
  private stepDuelMovement(p:Actor,target:Actor,dt:number):void {
    const blockedByAlly=this.allyBlocksShot(p,target);
    if(p.peek&&(p.peek.back||p.hp<35||this.time>=(p.shotCommitUntil??0)&&this.time-p.acquired>p.reaction+.3&&(p.hp<55||p.decision!=='pressure'))){
      p.peek.back=true;this.move(p,dt,true);p.action='Returning behind cover';
      return;
    }
    if(blockedByAlly && !p.reload){
      const side=p.slot%2===0?1:-1,dx=target.x-p.x,dz=target.z-p.z,d=Math.hypot(dx,dz)||1;
      this.applyMotion(p,{x:dz/d*side*2,z:-dx/d*side*2},dt,'peek');
      p.action='Clearing the firing lane';
      return;
    }
    if(p.retreatUntil>this.time || p.reload>0){
      this.move(p,dt,true);
      p.action=p.reload>0?(p.reloadSilent?'Silent reloading in cover':'Reloading in cover'):'Disengaging';
      return;
    }
    const dx=target.x-p.x,dz=target.z-p.z,d=Math.hypot(dx,dz)||1;
    const firingCommitment=this.time<(p.shotCommitUntil??0);
    const precisionOpening=p.engagementShots===0&&this.time-p.acquired<p.reaction+.45
      &&(p.weapon==='deagle'||['rifle','sniper','heavy'].includes(LIVE_WEAPONS[p.weapon].category??''));
    const canChooseMovement=!p.jump&&!firingCommitment&&!precisionOpening&&p.weaponReady===0&&p.decision==='pressure'&&d<22;
    const movement=this.movementLearner(p.team);
    const movementChoice=movement&&canChooseMovement
      ?movement.choose(p.id,target.id,p.team,fpsMovementContext('duel',d,p.hp),this.movementRandom)
      :undefined;
    if(movement&&!canChooseMovement&&!firingCommitment&&!precisionOpening)movement.close(p.id);
    if(movementChoice==='crouch-strafe'){p.crouch=true;p.crouchUntil=this.time+.24;}
    const canStrafe=canChooseMovement&&(movementChoice?movementChoice!=='hold':!p.crouch);
    const strafe=liveCombatStrafe(this.time,p.strafeUntil,p.strafeSettleUntil??0,canStrafe);
    if(strafe==='start'||strafe==='move'){
      if(strafe==='start'){p.strafeDirection=p.strafeDirection===1?-1:1;p.strafeUntil=this.time+.14+(1-this.skill(p,'movementControl',p.skills.mechanics))*.16+this.executionRandom()*.04;p.strafeSettleUntil=p.strafeUntil+.55+LIVE_WEAPONS[p.weapon].interval;}
      const perpX=-dz/d*p.strafeDirection,perpZ=dx/d*p.strafeDirection;
      this.applyMotion(p,{x:perpX*LIVE_WALK_SPEED,z:perpZ*LIVE_WALK_SPEED},dt,movementChoice==='crouch-strafe'?'crouch':'strafe');
      p.action=movementChoice==='crouch-strafe'?'Crouch-strafing':movementChoice==='hold'?'Holding aim':'Strafing';
    }else{
      this.applyMotion(p,{x:0,z:0},dt,'brake');
      if(p.speed>liveShotSpeedLimit(p.weapon,p.profile?.5:p.skills.mechanics))p.action='Counter-strafing';
      else if(p.crouch)p.action=p.burst>=2?'Crouch-spraying':'Crouching';
      else if(movementChoice==='hold')p.action='Holding aim';
    }
  }
  private updateDuelAimAndFire(p:Actor,target:Actor,dt:number,allowFire:boolean):void {
    const intendedAim=p.profile?(p.trackingPoint??p.aimPoint??p.contact??p):(p.aimPoint??p.contact??p);
    const aim=distance(p,intendedAim)>.01?intendedAim:target;
    const eyeY=(p.crouch?1.08:1.6)+(p.jumpY??0);
    const desiredPitch=Math.atan2((p.sampledHeadY??this.map.terrain.groundHeight(aim)+1.55)-eyeY,distance(p,aim));
    const precision=this.skill(p,'precision',p.skills.mechanics);
    p.pitch+=(desiredPitch-p.pitch)*(1-Math.exp(-(3+precision*17)*dt));
    this.turn(p,heading(p,aim));
    if(p.weaponReady>0)p.action='Drawing weapon';
    const blockedByAlly=this.allyBlocksShot(p,target);
    const accurateShot=liveAccurateShotReady(p.weapon,p.speed,p.jump,this.time-p.stillSince,p.crouch,distance(p,target));
    if(!accurateShot&&!p.reload&&p.weaponReady===0&&!blockedByAlly)p.action=p.speed>.12?'Counter-strafing':'Settling aim';
    if(allowFire&&!blockedByAlly&&accurateShot&&p.equipped===p.weapon&&p.weaponReady===0&&p.speed<=liveShotSpeedLimit(p.weapon,p.profile?.5:p.skills.mechanics)&&p.blinded<.2&&!p.reload&&p.ammo>0&&this.time>=p.nextShot&&this.time-p.acquired>=p.reaction&&Math.abs(angle(heading(p,aim)-p.yaw))<.09){
      this.fire(p,target);
    }
  }
  private updateBombEscape(p:Actor,dt:number):boolean {
    if(!p.bombEscape)return false;
    if(this.bomb.status!=='planted'){p.bombEscape=undefined;return false;}
    p.objectiveUrgent=true;p.crouch=false;p.perchGoal=undefined;p.channel=0;p.peek=undefined;p.clearUntil=0;p.retreatUntil=0;
    const clear=distance(p,this.bomb)>=LIVE_C4_RULES.safeDistance;
    const target=this.actors.find(a=>a.id===p.target&&a.hp>0&&this.visible(p,a,false));
    if(target){this.equip(p,p.weapon);this.turn(p,heading(p,p.aimPoint??target));}
    else this.equip(p,this.time-p.contactAt>1.5?'knife':p.weapon);
    if(clear){p.path=[];this.applyMotion(p,{x:0,z:0},dt,'hold');this.preAim(p,true);}
    else{
      if(p.stuckFor>1.2||!p.path.length&&distance(p,p.bombEscape.point)>.4){const off=this.perchUnder(p)?.approaches[0];p.path=off?[{...off},...this.map.findPath(off,p.bombEscape.point)]:this.map.findPath(p,p.bombEscape.point);p.stuckFor=0;}
      this.move(p,dt,!!target);
    }
    this.updateAiming(p,target);
    if(target&&this.time-p.acquired>=p.reaction&&this.time>=p.nextShot&&p.weaponReady===0&&distance(p,target)<10){
      p.pitch=Math.atan2((p.sampledHeadY??liveActorHeadY(target))-(p.jumpY+(p.crouch?1.08:1.6)),distance(p,target));this.fire(p,target);
    }
    p.action=clear?'Holding outside blast':'Escaping bomb blast';
    p.intent=clear?'Stay clear of the device and preserve equipment':'Take the reachable escape route before detonation; avoid another committed duel';
    return true;
  }

  private explodeBomb(){
    const center={x:this.bomb.x,z:this.bomb.z,level:this.bomb.level};
    this.blasts.push({id:++this.sequence,x:center.x,z:center.z,level:center.level,startedAt:this.time,endsAt:this.time+1.1,radius:LIVE_C4_RULES.radius});
    this.audioCues.push({kind:'bombExplode',x:center.x,y:this.map.terrain.groundHeight(center),z:center.z});
    for(const player of this.actors){
      if(player.hp<=0)continue;
      const damage=liveC4Damage(center,player,player.armor,player.crouch,player.jumpY);
      if(damage<=0)continue;
      player.hp=Math.max(0,player.hp-damage);
      player.armor=Math.max(0,player.armor-damage*.18);
      player.damageAt=this.time;player.channel=0;
      if(player.hp===0){
        releaseActorBlackboard(this.teamBlackboard(player.team),player.id);
        player.deaths++;this.confirmedDeaths.add(player.id);this.corpses.push({id:++this.sequence,playerId:player.id,attacking:player.attacking,at:this.time,x:player.x,z:player.z,level:player.level,y:player.jumpY,yaw:player.yaw,vx:player.vx,vz:player.vz,vy:player.jumpVy,crouch:player.crouch,
          impact:{region:'blast',point:{x:center.x,y:this.map.terrain.groundHeight(center)+.1,z:center.z},direction:{x:Math.sin(heading(center,player)),y:.45,z:Math.cos(heading(center,player))},strength:1.5}});
        player.impact.unusedUtilityOnDeath+=player.flash+player.smoke+player.incendiary+player.he;
        player.bomb=false;
        this.emit('kill',`C4 blast eliminates ${player.name}`,this.attackTeam,undefined,player.id,false,'bomb');
        if(player.weapon!=='pistol'&&player.weapon!=='usp_s'&&player.weapon!=='glock')this.droppedWeapons.push({id:++this.sequence,weapon:player.weapon,ammo:player.ammo,reserve:player.reserve,x:player.x,z:player.z,level:player.level});
      }
    }
    this.emit('objective','C4 DETONATED · lethal blast radius',this.attackTeam);
  }

  private advanceElevation(p:Actor,dt:number){
    if(p.level==='upper'&&!this.map.terrain.levelAllowed(p)){
      const canalPt={...p,level:'canal' as const},streetPt={...p,level:undefined};
      p.level=this.map.terrain.levelAllowed(canalPt)&&this.map.terrain.groundHeight(canalPt)>=this.map.terrain.groundHeight(streetPt)?'canal':undefined;
    }
    const upperGround=this.map.terrain.groundHeight({...p,level:undefined});
    if(p.level==='canal'&&p.jump&&p.jumpVy<=0&&upperGround>.5&&p.jumpY>=upperGround-.02&&this.map.terrain.levelAllowed({...p,level:undefined}))p.level=undefined;
    if(p.level!=='upper'&&p.jump&&p.jumpVy<=0&&this.map.terrain.levelAllowed({...p,level:'upper'})){
      const deckH=this.map.terrain.groundHeight({...p,level:'upper'});
      if(p.jumpY>=deckH-.02&&deckH>this.map.terrain.groundHeight(p)+.5)p.level='upper';
    }
    p.groundY=p.jump&&p.jumpVy>0?this.map.terrain.groundHeight(p):this.map.supportHeight(p,p.jumpY);
    const wasAirborne=p.jump;
    const state=advanceLiveJump({jump:p.jump,jumpY:p.jumpY,jumpVy:p.jumpVy,groundY:p.groundY},dt);
    if(state.jumpVy>0){
      const bodyHeight=p.crouch?1.3:1.72,oldHead=p.jumpY+bodyHeight;
      for(const wall of this.map.collisionSolids)if(wall.baseY!==undefined&&wall.baseY>=oldHead-1e-6&&wall.baseY<state.jumpY+bodyHeight
        &&wall.height>wall.baseY&&segmentHitsWall(p,p,wall,LIVE_ACTOR_RADIUS-.001)){
        state.jumpY=Math.max(p.groundY,wall.baseY-bodyHeight-.005);state.jumpVy=0;
      }
    }
    p.jump=state.jump;p.jumpY=state.jumpY;p.jumpVy=state.jumpVy;
    if(wasAirborne&&!p.jump){
      const quietLanding=p.crouch||p.speed<=LIVE_WALK_SPEED+.2;
      if(quietLanding){this.audioCues.push({kind:'jump',phase:'landing',x:p.x,y:p.jumpY,level:p.level,surface:this.map.surfaceAt(p,p.jumpY),z:p.z});this.hear(p,6,'footstep');}
      else this.jumpSound(p,'landing');
      p.jumpChain=0;p.jumpQueued=false;
    }
    if(p.jump)p.stance='jump';
    if(p.jump&&p.jumpVy<0&&p.jumpY-p.groundY<.55&&p.peek?.style==='crouch-swing')p.crouch=true;
  }

  private consumePath(p:Actor,threshold:number):void {
    while(p.path.length&&distance(p,p.path[0])<threshold){
      const next=p.path[0];
      // Reaching the corner's radius is insufficient when the following leg
      // still cuts through its wall. Walk to the corner before turning.
      if(p.path.length>1&&distance(p,next)>.025&&!p.jump&&(p.path[1].level??'street')===(p.level??'street')&&!this.map.movementSegmentClear(p,p.path[1]))break;
      if((next.level??'street')!==(p.level??'street')){
        if(!this.map.terrain.terrainConnector(p,{...p,level:next.level}))break;
        p.level=next.level;
      }
      p.path.shift();
    }
  }

  private stepPostRound(dt:number){
    const claimedWeapons=new Set<number>(),claimedKits=new Set<number>(),claimedUtil=new Set<number>();
    const tier=LIVE_WEAPON_TIERS;
    for(const player of this.actors){
      if(player.hp<=0)continue;
      player.target=undefined;player.channel=0;player.crouch=false;this.advanceElevation(player,dt);
      if(player.holsteredPrimary)this.restorePrimary(player);
      this.consumePath(player,.38);
      this.recoverDroppedWeapon(player);
      const fire=this.activeFireAt(player,.5,player.jumpY);
      const upgrade=this.droppedWeapons
        .filter(w=>!claimedWeapons.has(w.id)&&this.isWeaponUpgradeFor(player,w)&&!this.activeFireAt(w,.4))
        .sort((a,b)=>(tier[b.weapon]+(player.preferSniper&&b.weapon==='sniper'?1.2:0))-(tier[a.weapon]+(player.preferSniper&&a.weapon==='sniper'?1.2:0))||distance(player,a)-distance(player,b))[0];
      const kitDrop=!upgrade&&!player.attacking&&!player.kit
        ?this.droppedKits.filter(k=>!claimedKits.has(k.id)&&!this.activeFireAt(k,.4)).sort((a,b)=>distance(player,a)-distance(player,b))[0]:undefined;
      const utilDrop=!upgrade&&!kitDrop
        ?this.droppedUtility.filter(u=>!claimedUtil.has(u.id)&&(!u.reservedFor||u.reservedFor===player.id)&&this.time>=(u.airUntil??0)&&canCarryLiveUtility(player,u.kind)&&!this.activeFireAt(u,.4)).sort((a,b)=>distance(player,a)-distance(player,b))[0]:undefined;
      if(fire){
        const esc=this.escapeFirePoint(player,fire,player.goal);
        player.goal=esc;player.path=this.map.findPath(player,esc,this.fires,1);player.action='Escaping molotov fire';
      }else if(upgrade||kitDrop||utilDrop){
        if(upgrade)claimedWeapons.add(upgrade.id);else if(kitDrop)claimedKits.add(kitDrop.id);else if(utilDrop)claimedUtil.add(utilDrop.id);
        const goal=upgrade?{x:upgrade.x,z:upgrade.z,level:upgrade.level}:kitDrop?{x:kitDrop.x,z:kitDrop.z,level:kitDrop.level}:{x:utilDrop!.x,z:utilDrop!.z,level:utilDrop!.level};
        const action=upgrade?`Recovering ${LIVE_WEAPONS[upgrade.weapon].name}`:kitDrop?'Grabbing dropped kit':`Grabbing dropped ${utilDrop!.kind}`;
        if(!player.goal||distance(player.goal,goal)>.35||!player.path.length||player.stuckFor>.8){
          player.goal=goal;player.path=this.map.findPath(player,goal,this.fires,.85);player.stuckFor=0;
        }
        player.action=action;player.postRoamAt=Math.max(player.postRoamAt??0,this.time+.35);
      }else if((!player.path.length||!player.goal||distance(player,player.goal)<.55||player.stuckFor>.9)&&this.time>=(player.postRoamAt??0)){
        const destination=this.map.safePoint({x:player.x+(this.random()-.5)*22,z:player.z+(this.random()-.5)*22,level:player.level});
        player.goal=destination;player.postRoamAt=this.time+1.8+this.random()*1.4;player.action='Celebrating round win';
        player.path=this.map.findPath(player,player.goal,this.fires,.85);
      }
      this.consumePath(player,.38);
      const waypoint=player.path[0];
      if(waypoint&&!(!fire&&this.activeFireAt(waypoint,.35))){
        const d=distance(player,waypoint)||1;
        this.equip(player,'knife');
        this.applyMotion(player,{x:(waypoint.x-player.x)/d*LIVE_KNIFE.runSpeed,z:(waypoint.z-player.z)/d*LIVE_KNIFE.runSpeed},dt,'run');
        this.turn(player,heading(player,waypoint));
      }else{
        if(waypoint&&!fire&&this.activeFireAt(waypoint,.35)){player.path=[];player.goal=undefined;}
        this.equip(player,player.weapon);
        this.applyMotion(player,{x:0,z:0},dt,'hold');
      }
      const hadW=this.droppedWeapons.length,hadK=this.droppedKits.length,hadU=this.droppedUtility.length;
      this.recoverDroppedWeapon(player);
      if(!player.attacking&&!player.kit){
        const kitIdx=this.droppedKits.findIndex(k=>this.canInteractPickup(player,k));
        if(kitIdx>=0){this.droppedKits.splice(kitIdx,1);player.kit=true;this.emit('economy',`${player.name} recovered a defuse kit`,player.team,player.id);}
      }
      const uIdx=this.droppedUtility.findIndex(u=>(!u.reservedFor||u.reservedFor===player.id)&&this.time>=(u.airUntil??0)&&canCarryLiveUtility(player,u.kind)&&this.canInteractPickup(player,u,u.reservedFor));
      if(uIdx>=0){const [item]=this.droppedUtility.splice(uIdx,1);player[item.kind]++;this.emit('economy',`${player.name} collected a dropped ${item.kind}`,player.team,player.id);}
      if(this.droppedWeapons.length!==hadW||this.droppedKits.length!==hadK||this.droppedUtility.length!==hadU){player.path=[];player.goal=undefined;}
    }
  }

  private recoverDroppedWeapon(player:Actor){
    this.tryScavengeWeapon(player,true);
  }
  private tryScavengeWeapon(player:Actor,post:boolean){
    const tier=LIVE_WEAPON_TIERS;
    const sideWeapon=player.sidearmLoadout?.weapon;
    const isSidearmOnlyUpgrade=(w:DroppedWeapon)=>LIVE_WEAPONS[player.weapon].category!=='pistol'&&LIVE_WEAPONS[w.weapon].category==='pistol'&&!!sideWeapon&&tier[w.weapon]>tier[sideWeapon];
    const pickupIndex=this.droppedWeapons.findIndex(item=>this.canInteractPickup(player,item,item.reservedFor)&&(post||(!item.reservedFor||item.reservedFor===player.id)&&this.time>=(item.airUntil??0)&&!(item.droppedBy===player.id&&this.time-(item.at??0)<2.5))&&this.isWeaponUpgradeFor(player,item));
    if(pickupIndex<0)return;
    const pickup=this.droppedWeapons.splice(pickupIndex,1)[0];
    if(isSidearmOnlyUpgrade(pickup)){
      player.sidearmLoadout={weapon:pickup.weapon,ammo:pickup.ammo,reserve:pickup.reserve};
      this.emit('economy',`${player.name} upgraded sidearm to ${LIVE_WEAPONS[pickup.weapon].name}${post?' after the round':''}`,player.team,player.id,undefined,undefined,pickup.weapon);
      return;
    }
    const old={weapon:player.weapon,ammo:player.ammo,reserve:player.reserve};
    if(LIVE_WEAPONS[old.weapon].category==='pistol'&&LIVE_WEAPONS[pickup.weapon].category!=='pistol')player.sidearmLoadout={...old};
    player.weapon=pickup.weapon;player.ammo=pickup.ammo;player.reserve=pickup.reserve;
    if(LIVE_WEAPONS[player.weapon].category==='pistol')player.sidearmLoadout={weapon:player.weapon,ammo:player.ammo,reserve:player.reserve};
    player.reload=0;player.reloadDuration=0;player.reloadSilent=false;player.reloadRounds=0;this.equip(player,player.weapon);
    if(LIVE_WEAPONS[old.weapon].category!=='pistol')this.droppedWeapons.push({...old,id:++this.sequence,x:player.x,z:player.z,level:player.level,at:this.time,droppedBy:player.id});
    else if(LIVE_WEAPON_TIERS[old.weapon]>1.2&&LIVE_WEAPONS[pickup.weapon].category==='pistol')this.droppedWeapons.push({...old,id:++this.sequence,x:player.x,z:player.z,level:player.level,at:this.time,droppedBy:player.id});
    this.emit('economy',`${player.name} ${post?'recovered':'scavenged'} ${LIVE_WEAPONS[player.weapon].name}${post?' after the round':''}`,player.team,player.id,undefined,undefined,player.weapon);
  }

  private visiblePoint(p:Actor,target:Actor,fov=true):{x:number;y:number;z:number}|undefined {
    if(p.blinded>.2 || distance(p,target)>55)return undefined;
    if(fov && Math.abs(angle(heading(p,target)-p.yaw))>0.82)return undefined;
    const eyeY=(p.crouch?1.08:1.6)+(p.jumpY??0),headY=liveActorHeadY(target);
    const centerClear=this.map.sightline(p,target,eyeY,headY);
    if(centerClear && !this.smokes.some(s=>liveSmokeOccludes(p,target,eyeY,headY,s,this.time)))return {x:target.x,y:headY,z:target.z};
    const nearSmoke=this.smokes.some(s=>distance(target,s)<=s.radius+1.2||this.segmentNear(p,target,s)<=s.radius+1.2);
    if(!nearSmoke)return undefined;
    const dx=target.x-p.x,dz=target.z-p.z,d=Math.hypot(dx,dz)||1,px=-dz/d,pz=dx/d;
    const chestY=(target.crouch?.78:1.15)+(target.jumpY??0);
    const probes:[number,number,number][]=[
      [target.x,chestY,target.z],
      [target.x+px*.26,chestY,target.z+pz*.26],
      [target.x-px*.26,chestY,target.z-pz*.26],
      [target.x+px*.14,headY,target.z+pz*.14],
      [target.x-px*.14,headY,target.z-pz*.14],
    ];
    for(const [sx,sy,sz] of probes){
      const pt={x:sx,z:sz,level:target.level};
      if(this.map.sightline(p,pt,eyeY,sy)&&!this.smokes.some(s=>liveSmokeOccludes(p,pt,eyeY,sy,s,this.time)))return {x:sx,y:sy,z:sz};
    }
    return undefined;
  }
  private visible(p:Actor,target:Actor,fov=true) {
    return !!this.visiblePoint(p,target,fov);
  }
  private segmentNear(a:FpsPoint,b:FpsPoint,p:FpsPoint) {
    const dx=b.x-a.x,dz=b.z-a.z,t=clamp(((p.x-a.x)*dx+(p.z-a.z)*dz)/(dx*dx+dz*dz||1),0,1);
    return distance(p,{x:a.x+dx*t,z:a.z+dz*t});
  }
  private radio(p:Actor,message:string,force=false) {
    if(!force&&this.time-(p.radioAt??-100)<3)return;
    p.radioAt=this.time;p.radioMessage=message;
    this.teamReports.push({id:++this.sequence,team:p.team,actorId:p.id,name:p.name,at:this.time,message,category:/[Ss]mok|[Ff]lash|[Ff]ire|HE |[Mm]oll/.test(message)?'utility':/[Pp]lant|[Dd]efus|[Dd]evice|[Bb]omb/.test(message)?'objective':/[Cc]ontact|[Ss]een|[Hh]eard|lit |HP/.test(message)?'contact':'plan',confidence:'plan'});
    if(this.teamReports.length>40)this.teamReports.shift();
    this.emit('objective',`${p.name}: "[RADIO] ${message}"`,p.team,p.id);
  }
  private syncTradePartner(p:Actor,targetPoint:FpsPoint,message:string):void {
    const partner=this.actors.filter(a=>a!==p&&a.team===p.team&&a.hp>0&&!a.bomb&&!this.duelCommitted(a)&&distance(p,a)<15)
      .sort((a,b)=>(Number(b.role==='trade')-Number(a.role==='trade'))||(Number(b.role==='support')-Number(a.role==='support'))||distance(p,a)-distance(p,b))[0];
    this.radio(p,message,true);
    if(!partner)return;
    partner.decision='coordinate';
    partner.watchPoint={...targetPoint};
    partner.contact={...targetPoint};
    partner.contactAt=Math.max(partner.contactAt,this.time-.5);
    partner.nextThink=Math.min(partner.nextThink,this.time+.06);
    this.radio(partner,`I got your trade ${p.name}, swinging right behind you!`);
  }
  private defenseHome(p:Actor):'A'|'B' {
    if(p.position==='CT_ANCHOR_A')return 'A';if(p.position==='CT_ANCHOR_B')return 'B';
    if(this.map.id==='spillway'&&this.defenseSetup!=='stack_a'&&this.defenseSetup!=='stack_b'&&p.position==='CT_ROTATOR')return 'B';
    return this.defenseSetup==='stack_b'?(p.slot<4?'B':'A'):this.defenseSetup==='stack_a'?(p.slot<4?'A':'B'):p.slot<3?'A':'B';
  }
  private openingDefenseAssignment(p:Actor):{point:FpsPoint;intent:string}|undefined {
    if(this.bomb.status==='planted')return undefined;
    const tactical=this.map.definition.tactical;
    if((this.defenseSetup==='standard'||this.defenseSetup==='retake_setup')&&p.position==='CT_FLEX')
      return {point:tactical.mid.window.hold,intent:this.map.id==='spillway'?'Hold Upper Park & Terrace over Mid; report movement and fall back to HQ A':'Hold the customs window over Mid; report movement and retain the rear exit'};
    if(this.liveElapsed>22)return undefined;
    if((this.defenseSetup==='standard'||this.defenseSetup==='stack_b')&&p.position==='CT_ANCHOR_B')
      return {point:this.map.id==='spillway'?(tactical.B.holds[1]??tactical.B.holds[0]):(tactical.B.holds[3]??tactical.B.holds[0]),intent:this.map.id==='spillway'?'Hold Pumping Station floor crossfire over B Main & Short':'Use the apartment stairs and hold the elevated fountain crossfire'};
    if(this.map.id==='spillway'&&(this.defenseSetup==='standard'||this.defenseSetup==='retake_setup')&&p.position==='CT_ROTATOR')
      return {point:tactical.B.holds[0],intent:'Hold Control Deck Heaven over B Site & Short; fast rotate to CT Compound'};
    if(this.defenseSetup==='aggressive_banana') {
      const points:Record<number,FpsPoint>=this.map.id==='fontessa'?{3:{x:17,z:-10},4:{x:23,z:-6}}:{3:tactical.B.entries[0],4:tactical.B.holds[0]};
      const point=points[p.slot];return point?{point,intent:this.map.id==='spillway'?'Aggressive Canal/Short pair — take early lower space, then fall back to B':'Aggressive Banana pair — take the early lane, then fall back to B'}:undefined;
    }
    if(this.defenseSetup==='mid_push') {
      const points:Record<number,FpsPoint>={2:tactical.mid.underpass.west,4:tactical.mid.underpass.east};
      const point=points[p.slot];return point?{point,intent:'Mid pair — take brief control, report contact, then rotate'}:undefined;
    }
    return undefined;
  }
  private postPlantAssignment(p:Actor,site:'A'|'B',planting?:FpsPoint){
    if(p.postAssignment&&p.postAssignment.until>this.time)return p.postAssignment;
    const mates=this.actors.filter(a=>a.team===p.team&&a.hp>0&&a!==p),rank=this.actors.filter(a=>a.team===p.team&&a.hp>0).sort((a,b)=>a.slot-b.slot).findIndex(a=>a===p);
    const plan=planLivePostPlant(p,site,planting??this.bomb,rank,liveIntelBeliefs(p.intel,this.time),mates.flatMap(a=>a.postAssignment?[a.postAssignment.point]:[]),this.skill(p,'positioning',p.skills.gameSense),p.role==='lurker'||LIVE_WEAPONS[p.weapon].category==='sniper',this.map);
    p.postAssignment={...plan,until:this.time+4+(1-this.skill(p,'decisionMaking',p.skills.gameSense))*3};
    this.radio(p,`${planting?'Covering the plant':'Post-plant'}: ${plan.reason}.`);
    return p.postAssignment;
  }
  private postPlantIntent(p:Actor):string {
    if(p.id===this.postPlantPlanterId)return 'Priority 1 — planter holds the close crossfire and stays alive';
    if(p.role==='anchor')return 'Priority 2 — anchor the assigned site lane; do not chase';
    if(p.role==='entry'||p.role==='trade')return 'Priority 3 — hold the trade angle and stop the retake';
    if(p.role==='support'||p.role==='caller')return 'Priority 4 — delay the retake with utility and cover';
    return 'Priority 5 — hold the flank route; report, do not roam';
  }
  private acknowledge(p:Actor,order:LiveInformationOrder) {
    if(order.issuedAt===undefined||p.acknowledgedOrder===order.issuedAt||this.time<(order.readyAt??0))return;
    p.acknowledgedOrder=order.issuedAt;
    this.radio(p,`Copy bro, ${p.role==='support'?'utility ready for your swing':p.role==='trade'?'right behind you to trade':p.role==='anchor'?'holding my site solo, call rotates':'ready to trade and take space'} — ${order.mode==='probe'?'peeking together':order.mode==='execute'?'executing now':order.reason}.`);
  }
  private refreshIntel(p:Actor) {
    if(!p.intelManaged)return;
    const best=strongestLiveIntel(p.intel,p,this.time);
    p.contact=best?{x:best.x,z:best.z,level:best.level}:undefined;p.contactAt=best?.observed??-100;
    p.information=describeLiveIntel(p.intel,p,this.time,this.map.intelArea);
  }
  private observeIntel(p:Actor,contact:LiveIntelContact,share=true) {
    if(contact.enemyId&&this.confirmedDeaths.has(contact.enemyId))return;
    recordLiveMotion(p.motionSamples,contact,p.id);
    p.intelManaged=true;rememberLiveIntel(p.intel,contact,this.time);this.refreshIntel(p);
    if(contact.key!=='dropped-bomb'){
      const baseDanger=contact.source==='sight'?.95:contact.source==='damage'?.9:contact.source==='gunfire'?.55:contact.source==='utility'?.45:contact.source==='reload'?.35:.25;
      recordInfluenceDanger(this.influenceGrid(p.team),contact,baseDanger*(share?.55:.45),this.time,1);
    }
    recordFpsOpponentPattern(p.patterns,contact,this.round,Math.max(0,this.liveElapsed-(this.time-contact.observed)),this.map.intelArea);
    if(!share)return;
    const interval=contact.source==='sight'?.7:2;
    if(this.time-(p.sentReports.get(contact.key)??-100)<interval)return;
    p.sentReports.set(contact.key,this.time);
    this.radio(p,contact.source==='sight'?`Contact ${this.map.callout(contact)} - last seen, checking support.`:`${contact.source==='utility'?'Utility':contact.source==='footstep'?'Footsteps':'Sound'} near ${this.map.callout(contact)} - unconfirmed.`);
    const report=this.teamReports[this.teamReports.length-1];if(report?.actorId===p.id&&report.at===this.time){report.category='contact';report.confidence=contact.source==='sight'?'confirmed':'reported';}
    const communication=this.identity.teams[p.team].chemistry.communication;
    const skill=this.skill(p,'communication',p.skills.teamwork),delay=p.profile?.12+(1-skill)*.65+(1-communication)*.5:liveReportDelay(p.skills,communication);
    if(p.profile){p.motor.reports++;p.motor.reportDelaySum+=delay;}
    this.reports.push({team:p.team,source:p.id,at:this.time+delay,
      contact:{...contact,confidence:contact.confidence*(.78+skill*.12+communication*.08),uncertainty:contact.uncertainty+.4+(1-skill)}});
  }
  private observablePoint(p:Actor,point:FpsPoint):boolean {
    const eyeY=(p.crouch?1.08:1.6)+(p.jumpY??0),targetY=this.map.terrain.groundHeight(point)+1.6;
    return p.blinded<.2&&distance(p,point)<55&&Math.abs(angle(heading(p,point)-p.yaw))<0.82&&this.map.sightline(p,point,eyeY,targetY)
      &&!this.smokes.some(s=>liveSmokeOccludes(p,point,eyeY,targetY,s,this.time));
  }
  private callFromInformation(p:Actor,allies:Actor[]) {
    const assessment=p.profile?interpretFpsInformation(p.profile,p.intel,this.time,this.map.intelArea):assessLiveIntel(p.intel,this.time,this.map.intelArea),order=this.informationOrders[p.team];
    if(order.callerId&&!allies.some(a=>a.id===order.callerId)){
      order.until=0;order.readyAt=this.time;order.responders=[];order.mode='recheck';order.site=undefined;
      this.nextInformationProbe[p.team]=Math.min(this.nextInformationProbe[p.team],this.time);
    }
    if(p.attacking){
      const alternate=this.site==='A'?'B':'A',pressure=assessment[this.site];
      const blocked=pressure.confirmed>=2&&pressure.strength>assessment[alternate].strength+1.1+(1-this.skill(p,'informationReading',p.skills.gameSense))*.5;
      const lostEntry=this.roundSiteKills[p.team]>=2;
      if(order.mode==='execute'&&liveOrderActive(order,this.time)){
        if(!blocked&&!lostEntry)return;
        order.mode='recheck';order.until=this.time+2;order.reason='New contact or entry losses; reassess the execute';
        for(const ally of allies)if(!this.duelCommitted(ally)){ally.tacticalChoice=undefined;ally.nextThink=Math.min(ally.nextThink,this.time+.15);}
      }
      if(p.profile){
        if(blocked||lostEntry){if(p.planAssessmentAt===undefined){const delay=.2+(1-fpsBehaviorPreferences(this.identity.players[p.id].personality).reassessment)*1.6;p.planAssessmentAt=this.time+delay;p.motor.planAssessmentDelay=delay;p.motor.planAssessments++;}
          if(this.time<p.planAssessmentAt)return;
        }else p.planAssessmentAt=undefined;
      }
      let redirect=false;
      if(this.bomb.status==='carried'&&this.liveElapsed>15&&this.liveElapsed-this.planCommit>14&&(blocked||lostEntry)){
        const alternative=assessment[alternate],carrier=allies.find(a=>a.bomb);
        // An entry loss is a reason to reassess, not evidence that the other site is open.
        const lessPressure=alternative.confirmed<pressure.confirmed||alternative.strength+.45<pressure.strength
          ||(lostEntry&&alternative.confirmed<2&&alternative.strength<=pressure.strength+.25);
        if(carrier&&lessPressure){
          const travel=allies.map(a=>this.map.pathLength(a,this.map.definition.sites[alternate])/LIVE_RUN_SPEED).sort((a,b)=>a-b);
          const carrierSeconds=this.map.pathLength(carrier,this.map.definition.sites[alternate])/LIVE_RUN_SPEED;
          const regroupSeconds=travel[Math.min(1,travel.length-1)]??Infinity;
          redirect=this.remaining>Math.max(20,Math.max(carrierSeconds,regroupSeconds)+LIVE_PLANT_RULES.seconds+8);
        }
      }
      if(redirect){
        const reason=lostEntry?`Entry losses at ${this.site}; regroup toward ${alternate}`:`${pressure.identified} last seen ${this.site}; redirect toward ${alternate}`;
        this.site=alternate;this.planCommit=this.liveElapsed;this.roundSiteKills[p.team]=0;
        this.protocol.site=this.site;this.protocol.phase='default';this.protocol.phaseAt=this.time;
      for(const ally of allies){if(this.duelCommitted(ally))continue;ally.peek=undefined;this.movementLearner(ally.team)?.close(ally.id);ally.aimFocus=undefined;ally.probeGoal=undefined;ally.probeVisited.clear();ally.nextThink=this.time;}
        this.informationOrders[p.team]={mode:'rotate',site:alternate,responders:allies.map(a=>a.id),until:this.time+6,strength:pressure.strength,reason,issuedAt:this.time,callerId:p.id,readyAt:p.profile?this.time+(1-this.skill(p,'calling',p.skills.leadership))*.8:undefined};
        if(p.profile){p.motor.commands++;p.motor.commandDelay=(this.informationOrders[p.team].readyAt??this.time)-this.time;}
        this.radio(p,`IGL: ${reason}`,true);
      }else if(this.time>=order.until){
        const nearSite=allies.filter(a=>distance(a,this.map.definition.sites[this.site])<22).length;
        if(nearSite>=Math.min(2,allies.length)&&(pressure.confirmed<3||this.remaining<30||allies.length>this.knownEnemyCount(p.team))&&this.bomb.status==='carried'){
          const reason=`Work ${this.site} together - entry takes space, support flashes, trade follows`;
          const entryOrder=[...allies].sort((a,b)=>Number(b.role==='entry')-Number(a.role==='entry')
            ||this.skill(b,'peeking',b.skills.mechanics)-this.skill(a,'peeking',a.skills.mechanics));
          this.informationOrders[p.team]={mode:'execute',site:this.site,responders:allies.map(a=>a.id),until:this.time+18,strength:pressure.strength,reason,executePhase:'regroup',phaseAt:this.time,smokesSent:0,flashSent:false,entryId:entryOrder.find(a=>!a.bomb)?.id,
            issuedAt:this.time,callerId:p.id,readyAt:this.time+(1-this.skill(p,'calling',p.skills.leadership))*.8};
          this.radio(p,`IGL: Hit ${this.site} together — smoke chokes, flash for entry, trade me on the swing!`,true);return;
        }
        order.reason=assessment[this.site].identified>0?`${assessment[this.site].identified} last seen ${this.site}; work the known angles`:'No confirmed stack — gather information before committing';
      }
      return;
    }
    if(this.bomb.status==='planted')return;
    const tendency=knownFpsTendency(p.patterns,this.round,this.map.intelArea);
    const quiet=assessment.A.strength+assessment.B.strength+assessment.Mid.strength<.45;
    if(order.mode==='probe'&&this.time<order.until&&quiet&&order.responders.every(id=>allies.some(a=>a.id===id)))return;
    if(quiet&&(!order.site||this.time>=order.until)&&this.liveElapsed>=8&&this.time>=this.nextInformationProbe[p.team]&&allies.length>=4&&this.knownEnemyCount(p.team)>=3){
      // Keep one defender on each site, then send a scout with a trading partner.
      const reserved=new Set(['A','B'].flatMap(site=>{
        const guard=allies.filter(a=>this.defenseHome(a)===site).sort((a,b)=>Number(b.role==='anchor')-Number(a.role==='anchor')||a.slot-b.slot)[0];
        return guard?[guard.id]:[];
      }));
      const candidates=allies.filter(a=>!reserved.has(a.id)&&a.role!=='anchor'&&!a.target&&a.hp>=55&&!a.reload);
      const area=tendency?.area==='A'?'B':tendency?.area==='B'?'A':this.worldRandom()<.5?'A':'B';
      const point=this.map.definition.tactical[area].entries[this.worldRandom()<.5?0:1];
      const travel=new Map(candidates.map(a=>[a.id,this.map.pathLength(a,point)]));
      candidates.sort((a,b)=>travel.get(a.id)!-travel.get(b.id)!+Number(a.role==='sniper')*5-Number(b.role==='sniper')*5||a.slot-b.slot);
      if(candidates.length>=2&&Math.max(travel.get(candidates[0].id)!,travel.get(candidates[1].id)!)<24){
        const duration=Math.min(18,5+Math.max(travel.get(candidates[0].id)!,travel.get(candidates[1].id)!)/LIVE_WALK_SPEED);
        const reason=tendency?`They showed ${tendency.area} in ${tendency.samples} recent rounds; check ${area} with a trade, keep both sites guarded`:`No fresh contact - check ${area} with a trade, keep both sites guarded`;
        this.informationOrders[p.team]={mode:'probe',responders:candidates.slice(0,2).map(a=>a.id),point:{...point},until:this.time+duration,strength:0,reason,
          issuedAt:this.time,callerId:p.id,readyAt:this.time+(1-this.skill(p,'calling',p.skills.leadership))*.8};
        this.nextInformationProbe[p.team]=this.time+duration+6;
        if(p.profile){p.motor.commands++;p.motor.commandDelay=(1-this.skill(p,'calling',p.skills.leadership))*.8;}
        this.radio(p,`IGL: ${reason}`,true);
        for(const ally of candidates.slice(0,2))ally.nextThink=this.time;
        return;
      }
    }
    const site=assessment.A.strength>=assessment.B.strength?'A':'B',evidence=assessment[site];
    const observedBomb=hasObservedBomb(p.intel,this.time);
    const bombArea=observedBomb?liveIntelArea(observedBomb,this.map.intelArea):undefined;
    // If CTs legally saw the bomb elsewhere (e.g. B or dropped), avoid falling for decoy pressure on the opposite site.
    const decoyAtSite=bombArea&&(bombArea==='A'||bombArea==='B')&&bombArea!==site&&evidence.confirmed<3;
    const calledSite=decoyAtSite?bombArea:site;
    const calledEvidence=assessment[calledSite];
    const remainingEnemies=this.knownEnemyCount(p.team);
    const freshlyLocated=liveIntelBeliefs(p.intel,this.time).filter(c=>c.enemyId&&c.source==='sight'&&c.age<1.25&&c.certainty>=.6&&liveIntelArea(c,this.map.intelArea)===calledSite).length;
    const allLocated=remainingEnemies>0&&freshlyLocated>=remainingEnemies;
    const newlyAllLocated=allLocated&&(order.mode!=='rotate'||order.site!==calledSite);
    const bombChangesCall=!!observedBomb&&(bombArea==='A'||bombArea==='B')&&bombArea!==order.site;
    const previousAlive=order.responders.every(id=>allies.some(a=>a.id===id));
    if(order.mode!=='probe'&&previousAlive&&this.time<order.until&&calledEvidence.strength<order.strength+.8&&!bombChangesCall&&!newlyAllLocated)return;
    const mode:LiveInformationOrder['mode']=allLocated?'rotate':bombArea===calledSite?'reinforce':decoyAtSite&&evidence.identified<=1?'hold'
      :calledEvidence.confirmed>=3&&calledEvidence.strength>2?'rotate'
      :(calledEvidence.identified>=2&&calledEvidence.strength>1.2)||(calledEvidence.corroborated&&calledEvidence.strength>.4)?'reinforce'
      :calledEvidence.strength>.12?'watch':order.site?'recheck':'hold';
    const opposite=calledSite==='A'?'B':'A',home=(a:Actor)=>this.defenseHome(a);
    const guards=allies.filter(a=>home(a)===opposite).sort((a,b)=>Number(b.role==='anchor')-Number(a.role==='anchor')||a.slot-b.slot);
    const reserve=allLocated?undefined:guards[0];
    const travel=new Map(guards.map(a=>[a.id,this.map.pathLength(a,this.map.definition.sites[calledSite])]));
    const responders=guards.filter(a=>a!==reserve&&(allLocated||a.role!=='anchor')&&!a.target&&a.channel===0&&Number.isFinite(travel.get(a.id)))
      .sort((a,b)=>travel.get(a.id)!-travel.get(b.id)!||a.slot-b.slot)
      .slice(0,mode==='rotate'?(allLocated?guards.length:2):mode==='reinforce'?1:0).map(a=>a.id);
    const reason=allLocated?`All ${remainingEnemies} remaining opponents freshly spotted ${calledSite}; collapse together`
      :decoyAtSite&&mode==='hold'?`Device spotted at ${bombArea} — do not over-rotate on ${site} noise`
      :bombArea===calledSite&&mode==='reinforce'?`Confirmed C4 sighting at ${calledSite} — pinch toward the bomb with ${opposite} anchored`
      :mode==='rotate'?`${calledEvidence.identified} last seen ${calledSite}; rotate with ${opposite} covered`
      :mode==='reinforce'?`${calledEvidence.identified>=2?'Multiple spotted':'Corroborated activity at'} ${calledSite}; send support, keep ${opposite} covered`
      :mode==='watch'?`Possible ${calledSite} pressure — hold the other site`
      :mode==='recheck'?'Reports faded — reset and recheck the lanes':'No confirmed pressure — hold the setup';
    const changed=order.mode!==mode||order.site!==(mode==='hold'||mode==='recheck'?undefined:calledSite)||order.responders.join()!==responders.join();
    this.informationOrders[p.team]={mode,site:mode==='hold'||mode==='recheck'?undefined:calledSite,responders,until:this.time+(mode==='watch'?2:5),strength:calledEvidence.strength,reason,issuedAt:this.time,callerId:p.id,readyAt:p.profile?this.time+(1-this.skill(p,'calling',p.skills.leadership))*.8:undefined};
    if(p.profile&&changed){p.motor.commands++;p.motor.commandDelay=(this.informationOrders[p.team].readyAt??this.time)-this.time;}
    if(changed){for(const ally of allies)ally.nextThink=this.time;if(mode!=='hold')this.radio(p,`IGL: ${reason}`,true);}
  }
  private usePostPlantUtility(p:Actor,allies:Actor[]):string|undefined {
    if(this.time<p.utilityAt||p.reload>0||p.blinded>.2||p.channel>0||p.utilityPreparation||this.bomb.status!=='planted')return;
    // The elected defuser cannot spend the last usable seconds equipping utility.
    const defuseAssignment=!p.attacking?assignLiveObjective(allies,this.bomb,this.bomb.remaining,true,this.map):undefined;
    if(!p.attacking&&(!defuseAssignment||p.id===defuseAssignment.id&&this.bomb.remaining-defuseAssignment.seconds<3.2))return;
    const reserved=(kind:LiveGrenadeKind,target:FpsPoint,radius=4)=>allies.some(a=>a!==p&&a.utilityPreparation?.kind===kind&&distance(a.utilityPreparation.target,target)<radius)
      ||hasBlackboardClaim(this.teamBlackboard(p.team),'throw_utility',`${kind}:${Math.round(target.x/4)}:${Math.round(target.z/4)}`,this.time,p.id)
      ||this.grenades.some(g=>g.team===p.team&&g.kind===kind&&distance(predictLiveGrenade(g,this.time,this.map),target)<radius);
    const smokeAt=(point:FpsPoint)=>p.knownSmokes.some(s=>s.expires>this.time+2&&distance(s,point)<LIVE_HE_RULES.smokeClearanceRadius);
    const fireAt=(point:FpsPoint)=>this.fires.some(f=>f.expires>this.time+1&&distance(f,point)<Math.max(f.radius,2)
      &&(f.team===p.team||this.observablePoint(p,f)));
    const usefulBeforeExplosion=(kind:LiveGrenadeKind,target:FpsPoint)=>{
      const fuse=kind==='flash'?LIVE_UTILITY_FUSES.flashFuse:kind==='he'?LIVE_UTILITY_FUSES.heFuse
        :kind==='incendiary'?Math.min(LIVE_UTILITY_FUSES.fireAirFuse,Math.max(.35,distance(p,target)/18+.18))
        :Math.max(.85,distance(p,target)/12+.75);
      return this.bomb.remaining>liveDrawTime(kind)+.48+(1-this.skill(p,'utilityExecution',p.skills.mechanics))*.30+.2+fuse+.35;
    };
    const known=strongestLiveIntel(p.intel,p,this.time);
    const nearBomb=known&&known.age<1.8&&known.certainty>=.48&&known.radius<4&&distance(known,this.bomb)<12;
    const heardDefuse=p.attacking&&this.time-(p.heardDefuseAt??-100)<3.5&&distance(p,this.bomb)<24;
    const covered=smokeAt(this.bomb)||reserved('smoke',this.bomb);
    const fireAtBomb=fireAt(this.bomb)||reserved('incendiary',this.bomb);
    // Attackers burn or HE the bomb when hearing a defuse tick or spotting a defender contesting the bomb.
    if(p.attacking&&p.incendiary&&!fireAtBomb&&!covered&&usefulBeforeExplosion('incendiary',this.bomb)&&(heardDefuse||(nearBomb&&known!.source==='sight'))){
      if(this.throwUtility(p,'incendiary',{x:this.bomb.x,z:this.bomb.z}))return 'Deny the bomb defuse with fire';
    }
    if(p.attacking&&p.he&&(heardDefuse||(nearBomb&&(known!.source==='sight'||known!.source==='damage')))){
      const target=nearBomb?{x:known!.x,z:known!.z}:{x:this.bomb.x,z:this.bomb.z};
      if(usefulBeforeExplosion('he',target)&&!reserved('he',target)&&this.throwUtility(p,'he',target))return 'HE the bomb contest or active defuse sound';
    }
    // Defenders retake with legal threat/ally-fight utility (smokes, incendiaries, HEs, flashes).
    if(!p.attacking&&defuseAssignment){
      const site=this.bomb.site??this.site;
      const retakeThreat=liveIntelBeliefs(p.intel,this.time)
        .filter(c=>c.source!=='utility'&&c.age<3.0&&c.certainty>=.40&&c.radius<7&&distance(c,this.bomb)<22)
        .sort((a,b)=>(b.certainty*(b.source==='sight'?1.45:1)/(1+distance(p,b)*.035))-(a.certainty*(a.source==='sight'?1.45:1)/(1+distance(p,a)*.035)))[0];
      const contactFireEligible=!!retakeThreat&&retakeThreat.age<2.6&&retakeThreat.certainty>=.45&&retakeThreat.radius<5.5;
      const allyFightingSite=allies.find(a=>a!==p&&distance(a,this.bomb)<20&&(!!a.target||(!!a.contact&&this.time-a.contactAt<2.5)||this.time-a.damageAt<2.5));
      const allyThreatPoint=allyFightingSite?(allyFightingSite.aimPoint??allyFightingSite.contact):undefined;
      const defusingNow=allies.some(a=>a.channel>0);
      if(p.smoke&&!covered&&usefulBeforeExplosion('smoke',this.bomb)&&distance(p,this.bomb)<24
        &&(fireAtBomb||allies.some(a=>a.channel>0||distance(a,this.bomb)<4)||(retakeThreat&&retakeThreat.age<2.8&&retakeThreat.radius<5.5)
          ||(p.id!==defuseAssignment.id&&!!allyFightingSite&&allies.some(a=>distance(a,this.bomb)<10)))){
        if(this.throwUtility(p,'smoke',{x:this.bomb.x,z:this.bomb.z}))return 'Smoke the device to cover the defuse';
      }
      if(p.smoke&&covered&&retakeThreat&&retakeThreat.age<2.5&&retakeThreat.radius<5&&(retakeThreat.source==='sight'||retakeThreat.source==='damage'||retakeThreat.source==='gunfire')
        &&distance(retakeThreat,this.bomb)>=5.5&&distance(retakeThreat,this.bomb)<22&&distance(p,retakeThreat)<26
        &&!smokeAt(retakeThreat)&&!reserved('smoke',retakeThreat)&&!allies.some(a=>distance(a,retakeThreat)<5)&&usefulBeforeExplosion('smoke',retakeThreat)){
        if(this.throwUtility(p,'smoke',{x:retakeThreat.x,z:retakeThreat.z}))return 'Smoke off the reported post-plant angle';
      }
      if(p.incendiary){
        if(contactFireEligible&&distance(p,retakeThreat)<24&&!fireAt(retakeThreat)&&!smokeAt(retakeThreat)&&!reserved('incendiary',retakeThreat)
          &&usefulBeforeExplosion('incendiary',retakeThreat)&&(distance(retakeThreat,this.bomb)>4.5||(!allies.some(a=>a.channel>0||distance(a,this.bomb)<5.5)&&this.bomb.remaining-defuseAssignment.seconds>=6))){
          if(this.throwUtility(p,'incendiary',{x:retakeThreat.x,z:retakeThreat.z}))return 'Flush the reported post-plant angle with fire';
        }
        const cuePoint=retakeThreat??allyThreatPoint;
        if(cuePoint&&this.bomb.remaining-defuseAssignment.seconds>=4){
          const hold=this.map.definition.tactical[site].postPlant.filter(h=>distance(h,cuePoint)<6.5&&distance(h,this.bomb)>4.8&&distance(p,h)<23
            &&!fireAt(h)&&!smokeAt(h)&&!reserved('incendiary',h)&&!allies.some(a=>distance(a,h)<5.5)&&usefulBeforeExplosion('incendiary',h))
            .sort((a,b)=>distance(cuePoint,a)-distance(cuePoint,b))[0];
          if(hold&&this.throwUtility(p,'incendiary',{x:hold.x,z:hold.z}))return 'Burn out the contested post-plant position';
        }
      }
      if(p.he){
        if(contactFireEligible&&(retakeThreat.source==='sight'||retakeThreat.source==='damage'||retakeThreat.source==='gunfire')
          &&distance(p,retakeThreat)<25&&!reserved('he',retakeThreat)&&usefulBeforeExplosion('he',retakeThreat)){
          if(this.throwUtility(p,'he',{x:retakeThreat.x,z:retakeThreat.z}))return 'HE the reported post-plant defender';
        }
        const sightTarget=retakeThreat??this.bomb;
        const blockingSmoke=p.knownSmokes.find(s=>s.expires>this.time+3.5&&distance(s,this.bomb)>4.8&&distance(s,this.bomb)<20&&distance(p,s)<22
          &&!allies.some(a=>a.channel>0||distance(a,s)<6)&&liveSmokeOccludes(p,sightTarget,(p.crouch?1.08:1.6)+p.jumpY,this.map.terrain.groundHeight(sightTarget)+1.3,s,this.time)
          &&allies.some(a=>a!==p&&a.ammo>0&&a.reload<=0&&a.blinded<.2&&distance(a,s)<16));
        if(blockingSmoke&&!reserved('he',blockingSmoke)&&usefulBeforeExplosion('he',blockingSmoke)&&this.throwUtility(p,'he',{x:blockingSmoke.x,z:blockingSmoke.z})){
          return 'HE the retake-blocking smoke to open the line';
        }
      }
      if(p.flash&&!defusingNow&&(p.id!==defuseAssignment.id||allies.length===1&&this.bomb.remaining-defuseAssignment.seconds>=4.5)){
        if(retakeThreat&&distance(p,retakeThreat)<26&&!reserved('flash',retakeThreat,5)&&usefulBeforeExplosion('flash',retakeThreat)){
          if(this.throwUtility(p,'flash',{x:retakeThreat.x,z:retakeThreat.z}))return 'Flash the reported post-plant contest';
        }else if(allyFightingSite&&p.id!==defuseAssignment.id&&distance(p,this.bomb)<25){
          const target=allyThreatPoint&&distance(allyThreatPoint,this.bomb)<20?{x:allyThreatPoint.x,z:allyThreatPoint.z}:{x:this.bomb.x,z:this.bomb.z};
          if(!reserved('flash',target,6)&&!reserved('flash',this.bomb,6)&&usefulBeforeExplosion('flash',target)&&this.throwUtility(p,'flash',target)){
            return 'Flash the site to support the retake swing';
          }
        }
      }
    }
    if(p.attacking&&p.flash&&nearBomb&&known!.source==='sight'&&distance(p,this.bomb)<18&&!reserved('flash',this.bomb)&&usefulBeforeExplosion('flash',this.bomb)){
      const target={x:this.bomb.x,z:this.bomb.z};
      if(this.throwUtility(p,'flash',target))return 'Flash the reported post-plant contest';
    }
    return;
  }
  private useInformationUtility(p:Actor,allies:Actor[]):string|undefined {
    if(this.time<p.utilityAt||p.reload>0||p.blinded>.2||p.channel>0||p.utilityPreparation||this.bomb.status==='planted')return;
    const execute=this.informationOrders[p.team];
    if(p.attacking&&execute.mode==='execute'&&liveOrderActive(execute,this.time)&&execute.executePhase!=='breach')return;
    const tactical=this.map.definition.tactical,sites=this.map.definition.sites;
    const reserved=(kind:LiveGrenadeKind,target:FpsPoint,radius=4)=>allies.some(a=>a!==p&&a.utilityPreparation?.kind===kind&&distance(a.utilityPreparation.target,target)<radius)
      ||hasBlackboardClaim(this.teamBlackboard(p.team),'throw_utility',`${kind}:${Math.round(target.x/4)}:${Math.round(target.z/4)}`,this.time,p.id)
      ||this.grenades.some(g=>g.team===p.team&&g.kind===kind&&distance(predictLiveGrenade(g,this.time,this.map),target)<radius);
    const smokeAt=(point:FpsPoint)=>p.knownSmokes.some(s=>s.expires>this.time+2&&distance(s,point)<LIVE_HE_RULES.smokeClearanceRadius)||reserved('smoke',point);
    const fireAt=(point:FpsPoint)=>this.fires.some(f=>f.expires>this.time+1&&distance(f,point)<Math.max(f.radius,2)
      &&(f.team===p.team||this.observablePoint(p,f)))||reserved('incendiary',point);
    const known=strongestLiveIntel(p.intel,p,this.time);
    const tendency=knownFpsTendency(p.patterns,this.round,this.map.intelArea);
    if(!p.attacking&&this.liveElapsed<14&&p.channel===0){
      const home=this.defenseHome(p),earlyArea=tendency&&tendency.area!=='Mid'&&tendency.early>=2?tendency.area:(this.defenseSetup==='aggressive_banana'?'B':undefined);
      if(earlyArea&&earlyArea===home){
        const gate=tactical[earlyArea].entries[p.slot%2];
        if(p.incendiary&&distance(p,gate)<20&&!fireAt(gate)&&!smokeAt(gate)&&this.throwUtility(p,'incendiary',gate)){
          this.radio(p,`Anti-rush molly at ${this.map.callout(gate)} — holding early space!`);
          return `Preempt early ${earlyArea} rush with incendiary`;
        }
        if(p.he&&this.defenseSetup==='aggressive_banana'&&distance(p,gate)<20&&this.liveElapsed<10&&!reserved('he',gate)&&this.throwUtility(p,'he',gate)){
          return `Preemptive anti-rush HE at ${this.map.callout(gate)}`;
        }
      }
    }
    if(!p.attacking&&p.smoke&&this.liveElapsed<25&&tendency&&tendency.area!=='Mid'&&tendency.early>=2&&this.skill(p,'informationReading',p.skills.gameSense)>.45){
      const gate=tactical[tendency.area].entries[p.slot%2];
      if(distance(p,gate)<18&&!smokeAt(gate)&&!fireAt(gate)&&this.throwUtility(p,'smoke',gate)){
        this.radio(p,`Delaying the ${tendency.area} choke they used early - current positions unknown.`);
        return 'Anticipate previously observed early pressure with delay smoke';
      }
    }
    if(p.attacking&&!(execute.mode==='execute'&&liveOrderActive(execute,this.time))&&p.smoke&&p.channel===0&&this.remaining>20&&distance(p,sites[this.site])<28) {
      const lineups=this.map.authoredSmokeLineups.filter(lineup=>lineup.phase==='execute'&&lineup.site===this.site&&!this.smokeLineupCovered(p.team,lineup)&&!reserved('smoke',lineup.target));
      const throwers=allies.filter(a=>a.attacking&&a.hp>0&&a.smoke>0&&!a.bomb&&a.channel===0&&!this.duelCommitted(a))
        .sort((a,b)=>Number(b.role==='support')-Number(a.role==='support')||Number(b.role==='caller')-Number(a.role==='caller')||a.slot-b.slot);
      const lineup=lineups[throwers.indexOf(p)];
      if(lineup&&this.assignSmokeLineup(p,lineup))return `Set up the ${lineup.name} smoke lineup`;
    }
    if(p.attacking&&this.fakeSite&&this.liveElapsed<26&&(p.role==='lurker'||p.role==='caller')&&distance(p,sites[this.fakeSite])<26){
      const fakePoint=tactical[this.fakeSite].entries[0];
      if(p.flash&&distance(p,fakePoint)<24&&!reserved('flash',fakePoint)&&this.throwUtility(p,'flash',fakePoint))return `Throw decoy flash toward ${this.fakeSite} to sell the fake`;
      if(p.smoke&&this.roundVariant>=.65&&distance(p,fakePoint)<22&&!smokeAt(fakePoint)&&this.throwUtility(p,'smoke',fakePoint))return `Smoke ${this.fakeSite} choke to draw rotations`;
      if(p.ammo>10&&!p.reload&&p.equipped===p.weapon&&p.weaponReady===0&&this.time>=p.nextShot&&this.time-p.lastShot>1.8&&distance(p,fakePoint)<24&&this.map.sightline(p,fakePoint)){
        p.aimFocus={point:{...fakePoint},source:'contact',until:this.time+.6,from:{x:p.x,z:p.z}};
        this.turn(p,heading(p,fakePoint));
        if(Math.abs(angle(heading(p,fakePoint)-p.yaw))<.35){
          const decoyTarget={id:`decoy:${p.id}`,team:other(p.team),x:fakePoint.x,z:fakePoint.z,yaw:0,hp:100,blinded:0,lastShot:-100,channel:0,flashedBy:undefined,crouch:false,jumpY:this.map.terrain.groundHeight(fakePoint),speed:0} as Actor;
          this.fire(p,decoyTarget);
          this.radio(p,`Making noise at ${this.fakeSite} to pull their rotators!`);
          return `Fire decoy bursts toward ${this.fakeSite}`;
        }
      }
    }
    const entry=allies.find(a=>a!==p&&!a.bomb&&a.role==='entry'&&distance(p,a)<17&&distance(a,sites[this.site])<19);
    const support=allies.filter(a=>a!==entry&&!a.bomb&&(a.flash>0||a.incendiary>0)).sort((a,b)=>Number(b.role==='support')-Number(a.role==='support')||Number(b.role==='caller')-Number(a.role==='caller')||a.slot-b.slot)[0];
    const entryAdvancing=entry&&(entry.speed>.35||!!entry.goal&&distance(entry.goal,sites[this.site])+1<distance(entry,sites[this.site])
      ||!!known&&known.age<2&&distance(known,entry)<20||execute.mode==='execute'&&execute.executePhase==='breach'&&liveOrderActive(execute,this.time));
    if(p.attacking&&p===support&&entry&&entryAdvancing&&this.skill(p,'coordination',p.skills.teamwork)>.3){
      const hold=tactical[this.site].holds.filter(h=>distance(p,h)<30).sort((a,b)=>distance(entry,a)-distance(entry,b))[0];
      if(hold&&p.incendiary&&!fireAt(hold)&&!smokeAt(hold)&&this.skill(p,'decisionMaking',p.skills.gameSense)>.45&&this.throwUtility(p,'incendiary',hold))return 'Clear a common anchor hold with fire; enemy presence unconfirmed';
      if(p.flash&&!reserved('flash',tactical[this.site].flash)&&this.throwUtility(p,'flash',tactical[this.site].flash))return 'Pop-flash the known entry angles for the advancing entry';
    }
    const reconFlash=():string|undefined=>{
      if(p.flash<=0||p.target||p.bomb||(p.attacking&&this.remaining<=28)||(entry&&!entryAdvancing)||(p.decision!=='probe'&&!(p.role==='lurker'&&!entry)&&!(!entry&&p.flash>=2)))return;
      const candidates=[...liveAssaultApproaches(this.site,p,this.map),{key:'mid:control',point:tactical.mid.control}];
      const stale=candidates
        .filter(c=>distance(p,c.point)>8&&distance(p,c.point)<23&&!allies.some(a=>distance(a,c.point)<6))
        .map(c=>({c,u:sampleInfluenceUncertainty(this.influenceGrid(p.team),c.point,this.time)}))
        .filter(item=>item.u>=.78)
        .sort((a,b)=>b.u-a.u)[0];
      if(!stale||reserved('flash',stale.c.point,7))return;
      const target={x:stale.c.point.x,z:stale.c.point.z};
      const busyAllies=allies.filter(a=>a!==p&&(a.channel>0||this.duelCommitted(a))).map(a=>({x:a.x,z:a.z,yaw:a.yaw,crouch:a.crouch,jumpY:a.jumpY}));
      const solvedFlash=solveLivePopFlash(this.utilityHandPoint(p,target),target,1.55+(p.groundY??this.map.terrain.groundHeight(p)),busyAllies,this.map);
      const burst=solvedFlash?.target??target;
      const exposure=allies.filter(a=>distance(a,burst)<12&&this.map.sightline(a,burst)&&Math.cos(angle(heading(a,burst)-a.yaw))>0).length;
      if((solvedFlash||exposure<=1)&&this.throwUtility(p,'flash',burst)){
        this.radio(p,`Pop-flashing stale ${this.map.callout(burst)} for information — nobody cleared it recently.`);
        return 'Throw a recon flash into stale uncleared space';
      }
      return;
    };
    if(!known||known.age>3||known.certainty<.48)return reconFlash();
    // Escape / counter-flash when retreating low HP behind partial cover
    if(p.flash&&p.hp<50&&p.retreatUntil>this.time&&distance(p,known)<18){
      const awayYaw=heading(known,p),escapeBurst=this.map.safePoint({x:p.x+Math.sin(awayYaw)*2.5,z:p.z+Math.cos(awayYaw)*2.5,level:p.level});
      if(this.throwUtility(p,'flash',escapeBurst,'underhand')){
        this.radio(p,'Flashing off my retreat — resetting angle!');
        return 'Escape flash while disengaging from pressure';
      }
    }
    const area=liveIntelArea(known,this.map.intelArea);
    if(area==='Mid'){
      const lineup=this.map.authoredSmokeLineups.find(l=>p.attacking?(l.id==='mid-window'||(l.site==='Mid'&&l.phase==='opening')):l.id==='mid-delay');
      if(lineup&&p.role!=='anchor'&&!p.bomb&&p.smoke>0&&distance(p,lineup.position)<14
        &&this.skill(p,'informationReading',p.skills.gameSense)>.4&&this.assignSmokeLineup(p,lineup))return `Deny the reported Mid angle with ${lineup.name}`;
    }
    const evidence=assessLiveIntel(p.intel,this.time,this.map.intelArea)[area];
    const gate=area==='Mid'?tactical.mid.control:tactical[area].entries[p.slot%2];
    const totalUtility=p.flash+p.smoke+p.incendiary+p.he;
    const conserveLate=this.remaining<38&&totalUtility===1&&this.knownEnemyCount(p.team)>=3&&known.source==='footstep'&&evidence.identified===0&&!evidence.corroborated;

    // HE grenades punish recent, bounded contact evidence, flush active fires, or open a smoke lane.
    if(p.he&&known.age<1.8&&known.certainty>=.5&&known.radius<4&&distance(p,known)<24){
      const nearFire=this.fires.find(f=>f.expires>this.time+1&&distance(f,known)<5.5&&(f.team===p.team||this.observablePoint(p,f)));
      const smokeToClear=p.knownSmokes.find(s=>s.expires>this.time+4&&distance(s,known)<10&&distance(p,s)<22&&liveSmokeOccludes(p,known,(p.crouch?1.08:1.6)+p.jumpY,this.map.terrain.groundHeight(known)+1.3,s,this.time));
      const readyPeek=smokeToClear&&allies.some(a=>a!==p&&a.ammo>0&&a.reload<=0&&a.blinded<.2&&a.weaponReady<=0&&a.equipped===a.weapon
        &&distance(a,smokeToClear)<15&&(a.target||a.decision==='pressure')&&Math.cos(angle(heading(a,known)-a.yaw))>.35&&this.map.sightline(a,known));
      if(smokeToClear&&readyPeek&&!reserved('he',smokeToClear)&&this.throwUtility(p,'he',{x:smokeToClear.x,z:smokeToClear.z})){
        this.radio(p,`Nading the ${this.map.callout(smokeToClear)} smoke — swing through the gap!`);
        return 'Clear smoke with HE for a coordinated peek';
      }
      if(nearFire&&(known.source==='sight'||known.source==='damage')){
        const d=distance(p,nearFire)||1,flush={x:nearFire.x+(nearFire.x-p.x)/d*1.8,z:nearFire.z+(nearFire.z-p.z)/d*1.8};
        if(!reserved('he',flush)&&this.throwUtility(p,'he',flush))return 'Combine HE behind active fire to punish retreat';
      }
      if(known.source==='sight'||known.source==='damage'||evidence.identified>0||evidence.corroborated){
        if(!reserved('he',known)&&this.throwUtility(p,'he',{x:known.x,z:known.z}))return evidence.identified>=2||evidence.corroborated?'Stack HE on corroborated contact evidence':`HE the recent ${area} contact`;
      }
    }

    // Incendiary fire expands into a broad, damaging denial zone over its first seconds.
    if(!conserveLate&&p.incendiary&&known.age<2.2&&known.certainty>=.55&&known.radius<4&&distance(p,known)<22&&!fireAt(known)&&!smokeAt(known)
      &&(p.attacking?distance(p,sites[this.site])<24:evidence.identified>=1||evidence.strength>.45)){
      if(this.throwUtility(p,'incendiary',{x:known.x,z:known.z}))return `Burn the reported ${area} crossing`;
    }

    // 1. Defenders delay reported area pressure at entries / chokes
    if(!conserveLate&&!p.attacking&&p.smoke&&evidence.identified>=2&&distance(p,gate)<19&&!smokeAt(gate)&&!fireAt(gate)){
      if(this.throwUtility(p,'smoke',gate))return `Delay reported ${area} pressure while support arrives`;
    }

    // 2. Early choke delay smokes upon rush audio / sight evidence
    if(!conserveLate&&!p.attacking && p.smoke) {
      const chokes=[{name:tactical.chokes[0]?.name??'B entry',area:'B' as const,point:tactical.B.entries[0]},{name:tactical.chokes[1]?.name??'A entry',area:'A' as const,point:tactical.A.entries[0]}];
      for(const choke of chokes) {
        if(distance(p,choke.point)<22&&!smokeAt(choke.point)&&!fireAt(choke.point)) {
          const earlyRound=this.remaining>45&&this.bomb.status==='carried';
          const threatened=area===choke.area&&(earlyRound?(evidence.identified>=1||evidence.corroborated||evidence.strength>0.62):(evidence.identified>=1||evidence.strength>0.4));
          if(threatened && this.throwUtility(p,'smoke',choke.point)) {
            this.radio(p,`Smoking ${choke.name} to stall the rush — hold cross bro!`,true);
            return `Delay reported ${choke.area} pressure while support arrives`;
          }
        }
      }
    }

    // 4. Support pop-flashes for entries
    const entryTeammate=allies.find(a=>a!==p&&a.role==='entry'&&a.attacking&&a.hp>0&&distance(p,a)<16);
    if(p.role==='support'&&p.flash&&entryTeammate&&distance(entryTeammate,gate)<22){
      const entryAhead={x:entryTeammate.x+Math.sin(entryTeammate.yaw)*8,z:entryTeammate.z+Math.cos(entryTeammate.yaw)*8};
      const flashTarget=known.source==='sight'&&distance(entryTeammate,known)>=5&&distance(known,gate)<16?{x:known.x,z:known.z}:distance(p,gate)<=22?{x:gate.x,z:gate.z}:entryAhead;
      const busyAllies=allies.filter(a=>a!==p&&(a.channel>0||this.duelCommitted(a))).map(a=>({x:a.x,z:a.z,yaw:a.yaw,crouch:a.crouch,jumpY:a.jumpY}));
      const solvedFlash=solveLivePopFlash(this.utilityHandPoint(p,flashTarget),flashTarget,1.55+(p.groundY??this.map.terrain.groundHeight(p)),busyAllies,this.map);
      const burst=solvedFlash?.target??flashTarget;
      const exposure=allies.filter(a=>distance(a,burst)<12&&this.map.sightline(a,burst)&&Math.cos(angle(heading(a,burst)-a.yaw))>0).length;
      if((solvedFlash||exposure<=1)&&!reserved('flash',burst)&&this.throwUtility(p,'flash',burst)){
        this.radio(p,`Flashing for you ${entryTeammate.name}, swing on the pop!`,true);
        entryTeammate.watchPoint={x:burst.x,z:burst.z};
        entryTeammate.nextThink=this.time;
        return `Pop-flash for ${entryTeammate.name}'s entry`;
      }
    }
    const fighting=allies.find(a=>a!==p&&a.target&&distance(a,known)<13&&distance(a,p)<15);
    if(p.role==='support'&&p.flash&&known.source==='sight'&&fighting){
      const burst={x:p.x+(known.x-p.x)*.8,z:p.z+(known.z-p.z)*.8};
      const busyAllies=allies.filter(a=>a!==p&&(a.channel>0||this.duelCommitted(a))).map(a=>({x:a.x,z:a.z,yaw:a.yaw,crouch:a.crouch,jumpY:a.jumpY}));
      const solvedFlash=solveLivePopFlash(this.utilityHandPoint(p,burst),burst,1.55+(p.groundY??this.map.terrain.groundHeight(p)),busyAllies,this.map);
      const flashPoint=solvedFlash?.target??burst;
      const exposure=allies.filter(a=>distance(a,flashPoint)<13&&this.map.sightline(a,flashPoint)&&Math.cos(angle(heading(a,flashPoint)-a.yaw))>0).length;
      if((solvedFlash||exposure<=1)&&!reserved('flash',flashPoint)&&this.throwUtility(p,'flash',flashPoint)) {
        this.radio(p,`Flashing for you ${fighting.name}, swing him now!`,true);
        return 'Flash the reported fight for a teammate';
      }
    }
    return reconFlash();
  }
  private perceive(p:Actor) {
    p.knownSmokes=p.knownSmokes.flatMap(known=>{
      const actual=this.smokes.find(smoke=>smoke.id===known.id);
      return actual?[{...actual}]:known.expires>this.time&&!this.observablePoint(p,known)?[known]:[];
    });
    for(const smoke of this.smokes){
      const d=distance(p,smoke),edge={x:smoke.x+(p.x-smoke.x)/(d||1)*Math.min(smoke.radius,d),z:smoke.z+(p.z-smoke.z)/(d||1)*Math.min(smoke.radius,d)};
      const eyeY=(p.crouch?1.08:1.6)+(p.jumpY??0);
      if(p.blinded<.2&&d<30&&(d<smoke.radius||Math.abs(angle(heading(p,edge)-p.yaw))<.82)&&this.map.sightline(p,edge,eyeY,smoke.y)) {
        const existing=p.knownSmokes.find(s=>s.id===smoke.id);
        if(existing)Object.assign(existing,smoke);else p.knownSmokes.push({...smoke});
      }
    }
    const grid=this.influenceGrid(p.team);
    if(p.blinded<.2){
      const eyeY=(p.crouch?1.08:1.6)+(p.jumpY??0);
      stampInfluenceFov(grid,p,p.yaw,this.time,28,(orig,dx,dz,maxR)=>{
        let clearDist=0;
        for(let dist=4;dist<=maxR;dist+=4){
          const probe:FpsPoint={x:orig.x+dx*dist,z:orig.z+dz*dist,level:orig.level};
          if(!this.map.sightline(orig,probe,eyeY,eyeY)||this.smokes.some(s=>s.expires>this.time&&liveSmokeOccludes(orig,probe,eyeY,eyeY,s,this.time)))break;
          clearDist=dist;
        }
        return Math.max(2,clearDist);
      });
    }
    for(const corpse of this.corpses){
      if(corpse.attacking!==p.attacking)continue;
      const corpseKey=`${p.team}:${corpse.id}`;
      if(this.corpseDangerRecorded.has(corpseKey)||!this.observablePoint(p,corpse))continue;
      this.corpseDangerRecorded.add(corpseKey);
      recordInfluenceDanger(grid,corpse,1.35,this.time,1);
    }
    const visible=this.actors.filter(t=>t.team!==p.team&&t.hp>0&&this.visible(p,t));
    p.noticedEnemies=visible.map(t=>({id:t.id,x:t.x,z:t.z,level:t.level,hp:t.hp,reload:t.reload,blinded:t.blinded,lastShot:t.lastShot,channel:t.channel}));
    const value=(t:Actor)=>-distance(p,t)*.04+(t.id===p.target?.65:0)+this.skill(p,'decisionMaking',p.skills.gameSense)*((this.time-t.lastShot<1?.6:0)+(t.channel>0?.8:0)+(t.hp<40?.2:0));
    visible.sort((a,b)=>value(b)-value(a)||a.slot-b.slot);
    for(const enemy of visible){
      const wCat=LIVE_WEAPONS[enemy.weapon].category;
      const hint:LiveWeaponHint=wCat==='sniper'?'sniper':(enemy.weapon==='usp_s'||enemy.weapon==='m4a1_s')?'suppressed':wCat==='pistol'?'eco':'rifle';
      this.observeIntel(p,{key:`enemy:${enemy.id}`,enemyId:enemy.id,observerId:p.id,source:'sight',x:enemy.x,z:enemy.z,level:enemy.level,observed:this.time,confidence:.98,uncertainty:.45,weaponHint:hint,carryingBomb:enemy.bomb});
    }
    if(this.bomb.status==='dropped'&&this.observablePoint(p,this.bomb)){
      this.observeIntel(p,{key:'dropped-bomb',observerId:p.id,source:'sight',x:this.bomb.x,z:this.bomb.z,level:this.bomb.level,observed:this.time,confidence:.98,uncertainty:.45,carryingBomb:true});
    }
    clearLiveIntel(p.intel,this.time,point=>this.observablePoint(p,point),visible);
    this.refreshIntel(p);
    const held=visible.find(enemy=>enemy.id===p.target);
    const target=held&&(this.time<(p.targetCommitUntil??0)||this.time<(p.shotCommitUntil??0))?held:visible[0];
    // A short occlusion retains the last sampled aim without tracking the hidden body.
    if(!target&&p.target&&!this.confirmedDeaths.has(p.target)&&this.time-p.seenAt<.2)return;
    if(target?.id!==p.target){this.movementLearner(p.team)?.close(p.id);p.target=target?.id;p.targetCommitUntil=this.time+.65;p.shotCommitUntil=0;if(!target)p.pitch=0;p.acquired=this.time;p.strafeUntil=0;p.strafeSettleUntil=this.time+.3;p.triggerDisciplineUntil=undefined;p.engagementShots=0;p.engagementDamaged=false;p.aimPoint=undefined;p.previousSight=undefined;p.trackingPoint=undefined;
      const panicked=this.time<(p.panicUntil??0);
      const turnDelta=target?angle(heading(p,target)-p.yaw):0;
      if(target&&Math.abs(turnDelta)>.28){
        const flickSkill=this.skill(p,'flicking',p.skills.mechanics);
        const amp=(1-flickSkill*.72)*(.025+p.pressure*.05+(panicked?.065:0));
        p.flickOvershoot=Math.sign(turnDelta)*clamp(amp,.015,.13);
      }else{
        p.flickOvershoot=0;
      }
      const surpriseExtra=target&&panicked?.08+(1-(this.skill(p,'decisionMaking',p.skills.gameSense)*.5+this.skill(p,'reactions',p.skills.mechanics)*.5))*.12:0;
      p.reactionVariation=p.profile?1:.85+this.random()*.35;p.reaction=this.reactionDelay(p)*p.reactionVariation+surpriseExtra;
      if(p.profile&&target){p.motor.noticedAt=this.time;p.motor.cueAt=p.visualCueAt??this.time;p.motor.responseAt=-1;p.motor.reactionDelay=p.reaction;}}
    if(target){
      // Aim follows sampled personal vision; if head is behind smoke and only a shoulder/edge sticks out, target that exposed silhouette point.
      const vis=this.visiblePoint(p,target,false);
      const partial=!!vis&&(Math.abs(vis.x-target.x)>.02||Math.abs(vis.z-target.z)>.02||Math.abs(vis.y-liveActorHeadY(target))>.05);
      p.aimPoint=partial?{x:vis.x,z:vis.z,...(target.level?{level:target.level}:{})}:{x:target.x,z:target.z,...(target.level?{level:target.level}:{})};
      const aimQuality=this.skill(p,'precision',p.skills.mechanics),preferBody=p.burst>=3||aimQuality<.42||LIVE_WEAPONS[p.weapon].category==='sniper';
      p.sampledHeadY=partial?vis.y:preferBody?target.jumpY+(target.crouch?.78:1.08):liveActorHeadY(target);
      if(p.profile){
        const previous=p.previousSight,elapsed=previous?this.time-previous.at:0,tracking=this.skill(p,'tracking',p.skills.mechanics);
        const vx=previous&&elapsed>0?clamp((p.aimPoint.x-previous.x)/elapsed,-5,5):0,vz=previous&&elapsed>0?clamp((p.aimPoint.z-previous.z)/elapsed,-5,5):0;
        const desired={x:p.aimPoint.x+vx*tracking*.1,z:p.aimPoint.z+vz*tracking*.1};
        const blend=.25+tracking*.75;
        p.trackingPoint=p.trackingPoint?{x:p.trackingPoint.x+(desired.x-p.trackingPoint.x)*blend,z:p.trackingPoint.z+(desired.z-p.trackingPoint.z)*blend}:desired;
        p.motor.trackingSamples++;p.motor.trackingErrorSum+=distance(p.trackingPoint,p.aimPoint);
        p.previousSight={x:p.aimPoint.x,z:p.aimPoint.z,level:target.level,at:this.time,id:target.id};
      }
      p.seenAt=this.time;
    }
  }
  private decide(p:Actor) {
    this.refreshIntel(p);
    const identity=this.identity.players[p.id],team=this.identity.teams[p.team];
    const allies=this.actors.filter(a=>a.team===p.team&&a.hp>0);
    const seen=p.profile?p.noticedEnemies:this.actors.filter(a=>a.team!==p.team&&a.hp>0&&this.visible(p,a));
    const beliefs=liveIntelBeliefs(p.intel,this.time);
    const relevant=strongestLiveIntel(p.intel,p,this.time);
    const memoryFresh=!!p.contact&&(p.intelManaged?!!relevant&&relevant.certainty>=.25&&relevant.radius<16:this.time-p.contactAt<3+p.skills.gameSense*5);
    const anticipation=anticipateLiveContact(p.intel,p.motionSamples,p,this.time,this.skill(p,'informationReading',p.skills.gameSense),this.skill(p,'timing',p.skills.gameSense),this.skill(p,'decisionMaking',p.skills.gameSense));
    if(anticipation&&p.anticipation&&anticipation.key===p.anticipation.key&&anticipation.observed===p.anticipation.observed)anticipation.shots=p.anticipation.shots;
    p.anticipation=anticipation;
    const knownNearby=beliefs.filter(c=>c.enemyId&&c.certainty>.4&&distance(p,c)<22).length;
    p.enemyRemaining=this.knownEnemyCount(p.team);
    p.pressure=livePressure(allies.length,Math.max(seen.length,knownNearby),this.bomb.status==='planted'?this.bomb.remaining:this.remaining,this.bomb.status==='planted');
    p.reaction=this.reactionDelay(p)*p.reactionVariation;
    const defuseAssignment=!p.attacking&&this.bomb.status==='planted'?assignLiveObjective(allies,this.bomb,this.bomb.remaining,true,this.map):undefined;
    const cannotDefuse=!p.attacking&&this.bomb.status==='planted'&&!defuseAssignment;
    if(this.bomb.status==='planted'&&(p.attacking||cannotDefuse)){
      const perched=this.perchUnder(p),escOrigin=perched?perched.approaches[0]:p;
      if(!p.bombEscape&&this.bomb.remaining<=20&&this.time>=(p.escapeCheckAt??0)){
        p.escapePlan=planLiveBombEscape(escOrigin,this.bomb,p.slot,this.map);p.escapeCheckAt=this.time+.8;
      }
      const margin=1.5+this.skill(p,'decisionMaking',p.skills.gameSense)*1.1;
      if(!p.bombEscape&&p.escapePlan&&(cannotDefuse||this.bomb.remaining<=p.escapePlan.seconds+margin)){
        const escPath=p.escapePlan.path.map(point=>({...point}));
        p.bombEscape={point:{...p.escapePlan.point}};p.goal=p.bombEscape.point;
        p.path=perched?[{...perched.approaches[0]},...escPath]:escPath;
        p.perchGoal=undefined;p.crouch=false;
        if(p.utilityPreparation)this.cancelUtilityPreparation(p);if(p.reload>0)this.cancelReload(p);
        p.peek=undefined;p.channel=0;p.clearUntil=0;p.retreatUntil=0;
        this.radio(p,p.attacking?'Bomb timer is low; fall back beyond the blast and keep the weapons.':'No reachable defuse in time; get clear and save.',true);
      }
      if(p.bombEscape)return;
    }
    const standingFire=this.activeFireAt(p,.5,p.jumpY);
    if(standingFire&&!this.stickingFinalDefuse(p,allies)){
      if(p.utilityPreparation)this.cancelUtilityPreparation(p);
      if(p.smokeLineupId)this.clearSmokeLineup(p);
      if(p.channel>0)p.channel=0;
      const firePerched=this.perchUnder(p),escStart=firePerched?firePerched.approaches[0]:p;
      p.crouch=false;p.perchGoal=undefined;p.peek=undefined;p.clearUntil=0;p.retreatUntil=0;
      const esc=this.escapeFirePoint(p,standingFire,p.goal),rawFirePath=this.map.findPath(escStart,esc,this.fires,1);
      p.goal=esc;p.path=firePerched?[{...escStart},...rawFirePath]:rawFirePath;p.stuckFor=0;
      p.action='Escaping molotov fire';p.intent='Move out of active incendiary/molotov flames immediately';
      if(this.time-(p.lastFireCallAt??-100)>3){
        p.lastFireCallAt=this.time;
        this.radio(p,'Molotov on me — backing out of the fire!');
      }
      return;
    }

    const triggers=observedPersonalityTriggers({round:this.round,elapsed:this.liveElapsed,quietSeconds:this.time-p.contactAt,
      allies:allies.length,enemies:seen.length,winStreak:0,lossStreak:this.losses[p.team],prepared:this.liveElapsed<30,
      allyContact:memoryFresh,utilityNeeded:seen.length>0,poorRetake:cannotDefuse,callerAlive:allies.some(a=>a.role==='caller'||a.role==='support')});
    const coordination=this.skill(p,'coordination',p.skills.teamwork)*(allies.some(a=>a!==p&&distance(p,a)<8)?.25:.05);
    const judgment=this.skill(p,'decisionMaking',p.skills.gameSense);
    const informationSeeking=this.skill(p,'informationReading',p.skills.gameSense);
    const activeCall=this.informationOrders[p.team];
    const executing=activeCall.mode==='execute'&&liveOrderActive(activeCall,this.time);
    if(executing)this.acknowledge(p,activeCall);
    const timingWindow=!!p.profile&&beliefs.some(c=>(c.source==='gunfire'||c.source==='reload')&&c.age<.6&&distance(p,c)<15);
    if(timingWindow)p.motor.timingWindows++;
    if(p.profile)p.motor.decisions++;
    const livingEnemies=this.knownEnemyCount(p.team),prefs=fpsBehaviorPreferences(identity.personality);
    if(livingEnemies===0){p.peek=undefined;p.clearUntil=0;p.retreatUntil=0;if(p.channel===0)p.crouch=false;if(p.smokeLineupId)this.clearSmokeLineup(p);}
    const savePrePlant=this.bomb.status!=='planted'&&!p.bomb&&allies.length===1&&livingEnemies>=4&&this.remaining<42
      &&LIVE_WEAPONS[p.weapon].cost>=2700&&(team.plan.economy>.52||prefs.deliberation>.52);
    const huntSurvivors=this.bomb.status!=='planted'&&allies.length>=4&&livingEnemies<=2&&this.remaining>18&&!p.bomb;
    const punishWindow=!!relevant&&!p.target&&p.hp>=48&&relevant.age<1.2&&distance(p,relevant)<(relevant.weaponHint==='sniper'?20:15)
      &&(relevant.source==='reload'||(relevant.weaponHint==='sniper'&&relevant.source==='gunfire'));
    const partnerFighting=allies.find(a=>a!==p&&!p.bomb&&p.hp>=45&&distance(p,a)<14&&this.duelCommitted(a)&&(a.aimPoint||a.contact));
    const cannotReach=cannotDefuse||savePrePlant;
    const decision=evaluatePlayerAction(identity,{triggers,confidence:clamp(.5+(this.score[p.team]-this.score[other(p.team)])*.025-this.losses[p.team]*.04,.1,.9),fatigue:p.profile?0:p.exertion*(1-p.skills.stamina),teamIdentity:team.culture},team.coach,team.plan,team.chemistry,[
      {action:'pressure',legal:!cannotReach,tacticalValue:(p.attacking?.5:.05)+(executing?this.skill(p,'coordination',p.skills.teamwork)*.45:0)+(seen.some(t=>t.blinded>.2||t.reload>0)?judgment*.35:0)+(timingWindow?this.skill(p,'timing',0)*.3:0)+(punishWindow?.4:0)+(partnerFighting?.32:0)+(huntSurvivors?.45:0),instruction:identity.instruction==='initiative'?1:team.plan.aggression},
      {action:'prepare',legal:!cannotReach,tacticalValue:(p.attacking?.2:.5)+(p.hp<50?judgment*.3:0),instruction:identity.instruction==='hold'?1:team.plan.preparation},
      {action:'coordinate',legal:!cannotReach,tacticalValue:.35+coordination+(partnerFighting?.25:0),instruction:identity.instruction==='support'?1:team.plan.structure},
      {action:'improvise',legal:!cannotReach&&memoryFresh&&!p.target,tacticalValue:.25,instruction:team.plan.freedom},
      {action:'react',legal:!cannotReach,tacticalValue:memoryFresh?.3+judgment*.3:.1,instruction:team.plan.freedom},
      {action:'probe',legal:!cannotReach&&!seen.length&&(p.attacking||p.role!=='anchor'),tacticalValue:.45+informationSeeking*.35,instruction:team.plan.freedom},
      {action:'save',legal:cannotReach,tacticalValue:savePrePlant?.9:1,instruction:team.plan.economy},
    ],this.random).action;
    if(this.time>=(p.shotCommitUntil??0)||p.hp<35||p.reload>0)p.decision=decision;
    if(punishWindow&&decision==='pressure'&&relevant){p.contact={x:relevant.x,z:relevant.z,level:relevant.level};p.contactAt=relevant.observed;}
    else if(partnerFighting&&decision==='pressure'){
      const partnerTarget=partnerFighting.aimPoint??partnerFighting.contact;
      if(partnerTarget){p.contact={...partnerTarget};p.contactAt=this.time;}
    }
    if(p.behavior){
      if(seen.length){observeFpsBehavior(p.behavior,'engagement',decision==='pressure'||decision==='react');observeFpsBehavior(p.behavior,'risk',decision==='pressure');}
      if(allies.some(a=>a!==p&&distance(p,a)<16)){observeFpsBehavior(p.behavior,'coordination',decision==='coordinate');observeFpsBehavior(p.behavior,'strategyCompliance',decision==='coordinate'||decision==='prepare');}
      if(executing&&!p.bomb)observeFpsBehavior(p.behavior,'firstContact',decision==='pressure');
      if(memoryFresh&&p.flash+p.smoke+p.incendiary+p.he>0)observeFpsBehavior(p.behavior,'utilitySupport',decision==='coordinate');
      if(activeCall.responders.includes(p.id)&&['rotate','reinforce'].includes(activeCall.mode))observeFpsBehavior(p.behavior,'rotation',decision==='react'||decision==='coordinate'||decision==='pressure');
      if(memoryFresh&&!p.target)observeFpsBehavior(p.behavior,'improvisation',decision==='improvise');
      if(p.position==='T_LURKER'&&executing)observeFpsBehavior(p.behavior,'lurkTiming',decision==='pressure'||decision==='improvise');
      if(seen.length&&allies.some(a=>a!==p&&(a.channel>0||a.reload>0)&&distance(p,a)<12))observeFpsBehavior(p.behavior,'sacrifice',decision==='coordinate');
      if(this.bomb.status==='planted'&&!p.attacking&&!cannotDefuse)observeFpsBehavior(p.behavior,'retake',decision!=='save');

    }

    if(p.target && this.time>=p.utilityAt) this.useUtility(p);
    const caller=[...allies].sort((a,b)=>Number(b.role==='caller')-Number(a.role==='caller')||this.skill(b,'calling',b.skills.leadership)-this.skill(a,'calling',a.skills.leadership))[0];
    if(p===caller)this.callFromInformation(p,allies);
    if(seen.length&&p.smokeLineupId)this.clearSmokeLineup(p);
    const assignedLineup=livingEnemies>0?this.map.authoredSmokeLineups.find(l=>l.id===p.smokeLineupId):undefined;
    const openingLineup=livingEnemies>0&&!seen.length?(assignedLineup?this.workSmokeLineup(p,assignedLineup):this.openingUtility(p)):false;
    const utilityIntent=livingEnemies>0&&openingLineup?'Set up the authored opening smoke':livingEnemies>0&&!seen.length
      ?this.bomb.status==='planted'?this.usePostPlantUtility(p,allies):this.useInformationUtility(p,allies)
      :undefined;
    let goal:FpsPoint,windowHold=false;
    const primary=this.map.definition.sites[this.site];
    const plantPlan=p.bomb&&this.bomb.status==='carried'?planLivePlant(p,livePlantSite(p,this.map)??this.site,beliefs,p.goal,allies.filter(a=>a!==p),this.map):undefined;
    const prevPerch=p.perchGoal;
    p.perchGoal=undefined;
    p.intent=p.attacking?'Act on personal information':'Hold the assigned angle';
    if(p.decision==='save'&&!(p.attacking&&this.bomb.status==='planted')) {
      const spawn=this.map.definition.spawns[p.attacking?'attackers':'defenders'];goal={x:spawn.x+(p.slot-2)*3,z:spawn.z,level:spawn.level};p.intent=cannotDefuse?'Preserve equipment: defuse time is gone':'Conserve high-value rifle in low-odds situation';
    } else if(this.bomb.status==='planted') {
      const site=this.bomb.site??this.site;
      if(p.attacking){
        const heardDefuse=this.heardBombDefuseActive(p);
        const bombSmoked=p.knownSmokes.some(s=>s.expires>this.time&&distance(s,this.bomb)<s.radius+1.5);
        const assignment=this.postPlantAssignment(p,site);
        if(heardDefuse){
          p.watchPoint={...this.bomb};
          if(distance(p,this.bomb)<=13&&(bombSmoked||p.ammo<=3||!this.map.sightline(p,this.bomb))){
            goal={...this.bomb};
            p.decision='pressure';
            p.intent=bombSmoked?'Defuse heard in smoke — spam and charge bomb to stop sneaky defuse':'Defuse sound heard — contest the bomb closely';
          }else{
            goal=assignment.point;
            p.intent='Defuse sound heard — orient toward bomb';
          }
        }else{
          goal=assignment.point;p.watchPoint=assignment.watch;p.intent=this.postPlantIntent(p)+'. '+assignment.reason;
          const postPerch=this.selectPerchForHold(p,this.bomb,allies,prevPerch);
          if(postPerch&&!p.bomb&&((prevPerch?.id===postPerch.id)||(((this.round+p.slot)%4===1||p.decision==='improvise')&&distance(p,postPerch.top)<11))){
            p.perchGoal=postPerch;
            goal=this.isOnPerch(p,postPerch)&&Math.abs(p.jumpY-postPerch.height)<.12
              ?{...postPerch.top}
              :postPerch.approaches.slice().sort((a,b)=>distance(p,a)-distance(p,b))[0];
            p.watchPoint={...this.bomb};
            p.intent=`Hold elevated post-plant off-angle on ${postPerch.name}`;
          }
        }
      }
      else {
        const defuser=allies.find(a=>a.id===defuseAssignment?.id);
        if(p===defuser) {
          const nearKit=!p.kit&&this.bomb.remaining>=6.5?this.droppedKits.filter(k=>distance(p,k)<12&&this.map.pathLength(p,k)<14&&!this.activeFireAt(k,.4)).sort((a,b)=>distance(p,a)-distance(p,b))[0]:undefined;
          const canWait=livingEnemies>0&&allies.some(a=>a!==p&&distance(a,p)<14)&&distance(p,this.bomb)>5
            &&this.bomb.remaining>(defuseAssignment?.seconds??10)+8&&!this.duelCommitted(p);
          if(livingEnemies>0&&p.retakeWaitUntil===undefined)p.retakeWaitUntil=this.time+1.8;
          const covered=allies.some(a=>a!==p&&distance(a,this.bomb)<12);
          const wait=canWait&&!covered&&this.time<(p.retakeWaitUntil??0);
          goal=nearKit?{...nearKit}:wait?{x:p.x,z:p.z,level:p.level}:this.bomb;
          p.intent=nearKit?'Grab dropped defuse kit before sticking bomb':livingEnemies===0?'All opponents eliminated — stick the defuse':wait?'Give the nearby cover player a moment to join':'Reach and defuse the device';
          p.watchPoint=livingEnemies>0&&relevant?{x:relevant.x,z:relevant.z,level:relevant.level}:{...this.bomb};
        } else if(livingEnemies===0) {
          const upgrade=this.droppedWeapons.filter(w=>this.isWeaponUpgradeFor(p,w)&&distance(p,w)<26&&!this.activeFireAt(w,.4)
            &&!allies.some(a=>a!==p&&a.goal&&distance(a.goal,w)<.6))
            .sort((a,b)=>LIVE_WEAPON_TIERS[b.weapon]-LIVE_WEAPON_TIERS[a.weapon]||distance(p,a)-distance(p,b))[0];
          const dropKit=!upgrade&&!p.kit?this.droppedKits.filter(k=>distance(p,k)<20&&!this.activeFireAt(k,.4)).sort((a,b)=>distance(p,a)-distance(p,b))[0]:undefined;
          const dropUtil=!upgrade&&!dropKit?this.droppedUtility.filter(u=>(!u.reservedFor||u.reservedFor===p.id)&&this.time>=(u.airUntil??0)&&canCarryLiveUtility(p,u.kind)&&distance(p,u)<20&&!this.activeFireAt(u,.4)).sort((a,b)=>distance(p,a)-distance(p,b))[0]:undefined;
          const roamGoal=p.goal&&distance(p,p.goal)>.65&&!this.activeFireAt(p.goal,.4)&&this.time<(p.postRoamAt??0)
            ?p.goal:this.map.safePoint({x:p.x+Math.sin(p.slot*1.9+this.time*.7)*8,z:p.z+Math.cos(p.slot*1.9+this.time*.7)*8,level:p.level});
          if(!upgrade&&!dropKit&&!dropUtil&&roamGoal!==p.goal)p.postRoamAt=this.time+2.2;
          goal=upgrade?{x:upgrade.x,z:upgrade.z,level:upgrade.level}:dropKit?{x:dropKit.x,z:dropKit.z,level:dropKit.level}:dropUtil?{x:dropUtil.x,z:dropUtil.z,level:dropUtil.level}:roamGoal;
          p.watchPoint={...goal};
          p.intent=upgrade?`Scavenge dropped ${LIVE_WEAPONS[upgrade.weapon].name}`:'All opponents eliminated — scavenge upgrades freely';
        } else {
          const slack=this.bomb.remaining-(defuseAssignment?.seconds??(p.kit?5:10));
          const selected=this.selectTacticalApproach(p,liveRetakeApproaches(site,this.bomb,this.map),allies,'retake',this.bomb,
            Math.max(6,this.bomb.remaining-(defuser?.kit?5:10)));
          goal=selected?.point??this.map.safePoint(p);
          p.watchPoint=relevant?{x:relevant.x,z:relevant.z,level:relevant.level}:{...this.bomb};
          p.intent=slack<5?'Cover the defuser: clear the reachable angle immediately'
            :selected?`Cover the defuser through ${selected.key}; clear known threats`:'Cover the defuser from reachable space while reassessing the retake';
          // Utility is handled by usePostPlantUtility using personal evidence and
          // teammate safety, rather than an automatic centre-site flash on a timer.
        }
      }
    } else if(p.attacking) {
      if(this.bomb.status==='dropped') {
        const recovery=assignLiveObjective(allies,this.bomb,undefined,undefined,this.map);
        const recoverer=allies.find(a=>a.id===recovery?.id);
        const guardPoint=p!==recoverer?(this.map.findCover(p,relevant??primary,allies,this.skill(p,'positioning',p.skills.gameSense),[],this.heatSampler(p.team))??this.map.safePoint({x:this.bomb.x+Math.sin(p.slot*1.6)*6,z:this.bomb.z+Math.cos(p.slot*1.6)*6,level:this.bomb.level})):this.bomb;
        goal=p===recoverer?this.bomb:distance(guardPoint,this.bomb)<18?guardPoint:this.map.safePoint({x:this.bomb.x+Math.sin(p.slot*1.6)*6,z:this.bomb.z+Math.cos(p.slot*1.6)*6,level:this.bomb.level});
        p.watchPoint=p===recoverer?(relevant?{...relevant}:undefined):{...(relevant??this.bomb)};
        p.intent=p===recoverer?'Recover the dropped device':'Anchor recovery perimeter around the dropped bomb';
      }
      else {
        const planter=allies.find(a=>a.bomb&&(a.channel>0||a.equipped==='bomb')&&livePlantSite(a,this.map)!==undefined);
        if(p.bomb) {
          p.plantStyle=plantPlan?.style;goal=plantPlan?.point??this.map.safePoint(primary);p.intent=`Advance to a reachable ${plantPlan?.site??this.site} plant position`;
        } else if(planter) {
          const site=livePlantSite(planter,this.map)!;
          const assignment=this.postPlantAssignment(p,site,planter);goal=assignment.point;p.watchPoint=assignment.watch;p.intent='Cover the plant: '+assignment.reason;
        } else if(memoryFresh&&p.contact&&p.target===undefined&&canInvestigateLiveContact(p,relevant,this.remaining,p.role==='lurker')) {
          goal=this.map.findPeek(p,p.contact)??p.contact;
          p.intent='Investigate the last reported contact';
        } else {
          const tactical=this.map.definition.tactical;
          const midZ=(this.map.definition.spawns.attackers.z+this.map.definition.spawns.defenders.z)*.5;
          const candidates:LiveApproach[]=[
            ...liveAssaultApproaches(this.site,p,this.map),
            ...(this.remaining>35&&p.z<midZ?[
              {key:'mid:control',point:tactical.mid.control,purpose:'control' as const},
            ]:[]),
          ];
          const reached=candidates.find(c=>c.key===p.probeGoal&&distance(p,c.point)<2.6);
          if(reached){p.probeVisited.add(reached.key);p.approachUntil=0;}
          const order=this.informationOrders[p.team];
          const execute=order.mode==='execute'&&liveOrderActive(order,this.time);
          const heatAt=this.heatSampler(p.team),uncertaintyAt=this.uncertaintySampler(p.team);
          const routeTo=createLiveRoutePlanner(p,beliefs,0,heatAt,this.map);
          const weaponCat=LIVE_WEAPONS[p.weapon].category,weaponProfile=inferEnemyWeaponProfile(p.intel,this.time);
          const preferredRange=(weaponCat==='sniper'?18:weaponCat==='shotgun'?4.5:weaponCat==='smg'?6:p.role==='entry'?6:p.hp<45?12:10)+(weaponProfile.ecoSignal>=.8&&weaponCat!=='shotgun'?4:0);
          const claimedGoals=blackboardClaimedPoints(this.teamBlackboard(p.team),this.time,p.id);
          const selected=chooseLiveApproach(candidates,{position:p,role:p.role,remaining:this.remaining,judgment,behavior:fpsBehaviorPreferences(identity.personality),decision:p.decision,
            allies:allies.filter(a=>a!==p),alliedGoals:[...allies.filter(a=>a!==p&&a.goal).map(a=>a.goal!),...claimedGoals],routeTo,
            beliefs,previous:p.probeGoal,committed:this.time<(p.approachUntil??0),visited:p.probeVisited,execute,
            objective:primary,health:p.hp,entrySkill:this.skill(p,'peeking',p.skills.mechanics),utilitySkill:this.skill(p,'utilityExecution',p.skills.teamwork),preferredRange,heatAt,uncertaintyAt},this.worldRandom);
          if(selected){
            if(p.probeGoal!==selected.key)p.approachUntil=this.time+2+this.skill(p,'adaptability',p.skills.flexibility);
            goal=selected.point;p.probeGoal=selected.key;
            p.intent=selected.purpose==='control'?'Gather information through Mid':selected.purpose==='flank'?'Create a second approach for the team':p.decision==='probe'?'Probe an angle for information':'Take the least crowded known approach';
          }else{
            goal={x:p.x,z:p.z,level:p.level};p.probeGoal=undefined;p.intent='Reassess the blocked approach';
          }
          const front=allies.filter(a=>a!==p&&a.attacking&&distance(a,primary)+2<distance(p,primary))
            .sort((a,b)=>distance(p,a)-distance(p,b)||a.slot-b.slot)[0];
          if(!p.bomb&&front&&selected?.purpose!=='flank'&&p.decision!=='pressure'&&p.decision!=='improvise'&&['trade','support','caller'].includes(p.role)&&distance(p,front)<16) {
            const dx=front.x-primary.x,dz=front.z-primary.z,length=Math.hypot(dx,dz)||1;
            const spacing=3.5+(p.role==='support'?2:0)+(1-this.skill(p,'trading',p.skills.teamwork))*1.5
              +(1-this.skill(p,'coordination',p.skills.teamwork))*.5;
            goal=this.map.safePoint({x:front.x+dx/length*spacing,z:front.z+dz/length*spacing,level:front.level});
            if(p.profile)p.motor.followSpacing=spacing;
            p.intent='Keep trade spacing behind the teammate taking space';
          }
          if(p.holdingSince && this.time - p.holdingSince > 2.0 && !seen.length && !p.target && !memoryFresh&&this.remaining<20) {
            goal=primary;
            p.intent=p.bomb?'Advance to plant on site':'Push onto site to establish control';
          }
        }
      }
    } else {
      const home=this.defenseHome(p);
      const tactical=this.map.definition.tactical,positions=tactical[home];
      const mates=allies.filter(a=>a!==p&&this.defenseHome(a)===home);
      const defensePerch=this.selectPerchForHold(p,this.map.definition.sites[home],allies,prevPerch);
      const wantsPerch=!!defensePerch&&(prevPerch?.id===defensePerch.id||p.decision==='improvise'||fpsBehaviorPreferences(identity.personality).initiative>.54||(this.round+p.slot)%3===0);
      if(wantsPerch&&defensePerch){
        p.perchGoal=defensePerch;
        goal=this.isOnPerch(p,defensePerch)&&Math.abs(p.jumpY-defensePerch.height)<.12
          ?{...defensePerch.top}
          :defensePerch.approaches.slice().sort((a,b)=>distance(p,a)-distance(p,b))[0];
        p.watchPoint={...this.map.definition.sites[home]};
        p.intent=`Hold elevated cover off-angle (${defensePerch.name}) at ${home}`;
      }else if(p.role==='anchor'&&(this.round+p.slot)%2===0) {
        const anchors=tactical.anchorPoints[home];
        const deepHold=anchors[(this.round+p.slot)%anchors.length]??positions.holds[positions.holds.length-1];
        goal=deepHold;p.intent=`Anchor deep site hold at ${home}`;
      } else {
        const startIdx=(this.round*3+p.slot)%positions.holds.length;
        const rotatedHolds=positions.holds.slice(startIdx).concat(positions.holds.slice(0,startIdx));
        const boardHolds=blackboardClaimedPoints(this.teamBlackboard(p.team),this.time,p.id,['hold_lane']);
        const hold=rotatedHolds.find(h=>mates.every(a=>!a.goal||distance(a.goal,h)>=3.5)&&boardHolds.every(c=>distance(c,h)>=3.5))??rotatedHolds[0];
        goal=hold;
      }
      const order=this.informationOrders[p.team];
      const activeOrder=liveOrderActive(order,this.time);
      if(activeOrder&&order.mode==='probe'&&order.point&&order.responders.includes(p.id)){
        this.acknowledge(p,order);
        const index=order.responders.indexOf(p.id);
        goal=index===0?order.point:this.map.safePoint({x:order.point.x+(home==='A'?-2:2),z:order.point.z+4,level:order.point.level});
        p.intent=index===0?'IGL: probe for information, then fall back':'IGL: cover and trade the information peek';
      }else if(activeOrder&&order.site&&order.responders.includes(p.id)){
        this.acknowledge(p,order);
        const support=tactical[order.site].retakeStaging;
        goal=support[order.responders.indexOf(p.id)%support.length];p.intent=`${order.mode==='rotate'?'Rotate':'Reinforce'} ${order.site}: ${order.reason}`;
      }else if(activeOrder&&order.site&&order.site!==home)p.intent=`Keep ${home} covered; ${order.reason}`;
      else if(activeOrder&&order.mode==='watch')p.intent=`Hold ${home} and check the cue; ${order.reason}`;
      else if(order.mode==='recheck')p.intent='Reports faded — recheck the assigned lane';
      const opening=(!activeOrder||order.mode==='hold'||order.mode==='recheck')&&!seen.length?this.openingDefenseAssignment(p):undefined;
      if(opening){goal=opening.point;p.intent=opening.intent;windowHold=opening.point===tactical.mid.window.hold;}
    }
    if(!seen.length){
      const coordinated=this.executeGoal(p,allies);
      if(coordinated&&!openingLineup){goal=coordinated;p.smokeLineupGoal=undefined;}
    }
    const objectiveUrgent=this.bomb.status==='planted'?(p.attacking?this.bomb.remaining<6:this.bomb.remaining<(defuseAssignment?.seconds??(p.kit?5:10))+4)
      :p.attacking&&(this.remaining<12||!!plantPlan&&this.remaining<plantPlan.seconds+8);
    // After a short recovery, an unengaged carrier advances cautiously instead of
    // refreshing a low-HP retreat forever from old reports.
    const carrierCanAdvance=!!plantPlan&&!seen.length&&this.time-p.damageAt>2&&p.reload<=0&&p.ammo>0;
    const finishBurst=this.time<(p.shotCommitUntil??0)&&p.hp>=35&&p.ammo>0&&p.reload===0;
    const needCover=livingEnemies>0&&!finishBurst&&!objectiveUrgent&&!carrierCanAdvance&&memoryFresh&&p.contact&&(p.reload>0||p.ammo===0||(p.hp<38)||(p.hp<55&&p.decision==='prepare')||(Math.max(seen.length,knownNearby)>1&&this.skill(p,'positioning',p.skills.gameSense)>.45));
    if(needCover && p.decision!=='save') {
      const cover=this.map.findCover(p,p.contact!,allies.filter(a=>a!==p),p.profile?this.skill(p,'positioning',p.skills.gameSense):undefined,beliefs.filter(c=>c.certainty>.35),this.heatSampler(p.team));
      const staysNearPostPlant=!p.attacking||this.bomb.status!=='planted'||!!cover&&distance(cover,this.bomb)<9;
      if(cover&&staysNearPostPlant){goal=cover;p.retreatUntil=this.time+1.4;p.intent=p.ammo===0||p.reload>0?'Break sight before reloading':p.hp<38?'Low HP — fall back behind cover':'Reposition behind cover';if(p.profile){p.motor.coverChoices++;p.motor.coverExposureSum+=beliefs.filter(c=>c.certainty>.35&&this.map.sightline(c,cover)).length;}}
    } else if(!objectiveUrgent && p.retreatUntil>this.time && p.goal)goal=p.goal;
    if(!objectiveUrgent&&(openingLineup||p.attacking&&!executing)&&!seen.length&&!memoryFresh&&p.smokeLineupGoal){
      goal=p.smokeLineupGoal;p.intent=`Setting up a smoke at ${this.map.callout(p.smokeLineupGoal)}`;
    }
    if(!objectiveUrgent&&!p.bomb&&!p.channel&&!seen.length&&!p.utilityPreparation&&!this.duelCommitted(p)&&p.retreatUntil<=this.time){
      const reservedStock=this.droppedUtility.filter(w=>w.reservedFor===p.id&&distance(p,w)<16&&canCarryLiveUtility(p,w.kind)&&(!executing||this.time>=(w.airUntil??0)))
        .sort((a,b)=>distance(p,a)-distance(p,b))[0];
      const looseStock=!memoryFresh&&!executing&&!p.smokeLineupGoal&&p.flash+p.smoke+p.incendiary+p.he<3
        ?this.droppedUtility.filter(w=>!w.reservedFor&&distance(p,w)<(this.liveElapsed<12?10:11)&&canCarryLiveUtility(p,w.kind)&&this.map.sightline(p,w)).sort((a,b)=>distance(p,a)-distance(p,b))[0]
        :undefined;
      const stock=reservedStock??looseStock;
      if(stock&&(this.liveElapsed<12||!!reservedStock||!p.attacking||this.bomb.status!=='planted'||distance(stock,this.bomb)<18)){
        goal=stock;p.intent=reservedStock?'Pick up teammate-staged utility at throw spot':'Collect dropped utility for late-round fights';
      }else if(!memoryFresh&&!p.holsteredPrimary&&!p.smokeLineupGoal){
        const tier=LIVE_WEAPON_TIERS;
        const sideW=p.sidearmLoadout?.weapon;
        const upgrade=this.droppedWeapons.filter(w=>w.ammo+w.reserve>0&&(!w.reservedFor||w.reservedFor===p.id)
          &&!(w.droppedBy===p.id&&this.time-(w.at??0)<2.5)&&distance(p,w)<(w.reservedFor===p.id?12:executing?5.5:9.5)
          &&(tier[w.weapon]>tier[p.weapon]||(LIVE_WEAPONS[p.weapon].category!=='pistol'&&LIVE_WEAPONS[w.weapon].category==='pistol'&&!!sideW&&tier[w.weapon]>tier[sideW]))
          &&this.map.sightline(p,w))
          .sort((a,b)=>(tier[b.weapon]-tier[a.weapon])||distance(p,a)-distance(p,b))[0];
        if(upgrade&&(this.bomb.status!=='planted'||distance(upgrade,this.bomb)<16)){
          goal={x:upgrade.x,z:upgrade.z,level:upgrade.level};
          p.intent=upgrade.reservedFor===p.id?'Catch teammate-dropped weapon':`Scavenge dropped ${LIVE_WEAPONS[upgrade.weapon].name}`;
        }
      }
    }
    p.objectiveUrgent=objectiveUrgent;
    if(objectiveUrgent){p.retreatUntil=0;p.peek=undefined;this.movementLearner(p.team)?.close(p.id);p.clearUntil=0;}
    if(livingEnemies>0 && !objectiveUrgent && !p.smokeLineupId && p.role==='entry' && p.attacking && !p.target && !p.bomb && this.time>=p.nextPeek) {
      const tactical=this.map.definition.tactical;
      const corners=this.map.id==='fontessa'
        ?(this.site==='B'
          ?[{id:'car',point:{x:21,z:-2},label:'Car'},{id:'sandbags',point:{x:21,z:4},label:'Sandbags'},{id:'dark',point:{x:18,z:27},label:'Dark'}]
          :[{id:'balcony',point:{x:-18,z:12},label:'Balcony'},{id:'pit',point:{x:-27,z:16},label:'Pit'},{id:'graveyard',point:{x:-22,z:24},label:'Graveyard'}])
        :[...tactical[this.site].holds,...tactical[this.site].entries].slice(0,4).map((pt,idx)=>({id:`${this.site}-clear-${idx}`,point:pt,label:this.map.callout(pt)}));
      const uncleared=corners.find(c=>!p.cleared.has(c.id)&&distance(p,c.point)<18&&this.map.sightline(p,c.point));
      if(uncleared) {
        p.cleared.add(uncleared.id);p.clearPoint=uncleared.point;p.clearUntil=this.time+0.35;
        p.aimFocus={point:{...uncleared.point},source:'clear',until:p.clearUntil+0.5,from:{x:p.x,z:p.z}};
        p.intent=`Check and clear ${uncleared.label}`;p.action='Clearing an angle';
      }
    }
    if(p.role==='entry' && p.attacking && seen.some(t=>t.blinded>.2)) {
      p.decision='pressure';
      this.syncTradePartner(p,seen.find(t=>t.blinded>.2)??p,"They're blind — swinging wide, trade for me bro!");
    }
    if(p.perchGoal && distance(goal,p.perchGoal.top)>.85 && !p.perchGoal.approaches.some(a=>distance(goal,a)<.6))p.perchGoal=undefined;
    const perchedOnTarget=!!p.perchGoal && distance(goal,p.perchGoal.top)<.85 && this.isOnPerch(p,p.perchGoal);
    if(!perchedOnTarget)goal=this.map.safePoint(goal);
    if(!objectiveUrgent&&!this.stickingFinalDefuse(p,allies)){
      const goalFire=this.activeFireAt(goal,.45);
      if(goalFire)goal=this.escapeFirePoint(p,goalFire,goal);
    }
    if(livingEnemies>0 && !perchedOnTarget && !objectiveUrgent && !p.smokeLineupId && !p.bomb && p.contact && memoryFresh && !this.map.sightline(p,p.contact) && this.time>=p.nextPeek && this.bomb.status!=='planted' && (p.decision==='prepare'||p.decision==='react'||p.decision==='probe')) {
      const out=this.map.findPeek(p,p.contact);p.nextPeek=this.time+5;
      if(out){
        const error=p.profile?(this.executionRandom()*2-1)*(.05+(1-this.skill(p,'peeking',1))*.7):0;
        const dx=out.x-p.x,dz=out.z-p.z,d=Math.hypot(dx,dz)||1;
        if(p.profile)p.motor.peekError=Math.abs(error);
        const preferred:FpsMovementAction=p.role==='entry'&&p.speed>2.4?'ferrari'
          :LIVE_WEAPONS[p.weapon].category==='sniper'?'shoulder':p.role==='trade'?'crouch-swing'
          :this.executionRandom()<.18?'double-pump':this.executionRandom()<.38?'bait':this.executionRandom()<.55?'fake':'shoulder';
        const targetKey=`peek:${this.round}:${Math.round(p.contact.x*2)}:${Math.round(p.contact.z*2)}:${Math.round(this.time*2)}`;
        const style:FpsPeekMovementAction=this.movementLearner(p.team)
          ?.choose(p.id,targetKey,p.team,fpsMovementContext('peek',distance(p,p.contact),p.hp),this.movementRandom,preferred) as FpsPeekMovementAction??preferred;
        p.peek={home:{x:p.x,z:p.z,level:p.level},out:p.profile?this.map.safePoint({x:out.x+dx/d*error,z:out.z+dz/d*error,level:p.level}):out,back:false,until:this.time+3,pause:0,style,pumps:0,prefired:0};
        if(style==='ferrari'||style==='crouch-swing')this.syncTradePartner(p,p.contact,"Trade for me bro, I'm swinging wide!");
      }
    }
    // A known map angle is a world position, not an angle measured from a future goal.
    // Post-plant attackers watch the retake routes rather than turning back to the site centre.
    const tacticalMap=this.map.definition.tactical,sitesMap=this.map.definition.sites;
    const watchedSite=this.bomb.status==='planted'?(this.bomb.site??this.site):p.attacking?this.site:distance(goal,sitesMap.A)<distance(goal,sitesMap.B)?'A':'B';
    const watch=p.attacking
      ?this.bomb.status==='planted'?tacticalMap[watchedSite].postPlant[p.slot%5]:tacticalMap[watchedSite].holds[p.slot%tacticalMap[watchedSite].holds.length]
      :this.bomb.status==='planted'?tacticalMap[watchedSite].postPlant[p.slot%5]:tacticalMap[watchedSite].entries[p.slot%tacticalMap[watchedSite].entries.length];
    if(this.bomb.status!=='planted'&&!(p.attacking&&allies.some(a=>a.bomb&&(a.channel>0||a.equipped==='bomb'))))p.watchPoint={...watch};
    if(windowHold)p.watchPoint={...tacticalMap.mid.window.watch};
    const aimingLineup=this.map.authoredSmokeLineups.find(l=>l.id===p.smokeLineupId);
    if(aimingLineup&&distance(p,aimingLineup.position)<1)p.watchPoint={...aimingLineup.target};
    // Vitality / Spirit AWP doctrine: if current sniper sightline is smoked, pivot off-angle to an open crossfire
    if(livingEnemies>0&&LIVE_WEAPONS[p.weapon].category==='sniper'&&!seen.length&&!objectiveUrgent&&!p.smokeLineupId&&!p.bomb&&p.watchPoint){
      const eyeY=(p.crouch?1.08:1.6)+p.jumpY;
      const smokedLine=p.knownSmokes.some(s=>s.expires>this.time+2&&liveSmokeOccludes(p,p.watchPoint!,eyeY,this.map.terrain.groundHeight(p.watchPoint!)+1.4,s,this.time));
      if(smokedLine){
        const siteKey=watchedSite;
        const vantages=p.attacking?[...tacticalMap[siteKey].postPlant,...tacticalMap[siteKey].holds]:[...tacticalMap[siteKey].holds,...tacticalMap[siteKey].entries];
        const watches=[...tacticalMap[siteKey].entries,...tacticalMap[siteKey].holds];
        let bestPos:FpsPoint|undefined,bestWatch:FpsPoint|undefined;
        for(const v of vantages){
          if(distance(p,v)<1.5)continue;
          const openWatch=watches.find(w=>distance(v,w)>4&&this.map.sightline(v,w,1.6+this.map.terrain.groundHeight(v),1.5+this.map.terrain.groundHeight(w))&&!p.knownSmokes.some(s=>s.expires>this.time+2&&liveSmokeOccludes(v,w,1.6+this.map.terrain.groundHeight(v),1.5+this.map.terrain.groundHeight(w),s,this.time)));
          if(openWatch){bestPos=v;bestWatch=openWatch;break;}
        }
        if(bestPos&&bestWatch){goal=bestPos;p.watchPoint={...bestWatch};p.intent='Reposition AWP around smoke to open crossfire';p.action='Repositioning AWP';}
      }
    }
    if(!p.target&&p.anticipation&&p.anticipation.until>this.time&&p.anticipation.confidence>.3){p.watchPoint={x:p.anticipation.x,z:p.anticipation.z,level:p.anticipation.level};p.intent=p.anticipation.reason;}
    if(p.profile){const pattern=knownFpsPattern(p.patterns,p,this.round);if(pattern&&this.skill(p,'informationReading',0)>.5&&this.map.sightline(p,pattern)&&Math.abs(angle(heading(p,pattern)-heading(p,watch)))<.7){p.watchPoint={x:pattern.x,z:pattern.z};p.intent+=' · prepare for a previously observed hold';}}
    if(utilityIntent)p.intent=utilityIntent;
    this.postDecisionClaim(p,goal,defuseAssignment?.id);
    if(p.perchGoal && distance(goal,p.perchGoal.top)>.85 && !p.perchGoal.approaches.some(a=>distance(goal,a)<.6))p.perchGoal=undefined;
    const cautious=memoryFresh&&p.contact&&(p.reload>0||p.hp<55||p.bomb||p.decision==='prepare'||knownNearby>1);
    const evidence=cautious?liveRouteEvidenceKey(beliefs):'';
    const evidenceChanged=evidence!==p.routeEvidence&&this.time-(p.routeUpdatedAt??-100)>=.8;
    if(p.perchGoal && distance(goal,p.perchGoal.top)<.85 && this.isOnPerch(p,p.perchGoal) && Math.abs(p.jumpY-p.perchGoal.height)<.12){
      this.routeLearner(p.team)?.close(p,this.time);
      p.goal={...p.perchGoal.top};p.path=[];p.stuckFor=0;p.routeEvidence=evidence;p.routeUpdatedAt=this.time;
      return;
    }
    const perchedUnder=this.perchUnder(p);
    const fireThreats=this.fires.filter(f=>f.expires>this.time);
    const learner=this.routeLearner(p.team);
    if(!perchedUnder&&learner&&!fireThreats.length&&this.phase==='live'&&!p.smokeLineupId&&!objectiveUrgent&&!p.target&&!p.channel&&!p.peek
      &&p.clearUntil<=this.time&&p.retreatUntil<=this.time&&distance(p,goal)>4){
      if(p.stuckFor>1.5)learner.close(p,this.time);
      const learned=learner.route({actor:p,goal,remaining:this.bomb.status==='planted'?this.bomb.remaining:this.remaining,
        planted:this.bomb.status==='planted',time:this.time,beliefs,allies:allies.filter(a=>a!==p),
        caution:cautious?this.skill(p,'positioning',p.skills.gameSense):0,evidence},this.learningRandom,this.learningPlansRemaining>0);
      if(learned){
        if(!learned.retained)this.learningPlansRemaining--;
        p.goal={...goal};
        if(!learned.retained||!p.path.length){p.path=learned.choice.path.map(point=>({...point}));p.stuckFor=0;}
        p.routeEvidence=evidence;p.routeUpdatedAt=this.time;
        if(learned.exploring)p.intent+=' · trying another approach';
        return;
      }
    }
    this.routeLearner(p.team)?.close(p,this.time);
    const fireOnPath=fireThreats.length>0&&p.path.some(w=>!!this.activeFireAt(w,.35));
    if(!p.goal || (p.goal.level??'street')!==(goal.level??'street') || distance(p.goal,goal)>1 || (!p.path.length&&distance(p,goal)>.8) || p.stuckFor>1.5 || evidenceChanged || fireOnPath){
      const threats=cautious?beliefs.filter(c=>c.certainty>.35&&c.radius<16):[];
      const baseThreats=threats.length?threats:cautious?[p.contact!]:[];
      const combinedThreats=fireThreats.length?[...baseThreats,...fireThreats]:baseThreats;
      const baseCaution=this.skill(p,'positioning',p.skills.gameSense);
      p.goal=goal;p.path=this.routeGoalPath(p,goal,combinedThreats,fireThreats.length?Math.max(.85,baseCaution):baseCaution);p.stuckFor=0;
      p.routeEvidence=evidence;p.routeUpdatedAt=this.time;
    }
  }
  private isOnPerch(p:FpsPoint,perch:LiveJumpablePerch):boolean {
    return p.x>=perch.minX-LIVE_ACTOR_RADIUS*.85&&p.x<=perch.maxX+LIVE_ACTOR_RADIUS*.85
      &&p.z>=perch.minZ-LIVE_ACTOR_RADIUS*.85&&p.z<=perch.maxZ+LIVE_ACTOR_RADIUS*.85;
  }
  private perchUnder(p:Actor):LiveJumpablePerch|undefined {
    if(p.jump||p.jumpY<=this.map.terrain.groundHeight(p)+.12)return undefined;
    return this.map.jumpablePerches.find(perch=>Math.abs(p.jumpY-perch.height)<.12&&this.isOnPerch(p,perch));
  }
  private postDecisionClaim(p:Actor,goal:FpsPoint,defuserId?:string):void {
    let kind:LiveBlackboardKind=p.attacking?'entry_space':'hold_lane';
    let key=p.probeGoal??`${kind}:${Math.round(goal.x/4)}:${Math.round(goal.z/4)}`;
    let priority=1;
    if(this.bomb.status==='planted'){
      if(!p.attacking){
        const isDefuser=p.id===defuserId;
        kind=isDefuser?'defuse_bomb':'cover_defuser';
        key=isDefuser?'bomb':(p.tacticalChoice?.key??`retake:${Math.round(goal.x/4)}:${Math.round(goal.z/4)}`);
        priority=isDefuser?3:2;
      }else{
        kind='cover_plant';
        key=`post:${p.role}:${Math.round(goal.x/4)}:${Math.round(goal.z/4)}`;
        priority=p.id===this.postPlantPlanterId?3:2;
      }
    }else if(p.attacking){
      kind=p.role==='lurker'?'lurk_cut':p.decision==='probe'?'probe_lane':p.role==='trade'?'trade_follow':'entry_space';
      priority=p.bomb?3:p.role==='entry'?2:1;
    }
    postBlackboardClaim(this.teamBlackboard(p.team),{actorId:p.id,kind,key,point:goal,until:this.time+2.8,priority},this.time,kind==='defuse_bomb');
  }
  private routeGoalPath(p:Actor,goal:FpsPoint,threats:readonly FpsPoint[]=[],caution=0):FpsPoint[] {
    const heat=this.heatSampler(p.team);
    const perched=this.perchUnder(p);
    if(perched){
      const exit=perched.approaches.slice().sort((a,b)=>distance(a,goal)-distance(b,goal))[0];
      if(exit)return [exit,...this.map.findPath(exit,goal,threats,caution,heat)];
    }
    return this.map.findPath(p,goal,threats,caution,heat);
  }
  private selectPerchForHold(p:Actor,watchPoint:FpsPoint,allies:readonly Actor[],preferred?:LiveJumpablePerch):LiveJumpablePerch|undefined {
    const valid=(perch:LiveJumpablePerch)=>distance(perch.top,watchPoint)<16&&!this.activeFireAt(perch.top,.5)
      &&!allies.some(a=>a!==p&&(a.perchGoal?.id===perch.id||distance(a,perch.top)<1.35))
      &&this.map.sightline(perch.top,watchPoint,perch.height+1.55,this.map.terrain.groundHeight(watchPoint)+1.2);
    if(preferred&&valid(preferred))return preferred;
    const candidates=this.map.jumpablePerches.filter(valid);
    if(!candidates.length)return undefined;
    candidates.sort((a,b)=>distance(p,a.top)-distance(p,b.top));
    return candidates[(this.round+p.slot)%candidates.length];
  }
  private heardBombDefuseActive(p:Actor):boolean {
    return p.attacking&&this.bomb.status==='planted'&&this.time-(p.heardDefuseAt??-100)<4.5&&distance(p,this.bomb)<28;
  }
  private canSpamBombSmoke(p:Actor):boolean {
    if(!this.heardBombDefuseActive(p)||p.ammo<=3)return false;
    const cat=LIVE_WEAPONS[p.weapon].category,d=distance(p,this.bomb);
    if(cat==='sniper'||(cat==='shotgun'&&d>9)||d<=3.6)return false;
    const bombSmoked=p.knownSmokes.some(s=>s.expires>this.time&&distance(s,this.bomb)<s.radius+1.5);
    if(!bombSmoked)return false;
    if(p.suppression&&p.suppression.key==='bomb:defuse'&&p.suppression.shots>=4)return false;
    const from={x:p.x,y:(p.crouch?1.08:1.6)+p.jumpY,z:p.z},to={x:this.bomb.x,y:this.map.terrain.groundHeight(this.bomb)+.55,z:this.bomb.z};
    return !this.map.wallIntersections(from,to).some(h=>!h.wall.bulletPenetration);
  }
  /** A remembered position or heard defuse authorizes a short probe, never tracking a body inside a cloud. */
  private tryInformationFire(p:Actor):boolean {
    const heardBombDefuse=this.heardBombDefuseActive(p);
    const fromY=(p.crouch?1.08:1.6)+p.jumpY;
    const bombSmoke=heardBombDefuse
      ?p.knownSmokes.find(s=>s.expires>this.time&&distance(s,this.bomb)<s.radius+1.5&&liveSmokeOccludes(p,this.bomb,fromY,this.map.terrain.groundHeight(this.bomb)+.55,s,this.time))
      :undefined;
    if(p.target||p.bombEscape||(p.objectiveUrgent&&!bombSmoke)||p.utilityPreparation||p.equipped!==p.weapon||p.weaponReady>0||p.reload>0||p.channel>0
      ||p.blinded>=.2||this.shouldTurnFromFlash(p)||this.time<p.nextShot)return false;
    const belief=strongestLiveIntel(p.intel,p,this.time),weapon=LIVE_WEAPONS[p.weapon];
    const validIntel=!!belief&&belief.age<2.25&&belief.certainty>=.4&&belief.radius<=4.5
      &&(belief.source==='sight'||belief.source==='damage'||belief.source==='gunfire'&&belief.age<1.35);
    const isDefuseProbe=!!bombSmoke&&(!validIntel||belief!.source!=='sight'||belief!.age>.75);
    const probeTarget=isDefuseProbe?{x:this.bomb.x,z:this.bomb.z,level:this.bomb.level,key:'bomb:defuse'}:validIntel?belief:undefined;
    if(!probeTarget)return false;
    const d=distance(p,probeTarget),toY=isDefuseProbe?this.map.terrain.groundHeight(this.bomb)+.55:this.map.terrain.groundHeight(probeTarget)+1.25;
    const smoke=isDefuseProbe?bombSmoke:p.knownSmokes.find(s=>s.expires>this.time&&liveSmokeOccludes(p,probeTarget,fromY,toY,s,this.time));
    const peek=!isDefuseProbe&&!!p.peek&&!p.peek.back&&p.peek.prefired<3;
    if(!smoke&&!peek)return false;
    // Preserve enough ammunition for the next real duel. Precision guns do not blindly spend their few rounds.
    if(weapon.category==='sniper'||weapon.category==='shotgun'&&d>10
      ||weapon.category==='smg'&&d>23||weapon.category==='pistol'&&d>18
      ||p.ammo<=Math.max(3,Math.ceil(weapon.magazine*.3)))return false;
    if(p.speed>liveShotSpeedLimit(p.weapon,p.profile?.5:p.skills.mechanics)
      ||!liveAccurateShotReady(p.weapon,p.speed,p.jump,this.time-p.stillSince,p.crouch,d)
      ||Math.abs(angle(heading(p,probeTarget)-p.yaw))>=.1)return false;
    const from={x:p.x,y:fromY,z:p.z},to={x:probeTarget.x,y:toY,z:probeTarget.z};
    if(this.map.wallIntersections(from,to).some(hit=>!hit.wall.bulletPenetration))return false;
    const pitch=Math.atan2(toY-fromY,d||1),direction=liveRayDirection(heading(p,probeTarget),pitch);
    const far={x:from.x+direction.x*65,y:from.y+direction.y*65,z:from.z+direction.z*65};
    const blocking=this.map.wallIntersections(from,far).find(hit=>!hit.wall.bulletPenetration),range=blocking?blocking.t*65:65;
    // The remembered body may have left. A miss still travels past its last position.
    if(this.actors.some(ally=>ally!==p&&ally.team===p.team&&ally.hp>0&&traceLiveActorHit(from,direction,range,ally)))return false;
    let suppression=p.suppression;
    if(smoke){
      // Fresh reports within the same three-second episode cannot reset its ammunition allowance.
      if(!suppression||suppression.key!==probeTarget.key||this.time-suppression.startedAt>=3){
        suppression={smokeId:smoke.id,key:probeTarget.key,startedAt:this.time,shots:0,burstShots:0,nextBurstAt:this.time};
        p.suppression=suppression;
      }
      const budget=weapon.category==='heavy'?9:weapon.category==='pistol'||weapon.category==='shotgun'?2:6;
      if(suppression.shots>=budget||this.time<suppression.nextBurstAt)return false;
    }
    p.pitch+=(pitch-p.pitch)*(1-Math.exp(-12*LIVE_FPS_STEP));
    if(Math.abs(p.pitch-pitch)>.045)return false;
    const ghost={id:`known:${p.id}`,team:other(p.team),x:probeTarget.x,z:probeTarget.z,level:probeTarget.level,
      yaw:0,hp:100,blinded:0,lastShot:-100,channel:0,crouch:isDefuseProbe,jumpY:this.map.terrain.groundHeight(probeTarget),speed:0} as Actor;
    const before=p.ammo;
    this.fire(p,ghost);
    if(p.ammo===before)return false;
    if(smoke&&suppression){
      suppression.shots++;suppression.burstShots++;
      const burst=weapon.category==='heavy'?3:2;
      if(suppression.burstShots>=burst){suppression.burstShots=0;suppression.nextBurstAt=this.time+.65;p.nextShot=Math.max(p.nextShot,suppression.nextBurstAt);}
    }
    if(peek)p.peek!.prefired++;
    p.action=isDefuseProbe?'Spamming bomb defuse smoke':smoke?'Controlled smoke spam':p.peek!.prefired>1?'Pre-fire spray':'Pre-firing the reported angle';
    return true;
  }
  private equip(p:Actor,weapon:LiveEquippedWeapon) {
    if(p.equipped===weapon)return;
    this.cancelReload(p);
    p.equipped=weapon;p.weaponReady=liveDrawTime(weapon);p.equipUntil=this.time+1;
    p.reload=0;p.reloadDuration=0;p.reloadSilent=false;p.reloadRounds=0;p.swingAt=undefined;p.burst=0;p.glockBurstRemaining=0;p.shotCommitUntil=0;
  }
  private drawSidearm(p:Actor):void {
    if(p.holsteredPrimary||LIVE_WEAPONS[p.weapon].category==='pistol')return;
    const weapon=p.attacking?'glock':'usp_s';
    const sidearm=p.sidearmLoadout??{weapon,ammo:LIVE_WEAPONS[weapon].magazine,reserve:LIVE_WEAPONS[weapon].reserve};
    if(sidearm.ammo<=0)return;
    this.cancelReload(p);
    p.sidearmUntil=this.time+2;
    p.holsteredPrimary={weapon:p.weapon,ammo:p.ammo,reserve:p.reserve,nextShot:p.nextShot};
    p.weapon=sidearm.weapon;p.ammo=sidearm.ammo;p.reserve=sidearm.reserve;
    p.nextShot=Math.max(this.time,sidearm.nextShot??this.time);
    p.scopeState='hip';p.scopeLevel=0;p.scopeUntil=0;
    this.equip(p,p.weapon);
  }
  private restorePrimary(p:Actor):void {
    if(!p.holsteredPrimary)return;
    this.cancelReload(p);
    p.sidearmLoadout={weapon:p.weapon,ammo:p.ammo,reserve:p.reserve,nextShot:p.nextShot};
    const primary=p.holsteredPrimary;p.holsteredPrimary=undefined;
    p.weapon=primary.weapon;p.ammo=primary.ammo;p.reserve=primary.reserve;
    p.nextShot=Math.max(this.time,primary.nextShot??this.time);
    p.scopeState='hip';p.scopeLevel=0;p.scopeUntil=0;
    this.equip(p,p.weapon);
  }
  private chooseEquipment(p:Actor,target?:Actor) {
    if(p.utilityPreparation||p.throwAt!==undefined&&this.time<p.equipUntil)return;
    if(p.equipped==='bomb'&&p.bomb&&(p.channel>0||!target||this.time-p.damageAt>.5&&distance(p,target)>10))return;
    if(p.profile&&target&&this.time-p.acquired<p.reaction)return;
    const threat=target&&this.visible(p,target,false);
    const heardDefuse=this.heardBombDefuseActive(p);
    if(threat){
      const d=distance(p,target),category=LIVE_WEAPONS[p.weapon].category;
      if(p.equipped==='knife'&&heardDefuse&&distance(p,this.bomb)<=2.6&&d<2.25&&(p.ammo===0||category==='sniper'||this.time<p.nextShot||this.bomb.remaining<6.5))return;
      const upgradedSidearm=p.sidearmLoadout&&p.sidearmLoadout.weapon!=='glock'&&p.sidearmLoadout.weapon!=='usp_s'&&p.sidearmLoadout.weapon!=='pistol';
      const cycleFallback=category==='sniper'&&p.nextShot-this.time>liveDrawTime(p.sidearmLoadout?.weapon??(p.attacking?'glock':'usp_s'))+.15&&d<8;
      const rangeFallback=category==='shotgun'&&d>(upgradedSidearm?13:17);
      if(!p.holsteredPrimary&&category!=='pistol'&&(p.sidearmLoadout?.ammo??1)>0
        &&(p.ammo===0||category==='sniper'&&d<(upgradedSidearm?5.5:4.5)||cycleFallback||rangeFallback)){
        if(p.ammo===0)this.radio(p,'Out of ammo — switching to pistol!');
        this.drawSidearm(p);return;
      }
      const primary=p.holsteredPrimary;
      const primaryReady=primary&&primary.ammo>0&&this.time>=(primary.nextShot??0);
      const primaryPreferred=primaryReady&&(LIVE_WEAPONS[primary.weapon].category==='sniper'?d>10:LIVE_WEAPONS[primary.weapon].category==='shotgun'?d<10:true);
      if(primaryReady&&p.weaponReady===0&&(p.ammo===0||primaryPreferred&&this.time>=(p.sidearmUntil??0)&&this.time-p.lastShot>.55)){
        this.restorePrimary(p);return;
      }
      if(p.ammo+p.reserve===0&&(!primary||primary.ammo+primary.reserve===0)&&d<2.2){this.equip(p,'knife');return;}
      this.equip(p,p.weapon);return;
    }
    if(p.holsteredPrimary&&p.reload===0&&this.time>=Math.max(p.equipUntil,p.sidearmUntil??0)&&this.time-p.seenAt>1.25&&this.time-p.damageAt>1.25)this.restorePrimary(p);
    const livingEnemies=this.knownEnemyCount(p.team);
    if(p.reload>0||p.channel>0||p.peek||p.clearUntil>this.time){this.equip(p,p.weapon);return;}
    if(heardDefuse){
      const dBomb=distance(p,this.bomb),bombSmoked=p.knownSmokes.some(s=>s.expires>this.time&&distance(s,this.bomb)<s.radius+1.5);
      if(this.canSpamBombSmoke(p)){this.equip(p,p.weapon);return;}
      if(bombSmoked&&dBomb<=12&&(dBomb<=3.2||dBomb>2.6||p.ammo===0||LIVE_WEAPONS[p.weapon].category==='sniper')){
        if((this.time>=p.equipUntil&&p.weaponReady===0)||p.equipped==='knife'){this.equip(p,'knife');return;}
      }
    }
    if(livingEnemies>0&&this.time-p.contactAt<7){this.equip(p,p.weapon);return;}
    if(this.time<p.equipUntil||p.weaponReady>0)return;
    if(livingEnemies===0&&p.goal&&distance(p,p.goal)>3.2){this.equip(p,'knife');return;}
    const leg=p.path[0],finalTarget=p.path[p.path.length-1];
    const longLeg=(!!leg&&distance(p,leg)>10)||(!!finalTarget&&distance(p,finalTarget)>14);
    const midZ=(this.map.definition.spawns.attackers.z+this.map.definition.spawns.defenders.z)*.5;
    const safeOpeningKnife=this.liveElapsed<6.5&&(p.attacking?p.z<midZ-10:p.z>midZ+12)&&!p.smokeLineupId&&longLeg;
    const awayFromSite=Math.min(distance(p,this.map.definition.sites.A),distance(p,this.map.definition.sites.B))>22;
    const order=this.informationOrders[p.team];
    const unknownAngle=liveIntelBeliefs(p.intel,this.time).some(c=>c.certainty>.25&&c.age<6&&distance(p,c)<26);
    const travel=longLeg&&awayFromSite&&!unknownAngle&&this.bomb.status!=='planted'&&this.time-p.damageAt>6&&this.time-p.lastShot>5
      &&(safeOpeningKnife||(order.mode!=='execute'&&p.decision!=='prepare'&&p.role!=='lurker'));
    this.equip(p,travel?'knife':p.weapon);
  }
  private forwardClearance(p:Actor,maxDist=12):number {
    const eyeY=(p.crouch?1.08:1.6)+(p.jumpY??0);
    const from={x:p.x,y:eyeY,z:p.z},to={x:p.x+Math.sin(p.yaw)*maxDist,y:eyeY,z:p.z+Math.cos(p.yaw)*maxDist};
    const hits=this.map.wallIntersections(from,to);
    return hits.length?hits[0].t*maxDist:maxDist;
  }
  /** Scope transitions are mechanical, independent of reaction skill or magnification spam. */
  private updateAiming(p:Actor,target?:Actor):void {
    const sniper=LIVE_WEAPONS[p.weapon].category==='sniper',d=target?distance(p,p.aimPoint??target):distance(p,p.watchPoint??p);
    if((p.scopeState==='raising'||p.scopeState==='lowering'||p.scopeState==='cycling')&&this.time>=(p.scopeUntil??0)){
      p.scopeState=p.scopeState==='raising'?'scoped':'hip';p.scopeLevel=p.scopeState==='scoped'?Math.max(1,p.scopeLevel??1):0;
    }
    const weaponUp=p.equipped===p.weapon&&p.weaponReady===0&&!p.reload&&!p.utilityPreparation&&p.channel===0;
    const hasVisibleTarget=!!target&&this.visible(p,target,false);
    const viewTarget=target?(p.aimPoint??target):p.watchPoint;
    const eyeY=(p.crouch?1.08:1.6)+(p.jumpY??0);
    const clearance=this.forwardClearance(p,12);
    const blockedByWall=clearance<(hasVisibleTarget?1.8:5.5);
    const smokedOut=!hasVisibleTarget&&!!viewTarget&&this.smokes.some(s=>s.expires>this.time&&liveSmokeOccludes(p,viewTarget,eyeY,this.map.terrain.groundHeight(viewTarget)+1.3,s,this.time));
    const aimObstructed=!hasVisibleTarget&&(!viewTarget||!this.map.sightline(p,viewTarget,eyeY,this.map.terrain.groundHeight(viewTarget)+1.3));
    const wantScope=sniper&&weaponUp&&!p.jump&&p.speed<1.1&&d>7&&!blockedByWall&&!smokedOut&&!aimObstructed&&(hasVisibleTarget||p.stance==='hold'||p.crouch);
    if(wantScope&&p.scopeState==='hip'&&this.time>=(p.scopeHoldUntil??0)){
      p.scopeState='raising';p.scopeLevel=1;p.scopeUntil=this.time+.38;p.scopeHoldUntil=this.time+1.05;
    }else if(!wantScope&&(p.scopeState==='scoped'||p.scopeState==='raising')&&(!weaponUp||blockedByWall||smokedOut||aimObstructed||this.time>=(p.scopeHoldUntil??0))){
      p.scopeState='lowering';p.scopeUntil=this.time+.24;p.scopeHoldUntil=this.time+.55;
    }else if(p.scopeState==='scoped'&&this.time>=(p.scopeHoldUntil??0)){
      const level=d>32?2:1;if(level!==p.scopeLevel){p.scopeLevel=level;p.scopeState='raising';p.scopeUntil=this.time+.22;p.scopeHoldUntil=this.time+.85;}
    }
  }
  private strikeKnife(p:Actor) {
    const ray={x:Math.sin(p.yaw),z:Math.cos(p.yaw)};
    let closest:number=LIVE_KNIFE.reach,victim:Actor|undefined;
    for(const actor of this.actors.filter(a=>a!==p&&a.hp>0)) {
      const dx=actor.x-p.x,dz=actor.z-p.z,along=dx*ray.x+dz*ray.z,side=dx*dx+dz*dz-along*along;
      if(along<0||side>LIVE_ACTOR_RADIUS**2||!this.map.sightline(p,actor))continue;
      const hit=Math.max(0,along-Math.sqrt(Math.max(0,LIVE_ACTOR_RADIUS**2-side)));
      if(hit<closest){closest=hit;victim=actor;}
    }
    // The nearest body blocks the blade, including a teammate. Resolve at impact, not windup.
    if(victim&&victim.team!==p.team){
      const behind=Math.cos(angle(heading(p,victim)-victim.yaw))>.65;
      this.damage(p,victim,behind?LIVE_KNIFE.backDamage:LIVE_KNIFE.damage,false,'knife',false);
    }
    this.hear(p,5);
  }
  private turn(p:Actor,yaw:number) {
    if(p.target){
      const rawOvershoot=p.flickOvershoot??0;
      const useOvershoot=Math.abs(rawOvershoot)>.002&&this.time-p.acquired<.75?rawOvershoot:0;
      if(p.profile){
        const before=Math.abs(angle(yaw-p.yaw)),phase=before>.18&&this.time-p.acquired<1?'flick':before>.07?'track':'fine';
        const bias=phase==='flick'||(phase==='track'&&useOvershoot)?useOvershoot:0;
        p.yaw=detailedAimYaw(p.yaw,yaw,p.profile,phase,LIVE_FPS_STEP,LIVE_WEAPONS[p.weapon].category==='sniper',bias);
        if(phase==='flick')p.motor.flickAngleRemoved+=before-Math.abs(angle(yaw-p.yaw));
        if(phase==='fine')p.motor.fineAngleRemoved+=before-Math.abs(angle(yaw-p.yaw));
      }else{
        const targetYaw=useOvershoot&&Math.abs(angle(yaw-p.yaw))>.08?angle(yaw+useOvershoot):yaw;
        p.yaw=advanceLiveAimYaw(p.yaw,targetYaw,p.skills.mechanics,LIVE_FPS_STEP);
      }
      if(rawOvershoot){
        if(Math.sign(angle(p.yaw-yaw))===Math.sign(rawOvershoot))p.flickOvershoot=rawOvershoot*.35;
        else p.flickOvershoot=rawOvershoot*Math.exp(-5.5*LIVE_FPS_STEP);
        if(Math.abs(p.flickOvershoot)<.002)p.flickOvershoot=0;
      }
      return;
    }
    p.flickOvershoot=0;
    p.yaw=advanceLiveAimYaw(p.yaw,yaw,p.profile?.7:p.skills.mechanics,LIVE_FPS_STEP);
  }
  private preAim(p:Actor,holding:boolean) {
    if(this.shouldTurnFromFlash(p)){this.turn(p,this.flashSafeYaw(p));p.aimFocus=undefined;return;}
    const ahead=liveRouteLookAhead(p,p.path,12),watch=p.watchPoint;
    const routeYaw=ahead?heading(p,ahead):p.yaw;
    const anticipation=p.anticipation&&p.anticipation.until>this.time&&p.anticipation.confidence>.4&&Math.abs(angle(heading(p,p.anticipation)-p.yaw))<.75?p.anticipation:undefined;
    const contact=anticipation??(p.contact&&this.time-p.contactAt<4&&distance(p,p.contact)<24
      &&(holding||distance(p,p.contact)<8||Math.abs(angle(heading(p,p.contact)-routeYaw))<Math.PI*.6)?p.contact:undefined);
    let point:FpsPoint|undefined,source:'contact'|'route'|'hold';
    if(contact){point=contact;source='contact';}
    else if(holding){
      const eyeY=(p.crouch?1.08:1.6)+(p.jumpY??0);
      if(watch && distance(p,watch)>1.5 && this.map.sightline(p,watch,eyeY,this.map.terrain.groundHeight(watch)+1.58)) {
        point=watch;
      } else {
        const tactical=this.map.definition.tactical,sites=this.map.definition.sites;
        const clearAngles=[...tactical.A.entries,...tactical.B.entries,...tactical.chokes.map(c=>c.center),sites.A,sites.B]
          .filter(pt=>distance(p,pt)>2&&distance(p,pt)<35&&this.map.sightline(p,pt,eyeY,this.map.terrain.groundHeight(pt)+1.58));
        point=clearAngles.sort((a,b)=>distance(p,a)-distance(p,b))[0];
        if(!point){
          let bestDist=-1;
          for(let k=0;k<8;k++){
            const a=p.yaw+k*Math.PI/4;
            const probe={x:p.x+Math.sin(a)*10,z:p.z+Math.cos(a)*10};
            const hits=this.map.wallIntersections({x:p.x,y:eyeY,z:p.z},{x:probe.x,y:eyeY,z:probe.z});
            const clearD=hits.length?hits[0].t*10:10;
            if(clearD>bestDist){bestDist=clearD;point=probe;}
          }
        }
      }
      source='hold';
    }
    else {
      // Pre-aim known frontal holds when exposed; otherwise look down the next route section.
      point=watch&&distance(p,watch)>1.5&&distance(p,watch)<25&&this.map.sightline(p,watch)
        &&Math.abs(angle(heading(p,watch)-routeYaw))<.65?watch:ahead;
      source='route';
    }
    if(!point||distance(p,point)<.5)return;
    const focus=p.aimFocus;
    const passed=focus&&(!holding&&distance(p,focus.point)<1.5||distance(p,focus.from)>3);
    const changed=focus&&distance(focus.point,point)>1.5;
    // Nearby/new contact interrupts a map hold, but changing reports cannot whip the aim every tick.
    if(!focus||passed||(source==='contact'&&focus.source!=='contact')
      ||(this.time>=focus.until&&(focus.source!==source||changed))){
      p.aimFocus={point:{...point},eyeY:this.map.terrain.groundHeight(point)+1.58,source,until:this.time+(source==='contact'?.65:.9),from:{x:p.x,z:p.z}};
      if(p.profile){p.preparedError=preparedAngleError(p.profile,this.executionRandom,LIVE_WEAPONS[p.weapon].category==='sniper');p.motor.preAimError=Math.abs(p.preparedError);}
      if(p.preparedPitch===undefined||source==='contact')p.preparedPitch=(this.executionRandom()*2-1)*(.003+(1-this.skill(p,'crosshairPlacement',p.skills.mechanics))*.045);
    }
    this.turn(p,heading(p,p.aimFocus!.point)+(p.profile?p.preparedError:0));
    const crosshair=this.skill(p,'crosshairPlacement',p.skills.mechanics),at=p.aimFocus!.point;
    const d=distance(p,at),eye=(p.crouch?1.08:1.6)+p.jumpY;
    const focusY=p.aimFocus!.eyeY??this.map.terrain.groundHeight(at)+1.58;
    // Tiny stair/route endpoints are movement targets, not points under the muzzle.
    const vertical=p.aimFocus!.source==='route'&&d<8?0:Math.atan2(focusY-eye,Math.max(8,d));
    const limit=p.aimFocus!.source==='route'?.12:.42;
    const prePitch=Math.max(-limit,Math.min(limit,vertical))+(p.preparedPitch??0);
    const correction=(prePitch-p.pitch)*(1-Math.exp(-(3+crosshair*10)*LIVE_FPS_STEP));
    p.pitch+=Math.max(-.7*LIVE_FPS_STEP,Math.min(.7*LIVE_FPS_STEP,correction));
  }
  private trafficMotion(p:Actor,requested:FpsPoint,fallback:FpsPoint,nearby:Actor[]):FpsPoint {
    const length=Math.hypot(requested.x,requested.z);
    if(length<.1||p.target||p.channel||p.jump||p.utilityPreparation){p.trafficYield=undefined;return fallback;}
    if(p.trafficYield&&this.time>=p.trafficYield.until)p.trafficYield=undefined;
    if(!p.trafficYield){
      const forward={x:requested.x/length,z:requested.z/length};
      const blocker=nearby.filter(a=>a.team===p.team&&distance(p,a)<1.5).find(a=>{
        const toward=(a.x-p.x)*forward.x+(a.z-p.z)*forward.z;
        if(toward<=0||distance({x:p.x+forward.x*.12,z:p.z+forward.z*.12},a)>=distance(p,a)-.01)return false;
        const next=a.path[0],dx=next?next.x-a.x:0,dz=next?next.z-a.z:0,n=Math.hypot(dx,dz);
        const sameDirection=n>.01&&(dx*forward.x+dz*forward.z)/n>.65;
        return !sameDirection&&(!next||p.id.localeCompare(a.id)>0);
      });
      if(blocker){
        const next=blocker.path[0],dx=next?next.x-blocker.x:forward.x,dz=next?next.z-blocker.z:forward.z,n=Math.hypot(dx,dz)||1;
        const lateral={x:-dz/n,z:dx/n},side=(p.x-blocker.x)*lateral.x+(p.z-blocker.z)*lateral.z>=0?1:-1;
        const away=distance(p,blocker)||1;
        const offsets=[
          {x:lateral.x*side*1.3,z:lateral.z*side*1.3},
          {x:-lateral.x*side*1.3,z:-lateral.z*side*1.3},
          {x:lateral.x*side-forward.x*.7,z:lateral.z*side-forward.z*.7},
          {x:(p.x-blocker.x)/away*1.4,z:(p.z-blocker.z)/away*1.4},
          {x:-forward.x*1.4,z:-forward.z*1.4},
          {x:-forward.x*2.6,z:-forward.z*2.6},
        ];
        const choices=offsets.map(offset=>({x:p.x+offset.x,z:p.z+offset.z,level:p.level})).filter(point=>
          this.map.movementSegmentClear(p,point)&&nearby.filter(a=>a.team===p.team).every(a=>{
            const dx=point.x-p.x,dz=point.z-p.z,den=dx*dx+dz*dz;
            const t=Math.max(0,Math.min(1,((a.x-p.x)*dx+(a.z-p.z)*dz)/(den||1)));
            return distance(point,a)>.98&&distance({x:p.x+dx*t,z:p.z+dz*t},a)>=Math.min(.92,distance(p,a)-.005);
          }));
        const score=(point:FpsPoint)=>Math.abs((point.x-blocker.x)*lateral.x+(point.z-blocker.z)*lateral.z)*2
          +distance(point,blocker)*.3-distance(p,point)*.7;
        choices.sort((a,b)=>score(b)-score(a));
        if(choices[0])p.trafficYield={point:choices[0],until:this.time+1.35};
      }
    }
    if(!p.trafficYield)return fallback;
    const d=distance(p,p.trafficYield.point);
    if(d<.12)return {x:0,z:0};
    const speed=Math.min(LIVE_WALK_SPEED,d/LIVE_FPS_STEP);
    return {x:(p.trafficYield.point.x-p.x)/d*speed,z:(p.trafficYield.point.z-p.z)/d*speed};
  }
  private applyMotion(p:Actor,wish:FpsPoint,dt:number,stance:LiveStance) {

    if(p.profile){
      if(Math.hypot(wish.x,wish.z)<.1&&p.speed>.03){
        if(p.brakeAt===undefined){const delay=(1-this.skill(p,'movementControl',0))*.1;p.brakeAt=this.time+delay;p.motor.brakeDelay=delay;}
        if(this.time<p.brakeAt)wish={x:p.vx,z:p.vz};
      }else if(Math.hypot(wish.x,wish.z)>.1)p.brakeAt=undefined;
    }
    const occupied=(point:FpsPoint)=>this.actors.some(a=>a!==p&&a.hp>0&&Math.abs(a.jumpY-p.jumpY)<.85&&distance(point,a)<0.92&&distance(point,a)<distance(p,a));
    const nearby=this.actors.filter(a=>a!==p&&a.hp>0&&Math.abs(a.jumpY-p.jumpY)<.85&&distance(p,a)<2.5);
    let allyMovingAhead=false;
    const wishLen=Math.hypot(wish.x,wish.z);
    const requested={...wish};
    if(nearby.length>0 && wishLen>.01) {
      let sepX=0,sepZ=0;
      let blockedAhead=false;
      const wNormX=wish.x/wishLen,wNormZ=wish.z/wishLen;
      const perpX=-wNormZ,perpZ=wNormX;
      for(const a of nearby) {
        const d=distance(p,a);
        if(d>0.01 && d<1.3) {
          const push=Math.max(0,(1.3-d)/1.3)*2.0;
          sepX+=((p.x-a.x)/d)*push;
          sepZ+=((p.z-a.z)/d)*push;
        }
        const dot=(a.x-p.x)*wNormX+(a.z-p.z)*wNormZ;
        if(dot>0 && dot<2.4) {
          const latDist=Math.abs((a.x-p.x)*perpX+(a.z-p.z)*perpZ);
          if(latDist<0.85) {
            if(a.speed>0.25) allyMovingAhead=true;
            if(dot<1.45) {
              blockedAhead=true;
              const side=((p.x-a.x)*perpX+(p.z-a.z)*perpZ)>=0?1:-1;
              sepX+=perpX*side*1.2;
              sepZ+=perpZ*side*1.2;
            }
          }
        }
      }
      if(blockedAhead) {
        const queueSpeed=Math.min(wishLen*0.2,LIVE_WALK_SPEED*0.35);
        wish={
          x:wNormX*queueSpeed+sepX*0.6,
          z:wNormZ*queueSpeed+sepZ*0.6,
        };
      } else if(sepX!==0 || sepZ!==0) {
        wish={
          x:wish.x+sepX*0.4,
          z:wish.z+sepZ*0.4,
        };
      }
    }
    wish=this.trafficMotion(p,requested,wish,nearby);
    if(p.scopeState==='scoped'){const n=Math.hypot(wish.x,wish.z);if(n>1.1)wish={x:wish.x/n*1.1,z:wish.z/n*1.1};}
    const velocity=advanceLiveVelocity(p,wish,dt,p.profile?.5:p.skills.mechanics,p.jump);
    let moved:FpsPoint={...moveFpsActor(p,{x:velocity.vx*dt,z:velocity.vz*dt},LIVE_ACTOR_RADIUS,this.map.actorSolids(p,p.jumpY,p.crouch?1.3:1.72)),level:p.level};
    // Step off a deck or upper platform cleanly without snapping through overhanging ceilings.
    if(p.level==='upper'&&!this.map.terrain.levelAllowed(moved)){
      const canalPt={...moved,level:'canal' as const},streetPt={...moved,level:undefined};
      moved.level=this.map.terrain.levelAllowed(canalPt)&&this.map.terrain.groundHeight(canalPt)>=this.map.terrain.groundHeight(streetPt)?'canal':undefined;
    }else if(p.level!=='canal'&&p.level!=='upper'&&this.map.terrain.canalArea(moved)&&!this.map.terrain.levelAllowed(moved)&&p.jumpY>=this.map.terrain.groundHeight({...moved,level:'canal'})){
      moved.level='canal';
    }
    const fallingToBank=p.level!==moved.level&&((moved.level==='canal'&&this.map.terrain.canalArea(moved))||p.level==='upper')&&this.map.terrain.groundHeight(moved)<p.jumpY-LIVE_STEP_HEIGHT;
    if(!fallingToBank&&!this.map.terrain.terrainPathClear(p,moved,p.jumpY)){
      const slideX={x:moved.x,z:p.z,level:p.level},slideZ={x:p.x,z:moved.z,level:p.level};
      moved=this.map.terrain.terrainPathClear(p,slideX,p.jumpY)?slideX
        :this.map.terrain.terrainPathClear(p,slideZ,p.jumpY)?slideZ:{x:p.x,z:p.z,level:p.level};
    }
    if(occupied(moved))moved={x:p.x,z:p.z,level:p.level};
    const bounds=this.map.definition.bounds;
    moved.x=Math.max(bounds.clampMinX,Math.min(bounds.clampMaxX,moved.x));
    moved.z=Math.max(bounds.clampMinZ,Math.min(bounds.clampMaxZ,moved.z));
    p.vx=(moved.x-p.x)/dt;p.vz=(moved.z-p.z)/dt;p.speed=Math.hypot(p.vx,p.vz);
    if(p.speed>.12||p.jump||p.crouch!==p.wasCrouched)p.stillSince=this.time;
    p.wasCrouched=p.crouch;
    if(p.speed>.03 || allyMovingAhead){p.lastMoved=this.time;p.stuckFor=0;}else if(Math.hypot(wish.x,wish.z)>.1)p.stuckFor+=dt;
    const oldGround=p.jumpY,ground=this.map.supportHeight(moved,p.jumpY);
    if(!p.jump){
      if(oldGround-ground>LIVE_STEP_HEIGHT){p.jump=true;p.jumpVy=0;}
      else p.jumpY=ground;
    }
    p.groundY=ground;
    p.x=moved.x;p.z=moved.z;p.level=moved.level;p.stance=Math.hypot(wish.x,wish.z)<.1?(p.speed>.12?'brake':p.crouch?'crouch':'hold'):stance;
    if(p.bomb&&this.bomb.status==='carried'){this.bomb.x=p.x;this.bomb.z=p.z;this.bomb.level=p.level;}
    if(p.speed>2.5&&this.time>=p.nextFootstep){p.nextFootstep=this.time+.44;this.hear(p,17);}
    if(p.speed>.65&&this.time>=p.nextAudioFootstep){
      const stance=p.crouch?'crouch':p.speed>2.5?'run':'walk';
      this.audioCues.push({kind:'footstep',stance,x:p.x,y:p.jumpY,level:p.level,surface:this.map.surfaceAt(p,p.jumpY),z:p.z});
      p.nextAudioFootstep=this.time+(stance==='crouch'?.72:stance==='run'?.34:.52);
    }
  }
  private move(p:Actor,dt:number,keepAim=false) {
    const urgent=p.objectiveUrgent||(this.bomb.status==='planted'?this.bomb.remaining<12:this.remaining<18);
    if(this.phase==='live' && this.time<this.roundLiveAt+(p.freezeDelay??0)){
      this.applyMotion(p,{x:0,z:0},dt,'hold');p.action='Readying departure';return;
    }
    const order=this.informationOrders[p.team];
    if(p.profile&&p.attacking&&order.mode==='rotate'&&this.time<order.until&&this.time<(order.readyAt??0)){
      this.applyMotion(p,{x:0,z:0},dt,'hold');if(!keepAim)this.preAim(p,true);p.action='Acknowledging the new call';return;
    }
    const flash=p.flashWindow;
    if(flash&&this.time>flash.expires)p.flashWindow=undefined;
    if(flash&&this.time<flash.opens&&flash.opens-this.time<.55&&!keepAim&&!p.target&&p.channel===0){
      this.applyMotion(p,{x:0,z:0},dt,'brake');if(this.shouldTurnFromFlash(p))this.turn(p,this.flashSafeYaw(p));else this.preAim(p,true);p.action='Waiting for friendly flash';return;
    }
    if(p.peek&&p.peek.until<this.time){p.peek=undefined;this.movementLearner(p.team)?.close(p.id);}
    if(p.vaultDrop){
      const drop=p.vaultDrop,dx=drop.target.x-p.x,dz=drop.target.z-p.z,rem=Math.hypot(dx,dz);
      if(this.time>=drop.until||rem<.45||(!p.jump&&p.jumpY<=drop.landingY+.3&&this.time>drop.startedAt+.2)){
        if(drop.target.level&&rem<1.2)p.level=drop.target.level;
        p.vaultDrop=undefined;
        p.crouch=this.map.actorSolids(p,p.jumpY,1.72).some(w=>segmentHitsWall(p,p,w,LIVE_ACTOR_RADIUS));
      }else{
        const vSpeed=Math.min(LIVE_RUN_SPEED*1.15,rem/dt);
        const nx=rem>1e-4?dx/rem:0,nz=rem>1e-4?dz/rem:0;
        const stepDelta={x:nx*vSpeed*dt,z:nz*vSpeed*dt};
        const probe={x:p.x+stepDelta.x,z:p.z+stepDelta.z,level:p.level};
        for(const w of this.map.collisionSolids){
          if(w.height>p.jumpY&&w.height<=drop.clearanceY&&(w.baseY??0)<p.jumpY+1.3&&segmentHitsWall(p,probe,w,LIVE_ACTOR_RADIUS)){
            p.jumpY=Math.max(p.jumpY,w.height+.02);
          }
        }
        const resolved=moveFpsActor(p,stepDelta,LIVE_ACTOR_RADIUS,this.map.actorSolids(p,p.jumpY,1.3));
        const bounds=this.map.definition.bounds;
        p.x=Math.max(bounds.clampMinX,Math.min(bounds.clampMaxX,resolved.x));
        p.z=Math.max(bounds.clampMinZ,Math.min(bounds.clampMaxZ,resolved.z));
        if(drop.target.level&&Math.hypot(drop.target.x-p.x,drop.target.z-p.z)<1.2)p.level=drop.target.level;
        p.vx=(p.x-probe.x+stepDelta.x)/dt;p.vz=(p.z-probe.z+stepDelta.z)/dt;p.speed=Math.hypot(p.vx,p.vz);p.crouch=true;
        p.groundY=Math.max(drop.landingY,this.map.supportHeight(p,p.jumpY));p.stance='jump';p.action='Vaulting down';p.lastMoved=this.time;p.stuckFor=0;
        if(p.bomb&&this.bomb.status==='carried'){this.bomb.x=p.x;this.bomb.z=p.z;this.bomb.level=p.level;}
        if(!keepAim)this.turn(p,heading(p,drop.target));
        return;
      }
    }
    if(p.channel===0&&!this.stickingFinalDefuse(p)){
      const activeFire=this.activeFireAt(p,.5,p.jumpY);
      if(activeFire){
        p.crouch=false;p.peek=undefined;p.clearUntil=0;
        const esc=this.escapeFirePoint(p,activeFire,p.goal);
        const dEsc=distance(p,esc)||1;
        const runSpd=p.equipped==='knife'?LIVE_KNIFE.runSpeed:LIVE_RUN_SPEED;
        this.applyMotion(p,{x:(esc.x-p.x)/dEsc*runSpd,z:(esc.z-p.z)/dEsc*runSpd},dt,'run');
        if(!keepAim)this.turn(p,heading(p,esc));
        p.action='Escaping molotov fire';
        return;
      }
    }
    if(p.peek&&(!keepAim||p.peek.back)) {
      const target=p.peek.back?p.peek.home:p.peek.out,d=distance(p,target);
      if(d<.22){
        if(p.peek.back){
          if(p.peek.pumps===0&&(p.peek.style==='double-pump'||p.peek.style==='fake'||p.peek.style==='bait')){p.peek.pumps=1;p.peek.back=false;p.peek.pause=0;p.peek.prefired=0;}
          else {p.peek=undefined;p.crouch=false;this.movementLearner(p.team)?.close(p.id);this.applyMotion(p,{x:0,z:0},dt,'hold');return;}
        }
        if(!p.peek.pause)p.peek.pause=this.time+(p.peek.style==='ferrari'?.08:p.peek.style==='bait'?.42:p.peek.style==='double-pump'?.12:.16);
        if(this.time>=p.peek.pause)p.peek.back=true;
        if(p.peek.style==='crouch-swing')p.crouch=!p.peek.back;
        this.applyMotion(p,{x:0,z:0},dt,'peek');
      } else {
        const speed=p.peek.style==='ferrari'?LIVE_RUN_SPEED:p.peek.style==='crouch-swing'?LIVE_CROUCH_SPEED:LIVE_WALK_SPEED;
        if(p.peek.style==='crouch-swing')p.crouch=!p.peek.back;
        this.applyMotion(p,{x:(target.x-p.x)/d*speed,z:(target.z-p.z)/d*speed},dt,p.peek.style==='crouch-swing'?'crouch':p.peek.style==='ferrari'?'run':'peek');
      }
      if(p.contact)this.turn(p,heading(p,p.contact));p.action=p.peek?.style==='ferrari'?'Ferrari swing':p.peek?.style==='crouch-swing'?'Crouch-swing':p.peek?.style==='fake'&&p.peek.pumps?'Fake re-peeking':'Jiggle peeking';return;
    }
    if(!p.jump&&!p.smokeLineupId&&!this.map.terrain.onStairs(p)&&this.time>=p.nextJump&&!keepAim&&!p.bomb&&!p.reload&&p.hp>45&&p.contact&&this.time-p.contactAt<3&&!p.target) {
      const contactEye=this.map.terrain.groundHeight(p.contact)+1.6,eye=(p.crouch?1.08:1.6)+p.jumpY,gain=LIVE_JUMP_VELOCITY*LIVE_JUMP_VELOCITY/(2*12.5);
      if(!this.map.sightline(p,p.contact,eye,contactEye)&&this.map.sightline(p,p.contact,eye+gain,contactEye)&&!p.knownSmokes.some(s=>liveSmokeOccludes(p,p.contact!,eye+gain,contactEye,s,this.time))){
        p.jump=true;p.jumpVy=LIVE_JUMP_VELOCITY;p.nextJump=this.time+7.5+this.executionRandom()*4.0;this.jumpSound(p,'takeoff');
        p.action='Jump peeking';this.radio(p,'Jump-spotting for info — hold my trade bro!');
      }
    }
    this.consumePath(p,.3);
    if(!p.jump&&p.path[0]&&(p.path[0].level??'street')===(p.level??'street')
      &&this.time>=(p.routeRepairAt??0)&&!this.map.movementSegmentClear(p,p.path[0])){
      p.routeRepairAt=this.time+.45;
      const repaired=this.routeGoalPath(p,p.goal??p.path[p.path.length-1]);
      if(repaired.length)p.path=repaired;
    }
    const next=p.path[0];
    if(p.perchGoal&&!keepAim){
      const perch=p.perchGoal,dTop=distance(p,perch.top),onTop=this.isOnPerch(p,perch)&&Math.abs(p.jumpY-perch.height)<.12;
      if(onTop&&!p.jump){
        p.crouch=false;
        if(dTop>.28){
          const dirX=(perch.top.x-p.x)/dTop,dirZ=(perch.top.z-p.z)/dTop;
          const spd=Math.min(LIVE_WALK_SPEED,dTop/dt);
          this.applyMotion(p,{x:dirX*spd,z:dirZ*spd},dt,'walk');
          this.preAim(p,true);
          p.action=`Positioning on ${perch.name}`;
          return;
        }
      }else if((p.jump||dTop<=1.85)&&!this.map.terrain.onStairs(p)&&!p.reload&&!p.bomb){
        if(!p.jump&&p.jumpY<perch.height-.08){
          p.jump=true;p.jumpVy=LIVE_JUMP_VELOCITY*1.15;p.crouch=true;
          p.nextJump=this.time+2.2;p.path=[];p.goal={...perch.top};
          this.jumpSound(p,'takeoff');
        }
        const dirX=(perch.top.x-p.x)/(dTop||1),dirZ=(perch.top.z-p.z)/(dTop||1);
        const climbSpeed=p.jumpVy>0&&p.jumpY<perch.height-.26?Math.min(3.5,Math.max(1.8,dTop/dt)):Math.min(LIVE_RUN_SPEED,Math.max(2.2,dTop/dt));
        this.applyMotion(p,{x:dirX*climbSpeed,z:dirZ*climbSpeed},dt,p.crouch?'crouch':'run');
        this.turn(p,heading(p,perch.top));
        p.action='Crouch-jumping onto cover';p.stuckFor=0;
        return;
      }
    }
    if(!p.perchGoal&&!p.jump&&!p.vaultDrop&&!p.smokeLineupId&&!this.map.terrain.onStairs(p)&&this.time>=p.nextJump&&!keepAim&&!p.bomb&&!p.reload&&p.hp>45&&next){
      const dx=next.x-p.x,dz=next.z-p.z,dn=Math.hypot(dx,dz)||1;
      const aheadPerch=this.map.jumpablePerches.find(perch=>{
        const dp=distance(p,perch.top);if(dp>.4&&dp<1.6&&dn>1.2){
          const dot=((perch.top.x-p.x)*dx+(perch.top.z-p.z)*dz)/(dp*dn);
          return dot>.72&&p.jumpY<perch.height-.08&&(!p.goal||distance(p.goal,perch.top)>1.8);
        }return false;
      });
      if(aheadPerch){
        p.jump=true;p.jumpVy=LIVE_JUMP_VELOCITY*1.15;p.crouch=true;
        p.nextJump=this.time+3.5+this.executionRandom()*2.0;
        this.jumpSound(p,'takeoff');p.action='Crouch-jumping over box';
      }
    }
    if(!p.jump&&!p.vaultDrop&&!p.smokeLineupId&&!this.map.terrain.onStairs(p)&&this.time>=p.nextJump&&!keepAim&&!p.bomb&&!p.reload&&p.hp>45&&next){
      const dest=p.goal??next,dx=dest.x-p.x,dz=dest.z-p.z,dDest=Math.hypot(dx,dz)||1;
      const drop=this.map.elevationDrops.find(d=>{
        if(d.fromLevel&&d.fromLevel!==(p.level??'street'))return false;
        if(p.x<d.from.minX||p.x>d.from.maxX||p.z<d.from.minZ||p.z>d.from.maxZ)return false;
        const curH=this.map.terrain.groundHeight(p),landH=this.map.terrain.groundHeight(d.landing);
        if(Math.abs(p.jumpY-curH)>.35||curH-landH<.75)return false;
        const ldx=d.landing.x-p.x,ldz=d.landing.z-p.z,ld=Math.hypot(ldx,ldz)||1;
        return ((dx/dDest)*(ldx/ld)+(dz/dDest)*(ldz/ld))>=d.minForwardDot;
      });
      if(drop){
        const curH=this.map.terrain.groundHeight(p);
        p.jump=true;p.jumpVy=LIVE_JUMP_VELOCITY*1.15;p.crouch=true;
        p.nextJump=this.time+5.5+this.executionRandom()*3.0;
        p.vaultDrop={target:{...drop.landing},landingY:this.map.terrain.groundHeight(drop.landing),clearanceY:curH+1.05,startedAt:this.time,until:this.time+1.35};
        p.path=[drop.landing,...(p.goal?this.map.findPath(drop.landing,p.goal):[])];
        this.jumpSound(p,'takeoff');p.action='Vaulting down';
        this.radio(p,`Dropping out of ${drop.name} — flanking fast!`);
        return;
      }
    }
    const nearRouteEdge=!!next&&p.path.length>1&&distance(p,next)<.8;
    if(!p.jump&&!p.smokeLineupId&&!this.map.terrain.onStairs(p)&&this.time>=p.nextJump&&!keepAim&&!p.target&&!p.bomb&&!p.reload&&p.hp>45
      &&p.path.length>0&&p.speed>2.65&&nearRouteEdge&&this.executionRandom()<.25){
      p.jump=true;p.jumpVy=LIVE_JUMP_VELOCITY;p.jumpQueued=false;p.jumpChain=0;this.jumpSound(p,'takeoff');
      p.nextJump=this.time+8.5+this.executionRandom()*4.5;
      if(p.speed>3.1)p.action='Momentum jump';
    }
    if(!next){
      if(p.smokeLineupId){
        const lineup=this.map.authoredSmokeLineups.find(l=>l.id===p.smokeLineupId);
        if(lineup&&distance(p,lineup.position)<=.55){
          this.applyMotion(p,{x:0,z:0},dt,'hold');
          this.aimSmokeLineup(p,lineup,dt);
          p.stuckFor=0;
          return;
        }
      }
      if(this.knownEnemyCount(p.team)===0&&p.channel===0){
        p.crouch=false;
      }else if(!p.attacking && !this.perchUnder(p) && (!p.perchGoal||p.jumpY<p.perchGoal.height-.05) && (p.action==='Holding'||p.action==='Crouch-holding') && (distance(p,this.map.definition.sites.A)<14 || distance(p,this.map.definition.sites.B)<14)) {
        p.crouch=true;
      }
      this.applyMotion(p,{x:0,z:0},dt,p.crouch?'crouch':'hold');
      p.action=p.reload>0?'Reloading':p.speed>.12?'Settling':p.crouch?'Crouch-holding':'Holding';
      if(!keepAim)this.preAim(p,true);
      p.stuckFor=0;
      if(p.holdingSince===undefined)p.holdingSince=this.time;
      return;
    }
    p.holdingSince=undefined;
    if(!p.bomb&&!p.objectiveUrgent&&this.bomb.status==='carried'&&p.path.length===1&&distance(p,next)<1.4
      &&this.actors.some(a=>a!==p&&a.team===p.team&&a.hp>0&&a.speed<.15&&Math.abs(a.jumpY-p.jumpY)<.6&&distance(a,next)<.55)){
      this.applyMotion(p,{x:0,z:0},dt,'hold');p.stuckFor=0;
      p.action='Holding trade spacing';p.intent='A teammate holds this angle; leave room to trade';
      if(!keepAim)this.preAim(p,true);
      return;
    }
    if(!keepAim&&p.clearUntil>this.time&&p.clearPoint){
      this.applyMotion(p,{x:0,z:0},dt,p.crouch?'crouch':'hold');
      this.turn(p,heading(p,p.clearPoint));
      p.action=p.crouch?'Crouch-clearing':'Clearing an angle';
      return;
    }
    const hasNearbyIntel=(this.time-p.contactAt<8&&!!p.contact&&distance(p,p.contact)<26)
      ||liveIntelBeliefs(p.intel,this.time).some(c=>c.certainty>.28&&c.age<8&&distance(p,c)<26);
    const midZ=(this.map.definition.spawns.attackers.z+this.map.definition.spawns.defenders.z)*.5;
    const inSpawnSide=this.map.id==='fontessa'?(p.attacking?p.z<-2:p.z>16):(p.attacking?p.z<midZ-2:p.z>midZ+12);
    const livingAllies=this.actors.filter(a=>a.team===p.team&&a.hp>0).length;
    const livingEnemies=this.knownEnemyCount(p.team);
    const isClutch=livingAllies<=1&&livingEnemies>=1&&livingEnemies<=2;
    if(livingEnemies===0&&p.channel===0)p.crouch=false;
    const openingRollout=(this.liveElapsed<11||(inSpawnSide&&!hasNearbyIntel))
      &&!p.target&&this.time-p.contactAt>5&&this.time-p.damageAt>5&&!isClutch;
    if(livingEnemies>0&&!openingRollout&&!urgent&&!p.smokeLineupId&&!keepAim&&!p.bomb&&this.time>=p.nextPeek&&p.cleared.size<6&&p.decision==='prepare'&&this.time-p.contactAt>3) {
      const forward=liveRouteLookAhead(p,p.path)??next;
      const check=this.map.clearAngles(p,forward).filter(a=>!p.cleared.has(a.id)&&Math.abs(angle(heading(p,a.point)-p.yaw))<.7)
        .sort((a,b)=>Math.abs(angle(heading(p,a.point)-p.yaw))-Math.abs(angle(heading(p,b.point)-p.yaw)))[0];p.nextPeek=this.time+2.5;
      if(check){p.cleared.add(check.id);p.clearPoint=check.point;
        p.clearUntil=this.time+.35+(1-this.skill(p,'positioning',p.skills.gameSense))*.25+Math.abs(angle(heading(p,check.point)-p.yaw))/(3.4+(p.profile?.7:p.skills.mechanics)*3);
        p.aimFocus={point:{...check.point},source:'clear',until:p.clearUntil+.6,from:{x:p.x,z:p.z}};
        this.applyMotion(p,{x:0,z:0},dt,'hold');this.turn(p,heading(p,check.point));p.action='Clearing an angle';return;}
    }
    const d=distance(p,next);
    if(!urgent&&!this.stickingFinalDefuse(p)){
      const nextFire=this.activeFireAt(next,.35);
      if(nextFire){
        const bypass=this.escapeFirePoint(p,nextFire,p.goal??next);
        if(distance(p,bypass)>.45&&!this.activeFireAt(bypass,.35)&&this.map.movementSegmentClear(p,bypass)){
          const db=distance(p,bypass)||1,spd=p.equipped==='knife'?LIVE_KNIFE.runSpeed:LIVE_RUN_SPEED;
          this.applyMotion(p,{x:(bypass.x-p.x)/db*spd,z:(bypass.z-p.z)/db*spd},dt,'run');
          if(!keepAim)this.turn(p,heading(p,bypass));
          p.action='Bypassing incendiary';return;
        }
        this.applyMotion(p,{x:0,z:0},dt,'brake');
        if(!keepAim)this.preAim(p,true);
        p.action='Waiting out incendiary';return;
      }
    }
    const uWest=this.map.definition.tactical.mid.underpass.west,uEast=this.map.definition.tactical.mid.underpass.east;
    const inUnderpass=this.map.id==='fontessa'
      ?(Math.abs(p.z-(-10))<3&&p.x>-9&&p.x<1)
      :(p.x>=Math.min(uWest.x,uEast.x)-3&&p.x<=Math.max(uWest.x,uEast.x)+3&&p.z>=Math.min(uWest.z,uEast.z)-3&&p.z<=Math.max(uWest.z,uEast.z)+3);
    const flashGo=!!p.flashWindow&&this.time>=p.flashWindow.opens&&this.time<p.flashWindow.expires;
    if(flashGo){
      p.crouch=false;
      if(this.time-p.flashWindow!.opens<.18)this.radio(p,'Flash popped — swinging wide with you bro!');
    }
    const heardDefuseCharge=this.heardBombDefuseActive(p)&&distance(p,this.bomb)<=13.5;
    if(!keepAim&&this.canSpamBombSmoke(p)&&p.equipped===p.weapon&&p.weaponReady===0&&!p.reload&&!p.jump
      &&(p.suppression?.nextBurstAt??0)<=this.time+.05){
      this.applyMotion(p,{x:0,z:0},dt,'brake');
      this.turn(p,heading(p,this.bomb));
      p.action='Spamming bomb smoke';
      return;
    }
    const eye=(p.crouch?1.08:1.6)+p.jumpY,nextEye=(p.crouch?1.08:1.6)+this.map.terrain.groundHeight(next);
    const smoke=p.knownSmokes.find(s=>s.expires>this.time+.4&&distance(p,s)<s.radius+2&&distance(p,s)>s.radius+.3&&liveSmokeOccludes(p,next,eye,nextEye,s,this.time));
    const readyAllyForBreach=this.actors.some(ally=>ally!==p&&ally.team===p.team&&ally.hp>0&&!ally.bomb&&distance(p,ally)<6
      &&Math.abs(p.jumpY-ally.jumpY)<1&&ally.equipped===ally.weapon&&ally.weaponReady===0&&ally.ammo>0&&!ally.reload&&ally.blinded<.2&&this.map.sightline(p,ally));
    const supportedBreach=!!smoke&&p.attacking&&order.mode==='execute'&&order.executePhase==='breach'
      &&liveOrderActive(order,this.time)&&this.time-(order.phaseAt??-100)<4&&p.hp>=45
      &&(!p.bomb||(p.equipped===p.weapon||p.equipped==='bomb'))
      &&p.weaponReady===0&&(p.bomb||p.ammo>0)&&!p.reload&&p.blinded<.2&&readyAllyForBreach;
    if(livingEnemies>0&&smoke&&!urgent&&!heardDefuseCharge&&!flashGo&&!supportedBreach&&!keepAim){
      const expiringSoon=smoke.expires-this.time<=1.35;
      this.applyMotion(p,{x:0,z:0},dt,'brake');this.preAim(p,true);
      p.action=expiringSoon?'Timing smoke fade':'Watching smoke edge';
      p.intent=expiringSoon?'Smoke fading momentarily — aim ready for the pop':'Smoke conceals the crossing - wait for support or expiry';
      return;
    }
    const cautiousApproach=hasNearbyIntel||(p.attacking?p.z>midZ+3&&distance(p,this.map.definition.sites[this.site])<22:p.z<midZ+13);
    const maskedByNoise=this.noiseMasks.some(m=>m.until>this.time&&distance(p,m)<=m.radius+4);
    const quiet=livingEnemies>0&&!maskedByNoise&&!openingRollout&&!urgent&&!flashGo&&!supportedBreach&&(((p.decision==='prepare'||p.decision==='probe')&&cautiousApproach)||inUnderpass||(p.role==='lurker'&&this.time-p.contactAt>1.5)||isClutch);
    if(p.objectiveUrgent&&!keepAim)p.crouch=false;
    let speed=p.crouch?LIVE_CROUCH_SPEED:p.reload>0?2.2:quiet?LIVE_WALK_SPEED:p.equipped==='knife'?LIVE_KNIFE.runSpeed:LIVE_RUN_SPEED;
    if(p.path.length>1&&!p.jump){
      const following=p.path[1],nx=next.x-p.x,nz=next.z-p.z,dx=following.x-next.x,dz=following.z-next.z;
      const turn=(nx*dx+nz*dz)/((Math.hypot(nx,nz)*Math.hypot(dx,dz))||1);
      if(turn<.85)speed=Math.min(speed,Math.sqrt(24*Math.max(.02,d-.05)));
    }
    this.applyMotion(p,{x:(next.x-p.x)/d*Math.min(speed,d/dt),z:(next.z-p.z)/d*Math.min(speed,d/dt)},dt,p.crouch?'crouch':quiet?'walk':'run');
    if(!keepAim)this.preAim(p,false);
    p.action=p.reload>0?(p.reloadSilent?'Silent reloading':'Reloading'):p.weaponReady>0?'Drawing weapon':p.crouch?(quiet?'Crouch-walking':'Crouching'):quiet?'Walking quietly':p.equipped==='knife'?'Running with knife':p.attacking?'Taking space':'Rotating';
    if(livingEnemies===0&&p.channel===0&&!p.reload&&!p.weaponReady)p.action=p.intent?.includes('Scavenge')||p.intent?.includes('scavenge')?'Hunting for upgraded weapon':p.equipped==='knife'?'Running with knife':'Celebrating round wipe';
    if(supportedBreach){p.action='Breaching with trade support';p.intent='Cross the called smoke together; keep the trade weapon ready';}
    if(p.trafficYield&&this.time<p.trafficYield.until)p.action='Making room for teammate';
    else if(p.speed<.03)p.action='Waiting for a clear lane';
  }
  private objective(p:Actor,dt:number):boolean {
    if(p.attacking && this.bomb.status==='dropped' && distance(p,this.bomb)<1.2&&Math.abs(p.jumpY-this.map.terrain.groundHeight(this.bomb))<.8&&this.map.sightline(p,this.bomb)){p.bomb=true;this.bomb.status='carried';this.emit('objective',`${p.name} recovered the device`,p.team,p.id);}
    if(p.bomb && this.bomb.status==='carried') {
      if(p.fakePlantHoldUntil!==undefined&&this.time<p.fakePlantHoldUntil){
        this.applyMotion(p,{x:0,z:0},dt,'hold');
        p.action='Holding fake plant';p.intent='Cancel the plant sound and hold for the reported peek';
        const reported=strongestLiveIntel(p.intel,p,this.time);
        if(reported?.source==='sight'&&reported.age<2.2&&distance(p,reported)<18){
          p.aimFocus={point:{x:reported.x,z:reported.z},source:'contact',until:p.fakePlantHoldUntil,from:{x:p.x,z:p.z}};
          this.turn(p,heading(p,reported));
        }
        return true;
      }
      p.fakePlantHoldUntil=undefined;
      const site=livePlantSite(p,this.map);
      if(site&&p.jump){p.channel=0;return false;}
      if(site&&this.remaining>0){
        const threats=p.profile?p.noticedEnemies:this.actors.filter(a=>a.team!==p.team&&a.hp>0&&this.visible(p,a));
        const supported=this.actors.some(a=>a!==p&&a.team===p.team&&a.hp>0&&distance(p,a)<12&&this.time-a.lastShot<1);
        const concealed=p.knownSmokes.some(s=>s.expires>this.time+1&&distance(p,s)<s.radius);
        if(!shouldCommitLivePlant(p,threats,this.time,this.remaining,p.channel,this.time-p.damageAt,supported,concealed)){
          p.channel=0;return false;
        }
      }
      if(site && this.remaining>0){this.applyMotion(p,{x:0,z:0},dt,'brake');if(p.speed>.12){p.channel=0;p.action='Settling to plant';return true;}}
      if(site && this.remaining>0){
        const approach=strongestLiveIntel(p.intel,p,this.time);
        if(p.channel===0&&p.smoke>0&&approach&&approach.age<5&&distance(p,approach)<22&&!p.knownSmokes.some(s=>s.expires>this.time+4&&distance(p,s)<s.radius)&&this.throwUtility(p,'smoke',p,'underhand')){p.action='Concealing the plant';return true;}
        if(p.equipped!=='bomb'){this.equip(p,'bomb');p.action='Equipping C4';p.intent=`Plant ${p.plantStyle??'behind cover'}; teammates cover the retake`;return true;}
        if(p.weaponReady>0){p.action='Preparing C4';return true;}
        const starting=p.channel===0;
        p.action='Planting';p.crouch=true;p.channel+=dt;
        if(starting){this.hear(p,22,'utility');this.audioCues.push({kind:'bombPlant',phase:'start',x:p.x,z:p.z});this.emit('objective',`${p.name} started planting`,p.team,p.id);}
        const reported=strongestLiveIntel(p.intel,p,this.time);
        if(!p.fakePlantDone&&p.channel>=.45&&this.remaining>LIVE_PLANT_RULES.seconds+10
          &&reported?.source==='sight'&&reported.age<1.8&&distance(p,reported)<14
          &&this.skill(p,'decisionMaking',p.skills.gameSense)>.48
          &&this.executionRandom()<.3+this.skill(p,'informationReading',p.skills.gameSense)*.35){
          p.fakePlantDone=true;p.channel=0;p.fakePlantHoldUntil=this.time+1.4;this.equip(p,p.weapon);
          p.action='Holding fake plant';p.intent='Cancel the plant sound and hold for the reported peek';
          p.radioAt=this.time;p.radioMessage='Fake plant tapped — hold the angle!';
          this.emit('objective',`${p.name}: "[RADIO] Fake plant tapped — hold the angle!"`,p.team,p.id);
          return true;
        }
        if(p.channel>=LIVE_PLANT_RULES.seconds){
          p.bomb=false;p.channel=0;p.crouch=false;this.postPlantPlanterId=p.id;this.bomb={status:'planted',x:p.x,z:p.z,remaining:40,site,plantStyle:p.plantStyle};
          this.equip(p,p.weapon);
          this.nextBombTick=this.time+.15;
          this.audioCues.push({kind:'bombPlant',phase:'complete',x:p.x,z:p.z});
          p.cash=Math.min(10000,p.cash+300);p.impact.plants++;
          this.emit('objective',`${p.name} planted at ${site}`,p.team,p.id);
          const defenders=this.actors.filter(actor=>!actor.attacking&&actor.hp>0);
          for(const actor of this.actors){
            actor.nextThink=this.time;
            if(actor.attacking){actor.peek=undefined;this.movementLearner(actor.team)?.close(actor.id);actor.goal=undefined;actor.path=[];actor.postAssignment=undefined;actor.probeGoal=undefined;actor.approachUntil=0;actor.retreatUntil=0;}
          }
          for(const defender of defenders)defender.information=`Bomb planted at ${site} — retake now`;
          const caller=defenders.find(actor=>actor.role==='caller')??defenders.find(actor=>actor.role==='anchor')??defenders[0];
          if(caller)this.radio(caller,`Bomb planted at ${site}! Regroup and start the retake now.`,true);
          const postPlantCaller=this.actors.find(actor=>actor.attacking&&actor.hp>0&&actor.role==='caller')
            ??this.actors.find(actor=>actor.attacking&&actor.hp>0&&actor.role==='support')??p;
          this.radio(postPlantCaller,'Post-plant priorities: 1 planter stays alive, 2 anchor crossfire, 3 trade, 4 delay with utility, 5 hold flank — no solo chase.',true);
        }return true;
      }
    }
    if(!p.attacking && this.bomb.status==='planted' && distance(p,this.bomb)<1.5&&this.map.sightline(p,this.bomb)) {
      const defenders=this.actors.filter(a=>!a.attacking&&a.hp>0);
      const assignment=assignLiveObjective(defenders,this.bomb,this.bomb.remaining,true,this.map);
      if(assignment?.id!==p.id){p.channel=0;return false;}
      if(this.activeFireAt(p,.5,p.jumpY)&&!this.stickingFinalDefuse(p,defenders)){p.channel=0;p.crouch=false;return false;}
      if(p.fakeDefuseHoldUntil && this.time < p.fakeDefuseHoldUntil && this.bomb.remaining>(p.kit?5:10)+1) {
        p.action='Holding fake defuse';
        p.intent='Fake defuse baited — holding angle for T peek!';
        return true;
      }
      // Throw ninja-defuse concealment smoke cleanly BEFORE channeling locks throwUtility().
      if(p.channel===0 && p.smoke>0 && !this.smokes.some(s=>distance(this.bomb,s)<s.radius+.6)
        && this.knownEnemyCount(p.team)>0 && !this.duelCommitted(p) && this.bomb.remaining>=(p.kit?6.8:11.8)) {
        if(this.throwUtility(p,'smoke',{x:this.bomb.x,z:this.bomb.z},'underhand')){
          this.radio(p,'Smoking bomb for ninja defuse — hold my cross!');
          return true;
        }
      }
      this.applyMotion(p,{x:0,z:0},dt,'brake');if(p.speed>.12){p.channel=0;p.action='Settling to defuse';return true;}
      const isStart=p.channel===0;
      p.action='Defusing';p.crouch=true;p.channel+=dt;
      if(isStart){
        this.emit('objective','[BOMB TICK] Defuse cable connected!',p.team,p.id);
        this.audioCues.push({kind:'bombDefuse',phase:'start',x:p.x,z:p.z});
        this.hear(p,28,'utility');
        for(const t of this.actors.filter(a=>a.attacking&&a.hp>0&&distance(a,p)<=(this.map.sightline(a,p)?28:20))){
          t.heardDefuseAt=this.time;
          // Respect personality/utility/clock: avoid mindless single-file suicide peeks when 2+ Ts hold crossfires or utility can deny.
          const hasBombUtil=(t.incendiary>0||t.he>0)&&distance(t,this.bomb)<24;
          const teamAlive=this.actors.filter(a=>a.attacking&&a.hp>0).length;
          const discipline=fpsBehaviorPreferences(this.identity.players[t.id].personality).deliberation;
          if(hasBombUtil&&this.bomb.remaining>6){
            t.nextThink=this.time;t.intent='Defuse sound heard — deny bomb with post-plant utility';
          }else if(teamAlive>=2&&this.bomb.remaining>10&&discipline>.62&&t.postAssignment){
            t.nextThink=this.time+.35;t.intent='Defuse heard — verify fake vs stick before swinging';
          }else{
            t.decision='pressure';t.nextThink=this.time;t.intent='Defuse sound heard — contest the bomb!';
          }
        }
      } else {
        const prevSec=Math.floor(p.channel-dt),curSec=Math.floor(p.channel);
        if(curSec>prevSec && curSec<(p.kit?5:10)){
          this.emit('objective',`[BOMB TICK] Defusing... ${(p.channel).toFixed(1)}s`,p.team,p.id);
          if(curSec%2===1)this.audioCues.push({kind:'bombDefuse',phase:'tick',x:p.x,z:p.z});
          this.hear(p,22,'utility');
          for(const t of this.actors.filter(a=>a.attacking&&a.hp>0&&distance(a,p)<=(this.map.sightline(a,p)?24:18))){
            t.heardDefuseAt=this.time;
            if(this.time-(t.contactAt??-100)>1.2){t.decision='pressure';t.nextThink=this.time;}
          }
        }
      }
      const livingDefenders=this.actors.filter(a=>!a.attacking&&a.hp>0);
      const livingAttackers=this.actors.filter(a=>a.attacking&&a.hp>0);
      const protectedBySmoke=p.knownSmokes.some(s=>s.expires>this.time+1&&distance(p,s)<s.radius);
      if(!p.fakeDefuseDone && livingDefenders.length<=2 && livingAttackers.length>0 && livingAttackers.length<=2 && p.channel>=0.4
        &&shouldFakeLiveDefuse(this.bomb.remaining,p.kit,protectedBySmoke,liveIntelBeliefs(p.intel,this.time),p)) {
        p.fakeDefuseDone=true;
        p.channel=0;
        p.fakeDefuseHoldUntil=this.time+2.5;
        this.equip(p,p.weapon);
        p.action='Holding fake defuse';
        p.intent='Fake defuse baited — holding angle for T peek!';
        this.radio(p,'Tapping the bomb to bait him out — hold my cross bro!',true);
        const threat=strongestLiveIntel(p.intel,p,this.time);
        for(const mate of livingDefenders){
          if(mate!==p&&distance(mate,this.bomb)<18&&!this.duelCommitted(mate)){
            mate.decision='pressure';
            const mateIntel=strongestLiveIntel(mate.intel,mate,this.time)??threat;
            mate.watchPoint=mateIntel?{x:mateIntel.x,z:mateIntel.z,level:mateIntel.level}:this.map.definition.tactical[this.bomb.site??this.site].postPlant[mate.slot%5];
            mate.nextThink=Math.min(mate.nextThink,this.time+.05);
          }
        }
        return true;
      }
      const halfway=p.kit?2.5:5;
      const reportedThreat=liveIntelBeliefs(p.intel,this.time).some(b=>b.age<1.4&&b.certainty>=.45&&distance(p,b)<18);
      if(livingAttackers.length>0&&!p.halfDefuseDone&&p.channel>=halfway&&this.bomb.remaining>(p.kit?5:10)-p.channel+1&&reportedThreat){
        p.halfDefuseDone=true;p.channel=0;p.fakeDefuseHoldUntil=this.time+1.1;
        p.action='Half-defuse bait';p.intent='Half-defuse sound drawn a peek; clear the reported threat before recommitting';
        const report=strongestLiveIntel(p.intel,p,this.time);
        if(report){p.aimFocus={point:{x:report.x,z:report.z},source:'contact',until:p.fakeDefuseHoldUntil,from:{x:p.x,z:p.z}};this.turn(p,heading(p,report));}
        this.emit('objective',`${p.name} cancels a half defuse to clear a reported threat`,p.team,p.id);
        return true;
      }
      if(p.channel>=(p.kit?5:10)){this.bomb.status='defused';p.channel=0;p.crouch=false;p.impact.defuses++;this.audioCues.push({kind:'bombDefuse',phase:'complete',x:p.x,z:p.z});this.emit('objective',`${p.name} defused the device`,p.team,p.id);}
      return true;
    }
    return false;
  }
  private useUtility(p:Actor) {
    if(this.time-p.acquired<p.reaction)return;
    const actual=this.actors.find(a=>a.id===p.target&&a.hp>0),target=p.profile?p.noticedEnemies.find(a=>a.id===p.target):actual;
    if(!target || !actual || distance(p,target)>24 || !this.visible(p,actual,false))return;
    const nearby=this.actors.filter(a=>a.team===p.team&&a!==p&&a.hp>0&&distance(p,a)<10);
    const burstPoint={x:p.x+(target.x-p.x)*.75,z:p.z+(target.z-p.z)*.75};
    const friendlyExposure=this.actors.filter(a=>a.team===p.team&&a.hp>0&&distance(a,burstPoint)<13&&this.map.sightline(a,burstPoint)&&Math.cos(angle(heading(a,burstPoint)-a.yaw))>0).length;
    const flashValue=1+nearby.length*.4-friendlyExposure*(.25+this.skill(p,'coordination',p.skills.teamwork)*.6);
    if(p.flash && (nearby.length || p.hp<48) && target.blinded<.2 && flashValue>0 && (target.hp>35||p.hp<48||this.skill(p,'decisionMaking',p.skills.gameSense)<.5)) {
      this.throwUtility(p,'flash',burstPoint,distance(p,burstPoint)<8.5?'underhand':undefined);
    } else if(p.smoke && (p.hp<60||p.bomb||(!p.attacking&&this.bomb.status==='planted'))) {
      // Throw pocket/retreat smoke closer to self's disengage line when hurt instead of midpoint.
      const frac=p.hp<55?.35:.5;
      const smokePoint=this.map.safePoint({x:p.x+(target.x-p.x)*frac,z:p.z+(target.z-p.z)*frac,level:p.level});
      this.throwUtility(p,'smoke',smokePoint,distance(p,smokePoint)<9.2?'underhand':undefined);
    }
  }
  private hear(source:Actor,radius:number,signal?:'gunfire'|'footstep'|'melee'|'reload'|'utility',weaponHint?:LiveWeaponHint) {
    const kind=signal??(radius>=24?'gunfire':radius<10?'melee':'footstep');
    if(kind==='gunfire'||kind==='utility')this.noiseMasks.push({x:source.x,z:source.z,until:this.time+(kind==='gunfire'?.65:1.1),radius:kind==='gunfire'?13:16});
    for(const actor of this.actors.filter(a=>a.team!==source.team&&a.hp>0)) {
      const range=distance(actor,source),audible=this.map.sightline(actor,source)?radius:radius*.65;
      if(range>audible||this.time-actor.seenAt<.4)continue;
      if(kind==='footstep'&&this.noiseMasks.some(mask=>mask.until>this.time&&distance(actor,mask)<=mask.radius))continue;
      const reading=this.skill(actor,'informationReading',actor.skills.gameSense);
      const error=(kind==='gunfire'?1.4:kind==='reload'?1.8:kind==='utility'?2.8:2.3)+range*(.06+(1-reading)*.13);
      const bearing=this.observationRandom()*Math.PI*2,offset=Math.sqrt(this.observationRandom())*error;
      const point=this.map.safePoint({x:source.x+Math.cos(bearing)*offset,z:source.z+Math.sin(bearing)*offset,level:source.level});
      // No source ID: a listener cannot count several runners from an exact hidden identity.
      const contact:LiveIntelContact={key:`sound:${kind}:${Math.round(point.x/7)}:${Math.round(point.z/7)}`,observerId:actor.id,source:kind,
        ...point,observed:this.time,confidence:kind==='gunfire'?.64:kind==='reload'?.48:kind==='utility'?.28:.5,uncertainty:error,...(weaponHint?{weaponHint}:{})};
      if(actor.profile)actor.pendingCues.push({at:this.time+.04+(1-this.skill(actor,'awareness',0))*.2,contact});
      else this.observeIntel(actor,contact);
      actor.nextThink=Math.min(actor.nextThink,this.time+.15+(1-reading)*.3);
      if((kind==='footstep'||kind==='gunfire'||kind==='utility')&&!actor.target&&(actor.action==='Holding'||actor.action==='Crouch-holding'||actor.action==='Settling')) {
        const toSource=heading(actor,point);
        if(Math.cos(toSource-actor.yaw)<-0.35) {
          actor.aimFocus={point:{...point},source:'contact',until:this.time+0.85,from:{x:actor.x,z:actor.z}};
          actor.action='Checking flank';
        }
      }
    }
  }
  private jumpSound(player:Actor,phase:'takeoff'|'landing') {
    this.audioCues.push({kind:'jump',phase,x:player.x,y:player.jumpY,level:player.level,surface:this.map.surfaceAt(player,player.jumpY),z:player.z});
    this.hear(player,phase==='landing'?14:18,'footstep');
  }
  private fire(p:Actor,target:Actor) {
    if(p.equipped!==p.weapon||p.weaponReady>0||p.reload>0||p.utilityPreparation||p.ammo<=0)return;
    if(LIVE_WEAPONS[p.weapon].category==='sniper'&&p.scopeState!=='scoped'&&distance(p,target)>8)return;
    const weapon=LIVE_WEAPONS[p.weapon],continuingGlockBurst=p.glockBurstRemaining>0;
    p.ammo--;p.nextShot=this.time+weapon.interval;p.lastShot=this.time;
    p.shotCommitUntil=this.time+Math.min(.32,weapon.interval+.1);
    const equippedWeapon=Object.hasOwn(LIVE_WEAPONS,p.equipped)?p.equipped as LiveWeapon:p.weapon;
    const fromY=(p.crouch?1.08:1.6)+(p.jumpY??0);
    this.audioCues.push({kind:'gunshot',weapon:equippedWeapon,x:p.x,y:fromY,z:p.z});
    const firstShot=p.engagementShots===0;p.engagementShots++;p.impact.shots++;
    if(firstShot)p.impact.firstShots++;
    if(!this.eliminations.length && !p.openingAttempted){p.openingAttempted=true;p.impact.openingAttempts++;}
    p.burst++;
    const shotBurst=p.burst;
    const d=distance(p,target);
    const unscopedSniper=weapon.category==='sniper'&&p.scopeState!=='scoped';
    if(unscopedSniper){p.action='No-scoping';p.intent='Take the close shot without the optic';}
    const startsGlockBurst=p.weapon==='glock'&&!continuingGlockBurst&&d<8&&p.ammo>=2&&this.skill(p,'decisionMaking',p.skills.gameSense)>.58;
    if(continuingGlockBurst){p.glockBurstRemaining--;p.nextShot=this.time+(p.glockBurstRemaining>0?.055:weapon.interval);}
    else if(startsGlockBurst){p.glockBurstRemaining=2;p.nextShot=this.time+.055;}
    const isRifle=weapon.category==='rifle';
    const learnedCadence:FpsFireCadence=isRifle
      ?(!/^(prediction|known|blind|decoy):/.test(target.id)?this.combatLearner(p.team)?.choose(p.id,target.id,p.team,fpsFireContext(d,p.speed,p.ammo,weapon.magazine),this.mechanicsRandom):undefined)??(d>30?'burst':d<15||this.skill(p,'recoilControl',p.skills.recoilControl)>.5?'sustain':'burst')
      :'sustain';
    const fireCadence:FpsFireCadence=isRifle?(d<14?'sustain':d>32?'burst':learnedCadence):'sustain';
    if(isRifle){
      const recoilControl=this.skill(p,'recoilControl',p.skills.recoilControl);
      if(fireCadence==='burst'&&p.burst>=2){p.nextShot+=.22+(1-recoilControl)*.12;p.burst=0;}
      else if(fireCadence==='sustain'&&p.burst>=7+Math.round(recoilControl*6)){p.nextShot+=.22+(1-recoilControl)*.18;p.burst=0;}
    }
    if(p.weapon==='deagle'&&d>12){p.nextShot+=0.32;}
    if(p.weapon==='cz75'&&p.burst>=4){p.nextShot+=0.18;p.burst=0;}
    const movement=p.speed/(LIVE_WEAPONS[p.weapon].category==='smg'?8:LIVE_RUN_SPEED);
    const scopedPrecision=weapon.category==='sniper'?(p.scopeState==='scoped'?.68:1):1;
    const stationary=p.speed<=.12&&!p.jump;
    const settleWindow=liveAccuracySettleTime(p.crouch);
    const precisionReady=stationary&&this.time-p.stillSince>=settleWindow;
    const precisionWeapon=['pistol','rifle','sniper'].includes(weapon.category??'');
    const settlingPenalty=precisionWeapon&&!precisionReady?1.5+Math.max(0,Math.min(1,movement))*2.0:1;
    const stanceAccuracy=p.crouch?(precisionReady?.64:.92):1;
    const sprayBloom=1+Math.min(8,Math.max(0,shotBurst-1))*.055;
    const panicRatio=this.time<(p.panicUntil??0)?clamp((p.panicUntil!-this.time)/.85,0,1):0;
    const spread=((p.profile?weapon.spread+Math.max(0,Math.min(1,movement))*.022:liveAimSpread(p.skills,weapon.spread,p.pressure,p.exertion,movement,shotBurst))+(unscopedSniper?.13:0))*scopedPrecision*stanceAccuracy*settlingPenalty*sprayBloom*(p.jump?2.5:1.0)*(1+panicRatio*.45);
    const input=(p.profile?detailedInputError(p.profile,p.pressure,this.executionRandom,LIVE_WEAPONS[p.weapon].category==='sniper'):0)+panicRatio*.022*(this.executionRandom()+this.executionRandom()-1);
    const yaw=p.yaw+(this.executionRandom()+this.executionRandom()-1)*spread+input+p.recoil;
    const desiredPitch=Math.atan2(liveActorHeadY(target)-fromY,d||1);
    const pitch=(p.pitch??desiredPitch)+(this.executionRandom()+this.executionRandom()-1)*spread+p.recoilPitch;
    if(p.profile){p.motor.inputSamples++;p.motor.inputErrorSum+=input;p.motor.inputErrorSquareSum+=input*input;p.motor.recoilSamples++;p.motor.recoilResidualSum+=Math.abs(p.recoil)+Math.abs(p.recoilPitch);}
    const recoilKick=liveWeaponRecoilKick(p.weapon,shotBurst);
    p.recoil=clamp(p.recoil+recoilKick.yaw,-.12,.12);p.recoilPitch=clamp(p.recoilPitch+recoilKick.pitch,0,.24);
    const origin={x:p.x,y:fromY,z:p.z},direction=liveRayDirection(yaw,pitch),farPoint={x:p.x+direction.x*65,y:fromY+direction.y*65,z:p.z+direction.z*65};
    const wallHits=this.map.wallIntersections(origin,farPoint),opaqueWall=wallHits.find(hit=>!hit.wall.bulletPenetration);
    const wallRange=opaqueWall?opaqueWall.t*65:65;
    let victim:Actor|undefined,victimHit:{distance:number;region:'head'|'body'}|undefined,victimDamageScale=1;
    for(const actor of this.actors.filter(a=>a!==p&&a.hp>0)) {
      const hit=traceLiveActorHit(origin,direction,wallRange,actor);
      if(!hit||hit.distance>=wallRange||(victimHit&&hit.distance>=victimHit.distance))continue;
      const wallsBefore=wallHits.filter(wall=>wall.t*65<hit.distance-1e-5);
      if(wallsBefore.some(wall=>!wall.wall.bulletPenetration))continue;
      const penetration=wallsBefore[0];
      if(penetration&&hit.distance-penetration.t*65>30)continue;
      victim=actor;victimHit=hit;victimDamageScale=penetration?.wall.bulletPenetration??1;
    }
    const range=victimHit?.distance??wallRange;
    const to={x:origin.x+direction.x*range,z:origin.z+direction.z*range};
    const toY=origin.y+direction.y*range;
    // Bullets traversing active smokes transiently disturb cloud density/radius.
    for(const smoke of this.smokes){
      const approach=closestShotApproach({x:smoke.x,y:smoke.y,z:smoke.z},origin,{x:to.x,y:toY,z:to.z});
      if(approach.distance<smoke.radius*.9){
        const bump=Math.min(.85,(smoke.disturbance??0)+LIVE_HE_RULES.shotSmokeDisturbance*.55);
        this.disturbSmoke(smoke,bump,this.time+.55);
      }
    }
    this.shots.push({id:++this.sequence,time:this.time,actorId:p.id,weapon:equippedWeapon,
      from:{x:origin.x,z:origin.z},to,fromY:origin.y,toY,team:p.team,
      ...(victim&&victimHit?{targetId:victim.id,hitRegion:victimHit.region}:{})});
    let nearestMiss:{distance:number;x:number;z:number}|undefined;
    for(const actor of this.actors.filter(a=>a!==p&&a!==victim&&a.team!==p.team&&a.hp>0)){
      let near:{distance:number;x:number;z:number}|undefined;
      for(const y of [liveActorHeadY(actor),.92+actor.jumpY]){
        const sample=closestShotApproach({x:actor.x,y,z:actor.z},origin,{x:to.x,y:toY,z:to.z});
        if(!near||sample.distance<near.distance)near=sample;
      }
      if(near&&near.distance<1.05){
        this.recordIncoming(actor,p,'near-miss',1-near.distance/1.05);
        if(!nearestMiss||near.distance<nearestMiss.distance)nearestMiss=near;
      }
    }
    if(nearestMiss)this.audioCues.push({kind:'nearMiss',x:nearestMiss.x,z:nearestMiss.z});
    if(weapon.category==='sniper'){
      p.scopeState='cycling';p.scopeLevel=0;p.scopeUntil=p.nextShot;p.scopeHoldUntil=p.nextShot+.12;
      p.retreatUntil=this.time+1.25;
      const heat=this.heatSampler(p.team);
      const nearbyCover=this.map.findCover(p,target,this.actors.filter(a=>a!==p),p.profile?this.skill(p,'positioning',p.skills.gameSense):undefined,[],heat);
      if(nearbyCover){
        p.goal=nearbyCover;
        p.path=this.map.findPath(p,nearbyCover,[target],this.skill(p,'positioning',p.skills.gameSense),heat);
      }
      p.intent=unscopedSniper?'No-scope shot — reposition while cycling the bolt':'Shoot and scoot — cycling sniper bolt in cover';
      p.action=unscopedSniper?'No-scoping':'Cycling bolt in cover';
      p.radioAt=this.time;p.radioMessage='Shot fired — cycling bolt behind cover!';
      this.emit('objective',`${p.name}: "[RADIO] Shot fired — cycling bolt behind cover!"`,p.team,p.id);
    }
    if(victim&&victimHit) {
      const isHeadshot=victimHit.region==='head';
      if(isHeadshot&&victim.team!==p.team)p.impact.headshots++;
      const multiplier=isHeadshot?weapon.headshotMultiplier:1.0;
      const impactRange=victimHit.distance;
      const pelletHits=weapon.pellets?weapon.pellets*Math.max(.08,1-impactRange/15):1;
      const falloff=1-(weapon.rangeLoss??.2)*Math.max(0,impactRange-12)/53;
      const rawDamage=weapon.damage*multiplier*pelletHits*victimDamageScale*Math.max(.4,falloff);
      this.damage(p,victim,rawDamage,isHeadshot,p.weapon,firstShot,victim.id,
        victim.team===p.team?LIVE_FRIENDLY_FIRE_RULES.bulletDamageScale:1,{wallbang:victimDamageScale<1,noScope:unscopedSniper},
        {region:isHeadshot?'head':toY-victim.jumpY<.62?'legs':'torso',point:{x:to.x,y:toY,z:to.z},direction:{...direction},
          strength:clamp(rawDamage/65,.65,1.45)});
    }
    // Nearby gunfire radius & lawful weapon hint depend on weapon acoustics (suppressed/sniper/eco).
    const hint:LiveWeaponHint=weapon.category==='sniper'?'sniper':(p.weapon==='usp_s'||p.weapon==='m4a1_s')?'suppressed':weapon.category==='pistol'?'eco':'rifle';
    const soundRadius=hint==='sniper'?34:hint==='suppressed'?14.5:p.weapon==='deagle'?28:weapon.category==='pistol'?20:p.weapon==='negev'?30:24;
    this.hear(p,soundRadius,'gunfire',hint);
  }
  private recordIncoming(player:Actor,source:FpsPoint,kind:LiveFireCue['kind'],strength:number):void {
    if(kind==='near-miss'&&this.fireCues.some(cue=>cue.playerId===player.id&&this.time-cue.at<.12))return;
    // An approximate directional cue conveys impact/whiz direction, never an enemy position or ID.
    const bearing=Math.round(heading(player,source)/(Math.PI/4))*(Math.PI/4);
    this.fireCues.push({id:++this.fireCueSequence,playerId:player.id,at:this.time,bearing,kind,strength:clamp(strength,0,1)});
    if(this.fireCues.length>40)this.fireCues.splice(0,this.fireCues.length-40);
  }
  private damage(p:Actor,victim:Actor,rawDamage:number,isHeadshot:boolean,weaponId:LiveEquippedWeapon,firstShot:boolean,sampleTarget?:string,friendlyDamageScale=1,flags?:{wallbang:boolean;noScope:boolean},impact?:LiveFatalImpact) {
    const friendly=p.team===victim.team,scaledRawDamage=rawDamage*(friendly?clamp(friendlyDamageScale,0,1):1);
    const armorScale=Object.hasOwn(LIVE_WEAPONS,weaponId)?LIVE_WEAPONS[weaponId as LiveWeapon].armorScale??.78:.78;
    const damage=scaledRawDamage*(victim.armor>0?armorScale:1),actualDamage=Math.min(victim.hp,damage);
    if(friendly&&p!==victim)this.friendlyDamage+=Math.max(0,actualDamage);
    if(actualDamage>0&&p!==victim)this.recordIncoming(victim,p,'hit',Math.min(1,actualDamage/45));
    if(actualDamage>0&&(Object.hasOwn(LIVE_WEAPONS,weaponId)||weaponId==='knife')){
      const region=isHeadshot?'head':'body',lethal=actualDamage>=victim.hp;
      this.bloodMarks.push({level:victim.level,id:++this.sequence,x:victim.x,z:victim.z,startedAt:this.time,region,radius:region==='head'?.46:.34});
      this.audioCues.push({kind:'impact',region,lethal,x:victim.x,z:victim.z});
    }
    const rifleShot=Object.hasOwn(LIVE_WEAPONS,weaponId)&&LIVE_WEAPONS[weaponId as LiveWeapon].category==='rifle';
    if(!friendly){
      const prior=victim.damageLedger?.get(p.id);victim.damageLedger?.set(p.id,{damage:(prior?.damage??0)+actualDamage,at:this.time});
      if(weaponId!=='knife')p.impact.hits++;
      p.impact.damage+=actualDamage;
      if(firstShot)p.impact.firstShotHits++;
      if(!p.engagementDamaged&&weaponId!=='knife'&&victim.id===sampleTarget){p.engagementDamaged=true;p.impact.timeToDamageSamples++;p.impact.timeToDamageMs+=Math.max(0,this.time-p.acquired)*1000;}
      this.movementLearner(p.team)?.recordDamage(p.id,victim.id,actualDamage);
      this.movementLearner(victim.team)?.recordIncoming(victim.id,p.id,actualDamage);
      if(rifleShot){this.combatLearner(p.team)?.recordDamage(p.id,victim.id,actualDamage);this.combatLearner(victim.team)?.recordIncoming(victim.id,p.id,actualDamage);}
    }
    victim.armor=Math.max(0,victim.armor-scaledRawDamage*.25);victim.hp=Math.max(0,victim.hp-damage);victim.damageAt=this.time;
    if(victim.hp>0&&!friendly){
      if(p!==victim&&victim.target!==p.id&&Math.cos(angle(heading(victim,p)-victim.yaw))<-.25){
        const composure=this.skill(victim,'decisionMaking',victim.skills.gameSense)*.5+this.skill(victim,'reactions',victim.skills.mechanics)*.5;
        victim.panicUntil=Math.max(victim.panicUntil??0,this.time+.5+(1-composure)*.55);
        if(!victim.target)victim.reaction=Math.max(victim.reaction,this.reactionDelay(victim)+.08+(1-composure)*.12);
      }
      const identified=this.visible(victim,p),error=identified?0:3+distance(p,victim)*.12;
      const bearing=this.observationRandom()*Math.PI*2,point=identified?{x:p.x,z:p.z}:this.map.safePoint({x:p.x+Math.cos(bearing)*error*.7,z:p.z+Math.sin(bearing)*error*.7,level:p.level});
      this.observeIntel(victim,{key:identified?`enemy:${p.id}`:`damage:${Math.round(point.x/7)}:${Math.round(point.z/7)}`,
        enemyId:identified?p.id:undefined,observerId:victim.id,source:identified?'sight':'damage',...point,observed:this.time,confidence:identified?.98:.68,uncertainty:identified?.45:error});
      victim.nextThink=Math.min(victim.nextThink,this.time+.12);
      if(actualDamage>=35&&victim.hp<=55&&this.visible(p,victim,false)){
        this.radio(p,`${victim.name}'s lit ${Math.round(100-victim.hp)} HP — swing him together bro!`);
        const skill=this.skill(p,'communication',p.skills.teamwork),communication=this.identity.teams[p.team].chemistry.communication;
        const delay=Math.max(.08,(1-skill)*.25+(1-communication)*.15);
        this.reports.push({team:p.team,source:p.id,at:this.time+delay,
          contact:{key:`enemy:${victim.id}`,enemyId:victim.id,observerId:p.id,source:'sight',x:victim.x,z:victim.z,level:victim.level,observed:this.time,confidence:.94,uncertainty:.75}});
      }
    }
    if(victim.hp===0) {
      releaseActorBlackboard(this.teamBlackboard(victim.team),victim.id);
      this.routeLearner(victim.team)?.close(victim,this.time);
      this.movementLearner(victim.team)?.close(victim.id);
      if(!friendly){p.kills++;p.cash=Math.min(10000,p.cash+(Object.hasOwn(LIVE_WEAPONS,weaponId)?LIVE_WEAPONS[weaponId as LiveWeapon].killReward??250:300));this.combatLearner(p.team)?.recordKill(p.id,victim.id);this.movementLearner(p.team)?.recordKill(p.id,victim.id);}
      else if(p!==victim)p.teamKills=(p.teamKills??0)+1;
      victim.deaths++;victim.channel=0;
      const fatal=impact??{region:isHeadshot?'head' as const:'torso' as const,
        point:{x:victim.x,y:victim.jumpY+(isHeadshot?1.54:1.0)*(victim.crouch?.76:1),z:victim.z},
        direction:{x:Math.sin(heading(p,victim)),y:0,z:Math.cos(heading(p,victim))},strength:.7};
      this.corpses.push({id:++this.sequence,playerId:victim.id,attacking:victim.attacking,at:this.time,x:victim.x,z:victim.z,level:victim.level,y:victim.jumpY,yaw:victim.yaw,
        vx:victim.vx,vz:victim.vz,vy:victim.jumpVy,crouch:victim.crouch,impact:{...fatal,point:{...fatal.point},direction:{...fatal.direction}}});
      if(!friendly)for(const helper of this.actors.filter(a=>a.team===p.team&&a!==p)){const contribution=victim.damageLedger?.get(helper.id);if(contribution&&contribution.damage>=35&&this.time-contribution.at<12||victim.blinded>.2&&victim.flashedBy===helper.id)helper.assists=(helper.assists??0)+1;}

      if(!friendly){for(const ally of this.actors.filter(a=>a.team===victim.team&&a.profile))ally.mentalState.setback=Math.min(1,ally.mentalState.setback+(ally===victim?.3:.08));}
      if(!friendly&&!this.eliminations.length){p.impact.openingKills++;this.firstBloodArea=liveIntelArea(victim,this.map.intelArea);}
      const trades=friendly?[]:this.eliminations.filter(e=>e.killer===victim!.id&&!e.traded&&this.time-e.at<=1.5&&this.actors.some(a=>a.id===e.victim&&a.team===p.team));
      if(trades.length){p.impact.tradeKills++;for(const trade of trades){trade.traded=true;this.actors.find(a=>a.id===trade.victim)!.impact.tradedDeaths++;}}
      const flashHelper=friendly?undefined:this.actors.find(a=>a.id===victim!.flashedBy&&a.id!==p.id&&a.team===p.team);
      if(victim.blinded>.2&&flashHelper)flashHelper.impact.flashAssists++;
      victim.impact.unusedUtilityOnDeath+=victim.flash+victim.smoke+victim.incendiary+victim.he;
      for(const kind of ['flash','smoke','incendiary','he'] as const)while(victim[kind]>0){const offset=victim[kind]*.18;this.droppedUtility.push({id:++this.sequence,kind,team:victim.team,at:this.time,x:victim.x+offset,z:victim.z-offset,level:victim.level});victim[kind]--;}
      this.confirmedDeaths.add(victim.id);
      if(!friendly)this.eliminations.push({killer:p.id,victim:victim.id,team:p.team,at:this.time,traded:false});
      // Lawful death callout: relay the killer's last observed cover/position when seen in a duel.
      let calledPos:FpsPoint|undefined;
      let calledCover='';
      let calledArea='';
      let calledDelay=.16;
      if(!friendly&&p!==victim){
        const sightContact=victim.intel.contacts
          .filter(c=>c.enemyId===p.id&&c.source==='sight'&&this.time-c.observed<3.0)
          .sort((a,b)=>b.observed-a.observed)[0];
        const directSight=this.visible(victim,p);
        const recentTarget=victim.target===p.id&&this.time-victim.seenAt<2.2;
        const lawfulPos:FpsPoint|undefined=directSight
          ?{x:p.x,z:p.z,level:p.level}
          :sightContact
            ?{x:sightContact.x,z:sightContact.z,level:sightContact.level}
            :recentTarget&&victim.aimPoint
              ?{x:victim.aimPoint.x,z:victim.aimPoint.z,level:victim.level}
              :undefined;
        const reactions=['ARGH!','Dammit!','No way!','Watch out!'];
        const reaction=reactions[(this.round+victim.slot+Math.floor(this.time*10))%reactions.length];
        if(lawfulPos){
          calledPos=lawfulPos;
          calledArea=this.map.callout(lawfulPos);
          calledCover=describeNearbyDeathCover(this.map.definition.solids,lawfulPos,this.map.terrain.groundHeight(lawfulPos));
          const callMsg=calledCover
            ?`${reaction} 1 ${calledCover}, ${calledArea} — trade him!`
            :`${reaction} 1 at ${calledArea} — trade him!`;
          this.radio(victim,callMsg,true);
          const deathReport=this.teamReports[this.teamReports.length-1];
          if(deathReport?.actorId===victim.id&&deathReport.at===this.time){deathReport.category='contact';deathReport.confidence='confirmed';}
          const commSkill=this.skill(victim,'communication',victim.skills.teamwork);
          const teamComm=this.identity.teams[victim.team].chemistry.communication;
          calledDelay=Math.max(.08,.10+(1-commSkill)*.22+(1-teamComm)*.12);
          this.reports.push({team:victim.team,source:victim.id,at:this.time+calledDelay,
            contact:{key:`enemy:${p.id}`,enemyId:p.id,observerId:victim.id,source:'sight',x:lawfulPos.x,z:lawfulPos.z,level:lawfulPos.level,observed:this.time,confidence:directSight?.96:.86,uncertainty:directSight?.45:1.05}});
          recordInfluenceDanger(this.influenceGrid(victim.team),lawfulPos,.95,this.time,2);
          for(const ally of this.actors){
            if(ally.team===victim.team&&ally.hp>0&&ally!==victim&&distance(ally,victim)<24){
              ally.nextThink=Math.min(ally.nextThink,this.time+calledDelay+.02);
            }
          }
        }else if(weaponId!=='bomb'){
          const blindArea=this.map.callout(victim);
          this.radio(victim,`${reaction} Dropped unseen around ${blindArea} — check flank!`,true);
          const blindReport=this.teamReports[this.teamReports.length-1];
          if(blindReport?.actorId===victim.id&&blindReport.at===this.time){blindReport.category='contact';blindReport.confidence='reported';}
        }
      }
      // Trade Fragger Instant Re-Frag Reflex:
      // When an ally is eliminated, the closest living trade fragger (or teammate within 18m) immediately snaps to the killer or called cover
      const tradeAlly=friendly?undefined:this.actors.filter(a=>a.team===victim.team&&a.hp>0&&a!==victim&&distance(a,victim)<18&&(!this.duelCommitted(a)||a.target===p.id))
        .sort((a,b)=>(Number(b.role==='trade')-Number(a.role==='trade'))||distance(a,victim)-distance(b,victim))[0];
      if(tradeAlly&&(!this.duelCommitted(tradeAlly)||tradeAlly.target===p.id)){
        const visual=this.visible(tradeAlly,p);
        const sample=liveIntelBeliefs(tradeAlly.intel,this.time).find(contact=>contact.enemyId===p.id&&contact.age<1.5&&contact.certainty>.5);
        if(visual){
          const tradeDelay=.06+(1-this.skill(tradeAlly,'reactions',tradeAlly.skills.mechanics))*.18+(1-this.skill(tradeAlly,'trading',tradeAlly.skills.teamwork))*.1;
          tradeAlly.target=p.id;tradeAlly.acquired=this.time-tradeAlly.reaction+tradeDelay;
          tradeAlly.aimPoint={x:p.x,z:p.z};tradeAlly.contact={x:p.x,z:p.z};tradeAlly.contactAt=this.time;
          tradeAlly.seenAt=this.time;tradeAlly.targetCommitUntil=this.time+.65;
          tradeAlly.action='Trading';
          this.radio(tradeAlly,`Trading for ${victim.name} bro, swinging wide!`,true);
        }else if(sample){
          tradeAlly.contact={x:sample.x,z:sample.z,level:sample.level};tradeAlly.contactAt=sample.observed;
          this.radio(tradeAlly,`On the trade for ${victim.name} — swinging last contact!`,true);
        }else if(calledPos){
          tradeAlly.watchPoint={x:calledPos.x,z:calledPos.z};
          tradeAlly.action='Trading';
          this.radio(tradeAlly,`Copy ${victim.name} (${calledCover||calledArea}) — swinging for the trade!`,true);
        }else{
          tradeAlly.watchPoint={x:victim.x,z:victim.z};
          this.radio(tradeAlly,`Lost ${victim.name} — holding your angle, reset with me!`,true);
        }
        tradeAlly.nextThink=Math.min(tradeAlly.nextThink,this.time+(calledPos?calledDelay:.06));
      }
      // Confirmed eliminations are public; their hidden location is not broadcast by this removal.
      for(const actor of this.actors){actor.motionSamples.delete(victim.id);actor.intel.contacts=actor.intel.contacts.filter(c=>c.enemyId!==victim.id);actor.noticedEnemies=actor.noticedEnemies.filter(c=>c.id!==victim.id);this.refreshIntel(actor);}
      if(!friendly&&victim.attacking&&distance(victim,this.map.definition.sites[this.site])<22)this.roundSiteKills[victim.team]++;
      for(const team of ['blue','red'] as const){
        const squad=this.actors.filter(actor=>actor.team===team&&actor.hp>0),remaining=this.knownEnemyCount(team);
        for(const actor of squad){
          actor.enemyRemaining=remaining;
          if(remaining===0){
            actor.intel.contacts=[];actor.contact=undefined;actor.anticipation=undefined;
            actor.peek=undefined;actor.clearUntil=0;actor.retreatUntil=0;
            actor.fakeDefuseHoldUntil=undefined;
            if(actor.channel===0)actor.crouch=false;
            actor.nextThink=this.time;
          }
        }
        const caller=[...squad].sort((a,b)=>Number(b.role==='caller')-Number(a.role==='caller')||a.slot-b.slot)[0];
        if(caller&&remaining<=2)this.radio(caller,`${squad.length} against ${remaining}. ${remaining===1?'Last opponent; keep trade spacing.':remaining===2?'Two opponents left; clear together.':'Opponents eliminated.'}`,true);
      }
      const hsBadge=isHeadshot?' ⌖':'';
      const weaponName = weaponId === 'knife' ? LIVE_KNIFE.name : weaponId === 'flash' ? 'Flashbang' : weaponId === 'smoke' ? 'Smoke' : weaponId === 'incendiary' ? 'Incendiary' : weaponId==='he'?'HE grenade':weaponId === 'bomb' ? 'C4' : LIVE_WEAPONS[weaponId].name;
      this.emit('kill',friendly?`${p===victim?'SELF DAMAGE':'TEAMKILL'} · ${p.name} [${weaponName}]${hsBadge} ${victim.name}`:`${p.name} [${weaponName}]${hsBadge} ${victim.name}`,p.team,p.id,victim.id,isHeadshot,weaponId);
      const frag=this.events[this.events.length-1];if(flags){frag.wallbang=flags.wallbang;frag.noScope=flags.noScope;}
      this.cancelReload(victim);
      if(victim.holsteredPrimary){victim.weapon=victim.holsteredPrimary.weapon;victim.ammo=victim.holsteredPrimary.ammo;victim.reserve=victim.holsteredPrimary.reserve;victim.holsteredPrimary=undefined;}
      if(victim.weapon!=='pistol' && victim.weapon!=='usp_s' && victim.weapon!=='glock') {
        this.droppedWeapons.push({
          id:++this.sequence,
          weapon:victim.weapon,
          ammo:victim.ammo,
          reserve:victim.reserve,
          x:victim.x,
          z:victim.z,level:victim.level,
        });
      }
      if(victim.bomb){victim.bomb=false;this.bomb={...this.bomb,status:'dropped',x:victim.x,z:victim.z,level:victim.level};for(const a of this.actors)a.nextThink=this.time;}
      if(victim.kit){victim.kit=false;this.droppedKits.push({id:++this.sequence,x:victim.x,z:victim.z,level:victim.level});}
    }
  }
  private finishRound(team:FpsTeamId,reason:string) {
    const learnedRound=this.learner?.completeRound(this.actors,team,this.time,`${this.learningEpisode}:${this.round}`);
    if(learnedRound){try{this.learner?.options.onRound?.(learnedRound);}catch{/* Optional persistence must not interrupt a completed round. */}}
    const mechanicsRound=this.mechanicsLearner?.completeRound(team,`${this.learningEpisode||'local'}:combat:${this.round}`);
    if(mechanicsRound){try{this.mechanicsLearner?.options.onRound?.(mechanicsRound);}catch{/* Independent local mechanics persistence must not interrupt a completed round. */}}
    const movementRound=this.movementLearnerGlobal?.completeRound(team,`${this.learningEpisode||'local'}:movement:${this.round}`);
    if(movementRound){try{this.movementLearnerGlobal?.options.onRound?.(movementRound);}catch{/* Optional movement persistence must not interrupt a completed round. */}}
    for(const side of ['blue','red'] as const){
      const route=this.teamLearners[side],combat=this.teamMechanics[side],movement=this.teamMovement[side];
      const navigation=route?.completeRound(this.actors.filter(p=>p.team===side),team,this.time,`${this.learningEpisode}:${this.round}:${side}:route`);
      if(navigation)route?.options.onRound?.(navigation);
      const mechanics=combat?.completeRound(team,`${this.learningEpisode}:${this.round}:${side}:combat`);
      if(mechanics)combat?.options.onRound?.(mechanics);
      const movementRound=movement?.completeRound(team,`${this.learningEpisode}:${this.round}:${side}:movement`);
      if(movementRound){try{movement?.options.onRound?.(movementRound);}catch{/* A worker callback failure must not interrupt a completed round. */}}
    }
    this.onRoundComplete?.({round:this.round,winner:team,attackTeam:this.attackTeam,reason,planted:['planted','exploded','defused'].includes(this.bomb.status),time:this.time});
    this.grenades=[];
    this.roundHistory.push({
      round: this.round,
      attackTeam: this.attackTeam,
      attackSite: this.site,
      tactic: this.tacticArchetype,
      defenseSetup:this.defenseSetup,
      ...(this.firstBloodArea?{firstBloodSite:this.firstBloodArea}:{}),
      bombPlanted: this.bomb.status==='planted'||this.bomb.status==='exploded'||this.bomb.status==='defused',
      winner: team,
    });
    for(const p of this.actors){p.impact.roundsCompleted++;if(p.hp>0)p.impact.roundsSurvived++;if(p.profile&&p.team!==team)p.mentalState.setback=Math.min(1,p.mentalState.setback+.12);}
    for(const p of this.actors){p.path=[];p.goal=undefined;p.perchGoal=undefined;p.target=undefined;p.channel=0;p.crouch=false;p.postRoamAt=this.time;}
    this.score[team]++;this.roundWinner=team;this.roundReason=reason;
    this.emit('round',`${team==='blue'?'Blue Five':'Red Five'} win · ${reason}`,team);
    this.losses[team]=0;this.losses[other(team)]++;
    for(const p of this.actors){const reward=p.team===team?2800:reason==='Time expired'&&p.attacking&&p.hp>0?0:Math.min(3050,1400+450*Math.max(0,this.losses[p.team]-1));p.cash=Math.min(10000,p.cash+reward+(p.team!==team&&p.attacking&&['planted','defused'].includes(this.bomb.status)?500:0));}
    const target=this.round<=30?16:19+3*Math.floor((this.round-31)/6);
    if(this.score[team]>=target){this.phase='finished';this.winner=team;this.remaining=0;}
    else {this.phase='post';this.remaining=7;}
  }
  snapshot():LiveSnapshot {
    const enemyCounts={blue:this.knownEnemyCount('blue'),red:this.knownEnemyCount('red')};
    const actionSkill=(p:Actor)=>{
      const ability=fpsActionAbility(p.action),mechanical=['reactions','crosshairPlacement','precision','recoilControl','movementControl','peeking','utilityExecution'].includes(ability);
      const fallback=ability==='shotcalling'?p.skills.teamwork:mechanical?p.skills.mechanics:p.skills.gameSense;
      return {ability,value:Math.round((1+this.skill(p,ability,fallback)*9)*10)/10,estimated:!p.profile};
    };
    const teamPlan=(team:FpsTeamId):LiveTeamPlan=>({forces:{allies:this.actors.filter(a=>a.team===team&&a.hp>0).length,enemies:enemyCounts[team]},buy:this.teamBuys[team].mode,buyReason:this.teamBuys[team].reason,style:team===this.attackTeam?this.protocol.style:'defense',phase:team===this.attackTeam?this.protocol.phase:'hold',site:team===this.attackTeam?this.site:undefined,
      information:this.bomb.status==='planted'?team===this.attackTeam?`Device planted ${this.bomb.site} — protect the post-plant`:`Device confirmed ${this.bomb.site} — assess the retake and clock`:this.informationOrders[team].reason});
    return {version:'hexatrick-live-exhibition-v19',mapId:this.map.id,mapName:this.map.definition.name,time:this.time,round:this.round,phase:this.phase,
      ...(this.learner?{learning:this.learner.stats()}:{}),
      ...(this.mechanicsLearner?{mechanicsLearning:this.mechanicsLearner.stats()}:{}),
      ...(this.movementLearnerGlobal?{movementLearning:this.movementLearnerGlobal.stats()}:{}),
      remaining:this.phase==='live'&&this.bomb.status==='planted'?this.bomb.remaining:this.remaining,score:{...this.score},winner:this.winner,
      roundWinner:this.roundWinner,roundReason:this.roundReason,attackTeam:this.attackTeam,
      players:this.actors.map(p=>({id:p.id,name:p.name,team:p.team,attacking:p.attacking,role:p.role,x:p.x,z:p.z,level:p.level,yaw:p.yaw,pitch:p.pitch??0,
        hp:p.hp,armor:p.armor,cash:p.cash,weapon:p.weapon,ammo:p.ammo,reserve:p.reserve,reload:p.reload,kills:p.kills,deaths:p.deaths,assists:p.assists??0,scopeState:p.scopeState,scopeLevel:p.scopeLevel,scopeUntil:p.scopeUntil,plantStyle:p.plantStyle,
        actionSkill:actionSkill(p),equipped:p.equipped,weaponReady:p.weaponReady,lastSwing:p.lastSwing,enemyRemaining:enemyCounts[p.team],
        primaryWeapon:p.holsteredPrimary?p.holsteredPrimary.weapon:(LIVE_WEAPONS[p.weapon].category==='pistol'?undefined:p.weapon),
        secondaryWeapon:p.holsteredPrimary?p.weapon:(LIVE_WEAPONS[p.weapon].category==='pistol'?p.weapon:(p.sidearmLoadout?.weapon??(p.attacking?'glock':'usp_s'))),
        secondaryAmmo:p.holsteredPrimary?p.ammo:(LIVE_WEAPONS[p.weapon].category==='pistol'?p.ammo:(p.sidearmLoadout?.ammo??LIVE_WEAPONS[p.attacking?'glock':'usp_s'].magazine)),
        secondaryReserve:p.holsteredPrimary?p.reserve:(LIVE_WEAPONS[p.weapon].category==='pistol'?p.reserve:(p.sidearmLoadout?.reserve??LIVE_WEAPONS[p.attacking?'glock':'usp_s'].reserve)),
        meleeWeapon:'knife' as const,
        information:this.bomb.status==='planted'&&!p.attacking?`Bomb planted at ${this.bomb.site??'site'} — retake now`:p.information,
        jump:p.jump,jumpY:p.jumpY,jumpVy:p.jumpVy,groundY:p.groundY??this.map.terrain.groundHeight(p),radioAt:p.radioAt,radioMessage:p.radioMessage,recoilYaw:p.recoil,recoilPitch:p.recoilPitch,
        ...(p.profile?{skillProfile:{version:p.profile.version,revision:p.profile.revision,source:p.profile.source},diagnostics:{...p.motor},mental:{...p.mentalState}}:{}),
        action:p.action,bomb:p.bomb,kit:p.kit,flash:p.flash,smoke:p.smoke,incendiary:p.incendiary,he:p.he,blinded:p.blinded,channel:p.channel,throwAt:p.throwAt,throwKind:p.throwKind,throwStyle:p.throwStyle,
        utilityPrep:p.utilityPreparation?{kind:p.utilityPreparation.kind,releaseAt:p.utilityPreparation.readyAt+.2,phase:this.time<p.utilityPreparation.equipAt?'equip':this.time<p.utilityPreparation.readyAt?'pin':'ready',target:{...p.utilityPreparation.target},throwStyle:p.utilityPreparation.throwStyle,flightTime:p.utilityPreparation.flightTime,lineupId:p.utilityPreparation.lineupId,launchYaw:p.utilityPreparation.launchYaw,launchPitch:p.utilityPreparation.launchPitch}:undefined,teamKills:p.teamKills??0,
        reloadDuration:p.reloadDuration,reloadSilent:p.reloadSilent,
        personality:p.personality,personalityDimensions:{...this.identity.players[p.id].personality},position:p.position,naturalIdentity:p.naturalIdentity,observedIdentity:observedFpsIdentity(p.behavior),behavior:p.behavior?{version:p.behavior.version,matches:p.behavior.matches,metrics:Object.fromEntries(Object.entries(p.behavior.metrics).map(([key,value])=>[key,{...value}]))}:undefined,lastShot:p.lastShot,callout:this.map.callout(p),intent:p.intent,skills:{...p.skills,recoilControl:this.skill(p,'recoilControl',p.skills.recoilControl)},exertion:p.exertion,impact:{...p.impact},speed:p.speed,stance:p.stance,crouch:p.crouch})),
      fireCues:this.fireCues.map(cue=>({...cue})),events:this.events.map(e=>({...e})),shots:this.shots.map(s=>({...s,from:{...s.from},to:{...s.to}})),
      smokes:this.smokes.map(s=>({...s})),fires:this.fires.map(f=>({...f})),blasts:this.blasts.map(b=>({...b})),bloodMarks:this.bloodMarks.map(b=>({...b})),grenades:this.grenades.map(g=>({...g})),teams:{blue:teamPlan('blue'),red:teamPlan('red')},
      droppedWeapons:this.droppedWeapons.map(w=>({...w,...(w.from?{from:{...w.from}}:{})})),droppedUtility:this.droppedUtility.map(w=>({...w,...(w.from?{from:{...w.from}}:{})})),droppedKits:this.droppedKits.map(k=>({...k})),corpses:this.corpses.map(c=>({...c,...(c.impact?{impact:{...c.impact,point:{...c.impact.point},direction:{...c.impact.direction}}}:{})})),teamReports:this.teamReports.map(r=>({...r})),bomb:{...this.bomb}};
  }

  drainAudioCues():FpsAudioCue[] {
    const cues=this.audioCues;
    this.audioCues=[];
    return cues;
  }

  trainingDiagnostics(){return {friendlyDamage:this.friendlyDamage};}

  teamLearningDiagnostics() {
    return Object.fromEntries((['blue','red'] as const).map(team=>[team,{navigation:this.routeLearner(team)?.checkpoint(),combat:this.combatLearner(team)?.checkpoint(),
      movement:this.movementLearner(team)?.checkpoint()}]));
  }

  learningDiagnostics() {
    const route=this.learner?{initial:structuredClone(this.learner.initial),current:this.learner.checkpoint(),stats:this.learner.stats(),
      settings:{mode:this.learner.options.mode,exploration:this.learner.options.exploration??null}}:undefined;
    const combat=this.mechanicsLearner?{initial:structuredClone(this.mechanicsLearner.initial),current:this.mechanicsLearner.checkpoint(),stats:this.mechanicsLearner.stats()}:undefined;
    const movement=this.movementLearnerGlobal?{initial:structuredClone(this.movementLearnerGlobal.initial),current:this.movementLearnerGlobal.checkpoint(),stats:this.movementLearnerGlobal.stats()}:undefined;
    if(!route&&!combat&&!movement)return undefined;
    return {...route,combatMechanics:combat,movementLearning:movement,reports:{movementRoutes:route?.stats,combatMechanics:combat?.stats,movementChoices:movement?.stats}};
  }

  audioListener(id:string):{x:number;z:number;yaw:number}|undefined {
    const player=this.actors.find(actor=>actor.id===id&&actor.hp>0)??this.actors.find(actor=>actor.hp>0);
    return player?{x:player.x,z:player.z,yaw:player.yaw}:undefined;
  }
}
