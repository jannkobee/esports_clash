import test from 'node:test';
import assert from 'node:assert/strict';
import {FPS_ABILITIES,FPS_ABILITY_SUPPORT,generateFpsSkillProfile,validateFpsSkillProfile,estimateLegacyFpsSkillProfile,fpsSkillSummaries,fpsSkillRandom} from './fps/fpsSkillProfile.ts';
import {detailedReactionDelay,detailedSenseInterval,detailedAimYaw,detailedInputError,preparedAngleError,detailedThrowPoint,advanceDetailedRecoil,detailedRecoilImpulse,tickFpsMentalState} from './fps/fpsDetailedExecution.ts';
import {recordFpsOpponentPattern,knownFpsPattern,interpretFpsInformation} from './fps/fpsOpponentPatterns.ts';
import {emptyLiveIntel,rememberLiveIntel} from './fps/fpsLiveIntel.ts';
import {FpsLiveSimulation} from './fps/fpsLiveSimulation.ts';
import {LIVE_RUN_SPEED,liveShotSpeedLimit} from './fps/fpsLiveMovement.ts';
import {liveWalkable,LIVE_FPS_MAP,distance,findLiveCover,liveSightline} from './fps/fpsLiveMap.ts';
import {segmentHitsWall} from './fps/fpsSpatialWorld.ts';
import {FPS_IDENTITY_PERSONALITIES,generatePlayerDNA} from './fps/fpsIdentity.ts';

const createdAt='2026-11-11T00:00:00.000Z';
const plan={tempo:.6,structure:.7,aggression:.5,preparation:.7,freedom:.5,economy:.8};
const coach={...plan,rigidity:.7,communication:.7,leadership:.7,adaptability:.7,development:.5};
const chemistry={trust:.6,communication:.6,understanding:.6,leadershipAcceptance:.6,roleCompetition:.3};
const cards=Array.from({length:10},(_,i)=>({id:`abilities-${i}`,name:`Player ${i}`,stats:{lan:80,iq:80,tf:80,clu:80,sta:80,flx:80,ldr:80}}));
const identity={players:Object.fromEntries(cards.map((p,i)=>[p.id,{id:p.id,personality:FPS_IDENTITY_PERSONALITIES[i],dna:generatePlayerDNA(p.id),intensity:.6,roleSuitability:.6,familiarity:.5}])),teams:{blue:{coach,plan,chemistry},red:{coach,plan,chemistry}}};
const profile=(id=cards[0].id,edits={})=>({...generateFpsSkillProfile(id,1337,createdAt),values:{...Object.fromEntries(FPS_ABILITIES.map(key=>[key,5.5])),...edits}});
const profiles=(edits={})=>Object.fromEntries(cards.map(p=>[p.id,profile(p.id,edits)]));
const game=(edits={},seed=1337)=>new FpsLiveSimulation(cards.slice(0,5),cards.slice(5),seed,identity,{skillProfiles:profiles(edits)});
const encounter=(edits={},seed=1337)=>{
  const sim=game(edits,seed),p=sim.actors[0],enemy=sim.actors[5];
  for(const a of sim.actors)Object.assign(a,{hp:0,nextSense:Infinity,nextThink:Infinity,nextShot:Infinity,bomb:false,target:undefined});
  Object.assign(p,{hp:100,x:-19,z:-10,yaw:0,armor:0,goal:undefined,path:[],nextShot:0});
  Object.assign(enemy,{hp:10000,x:-19,z:-6,yaw:Math.PI,armor:0});
  sim.phase='live';sim.time=20;sim.liveElapsed=5;
  return {sim,p,enemy};
};

test('the revised taxonomy has 25 validated skills, removes weapon handling and gates economic agency',()=>{
  assert.equal(FPS_ABILITIES.length,25);assert.equal(new Set(FPS_ABILITIES).size,25);assert.ok(!FPS_ABILITIES.includes('weaponHandling'));
  assert.equal(Object.values(FPS_ABILITY_SUPPORT).filter(s=>s.active).length,24);assert.equal(FPS_ABILITY_SUPPORT.economyJudgment.active,false);
  for(const invalid of [{...profile(),version:2},{...profile(),values:{...profile().values,reactions:11}},{...profile(),values:{...profile().values,weaponHandling:5}}])assert.throws(()=>validateFpsSkillProfile(invalid));
  assert.throws(()=>validateFpsSkillProfile(profile(),'another-player'));
});

test('generation and shadow estimates are stable, varied, labeled and independent of private identity',()=>{
  const a=generateFpsSkillProfile('sample',55,createdAt),b=generateFpsSkillProfile('sample',55,createdAt);
  assert.deepEqual(a,b);assert.ok(new Set(Object.values(a.values)).size>10);assert.equal(a.source,'lab-generated-v1');
  const low=estimateLegacyFpsSkillProfile('old',{...cards[0].stats,clu:1},55,createdAt),high=estimateLegacyFpsSkillProfile('old',{...cards[0].stats,clu:99},55,createdAt);
  assert.equal(low.source,'legacy_estimate_v1');assert.equal(low.values.composure,high.values.composure,'Old clutch cannot identify new composure');
  assert.ok(!JSON.stringify(a).includes('riskTolerance'));assert.equal(Object.keys(fpsSkillSummaries(a)).length,7);
});

test('new profiles are pinned without mutating legacy cards, and absent profiles retain the explicit legacy path',()=>{
  const inputs=profiles(),before=structuredClone(cards),sim=new FpsLiveSimulation(cards.slice(0,5),cards.slice(5),1337,identity,{skillProfiles:inputs});
  inputs[cards[0].id].values.reactions=1;assert.equal(sim.actors[0].profile.values.reactions,5.5);
  assert.ok(Object.isFrozen(sim.actors[0].profile.values));assert.deepEqual(cards,before);
  assert.equal(sim.snapshot().version,'hexatrick-live-exhibition-v7');
  assert.equal(new FpsLiveSimulation(cards.slice(0,5),cards.slice(5),1337,identity).snapshot().version,'hexatrick-live-exhibition-v7');
  assert.throws(()=>new FpsLiveSimulation(cards.slice(0,5),cards.slice(5),1337,identity,{skillProfiles:{}}));
});

test('Reactions changes noticed-to-response latency on actual ticks, not pre-aim or sensory timing',()=>{
  const run=reactions=>{const {sim,p}=encounter({reactions});sim.perceive(p);for(let i=0;i<30&&p.motor.responseAt<0;i++)sim.step();return p;};
  const slow=run(1),fast=run(10);
  assert.equal(slow.motor.noticedAt,fast.motor.noticedAt);assert.equal(slow.motor.cueAt,fast.motor.cueAt);
  assert.ok(slow.motor.responseAt-fast.motor.responseAt>.2);assert.equal(slow.motor.reactionDelay,.45);assert.equal(fast.motor.reactionDelay,.18);
  assert.ok(fast.motor.responseAt-fast.motor.noticedAt>=.18-1e-8);assert.equal(slow.motor.preAimError,fast.motor.preAimError);
});

test('Awareness changes lawful noticing while Reactions remains independent and rear cues remain invisible',()=>{
  const run=awareness=>{
    const {sim,p,enemy}=encounter({awareness});enemy.z=-14;p.nextSense=20;sim.step();enemy.z=-6;
    for(let i=0;i<30&&p.motor.noticedAt<0;i++)sim.step();return p;
  };
  const slow=run(1),fast=run(10);assert.ok(slow.motor.noticedAt>fast.motor.noticedAt);assert.equal(slow.motor.reactionDelay,fast.motor.reactionDelay);
  assert.ok(slow.motor.noticedAt>=slow.motor.cueAt);assert.ok(fast.motor.noticedAt>=fast.motor.cueAt);
  const {sim,p,enemy}=encounter({awareness:10});enemy.z=-14;sim.perceive(p);assert.equal(p.target,undefined);
});

test('contact-driven equipment changes wait for the motor response and retain mandatory weapon draw time',()=>{
  const {sim,p}=encounter({reactions:1});Object.assign(p,{weapon:'rifle',equipped:'knife',ammo:30,reserve:90,weaponReady:0});sim.perceive(p);
  for(let i=0;i<8;i++)sim.step();assert.equal(p.equipped,'knife');assert.equal(p.motor.responseAt,-1);
  for(let i=0;i<8;i++)sim.step();assert.equal(p.equipped,'rifle');assert.ok(p.weaponReady>.5);assert.equal(p.impact.shots,0);
});

test('Crosshair Placement changes a stable prepared angle rather than creating idle sway or target knowledge',()=>{
  const run=crosshairPlacement=>{const {sim,p}=encounter({crosshairPlacement});Object.assign(p,{target:undefined,watchPoint:{x:-19,z:0},contact:undefined,contactAt:-100});const last=[];
    for(let i=0;i<180;i++){sim.time+=1/30;sim.move(p,1/30);if(i>140)last.push(p.yaw);}return {p,last};};
  const low=run(1),high=run(10);assert.ok(Math.abs(low.p.yaw)>Math.abs(high.p.yaw)*10);
  assert.ok(Math.max(...low.last)-Math.min(...low.last)<.00001);assert.equal(low.p.target,undefined);assert.equal(high.p.target,undefined);
});

test('Flicking and Precision govern distinct correction ranges; Tracking uses only sampled motion',()=>{
  const low=profile(undefined,{flicking:1}),high=profile(undefined,{flicking:10});
  assert.ok(detailedAimYaw(0,1,high,'flick',1/30)>detailedAimYaw(0,1,low,'flick',1/30));
  assert.equal(detailedAimYaw(0,.04,high,'fine',1/30),detailedAimYaw(0,.04,low,'fine',1/30));
  assert.ok(detailedAimYaw(0,.04,profile(undefined,{precision:10}),'fine',1/30)>detailedAimYaw(0,.04,profile(undefined,{precision:1}),'fine',1/30));
  const run=tracking=>{const {sim,p,enemy}=encounter({tracking});sim.perceive(p);sim.time+=.2;enemy.x=-17;sim.perceive(p);const estimate={...p.trackingPoint};enemy.x=31;return {p,estimate};};
  const slow=run(1),fast=run(10);assert.ok(Math.abs(fast.estimate.x+17)<Math.abs(slow.estimate.x+17));
  assert.deepEqual(fast.p.trackingPoint,fast.estimate,'Hidden movement cannot change the sampled estimate');
});

test('Precision, Composure and Consistency change bounded symmetric input noise without changing weapon mechanics',()=>{
  const samples=(edits,pressure)=>{const p=profile(undefined,edits),random=fpsSkillRandom(22,'input-test');return Array.from({length:12000},()=>detailedInputError(p,pressure,random));};
  const rms=values=>Math.sqrt(values.reduce((n,v)=>n+v*v,0)/values.length),mean=values=>values.reduce((n,v)=>n+v,0)/values.length;
  assert.ok(rms(samples({precision:10},0))<rms(samples({precision:1},0)));
  assert.deepEqual(samples({composure:1},0),samples({composure:10},0));assert.ok(rms(samples({composure:10},1))<rms(samples({composure:1},1)));
  const variable=samples({consistency:1},0),stable=samples({consistency:10},0);assert.ok(rms(variable)>rms(stable));assert.ok(Math.abs(mean(variable))<.0002);assert.ok(Math.abs(mean(stable))<.0002);
});

test('Recoil Control compensates an actual accumulated impulse and affects subsequent physical shot rays',()=>{
  const low=profile(undefined,{recoilControl:1}),high=profile(undefined,{recoilControl:10}),impulse=detailedRecoilImpulse('rifle',1);
  const a=advanceDetailedRecoil(impulse,low,.14),b=advanceDetailedRecoil(impulse,high,.14);assert.ok(a>b);assert.ok(b>=0);
  const fire=(recoilControl,residual)=>{const {sim,p,enemy}=encounter({recoilControl});p.weapon='rifle';p.recoil=residual;sim.fire(p,enemy);return {shot:sim.shots[0],p};};
  const slow=fire(1,a),fast=fire(10,b);assert.ok(slow.p.motor.recoilResidualSum>fast.p.motor.recoilResidualSum);
  assert.notEqual(slow.shot.to.x,fast.shot.to.x);assert.equal(slow.p.ammo,fast.p.ammo);
});

test('Movement Control changes braking-input delay while physical speed and shot thresholds stay fixed',()=>{
  const run=movementControl=>{const {sim,p}=encounter({movementControl});Object.assign(p,{vx:LIVE_RUN_SPEED,vz:0,speed:LIVE_RUN_SPEED});let ticks=0;
    while(p.speed>liveShotSpeedLimit('rifle',.5)&&ticks<30){sim.time+=1/30;sim.applyMotion(p,{x:0,z:0},1/30,'brake');assert.ok(p.speed<=LIVE_RUN_SPEED+.000001);ticks++;}return {p,ticks};};
  const low=run(1),high=run(10);assert.ok(low.ticks>high.ticks);assert.ok(low.p.motor.brakeDelay>high.p.motor.brakeDelay);
  assert.equal(low.p.hp,high.p.hp);
});

test('Utility Execution changes a chosen throw error while retaining inventory, fuse and ballistic flight',()=>{
  const run=utilityExecution=>{const {sim,p}=encounter({utilityExecution});p.smoke=1;p.utilityAt=0;const target={x:-19,z:2};assert.equal(sim.throwUtility(p,'smoke',target),true);return {p,g:sim.grenades[0]};};
  const low=run(1),high=run(10);assert.ok(low.p.motor.throwErrorSum>high.p.motor.throwErrorSum);assert.equal(low.p.smoke,0);assert.equal(high.p.smoke,0);
  assert.ok(low.g.detonateAt>20);assert.ok(Math.abs(low.g.vz)>0);assert.equal(low.g.kind,high.g.kind);
  const from={x:-19,z:-10},target={x:-19,z:2},r1=fpsSkillRandom(1,'throw'),r2=fpsSkillRandom(1,'throw');
  assert.ok(distance(detailedThrowPoint(profile(undefined,{utilityExecution:10}),from,target,r1),target)<distance(detailedThrowPoint(profile(undefined,{utilityExecution:1}),from,target,r2),target));
});

test('Information Reading interprets uncertain evidence without changing its identity, timestamp or visibility',()=>{
  const memory=emptyLiveIntel();rememberLiveIntel(memory,{key:'noise',observerId:'listener',source:'footstep',x:20,z:14,observed:20,confidence:.5,uncertainty:4},20);
  const before=structuredClone(memory),poor=interpretFpsInformation(profile(undefined,{informationReading:1}),memory,21),good=interpretFpsInformation(profile(undefined,{informationReading:10}),memory,21);
  assert.ok(poor.B.strength>good.B.strength);assert.equal(poor.B.identified,0);assert.equal(good.B.identified,0);assert.deepEqual(memory,before);
});

test('Communication changes transmission, not sight acquisition or original report time',()=>{
  const run=communication=>{const {sim,p}=encounter({communication});sim.perceive(p);return {p,report:sim.reports[0]};};
  const low=run(1),high=run(10);assert.ok(low.report.at>high.report.at);assert.equal(low.report.contact.observed,high.report.contact.observed);
  assert.equal(low.p.motor.noticedAt,high.p.motor.noticedAt);assert.equal(low.p.reaction,high.p.reaction);assert.ok(high.report.contact.confidence>low.report.contact.confidence);
});

test('Positioning chooses actual cover against multiple remembered angles without an abstract defense bonus',()=>{
  const from={x:-19,z:-8},primary={x:-31,z:10},secondary={x:-19,z:-10};
  const low=findLiveCover(from,primary,[],0,[primary,secondary]),high=findLiveCover(from,primary,[],1,[primary,secondary]);
  assert.ok(low&&high);assert.ok(liveWalkable(low)&&liveWalkable(high));assert.equal(liveSightline(primary,low),false);assert.equal(liveSightline(primary,high),false);
  assert.equal(liveSightline(secondary,low),true);assert.equal(liveSightline(secondary,high),false);
});

test('Peeking changes the endpoint error of an actually chosen jiggle, not tactical selection or teleportation',()=>{
  const run=(peeking,seed)=>{const {sim,p}=encounter({peeking},seed);Object.assign(p,{x:-32,z:-20,yaw:.7,role:'anchor',target:undefined,nextPeek:0});
    sim.observeIntel(p,{key:'old-sight',enemyId:'known',observerId:p.id,source:'sight',x:-24,z:-12,observed:20,confidence:.98,uncertainty:.45},false);
    sim.decide(p);return {sim,p};};
  let pair;
  for(let seed=1;seed<=40;seed++){const low=run(1,seed),high=run(10,seed);assert.equal(low.p.decision,high.p.decision);if(low.p.peek&&high.p.peek){pair={low,high};break;}}
  assert.ok(pair,'No legitimate peek was selected in the controlled sample');assert.ok(pair.low.p.motor.peekError>pair.high.p.motor.peekError);
  const before={x:pair.low.p.x,z:pair.low.p.z};pair.low.sim.time+=1/30;pair.low.sim.move(pair.low.p,1/30);
  assert.ok(distance(before,pair.low.p)<.1);assert.ok(!LIVE_FPS_MAP.solids.some(w=>segmentHitsWall(pair.low.p,pair.low.p,w,.349)));
});

test('Decision Making and Timing affect contextual choices; Timing stays inert without its observed window',()=>{
  const choice=(edits,seed,window)=>{const {sim,p,enemy}=encounter(edits,seed);p.role='anchor';enemy.reload=2;sim.perceive(p);p.target=undefined;
    if(window)sim.observeIntel(p,{key:'shot-window',observerId:p.id,source:'gunfire',x:-19,z:-6,observed:20,confidence:.64,uncertainty:2},false);
    sim.decide(p);return p.decision;};
  let poor=0,good=0,early=0,timed=0;
  for(let seed=1;seed<=100;seed++){
    poor+=Number(choice({decisionMaking:1},seed,false)==='pressure');good+=Number(choice({decisionMaking:10},seed,false)==='pressure');
    assert.equal(choice({timing:1},seed,false),choice({timing:10},seed,false));
    early+=Number(choice({timing:1},seed,true)==='pressure');timed+=Number(choice({timing:10},seed,true)==='pressure');
  }
  assert.ok(good>poor);assert.ok(timed>early);
});

test('detailed tactical decisions cannot bypass the noticed-cue stage by reading available world targets',()=>{
  const {sim,p,enemy}=encounter();enemy.reload=2;p.target=undefined;
  assert.equal(p.noticedEnemies.length,0);sim.decide(p);assert.equal(p.noticedEnemies.length,0);assert.equal(p.intel.contacts.length,0);
  sim.perceive(p);assert.equal(p.noticedEnemies[0].reload,2);enemy.reload=0;
  assert.equal(p.noticedEnemies[0].reload,2,'The snapshot must not follow an unobserved current reload state');
});

test('Adaptability controls justified rebuilding delay without removing the team-plan commitment',()=>{
  const run=adaptability=>{const sim=game({adaptability}),p=sim.actors[5];sim.time=45;sim.liveElapsed=30;sim.remaining=90;sim.site='A';sim.protocol.site='A';sim.protocol.phase='default';sim.bomb.status='carried';
    for(let i=0;i<3;i++)sim.observeIntel(p,{key:`stack-${i}`,enemyId:`opponent-${i}`,observerId:p.id,source:'sight',x:-19,z:14+i,observed:45,confidence:.98,uncertainty:.45},false);
    sim.callFromInformation(p,sim.actors.slice(5));return {sim,p};};
  const low=run(1),high=run(10);assert.equal(low.sim.site,'A');assert.equal(high.sim.site,'B');assert.ok(low.p.motor.planAssessmentDelay>high.p.motor.planAssessmentDelay);
  low.sim.time=46.7;low.sim.liveElapsed=31.7;low.sim.callFromInformation(low.p,low.sim.actors.slice(5));assert.equal(low.sim.site,'B');
  const committed=low.sim.planCommit;low.sim.callFromInformation(low.p,low.sim.actors.slice(5));assert.equal(low.sim.planCommit,committed);
});

test('Calling controls command acknowledgment while preserving the opposite-site guard',()=>{
  const run=calling=>{const sim=game({calling}),allies=sim.actors.slice(0,5),p=allies[2];sim.time=20;
    allies.forEach((a,i)=>{a.role=i===0?'anchor':i===2?'caller':'trade';a.target=undefined;});
    for(let i=0;i<2;i++)sim.observeIntel(p,{key:`stack-${i}`,enemyId:`known-${i}`,observerId:p.id,source:'sight',x:20,z:14+i,observed:20,confidence:.98,uncertainty:.45},false);
    sim.callFromInformation(p,allies);return {sim,p,order:sim.informationOrders.blue};};
  const low=run(1),high=run(10);assert.equal(low.order.responders.length,1);assert.equal(high.order.responders.length,1);
  assert.ok(low.p.motor.commandDelay>high.p.motor.commandDelay);assert.ok(!low.order.responders.includes(low.sim.actors[0].id));
  const slow=low.sim.actors.find(a=>low.order.responders.includes(a.id)),fast=high.sim.actors.find(a=>high.order.responders.includes(a.id));
  low.sim.decide(slow);high.sim.decide(fast);assert.ok(slow.goal.x<0);assert.ok(fast.goal.x>0);
});

test('Trading and Coordination separately control adaptive follow-up spacing without a scripted release',()=>{
  const run=edits=>{const sim=game(edits),p=sim.actors[6],entry=sim.actors[5];sim.time=30;sim.liveElapsed=15;sim.protocol.phase='default';sim.site='A';sim.protocol.site='A';
    sim.actors.slice(5).forEach((a,i)=>{a.role=i===0?'entry':i===1?'trade':i===2?'support':i===3?'sniper':'lurker';a.target=undefined;a.bomb=false;});
    Object.assign(p,{x:-19,z:-11});Object.assign(entry,{x:-19,z:4,yaw:0});sim.decide(p);return {sim,p};};
  const distant=run({trading:1}),close=run({trading:10});assert.ok(distant.p.motor.followSpacing>close.p.motor.followSpacing);
  const loose=run({coordination:1}),tight=run({coordination:10});assert.ok(loose.p.motor.followSpacing>tight.p.motor.followSpacing);
  assert.equal(distant.p.motor.entryReleaseDelay,0);
});

test('actual teammate elimination causes a bounded recoverable setback without changing permanent ratings',()=>{
  const {sim,p,enemy}=encounter({resilience:10}),friend=sim.actors[1];Object.assign(friend,{hp:1,x:-19,z:-8,armor:0});
  const before=structuredClone(p.profile.values);sim.damage(enemy,friend,100,false,'pistol',false);assert.equal(friend.hp,0);assert.ok(p.mentalState.setback>0);
  const penalty=p.mentalState.setback;sim.time+=1/30;sim.step();assert.ok(p.mentalState.setback<penalty);assert.deepEqual(p.profile.values,before);
});

test('Concentration, Stamina and setback recovery have distinct state causes and no health/speed bonuses',()=>{
  const initial={setback:0,attentionDebt:0,exertion:0};
  const tired=tickFpsMentalState(profile(undefined,{stamina:1}),initial,120,4.1,true,0),fit=tickFpsMentalState(profile(undefined,{stamina:10}),initial,120,4.1,true,0);
  assert.ok(tired.exertion>fit.exertion);assert.equal(tired.attentionDebt,fit.attentionDebt);
  const unfocused=tickFpsMentalState(profile(undefined,{concentration:1}),initial,30,0,false,30),focused=tickFpsMentalState(profile(undefined,{concentration:10}),initial,30,0,false,30);
  assert.ok(unfocused.attentionDebt>focused.attentionDebt);assert.equal(unfocused.exertion,focused.exertion);
  assert.ok(detailedSenseInterval(profile(),unfocused)>detailedSenseInterval(profile(),focused));
  const setback={...initial,setback:.3};assert.ok(tickFpsMentalState(profile(undefined,{resilience:10}),setback,1,0,false,0).setback<tickFpsMentalState(profile(undefined,{resilience:1}),setback,1,0,false,0).setback);
  assert.deepEqual(tickFpsMentalState(profile(undefined,{resilience:10}),initial,1,0,false,0),tickFpsMentalState(profile(undefined,{resilience:1}),initial,1,0,false,0));
});

test('opponent anticipation needs observed sightings in separate rounds, never an anonymous noise or frame count',()=>{
  const patterns=[],sighting={key:'enemy:known',enemyId:'known',observerId:'ally',source:'sight',x:-19,z:9,observed:20,confidence:.9,uncertainty:.5};
  recordFpsOpponentPattern(patterns,{...sighting,source:'footstep',enemyId:undefined},1);assert.equal(patterns.length,0);
  for(let i=0;i<100;i++)recordFpsOpponentPattern(patterns,sighting,1);assert.equal(knownFpsPattern(patterns,{x:-19,z:0},2),undefined);
  recordFpsOpponentPattern(patterns,sighting,2);recordFpsOpponentPattern(patterns,sighting,3);assert.ok(knownFpsPattern(patterns,{x:-19,z:0},4));
  assert.equal(knownFpsPattern(patterns,{x:-19,z:0},12),undefined);
});

test('reserved Economy Judgment has no effect, and detailed seeded play stays deterministic and collision legal',()=>{
  const a=game({economyJudgment:1}),b=game({economyJudgment:10});
  for(let i=0;i<4500;i++){
    a.step();b.step();
    if(i%450===0){const snapshot=a.snapshot();assert.deepEqual(snapshot,b.snapshot());
      for(const p of snapshot.players){assert.ok(Math.abs(p.x)<36&&Math.abs(p.z)<46);assert.ok(!LIVE_FPS_MAP.solids.some(w=>segmentHitsWall(p,p,w,.349)));}
    }
  }
  const snapshot=a.snapshot();assert.ok(snapshot.round>1);assert.ok(snapshot.players.reduce((n,p)=>n+p.impact.shots,0)>0);
  assert.ok(!JSON.stringify(snapshot).includes('riskTolerance'));assert.ok(!JSON.stringify(snapshot).includes('values'));
  snapshot.players[0].diagnostics.inputSamples=999999;assert.notEqual(a.snapshot().players[0].diagnostics.inputSamples,999999);
});
