import {FPS_T_POSITIONS,FPS_CT_POSITIONS} from './fps/fpsPlayerArchitecture.ts';
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  PLANT_CHANNEL_DURATION,
  PLANT_SETTLE_WINDOW,
  THIRD_PERSON_BACK_OFFSET,
  THIRD_PERSON_LOOK_AHEAD,
  DIRECTOR_WIDE_DURATION,
  DIRECTOR_WIDE_COOLDOWN,
  computeBombPlantPipPose,
  computeFreezeShowcasePose,
  computeThirdPersonCameraPose,
  createDirectorState,
  domRectToBabylonViewport,
  evaluateBroadcastDirector,
  selectBombPlantPip,
} from './fps/fpsBroadcastDirector.ts';
import { FPS_IDENTITY_PERSONALITIES, generatePlayerDNA } from './fps/fpsIdentity.ts';
import { LIVE_FPS_MAP, LIVE_COLLISION_SOLIDS, liveWallSegmentHit } from './fps/fpsLiveMap.ts';
import { LIVE_MID_WINDOW } from './fps/fpsLiveTerrain.ts';
import { FpsLiveSimulation } from './fps/fpsLiveSimulation.ts';
import { segmentHitsWall } from './fps/fpsSpatialWorld.ts';

const plan = { tempo: 0.6, structure: 0.7, aggression: 0.5, preparation: 0.7, freedom: 0.5, economy: 0.8 };
const coach = { ...plan, rigidity: 0.7, communication: 0.7, leadership: 0.7, adaptability: 0.7, development: 0.5 };
const chemistry = { trust: 0.6, communication: 0.6, understanding: 0.6, leadershipAcceptance: 0.6, roleCompetition: 0.3 };
const cards = Array.from({ length: 10 }, (_, i) => ({
  id: `dir-${i}`,
  name: `Op ${i}`,
  stats: { rifling: 80, positioning: 80, entry: 80, sniping: 80, utility: 80, shotcalling: 80 },
}));
const identity = {
  players: Object.fromEntries(
    cards.map((p, i) => [
      p.id,
      {
        id: p.id,
        assignments:{t:FPS_T_POSITIONS[(i)%5],ct:FPS_CT_POSITIONS[(i)%5]},personality: FPS_IDENTITY_PERSONALITIES[i],
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

function makeSplitFightSnapshot(time=35){
  const snap=makeLiveSnapshot(time),blue=snap.players.filter(p=>p.team==='blue'),red=snap.players.filter(p=>p.team==='red');
  for(const p of snap.players)p.hp=0;
  for(const [p,point] of [[blue[0],{x:-19,z:10,yaw:0}],[red[0],{x:-19,z:17,yaw:Math.PI}],
    [blue[1],{x:20,z:12,yaw:0}],[red[1],{x:20,z:17,yaw:Math.PI}]]){
    Object.assign(p,point,{hp:100,lastShot:time-.1,action:'Engaging'});
  }
  return snap;
}

function continueSplitFights(snap,time){snap.time=time;for(const p of snap.players)if(p.hp>0)p.lastShot=time-.1;}

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

test('director camera uses close-back third-person for quiet navigation and third person for freeze and cinematic post settle', () => {
  const state = createDirectorState();
  const snap = makeLiveSnapshot(20);
  snap.phase = 'freeze';
  assert.equal(evaluateBroadcastDirector(snap, state, 'director', snap.players[0].id).effectiveMode, 'third');

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
  assert.equal(evaluateBroadcastDirector(snap, state, 'director', snap.players[0].id).effectiveMode, 'cinematic');
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

  // The arrival kiosk is real shoulder-height cover behind this grounded player.
  // The former mid-backstop fixture is now the enterable elevated window room.
  p.x = 0;
  p.z = -22.9;
  p.yaw = 0;
  const nearWallPose = computeThirdPersonCameraPose(p);
  const hitsWall = LIVE_FPS_MAP.solids.some((w) =>
    segmentHitsWall(p, { x: nearWallPose.position.x, z: nearWallPose.position.z }, w, 0.2),
  );
  assert.equal(hitsWall, false);
  assert.ok(Math.hypot(nearWallPose.position.x-p.x,nearWallPose.position.z-p.z)<horizDist-.5,'The nearby kiosk must actually shorten the shoulder camera');
});

test('third-person camera inside the raised Mid window room clears 3D walls, floor and roof',()=>{
  const p=makeLiveSnapshot(30).players[0];
  const padded=(wall)=>({...wall,minX:wall.minX-.2,maxX:wall.maxX+.2,minZ:wall.minZ-.2,maxZ:wall.maxZ+.2,baseY:(wall.baseY??0)-.2,height:wall.height+.2});
  for(const crouch of [false,true])for(const yaw of [0,Math.PI/2,Math.PI,-Math.PI/2]){
    Object.assign(p,{x:2.4,z:20.5,jumpY:LIVE_MID_WINDOW.height,crouch,yaw});
    const pose=computeThirdPersonCameraPose(p),eye={x:p.x,y:p.jumpY+(crouch?1.24:1.64),z:p.z};
    assert.ok(pose.position.y>LIVE_MID_WINDOW.height+.2);
    assert.ok(pose.position.y<LIVE_MID_WINDOW.roofY-.2);
    assert.ok(!LIVE_COLLISION_SOLIDS.some(w=>liveWallSegmentHit(eye,pose.position,padded(w))!==undefined),JSON.stringify({yaw,crouch,pose}));
  }
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

test('bomb plant PIP hides when the main camera observes the bomb planter', () => {
  const state = createDirectorState();
  const snap = makeLiveSnapshot(48);
  const attackers = snap.players.filter((p) => p.attacking);
  const planter = attackers[0];
  const teammate = attackers[1];

  planter.bomb = true;
  planter.x = -23;
  planter.z = 21;
  planter.action = 'Planting';
  planter.channel = 1.8;

  // Observing someone else -> Bomb PIP renders
  const watchingOther = evaluateBroadcastDirector(snap, state, 'first', teammate.id);
  assert.equal(watchingOther.followedId, teammate.id);
  assert.equal(watchingOther.pip.active, true);
  assert.equal(watchingOther.pip.planterId, planter.id);

  // Observing the bomb planter -> Bomb PIP hides cleanly
  const watchingPlanter1P = evaluateBroadcastDirector(snap, state, 'first', planter.id);
  assert.equal(watchingPlanter1P.followedId, planter.id);
  assert.equal(watchingPlanter1P.pip.active, false);

  const watchingPlanter3P = evaluateBroadcastDirector(snap, state, 'third', planter.id);
  assert.equal(watchingPlanter3P.followedId, planter.id);
  assert.equal(watchingPlanter3P.pip.active, false);
});

test('auto director rotates off stale walkers to active snipers, utility executes, and imminent preview action', () => {
  const state = createDirectorState();
  const snap = makeLiveSnapshot(40);
  const blueA = snap.players[0];
  const redSniper = snap.players.find((p) => p.attacking);
  assert.ok(redSniper);

  // BlueA has been dwelled on >5s while completely idle
  state.followedId = blueA.id;
  state.cutAt = 34.0;

  // RedSniper is scoped with an enemy in front within range or throwing utility execute
  redSniper.equipped = 'sniper';
  redSniper.scopeState = 'scoped';
  redSniper.x = 0;
  redSniper.z = -4;
  redSniper.yaw = 0;
  const targetCt = snap.players.find((p) => !p.attacking && p.id !== blueA.id);
  assert.ok(targetCt);
  targetCt.x = 0;
  targetCt.z = 14;
  targetCt.yaw = Math.PI;

  const preview = makeLiveSnapshot(40.6);
  const decision = evaluateBroadcastDirector(snap, state, 'director', blueA.id, preview);
  assert.notEqual(decision.followedId, blueA.id);
  assert.equal(decision.effectiveMode, 'first');
});

test('auto director showcases both CT and T across buy-phase freeze and quiet rounds with creative showcase and tactical views', () => {
  const state = createDirectorState();
  const snap = makeLiveSnapshot(0);
  snap.phase = 'freeze';
  snap.remaining = 15;
  snap.players[2].weapon = 'sniper';
  snap.players[7].weapon = 'deagle';
  snap.players[5].action = 'Passing a bought weapon';

  const seenFreezeTeams = new Set();
  const seenFreezePlayers = new Set();
  for (let t = 0.2; t <= 14.2; t += 1.2) {
    snap.time = t;
    snap.remaining = 15 - t;
    const dec = evaluateBroadcastDirector(snap, state, 'director', snap.players[0].id);
    assert.equal(dec.effectiveMode, 'third');
    const p = snap.players.find((pl) => pl.id === dec.followedId);
    assert.ok(p);
    seenFreezeTeams.add(p.attacking ? 'T' : 'CT');
    seenFreezePlayers.add(p.id);
    const pose = computeFreezeShowcasePose(p, t);
    assert.ok(Math.hypot(pose.position.x - p.x, pose.position.z - p.z) >= 0.2);
  }
  assert.equal(seenFreezeTeams.size, 2, 'Buy-phase freeze AUTO cam must alternate across both CT and T teams');
  assert.ok(seenFreezePlayers.size >= 4, `Buy-phase freeze AUTO cam should rotate across buyers; saw ${seenFreezePlayers.size}`);

  // Live quiet navigation also rotates between teams even when neither side has shot yet
  snap.phase = 'live';
  const liveTeams = new Set();
  for (let t = 15.2; t <= 28.0; t += 1.5) {
    snap.time = t;
    const dec = evaluateBroadcastDirector(snap, state, 'director', snap.players[0].id);
    const p = snap.players.find((pl) => pl.id === dec.followedId);
    if (p) liveTeams.add(p.attacking ? 'T' : 'CT');
  }
  assert.equal(liveTeams.size, 2, 'Quiet live AUTO cam should balance coverage across both T and CT');

  // Separated live engagements unlock WIDE tactical coverage
  const split=makeSplitFightSnapshot(35);
  const wideDec = evaluateBroadcastDirector(split, state, 'director', split.players[0].id);
  assert.equal(wideDec.effectiveMode, 'tactical');
});

test('AUTO WIDE has a fixed deadline and stays in player view throughout a continuing split fight',()=>{
  const snap=makeSplitFightSnapshot(),state=createDirectorState();
  assert.equal(evaluateBroadcastDirector(snap,state,'director',snap.players[0].id).effectiveMode,'tactical');
  const deadline=state.wideUntil;
  assert.equal(deadline,snap.time+DIRECTOR_WIDE_DURATION);
  for(let i=1;i<=300;i++){
    continueSplitFights(snap,35+i*.1);
    const decision=evaluateBroadcastDirector(snap,state,'director',snap.players[0].id);
    if(snap.time<deadline){assert.equal(decision.effectiveMode,'tactical');assert.equal(state.wideUntil,deadline);}
    else assert.equal(decision.effectiveMode,'first','A sustained exchange cannot renew WIDE');
  }
});

test('an imminent kill interrupts AUTO WIDE immediately for the selected killer POV',()=>{
  const snap=makeSplitFightSnapshot(),state=createDirectorState();
  assert.equal(evaluateBroadcastDirector(snap,state,'director',snap.players[0].id).effectiveMode,'tactical');
  continueSplitFights(snap,35.4);
  const preview=structuredClone(snap),killer=snap.players.find(p=>p.team==='red'&&p.hp>0),victim=snap.players.find(p=>p.team==='blue'&&p.hp>0);
  preview.time=36;preview.events.push({id:900,time:35.8,kind:'kill',team:killer.team,actorId:killer.id,targetId:victim.id,text:'Eliminated'});
  const decision=evaluateBroadcastDirector(snap,state,'director',snap.players[0].id,preview);
  assert.equal(decision.effectiveMode,'first');assert.equal(decision.followedId,killer.id);
  assert.equal(state.wideUntil,0);
});

test('utility-only activity in separated areas cannot be mistaken for simultaneous exchanges',()=>{
  const snap=makeLiveSnapshot(),state=createDirectorState(),blue=snap.players.filter(p=>p.team==='blue');
  Object.assign(blue[0],{x:-19,z:17,utilityPrep:{kind:'smoke',releaseAt:36,phase:'pin'}});
  Object.assign(blue[1],{x:20,z:17,utilityPrep:{kind:'flash',releaseAt:36,phase:'pin'}});
  assert.notEqual(evaluateBroadcastDirector(snap,state,'director',blue[0].id).effectiveMode,'tactical');
});

test('AUTO WIDE requires both a cooldown and a new split-fight episode before returning',()=>{
  const snap=makeSplitFightSnapshot(),state=createDirectorState();
  evaluateBroadcastDirector(snap,state,'director',snap.players[0].id);
  assert.equal(state.wideCooldownUntil,35+DIRECTOR_WIDE_DURATION+DIRECTOR_WIDE_COOLDOWN);
  const quiet=time=>{
    snap.time=time;for(const p of snap.players){p.lastShot=-100;p.action='Advancing';}
    return evaluateBroadcastDirector(snap,state,'director',snap.players[0].id);
  };
  quiet(37);quiet(39.1);
  continueSplitFights(snap,40);
  assert.notEqual(evaluateBroadcastDirector(snap,state,'director',snap.players[0].id).effectiveMode,'tactical');
  continueSplitFights(snap,49);
  assert.notEqual(evaluateBroadcastDirector(snap,state,'director',snap.players[0].id).effectiveMode,'tactical','A delayed overview cannot interrupt the same fight after cooldown');
  quiet(50);quiet(52.1);continueSplitFights(snap,53);
  assert.equal(evaluateBroadcastDirector(snap,state,'director',snap.players[0].id).effectiveMode,'tactical');
});

test('AUTO leaves WIDE as soon as the secondary exchange stops and ignores a brief reappearance',()=>{
  const snap=makeSplitFightSnapshot(),state=createDirectorState();
  evaluateBroadcastDirector(snap,state,'director',snap.players[0].id);
  snap.time=35.2;for(const p of snap.players)if(p.x>0){p.lastShot=-100;p.action='Advancing';}
  assert.equal(evaluateBroadcastDirector(snap,state,'director',snap.players[0].id).effectiveMode,'first');
  continueSplitFights(snap,35.4);
  assert.equal(evaluateBroadcastDirector(snap,state,'director',snap.players[0].id).effectiveMode,'first');
});

test('manual WIDE remains available and returning to AUTO cannot resume an old overview',()=>{
  const snap=makeSplitFightSnapshot(),state=createDirectorState();
  evaluateBroadcastDirector(snap,state,'director',snap.players[0].id);
  for(const time of [36,40,60]){
    continueSplitFights(snap,time);
    assert.equal(evaluateBroadcastDirector(snap,state,'tactical',snap.players[0].id).effectiveMode,'tactical');
  }
  assert.equal(evaluateBroadcastDirector(snap,state,'director',snap.players[0].id).effectiveMode,'first');
});

test('a new round resets AUTO WIDE episode and cooldown state',()=>{
  const snap=makeSplitFightSnapshot(),state=createDirectorState();
  evaluateBroadcastDirector(snap,state,'director',snap.players[0].id);
  snap.round++;continueSplitFights(snap,40);
  assert.equal(evaluateBroadcastDirector(snap,state,'director',snap.players[0].id).effectiveMode,'tactical');
});
