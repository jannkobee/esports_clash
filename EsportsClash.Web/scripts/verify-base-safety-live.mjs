// Disposable real-arena fixtures: both sides, real movement/fire, no learned-policy promotion.
import assert from 'node:assert/strict';
import { writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const pages = await (await fetch(`http://127.0.0.1:${process.env.CDP_PORT ?? 9223}/json/list`)).json();
const page = pages.find(item => item.type === 'page');
const socket = new WebSocket(page.webSocketDebuggerUrl);
await new Promise(done => socket.addEventListener('open', done, { once: true }));
let nextId = 0;
const pending = new Map();
socket.addEventListener('message', event => {
  const result = JSON.parse(event.data);
  const request = pending.get(result.id);
  if (!request) return;
  pending.delete(result.id);
  result.error ? request.reject(Error(JSON.stringify(result.error))) : request.resolve(result.result);
});
const send = (method, params = {}) => new Promise((resolveResult, reject) => {
  const id = ++nextId;
  pending.set(id, { resolve: resolveResult, reject });
  socket.send(JSON.stringify({ id, method, params }));
});
const evaluate = async expression => {
  const reply = await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
  if (reply.exceptionDetails) throw Error(reply.exceptionDetails.exception?.description ?? reply.exceptionDetails.text);
  return reply.result.value;
};
const delay = ms => new Promise(done => setTimeout(done, ms));
const results = [];
const outputPath = resolve('../docs/base-safety-live-evaluation.json');
try {
  for (const team of ['blue', 'red']) for (const scenario of ['well-chase', 'fragile-nexus', 'sealed-nexus', 'legal-finish', 'beam-retreat']) {
    await send('Page.navigate', { url: 'about:blank' });
    await delay(80);
    await send('Page.navigate', { url: `http://127.0.0.1:${process.env.VITE_PORT ?? 5174}/` });
    for (let i = 0; i < 60; i++) {
      if (await evaluate('!!document.querySelector("#root")')) break;
      await delay(100);
    }
    await evaluate(`(async () => {
      sessionStorage.setItem('esports-clash-macro-experiment', '1');
      sessionStorage.setItem('esports-clash-macro-pair-mode', 'scout');
      sessionStorage.setItem('esports-clash-macro-pair-filter', 'fixture-no-assignment');
      sessionStorage.removeItem('esports-clash-macro-scenario');
      sessionStorage.removeItem('esports-clash-macro-pair-target');
      localStorage.removeItem('esports-clash-adaptive-policy');
      window.__esportsPairedMacro = undefined;
      const React = (await import('/node_modules/.vite/deps/react.js')).default;
      const roots = await import('/node_modules/.vite/deps/react-dom_client.js');
      const { AramMatchView } = await import('/src/components/AramMatchView.tsx');
      const { INITIAL_PLAYERS, CHAMPIONS, INITIAL_COACHES } = await import('/src/mockData.ts');
      const avatars = [CHAMPIONS.find(c => c.name === 'Kaelen'), ...CHAMPIONS.filter(c => c.name !== 'Kaelen').slice(0, 9)];
      const lineup = avatars.map((champion, i) => ({ champion, player: INITIAL_PLAYERS[i] }));
      document.querySelector('#root').style.display = 'none';
      const host = document.createElement('div'); document.body.append(host);
      window.fixtureRoot = (roots.createRoot ?? roots.default.createRoot)(host);
      window.fixtureRoot.render(React.createElement(AramMatchView, { seed: 101,
        blueLineup: lineup.slice(0, 5), redLineup: lineup.slice(5),
        blueCoach: INITIAL_COACHES[0], redCoach: INITIAL_COACHES[0],
        onReplay() {}, onBatchStart() {}, onBatchStop() {}, onMatchComplete() {}, onExit() {} }));
    })()`);
    for (let i = 0; i < 60; i++) {
      if (await evaluate(`!!document.querySelector('button[aria-label="Pause match"]')`)) break;
      await delay(100);
    }
    await evaluate(`document.querySelector('button[aria-label="Pause match"]').click()`);
    for (let i = 0; i < 60; i++) {
      if (await evaluate('typeof window.__esportsPairedStep === "function"')) break;
      await delay(20);
    }
    const result = await evaluate(`(() => {
      const team = '${team}', scenario = '${scenario}';
      const opponent = team === 'blue' ? 'red' : 'blue';
      const mirror = x => team === 'blue' ? x : 2600 - x;
      const walk = f => !f ? null : f.type?.name === 'AramMatchView' ? f : walk(f.child) || walk(f.sibling);
      const refs = [];
      for (let h = walk(window.fixtureRoot._internalRoot.current)?.memoizedState; h; h = h.next)
        if (h.memoizedState && typeof h.memoizedState === 'object' && 'current' in h.memoizedState) refs.push(h.memoizedState);
      const index = refs.findIndex(r => Array.isArray(r.current) && r.current.length === 10 && r.current[0]?.champion);
      if (index < 0) throw Error('Champion refs unavailable');
      const units = refs[index].current, structures = refs[index + 2].current;
      refs[index + 1].current = [];
      refs[index + 4].current = [];
      refs[index + 5].current = [];
      refs[index + 7].current = 1000;
      const attackers = units.filter(u => u.team === team);
      const defenders = units.filter(u => u.team !== team);
      attackers.forEach((u, i) => Object.assign(u, { x: mirror(scenario === 'beam-retreat' ? 2490
        : scenario === 'fragile-nexus' ? 2140 : scenario === 'legal-finish' ? 2315 : 2390),
        y: 350 + i * 15, hp: u.maxHp * (scenario === 'fragile-nexus' ? .25 : 1),
        isAlive: true, isRecalling: false, recallIntent: false, cd1: 999, cd2: 999, cdUlt: 999,
        attackTimer: 0, actionIntent: undefined, macroDecision: undefined,
        committedState: scenario === 'beam-retreat' ? 'fight' : undefined,
        decisionCommitTimer: scenario === 'beam-retreat' ? 1.2 : 0 }));
      defenders.forEach((u, i) => Object.assign(u, { x: mirror(2510), y: 350 + i * 15,
        hp: u.maxHp * .5, isAlive: true, stunTimer: 20, cd1: 999, cd2: 999, cdUlt: 999 }));
      for (const structure of structures.filter(s => s.team === opponent && s.type !== 'nexus')) {
        structure.isAlive = scenario === 'sealed-nexus' && structure.type === 'nexus_tower';
        structure.hp = structure.isAlive ? structure.maxHp : 0;
      }
      const nexus = structures.find(s => s.team === opponent && s.type === 'nexus');
      Object.assign(nexus, { hp: scenario === 'legal-finish' ? 1 : scenario === 'fragile-nexus' ? 3500 : nexus.maxHp,
        attackTimer: .1, volleyShotsRemaining: 5 });
      const start = attackers.map(u => ({ id: u.id, x: u.x, hp: u.hp, deaths: u.deaths }));
      let beamEntries = 0, nexusRangeEntries = 0, finishCommitSeen = false, wellTargetSeen = false;
      const retreatingIds = new Set();
      const steps = scenario === 'beam-retreat' ? 30 : scenario === 'legal-finish' ? 90 : 450;
      for (let tick = 0; tick < steps; tick++) {
        if (!window.__esportsPairedStep(1)) break;
        if (scenario !== 'beam-retreat') beamEntries += attackers.filter(u => u.isAlive && mirror(u.x) >= 2485).length;
        nexusRangeEntries += attackers.filter(u => u.isAlive && Math.hypot(u.x - nexus.x, u.y - nexus.y) <= nexus.range).length;
        finishCommitSeen ||= attackers.some(u => !!u.nexusFinishTargetId);
        wellTargetSeen ||= attackers.some(u => u.actionIntent?.kind === 'champion'
          && defenders.some(d => d.id === u.actionIntent.targetId));
        for (const u of attackers) if (u.isAlive && (u.committedState === 'retreat'
          || u.actionIntent?.kind === 'retreat')) retreatingIds.add(u.id);
      }
      return { team, scenario, simulatedSeconds: steps / 30, start, beamEntries, nexusRangeEntries,
        retreatingIds: [...retreatingIds], finishCommitSeen, wellTargetSeen,
        nexusHp: nexus.hp, finished: window.__esportsPairedInspect().finished,
        attackers: attackers.map(u => ({ id: u.id, x: u.x, y: u.y, hp: u.hp,
          isAlive: u.isAlive, deaths: u.deaths, intent: u.actionIntent?.kind, finish: !!u.nexusFinishTargetId })) };
    })()`);
    if (scenario === 'legal-finish') assert.equal(result.nexusHp, 0, `${team}: legal finish blocked`);
    else {
      assert.equal(result.beamEntries, 0, `${team} ${scenario}: entered well beam`);
      assert.equal(result.finishCommitSeen, false, `${team} ${scenario}: unsafe finish committed`);
      assert.equal(result.wellTargetSeen, false, `${team} ${scenario}: chasing well defender`);
      if (scenario === 'fragile-nexus') assert.equal(result.nexusRangeEntries, 0,
        `${team}: fragile attackers stepped into Nexus fire`);
      // This sealed fixture starts behind a live guard tower. It checks threat
      // recognition/retreat, not guaranteed survival after being placed in a trap.
      if (scenario === 'sealed-nexus' || scenario === 'beam-retreat')
        assert.equal(result.retreatingIds.length, 5, `${team} ${scenario}: lethal environment did not trigger normal retreat`);
      if (scenario !== 'sealed-nexus') assert.ok(result.attackers.every(u => u.isAlive
        && u.deaths === result.start.find(prior => prior.id === u.id).deaths),
        `${team} ${scenario}: attacker died during failed siege`);
      if (scenario === 'beam-retreat') assert.ok(result.attackers.every(u => u.isAlive
        && (team === 'blue' ? u.x < 2485 : u.x > 115)), `${team}: normal retreat failed`);
    }
    results.push({ ...result, passed: true });
    await writeFile(outputPath, JSON.stringify({ method: 'Controlled real-browser arena with mirrored positions, health/cooldown and structure states; real fire and movement unchanged', results }, null, 2) + '\n');
    console.log(`${team} ${scenario}: passed`);
  }
} finally { socket.close(); }
