import assert from 'node:assert/strict';
import {deflateSync} from 'node:zlib';
import {readFile} from 'node:fs/promises';
import {AvatarGLB,sha} from './glb.mjs';

export const profiles=JSON.parse(await readFile(new URL('./art-profiles.json',import.meta.url),'utf8'));
const crcTable=Array.from({length:256},(_,n)=>{for(let k=0;k<8;k++)n=n&1?0xedb88320^(n>>>1):n>>>1;return n>>>0;});
const crc=bytes=>{let n=0xffffffff;for(const b of bytes)n=crcTable[(n^b)&255]^(n>>>8);return (n^0xffffffff)>>>0;};
function chunk(type,data){const name=Buffer.from(type),length=Buffer.alloc(4),checksum=Buffer.alloc(4);length.writeUInt32BE(data.length);checksum.writeUInt32BE(crc(Buffer.concat([name,data])));return Buffer.concat([length,name,data,checksum]);}
function png(side,pixel){const raw=Buffer.alloc((side*3+1)*side);for(let y=0;y<side;y++)for(let x=0;x<side;x++){
  const value=pixel((x+.5)/side,(y+.5)/side);for(let c=0;c<3;c++)raw[y*(side*3+1)+1+x*3+c]=Math.round(Math.max(0,Math.min(255,value[c])));
}const header=Buffer.alloc(13);header.writeUInt32BE(side);header.writeUInt32BE(side,4);header[8]=8;header[9]=2;
return Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]),chunk('IHDR',header),chunk('IDAT',deflateSync(raw,{level:9})),chunk('IEND',Buffer.alloc(0))]);}
const wave=(value,count)=>Math.cos(value*count*Math.PI*2);
const height=(kind,u,v)=>{
  if(kind==='brocade')return .35*wave(u+v,9)*wave(u-v,9)+.045*wave(u,96)*wave(v,96);
  if(kind==='velvet')return .1*wave(u,112)*wave(v,7)+.22*Math.exp(-(((Math.abs(Math.sin(u*Math.PI*6))-.35)/.08)**2))*wave(v,4);
  if(kind==='engraved-brass')return .38*Math.exp(-((Math.sin((u+v)*Math.PI*12)/.14)**2))+.15*wave(u-v,6);
  return .12*wave(u,70)*wave(v,71)+.4*Math.exp(-((Math.sin(u*Math.PI*8)/.07)**2))*Math.max(0,wave(v,25));
};
const imageHashes=g=>(g.json.images??[]).map(image=>{const v=g.json.bufferViews[image.bufferView];return sha(g.bin.subarray(v.byteOffset??0,(v.byteOffset??0)+v.byteLength));});
function addImage(g,bytes,name){const pad=Buffer.alloc((4-g.bin.length%4)%4),offset=g.bin.length+pad.length;g.bin=Buffer.concat([g.bin,pad,bytes]);
  const bufferView=g.json.bufferViews.push({buffer:0,byteOffset:offset,byteLength:bytes.length})-1;
  const source=(g.json.images??=[]).push({bufferView,mimeType:'image/png',name})-1;
  const sampler=(g.json.samplers??=[]).push({magFilter:9729,minFilter:9987,wrapS:10497,wrapT:10497})-1;
  return (g.json.textures??=[]).push({source,sampler})-1;
}

/** Findings describe concrete missing material channels, not a beauty score. */
export function analyzeArt(bytes,meta){
  const g=new AvatarGLB(bytes),profile=profiles.profiles[meta.id],issues=[];
  if(!profile)return {supported:false,issues:[],reason:'No qualified character-specific production profile. Preserve current model.'};
  for(const [component,spec]of Object.entries(profile.components)){
    const nodes=g.json.nodes.filter(n=>spec.nodes.includes(n.name));
    if(nodes.length!==spec.nodes.length){issues.push({id:`${component}:missing-component`,component,kind:'unsupported-component',generatable:false});continue;}
    let validUV=true;
    for(const node of nodes)for(const primitive of g.json.meshes[node.mesh].primitives){
      const uv=primitive.attributes.TEXCOORD_0;
      if(uv===undefined||!g.values(uv).every(v=>v.length===2&&v.every(Number.isFinite)))validUV=false;
    }
    if(!validUV){issues.push({id:`${component}:uv-invalid`,component,kind:'invalid-uv',generatable:false});continue;}
    const missing=spec.materials.filter(i=>!g.json.materials[i]?.normalTexture||!g.json.materials[i]?.pbrMetallicRoughness?.baseColorTexture);
    if(missing.length)issues.push({id:`${component}:surface-detail`,component,kind:'missing-surface-detail-maps',generatable:true,
      evidence:{material_indices:missing,missing_normal_or_albedo_maps:true},remedy:`Generate ${spec.finish} albedo, tangent normal and roughness/metallic detail on existing UVs.`});
  }
  return {supported:true,profile,profile_hash:sha(JSON.stringify(profile)),issues,
    limits:['Missing material channels are a technical opportunity, not proof of ugly art.','No humanoid reconstruction, skin replacement or invented weapon.','Do not generate when no supported unresolved issue exists.']};
}

export function finishArt(bytes,meta,requested,variant=0){
  assert.equal(meta.id,profiles.pilot,'Only the qualified Arsenaldo pilot is enabled');
  const g=new AvatarGLB(bytes),before=g.signature(),oldImages=imageHashes(g),analysis=analyzeArt(bytes,meta);
  const allowed=analysis.issues.filter(i=>i.generatable).map(i=>i.component);
  const components=[...new Set(requested)];assert.ok(components.length&&components.every(c=>allowed.includes(c)),'Only unresolved profiled components may be generated');
  assert.ok(Number.isInteger(variant)&&variant>=0&&variant<5);
  const changes=[],maps=[];
  for(const component of components){const spec=analysis.profile.components[component],side=component==='brocade'?512:256;
    const strength=.7+variant*.06,metal=component==='brass';
    const albedo=png(side,(u,v)=>{const h=height(spec.finish,u,v),t=1-Math.max(0,h)*.16*strength;return [255*t,255*t,255*t];});
    const normal=png(side,(u,v)=>{const e=1/side,x=(height(spec.finish,u+e,v)-height(spec.finish,u-e,v))*.65*strength,
      y=(height(spec.finish,u,v+e)-height(spec.finish,u,v-e))*.65*strength,l=Math.hypot(x,y,1);return [128-x/l*127,128-y/l*127,128+127/l];});
    const roughness=png(side,(u,v)=>[255,(metal?.32:component==='leather'?.7:.83)*255+height(spec.finish,u,v)*16,metal?184:10]);
    const textures=[albedo,normal,roughness].map((data,i)=>addImage(g,data,`arsenaldo-${component}-${['albedo','normal','orm'][i]}-v1`));
    for(const index of spec.materials){const m=g.json.materials[index],p=m.pbrMetallicRoughness;
      p.baseColorTexture={index:textures[0]};p.metallicRoughnessTexture={index:textures[2]};p.roughnessFactor=1;p.metallicFactor=1;
      m.normalTexture={index:textures[1],scale:spec.normal_scale};m.extras={...m.extras,artFinish:{version:1,component,method:'original-uv-surface-finishing'}};
    }
    maps.push({component,width:side,height:side,maps:3,memory_mib:side*side*4*3*4/3/1048576,sha256:[albedo,normal,roughness].map(sha)});
    changes.push({kind:'texture',part:component,reason:`Original ${spec.finish} weave/engraving with albedo, tangent normals and ORM, using the existing palette and UVs.`});
    // Optional shallow relief refines the existing connected brass surfaces. No
    // added primitive, retopology, new joint, weight transfer or attachment drift.
    if(component==='brass'&&variant%2===1)for(const node of g.json.nodes.filter(n=>spec.nodes.includes(n.name))){
      for(const primitive of g.json.meshes[node.mesh].primitives){const positions=g.values(primitive.attributes.POSITION),normals=g.values(primitive.attributes.NORMAL),uv=g.values(primitive.attributes.TEXCOORD_0);
        const next=positions.map((p,i)=>{const [u,v]=uv[i],edge=Math.min(u,1-u,v,1-v),taper=Math.max(0,Math.min(1,edge*12));
          const relief=height(spec.finish,u,v)*.045*taper;return p.map((n,c)=>n+normals[i][c]*relief);});
        primitive.attributes.POSITION=g.append(next,'VEC3');
        changes.push({kind:'geometry',part:node.name,vertices:next.length,max_relief:.045,reason:'Shallow engraved relief on existing armor surfaces; attachment roots, topology, skin weights and silhouette retained.'});
      }
    }
  }
  const root=g.json.nodes.find(n=>n.extras?.avatarPart==='avatar-root');assert.ok(root);
  const visual={version:1,facet_count:0,trail_segments:6,accent_height:0,ability_style:{version:1,theme:'ice-wind-fire',pulse:.12,trail_taper:.55,
    preparation:false,confirmed_impacts_only:true,max_extra_draws:0,warning_geometry_unchanged:true}};
  root.extras={...root.extras,avatarEvolution:{version:2,recipe:'problem-driven-surface-finishing',components,visual,profile_hash:analysis.profile_hash}};
  const after=g.signature();for(const key of ['rig','timing','root_motion','palette','topology'])assert.equal(after[key],before[key],key+' changed');
  assert.deepEqual(imageHashes(g).slice(0,oldImages.length),oldImages,'Original licensed texture bytes must remain intact');
  return {bytes:g.bytes(),changed:changes,visual,preservation:after,recipe:'surface-finishing',strength:0,
    components,texture_maps:maps,issues_addressed:analysis.issues.filter(i=>components.includes(i.component)).map(i=>i.id),
    added_texture_mib:maps.reduce((n,m)=>n+m.memory_mib,0),provider:'local-procedural-material-and-mesh-finishing'};
}

export function silhouetteIoU(a,b){
  if(!a?.mask_runs||!b?.mask_runs||JSON.stringify(a.canvas)!==JSON.stringify(b.canvas))return 0;
  let i=0,j=0,intersection=0;const x=a.mask_runs,y=b.mask_runs;
  while(i<x.length&&j<y.length){intersection+=Math.max(0,Math.min(x[i+1],y[j+1])-Math.max(x[i],y[j]));if(x[i+1]<y[j+1])i+=2;else j+=2;}
  return intersection/Math.max(1,a.occupied_pixels+b.occupied_pixels-intersection);
}

export function technicalImprovement(baseline,candidate,profile){
  const reasons=[],r=candidate.render,b=baseline.render;
  if(!candidate.validation.passed||!r?.passed)reasons.push('Compatibility validation failed');
  if(!r?.gameplay?.passed||r?.shader_errors?.length)reasons.push('Gameplay-scale appearance or shader validation failed');
  if(!(r?.textures?.detailed_materials>0)||r.textures.missing_detail_maps!==0)reasons.push('Generated detail maps were not verified in the actual renderer');
  if(!Number.isFinite(r?.worker_memory?.anonymous_mib)||r.worker_memory.anonymous_mib>1100)reasons.push('Actual worker/preview RAM budget unavailable or exceeded');
  if(!candidate.issues_addressed?.length)reasons.push('No measured supported issue was addressed');
  if(candidate.analysis.performance.triangles>Math.min(profile.budgets.max_triangles,baseline.analysis.performance.triangles))reasons.push('Triangle count increased');
  if(candidate.analysis.performance.materials>baseline.analysis.performance.materials)reasons.push('Material count increased');
  if(candidate.added_texture_mib>profile.budgets.max_added_texture_mib)reasons.push('Texture memory budget exceeded');
  if(r?.renderer.draw_calls>b.renderer.draw_calls)reasons.push('Draw calls increased');
  if(r?.planted_foot_step_drift>b.planted_foot_step_drift+.001||r?.blend_hand_step_jump>b.blend_hand_step_jump+.001)reasons.push('Animation contacts or transitions worsened');
  if(candidate.blender.bind_pose_intersection_pairs>baseline.blender.bind_pose_intersection_pairs)reasons.push('Bind-pose clipping proxy worsened');
  if(r?.renderer.mean_frame_ms>b.renderer.mean_frame_ms*(1+profile.budgets.max_frame_regression_fraction))reasons.push('Measured local frame cost exceeded the regression allowance');
  for(let i=0;i<(r?.views.length??0);i++){
    const ratio=r.views[i].silhouette.occupied_pixels/Math.max(1,b.views[i].silhouette.occupied_pixels);
    if(ratio<.98||ratio>1.02||r.views[i].silhouette.clipped)reasons.push('Silhouette occupancy changed beyond tolerance');
    if(silhouetteIoU(r.views[i].silhouette,b.views[i].silhouette)<profile.budgets.min_silhouette_iou)reasons.push('Silhouette pixel overlap degraded');
    for(let channel=0;channel<3;channel++){
      const ratio=r.views[i].silhouette.mean_rgb?.[channel]/Math.max(1,b.views[i].silhouette.mean_rgb?.[channel]);
      if(!Number.isFinite(ratio)||ratio<.85||ratio>1.1)reasons.push('Rendered palette brightness changed beyond identity allowance');
    }
  }
  return {qualifies:!reasons.length,reasons:[...new Set(reasons)],issues_addressed:candidate.issues_addressed??[],
    measurements:{silhouette_iou:r?.views.map((view,i)=>silhouetteIoU(view.silhouette,b.views[i].silhouette)),
      frame_cost_ratio:r?.renderer.mean_frame_ms/b.renderer.mean_frame_ms,
      bind_pose_intersection_delta:candidate.blender.bind_pose_intersection_pairs-baseline.blender.bind_pose_intersection_pairs,
      added_texture_mib:candidate.added_texture_mib},
    meaning:'Resolves a profiled missing surface-detail capability within strict compatibility and cost gates. This is not objective artistic superiority.',
    score:candidate.issues_addressed?.length??0};
}
