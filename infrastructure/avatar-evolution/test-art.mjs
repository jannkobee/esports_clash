import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import validator from 'gltf-validator';
import {AvatarGLB,sha} from './glb.mjs';
import {analyzeArt,finishArt,technicalImprovement} from './art.mjs';
const catalog=JSON.parse(await readFile(new URL('../../EsportsClash.Api/resources/avatars/catalog.json',import.meta.url),'utf8'));
const meta=catalog.avatars.find(a=>a.id==='c_invoker');
const path=new URL('../../EsportsClash.Web/public/models/'+meta.file,import.meta.url),source=await readFile(path);

test('find real missing surface channels and generate five valid, distinct component assets without rewriting the source',async()=>{
  const before=sha(source),signature=new AvatarGLB(source).signature(),analysis=analyzeArt(source,meta);
  assert.deepEqual(analysis.issues.map(i=>i.component),['brocade','velvet','brass','leather']);
  const hashes=[];for(let i=0;i<5;i++){
    const result=finishArt(source,meta,['brocade','brass'],i),g=new AvatarGLB(result.bytes);
    const check=await validator.validateBytes(new Uint8Array(result.bytes),{maxIssues:50});assert.equal(check.issues.numErrors,0);
    for(const key of ['rig','timing','root_motion','palette','topology'])assert.equal(g.signature()[key],signature[key]);
    assert.ok(result.changed.some(c=>c.kind==='texture'));if(i%2)assert.ok(result.changed.some(c=>c.kind==='geometry'));
    assert.equal(result.added_texture_mib,5);assert.equal(result.visual.facet_count,0);
    assert.deepEqual(analyzeArt(result.bytes,meta).issues.filter(i=>i.generatable).map(i=>i.component),['velvet','leather']);hashes.push(sha(result.bytes));
  }
  assert.equal(new Set(hashes).size,5);assert.equal(sha(await readFile(path)),before);
});

test('resolved components do not generate again, and unqualified character or component changes are refused',()=>{
  const complete=finishArt(source,meta,['brocade','velvet','brass','leather'],0);
  assert.deepEqual(analyzeArt(complete.bytes,meta).issues,[]);
  assert.throws(()=>finishArt(complete.bytes,meta,['brocade'],0),/unresolved/);
  assert.throws(()=>finishArt(source,meta,['new-weapon'],0),/unresolved/);
  assert.throws(()=>finishArt(source,{...meta,id:'c_other'},['brocade'],0),/qualified/);
  assert.throws(()=>finishArt(source,meta,['brocade'],99));
});

test('technical selection keeps current when frame cost, clipping, motion, silhouette or budgets regress',()=>{
  // Gate arithmetic fixture only; never a generated render or publication report.
  const render={passed:true,worker_memory:{anonymous_mib:300},gameplay:{passed:true},textures:{detailed_materials:1,missing_detail_maps:0},shader_errors:[],renderer:{draw_calls:21,mean_frame_ms:10},views:[{silhouette:{occupied_pixels:1000,canvas:[100,100],mask_runs:[0,1000],mean_rgb:[100,100,100],clipped:false}}],planted_foot_step_drift:1,blend_hand_step_jump:1};
  const analysis={performance:{triangles:40000,materials:21}},baseline={render,analysis,blender:{bind_pose_intersection_pairs:100}};
  const candidate={render:structuredClone(render),analysis,blender:{bind_pose_intersection_pairs:100},validation:{passed:true},issues_addressed:['brocade:surface-detail'],added_texture_mib:4};
  const profile=analyzeArt(source,meta).profile;
  assert.equal(technicalImprovement(baseline,candidate,profile).qualifies,true);
  for(const edit of [c=>c.render.renderer.mean_frame_ms=12,c=>c.blender.bind_pose_intersection_pairs=101,c=>c.render.planted_foot_step_drift=2,
    c=>c.render.views[0].silhouette.occupied_pixels=800,c=>c.added_texture_mib=99,c=>c.issues_addressed=[]]){
    const copy=structuredClone(candidate);edit(copy);assert.equal(technicalImprovement(baseline,copy,profile).qualifies,false);
  }
});
