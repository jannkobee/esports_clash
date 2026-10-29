import test from 'node:test';
import assert from 'node:assert/strict';
import {GameplayEvidence} from './gameplayEvidence.ts';
const sample={second:1,actor:'a',alive:true,intent:'minion',target:'m',x:10,y:10,hp:100,gold:0,cs:0,damage:0,deaths:0};
test('sampled execution distinguishes stationary stalls, farming progress and safe recovery',()=>{
  const e=new GameplayEvidence();e.observe(sample);e.observe({...sample,second:1.5});
  assert.equal(e.counters.stalledSeconds,.5);
  e.observe({...sample,second:2,cs:1});assert.equal(e.counters.stalledSeconds,.5);
  e.observe({...sample,second:2.5,intent:'recall'});e.observe({...sample,second:3,intent:'recover'});
  assert.equal(e.counters.stalledSeconds,.5);assert.equal(e.counters.recallStarts,1);
  const snapshot=e.snapshot();snapshot.events.length=0;assert.ok(e.events.length>0);
});
test('retreat survival diagnostic excludes deaths and event history is bounded',()=>{
  const e=new GameplayEvidence();e.observe({...sample,intent:'retreat'});e.observe({...sample,second:2});
  assert.equal(e.counters.retreatsSurvived,1);
  e.observe({...sample,second:3,intent:'retreat'});e.observe({...sample,second:4,alive:false,deaths:1});
  assert.equal(e.counters.retreatsSurvived,1);
  for(let i=0;i<600;i++)e.observe({...sample,second:5+i,target:String(i)});
  assert.equal(e.events.length,500);
});
