import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {addGripMorph} from './avatar-grip-morph.mjs';
import {AVATAR_CONTACTS} from '../src/avatarContactProfiles.ts';
const mesh=process.argv.includes('--mesh'),contact=mesh||process.argv.includes('--contact'),combat=contact||process.argv.includes('--combat'),stance=combat||process.argv.includes('--stance'),prep=mesh?'../.local-tools/mesh-prep':contact?'../.local-tools/contact-prep':combat?'../.local-tools/combat-prep':stance?'../.local-tools/stance-prep':'../.local-tools/artist-prep';
const config=JSON.parse(await readFile(prep+'/avatars.json','utf8')),output='public/models/avatars-v'+config.version;await mkdir(output,{recursive:true});
export function decodeGlb(bytes){
 if(bytes.readUInt32LE(0)!==0x46546c67)throw Error('Not a GLB');
 const length=bytes.readUInt32LE(12),json=JSON.parse(bytes.subarray(20,20+length));
 return {json,binary:bytes.subarray(28+length)};
}
export function animationDigest(json,binary){
 const hash=createHash('sha256'),sizes={5126:4,5123:2,5125:4},counts={SCALAR:1,VEC3:3,VEC4:4,MAT4:16};
 for(const animation of [...json.animations??[]].sort((a,b)=>a.name.localeCompare(b.name))){
  hash.update(animation.name);
  for(const channel of animation.channels){
   hash.update(json.nodes[channel.target.node].name+channel.target.path);
   const sampler=animation.samplers[channel.sampler];hash.update(sampler.interpolation??'LINEAR');
   for(const key of ['input','output']){const accessor=json.accessors[sampler[key]],view=json.bufferViews[accessor.bufferView];
    const size=sizes[accessor.componentType]*counts[accessor.type],stride=view.byteStride??size,start=(view.byteOffset??0)+(accessor.byteOffset??0);
    for(let i=0;i<accessor.count;i++)hash.update(binary.subarray(start+i*stride,start+i*stride+size));
   }
  }
 }
 return hash.digest('hex');
}
function encodeGlb(json,binary){
 const data=Buffer.from(JSON.stringify(json)),padding=(4-data.length%4)%4,chunk=Buffer.concat([data,Buffer.alloc(padding,32)]);
 const header=Buffer.alloc(20);header.writeUInt32LE(0x46546c67);header.writeUInt32LE(2,4);header.writeUInt32LE(28+chunk.length+binary.length,8);header.writeUInt32LE(chunk.length,12);header.writeUInt32LE(0x4e4f534a,16);
 const binHeader=Buffer.alloc(8);binHeader.writeUInt32LE(binary.length);binHeader.writeUInt32LE(0x004e4942,4);return Buffer.concat([header,chunk,binHeader,binary]);
}
const manifest=[];
for(const spec of config.avatars){
 const bodyBytes=await readFile(`${prep}/bodies/${spec.id}.glb`);
 const {json:body,binary:bodyBin}=decodeGlb(bodyBytes);
 let {json:part,binary:partBin}=spec.anatomy===false?
  {json:Object.fromEntries(['bufferViews','accessors','images','samplers','textures','materials','meshes','nodes'].map(key=>[key,[]])),binary:Buffer.alloc(0)}:
  decodeGlb(await readFile(`${mesh?prep:'../.local-tools/artist-prep'}/parts/${spec.id}.glb`));
 if(part.animations?.length||part.images?.some(image=>image.uri))throw Error('Parts must be self-contained with no replacement animations');
 if(contact)partBin=addGripMorph(part,partBin,AVATAR_CONTACTS[spec.id]??{});
 const remapped=new Set();
 for(const node of part.nodes){
  if(node.skin===undefined)continue;
  const lookup=part.skins[node.skin].joints.map(index=>{
   const name=part.nodes[index].name,found=body.skins[0].joints.findIndex(j=>body.nodes[j].name===name);
   if(found<0)throw Error('Unknown outfit joint '+name);return found;
  });
  for(const primitive of part.meshes[node.mesh].primitives){
   const index=primitive.attributes.JOINTS_0;if(remapped.has(index))continue;remapped.add(index);
   const accessor=part.accessors[index],view=part.bufferViews[accessor.bufferView],size=accessor.componentType===5121?1:accessor.componentType===5123?2:0;
   if(!size)throw Error('Unexpected joint component type');
   const stride=view.byteStride??size*4,start=(view.byteOffset??0)+(accessor.byteOffset??0);
   for(let i=0;i<accessor.count;i++)for(let j=0;j<4;j++){
    const at=start+i*stride+j*size,value=size===1?partBin.readUInt8(at):partBin.readUInt16LE(at),mapped=lookup[value];
    if(mapped===undefined)throw Error('Invalid source joint index');
    size===1?partBin.writeUInt8(mapped,at):partBin.writeUInt16LE(mapped,at);
   }
   delete accessor.min;delete accessor.max;
  }
 }
 const originalAnimation=animationDigest(body,bodyBin),offset={};
 for(const key of ['bufferViews','accessors','images','samplers','textures','materials','meshes','nodes']){body[key]??=[];offset[key]=body[key].length;}
 body.bufferViews.push(...part.bufferViews.map(view=>({...view,buffer:0,byteOffset:(view.byteOffset??0)+bodyBin.length})));
 body.accessors.push(...part.accessors.map(a=>({...a,bufferView:a.bufferView===undefined?undefined:a.bufferView+offset.bufferViews})));
 body.images.push(...part.images.map(image=>({...image,bufferView:image.bufferView+offset.bufferViews})));
 body.samplers.push(...part.samplers??[]);
 body.textures.push(...part.textures.map(texture=>({...texture,source:texture.source+offset.images,sampler:texture.sampler===undefined?undefined:texture.sampler+offset.samplers})));
 function materialTextures(value){for(const [key,item] of Object.entries(value)){if(!item||typeof item!=='object')continue;
   if(key.endsWith('Texture')&&typeof item.index==='number')item.index+=offset.textures;else materialTextures(item);}
  return value;
 }
 body.materials.push(...part.materials.map(materialTextures));
 body.meshes.push(...part.meshes.map(mesh=>({...mesh,primitives:mesh.primitives.map(p=>({...p,
  attributes:Object.fromEntries(Object.entries(p.attributes).map(([name,index])=>[name,index+offset.accessors])),
  targets:p.targets?.map(target=>Object.fromEntries(Object.entries(target).map(([name,index])=>[name,index+offset.accessors]))),
  indices:p.indices===undefined?undefined:p.indices+offset.accessors,material:p.material===undefined?undefined:p.material+offset.materials}))})));
 body.nodes.push(...part.nodes.map(node=>({...node,skin:node.skin===undefined?undefined:0,children:node.children?.map(index=>index+offset.nodes),mesh:node.mesh===undefined?undefined:node.mesh+offset.meshes})));
 let attachments=0;
 for(const [index,source] of part.nodes.entries()){
  if(!source.extras?.anatomyTarget)continue;
  const node=body.nodes[index+offset.nodes],target=node.extras?.anatomyTarget;
  const bone=body.nodes.slice(0,offset.nodes).find(n=>target==='Outfit'?n.extras?.avatarPart==='outfit':n.name===target);
  if(!bone)throw Error('Missing anatomy target '+target);
  // Blender may parent a reimported skin under its source armature. Move the node,
  // preserving the single-parent tree required by glTF and stricter importers.
  for(const parent of body.nodes)if(parent.children)parent.children=parent.children.filter(child=>child!==index+offset.nodes);
  bone.children??=[];bone.children.push(index+offset.nodes);attachments++;
 }
 const root=body.nodes.find(node=>node.extras?.avatarPart==='avatar-root');
 root.extras={...root.extras,artRevision:config.version,postureRevision:stance?1:undefined,motionProfile:spec.motion,meshProfile:spec.mesh,
  anatomyAuthor:spec.anatomy===false?undefined:'Quaternius',anatomyLicense:spec.anatomy===false?undefined:'CC0-1.0',authoredAnatomy:spec.anatomy!==false};
 for(const key of ['extensionsUsed','extensionsRequired'])if(body[key]||part[key])body[key]=[...new Set([...(body[key]??[]),...(part[key]??[])])];
 const binary=Buffer.concat([bodyBin,partBin]);body.buffers=[{byteLength:binary.length}];
 const parents=new Set();for(const node of body.nodes)for(const child of node.children??[]){if(parents.has(child))throw Error('GLB node has multiple parents: '+child);parents.add(child);}
 if(animationDigest(body,binary)!==originalAnimation)throw Error('Animation changed while merging');
 const result=encodeGlb(body,binary);await writeFile(`${output}/${spec.id}.glb`,result);
 manifest.push({...spec,file:spec.id+'.glb',bytes:result.length,sha256:createHash('sha256').update(result).digest('hex'),animationSha256:originalAnimation,attachments,
  images:body.images.length,meshes:body.meshes.length,joints:body.skins[0].joints.length,clips:body.animations.map(a=>a.name)});
}
await writeFile(output+'/manifest.json',JSON.stringify({version:config.version,date:'2026-10-17',units:'meters',worldUnitsPerMeter:40,anatomyAuthor:'Quaternius',anatomyLicense:'CC0-1.0',avatars:manifest},null,2)+'\n');
console.log(JSON.stringify({models:manifest.length,bytes:manifest.reduce((sum,row)=>sum+row.bytes,0),output}));
