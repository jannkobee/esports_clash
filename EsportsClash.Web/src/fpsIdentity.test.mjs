import test from 'node:test';
import assert from 'node:assert/strict';
import {createEqualizedRoster} from './equalizedMode.ts';
import {FPS_IDENTITY_PERSONALITIES,FPS_SPECIALTIES,generatePlayerDNA,evaluatePlayerAction,scoreTacticalActions,resolveTacticalExecution,developFpsFamiliarity} from './fps/fpsIdentity.ts';
import {hydrateFpsIdentityContext,observedPersonalityTriggers,assignContextualRoles} from './fps/fpsIdentityMatch.ts';
import {simulateFpsMatch,createFpsPrng,initializePlayerState} from './fps/fpsSimulationEngine.ts';
import {simulateFpsRound} from './fps/fpsRoundSimulation.ts';
import {generateSetPieceCall} from './fps/fpsSetPieceRules.ts';
import {FPS_MAPS} from './fps/fpsMaps.ts';

const plan={tempo:.4,structure:.7,aggression:.4,preparation:.8,freedom:.3,economy:.6};
const coach={tempo:.4,rigidity:.8,aggression:.4,preparation:.8,freedom:.3,economy:.6,communication:.7,leadership:.7,adaptability:.5,development:.7};
const chemistry={trust:.5,communication:.5,understanding:.5,leadershipAcceptance:.5,roleCompetition:.5};
const rosters=[createEqualizedRoster('blue'),createEqualizedRoster('red')];
const context=()=>({players:Object.fromEntries(rosters.flat().map((p,i)=>[p.id,{id:p.id,personality:FPS_IDENTITY_PERSONALITIES[i%24],specialty:FPS_SPECIALTIES[i%21],intensity:.8,dna:generatePlayerDNA(p.id),roleSuitability:.5,familiarity:.2}])),teams:{blue:{coach,plan,chemistry},red:{coach,plan,chemistry}}});
const actions=['pressure','prepare','react','coordinate','improvise','save','invest','equip','force','probe'].map(action=>({action,legal:true,tacticalValue:.5,instruction:0}));

test('all 24 personalities condition a probability rather than skill or legality',()=>{
  assert.equal(FPS_IDENTITY_PERSONALITIES.length,24);
  for(const personality of FPS_IDENTITY_PERSONALITIES) {
    const player={...Object.values(context().players)[0],personality};const before=structuredClone(player);
    const state={triggers:new Set(),opportunities:new Set(),confidence:.5,fatigue:0};
    const inactive=scoreTacticalActions(player,state,coach,plan,chemistry,actions);
    const active=scoreTacticalActions(player,{...state,triggers:new Set([personality.trigger])},coach,plan,chemistry,actions);
    assert.ok(active.find(a=>a.action===personality.action).probability>inactive.find(a=>a.action===personality.action).probability,personality.id);
    assert.ok(active.every(a=>a.probability>0&&a.probability<1));
    const decision=evaluatePlayerAction(player,{...state,triggers:new Set([personality.trigger])},coach,plan,chemistry,actions.map(a=>({...a,legal:a.action!==personality.action})),()=>.2);
    assert.notEqual(decision.action,personality.action);
    assert.deepEqual(player,before);
  }
});
test('all 21 specialties are inactive without their opportunity and bounded when active',()=>{
  assert.equal(FPS_SPECIALTIES.length,21);
  for(const specialty of FPS_SPECIALTIES) {
    assert.equal(resolveTacticalExecution(specialty,new Set(),1).executionBonus,0);
    const activation=resolveTacticalExecution(specialty,new Set([specialty.opportunity]),1);
    assert.equal(activation.active,true);assert.equal(activation.executionBonus,.04);
    assert.equal(resolveTacticalExecution(specialty,new Set([specialty.opportunity]),0).executionBonus,0);
  }
});
test('observed-context adapter supplies each personality trigger across appropriate situations',()=>{
  const observed={round:30,elapsed:100,quietSeconds:10,allies:1,enemies:3,winStreak:3,lossStreak:2,earlyDeath:true,advantage:true,disrupted:true,prepared:true,planCompromised:true,callerAlive:false,allyContact:true,poorRetake:true,utilityNeeded:true,economicTrouble:true,futureBuy:true,recoverableGear:true,rolePurchase:true};
  const triggers=observedPersonalityTriggers(observed);
  for(const trigger of observedPersonalityTriggers({...observed,round:1,enemies:0}))triggers.add(trigger);
  for(const personality of FPS_IDENTITY_PERSONALITIES)assert.ok(triggers.has(personality.trigger),personality.id);
});
test('coach, gameplan, DNA and chemistry affect decisions without an overall mechanical multiplier',()=>{
  const player=Object.values(context().players)[0],state={triggers:new Set(),opportunities:new Set(),confidence:.5,fatigue:0};
  const candidates=actions.map(a=>({...a,instruction:a.action==='coordinate'?1:-.5}));
  const a=scoreTacticalActions(player,state,coach,plan,chemistry,candidates);
  const b=scoreTacticalActions({...player,dna:{...player.dna,coachability:0}},state,coach,plan,chemistry,candidates);
  assert.notDeepEqual(a,b);
  assert.notDeepEqual(a,scoreTacticalActions(player,state,coach,{...plan,structure:0,freedom:1},chemistry,candidates));
  assert.notDeepEqual(a,scoreTacticalActions(player,state,{...coach,rigidity:0,freedom:1},{...plan,structure:0}, {...chemistry,trust:0,understanding:0},candidates));
  assert.notDeepEqual(generatePlayerDNA('a'),generatePlayerDNA('b'));
  let familiarity=.2;for(let i=0;i<10000;i++)familiarity=developFpsFamiliarity(familiarity,1,1);assert.ok(familiarity<=1&&familiarity>.2);
});
test('contextual rounds open with adaptive probing instead of a timed set-piece sequence',()=>{
  const input=context(),map=FPS_MAPS.breakwater;
  const attackers=rosters[0].map(card=>initializePlayerState(card,'blue','attackers',800));
  const defenders=rosters[1].map(card=>initializePlayerState(card,'red','defenders',800));
  assignContextualRoles(attackers,input);assignContextualRoles(defenders,input);
  for(const player of attackers){player.currentZone=map.attackerSpawnZone;player.loadout.primaryWeapon='rifle_assault';}
  for(const player of defenders){player.currentZone=map.defenderSpawnZone;player.loadout.primaryWeapon='rifle_assault';}
  attackers[0].loadout.hasBomb=true;
  const call=generateSetPieceCall(attackers,defenders,map,4,()=>.999,input);
  assert.equal(call.strategy,'default_probe');
  const result=simulateFpsRound(call,attackers,defenders,map,4,0,0,()=>.999,{identityExperiment:input,roundSeconds:8,bombSeconds:8});
  const firstMove=result.events.find(event=>event.type==='player_moved');
  assert.ok(firstMove);assert.ok(firstMove.second<15,'Contextual actors should not wait in a timed rally phase');
});
test('v3 matches preserve inputs, role responsibilities, event-derived results and deterministic replay',()=>{
  const input=context(),before=structuredClone(input);
  const report=simulateFpsMatch(...rosters,'breakwater',709,{identityExperiment:input});
  assert.equal(report.simulationVersion,3);assert.deepEqual(input,before);
  assert.deepEqual(report,simulateFpsMatch(...rosters,'breakwater',709,{identityExperiment:input}));
  const roles=new Set(report.roundSnapshots.map(s=>s.tactics.role));
  for(const role of ['entry','trade','support','sniper','lurker','anchor'])assert.ok(roles.has(role),role);
  assert.ok(report.events.some(e=>e.type==='tactical_decision'));
  assert.ok(report.events.some(e=>e.type==='specialty_activated'));
  for(const e of report.events.filter(e=>e.type==='specialty_activated'))assert.ok(e.executionBonus>0&&e.executionBonus<=.04);
  for(const stats of Object.values(report.playerStats))assert.equal(stats.kills,report.events.filter(e=>['kill','trade_kill'].includes(e.type)&&e.actorId===stats.playerId).length);
  for(const [id,player] of Object.entries(report.identityDevelopment.players))assert.ok(player.familiarity>=input.players[id].familiarity);
  const rng=createFpsPrng(33);assert.deepEqual(Array.from({length:10},()=>rng()),Array.from({length:10},createFpsPrng(33)));
});
test('private identity allocations fail closed on missing IDs, invalid roles and hidden trait bounds',()=>{
  const input=context(),ids=rosters.flat().map(p=>p.id);
  delete input.players[ids[0]];assert.throws(()=>hydrateFpsIdentityContext(input,ids));
  const invalid=context();invalid.players[ids[0]].dna.riskTolerance=101;assert.throws(()=>hydrateFpsIdentityContext(invalid,ids));
  const missing=structuredClone(context());delete missing.teams.blue.coach.tempo;assert.throws(()=>hydrateFpsIdentityContext(missing,ids));
  const caller=context();caller.players[ids[0]].assignedRole='caller';
  const report=simulateFpsMatch(...rosters,'foundry',21,{identityExperiment:caller});
  assert.ok(report.roundSnapshots.some(s=>s.playerId===ids[0]&&s.tactics.role==='caller'&&s.tactics.isCaller));
});

test('a caller can rebuild a failed execute only with a surviving caller and an alternative route',()=>{
  const input=context(),map=FPS_MAPS.breakwater;
  const blue=rosters[0].map(card=>initializePlayerState(card,'blue','attackers',800));
  const red=rosters[1].map(card=>initializePlayerState(card,'red','defenders',800));
  assignContextualRoles(blue,input);assignContextualRoles(red,input);
  const caller=blue.find(p=>p.tactics.isCaller),entry=blue.find(p=>p.tactics.role==='entry');
  assert.notEqual(caller,entry);
  for(const player of [...blue,...red]){player.currentZone=map.siteAZones[0];player.loadout.primaryWeapon='rifle_assault';}
  const call=generateSetPieceCall(blue,red,map,8,()=>.999,input);call.strategy='set_piece_execute';call.targetSite='A';call.callerId=caller.playerId;call.entryFraggerId=entry.playerId;
  entry.isAlive=false;
  input.players[caller.playerId].specialty=FPS_SPECIALTIES.find(s=>s.id==='midround_rebuilder');
  const result=simulateFpsRound(call,blue,red,map,8,0,0,()=>.999,{identityExperiment:input,roundSeconds:8});
  assert.ok(result.events.some(e=>e.type==='specialty_activated'&&e.specialtyId==='midround_rebuilder'));
});
