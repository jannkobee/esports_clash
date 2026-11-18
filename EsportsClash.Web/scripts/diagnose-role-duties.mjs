// Round-responsibility diagnostics over seeded matches: who takes which job, how jobs move during the
// round, entry/trade timing, who flashes for the entry, anchor fallbacks, escorts and side results.
// Usage: node scripts/diagnose-role-duties.mjs --map=fontessa --seeds=11,22 --steps=15000
//   [--igl=tactical_architect|fragging_playmaker|adaptive_mastermind|player_centric_facilitator] (both IGLs)
//   [--coach=structured|free] [--static] [--json]   (--static = ablation: roster role is the round job)
import {FPS_T_POSITIONS,FPS_CT_POSITIONS} from '../src/fps/fpsPlayerArchitecture.ts';
import {FpsLiveSimulation} from '../src/fps/fpsLiveSimulation.ts';
import {FPS_IDENTITY_PERSONALITIES,generatePlayerDNA,FPS_TENDENCY_CATALOG} from '../src/fps/fpsIdentity.ts';
import {generateFpsSkillProfile} from '../src/fps/fpsSkillProfile.ts';
import {liveIntelBeliefs,liveIntelArea} from '../src/fps/fpsLiveIntel.ts';
const arg=(k,f)=>process.argv.find(v=>v.startsWith(`--${k}=`))?.split('=')[1]??f;
const mapId=arg('map','fontessa'),seeds=arg('seeds','11').split(',').map(Number),steps=Number(arg('steps','15000'));
const iglPreset=arg('igl',''),coachMode=arg('coach',''),staticRoles=process.argv.includes('--static');
const plan={tempo:.6,structure:coachMode==='structured'?.92:coachMode==='free'?.2:.7,aggression:.5,preparation:.7,freedom:coachMode==='free'?.92:coachMode==='structured'?.15:.5,economy:.8};
const coach={...plan,rigidity:coachMode==='structured'?.92:coachMode==='free'?.15:.7,communication:.7,leadership:.7,adaptability:.7,development:.5};
const chemistry={trust:.6,communication:.6,understanding:.6,leadershipAcceptance:.6,roleCompetition:.3};
const preset=iglPreset?FPS_TENDENCY_CATALOG.iglPresets.find(p=>p.id===iglPreset)?.values:undefined;
if(iglPreset&&!preset)throw Error('Unknown IGL preset '+iglPreset);
const r={rounds:0,wins:{T:0,CT:0},liveEntryByPosition:{},executeEntryByPosition:{},iglDuty:{},handovers:{},handoverReasons:{},
  duplicateEntries:0,entryDeaths:0,entryTraded:0,entryDeathAllyGap:[],entryFlashBy:{},fightFlashBy:{},fallbacks:0,fallbackSurvived10s:0,
  escorts:0,measuredRotations:0,firmRotations:0,hesitations:0,verifyHolds:0,contactHolds:0,noiseVerifies:0,laneHeldCalls:0,holdOutcome:{held:0,called:0,both:0,neither:0},tradeSwings:0,lurkerTookEntry:0,coverageMoves:0,awpDuty:0,dutySeconds:{T:{},CT:{}},firstKillInvolvesEntry:0,firstKills:0};
const inc=(o,k,n=1)=>{o[k]=(o[k]??0)+n;};
for(const seed of seeds){
  const cards=Array.from({length:10},(_,i)=>({id:`rd-${seed}-${i}`,name:`Operative ${i}`,stats:{rifling:70,sniping:70,entry:70,utility:70,positioning:70,shotcalling:70}}));
  const identity={players:Object.fromEntries(cards.map((p,i)=>{
    const assignments={t:FPS_T_POSITIONS[i%5],ct:FPS_CT_POSITIONS[i%5]};
    const igl=assignments.t==='T_IGL'||assignments.ct==='CT_IGL';
    return [p.id,{id:p.id,assignments,personality:FPS_IDENTITY_PERSONALITIES[(i*7+seed)%FPS_IDENTITY_PERSONALITIES.length],dna:generatePlayerDNA(p.id),
      roleSuitability:.6,familiarity:.5,...(igl&&preset?{tendencyOverrides:preset}:{})}];
  })),teams:{blue:{coach,plan,chemistry},red:{coach,plan,chemistry}}};
  const profiles=Object.fromEntries(cards.map(p=>[p.id,generateFpsSkillProfile(p.id,seed,'2026-11-16T00:00:00.000Z')]));
  const sim=new FpsLiveSimulation(cards.slice(0,5),cards.slice(5),seed,identity,{mapId,skillProfiles:profiles,diagnostics:staticRoles?{staticRoles:true}:undefined,onRoundComplete:x=>{r.rounds++;inc(r.wins,x.winner===x.attackTeam?'T':'CT');}});
  let lastEvent=0,execSeen=false,firstKill=false;const prevDuty=new Map(),fallbackAt=new Map(),pendingTrades=[],holdWatch=[];
  for(let i=0;i<steps;i++){
    const before=sim.phase;sim.step();sim.drainAudioCues();
    if(sim.phase==='finished')break;
    if(before!=='live'&&sim.phase==='live'){
      execSeen=false;firstKill=false;prevDuty.clear();fallbackAt.clear();
      for(const p of sim.actors.filter(a=>a.attacking&&sim.duty(a)==='entry'))inc(r.liveEntryByPosition,p.position);
      for(const p of sim.actors)if(p.role==='caller')inc(r.iglDuty,`${p.attacking?'T':'CT'}:${sim.duty(p)}`);
    }
    if(sim.phase!=='live')continue;
    const order=sim.informationOrders[sim.attackTeam];
    if(!execSeen&&order.mode==='execute'){execSeen=true;const e=sim.actors.find(a=>a.id===order.entryId);if(e)inc(r.executeEntryByPosition,e.position);}
    for(const team of ['blue','red']){const entries=sim.actors.filter(a=>a.team===team&&a.hp>0&&a.attacking&&sim.duty(a)==='entry');if(entries.length>1)r.duplicateEntries++;}
    for(const p of sim.actors){
      if(p.hp<=0)continue;
      // Rotation holds: did a CT later (lawfully) sight attackers on the held site or the called site within 10 s?
      const hold=/^Confirm the ([AB]) call before leaving ([AB])/.exec(p.intent)??/^Own contact at ([AB])/.exec(p.intent);
      if(/^Confirm the [AB] call/.test(p.intent)&&!/^Confirm/.test(p._lastIntent??''))r.verifyHolds++;
      if(/^Own contact at/.test(p.intent)&&!/^Own contact/.test(p._lastIntent??''))r.contactHolds++;
      if(hold&&!/^(Confirm|Own contact)/.test(p._lastIntent??'')){
        const called=sim.informationOrders[p.team].site,held=hold.length===3?hold[2]:hold[1];
        if(called&&called!==held)holdWatch.push({at:sim.time,team:p.team,held,called,seenHeld:false,seenCalled:false});
      }
      p._lastIntent=p.intent;
      const d=sim.duty(p),prev=prevDuty.get(p.id);
      inc(r.dutySeconds[p.attacking?'T':'CT'],`${p.position}:${d}`,1/30);
      if(prev&&prev!==d){inc(r.handovers,`${p.attacking?'T':'CT'} ${prev}->${d}`);inc(r.handoverReasons,(p.roundDuty?.reason??'?').replace(/Operative \d/,'X'));
        if(p.position==='T_LURKER'&&d==='entry')r.lurkerTookEntry++;if(d==='sniper')r.awpDuty++;}
      prevDuty.set(p.id,d);
    }
    for(const e of sim.events){
      if(e.id<=lastEvent)continue;
      lastEvent=e.id;
      const actor=sim.actors.find(a=>a.id===e.actorId);
      if(e.kind==='kill'&&e.targetId&&!/TEAMKILL|SELF/.test(e.text)){
        const victim=sim.actors.find(a=>a.id===e.targetId);
        if(!firstKill){firstKill=true;r.firstKills++;if([actor,victim].some(a=>a&&a.attacking&&sim.duty(a)==='entry'))r.firstKillInvolvesEntry++;}
        for(const t of pendingTrades)if(!t.done&&t.killer===e.targetId&&sim.time-t.at<=3){t.done=true;r.entryTraded++;}
        if(victim?.attacking&&prevDuty.get(victim.id)==='entry'&&sim.bomb.status!=='planted'){
          r.entryDeaths++;pendingTrades.push({killer:e.actorId,at:sim.time,done:false});
          const gap=Math.min(...sim.actors.filter(a=>a.team===victim.team&&a.hp>0).map(a=>Math.hypot(a.x-victim.x,a.z-victim.z)));
          if(Number.isFinite(gap))r.entryDeathAllyGap.push(gap);
        }
      }
      // Only the elected support flash ("for you <name>"); the generic throw line says "for you bro".
      if(e.kind==='objective'&&actor&&/\[RADIO\] Flashing for you (?!bro,)[^,]+, swing on the pop!/.test(e.text))inc(r.entryFlashBy,`${actor.position}:${sim.duty(actor)}`);
      if(e.kind==='objective'&&actor&&/\[RADIO\] Flashing for you (?!bro,)[^,]+, swing him now!/.test(e.text))inc(r.fightFlashBy,`${actor.position}:${sim.duty(actor)}`);
      if(e.kind==='objective'&&actor&&/falling back, play the retake/.test(e.text)){r.fallbacks++;fallbackAt.set(actor.id,sim.time);}
      if(e.kind==='objective'&&/alone with the bomb/.test(e.text))r.escorts++;
      if(e.kind==='objective'&&/Only noise on [AB] so far/.test(e.text))r.noiseVerifies++;
      if(e.kind==='objective'&&/lane still contested/.test(e.text))r.laneHeldCalls++;
      if(e.kind==='objective'&&/rotate to delay it, rest hold/.test(e.text))r.measuredRotations++;
      if(e.kind==='objective'&&/IGL: Lost \d on [AB] — rotate together/.test(e.text))r.firmRotations++;
      if(e.kind==='objective'&&/holding until [AB] is confirmed/.test(e.text))r.hesitations++;
      if(e.kind==='objective'&&/Rotating to cover/.test(e.text))r.coverageMoves++;
    }
    for(const w of holdWatch){
      if(w.done)continue;
      for(const ct of sim.actors)if(ct.team===w.team&&ct.hp>0)for(const b of liveIntelBeliefs(ct.intel,sim.time)){
        if(!b.enemyId||b.source!=='sight'||b.age>1)continue;const area=liveIntelArea(b,sim.map.intelArea);
        if(area===w.held)w.seenHeld=true;if(area===w.called)w.seenCalled=true;}
      if(sim.time-w.at>=10||sim.phase!=='live'){w.done=true;r.holdOutcome[w.seenHeld&&w.seenCalled?'both':w.seenHeld?'held':w.seenCalled?'called':'neither']++;}
    }
    for(const [id,at] of fallbackAt)if(sim.time-at>=10){fallbackAt.delete(id);if(sim.actors.find(a=>a.id===id)?.hp>0)r.fallbackSurvived10s++;}
  }
}
const avg=a=>a.length?+(a.reduce((x,y)=>x+y,0)/a.length).toFixed(1):null;
const round=o=>Object.fromEntries(Object.entries(o).sort((a,b)=>b[1]-a[1]).map(([k,v])=>[k,+(+v).toFixed(0)]));
const out={map:mapId,seeds,roles:staticRoles?'static (ablation)':'dynamic',igl:iglPreset||'natural',coach:coachMode||'default',rounds:r.rounds,tWinRate:+(r.wins.T/Math.max(1,r.rounds)).toFixed(2),
  liveEntryByPosition:r.liveEntryByPosition,executeEntryByPosition:r.executeEntryByPosition,iglDuty:r.iglDuty,duplicateEntryTicks:r.duplicateEntries,
  handovers:round(r.handovers),handoverReasons:Object.fromEntries(Object.entries(round(r.handoverReasons)).slice(0,14)),
  noiseVerifies:r.noiseVerifies,laneHeldCalls:r.laneHeldCalls,holdOutcome:r.holdOutcome,measuredRotations:r.measuredRotations,firmRotations:r.firmRotations,hesitations:r.hesitations,verifyHolds:r.verifyHolds,contactHolds:r.contactHolds,lurkerTookEntry:r.lurkerTookEntry,awpDutyHandovers:r.awpDuty,coverageMoves:r.coverageMoves,escorts:r.escorts,
  firstKillInvolvesEntry:`${r.firstKillInvolvesEntry}/${r.firstKills}`,entryDeathsPrePlant:r.entryDeaths,entryTradedWithin3s:r.entryTraded,avgNearestAllyAtEntryDeath:avg(r.entryDeathAllyGap),
  entryFlashBy:r.entryFlashBy,fightFlashBy:r.fightFlashBy,anchorFallbacks:r.fallbacks,fallbackAlive10s:r.fallbackSurvived10s,
  dutySecondsT:Object.fromEntries(Object.entries(round(r.dutySeconds.T)).slice(0,14)),dutySecondsCT:Object.fromEntries(Object.entries(round(r.dutySeconds.CT)).slice(0,12))};
console.log(process.argv.includes('--json')?JSON.stringify(out):JSON.stringify(out,null,1));
