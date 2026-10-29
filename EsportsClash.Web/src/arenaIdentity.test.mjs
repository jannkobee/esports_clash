import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {CHAMPIONS} from './testFixtures/historicalCatalog.mjs';
import {INITIAL_PLAYERS} from './mockData.ts';
import {arenaIdentity,arenaAvatarLesson,ARENA_AVATAR_IDS,ArenaMasteryLedger,arenaMasteryPotential} from './arenaIdentity.ts';
import {arenaCommands,loadArenaActor,arenaScores} from './arenaLearning.ts';
import {ArenaTrajectory} from './arenaTrajectory.ts';
const book=JSON.parse(readFileSync(new URL('./data/arenaPlaybookV4.json',import.meta.url)));
const model=JSON.parse(readFileSync(new URL('./data/arena-v4/arenaFoundation.json',import.meta.url)));
const snapshot=second=>({second,ownDeaths:0,enemyDeaths:0,ownStructureHp:10000,enemyStructureHp:10000,
 ownEconomy:0,enemyEconomy:0,ownHealth:5,enemyHealth:5,dragonBalance:0,siegeBalance:0,ownNexusAlive:true,enemyNexusAlive:true});
const situation=(avatar,player=INITIAL_PLAYERS[0])=>({own:{id:'a',x:400,y:350,hp:.8,mana:.8,level:6,iq:80,lan:80,tf:80,sta:80,role:1,
 identity:arenaIdentity(avatar,player,[0,0,0]),attackReady:true,attackRange:200,ad:100,recalling:false,recallReady:true,wardReady:true,kaelen:false,
 skills:[{slot:'ultimate',ready:true,range:300,mana:.2,damage:100}]},direction:1,second:90,
 targets:[{id:'e',avatarId:CHAMPIONS[0].id,role:1,attackRange:150,controlled:0,x:500,y:350,hp:1000,maxHp:1000,kind:'champion'}],
 structures:[],home:{x:100,y:350},width:2600,ownNexus:1,enemyNexus:1,projectiles:[]});

test('historical fixture: every real avatar has an individual curriculum with exact catalog abilities and stable identities',()=>{
 assert.equal(book.avatars.length,45);assert.equal(new Set(ARENA_AVATAR_IDS).size,45);assert.equal(book.roles.length,6);
 for(const c of CHAMPIONS){const lesson=arenaAvatarLesson(c.id);assert.ok(lesson,c.id);assert.equal(lesson.name,c.displayName);
   assert.equal(lesson.role,c.primaryRole);assert.ok(lesson.directions[0].length>70);assert.ok(lesson.tradeoff.length>35);
   for(const a of lesson.abilities){assert.equal(a.name,c[a.slot].name);assert.equal(a.description,c[a.slot].desc);}
   assert.ok(Math.abs(Object.values(lesson.mastery_weights).reduce((a,b)=>a+b,0)-1)<1e-9);
 }
 const tanks=book.avatars.filter(a=>a.role==='Tank');assert.equal(new Set(tanks.map(t=>t.job)).size,tanks.length);
 assert.equal(new Set(tanks.map(t=>JSON.stringify(t.mastery_weights))).size,tanks.length);
});
test('historical fixture: identity observation sees card and avatar changes without changing legal commands or base combat features',()=>{
 const c=CHAMPIONS[0],p=INITIAL_PLAYERS[0],s=situation(c,p),before=structuredClone(s);
 const commands=arenaCommands(s,224),legacy=arenaCommands(s);
 assert.deepEqual(s,before);assert.deepEqual(commands.map(c=>c.id),legacy.map(c=>c.id));
 assert.ok(commands.every((c,i)=>c.features.length===224&&c.features.every(Number.isFinite)&&JSON.stringify(c.features.slice(0,48))===JSON.stringify(legacy[i].features)));
 const other=arenaCommands(situation(CHAMPIONS.find(a=>a.name==='Stonewake'),p),224);
 assert.notDeepEqual(commands[0].features,other[0].features);
 const card=arenaCommands(situation(c,{...p,id:'another-card',primaryPersonality:'bodyguard',stats:{...p.stats,clu:1}}),224);
 assert.notDeepEqual(commands[0].features,card[0].features);
 assert.deepEqual(arenaIdentity(c,p,[0,0,0]).values,arenaIdentity(c,{...p,name:'Cosmetic alias',realName:'Private value'},[0,0,0]).values);
 assert.equal(arenaCommands({...s,targets:[]},224)[0].features.slice(93,138).reduce((a,b)=>a+b,0),0);
});
test('historical fixture: the fitted identity actor accepts only its matching schema and uses identity in actual scores',()=>{
 const actor=loadArenaActor(model);assert.ok(actor);assert.equal(actor.version,2);
 const a=arenaCommands(situation(CHAMPIONS[0]),224),b=arenaCommands(situation(CHAMPIONS.find(c=>c.name==='Stonewake')),224);
 assert.notDeepEqual(arenaScores(actor,a),arenaScores(actor,b));
 assert.throws(()=>arenaScores(actor,arenaCommands(situation(CHAMPIONS[0]))),/version mismatch/);
 assert.equal(loadArenaActor({...actor,version:1}),undefined);assert.equal(loadArenaActor({...actor,input:48}),undefined);
});
test('historical fixture: mastery credits actual health damage and only active allied follow-up, never a cast or self follow-up',()=>{
 const l=new ArenaMasteryLedger();l.control('tank','blue','enemy',10,1.5);
 l.hit('tank','blue','enemy',100,10.1);assert.equal(l.followup.size,0);
 l.hit('carry','blue','enemy',150,10.2);assert.equal(l.followup.get('tank'),150);
 l.hit('other','red','enemy',200,10.3);l.hit('carry','blue','enemy',300,11.5);l.hit('carry','blue','enemy',0,10.5);
 assert.equal(l.followup.get('tank'),150);assert.equal(l.damage.get('carry'),450);
 l.control('other-tank','blue','enemy',12,1);l.hit('carry','blue','enemy',50,12.2);
 assert.equal(l.followup.get('tank'),150);assert.equal(l.followup.get('other-tank'),50);
 l.hit('carry','blue','enemy',50,12.3,false);assert.equal(l.followup.get('other-tank'),50);
 l.objective('tank',900,20);l.objective('tank',900,0);l.objective('tank',NaN,100);
 assert.equal(l.objectives.get('tank'),20);
});
test('historical fixture: avatar mastery shaping is bounded, closes at real termination and cannot farm a state loop',()=>{
 const id=CHAMPIONS[0].id,phi=arenaMasteryPotential(id,{damage:1e8,control:1e8,objectives:1e8,allies:4});assert.ok(Math.abs(phi-.08)<1e-9);
 assert.equal(arenaMasteryPotential('unknown',{damage:100,control:100,objectives:100,allies:4}),0);
 const a=new ArenaTrajectory({},true),start=snapshot(100),p=.03;
 const pending=(second,value)=>({actor:'a',team:'blue',second,candidates:[Array(224).fill(0)],action:0,logp:0,state:[...Array(6).fill(0),value/.08],
   start:snapshot(second),command:'hold',executed:true,masteryPotential:value});
 a.pending.set('a',pending(100,p));a.settle('a',snapshot(101),false,undefined,.05);
 a.pending.set('a',pending(101,.05));a.settle('a',snapshot(102),false,undefined,p);
 let rows=a.drain().rows;assert.ok(rows[0].components.mastery+.999*rows[1].components.mastery<=0);
 a.pending.set('a',pending(102,p));a.settle('a',{...start,second:102,enemyNexusAlive:false},true,true,.08);
 rows=a.drain().rows;assert.equal(rows[0].components.mastery,-p);assert.equal(rows[0].components.outcome,1);assert.equal(rows[0].nextState[6],0);
});
