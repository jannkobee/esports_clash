import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {CHAMPIONS,INITIAL_PLAYERS} from './mockData.ts';
import {arenaIdentity,arenaKitFacts} from './arenaIdentity.ts';
import {arenaCommands,loadArenaActor,arenaScores} from './arenaLearning.ts';
import {ArenaTrajectory} from './arenaTrajectory.ts';
const model=JSON.parse(readFileSync(new URL('./data/arena-v5/arenaFoundation.json',import.meta.url)));
const book=JSON.parse(readFileSync(new URL('./data/arenaPlaybookV5.json',import.meta.url)));
const context=kit=>({own:{id:'actor',x:400,y:350,hp:.8,mana:.8,level:6,iq:80,lan:80,tf:80,sta:80,role:1,
 identity:arenaIdentity(kit,INITIAL_PLAYERS[0],[0,1,2]),attackReady:true,attackRange:200,ad:100,recalling:false,recallReady:true,wardReady:false,kaelen:false,
 skills:[{slot:'skill1',ready:true,range:300,mana:.2,damage:100}]},direction:1,second:90,
 targets:[{id:'enemy',avatarId:kit.id,kit:arenaKitFacts(kit),role:1,attackRange:150,controlled:0,x:500,y:350,hp:1000,maxHp:1000,kind:'champion'}],
 structures:[],home:{x:100,y:350},width:2600,ownNexus:1,enemyNexus:1,projectiles:[]});
test('the current policy uses transferable facts for every kit, including a new unregistered avatar',()=>{
 for(const kit of CHAMPIONS){const facts=arenaKitFacts(kit);assert.equal(facts.length,45);assert.ok(facts.every(Number.isFinite));}
 const original=CHAMPIONS[0],newAvatar={...original,id:'new-avatar-without-a-guide',displayName:'New fictional avatar'};
 assert.deepEqual(arenaKitFacts(original),arenaKitFacts(newAvatar));
 const a=arenaCommands(context(original),224,3),b=arenaCommands(context(newAvatar),224,3);
 assert.deepEqual(a,b);assert.equal(a[0].features[92],1);assert.equal(a.find(c=>c.targetId==='enemy').features[137],1);
 const changed={...newAvatar,skill1:{...newAvatar.skill1,damage:newAvatar.skill1.damage+50}};
 assert.notDeepEqual(arenaKitFacts(newAvatar),arenaKitFacts(changed));
 assert.notDeepEqual(arenaCommands(context(newAvatar),224,3),arenaCommands(context(changed),224,3));
});
test('the factual foundation has no avatar-strategy teacher or fixed per-avatar reward weights',()=>{
 const actor=loadArenaActor(model);assert.equal(actor.version,3);assert.equal(book.knowledge_only,true);
 assert.equal(book.rewards.version,'terminal-potential-v1');assert.ok(book.avatars.every(a=>!a.directions&&!a.mastery_weights));
 assert.ok(actor.w1.every(row=>row.slice(48).every(v=>v===0)));
 // Extra facts start neutral; the learner, not the initialization adapter,
 // decides how those features affect scores in subsequent self-play.
 const a=arenaCommands(context(CHAMPIONS[0]),224,3),b=arenaCommands(context(CHAMPIONS[1]),224,3);
 assert.deepEqual(arenaScores(actor,a),arenaScores(actor,b));
 assert.equal(loadArenaActor({...actor,input:48}),undefined);
});
test('current factual actors receive only the common team reward, without personal mastery shaping',()=>{
 const start={second:100,ownDeaths:0,enemyDeaths:0,ownStructureHp:10000,enemyStructureHp:10000,
 ownEconomy:0,enemyEconomy:0,ownHealth:5,enemyHealth:5,dragonBalance:0,siegeBalance:0,ownNexusAlive:true,enemyNexusAlive:true};
 const trajectory=new ArenaTrajectory({},true);
 trajectory.pending.set('a',{actor:'a',team:'blue',second:100,candidates:[Array(224).fill(0)],action:0,logp:0,state:Array(6).fill(0),start,
   command:'attack',executed:true,identity:{avatarId:'new-kit',cardId:'test',cardName:'Fictional'}});
 trajectory.settle('a',{...start,second:101},false,undefined,.08);
 const [row]=trajectory.drain().rows;assert.equal(row.components.mastery,0);assert.equal(row.nextState.length,6);
 assert.equal(row.masteryPotential,undefined);assert.equal(row.identity.avatarId,'new-kit');
});
