import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
import {backofficeSession} from './backoffice-session.mjs';
const manifest=process.argv[2];if(!manifest)throw Error('Provide a reviewed upload manifest');
const tasks=JSON.parse(await readFile(manifest,'utf8'));
const session=await backofficeSession();const receipts=[];
try{
 for(const task of tasks){
  const bytes=task.path?await readFile(task.path):null;
  const hash=bytes?createHash('sha256').update(bytes).digest('hex'):null;
  if(task.sha256)assert.equal(hash,task.sha256,'Reviewed artifact hash changed');
  const snapshot=await session.evaluate(`fetch('/api/v1/avatars/${task.avatar_id}/components',{cache:'no-store'}).then(r=>{if(!r.ok)throw Error('Inventory unavailable');return r.json()})`);
  const old=snapshot.components.find(i=>i.id===(task.kind==='body'?'base':task.component_id));
  if(hash&&old?.reference_sha256===hash){receipts.push({avatar_id:task.avatar_id,id:old.id,sha256:hash,status:'already_uploaded'});continue;}
  const endpoint=task.kind==='body'?'/evolution/avatars/trellis/reference':`/evolution/avatars/${task.avatar_id}/components`;
  const fields=task.kind==='body'?{avatar_id:task.avatar_id,prompt:task.prompt}:{version:snapshot.version,component_id:task.component_id,label:task.label,category:task.category,binding:task.binding,attachment:task.attachment??'',prompt:task.prompt??'',reference_purpose:task.reference_purpose??'reconstruction'};
  const result=await session.evaluate(`(async()=>{
   const fields=${JSON.stringify(fields)},form=new FormData();for(const [k,v]of Object.entries(fields))form.set(k,String(v));
   const token=document.querySelector('meta[name=csrf-token]')?.content??document.querySelector('input[name=_token]')?.value;if(!token)throw Error('CSRF unavailable');form.set('_token',token);
   ${bytes?`form.set(${JSON.stringify(task.kind==='body'?'reference':'asset')},new Blob([Uint8Array.from(atob(${JSON.stringify(bytes.toString('base64'))}),c=>c.charCodeAt(0))],{type:'image/png'}),${JSON.stringify((task.component_id??'body')+'.png')});`:''}
   const response=await fetch(${JSON.stringify(endpoint)},{method:'POST',body:form,headers:{Accept:'application/json'}});
   if(!response.ok)throw Error('Upload failed '+response.status+': '+(await response.text()).slice(0,700));
   return {status:response.status};
  })()`);
  const after=await session.evaluate(`fetch('/api/v1/avatars/${task.avatar_id}/components',{cache:'no-store'}).then(r=>r.json())`);
  const item=after.components.find(i=>i.id===(task.kind==='body'?'base':task.component_id));assert.ok(item,'Saved component missing from API');
  if(hash)assert.equal(item.reference_sha256,hash,'API does not match uploaded reference');
  receipts.push({avatar_id:task.avatar_id,id:item.id,sha256:hash,status:item.status,version:after.version,inventory_hash:after.hash,http:result.status});
  await writeFile(manifest+'.receipts.json',JSON.stringify(receipts,null,2)+'\n');
  console.log(JSON.stringify(receipts.at(-1)));
  await session.delay(task.kind==='body'?6500:2100);
 }
}finally{await writeFile(manifest+'.receipts.json',JSON.stringify(receipts,null,2)+'\n');await session.close();}
