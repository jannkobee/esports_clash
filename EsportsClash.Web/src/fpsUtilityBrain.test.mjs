import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { getLiveMapRuntime } from './fps/fpsLiveMapRegistry.ts';
import {planLiveSmokes, liveSmokeRequest} from './fps/fpsSmokePlanner.ts';
import {
  calculateLiveThrow, createFpsUtilityBrain, loadFpsUtilityBrain, learnFpsThrowOutcome, practiceFpsSmokeTargets,
  fpsThrowStylesForDistance, fpsUtilityThrowKey, FpsUtilityLearner, practiceFpsUtilityTargets, fpsUtilityPracticeTargets,
  scoreFpsThrow, fpsFlashAllyHazard, fpsBelievedDetonation, FPS_FLASH_ALLY_HAZARD_LIMIT, scoreFpsPopFlashCandidate,
} from './fps/fpsUtilityBrain.ts';
import { classifyFpsUtilityThrow, judgeFpsUtilityOutcome } from './fps/fpsUtilityPurpose.ts';
import { seedFpsUtilityBrain, readFpsUtilityBrain, saveFpsUtilityBrain, FPS_UTILITY_BRAIN_STORAGE_KEY } from './fps/fpsUtilityBrainStorage.ts';
import { FpsLiveSimulation } from './fps/fpsLiveSimulation.ts';
import { createFpsIdentityContext } from './fps/fpsIdentityMatch.ts';
import { LIVE_UTILITY_FUSES } from './fps/fpsLiveGrenades.ts';

const fontessa = getLiveMapRuntime('fontessa');
const spillway = getLiveMapRuntime('spillway');

test('throw type follows distance: underhand close, normal mid-range, jump throws long', () => {
  assert.equal(fpsThrowStylesForDistance(5)[0], 'underhand');
  assert.equal(fpsThrowStylesForDistance(10)[0], 'medium');
  assert.equal(fpsThrowStylesForDistance(18)[0], 'standard');
  assert.ok(['jump', 'walk-jump'].includes(fpsThrowStylesForDistance(34)[0]));
  assert.equal(fpsThrowStylesForDistance(40)[0], 'walk-jump');
});

test('bots calculate throws from distance and blockers, and arc over buildings in the way', () => {
  for (const runtime of [fontessa, spillway]) {
    let calculated = 0, overCover = 0;
    for (const lineup of runtime.authoredSmokeLineups) {
      const plan = calculateLiveThrow('smoke', lineup.position, lineup.target, 1.55 + runtime.terrain.groundHeight(lineup.position), runtime);
      if (!plan) continue;
      calculated++;
      if (plan.path === 'over-cover') overCover++;
      assert.equal(plan.source, 'calculated');
      assert.ok(plan.flightTime >= .42 && plan.flightTime <= 3.4);
      assert.ok(Number.isFinite(plan.launchYaw + plan.launchPitch));
    }
    assert.ok(calculated >= runtime.authoredSmokeLineups.length * .8, `${runtime.id}: ${calculated} calculated`);
    assert.ok(overCover > 0, `${runtime.id}: some throws must arc over cover`);
  }
});

test('a missed smoke teaches a correction, and the next throw from that spot uses it', () => {
  const brain = createFpsUtilityBrain();
  const lineup = spillway.authoredSmokeLineups.find(l => l.id === 'sw-ct-b-main');
  const height = 1.55 + spillway.terrain.groundHeight(lineup.position);
  const first = calculateLiveThrow('smoke', lineup.position, lineup.target, height, spillway, brain);
  const landing = {x: lineup.target.x + 3, z: lineup.target.z, y: spillway.terrain.groundHeight(lineup.target) + .09};
  const lesson = learnFpsThrowOutcome(brain, {key: first.key, plan: first, intended: lineup.target, landing, targetFloor: landing.y});
  assert.equal(lesson.success, false);
  const second = calculateLiveThrow('smoke', lineup.position, lineup.target, height, spillway, brain);
  assert.equal(second.source, 'remembered');
  assert.ok(second.aimTarget.x < first.aimTarget.x, 'landed 3m to +x, so aim moves toward -x');
});

test('practice discovers working throws without any pre-solved lineup data', () => {
  const brain = createFpsUtilityBrain();
  const targets = spillway.authoredSmokeLineups.filter(l => ['sw-ct-b-main', 'sw-ct-b-short', 'sw-ct-squeaky', 'sw-b-pillar-cross'].includes(l.id));
  const result = practiceFpsSmokeTargets(brain, spillway, targets, 8);
  assert.equal(result.mastered, targets.length);
  assert.ok(Object.keys(brain.spots).length >= targets.length, 'working spots are remembered');
});

test('stored brains are validated and the committed seed brain loads', () => {
  assert.equal(loadFpsUtilityBrain({version: 99, entries: {}}), undefined);
  const dirty = loadFpsUtilityBrain({version: 1, entries: {a: {style: 'teleport', flight: 1, aimDx: 0, aimDz: 0, attempts: 1, successes: 0, lastError: 1}}});
  assert.deepEqual(dirty.entries, {});
  const seed = seedFpsUtilityBrain();
  assert.equal(seed.version, 1);
  const memory = new Map();
  const storage = {getItem: k => memory.get(k) ?? null, setItem: (k, v) => memory.set(k, v), removeItem: k => memory.delete(k)};
  assert.deepEqual(readFpsUtilityBrain(storage), seed);
  const learned = createFpsUtilityBrain(); learned.throws = 3;
  saveFpsUtilityBrain(learned, storage);
  assert.ok(memory.has(FPS_UTILITY_BRAIN_STORAGE_KEY));
  assert.equal(readFpsUtilityBrain(storage).throws, 3);
});

test('frozen mode plans from memory but never changes it', () => {
  const learner = new FpsUtilityLearner({mode: 'frozen', model: createFpsUtilityBrain()});
  const lineup = fontessa.authoredSmokeLineups[4];
  const plan = learner.plan('smoke', lineup.position, lineup.target, 1.55, fontessa);
  learner.record({key: plan.key, plan, intended: lineup.target, landing: {x: lineup.target.x + 5, z: lineup.target.z, y: .1}, targetFloor: .1});
  assert.equal(Object.keys(learner.brain.entries).length, 0);
  assert.equal(learner.stats().thisMatch.throws, 1);
});

test('live matches throw calculated smokes and learn from where they land', () => {
  const cards = Array.from({length: 10}, (_, i) => ({id: `brain-${i}`, name: `Brain ${i}`, stats: {rifling: 70, sniping: 70, entry: 70, utility: 90, positioning: 70, shotcalling: 70}}));
  const saved = [];
  const sim = new FpsLiveSimulation(cards.slice(0, 5), cards.slice(5), 2024, createFpsIdentityContext(cards.slice(0, 5), cards.slice(5)),
    {mapId: 'spillway', utilityLearning: {mode: 'learn', model: createFpsUtilityBrain(), onRound: brain => saved.push(brain)}});
  for (let i = 0; i < 9000 && (sim.snapshot().utilityLearning?.thisMatch.throws ?? 0) < 3; i++) sim.step();
  const stats = sim.snapshot().utilityLearning;
  assert.ok(stats.thisMatch.throws >= 1, 'smokes were thrown and scored');
  assert.ok(stats.remembered >= 1, 'the brain remembers them');
  assert.ok(fpsUtilityThrowKey('spillway', 'smoke', {x: 0, z: 0}, {x: 1, z: 1}).startsWith('spillway:smoke:'));
});

// ---- Every grenade is calculated and learned (flash, fire, HE) ----

test('flashes are calculated to pop at the spot as the fuse ends, and learned from where they pop', () => {
  const drill = fpsUtilityPracticeTargets(fontessa, 'flash').find(t => t.id === 'A:staging0>flash1');
  assert.ok(drill, 'Fontessa A flash drill exists');
  const plan = calculateLiveThrow('flash', drill.position, drill.target, 1.55, fontessa);
  assert.equal(plan.source, 'calculated');
  assert.ok(Math.abs(plan.flightTime - LIVE_UTILITY_FUSES.flashFuse) < .35, `flight ${plan.flightTime} is timed to the fuse`);
  const brain = createFpsUtilityBrain();
  const result = practiceFpsUtilityTargets(brain, fontessa, [drill], 12, 'flash');
  assert.equal(result.mastered, 1);
  assert.ok(Object.keys(brain.entries).every(k => k.startsWith('fontessa:flash:')), 'flash memory is kept per kind');
});

test('flash pops are scored in the air near the spot and only with sight of it', () => {
  const intended = {x: 0, z: 0}, targetFloor = .09;
  assert.equal(scoreFpsThrow('flash', {intended, landing: {x: 1, y: 2, z: 1}, targetFloor, sight: true}).success, true);
  assert.equal(scoreFpsThrow('flash', {intended, landing: {x: 1, y: 2, z: 1}, targetFloor, sight: false}).success, false, 'popped behind a wall');
  assert.equal(scoreFpsThrow('flash', {intended, landing: {x: 1, y: 9, z: 1}, targetFloor, sight: true}).success, false, 'popped far too high');
  assert.equal(scoreFpsThrow('flash', {intended, landing: {x: 5, y: 2, z: 0}, targetFloor, sight: true}).success, false, 'popped too far away');
});

test('fire and HE are scored on floor contact near the target, and a miss teaches a correction', () => {
  const intended = {x: 0, z: 0}, targetFloor = .09;
  for (const kind of ['incendiary', 'he']) {
    assert.equal(scoreFpsThrow(kind, {intended, landing: {x: 1, y: .1, z: 1}, targetFloor}).success, true, kind);
    assert.equal(scoreFpsThrow(kind, {intended, landing: {x: .5, y: 4, z: 0}, targetFloor}).onTargetFloor, false, `${kind} on a roof`);
  }
  const brain = createFpsUtilityBrain();
  const lineup = spillway.authoredSmokeLineups.find(l => l.id === 'sw-ct-b-main');
  const height = 1.55 + spillway.terrain.groundHeight(lineup.position);
  for (const kind of ['incendiary', 'he']) {
    const first = calculateLiveThrow(kind, lineup.position, lineup.target, height, spillway, brain);
    assert.ok(first.key.includes(`:${kind}:`));
    const landing = {x: lineup.target.x + 3, z: lineup.target.z, y: spillway.terrain.groundHeight(lineup.target) + .09};
    learnFpsThrowOutcome(brain, {key: first.key, plan: first, intended: lineup.target, landing, targetFloor: landing.y});
    const second = calculateLiveThrow(kind, lineup.position, lineup.target, height, spillway, brain);
    assert.equal(second.source, 'remembered');
    assert.ok(second.aimTarget.x < first.aimTarget.x, `${kind}: landed 3m to +x, so aim moves toward -x`);
  }
});

test('practice masters fire and HE drills with the game physics as feedback', () => {
  for (const kind of ['incendiary', 'he']) {
    const drills = fpsUtilityPracticeTargets(fontessa, kind);
    assert.ok(drills.length >= 4, `${kind} drills`);
    const result = practiceFpsUtilityTargets(createFpsUtilityBrain(), fontessa, drills, 16, kind);
    assert.ok(result.mastered >= 3, `${kind}: ${result.mastered}/${result.targets} mastered`);
  }
});

test('the hard smoke targets are learned from an empty brain without pre-solved throws', () => {
  // The mid window was narrowed to a normal window (2026-11-17), so a smoke into the room through it is no longer
  // a practical target; the smokes the bots plan for Mid control (both sides) are practised below instead.
  for (const [runtime, ids] of [[fontessa, ['guard-market', 'guard-civic']], [spillway, ['sw-t-connector', 'sw-t-canal-cross', 'sw-b-service-exit']]]) {
    for (const id of ids) {
      const lineup = runtime.authoredSmokeLineups.find(l => l.id === id);
      assert.ok(runtime.walkable(lineup.position), `${id}: suggested launch spot is walkable`);
      const result = practiceFpsSmokeTargets(createFpsUtilityBrain(), runtime, [lineup], 24);
      assert.equal(result.mastered, 1, `${runtime.id} ${id} learned in 24 practice throws`);
    }
  }
});

test('the smokes bots plan for Mid control are learned from an empty brain', () => {
  for (const runtime of [fontessa, spillway]) for (const attacking of [true, false]) {
    const [lineup] = planLiveSmokes(runtime, liveSmokeRequest(runtime, attacking, 'control', 'Mid'));
    assert.ok(lineup && runtime.walkable(lineup.position), `${runtime.id}: a staging spot was found`);
    assert.equal(practiceFpsSmokeTargets(createFpsUtilityBrain(), runtime, [lineup], 24).mastered, 1, `${runtime.id} ${lineup.id}`);
  }
});

test('pop-flash teammate safety: a busy teammate facing the expected pop refuses the flash', () => {
  const pop = {x: 19, y: 1.7, z: -2};
  assert.ok(fpsFlashAllyHazard(pop, [{x: 19, z: -6, yaw: 0}], fontessa) >= FPS_FLASH_ALLY_HAZARD_LIMIT, 'staring at it');
  assert.equal(fpsFlashAllyHazard(pop, [{x: 19, z: -6, yaw: Math.PI}], fontessa), 0, 'turned away');
  const plan = calculateLiveThrow('flash', {x: 19, z: -10}, {x: 19, z: -2}, 1.55, fontessa);
  const believed = fpsBelievedDetonation('flash', plan, {x: 19, z: -10}, {x: 19, z: -2}, 1.55, fontessa);
  assert.ok(Math.hypot(believed.x - 19, believed.z + 2) < 3 && believed.y > .5 && believed.y < 6, 'the thrower expects an air pop near the spot');

  const cards = Array.from({length: 10}, (_, i) => ({id: `flash-safe-${i}`, name: `Flash ${i}`, stats: {rifling: 70, sniping: 70, entry: 70, utility: 90, positioning: 70, shotcalling: 70}}));
  const sim = new FpsLiveSimulation(cards.slice(0, 5), cards.slice(5), 77, createFpsIdentityContext(cards.slice(0, 5), cards.slice(5)));
  Object.assign(sim, {phase: 'live', time: 20, roundLiveAt: 0, liveElapsed: 30, remaining: 70});
  for (const a of sim.actors) Object.assign(a, {hp: 0, nextSense: Infinity, nextThink: Infinity});
  const p = sim.actors[0], mate = sim.actors[1];
  Object.assign(p, {hp: 100, x: 19, z: -10, yaw: 0, flash: 1, profile: undefined, channel: 0, reload: 0, weaponReady: 0, utilityAt: 0, utilityPreparation: undefined, throwAt: undefined, equipped: p.weapon, jump: false, crouch: false, jumpY: 0, groundY: 0, damageAt: -100, target: undefined});
  Object.assign(mate, {hp: 100, x: 19, z: -6, yaw: 0, channel: 2, crouch: false, jumpY: 0});
  assert.equal(sim.throwUtility(p, 'flash', {x: 19, z: -2}), false, 'a planting teammate staring at the pop is not flashed');
  mate.yaw = Math.PI;
  assert.equal(sim.throwUtility(p, 'flash', {x: 19, z: -2}), false, 'a planting teammate cannot turn away, so facing alone is not enough');
  mate.channel = 0;
  assert.equal(sim.throwUtility(p, 'flash', {x: 19, z: -2}), true, 'the same flash is thrown once the teammate is free and faces away');
  assert.equal(p.utilityPreparation.throwPlan.key.split(':')[1], 'flash', 'the live flash comes from the utility brain');
});

test('live throws never call the throw solvers or simulate a grenade ahead of release', () => {
  const source = readFileSync(new URL('./fps/fpsLiveSimulation.ts', import.meta.url), 'utf8');
  assert.doesNotMatch(source, /solveLiveGrenadeThrow|solveLivePopFlash|solveLiveSmokeThrow/);
  assert.doesNotMatch(source, /predictLiveGrenade\(/);
});

test('live matches calculate and score flashes, fire and HE as well as smokes', () => {
  const cards = Array.from({length: 10}, (_, i) => ({id: `kinds-${i}`, name: `Kinds ${i}`, stats: {rifling: 70, sniping: 70, entry: 70, utility: 90, positioning: 70, shotcalling: 70}}));
  const sim = new FpsLiveSimulation(cards.slice(0, 5), cards.slice(5), 4242, createFpsIdentityContext(cards.slice(0, 5), cards.slice(5)),
    {mapId: 'fontessa', utilityLearning: {mode: 'learn', model: createFpsUtilityBrain()}});
  const nonSmoke = () => Object.keys(sim.snapshot().utilityLearning?.thisMatch.kinds ?? {}).filter(k => k !== 'smoke').length;
  for (let i = 0; i < 24000 && nonSmoke() < 2; i++) sim.step();
  const kinds = sim.snapshot().utilityLearning.thisMatch.kinds;
  assert.ok(nonSmoke() >= 2, `non-smoke kinds scored: ${JSON.stringify(kinds)}`);
  assert.ok(Object.keys(sim.utilityBrainCheckpoint().entries).some(k => /:(flash|incendiary|he):/.test(k)), 'and remembered per kind');
});

test('scoreFpsPopFlashCandidate rewards corner-occluded pop-flash flights over telegraphed open flights and protects busy allies', () => {
  // Find a wall corner on Fontessa where a pop point is visible to enemyEye, one throw origin is in open view,
  // and another throw origin hides early/mid flight behind the wall before emerging at the pop point.
  const enemyEye = {x: 19, y: 1.6, z: 2};
  const pop = {x: 19, y: 1.7, z: -2};
  const openFrom = {x: 19, y: 1.55, z: -10};
  const openScore = scoreFpsPopFlashCandidate(openFrom, pop, enemyEye, fontessa, []);
  assert.ok(openScore, 'open-lane pop is within range and sight of enemyEye');
  assert.equal(openScore.occludedCount, 0, 'open corridor flight is visible the whole way');

  // Throw from behind the Banana / market wall so early flight is occluded from enemyEye at (19, 1.6, 2)
  let cornerScore;
  for (const candFrom of [{x: 12, y: 1.55, z: -8}, {x: 13, y: 1.55, z: -6}, {x: 25, y: 1.55, z: -6}, {x: 14, y: 1.55, z: 0}]) {
    const s = scoreFpsPopFlashCandidate(candFrom, pop, enemyEye, fontessa, []);
    if (s && s.occludedCount >= 1) { cornerScore = s; break; }
  }
  assert.ok(cornerScore, 'found a corner-occluded throw origin');
  assert.ok(cornerScore.occludedCount >= 1);
  assert.equal(cornerScore.surpriseBonus, cornerScore.occludedCount * 2.2);
  assert.ok(cornerScore.effectiveScore > openScore.effectiveScore, 'corner-occluded pop-flash scores higher than telegraphed open flight');

  // Busy ally staring at the pop point vetoes the candidate
  assert.equal(scoreFpsPopFlashCandidate(openFrom, pop, enemyEye, fontessa, [{x: 19, z: -6, yaw: 0}]), undefined);
  // Out-of-range pop (> 9.5m) returns undefined
  assert.equal(scoreFpsPopFlashCandidate(openFrom, {x: 19, y: 1.7, z: -10}, enemyEye, fontessa, []), undefined);
});

test('judgeFpsUtilityOutcome credits flashes that force enemies to turn away and HE grenades that displace or deal >= 12 damage', () => {
  const baseCtx = {
    kind: 'flash', attacking: true, phase: 'execute', enemyAtTarget: true, sniperAtTarget: false,
    lowHpEnemyAtTarget: false, teammateEngaging: true, retreating: false, fireAtTarget: false,
    enemySmokeAtTarget: false, bombNearTarget: false, opponentOnObjective: false, ownTeamOnObjective: false,
  };
  const flashIntent = classifyFpsUtilityThrow(baseCtx);
  assert.equal(judgeFpsUtilityOutcome(flashIntent, {enemiesBlinded: 0, enemiesTurnedAway: 1, alliesBlinded: 0}).achieved, true, 'forcing an enemy to turn away achieves the flash purpose');
  assert.equal(judgeFpsUtilityOutcome(flashIntent, {enemiesBlinded: 0, enemiesTurnedAway: 1, alliesBlinded: 1}).achieved, true, 'turning an enemy still counts even if an ally caught partial flash');
  assert.equal(judgeFpsUtilityOutcome(flashIntent, {enemiesBlinded: 0, enemiesTurnedAway: 0, alliesBlinded: 1}).achieved, false, 'pure team-flash with 0 enemies blinded or turned fails');

  const heIntent = classifyFpsUtilityThrow({...baseCtx, kind: 'he'});
  assert.equal(judgeFpsUtilityOutcome(heIntent, {enemyDamage: 12}).achieved, true, '12+ HE damage achieves purpose');
  assert.equal(judgeFpsUtilityOutcome(heIntent, {enemyDamage: 0, enemiesDisplaced: 1}).achieved, true, 'displacing an enemy with HE achieves purpose');
  assert.equal(judgeFpsUtilityOutcome(heIntent, {enemyDamage: 5, enemiesDisplaced: 0}).achieved, false);
});

test('closed-loop tacticalAchieved feedback in learnFpsThrowOutcome nudges stale telegraphed flashes and locks in working ones', () => {
  const brain = createFpsUtilityBrain();
  const from = {x: 19, z: -10}, target = {x: 19, z: -2}, height = 1.55 + fontessa.terrain.groundHeight(from);
  const plan = calculateLiveThrow('flash', from, target, height, fontessa, brain);
  const landing = {x: target.x + 0.6, y: fontessa.terrain.groundHeight(target) + 1.6, z: target.z};
  const floor = fontessa.terrain.groundHeight(target) + 0.09;

  learnFpsThrowOutcome(brain, {key: plan.key, plan, intended: target, landing, targetFloor: floor, sight: true, tacticalAchieved: false});
  assert.equal(brain.entries[plan.key].stale, 1);
  learnFpsThrowOutcome(brain, {key: plan.key, plan, intended: target, landing, targetFloor: floor, sight: true, tacticalAchieved: false});
  assert.equal(brain.entries[plan.key].stale, 2);

  const beforeFlight = brain.entries[plan.key].flight;
  const beforeAimDx = brain.entries[plan.key].aimDx;
  learnFpsThrowOutcome(brain, {key: plan.key, plan, intended: target, landing, targetFloor: floor, sight: true, tacticalAchieved: false});
  const afterStale = brain.entries[plan.key];
  assert.ok(afterStale.stale >= 3, 'stale counter reaches threshold');
  assert.ok(afterStale.flight !== beforeFlight || afterStale.aimDx !== beforeAimDx, 'nudge searches a new arc or aim offset instead of freezing');

  const nextPlan = calculateLiveThrow('flash', from, target, height, fontessa, brain);
  learnFpsThrowOutcome(brain, {key: nextPlan.key, plan: nextPlan, intended: target, landing, targetFloor: floor, sight: true, tacticalAchieved: true});
  const locked = brain.entries[plan.key];
  assert.equal(locked.stale, 0, 'tactical success resets stale counter');
  assert.ok(locked.lastError <= 1.2, 'tactical success locks in the working aim');
  assert.ok(loadFpsUtilityBrain(brain), 'updated brain passes strict schema validation');
});

test('calls include set-piece utility packages, A Long approaches throw smoke/utility before dry-peeking, and executes pair smoke + molly + flash', () => {
  const cards = Array.from({length: 10}, (_, i) => ({
    id: `setpiece-${i}`, name: `SetPiece ${i}`,
    stats: {rifling: 80, sniping: 80, entry: 80, utility: 90, positioning: 80, shotcalling: 80},
  }));
  const sim = new FpsLiveSimulation(cards.slice(0, 5), cards.slice(5), 5150, createFpsIdentityContext(cards.slice(0, 5), cards.slice(5)));
  const atkOrder = sim.informationOrders[sim.attackTeam];
  assert.ok(atkOrder.setPiece && atkOrder.utilityPlan?.length > 0, 'initial attack call carries a set-piece utility package');

  // Proactive A Long lane-take: attackers approaching A Long throw lane smoke / molly / flash without waiting to be shot
  const atk = sim.actors.filter(a => a.team === sim.attackTeam);
  const def = sim.actors.filter(a => a.team !== sim.attackTeam);
  Object.assign(sim, {phase: 'live', remaining: 95, time: 20, roundLiveAt: 10, liveElapsed: 10, site: 'A'});
  def.forEach(d => Object.assign(d, {hp: 0, nextSense: Infinity, nextThink: Infinity}));
  atk.forEach((a, i) => Object.assign(a, {
    hp: 100, x: -20 + (i - 2) * 1.2, z: -8, yaw: 0, smoke: 1, flash: 1, incendiary: 1, he: 1,
    bomb: i === 2, channel: 0, reload: 0, weaponReady: 0, utilityAt: 0, utilityPreparation: undefined,
    throwAt: undefined, goal: {x: -18, z: 9}, roundDuty: {duty: i === 0 ? 'entry' : i === 1 ? 'support' : 'trade', base: a.role, since: 10, reason: 'test'},
    intel: {contacts: []}, target: undefined,
  }));
  const laneSmokeResult = sim.useInformationUtility(atk[1], atk);
  assert.ok(laneSmokeResult && /smoke|Smoke|fire|flash/i.test(laneSmokeResult), `proactive A Long lane utility triggered: ${laneSmokeResult}`);

  // Execute set-piece combines smokes, molly/HE, and flashes when executing onto A site
  const execSim = new FpsLiveSimulation(cards.slice(0, 5), cards.slice(5), 6161, createFpsIdentityContext(cards.slice(0, 5), cards.slice(5)));
  const exAtk = execSim.actors.filter(a => a.team === execSim.attackTeam);
  const exCaller = exAtk[0];
  execSim.site = 'A';
  exAtk.forEach((a, i) => Object.assign(a, {
    hp: 100, x: -20, z: 4, yaw: 0, smoke: 1, flash: 1, incendiary: 1, he: 1,
    bomb: i === 4, channel: 0, reload: 0, weaponReady: 0, utilityAt: 0, utilityPreparation: undefined,
    roundDuty: {duty: i === 1 ? 'entry' : 'support', base: a.role, since: 0, reason: 'test'}, target: undefined,
  }));
  execSim.callFromInformation(exCaller, exAtk);
  const execOrder = execSim.informationOrders[execSim.attackTeam];
  assert.equal(execOrder.mode, 'execute');
  assert.ok(execOrder.setPiece?.includes('smokes + molly + pop-flashes'), `execute carries full set-piece label: ${execOrder.setPiece}`);
  assert.ok(execOrder.utilityPlan?.some(u => u.kind === 'smoke'), 'execute plan includes smokes');
  assert.ok(execOrder.utilityPlan?.some(u => u.kind === 'incendiary'), 'execute plan includes molotov');
  assert.ok(execOrder.utilityPlan?.some(u => u.kind === 'flash'), 'execute plan includes flashes');
});
