import test from 'node:test';
import assert from 'node:assert/strict';
import {createFpsLearningModel,loadFpsLearningModel,fpsLearningModelHash,learnFpsActionValue,applyFpsLearningRound,
  chooseLearnedNavigation,liveNavigationChoices,FpsLiveLearner,FPS_LEARNING_FEATURES} from './fps/fpsLiveLearning.ts';
import {readFpsLearning,saveFpsLearningRound,resetFpsLearning,FPS_LEARNING_STORAGE_KEY} from './fps/fpsLiveLearningStorage.ts';
import {FpsLiveSimulation} from './fps/fpsLiveSimulation.ts';
import {FPS_IDENTITY_PERSONALITIES,generatePlayerDNA} from './fps/fpsIdentity.ts';
import {generateFpsSkillProfile,fpsSkillRandom} from './fps/fpsSkillProfile.ts';
import {LIVE_FPS_MAP,LIVE_ACTOR_RADIUS,distance} from './fps/fpsLiveMap.ts';
import {segmentHitsWall} from './fps/fpsSpatialWorld.ts';

const plan={tempo:.6,structure:.7,aggression:.5,preparation:.7,freedom:.5,economy:.8};
const coach={...plan,rigidity:.7,communication:.7,leadership:.7,adaptability:.7,development:.5};
const chemistry={trust:.6,communication:.6,understanding:.6,leadershipAcceptance:.6,roleCompetition:.3};
const cards=Array.from({length:10},(_,i)=>({id:`learner-${i}`,name:`Player ${i}`,stats:{lan:80,iq:80,tf:80,clu:80,sta:80,flx:80,ldr:80}}));
const identity={players:Object.fromEntries(cards.map((p,i)=>[p.id,{id:p.id,personality:FPS_IDENTITY_PERSONALITIES[i],dna:generatePlayerDNA(p.id),intensity:.6,roleSuitability:.6,familiarity:.5}])),teams:{blue:{coach,plan,chemistry},red:{coach,plan,chemistry}}};
const profiles=Object.fromEntries(cards.map(p=>[p.id,generateFpsSkillProfile(p.id,1337,'2026-11-11T00:00:00Z')]));
const game=learning=>new FpsLiveSimulation(cards.slice(0,5),cards.slice(5),1337,identity,{skillProfiles:profiles,learning});
const actor={id:'anonymous',team:'red',attacking:true,x:-19,z:0,hp:100,yaw:0,role:'trade',bomb:false,ammo:20,reload:0};
const context=overrides=>({actor:{...actor},goal:{x:-23,z:21},remaining:80,planted:false,time:20,beliefs:[],allies:[],caution:0,evidence:'',...overrides});
const storage=()=>{const data=new Map();return {getItem:key=>data.get(key)??null,setItem:(key,value)=>data.set(key,value),removeItem:key=>data.delete(key)};};
const features=(values={})=>Object.assign(Array(FPS_LEARNING_FEATURES).fill(0),{0:1,...values});

test('checkpoint validation rejects incompatible, malformed and non-finite parameters and clones accepted data',()=>{
  const raw=createFpsLearningModel(),loaded=loadFpsLearningModel(JSON.parse(JSON.stringify(raw)));
  assert.deepEqual(loaded,raw);loaded.weights['attack:A'][0]=2;assert.equal(raw.weights['attack:A'][0],0);
  for(const change of [m=>m.compatibility='old-map',m=>m.weights['attack:A'].pop(),m=>m.weights['attack:B'][0]=NaN,
    m=>m.weights['defend:A'][0]=Infinity,m=>m.updates=-1,m=>m.recentEpisodes=Array(65).fill('x')]){
    const invalid=structuredClone(raw);change(invalid);assert.equal(loadFpsLearningModel(invalid),undefined);
  }
});

test('real value updates learn from changed outcomes rather than retaining a fixed route preference',()=>{
  const model=createFpsLearningModel(),random=fpsSkillRandom(42,'outcomes');
  const choices=[{context:'attack:A',features:features({1:.9,3:.4,28:1})},
    {context:'attack:A',features:features({1:.35,2:.3,29:1})}];
  assert.equal(chooseLearnedNavigation(model,choices,random,0).index,0);
  for(let round=0;round<500;round++){
    const selected=chooseLearnedNavigation(model,choices,random,.2).index;
    const reward=random()<(selected===1?.85:.15)?1:-1;
    applyFpsLearningRound(model,{id:`measured:${round}`,samples:[{...choices[selected],target:reward}]});
  }
  assert.equal(chooseLearnedNavigation(model,choices,random,0).index,1);
  for(let round=0;round<900;round++){
    const selected=chooseLearnedNavigation(model,choices,random,.2).index;
    const reward=random()<(selected===0?.9:.1)?1:-1;
    applyFpsLearningRound(model,{id:`changed:${round}`,samples:[{...choices[selected],target:reward}]});
  }
  assert.equal(chooseLearnedNavigation(model,choices,random,0).index,0);
  assert.ok(model.updates>0);
});

test('learning validates an entire round before updating and deduplicates completed episodes',()=>{
  const model=createFpsLearningModel(),before=fpsLearningModelHash(model),valid={context:'attack:A',features:features(),target:1};
  assert.throws(()=>applyFpsLearningRound(model,{id:'bad',samples:[valid,{...valid,target:NaN}]}));
  assert.equal(fpsLearningModelHash(model),before);
  assert.equal(applyFpsLearningRound(model,{id:'once',samples:[valid]}),true);
  const trained=fpsLearningModelHash(model);
  assert.equal(applyFpsLearningRound(model,{id:'once',samples:[valid]}),false);assert.equal(fpsLearningModelHash(model),trained);
  assert.throws(()=>learnFpsActionValue(model,{...valid,features:[1]}));
});

test('navigation alternatives are collision-safe routes to the existing goal and use bounded features',()=>{
  for(const c of [context(),context({actor:{...actor,x:19,z:12},goal:{x:23,z:17.9}})]){
    const choices=liveNavigationChoices(c);assert.ok(choices.length>=2&&choices.length<=5);
    for(const choice of choices){
      assert.equal(choice.features.length,FPS_LEARNING_FEATURES);
      assert.ok(choice.features.every(n=>Number.isFinite(n)&&Math.abs(n)<=1));
      let previous=c.actor;
      for(const point of choice.path){assert.ok(!LIVE_FPS_MAP.solids.some(w=>segmentHitsWall(previous,point,w,LIVE_ACTOR_RADIUS)));previous=point;}
      assert.ok(distance(previous,c.goal)<.01);
    }
  }
});

test('interrupted rounds discard pending experience and do not alter the saved value function',()=>{
  const learner=new FpsLiveLearner({mode:'learn',exploration:0}),before=fpsLearningModelHash(learner.model),c=context();
  learner.route(c,()=>.5);learner.close({...c.actor,z:4},24);
  assert.equal(fpsLearningModelHash(learner.model),before);
  learner.abandonRound();assert.equal(learner.completeRound([c.actor],'red',30,'interrupted'),undefined);
  assert.equal(fpsLearningModelHash(learner.model),before);
});

test('a busy tick defers expensive evaluation while preserving an existing navigation commitment',()=>{
  const learner=new FpsLiveLearner({mode:'learn'}),c=context();
  assert.equal(learner.route(c,()=>.5,false),undefined);assert.equal(learner.stats().decisions,0);
  const chosen=learner.route(c,()=>.5,true);
  const deferred=learner.route({...c,time:25},()=>.5,false);
  assert.ok(chosen);assert.equal(deferred.retained,true);assert.equal(learner.stats().decisions,1);
});

test('stationary actors receive no fabricated progress from a change in threat-avoidance path length',()=>{
  const learner=new FpsLiveLearner({mode:'learn',exploration:0});
  const c=context({caution:1,beliefs:[{key:'reported',x:-19,z:10,certainty:.9,radius:1,age:1}]});
  assert.ok(learner.route(c,()=>.5));learner.close(c.actor,21);
  assert.ok(learner.episodes.get(c.actor.id)[0].reward<=0);
});

test('completed experience updates both CT and T contexts; frozen evaluation changes no weights',()=>{
  for(const mode of ['learn','frozen']){
    const learner=new FpsLiveLearner({mode,exploration:0}),before=learner.checkpoint();
    const t=context(),ct=context({actor:{...actor,id:'defender',team:'blue',attacking:false,x:-19,z:14},goal:{x:-23,z:23}});
    learner.route(t,()=>.5);learner.route(ct,()=>.5);
    const round=learner.completeRound([t.actor,ct.actor],'red',30,`both:${mode}`);
    if(mode==='learn'){
      assert.equal(round.samples.length,2);assert.notDeepEqual(learner.model.weights['attack:A'],before.weights['attack:A']);
      assert.notDeepEqual(learner.model.weights['defend:A'],before.weights['defend:A']);assert.equal(learner.model.rounds,1);
    }else{assert.equal(round,undefined);assert.deepEqual(learner.checkpoint(),before);}
  }
});

test('completed rounds persist across fresh readers, merge successive experience and tolerate storage failure',()=>{
  const store=storage(),sample={context:'attack:A',features:features({1:.4}),target:1};
  const one=saveFpsLearningRound({id:'first',samples:[sample]},store);
  assert.equal(readFpsLearning(store).updates,1);assert.equal(one.rounds,1);
  saveFpsLearningRound({id:'second',samples:[sample]},store);saveFpsLearningRound({id:'first',samples:[sample]},store);
  assert.equal(readFpsLearning(store).rounds,2);assert.equal(readFpsLearning(store).updates,2);
  store.setItem(FPS_LEARNING_STORAGE_KEY,'corrupt');assert.equal(readFpsLearning(store),undefined);
  resetFpsLearning(store);assert.equal(readFpsLearning(store),undefined);
  assert.equal(saveFpsLearningRound({id:'quota',samples:[sample]},{...store,setItem:()=>{throw Error('quota');}}),undefined);
});

test('the live learner cannot read unseen enemy positions when choosing routes',()=>{
  const a=game({mode:'frozen'}),b=game({mode:'frozen'});
  for(const sim of [a,b]){
    sim.phase='live';sim.time=40;sim.liveElapsed=25;sim.remaining=90;sim.site='A';
    const p=sim.actors.find(p=>p.bomb);Object.assign(p,{x:-19,z:0,target:undefined,noticedEnemies:[],flash:0,smoke:0,incendiary:0});
  }
  b.actors.filter(p=>!p.attacking).forEach(p=>Object.assign(p,{x:30,z:40}));
  const p=a.actors.find(p=>p.bomb),q=b.actors.find(p=>p.bomb);a.decide(p);b.decide(q);
  assert.deepEqual(p.path,q.path);assert.deepEqual(a.snapshot().learning,b.snapshot().learning);
});

test('the same seed and pinned learning checkpoint reproduce both actions and updates',()=>{
  const model=createFpsLearningModel(),a=game({mode:'learn',model}),b=game({mode:'learn',model});
  for(let tick=0;tick<750;tick++){a.step();b.step();}
  a.finishRound('red','Deterministic completion fixture');b.finishRound('red','Deterministic completion fixture');
  assert.ok(a.learningDiagnostics().current.updates>0);
  assert.deepEqual(a.snapshot(),b.snapshot());assert.deepEqual(a.learningDiagnostics(),b.learningDiagnostics());
  assert.deepEqual(model,createFpsLearningModel(),'The caller checkpoint must remain pinned and unmodified');
});

test('a real learned-route plant and objective result train once and load into a new exhibition',()=>{
  const store=storage(),commits=[];
  const sim=game({mode:'learn',exploration:0,onRound:round=>{commits.push(round);saveFpsLearningRound(round,store);}});
  while(sim.phase==='freeze')sim.step();
  const p=sim.actors.find(p=>p.bomb),enemy=sim.actors.find(p=>!p.attacking);
  sim.actors.forEach(a=>Object.assign(a,{hp:0,target:undefined,nextSense:Infinity,nextThink:Infinity,nextShot:Infinity}));
  Object.assign(p,{hp:100,x:-19,z:8,flash:0,smoke:0,incendiary:0,goal:undefined,path:[],nextThink:0,noticedEnemies:[],freezeDelay:0});
  Object.assign(enemy,{hp:100,x:0,z:-42});sim.site='A';sim.remaining=80;
  let sawPlant=false;
  for(let tick=0;tick<3600&&!sim.roundHistory.length;tick++){
    sim.step();if(sim.bomb.status==='planted'){sawPlant=true;assert.equal(readFpsLearning(store),undefined,'Unfinished rounds cannot publish learning');}
  }
  assert.equal(sawPlant,true);assert.ok(['defused','exploded'].includes(sim.bomb.status));
  assert.equal(sim.roundHistory[0]?.winner,sim.bomb.status==='defused'?'blue':'red');assert.equal(commits.length,1);
  const saved=readFpsLearning(store);assert.equal(saved.rounds,1);assert.ok(saved.updates>0);
  assert.ok(sim.snapshot().learning.decisions>0);
  assert.deepEqual(game({mode:'learn',model:saved}).learningDiagnostics().initial,saved);
  const serialized=JSON.stringify(saved);assert.ok(!serialized.includes('learner-'));assert.ok(!serialized.includes('dna'));
});

test('learning never diverts an urgent bomb carrier away from the reachable plant objective',()=>{
  const sim=game({mode:'learn',exploration:1});sim.phase='live';sim.time=40;sim.remaining=20;sim.site='A';
  const p=sim.actors.find(a=>a.bomb);Object.assign(p,{x:0,z:-33,target:undefined,noticedEnemies:[],flash:0,smoke:0,incendiary:0});
  sim.decide(p);assert.equal(p.objectiveUrgent,true);assert.equal(sim.snapshot().learning.decisions,0);
  assert.ok(distance(p.goal,LIVE_FPS_MAP.sites.A)<3.5);
});
