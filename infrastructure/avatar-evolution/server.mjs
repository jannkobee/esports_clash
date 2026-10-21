import http from 'node:http';
import { timingSafeEqual } from 'node:crypto';
import { readFile,writeFile,mkdir,rename,readdir,stat,lstat,rm } from 'node:fs/promises';
import { createReadStream } from 'node:fs';
import { resolve,join,extname } from 'node:path';
import { spawn } from 'node:child_process';
import { sha } from './glb.mjs';
import { inspect } from './browser.mjs';
import { profiles } from './art.mjs';
import {preparationRequest} from './preparation-server.mjs';
import {AvatarGLB} from './glb.mjs';
import {startIntelligence,intelligenceStatus} from './intelligence.mjs';

export const root=resolve(process.env.AVATAR_DATA??'/avatar-data');await mkdir(root,{recursive:true});
const stopIntelligence=startIntelligence(root);
const token=process.env.EVOLUTION_WORKER_TOKEN??'',catalog=JSON.parse(await readFile('/workspace/catalog.json','utf8'));
const uuid=/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/;
const children=new Map(),viewer='/workspace/EsportsClash.Web/avatar-review-dist';
let launching=false,probing=false;
export async function atomic(path,data){const tmp=path+'.tmp';await writeFile(tmp,JSON.stringify(data,null,2));await rename(tmp,path);}
export async function resource(){
  const memory=Object.fromEntries((await readFile('/proc/meminfo','utf8')).split('\n').filter(Boolean).map(line=>[line.split(':')[0],Number(line.match(/\d+/)?.[0]??0)/1024]));
  const stats=Object.fromEntries((await readFile('/sys/fs/cgroup/memory.stat','utf8')).trim().split('\n').map(l=>l.split(' ')));
  const peak=Number(await readFile('/sys/fs/cgroup/memory.peak','utf8'))/1048576;
  return {anonymous_mib:Number(stats.anon)/1048576,available_vm_mib:memory.MemAvailable,vm_total_mib:memory.MemTotal,cgroup_peak_mib:peak,gpu_vram_mib:null,scope:'Avatar worker cgroup and Linux Docker VM; CPU/SwiftShader validation.'};
}
async function bytes(folder){let total=0;for(const entry of await readdir(folder,{withFileTypes:true})){if(entry.isSymbolicLink())continue;const p=join(folder,entry.name);if(entry.isDirectory())total+=await bytes(p);else if(entry.isFile())total+=(await stat(p)).size;}return total;}
async function stopOwnedJob(pid){
  const parents=new Map();
  for(const entry of await readdir('/proc'))if(/^\d+$/.test(entry)){
    try{parents.set(Number(entry),Number((await readFile(`/proc/${entry}/status`,'utf8')).match(/^PPid:\s+(\d+)/m)?.[1]));}catch{}
  }
  const owned=new Set([pid]);let added=true;
  while(added){added=false;for(const [child,parent]of parents)if(owned.has(parent)&&!owned.has(child)){owned.add(child);added=true;}}
  // Include Chromium's own session, then terminate the generator last. No other
  // container's processes are visible in this private worker PID namespace.
  for(const child of [...owned].reverse())try{globalThis.process.kill(child,'SIGKILL');}catch{}
}
const reply=(response,code,value)=>{response.writeHead(code,{'Content-Type':'application/json','Cache-Control':'no-store'});response.end(JSON.stringify(value));};
const authorized=request=>{const actual=Buffer.from(request.headers.authorization??''),expected=Buffer.from('Bearer '+token);return token&&actual.length===expected.length&&timingSafeEqual(actual,expected);};
const json=async request=>{let body='';for await(const chunk of request){body+=chunk;if(body.length>65536)throw Error('Request too large');}return JSON.parse(body);};
async function file(response,path){if((await lstat(path)).isSymbolicLink())throw Error('Symlinks forbidden');const types={'.html':'text/html','.js':'text/javascript','.css':'text/css','.glb':'model/gltf-binary','.json':'application/json','.png':'image/png','.blend':'application/octet-stream'};
  response.writeHead(200,{'Content-Type':types[extname(path)]??'application/octet-stream','X-Content-Type-Options':'nosniff','Cache-Control':'private, max-age=60'});createReadStream(path).pipe(response);}
const server=http.createServer(async(request,response)=>{
  let ownsLaunch=false;
  try {
    const path=new URL(request.url,'http://avatar-worker').pathname;
    if(path==='/health')return reply(response,200,{status:'ok',active:[...children.keys()]});
    if(!authorized(request))return reply(response,401,{error:'Avatar worker authentication required'});
    const equipment=path.match(/^\/equipment\/([a-f0-9]{64})\.(glb|gltf)$/);
    if(equipment&&request.method==='PUT'){
      const chunks=[];let length=0;
      for await(const chunk of request){length+=chunk.length;if(length>20*1024**2)throw Error('Equipment exceeds 20 MiB');chunks.push(chunk);}
      const body=Buffer.concat(chunks);if(sha(body)!==equipment[1])throw Error('Equipment content hash mismatch');
      const data=equipment[2]==='glb'?new AvatarGLB(body).json:JSON.parse(body.toString('utf8'));
      if(data.asset?.version!=='2.0'||!data.meshes?.length||data.skins?.length||data.animations?.length||[...(data.buffers??[]),...(data.images??[])].some(item=>item.uri&&!item.uri.startsWith('data:')))throw Error('Equipment must contain self-contained static glTF 2.0 geometry');
      const directory=join(root,'equipment');await mkdir(directory,{recursive:true});const destination=join(directory,equipment[1]+'.'+equipment[2]);
      try{await writeFile(destination,body,{flag:'wx'});}catch(error){if(error.code!=='EEXIST')throw error;if((await lstat(destination)).isSymbolicLink()||sha(await readFile(destination))!==equipment[1])throw Error('Immutable equipment changed');}
      return reply(response,200,{sha256:equipment[1],bytes:length,format:equipment[2]});
    }
    if(await preparationRequest(path,request,response,{root,children,reply,json,uuid,atomic,stopOwnedJob,catalog,resource,storageBytes:()=>bytes(root),
      claim:()=>{if(launching||probing||children.size)return false;launching=true;return true;},release:()=>{launching=false;}}))return;
    const cancel=path.match(/^\/runs\/([a-f0-9-]+)\/cancel$/);
    if(cancel&&uuid.test(cancel[1])&&request.method==='POST'){
      const id=cancel[1],folder=join(root,id);await mkdir(folder,{recursive:true});
      await atomic(join(folder,'cancelled.json'),{at:new Date().toISOString()});
      const child=children.get(id);if(child){await stopOwnedJob(child.pid);await new Promise(resolve=>child.exitCode!==null||child.signalCode!==null?resolve():child.once('exit',resolve));children.delete(id);}
      let state={};try{state=JSON.parse(await readFile(join(folder,'state.json'),'utf8'));}catch{}
      state={...state,status:'cancelled',publication_eligible:false};await atomic(join(folder,'state.json'),state);return reply(response,200,state);
    }
    if(path==='/asset-intelligence'&&request.method==='GET')return reply(response,200,await intelligenceStatus(root));
    if(path==='/operations')return reply(response,200,{active:[...children.keys()],probing,resources:await resource(),storage_bytes:await bytes(root),asset_intelligence:await intelligenceStatus(root),external_ai:false,
      provider:'local-procedural-material-and-mesh-finishing',external_budget_usd:0,pilot:profiles.pilot});
    if(path==='/probes'&&request.method==='POST') {
      const input=await json(request);
      if(!uuid.test(input.run_id)||!/^candidate-\d{2}\.glb$/.test(input.file)||!/^[a-f0-9]{64}$/.test(input.sha256)||!Number.isSafeInteger(input.release_id))throw Error('Invalid health probe');
      if(children.size||launching||probing)return reply(response,409,{status:'inconclusive',reason:'Asset processing is busy'});
      probing=true;
      try {
        const folder=join(root,input.run_id),record=JSON.parse(await readFile(join(folder,'state.json'),'utf8'));
        const candidate=record.report.candidates.find(c=>c.file===input.file&&c.sha256===input.sha256);
        if(!candidate)throw Error('Release has no frozen candidate evidence');
        const asset=await readFile(join(folder,input.file));
        if(sha(asset)!==input.sha256)return reply(response,200,{status:'failed',release_id:input.release_id,sha256:input.sha256,reason:'Immutable GLB hash mismatch'});
        const resources=await resource();if(resources.available_vm_mib<2048||resources.anonymous_mib>900)return reply(response,200,{status:'inconclusive',reason:'Resource admission paused'});
        const baseline=await inspect(folder,record.report.avatar.id,'baseline',{writePreviews:false});
        if(!baseline.passed)return reply(response,200,{status:'inconclusive',reason:'Baseline renderer health is unavailable'});
        let actual;
        try{actual=await inspect(folder,record.report.avatar.id,input.file.replace('.glb',''),{writePreviews:false});}
        catch(error){return reply(response,200,{status:'failed',release_id:input.release_id,sha256:input.sha256,
          reason:'Candidate failed after the baseline rendered successfully: '+error.message});}
        const regression=actual.renderer.mean_frame_ms>baseline.renderer.mean_frame_ms*1.08;
        const mapsLoaded=actual.textures?.missing_detail_maps===0&&actual.textures?.detailed_materials===(candidate.render?.textures?.detailed_materials??0);
        const healthy=actual.passed&&actual.gameplay?.passed===true&&mapsLoaded&&!regression;
        return reply(response,200,{status:healthy?'healthy':'failed',release_id:input.release_id,sha256:input.sha256,
          reason:healthy?'Versioned asset, clips, shader and local render cost pass':regression?'Repeated local rendering cost regression':'Model/rig/texture/shader rendering failed',
          renderer:actual.renderer,baseline_renderer:baseline.renderer,issues:actual.issues});
      }catch(error){return reply(response,200,{status:error.code==='ENOENT'?'failed':'inconclusive',release_id:input.release_id,sha256:input.sha256,reason:error.message});}
      finally{probing=false;}
    }
    if(path==='/retention'&&request.method==='POST') {
      const input=await json(request);if(!Array.isArray(input.keep)||input.keep.some(id=>!uuid.test(id))||!Array.isArray(input.delete)||input.delete.length>100||input.delete.some(id=>!uuid.test(id)))throw Error('Invalid retention registry');
      const keep=new Set([...input.keep,...children.keys()]),deleted=[],skipped=[];
      if(children.size||launching||probing)return reply(response,409,{error:'Asset processing is busy'});
      for(const entry of await readdir(root,{withFileTypes:true}))if(entry.isDirectory()&&uuid.test(entry.name)){
        try{const plan=JSON.parse(await readFile(join(root,entry.name,'plan.json'),'utf8'));if(plan.parent?.run_id)keep.add(plan.parent.run_id);}catch{}
        try{const prepPlan=JSON.parse(await readFile(join(root,entry.name,'preparation-plan.json'),'utf8'));if(prepPlan.rig_reuse?.id)keep.add(prepPlan.rig_reuse.id);if(prepPlan.baseline?.run_id)keep.add(prepPlan.baseline.run_id);}catch{}
      }
      if(input.scan_orphans===true){
        for(const entry of await readdir(root,{withFileTypes:true})){
          if(entry.isDirectory()&&uuid.test(entry.name)&&!keep.has(entry.name)){
            if(!input.delete.includes(entry.name))input.delete.push(entry.name);
          }
        }
      }
      let reclaimedBytes=0;
      for(const id of input.delete){
        const folder=resolve(root,id);
        if(!folder.startsWith(root+'/')||folder===root||keep.has(id)){skipped.push(id);continue;}
        let info;try{info=await lstat(folder);}catch(error){if(error.code!=='ENOENT')throw error;skipped.push(id);continue;}
        if(info.isSymbolicLink()||!info.isDirectory()){skipped.push(id);continue;}
        let plan=null,prepPlan=null,state=null;
        try{plan=JSON.parse(await readFile(join(folder,'plan.json'),'utf8'));}catch{}
        try{prepPlan=JSON.parse(await readFile(join(folder,'preparation-plan.json'),'utf8'));}catch{}
        try{state=JSON.parse(await readFile(join(folder,'state.json'),'utf8'));}catch{}
        const isCancelled=await lstat(join(folder,'cancelled.json')).then(()=>true).catch(()=>false);
        const ageMs=Date.now()-info.mtimeMs;
        if(plan&&(plan.version!==2||!['complete','failed','cancelled'].includes(state?.status)||(ageMs<7*86400000&&!isCancelled))){skipped.push(id);continue;}
        if(prepPlan&&(!['failed','cancelled','awaiting_retarget','awaiting_validation'].includes(state?.status)||(ageMs<24*3600*1000&&!isCancelled))){skipped.push(id);continue;}
        if(!plan&&!prepPlan&&!isCancelled&&ageMs<24*3600*1000){skipped.push(id);continue;}
        let folderSize=0;try{folderSize=await bytes(folder);}catch{}
        if(input.apply===true){await rm(folder,{recursive:true,force:false});deleted.push(id);reclaimedBytes+=folderSize;}else skipped.push(id);
      }
      if(Array.isArray(input.keep_equipment)){
        const equipDir=join(root,'equipment'),kept=new Set(input.keep_equipment);
        try{for(const item of await readdir(equipDir)){
          const match=item.match(/^([a-f0-9]{64})\.(glb|gltf)$/);
          if(match&&!kept.has(match[1])){
            const p=join(equipDir,item);const s=(await stat(p)).size;
            if(input.apply===true){await unlink(p);reclaimedBytes+=s;}
          }
        }}catch{}
      }
      await atomic(join(root,'retention-last.json'),{at:new Date().toISOString(),deleted,skipped,reclaimed_bytes:reclaimedBytes});
      return reply(response,200,{deleted,skipped,reclaimed_bytes:reclaimedBytes});
    }
    if(path.startsWith('/viewer/')&&request.method==='GET') {
      const relative=decodeURIComponent(path.slice(8));if(relative.includes('..')||!/^[A-Za-z0-9_./-]+$/.test(relative))throw Error('Invalid viewer path');
      const full=resolve(viewer,relative);if(!full.startsWith(viewer+'/'))throw Error('Invalid viewer path');return file(response,full);
    }
    const asset=path.match(/^\/files\/([a-f0-9-]+)\/([a-z0-9-]+\.(?:glb|blend|json|png))$/);
    if(asset&&uuid.test(asset[1])&&request.method==='GET')return file(response,join(root,asset[1],asset[2]));
    const match=path.match(/^\/runs\/([a-f0-9-]+)$/);if(!match||!uuid.test(match[1]))return reply(response,404,{error:'Unknown avatar job'});
    const id=match[1],folder=join(root,id),stateFile=join(folder,'state.json');
    try{await lstat(join(folder,'cancelled.json'));return reply(response,200,{status:'cancelled'});}catch(error){if(error.code!=='ENOENT')throw error;}
    if(request.method==='GET'){
      const state=JSON.parse(await readFile(stateFile,'utf8'));
      if(['review','complete'].includes(state.status))for(const c of state.report.candidates){if(c.sha256&&sha(await readFile(join(folder,c.file)))!==c.sha256)throw Error('Candidate artifact hash changed');}
      return reply(response,200,state);
    }
    if(request.method!=='POST')return reply(response,405,{error:'POST required'});
    const plan=await json(request),meta=catalog.avatars.find(a=>a.id===plan.avatar?.id);
    const supportedPlan=plan.version===1&&plan.owner_approval_required===true&&plan.automatic_publish===false
      ||plan.version===2&&plan.owner_approval_required===false&&plan.automatic_publish===true&&meta?.id===profiles.pilot
        &&plan.profile_hash===sha(JSON.stringify(profiles.profiles[meta.id]));
    if(!meta||JSON.stringify(meta)!==JSON.stringify(plan.avatar)||!supportedPlan
      ||!Number.isInteger(plan.candidates)||plan.candidates<3||plan.candidates>10||!Number.isInteger(plan.generations)||plan.generations<1||plan.generations>3
      ||!Number.isInteger(plan.storage_gib)||plan.storage_gib<1||plan.storage_gib>20||plan.original_sha256!==meta.sha256)throw Error('Unsupported immutable avatar plan');
    if(plan.parent&&(!uuid.test(plan.parent.run_id)||!/^candidate-\d{2}\.glb$/.test(plan.parent.file)||!/^[a-f0-9]{64}$/.test(plan.parent.sha256)))throw Error('Invalid parent asset');
    if(launching)return reply(response,409,{error:'Avatar admission is already being checked'});
    launching=true;ownsLaunch=true;
    await mkdir(folder,{recursive:true});
    let state;
    try {const original=JSON.parse(await readFile(join(folder,'plan.json'),'utf8'));if(JSON.stringify(original)!==JSON.stringify(plan))return reply(response,409,{error:'Avatar plan is immutable'});state=JSON.parse(await readFile(stateFile,'utf8'));}
    catch(error){if(error.code!=='ENOENT')throw error;await atomic(join(folder,'plan.json'),plan);state={status:'queued'};await atomic(stateFile,state);}
    if(['review','complete','failed'].includes(state.status))return reply(response,200,state);
    if(children.has(id))return reply(response,202,state);
    if(children.size||probing)return reply(response,409,{error:'One bounded avatar worker/probe is already active'});
    const resources=await resource(),used=await bytes(root);
    if(resources.available_vm_mib<2048||resources.anonymous_mib>900||used>=plan.storage_gib*1024**3){state={...state,status:'paused_resource',error:'RAM reserve or managed avatar storage budget reached; retained releases preserved'};await atomic(stateFile,state);return reply(response,200,state);}
    let starts=0;try{starts=JSON.parse(await readFile(join(folder,'starts.json'),'utf8')).count;}catch(error){if(error.code!=='ENOENT')throw error;}
    if(starts>=3){state={...state,status:'failed',error:'Three recovery launches exhausted; evidence retained.'};await atomic(stateFile,state);return reply(response,200,state);}
    await atomic(join(folder,'starts.json'),{count:starts+1});
    try{await lstat(join(folder,'cancelled.json'));return reply(response,200,{status:'cancelled'});}catch(error){if(error.code!=='ENOENT')throw error;}
    const child=spawn('node',['--max-old-space-size=256',join(import.meta.dirname,plan.version===2?'art-job.mjs':'job.mjs'),folder],{stdio:['ignore','ignore','pipe'],detached:true,env:{...globalThis.process.env}});children.set(id,child);
    let errors='';child.stderr.on('data',chunk=>{errors=(errors+chunk).slice(-2000);});
    const deadline=setTimeout(()=>{void stopOwnedJob(child.pid);},20*60*1000);
    child.once('exit',async code=>{clearTimeout(deadline);children.delete(id);try{await lstat(join(folder,'cancelled.json'));return;}catch{}if(code!==0){const last=JSON.parse(await readFile(stateFile,'utf8'));if(!['review','complete'].includes(last.status))await atomic(stateFile,{...last,status:'failed',error:errors||`Asset worker exited ${code}; inspect memory/validation before retrying.`});}});
    return reply(response,202,state);
  }catch(error){if(!response.headersSent)reply(response,error.code==='ENOENT'?404:422,{error:error.message});else response.destroy();}
  finally{if(ownsLaunch)launching=false;}
});
server.listen(8094,'0.0.0.0');
server.once('close',stopIntelligence);
