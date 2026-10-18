import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import * as THREE from '../../EsportsClash.Web/node_modules/three/build/three.module.js';

export const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const sizes = {5120:1,5121:1,5122:2,5123:2,5125:4,5126:4};
const widths = {SCALAR:1,VEC2:2,VEC3:3,VEC4:4,MAT4:16};
const getters = {5120:'readInt8',5121:'readUInt8',5122:'readInt16LE',5123:'readUInt16LE',5125:'readUInt32LE',5126:'readFloatLE'};

export class AvatarGLB {
  constructor(bytes) {
    assert.ok(bytes.length <= 80 * 1024 * 1024 && bytes.readUInt32LE(0) === 0x46546c67);
    assert.equal(bytes.readUInt32LE(4), 2); assert.equal(bytes.readUInt32LE(8), bytes.length);
    assert.equal(bytes.readUInt32LE(16), 0x4e4f534a);
    const length = bytes.readUInt32LE(12), offset = 20 + length;
    this.json = JSON.parse(bytes.subarray(20, offset).toString());
    assert.equal(bytes.readUInt32LE(offset + 4), 0x004e4942);
    this.bin = Buffer.from(bytes.subarray(offset + 8, offset + 8 + bytes.readUInt32LE(offset)));
    assert.equal(this.json.buffers.length, 1); assert.ok(!this.json.buffers[0].uri);
    assert.ok(!(this.json.images ?? []).some(image => image.uri), 'Embedded textures required');
    assert.ok(!(this.json.extensionsRequired ?? []).some(x => /draco|meshopt/i.test(x)), 'Compressed sources require a reviewed decoder');
  }
  values(index) {
    const a = this.json.accessors[index]; assert.ok(a && !a.sparse);
    const view = this.json.bufferViews[a.bufferView], count = widths[a.type], size = sizes[a.componentType];
    assert.ok(view && count && size && (view.buffer ?? 0) === 0);
    const offset = (view.byteOffset ?? 0) + (a.byteOffset ?? 0), stride = view.byteStride ?? count * size;
    assert.ok(stride >= count * size && offset + Math.max(0,a.count-1)*stride+count*size <= this.bin.length);
    return Array.from({length:a.count}, (_, i) => Array.from({length:count}, (_, c) => this.bin[getters[a.componentType]](offset+i*stride+c*size)));
  }
  append(values, type) {
    const flat = values.flat(), bytes = Buffer.alloc(flat.length*4), width=widths[type];
    flat.forEach((value,i)=>{assert.ok(Number.isFinite(value));bytes.writeFloatLE(value,i*4);});
    const padding = Buffer.alloc((4-this.bin.length%4)%4), offset=this.bin.length+padding.length;
    this.bin=Buffer.concat([this.bin,padding,bytes]);
    const view=this.json.bufferViews.push({buffer:0,byteOffset:offset,byteLength:bytes.length})-1;
    const accessor={bufferView:view,componentType:5126,count:values.length,type};
    if(type==='VEC3') { accessor.min=Array.from({length:width},(_,c)=>values.reduce((n,v)=>Math.min(n,v[c]),Infinity));accessor.max=Array.from({length:width},(_,c)=>values.reduce((n,v)=>Math.max(n,v[c]),-Infinity)); }
    return this.json.accessors.push(accessor)-1;
  }
  bytes() {
    this.json.buffers[0].byteLength=this.bin.length;
    let json=Buffer.from(JSON.stringify(this.json));json=Buffer.concat([json,Buffer.alloc((4-json.length%4)%4,32)]);
    const bin=Buffer.concat([this.bin,Buffer.alloc((4-this.bin.length%4)%4)]), header=Buffer.alloc(20), chunk=Buffer.alloc(8);
    header.writeUInt32LE(0x46546c67);header.writeUInt32LE(2,4);header.writeUInt32LE(28+json.length+bin.length,8);
    header.writeUInt32LE(json.length,12);header.writeUInt32LE(0x4e4f534a,16);chunk.writeUInt32LE(bin.length);chunk.writeUInt32LE(0x004e4942,4);
    return Buffer.concat([header,json,chunk,bin]);
  }
  signature() {
    const j=this.json;
    return {rig:sha(JSON.stringify({skins:j.skins,nodes:j.nodes.map(n=>({name:n.name,children:n.children,matrix:n.matrix,translation:n.translation,rotation:n.rotation,scale:n.scale,skin:n.skin}))})),
      timing:sha(JSON.stringify(j.animations.map(a=>({name:a.name,channels:a.channels.map(c=>({target:c.target,input:this.values(a.samplers[c.sampler].input),interpolation:a.samplers[c.sampler].interpolation}))})))),
      root_motion:sha(JSON.stringify(j.animations.map(a=>a.channels.filter(c=>c.target.path==='translation'||/^(Root|Hips)$/.test(j.nodes[c.target.node].name??'')).map(c=>this.values(a.samplers[c.sampler].output))))),
      textures:sha(Buffer.concat((j.images??[]).map(image=>{const v=j.bufferViews[image.bufferView];return this.bin.subarray(v.byteOffset??0,(v.byteOffset??0)+v.byteLength);}))),
      palette:sha(JSON.stringify(j.materials.map(m=>m.pbrMetallicRoughness?.baseColorFactor))),
      topology:sha(JSON.stringify(j.meshes.map(m=>m.primitives.map(p=>({mode:p.mode,indices:p.indices,skin:p.attributes.JOINTS_0,weights:p.attributes.WEIGHTS_0,targets:p.targets})))))};
  }
  analyze(meta) {
    const j=this.json, matrices=[], parents=new Map();j.nodes.forEach((n,i)=>(n.children??[]).forEach(c=>parents.set(c,i)));
    const world=i=>{if(matrices[i])return matrices[i];const n=j.nodes[i],m=new THREE.Matrix4();
      if(n.matrix)m.fromArray(n.matrix);else m.compose(new THREE.Vector3(...(n.translation??[0,0,0])),new THREE.Quaternion(...(n.rotation??[0,0,0,1])),new THREE.Vector3(...(n.scale??[1,1,1])));
      if(parents.has(i))m.premultiply(world(parents.get(i)));return matrices[i]=m;};
    const parts=[], all=new THREE.Box3();let vertices=0,triangles=0,degenerate=0;
    j.nodes.forEach((node,index)=>{if(node.mesh===undefined)return;const box=new THREE.Box3();
      for(const p of j.meshes[node.mesh].primitives){const points=this.values(p.attributes.POSITION);vertices+=points.length;
        points.forEach(v=>{assert.ok(v.every(Number.isFinite));box.expandByPoint(new THREE.Vector3(...v).applyMatrix4(world(index)));});
        const indices=p.indices===undefined?points.map((_,i)=>i):this.values(p.indices).flat();
        assert.ok(indices.every(i=>Number.isInteger(i)&&i>=0&&i<points.length));triangles+=Math.floor(indices.length/3);
        for(let i=0;i+2<indices.length;i+=3){const a=new THREE.Vector3(...points[indices[i]]),b=new THREE.Vector3(...points[indices[i+1]]),c=new THREE.Vector3(...points[indices[i+2]]);if(b.sub(a).cross(c.sub(a)).lengthSq()<1e-16)degenerate++;}
      }
      all.union(box);parts.push({name:node.name??'unnamed',anatomy:node.extras?.anatomyTarget??null,size:box.getSize(new THREE.Vector3()).toArray(),min:box.min.toArray(),max:box.max.toArray()});
    });
    const joint=name=>{const i=j.nodes.findIndex(n=>n.name===name);return i<0?undefined:new THREE.Vector3().setFromMatrixPosition(world(i));};
    const length=(a,b)=>joint(a)&&joint(b)?joint(a).distanceTo(joint(b)):null;
    const heads=parts.filter(p=>p.anatomy==='Head'||/face-topology/.test(p.name)),head=new THREE.Box3();heads.forEach(p=>head.union(new THREE.Box3(new THREE.Vector3(...p.min),new THREE.Vector3(...p.max))));
    const size=all.getSize(new THREE.Vector3()).toArray(),issues=[];
    if(degenerate)issues.push({kind:'degenerate-triangles',count:degenerate,severity:'review',meaning:'Includes tiny decorative faces; not an artistic score.'});
    const missing=['Idle','Walk','Run','Strafe','Attack','Cast','Hit','Death','TurnLeft','TurnRight'].filter(name=>!j.animations.some(a=>a.name===name));
    if(missing.length)issues.push({kind:'missing-clips',clips:missing,severity:'error'});
    const boneCount=new Set(j.skins.flatMap(s=>s.joints)).size;
    return {avatar_id:meta.id,display_name:meta.name,body_archetype:meta.design.body,identity:meta.design,
      scope:'Bind-pose geometry measurements; posed motion/overlap and renderer costs are measured separately.',
      bounds:{min:all.min.toArray(),max:all.max.toArray(),size},head_to_full_visual_height:heads.length?head.getSize(new THREE.Vector3()).y/size[1]:null,
      shoulder_width:length('UpperArmL','UpperArmR'),left_arm_length:[length('UpperArmL','ForearmL'),length('ForearmL','HandL')],
      left_leg_length:[length('ThighL','CalfL'),length('CalfL','FootL')],parts,
      palette:j.materials.map(m=>m.pbrMetallicRoughness?.baseColorFactor??[1,1,1,1]),
      materials:j.materials.map(m=>({roughness:m.pbrMetallicRoughness?.roughnessFactor??1,metalness:m.pbrMetallicRoughness?.metallicFactor??1,textured:m.pbrMetallicRoughness?.baseColorTexture!==undefined})),
      performance:{vertices,triangles,mesh_nodes:parts.length,materials:j.materials.length,textures:(j.images??[]).length},
      rig:{unique_joints:boneCount,skins:j.skins.length,clips:j.animations.map(a=>({name:a.name,channels:a.channels.length,duration:Math.max(...a.samplers.map(s=>this.values(s.input).at(-1)?.[0]??0))}))},issues,
      limitations:['Artistic quality requires human comparison.','Body-part boxes identify potential overlap, not exact mesh intersection.','Head/body ratio includes visual equipment in full bounds.']};
  }
  mutate(meta, recipe, strength=.06) {
    assert.ok(['silhouette','equipment','motion'].includes(recipe)&&strength>=.025&&strength<=.09);
    const changed=[],before=this.signature(),j=this.json;
    const names=new Map();j.nodes.forEach(n=>{if(n.mesh!==undefined)names.set(n.mesh,n.name??'');});
    j.meshes.forEach((mesh,index)=>{const name=names.get(index)??'';
      const merged=meta.id==='c_invoker'&&/^arsenaldo-surface-/.test(name);
      const body=merged||/tailored-torso|creature-hull|contoured-breastplate|artist.*Outfit/.test(name);
      const gear=merged||(/pauldron|bracer|breastplate|draped-cape|blade|wing-membrane|carapace|hull|ridge|horn|fin-/.test(name)&&!/handle|string|arrow|socket|muzzle/.test(name));
      if(!(recipe==='equipment'?gear:body))return;
      for(const p of mesh.primitives){if(p.mode!==undefined&&p.mode!==4)continue;
        const points=this.values(p.attributes.POSITION),bounds=new THREE.Box3();points.forEach(v=>bounds.expandByPoint(new THREE.Vector3(...v)));
        const center=bounds.getCenter(new THREE.Vector3()),height=Math.max(.001,bounds.max.y-bounds.min.y),gain=recipe==='motion'?strength*.35:strength;
        const next=points.map(([x,y,z])=>{if(merged&&(y<31||y>57||Math.abs(x)>meta.design.width*1.15))return[x,y,z];
          const t=merged?(y-31)/26:(y-bounds.min.y)/height, chest=Math.exp(-(((t-.72)/.26)**2)),waist=Math.exp(-(((t-.22)/.22)**2));
          const factor=recipe==='equipment'?1+gain*(/cape/.test(name)?1-t:1):1+gain*(chest-.45*waist);
          return [center.x+(x-center.x)*factor,y,center.z+(z-center.z)*(1+gain*.45*chest)];});
        if(!next.some((v,i)=>v.some((x,c)=>Math.abs(x-points[i][c])>1e-8)))continue;
        const indices=p.indices===undefined?next.map((_,i)=>i):this.values(p.indices).flat(),normals=next.map(()=>new THREE.Vector3());
        for(let i=0;i+2<indices.length;i+=3){const [ia,ib,ic]=indices.slice(i,i+3),a=new THREE.Vector3(...next[ia]),b=new THREE.Vector3(...next[ib]),c=new THREE.Vector3(...next[ic]),normal=b.sub(a).cross(c.sub(a));for(const n of [ia,ib,ic])normals[n].add(normal);}
        p.attributes.POSITION=this.append(next,'VEC3');p.attributes.NORMAL=this.append(normals.map(n=>n.normalize().toArray()),'VEC3');
        changed.push({kind:'geometry',part:name,vertices:points.length,reason:recipe==='equipment'?'Clarify armor/equipment layers and preserve attachment roots.':'Bounded chest/waist cross-section changes preserve the rig and stature.'});
      }
    });
    if(recipe==='motion')for(const clip of j.animations){if(!/Attack|Cast|Hit|Turn/.test(clip.name))continue;
      for(const channel of clip.channels){const node=j.nodes[channel.target.node],sampler=clip.samplers[channel.sampler];
        if(channel.target.path!=='rotation'||!/^(Chest|Spine|UpperArm[LR])$/.test(node.name??'')||sampler.interpolation==='CUBICSPLINE')continue;
        const rest=new THREE.Quaternion(...(node.rotation??[0,0,0,1]));
        const next=this.values(sampler.output).map(v=>new THREE.Quaternion().slerpQuaternions(rest,new THREE.Quaternion(...v),1+strength*.7).normalize().toArray());
        sampler.output=this.append(next,'VEC4');changed.push({kind:'animation',clip:clip.name,joint:node.name,reason:'Refine torso/upper-arm anticipation and follow-through amplitudes; key times and root motion remain fixed.'});
      }
    }
    // Material separation changes surface response, preserving every palette color and texture.
    j.materials.forEach((m,index)=>{const p=m.pbrMetallicRoughness;if(!p)return;const old=p.roughnessFactor??1;
      p.roughnessFactor=Math.max(.24,Math.min(.94,old+((p.metallicFactor??0)>.4?-1:1)*strength*.45));
      if(old!==p.roughnessFactor)changed.push({kind:'material',index,from:old,to:p.roughnessFactor,reason:'Separate metallic highlights from cloth/organic surfaces.'});});
    assert.ok(changed.some(c=>c.kind==='geometry'||c.kind==='animation'),'No meaningful compatible edit');
    const visual={version:1,facet_count:recipe==='motion'?5:3,trail_segments:recipe==='motion'?5:3,accent_height:recipe==='equipment'?5:3,
      motif:meta.motif,ability_identity:meta.abilities.map(a=>a.name),scope:'Decorative particles within existing event lifetime and footprint; no gameplay events.'};
    const root=j.nodes.find(n=>n.extras?.avatarPart==='avatar-root');assert.ok(root);
    root.extras={...root.extras,avatarEvolution:{version:1,recipe,strength,visual}};
    const after=this.signature();for(const key of ['rig','timing','root_motion','textures','palette','topology'])assert.equal(after[key],before[key],key+' changed');
    return {changed,visual,preservation:after,recipe,strength};
  }
}
