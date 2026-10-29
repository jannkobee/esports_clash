import test from 'node:test';
import assert from 'node:assert/strict';
import {fitBaselineActor,baselineImitationMetrics} from './baselineImitation.ts';
import {loadIntelligencePolicy,chooseIntelligenceAction} from './intelligencePolicy.ts';
test('offline imitation learns contextual baseline choices and exports the existing PPO actor format',()=>{
  const example=(x,action)=>({observation:[x,...Array(19).fill(0)],action,mask:[true,true,false,false,false]});
  const data=Array.from({length:64},(_,i)=>example(i%2?1:-1,i%2));
  const actor=fitBaselineActor(data,80);assert.ok(loadIntelligencePolicy(actor));
  assert.equal(baselineImitationMetrics(actor,data).accuracy,1);
  assert.equal(chooseIntelligenceAction(actor,example(1,1).observation,['fight','wave']).action,'wave');
  assert.deepEqual(actor,fitBaselineActor(data,80));
  assert.throws(()=>fitBaselineActor([{...data[0],mask:[false,false,false,false,false]}]),/Invalid/);
});
