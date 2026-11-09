import test from 'node:test';
import assert from 'node:assert/strict';
import {canDamageStructure,canDamageNexus,structureProtectionReason} from './structureProtection.ts';
const base=team=>['outer_tower','inner_tower','nexus_tower','barracks','barracks','barracks','nexus']
  .map((type,i)=>({id:`${team}:${i}`,team,type,isAlive:true}));
test('each defending base unlocks in order, with all three barracks required',()=>{
  for(const team of ['blue','red']){
    const own=base(team),other=base(team==='blue'?'red':'blue'),all=[...own,...other];
    for(let stage=0;stage<3;stage++){
      assert.equal(canDamageStructure(own[stage],all),true);
      for(const target of own.slice(stage+1))assert.equal(canDamageStructure(target,all),false);
      own[stage].isAlive=false;
    }
    for(const target of own.slice(3,6))assert.equal(canDamageStructure(target,all),true);
    assert.equal(canDamageNexus(team,all),false);own[3].isAlive=false;
    assert.equal(canDamageNexus(team,all),false);own[4].isAlive=false;
    assert.equal(canDamageNexus(team,all),false);assert.equal(structureProtectionReason(own[6],all),'1 barracks remaining');
    own[5].isAlive=false;assert.equal(canDamageNexus(team,all),true);
    assert.equal(canDamageStructure(own[6],all),true);
    assert.equal(canDamageStructure(other[1],all),false); // Opposing base progress is independent.
  }
});
test('a missing barracks roster does not silently expose the Nexus',()=>{
  const own=base('red');own.forEach(s=>{if(s.type!=='nexus')s.isAlive=false;});
  assert.equal(canDamageNexus('red',own.filter(s=>s.type!=='barracks')),false);
  own[1].isAlive=true;assert.equal(canDamageNexus('red',own),false);
  assert.equal(structureProtectionReason(own[6],own),'Inner turret first');
});
test('two-lane layout: single-lane breach unlocks barracks and nexus finishing while preserving all three barracks invariant',()=>{
  const makeTwoLaneBase = (team) => [
    { id: `${team}_top_outer`, team, lane: 'top', type: 'outer_tower', isAlive: true },
    { id: `${team}_top_inner`, team, lane: 'top', type: 'inner_tower', isAlive: true },
    { id: `${team}_top_base`, team, lane: 'top', type: 'nexus_tower', isAlive: true },
    { id: `${team}_bot_outer`, team, lane: 'bot', type: 'outer_tower', isAlive: true },
    { id: `${team}_bot_inner`, team, lane: 'bot', type: 'inner_tower', isAlive: true },
    { id: `${team}_bot_base`, team, lane: 'bot', type: 'nexus_tower', isAlive: true },
    { id: `${team}_barracks_melee`, team, type: 'barracks', isAlive: true },
    { id: `${team}_barracks_ranged`, team, type: 'barracks', isAlive: true },
    { id: `${team}_barracks_catapult`, team, type: 'barracks', isAlive: true },
    { id: `${team}_nexus`, team, type: 'nexus', isAlive: true },
  ];
  const blue = makeTwoLaneBase('blue');
  // At start: outer towers can be damaged, inners cannot
  assert.equal(canDamageStructure(blue[0], blue), true);
  assert.equal(canDamageStructure(blue[3], blue), true);
  assert.equal(canDamageStructure(blue[1], blue), false);
  assert.equal(canDamageStructure(blue[4], blue), false);
  assert.equal(canDamageStructure(blue[6], blue), false);

  // Destroy top outer -> top inner unlocks, bot inner still locked
  blue[0].isAlive = false;
  assert.equal(canDamageStructure(blue[1], blue), true);
  assert.equal(canDamageStructure(blue[4], blue), false);

  // Destroy top inner -> top base unlocks
  blue[1].isAlive = false;
  assert.equal(canDamageStructure(blue[2], blue), true);
  assert.equal(canDamageStructure(blue[6], blue), false);

  // Destroy top base -> single-lane breach! Barracks unlock even though bot lane is pristine
  blue[2].isAlive = false;
  assert.equal(canDamageStructure(blue[6], blue), true);
  assert.equal(canDamageStructure(blue[7], blue), true);
  assert.equal(canDamageStructure(blue[8], blue), true);
  assert.equal(canDamageNexus('blue', blue), false);

  // Nexus locked until all 3 barracks fall
  blue[6].isAlive = false;
  assert.equal(canDamageNexus('blue', blue), false);
  blue[7].isAlive = false;
  assert.equal(canDamageNexus('blue', blue), false);
  blue[8].isAlive = false;
  assert.equal(canDamageNexus('blue', blue), true);
  assert.equal(canDamageStructure(blue[9], blue), true);
});
