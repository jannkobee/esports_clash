import assert from 'node:assert/strict';
import {readFile,writeFile,readdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {liveExecutor} from './live-executor.mjs';
import {DEFAULT_AI_STRATEGY} from '../../EsportsClash.Web/src/aiStrategyConfig.ts';
const output=process.argv[2];if(!output)throw Error('New output path required');
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
const files=[...(await readdir('src',{recursive:true})).filter(f=>/\.(tsx?|css)$/.test(f)).map(f=>'src/'+f),
  ...(await readdir('evolution-dist',{recursive:true})).filter(f=>/\.(html|js|css)$/.test(f)).map(f=>'evolution-dist/'+f)].sort();
const manifest=await Promise.all(files.map(async f=>[f,hash(await readFile(f))]));
const judgeManifest=await Promise.all(['live-executor.mjs','verify-strategy-baseline.mjs'].map(async file=>[file,hash(await readFile(new URL(file,import.meta.url)))]));
// Separate from the failed six-minute plan. Known seeds are compatibility only.
const episodes=[
  {swapped:false,renderless:true,maxSeconds:1200,strategies:{}},
  {swapped:false,renderless:true,maxSeconds:1200,strategies:{blue:DEFAULT_AI_STRATEGY,red:DEFAULT_AI_STRATEGY}},
  {swapped:true,renderless:true,maxSeconds:120,strategies:{}},
  {swapped:true,renderless:true,maxSeconds:120,strategies:{blue:DEFAULT_AI_STRATEGY,red:DEFAULT_AI_STRATEGY}},
  {swapped:false,renderless:false,maxSeconds:120,strategies:{}},
];
const plan={version:3,scope:'Known seed 47/draft 2 compatibility only; existing trusted server bridge; no improvement or fresh win-rate estimate',
  source_manifest:manifest,source_hash:hash(JSON.stringify(manifest)),judgeManifest,episodes,wallSeconds:900};
await writeFile(output+'.plan.json',JSON.stringify(plan,null,2)+'\n',{flag:'wx'});
const report={source_hash:plan.source_hash,episodes:[],verified:false,full_match_sides:['original'],production_eligible:false};
const executor=await liveExecutor();
try{
  for(const config of episodes){
    const episode=await executor.episode({seed:47,draft:2,wallSeconds:plan.wallSeconds,...config},
      async progress=>{report.progress=progress;await writeFile(output+'.partial.json',JSON.stringify(report,null,2)+'\n');});
    report.episodes.push({...config,...episode});
    await writeFile(output+'.partial.json',JSON.stringify(report,null,2)+'\n');
    assert.equal(episode.status,config.maxSeconds===1200?'terminal':'censored','Expected horizon not reached');
    const reference=report.episodes.find(e=>e.swapped===config.swapped&&e!==report.episodes.at(-1));
    if(reference){
      for(const state of episode.states){const previous=reference.states.find(s=>Math.abs(s.second-state.second)<1e-6);
        assert.ok(previous,'Missing reference checkpoint');assert.deepEqual(state,previous,'State/RNG/audits mismatch');}
      if(config.maxSeconds===1200)assert.deepEqual(episode.result,reference.result);
    }
    console.error(`Verified ${config.swapped?'swapped':'original'} ${episode.status} at ${episode.second}s`);
  }
  report.verified=true;
}catch(error){report.error=error.stack;throw error;}
finally{await writeFile(output,JSON.stringify(report,null,2)+'\n',{flag:'wx'});await executor.close();}
