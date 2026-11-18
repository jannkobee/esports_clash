import {FPS_T_POSITIONS,FPS_CT_POSITIONS} from './fps/fpsPlayerArchitecture.ts';
import test from 'node:test';
import assert from 'node:assert/strict';
import {FpsLiveSimulation} from './fps/fpsLiveSimulation.ts';
import {FPS_IDENTITY_PERSONALITIES,generatePlayerDNA} from './fps/fpsIdentity.ts';
import {LIVE_AUTHORED_SMOKE_LINEUPS} from './fps/fpsLiveLineups.ts';
import {distance} from './fps/fpsLiveMap.ts';
import {liveGroundHeight} from './fps/fpsLiveTerrain.ts';

const plan={tempo:.6,structure:.7,aggression:.5,preparation:.7,freedom:.5,economy:.8};
const coach={...plan,rigidity:.7,communication:.7,leadership:.7,adaptability:.7,development:.5};
const chemistry={trust:.6,communication:.6,understanding:.6,leadershipAcceptance:.6,roleCompetition:.3};
const cards=Array.from({length:10},(_,i)=>({id:`lineup-${i}`,name:`Lineup operative ${i}`,stats:{rifling:80,positioning:80,entry:80,sniping:80,utility:80,shotcalling:80}}));
const identity={players:Object.fromEntries(cards.map((p,i)=>[p.id,{id:p.id,assignments:{t:FPS_T_POSITIONS[(i)%5],ct:FPS_CT_POSITIONS[(i)%5]},personality:FPS_IDENTITY_PERSONALITIES[i],dna:generatePlayerDNA(p.id),intensity:.6,roleSuitability:.6,familiarity:.5}])),teams:{blue:{coach,plan,chemistry},red:{coach,plan,chemistry}}};

function scenario(attacking,site){
  const sim=new FpsLiveSimulation(cards.slice(0,5),cards.slice(5),1337,identity);
  // Exercise the real paid buy queue before isolating a no-contact opening.
  for(const actor of sim.actors)actor.cash=6000;
  sim.round=2;sim.startRound();while(sim.phase==='freeze')sim.step();
  // Coordination fixture: a fixed team smoke plan (the authored examples) instead of this round's calculated one.
  sim.roundSmokes=sim.map.authoredSmokeLineups.map(l=>({...l}));
  const p=sim.actors.find(a=>a.attacking===attacking&&a.slot===(attacking?3:site==='A'?0:3));
  assert.ok(p.smoke>0,'The full buy must supply the smoke; the fixture does not grant free inventory');
  const inventory=p.smoke;
  for(const actor of sim.actors)Object.assign(actor,{hp:actor===p?100:0,target:undefined,goal:undefined,path:[],nextSense:Infinity,nextThink:Infinity,nextShot:Infinity});
  const carrier=sim.actors.find(a=>a.attacking&&a!==p),enemy=sim.actors.find(a=>a.attacking!==attacking);
  Object.assign(carrier,{hp:100,x:0,z:-38,bomb:true,jumpY:0});
  if(enemy!==carrier)Object.assign(enemy,{hp:100,x:0,z:42,bomb:false,jumpY:0});
  Object.assign(p,{role:'support',bomb:false,nextSense:sim.time,nextThink:sim.time,freezeDelay:0,contact:undefined,contactAt:-100,damageAt:-100,nextPeek:Infinity,nextJump:Infinity});
  Object.assign(sim,{site,tacticArchetype:'default_pick',defenseSetup:'standard',liveElapsed:0});
  sim.bomb={status:'carried',x:carrier.x,z:carrier.z,remaining:40};
  const lineup=LIVE_AUTHORED_SMOKE_LINEUPS.find(l=>l.phase==='opening'&&l.attacking===attacking&&l.site===site);
  return {sim,p,lineup,inventory};
}

test('paid opening smoke lineups route, settle, prepare and physically land for both forces and sites',()=>{
  for(const attacking of [true,false])for(const site of ['A','B']){
    const {sim,p,lineup,inventory}=scenario(attacking,site),origin={x:p.x,z:p.z};
    let sawAssignment=false,sawPreparation=false,sawPin=false,sawRelease=false,releaseId;
    for(let tick=0;tick<840&&!sim.smokes.some(s=>s.id===releaseId);tick++){
      sim.step();
      sawAssignment||=p.smokeLineupId===lineup.id;
      if(p.utilityPreparation?.lineupId===lineup.id){
        sawPreparation=true;sawPin||=sim.time>=p.utilityPreparation.equipAt;
        assert.equal(p.smoke,inventory,`${lineup.id}: inventory consumed before release`);
        assert.equal(sim.completedSmokeLineups.has(`${p.team}:${lineup.id}`),false,`${lineup.id}: announced before release`);
        assert.ok(p.speed<.36,`${lineup.id}: throwing while moving`);
        assert.ok(p.smokeLineupGoal&&distance(p,p.smokeLineupGoal)<.56,`${lineup.id}: threw away from its chosen launch spot`);
        assert.ok(distance(p.smokeLineupGoal,lineup.position)<=8.5,`${lineup.id}: launch spot strayed from the smoke target`);
      }
      const thrown=sim.grenades.find(g=>g.actorId===p.id&&g.kind==='smoke');
      if(thrown){sawRelease=true;releaseId=thrown.id;assert.equal(p.smoke,inventory-1);assert.ok(sim.completedSmokeLineups.has(`${p.team}:${lineup.id}`));}
    }
    const context=JSON.stringify({lineup:lineup.id,origin,p:{x:p.x,z:p.z,action:p.action,intent:p.intent,goal:p.goal,smoke:p.smoke,lineup:p.smokeLineupId},time:sim.time,liveElapsed:sim.liveElapsed});
    assert.ok(sawAssignment,context);assert.ok(sawPreparation,context);assert.ok(sawPin,context);assert.ok(sawRelease,context);
    const cloud=sim.smokes.find(s=>s.id===releaseId);assert.ok(cloud,context);
    // Throws are calculated, not pre-solved, so they can miss; every one is scored and remembered.
    assert.ok(Number.isFinite(cloud.x+cloud.y+cloud.z),context);
    assert.ok(Math.abs(cloud.y-1.35-sim.map.terrain.floorAt(cloud,cloud.y))<.6,`${context}: smoke must pop resting on a surface`);
    assert.ok((sim.snapshot().utilityLearning?.thisMatch.throws??0)>=1,`${context}: the utility brain must score the throw`);
  }
});

test('danger during smoke preparation cancels without spending the item or reporting a completed lineup',()=>{
  const {sim,p,lineup,inventory}=scenario(true,'A');
  for(let tick=0;tick<600&&!p.utilityPreparation;tick++)sim.step();
  assert.equal(p.utilityPreparation?.lineupId,lineup.id);
  p.damageAt=sim.time;sim.releaseUtilityPreparation(p);
  assert.equal(p.utilityPreparation,undefined);assert.equal(p.smoke,inventory);
  assert.equal(sim.completedSmokeLineups.has(`${p.team}:${lineup.id}`),false);assert.equal(sim.grenades.filter(g=>g.actorId===p.id).length,0);
});
