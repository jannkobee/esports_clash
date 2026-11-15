import test from 'node:test';
import assert from 'node:assert/strict';
import { NullEngine, Scene, StandardMaterial, Vector3 } from '@babylonjs/core';
import { getLiveMapRuntime, listLiveMaps } from './fps/fpsLiveMapRegistry.ts';
import { FONTESSA_MAP_RUNTIME } from './fps/fpsLiveMap.ts';
import { SPILLWAY_MAP_RUNTIME } from './fps/fpsSpillwayMap.ts';
import { SPILLWAY_SHALLOW_WATERS, SPILLWAY_TERRAIN_RUNTIME } from './fps/fpsSpillwayTerrain.ts';
import { buildLiveSky, LiveSurfaceLibrary } from './fps/fpsLiveGraphics.ts';
import { buildSpillwayScenery } from './fps/fpsSpillwayScenery.ts';
import { computeOverviewCameraPose } from './fps/fpsBroadcastDirector.ts';
import { computeLiveGrenadeTrajectoryPoints } from './fps/fpsLiveViewer.ts';
import { solveLiveSmokeThrow } from './fps/fpsLiveLineups.ts';
import { surfaceAudioCharacteristics } from './fps/fpsBroadcastAudio.ts';
import { fpsBroadcastPresentation, fpsBroadcastText } from './fps/fpsBroadcastPresentation.ts';
import { describeNearbyDeathCover, FpsLiveSimulation } from './fps/fpsLiveSimulation.ts';
import { baselineCards, baselineIdentity } from './testSupport/fpsBaselineFixtures.mjs';

test('map registry registers Spillway while preserving Fontessa as default runtime', () => {
  const maps = listLiveMaps();
  assert.deepEqual(maps.map(m => m.id), ['fontessa', 'spillway']);
  assert.equal(getLiveMapRuntime(), FONTESSA_MAP_RUNTIME);
  assert.equal(getLiveMapRuntime('fontessa'), FONTESSA_MAP_RUNTIME);
  assert.equal(getLiveMapRuntime('spillway'), SPILLWAY_MAP_RUNTIME);

  const cards = structuredClone(baselineCards);
  const simDefault = new FpsLiveSimulation(cards.slice(0, 5), cards.slice(5), 101, structuredClone(baselineIdentity));
  assert.equal(simDefault.snapshot().mapId, 'fontessa');
  assert.equal(simDefault.snapshot().mapName, 'Fontessa');
});

test('Spillway exposes three elevation tiers and an overlapping Control Deck upper layer', () => {
  const t = SPILLWAY_TERRAIN_RUNTIME;
  // Level 0 (0.0m): Drainage + B Pump Station
  assert.equal(t.groundHeight({ x: 30, z: 21 }), 0);
  assert.equal(t.groundHeight({ x: 30, z: -40 }), 0);
  // Level 1 (2.8m): Service Yard (T Spawn) & Gardens Fountain Plaza
  assert.equal(t.groundHeight({ x: 0, z: -48 }), 2.8);
  assert.equal(t.groundHeight({ x: -16, z: -30 }), 2.8);
  // Level 2 (5.6m): Promenade, Kiosk, HQ (Site A), CT Compound
  assert.equal(t.groundHeight({ x: -35, z: 0 }), 5.6);
  assert.equal(t.groundHeight({ x: -15, z: 31 }), 5.6);
  assert.equal(t.groundHeight({ x: 8, z: 48 }), 5.6);

  // Overlapping 'upper' layer: Control Deck at (22, 31) sits at 3.6m above 0.0m lower B floor
  assert.equal(t.groundHeight({ x: 22, z: 31, level: 'upper' }), 3.6);
  assert.equal(t.groundHeight({ x: 22, z: 31, level: 'street' }), 0);
  assert.ok(t.floorAt({ x: 22, z: 31, level: 'upper' }, 3.8) >= 3.5);
  assert.equal(t.floorAt({ x: 22, z: 31, level: 'street' }, 0.2), 0);

  // Stair connectors traverse smoothly across tiers while sheer 2.8m drop walls block horizontal phasing
  assert.equal(t.terrainPathClear({ x: -12, z: -21 }, { x: -12, z: -14 }), true);
  assert.equal(t.terrainPathClear({ x: 18, z: 26, level: 'upper' }, { x: 18, z: 17, level: 'upper' }), true);
  assert.equal(t.terrainPathClear({ x: -10, z: -44 }, { x: 18, z: -44 }), true); // via t-drainage-ramp
  assert.equal(t.terrainPathClear({ x: -30, z: -18 }, { x: -30, z: -13 }, 2.8, false), false); // sheer retaining wall
});

test('Spillway navigation graph connects all tactical zones without direct spawn sightlines', () => {
  const rt = SPILLWAY_MAP_RUNTIME;
  const { spawns, sites } = rt.definition;
  assert.equal(rt.sightline(spawns.attackers, spawns.defenders), false);

  const findNearest = (pt) => {
    let best = 0;
    let bestD = Infinity;
    for (let i = 0; i < rt.navNodes.length; i++) {
      const n = rt.navNodes[i];
      if ((pt.level ?? 'street') !== (n.level ?? 'street')) continue;
      const d = Math.hypot(n.x - pt.x, n.z - pt.z);
      if (d < bestD) { bestD = d; best = i; }
    }
    return best;
  };

  const shortestPathLen = (fromPt, toPt) => {
    const start = findNearest(fromPt);
    const goal = findNearest(toPt);
    const dist = Array(rt.navNodes.length).fill(Infinity);
    dist[start] = 0;
    const queue = [start];
    while (queue.length) {
      let bestIdx = 0;
      for (let i = 1; i < queue.length; i++) if (dist[queue[i]] < dist[queue[bestIdx]]) bestIdx = i;
      const u = queue.splice(bestIdx, 1)[0];
      if (u === goal) return dist[u];
      const nu = rt.navNodes[u];
      for (const v of rt.neighbors[u] ?? []) {
        const nv = rt.navNodes[v];
        const w = Math.hypot(nv.x - nu.x, nv.z - nu.z);
        if (dist[u] + w < dist[v]) {
          dist[v] = dist[u] + w;
          queue.push(v);
        }
      }
    }
    return Infinity;
  };

  const targets = [
    { name: 'A HQ', point: sites.A },
    { name: 'B Pump Station', point: sites.B },
    { name: 'CT Spawn', point: spawns.defenders },
    { name: 'Control Deck Upper', point: { x: 22, z: 31, level: 'upper' } },
    { name: 'Kiosk Interior', point: { x: -11, z: 19 } },
    { name: 'Mid Courtyard', point: { x: -10, z: 4 } },
    { name: 'Connector Landing', point: { x: 13.8, z: 3.5 } },
    { name: 'Canal Bridge', point: { x: 23.5, z: -12 } },
    { name: 'Main Tunnel', point: { x: 40, z: 5 } },
  ];
  for (const t of targets) {
    const d = shortestPathLen(spawns.attackers, t.point);
    assert.ok(Number.isFinite(d) && d > 10, `Nav graph must reach ${t.name} cleanly from T Spawn (got ${d})`);
  }

  // Defenders must reach both bombsites faster than attackers on foot
  const tToA = shortestPathLen(spawns.attackers, sites.A);
  const tToB = shortestPathLen(spawns.attackers, sites.B);
  const ctToA = shortestPathLen(spawns.defenders, sites.A);
  const ctToB = shortestPathLen(spawns.defenders, sites.B);
  assert.ok(ctToA < tToA, `CT (${ctToA.toFixed(1)}m) must arrive at A before T (${tToA.toFixed(1)}m)`);
  assert.ok(ctToB < tToB, `CT (${ctToB.toFixed(1)}m) must arrive at B before T (${tToB.toFixed(1)}m)`);
});

test('Spillway surfaces map to distinct acoustic zones and audio profiles', () => {
  const m = SPILLWAY_MAP_RUNTIME;
  assert.equal(m.surfaceAt({ x: 18, z: -12 }), 'water');
  assert.equal(m.surfaceAt({ x: 17.5, z: 2 }), 'water');
  assert.equal(m.surfaceAt({ x: 23.5, z: -12 }), 'metal');
  assert.equal(m.surfaceAt({ x: 22, z: 31, level: 'upper' }), 'metal');
  assert.equal(m.surfaceAt({ x: -34, z: -28 }), 'grass');
  assert.equal(m.surfaceAt({ x: -11, z: 19 }), 'wood');
  assert.equal(m.surfaceAt({ x: -35, z: 0 }), 'brick');
  assert.equal(m.surfaceAt({ x: 0, z: -48 }), 'concrete');

  const waterAcoustics = surfaceAudioCharacteristics('water');
  const metalAcoustics = surfaceAudioCharacteristics('metal');
  const grassAcoustics = surfaceAudioCharacteristics('grass');
  const woodAcoustics = surfaceAudioCharacteristics('wood');
  assert.ok(waterAcoustics.splash && metalAcoustics.metalPing && metalAcoustics.resonanceHz > 500 && grassAcoustics.filterHz < 2000 && woodAcoustics.resonanceHz > 0);
});

test('every authored Spillway smoke lineup solves cleanly against 3-level geometry', () => {
  const lineups = SPILLWAY_MAP_RUNTIME.definition.authoredSmokeLineups;
  assert.ok(lineups.length >= 12);
  let solvedCount = 0;
  const unsolved = [];
  for (const lineup of lineups) {
    assert.equal(lineup.mapId, 'spillway');
    const eyeY = SPILLWAY_TERRAIN_RUNTIME.groundHeight(lineup.position) + 1.6;
    const solution = solveLiveSmokeThrow(lineup.position, lineup.target, eyeY, undefined, 2.2, SPILLWAY_MAP_RUNTIME);
    if (solution) {
      solvedCount++;
      const landingError = Math.hypot(solution.forecast.x - lineup.target.x, solution.forecast.z - lineup.target.z);
      assert.ok(landingError <= 2.2, `${lineup.id} exceeded max landing error: ${landingError.toFixed(2)}m`);
    } else {
      unsolved.push(lineup.id);
    }
  }
  assert.ok(solvedCount >= Math.floor(lineups.length * 0.85), `Expected >=85% Spillway lineups solved, got ${solvedCount}/${lineups.length} (unsolved: ${unsolved.join(', ')})`);
});

test('Spillway 3D scenery, shallow waters, cutaway roofs, and overview camera work in Babylon NullEngine', () => {
  const engine = new NullEngine();
  engine.createCanvas = (width, height) => {
    const noop = () => {};
    const target = {
      createImageData: (w, h) => ({ data: new Uint8ClampedArray(w * h * 4), width: w, height: h }),
      putImageData(image) { this.pixels = image.data; },
      measureText: text => ({ width: String(text).length * 20 }),
      createLinearGradient: () => ({ addColorStop: noop }),
      createRadialGradient: () => ({ addColorStop: noop }),
    };
    const context = new Proxy(target, {
      get(obj, prop) {
        if (prop in obj) return obj[prop];
        return noop;
      },
    });
    return { width, height, getContext: () => context };
  };
  const scene = new Scene(engine);
  try {
    buildLiveSky(scene, SPILLWAY_MAP_RUNTIME.definition.atmosphere.sky);
    const surfaces = new LiveSurfaceLibrary(scene);
    const mats = new Map();
    const built = buildSpillwayScenery(
      scene,
      hex => {
        const existing = mats.get(hex);
        if (existing) return existing;
        const mat = new StandardMaterial(hex, scene);
        mats.set(hex, mat);
        return mat;
      },
      surfaces,
    );
    assert.ok(built.meshes.length > 0);
    assert.ok(built.cutawayMeshes.length >= 6);
    assert.ok(built.waterTextures.length >= 1);
    assert.ok(built.lights.length >= 3);
    assert.equal(SPILLWAY_SHALLOW_WATERS.length, 2);

    for (const aspect of [16 / 9, 4 / 3, 9 / 16]) {
      const pose = computeOverviewCameraPose(aspect, SPILLWAY_MAP_RUNTIME);
      const eye = new Vector3(pose.position.x, pose.position.y, pose.position.z);
      const target = new Vector3(pose.target.x, pose.target.y, pose.target.z);
      const forward = target.subtract(eye).normalize();
      const right = Vector3.Cross(Vector3.Up(), forward).normalize();
      const up = Vector3.Cross(forward, right).normalize();
      for (const x of [-48, 48]) for (const z of [-56, 56]) for (const y of [0, 8]) {
        const v = new Vector3(x, y, z).subtract(eye);
        const depth = Vector3.Dot(v, forward);
        const half = depth * Math.tan(pose.fov / 2);
        assert.ok(Math.abs(Vector3.Dot(v, right) / (half * aspect)) < 1, `X corner (${x},${y},${z}) clipped on aspect ${aspect}`);
        assert.ok(Math.abs(Vector3.Dot(v, up) / half) < 1, `Y corner (${x},${y},${z}) clipped on aspect ${aspect}`);
      }
    }
  } finally {
    scene.dispose();
    engine.dispose();
  }
});

test('Spillway multi-round exhibition steps cleanly with bounded release-only utility and map callouts', () => {
  const cards = structuredClone(baselineCards);
  const sim = new FpsLiveSimulation(cards.slice(0, 5), cards.slice(5), 2026, structuredClone(baselineIdentity), { mapId: 'spillway' });
  const initial = sim.snapshot();
  assert.equal(initial.mapId, 'spillway');
  assert.equal(initial.mapName, 'Spillway');

  const bounds = SPILLWAY_MAP_RUNTIME.definition.bounds;
  let sawLive = false;
  let sawGrenadeTrail = false;
  let maxRound = 1;

  for (let i = 0; i < 4500; i++) {
    sim.step();
    const s = sim.snapshot();
    maxRound = Math.max(maxRound, s.round);
    if (s.phase === 'live') sawLive = true;
    for (const p of s.players) {
      assert.ok(Number.isFinite(p.x) && Number.isFinite(p.z), 'Player coords must stay finite');
      assert.ok(p.x >= bounds.clampMinX - 0.1 && p.x <= bounds.clampMaxX + 0.1, `x=${p.x} escaped Spillway`);
      assert.ok(p.z >= bounds.clampMinZ - 0.1 && p.z <= bounds.clampMaxZ + 0.1, `z=${p.z} escaped Spillway`);
    }
    for (const g of s.grenades) {
      if (s.time >= g.releaseAt) {
        const pts = computeLiveGrenadeTrajectoryPoints(g, g.releaseAt, s.time, SPILLWAY_MAP_RUNTIME);
        assert.ok(pts.length >= 1);
        sawGrenadeTrail = true;
      }
    }
    if (maxRound >= 2 && sawLive && sawGrenadeTrail) break;
  }

  assert.equal(sawLive, true);
  assert.equal(sawGrenadeTrail, true);
  assert.ok(maxRound >= 2, 'Simulation must advance cleanly into round 2+');

  // Broadcast sanitization uses Spillway callouts without Fontessa fallback leaks
  const pres = fpsBroadcastPresentation('signal-circuit', undefined, 'spillway');
  assert.ok(pres.intro.length > 0);
  const red = fpsBroadcastText('Push Control Deck toward Pumping Station now', 'spillway');
  assert.equal(red.includes('Pumping Station'), false);
});

test('describeNearbyDeathCover identifies tactical cover on Fontessa and Spillway without roof leaks', () => {
  assert.equal(
    describeNearbyDeathCover(
      FONTESSA_MAP_RUNTIME.definition.solids,
      { x: 18, z: -12.5 },
      FONTESSA_MAP_RUNTIME.terrain.groundHeight({ x: 18, z: -12.5 }),
    ),
    'behind car',
  );
  assert.equal(
    describeNearbyDeathCover(
      SPILLWAY_MAP_RUNTIME.definition.solids,
      { x: -19.9, z: 32.5 },
      SPILLWAY_MAP_RUNTIME.terrain.groundHeight({ x: -19.9, z: 32.5 }),
    ),
    'behind truck',
  );
  assert.equal(
    describeNearbyDeathCover(
      [{ id: 'b-car-roof', minX: -2, maxX: 2, minZ: -2, maxZ: 2, height: 3, cutawayGroup: 'roof' }],
      { x: 0, z: 0 },
      0,
    ),
    '',
  );
});

test('lawful death callouts relay observed killer cover for trades and never leak unseen ambushers', () => {
  const cards = structuredClone(baselineCards);
  const sim = new FpsLiveSimulation(cards.slice(0, 5), cards.slice(5), 77, structuredClone(baselineIdentity), { mapId: 'fontessa' });
  while (sim.snapshot().phase === 'freeze') sim.step();

  const internal = /** @type {any} */ (sim);
  const blue = internal.actors.filter((a) => a.team === 'blue' && a.hp > 0);
  const red = internal.actors.filter((a) => a.team === 'red' && a.hp > 0);
  const [victim, tradeAlly, victim2] = blue;
  const [killer, killer2] = red;
  assert.ok(killer && victim && tradeAlly && victim2 && killer2);

  // Move non-participating blue actors away so tradeAlly is deterministically nearest within 18m
  for (const ally of blue) {
    if (ally !== victim && ally !== tradeAlly) { ally.x = -30; ally.z = 35; ally.target = undefined; }
  }

  // Observed duel by the car on B approach: killer and victim have clear direct sight
  killer.x = 18;
  killer.z = -12.2;
  killer.level = undefined;
  victim.x = 18;
  victim.z = -5.5;
  victim.level = undefined;
  victim.yaw = Math.atan2(killer.x - victim.x, killer.z - victim.z);
  victim.facing = victim.yaw;
  victim.blinded = 0;
  assert.equal(internal.visible(victim, killer), true);

  tradeAlly.x = 20.5;
  tradeAlly.z = 0.5;
  tradeAlly.level = undefined;
  tradeAlly.role = 'trade';
  tradeAlly.target = undefined;
  tradeAlly.seenAt = -99;
  tradeAlly.intel.contacts = [];
  tradeAlly.watchPoint = undefined;
  tradeAlly.contact = undefined;
  tradeAlly.blinded = 0;
  tradeAlly.yaw = 0;
  tradeAlly.facing = tradeAlly.yaw;
  assert.equal(internal.visible(tradeAlly, killer), false);

  const reportsBefore = internal.reports.length;
  internal.damage(killer, victim, 400, true, 'ak47', true);

  const duelReport = internal.teamReports.find((r) => r.actorId === victim.id && r.message.includes('— trade him!'));
  assert.ok(duelReport, 'Expected duel death callout for observed killer');
  assert.equal(duelReport.category, 'contact');
  assert.equal(duelReport.confidence, 'confirmed');
  assert.ok(duelReport.message.includes('behind car'), `Expected cover landmark in "${duelReport.message}"`);

  const queuedReport = internal.reports.slice(reportsBefore).find((r) => r.team === 'blue' && r.contact?.enemyId === killer.id);
  assert.ok(queuedReport, 'Expected urgent delayed contact report for killer');
  assert.ok(queuedReport.at > internal.time && queuedReport.at <= internal.time + 0.5);
  assert.ok(Math.abs(queuedReport.contact.x - killer.x) < 0.01 && Math.abs(queuedReport.contact.z - killer.z) < 0.01);
  assert.ok(tradeAlly.watchPoint && Math.hypot(tradeAlly.watchPoint.x - killer.x, tradeAlly.watchPoint.z - killer.z) < 0.1);
  assert.equal(tradeAlly.contact, undefined, 'Ally must not get instant un-delayed contact mutation');

  // Unseen ambush strictly from behind without prior sight or target history
  victim2.x = 0;
  victim2.z = -8;
  victim2.level = undefined;
  victim2.blinded = 0;
  victim2.yaw = 0; // Looking north (+z)
  victim2.facing = victim2.yaw;
  victim2.target = undefined;
  victim2.aimPoint = undefined;
  victim2.intel.contacts = [];
  killer2.x = 0;
  killer2.z = -13.5; // Directly south (-z), behind victim2
  killer2.level = undefined;
  assert.equal(internal.visible(victim2, killer2), false);

  const reportsBeforeAmbush = internal.reports.length;
  internal.damage(killer2, victim2, 400, false, 'ak47', true);

  const blindReport = internal.teamReports.find((r) => r.actorId === victim2.id && r.message.includes('Dropped unseen around'));
  assert.ok(blindReport, 'Expected unseen-flank death warning');
  assert.equal(blindReport.confidence, 'reported');
  assert.equal(blindReport.message.includes('trade him'), false);
  const leakedKiller2 = internal.reports.slice(reportsBeforeAmbush).find((r) => r.contact?.enemyId === killer2.id);
  assert.equal(leakedKiller2, undefined, 'Unseen killer position must never be leaked into team contact reports');
});
