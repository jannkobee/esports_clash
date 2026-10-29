import {writeFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
import {backofficeSession} from './backoffice-session.mjs';
const s=await backofficeSession();
try{
 await s.send('Emulation.setDeviceMetricsOverride',{width:1440,height:1000,deviceScaleFactor:1,mobile:false});
 await s.send('Page.navigate',{url:'http://localhost:8089/evolution/avatars/trellis/avatar/c_invoker'});
 await s.until('!!document.querySelector("#avatar-components")');
 const owner=await s.evaluate(`({heading:document.querySelector('#avatar-components h2').textContent,form:new URL(document.querySelector('#avatar-components form').action).pathname,categories:[...document.querySelector('#avatar-components select[name=category]').options].map(x=>x.value),version:Number(document.querySelector('#avatar-components').dataset.inventoryVersion)})`);
 assert.equal(owner.categories.length,6);
 const api=await s.evaluate(`fetch('/api/v1/avatars/c_invoker/components',{cache:'no-store'}).then(r=>r.json())`);
 assert.equal(owner.version,api.version);assert.equal(api.components[0].reference_sha256,'2358eaf3dae034785e982cd82132e8b27e226222565141bde7bd79f2aab7b380');
 await s.evaluate(`document.querySelector('#avatar-components').scrollIntoView()`);
 await s.send('Page.captureScreenshot',{format:'png'}).then(r=>writeFile('docs/pipeline-audit-20261024/component-backoffice.png',Buffer.from(r.data,'base64')));
 await s.send('Page.navigate',{url:'http://localhost:8088'});await s.until('location.port==="8088" && document.body.innerText.length>10');
 await s.until('document.body.innerText.length>80 && !document.body.innerText.startsWith("Loading game catalog")');
 await s.evaluate(`[...document.querySelectorAll('button')].find(b=>b.textContent.trim()==='Avatars & Lore').click()`);
 await s.until('!!document.querySelector("[data-avatar-inventory]")');
 await s.evaluate(`[...document.querySelectorAll('button')].find(b=>b.textContent.includes('Mirelle Vane')).click()`);
 await s.until('!!document.querySelector("[data-avatar-inventory=c_invoker][data-inventory-hash]")');
 const web=await s.evaluate(`(()=>{const el=document.querySelector('[data-avatar-inventory=c_invoker]');el.open=true;return {hash:el.dataset.inventoryHash,text:el.innerText};})()`);
 assert.equal(web.hash,api.hash);assert.ok(web.text.includes('design context only'));
 await s.send('Page.captureScreenshot',{format:'png'}).then(r=>writeFile('docs/pipeline-audit-20261024/component-web.png',Buffer.from(r.data,'base64')));
 const webText=await s.evaluate('document.body.innerText');
 console.log(JSON.stringify({owner,apiHash:api.hash,webText:webText.slice(0,7000)}));
 await writeFile('docs/pipeline-audit-20261024/component-integration.json',JSON.stringify({owner,api,web,webText},null,2)+'\n');
}finally{await s.close();}
