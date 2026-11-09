import test from 'node:test';
import assert from 'node:assert/strict';
import {abilityArtCell,atlasUv,MIRELLE_PATTERN_CELLS} from './match-viewer/abilityArt.ts';
import {PAINTED_ROSTER_ART} from './match-viewer/paintedRosterArt.ts';
import {sampleIllustrationMotion} from './match-viewer/illustrationMotion.ts';
import {captureViewerSnapshot} from './match-viewer/MatchViewer.ts';
import {ViewerReplay} from './match-viewer/ViewerReplay.ts';

test('all original identities resolve to bounded art cells; untrusted IDs cannot become URLs',()=>{
  assert.equal(Object.keys(PAINTED_ROSTER_ART).length,45);
  for(const [id,art] of Object.entries(PAINTED_ROSTER_ART)){
    assert.match(art.slug,/^[a-z]+(?:-[a-z]+)*$/);assert.ok(art.aspect>0&&art.aspect<4);
    for(const slot of ['passive','skill1','skill2','ultimate']){
      const cell=abilityArtCell(id,slot);const uv=atlasUv(cell.cell,cell.columns,cell.rows);
      assert.ok(uv.uOffset>=0&&uv.vOffset>=0&&uv.uOffset+uv.uScale<=1&&uv.vOffset+uv.vScale<=1);
    }
  }
  assert.equal(abilityArtCell('../../private'),undefined);
  assert.equal(abilityArtCell('__proto__'),undefined);assert.equal(abilityArtCell('constructor'),undefined);
  assert.equal(abilityArtCell('c_invoker','ultimate','constructor').slug,'mirelle-vane');
  for(const [kind,index] of Object.entries(MIRELLE_PATTERN_CELLS)){
    assert.deepEqual(abilityArtCell('c_invoker','ultimate',kind),{slug:'mirelle-pages',cell:index,columns:5,rows:2});
    assert.notEqual(abilityArtCell('c_solana','ultimate',kind).slug,'mirelle-pages');
  }
});

test('illustration pose samples pause/seek deterministically and holds terminal death',()=>{
  const actor=Object.freeze({alive:true,facing:-1,motion:Object.freeze({state:'walk',stateSince:2,vx:100,vy:0,attackTimer:0})});
  const pose=sampleIllustrationMotion(actor,3);sampleIllustrationMotion(actor,100);
  assert.deepEqual(sampleIllustrationMotion(actor,3),pose);assert.ok(pose.stretch>0);
  const dead={...actor,alive:false};assert.deepEqual(sampleIllustrationMotion(dead,3),sampleIllustrationMotion(dead,10));
  assert.equal(sampleIllustrationMotion(dead,10).tilt,-Math.PI/2);
});

test('artwork attribution uses actual owners/commit events and remains immutable through replay',()=>{
  const actor={id:'caster',champion:{id:'c_invoker'},player:{name:'Cardrel'},x:20,y:30,hp:50,maxHp:100,isAlive:true,facing:'left',team:'blue'};
  const frame={second:1,champions:[actor],minions:[],structures:[],camps:[],dragon:{id:'d',x:0,y:0,hp:0,maxHp:1,isAlive:false},wards:[],
    projectiles:[{id:'p',x:30,y:30,size:3,angle:0,color:'#ffffff',attackerId:'caster',abilitySlot:'skill1'}],spells:[],
    v3:{tick:30,casts:[],events:[{id:'yes',tick:30,type:'ability_committed',actor:'caster',reason:'ultimate'},{id:'no',tick:30,type:'ability_failed',actor:'caster',reason:'skill1'}],
      constructs:[{id:'seam',kind:'seam',owner:'caster',x:30,y:30,radius:12,angle:0,team:'blue',hp:2,maxHp:2,created:30,expires:120,disabledUntil:0,attackable:true,points:[]}]}};
  const s=captureViewerSnapshot(frame);assert.equal(s.effects[0].heroId,'c_invoker');assert.equal(s.effects[0].slot,'skill1');
  assert.equal(s.constructs[0].slot,'ultimate');assert.equal(s.constructs[0].owner,'caster');assert.equal(s.cues.length,1);
  frame.v3.events[0].reason='skill1';assert.equal(s.cues[0].slot,'ultimate');
  assert.throws(()=>s.cues[0].tick=999,TypeError);
  const replay=new ViewerReplay();replay.record(s);const loaded=ViewerReplay.parse(replay.export()).seek(1);
  assert.deepEqual(loaded,JSON.parse(JSON.stringify(s)));assert.throws(()=>loaded.cues[0].slot='skill2',TypeError);
  const corrupt=JSON.parse(replay.export());corrupt.frames[0].cues[0].tick=31;
  assert.throws(()=>ViewerReplay.parse(JSON.stringify(corrupt)),/Invalid ability cue/);
  const old={...s,cues:undefined};const r=new ViewerReplay();r.record(old);assert.equal(ViewerReplay.parse(r.export()).seek(1).cues.length,0);
});
