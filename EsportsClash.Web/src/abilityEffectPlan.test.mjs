import test from 'node:test';
import assert from 'node:assert/strict';
import {buildAbilityEffectPlan,abilityEffectPalette} from './match-viewer/abilityEffectPlan.ts';
import {captureViewerSnapshot} from './match-viewer/MatchViewer.ts';
import {ViewerReplay} from './match-viewer/ViewerReplay.ts';

const base={tick:30,second:1,actors:[],effects:[],constructs:[],cues:[]};
const device={id:'d',kind:'seam',x:100,y:100,radius:40,angle:0,hp:2,maxHp:2,created:0,expires:120,disabledUntil:0,attackable:false,points:[{x:80,y:100},{x:140,y:100}],heroId:'c_invoker'};

test('world effects animate from snapshot time and leave frozen input intact',()=>{
  const s=Object.freeze({...base,constructs:Object.freeze([Object.freeze({...device,points:Object.freeze(device.points.map(p=>Object.freeze(p)))})])});
  const first=buildAbilityEffectPlan(s),text=JSON.stringify(s);
  assert.deepEqual(buildAbilityEffectPlan(s),first);assert.equal(JSON.stringify(s),text);
  const later=buildAbilityEffectPlan({...s,tick:36,second:1.2});assert.notDeepEqual(first,later);
  for(const p of first.filter(p=>p.id.includes(':flow:')))assert.ok(p.points.every(p=>p.x>=80&&p.x<=140&&p.y===100));
});

test('projectile glow follows its actual heading and construct pulses respect life/arming/gaps',()=>{
  const arrow={id:'p',kind:'projectile',x:100,y:100,angle:Math.PI,radius:4,color:'#ffffff',heroId:'c_astra',slot:'skill1'};
  const paths=buildAbilityEffectPlan({...base,effects:[arrow]}).filter(p=>p.shape==='path');
  assert.ok(paths.every(p=>p.points.every(v=>v.x>=100-1e-8&&Math.abs(v.y-100)<1e-8)));
  assert.equal(buildAbilityEffectPlan({...base,constructs:[{...device,expires:30}]}).length,0);
  assert.ok(buildAbilityEffectPlan({...base,constructs:[{...device,arm:60}]}).every(p=>!p.id.includes(':flow:')));
  const square=buildAbilityEffectPlan({...base,constructs:[{...device,kind:'stage-cell',points:[],safeY:100}]});
  assert.ok(square.some(p=>p.id.endsWith(':safe:1')));assert.ok(square.every(p=>!p.id.includes(':pulse')&&!p.id.includes(':rim')));
  const circle=buildAbilityEffectPlan({...base,constructs:[{...device,points:[]}]});
  assert.ok(circle.every(p=>p.points.every(v=>Math.hypot(v.x-100,v.y-100)<=40+1e-7)));
});

test('resolved ability hits retain actual owner, position and time through capture/replay',()=>{
  const frame={second:1,champions:[],minions:[],structures:[],camps:[],dragon:{id:'d',x:0,y:0,hp:0,maxHp:1,isAlive:false},wards:[],projectiles:[],spells:[],
    abilityHits:[{id:'hit',heroId:'c_invoker',slot:'skill1',second:.9,x:40,y:60,originX:10,originY:20},
      {id:'future',heroId:'c_astra',slot:'skill1',second:2,x:40,y:60,originX:10,originY:20}]};
  const s=captureViewerSnapshot(frame);assert.equal(s.effects.length,1);assert.equal(s.effects[0].heroId,'c_invoker');
  frame.abilityHits[0].x=999;assert.equal(s.effects[0].x,40);
  const replay=new ViewerReplay();replay.record(s);const loaded=ViewerReplay.parse(replay.export()).seek(1);
  assert.deepEqual(buildAbilityEffectPlan(loaded),buildAbilityEffectPlan(s));
  assert.equal(captureViewerSnapshot({...frame,second:2}).effects.length,1);
  const invalid=JSON.parse(replay.export());invalid.frames[0].effects[0].originX='bad';
  assert.throws(()=>ViewerReplay.parse(JSON.stringify(invalid)),/Invalid effect geometry/);
});

test('effect budget is bounded and unknown palettes cannot inject material values',()=>{
  const effects=Array.from({length:2000},(_,i)=>({id:String(i),kind:'impact',x:10,y:10,radius:24,color:'#ffffff',age:.1}));
  assert.ok(buildAbilityEffectPlan({...base,effects}).length<=600);
  assert.deepEqual(abilityEffectPalette('__proto__','url(bad)'),['#a377ff','#fff4dc']);
});
