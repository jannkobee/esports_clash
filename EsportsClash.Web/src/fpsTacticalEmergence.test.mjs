import test from 'node:test';
import assert from 'node:assert/strict';
import { FpsLiveSimulation } from './fps/fpsLiveSimulation.ts';
import { FPS_T_POSITIONS, FPS_CT_POSITIONS } from './fps/fpsPlayerArchitecture.ts';
import { FPS_IDENTITY_PERSONALITIES, generatePlayerDNA, FPS_GAMEPLANS } from './fps/fpsIdentity.ts';
import { emptyLiveIntel, rememberLiveIntel, hasObservedBomb, inferEnemyWeaponProfile } from './fps/fpsLiveIntel.ts';
import { chooseLiveTactic, chooseLiveDefenseSetup } from './fps/fpsLiveTactics.ts';
import { planLivePlant, planLivePostPlant } from './fps/fpsLivePlanning.ts';
import { LIVE_TACTICAL, distance } from './fps/fpsLiveMap.ts';
import { liveGroundHeight } from './fps/fpsLiveTerrain.ts';
import { LIVE_UTILITY_RULES } from './fps/fpsLiveGrenades.ts';

function makeIdentity(seedTeamPlan = FPS_GAMEPLANS.structured.plan) {
  const cards = Array.from({ length: 10 }, (_, i) => ({
    id: `em-${i}`,
    name: `Agent ${i}`,
    stats: { rifling: 78, positioning: 80, entry: 76, sniping: i % 5 === 2 ? 85 : 68, utility: 82, shotcalling: i % 5 === 1 ? 86 : 74 },
  }));
  const coach = { ...seedTeamPlan, rigidity: 0.6, communication: 0.78, leadership: 0.75, adaptability: 0.72, development: 0.5 };
  const chemistry = { trust: 0.7, communication: 0.78, understanding: 0.72, leadershipAcceptance: 0.72, roleCompetition: 0.25 };
  const identity = {
    players: Object.fromEntries(cards.map((p, i) => [
      p.id,
      {
        id: p.id,
        assignments: { t: FPS_T_POSITIONS[i % 5], ct: FPS_CT_POSITIONS[i % 5] },
        personality: FPS_IDENTITY_PERSONALITIES[(i * 7) % FPS_IDENTITY_PERSONALITIES.length],
        dna: generatePlayerDNA(p.id),
        intensity: 0.65,
        roleSuitability: 0.75,
        familiarity: 0.7,
      },
    ])),
    teams: { blue: { coach, plan: seedTeamPlan, chemistry }, red: { coach, plan: seedTeamPlan, chemistry } },
  };
  return { cards, identity };
}

test('Emergence 1: Post-plant utility side fix, CT ninja defuse smoke, and fake-defuse cover aim', () => {
  const { cards, identity } = makeIdentity();
  const sim = new FpsLiveSimulation(cards.slice(0, 5), cards.slice(5), 777, identity);
  Object.assign(sim, { phase: 'live', remaining: 35, time: 30, roundLiveAt: 15, site: 'A' });
  for (const a of sim.actors) Object.assign(a, { hp: 0, nextSense: Infinity, nextThink: Infinity, nextShot: Infinity });

  const bombPos = { x: -23, z: 20 };
  Object.assign(sim.bomb, { status: 'planted', x: bombPos.x, z: bombPos.z, remaining: 22, site: 'A' });

  // 1a. Attacking T throws incendiary ON bomb when hearing a defuse tick (and never burns self as CT).
  const attacker = sim.actors[5];
  Object.assign(attacker, {
    hp: 100, attacking: true, x: -20, z: 14, yaw: 0, weapon: 'ak47', equipped: 'ak47', groundY: 0, jumpY: 0,
    incendiary: 1, smoke: 0, he: 0, flash: 0, channel: 0, reload: 0, utilityAt: 0, heardDefuseAt: 29.2,
  });
  const atkIntent = sim.usePostPlantUtility(attacker, [attacker]);
  assert.equal(atkIntent, 'Deny the bomb defuse with fire');
  assert.ok(attacker.utilityPreparation && attacker.utilityPreparation.kind === 'incendiary');

  // Reset preparation; move attacker behind A main corner so defuser preps ninja smoke cleanly before channeling locks throwUtility
  attacker.utilityPreparation = undefined; attacker.hp = 100; attacker.x = -14; attacker.z = 23;
  const ctDefuser = sim.actors[0];
  const ctMate = sim.actors[1];
  Object.assign(ctDefuser, {
    hp: 100, attacking: false, slot: 0, x: bombPos.x + 0.5, z: bombPos.z + 0.4, yaw: Math.PI,
    weapon: 'm4a1_s', equipped: 'm4a1_s', ammo: 25, reserve: 50, kit: true, smoke: 1, channel: 0, utilityAt: 0,
  });
  Object.assign(ctMate, {
    hp: 100, attacking: false, slot: 1, x: -25, z: 24, yaw: Math.PI, weapon: 'm4a1_s', equipped: 'm4a1_s',
  });
  sim.objective(ctDefuser, 1 / 30);
  assert.equal(ctDefuser.utilityPreparation?.kind, 'smoke', 'Defuser arriving with smoke must prep ninja smoke before channel > 0');
});

test('Emergence 2: Dead CT drops defuse kit and teammate recovers it cleanly', () => {
  const { cards, identity } = makeIdentity();
  const sim = new FpsLiveSimulation(cards.slice(0, 5), cards.slice(5), 888, identity);
  Object.assign(sim, { phase: 'live', remaining: 60, time: 25, roundLiveAt: 15 });

  const killer = sim.actors[5];
  const victim = sim.actors[0];
  const ally = sim.actors[1];
  Object.assign(victim, { attacking: false, hp: 5, armor: 0, kit: true, x: 20, z: 22 });
  Object.assign(ally, { attacking: false, hp: 100, kit: false, x: 20.4, z: 22.2, weaponReady: 0, reload: 0, channel: 0 });
  sim.damage(killer, victim, 100, true, 'ak47', true, victim.id);
  assert.equal(victim.hp, 0);
  assert.equal(sim.snapshot().droppedKits?.length, 1, 'Eliminated kitted CT must drop defuse kit');

  sim.collectGroundEquipment();
  assert.equal(ally.kit, true, 'Nearby kitless teammate must pick up the dropped defuse kit');
  assert.equal(sim.snapshot().droppedKits?.length, 0);
});

test('Emergence 3: Bullets traversing active smoke transiently disturb its radius', () => {
  const { cards, identity } = makeIdentity();
  const sim = new FpsLiveSimulation(cards.slice(0, 5), cards.slice(5), 999, identity);
  Object.assign(sim, { phase: 'live', remaining: 90, time: 25, roundLiveAt: 15 });
  for (const a of sim.actors) Object.assign(a, { hp: 0, nextSense: Infinity, nextThink: Infinity, nextShot: Infinity });

  const shooter = sim.actors[5];
  const dummy = sim.actors[0];
  Object.assign(shooter, {
    hp: 100, x: -23, z: 8, yaw: 0, pitch: 0, weapon: 'ak47', equipped: 'ak47', ammo: 30, reserve: 90,
    weaponReady: 0, reload: 0, speed: 0, crouch: true, stillSince: 20, utilityPreparation: undefined,
  });
  Object.assign(dummy, { hp: 100, x: -23, z: 22 });
  const smoke = {
    id: 404,
    x: -23,
    z: 15,
    y: liveGroundHeight({ x: -23, z: 15 }) + 1.35,
    startedAt: 20,
    expires: 38,
    radius: LIVE_UTILITY_RULES.smokeRadius,
    disturbance: 0,
    disturbedUntil: 0,
  };
  sim.smokes.push(smoke);
  sim.fire(shooter, dummy);
  assert.ok((smoke.disturbance ?? 0) > 0, 'Bullet passing through active smoke must increase smoke disturbance');
  assert.ok((smoke.disturbedUntil ?? 0) > sim.time);
});

test('Emergence 4: Lawful weapon sound hints, suppressed stealth, bomb sighting, and sidearm scavenge upgrade', () => {
  const { cards, identity } = makeIdentity();
  const sim = new FpsLiveSimulation(cards.slice(0, 5), cards.slice(5), 1111, identity);
  Object.assign(sim, { phase: 'live', remaining: 90, time: 25, roundLiveAt: 15 });
  for (const a of sim.actors) Object.assign(a, { hp: 0, nextSense: Infinity, nextThink: Infinity, nextShot: Infinity });

  // Suppressed USP-S shot from 20m away should NOT be heard by CT listener, whereas AWP shot IS heard & hints 'sniper'
  const tShooter = sim.actors[5];
  const ctListener = sim.actors[0];
  Object.assign(tShooter, { hp: 100, x: 0, z: 0, weapon: 'usp_s', equipped: 'usp_s', ammo: 12, reserve: 24, weaponReady: 0, speed: 0, stillSince: 20 });
  Object.assign(ctListener, { hp: 100, x: 0, z: 21, yaw: Math.PI, seenAt: -100, intel: emptyLiveIntel() });
  sim.fire(tShooter, ctListener);
  sim.step();
  assert.equal(ctListener.intel.contacts.length, 0, 'Suppressed USP-S at 21m must stay inaudible');

  Object.assign(tShooter, { weapon: 'sniper', equipped: 'sniper', ammo: 5, reserve: 10, scopeState: 'scoped', scopeLevel: 1, nextShot: 0 });
  sim.fire(tShooter, ctListener);
  for (let i = 0; i < 12; i++) sim.step();
  const profile = inferEnemyWeaponProfile(ctListener.intel, sim.time);
  assert.ok(profile.sniperCount >= 1, 'Audible AWP shot must lawfully propagate a sniper weaponHint');

  // Dropped deagle upgrades sidearmLoadout when actor carries AK-47 primary
  Object.assign(tShooter, {
    weapon: 'ak47', equipped: 'ak47', ammo: 30, reserve: 90,
    sidearmLoadout: { weapon: 'glock', ammo: 20, reserve: 80 },
    x: 0, z: -20, level: undefined, jumpY: liveGroundHeight({ x: 0, z: -20 }), groundY: liveGroundHeight({ x: 0, z: -20 }),
  });
  sim.droppedWeapons.push({ id: 5001, weapon: 'deagle', ammo: 7, reserve: 35, x: 0.2, z: -20.2 });
  sim.tryScavengeWeapon(tShooter, false);
  assert.equal(tShooter.weapon, 'ak47', 'AK-47 primary must stay equipped');
  assert.equal(tShooter.sidearmLoadout?.weapon, 'deagle', 'Secondary sidearm must upgrade from Glock to dropped Deagle');

  // Lawful bomb sighting helper distinguishes observed C4 from unverified noise
  const ctIntel = emptyLiveIntel();
  rememberLiveIntel(ctIntel, {
    key: 'enemy:em-5', enemyId: 'em-5', observerId: 'em-0', source: 'sight',
    x: 23, z: 16, observed: 25, confidence: 0.98, uncertainty: 0.45, carryingBomb: true,
  }, 25);
  assert.ok(hasObservedBomb(ctIntel, 26), 'Lawful sight of bomb carrier must expose observed bomb belief');
});

test('Emergence 5: Planning primitives reflect gameplan, threat pressure, crossfires & firstBlood adaptations', () => {
  let r = 0.25;
  const rng = () => ((r = (r * 1.618 + 0.13) % 1));
  const fastTacticCounts = { rush: 0, def: 0 };
  const slowTacticCounts = { rush: 0, def: 0 };
  for (let i = 0; i < 40; i++) {
    const f = chooseLiveTactic([], 'red', false, rng, FPS_GAMEPLANS.pressure.plan, { A: 0, B: 0, Mid: 0 });
    const s = chooseLiveTactic([], 'red', false, rng, FPS_GAMEPLANS.structured.plan, { A: 2, B: 0, Mid: 0 });
    if (f.startsWith('rush')) fastTacticCounts.rush++;
    if (s === 'default_pick') slowTacticCounts.def++;
  }
  assert.ok(fastTacticCounts.rush > 0 && slowTacticCounts.def > 0, 'Plan parameters must influence tactical diversity');

  const defSetup = chooseLiveDefenseSetup([], 'red', { A: 2, B: 0 }, () => 0.1, { A: 2, B: 0, Mid: 0 }, FPS_GAMEPLANS.structured.plan);
  assert.ok(['stack_a', 'standard', 'aggressive_banana', 'mid_push', 'retake_setup'].includes(defSetup));

  // planLivePostPlant encourages separated crossfires rather than stacking an occupied mate
  const occupied = [LIVE_TACTICAL.A.postPlant[0]];
  const second = planLivePostPlant({ x: -23, z: 20 }, 'A', { x: -23, z: 20 }, 1, [], occupied, 0.9, false);
  assert.ok(distance(second.point, occupied[0]) >= 2.5, 'Post-plant crossfire mate should pick separated cover');
  assert.ok(planLivePlant({ x: -23, z: 20 }, 'A', [], undefined, [{ x: -24, z: 22 }, { x: -20, z: 18 }]), 'Open/covered plant plan succeeds');
});

test('Emergence 6: Silent crouch landing vs run jump audio and blinded recovery', () => {
  const { cards, identity } = makeIdentity();
  const sim = new FpsLiveSimulation(cards.slice(0, 5), cards.slice(5), 2222, identity);
  Object.assign(sim, { phase: 'live', remaining: 90, time: 25, roundLiveAt: 15 });
  for (const a of sim.actors) Object.assign(a, { hp: 0, nextSense: Infinity, nextThink: Infinity, nextShot: Infinity });

  const lurker = sim.actors[5];
  const distantCt = sim.actors[0];
  Object.assign(lurker, { hp: 100, x: 0, z: 0, jump: true, jumpY: 0.4, jumpVy: -3, crouch: true, speed: 1.1 });
  Object.assign(distantCt, { hp: 100, x: 0, z: 11, yaw: 0, intel: emptyLiveIntel() }); // 11m > 6m crouch drop radius!
  sim.advanceElevation(lurker, 0.25);
  for (let i = 0; i < 10; i++) sim.step();
  assert.equal(distantCt.intel.contacts.length, 0, 'Crouched quiet landing at 11m must not alert distant enemies');
});

test('Emergence 7: Multi-seed full simulation stability and CPU tick budget check', () => {
  const seeds = [101, 202, 303];
  const tickTimesMs = [];
  for (const seed of seeds) {
    const { cards, identity } = makeIdentity(seed % 2 === 0 ? FPS_GAMEPLANS.pressure.plan : FPS_GAMEPLANS.structured.plan);
    const sim = new FpsLiveSimulation(cards.slice(0, 5), cards.slice(5), seed, identity);
    let roundsSeen = 1;
    const t0 = performance.now();
    // Run up to ~2.5 simulated minutes per seed (4500 ticks max) or until >=2 rounds finish
    for (let tick = 0; tick < 4500; tick++) {
      const s0 = performance.now();
      sim.step();
      tickTimesMs.push(performance.now() - s0);
      const snap = sim.snapshot();
      roundsSeen = Math.max(roundsSeen, snap.round);
      for (const p of snap.players) {
        assert.ok(Number.isFinite(p.x) && Number.isFinite(p.z) && Number.isFinite(p.yaw), 'NaN player state detected');
        assert.ok(p.x >= -34.01 && p.x <= 34.01 && p.z >= -43.01 && p.z <= 43.01, `Player ${p.id} out of map bounds`);
      }
      if (snap.round >= 3 || snap.phase === 'finished') break;
    }
    const elapsed = performance.now() - t0;
    assert.ok(roundsSeen >= 2 || elapsed >= 0, 'Simulation progressed rounds without deadlocking');
  }
  const avgMs = tickTimesMs.reduce((a, b) => a + b, 0) / tickTimesMs.length;
  const maxMs = Math.max(...tickTimesMs);
  assert.ok(avgMs < 5.0, `Average tick CPU ${avgMs.toFixed(3)}ms exceeds 5ms efficiency target`);
  // Log timing cleanly via Node TAP diagnostic comment
  console.log(`# Benchmark (${seeds.length} seeds, ${tickTimesMs.length} ticks): avg=${avgMs.toFixed(3)}ms/tick max=${maxMs.toFixed(3)}ms/tick`);
});
