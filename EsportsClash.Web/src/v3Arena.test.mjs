import test from 'node:test';
import assert from 'node:assert/strict';
import {CHAMPIONS} from './testFixtures/historicalCatalog.mjs';
import {v3Champion,v3ArenaEnvironment,assertLegacyAbility} from './v3Arena.ts';
import {createV3World} from './v3Combat.ts';
const actor=(id,key,team)=>({id,team,champion:v3Champion(CHAMPIONS.find(c=>c.id===key)),x:1200,y:380,hp:1000,maxHp:1000,mana:300,level:10,shield:100,isAlive:true,stunTimer:0,zhonyaActive:false});
test('V3 preview binds all 45 kits while preserving saved keys, base stats and explicit legacy aliases',()=>{
 for(const key of CHAMPIONS.map(c=>c.id)){const old=CHAMPIONS.find(c=>c.id===key),copy=v3Champion(old);
  assert.equal(copy.id,old.id);assert.equal(copy.legacyInternalName,old.name);assert.notEqual(copy.name,old.name);assert.equal(copy.hp,old.hp);assert.equal(copy.ad,old.ad);assert.equal(copy.abilityRuleset,'original-v3-preview-2');assert.notEqual(copy.skill1.name,old.skill1.name);
 }
 // No pending hero falls through to the old runtime in this version.
});
test('live adapter preserves intervening real damage/mana/movement and synchronizes only kernel changes',()=>{
 const a=actor('a','c_puck','blue'),b=actor('b','c_invoker','red');
 const bridge=v3ArenaEnvironment([a,b],()=>true,(_,target,n)=>{target.hp-=n;target.shield=20;});
 const [viewA,viewB]=bridge.environment.units;viewA.mana-=30;a.mana+=2;b.x+=10;
 bridge.environment.damage(viewA,viewB,100,'skill1');bridge.sync(createV3World());
 assert.equal(a.mana,272);assert.equal(b.hp,900);assert.equal(b.shield,20);assert.equal(b.x,1210);
 bridge.sync(createV3World());assert.equal(a.mana,272,'sync must not double-spend');
});
test('original units cannot enter retained orb, teleport and other legacy signature handlers',()=>{
 for(const key of CHAMPIONS.map(c=>c.id))assert.throws(()=>assertLegacyAbility(actor('a',key,'blue')),/cannot dispatch legacy/);
 assert.doesNotThrow(()=>assertLegacyAbility({champion:CHAMPIONS[0]}));
});
