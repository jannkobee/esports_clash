import test from 'node:test';
import assert from 'node:assert/strict';
import {createFpsTeamPlaybook,loadFpsTeamPlaybook,applyFpsPlaybookRound,chooseFpsPlay,fpsPlaybookRandom,FPS_PLAYBOOK_RULES,summarizeFpsPlaybook,createFpsOpponentModel,recordFpsOpponentRound,loadFpsOpponentModel,fpsCounterPrior} from './fps/fpsLivePlaybook.ts';
import {LIVE_SEED_ATTACK_PLAYS,LIVE_SEED_DEFENSE_PLAYS} from './fps/fpsLivePlays.ts';
import {recordFpsOpponentPattern,knownFpsDangerSpots} from './fps/fpsOpponentPatterns.ts';
import {liveTacticWeights,liveDefenseWeights,LIVE_TACTIC_CHOICES} from './fps/fpsLiveTactics.ts';
import {FpsLiveSimulation} from './fps/fpsLiveSimulation.ts';
import {FPS_T_POSITIONS,FPS_CT_POSITIONS} from './fps/fpsPlayerArchitecture.ts';
import {FPS_IDENTITY_PERSONALITIES,generatePlayerDNA} from './fps/fpsIdentity.ts';

const RANGES={rushBelow:[0,1],rushSmokeBelow:[0,1],midOpenBelow:[0,1],defaultMidAbove:[.5,2],fakeOpenBelow:[0,1],fakeSmokeAbove:[0,2],lurkerHoldBelow:[0,1],fakeWindow:[14,36],pistolWeight:[.5,3],stackSlots:[3,4],quietOpenBelow:[0,.6],midPushBelow:[0,1]};
/** Simulated league history: play `rounds` rounds, winning with a fixed per-play probability. */
function simulate(book,rounds,winChance,id='t',opponent){
  const random=fpsPlaybookRandom(id),changes=[];
  for(let i=0;i<rounds;i++){
    const side=i%2?'defense':'attack',plays=side==='attack'?book.attack:book.defense;
    const spec=chooseFpsPlay(plays,random,()=>1,opponent,.5);
    changes.push(applyFpsPlaybookRound(book,{id:`${id}:${i}`,side,playId:spec.id,won:random()<winChance(spec),opponent}));
  }
  return changes;
}

test('a new playbook holds exactly the seed plays and survives a strict round trip',()=>{
  const book=createFpsTeamPlaybook('fontessa');
  assert.deepEqual(Object.keys(book.attack).sort(),Object.values(LIVE_SEED_ATTACK_PLAYS).map(p=>p.id).sort());
  assert.deepEqual(Object.keys(book.defense).sort(),Object.values(LIVE_SEED_DEFENSE_PLAYS).map(p=>p.id).sort());
  assert.deepEqual(loadFpsTeamPlaybook(JSON.parse(JSON.stringify(book))),book);
  const broken=structuredClone(book);broken.attack['seed:rush_a'].spec.rushBelow=1.5;
  assert.equal(loadFpsTeamPlaybook(broken),undefined,'out-of-range fields reject the book');
  const missing=structuredClone(book);delete missing.defense['seed:standard'];
  assert.equal(loadFpsTeamPlaybook(missing),undefined,'a book missing a seed play is incompatible');
});

test('innovation is bounded, deterministic, and never deletes a play',()=>{
  const book=createFpsTeamPlaybook('spillway'),twin=createFpsTeamPlaybook('spillway');
  const edge=spec=>spec.id.startsWith('v:')?.6:.45;
  let previous=0;
  for(let block=0;block<12;block++){
    simulate(book,50,edge,`league-${block}`);simulate(twin,50,edge,`league-${block}`);
    const count=Object.keys(book.attack).length+Object.keys(book.defense).length;
    assert.ok(count>=previous,'play count never decreases');previous=count;
  }
  assert.deepEqual(book,twin,'replaying the same rounds reproduces the book');
  assert.ok(book.innovations>0,'variants were proposed');assert.ok(book.promotions>0,'a stronger variant was promoted');
  assert.ok(loadFpsTeamPlaybook(JSON.parse(JSON.stringify(book))),'the evolved book stays valid');
  for(const r of [...Object.values(book.attack),...Object.values(book.defense)]){
    for(const [k,[lo,hi]] of Object.entries(RANGES))if(k in r.spec)assert.ok(r.spec[k]>=lo&&r.spec[k]<=hi,`${r.spec.name} ${k}=${r.spec[k]}`);
    if(r.parent){assert.ok(book.attack[r.parent]||book.defense[r.parent],'parents are kept');assert.equal(r.generation>0,true);}
    if(r.status==='active'&&r.parent&&r.spec.id.startsWith('v:')){
      const parent=book.attack[r.parent]??book.defense[r.parent];
      assert.ok(r.trials>=FPS_PLAYBOOK_RULES.judgeAfter,'promotion needs enough trials');void parent;
    }
  }
  const summary=summarizeFpsPlaybook(book);
  assert.ok(summary.attack.learned+summary.defense.learned>0);
  assert.equal(Object.values(book.attack).filter(r=>r.status!=='archived').length<=FPS_PLAYBOOK_RULES.maxActive+FPS_PLAYBOOK_RULES.maxCandidates,true);
});

test('results against a specific opponent drive counter-plays for that opponent only',()=>{
  const book=createFpsTeamPlaybook('fontessa');
  // Against 'club:2' only Stack B works; against 'club:3' Stack B fails and the rest are even.
  for(let i=0;i<400;i++){
    const playId=Object.keys(book.defense).sort()[Math.floor(i/2)%6],vsTwo=i%2===0;
    applyFpsPlaybookRound(book,{id:`c${i}`,side:'defense',playId,opponent:vsTwo?'club:2':'club:3',won:vsTwo?playId==='seed:stack_b':playId!=='seed:stack_b'&&i%4<3});
  }
  const pick=(opponent,n=300)=>{const random=fpsPlaybookRandom('pick-'+opponent);let stackB=0;for(let i=0;i<n;i++)if(chooseFpsPlay(book.defense,random,()=>1,opponent).id==='seed:stack_b')stackB++;return stackB/n;};
  assert.ok(pick('club:2')>.6,'the counter is preferred against the opponent it beats');
  assert.ok(pick('club:3')<.2,'the same play is avoided against an opponent it loses to');
});

test('the opponent model holds only lawful observations and biases decisions only after evidence',()=>{
  const model=createFpsOpponentModel();
  for(let i=0;i<8;i++)recordFpsOpponentRound(model,'club:4',{opponentAttacked:true,plantSite:'B',firstBlood:'B',earlyRush:i<6,slowDefault:false,heavyUtility:false,saved:false,passiveAnchors:false});
  const profile=loadFpsOpponentModel(JSON.parse(JSON.stringify(model))).opponents['club:4'];
  assert.deepEqual(Object.keys(profile).sort(),['attackRounds','earlyRush','firstBlood','heavyUtility','passiveAnchors','plants','rounds','saves','slowDefault']);
  assert.ok(!JSON.stringify(model).includes('seed:'),'no opponent play identifiers are stored');
  assert.ok(fpsCounterPrior(profile,'defense',LIVE_SEED_DEFENSE_PLAYS.stack_b)>fpsCounterPrior(profile,'defense',LIVE_SEED_DEFENSE_PLAYS.stack_a));
  assert.equal(fpsCounterPrior({...profile,rounds:3},'defense',LIVE_SEED_DEFENSE_PLAYS.stack_b),1,'no bias before five observed rounds');
});

function match(seed,teamLearning,steps=9000){
  const plan={tempo:.6,structure:.7,aggression:.5,preparation:.7,freedom:.5,economy:.8},coach={...plan,rigidity:.7,communication:.7,leadership:.7,adaptability:.7,development:.5};
  const chemistry={trust:.6,communication:.6,understanding:.6,leadershipAcceptance:.6,roleCompetition:.3};
  const cards=Array.from({length:10},(_,i)=>({id:`pb-${i}`,name:`Operative ${i}`,stats:{rifling:70,sniping:70,entry:70,utility:70,positioning:70,shotcalling:70}}));
  const identity={players:Object.fromEntries(cards.map((p,i)=>[p.id,{id:p.id,assignments:{t:FPS_T_POSITIONS[i%5],ct:FPS_CT_POSITIONS[i%5]},personality:FPS_IDENTITY_PERSONALITIES[i],dna:generatePlayerDNA(p.id),intensity:.6,roleSuitability:.6,familiarity:.5}])),teams:{blue:{coach,plan,chemistry},red:{coach,plan,chemistry}}};
  const telemetry=[];const sim=new FpsLiveSimulation(cards.slice(0,5),cards.slice(5),seed,identity,{teamLearning,onRoundComplete:r=>telemetry.push(r)});
  for(let i=0;i<steps&&sim.snapshot().phase!=='finished';i++){sim.step();sim.drainAudioCues();}
  return {sim,telemetry};
}

test('a learning team calls plays from its own book, records results and emits only lawful observations',()=>{
  const updates=[];
  const {sim,telemetry}=match(31,{blue:{playbook:{mode:'learn',opponent:'worker:rival',onRound:u=>updates.push(u)}}});
  assert.ok(telemetry.length>=2);
  for(const r of telemetry){assert.ok(r.attackPlayId&&r.defensePlayId&&r.tactic&&r.site);}
  assert.equal(updates.length,telemetry.length,'one update per completed round');
  for(const u of updates){
    assert.equal(u.round.opponent,'worker:rival');
    assert.deepEqual(Object.keys(u.observed.seen).filter(k=>!['opponentAttacked','plantSite','firstBlood','earlyRush','slowDefault','heavyUtility','saved','passiveAnchors'].includes(k)),[]);
  }
  const checkpoint=sim.playbookCheckpoint('blue');
  const trials=[...Object.values(checkpoint.playbook.attack),...Object.values(checkpoint.playbook.defense)].reduce((n,r)=>n+r.trials,0);
  assert.equal(trials,telemetry.length);assert.equal(checkpoint.opponents.opponents['worker:rival'].rounds,telemetry.length);
  assert.equal(sim.playbookCheckpoint('red'),undefined,'a team without a book keeps the archetype choosers');
});

test('a frozen book never changes during a match',()=>{
  const book=createFpsTeamPlaybook('fontessa');
  const {sim,telemetry}=match(32,{red:{playbook:{mode:'frozen',model:book}}},6000);
  assert.ok(telemetry.length>=1);
  assert.deepEqual(sim.playbookCheckpoint('red').playbook,book);
});

test('a book that missed a learned variant adopts it from the round record instead of failing',()=>{
  const book=createFpsTeamPlaybook('fontessa'),copy=structuredClone(book);
  const parent=book.attack['seed:split_b'];
  const variant={...parent.spec,id:'v:test1',name:'Split B · test',midOpenBelow:.7};
  book.attack['v:test1']={spec:variant,status:'candidate',trials:0,wins:0,vs:{},parent:'seed:split_b',generation:1,bornAt:0,statusAt:0};
  applyFpsPlaybookRound(copy,{id:'r1',side:'attack',playId:'v:test1',won:true,variant:{spec:variant,parent:'seed:split_b',generation:1}});
  assert.equal(copy.attack['v:test1'].status,'candidate');assert.equal(copy.attack['v:test1'].trials,1);
  assert.throws(()=>applyFpsPlaybookRound(copy,{id:'r2',side:'attack',playId:'v:other',won:true,variant:{spec:{...variant,id:'v:other',rushBelow:9},generation:1}}),/Unknown play/,'an invalid variant is refused');
  assert.ok(loadFpsTeamPlaybook(JSON.parse(JSON.stringify(copy))));
});

test('fpsCounterPrior adapts defense and attack priors to opponent rush, slow default, utility, and site aggression habits',()=>{
  const rushProfile={rounds:8,attackRounds:6,plants:{A:1,B:4},firstBlood:{A:1,B:4,Mid:0},earlyRush:4,slowDefault:0,heavyUtility:0,saves:0,passiveAnchors:0};
  assert.ok(fpsCounterPrior(rushProfile,'defense',LIVE_SEED_DEFENSE_PLAYS.aggressive_banana)>1.2,'early rush boosts aggressivePair');
  assert.ok(fpsCounterPrior(rushProfile,'defense',LIVE_SEED_DEFENSE_PLAYS.stack_b)>fpsCounterPrior(rushProfile,'defense',LIVE_SEED_DEFENSE_PLAYS.stack_a),'favored rush site is stacked');
  assert.ok(fpsCounterPrior(rushProfile,'defense',LIVE_SEED_DEFENSE_PLAYS.retake_setup)<1,'retake_setup is penalized against heavy rush');

  const slowUtilProfile={rounds:8,attackRounds:6,plants:{A:2,B:2},firstBlood:{A:1,B:1,Mid:1},earlyRush:0,slowDefault:3,heavyUtility:3,saves:0,passiveAnchors:0};
  assert.ok(fpsCounterPrior(slowUtilProfile,'defense',LIVE_SEED_DEFENSE_PLAYS.retake_setup)>1.15,'slow default / heavy utility boosts retake_setup');
  assert.ok(fpsCounterPrior(slowUtilProfile,'defense',LIVE_SEED_DEFENSE_PLAYS.standard)>1.1,'slow default boosts flexMid setups');

  const midCtProfile={rounds:8,attackRounds:2,plants:{A:1,B:1},firstBlood:{A:3,B:0,Mid:3},earlyRush:1,slowDefault:0,heavyUtility:0,saves:0,passiveAnchors:0};
  assert.ok(fpsCounterPrior(midCtProfile,'attack',LIVE_SEED_ATTACK_PLAYS.mid_control)<1,'high Mid CT first bloods penalize naked mid_control');
  assert.ok(fpsCounterPrior(midCtProfile,'attack',LIVE_SEED_ATTACK_PLAYS.split_b)>fpsCounterPrior(midCtProfile,'attack',LIVE_SEED_ATTACK_PLAYS.split_a),'attack biases away from strong CT first-blood site A toward B');
  assert.ok(fpsCounterPrior(midCtProfile,'attack',LIVE_SEED_ATTACK_PLAYS.rush_b)>fpsCounterPrior(midCtProfile,'attack',LIVE_SEED_ATTACK_PLAYS.rush_a),'rush biases toward weaker CT site');
  assert.ok(fpsCounterPrior(midCtProfile,'attack',LIVE_SEED_ATTACK_PLAYS.default_pick)>1.1,'default_pick is boosted to punish CT aggression');
  assert.ok(fpsCounterPrior(midCtProfile,'attack',LIVE_SEED_ATTACK_PLAYS.fake_execute)>1.1,'fake_execute is boosted to punish CT aggression');
});

test('knownFpsDangerSpots scores observed enemy spots by frequency, lethality, sniper, and elevation over a 6-round window',()=>{
  const patterns=[];
  const classify=p=>p.x<0?'A':p.x>20?'B':'Mid';
  // Old sighting at round 1 (outside 6-round window for round 9)
  recordFpsOpponentPattern(patterns,{key:'old',enemyId:'e1',observerId:'o1',source:'sight',x:-15,z:5,observed:10,confidence:0.9,uncertainty:0.2},1,10,classify,false,true);
  // Repeated lethal sniper spot on Mid in rounds 5 and 7
  recordFpsOpponentPattern(patterns,{key:'mid-sniper',enemyId:'e2',observerId:'o1',source:'sight',x:5,z:0,observed:20,confidence:0.95,uncertainty:0.2,weaponHint:'sniper'},5,12,classify,true,true);
  recordFpsOpponentPattern(patterns,{key:'mid-sniper',enemyId:'e2',observerId:'o1',source:'sight',x:5,z:0,observed:30,confidence:0.95,uncertainty:0.2,weaponHint:'sniper'},7,14,classify,true,true);
  // Single non-lethal spot on B in round 6
  recordFpsOpponentPattern(patterns,{key:'b-spot',enemyId:'e3',observerId:'o1',source:'sight',x:30,z:10,observed:25,confidence:0.8,uncertainty:0.3},6,18,classify,false,false);

  const spots=knownFpsDangerSpots(patterns,9,classify);
  assert.equal(spots.length,2,'stale sightings older than 6 rounds are excluded');
  assert.equal(spots[0].area,'Mid','lethal elevated sniper spot ranks highest danger');
  assert.equal(spots[0].lethal,true);
  assert.equal(spots[0].sniper,true);
  assert.equal(spots[0].elevated,true);
  assert.ok(spots[0].danger>spots[1].danger,'Mid lethal sniper danger exceeds single non-lethal B sighting');
});

test('liveTacticWeights and liveDefenseWeights incorporate sniperPriority, informationDemand, tempoControl, and teamProtection',()=>{
  const idx=t=>LIVE_TACTIC_CHOICES.indexOf(t);
  const lowInfo=liveTacticWeights([],'blue',false,undefined,undefined,{informationDemand:10,sniperPriority:10,tempoControl:10});
  const highInfo=liveTacticWeights([],'blue',false,undefined,undefined,{informationDemand:90,sniperPriority:90,tempoControl:90});
  assert.ok(highInfo[idx('default_pick')]>lowInfo[idx('default_pick')],'informationDemand and sniperPriority boost default_pick');
  assert.ok(highInfo[idx('mid_control')]>lowInfo[idx('mid_control')],'informationDemand and sniperPriority boost mid_control');
  assert.ok(highInfo[idx('split_a')]>lowInfo[idx('split_a')],'tempoControl boosts split_a');
  assert.ok(highInfo[idx('fake_execute')]>lowInfo[idx('fake_execute')],'tempoControl boosts fake_execute');

  const defWeight=(weights,setup)=>weights.find(w=>w.setup===setup).weight;
  const lowDef=liveDefenseWeights([],'blue',{A:0,B:0},undefined,undefined,{teamProtection:10,sniperPriority:10,informationDemand:10});
  const highDef=liveDefenseWeights([],'blue',{A:0,B:0},undefined,undefined,{teamProtection:90,sniperPriority:90,informationDemand:90});
  assert.ok(defWeight(highDef,'retake_setup')>defWeight(lowDef,'retake_setup'),'teamProtection boosts retake_setup');
  assert.ok(defWeight(highDef,'standard')>defWeight(lowDef,'standard'),'teamProtection and sniperPriority boost standard');
  assert.ok(defWeight(highDef,'mid_push')>defWeight(lowDef,'mid_push'),'informationDemand boosts mid_push');
  assert.ok(defWeight(highDef,'aggressive_banana')>defWeight(lowDef,'aggressive_banana'),'informationDemand boosts aggressive_banana');
});
