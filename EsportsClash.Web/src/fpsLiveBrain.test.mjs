import test from 'node:test';
import assert from 'node:assert/strict';
import {FpsLiveSimulation} from './fps/fpsLiveSimulation.ts';
import {FPS_IDENTITY_PERSONALITIES,generatePlayerDNA} from './fps/fpsIdentity.ts';
import {chooseLiveApproach,liveSmokeOccludes,canInvestigateLiveContact,shouldFakeLiveDefuse} from './fps/fpsLiveBrain.ts';
import {freshFpsExhibitionSeed} from './fps/fpsExhibitionSeed.ts';
import {recordFpsOpponentPattern,knownFpsTendency} from './fps/fpsOpponentPatterns.ts';
import {launchLiveGrenade,predictLiveGrenade,stepLiveGrenade,LIVE_UTILITY_RULES} from './fps/fpsLiveGrenades.ts';
import {liveShotSpeedLimit,advanceLiveJump,LIVE_JUMP_VELOCITY} from './fps/fpsLiveMovement.ts';
import {liveWalkable,findLivePath,distance,LIVE_FPS_MAP,LIVE_ACTOR_RADIUS} from './fps/fpsLiveMap.ts';
import {segmentHitsWall} from './fps/fpsSpatialWorld.ts';
import {createLiveRoutePlanner,assignLiveObjective} from './fps/fpsLivePlanning.ts';
import {liveOrderActive} from './fps/fpsLiveTactics.ts';

const plan={tempo:.6,structure:.7,aggression:.5,preparation:.7,freedom:.5,economy:.8};
const coach={...plan,rigidity:.7,communication:.7,leadership:.7,adaptability:.7,development:.5};
const chemistry={trust:.6,communication:.6,understanding:.6,leadershipAcceptance:.6,roleCompetition:.3};
const cards=Array.from({length:10},(_,i)=>({id:`brain-${i}`,name:`Player ${i}`,stats:{lan:80,iq:80,tf:80,clu:80,sta:80,flx:80,ldr:80}}));
const identity={players:Object.fromEntries(cards.map((p,i)=>[p.id,{id:p.id,personality:FPS_IDENTITY_PERSONALITIES[i],dna:generatePlayerDNA(p.id),intensity:.6,roleSuitability:.6,familiarity:.5}])),teams:{blue:{coach,plan,chemistry},red:{coach,plan,chemistry}}};
const game=()=>{const sim=new FpsLiveSimulation(cards.slice(0,5),cards.slice(5),1337,identity);sim.phase='live';sim.time=40;sim.liveElapsed=25;sim.remaining=90;return sim;};
const contact=(round,overrides={})=>({key:'enemy:known',enemyId:'known',observerId:'scout',source:'sight',x:20,z:10,observed:round*100,confidence:.9,uncertainty:.5,...overrides});

test('new exhibition allocations never reuse the previous or setup seed, even with repeated entropy',()=>{
  let previous=1337;
  for(let i=0;i<100;i++){
    const seed=freshFpsExhibitionSeed(previous,()=>1336);
    assert.notEqual(seed,previous);assert.ok(seed>=1&&seed<=2147483647);previous=seed;
  }
  assert.notEqual(freshFpsExhibitionSeed(2147483647,()=>2147483646),2147483647);
});

test('fresh danger and objective urgency override an otherwise stable route commitment',()=>{
  const candidates=[{key:'left',point:{x:-6,z:4},purpose:'entry'},{key:'right',point:{x:6,z:4},purpose:'entry'},{key:'flank',point:{x:0,z:3},purpose:'flank'}];
  const base={position:{x:0,z:0},role:'lurker',remaining:80,judgment:1,allies:[],beliefs:[],previous:'flank',committed:true,visited:new Set(),execute:false};
  assert.equal(chooseLiveApproach(candidates,base,()=>.5).key,'flank');
  assert.notEqual(chooseLiveApproach(candidates,{...base,remaining:20},()=>.5).key,'flank');
  assert.equal(chooseLiveApproach(candidates.slice(0,2),{...base,previous:'left',beliefs:[{x:-6,z:4,age:0,certainty:1,radius:1}]},()=>0).key,'right');
});

test('investigations and fake defuses require useful recent evidence and enough time',()=>{
  const from={x:0,z:0},belief={x:5,z:0,age:1,certainty:.8,radius:2};
  assert.equal(canInvestigateLiveContact(from,belief,60),true);
  assert.equal(canInvestigateLiveContact(from,{...belief,x:30},60),false);
  assert.equal(canInvestigateLiveContact(from,{...belief,age:8},60),false);
  assert.equal(canInvestigateLiveContact(from,belief,22),false);
  assert.equal(shouldFakeLiveDefuse(30,false,false,[belief],from),true);
  assert.equal(shouldFakeLiveDefuse(30,false,false,[],from),false);
  assert.equal(shouldFakeLiveDefuse(30,false,true,[belief],from),false);
  assert.equal(shouldFakeLiveDefuse(14,false,false,[belief],from),false);
});

test('fresh pressure cancels a quiet CT scout order before its timer expires',()=>{
  const sim=game(),allies=sim.actors.slice(0,5),caller=allies[2];
  allies.forEach((p,i)=>{p.role=i===0?'anchor':i===2?'caller':'trade';p.target=undefined;});
  sim.informationOrders.blue={mode:'probe',responders:[allies[1].id,allies[2].id],point:{x:-19,z:9},until:sim.time+15,strength:0,reason:'Check quiet space'};
  sim.observeIntel(caller,{...contact(1),observed:sim.time,confidence:.7},false);
  sim.callFromInformation(caller,allies);
  assert.equal(sim.informationOrders.blue.mode,'watch');
  assert.equal(sim.informationOrders.blue.responders.length,0);
});

test('a defuser with no current threat commits instead of automatically faking',()=>{
  const sim=game(),p=sim.actors[0];
  sim.actors.forEach((a,i)=>{a.hp=i===0||i===5?100:0;});
  Object.assign(p,{x:-23,z:21,speed:0,vx:0,vz:0,channel:.4,smoke:0,target:undefined});
  sim.bomb={status:'planted',x:p.x,z:p.z,site:'A',remaining:30};
  sim.objective(p,1/30);
  assert.equal(p.action,'Defusing');assert.ok(p.channel>.4);assert.equal(p.fakeDefuseHoldUntil,undefined);
});

test('route choice responds to role, crowded space, knowledge and the objective clock',()=>{
  const candidates=[{key:'entry',point:{x:-2,z:4},purpose:'entry'},{key:'flank',point:{x:2,z:4},purpose:'flank'}];
  const base={position:{x:0,z:0},role:'entry',remaining:80,judgment:1,allies:[],beliefs:[],committed:false,visited:new Set(),execute:false};
  assert.equal(chooseLiveApproach(candidates,base,()=>.5).key,'entry');
  assert.equal(chooseLiveApproach(candidates,{...base,role:'lurker'},()=>.5).key,'flank');
  assert.equal(chooseLiveApproach(candidates,{...base,role:'lurker',remaining:20},()=>.5).key,'entry');
  const spread=[{key:'left',point:{x:-5,z:4},purpose:'entry'},{key:'right',point:{x:5,z:4},purpose:'entry'}];
  assert.equal(chooseLiveApproach(spread,{...base,allies:[{x:-5,z:4}]},()=>.5).key,'right');
  assert.equal(chooseLiveApproach(spread,{...base,beliefs:[{x:5,z:4,radius:2,certainty:1}]},()=>.5).key,'left');
  assert.equal(chooseLiveApproach(spread,{...base,previous:'right',committed:true},()=>0).key,'right');
});

test('opponent tendencies require separate prior rounds and distinguish early pressure',()=>{
  const patterns=[];
  for(let i=0;i<100;i++)recordFpsOpponentPattern(patterns,contact(1),1,12);
  assert.equal(knownFpsTendency(patterns,2),undefined);
  recordFpsOpponentPattern(patterns,contact(2,{source:'footstep',enemyId:undefined}),2,10);
  assert.equal(knownFpsTendency(patterns,3),undefined);
  recordFpsOpponentPattern(patterns,contact(2,{via:'teammate'}),2,18);
  assert.deepEqual(knownFpsTendency(patterns,3),{area:'B',samples:2,early:2,confidence:2/6});
  assert.equal(knownFpsTendency(patterns,10),undefined);
});

test('CT information probes keep two site guards and ignore hidden enemy coordinates',()=>{
  const setup=()=>{
    const sim=game(),allies=sim.actors.slice(0,5);
    allies.forEach((a,i)=>Object.assign(a,{x:i<3?-19:20,z:20,role:i===0||i===3?'anchor':i===2?'caller':'trade',target:undefined,reload:0,hp:100,smoke:0,flash:0}));
    sim.nextInformationProbe.blue=0;
    return {sim,allies,caller:allies[2]};
  };
  const a=setup(),b=setup();
  b.sim.actors.slice(5).forEach(p=>Object.assign(p,{x:0,z:-42}));
  for(const {sim,allies,caller} of [a,b])sim.callFromInformation(caller,allies);
  const order=a.sim.informationOrders.blue;
  assert.equal(order.mode,'probe');assert.equal(order.responders.length,2);
  assert.ok(!order.responders.includes(a.allies[0].id));assert.ok(!order.responders.includes(a.allies[3].id));
  assert.deepEqual(order,b.sim.informationOrders.blue);
  a.sim.time=order.readyAt+.01;
  const scout=a.allies.find(p=>p.id===order.responders[0]);a.sim.decide(scout);
  assert.match(scout.intent,/probe for information/);assert.ok(scout.path.length);assert.match(scout.radioMessage,/Copy|trade/);
});

test('a caller orders a supported execute but does not grant a firing target',()=>{
  const sim=game(),allies=sim.actors.slice(5),caller=allies[0];sim.site='A';
  allies.forEach(p=>Object.assign(p,{x:-19,z:13,target:undefined}));
  sim.callFromInformation(caller,allies);
  const order=sim.informationOrders.red;
  assert.equal(order.mode,'execute');assert.equal(order.callerId,caller.id);assert.ok(order.readyAt>=sim.time);
  assert.ok(allies.every(p=>p.target===undefined));assert.match(caller.radioMessage,/IGL/);
});

test('pressure strafing brakes and fires instead of orbiting without shots',()=>{
  const sim=game(),p=sim.actors[0],enemy=sim.actors[5];
  sim.actors.forEach(a=>Object.assign(a,{hp:0,nextSense:Infinity,nextThink:Infinity,nextShot:Infinity}));
  Object.assign(p,{hp:100,x:-19,z:-10,yaw:0,weapon:'m4a1_s',equipped:'m4a1_s',weaponReady:0,ammo:20,bomb:false,decision:'pressure',target:enemy.id,acquired:0,nextShot:0,aimPoint:{x:-19,z:-3},retreatUntil:0,freezeDelay:0});
  Object.assign(enemy,{hp:1000,x:-19,z:-3,yaw:Math.PI,bomb:false});
  const actions=new Set();
  for(let i=0;i<100;i++){sim.step();actions.add(p.action);assert.ok(liveWalkable(p));}
  assert.ok(actions.has('Strafing'));assert.ok(actions.has('Counter-strafing'));assert.ok(p.impact.shots>0);
});

test('weapon category movement rules also apply to team-exclusive weapons',()=>{
  assert.equal(liveShotSpeedLimit('mp9',.5),liveShotSpeedLimit('smg',.5));
  assert.equal(liveShotSpeedLimit('glock',.5),liveShotSpeedLimit('pistol',.5));
  assert.equal(liveShotSpeedLimit('scout',.5),liveShotSpeedLimit('sniper',.5));
  assert.ok(liveShotSpeedLimit('deagle',.5)<liveShotSpeedLimit('glock',.5));
});

test('jump physics lands and actors do not jump merely for passing a map landmark',()=>{
  let jump={jump:true,jumpY:0,jumpVy:LIVE_JUMP_VELOCITY},peak=0;
  for(let i=0;i<30;i++){jump=advanceLiveJump(jump,1/30);peak=Math.max(peak,jump.jumpY);}
  assert.ok(peak>.5&&peak<.8);assert.deepEqual(jump,{jump:false,jumpY:0,jumpVy:0});
  const sim=game(),p=sim.actors[5];Object.assign(p,{x:20,z:-6,bomb:false,role:'entry',nextJump:0,contact:undefined,path:[{x:20,z:-5}]});
  sim.move(p,1/30);assert.equal(p.jump,false);
});

test('a jump peek is chosen when height can reveal a remembered angle over low cover',()=>{
  const sim=game(),p=sim.actors[5];
  Object.assign(p,{x:-30,z:14.8,bomb:false,crouch:true,role:'entry',nextJump:0,target:undefined,
    contact:{x:-30,z:17.2},contactAt:sim.time,path:[],peek:undefined});
  sim.move(p,1/30);
  assert.equal(p.jump,true);assert.equal(p.jumpVy,LIVE_JUMP_VELOCITY);
  assert.equal(p.target,undefined,'Height creates a chance to observe, not an automatic target');
});

test('grenade knowledge forecasts real wall bounces without mutating the live throw',()=>{
  const grenade=launchLiveGrenade(1,'flash','ally','blue',{x:0,z:-20},{x:0,z:24},0),before={...grenade};
  const forecast=predictLiveGrenade(grenade,0);assert.deepEqual(grenade,before);
  const actual={...grenade};for(let t=0;t<actual.detonateAt-1e-8;t+=1/30)stepLiveGrenade(actual,Math.min(1/30,actual.detonateAt-t));
  assert.deepEqual(forecast,actual);assert.equal(LIVE_UTILITY_RULES.smokeDuration,18);
});

test('smoke blocks the actual eye ray and remains traversable rather than becoming a wall',()=>{
  const smoke={id:1,x:-19,z:0,y:1.5,radius:4,expires:80};
  assert.equal(liveSmokeOccludes({x:-19,z:-6},{x:-19,z:6},1.6,1.6,smoke),true);
  assert.equal(liveSmokeOccludes({x:-19,z:-6},{x:-19,z:6},7,7,smoke),false);
  const sim=game(),p=sim.actors[5];
  Object.assign(p,{x:-19,z:-5,bomb:false,target:undefined,contact:undefined,knownSmokes:[smoke],path:[{x:-19,z:6}],nextPeek:Infinity,decision:'pressure'});
  sim.move(p,1/30);assert.equal(p.action,'Watching smoke edge');
  sim.remaining=10;sim.move(p,1/30);assert.notEqual(p.action,'Watching smoke edge');assert.ok(p.speed>0);
});

test('flash coordination warns teammates and waits for detonation, not a hidden blind state',()=>{
  const sim=game(),p=sim.actors[5],entry=sim.actors[6];
  Object.assign(p,{x:-19,z:-10,flash:1,utilityAt:0,reload:0});
  Object.assign(entry,{x:-19,z:-6,target:undefined,bomb:false,path:[{x:-19,z:4}]});
  assert.equal(sim.throwUtility(p,'flash',{x:-19,z:0}),true);
  assert.ok(entry.flashWindow);assert.ok(entry.lookAwayStarts>sim.time);
  sim.time=entry.flashWindow.opens-.2;sim.move(entry,1/30);assert.equal(entry.action,'Waiting for friendly flash');
  sim.time=entry.flashWindow.opens+.01;sim.move(entry,1/30);assert.notEqual(entry.action,'Waiting for friendly flash');
});

test('approaches and objective roles use the route around the loggia rather than distance through it',()=>{
  const position={x:-25,z:25.5},behindWall={x:-25,z:27.5},open={x:-30,z:24};
  assert.ok(distance(position,behindWall)<distance(position,open));
  const routeTo=createLiveRoutePlanner(position);
  assert.ok(routeTo(behindWall).distance>routeTo(open).distance*2);
  const candidates=[{key:'wall',point:behindWall,purpose:'entry'},{key:'open',point:open,purpose:'entry'}];
  const context={position,role:'entry',remaining:80,judgment:1,allies:[],beliefs:[],committed:false,visited:new Set(),execute:false,routeTo};
  assert.equal(chooseLiveApproach(candidates,context,()=>0).key,'open');
  const actors=[{...behindWall,id:'near',slot:0,kit:false,channel:0},{...open,id:'reachable',slot:1,kit:false,channel:0}];
  assert.equal(assignLiveObjective(actors,position).id,'reachable');
  assert.equal(assignLiveObjective(actors,position,12,true).id,'reachable');
  assert.equal(assignLiveObjective(actors,position,10,true),undefined);
});

test('unreachable approaches cannot survive commitment and assigned teammate goals spread an advance',()=>{
  const candidates=[{key:'blocked',point:{x:0,z:33},purpose:'entry'},{key:'left',point:{x:-8,z:30},purpose:'entry'},{key:'right',point:{x:8,z:30},purpose:'entry'}];
  const position={x:0,z:39},context={position,role:'entry',remaining:80,judgment:1,allies:[],beliefs:[],previous:'blocked',committed:true,visited:new Set(),execute:false,routeTo:createLiveRoutePlanner(position)};
  // Use an actually blocked origin to verify an unreachable route is never a zero-cost trip.
  assert.equal(assignLiveObjective([{x:0,z:33,id:'trapped',slot:0,kit:true,channel:0}],position),undefined);
  const options=candidates.slice(1);
  const plain={...context,previous:undefined,committed:false,routeTo:undefined};
  assert.equal(chooseLiveApproach(options,{...plain,alliedGoals:[options[0].point]},()=>0).key,'right');
  const blockedRoute=point=>point===candidates[0].point?{distance:Infinity,seconds:Infinity,path:[],exposure:0}:createLiveRoutePlanner(position)(point);
  assert.notEqual(chooseLiveApproach(candidates,{...context,routeTo:blockedRoute},()=>0).key,'blocked');
});

test('fresh route exposure can break commitment even when the destination itself is quiet',()=>{
  const candidates=[{key:'left',point:{x:-8,z:30},purpose:'entry'},{key:'right',point:{x:8,z:30},purpose:'entry'}];
  const context={position:{x:0,z:39},role:'entry',remaining:80,judgment:1,allies:[],previous:'left',committed:true,visited:new Set(),execute:false,
    beliefs:[{x:30,z:-20,age:0,certainty:.9,radius:1}],routeTo:point=>({path:[point],distance:12,seconds:3,exposure:point.x<0?25:0})};
  assert.equal(chooseLiveApproach(candidates,context,()=>0).key,'right');
});

test('objective election preserves a viable active channel and includes kits and channel progress',()=>{
  const target={x:-23,z:21},channeler={...target,id:'channeler',slot:1,kit:false,channel:7},kit={...target,id:'kit',slot:0,kit:true,channel:0};
  assert.equal(assignLiveObjective([kit,channeler],target,4,true).id,'channeler');
  assert.equal(assignLiveObjective([kit,{...channeler,channel:0}],target,6,true).id,'kit');
  assert.equal(assignLiveObjective([kit,channeler],target,2,true),undefined);
  assert.equal(assignLiveObjective([{...kit,x:target.x+1}],target,5,true).seconds,5,'A player already in interaction range need not reach the exact centre');
});

test('a defender without a kit keeps covering a teammate who can still finish the defuse',()=>{
  const sim=game(),p=sim.actors[0],kit=sim.actors[1];
  sim.actors.forEach(a=>{a.hp=0;});
  Object.assign(p,{hp:100,x:-23,z:23,kit:false,channel:0,flash:0,smoke:0,target:undefined});
  Object.assign(kit,{hp:100,x:-23,z:21,kit:true,channel:1});
  sim.bomb={status:'planted',x:-23,z:21,site:'A',remaining:6};
  sim.decide(p);
  assert.notEqual(p.decision,'save');assert.match(p.intent,/Cover the defuser/);
});

test('the objective channel uses the same viable defuser as the tactical planner',()=>{
  const sim=game(),slow=sim.actors[0],kit=sim.actors[1];
  sim.actors.forEach(a=>{a.hp=0;});
  for(const p of [slow,kit])Object.assign(p,{hp:100,x:-23,z:21,speed:0,vx:0,vz:0,channel:0,smoke:0});
  slow.kit=false;slow.channel=1;kit.kit=true;
  sim.bomb={status:'planted',x:-23,z:21,site:'A',remaining:7};
  assert.equal(sim.objective(slow,1/30),false);assert.equal(slow.channel,0);
  assert.equal(sim.objective(kit,1/30),true);assert.equal(kit.action,'Defusing');
});

test('route-based urgency releases slow crouched movement before the fixed final seconds',()=>{
  const sim=game(),p=sim.actors[0];sim.actors.forEach(a=>{a.hp=0;});
  Object.assign(p,{hp:100,x:0,z:0,kit:true,crouch:true,channel:0,flash:0,smoke:0,target:undefined});
  const route=createLiveRoutePlanner(p)({x:-23,z:21});
  sim.bomb={status:'planted',x:-23,z:21,site:'A',remaining:route.seconds+7};
  assert.ok(sim.bomb.remaining>12);sim.decide(p);
  assert.equal(p.objectiveUrgent,true);sim.move(p,1/30);
  assert.equal(p.crouch,false);assert.equal(p.stance,'run');
});

test('expired defensive orders release their responders even before the caller thinks again',()=>{
  const sim=game(),p=sim.actors[1];
  Object.assign(p,{role:'trade',target:undefined,flash:0,smoke:0,contact:undefined});
  const order={mode:'reinforce',site:'B',responders:[p.id],until:sim.time-.1,readyAt:sim.time-5,strength:1.5,reason:'Old B pressure'};
  sim.informationOrders.blue=order;
  assert.equal(liveOrderActive(order,sim.time),false);
  assert.equal(liveOrderActive({...order,until:sim.time+1,readyAt:sim.time+1},sim.time),false);
  sim.decide(p);assert.doesNotMatch(p.intent,/Reinforce B|Rotate B/);
  assert.ok(p.goal.x<0,'The expired responder should return to its A assignment');
});

test('new evidence rebuilds an unchanged objective route without replanning it on every decision',()=>{
  const sim=game(),p=sim.actors[5];
  sim.actors.forEach(a=>{a.hp=0;});
  Object.assign(p,{hp:100,x:-19,z:-10,bomb:true,flash:0,smoke:0,target:undefined});
  sim.site='A';sim.decide(p);const goal={...p.goal},first=p.path;
  sim.observeIntel(p,{key:'danger',source:'gunfire',observerId:p.id,x:-19,z:10,observed:sim.time,confidence:.95,uncertainty:.5},false);
  sim.time+=1;sim.decide(p);
  assert.deepEqual(p.goal,goal);assert.notEqual(p.path,first);assert.ok(p.routeEvidence.includes('danger'));
  const rebuilt=p.path;sim.decide(p);assert.equal(p.path,rebuilt);
});

test('navigation destinations and waypoints stay inside the movement bounds',()=>{
  assert.equal(liveWalkable({x:0,z:43.1}),false);
  for(const destination of [{x:0,z:43.7},{x:34.4,z:40},{x:-34.4,z:-43.7}]){
    const path=findLivePath({x:0,z:39},destination);assert.ok(path.length);
    assert.ok(path.every(p=>Math.abs(p.x)<=34&&Math.abs(p.z)<=43));
  }
});

test('actors inside the extra navigation margin can depart without crossing physical walls',()=>{
  const from={x:17.42489522659554,z:6.104887244385917},to={x:-18,z:9};
  assert.equal(liveWalkable(from),false);
  assert.ok(!LIVE_FPS_MAP.solids.some(w=>segmentHitsWall(from,from,w,LIVE_ACTOR_RADIUS)));
  const path=findLivePath(from,to);assert.ok(path.length);
  let previous=from;
  for(const point of path){
    assert.ok(!LIVE_FPS_MAP.solids.some(w=>segmentHitsWall(previous,point,w,LIVE_ACTOR_RADIUS)));
    previous=point;
  }
  const context={position:from,role:'entry',remaining:80,judgment:1,allies:[],beliefs:[],committed:false,visited:new Set(),execute:false,routeTo:createLiveRoutePlanner({x:0,z:33})};
  assert.equal(chooseLiveApproach([{key:'entry',point:to,purpose:'entry'}],context,()=>0),undefined);
});

test('the device cannot be recovered or defused through the thin loggia wall',()=>{
  for(const attacking of [true,false]){
    const sim=game(),p=sim.actors[attacking?5:0];
    Object.assign(p,{x:-25,z:25.9,bomb:false,channel:0,speed:0,vx:0,vz:0});
    sim.bomb={status:attacking?'dropped':'planted',x:-25,z:26.9,site:'A',remaining:30};
    assert.equal(sim.objective(p,1/30),false);assert.equal(p.bomb,false);assert.equal(p.channel,0);
  }
});
