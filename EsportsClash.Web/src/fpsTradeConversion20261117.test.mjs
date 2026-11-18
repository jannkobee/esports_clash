// Trade conversion (2026-11-17): a second nearby teammate also commits to the trade, and a follower takes a
// spacing point with a line onto where the entry is looking. Both are decision/positioning only.
import test from 'node:test';
import assert from 'node:assert/strict';
import {FPS_T_POSITIONS,FPS_CT_POSITIONS} from './fps/fpsPlayerArchitecture.ts';
import {FpsLiveSimulation} from './fps/fpsLiveSimulation.ts';
import {FPS_IDENTITY_PERSONALITIES,generatePlayerDNA} from './fps/fpsIdentity.ts';
import {emptyLiveIntel} from './fps/fpsLiveIntel.ts';

const plan={tempo:.6,structure:.7,aggression:.5,preparation:.7,freedom:.5,economy:.8};
const coach={...plan,rigidity:.7,communication:.7,leadership:.7,adaptability:.7,development:.5};
const chemistry={trust:.6,communication:.6,understanding:.6,leadershipAcceptance:.6,roleCompetition:.3};
const cards=Array.from({length:10},(_,i)=>({id:`tc-${i}`,name:`Player ${i}`,stats:{rifling:80,positioning:80,entry:80,sniping:80,utility:80,shotcalling:80}}));
const identity={players:Object.fromEntries(cards.map((p,i)=>[p.id,{id:p.id,assignments:{t:FPS_T_POSITIONS[i%5],ct:FPS_CT_POSITIONS[i%5]},personality:FPS_IDENTITY_PERSONALITIES[i],dna:generatePlayerDNA(p.id),intensity:.6,roleSuitability:.6,familiarity:.5}])),teams:{blue:{coach,plan,chemistry},red:{coach,plan,chemistry}}};
const game=(options={})=>new FpsLiveSimulation(cards.slice(0,5),cards.slice(5),1337,identity,{mapId:'fontessa',...options});
const live=sim=>{for(let i=0;i<900&&sim.phase!=='live';i++)sim.step();assert.equal(sim.phase,'live');};
const freeze=sim=>{for(const a of sim.actors)Object.assign(a,{nextThink:Infinity,nextSense:Infinity,target:undefined,intel:emptyLiveIntel(),noticedEnemies:[]});};

/** Killer and victim with a line; two teammates near the victim, both behind cover from the killer. */
function stageDeath(sim){
  const attackers=sim.actors.filter(a=>a.attacking),victim=attackers[1],first=attackers[2],second=attackers[3];
  const killer=sim.actors.find(a=>!a.attacking);
  for(let kx=-30;kx<=30;kx+=3)for(let kz=-30;kz<=30;kz+=3){
    const k={x:kx,z:kz},v={x:kx+6,z:kz};
    if(!sim.map.walkable(k)||!sim.map.walkable(v)||!sim.map.sightline(v,k))continue;
    const hidden=[[6,6],[6,-6],[8,4],[8,-4],[4,8],[4,-8],[9,0],[7,7]].map(([dx,dz])=>({x:v.x+dx,z:v.z+dz}))
      .filter(t=>sim.map.walkable(t)&&!sim.map.sightline(t,k)&&Math.hypot(t.x-v.x,t.z-v.z)<13);
    if(hidden.length<2)continue;
    Object.assign(killer,{x:k.x,z:k.z,hp:100});Object.assign(victim,{x:v.x,z:v.z,hp:100,bomb:false});
    Object.assign(first,{...hidden[0],hp:100,ammo:30,bomb:false,tradeFor:victim.id,peek:undefined});
    Object.assign(second,{...hidden[1],hp:100,ammo:30,bomb:false,peek:undefined});
    for(const a of attackers)if(![victim,first,second].includes(a))a.hp=0;
    victim.intel.contacts.push({key:`enemy:${killer.id}`,enemyId:killer.id,observerId:victim.id,source:'sight',x:killer.x,z:killer.z,observed:sim.time,confidence:.95,uncertainty:.4});
    return {victim,first,second,killer};
  }
  return undefined;
}

test('a second nearby teammate also commits to the trade, a beat after the first',()=>{
  const sim=game();live(sim);freeze(sim);
  const staged=stageDeath(sim);assert.ok(staged,'test geometry found');
  const {victim,first,second,killer}=staged;
  sim.damage(killer,victim,500,true,'ak47',true);
  assert.ok(first.tradeSwing,'the paired trader swings');
  assert.ok(second.tradeSwing,'a second teammate also swings');
  assert.ok(second.tradeSwing.at>first.tradeSwing.at,'the second swing comes a beat later');
  assert.ok(second.tradeSwing.at>=sim.time+.1,'nobody moves before the death call has landed');
});

test('the static-role ablation keeps a single trade responder',()=>{
  const sim=game({diagnostics:{staticRoles:true}});live(sim);freeze(sim);
  const staged=stageDeath(sim);assert.ok(staged);
  const {victim,first,second,killer}=staged;
  sim.damage(killer,victim,500,true,'ak47',true);
  assert.equal(first.tradeSwing,undefined);assert.equal(second.tradeSwing,undefined);
});

test('a follower takes a spacing point with a line onto where the entry is looking',()=>{
  const sim=game();live(sim);freeze(sim);
  const attackers=sim.actors.filter(a=>a.attacking),entry=attackers.find(a=>sim.duty(a)==='entry'),trader=attackers.find(a=>a!==entry&&!a.bomb&&sim.duty(a)==='trade');
  assert.ok(entry&&trader);
  const site=sim.map.definition.sites[sim.site];
  let checked=0;
  for(let i=0;i<40&&checked<6;i++){
    const ang=i*.7,r=10+(i%4)*3;
    const e={x:site.x+Math.sin(ang)*r,z:site.z+Math.cos(ang)*r};
    if(!sim.map.walkable(e))continue;
    Object.assign(entry,{x:e.x,z:e.z,yaw:Math.atan2(site.x-e.x,site.z-e.z),aimFocus:undefined,hp:100});
    Object.assign(trader,{x:e.x+(e.x-site.x)/r*7,z:e.z+(e.z-site.z)/r*7,hp:100,tradeFor:entry.id,follow:undefined,decision:'coordinate',contact:undefined,contactAt:-100});
    if(!sim.map.walkable(trader))continue;
    sim.decide(trader);
    if(!/Trade|trade spacing/.test(trader.intent))continue;
    checked++;
    const look={x:entry.x+Math.sin(entry.yaw)*8,z:entry.z+Math.cos(entry.yaw)*8};
    const goal=trader.goal;
    const behind={x:entry.x+(entry.x-site.x)/Math.hypot(entry.x-site.x,entry.z-site.z)*3.5,z:entry.z+(entry.z-site.z)/Math.hypot(entry.x-site.x,entry.z-site.z)*3.5};
    // Either the chosen point sees the entry's look line, or no candidate around the spacing point could.
    if(!sim.map.sightline(goal,look))assert.ok(!sim.map.sightline(sim.map.safePoint(behind),look),'a line was available but not taken');
  }
  assert.ok(checked>0,'the follow branch was exercised');
});
