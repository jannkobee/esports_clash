// Official matches on the live 3D engine (simulation v5) and their compact public replays.
import test from 'node:test';
import assert from 'node:assert/strict';
import {FPS_T_POSITIONS,FPS_CT_POSITIONS} from './fps/fpsPlayerArchitecture.ts';
import {FpsLiveSimulation} from './fps/fpsLiveSimulation.ts';
import {FPS_IDENTITY_PERSONALITIES,generatePlayerDNA} from './fps/fpsIdentity.ts';
import {simulateOfficialLiveMatch,officialLiveMapForSeed,FPS_OFFICIAL_LIVE_MAPS} from './fps/fpsOfficialLiveMatch.ts';
import {FpsLiveReplayRecorder,FpsLiveReplaySource,decodeReplayChunk,publicLiveSnapshot,diffReplay,applyReplayDelta,FPS_REPLAY_FRAMES_PER_CHUNK} from './fps/fpsLiveReplay.ts';

const plan={tempo:.6,structure:.7,aggression:.5,preparation:.7,freedom:.5,economy:.8};
const coach={...plan,rigidity:.7,communication:.7,leadership:.7,adaptability:.7,development:.5};
const chemistry={trust:.6,communication:.6,understanding:.6,leadershipAcceptance:.6,roleCompetition:.3};
const cards=Array.from({length:10},(_,i)=>({id:`off-${i}`,name:`Player ${i}`,stats:{rifling:60+i,sniping:55,entry:62,utility:58,positioning:64,shotcalling:57}}));
const identity={players:Object.fromEntries(cards.map((p,i)=>[p.id,{id:p.id,assignments:{t:FPS_T_POSITIONS[i%5],ct:FPS_CT_POSITIONS[i%5]},personality:FPS_IDENTITY_PERSONALITIES[i*5%54],dna:generatePlayerDNA(p.id),roleSuitability:.6,familiarity:.5}])),teams:{blue:{coach,plan,chemistry},red:{coach,plan,chemistry}}};
const PRIVATE=/"dna"|"diagnostics"|"mental"|"skillProfile"|"behavior"|tendencyOverrides|identityExperiment/;

/** Record `steps` ticks of a live simulation as replay chunks. */
function record(steps){
  const sim=new FpsLiveSimulation(cards.slice(0,5),cards.slice(5),31337,identity,{mapId:'fontessa'});
  const chunks=[],recorded=[];
  const recorder=new FpsLiveReplayRecorder(c=>chunks.push(c));
  for(let i=0;i<steps;i++){sim.step();const cues=sim.drainAudioCues();recorder.tick(()=>{const s=sim.snapshot();recorded.push(publicLiveSnapshot(s));return s;},cues);}
  recorder.finish(sim.snapshot());recorded.push(publicLiveSnapshot(sim.snapshot()));
  return {chunks,recorded};
}

test('structural deltas round-trip arbitrary public state',()=>{
  const a={x:1,list:[{id:1,v:2},{id:2,v:3}],gone:true,nested:{k:'a'}},b={x:1.5,list:[{id:1,v:2},{id:2,v:4}],nested:{k:'b',n:null},extra:[1,2]};
  assert.deepEqual(applyReplayDelta(a,diffReplay(a,b)),b);
  assert.equal(diffReplay(b,structuredClone(b)),undefined);
});

test('a recorded broadcast decodes frame for frame, in whole chunks, with no private state',()=>{
  const {chunks,recorded}=record(1200);
  assert.ok(chunks.length>=3);
  const frames=chunks.flatMap(decodeReplayChunk);
  assert.equal(frames.length,recorded.length);
  frames.forEach((f,i)=>{const {events:a,teamReports:b,...fr}=f,{events:c,teamReports:d,...wr}=recorded[i];assert.deepEqual(fr,wr,`frame ${i}`);assert.deepEqual(a.map(e=>e.id),c.map(e=>e.id));});
  assert.ok(chunks.every((c,i)=>c.index===i&&c.startFrame===i*FPS_REPLAY_FRAMES_PER_CHUNK));
  assert.ok(!PRIVATE.test(JSON.stringify(chunks)),'no private identity in a public replay');
  for(const p of frames[frames.length-1].players)for(const t of p.topTendencies??[])assert.ok(Number.isInteger(t.value)&&t.value>=1&&t.value<=10,'tendencies only as 1–10 levels');
});

test('the replay source plays at 30 Hz, interpolates bodies, buffers and follows a growing live header',async()=>{
  const {chunks,recorded}=record(1200);
  const total=recorded.length;
  // While live, only whole chunks are visible; the final header carries the true frame count.
  const header=(n,complete)=>({version:1,mapId:'fontessa',seed:31337,frameSeconds:.1,framesPerChunk:FPS_REPLAY_FRAMES_PER_CHUNK,frames:complete?total:n*FPS_REPLAY_FRAMES_PER_CHUNK,chunks:n,complete,players:[]});
  let requests=0;
  const source=new FpsLiveReplaySource(header(2,false),async i=>{requests++;return chunks[i];});
  await source.ready();await new Promise(r=>setTimeout(r,0));
  const first=source.snapshot();source.step();const mid=source.snapshot();source.step();source.step();const next=source.snapshot();
  const p0=first.players[0],p1=mid.players[0],p3=next.players[0];
  if(Math.hypot(p3.x-p0.x,p3.z-p0.z)>.01)assert.ok(Math.hypot(p1.x-p0.x,p1.z-p0.z)<Math.hypot(p3.x-p0.x,p3.z-p0.z)+1e-9,'the in-between tick lies between frames');
  for(let i=0;i<2000;i++)source.step();
  assert.equal(Math.floor(source.seconds*10),199,'waits at the live edge');
  assert.equal(source.finished,false);
  source.updateHeader(header(chunks.length,true));await new Promise(r=>setTimeout(r,0));
  for(let i=0;i<5000&&!source.finished;i++){source.step();if(i%300===0)await new Promise(r=>setTimeout(r,0));}
  assert.ok(source.finished);assert.ok(source.seconds>=(total-1)*.1-1e-6);
  assert.ok(requests<=chunks.length+1,'each chunk is loaded once');
});

test('an expired replay (HTTP 410) stops the source instead of retrying, other failures retry',async()=>{
  const {chunks,recorded}=record(700);
  const header={version:1,mapId:'fontessa',seed:31337,frameSeconds:.1,framesPerChunk:FPS_REPLAY_FRAMES_PER_CHUNK,frames:recorded.length,chunks:chunks.length,complete:true,players:[]};
  const gone=Object.assign(new Error('This replay is no longer available.'),{status:410});
  // Expired before playback: ready() rejects and the source is marked unavailable.
  let notified=0,requests=0;
  const expired=new FpsLiveReplaySource(header,async()=>{requests++;throw gone;},0,()=>notified++);
  await assert.rejects(expired.ready(),/no longer available/);
  await new Promise(r=>setTimeout(r,0));
  assert.equal(expired.unavailable,true);assert.equal(notified,1);
  const before=requests;for(let i=0;i<50;i++)expired.step();await new Promise(r=>setTimeout(r,0));
  assert.equal(requests,before,'no retries once the replay is gone');
  // Expired during playback: the first chunk loads, the next answers 410.
  let midNotified=0;
  const mid=new FpsLiveReplaySource(header,async i=>{if(i>=1)throw gone;return chunks[i];},0,()=>midNotified++);
  await mid.ready();
  for(let i=0;i<400;i++){mid.step();if(i%50===0)await new Promise(r=>setTimeout(r,0));}
  assert.equal(mid.unavailable,true);assert.equal(midNotified,1);
  // A transient failure (not 410) is retried.
  let attempts=0;
  const flaky=new FpsLiveReplaySource(header,async i=>{attempts++;if(attempts===1)throw Object.assign(new Error('busy'),{status:503});return chunks[i];});
  await new Promise(r=>setTimeout(r,0));flaky.step();await new Promise(r=>setTimeout(r,0));
  assert.equal(flaky.unavailable,false);assert.ok(attempts>=2);
});

test('the official map comes from the seed and only live maps are accepted',()=>{
  assert.ok(FPS_OFFICIAL_LIVE_MAPS.includes(officialLiveMapForSeed(7)));
  assert.throws(()=>simulateOfficialLiveMatch(cards.slice(0,5),cards.slice(5),3,'breakwater',identity),/Unsupported official live map/);
});

test('an official live match settles as a valid MR15 report with lawful, aggregated behaviour',{timeout:400_000},()=>{
  const report=simulateOfficialLiveMatch(cards.slice(0,5),cards.slice(5),8128,'spillway',identity);
  assert.equal(report.simulationVersion,5);assert.equal(report.engine,'live-3d');assert.equal(report.mapId,'spillway');
  assert.ok(report.finalScore[report.winner]>=16);
  const score={blue:0,red:0};
  report.roundResults.forEach((r,i)=>{assert.equal(r.roundNumber,i+1);assert.ok(['attackers_eliminated','defenders_eliminated','device_exploded','device_defused','time_expired'].includes(r.reason));
    assert.ok(r.roundDurationSeconds>0);score[r.winnerTeam]++;assert.equal(r.blueScoreAfter,score.blue);assert.equal(r.redScoreAfter,score.red);});
  assert.deepEqual(score,report.finalScore);assert.equal(report.totalRounds,report.roundResults.length);
  assert.equal(Object.keys(report.playerStats).length,10);
  const kills=Object.values(report.playerStats).reduce((s,p)=>s+p.kills,0);
  assert.equal(kills,report.events.filter(e=>e.type==='kill').length);
  for(const p of Object.values(report.playerStats))assert.ok(p.headshotRate>=0&&p.headshotRate<=100&&p.adr>=0);
  for(const [id,metrics] of Object.entries(report.behaviorSummary)){assert.ok(identity.players[id]);for(const m of Object.values(metrics))assert.ok(Number.isInteger(m.opportunities)&&m.attempts<=m.opportunities);}
  assert.equal(report.roundSnapshots.length,report.totalRounds*10);
  assert.ok(!PRIVATE.test(JSON.stringify(report)));
  assert.ok(report.durationSeconds>0&&report.broadcastSeconds>report.durationSeconds);
  assert.ok(JSON.stringify(report).length<400_000,'compact enough to store per match');
});
