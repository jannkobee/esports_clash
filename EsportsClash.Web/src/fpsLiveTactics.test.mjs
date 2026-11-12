import test from 'node:test';
import assert from 'node:assert/strict';
import {FpsLiveSimulation} from './fps/fpsLiveSimulation.ts';
import {LIVE_FPS_MAP,LIVE_TACTICAL,LIVE_MID,LIVE_CHOKES,livePathLength,findLivePath,liveWalkable,liveSightline,liveWallIntersections,liveWallSegmentHit} from './fps/fpsLiveMap.ts';
import {liveRayDirection,traceLiveActorHit} from './fps/fpsLiveBallistics.ts';
import {segmentHitsWall,moveFpsActor} from './fps/fpsSpatialWorld.ts';
import {LIVE_KNIFE} from './fps/fpsLiveWeapons.ts';
import {advanceLiveVelocity,liveShotSpeedLimit,LIVE_RUN_SPEED,LIVE_WALK_SPEED,LIVE_CROUCH_SPEED} from './fps/fpsLiveMovement.ts';
import {buyLiveTeam} from './fps/fpsLiveEconomy.ts';
import {launchLiveGrenade,stepLiveGrenade,liveGrenadeSightline} from './fps/fpsLiveGrenades.ts';
import {FPS_IDENTITY_PERSONALITIES,generatePlayerDNA} from './fps/fpsIdentity.ts';

const plan={tempo:.6,structure:.7,aggression:.5,preparation:.7,freedom:.5,economy:.8};
const coach={tempo:.6,rigidity:.7,aggression:.5,preparation:.7,freedom:.5,economy:.8,communication:.7,leadership:.7,adaptability:.7,development:.5};
const chemistry={trust:.6,communication:.6,understanding:.6,leadershipAcceptance:.6,roleCompetition:.3};
const cards=Array.from({length:10},(_,i)=>({id:`tactics-${i}`,name:`Player ${i}`,stats:{lan:80,iq:80,tf:80,clu:80,sta:80,flx:80,ldr:80}}));
const identity={players:Object.fromEntries(cards.map((p,i)=>[p.id,{id:p.id,personality:FPS_IDENTITY_PERSONALITIES[i],dna:generatePlayerDNA(p.id),intensity:.6,roleSuitability:.6,familiarity:.5}])),teams:{blue:{coach,plan,chemistry},red:{coach,plan,chemistry}}};
const game=()=>new FpsLiveSimulation(cards.slice(0,5),cards.slice(5),1337,identity);

const encounter=()=>{
  const sim=game(),p=sim.actors[0],enemy=sim.actors[5];
  for(const a of sim.actors)Object.assign(a,{hp:0,nextSense:Infinity,nextThink:Infinity});
  Object.assign(p,{hp:100,x:-19,z:-10,yaw:0,armor:0,bomb:false,goal:undefined,path:[],target:enemy.id,acquired:0,aimPoint:{x:-19,z:-7}});
  Object.assign(enemy,{hp:100,x:-19,z:-7,yaw:Math.PI,armor:0,bomb:false,nextShot:Infinity});
  sim.phase='live';sim.time=20;
  return {sim,p,enemy};
};

test('holding a known angle keeps aim steady for the whole quiet period',()=>{
  const {sim,p}=encounter();
  Object.assign(p,{target:undefined,path:[],watchPoint:{x:-19,z:0},yaw:0,contact:undefined,contactAt:-100});
  const samples=[];
  for(let i=0;i<180;i++){sim.time+=1/30;sim.move(p,1/30);samples.push(p.yaw);}
  assert.ok(samples.every(yaw=>yaw===0),'A stationary hold must not add an artificial scan');
  assert.equal(p.x,-19);assert.equal(p.z,-10);
});

test('small left/right steering waypoints do not sweep the crosshair off the route',()=>{
  const {sim,p}=encounter();
  Object.assign(p,{target:undefined,watchPoint:undefined,contact:undefined,contactAt:-100,yaw:0});
  for(let i=0;i<90;i++){
    sim.time+=1/30;
    p.path=[{x:-19+(i%2?.3:-.3),z:-9.5},{x:-19,z:5}];
    sim.preAim(p,false);
    assert.ok(Math.abs(p.yaw)<.04,'Aim followed the tiny steering waypoint instead of the corridor');
  }
});

test('new contact interrupts the map hold while changing callouts respect aim commitment',()=>{
  const {sim,p}=encounter();
  Object.assign(p,{target:undefined,path:[],watchPoint:{x:-19,z:0},contact:undefined,contactAt:-100,yaw:0});
  sim.preAim(p,true);
  p.contact={x:-16,z:-5};p.contactAt=sim.time;sim.preAim(p,true);
  assert.equal(p.aimFocus.source,'contact');assert.ok(p.yaw>0);
  const selected={...p.aimFocus.point};p.contact={x:-22,z:-5};p.contactAt=sim.time;
  for(let i=0;i<12;i++){sim.time+=1/30;sim.preAim(p,true);assert.deepEqual(p.aimFocus.point,selected);}
  sim.time+=.7;sim.preAim(p,true);assert.deepEqual(p.aimFocus.point,p.contact);
});

test('aim corrections approach the intended angle without overshoot or hidden-enemy input',()=>{
  const a=encounter(),b=encounter();
  for(const {sim,p} of [a,b])Object.assign(p,{target:undefined,path:[],watchPoint:{x:-12,z:-1},contact:undefined,contactAt:-100,yaw:0});
  Object.assign(b.enemy,{x:31,z:40});
  const desired=Math.atan2(7,9);let previous=0;
  for(let i=0;i<90;i++){
    a.sim.time+=1/30;b.sim.time+=1/30;a.sim.preAim(a.p,true);b.sim.preAim(b.p,true);
    assert.equal(a.p.yaw,b.p.yaw);assert.ok(a.p.yaw>=previous);assert.ok(a.p.yaw<=desired+.000001);previous=a.p.yaw;
  }
  assert.ok(Math.abs(a.p.yaw-desired)<.002);
});

test('A-site terracotta loggia blocks sight, bullets, blades, flashes and movement',()=>{
  const {sim,p,enemy}=encounter();
  Object.assign(p,{x:-25,z:25.8});Object.assign(enemy,{x:-25,z:27});
  assert.equal(liveSightline(p,enemy),false);
  assert.equal(liveGrenadeSightline({...p,y:1.6},{...enemy,y:1.6}),false);
  const stopped=moveFpsActor(p,{x:0,z:1.2},.35,LIVE_FPS_MAP.solids);
  assert.ok(stopped.z<26.1);
  for(let i=0;i<12;i++)sim.fire(p,enemy);
  sim.strikeKnife(p);assert.equal(enemy.hp,100);
  assert.ok(sim.shots.every(s=>s.to.z<26.5));
  const route=findLivePath({x:-25,z:24},{x:-25,z:29});assert.ok(route.length);
  let previous={x:-25,z:24};for(const point of route){assert.ok(liveSightline(previous,point));previous=point;}
});

test('3D gun rays pass over low cover only when the visible shot line clears its height',()=>{
  const wall=LIVE_FPS_MAP.solids.find(s=>s.id==='b-sandbags');
  const from={x:24,z:0},to={x:24,z:8};
  assert.ok(wall);
  assert.equal(liveWallSegmentHit({...from,y:1.54},{...to,y:1.54},wall),undefined);
  assert.ok(liveWallSegmentHit({...from,y:1.0},{...to,y:1.0},wall)!==undefined);
});

test('B fountain vision and projectile walls follow its round open basin and visible centrepiece',()=>{
  const grazingFrom={x:20,z:18.7},grazingTo={x:26,z:18.7};
  assert.equal(liveSightline(grazingFrom,grazingTo,1.54,1.54),true,'the square collision corners are outside the rendered round fountain');
  assert.equal(liveWallIntersections({...grazingFrom,y:1.54},{...grazingTo,y:1.54}).some(hit=>hit.wall.id==='b-fountain'),false);

  const centreFrom={x:16,z:21},centreTo={x:30,z:21};
  assert.equal(liveSightline(centreFrom,centreTo,1.54,1.54),false,'the ray crosses the rendered upper bowl');
  assert.ok(liveWallIntersections({...centreFrom,y:1.54},{...centreTo,y:1.54}).some(hit=>hit.wall.id==='b-fountain'));
});

test('3D actor traces distinguish head hits from body hits by the actual impact height',()=>{
  const target={x:0,z:10,crouch:false,jumpY:0},from={x:0,y:1.54,z:0};
  const head=traceLiveActorHit(from,liveRayDirection(0,0),20,target);
  const body=traceLiveActorHit({x:0,y:1,z:0},liveRayDirection(0,0),20,target);
  assert.equal(head?.region,'head');assert.equal(body?.region,'body');
  assert.equal(traceLiveActorHit({x:0,y:1.9,z:0},liveRayDirection(0,0),20,target),undefined);
});

test('a precise shot aimed at the visible head resolves and traces the same head impact',()=>{
  const {sim,p,enemy}=encounter();
  Object.assign(p,{x:0,z:0,yaw:0,pitch:0,weapon:'sniper',ammo:5,reserve:0,acquired:sim.time,burst:0});
  Object.assign(enemy,{x:0,z:10,hp:100,crouch:false,jumpY:0});
  sim.fire(p,enemy);
  const shot=sim.shots.at(-1);
  assert.equal(shot.targetId,enemy.id);assert.equal(shot.hitRegion,'head');
  assert.ok(shot.to.z<enemy.z);assert.equal(p.impact.headshots,1);assert.ok(enemy.hp<100);
});

test('the B fountain centrepiece stops a head-level round before its target',()=>{
  const {sim,p,enemy}=encounter();
  Object.assign(p,{x:16,z:21,yaw:Math.PI/2,pitch:0,weapon:'ak47',ammo:30,reserve:0,acquired:sim.time,burst:0});
  Object.assign(enemy,{x:30,z:21,hp:100,crouch:false,jumpY:0});
  sim.fire(p,enemy);
  const shot=sim.shots.at(-1);
  assert.equal(shot.targetId,undefined);assert.ok(shot.to.x<enemy.x);assert.equal(enemy.hp,100);
});

test('stopping near a teammate does not inject separation drift into aim or objective channels',()=>{
  const {sim,p}=encounter(),ally=sim.actors[1];
  Object.assign(ally,{hp:100,x:p.x+.72,z:p.z});
  for(let i=0;i<30;i++)sim.applyMotion(p,{x:0,z:0},1/30,'brake');
  assert.equal(p.x,-19);assert.equal(p.z,-10);assert.equal(p.speed,0);
});

test('tracking uses sampled sight and cannot acquire enemies behind the player',()=>{
  const {sim,p,enemy}=encounter();sim.perceive(p);
  assert.deepEqual(p.aimPoint,{x:-19,z:-7});
  enemy.x=-18;sim.step();assert.deepEqual(p.aimPoint,{x:-19,z:-7});
  sim.perceive(p);assert.deepEqual(p.aimPoint,{x:-18,z:-7});
  enemy.x=p.x;enemy.z=p.z-1;p.target=undefined;sim.perceive(p);
  assert.equal(p.target,undefined,'Close rear enemies should be heard or discovered by turning, not seen through the back of the head');
});

test('knife travel retains the gun and ammunition and contact incurs a real draw delay',()=>{
  const {sim,p,enemy}=encounter();
  Object.assign(p,{weapon:'rifle',equipped:'rifle',ammo:19,reserve:43,target:undefined,decision:'coordinate',path:[{x:-19,z:1}],contactAt:-100});
  sim.chooseEquipment(p);assert.equal(p.equipped,'knife');assert.equal(p.weapon,'rifle');
  assert.equal(p.ammo,19);assert.equal(p.reserve,43);
  sim.chooseEquipment(p,enemy);assert.equal(p.equipped,'rifle');assert.ok(p.weaponReady>.6);
  p.target=enemy.id;sim.step();assert.equal(p.impact.shots,0);
  const publicPlayer=sim.snapshot().players[0];assert.equal(publicPlayer.equipped,'rifle');assert.ok(publicPlayer.weaponReady>0);
});

test('knife windup, cooldown, misses and kills are authoritative without bullets or headshots',()=>{
  const {sim,p,enemy}=encounter();
  Object.assign(p,{ammo:0,reserve:0,equipped:'knife',weaponReady:0,aimPoint:{x:-19,z:-9}});
  Object.assign(enemy,{z:-9,hp:40});
  const ammo=p.ammo;sim.step();assert.equal(enemy.hp,40);assert.ok(p.swingAt>sim.time);
  for(let i=0;i<6;i++)sim.step();
  assert.equal(enemy.hp,0);assert.equal(p.kills,1);assert.equal(p.ammo,ammo);
  assert.equal(p.impact.shots,0);assert.equal(p.impact.headshots,0);assert.equal(p.impact.damage,40);
  assert.equal(sim.events.find(e=>e.kind==='kill').weapon,'knife');
  const miss=encounter();Object.assign(miss.p,{ammo:0,reserve:0,equipped:'knife',aimPoint:{x:-19,z:-9}});miss.enemy.z=-9;
  miss.sim.step();miss.enemy.z=-6;
  for(let i=0;i<6;i++)miss.sim.step();assert.equal(miss.enemy.hp,100,'A target leaving during windup must not take remote damage');
});

test('knife reach and nearest teammate blocking apply, with a directional back strike',()=>{
  const {sim,p,enemy}=encounter();enemy.z=-9;enemy.yaw=0;
  sim.strikeKnife(p);assert.equal(enemy.hp,100-LIVE_KNIFE.backDamage);
  enemy.hp=100;enemy.yaw=Math.PI;sim.strikeKnife(p);assert.equal(enemy.hp,100-LIVE_KNIFE.damage);
  enemy.hp=100;enemy.z=-6;sim.strikeKnife(p);assert.equal(enemy.hp,100);
  enemy.z=-8.5;Object.assign(sim.actors[1],{hp:100,x:-19,z:-9.25});
  sim.strikeKnife(p);assert.equal(enemy.hp,100);assert.equal(sim.actors[1].hp,100);
});

test('dropped gun pickup conserves exact ammo and cannot reach through the loggia',()=>{
  const {sim,p,enemy}=encounter();enemy.x=31;enemy.z=30;p.target=undefined;
  sim.droppedWeapons=[{id:999,weapon:'rifle',ammo:0,reserve:7,x:p.x,z:p.z}];
  sim.step();assert.equal(p.weapon,'rifle');assert.equal(p.ammo,0);assert.equal(p.reserve,7);assert.ok(p.weaponReady>0);
  const other=encounter();other.p.target=undefined;other.enemy.x=31;other.enemy.z=30;
  Object.assign(other.p,{x:-25,z:25.8});
  other.sim.droppedWeapons=[{id:999,weapon:'rifle',ammo:20,reserve:17,x:-25,z:27}];
  other.sim.step();assert.equal(other.p.weapon,'pistol');assert.equal(other.sim.droppedWeapons.length,1);
});

test('three lanes, smoke-sized gates and measured rotation/setup routes are usable',()=>{
  for(const side of Object.values(LIVE_TACTICAL))for(const p of [...side.staging,...side.rally,...side.entries,...side.holds,...side.postPlant]){
    assert.ok(liveWalkable(p),JSON.stringify(p));assert.ok(findLivePath(LIVE_FPS_MAP.spawns.attackers,p).length);
  }
  assert.ok(liveSightline({x:0,z:-17},LIVE_MID.control),'Mid corridor must be continuous');
  assert.ok(!liveSightline(LIVE_FPS_MAP.spawns.attackers,{x:0,z:28}),'Mid must not be an endless spawn sightline');
  for(const site of ['A','B'])assert.ok(findLivePath(LIVE_MID.control,LIVE_MID.splits[site]).length);
  const rotation=livePathLength(LIVE_FPS_MAP.sites.A,LIVE_FPS_MAP.sites.B)/LIVE_RUN_SPEED;
  assert.ok(rotation>=10&&rotation<=15,`Rotation ${rotation}`);
  for(const gate of LIVE_CHOKES){
    assert.ok(gate.width<=8);assert.ok(liveWalkable(gate.center));
    for(const side of [-1,1]){const edge={x:gate.center.x+side*(gate.width/2+.05),z:gate.center.z};assert.ok(LIVE_FPS_MAP.solids.some(w=>segmentHitsWall(edge,edge,w)),`${gate.name} lacks a physical side wall`);}
  }
  for(const site of ['A','B']){
    const gate=LIVE_CHOKES.find(g=>g.name===`${site} main`);
    const lead=(livePathLength(LIVE_FPS_MAP.spawns.attackers,gate.center)-livePathLength(LIVE_FPS_MAP.spawns.defenders,LIVE_FPS_MAP.sites[site]))/LIVE_RUN_SPEED;
    assert.ok(lead>=2&&lead<=6,`${site} setup lead ${lead}`);
  }
});

test('counter-strafing takes time and high mechanics recovers accuracy sooner',()=>{
  const stop=mechanics=>{let v={vx:LIVE_RUN_SPEED,vz:0},ticks=0;while(Math.hypot(v.vx,v.vz)>liveShotSpeedLimit('rifle',mechanics)&&ticks<30){v=advanceLiveVelocity(v,{x:0,z:0},1/30,mechanics);ticks++;}return ticks;};
  assert.ok(stop(.9)>1);assert.ok(stop(.9)<stop(.2));assert.ok(liveShotSpeedLimit('sniper',1)>0);
  const sim=game(),p=sim.actors[0],enemy=sim.actors[5];
  for(const actor of sim.actors){actor.hp=0;actor.nextSense=Infinity;actor.nextThink=Infinity;}
  Object.assign(p,{hp:100,x:-19,z:-10,yaw:0,vx:LIVE_RUN_SPEED,vz:0,speed:LIVE_RUN_SPEED,target:enemy.id,acquired:0});
  Object.assign(enemy,{hp:1,x:-19,z:-7,yaw:Math.PI,nextShot:Infinity});
  sim.phase='live';sim.time=20;
  sim.step();assert.equal(p.impact.shots,0,'Moving rifle shot was fired before braking');
  for(let i=0;i<10;i++)sim.step();assert.ok(p.impact.shots>0);assert.equal(enemy.hp,0);
});

test('attackers probe a site approach without waiting for a scripted entry phase',()=>{
  const sim=game(),p=sim.actors[0];for(const actor of sim.actors)actor.hp=0;
  sim.site='A';sim.protocol.site='A';sim.time=20;
  Object.assign(p,{hp:100,slot:1,attacking:true,role:'entry',x:LIVE_FPS_MAP.spawns.attackers.x,z:LIVE_FPS_MAP.spawns.attackers.z});
  sim.decide(p);
  assert.equal(sim.protocol.style,'adaptive');
  assert.ok(LIVE_TACTICAL.A.entries.some(point=>Math.hypot(p.goal.x-point.x,p.goal.z-point.z)<.01));
  assert.match(p.intent,/Probe|approach/);
});

test('trade actors choose a useful distance behind a teammate taking space',()=>{
  const sim=game(),trade=sim.actors[0],entry=sim.actors[1];for(const actor of sim.actors)actor.hp=0;
  sim.site='A';sim.time=20;
  const site=LIVE_FPS_MAP.sites.A,front=LIVE_TACTICAL.A.entries[0],dx=front.x-site.x,dz=front.z-site.z,length=Math.hypot(dx,dz);
  Object.assign(entry,{hp:100,attacking:true,role:'entry',x:front.x,z:front.z});
  Object.assign(trade,{hp:100,attacking:true,role:'trade',x:front.x+dx/length*5,z:front.z+dz/length*5});
  sim.decide(trade);
  const spacing=Math.hypot(trade.goal.x-front.x,trade.goal.z-front.z);
  assert.ok(spacing>=3.5&&spacing<=6);
  assert.match(trade.intent,/spacing/);
});

test('walking is quiet and running produces uncertain audible contact',()=>{
  const hearAt=speed=>{const sim=game(),source=sim.actors[0],listener=sim.actors[5];for(const p of sim.actors)p.hp=0;
    Object.assign(source,{hp:100,x:-19,z:-12,vx:0,vz:0,speed:0});Object.assign(listener,{hp:100,x:-19,z:-4,seenAt:-100,contactAt:-100});
    for(let i=0;i<24;i++){sim.time+=1/30;sim.applyMotion(source,{x:0,z:speed},1/30,speed>2?'run':'walk');}return listener.contactAt;};
  assert.equal(hearAt(LIVE_WALK_SPEED),-100);assert.ok(hearAt(LIVE_RUN_SPEED)>0);
});

test('team economy conserves money, funds a poor entry and coordinates eco/force choices',()=>{
  const squad=(cash)=>['entry','trade','sniper','support','lurker'].map((role,i)=>({id:`buy-${i}`,role,cash,weapon:'pistol',armor:0,kit:false,flash:0,smoke:0,attacking:true}));
  const rich=squad(10000);rich[0].cash=200;const original=structuredClone(rich),buy=buyLiveTeam(rich,plan,5,0,false);
  assert.deepEqual(rich,original);assert.equal(buy.mode,'full');assert.ok(buy.gifts.some(g=>g.to==='buy-0'));assert.notEqual(buy.players[0].weapon,'pistol');
  assert.equal(original.reduce((n,p)=>n+p.cash,0)-buy.players.reduce((n,p)=>n+p.cash,0),buy.spent);assert.ok(buy.players.every(p=>p.cash>=0));
  const eco=buyLiveTeam(squad(1400),plan,2,1,false);assert.equal(eco.mode,'eco');assert.ok(eco.players.every(p=>p.weapon==='pistol'));assert.ok(eco.spent<=400);
  const force=buyLiveTeam(squad(1800),plan,15,1,true);assert.equal(force.mode,'force');assert.ok(force.players.some(p=>p.weapon==='smg'));assert.ok(force.players.every(p=>p.cash>=0));
});

test('grenades have flight time, bounce off opaque geometry and cannot flash through a wall',()=>{
  const g=launchLiveGrenade(1,'flash','p','blue',{x:-17,z:-8},{x:-10,z:-8},0);
  assert.ok(g.detonateAt>.5);let reversed=false;
  for(let i=0;i<30;i++){stepLiveGrenade(g,1/30);if(g.vx<0)reversed=true;assert.ok(g.y>=.089);}
  assert.ok(reversed,'Wall did not bounce the throw');assert.ok(!liveGrenadeSightline(g,{x:-10,y:1.6,z:-8}));
});

test('actors can throw from their own utility decision and publish a throw-animation timestamp',()=>{
  const sim=game(),p=sim.actors[0];sim.time=20;
  Object.assign(p,{hp:100,flash:1,reload:0,utilityAt:0,x:-19,z:-7});
  assert.equal(sim.throwUtility(p,'flash',{x:-14,z:-4}),true);
  assert.equal(p.throwAt,undefined);assert.equal(p.throwKind,'flash');
  assert.equal(p.utilityPreparation.readyAt,20.55,'the grenade should remain in the equip/setup phase');
  const publicPlayer=sim.snapshot().players.find(player=>player.id===p.id);
  assert.equal(publicPlayer.throwAt,undefined);assert.equal(publicPlayer.throwKind,'flash');
  assert.equal(publicPlayer.utilityPrep.releaseAt,20.75);
  sim.time=20.55;sim.releaseUtilityPreparation(p);
  assert.equal(p.throwAt,20.55,'the throw animation begins after grenade equip');
  assert.equal(p.flash,0);
  assert.equal(sim.protocol.phase,'default','A throw must not wait for or advance a scripted utility phase');
});

test('utility setup is rejected during visible combat and ally damage scales across rifle fire and HE',()=>{
  const {sim,p,enemy}=encounter(),ally=sim.actors[1];
  p.flash=1;p.utilityAt=0;
  assert.equal(sim.throwUtility(p,'flash',{x:-14,z:-4}),false,'visible contact should keep the gun out');
  assert.equal(p.utilityPreparation,undefined);

  enemy.hp=0;p.target=undefined;p.weapon='ak47';p.ammo=30;p.equipped='ak47';p.yaw=0;
  Object.assign(ally,{hp:100,team:p.team,x:-19,z:-6,armor:0});
  sim.fire(p,ally);
  assert.ok(ally.hp<100,'a teammate hit by rifle fire must lose health');
  assert.equal(p.impact.damage,0,'friendly damage must not inflate enemy performance reports');
  assert.equal(p.kills,0,'friendly damage must not grant an enemy kill');
});

test('HE blasts damage self and teammates at reduced rates while retaining full enemy damage',()=>{
  const {sim,p,enemy}=encounter(),ally=sim.actors[1];
  Object.assign(p,{hp:100,x:1,z:0,armor:0});
  Object.assign(ally,{hp:100,x:-1,z:0,armor:0,team:p.team});
  Object.assign(enemy,{hp:100,x:0,z:1,armor:0});
  const before={self:p.hp,ally:ally.hp,enemy:enemy.hp};
  sim.time=20;
  sim.grenades=[{id:901,kind:'he',actorId:p.id,team:p.team,x:0,y:.1,z:0,vx:0,vy:0,vz:0,releaseAt:18,detonateAt:19,coordinated:false}];
  sim.stepGrenades(1/30);
  const loss={self:before.self-p.hp,ally:before.ally-ally.hp,enemy:before.enemy-enemy.hp};
  assert.ok(loss.ally>0&&loss.ally<loss.self&&loss.self<loss.enemy,JSON.stringify(loss));
});

test('autonomous tactical movement remains deterministic and mechanically bounded',()=>{
  const a=game(),b=game();for(let i=0;i<9000;i++){a.step();b.step();if(i%300===0){const state=a.snapshot();assert.deepEqual(state,b.snapshot());for(const p of state.players)assert.ok(!LIVE_FPS_MAP.solids.some(w=>segmentHitsWall(p,p,w,.349)));}}
  const state=a.snapshot();assert.ok(state.round>1);assert.ok(state.players.reduce((n,p)=>n+p.kills,0)>0);assert.ok(!JSON.stringify(state).includes('riskTolerance'));
});

test('crouching caps movement speed and reduces spread bloom',()=>{
  const {sim,p,enemy}=encounter();
  p.crouch=true;
  p.path=[{x:-19,z:10}];
  sim.move(p,1/30);
  assert.ok(p.speed<=LIVE_CROUCH_SPEED+.01,'Crouch speed must not exceed LIVE_CROUCH_SPEED');
  assert.equal(p.stance,'crouch');
  assert.ok(p.action.includes('Crouch')||p.action==='Clearing an angle');

  // Verify crouch spread bonus in fire()
  p.crouch=false;
  p.ammo=30;
  p.reserve=90;
  p.weapon='rifle';
  sim.fire(p,enemy);
  const standShot=sim.shots[sim.shots.length-1];

  p.crouch=true;
  sim.fire(p,enemy);
  const crouchShot=sim.shots[sim.shots.length-1];
  assert.ok(standShot&&crouchShot);
});

test('trailing teammates queue behind leaders without jamming into their back',()=>{
  const {sim,p}=encounter(),ally=sim.actors[1];
  Object.assign(ally,{hp:100,x:-19,z:-5,vx:0,vz:0,speed:0});
  Object.assign(p,{x:-19,z:-7,vx:0,vz:0,speed:0,path:[{x:-19,z:5}]});
  // p is moving north towards z=5, ally is stationed at z=-5 (2m ahead)
  for(let i=0;i<60;i++){
    sim.time+=1/30;
    sim.applyMotion(p,{x:0,z:LIVE_RUN_SPEED},1/30,'run');
  }
  const d=Math.hypot(p.x-ally.x,p.z-ally.y);
  const centerDist=Math.hypot(p.x-ally.x,p.z-ally.z);
  assert.ok(centerDist>=0.9,'Follower must never close inside the 0.9m physical buffer');
});

test('snapshot exports crouch flag for all active players',()=>{
  const sim=game();
  sim.actors[0].crouch=true;
  const snap=sim.snapshot();
  assert.equal(snap.players[0].crouch,true);
  assert.equal(snap.players[1].crouch,false);
});

test('trade fragger reacts immediately with re-frag reflex upon entry elimination',()=>{
  const {sim,p,enemy}=encounter();
  const trade=sim.actors[1];
  Object.assign(trade,{hp:100,role:'trade',x:p.x-1,z:p.z-3,yaw:0,target:undefined,action:'Supporting',team:p.team});
  Object.assign(p,{hp:20,role:'entry'});
  Object.assign(enemy,{hp:100,weapon:'rifle'});
  sim.damage(enemy,p,100,true,'rifle',true);
  assert.equal(p.hp,0);
  assert.equal(trade.target,enemy.id);
  assert.equal(trade.action,'Trading');
  assert.match(trade.radioMessage,/Trading for/);
});

test('sniper cycles bolt behind cover with shoot-and-scoot mechanic after firing',()=>{
  const {sim,p,enemy}=encounter();
  Object.assign(p,{hp:100,weapon:'sniper',role:'sniper',ammo:5,reserve:20});
  sim.fire(p,enemy);
  assert.equal(p.action,'Cycling bolt in cover');
  assert.ok(p.retreatUntil>sim.time);
  assert.match(p.intent,/cycling sniper bolt in cover/);
});

test('support throws proactive pop-flash ahead of entry teammate',()=>{
  const sim=game();
  for(const a of sim.actors)Object.assign(a,{hp:0,nextSense:Infinity,nextThink:Infinity});
  sim.phase='live';sim.time=20;sim.site='B';
  const support=sim.actors[0],entry=sim.actors[1];
  Object.assign(support,{hp:100,role:'support',attacking:true,flash:1,smoke:0,x:19,z:-10,yaw:0});
  Object.assign(entry,{hp:100,role:'entry',attacking:true,x:19,z:-5,yaw:0});
  sim.observeIntel(support,{key:'enemy:reported',observerId:support.id,source:'sight',x:20,z:-4,observed:sim.time,confidence:.9,uncertainty:1});
  const intent=sim.useInformationUtility(support,sim.actors.filter(a=>a.team===support.team&&a.hp>0));
  assert.equal(support.flash,1);assert.equal(support.utilityPreparation.kind,'flash');
  assert.equal(sim.grenades.length,0,'the flash should not leave the hand before its equip/setup delay');
  sim.time+=.55;sim.releaseUtilityPreparation(support);
  assert.equal(support.flash,0);
  assert.equal(sim.grenades.length,1);
  assert.equal(sim.grenades[0].kind,'flash');
  assert.match(intent,/Pop-flash/);
});

test('entry fragger methodically checks and clears close danger corners',()=>{
  const sim=game();
  for(const a of sim.actors)Object.assign(a,{hp:0,nextSense:Infinity,nextThink:Infinity});
  sim.phase='live';sim.time=20;sim.site='B';
  const entry=sim.actors[0];
  Object.assign(entry,{hp:100,role:'entry',attacking:true,x:21,z:-6,yaw:0,target:undefined,bomb:false,cleared:new Set(),nextPeek:0});
  sim.decide(entry);
  assert.ok(entry.cleared.size>0,'Entry fragger must clear close angles on site approach');
  assert.equal(entry.action,'Clearing an angle');
  assert.match(entry.intent,/Check and clear/);
});


test('architectural piers block movement and eye-level vision but leave arch openings clear',()=>{
  for(const id of ['banana-arch-pillar-l','port-arch-pillar-r','church-arch-pillar-l','underpass-sluice-jamb-r']) {
    const wall=LIVE_FPS_MAP.solids.find(w=>w.id===id);
    assert.ok(wall,id);
    const center={x:(wall.minX+wall.maxX)/2,z:(wall.minZ+wall.maxZ)/2};
    assert.equal(liveWalkable(center),false,id);
    assert.equal(liveSightline({x:center.x,z:wall.minZ-.3},{x:center.x,z:wall.maxZ+.3}),false,id);
  }
  assert.equal(liveSightline({x:20,z:5.8},{x:20,z:8.2}),true);
  assert.ok(Number.isFinite(livePathLength({x:-8,z:-10},{x:0,z:-10})));
});

test('sloping sightlines cannot cut through the near edge of low cover',()=>{
  const a={x:18,z:-6},b={x:18,z:3};
  assert.equal(liveSightline(a,b,1,5),false);
  assert.equal(liveSightline(b,a,5,1),false);
  assert.equal(liveSightline(a,b,3,5),true);
});

test('mid control and fake execute release players into the attack',()=>{
  for(const tactic of ['mid_control','fake_execute']) {
    const sim=game(),p=sim.actors[5];
    Object.assign(sim,{phase:'live',time:55,liveElapsed:40,remaining:75,site:'B',tacticArchetype:tactic});
    Object.assign(p,{role:'support',x:0,z:0,bomb:false,flash:0,smoke:0,target:undefined,nextPeek:Infinity});
    sim.decide(p);
    assert.doesNotMatch(p.intent,/Take Mid control|Feint attack/);
    assert.ok(p.goal.z>0);
  }
});


test('a local Mid information choice releases after that space is reached',()=>{
  const sim=game(),p=sim.actors[8];
  Object.assign(sim,{phase:'live',time:30,liveElapsed:15,remaining:100,site:'B',tacticArchetype:'split_b'});
  Object.assign(p,{role:'support',x:0,z:-10,bomb:false,flash:0,smoke:0,target:undefined,nextPeek:Infinity});
  sim.decide(p);
  assert.match(p.intent,/Gather information through Mid/);
  Object.assign(p,{x:0,z:1});sim.decide(p);sim.decide(p);
  assert.ok(p.probeVisited.has('mid:control'));
  assert.notEqual(p.probeGoal,'mid:control');
});

test('a distant attacker does not receive an omniscient defuse alarm',()=>{
  const sim=game(),p=sim.actors[0],enemy=sim.actors[5];
  Object.assign(sim,{phase:'live',time:30});
  sim.bomb={status:'planted',x:-23,z:21,site:'A',remaining:30};
  Object.assign(p,{x:-23,z:21,speed:0,vx:0,vz:0,channel:0,smoke:0,target:undefined});
  Object.assign(enemy,{x:31,z:-30,nextThink:100,intent:'Hold distant angle'});
  assert.equal(sim.objective(p,1/30),true);
  assert.equal(enemy.nextThink,100);
  assert.equal(enemy.intent,'Hold distant angle');
});

test('an urgent device contest releases a previous retreat commitment',()=>{
  const sim=game(),p=sim.actors[5];
  Object.assign(sim,{phase:'live',time:50,remaining:60});
  sim.bomb={status:'planted',x:-23,z:21,site:'A',remaining:4};
  Object.assign(p,{x:-20,z:15,retreatUntil:60,hp:20,bomb:false,flash:0,smoke:0,target:undefined});
  sim.decide(p);
  assert.equal(p.retreatUntil,0);
});


test('defensive stacks learn confirmed sites rather than secret failed calls',()=>{
  const sim=game();
  sim.round=4;
  sim.roundHistory=[1,2,3].map(round=>({round,attackTeam:'red',attackSite:'B',tactic:'rush_b',bombPlanted:false,winner:'blue'}));
  sim.startRound();
  assert.equal(sim.defenseSetup,'standard');
  sim.roundHistory=sim.roundHistory.map(h=>({...h,bombPlanted:true}));
  sim.startRound();
  assert.equal(sim.defenseSetup,'stack_b');
  sim.round=16;sim.startRound();
  assert.equal(sim.defenseSetup,'standard','Side switch must not reuse the other attackers? history');
});
