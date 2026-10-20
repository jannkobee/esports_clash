// Read-only owner UI review. Run from the repository root; no jobs/settings or
// deletions are submitted. BROWSER_PATH can select a local Chrome/Chromium.
import { withBrowser } from './backoffice-browser.mjs';
import { writeFile } from 'node:fs/promises';
import assert from 'node:assert/strict';
await withBrowser(async ({ send, evaluate, until, navigate, viewport, screenshot, pause, errors, reviewRoot }) => {
  const result = { afterLogin: await evaluate(`({account:!!document.querySelector('.account-block'),csrfMatches:document.querySelector('meta[name=csrf-token]').content===document.querySelector('input[name=_token]')?.value})`) };
  assert.ok(result.afterLogin.account && result.afterLogin.csrfMatches);
  console.log('Sign-in header and CSRF passed');

  await evaluate(`document.querySelector('.report-nav a[href$="/avatars/preparation"]').click()`);
  await until(`document.readyState === 'complete' && !!document.querySelector('#preparation-delete-selected')?.disabled`);
  result.preparationViaNav = await evaluate(`({disabled:document.querySelector('#preparation-delete-selected').disabled,confirmed:document.querySelector('#preparation-delete-confirm').checked})`);
  assert.ok(result.preparationViaNav.disabled && !result.preparationViaNav.confirmed);
  // Client-only reports exercise controls without submitting a deletion or job.
  await evaluate(`(()=>{const reports=document.querySelector('#live-reports');reports.insertAdjacentHTML('beforeend','<article data-ui-fixture class="run-row" data-status-category="review"><input class="preparation-select" type="checkbox" name="ids[]" value="ui-only" form="preparation-bulk-delete"></article>');reports.dispatchEvent(new Event('reports:refreshed'));document.querySelector('#preparation-select-all').click();document.querySelector('#preparation-delete-confirm').click();})()`);
  assert.equal(await evaluate(`document.querySelector('#preparation-delete-selected').disabled`), false);
  await evaluate(`document.querySelector('#preparation-clear-selection').click()`);
  assert.equal(await evaluate(`document.querySelector('#preparation-delete-selected').disabled`), true);
  await evaluate(`document.querySelector('[data-ui-fixture]').remove();document.querySelector('#live-reports').dispatchEvent(new Event('reports:refreshed'))`);
  console.log('Preparation controls after tab navigation passed');

  // Preserve a real category across the next live report refresh and rebind it.
  await evaluate(`document.querySelector('#live-reports .category-pill[data-category=review]').click()`);
  await evaluate(`new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(Error('No live refresh')),18000);document.querySelector('#live-reports').addEventListener('reports:refreshed',()=>{clearTimeout(timer);resolve(true)},{once:true});})`);
  assert.equal(await evaluate(`document.querySelector('#live-reports .category-pill.active').dataset.category`), 'review');
  await evaluate(`document.querySelector('#live-reports .category-pill[data-category=all]').click()`);
  assert.equal(await evaluate(`document.querySelector('#live-reports .category-pill.active').dataset.category`), 'all');
  result.liveFiltersPreserved = true;

  await evaluate(`document.querySelector('.report-nav a[href$="/avatars/trellis"]').click()`);
  await until(`document.readyState === 'complete' && !!document.querySelector('#generation-search')`);
  await evaluate(`document.querySelector('#generation-search').value='Arsenaldo';document.querySelector('#generation-search').dispatchEvent(new Event('input'))`);
  const visibleCount = () => evaluate(`([...document.querySelectorAll('.generation-card')].filter(card=>getComputedStyle(card).display!=='none')).length`);
  assert.equal(await visibleCount(), 1);
  const category = await evaluate(`document.querySelector('.generation-card:not([hidden])').dataset.statusCategory`);
  await evaluate(`document.querySelector('.category-filter-bar[data-target="#generation-roster"] .category-pill[data-category=${category}]').click()`);
  assert.equal(await visibleCount(), 1);
  await evaluate(`document.querySelector('#generation-search').value='no-such-character';document.querySelector('#generation-search').dispatchEvent(new Event('input'))`);
  assert.equal(await visibleCount(), 0);
  assert.ok(await evaluate(`document.querySelector('#generation-filter-status').textContent.includes('No avatars match')`));
  await evaluate(`document.querySelector('#generation-search').value='';document.querySelector('#generation-search').dispatchEvent(new Event('input'));document.querySelector('.category-filter-bar[data-target="#generation-roster"] .category-pill[data-category=all]').click()`);
  assert.equal(await visibleCount(), 45);
  result.combinedSearchAndCategory = true;
  console.log('Search, categories and empty results passed');

  // Toast content is text, and dismiss works with and without motion.
  await evaluate(`window.Evolution.showToast('<strong>UI-only notification</strong>','info',10000)`);
  assert.equal(await evaluate(`document.querySelector('.toast-body strong')`), null);
  await evaluate(`document.querySelector('.toast-close').click()`);
  await until(`!document.querySelector('.toast')`);
  await send('Emulation.setEmulatedMedia',{features:[{name:'prefers-reduced-motion',value:'reduce'}]});
  await evaluate(`window.Evolution.showToast('UI-only notification','info',100)`);
  await until(`!document.querySelector('.toast')`);
  await send('Emulation.setEmulatedMedia',{features:[]});
  result.toastDismissal = true;

  // A canceled form must never reach the shared AJAX handler.
  await evaluate(`window.__uiPosts=0;window.__nativeFetch=window.fetch;window.fetch=(...args)=>{if(args[1]?.method==='POST')window.__uiPosts++;return window.__nativeFetch(...args)};const f=document.createElement('form');f.action='/evolution/settings';f.method='post';f.dataset.uiFixture='true';f.addEventListener('submit',e=>e.preventDefault());document.querySelector('main').append(f);f.requestSubmit();`);
  assert.equal(await evaluate(`window.__uiPosts`), 0);
  await evaluate(`document.querySelector('[data-ui-fixture]').remove();window.fetch=window.__nativeFetch`);
  result.cancelledFormsRespected = true;

  // The real editor must keep its dirty-state review guard after navigation.
  await navigate('/evolution/management/avatar');
  const editorPath = await evaluate(`new URL(document.querySelector('.manage-card').href).pathname`);
  await navigate(editorPath);
  await until(`document.querySelector('#content-editor')?.dataset.ready === 'true'`);
  await evaluate(`(()=>{const field=document.querySelector('#brief-appearancePrompt');field.value+=' UI-only probe';field.dispatchEvent(new Event('input',{bubbles:true}));const form=document.querySelector('form[data-saved-action]');form.addEventListener('submit',event=>{window.__reviewWasBlocked=event.defaultPrevented;event.preventDefault()},{once:true});form.requestSubmit();})()`);
  assert.equal(await evaluate(`window.__reviewWasBlocked`),true);
  assert.ok(await evaluate(`document.querySelector('[data-save-status]').textContent.includes('Save your changes first')`));
  // Reset only the in-memory dirty flag, without submitting a save.
  await evaluate(`document.querySelector('#content-editor').dispatchEvent(new Event('submit'))`);
  result.unsavedReviewGuard = true;

  for (const [path, id] of [['/evolution','modal-ml-settings'],['/evolution/avatars/trellis','modal-generation-settings']]) {
    await navigate(path);
    await viewport(320,844);
    await evaluate(`document.getElementById('${id}').showModal()`);
    const dialog = await evaluate(`(()=>{const dialog=document.getElementById('${id}'),r=dialog.getBoundingClientRect(),close=dialog.querySelector('.modal-close').getBoundingClientRect();return {width:r.width,bottom:r.bottom,top:r.top,closeTop:close.top,closeBottom:close.bottom,viewport:innerWidth,height:innerHeight}})()`);
    assert.ok(dialog.width<=dialog.viewport && dialog.top>=0 && dialog.bottom<=dialog.height+1);
    assert.ok(dialog.closeTop>=0 && dialog.closeBottom<=dialog.height);
    await evaluate(`document.getElementById('${id}').querySelector('.modal-close').click()`);
    assert.equal(await evaluate(`document.getElementById('${id}').open`),false);
  }
  result.smallScreenDialogs = true;

  await viewport(1440);
  await navigate('/evolution/avatars');
  await evaluate(`document.querySelector('#analysis-cycles').insertAdjacentHTML('beforeend','<div data-ui-fixture class="run-row" data-status-category="failed">Client-only failed row</div><div data-ui-fixture class="run-row" data-status-category="valid">Client-only valid row</div>');document.querySelector('#analysis-cycles .category-pill[data-category=failed]').click()`);
  assert.deepEqual(await evaluate(`[...document.querySelectorAll('[data-ui-fixture]')].map(row=>({category:row.dataset.statusCategory,hidden:row.hidden}))`),[{category:'failed',hidden:false},{category:'valid',hidden:true}]);
  await evaluate(`document.querySelectorAll('[data-ui-fixture]').forEach(node=>node.remove())`);
  result.enhancementFilters = true;

  result.pages = [];
  for (const path of ['/evolution/management/avatar','/evolution/management/item/create','/evolution','/evolution/avatars/trellis','/evolution/avatars/preparation','/evolution/avatars','/evolution/ml/reports','/evolution/avatars/reports']) {
    await navigate(path);
    for (const width of [1440, 768, 390, 320]) {
      await viewport(width, width <= 390 ? 844 : 1000);
      const info = await evaluate(`({title:document.querySelector('h1').textContent,viewport:document.documentElement.clientWidth,content:document.documentElement.scrollWidth,header:document.querySelector('.topbar').getBoundingClientRect().height})`);
      result.pages.push({ path, ...info });
      assert.ok(info.content <= info.viewport + 1, `${path} overflow at ${width}: ${info.content} > ${info.viewport}`);
      if (width === 390) await screenshot(`after-${path.split('/').filter(Boolean).slice(-1)[0]}-mobile.png`);
    }
    console.log(`Responsive layout passed: ${path}`);
  }

  await viewport(1440);
  await navigate('/evolution/management/item/create');
  assert.equal(await evaluate(`getComputedStyle(document.querySelector('.manage-stat-grid')).display`), 'grid');
  await screenshot('after-editor-desktop.png');
  await navigate('/evolution/avatars/trellis');
  const previewPath=await evaluate(`new URL(document.querySelector('a[href$="/preview"]').href).pathname`);
  await navigate(previewPath);
  await until(`window.__trellisPreview?.ready === true`,65000);
  result.preview=await evaluate(`({ready:window.__trellisPreview.ready,height:document.querySelector('#generation-stage').clientHeight,canvasHeight:document.querySelector('#generation-stage canvas').clientHeight,triangles:window.__trellisPreview.triangles})`);
  assert.ok(result.preview.height >= 360 && result.preview.canvasHeight >= 360);
  await screenshot('after-preview-desktop.png');
  await viewport(390,844);
  assert.ok(await evaluate(`document.documentElement.scrollWidth<=document.documentElement.clientWidth+1`));
  await evaluate(`document.querySelector('#generation-stage').scrollIntoView({block:'center'})`);
  await screenshot('after-preview-mobile.png');
  result.errors=errors;
  assert.deepEqual(errors,[]);
  result.noJobsOrDeletesSubmitted=true;
  result.verifiedAt=new Date().toISOString();
  await writeFile(`${reviewRoot}/audit-after.json`,JSON.stringify(result,null,2));
  console.log(JSON.stringify({ownerLogin:true,viewportChecks:result.pages.length,preview:result.preview,errors,noJobsOrDeletesSubmitted:true}));
});
