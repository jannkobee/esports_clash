// Isolated live-arena rendering, controls and exact fixed-tick state/RNG comparison.
import assert from 'node:assert/strict';
import { writeFile } from 'node:fs/promises';
const port = process.env.CDP_PORT ?? '9223', vite = process.env.VITE_PORT ?? '5174';
const outputPrefix = process.env.OUTPUT_PREFIX ?? 'arena-3d';
assert.match(outputPrefix, /^[a-z0-9-]+$/);
const page = (await (await fetch(`http://127.0.0.1:${port}/json/list`)).json()).find(p => p.type === 'page');
const ws = new WebSocket(page.webSocketDebuggerUrl);
await new Promise(done => ws.addEventListener('open', done, { once: true }));
let id = 0; const pending = new Map(), errors = [];
ws.addEventListener('message', event => {
  const reply = JSON.parse(event.data);
  if (reply.method === 'Runtime.exceptionThrown') errors.push(reply.params.exceptionDetails.exception?.description ?? reply.params.exceptionDetails.text);
  if (!reply.id) return;
  const request = pending.get(reply.id); pending.delete(reply.id);
  reply.error ? request.reject(Error(JSON.stringify(reply.error))) : request.resolve(reply.result);
});
const send = (method, params = {}) => new Promise((resolve, reject) => {
  const next = ++id; pending.set(next, { resolve, reject }); ws.send(JSON.stringify({ id: next, method, params }));
});
const evaluate = async expression => {
  const r = await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
  if (r.exceptionDetails) throw Error(r.exceptionDetails.exception?.description ?? r.exceptionDetails.text);
  return r.result.value;
};
const delay = ms => new Promise(done => setTimeout(done, ms));
const waitFor = async expression => {
  for (let i = 0; i < 100; i++) { if (await evaluate(expression)) return; await delay(100); }
  throw Error(`Timed out: ${expression}`);
};
const click = text => evaluate(`[...document.querySelectorAll('.spectator-toolbar button')].find(b => b.textContent.trim() === ${JSON.stringify(text)})?.click()`);
const inspect = () => evaluate('window.__esportsPairedInspect()');
const startPaused = async () => {
  await waitFor(`!!document.querySelector('[aria-label="Pause match"]')`);
  await evaluate(`document.querySelector('[aria-label="Pause match"]').click()`);
  await waitFor('!!window.__esportsPairedInspect');
  assert.equal((await inspect()).second, 0);
  await evaluate('window.releaseArenaFrames()');
  await waitFor('!!window.arenaRenderer()');
};
const screenshot = async name => {
  const r = await send('Page.captureScreenshot', { format: 'png' });
  await writeFile(`../docs/${name}.png`, Buffer.from(r.data, 'base64'));
};
try {
  await send('Page.enable'); await send('Runtime.enable');
  await send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 1000, deviceScaleFactor: 1, mobile: false });
  await send('Page.navigate', { url: `http://127.0.0.1:${vite}/` });
  await waitFor('!!document.querySelector("nav button")');
  await evaluate(`(async () => {
    sessionStorage.setItem('esports-clash-macro-experiment', '1');
    sessionStorage.setItem('esports-clash-macro-pair-mode', 'scout');
    sessionStorage.setItem('esports-clash-macro-pair-filter', 'audit-only');
    sessionStorage.setItem('esports-clash-macro-pair-after', '900');
    const React = (await import('/node_modules/.vite/deps/react.js')).default;
    const clientModule = await import('/node_modules/.vite/deps/react-dom_client.js');
    const createRoot = clientModule.createRoot ?? clientModule.default.createRoot;
    const {AramMatchView} = await import('/src/components/AramMatchView.tsx');
    const {INITIAL_PLAYERS,CHAMPIONS,INITIAL_COACHES} = await import('/src/mockData.ts');
    document.querySelector('#root').style.display = 'none';
    // Hold only this disposable page's RAF until the real Pause control commits.
    // This gives each mount the exact same zero-tick start without a production debug prop.
    const nativeRAF = window.requestAnimationFrame.bind(window), nativeCancel = window.cancelAnimationFrame.bind(window);
    let heldId = 0; const held = new Map();
    window.requestAnimationFrame = callback => window.holdArenaFrames ? (held.set(--heldId,callback),heldId) : nativeRAF(callback);
    window.cancelAnimationFrame = id => id < 0 ? held.delete(id) : nativeCancel(id);
    window.releaseArenaFrames = () => { window.holdArenaFrames = false; for (const callback of held.values()) nativeRAF(callback); held.clear(); };
    window.mountArena = () => {
      window.holdArenaFrames = true;
      if (window.fixtureRoot) window.fixtureRoot.unmount();
      window.__esportsMacroExecutionAudit = undefined;
      window.__esportsMacroOpportunityAudit = undefined;
      window.__esportsPairedMacro = undefined;
      document.querySelector('#arena-fixture')?.remove();
      const host = document.createElement('div'); host.id = 'arena-fixture'; document.body.append(host);
      const avatars = [CHAMPIONS.find(c => c.name === 'Kaelen'), ...CHAMPIONS.filter(c => c.name !== 'Kaelen').slice(0,9)];
      const lineup = avatars.map((champion,i) => ({champion,player:INITIAL_PLAYERS[i]}));
      window.fixtureRoot = createRoot(host);
      window.fixtureRoot.render(React.createElement(AramMatchView, {seed:47, blueLineup:lineup.slice(0,5),redLineup:lineup.slice(5),
        blueCoach:INITIAL_COACHES[0],redCoach:INITIAL_COACHES[0],onReplay:()=>{},onBatchStart:()=>{},onBatchStop:()=>{},onMatchComplete:()=>{},onExit:()=>{}}));
    };
    window.arenaRenderer = () => {
      const walk = fiber => !fiber ? null : fiber.type?.name === 'AramMatchView' ? fiber : walk(fiber.child) || walk(fiber.sibling);
      for (let hook = walk(window.fixtureRoot._internalRoot.current)?.memoizedState; hook; hook = hook.next)
        if (typeof hook.memoizedState?.current?.renderArena === 'function') return hook.memoizedState.current;
    };
    window.mountArena();
  })()`);
  await startPaused();
  await waitFor('document.querySelector(".spectator-three-host").dataset.actors > 10');
  if (process.env.REQUIRE_GLB === '1') await waitFor(`(() => {
    const actors = [...window.arenaRenderer().arena.actors.values()].filter(actor => actor.avatar);
    return actors.length === 10 && actors.every(actor => actor.body.userData.assetFormat === 'glb');
  })()`);
  const three = [];
  for (let i = 0; i < 3; i++) {
    assert.equal(await evaluate('window.__esportsPairedStep(900)'), true);
    await delay(150); three.push(await inspect());
  }
  // Restart the paused presentation loop through a real speed control so HUD
  // publishes the fixture's exact stepped time/roster before taking screenshots.
  await click('2x'); await delay(150);
  const viewports = [];
  for (const [width, height] of [[1440,1000], [1366,768], [390,844]]) {
    await send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile: false });
    await delay(200);
    const info = await evaluate(`(() => {
      const host = document.querySelector('.spectator-three-host'), stack = host.parentElement;
      const a=host.getBoundingClientRect(), b=document.querySelector('.spectator-canvas-overlay').getBoundingClientRect();
      return {view:stack.dataset.view,renderer:host.dataset.renderer,actors:Number(host.dataset.actors),
        aligned:a.width===b.width && a.height===b.height,overflow:document.querySelector('.spectator-shell').scrollWidth>innerWidth,
        calls:window.arenaRenderer().renderer.info.render.calls,triangles:window.arenaRenderer().renderer.info.render.triangles};
    })()`);
    assert.equal(info.view, '3d'); assert.equal(info.renderer, 'three'); assert.ok(info.actors > 10 && info.aligned && !info.overflow);
    viewports.push({width,height,...info});
    await screenshot(`${outputPrefix}-${width === 390 ? 'mobile' : width === 1440 ? 'desktop' : 'laptop'}`);
  }
  const beforeControls = await inspect();
  await click('3D arena'); await delay(150);
  assert.equal(await evaluate('document.querySelector(".spectator-render-stack").dataset.view'), '2d');
  await click('2D tactical'); await delay(150);
  await evaluate(`document.querySelector('[aria-label="Zoom in"]').click()`);
  await delay(150);
  const stage = await evaluate(`(() => { const r=document.querySelector('.spectator-canvas-overlay').getBoundingClientRect();
    return {x:r.x,y:r.y,width:r.width,height:r.height}; })()`);
  const center = { x:stage.x+stage.width/2, y:stage.y+stage.height/2 };
  const cameraX = () => evaluate('window.arenaRenderer().arena.camera.position.x');
  const beforePan = await cameraX();
  await send('Input.dispatchMouseEvent', {type:'mousePressed',...center,button:'left',buttons:1,clickCount:1});
  await send('Input.dispatchMouseEvent', {type:'mouseMoved',x:center.x+45,y:center.y,button:'left',buttons:1});
  await send('Input.dispatchMouseEvent', {type:'mouseReleased',x:center.x+45,y:center.y,button:'left',buttons:0,clickCount:1});
  await delay(150);
  assert.ok(await cameraX() < beforePan - 1, 'mouse drag pans on the tilted ground plane');
  const beforeTouch = await cameraX();
  await send('Input.dispatchTouchEvent', {type:'touchStart',touchPoints:[center]});
  await send('Input.dispatchTouchEvent', {type:'touchMove',touchPoints:[{x:center.x+30,y:center.y}]});
  await send('Input.dispatchTouchEvent', {type:'touchEnd',touchPoints:[]});
  await delay(150);
  assert.ok(await cameraX() < beforeTouch - 1, 'touch drag pans the same ground plane');
  const mapWidth = Math.min(180,stage.width*.3);
  const mapCenter = {x:stage.x+stage.width-12-mapWidth/2,y:stage.y+stage.height-12-mapWidth*760/2600/2};
  await send('Input.dispatchMouseEvent', {type:'mousePressed',...mapCenter,button:'left',buttons:1,clickCount:1});
  await send('Input.dispatchMouseEvent', {type:'mouseReleased',...mapCenter,button:'left',buttons:0,clickCount:1});
  await delay(150);
  // CDP mouse client coordinates round to integer CSS pixels on this surface.
  assert.ok(Math.abs(await cameraX() - 1300) < 2600 / mapWidth, 'minimap centers within one CSS pixel of requested world point');
  assert.deepEqual(await inspect(), beforeControls, 'view and camera changes must preserve paused simulation');
  // Real WebGL loss/restoration, rather than only dispatching synthetic DOM events.
  await evaluate('window.arenaLoss = window.arenaRenderer().renderer.getContext().getExtension("WEBGL_lose_context"); window.arenaLoss.loseContext()');
  await waitFor('document.querySelector(".spectator-three-host").dataset.renderer === "canvas-fallback"');
  assert.equal(await evaluate('document.querySelector(".spectator-render-stack").dataset.view'), '2d');
  await evaluate('window.arenaLoss.restoreContext()');
  await waitFor('document.querySelector(".spectator-render-stack").dataset.view === "3d"');
  assert.deepEqual(await inspect(), beforeControls);
  // New mount, identical seed/draft/initial tick, actual 2D rendering between fixed-step batches.
  await evaluate('window.mountArena()');
  await startPaused();
  await click('3D arena'); await delay(100);
  const two = [];
  for (let i = 0; i < 3; i++) {
    assert.equal(await evaluate('window.__esportsPairedStep(900)'), true);
    await delay(150); two.push(await inspect());
    assert.deepEqual(two[i], three[i], `3D and 2D full state/RNG at ${(i+1)*30}s`);
  }
  const resources = await evaluate(`(() => {
    const renderer = window.arenaRenderer(), dispose = renderer.dispose.bind(renderer);
    renderer.dispose = () => (window.arenaDisposal = dispose());
    window.fixtureRoot.unmount(); return window.arenaDisposal;
  })()`);
  assert.equal(await evaluate('document.querySelectorAll(".spectator-three-terrain").length'), 0);
  assert.ok(resources.geometries > 8 && resources.materials > 12);
  assert.deepEqual(errors, []);
  await writeFile(`../docs/${outputPrefix}-verification.json`, JSON.stringify({ date:'2026-10-17',seed:47,viewports,
    exactStateAndRngAtSeconds:three.map(s=>s.second),three,two,mousePan:true,touchPan:true,minimapNavigation:true,
    contextLossAndRestoration:true,glbModelsRequired:process.env.REQUIRE_GLB === '1',resources,errors,
    limits:'Controlled 90-second fixture; no full-match, mobile-device or frame-time performance claim.' },null,2)+'\n');
  console.log('3D viewports, view switch, WebGL recovery, disposal and exact 90-second state/RNG comparison passed.');
} finally { if(errors.length) console.error(errors); ws.close(); }
