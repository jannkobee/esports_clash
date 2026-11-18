// How the automatic broadcast director spends live time: share of frames on a quiet player whose
// view is a wall within 1.6 m, on a clutch player during clutches, and on the shooter of the next kill.
// Usage (from EsportsClash.Web): node scripts/diagnose-director.mjs --map=fontessa --seeds=11 --steps=12000
import {FPS_T_POSITIONS,FPS_CT_POSITIONS} from '../src/fps/fpsPlayerArchitecture.ts';
import {FpsLiveSimulation} from '../src/fps/fpsLiveSimulation.ts';
import {FPS_IDENTITY_PERSONALITIES,generatePlayerDNA} from '../src/fps/fpsIdentity.ts';
import {generateFpsSkillProfile} from '../src/fps/fpsSkillProfile.ts';
import {createDirectorState,evaluateBroadcastDirector,directorViewClearance} from '../src/fps/fpsBroadcastDirector.ts';
import {getLiveMapRuntime} from '../src/fps/fpsLiveMapRegistry.ts';
const arg=(k,f)=>process.argv.find(v=>v.startsWith(`--${k}=`))?.split('=')[1]??f;
const mapId=arg('map','fontessa'),seeds=arg('seeds','11').split(',').map(Number),steps=Number(arg('steps','12000'));
const plan={tempo:.6,structure:.7,aggression:.5,preparation:.7,freedom:.5,economy:.8};
const coach={...plan,rigidity:.7,communication:.7,leadership:.7,adaptability:.7,development:.5};
const chemistry={trust:.6,communication:.6,understanding:.6,leadershipAcceptance:.6,roleCompetition:.3};
const map=getLiveMapRuntime(mapId);const t={live:0,wall:0,clutch:0,onClutch:0,kills:0,killSeen:0,cuts:0};
for(const seed of seeds){
  const cards=Array.from({length:10},(_,i)=>({id:`d-${seed}-${i}`,name:`Op ${i}`,stats:{rifling:70,sniping:70,entry:70,utility:70,positioning:70,shotcalling:70}}));
  const identity={players:Object.fromEntries(cards.map((p,i)=>[p.id,{id:p.id,assignments:{t:FPS_T_POSITIONS[i%5],ct:FPS_CT_POSITIONS[i%5]},personality:FPS_IDENTITY_PERSONALITIES[(i+seed)%FPS_IDENTITY_PERSONALITIES.length],dna:generatePlayerDNA(p.id),intensity:.6,roleSuitability:.6,familiarity:.5}])),teams:{blue:{coach,plan,chemistry},red:{coach,plan,chemistry}}};
  const profiles=Object.fromEntries(cards.map(p=>[p.id,generateFpsSkillProfile(p.id,seed,'2026-11-16T00:00:00.000Z')]));
  const sim=new FpsLiveSimulation(cards.slice(0,5),cards.slice(5),seed,identity,{mapId,skillProfiles:profiles});
  const state=createDirectorState();const frames=[];let last;
  for(let i=0;i<steps;i++){sim.step();sim.drainAudioCues();if(i%2===0)frames.push(sim.snapshot());if(sim.phase==='finished')break;}
  // Replay with a 1 s look-ahead buffer, as the broadcast does.
  for(let i=0;i<frames.length;i++){
    const s=frames[i],preview=frames[Math.min(frames.length-1,i+15)];
    const d=evaluateBroadcastDirector(s,state,'director','',preview);
    if(last&&last!==d.followedId&&s.phase==='live')t.cuts++;last=d.followedId;
    if(s.phase!=='live')continue;t.live++;
    const f=s.players.find(p=>p.id===d.followedId);
    const quiet=s.time-f.lastShot>1.5&&!s.players.some(e=>e.team!==f.team&&e.hp>0&&Math.hypot(e.x-f.x,e.z-f.z)<14);
    if(quiet&&directorViewClearance(f,map,(f.jumpY??0)+1.6)<1.6)t.wall++;
    const solo=['blue','red'].find(team=>s.players.filter(p=>p.team===team&&p.hp>0).length===1&&s.players.some(p=>p.team!==team&&p.hp>0));
    if(solo){t.clutch++;if(f.team===solo)t.onClutch++;}
    for(const e of s.events)if(e.kind==='kill'&&Math.abs(e.time-s.time)<1/30){t.kills++;if(e.actorId===d.followedId||e.targetId===d.followedId)t.killSeen++;}
  }
}
console.log(JSON.stringify({map:mapId,seeds,wallStareShare:+(t.wall/t.live).toFixed(3),clutchShareOnClutchPlayer:+(t.onClutch/Math.max(1,t.clutch)).toFixed(3),killsOnCamera:`${t.killSeen}/${t.kills}`,cutsPerMinute:+(t.cuts/(t.live/15/60)).toFixed(1)}));
