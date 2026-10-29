/** Original V3 preview kernel. State is serializable, time is integer 30 Hz ticks.
 * Generic mechanics live here; the live arena remains the damage/movement authority. */
import { V3_ROSTER_KEYS } from './v3RosterIdentity.ts';
import {ROSTER_DEFINITIONS,isRosterHero,validateRosterCast,commitRosterCast,stepRoster,
 rosterWalking,rosterProjectileCover,rosterProjectileRedirect,rosterProposals,rosterCompleted,rosterCastStarted,rosterConstructHit,rosterRequiredDevices,
 type RosterHero,type RosterKind,type RosterActor,type RosterData} from './v3Roster.ts';
export const V3_HZ=30;
export const v3Ticks=(seconds:number)=>Math.ceil(seconds*V3_HZ-1e-8);
export type V3Point={x:number;y:number};
export type V3Slot='skill1'|'skill2'|'ultimate';
export type V3Hero='lulla-faespring'|'mirelle-vane'|'mora-fenhook'|'vesper-nullcode'|'teslan-veyr'|RosterHero;
export const V3_PREVIEW_KEYS:Readonly<Record<string,V3Hero>>={c_puck:'lulla-faespring',c_invoker:'mirelle-vane',c_wraithhook:'mora-fenhook',c_nullweaver:'vesper-nullcode',c_raijin:'teslan-veyr',...V3_ROSTER_KEYS};
export interface V3Unit extends V3Point {id:string;team:'blue'|'red';hero?:V3Hero;hp:number;maxHp:number;mana:number;level:number;alive:boolean;controlled:boolean;shield:number;facing?:number;dashing?:boolean;unstoppable?:boolean;disabledSlots?:V3Slot[];cooldownOverrides?:Partial<Record<V3Slot,number>>}
export type V3Kind='chime'|'theater'|'pin'|'support'|'seam'|'shelter'|'pocket'|'bridge'|'pleat'|'serrated'|'hem'|'waltz'|'cutout'|'canopy'|'post'|'ferry'|'tangent'|'friction'|'orbit'|'rod'|'circuit'|'ground-hazard'|RosterKind;
export interface V3Construct extends V3Point {
  id:string;kind:V3Kind;owner:string;team:V3Unit['team'];created:number;expires:number;hp:number;maxHp:number;
  radius:number;points:V3Point[];supports:string[];angle:number;charges:number;disabledUntil:number;
  hit:string[];progress:Record<string,number>;passengers:string[];capacity:number;arrivalShield:number;
  heldProjectile?:string;hazardId?:string;polarity?:'repel'|'conduct';polarityUntil?:number;
  attackable?:boolean;roster?:RosterData;
}
export interface V3Request {actor:string;slot:V3Slot;point:V3Point;target?:string;object?:string;page?:number;direction?:1|-1;polarity?:'repel'|'conduct'}
export type V3ManualInput={kind:'page';actor:string;page:number}|{kind:'cast';request:V3Request}|{kind:'route';actor:string;object:string}|{kind:'letter';actor:string;object:string;recipient:string};
export interface V3Cast {id:string;request:V3Request;start:number;commit:number;recovery:number;cost:number}
export interface V3ActorState {
  hero?:V3Hero;
  cooldowns:Record<V3Slot,number>;charges:number;nextCharge:number;page:number;pageCooldowns:number[];weaveUntil:number;
  recoveryUntil:number;windupTaxUntil:number;notes:Record<string,{count:number;expires:number}>;
  yawn?:{source:string;expires:number};taxHistory:{tick:number;seconds:number;cleared?:boolean}[];momentum:number;capacitors:number;fare:number;
  observed:Record<string,{point:V3Point;heading:number;distance:number;vx?:number;vy?:number}>;
  roster?:RosterActor;
}
export interface V3Event {id:string;tick:number;type:string;actor:string;target?:string;object?:string;value?:number;reason?:string}
export interface V3World {version:1;tick:number;serial:number;constructs:V3Construct[];casts:V3Cast[];actors:Record<string,V3ActorState>;events:V3Event[];completed:string[];counters:Record<string,number>;escapeCorridor?:{y:number;expires:number};inputJournal?:(V3ManualInput&{tick:number})[]}
export interface V3Environment {units:V3Unit[];legalPoint:(p:V3Point)=>boolean;legalSegment:(a:V3Point,b:V3Point)=>boolean;
  battlefieldTargets?:readonly V3BattlefieldTarget[];
  damageBattlefield?:(source:V3Unit,target:V3BattlefieldTarget,amount:number,slot:V3Slot)=>void;
  legalTravel?:(from:V3Point,to:V3Point)=>boolean;
  projectiles?:readonly V3Projectile[];
  visible:(viewer:V3Unit,target:V3Unit)=>boolean;
  damage:(source:V3Unit,target:V3Unit,amount:number,slot:V3Slot,context?:V3DamageContext)=>void;
  slow?:(target:V3Unit,amount:number,seconds:number)=>void;
  heal?:(target:V3Unit,amount:number)=>void;
  nonlethalCost?:(target:V3Unit,amount:number)=>void;
  reveal?:(target:V3Unit,seconds:number)=>void;
  control?:(source:V3Unit,target:V3Unit,seconds:number)=>void;
}
export interface V3BattlefieldTarget extends V3Point {id:string;team:'blue'|'red'|'neutral';kind:'minion'|'structure'|'camp'|'dragon';hp:number;alive:boolean}
export interface V3DamageContext {basic?:boolean;direct?:boolean;area?:boolean;overhead?:boolean;ultimate?:boolean;triggered?:boolean;nonlethal?:boolean}
export const createV3World=():V3World=>({version:1,tick:0,serial:0,constructs:[],casts:[],actors:{},events:[],completed:[],counters:{}});
export const v3Distance=(a:V3Point,b:V3Point)=>Math.hypot(a.x-b.x,a.y-b.y);
export function v3Actor(w:V3World,id:string):V3ActorState {
  return w.actors[id]??= {cooldowns:{skill1:0,skill2:0,ultimate:0},charges:3,nextCharge:0,page:1,pageCooldowns:Array(10).fill(0),weaveUntil:0,
    recoveryUntil:0,windupTaxUntil:0,notes:{},taxHistory:[],momentum:0,capacitors:0,fare:0,observed:{}};
}
export const emit=(w:V3World,type:string,actor:string,extra:Partial<V3Event>={})=>{
  const event={id:`v3-event:${++w.serial}`,tick:w.tick,type,actor,...extra};w.events.push(event);
  w.counters[type]=(w.counters[type]??0)+1;if(w.events.length>2000)w.events.shift();return event;
};
const unit=(e:V3Environment,id:string)=>e.units.find(u=>u.id===id);
export const owned=(w:V3World,id:string,kind:V3Kind)=>w.constructs.filter(c=>c.owner===id&&c.kind===kind&&c.hp>0&&c.expires>w.tick&&c.disabledUntil<=w.tick);
const capacity=(hero?:V3Hero)=>hero==='mirelle-vane'?3:isRosterHero(hero)?ROSTER_DEFINITIONS[hero].charges??2:2;
const charged=(hero?:V3Hero)=>isRosterHero(hero)?!!ROSTER_DEFINITIONS[hero].charges:hero!=='vesper-nullcode';
function configure(w:V3World,u:V3Unit){const a=v3Actor(w,u.id);if(u.hero&&!a.hero){a.hero=u.hero;a.charges=capacity(u.hero);}return a;}
export function v3LineDistance(p:V3Point,a:V3Point,b:V3Point){const dx=b.x-a.x,dy=b.y-a.y,n=dx*dx+dy*dy;
  const t=n?Math.max(0,Math.min(1,((p.x-a.x)*dx+(p.y-a.y)*dy)/n)):0;return Math.hypot(p.x-a.x-t*dx,p.y-a.y-t*dy);}
const side=(p:V3Point,a:V3Point,b:V3Point)=>(b.x-a.x)*(p.y-a.y)-(b.y-a.y)*(p.x-a.x);
export function v3Crosses(a:V3Point,b:V3Point,c:V3Point,d:V3Point){
  const before=side(a,c,d);return v3Distance(a,b)>.001&&before!==0&&before*side(b,c,d)<=0&&side(c,a,b)*side(d,a,b)<=0;
}
export function v3InsideTriangle(p:V3Point,points:readonly V3Point[]){if(points.length!==3)return false;
  const a=side(p,points[0],points[1]),b=side(p,points[1],points[2]),c=side(p,points[2],points[0]);return (a>=0&&b>=0&&c>=0)||(a<=0&&b<=0&&c<=0);}
export function spawn(w:V3World,u:V3Unit,kind:V3Kind,p:V3Point,seconds:number,options:Partial<V3Construct>={}){
  const attackable=options.attackable??['chime','pin','support','post','rod'].includes(kind);
  if(w.constructs.length>=256||attackable&&w.constructs.filter(c=>c.team===u.team&&c.hp>0&&c.attackable!==false).length>=16)return;
  const c:V3Construct={id:`v3-object:${++w.serial}`,owner:u.id,team:u.team,kind,x:p.x,y:p.y,created:w.tick,expires:w.tick+v3Ticks(seconds),hp:2,maxHp:2,
    radius:12,points:[],supports:[],angle:0,charges:1,disabledUntil:0,hit:[],progress:{},passengers:[],capacity:0,arrivalShield:0,attackable,...options};
  w.constructs.push(c);emit(w,'construct_placed',u.id,{object:c.id,reason:kind});return c;
}
export function damageV3Construct(w:V3World,e:V3Environment,attackerId:string,id:string){
  const a=unit(e,attackerId),c=w.constructs.find(c=>c.id===id&&c.hp>0);if(!a?.alive||a.controlled||!c||a.team===c.team||v3Distance(a,c)>250)return false;
  c.hp=Math.max(0,c.hp-1);rosterConstructHit(w,e,a,c);emit(w,c.hp?'construct_damaged':'construct_destroyed',attackerId,{object:id,value:c.hp});return true;
}
export const V3_PAGE_COOLDOWNS=[16,22,28,32,38,24,26,40,35,90] as const;
export const V3_PAGE_NAMES=['Baste Line','Pocket Shelter','Held Breath','Ladder Stitch','Pleat Fold','Serrated Seam','Wrong-Side Hem','Tacking Waltz','Silhouette Dress','Grand Atelier'] as const;
const pagePins=[2,1,2,2,3,2,2,3,1,3];
export function selectV3Page(w:V3World,id:string,page:number){if(!Number.isInteger(page)||page<1||page>10)return false;
  v3Actor(w,id).page=page;emit(w,'pattern_selected',id,{value:page});
  for(const c of owned(w,id,'cutout')){c.progress.fakePage=page;emit(w,'fake_windup_announced',id,{object:c.id,value:page,reason:V3_PAGE_NAMES[page-1]});}
  return true;}
export function cycleV3PageGroup(w:V3World,id:string){const page=v3Actor(w,id).page;
  return selectV3Page(w,id,page<4?4:page<7?7:page<10?10:1);}
function castDefinition(u:V3Unit,slot:V3Slot,page:number){
  const cds:Partial<Record<V3Hero,readonly number[]>>={'lulla-faespring':[8,13,90],'mirelle-vane':[5,10,7],'mora-fenhook':[8,13,86],'vesper-nullcode':[8,13,93],'teslan-veyr':[8,12,80]};
  const i=['skill1','skill2','ultimate'].indexOf(slot);
  const authored=isRosterHero(u.hero)?ROSTER_DEFINITIONS[u.hero].cooldowns:cds[u.hero!];
  const adjustment=rosterWindup(u.hero,slot);
  return {cooldown:u.cooldownOverrides?.[slot]??authored![i],cost:slot==='ultimate'?(u.hero==='mirelle-vane'&&page!==10?45:80):slot==='skill1'?30:35,
    windup:adjustment??(slot==='ultimate'?(u.hero==='teslan-veyr'?.75:u.hero==='mirelle-vane'&&page===10?1:.5):slot==='skill2'&&u.hero==='mirelle-vane'?.4:.35),recovery:.25};
}
function rosterWindup(hero:V3Hero|undefined,slot:V3Slot){
 if(!isRosterHero(hero))return;
 // These casts install their own public delayed activation; don't double-delay.
 if(slot==='ultimate'&&['talan-slipshot','axiom-rail','pippa-fuseburst','ravelle-skyrake','bramm-coil','mourn-ashwake','astrax-mire'].includes(hero))return .35;
 if(slot==='skill2'&&['thalara-rootwright','bryx-emberkite'].includes(hero))return .5;
 if(slot==='skill2'&&['sevrin-inkseal','pippa-fuseburst','koro-cloudtail'].includes(hero))return .45;
 return slot==='ultimate'?.5:.35;
}
function validate(w:V3World,e:V3Environment,r:V3Request):string|undefined {
  if(!['skill1','skill2','ultimate'].includes(r.slot)||!r.point)return 'invalid-request';
  const u=unit(e,r.actor);if(!u?.hero||!u.alive)return 'actor-unavailable';if(u.controlled)return 'hard-control';if(u.disabledSlots?.includes(r.slot))return 'ability-disabled';
  if(v3Passenger(w,u.id))return 'in-transport';
  if(!Number.isFinite(r.point.x)||!Number.isFinite(r.point.y)||!e.legalPoint(r.point)||!(u.hero==='talan-slipshot'&&r.slot==='ultimate')&&!e.legalSegment(u,r.point))return 'illegal-ground-or-path';
  if(v3Distance(u,r.point)>150)return 'out-of-range';
  const a=v3Actor(w,u.id),target=r.target?unit(e,r.target):undefined;
  if(target&&(!target.alive||!e.visible(u,target)))return 'target-unavailable';
  const rosterFailure=validateRosterCast(w,e,u,r);if(rosterFailure)return rosterFailure;
  if(u.hero==='lulla-faespring'&&r.slot==='skill2'&&(!target||target.team===u.team||v3Distance(u,target)>130||(a.notes[target.id]?.count??0)<1))return 'drowse-required';
  if(u.hero==='mirelle-vane'){
    if(r.slot==='skill2'){const pin=owned(w,u.id,'pin').find(p=>p.id===r.object);if(!pin||v3Distance(pin,r.point)>40||!e.legalSegment(pin,r.point))return 'pin-required';}
    if(r.slot==='ultimate'){
      const page=r.page??a.page;if(!Number.isInteger(page)||page<1||page>10)return 'invalid-page';
      if(a.weaveUntil>w.tick||a.pageCooldowns[page-1]>w.tick)return 'page-cooldown';
      const pins=owned(w,u.id,'pin').slice(0,pagePins[page-1]);if(pins.length<pagePins[page-1])return 'pin-count';
      if(pins.some(p=>v3Distance(p,u)>150)||pins.some((p,i)=>pins.some((q,j)=>j>i&&!e.legalSegment(p,q))))return 'pin-layout';
      if(pins.length===3&&Math.abs(side(pins[2],pins[0],pins[1]))<200)return 'degenerate-triangle';
      if(page===2&&(!target||target.team!==u.team||v3Distance(pins[0],target)>60))return 'ally-near-pin-required';
      if(page===4&&(v3Distance(pins[0],pins[1])>80||!w.constructs.some(c=>c.team!==u.team&&c.kind==='ground-hazard'&&v3LineDistance(c,pins[0],pins[1])<=c.radius)))return 'temporary-hazard-required';
    }
  }
  if(u.hero==='mora-fenhook'&&r.slot==='skill2'){
    const posts=owned(w,u.id,'post');if(posts.length!==2||v3Distance(posts[0],posts[1])<40||!e.legalSegment(posts[0],posts[1]))return 'linked-posts-required';
  }
  if(u.hero==='mora-fenhook'&&r.slot==='ultimate'&&v3Distance(u,r.point)<40)return 'distinct-emergency-docks-required';
  if(u.hero==='vesper-nullcode'&&r.slot==='ultimate'&&a.momentum<1)return 'momentum-required';
  if(u.hero==='teslan-veyr'&&r.slot!=='skill1'&&!owned(w,u.id,'circuit').length)return 'circuit-required';
  if(u.hero==='teslan-veyr'&&r.slot==='ultimate'&&a.capacitors<1)return 'capacitor-required';
  const limit=isRosterHero(u.hero)?150:u.hero==='teslan-veyr'?140:u.hero==='mora-fenhook'?115:125;
  if(r.slot==='skill1'&&v3Distance(u,r.point)>limit)return 'out-of-range';
  if(r.slot==='skill1'&&a.charges<=0)return 'no-charges';return;
}
export function requestV3Cast(w:V3World,e:V3Environment,request:V3Request){
  const r=structuredClone(request),u=unit(e,r.actor),a=v3Actor(w,r.actor);
  if(u)configure(w,u);
  if(u?.hero==='mirelle-vane'&&r.slot==='skill2'&&!r.object)return cycleV3PageGroup(w,u.id);
  let reason=validate(w,e,r);if(!reason&&(w.casts.some(c=>c.request.actor===r.actor)||a.recoveryUntil>w.tick))reason='cast-or-recovery';
  if(!reason&&a.cooldowns[r.slot]>w.tick)reason='cooldown';if(!reason&&r.slot==='ultimate'&&u!.level<6)reason='level';
  if(reason){emit(w,'ability_failed',r.actor,{reason});return false;}
  const d=castDefinition(u!,r.slot,r.page??a.page);if(u!.mana<d.cost){emit(w,'ability_failed',r.actor,{reason:'mana'});return false;}
  if(r.slot==='ultimate'&&u!.hero==='mirelle-vane')r.page??=a.page;
  const taxed=a.windupTaxUntil>w.tick;
  const windup=Math.max(.2,d.windup-(u!.hero==='mora-fenhook'&&r.slot!=='skill1'?a.fare*.15:0))+(taxed?.5:0);
  if(taxed){a.windupTaxUntil=0;emit(w,'windup_delay_added',u!.id,{value:.5});}
  if(u!.hero==='mirelle-vane'&&r.slot==='ultimate'&&r.page!==a.page)selectV3Page(w,u!.id,r.page!);
  const id=`v3-cast:${++w.serial}`;w.casts.push({id,request:r,start:w.tick,commit:w.tick+v3Ticks(windup),recovery:v3Ticks(d.recovery),cost:d.cost});
  rosterCastStarted(w,e,u!,r,w.tick+v3Ticks(windup));
  emit(w,'ability_started',u!.id,{object:id,reason:r.slot});return true;
}
function commit(w:V3World,e:V3Environment,cast:V3Cast){
  const r=cast.request,u=unit(e,r.actor);
  if(!u?.hero){emit(w,'ability_failed',r.actor,{object:cast.id,reason:'actor-despawned'});return;}
  const a=configure(w,u),d=castDefinition(u,r.slot,r.page??a.page);
  const required=isRosterHero(u.hero)?rosterRequiredDevices(u.hero,r.slot):u.hero==='mora-fenhook'&&r.slot==='ultimate'?2:r.slot==='skill1'||u.hero==='lulla-faespring'&&r.slot==='ultimate'?1:0;
  const failure=validate(w,e,r)??(u.mana<cast.cost?'mana-changed':w.constructs.filter(c=>c.team===u.team&&c.hp>0&&c.attackable!==false).length+required>16?'team-construct-cap':w.constructs.length>240?'effect-cap':undefined);
  if(failure){emit(w,'ability_failed',r.actor,{object:cast.id,reason:failure});return;}
  u.mana-=cast.cost;a.cooldowns[r.slot]=w.tick+v3Ticks(d.cooldown);
  if(r.slot==='skill1'&&charged(u.hero)){a.charges--;a.cooldowns.skill1=0;if(!a.nextCharge)a.nextCharge=w.tick+v3Ticks(d.cooldown);}
  emit(w,'ability_committed',u.id,{object:cast.id,reason:r.slot});
  if(isRosterHero(u.hero))commitRosterCast(w,e,u,r);
  else if(u.hero==='lulla-faespring'){
    if(r.slot==='skill1'){
      const prior=owned(w,u.id,'chime');
      if(prior.length>=2)prior[0].hp=0;spawn(w,u,'chime',r.point,5,{radius:95});
    }else if(r.slot==='skill2'){
      a.notes[r.target!].count--;v3Actor(w,r.target!).yawn={source:u.id,expires:w.tick+90};
    }else{
      const prior=owned(w,u.id,'chime');if(prior.length>=2)prior[0].hp=0;
      const center=spawn(w,u,'chime',r.point,4,{radius:12})!;
      spawn(w,u,'theater',r.point,4,{radius:135,supports:[center.id]});
    }
  }else if(u.hero==='mirelle-vane'){
    if(r.slot==='skill1'){
      const pins=owned(w,u.id,'pin');if(pins.length>=3)pins[0].hp=0;
      spawn(w,u,'pin',r.point,6);const target=e.units.find(t=>t.alive&&t.team!==u.team&&v3Distance(t,r.point)<=18);
      if(target)e.damage(u,target,35,'skill1');
    }else if(r.slot==='skill2'){
      const pin=owned(w,u.id,'pin').find(c=>c.id===r.object)!;
      for(const target of e.units.filter(t=>t.alive&&t.team!==u.team&&v3LineDistance(t,pin,r.point)<=16))e.damage(u,target,40,'skill2');
      Object.assign(pin,r.point);emit(w,'construct_repositioned',u.id,{object:pin.id});
    }else{
      const page=r.page!,pins=owned(w,u.id,'pin').slice(0,pagePins[page-1]);
      const kinds:V3Kind[]=['seam','shelter','pocket','bridge','pleat','serrated','hem','waltz','cutout','canopy'];
      const duration=[3,2,2.2,3,2.5,2.4,2.5,3,3.5,4][page-1];
      const hazard=page===4?w.constructs.find(c=>c.kind==='ground-hazard'&&c.team!==u.team&&v3LineDistance(c,pins[0],pins[1])<=c.radius):undefined;
      const field=spawn(w,u,kinds[page-1],pins[0],duration,{points:pins.map(p=>({x:p.x,y:p.y})),supports:pins.map(p=>p.id),
        angle:Math.atan2(r.point.y-pins[0].y,r.point.x-pins[0].x),radius:page===2?30:12,hazardId:hazard?.id})!;
      if(page===2){const ally=unit(e,r.target!)!;field.x=ally.x;field.y=ally.y;field.points=[];}
      if(page===5){const pairs=[[0,1,2],[1,2,0],[2,0,1]].sort((a,b)=>v3Distance(pins[b[0]],pins[b[1]])-v3Distance(pins[a[0]],pins[a[1]]));field.points=pairs[0].map(i=>({x:pins[i].x,y:pins[i].y}));}
      for(const pin of pins){pin.kind='support';pin.expires=field.expires;emit(w,'pin_consumed',u.id,{object:pin.id});}
      a.pageCooldowns[page-1]=w.tick+v3Ticks(V3_PAGE_COOLDOWNS[page-1]);a.weaveUntil=w.tick+210;
    }
  }else if(u.hero==='mora-fenhook'){
    if(r.slot==='skill1'){
      const posts=owned(w,u.id,'post');if(posts.length>=2)posts[0].hp=0;spawn(w,u,'post',r.point,7);
    }else{
      let posts=owned(w,u.id,'post');
      if(r.slot==='ultimate'){
        // Both emergency docks are previewed and validated before spending resources.
        posts=[spawn(w,u,'post',u,3)!,spawn(w,u,'post',r.point,3)!];
      }
      spawn(w,u,'ferry',posts[0],2.3,{points:posts.map(p=>({x:p.x,y:p.y})),supports:posts.map(p=>p.id),capacity:r.slot==='ultimate'?2:1,arrivalShield:r.slot==='ultimate'?100:0});
      a.fare=0;
    }
  }else if(u.hero==='vesper-nullcode'){
    if(r.slot==='skill1')spawn(w,u,'tangent',r.point,3,{radius:30,angle:(r.direction??1)*Math.PI/9});
    else if(r.slot==='skill2')spawn(w,u,'friction',r.point,3,{radius:65});
    else {spawn(w,u,'orbit',r.point,4,{radius:145,angle:r.direction??1});a.momentum=0;}
  }else if(u.hero==='teslan-veyr'){
    if(r.slot==='skill1'){
      const rods=owned(w,u.id,'rod');if(rods.length>=2)rods[0].hp=0;
      const rod=spawn(w,u,'rod',r.point,7)!;const previous=owned(w,u.id,'rod').find(c=>c.id!==rod.id);
      if(previous){previous.expires=rod.expires=w.tick+90;
        spawn(w,u,'circuit',previous,3,{points:[{x:previous.x,y:previous.y},{x:rod.x,y:rod.y}],supports:[previous.id,rod.id]});a.capacitors=Math.min(2,a.capacitors+1);}
    }else if(r.slot==='skill2')for(const c of owned(w,u.id,'circuit')){
      c.polarity=r.polarity??(c.polarity==='repel'?'conduct':'repel');c.polarityUntil=w.tick+75;emit(w,'polarity_changed',u.id,{object:c.id,reason:c.polarity});
    }else{
      for(const circuit of owned(w,u.id,'circuit')){
        for(const target of e.units.filter(t=>t.team!==u.team&&t.alive&&v3LineDistance(t,circuit.points[0],circuit.points[1])<=20))v3Actor(w,target.id).windupTaxUntil=w.tick+90;
        for(const c of w.constructs.filter(c=>c.team!==u.team&&v3LineDistance(c,circuit.points[0],circuit.points[1])<=20))c.disabledUntil=w.tick+45;
      }a.capacitors=0;
    }
  }
  completedV3Ability(w,e,u.id,cast.id,d.recovery,r.slot,r.point);
}
export function stepV3Combat(w:V3World,e:V3Environment,tick:number){
  if(!Number.isInteger(tick)||tick!==w.tick+1)throw Error('V3 requires consecutive authoritative 30 Hz ticks');w.tick=tick;
  for(const u of e.units){const a=configure(w,u);
    for(const [id,n] of Object.entries(a.notes))if(n.expires<=tick)delete a.notes[id];
    if(a.yawn&&a.yawn.expires<tick)delete a.yawn;
    if(a.nextCharge&&tick>=a.nextCharge){a.charges=Math.min(capacity(u.hero),a.charges+1);a.nextCharge=a.charges<capacity(u.hero)?tick+v3Ticks(castDefinition(u,'skill1',a.page).cooldown):0;}
    if(u.hero&&u.alive){
      for(const enemy of e.units.filter(t=>t.team!==u.team&&t.alive&&v3Distance(u,t)<=180&&e.visible(u,t))){
        const old=a.observed[enemy.id],distance=old?v3Distance(old.point,enemy):0;
        const heading=old&&distance>0?Math.atan2(enemy.y-old.point.y,enemy.x-old.point.x):old?.heading??0;
        const delta=old?Math.atan2(Math.sin(heading-old.heading),Math.cos(heading-old.heading)):0;
        const traveled=(Math.abs(delta)<Math.PI/18?old?.distance??0:0)+distance;
        a.observed[enemy.id]={point:{x:enemy.x,y:enemy.y},heading,distance:traveled>=45?0:traveled,
          vx:old?(enemy.x-old.point.x)*30:0,vy:old?(enemy.y-old.point.y)*30:0};
        if(u.hero==='vesper-nullcode'&&traveled>=45){a.momentum=Math.min(4,a.momentum+1);emit(w,'momentum_observed',u.id,{target:enemy.id,value:a.momentum});}
      }
      for(const id of Object.keys(a.observed))if(!e.units.some(t=>t.id===id&&t.alive&&e.visible(u,t)&&v3Distance(u,t)<=180))delete a.observed[id];
    }
  }
  // Destruction takes effect before casts and before transport. No orphan passenger.
  for(const c of w.constructs){
    if(c.supports.some(id=>!w.constructs.some(s=>s.id===id&&s.hp>0&&s.expires>tick)))c.hp=0;
    if(c.kind==='ferry'){
      const t=Math.min(1,(tick-c.created)/(c.expires-c.created)),a=c.points[0],b=c.points[1];
      const next={x:a.x+(b.x-a.x)*t,y:a.y+(b.y-a.y)*t};
      const enabled=c.disabledUntil<=tick&&c.supports.every(id=>w.constructs.some(s=>s.id===id&&s.disabledUntil<=tick));
      const valid=c.hp>0&&enabled&&e.legalSegment(c,next)&&e.legalPoint(next);
      if(!enabled)c.hp=0; // Interrupted journeys end at the last legal passenger position.
      if(valid)Object.assign(c,next);
      for(const id of [...c.passengers]){
        const passenger=unit(e,id);if(!passenger?.alive){c.passengers=c.passengers.filter(p=>p!==id);continue;}
        if(valid&&!passenger.controlled)Object.assign(passenger,{x:c.x,y:c.y});
        if(!valid||t>=1||passenger.controlled){
          const arrived=valid&&t>=1&&!passenger.controlled;
          if(arrived&&passenger.team===c.team){const owner=unit(e,c.owner);if(owner?.alive)v3Actor(w,c.owner).fare=Math.min(2,v3Actor(w,c.owner).fare+1);passenger.shield=Math.max(passenger.shield,Math.min(passenger.maxHp*.4,passenger.shield+c.arrivalShield));}
          c.passengers=c.passengers.filter(p=>p!==id);emit(w,arrived?'ferry_arrived':'ferry_cancelled',id,{object:c.id});
        }
      }
    }
  }
  stepRoster(w,e);
  w.constructs=w.constructs.filter(c=>c.hp>0&&c.expires>tick);
  const ready=w.casts.filter(c=>c.commit<=tick);w.casts=w.casts.filter(c=>c.commit>tick);
  for(const cast of ready)commit(w,e,cast);
  for(const cast of [...w.casts])if(!unit(e,cast.request.actor)?.alive||unit(e,cast.request.actor)?.controlled){
    w.casts=w.casts.filter(c=>c.id!==cast.id);emit(w,'ability_failed',cast.request.actor,{object:cast.id,reason:'interrupted-before-commit'});
  }
}
export function acceptV3Ferry(w:V3World,e:V3Environment,id:string,ferryId:string,consent:boolean){
  const u=unit(e,id),f=w.constructs.find(c=>c.id===ferryId&&c.kind==='ferry'&&active(w,c));
  if(!consent||!u?.alive||u.controlled||w.casts.some(c=>c.request.actor===id)||!f||f.passengers.length>=f.capacity||v3Distance(u,f)>20||w.constructs.some(c=>c.passengers.includes(id)))return false;
  f.passengers.push(id);emit(w,'ferry_boarded',id,{object:f.id});return true;
}
export function leaveV3Ferry(w:V3World,id:string){for(const c of w.constructs)if(c.passengers.includes(id)){
  c.passengers=c.passengers.filter(p=>p!==id);emit(w,'ferry_cancelled',id,{object:c.id,reason:'voluntary-disembark'});return true;}return false;}
export function v3Passenger(w:V3World,id:string){return w.constructs.some(c=>(c.kind==='ferry'||c.kind==='vault-transit')&&c.hp>0&&c.expires>w.tick&&c.passengers.includes(id));}
export const active=(w:V3World,c:V3Construct)=>c.hp>0&&c.expires>w.tick&&c.disabledUntil<=w.tick
  &&c.supports.every(id=>w.constructs.some(s=>s.id===id&&s.hp>0&&s.expires>w.tick&&s.disabledUntil<=w.tick));
/** Modify only an actual requested step. Standing still stays still. Final terrain
 * projection is still owned by the existing arena collision resolver. */
export function v3Walking(w:V3World,e:V3Environment,u:V3Unit,from:V3Point,to:V3Point,dash=false):V3Point {
  let dx=to.x-from.x,dy=to.y-from.y;const original=Math.hypot(dx,dy);if(original<.0001)return {...to};
  for(const c of w.constructs.filter(c=>active(w,c))){
    const hostile=c.team!==u.team;
    if(hostile&&c.kind==='friction'&&v3Distance(from,c)<=c.radius){dx*=dash?.8:.9;dy*=dash?.8:.9;}
    const inside=v3Distance(from,c)<=c.radius;
    const crossed=c.points.length>=2&&v3Crosses(from,to,c.points[0],c.points[1]);
    const tile=hostile&&c.kind==='tangent'&&inside&&!c.hit.includes(u.id);
    if(tile||hostile&&c.kind==='orbit'&&inside){
      const angle=tile?c.angle:c.angle*25*Math.PI/180/V3_HZ;
      const x=dx*Math.cos(angle)-dy*Math.sin(angle);dy=dx*Math.sin(angle)+dy*Math.cos(angle);dx=x;
      if(tile)c.hit.push(u.id);emit(w,'movement_modified',u.id,{object:c.id,value:angle});
    }
    if(crossed&&hostile&&['seam','serrated','circuit'].includes(c.kind)&&!c.hit.includes(u.id)&&!(c.kind==='seam'&&c.hit.length)){
      const pulse=c.kind!=='serrated'||[0,24,48].some(beat=>Math.abs(w.tick-c.created-beat)<=4);
      if(pulse){c.hit.push(u.id);const source=unit(e,c.owner);if(source?.alive)e.damage(source,u,c.kind==='circuit'?55:c.kind==='seam'?40:85,'ultimate');
        if(c.kind==='seam')e.slow?.(u,.2,1);}
    }
    if(!hostile&&c.kind==='hem'&&c.points.length===2){
      const direction=(dx*(c.points[1].x-c.points[0].x)+dy*(c.points[1].y-c.points[0].y));
      if(direction>0&&!c.hit.includes(u.id)&&v3LineDistance(from,c.points[0],c.points[1])<20){c.hit.push(u.id);c.progress[u.id]=w.tick+30;emit(w,'route_speed',u.id,{object:c.id,value:.15});}
      if(direction>0&&(c.progress[u.id]??0)>w.tick){dx*=1.15;dy*=1.15;}
    }
    if(!hostile&&c.kind==='waltz'&&!c.hit.includes(u.id)){
      const next=c.progress[u.id]??0;
      if(v3LineDistance(c.points[next],from,to)<=18){c.progress[u.id]=next+1;
        if(next===2){c.hit.push(u.id);const before=u.shield;u.shield=Math.max(before,Math.min(u.maxHp*.4,u.shield+100));emit(w,'shield_applied',u.id,{object:c.id,value:u.shield-before});}}
    }
  }
  const length=Math.hypot(dx,dy),cap=original*1.15;if(length>cap){dx*=cap/length;dy*=cap/length;}
  const next={x:from.x+dx,y:from.y+dy};
  const legal=e.legalPoint(next)&&e.legalSegment(from,next)?next:{...from};
  return rosterWalking(w,e,u,from,legal,dash);
}
export function v3DamageMultiplier(w:V3World,target:V3Unit,source:V3Point,groundHazardId?:string){
  let factor=1;
  for(const c of w.constructs.filter(c=>c.team===target.team&&active(w,c))){
    if(c.kind==='canopy'&&v3InsideTriangle(target,c.points)&&!v3InsideTriangle(source,c.points)){
      const incoming=Math.atan2(source.y-target.y,source.x-target.x);
      if(Math.cos(incoming-c.angle)>0)factor=Math.min(factor,.85);
    }
    if(c.kind==='bridge'&&c.hazardId===groundHazardId&&c.points.length===2&&v3LineDistance(target,c.points[0],c.points[1])<18)factor=Math.min(factor,.5);
  }return factor;
}
export interface V3Projectile extends V3Point {id:string;team:V3Unit['team'];vx:number;vy:number;damage:number;ultimate:boolean;consenting:boolean;redirected:boolean;heldUntil?:number;owner?:string;homing?:boolean;overhead?:boolean;physical?:boolean;utility?:boolean;rangeScale?:number}
/** This is the single interception/deflection order for V3 interactions. The
 * caller applies damage only after pass; a held projectile keeps its own team,
 * heading and damage, and cannot enter another pocket after release. */
export function v3Projectile(w:V3World,e:V3Environment,p:V3Projectile,end:V3Point):'pass'|'held'|'blocked' {
  if(!e.legalSegment(p,end)){emit(w,'projectile_wall',p.id);return 'blocked';}
  if((p.heldUntil??0)>w.tick)return 'held';
  if(rosterProjectileCover(w,e,p,end))return 'blocked';
  for(const c of w.constructs.filter(c=>active(w,c))){
    const crossing=c.points.length>=2?v3Crosses(p,end,c.points[0],c.points[1]):v3LineDistance(c,p,end)<=c.radius;
    if(!crossing)continue;
    if(c.team!==p.team&&c.charges>0&&(c.kind==='shelter'||c.kind==='pleat')){
      const frontal=Math.cos(Math.atan2(-p.vy,-p.vx)-c.angle)>0;
      if(frontal){c.charges--;emit(w,'projectile_intercepted',c.owner,{object:c.id,value:p.damage});return 'blocked';}
    }
  }
  for(const c of w.constructs.filter(c=>active(w,c))){
    const crossing=c.points.length>=2&&v3Crosses(p,end,c.points[0],c.points[1]);if(!crossing)continue;
    if(c.kind==='pocket'&&c.team===p.team&&p.consenting&&!p.ultimate&&!c.heldProjectile&&p.heldUntil===undefined){
      c.heldProjectile=p.id;p.heldUntil=w.tick+21;emit(w,'projectile_held',c.owner,{object:p.id,value:.7});return 'held';
    }
    if(c.kind==='circuit'&&c.polarity==='repel'&&(c.polarityUntil??0)>w.tick&&c.team!==p.team&&!p.redirected){
      const angle=8*Math.PI/180,x=p.vx*Math.cos(angle)-p.vy*Math.sin(angle);
      p.vy=p.vx*Math.sin(angle)+p.vy*Math.cos(angle);p.vx=x;p.redirected=true;
      emit(w,'projectile_redirected',c.owner,{object:p.id,value:angle});
    }
  }rosterProjectileRedirect(w,e,p,end);return 'pass';
}
export function v3AttackSpeed(w:V3World,u:V3Unit){return w.constructs.some(c=>active(w,c)&&c.team===u.team&&c.kind==='circuit'&&c.polarity==='conduct'&&(c.polarityUntil??0)>w.tick&&v3LineDistance(u,c.points[0],c.points[1])<25)?1.1:1;}
export interface V3Choice {request?:V3Request;intent:'prepare'|'read'|'commit'|'hold'|'followup'|'reposition'|'escape'|'cancel';reason:string;utility:number}
/** Bounded public-state candidates, distinct preparation/commit requirements.
 * Full multi-horizon tactical planning is tracked separately from these scorers. */
export function chooseV3Ability(w:V3World,e:V3Environment,u:V3Unit):V3Choice {
  const a=configure(w,u),enemies=e.units.filter(t=>t.team!==u.team&&t.alive&&v3Distance(t,u)<250&&e.visible(u,t));
  if(!u.alive||u.controlled)return {intent:'cancel',reason:'unavailable',utility:0};
  if(w.casts.some(c=>c.request.actor===u.id)||a.recoveryUntil>w.tick)return {intent:'hold',reason:'committed-cast-or-recovery',utility:0};
  if(!enemies.length)return {intent:'hold',reason:'no-visible-combat-value',utility:0};
  const enemy=[...enemies].sort((a,b)=>v3Distance(u,a)-v3Distance(u,b))[0],dir=u.team==='blue'?1:-1;
  const clampPoint=(target:V3Point,range:number)=>{const distance=v3Distance(u,target),scale=Math.min(1,range/Math.max(1,distance));return {x:u.x+(target.x-u.x)*scale,y:u.y+(target.y-u.y)*scale};};
  const proposals:{request:V3Request;utility:number;reason:string;intent:V3Choice['intent']}[]=[];
  const add=(slot:V3Slot,point:V3Point,utility:number,reason:string,intent:V3Choice['intent']='commit',extra:Partial<V3Request>={})=>{
    const r:V3Request={actor:u.id,slot,point,...extra};if(!validate(w,e,r)&&a.cooldowns[slot]<=w.tick&&(slot!=='ultimate'||u.level>=6))proposals.push({request:r,utility,reason,intent});};
  if(isRosterHero(u.hero))for(const proposal of rosterProposals(w,e,u)){
    const {slot,point,utility,reason,...extra}=proposal;add(slot,point,utility,reason,slot==='skill1'?'prepare':'commit',extra);
  }
  else if(u.hero==='lulla-faespring'){
    const notes=Object.entries(a.notes).filter(([,n])=>n.count>0).map(([id])=>enemies.find(t=>t.id===id)).filter((t):t is V3Unit=>!!t);
    const target=notes[0];if(target)add('skill2',clampPoint(target,120),.85,'punish-observed-completed-combo','followup',{target:target.id});
    if(owned(w,u.id,'chime').length<2)add('skill1',clampPoint(enemy,100),.65,'prepare-visible-casting-corridor','prepare');
    const winding=w.casts.filter(c=>enemies.some(t=>t.id===c.request.actor)).length;
    const repeated=Object.values(a.notes).filter(n=>n.count>0).length;
    if((winding>=2||repeated>=2)&&enemies.filter(t=>v3Distance(enemy,t)<110).length>=2)add('ultimate',clampPoint(enemy,120),.75,'multiple-observed-cast-chains-near-announced-beats');
  }else if(u.hero==='vesper-nullcode'){
    add('skill1',clampPoint(enemy,110),.6,'bend-visible-approach','prepare',{direction:dir});
    add('skill2',clampPoint(enemy,120),.5,'public-friction-before-approach');
    if(a.momentum&&enemies.length>=2)add('ultimate',clampPoint(enemy,120),.8,'observed-travel-into-contested-field');
  }else if(u.hero==='teslan-veyr'){
    const rods=owned(w,u.id,'rod'),point=clampPoint({x:enemy.x,y:enemy.y+(rods.length?-40:40)},135);
    if(rods.length<2)add('skill1',point,.7,'span-visible-crossing-with-breakable-rods','prepare');
    if(owned(w,u.id,'circuit').length){const allies=e.units.filter(t=>t.team===u.team&&t.alive&&v3Distance(t,u)<130).length;
      add('skill2',u,.55,'adapt-public-circuit-polarity','commit',{polarity:allies>=2?'conduct':'repel'});
      if(a.capacitors&&enemies.length>=2)add('ultimate',u,.8,'delay-future-windup-on-contested-circuit');}
  }else if(u.hero==='mora-fenhook'){
    const ally=e.units.filter(t=>t.team===u.team&&t.id!==u.id&&t.alive&&v3Distance(t,u)<110&&t.hp/t.maxHp<.5).sort((a,b)=>a.hp/a.maxHp-b.hp/b.maxHp)[0];
    if(ally){const posts=owned(w,u.id,'post');if(posts.length<2)add('skill1',clampPoint({x:ally.x-dir*(posts.length?100:30),y:ally.y},110),.75,'prepare-consenting-ally-escape-docks','prepare');
      else if(v3Distance(ally,posts[0])<40)add('skill2',u,.8,'dispatch-reachable-visible-escape-route');
      if(v3Distance(ally,u)<45)add('ultimate',clampPoint({x:ally.x-dir*100,y:ally.y},110),.7,'reachable-public-emergency-moorings');}
  }else if(u.hero==='mirelle-vane'){
    const pins=owned(w,u.id,'pin');
    if(pins.length<3){const offsets=[{x:0,y:-40},{x:0,y:40},{x:-dir*65,y:0}],offset=offsets[pins.length];add('skill1',clampPoint({x:enemy.x+offset.x,y:enemy.y+offset.y},120),.7,'prepare-open-readable-pin-geometry','prepare');}
    const allies=e.units.filter(t=>t.team===u.team&&t.alive&&v3Distance(t,u)<180);
    const ally=allies.find(t=>t.hp/t.maxHp<.6&&pins.some(p=>v3Distance(p,t)<60));
    const shots=e.projectiles??[],hostile=shots.filter(p=>p.team!==u.team&&v3Distance(p,u)<220);
    const aimed=clampPoint(enemy,120);
    if(ally&&hostile.length)add('ultimate',aimed,.95,'single-projectile-rescue-with-breakable-cloth','commit',{page:2,target:ally.id});
    if(pins.length>=2){
      const [p,q]=pins;
      const predictedCrossing=enemies.some(t=>[.5,1.5,3].some(seconds=>{const motion=a.observed[t.id];return v3Crosses(t,{x:t.x+(motion?.vx??0)*seconds,y:t.y+(motion?.vy??0)*seconds},p,q);}));
      const nearLine=enemies.some(t=>v3LineDistance(t,p,q)<35);
      if(predictedCrossing||nearLine)add('ultimate',aimed,.67,'public-route-crossing-tax','commit',{page:1});
      if(shots.some(s=>s.team===u.team&&s.consenting&&!s.ultimate&&v3Crosses(s,{x:s.x+s.vx*.7,y:s.y+s.vy*.7},p,q)))add('ultimate',aimed,.64,'delay-one-consenting-friendly-shot','commit',{page:3});
      if(w.constructs.some(c=>c.kind==='ground-hazard'&&c.team!==u.team&&v3LineDistance(c,p,q)<c.radius)&&allies.some(t=>v3Distance(t,p)<70))add('ultimate',aimed,.82,'bridge-specific-temporary-hazard','commit',{page:4});
      if(predictedCrossing)add('ultimate',aimed,.72,'punish-observed-moving-crossing-once','commit',{page:6});
      if(allies.some(t=>t.hp/t.maxHp<.65&&v3LineDistance(t,p,q)<30))add('ultimate',aimed,.7,'offer-voluntary-speed-toward-safe-endpoint','commit',{page:7});
    }
    if(pins.length===3){
      if(hostile.length)add('ultimate',aimed,.76,'one-hit-long-edge-cover','commit',{page:5});
      if(allies.some(t=>pins.reduce((sum,p,i)=>sum+v3Distance(i?pins[i-1]:t,p),0)<220))add('ultimate',aimed,.5,'reachable-ordered-shield-route','commit',{page:8});
      if(allies.filter(t=>v3InsideTriangle(t,pins)).length>=2&&enemies.length>=2)add('ultimate',aimed,.9,'prepared-directional-team-canopy','commit',{page:10});
    }
    if(pins.length&&u.hp/u.maxHp<.55&&w.casts.some(c=>enemies.some(t=>t.id===c.request.actor)&&v3Distance(c.request.point,u)<60))add('ultimate',aimed,.58,'public-distinguishable-decoy-during-enemy-preparation','commit',{page:9});
    if(pins.length){const pin=pins[0],distance=v3Distance(pin,enemy),scale=Math.min(30,distance)/Math.max(1,distance);
      if(distance>30)add('skill2',{x:pin.x+(enemy.x-pin.x)*scale,y:pin.y+(enemy.y-pin.y)*scale},.42,'recut-one-pin-toward-observed-route','reposition',{object:pin.id});}
  }
  const best=proposals.sort((a,b)=>b.utility-a.utility).find(p=>u.mana>=castDefinition(u,p.request.slot,p.request.page??a.page).cost);
  const choice:V3Choice=best??{intent:'hold',reason:'no-legal-positive-candidate',utility:0};
  if(best)emit(w,'ai_choice_explained',u.id,{reason:best.reason,value:best.utility});return choice;
}
/** Called only AFTER a real successful cast has resolved/launched its effect. Attacks never call it. */
export function completedV3Ability(w:V3World,e:V3Environment,id:string,castId:string,baseRecovery=.25,slot?:V3Slot,endpoint?:V3Point){
  if(w.completed.includes(castId))return 0;w.completed.push(castId);if(w.completed.length>2048)w.completed.shift();
  const u=unit(e,id);if(!u?.alive)return 0;const a=v3Actor(w,id);let tax=0,recovery=baseRecovery;
  const roster=rosterCompleted(w,e,u,slot,endpoint);tax+=roster.tax;recovery*=roster.recovery;
  if(a.yawn&&a.yawn.expires>=w.tick){tax+=.35;delete a.yawn;}
  for(const source of e.units.filter(v=>v.hero==='lulla-faespring'&&v.alive&&v.team!==u.team&&e.visible(v,u))){
    if(owned(w,source.id,'chime').some(c=>v3Distance(c,u)<=95)){
      const ledger=v3Actor(w,source.id).notes,old=ledger[id];ledger[id]={count:Math.min(2,(old&&old.expires>w.tick?old.count:0)+1),expires:w.tick+120};
      emit(w,'drowse_added',source.id,{target:id,value:ledger[id].count});
    }
  }
  for(const c of w.constructs.filter(c=>c.kind==='theater'&&active(w,c)&&v3Distance(c,u)<=135)){
    if([30,60,90].some(beat=>Math.abs(w.tick-c.created-beat)<=4)){
      if(c.team!==u.team)tax+=.25;else recovery*=.88;
    }
  }
  if(slot!=='ultimate')for(const c of w.constructs.filter(c=>c.kind==='canopy'&&active(w,c)&&c.team===u.team&&v3InsideTriangle(u,c.points)))recovery*=.9;
  a.taxHistory=a.taxHistory.filter(h=>w.tick-h.tick<150);
  const added=Math.max(0,Math.min(.7,tax,1.4-a.taxHistory.reduce((sum,h)=>sum+h.seconds,0)));
  if(added){a.taxHistory.push({tick:w.tick,seconds:added});emit(w,'cast_recovery_added',id,{value:added,object:castId});}
  a.recoveryUntil=Math.max(a.recoveryUntil,w.tick+v3Ticks(recovery+added));return added;
}
