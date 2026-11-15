import test from 'node:test';
import assert from 'node:assert/strict';
import {rankLiveSmokeLineups,canReachLiveOpeningLineup} from './fps/fpsLiveLineupDecisions.ts';
import {LIVE_AUTHORED_SMOKE_LINEUPS} from './fps/fpsSmokeLineupDefinitions.ts';

const lineups=LIVE_AUTHORED_SMOKE_LINEUPS.filter(l=>l.phase==='execute'&&l.site==='A');
const [arch,library]=lineups;
const belief=(point,extra={})=>({key:'reported-angle',observerId:'own-player',source:'sight',observed:10,confidence:.95,uncertainty:.5,
  certainty:.9,radius:.8,age:.3,...point,...extra});
const context=(beliefs=[],travelTo=()=>10)=>({from:{x:-19,z:8},beliefs,travelTo});

test('a credible sniper angle outweighs the extra walk to its covering smoke',()=>{
  const result=rankLiveSmokeLineups(lineups,context([belief(library.target,{weaponHint:'sniper',source:'gunfire'})],p=>p===arch.position?1:28));
  assert.equal(result[0].id,library.id);
});

test('a fresh visual crossing also gives its covering smoke priority',()=>{
  assert.equal(rankLiveSmokeLineups(lineups,context([belief(library.target)],p=>p===arch.position?1:20))[0].id,library.id);
});

test('stale, imprecise and weak sound clues do not displace a reachable closer setup',()=>{
  for(const extra of [{age:6},{radius:9},{certainty:.2},{source:'footstep'}]){
    assert.equal(rankLiveSmokeLineups(lineups,context([belief(library.target,extra)],p=>p===arch.position?1:20))[0].id,arch.id);
  }
});

test('ranking is stable, deterministic and leaves supplied lineups and beliefs unchanged',()=>{
  const beliefs=[belief(library.target)],before=structuredClone({lineups,beliefs});
  assert.deepEqual(rankLiveSmokeLineups(lineups,context()),lineups);
  const a=rankLiveSmokeLineups(lineups,context(beliefs)),b=rankLiveSmokeLineups(lineups,context(beliefs));
  assert.deepEqual(a,b);assert.deepEqual({lineups,beliefs},before);assert.notEqual(a,lineups);
  assert.deepEqual(rankLiveSmokeLineups(lineups,context([...beliefs,...beliefs])),a,'Copied reports must not multiply coverage value');
});

test('known angle value cannot promote an unreachable lineup',()=>{
  assert.equal(rankLiveSmokeLineups(lineups,context([belief(library.target,{weaponHint:'sniper'})],p=>p===arch.position?10:Infinity))[0].id,arch.id);
  assert.deepEqual(rankLiveSmokeLineups(lineups,context([],()=>Infinity)),lineups);
});

test('ordinary spawn opening lineups retain their travel and paid preparation budget',()=>{
  for(const l of LIVE_AUTHORED_SMOKE_LINEUPS.filter(l=>l.phase==='opening')){
    assert.equal(canReachLiveOpeningLineup(8,0,90,.6,Math.hypot(l.target.x-l.position.x,l.target.z-l.position.z)),true,l.id);
  }
  assert.equal(canReachLiveOpeningLineup(5,3,87,.8,35),true);
});

test('a late advanced player cannot walk back to a spawn lineup after its useful opening window',()=>{
  assert.equal(canReachLiveOpeningLineup(30,14,76,.8,35),false);
  assert.equal(canReachLiveOpeningLineup(0,18,72,1,35),false);
  assert.equal(canReachLiveOpeningLineup(0,10,80,1,15),true);
});

test('opening estimates retain the plant clock and reject invalid or excessive route costs',()=>{
  assert.equal(canReachLiveOpeningLineup(1,0,8,.8,35),false);
  for(const travel of [NaN,Infinity,-1,60])assert.equal(canReachLiveOpeningLineup(travel,0,90,.8,35),false);
  assert.equal(canReachLiveOpeningLineup(1,0,90,.8,NaN),false);
});
