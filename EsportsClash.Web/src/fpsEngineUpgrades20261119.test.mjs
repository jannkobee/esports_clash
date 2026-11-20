import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { LIVE_WEAPONS } from './fps/fpsLiveWeapons.ts';
import { buyLiveTeam } from './fps/fpsLiveEconomy.ts';
import { createEnemyEconomyTracker, updateEnemyEconomyAfterRound, observeEnemyWeapon } from './fps/fpsLiveEconomyRead.ts';
import { liveTacticWeights, LIVE_TACTIC_CHOICES } from './fps/fpsLiveTactics.ts';
import { buildMapControlZones, composeFreeDefenseTerritory, createTeamTerritoryState, evaluateEmptySpaceExpansion, refreshTeamTerritoryZones } from './fps/fpsLiveTerritory.ts';
import { createLiveInfluenceGrid, resetLiveInfluenceGrid } from './fps/fpsLiveInfluenceMap.ts';
import { LIVE_SEED_DEFENSE_PLAYS } from './fps/fpsLivePlays.ts';
import { createTeamTimingState, evaluateAudioPunishWindow, recordTeamChaos, shouldReleaseFlankTiming } from './fps/fpsLiveTiming.ts';
import { liveSmokeDepth } from './fps/fpsLiveBrain.ts';
import { getLiveMapRuntime } from './fps/fpsLiveMapRegistry.ts';
import { classifyFpsUtilityThrow, judgeFpsUtilityOutcome } from './fps/fpsUtilityPurpose.ts';
import { FpsLiveSimulation } from './fps/fpsLiveSimulation.ts';
import { simulateOfficialLiveMatch } from './fps/fpsOfficialLiveMatch.ts';
import { FpsLiveReplayRecorder, FpsLiveReplaySource, FPS_REPLAY_FRAMES_PER_CHUNK, FPS_REPLAY_STEPS_PER_FRAME } from './fps/fpsLiveReplay.ts';
import { createFpsTeamPlaybook } from './fps/fpsLivePlaybook.ts';
import { FPS_T_POSITIONS, FPS_CT_POSITIONS } from './fps/fpsPlayerArchitecture.ts';
import { FPS_IDENTITY_PERSONALITIES, generatePlayerDNA } from './fps/fpsIdentity.ts';
import { generateFpsSkillProfile } from './fps/fpsSkillProfile.ts';

const plan = { tempo: .6, structure: .7, aggression: .5, preparation: .7, freedom: .5, economy: .8 };
const coach = { ...plan, rigidity: .7, communication: .7, leadership: .7, adaptability: .7, development: .5 };
const chemistry = { trust: .6, communication: .6, understanding: .6, leadershipAcceptance: .6, roleCompetition: .3 };

function makeMatch(seed = 77) {
  const cards = Array.from({ length: 10 }, (_, i) => ({
    id: `upg-${seed}-${i}`, name: `Op ${i}`,
    stats: { rifling: 70, sniping: 70, entry: 70, utility: 70, positioning: 70, shotcalling: 70 },
  }));
  const identity = {
    players: Object.fromEntries(cards.map((p, i) => [p.id, {
      id: p.id,
      assignments: { t: FPS_T_POSITIONS[i % 5], ct: FPS_CT_POSITIONS[i % 5] },
      personality: FPS_IDENTITY_PERSONALITIES[(i + seed) % FPS_IDENTITY_PERSONALITIES.length],
      dna: generatePlayerDNA(p.id),
      intensity: .6, roleSuitability: .6, familiarity: .5,
    }])),
    teams: { blue: { coach, plan, chemistry }, red: { coach, plan, chemistry } },
  };
  const profiles = Object.fromEntries(cards.map(p => [p.id, generateFpsSkillProfile(p.id, seed, '2026-11-19T00:00:00.000Z')]));
  return { blue: cards.slice(0, 5), red: cards.slice(5), identity, profiles };
}

test('Track 1: nearestNode never spirals map-wide on wedged Spillway point and liveSmokeDepth fast-rejects distant rays', () => {
  const spillway = getLiveMapRuntime('spillway');
  const start = performance.now();
  const len = spillway.pathLength({ x: 31.6, z: 31.21 }, { x: -15, z: 31 });
  const elapsedMs = performance.now() - start;
  assert.ok(elapsedMs < 25, `Single wedged pathLength must not spiral map-wide (took ${elapsedMs.toFixed(1)} ms, len=${len})`);

  const smoke = { id: 42, x: 0, y: 1.4, z: 0, radius: 4.8, startedAt: 10, expires: 28 };
  assert.equal(liveSmokeDepth({ x: 30, z: 30 }, { x: 40, z: 30 }, 1.6, 1.6, smoke, 15), 0);
  assert.ok(liveSmokeDepth({ x: -8, z: 0 }, { x: 8, z: 0 }, 1.6, 1.6, smoke, 15) > 0.48);
});

test('Track 2: M4A1-S kills armored opponent in 1 HS + 1 body without 1-tapping, and CT eco funds next-round full buy', () => {
  const m4 = LIVE_WEAPONS.m4a1_s;
  const hsArmor = m4.damage * m4.headshotMultiplier * (m4.armorScale ?? 1);
  const bodyArmor = m4.damage * (m4.armorScale ?? 1);
  assert.ok(hsArmor < 100 && hsArmor >= 80, `M4A1-S armored HS must stay <100 and >=80, got ${hsArmor.toFixed(2)}`);
  assert.ok(hsArmor + bodyArmor >= 100, `M4A1-S 1 HS + 1 body must kill armored opponent, got ${(hsArmor + bodyArmor).toFixed(2)}`);
  assert.ok(m4.cost <= 2950);

  // Low-bank CT team ($1,600) or consecutive-loss CT team ($1,900, lossStreak=2) ecos cleanly instead of forcing, then full-buys next round.
  const lowCT = ['entry', 'trade', 'anchor', 'support', 'caller'].map((role, i) => ({
    id: `ct-low-${i}`, role, cash: 1600, weapon: 'usp_s', sidearm: 'usp_s', armor: 0, kit: false,
    flash: 0, smoke: 0, incendiary: 0, he: 0, attacking: false,
  }));
  const aggressivePlan = { ...plan, economy: 0.35 };
  assert.equal(buyLiveTeam(lowCT, aggressivePlan, 2, 1, false).mode, 'eco', 'Low-bank CT team ($1,600/player) must eco instead of forcing');
  const chainedLossCT = lowCT.map(p => ({ ...p, cash: 1900 }));
  const ecoRound = buyLiveTeam(chainedLossCT, aggressivePlan, 3, 2, false);
  assert.equal(ecoRound.mode, 'eco', 'Consecutive-loss CT team must eco cleanly instead of chaining force buys');
  const nextRound = ecoRound.players.map(p => ({ ...p, cash: p.cash + 2900 }));
  const fullRound = buyLiveTeam(nextRound, aggressivePlan, 4, 3, false);
  assert.equal(fullRound.mode, 'full', 'One clean CT eco + loss bonus must fund a full M4 buy');
});

test('Track 2: updateBombEscape fires at distant visible enemies when holding outside blast, and defuse does not ping enemy sonar every second', () => {
  const { blue, red, identity } = makeMatch(19);
  const sim = new FpsLiveSimulation(blue, red, 19, identity, { mapId: 'fontessa' });
  Object.assign(sim, { phase: 'live', remaining: 40, time: 30, roundLiveAt: 10, attackTeam: 'red' });
  for (const a of sim.actors) Object.assign(a, { hp: 0, nextSense: Infinity, nextThink: Infinity, nextShot: Infinity });
  sim.bomb = { status: 'planted', site: 'B', x: 23, z: 21, remaining: 5 };

  const holder = sim.actors[5];
  const enemy = sim.actors[0];
  // Holder is clear outside blast (A Main, >40m from B bomb) and sees an enemy 14m straight ahead in open A Main (previously ignored due to `< 10`).
  Object.assign(holder, {
    hp: 100, attacking: true, x: -19, z: -12, yaw: 0, pitch: 0, speed: 0, vx: 0, vz: 0, jump: false, jumpY: 0,
    weapon: 'ak47', equipped: 'ak47', ammo: 30, reserve: 90, weaponReady: 0, reload: 0, blinded: 0,
    bombEscape: { point: { x: -19, z: -12 } }, target: enemy.id, aimPoint: { x: -19, z: 2 },
    acquired: sim.time - 1, reaction: 0.1, nextShot: sim.time, nextSense: Infinity, nextThink: Infinity,
  });
  Object.assign(enemy, {
    hp: 100, attacking: false, x: -19, z: 2, yaw: Math.PI, pitch: 0, speed: 0, vx: 0, vz: 0, jump: false, jumpY: 0,
    nextSense: Infinity, nextThink: Infinity, nextShot: Infinity,
  });
  for (let i = 0; i < 30 && holder.ammo === 30; i++) sim.step();
  assert.ok(holder.ammo < 30, 'Player holding safely outside bomb blast must shoot visible enemies beyond 10 m');

  // Authentic defuse audio: initial tap sets heardDefuseAt once; continuing past 1.0s does NOT refresh enemy heardDefuseAt.
  const sim2 = new FpsLiveSimulation(blue, red, 20, identity, { mapId: 'fontessa' });
  Object.assign(sim2, { phase: 'live', remaining: 90, time: 30, roundLiveAt: 10, attackTeam: 'red' });
  for (const a of sim2.actors) Object.assign(a, { hp: 0, nextSense: Infinity, nextThink: Infinity, nextShot: Infinity });
  sim2.bomb = { status: 'planted', site: 'B', x: 20, z: 24, remaining: 20 };
  const defuser = sim2.actors[0];
  const listener = sim2.actors[5];
  Object.assign(defuser, {
    hp: 100, attacking: false, kit: false, x: 20.1, z: 24, yaw: Math.PI, speed: 0, vx: 0, vz: 0, jump: false, jumpY: 0,
    weapon: 'm4a1_s', equipped: 'm4a1_s', smoke: 0, channel: 0, fakeDefuseDone: true, nextSense: Infinity, nextThink: Infinity,
  });
  Object.assign(listener, {
    hp: 100, attacking: true, x: 26, z: 24, yaw: -Math.PI / 2, speed: 0, vx: 0, vz: 0, jump: false, jumpY: 0,
    weapon: 'ak47', equipped: 'ak47', nextSense: Infinity, nextThink: Infinity, nextShot: Infinity,
  });
  sim2.step();
  const initialHeardAt = listener.heardDefuseAt;
  assert.ok(initialHeardAt !== undefined, 'Initial defuse tap must alert nearby Ts');
  for (let i = 0; i < 40; i++) sim2.step();
  assert.equal(listener.heardDefuseAt, initialHeardAt, 'Continuing a defuse past 1s must not re-broadcast enemy sonar pings');
});

test('Track 3: judgeFpsUtilityOutcome honestly requires blind/turn-away on EXECUTE_SUPPORT flashes (no soft landingError pass)', () => {
  const intent = classifyFpsUtilityThrow({
    kind: 'flash', attacking: true, phase: 'execute', enemyAtTarget: true, sniperAtTarget: false,
    lowHpEnemyAtTarget: false, teammateEngaging: true, retreating: false, fireAtTarget: false,
    enemySmokeAtTarget: false, bombNearTarget: false, opponentOnObjective: false, ownTeamOnObjective: false,
  });
  assert.equal(intent.primary, 'EXECUTE_SUPPORT');
  assert.equal(
    judgeFpsUtilityOutcome(intent, { enemiesBlinded: 0, enemiesTurnedAway: 0, alliesBlinded: 0, landingError: 0.5 }).achieved,
    false,
    'EXECUTE_SUPPORT flash with 0 enemies blinded and 0 turned away must NOT pass merely on landingError',
  );
  assert.equal(
    judgeFpsUtilityOutcome(intent, { enemiesBlinded: 0, enemiesTurnedAway: 1, alliesBlinded: 0, landingError: 0.5 }).achieved,
    true,
  );
});

test('Track 4: all 48 IGL tendencies are wired and official v5 reports populate real cash totals, roundStartSeconds & frozen club playbooks', () => {
  const schema = JSON.parse(readFileSync(resolve('src/fps/fps-player-tendencies-v4.json'), 'utf8'));
  const simCode = [
    readFileSync(resolve('src/fps/fpsLiveSimulation.ts'), 'utf8'),
    readFileSync(resolve('src/fps/fpsLiveTactics.ts'), 'utf8'),
    readFileSync(resolve('src/fps/fpsLiveEconomy.ts'), 'utf8'),
    readFileSync(resolve('src/fps/fpsRoundResponsibilities.ts'), 'utf8'),
  ].join('\n');
  const iglKeys = schema.iglCategories.flatMap(c => c.tendencies.map(t => t.key));
  assert.equal(iglKeys.length, 48);
  const missing = iglKeys.filter(k => !new RegExp(`\\b${k}\\b`).test(simCode));
  assert.deepEqual(missing, [], `All 48 IGL tendencies must be wired; missing: ${missing.join(', ')}`);

  const { blue, red, identity } = makeMatch(41);
  const blueBook = createFpsTeamPlaybook('fontessa');
  const before = structuredClone(blueBook);
  const r1 = simulateOfficialLiveMatch(blue, red, 41, 'fontessa', identity, {
    teamLearning: { blue: { playbook: blueBook, opponentId: 'club:999' } },
  });
  assert.deepEqual(blueBook, before, 'Official v5 match must never mutate pinned club playbooks');
  assert.equal(r1.roundStartSeconds.length, r1.totalRounds);
  assert.ok(r1.roundResults.some(r => r.blueCashTotal > 0 || r.redCashTotal > 0), 'v5 round results must report real non-zero cash totals');
  assert.ok(r1.roundResults.some(r => r.setPieceExecuted), 'v5 round results must record actual set-piece executes');
  assert.equal(r1.playbookExperience?.blue?.rounds.length, r1.totalRounds, 'v5 report must emit lawful per-round playbook experience');
});

test('Track 5: FpsLiveReplaySource.seek() and seekToRound() reload evicted chunks cleanly and honor live-edge ceiling', async () => {
  const { blue, red, identity } = makeMatch(52);
  const sim = new FpsLiveSimulation(blue, red, 52, identity, { mapId: 'fontessa' });
  const chunks = [];
  const recorder = new FpsLiveReplayRecorder(c => chunks.push(structuredClone(c)));
  // Record > 3 full chunks (~950 steps = >310 frames = 4 chunks so chunk 0 gets evicted when advancing to chunk 3).
  for (let i = 0; i < FPS_REPLAY_FRAMES_PER_CHUNK * FPS_REPLAY_STEPS_PER_FRAME * 3 + 30; i++) {
    sim.step();
    recorder.tick(() => sim.snapshot(), sim.drainAudioCues());
  }
  const totals = recorder.finish(sim.snapshot());
  assert.ok(chunks.length >= 4, `Expected at least 4 chunks, got ${chunks.length}`);
  let chunk0Fetches = 0;
  const loader = async idx => {
    if (idx === 0) chunk0Fetches++;
    return structuredClone(chunks[idx]);
  };
  const liveHeader = {
    version: 1, mapId: 'fontessa', seed: 52, frameSeconds: FPS_REPLAY_STEPS_PER_FRAME / 30,
    framesPerChunk: FPS_REPLAY_FRAMES_PER_CHUNK, frames: totals.frames, chunks: totals.chunks,
    broadcastSeconds: totals.frames * FPS_REPLAY_STEPS_PER_FRAME / 30,
    roundStartSeconds: [15, 25], complete: false, liveSeconds: 20,
    players: sim.snapshot().players.map(p => ({ id: p.id, name: p.name, team: p.team })),
  };
  const source = new FpsLiveReplaySource(liveHeader, loader, 0);
  await source.ready();
  // Live-edge guard: round 2 at 25s is beyond liveSeconds=20s so seekToRound(2) must refuse.
  assert.equal(await source.seekToRound(2), false, 'Live replay must not seek past aired liveSeconds');
  assert.equal(await source.seekToRound(1), true, 'Aired round 1 at 15s must seek cleanly');
  assert.ok(Math.abs(source.seconds - 15) < 0.25);

  // Switch to completed replay: jump to chunk 3 (evicting chunk 0), then seek BACK to 0s and confirm chunk 0 reloads!
  source.updateHeader({ ...liveHeader, complete: true, liveSeconds: null });
  const jumped = await source.seek(30.5);
  assert.equal(jumped, true);
  assert.ok(source.seconds >= 30);
  const fetchedBeforeBackSeek = chunk0Fetches;
  const soughtBack = await source.seek(0);
  assert.equal(soughtBack, true, 'Seeking backwards to an evicted chunk must re-fetch and succeed');
  assert.ok(chunk0Fetches > fetchedBeforeBackSeek, 'Evicted chunk 0 must be re-requested cleanly on backwards seek');
  assert.equal(source.snapshot().round, 1);

  // Playback speed multiplier (2x) advances 2 ticks per step.
  source.playbackRate = 2;
  const beforeSec = source.seconds;
  source.step();
  assert.ok(Math.abs(source.seconds - beforeSec - (2 / 30)) < 1e-6);
});

test('Spillway zero-distance level-connector recovery never produces NaN coordinates or throws in terrain patchesAt', () => {
  const { blue, red, identity } = makeMatch(63);
  const sim = new FpsLiveSimulation(blue, red, 63, identity, { mapId: 'spillway' });
  while (sim.snapshot().phase === 'freeze') sim.step();
  const actor = sim.actors[0];
  actor.x = 18; actor.z = 42; actor.level = undefined;
  actor.jumpY = sim.map.terrain.groundHeight({ x: 18, z: 42 });
  actor.goal = { x: 30.08, z: 31.2 };
  actor.path = [{ x: 18, z: 42, level: 'upper' }, { x: 20, z: 40, level: 'upper' }];
  actor.stuckFor = 1.0;
  for (let i = 0; i < 30; i++) sim.step();
  assert.ok(Number.isFinite(actor.x) && Number.isFinite(actor.z), `Actor coords must remain finite: (${actor.x}, ${actor.z})`);
  assert.ok(Number.isFinite(sim.map.terrain.groundHeight({ x: Number.NaN, z: Number.NaN })), 'NaN-guarded patchesAt must not throw');
});

test('Track 6: lawful enemy economy read detects broke_eco/stackLikely after lost pistol and adjusts T tactic weights', () => {
  const tracker = createEnemyEconomyTracker(1);
  const r2 = updateEnemyEconomyAfterRound(tracker, {
    opponentWon: false, opponentAttacked: false, opponentDefendingNext: true,
    bombPlanted: false, reason: 'Defenders eliminated', survivingEnemyCount: 0,
    survivingObservedHints: [], nextRound: 2, ownAvgCash: 3800,
  });
  assert.equal(r2.tier, 'broke_eco');
  assert.equal(r2.stackLikely, true);
  assert.equal(r2.antiEcoWindow, true);
  const normalW = liveTacticWeights([], 'red', false, plan);
  const antiStackW = liveTacticWeights([], 'red', false, plan, undefined, undefined, r2);
  const rushIdx = LIVE_TACTIC_CHOICES.indexOf('rush_a');
  const defIdx = LIVE_TACTIC_CHOICES.indexOf('default_pick');
  assert.ok(antiStackW[rushIdx] < normalW[rushIdx], 'Against likely CT eco stack, blind rushes should be discounted');
  assert.ok(antiStackW[defIdx] > normalW[defIdx], 'Against likely CT eco stack, defaults should be boosted');
  const liveRead = observeEnemyWeapon(tracker, 'enemy:ct-1', 'sniper', true, 5, 4200);
  assert.equal(liveRead.liveOverride, 'confirmed_awp');
  assert.equal(liveRead.awpLikely, true);
});

test('Track 7: buildMapControlZones spans T half on both maps, zones never fake-clear at round start, and expansion never duplicates a lane', () => {
  for (const mapId of ['fontessa', 'spillway']) {
    const rt = getLiveMapRuntime(mapId);
    const zones = buildMapControlZones(rt);
    const midZ = (rt.definition.spawns.attackers.z + rt.definition.spawns.defenders.z) * 0.5;
    assert.ok(zones.A_DEEP.anchor.z < midZ && zones.B_DEEP.anchor.z < midZ, `${mapId} A_DEEP/B_DEEP anchors must sit across mid on T half`);
    assert.ok(zones.A_DEEP.wrapTarget.z < midZ && zones.B_DEEP.wrapTarget.z < midZ, `${mapId} deep wrapTargets must reach across mid into T half`);
    const state = createTeamTerritoryState(10);
    // Regression guard: resetLiveInfluenceGrid stamps roundLiveAt everywhere — refreshTeamTerritoryZones must NOT fake-clear unvisited zones!
    const grid = createLiveInfluenceGrid(rt);
    resetLiveInfluenceGrid(grid, 10);
    const fakeCleared = refreshTeamTerritoryZones(state, zones, grid, [], [{ id: 'ct-0', x: rt.definition.spawns.defenders.x, z: rt.definition.spawns.defenders.z }], 10.6, 10);
    assert.deepEqual(fakeCleared, [], `${mapId} must not fake-clear unvisited zones right after resetLiveInfluenceGrid`);
    assert.equal(state.zones.A_FORWARD.status, 'unknown');
    assert.equal(state.zones.B_DEEP.status, 'unknown');

    const allies = FPS_CT_POSITIONS.map((position, i) => ({
      id: `ct-${i}`, slot: i, position, duty: i < 2 ? 'anchor' : i === 2 ? 'support' : 'entry',
      home: i === 0 ? 'A' : i === 1 ? 'B' : i === 2 ? 'A' : 'B', hp: 100, weaponCategory: 'rifle',
      forward: 0.75, aggression: 0.7, lurking: 0.6, x: 0, z: 35,
    }));
    const tasks = composeFreeDefenseTerritory({
      zones, state, allies, defensePlay: LIVE_SEED_DEFENSE_PLAYS.standard,
      enemyRead: createEnemyEconomyTracker(5).read, callerTendencies: { mapControlCalling: 85, informationDemand: 80, riskCalling: 75 },
      liveElapsed: 0, now: 15, roundSeed: 42,
    });
    assert.ok(tasks.length >= 1, `${mapId} free CT territory composer should assign proactive map-control tasks`);
    assert.ok(tasks.every(t => t.actorId !== 'ct-0' && t.actorId !== 'ct-1'), 'Site anchor guards must remain assigned to sites');

    // Regression guard: evaluateEmptySpaceExpansion must not send two solo CTs down the same quiet lane simultaneously.
    const expState = createTeamTerritoryState(10);
    const quietAssess = { A: { strength: 0, confirmed: 0, identified: 0, corroborated: false }, B: { strength: 1.2, confirmed: 2, identified: 2, corroborated: true }, Mid: { strength: 0, confirmed: 0, identified: 0, corroborated: false } };
    const first = evaluateEmptySpaceExpansion({
      zones, state: expState,
      actor: { id: 'ct-2', home: 'A', position: 'CT_ROTATOR', duty: 'support', hp: 100, weaponCategory: 'rifle', x: -20, z: 24, forward: 0.7, lurking: 0.6, initiative: 0.6 },
      allies: [{ id: 'ct-0', home: 'A', x: -22, z: 24 }, { id: 'ct-2', home: 'A', x: -20, z: 24 }, { id: 'ct-1', home: 'B', x: 22, z: 24 }],
      assessment: quietAssess, advantage: 0, liveElapsed: 16, remaining: 80, now: 26,
    });
    assert.ok(first && first.zoneId === 'A_FORWARD', `${mapId} first quiet-lane CT should advance to A_FORWARD`);
    const second = evaluateEmptySpaceExpansion({
      zones, state: expState,
      actor: { id: 'ct-0', home: 'A', position: 'CT_ANCHOR_A', duty: 'anchor', hp: 100, weaponCategory: 'rifle', x: -22, z: 24, forward: 0.7, lurking: 0.6, initiative: 0.6 },
      allies: [{ id: 'ct-0', home: 'A', x: -22, z: 24 }, { id: 'ct-2', home: 'A', x: -20, z: 24 }, { id: 'ct-1', home: 'B', x: 22, z: 24 }],
      assessment: quietAssess, advantage: 0, liveElapsed: 16, remaining: 80, now: 26,
    });
    assert.equal(second, undefined, `${mapId} must not duplicate solo empty-space expansion down an already-claimed lane`);
  }
});

test('Track 8 & 9: flank timing holds silent until fresh post-arm chaos, audio punish triggers on close reload, and unvisited chokes trigger creeping', () => {
  const timing = createTeamTimingState();
  recordTeamChaos(timing, 'A', 10); // stale chaos BEFORE arming
  const flank = { holdPoint: { x: 20, z: 0 }, targetPoint: { x: 20, z: 10 }, armedAt: 12, releaseUntil: 0, triggered: false, reason: 'test' };
  assert.equal(shouldReleaseFlankTiming(flank, timing, 'B', false, 60, 12.2), false, 'Must NOT insta-release on stale pre-arm chaos');
  recordTeamChaos(timing, 'A', 13.0); // fresh opposite-site distraction AFTER arming!
  assert.equal(shouldReleaseFlankTiming(flank, timing, 'B', false, 60, 13.2), true, 'Must release on fresh opposite-site chaos');

  const pw = evaluateAudioPunishWindow(
    { x: 0, z: 0, hp: 100, ammo: 20, reload: 0, blinded: 0, bomb: false, weaponCategory: 'rifle', opportunityBias: 0.6 },
    { key: 'sound:reload:0:0', observerId: 'a', source: 'reload', x: 8, z: 0, observed: 20, confidence: 0.5, uncertainty: 1.5 },
    20,
  );
  assert.ok(pw && pw.cue === 'reload' && pw.until > 21, 'Close-range enemy reload must open a timing punish window');
});
