import {readFile,writeFile,rename,lstat,readdir} from 'node:fs/promises';
import {join} from 'node:path';
import {spawn} from 'node:child_process';
import {AvatarGLB,sha} from './glb.mjs';
import {inspect} from './browser.mjs';
import validator from 'gltf-validator';
import {intelligence,recoverPreparedArtifact} from './intelligence.mjs';
const folder=process.argv[2],plan=JSON.parse(await readFile(join(folder,'preparation-plan.json'),'utf8'));
const cancelled=async()=>{try{await lstat(join(folder,'cancelled.json'));return true;}catch{return false;}};
const save=async state=>{if(await cancelled())return;const temp=join(folder,'state.json.tmp-job');await writeFile(temp,JSON.stringify({id:folder.split('/').at(-1),...state},null,2));await rename(temp,join(folder,'state.json'));};
try{
  if(await cancelled())process.exit(0);
  const catalog=JSON.parse(await readFile('/workspace/catalog.json','utf8')),meta=catalog.avatars.find(a=>a.id===plan.avatar_id);
  if(!meta||meta.sha256!==plan.donor_sha256)throw Error('Character donor identity mismatch');
  const source=join('/trellis-sources',plan.generation_id+'.glb'),donor=join('/workspace/EsportsClash.Web/public/models',meta.file);
  if((await lstat(source)).isSymbolicLink()||(await lstat(source)).size>32*1024**2||sha(await readFile(source))!==plan.source_sha256||sha(await readFile(donor))!==plan.donor_sha256)throw Error('Immutable source/donor hash mismatch');
  const baselineBytes=plan.baseline?await recoverPreparedArtifact(join(process.env.AVATAR_DATA??'/avatar-data',plan.baseline.run_id),plan.baseline.file,plan.baseline.sha256):await readFile(donor);
  if(sha(baselineBytes)!==(plan.baseline?.sha256??plan.donor_sha256))throw Error('Frozen live baseline hash mismatch');
  await writeFile(join(folder,'baseline.glb'),baselineBytes);
  let prepared;
  try{prepared=JSON.parse(await readFile(join(folder,'preparation.json'),'utf8'));const cached=await recoverPreparedArtifact(folder,'candidate-01.glb',prepared.sha256);if(sha(cached)!==prepared.sha256)throw Error('Prepared asset changed');await writeFile(join(folder,'candidate-01.glb'),cached);}
  catch(e){if(e.code!=='ENOENT')throw e;
    if(plan.provider!=='unirig')throw Error('Local surface-transfer admission retired; create a UniRig preparation.');
    await save({status:'animating',stage:'download_unirig_and_retarget_native_clips',publication_eligible:false});
    const base=process.env.UNIRIG_WORKER_URL??'http://unirig-worker:8098',headers={Authorization:'Bearer '+process.env.EVOLUTION_WORKER_TOKEN},id=folder.split('/').at(-1);
    let result,rig;
    let cachedLocally=false;
    try{
      const localRes=JSON.parse(await readFile(join(folder,'unirig-result.json'),'utf8'));
      const localRig=await recoverPreparedArtifact(folder,'unirig-rigged.glb',localRes.artifact.sha256);
      if(localRes.status==='rigged_unqualified'&&localRes.plan?.source_sha256===plan.source_sha256&&localRig.length===localRes.artifact?.bytes&&sha(localRig)===localRes.artifact?.sha256){
        rig=localRig;result=localRes;cachedLocally=true;await writeFile(join(folder,'unirig-rigged.glb'),localRig);
      }
    }catch{}
    if(!cachedLocally&&plan.rig_reuse){
      const sourceFolder=join(process.env.AVATAR_DATA??'/avatar-data',plan.rig_reuse.id);
      const sourcePlan=JSON.parse(await readFile(join(sourceFolder,'preparation-plan.json'),'utf8'));
      if(sourcePlan.source_sha256!==plan.source_sha256||sourcePlan.avatar_id!==plan.avatar_id||sourcePlan.unirig_engine_sha256!==plan.unirig_engine_sha256)throw Error('Reusable rig source identity mismatch');
      const info=await lstat(join(sourceFolder,'unirig-rigged.glb'));if(!info.isFile()||info.isSymbolicLink()||info.size!==plan.rig_reuse.bytes)throw Error('Reusable rig is unavailable or unsafe; inference was not started');
      rig=await readFile(join(sourceFolder,'unirig-rigged.glb'));
      if(sha(rig)!==plan.rig_reuse.sha256)throw Error('Reusable rig hash mismatch; inference was not started');
      result=JSON.parse(await readFile(join(sourceFolder,'unirig-result.json'),'utf8'));
      result={...result,reused_from:plan.rig_reuse.id};
    }else if(!cachedLocally){
      try{
        const response=await fetch(base+'/jobs/'+id,{headers,signal:AbortSignal.timeout(15000)});if(!response.ok)throw Error('UniRig result unavailable');result=await response.json();
        const download=await fetch(base+'/jobs/'+id+'/artifact',{headers,signal:AbortSignal.timeout(45000)});if(!download.ok)throw Error('UniRig artifact unavailable');rig=Buffer.from(await download.arrayBuffer());
      }catch(fetchErr){
        const dataRoot=process.env.AVATAR_DATA??'/avatar-data';
        let siblings=await readdir(dataRoot);
        try{const ranked=await intelligence(['rank-rigs',dataRoot,plan.source_sha256,plan.unirig_engine_sha256,plan.avatar_id]);siblings=ranked.candidates.map(item=>item.id);}
        catch{console.error('Learned rig ranking unavailable; retained-rig integrity checks still apply.');}
        for(const sibling of siblings){
          if(sibling===id)continue;
          try{
            const sibFolder=join(dataRoot,sibling);
            const sibRes=JSON.parse(await readFile(join(sibFolder,'unirig-result.json'),'utf8'));
            if(sibRes.status==='rigged_unqualified'&&sibRes.plan?.source_sha256===plan.source_sha256&&sibRes.plan?.engine_sha256===plan.unirig_engine_sha256){
              const sibRig=await readFile(join(sibFolder,'unirig-rigged.glb'));
              if(sibRig.length===sibRes.artifact?.bytes&&sha(sibRig)===sibRes.artifact?.sha256){
                rig=sibRig;result={...sibRes,reused_from:sibling};break;
              }
            }
          }catch{}
        }
        if(!rig||!result)throw fetchErr;
      }
    }
    if(result.status!=='rigged_unqualified'||result.plan.engine_sha256!==plan.unirig_engine_sha256||result.plan.source_sha256!==plan.source_sha256)throw Error('UniRig frozen result mismatch');
    if(rig.length>64*1024**2||rig.length!==result.artifact.bytes||sha(rig)!==result.artifact.sha256)throw Error('UniRig exported artifact integrity failed');
    if(!cachedLocally){await writeFile(join(folder,'unirig-rigged.glb'),rig);await writeFile(join(folder,'unirig-result.json'),JSON.stringify(result,null,2));}
    for(const equipment of plan.equipment??[]){
      const path=join(process.env.AVATAR_DATA??'/avatar-data','equipment',equipment.sha256+'.'+equipment.format),info=await lstat(path);
      if(!info.isFile()||info.isSymbolicLink()||info.size!==equipment.bytes)throw Error('Frozen equipment is unavailable');
      const bytes=await readFile(path);if(sha(bytes)!==equipment.sha256)throw Error('Frozen equipment integrity mismatch');
      await writeFile(join(folder,'equipment-'+equipment.slot+'.'+equipment.format),bytes,{flag:'wx'}).catch(async error=>{if(error.code!=='EEXIST'||sha(await readFile(join(folder,'equipment-'+equipment.slot+'.'+equipment.format)))!==equipment.sha256)throw error;});
    }
    await new Promise((resolve,reject)=>{const child=spawn('blender',['--background','--threads','1','--factory-startup','--disable-autoexec','--python-exit-code','1','--python',join(import.meta.dirname,'retarget-unirig.py'),'--',folder,join(folder,'unirig-rigged.glb'),donor],{stdio:['ignore','ignore','pipe']});let errors='';child.stderr.on('data',b=>errors=(errors+b).slice(-2000));child.once('error',reject);child.once('exit',code=>code===0?resolve():reject(Error(errors||'UniRig native animation retargeting failed')));});
    prepared=JSON.parse(await readFile(join(folder,'preparation.json'),'utf8'));
  }
  if(await cancelled())process.exit(0);
  if(prepared.runtime_compatible!==true){await save({status:'awaiting_retarget',stage:'review_unirig_bone_mapping',preparation:prepared,publication_eligible:false});process.exit(0);}
  let validate=true;try{await lstat(join(folder,'validate.json'));validate=true;}catch{}
  if(plan.validation==='deferred_manual'&&!validate){await save({status:'awaiting_validation',stage:'rig_and_clips_exported_validation_deferred',preparation:prepared,publication_eligible:false});process.exit(0);}
  await save({status:'validating',stage:'gltf_and_actual_game_renderer',preparation:prepared,publication_eligible:false});
  const bytes=await readFile(join(folder,'candidate-01.glb')),file=new AvatarGLB(bytes);
  const gltf=await validator.validateBytes(new Uint8Array(bytes),{uri:'candidate-01.glb',maxIssues:100});
  await new Promise((resolve,reject)=>{const child=spawn('blender',['--background','--threads','1','--factory-startup','--disable-autoexec','--python-exit-code','1','--python',join(import.meta.dirname,'qualify-prepared.py'),'--',folder],{stdio:['ignore','ignore','pipe']});let errors='';child.stderr.on('data',b=>errors=(errors+b).slice(-2000));child.once('error',reject);child.once('exit',code=>code===0?resolve():reject(Error(errors||'Geometry qualification failed')));});
  const geometry=JSON.parse(await readFile(join(folder,'geometry-qualification.json'),'utf8'));
  // Preserve completed evidence even if a subsequent renderer fails to start.
  await save({status:'validating',stage:'gltf_and_actual_game_renderer',preparation:prepared,publication_eligible:false,
    report:{qualification_complete:false,geometry,gltf:{errors:gltf.issues.numErrors,warnings:gltf.issues.numWarnings,messages:gltf.issues.messages},
      reasons:[...(prepared.problems??[]),...geometry.problems,...(gltf.issues.numErrors?['Official glTF validation failed']:[])]}});
  const baseline=await inspect(folder,meta.id,'baseline'),render=await inspect(folder,meta.id,'candidate-01');
  const reasons=[...(prepared.problems??[])];
  const warnings=[...(geometry.warnings??[])];
  if(!geometry.passed)reasons.push(...geometry.problems);
  if(gltf.issues.numErrors)reasons.push('Official glTF validation failed');
  if(!baseline.passed)reasons.push('Current-version renderer could not establish a comparison');
  if(!render.passed||!render.gameplay?.passed)reasons.push('Actual game animation/render checks failed');
  if(bytes.length>16*1024**2)reasons.push('16 MiB published asset budget exceeded');
  if(render.renderer.draw_calls>baseline.renderer.draw_calls)warnings.push('Draw-call budget exceeds the current version');
  if(render.renderer.mean_frame_ms>baseline.renderer.mean_frame_ms*1.08)warnings.push('Measured local frame cost exceeds an 8% regression');
  for(const metric of ['planted_foot_step_drift','blend_hand_step_jump'])if(!Number.isFinite(render[metric])||render[metric]>baseline[metric]+.001)warnings.push(metric+' elevated');
  if(!file.json.skins?.length||!['Idle','Walk','Run','Attack','Cast','Hit','Death'].every(name=>file.json.animations?.some(a=>a.name===name)))reasons.push('Required skeleton/native clips missing');
  const report={qualification_complete:true,engine:'asset-preparation-v1',avatar:meta,source_hash:plan.source_sha256,engine_sha256:plan.engine_sha256,baseline:{render:baseline},
    preparation:prepared,geometry,gltf:{errors:gltf.issues.numErrors,warnings:gltf.issues.numWarnings,messages:gltf.issues.messages},
    candidates:[{id:'candidate-01',file:'candidate-01.glb',sha256:sha(bytes),bytes:bytes.length,render,validation:{passed:reasons.length===0,reasons,warnings}}],reasons,warnings};
  await save({status:reasons.length?'needs_review':'ready',stage:reasons.length?'qualification_blocked':'technical_checks_passed_identity_review_required',preparation:prepared,report,publication_eligible:false});
}catch(error){let retained={};try{retained=JSON.parse(await readFile(join(folder,'state.json'),'utf8'));}catch{}
  await save({...retained,status:'failed',stage:'preparation_failed',error:error.message,publication_eligible:false});process.exitCode=1;}
finally{
  if(!await cancelled()){
    try{await intelligence(['collect',folder]);}
    catch{console.error('Asset quality collection pending; coordinator will retry from retained evidence.');}
  }
}
