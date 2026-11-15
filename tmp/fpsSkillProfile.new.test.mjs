import test from 'node:test';
import assert from 'node:assert/strict';
import {FPS_ABILITIES,generateFpsSkillProfile,validateFpsSkillProfile,pinFpsSkillProfile,migrateFpsSkillProfile,fpsAbilityUnit,fpsSkillRandom} from './fps/fpsSkillProfile.ts';
import {detailedReactionDelay,detailedInputError,detailedThrowPoint,tickFpsMentalState} from './fps/fpsDetailedExecution.ts';
const profile=values=>({...generateFpsSkillProfile('test',141,'2026-11-14T00:00:00Z'),values:{rifling:5,sniping:5,entry:5,utility:5,positioning:5,shotcalling:5,...values}});
test('exactly six validated execution attributes, bounded 1–10 and frozen at allocation',()=>{
 assert.deepEqual(FPS_ABILITIES,['rifling','sniping','entry','utility','positioning','shotcalling']);
 const input=profile(),p=pinFpsSkillProfile(input,'test');input.values.rifling=1;assert.equal(p.values.rifling,5);assert.ok(Object.isFrozen(p.values));
 for(const bad of [{...input,version:1},profile({rifling:0}),profile({rifling:11}),profile({precision:5})])assert.throws(()=>validateFpsSkillProfile(bad));
});
test('rifling and sniping resolve their own weapons while temperament never changes mechanical limits',()=>{
 const low=profile({rifling:1,sniping:10}),high=profile({rifling:10,sniping:1});assert.ok(detailedReactionDelay(high)<detailedReactionDelay(low));assert.ok(detailedReactionDelay(low,true)<detailedReactionDelay(high,true));
 const variance=p=>{const random=fpsSkillRandom(7,'input');let sum=0;for(let i=0;i<5000;i++)sum+=detailedInputError(p,.8,random)**2;return sum;};assert.ok(variance(low)>variance(high)*3);
 assert.equal(fpsAbilityUnit(profile({utility:10}),'stamina'),.5);assert.equal(fpsAbilityUnit(profile({utility:1}),'stamina'),.5);
});
test('utility improves throw execution; capability does not alter personality or physical flight rules',()=>{
 const low=detailedThrowPoint(profile({utility:1}),{x:0,z:0},{x:20,z:10},()=>.5),high=detailedThrowPoint(profile({utility:10}),{x:0,z:0},{x:20,z:10},()=>.5);
 assert.ok(Math.hypot(high.x-20,high.z-10)<Math.hypot(low.x-20,low.z-10));
 assert.deepEqual(tickFpsMentalState(profile({rifling:1}),{setback:.5,attentionDebt:.2,exertion:.2},1,3,true,0),tickFpsMentalState(profile({rifling:10}),{setback:.5,attentionDebt:.2,exertion:.2},1,3,true,0));
});
test('25-rating files have an explicit import conversion and cannot enter the engine directly',()=>{
 const values=Object.fromEntries(['precision','tracking','recoilControl','flicking','crosshairPlacement','peeking','movementControl','reactions','utilityExecution','positioning','awareness','informationReading','calling','communication','decisionMaking'].map(k=>[k,6]));
 const old={...profile(),version:1,source:'lab-custom-v1',values};assert.throws(()=>validateFpsSkillProfile(old));const migrated=migrateFpsSkillProfile(old,'test');assert.equal(migrated.source,'migrated-25-v1');assert.equal(Object.keys(migrated.values).length,6);assert.deepEqual(migrateFpsSkillProfile(migrated,'test'),migrated);
});
