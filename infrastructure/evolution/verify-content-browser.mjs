// Launched through Docker stdin; credentials are supplied in memory by the wrapper.
import {spawn} from 'node:child_process';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {lookup} from 'node:dns/promises';
import assert from 'node:assert/strict';
const profile=await mkdtemp(join(tmpdir(),'content-studio-ui-'));
const gateway=(await lookup('host.docker.internal')).address;
const chrome=spawn('chromium',['--headless','--no-sandbox','--disable-dev-shm-usage',`--host-resolver-rules=MAP localhost ${gateway}`,'--remote-debugging-port=9248',`--user-data-dir=${profile}`,'about:blank'],{stdio:'ignore'});
const delay=ms=>new Promise(resolve=>setTimeout(resolve,ms));let socket;
try {
    let pages;
    for(let i=0;i<100;i++){try{pages=await(await fetch('http://127.0.0.1:9248/json/list')).json();break;}catch{await delay(100);}}
    socket=new WebSocket(pages.find(p=>p.type==='page').webSocketDebuggerUrl);
    await new Promise(resolve=>socket.addEventListener('open',resolve,{once:true}));
    let next=0;const pending=new Map();
    socket.addEventListener('message',event=>{const reply=JSON.parse(event.data),promise=pending.get(reply.id);if(promise){pending.delete(reply.id);reply.error?promise.reject(Error(reply.error.message)):promise.resolve(reply.result);}});
    const send=(method,params={})=>new Promise((resolve,reject)=>{const id=++next;pending.set(id,{resolve,reject});socket.send(JSON.stringify({id,method,params}));});
    const evaluate=async expression=>{const result=await send('Runtime.evaluate',{expression,awaitPromise:true,returnByValue:true});if(result.exceptionDetails)throw Error(result.exceptionDetails.exception?.description??result.exceptionDetails.text);return result.result.value;};
    const until=async expression=>{for(let i=0;i<150;i++){try{if(await evaluate(expression))return;}catch{}await delay(100);}throw Error('UI condition timed out');};
    const navigate=async(path,condition)=>{await send('Page.navigate',{url:'http://localhost:8089'+path});await until(`location.pathname === ${JSON.stringify(path.split('?')[0])} && document.readyState === 'complete' && (${condition})`);};
    await send('Emulation.setDeviceMetricsOverride',{width:1440,height:1000,deviceScaleFactor:1,mobile:false});
    await navigate('/login','!!document.querySelector("input[name=email]")');
    await evaluate(`document.querySelector('input[name=email]').value=${JSON.stringify(validationCredentials.email)};document.querySelector('input[name=password]').value=${JSON.stringify(validationCredentials.password)};document.querySelector('input[name=email]').form.requestSubmit();true`);
    await until('!!document.querySelector(".report-nav")');
    await navigate('/evolution/management/avatar','document.querySelector("h1")?.textContent==="Avatar management"');
    const avatars=await evaluate(`({cards:document.querySelectorAll('.manage-card').length,total:document.body.textContent.includes('45 matching designs'),next:!!document.querySelector('a[rel=next]')})`);
    assert.equal(avatars.cards,18);assert.ok(avatars.total&&avatars.next);
    await navigate('/evolution/management/avatar?q=Arsenaldo','document.querySelectorAll(".manage-card").length===1');
    const edit=await evaluate('new URL(document.querySelector(".manage-card").href).pathname');
    await navigate(edit,'document.querySelector("#content-editor")?.dataset.ready === "true"');
    assert.equal(await evaluate('document.querySelectorAll("textarea[name*=animationPrompt]").length'),3);
    assert.ok(await evaluate('document.querySelector("#content-editor").checkValidity()'));
    const desktop=(await send('Page.captureScreenshot',{format:'png'})).data;
    await navigate('/evolution/management/item','document.querySelector("h1")?.textContent==="Item management"');
    assert.ok(await evaluate("document.body.textContent.includes('49 matching designs')"));
    await send('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:true});
    await navigate('/evolution/management/item/create','!!document.querySelector("#data-cost")');
    const mobile=await evaluate('({viewport:document.documentElement.clientWidth,content:document.documentElement.scrollWidth,stats:document.querySelectorAll("#details input[type=number]").length,roles:document.querySelectorAll(".manage-roles input[type=checkbox]").length})');
    assert.ok(mobile.content<=mobile.viewport+1);assert.equal(mobile.stats,15);assert.equal(mobile.roles,6);
    const mobileScreenshot=(await send('Page.captureScreenshot',{format:'png'})).data;
    await send('Emulation.setDeviceMetricsOverride',{width:1440,height:1000,deviceScaleFactor:1,mobile:false});
    await navigate(edit,'document.querySelector("#content-editor")?.dataset.ready === "true"');
    await evaluate(`const field=document.querySelector('#brief-appearancePrompt');field.value='Unsaved UI-only probe';field.dispatchEvent(new Event('input',{bubbles:true}));document.querySelector('form[data-saved-action]').requestSubmit();true`);
    assert.ok(await evaluate("document.querySelector('[data-save-status]').textContent.includes('Save your changes first')"));
    assert.equal(await evaluate('location.pathname'),edit);
    // No design mutation is submitted; all create/update mechanics run in isolated feature tests.
    console.log('RESULT:'+JSON.stringify({owner_login:true,avatar_import:avatars,item_import:49,three_skill_animation_prompts:true,imported_special_kit_form_valid:true,mobile,unsaved_review_blocked:true,no_design_writes:true,desktop_screenshot:desktop,mobile_screenshot:mobileScreenshot}));
} finally {socket?.close();chrome.kill();await new Promise(resolve=>chrome.once('exit',resolve));await rm(profile,{recursive:true,force:true});}
