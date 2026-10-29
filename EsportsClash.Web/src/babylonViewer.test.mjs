import test from 'node:test';
import assert from 'node:assert/strict';
import { ViewerReplay } from './match-viewer/ViewerReplay.ts';
import { captureViewerSnapshot } from './match-viewer/MatchViewer.ts';
import { sampleAvatarAnimation } from './match-viewer/avatarPresentation.ts';
import { arenaGroundHeight, RIDGE_HEIGHT } from './arenaElevation.ts';

test('viewer snapshots own their values and cannot mutate live combat',()=>{
  const unit={id:'a',champion:{id:'c_invoker'},player:{name:'Cardrel'},x:12,y:20,hp:50,maxHp:100,isAlive:true,facing:'left',team:'blue'};
  const frame={second:1,champions:[unit],minions:[],structures:[],camps:[],dragon:{id:'dragon',x:0,y:0,hp:0,maxHp:1,isAlive:false},wards:[],projectiles:[],spells:[]};
  const snapshot=captureViewerSnapshot(frame);unit.x=90;
  assert.equal(snapshot.actors[0].x,12);assert.equal(snapshot.actors[0].heroId,'c_invoker');
  assert.throws(()=>snapshot.actors[0].hp=0,TypeError);assert.equal(unit.hp,50);
});
test('viewer replay seeks, changes presentation speed, and rejects duplicate ticks',()=>{
  const replay=new ViewerReplay();for(let tick=0;tick<=120;tick++)replay.record({tick,second:tick/30,actors:[],effects:[]});
  replay.seek(1);assert.equal(replay.sample().tick,30);replay.paused=false;replay.setPlaybackRate(4);
  assert.equal(replay.advance(.5).tick,90);replay.paused=true;assert.equal(replay.advance(10).tick,90);
  assert.equal(ViewerReplay.parse(replay.export()).seek(2).tick,60);
  assert.throws(()=>ViewerReplay.parse(JSON.stringify({version:1,kind:'presentation-only',frames:[{tick:0,second:0,actors:[{}],effects:[]}]})),/Invalid actor/);
});

test('recorded V3 geometry survives import/seek without sharing mutable points',()=>{
  const frame={second:1,champions:[],minions:[],structures:[],camps:[],dragon:{id:'d',x:0,y:0,hp:1,maxHp:1,isAlive:true},wards:[],projectiles:[],spells:[],
    v3:{tick:30,constructs:[{id:'pane',kind:'crystal-pane',x:10,y:10,radius:12,angle:1,team:'blue',hp:2,maxHp:2,created:10,expires:120,disabledUntil:0,attackable:true,points:[{x:0,y:4},{x:50,y:4}],roster:{arm:40,safeY:20}}]}};
  const replay=new ViewerReplay();replay.capture(frame);frame.v3.constructs[0].points[0].x=90;
  const restored=ViewerReplay.parse(replay.export()).seek(1);
  assert.equal(restored.constructs[0].points[0].x,0);assert.equal(restored.constructs[0].arm,40);
  assert.throws(()=>restored.constructs[0].points[0].x=12,TypeError);
  const invalid=JSON.parse(replay.export());invalid.frames[0].constructs[0].points[0].x='wrong';
  assert.throws(()=>ViewerReplay.parse(JSON.stringify(invalid)),/Invalid construct geometry/);
});

test('animation release phase follows authoritative times and survives a seek',()=>{
  const actor={id:'a',heroId:'c_invoker',alive:true,hp:100,motion:{state:'cast',stateSince:10,vx:0,vy:0,attackTimer:0,castStart:10,castCommit:11,castEnd:12}};
  assert.deepEqual(sampleAvatarAnimation(actor,11,0),{clip:'cast',phase:.45,loop:false});
  assert.deepEqual(sampleAvatarAnimation(actor,11.5,10),sampleAvatarAnimation(actor,11.5,11.5));
  const dead={...actor,alive:false,motion:{...actor.motion,stateSince:11}};
  assert.equal(sampleAvatarAnimation(dead,12,12).phase,1);
});

test('3D battlefield elevation preserves raised lane and base plateaus above the sunken canyon chasm',()=>{
  assert.equal(arenaGroundHeight(200, 720), RIDGE_HEIGHT);
  assert.equal(arenaGroundHeight(1400, 720), RIDGE_HEIGHT);
  const chasmBottom = arenaGroundHeight(1400, 240);
  assert.ok(chasmBottom < -10, 'sunken canyon chasm dips down deep into the bedrock');
  assert.ok(arenaGroundHeight(1000, 240) > chasmBottom, 'woodland terraces sit above the sunken canyon floor');
  assert.ok(arenaGroundHeight(1400, 20) > chasmBottom, 'outer valley rim rises gently above the canyon');
});
