import {FPS_T_POSITIONS,FPS_CT_POSITIONS} from './fps/fpsPlayerArchitecture.ts';
import {segmentHitsWall} from './fps/fpsSpatialWorld.ts';
import test from 'node:test';
import assert from 'node:assert/strict';
import {FpsLiveSimulation} from './fps/fpsLiveSimulation.ts';
import {FPS_IDENTITY_PERSONALITIES,generatePlayerDNA} from './fps/fpsIdentity.ts';
import {LIVE_FPS_MAP,LIVE_BOOST_SPOTS,liveActorSolids,findLivePath,liveWalkable,distance,liveSightline} from './fps/fpsLiveMap.ts';
import {LIVE_RIVER,LIVE_BRIDGE,LIVE_TERRAIN_SOLIDS,LIVE_B_APARTMENTS,liveGroundHeight,liveCutPavingRect,liveTerrainPathClear} from './fps/fpsLiveTerrain.ts';
import {LIVE_C4_RULES,liveC4Damage} from './fps/fpsLiveBomb.ts';
import {planLiveBombEscape} from './fps/fpsLivePlanning.ts';
import {createLiveRagdoll,stepLiveRagdoll} from './fps/fpsLiveRagdoll.ts';
import {LIVE_WEAPONS} from './fps/fpsLiveWeapons.ts';

const plan={tempo:.6,structure:.7,aggression:.5,preparation:.7,freedom:.5,economy:.8};
const coach={...plan,rigidity:.7,communication:.7,leadership:.7,adaptability:.7,development:.5};
const chemistry={trust:.6,communication:.6,understanding:.6,leadershipAcceptance:.6,roleCompetition:.3};
const cards=Array.from({length:10},(_,i)=>({id:`reg-${i}`,name:`Operative ${i}`,stats:{rifling:80,positioning:80,entry:80,sniping:80,utility:80,shotcalling:80}}));
const identity={players:Object.fromEntries(cards.map((p,i)=>[p.id,{id:p.id,assignments:{t:FPS_T_POSITIONS[(i)%5],ct:FPS_CT_POSITIONS[(i)%5]},personality:FPS_IDENTITY_PERSONALITIES[i],dna:generatePlayerDNA(p.id),intensity:.6,roleSuitability:.6,familiarity:.5}])),teams:{blue:{coach,plan,chemistry},red:{coach,plan,chemistry}}};
const game=()=>new FpsLiveSimulation(cards.slice(0,5),cards.slice(5),1337,identity);
function liveScenario(attacking=true,site='A',timer=12){
 const sim=game();Object.assign(sim,{phase:'live',time:20,roundLiveAt:0,liveElapsed:35,site});sim.pendingBuys.clear();
 for(const a of sim.actors)Object.assign(a,{hp:0,target:undefined,nextSense:Infinity,nextThink:Infinity,nextShot:Infinity,flash:0,smoke:0,he:0,incendiary:0});
 const p=sim.actors.find(a=>a.attacking===attacking),enemy=sim.actors.find(a=>a.attacking!==attacking);
 const at=site==='A'?{x:-23,z:18.1}:{x:23,z:18.1};
 Object.assign(p,{...at,hp:100,armor:100,bomb:false,crouch:false,jump:false,jumpY:0,jumpVy:0,channel:0,kit:false,vx:0,vz:0,speed:0,goal:undefined,path:[],weaponReady:0,reload:0,nextThink:0,freezeDelay:0,contact:undefined,contactAt:-100});
 Object.assign(enemy,{hp:100,x:0,z:-33,bomb:false,goal:undefined,path:[],freezeDelay:0});
 sim.bomb={...at,status:'planted',site,remaining:timer};
 return {sim,p,enemy};
}

test('central bridge is lower and the removed right branch leaves no deck, rail or support behind',()=>{
 assert.equal(LIVE_BRIDGE.deckY,1);assert.equal(liveGroundHeight({x:0,z:0}),1);
 assert.ok(!LIVE_FPS_MAP.solids.some(w=>w.id.startsWith('mid-catwalk-')));
 assert.ok(!LIVE_TERRAIN_SOLIDS.some(w=>w.id==='bridge-market-deck'));
 assert.equal(liveGroundHeight({x:12,z:4,level:'canal'}),-1.2);
 assert.equal(liveWalkable({x:12,z:4}),false);
 for(const side of [-1,1])assert.ok(LIVE_FPS_MAP.solids.some(w=>w.id===`bridge-parapet-${side}-bank`&&w.baseY===1&&w.height===1.85));
 assert.deepEqual(LIVE_BOOST_SPOTS,[]);
});

test('five-metre urban canal and landscape cut continue beyond both arena bounds',()=>{
 assert.equal(LIVE_RIVER.maxZ-LIVE_RIVER.minZ,5);
 for(const x of [-110,-40,0,40,110])for(const z of [-2,0,2]){
  const patches=liveCutPavingRect({minX:-115,maxX:115,minZ:-125,maxZ:125});
  assert.ok(!patches.some(r=>x>r.minX&&x<r.maxX&&z>r.minZ&&z<r.maxZ));
 }
 for(const wall of LIVE_FPS_MAP.solids.filter(w=>/^(west|east)-wall-/.test(w.id)))assert.ok(wall.maxZ<=LIVE_RIVER.minZ||wall.minZ>=LIVE_RIVER.maxZ);
});

test('lower bridge arch passes a real head-height sightline but stops a ray through its deck',()=>{
 assert.equal(liveSightline({x:-3,z:4,level:'canal'},{x:3,z:4,level:'canal'},.4,.4),true);
 assert.equal(liveSightline({x:-3,z:4,level:'canal'},{x:3,z:4,level:'canal'},.9,.9),false);
});

function walk(from,to,maxTicks=2400){
 const sim=game(),p=sim.actors[0];for(const a of sim.actors)a.hp=a===p?100:0;
 Object.assign(sim,{phase:'live',time:20,roundLiveAt:0});
 Object.assign(p,{...from,jump:false,jumpY:liveGroundHeight(from),jumpVy:0,crouch:false,vx:0,vz:0,speed:0,goal:to,path:findLivePath(from,to),objectiveUrgent:true,nextJump:Infinity,nextPeek:Infinity,freezeDelay:0,target:undefined,contact:undefined,reload:0,equipped:'knife',weaponReady:0});
 assert.ok(p.path.length);
 let peak=p.jumpY,airborne=false;
 for(let i=0;i<maxTicks&&distance(p,to)>.25;i++){sim.time+=1/30;sim.advanceElevation(p,1/30);sim.move(p,1/30);peak=Math.max(peak,p.jumpY);airborne||=p.jump;}
 assert.ok(distance(p,to)<.4,JSON.stringify({p:{x:p.x,z:p.z,y:p.jumpY,level:p.level},to,path:p.path}));
 return {p,peak,airborne};
}

test('a real actor walks both gentle central stair flights without jumping',()=>{
 const result=walk({x:0,z:-11.5},{x:0,z:10.4});
 assert.equal(result.airborne,false);assert.ok(Math.abs(result.peak-1)<1e-6);assert.equal(result.p.jumpY,0);
});

test('lower walkway routes around stair landings, under the bridge and into the apartment stairs',()=>{
 const result=walk({x:-19,z:5,level:'canal'},LIVE_B_APARTMENTS.hold);
 assert.ok(Math.abs(result.p.jumpY-1.8)<1e-6);assert.equal(result.airborne,false);
});

test('the bakery service lane and southern landing do not become isolated navigation islands',()=>{
 const from={x:-8,z:-10},to={x:0,z:-10},path=findLivePath(from,to);assert.ok(path.length);
 let prev=from;for(const p of path){assert.ok(liveTerrainPathClear(prev,p));prev=p;}
 assert.deepEqual(path.at(-1),to);
});

test('both sites provide reachable escape routes beyond the lethal radius',()=>{
 for(const site of ['A','B']){
  const at=site==='A'?{x:-23,z:18.1}:{x:23,z:18.1},escape=planLiveBombEscape(at,at);
  assert.ok(escape);assert.ok(escape.path.length);assert.ok(distance(escape.point,at)>=LIVE_C4_RULES.safeDistance);assert.ok(Number.isFinite(escape.seconds));
 }
});

test('attackers evacuate both sites and survive an actual bomb detonation',()=>{
 for(const site of ['A','B']){
  const {sim,p}=liveScenario(true,site,14);
  for(let i=0;i<480&&sim.phase==='live';i++)sim.step();
  assert.equal(sim.bomb.status,'exploded',site);assert.ok(p.hp>0,`${site}: ${p.action} / ${p.intent}`);
  assert.ok(distance(p,sim.bomb)>=LIVE_C4_RULES.radius,JSON.stringify({site,x:p.x,z:p.z}));
 }
});

test('attackers keep defending during a healthy bomb timer rather than abandoning the site immediately',()=>{
 const {sim,p}=liveScenario(true,'A',38);sim.decide(p);assert.equal(p.bombEscape,undefined);assert.ok(distance(p.goal,sim.bomb)<24);
});

test('a reachable kit defuse is completed rather than replaced by an evacuation',()=>{
 const {sim,p}=liveScenario(false,'A',20);p.kit=true;
 for(let i=0;i<250&&sim.phase==='live';i++)sim.step();
 assert.equal(sim.bomb.status,'defused');assert.equal(p.bombEscape,undefined);assert.ok(p.hp>0);
});

test('a defender saves when there is time to escape but not to complete a defuse',()=>{
 const {sim,p}=liveScenario(false,'A',9.5);
 for(let i=0;i<330&&sim.phase==='live';i++)sim.step();
 assert.equal(sim.bomb.status,'exploded');assert.ok(p.hp>0,p.intent);assert.ok(distance(p,sim.bomb)>=16);
});

test('the bomb remains lethal to both forces and uses actual cover/elevation',()=>{
 const {sim,p,enemy}=liveScenario(true,'A',1);Object.assign(enemy,{x:p.x,z:p.z,armor:p.armor,jumpY:p.jumpY});
 assert.equal(liveC4Damage(sim.bomb,p,p.armor),liveC4Damage(sim.bomb,enemy,enemy.armor));
 sim.explodeBomb();assert.equal(p.hp,0);assert.equal(enemy.hp,0);
 assert.equal(liveC4Damage(sim.bomb,{x:p.x+18,z:p.z},100),0);
 assert.equal(liveC4Damage(sim.bomb,p,100,false,30),0);
});

test('freeze permits full-yaw teammate looks for CT and T without moving feet or firing',()=>{
 const sim=game();sim.pendingBuys.clear();const before=sim.actors.map(p=>({x:p.x,z:p.z}));
 for(const p of sim.actors){const yaw=p.attacking?-2.4:2.4;p.buyAt=undefined;p.buyLook={point:{x:p.x+Math.sin(yaw)*3,z:p.z+Math.cos(yaw)*3},until:10};}
 for(let i=0;i<45;i++)sim.step();
 sim.actors.forEach((p,i)=>{assert.deepEqual({x:p.x,z:p.z},before[i]);const expected=p.attacking?-2.4:2.4;assert.ok(Math.abs(Math.atan2(Math.sin(p.yaw-expected),Math.cos(p.yaw-expected)))<.02);assert.equal(p.impact.shots,0);});
});

test('both forces turn for a paid weapon pass and collect it only after flight',()=>{
 for(const attacking of [false,true]){
  const sim=game();sim.pendingBuys.clear();const side=sim.actors.filter(a=>a.attacking===attacking),donor=side[0],p=side[1],weapon=attacking?'ak47':'m4a1_s';
  p.buyAt=.8;sim.pendingBuys.set(p.id,{...p,cash:p.cash,weapon,giftFrom:donor.id,utilityStock:[]});
  for(let i=0;i<25;i++)sim.step();
  const pass=sim.droppedWeapons.find(w=>w.reservedFor===p.id);assert.ok(pass);assert.equal(p.weapon,attacking?'glock':'usp_s');
  assert.equal(pass.from.x,donor.x);assert.ok(pass.fromY>1);assert.ok(Math.cos(donor.yaw-Math.atan2(p.x-donor.x,p.z-donor.z))>.95);
  for(let i=0;i<30;i++)sim.step();assert.equal(p.weapon,weapon);assert.equal(p.ammo,LIVE_WEAPONS[weapon].magazine);assert.ok(!sim.droppedWeapons.some(w=>w.reservedFor===p.id));
 }
});

test('a paid utility reserve can be passed to a teammate without early collection or carry overflow',()=>{
 for(const attacking of [false,true]){
  const sim=game();sim.pendingBuys.clear();for(const a of sim.actors)Object.assign(a,{flash:2,smoke:1,he:1,incendiary:0});
  const side=sim.actors.filter(a=>a.attacking===attacking),donor=side[0],p=side[1];Object.assign(p,{flash:0,smoke:0,he:0});
  donor.buyAt=.8;sim.pendingBuys.set(donor.id,{...donor,cash:donor.cash-300,utilityStock:['smoke']});
  for(let i=0;i<25;i++)sim.step();const item=sim.droppedUtility.find(w=>w.reservedFor===p.id);assert.ok(item);assert.equal(p.smoke,0);
  for(let i=0;i<30;i++)sim.step();assert.equal(p.smoke,1);assert.ok(p.flash+p.smoke+p.he+p.incendiary<=4);assert.equal(donor.cash,500);
 }
});

test('head, torso and leg hits lead with their corresponding joints and preserve finite constrained bodies',()=>{
 const body={id:1,playerId:'p',attacking:true,at:0,x:0,z:-20,y:0,yaw:0,vx:0,vz:0,crouch:false};
 const create=region=>createLiveRagdoll({...body,impact:{region,point:{x:0,y:region==='head'?1.54:region==='legs'?.38:1.23,z:-20},direction:{x:1,y:0,z:0},strength:1}});
 const velocity=(r,key)=>(r.points[key].x-r.points[key].px)*60;
 const head=create('head'),torso=create('torso'),legs=create('legs');
 assert.ok(velocity(head,'head')>velocity(head,'chest')*2);assert.ok(velocity(torso,'chest')>velocity(torso,'head'));assert.ok(velocity(legs,'lk')>velocity(legs,'chest'));
 for(const rag of [head,torso,legs]){for(let i=0;i<240;i++)stepLiveRagdoll(rag,1/60);for(const p of Object.values(rag.points)){assert.ok(Number.isFinite(p.x+p.y+p.z));assert.ok(p.y>=-.01);}}
});

test('descending beside a quay wall lands on its top instead of entering the wall and freezing',()=>{
 const sim=game(),p=sim.actors[0];for(const a of sim.actors)a.hp=a===p?100:0;
 Object.assign(p,{x:-20.377685390450715,z:4.21662692941818,level:'canal',jump:true,jumpY:0,jumpVy:0,vx:0,vz:0,crouch:false});
 for(let i=0;i<90;i++){
  sim.time+=1/30;sim.advanceElevation(p,1/30);sim.applyMotion(p,{x:i<6?0:1.4,z:0},1/30,'walk');
  assert.ok(!liveActorSolids(p,p.jumpY,1.72).some(w=>segmentHitsWall(p,p,w,.349)));
 }
 assert.ok(p.x>-19);assert.ok(Math.abs(p.jumpY-liveGroundHeight(p))<1e-6);
});

test('concurrent utility passes reserve carry capacity and leave surplus stock on the floor',()=>{
 const sim=game();sim.pendingBuys.clear();for(const a of sim.actors)Object.assign(a,{flash:2,smoke:1,he:1,incendiary:0});
 const side=sim.actors.filter(a=>a.attacking),recipient=side[2];Object.assign(recipient,{flash:0,smoke:0,he:0});
 for(const donor of side.slice(0,2)){donor.buyAt=.8;sim.pendingBuys.set(donor.id,{...donor,cash:donor.cash-300,utilityStock:['smoke']});}
 for(let i=0;i<25;i++)sim.step();
 assert.equal(sim.droppedUtility.filter(w=>w.reservedFor===recipient.id).length,1);assert.equal(sim.droppedUtility.filter(w=>!w.reservedFor).length,1);
 for(let i=0;i<30;i++)sim.step();assert.equal(recipient.smoke,1);assert.equal(sim.droppedUtility.length,1);
});

test('respawn and side-swap pistol resets cannot retain an old primary magazine during staggered buys',()=>{
 for(const round of [2,16]){
  const sim=game();for(const p of sim.actors)Object.assign(p,{hp:0,weapon:'negev',equipped:'negev',ammo:150,reserve:200});
  sim.round=round;sim.startRound();
  for(const p of sim.actors){assert.equal(p.weapon,p.attacking?'glock':'usp_s');assert.equal(p.equipped,p.weapon);assert.equal(p.ammo,LIVE_WEAPONS[p.weapon].magazine);assert.equal(p.reserve,LIVE_WEAPONS[p.weapon].reserve);}
  for(let i=0;i<180;i++){sim.step();for(const p of sim.actors)assert.ok(p.ammo<=LIVE_WEAPONS[p.weapon].magazine);}
 }
});

test('jumping beneath the lower bridge hits the vault instead of passing through its ceiling',()=>{
 const sim=game(),p=sim.actors[0];Object.assign(p,{x:0,z:4,level:'canal',jump:true,jumpY:-1.2,jumpVy:4.2,crouch:false});
 let peak=-1.2;for(let i=0;i<90;i++){sim.advanceElevation(p,1/30);peak=Math.max(peak,p.jumpY);assert.ok(!liveActorSolids(p,p.jumpY,1.72).some(w=>segmentHitsWall(p,p,w,.349)));}
 assert.ok(peak<-.8);assert.ok(Math.abs(p.jumpY+1.2)<1e-6);assert.equal(p.jump,false);
});
