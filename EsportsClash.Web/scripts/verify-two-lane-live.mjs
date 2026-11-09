import { mkdir, writeFile } from 'node:fs/promises';
import assert from 'node:assert/strict';

const base = process.env.BABYLON_CHECK_URL ?? 'http://localhost:5199';
const cdp = process.env.BABYLON_CDP ?? 'http://127.0.0.1:9338';
const outDir = process.env.OUTPUT_DIR ?? '../docs/two-lane-arena';
await mkdir(outDir, { recursive: true });

const target = await (await fetch(cdp + '/json/new?about:blank', { method: 'PUT' })).json();
const socket = new WebSocket(target.webSocketDebuggerUrl);
await new Promise((resolve, reject) => {
  socket.addEventListener('open', resolve, { once: true });
  socket.addEventListener('error', reject, { once: true });
});

let id = 0;
const pending = new Map();
const errors = [];
socket.addEventListener('message', event => {
  const m = JSON.parse(event.data);
  if (m.method === 'Runtime.exceptionThrown') {
    errors.push(m.params.exceptionDetails.exception?.description ?? m.params.exceptionDetails.text);
  }
  if (m.method === 'Runtime.consoleAPICalled' && m.params.type === 'error') {
    errors.push(m.params.args.map(a => a.value ?? a.description).join(' '));
  }
  const p = pending.get(m.id);
  if (p) {
    pending.delete(m.id);
    clearTimeout(p.timer);
    m.error ? p.reject(Error(JSON.stringify(m.error))) : p.resolve(m.result);
  }
});

const send = (method, params = {}) => new Promise((resolve, reject) => {
  const key = ++id;
  const timer = setTimeout(() => reject(Error(method + ' timed out')), 120000);
  pending.set(key, { resolve, reject, timer });
  socket.send(JSON.stringify({ id: key, method, params }));
});

const evaluate = async expression => {
  const result = await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
  if (result.exceptionDetails) {
    throw Error(result.exceptionDetails.exception?.description ?? result.exceptionDetails.text);
  }
  return result.result.value;
};

const shot = async name => {
  await new Promise(r => setTimeout(r, 800));
  const s = await send('Page.captureScreenshot', { format: 'png' });
  await writeFile(`${outDir}/${name}.png`, Buffer.from(s.data, 'base64'));
};

try {
  await send('Runtime.enable');
  await send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 810, deviceScaleFactor: 1, mobile: false });
  await send('Page.navigate', { url: base });
  await new Promise(resolve => setTimeout(resolve, 4000));

  const report = await evaluate(`(async () => {
    const { BabylonMatchViewer } = await import('/src/match-viewer/BabylonMatchViewer.ts');
    const { buildArenaFeatures, resolveArenaAtmosphere } = await import('/src/match-viewer/battlefieldFeatures.ts');
    const { captureViewerSnapshot } = await import('/src/match-viewer/MatchViewer.ts');
    const { ARENA_WIDTH, ARENA_HEIGHT, OUTER_TOWER_X, INNER_TOWER_X, NEXUS_TOWER_X, NEXUS_X, topLaneY, botLaneY, ACTIVE_MAP_PROFILE } = await import('/src/arenaLayout.ts');

    const host = document.createElement('div');
    host.id = 'two-lane-check';
    host.style.cssText = 'position:fixed;inset:0;background:#071419;z-index:99999';
    document.body.append(host);

    const viewer = await BabylonMatchViewer.create(host, ARENA_WIDTH, ARENA_HEIGHT, 0, ARENA_WIDTH, () => {});
    window.twoLaneViewer = viewer;

    const { barracksPosition } = await import('/src/arenaLandform.ts');
    const makeBarracks = (team) =>
      ['melee', 'ranged', 'catapult'].map((kind) => ({
        id: (team === 'blue' ? 'b_' : 'r_') + kind + '_barracks',
        team,
        type: 'barracks',
        barracksKind: kind,
        ...barracksPosition(team, kind),
        hp: 4000,
        maxHp: 4000,
        isAlive: true,
      }));

    // Build authentic structures and units for 2-lane showcase (3 towers per lane + 3 barracks per side + Nexus)
    const structures = [
      { id: 'b_top_t1', team: 'blue', lane: 'top', type: 'outer_tower', x: OUTER_TOWER_X.blue, y: topLaneY(OUTER_TOWER_X.blue), hp: 3600, maxHp: 3600, isAlive: true },
      { id: 'b_top_t2', team: 'blue', lane: 'top', type: 'inner_tower', x: INNER_TOWER_X.blue, y: topLaneY(INNER_TOWER_X.blue), hp: 5000, maxHp: 5000, isAlive: true },
      { id: 'b_top_t3', team: 'blue', lane: 'top', type: 'nexus_tower', x: NEXUS_TOWER_X.blue, y: topLaneY(NEXUS_TOWER_X.blue), hp: 6500, maxHp: 6500, isAlive: true },
      { id: 'b_bot_t1', team: 'blue', lane: 'bot', type: 'outer_tower', x: OUTER_TOWER_X.blue, y: botLaneY(OUTER_TOWER_X.blue), hp: 3600, maxHp: 3600, isAlive: true },
      { id: 'b_bot_t2', team: 'blue', lane: 'bot', type: 'inner_tower', x: INNER_TOWER_X.blue, y: botLaneY(INNER_TOWER_X.blue), hp: 5000, maxHp: 5000, isAlive: true },
      { id: 'b_bot_t3', team: 'blue', lane: 'bot', type: 'nexus_tower', x: NEXUS_TOWER_X.blue, y: botLaneY(NEXUS_TOWER_X.blue), hp: 6500, maxHp: 6500, isAlive: true },
      ...makeBarracks('blue'),
      { id: 'b_nexus', team: 'blue', type: 'nexus', x: NEXUS_X.blue, y: 720, hp: 9000, maxHp: 9000, isAlive: true },
      { id: 'r_top_t1', team: 'red', lane: 'top', type: 'outer_tower', x: OUTER_TOWER_X.red, y: topLaneY(OUTER_TOWER_X.red), hp: 3600, maxHp: 3600, isAlive: true },
      { id: 'r_top_t2', team: 'red', lane: 'top', type: 'inner_tower', x: INNER_TOWER_X.red, y: topLaneY(INNER_TOWER_X.red), hp: 5000, maxHp: 5000, isAlive: true },
      { id: 'r_top_t3', team: 'red', lane: 'top', type: 'nexus_tower', x: NEXUS_TOWER_X.red, y: topLaneY(NEXUS_TOWER_X.red), hp: 6500, maxHp: 6500, isAlive: true },
      { id: 'r_bot_t1', team: 'red', lane: 'bot', type: 'outer_tower', x: OUTER_TOWER_X.red, y: botLaneY(OUTER_TOWER_X.red), hp: 3600, maxHp: 3600, isAlive: true },
      { id: 'r_bot_t2', team: 'red', lane: 'bot', type: 'inner_tower', x: INNER_TOWER_X.red, y: botLaneY(INNER_TOWER_X.red), hp: 5000, maxHp: 5000, isAlive: true },
      { id: 'r_bot_t3', team: 'red', lane: 'bot', type: 'nexus_tower', x: NEXUS_TOWER_X.red, y: botLaneY(NEXUS_TOWER_X.red), hp: 6500, maxHp: 6500, isAlive: true },
      ...makeBarracks('red'),
      { id: 'r_nexus', team: 'red', type: 'nexus', x: NEXUS_X.red, y: 720, hp: 9000, maxHp: 9000, isAlive: true },
    ];

    const camps = ACTIVE_MAP_PROFILE.campRings
      .filter(c => c.id !== 'dragon_boss')
      .map(c => ({ id: c.id, name: c.id, x: c.x, y: c.y, hp: 2200, maxHp: 2200, isAlive: true }));

    const minions = [
      // Top lane wave clashing at river ford + Reinforcement waves marching past outer/inner turrets
      { id: 'm_b_top_1', team: 'blue', lane: 'top', type: 'melee', x: 1335, y: topLaneY(1335) - 10, hp: 480, maxHp: 480, isAlive: true },
      { id: 'm_b_top_2', team: 'blue', lane: 'top', type: 'melee', x: 1345, y: topLaneY(1345) + 12, hp: 480, maxHp: 480, isAlive: true },
      { id: 'm_b_top_3', team: 'blue', lane: 'top', type: 'caster', x: 1290, y: topLaneY(1290) - 14, hp: 320, maxHp: 320, isAlive: true },
      { id: 'm_b_top_4', team: 'blue', lane: 'top', type: 'cannon', x: 1255, y: topLaneY(1255), hp: 950, maxHp: 950, isAlive: true },
      { id: 'm_r_top_1', team: 'red', lane: 'top', type: 'melee', x: 1465, y: topLaneY(1465) - 10, hp: 480, maxHp: 480, isAlive: true },
      { id: 'm_r_top_2', team: 'red', lane: 'top', type: 'melee', x: 1455, y: topLaneY(1455) + 12, hp: 480, maxHp: 480, isAlive: true },
      { id: 'm_r_top_3', team: 'red', lane: 'top', type: 'caster', x: 1510, y: topLaneY(1510) + 14, hp: 320, maxHp: 320, isAlive: true },
      { id: 'm_r_top_4', team: 'red', lane: 'top', type: 'cannon', x: 1545, y: topLaneY(1545), hp: 950, maxHp: 950, isAlive: true },
      // Top lane reinforcement waves marching past turrets
      { id: 'm_b_top_5', team: 'blue', lane: 'top', type: 'melee', x: 640, y: topLaneY(640), hp: 480, maxHp: 480, isAlive: true },
      { id: 'm_b_top_6', team: 'blue', lane: 'top', type: 'caster', x: 590, y: topLaneY(590), hp: 320, maxHp: 320, isAlive: true },
      { id: 'm_r_top_5', team: 'red', lane: 'top', type: 'melee', x: 2160, y: topLaneY(2160), hp: 480, maxHp: 480, isAlive: true },
      { id: 'm_r_top_6', team: 'red', lane: 'top', type: 'caster', x: 2210, y: topLaneY(2210), hp: 320, maxHp: 320, isAlive: true },
      // Bot lane wave clashing at river ford + Reinforcement waves marching past outer/inner turrets
      { id: 'm_b_bot_1', team: 'blue', lane: 'bot', type: 'melee', x: 1340, y: botLaneY(1340) - 10, hp: 480, maxHp: 480, isAlive: true },
      { id: 'm_b_bot_2', team: 'blue', lane: 'bot', type: 'melee', x: 1350, y: botLaneY(1350) + 12, hp: 480, maxHp: 480, isAlive: true },
      { id: 'm_b_bot_3', team: 'blue', lane: 'bot', type: 'caster', x: 1295, y: botLaneY(1295) - 12, hp: 320, maxHp: 320, isAlive: true },
      { id: 'm_b_bot_4', team: 'blue', lane: 'bot', type: 'cannon', x: 1260, y: botLaneY(1260), hp: 950, maxHp: 950, isAlive: true },
      { id: 'm_r_bot_1', team: 'red', lane: 'bot', type: 'melee', x: 1460, y: botLaneY(1460) - 10, hp: 480, maxHp: 480, isAlive: true },
      { id: 'm_r_bot_2', team: 'red', lane: 'bot', type: 'melee', x: 1450, y: botLaneY(1450) + 12, hp: 480, maxHp: 480, isAlive: true },
      { id: 'm_r_bot_3', team: 'red', lane: 'bot', type: 'caster', x: 1505, y: botLaneY(1505) + 12, hp: 320, maxHp: 320, isAlive: true },
      { id: 'm_r_bot_4', team: 'red', lane: 'bot', type: 'cannon', x: 1540, y: botLaneY(1540), hp: 950, maxHp: 950, isAlive: true },
      // Bot lane reinforcement waves marching past turrets
      { id: 'm_b_bot_5', team: 'blue', lane: 'bot', type: 'melee', x: 640, y: botLaneY(640), hp: 480, maxHp: 480, isAlive: true },
      { id: 'm_b_bot_6', team: 'blue', lane: 'bot', type: 'caster', x: 590, y: botLaneY(590), hp: 320, maxHp: 320, isAlive: true },
      { id: 'm_r_bot_5', team: 'red', lane: 'bot', type: 'melee', x: 2160, y: botLaneY(2160), hp: 480, maxHp: 480, isAlive: true },
      { id: 'm_r_bot_6', team: 'red', lane: 'bot', type: 'caster', x: 2210, y: botLaneY(2210), hp: 320, maxHp: 320, isAlive: true },
    ];

    window.mkTwoLaneFrame = (second = 90) => captureViewerSnapshot({
      second,
      champions: [],
      minions,
      structures,
      camps,
      dragon: { id: 'dragon_boss', x: 1400, y: 95, hp: 5200, maxHp: 5200, isAlive: true },
      wards: [],
      projectiles: [],
      spells: [],
      features: buildArenaFeatures({
        second,
        supplyCaptureSeconds: 3,
        scuttlers: [
          { id: 'scuttle_n', x: 1400, y: 420, hp: 80, maxHp: 100, isAlive: true },
          { id: 'scuttle_s', x: 1400, y: 1020, hp: 100, maxHp: 100, isAlive: true }
        ],
        plants: [
          { id: 'p_blast_1', kind: 'blast_cone', x: 1180, y: 460, isAlive: true },
          { id: 'p_bloom_1', kind: 'scryer_bloom', x: 1620, y: 460, isAlive: true },
          { id: 'p_fruit_1', kind: 'honeyfruit', x: 1400, y: 520, isAlive: true },
        ],
        portals: [],
        supplyDrop: null
      }),
      atmosphere: resolveArenaAtmosphere(second, null, 'daylight')
    });

    return { ok: true };
  })()`);

  assert.ok(report.ok, 'Viewer initialized');

  // Warm up WebGL canvas and compile shaders before taking screenshots
  await evaluate(`(() => {
    const f = window.mkTwoLaneFrame(120);
    window.twoLaneViewer.loadSnapshot(f);
    window.twoLaneViewer.draw(1400, 720, 1.05);
  })()`);
  await new Promise(r => setTimeout(r, 2000));

  const views = [
    ['two-lane-overview', 1400, 720, 1.05],
    ['two-lane-top-bridge-dragon', 1400, 195, 2.5],
    ['two-lane-bot-bridge-golem', 1400, 1245, 2.5],
    ['two-lane-center-island-altar', 1400, 720, 2.8],
    ['two-lane-blue-sanctum', 380, 720, 2.1],
    ['two-lane-red-sanctum', 2420, 720, 2.1],
  ];

  const results = [];
  for (const [name, x, y, zoom] of views) {
    const state = await evaluate(`(() => {
      const f = window.mkTwoLaneFrame(120);
      window.twoLaneViewer.loadSnapshot(f);
      window.twoLaneViewer.draw(${x}, ${y}, ${zoom});
      window.twoLaneViewer.draw(${x}, ${y}, ${zoom});
      return { available: window.twoLaneViewer.isAvailable() };
    })()`);
    await shot(name);
    results.push({ name, ...state });
  }

  assert.ok(results.every(r => r.available), 'All views rendered cleanly');
  await writeFile(`${outDir}/report.json`, JSON.stringify({ date: new Date().toISOString(), views: results, errors }, null, 2));
  console.log('Capture report:\n' + JSON.stringify({ results, errors }, null, 2));
} finally {
  try {
    await fetch(cdp + '/json/close/' + target.id);
  } catch {}
  socket.close();
}

