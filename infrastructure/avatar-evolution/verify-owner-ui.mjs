import {readFile,writeFile} from 'node:fs/promises';
import {spawnSync} from 'node:child_process';
const settings=Object.fromEntries((await readFile('.env.evolution.local','utf8')).split(/\r?\n/).filter(l=>l.includes('=')).map(l=>[l.slice(0,l.indexOf('=')),l.slice(l.indexOf('=')+1)]));
const script=await readFile('infrastructure/avatar-evolution/owner-browser.mjs','utf8');
const result=spawnSync('docker',['compose','--env-file','.env.evolution.local','-f','compose.evolution.yaml','exec','-T','avatar-worker','node','--input-type=module'],
  {input:`const validationCredentials=${JSON.stringify({email:settings.EVOLUTION_OWNER_EMAIL,password:settings.EVOLUTION_OWNER_PASSWORD})};\n${script}`,encoding:'utf8',timeout:120000});
if(result.status!==0)throw Error('Owner UI verification failed: '+result.stderr.slice(-2500));
const data=JSON.parse(result.stdout.trim());
for(const [key,path]of[['screenshot','docs/avatar-evolution-owner-dashboard.png'],['mobileScreenshot','docs/avatar-evolution-owner-mobile.png']]){
  await writeFile(path,Buffer.from(data[key],'base64'));delete data[key];}
data.verified_at=new Date().toISOString();await writeFile('docs/avatar-evolution-ui-verification.json',JSON.stringify(data,null,2)+'\n');console.log(JSON.stringify(data,null,2));
