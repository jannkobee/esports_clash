import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {createBaselineSimulation,auditBaselineSnapshot,baselineIdentity,baselineGamePlan} from './testSupport/fpsBaselineFixtures.mjs';
import {baselineTacticalContracts} from './testSupport/fpsBaselineTacticalContracts.mjs';
import {baselineObjectiveContracts} from './testSupport/fpsBaselineObjectiveContracts.mjs';
import {LIVE_FPS_STEP} from './fps/fpsLiveSimulation.ts';
import {FpsFixedStepClock} from './fps/fpsSpatialWorld.ts';
import {createDirectorState,evaluateBroadcastDirector} from './fps/fpsBroadcastDirector.ts';
import {buyLiveTeam,liveUtilityCount} from './fps/fpsLiveEconomy.ts';
import {LIVE_WEAPONS,LIVE_WEAPON_TIERS,canBuyLiveWeapon} from './fps/fpsLiveWeapons.ts';

// Extend these registries as mechanics grow. Arsenal matrices discover new guns.
// Expected replay digests come from a semantic twin, never a frozen source hash.
const steps=Number(process.env.FPS_BASELINE_STEPS??1800);
const seeds=(process.env.FPS_BASELINE_SEEDS??'17,42').split(',').map(Number);
assert.ok(Number.isInteger(steps)&&steps>=1800,'Baseline replay cannot fall below 1,800 ticks');
assert.ok(seeds.length>=2&&new Set(seeds).size===seeds.length&&seeds.every(n=>Number.isInteger(n)&&n>0&&n<=2147483647),'At least two distinct positive seeds are required');
const digest=value=>createHash('sha256').update(JSON.stringify(value)).digest('hex');

const coreContracts=[
  {name:'economy / catalog-wide purchases conserve wallets, gifts and inventory',run(){
    const roles=['entry','trade','sniper','anchor','lurker','support','caller'];
    let cases=0,gifts=0;const modes=new Set(),weapons=new Set();
    for(const attacking of [false,true])for(const held of Object.keys(LIVE_WEAPONS))for(const bank of [800,1400,2050,2700,2850,3350,4500,7000,10000])for(const range of [9,16,28]){
      const category=LIVE_WEAPONS[held].category,offset=cases%roles.length,starter=attacking?'glock':'usp_s';
      const input=Array.from({length:5},(_,i)=>({id:`matrix-${i}`,role:roles[(i+offset)%roles.length],cash:i===0?bank:Math.min(10000,bank+(i%2)*500),
        attacking,weapon:i===0?held:starter,sidearm:starter,armor:cases%2?100:0,kit:false,flash:0,smoke:0,he:0,incendiary:0,
        expectedRange:range,holdChoke:i===0&&range<=16,preferSniper:roles[(i+offset)%roles.length]==='sniper',
        ammo:i===0?Math.floor(LIVE_WEAPONS[held].magazine/2):LIVE_WEAPONS[starter].magazine,reserve:LIVE_WEAPONS[i===0?held:starter].reserve}));
      const original=structuredClone(input),plan={...baselineGamePlan,aggression:cases%2?.75:.3,economy:cases%3?.8:.3};
      const args=[plan,bank===800&&category==='pistol'?1:5,cases%4,bank===2050||bank===2850];
      const result=buyLiveTeam(input,...args),label=`${attacking?'T':'CT'}/${held}/${bank}/${range}`;
      assert.deepEqual(result,buyLiveTeam(structuredClone(input),...args),`${label}: nondeterministic purchase`);
      assert.deepEqual(input,original,`${label}: mutated buy inputs`);
      assert.equal(result.spent,original.reduce((n,p)=>n+p.cash,0)-result.players.reduce((n,p)=>n+p.cash,0),`${label}: wallets do not balance`);
      assert.equal(result.players.length,input.length);modes.add(result.mode);
      for(const p of result.players){
        const before=original.find(a=>a.id===p.id);assert.ok(before,`${label}: invented recipient`);
        assert.ok(Number.isInteger(p.cash)&&p.cash>=0&&p.cash<=before.cash,`${label}/${p.id}: illegal wallet`);
        assert.ok(Object.hasOwn(LIVE_WEAPONS,p.weapon));weapons.add(p.weapon);
        if(p.weapon!==before.weapon)assert.ok(canBuyLiveWeapon(p.weapon,attacking),`${label}: bought enemy-only gun`);
        if(LIVE_WEAPONS[before.weapon].category==='pistol'&&LIVE_WEAPONS[p.weapon].category==='pistol')assert.ok(LIVE_WEAPON_TIERS[p.weapon]>=LIVE_WEAPON_TIERS[before.weapon],`${label}: paid pistol downgrade`);
        assert.ok(liveUtilityCount(p)<=4&&p.flash<=2&&p.smoke<=1&&p.he<=1&&p.incendiary<=1,`${label}: grenade limit`);
        assert.equal(p.attacking,before.attacking);assert.equal(p.role,before.role);
        for(const kind of p.utilityStock??[])assert.ok(['flash','smoke','he','incendiary'].includes(kind));
      }
      for(const gift of result.gifts){
        assert.notEqual(gift.from,gift.to);assert.ok(input.some(p=>p.id===gift.from));
        const receiver=result.players.find(p=>p.id===gift.to);
        assert.equal(receiver?.giftFrom,gift.from,`${label}: lost gift reservation`);
        assert.equal(receiver.weapon,gift.weapon,`${label}: silently replaced paid gift`);gifts++;
      }
      cases++;
    }
    assert.ok(cases>=800&&gifts>0&&weapons.size>=15,'Economy matrix lost meaningful coverage');
    assert.deepEqual([...modes].sort(),['eco','force','full','half','pistol']);
    return {cases,gifts,weapons:weapons.size,modes:[...modes].sort()};
  }},
  {name:'public state / corruption is rejected and fixtures remain isolated',run(){
    const sim=createBaselineSimulation(),twin=createBaselineSimulation(),frame=sim.snapshot(),saved=structuredClone(frame);
    assert.equal(auditBaselineSnapshot(frame),true);assert.deepEqual(frame,saved);
    sim.identity.players[frame.players[0].id].assignments.t='changed-in-one-fixture';
    assert.deepEqual(twin.snapshot(),saved,'Fixtures share mutable identities');
    assert.notEqual(baselineIdentity.players[frame.players[0].id].assignments.t,'changed-in-one-fixture');
    const corruptions=[f=>f.players[0].hp=101,f=>f.players[0].cash=-1,f=>f.players[0].ammo=999,f=>f.players[0].smoke=2,
      f=>f.players[0].x=35,f=>f.players[0].yaw=NaN,f=>f.players[0].id=f.players[1].id,f=>f.players[0].position=f.players[1].position,
      f=>f.players[0].meleeWeapon=undefined,f=>f.players[0].secondaryWeapon='sniper',f=>f.players[0].dna={secret:1},
      f=>f.players[0].intel={contacts:[]},f=>f.players[0].hiddenIntel={contacts:[]},f=>f.bomb.status='planted'];
    for(const [i,corrupt] of corruptions.entries()){
      const bad=structuredClone(saved);corrupt(bad);assert.throws(()=>auditBaselineSnapshot(bad),undefined,`Accepted corruption ${i}`);
    }
    return {rejectedCorruptions:corruptions.length};
  }},
  {name:'snapshots / nested copies cannot mutate authoritative gameplay',run(){
    const a=createBaselineSimulation(),b=createBaselineSimulation();
    const arrange=sim=>{
      const p=sim.actors[0];
      p.behavior.metrics.engagement={opportunities:1,attempts:1};
      p.utilityPreparation={kind:'smoke',target:{x:-19,z:7},startedAt:0,equipAt:.68,readyAt:1.2,throwStyle:'standard',launchYaw:0,launchPitch:.3};
      sim.shots=[{id:7001,time:0,actorId:p.id,weapon:p.weapon,from:{x:p.x,z:p.z},to:{x:-19,z:7},fromY:1.6,toY:1.3,team:p.team}];
      sim.corpses=[{id:7002,playerId:p.id,attacking:p.attacking,at:0,x:p.x,z:p.z,y:0,yaw:0,vx:0,vz:0,crouch:false,
        impact:{region:'torso',point:{x:p.x,y:1,z:p.z},direction:{x:0,y:0,z:1},strength:1}}];
      sim.droppedWeapons=[{id:7003,weapon:'mp9',ammo:30,reserve:120,x:p.x,z:p.z,from:{x:p.x,z:p.z}}];
    };
    arrange(a);arrange(b);const exported=a.snapshot(),untouched=b.snapshot();assert.deepEqual(exported,untouched);
    const p=exported.players[0];p.skills.mechanics=-999;p.impact.damage=-999;p.personalityDimensions.playstyle='corrupt';
    p.behavior.metrics[Object.keys(p.behavior.metrics)[0]].opportunities=999999;
    p.utilityPrep.target.x=999;exported.shots[0].from.x=999;exported.shots[0].to.z=999;
    exported.corpses[0].impact.point.x=999;exported.corpses[0].impact.direction.z=999;
    exported.droppedWeapons[0].from.x=999;exported.teams.blue.forces.allies=-1;exported.bomb.x=999;
    assert.deepEqual(a.snapshot(),untouched,'Nested public mutation reached live state');
    a.step();b.step();assert.deepEqual(a.snapshot(),b.snapshot(),'Public mutation changed the following tick');
    return {nestedDomains:12};
  }},
  {name:'replay / every tick is audited and independent of observers or display cadence',run(){
    const expected=new Map();let auditedTicks=0;
    for(const seed of seeds){
      const a=createBaselineSimulation(seed),b=createBaselineSimulation(seed),state=createDirectorState(),frames=[];
      let previous,retained;const events=new Set();
      for(let tick=0;tick<steps;tick++){
        a.step();b.step();const frame=a.snapshot(),mirror=b.snapshot(),label=`seed ${seed} tick ${tick}`;
        assert.equal(auditBaselineSnapshot(frame,previous,{label}),true);auditedTicks++;
        if(previous&&previous.phase!=='finished')assert.ok(Math.abs(frame.time-previous.time-LIVE_FPS_STEP)<1e-9,`${label}: changed fixed step`);
        assert.deepEqual(frame,mirror,`${label}: observer activity altered decisions`);
        assert.ok(Array.isArray(a.drainAudioCues()));assert.deepEqual(a.drainAudioCues(),[],'Audio drain is not idempotent');
        evaluateBroadcastDirector(frame,state,'director',frame.players[0].id);
        assert.deepEqual(frame,a.snapshot(),`${label}: presentation mutated gameplay`);
        if(tick%300===0){if(retained)assert.deepEqual(retained.frame,retained.copy,'Later ticks mutated retained snapshot');retained={frame,copy:structuredClone(frame)};}
        for(const event of frame.events)events.add(event.kind);frames.push(digest(frame));previous=frame;
      }
      assert.ok(previous.time>45&&events.has('economy')&&events.has('round'),'Replay did not exercise paid buying and live play');
      assert.deepEqual(retained.frame,retained.copy);expected.set(seed,{frames,final:previous});
    }
    let backlogFrames=0,scheduledTicks=0;
    for(const seed of seeds){
      const sim=createBaselineSimulation(seed),clock=new FpsFixedStepClock(LIVE_FPS_STEP),reference=expected.get(seed);let tick=0,fed=0;
      const advance=()=>{sim.step();assert.equal(digest(sim.snapshot()),reference.frames[tick],`seed ${seed} scheduled tick ${tick}: frame pacing changed gameplay`);tick++;scheduledTicks++;};
      const chunks=[1,7,2,13,4,9];
      for(let frame=0;fed<steps;frame++){
        const amount=Math.min(chunks[frame%chunks.length],steps-fed);fed+=amount;
        clock.advance(amount*LIVE_FPS_STEP,advance,3,()=>false);if(clock.pendingSeconds>=LIVE_FPS_STEP)backlogFrames++;
      }
      let flushes=0;while(tick<steps){const before=tick;clock.advance(0,advance,17);assert.ok(tick>before,'Backlog stopped progressing');assert.ok(++flushes<=steps);}
      assert.equal(tick,steps);assert.ok(clock.pendingSeconds<1e-8);assert.deepEqual(sim.snapshot(),reference.final);
    }
    assert.ok(backlogFrames>10);return {seeds,stepsPerSeed:steps,auditedTicks,scheduledTicks,backlogFrames};
  }},
];

const contracts=[...coreContracts,...baselineTacticalContracts,...baselineObjectiveContracts];
assert.equal(new Set(contracts.map(c=>c.name)).size,contracts.length,'Use unique baseline contract names');
for(const contract of contracts)test(`STRICT BASELINE / ${contract.name}`,async t=>{
  const coverage=await contract.run();if(coverage)t.diagnostic(JSON.stringify(coverage));
});
