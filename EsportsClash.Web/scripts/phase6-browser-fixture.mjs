// Controlled live-simulator evidence, not a full-match balance sample.
// Called by check-spectator-browser.mjs with CHECK_PHASE6=1.
import assert from 'node:assert/strict';
import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';

export async function checkPhase6({ evaluate, send, delay, outputDir }) {
  await delay(2300); // First live wave supplies a real minion template.
  await evaluate(`(() => {
    const walk = fiber => !fiber ? null : fiber.type?.name === 'AramMatchView' ? fiber : walk(fiber.child) || walk(fiber.sibling);
    const fiber = walk(window.fixtureRoot._internalRoot.current);
    const refs = []; for (let h = fiber.memoizedState; h; h = h.next)
      if (h.memoizedState && Object.hasOwn(h.memoizedState, 'current')) refs.push(h.memoizedState);
    const index = refs.findIndex(r => Array.isArray(r.current) && r.current[0]?.champion);
    if (index < 0) throw Error('Live champion refs unavailable');
    window.phase6Refs = { champions: refs[index], minions: refs[index+1], structures: refs[index+2], projectiles: refs[index+4] };
    window.phase6Template = structuredClone(refs[index+1].current[0]);
    if (!window.phase6Template) throw Error('First wave missing');
  })()`);
  const results = [];
  for (const [name, gap, speed, wave] of [['Valkira', 35, '1x'], ['Astra', 145, '1x'], ['Astra', 145, '4x'], ['Hweilin', 145, '1x', true]]) {
    await evaluate(`(() => {const b=[...document.querySelectorAll('.spectator-shell button')].find(b=>b.textContent.trim()===${JSON.stringify(speed)});b.click();})()`);
    await delay(80);
    await evaluate(`(async () => {
      const {CHAMPIONS}=await import('/src/mockData.ts');
      const r=window.phase6Refs, units=r.champions.current;
      units.forEach(u=>{u.isAlive=false;u.respawnTimer=9999;u.creepAttack=undefined;});
      const u=units[0]; Object.assign(u, {champion:{...CHAMPIONS.find(c=>c.name===${JSON.stringify(name)}),aspd:0.8},
        isAlive:true,hp:10000,maxHp:10000,mana:100,x:1200,y:380,vx:0,vy:0,level:3,
        attackTimer:${wave ? 1.25 : 0},cd1:${wave ? 0 : 999},cd2:999,cdUlt:999,items:[],boots:undefined,
        isRecalling:false,recallIntent:false,recallCooldown:0,committedState:undefined,decisionCommitTimer:0,
        actionIntent:undefined,actionFailures:undefined,diveAborting:false,stunTimer:0,charmTimer:0,fearTimer:0,
        lastEnemyDamage:undefined,animState:'idle',creepAttack:undefined});
      r.structures.current.forEach(s=>{s.x=s.team==='blue'?100:2500;s.y=380;});
      r.projectiles.current=[];
      r.minions.current=[{...window.phase6Template,id:'phase6-creep',team:'red',x:1200+${gap},y:380,
        hp:10000,maxHp:10000,ad:0,speed:0,range:0,isAlive:true,attackTimer:999}];
      if (${!!wave}) {
        u.level=18;u.player={...u.player,stats:{...u.player.stats,iq:99,lan:99,tf:99}};
        r.minions.current=[0,1,2].map(i=>({...r.minions.current[0],id:'phase6-creep-'+i,y:370+i*10,hp:120,maxHp:120}));
      }
      const targets=r.minions.current.slice(); // Keep observing killed creeps after live-list cleanup.
      window.phase6Samples=[];
      window.phase6Poll=setInterval(()=>{
        const a=u.creepAttack, shots=r.projectiles.current.filter(p=>p.creepAttackTarget||p.waveClear);
        window.phase6Samples.push({hp:targets[0].hp,windup:!!a&&!a.released,released:!!a?.released,
          shotCount:shots.length,attackTimer:u.attackTimer,startedAt:a?.startedAt,releaseAt:a?.releaseAt,
          cd1:u.cd1,mana:u.mana,hps:targets.map(m=>m.hp)});
      },4);
    })()`);
    await delay(speed === '4x' ? 220 : 880);
    const samples = await evaluate(`(() => {clearInterval(window.phase6Poll);return window.phase6Samples;})()`);
    if (wave) {
      assert.ok(samples.some(s=>s.shotCount>0 && s.hps.every(hp=>hp===120)), 'Wave damage must wait for collision');
      assert.ok(samples.some(s=>s.hps.every(hp=>hp<120)), 'One wave projectile must damage the intended cluster: '+JSON.stringify(samples.filter((s,i)=>i===0||s.hp!==samples[i-1].hp||s.shotCount!==samples[i-1].shotCount)));
      assert.ok(samples.some(s=>s.cd1>0 && s.mana<100), 'Wave cast spends actual mana and cooldown');
      assert.equal(new Set(samples.filter(s=>s.hps.every(hp=>hp<120)).map(s=>JSON.stringify(s.hps))).size,1, 'No duplicate wave damage');
      results.push({name,speed,wave:true,postImpactHp:samples.at(-1).hps});
      const impactCapture = await send('Page.captureScreenshot', { format: 'png' });
      await writeFile(join(outputDir, 'phase6-wave-impact.png'), Buffer.from(impactCapture.data, 'base64'));
      continue;
    }
    assert.ok(samples.some(s => s.windup && s.hp === 10000), `${name} must wind up before damage: ${JSON.stringify(samples)}`);
    assert.ok(samples.some(s => s.hp < 10000), `${name} must land a live attack`);
    const firstDamage = samples.findIndex(s => s.hp < 10000);
    assert.ok(samples.slice(0, firstDamage).some(s => s.windup));
    if (name === 'Astra') assert.ok(samples.slice(0, firstDamage).some(s => s.shotCount > 0), 'Ranged damage must follow flight');
    assert.equal(new Set(samples.filter(s => s.hp < 10000).map(s => s.hp)).size, 1, 'One attack must apply damage once');
    results.push({name,speed,samples:samples.length,damage:10000-samples.at(-1).hp,
      windupSeconds:samples.find(s=>s.windup).releaseAt-samples.find(s=>s.windup).startedAt});
  }
  // Read-only close-up presentation at fixed simulation times for visual review.
  await evaluate(`(async () => {
    const {drawChampionSprite}=await import('/src/components/ChampionSpriteRenderer.ts');
    const {drawLaneMinionModel}=await import('/src/components/BattlefieldModelRenderer.ts');
    const {startCreepAttack,advanceCreepAttack,creepAttackPose}=await import('/src/creepAttackTiming.ts');
    const canvas=document.createElement('canvas');canvas.id='phase6-closeup';canvas.width=1200;canvas.height=500;
    canvas.style='position:fixed;inset:20px;z-index:99999;background:#152331;border:2px solid #94a3b8';document.body.append(canvas);
    const ctx=canvas.getContext('2d');ctx.fillStyle='#e2e8f0';ctx.font='18px sans-serif';
    for(const [row,name] of ['Valkira','Astra'].entries()) for(const [col,second] of [0.18,0.24,0.4].entries()){
      let state=startCreepAttack('creep','minion',50,0,1.25);if(second>=state.releaseAt)state=advanceCreepAttack(state,state.releaseAt,false,true).state;
      const x=col*390+110,y=row*230+170;ctx.fillText(name+' / '+['windup','strike / fire','recovery'][col],col*390+20,row*230+35);
      ctx.save();ctx.translate(x,y);ctx.scale(2,2);
      drawChampionSprite(ctx,{championName:name,x:0,y:0,facing:'right',animState:'attack',animTime:second,team:'blue',isStunned:false,isCharmed:false,isInBush:false,basicAttackPose:creepAttackPose(state,second)});
      ctx.translate(70,0);drawLaneMinionModel(ctx,'red','melee',0,0);ctx.restore();
    }
  })()`);
  const capture = await send('Page.captureScreenshot', { format: 'png' });
  const path = join(outputDir, 'phase6-attack-poses.png');
  await writeFile(path, Buffer.from(capture.data, 'base64'));
  await evaluate(`document.querySelector('#phase6-closeup').remove()`);
  console.log('Phase 6 controlled LIVE attack checks:', JSON.stringify(results), 'Visual:', path);
}
