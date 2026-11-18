// Grows the committed utility brain (src/fps/fps-utility-brain.json) by letting bots play headless
// exhibitions and learn from where their smokes, flashes, fire and HE actually land or pop.
//   node --experimental-strip-types scripts/train-utility-brain.mjs --practice=16 --matches=2 --maps=fontessa,spillway
// Add --fresh to start from an empty brain; --kinds=smoke,flash,incendiary,he picks the practice drills.
// Prints per-kind practice mastery and per-match landing rates so improvement is visible.
import {readFileSync,writeFileSync} from 'node:fs';
import {FpsLiveSimulation} from '../src/fps/fpsLiveSimulation.ts';
import {FPS_T_POSITIONS,FPS_CT_POSITIONS} from '../src/fps/fpsPlayerArchitecture.ts';
import {FPS_IDENTITY_PERSONALITIES,generatePlayerDNA} from '../src/fps/fpsIdentity.ts';
import {generateFpsSkillProfile} from '../src/fps/fpsSkillProfile.ts';
import {createFpsUtilityBrain,loadFpsUtilityBrain,practiceFpsUtilityTargets,fpsUtilityPracticeTargets} from '../src/fps/fpsUtilityBrain.ts';
import {getLiveMapRuntime} from '../src/fps/fpsLiveMapRegistry.ts';

const arg=(key,fallback)=>process.argv.find(v=>v.startsWith(`--${key}=`))?.split('=')[1]??fallback;
const matches=Number(arg('matches','3')),maps=arg('maps','fontessa,spillway').split(','),maxSteps=Number(arg('steps','30000'));
const file=new URL('../src/fps/fps-utility-brain.json',import.meta.url);
let brain=process.argv.includes('--fresh')?createFpsUtilityBrain():loadFpsUtilityBrain(JSON.parse(readFileSync(file,'utf8')))??createFpsUtilityBrain();

// 1. Practice: drill every tactical utility target with the real grenade physics as feedback.
const practice=Number(arg('practice','16')),kinds=arg('kinds','smoke,flash,incendiary,he').split(',');
if(practice>0)for(const mapId of maps)for(const kind of kinds){
  const runtime=getLiveMapRuntime(mapId);
  const r=practiceFpsUtilityTargets(brain,runtime,fpsUtilityPracticeTargets(runtime,kind),practice,kind);
  console.log(`${mapId.padEnd(9)} practice ${kind.padEnd(10)}: ${r.mastered}/${r.targets} targets on a working throw after ${r.throws} throws`);
}
// 2. Matches: the same brain plays full exhibitions and keeps learning from real round throws.
const plan={tempo:.6,structure:.7,aggression:.5,preparation:.7,freedom:.5,economy:.8};
const coach={...plan,rigidity:.7,communication:.7,leadership:.7,adaptability:.7,development:.5};
const chemistry={trust:.6,communication:.6,understanding:.6,leadershipAcceptance:.6,roleCompetition:.3};
for(let m=0;m<matches;m++)for(const mapId of maps){
  const seed=1000+m*97+mapId.length;
  const cards=Array.from({length:10},(_,i)=>({id:`train-${i}`,name:`Operative ${i}`,stats:{rifling:75,sniping:75,entry:75,utility:75,positioning:75,shotcalling:75}}));
  const identity={players:Object.fromEntries(cards.map((p,i)=>[p.id,{id:p.id,assignments:{t:FPS_T_POSITIONS[i%5],ct:FPS_CT_POSITIONS[i%5]},personality:FPS_IDENTITY_PERSONALITIES[(i*5+m)%54],dna:generatePlayerDNA(p.id),roleSuitability:.6,familiarity:.5}])),teams:{blue:{coach,plan,chemistry},red:{coach,plan,chemistry}}};
  const skillProfiles=Object.fromEntries(cards.map(p=>[p.id,generateFpsSkillProfile(p.id,seed,'2026-11-16T00:00:00.000Z')]));
  const sim=new FpsLiveSimulation(cards.slice(0,5),cards.slice(5),seed,identity,{mapId,skillProfiles,utilityLearning:{mode:'learn',model:brain}});
  for(let i=0;i<maxSteps&&sim.phase!=='finished';i++)sim.step();
  const stats=sim.snapshot().utilityLearning;
  brain=sim.utilityBrainCheckpoint();
  const t=stats.thisMatch;
  const perKind=Object.entries(t.kinds??{}).map(([k,v])=>`${k} ${v.successes}/${v.throws}`).join(', ');
  console.log(`${mapId.padEnd(9)} match ${m+1}: ${t.throws} throws [${perKind}], ${t.successes} on target (${t.throws?Math.round(t.successes/t.throws*100):0}%), ${t.remembered} from memory, ${t.discovered} new lineups · brain ${Object.keys(brain.entries).length} spots`);
}
writeFileSync(file,JSON.stringify(brain)+'\n');
console.log(`Saved ${Object.keys(brain.entries).length} remembered throws (${brain.throws} scored, ${brain.throws?Math.round(brain.successes/brain.throws*100):0}% on target overall).`);
