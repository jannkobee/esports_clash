import test from 'node:test';
import assert from 'node:assert/strict';
import {
  canPeripherallyNotice,
  selectSmartDefenseHold,
  selectComplementaryWatchPoint,
  evaluateTeammateCombatOrientation,
  evaluateRetakeCohesion,
} from './fps/fpsSpatialAwareness.ts';
import { chooseLiveApproach } from './fps/fpsLiveBrain.ts';
import { FONTESSA_MAP_RUNTIME, distance } from './fps/fpsLiveMap.ts';

test('canPeripherallyNotice detects salient peripheral targets and respects awareness, attentionDebt, walls, and smoke', () => {
  // Open plaza / mid corridor on Fontessa with clear sightline
  const observer = { x: 0, z: 0, yaw: 0, blinded: 0 };
  // Target at ~1.05 rad off-axis (~60 deg, outside 0.82 central cone, inside 1.38 peripheral cone), ~8.5m away
  const closePeriphery = { x: 7.4, z: 4.2, speed: 0 };

  const highAwareness = canPeripherallyNotice(
    observer,
    closePeriphery,
    { awareness: 0.9, positioning: 0.8, attentionDebt: 0.0, now: 10 },
    FONTESSA_MAP_RUNTIME,
  );
  assert.equal(highAwareness.noticed, true);
  assert.equal(highAwareness.peripheral, true);
  assert.ok(highAwareness.angularOffset > 0.82 && highAwareness.angularOffset < 1.38);

  // Farther peripheral target (~16m along open mid corridor at ~1.05 rad off-axis): stationary & silent is not noticed, but sprinting or firing is
  const midObserver = { x: 0, z: 0, yaw: -1.05, blinded: 0 };
  const mediumPeriphery = { x: 0, z: 16, speed: 0 };
  assert.equal(FONTESSA_MAP_RUNTIME.sightline(midObserver, mediumPeriphery), true);
  const stationaryQuiet = canPeripherallyNotice(
    midObserver,
    mediumPeriphery,
    { awareness: 0.85, attentionDebt: 0.0, targetSpeed: 0, sinceTargetShot: 5, now: 10 },
    FONTESSA_MAP_RUNTIME,
  );
  assert.equal(stationaryQuiet.noticed, false);

  const sprintingTarget = canPeripherallyNotice(
    midObserver,
    mediumPeriphery,
    { awareness: 0.85, attentionDebt: 0.0, targetSpeed: 3.2, sinceTargetShot: 5, now: 10 },
    FONTESSA_MAP_RUNTIME,
  );
  assert.equal(sprintingTarget.noticed, true);
  assert.equal(sprintingTarget.peripheral, true);

  const firingTarget = canPeripherallyNotice(
    midObserver,
    mediumPeriphery,
    { awareness: 0.85, attentionDebt: 0.0, targetSpeed: 0, sinceTargetShot: 0.12, now: 10 },
    FONTESSA_MAP_RUNTIME,
  );
  assert.equal(firingTarget.noticed, true);

  // High attentionDebt + low awareness narrows the peripheral cone so a ~1.18 rad target is missed
  const widePeriphery = { x: 9.2, z: 3.8, speed: 3.5 };
  const tunnelVision = canPeripherallyNotice(
    observer,
    widePeriphery,
    { awareness: 0.1, positioning: 0.1, attentionDebt: 1.0, targetSpeed: 3.5, now: 10 },
    FONTESSA_MAP_RUNTIME,
  );
  assert.equal(tunnelVision.noticed, false);

  // Smoke between observer and peripheral target blocks peripheral detection
  const smoke = { id: 1, x: 3.7, z: 2.1, y: 1.5, radius: 4.0, startedAt: 5, expires: 23 };
  const smoked = canPeripherallyNotice(
    observer,
    closePeriphery,
    { awareness: 0.95, attentionDebt: 0, smokes: [smoke], now: 10 },
    FONTESSA_MAP_RUNTIME,
  );
  assert.equal(smoked.noticed, false);

  // Wall between observer and target blocks peripheral detection
  const behindWall = { x: -24.9, z: 20, speed: 4.0 };
  const wallObserver = { x: -31.1, z: 20, yaw: Math.PI / 4, blinded: 0 };
  const blocked = canPeripherallyNotice(
    wallObserver,
    behindWall,
    { awareness: 1.0, attentionDebt: 0, targetSpeed: 4.0, now: 10 },
    FONTESSA_MAP_RUNTIME,
  );
  assert.equal(blocked.noticed, false);
});

test('selectSmartDefenseHold forms crossfires, respects weapon range, avoids crowding, and adapts to recent deaths', () => {
  const entry = { x: 0, z: -2 };
  const holdCloseLeft = { x: -6, z: 5 }; // ~9.2m to entry
  const holdMidRight = { x: 8, z: 8 }; // ~12.8m to entry, separated angle from holdCloseLeft
  const holdFarBack = { x: 0, z: 22 }; // ~24m to entry
  const holds = [holdCloseLeft, holdMidRight, holdFarBack];

  // 1. Avoids stacking on a teammate's goal and forms a crossfire instead
  const partnerAtLeft = [{ id: 'ct-1', slot: 0, x: holdCloseLeft.x, z: holdCloseLeft.z, goal: holdCloseLeft }];
  const pickedWithPartner = selectSmartDefenseHold(
    {
      actor: { id: 'ct-2', slot: 1, x: 2, z: 12, weaponCategory: 'rifle' },
      site: 'A',
      round: 3,
      holds,
      entries: [entry],
      mates: partnerAtLeft,
      traits: { crossfirePreference: 0.9, teamUnderstanding: 0.85 },
    },
    FONTESSA_MAP_RUNTIME,
  );
  assert.notDeepEqual(pickedWithPartner, holdCloseLeft, 'Defender must not stack on teammate hold');

  // 2. Sniper prefers long sightline (>= 20m) whereas shotgun prefers close hold (<= 13m)
  const sniperChoice = selectSmartDefenseHold(
    {
      actor: { id: 'ct-awp', slot: 0, x: 0, z: 14, weaponCategory: 'sniper' },
      site: 'A',
      round: 1,
      holds: [holdCloseLeft, holdFarBack],
      entries: [entry],
      mates: [],
    },
    FONTESSA_MAP_RUNTIME,
  );
  assert.deepEqual(sniperChoice, holdFarBack);

  const shotgunChoice = selectSmartDefenseHold(
    {
      actor: { id: 'ct-shotgun', slot: 0, x: 0, z: 14, weaponCategory: 'shotgun' },
      site: 'A',
      round: 1,
      holds: [holdCloseLeft, holdFarBack],
      entries: [entry],
      mates: [],
    },
    FONTESSA_MAP_RUNTIME,
  );
  assert.deepEqual(shotgunChoice, holdCloseLeft);

  // 3. Penalizes a spot where the defender recently died
  const TwinHolds = [
    { x: -4, z: 8 },
    { x: 4, z: 8 },
  ];
  const afterDeath = selectSmartDefenseHold(
    {
      actor: { id: 'ct-adapt', slot: 0, x: 0, z: 10, weaponCategory: 'rifle' },
      site: 'A',
      round: 4,
      holds: TwinHolds,
      entries: [entry],
      mates: [],
      recentDeathPoints: [{ x: -4, z: 8 }],
      traits: { opponentAdaptation: 0.9 },
    },
    FONTESSA_MAP_RUNTIME,
  );
  assert.deepEqual(afterDeath, TwinHolds[1]);
});

test('selectComplementaryWatchPoint avoids staring into walls and covers the complementary entrance alongside a partner', () => {
  const actor = { id: 'ct-1', slot: 0, x: 0, z: 8 };
  const blockedEntry = { x: -24.9, z: 20 }; // behind solid geometry from (0,8)
  const openEntryMain = { x: -4, z: 0 };
  const openEntrySplit = { x: 5, z: 0 };

  // Never picks wall-blocked choke when an open choke is visible
  const visibleWatch = selectComplementaryWatchPoint(
    {
      actor,
      site: 'A',
      entries: [blockedEntry, openEntryMain],
      mates: [],
    },
    FONTESSA_MAP_RUNTIME,
  );
  assert.deepEqual(visibleWatch, openEntryMain);

  // When a site partner is already watching openEntryMain, picks the complementary openEntrySplit
  const complementaryWatch = selectComplementaryWatchPoint(
    {
      actor,
      site: 'A',
      entries: [openEntryMain, openEntrySplit],
      mates: [{ id: 'ct-2', x: 2, z: 8, watchPoint: openEntryMain }],
      traits: { communication: 0.85, teammateCover: 0.85 },
    },
    FONTESSA_MAP_RUNTIME,
  );
  assert.deepEqual(complementaryWatch, openEntrySplit);

  // Fresh high-certainty intel at openEntryMain overrides the partner-duplication penalty
  const urgentWatch = selectComplementaryWatchPoint(
    {
      actor,
      site: 'A',
      entries: [openEntryMain, openEntrySplit],
      mates: [{ id: 'ct-2', x: 2, z: 8, watchPoint: openEntryMain }],
      beliefs: [
        {
          key: 'enemy:1',
          observerId: 'ct-2',
          source: 'sight',
          x: openEntryMain.x,
          z: openEntryMain.z,
          observed: 10,
          confidence: 0.95,
          uncertainty: 0.5,
          certainty: 0.95,
          radius: 1.0,
          age: 0.5,
        },
      ],
      traits: { communication: 0.85, teammateCover: 0.85, informationReading: 0.9 },
    },
    FONTESSA_MAP_RUNTIME,
  );
  assert.deepEqual(urgentWatch, openEntryMain);
});

test('evaluateTeammateCombatOrientation turns idle nearby teammates toward an active friendly firefight', () => {
  const actor = { id: 'ct-1', x: 0, z: 6 };
  const fightingAlly = {
    id: 'ct-2',
    x: 3,
    z: 6,
    lastShot: 9.8,
    damageAt: 5.0,
    aimPoint: { x: 3, z: -2 },
  };
  const orientation = evaluateTeammateCombatOrientation(
    actor,
    [fightingAlly],
    10.0,
    FONTESSA_MAP_RUNTIME,
  );
  assert.ok(orientation);
  assert.deepEqual(orientation.point, { x: 3, z: -2 });
});

test('evaluateRetakeCohesion stages disciplined CTs for rotating teammates while solo/urgent CTs breach immediately', () => {
  const bomb = { x: -23, z: 21, remaining: 28, site: 'A' };
  const stagingPoints = FONTESSA_MAP_RUNTIME.definition.tactical.A.retakeStaging;
  const nearActor = { id: 'ct-near', slot: 1, x: -12, z: 24, kit: true };
  const rotatingAlly = { id: 'ct-rotator', slot: 2, x: 6, z: 24, kit: false }; // ~29m away (in 19..42m rotating band)

  const disciplined = evaluateRetakeCohesion(
    {
      actor: nearActor,
      allies: [nearActor, rotatingAlly],
      defuserId: 'ct-rotator',
      bomb,
      livingEnemies: 3,
      stagingPoints,
      traits: {
        teamCoordination: 0.85,
        teamStructure: 0.85,
        callerRegroupPreference: 0.8,
        playDiscipline: 0.85,
        soloInitiative: 0.2,
      },
    },
    FONTESSA_MAP_RUNTIME,
  );
  assert.equal(disciplined.shouldStage, true);
  assert.ok(disciplined.point);
  assert.ok(distance(disciplined.point, bomb) > 3);

  // Solo-initiative player with lower slack breaches immediately instead of staging
  const solo = evaluateRetakeCohesion(
    {
      actor: nearActor,
      allies: [nearActor, rotatingAlly],
      defuserId: 'ct-rotator',
      bomb: { ...bomb, remaining: 21 }, // slack = 16s (< solo maxWaitSlack ~17.7s)
      livingEnemies: 3,
      stagingPoints,
      traits: {
        teamCoordination: 0.2,
        teamStructure: 0.2,
        callerRegroupPreference: 0.2,
        playDiscipline: 0.2,
        soloInitiative: 0.9,
      },
    },
    FONTESSA_MAP_RUNTIME,
  );
  assert.equal(solo.shouldStage, false);

  // Urgent bomb clock (slack <= 9.5s) never stages even for disciplined teams
  const urgent = evaluateRetakeCohesion(
    {
      actor: nearActor,
      allies: [nearActor, rotatingAlly],
      defuserId: 'ct-rotator',
      bomb: { ...bomb, remaining: 13.5 },
      livingEnemies: 3,
      stagingPoints,
      traits: {
        teamCoordination: 0.95,
        teamStructure: 0.95,
        callerRegroupPreference: 0.95,
        playDiscipline: 0.95,
        soloInitiative: 0.1,
      },
    },
    FONTESSA_MAP_RUNTIME,
  );
  assert.equal(urgent.shouldStage, false);
});

test('chooseLiveApproach keeps rotating retake CTs moving when travel exceeds remaining and paces support behind entry', () => {
  const candidates = [
    { key: 'retake:A:0', point: { x: -20, z: 20 }, purpose: 'clear' },
    { key: 'retake:A:1', point: { x: -26, z: 24 }, purpose: 'clear' },
  ];
  const chosen = chooseLiveApproach(
    candidates,
    {
      position: { x: 10, z: 24 },
      role: 'anchor',
      remaining: 6,
      judgment: 0.8,
      allies: [],
      beliefs: [],
      committed: false,
      visited: new Set(),
      execute: false,
      phase: 'retake',
      routeTo: pt => ({
        path: [pt],
        distance: distance({ x: 10, z: 24 }, pt),
        seconds: distance({ x: 10, z: 24 }, pt) / 4.5, // ~6.7s > remaining(6s)
        exposure: 0,
      }),
    },
    () => 0,
  );
  assert.ok(chosen, 'Retake approach must fall back to closest reachable angle rather than returning undefined');
  assert.equal(chosen.key, 'retake:A:0');

  // Non-execute opening: support player is penalized for picking an entry choke ahead of the team entry fragger
  const openingCandidates = [
    { key: 'A:entry:0', point: { x: -20, z: 12 }, purpose: 'entry' },
    { key: 'mid:control', point: { x: -8, z: 2 }, purpose: 'control' },
  ];
  const supportPick = chooseLiveApproach(
    openingCandidates,
    {
      position: { x: -14, z: -2 },
      role: 'support',
      remaining: 85,
      judgment: 0.8,
      allies: [],
      beliefs: [],
      committed: false,
      visited: new Set(),
      execute: false,
      objective: { x: -23, z: 21 },
      entryAheadDist: 22, // entry is still 22m from site while A:entry:0 is ~9.5m from site
    },
    () => 0,
  );
  assert.equal(supportPick?.key, 'mid:control');
});
