import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {AUTHORED_AVATARS} from './avatarArt.ts';
import {avatarModelUrl} from './avatarModelUrl.ts';

const folder=new URL('../public/models/avatars-v4/',import.meta.url);
const decode=bytes=>{const length=bytes.readUInt32LE(12);return {json:JSON.parse(bytes.subarray(20,20+length)),bin:bytes.subarray(28+length)};};
function channelHash({json,bin}){
 const hash=createHash('sha256');
 for(const animation of [...json.animations].sort((a,b)=>a.name.localeCompare(b.name))){
  hash.update(animation.name);
  for(const channel of animation.channels){
   hash.update(json.nodes[channel.target.node].name+channel.target.path);
   const sampler=animation.samplers[channel.sampler];hash.update(sampler.interpolation??'LINEAR');
   for(const key of ['input','output']){
    const accessor=json.accessors[sampler[key]],view=json.bufferViews[accessor.bufferView];
    const size=4*({SCALAR:1,VEC3:3,VEC4:4}[accessor.type]),start=(view.byteOffset??0)+(accessor.byteOffset??0);
    assert.equal(accessor.componentType,5126);
    for(let i=0;i<accessor.count;i++)hash.update(bin.subarray(start+i*(view.byteStride??size),start+i*(view.byteStride??size)+size));
   }
  }
 }
 return hash.digest('hex');
}

test('34 authored GLBs keep original native animation channels and contain valid embedded image maps and outfit weights',async()=>{
 const manifest=JSON.parse(await readFile(new URL('manifest.json',folder),'utf8'));
 assert.deepEqual(manifest.avatars.map(a=>a.id).sort(),Object.keys(AUTHORED_AVATARS).sort());
 for(const asset of manifest.avatars){
  assert.match(avatarModelUrl(asset.id),/avatars-v9\/.+\.glb\?art=9$/);
  const bytes=await readFile(new URL(asset.file,folder)),file=decode(bytes),{json,bin}=file;
  assert.equal(bytes.readUInt32LE(8),bytes.length);assert.equal(bytes.length,asset.bytes);
  assert.equal(createHash('sha256').update(bytes).digest('hex'),asset.sha256);
  for(const skin of json.skins){assert.equal(skin.joints.length,17);assert.deepEqual(skin.joints,json.skins[0].joints);}
  assert.deepEqual(json.animations.map(a=>a.name),['Idle','Walk','Attack','Cast']);
  const original=decode(await readFile(new URL(`../public/models/avatars-v2/${asset.file}`,import.meta.url)));
  assert.equal(channelHash(file),channelHash(original),asset.id+' native channels remain byte-identical');
  assert.equal(channelHash(file),asset.animationSha256);
  for(const target of ['Head','HandL','HandR'])assert.ok(json.nodes.some(n=>n.extras?.anatomyTarget===target));
  if(asset.outfit)assert.ok(json.nodes.some(n=>n.extras?.anatomyTarget==='Outfit'&&n.skin===0));
  assert.ok(json.materials.some(m=>m.normalTexture&&m.pbrMetallicRoughness?.baseColorTexture));
  for(const image of json.images){
   assert.equal(image.mimeType,'image/png');assert.equal(image.uri,undefined);
   const view=json.bufferViews[image.bufferView],data=bin.subarray(view.byteOffset,view.byteOffset+view.byteLength);
   assert.equal(data.subarray(0,8).toString('hex'),'89504e470d0a1a0a');
   assert.ok(data.readUInt32BE(16)>0&&data.readUInt32BE(16)<=512);assert.ok(data.readUInt32BE(20)>0&&data.readUInt32BE(20)<=512);
  }
  for(const mesh of json.meshes)for(const primitive of mesh.primitives){
   const a=json.accessors[primitive.attributes.JOINTS_0];if(!a)continue;
   const w=json.accessors[primitive.attributes.WEIGHTS_0];assert.equal(a.count,w.count);
   const av=json.bufferViews[a.bufferView],wv=json.bufferViews[w.bufferView],size=a.componentType===5121?1:2;
   assert.equal(w.componentType,5126);
   for(let i=0;i<a.count;i++){
    let total=0;
    for(let c=0;c<4;c++){
     const at=(av.byteOffset??0)+(a.byteOffset??0)+i*(av.byteStride??size*4)+c*size;
     const joint=size===1?bin.readUInt8(at):bin.readUInt16LE(at);assert.ok(joint<17);
     const weight=bin.readFloatLE((wv.byteOffset??0)+(w.byteOffset??0)+i*(wv.byteStride??16)+c*4);
     assert.ok(Number.isFinite(weight)&&weight>=0);total+=weight;
    }
    assert.ok(Math.abs(total-1)<1e-5,asset.id+' normalized weights');
   }
  }
 }
 assert.match(avatarModelUrl('c_puck'),/avatars-v9/);
});
