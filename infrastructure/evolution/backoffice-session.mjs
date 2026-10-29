import {readFile} from 'node:fs/promises';
/** Normal owner session through the isolated audit browser. Never log credentials/tokens. */
export async function backofficeSession(){
 const endpoint='http://127.0.0.1:9238';
 const page=await(await fetch(endpoint+'/json/new?about:blank',{method:'PUT'})).json();
 const socket=new WebSocket(page.webSocketDebuggerUrl);await new Promise(r=>socket.addEventListener('open',r,{once:true}));
 let seq=0;const pending=new Map();
 socket.addEventListener('message',event=>{const m=JSON.parse(event.data),p=pending.get(m.id);if(p){pending.delete(m.id);clearTimeout(p.timer);m.error?p.reject(Error(m.error.message)):p.resolve(m.result);}});
 const send=(method,params={})=>new Promise((resolve,reject)=>{const id=++seq,timer=setTimeout(()=>{pending.delete(id);reject(Error(method+' timed out'));},120000);pending.set(id,{resolve,reject,timer});socket.send(JSON.stringify({id,method,params}));});
 const evaluate=async expression=>{const r=await send('Runtime.evaluate',{expression,awaitPromise:true,returnByValue:true});if(r.exceptionDetails)throw Error(r.exceptionDetails.exception?.description??r.exceptionDetails.text);return r.result.value;};
 const delay=ms=>new Promise(r=>setTimeout(r,ms));
 const until=async expression=>{for(let i=0;i<480;i++){if(await evaluate(expression))return;await delay(250);}throw Error('Page condition timed out');};
 await send('Page.enable');await send('Runtime.enable');
 await send('Page.navigate',{url:'http://localhost:8089/evolution/registry/avatars'});await until('document.readyState!=="loading" && !!document.body');
 if(await evaluate('!!document.querySelector("[name=email]")')){
  const settings=Object.fromEntries((await readFile('.env.evolution.local','utf8')).split(/\r?\n/).filter(s=>s&&!s.startsWith('#')).map(s=>{const i=s.indexOf('=');return [s.slice(0,i),s.slice(i+1).replace(/^([\'"])(.*)\1$/,'$2')];}));
  if(!settings.EVOLUTION_OWNER_PASSWORD)throw Error('Owner login unavailable');
  await evaluate(`document.querySelector('[name=email]').value=${JSON.stringify(settings.EVOLUTION_OWNER_EMAIL??'owner@teamfight.local')};document.querySelector('[name=password]').value=${JSON.stringify(settings.EVOLUTION_OWNER_PASSWORD)};document.querySelector('[name=password]').form.requestSubmit();true`);
  await until('!document.querySelector("[name=password]")');
 }
 await until('!!document.querySelector("meta[name=csrf-token],input[name=_token]")');
 return {send,evaluate,until,delay,close:async()=>{socket.close();await fetch(endpoint+'/json/close/'+page.id);}};
}
