import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
import {liveExecutor} from './live-executor.mjs';
import {digest,configHash} from './strategy-evolution.mjs';
import {DEFAULT_AI_STRATEGY,loadAIStrategyConfig} from '../../EsportsClash.Web/src/aiStrategyConfig.ts';
const [baselinePath,output]=process.argv.slice(2);
if(!baselinePath||!output)throw Error('Verified baseline and new output paths required');
const baseline=JSON.parse(await readFile(baselinePath,'utf8'));
const baselinePlan=JSON.parse(await readFile(baselinePath+'.plan.json','utf8'));
assert.equal(baseline.verified,true);
for(const[path,hash]of baselinePlan.source_manifest)assert.equal(digest(await readFile(path)),hash,'Frozen live baseline source changed');
const config=loadAIStrategyConfig({...DEFAULT_AI_STRATEGY,farmStrategic:.32,farmTactical:.26,
  farmConversionTactical:.55,pushStrategic:.28,pushTempoStrategic:.72});assert.ok(config);
const plan={version:1,scope:'Known seed 47/draft 2 software influence check, excluded from fresh evaluation',
  config,configHash:configHash(config),sourceHash:baseline.source_hash,baselineHash:digest(await readFile(baselinePath)),
  judgeManifest:await Promise.all(['live-executor.mjs','verify-strategy-influence.mjs'].map(async name=>[name,digest(await readFile(new URL(name,import.meta.url)))])),
  seed:47,draft:2,swapped:false,maxSeconds:1200,wallSeconds:900};
await writeFile(output+'.plan.json',JSON.stringify(plan,null,2)+'\n',{flag:'wx'});
const executor=await liveExecutor();let report={planHash:digest(plan),promoted:false};
try{
  const episode=await executor.episode({...plan,strategies:{blue:config,red:DEFAULT_AI_STRATEGY}});
  const reference=baseline.episodes.find(e=>e.swapped===false&&e.maxSeconds===1200);
  assert.deepEqual(episode.states[0],reference.states[0],'Initial world/RNG differs before policy influence');
  const comparisons=episode.states.slice(1).flatMap(state=>{
    const previous=reference.states.find(s=>Math.abs(state.second-s.second)<1e-6);
    return previous?[{second:state.second,changedWorld:state.fingerprint!==previous.fingerprint,
      randomStateEqual:state.randomState===previous.randomState}]:[];
  });
  report={...report,episode,comparisons,initialStateMatched:true,observedInfluence:comparisons.some(c=>c.changedWorld),
    baselineWinner:reference.result?.winner??null,challengerWinner:episode.result?.winner??null,
    limitation:'One known integration fixture. Different world trajectories verify influence, not decision-change frequency, generalization, safety or improvement.'};
}catch(error){report.error=error.stack;throw error;}
finally{await writeFile(output,JSON.stringify(report,null,2)+'\n',{flag:'wx'});await executor.close();}
console.log(JSON.stringify({observedInfluence:report.observedInfluence,status:report.episode?.status,promoted:false}));
