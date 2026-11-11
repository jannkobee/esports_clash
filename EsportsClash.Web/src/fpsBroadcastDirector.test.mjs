import test from 'node:test';
import assert from 'node:assert/strict';
import {
  PLANT_CHANNEL_DURATION,
  PLANT_SETTLE_WINDOW,
  THIRD_PERSON_BACK_OFFSET,
  THIRD_PERSON_LOOK_AHEAD,
  computeBombPlantPipPose,
  computeThirdPersonCameraPose,
  createDirectorState,
  domRectToBabylonViewport,
  evaluateBroadcastDirector,
  selectBombPlantPip,
} from './fps/fpsBroadcastDirector.ts';
import { FPS_IDENTITY_PERSONALITIES, generatePlayerDNA } from './fps/fpsIdentity.ts';
import { LIVE_FPS_MAP } from './fps/fpsLiveMap.ts';
import { FpsLiveSimulation } from './fps/fpsLiveSimulation.ts';
import { segmentHitsWall } from './fps/fpsSpatialWorld.ts';

const plan = { tempo: 0.6, structure: 0.7, aggression: 0.5, preparation: 0.7, freedom: 0.5, economy: 0.8 };
const coach = { ...plan, rigidity: 0.7, communication: 0.7, leadership: 0.7, adaptability: 0.7, development: 0.5 };
const chemistry = { trust: 0.6, communication: 0.6, understanding: 0.6, leadershipAcceptance: 0.6, roleCompetition: 0.3 };
const cards = Array.from({ length: 10 }, (_, i) => ({
  id: `dir-${i}`,
  name: `Op ${i}`,
  stats: { lan: 80, iq: 80, tf: 80, clu: 80, sta: 80, flx: 80, ldr: 80 },
}));
const identity = {
  players: Object.fromEntries(
    cards.map((p, i) => [
      p.id,
      {
        id: p.id,
        personality: FPS_IDENTITY_PERSONALITIES[i],
        dna: generatePlayerDNA(p.id),
        intensity: 0.6,
        roleSuitability: 0.6,
        familiarity: 0.5,
      },
    ]),
  ),
  teams: {
    blue: { coach, plan, chemistry },
    red: { coach, plan, chemistry },
  },
};

function makeLiveSnapshot(time = 35) {
  const sim = new FpsLiveSimulation(cards.slice(0, 5), cards.slice(5), 2026, identity);
  const snap = sim.snapshot();
  snap.phase = 'live';
  snap.time = time;
  snap.remaining = 80;
  // Place everyone cleanly out of each other's direct sightlines by default (behind walls / lanes).
  const blueSpots = [
    { x: -24, z: 38, yaw: Math.PI },
    { x: -12, z: 36, yaw: Math.PI },
    { x: 0, z: 39, yaw: Math.PI },
    { x: 18, z: 38, yaw: Math.PI },
    { x: 28, z: 36, yaw: Math.PI },
  ];
  const redSpots = [
    { x: -24, z: -32, yaw: 0 },
    { x: -16, z: -34, yaw: 0 },
    { x: 0, z: -36, yaw: 0 },
    { x: 16, z: -34, yaw: 0 },
    { x: 24, z: -32, yaw: 0 },
  ];
  snap.players.forEach((p, idx) => {
    const pos = p.team === 'blue' ? blueSpots[idx % 5] : redSpots[idx % 5];
    p.x = pos.x;
    p.z = pos.z;
    p.yaw = pos.yaw;
    p.hp = 100;
    p.action = 'Advancing';
    p.channel = 0;
    p.bomb = p.team === snap.attackTeam && idx % 5 === 0;
    p.lastShot = -100;
  });
  return snap;
}

test('bomb-plant PIP activates strictly on bomb plants and brief planted confirmation, never defuses or fights', () => {
  const state = createDirectorState();
  const snap = makeLiveSnapshot(40);

  // Idle live play -> inactive
  assert.equal(selectBombPlantPip(snap, state).active, false);

  // Active combat -> inactive
  snap.players[0].action = 'Engaging';
  snap.players[0].lastShot = snap.time - 0.1;
  assert.equal(selectBombPlantPip(snap, state).active, false);

  // CT Defusing -> MUST stay inactive
  const ct = snap.players.find((p) => !p.attacking);
  ct.action = 'Defusing';
  ct.channel = 2.4;
  snap.bomb = { status: 'planted', x: 23, z: 21, remaining: 22, site: 'B' };
  const stateDefuse = createDirectorState();
  assert.equal(selectBombPlantPip(snap, stateDefuse).active, false);

  // Settling to plant -> active
  const s2 = createDirectorState();
  const live = makeLiveSnapshot(42);
  const planter = live.players.find((p) => p.attacking);
  planter.bomb = true;
  planter.x = -23;
  planter.z = 21;
  planter.action = 'Settling to plant';
  planter.channel = 0;
  let pip = selectBombPlantPip(live, s2);
  assert.equal(pip.active, true);
  assert.equal(pip.phase, 'settling');
  assert.equal(pip.site, 'A');
  assert.equal(pip.planterId, planter.id);

  // Planting progress -> active with ratio
  live.time = 43.6;
  planter.action = 'Planting';
  planter.channel = PLANT_CHANNEL_DURATION * 0.5;
  pip = selectBombPlantPip(live, s2);
  assert.equal(pip.active, true);
  assert.equal(pip.phase, 'planting');
  assert.ok(Math.abs(pip.progress - 0.5) < 0.01);

  // Plant completed -> brief confirmation beat, then auto-closes after settle window
  live.time = 45.2;
  planter.bomb = false;
  planter.channel = 0;
  planter.action = 'Holding post-plant';
  live.bomb = { status: 'planted', x: -23, z: 21, remaining: 40, site: 'A' };
  live.events.push({
    id: 500,
    time: 45.2,
    kind: 'objective',
    team: planter.team,
    actorId: planter.id,
    text: `${planter.name} planted at A`,
  });
  pip = selectBombPlantPip(live, s2);
  assert.equal(pip.active, true);
  assert.equal(pip.phase, 'planted');
  assert.equal(pip.site, 'A');

  live.time = 45.2 + PLANT_SETTLE_WINDOW + 0.1;
  pip = selectBombPlantPip(live, s2);
  assert.equal(pip.active, false);
});

test('main director camera prioritizes kills and never dwells on an active bomb planter', () => {
  const state = createDirectorState();
  const snap = makeLiveSnapshot(50);

  const attackers = snap.players.filter((p) => p.attacking);
  const defenders = snap.players.filter((p) => !p.attacking);
  const planter = attackers[0];
  const entry = attackers[1];
  const anchor = defenders[0];

  // Planter sits on A planting while entry + anchor are in direct sightline gunfight in Mid
  planter.bomb = true;
  planter.x = -23;
  planter.z = 21;
  planter.action = 'Planting';
  planter.channel = 2.1;

  entry.x = 0;
  entry.z = -1;
  entry.yaw = 0;
  entry.action = 'Engaging';
  entry.lastShot = 49.9;

  anchor.x = 0;
  anchor.z = 9;
  anchor.yaw = Math.PI;
  anchor.action = 'Engaging';
  anchor.hp = 35;

  // Seed initial focus onto planter to prove immediate escape
  state.followedId = planter.id;
  state.cutAt = 49.5;

  const decision = evaluateBroadcastDirector(snap, state, 'director', snap.players[0].id);
  assert.notEqual(decision.followedId, planter.id);
  assert.ok(decision.followedId === entry.id || decision.followedId === anchor.id);
  assert.equal(decision.effectiveMode, 'first');
  assert.equal(decision.pip.active, true);
  assert.equal(decision.pip.planterId, planter.id);

  // When observed player dies to another enemy, main camera snaps immediately to the living killer
  const currentObs = snap.players.find((p) => p.id === decision.followedId);
  const killer = defenders[1];
  killer.hp = 85;
  killer.kills += 1;
  currentObs.hp = 0;
  snap.time = 50.2;
  snap.events.push({
    id: 900,
    time: 50.2,
    kind: 'kill',
    team: killer.team,
    actorId: killer.id,
    targetId: currentObs.id,
    headshot: true,
    weapon: killer.weapon,
    text: `${killer.name} eliminated ${currentObs.name}`,
  });

  const killHandoff = evaluateBroadcastDirector(snap, state, 'director', snap.players[0].id);
  assert.equal(killHandoff.followedId, killer.id);
});

test('director camera uses close-back third-person for quiet navigation and overview for freeze/post settle', () => {
  const state = createDirectorState();
  const snap = makeLiveSnapshot(20);
  snap.phase = 'freeze';
  assert.equal(evaluateBroadcastDirector(snap, state, 'director', snap.players[0].id).effectiveMode, 'overview');

  snap.phase = 'live';
  snap.time = 25;
  const liveQuiet = evaluateBroadcastDirector(snap, state, 'director', snap.players[0].id);
  assert.equal(liveQuiet.effectiveMode, 'third');
  assert.equal(liveQuiet.pip.active, false);

  // Brief post-round kill beat in first person, then pulls back to overview
  snap.phase = 'post';
  snap.time = 26;
  state.lastKillCutAt = 25.5;
  assert.equal(evaluateBroadcastDirector(snap, state, 'director', snap.players[0].id).effectiveMode, 'first');
  snap.time = 27.6;
  assert.equal(evaluateBroadcastDirector(snap, state, 'director', snap.players[0].id).effectiveMode, 'overview');
});

test('solidified 3rd-person camera sits close on the model back and respects walls', () => {
  const snap = makeLiveSnapshot(30);
  const p = snap.players[0];
  p.x = 0;
  p.z = -20;
  p.yaw = 0;
  p.crouch = false;
  p.jumpY = 0;

  const openPose = computeThirdPersonCameraPose(p);
  const horizDist = Math.hypot(openPose.position.x - p.x, openPose.position.z - p.z);
  assert.ok(horizDist <= THIRD_PERSON_BACK_OFFSET + 0.15, `expected shoulder camera within ${THIRD_PERSON_BACK_OFFSET + .15}m, got ${horizDist.toFixed(2)}m`);
  assert.ok(horizDist >= 1.2, `expected non-clipping back distance >= 1.2m, got ${horizDist.toFixed(2)}m`);
  assert.ok(openPose.position.z < p.z, 'camera should be behind facing +Z player');
  assert.ok(Math.abs(openPose.target.z-p.z-THIRD_PERSON_LOOK_AHEAD)<1e-6, 'camera should use the authored downrange look-ahead');

  // Near south-wall (minZ = -47..maxZ = -46) or west wall container, camera pulls forward without intersecting solid
  p.x = 0;
  p.z = -18.5;
  // Mid-approach-screen is at (0, -25) 4x3; place player right in front of mid-backstop (0, 18.5) 6x3 (z in [17, 20])
  p.x = 0;
  p.z = 20.6;
  p.yaw = 0;
  const nearWallPose = computeThirdPersonCameraPose(p);
  const hitsWall = LIVE_FPS_MAP.solids.some((w) =>
    segmentHitsWall(p, { x: nearWallPose.position.x, z: nearWallPose.position.z }, w, 0.2),
  );
  assert.equal(hitsWall, false);
});

test('bomb plant PIP camera finds unobstructed 3/4 site framing around A crates and B fountain', () => {
  const snap = makeLiveSnapshot(60);
  const planter = snap.players[0];

  // Plant near A crates
  planter.x = -25.1;
  planter.z = 20.2;
  planter.yaw = 0.4;
  planter.crouch = true;
  const pipA = computeBombPlantPipPose(
    { active: true, phase: 'planting', planterId: planter.id, site: 'A', progress: 0.4, duration: 3.2, spot: { x: planter.x, z: planter.z } },
    snap.players,
  );
  assert.equal(
    LIVE_FPS_MAP.solids.some((w) => segmentHitsWall(planter, { x: pipA.position.x, z: pipA.position.z }, w, 0.25)),
    false,
  );
  assert.ok(pipA.position.y >= 1.8);

  // Plant near B fountain
  planter.x = 20.1;
  planter.z = 21.0;
  planter.yaw = -0.8;
  const pipB = computeBombPlantPipPose(
    { active: true, phase: 'planting', planterId: planter.id, site: 'B', progress: 0.6, duration: 3.2, spot: { x: planter.x, z: planter.z } },
    snap.players,
  );
  assert.equal(
    LIVE_FPS_MAP.solids.some((w) => segmentHitsWall(planter, { x: pipB.position.x, z: pipB.position.z }, w, 0.25)),
    false,
  );
});

test('domRectToBabylonViewport converts DOM coordinates cleanly to bottom-left WebGL viewport', () => {
  const vp = domRectToBabylonViewport(
    { left: 700, top: 200, width: 250, height: 150 },
    { left: 0, top: 0, width: 1000, height: 500 },
  );
  assert.ok(vp !== null);
  assert.ok(Math.abs(vp.x - 0.7) < 0.001);
  // top=200 + height=150 -> bottom edge at y=350 from top -> 1 - 350/500 = 0.30 from bottom
  assert.ok(Math.abs(vp.y - 0.3) < 0.001);
  assert.ok(Math.abs(vp.width - 0.25) < 0.001);
  assert.ok(Math.abs(vp.height - 0.3) < 0.001);

  assert.equal(domRectToBabylonViewport({ left: 0, top: 0, width: 0, height: 0 }, { left: 0, top: 0, width: 1000, height: 500 }), null);
});
