import {execFileSync} from 'node:child_process';
import {mkdirSync,cpSync,existsSync,readdirSync,readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('../../',import.meta.url));
const directory=process.env.LEARNING_DATA??root+'EsportsClash.Api/storage/app/automatic-learning';
const checkout=resolve(directory,'exports/checkout');
const branch=process.env.LEARNING_GIT_BRANCH||'main';
const gitEnv={...process.env,GIT_TERMINAL_PROMPT:'0'};
const git=(...args)=>execFileSync('git',args,{cwd:checkout,stdio:'pipe',env:gitEnv,timeout:120000});
function resolveRemote(){
  if(process.env.LEARNING_GIT_REMOTE)return process.env.LEARNING_GIT_REMOTE;
  try{
    const origin=execFileSync('git',['-c','safe.directory=*','-C',root,'remote','get-url','origin'],{stdio:'pipe',env:gitEnv,encoding:'utf8',timeout:10000}).trim();
    if(origin)return origin;
  }catch{}
  return 'https://github.com/jannkobee/esports_clash.git';
}
// Each invocation retries the complete unpublished snapshot. No production checkout is modified.
try{
  const remote=resolveRemote();
  if(!existsSync(checkout+'/.git')){
    mkdirSync(resolve(directory,'exports'),{recursive:true});
    execFileSync('git',['clone','--no-checkout',remote,checkout],{timeout:120000,stdio:'pipe',env:gitEnv});
  }else{
    try{git('rebase','--abort');}catch{}
    git('remote','set-url','origin',remote);
  }
  git('fetch','origin');
  try{git('checkout','-B',branch,'origin/'+branch);}catch{git('checkout','-B',branch,'origin/HEAD');}
  git('config','user.name','FPS Learning');git('config','user.email','fps-learning@users.noreply.github.com');
  const target=checkout+'/EsportsClash.Api/AutomaticLearning/reports';mkdirSync(target,{recursive:true});
  if(existsSync(directory+'/reports'))cpSync(directory+'/reports',target,{recursive:true});
  // Include passing candidate evaluation bundles in reports/candidates on the target branch; active.json remains owner-gated.
  if(existsSync(directory+'/candidates')){
    const candidates=target+'/candidates';
    for(const name of readdirSync(directory+'/candidates').filter(n=>n.endsWith('.json'))){
      if(!JSON.parse(readFileSync(directory+'/candidates/'+name,'utf8')).report?.passed)continue;
      mkdirSync(candidates,{recursive:true});
      cpSync(directory+'/candidates/'+name,candidates+'/'+name);
    }
  }
  git('add','EsportsClash.Api/AutomaticLearning/reports');
  if(git('status','--porcelain','--','EsportsClash.Api/AutomaticLearning/reports').length){
    git('commit','-m','Record automatic FPS learning reports');
    try{
      git('push','origin','HEAD:refs/heads/'+branch);
    }catch{
      git('fetch','origin');
      git('rebase','origin/'+branch);
      git('push','origin','HEAD:refs/heads/'+branch);
    }
  }
  if(process.env.LEARNING_GIT_REVIEW_BRANCHES==='true'&&existsSync(directory+'/candidates')){
    for(const name of readdirSync(directory+'/candidates').filter(n=>n.endsWith('.json'))){
      if(!JSON.parse(readFileSync(directory+'/candidates/'+name,'utf8')).report?.passed)continue;
      const reviewBranch='automatic-learning/review-'+name.slice(0,-5);
      if(git('ls-remote','--heads','origin','refs/heads/'+reviewBranch).length)continue;
      git('checkout','-B',reviewBranch,'origin/'+branch);
      const candidates=checkout+'/EsportsClash.Api/AutomaticLearning/reports/candidates';mkdirSync(candidates,{recursive:true});
      cpSync(directory+'/candidates/'+name,candidates+'/'+name);
      git('add','EsportsClash.Api/AutomaticLearning/reports/candidates');
      if(git('status','--porcelain','--','EsportsClash.Api/AutomaticLearning/reports/candidates').length){
        git('commit','-m','Review FPS candidate; owner approval required');
        git('push','origin','HEAD:refs/heads/'+reviewBranch);
      }
    }
  }
}catch(error){
  const detail=error?.stderr?.toString?.().trim()||error?.message||String(error);
  console.error('Git export failed; durable local files retained for retry:',detail);
  process.exitCode=1;
}
