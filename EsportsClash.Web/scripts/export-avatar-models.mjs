import { mkdir, writeFile, readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import * as THREE from 'three';
import { GLTFExporter } from 'three/addons/exporters/GLTFExporter.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { CHAMPIONS } from '../src/mockData.ts';
import { AvatarModelResources, buildAvatarModel } from '../src/threeAvatarModels.ts';
import { avatarModelAnimations } from '../src/avatarModelAnimations.ts';
import { disposeArenaTerrainResources } from '../src/threeArenaTerrain.ts';

// GLTFExporter's untextured binary path needs only this browser FileReader API.
globalThis.FileReader = class {
  result; onloadend;
  async readAsArrayBuffer(blob) { this.result=await blob.arrayBuffer(); this.onloadend?.(); }
  async readAsDataURL(blob) { this.result=`data:${blob.type};base64,${Buffer.from(await blob.arrayBuffer()).toString('base64')}`; this.onloadend?.(); }
};
const output='public/models/avatars-v2'; await mkdir(output,{recursive:true});
const selected=process.argv.find(arg=>arg.startsWith('--only='))?.slice(7);
if(selected&&!CHAMPIONS.some(kit=>kit.id===selected))throw Error(`Unknown avatar ${selected}`);
const previous=selected?JSON.parse(await readFile(`${output}/manifest.json`,'utf8')).avatars:[];
const resources=new AvatarModelResources(), exporter=new GLTFExporter(), manifest=[];
for(const kit of CHAMPIONS) {
  if(selected&&kit.id!==selected){manifest.push(previous.find(asset=>asset.id===kit.id));continue;}
  const model=buildAvatarModel(kit,resources), clips=avatarModelAnimations(model);
  const root=new THREE.Group(); root.name=kit.displayName; root.scale.setScalar(.025);
  root.userData={assetVersion:kit.id==='c_invoker'?3:2,units:'meters',authoring:'Original parametric surface modeling',avatarId:kit.id}; root.add(model.body);
  root.updateMatrixWorld(true);
  const binary=await exporter.parseAsync(root,{binary:true,onlyVisible:false,animations:clips});
  const bytes=Buffer.from(binary); const file=`${output}/${kit.id}.glb`; await writeFile(file,bytes);
  // Decode the saved bytes with the same standard loader a consuming app uses.
  const saved=await readFile(file), imported=await new GLTFLoader().parseAsync(saved.buffer.slice(saved.byteOffset,saved.byteOffset+saved.byteLength),'');
  let skins=0,triangles=0,joints=0,uvMeshes=0;
  imported.scene.traverse(node=>{if(node instanceof THREE.Mesh){triangles+=(node.geometry.index?.count??node.geometry.getAttribute('position').count)/3;
    if(node.geometry.getAttribute('uv'))uvMeshes++;if(node instanceof THREE.SkinnedMesh){skins++;joints=Math.max(joints,node.skeleton.bones.length);}}});
  if(!skins||joints<17||imported.animations.length!==4)throw Error(`Incomplete rig or clips: ${kit.id}`);
  manifest.push({id:kit.id,name:kit.displayName,file:`${kit.id}.glb`,bytes:bytes.length,sha256:createHash('sha256').update(bytes).digest('hex'),
    triangles,skins,joints,uvMeshes,clips:imported.animations.map(clip=>({name:clip.name,duration:clip.duration,tracks:clip.tracks.length}))});
  disposeArenaTerrainResources(imported.scene); model.dispose();
}
disposeArenaTerrainResources(resources.owner);
await writeFile(`${output}/manifest.json`,JSON.stringify({version:2,date:'2026-10-17',units:'meters',worldUnitsPerMeter:40,avatars:manifest},null,2)+'\n');
console.log(JSON.stringify({models:manifest.length,bytes:manifest.reduce((n,row)=>n+row.bytes,0),triangles:manifest.reduce((n,row)=>n+row.triangles,0),output}));
