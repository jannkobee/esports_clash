// Same-state, evaluation-only paired choice in the real browser arena.
// Start Vite on 5173 and a disposable CDP Chrome on 9223 before running.
import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { summarizePairedBehavior } from './paired-behavior.mjs';
import { createHash } from 'node:crypto';

const port = process.env.CDP_PORT ?? '9223';
const vitePort = process.env.VITE_PORT ?? '5173';
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
const prior = JSON.parse(await readFile(resolve('../docs/ml-live-evaluation.json'), 'utf8'));
const policy = prior.train.endingPolicy;
const rewardModelPath = process.argv.find(arg => arg.startsWith('--reward-model='))?.slice(15);
const rewardModelText = rewardModelPath ? await readFile(resolve(rewardModelPath), 'utf8') : undefined;
const rewardModel = rewardModelText ? JSON.parse(rewardModelText) : undefined;
if (rewardModel && (!rewardModel.fit?.sufficient || !rewardModel.fit?.policy || rewardModel.promoted))
  throw Error('Reward trial requires a supported frozen offline candidate');
const rewardModelHash = rewardModelText ? createHash('sha256').update(rewardModelText).digest('hex') : undefined;
if (rewardModel && !process.argv.includes('--checkpoint')) throw Error('Reward trial requires checkpoint replay');
const seed = Number(process.argv.find(arg => arg.startsWith('--seed='))?.slice(7) ?? 77);
if (!Number.isInteger(seed) || seed < 1 || seed > 1000000) throw Error('Invalid evaluation seed');
const horizonSeconds = Number(process.argv.find(arg => arg.startsWith('--horizon='))?.slice(10) ?? 8);
if (!Number.isFinite(horizonSeconds) || horizonSeconds < 3 || horizonSeconds > 30)
  throw Error('Paired horizon must be between three and thirty seconds');
const draft = Number(process.argv.find(arg => arg.startsWith('--draft='))?.slice(8) ?? 0);
if (!Number.isInteger(draft) || draft < 0 || draft >= 10) throw Error('Invalid evaluation draft');
const swapped = !process.argv.includes('--original');
const scoutSeconds = Number(process.argv.find(arg => arg.startsWith('--scout-seconds='))?.slice(16) ?? 900);
if (!Number.isFinite(scoutSeconds) || scoutSeconds < 120 || scoutSeconds > 1200)
  throw Error('Scout simulation limit must be 120 to 1200 seconds');
const afterSeconds = Number(process.argv.find(arg => arg.startsWith('--after='))?.slice(8) ?? 120);
if (!Number.isFinite(afterSeconds) || afterSeconds < 120 || afterSeconds > 900 || afterSeconds >= scoutSeconds)
  throw Error('Scout start must be 120 to 900 seconds and precede the scout limit');
const pairFilter = process.argv.find(arg => arg.startsWith('--pair='))?.slice(7) ?? '';
const auditOnly = process.argv.includes('--audit-only');
const cardFilter = process.argv.find(arg => arg.startsWith('--card='))?.slice(7) ?? '';
if (pairFilter && !/^(fight|wave|regroup|farm|push)-(fight|wave|regroup|farm|push)$/.test(pairFilter))
  throw Error('Invalid pair filter');
if (cardFilter && !/^p_[a-z0-9]+$/.test(cardFilter)) throw Error('Invalid card filter');
const explicitOutput = process.argv.find(arg => arg.startsWith('--output='))?.slice(9);
const outputPath = resolve(explicitOutput ?? (process.argv.includes('--checkpoint')
  ? `../docs/ml-paired-checkpoint-${seed}-${swapped ? 'swapped' : 'original'}-${horizonSeconds}s.json`
  : `../docs/ml-paired-seed-${seed}-${swapped ? 'swapped' : 'original'}.json`));

async function episode(label, mode, target) {
  await send('Page.navigate', { url: 'about:blank' });
  await delay(100);
  await send('Page.navigate', { url: `http://127.0.0.1:${vitePort}/${process.argv.includes('--compiled-page') ? 'evolution-compiled.html' : process.argv.includes('--fast-page') ? 'evolution.html' : ''}` });
  for (let retry = 0; retry < 60; retry++) {
    if (await evaluate(process.argv.includes('--fast-page') || process.argv.includes('--compiled-page') ? '!!window.__evolutionPageReady' : '!!document.querySelector("#root")')) break;
    await delay(100);
  }
  await evaluate(`(async () => {
    localStorage.setItem('esports-clash-adaptive-policy', ${JSON.stringify(JSON.stringify(policy))});
    localStorage.removeItem('esports-clash-evaluation-reference-policy');
    sessionStorage.setItem('esports-clash-macro-experiment', '1');
    sessionStorage.setItem('esports-clash-macro-pair-mode', '${mode}');
    sessionStorage.setItem('esports-clash-macro-pair-trace', '${process.argv.includes('--trace') ? '1' : '0'}');
    sessionStorage.setItem('esports-clash-checkpoint-state', '${process.argv.includes('--checkpoint-state') ? '1' : '0'}');
    sessionStorage.setItem('esports-clash-macro-pair-filter', '${auditOnly ? 'audit-only' : pairFilter}');
    sessionStorage.setItem('esports-clash-macro-pair-card', '${cardFilter}');
    sessionStorage.setItem('esports-clash-macro-pair-after', '${afterSeconds}');
    ${target ? `sessionStorage.setItem('esports-clash-macro-pair-target', ${JSON.stringify(JSON.stringify(target))});`
      : "sessionStorage.removeItem('esports-clash-macro-pair-target');"}
    sessionStorage.removeItem('esports-clash-macro-scenario');
    window.__esportsPairedMacro = undefined;
    window.__esportsMacroExecutionAudit = undefined;
    window.__esportsMacroOpportunityAudit = undefined;
    const compiled = window.__evolutionModules;
    const React = compiled?.React ?? (await import('/node_modules/.vite/deps/react.js')).default;
    const rootModule = compiled ?? await import('/node_modules/.vite/deps/react-dom_client.js');
    const createRoot = rootModule.createRoot ?? rootModule.default?.createRoot;
    const { AramMatchView } = compiled ?? await import('/src/components/AramMatchView.tsx');
    const { INITIAL_PLAYERS, CHAMPIONS, INITIAL_COACHES } = compiled ?? await import('/src/mockData.ts');
    const { buildPairedStudyDraft } = compiled ?? await import('/src/pairedStudyDraft.ts');
    document.querySelector('#root').style.display = 'none';
    const host = document.createElement('div'); document.body.append(host);
    const lineup = buildPairedStudyDraft(INITIAL_PLAYERS, CHAMPIONS, ${draft});
    window.__esportsPairedLineup = lineup.map(({ champion, player }) => ({ playerId: player.id, championId: champion.id }));
    window.fixtureRoot = createRoot(host);
    window.fixtureRoot.render(React.createElement(AramMatchView, { seed: ${seed},
      evaluationRenderless: ${process.argv.includes('--renderless')},
      evaluationStartPaused: ${process.argv.includes('--fixed-scout')},
      blueLineup: ${swapped ? 'lineup.slice(5)' : 'lineup.slice(0, 5)'},
      redLineup: ${swapped ? 'lineup.slice(0, 5)' : 'lineup.slice(5)'},
      blueCoach: INITIAL_COACHES[0], redCoach: INITIAL_COACHES[0],
      onReplay: () => {}, onBatchStart: () => {}, onBatchStop: () => {},
      onMatchComplete: () => {}, onExit: () => {} }));
  })()`);
  for (let retry = 0; retry < 60; retry++) {
    if (await evaluate('!!document.querySelector(".spectator-shell button")')) break;
    await delay(100);
  }
  await evaluate(`(() => { const speed = [...document.querySelectorAll('.spectator-shell button')]
    .find(button => button.textContent.trim() === '4x'); if (!speed) throw Error('4x unavailable'); speed.click(); })()`);
  const fixedScout = mode === 'scout' && process.argv.includes('--fixed-scout');
  if (fixedScout) {
    await evaluate(`document.querySelector('.spectator-shell button[aria-label="Pause match"]')?.click()`);
    for (let retry = 0; retry < 60; retry++) {
      if (await evaluate('typeof window.__esportsPairedStep === "function"')) break;
      await delay(20);
    }
  }
  const started = Date.now();
  while (Date.now() - started < 180000) {
    if (fixedScout) {
      const clock = await evaluate('window.__esportsPairedInspect?.().second ?? 0');
      const steps = Math.min(300, Math.round((scoutSeconds - clock) * 30));
      if (steps <= 0) return { label, rejected: 'simulation scout limit',
        inspection: await evaluate('window.__esportsPairedInspect?.()'), wallSeconds: (Date.now() - started) / 1000 };
      if (!await evaluate(`window.__esportsPairedStep?.(${steps}) === true`))
        return { label, rejected: 'match ended before eligible pair',
          inspection: await evaluate('window.__esportsPairedInspect?.()'), wallSeconds: (Date.now() - started) / 1000 };
    }
    const frame = await evaluate(`(() => {
      const walk = fiber => !fiber ? null : fiber.type?.name === 'AramMatchView'
        ? fiber : walk(fiber.child) || walk(fiber.sibling);
      const fiber = walk(window.fixtureRoot?._internalRoot?.current);
      let records = [];
      for (let hook = fiber?.memoizedState; hook; hook = hook.next) {
        const value = hook.memoizedState?.current;
        if (Array.isArray(value) && value[0]?.candidates && value[0]?.actorId) {
          records = value; break;
        }
      }
      const event = window.__esportsPairedMacro;
      const record = event?.assignmentRecord ?? (event && records.find(item => item.experiment
        && item.actorId === event.actorId && Math.abs(item.second - event.second) < 1e-6));
      return { event, record, lastSecond: records.at(-1)?.second ?? 0 };
    })()`);
    if (frame.event && mode === 'scout') return { label, ...frame,
      inspection: await evaluate('window.__esportsPairedInspect?.()'), wallSeconds: (Date.now() - started) / 1000 };
    if (frame.event && mode === 'replay') {
      if (!frame.event.matched) return { label, ...frame, rejected: 'predecision mismatch',
        wallSeconds: (Date.now() - started) / 1000 };
      if (frame.record?.outcome) return { label, ...frame, wallSeconds: (Date.now() - started) / 1000 };
      if (frame.lastSecond > target.second + 8) return { label, ...frame,
        rejected: 'assigned action had no three-second outcome', wallSeconds: (Date.now() - started) / 1000 };
    }
    if (target && frame.lastSecond > target.second + 8)
      return { label, ...frame, rejected: 'target decision not reached', wallSeconds: (Date.now() - started) / 1000 };
    if (!fixedScout) await delay(250);
  }
  return { label, rejected: 'timeout', wallSeconds: (Date.now() - started) / 1000 };
}

async function checkpointBatch(base) {
  const paused = await evaluate(`(() => {
    const button = document.querySelector('.spectator-shell button[aria-label="Pause match"]');
    if (button) button.click();
    return !!button || !!document.querySelector('.spectator-shell button[aria-label="Resume match"]');
  })()`);
  if (!paused) return [{ label: 'incumbent-a', rejected: 'pause control unavailable' }];
  for (let retry = 0; retry < 30; retry++) {
    if (await evaluate('typeof window.__esportsPairedStep === "function"')) break;
    await delay(20);
  }
  const runs = await evaluate(`(() => {
    const base = ${JSON.stringify(base)};
    const steps = ${Math.ceil((horizonSeconds + 0.2) * 30)};
    const arms = [['incumbent-a', 'incumbent'], ['incumbent-b', 'incumbent'],
      ['alternate', 'alternate']];
    ${rewardModel ? "arms.push(['reward-guided', 'reward']);" : ''}
    const walk = fiber => !fiber ? null : fiber.type?.name === 'AramMatchView'
      ? fiber : walk(fiber.child) || walk(fiber.sibling);
    const output = [];
    for (const [label, arm] of arms) {
      const target = { ...base, arm, horizonSeconds: ${horizonSeconds},
        ...(arm === 'reward' ? { ${rewardModel?.fit.policy?.kind === 'task-confidence' ? 'rewardConfidencePolicy'
          : rewardModel?.fit.policy?.kind === 'task-context' ? 'rewardTaskPolicy' : 'rewardPolicy'}: ${JSON.stringify(rewardModel?.fit.policy ?? null)} } : {}) };
      if (window.__esportsPairedRestore?.(target) !== true) {
        output.push({ label, rejected: 'checkpoint restore failed' }); break;
      }
      const started = performance.now();
      if (window.__esportsPairedStep?.(steps) !== true) {
        output.push({ label, rejected: 'paused fixed-step replay unavailable' }); break;
      }
      const fiber = walk(window.fixtureRoot?._internalRoot?.current);
      let records = [];
      for (let hook = fiber?.memoizedState; hook; hook = hook.next) {
        const value = hook.memoizedState?.current;
        if (Array.isArray(value) && value[0]?.candidates && value[0]?.actorId) {
          records = value; break;
        }
      }
      const event = window.__esportsPairedMacro;
      const record = event?.assignmentRecord ?? (event && records.find(item => item.experiment
        && item.actorId === event.actorId && Math.abs(item.second - event.second) < 1e-6));
      const result = { label, event: structuredClone(event), record: structuredClone(record),
        wallSeconds: (performance.now() - started) / 1000 };
      if (!event?.matched || !record?.outcome || !event.followup)
        result.rejected = !event?.matched ? 'checkpoint failed exact-state gate'
          : 'missing fixed-step assignment or follow-up';
      output.push(result);
      if (result.rejected) break;
    }
    return output;
  })()`);
  return runs;
}

try {
  await send('Runtime.enable');
  const checkpointMode = process.argv.includes('--checkpoint');
  const output = { method: `Evaluation-only real browser ${checkpointMode ? 'same-mounted-checkpoint' : 'seed'} replay; accept only identical predecision state and duplicate-incumbent outcome before arm comparison; no live promotion`,
    seed, swapped, draft, afterSeconds, pairFilter, cardFilter, horizonSeconds, auditOnly, rewardModelHash,
    scout: null, replays: [], validPair: false };
  const scout = await episode('scout', 'scout');
  output.scout = scout;
  output.draftLineup = await evaluate('window.__esportsPairedLineup');
  await writeFile(outputPath, JSON.stringify(output, null, 2) + '\n');
  if (auditOnly) {
    if (!scout.inspection) throw Error('Audit ended without fixed-step inspection');
    console.log(JSON.stringify({ outputPath, second: scout.inspection.second,
      opportunities: scout.inspection.opportunityAudit, pushPlans: scout.inspection.executionAudit?.pushPlans }, null, 2));
  } else {
  if (!scout.event?.fingerprint || !scout.event.incumbent || !scout.event.alternate)
    throw Error(`No safe scout target: ${scout.rejected}; simulation second ${scout.inspection?.second ?? 'unavailable'}; evidence saved to ${outputPath}`);
  const base = { actorId: scout.event.actorId, second: scout.event.second,
    incumbent: scout.event.incumbent, alternate: scout.event.alternate,
    fingerprint: scout.event.fingerprint };
  if (checkpointMode) output.replays = await checkpointBatch(base);
  else for (const [label, arm] of [['incumbent-a', 'incumbent'], ['incumbent-b', 'incumbent'],
    ['alternate', 'alternate']]) {
    const result = await episode(label, 'replay', { ...base, arm });
    output.replays.push(result);
    await writeFile(outputPath, JSON.stringify(output, null, 2) + '\n');
    if (result.rejected || !result.record?.outcome) break;
  }
  for (const result of output.replays)
    console.log(`${result.label}: ${result.rejected ?? (result.record?.outcome ? 'matched outcome' : 'incomplete')}`);
  const [first, second, alternate] = output.replays;
  output.validPair = !!first?.record?.outcome && !!second?.record?.outcome
    && !!alternate?.record?.outcome && !!first.event?.followup && !!second.event?.followup
    && !!alternate.event?.followup && !first.rejected && !second.rejected && !alternate.rejected
    && first.record.experiment?.arm === 'incumbent'
    && second.record.experiment?.arm === 'incumbent'
    && alternate.record.experiment?.arm === 'alternate'
    && first.record.selected === base.incumbent && second.record.selected === base.incumbent
    && alternate.record.selected === base.alternate
    && typeof first.event.followupStateFingerprint === 'string'
    && JSON.stringify(first.record.outcome) === JSON.stringify(second.record.outcome)
    && JSON.stringify(first.record.snapshot) === JSON.stringify(second.record.snapshot)
    && first.event.followupStateFingerprint === second.event.followupStateFingerprint
    && JSON.stringify(first.event.taskEvents) === JSON.stringify(second.event.taskEvents)
    && JSON.stringify(first.event.taskOutcome) === JSON.stringify(second.event.taskOutcome)
    && JSON.stringify(first.event.followup) === JSON.stringify(second.event.followup);
  if (output.validPair) output.descriptiveAlternateMinusIncumbent =
    alternate.record.outcome.progress - first.record.outcome.progress;
  if (output.validPair) output.behavior = summarizePairedBehavior(first.event.behaviorTrace,
    alternate.event.behaviorTrace, base.second);
  if (rewardModel) {
    const reward = output.replays[3];
    const selected = reward?.record?.selected;
    const reference = selected === base.incumbent ? first : selected === base.alternate ? alternate : undefined;
    const executed = reward?.event?.behaviorTrace ? summarizePairedBehavior(first?.event?.behaviorTrace,
      reward.event.behaviorTrace, base.second).alternate.assignmentReachedExecutor : false;
    output.rewardTrial = { selected, decision: reward?.event?.rewardDecision, assignmentReachedExecutor: executed,
      validReplay: !!output.validPair && !reward?.rejected && !!reward?.event?.matched
        && executed && !!reference && reward?.event?.rewardDecision?.selected === selected
        && reward.event.followupStateFingerprint === reference.event.followupStateFingerprint
        && JSON.stringify(reward.event.taskEvents) === JSON.stringify(reference.event.taskEvents)
        && JSON.stringify(reward.event.taskOutcome) === JSON.stringify(reference.event.taskOutcome)
        && JSON.stringify(reward.record.outcome) === JSON.stringify(reference.record.outcome)
        && JSON.stringify(reward.event.followup) === JSON.stringify(reference.event.followup) };
  }
  if (output.validPair) output.extendedDifference = {
    healthFraction: alternate.event.followup.actor.hpFraction - first.event.followup.actor.hpFraction,
    gold: alternate.event.followup.actor.gold - first.event.followup.actor.gold,
    damageDealt: alternate.event.followup.actor.damageDealt - first.event.followup.actor.damageDealt,
    kills: alternate.event.followup.actor.kills - first.event.followup.actor.kills,
    deaths: alternate.event.followup.actor.deaths - first.event.followup.actor.deaths,
    x: alternate.event.followup.actor.x - first.event.followup.actor.x,
    y: alternate.event.followup.actor.y - first.event.followup.actor.y,
    nearestEnemyDistance: alternate.event.followup.nearestEnemyDistance === null
      || first.event.followup.nearestEnemyDistance === null ? null
      : alternate.event.followup.nearestEnemyDistance - first.event.followup.nearestEnemyDistance,
  };
  await writeFile(outputPath, JSON.stringify(output, null, 2) + '\n');
  console.log(JSON.stringify({ outputPath, scout: scout.event,
    replays: output.replays.map(run => ({ label: run.label, matched: run.event?.matched,
      rejected: run.rejected, outcome: run.record?.outcome,
      followup: run.event?.followup })),
    validPair: output.validPair,
    rewardTrial: output.rewardTrial,
    descriptiveAlternateMinusIncumbent: output.descriptiveAlternateMinusIncumbent,
    extendedDifference: output.extendedDifference }, null, 2));
  }
} finally { socket.close(); }
