import assert from 'node:assert/strict';
import {FpsLiveSimulation,LIVE_FPS_STEP} from '../fps/fpsLiveSimulation.ts';
import {FPS_T_POSITIONS,FPS_CT_POSITIONS,fpsExecutionRole,FPS_IDENTITY_PERSONALITIES,generatePlayerDNA} from '../fps/fpsIdentity.ts';
import {LIVE_ACTOR_RADIUS,liveActorSolids} from '../fps/fpsLiveMap.ts';
import {segmentHitsWall} from '../fps/fpsSpatialWorld.ts';
import {LIVE_WEAPONS} from '../fps/fpsLiveWeapons.ts';

const freeze=(value)=>{if(value&&typeof value==='object'&&!Object.isFrozen(value)){for(const child of Object.values(value))freeze(child);Object.freeze(value);}return value;};

export const baselineGamePlan=freeze({tempo:.6,structure:.7,aggression:.5,preparation:.7,freedom:.5,economy:.8});
export const baselineCards=freeze(Array.from({length:10},(_,i)=>({id:`baseline-${i}`,name:`Baseline Operative ${i+1}`,
  stats:{rifling:80,sniping:80,entry:80,utility:80,positioning:80,shotcalling:80}})));
const coach={...baselineGamePlan,rigidity:.7,communication:.7,leadership:.7,adaptability:.7,development:.5};
const chemistry={trust:.6,communication:.6,understanding:.6,leadershipAcceptance:.6,roleCompetition:.3};
export const baselineIdentity=freeze({players:Object.fromEntries(baselineCards.map((p,i)=>[p.id,{id:p.id,
  assignments:{t:FPS_T_POSITIONS[i%5],ct:FPS_CT_POSITIONS[i%5]},personality:structuredClone(FPS_IDENTITY_PERSONALITIES[i]),
  dna:generatePlayerDNA(p.id),intensity:.6,roleSuitability:.6,familiarity:.5}])),
  teams:{blue:{coach:{...coach},plan:{...baselineGamePlan},chemistry:{...chemistry}},red:{coach:{...coach},plan:{...baselineGamePlan},chemistry:{...chemistry}}}});

/** Fresh canonical freeze state. Tactical cases explicitly arrange their own live state. */
export function createBaselineSimulation(seed=1337){
  assert.ok(Number.isInteger(seed)&&seed>0&&seed<=2147483647,'Baseline seed must be a positive 31-bit integer');
  const cards=structuredClone(baselineCards);
  return new FpsLiveSimulation(cards.slice(0,5),cards.slice(5),seed,structuredClone(baselineIdentity));
}

const forbiddenKeys=new Set([
  'dna','rawDna','privateDna','playerDna','riskTolerance','emotionalStability','coachability','tacticalDiscipline','adaptability','creativity',
  'confidenceVolatility','socialTrust','leadershipInitiative','competitiveDrive','teamOrientation','preparationPreference',
  'intel','rawIntel','privateIntel','hiddenIntel','enemyIntel','enemyContacts','noticedEnemies','sentReports','pendingCues','motionSamples','previousSight','trackingPoint','randomState','mentalState',
].map(key=>key.replaceAll('_','').replaceAll('-','').toLowerCase()));

function auditPublicTree(value,path,active=new WeakSet()){
  if(typeof value==='number'){assert.ok(Number.isFinite(value),`${path}: public numeric state must be finite`);return;}
  if(value===null||value===undefined||typeof value==='string'||typeof value==='boolean')return;
  assert.equal(typeof value,'object',`${path}: public state must be plain serializable data`);
  assert.ok(Array.isArray(value)||Object.getPrototypeOf(value)===Object.prototype||Object.getPrototypeOf(value)===null,`${path}: private runtime object escaped`);
  assert.ok(!active.has(value),`${path}: public state must not contain cycles`);
  active.add(value);
  for(const [key,child] of Object.entries(value)){
    assert.ok(!forbiddenKeys.has(key.replaceAll('_','').replaceAll('-','').toLowerCase()),`${path}.${key}: private DNA or actor memory escaped`);
    auditPublicTree(child,`${path}.${key}`,active);
  }
  active.delete(value);
}

const within=(value,min,max,label)=>assert.ok(Number.isFinite(value)&&value>=min&&value<=max,`${label}: ${value} outside ${min}..${max}`);
const integer=(value,min,max,label)=>{within(value,min,max,label);assert.ok(Number.isInteger(value),`${label}: integer required`);};
const teamId=(value,label)=>assert.ok(value==='blue'||value==='red',`${label}: invalid team ${value}`);
const firearm=(weapon,label)=>{assert.ok(Object.hasOwn(LIVE_WEAPONS,weapon),`${label}: unknown firearm ${weapon}`);return LIVE_WEAPONS[weapon];};
const ammo=(weapon,magazine,reserve,label)=>{const stats=firearm(weapon,label);integer(magazine,0,stats.magazine,`${label}.ammo`);integer(reserve,0,stats.reserve,`${label}.reserve`);};

/**
 * Read-only public-state contract. Context: label, exactCollision=true,
 * requireTenPlayers=true, checkAssignments=true, frozenAssignments=Map/object of
 * player IDs to {t,ct}. Supply a previous public frame for temporal contracts.
 * Artificial tactical arrangements may disable exactCollision explicitly.
 */
export function auditBaselineSnapshot(frame,previous,context={}){
  const label=context.label??`round ${frame?.round} at ${frame?.time}`;
  assert.ok(frame&&typeof frame==='object',`${label}: snapshot required`);
  auditPublicTree(frame,label);
  assert.equal(frame.version,'hexatrick-live-exhibition-v19',`${label}: unsupported public snapshot schema`);
  within(frame.time,0,Number.MAX_SAFE_INTEGER,`${label}.time`);
  integer(frame.round,1,Number.MAX_SAFE_INTEGER,`${label}.round`);
  assert.ok(['freeze','live','post','finished'].includes(frame.phase),`${label}: invalid phase`);
  within(frame.remaining,0,115+LIVE_FPS_STEP,`${label}.remaining`);
  teamId(frame.attackTeam,`${label}.attackTeam`);
  if(frame.winner!==undefined)teamId(frame.winner,`${label}.winner`);
  if(frame.roundWinner!==undefined)teamId(frame.roundWinner,`${label}.roundWinner`);
  assert.ok(frame.score&&frame.teams,`${label}: both team summaries required`);
  for(const team of ['blue','red']){
    integer(frame.score[team],0,frame.round,`${label}.score.${team}`);
    assert.ok(frame.teams[team]&&typeof frame.teams[team].information==='string',`${label}: ${team} plan required`);
  }
  assert.ok(frame.score.blue+frame.score.red<=frame.round,`${label}: more scored rounds than completed/current rounds`);
  for(const key of ['players','events','shots','smokes','fires','blasts','bloodMarks','grenades','droppedWeapons'])assert.ok(Array.isArray(frame[key]),`${label}.${key}: array required`);
  if(context.requireTenPlayers!==false)assert.equal(frame.players.length,10,`${label}: ten players required`);
  const ids=new Set(),byId=new Map(frame.players.map(p=>[p.id,p]));
  for(const p of frame.players){
    const at=`${label}/${p.id}`;
    assert.ok(typeof p.id==='string'&&p.id.length>0&&!ids.has(p.id),`${at}: unique player ID required`);ids.add(p.id);
    for(const key of ['target','contact','contactAt','watchPoint','aimPoint','knownSmokes','profile','sidearmLoadout','holsteredPrimary'])assert.ok(!Object.hasOwn(p,key),`${at}.${key}: private actor state escaped`);
    teamId(p.team,`${at}.team`);
    assert.equal(p.attacking,p.team===frame.attackTeam,`${at}: force/club mismatch`);
    within(p.x,-34,34,`${at}.x`);within(p.z,-43,43,`${at}.z`);
    assert.ok(p.level===undefined||p.level==='street'||p.level==='canal',`${at}: invalid terrain level`);
    within(p.hp,0,100,`${at}.hp`);within(p.armor,0,100,`${at}.armor`);integer(p.cash,0,10000,`${at}.cash`);
    ammo(p.weapon,p.ammo,p.reserve,at);
    within(p.reload,0,10,`${at}.reload`);within(p.reloadDuration,0,10,`${at}.reloadDuration`);
    within(p.weaponReady,0,10,`${at}.weaponReady`);within(p.channel,0,10+LIVE_FPS_STEP,`${at}.channel`);
    within(p.speed,0,20,`${at}.speed`);
    for(const key of ['kills','deaths','assists','teamKills'])if(p[key]!==undefined)integer(p[key],0,Number.MAX_SAFE_INTEGER,`${at}.${key}`);
    for(const key of ['flash','smoke','incendiary','he'])integer(p[key],0,key==='flash'?2:1,`${at}.${key}`);
    assert.ok(p.flash+p.smoke+p.incendiary+p.he<=4,`${at}: grenade capacity exceeded`);
    assert.equal(p.meleeWeapon,'knife',`${at}: permanent melee slot missing`);
    const secondary=firearm(p.secondaryWeapon,`${at}.secondaryWeapon`);
    assert.equal(secondary.category,'pistol',`${at}: secondary slot must be a pistol`);
    ammo(p.secondaryWeapon,p.secondaryAmmo,p.secondaryReserve,`${at}.secondary`);
    if(p.primaryWeapon!==undefined)assert.notEqual(firearm(p.primaryWeapon,`${at}.primaryWeapon`).category,'pistol',`${at}: primary slot cannot be a pistol`);
    if(LIVE_WEAPONS[p.weapon].category==='pistol')assert.equal(p.secondaryWeapon,p.weapon,`${at}: active pistol disagrees with secondary slot`);
    else assert.equal(p.primaryWeapon,p.weapon,`${at}: active primary disagrees with primary slot`);
    assert.ok(Object.hasOwn(LIVE_WEAPONS,p.equipped)||['knife','flash','smoke','incendiary','he','bomb'].includes(p.equipped),`${at}: invalid equipped item`);
    if(p.jumpY!==undefined)within(p.jumpY,-3,20,`${at}.jumpY`);
    if(p.groundY!==undefined)within(p.groundY,-3,20,`${at}.groundY`);
    if(p.jumpVy!==undefined)within(p.jumpVy,-100,100,`${at}.jumpVy`);
    if(context.checkAssignments!==false){
      const side=p.attacking?'t':'ct',positions=p.attacking?FPS_T_POSITIONS:FPS_CT_POSITIONS;
      assert.ok(positions.includes(p.position),`${at}: invalid ${side} assignment`);
      const frozen=context.frozenAssignments instanceof Map?context.frozenAssignments.get(p.id):context.frozenAssignments?.[p.id];
      const expected=frozen??baselineIdentity.players[p.id]?.assignments;
      if(expected)assert.equal(p.position,expected[side],`${at}: manager assignment changed`);
      assert.equal(p.role,fpsExecutionRole(p.position),`${at}: execution responsibility disagrees with manager assignment`);
    }
    if(context.exactCollision!==false&&p.hp>0){
      const wall=liveActorSolids(p,p.jumpY??p.groundY??0,p.crouch?1.3:1.72).find(w=>segmentHitsWall(p,p,w,LIVE_ACTOR_RADIUS-.001));
      assert.ok(!wall,`${at}: living capsule intersects ${wall?.id??'static geometry'}`);
    }
  }
  for(const team of ['blue','red']){
    const squad=frame.players.filter(p=>p.team===team);
    if(context.requireTenPlayers!==false)assert.equal(squad.length,5,`${label}: ${team} requires five players`);
    if(context.checkAssignments!==false)assert.equal(new Set(squad.map(p=>p.position)).size,squad.length,`${label}: duplicate ${team} assignments`);
    if(frame.teams[team].forces){
      assert.equal(frame.teams[team].forces.allies,squad.filter(p=>p.hp>0).length,`${label}: ${team} living summary disagrees`);
      integer(frame.teams[team].forces.enemies,0,5,`${label}: ${team} known enemy count`);
    }
  }
  assert.ok(frame.bomb&&['carried','dropped','planted','defused','exploded'].includes(frame.bomb.status),`${label}: invalid C4 state`);
  within(frame.bomb.x,-34,34,`${label}.bomb.x`);within(frame.bomb.z,-43,43,`${label}.bomb.z`);within(frame.bomb.remaining,0,40,`${label}.bomb.remaining`);
  const carriers=frame.players.filter(p=>p.bomb);
  assert.equal(carriers.length,frame.bomb.status==='carried'?1:0,`${label}: public C4/carrier state disagrees`);
  if(carriers.length)assert.ok(carriers[0].attacking&&carriers[0].hp>0,`${label}: invalid C4 carrier`);
  for(const [i,w] of frame.droppedWeapons.entries())ammo(w.weapon,w.ammo,w.reserve,`${label}.droppedWeapons[${i}]`);
  for(const key of ['events','shots','smokes','fires','blasts','bloodMarks','grenades','droppedWeapons','droppedUtility','droppedKits','corpses','teamReports','fireCues']){
    if(!frame[key])continue;
    const itemIds=frame[key].map(item=>item.id);
    assert.equal(new Set(itemIds).size,itemIds.length,`${label}.${key}: duplicate public IDs`);
  }
  if(previous){
    assert.ok(frame.time>=previous.time,`${label}: simulation time went backwards`);
    assert.ok(frame.round>=previous.round,`${label}: round went backwards`);
    assert.deepEqual([...ids].sort(),previous.players.map(p=>p.id).sort(),`${label}: roster changed`);
    for(const team of ['blue','red'])assert.ok(frame.score[team]>=previous.score[team],`${label}: score decreased`);
    for(const before of previous.players){
      const p=byId.get(before.id),at=`${label}/${before.id}`;
      assert.equal(p.team,before.team,`${at}: club identity changed`);
      for(const key of ['kills','deaths','assists'])if(before[key]!==undefined)assert.ok(p[key]>=before[key],`${at}: cumulative ${key} decreased`);
      if(frame.round===previous.round){
        assert.equal(p.attacking,before.attacking,`${at}: force changed within a round`);
        if(context.checkAssignments!==false)assert.equal(p.position,before.position,`${at}: assignment changed within a round`);
        assert.ok(p.hp<=before.hp,`${at}: health increased without a new round`);
      }
    }
  }
  return true;
}
