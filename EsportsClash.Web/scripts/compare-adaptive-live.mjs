// Runs the real browser arena at 4x through CDP. Start Vite on 5173 and a disposable
// headless Chrome on 9223. Training seed 47; held-out seeds use fixed card/avatar pairings.
import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fitOfflineOutcomePolicy } from '../src/offlineOutcomePolicy.ts';

const port = process.env.CDP_PORT ?? '9223';
const pages = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json();
const page = pages.find(item => item.type === 'page');
if (!page) throw Error('Disposable Chrome page unavailable');
const socket = new WebSocket(page.webSocketDebuggerUrl);
await new Promise(resolve => socket.addEventListener('open', resolve, { once: true }));
let nextId = 0;
const pending = new Map();
socket.addEventListener('message', event => {
  const message = JSON.parse(event.data);
  if (!message.id) return;
  const request = pending.get(message.id);
  pending.delete(message.id);
  message.error ? request.reject(Error(JSON.stringify(message.error))) : request.resolve(message.result);
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
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
const zeroPolicy = { version: 2, matches: 0,
  weights: { fight: {}, wave: {}, regroup: {}, farm: {}, push: {} } };

async function runMatch(label, seed, policy, swapped = false, maxWallMs = 360000, comparisonPolicy = null, experiment = false) {
  await send('Page.navigate', { url: 'about:blank' });
  await delay(200);
  await send('Page.navigate', { url: 'http://127.0.0.1:5173/' });
  for (let retry = 0; retry < 60; retry++) {
    if (await evaluate('!!document.querySelector("#root")')) break;
    await delay(250);
  }
  await evaluate(`(async () => {
    localStorage.setItem('esports-clash-adaptive-policy', ${JSON.stringify(JSON.stringify(policy))});
    ${experiment ? "sessionStorage.setItem('esports-clash-macro-experiment', '1');"
      : "sessionStorage.removeItem('esports-clash-macro-experiment');"}
    ${experiment ? `sessionStorage.setItem('esports-clash-macro-experiment-seed', '${seed * 2 + Number(swapped)}');`
      : "sessionStorage.removeItem('esports-clash-macro-experiment-seed');"}
    ${comparisonPolicy ? `localStorage.setItem('esports-clash-evaluation-reference-policy', ${JSON.stringify(JSON.stringify(comparisonPolicy))});`
      : "localStorage.removeItem('esports-clash-evaluation-reference-policy');"}
    localStorage.removeItem('esports-clash-match-reports');
    const React = (await import('/node_modules/.vite/deps/react.js')).default;
    const rootModule = await import('/node_modules/.vite/deps/react-dom_client.js');
    const createRoot = rootModule.createRoot ?? rootModule.default?.createRoot;
    const { AramMatchView } = await import('/src/components/AramMatchView.tsx');
    const { INITIAL_PLAYERS, CHAMPIONS, INITIAL_COACHES } = await import('/src/mockData.ts');
    document.querySelector('#root').style.display = 'none';
    const host = document.createElement('div'); document.body.append(host);
    const avatars = [CHAMPIONS.find(c => c.name === 'Kaelen'), ...CHAMPIONS.filter(c => c.name !== 'Kaelen').slice(0, 9)];
    const lineup = avatars.map((champion, index) => ({ champion, player: INITIAL_PLAYERS[index] }));
    window.mlCompleted = false;
    window.fixtureRoot = createRoot(host);
    window.fixtureRoot.render(React.createElement(AramMatchView, { seed: ${seed},
      blueLineup: ${swapped ? 'lineup.slice(5)' : 'lineup.slice(0, 5)'},
      redLineup: ${swapped ? 'lineup.slice(0, 5)' : 'lineup.slice(5)'},
      blueCoach: INITIAL_COACHES[0], redCoach: INITIAL_COACHES[0],
      onReplay: () => {}, onBatchStart: () => {}, onBatchStop: () => {},
      onMatchComplete: () => { window.mlCompleted = true; }, onExit: () => {} }));
  })()`);
  for (let retry = 0; retry < 60; retry++) {
    if (await evaluate('!!document.querySelector(".spectator-shell button")')) break;
    await delay(250);
  }
  await evaluate(`(() => { const speed = [...document.querySelectorAll('.spectator-shell button')]
    .find(button => button.textContent.trim() === '4x'); if (!speed) throw Error('4x control unavailable'); speed.click(); })()`);
  const decisions = new Map();
  let lastSecond = 0;
  const started = Date.now();
  while (Date.now() - started < maxWallMs) {
    const snapshot = await evaluate(`(() => {
      const walk = fiber => !fiber ? null : fiber.type?.name === 'AramMatchView'
        ? fiber : walk(fiber.child) || walk(fiber.sibling);
      const fiber = walk(window.fixtureRoot?._internalRoot?.current);
      let records = [];
      for (let hook = fiber?.memoizedState; hook; hook = hook.next) {
        const value = hook.memoizedState?.current;
        if (Array.isArray(value) && value[0]?.candidates && value[0]?.actorId) { records = value; break; }
      }
      return { completed: window.mlCompleted, records };
    })()`);
    for (const record of snapshot.records) {
      decisions.set(`${record.actorId}:${record.second}`, record);
      lastSecond = Math.max(lastSecond, record.second);
    }
    if (snapshot.completed) break;
    await delay(2000);
  }
  const result = await evaluate(`(() => ({ completed: window.mlCompleted,
    report: JSON.parse(localStorage.getItem('esports-clash-match-reports') || '[]').at(-1),
    policy: JSON.parse(localStorage.getItem('esports-clash-adaptive-policy') || '{}') }))()`);
  if (!result.completed || !result.report) throw Error(`${label} did not finish in ${maxWallMs / 1000} wall seconds (last telemetry ${lastSecond.toFixed(1)} simulation seconds)`);
  const records = [...decisions.values()].sort((a, b) => a.second - b.second || a.actorId.localeCompare(b.actorId));
  const counts = {}, offered = {}, choicesByCard = {}, ambiguous = {};
  for (const record of records) {
    const action = record.selected;
    if (!action) continue;
    counts[action] = (counts[action] ?? 0) + 1;
    const card = record.features && Object.keys(record.features).find(key => key.startsWith('card:'))?.slice(5) || record.actorId;
    const byCard = choicesByCard[card] ??= {};
    byCard[action] = (byCard[action] ?? 0) + 1;
    const selected = record.candidates.find(candidate => candidate.key === action);
    const alternatives = record.candidates.filter(candidate => candidate.available && candidate.key !== action
      && candidate.priority === selected?.priority);
    if (alternatives.length) ambiguous[action] = (ambiguous[action] ?? 0) + 1;
    for (const candidate of record.candidates) if (candidate.available)
      offered[candidate.key] = (offered[candidate.key] ?? 0) + 1;
  }
  const report = result.report;
  const sameState = records.filter(record => record.zeroPolicySelected !== undefined);
  const changed = sameState.filter(record => record.zeroPolicySelected !== record.selected);
  const changeEpisodes = [];
  const lastEpisodeByKey = new Map();
  for (const record of changed) {
    const key = `${record.actorId}:${record.selected}:${record.zeroPolicySelected}:${record.contextKey}`;
    const prior = lastEpisodeByKey.get(key);
    if (prior && record.second - prior.lastSecond <= 3) {
      prior.lastSecond = record.second;
      prior.samples++;
      if (record.outcome) prior.outcome = record.outcome;
      continue;
    }
    const episode = { second: record.second, lastSecond: record.second, samples: 1,
      actorId: record.actorId, team: record.team,
      cardId: Object.keys(record.features ?? {}).find(key => key.startsWith('card:'))?.slice(5),
      selected: record.selected, zeroPolicySelected: record.zeroPolicySelected,
      contextKey: record.contextKey, selectionReason: record.selectionReason,
      zeroPolicyReason: record.zeroPolicyReason, heldAction: record.heldAction,
      learnedSuppressedReason: record.learnedSuppressedReason,
      candidates: record.candidates, snapshot: record.snapshot, outcome: record.outcome };
    changeEpisodes.push(episode);
    lastEpisodeByKey.set(key, episode);
  }
  const local = records.filter(record => record.outcome);
  const suppressed = records.filter(record => record.learnedSuppressedReason);
  const referenceCompared = records.filter(record => record.referencePolicySelected !== undefined);
  const referenceChanged = referenceCompared.filter(record => record.referencePolicySelected !== record.selected);
  const experimentRecords = records.filter(record => record.experiment);
  const experimentGateCounts = {};
  for (const record of records) if (record.experimentGate)
    experimentGateCounts[record.experimentGate] = (experimentGateCounts[record.experimentGate] ?? 0) + 1;
  console.log(`${label}: ${report.durationSeconds.toFixed(1)}s simulation, ${((Date.now() - started) / 1000).toFixed(1)}s wall, ${records.length} sampled decisions, winner ${report.winner}`);
  return { label, seed, swapped, startingPolicy: policy, endingPolicy: result.policy,
    outcome: { winner: report.winner, durationSeconds: report.durationSeconds,
      blueKills: report.blueKills, redKills: report.redKills,
      objectiveEvents: report.events.filter(event => event.type === 'dragon' || event.type === 'jungle').length,
      towerEvents: report.events.filter(event => event.type === 'tower').length },
    decisions: { total: records.length, selected: counts, offered, sameTierAlternatives: ambiguous, byCard: choicesByCard,
      sameStateCompared: sameState.length,
      sameStateChanged: changed.length, changedEpisodes: changeEpisodes.length,
      lowHealthComparisons: records.filter(record => record.learnedSuppressedReason === 'low-health').length,
      dangerousFightComparisons: records.filter(record => record.learnedSuppressedReason === 'dangerous-fight').length,
      suppressedChanged: suppressed.filter(record => record.zeroPolicySelected !== record.selected).length,
      localOutcomeSamples: local.length,
      outcomeHorizonMin: local.length ? Math.min(...local.map(record => record.outcome.horizonSeconds)) : null,
      outcomeHorizonMax: local.length ? Math.max(...local.map(record => record.outcome.horizonSeconds)) : null,
      changedWithOutcome: changed.filter(record => record.outcome).length,
      referenceCompared: referenceCompared.length, referenceChanged: referenceChanged.length,
      referenceChangedWithOutcome: referenceChanged.filter(record => record.outcome).length,
      referenceSuppressedChanged: referenceChanged.filter(record => record.learnedSuppressedReason).length,
      experimentAssignments: experimentRecords.length,
      experimentWithOutcome: experimentRecords.filter(record => record.outcome).length,
      experimentArms: { incumbent: experimentRecords.filter(record => record.experiment.arm === 'incumbent').length,
        alternate: experimentRecords.filter(record => record.experiment.arm === 'alternate').length },
      experimentGateCounts,
      meanLocalProgress: local.length ? local.reduce((sum, record) => sum + record.outcome.progress, 0) / local.length : null },
    changedExamples: changeEpisodes,
    experimentRecords, referenceExamples: referenceChanged.slice(0, 12).map(record => ({ second: record.second,
      actorId: record.actorId, selected: record.selected, referencePolicySelected: record.referencePolicySelected,
      learnedSuppressedReason: record.learnedSuppressedReason, snapshot: record.snapshot,
      candidates: record.candidates, outcome: record.outcome })), records };
}

try {
  await send('Runtime.enable');
  if (process.argv.includes('--post-fix-heldout')) {
    const analysis = JSON.parse(await readFile(resolve('../docs/ml-post-fix-analysis.json'), 'utf8'));
    const path = resolve('../docs/ml-post-fix-heldout.json');
    const output = { method: 'Natural held-out seed 79, candidate executed; exact same-state incumbent diagnostic; candidate not auto-promoted', runs: [] };
    for (const swapped of [false, true]) {
      const label = `post-fix-heldout-79-${swapped ? 'swapped' : 'original'}`;
      const run = await runMatch(label, 79, analysis.candidate, swapped, 600000, analysis.incumbent);
      output.runs.push({ label, seed: 79, swapped, outcome: run.outcome,
        decisions: run.decisions, referenceExamples: run.referenceExamples });
      await writeFile(path, JSON.stringify(output, null, 2) + '\n');
      console.log(`${label}: ${run.decisions.referenceChanged}/${run.decisions.referenceCompared} changed; ${run.decisions.referenceSuppressedChanged} suppressed changed`);
    }
    console.log(JSON.stringify({ path, runs: output.runs.map(run => ({ label: run.label,
      compared: run.decisions.referenceCompared, changed: run.decisions.referenceChanged,
      suppressedChanged: run.decisions.referenceSuppressedChanged })) }, null, 2));
  } else if (process.argv.includes('--controlled-heldout')) {
    const analysis = JSON.parse(await readFile(resolve('../docs/ml-controlled-experiment-analysis.json'), 'utf8'));
    const path = resolve('../docs/ml-controlled-heldout.json');
    const output = { method: 'Held-out live seed 73, both side assignments, candidate executed with same-state incumbent diagnostic; no automatic promotion', runs: [] };
    if (analysis.trainedGroups > 0) for (const swapped of [false, true]) {
      const label = `controlled-heldout-73-${swapped ? 'swapped' : 'original'}`;
      const run = await runMatch(label, 73, analysis.candidate, swapped, 600000, analysis.incumbent);
      output.runs.push({ label, seed: 73, swapped, outcome: run.outcome,
        decisions: run.decisions, referenceExamples: run.referenceExamples });
      await writeFile(path, JSON.stringify(output, null, 2) + '\n');
    }
    console.log(JSON.stringify({ path, trainedGroups: analysis.trainedGroups,
      runs: output.runs.map(run => ({ label: run.label,
        compared: run.decisions.referenceCompared, changed: run.decisions.referenceChanged,
        suppressedChanged: run.decisions.referenceSuppressedChanged })) }, null, 2));
  } else if (process.argv.includes('--controlled-experiment') || process.argv.includes('--controlled-probe')
    || process.argv.includes('--post-fix-probe')) {
    const postFix = process.argv.includes('--post-fix-probe');
    const probe = process.argv.includes('--controlled-probe') || postFix;
    const prior = JSON.parse(await readFile(resolve('../docs/ml-live-evaluation.json'), 'utf8'));
    const policy = prior.train.endingPolicy;
    const postFixSeeds = (process.argv.find(arg => arg.startsWith('--seeds='))?.slice(8)
      ?? process.argv.find(arg => arg.startsWith('--seed='))?.slice(7) ?? '74')
      .split(',').map(Number);
    if (postFix && (!postFixSeeds.length || postFixSeeds.some(value =>
      !Number.isInteger(value) || value < 1 || value > 1000000)))
      throw Error('Post-fix seeds must be integers between 1 and 1000000');
    const path = resolve(postFix ? `../docs/ml-post-fix-probe-${postFixSeeds.join('-')}${process.argv.includes('--both-sides') ? '-both' : ''}.json`
      : probe ? '../docs/ml-controlled-probe.json' : '../docs/ml-controlled-experiment.json');
    const output = { method: 'Evaluation-only 50/50 randomized close, legal same-tier macro choice; seeds 71/72, original and swapped sides; outcome is actor 2-6s progress', runs: [] };
    for (const seed of postFix ? postFixSeeds : probe ? [71] : [71, 72])
      for (const swapped of postFix && process.argv.includes('--both-sides')
        ? [false, true] : probe ? [process.argv.includes('--swapped')] : [false, true]) {
      const label = `controlled-${seed}-${swapped ? 'swapped' : 'original'}`;
      const run = await runMatch(label, seed, policy, swapped, 600000, null, true);
      output.runs.push({ label, seed, swapped, outcome: run.outcome,
        decisions: run.decisions, experimentRecords: run.experimentRecords });
      await writeFile(path, JSON.stringify(output, null, 2) + '\n');
      console.log(`${label}: ${run.decisions.experimentAssignments} assigned, ${run.decisions.experimentWithOutcome} outcomes; gates ${JSON.stringify(run.decisions.experimentGateCounts)}`);
    }
    console.log(JSON.stringify({ path, runs: output.runs.map(run => ({ label: run.label,
      assignments: run.decisions.experimentAssignments, outcomes: run.decisions.experimentWithOutcome,
      arms: run.decisions.experimentArms })) }, null, 2));
  } else if (process.argv.includes('--offline-reference')) {
    const path = resolve('../docs/ml-offline-outcome-evaluation.json');
    const output = JSON.parse(await readFile(path, 'utf8'));
    output.sameStateReference ??= [];
    for (const swapped of [false, true]) {
      const label = `offline-reference-63-${swapped ? 'swapped' : 'original'}`;
      if (output.sameStateReference.some(run => run.label === label)) continue;
      const run = await runMatch(label, 63, output.fit.candidate, swapped, 600000, output.fit.incumbent);
      output.sameStateReference.push({ label, seed: 63, swapped, outcome: run.outcome,
        decisions: run.decisions, referenceExamples: run.referenceExamples });
      await writeFile(path, JSON.stringify(output, null, 2) + '\n');
    }
    console.log(JSON.stringify({ path, reference: output.sameStateReference.map(run => ({ label: run.label,
      compared: run.decisions.referenceCompared, changed: run.decisions.referenceChanged,
      suppressedChanged: run.decisions.referenceSuppressedChanged })) }, null, 2));
  } else if (process.argv.includes('--offline-outcome') || process.argv.includes('--offline-outcome-resume')) {
    const prior = JSON.parse(await readFile(resolve('../docs/ml-live-evaluation.json'), 'utf8'));
    const incumbent = prior.train.endingPolicy;
    const path = resolve('../docs/ml-offline-outcome-evaluation.json');
    const resume = process.argv.includes('--offline-outcome-resume');
    const output = resume ? JSON.parse(await readFile(path, 'utf8'))
      : { method: 'Observational 2-6s outcome candidate; live browser training seeds 61/62, held-out seed 63, original and swapped assignments; incumbent and candidate never auto-promoted',
        train: [], fit: null, heldout: [] };
    const trainingRecords = [];
    if (!resume) for (const seed of [61, 62]) for (const swapped of [false, true]) {
      const label = `offline-train-${seed}-${swapped ? 'swapped' : 'original'}`;
      const run = await runMatch(label, seed, incumbent, swapped);
      const offset = (output.train.length - 1) * 2000;
      trainingRecords.push(...run.records.map(record => ({ ...record, second: record.second + offset })));
      output.train.push({ label, seed, swapped, outcome: run.outcome, decisions: run.decisions });
      await writeFile(path, JSON.stringify(output, null, 2) + '\n');
    }
    if (!resume) {
      const fit = fitOfflineOutcomePolicy(incumbent, trainingRecords);
      output.fit = { eligible: fit.eligible, independent: fit.independent,
        comparableGroups: fit.comparableGroups, comparedSamples: fit.comparedSamples,
        byAction: fit.byAction, incumbent, candidate: fit.policy };
      await writeFile(path, JSON.stringify(output, null, 2) + '\n');
    }
    if (output.fit.comparableGroups > 0) {
      for (const swapped of [false, true]) for (const [policyName, policy] of [['incumbent', incumbent], ['candidate', output.fit.candidate]]) {
        const label = `offline-heldout-63-${swapped ? 'swapped' : 'original'}-${policyName}`;
        if (output.heldout.some(run => run.label === label)) continue;
        const run = await runMatch(label, 63, policy, swapped, 600000);
        output.heldout.push({ label, seed: 63, swapped, policyName,
          outcome: run.outcome, decisions: run.decisions });
        await writeFile(path, JSON.stringify(output, null, 2) + '\n');
      }
    }
    console.log(JSON.stringify({ path, fit: { eligible: output.fit.eligible, independent: output.fit.independent,
      comparableGroups: output.fit.comparableGroups, comparedSamples: output.fit.comparedSamples },
      heldout: output.heldout.map(run => ({ label: run.label, winner: run.outcome.winner,
        duration: run.outcome.durationSeconds, changesVersusZero: run.decisions.sameStateChanged })) }, null, 2));
  } else if (process.argv.includes('--review') || process.argv.includes('--post-guard')) {
    const postGuard = process.argv.includes('--post-guard');
    const prior = JSON.parse(await readFile(resolve('../docs/ml-live-evaluation.json'), 'utf8'));
    const policy = prior.train.endingPolicy;
    const path = resolve(postGuard ? '../docs/ml-live-post-guard.json' : '../docs/ml-live-action-review.json');
    const review = { method: `Real live arena, seed-47-trained policy, 4x, two held-out seeds and both team assignments; ${postGuard ? 'post-guard' : 'action review'}`,
      runs: [] };
    for (const seed of [53, 54]) for (const swapped of [false, true]) {
      const label = `${postGuard ? 'post-guard' : 'review'}-${seed}-${swapped ? 'swapped' : 'original'}`;
      try {
        const run = await runMatch(label, seed, policy, swapped);
        review.runs.push({ label, seed, swapped, outcome: run.outcome,
          decisions: run.decisions, changedExamples: run.changedExamples });
        console.log(`${label}: ${run.decisions.sameStateChanged} changed samples in ${run.decisions.changedEpisodes} episodes`);
      } catch (error) {
        review.runs.push({ label, seed, swapped, error: String(error) });
        console.error(`${label}: ${error}`);
      }
      await writeFile(path, JSON.stringify(review, null, 2) + '\n');
    }
    console.log(JSON.stringify({ path, runs: review.runs.map(run => ({ label: run.label,
      duration: run.outcome?.durationSeconds, compared: run.decisions?.sameStateCompared,
      changed: run.decisions?.sameStateChanged, episodes: run.decisions?.changedEpisodes,
      error: run.error })) }, null, 2));
  } else if (process.argv.includes('--diagnostic')) {
    const prior = JSON.parse(await readFile(resolve('../docs/ml-live-evaluation.json'), 'utf8'));
    const diagnostic = await runMatch('same-state-diagnostic', 53, prior.train.endingPolicy);
    const path = resolve('../docs/ml-live-diagnostic.json');
    await writeFile(path, JSON.stringify({ method: 'Real live seed 53 with seed-47-trained policy and same-state/local-outcome diagnostics',
      outcome: diagnostic.outcome, decisions: diagnostic.decisions }, null, 2) + '\n');
    console.log(JSON.stringify({ path, outcome: diagnostic.outcome,
      sameStateCompared: diagnostic.decisions.sameStateCompared,
      sameStateChanged: diagnostic.decisions.sameStateChanged,
      localOutcomeSamples: diagnostic.decisions.localOutcomeSamples,
      meanLocalProgress: diagnostic.decisions.meanLocalProgress }, null, 2));
  } else if (process.argv.includes('--repeat-baseline')) {
    const repeat = await runMatch('heldout-baseline-repeat', 51, zeroPolicy);
    const path = resolve('../docs/ml-live-baseline-repeat.json');
    await writeFile(path, JSON.stringify({ method: 'Zero-policy repeat on held-out seed 51',
      outcome: repeat.outcome, decisions: repeat.decisions }, null, 2) + '\n');
    console.log(JSON.stringify({ path, outcome: repeat.outcome, decisions: repeat.decisions.selected }, null, 2));
  } else {
  const train = await runMatch('train', 47, zeroPolicy);
  const baseline = await runMatch('heldout-baseline', 51, zeroPolicy);
  const learned = await runMatch('heldout-learned', 51, train.endingPolicy);
  const baselineKeys = new Map(baseline.records.map(record => [`${record.actorId}:${Math.floor(record.second / 2)}`, record]));
  let comparable = 0, changed = 0;
  for (const record of learned.records) {
    const peer = baselineKeys.get(`${record.actorId}:${Math.floor(record.second / 2)}`);
    if (!peer || peer.contextKey !== record.contextKey) continue;
    const legal = value => value.candidates.filter(candidate => candidate.available).map(candidate => `${candidate.key}:${candidate.priority}`).join('|');
    if (legal(peer) !== legal(record)) continue;
    comparable++;
    if (peer.selected !== record.selected) changed++;
  }
  const output = { method: 'Real AramMatchView, fixed lineup, 4x live browser; train seed 47, held-out seed 51',
    comparableDecisionSamples: comparable, changedDecisionSamples: changed,
    train: { ...train, records: undefined }, baseline: { ...baseline, records: undefined },
    learned: { ...learned, records: undefined } };
  const path = resolve('../docs/ml-live-evaluation.json');
  await writeFile(path, JSON.stringify(output, null, 2) + '\n');
  console.log(JSON.stringify({ path, comparable, changed,
    baseline: baseline.outcome, learned: learned.outcome, trainedWeights: train.endingPolicy.weights }, null, 2));
  }
} finally { socket.close(); }
