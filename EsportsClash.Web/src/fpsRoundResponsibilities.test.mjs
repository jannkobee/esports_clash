// Round responsibilities (2026-11-17): roster positions stay permanent while round jobs (entry, trade,
// support, lurk, anchor, AWP) are elected for the whole team from lawful team state, identities,
// leadership and coaching, and are handed over when the round changes.
import test from 'node:test';
import assert from 'node:assert/strict';
import {FPS_T_POSITIONS,FPS_CT_POSITIONS,fpsBehaviorPreferences,validateFpsPersonality} from './fps/fpsPlayerArchitecture.ts';
import {assignFpsRoundDuties,scoreFpsDuty} from './fps/fpsRoundResponsibilities.ts';
import {FpsLiveSimulation} from './fps/fpsLiveSimulation.ts';
import {FPS_IDENTITY_PERSONALITIES,generatePlayerDNA,FPS_TENDENCY_CATALOG} from './fps/fpsIdentity.ts';
import {createFpsIdentityContext,assignContextualRoles,assignRecordedRoundDuties} from './fps/fpsIdentityMatch.ts';
import {emptyLiveIntel} from './fps/fpsLiveIntel.ts';

const neutral=()=>.5;
const prefs=(playstyle='BALANCED',mindset='TEAM_FIRST',decisionStyle='ADAPTIVE')=>fpsBehaviorPreferences(validateFpsPersonality({temperament:'STEADY',playstyle,mindset,decisionStyle}));
const attrs=(v=.6)=>({rifling:v,sniping:v,entry:v,utility:v,positioning:v,shotcalling:v});
const tPlayer=(i,extra={})=>({id:`t${i}`,slot:i,position:FPS_T_POSITIONS[i],isIgl:FPS_T_POSITIONS[i]==='T_IGL',hp:100,weapon:'rifle',bomb:false,
  smoke:1,flash:1,incendiary:0,he:0,travel:30,attributes:attrs(),tendency:neutral,preferences:prefs(),...extra});
const ctPlayer=(i,extra={})=>({id:`c${i}`,slot:i,position:FPS_CT_POSITIONS[i],isIgl:FPS_CT_POSITIONS[i]==='CT_IGL',hp:100,weapon:'rifle',bomb:false,
  smoke:1,flash:1,incendiary:0,he:0,home:i<3?'A':'B',attributes:attrs(),tendency:neutral,preferences:prefs(),...extra});
const tContext=(extra={})=>({side:'t',phase:'opening',leader:neutral,leaderIsIgl:true,structure:.5,freedom:.5,...extra});
const byId=result=>Object.fromEntries(result.map(r=>[r.id,r]));
const tendencies=values=>key=>(values[key]??50)/100;

test('a neutral roster keeps its manager-assigned jobs, one holder per job',()=>{
  const team=FPS_T_POSITIONS.map((_,i)=>tPlayer(i)),result=byId(assignFpsRoundDuties(team,tContext()));
  const positionOf=Object.fromEntries(team.map(p=>[p.id,p.position]));
  const jobs=Object.fromEntries(Object.entries(result).map(([id,r])=>[positionOf[id],r.duty]));
  assert.equal(jobs.T_ENTRY,'entry');assert.equal(jobs.T_SUPPORT,'support');assert.equal(jobs.T_LURKER,'lurker');
  assert.equal(Object.values(result).filter(r=>r.duty==='entry').length,1);
  assert.match(result.t1.reason,/roster position/);
});

test('job uniqueness holds for every team size, phase and inventory (no duplicated or abandoned entry)',()=>{
  let seed=7;const rnd=()=>(seed=(seed*16807)%2147483647)/2147483647;
  for(let trial=0;trial<300;trial++){
    const n=1+Math.floor(rnd()*5),phase=['opening','execute','post-plant'][Math.floor(rnd()*3)];
    const team=[...FPS_T_POSITIONS.keys()].sort(()=>rnd()-.5).slice(0,n).map(i=>tPlayer(i,{hp:5+Math.floor(rnd()*95),weapon:rnd()<.15?'sniper':'rifle',
      smoke:rnd()<.5?1:0,flash:Math.floor(rnd()*3),travel:rnd()*60,bomb:false,tendency:k=>(k.length*13%7)/7}));
    if(rnd()<.8)team[Math.floor(rnd()*n)].bomb=true;
    const result=assignFpsRoundDuties(team,tContext({phase}));
    assert.equal(result.length,n);assert.equal(new Set(result.map(r=>r.id)).size,n);
    const count=d=>result.filter(r=>r.duty===d).length;
    assert.equal(count('entry'),phase!=='post-plant'&&n>=2?1:0,`trial ${trial}: entries`);
    assert.ok(count('lurker')<=1&&count('support')<=1);
    const carrier=team.find(p=>p.bomb);
    // With a healthy rifler available, the carrier is not sent into first contact.
    if(carrier&&n>=3&&team.some(p=>p!==carrier&&p.hp>=60&&p.weapon!=='sniper'))assert.notEqual(byId(result)[carrier.id].duty,'entry',`trial ${trial}: carrier on entry`);
    for(const r of result)if(r.duty==='sniper')assert.equal(team.find(p=>p.id===r.id).weapon,'sniper');
    assert.deepEqual(assignFpsRoundDuties(team,tContext({phase})),result,'deterministic');
  }
});

test('first contact goes to the better-placed rifler, not automatically to the entry position',()=>{
  const team=FPS_T_POSITIONS.map((_,i)=>tPlayer(i,{travel:FPS_T_POSITIONS[i]==='T_ENTRY'?52:FPS_T_POSITIONS[i]==='T_FLEX'?8:30}));
  const exploit=tContext({leader:tendencies({spawnExploitation:95,roleFlexibility:85})});
  const result=byId(assignFpsRoundDuties(team,exploit));
  assert.equal(result.t4.duty,'entry','the flex with the far better spawn takes first contact');
  assert.match(result.t4.reason,/best placed/);
  // A rigid structure keeps the rehearsed entry despite the spawn.
  const rigid=byId(assignFpsRoundDuties(team,tContext({structure:.95,leader:tendencies({spawnExploitation:20,roleFlexibility:10,structuredCalling:95})})));
  assert.equal(rigid.t1.duty,'entry');
});

test('a hurt entry hands first contact over and plays behind; an AWP holder takes the AWP job',()=>{
  const hurt=byId(assignFpsRoundDuties(FPS_T_POSITIONS.map((_,i)=>tPlayer(i,i===1?{hp:22,current:'entry'}:{})),tContext()));
  assert.notEqual(hurt.t1.duty,'entry');assert.match(hurt.t1.reason,/Hurt/);
  const awp=byId(assignFpsRoundDuties(FPS_T_POSITIONS.map((_,i)=>tPlayer(i,i===1?{weapon:'sniper'}:{})),tContext()));
  assert.equal(awp.t1.duty,'sniper');
  assert.equal(Object.values(awp).filter(r=>r.duty==='entry').length,1,'somebody else takes first contact');
});

test('utility support follows the grenades: an aggressive rifler carrying them still supports',()=>{
  const team=FPS_T_POSITIONS.map((_,i)=>tPlayer(i,FPS_T_POSITIONS[i]==='T_SUPPORT'?{smoke:0,flash:0}:FPS_T_POSITIONS[i]==='T_FLEX'?{smoke:1,flash:2,incendiary:1,preferences:prefs('AGGRESSIVE','INDIVIDUALIST','INSTINCTIVE')}:{smoke:0,flash:0}));
  const result=byId(assignFpsRoundDuties(team,tContext()));
  assert.equal(result.t4.duty,'support');assert.match(result.t4.reason,/carries the utility/);
});

test('IGL identities lead the same roster differently',()=>{
  const preset=id=>FPS_TENDENCY_CATALOG.iglPresets.find(p=>p.id===id).values;
  // The entry is dead: who takes first contact?
  const team=FPS_T_POSITIONS.map((_,i)=>tPlayer(i)).filter(p=>p.position!=='T_ENTRY');
  const igl=team.find(p=>p.isIgl);
  const fragging=byId(assignFpsRoundDuties(team.map(p=>p===igl?{...p,tendency:tendencies(preset('fragging_playmaker'))}:p),tContext({leader:tendencies(preset('fragging_playmaker'))})));
  const tactical=byId(assignFpsRoundDuties(team.map(p=>p===igl?{...p,tendency:tendencies(preset('tactical_architect'))}:p),tContext({leader:tendencies(preset('tactical_architect'))})));
  assert.equal(fragging[igl.id].duty,'entry','a fragging IGL leads from the front');
  assert.notEqual(tactical[igl.id].duty,'entry','a tactical IGL keeps himself off first contact');
  // Player-centric callers protect their star from utility dumps (star = strongest rifler).
  const starTeam=FPS_T_POSITIONS.map((_,i)=>tPlayer(i,FPS_T_POSITIONS[i]==='T_SUPPORT'?{attributes:{...attrs(),rifling:.95,entry:.9}}:{}));
  const facilitator=byId(assignFpsRoundDuties(starTeam,tContext({leader:tendencies(preset('player_centric_facilitator'))})));
  assert.notEqual(facilitator.t2.duty,'support','the star support player is freed to frag');
  const structured=byId(assignFpsRoundDuties(starTeam,tContext({leader:tendencies(preset('tactical_architect'))})));
  assert.equal(structured.t2.duty,'support','a structured caller keeps the rehearsed support');
});

test('identical attributes with different personalities take different jobs; attributes never gate a job',()=>{
  const team=FPS_T_POSITIONS.map((_,i)=>tPlayer(i)).filter(p=>p.position!=='T_ENTRY');
  const flex=team.find(p=>p.position==='T_FLEX'),igl=team.find(p=>p.isIgl);
  const aggressive=tendencies({sacrificialEntry:85,spaceCreation:85,duelInitiative:85,earlyAggression:85});
  const passive=tendencies({sacrificialEntry:15,spaceCreation:15,duelInitiative:15,earlyAggression:15,tradePriority:85,teammateCover:85});
  const a=byId(assignFpsRoundDuties(team.map(p=>p===flex?{...p,tendency:aggressive,preferences:prefs('AGGRESSIVE','INDIVIDUALIST','INSTINCTIVE')}:p===igl?{...p,tendency:passive,preferences:prefs('PASSIVE')}:p),tContext()));
  const b=byId(assignFpsRoundDuties(team.map(p=>p===flex?{...p,tendency:passive,preferences:prefs('PASSIVE')}:p===igl?{...p,tendency:aggressive,preferences:prefs('AGGRESSIVE','INDIVIDUALIST','INSTINCTIVE')}:p),tContext()));
  assert.equal(a[flex.id].duty,'entry');assert.notEqual(b[flex.id].duty,'entry');
  // A weak entry attribute does not forbid entry: without a caller, attributes are not read at all.
  const low=team.map(p=>p===flex?{...p,attributes:attrs(.05),tendency:aggressive,preferences:prefs('AGGRESSIVE','INDIVIDUALIST','INSTINCTIVE')}:p);
  const noCaller=byId(assignFpsRoundDuties(low,tContext({leader:undefined})));
  assert.equal(noCaller[flex.id].duty,'entry');
  assert.deepEqual(assignFpsRoundDuties(low,tContext({leader:undefined})),assignFpsRoundDuties(team.map(p=>p===flex?{...low.find(x=>x.id===flex.id),attributes:attrs(.95)}:p),tContext({leader:undefined})));
});

test('coaching shifts how firmly positions hold without erasing a creative player',()=>{
  const team=FPS_T_POSITIONS.map((_,i)=>tPlayer(i,FPS_T_POSITIONS[i]==='T_FLEX'?{travel:14,tendency:tendencies({sacrificialEntry:90,spaceCreation:90,duelInitiative:90,earlyAggression:90}),preferences:prefs('AGGRESSIVE','INDIVIDUALIST','INSTINCTIVE')}:FPS_T_POSITIONS[i]==='T_ENTRY'?{travel:30}:{}));
  const structured=byId(assignFpsRoundDuties(team,tContext({structure:.95,freedom:.05})));
  const free=byId(assignFpsRoundDuties(team,tContext({structure:.05,freedom:.95})));
  assert.equal(structured.t1.duty,'entry');assert.equal(free.t4.duty,'entry');
  const flexEntry=(structure,freedom)=>scoreFpsDuty(team[4],'entry',team,tContext({structure,freedom}));
  assert.ok(flexEntry(.95,.05).self>0,'his own preference still counts under a rigid coach');
});

test('CT anchors are re-elected per site and an emptied site borrows a defender',()=>{
  const team=FPS_CT_POSITIONS.map((_,i)=>ctPlayer(i));
  const all=byId(assignFpsRoundDuties(team,{side:'ct',phase:'opening',leader:neutral,leaderIsIgl:true,structure:.5,freedom:.5}));
  assert.equal(all.c2.duty,'anchor');assert.equal(all.c3.duty,'anchor');
  // The A anchor dies: the remaining A defender anchors A.
  const noA=byId(assignFpsRoundDuties(team.filter(p=>p.position!=='CT_ANCHOR_A'),{side:'ct',phase:'opening',leader:neutral,structure:.5,freedom:.5}));
  assert.equal(Object.values(noA).filter(r=>r.duty==='anchor').length,2);
  // Every A defender is gone: one B defender covers A.
  const onlyB=team.map(p=>({...p,home:p.position==='CT_ANCHOR_A'?'A':'B'})).filter(p=>p.home==='B');
  const moved=assignFpsRoundDuties(onlyB,{side:'ct',phase:'opening',leader:neutral,structure:.5,freedom:.5}).find(r=>r.home==='A');
  assert.ok(moved&&moved.duty==='anchor'&&/Covers A/.test(moved.reason));
  // Retakes have no anchors.
  assert.ok(assignFpsRoundDuties(team,{side:'ct',phase:'retake',leader:neutral,structure:.5,freedom:.5}).every(r=>r.duty!=='anchor'));
});

const plan={tempo:.6,structure:.7,aggression:.5,preparation:.7,freedom:.5,economy:.8};
const coach={...plan,rigidity:.7,communication:.7,leadership:.7,adaptability:.7,development:.5};
const chemistry={trust:.6,communication:.6,understanding:.6,leadershipAcceptance:.6,roleCompetition:.3};
const cards=Array.from({length:10},(_,i)=>({id:`duty-${i}`,name:`Player ${i}`,stats:{rifling:80,positioning:80,entry:80,sniping:80,utility:80,shotcalling:80}}));
const identity={players:Object.fromEntries(cards.map((p,i)=>[p.id,{id:p.id,assignments:{t:FPS_T_POSITIONS[i%5],ct:FPS_CT_POSITIONS[i%5]},personality:FPS_IDENTITY_PERSONALITIES[i],dna:generatePlayerDNA(p.id),intensity:.6,roleSuitability:.6,familiarity:.5}])),teams:{blue:{coach,plan,chemistry},red:{coach,plan,chemistry}}};
const game=(options={})=>new FpsLiveSimulation(cards.slice(0,5),cards.slice(5),1337,identity,{mapId:'fontessa',...options});
const live=sim=>{for(let i=0;i<900&&sim.phase!=='live';i++)sim.step();assert.equal(sim.phase,'live');};

test('live rounds start with one job per player, a protected carrier, and the jobs are broadcast',()=>{
  const sim=game();live(sim);
  for(const team of ['blue','red']){
    const squad=sim.actors.filter(a=>a.team===team),jobs=squad.map(a=>sim.duty(a));
    if(squad[0].attacking){assert.equal(jobs.filter(j=>j==='entry').length,1);const carrier=squad.find(a=>a.bomb);assert.ok(carrier);assert.notEqual(sim.duty(carrier),'entry');}
    else assert.ok(jobs.filter(j=>j==='anchor').length>=1);
  }
  const snap=sim.snapshot();
  for(const p of snap.players){assert.ok(p.duty,`${p.name} has a round job`);assert.ok(p.dutyReason);assert.ok(['caller','entry','support','lurker','trade','anchor','sniper'].includes(p.role));}
});

test('an eliminated entry is replaced through a communicated handover, not instantly',()=>{
  const sim=game();live(sim);
  const attackers=sim.actors.filter(a=>a.attacking),entry=attackers.find(a=>sim.duty(a)==='entry');
  const killer=sim.actors.find(a=>!a.attacking);
  sim.damage(killer,entry,500,true,'ak47',true);
  assert.ok(entry.hp<=0);
  sim.step();
  const pending=attackers.filter(a=>a.hp>0&&a.roundDuty?.pending?.duty==='entry');
  assert.equal(pending.length,1,'exactly one teammate is called to take first contact');
  assert.ok(!attackers.some(a=>a.hp>0&&sim.duty(a)==='entry'),'the handover is not instant');
  for(let i=0;i<90;i++)sim.step();
  const next=attackers.filter(a=>a.hp>0&&sim.duty(a)==='entry');
  assert.equal(next.length,1);
  assert.match(next[0].roundDuty.reason,new RegExp(`${entry.name} down`));
});

test('any well-placed teammate with a flash supports the entry when the support player cannot',()=>{
  const sim=game();live(sim);
  const attackers=sim.actors.filter(a=>a.attacking),entry=attackers.find(a=>sim.duty(a)==='entry');
  const support=attackers.find(a=>sim.duty(a)==='support'),rifler=attackers.find(a=>a!==entry&&a!==support&&sim.duty(a)==='trade');
  Object.assign(entry,{x:19,z:-4});Object.assign(rifler,{x:19,z:-9,flash:1,bomb:false,hp:100});
  if(support)Object.assign(support,{x:-25,z:-30});
  assert.equal(sim.supportFlasher(entry,attackers.filter(a=>a.hp>0)),rifler);
  const ablation=game({diagnostics:{staticRoles:true}});live(ablation);
  const e2=ablation.actors.find(a=>a.attacking&&a.role==='entry'),r2=ablation.actors.find(a=>a.attacking&&a.role==='trade');
  Object.assign(e2,{x:19,z:-4});Object.assign(r2,{x:19,z:-9,flash:1});
  for(const a of ablation.actors)if(a.attacking&&a.role==='support')Object.assign(a,{x:-25,z:-30});
  assert.equal(ablation.supportFlasher(e2,ablation.actors.filter(a=>a.attacking)),undefined,'static roles: only the support role flashed for the entry');
});

test('an outnumbered anchor falls back to play the retake, but never while he sees an enemy',()=>{
  const sim=game();live(sim);
  const defenders=sim.actors.filter(a=>!a.attacking);
  const anchor=defenders.find(a=>sim.duty(a)==='anchor'),home=sim.defenseHome(anchor),site=sim.map.definition.sites[home];
  for(const a of defenders)if(a!==anchor)Object.assign(a,{x:a.x+(home==='A'?60:-60),hp:100});
  Object.assign(anchor,{x:site.x,z:site.z,hp:100,target:undefined});
  const enemies=sim.actors.filter(a=>a.attacking).slice(0,3);
  const beliefs=enemies.map((e,i)=>({x:site.x+2+i,z:site.z+4,enemyId:e.id,certainty:.8,age:.5,source:'sight'}));
  const persistent={...anchor,tendencies:{...anchor.tendencies,anchorPersistence:100,retreatTiming:0}};
  const fallback=sim.anchorFallback(anchor,defenders,beliefs);
  assert.ok(fallback,'three on site against one: fall back');
  assert.ok(sim.map.definition.tactical[home].retakeStaging.some(p=>p.x===fallback.point.x&&p.z===fallback.point.z));
  anchor.tacticalChoice=undefined;anchor.target=enemies[0].id;
  assert.equal(sim.anchorFallback(anchor,defenders,beliefs),undefined,'a visible duel is taken, not abandoned');
  anchor.target=undefined;
  assert.equal(sim.anchorFallback(anchor,defenders,beliefs.slice(0,1)),undefined,'one attacker is held, not run from');
  void persistent;
});

test('the recorded engine elects the same kind of round jobs from the shared allocator',()=>{
  const blue=cards.slice(0,5).map(c=>({...c,fpsIdentity:{personality:identity.players[c.id].personality,assignments:identity.players[c.id].assignments}}));
  const red=cards.slice(5).map(c=>({...c,fpsIdentity:{personality:identity.players[c.id].personality,assignments:identity.players[c.id].assignments}}));
  const context=createFpsIdentityContext(blue,red);
  const players=blue.map((card,i)=>({playerId:card.id,name:card.name,card,team:'blue',side:'attackers',hp:100,isAlive:true,cash:4000,
    loadout:{primaryWeapon:'rifle_assault',secondaryWeapon:'sidearm_standard',armor:100,hasHelmet:true,hasDefuseKit:false,hasBomb:i===0,utilities:i===1?['utility_smoke','utility_flash']:[]},currentZone:'spawn',kills:0,deaths:0}));
  assignContextualRoles(players,context);assignRecordedRoundDuties(players,context);
  const jobs=players.map(p=>p.tactics.duty);
  assert.equal(jobs.filter(j=>j==='entry').length,1);
  assert.notEqual(players[0].tactics.duty,'entry','the carrier stays off first contact');
  assert.ok(players.every(p=>p.tactics.dutyReason));
  assert.equal(players.find(p=>p.tactics.position==='T_LURKER').tactics.duty,'lurker');
});

test('the static-role ablation keeps the roster role as the round job',()=>{
  const sim=game({diagnostics:{staticRoles:true}});live(sim);
  for(const a of sim.actors)assert.equal(sim.duty(a),a.role==='caller'?'trade':a.role);
  assert.ok(sim.actors.every(a=>a.roundDuty===undefined));
});

test('an isolated bomb carrier gets one escort from his traders',()=>{
  const sim=game();live(sim);
  const attackers=sim.actors.filter(a=>a.attacking),carrier=attackers.find(a=>a.bomb);
  for(const a of attackers)if(a!==carrier)Object.assign(a,{x:carrier.x+20+a.slot,z:carrier.z,intel:emptyLiveIntel()});
  sim.refreshRoundDuties(carrier.team);
  const escorts=attackers.filter(a=>a.escortId===carrier.id);
  assert.equal(escorts.length,1);assert.equal(sim.duty(escorts[0]),'trade');
});

test('a round after a planted round still elects an entry and keeps the device off him',()=>{
  const sim=game();live(sim);
  sim.bomb={...sim.bomb,status:'planted'};sim.round++;sim.startRound();
  const attackers=sim.actors.filter(a=>a.attacking),entries=attackers.filter(a=>sim.duty(a)==='entry');
  assert.equal(entries.length,1,'freeze time is an opening, whatever last round\'s device did');
  assert.ok(!entries[0].bomb,'the carrier is not the entry');
});

test('jobs dissolved by the plant or the retake say so in their reason',()=>{
  const t=byId(assignFpsRoundDuties(FPS_T_POSITIONS.map((_,i)=>tPlayer(i)),tContext({phase:'post-plant'})));
  assert.match(t.t1.reason,/^Post-plant/);
  const ct=assignFpsRoundDuties(FPS_CT_POSITIONS.map((_,i)=>ctPlayer(i)),{side:'ct',phase:'retake',leader:neutral,structure:.5,freedom:.5});
  assert.ok(ct.filter(r=>r.duty==='trade').every(r=>/^Retake/.test(r.reason)));
});
