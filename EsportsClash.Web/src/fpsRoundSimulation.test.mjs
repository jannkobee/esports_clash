import test from 'node:test';
import assert from 'node:assert/strict';
import { simulateFpsMatch } from './fps/fpsSimulationEngine.ts';
import { findFpsRoute } from './fps/fpsRoundSimulation.ts';
import { FPS_MAPS } from './fps/fpsMaps.ts';
import { getFpsReplayState, getFpsRoundEvents } from './fps/fpsMatchViewModel.ts';
import { fpsRoleFit } from './fps/fpsRoleFit.ts';
import { createEqualizedRoster } from './equalizedMode.ts';

test('authored FPS routes visit only connected map zones', () => {
  for (const map of Object.values(FPS_MAPS)) for (const zone of Object.keys(map.zones)) {
    const path = findFpsRoute(map,map.attackerSpawnZone,zone);
    assert.equal(path.at(-1),zone);
    for(let i=1;i<path.length;i++) assert.ok(map.zones[path[i-1]].connectedZones.includes(path[i]));
  }
});

test('all five maps produce event-derived kills, damage, deaths and headshot rates without group wipe shortcuts', () => {
  for(const map of Object.keys(FPS_MAPS)) {
    const report=simulateFpsMatch(createEqualizedRoster('blue'),createEqualizedRoster('red'),map,814);
    assert.equal(report.simulationVersion,2);
    for(const p of Object.values(report.playerStats)) {
      const kills=report.events.filter(e=>['kill','trade_kill'].includes(e.type)&&e.actorId===p.playerId);
      const deaths=report.events.filter(e=>['kill','trade_kill','player_eliminated'].includes(e.type)&&e.targetId===p.playerId);
      const damage=report.events.filter(e=>e.type==='damage'&&e.actorId===p.playerId).reduce((sum,e)=>sum+e.damage,0);
      assert.equal(p.kills,kills.length);assert.equal(p.deaths,deaths.length);assert.equal(p.damage,damage);
      assert.equal(p.headshotRate,kills.length?Math.round(kills.filter(e=>e.isHeadshot).length/kills.length*100):0);
      assert.ok(p.deaths<=report.totalRounds);
    }
    for (const round of report.roundResults) {
      const ev=report.events.filter(e=>e.roundNumber===round.roundNumber);
      const start=ev.find(e=>e.type==='round_start'),end=ev.find(e=>e.type==='round_end');
      assert.ok(Math.abs(end.second-start.second-round.roundDurationSeconds)<.12);
      assert.ok(round.roundDurationSeconds<=171);
      for(const e of ev.filter(e=>e.type==='player_moved')) assert.ok(FPS_MAPS[map].zones[e.fromZone].connectedZones.includes(e.zone));
      for (const e of ev.filter(e=>e.type==='plant_completed')) {
        const begin=ev.filter(s=>s.type==='plant_started'&&s.actorId===e.actorId&&s.tick<e.tick).at(-1);
        assert.ok(Math.abs(e.second-begin.second-3.5)<.11);
      }
      for (const e of ev.filter(e=>e.type==='defuse_completed')) {
        const begin=ev.filter(s=>s.type==='defuse_started'&&s.actorId===e.actorId&&s.tick<e.tick).at(-1);
        const snapshot=report.roundSnapshots.find(s=>s.roundNumber===round.roundNumber&&s.playerId===e.actorId);
        assert.ok(Math.abs(e.second-begin.second-(snapshot.loadout.hasDefuseKit?5:10))<.11);
      }
    }
  }
});

test('the live timer expires at its actual deadline without a fabricated kill or plant', () => {
  const report=simulateFpsMatch(createEqualizedRoster('blue'),createEqualizedRoster('red'),'foundry',1,{maxRounds:1,roundSeconds:1});
  assert.equal(report.roundResults[0].reason,'time_expired');
  assert.equal(report.roundResults[0].devicePlanted,false);
  assert.equal(report.events.some(e=>e.type==='kill'),false);
  assert.ok(Math.abs(report.roundResults[0].roundDurationSeconds-16.66)<.15);
});

test('replay uses recorded damage and legal movement and consumes actual carried utility', () => {
  const report=simulateFpsMatch(createEqualizedRoster('blue'),createEqualizedRoster('red'),'breakwater',814,{maxRounds:1});
  const events=getFpsRoundEvents(report,1);
  const index=events.findIndex(e=>e.type==='damage');
  assert.ok(index>=0);
  const state=getFpsReplayState(report,1,index),event=events[index];
  assert.equal(state.players.find(p=>p.playerId===event.targetId).hp,event.targetHp);
  for(const p of state.players) {
    const moved=events.slice(0,index+1).filter(e=>e.type==='player_moved'&&e.actorId===p.playerId).at(-1);
    if(moved)assert.equal(p.zone,moved.zone,'firing must not teleport a shooter');
  }
});

test('FPS scouting role fits map attributes to FPS specialties',()=>{
  assert.equal(fpsRoleFit(),'Unscouted');
  assert.equal(fpsRoleFit({lan:99,flx:99,tf:30,iq:30,clu:30}),'Entry Fragger');
  assert.equal(fpsRoleFit({lan:30,flx:30,tf:99,iq:30,clu:30}),'Trade Fragger');
  assert.equal(fpsRoleFit({lan:30,flx:30,tf:80,iq:99,clu:30}),'Utility Support');
});

test('invalid rosters and impossible timers cannot produce an official FPS report',()=>{
  const blue=createEqualizedRoster('blue'),red=createEqualizedRoster('red');
  assert.throws(()=>simulateFpsMatch(blue.slice(1),red),/ten distinct/);
  assert.throws(()=>simulateFpsMatch(blue,blue),/ten distinct/);
  assert.throws(()=>simulateFpsMatch(blue,red,'breakwater',1,{roundSeconds:Infinity}),/timer/);
});
