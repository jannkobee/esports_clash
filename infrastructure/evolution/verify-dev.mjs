import {readFile,writeFile} from 'node:fs/promises';
import {spawn} from 'node:child_process';
const settings=Object.fromEntries((await readFile('.env.evolution.local','utf8')).split(/\r?\n/).filter(l=>l.includes('=')).map(l=>[l.slice(0,l.indexOf('=')),l.slice(l.indexOf('=')+1)]));
const edits={
  view:{path:'EsportsClash.Api/resources/views/evolution/avatars/reports.blade.php',edit:s=>s.replace('@endsection','<span hidden data-dev-reload-probe>verified</span>\n@endsection')},
  css:{path:'EsportsClash.Api/public/evolution.css',edit:s=>s+'\n:root{--dev-reload-proof:verified}\n'},
  php:{path:'EsportsClash.Api/app/Http/Controllers/AvatarEvolutionController.php',edit:s=>s.replace("->header('Cache-Control','no-store');","->header('Cache-Control','no-store')->header('X-Development-Probe','verified');")},
  react:{path:'EsportsClash.Web/src/App.tsx',edit:s=>s+'\n// Temporary Docker HMR verification marker.\n'},
};
for(const edit of Object.values(edits)){edit.original=await readFile(edit.path,'utf8');edit.changed=edit.edit(edit.original);}
let buffer='',errors='',result,chain=Promise.resolve();
const child=spawn('docker',['compose','--env-file','.env.evolution.local','-f','compose.evolution.yaml','exec','-T','avatar-worker','node','--input-type=module'],{stdio:['pipe','pipe','pipe']});
child.stdin.on('error',()=>{});
child.stdin.end(`const validationCredentials=${JSON.stringify({email:settings.EVOLUTION_OWNER_EMAIL,password:settings.EVOLUTION_OWNER_PASSWORD})};\n${await readFile('infrastructure/evolution/verify-dev-browser.mjs','utf8')}`);
child.stderr.on('data',chunk=>{errors+=chunk.toString();});
child.stdout.on('data',chunk=>{buffer+=chunk.toString();let end;while((end=buffer.indexOf('\n'))>=0){const line=buffer.slice(0,end);buffer=buffer.slice(end+1);
  if(line.startsWith('EDIT:')){const key=line.slice(5);chain=chain.then(async()=>{await writeFile(edits[key].path,edits[key].changed);edits[key].applied=true;console.log('Verifying '+key+' reload');});}
  if(line.startsWith('RESULT:'))result=JSON.parse(line.slice(7));
}});
const timeout=setTimeout(()=>child.kill(),180000);
try {
  const status=await new Promise((resolve,reject)=>{child.on('error',reject);child.on('close',resolve);});await chain;
  if(status!==0||!result)throw Error('Browser validation failed: '+errors.slice(-3000));
  await writeFile('docs/evolution-model-reports-mobile.png',Buffer.from(result.screenshot,'base64'));delete result.screenshot;
  result.verified_at=new Date().toISOString();
  await writeFile('docs/evolution-reports-dev-verification.json',JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify(result,null,2));
} finally {
  clearTimeout(timeout);await chain;
  for(const edit of Object.values(edits))if(edit.applied){const current=await readFile(edit.path,'utf8');if(current===edit.changed)await writeFile(edit.path,edit.original);else throw Error('Verification source was edited concurrently: '+edit.path);}
}
