import {execFileSync} from 'node:child_process';
import {mkdirSync,cpSync,existsSync,readdirSync,readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {root} from './model.mjs';
const directory=process.env.LEARNING_DATA??root+'EsportsClash.Api/storage/app/automatic-learning';
const checkout=resolve(directory,'exports/checkout');
const git=(...args)=>execFileSync('git',args,{cwd:checkout,stdio:'pipe',env:{...process.env,GIT_TERMINAL_PROMPT:'0'},timeout:120000});
// Each invocation retries the complete unpublished snapshot. No production checkout is modified.
try{
  if(!existsSync(checkout+'/.git')){
    mkdirSync(resolve(directory,'exports'),{recursive:true});
    execFileSync('git',['clone','--no-checkout',process.env.LEARNING_GIT_REMOTE??'https://github.com/jannkobee/esports_clash.git',checkout],{timeout:120000,stdio:'pipe',env:{...process.env,GIT_TERMINAL_PROMPT:'0'}});
  }
  git('fetch','origin');
  try{git('checkout','-B','automatic-learning/data','origin/automatic-learning/data');}catch{git('checkout','-B','automatic-learning/data','origin/HEAD');}
  git('config','user.name','FPS Learning');git('config','user.email','fps-learning@users.noreply.github.com');
  const target=checkout+'/EsportsClash.Api/AutomaticLearning/reports';mkdirSync(target,{recursive:true});
  cpSync(directory+'/reports',target,{recursive:true});
  git('add','EsportsClash.Api/AutomaticLearning/reports');
  if(git('status','--porcelain').length){git('commit','-m','Record automatic FPS learning reports');git('push','origin','HEAD:refs/heads/automatic-learning/data');}
  // Screening candidates stay review-only and explicitly require ablations.
  for(const name of readdirSync(directory+'/candidates').filter(n=>n.endsWith('.json'))){
    if(!JSON.parse(readFileSync(directory+'/candidates/'+name)).report.passed)continue;
    const branch='automatic-learning/review-'+name.slice(0,-5);
    if(git('ls-remote','--heads','origin','refs/heads/'+branch).length)continue;
    git('checkout','-B',branch,'automatic-learning/data');
    const candidates=checkout+'/EsportsClash.Api/AutomaticLearning/reports/candidates';mkdirSync(candidates,{recursive:true});
    cpSync(directory+'/candidates/'+name,candidates+'/'+name);
    git('add','EsportsClash.Api/AutomaticLearning/reports/candidates');git('commit','-m','Review FPS candidate; owner approval required');git('push','origin','HEAD:refs/heads/'+branch);
  }
}catch{console.error('Git export failed; durable local files retained for retry.');process.exitCode=1;}
