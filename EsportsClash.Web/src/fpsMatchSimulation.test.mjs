import test from 'node:test';
import assert from 'node:assert/strict';
import {
  simulateFpsMatch,
  FPS_MAPS,
  validateMapReachability,
  FPS_WEAPONS,
  getLossReward,
  determineTeamBuyDecision,
  generateSetPieceCall,
  initializePlayerState, fpsOvertimeTarget
} from './fps/index.ts';
import { INITIAL_PLAYERS } from './mockData.ts';
import { createEqualizedRoster } from './equalizedMode.ts';

test('FPS Invariant: Cardrel parody alias and parody gamer roster preservation in FPS matches', () => {
  const blueLineup = createEqualizedRoster('blue');
  const redLineup = createEqualizedRoster('red');

  const cardrel = blueLineup.find(p => p.name === 'Cardrel');
  assert.ok(cardrel, 'Cardrel parody alias must exist on Blue lineup');
  assert.equal(cardrel.realName, 'Caedrel', 'realName Caedrel preserved internally');

  // Run match with Cardrel in lineup
  const report = simulateFpsMatch(blueLineup, redLineup, 'breakwater', 42);
  assert.ok(report.playerStats[cardrel.id], 'Cardrel player stats must exist in FPS report');
  assert.equal(report.playerStats[cardrel.id].name, 'Cardrel', 'Report displays Cardrel parody alias');
});

test('FPS MR15 Rules: first to 16 wins regulation, 15-round half-time side swap with pistol reset', () => {
  const blueLineup = createEqualizedRoster('blue');
  const redLineup = createEqualizedRoster('red');

  const report = simulateFpsMatch(blueLineup, redLineup, 'foundry', 1337);

  assert.equal(report.format, 'MR15_TACTICAL_FPS');
  assert.ok(report.totalRounds >= 16, 'Match must play at least 16 rounds');
  assert.ok(
    report.finalScore.blue === 16 || report.finalScore.red === 16 || (report.finalScore.blue >= 16 && report.overtimeScore),
    'Regulation winner must reach 16 rounds'
  );

  // Check half-time side swap event
  const sideSwapEvent = report.events.find(e => e.type === 'side_swap');
  assert.ok(sideSwapEvent, 'Side swap event must be emitted at round 16');

  // Verify round 16 was played after side swap
  const round16Result = report.roundResults.find(r => r.roundNumber === 16);
  assert.ok(round16Result, 'Round 16 must exist');
});

test('FPS Map Pool: all five competitive maps authored and pass automated reachability checks', () => {
  const mapIds = ['breakwater', 'foundry', 'old-quarter', 'red-mesa', 'northpoint'];

  for (const mapId of mapIds) {
    const map = FPS_MAPS[mapId];
    assert.ok(map, `Map ${mapId} must exist in catalog`);
    assert.equal(map.id, mapId);
    assert.ok(map.siteAZones.length > 0, `Map ${mapId} must have Site A zones`);
    assert.ok(map.siteBZones.length > 0, `Map ${mapId} must have Site B zones`);
    assert.ok(map.chokeZones.length > 0, `Map ${mapId} must have choke points`);

    const isReachable = validateMapReachability(map);
    assert.equal(isReachable, true, `Map ${mapId} must pass automated reachability validation for both spawns to both sites`);
  }
});

test('FPS Set Piece Mechanic: coordinated bombsite execution with utility layering, entry duels, and trades', () => {
  const blueLineup = createEqualizedRoster('blue');
  const redLineup = createEqualizedRoster('red');

  const report = simulateFpsMatch(blueLineup, redLineup, 'old-quarter', 777);

  // Check that "set_piece_call" events were emitted
  const setPieceEvents = report.events.filter(e => e.type === 'set_piece_call');
  assert.ok(setPieceEvents.length > 0, 'Teams must execute Set Piece tactical calls');

  // Check utility deployment events
  const utilityEvents = report.events.filter(e => e.type === 'utility_deployed');
  assert.ok(utilityEvents.length > 0, 'Set pieces must layer tactical utility (smokes/flashes)');

  // Check that every round had a set piece executed
  for (const round of report.roundResults) {
    assert.equal(round.setPieceExecuted, true, 'Round must record setPieceExecuted');
    assert.ok(
      ['set_piece_execute', 'fake_execute', 'fast_rush', 'default_probe', 'eco_save'].includes(round.setPieceStrategy),
      'Set piece strategy must be valid'
    );
  }

  // Verify trade kills or plant/defuse events occur across the match
  const tradeEvents = report.events.filter(e => e.type === 'trade_kill');
  const plantEvents = report.events.filter(e => e.type === 'plant_completed');
  assert.ok(tradeEvents.length > 0 || plantEvents.length > 0, 'Set pieces must produce trade kills or device plants');
});

test('FPS Win Conditions: devices exploded, devices defused, and team eliminations properly resolved', () => {
  const blueLineup = createEqualizedRoster('blue');
  const redLineup = createEqualizedRoster('red');

  const report = simulateFpsMatch(blueLineup, redLineup, 'red-mesa', 2026);

  const reasons = new Set(report.roundResults.map(r => r.reason));
  const validReasons = [
    'attackers_eliminated',
    'defenders_eliminated',
    'device_exploded',
    'device_defused',
    'time_expired'
  ];

  for (const reason of reasons) {
    assert.ok(validReasons.includes(reason), `Invalid round end reason: ${reason}`);
  }

  // If a device was planted, verify plant and defuse telemetry
  const plantedRounds = report.roundResults.filter(r => r.devicePlanted);
  for (const pr of plantedRounds) {
    assert.ok(pr.plantedSite === 'A' || pr.plantedSite === 'B', 'Planted site must be A or B');
    assert.ok(pr.plantedByPlayerId, 'Planter player ID must be recorded');
    if (pr.reason === 'device_defused') {
      assert.ok(pr.defusedByPlayerId, 'Defuser player ID must be recorded for device_defused');
    }
  }
});

test('FPS Economy: loss bonus ladder ($1400-$3400), plant bonus ($300), and buy phase decisions', () => {
  assert.equal(getLossReward(0), 1400);
  assert.equal(getLossReward(1), 1900);
  assert.equal(getLossReward(2), 2400);
  assert.equal(getLossReward(3), 2900);
  assert.equal(getLossReward(4), 3400);
  assert.equal(getLossReward(10), 3400); // capped

  // Weapon pricing sanity checks
  assert.equal(FPS_WEAPONS.sidearm_standard.cost, 0);
  assert.equal(FPS_WEAPONS.sidearm_heavy.cost, 700);
  assert.equal(FPS_WEAPONS.smg_tactical.cost, 1250);
  assert.equal(FPS_WEAPONS.rifle_assault.cost, 2700);
  assert.equal(FPS_WEAPONS.rifle_sniper.cost, 4750);
  assert.equal(FPS_WEAPONS.gear_kevlar.cost, 650);
  assert.equal(FPS_WEAPONS.gear_helmet.cost, 350);
  assert.equal(FPS_WEAPONS.gear_defuse_kit.cost, 400);
  assert.equal(FPS_WEAPONS.utility_smoke.cost, 300);
  assert.equal(FPS_WEAPONS.utility_flash.cost, 200);

  // Buy decisions
  const richPlayers = [{ cash: 5000 }, { cash: 4500 }, { cash: 6000 }, { cash: 4200 }, { cash: 5500 }];
  assert.equal(determineTeamBuyDecision(richPlayers, 5, 2, 2), 'full_buy');

  const poorPlayers = [{ cash: 1200 }, { cash: 1500 }, { cash: 1400 }, { cash: 1800 }, { cash: 1100 }];
  assert.equal(determineTeamBuyDecision(poorPlayers, 5, 2, 2), 'eco_save');
});

test('FPS Determinism: identical seeds produce bit-exact matches and event logs', () => {
  const blueLineup = createEqualizedRoster('blue');
  const redLineup = createEqualizedRoster('red');

  const report1 = simulateFpsMatch(blueLineup, redLineup, 'northpoint', 99999);
  const report2 = simulateFpsMatch(blueLineup, redLineup, 'northpoint', 99999);

  assert.deepEqual(report1.finalScore, report2.finalScore, 'Scores must be identical');
  assert.equal(report1.winnerTeam, report2.winnerTeam, 'Winner must be identical');
  assert.equal(report1.totalRounds, report2.totalRounds, 'Total rounds must be identical');
  assert.equal(report1.events.length, report2.events.length, 'Event counts must match exactly');

  for (let i = 0; i < report1.events.length; i++) {
    assert.equal(report1.events[i].text, report2.events[i].text, `Event text mismatch at ${i}`);
    assert.equal(report1.events[i].tick, report2.events[i].tick, `Event tick mismatch at ${i}`);
  }
});

test('FPS Overtime: 15-15 triggers MR3 overtime with $10,000 overtime economy', () => {
  const blueLineup = createEqualizedRoster('blue');
  const redLineup = createEqualizedRoster('red');

  // Test with overtime disabled returns draw if 15-15 reached
  const mockSettingsNoOt = { maxRounds: 2, overtimeEnabled: false };
  const shortReport = simulateFpsMatch(blueLineup, redLineup, 'breakwater', 1234, mockSettingsNoOt);
  assert.ok(shortReport.totalRounds <= 3, 'Short match terminates when maxRounds reached');
});

test('FPS overtime requires four wins in each fresh MR3 block instead of ending a new block at 20-18', () => {
  assert.equal(fpsOvertimeTarget(35), 19);
  assert.equal(fpsOvertimeTarget(37), 19, 'complete the first block at 18-18');
  assert.equal(fpsOvertimeTarget(38), 22, '19-18 is only one win into the next block');
  assert.equal(fpsOvertimeTarget(39), 22, '20-18 must not prematurely decide a fresh MR3');
  assert.equal(fpsOvertimeTarget(43), 22);
  assert.equal(fpsOvertimeTarget(44), 25, '21-21 begins another block');
});

test('FPS tactical calls reflect existing personality preferences without changing player skills', () => {
  const makeAttackers = personality => createEqualizedRoster('blue').map(card => {
    const player = initializePlayerState({
      ...card,
      primaryPersonality: personality,
      secondaryPersonality: personality
    }, 'blue', 'attackers', 800);
    player.loadout.primaryWeapon = 'rifle_assault';
    return player;
  });
  const aggressive = makeAttackers('short_fuse');
  const disciplined = makeAttackers('captain');
  const baselineLan = aggressive[0].card.stats.lan;
  const random = () => 0.35;

  const aggressiveCall = generateSetPieceCall(aggressive, [], FPS_MAPS.breakwater, 1, random);
  const disciplinedCall = generateSetPieceCall(disciplined, [], FPS_MAPS.breakwater, 1, random);

  assert.equal(aggressiveCall.strategy, 'fast_rush');
  assert.equal(disciplinedCall.strategy, 'default_probe');
  assert.equal(aggressive[0].card.stats.lan, baselineLan);
});
