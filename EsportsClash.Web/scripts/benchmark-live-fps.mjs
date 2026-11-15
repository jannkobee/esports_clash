import {FPS_T_POSITIONS,FPS_CT_POSITIONS} from '../src/fps/fpsPlayerArchitecture.ts';
import assert from 'node:assert/strict';
import {liveActorSolids} from '../src/fps/fpsLiveMap.ts';
import {segmentHitsWall} from '../src/fps/fpsSpatialWorld.ts';
import {LIVE_WEAPONS} from '../src/fps/fpsLiveWeapons.ts';
import {performance} from 'node:perf_hooks';
import {writeFileSync} from 'node:fs';
import {FpsLiveSimulation} from '../src/fps/fpsLiveSimulation.ts';
import {FPS_IDENTITY_PERSONALITIES,generatePlayerDNA} from '../src/fps/fpsIdentity.ts';
import {generateFpsSkillProfile} from '../src/fps/fpsSkillProfile.ts';

const arg=(key,fallback)=>process.argv.find(v=>v.startsWith(`--${key}=`))?.split('=')[1]??fallback;
const steps=Number(arg('steps','3600')),seeds=arg('seeds','1337,9127').split(',').map(Number);
const plan={tempo:.6,structure:.7,aggression:.5,preparation:.7,freedom:.5,economy:.8};
const coach={...plan,rigidity:.7,communication:.7,leadership:.7,adaptability:.7,development:.5};
const chemistry={trust:.6,communication:.6,understanding:.6,leadershipAcceptance:.6,roleCompetition:.3};
const cards=Array.from({length:10},(_,i)=>({id:`perf-${i}`,name:`Operative ${i}`,stats:{rifling:80,sniping:80,entry:80,utility:80,positioning:80,shotcalling:80}}));
const identity={players:Object.fromEntries(cards.map((p,i)=>[p.id,{id:p.id,assignments:{t:FPS_T_POSITIONS[i%5],ct:FPS_CT_POSITIONS[i%5]},personality:FPS_IDENTITY_PERSONALITIES[i],dna:generatePlayerDNA(p.id),intensity:.6,roleSuitability:.6,familiarity:.5}])),teams:{blue:{coach,plan,chemistry},red:{coach,plan,chemistry}}};
const results=[],audit=arg('audit','false')==='true';
for(const seed of seeds){
  const profiles=Object.fromEntries(cards.map(p=>[p.id,generateFpsSkillProfile(p.id,seed,'2026-11-14T00:00:00.000Z')]));
  const start=performance.now();
  const sim=new FpsLiveSimulation(cards.slice(0,5),cards.slice(5),seed,identity,{skillProfiles:profiles});
  const traceOver=Number(arg('trace-over','Infinity'));
  if(Number.isFinite(traceOver))for(const method of ['decide','objective','postPlantAssignment']){
    const original=sim[method];sim[method]=function(p,...args){const at=performance.now(),result=original.call(this,p,...args),ms=performance.now()-at;if(ms>=traceOver)console.error(JSON.stringify({method,ms,time:this.time,actor:p.id,x:p.x,z:p.z,y:p.jumpY,goal:p.goal,channel:p.channel,bomb:p.bomb,action:p.action}));return result;};
  }
  const startupMs=performance.now()-start,samples=[],live=[],slow=[];
  for(let i=0;i<steps;i++){
    const at=performance.now();sim.step();const frame=sim.snapshot();sim.drainAudioCues();const ms=performance.now()-at;
    if(audit)for(const p of frame.players){
      const label=`seed ${seed}, tick ${i}, ${p.id} at ${p.x},${p.z},${p.jumpY}: ${p.action}, ${p.weapon} ${p.ammo}/${p.reserve}`;
      assert.ok(Number.isFinite(p.x+p.z+(p.jumpY??0)),label);
      assert.ok(Math.abs(p.x)<=34&&Math.abs(p.z)<=43,label);
      assert.ok(p.flash+p.smoke+p.incendiary+p.he<=4,label);
      assert.ok(p.cash>=0&&p.cash<=10000,label);
      assert.ok(p.ammo>=0&&p.ammo<=LIVE_WEAPONS[p.weapon].magazine&&p.reserve>=0,label);
      if(p.hp>0){const wall=liveActorSolids(p,p.jumpY??0,p.crouch?1.3:1.72).find(w=>segmentHitsWall(p,p,w,.349));assert.ok(!wall,`${label}, intersecting ${wall?.id}`);}
    }
    samples.push(ms);if(frame.phase==='live')live.push(ms);
    if(ms>16.667)slow.push({tick:i,time:frame.time,round:frame.round,phase:frame.phase,ms});
  }
  const stats=values=>{const a=[...values].sort((x,y)=>x-y),q=p=>a[Math.min(a.length-1,Math.floor(a.length*p))]??0;return {count:a.length,totalMs:values.reduce((n,v)=>n+v,0),p50:q(.5),p95:q(.95),p99:q(.99),max:q(1),over16ms:values.filter(v=>v>16.667).length,over33ms:values.filter(v=>v>33.333).length};};
  const frame=sim.snapshot();
  const result={seed,steps,audited:audit,startupMs,all:stats(samples),live:stats(live),worst:slow.sort((a,b)=>b.ms-a.ms).slice(0,8),round:frame.round,score:frame.score,events:frame.events.length,shots:frame.players.reduce((n,p)=>n+p.impact.shots,0)};
  results.push(result);console.log(JSON.stringify(result));
}
const output=arg('output','');if(output)writeFileSync(output,JSON.stringify({node:process.version,results},null,2));
