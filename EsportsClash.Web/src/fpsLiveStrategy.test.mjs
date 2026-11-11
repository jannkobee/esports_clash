import test from 'node:test';
import assert from 'node:assert/strict';
import {chooseLiveTactic} from './fps/fpsLiveTactics.ts';

const samples=(history,team='red',pistol=false)=>Array.from({length:1000},(_,i)=>chooseLiveTactic(history,team,pistol,()=>i/1000));
test('all seven calls remain possible, including pistol variations',()=>{
  assert.equal(new Set(samples([])).size,7);
  assert.equal(new Set(samples([],'red',true)).size,7);
});
test('failed repeated calls lose weight without imposing a fixed rotation',()=>{
  const history=Array.from({length:5},(_,i)=>({round:i+1,attackTeam:'red',attackSite:'B',tactic:'rush_b',winner:'blue',bombPlanted:false}));
  const count=list=>list.filter(t=>t==='rush_b').length;
  assert.ok(count(samples(history))<count(samples([]))/2);
  assert.ok(count(samples(history))>0);
  assert.deepEqual(samples(history,'blue'),samples([],'blue'),'New attackers do not inherit the other team?s failures');
  assert.ok(count(samples(history.map(h=>({...h,winner:'red'}))))>count(samples(history)));
});
