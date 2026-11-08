import {readFile,writeFile,rename} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {pathToFileURL} from 'node:url';
const folder=process.argv[2];
const atomic=async(name,data)=>{await writeFile(`${folder}/${name}.tmp`,JSON.stringify(data));await rename(`${folder}/${name}.tmp`,`${folder}/${name}`);};
try {
  const {plan,plan_hash}=JSON.parse(await readFile(`${folder}/allocation.json`,'utf8'));
  const hash=createHash('sha256').update(JSON.stringify(plan)).digest('hex');
  if(hash!==plan_hash||plan.provenance!=='launch_simulation')throw Error('Invalid labeled historical allocation');
  const {createSimulationState,stepSimulation}=await import(pathToFileURL('/workspace/EsportsClash.Web/src/matchSimulationEngine.ts'));
  const {INITIAL_PLAYERS,CHAMPIONS}=await import(pathToFileURL('/workspace/EsportsClash.Web/src/mockData.ts'));
  const {applyWorldPlayerProfile}=await import(pathToFileURL('/workspace/EsportsClash.Web/src/worldPlayerProfile.ts'));
  const lineup=side=>plan[side].map(slot=>{const p=INITIAL_PLAYERS.find(p=>p.id===slot.card_id);const champion=CHAMPIONS.find(c=>c.id===slot.avatar_id);if(!p||!champion)throw Error('Unknown historical role or Avatar');return {player:applyWorldPlayerProfile(p,plan.player_profiles[slot.instance_id]),champion};});
  const state=createSimulationState({seed:plan.seed,blueLineup:lineup('blue'),redLineup:lineup('red')});
  // Explicit historical baseline only. Do not use the benchmark's gold-lead timeout winner.
  while(!state.matchFinished && state.matchTime<7200)stepSimulation(state,1/30);
  const nexus=Object.fromEntries(['blue','red'].map(side=>[side,state.structures.some(s=>s.team===side&&s.type==='nexus'&&s.isAlive)]));
  if(!state.matchFinished||!state.winner||nexus[state.winner==='blue'?'red':'blue'])throw Error('Historical simulation did not reach a real Nexus finish');
  const champions=state.champions.map((c,i)=>({instance_id:plan[c.team][i%5]?.instance_id,name:c.player.name,avatar:c.champion.displayName??c.champion.name,team:c.team,kills:c.kills,deaths:c.deaths,assists:c.assists,cs:c.cs,gold:c.gold,damageDealt:c.damageDealt,damageTaken:c.damageTaken}));
  const result={provenance:'launch_simulation',controller:'explicit-historical-baseline',seed:plan.seed,winner:state.winner,durationSeconds:state.matchTime,terminal_nexus:nexus,champions,events:state.recordedEvents,blueKills:champions.filter(c=>c.team==='blue').reduce((s,c)=>s+c.kills,0),redKills:champions.filter(c=>c.team==='red').reduce((s,c)=>s+c.kills,0)};
  await atomic('result.json',result);await atomic('state.json',{status:'completed'});
} catch(error){await atomic('state.json',{status:'failed',error:String(error.message??error)});process.exitCode=1;}
