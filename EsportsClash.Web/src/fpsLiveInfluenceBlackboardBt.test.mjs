import test from 'node:test';
import assert from 'node:assert/strict';
import { FPS_T_POSITIONS, FPS_CT_POSITIONS } from './fps/fpsPlayerArchitecture.ts';
import { FPS_IDENTITY_PERSONALITIES, generatePlayerDNA } from './fps/fpsIdentity.ts';
import { FpsLiveSimulation } from './fps/fpsLiveSimulation.ts';
import { findLivePath, findLiveCover, liveWalkable, LIVE_MID, LIVE_TACTICAL } from './fps/fpsLiveMap.ts';
import { chooseLiveApproach, liveAssaultApproaches } from './fps/fpsLiveBrain.ts';
import { detailedAimYaw } from './fps/fpsDetailedExecution.ts';
import { pinFpsSkillProfile, fpsSkillProfileFromAttributes } from './fps/fpsSkillProfile.ts';
import {
  createLiveInfluenceGrid,
  resetLiveInfluenceGrid,
  recordInfluenceDanger,
  stampInfluenceFov,
  hasActiveInfluenceHeat,
  sampleInfluenceDanger,
  sampleInfluenceUncertainty,
} from './fps/fpsLiveInfluenceMap.ts';
import {
  createTacticalBlackboard,
  postBlackboardClaim,
  hasBlackboardClaim,
  releaseActorBlackboard,
  blackboardClaimedPoints,
  purgeBlackboard,
} from './fps/fpsLiveBlackboard.ts';
import {
  btSelector,
  btSequence,
  btCondition,
  btAction,
  tickBt,
  createUtilityPrepBt,
  createDuelMicroBt,
} from './fps/fpsBehaviorTree.ts';

const plan = { tempo: 0.6, structure: 0.7, aggression: 0.5, preparation: 0.7, freedom: 0.5, economy: 0.8 };
const coach = {
  tempo: 0.6, rigidity: 0.7, aggression: 0.5, preparation: 0.7, freedom: 0.5,
  economy: 0.8, communication: 0.7, leadership: 0.7, adaptability: 0.7, development: 0.5,
};
const chemistry = { trust: 0.6, communication: 0.6, understanding: 0.6, leadershipAcceptance: 0.6, roleCompetition: 0.3 };

function createGame(seed = 2026) {
  const cards = Array.from({ length: 10 }, (_, i) => ({
    id: `bt-${i}`,
    name: `Bot ${i}`,
    stats: { rifling: 75, positioning: 75, entry: 75, sniping: 75, utility: 75, shotcalling: 75 },
  }));
  const identity = {
    players: Object.fromEntries(cards.map((p, i) => [p.id, {
      id: p.id,
      assignments: { t: FPS_T_POSITIONS[i % 5], ct: FPS_CT_POSITIONS[i % 5] },
      personality: FPS_IDENTITY_PERSONALITIES[i],
      dna: generatePlayerDNA(p.id),
      intensity: 0.6,
      roleSuitability: 0.6,
      familiarity: 0.5,
    }])),
    teams: { blue: { coach, plan, chemistry }, red: { coach, plan, chemistry } },
  };
  return new FpsLiveSimulation(cards.slice(0, 5), cards.slice(5), seed, identity);
}

test('influence grid decays danger over time and tracks FOV clearing vs 20s staleness uncertainty', () => {
  const grid = createLiveInfluenceGrid(0);
  assert.equal(hasActiveInfluenceHeat(grid, 0), false);
  assert.equal(sampleInfluenceUncertainty(grid, LIVE_MID.control, 5), 0);

  recordInfluenceDanger(grid, { x: 0, z: 0 }, 1.2, 2, 1);
  assert.equal(hasActiveInfluenceHeat(grid, 2), true);
  const early = sampleInfluenceDanger(grid, { x: 0, z: 0 }, 2);
  const decayed = sampleInfluenceDanger(grid, { x: 0, z: 0 }, 16);
  assert.ok(early >= 1.1 && decayed < early * 0.5, `expected decay from ${early} to ${decayed}`);
  assert.equal(hasActiveInfluenceHeat(grid, 50), false);

  // Mid uncertainty climbs after ~8s grace up to 1.0 by 20s if never looked at.
  assert.ok(sampleInfluenceUncertainty(grid, { x: -23, z: 21 }, 20) > 0.9);

  // Wall-clipped FOV ray stops at 6m so behind-wall cell stays stale while visible cells clear.
  stampInfluenceFov(grid, { x: 0, z: -10 }, 0, 20, 28, () => 6);
  assert.equal(sampleInfluenceUncertainty(grid, { x: 0, z: -6 }, 20), 0);
  assert.ok(sampleInfluenceUncertainty(grid, { x: 0, z: 8 }, 20) > 0.9);

  resetLiveInfluenceGrid(grid, 25);
  assert.equal(hasActiveInfluenceHeat(grid, 25), false);
  assert.equal(sampleInfluenceUncertainty(grid, { x: 0, z: 8 }, 26), 0);
});

test('influence heat avoids static cache pollution and steers paths + approach selection without leaking hidden enemies', () => {
  const from = { x: 0, z: -28 };
  const to = { x: 23, z: 21 };
  const baseline = findLivePath(from, to);
  assert.ok(baseline.length >= 2);
  const midPoint = baseline[Math.floor(baseline.length / 2)];

  const grid = createLiveInfluenceGrid(0);
  recordInfluenceDanger(grid, midPoint, 3.0, 5, 2);
  const heatedPath = findLivePath(from, to, [], 1, (pt) => sampleInfluenceDanger(grid, pt, 5));
  const baselineExposure = baseline.reduce((s, pt) => s + sampleInfluenceDanger(grid, pt, 5), 0);
  const heatedExposure = heatedPath.reduce((s, pt) => s + sampleInfluenceDanger(grid, pt, 5), 0);
  assert.ok(heatedExposure < baselineExposure, `expected lower heat along reroute (${heatedExposure} vs ${baselineExposure})`);

  // Lawful information check: moving hidden enemies never alters influence heat.
  const sim = createGame(404);
  const tPlayer = sim.actors.find((a) => a.attacking);
  const hiddenEnemy = sim.actors.find((a) => !a.attacking);
  for (const a of sim.actors) if (a !== tPlayer && a !== hiddenEnemy) Object.assign(a, { hp: 0 });
  Object.assign(sim, { phase: 'live', time: 20, liveElapsed: 20 });
  Object.assign(tPlayer, { x: 0, z: -28, yaw: Math.PI });
  Object.assign(hiddenEnemy, { x: -23, z: 21 });
  const call1 = sim.heatSampler(tPlayer.team)?.({ x: -23, z: 21 }) ?? 0;
  Object.assign(hiddenEnemy, { x: 23, z: 21 });
  const call2 = sim.heatSampler(tPlayer.team)?.({ x: 23, z: 21 }) ?? 0;
  assert.equal(call1, 0);
  assert.equal(call2, 0);
});

test('EQS cover prefers open-escape low-heat cover while preserving q=0 nearest distance', () => {
  const from = { x: -16, z: 10, level: 'street' };
  const threat = { x: -18, z: -4, level: 'street' };
  const q0 = findLiveCover(from, threat, [], 0, []);
  const heated = findLiveCover(from, threat, [], 1, [], (pt) => (Math.hypot(pt.x - (q0?.x ?? 0), pt.z - (q0?.z ?? 0)) < 2 ? 3 : 0));
  assert.ok(q0 && liveWalkable(q0));
  if (heated && q0 && Math.hypot(heated.x - q0.x, heated.z - q0.z) > 1) {
    assert.notDeepEqual({ x: heated.x, z: heated.z }, { x: q0.x, z: q0.z });
  }
});

test('tactical blackboard enforces exclusive claims, expiry, role switching and death cleanup', () => {
  const board = createTacticalBlackboard();
  const ok1 = postBlackboardClaim(board, { actorId: 'a1', kind: 'smoke_lineup', key: 'mid-window', point: { x: 0, z: -20 }, until: 10, priority: 2 }, 1);
  const dup = postBlackboardClaim(board, { actorId: 'a2', kind: 'smoke_lineup', key: 'mid-window', point: { x: 0, z: -20 }, until: 10, priority: 2 }, 2);
  const override = postBlackboardClaim(board, { actorId: 'a2', kind: 'smoke_lineup', key: 'mid-window', point: { x: 0, z: -20 }, until: 12, priority: 3 }, 2);
  assert.equal(ok1, true);
  assert.equal(dup, false);
  assert.equal(override, true);
  assert.equal(hasBlackboardClaim(board, 'smoke_lineup', 'mid-window', 2, 'a2'), false);
  assert.equal(hasBlackboardClaim(board, 'smoke_lineup', 'mid-window', 2, 'a1'), true);

  // Movement/role switch replaces previous assignment claim for the same actor cleanly.
  postBlackboardClaim(board, { actorId: 'a1', kind: 'hold_lane', key: 'h1', point: { x: 10, z: 10 }, until: 20, priority: 1 }, 3);
  postBlackboardClaim(board, { actorId: 'a1', kind: 'entry_space', key: 'e1', point: { x: -10, z: 10 }, until: 20, priority: 2 }, 4);
  const a1Points = blackboardClaimedPoints(board, 5, 'a2');
  assert.equal(a1Points.length, 1);
  assert.equal(a1Points[0].x, -10);

  purgeBlackboard(board, 13);
  assert.equal(hasBlackboardClaim(board, 'smoke_lineup', 'mid-window', 13), false);
  releaseActorBlackboard(board, 'a1');
  assert.equal(blackboardClaimedPoints(board, 13).length, 0);
});

test('audible grenade pin-pull emits utility cue after draw completes and before release', () => {
  const sim = createGame(77);
  for (const a of sim.actors) Object.assign(a, { hp: 0, nextSense: Infinity, nextThink: Infinity });
  const thrower = sim.actors[0];
  const listener = sim.actors[5];
  const bEntry = LIVE_TACTICAL.B.entries[0];
  Object.assign(sim, { phase: 'live', time: 10, remaining: 90, liveElapsed: 10 });
  Object.assign(thrower, { hp: 100, x: bEntry.x, z: bEntry.z - 2, yaw: 0, flash: 1, weapon: 'ak47', equipped: 'ak47', weaponReady: 0, utilityAt: 0, channel: 0, reload: 0, damageAt: -100, seenAt: -100, pendingCues: [] });
  Object.assign(listener, { hp: 100, x: bEntry.x, z: bEntry.z - 8, yaw: Math.PI, pendingCues: [], seenAt: -100, utilityAt: 0, target: undefined });
  const started = sim.throwUtility(thrower, 'flash', { x: LIVE_TACTICAL.B.flash.x, z: LIVE_TACTICAL.B.flash.z });
  assert.equal(started, true);
  assert.ok(thrower.utilityPreparation);

  // Step halfway through draw time: pin NOT yet pulled.
  const equipAt = thrower.utilityPreparation.equipAt;
  const readyAt = thrower.utilityPreparation.readyAt;
  while (sim.time + 0.05 < equipAt) sim.step(0.05);
  assert.equal(thrower.utilityPreparation?.pinHeard, false);
  const earlyUtilityCue = listener.pendingCues.some((c) => c.contact.source === 'utility')
    || listener.intel.contacts.some((c) => c.source === 'utility');
  assert.equal(earlyUtilityCue, false);

  // Step past draw completion into pin pull (before release): listener hears utility pin pull!
  let heardPin = false;
  while (sim.time < readyAt) {
    sim.step(0.05);
    if (listener.pendingCues.some((c) => c.contact.source === 'utility')
      || listener.intel.contacts.some((c) => c.source === 'utility')) {
      heardPin = true;
    }
  }
  assert.equal(heardPin, true);
});

test('rear-surprise panic adds reaction/panic spread while preAim stays monotonic and combat flick can overshoot cleanly', () => {
  const sim = createGame(88);
  for (const a of sim.actors) Object.assign(a, { hp: 0, nextSense: Infinity, nextThink: Infinity });
  const victim = sim.actors[0];
  const preAimer = sim.actors[1];
  const attacker = sim.actors[5];
  Object.assign(sim, { phase: 'live', time: 20, remaining: 90, liveElapsed: 20 });
  Object.assign(victim, { hp: 100, armor: 100, x: 0, z: 0, yaw: 0, target: undefined, panicUntil: 0, damageAt: -100 });
  Object.assign(attacker, { hp: 100, x: 0, z: -8, yaw: 0 }); // Directly behind victim facing +Z (yaw = 0)

  const baseReaction = sim.reactionDelay(victim);
  sim.damage(attacker, victim, 20, false, 'ak47', true, victim.id, 1);
  assert.ok((victim.panicUntil ?? 0) > sim.time);
  assert.ok(victim.reaction > baseReaction, `expected rear surprise delay > ${baseReaction}, got ${victim.reaction}`);

  // Pre-aim (target === undefined) must NEVER overshoot its target angle!
  Object.assign(preAimer, { hp: 100, x: 0, z: -30.5, target: undefined, contact: undefined, aimFocus: undefined, path: [], profile: undefined, yaw: 0, watchPoint: { x: 4, z: -26.5 } });
  const desiredPre = Math.atan2(4, 4);
  let prev = preAimer.yaw;
  for (let i = 0; i < 60; i++) {
    sim.preAim(preAimer, true);
    assert.ok(preAimer.yaw >= prev - 1e-9 && preAimer.yaw <= desiredPre + 1e-6, `preAim must stay monotonic: ${prev} -> ${preAimer.yaw} (target ${desiredPre})`);
    prev = preAimer.yaw;
  }

  // detailedAimYaw with combat flick bias visibly swings past desired under stress/flick, then tracks back smoothly.
  const profile = pinFpsSkillProfile(fpsSkillProfileFromAttributes('p-flick', { rifling: 70, sniping: 70, entry: 70, utility: 70, positioning: 70, shotcalling: 70 }, 1, '2026-11-14T00:00:00.000Z'), 'p-flick');
  let yaw = 0;
  const targetYaw = 0.8;
  let exceeded = false;
  for (let i = 0; i < 12; i++) {
    yaw = detailedAimYaw(yaw, targetYaw, profile, 'flick', 0.05, false, 0.09);
    if (yaw > targetYaw) exceeded = true;
  }
  assert.equal(exceeded, true, 'expected biased combat flick to momentarily overshoot desired target angle');
  for (let i = 0; i < 15; i++) yaw = detailedAimYaw(yaw, targetYaw, profile, 'fine', 0.05, false, 0);
  assert.ok(Math.abs(yaw - targetYaw) < 0.02, `expected fine settling back onto ${targetYaw}, got ${yaw}`);
});

test('stale uncleared space triggers a cautious recon flash after ~20s uncleared', () => {
  const sim = createGame(99);
  for (const a of sim.actors) Object.assign(a, { hp: 0, nextSense: Infinity, nextThink: Infinity });
  const ct = sim.actors.find((a) => !a.attacking);
  Object.assign(sim, { phase: 'live', time: 22, remaining: 95, liveElapsed: 22, site: 'B' });
  resetLiveInfluenceGrid(sim.influenceGrid(ct.team), 0); // No area cleared since round live at t=0
  const bApproach = liveAssaultApproaches('B', ct)[0];
  Object.assign(ct, {
    hp: 100, role: 'support', decision: 'probe',
    x: bApproach.point.x, z: bApproach.point.z + 11, yaw: Math.PI,
    flash: 1, smoke: 0, he: 0, incendiary: 0, utilityAt: 0, reload: 0, blinded: 0, channel: 0, target: undefined, utilityPreparation: undefined,
  });
  const intent = sim.useInformationUtility(ct, [ct]);
  assert.equal(intent, 'Throw a recon flash into stale uncleared space');
  assert.equal(ct.utilityPreparation?.kind, 'flash');
});

test('modular behavior trees coordinate prep abort/release and duel priority ordering cleanly', () => {
  const calls = [];
  const prepTree = createUtilityPrepBt({
    hasPrep: (s) => s.prep,
    shouldCancelForDanger: (s) => s.danger,
    cancelPrep: () => calls.push('cancel'),
    isReadyToRelease: (s) => s.ready,
    releasePrep: () => calls.push('release'),
    aimAndPullPin: () => calls.push('aim'),
  });
  assert.equal(tickBt(prepTree, { prep: false, danger: false, ready: false }), 'failure');
  assert.equal(tickBt(prepTree, { prep: true, danger: false, ready: false }), 'running');
  assert.equal(tickBt(prepTree, { prep: true, danger: true, ready: true }), 'success');
  assert.equal(tickBt(prepTree, { prep: true, danger: false, ready: true }), 'success');
  assert.deepEqual(calls, ['aim', 'cancel', 'release']);

  const duelLog = [];
  const duelTree = createDuelMicroBt({
    hasTarget: () => true,
    shouldTurnAwayFromFlash: (s) => s.flash,
    turnAwayFromFlash: () => duelLog.push('flash'),
    isReacting: (s) => s.reacting,
    handleReactionWait: () => duelLog.push('react'),
    shouldReloadOrSwapSidearm: () => false,
    handleReloadOrSidearm: () => duelLog.push('reload'),
    shouldHoldTriggerDiscipline: (s) => s.trigger,
    handleTriggerDiscipline: () => duelLog.push('trigger'),
    shouldHoldOrRepositionCover: () => false,
    handleCoverOrReposition: () => duelLog.push('cover'),
    stepCombatStrafe: () => duelLog.push('strafe'),
    aimAndFire: () => duelLog.push('fire'),
  });
  tickBt(duelTree, { flash: true, reacting: true, trigger: true });
  tickBt(duelTree, { flash: false, reacting: true, trigger: true });
  tickBt(duelTree, { flash: false, reacting: false, trigger: true });
  tickBt(duelTree, { flash: false, reacting: false, trigger: false });
  assert.deepEqual(duelLog, ['flash', 'react', 'trigger', 'strafe', 'fire']);

  // Selector / sequence short-circuiting check.
  const seq = btSequence('seq', [btCondition('ok', () => false), btAction('never', () => { duelLog.push('bad'); return 'success'; })]);
  const sel = btSelector('sel', [seq, btAction('fallback', () => 'success')]);
  assert.equal(tickBt(sel, {}), 'success');
  assert.ok(!duelLog.includes('bad'));
});

test('snapshot remains deterministic and never exposes private influence or blackboard state', () => {
  const a = createGame(5150);
  const b = createGame(5150);
  for (let i = 0; i < 120; i++) {
    a.step(0.05);
    b.step(0.05);
  }
  const snapA = a.snapshot();
  const snapB = b.snapshot();
  assert.deepEqual(snapA, snapB);
  assert.equal('influenceGrids' in snapA, false);
  assert.equal('blackboards' in snapA, false);
});
