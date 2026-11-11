import test from 'node:test';
import assert from 'node:assert/strict';
import { PERSONALITIES, PERSONALITY_IDS } from './playerPersonality.ts';
import { createEqualizedRoster } from './equalizedMode.ts';
import {
  FPS_PERSONALITIES, assignFpsTeamRoles, getFpsPreferences, initialFpsPsychology,
  rankFpsPlayers, shouldSaveFpsRetake, updateFpsPsychology,
} from './fps/fpsPersonality.ts';
import { initializePlayerState, simulateFpsMatch } from './fps/fpsSimulationEngine.ts';
import { calculateDuelHitDamage, executeSetPiece, generateSetPieceCall } from './fps/setPieceRules.ts';
import { determineTeamBuyDecision, executePlayerPurchases } from './fps/fpsEconomy.ts';
import { FPS_MAPS } from './fps/maps.ts';
import { getFpsReplayState } from './fps/fpsMatchViewModel.ts';

function player(id, trait = 'cold_as_ice', side = 'attackers', secondary = trait) {
  const card = structuredClone(createEqualizedRoster('blue')[0]);
  Object.assign(card, { id, primaryPersonality: trait, secondaryPersonality: secondary });
  card.stats = { lan: 70, tf: 70, iq: 70, ldr: 70, clu: 80, sta: 70, flx: 70 };
  return initializePlayerState(card, side === 'attackers' ? 'blue' : 'red', side, 800);
}

test('all 30 stable personality IDs have FPS descriptions and bounded preferences; historical definitions stay intact', () => {
  assert.deepEqual(Object.keys(FPS_PERSONALITIES).sort(), [...PERSONALITY_IDS].sort());
  assert.equal(PERSONALITIES.wave_architect.name, 'Wave Architect');
  assert.equal(FPS_PERSONALITIES.wave_architect.name, 'Execute Architect');
  for (const id of PERSONALITY_IDS) {
    const p = player(id, id);
    const before = structuredClone(p.card);
    assert.ok(FPS_PERSONALITIES[id].description && FPS_PERSONALITIES[id].tradeoff);
    const prefs = getFpsPreferences(p.card, { ...initialFpsPsychology(), frustration: 100, lossStreak: 5 });
    assert.ok(Object.values(prefs).every(value => Number.isFinite(value) && value >= -1 && value <= 1));
    assert.deepEqual(p.card, before);
  }
});

test('both traits contribute equally, duplicates do not stack, and role ties use stable player IDs', () => {
  const mixed = getFpsPreferences(player('mixed', 'bodyguard', 'attackers', 'first_blood_hunter').card);
  const first = getFpsPreferences(player('first', 'bodyguard').card);
  const second = getFpsPreferences(player('second', 'first_blood_hunter').card);
  assert.equal(mixed.aggression, (first.aggression + second.aggression) / 2);
  const peers = [player('z'), player('a'), player('m')];
  assert.deepEqual(rankFpsPlayers(peers, 'entry').map(p => p.playerId), ['a', 'm', 'z']);
  assert.deepEqual(peers.map(p => p.playerId), ['z', 'a', 'm']);
});

test('personality resolves close role assignments but does not replace mechanical skill', () => {
  const hunter = player('hunter', 'first_blood_hunter');
  const guard = player('guard', 'bodyguard');
  assert.equal(rankFpsPlayers([guard, hunter], 'entry')[0], hunter);
  assert.equal(rankFpsPlayers([hunter, guard], 'trade')[0], guard);
  guard.card.stats.lan = 99;
  assert.equal(rankFpsPlayers([hunter, guard], 'entry')[0], guard);
  const team = [hunter, guard, player('caller', 'igl'), player('planner', 'wave_architect'), player('fifth')];
  assignFpsTeamRoles(team);
  assert.equal(team.filter(p => p.tactics.role === 'entry').length, 1);
  assert.equal(team.filter(p => p.tactics.role === 'trade').length, 2);
  assert.equal(team.filter(p => p.tactics.role === 'support').length, 2);
  assert.equal(team.find(p => p.tactics.isCaller).playerId, 'caller');
  team.forEach(p => { p.side = 'defenders'; });
  assignFpsTeamRoles(team);
  assert.equal(team.filter(p => p.tactics.role === 'anchor').length, 1);
  assert.equal(team.filter(p => p.tactics.role === 'entry').length, 0);
});

test('losing rounds builds volatility, stable traits resist it, and captains aid recovery without mutating skills', () => {
  const volatile = player('volatile', 'short_fuse');
  const stable = player('stable', 'untiltable');
  const supported = player('supported', 'short_fuse');
  const captain = player('captain', 'captain');
  const original = structuredClone(volatile.card);
  for (let round = 1; round <= 6; round++) {
    for (const p of [volatile, stable, supported]) p.isAlive = false;
    updateFpsPsychology(volatile, false, round, [volatile]);
    updateFpsPsychology(stable, false, round, [stable]);
    updateFpsPsychology(supported, false, round, [supported, captain]);
  }
  assert.ok(volatile.psychology.frustration > stable.psychology.frustration);
  assert.ok(supported.psychology.frustration < volatile.psychology.frustration);
  assert.ok(volatile.psychology.composure < stable.psychology.composure);
  assert.deepEqual(volatile.card, original);
  const snapshot = structuredClone(volatile.psychology);
  updateFpsPsychology(volatile, true, 6, [volatile]);
  assert.deepEqual(volatile.psychology, snapshot, 'duplicate round feedback is ignored');
  updateFpsPsychology(volatile, true, 7, [volatile]);
  assert.ok(volatile.psychology.frustration < snapshot.frustration);
  assert.equal(volatile.psychology.lossStreak, 0);
});

test('round feedback changes decisions and conditional trait pairs remain bounded', () => {
  const momentum = player('momentum', 'momentum_junkie');
  const winning = getFpsPreferences(momentum.card, { ...initialFpsPsychology(), winStreak: 4 });
  const losing = getFpsPreferences(momentum.card, { ...initialFpsPsychology(), lossStreak: 4 });
  assert.ok(winning.aggression > losing.aggression);
  const conflicted = player('pair', 'overconfident', 'attackers', 'survivalist');
  const fresh = getFpsPreferences(conflicted.card);
  const behind = getFpsPreferences(conflicted.card, { ...initialFpsPsychology(), lossStreak: 3 });
  assert.ok(behind.aggression < fresh.aggression);
  assert.ok(behind.conservation > fresh.conservation);
  const supportPair = getFpsPreferences(player('support-pair', 'bodyguard', 'attackers', 'loyalist').card);
  const averageUtility = (getFpsPreferences(player('guard', 'bodyguard').card).utility
    + getFpsPreferences(player('loyal', 'loyalist').card).utility) / 2;
  assert.ok(supportPair.utility > averageUtility, 'the support pair adds a real, unsaturated utility preference');
});

test('personality and mindset never modify damage or headshot calculations with the same gun and random inputs', () => {
  const aggressive = player('aggressive', 'short_fuse');
  const patient = player('patient', 'patient_predator');
  aggressive.psychology.frustration = 100;
  const target = player('target');
  const a = calculateDuelHitDamage(aggressive, structuredClone(target), 'medium', false, false, () => .6);
  const b = calculateDuelHitDamage(patient, structuredClone(target), 'medium', false, false, () => .6);
  assert.deepEqual(a, b);
});

test('conservation changes marginal buys, respects match point, and cannot award cash', () => {
  const cautious = Array.from({ length: 5 }, (_, i) => player(`c${i}`, 'survivalist'));
  const bold = Array.from({ length: 5 }, (_, i) => player(`b${i}`, 'steal_gambler'));
  [...cautious, ...bold].forEach(p => { p.cash = 2500; });
  assert.equal(determineTeamBuyDecision(cautious, 5, 2, 2), 'eco_save');
  assert.equal(determineTeamBuyDecision(bold, 5, 2, 2), 'force_buy');
  assert.equal(determineTeamBuyDecision(cautious, 25, 15, 9), 'force_buy');
  for (const p of [...cautious, ...bold]) {
    executePlayerPurchases(p, 'force_buy', 5, false, () => .5);
    assert.ok(p.cash >= 0 && p.cash <= 2500);
    assert.ok(p.loadout.utilities.length <= 3);
    assert.equal(p.loadout.hasDefuseKit, false, 'attackers cannot buy a defuse kit');
  }
});

test('sniper affinity uses FPS preparation and skills independently of legacy avatar roles', () => {
  const a = player('a', 'patient_predator');
  const b = player('b', 'patient_predator');
  a.card.preferredRole = 'Support';
  b.card.preferredRole = 'Assassin';
  for (const p of [a, b]) {
    p.cash = 10000;
    p.card.stats.lan = 95;
    executePlayerPurchases(p, 'full_buy', 5, false, () => .5);
  }
  assert.equal(a.loadout.primaryWeapon, 'rifle_sniper');
  assert.deepEqual(a.loadout, b.loadout);
  assert.equal(a.cash, b.cash);
});

test('save preferences require a severe numerical deficit and valuable equipment', () => {
  const survivor = player('s', 'survivalist', 'defenders');
  const enemies = Array.from({ length: 3 }, (_, i) => player(`e${i}`));
  assert.equal(shouldSaveFpsRetake([survivor], enemies), false, 'no primary to preserve');
  survivor.loadout.primaryWeapon = 'rifle_assault';
  assert.equal(shouldSaveFpsRetake([survivor], enemies), true);
  assert.equal(shouldSaveFpsRetake([survivor], enemies.slice(0, 2)), false, '1v2 still attempts retake');
  survivor.card.primaryPersonality = survivor.card.secondaryPersonality = 'steal_gambler';
  assert.equal(shouldSaveFpsRetake([survivor], enemies), false);
  survivor.isAlive = false;
  assert.equal(shouldSaveFpsRetake([survivor], enemies), false, 'dead players cannot save');
});

test('a saved retake emits evidence and preserves a surviving defender and equipment after the plant', () => {
  const map = structuredClone(FPS_MAPS.breakwater);
  const attackers = Array.from({ length: 5 }, (_, i) => player(`a${i}`));
  const defender = player('saver', 'survivalist', 'defenders');
  defender.loadout.primaryWeapon = 'rifle_assault';
  defender.currentZone = map.attackerSpawnZone;
  map.rotationTimes[defender.currentZone] = Object.fromEntries(map.zones[defender.currentZone].connectedZones.map(id => [id,100]));
  attackers.forEach(p => { p.currentZone = map.siteAZones[0]; });
  attackers[4].loadout.hasBomb = true;
  const call = generateSetPieceCall(attackers, [defender], map, 1, () => 0);
  call.strategy = 'fast_rush';
  const result = executeSetPiece(call, attackers, [defender], map, 1, 0, 0, () => 0);
  assert.equal(result.devicePlanted, true);
  assert.equal(result.defused, false);
  assert.equal(result.events.filter(e => e.type === 'save_equipment').length, 1);
  assert.equal(defender.isAlive, true);
  assert.equal(defender.loadout.primaryWeapon, 'rifle_assault');
  assert.equal(result.events.some(e => e.type === 'defuse_completed'), false);
});

test('personality telemetry survives JSON replay, never leaks later rounds, and fresh matches reset it', () => {
  const blue = createEqualizedRoster('blue');
  const red = createEqualizedRoster('red');
  const original = structuredClone([blue, red]);
  const report = simulateFpsMatch(blue, red, 'foundry', 909);
  assert.equal(report.personalityVersion, 1);
  assert.deepEqual([blue, red], original);
  assert.deepEqual(report, simulateFpsMatch(blue, red, 'foundry', 909));
  const replayReport = JSON.parse(JSON.stringify(report));
  for (const round of [1, 2, 16]) {
    const replay = getFpsReplayState(replayReport, round, -1);
    assert.equal(replay.players.length, 10);
    for (const p of replay.players) {
      assert.equal(p.tactics.mood.lastRound, round - 1);
      assert.ok(p.tactics.traits.length >= 1 && p.tactics.traits.length <= 2);
    }
  }
  const initial = getFpsReplayState(replayReport, 1, -1).players[0];
  initial.tactics.mood.frustration = 99;
  assert.equal(report.roundSnapshots[0].tactics.mood.frustration, 10);
  assert.equal(replayReport.roundSnapshots[0].tactics.mood.frustration, 10);
  for (const snapshot of replayReport.roundSnapshots.filter(p => p.loadout.hasBomb)) {
    assert.equal(snapshot.tactics.role, 'support');
  }
  delete replayReport.personalityVersion;
  replayReport.roundSnapshots.forEach(p => { delete p.tactics; });
  assert.equal(getFpsReplayState(replayReport, 1, -1).players[0].tactics, undefined);
});
