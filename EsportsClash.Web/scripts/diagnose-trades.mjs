// Why entry deaths are (not) traded: for each pre-plant death of a T on first contact, where were the
// teammates, could any see the killer, did the paired trader exist, and how did the next 3 s go.
// Usage: node scripts/diagnose-trades.mjs --map=fontessa --seeds=11,22,33 --steps=40000 [--static] [--all-deaths]
import {FPS_T_POSITIONS,FPS_CT_POSITIONS} from '../src/fps/fpsPlayerArchitecture.ts';
import {FpsLiveSimulation} from '../src/fps/fpsLiveSimulation.ts';
import {FPS_IDENTITY_PERSONALITIES,generatePlayerDNA} from '../src/fps/fpsIdentity.ts';
import {generateFpsSkillProfile} from '../src/fps/fpsSkillProfile.ts';
const arg=(k,f)=>process.argv.find(v=>v.startsWith(`--${k}=`))?.split('=')[1]??f;
const mapId=arg('map','fontessa'),seeds=arg('seeds','11').split(',').map(Number),steps=Number(arg('steps','40000'));
const staticRoles=process.argv.includes('--static'),allDeaths=process.argv.includes('--all-deaths'),bothSides=process.argv.includes('--both');
const plan={tempo:.6,structure:.7,aggression:.5,preparation:.7,freedom:.5,economy:.8};
const coach={...plan,rigidity:.7,communication:.7,leadership:.7,adaptability:.7,development:.5};
const chemistry={trust:.6,communication:.6,understanding:.6,leadershipAcceptance:.6,roleCompetition:.3};
const out={swingPlanned:{T:0,CT:0},swingWhy:{},swings:{T:{started:0,kill:0,died:0},CT:{started:0,kill:0,died:0}},map:mapId,seeds,roles:staticRoles?'static':'dynamic',swingByClass:{},targetedActs:{},losTicks:0,fovTicks:0,offActs:{},deaths:0,traded:0,bySide:{T:{deaths:0,traded:0},CT:{deaths:0,traded:0}},detail:{},classes:{},tradedBy:{},nearestAtDeath:[],partnerGap:[],rounds:0,tWins:0};
const inc=(o,k)=>{o[k]=(o[k]??0)+1;};
for(const seed of seeds){
  const cards=Array.from({length:10},(_,i)=>({id:`tr-${seed}-${i}`,name:`Operative ${i}`,stats:{rifling:70,sniping:70,entry:70,utility:70,positioning:70,shotcalling:70}}));
  const identity={players:Object.fromEntries(cards.map((p,i)=>[p.id,{id:p.id,assignments:{t:FPS_T_POSITIONS[i%5],ct:FPS_CT_POSITIONS[i%5]},personality:FPS_IDENTITY_PERSONALITIES[(i*7+seed)%54],dna:generatePlayerDNA(p.id),roleSuitability:.6,familiarity:.5}])),teams:{blue:{coach,plan,chemistry},red:{coach,plan,chemistry}}};
  const profiles=Object.fromEntries(cards.map(p=>[p.id,generateFpsSkillProfile(p.id,seed,'2026-11-16T00:00:00.000Z')]));
  const sim=new FpsLiveSimulation(cards.slice(0,5),cards.slice(5),seed,identity,{mapId,skillProfiles:profiles,diagnostics:staticRoles?{staticRoles:true}:undefined,onRoundComplete:r=>{out.rounds++;if(r.winner===r.attackTeam)out.tWins++;}});
  let lastEvent=0;const open=[];const dutyBefore=new Map();const swingOpen=[];const prevIntent=new Map();
  for(let i=0;i<steps;i++){
    for(const a of sim.actors)if(a.hp>0)dutyBefore.set(a.id,sim.duty(a));
    sim.step();sim.drainAudioCues();
    if(sim.phase==='finished')break;
    for(const a of sim.actors){if(a.tradeSwing&&!a._seenSwing){a._seenSwing=a.tradeSwing;out.swingPlanned[a.attacking?'T':'CT']++;}
      else if(!a.tradeSwing&&a._seenSwing){const w=a._seenSwing;a._seenSwing=undefined;if(a.intent!=='Swing the called position to trade'){const why=a.hp<=0?'died':a.peek?'already peeking':a.target?'had a target':a.noticedEnemies?.length?'saw an enemy':sim.map.sightline(a,w.point)?'already had sight of the spot':sim.time>=w.until?'no think in window':'other';out.swingWhy[why]=(out.swingWhy[why]??0)+1;}}}
    for(const a of sim.actors){if(a.hp>0&&a.intent==='Swing the called position to trade'&&prevIntent.get(a.id)!==a.intent){const side=a.attacking?'T':'CT';out.swings[side].started++;swingOpen.push({id:a.id,side,at:sim.time});}prevIntent.set(a.id,a.intent);}
    for(const e of sim.events){
      if(e.id<=lastEvent)continue;lastEvent=e.id;
      if(e.kind!=='kill'||!e.targetId||/TEAMKILL|SELF/.test(e.text))continue;
      for(const w of swingOpen)if(!w.done&&sim.time-w.at<=3){if(e.actorId===w.id){w.done=true;out.swings[w.side].kill++;}else if(e.targetId===w.id){w.done=true;out.swings[w.side].died++;}}
      for(const o of open)if(!o.done&&o.killer===e.targetId&&sim.time-o.at<=3){o.done=true;out.traded++;out.bySide[o.side].traded++;const by=sim.actors.find(a=>a.id===e.actorId);inc(out.tradedBy,by?`${by.id===o.partner?'partner':'other'}:${dutyBefore.get(by.id)}`:'?');}
      const victim=sim.actors.find(a=>a.id===e.targetId),killer=sim.actors.find(a=>a.id===e.actorId);
      if(!victim||!killer||killer.team===victim.team||sim.bomb.status==='planted'||sim.phase!=='live')continue;
      if(!victim.attacking&&!bothSides)continue;
      if(!allDeaths&&dutyBefore.get(victim.id)!=='entry')continue;
      out.deaths++;out.bySide[victim.attacking?'T':'CT'].deaths++;
      const mates=sim.actors.filter(a=>a.team===victim.team&&a.hp>0);
      const partner=mates.find(a=>a.tradeFor===victim.id);
      const near=mates.filter(a=>Math.hypot(a.x-victim.x,a.z-victim.z)<18);
      const seeing=near.filter(a=>sim.visible(a,killer,false));
      const nearest=Math.min(...mates.map(a=>Math.hypot(a.x-victim.x,a.z-victim.z)));
      if(Number.isFinite(nearest))out.nearestAtDeath.push(nearest);
      if(partner)out.partnerGap.push(Math.hypot(partner.x-victim.x,partner.z-victim.z));
      const cls=!mates.length?'last alive':!near.length?'nobody within 18 m':!seeing.length?'in range, no sight of killer':'in range with sight';
      open.push({victim:victim.id,called:/trade him!/.test(victim.radioMessage??''),killer:killer.id,partner:partner?.id,at:sim.time,cls,done:false,side:victim.attacking?'T':'CT',near:near.map(a=>a.id),seeing:seeing.map(a=>a.id),targeted:false,shot:false,allyDied:false,sawLater:false,firstShotAt:undefined});
    }
    for(const o of open){if(o.counted)continue;const k=sim.actors.find(a=>a.id===o.killer);
      for(const id of o.near){const a=sim.actors.find(x=>x.id===id);if(!a)continue;if(a.tradeSwing?.victim===o.victim||a.intent==='Swing the called position to trade')o.swung=true;if(a.hp<=0)o.allyDied=true;else{if(a.target===o.killer){o.targeted=true;if(!o.shot){o.acts??={};const k2=`${a.action}${a.equipped!==a.weapon?' [equip '+a.equipped+']':''}${sim.visible(a,k,false)?'':' [no LOS]'}`;o.acts[k2]=(o.acts[k2]??0)+1;}}if(k&&k.hp>0&&sim.visible(a,k,false)){o.sawLater=true;o.los=(o.los??0)+1;if(sim.visible(a,k,true))o.fov=(o.fov??0)+1;else{o.offActs??={};const kk=a.action+' | '+(a.intent??'').slice(0,40);o.offActs[kk]=(o.offActs[kk]??0)+1;}}}}
      for(const sh of sim.shots)if(sh.targetId===o.killer&&o.near.includes(sh.actorId)&&sh.time>o.at){o.shot=true;o.firstShotAt??=sh.time-o.at;}
      if(o.done||sim.time-o.at>3){o.counted=true;inc(out.classes,`${o.side} ${o.cls} → ${o.done?'traded':'not traded'}`);
        if(!o.done&&o.cls.startsWith('in range')){const sw=(o.called?'called':'uncalled')+(o.swung?'+swing':'');inc(out.swingByClass,`${o.cls} ${sw}`);const why=o.shot?'shot at killer, no kill':o.targeted?'targeted, never fired':o.sawLater?'had sight, never targeted':o.allyDied?'no sight, trader died':'never had sight';inc(out.detail,`${o.side} ${o.cls}: ${why}`);if(!o.done){out.losTicks+=o.los??0;out.fovTicks+=o.fov??0;for(const[k2,v]of Object.entries(o.offActs??{}))out.offActs[k2]=(out.offActs[k2]??0)+v;}if(why==='targeted, never fired'&&o.acts)for(const[k2,v]of Object.entries(o.acts))out.targetedActs[k2]=(out.targetedActs[k2]??0)+v;}}}
  }
}
const avg=a=>a.length?+(a.reduce((x,y)=>x+y,0)/a.length).toFixed(1):null;
console.log(JSON.stringify({...out,tWinRate:+(out.tWins/Math.max(1,out.rounds)).toFixed(2),nearestAtDeath:avg(out.nearestAtDeath),partnerGap:avg(out.partnerGap),
  classes:Object.fromEntries(Object.entries(out.classes).sort())},null,process.argv.includes('--json')?0:1));
