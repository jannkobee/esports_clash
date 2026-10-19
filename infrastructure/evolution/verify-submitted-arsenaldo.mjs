import {mkdtemp,mkdir,rm} from 'node:fs/promises';
import {spawn} from 'node:child_process';
import {resolve} from 'node:path';
import {createServer} from 'node:net';
await mkdir('.local-tools/submitted-arsenaldo-review',{recursive:true});
const profile=await mkdtemp(resolve('.local-tools/submitted-arsenaldo-review/profile-'));
const reservation=createServer();await new Promise(r=>reservation.listen(0,'127.0.0.1',r));const port=reservation.address().port;await new Promise(r=>reservation.close(r));
const chrome=spawn('C:/Program Files/Google/Chrome/Application/chrome.exe',['--headless=new','--no-first-run','--disable-extensions','--disable-background-networking',
  '--remote-debugging-port='+port,'--user-data-dir='+profile,'about:blank'],{stdio:'ignore',windowsHide:true});
try{
  for(let i=0;i<100;i++){try{await fetch('http://127.0.0.1:'+port+'/json/list');break;}catch{await new Promise(r=>setTimeout(r,100));}}
  process.env.CDP_PORT=String(port);
  await import('../../EsportsClash.Web/scripts/review-submitted-arsenaldo.mjs');
}finally{
  chrome.kill('SIGTERM');await new Promise(r=>{if(chrome.exitCode!==null||chrome.signalCode!==null)r();else chrome.once('exit',r);});
  await rm(profile,{recursive:true,force:true,maxRetries:16,retryDelay:250});
}
