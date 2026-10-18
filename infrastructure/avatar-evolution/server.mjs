import http from 'node:http';
import { timingSafeEqual } from 'node:crypto';
import { readFile,writeFile,mkdir,rename,readdir,stat,lstat } from 'node:fs/promises';
import { createReadStream } from 'node:fs';
import { resolve,join,extname } from 'node:path';
import { spawn } from 'node:child_process';
import { sha } from './glb.mjs';

export const root=resolve(process.env.AVATAR_DATA??'/avatar-data');await mkdir(root,{recursive:true});
const token=process.env.EVOLUTION_WORKER_TOKEN??'',catalog=JSON.parse(await readFile('/workspace/catalog.json','utf8'));
const uuid=/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/;
const children=new Map(),viewer='/workspace/EsportsClash.Web/avatar-review-dist';
let launching=false;
export async function atomic(path,data){const tmp=path+'.tmp';await writeFile(tmp,JSON.stringify(data,null,2));await rename(tmp,path);}
export async function resource(){
  const memory=Object.fromEntries((await readFile('/proc/meminfo','utf8')).split('\n').filter(Boolean).map(line=>[line.split(':')[0],Number(line.match(/\d+/)?.[0]??0)/1024]));
  const stats=Object.fromEntries((await readFile('/sys/fs/cgroup/memory.stat','utf8')).trim().split('\n').map(l=>l.split(' ')));
  const peak=Number(await readFile('/sys/fs/cgroup/memory.peak','utf8'))/1048576;
  return {anonymous_mib:Number(stats.anon)/1048576,available_vm_mib:memory.MemAvailable,vm_total_mib:memory.MemTotal,cgroup_peak_mib:peak,gpu_vram_mib:null,scope:'Avatar worker cgroup and Linux Docker VM; CPU/SwiftShader validation.'};
}
async function bytes(folder){let total=0;for(const entry of await readdir(folder,{withFileTypes:true})){if(entry.isSymbolicLink())continue;const p=join(folder,entry.name);if(entry.isDirectory())total+=await bytes(p);else if(entry.isFile())total+=(await stat(p)).size;}return total;}
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
    if(path==='/operations')return reply(response,200,{active:[...children.keys()],resources:await resource(),storage_bytes:await bytes(root),external_ai:false});
    if(path.startsWith('/viewer/')&&request.method==='GET') {
      const relative=decodeURIComponent(path.slice(8));if(relative.includes('..')||!/^[A-Za-z0-9_./-]+$/.test(relative))throw Error('Invalid viewer path');
      const full=resolve(viewer,relative);if(!full.startsWith(viewer+'/'))throw Error('Invalid viewer path');return file(response,full);
    }
    const asset=path.match(/^\/files\/([a-f0-9-]+)\/([a-z0-9-]+\.(?:glb|blend|json|png))$/);
    if(asset&&uuid.test(asset[1])&&request.method==='GET')return file(response,join(root,asset[1],asset[2]));
    const match=path.match(/^\/runs\/([a-f0-9-]+)$/);if(!match||!uuid.test(match[1]))return reply(response,404,{error:'Unknown avatar job'});
    const id=match[1],folder=join(root,id),stateFile=join(folder,'state.json');
    if(request.method==='GET'){
      const state=JSON.parse(await readFile(stateFile,'utf8'));
      if(state.status==='review')for(const c of state.report.candidates){if(c.sha256&&sha(await readFile(join(folder,c.file)))!==c.sha256)throw Error('Candidate artifact hash changed');}
      return reply(response,200,state);
    }
    if(request.method!=='POST')return reply(response,405,{error:'POST required'});
    const plan=await json(request),meta=catalog.avatars.find(a=>a.id===plan.avatar?.id);
    if(!meta||JSON.stringify(meta)!==JSON.stringify(plan.avatar)||plan.version!==1||plan.owner_approval_required!==true||plan.automatic_publish!==false
      ||!Number.isInteger(plan.candidates)||plan.candidates<3||plan.candidates>10||!Number.isInteger(plan.generations)||plan.generations<1||plan.generations>3
      ||!Number.isInteger(plan.storage_gib)||plan.storage_gib<1||plan.storage_gib>20||plan.original_sha256!==meta.sha256)throw Error('Unsupported immutable avatar plan');
    if(plan.parent&&(!uuid.test(plan.parent.run_id)||!/^candidate-\d{2}\.glb$/.test(plan.parent.file)||!/^[a-f0-9]{64}$/.test(plan.parent.sha256)))throw Error('Invalid parent asset');
    if(launching)return reply(response,409,{error:'Avatar admission is already being checked'});
    launching=true;ownsLaunch=true;
    await mkdir(folder,{recursive:true});
    let state;
    try {const original=JSON.parse(await readFile(join(folder,'plan.json'),'utf8'));if(JSON.stringify(original)!==JSON.stringify(plan))return reply(response,409,{error:'Avatar plan is immutable'});state=JSON.parse(await readFile(stateFile,'utf8'));}
    catch(error){if(error.code!=='ENOENT')throw error;await atomic(join(folder,'plan.json'),plan);state={status:'queued'};await atomic(stateFile,state);}
    if(['review','failed'].includes(state.status))return reply(response,200,state);
    if(children.has(id))return reply(response,202,state);
    if(children.size)return reply(response,409,{error:'One bounded avatar worker is already active'});
    const resources=await resource(),used=await bytes(root);
    if(resources.available_vm_mib<2048||resources.anonymous_mib>900||used>=plan.storage_gib*1024**3){state={...state,status:'paused_resource',error:'RAM reserve or managed avatar storage budget reached; retained releases preserved'};await atomic(stateFile,state);return reply(response,200,state);}
    let starts=0;try{starts=JSON.parse(await readFile(join(folder,'starts.json'),'utf8')).count;}catch(error){if(error.code!=='ENOENT')throw error;}
    if(starts>=3){state={...state,status:'failed',error:'Three recovery launches exhausted; evidence retained.'};await atomic(stateFile,state);return reply(response,200,state);}
    await atomic(join(folder,'starts.json'),{count:starts+1});
    const process=spawn('node',['--max-old-space-size=256',join(import.meta.dirname,'job.mjs'),folder],{stdio:['ignore','ignore','pipe'],env:{...globalThis.process.env}});children.set(id,process);
    let errors='';process.stderr.on('data',chunk=>{errors=(errors+chunk).slice(-2000);});
    const deadline=setTimeout(()=>process.kill('SIGKILL'),20*60*1000);
    process.once('exit',async code=>{clearTimeout(deadline);children.delete(id);if(code!==0){const last=JSON.parse(await readFile(stateFile,'utf8'));if(last.status!=='review')await atomic(stateFile,{...last,status:'failed',error:errors||`Asset worker exited ${code}; inspect memory/validation before retrying.`});}});
    return reply(response,202,state);
  }catch(error){if(!response.headersSent)reply(response,error.code==='ENOENT'?404:422,{error:error.message});else response.destroy();}
  finally{if(ownsLaunch)launching=false;}
});
server.listen(8094,'0.0.0.0');
