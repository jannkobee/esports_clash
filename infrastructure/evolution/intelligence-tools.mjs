import { readFile,writeFile,readdir,mkdir } from 'node:fs/promises';
import { join,resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import assert from 'node:assert/strict';
import { digest,ACCEPTANCE,proposeStrategies,assessStrategy,assessArena } from './strategy-evolution.mjs';
import { DEFAULT_AI_STRATEGY } from '../../EsportsClash.Web/src/aiStrategyConfig.ts';
import { loadIntelligencePolicy,policyLogits } from '../../EsportsClash.Web/src/intelligencePolicy.ts';
import {loadArenaActor} from '../../EsportsClash.Web/src/arenaLearning.ts';
const [action,inputFile,outputFile]=process.argv.slice(2);
const input=JSON.parse(await readFile(inputFile,'utf8'));
let result;
if(action==='manifest'){
  const files=[...(await readdir('src',{recursive:true})).filter(f=>/\.(tsx?|css|json)$/.test(f)).map(f=>'src/'+f.replaceAll('\\','/')),
    ...(await readdir('evolution-dist',{recursive:true})).filter(f=>/\.(html|js|css)$/.test(f)).map(f=>'evolution-dist/'+f)].sort();
  const source=await Promise.all(files.map(async file=>[file,digest(await readFile(file))]));
  const judge=await Promise.all(['intelligence-tools.mjs','episode-host.mjs','live-executor.mjs','strategy-evolution.mjs','trajectory-storage.mjs','trajectory-storage.test.mjs'].map(async file=>
    [file,digest(await readFile(new URL(file,import.meta.url)))]));
  const checks=[...(await readdir('src',{recursive:true})).filter(f=>f.endsWith('.test.mjs')).map(f=>'src/'+f),
    ...(await readdir('scripts',{recursive:true})).filter(f=>/\.(mjs|js|ts)$/.test(f)).map(f=>'scripts/'+f),
    'package.json','package-lock.json','server.mjs','vite.config.ts','vite.evolution.config.ts','tsconfig.json','tsconfig.app.json','tsconfig.node.json'].sort();
  judge.push(...await Promise.all(checks.map(async file=>[file,digest(await readFile(file))])));
  const arena= input.engine==='arena';
  const foundation=arena?loadArenaActor(JSON.parse(await readFile('src/data/arena-v6/arenaFoundation.json','utf8'))):undefined;
  if(arena)assert.ok(foundation);
  result={source,sourceHash:digest(source.filter(([file])=>file.startsWith('src/'))),judge,
    acceptance:arena?{...ACCEPTANCE,version:2,maximumExtraTeamDeathCases:null}:ACCEPTANCE,defaultPolicy:arena?foundation:DEFAULT_AI_STRATEGY};
}else if(action==='propose'){
  result=proposeStrategies(input.policy?.kind==='macro-strategy'?input.policy:DEFAULT_AI_STRATEGY,input.seed,2).map(p=>p.config);
}else if(action==='validate'){
  result=loadIntelligencePolicy(input);assert.ok(result,'Unsupported policy');
}else if(action==='assess'){
  result=input.plan.acceptance.version===2?assessArena(input.plan,input.observations):assessStrategy(input.plan,input.observations);
}else if(action==='source'){
  // Candidate source is generated from numeric data, never arbitrary model text.
  const p=loadIntelligencePolicy(input.policy);assert.equal(p?.kind,'macro-program');
  const folder=resolve(input.folder);await mkdir(folder,{recursive:true});
  const source=`// Generated strategic hypothesis: visible-state affine action scores.\nexport function score(x: readonly number[]): number[] {\n  const w=${JSON.stringify(p.weights)};\n  const b=${JSON.stringify(p.bias)};\n  return w.map((r,i)=>r.reduce((v,c,j)=>v+c*x[j],b[i]));\n}\n`;
  const candidate=join(folder,'macroCandidate.ts');
  try{await writeFile(candidate,source,{flag:'wx'});}catch(error){if(error.code!=='EEXIST')throw error;assert.equal(await readFile(candidate,'utf8'),source);}
  assert.deepEqual((await readdir(folder)).filter(f=>f.endsWith('.ts')),['macroCandidate.ts']);
  const build=spawnSync(process.execPath,['node_modules/typescript/bin/tsc','--ignoreConfig',candidate,'--strict','--target','es2022','--module','es2022','--skipLibCheck','--outDir',join(folder,'compiled')],{encoding:'utf8',timeout:60000});
  assert.equal(build.status,0,build.stderr+build.stdout);
  // Treat compiler output as trusted only after checking exact generated grammar.
  const compiled=await import('node:url').then(({pathToFileURL})=>import(pathToFileURL(join(folder,'compiled','macroCandidate.js'))));
  const fixtures=Array.from({length:65},(_,n)=>Array.from({length:20},(_,i)=>Math.sin(n*31+i*7)));
  for(const observation of fixtures)assert.deepEqual(compiled.score(observation),policyLogits(p,observation));
  result={policy:p,allowlist:['macroCandidate.ts'],sourceHash:digest(source),portablePolicyHash:digest(p),
    tests:{typecheck:true,compiledInterpreterParity:fixtures.length},
    diff:'New isolated macroCandidate.ts\n'+source,hypothesis:'Change optional same-tier macro preferences using legitimate visible context.'};
}else throw Error('Unsupported trusted tool');
await writeFile(outputFile,JSON.stringify(result,null,2)+'\n',{flag:'wx'});
