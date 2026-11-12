import type { PlayerCard } from '../types.ts';
import type { FpsIdentityExperiment, FpsTeamId } from './types.ts';
import { evaluatePlayerAction, resolveTacticalExecution, type FpsPrimaryRole, type TacticalAction, type FpsSpecialtyOpportunity } from './fpsIdentity.ts';
import { hydrateFpsIdentityContext, observedPersonalityTriggers } from './fpsIdentityMatch.ts';
import { FPS_ROLES } from './fpsRoleFit.ts';
import { moveFpsActor, type FpsPoint } from './fpsSpatialWorld.ts';
import { LIVE_ACTOR_RADIUS, LIVE_FPS_MAP, LIVE_TACTICAL, LIVE_MID, LIVE_CHOKES, LIVE_BOOST_SPOTS, LIVE_SMOKE_LINEUPS, distance, findLivePath, livePathLength, liveSightline, liveWallIntersections, findLiveCover, safeLivePoint, liveCallout, findLivePeek, liveClearAngles } from './fpsLiveMap.ts';
import {liveActorHeadY,liveRayDirection,traceLiveActorHit} from './fpsLiveBallistics.ts';
import { liveSkills, liveDecisionInterval, liveReactionTime, livePressure, liveAimSpread, liveReportDelay, type LiveSkills } from './fpsLiveAttributes.ts';
import { emptyLiveImpact, type LiveImpact } from './fpsLiveImpact.ts';
import { LIVE_WEAPONS, LIVE_KNIFE, liveDrawTime, type LiveWeapon, type LiveEquippedWeapon } from './fpsLiveWeapons.ts';
import { buyLiveTeam, type LiveBuyMode, type LiveBuyPlayer } from './fpsLiveEconomy.ts';
import { advanceLiveVelocity, liveShotSpeedLimit, LIVE_RUN_SPEED, LIVE_WALK_SPEED, LIVE_CROUCH_SPEED, LIVE_JUMP_VELOCITY, advanceLiveJump, type LiveStance } from './fpsLiveMovement.ts';
import { chooseLiveTactic, createLiveProtocol, liveOrderActive, type LiveInformationOrder, type LiveAttackProtocol, type LiveAttackStyle, type LiveAttackPhase, type LiveTacticArchetype, type LiveDefenseSetup, type LiveRoundHistory } from './fpsLiveTactics.ts';
import { LIVE_UTILITY_RULES, LIVE_HE_RULES, LIVE_FRIENDLY_FIRE_RULES, predictLiveGrenade, launchLiveGrenade, stepLiveGrenade, liveGrenadeSightline, type LiveGrenade, type LiveGrenadeKind, type LiveThrowStyle } from './fpsLiveGrenades.ts';
import { advanceLiveAimYaw, liveRouteLookAhead } from './fpsLiveAim.ts';
import { emptyLiveIntel, rememberLiveIntel, strongestLiveIntel, assessLiveIntel, clearLiveIntel, liveIntelArea, describeLiveIntel, liveIntelBeliefs, type LiveIntelContact, type LiveIntelMemory } from './fpsLiveIntel.ts';
import { pinFpsSkillProfile, fpsAbilityUnit, fpsDetailedRoleFit, fpsSkillRandom, type FpsSkillProfile, type FpsAbility } from './fpsSkillProfile.ts';
import { detailedReactionDelay, detailedSenseInterval, detailedAimYaw, detailedInputError, preparedAngleError, detailedThrowPoint, tickFpsMentalState, advanceDetailedRecoil, detailedRecoilImpulse, emptyFpsSkillDiagnostics, type FpsMentalState, type FpsSkillDiagnostics } from './fpsDetailedExecution.ts';
import { recordFpsOpponentPattern, knownFpsTendency, knownFpsPattern, interpretFpsInformation, type FpsOpponentPattern } from './fpsOpponentPatterns.ts';
import { canInvestigateLiveContact, shouldFakeLiveDefuse, chooseLiveApproach, liveCombatStrafe, liveSmokeOccludes, shouldCommitLivePlant, type LiveApproach } from './fpsLiveBrain.ts';
import { assignLiveObjective, createLiveRoutePlanner, liveRouteEvidenceKey, planLivePlant, livePlantSite, LIVE_PLANT_RULES } from './fpsLivePlanning.ts';
import type { FpsAudioCue } from './fpsBroadcastAudio.ts';
import { FpsLiveLearner, fpsLearningModelHash, type FpsLearningOptions, type FpsLearningStats } from './fpsLiveLearning.ts';
import { FpsLiveMechanicsLearner, fpsFireContext, type FpsFireCadence, type FpsMechanicsOptions, type FpsMechanicsStats } from './fpsLiveMechanicsLearning.ts';
export { LIVE_WEAPONS } from './fpsLiveWeapons.ts';
export type { LiveWeapon } from './fpsLiveWeapons.ts';

export const LIVE_FPS_STEP = 1/30;
export interface LivePlayer extends FpsPoint {
  id:string; name:string; team:FpsTeamId; attacking:boolean; role:FpsPrimaryRole; yaw:number;pitch?:number;
  hp:number; armor:number; cash:number; weapon:LiveWeapon; ammo:number; reserve:number; reload:number;reloadDuration:number;reloadSilent:boolean;
  kills:number; deaths:number; action:string; bomb:boolean; kit:boolean; flash:number; smoke:number; incendiary:number;he:number;
  blinded:number; channel:number; personality:string; specialty?:string; lastShot:number;
  throwAt?:number;throwKind?:LiveGrenadeKind;
  utilityPrep?:{kind:LiveGrenadeKind;releaseAt:number};teamKills?:number;
  callout:string; intent:string; skills:LiveSkills; exertion:number;
  impact:LiveImpact;
  speed:number;stance:LiveStance;crouch:boolean;
  jump?:boolean;jumpY?:number;jumpVy?:number;radioMessage?:string;
  isBoosted?:boolean;boostSpot?:string;
  equipped:LiveEquippedWeapon;weaponReady:number;lastSwing:number;
  information:string;
  skillProfile?:{version:1;revision:number;source:FpsSkillProfile['source']};diagnostics?:FpsSkillDiagnostics;mental?:FpsMentalState;
}
interface Actor extends LivePlayer {
  reaction:number; slot:number; target?:string; acquired:number; nextShot:number;
  nextThink:number; decision:TacticalAction; goal?:FpsPoint; path:FpsPoint[]; contact?:FpsPoint;
  contactAt:number; lastMoved:number; utilityAt:number; damageAt:number; flashedBy?:string;
  smokeLineupGoal?:FpsPoint;
  seenAt:number;nextSense:number;burst:number;pressure:number;retreatUntil:number;
  reportAt:number;stuckFor:number;watchPoint?:FpsPoint;
  engagementShots:number;engagementDamaged:boolean;openingAttempted:boolean;
  vx:number;vz:number;nextFootstep:number;nextAudioFootstep:number;nextPeek:number;peek?:{home:FpsPoint;out:FpsPoint;back:boolean;until:number;pause:number;style:'shoulder'|'crouch-swing'|'ferrari'|'double-pump'|'bait'|'fake';pumps:number;prefired:number};
  jump:boolean;jumpY:number;jumpVy:number;nextJump:number;jumpQueued:boolean;jumpChain:number;strafeDirection:1|-1;strafeUntil:number;glockBurstRemaining:number;
  cleared:Set<string>;clearUntil:number;clearPoint?:FpsPoint;lookAwayUntil:number;
  crouch:boolean;crouchUntil:number;
  lookAwayPoint?:FpsPoint;lookAwayStarts?:number;
  aimPoint?:FpsPoint;reactionVariation:number;equipUntil:number;swingAt?:number;
  aimFocus?:{point:FpsPoint;source:'contact'|'route'|'hold'|'clear';until:number;from:FpsPoint};
  intel:LiveIntelMemory;intelManaged:boolean;sentReports:Map<string,number>;
  profile?:FpsSkillProfile;motor:FpsSkillDiagnostics;mentalState:FpsMentalState;patterns:FpsOpponentPattern[];
  pendingCues:{at:number;contact:LiveIntelContact}[];recoil:number;brakeAt?:number;preparedError:number;
  previousSight?:FpsPoint&{at:number;id:string};trackingPoint?:FpsPoint;planAssessmentAt?:number;
  visualCueAt?:number;
  probeGoal?:string;probeVisited:Set<string>;holdingSince?:number;
  freezeDelay?:number;buyAt?:number;postRoamAt?:number;fakeDefuseDone?:boolean;halfDefuseDone?:boolean;fakeDefuseHoldUntil?:number;fakePlantDone?:boolean;fakePlantHoldUntil?:number;triggerDisciplineUntil?:number;
  approachUntil?:number;radioAt?:number;acknowledgedOrder?:number;strafeSettleUntil?:number;
  knownSmokes:LiveSmoke[];flashWindow?:{point:FpsPoint;opens:number;expires:number};
  reloadRounds:number;
  routeEvidence?:string;routeUpdatedAt?:number;objectiveUrgent?:boolean;
  utilityPreparation?:{kind:LiveGrenadeKind;target:FpsPoint;startedAt:number;readyAt:number;throwStyle:LiveThrowStyle};
  noticedEnemies:{id:string;x:number;z:number;hp:number;reload:number;blinded:number;lastShot:number;channel:number}[];
}
export interface LiveSimulationOptions {skillProfiles?:Record<string,FpsSkillProfile>;learning?:FpsLearningOptions;mechanicsLearning?:FpsMechanicsOptions}
export interface DroppedWeapon extends FpsPoint { id:number; weapon:LiveWeapon; ammo:number; reserve:number }
export interface LiveEvent {
  id:number; time:number; kind:'kill'|'round'|'objective'|'utility'|'economy'; text:string;
  team?:FpsTeamId; actorId?:string; targetId?:string; headshot?:boolean; weapon?:LiveEquippedWeapon;
}
export interface LiveShot { id:number; time:number; actorId:string;weapon:LiveWeapon;from:FpsPoint;to:FpsPoint;fromY:number;toY:number;team:FpsTeamId;targetId?:string;hitRegion?:'head'|'body' }
export interface LiveSmoke extends FpsPoint { id:number; startedAt:number; expires:number; radius:number;y:number;disturbedUntil?:number;disturbance?:number }
export interface LiveFire extends FpsPoint { id:number; ownerId:string; team:FpsTeamId; startedAt:number; expires:number; nextDamageAt:number; radius:number }
export interface LiveBlast extends FpsPoint {id:number;startedAt:number;endsAt:number;radius:number}
export interface LiveTeamPlan {buy:LiveBuyMode;buyReason:string;style:LiveAttackStyle|'defense';phase:LiveAttackPhase|'hold';site?:'A'|'B';information:string}
export interface LiveSnapshot {
  version:'hexatrick-live-exhibition-v9'; time:number; round:number;
  phase:'freeze'|'live'|'post'|'finished'; remaining:number; score:Record<FpsTeamId,number>;
  winner?:FpsTeamId; roundWinner?:FpsTeamId; roundReason:string; attackTeam:FpsTeamId;
  players:LivePlayer[]; events:LiveEvent[]; shots:LiveShot[]; smokes:LiveSmoke[]; fires:LiveFire[];blasts:LiveBlast[];
  grenades:LiveGrenade[];teams:Record<FpsTeamId,LiveTeamPlan>;
  droppedWeapons:DroppedWeapon[];
  bomb:{status:'carried'|'dropped'|'planted'|'defused'|'exploded';x:number;z:number;remaining:number;site?:'A'|'B'};
  learning?:FpsLearningStats;mechanicsLearning?:FpsMechanicsStats;
}
const other=(team:FpsTeamId):FpsTeamId=>team==='blue'?'red':'blue';
const clamp=(x:number,min:number,max:number)=>Math.max(min,Math.min(max,x));
const localHash=(text:string)=>{let h=2166136261;for(let i=0;i<text.length;i++)h=Math.imul(h^text.charCodeAt(i),16777619);return(h>>>0).toString(16).padStart(8,'0');};
const angle=(a:number)=>Math.atan2(Math.sin(a),Math.cos(a));
const heading=(a:FpsPoint,b:FpsPoint)=>Math.atan2(b.x-a.x,b.z-a.z);

/** Browser-local live exhibition. Never creates an official match report or career write. */
export class FpsLiveSimulation {
  private actors:Actor[];
  private identity:FpsIdentityExperiment;
  private randomState:number;
  private tickNumber=0;
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
  private events:LiveEvent[]=[];
  private shots:LiveShot[]=[];
  private smokes:LiveSmoke[]=[];
  private fires:LiveFire[]=[];
  private blasts:LiveBlast[]=[];
  private droppedWeapons:DroppedWeapon[]=[];
  private reports:{team:FpsTeamId;at:number;source:string;contact:LiveIntelContact}[]=[];
  private informationOrders:Record<FpsTeamId,LiveInformationOrder>={blue:{mode:'hold',responders:[],until:0,strength:0,reason:'Hold the opening setup'},red:{mode:'hold',responders:[],until:0,strength:0,reason:'Gather information in the default'}};
  private planCommit=0;
  private nextInformationProbe:Record<FpsTeamId,number>={blue:0,red:0};
  private roundSiteKills:Record<FpsTeamId,number>={blue:0,red:0};
  private eliminations:{killer:string;victim:string;team:FpsTeamId;at:number;traded:boolean}[]=[];
  private protocol!:LiveAttackProtocol;
  private roundHistory:LiveRoundHistory[]=[];
  private tacticArchetype:LiveTacticArchetype='default_pick';
  private defenseSetup:LiveDefenseSetup='standard';
  private grenades:LiveGrenade[]=[];
  private audioCues:FpsAudioCue[]=[];
  private noiseMasks:{x:number;z:number;until:number;radius:number}[]=[];
  private teamBuys:Record<FpsTeamId,{mode:LiveBuyMode;reason:string}>={blue:{mode:'pistol',reason:''},red:{mode:'pistol',reason:''}};
  private pendingBuys=new Map<string,LiveBuyPlayer>();
  private detailed:boolean;
  private observationRandom:()=>number;
  private executionRandom:()=>number;
  private worldRandom:()=>number;
  private learner?:FpsLiveLearner;
  private mechanicsLearner?:FpsLiveMechanicsLearner;
  private learningRandom:()=>number;
  private mechanicsRandom:()=>number;
  private learningEpisode='';
  private learningPlansRemaining=1;

  constructor(blue:PlayerCard[],red:PlayerCard[],seed:number,identity:FpsIdentityExperiment,options:LiveSimulationOptions={}) {
    if(blue.length!==5 || red.length!==5 || new Set([...blue,...red].map(p=>p.id)).size!==10) throw Error('A live exhibition needs ten distinct players.');
    if(!Number.isInteger(seed) || seed<1 || seed>2147483647) throw Error('Invalid exhibition seed.');
    this.identity=hydrateFpsIdentityContext(identity,[...blue,...red].map(p=>p.id));
    this.randomState=seed;
    this.detailed=options.skillProfiles!==undefined;
    if(options.skillProfiles&&Object.keys(options.skillProfiles).length!==10)throw Error('Detailed exhibitions require exactly ten versioned skill profiles.');
    this.observationRandom=this.detailed?fpsSkillRandom(seed,'observation-v1'):this.random;
    this.executionRandom=this.detailed?fpsSkillRandom(seed,'execution-v1'):this.random;
    this.worldRandom=this.detailed?fpsSkillRandom(seed,'world-v1'):this.random;
    this.learningRandom=fpsSkillRandom(seed,'navigation-learning-v1');
    this.mechanicsRandom=fpsSkillRandom(seed,'combat-mechanics-learning-v1');
    if(options.learning)this.learner=new FpsLiveLearner(options.learning);
    if(options.mechanicsLearning)this.mechanicsLearner=new FpsLiveMechanicsLearner(options.mechanicsLearning);
    const learningState=[this.learner?fpsLearningModelHash(this.learner.initial):'',this.mechanicsLearner?localHash(JSON.stringify(this.mechanicsLearner.initial)): ''].join(':');
    this.learningEpisode=`${seed}:${localHash(learningState)}`;
    this.actors=[...blue,...red].map<Actor>((card,index)=>({
      id:card.id,name:card.name,team:index<5?'blue':'red',attacking:index>=5,role:'trade',slot:index%5,
      x:0,z:0,yaw:0,pitch:0,hp:100,armor:0,cash:800,weapon:'pistol',ammo:12,reserve:60,reload:0,reloadDuration:0,reloadSilent:false,reloadRounds:0,
      kills:0,deaths:0,action:'Buying',bomb:false,kit:false,flash:0,smoke:0,incendiary:0,he:0,blinded:0,channel:0,
      personality:this.identity.players[card.id].personality.name,specialty:this.identity.players[card.id].specialty?.name,
      reaction:.45-clamp((card.stats.iq??50)/100,0,1)*.2,
      skills:liveSkills(card.stats),exertion:0,callout:'Harbor gates',intent:'Prepare the round',
      impact:emptyLiveImpact(),engagementShots:0,engagementDamaged:false,openingAttempted:false,
      speed:0,stance:'hold',crouch:false,crouchUntil:0,vx:0,vz:0,nextFootstep:0,nextAudioFootstep:0,nextPeek:0,cleared:new Set(),clearUntil:0,lookAwayUntil:0,
      jump:false,jumpY:0,jumpVy:0,nextJump:0,jumpQueued:false,jumpChain:0,strafeDirection:1,strafeUntil:0,glockBurstRemaining:0,
      equipped:'pistol',weaponReady:0,lastSwing:-100,reactionVariation:1,equipUntil:0,
      information:'No current contact — watch the assigned angle',intel:emptyLiveIntel(),intelManaged:false,sentReports:new Map(),
      profile:options.skillProfiles?pinFpsSkillProfile(options.skillProfiles[card.id],card.id):undefined,
      motor:emptyFpsSkillDiagnostics(),mentalState:{setback:0,attentionDebt:0,exertion:0},patterns:[],pendingCues:[],recoil:0,preparedError:0,
      noticedEnemies:[],probeVisited:new Set(),knownSmokes:[],
      acquired:0,nextShot:0,nextThink:0,decision:'prepare',path:[],contactAt:-100,
      lastMoved:-100,lastShot:-100,utilityAt:0,damageAt:-100,
      seenAt:-100,nextSense:0,burst:0,pressure:0,retreatUntil:0,reportAt:-100,stuckFor:0,
    }));
    // Role assignment uses skills and persistent requested roles, never a personality power rating.
    for(const team of ['blue','red'] as const) {
      const cards=team==='blue'?blue:red, available=this.actors.filter(p=>p.team===team);
      for(const p of [...available]) {
        const role=this.identity.players[p.id].assignedRole;
        if(role){p.role=role;available.splice(available.indexOf(p),1);}
      }
      for(const role of ['entry','support','sniper','lurker','trade'] as FpsPrimaryRole[]) {
        if(!available.length || this.actors.some(p=>p.team===team && !available.includes(p) && p.role===role))continue;
        const definition=FPS_ROLES.find(r=>r.id===role)!;
        const rating=(p:Actor)=>p.profile?fpsDetailedRoleFit(p.profile,role)*10:Object.entries(definition.weights).reduce((sum,[key,weight])=>sum+(cards.find(c=>c.id===p.id)!.stats[key as keyof PlayerCard['stats']]??50)*weight!,0);
        available.sort((a,b)=>rating(b)-rating(a)||a.slot-b.slot);
        available.shift()!.role=role;
      }
    }
    this.startRound();
  }

  private random=()=>{
    let n=this.randomState+=0x6D2B79F5;
    n=Math.imul(n^(n>>>15),n|1);n^=n+Math.imul(n^(n>>>7),n|61);
    return ((n^(n>>>14))>>>0)/4294967296;
  };
  private skill(p:Actor,key:FpsAbility,legacy:number):number {return p.profile?fpsAbilityUnit(p.profile,key):legacy;}
  private reactionDelay(p:Actor):number {return p.profile?detailedReactionDelay(p.profile):liveReactionTime(p.skills,p.pressure,p.exertion);}
  private emit(kind:LiveEvent['kind'],text:string,team?:FpsTeamId,actorId?:string,targetId?:string,headshot?:boolean,weapon?:LiveEquippedWeapon) {
    this.events.push({id:++this.sequence,time:this.time,kind,text,team,actorId,targetId,headshot,weapon});
    if(this.events.length>100)this.events.shift();
  }
  private startRound() {
    this.learner?.abandonRound();
    this.mechanicsLearner?.abandonRound();
    this.phase='freeze';this.remaining=15;this.liveElapsed=0;this.roundWinner=undefined;this.roundReason='';
    // Regulation: Red attacks in 1..15, Blue attacks in 16..30 (side swap). Overtime MR3 swaps every 3 rounds.
    this.attackTeam=this.round<=30?(this.round<=15?'red':'blue'):((Math.floor((this.round-31)/3)%2)===0?'red':'blue');
    const reset=this.round===16 || (this.round>=31 && (this.round-31)%3===0);
    
    // Adaptive strategy selection from round history
    // Defenders can adapt to confirmed plants, not the opponents' unexecuted calls.
    const recentAttacks=this.roundHistory.filter(h=>h.attackTeam===this.attackTeam&&h.bombPlanted).slice(-4);
    const bAttacks=recentAttacks.filter(h=>h.attackSite==='B').length;
    const aAttacks=recentAttacks.filter(h=>h.attackSite==='A').length;
    const isPistol=this.round===1||this.round===16;
    const archetype=chooseLiveTactic(this.roundHistory,this.attackTeam,isPistol,this.worldRandom);
    this.tacticArchetype=archetype;
    if(archetype==='rush_a'||archetype==='split_a')this.site='A';
    else if(archetype==='rush_b'||archetype==='split_b')this.site='B';
    else if(archetype==='fake_execute')this.site='B';
    else this.site=this.worldRandom()<.5?'A':'B';

    let defenseSetup:LiveDefenseSetup='standard';
    if(bAttacks>=2)defenseSetup='stack_b';
    else if(aAttacks>=2)defenseSetup='stack_a';
    else if(recentAttacks.length>0){
      defenseSetup=this.worldRandom()<.5?'aggressive_banana':'mid_push';
    } else defenseSetup='standard';
    this.defenseSetup=defenseSetup;

    this.nextInformationProbe={blue:this.time+25,red:this.time+25};
    this.smokes=[];this.fires=[];this.blasts=[];this.shots=[];this.noiseMasks=[];this.reports=[];this.droppedWeapons=[];this.pendingBuys.clear();this.planCommit=0;this.roundSiteKills={blue:0,red:0};this.eliminations=[];this.grenades=[];
    if(reset)this.losses={blue:0,red:0};
    for(const p of this.actors) {
      p.attacking=p.team===this.attackTeam;
      if(reset){p.cash=this.round>=31?10000:800;p.weapon=p.attacking?'glock':'usp_s';p.armor=0;p.kit=false;p.flash=0;p.smoke=0;p.incendiary=0;p.he=0;}
      if(p.hp<=0){p.weapon=p.attacking?'glock':'usp_s';p.armor=0;p.kit=false;p.flash=0;p.smoke=0;p.incendiary=0;p.he=0;}
      if(p.attacking) {
        const spawn=LIVE_FPS_MAP.spawns.attackers;
        p.x=spawn.x+(p.slot-2)*2.2;
        p.z=spawn.z-(p.slot%2)*1.4;
        p.yaw=0;
      } else {
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
        p.yaw=Math.PI;
      }
      p.freezeDelay=p.slot*0.08;
      p.isBoosted=false;
      p.boostSpot=undefined;
      p.approachUntil=0;p.radioAt=-100;p.acknowledgedOrder=undefined;p.strafeSettleUntil=0;p.knownSmokes=[];p.flashWindow=undefined;p.lookAwayStarts=undefined;p.smokeLineupGoal=undefined;
      p.routeEvidence=undefined;p.routeUpdatedAt=undefined;p.objectiveUrgent=false;
      if(reset)p.patterns=[];
      p.fakeDefuseDone=false;
      p.halfDefuseDone=false;
      p.fakeDefuseHoldUntil=undefined;
      p.fakePlantDone=false;
      p.fakePlantHoldUntil=undefined;
      p.triggerDisciplineUntil=undefined;
      if(!this.identity.players[p.id].assignedRole){if(!p.attacking&&p.role==='entry')p.role='anchor';else if(p.attacking&&p.role==='anchor')p.role='entry';}
      p.hp=100;p.reload=0;p.reloadDuration=0;p.reloadSilent=false;p.reloadRounds=0;p.blinded=0;p.channel=0;p.bomb=false;p.path=[];p.goal=undefined;p.contact=undefined;
      p.target=undefined;p.flashedBy=undefined;p.nextThink=this.time;p.nextShot=this.time;p.contactAt=-100;p.lastMoved=-100;p.lastShot=-100;
      p.nextSense=this.time;p.seenAt=-100;p.burst=0;p.pressure=0;p.retreatUntil=0;p.reportAt=-100;p.stuckFor=0;
      p.watchPoint=undefined;p.aimFocus=undefined;p.exertion=p.profile?p.mentalState.exertion:0;p.intent='Prepare the round';
      p.engagementShots=0;p.engagementDamaged=false;p.openingAttempted=false;
      p.vx=0;p.vz=0;p.speed=0;p.stance='hold';p.crouch=false;p.crouchUntil=0;p.peek=undefined;p.nextPeek=this.time+17;p.nextFootstep=0;p.nextAudioFootstep=0;
      p.jump=false;p.jumpY=0;p.jumpVy=0;p.nextJump=this.time+16+this.executionRandom()*3;p.jumpQueued=false;p.jumpChain=0;p.strafeDirection=1;p.strafeUntil=0;p.glockBurstRemaining=0;
      p.cleared.clear();p.clearUntil=0;p.clearPoint=undefined;p.lookAwayUntil=0;p.lookAwayPoint=undefined;p.probeGoal=undefined;p.probeVisited.clear();p.holdingSince=undefined;p.utilityPreparation=undefined;p.throwAt=undefined;p.throwKind=undefined;
      p.utilityAt=this.time+15;p.throwAt=undefined;p.throwKind=undefined;p.damageAt=-100;p.action='Buying';p.decision='prepare';
      p.buyAt=this.time+0.8+p.slot*.72+(p.team==='red'?.18:0);
      p.aimPoint=undefined;p.reactionVariation=1;p.swingAt=undefined;p.lastSwing=-100;p.equipUntil=0;p.weaponReady=0;
      p.intel=emptyLiveIntel();p.intelManaged=false;p.sentReports.clear();p.information='No current contact — watch the assigned angle';
      p.pendingCues=[];p.recoil=0;p.brakeAt=undefined;p.preparedError=0;p.previousSight=undefined;p.trackingPoint=undefined;p.planAssessmentAt=undefined;p.visualCueAt=undefined;p.noticedEnemies=[];
    }
    for(const team of ['blue','red'] as const) {
      const result=buyLiveTeam(this.actors.filter(p=>p.team===team),this.identity.teams[team].plan,this.round,this.losses[team],this.score[other(team)]>=15||this.round===15||this.round===30);
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
    const carrier=this.actors.find(p=>p.attacking&&p.role==='support')??this.actors.find(p=>p.attacking)!;
    carrier.bomb=true;this.bomb={status:'carried',x:carrier.x,z:carrier.z,remaining:40};
    this.emit('round',`Round ${this.round} · buy phase`,this.attackTeam);
  }

  private updateProtocol() {
    const phase:LiveAttackPhase=this.bomb.status==='planted'?'post-plant'
      :this.actors.some(p=>p.attacking&&p.hp>0&&(p.target!==undefined||distance(p,LIVE_FPS_MAP.sites[this.site])<16))?'entry':'default';
    if(phase!==this.protocol.phase){this.protocol.phase=phase;this.protocol.phaseAt=this.time;}
  }
  private inImmediateFight(p:Actor):boolean {
    if(this.time-p.damageAt<1.35)return true;
    const selected=this.actors.find(enemy=>enemy.id===p.target&&enemy.team!==p.team&&enemy.hp>0);
    if(selected&&distance(p,selected)<22&&(this.visible(p,selected,false)||this.time-p.acquired<1.2))return true;
    return this.actors.some(enemy=>enemy.team!==p.team&&enemy.hp>0&&distance(p,enemy)<22&&this.visible(p,enemy,false));
  }
  private previewUtility(p:Actor,kind:LiveGrenadeKind,target:FpsPoint,style:LiveThrowStyle,equipDelay=.55):LiveGrenade {
    const releaseAt=this.time+equipDelay+.2;
    const momentum={x:0,z:0};
    return predictLiveGrenade(launchLiveGrenade(-1,kind,p.id,p.team,p,target,releaseAt,false,style,1.55+(p.jumpY??0),momentum),releaseAt);
  }
  private safeUtilitySetup(p:Actor,kind:LiveGrenadeKind,forecast:LiveGrenade):boolean {
    const allies=this.actors.filter(a=>a.team===p.team&&a.hp>0);
    if(kind==='flash'&&allies.some(a=>a.channel>0&&distance(a,forecast)<LIVE_UTILITY_RULES.flashRadius
      &&liveGrenadeSightline(forecast,{x:a.x,y:(a.crouch?1.08:1.6)+(a.jumpY??0),z:a.z})))return false;
    const hazardRadius=kind==='he'?LIVE_HE_RULES.damageRadius:kind==='incendiary'?LIVE_UTILITY_RULES.fireRadius:0;
    if(hazardRadius>0&&allies.some(a=>distance(a,forecast)<hazardRadius))return false;
    return true;
  }
  private prepareFlashTeam(p:Actor,forecast:LiveGrenade):void {
    for(const ally of this.actors.filter(a=>a.team===p.team&&a.hp>0&&distance(a,forecast)<22)){
      const delay=.12+(1-this.skill(p,'communication',p.skills.teamwork))*.3;
      ally.lookAwayStarts=Math.max(this.time+delay,forecast.detonateAt-.35);ally.lookAwayUntil=forecast.detonateAt+.05;ally.lookAwayPoint={x:forecast.x,z:forecast.z};
      if(ally!==p){
        const release=.08+(1-this.skill(ally,'coordination',ally.skills.teamwork))*.35;
        ally.flashWindow={point:{x:forecast.x,z:forecast.z},opens:forecast.detonateAt+release,expires:forecast.detonateAt+1.15};
        if(ally.profile)ally.motor.entryReleaseDelay=release;
      }
    }
  }
  private throwUtility(p:Actor,kind:LiveGrenadeKind,target:FpsPoint):boolean {
    if(p.utilityPreparation)return p.utilityPreparation.kind===kind;
    if(p.hp<=0||p.reload>0||this.time<p.utilityAt||distance(p,target)>40||p[kind]<=0||this.inImmediateFight(p))return false;
    if(kind==='smoke'&&(p.knownSmokes.some(s=>s.expires>this.time+2&&distance(s,target)<s.radius)||this.grenades.some(g=>g.team===p.team&&g.kind==='smoke'&&distance(predictLiveGrenade(g,this.time),target)<3)))return false;
    const blockedThrow=!liveSightline(p,target);
    const throwStyle:LiveThrowStyle=p.jump&&p.crouch?'crouch-jump':p.jump?'jump':p.crouch?'crouch':p.speed>2.5?'running-bounce':p.speed>.65?'walk':distance(p,target)<6?'underhand':distance(p,target)<13?'medium':blockedThrow?'banked':distance(p,target)>24?'overhead':'step';
    if(p.profile){const desired=target;target=detailedThrowPoint(p.profile,p,target,this.executionRandom);p.motor.throws++;p.motor.throwErrorSum+=distance(desired,target);}
    const forecast=this.previewUtility(p,kind,target,throwStyle);
    if(!this.safeUtilitySetup(p,kind,forecast))return false;
    p.utilityPreparation={kind,target:{...target},startedAt:this.time,readyAt:this.time+.55,throwStyle};
    p.throwKind=kind;p.equipped=kind;p.weaponReady=.55;p.equipUntil=this.time+1.2;p.action=`Setting up ${kind}`;p.intent='Equip utility, check teammates, then release';
    if(kind==='flash')this.prepareFlashTeam(p,forecast);
    this.radio(p,kind==='flash'?`Flash setup - turn away, swing on the pop!`:`Preparing ${kind} for ${liveCallout(forecast)} - hold the lane.`);
    this.emit('utility',`${p.name} equips ${kind}`,p.team,p.id);
    return true;
  }
  private cancelUtilityPreparation(p:Actor):void {
    p.utilityPreparation=undefined;p.throwKind=undefined;p.throwAt=undefined;p.equipUntil=this.time;
    this.equip(p,p.weapon);p.weaponReady=0;p.action='Cancelling utility setup';
  }
  private releaseUtilityPreparation(p:Actor):void {
    const preparation=p.utilityPreparation;if(!preparation)return;
    if(p.hp<=0||p[preparation.kind]<=0||this.inImmediateFight(p)){this.cancelUtilityPreparation(p);return;}
    const forecast=this.previewUtility(p,preparation.kind,preparation.target,preparation.throwStyle,0);
    if(!this.safeUtilitySetup(p,preparation.kind,forecast)){this.cancelUtilityPreparation(p);return;}
    const target=preparation.target,kind=preparation.kind,releaseAt=this.time+.2;
    p.utilityPreparation=undefined;p[kind]--;p.utilityAt=this.time+8;p.throwAt=this.time;p.throwKind=kind;
    p.equipped=kind;p.weaponReady=.65;p.equipUntil=this.time+.65;
    const handPoint={x:p.x+Math.sin(p.yaw)*.2+Math.cos(p.yaw)*.16,z:p.z+Math.cos(p.yaw)*.2-Math.sin(p.yaw)*.16};
    const grenade=launchLiveGrenade(++this.sequence,kind,p.id,p.team,handPoint,target,releaseAt,false,preparation.throwStyle,1.55+(p.jumpY??0),{x:0,z:0});
    this.grenades.push(grenade);
    const landing=predictLiveGrenade(grenade,this.time);
    if(kind==='flash')this.prepareFlashTeam(p,landing);
    this.radio(p,kind==='flash'?`Flash for ${liveCallout(landing)} - turn, swing on the pop!`:kind==='smoke'?`Smoke for ${liveCallout(landing)} - blocks vision, keep watching the edges.`:kind==='he'?`HE for ${liveCallout(landing)} - clear the position, watch the blast!`:`Fire for ${liveCallout(landing)} - deny the crossing!`);
    this.emit('utility',`${p.name} throws ${kind}`,p.team,p.id);
  }
  private disturbSmoke(smoke:LiveSmoke,strength:number,until:number) {
    smoke.disturbance=Math.max(smoke.disturbance??0,strength);
    smoke.disturbedUntil=Math.max(smoke.disturbedUntil??0,until);
  }
  private disturbSmokesAlongShot(from:FpsPoint,to:FpsPoint) {
    const dx=to.x-from.x,dz=to.z-from.z,length2=dx*dx+dz*dz||1;
    for(const smoke of this.smokes){
      const t=clamp(((smoke.x-from.x)*dx+(smoke.z-from.z)*dz)/length2,0,1);
      const closest={x:from.x+dx*t,z:from.z+dz*t};
      if(distance(smoke,closest)<=smoke.radius+.35)this.disturbSmoke(smoke,LIVE_HE_RULES.shotSmokeDisturbance,this.time+.72);
    }
  }
  private extinguishFire(point:FpsPoint) {
    const count=this.fires.filter(fire=>distance(point,fire)<=LIVE_HE_RULES.smokeClearanceRadius).length;
    if(!count)return;
    this.fires=this.fires.filter(fire=>distance(point,fire)>LIVE_HE_RULES.smokeClearanceRadius);
    this.emit('utility',`Smoke extinguishes ${count===1?'incendiary fire':`${count} incendiary zones`}`);
  }
  private beginReload(p:Actor) {
    const weapon=LIVE_WEAPONS[p.weapon];
    if(p.reload>0||p.reserve<=0||p.ammo>=weapon.magazine)return;
    const nearbyEnemy=this.actors.some(a=>a.team!==p.team&&a.hp>0&&distance(a,p)<20);
    const visiblePressure=this.actors.some(a=>a.team!==p.team&&a.hp>0&&distance(a,p)<20&&this.visible(p,a,false));
    const livingAllies=this.actors.filter(a=>a.team===p.team&&a.hp>0).length;
    const livingEnemies=this.actors.filter(a=>a.team!==p.team&&a.hp>0).length;
    const clutch=livingAllies<=1&&livingEnemies<=2;
    const silent=!visiblePressure&&(clutch||nearbyEnemy||p.role==='lurker');
    p.reloadRounds=Math.min(weapon.magazine,p.reserve);
    p.reserve-=p.reloadRounds;
    p.ammo=0;
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
      if(flightEnd>flightStart)stepLiveGrenade(grenade,flightEnd-flightStart);
      if(this.time<grenade.detonateAt)continue;
      // Sample the detonation cue before its new smoke/flash blocks the observer's perception.
      const cueObservers=this.actors.filter(a=>a.team!==grenade.team&&a.hp>0&&distance(a,grenade)<24&&this.observablePoint(a,grenade));
      if(grenade.kind==='smoke'){
        this.smokes.push({id:grenade.id,x:grenade.x,z:grenade.z,y:grenade.y+1.35,startedAt:this.time,radius:.35,expires:this.time+LIVE_UTILITY_RULES.smokeDuration});
        this.extinguishFire(grenade);
      } else if(grenade.kind==='incendiary'){
        const coveredBySmoke=this.smokes.some(smoke=>distance(smoke,grenade)<LIVE_HE_RULES.smokeClearanceRadius);
        if(!coveredBySmoke)this.fires.push({id:grenade.id,ownerId:grenade.actorId,team:grenade.team,x:grenade.x,z:grenade.z,startedAt:this.time,nextDamageAt:this.time+.25,radius:.55,expires:this.time+LIVE_UTILITY_RULES.fireDuration});
      } else if(grenade.kind==='flash') {
        for(const actor of this.actors.filter(a=>a.hp>0)) {
          const eyeY=(actor.crouch?1.08:1.6)+(actor.jumpY??0);
          const range=Math.hypot(distance(actor,grenade),grenade.y-eyeY);
          if(range>=LIVE_UTILITY_RULES.flashRadius||!liveGrenadeSightline(grenade,{x:actor.x,y:eyeY,z:actor.z}))continue;
          const facing=Math.cos(angle(heading(actor,grenade)-actor.yaw));
          const duration=(facing>0?LIVE_UTILITY_RULES.flashFacingDuration:LIVE_UTILITY_RULES.flashTurnedDuration)*Math.max(.25,1-range/16);
          if(duration>=actor.blinded){actor.blinded=duration;actor.flashedBy=grenade.actorId;}
        }
      } else {
        this.blasts.push({id:grenade.id,x:grenade.x,z:grenade.z,startedAt:this.time,endsAt:this.time+.48,radius:LIVE_HE_RULES.damageRadius});
        for(const smoke of this.smokes)if(distance(smoke,grenade)<smoke.radius+LIVE_HE_RULES.smokeClearanceRadius)
          this.disturbSmoke(smoke,LIVE_HE_RULES.smokeDisturbance,this.time+LIVE_HE_RULES.smokeDisturbance);
        const owner=this.actors.find(actor=>actor.id===grenade.actorId);
        if(owner)for(const actor of this.actors.filter(a=>a.hp>0)){
          const eyeY=(actor.crouch?1.08:1.6)+(actor.jumpY??0);
          const range=Math.hypot(distance(actor,grenade),grenade.y-eyeY);
          if(range>=LIVE_HE_RULES.damageRadius)continue;
          let damage=LIVE_HE_RULES.maxDamage*Math.pow(1-range/LIVE_HE_RULES.damageRadius,.55);
          if(!liveGrenadeSightline(grenade,{x:actor.x,y:eyeY,z:actor.z}))damage*=LIVE_HE_RULES.wallDamageScale;
          if(actor.armor>0)damage*=.78;
          const friendlyScale=actor.team===grenade.team?(actor.id===owner.id?LIVE_FRIENDLY_FIRE_RULES.selfUtilityDamageScale:LIVE_FRIENDLY_FIRE_RULES.teammateUtilityDamageScale):1;
          this.damage(owner,actor,damage,false,'he',false,undefined,friendlyScale);
        }
      }
      this.emit('utility',`${grenade.kind==='flash'?'Flash detonates':grenade.kind==='smoke'?'Smoke blooms':grenade.kind==='he'?'HE explodes':'Incendiary spreads'} · ${liveCallout(grenade)}`,grenade.team,grenade.actorId);
      // A visible/audible hostile utility cue suggests pressure, never an identified enemy count.
      for(const listener of cueObservers){
        this.observeIntel(listener,
          {key:`utility:${Math.round(grenade.x/6)}:${Math.round(grenade.z/6)}`,observerId:listener.id,source:'utility',
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
    this.smokes=this.smokes.filter(s=>s.expires>this.time);
    for(const smoke of this.smokes){
      const spread=Math.min(1,Math.max(0,(this.time-smoke.startedAt)/LIVE_UTILITY_RULES.smokeSpread));
      const fade=Math.min(1,Math.max(0,(smoke.expires-this.time)/1.5));
      const disturbance=(smoke.disturbedUntil??0)>this.time?(smoke.disturbance??0)*Math.min(1,((smoke.disturbedUntil??this.time)-this.time)/1.1):0;
      smoke.disturbance=disturbance;
      smoke.radius=LIVE_UTILITY_RULES.smokeRadius*spread*fade*Math.max(0,1-.72*disturbance);
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
        Object.assign(p,{cash:buy.cash,weapon:buy.weapon,armor:buy.armor,kit:buy.kit,
          flash:buy.flash,smoke:buy.smoke,incendiary:buy.incendiary,he:buy.he});
        p.ammo=LIVE_WEAPONS[p.weapon].magazine;p.reserve=LIVE_WEAPONS[p.weapon].reserve;
        p.equipped=p.weapon;p.buyAt=undefined;p.action='Checking equipment';this.pendingBuys.delete(p.id);
        this.emit('economy',`${p.name} finished buying ${LIVE_WEAPONS[p.weapon].name}${p.armor?' · armor':''}${p.kit?' · defuse kit':''}`,p.team,p.id,undefined,undefined,p.weapon);
      }
    }
    if(this.phase==='freeze' || this.phase==='post') {
      for(const p of this.actors)if(p.profile){p.mentalState=tickFpsMentalState(p.profile,p.mentalState,dt,0,false,0);p.exertion=p.mentalState.exertion;}
      if(this.phase==='post')this.stepPostRound(dt);
      this.remaining=Math.max(0,this.remaining-dt);
      if(this.remaining<1e-8) {
        if(this.phase==='freeze'){this.phase='live';this.remaining=115;this.roundLiveAt=this.time;this.emit('round','Round live');}
        else {this.round++;this.startRound();}
      }
      return;
    }
    this.liveElapsed+=dt;
    this.noiseMasks=this.noiseMasks.filter(mask=>mask.until>this.time);
    this.updateProtocol();
    for(const actor of this.actors)if(actor.utilityPreparation)this.releaseUtilityPreparation(actor);
    this.stepGrenades(dt);
    for(const fire of this.fires){
      if(this.time<fire.nextDamageAt)continue;
      fire.nextDamageAt=this.time+.25;
      const owner=this.actors.find(p=>p.id===fire.ownerId);
      if(!owner)continue;
      for(const target of this.actors){
        if(target.hp<=0||distance(target,fire)>fire.radius)continue;
        const friendlyScale=target.team===fire.team?(target.id===owner.id?LIVE_FRIENDLY_FIRE_RULES.selfUtilityDamageScale:LIVE_FRIENDLY_FIRE_RULES.teammateUtilityDamageScale):1;
        this.damage(owner,target,LIVE_UTILITY_RULES.fireDamagePerSecond*.25,false,'incendiary',false,undefined,friendlyScale);
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
    if(this.bomb.status==='planted')this.bomb.remaining=Math.max(0,this.bomb.remaining-dt);
    else this.remaining=Math.max(0,this.remaining-dt);
    // Rotate update order to avoid giving the same slot every simultaneous shot advantage.
    const start=this.tickNumber%this.actors.length;
    for(let n=0;n<this.actors.length;n++) {
      const p=this.actors[(start+n)%this.actors.length];
      if(p.hp<=0)continue;
      if(p.profile){
        p.mentalState=tickFpsMentalState(p.profile,p.mentalState,dt,p.speed,!!p.target,Math.min(this.liveElapsed,this.time-Math.max(p.seenAt,p.contactAt)));p.exertion=p.mentalState.exertion;
        p.recoil=advanceDetailedRecoil(p.recoil,p.profile,dt);
        const available=this.actors.some(t=>t.team!==p.team&&t.hp>0&&this.visible(p,t));
        if(available&&p.visualCueAt===undefined)p.visualCueAt=this.time;
        if(!available)p.visualCueAt=undefined;
        for(const cue of p.pendingCues.filter(c=>c.at<=this.time))this.observeIntel(p,cue.contact);
        p.pendingCues=p.pendingCues.filter(c=>c.at>this.time);
      }else p.exertion=clamp(p.exertion+(p.speed>2.5?.025:p.speed>.2?.008:-.06)*dt,0,1);
      if(!p.isBoosted && (p.jump || p.jumpY>0)){
        const wasAirborne=p.jumpY>0;
        const jumpState=advanceLiveJump({jump:p.jump,jumpY:p.jumpY,jumpVy:p.jumpVy},dt);
        p.jump=jumpState.jump;p.jumpY=jumpState.jumpY;p.jumpVy=jumpState.jumpVy;
        if(wasAirborne&&!p.jump&&p.jumpChain>0&&p.jumpChain<3)p.jumpQueued=true;
        if(wasAirborne&&!p.jump&&p.jumpChain>=3){p.jumpChain=0;p.jumpQueued=false;}
        if(p.jump)p.stance='jump';
        if(p.jump&&p.jumpVy<0&&p.jumpY<.55&&(p.peek?.style==='crouch-swing'||p.jumpQueued))p.crouch=true;
      }
      if(this.time-p.lastShot>.55)p.burst=0;
      p.blinded=Math.max(0,p.blinded-dt);
      p.weaponReady=Math.max(0,p.weaponReady-dt);
      if(p.swingAt!==undefined&&this.time>=p.swingAt){p.swingAt=undefined;if(p.equipped==='knife'&&p.blinded<.2)this.strikeKnife(p);}
      if(p.reload>0){p.reload=Math.max(0,p.reload-dt);if(p.reload===0){p.ammo=p.reloadRounds;p.reloadRounds=0;p.reloadSilent=false;}}
      if(p.throwAt!==undefined&&this.time-p.throwAt>.65){p.throwAt=undefined;p.throwKind=undefined;}
      if((p.equipped==='flash'||p.equipped==='smoke'||p.equipped==='incendiary'||p.equipped==='he')&&this.time>=p.equipUntil){this.equip(p,p.weapon);}
      if(this.time>=p.nextSense){this.perceive(p);p.nextSense=this.time+(p.profile?detailedSenseInterval(p.profile,p.mentalState):.12+(1-p.skills.gameSense)*.18);}
      if(this.time>=p.nextThink){this.decide(p);p.nextThink=this.time+(p.profile?.55+(1-this.skill(p,'decisionMaking',p.skills.gameSense))*.55:liveDecisionInterval(p.skills));}
      if(p.utilityPreparation){
        p.channel=0;this.applyMotion(p,{x:0,z:0},dt,'brake');p.action=`Equipping ${p.utilityPreparation.kind}`;
        continue;
      }
      const target=this.actors.find(t=>t.id===p.target&&t.hp>0);
      this.chooseEquipment(p,target);
      const urgentChannel=!p.attacking&&p.channel>0&&this.time-p.damageAt>.4&&this.bomb.remaining<(p.kit?7:12);
      const plantOpportunity=p.bomb&&this.bomb.status==='carried'&&livePlantSite(p)!==undefined;
      if(plantOpportunity||p.channel>0)this.learner?.close(p,this.time);
      if((plantOpportunity||urgentChannel)&&this.objective(p,dt))continue;
      if(target && this.visible(p,target,false)) {
        this.learner?.close(p,this.time);
        if(p.profile&&this.time-p.acquired<p.reaction){this.applyMotion(p,{x:p.vx,z:p.vz},dt,p.stance);p.action='Responding to contact';continue;}
        if(p.profile&&p.motor.responseAt<p.acquired)p.motor.responseAt=this.time;
      p.channel=0;p.action=p.reload>0?(p.reloadSilent?'Silent reloading':'Reloading'):'Engaging';
        if(p.equipped==='knife') {
          const d=distance(p,target),aim=p.profile?(p.trackingPoint??p.aimPoint??p.contact??p):(p.aimPoint??p.contact??p);
          this.turn(p,heading(p,aim));
          // Empty guns permit a nearby last-resort attack, never a map-wide knife charge.
          if(d>1.05&&d<2.2&&p.ammo===0&&p.reserve===0)this.applyMotion(p,{x:(aim.x-p.x)/(distance(p,aim)||1)*LIVE_WALK_SPEED,z:(aim.z-p.z)/(distance(p,aim)||1)*LIVE_WALK_SPEED},dt,'peek');
          else this.applyMotion(p,{x:0,z:0},dt,'brake');
          p.action=p.weaponReady>0?'Drawing knife':'Knife ready';
          if(d<LIVE_KNIFE.reach+.25&&p.weaponReady===0&&this.time>=p.nextShot&&this.time-p.acquired>=p.reaction&&Math.abs(angle(heading(p,aim)-p.yaw))<.25){
            p.lastSwing=this.time;p.swingAt=this.time+LIVE_KNIFE.windup;p.nextShot=this.time+LIVE_KNIFE.interval;p.action='Knife swing';
          }
          continue;
        }
        if(p.ammo===0 && p.reserve>0 && !p.reload){this.beginReload(p);p.nextThink=this.time;}
        if(p.crouch&&this.time>p.crouchUntil&&p.burst===0)p.crouch=false;
        if(p.burst>=2 && LIVE_WEAPONS[p.weapon].category!=='pistol') {
          p.crouch=true;
          p.crouchUntil=this.time+0.6;
        }
        const blockedByAlly=this.actors.some(a=>a!==p&&a.team===p.team&&a.hp>0&&distance(p,a)<distance(p,target)&&this.segmentNear(p,target,a)<.55);
        if(p.peek&&(p.peek.back||this.time-p.acquired>p.reaction+.3&&(p.hp<55||p.decision!=='pressure'))){
          p.peek.back=true;this.move(p,dt,true);p.action='Returning behind cover';
        }else if(blockedByAlly && !p.reload){
          const side=p.slot%2===0?1:-1,dx=target.x-p.x,dz=target.z-p.z,d=Math.hypot(dx,dz)||1;
          this.applyMotion(p,{x:dz/d*side*2,z:-dx/d*side*2},dt,'peek');
          p.action='Clearing the firing lane';
        } else if(p.retreatUntil>this.time || p.reload>0){this.move(p,dt,true);p.action=p.reload>0?(p.reloadSilent?'Silent reloading in cover':'Reloading in cover'):'Disengaging';}
        else {
          const dx=target.x-p.x,dz=target.z-p.z,d=Math.hypot(dx,dz)||1;
          const strafe=liveCombatStrafe(this.time,p.strafeUntil,p.strafeSettleUntil??0,!p.crouch&&!p.jump&&p.decision==='pressure'&&d<22);
          if(strafe==='start'||strafe==='move') {
            if(strafe==='start'){p.strafeDirection=p.strafeDirection===1?-1:1;p.strafeUntil=this.time+.18+this.executionRandom()*.16;p.strafeSettleUntil=p.strafeUntil+.55+LIVE_WEAPONS[p.weapon].interval;}
            const perpX=-dz/d*p.strafeDirection,perpZ=dx/d*p.strafeDirection;
            this.applyMotion(p,{x:perpX*LIVE_WALK_SPEED,z:perpZ*LIVE_WALK_SPEED},dt,'strafe');
            p.action='Strafing';
          } else {
            this.applyMotion(p,{x:0,z:0},dt,'brake');
            if(p.speed>liveShotSpeedLimit(p.weapon,p.profile?.5:p.skills.mechanics))p.action='Counter-strafing';
            else if(p.crouch)p.action=p.burst>=2?'Crouch-spraying':'Crouching';
          }
        }
        const intendedAim=p.profile?(p.trackingPoint??p.aimPoint??p.contact??p):(p.aimPoint??p.contact??p);
        const aim=distance(p,intendedAim)>.01?intendedAim:target;
        const turningFromFlash=p.lookAwayUntil>this.time&&this.time>=(p.lookAwayStarts??0);
        if(!turningFromFlash){
          const eyeY=(p.crouch?1.08:1.6)+(p.jumpY??0);
          p.pitch=Math.atan2(liveActorHeadY(target)-eyeY,distance(p,aim));
        }
        this.turn(p,turningFromFlash?heading(p,p.lookAwayPoint??p)+Math.PI:heading(p,aim));
        if(turningFromFlash)p.action='Turning from friendly flash';
        if(p.weaponReady>0)p.action='Drawing weapon';
        const enemyFacingAway=Math.cos(target.yaw-heading(target,p))<-0.45;
        const enemyUnaware=this.time-target.lastShot>1&&this.time-p.damageAt>1;
        if(enemyFacingAway&&enemyUnaware&&p.engagementShots===0&&!p.triggerDisciplineUntil){
          p.triggerDisciplineUntil=this.time+0.35;
          p.action='Trigger discipline';
          p.radioMessage='Behind them — trigger discipline, lining up headshot!';
          this.emit('objective',`${p.name}: "[RADIO] Behind them — trigger discipline, lining up headshot!"`,p.team,p.id);
        }
        const holdingTrigger=p.triggerDisciplineUntil&&this.time<p.triggerDisciplineUntil;
        if(!turningFromFlash && !blockedByAlly && !holdingTrigger && p.weaponReady===0 && p.speed<=liveShotSpeedLimit(p.weapon,p.profile?.5:p.skills.mechanics) && p.blinded<.2 && !p.reload && p.ammo>0 && this.time>=p.nextShot && this.time-p.acquired>=p.reaction && Math.abs(angle(heading(p,aim)-p.yaw))<.09)this.fire(p,target);
        continue;
      }
      if(this.objective(p,dt))continue;
      p.channel=0;
      const contactFresh=this.time-p.contactAt<3+this.skill(p,'informationReading',p.skills.gameSense)*3;
      const covered=p.contact&&!liveSightline(p,p.contact);
      if(p.ammo<LIVE_WEAPONS[p.weapon].magazine/3 && p.reserve>0 && !p.reload && (p.ammo===0||!contactFresh||covered))this.beginReload(p);
      if(p.speed>1.3 || p.action==='Taking space' || p.action==='Rotating' || p.action==='Disengaging' || p.equipped==='knife') {
        p.crouch=false;
      } else if(this.time>p.crouchUntil && p.burst===0 && p.speed>0.35) {
        p.crouch=false;
      }
      this.move(p,dt);
      const contactBelief=strongestLiveIntel(p.intel,p,this.time);
      const knownContact=!!p.contact&&!!contactBelief&&contactBelief.age<2.25
        &&(contactBelief.source==='sight'||contactBelief.source==='damage');
      const smokeSpam=knownContact&&p.knownSmokes.some(s=>s.expires>this.time
        &&liveSmokeOccludes(p,p.contact!,p.crouch?1.08:1.6,1.25,s,this.time));
      const peekPrefire=knownContact&&p.peek&&!p.peek.back&&p.peek.prefired<3;
      if((smokeSpam||peekPrefire)&&p.contact&&p.ammo>0&&!p.reload&&!p.channel&&p.blinded<.2
        &&p.speed<=liveShotSpeedLimit(p.weapon,p.profile?.5:p.skills.mechanics)
        &&Math.abs(angle(heading(p,p.contact)-p.yaw))<.1&&this.time>=p.nextShot){
        const ghost={id:`known:${p.id}`,team:other(p.team),x:p.contact.x,z:p.contact.z,yaw:0,hp:100,blinded:0,lastShot:-100,channel:0,flashedBy:undefined,crouch:false,jumpY:0,speed:0} as Actor;
        if(peekPrefire)p.peek!.prefired++;
        p.action=smokeSpam?'Controlled smoke spam':peekPrefire&&p.peek!.prefired>1?'Pre-fire spray':'Pre-firing the reported angle';
        this.fire(p,ghost);
      }
      if(p.bomb){this.bomb.x=p.x;this.bomb.z=p.z;}
      if(this.droppedWeapons.length>0) {
        const tiers:Record<LiveWeapon,number>={
          sniper:5, scout:3,
          rifle:4, m4a1_s:4, ak47:4,
          negev:3,
          smg:2, mp9:2, mac10:2, mag7:2, nova:2,
          deagle:2, pistol:1, usp_s:1, glock:1
        };
        const pickupIdx=this.droppedWeapons.findIndex(w=>distance(p,w)<=1.4 && liveSightline(p,w) && w.ammo+w.reserve>0 && tiers[w.weapon]>tiers[p.weapon]);
        if(pickupIdx!==-1) {
          const picked=this.droppedWeapons.splice(pickupIdx,1)[0];
          const oldWeapon=p.weapon,oldAmmo=p.ammo,oldReserve=p.reserve;
          p.weapon=picked.weapon;
          p.ammo=picked.ammo;
          p.reserve=picked.reserve;
          p.reload=0;p.reloadDuration=0;p.reloadSilent=false;p.reloadRounds=0;
          this.equip(p,p.weapon);
          if(oldWeapon!=='pistol' && oldWeapon!=='usp_s' && oldWeapon!=='glock') {
            this.droppedWeapons.push({id:++this.sequence,weapon:oldWeapon,ammo:oldAmmo,reserve:oldReserve,x:p.x,z:p.z});
          }
          this.emit('economy',`${p.name} scavenged ${LIVE_WEAPONS[p.weapon].name}`,p.team,p.id,undefined,undefined,p.weapon);
        }
      }
    }
    if(this.bomb.status==='planted' && this.bomb.remaining<=0){this.explodeBomb();this.bomb.status='exploded';this.finishRound(this.attackTeam,'Device detonated');return;}
    if(this.bomb.status==='defused'){this.finishRound(other(this.attackTeam),'Device defused');return;}
    if(!this.actors.some(p=>!p.attacking&&p.hp>0)){this.finishRound(this.attackTeam,'Defenders eliminated');return;}
    if(this.bomb.status!=='planted' && !this.actors.some(p=>p.attacking&&p.hp>0)){this.finishRound(other(this.attackTeam),'Attackers eliminated');return;}
    if(this.bomb.status!=='planted' && this.remaining<=0)this.finishRound(other(this.attackTeam),'Time expired');
  }

  private explodeBomb(){
    const center={x:this.bomb.x,z:this.bomb.z};
    for(const player of this.actors){
      if(player.hp<=0)continue;
      const range=distance(player,center);
      if(range>=16)continue;
      let damage=500*(1-range/16);
      if(!liveSightline(center,player,0.15,player.crouch?1.08:1.6))damage*=.42;
      if(player.armor>0)damage*=.88;
      player.hp=Math.max(0,player.hp-damage);
      player.armor=Math.max(0,player.armor-damage*.18);
      player.damageAt=this.time;player.channel=0;
      if(player.hp===0){
        player.deaths++;
        player.impact.unusedUtilityOnDeath+=player.flash+player.smoke+player.incendiary+player.he;
        player.bomb=false;
        this.emit('kill',`C4 blast eliminates ${player.name}`,this.attackTeam,undefined,player.id,false,'bomb');
        if(player.weapon!=='pistol'&&player.weapon!=='usp_s'&&player.weapon!=='glock')this.droppedWeapons.push({id:++this.sequence,weapon:player.weapon,ammo:player.ammo,reserve:player.reserve,x:player.x,z:player.z});
      }
    }
    this.emit('objective','C4 DETONATED · lethal blast radius',this.attackTeam);
  }

  private stepPostRound(dt:number){
    for(const player of this.actors){
      if(player.hp<=0)continue;
      player.target=undefined;player.channel=0;player.crouch=false;player.jump=false;
      while(player.path.length&&distance(player,player.path[0])<.38)player.path.shift();
      let pickup:DroppedWeapon|undefined=this.droppedWeapons.filter(item=>item.ammo+item.reserve>0)
        .sort((a,b)=>distance(player,a)-distance(player,b))[0];
      if(pickup&&distance(player,pickup)<1.35){this.recoverDroppedWeapon(player);pickup=undefined;player.path=[];player.goal=undefined;}
      if((!player.path.length||!player.goal||distance(player,player.goal)<.45||player.stuckFor>1)&&this.time>=(player.postRoamAt??0)){
        if(pickup){player.goal={x:pickup.x,z:pickup.z};player.action='Recovering a weapon';}
        else if(this.time>=(player.postRoamAt??0)){
          const destination=safeLivePoint({x:player.x+(this.random()-.5)*18,z:player.z+(this.random()-.5)*18});
          player.goal=destination;player.postRoamAt=this.time+2.2+this.random()*1.8;player.action='Exploring after the round';
        }
        if(player.goal){player.path=findLivePath(player,player.goal,[],this.skill(player,'positioning',player.skills.gameSense));if(pickup)player.postRoamAt=this.time+.7;}
      }
      while(player.path.length&&distance(player,player.path[0])<.38)player.path.shift();
      const waypoint=player.path[0];
      if(waypoint){
        const d=distance(player,waypoint)||1;
        this.applyMotion(player,{x:(waypoint.x-player.x)/d*1.8,z:(waypoint.z-player.z)/d*1.8},dt,'walk');
        this.turn(player,heading(player,waypoint));
      }else this.applyMotion(player,{x:0,z:0},dt,'hold');
      this.recoverDroppedWeapon(player);
    }
  }

  private recoverDroppedWeapon(player:Actor){
    const tier:Record<LiveWeapon,number>={sniper:5,scout:3,rifle:4,m4a1_s:4,ak47:4,negev:3,smg:2,mp9:2,mac10:2,mag7:2,nova:2,deagle:2,pistol:1,usp_s:1,glock:1};
    const pickupIndex=this.droppedWeapons.findIndex(item=>distance(player,item)<=1.4&&liveSightline(player,item)&&item.ammo+item.reserve>0&&tier[item.weapon]>tier[player.weapon]);
    if(pickupIndex<0)return;
    const pickup=this.droppedWeapons.splice(pickupIndex,1)[0];
    const old={weapon:player.weapon,ammo:player.ammo,reserve:player.reserve};
    player.weapon=pickup.weapon;player.ammo=pickup.ammo;player.reserve=pickup.reserve;player.reload=0;player.reloadDuration=0;player.reloadSilent=false;player.reloadRounds=0;this.equip(player,player.weapon);
    if(old.weapon!=='pistol'&&old.weapon!=='usp_s'&&old.weapon!=='glock')this.droppedWeapons.push({...old,id:++this.sequence,x:player.x,z:player.z});
    this.emit('economy',`${player.name} recovered ${LIVE_WEAPONS[player.weapon].name} after the round`,player.team,player.id,undefined,undefined,player.weapon);
  }

  private visible(p:Actor,target:Actor,fov=true) {
    if(p.blinded>.2 || distance(p,target)>55)return false;
    const eyeY=(p.crouch?1.08:1.6)+(p.jumpY??0),targetY=liveActorHeadY(target);
    if(!liveSightline(p,target,eyeY,targetY))return false;
    if(fov && Math.abs(angle(heading(p,target)-p.yaw))>0.82)return false;
    return !this.smokes.some(s=>liveSmokeOccludes(p,target,eyeY,targetY,s,this.time));
  }
  private segmentNear(a:FpsPoint,b:FpsPoint,p:FpsPoint) {
    const dx=b.x-a.x,dz=b.z-a.z,t=clamp(((p.x-a.x)*dx+(p.z-a.z)*dz)/(dx*dx+dz*dz||1),0,1);
    return distance(p,{x:a.x+dx*t,z:a.z+dz*t});
  }
  private radio(p:Actor,message:string,force=false) {
    if(!force&&this.time-(p.radioAt??-100)<3)return;
    p.radioAt=this.time;p.radioMessage=message;
    this.emit('objective',`${p.name}: "[RADIO] ${message}"`,p.team,p.id);
  }
  private defenseHome(p:Actor):'A'|'B' {
    return this.defenseSetup==='stack_b'?(p.slot<4?'B':'A'):this.defenseSetup==='stack_a'?(p.slot<4?'A':'B'):p.slot<3?'A':'B';
  }
  private acknowledge(p:Actor,order:LiveInformationOrder) {
    if(order.issuedAt===undefined||p.acknowledgedOrder===order.issuedAt||this.time<(order.readyAt??0))return;
    p.acknowledgedOrder=order.issuedAt;
    this.radio(p,`${p.role==='support'?'Utility ready':p.role==='trade'?'Ready to trade':p.role==='anchor'?'Keeping the site covered':'Copy'} - ${order.mode==='probe'?'checking space together':order.mode==='execute'?'working the called site':order.reason}.`);
  }
  private refreshIntel(p:Actor) {
    if(!p.intelManaged)return;
    const best=strongestLiveIntel(p.intel,p,this.time);
    p.contact=best?{x:best.x,z:best.z}:undefined;p.contactAt=best?.observed??-100;
    p.information=describeLiveIntel(p.intel,p,this.time);
  }
  private observeIntel(p:Actor,contact:LiveIntelContact,share=true) {
    if(contact.enemyId&&this.eliminations.some(e=>e.victim===contact.enemyId))return;
    p.intelManaged=true;rememberLiveIntel(p.intel,contact,this.time);this.refreshIntel(p);
    recordFpsOpponentPattern(p.patterns,contact,this.round,Math.max(0,this.liveElapsed-(this.time-contact.observed)));
    if(!share)return;
    const interval=contact.source==='sight'?.7:2;
    if(this.time-(p.sentReports.get(contact.key)??-100)<interval)return;
    p.sentReports.set(contact.key,this.time);
    this.radio(p,contact.source==='sight'?`Contact ${liveCallout(contact)} - last seen, checking support.`:`${contact.source==='utility'?'Utility':contact.source==='footstep'?'Footsteps':'Sound'} near ${liveCallout(contact)} - unconfirmed.`);
    const communication=this.identity.teams[p.team].chemistry.communication;
    const skill=this.skill(p,'communication',p.skills.teamwork),delay=p.profile?.12+(1-skill)*.65+(1-communication)*.5:liveReportDelay(p.skills,communication);
    if(p.profile){p.motor.reports++;p.motor.reportDelaySum+=delay;}
    this.reports.push({team:p.team,source:p.id,at:this.time+delay,
      contact:{...contact,confidence:contact.confidence*(.78+skill*.12+communication*.08),uncertainty:contact.uncertainty+.4+(1-skill)}});
  }
  private observablePoint(p:Actor,point:FpsPoint):boolean {
    const eyeY=(p.crouch?1.08:1.6)+(p.jumpY??0);
    return p.blinded<.2&&distance(p,point)<55&&Math.abs(angle(heading(p,point)-p.yaw))<0.82&&liveSightline(p,point,eyeY,1.6)
      &&!this.smokes.some(s=>liveSmokeOccludes(p,point,eyeY,1.6,s,this.time));
  }
  private callFromInformation(p:Actor,allies:Actor[]) {
    const assessment=p.profile?interpretFpsInformation(p.profile,p.intel,this.time):assessLiveIntel(p.intel,this.time),order=this.informationOrders[p.team];
    if(order.callerId&&!allies.some(a=>a.id===order.callerId)){
      order.until=0;order.readyAt=this.time;order.responders=[];order.mode='recheck';order.site=undefined;
      this.nextInformationProbe[p.team]=Math.min(this.nextInformationProbe[p.team],this.time);
    }
    if(p.attacking){
      const alternate=this.site==='A'?'B':'A',pressure=assessment[this.site];
      const blocked=pressure.confirmed>=2&&pressure.strength>assessment[alternate].strength+1.1+(1-this.skill(p,'informationReading',p.skills.gameSense))*.5;
      const lostEntry=this.roundSiteKills[p.team]>=2;
      if(p.profile){
        if(blocked||lostEntry){if(p.planAssessmentAt===undefined){const delay=(1-this.skill(p,'adaptability',p.skills.flexibility))*1.6;p.planAssessmentAt=this.time+delay;p.motor.planAssessmentDelay=delay;p.motor.planAssessments++;}
          if(this.time<p.planAssessmentAt)return;
        }else p.planAssessmentAt=undefined;
      }
      if(this.bomb.status==='carried'&&this.remaining>45&&this.liveElapsed>15&&this.liveElapsed-this.planCommit>14
        &&(blocked||lostEntry)){
        const reason=lostEntry?`Entry losses at ${this.site}; regroup toward ${alternate}`:`${pressure.identified} last seen ${this.site}; redirect toward ${alternate}`;
        this.site=alternate;this.planCommit=this.liveElapsed;this.roundSiteKills[p.team]=0;
        this.protocol.site=this.site;this.protocol.phase='default';this.protocol.phaseAt=this.time;
        for(const ally of allies){ally.peek=undefined;ally.aimFocus=undefined;ally.probeGoal=undefined;ally.probeVisited.clear();ally.nextThink=this.time;}
        this.informationOrders[p.team]={mode:'rotate',site:alternate,responders:allies.map(a=>a.id),until:this.time+6,strength:pressure.strength,reason,issuedAt:this.time,callerId:p.id,readyAt:p.profile?this.time+(1-this.skill(p,'calling',p.skills.leadership))*.8:undefined};
        if(p.profile){p.motor.commands++;p.motor.commandDelay=(this.informationOrders[p.team].readyAt??this.time)-this.time;}
        this.radio(p,`IGL: ${reason}`,true);
      }else if(this.time>=order.until){
        const nearSite=allies.filter(a=>distance(a,LIVE_FPS_MAP.sites[this.site])<22).length;
        if(nearSite>=2&&pressure.confirmed<2&&this.bomb.status==='carried'){
          const reason=`Work ${this.site} together - entry takes space, support flashes, trade follows`;
          this.informationOrders[p.team]={mode:'execute',site:this.site,responders:allies.map(a=>a.id),until:this.time+7,strength:pressure.strength,reason,
            issuedAt:this.time,callerId:p.id,readyAt:this.time+(1-this.skill(p,'calling',p.skills.leadership))*.8};
          this.radio(p,`IGL: ${reason}`,true);return;
        }
        order.reason=assessment[this.site].identified>0?`${assessment[this.site].identified} last seen ${this.site}; work the known angles`:'No confirmed stack — gather information before committing';
      }
      return;
    }
    if(this.bomb.status==='planted')return;
    const tendency=knownFpsTendency(p.patterns,this.round);
    const quiet=assessment.A.strength+assessment.B.strength+assessment.Mid.strength<.45;
    if(order.mode==='probe'&&this.time<order.until&&quiet&&order.responders.every(id=>allies.some(a=>a.id===id)))return;
    if(quiet&&(!order.site||this.time>=order.until)&&this.liveElapsed>=8&&this.time>=this.nextInformationProbe[p.team]&&allies.length>=4){
      // Keep one defender on each site, then send a scout with a trading partner.
      const reserved=new Set(['A','B'].flatMap(site=>{
        const guard=allies.filter(a=>this.defenseHome(a)===site).sort((a,b)=>Number(b.role==='anchor')-Number(a.role==='anchor')||a.slot-b.slot)[0];
        return guard?[guard.id]:[];
      }));
      const candidates=allies.filter(a=>!reserved.has(a.id)&&a.role!=='anchor'&&!a.target&&a.hp>=55&&!a.reload);
      const area=tendency?.area==='A'?'B':tendency?.area==='B'?'A':this.worldRandom()<.5?'A':'B';
      const point=LIVE_TACTICAL[area].entries[this.worldRandom()<.5?0:1];
      const travel=new Map(candidates.map(a=>[a.id,livePathLength(a,point)]));
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
    const previousAlive=order.responders.every(id=>allies.some(a=>a.id===id));
    if(order.mode!=='probe'&&previousAlive&&this.time<order.until&&evidence.strength<order.strength+.8)return;
    const mode:LiveInformationOrder['mode']=evidence.confirmed>=3&&evidence.strength>2?'rotate':(evidence.identified>=2&&evidence.strength>1.2)||(evidence.corroborated&&evidence.strength>.4)?'reinforce':evidence.strength>.12?'watch':order.site?'recheck':'hold';
    const opposite=site==='A'?'B':'A',home=(a:Actor)=>this.defenseHome(a);
    const guards=allies.filter(a=>home(a)===opposite).sort((a,b)=>Number(b.role==='anchor')-Number(a.role==='anchor')||a.slot-b.slot);
    const reserve=guards[0];
    const travel=new Map(guards.map(a=>[a.id,livePathLength(a,LIVE_FPS_MAP.sites[site])]));
    const responders=guards.filter(a=>a!==reserve&&a.role!=='anchor'&&!a.target&&a.channel===0&&Number.isFinite(travel.get(a.id)))
      .sort((a,b)=>travel.get(a.id)!-travel.get(b.id)!||a.slot-b.slot)
      .slice(0,mode==='rotate'?2:mode==='reinforce'?1:0).map(a=>a.id);
    const reason=mode==='rotate'?`${evidence.identified} last seen ${site}; rotate with ${opposite} covered`
      :mode==='reinforce'?`${evidence.identified>=2?'Multiple spotted':'Corroborated activity at'} ${site}; send support, keep ${opposite} covered`
      :mode==='watch'?`Possible ${site} pressure — hold the other site`
      :mode==='recheck'?'Reports faded — reset and recheck the lanes':'No confirmed pressure — hold the setup';
    const changed=order.mode!==mode||order.site!==(mode==='hold'||mode==='recheck'?undefined:site)||order.responders.join()!==responders.join();
    this.informationOrders[p.team]={mode,site:mode==='hold'||mode==='recheck'?undefined:site,responders,until:this.time+(mode==='watch'?2:5),strength:evidence.strength,reason,issuedAt:this.time,callerId:p.id,readyAt:p.profile?this.time+(1-this.skill(p,'calling',p.skills.leadership))*.8:undefined};
    if(p.profile&&changed){p.motor.commands++;p.motor.commandDelay=(this.informationOrders[p.team].readyAt??this.time)-this.time;}
    if(changed){for(const ally of allies)ally.nextThink=this.time;if(mode!=='hold')this.radio(p,`IGL: ${reason}`,true);}
  }
  private usePostPlantUtility(p:Actor,allies:Actor[]):string|undefined {
    if(this.time<p.utilityAt||p.reload>0||p.blinded>.2||p.channel>0||this.bomb.status!=='planted')return;
    const known=strongestLiveIntel(p.intel,p,this.time);
    const nearBomb=known&&known.age<1.8&&known.certainty>=.48&&distance(known,this.bomb)<12;
    const covered=this.smokes.some(smoke=>distance(smoke,this.bomb)<smoke.radius+1);
    const fireAtBomb=this.fires.some(fire=>distance(fire,this.bomb)<fire.radius+1);
    if(!p.attacking&&p.incendiary&&nearBomb&&known.source==='sight'&&!fireAtBomb){
      if(this.throwUtility(p,'incendiary',{x:this.bomb.x,z:this.bomb.z}))return 'Deny the reported bomb defuse with fire';
    }
    if(p.attacking&&p.smoke&&this.bomb.remaining>12&&nearBomb&&known.source==='sight'&&!covered){
      if(this.throwUtility(p,'smoke',{x:this.bomb.x,z:this.bomb.z}))return 'Smoke the device to protect the post-plant';
    }
    if(p.he&&nearBomb&&known.source==='sight'){
      if(this.throwUtility(p,'he',{x:known.x,z:known.z}))return 'HE the reported post-plant contest';
    }
    if(p.flash&&nearBomb&&known.source==='sight'&&distance(p,this.bomb)<18){
      const target={x:this.bomb.x,z:this.bomb.z};
      if(this.throwUtility(p,'flash',target))return 'Flash the reported post-plant contest';
    }
    return;
  }
  private useInformationUtility(p:Actor,allies:Actor[]):string|undefined {
    if(this.time<p.utilityAt||p.reload>0||p.blinded>.2||this.bomb.status==='planted')return;
    const tendency=knownFpsTendency(p.patterns,this.round);
    if(!p.attacking&&p.smoke&&this.liveElapsed<25&&tendency&&tendency.area!=='Mid'&&tendency.early>=2&&this.skill(p,'informationReading',p.skills.gameSense)>.45){
      const gate=LIVE_TACTICAL[tendency.area].entries[p.slot%2];
      if(distance(p,gate)<18&&this.throwUtility(p,'smoke',gate)){
        this.radio(p,`Delaying the ${tendency.area} choke they used early - current positions unknown.`);
        return 'Anticipate previously observed early pressure with delay smoke';
      }
    }
    if(p.attacking&&p.smoke&&p.channel===0&&this.remaining>20&&distance(p,LIVE_FPS_MAP.sites[this.site])<28) {
      const lineups=LIVE_SMOKE_LINEUPS.filter(lineup=>lineup.site===this.site
        &&!this.smokes.some(s=>s.expires>this.time+2&&distance(s,lineup.target)<s.radius)
        &&!this.grenades.some(g=>g.team===p.team&&g.kind==='smoke'&&distance(predictLiveGrenade(g,this.time),lineup.target)<3));
      const throwers=allies.filter(a=>a.attacking&&a.hp>0&&a.smoke>0&&a.channel===0)
        .sort((a,b)=>Number(b.role==='support')-Number(a.role==='support')||Number(b.role==='caller')-Number(a.role==='caller')||a.slot-b.slot);
      const lineup=lineups[throwers.indexOf(p)];
      if(lineup) {
        p.smokeLineupGoal=lineup.position;
        const atLineup=distance(p,lineup.position)<1.05;
        const lineupYaw=heading(p,lineup.target);
        if(atLineup){
          this.turn(p,lineupYaw);
          p.aimFocus={point:lineup.target,source:'hold',until:this.time+.5,from:{x:p.x,z:p.z}};
        }
        if(atLineup&&p.speed<.5&&Math.abs(angle(lineupYaw-p.yaw))<.08&&this.throwUtility(p,'smoke',lineup.target)) {
          p.smokeLineupGoal=undefined;
          p.radioMessage=`${lineup.name} smoke lineup sent`;
          this.emit('objective',`${p.name}: "${lineup.name} smoke lineup sent!"`,p.team,p.id);
          return `Run the ${lineup.name} smoke lineup`;
        }
      } else p.smokeLineupGoal=undefined;
    } else p.smokeLineupGoal=undefined;
    const known=strongestLiveIntel(p.intel,p,this.time);if(!known||known.age>3||known.certainty<.48)return;
    const area=liveIntelArea(known);if(area==='Mid')return;
    const evidence=assessLiveIntel(p.intel,this.time)[area];
    const gate=LIVE_TACTICAL[area].entries[p.slot%2];

    // HE grenades punish recent, bounded contact evidence and can briefly open a smoke lane.
    if(p.he&&known.age<1.8&&known.certainty>=.5&&distance(p,known)<24
      &&(known.source==='sight'||known.source==='damage'||evidence.identified>0||evidence.corroborated)){
      if(this.throwUtility(p,'he',{x:known.x,z:known.z}))return evidence.identified>=2||evidence.corroborated?'Stack HE on corroborated contact evidence':`HE the recent ${area} contact`;
    }

    // Incendiary fire expands into a broad, damaging denial zone over its first seconds.
    if(p.incendiary&&known.age<2.2&&known.certainty>=.55&&distance(p,known)<22
      &&(p.attacking?distance(p,LIVE_FPS_MAP.sites[this.site])<24:evidence.identified>=1||evidence.strength>.45)){
      if(this.throwUtility(p,'incendiary',{x:known.x,z:known.z}))return `Burn the reported ${area} crossing`;
    }

    // 1. Defenders delay reported area pressure at entries / chokes
    if(!p.attacking&&p.smoke&&evidence.identified>=2&&distance(p,gate)<19){
      if(this.throwUtility(p,'smoke',gate))return `Delay reported ${area} pressure while support arrives`;
    }

    // 2. Early choke delay smokes upon rush audio / sight evidence
    if(!p.attacking && p.smoke) {
      const chokes=[{name:'Banana',area:'B',point:{x:20,z:-4}},{name:'A Main',area:'A',point:{x:-19,z:3}}];
      for(const choke of chokes) {
        if(distance(p,choke.point)<22 && !this.smokes.some(s=>distance(choke.point,s)<s.radius)) {
          const threatened=area===choke.area&&(evidence.identified>=1||evidence.strength>0.4);
          if(threatened && this.throwUtility(p,'smoke',choke.point)) {
            this.emit('objective',`${p.name}: "Smoking ${choke.name} to stall rush!"`,p.team,p.id);
            return `Delay reported ${choke.area} pressure while support arrives`;
          }
        }
      }
    }

    // 4. Support pop-flashes for entries
    const entryTeammate=allies.find(a=>a!==p&&a.role==='entry'&&a.attacking&&a.hp>0&&distance(p,a)<16);
    if(p.role==='support'&&p.flash&&entryTeammate&&distance(entryTeammate,gate)<22){
      const burst={x:entryTeammate.x+Math.sin(entryTeammate.yaw)*8,z:entryTeammate.z+Math.cos(entryTeammate.yaw)*8};
      const exposure=allies.filter(a=>distance(a,burst)<12&&liveSightline(a,burst)&&Math.cos(angle(heading(a,burst)-a.yaw))>0).length;
      if(exposure<=1&&this.throwUtility(p,'flash',burst)){
        p.radioMessage=`Pop-flash out for ${entryTeammate.name}! Swing now!`;
        this.emit('objective',`${p.name}: "[RADIO] Pop-flash out for ${entryTeammate.name}! Swing now!"`,p.team,p.id);
        entryTeammate.decision='pressure';
        entryTeammate.nextThink=this.time;
        return `Pop-flash for ${entryTeammate.name}'s entry`;
      }
    }
    const fighting=allies.find(a=>a!==p&&a.target&&distance(a,known)<13&&distance(a,p)<15);
    if(p.role==='support'&&p.flash&&known.source==='sight'&&fighting){
      const burst={x:p.x+(known.x-p.x)*.8,z:p.z+(known.z-p.z)*.8};
      const exposure=allies.filter(a=>distance(a,burst)<13&&liveSightline(a,burst)&&Math.cos(angle(heading(a,burst)-a.yaw))>0).length;
      if(exposure<=1&&this.throwUtility(p,'flash',burst)) {
        this.emit('objective',`${p.name}: "[RADIO] Pop-flash out! Swing now!"`,p.team,p.id);
        return 'Flash the reported fight for a teammate';
      }
    }
  }
  private perceive(p:Actor) {
    p.knownSmokes=p.knownSmokes.flatMap(known=>{
      const actual=this.smokes.find(smoke=>smoke.id===known.id);
      return actual?[{...actual}]:known.expires>this.time&&!this.observablePoint(p,known)?[known]:[];
    });
    for(const smoke of this.smokes){
      const d=distance(p,smoke),edge={x:smoke.x+(p.x-smoke.x)/(d||1)*Math.min(smoke.radius,d),z:smoke.z+(p.z-smoke.z)/(d||1)*Math.min(smoke.radius,d)};
      if(p.blinded<.2&&d<30&&(d<smoke.radius||Math.abs(angle(heading(p,edge)-p.yaw))<.82)&&liveSightline(p,edge)) {
        const existing=p.knownSmokes.find(s=>s.id===smoke.id);
        if(existing)Object.assign(existing,smoke);else p.knownSmokes.push({...smoke});
      }
    }
    const visible=this.actors.filter(t=>t.team!==p.team&&t.hp>0&&this.visible(p,t));
    if(p.profile)p.noticedEnemies=visible.map(t=>({id:t.id,x:t.x,z:t.z,hp:t.hp,reload:t.reload,blinded:t.blinded,lastShot:t.lastShot,channel:t.channel}));
    const value=(t:Actor)=>-distance(p,t)*.04+(t.id===p.target?.65:0)+this.skill(p,'decisionMaking',p.skills.gameSense)*((this.time-t.lastShot<1?.6:0)+(t.channel>0?.8:0)+(t.hp<40?.2:0));
    visible.sort((a,b)=>value(b)-value(a)||a.slot-b.slot);
    for(const enemy of visible)this.observeIntel(p,{key:`enemy:${enemy.id}`,enemyId:enemy.id,observerId:p.id,source:'sight',x:enemy.x,z:enemy.z,observed:this.time,confidence:.98,uncertainty:.45});
    clearLiveIntel(p.intel,this.time,point=>this.observablePoint(p,point),visible);
    this.refreshIntel(p);
    const target=visible[0];
    if(target?.id!==p.target){p.target=target?.id;if(!target)p.pitch=0;p.acquired=this.time;p.strafeUntil=0;p.strafeSettleUntil=this.time+.3;p.triggerDisciplineUntil=undefined;p.engagementShots=0;p.engagementDamaged=false;p.aimPoint=undefined;p.previousSight=undefined;p.trackingPoint=undefined;
      p.reactionVariation=p.profile?1:.85+this.random()*.35;p.reaction=this.reactionDelay(p)*p.reactionVariation;
      if(p.profile&&target){p.motor.noticedAt=this.time;p.motor.cueAt=p.visualCueAt??this.time;p.motor.responseAt=-1;p.motor.reactionDelay=p.reaction;}}
    if(target){
      // Aim follows sampled personal vision, not the opponent's exact position every physics tick.
      p.aimPoint={x:target.x,z:target.z};
      if(p.profile){
        const previous=p.previousSight,elapsed=previous?this.time-previous.at:0,tracking=this.skill(p,'tracking',p.skills.mechanics);
        const vx=previous&&elapsed>0?clamp((target.x-previous.x)/elapsed,-5,5):0,vz=previous&&elapsed>0?clamp((target.z-previous.z)/elapsed,-5,5):0;
        const desired={x:target.x+vx*tracking*.1,z:target.z+vz*tracking*.1};
        const blend=.25+tracking*.75;
        p.trackingPoint=p.trackingPoint?{x:p.trackingPoint.x+(desired.x-p.trackingPoint.x)*blend,z:p.trackingPoint.z+(desired.z-p.trackingPoint.z)*blend}:desired;
        p.motor.trackingSamples++;p.motor.trackingErrorSum+=distance(p.trackingPoint,p.aimPoint);
        p.previousSight={x:target.x,z:target.z,at:this.time,id:target.id};
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
    const knownNearby=beliefs.filter(c=>c.enemyId&&c.certainty>.4&&distance(p,c)<22).length;
    p.pressure=livePressure(allies.length,Math.max(seen.length,knownNearby),this.bomb.status==='planted'?this.bomb.remaining:this.remaining,this.bomb.status==='planted');
    p.reaction=this.reactionDelay(p)*p.reactionVariation;
    const defuseAssignment=!p.attacking&&this.bomb.status==='planted'?assignLiveObjective(allies,this.bomb,this.bomb.remaining,true):undefined;
    const cannotDefuse=!p.attacking&&this.bomb.status==='planted'&&!defuseAssignment;
    const triggers=observedPersonalityTriggers({round:this.round,elapsed:this.liveElapsed,quietSeconds:this.time-p.contactAt,
      allies:allies.length,enemies:seen.length,winStreak:0,lossStreak:this.losses[p.team],prepared:this.liveElapsed<30,
      allyContact:memoryFresh,utilityNeeded:seen.length>0,poorRetake:cannotDefuse,callerAlive:allies.some(a=>a.role==='caller'||a.role==='support')});
    const coordination=this.skill(p,'coordination',p.skills.teamwork)*(allies.some(a=>a!==p&&distance(p,a)<8)?.25:.05);
    const judgment=this.skill(p,'decisionMaking',p.skills.gameSense);
    const informationSeeking=this.skill(p,'informationReading',p.skills.gameSense);
    const activeCall=this.informationOrders[p.team];
    const executing=activeCall.mode==='execute'&&liveOrderActive(activeCall,this.time);
    if(executing)this.acknowledge(p,activeCall);
    const timingWindow=!!p.profile&&beliefs.some(c=>c.source==='gunfire'&&c.age<.5&&distance(p,c)<15);
    if(timingWindow)p.motor.timingWindows++;
    if(p.profile)p.motor.decisions++;
    p.decision=evaluatePlayerAction(identity,{triggers,opportunities:new Set(),confidence:p.profile?.55:clamp(.55-p.pressure*(1-p.skills.clutch)*.2,.1,.9),fatigue:p.profile?0:p.exertion*(1-p.skills.stamina),teamIdentity:team.culture},team.coach,team.plan,team.chemistry,[
      {action:'pressure',legal:!cannotDefuse,tacticalValue:(p.attacking?.5:.05)+(executing?this.skill(p,'coordination',p.skills.teamwork)*.45:0)+(seen.some(t=>t.blinded>.2||t.reload>0)?judgment*.35:0)+(timingWindow?this.skill(p,'timing',0)*.3:0),instruction:identity.instruction==='initiative'?1:team.plan.aggression},
      {action:'prepare',legal:!cannotDefuse,tacticalValue:(p.attacking?.2:.5)+(p.hp<50?judgment*.3:0),instruction:identity.instruction==='hold'?1:team.plan.preparation},
      {action:'coordinate',legal:!cannotDefuse,tacticalValue:.35+coordination,instruction:identity.instruction==='support'?1:team.plan.structure},
      {action:'react',legal:!cannotDefuse,tacticalValue:memoryFresh?.3+judgment*.3:.1,instruction:team.plan.freedom},
      {action:'probe',legal:!cannotDefuse&&!seen.length&&(p.attacking||p.role!=='anchor'),tacticalValue:.45+informationSeeking*.35,instruction:team.plan.freedom},
      {action:'save',legal:cannotDefuse,tacticalValue:1,instruction:team.plan.economy},
    ],this.random).action;
    if(p.target && this.time>=p.utilityAt) this.useUtility(p);
    const caller=[...allies].sort((a,b)=>Number(b.role==='caller')-Number(a.role==='caller')||this.skill(b,'calling',b.skills.leadership)-this.skill(a,'calling',a.skills.leadership))[0];
    if(p===caller)this.callFromInformation(p,allies);
    const utilityIntent=!seen.length
      ?this.bomb.status==='planted'?this.usePostPlantUtility(p,allies):this.useInformationUtility(p,allies)
      :undefined;
    let goal:FpsPoint;
    const primary=LIVE_FPS_MAP.sites[this.site];
    const plantPlan=p.bomb&&this.bomb.status==='carried'?planLivePlant(p,livePlantSite(p)??this.site,beliefs,p.goal):undefined;
    p.intent=p.attacking?'Act on personal information':'Hold the assigned angle';
    if(p.decision==='save') {
      const spawn=LIVE_FPS_MAP.spawns[p.attacking?'attackers':'defenders'];goal={x:spawn.x+(p.slot-2)*3,z:spawn.z};p.intent='Preserve equipment: defuse time is gone';
    } else if(this.bomb.status==='planted') {
      const site=this.bomb.site??this.site,positions=LIVE_TACTICAL[site];
      if(p.attacking){goal=positions.postPlant[p.slot%positions.postPlant.length];p.intent='Protect the planted device';}
      else {
        const defuser=allies.find(a=>a.id===defuseAssignment?.id);
        if(p===defuser) {
          goal=this.bomb;p.intent='Reach and defuse the device';
        } else {
          // Synchronized retake rally and coordinated breach
          const retakeReady = this.bomb.remaining < 26 || allies.filter(a => a !== defuser && distance(a, this.bomb) < 14).length >= Math.min(2, allies.length - 1);
          if (retakeReady) {
            const retakeAngles = site === 'B' ? [{ x: 18, z: 25 }, { x: 27, z: 24 }] : [{ x: -16, z: 24 }, { x: -11, z: 30 }];
            goal = retakeAngles[p.slot % retakeAngles.length];
            p.intent = 'Cover the defuser from retake crossfire';
            if (p.flash && !this.grenades.some(g => g.kind === 'flash') && distance(p, this.bomb) < 18) {
              const siteCenter = LIVE_FPS_MAP.sites[site];
              if (this.throwUtility(p, 'flash', { x: siteCenter.x, z: siteCenter.z })) {
                p.radioMessage = 'Synchronized retake: flashing site — breach together!';
                this.emit('objective', `${p.name}: "[RADIO] Synchronized retake: flashing site — breach together!"`, p.team, p.id);
              }
            }
          } else {
            const stagingPoints = site === 'B' ? [{ x: 18, z: 18 }, { x: 25, z: 18 }] : [{ x: -14, z: 20 }, { x: -10, z: 24 }];
            goal = stagingPoints[p.slot % stagingPoints.length];
            p.intent = 'Rallying with teammates for synchronized retake';
          }
        }
      }
    } else if(p.attacking) {
      if(this.bomb.status==='dropped') {
        const recovery=assignLiveObjective(allies,this.bomb);
        const recoverer=allies.find(a=>a.id===recovery?.id);
        goal=p===recoverer?this.bomb:LIVE_TACTICAL[this.site].entries[p.slot%2];
        p.intent=p===recoverer?'Recover the dropped device':'Cover the recovery';
      }
      else {
        const positions=LIVE_TACTICAL[this.site];
        const planter=allies.find(a=>a.bomb&&a.channel>0&&livePlantSite(a)!==undefined);
        if(p.bomb) {
          goal=plantPlan?.point??safeLivePoint(primary);p.intent=`Advance to a reachable ${plantPlan?.site??this.site} plant position`;
        } else if(planter) {
          const site=livePlantSite(planter)!;
          goal=LIVE_TACTICAL[site].postPlant[p.slot%LIVE_TACTICAL[site].postPlant.length];
          p.intent='Cover the plant and watch the retake routes';
        } else if(memoryFresh&&p.contact&&p.target===undefined&&canInvestigateLiveContact(p,relevant,this.remaining,p.role==='lurker')) {
          goal=findLivePeek(p,p.contact)??p.contact;
          p.intent='Investigate the last reported contact';
        } else {
          const candidates:LiveApproach[]=[
            ...positions.entries.map((point,index)=>({key:`entry:${index}`,point,purpose:'entry' as const})),
            ...positions.holds.map((point,index)=>({key:`hold:${index}`,point,purpose:'clear' as const})),
            ...(['lurker','caller','sniper','support'].includes(p.role)&&this.remaining>35?[
              {key:'mid:control',point:LIVE_MID.control,purpose:'control' as const},
              {key:'mid:flank',point:LIVE_MID.splits[this.site],purpose:'flank' as const},
            ]:[]),
          ];
          const reached=candidates.find(c=>c.key===p.probeGoal&&distance(p,c.point)<2.6);
          if(reached){p.probeVisited.add(reached.key);p.approachUntil=0;}
          const order=this.informationOrders[p.team];
          const execute=order.mode==='execute'&&liveOrderActive(order,this.time);
          const routeTo=createLiveRoutePlanner(p,beliefs);
          const selected=chooseLiveApproach(candidates,{position:p,role:p.role,remaining:this.remaining,judgment,
            allies:allies.filter(a=>a!==p),alliedGoals:allies.filter(a=>a!==p&&a.goal).map(a=>a.goal!),routeTo,
            beliefs,previous:p.probeGoal,committed:this.time<(p.approachUntil??0),visited:p.probeVisited,execute},this.worldRandom);
          if(selected){
            if(p.probeGoal!==selected.key)p.approachUntil=this.time+2+this.skill(p,'adaptability',p.skills.flexibility);
            goal=selected.point;p.probeGoal=selected.key;
            p.intent=selected.purpose==='control'?'Gather information through Mid':selected.purpose==='flank'?'Create a second approach for the team':p.decision==='probe'?'Probe an angle for information':'Take the least crowded known approach';
          }else{
            goal={x:p.x,z:p.z};p.probeGoal=undefined;p.intent='Reassess the blocked approach';
          }
          const front=allies.filter(a=>a!==p&&a.attacking&&distance(a,primary)+2<distance(p,primary))
            .sort((a,b)=>distance(p,a)-distance(p,b)||a.slot-b.slot)[0];
          if(!p.bomb&&front&&['trade','support','caller'].includes(p.role)&&distance(p,front)<16) {
            const dx=front.x-primary.x,dz=front.z-primary.z,length=Math.hypot(dx,dz)||1;
            const spacing=3.5+(p.role==='support'?2:0)+(1-this.skill(p,'trading',p.skills.teamwork))*1.5
              +(1-this.skill(p,'coordination',p.skills.teamwork))*.5;
            goal=safeLivePoint({x:front.x+dx/length*spacing,z:front.z+dz/length*spacing});
            if(p.profile)p.motor.followSpacing=spacing;
            p.intent='Keep trade spacing behind the teammate taking space';
          }
          if(p.holdingSince && this.time - p.holdingSince > 2.0 && !seen.length && !p.target && !memoryFresh) {
            goal=primary;
            p.intent=p.bomb?'Advance to plant on site':'Push onto site to establish control';
          }
        }
      }
    } else {
      const home=this.defenseHome(p);
      const positions=LIVE_TACTICAL[home];
      if(p.role==='anchor') {
        const deepHold=home==='A'?{x:-23,z:18}:{x:22,z:30};
        goal=deepHold;p.intent=`Anchor deep site hold at ${home}`;
      } else {
        goal=positions.holds[p.slot%positions.holds.length];
      }
      const order=this.informationOrders[p.team];
      const activeOrder=liveOrderActive(order,this.time);
      if(activeOrder&&order.mode==='probe'&&order.point&&order.responders.includes(p.id)){
        this.acknowledge(p,order);
        const index=order.responders.indexOf(p.id);
        goal=index===0?order.point:safeLivePoint({x:order.point.x+(home==='A'?-2:2),z:order.point.z+4});
        p.intent=index===0?'IGL: probe for information, then fall back':'IGL: cover and trade the information peek';
      }else if(activeOrder&&order.site&&order.responders.includes(p.id)){
        this.acknowledge(p,order);
        const support=order.site==='A'?[{x:-19,z:33},{x:-26,z:34}]:[{x:22,z:34},{x:31,z:33}];
        goal=support[order.responders.indexOf(p.id)%2];p.intent=`${order.mode==='rotate'?'Rotate':'Reinforce'} ${order.site}: ${order.reason}`;
      }else if(activeOrder&&order.site&&order.site!==home)p.intent=`Keep ${home} covered; ${order.reason}`;
      else if(activeOrder&&order.mode==='watch')p.intent=`Hold ${home} and check the cue; ${order.reason}`;
      else if(order.mode==='recheck')p.intent='Reports faded — recheck the assigned lane';
      if((!activeOrder||order.mode!=='probe') && !p.isBoosted && (p.role==='sniper'||p.role==='anchor'||p.role==='support') && this.time-p.contactAt>4.0 && !p.target) {
        const spot=LIVE_BOOST_SPOTS.find(b=>b.site===home && !this.actors.some(a=>a.isBoosted&&a.boostSpot===b.id));
        if(spot) {
          const d=distance(p,spot);
          if(d<1.5) {
            p.isBoosted=true;p.boostSpot=spot.id;p.jumpY=spot.height;p.yaw=spot.yaw;
            p.radioMessage=`Boosting onto ${spot.name} for an elevated off-angle!`;
            this.emit('objective',`${p.name}: "[RADIO] Boosting onto ${spot.name} for an elevated off-angle!"`,p.team,p.id);
            p.action='Boosted off-angle';p.intent=`Holding elevated vantage on ${spot.name}`;
          } else if(d<9.0 && (!activeOrder || !order.site || order.site===home)) {
            goal={x:spot.x,z:spot.z};p.intent=`Moving to boost spot: ${spot.name}`;
          }
        }
      }
    }
    const teamOrder=this.informationOrders[p.team];
    if(p.isBoosted && (p.damageAt===this.time || (p.attacking ? this.bomb.status==='dropped' : this.bomb.status==='planted' || (liveOrderActive(teamOrder,this.time)&&teamOrder.site && teamOrder.site!==this.defenseHome(p))))){
      p.isBoosted=false;p.boostSpot=undefined;p.jumpY=0;
    }
    const objectiveUrgent=this.bomb.status==='planted'?(p.attacking?this.bomb.remaining<6:this.bomb.remaining<(defuseAssignment?.seconds??(p.kit?5:10))+4)
      :p.attacking&&(this.remaining<12||!!plantPlan&&this.remaining<plantPlan.seconds+8);
    // After a short recovery, an unengaged carrier advances cautiously instead of
    // refreshing a low-HP retreat forever from old reports.
    const carrierCanAdvance=!!plantPlan&&!seen.length&&this.time-p.damageAt>2&&p.reload<=0&&p.ammo>0;
    const needCover=!objectiveUrgent&&!carrierCanAdvance&&memoryFresh&&p.contact&&(p.reload>0||p.ammo===0||(p.hp<38)||(p.hp<55&&p.decision==='prepare')||(Math.max(seen.length,knownNearby)>1&&this.skill(p,'positioning',p.skills.gameSense)>.45));
    if(needCover && p.decision!=='save') {
      const cover=findLiveCover(p,p.contact!,allies.filter(a=>a!==p),p.profile?this.skill(p,'positioning',p.skills.gameSense):undefined,beliefs.filter(c=>c.certainty>.35));
      if(cover){goal=cover;p.retreatUntil=this.time+1.4;p.intent=p.ammo===0||p.reload>0?'Break sight before reloading':p.hp<38?'Low HP — fall back behind cover':'Reposition behind cover';if(p.profile){p.motor.coverChoices++;p.motor.coverExposureSum+=beliefs.filter(c=>c.certainty>.35&&liveSightline(c,cover)).length;}}
    } else if(!objectiveUrgent && p.retreatUntil>this.time && p.goal)goal=p.goal;
    if(!objectiveUrgent&&p.attacking&&!seen.length&&!memoryFresh&&p.smokeLineupGoal){
      goal=p.smokeLineupGoal;p.intent=`Setting up a smoke at ${liveCallout(p.smokeLineupGoal)}`;
    }
    p.objectiveUrgent=objectiveUrgent;
    if(objectiveUrgent){p.retreatUntil=0;p.peek=undefined;p.clearUntil=0;}
    if(!objectiveUrgent && p.role==='entry' && p.attacking && !p.target && !p.bomb && this.time>=p.nextPeek) {
      const corners=this.site==='B'
        ?[{id:'car',point:{x:21,z:-2},label:'Car'},{id:'sandbags',point:{x:21,z:4},label:'Sandbags'},{id:'dark',point:{x:18,z:27},label:'Dark'}]
        :[{id:'balcony',point:{x:-18,z:12},label:'Balcony'},{id:'pit',point:{x:-27,z:16},label:'Pit'},{id:'graveyard',point:{x:-22,z:24},label:'Graveyard'}];
      const uncleared=corners.find(c=>!p.cleared.has(c.id)&&distance(p,c.point)<18&&liveSightline(p,c.point));
      if(uncleared) {
        p.cleared.add(uncleared.id);p.clearPoint=uncleared.point;p.clearUntil=this.time+0.35;
        p.aimFocus={point:{...uncleared.point},source:'clear',until:p.clearUntil+0.5,from:{x:p.x,z:p.z}};
        p.intent=`Check and clear ${uncleared.label}`;p.action='Clearing an angle';
      }
    }
    if(p.role==='entry' && p.attacking && seen.some(t=>t.blinded>.2)) {
      p.decision='pressure';
      p.radioMessage='Entry swinging on blinded defender!';
    }
    goal=safeLivePoint(goal);
    if(!objectiveUrgent && !p.bomb && p.contact && memoryFresh && !liveSightline(p,p.contact) && this.time>=p.nextPeek && this.bomb.status!=='planted' && (p.decision==='prepare'||p.decision==='react'||p.decision==='probe')) {
      const out=findLivePeek(p,p.contact);p.nextPeek=this.time+5;
      if(out){
        const error=p.profile?(this.executionRandom()*2-1)*(.05+(1-this.skill(p,'peeking',1))*.7):0;
        const dx=out.x-p.x,dz=out.z-p.z,d=Math.hypot(dx,dz)||1;
        if(p.profile)p.motor.peekError=Math.abs(error);
        const style:'shoulder'|'crouch-swing'|'ferrari'|'double-pump'|'bait'|'fake'=p.role==='entry'&&p.speed>2.4?'ferrari'
          :p.role==='sniper'?'shoulder':p.role==='trade'?'crouch-swing'
          :this.executionRandom()<.18?'double-pump':this.executionRandom()<.38?'bait':this.executionRandom()<.55?'fake':'shoulder';
        p.peek={home:{x:p.x,z:p.z},out:p.profile?safeLivePoint({x:out.x+dx/d*error,z:out.z+dz/d*error}):out,back:false,until:this.time+3,pause:0,style,pumps:0,prefired:0};
      }
    }
    // A known map angle is a world position, not an angle measured from a future goal.
    // Post-plant attackers watch the retake routes rather than turning back to the site centre.
    const watchedSite=this.bomb.status==='planted'?(this.bomb.site??this.site):p.attacking?this.site:distance(goal,LIVE_FPS_MAP.sites.A)<distance(goal,LIVE_FPS_MAP.sites.B)?'A':'B';
    const watch=p.attacking
      ?LIVE_TACTICAL[watchedSite].holds[p.slot%3]
      :this.bomb.status==='planted'?LIVE_TACTICAL[watchedSite].postPlant[p.slot%5]:LIVE_TACTICAL[watchedSite].entries[p.slot%2];
    p.watchPoint={...watch};
    if(p.profile){const pattern=knownFpsPattern(p.patterns,p,this.round);if(pattern&&this.skill(p,'informationReading',0)>.5&&liveSightline(p,pattern)&&Math.abs(angle(heading(p,pattern)-heading(p,watch)))<.7){p.watchPoint={x:pattern.x,z:pattern.z};p.intent+=' · prepare for a previously observed hold';}}
    if(utilityIntent)p.intent=utilityIntent;
    const cautious=memoryFresh&&p.contact&&(p.reload>0||p.hp<55||p.bomb||p.decision==='prepare'||knownNearby>1);
    const evidence=cautious?liveRouteEvidenceKey(beliefs):'';
    const evidenceChanged=evidence!==p.routeEvidence&&this.time-(p.routeUpdatedAt??-100)>=.8;
    if(this.learner&&this.phase==='live'&&!objectiveUrgent&&!p.target&&!p.channel&&!p.peek&&!p.isBoosted
      &&p.clearUntil<=this.time&&p.retreatUntil<=this.time&&distance(p,goal)>4){
      if(p.stuckFor>1.5)this.learner.close(p,this.time);
      const learned=this.learner.route({actor:p,goal,remaining:this.bomb.status==='planted'?this.bomb.remaining:this.remaining,
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
    this.learner?.close(p,this.time);
    if(!p.goal || distance(p.goal,goal)>1 || (!p.path.length&&distance(p,goal)>.8) || p.stuckFor>1.5 || evidenceChanged){
      const threats=cautious?beliefs.filter(c=>c.certainty>.35&&c.radius<16):[];
      p.goal=goal;p.path=findLivePath(p,goal,threats.length?threats:cautious?[p.contact!]:[],this.skill(p,'positioning',p.skills.gameSense));p.stuckFor=0;
      p.routeEvidence=evidence;p.routeUpdatedAt=this.time;
    }
  }
  private equip(p:Actor,weapon:LiveEquippedWeapon) {
    if(p.equipped===weapon)return;
    p.equipped=weapon;p.weaponReady=liveDrawTime(weapon);p.equipUntil=this.time+1;
    p.reload=0;p.reloadDuration=0;p.reloadSilent=false;p.reloadRounds=0;p.swingAt=undefined;p.burst=0;
  }
  private chooseEquipment(p:Actor,target?:Actor) {
    if(p.profile&&target&&this.time-p.acquired<p.reaction)return;
    const threat=target&&this.visible(p,target,false);
    if(threat){
      if(p.ammo+p.reserve===0&&distance(p,target)<2.2){this.equip(p,'knife');return;}
      if((p.weapon==='sniper'||p.weapon==='scout')&&(distance(p,target)<4.5||p.ammo===0)){
        this.equip(p,p.attacking?'glock':'usp_s');
        return;
      }
      this.equip(p,p.weapon);
      return;
    }
    if(p.reload>0||p.channel>0||p.peek||p.clearUntil>this.time||this.time-p.contactAt<6){this.equip(p,p.weapon);return;}
    if(this.time<p.equipUntil)return;
    // Route geometry and known contacts only. No hidden enemy proximity query.
    const longLeg=!!p.path[0]&&distance(p,p.path[0])>8;
    const awayFromSite=Math.min(distance(p,LIVE_FPS_MAP.sites.A),distance(p,LIVE_FPS_MAP.sites.B))>15;
    const travel=longLeg&&awayFromSite&&p.decision!=='prepare'&&p.role!=='lurker'&&this.time-p.damageAt>4;
    this.equip(p,travel?'knife':p.weapon);
  }
  private strikeKnife(p:Actor) {
    const ray={x:Math.sin(p.yaw),z:Math.cos(p.yaw)};
    let closest:number=LIVE_KNIFE.reach,victim:Actor|undefined;
    for(const actor of this.actors.filter(a=>a!==p&&a.hp>0)) {
      const dx=actor.x-p.x,dz=actor.z-p.z,along=dx*ray.x+dz*ray.z,side=dx*dx+dz*dz-along*along;
      if(along<0||side>LIVE_ACTOR_RADIUS**2||!liveSightline(p,actor))continue;
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
    if(p.profile){
      if(p.target){const before=Math.abs(angle(yaw-p.yaw)),phase=before>.18&&this.time-p.acquired<1?'flick':before>.07?'track':'fine';p.yaw=detailedAimYaw(p.yaw,yaw,p.profile,phase,LIVE_FPS_STEP);if(phase==='flick')p.motor.flickAngleRemoved+=before-Math.abs(angle(yaw-p.yaw));if(phase==='fine')p.motor.fineAngleRemoved+=before-Math.abs(angle(yaw-p.yaw));}
      else p.yaw=advanceLiveAimYaw(p.yaw,yaw,.7,LIVE_FPS_STEP);
    }else p.yaw=advanceLiveAimYaw(p.yaw,yaw,p.skills.mechanics,LIVE_FPS_STEP);
  }
  private preAim(p:Actor,holding:boolean) {
    if(p.lookAwayUntil>this.time&&this.time>=(p.lookAwayStarts??0)){this.turn(p,heading(p,p.lookAwayPoint??LIVE_TACTICAL[this.site].flash)+Math.PI);p.aimFocus=undefined;return;}
    const ahead=liveRouteLookAhead(p,p.path),watch=p.watchPoint;
    const routeYaw=ahead?heading(p,ahead):p.yaw;
    const contact=p.contact&&this.time-p.contactAt<4&&distance(p,p.contact)<24
      &&(holding||distance(p,p.contact)<8||Math.abs(angle(heading(p,p.contact)-routeYaw))<Math.PI*.6)?p.contact:undefined;
    let point:FpsPoint|undefined,source:'contact'|'route'|'hold';
    if(contact){point=contact;source='contact';}
    else if(holding){
      const eyeY=(p.crouch?1.08:1.6)+(p.jumpY??0);
      if(watch && distance(p,watch)>1.5 && liveSightline(p,watch,eyeY,1.6)) {
        point=watch;
      } else {
        const clearAngles=[...LIVE_TACTICAL.A.entries,...LIVE_TACTICAL.B.entries,...LIVE_CHOKES.map(c=>c.center)]
          .filter(pt=>distance(p,pt)>2&&distance(p,pt)<35&&liveSightline(p,pt,eyeY,1.6));
        point=clearAngles.sort((a,b)=>distance(p,a)-distance(p,b))[0]??watch;
      }
      source='hold';
    }
    else {
      // Pre-aim known frontal holds when exposed; otherwise look down the next route section.
      point=watch&&distance(p,watch)>1.5&&distance(p,watch)<25&&liveSightline(p,watch)
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
      p.aimFocus={point:{...point},source,until:this.time+(source==='contact'?.65:.9),from:{x:p.x,z:p.z}};
      if(p.profile){p.preparedError=preparedAngleError(p.profile,this.executionRandom);p.motor.preAimError=Math.abs(p.preparedError);}
    }
    this.turn(p,heading(p,p.aimFocus!.point)+(p.profile?p.preparedError:0));
  }
  private applyMotion(p:Actor,wish:FpsPoint,dt:number,stance:LiveStance) {
    if(p.isBoosted&&Math.hypot(wish.x,wish.z)>.1){p.isBoosted=false;p.boostSpot=undefined;p.jump=true;p.jumpVy=0;}

    if(p.profile){
      if(Math.hypot(wish.x,wish.z)<.1&&p.speed>.03){
        if(p.brakeAt===undefined){const delay=(1-this.skill(p,'movementControl',0))*.1;p.brakeAt=this.time+delay;p.motor.brakeDelay=delay;}
        if(this.time<p.brakeAt)wish={x:p.vx,z:p.vz};
      }else if(Math.hypot(wish.x,wish.z)>.1)p.brakeAt=undefined;
    }
    const occupied=(point:FpsPoint)=>this.actors.some(a=>a!==p&&a.hp>0&&distance(point,a)<0.92&&distance(point,a)<distance(p,a));
    const nearby=this.actors.filter(a=>a!==p&&a.hp>0&&distance(p,a)<2.5);
    let allyMovingAhead=false;
    const wishLen=Math.hypot(wish.x,wish.z);
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
    const velocity=advanceLiveVelocity(p,wish,dt,p.profile?.5:p.skills.mechanics,p.jumpY>0);
    let moved=moveFpsActor(p,{x:velocity.vx*dt,z:velocity.vz*dt},LIVE_ACTOR_RADIUS,LIVE_FPS_MAP.solids);
    if(occupied(moved))moved={x:p.x,z:p.z};
    moved.x=Math.max(-34.0,Math.min(34.0,moved.x));
    moved.z=Math.max(-43.0,Math.min(43.0,moved.z));
    p.vx=(moved.x-p.x)/dt;p.vz=(moved.z-p.z)/dt;p.speed=Math.hypot(p.vx,p.vz);
    if(p.speed>.03 || allyMovingAhead){p.lastMoved=this.time;p.stuckFor=0;}else if(Math.hypot(wish.x,wish.z)>.1)p.stuckFor+=dt;
    p.x=moved.x;p.z=moved.z;p.stance=Math.hypot(wish.x,wish.z)<.1?(p.speed>.12?'brake':p.crouch?'crouch':'hold'):stance;
    if(p.bomb){this.bomb.x=p.x;this.bomb.z=p.z;}
    if(p.speed>2.5&&this.time>=p.nextFootstep){p.nextFootstep=this.time+.44;this.hear(p,17);}
    if(p.speed>.65&&this.time>=p.nextAudioFootstep){
      const stance=p.crouch?'crouch':p.speed>2.5?'run':'walk';
      this.audioCues.push({kind:'footstep',stance,x:p.x,z:p.z});
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
      this.applyMotion(p,{x:0,z:0},dt,'brake');this.preAim(p,true);p.action='Waiting for friendly flash';return;
    }
    if(p.peek&&p.peek.until<this.time)p.peek=undefined;
    if(p.peek&&(!keepAim||p.peek.back)) {
      const target=p.peek.back?p.peek.home:p.peek.out,d=distance(p,target);
      if(d<.22){
        if(p.peek.back){
          if(p.peek.pumps===0&&(p.peek.style==='double-pump'||p.peek.style==='fake'||p.peek.style==='bait')){p.peek.pumps=1;p.peek.back=false;p.peek.pause=0;p.peek.prefired=0;}
          else {p.peek=undefined;p.crouch=false;this.applyMotion(p,{x:0,z:0},dt,'hold');return;}
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
    if(!p.jump&&!p.isBoosted&&this.time>=p.nextJump&&!keepAim&&!p.bomb&&!p.reload&&p.hp>45&&p.contact&&this.time-p.contactAt<3&&!p.target) {
      const eye=(p.crouch?1.08:1.6),gain=LIVE_JUMP_VELOCITY*LIVE_JUMP_VELOCITY/(2*12.5);
      if(!liveSightline(p,p.contact,eye,1.6)&&liveSightline(p,p.contact,eye+gain,1.6)&&!p.knownSmokes.some(s=>liveSmokeOccludes(p,p.contact!,eye+gain,1.6,s,this.time))){
        p.jump=true;p.jumpVy=LIVE_JUMP_VELOCITY;p.nextJump=this.time+5;
        p.action='Jump peeking';this.radio(p,'Jump-checking over cover - hold the trade.');
      }
    }
    while(p.path.length&&distance(p,p.path[0])<.3)p.path.shift();
    const next=p.path[0];
    const nearRouteEdge=!!next&&p.path.length>1&&distance(p,next)<.8;
    if(!p.jump&&!p.isBoosted&&this.time>=p.nextJump&&!keepAim&&!p.target&&!p.bomb&&!p.reload&&p.hp>45
      &&p.path.length>0&&p.speed>2.35&&(p.jumpQueued||nearRouteEdge||this.executionRandom()<.035)){
      p.jump=true;p.jumpVy=LIVE_JUMP_VELOCITY;p.jumpQueued=false;p.jumpChain++;
      if(p.jumpChain>3)p.jumpChain=1;
      p.nextJump=this.time+(p.jumpChain<3?.35:4.5);
      if(p.speed>3.1)p.action='Momentum jump';
    }
    if(!next){
      if(!p.attacking && (p.action==='Holding'||p.action==='Crouch-holding') && (distance(p,LIVE_FPS_MAP.sites.A)<14 || distance(p,LIVE_FPS_MAP.sites.B)<14)) {
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
    if(!keepAim&&p.clearUntil>this.time&&p.clearPoint){
      this.applyMotion(p,{x:0,z:0},dt,p.crouch?'crouch':'hold');
      this.turn(p,heading(p,p.clearPoint));
      p.action=p.crouch?'Crouch-clearing':'Clearing an angle';
      return;
    }
    if(!urgent&&!keepAim&&!p.bomb&&this.time>=p.nextPeek&&p.cleared.size<6&&p.decision==='prepare'&&this.time-p.contactAt>3) {
      const forward=liveRouteLookAhead(p,p.path)??next;
      const check=liveClearAngles(p,forward).filter(a=>!p.cleared.has(a.id)&&Math.abs(angle(heading(p,a.point)-p.yaw))<.7)
        .sort((a,b)=>Math.abs(angle(heading(p,a.point)-p.yaw))-Math.abs(angle(heading(p,b.point)-p.yaw)))[0];p.nextPeek=this.time+2.5;
      if(check){p.cleared.add(check.id);p.clearPoint=check.point;
        p.clearUntil=this.time+.35+(1-this.skill(p,'positioning',p.skills.gameSense))*.25+Math.abs(angle(heading(p,check.point)-p.yaw))/(3.4+(p.profile?.7:p.skills.mechanics)*3);
        p.aimFocus={point:{...check.point},source:'clear',until:p.clearUntil+.6,from:{x:p.x,z:p.z}};
        this.applyMotion(p,{x:0,z:0},dt,'hold');this.turn(p,heading(p,check.point));p.action='Clearing an angle';return;}
    }
    const d=distance(p,next);
    const inUnderpass=Math.abs(p.z-(-10))<3&&p.x>-9&&p.x<1;
    const livingAllies=this.actors.filter(a=>a.team===p.team&&a.hp>0).length;
    const livingEnemies=this.actors.filter(a=>a.team!==p.team&&a.hp>0).length;
    const isClutch=livingAllies<=1&&livingEnemies<=2;
    const flashGo=!!p.flashWindow&&this.time>=p.flashWindow.opens&&this.time<p.flashWindow.expires;
    const smoke=p.knownSmokes.find(s=>s.expires>this.time+1&&distance(p,s)<s.radius+2&&distance(p,s)>s.radius+.3&&liveSmokeOccludes(p,next,1.6,1.6,s,this.time));
    if(smoke&&!urgent&&!flashGo&&!keepAim){
      this.applyMotion(p,{x:0,z:0},dt,'brake');this.preAim(p,true);p.action='Watching smoke edge';p.intent='Smoke conceals the crossing - wait for support or expiry';return;
    }
    const quiet=!urgent&&!flashGo&&(p.decision==='prepare'||p.decision==='probe'||inUnderpass||(p.role==='lurker'&&this.time-p.contactAt>1.5)||isClutch);
    if(p.objectiveUrgent&&!keepAim)p.crouch=false;
    const speed=p.crouch?LIVE_CROUCH_SPEED:p.reload>0?2.2:quiet?LIVE_WALK_SPEED:p.equipped==='knife'?LIVE_KNIFE.runSpeed:LIVE_RUN_SPEED;
    this.applyMotion(p,{x:(next.x-p.x)/d*Math.min(speed,d/dt),z:(next.z-p.z)/d*Math.min(speed,d/dt)},dt,p.crouch?'crouch':quiet?'walk':'run');
    if(!keepAim)this.preAim(p,false);
    p.action=p.reload>0?(p.reloadSilent?'Silent reloading':'Reloading'):p.weaponReady>0?'Drawing weapon':p.crouch?(quiet?'Crouch-walking':'Crouching'):quiet?'Walking quietly':p.equipped==='knife'?'Running with knife':p.attacking?'Taking space':'Rotating';
  }
  private objective(p:Actor,dt:number):boolean {
    if(p.attacking && this.bomb.status==='dropped' && distance(p,this.bomb)<1.2&&liveSightline(p,this.bomb)){p.bomb=true;this.bomb.status='carried';this.emit('objective',`${p.name} recovered the device`,p.team,p.id);}
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
      const site=livePlantSite(p);
      if(site&&(p.jump||p.isBoosted)){p.channel=0;return false;}
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
        const starting=p.channel===0;
        p.action='Planting';p.crouch=true;p.channel+=dt;
        if(starting){this.hear(p,22,'utility');this.emit('objective',`${p.name} started planting`,p.team,p.id);}
        // Ninja plant concealment smoke
        if(p.smoke && !this.smokes.some(s=>distance(p,s)<s.radius)&&this.throwUtility(p,'smoke',{x:p.x,z:p.z})) {
          this.emit('objective',`${p.name}: "Smoking site for ninja plant!"`,p.team,p.id);
        }
        const reported=strongestLiveIntel(p.intel,p,this.time);
        if(!p.fakePlantDone&&p.channel>=.45&&this.remaining>LIVE_PLANT_RULES.seconds+10
          &&reported?.source==='sight'&&reported.age<1.8&&distance(p,reported)<14
          &&this.skill(p,'decisionMaking',p.skills.gameSense)>.48
          &&this.executionRandom()<.3+this.skill(p,'informationReading',p.skills.gameSense)*.35){
          p.fakePlantDone=true;p.channel=0;p.fakePlantHoldUntil=this.time+1.4;
          p.action='Holding fake plant';p.intent='Cancel the plant sound and hold for the reported peek';
          p.radioMessage='Fake plant tapped — hold the angle!';
          this.emit('objective',`${p.name}: "[RADIO] Fake plant tapped — hold the angle!"`,p.team,p.id);
          return true;
        }
        if(p.channel>=LIVE_PLANT_RULES.seconds){p.bomb=false;p.channel=0;this.bomb={status:'planted',x:p.x,z:p.z,remaining:40,site};p.cash=Math.min(16000,p.cash+300);p.impact.plants++;this.emit('objective',`${p.name} planted at ${site}`,p.team,p.id);for(const actor of this.actors)actor.nextThink=this.time;}return true;
      }
    }
    if(!p.attacking && this.bomb.status==='planted' && distance(p,this.bomb)<1.5&&liveSightline(p,this.bomb)) {
      const defenders=this.actors.filter(a=>!a.attacking&&a.hp>0);
      const assignment=assignLiveObjective(defenders,this.bomb,this.bomb.remaining,true);
      if(assignment?.id!==p.id){p.channel=0;return false;}
      if(p.fakeDefuseHoldUntil && this.time < p.fakeDefuseHoldUntil && this.bomb.remaining>(p.kit?5:10)+1) {
        p.action='Holding fake defuse';
        p.intent='Fake defuse baited — holding angle for T peek!';
        return true;
      }
      this.applyMotion(p,{x:0,z:0},dt,'brake');if(p.speed>.12){p.channel=0;p.action='Settling to defuse';return true;}
      const isStart=p.channel===0;
      p.action='Defusing';p.crouch=true;p.channel+=dt;
      if(isStart){
        this.emit('objective','[BOMB TICK] Defuse cable connected!',p.team,p.id);
        this.hear(p,24);
        for(const t of this.actors.filter(a=>a.attacking&&a.hp>0&&distance(a,p)<=(liveSightline(a,p)?24:24*.65))){
          t.decision='pressure';t.nextThink=this.time;t.intent='Defuse sound heard — peek to contest bomb!';
        }
      } else {
        const prevSec=Math.floor(p.channel-dt),curSec=Math.floor(p.channel);
        if(curSec>prevSec && curSec<(p.kit?5:10)){
          this.emit('objective',`[BOMB TICK] Defusing... ${(p.channel).toFixed(1)}s`,p.team,p.id);
          this.hear(p,20);
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
        p.radioMessage='Fake defuse tapped — holding angle!';
        this.emit('objective',`${p.name}: "[RADIO] Fake defuse tapped — holding angle!"`,p.team,p.id);
        return true;
      }
      const halfway=p.kit?2.5:5;
      const reportedThreat=liveIntelBeliefs(p.intel,this.time).some(b=>b.age<1.4&&b.certainty>=.45&&distance(p,b)<18);
      if(!p.halfDefuseDone&&p.channel>=halfway&&this.bomb.remaining>(p.kit?5:10)-p.channel+1&&reportedThreat){
        p.halfDefuseDone=true;p.channel=0;p.fakeDefuseHoldUntil=this.time+1.1;
        p.action='Half-defuse bait';p.intent='Half-defuse sound drawn a peek; clear the reported threat before recommitting';
        const report=strongestLiveIntel(p.intel,p,this.time);
        if(report){p.aimFocus={point:{x:report.x,z:report.z},source:'contact',until:p.fakeDefuseHoldUntil,from:{x:p.x,z:p.z}};this.turn(p,heading(p,report));}
        this.emit('objective',`${p.name} cancels a half defuse to clear a reported threat`,p.team,p.id);
        return true;
      }
      // Ninja defuse concealment smoke
      if(p.smoke && !this.smokes.some(s=>distance(this.bomb,s)<s.radius) && this.actors.some(a=>a.attacking&&a.hp>0)) {
        this.throwUtility(p,'smoke',{x:this.bomb.x,z:this.bomb.z});
        this.emit('objective',`${p.name}: "Smoking bomb for ninja defuse — cover me!"`,p.team,p.id);
      }
      if(p.channel>=(p.kit?5:10)){this.bomb.status='defused';p.channel=0;p.impact.defuses++;this.emit('objective',`${p.name} defused the device`,p.team,p.id);}
      return true;
    }
    return false;
  }
  private useUtility(p:Actor) {
    if(p.profile&&this.time-p.acquired<p.reaction)return;
    const actual=this.actors.find(a=>a.id===p.target&&a.hp>0),target=p.profile?p.noticedEnemies.find(a=>a.id===p.target):actual;
    if(!target || !actual || distance(p,target)>24 || !this.visible(p,actual,false))return;
    const nearby=this.actors.filter(a=>a.team===p.team&&a!==p&&a.hp>0&&distance(p,a)<10);
    const burstPoint={x:p.x+(target.x-p.x)*.75,z:p.z+(target.z-p.z)*.75};
    const friendlyExposure=this.actors.filter(a=>a.team===p.team&&a.hp>0&&distance(a,burstPoint)<13&&liveSightline(a,burstPoint)&&Math.cos(angle(heading(a,burstPoint)-a.yaw))>0).length;
    const flashValue=1+nearby.length*.4-friendlyExposure*(.25+this.skill(p,'coordination',p.skills.teamwork)*.6);
    if(p.flash && nearby.length && target.blinded<.2 && flashValue>0 && (target.hp>35||this.skill(p,'decisionMaking',p.skills.gameSense)<.5)) {
      this.throwUtility(p,'flash',burstPoint);
    } else if(p.smoke && (p.hp<60||p.bomb||(!p.attacking&&this.bomb.status==='planted'))) {
      this.throwUtility(p,'smoke',{x:(p.x+target.x)/2,z:(p.z+target.z)/2});
    }
  }
  private hear(source:Actor,radius:number,signal?:'gunfire'|'footstep'|'melee'|'reload'|'utility') {
    const kind=signal??(radius>=24?'gunfire':radius<10?'melee':'footstep');
    if(kind==='gunfire'||kind==='utility')this.noiseMasks.push({x:source.x,z:source.z,until:this.time+(kind==='gunfire'?.65:1.1),radius:kind==='gunfire'?13:16});
    for(const actor of this.actors.filter(a=>a.team!==source.team&&a.hp>0)) {
      const range=distance(actor,source),audible=liveSightline(actor,source)?radius:radius*.65;
      if(range>audible||this.time-actor.seenAt<.4)continue;
      if(kind==='footstep'&&this.noiseMasks.some(mask=>mask.until>this.time&&distance(actor,mask)<=mask.radius))continue;
      const reading=this.skill(actor,'informationReading',actor.skills.gameSense);
      const error=(kind==='gunfire'?1.4:kind==='reload'?1.8:kind==='utility'?2.8:2.3)+range*(.06+(1-reading)*.13);
      const bearing=this.observationRandom()*Math.PI*2,offset=Math.sqrt(this.observationRandom())*error;
      const point=safeLivePoint({x:source.x+Math.cos(bearing)*offset,z:source.z+Math.sin(bearing)*offset});
      // No source ID: a listener cannot count several runners from an exact hidden identity.
      const contact:LiveIntelContact={key:`sound:${kind}:${Math.round(point.x/7)}:${Math.round(point.z/7)}`,observerId:actor.id,source:kind,
        ...point,observed:this.time,confidence:kind==='gunfire'?.64:kind==='reload'?.48:kind==='utility'?.28:.5,uncertainty:error};
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
  private fire(p:Actor,target:Actor) {
    const weapon=LIVE_WEAPONS[p.weapon],continuingGlockBurst=p.glockBurstRemaining>0;
    p.ammo--;p.nextShot=this.time+weapon.interval;p.lastShot=this.time;
    const equippedWeapon=Object.hasOwn(LIVE_WEAPONS,p.equipped)?p.equipped as LiveWeapon:p.weapon;
    this.audioCues.push({kind:'gunshot',weapon:equippedWeapon,x:p.x,z:p.z});
    const firstShot=p.engagementShots===0;p.engagementShots++;p.impact.shots++;
    if(firstShot)p.impact.firstShots++;
    if(!this.eliminations.length && !p.openingAttempted){p.openingAttempted=true;p.impact.openingAttempts++;}
    p.burst++;
    const shotBurst=p.burst;
    const d=distance(p,target);
    const unscopedSniper=(p.weapon==='sniper'||p.weapon==='scout')&&d>=4.5&&d<10;
    if(unscopedSniper){p.action='No-scoping';p.intent='Take the close shot without the optic';}
    const startsGlockBurst=p.weapon==='glock'&&!continuingGlockBurst&&d<8&&p.ammo>=2&&this.skill(p,'decisionMaking',p.skills.gameSense)>.58;
    if(continuingGlockBurst){p.glockBurstRemaining--;p.nextShot=this.time+(p.glockBurstRemaining>0?.055:weapon.interval);}
    else if(startsGlockBurst){p.glockBurstRemaining=2;p.nextShot=this.time+.055;}
    const isRifle=p.weapon==='rifle'||p.weapon==='ak47'||p.weapon==='m4a1_s';
    const fireCadence:FpsFireCadence=isRifle
      ?this.mechanicsLearner?.choose(p.id,target.id,p.team,fpsFireContext(d,p.speed,p.ammo,weapon.magazine),this.mechanicsRandom)??(d>20?'burst':'sustain')
      :'sustain';
    if(isRifle){
      if(fireCadence==='burst'&&p.burst>=2){p.nextShot+=.22+(1-this.skill(p,'recoilControl',p.skills.mechanics))*.12;p.burst=0;}
      else if(fireCadence==='sustain'&&p.burst>=(p.profile?5:4+Math.round(p.skills.mechanics*3))){p.nextShot+=p.profile?.3:.22+(1-p.skills.mechanics)*.18;p.burst=0;}
    }
    if(p.weapon==='deagle'&&d>12){p.nextShot+=0.32;}
    const opportunities=new Set<FpsSpecialtyOpportunity>();
    if(p.weapon==='sniper' && distance(p,target)>25 && this.time-p.lastMoved>1)opportunities.add('preparedLongAngle');
    if(target.blinded>.2 && target.flashedBy!==p.id && this.actors.some(a=>a.id===target.flashedBy&&a.team===p.team))opportunities.add('allyFlashWindow');
    if(this.events.some(e=>e.kind==='kill'&&e.actorId===target.id&&e.team!==p.team&&this.time-e.time<1.5))opportunities.add('immediateTrade');
    const identity=this.identity.players[p.id];
    const effect=resolveTacticalExecution(identity.specialty,opportunities,identity.specialtyProficiency??.5);
    const movement=p.speed/(LIVE_WEAPONS[p.weapon].category==='smg'?8:LIVE_RUN_SPEED);
    const sniperScopeWindow=(p.weapon==='sniper'||p.weapon==='scout')&&d>=10?this.time-p.acquired:Infinity;
    const quickScope=sniperScopeWindow>=.1&&sniperScopeWindow<.5;
    const scopedPrecision=sniperScopeWindow>=.5 ? .68 : quickScope ? .88 : 1;
    if(sniperScopeWindow!==Infinity)p.action=quickScope?'Quick-scoping':sniperScopeWindow>=.5?'Holding the scope':'Fast scope snap';
    const spread=((p.profile?weapon.spread+Math.max(0,Math.min(1,movement))*.022:liveAimSpread(p.skills,weapon.spread,p.pressure,p.exertion,movement,shotBurst)*(1-(effect?.executionBonus??0)))+(unscopedSniper?.12:0))*scopedPrecision*(p.crouch?0.72:1.0)*(p.jump?2.5:1.0);
    const input=p.profile?detailedInputError(p.profile,p.pressure,this.executionRandom)*(1-(effect?.executionBonus??0)):0;
    const yaw=p.yaw+(this.executionRandom()+this.executionRandom()-1)*spread+input+(p.profile?p.recoil:0);
    const fromY=(p.crouch?1.08:1.6)+(p.jumpY??0);
    const desiredPitch=Math.atan2(liveActorHeadY(target)-fromY,d||1);
    const pitch=(p.pitch??desiredPitch)+(this.executionRandom()+this.executionRandom()-1)*spread;
    if(p.profile){p.motor.inputSamples++;p.motor.inputErrorSum+=input;p.motor.inputErrorSquareSum+=input*input;p.motor.recoilSamples++;p.motor.recoilResidualSum+=Math.abs(p.recoil);p.recoil+=detailedRecoilImpulse(p.weapon,shotBurst);}
    const origin={x:p.x,y:fromY,z:p.z},direction=liveRayDirection(yaw,pitch),farPoint={x:p.x+direction.x*65,y:fromY+direction.y*65,z:p.z+direction.z*65};
    const wallHits=liveWallIntersections(origin,farPoint),opaqueWall=wallHits.find(hit=>!hit.wall.bulletPenetration);
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
    this.shots.push({id:++this.sequence,time:this.time,actorId:p.id,weapon:equippedWeapon,
      from:{x:origin.x,z:origin.z},to,fromY:origin.y,toY,team:p.team,
      ...(victim&&victimHit?{targetId:victim.id,hitRegion:victimHit.region}:{})});
    this.disturbSmokesAlongShot(p,to);
    if(p.weapon==='sniper'){
      p.retreatUntil=this.time+1.25;
      const nearbyCover=findLiveCover(p,target,this.actors.filter(a=>a!==p));
      if(nearbyCover){
        p.goal=nearbyCover;
        p.path=findLivePath(p,nearbyCover,[target],this.skill(p,'positioning',p.skills.gameSense));
      }
      p.intent=unscopedSniper?'No-scope shot — reposition while cycling the bolt':'Shoot and scoot — cycling sniper bolt in cover';
      p.action=unscopedSniper?'No-scoping':'Cycling bolt in cover';
      p.radioMessage='Shot fired — cycling bolt behind cover!';
      this.emit('objective',`${p.name}: "[RADIO] Shot fired — cycling bolt behind cover!"`,p.team,p.id);
    }
    if(victim&&victimHit) {
      const isHeadshot=victimHit.region==='head';
      if(isHeadshot&&victim.team!==p.team)p.impact.headshots++;
      const multiplier=isHeadshot?weapon.headshotMultiplier:1.0;
      const pelletHits=weapon.pellets?weapon.pellets*Math.max(.08,1-d/15):1;
      const rawDamage=weapon.damage*multiplier*pelletHits*victimDamageScale;
      this.damage(p,victim,rawDamage,isHeadshot,p.weapon,firstShot,victim.id,
        victim.team===p.team?LIVE_FRIENDLY_FIRE_RULES.bulletDamageScale:1);
    }
    // Nearby gunfire is audible even outside the viewer's/AI's forward cone.
    this.hear(p,24);
  }
  private damage(p:Actor,victim:Actor,rawDamage:number,isHeadshot:boolean,weaponId:LiveEquippedWeapon,firstShot:boolean,sampleTarget?:string,friendlyDamageScale=1) {
    const friendly=p.team===victim.team,scaledRawDamage=rawDamage*(friendly?clamp(friendlyDamageScale,0,1):1);
    const damage=scaledRawDamage*(victim.armor>0?.78:1),actualDamage=Math.min(victim.hp,damage);
    const rifleShot=weaponId==='rifle'||weaponId==='ak47'||weaponId==='m4a1_s';
    if(!friendly){
      if(weaponId!=='knife')p.impact.hits++;
      p.impact.damage+=actualDamage;
      if(firstShot)p.impact.firstShotHits++;
      if(!p.engagementDamaged&&weaponId!=='knife'&&victim.id===sampleTarget){p.engagementDamaged=true;p.impact.timeToDamageSamples++;p.impact.timeToDamageMs+=Math.max(0,this.time-p.acquired)*1000;}
      if(rifleShot){this.mechanicsLearner?.recordDamage(p.id,victim.id,actualDamage);this.mechanicsLearner?.recordIncoming(victim.id,p.id,actualDamage);}
    }
    victim.armor=Math.max(0,victim.armor-scaledRawDamage*.25);victim.hp=Math.max(0,victim.hp-damage);victim.damageAt=this.time;
    if(victim.hp>0&&!friendly){
      const identified=this.visible(victim,p),error=identified?0:3+distance(p,victim)*.12;
      const bearing=this.observationRandom()*Math.PI*2,point=identified?{x:p.x,z:p.z}:safeLivePoint({x:p.x+Math.cos(bearing)*error*.7,z:p.z+Math.sin(bearing)*error*.7});
      this.observeIntel(victim,{key:identified?`enemy:${p.id}`:`damage:${Math.round(point.x/7)}:${Math.round(point.z/7)}`,
        enemyId:identified?p.id:undefined,observerId:victim.id,source:identified?'sight':'damage',...point,observed:this.time,confidence:identified?.98:.68,uncertainty:identified?.45:error});
      victim.nextThink=Math.min(victim.nextThink,this.time+.12);
    }
    if(victim.hp===0) {
      this.learner?.close(victim,this.time);
      if(!friendly){p.kills++;p.cash=Math.min(16000,p.cash+300);this.mechanicsLearner?.recordKill(p.id,victim.id);}
      else if(p!==victim)p.teamKills=(p.teamKills??0)+1;
      victim.deaths++;victim.channel=0;
      if(!friendly){for(const ally of this.actors.filter(a=>a.team===victim.team&&a.profile))ally.mentalState.setback=Math.min(1,ally.mentalState.setback+(ally===victim?.3:.08));}
      if(!friendly&&!this.eliminations.length)p.impact.openingKills++;
      const trades=friendly?[]:this.eliminations.filter(e=>e.killer===victim!.id&&!e.traded&&this.time-e.at<=1.5&&this.actors.some(a=>a.id===e.victim&&a.team===p.team));
      if(trades.length){p.impact.tradeKills++;for(const trade of trades){trade.traded=true;this.actors.find(a=>a.id===trade.victim)!.impact.tradedDeaths++;}}
      const flashHelper=friendly?undefined:this.actors.find(a=>a.id===victim!.flashedBy&&a.id!==p.id&&a.team===p.team);
      if(victim.blinded>.2&&flashHelper)flashHelper.impact.flashAssists++;
      victim.impact.unusedUtilityOnDeath+=victim.flash+victim.smoke+victim.incendiary+victim.he;
      if(!friendly)this.eliminations.push({killer:p.id,victim:victim.id,team:p.team,at:this.time,traded:false});
      // Trade Fragger Instant Re-Frag Reflex:
      // When an ally is eliminated, the closest living trade fragger (or teammate within 18m) immediately snaps to the killer
      const tradeAlly=friendly?undefined:this.actors.filter(a=>a.team===victim.team&&a.hp>0&&a!==victim&&distance(a,victim)<18&&distance(a,p)<28)
        .sort((a,b)=>(Number(b.role==='trade')-Number(a.role==='trade'))||distance(a,victim)-distance(b,victim))[0];
      if(tradeAlly){
        tradeAlly.target=p.id;
        // The trade fragger pre-anticipates the swing: bypass normal reaction delay so they can re-frag within the CS trade window!
        tradeAlly.acquired=this.time-tradeAlly.reaction+0.06;
        tradeAlly.aimPoint={x:p.x,z:p.z};
        tradeAlly.contact={x:p.x,z:p.z};
        tradeAlly.contactAt=this.time;
        tradeAlly.action='Trading';
        tradeAlly.radioMessage=`Trading for ${victim.name}!`;
        tradeAlly.nextThink=this.time;
        this.emit('objective',`${tradeAlly.name}: "[RADIO] Trading for ${victim.name}!"`,tradeAlly.team,tradeAlly.id);
      }
      // Confirmed eliminations are public; their hidden location is not broadcast by this removal.
      for(const actor of this.actors){actor.intel.contacts=actor.intel.contacts.filter(c=>c.enemyId!==victim.id);actor.noticedEnemies=actor.noticedEnemies.filter(c=>c.id!==victim.id);this.refreshIntel(actor);}
      if(!friendly&&victim.attacking&&distance(victim,LIVE_FPS_MAP.sites[this.site])<22)this.roundSiteKills[victim.team]++;
      const hsBadge=isHeadshot?' ⌖':'';
      const weaponName = weaponId === 'knife' ? LIVE_KNIFE.name : weaponId === 'flash' ? 'Flashbang' : weaponId === 'smoke' ? 'Smoke' : weaponId === 'incendiary' ? 'Incendiary' : weaponId==='he'?'HE grenade':weaponId === 'bomb' ? 'C4' : LIVE_WEAPONS[weaponId].name;
      this.emit('kill',friendly?`${p===victim?'SELF DAMAGE':'TEAMKILL'} · ${p.name} [${weaponName}]${hsBadge} ${victim.name}`:`${p.name} [${weaponName}]${hsBadge} ${victim.name}`,p.team,p.id,victim.id,isHeadshot,weaponId);
      if(victim.weapon!=='pistol' && victim.weapon!=='usp_s' && victim.weapon!=='glock') {
        this.droppedWeapons.push({
          id:++this.sequence,
          weapon:victim.weapon,
          ammo:victim.ammo,
          reserve:victim.reserve,
          x:victim.x,
          z:victim.z,
        });
      }
      if(victim.bomb){victim.bomb=false;this.bomb={...this.bomb,status:'dropped',x:victim.x,z:victim.z};for(const a of this.actors)a.nextThink=this.time;}
    }
  }
  private finishRound(team:FpsTeamId,reason:string) {
    const learnedRound=this.learner?.completeRound(this.actors,team,this.time,`${this.learningEpisode}:${this.round}`);
    if(learnedRound){try{this.learner?.options.onRound?.(learnedRound);}catch{/* Optional persistence must not interrupt a completed round. */}}
    const mechanicsRound=this.mechanicsLearner?.completeRound(team,`${this.learningEpisode||'local'}:combat:${this.round}`);
    if(mechanicsRound){try{this.mechanicsLearner?.options.onRound?.(mechanicsRound);}catch{/* Independent local mechanics persistence must not interrupt a completed round. */}}
    this.grenades=[];
    this.roundHistory.push({
      round: this.round,
      attackTeam: this.attackTeam,
      attackSite: this.site,
      tactic: this.tacticArchetype,
      bombPlanted: this.bomb.status==='planted'||this.bomb.status==='exploded'||this.bomb.status==='defused',
      winner: team,
    });
    for(const p of this.actors){p.impact.roundsCompleted++;if(p.hp>0)p.impact.roundsSurvived++;if(p.profile&&p.team!==team)p.mentalState.setback=Math.min(1,p.mentalState.setback+.12);}
    for(const p of this.actors){p.path=[];p.goal=undefined;p.target=undefined;p.channel=0;p.crouch=false;p.postRoamAt=this.time;}
    this.score[team]++;this.roundWinner=team;this.roundReason=reason;
    this.emit('round',`${team==='blue'?'Blue Five':'Red Five'} win · ${reason}`,team);
    this.losses[team]=0;this.losses[other(team)]++;
    for(const p of this.actors)p.cash=Math.min(16000,p.cash+(p.team===team?3250:Math.min(3400,1400+500*(this.losses[p.team]-1))));
    const target=this.round<=30?16:19+3*Math.floor((this.round-31)/6);
    if(this.score[team]>=target){this.phase='finished';this.winner=team;this.remaining=0;}
    else {this.phase='post';this.remaining=7;}
  }
  snapshot():LiveSnapshot {
    const teamPlan=(team:FpsTeamId):LiveTeamPlan=>({buy:this.teamBuys[team].mode,buyReason:this.teamBuys[team].reason,style:team===this.attackTeam?this.protocol.style:'defense',phase:team===this.attackTeam?this.protocol.phase:'hold',site:team===this.attackTeam?this.site:undefined,
      information:this.bomb.status==='planted'?team===this.attackTeam?`Device planted ${this.bomb.site} — protect the post-plant`:`Device confirmed ${this.bomb.site} — assess the retake and clock`:this.informationOrders[team].reason});
    return {version:'hexatrick-live-exhibition-v9',time:this.time,round:this.round,phase:this.phase,
      ...(this.learner?{learning:this.learner.stats()}:{}),
      ...(this.mechanicsLearner?{mechanicsLearning:this.mechanicsLearner.stats()}:{}),
      remaining:this.phase==='live'&&this.bomb.status==='planted'?this.bomb.remaining:this.remaining,score:{...this.score},winner:this.winner,
      roundWinner:this.roundWinner,roundReason:this.roundReason,attackTeam:this.attackTeam,
      players:this.actors.map(p=>({id:p.id,name:p.name,team:p.team,attacking:p.attacking,role:p.role,x:p.x,z:p.z,yaw:p.yaw,pitch:p.pitch??0,
        hp:p.hp,armor:p.armor,cash:p.cash,weapon:p.weapon,ammo:p.ammo,reserve:p.reserve,reload:p.reload,kills:p.kills,deaths:p.deaths,
        equipped:p.equipped,weaponReady:p.weaponReady,lastSwing:p.lastSwing,information:p.information,
        jump:p.jump,jumpY:p.jumpY,jumpVy:p.jumpVy,radioMessage:p.radioMessage,
        isBoosted:p.isBoosted,boostSpot:p.boostSpot,
        ...(p.profile?{skillProfile:{version:p.profile.version,revision:p.profile.revision,source:p.profile.source},diagnostics:{...p.motor},mental:{...p.mentalState}}:{}),
        action:p.action,bomb:p.bomb,kit:p.kit,flash:p.flash,smoke:p.smoke,incendiary:p.incendiary,he:p.he,blinded:p.blinded,channel:p.channel,throwAt:p.throwAt,throwKind:p.throwKind,
        utilityPrep:p.utilityPreparation?{kind:p.utilityPreparation.kind,releaseAt:p.utilityPreparation.readyAt+.2}:undefined,teamKills:p.teamKills??0,
        reloadDuration:p.reloadDuration,reloadSilent:p.reloadSilent,
        personality:p.personality,specialty:p.specialty,lastShot:p.lastShot,callout:liveCallout(p),intent:p.intent,skills:{...p.skills},exertion:p.exertion,impact:{...p.impact},speed:p.speed,stance:p.stance,crouch:p.crouch})),
      events:this.events.map(e=>({...e})),shots:this.shots.map(s=>({...s,from:{...s.from},to:{...s.to}})),
      smokes:this.smokes.map(s=>({...s})),fires:this.fires.map(f=>({...f})),blasts:this.blasts.map(b=>({...b})),grenades:this.grenades.map(g=>({...g})),teams:{blue:teamPlan('blue'),red:teamPlan('red')},
      droppedWeapons:this.droppedWeapons.map(w=>({...w})),bomb:{...this.bomb}};
  }

  drainAudioCues():FpsAudioCue[] {
    const cues=this.audioCues;
    this.audioCues=[];
    return cues;
  }

  learningDiagnostics() {
    const route=this.learner?{initial:structuredClone(this.learner.initial),current:this.learner.checkpoint(),stats:this.learner.stats(),
      settings:{mode:this.learner.options.mode,exploration:this.learner.options.exploration??null}}:undefined;
    const combat=this.mechanicsLearner?{initial:structuredClone(this.mechanicsLearner.initial),current:this.mechanicsLearner.checkpoint(),stats:this.mechanicsLearner.stats()}:undefined;
    if(!route&&!combat)return undefined;
    return {...route,combatMechanics:combat,reports:{movementRoutes:route?.stats,combatMechanics:combat?.stats}};
  }

  audioListener(id:string):{x:number;z:number;yaw:number}|undefined {
    const player=this.actors.find(actor=>actor.id===id&&actor.hp>0)??this.actors.find(actor=>actor.hp>0);
    return player?{x:player.x,z:player.z,yaw:player.yaw}:undefined;
  }
}
