import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';
import {
  FPS_TENDENCY_CATALOG,
  FPS_IGL_TENDENCIES,
  FPS_INDIVIDUAL_TENDENCIES,
  FPS_ALL_TENDENCY_KEYS,
  deriveFpsTendencies,
  effectiveTendency,
  evaluateCallResponse,
  describeIglLeadershipIdentity,
  computeTeamIdentityComparison,
  computeObservedTeamTendencies,
  analyzeTeamDynamics,
  FPS_OBSERVED_TEAM_CATEGORIES,
} from './fps/fpsPlayerTendencies.ts';
import { validateFpsPersonality, emptyFpsObservedBehavior, observeFpsBehavior, FPS_IDENTITY_PERSONALITIES } from './fps/fpsPlayerArchitecture.ts';
import { generatePlayerDNA } from './fps/fpsIdentity.ts';
import { createFpsIdentityContext } from './fps/fpsIdentityMatch.ts';
import { FpsLiveSimulation } from './fps/fpsLiveSimulation.ts';
import { simulateFpsMatch, createFpsPrng } from './fps/fpsSimulationEngine.ts';
import {
  recordFpsOpponentPattern,
  knownFpsSniperTendency,
  knownFpsElevatedTendency,
  createFpsObservedOpponentHabits,
  recordFpsObservedOpponentRound,
  knownFpsOpponentExploit,
} from './fps/fpsOpponentPatterns.ts';
import { FPS_TENDENCY_FORMULAS, FPS_DIAGNOSTIC_TENDENCY_KEYS, fpsTendencyBaseFromTable } from './fps/fpsTendencyFormulas.ts';
import { deriveFpsConsistency, fpsConsistencyLabel, fpsConsistencyRated } from './fps/fpsConsistency.ts';
import { fpsRated } from './fps/fpsScale10.ts';
import { buildFpsTendencyFormulaTable } from '../scripts/fps-tendency-formula-table.mjs';

// Keys the PHP scouting service derives (FpsPlayerArchitecture::deriveTendencies).
const SERVER_SCOUTING_KEYS = ['structuredCalling', 'defaultPreference', 'rushCalling', 'utilityHeavyCalling', 'delegation', 'playerAutonomy', 'leadFromFront', 'midroundAdaptation', 'tempoSwitching', 'opportunityCalling', 'riskCalling', 'secondaryCallerTrust', 'earlyAggression', 'playDiscipline', 'supportFlash', 'lurkFlank', 'wideSwing', 'jigglePeek', 'utilityConservation', 'rotationProactivity'];

const pAggressive = validateFpsPersonality({ temperament: 'STEADY', playstyle: 'AGGRESSIVE', mindset: 'INDIVIDUALIST', decisionStyle: 'INSTINCTIVE' });
const pStructured = validateFpsPersonality({ temperament: 'ICE_COLD', playstyle: 'PASSIVE', mindset: 'TEAM_FIRST', decisionStyle: 'METHODICAL' });

test('tendency catalog contains all 48 IGL and 178 individual channels with unique keys', () => {
  assert.equal(FPS_TENDENCY_CATALOG.iglCategories.length, 4);
  assert.equal(FPS_TENDENCY_CATALOG.individualCategories.length, 14);
  assert.equal(FPS_IGL_TENDENCIES.length, 48);
  assert.equal(FPS_INDIVIDUAL_TENDENCIES.length, 178);
  assert.equal(new Set(FPS_ALL_TENDENCY_KEYS).size, 226);
  assert.equal(FPS_TENDENCY_CATALOG.iglPresets.length, 4);
});

test('natural tendencies are deterministic, bounded 0-100, and independent of attributes', () => {
  const dna = generatePlayerDNA('player-a');
  const t1 = deriveFpsTendencies(pAggressive, dna);
  const t2 = deriveFpsTendencies(pAggressive, dna);
  assert.deepEqual(t1, t2);
  for (const key of FPS_ALL_TENDENCY_KEYS) {
    assert.ok(Number.isInteger(t1[key]) && t1[key] >= 0 && t1[key] <= 100, `${key}=${t1[key]}`);
  }
  const structured = deriveFpsTendencies(pStructured, dna);
  assert.ok(t1.wideSwing > structured.wideSwing);
  assert.ok(structured.structuredCalling > t1.structuredCalling);
  // Independent coexistence via lab overrides
  const dual = deriveFpsTendencies(pAggressive, dna, { jigglePeek: 88, wideSwing: 86 });
  assert.equal(dual.jigglePeek, 88);
  assert.equal(dual.wideSwing, 86);
});

test('effectiveTendency modulates expression without mutating natural tendencies', () => {
  const natural = deriveFpsTendencies(pAggressive, generatePlayerDNA('mod-test'));
  const before = structuredClone(natural);
  const structMod = effectiveTendency(natural, 'structuredCalling', {
    plan: { tempo: 0.2, structure: 0.95, aggression: 0.2, preparation: 0.95, freedom: 0.1, economy: 0.8 },
    chemistry: { trust: 0.9, leadershipAcceptance: 0.9 },
    familiarity: 0.9,
  });
  const baseVal = natural.structuredCalling / 100;
  assert.ok(structMod > baseVal);
  assert.deepEqual(natural, before);
});

test('contextual call acceptance responds to discipline, freedom, opportunity and immediate danger', () => {
  const rng = createFpsPrng(77);
  const disciplined = evaluateCallResponse({
    playDiscipline: 90, trustInIgl: 85, tacticalFreedom: 20, independentOpportunity: 20, callSuitability: 85, immediateDanger: 10,
  }, rng);
  const dangerous = evaluateCallResponse({
    playDiscipline: 75, trustInIgl: 80, tacticalFreedom: 40, independentOpportunity: 30, callSuitability: 60, immediateDanger: 92,
  }, rng);
  assert.ok(disciplined.probabilities.follow > dangerous.probabilities.follow);
  assert.ok(dangerous.probabilities.delay_or_report > disciplined.probabilities.delay_or_report);
});

test('IGL leadership identities, three-way team comparison and coaching diagnostics emerge cleanly', () => {
  const archPreset = FPS_TENDENCY_CATALOG.iglPresets.find(p => p.id === 'tactical_architect');
  const fragPreset = FPS_TENDENCY_CATALOG.iglPresets.find(p => p.id === 'fragging_playmaker');
  assert.equal(describeIglLeadershipIdentity(deriveFpsTendencies(pStructured, generatePlayerDNA('igl-1'), archPreset.values)).label, 'Tactical Architect');
  assert.equal(describeIglLeadershipIdentity(deriveFpsTendencies(pAggressive, generatePlayerDNA('igl-2'), fragPreset.values)).label, 'Fragging Playmaker');

  const iglT = deriveFpsTendencies(pAggressive, generatePlayerDNA('igl-2'), fragPreset.values);
  const entryT = deriveFpsTendencies(pAggressive, generatePlayerDNA('entry-1'), { earlyAggression: 90, playDiscipline: 25 });
  const supportT = deriveFpsTendencies(pStructured, generatePlayerDNA('supp-1'), { supportFlash: 88, lineupPreference: 85 });
  const comparison = computeTeamIdentityComparison(
    { tempo: 0.3, structure: 0.9, aggression: 0.3, preparation: 0.9, freedom: 0.2, economy: 0.8 },
    { preparation: 0.9, rigidity: 0.9, aggression: 0.3 },
    iglT,
  );
  assert.equal(comparison.dimensions.length, 7);
  const findings = analyzeTeamDynamics({
    plan: { tempo: 0.3, structure: 0.9, aggression: 0.3, preparation: 0.9, freedom: 0.2, economy: 0.8 },
    coach: { preparation: 0.9 },
    igl: { name: 'IGL', tendencies: iglT },
    entry: { name: 'Entry', tendencies: entryT },
    support: { name: 'Support', tendencies: supportT },
    roster: [{ name: 'IGL', tendencies: iglT }, { name: 'Entry', tendencies: entryT }, { name: 'Support', tendencies: supportT }],
  });
  assert.ok(findings.some(f => f.id === 'entry-support-mismatch'));
  assert.ok(findings.some(f => f.id === 'coach-igl-conflict'));
});

test('lawful opponent tendency scouting tracks observed sniper and elevated habits without hidden reads', () => {
  const patterns = [];
  for (const round of [1, 2]) {
    recordFpsOpponentPattern(patterns, {
      key: 'enemy:awper',
      enemyId: 'awper',
      observerId: 'obs',
      source: 'sight',
      x: -24,
      z: 18,
      observed: round * 30,
      confidence: 0.95,
      uncertainty: 0.4,
      weaponHint: 'sniper',
    }, round, 14, () => 'A', true);
  }
  const sniperHabit = knownFpsSniperTendency(patterns, 3, () => 'A');
  const elevHabit = knownFpsElevatedTendency(patterns, 3, () => 'A');
  assert.equal(sniperHabit?.area, 'A');
  assert.equal(sniperHabit?.samples, 2);
  assert.equal(elevHabit?.area, 'A');
});

test('tendency overrides integrate cleanly in both live 3D and 2D recorded simulations', () => {
  const cards = Array.from({ length: 10 }, (_, i) => ({
    id: `tend-${i}`,
    name: `Player ${i}`,
    stats: { rifling: 60, sniping: 60, entry: 60, utility: 60, positioning: 60, shotcalling: 60 },
  }));
  const ctx = createFpsIdentityContext(cards.slice(0, 5), cards.slice(5));
  ctx.players[cards[0].id].tendencyOverrides = { structuredCalling: 95, utilityHeavyCalling: 92, fakeCalling: 85 };
  ctx.players[cards[5].id].tendencyOverrides = { rushCalling: 95, leadFromFront: 95, wideSwing: 92 };

  const sim = new FpsLiveSimulation(cards.slice(0, 5), cards.slice(5), 515, ctx);
  sim.step();
  const snap = sim.snapshot();
  assert.ok(snap.players[0].iglIdentity?.label);
  assert.equal(snap.players[0].topTendencies?.length, 3);
  sim.remaining = 0.01;
  sim.step();
  for (let i = 0; i < 45; i++) sim.step();

  const match = simulateFpsMatch(cards.slice(0, 5), cards.slice(5), 'breakwater', 515, {
    identityExperiment: ctx,
    maxRounds: 2,
    roundSeconds: 20,
    overtimeEnabled: false,
  });
  assert.equal(match.totalRounds, 2);
  assert.ok(match.events.some(e => e.type === 'behavior_observation'));
});

test('lawful opponent habit exploits and 9-category observed team tendencies compute cleanly', () => {
  const habits = createFpsObservedOpponentHabits();
  recordFpsObservedOpponentRound(habits, 1, { earlyRush: true, savedOnLoss: true });
  recordFpsObservedOpponentRound(habits, 2, { earlyRush: true });
  recordFpsObservedOpponentRound(habits, 3, { savedOnLoss: true });
  const exploit = knownFpsOpponentExploit(habits, [], 4);
  assert.ok(exploit && (exploit.kind === 'anti_rush' || exploit.kind === 'hunt_saves'));
  assert.equal(exploit.samples, 2);

  const behaviorWith = (matches, metrics) => {
    const b = emptyFpsObservedBehavior();
    b.matches = matches;
    for (const [metric, attempts, opportunities] of metrics) for (let i = 0; i < opportunities; i++) observeFpsBehavior(b, metric, i < attempts);
    return b;
  };
  // Too few opportunities: nothing is fabricated, even with enough appearances.
  const thin = computeObservedTeamTendencies([behaviorWith(6, [['engagement', 3, 4], ['coordination', 2, 3]])]);
  assert.equal(thin.sufficient, false);
  for (const key of FPS_OBSERVED_TEAM_CATEGORIES) assert.equal(thin[key], null, key);
  // Enough opportunities but too few appearances: still withheld.
  const early = computeObservedTeamTendencies([behaviorWith(2, [['engagement', 15, 20], ['firstContact', 10, 20]])]);
  assert.equal(early.sufficient, false);
  assert.equal(early.opening, null);

  const roster = [
    behaviorWith(3, [['engagement', 12, 16], ['firstContact', 9, 12], ['coordination', 14, 18], ['strategyCompliance', 10, 16], ['opponentAdjustment', 6, 10]]),
    behaviorWith(3, [['engagement', 8, 14], ['firstContact', 5, 8], ['coordination', 9, 12], ['strategyCompliance', 8, 12], ['opponentAdjustment', 6, 10]]),
    undefined,
  ];
  const teamObs = computeObservedTeamTendencies(roster);
  assert.equal(teamObs.samples, 6);
  assert.equal(teamObs.sufficient, true);
  assert.equal(teamObs.opening, Math.round((20 / 30 * 100) * 0.45 + (14 / 20 * 100) * 0.55));
  assert.ok(teamObs.coordination !== null && teamObs.psychology !== null && teamObs.leadership !== null);
  assert.equal(teamObs.defense, null, 'no retake/rotation observations yet');
  assert.equal(teamObs.economy, Math.round(18 / 28 * 100), 'only compliance qualifies; weights renormalize');
  for (const key of FPS_OBSERVED_TEAM_CATEGORIES) if (teamObs[key] !== null) assert.ok(teamObs[key] >= 0 && teamObs[key] <= 100);
  // A single recorded match may be shown as a labelled match sample.
  assert.equal(computeObservedTeamTendencies([behaviorWith(1, [['engagement', 15, 20]])], { minMatches: 1 }).sufficient, true);
});

test('server scouting derivation matches the shared TypeScript vectors', () => {
  const fixture = new URL('../../EsportsClash.Api/tests/Fixtures/fps-tendency-vectors.json', import.meta.url);
  const vectors = [];
  for (let i = 0; i < 54; i++) {
    const id = `00000000-0000-4000-8000-${String(i + 1).padStart(12, '0')}`;
    const p = FPS_IDENTITY_PERSONALITIES[(i * 7) % 54];
    const dna = generatePlayerDNA(id);
    const t = deriveFpsTendencies(p, dna);
    vectors.push({
      personality: { temperament: p.temperament, playstyle: p.playstyle, mindset: p.mindset, decisionStyle: p.decisionStyle },
      dna,
      expected: Object.fromEntries(SERVER_SCOUTING_KEYS.map(k => [k, t[k]])),
      // Values the server sends the Tactical System Editor (derived_tendencies) instead of DNA.
      diagnostics: Object.fromEntries(FPS_DIAGNOSTIC_TENDENCY_KEYS.map(k => [k, t[k]])),
      // Manager-facing output: whole 1–10 levels with labels (fpsScale10), never raw values.
      diagnosticsRated: Object.fromEntries(FPS_DIAGNOSTIC_TENDENCY_KEYS.map(k => [k, fpsRated(t[k], 'tendency')])),
      // Hidden capability trait; the server exposes only its 1–10 level and label.
      consistency: deriveFpsConsistency(p, dna),
      consistencyRated: fpsConsistencyRated(deriveFpsConsistency(p, dna)),
    });
  }
  if (process.env.FPS_WRITE_TENDENCY_FIXTURE === '1') writeFileSync(fixture, JSON.stringify(vectors, null, 2) + '\n');
  assert.deepEqual(JSON.parse(readFileSync(fixture, 'utf8')), vectors);
});

test('shared tendency formula table is current and reproduces every client tendency exactly', () => {
  const table = new URL('./fps/fps-tendency-formulas-v4.json', import.meta.url);
  const built = buildFpsTendencyFormulaTable([...FPS_ALL_TENDENCY_KEYS]);
  if (process.env.FPS_WRITE_TENDENCY_FIXTURE === '1') writeFileSync(table, JSON.stringify(built) + '\n');
  assert.deepEqual(JSON.parse(readFileSync(table, 'utf8')), built, 'regenerate with FPS_WRITE_TENDENCY_FIXTURE=1');
  assert.equal(Object.keys(FPS_TENDENCY_FORMULAS.formulas).length, FPS_ALL_TENDENCY_KEYS.length);
  // The editor's diagnostics must be computable from server values alone.
  for (const key of ['earlyAggression', 'playDiscipline', 'supportFlash', 'flashFollowup', 'lineupPreference', 'structuredCalling', 'secondaryCallerTrust']) assert.ok(FPS_DIAGNOSTIC_TENDENCY_KEYS.includes(key), key);
  const fnv = value => { let h = 2166136261; for (const c of value) h = Math.imul(h ^ c.charCodeAt(0), 16777619) >>> 0; return h; };
  for (let i = 0; i < 108; i++) {
    const p = FPS_IDENTITY_PERSONALITIES[i % 54], dna = generatePlayerDNA(`formula-${i}`), t = deriveFpsTendencies(p, dna);
    const sig = `${dna.riskTolerance}:${dna.creativity}:${dna.tacticalDiscipline}:${dna.teamOrientation}:${dna.leadershipInitiative}:${dna.adaptability}`;
    for (const key of FPS_ALL_TENDENCY_KEYS) {
      const jitter = ((fnv(`${p.id}:${sig}:${key}`) % 1000) / 999 - 0.5) * FPS_TENDENCY_FORMULAS.jitterSpan;
      assert.equal(Math.round(Math.max(0, Math.min(100, fpsTendencyBaseFromTable(key, p, dna) + jitter))), t[key], `${key} vector ${i}`);
    }
  }
});

test('consistency is a bounded hidden trait derived from stability, volatility, discipline and temperament', () => {
  const calm = validateFpsPersonality({ temperament: 'ICE_COLD', playstyle: 'PASSIVE', mindset: 'TEAM_FIRST', decisionStyle: 'METHODICAL' });
  const hot = validateFpsPersonality({ ...calm, temperament: 'VOLATILE' });
  const steadyDna = { emotionalStability: 90, confidenceVolatility: 10, tacticalDiscipline: 85, preparationPreference: 80 };
  const streakyDna = { emotionalStability: 15, confidenceVolatility: 90, tacticalDiscipline: 20, preparationPreference: 20 };
  assert.ok(deriveFpsConsistency(calm, steadyDna) > deriveFpsConsistency(hot, steadyDna));
  assert.ok(deriveFpsConsistency(hot, steadyDna) > deriveFpsConsistency(hot, streakyDna));
  assert.deepEqual(fpsConsistencyRated(deriveFpsConsistency(calm, steadyDna)), { value: 9, label: 'Formidable' });
  assert.deepEqual(fpsConsistencyRated(deriveFpsConsistency(hot, streakyDna)), { value: 3, label: 'Poor' });
  assert.equal(fpsConsistencyLabel(95), 'Metronomic');
  assert.deepEqual([0, 10, 10.5, 50, 50.01, 99, 100].map(v => fpsRated(v, 'tendency').value), [1, 1, 2, 5, 6, 10, 10]);
  assert.deepEqual([fpsRated(5, 'tendency').label, fpsRated(100, 'tendency').label, fpsRated(1, 'skill').label], ['Never', 'Always', 'Erratic']);
  assert.equal(deriveFpsConsistency(calm, { emotionalStability: 100, confidenceVolatility: 0, tacticalDiscipline: 100, preparationPreference: 100 }), 99);
  assert.equal(deriveFpsConsistency(hot, { emotionalStability: 0, confidenceVolatility: 100, tacticalDiscipline: 0, preparationPreference: 0 }), 10);
  const labels = new Set(FPS_IDENTITY_PERSONALITIES.map((p, i) => fpsConsistencyLabel(deriveFpsConsistency(p, generatePlayerDNA(`spread-${i}`)))));
  assert.ok(labels.size >= 3, 'roster spans several consistency bands');
});

test('pressure shifts impulsive and composed expression within a bounded range without mutation', () => {
  const natural = deriveFpsTendencies(pStructured, generatePlayerDNA('pressure-test'));
  const before = structuredClone(natural);
  const calm = effectiveTendency(natural, 'playDiscipline', { pressure: 0 });
  const tense = effectiveTendency(natural, 'playDiscipline', { pressure: 1, pressureSensitivity: 1 });
  assert.ok(tense < calm && calm - tense <= 0.12 + 1e-9);
  assert.ok(effectiveTendency(natural, 'wideSwing', { pressure: 1, pressureSensitivity: 1 }) > effectiveTendency(natural, 'wideSwing', {}));
  assert.equal(effectiveTendency(natural, 'lineupPreference', { pressure: 1, pressureSensitivity: 1 }), natural.lineupPreference / 100);
  assert.deepEqual(natural, before);
});

test('the four IGL presets produce distinct identities and different call freedom', () => {
  const dna = generatePlayerDNA('preset-igl');
  const labels = {
    tactical_architect: 'Tactical Architect',
    fragging_playmaker: 'Fragging Playmaker',
    adaptive_mastermind: 'Adaptive Mastermind',
    player_centric_facilitator: 'Player-Centric Facilitator',
  };
  const freedom = {};
  for (const preset of FPS_TENDENCY_CATALOG.iglPresets) {
    for (const key of Object.keys(preset.values)) assert.ok(FPS_ALL_TENDENCY_KEYS.includes(key), key);
    const t = deriveFpsTendencies(pStructured, dna, preset.values);
    assert.equal(describeIglLeadershipIdentity(t).label, labels[preset.id], preset.id);
    freedom[preset.id] = evaluateCallResponse({
      playDiscipline: 55, trustInIgl: 60, tacticalFreedom: t.playerAutonomy, independentOpportunity: 60, callSuitability: 70, immediateDanger: 15,
    }, () => 0.5).probabilities.pursue_independent;
  }
  assert.ok(freedom.player_centric_facilitator > freedom.tactical_architect);
});

test('entry-support diagnostics separate timing friction from synchronized pairs', () => {
  const plan = { tempo: 0.5, structure: 0.5, aggression: 0.5, preparation: 0.5, freedom: 0.5, economy: 0.5 };
  const dna = generatePlayerDNA('flash-sync');
  const support = { name: 'Support', tendencies: deriveFpsTendencies(pStructured, dna, { supportFlash: 85, lineupPreference: 80 }) };
  const rushing = { name: 'Entry', tendencies: deriveFpsTendencies(pAggressive, dna, { earlyAggression: 92, playDiscipline: 20 }) };
  const synced = { name: 'Entry', tendencies: deriveFpsTendencies(pStructured, dna, { earlyAggression: 50, playDiscipline: 80, flashFollowup: 85 }) };
  const ids = entry => analyzeTeamDynamics({ plan, coach: {}, entry, support, roster: [entry, support] }).map(f => f.id);
  assert.ok(ids(rushing).includes('entry-support-mismatch'));
  assert.ok(ids(synced).includes('entry-support-sync'));
  assert.ok(!ids(synced).includes('entry-support-mismatch'));
});

test('opponent exploits need two observed rounds inside the rolling six-round window', () => {
  const habits = createFpsObservedOpponentHabits();
  recordFpsObservedOpponentRound(habits, 1, { earlyRush: true });
  assert.equal(knownFpsOpponentExploit(habits, [], 2), undefined, 'one observation is not a habit');
  recordFpsObservedOpponentRound(habits, 2, { earlyRush: true });
  assert.equal(knownFpsOpponentExploit(habits, [], 3)?.kind, 'anti_rush');
  assert.equal(knownFpsOpponentExploit(habits, [], 9), undefined, 'observations older than six rounds expire');
  assert.equal(knownFpsOpponentExploit(habits, [], 2), undefined, 'the current round is never used');
});

const liveCards = Array.from({ length: 10 }, (_, i) => ({
  id: `live-call-${i}`,
  name: `Caller ${i}`,
  stats: { rifling: 60, sniping: 60, entry: 60, utility: 60, positioning: 60, shotcalling: 60 },
}));
const startLive = () => {
  const ctx = createFpsIdentityContext(liveCards.slice(0, 5), liveCards.slice(5));
  const sim = new FpsLiveSimulation(liveCards.slice(0, 5), liveCards.slice(5), 4242, ctx);
  sim.step();
  sim.remaining = 0.01;
  for (let i = 0; i < 3; i++) sim.step();
  return sim;
};

test('a dead IGL is replaced once, and a combat-locked IGL can hand calls to a trusted secondary voice', () => {
  const sim = startLive();
  const team = sim.attackTeam;
  const allies = () => sim.actors.filter(a => a.team === team && a.hp > 0);
  const igl = allies().find(a => a.role === 'caller');
  assert.ok(igl, 'attacking IGL present');
  sim.informationOrders[team].callerId = igl.id;
  let takeovers = 0;
  const radio = sim.radio.bind(sim);
  sim.radio = (p, message, ...rest) => { if (String(message).includes('taking over calls')) takeovers++; return radio(p, message, ...rest); };
  igl.hp = 0;
  for (let i = 0; i < 240; i++) sim.step();
  assert.equal(takeovers, 1, `takeover announced ${takeovers} times`);
  assert.notEqual(sim.informationOrders[team].callerId, igl.id);

  const live = startLive();
  const blue = live.actors.filter(a => a.team === 'blue' && a.hp > 0);
  const blueIgl = blue.find(a => a.role === 'caller');
  const second = blue.find(a => a !== blueIgl);
  for (const a of blue) a.tendencies = { ...a.tendencies, midroundInitiative: a === second ? 98 : 5 };
  blueIgl.tendencies = { ...blueIgl.tendencies, secondaryCallerTrust: 95 };
  live.inImmediateFight = a => a === blueIgl;
  assert.equal(live.activeCaller(blue), second, 'trusted secondary calls while the IGL is fighting');
  blueIgl.tendencies = { ...blueIgl.tendencies, secondaryCallerTrust: 5 };
  assert.equal(live.activeCaller(blue), blueIgl, 'low-trust IGL keeps calling through the fight');
  live.inImmediateFight = () => false;
  blueIgl.tendencies = { ...blueIgl.tendencies, secondaryCallerTrust: 95 };
  assert.equal(live.activeCaller(blue), blueIgl, 'a free IGL always calls');
  const snap = live.snapshot();
  assert.ok(snap.players.every(p => p.callResponse === undefined || ['follow', 'follow_adjusted', 'pursue_independent', 'delay_or_report'].includes(p.callResponse)));
});

test('2D recorded lab runs honor tendency overrides through contextual call acceptance', () => {
  const run = values => {
    const ctx = createFpsIdentityContext(liveCards.slice(0, 5), liveCards.slice(5));
    for (const card of liveCards) ctx.players[card.id].tendencyOverrides = values;
    const match = simulateFpsMatch(liveCards.slice(0, 5), liveCards.slice(5), 'breakwater', 919, {
      identityExperiment: ctx, maxRounds: 4, roundSeconds: 40, overtimeEnabled: false,
    });
    const obs = match.events.filter(e => e.type === 'behavior_observation' && e.observation?.metric === 'improvisation');
    return obs.length ? obs.filter(e => e.observation.attempted).length / obs.length : null;
  };
  const independent = run({ playDiscipline: 0, opportunityExploitation: 100 });
  const disciplined = run({ playDiscipline: 100, opportunityExploitation: 0 });
  assert.ok(independent !== null && disciplined !== null, 'improvisation opportunities recorded');
  assert.ok(independent > disciplined, `independent ${independent} vs disciplined ${disciplined}`);
});
