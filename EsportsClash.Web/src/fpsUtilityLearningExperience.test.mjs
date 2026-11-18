import {test} from 'node:test';
import assert from 'node:assert/strict';
import {seedFpsUtilityBrain} from './fps/fpsUtilityBrainStorage.ts';
import {createFpsUtilityBrain,FPS_UTILITY_BRAIN_LIMITS} from './fps/fpsUtilityBrain.ts';
import {consolidateFpsUtilityBrain} from './fps/fpsUtilityBrain.ts';
import {diffFpsUtilityBrain,applyFpsUtilityExperience,loadFpsUtilityExperience,validFpsUtilityBundleBrain,FPS_UTILITY_BUNDLE_MAX_BYTES} from './fps/fpsUtilityLearningExperience.ts';
import {compatibleApproved} from './fps/fpsApprovedLearning.ts';
import {createFpsLearningModel} from './fps/fpsLiveLearning.ts';
import {createFpsMechanicsModel} from './fps/fpsLiveMechanicsLearning.ts';
import {createFpsMovementModel} from './fps/fpsLiveMovementLearning.ts';

const ordered=brain=>JSON.stringify({...brain,entries:Object.entries(brain.entries),spots:Object.entries(brain.spots),archive:Object.entries(brain.archive??{})});
/** Mutates like the learner: a changed memory is deleted and re-inserted (most recently used last). */
function learnerTouch(brain,key,patch){const entry={...(brain.entries[key]??{style:'standard',flight:1.2,aimDx:0,aimDz:0,attempts:0,successes:0,lastError:0,rejected:[]}),...patch};delete brain.entries[key];brain.entries[key]=entry;brain.throws++;brain.revision++;if(patch.successes>(entry.successes-1))brain.successes++;}

test('round deltas replay the shared utility brain exactly, including order and archiving',()=>{
  const before=seedFpsUtilityBrain(),after=structuredClone(before);
  const [first,second]=Object.keys(before.entries);
  learnerTouch(after,first,{aimDx:.5,attempts:before.entries[first].attempts+1,lastError:1.1});
  learnerTouch(after,'fontessa:smoke:1,1,>2,2,',{attempts:1,successes:1,lastError:.4});
  consolidateFpsUtilityBrain(after,[second]);
  after.spots['fontessa:smoke:test:1,2,']={x:1,z:2,successes:1};
  const experience=diffFpsUtilityBrain('job:utility:1',before,after);
  assert.equal(experience.throws,2);assert.deepEqual(experience.removedEntries,[second]);
  assert.ok(Object.keys(experience.entries).length<Object.keys(after.entries).length,'unchanged memories are not resent');
  const replayed=applyFpsUtilityExperience(structuredClone(before),JSON.parse(JSON.stringify(experience)));
  assert.equal(ordered(replayed),ordered(after));
  assert.deepEqual(diffFpsUtilityBrain('job:utility:2',after,after),{id:'job:utility:2',throws:0,successes:0,entries:{},spots:{},removedEntries:[],removedSpots:[]});
});

test('replay keeps the brain bounded like the learner',()=>{
  const brain=createFpsUtilityBrain(),entries={};
  for(let i=0;i<FPS_UTILITY_BRAIN_LIMITS.entries;i++)entries[`fontessa:smoke:${i},0,>0,0,`]={style:'standard',flight:1,aimDx:0,aimDz:0,attempts:1,successes:0,lastError:3,rejected:[]};
  applyFpsUtilityExperience(brain,{id:'a',throws:1,successes:0,entries,spots:{},removedEntries:[],removedSpots:[]});
  applyFpsUtilityExperience(brain,{id:'b',throws:1,successes:1,entries:{'fontessa:smoke:new,0,>0,0,':{style:'jump',flight:2,aimDx:1,aimDz:1,attempts:1,successes:1,lastError:.2,rejected:[]}},spots:{},removedEntries:[],removedSpots:[]});
  const keys=Object.keys(brain.entries);
  assert.equal(keys.length,FPS_UTILITY_BRAIN_LIMITS.entries);assert.equal(keys.at(-1),'fontessa:smoke:new,0,>0,0,');assert.ok(!('fontessa:smoke:0,0,>0,0,' in brain.entries));
  assert.deepEqual(Object.keys(brain.archive),['fontessa:smoke:0,0,>0,0,'],'the oldest memory is archived, not dropped');
  assert.equal(brain.throws,2);assert.equal(brain.successes,1);
});

test('malformed utility experience is rejected whole',()=>{
  const good={id:'x',throws:1,successes:1,entries:{'k':{style:'standard',flight:1,aimDx:0,aimDz:0,attempts:1,successes:1,lastError:.3,rejected:[]}},spots:{},removedEntries:[],removedSpots:[]};
  assert.ok(loadFpsUtilityExperience(good));
  for(const bad of [{...good,successes:2},{...good,throws:-1},{...good,id:''},{...good,removedEntries:'k'},
    {...good,entries:{k:{...good.entries.k,aimDx:50}}},{...good,entries:{k:{...good.entries.k,style:'teleport'}}},{...good,spots:{s:{x:500,z:0,successes:1}}}]){
    assert.equal(loadFpsUtilityExperience(bad),undefined);assert.throws(()=>applyFpsUtilityExperience(createFpsUtilityBrain(),bad),/Invalid utility experience/);
  }
});

test('bundle brains must be canonical and within the size bound',()=>{
  const seed=seedFpsUtilityBrain();
  assert.ok(validFpsUtilityBundleBrain(seed));assert.ok(validFpsUtilityBundleBrain(createFpsUtilityBrain()));
  assert.equal(validFpsUtilityBundleBrain({...seed,extra:true}),undefined);
  const first=Object.keys(seed.entries)[0];
  assert.equal(validFpsUtilityBundleBrain({...seed,entries:{...seed.entries,[first]:{...seed.entries[first],aimDx:50}}}),undefined,'a memory the loader would drop is not silently repaired');
  const big=structuredClone(seed);big.spots={};for(let i=0;i<200;i++)big.spots['s'.repeat(110)+i]={x:1,z:1,successes:1};
  for(let i=0;JSON.stringify(big).length<=FPS_UTILITY_BUNDLE_MAX_BYTES&&i<5000;i++)big.entries['e'.repeat(100)+i]=seed.entries[first];
  assert.equal(validFpsUtilityBundleBrain(big),undefined);
});

test('approved bundles stay valid with or without a utility brain',()=>{
  const core={version:2,navigation:createFpsLearningModel(),combat:createFpsMechanicsModel(),movement:createFpsMovementModel()};
  const old=compatibleApproved(core);assert.ok(old);assert.equal(old.utility,undefined);
  const seed=seedFpsUtilityBrain(),withUtility=compatibleApproved({...core,utility:seed});
  assert.equal(withUtility.utility.throws,seed.throws);assert.equal(Object.keys(withUtility.utility.entries).length,Object.keys(seed.entries).length);
  // PHP-decoded empty maps arrive as arrays in some paths; they still load as empty maps.
  assert.deepEqual(compatibleApproved({...core,utility:{...createFpsUtilityBrain(),entries:[],spots:[]}}).utility.entries,{});
  const broken=compatibleApproved({...core,utility:{version:99}});assert.ok(broken);assert.equal(broken.utility,undefined,'a bad utility brain falls back to the seed without losing the other models');
});
