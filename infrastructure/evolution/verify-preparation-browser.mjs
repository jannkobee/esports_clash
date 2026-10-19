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
    await navigate('/evolution/avatars/preparation','!!document.querySelector("#preparation-bulk-delete")');
    await until('!!document.querySelector("#preparation-delete-selected")?.disabled');
    const initial=await evaluate(`({reports:document.querySelectorAll('[data-preparation-id]').length,eligible:document.querySelectorAll('.preparation-select:not(:disabled)').length,busy:document.querySelectorAll('.preparation-select:disabled').length,progress:document.querySelectorAll('.preparation-progress').length,forms:[...document.querySelectorAll('.preparation-select')].every(input=>input.form?.id==='preparation-bulk-delete')})`);
    assert.ok(initial.forms);assert.equal(initial.reports,initial.progress);
    let selectionPreserved=null,detailsPreserved=null;
    const fixtureUsed=initial.eligible===0;
    if(fixtureUsed) {
        // Client-only fixture exercises selection across real refresh events.
        // It is never submitted, saved to the database or included in screenshots.
        await evaluate(`window.__originalPreparationFetch=window.fetch;window.__selectionFixture='<span hidden data-selection-fixture><input type="checkbox" class="preparation-select" name="ids[]" value="00000000-0000-4000-8000-000000000099" form="preparation-bulk-delete"></span>';document.querySelector('#live-reports').insertAdjacentHTML('beforeend',window.__selectionFixture);window.fetch=async(...args)=>{const result=await window.__originalPreparationFetch(...args);if(String(args[0]).includes('/avatars/preparation/live')&&result.ok){return new Response((await result.text())+window.__selectionFixture,{status:200,headers:{'Content-Type':'text/html'}});}return result;};document.querySelector('#live-reports').dispatchEvent(new Event('reports:refreshed'));true`);
    }
    if(initial.eligible || fixtureUsed) {
        await evaluate(`document.querySelector('#preparation-select-all').click();true`);
        assert.equal(await evaluate('document.querySelectorAll(".preparation-select:checked").length'),initial.eligible || 1);
        assert.ok(await evaluate('document.querySelector("#preparation-delete-selected").disabled'));
        await evaluate('document.querySelector("#preparation-delete-confirm").click();true');
        assert.equal(await evaluate('document.querySelector("#preparation-delete-selected").disabled'),false);
        await evaluate(`document.querySelectorAll('.preparation-progress details').forEach(d=>d.open=true);window.__selectedBefore=[...document.querySelectorAll('.preparation-select:checked')].map(i=>i.value);window.__detailsBefore=[...document.querySelectorAll('.preparation-progress details[open]')].map(d=>d.id);true`);
        await evaluate(`new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(Error('No live refresh event')),22000);document.querySelector('#live-reports').addEventListener('reports:refreshed',()=>{clearTimeout(timer);resolve(true)},{once:true});})`);
        selectionPreserved=await evaluate(`window.__selectedBefore.every(id=>document.querySelector('.preparation-select[value="'+id+'"]').checked)`);
        detailsPreserved=await evaluate('window.__detailsBefore.every(id=>document.getElementById(id).open)');
        assert.ok(selectionPreserved&&detailsPreserved);
        await evaluate('document.querySelector("#preparation-clear-selection").click();true');
        assert.ok(await evaluate('document.querySelector("#preparation-delete-selected").disabled'));
    }
    if(fixtureUsed) await evaluate(`window.fetch=window.__originalPreparationFetch;document.querySelectorAll('[data-selection-fixture]').forEach(node=>node.remove());document.querySelector('#live-reports').dispatchEvent(new Event('reports:refreshed'));true`);
    await evaluate("(document.querySelector('[data-preparation-id]')??document.querySelector('#preparation-bulk-delete')).scrollIntoView();true");
    const desktop=(await send('Page.captureScreenshot',{format:'png'})).data;
    await send('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:true});
    await evaluate('document.querySelector("#preparation-bulk-delete").scrollIntoView();true');
    const mobile=await evaluate('({viewport:document.documentElement.clientWidth,content:document.documentElement.scrollWidth})');assert.ok(mobile.content<=mobile.viewport+1);
    const mobileScreenshot=(await send('Page.captureScreenshot',{format:'png'})).data;
    console.log('RESULT:'+JSON.stringify({owner_login:true,initial,selection_preserved:selectionPreserved,client_only_selection_fixture:fixtureUsed,open_details_preserved:detailsPreserved,confirmation_required:true,mobile,no_delete_submitted:true,no_preparation_started:true,desktop_screenshot:desktop,mobile_screenshot:mobileScreenshot}));
} finally {socket?.close();chrome.kill();await new Promise(resolve=>chrome.once('exit',resolve));await rm(profile,{recursive:true,force:true,maxRetries:10,retryDelay:150});}
