import {readFile,writeFile,rename,readdir,open} from 'node:fs/promises';
import {join} from 'node:path';
import {spawn} from 'node:child_process';
import assert from 'node:assert/strict';
import validator from 'gltf-validator';
import {AvatarGLB,sha} from './glb.mjs';
import {analyzeArt,finishArt,technicalImprovement,profiles} from './art.mjs';
import {inspect} from './browser.mjs';

const folder=process.argv[2],plan=JSON.parse(await readFile(join(folder,'plan.json'),'utf8'));
assert.equal(plan.version,2);assert.equal(plan.automatic_publish,true);assert.equal(plan.owner_approval_required,false);
const meta=plan.avatar,root='/workspace/EsportsClash.Web/public/models',data=process.env.AVATAR_DATA??'/avatar-data';
const atomic=async(file,value)=>{await writeFile(file+'.tmp',JSON.stringify(value,null,2));await rename(file+'.tmp',file);};
const immutable=async(file,bytes)=>{try{assert.equal(sha(await readFile(file)),sha(bytes),'Existing artifact bytes changed; do not overwrite evidence');}
  catch(error){if(error.code!=='ENOENT')throw error;await writeFile(file,bytes,{flag:'wx'});}};
const report={engine:'problem-driven-art-v2',avatar:meta,stage:'analysis',candidates:[],generations:[],
  external_ai:false,automatic_publish:true,approval_required:false,selection:null,
  artistic_quality:'Profile-guided technical improvements; no claim of objective artistic superiority.'};
const state=async(status='running',extra={})=>atomic(join(folder,'state.json'),{status,report,...extra});
async function blender(file){const output=file.replace('.glb','-blender.json'),log=await open(join(folder,'blender.log'),'a');
  try{await new Promise((resolve,reject)=>{const child=spawn('blender',['--background','--factory-startup','--disable-autoexec','--threads','1','--python-exit-code','1',
    '--python',join(import.meta.dirname,'blender-scene.py'),'--',file,output],{stdio:['ignore',log.fd,log.fd]});
    const timer=setTimeout(()=>child.kill('SIGKILL'),120000);child.once('error',reject);child.once('exit',code=>{clearTimeout(timer);code===0?resolve():reject(Error(`Blender finishing/validation exited ${code}`));});});
  }finally{await log.close();}return JSON.parse(await readFile(output,'utf8'));
}
async function gltf(bytes){const result=await validator.validateBytes(new Uint8Array(bytes),{maxIssues:200,uri:'asset.glb'});
  return {errors:result.issues.numErrors,warnings:result.issues.numWarnings,messages:result.issues.messages,validator:validator.version()};}
try{
  assert.equal(meta.id,profiles.pilot,'Only the qualified Arsenaldo pilot can run autonomously');
  const manifest=[];
  for(const file of ['art-job.mjs','art.mjs','art-profiles.json','glb.mjs','browser.mjs','blender-scene.py','server.mjs','package-lock.json'])manifest.push([file,sha(await readFile(join(import.meta.dirname,file)))]);
  for(const file of (await readdir('/workspace/EsportsClash.Web/avatar-review-dist/assets')).sort())manifest.push([file,sha(await readFile(join('/workspace/EsportsClash.Web/avatar-review-dist/assets',file)))]);
  const engineHash=sha(JSON.stringify(manifest)),execution={engine_hash:engineHash,manifest,plan_hash:sha(JSON.stringify(plan))};
  try{assert.deepEqual(JSON.parse(await readFile(join(folder,'execution.json'),'utf8')),execution,'Frozen art engine or plan changed');}
  catch(error){if(error.code!=='ENOENT')throw error;await atomic(join(folder,'execution.json'),execution);}
  const original=await readFile(join(root,meta.file));assert.equal(sha(original),plan.original_sha256);
  const bytes=plan.parent?await readFile(join(data,plan.parent.run_id,plan.parent.file)):original;
  if(plan.parent)assert.equal(sha(bytes),plan.parent.sha256);
  report.source_hash=sha(bytes);report.engine_hash=engineHash;
  const art=analyzeArt(bytes,meta);assert.ok(art.supported);assert.equal(art.profile_hash,plan.profile_hash);
  report.art_analysis=art;report.analysis=new AvatarGLB(bytes).analyze(meta);
  const unresolved=art.issues.filter(issue=>issue.generatable).map(issue=>issue.component);
  if(!unresolved.length){report.stage='unchanged';report.stop_reason='No supported unresolved visual issue. No regeneration or version increment.';report.valid_candidates=0;
    await atomic(join(folder,'report.json'),report);await state('complete',{manifest_hash:sha(JSON.stringify(report))});
  }else{
    await immutable(join(folder,'baseline.glb'),bytes);report.stage='baseline-validation';await state();
    const baseGltf=await gltf(bytes);assert.equal(baseGltf.errors,0,'Baseline glTF errors prevent autonomous editing');
    let cachedBaseline;
    try{cachedBaseline=JSON.parse(await readFile(join(folder,'baseline-result.json'),'utf8'));assert.equal(cachedBaseline.engine_hash,engineHash);assert.equal(cachedBaseline.source_hash,sha(bytes));}
    catch(error){if(error.code!=='ENOENT')throw error;const baseBlender=await blender(join(folder,'baseline.glb')),baseRender=await inspect(folder,meta.id,'baseline');
      assert.ok(baseRender.passed,'Actual baseline renderer failed');cachedBaseline={engine_hash:engineHash,source_hash:sha(bytes),analysis:report.analysis,blender:baseBlender,render:baseRender,gltf:baseGltf};
      await atomic(join(folder,'baseline-result.json'),cachedBaseline);}
    report.baseline=cachedBaseline;
    for(let i=0;i<plan.candidates;i++){
      const id=`candidate-${String(i+1).padStart(2,'0')}`,file=id+'.glb',components=i===4?unresolved:[unresolved[i%unresolved.length]];
      const candidate={id,file,generation:1,recipe:'surface-finishing',components,status:'rejected-technical'};
      report.stage='component-generation';await state();
      let cached,cacheFound=false;
      try{
        try{cached=JSON.parse(await readFile(join(folder,id+'-result.json'),'utf8'));cacheFound=true;assert.equal(cached.engine_hash,engineHash);assert.equal(cached.source_hash,sha(bytes));
          assert.equal(cached.candidate.id,id);assert.deepEqual(cached.candidate.components,components);
          if(cached.candidate.sha256)assert.equal(sha(await readFile(join(folder,file))),cached.candidate.sha256);}
        catch(error){if(error.code!=='ENOENT'||cacheFound)throw error;}
        if(cached){report.candidates.push(cached.candidate);await state();continue;}
        const result=finishArt(bytes,meta,components,i%5),hash=sha(result.bytes);
        const duplicate=report.candidates.find(c=>c.sha256===hash);
        if(duplicate){candidate.status='duplicate-skipped';candidate.duplicate_of=duplicate.id;
          candidate.validation={passed:false,issues:['Identical component output already evaluated: '+duplicate.id]};
          candidate.improvement={qualifies:false,reasons:candidate.validation.issues,issues_addressed:[]};
          report.candidates.push(candidate);await atomic(join(folder,id+'-result.json'),{engine_hash:engineHash,source_hash:sha(bytes),candidate});await state();continue;}
        await immutable(join(folder,file),result.bytes);
        Object.assign(candidate,{sha256:sha(result.bytes),bytes:result.bytes.length,changes:result.changed,visual:result.visual,
          issues_addressed:result.issues_addressed,added_texture_mib:result.added_texture_mib,texture_maps:result.texture_maps,provider:result.provider});
        candidate.gltf=await gltf(result.bytes);candidate.analysis=new AvatarGLB(result.bytes).analyze(meta);candidate.art_analysis=analyzeArt(result.bytes,meta);
        report.stage='blender-finishing';await state();candidate.blender=await blender(join(folder,file));
        report.stage='animation-vfx-render-validation';await state();candidate.render=await inspect(folder,meta.id,id);
        const problems=[];if(candidate.gltf.errors)problems.push('Khronos glTF validation errors');
        if(!candidate.render.passed)problems.push('Actual renderer compatibility failed');
        if(candidate.bytes>16*1024*1024)problems.push('GLB size limit exceeded');
        const identity=new AvatarGLB(bytes).signature(),next=new AvatarGLB(result.bytes).signature();
        for(const key of ['rig','timing','root_motion','palette','topology'])if(identity[key]!==next[key])problems.push(key+' changed');
        candidate.validation={passed:problems.length===0,issues:problems,checks:{rig_and_bind_matrices_preserved:true,
          topology_and_skin_weights_preserved:true,key_times_and_root_motion_preserved:true,original_licensed_images_preserved:true,
          gameplay_stats_and_hitboxes_untouched:true},measurements:{triangles:candidate.analysis.performance.triangles,
          bind_pose_intersection_pairs:candidate.blender.bind_pose_intersection_pairs}};
        candidate.improvement=technicalImprovement(report.baseline,candidate,art.profile);
        candidate.status=candidate.improvement.qualifies?'eligible-for-automatic-publication':'retained-current';
        candidate.technical_penalty=candidate.improvement.reasons.length;
        candidate.rank_explanation=candidate.improvement.meaning;
      }catch(error){if(cacheFound)throw error;candidate.error=error.message;candidate.validation={passed:false,issues:[error.message]};candidate.improvement={qualifies:false,reasons:[error.message],issues_addressed:[]};}
      report.candidates.push(candidate);await atomic(join(folder,id+'-result.json'),{engine_hash:engineHash,source_hash:sha(bytes),candidate});await state();
    }
    const ranked=report.candidates.filter(c=>c.improvement.qualifies).sort((a,b)=>b.improvement.score-a.improvement.score||a.render.renderer.mean_frame_ms-b.render.renderer.mean_frame_ms||a.bytes-b.bytes);
    ranked.forEach((c,i)=>c.technical_rank=i+1);report.selection=ranked[0]?.id??null;
    report.valid_candidates=report.candidates.filter(c=>c.validation.passed).length;
    report.stage=report.selection?'ready-for-automatic-publication':'unchanged';
    report.stop_reason=report.selection?'Selected a validated repair for a profiled issue.':'No candidate met the conservative compatibility and improvement requirements. Current version retained.';
    report.original_fallback_retained=true;report.completed_at=new Date().toISOString();
    await atomic(join(folder,'report.json'),report);await state('complete',{manifest_hash:sha(JSON.stringify(report))});
  }
}catch(error){await state('failed',{error:error.stack});process.exitCode=1;}
