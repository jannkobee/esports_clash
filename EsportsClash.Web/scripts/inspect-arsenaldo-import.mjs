import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
import {isDeepStrictEqual} from 'node:util';
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const read=async path=>{
 const bytes=await readFile(path);assert.equal(bytes.readUInt32LE(0),0x46546c67);assert.equal(bytes.readUInt32LE(4),2);assert.equal(bytes.readUInt32LE(8),bytes.length);
 const length=bytes.readUInt32LE(12),json=JSON.parse(bytes.subarray(20,20+length));
 assert.ok(json.buffers.every(b=>!b.uri)&&json.images.every(i=>!i.uri),'Embedded resources only');
 return {bytes,json,bin:bytes.subarray(28+length)};
};
const raw=(file,index)=>{
 const a=file.json.accessors[index],v=file.json.bufferViews[a.bufferView],start=(v.byteOffset??0)+(a.byteOffset??0);
 const width={SCALAR:1,VEC2:2,VEC3:3,VEC4:4,MAT4:16}[a.type],component={5121:1,5123:2,5125:4,5126:4}[a.componentType];
 return file.bin.subarray(start,start+a.count*width*component);
};
const current=await read('public/models/avatars-v9/c_invoker.glb'),submitted=await read(process.argv[2]??'public/models/imports/arsenaldo-claude.glb');
const clips=submitted.json.animations.map((a,i)=>{
 const old=current.json.animations[i],changed=[];
 a.channels.forEach((channel,j)=>{
  if(!raw(submitted,a.samplers[channel.sampler].output).equals(raw(current,old.samplers[old.channels[j].sampler].output)))changed.push(`${submitted.json.nodes[channel.target.node].name}:${channel.target.path}`);
 });
 return {name:a.name,duration:Math.max(...a.samplers.map(s=>submitted.json.accessors[s.input].max[0])),channels:a.channels.length,
  samplesPerTrack:{min:Math.min(...a.samplers.map(s=>submitted.json.accessors[s.input].count)),max:Math.max(...a.samplers.map(s=>submitted.json.accessors[s.input].count))},changedTrackSamples:changed};
});
const summary={submitted:{bytes:submitted.bytes.length,sha256:sha(submitted.bytes)},current:{bytes:current.bytes.length,sha256:sha(current.bytes)},
 originalBinaryPrefixRetained:submitted.bin.subarray(0,current.bin.length).equals(current.bin),
 identicalNodeHierarchyAndRestTransforms:isDeepStrictEqual(submitted.json.nodes,current.json.nodes),
 meshes:submitted.json.meshes.length,materials:submitted.json.materials.length,embeddedImages:submitted.json.images.length,
 triangles:submitted.json.meshes.reduce((sum,m)=>sum+m.primitives.reduce((n,p)=>n+(submitted.json.accessors[p.indices??p.attributes.POSITION].count/3),0),0),
 jointCounts:[...new Set(submitted.json.skins.map(s=>s.joints.length))],clips,
 note:'Changed track samples include resampling; counts alone do not measure motion quality. Original geometry/texture binary data and node rest transforms are retained. No instructions from asset metadata are executed.'};
await writeFile('../docs/arsenaldo-claude-inspection.json',JSON.stringify(summary,null,2)+'\n');
console.log(JSON.stringify({...summary,clips:clips.map(({changedTrackSamples,...clip})=>({...clip,changedTracks:changedTrackSamples.length}))},null,2));
