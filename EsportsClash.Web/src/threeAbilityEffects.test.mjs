import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { ArenaAbilityEffects, abilityEffectStyle } from './threeAbilityEffects.ts';
import { AVATAR_ANIMATION_MOTIFS } from './avatarSkillAnimation.ts';
import { KAELEN_INVOKED_SPELLS } from './kaelenAbilities.ts';
import { kaelenCastPosition, kaelenCastLifetime } from './kaelenSpellRuntime.ts';
import { disposeArenaTerrainResources } from './threeArenaTerrain.ts';

const spell=(extra={})=>({id:'cast',type:'skill_burst',x:250,y:120,radius:65,duration:.6,maxDuration:1,
  color:'#8dcfff',sourceX:100,sourceY:120,...extra});
function fingerprint(root){
  root.updateMatrixWorld(true); const values=[];
  root.traverse(node=>{
    if(node instanceof THREE.InstancedMesh) values.push([node.count,...node.instanceMatrix.array.slice(0,node.count*16),...node.instanceColor.array.slice(0,node.count*3)]);
    else if(node instanceof THREE.Mesh&&node.visible)values.push([...node.matrix.elements,node.material.opacity,node.material.color.getHex()]);
  });return JSON.stringify(values);
}

test('all existing hero motifs have a 3D vocabulary and explicit events override general hero style',()=>{
  for(const avatarName of Object.keys(AVATAR_ANIMATION_MOTIFS))assert.notEqual(abilityEffectStyle(spell({avatarName})),'impact',avatarName);
  assert.equal(abilityEffectStyle(spell({type:'black_hole',avatarName:'Solana'})),'void');
  assert.equal(abilityEffectStyle(spell({type:'wind_wall'})),'wall');
  assert.equal(abilityEffectStyle(spell({type:'forest_link',avatarName:'Tequoia'})),'beam');
});

test('pooled VFX are deterministic for frozen worlds, batch glow and reclaim expired visuals',()=>{
  const fx=new ArenaAbilityEffects();
  const shots=Object.freeze(['arrow','ult_arrow','spirit_arrow','feather','poison_dart','laser','hook','tornado',
    'shuriken','boulder','electric_spark','orb','flak_round','boss_breath','nature_bolt','seed_shot'].map((type,i)=>
    Object.freeze({id:type,type,x:150+i*5,y:150,size:5,color:'#82d6fc',angle:.2,attackerId:'caster'})));
  const spells=Object.freeze(Object.keys(AVATAR_ANIMATION_MOTIFS).map(avatarName=>Object.freeze(spell({avatarName,id:avatarName}))));
  const sources=Object.freeze([Object.freeze({id:'caster',x:50,y:150})]);
  const before=JSON.stringify({shots,spells,sources}); fx.update(shots,spells,2,sources);
  const expected=fingerprint(fx.root),stats=fx.stats(); let geometries=0,materials=0;
  fx.root.traverse(n=>{if(n instanceof THREE.Mesh){geometries++;materials++;}});
  for(let i=0;i<3;i++)fx.update(shots,spells,2,sources);
  assert.equal(fingerprint(fx.root),expected);assert.deepEqual(fx.stats(),stats);
  assert.equal(JSON.stringify({shots,spells,sources}),before);
  let batches=0;fx.root.traverse(n=>{if(n instanceof THREE.InstancedMesh&&n.count)batches++;});
  assert.ok(batches>0&&batches<=11,'glow is batched by shared geometry');
  fx.update([],[],2,[]);assert.equal(fx.stats().effects,0);assert.equal(fx.stats().pooledEffects,stats.pooledEffects);
  fx.root.traverse(n=>{if(n instanceof THREE.InstancedMesh)assert.equal(n.count,0);});
  const disposed=disposeArenaTerrainResources(fx.root);assert.ok(disposed.geometries>=11&&disposed.materials>1);
  assert.ok(geometries&&materials);
});

test('Arsenaldo travelling spells and meteor warning follow actual cast position and delay',()=>{
  for(const kit of KAELEN_INVOKED_SPELLS){
    const fx=new ArenaAbilityEffects(),elapsed=kit.shape==='meteor'?kit.delay*.5:kit.delay+.12;
    const cast=Object.freeze({spellId:kit.id,origin:Object.freeze({x:100,y:120}),aim:Object.freeze({x:350,y:120}),elapsed,hitIds:Object.freeze([]),resolved:false});
    const maxDuration=kaelenCastLifetime(kit),event=Object.freeze(spell({type:'kaelen_invoke',kaelenCast:cast,maxDuration,duration:maxDuration-elapsed}));
    const before=JSON.stringify(event);fx.update([],Object.freeze([event]),2,[]);
    const position=kaelenCastPosition(cast,kit),matrix=new THREE.Matrix4(),at=new THREE.Vector3(),scale=new THREE.Vector3(),rotation=new THREE.Quaternion();
    let foundFootprint=false;
    fx.root.traverse(node=>{if(!(node instanceof THREE.InstancedMesh))return;
      for(let i=0;i<node.count;i++){node.getMatrixAt(i,matrix);matrix.decompose(at,rotation,scale);
        if(Math.abs(at.x-position.x)<.01&&Math.abs(at.z-position.y)<.01&&Math.abs(at.y-2)<.01&&Math.abs(scale.x-position.radius)<.01)foundFootprint=true;
        if(kit.shape==='meteor')assert.ok(at.y>=2,'no underground impact before meteor lands');
      }
    });
    assert.ok(foundFootprint,kit.id+' exact runtime footprint');assert.equal(JSON.stringify(event),before);
    disposeArenaTerrainResources(fx.root);
  }
});

test('warning-only events never create premature impact flashes or eruption geometry',()=>{
  const fx=new ArenaAbilityEffects();fx.update([], [spell({type:'golem_charge_warning'})],1,[]);
  assert.equal(fx.stats().effects,2);disposeArenaTerrainResources(fx.root);
});

test('channel visuals stop on interruption/death and moving spin visuals follow the live caster',()=>{
  const fx=new ArenaAbilityEffects();
  for(const [type,key] of [['black_hole','blackHole'],['broadside_channel','corsaraBarrage'],['cyclone_dance','monkeySpin'],['branch_court','monkeyCourt']]){
    const event=Object.freeze(spell({type,sourceUnitId:'caster'}));
    const caster=Object.freeze({id:'caster',isAlive:true,x:400,y:240,[key]:Object.freeze({x:310,y:120,remaining:2,facing:'right'})});
    fx.update([], [event],1,[caster]);assert.ok(fx.stats().effects>0,type+' active');
    const active=fingerprint(fx.root);
    if(type==='cyclone_dance'){fx.update([], [event],1,[{...caster,x:440}]);assert.notEqual(fingerprint(fx.root),active,'spin follows current position');}
    fx.update([], [event],1,[{...caster,[key]:undefined}]);assert.equal(fx.stats().effects,0,type+' interrupted');
    fx.update([], [event],1,[{...caster,isAlive:false}]);assert.equal(fx.stats().effects,0,type+' dead');
  }
  disposeArenaTerrainResources(fx.root);
});
