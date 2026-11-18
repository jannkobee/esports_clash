// Behaviour diagnostics for the live exhibition: stare episodes (enemy visible, no shot), post-round
// fights, CT rotations after a site falls, sniper scope dwell at the shot and smoke placement.
// Usage: node scripts/diagnose-live-fps.mjs --map=fontessa --seeds=11,22 --steps=20000
import {FPS_T_POSITIONS,FPS_CT_POSITIONS} from '../src/fps/fpsPlayerArchitecture.ts';
import {FpsLiveSimulation} from '../src/fps/fpsLiveSimulation.ts';
import {FPS_IDENTITY_PERSONALITIES,generatePlayerDNA} from '../src/fps/fpsIdentity.ts';
import {generateFpsSkillProfile} from '../src/fps/fpsSkillProfile.ts';
const arg=(k,f)=>process.argv.find(v=>v.startsWith(`--${k}=`))?.split('=')[1]??f;
const mapId=arg('map','fontessa'),seeds=arg('seeds','11').split(',').map(Number),steps=Number(arg('steps','20000')),verbose=process.argv.includes('--verbose');
const plan={tempo:.6,structure:.7,aggression:.5,preparation:.7,freedom:.5,economy:.8};
const coach={...plan,rigidity:.7,communication:.7,leadership:.7,adaptability:.7,development:.5};
const chemistry={trust:.6,communication:.6,understanding:.6,leadershipAcceptance:.6,roleCompetition:.3};
const total={stare:0,stareTime:0,engaged:0,postKills:0,postRounds:0,postSeen:0,sniperShots:0,sniperQuick:0,unscopedFar:0,rotations:0,rotationChances:0,smokesThrown:0,reasons:{}};
for(const seed of seeds){
  const cards=Array.from({length:10},(_,i)=>({id:`tr-${seed}-${i}`,name:`Operative ${i}`,stats:{rifling:70,sniping:70,entry:70,utility:70,positioning:70,shotcalling:70}}));
  const identity={players:Object.fromEntries(cards.map((p,i)=>[p.id,{id:p.id,assignments:{t:FPS_T_POSITIONS[i%5],ct:FPS_CT_POSITIONS[i%5]},personality:FPS_IDENTITY_PERSONALITIES[(i+seed)%FPS_IDENTITY_PERSONALITIES.length],dna:generatePlayerDNA(p.id),intensity:.6,roleSuitability:.6,familiarity:.5}])),teams:{blue:{coach,plan,chemistry},red:{coach,plan,chemistry}}};
  const profiles=Object.fromEntries(cards.map(p=>[p.id,generateFpsSkillProfile(p.id,seed,'2026-11-16T00:00:00.000Z')]));
  const sim=new FpsLiveSimulation(cards.slice(0,5),cards.slice(5),seed,identity,{mapId,skillProfiles:profiles});
  const ep=new Map(),smokeIds=new Set();let lastPhase='freeze',siteFall=null,scopedSince=new Map();
  for(let i=0;i<steps;i++){
    const killsBefore=sim.actors.reduce((s,a)=>s+a.kills,0);
    const shotsBefore=new Map(sim.actors.map(a=>[a.id,a.impact.shots]));
    sim.step();sim.drainAudioCues();
    const phase=sim.phase;
    if(phase==='post'&&lastPhase==='live'){total.postRounds++;}
    if(phase==='post'){const k=sim.actors.reduce((s,a)=>s+a.kills,0);total.postKills+=k-killsBefore;
      if(sim.actors.some(p=>p.hp>0&&sim.actors.some(t=>t.team!==p.team&&t.hp>0&&sim.visible(p,t))))total.postSeen++;}
    lastPhase=phase;
    if(phase==='finished')break;
    for(const sm of sim.smokes)if(!smokeIds.has(sm.id)){smokeIds.add(sm.id);total.smokesThrown++;}
    for(const e of sim.events.slice(-3))if(/rotate together/.test(e.text)&&!smokeIds.has('ev'+e.id)){smokeIds.add('ev'+e.id);total.rotations++;}
    if(phase!=='live'){ep.clear();continue;}
    for(const p of sim.actors){
      if(p.hp<=0){ep.delete(p.id);continue;}
      const fired=p.impact.shots>(shotsBefore.get(p.id)??0);
      if(p.scopeState==='scoped'){if(!scopedSince.has(p.id))scopedSince.set(p.id,sim.time);}else if(!fired)scopedSince.delete(p.id);
      if(fired&&(p.weapon==='sniper'||p.weapon==='scout')){total.sniperShots++;const since=scopedSince.get(p.id);if(since===undefined)total.unscopedFar++;else if(sim.time-since<.1)total.sniperQuick++;scopedSince.delete(p.id);}
      const t=sim.actors.find(a=>a.id===p.target&&a.hp>0);
      const vis=t&&sim.visible(p,t,false);
      let e=ep.get(p.id);
      if(vis){
        if(!e||e.target!==t.id){e={target:t.id,start:sim.time,shots:0,actions:{}};ep.set(p.id,e);}
        if(fired)e.shots++;
        const why=p.action+(p.retreatUntil>sim.time?'|retreat':'')+(p.peek?'|peek':'')+(p.reload>0?'|reload':'')+(p.speed>.12?'|moving':'')+'|'+p.decision;e.actions[why]=(e.actions[why]??0)+1;
      }else if(e){
        const dur=sim.time-e.start;
        if(dur>=.9&&e.shots===0){total.stare++;total.stareTime+=dur;for(const [k,v] of Object.entries(e.actions))total.reasons[k]=(total.reasons[k]??0)+v;
          if(verbose)console.log(`stare r${sim.round} ${p.name} ${p.weapon} ${dur.toFixed(2)}s`,JSON.stringify(e.actions));}
        else if(e.shots>0)total.engaged++;
        ep.delete(p.id);
      }
    }
  }
}
const top=Object.entries(total.reasons).sort((a,b)=>b[1]-a[1]).slice(0,14);
console.log(JSON.stringify({map:mapId,seeds,...total,reasons:Object.fromEntries(top)},null,1));
