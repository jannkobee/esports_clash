import test from 'node:test';
import assert from 'node:assert/strict';
import {FpsLiveSimulation} from './fps/fpsLiveSimulation.ts';
import {FPS_IDENTITY_PERSONALITIES,generatePlayerDNA} from './fps/fpsIdentity.ts';
import {chooseLiveApproach,liveSmokeOccludes,canInvestigateLiveContact,shouldFakeLiveDefuse} from './fps/fpsLiveBrain.ts';
import {freshFpsExhibitionSeed} from './fps/fpsExhibitionSeed.ts';
import {recordFpsOpponentPattern,knownFpsTendency} from './fps/fpsOpponentPatterns.ts';
import {launchLiveGrenade,predictLiveGrenade,stepLiveGrenade,LIVE_UTILITY_RULES} from './fps/fpsLiveGrenades.ts';
import {liveShotSpeedLimit,advanceLiveJump,LIVE_JUMP_VELOCITY} from './fps/fpsLiveMovement.ts';
import {liveWalkable} from './fps/fpsLiveMap.ts';

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
