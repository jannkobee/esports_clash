const test=()=>{};
import assert from 'node:assert/strict';
import {FPS_ABILITIES,FPS_ABILITY_SUPPORT,generateFpsSkillProfile,validateFpsSkillProfile,estimateLegacyFpsSkillProfile,fpsSkillSummaries,fpsSkillRandom} from '../EsportsClash.Web/src/fps/fpsSkillProfile.ts';
import {detailedReactionDelay,detailedSenseInterval,detailedAimYaw,detailedInputError,preparedAngleError,detailedThrowPoint,advanceDetailedRecoil,detailedRecoilImpulse,tickFpsMentalState} from '../EsportsClash.Web/src/fps/fpsDetailedExecution.ts';
import {recordFpsOpponentPattern,knownFpsPattern,interpretFpsInformation} from '../EsportsClash.Web/src/fps/fpsOpponentPatterns.ts';
import {emptyLiveIntel,rememberLiveIntel} from '../EsportsClash.Web/src/fps/fpsLiveIntel.ts';
import {FpsLiveSimulation} from '../EsportsClash.Web/src/fps/fpsLiveSimulation.ts';
import {buyLiveTeam} from '../EsportsClash.Web/src/fps/fpsLiveEconomy.ts';
import {LIVE_RUN_SPEED,liveShotSpeedLimit} from '../EsportsClash.Web/src/fps/fpsLiveMovement.ts';
import {liveWalkable,LIVE_FPS_MAP,liveActorSolids,distance,findLiveCover,liveSightline} from '../EsportsClash.Web/src/fps/fpsLiveMap.ts';
import {segmentHitsWall} from '../EsportsClash.Web/src/fps/fpsSpatialWorld.ts';
import {FPS_IDENTITY_PERSONALITIES,generatePlayerDNA} from '../EsportsClash.Web/src/fps/fpsIdentity.ts';

const createdAt='2026-11-11T00:00:00.000Z';
const plan={tempo:.6,structure:.7,aggression:.5,preparation:.7,freedom:.5,economy:.8};
test('Economy Judgment preserves a bounded next-buy reserve without changing full-buy prices',()=>{
  const players=['entry','trade','sniper','support','anchor'].map((role,i)=>({id:`budget-${i}`,role,cash:2000,weapon:i<2?'ak47':'glock',armor:i<2?100:0,kit:false,flash:0,smoke:0,incendiary:0,he:0,attacking:true}));
  const original=structuredClone(players),loose=buyLiveTeam(players,plan,3,1,false,0),disciplined=buyLiveTeam(players,plan,3,1,false,1);
  assert.equal(loose.mode,'half');assert.equal(disciplined.mode,'half');assert.ok(disciplined.spent<loose.spent);
  for(const result of [loose,disciplined])assert.equal(result.spent+result.players.reduce((n,p)=>n+p.cash,0),10000);
  assert.deepEqual(players,original);
  const rich=players.map(p=>({...p,cash:10000}));
  assert.deepEqual(buyLiveTeam(rich,plan,3,0,false,0),buyLiveTeam(rich,plan,3,0,false,1));
});
const coach={...plan,rigidity:.7,communication:.7,leadership:.7,adaptability:.7,development:.5};
const chemistry={trust:.6,communication:.6,understanding:.6,leadershipAcceptance:.6,roleCompetition:.3};
const cards=Array.from({length:10},(_,i)=>({id:`abilities-${i}`,name:`Player ${i}`,stats:{lan:80,iq:80,tf:80,clu:80,sta:80,flx:80,ldr:80}}));
const identity={players:Object.fromEntries(cards.map((p,i)=>[p.id,{id:p.id,personality:FPS_IDENTITY_PERSONALITIES[i],dna:generatePlayerDNA(p.id),intensity:.6,roleSuitability:.6,familiarity:.5}])),teams:{blue:{coach,plan,chemistry},red:{coach,plan,chemistry}}};
const profile=(id=cards[0].id,edits={})=>({...generateFpsSkillProfile(id,1337,createdAt),values:{...Object.fromEntries(FPS_ABILITIES.map(key=>[key,5.5])),...edits}});
const profiles=(edits={})=>Object.fromEntries(cards.map(p=>[p.id,profile(p.id,edits)]));
const game=(edits={},seed=1337)=>new FpsLiveSimulation(cards.slice(0,5),cards.slice(5),seed,identity,{skillProfiles:profiles(edits)});

const sim=game();for(let i=0;i<5500;i++){sim.step();if(i===4499||i===5499){const s=sim.snapshot();console.log(JSON.stringify({time:s.time,round:s.round,phase:s.phase,bomb:s.bomb,remaining:s.remaining,shots:s.players.reduce((n,p)=>n+p.impact.shots,0)}));}}
