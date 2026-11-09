import test from 'node:test';import assert from 'node:assert/strict';
import {loadIntelligencePolicy,intelligenceObservation,policyLogits,chooseIntelligenceAction,transitionReward,potential} from './intelligencePolicy.ts';
const policy={kind:'macro-program',version:1,weights:Array.from({length:5},()=>Array(20).fill(0)),bias:[0,1,2,3,4]};
test('portable policy schemas reject mechanical knobs, dimensions and nonfinite weights',()=>{
 assert.ok(loadIntelligencePolicy(policy));assert.equal(loadIntelligencePolicy({...policy,damage:99}),undefined);
 assert.equal(loadIntelligencePolicy({...policy,bias:[1]}),undefined);
 assert.equal(loadIntelligencePolicy({...policy,bias:[0,0,0,0,Infinity]}),undefined);
 const loaded=loadIntelligencePolicy(policy);loaded.bias[0]=9;assert.equal(policy.bias[0],0);
});
test('actor uses explicit own/visible observations and masks every unavailable action',()=>{
 const own={hp:.8,mana:.5,x:200,y:300,level:9,iq:75,aggression:40,discipline:60,gold:1000,cooldowns:[5,1,20],role:'Tank'};
 const context={threat:.2,survival:.8,second:120,allies:3};
 const a=intelligenceObservation(own,[{x:300,y:300,hp:.4,level:10}],context);
 const b=intelligenceObservation({...own,opponentGold:999999},[{x:300,y:300,hp:.4,level:10,privateGold:99999}],context);
 assert.equal(a.length,20);assert.deepEqual(a,b);assert.deepEqual(policyLogits(policy,a),[0,1,2,3,4]);
 assert.equal(chooseIntelligenceAction(policy,a,['fight','wave']).action,'wave');
 for(const draw of [0,.1,.9,.999])assert.ok(['fight','wave'].includes(chooseIntelligenceAction(policy,a,['fight','wave'],draw).action));
});
test('potential reward telescopes to terminal outcome without rewarding endless farming',()=>{
 const start={second:0,ownDeaths:0,enemyDeaths:0,ownStructureHp:10000,enemyStructureHp:10000,ownEconomy:0,enemyEconomy:0,ownHealth:5,enemyHealth:5,dragonBalance:0,siegeBalance:0};
 const middle={...start,second:30,ownEconomy:5000},end={...middle,second:60};
 const a=transitionReward(start,middle,false),b=transitionReward(middle,end,true,false);
 assert.ok(Math.abs(a.reward+a.discount*b.reward+a.discount*b.discount+potential(start))<1e-12);
 assert.equal(b.components.outcome,-b.discount);
});
