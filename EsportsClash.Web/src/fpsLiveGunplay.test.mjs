import test from 'node:test';
import assert from 'node:assert/strict';
import {
  startLiveManualAim, stepLiveManualAim, liveAimTargetSize, liveAimZone, liveSprayOffset, recoverLiveSpray,
  liveRecoilResidual, liveSpamInaccuracy, liveTriggerReady, liveBoltAction,
  computeLiveAnticipationReadiness, applyLiveAimPunch,
} from './fps/fpsLiveGunplay.ts';
import { liveViewmodelKick } from './fps/fpsOperativeMotion.ts';
import {FPS_T_POSITIONS, FPS_CT_POSITIONS} from './fps/fpsPlayerArchitecture.ts';
import {FpsLiveSimulation} from './fps/fpsLiveSimulation.ts';
import {FPS_IDENTITY_PERSONALITIES, generatePlayerDNA} from './fps/fpsIdentity.ts';

const rng = seed => () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
const skilled = {flick: .95, tracking: .9, precision: .95, reactions: .9, composure: .9};
const novice = {flick: .2, tracking: .25, precision: .2, reactions: .25, composure: .3};

test('AK spray follows one fixed pattern: straight up, then left, then right', () => {
  assert.deepEqual(liveSprayOffset('ak47', 0), {pitch: 0, yaw: 0}, 'first shot is accurate');
  const at = i => liveSprayOffset('ak47', i);
  for (let i = 1; i < 9; i++) assert.ok(at(i).pitch > at(i - 1).pitch, `shot ${i} climbs`);
  assert.ok(Math.abs(at(5).yaw) < .002, 'early shots stay nearly vertical');
  assert.ok(at(12).yaw < -.025, 'mid spray pulls left');
  assert.ok(at(21).yaw > .02, 'late spray swings right');
  assert.deepEqual(liveSprayOffset('ak47', 14), liveSprayOffset('ak47', 14), 'identical every spray');
  assert.ok(liveSprayOffset('m4a1_s', 9).pitch < at(9).pitch, 'M4 climbs less than the AK');
});

test('releasing the trigger resets the spray; the Deagle needs a real pause', () => {
  assert.equal(recoverLiveSpray(10, 'ak47', .05, .1), 10, 'no reset while still firing');
  let index = 10;
  for (let i = 0; i < 20; i++) index = recoverLiveSpray(index, 'ak47', .3 + i * .05, .05);
  assert.equal(index, 0, 'AK resets within about half a second');
  let deagle = 1;
  deagle = recoverLiveSpray(deagle, 'deagle', .3, .2);
  assert.ok(deagle > .4, 'Deagle is still recovering after 0.2s');
  assert.ok(liveSprayOffset('deagle', 1).pitch > .04, 'one heavy vertical punch');
  assert.ok(liveSpamInaccuracy('deagle', 2) > 3, 'spamming the Deagle is punished');
  assert.equal(liveSpamInaccuracy('deagle', 0), 1, 'a recovered first shot is clean');
});

test('recoil control decides how much of the pattern reaches the bullet', () => {
  const avg = control => {
    const random = rng(7);let sum = 0;
    for (let i = 0; i < 200; i++) sum += Math.hypot(...Object.values(liveRecoilResidual('ak47', 12, control, .6, random)));
    return sum / 200;
  };
  assert.ok(avg(.95) < avg(.2) * .3, 'strong sprayers cancel most of the climb');
  assert.ok(avg(.95) > 0, 'nobody cancels it perfectly');
});

/** Ticks until the crosshair is within a head of a fixed point, from a 25 degree flick. */
function settle(skills, seed) {
  const random = rng(seed), aim = startLiveManualAim('t', .44, 0, 0, 0, 0, .1), head = liveAimTargetSize(15, true);
  for (let tick = 1; tick <= 120; tick++) {
    const s = stepLiveManualAim(aim, 0, 0, skills, tick / 30, 0, random);
    if (Math.abs(s.errYaw) <= head.halfWidth && Math.abs(s.errPitch) <= head.halfHeight) return tick / 30;
  }
  return Infinity;
}

test('crosshair moves by hand: skilled aim settles fast, novices take longer, nothing teleports', () => {
  const pro = [1, 2, 3, 4, 5].map(seed => settle(skilled, seed)), rookie = [1, 2, 3, 4, 5].map(seed => settle(novice, seed));
  const mean = list => list.reduce((a, b) => a + b, 0) / list.length;
  assert.ok(pro.every(Number.isFinite), 'skilled aim reaches the head');
  assert.ok(mean(pro) < .45, `skilled settle ${mean(pro)}`);
  assert.ok(mean(rookie) > mean(pro) * 1.3, `novice ${mean(rookie)} vs skilled ${mean(pro)}`);
  const aim = startLiveManualAim('t', .44, 0, 0, 0, 0, .1), first = stepLiveManualAim(aim, 0, 0, skilled, 1 / 30, 0, rng(1));
  assert.ok(Math.abs(first.errYaw - .44) < 1e-9, 'no movement before perception finishes');
});

test('moving targets are only partly followed, so poor tracking falls behind', () => {
  const lag = skills => {
    const random = rng(11), aim = startLiveManualAim('t', 0, 0, 0, 0, 0, 0);let total = 0;
    for (let tick = 1; tick <= 90; tick++) total += Math.abs(stepLiveManualAim(aim, tick * .006, 0, skills, tick / 30, 0, random).errYaw);
    return total / 90;
  };
  assert.ok(lag(novice) > lag(skilled) * 1.5);
  assert.ok(lag(skilled) > 0, 'even good tracking is not a lock');
});

// ---- Simulation aim paths: every shot comes from the hand-moved crosshair ----
const STEP = 1 / 30;
const plan = {tempo: .6, structure: .7, aggression: .5, preparation: .7, freedom: .5, economy: .8};
const coach = {...plan, rigidity: .7, communication: .7, leadership: .7, adaptability: .7, development: .5};
const chemistry = {trust: .6, communication: .6, understanding: .6, leadershipAcceptance: .6, roleCompetition: .3};
const cards = Array.from({length: 10}, (_, i) => ({id: `aim-${i}`, name: `Op ${i}`, stats: {rifling: 80, sniping: 80, entry: 80, utility: 80, positioning: 80, shotcalling: 80}}));
const identity = {players: Object.fromEntries(cards.map((p, i) => [p.id, {id: p.id, assignments: {t: FPS_T_POSITIONS[i % 5], ct: FPS_CT_POSITIONS[i % 5]},
  personality: FPS_IDENTITY_PERSONALITIES[i], dna: generatePlayerDNA(p.id), intensity: .6, roleSuitability: .6, familiarity: .5}])), teams: {blue: {coach, plan, chemistry}, red: {coach, plan, chemistry}}};
const wrapA = a => Math.atan2(Math.sin(a), Math.cos(a));
const headingTo = (a, b) => Math.atan2(b.x - a.x, b.z - a.z);

/** The view equals the manual crosshair's own last computed position (nothing snapped it afterwards). */
function viewFromManualAim(p) {
  const a = p.manualAim;
  return !!a && Math.abs(wrapA(p.yaw - (a.lastDesiredYaw + a.errYaw))) < 1e-9 && Math.abs(p.pitch - (a.lastDesiredPitch + a.errPitch)) < 1e-9;
}

function spyShots(sim) {
  const shots = [], fire = sim.fire;
  sim.fire = function (p, target) {
    const before = p.ammo, manual = viewFromManualAim(p), aimId = p.manualAim?.targetId;
    fire.call(this, p, target);
    const prefix = target.id.includes(':') ? target.id.split(':')[0] : 'enemy';
    if (p.ammo < before) shots.push({kind: prefix, target: target.id, aimId, manual, weapon: p.weapon, after: p.sprayIndex});
  };
  return shots;
}

/** One live, quiet scene: shooter and one enemy on open ground with a clear sightline. */
function scene(weapon = 'ak47') {
  const sim = new FpsLiveSimulation(cards.slice(0, 5), cards.slice(5), 4242, identity);
  Object.assign(sim, {phase: 'live', time: 20, roundLiveAt: 0, liveElapsed: 5, remaining: 90});
  sim.pendingBuys.clear();
  const shooter = sim.actors[0], enemy = sim.actors.find(a => a.team !== shooter.team);
  for (const p of sim.actors) Object.assign(p, {hp: 0, nextSense: Infinity, nextThink: Infinity});
  let spot;
  for (let r = 12; r <= 30 && !spot; r += 2) for (let k = 0; k < 16 && !spot; k++) {
    const c = {x: shooter.x + Math.sin(k / 16 * Math.PI * 2) * r, z: shooter.z + Math.cos(k / 16 * Math.PI * 2) * r};
    if (sim.map.walkable(c) && sim.map.sightline(shooter, c)) spot = c;
  }
  assert.ok(spot, 'scene needs a clear sightline');
  const ground = sim.map.terrain.groundHeight(spot);
  Object.assign(shooter, {hp: 100, weapon, equipped: weapon, ammo: 30, reserve: 90, reload: 0, weaponReady: 0, speed: 0, vx: 0, vz: 0, jump: false, crouch: false,
    stillSince: 0, nextShot: 0, lastShot: -100, blinded: 0, channel: 0, target: undefined, manualAim: undefined, sprayIndex: 0, pitch: 0, utilityPreparation: undefined, bomb: false});
  Object.assign(enemy, {hp: 100, x: spot.x, z: spot.z, level: undefined, jumpY: ground, crouch: false, speed: 0, vx: 0, vz: 0, armor: 0});
  return {sim, shooter, enemy, spot};
}
function tick(sim, n = 1) { for (let i = 0; i < n; i++) sim.time += STEP; }

test('seeded matches on both maps: every shot is fired from the manual crosshair, never a snapped view', () => {
  for (const [mapId, seed] of [['fontessa', 777], ['spillway', 1337]]) {
    const sim = new FpsLiveSimulation(cards.slice(0, 5), cards.slice(5), seed, identity, {mapId});
    const shots = spyShots(sim);
    for (let i = 0; i < 6000; i++) sim.step();
    assert.ok(shots.length > 30, `${mapId}: shots were fired (${shots.length})`);
    const bad = shots.filter(s => !s.manual || !(s.aimId === s.target || s.kind === 'known' && s.aimId?.startsWith('known:')));
    assert.equal(bad.length, 0, `${mapId}: ${JSON.stringify(bad.slice(0, 3).map(s => [s.target, s.aimId, s.manual]))}`);
    assert.ok(shots.every(s => !liveBoltAction(s.weapon) || s.after === 0), `${mapId}: bolt-action shots never build a spray`);
  }
});

test('route prefire at a predicted crossing moves the view by hand before the shot', () => {
  const {sim, shooter, spot} = scene();
  sim.tVal = () => .9;
  const key = 'enemy:ghost';
  shooter.intel.contacts.push({key, enemyId: 'ghost', observerId: shooter.id, source: 'sight', x: spot.x, z: spot.z, observed: sim.time - .3, confidence: .95, uncertainty: .4});
  shooter.anticipation = {x: spot.x, z: spot.z, key, observed: sim.time - .3, until: sim.time + 3, confidence: .9, uncertainty: .4, prefire: true, reason: 'test', shots: 0};
  // Roughly pre-aimed (crosshair placement) but the height is far off: a snap would fix it at once.
  shooter.yaw = wrapA(headingTo(shooter, spot) + .08); shooter.pitch = -.25;
  const shots = spyShots(sim);
  assert.equal(sim.tryPredictionPrefire(shooter), false, 'no shot on the first tick: the hand has not moved yet');
  assert.ok(Math.abs(shooter.pitch + .25) < 1e-9, 'the view did not snap onto the crossing');
  let ticks = 0;
  while (!shots.length && ticks++ < 90) { tick(sim); sim.tryPredictionPrefire(shooter); }
  assert.equal(shots.length, 1, 'the prefire happens once the crosshair arrives');
  assert.ok(ticks > 2, `took ${ticks} ticks of hand movement`);
  assert.equal(shots[0].aimId, `prediction:${shooter.id}`);
  assert.ok(shots[0].manual, 'fired from the manual crosshair');
});

test('information fire on a peek reaches the remembered spot by hand', () => {
  const {sim, shooter, spot} = scene();
  sim.tVal = () => .9;
  shooter.intel.contacts.push({key: 'enemy:heard', enemyId: 'heard', observerId: shooter.id, source: 'sight', x: spot.x, z: spot.z, observed: sim.time - .2, confidence: .95, uncertainty: .3});
  shooter.peek = {home: {x: shooter.x, z: shooter.z}, out: {x: shooter.x, z: shooter.z}, back: false, until: sim.time + 5, pause: 0, style: 'shoulder', pumps: 0, prefired: 0};
  shooter.yaw = wrapA(headingTo(shooter, spot) + .06); shooter.pitch = .3;
  const shots = spyShots(sim);
  assert.equal(sim.tryInformationFire(shooter), false, 'the first tick only perceives');
  assert.ok(Math.abs(shooter.pitch - .3) < 1e-9, 'pitch was not eased or snapped onto the spot');
  let ticks = 0;
  while (!shots.length && ticks++ < 90) { tick(sim); sim.tryInformationFire(shooter); }
  assert.equal(shots.length, 1, 'information fire happens after the hand arrives');
  assert.ok(shots[0].aimId.startsWith('known:') && shots[0].manual);
});

test('AWP/Scout: scoped flick corrections, deliberate trigger, no spray, accurate scoped first shot', () => {
  assert.equal(liveBoltAction('sniper'), true); assert.equal(liveBoltAction('scout'), true); assert.equal(liveBoltAction('ak47'), false);
  for (const i of [0, 1, 3, 6]) assert.deepEqual(liveSprayOffset('sniper', i), {pitch: 0, yaw: 0}, 'bolt-action has no spray pattern');
  const residual = liveRecoilResidual('scout', 4, .1, .1, rng(3));
  assert.equal(Math.hypot(residual.pitch, residual.yaw), 0);
  // The scoped trigger is stricter than an unscoped rifle's for the same error.
  const size = liveAimTargetSize(30, false), loose = {errYaw: size.halfWidth * 1.1, errPitch: 0};
  assert.equal(liveTriggerReady(loose, size, .6, {scoped: true}), false);
  assert.equal(liveTriggerReady(loose, size, .6), true);
  // Scoped corrections land finer than unscoped ones (magnified sight picture).
  const finalError = scoped => {
    let sum = 0;
    for (let seed = 1; seed <= 30; seed++) {
      const random = rng(seed), aim = startLiveManualAim('t', .3, .02, 0, 0, 0, .05);let s;
      for (let t = 1; t <= 24; t++) s = stepLiveManualAim(aim, 0, 0, novice, t / 30, 0, random, {scoped});
      sum += s.error;
    }
    return sum / 30;
  };
  assert.ok(finalError(true) < finalError(false), `scoped ${finalError(true)} vs unscoped ${finalError(false)}`);

  // In the simulation: scoped, settled AWP shots at a chest hit, and never accumulate spray.
  const {sim, shooter, enemy} = scene('sniper');
  const shots = spyShots(sim);let hits = 0;
  const fromY = 1.6 + shooter.jumpY, chestY = enemy.jumpY + 1.2;
  for (let i = 0; i < 40; i++) {
    Object.assign(enemy, {hp: 100, armor: 0});
    Object.assign(shooter, {ammo: 5, nextShot: 0, reload: 0, weaponReady: 0, scopeState: 'scoped', stillSince: sim.time - 2, speed: 0});
    shooter.yaw = headingTo(shooter, enemy); shooter.pitch = Math.atan2(chestY - fromY, Math.hypot(enemy.x - shooter.x, enemy.z - shooter.z));
    sim.fire(shooter, enemy);
    if (enemy.hp < 100) hits++;
    assert.equal(shooter.sprayIndex, 0, 'bolt action resets every shot');
    assert.ok(shooter.recoilPitch > .02, 'visible view punch is still exposed for the viewmodel');
    sim.time += 1.5;
  }
  assert.ok(hits >= 36, `scoped first-shot accuracy: ${hits}/40`);
  assert.equal(shots.length, 40);
});

test('spray transfer: a new enemy mid-spray keeps the pattern index and starts a fresh manual flick', () => {
  const {sim, shooter, enemy} = scene('ak47');
  const second = sim.actors.find(a => a.team === enemy.team && a !== enemy);
  Object.assign(second, {hp: 100, x: enemy.x, z: enemy.z, level: undefined, jumpY: enemy.jumpY, speed: 0, crouch: false});
  shooter.yaw = headingTo(shooter, enemy); shooter.pitch = 0; shooter.target = enemy.id; shooter.manualAim = startLiveManualAim(enemy.id, shooter.yaw, 0, shooter.yaw, 0, sim.time - 1, 0);
  Object.assign(shooter, {sprayIndex: 7, lastShot: sim.time - .03, acquired: sim.time - 1});
  enemy.hp = 0; sim.confirmedDeaths.add(enemy.id);
  sim.perceive(shooter);
  assert.equal(shooter.target, second.id, 'the second enemy is taken');
  assert.ok(sim.time < shooter.sprayTransferUntil, 'transfer window opened');
  // While transferring the trigger stays down: the index does not recover, unlike an ordinary pause.
  for (let i = 0; i < 6; i++) { tick(sim); sim.recoverSpray(shooter, STEP); }
  assert.equal(shooter.sprayIndex, 7, 'spray index kept through the transfer');
  sim.updateDuelAimAndFire(shooter, second, STEP, false);
  assert.equal(shooter.manualAim.targetId, second.id, 'a new manual flick starts toward the new enemy');
  assert.ok(viewFromManualAim(shooter));
  // Without a transfer, an idle trigger resets the pattern as before.
  shooter.sprayTransferUntil = undefined; shooter.target = undefined;
  for (let i = 0; i < 30; i++) { tick(sim); sim.recoverSpray(shooter, STEP); }
  assert.equal(shooter.sprayIndex, 0);
});

test('the snapshot exposes the shot residual as recoilYaw/recoilPitch for the viewmodel', () => {
  const {sim, shooter, enemy} = scene('ak47');
  shooter.sprayIndex = 9;
  shooter.yaw = headingTo(shooter, enemy); shooter.pitch = 0;
  sim.fire(shooter, enemy);
  const view = sim.snapshot().players.find(p => p.id === shooter.id);
  assert.equal(view.recoilYaw, shooter.recoil);
  assert.equal(view.recoilPitch, shooter.recoilPitch);
  assert.ok(view.recoilPitch > .004, 'a mid-spray residual is visible');
  sim.recoverSpray(shooter, .2);
  assert.ok(shooter.recoilPitch < view.recoilPitch, 'the display punch settles');
});

test('sustained rifle spray climbs pattern index without 30Hz decay and mixes head/body hits', () => {
  const {sim, shooter, enemy} = scene('m4a1_s');
  const shots = spyShots(sim);
  enemy.hp = 1000; enemy.armor = 100; enemy.helmet = true;
  shooter.yaw = headingTo(shooter, enemy); shooter.pitch = 0;
  shooter.decision = 'pressure';
  let maxSpray = 0, maxBurst = 0, headHits = 0, bodyHits = 0;
  for (let i = 0; i < 45; i++) {
    tick(sim);
    sim.recoverSpray(shooter, STEP);
    sim.perceive(shooter);
    sim.updateDuelAimAndFire(shooter, enemy, STEP, true);
    maxSpray = Math.max(maxSpray, shooter.sprayIndex ?? 0);
    maxBurst = Math.max(maxBurst, shooter.burst);
    const last = sim.shots[sim.shots.length - 1];
    if (last && last.actorId === shooter.id && last.targetId === enemy.id && sim.shots.length === shots.length) {
      if (last.hitRegion === 'head') headHits++; else if (last.hitRegion === 'body') bodyHits++;
    }
  }
  assert.ok(maxSpray >= 4, `expected sustained spray index >= 4, got ${maxSpray}`);
  assert.ok(maxBurst >= 4, `expected sustained burst >= 4, got ${maxBurst}`);
  assert.ok(bodyHits > 0, `expected body hits alongside headshots (head=${headHits}, body=${bodyHits})`);
});

test('computeLiveAnticipationReadiness preserves cold-start reaction and speeds up anticipated contacts', () => {
  const cold = computeLiveAnticipationReadiness({angularError: 0.35});
  assert.deepEqual(cold, {reactionScale: 1, perceptionScale: 1}, 'unanticipated wide angle has full cold-start delay');

  const tradeLow = computeLiveAnticipationReadiness({angularError: 0.3, isTradeTarget: true, tradingSkill: 0.2, communication: 0.2});
  const tradeHigh = computeLiveAnticipationReadiness({angularError: 0.3, isTradeTarget: true, tradingSkill: 0.9, communication: 0.9});
  assert.ok(tradeHigh.reactionScale < tradeLow.reactionScale && tradeLow.reactionScale < 1, 'trade callout lowers reaction scale, scaled by skill and comms');
  assert.ok(tradeHigh.perceptionScale < tradeLow.perceptionScale && tradeLow.perceptionScale < 1, 'trade callout lowers perception scale');

  const preAim = computeLiveAnticipationReadiness({angularError: 0.05, isPreAimedContact: true, crosshairSkill: 0.85});
  assert.ok(preAim.reactionScale < 0.85 && preAim.perceptionScale < 0.8, 'tight pre-aimed contact reacts faster than cold start');

  const clamped = computeLiveAnticipationReadiness({
    angularError: 0.0,
    isTradeTarget: true,
    isPreAimedContact: true,
    isPeekingContact: true,
    partnerFightingNear: true,
    tradingSkill: 1,
    crosshairSkill: 1,
    communication: 1,
  });
  assert.ok(Math.abs(clamped.reactionScale - (1 - 0.62 * 0.52)) < 1e-9, 'readiness clamps at 0.62');
  assert.ok(Math.abs(clamped.perceptionScale - Math.max(0.22, 1 - 0.62 * 0.65)) < 1e-9, 'perception scale respects readiness cap');
});

test('applyLiveAimPunch perturbs errPitch on headshots and heavy unarmored hits while composure dampens kick', () => {
  const aimIgnoreBody = startLiveManualAim('t', 0, 0, 0, 0, 1.0, 0);
  applyLiveAimPunch(aimIgnoreBody, {damage: 28, isHeadshot: false, armor: 80, composure: 0.5}, rng(1));
  assert.equal(aimIgnoreBody.errPitch, 0, 'normal armored body tagging has no aim-punch');

  const aimIgnoreLight = startLiveManualAim('t', 0, 0, 0, 0, 1.0, 0);
  applyLiveAimPunch(aimIgnoreLight, {damage: 14, isHeadshot: false, armor: 0, composure: 0.5}, rng(1));
  assert.equal(aimIgnoreLight.errPitch, 0, 'low damage below 18 has no aim-punch');

  const calmAim = startLiveManualAim('t', 0, 0, 0, 0, 1.0, 0);
  const rattledAim = startLiveManualAim('t', 0, 0, 0, 0, 1.0, 0);
  applyLiveAimPunch(calmAim, {damage: 69.5, isHeadshot: true, armor: 100, composure: 0.95}, rng(5));
  applyLiveAimPunch(rattledAim, {damage: 69.5, isHeadshot: true, armor: 100, composure: 0.1}, rng(5));

  assert.ok(calmAim.errPitch < 0 && rattledAim.errPitch < 0, 'headshot dink kicks errPitch upward (negative)');
  assert.equal(calmAim.fromPitch, calmAim.errPitch, 'fromPitch is synchronized with errPitch');
  assert.ok(Math.abs(calmAim.errPitch) < Math.abs(rattledAim.errPitch), 'higher composure reduces aim-punch kick');
  assert.ok(calmAim.nextAdjustAt >= calmAim.moveStart + 0.035, 'nextAdjustAt is nudged for micro-correction');

  const unarmoredHead = startLiveManualAim('t', 0, 0, 0, 0, 1.0, 0);
  applyLiveAimPunch(unarmoredHead, {damage: 100, isHeadshot: true, armor: 0, composure: 0.5}, rng(5));
  const armoredHead = startLiveManualAim('t', 0, 0, 0, 0, 1.0, 0);
  applyLiveAimPunch(armoredHead, {damage: 69.5, isHeadshot: true, armor: 100, composure: 0.5}, rng(5));
  assert.ok(Math.abs(unarmoredHead.errPitch) > Math.abs(armoredHead.errPitch), 'unarmored headshot kicks harder than helmet dink');
});

test('crosshair placement holds still before reaction and fires when an enemy walks across the reticle', () => {
  const random = rng(19);
  const aim = startLiveManualAim('walk-in', 0, 0, -0.025, 0, 0, 0.15);
  const s1 = stepLiveManualAim(aim, -0.012, 0, skilled, 1 / 30, 0, random);
  assert.equal(aim.adjustments, 0, 'crosshair stays parked before visual reaction');
  assert.ok(Math.abs(s1.yaw) < 1e-9, `crosshair did not chase moving target (${s1.yaw})`);
  const s2 = stepLiveManualAim(aim, 0.001, 0, skilled, 2 / 30, 0, random);
  assert.ok(Math.abs(s2.yaw) < 1e-9, 'reticle remains still on its pre-aim spot');
  assert.equal(liveTriggerReady(s2, liveAimTargetSize(15, true), skilled.precision, {head: true}), true, 'enemy crossing stationary crosshair enters trigger window');

  const {sim, shooter, enemy} = scene('ak47');
  const d = Math.hypot(enemy.x - shooter.x, enemy.z - shooter.z);
  const fromY = 1.6 + shooter.jumpY;
  const headY = enemy.jumpY + 1.55;
  shooter.yaw = headingTo(shooter, enemy);
  shooter.pitch = Math.atan2(headY - fromY, d);
  shooter.reaction = 0.14;
  shooter.acquired = sim.time;
  shooter.seenAt = sim.time;
  shooter.target = enemy.id;
  shooter.aimPoint = {x: enemy.x, z: enemy.z};
  shooter.sampledHeadY = headY;
  const shots = spyShots(sim);
  // Step 4 ticks (0.133s >= 0.72 * 0.14 = 0.1008s): passive crosshair hit fires before full move reaction!
  for (let i = 0; i < 4; i++) { tick(sim); sim.updateDuelAimAndFire(shooter, enemy, STEP, true); }
  assert.ok(shots.length >= 1, 'stationary pre-aimed shooter fires cleanly when enemy stands/walks inside crosshair');
});

test('pro precision maintains head-level first-shot aim past 22m without dropping to body', () => {
  assert.equal(liveAimZone({weapon: 'ak47', distance: 23, precision: .95}), 'head');
  assert.equal(liveAimZone({weapon: 'deagle', distance: 26, precision: .92}), 'head');
  assert.equal(liveAimZone({weapon: 'usp_s', distance: 24, precision: .95}), 'head');
  assert.notEqual(liveAimZone({weapon: 'ak47', distance: 23, precision: .95, spraying: true}), 'head');
});

test('per-weapon recoil signatures differentiate kick pitch, roll, decay and pistol slide travel', () => {
  const deagle = liveViewmodelKick('deagle');
  const ak = liveViewmodelKick('ak47');
  const m4 = liveViewmodelKick('m4a1_s');
  const mp9 = liveViewmodelKick('mp9');
  const awp = liveViewmodelKick('sniper');
  const negev = liveViewmodelKick('negev');
  const usp = liveViewmodelKick('usp_s');
  assert.ok(deagle.pitch > ak.pitch && ak.pitch > m4.pitch && m4.pitch > mp9.pitch, 'kick pitch follows Deagle > AK > M4A1-S > MP9');
  assert.ok(awp.decay < ak.decay && ak.decay < m4.decay && m4.decay < mp9.decay, 'recoil settle speed scales inversely with caliber inertia');
  assert.ok(deagle.slideTravel > usp.slideTravel && usp.slideTravel > 0 && ak.slideTravel === 0, 'pistols blow back slides while rifles/SMGs stay fixed');
  assert.ok(negev.chatter > ak.chatter && ak.chatter > m4.chatter, 'heavy full-auto platforms vibrate harder than suppressed rifles');
});
