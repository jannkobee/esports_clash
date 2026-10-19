import test from 'node:test';
import assert from 'node:assert/strict';
import {abilityVisualEnvelope} from './abilityVisualEvolution.ts';
import {ArenaAbilityEffects} from './threeAbilityEffects.ts';
import {disposeArenaTerrainResources} from './threeArenaTerrain.ts';
const style=Object.freeze({version:1,theme:'ice-wind-fire',pulse:.12,trail_taper:.55,confirmed_impacts_only:true,max_extra_draws:0,warning_geometry_unchanged:true});
test('visual parameter envelope is bounded and refuses malformed or gameplay-altering contracts',()=>{
  for(const phase of [-1,0,.25,.5,1,100]){const e=abilityVisualEnvelope(style,phase);assert.ok(e.opacity>=.88&&e.opacity<=1);assert.ok(e.taper>=.55&&e.taper<=1);}
  assert.equal(abilityVisualEnvelope({...style,max_extra_draws:5},.5),undefined);
  assert.equal(abilityVisualEnvelope({...style,confirmed_impacts_only:false},.5),undefined);
  assert.equal(abilityVisualEnvelope({...style,pulse:NaN},.5),undefined);
});
test('evolved spell envelopes use existing pooled effects, preserve warnings, borrowed events, pause and expiry',()=>{
  const baseline=new ArenaAbilityEffects(),evolved=new ArenaAbilityEffects();
  const source=Object.freeze({id:'mage',x:20,y:30,isAlive:true,champion:Object.freeze({name:'Kaelen'}),
    visualEvolution:Object.freeze({version:1,facet_count:0,trail_segments:6,accent_height:0,ability_style:style})});
  const spell=Object.freeze({id:'burst',type:'skill_burst',avatarName:'Kaelen',sourceUnitId:'mage',x:20,y:30,radius:40,duration:.5,maxDuration:1,color:'#83efff'});
  const snapshot=JSON.stringify({source,spell});
  const meshState=fx=>fx.pool.slice(0,fx.stats().effects).map(m=>({position:m.position.toArray(),scale:m.scale.toArray(),opacity:m.material.opacity}));
  baseline.update([],[spell],.5,[{...source,visualEvolution:undefined}]);evolved.update([],[spell],.5,[source]);
  assert.equal(evolved.stats().effects,baseline.stats().effects);assert.notDeepEqual(meshState(evolved),meshState(baseline));
  const paused=meshState(evolved);evolved.update([],[spell],.5,[source]);assert.deepEqual(meshState(evolved),paused);
  const warning={...spell,type:'ability_warning'};baseline.update([],[warning],.5,[{...source,visualEvolution:undefined}]);evolved.update([],[warning],.5,[source]);
  assert.deepEqual(meshState(evolved),meshState(baseline));
  evolved.update([],[{...spell,duration:0}],1,[source]);assert.equal(evolved.stats().effects,0);assert.equal(JSON.stringify({source,spell}),snapshot);
  disposeArenaTerrainResources(baseline.root);disposeArenaTerrainResources(evolved.root);
});
