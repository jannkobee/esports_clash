// Role-interaction follow-ups (2026-11-17): trade swings onto called positions, paired-trader priority,
// position-based CT setups, measured fallen-site rotations, rotator hesitation and duty-aware action bias.
import test from 'node:test';
import assert from 'node:assert/strict';
import {FPS_T_POSITIONS,FPS_CT_POSITIONS} from './fps/fpsPlayerArchitecture.ts';
import {FpsLiveSimulation} from './fps/fpsLiveSimulation.ts';
import {FPS_IDENTITY_PERSONALITIES,generatePlayerDNA} from './fps/fpsIdentity.ts';
import {emptyLiveIntel} from './fps/fpsLiveIntel.ts';

const plan={tempo:.6,structure:.7,aggression:.5,preparation:.7,freedom:.5,economy:.8};
const coach={...plan,rigidity:.7,communication:.7,leadership:.7,adaptability:.7,development:.5};
const chemistry={trust:.6,communication:.6,understanding:.6,leadershipAcceptance:.6,roleCompetition:.3};
const cards=Array.from({length:10},(_,i)=>({id:`ri-${i}`,name:`Player ${i}`,stats:{rifling:80,positioning:80,entry:80,sniping:80,utility:80,shotcalling:80}}));
const identityFor=order=>({players:Object.fromEntries(cards.map((p,i)=>[p.id,{id:p.id,assignments:{t:FPS_T_POSITIONS[order[i%5]],ct:FPS_CT_POSITIONS[order[i%5]]},personality:FPS_IDENTITY_PERSONALITIES[i],dna:generatePlayerDNA(p.id),intensity:.6,roleSuitability:.6,familiarity:.5}])),teams:{blue:{coach,plan,chemistry},red:{coach,plan,chemistry}}});
const game=(options={},order=[0,1,2,3,4])=>new FpsLiveSimulation(cards.slice(0,5),cards.slice(5),1337,identityFor(order),{mapId:'fontessa',...options});
const live=sim=>{for(let i=0;i<900&&sim.phase!=='live';i++)sim.step();assert.equal(sim.phase,'live');};
const freeze=sim=>{for(const a of sim.actors)Object.assign(a,{nextThink:Infinity,nextSense:Infinity,target:undefined,intel:emptyLiveIntel(),noticedEnemies:[]});};

test('CT setups follow assigned positions, not the order the roster was listed in',()=>{
  const homes=sim=>Object.fromEntries(sim.actors.filter(a=>!a.attacking).map(a=>[a.position,sim.defenseHome(a)]));
  const standard=game();const reversed=game({},[4,3,2,1,0]);
  assert.deepEqual(homes(reversed),homes(standard));
  const count=sim=>Object.values(homes(sim)).reduce((m,h)=>({...m,[h]:(m[h]??0)+1}),{});
  assert.deepEqual(count(reversed),{A:3,B:2});
  // The slot-based ablation shows the old dependence on listing order.
  const old=game({diagnostics:{staticRoles:true}},[4,3,2,1,0]);
  assert.ok(old.actors.filter(a=>!a.attacking).every(a=>['A','B'].includes(old.defenseHome(a))));
});

test('the rotator answers a rotation first; proactive rotators before reluctant ones',()=>{
  const sim=game();live(sim);
  const rotator=sim.actors.find(a=>a.position==='CT_ROTATOR'),flex=sim.actors.find(a=>a.position==='CT_FLEX');
  assert.ok(sim.rotationCost(rotator,20)<sim.rotationCost(flex,15),'the rotation is the rotator\'s job');
  const ablation=game({diagnostics:{staticRoles:true}});live(ablation);
  assert.equal(ablation.rotationCost(ablation.actors.find(a=>a.position==='CT_ROTATOR'),20),20);
});

test('one lost anchor gets a measured response; two losses commit the team',()=>{
  const sim=game();live(sim);freeze(sim);
  const defenders=sim.actors.filter(a=>!a.attacking),anchorA=defenders.find(a=>a.position==='CT_ANCHOR_A');
  const siteA=sim.map.definition.sites.A,siteB=sim.map.definition.sites.B;
  // Everyone else sits on B (A is empty once its anchor dies).
  for(const a of defenders)if(a!==anchorA)Object.assign(a,{x:siteB.x+a.slot,z:siteB.z,hp:100});
  for(const a of defenders)if(a!==anchorA&&sim.defenseHome(a)==='A')a.roundDuty={duty:'trade',base:a.role,since:0,reason:'test',home:'B'};
  anchorA.hp=0;sim.corpses.push({id:901,playerId:anchorA.id,attacking:false,at:sim.time,x:siteA.x,z:siteA.z,y:0,yaw:0,vx:0,vz:0,crouch:false});
  const alive=defenders.filter(a=>a.hp>0),caller=alive[0];
  assert.ok(sim.callFallenSiteRotation(caller,alive,{A:{strength:.6},B:{strength:0}}));
  const measured=sim.informationOrders[caller.team];
  assert.equal(measured.firm,false);assert.ok(measured.responders.length<=2&&measured.responders.length>=1);
  assert.match(measured.reason,/rest hold B/);
  // A second death there escalates to a firm, full rotation.
  const second=alive.find(a=>!measured.responders.includes(a.id));second.hp=0;
  sim.corpses.push({id:902,playerId:second.id,attacking:false,at:sim.time,x:siteA.x+1,z:siteA.z,y:0,yaw:0,vx:0,vz:0,crouch:false});
  const rest=defenders.filter(a=>a.hp>0);
  assert.ok(sim.callFallenSiteRotation(rest[0],rest,{A:{strength:.6},B:{strength:0}}));
  assert.equal(sim.informationOrders[caller.team].firm,true);
});

test('a responder with fresh own contact holds instead of abandoning his site; firm calls are followed',()=>{
  const sim=game();live(sim);freeze(sim);
  const p=sim.actors.find(a=>!a.attacking&&a.position==='CT_ANCHOR_B'),siteB=sim.map.definition.sites.B;
  const order={mode:'reinforce',site:'A',responders:[p.id],until:sim.time+5,strength:1,reason:'test',issuedAt:sim.time};
  const contact=[{x:siteB.x+3,z:siteB.z+5,certainty:.7,age:.5,source:'footstep'}];
  assert.match(sim.rotationHesitation(p,order,'B',contact),/Own contact/);
  assert.equal(sim.rotationHesitation(p,{...order,firm:true},'B',contact),undefined);
  assert.equal(sim.rotationHesitation(p,{...order,issuedAt:sim.time-5},'B',[]),undefined,'no contradicting information: go');
  p.tendencies={...p.tendencies,informationVerification:100,rotationCommitment:0};
  assert.match(sim.rotationHesitation(p,order,'B',[]),/Confirm the A call/,'a verifier confirms a reinforce call first');
  assert.equal(sim.rotationHesitation(p,{...order,mode:'rotate'},'B',[]),undefined,'a rotate call is not second-guessed without contrary information');
});

test('the paired trader has first claim on a trade and swings the called position without sight',()=>{
  const sim=game();live(sim);freeze(sim);
  const attackers=sim.actors.filter(a=>a.attacking),victim=attackers[1],partner=attackers[2],closer=attackers[3];
  const killer=sim.actors.find(a=>!a.attacking);
  // Find a spot with sight from the victim to the killer, and a partner spot behind cover from the killer.
  let placed=false;
  for(let kx=-30;kx<=30&&!placed;kx+=3)for(let kz=-30;kz<=30&&!placed;kz+=3){
    const k={x:kx,z:kz},v={x:kx+6,z:kz};
    if(!sim.map.walkable(k)||!sim.map.walkable(v)||!sim.map.sightline(v,k))continue;
    for(const [dx,dz] of [[6,6],[6,-6],[8,4],[8,-4],[4,8],[4,-8]]){
      const t={x:v.x+dx,z:v.z+dz};
      if(!sim.map.walkable(t)||sim.map.sightline(t,k)||!sim.map.findPeek({...t,level:undefined},k))continue;
      Object.assign(killer,{x:k.x,z:k.z,hp:100});Object.assign(victim,{x:v.x,z:v.z,hp:100});
      Object.assign(partner,{x:t.x,z:t.z,hp:100,ammo:30,bomb:false,tradeFor:victim.id,peek:undefined});
      Object.assign(closer,{x:v.x+2,z:v.z+12,hp:100});
      placed=true;break;
    }
  }
  assert.ok(placed,'test geometry found');
  for(const a of attackers)if(![victim,partner,closer].includes(a))a.hp=0;
  for(const a of [victim,partner,closer])a.bomb=false;
  victim.intel.contacts.push({key:`enemy:${killer.id}`,enemyId:killer.id,observerId:victim.id,source:'sight',x:killer.x,z:killer.z,observed:sim.time,confidence:.95,uncertainty:.4});
  sim.damage(killer,victim,500,true,'ak47',true);
  assert.ok(partner.tradeSwing,'the paired trader commits to the swing');
  assert.equal(closer.tradeSwing,undefined);
  sim.time=partner.tradeSwing.at+.01;partner.nextThink=0;partner.nextSense=Infinity;
  sim.decide(partner);
  assert.ok(partner.peek,'the swing becomes a real peek toward the called position');
  assert.equal(partner.intent,'Swing the called position to trade');
});

test('the round job tilts action scoring, and the ablation keeps it neutral',()=>{
  const sim=game();live(sim);
  const attackers=sim.actors.filter(a=>a.attacking),entry=attackers.find(a=>sim.duty(a)==='entry');
  const mate=attackers.find(a=>a!==entry&&!a.bomb);Object.assign(mate,{x:entry.x+3,z:entry.z,tradeFor:entry.id});
  assert.ok(sim.dutyActionBias(entry,attackers,false,false).pressure>0,'an entry with a trade in range presses');
  mate.x=entry.x+30;
  assert.ok(sim.dutyActionBias(entry,attackers,false,false).pressure<0,'without a trade the entry does not');
  const anchor=sim.actors.find(a=>!a.attacking&&sim.duty(a)==='anchor');
  assert.ok(sim.dutyActionBias(anchor,sim.actors.filter(a=>!a.attacking),false,false).prepare>0);
  const ablation=game({diagnostics:{staticRoles:true}});live(ablation);
  assert.deepEqual(ablation.dutyActionBias(ablation.actors[5],ablation.actors.slice(5),false,false),{pressure:0,prepare:0,coordinate:0,probe:0});
});

test('a vault that times out inside the window frame finishes the drop instead of wedging the player',async()=>{
  const {liveActorSolids}=await import('./fps/fpsLiveMap.ts');
  const {segmentHitsWall}=await import('./fps/fpsSpatialWorld.ts');
  const sim=game();live(sim);freeze(sim);
  const drop=sim.map.elevationDrops.find(d=>d.id==='mid-window-drop');assert.ok(drop);
  const from={x:(drop.from.minX+drop.from.maxX)/2,z:(drop.from.minZ+drop.from.maxZ)/2,level:drop.fromLevel};
  const fromY=sim.map.terrain.groundHeight(from);
  let wedged;
  for(let t=0;t<=1&&!wedged;t+=.05){const q={x:from.x+(drop.landing.x-from.x)*t,z:from.z+(drop.landing.z-from.z)*t,level:from.level};
    if(liveActorSolids({...q,jumpY:fromY},fromY,1.72).some(w=>segmentHitsWall(q,q,w,.349)))wedged=q;}
  assert.ok(wedged,'a point inside the window frame exists');
  const p=sim.actors.find(a=>a.hp>0);
  Object.assign(p,{x:wedged.x,z:wedged.z,level:wedged.level,jumpY:fromY,groundY:fromY,jump:false,jumpVy:0,crouch:true,path:[],
    vaultDrop:{target:{...drop.landing},landingY:sim.map.terrain.groundHeight(drop.landing),clearanceY:fromY+1.05,startedAt:sim.time-2,until:sim.time-.01}});
  sim.move(p,1/30);
  assert.equal(p.vaultDrop,undefined);
  assert.ok(!liveActorSolids(p,p.jumpY,1.72).some(w=>segmentHitsWall(p,p,w,.349)),'standing is clear of the frame after the drop');
});
