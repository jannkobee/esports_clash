import {readFile,writeFile,mkdir,lstat,readdir,unlink} from 'node:fs/promises';
import {join} from 'node:path';
import {spawn} from 'node:child_process';
import {sha} from './glb.mjs';
import {intelligenceManifest} from './intelligence.mjs';

export async function preparationEngine(){
  const files=['mesh_validation.py','mesh_cleanup.py','equipment_skin.py','retarget_contacts.py','retarget_motion.py','bone_mapping.py','prepare-avatar.py','retarget-unirig.py','qualify-prepared.py','preparation-job.mjs','browser.mjs','glb.mjs','package-lock.json'];
  files.push('motion_intelligence.py',...await intelligenceManifest());
  const manifest=await Promise.all(files.map(async name=>[name,sha(await readFile(join(import.meta.dirname,name)))]));
  const assets='/workspace/EsportsClash.Web/avatar-review-dist/assets';
  for(const name of (await readdir(assets)).sort())manifest.push([name,sha(await readFile(join(assets,name)))]);
  return sha(JSON.stringify(manifest));
}
export async function preparationRequest(path,request,response,ctx){
  const {root,children,reply,json,uuid,atomic,stopOwnedJob,catalog}=ctx;
  if(path==='/preparations/operations'){
    const cached_rigs=[];
    try{
      for(const entry of await readdir(root)){
        if(!uuid.test(entry))continue;
        try{
          const sub=join(root,entry);
          const pPlan=JSON.parse(await readFile(join(sub,'preparation-plan.json'),'utf8'));
          const uRes=JSON.parse(await readFile(join(sub,'unirig-result.json'),'utf8'));
          const info=await lstat(join(sub,'unirig-rigged.glb'));
          if(uRes.status==='rigged_unqualified'&&info.isFile()&&!info.isSymbolicLink()&&info.size===uRes.artifact?.bytes&&pPlan.source_sha256===uRes.plan?.source_sha256){
            cached_rigs.push({id:entry,avatar_id:pPlan.avatar_id,source_sha256:pPlan.source_sha256,engine_sha256:uRes.plan.engine_sha256,sha256:uRes.artifact.sha256,bytes:uRes.artifact.bytes});
          }
        }catch{}
      }
    }catch{}
    reply(response,200,{engine_sha256:await preparationEngine(),profiles:[],validation_default:'blocked',active:[...children.keys()],cached_rigs,
      provider:'historical-local-preparation',compute:{selected:'local',automatic_fallback:false},runtime_ready:false,stages:[],
      blocked_reason:'Local asset processing is disabled. Connect the Google Colab animation and qualification stages.'});return true;
  }
  const match=path.match(/^\/preparations\/([a-f0-9-]+)(?:\/(cancel|validate|resume|reset))?$/);
  if(!match)return false;if(!uuid.test(match[1]))throw Error('Invalid preparation identifier');
  const id=match[1],folder=join(root,id),file=join(folder,'state.json');
  if(match[2]==='cancel'&&request.method==='POST'){
    await mkdir(folder,{recursive:true});await writeFile(join(folder,'cancelled.json'),JSON.stringify({at:new Date().toISOString()}));
    const child=children.get(id);if(child){await stopOwnedJob(child.pid);await new Promise(resolve=>child.exitCode!==null||child.signalCode!==null?resolve():child.once('exit',resolve));children.delete(id);}
    let state={};try{state=JSON.parse(await readFile(file,'utf8'));}catch{}
    state={...state,id,status:'cancelled',stage:'cancelled',publication_eligible:false};await atomic(file,state);reply(response,200,state);return true;
  }
  // This historical worker remains a control/storage/inspection endpoint. An
  // API admission check alone cannot protect a retry or direct worker request.
  // New cloud stages use their separately fingerprinted Colab service.
  if(request.method==='POST'){
    reply(response,409,{id,status:'waiting_worker',stage:'waiting_for_colab',publication_eligible:false,
      error:'Local preparation, repair, animation and qualification processing are disabled. Connect the Google Colab preparation service.'});return true;
  }
  if(match[2]==='resume'&&request.method==='POST'){
    for(const f of ['cancelled.json','preparation.json','geometry-qualification.json']){try{await unlink(join(folder,f));}catch{}}
    let state={};try{state=JSON.parse(await readFile(file,'utf8'));}catch{}
    try{await writeFile(join(folder,'preparation-starts.json'),JSON.stringify({count:0}));}catch{}
    state={...state,id,status:'queued',stage:'preparing',error:null};await atomic(file,state);reply(response,200,state);return true;
  }
  if(match[2]==='reset'&&request.method==='POST'){
    for(const f of ['cancelled.json','validate.json','preparation.json','candidate-01.glb','candidate-01.blend','geometry-qualification.json']){try{await unlink(join(folder,f));}catch{}}
    try{await writeFile(join(folder,'preparation-starts.json'),JSON.stringify({count:0}));}catch{}
    const state={id,status:'queued',stage:'preparing',publication_eligible:false,error:null};
    await atomic(file,state);reply(response,200,state);return true;
  }
  if(request.method==='GET'){reply(response,200,JSON.parse(await readFile(file,'utf8')));return true;}
  if(request.method!=='POST'){reply(response,405,{error:'POST required'});return true;}
  try{await lstat(join(folder,'cancelled.json'));reply(response,200,{id,status:'cancelled'});return true;}catch(e){if(e.code!=='ENOENT')throw e;}
  if(match[2]==='validate'){
    const state=JSON.parse(await readFile(file,'utf8'));
    if(!['awaiting_validation','needs_review'].includes(state.status)){reply(response,409,{error:'Preparation is not awaiting qualification'});return true;}
    await writeFile(join(folder,'validate.json'),JSON.stringify({requested_at:new Date().toISOString()}));
    await atomic(file,{...state,status:'queued',stage:'validation_requested'});reply(response,202,{id,status:'queued'});return true;
  }
  const plan=await json(request),meta=catalog.avatars.find(a=>a.id===plan.avatar_id);
  if(plan.version!==1||!meta||!uuid.test(plan.generation_id)||!/^[a-f0-9]{64}$/.test(plan.source_sha256)||!/^[a-f0-9]{64}$/.test(plan.engine_sha256)
    ||plan.donor_sha256!==meta.sha256||plan.provider!=='unirig'||plan.profile!=='unirig-v1'||!/^[a-f0-9]{64}$/.test(plan.unirig_engine_sha256)||!Number.isFinite(plan.yaw)||Math.abs(plan.yaw)>180
    ||!Number.isInteger(plan.storage_gib)||plan.storage_gib<1||plan.storage_gib>20||!Array.isArray(plan.attachments)||plan.attachments.length>32)throw Error('Unsupported frozen asset preparation plan');
  if(plan.rig_reuse&&(!uuid.test(plan.rig_reuse.id)||!/^[a-f0-9]{64}$/.test(plan.rig_reuse.sha256)||!Number.isInteger(plan.rig_reuse.bytes)||plan.rig_reuse.bytes<20||plan.rig_reuse.bytes>64*1024**2))throw Error('Invalid frozen reusable rig');
  if(plan.equipment!==undefined&&(!Array.isArray(plan.equipment)||plan.equipment.length>2||new Set(plan.equipment.map(item=>item.slot)).size!==plan.equipment.length||plan.equipment.some(item=>!['primary','secondary'].includes(item.slot)||!['glb','gltf'].includes(item.format)||!/^[a-f0-9]{64}$/.test(item.sha256)||!Number.isInteger(item.bytes)||item.bytes<20||item.bytes>20*1024**2||(item.height_cm!==undefined&&(typeof item.height_cm!=='number'||!Number.isFinite(item.height_cm)||item.height_cm<5||item.height_cm>300))||(item.avatar_height_cm!==undefined&&(typeof item.avatar_height_cm!=='number'||!Number.isFinite(item.avatar_height_cm)||item.avatar_height_cm<50||item.avatar_height_cm>300)))))throw Error('Invalid frozen modular equipment');
  if(plan.baseline&&(!uuid.test(plan.baseline.run_id)||!/^candidate-\d{2}\.glb$/.test(plan.baseline.file)||!/^[a-f0-9]{64}$/.test(plan.baseline.sha256)))throw Error('Invalid frozen baseline');
  if(!plan.bone_map||typeof plan.bone_map!=='object'||Array.isArray(plan.bone_map)&&plan.bone_map.length||Object.keys(plan.bone_map).length>17||Object.values(plan.bone_map).some(name=>typeof name!=='string'||!name.match(/^[A-Za-z0-9_.:\/-]{1,100}$/)))throw Error('Invalid reviewed retarget mapping');
  for(const a of plan.attachments)if(!a||!/^[A-Za-z][A-Za-z0-9_.-]{0,79}$/.test(a.bone)||!['min','max'].every(k=>Array.isArray(a[k])&&a[k].length===3&&a[k].every(v=>typeof v==='number'&&Number.isFinite(v)&&v>=0&&v<=1))||a.min.some((v,i)=>v>=a.max[i]))throw Error('Invalid rigid attachment region');
  await mkdir(folder,{recursive:true});
  let state;
  try{
    const frozen=JSON.parse(await readFile(join(folder,'preparation-plan.json'),'utf8'));
    if(frozen.generation_id!==plan.generation_id||frozen.avatar_id!==plan.avatar_id||frozen.source_sha256!==plan.source_sha256)throw Error('Preparation plan identity mismatch');
    if(JSON.stringify(frozen)!==JSON.stringify(plan))await atomic(join(folder,'preparation-plan.json'),plan);
    state=JSON.parse(await readFile(file,'utf8'));
  }
  catch(e){if(e.code!=='ENOENT')throw e;await atomic(join(folder,'preparation-plan.json'),plan);state={id,status:'queued',stage:'preparing',publication_eligible:false};await atomic(file,state);}
  if(['cancelled','failed','ready','needs_review','awaiting_retarget','awaiting_validation'].includes(state.status)){reply(response,200,state);return true;}
  if(children.has(id)){reply(response,202,state);return true;}
  if(!ctx.claim()){reply(response,409,{error:'One bounded asset worker is already active'});return true;}
  try{
    const resource=await ctx.resource(),used=await ctx.storageBytes();if(resource.available_vm_mib<2048||resource.anonymous_mib>900||used>=plan.storage_gib*1024**3){await atomic(file,{...state,status:'waiting_resources',stage:'resource_admission'});reply(response,200,{...state,status:'waiting_resources'});return true;}
    // Recheck the tombstone after asynchronous admission, immediately before spawn.
    try{await lstat(join(folder,'cancelled.json'));reply(response,200,{id,status:'cancelled'});return true;}catch(e){if(e.code!=='ENOENT')throw e;}
    let launches=0;try{launches=JSON.parse(await readFile(join(folder,'preparation-starts.json'),'utf8')).count;}catch(e){if(e.code!=='ENOENT')throw e;}
    if(launches>=4){await atomic(file,{...state,status:'failed',error:'Bounded recovery attempts exhausted; create a new preparation.'});reply(response,200,{...state,status:'failed'});return true;}
    await atomic(join(folder,'preparation-starts.json'),{count:launches+1});
    try{await lstat(join(folder,'cancelled.json'));reply(response,200,{id,status:'cancelled'});return true;}catch(e){if(e.code!=='ENOENT')throw e;}
    const child=spawn('node',['--max-old-space-size=256',join(import.meta.dirname,'preparation-job.mjs'),folder],{stdio:['ignore','ignore','pipe'],detached:true});children.set(id,child);
    let errors='';child.stderr.on('data',chunk=>{errors=(errors+chunk).slice(-2000);});
    const timer=setTimeout(()=>void stopOwnedJob(child.pid),20*60*1000);
    child.once('exit',async (code,signal)=>{clearTimeout(timer);children.delete(id);try{await lstat(join(folder,'cancelled.json'));return;}catch{}
      if(code!==0){const last=JSON.parse(await readFile(file,'utf8'));await atomic(file,{...last,status:'failed',error:last.error||errors||`Preparation subprocess stopped (exit ${code}, signal ${signal??'none'}); source retained.`});}});
    reply(response,202,state);return true;
  }finally{ctx.release();}
}
