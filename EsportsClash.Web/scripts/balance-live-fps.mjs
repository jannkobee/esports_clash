// Headless balance check: seeded full live matches per map.
// Reports attacker (T) vs defender (CT) round wins, and hit rate / headshot share bucketed by aim skill.
// Usage: node --experimental-strip-types scripts/balance-live-fps.mjs --map=fontessa --seeds=11,22,33 [--max-steps=200000] [--output=file.json]
import {writeFileSync} from 'node:fs';
import {FPS_T_POSITIONS,FPS_CT_POSITIONS} from '../src/fps/fpsPlayerArchitecture.ts';
import {FpsLiveSimulation} from '../src/fps/fpsLiveSimulation.ts';
import {FPS_IDENTITY_PERSONALITIES,generatePlayerDNA} from '../src/fps/fpsIdentity.ts';
import {generateFpsSkillProfile} from '../src/fps/fpsSkillProfile.ts';
import {createFpsUtilityBrain} from '../src/fps/fpsUtilityBrain.ts';

const arg=(key,fallback)=>process.argv.find(v=>v.startsWith(`--${key}=`))?.split('=')[1]??fallback;
// --off=aim,utility,consistency switches features off for balance ablations (diagnostics only).
const off=new Set(arg('off','').split(',').filter(Boolean));
const mapId=arg('map','fontessa'),seeds=arg('seeds','11,22,33').split(',').map(Number),maxSteps=Number(arg('max-steps','200000'));
const plan={tempo:.6,structure:.7,aggression:.5,preparation:.7,freedom:.5,economy:.8};
const coach={...plan,rigidity:.7,communication:.7,leadership:.7,adaptability:.7,development:.5};
const chemistry={trust:.6,communication:.6,understanding:.6,leadershipAcceptance:.6,roleCompetition:.3};
const bucketOf=v=>v<5?'aim 3.0-4.9':v<7?'aim 5.0-6.9':'aim 7.0-9.0';
const empty=()=>({players:0,shots:0,hits:0,headshots:0});
const total={matches:0,rounds:0,tWins:0,ctWins:0,unfinished:0,reasons:{},buckets:{},sides:{}};
const perMatch=[];
for(const seed of seeds){
  const cards=Array.from({length:10},(_,i)=>({id:`bal-${seed}-${i}`,name:`Operative ${i}`,stats:{rifling:70,sniping:70,entry:70,utility:70,positioning:70,shotcalling:70}}));
  const identity={players:Object.fromEntries(cards.map((p,i)=>[p.id,{id:p.id,assignments:{t:FPS_T_POSITIONS[i%5],ct:FPS_CT_POSITIONS[i%5]},personality:FPS_IDENTITY_PERSONALITIES[(i+seed)%FPS_IDENTITY_PERSONALITIES.length],dna:generatePlayerDNA(p.id),intensity:.6,roleSuitability:.6,familiarity:.5}])),teams:{blue:{coach,plan,chemistry},red:{coach,plan,chemistry}}};
  const profiles=Object.fromEntries(cards.map(p=>[p.id,generateFpsSkillProfile(p.id,seed,'2026-11-16T00:00:00.000Z')]));
  const rounds=[];
  const sim=new FpsLiveSimulation(cards.slice(0,5),cards.slice(5),seed,identity,{mapId,skillProfiles:profiles,onRoundComplete:r=>rounds.push(r),diagnostics:{snapAim:off.has('aim'),noConsistency:off.has('consistency')},...(off.has('utility')?{utilityLearning:{mode:'frozen',model:createFpsUtilityBrain()}}:{})});
  const started=Date.now();let steps=0;
  while(steps<maxSteps&&sim.snapshot().phase!=='finished'){sim.step();steps++;if(steps%2000===0)sim.drainAudioCues?.();}
  const frame=sim.snapshot();
  const t=rounds.filter(r=>r.winner===r.attackTeam).length,ct=rounds.length-t;
  total.matches++;total.rounds+=rounds.length;total.tWins+=t;total.ctWins+=ct;if(frame.phase!=='finished')total.unfinished++;
  for(const r of rounds)total.reasons[r.reason]=(total.reasons[r.reason]??0)+1;
  for(const p of frame.players){
    const aim=profiles[p.id].values.rifling,b=total.buckets[bucketOf(aim)]??=empty();
    b.players++;b.shots+=p.impact.shots;b.hits+=p.impact.hits;b.headshots+=p.impact.headshots;
  }
  // Side split per team: a stomp where the stronger team attacks first inflates the raw T%, so the
  // side advantage is each team's T win rate minus its CT win rate (averaged over teams with both).
  const sides=Object.fromEntries(['blue','red'].map(team=>{const t=rounds.filter(r=>r.attackTeam===team),c=rounds.filter(r=>r.attackTeam!==team);
    return [team,{tWins:t.filter(r=>r.winner===team).length,tRounds:t.length,ctWins:c.filter(r=>r.winner===team).length,ctRounds:c.length}];}));
  for(const team of ['blue','red']){const s=total.sides[team]??={tWins:0,tRounds:0,ctWins:0,ctRounds:0};for(const k of Object.keys(s))s[k]+=sides[team][k];}
  const m={map:mapId,seed,steps,finished:frame.phase==='finished',score:frame.score,rounds:rounds.length,tWins:t,ctWins:ct,sides,wallSeconds:(Date.now()-started)/1000};
  perMatch.push(m);console.log(JSON.stringify(m));
}
const pct=(a,b)=>b?Math.round(a/b*1000)/10:null;
const sideGap=Object.values(total.sides).filter(v=>v.tRounds&&v.ctRounds).map(v=>v.tWins/v.tRounds-v.ctWins/v.ctRounds);
const summary={map:mapId,off:[...off],seeds,sideAdjustedTWinPct:sideGap.length?Math.round((50+sideGap.reduce((a,b)=>a+b,0)/sideGap.length*50)*10)/10:null,sides:total.sides,matches:total.matches,unfinished:total.unfinished,rounds:total.rounds,tWins:total.tWins,ctWins:total.ctWins,tWinPct:pct(total.tWins,total.rounds),ctWinPct:pct(total.ctWins,total.rounds),reasons:total.reasons,
  byAim:Object.fromEntries(Object.entries(total.buckets).sort().map(([k,b])=>[k,{players:b.players,shots:b.shots,hitRatePct:pct(b.hits,b.shots),headshotSharePct:pct(b.headshots,b.hits)}]))};
console.log(JSON.stringify(summary,null,2));
const output=arg('output','');if(output)writeFileSync(output,JSON.stringify({node:process.version,perMatch,summary},null,2));
