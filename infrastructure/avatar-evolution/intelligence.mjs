import {spawn} from 'node:child_process';
import {readFile,readdir} from 'node:fs/promises';
import {join} from 'node:path';
import {sha} from './glb.mjs';

export function intelligence(args,{timeout=45000}={}) {
  return new Promise((resolve,reject)=>{
    const child=spawn('python3',['-m','asset_pipeline.cli',...args],{
      cwd:import.meta.dirname,stdio:['ignore','pipe','ignore'],detached:true,
      env:{...process.env,ASSET_PIPELINE_DATA:process.env.ASSET_PIPELINE_DATA??join(process.env.AVATAR_DATA??'/avatar-data','intelligence')},
    });
    const stop=()=>{try{process.kill(-child.pid,'SIGKILL');}catch{child.kill('SIGKILL');}};
    let output='';const timer=setTimeout(stop,timeout);
    child.stdout.on('data',chunk=>{output+=chunk;if(output.length>1024**2)stop();});
    child.once('error',error=>{clearTimeout(timer);reject(error);});
    child.once('exit',code=>{clearTimeout(timer);if(code!==0)return reject(Error('Asset intelligence task unavailable'));
      try{resolve(JSON.parse(output));}catch(error){reject(error);}});
  });
}

export async function intelligenceManifest() {
  const folder=join(import.meta.dirname,'asset_pipeline');
  return ['intelligence.mjs',...(await readdir(folder)).filter(name=>name.endsWith('.py')).sort().map(name=>'asset_pipeline/'+name)];
}

export function startIntelligence(root) {
  let running=false,stopped=false;
  const tick=async()=>{
    if(running||stopped)return;
    running=true;
    try{await intelligence(['tick',root],{timeout:360000});}
    catch{console.error('Asset intelligence tick incomplete; durable work will resume.');}
    finally{running=false;}
  };
  const timer=setInterval(()=>void tick(),60000);timer.unref();
  void tick();
  return ()=>{stopped=true;clearInterval(timer);};
}

export async function intelligenceStatus(root) {
  try{return JSON.parse(await readFile(join(process.env.ASSET_PIPELINE_DATA??join(root,'intelligence'),'status.json'),'utf8'));}
  catch{return {status:'initializing',schema:'asset-intelligence-v1'};}
}

export async function recoverPreparedArtifact(folder,name,checksum) {
  if(!['candidate-01.glb','unirig-rigged.glb','baseline.glb'].includes(name)||!/^[a-f0-9]{64}$/.test(checksum))throw Error('Unsupported recovery identity');
  try{return await readFile(join(folder,name));}
  catch(error){if(error.code!=='ENOENT'||!process.env.ASSET_DRIVE_TOKEN_FILE)throw error;}
  // Keep the recovered cache copy independent. The caller retains the frozen
  // hash check and chooses whether/where to install it.
  const recovered=await intelligence(['recover',folder.split('/').at(-1)+':'+name,checksum]);
  const bytes=await readFile(recovered.path);
  if(sha(bytes)!==checksum)throw Error('Recovered preparation artifact hash mismatch');
  return bytes;
}
