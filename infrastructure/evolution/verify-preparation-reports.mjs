import { withBrowser } from './backoffice-browser.mjs';
import assert from 'node:assert/strict';
import { writeFile } from 'node:fs/promises';

await withBrowser(async ({ send, evaluate, until, navigate, viewport, screenshot, errors, reviewRoot }) => {
  const evidence = { reports: {}, layouts: [], hoverChecks: 0, checkbox: {} };
  await send('DOM.enable');
  await send('CSS.enable');
  await navigate('/evolution/avatars/preparation');
  const reports = await evaluate(`([...document.querySelectorAll('.preparation-job')].map(row=>({
    id:row.dataset.preparationId, name:row.dataset.name, status:row.querySelector('.badge').textContent.trim(),
    attempts:row.querySelectorAll('[id^="preparation-attempt-"]').length,
    events:[...row.querySelectorAll('[data-event-at]')].map(event=>Number(event.dataset.eventAt))
  })))`);
  assert.equal(new Set(reports.map(row => row.id)).size, reports.length);
  for (const report of reports) assert.deepEqual(report.events, [...report.events].sort((a, b) => a - b));
  const dawnna = reports.find(row => row.name === 'Dawnna');
  assert.ok(dawnna, 'The retained Dawnna source report must be present');
  assert.equal(reports.filter(row => row.name === 'Dawnna').length, 1);
  assert.ok(dawnna.attempts>=3, 'All retained attempts remain inside one report');
  evidence.reports = reports;
  const root = await evaluate('document.querySelector(".preparation-job").dataset.preparationId');
  const attemptIds = await evaluate('[...document.querySelector(".preparation-job").querySelectorAll("[id^=preparation-attempt-]")].map(node=>node.id.slice("preparation-attempt-".length))');
  for (const id of attemptIds) {
    await navigate(`/evolution/avatars/preparation/${id}/report`);
    assert.equal(await evaluate('document.querySelectorAll(".preparation-job").length'), 1);
    assert.equal(await evaluate('document.querySelector(".preparation-job").dataset.preparationId'), root);
    assert.equal(await evaluate('document.querySelectorAll(".mapping-review-notice").length'), 0, 'Historical warnings must not become current attention notices');
  }
  for (const path of ['/evolution/avatars/preparation', `/evolution/avatars/preparation/${root}/report`, '/evolution/avatars/trellis/avatar/c_solana']) {
    await navigate(path);
    for (const width of [1440, 768, 390, 320]) {
      await viewport(width, 1000);
      const layout = await evaluate('({width:innerWidth,content:document.documentElement.scrollWidth})');
      assert.ok(layout.content <= layout.width + 1, `${path} overflows at ${width}: ${layout.content}`);
      evidence.layouts.push({ path, ...layout });
    }
    await viewport(1440);
    const fixture = await evaluate(`(() => {
      const host=document.createElement('div');host.id='hover-verification-fixtures';
      for(const classes of ['', 'primary', 'quiet', 'danger', 'button-danger-subtle', 'quiet danger', 'category-pill', 'category-pill active', 'prompt-copy-btn', 'studio-action-button']) {
        const button=document.createElement('button');button.className=classes;button.textContent=classes||'Default';host.append(button);
      }
      document.querySelector('main').append(host);
      return true;
    })()`);
    assert.ok(fixture);
    const count = await evaluate(`([...document.querySelectorAll('button,.button,.button-tactile,.studio-action-button,.report-nav a')].map((node,index)=>{node.dataset.hoverCheck=index;return node})).length`);
    const document = await send('DOM.getDocument');
    const colors = index => evaluate(`(() => {const s=getComputedStyle(document.querySelector('[data-hover-check="${index}"]'));return {background:s.backgroundColor,color:s.color,border:s.borderColor,shadow:s.boxShadow}})()`);
    for (let index = 0; index < count; index++) {
      const { nodeId } = await send('DOM.querySelector', { nodeId: document.root.nodeId, selector: `[data-hover-check="${index}"]` });
      const normal = await colors(index);
      await send('CSS.forcePseudoState', { nodeId, forcedPseudoClasses: ['hover'] });
      assert.deepEqual(await colors(index), normal, `${path} changes button colors on hover, button ${index}`);
      await send('CSS.forcePseudoState', { nodeId, forcedPseudoClasses: [] });
      evidence.hoverChecks++;
    }
    await evaluate('document.querySelector("#hover-verification-fixtures").remove()');
  }
  await navigate('/evolution/avatars/preparation');
  const checkbox = await evaluate(`(() => {
    const input=document.querySelector('.preparation-select');const s=getComputedStyle(input);
    return {width:s.width,height:s.height,appearance:s.appearance,disabled:input.disabled};
  })()`);
  assert.equal(checkbox.width, '20px'); assert.equal(checkbox.height, '20px'); assert.equal(checkbox.appearance, 'none');
  const initial = await evaluate('document.querySelector(".preparation-select").checked');
  await evaluate('document.querySelector(".preparation-select").focus()');
  await send('Input.dispatchKeyEvent', { type: 'keyDown', key: ' ', code: 'Space', windowsVirtualKeyCode: 32 });
  await send('Input.dispatchKeyEvent', { type: 'keyUp', key: ' ', code: 'Space', windowsVirtualKeyCode: 32 });
  if (!checkbox.disabled) assert.equal(await evaluate('document.querySelector(".preparation-select").checked'), !initial);
  const checked = await evaluate('getComputedStyle(document.querySelector(".preparation-select"),"::after").visibility');
  if (!checkbox.disabled) assert.equal(checked, 'visible');
  await evaluate('document.querySelector("#report-management").open=true');
  await until('document.querySelector("#preparation-selected-count").textContent.includes("selected")');
  evidence.checkbox = { ...checkbox, keyboardToggle: !checkbox.disabled, checkedMark: checked };
  await evaluate('document.querySelector("#preparation-clear-selection").click();document.querySelector("#report-management").open=false');
  await screenshot('preparation-single-report-desktop.png');
  await viewport(390, 844); await screenshot('preparation-single-report-mobile.png');
  assert.deepEqual(errors, []);
  evidence.uncaughtErrors = errors;
  await writeFile(`${reviewRoot}/preparation-report-verification.json`, JSON.stringify(evidence, null, 2));
  console.log(JSON.stringify(evidence));
});
