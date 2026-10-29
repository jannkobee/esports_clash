import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {ARENA_OUTCOME_REWARD as config,ARENA_OUTCOME_REWARD_VERSION,arenaOutcomeReward,arenaOutcomeCriticState,
 arenaOutcomePotential,arenaStructureLoss} from './arenaOutcomeReward.ts';
import {ArenaTrajectory} from './arenaTrajectory.ts';
const snapshot=(second=0)=>({second,ownDeaths:0,enemyDeaths:0,ownStructureHp:10000,enemyStructureHp:10000,
 ownEconomy:0,enemyEconomy:0,ownHealth:5,enemyHealth:5,dragonBalance:0,siegeBalance:0,ownNexusAlive:true,enemyNexusAlive:true,
 outcomes:{ownStructureLoss:0,enemyStructureLoss:0,ownMana:5,enemyMana:5,dragonSecures:0,siegeSecures:0}});

test('rewards reflect actual team progress, losses and spent resources without a movement or cast bonus',()=>{
 const start=snapshot(),cases=[
  ['structures',s=>s.outcomes.enemyStructureLoss=.1,1],['structures',s=>s.outcomes.ownStructureLoss=.1,-1],
  ['economy',s=>s.ownEconomy=500,1],['trades',s=>s.enemyDeaths=1,1],['trades',s=>s.ownDeaths=1,-1],
  ['health',s=>s.ownHealth=4,-1],['mana',s=>s.outcomes.ownMana=4,-1],
  ['dragon',s=>s.outcomes.dragonSecures=1,1],['siege',s=>s.outcomes.siegeSecures=1,1]];
 for(const [key,change,sign] of cases){const end=snapshot(1);change(end);const r=arenaOutcomeReward(start,end,false);
  assert.ok(sign*r.components[key]>0,key);assert.equal(r.components.outcome,0);
  assert.ok(Math.abs(r.reward-r.components.shaping)<1e-12);
 }
 const unchanged=arenaOutcomeReward(start,{...start,second:1,command:'move',targetId:'protected-nexus',distance:99999,casts:1000,damageTaken:99999},false);
 assert.equal(unchanged.reward,0);assert.equal(unchanged.components.outcome,0);
});
test('structure progress counts real capped fractional damage across the full objective chain',()=>{
 const roster=['outer_tower','inner_tower','nexus_tower','barracks','barracks','barracks','nexus'].map(type=>({type,hp:1000,maxHp:1000,isAlive:true}));
 assert.equal(arenaStructureLoss(roster),0);roster[0].hp=500;const partial=arenaStructureLoss(roster);assert.ok(partial>0);
 roster[0].hp=-900;const complete=arenaStructureLoss(roster);roster[0].hp=0;assert.equal(arenaStructureLoss(roster),complete);
 assert.ok(Math.abs(complete-2*partial)<1e-12);
 roster.forEach(s=>{s.hp=0;s.isAlive=false;});assert.equal(arenaStructureLoss(roster),1);
 // Damage to a later structure continues contributing: raw-HP saturation no longer hides it.
 const before=arenaStructureLoss(roster);roster[6].hp=500;roster[6].isAlive=true;assert.ok(arenaStructureLoss(roster)<before);
 assert.throws(()=>arenaStructureLoss([{...roster[0],maxHp:NaN}]),/Invalid/);
});
test('team rewards are symmetric and objective captures remain credited after the siege unit is consumed',()=>{
 const a=snapshot(30);a.ownEconomy=1000;a.enemyDeaths=1;a.outcomes.enemyStructureLoss=.2;a.outcomes.siegeSecures=1;
 const b={...a,ownEconomy:a.enemyEconomy,enemyEconomy:a.ownEconomy,ownDeaths:a.enemyDeaths,enemyDeaths:a.ownDeaths,
  ownHealth:a.enemyHealth,enemyHealth:a.ownHealth,outcomes:{...a.outcomes,ownStructureLoss:.2,enemyStructureLoss:0,siegeSecures:-1}};
 assert.ok(Math.abs(arenaOutcomePotential(a)+arenaOutcomePotential(b))<1e-12);
 assert.deepEqual(arenaOutcomeCriticState(a),arenaOutcomeCriticState({...a,siegeBalance:0}));
 assert.ok(Math.abs(Object.values(config.potential_weights).reduce((a,b)=>a+b,0)-1)<1e-12);
});
test('full returns telescope through farming, damage/healing and mana recovery cycles to the actual win/loss',()=>{
 const start=snapshot(),states=[start,snapshot(10),snapshot(20),snapshot(30),snapshot(40)];
 states[1].outcomes.enemyStructureLoss=.2;states[1].ownHealth=3;states[1].outcomes.ownMana=2;
 states[2].ownEconomy=2000;states[3].outcomes.ownStructureLoss=.4;
 for(const winner of [true,false]){let total=0,discount=1;
  for(let i=1;i<states.length;i++){
   const r=arenaOutcomeReward(states[i-1],states[i],i===states.length-1,winner);
   total+=discount*r.reward;discount*=r.discount;
  }
  assert.ok(Math.abs(total-(discount*(winner?5:-5)-arenaOutcomePotential(start)))<1e-12);
 }
 const improved={...snapshot(10),ownEconomy:1000};const a=arenaOutcomeReward(start,improved,false),b=arenaOutcomeReward(improved,snapshot(20),false);
 assert.ok(Math.abs(a.reward+a.discount*b.reward)<1e-12);
 assert.ok(config.gamma_second**1200>.78);assert.ok(.999**1200<.31);
 assert.throws(()=>arenaOutcomeReward(start,snapshot(-1),false),/Invalid/);
 assert.throws(()=>arenaOutcomeReward(start,snapshot(),true),/Invalid/);
 assert.throws(()=>arenaOutcomeCriticState({...start,outcomes:undefined}),/Missing/);
});
test('the current reward collector emits seven critic outcomes and preserves exact winning-tick terminal credit',()=>{
 const trajectory=new ArenaTrajectory({blue:{version:3}},true,ARENA_OUTCOME_REWARD_VERSION),start=snapshot(100);
 trajectory.pending.set('actor',{actor:'actor',team:'blue',second:100,candidates:[Array(224).fill(0)],action:0,logp:0,
  state:trajectory.critic(start,'blue'),start,command:'attack',executed:true});
 trajectory.settle('actor',{...start,enemyNexusAlive:false},true,true);
 const [row]=trajectory.drain().rows;assert.equal(row.elapsed,0);assert.equal(row.components.outcome,5);assert.equal(row.components.mastery,0);
 assert.equal(row.rewardVersion,ARENA_OUTCOME_REWARD_VERSION);assert.equal(row.nextState.length,7);
 const legacy=new ArenaTrajectory({blue:{version:1}},true,ARENA_OUTCOME_REWARD_VERSION);assert.equal(legacy.critic(start,'blue').length,6);
});
test('reward revision preserves starting weights and the prior frozen factual reference',()=>{
 const old=readFileSync(new URL('./data/arena-v5/arenaFoundation.json',import.meta.url));
 const current=readFileSync(new URL('./data/arena-v6/arenaFoundation.json',import.meta.url));assert.deepEqual(old,current);
 const book=JSON.parse(readFileSync(new URL('./data/arenaPlaybookV6.json',import.meta.url)));
 assert.equal(book.rewards.version,ARENA_OUTCOME_REWARD_VERSION);assert.equal(book.knowledge_only,true);
});
