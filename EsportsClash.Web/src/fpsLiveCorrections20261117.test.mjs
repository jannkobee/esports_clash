// 2026-11-17 corrections: calculated smokes, physical handoffs, post-round fights, fallen-site rotations,
// scoped sniper dwell, drop flight timing, the bomb finale shot and utility purposes.
import test from 'node:test';
import assert from 'node:assert/strict';
import {FPS_T_POSITIONS,FPS_CT_POSITIONS} from './fps/fpsPlayerArchitecture.ts';
import {FpsLiveSimulation} from './fps/fpsLiveSimulation.ts';
import {FPS_IDENTITY_PERSONALITIES,generatePlayerDNA} from './fps/fpsIdentity.ts';
import {getLiveMapRuntime} from './fps/fpsLiveMapRegistry.ts';
import {planLiveSmokes,liveSmokeRequest} from './fps/fpsSmokePlanner.ts';
import {calculateLiveThrow,findFpsThrowSpot} from './fps/fpsUtilityBrain.ts';
import {liveDropFlightProgress,liveDropLobHeight} from './fps/fpsLiveViewer.ts';
import {directorBombFinaleSubject} from './fps/fpsBroadcastDirector.ts';
import {classifyFpsUtilityThrow,judgeFpsUtilityOutcome} from './fps/fpsUtilityPurpose.ts';

const plan={tempo:.6,structure:.7,aggression:.5,preparation:.7,freedom:.5,economy:.8};
const coach={...plan,rigidity:.7,communication:.7,leadership:.7,adaptability:.7,development:.5};
const chemistry={trust:.6,communication:.6,understanding:.6,leadershipAcceptance:.6,roleCompetition:.3};
const cards=Array.from({length:10},(_,i)=>({id:`fix-${i}`,name:`Player ${i}`,stats:{rifling:80,positioning:80,entry:80,sniping:80,utility:80,shotcalling:80}}));
const identity={players:Object.fromEntries(cards.map((p,i)=>[p.id,{id:p.id,assignments:{t:FPS_T_POSITIONS[i%5],ct:FPS_CT_POSITIONS[i%5]},personality:FPS_IDENTITY_PERSONALITIES[i],dna:generatePlayerDNA(p.id),intensity:.6,roleSuitability:.6,familiarity:.5}])),teams:{blue:{coach,plan,chemistry},red:{coach,plan,chemistry}}};
const game=(mapId='fontessa')=>new FpsLiveSimulation(cards.slice(0,5),cards.slice(5),1337,identity,{mapId});
const quiet=sim=>{for(const a of sim.actors)Object.assign(a,{hp:0,nextSense:Infinity,nextThink:Infinity});};

test('round smokes are calculated from sightlines on both maps, never read from the authored table',()=>{
  for(const mapId of ['fontessa','spillway']){
    const sim=game(mapId),authored=new Set(sim.map.authoredSmokeLineups.map(l=>l.id));
    assert.ok(sim.roundSmokes.length>=6,`${mapId}: ${sim.roundSmokes.length} planned smokes`);
    for(const l of sim.roundSmokes){
      assert.ok(l.id.startsWith('calc:')&&!authored.has(l.id),l.id);
      assert.ok(sim.map.walkable(l.position),`${l.id}: staging spot walkable`);
      const throwable=calculateLiveThrow('smoke',l.position,l.target,sim.map.terrain.groundHeight(l.position)+1.55,sim.map)||findFpsThrowSpot('smoke',l.position,l.target,sim.map);
      assert.ok(throwable,`${l.id}: a throw exists from or near the staging spot`);
    }
    for(const area of ['A','B'])assert.ok(sim.roundSmokes.some(l=>l.attacking&&l.phase==='execute'&&l.site===area),`${mapId}: execute smokes for ${area}`);
  }
});

test('a spotted defender adds an execute smoke option on that sightline',()=>{
  const rt=getLiveMapRuntime('fontessa'),site=rt.definition.sites.A;
  const base=planLiveSmokes(rt,liveSmokeRequest(rt,true,'execute','A'));
  const key=base.map(l=>l.id).join();
  const spots=rt.navNodes.filter(n=>Math.hypot(n.x-site.x,n.z-site.z)<20).slice(0,80);
  const changed=spots.filter(n=>planLiveSmokes(rt,liveSmokeRequest(rt,true,'execute','A',[{x:n.x,z:n.z,level:n.level,weight:1.6}])).map(l=>l.id).join()!==key);
  assert.ok(changed.length>0,'a defender seen on some angle near the site changes which smokes are thrown');
});

test('a smoke drop is a physical handoff: the donor faces the teammate before it leaves the hand',()=>{
  const sim=game();quiet(sim);Object.assign(sim,{phase:'live',time:30,liveElapsed:10,remaining:80});
  const [donor,mate]=sim.actors.filter(a=>a.attacking);
  Object.assign(donor,{hp:100,x:-19,z:-12,yaw:Math.PI,smoke:1,flash:0,he:0,incendiary:0,lastDropAt:-100,damageAt:-100,seenAt:-100,lastShot:-100});
  Object.assign(mate,{hp:100,x:-19,z:-8,smoke:0});
  assert.equal(sim.beginHandoff(donor,mate,'Dropping smoke',()=>{donor.smoke--;sim.droppedUtility.push({id:999,kind:'smoke',team:donor.team,at:sim.time,x:mate.x,z:mate.z,from:{x:donor.x,z:donor.z},airUntil:sim.time+.5,reservedFor:mate.id});},mate.id),true);
  assert.equal(sim.droppedUtility.length,0,'nothing appears before the donor turns');
  let released=-1;
  for(let i=0;i<60&&released<0;i++){sim.time+=1/30;sim.stepHandoff(donor,1/30);if(sim.droppedUtility.length)released=i;}
  assert.ok(released>2,'the donor needed time to turn around');
  assert.ok(Math.cos(Math.atan2(mate.x-donor.x,mate.z-donor.z)-donor.yaw)>.9,'facing the teammate at release');
  assert.equal(donor.smoke,0);
});

test('drop flights use their real launch time and duration (no jump or mid-air pop-in)',()=>{
  assert.equal(liveDropFlightProgress({at:10,airUntil:11.1},10),0);
  assert.ok(Math.abs(liveDropFlightProgress({at:10,airUntil:11.1},10.55)-.5)<1e-9);
  assert.equal(liveDropFlightProgress({at:10,airUntil:10.4},11),1);
  assert.equal(liveDropFlightProgress({airUntil:5},4.3),0,'no launch time: assume a 0.7 s drop');
  assert.ok(liveDropLobHeight({x:0,z:0},{x:8,z:0})>liveDropLobHeight({x:0,z:0},{x:1,z:0}),'a longer toss is lobbed higher');
});

test('fights continue after the round is decided: visible enemies shoot instead of scavenging',()=>{
  const sim=game();quiet(sim);
  const [winner]=sim.actors.filter(a=>a.attacking),[loser]=sim.actors.filter(a=>!a.attacking);
  Object.assign(winner,{hp:100,x:-19,z:-10,yaw:0,pitch:0,weapon:'ak47',equipped:'ak47',ammo:30,weaponReady:0,reload:0,nextSense:0,acquired:-10});
  Object.assign(loser,{hp:100,x:-19,z:-2,yaw:Math.PI,pitch:0,weapon:'m4a1_s',equipped:'m4a1_s',ammo:25,weaponReady:0,reload:0,nextSense:0,acquired:-10});
  Object.assign(sim,{phase:'post',remaining:7,roundWinner:winner.team,time:100});
  for(let i=0;i<90;i++){sim.time+=1/30;sim.stepPostRound(1/30);}
  assert.ok(winner.impact.shots+loser.impact.shots>0,'someone fired after the round ended');
  assert.ok(winner.hp<100||loser.hp<100,'the fight did damage');
});

test('defenders rotate when a site has fallen (teammates died there), keeping no guard without other-site pressure',()=>{
  const sim=game();quiet(sim);Object.assign(sim,{phase:'live',time:40,liveElapsed:20,remaining:80,roundLiveAt:20});
  const defenders=sim.actors.filter(a=>!a.attacking),site=sim.map.definition.sites.A;
  const homeA=defenders.filter(a=>sim.defenseHome(a)==='A');
  for(const a of homeA){a.hp=0;sim.corpses.push({id:500+a.slot,playerId:a.id,attacking:false,at:35,x:site.x+1,z:site.z,y:0,yaw:0,vx:0,vz:0,crouch:false});}
  const alive=defenders.filter(a=>!homeA.includes(a));for(const a of alive)a.hp=100;
  assert.ok(alive.length>0);
  const empty={strength:0};
  assert.equal(sim.callFallenSiteRotation(alive[0],alive,{A:empty,B:empty}),true);
  const order=sim.informationOrders[alive[0].team];
  assert.equal(order.mode,'rotate');assert.equal(order.site,'A');
  assert.deepEqual([...order.responders].sort(),alive.map(a=>a.id).sort(),'everyone rotates when B shows no pressure');
});

test('a scoped sniper needs a moment through the optic before the shot',()=>{
  const sim=game();quiet(sim);Object.assign(sim,{phase:'live',time:30});
  const [p]=sim.actors.filter(a=>a.attacking),[enemy]=sim.actors.filter(a=>!a.attacking);
  Object.assign(p,{hp:100,x:-19,z:-20,yaw:0,pitch:0,weapon:'sniper',equipped:'sniper',ammo:5,weaponReady:0,reload:0,scopeState:'scoped',scopedAt:30,acquired:0,nextShot:0});
  Object.assign(enemy,{hp:100,x:-19,z:0});
  sim.fire(p,enemy);assert.equal(p.impact.shots,0,'no shot the instant the scope is up');
  sim.time+=.3;sim.fire(p,enemy);assert.equal(p.impact.shots,1,'shot once the sight picture settles');
});

test('the bomb finale frames the detonation when no defuse can finish',()=>{
  const sim=game();const snap=sim.snapshot();
  const site=sim.map.definition.sites.A;
  snap.phase='live';snap.bomb={...snap.bomb,status:'planted',site:'A',x:site.x,z:site.z,remaining:2};
  for(const [i,p] of snap.players.entries()){p.hp=i<2?100:0;p.channel=0;p.x=site.x+8+i;p.z=site.z;}
  assert.ok(directorBombFinaleSubject(snap),'a subject near the device is chosen');
  const ct=snap.players.find(p=>!p.attacking);Object.assign(ct,{hp:100,channel:9,kit:false});
  assert.equal(directorBombFinaleSubject(snap),undefined,'a defuse that finishes in time is the story instead');
});

test('utility purposes follow the reference: CT opening smoke is anti-rush with its secondary purposes',()=>{
  const base={kind:'smoke',attacking:false,phase:'opening',plannedSmoke:'opening',enemyAtTarget:false,sniperAtTarget:false,lowHpEnemyAtTarget:false,teammateEngaging:false,
    retreating:false,fireAtTarget:false,enemySmokeAtTarget:false,bombNearTarget:false,opponentOnObjective:false,ownTeamOnObjective:false};
  const ct=classifyFpsUtilityThrow(base);
  assert.equal(ct.primary,'ANTI_RUSH');
  for(const s of ['VISION_DENIAL','DELAY','CHOKE_CONTROL','INFORMATION_DENIAL'])assert.ok(ct.secondary.includes(s),s);
  assert.equal(classifyFpsUtilityThrow({...base,fireAtTarget:true}).primary,'FIRE_EXTINGUISHING');
  assert.equal(classifyFpsUtilityThrow({...base,kind:'he',enemySmokeAtTarget:true}).primary,'SMOKE_CLEARING');
  assert.equal(classifyFpsUtilityThrow({...base,kind:'incendiary',attacking:true,phase:'post-plant',opponentOnObjective:true}).primary,'DEFUSE_DENIAL');
  const flash=classifyFpsUtilityThrow({...base,kind:'flash',attacking:true,phase:'execute',plannedSmoke:undefined});
  assert.equal(flash.primary,'EXECUTE_SUPPORT');
  assert.equal(judgeFpsUtilityOutcome(flash,{enemiesBlinded:0,alliesBlinded:2}).achieved,false,'a team flash fails its purpose');
});

test('every released grenade carries its purpose into the round log',()=>{
  const sim=game();
  for(let i=0;i<9000&&!sim.utilityPurposeLog().length;i++){sim.step();sim.drainAudioCues();}
  const log=sim.utilityPurposeLog();
  assert.ok(log.length>0,'some utility was thrown');
  for(const e of log){assert.ok(e.intent.primary&&e.intent.objective&&e.intent.phase);}
});
