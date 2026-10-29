import type {AramChampionUnit,ChampionKit} from './types.ts';
import {resolveHeroIdentityV3,V3_RULESET} from './heroIdentityV3.ts';
import {ROSTER_DEFINITIONS,isRosterHero,rosterState} from './v3Roster.ts';
import {V3_PREVIEW_KEYS,v3Actor,v3AttackSpeed,v3Passenger,type V3Environment,type V3Unit,type V3World,type V3Slot,type V3DamageContext,type V3BattlefieldTarget} from './v3Combat.ts';
import {ARENA_WIDTH,PLAY_MIN_Y,PLAY_MAX_Y,isInsideRockTerrain} from './arenaRules.ts';
export const isV3Hero=(u:Pick<AramChampionUnit,'champion'>)=>u.champion.abilityRuleset===V3_RULESET;
/** Legacy signature entry points must never execute for a migrated unit. */
export function assertLegacyAbility(u:Pick<AramChampionUnit,'champion'>){if(isV3Hero(u))throw Error('Original V3 cannot dispatch legacy ability mechanics');}
export {v3Champion} from './v3Catalog.ts';
export const v3LegalPoint=(p:{x:number;y:number})=>p.x>=40&&p.x<=ARENA_WIDTH-40&&p.y>=PLAY_MIN_Y&&p.y<=PLAY_MAX_Y&&!isInsideRockTerrain(p.x,p.y,13);
export function v3LegalSegment(a:{x:number;y:number},b:{x:number;y:number}){
  const distance=Math.hypot(a.x-b.x,a.y-b.y),steps=Math.max(1,Math.ceil(distance/4));
  for(let i=0;i<=steps;i++)if(!v3LegalPoint({x:a.x+(b.x-a.x)*i/steps,y:a.y+(b.y-a.y)*i/steps}))return false;return true;
}
export function v3ArenaEnvironment(champions:AramChampionUnit[],visible:(a:AramChampionUnit,b:AramChampionUnit)=>boolean,
  damage:(a:AramChampionUnit,b:AramChampionUnit,amount:number,slot:V3Slot,context?:V3DamageContext)=>void,
  projectiles:readonly {id:string;x:number;y:number;targetX:number;targetY:number;speed:number;damage:number;attackerId:string;skillshot?:boolean;abilitySlot?:string;v3Overhead?:boolean}[]=[],
  control?:(a:AramChampionUnit,b:AramChampionUnit,seconds:number)=>void,
  battlefield?:{targets:readonly V3BattlefieldTarget[];damage:(source:AramChampionUnit,target:V3BattlefieldTarget,amount:number,slot:V3Slot)=>void}):{environment:V3Environment;sync:(world:V3World)=>void}{
  const actual=new Map(champions.map(c=>[c.id,c]));
  const units:V3Unit[]=champions.map(c=>({id:c.id,team:c.team,hero:isV3Hero(c)?V3_PREVIEW_KEYS[c.champion.id]:undefined,x:c.x,y:c.y,
    hp:c.hp,maxHp:c.maxHp,mana:c.mana,level:c.level,shield:c.shield,alive:c.isAlive,
    disabledSlots:(['skill1','skill2','ultimate'] as V3Slot[]).filter(slot=>c.champion[slot].disabled),
    cooldownOverrides:Object.fromEntries((['skill1','skill2','ultimate'] as V3Slot[]).flatMap(slot=>{const cd=c.champion[slot].catalogCooldownOverride;return cd!==undefined&&Number.isFinite(cd)&&cd>=0&&cd<=600?[[slot,cd]]:[];})),facing:c.facing==='right'?0:Math.PI,dashing:!!c.dash,
    controlled:!!c.isRecalling||c.zhonyaActive||(c.untargetableTimer??0)>0||c.stunTimer>0||(c.knockupTimer??0)>0||(c.fearTimer??0)>0||(c.charmTimer??0)>0||!!c.hookPull}));
  const before=new Map(units.map(u=>[u.id,{x:u.x,y:u.y,mana:u.mana,shield:u.shield}]));
  const environment:V3Environment={units,legalPoint:v3LegalPoint,legalSegment:v3LegalSegment,
    legalTravel:(from,to)=>v3LegalSegment(from,to)&&!(battlefield?.targets??[]).some(t=>{
      if(t.kind!=='structure'||!t.alive)return false;const dx=to.x-from.x,dy=to.y-from.y,n=dx*dx+dy*dy;
      const q=n?Math.max(0,Math.min(1,((t.x-from.x)*dx+(t.y-from.y)*dy)/n)):0;
      return Math.hypot(t.x-from.x-q*dx,t.y-from.y-q*dy)<31;
    }),
    battlefieldTargets:battlefield?.targets,damageBattlefield:(source,target,amount,slot)=>{const c=actual.get(source.id);if(c)battlefield?.damage(c,target,amount,slot);},
    projectiles:projectiles.flatMap(p=>{const owner=actual.get(p.attackerId);if(!owner)return [];const distance=Math.hypot(p.targetX-p.x,p.targetY-p.y);
      return [{id:p.id,x:p.x,y:p.y+15,team:owner.team,vx:(p.targetX-p.x)/Math.max(1,distance)*p.speed,vy:(p.targetY-p.y)/Math.max(1,distance)*p.speed,
        owner:owner.id,homing:!p.skillshot,overhead:!!p.v3Overhead,physical:!p.abilitySlot,
        damage:p.damage,ultimate:p.abilitySlot==='ultimate',consenting:!!(p.skillshot&&p.abilitySlot!=='ultimate'&&owner.hp/owner.maxHp>.4),redirected:false}];}),
    visible:(a,b)=>visible(actual.get(a.id)!,actual.get(b.id)!),
    damage:(a,b,amount,slot,context)=>{const source=actual.get(a.id)!,target=actual.get(b.id)!;damage(source,target,amount,slot,context);
      b.hp=target.hp;b.shield=target.shield;b.alive=target.isAlive;before.get(b.id)!.shield=target.shield;},
    heal:(u,amount)=>{const c=actual.get(u.id)!;c.hp=Math.min(c.maxHp,c.hp+amount*((c.grievousTimer??0)>0?.6:1));u.hp=c.hp;},
    nonlethalCost:(u,amount)=>{const c=actual.get(u.id)!;c.hp=Math.max(1,c.hp-amount);u.hp=c.hp;},
    reveal:(u,seconds)=>{const c=actual.get(u.id)!;c.revealedTimer=Math.max(c.revealedTimer??0,seconds);},
    control:(a,b,seconds)=>control?.(actual.get(a.id)!,actual.get(b.id)!,seconds),
    slow:(u,amount,seconds)=>{const target=actual.get(u.id)!;target.kaelenSlowTimer=Math.max(target.kaelenSlowTimer??0,seconds);target.kaelenSlowAmount=Math.max(target.kaelenSlowAmount??0,amount);}};
  return {environment,sync:world=>{for(const u of units){const c=actual.get(u.id)!,previous=before.get(u.id)!;
    if(u.x!==previous.x||u.y!==previous.y){c.x=u.x;c.y=u.y;}
    if(u.mana!==previous.mana)c.mana=Math.max(0,c.mana+u.mana-previous.mana);
    if(u.shield!==previous.shield)c.shield=u.shield;
    const a=v3Actor(world,u.id);c.v3RecoveryRemaining=Math.max(0,(a.recoveryUntil-world.tick)/30);c.v3AttackSpeedMultiplier=v3AttackSpeed(world,u);
    c.v3Transport=v3Passenger(world,u.id);
    c.v3DisarmRemaining=Math.max(0,((rosterState(world,u.id).timers.disarm??0)-world.tick)/30);
    c.v3TurnDampingRemaining=Math.max(0,((rosterState(world,u.id).marks['slow-turn']?.expires??0)-world.tick)/30);
    if(u.hero){c.cd1=Math.max(0,(a.cooldowns.skill1-world.tick)/30);c.cd2=Math.max(0,(a.cooldowns.skill2-world.tick)/30);c.cdUlt=Math.max(0,(a.cooldowns.ultimate-world.tick)/30);}
    Object.assign(previous,{x:u.x,y:u.y,mana:u.mana,shield:u.shield});
  }}};
}
