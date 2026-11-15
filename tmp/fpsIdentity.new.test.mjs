import test from 'node:test';
import assert from 'node:assert/strict';
import {FPS_IDENTITY_PERSONALITIES,FPS_BASE_BEHAVIORAL_PROFILES,FPS_T_POSITIONS,FPS_CT_POSITIONS,naturalFpsIdentity,generateFpsPersonality,defaultFpsAssignments,validateFpsLineup,validateFpsPersonality,emptyFpsObservedBehavior,observeFpsBehavior,observedFpsIdentity} from './fps/fpsPlayerArchitecture.ts';
import {createFpsIdentityContext,hydrateFpsIdentityContext} from './fps/fpsIdentityMatch.ts';
import {scoreTacticalActions,evaluatePlayerAction} from './fps/fpsIdentity.ts';
import {FpsLiveSimulation} from './fps/fpsLiveSimulation.ts';
import {simulateFpsMatch,createFpsPrng} from './fps/fpsSimulationEngine.ts';
import {generateFpsSkillProfile} from './fps/fpsSkillProfile.ts';
import {detailedInputError} from './fps/fpsDetailedExecution.ts';
const cards=Array.from({length:10},(_,i)=>({id:`architecture-${i}`,name:`Alias ${i}`,stats:{rifling:40,sniping:60,entry:70,utility:60,positioning:70,shotcalling:80}}));
const context=()=>createFpsIdentityContext(cards.slice(0,5),cards.slice(5));
const actions=['pressure','prepare','react','coordinate','improvise','probe'].map(action=>({action,legal:true,tacticalValue:.5,instruction:.5}));
const state={triggers:new Set(),opportunities:new Set(),confidence:.5,fatigue:0};
const personality=(overrides={})=>validateFpsPersonality({temperament:'STEADY',playstyle:'AGGRESSIVE',mindset:'INDIVIDUALIST',decisionStyle:'INSTINCTIVE',...overrides});

test('54 composable personalities, 18 profiles and all 540 position identities round-trip and run',()=>{
 assert.equal(FPS_BASE_BEHAVIORAL_PROFILES.length,18);assert.equal(FPS_IDENTITY_PERSONALITIES.length,54);assert.equal(new Set(FPS_IDENTITY_PERSONALITIES.map(p=>p.id)).size,54);
 let configurations=0;
 for(const personality of FPS_IDENTITY_PERSONALITIES){
  const ctx=context();for(const p of Object.values(ctx.players))p.personality=personality;
  assert.deepEqual(hydrateFpsIdentityContext(JSON.parse(JSON.stringify(ctx)),cards.map(p=>p.id)),ctx);
  const sim=new FpsLiveSimulation(cards.slice(0,5),cards.slice(5),414,ctx);sim.step();
  for(const position of [...FPS_T_POSITIONS,...FPS_CT_POSITIONS]){assert.ok(naturalFpsIdentity(personality,position));configurations++;}
 }
 assert.equal(configurations,540);
 const generated=new Set(Array.from({length:4000},(_,i)=>generateFpsPersonality('generated-'+i).id));assert.equal(generated.size,54);
});

test('Fragging IGL identity and intention do not depend on rifle skill or results',()=>{
 const p=personality();assert.equal(naturalFpsIdentity(p,'T_IGL'),'Steady Fragging IGL');
 const ctx=context(),player={...ctx.players[cards[0].id],personality:p},team=ctx.teams.blue;
 const low={...player,rifling:4,kills:0,deaths:40},high={...player,rifling:9,kills:40,deaths:0};
 assert.deepEqual(scoreTacticalActions(low,state,team.coach,team.plan,team.chemistry,actions),scoreTacticalActions(high,state,team.coach,team.plan,team.chemistry,actions));
 assert.equal(naturalFpsIdentity({...p,playstyle:'PASSIVE',mindset:'TEAM_FIRST',decisionStyle:'METHODICAL'},'T_IGL'),'Steady Tactical IGL');
});

test('personality has statistically observable seeded consequences without changing execution',()=>{
 const ctx=context(),team=ctx.teams.blue;const run=p=>{const random=createFpsPrng(913);let pressure=0;for(let i=0;i<6000;i++)if(evaluatePlayerAction({...ctx.players[cards[0].id],personality:p},state,team.coach,team.plan,team.chemistry,actions,random).action==='pressure')pressure++;return pressure;};
 const aggressive=run(personality()),passive=run(personality({playstyle:'PASSIVE',mindset:'TEAM_FIRST',decisionStyle:'METHODICAL'}));assert.ok(aggressive>passive*3,`${aggressive} vs ${passive}`);
 const profile=generateFpsSkillProfile('same',1,'2026-11-14T00:00:00Z');
 assert.equal(detailedInputError(profile,.9,()=>.8),detailedInputError({...profile,personality:personality({temperament:'ICE_COLD'})},.9,()=>.8));
});

test('all decision styles react to lawful evidence; temperament changes pressure decisions without aim bonuses',()=>{
 const ctx=context(),base=ctx.players[cards[0].id],team=ctx.teams.blue;
 for(const decisionStyle of ['INSTINCTIVE','METHODICAL','ADAPTIVE']){
  const p={...base,personality:personality({decisionStyle})},before=scoreTacticalActions(p,state,team.coach,team.plan,team.chemistry,actions),after=scoreTacticalActions(p,{...state,triggers:new Set(['contradictedCall','setback'])},team.coach,team.plan,team.chemistry,actions);
  assert.ok(after.find(x=>x.action==='react').score>before.find(x=>x.action==='react').score);
  assert.equal(evaluatePlayerAction(p,state,team.coach,team.plan,team.chemistry,[{action:'save',legal:true,tacticalValue:0,instruction:0},{action:'pressure',legal:false,tacticalValue:99,instruction:1}],()=>0).action,'save');
 }
 const scores=temperament=>scoreTacticalActions({...base,personality:personality({temperament})},{...state,confidence:.1,triggers:new Set(['pressure'])},team.coach,team.plan,team.chemistry,actions);
 assert.notDeepEqual(scores('VOLATILE'),scores('ICE_COLD'));
});

test('lineups lock both complete sides, reject duplicate slots and permit different responsibilities',()=>{
 const assignments=defaultFpsAssignments(cards.slice(0,5).map(p=>p.id)),players=cards.slice(0,5).map(p=>({id:p.id,assignments:assignments[p.id]}));validateFpsLineup(players);
 assert.throws(()=>validateFpsLineup(players.slice(1)));assert.throws(()=>validateFpsLineup([...players.slice(1),players[1]]));
 const bad=structuredClone(players);bad[1].assignments.ct=bad[0].assignments.ct;assert.throws(()=>validateFpsLineup(bad));
 const ctx=context();[ctx.players[cards[0].id].assignments.ct,ctx.players[cards[3].id].assignments.ct]=[ctx.players[cards[3].id].assignments.ct,ctx.players[cards[0].id].assignments.ct];
 const sim=new FpsLiveSimulation(cards.slice(0,5),cards.slice(5),97,ctx);assert.equal(sim.snapshot().players[0].position,'CT_ANCHOR_B');
 sim.actors[0].x=20;sim.actors[0].z=-10;assert.equal(sim.snapshot().players[0].position,'CT_ANCHOR_B');
 assert.equal(ctx.players[cards[0].id].assignments.t,'T_IGL');
});

test('observed identity requires sustained opportunity-normalized decisions, not K/D',()=>{
 const high=emptyFpsObservedBehavior(),low=emptyFpsObservedBehavior();high.matches=low.matches=5;
 for(let i=0;i<40;i++){observeFpsBehavior(high,'engagement',i<32);observeFpsBehavior(low,'engagement',i<10);}
 assert.match(observedFpsIdentity(high),/Proactive/);assert.match(observedFpsIdentity(low),/Selective/);
 high.matches=1;assert.equal(observedFpsIdentity(high),undefined);assert.equal(observedFpsIdentity({...low,kills:999,deaths:0}),observedFpsIdentity(low));
});

test('recorded matches pin v4 identities and positions, preserve inputs and reproduce events',()=>{
 const ctx=context(),before=structuredClone(ctx);const run=()=>simulateFpsMatch(cards.slice(0,5),cards.slice(5),'breakwater',311,{identityExperiment:ctx,maxRounds:4,overtimeEnabled:false});
 const a=run(),b=run();assert.deepEqual(a,b);assert.deepEqual(ctx,before);assert.equal(a.simulationVersion,4);assert.ok(a.events.some(e=>e.type==='behavior_observation'));
 assert.ok(!a.events.some(e=>e.type==='specialty_activated'));for(const s of a.roundSnapshots)assert.ok(s.tactics.position);
});

test('live decisions change actual intention distributions across multiple seeds',()=>{
 const run=personality=>{let pressure=0;for(let seed=1;seed<=40;seed++){
  const ctx=context();ctx.players[cards[5].id].personality=personality;
  const sim=new FpsLiveSimulation(cards.slice(0,5),cards.slice(5),seed,ctx),actor=sim.actors[5];
  sim.phase='live';sim.time=20;sim.liveElapsed=5;sim.remaining=100;
  for(let i=0;i<15;i++){sim.decide(actor);if(actor.decision==='pressure')pressure++;}
 }return pressure;};
 const aggressive=run(personality()),passive=run(personality({playstyle:'PASSIVE',mindset:'TEAM_FIRST',decisionStyle:'METHODICAL'}));assert.ok(aggressive>passive*2,`${aggressive} vs ${passive}`);
});
