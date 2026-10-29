import type { ArenaSceneFrame } from './ArenaFrame';

/** Shared presentation boundary. Implementations never receive simulation commands. */
export interface MatchViewer {
  isAvailable(): boolean;
  renderArena(frame: ArenaSceneFrame, x: number, y: number, zoom: number): boolean;
  render(x: number, y: number, zoom: number): unknown;
  viewport(x: number, y: number, zoom: number): { x: number; y: number; halfW: number; halfH: number };
  pan(dx: number, dy: number, zoom: number): { x: number; y: number };
  project(x: number, y: number, height: number, width: number, screenHeight: number): { x: number; y: number };
  actorHeight(id: string): number;
  dispose(): unknown;
}

export type ViewerActor = Readonly<{ id: string; heroId: string; label: string; x: number; y: number;
  hp: number; maxHp: number; alive: boolean; facing: number; team: string;
  kind: 'champion' | 'minion' | 'structure' | 'neutral' | 'ward'; subtype?:string;
  assetVariant?:'current'; motion?: ViewerMotion; shield?:number; controlled?:boolean; recalling?:boolean }>;
export type ViewerMotion = Readonly<{ state:string; stateSince?:number; vx:number; vy:number; attackTimer:number; attackReleased?:number;
  castStart?:number; castCommit?:number; castEnd?:number; hitAt?:number; knockup?:number }>;
export type ViewerArtSlot='passive'|'skill1'|'skill2'|'ultimate';
export type ViewerConstruct = Readonly<{id:string;kind:string;x:number;y:number;radius:number;angle:number;team:string;owner?:string;heroId?:string;slot?:ViewerArtSlot;
  hp:number;maxHp:number;created:number;expires:number;disabledUntil:number;attackable:boolean;
  points:readonly Readonly<{x:number;y:number}>[];arm?:number;safeY?:number}>;
export type ViewerEffect = Readonly<{ id:string;x:number;y:number;radius:number;color:string;kind:'projectile'|'zone'|'impact';
  angle?:number;halfWidth?:number;halfHeight?:number;sourceX?:number;sourceY?:number;originX?:number;originY?:number;age?:number;heroId?:string;slot?:ViewerArtSlot }>;
export type ViewerCue=Readonly<{id:string;actor:string;heroId:string;slot:ViewerArtSlot;tick:number}>;
export type ViewerSnapshot = Readonly<{ tick: number; second: number; actors: readonly ViewerActor[]; effects: readonly ViewerEffect[]; constructs?:readonly ViewerConstruct[];cues?:readonly ViewerCue[] }>;

/** Copy primitives only: meshes cannot retain or mutate authoritative objects. */
export function captureViewerSnapshot(frame: ArenaSceneFrame, previous?:ViewerSnapshot): ViewerSnapshot {
  const prior=new Map(previous&&previous.second<=frame.second?previous.actors.map(a=>[a.id,a]):[]);
  const heroByUnit=new Map(frame.champions.map(c=>[c.id,c.champion.id]));
  const slot=(value:string|undefined):ViewerArtSlot|undefined=>value&&['passive','skill1','skill2','ultimate'].includes(value)?value as ViewerArtSlot:undefined;
  const events=frame.v3?.events??[];
  const committed=events.filter(e=>e.type==='ability_committed');
  const commitByTick=new Map(committed.map(e=>[`${e.actor}:${e.tick}`,slot(e.reason)]));
  const actors: ViewerActor[] = [];
  for (const c of frame.champions) {
    const cast=frame.v3?.casts.find(cast=>cast.request.actor===c.id),old=prior.get(c.id);
    const state=c.isAlive?(c.animState??'idle'):'dead';
    const oldCast=old?.motion?.castEnd!==undefined&&old.motion.castCommit!==undefined&&old.motion.castCommit<=frame.second&&old.motion.castEnd>frame.second ? {castStart:old.motion.castStart,castCommit:old.motion.castCommit,castEnd:old.motion.castEnd} : {};
    actors.push({id:c.id,heroId:c.champion.id,label:c.player.name,
      x:c.x,y:c.y,hp:c.hp,maxHp:c.maxHp,alive:c.isAlive,facing:c.facing==='left'?-1:1,team:c.team,kind:'champion',
      assetVariant:c.champion.abilityRuleset?.startsWith('original-v3')?'current':undefined,
      shield:c.shield??0,controlled:(c.stunTimer??0)>0||(c.knockupTimer??0)>0,recalling:c.isRecalling??false,
      motion:Object.freeze({state,stateSince:old?.motion?.state===state?old.motion.stateSince??frame.second:frame.second,
        hitAt:old&&old.hp>c.hp?frame.second:old?.motion?.hitAt,vx:c.vx??0,vy:c.vy??0,attackTimer:c.attackTimer??0,
        attackReleased:c.basicAttackVisual?.releasedAt,knockup:c.knockupTimer??0,
        ...(cast?{castStart:cast.start/30,castCommit:cast.commit/30,castEnd:(cast.commit+cast.recovery)/30}:oldCast),
      })});
  }
  for (const [kind, units] of [['minion',frame.minions],['structure',frame.structures],
    ['neutral',[...frame.camps,frame.dragon]]] as const) {
    for (const u of units) actors.push({id:u.id,heroId:'',label:'',x:u.x,y:u.y,hp:u.hp,maxHp:u.maxHp,
      alive:u.isAlive,facing:('facingX' in u && u.facingX!==undefined)?Math.sign(u.facingX):1,team:'team' in u ? String(u.team) : 'neutral',kind,subtype:u.type??('siegeGolem' in u&&u.siegeGolem?'siege':''),
      motion:Object.freeze({state:u.isAlive?'idle':'dead',vx:0,vy:0,attackTimer:u.attackTimer??0})});
  }
  for(const u of frame.wards) actors.push({id:u.id,heroId:'',label:'',x:u.x,y:u.y,hp:1,maxHp:1,alive:true,facing:1,team:u.team,kind:'ward'});
  return Object.freeze({tick:Math.round(frame.second*30),second:frame.second,
    actors:Object.freeze(actors.map(a=>Object.freeze(a))),
    cues:Object.freeze(committed.filter(e=>e.tick<=Math.round(frame.second*30)&&Math.round(frame.second*30)-e.tick<20&&heroByUnit.has(e.actor)&&slot(e.reason)).map(e=>Object.freeze({id:e.id,actor:e.actor,heroId:heroByUnit.get(e.actor)!,slot:slot(e.reason)!,tick:e.tick}))),
    constructs:Object.freeze((frame.v3?.constructs??[]).filter(c=>c.hp>0&&c.expires>(frame.v3?.tick??0)).map(c=>Object.freeze({
      id:c.id,kind:c.kind,x:c.x,y:c.y,radius:c.radius,angle:c.angle,team:c.team,hp:c.hp,maxHp:c.maxHp,
      owner:c.owner,heroId:heroByUnit.get(c.owner),slot:commitByTick.get(`${c.owner}:${c.created}`),
      created:c.created,expires:c.expires,disabledUntil:c.disabledUntil,attackable:c.attackable!==false,
      points:Object.freeze(c.points.map(p=>Object.freeze({x:p.x,y:p.y}))),arm:c.roster?.arm??c.roster?.next,safeY:c.roster?.safeY,
    }))),effects:Object.freeze([
      ...frame.projectiles.map(p=>Object.freeze({id:p.id,x:p.x,y:p.y,radius:Math.max(2,p.size),color:p.color,angle:p.angle,kind:'projectile' as const,heroId:p.attackerId?heroByUnit.get(p.attackerId):undefined,slot:slot(p.abilitySlot)})),
      ...frame.spells.map(p=>Object.freeze({id:p.id,x:p.x,y:p.y,radius:p.radius,color:p.color,kind:'zone' as const,halfWidth:p.halfWidth,halfHeight:p.halfHeight,sourceX:p.sourceX,sourceY:p.sourceY,heroId:(p.visualSourceUnitId??p.sourceUnitId)?heroByUnit.get((p.visualSourceUnitId??p.sourceUnitId)!):undefined,slot:slot(p.abilitySlot)})),
      ...(frame.impacts??[]).map(p=>Object.freeze({id:p.id,x:p.x,y:p.y,radius:p.kind==='melee'?12:8,color:p.color,age:p.age,kind:'impact' as const,heroId:p.avatarId})),
      ...(frame.abilityHits??[]).filter(p=>frame.second>=p.second&&frame.second-p.second<.7).map(p=>Object.freeze({id:p.id,x:p.x,y:p.y,radius:p.slot==='ultimate'?34:24,color:'#fff0d0',age:frame.second-p.second,kind:'impact' as const,heroId:p.heroId,slot:p.slot,originX:p.originX,originY:p.originY})),
    ])});
}
