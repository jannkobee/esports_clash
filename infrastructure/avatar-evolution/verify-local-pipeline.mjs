/** Run inside an isolated avatar worker with AVATAR_DATA pointing at trial data.
 * Uses the real authored Dawnna geometry. Never publishes or labels training data.
 */
import {readFile,writeFile,mkdir,copyFile} from 'node:fs/promises';
import {spawn} from 'node:child_process';
import {join} from 'node:path';
import {randomUUID} from 'node:crypto';
import validator from 'gltf-validator';
import {sha,AvatarGLB} from './glb.mjs';
import {inspect} from './browser.mjs';

const root=process.env.AVATAR_DATA;
if(!root||!root.includes('trial'))throw Error('An isolated trial data directory is required');
const folder=join(root,randomUUID());await mkdir(folder,{recursive:true});
const meta=JSON.parse(await readFile('/workspace/catalog.json','utf8')).avatars.find(a=>a.id==='c_solana');
const donor=join('/workspace/EsportsClash.Web/public/models',meta.file),before=sha(await readFile(donor));
const run=async(script,args)=>{
  const child=spawn('blender',['--background','--threads','1','--factory-startup','--disable-autoexec',
    '--python-exit-code','1','--python',join(import.meta.dirname,script),'--',...args],{stdio:['ignore','pipe','pipe']});
  let log='';const timer=setTimeout(()=>child.kill('SIGKILL'),300000);
  child.stdout.on('data',data=>{log=(log+data).slice(-50000);});child.stderr.on('data',data=>{log=(log+data).slice(-50000);});
  const code=await new Promise((resolve,reject)=>{child.once('error',reject);child.once('exit',resolve);});clearTimeout(timer);
  await writeFile(join(folder,script+'.log'),log);
  if(code!==0)throw Error(script+' failed: '+log.slice(-4000));
};
let server;
const summary={scope:'Authored Dawnna integration trial; no generated UniRig result or live release',folder,avatar_id:meta.id};
try{
  await copyFile(donor,join(folder,'baseline.glb'));
  await run('local_trial_source.py',[donor,join(folder,'fixture.glb')]);
  const fixture=await readFile(join(folder,'fixture.glb'));
  const plan={version:1,avatar_id:meta.id,source_sha256:sha(fixture),yaw:0,bone_map:{},equipment:[],
    character_profile:'humanoid_shield',diagnostic_fixture:true};
  await writeFile(join(folder,'preparation-plan.json'),JSON.stringify(plan));
  await writeFile(join(folder,'unirig-result.json'),JSON.stringify({status:'rigged_unqualified',diagnostic_fixture:true,
    plan:{source_sha256:sha(fixture),engine_sha256:'0'.repeat(64)},artifact:{sha256:sha(fixture),bytes:fixture.length}}));
  await run('retarget-unirig.py',[folder,join(folder,'fixture.glb'),donor]);
  summary.preparation=JSON.parse(await readFile(join(folder,'preparation.json'),'utf8'));
  const candidate=await readFile(join(folder,'candidate-01.glb'));
  const gltf=await validator.validateBytes(new Uint8Array(candidate),{uri:'candidate-01.glb',maxIssues:100});
  summary.gltf={errors:gltf.issues.numErrors,warnings:gltf.issues.numWarnings,messages:gltf.issues.messages};
  summary.clips=new AvatarGLB(candidate).json.animations?.map(a=>a.name);
  await run('qualify-prepared.py',[folder]);
  summary.geometry=JSON.parse(await readFile(join(folder,'geometry-qualification.json'),'utf8'));
  server=spawn('node',[join(import.meta.dirname,'server.mjs')],{stdio:['ignore','ignore','pipe'],env:{...process.env}});
  let ready=false;
  for(let i=0;i<100;i++){
    try{ready=(await fetch('http://127.0.0.1:8094/health')).ok;}catch{}
    if(ready)break;
    await new Promise(resolve=>setTimeout(resolve,100));
  }
  if(!ready)throw Error('Isolated renderer server did not start');
  summary.baseline=await inspect(folder,meta.id,'baseline');
  summary.candidate=await inspect(folder,meta.id,'candidate-01');
  summary.technical_pass=summary.gltf.errors===0&&summary.geometry.passed&&summary.candidate.passed&&summary.candidate.gameplay.passed;
  summary.contact_regressions=Object.fromEntries(['planted_foot_step_drift','blend_hand_step_jump'].map(key=>[key,
    summary.candidate[key]>summary.baseline[key]+.001]));
  summary.performance_regression=summary.candidate.renderer.draw_calls>summary.baseline.renderer.draw_calls
    ||summary.candidate.renderer.mean_frame_ms>summary.baseline.renderer.mean_frame_ms*1.08;
  summary.qualified_without_regression=summary.technical_pass&&summary.baseline.passed
    &&!Object.values(summary.contact_regressions).some(Boolean)&&!summary.performance_regression;
  summary.status=summary.qualified_without_regression?'integration_passed':'needs_improvement';
}catch(error){summary.error=error.message;process.exitCode=1;}
finally{
  server?.kill('SIGTERM');
  summary.original_unchanged=before===sha(await readFile(donor));
  await writeFile(join(root,'trial-summary.json'),JSON.stringify(summary,null,2));
  console.log(JSON.stringify({folder,technical_pass:summary.technical_pass,qualified_without_regression:summary.qualified_without_regression,status:summary.status,error:summary.error,original_unchanged:summary.original_unchanged}));
}
