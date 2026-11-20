import test from 'node:test';
import assert from 'node:assert/strict';
import {
  startLiveManualAim,
  stepLiveManualAim,
  liveAimTargetSize,
  liveAimZone,
  liveTriggerReady,
  applyLiveAimPunch,
} from './fps/fpsLiveGunplay.ts';
import {
  LIVE_CROUCH_SPEED,
  liveAccurateShotReady,
  liveShotSpeedLimit,
} from './fps/fpsLiveMovement.ts';
import { anticipateLiveContact } from './fps/fpsLiveAnticipation.ts';
import { liveC4Damage } from './fps/fpsLiveBomb.ts';
import { buildMapControlZones, composeFreeDefenseTerritory, createTeamTerritoryState } from './fps/fpsLiveTerritory.ts';
import { createEnemyEconomyTracker } from './fps/fpsLiveEconomyRead.ts';
import { LIVE_SEED_DEFENSE_PLAYS } from './fps/fpsLivePlays.ts';
import { getLiveMapRuntime } from './fps/fpsLiveMapRegistry.ts';
import { FpsLiveSimulation } from './fps/fpsLiveSimulation.ts';
import { FPS_T_POSITIONS, FPS_CT_POSITIONS } from './fps/fpsPlayerArchitecture.ts';
import { FPS_IDENTITY_PERSONALITIES, generatePlayerDNA } from './fps/fpsIdentity.ts';

const rng = seed => () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
const plan = { tempo: 0.6, structure: 0.7, aggression: 0.5, preparation: 0.7, freedom: 0.5, economy: 0.8 };
const coach = { ...plan, rigidity: 0.7, communication: 0.7, leadership: 0.7, adaptability: 0.7, development: 0.5 };
const chemistry = { trust: 0.6, communication: 0.6, understanding: 0.6, leadershipAcceptance: 0.6, roleCompetition: 0.3 };

function makeSim(seed = 2026, mapId = 'fontessa', statsA = 80, statsB = 80) {
  const cards = Array.from({ length: 10 }, (_, i) => {
    const s = i < 5 ? statsA : statsB;
    return {
      id: `pol-${seed}-${i}`,
      name: `Op ${i}`,
      stats: { rifling: s, sniping: s, entry: s, utility: s, positioning: s, shotcalling: s },
    };
  });
  const identity = {
    players: Object.fromEntries(cards.map((p, i) => [p.id, {
      id: p.id,
      assignments: { t: FPS_T_POSITIONS[i % 5], ct: FPS_CT_POSITIONS[i % 5] },
      personality: FPS_IDENTITY_PERSONALITIES[(i + seed) % FPS_IDENTITY_PERSONALITIES.length],
      dna: generatePlayerDNA(p.id),
      intensity: 0.6,
      roleSuitability: 0.6,
      familiarity: 0.5,
    }])),
    teams: { blue: { coach, plan, chemistry }, red: { coach, plan, chemistry } },
  };
  return new FpsLiveSimulation(cards.slice(0, 5), cards.slice(5), seed, identity, { mapId });
}

test('Aim Polish 1: applyLiveAimPunch persists across settled ticks until hand micro-correction recovers it', () => {
  const random = rng(17);
  const skills = { flick: 0.8, tracking: 0.8, precision: 0.8, reactions: 0.8, composure: 0.5 };
  const aim = startLiveManualAim('target', 0, 0, 0, 0, 1.0, 0);
  // Settle aim first (`eased === 1`, `now >= moveEnd`).
  stepLiveManualAim(aim, 0, 0, skills, 1.2, 0, random);
  applyLiveAimPunch(aim, { damage: 75, isHeadshot: true, armor: 100, composure: 0.4 }, random);
  const kickedPitch = aim.errPitch;
  assert.ok(kickedPitch < -0.01, `expected upward aim punch, got ${kickedPitch}`);
  // Immediately next tick (before nextAdjustAt): aim punch must NOT snap back to 0!
  const next = stepLiveManualAim(aim, 0, 0, skills, 1.2 + 1 / 30, 0, random);
  assert.ok(Math.abs(next.errPitch - kickedPitch) < 1e-6, `aim punch must persist on next tick (${next.errPitch} vs ${kickedPitch})`);
});

test('Aim Polish 2: neck aim uses tight upper-chest bounds (never firing above the skull) and strafe reversal damps stale velocity', () => {
  const d = 20;
  const neckSize = liveAimTargetSize(d, 'neck');
  const bodySize = liveAimTargetSize(d, 'body');
  assert.ok(neckSize.halfHeight < bodySize.halfHeight * 0.55, 'neck aim vertical window must stay tighter than full torso');
  // 22 cm above neck (well above top of skull) must NOT trigger fire at precision 0.85!
  const overhead = { errYaw: 0, errPitch: Math.atan(0.22 / d) };
  assert.equal(liveTriggerReady(overhead, neckSize, 0.85, { head: false }), false, 'neck aim must not fire into thin air above the helmet');
  // Competitive 0.78 precision keeps first-shot head discipline at 17 m and drops off during sustained spray.
  assert.equal(liveAimZone({ weapon: 'ak47', distance: 17, precision: 0.78 }), 'head');
  assert.notEqual(liveAimZone({ weapon: 'ak47', distance: 17, precision: 0.78, spraying: true }), 'head');

  // Strafe reversal velocity damping in stepLiveManualAim
  const random = rng(31);
  const skills = { flick: 0.8, tracking: 0.85, precision: 0.8, reactions: 0.8, composure: 0.8 };
  const aim = startLiveManualAim('strafer', 0, 0, 0, 0, 0, 0);
  for (let i = 1; i <= 12; i++) stepLiveManualAim(aim, i * 0.012, 0, skills, i / 30, 0, random);
  const velBeforeReverse = aim.velYaw ?? 0;
  assert.ok(velBeforeReverse > 0.05, `expected positive tracking velocity (${velBeforeReverse})`);
  // Target sharply reverses strafe direction
  stepLiveManualAim(aim, 12 * 0.012 - 0.015, 0, skills, 13 / 30, 0, random);
  assert.ok((aim.velYaw ?? 0) < velBeforeReverse * 0.6, 'strafe reversal must damp stale pan velocity');
});

test('Gunplay Polish 3: crouching down into a spray never resets stillSince, and crab-walk crouching stays accurate for non-snipers', () => {
  assert.equal(liveAccurateShotReady('ak47', LIVE_CROUCH_SPEED, false, 0.0, true, 22), true, 'crouch-walking AK stays accurate');
  assert.equal(liveAccurateShotReady('sniper', LIVE_CROUCH_SPEED, false, 0.0, true, 22), false, 'bolt-action sniper still requires stopping');
  assert.ok(liveShotSpeedLimit('ak47', 0.8, true) >= LIVE_CROUCH_SPEED, 'crouched rifle speed limit allows crab-walk spray');
  assert.ok(liveShotSpeedLimit('sniper', 0.8, true) < 0.6, 'sniper speed limit stays strict even crouched');

  const sim = makeSim(2027, 'fontessa', 82, 82);
  Object.assign(sim, { phase: 'live', time: 20, roundLiveAt: 10, liveElapsed: 10, remaining: 90 });
  sim.pendingBuys.clear();
  const actor = sim.actors[0];
  Object.assign(actor, {
    hp: 100, speed: 0, vx: 0, vz: 0, jump: false, crouch: false, wasCrouched: false,
    stillSince: 18, weapon: 'ak47', equipped: 'ak47', ammo: 30,
  });
  // Crouching down mid-spray must preserve stillSince!
  actor.crouch = true;
  sim.applyMotion(actor, { x: 0, z: 0 }, 1 / 30, 'crouch');
  assert.equal(actor.stillSince, 18, 'crouching down must NOT reset stillSince or freeze a rifle spray');
});

test('Gunplay Polish 4: movementControl skill differentiates counter-strafing and decide() preserves active duel reaction', () => {
  const sim = makeSim(2028, 'fontessa', 92, 28);
  const elite = sim.actors[0];
  const rookie = sim.actors[5];
  assert.ok(sim.moveSkill(elite) > sim.moveSkill(rookie) + 0.35, `moveSkill must reflect profile movementControl (${sim.moveSkill(elite)} vs ${sim.moveSkill(rookie)}), not hardcoded 0.5`);

  // decide() must never wipe out an active duel's anticipated reaction time!
  Object.assign(sim, { phase: 'live', time: 25, roundLiveAt: 10, liveElapsed: 15, remaining: 85 });
  sim.pendingBuys.clear();
  elite.target = rookie.id;
  elite.reaction = 0.095; // anticipated trade/pre-aim reaction
  sim.decide(elite);
  assert.equal(elite.reaction, 0.095, 'decide() must preserve active duel anticipated reaction');
});

test('Aim Polish 5: duelMicroTree runs manualAim during reaction so parked-crosshair walk-ins fire cleanly without double delay', () => {
  const sim = makeSim(2029, 'fontessa', 85, 85);
  Object.assign(sim, { phase: 'live', time: 20, roundLiveAt: 10, liveElapsed: 10, remaining: 90 });
  sim.pendingBuys.clear();
  for (const a of sim.actors) Object.assign(a, { hp: 0, nextSense: Infinity, nextThink: Infinity });
  const ct = sim.actors[0];
  const t = sim.actors[5];
  Object.assign(ct, {
    hp: 100, attacking: false, x: -19, z: 2, level: undefined, jumpY: 0, crouch: false,
    weapon: 'm4a1_s', equipped: 'm4a1_s', ammo: 25, reserve: 75, reload: 0, weaponReady: 0,
    speed: 0, vx: 0, vz: 0, stillSince: 15, nextShot: 0, lastShot: -100, blinded: 0, channel: 0,
    target: t.id, acquired: 20, seenAt: 20, reaction: 0.20, manualAim: undefined, sprayIndex: 0,
  });
  Object.assign(t, {
    hp: 100, attacking: true, x: -19, z: -8, level: undefined, jumpY: 0, crouch: false,
    speed: 0, vx: 0, vz: 0, armor: 100,
  });
  const headY = t.jumpY + 1.55;
  ct.yaw = Math.atan2(t.x - ct.x, t.z - ct.z);
  ct.pitch = Math.atan2(headY - 1.6, 10);
  ct.aimPoint = { x: t.x, z: t.z };
  ct.sampledHeadY = headY;
  ct.sampledAimZone = 'head';

  // Run duelMicroTree for 5 ticks (0.167s: >= 0.72 * 0.20 = 0.144s, still < 1.0 * 0.20 = 0.20s!)
  const bt = sim.getDuelMicroBt();
  for (let i = 0; i < 5; i++) {
    sim.time += 1 / 30;
    bt.tick({ actor: ct, target: t, dt: 1 / 30 });
  }
  assert.ok(ct.ammo < 25, `parked-crosshair defender must fire inside passiveCrosshairHit window through duelMicroTree (ammo=${ct.ammo})`);
});

test('Gameplay Polish 6: anticipateLiveContact and liveC4Damage respect Spillway map geometry', () => {
  const spillway = getLiveMapRuntime('spillway');
  const bomb = spillway.definition.sites.B;
  const target = { x: bomb.x + 4, z: bomb.z, level: bomb.level };
  const dmg = liveC4Damage(bomb, target, 100, false, spillway.terrain.groundHeight(target), spillway);
  assert.ok(dmg > 100, `Spillway close C4 blast must compute real damage on Spillway elevation (got ${dmg})`);

  // Sound near Spillway A entry should resolve against Spillway's A entries (not Fontessa's coordinates)
  const aEntry = spillway.definition.tactical.A.entries[0];
  const observer = spillway.definition.tactical.A.holds.find(h => spillway.sightline(h, aEntry)) ?? spillway.definition.sites.A;
  const mem = {
    contacts: [{
      key: 'sound:footstep:1',
      observerId: 'obs',
      source: 'footstep',
      x: aEntry.x + 1,
      z: aEntry.z - 1,
      level: aEntry.level,
      observed: 20,
      confidence: 0.75,
      uncertainty: 2.0,
    }],
  };
  const ant = anticipateLiveContact(mem, new Map(), observer, 20.2, 0.8, 0.8, 0.8, spillway);
  assert.ok(ant, 'Spillway footstep near A entry should produce anticipation');
  assert.ok(Math.hypot(ant.x - aEntry.x, ant.z - aEntry.z) < 12, 'Anticipated gate must come from Spillway A entries, not Fontessa');
});

test('Gameplay Polish 7: CT opening map control caps pushers at <=2 (<=1 on pistol) and retake defuser stages with rotating team', () => {
  for (const mapId of ['fontessa', 'spillway']) {
    const rt = getLiveMapRuntime(mapId);
    const zones = buildMapControlZones(rt);
    const allies = FPS_CT_POSITIONS.map((position, i) => ({
      id: `ct-${i}`, slot: i, position, duty: i < 2 ? 'anchor' : i === 2 ? 'support' : 'entry',
      home: i === 0 ? 'A' : i === 1 ? 'B' : i === 2 ? 'A' : 'B', hp: 100, weaponCategory: 'rifle',
      forward: 0.85, aggression: 0.85, lurking: 0.7, x: 0, z: 35,
    }));
    const rifleTasks = composeFreeDefenseTerritory({
      zones, state: createTeamTerritoryState(0), allies, defensePlay: LIVE_SEED_DEFENSE_PLAYS.standard,
      enemyRead: createEnemyEconomyTracker(5).read, callerTendencies: { mapControlCalling: 90, informationDemand: 90, riskCalling: 90 },
      isPistol: false, liveElapsed: 0, now: 15, roundSeed: 42,
    });
    assert.ok(rifleTasks.length >= 1 && rifleTasks.length <= 2, `${mapId} rifle opening must assign 1–2 pushers (got ${rifleTasks.length})`);

    const pistolTasks = composeFreeDefenseTerritory({
      zones, state: createTeamTerritoryState(0), allies, defensePlay: LIVE_SEED_DEFENSE_PLAYS.standard,
      enemyRead: createEnemyEconomyTracker(5).read, callerTendencies: { mapControlCalling: 90, informationDemand: 90, riskCalling: 90 },
      isPistol: true, liveElapsed: 0, now: 15, roundSeed: 42,
    });
    assert.ok(pistolTasks.length <= 1, `${mapId} standard pistol opening must cap pushers at <=1 (got ${pistolTasks.length})`);
  }

  // Retake defuser staging test: when bomb has 35s left, T is alive, and teammate is rotating from 22m away, defuser stages briefly.
  const sim = makeSim(2030, 'fontessa', 80, 80);
  Object.assign(sim, { phase: 'live', time: 50, roundLiveAt: 10, liveElapsed: 40, remaining: 0 });
  sim.pendingBuys.clear();
  for (const a of sim.actors) Object.assign(a, { hp: 0, nextSense: Infinity, nextThink: Infinity });
  const bombPt = sim.map.definition.sites.A;
  sim.bomb = { status: 'planted', x: bombPt.x, z: bombPt.z, level: bombPt.level, remaining: 35, site: 'A' };
  const defuser = sim.actors.find(a => !a.attacking);
  const rotator = sim.actors.find(a => !a.attacking && a !== defuser);
  const attacker = sim.actors.find(a => a.attacking);
  Object.assign(defuser, { hp: 100, kit: true, x: bombPt.x + 11, z: bombPt.z + 8, retakeWaitUntil: undefined });
  Object.assign(rotator, { hp: 100, kit: false, x: bombPt.x + 24, z: bombPt.z + 10 });
  Object.assign(attacker, { hp: 100, x: bombPt.x - 4, z: bombPt.z - 4 });
  sim.decide(defuser);
  assert.ok(defuser.intent.includes('Stage with retake group'), `defuser with 35s slack and rotating ally should stage briefly, got "${defuser.intent}"`);
});

test('Gunplay Polish 8: non-auto pistols tap-pace at long range instead of mag-dumping into spam inaccuracy', () => {
  const sim = makeSim(2031, 'fontessa', 80, 80);
  Object.assign(sim, { phase: 'live', time: 20, roundLiveAt: 10, liveElapsed: 10, remaining: 90 });
  sim.pendingBuys.clear();
  for (const a of sim.actors) Object.assign(a, { hp: 0, nextSense: Infinity, nextThink: Infinity });
  const shooter = sim.actors[0];
  const enemy = sim.actors[5];
  Object.assign(shooter, {
    hp: 100, attacking: false, weapon: 'usp_s', equipped: 'usp_s', ammo: 12, reserve: 48,
    reload: 0, weaponReady: 0, speed: 0, vx: 0, vz: 0, jump: false, crouch: false,
    stillSince: 15, nextShot: 0, lastShot: -100, blinded: 0, channel: 0, burst: 0, sprayIndex: 0,
    x: 0, z: 32, yaw: Math.PI, pitch: 0,
  });
  Object.assign(enemy, { hp: 100, attacking: true, x: 0, z: -2, yaw: 0, jumpY: 0, crouch: false });
  // Shot 1 (burst -> 1): normal interval
  sim.fire(shooter, enemy);
  const gap1 = shooter.nextShot - sim.time;
  sim.time = shooter.nextShot + 0.01;
  // Shot 2 (burst -> 2 -> paced reset at 34m): must add deliberate tap-reset delay and reset burst to 0
  sim.fire(shooter, enemy);
  const gap2 = shooter.nextShot - sim.time;
  assert.equal(shooter.burst, 0, 'long-range pistol burst must reset after 2 taps');
  assert.ok(gap2 > gap1 + 0.2, `long-range pistol tap reset (${gap2.toFixed(2)}s) must pace significantly slower than rapid spam (${gap1.toFixed(2)}s)`);
});
