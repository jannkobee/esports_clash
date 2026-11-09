import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {arenaCommands,loadArenaActor,chooseArenaCommand} from './arenaLearning.ts';
const model=JSON.parse(readFileSync(new URL('./data/arena-v3/arenaFoundation.json',import.meta.url)));
const situation=()=>({own:{id:'a',x:400,y:350,hp:.05,mana:.1,level:6,iq:80,lan:80,tf:80,sta:80,role:4,
  attackReady:true,attackRange:200,ad:100,recalling:false,recallReady:true,wardReady:true,kaelen:false,
  skills:[{slot:'skill1',ready:false,range:300,mana:.2,damage:100}]},direction:1,second:90,
  targets:[{id:'e',x:500,y:350,hp:1000,maxHp:1000,kind:'champion'},
    {id:'hidden',x:2000,y:350,hp:1000,maxHp:1000,kind:'champion'}],
  structures:[{x:500,y:350,range:300,enemy:true,alive:true}],home:{x:100,y:350},width:2600,
  ownNexus:1,enemyNexus:1,projectiles:[]});
test('learned legal commands permit dangerous fights and tower entry without strategic vetoes',()=>{
  const commands=arenaCommands(situation());
  assert.ok(commands.some(c=>c.kind==='attack'&&c.targetId==='e'));
  assert.ok(commands.some(c=>c.kind==='move'&&c.targetId==='e'));
  assert.ok(commands.some(c=>c.kind==='recall'));
  assert.ok(!commands.some(c=>c.kind==='skill1'));
  assert.ok(!commands.some(c=>c.kind==='attack'&&c.targetId==='hidden'));
  assert.ok(commands.every(c=>c.features.length===48&&c.features.every(Number.isFinite)));
});
test('recall can be continued or cancelled by a learned movement choice',()=>{
  const s=situation();s.own.recalling=true;const commands=arenaCommands(s);
  assert.ok(commands.some(c=>c.kind==='hold'));assert.ok(commands.some(c=>c.kind==='move'));
  assert.ok(!commands.some(c=>['attack','ward','skill1','recall'].includes(c.kind)));
});
test('Nexus invulnerability is mechanical; walking toward it remains a learned choice',()=>{
  const s=situation();s.targets=[{id:'nexus',x:500,y:350,hp:1000,maxHp:1000,kind:'structure',nexus:true,attackable:false}];
  let commands=arenaCommands(s);assert.ok(commands.some(c=>c.kind==='move'&&c.targetId==='nexus'));
  assert.ok(!commands.some(c=>c.kind==='attack'));s.targets[0].attackable=true;
  commands=arenaCommands(s);assert.ok(commands.some(c=>c.kind==='attack'&&c.targetId==='nexus'));
});
test('orb elements and invoked spells have distinguishable model inputs',()=>{
  const s=situation();s.own.kaelen=true;s.own.orbReady=true;s.own.orbs=['ice','wind'];
  s.own.invoked=[{index:0,identity:1,ready:true,range:500,ally:false},{index:1,identity:2,ready:true,range:500,ally:false}];
  const commands=arenaCommands(s),orbs=commands.filter(c=>c.kind==='orb'),spells=commands.filter(c=>c.invokedIndex!==undefined);
  assert.equal(new Set(orbs.map(c=>JSON.stringify(c.features))).size,3);
  assert.equal(new Set(spells.map(c=>JSON.stringify(c.features))).size,spells.length);
});
test('the instructional foundation can finish a recall while retaining cancellation commands',()=>{
  const s=situation();s.own.recalling=true;s.targets=[];s.structures=[];
  assert.equal(chooseArenaCommand(loadArenaActor(model),arenaCommands(s)).command.kind,'hold');
});
test('a trained foundation has deterministic greedy inference and normalized on-policy sampling',()=>{
  const actor=loadArenaActor(model);assert.ok(actor);const commands=arenaCommands(situation());
  assert.deepEqual(chooseArenaCommand(actor,commands),chooseArenaCommand(actor,commands));
  let sum=0;for(let i=0;i<commands.length;i++){
    const forced={...actor,w1:Array.from({length:32},()=>Array(48).fill(0)),b1:Array(32).fill(0),w2:Array(32).fill(0),b2:0};
    const choice=chooseArenaCommand(forced,commands,(i+.5)/commands.length);
    assert.equal(choice.index,i);sum+=Math.exp(choice.logp);
  }assert.ok(Math.abs(sum-1)<1e-10);
  assert.equal(loadArenaActor({...actor,hidden:16}),undefined);
  assert.equal(loadArenaActor({...actor,b2:NaN}),undefined);
  assert.equal(loadArenaActor({...actor,extra:'heuristic'}),undefined);
});
