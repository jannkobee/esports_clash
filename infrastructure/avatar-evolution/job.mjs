import {readFile,writeFile,rename,readdir,open} from 'node:fs/promises';
import {join,basename} from 'node:path';
import {spawn} from 'node:child_process';
import assert from 'node:assert/strict';
import {AvatarGLB,sha} from './glb.mjs';
import {inspect} from './browser.mjs';

const folder=process.argv[2],plan=JSON.parse(await readFile(join(folder,'plan.json'),'utf8'));
const meta=plan.avatar,sourceRoot='/workspace/EsportsClash.Web/public/models',artifacts=process.env.AVATAR_DATA??'/avatar-data';
const atomic=async(file,value)=>{await writeFile(file+'.tmp',JSON.stringify(value,null,2));await rename(file+'.tmp',file);};
const report={engine:'constrained-avatar-evolution-v1',avatar:meta,stage:'analysis',candidates:[],generations:[],
  external_ai:false,automatic_publish:false,approval_required:true,
  artistic_quality:'Human comparison required. Technical ranking is not an aesthetic score.'};
const state=async(status='running',extra={})=>atomic(join(folder,'state.json'),{status,report,...extra});
async function blender(file) {
  const output=file.replace('.glb','-blender.json'),log=await open(join(folder,'blender.log'),'a');
  try{await new Promise((resolve,reject)=>{
    const child=spawn('blender',['--background','--factory-startup','--disable-autoexec','--threads','1','--python-exit-code','1','--python',join(import.meta.dirname,'blender-scene.py'),'--',file,output],{stdio:['ignore',log.fd,log.fd]});
    const timer=setTimeout(()=>child.kill('SIGKILL'),120000);child.once('error',reject);child.once('exit',code=>{clearTimeout(timer);code===0?resolve():reject(Error(`Blender validation exited ${code}`));});
  });}finally{await log.close();}
  return JSON.parse(await readFile(output,'utf8'));
}
function validate(original,baseline,analysis,mutation,render,baseRender,blenderResult,baseBlender) {
  const issues=[];
  if(!render.passed)issues.push(...render.issues,'Actual renderer validation failed');
  if(analysis.rig.unique_joints!==17)issues.push('Common 17-joint rig missing');
  for(let i=0;i<3;i++){const ratio=analysis.bounds.size[i]/Math.max(.001,original.bounds.size[i]);if(ratio<.88||ratio>1.12)issues.push('Original identity bounds exceeded');}
  if(analysis.performance.triangles>original.performance.triangles*1.05+50)issues.push('Triangle budget exceeded');
  if(render.planted_foot_step_drift>baseRender.planted_foot_step_drift+1)issues.push('Planted-foot drift worsened');
  if(render.blend_hand_step_jump>baseRender.blend_hand_step_jump*1.15+.5)issues.push('Blend discontinuity worsened');
  if(blenderResult.bind_pose_intersection_pairs>baseBlender.bind_pose_intersection_pairs*1.2+25)issues.push('New bind-pose intersections exceed conservative tolerance');
  for(let i=0;i<render.clips.length;i++)for(let k=0;k<render.clips[i].frames.length;k++){
    const frame=render.clips[i].frames[k],base=baseRender.clips[i].frames[k];
    for(let c=0;c<3;c++)if(frame.min[c]<base.min[c]-12||frame.max[c]>base.max[c]+12)issues.push('Posed bounds exceed baseline allowance');
  }
  if(!mutation.changed.some(c=>c.kind==='geometry'||c.kind==='animation'))issues.push('No actual model or curve change');
  return {passed:issues.length===0,issues:[...new Set(issues)],checks:{rig_and_bind_matrices_preserved:true,
    topology_and_skin_weights_preserved:true,palette_and_embedded_textures_preserved:true,key_times_and_root_motion_preserved:true,
    gameplay_stats_and_hitboxes_untouched:true,original_bounds:original.bounds,parent_bounds:baseline.bounds},
    measurements:{foot_step_drift:render.planted_foot_step_drift,blend_step_jump:render.blend_hand_step_jump,
      bind_pose_intersection_pairs:blenderResult.bind_pose_intersection_pairs,triangles:analysis.performance.triangles},
    limitations:['Bind-pose BVH intersections include intentional layers.','Posed clipping uses sampled bounds; human comparison remains required.','No objective artistic-quality score.']};
}
try {
  const manifest=[];
  for(const file of ['glb.mjs','job.mjs','browser.mjs','blender-scene.py','server.mjs'])manifest.push([file,sha(await readFile(join(import.meta.dirname,file)))]);
  for(const file of (await readdir('/workspace/EsportsClash.Web/avatar-review-dist/assets')).sort())manifest.push([file,sha(await readFile(join('/workspace/EsportsClash.Web/avatar-review-dist/assets',file)))]);
  const engineHash=sha(JSON.stringify(manifest));
  try {assert.equal(JSON.parse(await readFile(join(folder,'execution.json'),'utf8')).engine_hash,engineHash,'Frozen engine source changed');}
  catch(error){if(error.code!=='ENOENT')throw error;await atomic(join(folder,'execution.json'),{engine_hash:engineHash,manifest,started_at:new Date().toISOString(),plan_hash:sha(JSON.stringify(plan))});}
  const originalBytes=await readFile(join(sourceRoot,meta.file));assert.equal(sha(originalBytes),plan.original_sha256);
  const parentBytes=plan.parent?await readFile(join(artifacts,plan.parent.run_id,plan.parent.file)):originalBytes;
  if(plan.parent)assert.equal(sha(parentBytes),plan.parent.sha256);
  await writeFile(join(folder,'baseline.glb'),parentBytes);
  const original=new AvatarGLB(originalBytes).analyze(meta),baseline=new AvatarGLB(parentBytes).analyze(meta);
  report.original_analysis=original;report.analysis=baseline;report.engine_hash=engineHash;
  report.source_hash=sha(parentBytes);report.stage='baseline-render';await state();
  const baseBlender=await blender(join(folder,'baseline.glb')),baseRender=await inspect(folder,meta.id,'baseline');
  assert.ok(baseRender.passed,'Baseline failed the actual renderer; preserve original and inspect setup');
  report.baseline={blender:baseBlender,render:baseRender};
  let parent=parentBytes,previousBest=null,nextId=1;
  for(let generation=1;generation<=plan.generations;generation++) {
    const batch=[];
    for(let i=0;i<plan.candidates;i++) {
      const sequence=plan.focus&&plan.focus!=='balanced'?[plan.focus,'silhouette',plan.focus,'equipment','motion']:['silhouette','equipment','motion','silhouette','motion'];
      const id=`candidate-${String(nextId++).padStart(2,'0')}`,recipe=sequence[i%5];
      const strength=Math.min(.09,[.03,.045,.055,.07,.08][i%5]+.003*((plan.revision??1)%3));
      report.stage='candidate-generation';report.current={generation,candidate:id};await state();
      const candidate={id,generation,recipe,strength,file:id+'.glb',validation:{passed:false,issues:[]},render:{passed:false},status:'rejected-technical'};
      try {
        const model=new AvatarGLB(parent),mutation=model.mutate(meta,recipe,strength),bytes=model.bytes();
        const sourceSignature=new AvatarGLB(originalBytes).signature(),candidateSignature=model.signature();
        for(const key of ['rig','timing','root_motion','textures','palette','topology'])assert.equal(candidateSignature[key],sourceSignature[key]);
        await writeFile(join(folder,candidate.file),bytes);candidate.sha256=sha(bytes);candidate.bytes=bytes.length;candidate.changes=mutation.changed;candidate.visual=mutation.visual;
        const analysis=new AvatarGLB(bytes).analyze(meta);report.stage='blender-validation';await state();
        candidate.blender=await blender(join(folder,candidate.file));report.stage='render-animation-validation';await state();
        candidate.render=await inspect(folder,meta.id,id);candidate.analysis=analysis;
        candidate.validation=validate(original,baseline,analysis,mutation,candidate.render,baseRender,candidate.blender,baseBlender);
        candidate.status=candidate.validation.passed?'pending-review':'rejected-technical';
        candidate.technical_penalty=(candidate.validation.passed?0:1000000)+Math.max(0,candidate.render.planted_foot_step_drift-baseRender.planted_foot_step_drift)
          +Math.max(0,candidate.render.blend_hand_step_jump-baseRender.blend_hand_step_jump)+Math.max(0,candidate.blender.bind_pose_intersection_pairs-baseBlender.bind_pose_intersection_pairs)/1000;
        candidate.rank_explanation='Compatibility first, then added planted-foot drift, blend discontinuity and bind-pose intersections. Does not rank beauty.';
      }catch(error){candidate.validation={passed:false,issues:[error.message]};candidate.error=error.message;}
      report.candidates.push(candidate);batch.push(candidate);await state();
    }
    const eligible=batch.filter(c=>c.validation.passed).sort((a,b)=>a.technical_penalty-b.technical_penalty||a.bytes-b.bytes);
    const best=eligible[0];report.generations.push({generation,candidates:batch.map(c=>c.id),best:best?.id??null,
      comparison_target:previousBest===null?'No previous generation':'Previous search generation',
      improved_technical_penalty:previousBest===null?null:!!best&&best.technical_penalty<previousBest});
    if(!best||(previousBest!==null&&best.technical_penalty>=previousBest)){report.stop_reason='Technical criteria plateaued; no automatic artistic judgement';break;}
    previousBest=best.technical_penalty;parent=await readFile(join(folder,best.file));
  }
  const sorted=report.candidates.filter(c=>c.validation.passed).sort((a,b)=>a.technical_penalty-b.technical_penalty||a.bytes-b.bytes);
  sorted.forEach((c,i)=>c.technical_rank=i+1);
  report.stage='review';report.completed_at=new Date().toISOString();report.valid_candidates=sorted.length;
  report.original_fallback_retained=true;
  await atomic(join(folder,'report.json'),report);
  await state('review',{manifest_hash:sha(JSON.stringify(report))});
}catch(error){await state('failed',{error:error.stack});process.exitCode=1;}
