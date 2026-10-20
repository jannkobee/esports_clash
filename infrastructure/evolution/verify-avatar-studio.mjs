// Read-only browser review. No uploads, prompts, deletions or jobs are submitted.
import { withBrowser } from './backoffice-browser.mjs';
import { writeFile } from 'node:fs/promises';
import assert from 'node:assert/strict';

await withBrowser(async ({ evaluate, until, navigate, viewport, screenshot, errors, reviewRoot }) => {
  const evidence = { viewports: [], checks: [] };
  await navigate('/evolution/avatars/trellis');
  assert.equal(await evaluate('document.querySelectorAll(".generation-card").length'), 45);
  const filters = await evaluate('[...document.querySelectorAll(\'[data-target="#generation-roster"] button\')].map(b=>({category:b.dataset.category,count:Number(b.textContent.match(/\\((\\d+)\\)/)[1])}))');
  assert.equal(filters.filter(f => f.category !== 'all').reduce((sum, f) => sum + f.count, 0), 45);
  const names = await evaluate('[...document.querySelectorAll(".generation-card")].map(card=>card.dataset.name)');
  assert.deepEqual(names, [...names].sort((a,b)=>a.localeCompare(b,undefined,{sensitivity:'base',numeric:true})));
  assert.equal(await evaluate('document.querySelector(".studio-avatar-content a.fine")'), null);
  await evaluate('const sort=document.querySelector(\'[data-list-controls="#generation-roster"] [data-list-sort]\');sort.value="name-desc";sort.dispatchEvent(new Event("change"))');
  assert.deepEqual(await evaluate('[...document.querySelectorAll(".generation-card")].map(card=>card.dataset.name)'), [...names].reverse());
  await evaluate('const role=document.querySelector(\'[data-list-filter="role"]\');role.value="Marksman";role.dispatchEvent(new Event("change"))');
  assert.equal(await evaluate('[...document.querySelectorAll(".generation-card:not([hidden])")].every(card=>card.dataset.role==="Marksman")'), true);
  await evaluate('const equipment=document.querySelector(\'[data-list-filter="equipment"]\');equipment.value="default";equipment.dispatchEvent(new Event("change"))');
  assert.equal(await evaluate('[...document.querySelectorAll(".generation-card:not([hidden])")].every(card=>card.dataset.role==="Marksman" && card.dataset.equipment==="default")'), true);
  await evaluate('document.querySelector(\'[data-list-controls="#generation-roster"] [data-list-reset]\').click()');
  assert.deepEqual(await evaluate('[...document.querySelectorAll(".generation-card")].map(card=>card.dataset.name)'), names);
  await evaluate('document.querySelector("#generation-search").value="Aiselle";document.querySelector("#generation-search").dispatchEvent(new Event("input"))');
  assert.equal(await evaluate('document.querySelectorAll(".generation-card:not([hidden])").length'), 1);
  await evaluate('document.querySelector("#generation-search").value="no-avatar-like-this";document.querySelector("#generation-search").dispatchEvent(new Event("input"))');
  assert.equal(await evaluate('document.querySelectorAll(".generation-card:not([hidden])").length'), 0);
  evidence.checks.push('45 avatars; one studio action; default A-Z and Z-A sorting; combined role/equipment/search filters and reset');
  for (const path of ['/evolution/avatars/trellis', '/evolution/avatars/trellis/avatar/c_astra', '/evolution/avatars/trellis/avatar/c_solana']) {
    await navigate(path);
    for (const width of [1440, 1000, 768, 390, 320]) {
      await viewport(width, width < 500 ? 844 : 1000);
      const size = await evaluate('({width:innerWidth,content:document.documentElement.scrollWidth})');
      assert.ok(size.content <= size.width + 1, path + ': overflow at ' + width + ': ' + size.content);
      evidence.viewports.push({ path, ...size });
      if (width === 1440 || width === 390) {
        if (path.endsWith('trellis')) {
          await evaluate('document.querySelector(".roster-heading").scrollIntoView()');
          await until('[...document.querySelectorAll(".studio-avatar-art img")].filter(img=>img.getBoundingClientRect().top<innerHeight && img.getBoundingClientRect().bottom>0).every(img=>img.complete && img.naturalWidth>0)');
        } else {
          await evaluate('document.querySelector(".asset-workspace").scrollIntoView()');
        }
        await screenshot('avatar-studio-' + path.split('/').at(-1) + '-' + width + '.png');
      }
    }
  }
  await viewport(1440);
  await navigate('/evolution/avatars/trellis/avatar/c_astra');
  await until('document.querySelector(".asset-workspace")?.dataset.bound === "true"');
  assert.equal(await evaluate('document.querySelectorAll(".asset-editor-card").length'), 3);
  await evaluate('document.querySelector(\'a[href="#asset-prompts"]\').click();document.querySelector(\'[data-prompt-tab="secondary"]\').click()');
  assert.equal(await evaluate('document.querySelector("#asset-prompts").open'), true);
  assert.deepEqual(await evaluate('[...document.querySelectorAll("[data-prompt-panel]")].filter(p=>!p.hidden).map(p=>p.dataset.promptPanel)'), ['secondary']);
  await evaluate('document.querySelector("#prompt-secondary").value="Client-only edit";document.querySelector("#prompt-secondary").dispatchEvent(new Event("input",{bubbles:true}))');
  assert.equal(await evaluate('document.querySelector("[data-prompt-save-status]").textContent'), 'Unsaved prompt changes');
  await evaluate('document.querySelector(\'[data-reset-prompt="secondary"]\').click()');
  assert.equal(await evaluate('document.querySelector("#prompt-secondary").value===document.querySelector("#prompt-secondary").dataset.default'), true);
  await evaluate('Object.defineProperty(navigator,"clipboard",{configurable:true,value:{writeText:()=>Promise.reject(Error("Test denial"))}});document.querySelector(\'[data-copy-prompt="secondary"]\').click()');
  await until('document.querySelector(\'[data-prompt-feedback="secondary"]\').textContent.includes("Ctrl+C")');
  await evaluate('document.querySelector(\'[data-prompt-tab="body"]\').click();const input=document.querySelector("input[name=reference]");const dt=new DataTransfer();dt.items.add(new File([new Uint8Array([137,80,78,71])],"client-preview.png",{type:"image/png"}));input.files=dt.files;input.dispatchEvent(new Event("change"))');
  assert.equal(await evaluate('document.querySelector("[data-preview=body] img").src.startsWith("blob:")'), true);
  await evaluate('(()=>{const input=document.querySelector("input[name=reference]"),dt=new DataTransfer();dt.items.add(new File([new Uint8Array(13*1024*1024)],"oversized.png",{type:"image/png"}));input.files=dt.files;input.dispatchEvent(new Event("change"))})()');
  assert.equal(await evaluate('document.querySelector("input[name=reference]").validity.customError'), true);
  evidence.checks.push('Three-slot editor; prompt tabs/edit/reset/clipboard fallback; file preview and size validation');
  // Clear only the browser dirty flag, without submitting a save.
  await evaluate('document.querySelector("[data-prompt-form]").addEventListener("submit",e=>e.preventDefault(),{once:true});document.querySelector("[data-prompt-form]").dispatchEvent(new Event("submit",{cancelable:true}))');
  await navigate('/evolution/avatars/trellis/avatar/c_solana');
  await until('document.querySelector(".asset-workspace")?.dataset.bound === "true"');
  assert.equal(await evaluate('document.querySelector("[data-preview=body] img").naturalWidth>1'), true);
  await evaluate('window.confirm=()=>false;const form=document.querySelector("form[data-confirm]");form.addEventListener("submit",e=>{window.__deletePrevented=e.defaultPrevented;e.preventDefault()},{once:true});form.requestSubmit()');
  assert.equal(await evaluate('window.__deletePrevented'), true);
  evidence.checks.push('Original Dawnna reference intact; cancelled removal sends no request');
  if (await evaluate('!!document.querySelector("#generation-stage")')) {
    await until('window.__trellisPreview?.ready === true', 45000);
    for (const width of [1440, 390, 320]) {
      await viewport(width, 1000);
      const size = await evaluate('({width:innerWidth,content:document.documentElement.scrollWidth})');
      assert.ok(size.content <= size.width + 1, 'Model preview overflow at ' + width);
      evidence.viewports.push({ path: 'model-preview', ...size });
    }
    evidence.checks.push('Actual generated GLB loads directly inside the avatar studio at desktop/mobile widths');
  }
  await navigate('/evolution/avatars/preparation');
  const chronological = await evaluate('[...document.querySelectorAll("[data-preparation-id]")].map(row=>Number(row.dataset.created))');
  assert.deepEqual(chronological, [...chronological].sort((a,b)=>a-b));
  assert.equal(await evaluate('[...document.querySelectorAll(".preparation-job")].every(row=>row.querySelectorAll(\'input[value="pause"]\').length<=1)'), true);
  assert.equal(await evaluate('[...document.querySelectorAll(".job-timeline")].every(list=>{const times=[...list.querySelectorAll("[data-event-at]")].map(row=>Number(row.dataset.eventAt));return times.every((time,i)=>i===0||time>=times[i-1]);})'), true);
  for (const width of [1440, 768, 390, 320]) {
    await viewport(width, 1000);
    const size = await evaluate('({width:innerWidth,content:document.documentElement.scrollWidth})');
    assert.ok(size.content <= size.width+1, 'Preparation page overflow at '+width);
    evidence.viewports.push({path:'preparation',...size});
    if(width===1440||width===390) {
      await evaluate('document.querySelector(".preparation-history").scrollIntoView()');
      await screenshot('preparation-refined-'+width+'.png');
    }
  }
  const reportPath = await evaluate('document.querySelector(".job-main-actions a[href$=report]")?.getAttribute("href")');
  if(reportPath) {
    await evaluate('document.querySelector("#live-reports").insertAdjacentHTML("beforeend",\'<article data-ui-fixture data-status-category="failed"><input class="preparation-select" type="checkbox" name="ids[]" form="preparation-bulk-delete" value="ui-failed"></article><article data-ui-fixture data-status-category="ready"><input class="preparation-select" type="checkbox" name="ids[]" form="preparation-bulk-delete" value="ui-ready"></article>\');document.querySelector(\'#live-reports [data-category="failed"]\').click();document.querySelector("#preparation-select-all").click()');
    assert.deepEqual(await evaluate('[...document.querySelectorAll("[data-ui-fixture] input")].map(input=>input.checked)'),[true,false]);
    await evaluate('document.querySelector(\'#live-reports [data-category="ready"]\').click()');
    assert.equal(await evaluate('document.querySelector(\'input[value="ui-failed"]\').checked'),false);
    await evaluate('document.querySelectorAll("[data-ui-fixture]").forEach(row=>row.remove());document.querySelector(\'#live-reports [data-category="all"]\').click();document.querySelector("#preparation-clear-selection").click()');
    await evaluate('const order=document.querySelector(\'[data-list-controls="#live-reports"] [data-list-sort]\');order.value="newest";order.dispatchEvent(new Event("change"));document.querySelector("[id^=preparation-events-]").open=false');
    await evaluate('new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(Error("Missing live refresh")),18000);document.querySelector("#live-reports").addEventListener("reports:refreshed",()=>{clearTimeout(timer);resolve(true)},{once:true});})');
    assert.equal(await evaluate('document.querySelector(\'[data-list-controls="#live-reports"] [data-list-sort]\').value'), 'newest');
    assert.equal(await evaluate('document.querySelector("[id^=preparation-events-]").open'), false);
    await navigate(new URL(reportPath).pathname);
    assert.equal(await evaluate('document.querySelectorAll(".preparation-job").length'),1);
    assert.equal(await evaluate('document.querySelectorAll(".preparation-select").length'),0);
    const json = await evaluate('fetch(location.pathname+"?format=json",{credentials:"same-origin"}).then(async response=>({status:response.status,id:(await response.json()).preparation.id,download:response.headers.get("content-disposition")}))');
    assert.equal(json.status,200);assert.ok(json.download.includes('attachment'));
    for(const width of [1440,390,320]) {
      await viewport(width,1000);
      const size=await evaluate('({width:innerWidth,content:document.documentElement.scrollWidth})');
      assert.ok(size.content<=size.width+1,'Full report overflow at '+width);
      evidence.viewports.push({path:'full-report',...size});
      if(width===1440) await screenshot('preparation-report-1440.png');
    }
    evidence.checks.push('Chronological jobs/events; one pause action; live refresh preserves sort and closed timeline; readable scoped report and JSON download');
  }
  assert.deepEqual(errors, []);
  evidence.uncaughtErrors = errors;
  await writeFile(reviewRoot + '/avatar-studio-verification.json', JSON.stringify(evidence, null, 2));
  console.log(JSON.stringify(evidence));
});
