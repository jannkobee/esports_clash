import assert from 'node:assert/strict';
import {test} from 'node:test';
import {FpsLiveMechanicsLearner,applyFpsMechanicsRound,createFpsMechanicsModel,loadFpsMechanicsModel} from './fps/fpsLiveMechanicsLearning.ts';
import {FPS_MECHANICS_STORAGE_KEY,readFpsMechanicsLearning,saveFpsMechanicsRound} from './fps/fpsLiveMechanicsLearningStorage.ts';
import {FPS_LEARNING_STORAGE_KEY} from './fps/fpsLiveLearningStorage.ts';

test('rifle cadence learns from combat outcomes and commits only at round completion',()=>{
  const learner=new FpsLiveMechanicsLearner(),context='far:steady:loaded';
  const action=learner.choose('actor','enemy','blue',context,()=>.99);
  assert.equal(action,'burst');
  assert.equal(learner.choose('actor','enemy','blue',context,()=>0),action,'an engagement keeps its selected cadence');
  learner.recordDamage('actor','enemy',30);learner.recordKill('actor','enemy');
  assert.equal(learner.stats().updates,0,'live feedback remains pending until a round completes');
  const round=learner.completeRound('blue','round-1');
  assert.equal(round.samples.length,1);assert.ok(round.samples[0].reward>0);
  assert.equal(learner.stats().updates,1);assert.equal(learner.stats().rounds,1);
  assert.ok(learner.model.values[context].burst>.12);
});

test('combat checkpoints validate and persist separately from route reports',()=>{
  const model=createFpsMechanicsModel(),round={id:'persist-1',samples:[{context:'near:moving:low',action:'sustain',reward:.7}]};
  assert.equal(applyFpsMechanicsRound(model,round),true);assert.equal(applyFpsMechanicsRound(model,round),false);
  assert.equal(loadFpsMechanicsModel({...model,compatibility:'other'}),undefined);
  assert.throws(()=>applyFpsMechanicsRound(model,{id:'bad',samples:[{...round.samples[0],reward:3}]}));
  const data=new Map(),storage={getItem:key=>data.get(key)??null,setItem:(key,value)=>data.set(key,value),removeItem:key=>data.delete(key)};
  saveFpsMechanicsRound(round,storage);
  assert.equal(readFpsMechanicsLearning(storage).rounds,1);
  assert.notEqual(FPS_MECHANICS_STORAGE_KEY,FPS_LEARNING_STORAGE_KEY);
});
