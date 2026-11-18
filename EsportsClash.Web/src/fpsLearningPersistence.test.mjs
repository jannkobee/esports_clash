import test from 'node:test';
import assert from 'node:assert/strict';
import {createFpsUtilityBrain,loadFpsUtilityBrain,consolidateFpsUtilityBrain,learnFpsThrowOutcome,fpsUtilityMemory,FPS_UTILITY_BRAIN_LIMITS,FPS_UTILITY_ARCHIVE_LIMITS} from './fps/fpsUtilityBrain.ts';
import {diffFpsUtilityBrain,applyFpsUtilityExperience,validFpsUtilityBundleBrain} from './fps/fpsUtilityLearningExperience.ts';
import {readStoredFpsModel,saveStoredFpsRound,startNewFpsLearningSlot} from './fps/fpsLearningCache.ts';
import {readFpsLearning,resetFpsLearning,FPS_LEARNING_STORAGE_KEY} from './fps/fpsLiveLearningStorage.ts';
import {seedFpsUtilityBrain} from './fps/fpsUtilityBrainStorage.ts';

const memory=()=>{const m=new Map();return {m,getItem:k=>m.get(k)??null,setItem:(k,v)=>m.set(k,v),removeItem:k=>m.delete(k),keys:()=>[...m.keys()]};};
const entry=(i,extra={})=>({style:'standard',flight:1.2,aimDx:i%5*.1,aimDz:0,attempts:2,successes:1,lastError:1,rejected:[],...extra});
const learned=brain=>Object.keys(brain.entries).length+Object.keys(brain.archive??{}).length+Object.values(brain.aggregates??{}).reduce((n,a)=>n+a.memories,0);

test('working-set overflow archives memories (learned aim kept, scratch dropped); nothing is lost',()=>{
  const brain=createFpsUtilityBrain();
  const total=FPS_UTILITY_BRAIN_LIMITS.entries+25;
  for(let i=0;i<total;i++)brain.entries[`fontessa:smoke:${i},0,>3,4,`]=entry(i,{step:.4,stale:2});
  consolidateFpsUtilityBrain(brain);
  assert.equal(Object.keys(brain.entries).length,FPS_UTILITY_BRAIN_LIMITS.entries);
  assert.equal(Object.keys(brain.archive).length,25);
  assert.equal(learned(brain),total);
  const archived=brain.archive['fontessa:smoke:3,0,>3,4,'];
  assert.deepEqual(archived,entry(3),'learned style/flight/aim/record survive; search scratch is dropped');
  assert.equal(fpsUtilityMemory(brain,'fontessa:smoke:3,0,>3,4,'),archived,'archived memories are still recalled');
});

test('an oversized stored brain is consolidated on load, never truncated',()=>{
  const raw=createFpsUtilityBrain();
  for(let i=0;i<FPS_UTILITY_BRAIN_LIMITS.entries+40;i++)raw.entries[`spillway:flash:${i},1,>2,2,`]=entry(i);
  const loaded=loadFpsUtilityBrain(JSON.parse(JSON.stringify(raw)));
  assert.equal(learned(loaded),FPS_UTILITY_BRAIN_LIMITS.entries+40);
  assert.ok(validFpsUtilityBundleBrain(JSON.parse(JSON.stringify(loaded))),'the consolidated form is canonical');
});

test('archive overflow folds into per-target aggregates with counts preserved',()=>{
  const brain=createFpsUtilityBrain();brain.archive={};
  for(let i=0;i<FPS_UTILITY_ARCHIVE_LIMITS.archive+3;i++)brain.archive[`fontessa:he:${i},0,>7,8,`]=entry(i);
  consolidateFpsUtilityBrain(brain);
  assert.equal(Object.keys(brain.archive).length,FPS_UTILITY_ARCHIVE_LIMITS.archive);
  assert.deepEqual(brain.aggregates['fontessa:he:7,8,:standard'],{attempts:6,successes:3,memories:3});
  assert.equal(learned(brain),FPS_UTILITY_ARCHIVE_LIMITS.archive+3);
});

test('an archived throw is revived and continues learning from its stored record',()=>{
  const brain=createFpsUtilityBrain(),key='fontessa:smoke:0,0,>5,5,';
  brain.archive={[key]:entry(0,{aimDx:1.5,attempts:4,successes:3})};
  const plan={key,style:'standard',aimTarget:{x:6.5,z:5},flightTime:1.2,launchYaw:0,launchPitch:0,source:'remembered',path:'open',distance:7};
  learnFpsThrowOutcome(brain,{key,plan,intended:{x:5,z:5},landing:{x:5.1,y:.09,z:5},targetFloor:0});
  assert.equal(brain.archive,undefined);assert.equal(brain.entries[key].attempts,5);assert.equal(brain.entries[key].successes,4);
});

test('replaying learner deltas reproduces archive tiers exactly',()=>{
  const before=seedFpsUtilityBrain(),after=structuredClone(before);
  for(let i=0;i<FPS_UTILITY_BRAIN_LIMITS.entries;i++)after.entries[`spillway:smoke:${i},9,>1,1,`]=entry(i);
  after.throws+=5;after.revision+=5;consolidateFpsUtilityBrain(after);
  const replayed=applyFpsUtilityExperience(structuredClone(before),JSON.parse(JSON.stringify(diffFpsUtilityBrain('r1',before,after))));
  assert.deepEqual(Object.keys(replayed.archive),Object.keys(after.archive));
  assert.deepEqual(replayed,after);
});

test('unreadable local learning is quarantined, never overwritten, and reset keeps the old slot',()=>{
  const store=memory();
  store.setItem(FPS_LEARNING_STORAGE_KEY,'{corrupt');
  assert.equal(readFpsLearning(store),undefined);
  const quarantined=store.keys().filter(k=>k.startsWith(FPS_LEARNING_STORAGE_KEY+':quarantine:'));
  assert.equal(quarantined.length,1);assert.equal(JSON.parse(store.getItem(quarantined[0])).text,'{corrupt');
  // Size no longer matters: large valid models load (the old 100 kB read limit silently dropped them).
  const load=raw=>raw?.ok?raw:undefined;
  store.setItem('k',JSON.stringify({ok:true,pad:'x'.repeat(300000)}));
  assert.equal(readStoredFpsModel(store,'k',load).pad.length,300000);
  const saved=saveStoredFpsRound(store,'k',load,()=>({ok:true,n:0}),m=>{m.n=(m.n??0)+1;},{});
  assert.equal(saved.n,1);assert.equal(saved.pad.length,300000,'saving builds on the stored model');
  const slot=startNewFpsLearningSlot(store,'k');
  assert.ok(slot&&JSON.parse(store.getItem(slot)).pad.length===300000);assert.equal(store.getItem('k'),null);
  resetFpsLearning(store);assert.equal(store.keys().filter(k=>k.includes(':slot:')).length,1,'nothing to slot when empty');
});

test('a storage failure during save never replaces stored data',()=>{
  const store=memory(),load=raw=>raw?.ok?raw:undefined;
  store.setItem('k','not json');
  const failing={...store,setItem:(k,v)=>{if(k.includes(':quarantine:'))throw Error('quota');store.setItem(k,v);}};
  assert.equal(saveStoredFpsRound(failing,'k',load,()=>({ok:true}),()=>{},{}),undefined);
  assert.equal(store.getItem('k'),'not json','the original bytes are kept when quarantine fails');
});
