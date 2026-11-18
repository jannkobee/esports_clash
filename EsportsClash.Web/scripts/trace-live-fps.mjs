// Deterministic play trace for parity checks: round outcomes, tactic/setup/site and a rolling hash of
// every actor's position/health/action every 30 ticks. Usage: --map=<id> --seeds=1,2 --steps=N
import {createHash} from 'node:crypto';
import {FPS_T_POSITIONS,FPS_CT_POSITIONS} from '../src/fps/fpsPlayerArchitecture.ts';
import {FpsLiveSimulation} from '../src/fps/fpsLiveSimulation.ts';
import {FPS_IDENTITY_PERSONALITIES,generatePlayerDNA} from '../src/fps/fpsIdentity.ts';
import {generateFpsSkillProfile} from '../src/fps/fpsSkillProfile.ts';
const arg=(k,f)=>process.argv.find(v=>v.startsWith(`--${k}=`))?.split('=')[1]??f;
const mapId=arg('map','fontessa'),seeds=arg('seeds','11').split(',').map(Number),steps=Number(arg('steps','30000'));
const plan={tempo:.6,structure:.7,aggression:.5,preparation:.7,freedom:.5,economy:.8};
const coach={...plan,rigidity:.7,communication:.7,leadership:.7,adaptability:.7,development:.5};
const chemistry={trust:.6,communication:.6,understanding:.6,leadershipAcceptance:.6,roleCompetition:.3};
for(const seed of seeds){
  const cards=Array.from({length:10},(_,i)=>({id:`tr-${seed}-${i}`,name:`Operative ${i}`,stats:{rifling:70,sniping:70,entry:70,utility:70,positioning:70,shotcalling:70}}));
  const identity={players:Object.fromEntries(cards.map((p,i)=>[p.id,{id:p.id,assignments:{t:FPS_T_POSITIONS[i%5],ct:FPS_CT_POSITIONS[i%5]},personality:FPS_IDENTITY_PERSONALITIES[(i+seed)%FPS_IDENTITY_PERSONALITIES.length],dna:generatePlayerDNA(p.id),intensity:.6,roleSuitability:.6,familiarity:.5}])),teams:{blue:{coach,plan,chemistry},red:{coach,plan,chemistry}}};
  const profiles=Object.fromEntries(cards.map(p=>[p.id,generateFpsSkillProfile(p.id,seed,'2026-11-16T00:00:00.000Z')]));
  const rounds=[];const sim=new FpsLiveSimulation(cards.slice(0,5),cards.slice(5),seed,identity,{mapId,skillProfiles:profiles,onRoundComplete:r=>rounds.push({round:r.round,winner:r.winner,reason:r.reason,planted:r.planted})});
  const hash=createHash('sha256');
  for(let i=0;i<steps;i++){sim.step();sim.drainAudioCues();if(i%30===0){const f=sim.snapshot();hash.update(JSON.stringify(f.players.map(p=>[p.x.toFixed(4),p.z.toFixed(4),p.hp,p.action,p.weapon])));}if(sim.snapshot().phase==='finished')break;}
  console.log(JSON.stringify({map:mapId,seed,rounds,history:sim.roundHistory?.map(h=>[h.tactic,h.defenseSetup,h.attackSite]),trace:hash.digest('hex')}));
}
