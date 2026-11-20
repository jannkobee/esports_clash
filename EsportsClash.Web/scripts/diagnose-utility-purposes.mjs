// Utility by tactical purpose: what each throw was for (primary purpose) and how often it achieved it.
// Usage (from EsportsClash.Web): node scripts/diagnose-utility-purposes.mjs --map=fontessa --seeds=11,22 --steps=15000
import {FPS_T_POSITIONS,FPS_CT_POSITIONS} from '../src/fps/fpsPlayerArchitecture.ts';
import {FpsLiveSimulation} from '../src/fps/fpsLiveSimulation.ts';
import {FPS_IDENTITY_PERSONALITIES,generatePlayerDNA} from '../src/fps/fpsIdentity.ts';
import {generateFpsSkillProfile} from '../src/fps/fpsSkillProfile.ts';
const arg=(k,f)=>process.argv.find(v=>v.startsWith(`--${k}=`))?.split('=')[1]??f;
const mapId=arg('map','fontessa'),seeds=arg('seeds','11').split(',').map(Number),steps=Number(arg('steps','15000'));
const plan={tempo:.6,structure:.7,aggression:.5,preparation:.7,freedom:.5,economy:.8};
const coach={...plan,rigidity:.7,communication:.7,leadership:.7,adaptability:.7,development:.5};
const chemistry={trust:.6,communication:.6,understanding:.6,leadershipAcceptance:.6,roleCompetition:.3};
const rows={};
for(const seed of seeds){
  const cards=Array.from({length:10},(_,i)=>({id:`u-${seed}-${i}`,name:`Op ${i}`,stats:{rifling:70,sniping:70,entry:70,utility:70,positioning:70,shotcalling:70}}));
  const identity={players:Object.fromEntries(cards.map((p,i)=>[p.id,{id:p.id,assignments:{t:FPS_T_POSITIONS[i%5],ct:FPS_CT_POSITIONS[i%5]},personality:FPS_IDENTITY_PERSONALITIES[(i+seed)%FPS_IDENTITY_PERSONALITIES.length],dna:generatePlayerDNA(p.id),intensity:.6,roleSuitability:.6,familiarity:.5}])),teams:{blue:{coach,plan,chemistry},red:{coach,plan,chemistry}}};
  const profiles=Object.fromEntries(cards.map(p=>[p.id,generateFpsSkillProfile(p.id,seed,'2026-11-16T00:00:00.000Z')]));
  const sim=new FpsLiveSimulation(cards.slice(0,5),cards.slice(5),seed,identity,{mapId,skillProfiles:profiles});
  for(let i=0;i<steps;i++){sim.step();sim.drainAudioCues();if(sim.snapshot().phase==='finished')break;}
  for(const e of sim.utilityPurposeLog()){
    const key=`${e.intent.grenade.padEnd(10)} ${e.intent.primary}`;
    const r=rows[key]??={n:0,judged:0,ok:0,landingError:0,landings:0,smokesDisturbed:0,flashFollowUps:0,phases:{}};
    r.n++;
    if(e.outcome){
      r.judged++;
      if(e.outcome.achieved)r.ok++;
      if(e.outcome.landingError!==undefined){r.landingError+=e.outcome.landingError;r.landings++;}
      r.smokesDisturbed+=e.outcome.smokesDisturbed??0;
      if(e.outcome.teammateUsedOpening)r.flashFollowUps++;
    }
    r.phases[e.intent.phase]=(r.phases[e.intent.phase]??0)+1;
  }
}
for(const [k,r] of Object.entries(rows).sort((a,b)=>b[1].n-a[1].n)){
  const evidence={meanLandingError:r.landings?+(r.landingError/r.landings).toFixed(2):null,
    ...(k.startsWith('he')?{smokesDisturbed:r.smokesDisturbed}:{}),
    ...(k.startsWith('flash')?{flashFollowUps:r.flashFollowUps}:{})};
  console.log(k.padEnd(40),String(r.n).padStart(4),'achieved',`${r.ok}/${r.judged}`.padStart(7),JSON.stringify(evidence),JSON.stringify(r.phases));
}
