import test from 'node:test';
import assert from 'node:assert/strict';
import {ArenaTrajectory} from './arenaTrajectory.ts';
const snapshot=()=>({second:100,ownDeaths:0,enemyDeaths:0,ownStructureHp:10000,enemyStructureHp:10000,
  ownEconomy:0,enemyEconomy:0,ownHealth:5,enemyHealth:5,dragonBalance:0,siegeBalance:0,ownNexusAlive:true,enemyNexusAlive:true});
test('a decision on the winning tick retains an exact zero-duration terminal reward',()=>{
  const a=new ArenaTrajectory({},true),start=snapshot();
  a.pending.set('a',{actor:'a',team:'blue',second:100,candidates:[Array(48).fill(0)],action:0,logp:0,state:Array(6).fill(0),
    start,command:'attack',executed:true});
  a.settle('a',{...start,enemyNexusAlive:false},true,true);
  const {rows}=a.drain();assert.equal(rows.length,1);assert.equal(rows[0].elapsed,0);
  assert.equal(rows[0].terminal,true);assert.equal(rows[0].components.outcome,1);assert.equal(rows[0].discount,1);
});
test('empty nonterminal intervals are omitted and earlier clocks cannot fabricate terminal time',()=>{
  for(const [second,terminal] of [[100,false],[99,true]]){
    const a=new ArenaTrajectory({},true),start=snapshot();
    a.pending.set('a',{actor:'a',team:'blue',second:100,candidates:[Array(48).fill(0)],action:0,logp:0,state:Array(6).fill(0),start,command:'hold',executed:true});
    a.settle('a',{...start,second},terminal,true);assert.equal(a.drain().rows.length,0);
  }
});
