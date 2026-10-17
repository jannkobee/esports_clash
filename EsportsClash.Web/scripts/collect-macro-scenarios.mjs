// Evaluation-only live arena episodes. Start Vite on 5173 and disposable Chrome on 9223.
// Each episode mounts a fresh match, moves intact teams into a safe mid-lane setup,
// and measures the existing legal selector and real 3-second actor follow-up.
import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fitRandomizedMacroCandidate } from '../src/randomizedMacroLearning.ts';

const port = process.env.CDP_PORT ?? '9223';
const pages = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json();
const page = pages.find(item => item.type === 'page');
if (!page) throw Error('Disposable Chrome page unavailable');
const socket = new WebSocket(page.webSocketDebuggerUrl);
await new Promise(done => socket.addEventListener('open', done, { once: true }));
let nextId = 0;
const pending = new Map();
socket.addEventListener('message', event => {
  const reply = JSON.parse(event.data);
  if (!reply.id) return;
  const request = pending.get(reply.id);
  pending.delete(reply.id);
  reply.error ? request.reject(Error(JSON.stringify(reply.error))) : request.resolve(reply.result);
});
const send = (method, params = {}) => new Promise((resolve, reject) => {
  const id = ++nextId;
  pending.set(id, { resolve, reject });
  socket.send(JSON.stringify({ id, method, params }));
});
const evaluate = async expression => {
  const reply = await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
  if (reply.exceptionDetails) throw Error(reply.exceptionDetails.exception?.description ?? reply.exceptionDetails.text);
  return reply.result.value;
};
const delay = ms => new Promise(done => setTimeout(done, ms));
const source = JSON.parse(await readFile(resolve('../docs/ml-live-evaluation.json'), 'utf8'));
const incumbent = source.train.endingPolicy;
const outputPath = resolve('../docs/ml-scenario-evaluation.json');
const output = { method: 'Fresh real-browser mid-lane episodes; only starting positions adjusted, all live gates and mechanics intact; evaluation-only randomized assignments; no auto-promotion', episodes: [], fit: null };
const scenarios = [
  { name: 'one-front-120', gap: 260, spread: 30, frontCount: 1, rearOffset: 120 },
  { name: 'one-front-200', gap: 260, spread: 30, frontCount: 1, rearOffset: 200 },
  { name: 'two-front-120', gap: 260, spread: 30, frontCount: 2, rearOffset: 120 },
  { name: 'two-front-200', gap: 260, spread: 30, frontCount: 2, rearOffset: 200 },
  { name: 'one-front-wide', gap: 310, spread: 35, frontCount: 1, rearOffset: 200 },
  { name: 'two-front-wide', gap: 310, spread: 35, frontCount: 2, rearOffset: 200 },
];
const pilot = process.argv.includes('--pilot');
const repeats = pilot ? 1 : 3;

try {
  await send('Runtime.enable');
  for (let repeat = 0; repeat < repeats; repeat++) for (let index = 0; index < scenarios.length; index++) {
    const scenario = scenarios[index];
    const seed = 81 + repeat * scenarios.length + index;
    const swapped = repeat % 2 === 1;
    await send('Page.navigate', { url: 'about:blank' });
    await delay(100);
    await send('Page.navigate', { url: 'http://127.0.0.1:5173/' });
    for (let attempt = 0; attempt < 60; attempt++) {
      if (await evaluate('!!document.querySelector("#root")')) break;
      await delay(100);
    }
    await evaluate(`(async () => {
      localStorage.setItem('esports-clash-adaptive-policy', ${JSON.stringify(JSON.stringify(incumbent))});
      sessionStorage.setItem('esports-clash-macro-experiment', '1');
      sessionStorage.setItem('esports-clash-macro-experiment-seed', '${seed}');
      sessionStorage.setItem('esports-clash-macro-scenario', ${JSON.stringify(JSON.stringify(scenario))});
      localStorage.removeItem('esports-clash-evaluation-reference-policy');
      const React = (await import('/node_modules/.vite/deps/react.js')).default;
      const rootModule = await import('/node_modules/.vite/deps/react-dom_client.js');
      const createRoot = rootModule.createRoot ?? rootModule.default?.createRoot;
      const { AramMatchView } = await import('/src/components/AramMatchView.tsx');
      const { INITIAL_PLAYERS, CHAMPIONS, INITIAL_COACHES } = await import('/src/mockData.ts');
      document.querySelector('#root').style.display = 'none';
      const host = document.createElement('div'); document.body.append(host);
      const avatars = [CHAMPIONS.find(c => c.name === 'Kaelen'), ...CHAMPIONS.filter(c => c.name !== 'Kaelen').slice(0, 9)];
      const lineup = avatars.map((champion, index) => ({ champion, player: INITIAL_PLAYERS[index] }));
      window.fixtureRoot = createRoot(host);
      window.fixtureRoot.render(React.createElement(AramMatchView, { seed: ${seed},
        blueLineup: ${swapped ? 'lineup.slice(5)' : 'lineup.slice(0, 5)'},
        redLineup: ${swapped ? 'lineup.slice(0, 5)' : 'lineup.slice(5)'},
        blueCoach: INITIAL_COACHES[0], redCoach: INITIAL_COACHES[0],
        onReplay: () => {}, onBatchStart: () => {}, onBatchStop: () => {},
        onMatchComplete: () => {}, onExit: () => {} }));
    })()`);
    let ready = false;
    for (let attempt = 0; attempt < 80; attempt++) {
      ready = await evaluate('!!document.querySelector(".spectator-shell button")');
      if (ready) break;
      await delay(100);
    }
    if (!ready) throw Error(`Arena did not mount for ${scenario.name}`);
    const placed = await evaluate(`(() => {
      const walk = fiber => !fiber ? null : fiber.type?.name === 'AramMatchView'
        ? fiber : walk(fiber.child) || walk(fiber.sibling);
      const fiber = walk(window.fixtureRoot._internalRoot.current);
      const refs = []; for (let hook = fiber.memoizedState; hook; hook = hook.next)
        if (hook.memoizedState && Object.hasOwn(hook.memoizedState, 'current')) refs.push(hook.memoizedState);
      const champions = refs.find(ref => Array.isArray(ref.current)
        && ref.current.length === 10 && ref.current[0]?.champion)?.current;
      if (!champions) throw Error('Live champion refs unavailable');
      return champions.map(unit => ({ id: unit.id, x: unit.x, y: unit.y,
        hpFraction: unit.hp / unit.maxHp }));
    })()`);
    await evaluate(`(() => { const button = [...document.querySelectorAll('.spectator-shell button')]
      .find(item => item.textContent.trim() === '4x'); if (!button) throw Error('4x unavailable'); button.click(); })()`);
    const records = new Map();
    const started = Date.now();
    let lastSecond = 0;
    while (Date.now() - started < 18000 && lastSecond < 35) {
      const frame = await evaluate(`(() => {
        const walk = fiber => !fiber ? null : fiber.type?.name === 'AramMatchView'
          ? fiber : walk(fiber.child) || walk(fiber.sibling);
        const fiber = walk(window.fixtureRoot?._internalRoot?.current);
        for (let hook = fiber?.memoizedState; hook; hook = hook.next) {
          const value = hook.memoizedState?.current;
          if (Array.isArray(value) && value[0]?.candidates && value[0]?.actorId)
            return { records: value, second: value.at(-1)?.second ?? 0 };
        }
        return { records: [], second: 0 };
      })()`);
      for (const record of frame.records) {
        records.set(`${record.actorId}:${record.second}`, record);
        lastSecond = Math.max(lastSecond, record.second);
      }
      await delay(350);
    }
    const all = [...records.values()].sort((a, b) => a.second - b.second);
    const assigned = all.filter(record => record.experiment);
    const gates = {};
    for (const record of all) if (record.experimentGate)
      gates[record.experimentGate] = (gates[record.experimentGate] ?? 0) + 1;
    const offered = {}, pairedGates = {};
    for (const record of all) {
      const key = record.candidates.filter(candidate => candidate.available)
        .map(candidate => candidate.key).join('+');
      offered[key] = (offered[key] ?? 0) + 1;
      if (key.includes('fight') && key.includes('regroup')) {
        const gate = record.experimentGate ?? 'none';
        pairedGates[gate] = (pairedGates[gate] ?? 0) + 1;
      }
    }
    output.episodes.push({ name: scenario.name, seed, swapped, gap: scenario.gap,
      spread: scenario.spread, frontCount: scenario.frontCount,
      rearOffset: scenario.rearOffset, placed, observedSeconds: lastSecond,
      sampled: all.length, assignments: assigned.length,
      validOutcomes: assigned.filter(record => record.outcome).length,
      gates, offered, pairedGates, experimentRecords: assigned });
    await writeFile(outputPath, JSON.stringify(output, null, 2) + '\n');
    console.log(`${scenario.name} seed ${seed}: ${assigned.length} assignments, ${assigned.filter(record => record.outcome).length} outcomes, ${lastSecond.toFixed(1)}s`);
  }
  const fit = fitRandomizedMacroCandidate(incumbent, output.episodes.flatMap(episode => episode.experimentRecords));
  output.fit = { assigned: fit.assigned, validOutcomes: fit.validOutcomes,
    trainedGroups: fit.trainedGroups, groups: fit.groups,
    incumbent, candidate: fit.policy };
  await writeFile(outputPath, JSON.stringify(output, null, 2) + '\n');
  console.log(JSON.stringify({ outputPath, episodes: output.episodes.length,
    assigned: fit.assigned, validOutcomes: fit.validOutcomes, trainedGroups: fit.trainedGroups,
    groups: fit.groups }, null, 2));
} finally { socket.close(); }
