import test from 'node:test';
import assert from 'node:assert/strict';
import { FPS_MAPS } from './fps/fpsMaps.ts';
import { simulateFpsMatch } from './fps/fpsSimulationEngine.ts';
import { createEqualizedRoster } from './equalizedMode.ts';
import {
  buildFpsMapLayout,
  formatFpsEventClock,
  getFpsReplayState,
} from './fps/fpsMatchViewModel.ts';

const loadout = (overrides = {}) => ({
  secondaryWeapon: 'sidearm_standard',
  armor: 0,
  hasHelmet: false,
  hasDefuseKit: false,
  hasBomb: false,
  utilities: [],
  ...overrides,
});

function makeReport() {
  const playerStats = {
    p1: { playerId: 'p1', name: 'AliasBlue', team: 'blue', kills: 1, deaths: 0, assists: 0, damage: 90, adr: 90, headshotRate: 42, plants: 1, defuses: 0, firstBloods: 0, tradeKills: 0, clutchesWon: 0, setPiecesInvolved: 0 },
    p2: { playerId: 'p2', name: 'AliasRed', team: 'red', kills: 0, deaths: 1, assists: 0, damage: 0, adr: 0, headshotRate: 30, plants: 0, defuses: 0, firstBloods: 0, tradeKills: 0, clutchesWon: 0, setPiecesInvolved: 0 },
  };
  return {
    version: 1,
    format: 'MR15_TACTICAL_FPS',
    seed: 1,
    mapId: 'breakwater',
    mapName: 'Breakwater',
    totalRounds: 2,
    winnerTeam: 'blue',
    finalScore: { blue: 2, red: 0 },
    halfScore: { blue: 2, red: 0 },
    secondHalfScore: { blue: 0, red: 0 },
    roundResults: [
      { roundNumber: 1, winnerTeam: 'blue', winnerSide: 'attackers', reason: 'device_exploded', roundDurationSeconds: 30, devicePlanted: true, plantedSite: 'A', setPieceExecuted: true, setPieceSuccessful: true, blueScoreAfter: 1, redScoreAfter: 0, blueCashTotal: 5000, redCashTotal: 3000 },
      { roundNumber: 2, winnerTeam: 'blue', winnerSide: 'defenders', reason: 'attackers_eliminated', roundDurationSeconds: 20, devicePlanted: false, setPieceExecuted: true, setPieceSuccessful: false, blueScoreAfter: 2, redScoreAfter: 0, blueCashTotal: 7000, redCashTotal: 2000 },
    ],
    playerStats,
    roundSnapshots: [
      { roundNumber: 1, playerId: 'p1', team: 'blue', side: 'attackers', currentZone: 'zone_harbor_gates', isAlive: true, hp: 100, loadout: loadout({ hasBomb: true, armor: 50, hasHelmet: true }) },
      { roundNumber: 1, playerId: 'p2', team: 'red', side: 'defenders', currentZone: 'zone_customs_office', isAlive: true, hp: 100, loadout: loadout({ hasDefuseKit: true }) },
      { roundNumber: 2, playerId: 'p1', team: 'blue', side: 'attackers', currentZone: 'zone_harbor_gates', isAlive: true, hp: 100, loadout: loadout() },
      { roundNumber: 2, playerId: 'p2', team: 'red', side: 'defenders', currentZone: 'zone_customs_office', isAlive: true, hp: 100, loadout: loadout() },
    ],
    events: [
      { tick: 10, second: 0.3, roundNumber: 1, type: 'round_start', text: 'Round starts' },
      { tick: 20, second: 65, roundNumber: 1, type: 'utility_deployed', actorId: 'p1', weaponId: 'utility_smoke', site: 'A', zone: 'zone_warehouse_a', text: 'Smoke' },
      { tick: 30, second: 66.2, roundNumber: 1, type: 'kill', actorId: 'p1', targetId: 'p2', zone: 'choke_warehouse_rollup', text: 'Elimination' },
      { tick: 40, second: 70, roundNumber: 1, type: 'plant_completed', actorId: 'p1', site: 'A', zone: 'zone_warehouse_a', text: 'Planted' },
      { tick: 50, second: 110, roundNumber: 1, type: 'round_end', text: 'Round end' },
      { tick: 60, second: 111, roundNumber: 2, type: 'round_start', text: 'Next round' },
    ],
  };
}

test('lays out every FPS map from its zone graph', () => {
  for (const map of Object.values(FPS_MAPS)) {
    const layout = buildFpsMapLayout(map);
    assert.deepEqual(Object.keys(layout).sort(), Object.keys(map.zones).sort(), map.id);
    for (const point of Object.values(layout)) {
      assert.ok(Number.isFinite(point.x) && point.x >= 8 && point.x <= 92);
      assert.ok(Number.isFinite(point.y) && point.y >= 8 && point.y <= 92);
    }
    assert.notDeepEqual(layout[map.attackerSpawnZone], layout[map.defenderSpawnZone], map.id);
  }
});

test('initializes round one at its reported attacker and defender spawn snapshots', () => {
  const state = getFpsReplayState(makeReport(), 1, -1);
  assert.equal(state.players.find(player => player.playerId === 'p1').zone, 'zone_harbor_gates');
  assert.equal(state.players.find(player => player.playerId === 'p2').zone, 'zone_customs_office');
  assert.equal(state.players.find(player => player.playerId === 'p1').loadout.armor, 50);
  assert.equal(state.players.find(player => player.playerId === 'p1').loadout.hasBomb, true);
  assert.deepEqual(state.score, { blue: 0, red: 0 });
  assert.equal(state.clockText, '01:55');
});

test('replays only recorded events for position, utility, bomb, and score state', () => {
  const report = makeReport();
  const start = getFpsReplayState(report, 1, 0);
  assert.equal(start.clockText, '01:55');
  assert.equal(start.bomb.status, 'carried');

  const smoke = getFpsReplayState(report, 1, 1);
  assert.deepEqual(smoke.utility.map(marker => [marker.kind, marker.zone]), [['smoke', 'zone_warehouse_a']]);
  assert.equal(smoke.players.find(player => player.playerId === 'p1').zone, 'zone_warehouse_a');
  assert.equal(smoke.clockText, '00:50');

  const planted = getFpsReplayState(report, 1, 3);
  assert.equal(planted.players.find(player => player.playerId === 'p2').isAlive, false);
  assert.equal(planted.players.find(player => player.playerId === 'p2').zone, 'choke_warehouse_rollup');
  assert.equal(planted.bomb.status, 'planted');

  const ended = getFpsReplayState(report, 1, 4);
  assert.equal(ended.bomb.status, 'exploded');
  assert.deepEqual(ended.score, { blue: 1, red: 0 });
  assert.equal(getFpsReplayState(report, 2, 0).players.find(player => player.playerId === 'p2').zone, 'zone_customs_office');
});

test('formats only recorded event-clock values', () => {
  assert.equal(formatFpsEventClock(), '—');
  assert.equal(formatFpsEventClock({ second: 125.8 }), '02:05');
});

test('replays the planted-device detonation countdown from recorded event time', () => {
  const report = makeReport();
  report.events.splice(4, 0, {
    tick: 45,
    second: 80,
    roundNumber: 1,
    type: 'retake_initiated',
    text: 'Defenders regroup for the retake'
  });

  const planted = getFpsReplayState(report, 1, 4);
  assert.equal(planted.bomb.status, 'planted');
  assert.equal(planted.bomb.remainingSeconds, 30);

  const ended = getFpsReplayState(report, 1, 5);
  assert.equal(ended.bomb.status, 'exploded');
  assert.equal(ended.bomb.remainingSeconds, 0);
});

test('simulation reports preserve per-round starting loadouts and event locations', () => {
  const report = simulateFpsMatch(
    createEqualizedRoster('blue'),
    createEqualizedRoster('red'),
    'foundry',
    1337
  );
  assert.equal(report.roundSnapshots.length, report.totalRounds * 10);
  const secondHalf = report.roundSnapshots.filter(snapshot => snapshot.roundNumber === 16);
  assert.ok(secondHalf.some(snapshot => snapshot.team === 'blue' && snapshot.side === 'defenders'));
  assert.ok(secondHalf.some(snapshot => snapshot.team === 'red' && snapshot.side === 'attackers'));
  for (const snapshot of report.roundSnapshots) {
    const map = FPS_MAPS[report.mapId];
    assert.equal(
      snapshot.currentZone,
      snapshot.side === 'attackers' ? map.attackerSpawnZone : map.defenderSpawnZone
    );
    assert.ok(Array.isArray(snapshot.loadout.utilities));
  }
  for (const event of report.events.filter(item =>
    item.type === 'utility_deployed' || item.type === 'duel_engagement' ||
    item.type === 'kill' || item.type === 'trade_kill' ||
    item.type.startsWith('plant_') || item.type.startsWith('defuse_') ||
    item.type === 'retake_initiated'
  )) {
    assert.ok(event.zone && FPS_MAPS[report.mapId].zones[event.zone], `${event.type} must reference a map zone`);
  }
});
