import {readFile,writeFile} from 'node:fs/promises';
import {spawn} from 'node:child_process';
const settings=Object.fromEntries((await readFile('.env.evolution.local','utf8')).split(/\r?\n/).filter(line=>line.includes('=')).map(line=>[line.slice(0,line.indexOf('=')),line.slice(line.indexOf('=')+1)]));
const child=spawn('docker',['compose','--env-file','.env.evolution.local','-f','compose.evolution.yaml','exec','-T','avatar-worker','node','--input-type=module'],{stdio:['pipe','pipe','pipe']});
let output='',errors='';child.stdout.on('data',chunk=>output+=chunk.toString());child.stderr.on('data',chunk=>errors+=chunk.toString());child.stdin.on('error',()=>{});
child.stdin.end(`const validationCredentials=${JSON.stringify({email:settings.EVOLUTION_OWNER_EMAIL,password:settings.EVOLUTION_OWNER_PASSWORD})};\n${await readFile('infrastructure/evolution/verify-preparation-controls-browser.mjs','utf8')}`);
const timeout=setTimeout(()=>child.kill(),90000);
try {
    const code=await new Promise((resolve,reject)=>{child.once('error',reject);child.once('close',resolve);});
    if(code!==0)throw Error('Preparation UI checks failed: '+errors.slice(-1800));
    const line=output.split('\n').find(line=>line.startsWith('RESULT:'));if(!line)throw Error('No browser evidence returned');
    const result=JSON.parse(line.slice(7));
    for(const [key,path] of [['desktop_screenshot','docs/preparation-controls-desktop.png'],['mobile_screenshot','docs/preparation-controls-mobile.png']]){await writeFile(path,Buffer.from(result[key],'base64'));delete result[key];}
    result.verified_at=new Date().toISOString();await writeFile('docs/preparation-controls-ui-verification.json',JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify(result,null,2));
} finally {clearTimeout(timeout);}
