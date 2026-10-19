import {readFile,writeFile,mkdtemp,mkdir,rm,access} from 'node:fs/promises';
import {spawn} from 'node:child_process';
import {resolve,join} from 'node:path';
import {pathToFileURL} from 'node:url';
import {createServer} from 'node:net';
// Prefer the local browser for visual checks. It keeps review rendering outside
// the capped, always-on asset-processing worker during autonomous generation.
if(process.platform==='win32'){
  const chromePath='C:/Program Files/Google/Chrome/Application/chrome.exe';
  await access(chromePath);await mkdir('.local-tools/collision-review',{recursive:true});
  const profile=await mkdtemp(resolve('.local-tools/collision-review/profile-'));
  const reservation=createServer();await new Promise(r=>reservation.listen(0,'127.0.0.1',r));const port=reservation.address().port;
  await new Promise(r=>reservation.close(r));
  const chrome=spawn(chromePath,['--headless=new','--no-first-run','--disable-extensions','--disable-background-networking',
    '--remote-debugging-port='+port,'--user-data-dir='+profile,'about:blank'],{stdio:'ignore',windowsHide:true});
  try{
    for(let i=0;i<100;i++){try{await fetch('http://127.0.0.1:'+port+'/json/list');break;}catch{await new Promise(r=>setTimeout(r,100));}}
    let code=await readFile('EsportsClash.Web/scripts/check-arena-3d.mjs','utf8');
    code=code.replaceAll('http://127.0.0.1:${vite}','http://localhost:8088').replaceAll('../docs/',resolve('docs').replaceAll('\\','/')+'/')
      .replace("date:'2026-10-17'","date:'2026-10-18'");
    const file=resolve('.local-tools/collision-review/check.mjs');await writeFile(file,code);
    process.env.CDP_PORT=String(port);process.env.OUTPUT_PREFIX='collision-arena';process.env.REQUIRE_GLB='1';
    await import(pathToFileURL(file).href);
  }finally{
    chrome.kill('SIGTERM');await new Promise(r=>{if(chrome.exitCode!==null||chrome.signalCode!==null)r();else chrome.once('exit',r);});
    await rm(profile,{recursive:true,force:true,maxRetries:16,retryDelay:250});
  }
  process.exit(0);
}
let script=await readFile('EsportsClash.Web/scripts/check-arena-3d.mjs','utf8');
script=script.replaceAll('http://127.0.0.1:${vite}', 'http://localhost:8088')
  .replaceAll('../docs/', '/tmp/collision-browser/').replace("date:'2026-10-17'", "date:'2026-10-18'");
// Software rendering can take longer than the fixture's original 150ms delay.
// Wait for the same camera precision requirement; do not relax its assertion.
script=script.replace("  assert.ok(Math.abs(await cameraX() - 1300)",
  "  await waitFor('Math.abs(window.arenaRenderer().arena.camera.position.x-1300) < '+(2600/mapWidth));\n  assert.ok(Math.abs(await cameraX() - 1300)");
// Bound presentation work in this disposable SwiftShader fixture. Fixed-tick
// simulation is still stepped explicitly; no game clock or state is skipped.
script=script.replace("  await send('Page.navigate', { url:",
  "  await send('Page.addScriptToEvaluateOnNewDocument', {source: 'window.requestAnimationFrame=callback=>setTimeout(()=>callback(performance.now()),180);window.cancelAnimationFrame=id=>clearTimeout(id)'});\n  await send('Page.navigate', { url:");
const child=spawn('docker',['compose','--env-file','.env.evolution.local','-f','compose.evolution.yaml','exec','-T','avatar-worker','node','--input-type=module'],{stdio:['pipe','pipe','pipe']});
child.stdin.on('error',()=>{});let output='',errors='';
child.stdout.on('data',chunk=>{output+=chunk;});child.stderr.on('data',chunk=>{errors+=chunk;});
child.stdin.end(`
import {spawn} from 'node:child_process';
import {mkdtemp,mkdir,rm,readdir,readFile,writeFile} from 'node:fs/promises';
import {lookup} from 'node:dns/promises';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
const profile=await mkdtemp(join(tmpdir(),'collision-arena-'));
await mkdir('/tmp/collision-browser',{recursive:true});
const gateway=(await lookup('host.docker.internal')).address;
const chrome=spawn('chromium',['--headless','--no-sandbox','--disable-dev-shm-usage','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader',
  '--host-resolver-rules=MAP localhost '+gateway,'--remote-debugging-port=9232','--user-data-dir='+profile,'about:blank'],{stdio:'ignore'});
try {
  for(let i=0;i<100;i++){try{await fetch('http://127.0.0.1:9232/json/list');break;}catch{await new Promise(r=>setTimeout(r,100));}}
  process.env.CDP_PORT='9232';process.env.OUTPUT_PREFIX='collision-arena';process.env.REQUIRE_GLB='1';
  await writeFile('/tmp/collision-browser/check.mjs',Buffer.from('${Buffer.from(script).toString('base64')}','base64'));
  await import('file:///tmp/collision-browser/check.mjs');
  const files={};for(const file of await readdir('/tmp/collision-browser'))if(file.endsWith('.png')||file.endsWith('.json'))files[file]=(await readFile(join('/tmp/collision-browser',file))).toString('base64');
  console.log('RESULT:'+JSON.stringify(files));
} finally {
  chrome.kill('SIGTERM');await new Promise(r=>{if(chrome.exitCode!==null||chrome.signalCode!==null)r();else{const timer=setTimeout(()=>chrome.kill('SIGKILL'),5000);chrome.once('exit',()=>{clearTimeout(timer);r();});}});
  await rm(profile,{recursive:true,force:true,maxRetries:8,retryDelay:200});
}
`);
const timeout=setTimeout(()=>child.kill(),240000);
try {
  const status=await new Promise((resolve,reject)=>{child.on('error',reject);child.on('close',resolve);});
  if(status!==0)throw Error('Collision arena browser verification failed: '+errors.slice(-2600));
  const line=output.split('\n').find(l=>l.startsWith('RESULT:'));if(!line)throw Error('Missing browser evidence');
  const files=JSON.parse(line.slice(7));for(const [file,data]of Object.entries(files))await writeFile('docs/'+file,Buffer.from(data,'base64'));
  console.log(JSON.stringify({files:Object.keys(files),result:'Actual GLB 3D/2D 30/60/90-second state and RNG parity passed'}));
}finally{clearTimeout(timeout);}
