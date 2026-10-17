import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {CHAMPIONS} from './mockData.ts';
import {AUTHORED_AVATARS} from './avatarArt.ts';
import {AVATAR_CONTACTS} from './avatarContactProfiles.ts';

const decode=bytes=>{const length=bytes.readUInt32LE(12);return {json:JSON.parse(bytes.subarray(20,20+length)),bin:bytes.subarray(28+length)};};
const vectors=(file,index)=>{const a=file.json.accessors[index],v=file.json.bufferViews[a.bufferView];assert.equal(a.componentType,5126);assert.equal(a.type,'VEC3');
 return Array.from({length:a.count},(_,i)=>[0,1,2].map(c=>file.bin.readFloatLE((v.byteOffset??0)+(a.byteOffset??0)+i*(v.byteStride??12)+c*4)));};

test('v7 grip shapes preserve original hand geometry, have finite deltas and keep explicit per-avatar closure',async()=>{
 let hands=0,closed=0;
 for(const id of Object.keys(AUTHORED_AVATARS)){
  const file=decode(await readFile(new URL(`../public/models/avatars-v7/${id}.glb`,import.meta.url))),prior=decode(await readFile(new URL(`../public/models/avatars-v6/${id}.glb`,import.meta.url)));
  for(const side of ['L','R']){
   const node=file.json.nodes.find(n=>n.extras?.anatomyTarget==='Hand'+side),mesh=file.json.meshes[node.mesh];
   const old=prior.json.meshes[prior.json.nodes.find(n=>n.extras?.anatomyTarget==='Hand'+side).mesh];
   assert.deepEqual(mesh.extras.targetNames,['Grip']);assert.deepEqual(mesh.weights,[(side==='L'?AVATAR_CONTACTS[id].closeLeft:AVATAR_CONTACTS[id].closeRight)??0]);
   hands++;if(mesh.weights[0]>0)closed++;
   for(const [i,p] of mesh.primitives.entries()){
    for(const key of ['POSITION','NORMAL']){
     assert.deepEqual(vectors(file,p.attributes[key]),vectors(prior,old.primitives[i].attributes[key]),id+' original '+key);
     const deltas=vectors(file,p.targets[0][key]);assert.ok(deltas.flat().every(Number.isFinite));assert.ok(deltas.flat().some(v=>Math.abs(v)>1e-4));
     assert.equal(deltas.length,file.json.accessors[p.attributes[key]].count);
    }
   }
  }
 }
 assert.equal(hands,68);assert.ok(closed>40);
});

test('all 45 editable Blender scenes match their manifest and retain the ten shipped actions and grip shapes',async()=>{
 const folder=new URL('../../art/avatars-v7/',import.meta.url),manifest=JSON.parse(await readFile(new URL('manifest.json',folder),'utf8'));
 assert.deepEqual(manifest.models.map(m=>m.id).sort(),CHAMPIONS.map(c=>c.id).sort());
 for(const model of manifest.models){
  assert.deepEqual(model.actions,['Attack','Cast','Death','Hit','Idle','Run','Strafe','TurnLeft','TurnRight','Walk']);
  assert.equal(model.gripShapes,AUTHORED_AVATARS[model.id]?2:0);
  const bytes=await readFile(new URL(model.file,folder));assert.equal(bytes.length,model.bytes);assert.equal(createHash('sha256').update(bytes).digest('hex'),model.sha256);
 }
});
