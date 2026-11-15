import assert from 'node:assert/strict';
import {assignLiveObjective,planLivePlant} from '../fps/fpsLivePlanning.ts';
import {LIVE_MID,LIVE_TACTICAL,liveWalkable} from '../fps/fpsLiveMap.ts';
import {LIVE_WEAPONS} from '../fps/fpsLiveWeapons.ts';
import {createBaselineSimulation} from './fpsBaselineFixtures.mjs';

const epsilon=1e-8;

function objectiveContract(){
  let origins=0,candidateStates=0,budgetChecks=0,tieChecks=0;
  for(const site of ['A','B']){
    const plan=planLivePlant(LIVE_TACTICAL[site].entries[0],site);
    assert.ok(plan,`${site}: a playable site needs a reachable legal device point`);
    const target=plan.point;
    assert.ok(liveWalkable(target),`${site}: planned device point must remain walkable`);
    const starts=[...LIVE_TACTICAL[site].entries.slice(0,2),LIVE_MID.window.hold,target];
    for(const [index,from] of starts.entries()){
      origins++;assert.ok(liveWalkable(from),`${site}/${index}: objective origin must remain legal`);
      const states=new Map();
      for(const kit of [false,true])for(const channel of [0,1.25,4]){
        candidateStates++;
        const actor={...from,id:`${site}-candidate`,slot:2,kit,channel},before=structuredClone(actor);
        const assignment=assignLiveObjective([actor],target,Infinity,true);
        const label=`${site}/${index}, kit=${kit}, progress=${channel}`;
        assert.ok(assignment&&Number.isFinite(assignment.seconds)&&assignment.seconds>0,`${label}: route and channel must be feasible`);
        assert.equal(assignment.id,actor.id,`${label}: a reachable sole defuser must be selected`);
        states.set(`${kit}:${channel}`,assignment.seconds);
        // A smaller clock cannot manufacture a defuse; equality must remain viable.
        for(const [budget,viable] of [[assignment.seconds-.001,false],[assignment.seconds,true],[assignment.seconds+1,true]]){
          budgetChecks++;
          const limited=assignLiveObjective([actor],target,budget,true);
          assert.equal(!!limited,viable,`${label}: completion must respect the available ${budget}s`);
          if(limited)assert.equal(limited.id,actor.id);
        }
        assert.deepEqual(actor,before,`${label}: planning must not mutate the actor`);
      }
      for(const channel of [0,1.25,4]){
        const withoutKit=states.get(`false:${channel}`),withKit=states.get(`true:${channel}`);
        assert.ok(withKit<=withoutKit+epsilon,`${site}/${index}: adding a kit cannot delay a defuse`);
        assert.ok(Math.abs(withoutKit-withKit-5)<epsilon,`${site}/${index}: a kit saves five channel seconds independently of travel`);
      }
      for(const kit of [false,true]){
        const fresh=states.get(`${kit}:0`),partial=states.get(`${kit}:1.25`),advanced=states.get(`${kit}:4`);
        assert.ok(advanced<=partial+epsilon&&partial<=fresh+epsilon,`${site}/${index}: more completed channel cannot increase completion time`);
        if(index===starts.length-1){
          assert.ok(Math.abs(fresh-(kit?5:10))<epsilon,`${site}: a defuser already at C4 needs only its channel`);
          assert.ok(Math.abs(fresh-advanced-4)<epsilon,`${site}: active progress at C4 must count`);
        }else{
          assert.equal(partial,fresh,`${site}/${index}: remote stale channel progress cannot finish a defuse`);
          assert.equal(advanced,fresh,`${site}/${index}: travel cannot retain a remote defuse channel`);
        }
      }
    }
    const at=(id,slot,kit=true,channel=0)=>({...target,id,slot,kit,channel});
    const cases=[
      {actors:[at('active',4,false,1),at('kit-backup',0)],remaining:12,id:'active'},
      {actors:[at('active',4,false,1),at('kit-backup',0)],remaining:5,id:'kit-backup'},
      {actors:[at('later-slot',4),at('earlier-slot',0)],remaining:12,id:'earlier-slot'},
      {actors:[at('omega',2),at('alpha',2)],remaining:12,id:'alpha'},
    ];
    for(const scenario of cases)for(const actors of [scenario.actors,[...scenario.actors].reverse()]){
      tieChecks++;
      assert.equal(assignLiveObjective(actors,target,scenario.remaining,true)?.id,scenario.id,
        `${site}: viable channel priority and deterministic slot/id ties must survive input order`);
    }
  }
  return {sites:2,origins,candidateStates,budgetChecks,tieChecks};
}

function weaponContract(){
  const sim=createBaselineSimulation(1337),p=sim.actors[0];
  Object.assign(sim,{phase:'live',time:100});sim.pendingBuys.clear();
  for(const actor of sim.actors)actor.hp=0;
  Object.assign(p,{hp:100,x:-19,z:-10,role:'trade',intel:{contacts:[]}});
  const primaries=Object.keys(LIVE_WEAPONS).filter(id=>LIVE_WEAPONS[id].category!=='pistol');
  const sidearms=Object.keys(LIVE_WEAPONS).filter(id=>LIVE_WEAPONS[id].category==='pistol');
  let pairs=0,reloadReservations=0,roundTrips=0;
  for(const primary of primaries)for(const sidearm of sidearms){
    pairs++;
    const main=LIVE_WEAPONS[primary],backup=LIVE_WEAPONS[sidearm],label=`${primary} + ${sidearm}`;
    const mainState={weapon:primary,ammo:Math.max(1,Math.floor(main.magazine/2)),reserve:Math.max(1,Math.floor(main.reserve*.6)),nextShot:sim.time+main.interval+.2};
    const sideState={weapon:sidearm,ammo:Math.max(1,backup.magazine-2),reserve:Math.max(1,backup.reserve-3),nextShot:sim.time+backup.interval+.05};
    Object.assign(p,{...mainState,equipped:primary,weaponReady:0,utilityPreparation:undefined,holsteredPrimary:undefined,
      sidearmLoadout:{...sideState},reload:0,reloadRounds:0,reloadDuration:0,reloadSilent:false,
      scopeState:main.category==='sniper'?'scoped':'hip',scopeLevel:main.category==='sniper'?1:0,
      scopeUntil:main.category==='sniper'?sim.time+2:0,bomb:false,channel:0,throwAt:undefined});
    const shots=p.impact.shots,drops=sim.droppedWeapons.length;
    sim.beginReload(p);reloadReservations++;
    assert.ok(p.reload>0&&p.reloadRounds>0,`${label}: primary reload must actually reserve rounds`);
    assert.equal(p.ammo+p.reserve+p.reloadRounds,mainState.ammo+mainState.reserve,`${label}: primary reservation conserves rounds`);
    sim.drawSidearm(p);
    assert.deepEqual(p.holsteredPrimary,mainState,`${label}: draw returns reserved primary rounds and preserves its cooldown`);
    assert.equal(p.weapon,sidearm);assert.equal(p.equipped,sidearm);
    assert.equal(p.ammo,sideState.ammo);assert.equal(p.reserve,sideState.reserve);
    assert.equal(p.nextShot,sideState.nextShot,`${label}: sidearm must use its own future deadline`);
    assert.equal(p.reload,0);assert.equal(p.reloadRounds,0);
    assert.equal(p.scopeState,'hip');assert.equal(p.scopeLevel,0);assert.equal(p.scopeUntil,0);
    const holstered=p.holsteredPrimary;
    sim.drawSidearm(p);
    assert.equal(p.holsteredPrimary,holstered,`${label}: repeated draw must not replace the stored primary`);
    p.weaponReady=0;
    sim.beginReload(p);reloadReservations++;
    assert.ok(p.reload>0&&p.reloadRounds>0,`${label}: sidearm reload must actually reserve rounds`);
    assert.equal(p.ammo+p.reserve+p.reloadRounds,sideState.ammo+sideState.reserve,`${label}: sidearm reservation conserves rounds`);
    sim.restorePrimary(p);roundTrips++;
    assert.equal(p.holsteredPrimary,undefined);
    assert.deepEqual(p.sidearmLoadout,sideState,`${label}: restore returns reserved backup rounds and preserves its cooldown`);
    assert.equal(p.weapon,primary);assert.equal(p.equipped,primary);
    assert.equal(p.ammo,mainState.ammo);assert.equal(p.reserve,mainState.reserve);assert.equal(p.nextShot,mainState.nextShot);
    assert.equal(p.reload,0);assert.equal(p.reloadRounds,0);
    assert.equal(p.scopeState,'hip');assert.equal(p.scopeLevel,0);assert.equal(p.scopeUntil,0);
    sim.restorePrimary(p);
    p.weaponReady=0;sim.drawSidearm(p);sim.restorePrimary(p);roundTrips++;
    assert.equal(p.ammo,mainState.ammo);assert.equal(p.reserve,mainState.reserve);assert.equal(p.nextShot,mainState.nextShot);
    assert.deepEqual(p.sidearmLoadout,sideState,`${label}: repeated no-fire round trips cannot manufacture ammunition or reset either cooldown`);
    assert.equal(p.impact.shots,shots);assert.equal(sim.droppedWeapons.length,drops);
  }
  return {primaries:primaries.length,sidearms:sidearms.length,pairs,reloadReservations,roundTrips};
}

export const baselineObjectiveContracts=[
  {name:'objective feasibility is monotonic across legal routes, kits, channel progress and clock budgets',run:objectiveContract},
  {name:'every primary and sidearm pair conserves reload reservations, ammunition and independent cooldowns',run:weaponContract},
];
