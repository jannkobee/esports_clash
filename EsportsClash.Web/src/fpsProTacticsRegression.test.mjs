import {FPS_T_POSITIONS,FPS_CT_POSITIONS} from './fps/fpsPlayerArchitecture.ts';
import { FpsUtilityLearner, createFpsUtilityBrain } from './fps/fpsUtilityBrain.ts';
import test from 'node:test';
import assert from 'node:assert/strict';
import { FpsLiveSimulation } from './fps/fpsLiveSimulation.ts';
import { LIVE_FPS_MAP, LIVE_TACTICAL, LIVE_ELEVATION_DROPS, LIVE_JUMPABLE_PERCHES, distance, findLivePath, liveWalkable, livePathLength } from './fps/fpsLiveMap.ts';
import { liveGroundHeight } from './fps/fpsLiveTerrain.ts';
import { liveDrawTime, LIVE_WEAPONS, LIVE_KNIFE, canBuyLiveWeapon } from './fps/fpsLiveWeapons.ts';
import { buyLiveTeam } from './fps/fpsLiveEconomy.ts';
import { launchLiveGrenade, computeLiveThrowForce, stepLiveGrenade, LIVE_UTILITY_RULES, LIVE_UTILITY_FUSES } from './fps/fpsLiveGrenades.ts';
import { solveLiveSmokeThrow, solveLivePopFlash, LIVE_AUTHORED_SMOKE_LINEUPS } from './fps/fpsLiveLineups.ts';
import { liveSmokeDepth, liveSmokeOccludes } from './fps/fpsLiveBrain.ts';
import { NullEngine, Scene, StandardMaterial, TransformNode, Vector3, FreeCamera } from '@babylonjs/core';
import { computeLiveGrenadeTrajectoryPoints, createTacticalOperativeMesh, create3DWeaponMesh, createViewmodelMesh, applyOperativeAnimation } from './fps/fpsLiveViewer.ts';
import { extractFootstepSlices } from './fps/fpsBroadcastAudio.ts';
import { FPS_IDENTITY_PERSONALITIES, generatePlayerDNA } from './fps/fpsIdentity.ts';

const plan = { tempo: 0.6, structure: 0.7, aggression: 0.5, preparation: 0.7, freedom: 0.5, economy: 0.8 };
const coach = { ...plan, rigidity: 0.7, communication: 0.7, leadership: 0.7, adaptability: 0.7, development: 0.5 };
const chemistry = { trust: 0.6, communication: 0.6, understanding: 0.6, leadershipAcceptance: 0.6, roleCompetition: 0.3 };
const cards = Array.from({ length: 10 }, (_, i) => ({
  id: `pro-reg-${i}`,
  name: `Pro ${i}`,
  stats: { rifling: 82, positioning: 82, entry: 82, sniping: 82, utility: 82, shotcalling: 82 },
}));
const identity = {
  players: Object.fromEntries(cards.map((p, i) => [
    p.id,
    { id: p.id, assignments:{t:FPS_T_POSITIONS[(i)%5],ct:FPS_CT_POSITIONS[(i)%5]},personality: FPS_IDENTITY_PERSONALITIES[i], dna: generatePlayerDNA(p.id), intensity: 0.6, roleSuitability: 0.6, familiarity: 0.5 },
  ])),
  teams: { blue: { coach, plan, chemistry }, red: { coach, plan, chemistry } },
};

// Coordination fixture: the authored examples as a fixed team smoke plan (live rounds calculate their own).
const createSim = () => { const sim = new FpsLiveSimulation(cards.slice(0, 5), cards.slice(5), 20261114, identity); sim.roundSmokes = sim.map.authoredSmokeLineups.map((l) => ({...l})); return sim; };
/** Items are passed physically: the donor turns to the teammate and then drops; advance that handoff. */
const completeHandoffs = (sim) => { for (let i = 0; i < 60 && sim.actors.some((a) => a.handoff); i++) { sim.time += 1 / 30; for (const a of sim.actors) if (a.handoff) sim.stepHandoff(a, 1 / 30); } };

test('Pro Regression 1: Sniper refuses to scope into close walls and Vitality/Spirit AWPer repositions around smoke', () => {
  const sim = createSim();
  Object.assign(sim, { phase: 'live', remaining: 90, time: 22, roundLiveAt: 10 });
  for (const a of sim.actors) Object.assign(a, { hp: 0, nextSense: Infinity, nextThink: Infinity, nextShot: Infinity });
  const sniper = sim.actors[0];
  const enemy = sim.actors[5];
  Object.assign(sniper, {
    hp: 100, role: 'sniper', attacking: false, weapon: 'sniper', equipped: 'sniper',
    ammo: 10, reserve: 30, weaponReady: 0, reload: 0, channel: 0, utilityPreparation: undefined,
    x: 0.6, z: 16.0, yaw: 0, jump: false, jumpY: 0, speed: 0, stance: 'hold', crouch: false,
    watchPoint: { x: 0.6, z: 28 }, scopeState: 'hip', scopeLevel: 0, scopeHoldUntil: 0,
  });
  Object.assign(enemy, { hp: 100, x: 31, z: -35, yaw: 0, nextSense: Infinity, nextThink: Infinity, nextShot: Infinity });

  // Wall in front at z=17 (1m clearance) must prevent scoping
  sim.updateAiming(sniper, undefined);
  assert.equal(sniper.scopeState, 'hip', 'Sniper facing close wall must stay unscoped');

  // If already scoped when moving/turning into a wall, unscope immediately
  Object.assign(sniper, { scopeState: 'scoped', scopeLevel: 1, scopeHoldUntil: sim.time + 5 });
  sim.updateAiming(sniper, undefined);
  assert.equal(sniper.scopeState, 'lowering', 'Scoped sniper facing wall must immediately lower scope');

  // Vitality / Spirit AWP doctrine: if current primary hold is smoked out, pivot to open crossfire
  Object.assign(sniper, {
    x: LIVE_TACTICAL.A.holds[0].x, z: LIVE_TACTICAL.A.holds[0].z, yaw: Math.PI,
    scopeState: 'hip', scopeLevel: 0, scopeHoldUntil: 0, nextThink: 0,
  });
  sim.decide(sniper);
  const blockedWatch = sniper.watchPoint ?? LIVE_TACTICAL.A.entries[0];
  const smoke = {
    id: 99,
    x: (sniper.x + blockedWatch.x) / 2,
    z: (sniper.z + blockedWatch.z) / 2,
    y: liveGroundHeight(blockedWatch),
    radius: 4.5,
    startedAt: sim.time,
    expires: sim.time + 15,
  };
  sim.smokes.push(smoke);
  sniper.knownSmokes.push(smoke);
  sim.decide(sniper);
  assert.ok(
    sniper.intent.includes('Reposition AWP') || sniper.action === 'Repositioning AWP',
    `Expected sniper to reposition around smoke, got intent="${sniper.intent}" action="${sniper.action}"`,
  );
});

test('Pro Regression 2: Realistic grenade equip timing and incremental non-spoiling trajectory trail', () => {
  assert.ok(liveDrawTime('smoke') >= 0.65, 'Grenade draw time must be deliberate (>= 0.65s)');

  const sim = createSim();
  Object.assign(sim, { phase: 'live', remaining: 100, time: 20, roundLiveAt: 10 });
  for (const a of sim.actors) Object.assign(a, { hp: 0, nextSense: Infinity, nextThink: Infinity, nextShot: Infinity });
  const thrower = sim.actors[0];
  const enemy = sim.actors[5];
  Object.assign(thrower, {
    hp: 100, x: 0, z: -17, yaw: 0, profile: undefined, goal: { x: 0, z: -17 },
    smoke: 1, flash: 0, he: 0, incendiary: 0, utilityAt: 0, weaponReady: 0, reload: 0, channel: 0, bomb: false,
  });
  Object.assign(enemy, { hp: 100, x: 31, z: 38, yaw: Math.PI, nextSense: Infinity, nextThink: Infinity, nextShot: Infinity });

  assert.equal(sim.throwUtility(thrower, 'smoke', { x: 0, z: -10 }), true);
  const startSnap = sim.snapshot().players.find(p => p.id === thrower.id);
  assert.equal(startSnap?.utilityPrep?.phase, 'equip', 'Initial utility setup must begin in equip phase');

  // After 0.50s (15 ticks), player must still be preparing (not already released!)
  for (let i = 0; i < 15; i++) sim.step();
  const midSnap = sim.snapshot();
  const midThrower = midSnap.players.find(p => p.id === thrower.id);
  assert.ok(midThrower?.utilityPrep, 'Utility must still be preparing after 0.50s');
  assert.equal(midSnap.grenades.length, 0, 'Grenade must not launch before realistic equip + pin timing');

  // Trajectory helper clamped to early flight must stay strictly behind full detonation arc
  const from = { x: 0, z: -17 };
  const target = { x: 0, z: 2 };
  const grenade = launchLiveGrenade(77, 'smoke', thrower.id, thrower.team, from, target, 10, false, 'medium', 1.55);
  const partialArc = computeLiveGrenadeTrajectoryPoints(grenade, grenade.releaseAt, grenade.releaseAt + 0.25);
  const fullArc = computeLiveGrenadeTrajectoryPoints(grenade);
  const partialDist = distance(from, partialArc[partialArc.length - 1]);
  const fullDist = distance(from, fullArc[fullArc.length - 1]);
  assert.ok(partialDist < fullDist * 0.6, `Partial flight trail (${partialDist.toFixed(2)}m) must not jump ahead to detonation (${fullDist.toFixed(2)}m)`);
});

test('Pro Regression 3: Full 4-slot loadout export and mid-fight swap to handgun on empty primary magazine', () => {
  const sim = createSim();
  Object.assign(sim, { phase: 'live', remaining: 90, time: 30, roundLiveAt: 10 });
  for (const a of sim.actors) Object.assign(a, { hp: 0, nextSense: Infinity, nextThink: Infinity, nextShot: Infinity });
  const attacker = sim.actors[5];
  const defender = sim.actors[0];
  Object.assign(attacker, {
    hp: 100, attacking: true, weapon: 'ak47', equipped: 'ak47',
    ammo: 0, reserve: 90, weaponReady: 0, reload: 0, blinded: 0,
    sidearmLoadout: { weapon: 'glock', ammo: LIVE_WEAPONS.glock.magazine, reserve: LIVE_WEAPONS.glock.reserve },
    holsteredPrimary: undefined,
    x: 0, z: -18, yaw: 0, acquired: sim.time - 1, target: defender.id,
  });
  Object.assign(defender, {
    hp: 100, attacking: false, weapon: 'm4a1_s', equipped: 'm4a1_s',
    x: 0, z: -6, yaw: Math.PI, jumpY: 0, crouch: false,
  });

  // Verify 4-slot loadout snapshot with holstered sidearm
  attacker.ammo = 1;
  const beforeSnap = sim.snapshot().players.find(p => p.id === attacker.id);
  assert.equal(beforeSnap?.primaryWeapon, 'ak47');
  assert.equal(beforeSnap?.secondaryWeapon, 'glock');
  assert.equal(beforeSnap?.secondaryAmmo, LIVE_WEAPONS.glock.magazine);
  assert.equal(beforeSnap?.meleeWeapon, 'knife');

  // When primary hits 0 mid-duel against visible enemy, draw secondary handgun instead of standing helplessly reloading
  attacker.ammo = 0;
  sim.chooseEquipment(attacker, defender);
  assert.equal(attacker.weapon, 'glock', 'Empty rifle mid-duel should swap to secondary handgun');
  assert.equal(attacker.holsteredPrimary?.weapon, 'ak47', 'Primary rifle should remain holstered during handgun finish');

  const swappedSnap = sim.snapshot().players.find(p => p.id === attacker.id);
  assert.equal(swappedSnap?.primaryWeapon, 'ak47', 'Snapshot preserves primaryWeapon while secondary is drawn');
  assert.equal(swappedSnap?.secondaryWeapon, 'glock');
});

test('Pro Regression 4: Elevated window drop vault, NAVI/Spirit early CT smoke conservation, and MOUZ smoke-fade readiness', () => {
  // Part A: Mid-window vault drop shortcut
  const sim = createSim();
  Object.assign(sim, { phase: 'live', remaining: 95, time: 25, roundLiveAt: 10 });
  for (const a of sim.actors) Object.assign(a, { hp: 0, nextSense: Infinity, nextThink: Infinity, nextShot: Infinity });
  const vaulter = sim.actors[0];
  const enemy = sim.actors[5];
  const drop = LIVE_ELEVATION_DROPS.find(d => d.id === 'mid-window-drop');
  assert.ok(drop, 'mid-window-drop must exist in LIVE_ELEVATION_DROPS');
  Object.assign(vaulter, {
    hp: 100, x: 0.6, z: 18.2, jump: false, jumpY: liveGroundHeight({ x: 0.6, z: 18.2 }), jumpVy: 0,
    nextJump: 0, vaultDrop: undefined, smokeLineupId: undefined, bomb: false, reload: 0,
    goal: { x: 0.6, z: 5 }, path: [{ x: 0.6, z: 5 }], freezeDelay: 0, speed: 3.5, vx: 0, vz: -3.5,
  });
  Object.assign(enemy, { hp: 100, x: 31, z: -38, yaw: 0, nextSense: Infinity, nextThink: Infinity, nextShot: Infinity });

  sim.move(vaulter, 1 / 30);
  assert.ok(vaulter.vaultDrop, 'Actor at Mid Window aiming south should trigger crouch-jump vaultDrop');
  assert.equal(vaulter.action, 'Vaulting down');

  for (let i = 0; i < 45; i++) sim.step();
  assert.equal(vaulter.vaultDrop, undefined, 'Vault drop should complete after landing on lower street');
  assert.ok(vaulter.z < 16.5 && vaulter.jumpY < 0.25, `Expected landing below Mid Window, got z=${vaulter.z.toFixed(2)}, y=${vaulter.jumpY.toFixed(2)}`);

  // Part B: NAVI / Spirit early CT smoke conservation on weak uncorroborated sound vs confirmed sight
  const navSim = createSim();
  Object.assign(navSim, { phase: 'live', remaining: 95, time: 20, roundLiveAt: 5, bomb: { status: 'carried', x: 0, z: -35, site: undefined, remaining: 40 } });
  const ct = navSim.actors[0];
  Object.assign(ct, {
    hp: 100, attacking: false, smoke: 1, x: 20, z: 22, yaw: Math.PI, utilityAt: 0, weaponReady: 0, reload: 0, channel: 0,
    intel: {
      contacts: [{
        key: 'weak-b', observerId: ct.id, source: 'footstep', x: 20, z: -2,
        observed: navSim.time - 0.2, confidence: 0.65, uncertainty: 5,
      }],
    },
  });
  const earlyResult = navSim.useInformationUtility(ct, [ct]);
  assert.equal(ct.smoke, 1, `CT must conserve early smoke on weak unconfirmed sound (${earlyResult ?? 'none'})`);

  // Part C: MOUZ smoke-fade timing readiness
  const mouzSim = createSim();
  Object.assign(mouzSim, { phase: 'live', remaining: 60, time: 40, roundLiveAt: 5 });
  const lurk = mouzSim.actors[5];
  Object.assign(lurk, {
    hp: 100, x: 18, z: 1.0, yaw: 0, jump: false, jumpY: 0, speed: 0, crouch: false,
    goal: { x: 18, z: 12 }, path: [{ x: 18, z: 12 }], freezeDelay: 0, smokeLineupId: undefined,
    objectiveUrgent: false, utilityPreparation: undefined,
  });
  const fadingSmoke = { id: 101, x: 18, z: 6, y: 0, radius: 4, startedAt: mouzSim.time - 17, expires: mouzSim.time + 0.9 };
  mouzSim.smokes.push(fadingSmoke);
  lurk.knownSmokes.push(fadingSmoke);
  mouzSim.move(lurk, 1 / 30);
  assert.equal(lurk.action, 'Timing smoke fade', 'Player watching nearly expired smoke should ready aim for the fade pop');
});

test('Pro Regression 5: Underhand nade throws, physics-based upward smoke lineups, and highground/lowground smoke POV parity', () => {
  // Part A: Underhand nade throw ballistics and close/ledge AI selection
  const closeFrom = { x: 0, z: -24 };
  const closeTo = { x: 0, z: -19 };
  const throwHeight = liveGroundHeight(closeFrom) + 1.55;
  const underhandGrenade = launchLiveGrenade(
    501,
    'smoke',
    'pro-reg-5',
    'red',
    closeFrom,
    closeTo,
    10,
    false,
    'underhand',
    throwHeight,
  );
  const overheadGrenade = launchLiveGrenade(
    502,
    'smoke',
    'pro-reg-5',
    'red',
    closeFrom,
    closeTo,
    10,
    false,
    'overhead',
    throwHeight,
  );
  assert.equal(underhandGrenade.throwStyle, 'underhand');
  assert.ok(
    underhandGrenade.y < throwHeight - 0.35,
    `Expected hip-level underhand release height (< ${throwHeight - 0.35}), got ${underhandGrenade.y}`,
  );
  assert.ok(underhandGrenade.y < overheadGrenade.y - 0.35, 'Underhand release should originate notably lower than overhead release');
  assert.ok(
    underhandGrenade.detonateAt - underhandGrenade.releaseAt <= 1.35,
    'Underhand throw flight time should stay compact (<= 1.35s)',
  );

  const underhandSim = createSim();
  Object.assign(underhandSim, { phase: 'live', remaining: 70, time: 14, roundLiveAt: 5 });
  underhandSim.actors.forEach((a, idx) => {
    a.hp = 100;
    a.x = idx < 5 ? 25 : -25;
    a.z = idx < 5 ? 36 : -36;
  });
  const thrower = underhandSim.actors[5];
  Object.assign(thrower, {
    x: 0, z: 0, yaw: 0, pitch: 0, speed: 0, crouch: false, jump: false, jumpY: 0,
    smoke: 1, flash: 1, weaponReady: 0, channel: 0, reload: 0, utilityAt: 0, utilityPreparation: undefined,
  });
  assert.equal(
    underhandSim.chooseUtilityThrowStyle(thrower, 'flash', { x: 0, z: 5 }),
    'underhand',
    'Close clear utility throws (< 7.8m) should choose underhand toss',
  );
  // Elevated drop from Mid Window height (drop = 1.6m >= 0.85m) into clear Mid street (range = 9.75m < 13.5m) should choose underhand even for HE
  const firstDrop = LIVE_ELEVATION_DROPS[0];
  const dropPoint = {
    x: (firstDrop.from.minX + firstDrop.from.maxX) * 0.5,
    z: (firstDrop.from.minZ + firstDrop.from.maxZ) * 0.5,
  };
  const dropTarget = { x: 0.6, z: 9.0 };
  if (liveGroundHeight(dropPoint) - liveGroundHeight(dropTarget) >= 0.85) {
    Object.assign(thrower, { x: dropPoint.x, z: dropPoint.z });
    assert.equal(
      underhandSim.chooseUtilityThrowStyle(thrower, 'he', dropTarget),
      'underhand',
      'Elevated ledge drop throws (< 13.5m, drop >= 0.85m) should select underhand toss',
    );
  }
  Object.assign(thrower, { x: 0, z: 0 });
  const startedCloseSmoke = underhandSim.throwUtility(thrower, 'smoke', { x: 0, z: 5 });
  assert.equal(startedCloseSmoke, true, 'Close underhand smoke setup should succeed');
  assert.equal(thrower.utilityPreparation?.throwStyle, 'underhand', 'Close smoke preparation should lock underhand style');

  // Part B: Physics-based upward smoke lineups (players look up and calculate trajectory)
  // The mid window is a normal size since 2026-11-17, so the long upward example is the CT market smoke.
  const midWindowLineup = LIVE_AUTHORED_SMOKE_LINEUPS.find((l) => l.id === 'guard-market');
  assert.ok(midWindowLineup, 'guard-market authored smoke lineup must exist');
  const solved = solveLiveSmokeThrow(midWindowLineup.position, midWindowLineup.target, 1.55);
  assert.ok(solved, 'solveLiveSmokeThrow should solve the long upward lineup');
  assert.ok(solved.launchPitch > 0.25, `Expected positive upward launchPitch (> 0.25 rad), got ${solved.launchPitch}`);
  assert.ok(Number.isFinite(solved.launchYaw), 'Solved launchYaw must be finite');

  const lineupSim = createSim();
  Object.assign(lineupSim, { phase: 'live', remaining: 80, time: 10, roundLiveAt: 5 });
  lineupSim.actors.forEach((a, idx) => {
    a.hp = 100;
    a.x = idx < 5 ? 24 : -24;
    a.z = idx < 5 ? 36 : -36;
  });
  const smokenader = lineupSim.actors[5];
  Object.assign(smokenader, {
    x: midWindowLineup.position.x,
    z: midWindowLineup.position.z,
    yaw: Math.atan2(midWindowLineup.target.x - midWindowLineup.position.x, midWindowLineup.target.z - midWindowLineup.position.z),
    pitch: 0,
    speed: 0,
    crouch: false,
    jump: false,
    jumpY: 0,
    smoke: 1,
    weaponReady: 0,
    channel: 0,
    reload: 0,
    utilityAt: 0,
    utilityPreparation: undefined,
    smokeLineupRetryAt: 0,
  });
  // Test the bot's own calculation from this spot, without experience from the shared utility brain.
  lineupSim.utilityLearner = new FpsUtilityLearner({ mode: 'frozen', model: createFpsUtilityBrain() });
  lineupSim.aimSmokeLineup(smokenader, midWindowLineup, 1 / 15);
  assert.ok(
    (smokenader.utilityPreparation?.launchPitch ?? 0) > 0.25,
    'Prepared smoke lineup should record upward ballistic launchPitch immediately on horizontal alignment',
  );
  for (let i = 0; i < 8; i++) {
    lineupSim.step();
  }
  assert.ok(smokenader.pitch > 0.25, `Player lining up smoke must physically pitch upward (> 0.25 rad), got ${smokenader.pitch}`);

  // Part C: Highground / lowground smoke POV symmetry and floorY clipping
  // Elevated floor at y = 1.82 => resting smoke center at y = 1.82 + 1.42 = 3.24
  const elevatedSmoke = { id: 909, x: 0, z: 18, y: 3.24, radius: 4.1, startedAt: 10, expires: 28 };
  const highEye = { x: -3, z: 12 };
  const lowEye = { x: 4, z: 24 };
  const depthHighToLow = liveSmokeDepth(highEye, lowEye, 4.4, 1.55, elevatedSmoke, 12);
  const depthLowToHigh = liveSmokeDepth(lowEye, highEye, 1.55, 4.4, elevatedSmoke, 12);
  assert.ok(
    Math.abs(depthHighToLow - depthLowToHigh) < 1e-6,
    `Highground->lowground depth (${depthHighToLow}) must match lowground->highground depth (${depthLowToHigh})`,
  );
  assert.equal(
    liveSmokeOccludes(highEye, lowEye, 4.4, 1.55, elevatedSmoke, 12),
    liveSmokeOccludes(lowEye, highEye, 1.55, 4.4, elevatedSmoke, 12),
    'Smoke occlusion decision must be symmetric between highground and lowground observers',
  );
  assert.equal(
    liveSmokeOccludes(lowEye, highEye, 1.55, 4.4, elevatedSmoke, 12),
    true,
    'Sightline passing directly through elevated smoke volume must be occluded from both angles',
  );

  // Sightline staying strictly below floorY (1.82m) underneath the smoke overhang must be clipped to 0 depth
  const depthUnderFloor = liveSmokeDepth({ x: -8, z: 18 }, { x: 8, z: 18 }, 1.55, 1.55, elevatedSmoke, 12);
  assert.equal(
    depthUnderFloor,
    0,
    `Sightline below elevated smoke floorY (1.55m < 1.82m) must not be occluded by unclipped lower lobes; got ${depthUnderFloor}`,
  );
});

test('Pro Regression 6: Throw physics force hierarchy (jump & walk-jump > walk > standard) and C4 bombExplode audio cue', () => {
  // Part A: Physical force multiplier ordering
  const fUnderhand = computeLiveThrowForce('underhand');
  const fStandard = computeLiveThrowForce('standard');
  const fWalk = computeLiveThrowForce('walk');
  const fJump = computeLiveThrowForce('jump');
  const fWalkJump = computeLiveThrowForce('walk-jump');
  const fRunJump = computeLiveThrowForce('run-jump');
  assert.ok(fUnderhand < fStandard && fStandard < fWalk && fWalk < fJump && fJump < fWalkJump && fWalkJump < fRunJump);

  // Part B: Actual ballistic travel distance across open lane scales monotonically with throw force
  const origin = { x: -19, z: -34 };
  const farTarget = { x: -19, z: 20 };
  const travelFor = (style) => {
    const g = launchLiveGrenade(601, 'smoke', 'pro-reg-5', 'red', origin, farTarget, 0, false, style, 1.55);
    const end = { ...g };
    for (let t = 0; t < g.detonateAt - 1e-8; t += 1 / 30) {
      stepLiveGrenade(end, Math.min(1/30, g.detonateAt - t));
    }
    return distance(origin, end);
  };
  const dStandard = travelFor('standard');
  const dWalk = travelFor('walk');
  const dJump = travelFor('jump');
  const dWalkJump = travelFor('walk-jump');
  assert.ok(dStandard < dWalk, `walk throw (${dWalk.toFixed(2)}m) should beat standing (${dStandard.toFixed(2)}m)`);
  assert.ok(dWalk < dJump, `jump throw (${dJump.toFixed(2)}m) should beat walk throw (${dWalk.toFixed(2)}m)`);
  assert.ok(dJump < dWalkJump, `walk-jump throw (${dWalkJump.toFixed(2)}m) should beat stationary jump throw (${dJump.toFixed(2)}m)`);

  // Part C: Cross-map authored lineups solve with jump / walk-jump and physically jump on release
  const midWindow = LIVE_AUTHORED_SMOKE_LINEUPS.find((l) => l.id === 'guard-market');
  const crossMap = LIVE_AUTHORED_SMOKE_LINEUPS.find((l) => l.id === 'restaurant-civic');
  // Since the drawn roofs collide (2026-11-20 collision pass), the best guard-market solve is a walk throw that
  // clips the east eave of the B market house (the drawn tile corner is within the grenade's 9 cm padding) and
  // drops onto the target 8 cm off; a jump lands 12.5 cm off. Both remain valid, and a requested jump still jumps.
  assert.ok(['walk', 'jump', 'walk-jump'].includes(solveLiveSmokeThrow(midWindow.position, midWindow.target, 1.55)?.throwStyle ?? ''));
  assert.ok(['jump', 'walk-jump'].includes(solveLiveSmokeThrow(midWindow.position, midWindow.target, 1.55, 'jump')?.throwStyle ?? ''));
  // The 0.6 m cross-map solve bounced off the flat collision top of apartments-south; that roof is drawn (and now
  // collides) pitched, so the best walk-jump lands 0.81 m off. Live smokes are planned and learned, not authored.
  assert.equal(solveLiveSmokeThrow(crossMap.position, crossMap.target, 1.55, 'walk-jump', 1)?.throwStyle, 'walk-jump');

  const sim = createSim();
  Object.assign(sim, { phase: 'live', remaining: 85, time: 15, roundLiveAt: 5 });
  sim.actors.forEach((a, idx) => {
    a.hp = 100;
    a.x = idx < 5 ? 25 : -25;
    a.z = idx < 5 ? 36 : -36;
  });
  const jumper = sim.actors[5];
  Object.assign(jumper, {
    x: crossMap.position.x,
    z: crossMap.position.z,
    groundY: liveGroundHeight(crossMap.position),
    jumpY: liveGroundHeight(crossMap.position),
    jump: false,
    speed: 0,
    crouch: false,
    smoke: 1,
    weaponReady: 0,
    channel: 0,
    reload: 0,
    utilityAt: 0,
    utilityPreparation: undefined,
  });
  assert.equal(sim.throwUtility(jumper, 'smoke', crossMap.target, undefined, crossMap.id), true);
  assert.equal(jumper.utilityPreparation?.throwStyle, 'walk-jump');
  sim.time = jumper.utilityPreparation.readyAt;
  sim.releaseUtilityPreparation(jumper);
  assert.equal(jumper.jump, true, 'Releasing a walk-jump smoke lineup must physically trigger a jump');

  // Part D: C4 detonation emits bombExplode audio cue
  Object.assign(sim, { phase: 'live', bomb: { status: 'planted', site: 'A', x: -23, z: 21, remaining: 0 } });
  sim.drainAudioCues();
  sim.explodeBomb();
  const cues = sim.drainAudioCues();
  assert.ok(cues.some((c) => c.kind === 'bombExplode' && c.x === -23 && c.z === 21), 'C4 detonation must emit bombExplode audio cue');
});

test('Pro Regression 7: Articulated CT/T animations (underhand/overhand, 4-stage reload, bolt-cycle, defuse, blinded) & multi-style footstep slicing', () => {
  // Part A: CT/T operative animation poses via NullEngine
  const engine = new NullEngine();
  const scene = new Scene(engine);
  const materials = new Map();
  const getMat = (hex) => {
    if (!materials.has(hex)) materials.set(hex, new StandardMaterial(hex, scene));
    return materials.get(hex);
  };
  try {
    const operative = createTacticalOperativeMesh('ct', 'anim-ct', scene, getMat);
    const gunNode = new TransformNode('anim-gun', scene);
    const view = { operative, force: 'ct', gunNode, gunWeapon: 'm4a1_s' };
    const sim = createSim();
    const basePlayer = {
      ...sim.actors[0],
      hp: 100,
      x: 4,
      z: -6,
      yaw: 0,
      pitch: 0,
      recoilPitch: 0,
      recoilYaw: 0,
      crouch: false,
      jump: false,
      jumpY: 0,
      speed: 0,
      reload: 0,
      reloadDuration: 2.4,
      channel: 0,
      blinded: 0,
      lastShot: -10,
      lastSwing: -10,
      weaponReady: 0,
      throwAt: undefined,
      utilityPrep: undefined,
      equipped: 'smoke',
      weapon: 'm4a1_s',
    };

    // 1. Underhand vs Overhand utility preparation
    applyOperativeAnimation(view, {
      ...basePlayer,
      utilityPrep: { kind: 'smoke', releaseAt: 10.6, phase: 'ready', throwStyle: 'underhand' },
    }, 10.0, 0.05);
    const underhandArmX = operative.rightArmPivot.rotation.x;
    const underhandGunY = gunNode.position.y;
    assert.ok(underhandArmX > 0.25, `Underhand prep rightArmPivot.x should hold low/back (>0.25); got ${underhandArmX}`);

    applyOperativeAnimation(view, {
      ...basePlayer,
      utilityPrep: { kind: 'smoke', releaseAt: 10.6, phase: 'ready', throwStyle: 'standard' },
    }, 10.0, 0.05);
    // Allow the requested pose transition to blend over 100 ms; retain the
    // original high-cock endpoint and distinct underhand/overhand assertions.
    applyOperativeAnimation(view, {
      ...basePlayer,
      utilityPrep: { kind: 'smoke', releaseAt: 10.6, phase: 'ready', throwStyle: 'standard' },
    }, 10.05, 0.05);
    const overhandArmX = operative.rightArmPivot.rotation.x;
    const overhandGunY = gunNode.position.y;
    assert.ok(overhandArmX < -1.5, `Overhand prep rightArmPivot.x should cock high (<-1.5); got ${overhandArmX}`);
    assert.ok(underhandGunY < overhandGunY - 0.2, `Underhand hold (${underhandGunY.toFixed(2)}m) should sit noticeably lower than overhand (${overhandGunY.toFixed(2)}m)`);

    // 2. Underhand release scoop follow-through
    applyOperativeAnimation(view, {
      ...basePlayer,
      throwAt: 10.0,
      throwKind: 'smoke',
      throwStyle: 'underhand',
    }, 10.42, 0.05);
    assert.ok(operative.rightArmPivot.rotation.x < -0.5, `Underhand release should scoop forward/up; got ${operative.rightArmPivot.rotation.x}`);

    // 3. 4-stage reload (local magazine coordinates stay anchored even at yaw=PI/2 & jumpY=2.0 + stage-4 bolt rack)
    applyOperativeAnimation(view, {
      ...basePlayer,
      equipped: 'ak47',
      weapon: 'ak47',
      yaw: Math.PI / 2,
      jumpY: 2.0,
      reloadDuration: 2.5,
      reload: 1.15, // progress = 0.54 (stage 3 insert)
    }, 11.0, 0.05);
    assert.equal(operative.magazine.isEnabled(), true, 'Reload magazine must be visible during mid-reload');
    const magLocalDist = Math.hypot(operative.magazine.position.x, operative.magazine.position.z);
    assert.ok(magLocalDist < 0.6, `Magazine must stay in root-local space (<0.6m XZ from center); got ${magLocalDist.toFixed(2)}m`);
    assert.ok(operative.magazine.position.y < 1.35, `Magazine root-local Y must not double-add jumpY=2.0; got ${operative.magazine.position.y}`);

    applyOperativeAnimation(view, {
      ...basePlayer,
      equipped: 'ak47',
      weapon: 'ak47',
      reloadDuration: 2.5,
      reload: 0.28, // progress = 0.888 (stage 4 bolt rack)
    }, 11.8, 0.05);
    applyOperativeAnimation(view, {
      ...basePlayer,
      equipped: 'ak47',
      weapon: 'ak47',
      reloadDuration: 2.5,
      reload: 0.28,
    }, 11.85, 0.05);
    assert.equal(operative.magazine.isEnabled(), false, 'Reload magazine hides once seated before stage-4 rack');
    assert.ok(operative.leftArmPivot.rotation.x < -0.7 && operative.leftArmPivot.rotation.y < 0.3, 'Stage-4 bolt rack pulls left arm across receiver');

    // 4. Sniper bolt-cycling posture
    applyOperativeAnimation(view, {
      ...basePlayer,
      equipped: 'sniper',
      weapon: 'sniper',
      scopeState: 'cycling',
      lastShot: 11.7,
    }, 12.0, 0.05);
    assert.ok(gunNode.rotation.z > 0.2, `Bolt-cycling rifle should cant noticeably; got rotZ=${gunNode.rotation.z}`);

    // 5. CT bomb defusal kneeling & wire cutting
    for (let i = 0; i < 12; i++) {
      applyOperativeAnimation(view, {
        ...basePlayer,
        attacking: false,
        equipped: 'usp_s',
        weapon: 'usp_s',
        channel: 2.0,
      }, 13.0 + i * 0.05, 0.05);
    }
    assert.ok(operative.crouchPose > 0.75, `Defusing CT must kneel (crouchPose > 0.75); got ${operative.crouchPose}`);
    assert.ok(operative.spine.rotation.x > 0.35, `Defusing CT spine must lean forward (>0.35); got ${operative.spine.rotation.x}`);

    // 6. Flashbang blinded face-shielding
    applyOperativeAnimation(view, {
      ...basePlayer,
      equipped: 'm4a1_s',
      weapon: 'm4a1_s',
      blinded: 1.5,
    }, 14.0, 0.05);
    assert.ok(operative.leftArmPivot.rotation.x < -1.4, `Blinded operative must shield eyes with left arm (<-1.4); got ${operative.leftArmPivot.rotation.x}`);
  } finally {
    scene.dispose();
    engine.dispose();
  }

  // Part B: Multi-style footstep transient slicing
  const sampleRate = 22050;
  const durationSec = 5.0;
  const samples = new Float32Array(Math.floor(sampleRate * durationSec));
  const bursts = [
    { at: 0.30, amp: 0.16 },
    { at: 0.75, amp: 0.18 },
    { at: 1.20, amp: 0.20 },
    { at: 1.70, amp: 0.42 },
    { at: 2.15, amp: 0.45 },
    { at: 2.65, amp: 0.48 },
    { at: 3.15, amp: 0.82 },
    { at: 3.65, amp: 0.86 },
    { at: 4.15, amp: 0.90 },
  ];
  for (const burst of bursts) {
    const startIdx = Math.floor(burst.at * sampleRate);
    const len = Math.floor(0.08 * sampleRate);
    for (let j = 0; j < len && startIdx + j < samples.length; j++) {
      const env = Math.exp(-j / (sampleRate * 0.018));
      samples[startIdx + j] = burst.amp * env * Math.sin(j * 0.42);
    }
  }
  const fakeBuffer = {
    sampleRate,
    duration: durationSec,
    getChannelData: () => samples,
  };
  const slices = extractFootstepSlices(fakeBuffer);
  assert.ok(slices.length >= 8, `Expected >= 8 distinct footstep slices; got ${slices.length}`);
  assert.ok(slices.every((s) => s.duration <= 0.24), 'Every slice must stay tightly clipped (<= 0.24s) without bleeding');
  const styles = new Set(slices.map((s) => s.style));
  assert.equal(styles.has('crouch'), true, 'Slice classifier must extract crouch steps');
  assert.equal(styles.has('walk'), true, 'Slice classifier must extract walk steps');
  assert.equal(styles.has('run'), true, 'Slice classifier must extract run steps');
});

test('Pro Regression 8: Unobstructed throws skip sky-gazing, teammates pool smokes for 1 utility specialist, and dynamic round options vary', () => {
  // Part A: Obstruction-aware direct throw vs overhead lob
  const openFrom = { x: -19, z: -10 };
  const openTarget = { x: -19, z: 6 };
  const openSolved = solveLiveSmokeThrow(openFrom, openTarget, 1.55);
  assert.ok(openSolved, 'Open 16m corridor smoke should solve');
  assert.notEqual(openSolved.throwStyle, 'overhead', 'Unobstructed 16m throw must not look up with overhead lob');
  assert.equal(openSolved.throwStyle, 'standard');
  assert.ok(openSolved.launchPitch < 0.55, `Expected direct low launchPitch (< 0.55 rad), got ${openSolved.launchPitch}`);

  const dirSim = createSim();
  Object.assign(dirSim, { phase: 'live', remaining: 90, time: 10, roundLiveAt: 5 });
  const tester = dirSim.actors[5];
  Object.assign(tester, { x: -19, z: -10, jumpY: 0, speed: 0, crouch: false, jump: false, smoke: 1, flash: 1 });
  assert.equal(
    dirSim.chooseUtilityThrowStyle(tester, 'smoke', openTarget),
    'standard',
    'chooseUtilityThrowStyle should use standard direct throw on clear 16m lane',
  );

  // Part B: 1 utility specialist pools teammate smokes and chains both execute smokes while 4 teammates execute
  const poolSim = createSim();
  Object.assign(poolSim, { phase: 'live', time: 16, roundLiveAt: 0, liveElapsed: 2, remaining: 95, site: 'A', tacticArchetype: 'default_pick' });
  for (const a of poolSim.actors) {
    a.hp = 100;
    if (!a.attacking) { a.x = 30; a.z = 40; a.nextThink = Infinity; a.nextSense = Infinity; }
  }
  const attackers = poolSim.actors.filter((a) => a.attacking);
  const support = attackers.find((a) => a.role === 'support') ?? attackers[2];
  const donor = attackers.find((a) => a !== support && !a.bomb && a.role !== 'entry') ?? attackers.find((a) => a !== support && !a.bomb);
  const entry = attackers.find((a) => a.role === 'entry');
  assert.ok(support && donor && entry, 'Test roster must include support, donor, and entry');
  assert.equal(support.bomb, false, 'Utility specialist should stay bomb-free so teammates can drop smokes and let them line up');
  Object.assign(support, { x: -19, z: 8, jumpY: 0, smoke: 1, flash: 1, reload: 0, weaponReady: 0, utilityAt: 0, channel: 0, bomb: false, utilityPreparation: undefined });
  Object.assign(donor, { x: -19.5, z: 5.5, jumpY: 0, smoke: 1, reload: 0, channel: 0, utilityPreparation: undefined, smokeLineupId: undefined });
  Object.assign(entry, { x: -18.5, z: 9, jumpY: 0, smoke: 0 });
  poolSim.funnelTeamSmokes(support.team); completeHandoffs(poolSim);
  assert.equal(donor.smoke, 0, 'Teammate should drop their spare smoke for the utility specialist');
  const pooled = poolSim.droppedUtility.find((w) => w.kind === 'smoke' && w.reservedFor === support.id);
  assert.ok(pooled, 'Dropped smoke should be reserved for the utility specialist');

  // Step past short air flight; support throws Smoke #1 cleanly, collects pooled Smoke #2, and keeps chain cadence fast
  poolSim.informationOrders[support.team] = {
    mode: 'execute',
    site: 'A',
    responders: attackers.map((a) => a.id),
    until: poolSim.time + 25,
    strength: 0,
    reason: '1+4 utility execute on A',
    executePhase: 'utility',
    phaseAt: poolSim.time,
    smokesSent: 0,
    flashSent: false,
    entryId: entry.id,
    readyAt: 0,
  };
  const firstLineup = LIVE_AUTHORED_SMOKE_LINEUPS.find((l) => l.phase === 'execute' && l.site === 'A');
  assert.ok(firstLineup);
  Object.assign(support, { ...firstLineup.position, yaw: Math.atan2(firstLineup.target.x - firstLineup.position.x, firstLineup.target.z - firstLineup.position.z), speed: 0 });
  poolSim.updateExecute();
  assert.equal(support.smokeLineupId, firstLineup.id);
  poolSim.time += 0.25;
  poolSim.updateExecute();
  assert.ok(support.utilityPreparation, 'Support should begin preparing Smoke #1');
  poolSim.time = support.utilityPreparation.readyAt;
  poolSim.releaseUtilityPreparation(support);
  assert.ok(support.utilityAt - poolSim.time <= 1.0, 'Execute utility specialist should chain Smoke #2 within ~0.9s, not wait 8s');
  poolSim.time += 0.5;
  poolSim.collectGroundEquipment();
  assert.equal(support.smoke, 1, 'Utility specialist should collect teammate-dropped Smoke #2 for the follow-up lineup');

  // Part C: Dynamic round diversity across seeds & rounds (fake_execute no longer locked to B)
  const fakeSites = new Set();
  for (let s = 1; s <= 25 && fakeSites.size < 2; s++) {
    const dynSim = createSim(s * 97);
    for (let r = 2; r <= 20; r++) {
      dynSim.round = r;
      dynSim.startRound();
      if (dynSim.tacticArchetype === 'fake_execute') {
        fakeSites.add(dynSim.site);
        assert.equal(dynSim.fakeSite, dynSim.site === 'A' ? 'B' : 'A');
      }
    }
  }
  assert.equal(fakeSites.size, 2, `fake_execute should dynamically vary across both A and B; saw ${[...fakeSites].join(',')}`);
});

test('Pro Regression 9: Expanded CT/T pistol picks & Deagle economy buys are actively purchased, upgraded as sidearms, and drawn in fights', () => {
  // Verify new pistol exclusivity and stats
  assert.equal(canBuyLiveWeapon('fiveseven', false), true);
  assert.equal(canBuyLiveWeapon('fiveseven', true), false);
  assert.equal(canBuyLiveWeapon('tec9', true), true);
  assert.equal(canBuyLiveWeapon('tec9', false), false);
  for (const w of ['p250', 'cz75', 'deagle']) {
    assert.equal(canBuyLiveWeapon(w, true), true);
    assert.equal(canBuyLiveWeapon(w, false), true);
  }

  // Verify Deagle + expanded pistols appear across pistol, eco, half/force, and sniper sidearm upgrades for both sides
  const seenCtPistols = new Set();
  const seenTPistols = new Set();
  for (let round = 1; round <= 18; round++) {
    for (const attacking of [false, true]) {
      const cash = round === 1 || round === 16 ? 800 : round % 4 === 2 ? 2350 : round % 4 === 3 ? 3100 : 6200;
      const squad = ['entry', 'trade', 'sniper', 'support', 'lurker'].map((role, i) => ({
        id: `gun-${attacking ? 't' : 'ct'}-${i}`,
        role,
        cash,
        weapon: attacking ? 'glock' : 'usp_s',
        armor: 0,
        kit: false,
        flash: 0,
        smoke: 0,
        incendiary: 0,
        he: 0,
        attacking,
        preferSniper: role === 'sniper',
      }));
      const res = buyLiveTeam(squad, plan, round, round % 4 === 2 ? 2 : 0, round === 15);
      for (const p of res.players) {
        const picked = [p.weapon, p.sidearm].filter(Boolean);
        for (const w of picked) {
          if (LIVE_WEAPONS[w].category === 'pistol' && w !== 'usp_s' && w !== 'glock') {
            (attacking ? seenTPistols : seenCtPistols).add(w);
          }
        }
      }
    }
  }
  assert.ok(seenCtPistols.has('deagle'), `CT should buy Deagle across economy tiers; saw ${[...seenCtPistols]}`);
  assert.ok(seenCtPistols.has('fiveseven'), `CT should buy Vanguard 5.7; saw ${[...seenCtPistols]}`);
  assert.ok(seenCtPistols.has('p250') || seenCtPistols.has('cz75'), `CT should use P250/CZ75; saw ${[...seenCtPistols]}`);
  assert.ok(seenTPistols.has('deagle'), `T should buy Deagle across economy tiers; saw ${[...seenTPistols]}`);
  assert.ok(seenTPistols.has('tec9'), `T should buy Riot-9 (Tec-9); saw ${[...seenTPistols]}`);
  assert.ok(seenTPistols.has('p250') || seenTPistols.has('cz75'), `T should use P250/CZ75; saw ${[...seenTPistols]}`);

  // Verify full simulation freeze buy equips upgraded sidearm onto live player and draws it when pushed/empty
  const sim = createSim(777);
  sim.round = 4;
  sim.startRound();
  for (const a of sim.actors) a.cash = 6800;
  sim.round = 4;
  sim.startRound();
  for (let i = 0; i < 470; i++) sim.step();
  const upgraded = sim.actors.filter((a) => !['glock', 'usp_s', 'pistol'].includes(a.sidearmLoadout?.weapon ?? 'glock'));
  assert.ok(upgraded.length >= 2, 'Affluent buy round should equip upgraded sidearm loadouts onto multiple actors');
});

test('Pro Regression 10: Smoke gunfire stays wiggle-free, Spectator/AI smoke widths align on peeking silhouettes, and live lineup/gun drops work mid-round', () => {
  // Part A: Shooting through active smoke tracks disturbance without shrinking/wiggling smoke.radius
  const sim = createSim();
  Object.assign(sim, { phase: 'live', remaining: 90, time: 25, roundLiveAt: 10 });
  for (const a of sim.actors) Object.assign(a, { hp: 0, nextSense: Infinity, nextThink: Infinity, nextShot: Infinity });

  const shooter = sim.actors[5];
  const dummy = sim.actors[0];
  Object.assign(shooter, {
    hp: 100, x: -19, z: -10, yaw: 0, pitch: 0, weapon: 'ak47', equipped: 'ak47', ammo: 30, reserve: 90,
    weaponReady: 0, reload: 0, speed: 0, crouch: true, stillSince: 20, utilityPreparation: undefined,
  });
  Object.assign(dummy, { hp: 100, x: -19, z: 10 });
  const smoke = {
    id: 505,
    x: -19,
    z: 0,
    y: liveGroundHeight({ x: -19, z: 0 }) + 1.35,
    startedAt: 20,
    expires: 38,
    radius: LIVE_UTILITY_RULES.smokeRadius,
    disturbance: 0,
    disturbedUntil: 0,
  };
  sim.smokes.push(smoke);
  const radiusBefore = smoke.radius;
  for (let s = 0; s < 5; s++) {
    shooter.nextShot = 0;
    sim.fire(shooter, dummy);
    sim.step();
  }
  assert.ok((smoke.disturbance ?? 0) > 0, 'Gunfire through smoke should record transient disturbance');
  assert.ok((smoke.disturbedUntil ?? 0) > sim.time);
  assert.ok(Math.abs(smoke.radius - radiusBefore) < 0.02, `Gunfire must NOT shrink/wiggle smoke radius (was ${radiusBefore}, got ${smoke.radius})`);

  // Part B: Solid visual core vs transparent outer edge alignment + silhouette shoulder peeking past smoke edge
  const refSmoke = { id: 1, x: 0, z: 0, y: 1.44, radius: LIVE_UTILITY_RULES.smokeRadius, startedAt: 0, expires: 18 };
  assert.equal(liveSmokeOccludes({ x: 3.5, z: -8 }, { x: 3.5, z: 8 }, 1.6, 1.6, refSmoke, 5), true, 'Solid smoke interior (3.5m) must occlude AI vision');
  assert.equal(liveSmokeOccludes({ x: 4.05, z: -8 }, { x: 4.05, z: 8 }, 1.6, 1.6, refSmoke, 5), false, 'Thin outer edge (4.05m) matching transparent Spectator rim should allow AI vision');

  const edgeSmoke = {
    id: 506,
    x: 0,
    z: -32.15,
    y: liveGroundHeight({ x: 0, z: -32.15 }) + 1.35,
    startedAt: 10,
    expires: 38,
    radius: LIVE_UTILITY_RULES.smokeRadius,
  };
  sim.smokes = [edgeSmoke];
  Object.assign(shooter, { hp: 100, x: -8, z: -36, yaw: Math.PI / 2, pitch: 0, blinded: 0, crouch: false, jumpY: 0, intel: shooter.intel });
  Object.assign(dummy, { hp: 100, x: 8, z: -36, yaw: -Math.PI / 2, crouch: false, jumpY: 0 });
  assert.equal(liveSmokeOccludes(shooter, dummy, 1.6, 1.6, edgeSmoke, sim.time), true, 'Target head center is inside solid smoke edge');
  assert.equal(sim.visible(shooter, dummy), true, 'AI must spot enemy whose shoulder/edge sticks out past the smoke rim');
  sim.perceive(shooter);
  assert.ok((shooter.aimPoint?.z ?? 0) < dummy.z, 'AI should aim at the exposed sticking-out shoulder rather than deep inside smoke');

  // Part C: Location-aware smoke drop at upcoming lineup throw spot + mid-round utility & gun/sidearm drops
  const dropSim = createSim();
  Object.assign(dropSim, { phase: 'live', time: 20, roundLiveAt: 10, liveElapsed: 5, remaining: 95, site: 'A', tacticArchetype: 'default_pick' });
  for (const a of dropSim.actors) {
    a.hp = 100;
    a.utilityPreparation = undefined;
    a.smokeLineupId = undefined;
    a.channel = 0;
    a.reload = 0;
    a.weaponReady = 0;
    a.lastDropAt = -100;
    a.lastShot = -100;
    a.seenAt = -100;
    a.damageAt = -100;
    if (!a.attacking) { a.x = 30; a.z = 40; a.nextThink = Infinity; a.nextSense = Infinity; }
  }
  const attackers = dropSim.actors.filter((a) => a.attacking);
  const spec = attackers.find((a) => a.role === 'support') ?? attackers[2];
  const donor = attackers.find((a) => a !== spec && !a.bomb && a.role !== 'entry') ?? attackers.find((a) => a !== spec && !a.bomb);
  const libraryLineup = LIVE_AUTHORED_SMOKE_LINEUPS.find((l) => l.id === 'a-library');
  assert.ok(spec && donor && libraryLineup);
  // Utility specialist holds 1 smoke en route at A Main entrance while teammate is forward near a-library lineup spot
  dropSim.openingSmokeTeams.add(spec.team);
  Object.assign(spec, { x: -19, z: -10, smoke: 1, flash: 0, bomb: false, holsteredPrimary: undefined });
  Object.assign(donor, { x: -29, z: 6.5, smoke: 1, flash: 1, bomb: false, hp: 30, holsteredPrimary: undefined });
  dropSim.funnelTeamSmokes(spec.team); completeHandoffs(dropSim);
  assert.equal(donor.smoke, 0, 'Donor should drop extra smoke for specialist');
  const stagedSpot = dropSim.droppedUtility.find((w) => w.kind === 'smoke' && w.reservedFor === spec.id);
  assert.ok(stagedSpot && distance(stagedSpot, libraryLineup.position) < 2.2, 'Spare smoke should be staged right on the upcoming lineup throw position on the ground');

  // Mid-round live flash handoff + AWP & Deagle drops
  const ecoMate = attackers.find((a) => a !== spec && a !== donor && !a.bomb) ?? attackers[0];
  const awpMate = attackers.find((a) => a !== spec && a !== donor && a !== ecoMate) ?? attackers[4];
  assert.ok(ecoMate && awpMate && ecoMate !== donor && awpMate !== donor);
  donor.lastDropAt = -100;
  Object.assign(donor, {
    x: -19, z: -8, hp: 32, bomb: false, flash: 1, smoke: 0, he: 0, incendiary: 0,
    weapon: 'ak47', equipped: 'ak47', ammo: 30, reserve: 90,
    sidearmLoadout: { weapon: 'deagle', ammo: 7, reserve: 35 },
    holsteredPrimary: undefined, preferSniper: false, role: 'lurker',
  });
  Object.assign(ecoMate, {
    x: -19, z: -5, hp: 100, bomb: false, flash: 0, smoke: 0, he: 0, incendiary: 0,
    weapon: 'glock', equipped: 'glock', ammo: 20, reserve: 120,
    sidearmLoadout: { weapon: 'glock', ammo: 20, reserve: 120 },
    holsteredPrimary: undefined, preferSniper: false, role: 'entry',
  });
  Object.assign(spec, { x: 25, z: -30 }); // keep other attackers out of 12m range
  Object.assign(awpMate, { x: 25, z: -32, smoke: 0, flash: 0, he: 0, incendiary: 0, hp: 100, preferSniper: true, role: 'sniper' });
  dropSim.droppedUtility = [];
  dropSim.stepLiveDrops(); completeHandoffs(dropSim);
  const flashDrop = dropSim.droppedUtility.find((w) => w.kind === 'flash' && w.reservedFor === ecoMate.id);
  assert.ok(flashDrop, 'Low-HP teammate should share spare flash mid-round during live play');

  // Healthy eco mate on glock receives rifler's spare Deagle sidearm mid-round
  donor.lastDropAt = -100;
  donor.flash = 0;
  donor.hp = 90;
  dropSim.stepLiveDrops(); completeHandoffs(dropSim);
  const deagleDrop = dropSim.droppedWeapons.find((w) => w.weapon === 'deagle' && w.reservedFor === ecoMate.id);
  assert.ok(deagleDrop, 'Rifler carrying upgraded Deagle sidearm should toss it to starter-pistol teammate mid-round');
  dropSim.time += 1.0;
  ecoMate.x = deagleDrop.x;
  ecoMate.z = deagleDrop.z;
  dropSim.collectGroundEquipment();
  assert.equal(ecoMate.weapon, 'deagle', 'Starter-pistol teammate should catch and equip the dropped Deagle mid-round');

  // Non-sniper carrying scavenged AWP tosses it to designated AWPer mid-round and falls back to sidearm
  Object.assign(donor, { weapon: 'sniper', equipped: 'sniper', ammo: 5, reserve: 30, sidearmLoadout: { weapon: 'p250', ammo: 13, reserve: 26 }, lastDropAt: -100 });
  Object.assign(ecoMate, { x: 25, z: -34 });
  Object.assign(awpMate, { x: -19, z: -5, hp: 100, weapon: 'glock', equipped: 'glock', ammo: 20, reserve: 120 });
  dropSim.droppedWeapons = [];
  dropSim.stepLiveDrops(); completeHandoffs(dropSim);
  const awpDrop = dropSim.droppedWeapons.find((w) => w.weapon === 'sniper' && w.reservedFor === awpMate.id);
  assert.ok(awpDrop, 'Non-sniper carrying an AWP should hand it off to nearby AWPer mid-round');
  assert.equal(donor.weapon, 'p250', 'Donor should switch cleanly to their sidearm after tossing the AWP');
  dropSim.time += 1.0;
  awpMate.x = awpDrop.x;
  awpMate.z = awpDrop.z;
  dropSim.collectGroundEquipment();
  assert.equal(awpMate.weapon, 'sniper', 'Designated AWPer should collect and equip the dropped AWP mid-round');
});

test('Pro Regression 11: Carefree 0-left defuse, molotov escape, post-round upgrades, bounded CS2 drops, and AK two-hand grip', () => {
  // 1. 0 opponents left: clear stale anonymous contacts, stick defuse smoothly, and keep allies carefree (no crouch-hold)
  const sim = createSim();
  const defuser = sim.actors[0];
  const mate = sim.actors[1];
  const lastEnemy = sim.actors[5];
  const bombPt = LIVE_TACTICAL.A.entries[0];
  Object.assign(sim, { phase: 'live', remaining: 90, time: 25, roundLiveAt: 10, site: 'A' });
  sim.bomb = { status: 'planted', x: bombPt.x, z: bombPt.z, level: bombPt.level, remaining: 20, site: 'A' };
  for (const a of sim.actors) {
    Object.assign(a, { hp: 0, bomb: false, nextSense: Infinity, nextThink: Infinity, nextShot: Infinity });
    if (a !== lastEnemy) sim.confirmedDeaths.add(a.id);
  }
  sim.confirmedDeaths.delete(defuser.id);
  sim.confirmedDeaths.delete(mate.id);
  Object.assign(defuser, {
    hp: 100, attacking: false, kit: true, weapon: 'm4a1_s', equipped: 'm4a1_s', ammo: 30, reserve: 60,
    x: bombPt.x, z: bombPt.z, level: bombPt.level, jumpY: liveGroundHeight(bombPt), crouch: false,
    channel: 0, fakeDefuseDone: false, halfDefuseDone: false, weaponReady: 0, nextSense: 25, nextThink: 25,
  });
  Object.assign(mate, {
    hp: 100, attacking: false, kit: false, weapon: 'm4a1_s', equipped: 'm4a1_s', ammo: 30, reserve: 60,
    x: LIVE_TACTICAL.A.holds[0].x, z: LIVE_TACTICAL.A.holds[0].z, crouch: true,
    channel: 0, weaponReady: 0, nextSense: 25, nextThink: 25,
  });
  Object.assign(lastEnemy, { hp: 50, attacking: true, x: LIVE_TACTICAL.A.holds[1].x, z: LIVE_TACTICAL.A.holds[1].z });
  defuser.intel.contacts.push({
    key: 'gunfire:stale', source: 'gunfire', observerId: defuser.id,
    x: bombPt.x + 1.5, z: bombPt.z, observed: sim.time, confidence: 0.95, uncertainty: 0.5,
  });
  sim.damage(mate, lastEnemy, 200, false, 'm4a1_s', false);
  assert.equal(defuser.enemyRemaining, 0, 'Killing final enemy clears remaining enemy count');
  assert.equal(defuser.intel.contacts.length, 0, 'Stale anonymous gunfire contacts clear when 0 opponents remain');
  assert.equal(mate.crouch, false, 'Carefree ally drops crouch immediately when 0 opponents remain');

  let prevChannel = 0;
  let baited = false;
  for (let i = 0; i < 180 && sim.bomb.status === 'planted'; i++) {
    sim.step(0.05);
    if (defuser.action === 'Half-defuse bait' || defuser.action === 'Holding fake defuse') baited = true;
    if (sim.bomb.status === 'planted') {
      assert.ok(defuser.channel >= prevChannel, `Defuser must stick defuse monotonically with 0 enemies (${prevChannel} -> ${defuser.channel})`);
      prevChannel = defuser.channel;
    }
  }
  assert.equal(baited, false, 'CT defuser must never half-defuse or fake-defuse when 0 opponents remain');
  assert.equal(sim.bomb.status, 'defused', 'Bomb should finish defusing cleanly with 0 enemies');

  // 2. Molotov / incendiary reaction: cancel crouch/lineup and escape outside fire radius
  const fireSim = createSim();
  Object.assign(fireSim, { phase: 'live', remaining: 90, time: 20, roundLiveAt: 10 });
  for (const a of fireSim.actors) Object.assign(a, { hp: 0, nextSense: Infinity, nextThink: Infinity, nextShot: Infinity });
  const burnActor = fireSim.actors[0];
  const aliveT = fireSim.actors[5];
  Object.assign(burnActor, {
    hp: 100, attacking: false, weapon: 'm4a1_s', equipped: 'm4a1_s', ammo: 30, reserve: 60,
    x: -19, z: -8, crouch: true, smokeLineupId: 'mid-window', weaponReady: 0,
    nextSense: 20, nextThink: 20, goal: { x: -19, z: -8 }, path: [],
  });
  Object.assign(aliveT, { hp: 100, attacking: true, x: 25, z: -30 });
  fireSim.fires.push({
    id: 901, ownerId: aliveT.id, team: aliveT.team, x: -19, z: -8,
    startedAt: fireSim.time, expires: fireSim.time + 7, nextDamageAt: fireSim.time + 0.25, radius: LIVE_UTILITY_RULES.fireRadius,
  });
  fireSim.step(0.05);
  assert.equal(burnActor.crouch, false, 'Actor standing in molotov must stand up immediately');
  assert.equal(burnActor.smokeLineupId, undefined, 'Actor standing in molotov must abort smoke lineup');
  assert.equal(burnActor.action, 'Escaping molotov fire', 'Actor in molotov must actively escape flames');
  for (let i = 0; i < 25; i++) fireSim.step(0.05);
  assert.ok(distance(burnActor, fireSim.fires[0]) > fireSim.fires[0].radius, 'Actor should escape outside active molotov radius');

  // 3. Round break goals: skip downgraded starter pistols and knife-sprint to claim upgrades
  const postSim = createSim();
  Object.assign(postSim, { phase: 'post', remaining: 6, time: 40 });
  for (const a of postSim.actors) Object.assign(a, { hp: 0, nextThink: Infinity, nextSense: Infinity });
  const rifler = postSim.actors[0];
  const pistolUser = postSim.actors[1];
  Object.assign(rifler, {
    hp: 100, attacking: false, weapon: 'ak47', equipped: 'ak47', ammo: 30, reserve: 90,
    sidearmLoadout: { weapon: 'glock', ammo: 20, reserve: 120 }, x: -19, z: -8, goal: undefined, path: [], postRoamAt: 0,
  });
  Object.assign(pistolUser, {
    hp: 100, attacking: false, weapon: 'glock', equipped: 'glock', ammo: 20, reserve: 120,
    sidearmLoadout: { weapon: 'glock', ammo: 20, reserve: 120 }, x: -19, z: -8, goal: undefined, path: [], postRoamAt: 0,
  });
  postSim.droppedWeapons = [
    { id: 910, weapon: 'glock', ammo: 20, reserve: 120, x: -19, z: -6 },
    { id: 911, weapon: 'ak47', ammo: 30, reserve: 90, x: -19, z: -2 },
  ];
  let maxSpeed = 0;
  let sawKnife = false;
  for (let i = 0; i < 45; i++) {
    postSim.step(0.05);
    maxSpeed = Math.max(maxSpeed, pistolUser.speed);
    if (pistolUser.equipped === 'knife') sawKnife = true;
    assert.notEqual(rifler.action, 'Recovering Glock-18', 'Rifle holder must not chase non-upgrade starter pistol');
  }
  assert.equal(rifler.weapon, 'ak47', 'Rifle holder must keep primary AK-47');
  assert.equal(pistolUser.weapon, 'ak47', 'Pistol survivor should sprint and recover the dropped AK-47');
  assert.ok(sawKnife && maxSpeed > 2.2, `Round-break upgrade sprint should equip knife and move fast (maxSpeed=${maxSpeed.toFixed(2)})`);

  // 4. Bounded CS2 drop distance (<= 4.8m) and E-interact pickup (<= 2.35m)
  const dropSim = createSim();
  Object.assign(dropSim, { phase: 'live', time: 20, roundLiveAt: 10, liveElapsed: 5, remaining: 95 });
  for (const a of dropSim.actors) Object.assign(a, { hp: 0, nextThink: Infinity, nextSense: Infinity });
  const csDonor = dropSim.actors[5];
  const csMate = dropSim.actors[6];
  Object.assign(csDonor, {
    hp: 100, weapon: 'ak47', equipped: 'ak47', ammo: 30, reserve: 90,
    sidearmLoadout: { weapon: 'deagle', ammo: 7, reserve: 35 },
    x: -19, z: -8, seenAt: -100, damageAt: -100, lastDropAt: -100, lastShot: -100, weaponReady: 0, reload: 0, channel: 0, utilityPreparation: undefined, smokeLineupId: undefined,
  });
  Object.assign(csMate, {
    hp: 100, weapon: 'glock', equipped: 'glock', ammo: 20, reserve: 120,
    sidearmLoadout: { weapon: 'glock', ammo: 20, reserve: 120 },
    x: -19, z: -2, seenAt: -100, damageAt: -100, weaponReady: 0, reload: 0, channel: 0, utilityPreparation: undefined, smokeLineupId: undefined,
  });
  dropSim.stepLiveDrops(); completeHandoffs(dropSim);
  const droppedDeagle = dropSim.droppedWeapons.find((w) => w.weapon === 'deagle' && w.reservedFor === csMate.id);
  assert.ok(droppedDeagle, 'Healthy nearby mate should receive Deagle drop');
  const throwDist = distance(csDonor, droppedDeagle);
  assert.ok(throwDist <= 4.85, `Mid-round weapon drop throw distance must be bounded <= 4.8m, got ${throwDist.toFixed(2)}m`);
  dropSim.time += 1.0;
  Object.assign(csMate, { x: droppedDeagle.x, z: droppedDeagle.z - 2.1, yaw: 0 });
  dropSim.collectGroundEquipment();
  assert.equal(csMate.weapon, 'deagle', 'Teammate at E-interact range (~2.1m) should pick up the dropped Deagle');

  // 5. 1P & 3P AK-47 under-handguard support grip
  const engine = new NullEngine();
  const scene = new Scene(engine);
  new FreeCamera('pro11-cam', new Vector3(0, 2, -5), scene);
  const mats = new Map();
  const getMat = (hex) => {
    if (!mats.has(hex)) { const m = new StandardMaterial(hex, scene); mats.set(hex, m); }
    return mats.get(hex);
  };
  try {
    const vm = createViewmodelMesh('ak47', 'red', 'pro11-vm', scene, getMat, true);
    const palmL = vm.getChildMeshes().find((m) => m.name === 'pro11-vm-l-palm');
    const thumbL = vm.getChildMeshes().find((m) => m.name === 'pro11-vm-l-thumb');
    assert.ok(palmL && palmL.position.y < 0, '1P AK-47 left palm must support beneath the wood handguard (y < 0)');
    assert.ok(thumbL, '1P AK-47 viewmodel must include left support thumb wrapping the upper handguard');

    const op = createTacticalOperativeMesh('t', 'pro11-op', scene, getMat, 0);
    const gun = create3DWeaponMesh('ak47', 'pro11-gun', scene, getMat, false);
    const player = sim.actors[5];
    Object.assign(player, { hp: 100, weapon: 'ak47', equipped: 'ak47', x: 0, z: 0, jumpY: 0, yaw: 0, pitch: 0, crouch: false, stance: 'hold' });
    if (op.poseMemory) op.poseMemory.initialized = false;
    applyOperativeAnimation({ operative: op, force: 't', gunNode: gun, gunWeapon: 'ak47' }, player, 10, 1.0);
    scene.render(false, true);
    op.root.computeWorldMatrix(true);
    gun.computeWorldMatrix(true);
    const leftFore = op.leftElbowPivot;
    leftFore.computeWorldMatrix(true);
    const leftPalmWorld = Vector3.TransformCoordinates(new Vector3(0, -0.24, 0), leftFore.getWorldMatrix());
    const invGun = gun.getWorldMatrix().clone();
    invGun.invert();
    const leftPalmLocal = Vector3.TransformCoordinates(leftPalmWorld, invGun);
    assert.ok(leftPalmLocal.y < 0 && leftPalmLocal.z > 0.12, `3P AK-47 left palm must seat under forward barrel handguard (y=${leftPalmLocal.y.toFixed(3)}, z=${leftPalmLocal.z.toFixed(3)})`);
  } finally {
    scene.dispose();
    engine.dispose();
  }
});

test('Pro Regression 12: CS2 utility fuse timings, bounce-to-rest smokes, asymmetric burn durations, and wall-banked pop-flashes', () => {
  assert.equal(LIVE_UTILITY_FUSES.flashFuse, 1.5);
  assert.equal(LIVE_UTILITY_FUSES.heFuse, 1.5);
  assert.equal(LIVE_UTILITY_FUSES.fireAirFuse, 2.0);
  assert.equal(LIVE_UTILITY_FUSES.molotovDuration, 7.0);
  assert.equal(LIVE_UTILITY_FUSES.incendiaryDuration, 5.5);

  const sim = createSim();
  for (const a of sim.actors) Object.assign(a, { hp: 0, nextSense: Infinity, nextThink: Infinity });
  Object.assign(sim, { phase: 'live', remaining: 85, time: 15, roundLiveAt: 0 });
  const tThrower = sim.actors[5];
  const ctThrower = sim.actors[0];
  Object.assign(tThrower, { hp: 100, attacking: true, x: -19, z: -16, yaw: 0, jumpY: 0, smoke: 1, incendiary: 1, flash: 1 });
  Object.assign(ctThrower, { hp: 100, attacking: false, x: 19, z: 16, yaw: Math.PI, jumpY: 0, smoke: 1, incendiary: 1, flash: 1 });

  // 1. Smoke bounces/rolls until resting on support floor; never blooms while high in mid-air
  const smokeG = launchLiveGrenade(9101, 'smoke', tThrower.id, tThrower.team, { x: -19, z: -16 }, { x: -19, z: 6 }, sim.time, false, 'standard', 1.55);
  assert.ok(smokeG.detonateAt > sim.time + 0.8 && smokeG.detonateAt <= sim.time + LIVE_UTILITY_FUSES.smokeMaxFlight + 0.05);
  sim.grenades.push(smokeG);
  for (let i = 0; i < 12; i++) sim.step(); // 0.4s in: still airborne, zero smokes yet
  assert.equal(sim.smokes.length, 0, 'Smoke must not detonate mid-air');
  for (let i = 0; i < 120 && sim.smokes.length === 0; i++) sim.step();
  assert.equal(sim.smokes.length, 1, 'Smoke must bloom once settled on floor');

  // 2. Flash & HE use 1.5s fuse after release and flash can detonate mid-air
  const flashG = launchLiveGrenade(9102, 'flash', tThrower.id, tThrower.team, { x: -19, z: -10 }, { x: -19, z: 4 }, sim.time, false, 'overhead', 1.55, { x: 0, z: 0 }, 2.1);
  const heG = launchLiveGrenade(9103, 'he', tThrower.id, tThrower.team, { x: -19, z: -10 }, { x: -19, z: 4 }, sim.time, false, 'overhead', 1.55, { x: 0, z: 0 }, 2.1);
  assert.ok(Math.abs((flashG.detonateAt - flashG.releaseAt) - 1.5) < 1e-6, 'Flash fuse must be 1.5s');
  assert.ok(Math.abs((heG.detonateAt - heG.releaseAt) - 1.5) < 1e-6, 'HE fuse must be 1.5s');

  // 3. Asymmetric CS2 burn durations: T Molotov 7.0s vs CT Incendiary 5.5s + floor impact pop + 2.0s high airburst cap
  sim.grenades = []; sim.fires = [];
  const molly = launchLiveGrenade(9104, 'incendiary', tThrower.id, tThrower.team, { x: -19, z: -14 }, { x: -19, z: -4 }, sim.time, false, 'standard', 1.55);
  const inc = launchLiveGrenade(9105, 'incendiary', ctThrower.id, ctThrower.team, { x: 19, z: 14 }, { x: 19, z: 4 }, sim.time, false, 'standard', 1.55);
  assert.ok(molly.detonateAt - molly.releaseAt <= LIVE_UTILITY_FUSES.fireAirFuse + 1e-6, 'Molotov air fuse capped at 2.0s');
  sim.grenades.push(molly, inc);
  for (let i = 0; i < 65 && sim.fires.length < 2; i++) sim.step();
  assert.equal(sim.fires.length, 2, 'Both Molotov and Incendiary ignite upon hitting floor');
  const tFire = sim.fires.find((f) => f.team === tThrower.team);
  const ctFire = sim.fires.find((f) => f.team === ctThrower.team);
  assert.ok(tFire && ctFire);
  assert.ok(Math.abs((tFire.expires - tFire.startedAt) - 7.0) < 0.1, `T Molotov must burn 7.0s, got ${(tFire.expires - tFire.startedAt).toFixed(2)}`);
  assert.ok(Math.abs((ctFire.expires - ctFire.startedAt) - 5.5) < 0.1, `CT Incendiary must burn 5.5s, got ${(ctFire.expires - ctFire.startedAt).toFixed(2)}`);

  // Airburst: a fire grenade still > 2.2m above floor when hitting 2.0s expires harmlessly without floor fire
  sim.fires = []; sim.grenades = [];
  const highAirFire = {
    id: 9106, kind: 'incendiary', actorId: tThrower.id, team: tThrower.team,
    x: 0, y: 12.0, z: 0, vx: 0, vy: 8.0, vz: 0,
    releaseAt: sim.time, detonateAt: sim.time + 2.0, coordinated: false, throwStyle: 'overhead',
  };
  sim.grenades.push(highAirFire);
  sim.time += 2.02;
  sim.stepGrenades();
  assert.equal(sim.fires.length, 0, 'High airburst fire (>2.2m) at 2.0s must not ignite the ground below');

  // 4. Wall-banked pop-flash & busy-ally safety vs turn-away safety
  const blockedPop = solveLivePopFlash({ x: 19, z: -10 }, { x: 19, z: -2 }, 1.55, [{ x: 19, z: -6, yaw: 0 }]);
  assert.equal(blockedPop, undefined, 'Pop-flash solver must refuse to blind an exposed busy ally staring directly at the burst');
  const safePop = solveLivePopFlash({ x: 19, z: -10 }, { x: 19, z: -2 }, 1.55, [{ x: 19, z: -6, yaw: Math.PI }]);
  assert.ok(safePop, 'Pop-flash solver must solve when busy ally is turned away from the flash');
  assert.ok(Math.abs((safePop.forecast.detonateAt - safePop.forecast.releaseAt) - 1.5) < 1e-6);
  const bankedPop = solveLivePopFlash({ x: -19, z: 8 }, { x: -21, z: 20 }, 1.55, []);
  assert.ok(bankedPop?.isBankedPop, 'A-balcony pop-flash must find a true wall-banked / surprise air-pop trajectory');
  assert.ok(Math.abs((bankedPop.forecast.detonateAt - bankedPop.forecast.releaseAt) - 1.5) < 1e-6);

  // Unaware defender holding toward A-site behind the wall gets full flash blind (cannot dodge pre-pop)
  sim.grenades = []; sim.blasts = []; sim.smokes = [];
  const victim = sim.actors[0];
  const popYaw = Math.atan2(bankedPop.forecast.x + 21, bankedPop.forecast.z - 20);
  Object.assign(victim, {
    hp: 100, attacking: false, x: -21, z: 20, yaw: popYaw, jumpY: 0, blinded: 0, flashDodgeAt: undefined,
    watchPoint: { x: bankedPop.forecast.x, z: bankedPop.forecast.z },
    aimFocus: { point: { x: bankedPop.forecast.x, z: bankedPop.forecast.z }, eyeY: 1.58, source: 'contact', until: sim.time + 3, from: { x: -21, z: 20 } },
  });
  const throwPop = launchLiveGrenade(9107, 'flash', tThrower.id, tThrower.team, { x: -19, z: 8 }, bankedPop.aimTarget, sim.time, true, bankedPop.throwStyle, 1.55, { x: 0, z: 0 }, bankedPop.flightTime);
  sim.grenades.push(throwPop);
  for (let i = 0; i < 60 && sim.grenades.length > 0; i++) sim.step();
  assert.ok(victim.blinded > 1.2, `Victim staring into wall-banked 1.5s pop-flash must be blinded (>1.2s), got ${victim.blinded}`);
});

test('Pro Regression 13: Articulated 1P reload replaces static left hand without ghosting and weapon-families vary magazines', () => {
  const engine = new NullEngine();
  const scene = new Scene(engine);
  new FreeCamera('pro13-cam', new Vector3(0, 2, -5), scene);
  const mats = new Map();
  const getMat = (hex) => {
    if (!mats.has(hex)) { const m = new StandardMaterial(hex, scene); mats.set(hex, m); }
    return mats.get(hex);
  };
  try {
    const ak = createViewmodelMesh('ak47', 'red', 'pro13-ak', scene, getMat, true);
    const nova = createViewmodelMesh('nova', 'blue', 'pro13-nova', scene, getMat, false);
    const usp = createViewmodelMesh('usp_s', 'blue', 'pro13-usp', scene, getMat, false);

    const akMeta = ak.metadata;
    const novaMeta = nova.metadata;
    const uspMeta = usp.metadata;
    assert.ok(akMeta?.reloadParts?.wrist && akMeta.reloadParts.leftArmMeshes.length >= 4);
    assert.equal(akMeta.reloadParts.family, 'rifle_ak');
    assert.equal(novaMeta?.reloadParts?.family, 'shotgun_tube');
    assert.equal(uspMeta?.reloadParts?.family, 'pistol');
    assert.ok(novaMeta.reloadParts.magazine.name.includes('shell'), 'Nova viewmodel reload must use individual shotgun shell');

    // Verify 3P reload anchors magWell per weapon and omits dangling box magazine on tube-fed Nova
    const op = createTacticalOperativeMesh('ct', 'pro13-op', scene, getMat, 0);
    const sim = createSim();
    const ct = sim.actors[0];
    const gun = create3DWeaponMesh('usp_s', 'pro13-gun', scene, getMat, false);
    Object.assign(ct, { hp: 100, weapon: 'usp_s', equipped: 'usp_s', reload: 1.15, reloadDuration: 2.2, x: 0, z: 0, jumpY: 0, yaw: 0, pitch: 0 });
    applyOperativeAnimation({ operative: op, force: 'ct', gunNode: gun, gunWeapon: 'usp_s' }, ct, 10, 1.0);
    assert.equal(op.magazine.isEnabled(), true, 'USP-S mid-reload must show 3P magazine');
    Object.assign(ct, { weapon: 'nova', equipped: 'nova', reload: 1.15, reloadDuration: 2.4 });
    applyOperativeAnimation({ operative: op, force: 'ct', gunNode: gun, gunWeapon: 'nova' }, ct, 10, 1.0);
    assert.equal(op.magazine.isEnabled(), false, 'Tube-fed Nova must not display a box magazine on 3P reload');
  } finally {
    scene.dispose();
    engine.dispose();
  }
});

test('Pro Regression 14: Map architecture opens Image 1-4 alleys, East promenade, and eliminates b-coffins/b-screen overlap', () => {
  const coffins = LIVE_FPS_MAP.solids.find(s => s.id === 'b-coffins');
  const screen = LIVE_FPS_MAP.solids.find(s => s.id === 'b-screen');
  assert.ok(coffins && screen, 'b-coffins and b-screen solids must exist');
  const overlapsX = coffins.maxX > screen.minX && coffins.minX < screen.maxX;
  const overlapsZ = coffins.maxZ > screen.minZ && coffins.minZ < screen.maxZ;
  assert.equal(overlapsX && overlapsZ, false, 'b-coffins and b-screen must not overlap visually or physically');

  assert.equal(liveWalkable({ x: 14.6, z: 22.95 }), true, 'Image 1 flower-shop alley between b-market-west-house and b-coffins must be walkable');
  const alleyPath = findLivePath({ x: 10, z: 23 }, { x: 18, z: 23 });
  assert.ok(alleyPath.length > 0 && livePathLength({ x: 10, z: 23 }, { x: 18, z: 23 }) < 12, 'Image 1 flower-shop alley must route smoothly');

  assert.equal(liveWalkable({ x: -34, z: 12 }), true, 'A west lane beside a-generator must be walkable');
  assert.equal(liveWalkable({ x: -30, z: 14 }), true, 'Courtyard south of a-pit-revetment must be walkable');
  const pitRoute = findLivePath({ x: -30, z: 14 }, { x: -28, z: 24 });
  assert.ok(pitRoute.length > 0 && livePathLength({ x: -30, z: 14 }, { x: -28, z: 24 }) < 18, 'A-courtyard past a-pit-revetment must route directly without canal detour');

  assert.equal(liveWalkable({ x: 29, z: -2 }), true, 'East promenade walkway must be walkable');
  assert.ok(findLivePath({ x: 24, z: 6 }, { x: 29, z: -2 }).length > 0, 'East promenade must connect cleanly to street grid');
  assert.ok(findLivePath({ x: 28, z: 6 }, { x: 22, z: 6 }).length > 0, 'Market-canal strip must connect to market plaza');
});

test('Pro Regression 15: Actors crouch-jump onto climbable box perches (a-pit-revetment) and step off cleanly when routing away', () => {
  const pitBench = LIVE_JUMPABLE_PERCHES.find(p => p.id === 'a-pit-revetment');
  assert.ok(pitBench && pitBench.approaches.length >= 2, 'Picture 4 a-pit-revetment must be discovered as a climbable perch');
  const sim = createSim();
  Object.assign(sim, { phase: 'live', remaining: 90, time: 20, roundLiveAt: 10 });
  for (const a of sim.actors) Object.assign(a, { hp: 0, nextSense: Infinity, nextThink: Infinity, nextShot: Infinity });
  const dummyT = sim.actors[5];
  Object.assign(dummyT, { hp: 100, attacking: true, x: -20, z: -38, jumpY: 0, jump: false, speed: 0, vx: 0, vz: 0 });
  const holder = sim.actors[0];
  const approach = pitBench.approaches[0];
  Object.assign(holder, {
    hp: 100, attacking: false, weapon: 'm4a1_s', equipped: 'm4a1_s',
    x: approach.x, z: approach.z, jumpY: 0, jump: false, jumpVy: 0, crouch: false,
    speed: 0, vx: 0, vz: 0, perchGoal: pitBench, goal: { ...approach }, path: [{ ...approach }],
    watchPoint: { x: -20, z: 20 }, yaw: 0, reload: 0, channel: 0, bomb: false,
  });
  let crouchedDuringClimb = false;
  for (let i = 0; i < 120; i++) {
    sim.step();
    if (holder.jump && holder.crouch) crouchedDuringClimb = true;
    if (!holder.jump && holder.jumpY >= pitBench.height - .05) break;
  }
  assert.equal(crouchedDuringClimb, true, 'Climbing a-pit-revetment must execute a crouch-jump');
  assert.ok(!holder.jump && holder.jumpY >= pitBench.height - .05, `Actor must land and stand atop a-pit-revetment (${pitBench.height}m), got jumpY=${holder.jumpY.toFixed(2)}`);

  // Redirecting away from the perch must route down via an approach exit rather than getting stuck inside the solid.
  Object.assign(holder, { perchGoal: undefined, nextThink: sim.time });
  sim.bomb = { status: 'planted', site: 'B', x: 20, z: 24, remaining: 25 };
  sim.step();
  assert.ok(holder.path.length > 0, 'Leaving a box perch must produce a valid step-down exit path');
  for (let i = 0; i < 150 && holder.jumpY > .1; i++) sim.step();
  assert.ok(holder.jumpY < .1, `Actor leaving box perch must step cleanly back to street ground, got jumpY=${holder.jumpY.toFixed(2)}`);
});

test('Pro Regression 16: Bomb defuse emits audio cues and Ts legally spam bomb smoke or knife-rush without wallhacks', () => {
  const sim = createSim();
  Object.assign(sim, { phase: 'live', remaining: 90, time: 30, roundLiveAt: 10, attackTeam: 'red' });
  for (const a of sim.actors) Object.assign(a, { hp: 0, bomb: false, nextSense: Infinity, nextThink: Infinity, nextShot: Infinity });
  const defuser = sim.actors[0]; // blue CT
  const spammer = sim.actors[5]; // red T rifle
  const rusher = sim.actors[6];  // red T close knife rush (sniper/low ammo)
  const farT = sim.actors[7];    // red T out of hearing range

  const smoke = { id: 9901, x: 20, y: 0, z: 24, radius: 3.8, startedAt: 28, expires: 48 };
  sim.smokes = [smoke];
  sim.bomb = { status: 'planted', site: 'B', x: 20, z: 24, remaining: 20 };

  Object.assign(defuser, {
    hp: 100, attacking: false, kit: false, x: 20.1, z: 24.0, jumpY: 0, jump: false, crouch: true,
    speed: 0, vx: 0, vz: 0, weapon: 'm4a1_s', equipped: 'm4a1_s', ammo: 20, reserve: 40, smoke: 0, channel: 0,
    knownSmokes: [smoke], goal: { x: 20.1, z: 24.0 }, path: [], nextThink: Infinity, nextSense: Infinity,
  });
  Object.assign(spammer, {
    hp: 100, attacking: true, role: 'entry', weapon: 'ak47', equipped: 'ak47', ammo: 25, reserve: 60,
    x: 26.2, z: 25.2, jumpY: 0, jump: false, crouch: false, speed: 0, vx: 0, vz: 0,
    yaw: Math.atan2(20 - 26.2, 24 - 25.2), nextSense: sim.time, nextThink: sim.time, nextShot: sim.time,
    knownSmokes: [smoke], goal: { x: 26.2, z: 25.2 }, path: [],
  });
  Object.assign(rusher, {
    hp: 100, attacking: true, role: 'sniper', weapon: 'sniper', equipped: 'sniper', ammo: 2, reserve: 10,
    x: 20.0, z: 27.6, jumpY: 0, jump: false, crouch: false, speed: 0, vx: 0, vz: 0,
    yaw: Math.PI, nextSense: sim.time, nextThink: sim.time, nextShot: sim.time,
    knownSmokes: [smoke], goal: { x: 20.0, z: 27.6 }, path: [],
  });
  Object.assign(farT, {
    hp: 100, attacking: true, role: 'lurker', weapon: 'ak47', equipped: 'ak47', ammo: 30, reserve: 60,
    x: -24, z: -24, jumpY: 0, jump: false, speed: 0, vx: 0, vz: 0, nextSense: Infinity, nextThink: Infinity,
  });

  sim.audioCues = [];
  sim.step();
  const startCue = sim.audioCues.find(c => c.kind === 'bombDefuse' && c.phase === 'start');
  assert.ok(startCue, 'Starting bomb defuse must emit a bombDefuse start audio cue');
  assert.ok(spammer.heardDefuseAt !== undefined && rusher.heardDefuseAt !== undefined, 'Nearby Ts must be alerted to bomb defuse sound');
  assert.equal(farT.heardDefuseAt, undefined, 'Distant T outside hearing range must not receive bomb defuse cue');

  let spammedSmoke = false;
  let equippedKnifeInSmokeCharge = false;
  let slashedOrDamagedDefuser = false;
  for (let i = 0; i < 160; i++) {
    sim.step();
    if (spammer.ammo < 25) spammedSmoke = true;
    if (rusher.equipped === 'knife') equippedKnifeInSmokeCharge = true;
    if (defuser.hp < 100) slashedOrDamagedDefuser = true;
  }
  assert.equal(spammedSmoke, true, `T with rifle hearing smoked defuse must spam rounds into the planted bomb smoke (ammo=${spammer.ammo})`);
  assert.equal(equippedKnifeInSmokeCharge, true, 'Close/blocked T countering smoked defuse must equip knife to charge bomb smoke');
  assert.equal(slashedOrDamagedDefuser || distance(rusher, sim.bomb) < LIVE_KNIFE.reach + .9, true, 'Countering Ts must close onto the smoked bomb and strike the sneaky defuser');
});
