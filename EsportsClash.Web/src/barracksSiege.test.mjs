import test from 'node:test';
import assert from 'node:assert/strict';
import {chooseBarracksSiegeTarget,barracksApproachPoint,approachPoint} from './barracksSiege.ts';
import {canBasicAttackStructure} from './basicAttackRangeRules.ts';
import {canDamageNexus} from './structureProtection.ts';
import {CHAMPIONS} from './mockData.ts';
import {contentChampion} from './gameContent.ts';
import {v3Champion} from './v3Catalog.ts';
import {HERO_IDENTITIES_V3} from './heroIdentityV3.ts';

for(const team of ['blue','red'])test(`${team} sieges top and bottom barracks with legal movement before exposing Nexus`,()=>{
  const enemy=team==='blue'?'red':'blue',x=enemy==='red'?2270:330;
  const buildings=['melee','ranged','catapult'].map((kind,i)=>({id:kind,team:enemy,type:'barracks',isAlive:kind!=='ranged',x:kind==='ranged'?x+(team==='blue'?-60:60):x,y:[140,380,620][i],range:0,hp:100,maxHp:100}));
  buildings.push({id:'nexus',team:enemy,type:'nexus',isAlive:true,x:x+(team==='blue'?95:-95),y:380,range:225});
  const actor={x:x+(team==='blue'?-150:150),y:380,team,attackRange:50};
  for(let siege=0;siege<2;siege++){
    const target=chooseBarracksSiegeTarget(actor,buildings);assert.ok(target);
    for(let i=0;i<600&&!canBasicAttackStructure(actor,target);i++)Object.assign(actor,approachPoint(actor,barracksApproachPoint(actor,target,actor.attackRange),70,1/30));
    assert.ok(canBasicAttackStructure(actor,target));assert.equal(canDamageNexus(enemy,buildings),false);
    target.isAlive=false;
  }
  assert.equal(canDamageNexus(enemy,buildings),true);
  buildings.push({id:'tower',team:enemy,type:'nexus_tower',isAlive:true,x,y:380});
  buildings[0].isAlive=true;assert.equal(chooseBarracksSiegeTarget(actor,buildings),undefined);
});

test('playable catalog contains original kits only, preserving IDs, signature aliases and owned-card compatibility',()=>{
  assert.equal(CHAMPIONS.length,45);
  for(const identity of HERO_IDENTITIES_V3){const kit=CHAMPIONS.find(c=>c.id===identity.key);assert.ok(kit);
    assert.equal(kit.name,identity.internalName);assert.equal(kit.displayName,identity.displayName);assert.equal(kit.abilityRuleset,'original-v3-preview-2');
    assert.equal(v3Champion(v3Champion(kit)).legacyInternalName,identity.internalName);
    const stale={schema:1,hash:'a'.repeat(64),records:[{id:kit.id+':skill1',kind:'skill',version:1,builtin:true,deleted:false,data:{avatarId:kit.id,slot:'skill1',name:'Old copied kit',desc:'old',damage:999,cooldown:1}}]};
    assert.equal(contentChampion(kit,stale).skill1.name,kit.skill1.name);
  }
  assert.equal(CHAMPIONS.find(c=>c.id==='c_invoker').skill1.name,'Pin the Hem');
});
