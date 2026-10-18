import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {AvatarGLB,sha} from './glb.mjs';
const meta=JSON.parse(await readFile(new URL('../../EsportsClash.Api/resources/avatars/catalog.json',import.meta.url))).avatars.find(a=>a.id==='c_invoker');
const source=await readFile(new URL('../../EsportsClash.Web/public/models/'+meta.file,import.meta.url));

test('five actual Arsenaldo candidates preserve skeleton, skin weights, topology, palette, textures and key timing',()=>{
  const original=new AvatarGLB(source),frozen=original.signature(),hash=sha(source),results=[];
  for(const [recipe,strength]of[['silhouette',.033],['equipment',.048],['motion',.058],['silhouette',.073],['motion',.083]]){
    const model=new AvatarGLB(source),change=model.mutate(meta,recipe,strength),bytes=model.bytes(),restored=new AvatarGLB(bytes);
    assert.deepEqual(restored.signature(),frozen);assert.notEqual(sha(bytes),hash);assert.ok(change.changed.some(c=>c.kind==='geometry'));
    assert.ok(change.changed.filter(c=>c.kind==='geometry').some(c=>c.vertices>100));
    if(recipe==='motion')assert.ok(change.changed.some(c=>c.kind==='animation'));
    assert.equal(restored.analyze(meta).rig.unique_joints,17);
    results.push(sha(bytes));
  }
  assert.equal(new Set(results).size,5);assert.equal(sha(source),hash,'Source buffer was mutated');
});
test('unsupported or unbounded transformations are rejected',()=>{
  for(const [recipe,strength]of[['source-code',.05],['motion',1],['silhouette',-.2],['equipment',NaN]])
    assert.throws(()=>new AvatarGLB(source).mutate(meta,recipe,strength));
});
test('corrupted GLB lengths and external image references cannot enter the mutation workflow',()=>{
  const bad=Buffer.from(source);bad.writeUInt32LE(0,8);assert.throws(()=>new AvatarGLB(bad));
  const model=new AvatarGLB(source);model.json.images[0].uri='https://untrusted.invalid/model.png';
  assert.throws(()=>new AvatarGLB(model.bytes()));
});
