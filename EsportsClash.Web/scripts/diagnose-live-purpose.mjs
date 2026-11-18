// Purposefulness diagnostics: goal churn, wandering (walked vs net displacement), time "Taking space"/probing
// without contact, time to the attackers' execute call, round end reasons.
// Usage: node scripts/diagnose-live-purpose.mjs --map=fontessa --seeds=11,22 --steps=15000
import {FPS_T_POSITIONS,FPS_CT_POSITIONS} from '../src/fps/fpsPlayerArchitecture.ts';
import {FpsLiveSimulation} from '../src/fps/fpsLiveSimulation.ts';
import {FPS_IDENTITY_PERSONALITIES,generatePlayerDNA} from '../src/fps/fpsIdentity.ts';
import {generateFpsSkillProfile} from '../src/fps/fpsSkillProfile.ts';
const arg=(k,f)=>process.argv.find(v=>v.startsWith(`--${k}=`))?.split('=')[1]??f;
const mapId=arg('map','fontessa'),seeds=arg('seeds','11').split(',').map(Number),steps=Number(arg('steps','15000'));
const plan={tempo:.6,structure:.7,aggression:.5,preparation:.7,freedom:.5,economy:.8};
const coach={...plan,rigidity:.7,communication:.7,leadership:.7,adaptability:.7,development:.5};
const chemistry={trust:.6,communication:.6,understanding:.6,leadershipAcceptance:.6,roleCompetition:.3};
const t={moveIntent:{},jumps:{},rounds:0,liveSeconds:0,goalChanges:{T:0,CT:0},playerSec:{T:0,CT:0},walked:{T:0,CT:0},net:{T:0,CT:0},
  idleNoContact:{T:0,CT:0},takingSpace:0,execAt:[],noExec:0,reasons:{},advantageIdle:0,advantageSec:0,actions:{T:{},CT:{}},roundLen:[]};
for(const seed of seeds){
  const cards=Array.from({length:10},(_,i)=>({id:`tr-${seed}-${i}`,name:`Operative ${i}`,stats:{rifling:70,sniping:70,entry:70,utility:70,positioning:70,shotcalling:70}}));
  const identity={players:Object.fromEntries(cards.map((p,i)=>[p.id,{id:p.id,assignments:{t:FPS_T_POSITIONS[i%5],ct:FPS_CT_POSITIONS[i%5]},personality:FPS_IDENTITY_PERSONALITIES[(i+seed)%FPS_IDENTITY_PERSONALITIES.length],dna:generatePlayerDNA(p.id),intensity:.6,roleSuitability:.6,familiarity:.5}])),teams:{blue:{coach,plan,chemistry},red:{coach,plan,chemistry}}};
  const profiles=Object.fromEntries(cards.map(p=>[p.id,generateFpsSkillProfile(p.id,seed,'2026-11-16T00:00:00.000Z')]));
  const sim=new FpsLiveSimulation(cards.slice(0,5),cards.slice(5),seed,identity,{mapId,skillProfiles:profiles,onRoundComplete:r=>{t.rounds++;t.reasons[r.reason]=(t.reasons[r.reason]??0)+1;}});
  const last=new Map();let execCalled=false,liveStart=0,window=new Map();
  for(let i=0;i<steps;i++){
    const before=sim.phase;sim.step();sim.drainAudioCues();
    if(sim.phase==='finished')break;
    if(before!=='live'&&sim.phase==='live'){execCalled=false;liveStart=sim.time;last.clear();window.clear();}
    if(before==='live'&&sim.phase!=='live'){t.roundLen.push(sim.time-liveStart);if(!execCalled)t.noExec++;}
    if(sim.phase!=='live')continue;
    t.liveSeconds+=1/30;
    const order=sim.informationOrders[sim.attackTeam];
    if(!execCalled&&order.mode==='execute'){execCalled=true;t.execAt.push(sim.time-liveStart);}
    const alive=s=>sim.actors.filter(a=>a.hp>0&&(s==='T'?a.attacking:!a.attacking)).length;
    for(const p of sim.actors){
      if(p.hp<=0)continue;
      const side=p.attacking?'T':'CT';
      t.playerSec[side]+=1/30;
      t.actions[side][p.action]=(t.actions[side][p.action]??0)+1/30;
      const prev=last.get(p.id);
      const gk=p.goal?`${p.goal.x.toFixed(0)},${p.goal.z.toFixed(0)}`:'-';
      if(prev){t.walked[side]+=Math.hypot(p.x-prev.x,p.z-prev.z);if(p.goal&&prev.goal&&Math.hypot(p.goal.x-prev.goal.x,p.goal.z-prev.goal.z)>4){t.goalChanges[side]++;const k=side+': '+(prev.intent||'?')+' -> '+(p.intent||'?');t.jumps[k]=(t.jumps[k]??0)+1;}}
      last.set(p.id,{x:p.x,z:p.z,gk,goal:p.goal?{...p.goal}:undefined,intent:p.intent});
      // 10s windows: net displacement
      let w=window.get(p.id);if(!w||sim.time-w.t>=10){if(w)t.net[side]+=Math.hypot(p.x-w.x,p.z-w.z);window.set(p.id,{x:p.x,z:p.z,t:sim.time});}
      const contact=sim.time-p.contactAt<4||sim.time-p.seenAt<4;
      if(!contact&&p.speed>.5&&sim.time-p.damageAt>4){t.idleNoContact[side]+=1/30;const k=side+": "+(p.intent||"?").replace(/[0-9.]+/g,"#").slice(0,70);t.moveIntent[k]=(t.moveIntent[k]??0)+1/30;}
      if(p.action==='Taking space')t.takingSpace+=1/30;
      const mine=alive(side),theirs=alive(side==='T'?'CT':'T');
      if(mine-theirs>=2){t.advantageSec+=1/30;if(!contact)t.advantageIdle+=1/30;}
    }
  }
}
const top=s=>Object.fromEntries(Object.entries(t.actions[s]).sort((a,b)=>b[1]-a[1]).slice(0,10).map(([k,v])=>[k,+v.toFixed(0)]));
const avg=a=>a.length?+(a.reduce((x,y)=>x+y,0)/a.length).toFixed(1):null;
console.log(JSON.stringify({map:mapId,seeds,rounds:t.rounds,reasons:t.reasons,avgRoundLive:avg(t.roundLen),
  goalChangesPerPlayerPer10s:{T:+(t.goalChanges.T/t.playerSec.T*10).toFixed(2),CT:+(t.goalChanges.CT/t.playerSec.CT*10).toFixed(2)},
  wanderRatio_walkedOverNet10s:{T:+(t.walked.T/Math.max(1,t.net.T)).toFixed(2),CT:+(t.walked.CT/Math.max(1,t.net.CT)).toFixed(2)},
  movingNoContactShare:{T:+(t.idleNoContact.T/t.playerSec.T).toFixed(2),CT:+(t.idleNoContact.CT/t.playerSec.CT).toFixed(2)},
  takingSpaceShareT:+(t.takingSpace/t.playerSec.T).toFixed(2),avgExecuteCallAt:avg(t.execAt),roundsWithoutExecute:t.noExec,
  advantageNoContactShare:+(t.advantageIdle/Math.max(1,t.advantageSec)).toFixed(2),moveIntent:Object.fromEntries(Object.entries(t.moveIntent).sort((a,b)=>b[1]-a[1]).slice(0,20).map(([k,v])=>[k,+v.toFixed(0)])),jumps:Object.fromEntries(Object.entries(t.jumps).sort((a,b)=>b[1]-a[1]).slice(0,22)),topActionsT:top('T'),topActionsCT:top('CT')},null,1));
