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
