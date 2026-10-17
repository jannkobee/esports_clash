import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { ArenaAbilityEffects } from './threeAbilityEffects.ts';
import { disposeArenaTerrainResources } from './threeArenaTerrain.ts';

function fingerprint(fx) {
  const values=[];fx.root.traverse(node=>{if(node instanceof THREE.InstancedMesh)
    values.push([node.count,...node.instanceMatrix.array.slice(0,node.count*16),...node.instanceColor.array.slice(0,node.count*3)]);
  });return JSON.stringify(values);
}
const event=(type,extra={})=>({id:type,type,x:220,y:100,radius:45,color:'#b794f6',duration:1,maxDuration:2,...extra});

test('all twelve dash types use frozen current motion and stop without a live dash',()=>{
  const fx=new ArenaAbilityEffects();
  for(const kind of ['renn_vault','renn_waltz','renn_rush','kaolin_roll','cinder_lunge','raijin_bolt',
    'canopy_bound','solana_lance','veyara_dash','valerie_punch','jaxon_leap','brewmaw_rush']){
    const unit=Object.freeze({id:'dasher',isAlive:true,x:70,y:0,dash:Object.freeze({kind,remaining:.2,startX:0,startY:0,targetX:999,targetY:999})});
    const before=JSON.stringify(unit);fx.update([],[],1,[unit]);assert.ok(fx.stats().effects>0,kind);
    const rendered=fingerprint(fx);fx.update([],[],1,[unit]);assert.equal(fingerprint(fx),rendered);
    fx.update([],[],1,[{...unit,dash:{...unit.dash,targetX:-999,targetY:-999}}]);assert.equal(fingerprint(fx),rendered,'future target does not determine trail');
    assert.equal(JSON.stringify(unit),before);
    for(const changed of [{...unit,dash:undefined},{...unit,isAlive:false},{...unit,dash:{...unit.dash,remaining:0}},
      {...unit,dash:{...unit.dash,startX:undefined}}, {...unit,x:0}]){
      fx.update([],[],1,[changed]);assert.equal(fx.stats().effects,0,kind+' stopped');
    }
  }
  disposeArenaTerrainResources(fx.root);
});

test('hook chains have bounded ornament count, follow their caster and still render without one',()=>{
  const fx=new ArenaAbilityEffects(),shot=Object.freeze({id:'hook',type:'hook',x:5000,y:100,size:6,angle:0,color:'#afd9e6',attackerId:'caster'});
  fx.update([shot],[],1,[{id:'caster',x:10,y:100}]);
  let links=0;fx.root.traverse(node=>{if(node instanceof THREE.InstancedMesh&&node.geometry.type==='TorusGeometry')links+=node.count;});
  assert.equal(links,22);const first=fingerprint(fx);
  fx.update([shot],[],1,[{id:'caster',x:50,y:100}]);assert.notEqual(fingerprint(fx),first);
  fx.update([shot],[],1,[]);assert.ok(fx.stats().effects>0);fx.root.traverse(node=>{if(node instanceof THREE.InstancedMesh&&node.geometry.type==='TorusGeometry')assert.equal(node.count,0);});
  disposeArenaTerrainResources(fx.root);
});

test('target-bound marks follow live targets and disappear on target death',()=>{
  const fx=new ArenaAbilityEffects();
  for(const type of ['death_mark','shallow_grave']){
    const cast=Object.freeze(event(type,{targetUnitId:'target'})),target=Object.freeze({id:'target',x:220,y:100,isAlive:true});
    fx.update([], [cast],1,[target]);const first=fingerprint(fx);
    fx.update([], [cast],1,[{...target,x:260}]);assert.notEqual(fingerprint(fx),first);
    fx.update([], [cast],1,[{...target,isAlive:false}]);assert.equal(fx.stats().effects,0);
  }
  disposeArenaTerrainResources(fx.root);
});

test('Prism Warden formation starts at the real immediate summon time without waiting for kit delay',()=>{
  const fx=new ArenaAbilityEffects(),cast=Object.freeze({spellId:'solar-pike',origin:Object.freeze({x:80,y:100}),aim:Object.freeze({x:220,y:100}),elapsed:0,hitIds:Object.freeze([]),resolved:false});
  const spell=Object.freeze(event('kaelen_invoke',{kaelenCast:cast,maxDuration:.55,duration:.55}));const before=JSON.stringify(spell);
  fx.update([], [spell],0,[]);assert.ok(fx.stats().effects>1,'formation already visible on summon frame');
  const first=fingerprint(fx);fx.update([], [{...spell,duration:.35,kaelenCast:{...cast,elapsed:.2}}],.2,[]);assert.notEqual(fingerprint(fx),first);
  assert.equal(JSON.stringify(spell),before);disposeArenaTerrainResources(fx.root);
});

test('Broadside ornament follows the locked channel facing on either team without exceeding forward reach',()=>{
  const fx=new ArenaAbilityEffects(),matrix=new THREE.Matrix4();
  for(const [facing,sign] of [['right',1],['left',-1]]){
    const source=Object.freeze({id:'caster',x:400,y:100,isAlive:true,corsaraBarrage:Object.freeze({remaining:2,facing})});
    fx.update([], [event('broadside_channel',{sourceUnitId:'caster'})],.4,[source]);
    let count=0;fx.root.traverse(node=>{if(!(node instanceof THREE.InstancedMesh))return;
      for(let i=0;i<node.count;i++){node.getMatrixAt(i,matrix);const forward=(matrix.elements[12]-source.x)*sign;
        assert.ok(forward>=-.001&&forward<=260.001);count++;}
    });assert.ok(count>5);
  }
  disposeArenaTerrainResources(fx.root);
});
