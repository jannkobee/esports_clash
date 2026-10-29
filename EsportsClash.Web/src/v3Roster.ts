/** Remaining original kits. Fixed-tick gameplay only; no rendering or wall clocks.
 * This implementation pass is deliberately unqualified until the deferred tests. */
import {v3Actor,v3Distance as distance,v3LineDistance as lineDistance,v3Crosses as crosses,
  spawn,owned,active,emit,v3Projectile,type V3World,type V3Unit,type V3Environment,type V3Point,
  type V3Construct,type V3Request,type V3Slot,type V3Projectile,type V3DamageContext} from './v3Combat.ts';

import { V3_ROSTER_KEYS, type RosterHero } from './v3RosterIdentity.ts';
import {LANE_Y,PLAY_MIN_Y,PLAY_MAX_Y} from './arenaLayout.ts';
export { V3_ROSTER_KEYS, type RosterHero } from './v3RosterIdentity.ts';
export type RosterKind='sun-panel'|'sun-wedge'|'frost-fork'|'ice-string'|'glass-rapture'|'counterpath'|'false-exit'|'spectral-road'
 |'anchor-ram'|'tunnel-ram'|'collection-line'|'mercy'|'shadow-plane'|'veil'|'silhouette'|'wind-current'|'wind-ring'
 |'track-lantern'|'fen-guard'|'road-home'|'kite'|'crossfire'|'harrier-net'|'floor-steps'|'partner-trade'|'procession'
 |'hark'|'shell-link'|'nutrient'|'mycelium'|'understory'|'suture'|'stitch-circuit'|'triage'|'letter'|'courier-road'|'postal-seal'
 |'jade-slab'|'jade-gate'|'mile-marker'|'verdict'|'crystal-pane'|'ember-brand'|'penance'|'waylight'|'waypoint'|'atlas'
 |'drum'|'long-measure'|'ash-patch'|'furnace-current'|'ember-wall'|'tilt-plate'|'drift'|'jaw-tooth'
 |'turnstile'|'earth-clip'|'mirror'|'buoy'|'broadside'|'foam'|'pressure-cask'|'canvas'|'gallery'|'rail'|'rail-cart'
 |'complaint'|'escort'|'writ'|'firework-rack'|'spotlight'|'stage-cell'|'thermal'|'thermocline'|'dorsal-wall'
 |'score-circle'|'score-link'|'chorus-circle'|'planter'|'court'|'pole'|'runway'|'column'|'leaf-roof'|'shade-grove'
 |'palm'|'bell-rhythm'|'survey-sector'|'airspace-cell'|'roster-bolt'|'delayed-hit'|'vault-transit'|'ground-hazard';
export type AbilityCategory='mobility'|'attack'|'protection'|'control';
export interface RosterMark {expires:number;value:number;point?:V3Point;heading?:number;target?:string;category?:AbilityCategory;last?:number;shield?:number}
export interface RosterActor {
 resource:number;secondResource:number;timers:Record<string,number>;marks:Record<string,RosterMark>;
 partner?:string;lastPoint?:V3Point;lastHeading?:number;travel:number;lastCast?:{tick:number;slot:V3Slot;category:AbilityCategory};
}
export interface RosterData {
 target?:string;arm?:number;next?:number;interval?:number;pulses?:number;damage?:number;slot?:V3Slot;
 direction?:V3Point;origin?:V3Point;destination?:V3Point;movingUntil?:number;speed?:number;
 width?:number;length?:number;overhead?:boolean;fired?:boolean;category?:AbilityCategory;
 reserve?:number;value?:number;oneShot?:boolean;repeat?:boolean;reflected?:boolean;revealWindow?:number;
 consent?:string[];property?:'physical'|'magic'|'utility';closing?:number;heading?:number;safeY?:number;group?:string;heldUntil?:number;
}
export interface RosterDefinition {cooldowns:readonly number[];categories:readonly AbilityCategory[];charges?:number}
export const ROSTER_DEFINITIONS:Record<RosterHero,RosterDefinition>={
 'solenne-vaelor':{cooldowns:[9,12,85],categories:['protection','protection','protection']},
 'ivera-frostwhistle':{cooldowns:[8,14,80],categories:['attack','control','attack'],charges:2},
 'mireth-lune':{cooldowns:[8,13,83],categories:['control','mobility','control']},
 'bramm-coil':{cooldowns:[9,13,76],categories:['attack','protection','control']},
 'kael-vespera':{cooldowns:[7,13,80],categories:['attack','protection','control']},
 'nyxara-vale':{cooldowns:[8,13,85],categories:['control','protection','control']},
 'serrin-galecrest':{cooldowns:[7,12,88],categories:['control','mobility','control']},
 'orin-and-fen':{cooldowns:[9,14,90],categories:['control','protection','protection']},
 'quillene-rook':{cooldowns:[8,13,85],categories:['control','attack','control']},
 'aurelio-vane':{cooldowns:[8,13,78],categories:['mobility','mobility','protection']},
 'droven-bearmantle':{cooldowns:[12,14,92],categories:['protection','protection','protection']},
 'thalara-rootwright':{cooldowns:[8,14,90],categories:['control','control','protection']},
 'vesper-loom':{cooldowns:[8,12,88],categories:['protection','protection','protection']},
 'rux-emberchain':{cooldowns:[8,12,82],categories:['attack','mobility','attack']},
 'joruun-jadecoil':{cooldowns:[10,13,95],categories:['protection','control','protection']},
 'astrax-mire':{cooldowns:[8,12,82],categories:['control','control','control']},
 'prismelle-cade':{cooldowns:[9,12,86],categories:['protection','mobility','protection']},
 'ashkar-veilhand':{cooldowns:[7,14,86],categories:['attack','mobility','attack']},
 'maris-solquill':{cooldowns:[8,13,87],categories:['protection','control','protection']},
 'odo-bogsong':{cooldowns:[8,13,85],categories:['attack','protection','control']},
 'mourn-ashwake':{cooldowns:[8,12,90],categories:['attack','attack','control']},
 'dolm-runesunder':{cooldowns:[9,13,95],categories:['control','attack','control']},
 'garruk-mawsuture':{cooldowns:[9,12,90],categories:['control','attack','control']},
 'coiljack-ampfist':{cooldowns:[9,12,88],categories:['control','protection','control']},
 'talan-slipshot':{cooldowns:[8,7,78],categories:['protection','attack','attack'],charges:2},
 'calixa-broadwake':{cooldowns:[8,12,88],categories:['control','mobility','attack']},
 'brohm-caskfall':{cooldowns:[9,13,95],categories:['control','protection','control']},
 'maelis-chromabloom':{cooldowns:[9,13,90],categories:['protection','control','control'],charges:2},
 'axiom-rail':{cooldowns:[8,12,80],categories:['attack','attack','attack'],charges:2},
 'brakka-fenn':{cooldowns:[8,12,84],categories:['control','protection','control']},
 'pippa-fuseburst':{cooldowns:[8,12,88],categories:['attack','control','attack']},
 'bryx-emberkite':{cooldowns:[9,13,87],categories:['mobility','mobility','mobility']},
 'murdle-ridgehide':{cooldowns:[8,12,92],categories:['protection','control','protection']},
 'nemea-halolink':{cooldowns:[8,13,92],categories:['protection','mobility','protection']},
 'thimble-briarwish':{cooldowns:[9,12,90],categories:['protection','mobility','protection']},
 'sevrin-inkseal':{cooldowns:[9,13,95],categories:['control','control','control']},
 'koro-cloudtail':{cooldowns:[8,12,87],categories:['mobility','mobility','mobility'],charges:2},
 'bram-stonebranch':{cooldowns:[9,12,92],categories:['protection','protection','protection'],charges:2},
 'toma-bellbreak':{cooldowns:[8,12,84],categories:['attack','protection','protection']},
 'ravelle-skyrake':{cooldowns:[8,13,92],categories:['control','mobility','attack']},
};
export const isRosterHero=(hero:V3Unit['hero']):hero is RosterHero=>!!hero&&hero in ROSTER_DEFINITIONS;
export function rosterState(w:V3World,id:string):RosterActor {
 const a=v3Actor(w,id);return a.roster??={resource:a.hero==='droven-bearmantle'?220:a.hero==='murdle-ridgehide'?4:0,secondResource:0,timers:{},marks:{},travel:0};
}
const ticks=(s:number)=>Math.ceil(s*30-1e-8);
const get=(e:V3Environment,id?:string)=>e.units.find(u=>u.id===id);
const point=(p:V3Point):V3Point=>({x:p.x,y:p.y});
const angle=(a:V3Point,b:V3Point)=>Math.atan2(b.y-a.y,b.x-a.x);
const along=(p:V3Point,a:number,n:number)=>({x:p.x+Math.cos(a)*n,y:p.y+Math.sin(a)*n});
const front=(u:V3Unit,p:V3Point,arc=Math.PI/2)=>Math.abs(Math.atan2(Math.sin(angle(u,p)-(u.facing??(u.team==='blue'?0:Math.PI))),Math.cos(angle(u,p)-(u.facing??(u.team==='blue'?0:Math.PI)))))<=arc;
const allies=(e:V3Environment,u:V3Unit,r=180)=>e.units.filter(t=>t.alive&&t.team===u.team&&distance(t,u)<=r);
const enemies=(e:V3Environment,u:V3Unit,r=180)=>e.units.filter(t=>t.alive&&t.team!==u.team&&distance(t,u)<=r&&e.visible(u,t));
const shield=(w:V3World,u:V3Unit,n:number)=>{const before=u.shield;u.shield=Math.max(before,Math.min(u.maxHp*.4,before+n));const granted=u.shield-before;
 for(const a of Object.values(w.actors)){const contract=a.roster?.marks['contract:'+u.id];if(contract&&contract.expires>w.tick){contract.value=Math.min(160,contract.value+granted);contract.shield=u.shield;}}
 emit(w,'shield_applied',u.id,{value:granted});};
function heal(w:V3World,e:V3Environment,u:V3Unit,n:number,split=true){
 if(!u.alive||n<=0)return;
 const link=split?w.constructs.find(c=>c.kind==='stitch-circuit'&&active(w,c)&&c.passengers.includes(u.id)):undefined;
 const partner=link?get(e,link.passengers.find(id=>id!==u.id)):undefined;
 if(partner?.alive&&distance(u,partner)<=180){heal(w,e,u,n*.7,false);heal(w,e,partner,n*.3,false);return;}
 const applied=Math.min(n,u.maxHp-u.hp);if(applied<=0)return;
 if(e.heal)e.heal(u,applied);else u.hp+=applied;emit(w,'heal_applied',u.id,{value:applied});
}
export {heal as applyRosterHealing};
function move(w:V3World,e:V3Environment,u:V3Unit,to:V3Point,max=24,forced=true){
 if(!u.alive||u.controlled||u.unstoppable&&forced)return false;
 const clip=forced?w.constructs.find(c=>active(w,c)&&c.kind==='earth-clip'&&c.roster?.target===u.id&&c.charges>0):undefined;
 if(clip){max*=.6;clip.charges--;emit(w,'displacement_reduced',clip.owner,{target:u.id,object:clip.id,value:.4});}
 const n=distance(u,to),dest=n>max?along(u,angle(u,to),max):point(to);
 if(!e.legalPoint(dest)||!e.legalSegment(u,dest))return false;Object.assign(u,dest);return true;
}
function transit(w:V3World,e:V3Environment,u:V3Unit,to:V3Point,max=65,seconds=.35,supports:string[]=[]){
 if(u.controlled||!u.alive||(rosterState(w,u.id).timers.root??0)>w.tick||distance(u,to)>max||!(e.legalTravel??e.legalSegment)(u,to)||!e.legalPoint(to))return false;
 if(w.constructs.some(c=>c.kind==='vault-transit'&&c.passengers.includes(u.id)&&active(w,c)))return false;
 const c=field(w,u,'vault-transit',u,seconds+1/30,{points:[point(u),point(to)],supports,passengers:[u.id],roster:{arm:w.tick,movingUntil:w.tick+ticks(seconds)}});
 if(c)emit(w,'route_boarded',u.id,{object:c.id});return !!c;
}
function status(w:V3World,e:V3Environment,u:V3Unit,key:'root'|'disarm'|'speed'|'reveal',seconds:number,value=0){
 const s=rosterState(w,u.id);s.timers[key]=Math.max(s.timers[key]??0,w.tick+ticks(seconds));
 if(key==='speed')s.secondResource=value;
 if(key==='reveal')e.reveal?.(u,seconds);
 emit(w,'status_applied',u.id,{reason:key,value:seconds});
}
function hurt(w:V3World,e:V3Environment,u:V3Unit,t:V3Unit,n:number,slot:V3Slot='skill1',context:V3DamageContext={}){
 if(t.alive&&t.team!==u.team&&n>0)e.damage(u,t,n,slot,{...context,triggered:context.triggered??false});
}
function device(w:V3World,u:V3Unit,kind:RosterKind,p:V3Point,seconds:number,options:Partial<V3Construct>={}){
 return spawn(w,u,kind,p,seconds,{attackable:true,...options});
}
function field(w:V3World,u:V3Unit,kind:RosterKind,p:V3Point,seconds:number,options:Partial<V3Construct>={}){
 return device(w,u,kind,p,seconds,{attackable:false,...options});
}
function segment(w:V3World,u:V3Unit,kind:RosterKind,p:V3Point,length:number,seconds:number,a:number,options:Partial<V3Construct>={}){
 return device(w,u,kind,p,seconds,{angle:a,points:[along(p,a+Math.PI/2,-length/2),along(p,a+Math.PI/2,length/2)],...options});
}
function cap(w:V3World,u:V3Unit,kind:RosterKind,max:number){const old=owned(w,u.id,kind);while(old.length>=max)old.shift()!.hp=0;}
function blast(w:V3World,e:V3Environment,u:V3Unit,p:V3Point,r:number,n:number,slot:V3Slot='skill1',context:V3DamageContext={}){
 for(const t of enemies(e,u,400).filter(t=>distance(t,p)<=r))hurt(w,e,u,t,n,slot,{...context,area:true});
 for(const t of e.battlefieldTargets??[])if(t.alive&&t.team!==u.team&&distance(t,p)<=r&&e.legalSegment(p,t))e.damageBattlefield?.(u,t,n,slot);
}
function bolt(w:V3World,u:V3Unit,from:V3Point,to:V3Point,damage:number,slot:V3Slot='skill2',options:Partial<RosterData>={}){
 return field(w,u,'roster-bolt',from,2,{points:[point(from),point(to)],radius:7,roster:{damage,slot,speed:360,...options}});
}
function lineHit(w:V3World,e:V3Environment,u:V3Unit,a:V3Point,b:V3Point,width:number,n:number,slot:V3Slot,control=0){
 for(const t of enemies(e,u,400).filter(t=>lineDistance(t,a,b)<=width&&e.legalSegment(a,t))){hurt(w,e,u,t,n,slot);if(control)e.control?.(u,t,control);}
 for(const t of e.battlefieldTargets??[])if(t.alive&&t.team!==u.team&&lineDistance(t,a,b)<=width&&e.legalSegment(a,t))e.damageBattlefield?.(u,t,n,slot);
}
function link(w:V3World,u:V3Unit,kind:RosterKind,supports:V3Construct[],seconds:number,options:Partial<V3Construct>={}){
 if(!supports.length)return;return field(w,u,kind,supports[0],seconds,{points:supports.map(point),supports:supports.map(c=>c.id),...options});
}
function targetAlly(e:V3Environment,u:V3Unit,r:V3Request){return get(e,r.target)??allies(e,u).sort((a,b)=>a.hp/a.maxHp-b.hp/b.maxHp)[0]??u;}
function marked(w:V3World,u:V3Unit,key:string){const m=rosterState(w,u.id).marks[key];return m&&m.expires>w.tick?m:undefined;}
function mark(w:V3World,u:V3Unit,key:string,value:number,seconds:number,extra:Partial<RosterMark>={}){
 rosterState(w,u.id).marks[key]={expires:w.tick+ticks(seconds),value,...extra};emit(w,'public_mark',u.id,{reason:key,value});
}
const first=(w:V3World,u:V3Unit,kind:RosterKind)=>owned(w,u.id,kind)[0];
function facingPanel(w:V3World,u:V3Unit,kind:RosterKind,p:V3Point,a:number,seconds:number,width=55,charges=2){return segment(w,u,kind,p,width,seconds,a,{charges});}
function rotate(c:V3Construct,a:number){const delta=a-c.angle;c.points=c.points.map(p=>{const x=p.x-c.x,y=p.y-c.y;return {x:c.x+x*Math.cos(delta)-y*Math.sin(delta),y:c.y+x*Math.sin(delta)+y*Math.cos(delta)};});c.angle=a;}

/** Shared mechanical prerequisites; commit revalidates these before paying. */
export function validateRosterCast(w:V3World,e:V3Environment,u:V3Unit,r:V3Request):string|undefined {
 if(!isRosterHero(u.hero))return;
 const s=rosterState(w,u.id),target=get(e,r.target),objects=(k:RosterKind,n=1)=>owned(w,u.id,k).length>=n;
 if(r.target&&(!target?.alive||!e.visible(u,target)))return 'visible-target-required';
 const friendlyTarget=['vesper-loom','ashkar-veilhand','orin-and-fen','aurelio-vane','brakka-fenn','coiljack-ampfist'].includes(u.hero)&&r.slot==='skill2'
   ||u.hero==='vesper-loom'&&r.slot==='skill1'||u.hero==='orin-and-fen'&&r.slot==='ultimate';
 if(friendlyTarget&&(target?.team!==u.team||distance(u,target)>150))return 'ally-required';
 if(u.hero==='ivera-frostwhistle'&&r.slot!=='skill1'&&!objects('frost-fork',2))return 'two-forks-required';
 if(u.hero==='mireth-lune'&&r.slot==='ultimate'&&!Object.keys(s.marks).some(k=>k.startsWith('heading:')&&s.marks[k].expires>w.tick))return 'recorded-heading-required';
 if(u.hero==='solenne-vaelor'&&r.slot==='ultimate'&&!objects('sun-panel'))return 'panel-required';
 if(u.hero==='kael-vespera'&&r.slot==='ultimate'&&(!target||!marked(w,u,'contract:'+target.id)))return 'contract-required';
 if(u.hero==='nyxara-vale'&&r.slot==='skill2'&&!objects('shadow-plane'))return 'shadow-plane-required';
 if(u.hero==='serrin-galecrest'&&r.slot==='skill2'&&s.resource<1)return 'wind-notch-required';
 if(u.hero==='quillene-rook'&&r.slot!=='skill1'&&!objects('kite',r.slot==='skill2'?2:1))return 'kite-layout-required';
 if(u.hero==='aurelio-vane'&&r.slot==='skill2'&&(target?.id===u.id||!target||distance(u,target)>120||target.controlled))return 'eligible-partner-required';
 if(u.hero==='droven-bearmantle'&&r.slot!=='skill1'&&!objects('hark'))return 'living-hark-required';
 if(u.hero==='droven-bearmantle'&&r.slot==='skill1'&&(s.timers.harkReturn??0)>w.tick)return 'hark-recovering';
 if(u.hero==='thalara-rootwright'&&r.slot==='skill2'&&!objects('nutrient'))return 'node-required';
 if(u.hero==='thalara-rootwright'&&r.slot==='skill1'&&!objects('nutrient')&&!enemies(e,u,160).some(t=>distance(t,r.point)<20))return 'seed-impact-or-node-required';
 if(u.hero==='thalara-rootwright'&&r.slot==='ultimate'&&!objects('mycelium'))return 'connected-web-required';
 if(u.hero==='vesper-loom'&&r.slot==='skill2'&&allies(e,u).length<2)return 'two-allies-required';
 if(u.hero==='vesper-loom'&&r.slot==='ultimate'&&!Object.entries(s.marks).some(([k,m])=>k.startsWith('care:')&&m.expires>w.tick&&m.value>0))return 'actual-care-debt-required';
 if(u.hero==='rux-emberchain'&&r.slot==='skill2'&&!Object.keys(s.marks).some(k=>k.startsWith('stamp:')&&s.marks[k].expires>w.tick))return 'stamp-required';
 if(u.hero==='rux-emberchain'&&r.slot==='ultimate'&&!objects('letter'))return 'letters-required';
 if(u.hero==='astrax-mire'&&r.slot!=='skill2'&&(!target||target.team===u.team))return 'enemy-required';
 if(u.hero==='astrax-mire'&&r.slot==='ultimate'&&!Object.keys(s.marks).some(k=>k.startsWith('measure:')&&s.marks[k].expires>w.tick))return 'measured-target-required';
 if(u.hero==='prismelle-cade'&&r.slot==='skill2'&&!objects('crystal-pane'))return 'pane-required';
 if(u.hero==='ashkar-veilhand'&&r.slot!=='skill2'&&(!target||!marked(w,u,'ember:'+target.id)))return 'actual-attacker-required';
 if(u.hero==='maris-solquill'&&r.slot==='skill2'&&!objects('waypoint'))return 'lantern-required';
 if(u.hero==='maris-solquill'&&r.slot==='ultimate'&&!objects('waylight',2))return 'two-waylights-required';
 if(u.hero==='odo-bogsong'&&r.slot==='skill2'&&!objects('drum'))return 'drum-required';
 if(u.hero==='mourn-ashwake'&&r.slot!=='skill1'&&!objects('ash-patch'))return 'ash-required';
 if(u.hero==='garruk-mawsuture'&&r.slot==='skill2'&&!objects('jaw-tooth'))return 'tooth-required';
 if(u.hero==='talan-slipshot'&&r.slot==='ultimate'&&(!target||!objects('mirror')))return 'target-and-mirror-required';
 if(u.hero==='talan-slipshot'&&r.slot==='ultimate'&&!owned(w,u.id,'mirror').some(c=>e.legalSegment(c,r.point)))return 'legal-mirror-line-required';
 if(u.hero==='brohm-caskfall'&&r.slot==='skill2'&&!objects('foam'))return 'foam-required';
 if(u.hero==='maelis-chromabloom'&&r.slot==='ultimate'&&!objects('canvas'))return 'frames-required';
 if(u.hero==='axiom-rail'&&r.slot!=='skill1'&&!objects('rail'))return 'rail-required';
 if(u.hero==='brakka-fenn'&&r.slot==='ultimate'&&(!target||!marked(w,u,'offender:'+target.id)||distance(u,target)>110))return 'offender-required';
 if(u.hero==='bryx-emberkite'&&r.slot!=='skill1'&&!objects('thermal',r.slot==='ultimate'?2:1))return 'thermal-layout-required';
 if(u.hero==='murdle-ridgehide'&&r.slot==='skill2'&&!objects('dorsal-wall'))return 'deployed-plate-required';
 if(u.hero==='murdle-ridgehide'&&r.slot!=='skill2'&&s.resource<(r.slot==='ultimate'?3:1))return 'available-plates-required';
 if(u.hero==='nemea-halolink'&&r.slot==='skill2'&&(!objects('score-circle',2)||distance(owned(w,u.id,'score-circle')[0],owned(w,u.id,'score-circle')[1])>130))return 'separate-circles-required';
 if(u.hero==='nemea-halolink'&&r.slot==='skill2'&&distance(owned(w,u.id,'score-circle')[0],owned(w,u.id,'score-circle')[1])<36)return 'distinct-circles-required';
 if(u.hero==='nemea-halolink'&&r.slot==='ultimate'&&s.resource<1)return 'harmony-required';
 if(u.hero==='thimble-briarwish'&&r.slot==='skill2'&&!objects('planter'))return 'planter-required';
 if(u.hero==='sevrin-inkseal'&&r.slot==='ultimate'&&!objects('court'))return 'court-required';
 if(u.hero==='koro-cloudtail'&&r.slot!=='skill1'&&!objects('pole',r.slot==='ultimate'?2:1))return 'pole-layout-required';
 if(u.hero==='koro-cloudtail'&&r.slot==='skill2'&&distance(u,first(w,u,'pole')!)>35)return 'reachable-pole-required';
 if(u.hero==='koro-cloudtail'&&r.slot==='skill2'&&(distance(u,first(w,u,'pole')!.points[1])>65||!e.legalSegment(u,first(w,u,'pole')!.points[1])))return 'legal-vault-endpoint-required';
 if(u.hero==='koro-cloudtail'&&r.slot==='ultimate'&&distance(owned(w,u.id,'pole')[0],owned(w,u.id,'pole')[1])>65)return 'runway-too-long';
 if(u.hero==='bram-stonebranch'&&r.slot==='skill2'&&!objects('column'))return 'column-required';
 if(u.hero==='ravelle-skyrake'&&r.slot==='ultimate'&&!owned(w,u.id,'survey-sector').some(c=>distance(c,r.point)<=45))return 'surveyed-sector-required';
 if(u.hero==='mireth-lune'&&r.slot==='skill2'&&!e.legalSegment(r.point,along(r.point,angle(u,r.point)+Math.PI/2,75)))return 'disclosed-exit-blocked';
 if(u.hero==='ravelle-skyrake'&&r.slot==='skill2'&&!e.legalSegment(u,along(u,(u.facing??angle(u,r.point))+Math.PI/2,50)))return 'skiff-route-blocked';
 if(u.hero==='axiom-rail'&&r.slot==='skill1'&&!e.legalSegment(r.point,along(r.point,angle(u,r.point),65)))return 'rail-endpoint-blocked';
 if(u.hero==='koro-cloudtail'&&r.slot==='skill1'&&!e.legalSegment(r.point,along(r.point,angle(u,r.point),60)))return 'pole-landing-blocked';
 if(r.slot==='ultimate'&&['pippa-fuseburst','ravelle-skyrake'].includes(u.hero)){
  const width=u.hero==='pippa-fuseburst'?120:130;
  const candidates=w.escapeCorridor&&w.escapeCorridor.expires>w.tick?[w.escapeCorridor.y]:[r.point.y,r.point.y-45,r.point.y+45,LANE_Y-30,LANE_Y-180,LANE_Y+180].map(y=>Math.max(PLAY_MIN_Y+25,Math.min(PLAY_MAX_Y-25,y)));
  if(!candidates.some(y=>e.legalSegment({x:r.point.x-width/2,y},{x:r.point.x+width/2,y})))return 'no-traversable-artillery-escape';
 }
 if(['joruun-jadecoil','bramm-coil','koro-cloudtail','ravelle-skyrake'].includes(u.hero)&&r.slot==='skill2'&&!e.legalSegment(u,r.point))return 'legal-route-required';
}
export function rosterRequiredDevices(hero:V3Unit['hero'],slot:V3Slot):number {
 if(!isRosterHero(hero))return 0;
 const devices:Partial<Record<RosterHero,readonly number[]>>={
  'solenne-vaelor':[1,0,0],'ivera-frostwhistle':[1,0,0],'mireth-lune':[0,1,0],
  'bramm-coil':[1,0,0],'nyxara-vale':[1,0,3],'orin-and-fen':[1,0,0],
  'quillene-rook':[1,0,0],'droven-bearmantle':[1,0,0],'thalara-rootwright':[1,0,0],
  'rux-emberchain':[1,0,0],'joruun-jadecoil':[1,0,2],'astrax-mire':[0,1,0],
  'prismelle-cade':[1,0,3],'maris-solquill':[1,0,0],'odo-bogsong':[1,0,0],
  'mourn-ashwake':[1,0,0],'garruk-mawsuture':[2,0,6],'coiljack-ampfist':[1,0,2],
  'talan-slipshot':[1,0,0],'calixa-broadwake':[1,0,0],'brohm-caskfall':[0,0,1],
  'maelis-chromabloom':[1,0,0],'axiom-rail':[1,1,0],'pippa-fuseburst':[1,0,0],
  'bryx-emberkite':[1,0,0],'murdle-ridgehide':[1,0,3],'nemea-halolink':[1,0,0],
  'thimble-briarwish':[1,0,3],'sevrin-inkseal':[1,0,0],'koro-cloudtail':[1,0,0],'bram-stonebranch':[1,0,3],
 };return devices[hero]?.[slot==='skill1'?0:slot==='skill2'?1:2]??0;
}

/** Forty authored P/S1/S2/R dispatches share geometry, damage and lifecycle helpers. */
export function commitRosterCast(w:V3World,e:V3Environment,u:V3Unit,r:V3Request){
 const s=rosterState(w,u.id),p=r.point,a=angle(u,p),slot=r.slot,one=slot==='skill1',two=slot==='skill2',ally=targetAlly(e,u,r),target=get(e,r.target);
 const own=(k:RosterKind)=>first(w,u,k),turn=(c:V3Construct|undefined,degrees=90)=>{if(c)rotate(c,c.angle+(r.direction??1)*degrees*Math.PI/180);};
 switch(u.hero){
 case 'solenne-vaelor':
  if(one){cap(w,u,'sun-panel',1);facingPanel(w,u,'sun-panel',p,a,3.5,70,2);}
  else if(two){const panel=own('sun-panel');if(panel)turn(panel,100);else move(w,e,u,along(u,a,38),38,false);s.timers.guard=w.tick+45;s.marks.guard={expires:w.tick+45,value:s.resource,heading:a};s.resource=0;}
  else {const panel=own('sun-panel')!;field(w,u,'sun-wedge',panel,4,{angle:panel.angle,radius:150,points:[point(panel),along(panel,panel.angle-.55,150),along(panel,panel.angle+.55,150)]});if(s.resource>=3)for(const t of enemies(e,u,110))move(w,e,t,along(t,panel.angle,18));s.resource=0;}break;
 case 'ivera-frostwhistle':
  if(one){cap(w,u,'frost-fork',2);device(w,u,'frost-fork',p,5);bolt(w,u,u,p,45,'skill1',{oneShot:false});}
  else if(two)link(w,u,'ice-string',owned(w,u.id,'frost-fork').slice(-2),3);
  else {const forks=owned(w,u.id,'frost-fork').slice(-2);const c=field(w,u,'glass-rapture',u,1.3,{points:[...forks.map(point),point(u)],supports:forks.map(c=>c.id),roster:{arm:w.tick+36,damage:155}});if(c)c.roster!.value=1;}break;
 case 'mireth-lune':
  if(one){const heading=target?marked(w,u,'heading:'+target.id)?.heading:undefined;segment(w,u,'counterpath',p,75,3,heading??a,{attackable:false,roster:{heading:heading??a}});}
  else if(two){const exit=along(p,a+Math.PI/2,75);if(e.legalSegment(p,exit))device(w,u,'false-exit',p,3.5,{radius:17,points:[point(p),exit],roster:{destination:exit}});}
  else for(const [,m] of Object.entries(s.marks).filter(([key,m])=>key.startsWith('heading:')&&m.point&&m.heading!==undefined&&m.expires>w.tick).slice(0,3))field(w,u,'spectral-road',m.point!,4,{points:[along(m.point!,m.heading!,-50),along(m.point!,m.heading!,50)],roster:{heading:m.heading}});break;
 case 'bramm-coil':
  if(one)device(w,u,'anchor-ram',p,1.3,{angle:a,radius:45,roster:{arm:w.tick+18,damage:90,length:90,width:22}});
  else if(two){s.timers.brace=w.tick+90;e.slow?.(u,.25,3);}
  else field(w,u,'tunnel-ram',u,2.6,{angle:a,points:[point(u),along(u,a,150)],radius:23,roster:{arm:w.tick+33,movingUntil:w.tick+75,damage:105,origin:point(u),destination:along(u,a,150)}});break;
 case 'kael-vespera':
  if(one){segment(w,u,'collection-line',p,65,2,a,{attackable:false});lineHit(w,e,u,u,along(u,a,65),30,55,slot);}
  else if(two){s.timers.brace=w.tick+24;s.timers.counter=0;}
  else field(w,u,'mercy',target!,4,{roster:{target:target!.id,value:0},radius:75});break;
 case 'nyxara-vale':
  if(one){cap(w,u,'shadow-plane',2);segment(w,u,'shadow-plane',p,70,4,a,{points:[point(u),along(p,a+Math.PI/2,35),along(p,a-Math.PI/2,35)]});}
  else if(two){own('shadow-plane')!.hp=0;field(w,u,'veil',u,2,{radius:45,roster:{target:u.id}});s.timers.veil=w.tick+60;}
  else {for(let i=-1;i<=1;i++)device(w,u,'silhouette',along(u,a+i*.6,80),3,{radius:14});s.timers.isolated=w.tick+90;}break;
 case 'serrin-galecrest':
  if(one)segment(w,u,'wind-current',p,65,2.2,a,{attackable:false});
  else if(two){const current=own('wind-current');if(current)turn(current);else move(w,e,u,along(u,a+Math.PI/2,28),28,false);s.resource--;}
  else for(let i=0;i<4;i++)segment(w,u,'wind-ring',along(p,i*Math.PI/2,100),70,4,i*Math.PI/2,{attackable:false,roster:{origin:point(p)}});break;
 case 'orin-and-fen':
  if(one){cap(w,u,'track-lantern',2);device(w,u,'track-lantern',p,5,{radius:55});}
  else if(two)field(w,u,'fen-guard',ally,3,{radius:22,charges:1,roster:{target:ally.id}});
  else field(w,u,'road-home',u,4,{points:[point(ally),point(u)],roster:{target:ally.id},radius:22});break;
 case 'quillene-rook':
  if(one){cap(w,u,'kite',3);device(w,u,'kite',p,3);}
  else if(two)link(w,u,'crossfire',owned(w,u.id,'kite').sort((a,b)=>distance(a,u)-distance(b,u)).slice(0,2),3,{charges:2});
  else link(w,u,'harrier-net',owned(w,u.id,'kite'),2.5,{radius:100});break;
 case 'aurelio-vane':
  if(one)field(w,u,'floor-steps',u,3,{points:[along(u,a,30),along(u,a,60)]});
  else if(two)field(w,u,'partner-trade',u,1.2,{points:[point(u),point(ally)],passengers:[u.id,ally.id],roster:{target:ally.id,consent:[u.id]}});
  else field(w,u,'procession',u,4,{points:[along(u,a-.4,35),along(u,a+.4,70),along(u,a,110)],roster:{next:w.tick+30,pulses:3}});break;
 case 'droven-bearmantle':
  if(one){const hark=own('hark');if(hark){hark.expires=w.tick+120;moveConstruct(e,hark,p,80);}else device(w,u,'hark',p,4,{radius:28,hp:6,maxHp:6,roster:{reserve:s.resource||220}});}
  else if(two)link(w,u,'shell-link',[own('hark')!],2.5,{passengers:[ally.id],roster:{target:ally.id}});
  else {const hark=own('hark')!;hark.expires=w.tick+120;hark.roster={...hark.roster,origin:point(hark),destination:along(hark,a,100),movingUntil:w.tick+120,next:w.tick};}break;
 case 'thalara-rootwright':
  if(one){let node:V3Construct|undefined=owned(w,u.id,'nutrient').sort((a,b)=>distance(a,p)-distance(b,p))[0];if(!node){const impact=enemies(e,u,160).find(t=>distance(t,p)<20);if(impact){hurt(w,e,u,impact,25,'skill1',{direct:true});node=owned(w,u.id,'nutrient').at(-1);if(!node){cap(w,u,'nutrient',4);node=device(w,u,'nutrient',impact,6);}}}if(node&&!w.constructs.some(c=>active(w,c)&&c.kind==='mycelium'&&c.supports.includes(node!.id)))field(w,u,'mycelium',u,6,{points:[point(u),point(node)],supports:[node.id]});}
  else if(two){const node=own('nutrient')!;const old=point(node);moveConstruct(e,node,p,60);for(const c of owned(w,u.id,'mycelium').filter(c=>c.supports.includes(node.id)))c.points[1]=point(node);for(const t of enemies(e,u).filter(t=>lineDistance(t,old,node)<18))move(w,e,t,along(t,a+Math.PI/2,12),12);}
  else link(w,u,'understory',owned(w,u.id,'nutrient'),5,{radius:150});break;
 case 'vesper-loom':
  if(one)field(w,u,'suture',ally,4,{roster:{target:ally.id},charges:1,radius:12});
  else if(two){const pair=[ally,...allies(e,u).filter(t=>t.id!==ally.id)].slice(0,2);field(w,u,'stitch-circuit',u,2.5,{passengers:pair.map(t=>t.id),points:pair.map(point)});}
  else {let remaining=200;for(const [key,m] of Object.entries(s.marks).filter(([k,m])=>k.startsWith('care:')&&m.expires>w.tick)){const t=get(e,key.slice(5));if(!t?.alive||distance(t,u)>180)continue;const n=Math.min(remaining,m.value);if(n){field(w,u,'triage',t,4.1,{roster:{target:t.id,value:n,next:w.tick+30,pulses:4}});remaining-=n;m.value-=n;}if(remaining<=0)break;}}break;
 case 'rux-emberchain':
  if(one){cap(w,u,'letter',4);device(w,u,'letter',target??p,3,{radius:15,roster:{target:target?.id,arm:w.tick+90,damage:85}});}
  else if(two){const stamp=Object.values(s.marks).find(m=>m.expires>w.tick&&m.point);field(w,u,'courier-road',u,3,{points:[point(u),point(stamp?.point??p)]});}
  else {field(w,u,'postal-seal',p,1.7,{radius:18});for(const c of owned(w,u.id,'letter')){c.roster={...c.roster,origin:point(c),destination:point(p),arm:w.tick+12,movingUntil:w.tick+48};c.expires=w.tick+49;}}break;
 case 'joruun-jadecoil':
  if(one){cap(w,u,'jade-slab',1);facingPanel(w,u,'jade-slab',p,a,4,60,99);}
  else if(two){const slab=own('jade-slab');if(slab){slab.roster={origin:point(slab),heading:slab.angle,arm:w.tick+20};}else shield(w,u,70);}
  else {const left=along(p,a+Math.PI/2,-45),right=along(p,a+Math.PI/2,45);const slabs=[facingPanel(w,u,'jade-slab',left,a,5,30,99),facingPanel(w,u,'jade-slab',right,a,5,30,99)].filter((c):c is V3Construct=>!!c);link(w,u,'jade-gate',slabs,5,{roster:{arm:w.tick+21,value:s.resource>=40?1:0},angle:a});if(s.resource>=40)s.resource-=40;}break;
 case 'astrax-mire':
  if(one)mark(w,u,'measure:'+target!.id,0,3,{point:point(target!),last:0});
  else if(two)device(w,u,'mile-marker',p,4,{radius:16});
  else for(const [key,m] of Object.entries(s.marks).filter(([k,m])=>k.startsWith('measure:')&&m.expires>w.tick)){const t=get(e,key.slice(8));if(t?.alive&&distance(t,u)<=140)field(w,u,'verdict',t,1.1,{roster:{target:t.id,arm:w.tick+30}});}break;
 case 'prismelle-cade':
  if(one){cap(w,u,'crystal-pane',3);facingPanel(w,u,'crystal-pane',p,a,4,55,1);}
  else if(two){const pane=own('crystal-pane')!,end=distance(u,pane.points[0])>35?along(u,angle(u,pane.points[0]),35):pane.points[0];transit(w,e,u,end,35,.35);turn(pane);}
  else for(let i=-1;i<=1;i++)facingPanel(w,u,'crystal-pane',along(p,a+i*.55,25),a+i*.55,4,45,1);break;
 case 'ashkar-veilhand':
  if(one)field(w,u,'ember-brand',target!,3,{roster:{target:target!.id,next:w.tick+15,pulses:6},radius:10});
  else if(two){s.partner=ally.id;transit(w,e,u,along(ally,angle(ally,u),22),150,.4);mark(w,ally,'intercession',1,1.5,{target:u.id});}
  else field(w,u,'penance',target!,4,{radius:60,roster:{target:target!.id,arm:w.tick+24,next:w.tick+24,pulses:6}});break;
 case 'maris-solquill':
  if(one){cap(w,u,'waypoint',3);const end=along(p,a,50);if(e.legalSegment(p,end))device(w,u,'waypoint',p,5,{points:[point(p),end]});}
  else if(two){const lantern=own('waypoint')!;rotate(lantern,angle(lantern,ally));field(w,u,'spotlight',ally,1.5,{radius:50,roster:{target:ally.id}});}
  else link(w,u,'atlas',owned(w,u.id,'waylight').slice(0,3),5);break;
 case 'odo-bogsong':
  if(one){cap(w,u,'drum',2);device(w,u,'drum',p,3.7,{radius:40,roster:{next:w.tick+36,pulses:3,interval:36}});}
  else if(two){const drum=own('drum')!;drum.roster!.next=Math.max(w.tick+1,drum.roster!.next!-8);drum.roster!.value=1;emit(w,'beat_rescheduled',u.id,{object:drum.id,value:drum.roster!.next});}
  else field(w,u,'long-measure',u,4.8,{radius:130,roster:{next:w.tick+36,pulses:4,interval:36}});break;
 case 'mourn-ashwake':
  if(one){const patch=own('ash-patch');if(patch){const old=point(patch);moveConstruct(e,patch,p,45);lineHit(w,e,u,old,patch,16,60,slot);}else device(w,u,'ash-patch',u,6,{radius:18});}
  else if(two){const patch=own('ash-patch')!;field(w,u,'furnace-current',u,3,{points:[point(u),point(patch)],angle:angle(u,patch)});}
  else for(const patch of owned(w,u.id,'ash-patch').filter(c=>distance(c,u)<=140)){field(w,u,'ember-wall',patch,4.1,{radius:22,points:[along(patch,a+Math.PI/2,-25),along(patch,a+Math.PI/2,25)],roster:{arm:w.tick+30,destination:along(patch,a,35),origin:point(patch),movingUntil:w.tick+120}});patch.hp=0;}break;
 case 'dolm-runesunder':
  if(one)field(w,u,'tilt-plate',p,3,{radius:32,angle:a,roster:{arm:w.tick}});
  else if(two)for(const t of enemies(e,u,65)){hurt(w,e,u,t,75,slot);if(w.constructs.some(c=>c.kind==='tilt-plate'&&active(w,c)&&distance(c,t)<33))move(w,e,t,along(t,a,18),18);}
  else for(let i=0;i<3;i++)field(w,u,'drift',along(u,a,35+i*35),3.5,{radius:32,angle:a,roster:{arm:w.tick+27*(i+1),value:i}});break;
 case 'garruk-mawsuture':
  if(one)createJaws(w,u,p,a,3.5,17,s.resource);
  else if(two){const tooth=own('jaw-tooth')!;const old=point(tooth);moveConstruct(e,tooth,p,45);lineHit(w,e,u,old,tooth,12,65,slot);for(const c of w.constructs.filter(c=>c.kind==='ground-hazard'&&c.supports.includes(tooth.id))){c.points=c.supports.map(id=>point(w.constructs.find(t=>t.id===id)!));c.hit=[];c.roster={...c.roster,arm:w.tick+17,value:.5};}}
  else for(let i=0;i<3;i++)createJaws(w,u,along(u,a,25+i*38),a+(i%2?.35:-.35),5,17+i*24,s.resource);s.resource=0;break;
 case 'coiljack-ampfist':
  if(one)segment(w,u,'turnstile',p,55,3.5,a,{charges:1});
  else if(two)field(w,u,'earth-clip',ally,2.5,{roster:{target:ally.id},charges:1});
  else for(let i=0;i<2;i++)segment(w,u,'turnstile',p,70,5,a+i*Math.PI/2,{charges:1,roster:{value:2}});break;
 case 'talan-slipshot':
  if(one){cap(w,u,'mirror',2);facingPanel(w,u,'mirror',p,a+(r.direction??1)*Math.PI/4,5,40,1);}
  else if(two)bolt(w,u,u,p,75,slot,{reflected:false});
  else {const mirror=owned(w,u.id,'mirror').filter(c=>e.legalSegment(c,p)).sort((a,b)=>distance(a,target!)-distance(b,target!))[0];if(mirror){field(w,u,'delayed-hit',mirror,1,{points:[point(mirror),point(p)],radius:10,roster:{arm:w.tick+24,damage:150,slot:'ultimate'}});for(const offset of [-12,12])field(w,u,'spotlight',mirror,.8,{points:[point(mirror),along(p,a+Math.PI/2,offset)],roster:{value:0}});}}break;
 case 'calixa-broadwake':
  if(one){cap(w,u,'buoy',2);segment(w,u,'buoy',p,60,4,a,{charges:1});}
  else if(two){const old=point(u);move(w,e,u,along(u,(u.facing??a)+Math.PI/2,38),38,false);lineHit(w,e,u,old,along(old,(u.facing??a)+Math.PI/2,70),18,60,slot);if(s.resource){for(const t of enemies(e,u,65))move(w,e,t,along(t,a+Math.PI/2,12),12);s.resource--;}}
  else {const heading=(u.facing??(u.team==='blue'?0:Math.PI))+(r.direction??1)*Math.PI/2;for(let i=0;i<3;i++){const origin=along(u,heading+Math.PI/2,(i-1)*35);field(w,u,'broadside',origin,3.2,{points:[point(origin),along(origin,heading,85)],radius:17,roster:{arm:w.tick+24*(i+1),damage:100}});}}break;
 case 'brohm-caskfall':
  if(one){cap(w,u,'foam',2);field(w,u,'foam',u,4,{points:[point(u),along(u,a,90)],angle:a,radius:14});}
  else if(two){const foam=own('foam')!;foam.roster={arm:w.tick+14,heading:foam.angle+Math.PI};shield(w,u,Math.min(140,s.resource*1.4));s.resource=0;}
  else device(w,u,'pressure-cask',p,3.5,{hp:3,maxHp:3,radius:18,supports:[],points:owned(w,u.id,'foam').map(point),roster:{next:w.tick+30,pulses:3,interval:24}});break;
 case 'maelis-chromabloom':
  if(one){cap(w,u,'canvas',3);facingPanel(w,u,'canvas',p,a,3.5,55,99);}
  else if(two){const canvas=own('canvas');if(canvas){canvas.hp=Math.min(canvas.maxHp,canvas.hp+1);canvas.roster={...canvas.roster,revealWindow:w.tick+60};}else field(w,u,'spotlight',p,2,{radius:30});}
  else link(w,u,'gallery',owned(w,u.id,'canvas').slice(0,3),4,{roster:{next:w.tick+33,pulses:3,value:0}});break;
 case 'axiom-rail':
  if(one){cap(w,u,'rail',2);const end=along(p,a,65);if(e.legalSegment(p,end))device(w,u,'rail',p,5,{points:[point(p),end],radius:12});}
  else if(two){const rail=own('rail')!;device(w,u,'rail-cart',rail,2.5,{radius:12,supports:[rail.id],roster:{origin:point(rail),destination:point(rail.points[1]),movingUntil:w.tick+75,next:w.tick+15}});}
  else {const rail=owned(w,u.id,'rail').sort((a,b)=>distance(b.points[1],u)-distance(a.points[1],u))[0];const end=rail.points[1],heading=angle(rail.points[0],end);field(w,u,'delayed-hit',end,1.2,{points:[point(end),along(end,heading,95+s.resource*10)],radius:18,supports:[rail.id],roster:{arm:w.tick+27,damage:135,slot:'ultimate'}});s.resource=0;}break;
 case 'brakka-fenn':
  if(one)field(w,u,'complaint',p,.7,{radius:23,roster:{arm:w.tick+15,damage:60}});
  else if(two){s.partner=ally.id;field(w,u,'escort',u,2.5,{points:[point(u),point(ally)],roster:{target:ally.id}});}
  else field(w,u,'writ',target!,3,{radius:75,roster:{target:target!.id,value:0}});break;
 case 'pippa-fuseburst':
  if(one){cap(w,u,'firework-rack',2);device(w,u,'firework-rack',p,4,{points:[point(p),along(p,a,45)],radius:12,roster:{arm:w.tick+27,damage:100}});}
  else if(two){const rack=owned(w,u.id,'firework-rack').find(c=>!c.roster?.fired);if(rack){rack.roster!.heading=rack.angle+Math.PI/2;rack.roster!.next=w.tick+1;}else field(w,u,'spotlight',p,2,{radius:30});}
  else {scheduleGrid(w,e,u,p,120,'stage-cell',23,100,s.resource);s.resource=0;}break;
 case 'bryx-emberkite':
  if(one){cap(w,u,'thermal',2);device(w,u,'thermal',p,3,{points:[point(p),along(p,a,80)],angle:a,radius:18});}
  else if(two){const vent=own('thermal')!;vent.roster={arm:w.tick+1,heading:vent.angle+Math.PI/2,consent:[]};}
  else link(w,u,'thermocline',owned(w,u.id,'thermal').slice(0,2),4,{radius:25});break;
 case 'murdle-ridgehide':
  if(one){cap(w,u,'dorsal-wall',2);const wall=facingPanel(w,u,'dorsal-wall',p,a,4,40,1);if(wall){wall.roster={value:1};s.resource--;}}
  else if(two){const wall=own('dorsal-wall')!;const old=point(wall);if(distance(wall,u)<=60&&moveConstruct(e,wall,u,60)){for(const t of e.units.filter(t=>t.alive&&lineDistance(t,old,u)<18))move(w,e,t,along(t,a+Math.PI/2,10),10);wall.hp=0;wall.roster!.value=0;s.resource=Math.min(4,s.resource+1);}}
  else for(let i=0;i<3;i++){const start=along(u,a+Math.PI/2,(i-1)*80);const wall=facingPanel(w,u,'dorsal-wall',start,a,5,30,1);if(wall){wall.roster={value:1,origin:point(start),destination:along(start,a,60),movingUntil:w.tick+150};s.resource--;}}break;
 case 'nemea-halolink':
  if(one){cap(w,u,'score-circle',2);device(w,u,'score-circle',p,3,{radius:35,charges:1});}
  else if(two)link(w,u,'score-link',owned(w,u.id,'score-circle').slice(0,2),3);
  else {const group='chorus:'+w.tick;for(let i=0;i<3;i++)field(w,u,'chorus-circle',along(u,a+(i-1)*1.8,50),3.5,{radius:24,roster:{arm:w.tick+(i+1)*30,value:s.resource,group}});s.resource=0;}break;
 case 'thimble-briarwish':
  if(one){const hp=2+s.resource;device(w,u,'planter',p,4,{radius:20,charges:1,hp,maxHp:hp});s.resource=0;}
  else if(two){const planter=own('planter')!;planter.roster={origin:point(planter),destination:along(planter,a,55),movingUntil:w.tick+75};e.slow?.(u,.2,2.5);}
  else for(let i=0;i<3;i++){const start=along(u,a+Math.PI/2,(i-1)*50);device(w,u,'planter',start,5,{radius:20,charges:1,roster:{origin:point(start),destination:along(start,a,70),movingUntil:w.tick+150,value:1}});}break;
 case 'sevrin-inkseal':
  if(one){cap(w,u,'court',1);device(w,u,'court',p,3.5,{radius:70});}
  else if(two){const court=own('court');if(target?.team===u.team&&court&&distance(target,court)<court.radius){const actor=v3Actor(w,target.id);
    if(actor.yawn)delete actor.yawn;
    else {const tax=actor.taxHistory.findLast(t=>!t.cleared&&t.tick+150>w.tick);if(tax){tax.cleared=true;actor.recoveryUntil=Math.max(w.tick,actor.recoveryUntil-ticks(tax.seconds));}}
   }else if(court)moveConstruct(e,court,p,45);}
  else {const court=own('court')!;court.radius=125;court.expires=w.tick+135;court.roster={value:1};}break;
 case 'koro-cloudtail':
  if(one){cap(w,u,'pole',2);const landing=along(p,a,60);if(e.legalSegment(p,landing))device(w,u,'pole',p,5,{points:[point(p),landing]});}
  else if(two){const pole=own('pole')!;transit(w,e,u,pole.points[1],65,.35,[pole.id]);}
  else link(w,u,'runway',owned(w,u.id,'pole').slice(0,2),4,{roster:{consent:[]}});break;
 case 'bram-stonebranch':
  if(one){cap(w,u,'column',5);device(w,u,'column',p,5,{radius:12});}
  else if(two){const columns=owned(w,u.id,'column');if(columns.length>=2)link(w,u,'leaf-roof',columns.slice(0,2),3,{charges:2,radius:30});else shield(w,u,45+s.resource*20);s.resource=0;}
  else {const columns:V3Construct[]=[];for(let i=0;i<3;i++){const c=device(w,u,'column',along(p,i*Math.PI*2/3,50),5,{radius:12});if(c)columns.push(c);}link(w,u,'shade-grove',columns,5,{radius:65,charges:3});}break;
 case 'toma-bellbreak':
  if(one){const victim=target??enemies(e,u,60)[0];if(victim&&distance(u,victim)<=60){hurt(w,e,u,victim,65,slot,{direct:true});if(w.casts.some(c=>c.request.actor===victim.id))s.timers.parry=w.tick+90;}}
  else if(two){s.timers.guard=w.tick+18;s.timers.empowered=(s.timers.parry??0)>w.tick?w.tick+18:0;s.timers.parry=0;}
  else field(w,u,'bell-rhythm',u,1.21,{radius:75,roster:{target:u.id,arm:w.tick+29}});break;
 case 'ravelle-skyrake':
  if(one){survey(w,u,p);field(w,u,'spotlight',p,3.5,{radius:30});blast(w,e,u,p,30,30,slot);}
  else if(two){const dest=along(u,(u.facing??a)+Math.PI/2,50);transit(w,e,u,dest,50,.5);}
  else scheduleGrid(w,e,u,p,130,'airspace-cell',24,90,0);break;
 }
}

function moveConstruct(e:V3Environment,c:V3Construct,to:V3Point,max:number){const from=point(c),dest=distance(c,to)>max?along(c,angle(c,to),max):point(to);if(!e.legalSegment(c,dest)||!e.legalPoint(dest))return false;const dx=dest.x-c.x,dy=dest.y-c.y;c.points=c.points.map(p=>({x:p.x+dx,y:p.y+dy}));Object.assign(c,dest);return distance(from,dest)>0;}
function createJaws(w:V3World,u:V3Unit,p:V3Point,a:number,seconds:number,delay:number,scrap:number){
 const gap=50+Math.min(3,scrap)*6;const ends=[along(p,a+Math.PI/2,-gap/2),along(p,a+Math.PI/2,gap/2)];
 const teeth=ends.map(p=>device(w,u,'jaw-tooth',p,seconds)).filter((c):c is V3Construct=>!!c);
 if(teeth.length===2)link(w,u,'ground-hazard',teeth,seconds,{radius:18,roster:{arm:w.tick+delay,value:1},angle:a});
}
function scheduleGrid(w:V3World,e:V3Environment,u:V3Unit,p:V3Point,width:number,kind:'stage-cell'|'airspace-cell',warning:number,damage:number,shieldBreak:number){
 // A common fixed horizontal escape strip remains free across both artillery kits.
 // Cells are bounded to one quadrant at a time; no simultaneous full-grid blast.
 const candidates=[p.y,p.y-45,p.y+45,LANE_Y-30,LANE_Y-180,LANE_Y+180].map(y=>Math.max(PLAY_MIN_Y+25,Math.min(PLAY_MAX_Y-25,y)));
 const safeY=w.escapeCorridor&&w.escapeCorridor.expires>w.tick?w.escapeCorridor.y:candidates.find(y=>e.legalSegment({x:p.x-width/2,y},{x:p.x+width/2,y}));
 if(safeY===undefined){emit(w,'geometry_refused',u.id,{reason:'no-traversable-artillery-escape'});return;}
 w.escapeCorridor={y:safeY,expires:w.tick+120};
 const offsets=[[-1,-1],[1,-1],[-1,1],[1,1]];
 for(let i=0;i<4;i++){const center={x:p.x+offsets[i][0]*width/4,y:p.y+offsets[i][1]*width/4};
  if(!e.legalPoint(center))continue;
  field(w,u,kind,center,3.8,{radius:width/4,roster:{arm:w.tick+warning+i*23,damage,slot:'ultimate',safeY,value:shieldBreak,overhead:kind==='airspace-cell'}});
 }
 emit(w,'escape_corridor_reserved',u.id,{value:safeY,reason:kind});
}
function survey(w:V3World,u:V3Unit,p:V3Point){const sector=owned(w,u.id,'survey-sector').find(c=>distance(c,p)<50);if(sector){sector.expires=w.tick+150;return;}cap(w,u,'survey-sector',2);field(w,u,'survey-sector',p,5,{radius:45});}

/** Tick all preparations and delayed actions before the existing unit executor. */
export function stepRoster(w:V3World,e:V3Environment){
 for(const u of e.units){
  const s=rosterState(w,u.id);
  for(const [key,m] of Object.entries(s.marks))if(m.expires<=w.tick)delete s.marks[key];
  for(const [key,tick] of Object.entries(s.timers))if(key.startsWith('plate:')&&tick<=w.tick){s.resource=Math.min(4,s.resource+1);delete s.timers[key];}
  for(const [key,tick] of Object.entries(s.timers))if(tick<w.tick-1800&&!key.startsWith('plate:'))delete s.timers[key];
  if(!u.alive)continue;
  const prev=s.lastPoint??point(u),traveled=distance(prev,u),heading=traveled>.01?angle(prev,u):s.lastHeading??0;
  if(traveled>.1)s.timers.lastMoved=w.tick;
  const turn=Math.abs(Math.atan2(Math.sin(heading-(s.lastHeading??heading)),Math.cos(heading-(s.lastHeading??heading))));
  if(u.hero==='calixa-broadwake'){if(turn>Math.PI/2){s.resource=0;s.travel=0;}else s.travel+=traveled;if(s.travel>=45){s.resource=Math.min(2,s.resource+1);s.travel%=45;}}
  if(u.hero==='brohm-caskfall'&&!owned(w,u.id,'foam').some(c=>lineDistance(u,c.points[0],c.points[1])<14))s.resource=Math.max(0,s.resource-1/30);
  if(u.hero==='ashkar-veilhand'&&(!s.partner||!get(e,s.partner)?.alive))s.partner=allies(e,u,150).filter(t=>t.id!==u.id).sort((a,b)=>a.hp/a.maxHp-b.hp/b.maxHp)[0]?.id;
  for(const other of enemies(e,u,180)){
   const observation=s.marks['motion:'+other.id];const moved=observation?.point?distance(observation.point,other):0;
   const h=observation?.point&&moved>.01?angle(observation.point,other):observation?.heading??0;
   if(u.hero==='mireth-lune'){
    const key='heading:'+other.id,lock=s.timers[key]??0,total=(observation?.value??0)+moved;
    if(total>=70&&lock<=w.tick){mark(w,u,key,1,3,{heading:h,point:point(other)});s.timers[key]=w.tick+180;}
    s.marks['motion:'+other.id]={expires:w.tick+90,value:total>=70?0:total,point:point(other),heading:h};
   }
   if(u.hero==='astrax-mire'){
    const meter=s.marks['footfall:'+other.id];s.marks['footfall:'+other.id]={expires:w.tick+90,value:Math.min(160,(meter?.value??0)*.989+moved),point:point(other)};
    const measure=marked(w,u,'measure:'+other.id);
    if(measure){measure.last=(measure.last??0)+moved;while(measure.last>=35){measure.value=Math.min(3,measure.value+1);measure.last-=35;}}
   }
   if(u.hero==='dolm-runesunder'){
    const old=s.marks['turn:'+other.id];if(old&&w.tick-(old.last??0)<=12&&Math.abs(Math.atan2(Math.sin(h-(old.heading??h)),Math.cos(h-(old.heading??h))))>70*Math.PI/180&&moved>.1){
     cap(w,u,'tilt-plate',2);field(w,u,'tilt-plate',other,2,{radius:20,angle:h,roster:{value:1}});s.marks['turn:'+other.id]={expires:w.tick+30,value:0,heading:h,last:w.tick};
    }else if(!old||w.tick-(old.last??0)>12)s.marks['turn:'+other.id]={expires:w.tick+30,value:0,heading:h,last:w.tick};
   }
   if(u.hero==='coiljack-ampfist'&&((rosterState(w,other.id).timers.dashEnded??0)>=w.tick-1||observation?.value===1&&!other.dashing)&&distance(u,other)<=110&&(s.timers['inspect:'+other.id]??0)<=w.tick){s.resource=Math.min(2,s.resource+1);s.timers['inspect:'+other.id]=w.tick+120;}
   if(u.hero==='coiljack-ampfist')s.marks['motion:'+other.id]={expires:w.tick+30,value:other.dashing?1:0,point:point(other),heading:h};
   if(u.hero==='ravelle-skyrake'&&w.tick%30===0)survey(w,u,other);
   if(u.hero==='toma-bellbreak')for(const cast of w.casts.filter(c=>c.request.actor===other.id&&distance(u,other)<=105))s.marks['bell:'+other.id]={expires:cast.commit+36,value:cast.commit};
  }
  if(u.hero==='serrin-galecrest')for(const p of e.projectiles??[]){
   if(p.team===u.team)continue;const key='near-shot:'+p.id,m=s.marks[key],d=distance(p,u);
   if(d<32&&!m)s.marks[key]={expires:w.tick+45,value:d,point:point(p)};
   else if(m&&d>45&&(s.timers[key]??0)<=w.tick){s.resource=Math.min(2,s.resource+1);s.timers[key]=w.tick+120;delete s.marks[key];}
  }
  // Debt counts actual shield grants, not the shield that existed at contract start.
  if(u.hero==='kael-vespera')for(const [key,m] of Object.entries(s.marks).filter(([k])=>k.startsWith('contract:'))){const t=get(e,key.slice(9));if(t){m.value=Math.min(160,m.value+Math.max(0,t.shield-(m.shield??t.shield)));m.shield=t.shield;}}
  s.lastPoint=point(u);s.lastHeading=heading;
 }
 for(const c of [...w.constructs]){
  const u=get(e,c.owner);if(!u)continue;
  const d=c.roster??={};const s=rosterState(w,u.id);
  if(c.kind==='dorsal-wall'&&d.value&&!s.timers['plate:'+c.id])s.timers['plate:'+c.id]=c.expires;
  if(c.kind==='hark'&&(c.hp<=0||c.expires<=w.tick)&&!c.progress.destroyed){c.progress.destroyed=1;s.timers.harkReturn=w.tick+240;s.resource=0;}
  if((c.hp<=0||c.expires<=w.tick)&&!c.progress.spent){
   c.progress.spent=1;
   for(const g of e.units.filter(g=>g.alive&&g.hero==='garruk-mawsuture'&&distance(g,c)<180&&(g.team!==c.team||c.kind==='jaw-tooth')))rosterState(w,g.id).resource=Math.min(3,rosterState(w,g.id).resource+1);
  }
  if(!active(w,c)||!u.alive)continue;
  if(d.target&&['veil','fen-guard','suture','earth-clip','bell-rhythm','spotlight'].includes(c.kind)){const t=get(e,d.target);if(t)Object.assign(c,point(t));}
  if(d.destination&&d.origin&&d.movingUntil&&(!d.arm||w.tick>=d.arm)&&c.kind!=='letter'){
   const start=d.arm??c.created,total=Math.max(1,d.movingUntil-start),t=Math.min(1,(w.tick-start)/total);
   moveConstruct(e,c,{x:d.origin.x+(d.destination.x-d.origin.x)*t,y:d.origin.y+(d.destination.y-d.origin.y)*t},10);
  }
  switch(c.kind){
  case 'vault-transit':{
   const passenger=get(e,c.passengers[0]);if(!passenger?.alive||passenger.controlled){c.passengers=[];c.hp=0;emit(w,'route_cancelled',c.owner,{object:c.id,reason:'interrupted'});break;}
   const t=Math.min(1,(w.tick-c.created)/Math.max(1,(d.movingUntil??c.expires)-c.created));
   const from=c.points[0],end=c.points[1],next={x:from.x+(end.x-from.x)*t,y:from.y+(end.y-from.y)*t};
   if(!(e.legalTravel??e.legalSegment)(passenger,next)||!e.legalPoint(next)){c.passengers=[];c.hp=0;emit(w,'route_cancelled',c.owner,{object:c.id,reason:'terrain'});break;}
   Object.assign(passenger,next);Object.assign(c,next);
   if(t>=1){c.passengers=[];c.hp=0;rosterState(w,passenger.id).timers.dashEnded=w.tick;
    if(passenger.hero==='koro-cloudtail'){rosterState(w,passenger.id).timers.balanced=w.tick+60;for(const enemy of enemies(e,passenger,25))move(w,e,enemy,along(enemy,angle(passenger,enemy),10),10);}
    emit(w,'route_completed',passenger.id,{object:c.id});}break;}
  case 'track-lantern':case 'buoy':case 'spotlight':
   for(const t of e.units.filter(t=>t.alive&&t.team!==u.team&&(c.points.length>=2?lineDistance(t,c.points[0],c.points[1])<25:distance(t,c)<(c.radius||30))))status(w,e,t,'reveal',.2);break;
  case 'canvas':if((d.revealWindow??0)>w.tick)for(const t of e.units.filter(t=>t.alive&&t.team!==u.team&&distance(t,c)<60&&Math.cos(angle(c,t)-c.angle)>0))status(w,e,t,'reveal',.2);break;
  case 'understory':if(w.tick%30===0){const lines=owned(w,u.id,'mycelium');for(const t of allies(e,u,250).filter(t=>lines.some(line=>lineDistance(t,line.points[0],line.points[1])<18)))heal(w,e,t,12);}break;
  case 'jade-slab':if(d.arm&&d.arm<=w.tick){rotate(c,(d.heading??c.angle)+Math.PI/2);d.arm=0;for(const t of e.units.filter(t=>t.alive&&c.points.length===2&&lineDistance(t,c.points[0],c.points[1])<20))move(w,e,t,along(t,c.angle,24),24);}break;
  case 'jade-gate':if(d.arm&&d.arm<=w.tick&&d.value){d.arm=0;d.closing=w.tick;for(const t of e.units.filter(t=>t.alive&&lineDistance(t,c.points[0],c.points[1])<20))move(w,e,t,along(t,c.angle,24),24);}break;
  case 'glass-rapture':if(d.arm&&w.tick>=d.arm&&!d.fired){d.fired=true;for(let i=0;i<3;i++){const a=c.points[i],b=c.points[(i+1)%3];
    for(const t of enemies(e,u,350).filter(t=>lineDistance(t,a,b)<12&&!c.hit.includes(t.id))){
     const fraction=distance(a,t)/Math.max(1,distance(a,b));if([.25,.5,.75].some(g=>Math.abs(g-fraction)<.07))continue;
     c.hit.push(t.id);hurt(w,e,u,t,155,'ultimate');e.control?.(u,t,.55);
    }}for(const id of c.supports){const fork=w.constructs.find(t=>t.id===id);if(fork)fork.hp=0;}}break;
  case 'anchor-ram':if(d.arm&&w.tick>=d.arm&&!d.fired){d.fired=true;const end=along(c,c.angle,90);lineHit(w,e,u,c,end,22,90,'skill1');for(const t of enemies(e,u,300).filter(t=>lineDistance(t,c,end)<22))move(w,e,t,along(t,c.angle,24));for(const object of w.constructs.filter(t=>t.team!==u.team&&t.attackable!==false&&lineDistance(t,c,end)<24))object.hp=Math.max(0,object.hp-1);}break;
  case 'tunnel-ram':if(d.arm&&w.tick>=d.arm){for(const t of enemies(e,u,300).filter(t=>distance(t,c)<30&&!c.hit.includes(t.id))){c.hit.push(t.id);hurt(w,e,u,t,105,'ultimate');move(w,e,t,along(t,c.angle+(Math.sin(angle(c,t)-c.angle)>0?1:-1)*Math.PI/2,24));}for(const other of w.constructs.filter(t=>t.team!==u.team&&t.attackable!==false&&distance(c,t)<28))other.hp=0;}break;
  case 'false-exit':if(d.target&&d.arm&&w.tick>=d.arm){const t=get(e,d.target);if(t&&d.destination)move(w,e,t,d.destination,75,false);c.hp=0;}break;
  case 'mercy':if(c.expires-w.tick<=1&&!d.fired){d.fired=true;const t=get(e,d.target);const debt=t?marked(w,u,'contract:'+t.id):undefined;if(t&&debt)hurt(w,e,u,t,Math.min(160,debt.value),'ultimate');}break;
  case 'stitch-circuit':{const a=get(e,c.passengers[0]),b=get(e,c.passengers[1]);if(!a?.alive||!b?.alive||distance(a,b)>180)c.hp=0;else c.points=[point(a),point(b)];break;}
  case 'triage':if(d.next&&w.tick>=d.next&&(d.pulses??0)>0){d.next+=30;d.pulses!--;const t=get(e,d.target);if(t)heal(w,e,t,(d.value??0)/4);const n=(d.value??0)*.15/4;u.hp=Math.max(1,u.hp-n);e.nonlethalCost?.(u,n);}break;
  case 'letter':{
   const carrier=get(e,d.target);if(carrier?.alive&&!d.destination)Object.assign(c,point(carrier));
   if(d.destination&&d.origin&&d.arm&&w.tick>=d.arm){const t=Math.min(1,(w.tick-d.arm)/Math.max(1,(d.movingUntil??c.expires)-d.arm));const old=point(c);moveConstruct(e,c,{x:d.origin.x+(d.destination.x-d.origin.x)*t,y:d.origin.y+(d.destination.y-d.origin.y)*t},20);for(const enemy of enemies(e,u,400).filter(t=>lineDistance(t,old,c)<18&&!c.hit.includes(t.id))){c.hit.push(enemy.id);hurt(w,e,u,enemy,90,'ultimate');}}
   else if(d.arm&&w.tick>=d.arm&&!d.fired){d.fired=true;blast(w,e,u,c,40,85);c.hp=0;}
   break;}
  case 'verdict':if(d.arm&&w.tick>=d.arm&&!d.fired){d.fired=true;const t=get(e,d.target),m=t?marked(w,u,'measure:'+t.id):undefined;if(t&&m){hurt(w,e,u,t,Math.min(Math.max(0,t.hp-1),m.value*40),'ultimate',{nonlethal:true});e.slow?.(t,.1*m.value,1);m.value=0;}}break;
  case 'ember-brand':case 'penance':if(d.next&&w.tick>=d.next&&(d.pulses??0)>0){d.next+=15;d.pulses!--;const t=get(e,d.target),ember=t?marked(w,u,'ember:'+t.id):undefined;
   if(!t||!ember||w.tick-(ember.last??0)>30||c.kind==='penance'&&distance(t,c)>c.radius){c.hp=0;break;}hurt(w,e,u,t,10+ember.value*7,c.kind==='penance'?'ultimate':'skill1');}break;
  case 'drum':case 'long-measure':if(d.next&&w.tick>=d.next&&(d.pulses??0)>0){d.next+=d.interval??36;d.pulses!--;d.arm=w.tick;
   if(c.kind==='drum'){blast(w,e,u,c,40,30);if(d.value){for(const ally of allies(e,u).filter(t=>distance(t,c)<45))shield(w,ally,35);d.value=0;}}
   emit(w,'public_beat',u.id,{object:c.id,value:d.pulses});}break;
  case 'drift':if(d.arm&&w.tick>=d.arm&&!d.fired){d.fired=true;c.kind='tilt-plate';if(d.value===2)for(const t of enemies(e,u).filter(t=>distance(t,c)<32))e.control?.(u,t,.55);}break;
  case 'pressure-cask':if(d.next&&w.tick>=d.next&&(d.pulses??0)>0){d.next+=24;d.pulses!--;const strips=owned(w,u.id,'foam');for(const t of enemies(e,u).filter(t=>strips.length?strips.some(c=>lineDistance(t,c.points[0],c.points[1])<18):distance(t,c)<40)){
    if((c.progress[t.id]??0)>w.tick)continue;c.progress[t.id]=w.tick+24;hurt(w,e,u,t,strips.length?65:30,'ultimate');const current=strips[0];move(w,e,t,along(t,(current?.angle??0)+Math.PI/2,16),16);}}break;
  case 'gallery':if(d.next&&w.tick>=d.next&&(d.pulses??0)>0){d.next+=33;d.pulses!--;const canvas=w.constructs.find(t=>t.id===c.supports[(d.value??0)%c.supports.length]);d.value=(d.value??0)+1;if(canvas){rotate(canvas,canvas.angle+Math.PI/2);if(canvas.roster?.property==='utility')for(const ally of allies(e,u).filter(t=>distance(t,canvas)<55))shield(w,ally,40);else if(canvas.roster?.property)blast(w,e,u,canvas,50,50,'ultimate');}}break;
  case 'rail-cart':if(d.next&&w.tick>=d.next){d.next+=18;const t=enemies(e,u,250).filter(t=>distance(t,c)<100&&e.legalSegment(c,t))[0];if(t)bolt(w,u,c,t,35,'skill2');}break;
  case 'complaint':if(d.arm&&w.tick>=d.arm&&!d.fired){d.fired=true;for(const t of enemies(e,u).filter(t=>distance(t,c)<23)){hurt(w,e,u,t,60);if(marked(w,u,'offender:'+t.id))e.control?.(u,t,.4);}}break;
  case 'writ':{const t=get(e,d.target),offender=t?marked(w,u,'offender:'+t.id):undefined;if(t&&offender&&distance(t,c)<75&&(offender.last??0)>=c.created&&!d.fired){d.fired=true;status(w,e,t,'disarm',.55);hurt(w,e,u,t,85,'ultimate');}break;}
  case 'firework-rack':if(d.next&&w.tick>=d.next&&!d.fired){rotate(c,d.heading??c.angle+Math.PI/2);d.next=0;}
   if(d.arm&&w.tick>=d.arm&&!d.fired){d.fired=true;const caught=enemies(e,u,300).filter(t=>lineDistance(t,c.points[0],c.points[1])<13);lineHit(w,e,u,c.points[0],c.points[1],13,100,'skill1');if(caught.length)s.resource=Math.min(2,s.resource+1);c.hp=0;}break;
  case 'stage-cell':case 'airspace-cell':if(d.arm&&w.tick>=d.arm&&!d.fired){d.fired=true;
   for(const t of enemies(e,u,400).filter(t=>Math.abs(t.x-c.x)<=c.radius&&Math.abs(t.y-c.y)<=c.radius&&Math.abs(t.y-(d.safeY??0))>20)){
    if(d.overhead&&roofIntercept(w,e,t,c))continue;
    if(d.value)t.shield=Math.max(0,t.shield-40*d.value);hurt(w,e,u,t,d.damage??90,'ultimate',{area:true,overhead:!!d.overhead});
    if(c.kind==='stage-cell'&&(s.timers.showToken??0)<=w.tick){s.resource=Math.min(2,s.resource+1);s.timers.showToken=w.tick+100;}
   }
   for(const t of e.battlefieldTargets??[])if(t.alive&&t.team!==u.team&&Math.abs(t.x-c.x)<=c.radius&&Math.abs(t.y-c.y)<=c.radius&&Math.abs(t.y-(d.safeY??0))>20)e.damageBattlefield?.(u,t,d.damage??90,'ultimate');
  }break;
  case 'foam':if(d.arm&&w.tick>=d.arm){c.angle=d.heading??c.angle+Math.PI;d.arm=0;c.points.reverse();}break;
  case 'thermal':if(d.arm&&w.tick>=d.arm){rotate(c,d.heading??c.angle);d.arm=0;for(const id of d.consent??[]){const t=get(e,id);if(t&&distance(t,c)<40)move(w,e,t,along(t,c.angle,22),22,false);}}break;
  case 'score-circle':if(c.charges>0){const ally=allies(e,u).find(t=>distance(t,c)<35);if(ally){c.charges--;mark(w,ally,'next-shield',55,2);}}break;
  case 'chorus-circle':if(d.arm&&Math.abs(w.tick-d.arm)<=3){const candidates=allies(e,u).filter(t=>distance(t,c)<24&&!c.hit.includes(t.id));for(const t of candidates){c.hit.push(t.id);const reward='chorus-reward:'+d.group+':'+t.id;
    if(candidates.length===1&&!marked(w,u,reward)){shield(w,t,50+(d.value??0)*20);rosterState(w,t.id).timers.chorusRecovery=w.tick+30;mark(w,u,reward,1,4);}else heal(w,e,t,12);}}break;
  case 'planter':if(d.movingUntil&&w.tick<d.movingUntil&&w.tick%15===0)for(const t of allies(e,u).filter(t=>distance(t,c)<c.radius))heal(w,e,t,7);break;
  case 'roster-bolt':advanceBolt(w,e,u,c);break;
  case 'delayed-hit':case 'broadside':if(d.arm&&w.tick>=d.arm&&!d.fired){d.fired=true;lineHit(w,e,u,c.points[0],c.points[1],c.radius,d.damage??100,d.slot??'ultimate');}break;
  }
 }
}

function advanceBolt(w:V3World,e:V3Environment,u:V3Unit,c:V3Construct){
 const d=c.roster!,destination=c.points[1],remaining=distance(c,destination),step=Math.min(remaining,(d.speed??360)/30),a=angle(c,destination),next=along(c,a,step);
 if((d.heldUntil??0)>w.tick&&!w.constructs.some(p=>p.kind==='pocket'&&active(w,p)&&p.heldProjectile===c.id))d.heldUntil=w.tick;
 const p:V3Projectile={id:c.id,owner:u.id,x:c.x,y:c.y,team:c.team,vx:Math.cos(a)*(d.speed??360),vy:Math.sin(a)*(d.speed??360),damage:d.damage??75,ultimate:d.slot==='ultimate',consenting:true,redirected:!!d.reflected,homing:false,heldUntil:d.heldUntil};
 const result=v3Projectile(w,e,p,next);if(result==='blocked'){c.hp=0;return;}
 if(d.heldUntil===undefined&&p.heldUntil!==undefined)c.expires+=Math.max(0,p.heldUntil-w.tick);
 d.heldUntil=p.heldUntil;d.damage=p.damage;d.speed=Math.max(1,Math.hypot(p.vx,p.vy));
 if(result==='held')return;
 if(p.rangeScale)c.points[1]=along(c,a,remaining*p.rangeScale);
 if(p.redirected&&!d.reflected){d.reflected=true;c.points[1]=along(c,Math.atan2(p.vy,p.vx),remaining);}
 const victim=enemies(e,u,500).find(t=>lineDistance(t,c,next)<18&&!c.hit.includes(t.id)&&(!d.group||!marked(w,u,'split:'+d.group+':'+t.id)));
 const creep=(e.battlefieldTargets??[]).filter(t=>t.alive&&t.team!==u.team&&lineDistance(t,c,next)<18&&!c.hit.includes(t.id)).sort((a,b)=>distance(c,a)-distance(c,b))[0];
 if(creep&&(!victim||distance(creep,c)<distance(victim,c))){c.hit.push(creep.id);e.damageBattlefield?.(u,creep,p.damage,d.slot??'skill2');if(d.oneShot!==false){c.hp=0;return;}}
 if(victim){c.hit.push(victim.id);let n=p.damage;if(u.hero==='talan-slipshot'){const proof=marked(w,u,'proof:'+victim.id);if(d.reflected&&proof){n=Math.min(130,n*1.2);delete rosterState(w,u.id).marks['proof:'+victim.id];}else if(!d.reflected)mark(w,u,'proof:'+victim.id,1,4);}
  if(d.group)mark(w,u,'split:'+d.group+':'+victim.id,1,3);
  hurt(w,e,u,victim,n,d.slot??'skill2',{direct:true});if(d.oneShot!==false){c.hp=0;return;}}
 Object.assign(c,next);if(remaining<=step)c.hp=0;
}

/** Shared roof handling for both actual lobbed projectiles and scheduled artillery. */
function roofIntercept(w:V3World,e:V3Environment,target:V3Unit,source:V3Point){
 const roof=w.constructs.find(c=>active(w,c)&&c.team===target.team&&['planter','leaf-roof','shade-grove'].includes(c.kind)&&c.charges>0&&
  (c.points.length>=2?lineDistance(target,c.points[0],c.points[1])<35:distance(target,c)<c.radius));
 if(!roof)return false;roof.charges--;const owner=get(e,roof.owner);if(owner)rosterState(w,owner.id).resource=Math.min(2,rosterState(w,owner.id).resource+1);
 if(roof.kind==='planter'&&roof.roster?.value)roof.hp=0;emit(w,'overhead_intercepted',roof.owner,{object:roof.id,target:target.id});return true;
}

/** Individual route interaction; an offer alone never moves an ally. */
export function acceptRosterRoute(w:V3World,e:V3Environment,id:string,object:string,consent:boolean){
 const t=get(e,id),c=w.constructs.find(c=>c.id===object&&active(w,c));if(!consent||!t?.alive||t.controlled||!c||t.team!==c.team||c.hit.includes(id)||w.casts.some(c=>c.request.actor===id))return false;
 const owner=get(e,c.owner);if(!owner?.alive)return false;
 if(c.kind==='partner-trade'){
  if(!c.passengers.includes(id)||distance(t,owner)>120)return false;c.roster!.consent??=[];if(!c.roster!.consent.includes(id))c.roster!.consent.push(id);
  if(c.passengers.every(id=>c.roster!.consent!.includes(id))){const a=point(owner),b=point(t);if(!(e.legalTravel??e.legalSegment)(a,b)||owner.controlled)return false;Object.assign(owner,b);Object.assign(t,a);c.hp=0;emit(w,'route_completed',id,{object:c.id});}return true;
 }
 if(c.kind==='thermal'){if(distance(t,c)>40)return false;
  if((c.roster?.arm??0)>w.tick)(c.roster!.consent??=[]).push(id);
  else {if(!transit(w,e,t,along(t,c.angle,22),22,.22))return false;c.hit.push(id);}return true;}
 if(c.kind!=='runway'&&c.kind!=='pole')return false;
 const from=c.points[0],to=c.points[1];if(!from||!to||distance(t,from)>25||distance(from,to)>65||!e.legalSegment(t,to))return false;
 if(transit(w,e,t,to,65,.35,[...c.supports,c.id])){c.hit.push(id);return true;}return false;
}

export function handOffRosterLetter(w:V3World,e:V3Environment,carrierId:string,letterId:string,recipientId:string){
 const carrier=get(e,carrierId),recipient=get(e,recipientId),letter=w.constructs.find(c=>c.id===letterId&&c.kind==='letter'&&active(w,c));
 if(!carrier?.alive||!recipient?.alive||carrier.controlled||recipient.id===carrier.id||recipient.team!==carrier.team||!letter||letter.team===carrier.team||letter.roster?.target!==carrier.id||distance(carrier,recipient)>25)return false;
 if(w.tick-(rosterState(w,carrier.id).timers.lastMoved??-100)>15)return false;
 letter.roster.target=recipient.id;emit(w,'letter_handed_off',carrier.id,{target:recipient.id,object:letter.id});return true;
}
export function rosterWalking(w:V3World,e:V3Environment,u:V3Unit,from:V3Point,to:V3Point,dash=false):V3Point {
 const s=rosterState(w,u.id);if((s.timers.root??0)>w.tick&&!dash)return point(from);
 const n=distance(from,to);if(n<.0001)return point(to);let next=point(to),multiplier=(s.timers.speed??0)>w.tick?1+s.secondResource:1;
 if(u.hero==='brakka-fenn'&&enemies(e,u).some(t=>marked(w,u,'offender:'+t.id)&&distance(to,t)<distance(from,t)))multiplier*=1.1;
 for(const c of w.constructs.filter(c=>active(w,c))){const d=c.roster??{},friendly=c.team===u.team;
  const segment=c.points.length>=2,near=segment&&lineDistance(from,c.points[0],c.points[1])<(c.radius||18),crossed=segment&&crosses(from,to,c.points[0],c.points[1]);
  if(c.kind==='jade-slab'||c.kind==='hark'||c.kind==='jade-gate'&&d.closing!==undefined){
   const collision=c.kind==='hark'?lineDistance(c,from,next)<c.radius:segment&&lineDistance(next,c.points[0],c.points[1])<18;
   if(collision){if(friendly&&c.kind==='hark')multiplier*=.65;else return point(from);}
  }
  if(c.kind==='shadow-plane'&&c.points.length>=2&&crossed)c.roster={...d,value:1};
  if(c.kind==='canvas'&&crossed)multiplier*=.85;
  if(c.kind==='false-exit'&&!friendly&&!d.target&&lineDistance(c,from,to)<17){d.target=u.id;d.arm=w.tick+11;c.roster=d;}
  if(c.kind==='ground-hazard'&&!friendly&&crossed&&(d.arm??0)<=w.tick&&!c.hit.length&&(s.timers.jawLock??0)<=w.tick){
   c.hit.push(u.id);s.timers.jawLock=w.tick+90;const bridge=w.constructs.some(b=>b.kind==='bridge'&&active(w,b)&&b.team===u.team&&b.hazardId===c.id&&lineDistance(u,b.points[0],b.points[1])<20);
   if(!bridge)status(w,e,u,'root',.5*(d.value??1));const owner=get(e,c.owner);if(owner)hurt(w,e,owner,u,bridge?20:40,'skill1');
  }
  if(c.kind==='turnstile'&&!friendly&&dash&&crossed&&c.charges>0&&distance(to,c.points[0])>distance(to,c.points[1])){
   c.charges--;c.hp=0;const redirected=along(c.points[0],c.angle,20);if(e.legalSegment(from,redirected)){next=redirected;mark(w,u,'turnstile-count',(marked(w,u,'turnstile-count')?.value??0)+1,5);if((marked(w,u,'turnstile-count')?.value??0)>=2)status(w,e,u,'disarm',.45);}
  }
  if(c.kind==='counterpath'&&!friendly&&crossed&&Math.cos(angle(from,to)-(d.heading??0))>0)e.slow?.(u,.25,1);
  if(c.kind==='spectral-road'&&near){const forward=Math.cos(angle(from,to)-(d.heading??0));if(friendly&&forward<-.3)multiplier*=1.15;else if(!friendly&&crossed&&forward>.3){status(w,e,u,'reveal',1.5);mark(w,u,'exposed',1,1.5);}}
  if(c.kind==='ice-string'&&!friendly&&crossed&&!c.hit.includes(u.id)){c.hit.push(u.id);e.slow?.(u,.28,1.1);const owner=get(e,c.owner);if(owner)hurt(w,e,owner,u,65,'skill2');}
  if(c.kind==='collection-line'&&!friendly&&crossed&&!c.hit.includes(u.id)){const owner=get(e,c.owner),contract=owner?marked(w,owner,'contract:'+u.id):undefined;if(owner&&contract){c.hit.push(u.id);hurt(w,e,owner,u,contract.value*.5,'skill1');contract.value*=.5;}}
  if(c.kind==='mycelium'&&near){if(friendly){multiplier*=1.1;if(owned(w,c.owner,'understory').length&&(c.progress[u.id]??0)<=w.tick){c.progress[u.id]=w.tick+30;heal(w,e,u,12);}}else if(crossed&&!c.hit.includes(u.id)){c.hit.push(u.id);e.slow?.(u,.2,.75);}}
  if(c.kind==='courier-road'&&friendly&&u.id===c.owner&&near&&Math.cos(angle(from,to)-angle(c.points[0],c.points[1]))>0){multiplier*=1.25;for(const letter of owned(w,u.id,'letter').filter(l=>distance(l,to)<20)){blast(w,e,u,letter,45,55,'skill2');letter.hp=0;}}
  if(c.kind==='mile-marker'&&!friendly){const owner=get(e,c.owner),measure=owner?marked(w,owner,'measure:'+u.id):undefined;if(measure){if(distance(to,c)<distance(from,c))multiplier*=.9;else if((c.progress[u.id]??0)<=w.tick){measure.value=Math.max(0,measure.value-1);c.progress[u.id]=w.tick+20;}}}
  if(['foam','thermal','furnace-current','ember-wall'].includes(c.kind)&&(near||c.kind==='ember-wall'&&distance(from,c)<c.radius)){
   const forward=Math.cos(angle(from,to)-c.angle);
   if(c.kind==='foam'&&(c.progress[u.id]??0)<=w.tick){const drift=along(next,c.angle,Math.min(9,n*.25));if(e.legalSegment(next,drift))next=drift;c.progress[u.id]=w.tick+3;}
   if(c.kind==='thermal'){multiplier*=forward>.2?1.15:forward<-.2?.9:1;if(u.id===c.owner&&forward>.2){s.travel+=n;if(s.travel>=40){s.resource=Math.min(2,s.resource+1);s.travel=0;}}}
   if(!friendly&&(c.kind==='furnace-current'&&forward<-.2||c.kind==='ember-wall'&&(d.arm??0)<=w.tick)&&(c.progress[u.id]??0)<=w.tick){c.progress[u.id]=w.tick+30;const owner=get(e,c.owner);if(owner)hurt(w,e,owner,u,35,'skill2');}
  }
  if(c.kind==='tilt-plate'&&distance(from,c)<c.radius&&(c.progress[u.id]??0)<=w.tick){const slide=along(next,angle(from,to),12);if(e.legalSegment(next,slide))next=slide;c.progress[u.id]=w.tick+24;}
  if(c.kind==='road-home'&&friendly&&d.target===u.id&&near&&Math.cos(angle(from,to)-angle(c.points[0],c.points[1]))>.25){multiplier*=1.3;s.timers.roadGuard=w.tick+2;}
  if(c.kind==='road-home'&&friendly&&d.target===u.id){if(near)c.progress[u.id]=1;else if(c.progress[u.id]===1){c.roster!.target=undefined;s.timers.roadGuard=0;}}
  if(c.kind==='score-link'&&friendly&&crossed&&!c.hit.includes(u.id)){c.hit.push(u.id);status(w,e,u,'speed',1.5,.1);}
  if(c.kind==='waylight'&&friendly&&distance(to,c)<18&&!c.hit.includes(u.id)){c.hit.push(u.id);shield(w,u,25);c.hp=0;}
  if(['floor-steps','procession','waypoint','atlas','thermocline'].includes(c.kind)&&friendly&&c.points.length>=2&&!c.hit.includes(u.id)){
   if(c.kind==='thermocline'&&d.target&&d.target!==u.id)continue;
   const progress=c.progress[u.id]??0;if(c.points[progress]&&lineDistance(c.points[progress],from,to)<20){c.progress[u.id]=progress+1;
    if(c.kind==='procession')shield(w,u,30);
    if(progress===c.points.length-1){c.hit.push(u.id);if(c.kind==='waypoint')heal(w,e,u,45);else if(c.kind==='atlas'){shield(w,u,100);status(w,e,u,'speed',1.5,.2);}else if(c.kind==='thermocline')mark(w,u,'evade-basic',1,2);else{status(w,e,u,'speed',1.5,.22);if((s.timers.partnerLock??0)<=w.tick){s.timers.tenacity=w.tick+45;s.timers.partnerLock=w.tick+180;}}}
   }
  }
 }
 const cap=n*Math.min(1.4,Math.max(.55,multiplier)),length=distance(from,next),heading=angle(from,next);
 if(multiplier!==1)next=along(from,heading,Math.min(length*multiplier,cap+12));
 return e.legalPoint(next)&&e.legalSegment(from,next)?next:point(from);
}

/** Basic acquisition LOS only. Existing world visibility still has final authority. */
export function rosterCanAcquire(w:V3World,viewer:V3Unit,target:V3Unit){
 if(distance(viewer,target)<35)return true;
 if(w.constructs.some(c=>active(w,c)&&c.team!==viewer.team&&c.kind==='shadow-plane'&&!c.roster?.value&&c.points.length>=2&&crosses(viewer,target,c.points[0],c.points[1])))return false;
 if(target.hero==='nyxara-vale'&&(rosterState(w,target.id).timers.veil??0)>w.tick&&distance(viewer,target)>70)return false;
 return true;
}
function interceptReward(w:V3World,e:V3Environment,c:V3Construct,damage:number){
 const owner=get(e,c.owner);if(owner?.hero==='solenne-vaelor'&&(rosterState(w,owner.id).timers.radiance??0)<=w.tick){const s=rosterState(w,owner.id);s.resource=Math.min(3,s.resource+1);s.timers.radiance=w.tick+90;}
 emit(w,'projectile_intercepted',c.owner,{object:c.id,value:damage});
}
/** First pass: cover/intercepts. Second pass: a single composable redirect. */
export function rosterProjectileCover(w:V3World,e:V3Environment,p:V3Projectile,end:V3Point):boolean {
 for(const c of w.constructs.filter(c=>active(w,c))){const d=c.roster??={};
  if(c.kind==='roster-bolt'&&c.id===p.id)continue;
  const crossing=c.points.length>=2?crosses(p,end,c.points[0],c.points[1]):lineDistance(c,p,end)<c.radius;
  if(!crossing)continue;
  if(['planter','leaf-roof','shade-grove'].includes(c.kind)&&p.overhead&&c.team!==p.team&&c.charges>0){
   c.charges--;const owner=get(e,c.owner);if(owner)rosterState(w,owner.id).resource=Math.min(2,rosterState(w,owner.id).resource+1);interceptReward(w,e,c,p.damage);return true;
  }
  if(c.kind==='canvas'){
   d.property??=p.utility?'utility':p.physical?'physical':'magic';
   // Brace openings are short, shot-specific and never delete the frame.
   const braced=p.owner?rosterState(w,p.owner).timers.brace:0;
   if(c.team===p.team&&braced&&braced>w.tick){c.progress.openUntil=w.tick+21;continue;}
   if((c.progress.openUntil??0)>w.tick&&c.team===p.team)continue;
   c.hp--;interceptReward(w,e,c,p.damage);return true;
  }
  if(c.kind==='dorsal-wall'&&c.charges>0){c.charges--;c.hp=0;interceptReward(w,e,c,p.damage);return true;}
  const hostile=c.team!==p.team,frontHit=Math.cos(Math.atan2(-p.vy,-p.vx)-c.angle)>0;
  if(hostile&&c.kind==='sun-panel'&&frontHit&&c.charges>0){c.charges--;c.hp--;interceptReward(w,e,c,p.damage);return true;}
  if(hostile&&c.kind==='jade-slab'){c.hp--;interceptReward(w,e,c,p.damage);return true;}
  if(hostile&&c.kind==='hark'&&frontHit&&(d.reserve??0)>0){const taken=Math.min(p.damage,d.reserve!);d.reserve!-=taken;p.damage-=taken;interceptReward(w,e,c,taken);if(p.damage<=0)return true;}
  if(hostile&&c.kind==='fen-guard'&&c.charges>0){c.charges--;interceptReward(w,e,c,p.damage);return true;}
  if(hostile&&c.kind==='crystal-pane'&&frontHit&&!c.hit.includes(p.id)){c.hit.push(p.id);p.damage*=.75;c.hp--;emit(w,'projectile_attenuated',c.owner,{object:p.id,value:.25});}
 }
 return false;
}
export function rosterProjectileRedirect(w:V3World,e:V3Environment,p:V3Projectile,end:V3Point){
 for(const c of w.constructs.filter(c=>active(w,c)&&c.points.length>=2)){
  if(c.kind==='rail'&&c.team===p.team&&p.owner===c.owner&&lineDistance(p,c.points[0],c.points[1])<12&&!c.hit.includes(p.id)){c.hit.push(p.id);rosterState(w,c.owner).resource=Math.min(3,rosterState(w,c.owner).resource+1);}
  const crossing=crosses(p,end,c.points[0],c.points[1]);if(!crossing)continue;
  const friendly=c.team===p.team;
  if(c.kind==='thermocline'&&!friendly&&Math.cos(Math.atan2(p.vy,p.vx)-angle(c.points[0],c.points[1]))<-.2&&!c.hit.includes(p.id)){c.hit.push(p.id);p.rangeScale=.85;}
  if(c.kind==='ice-string'&&friendly){const parallel=Math.abs(Math.cos(Math.atan2(p.vy,p.vx)-angle(c.points[0],c.points[1])))>.9;if(parallel&&!c.hit.includes(p.id)){c.hit.push(p.id);p.vx*=1.1;p.vy*=1.1;}}
  if(c.kind==='rail'&&friendly&&p.owner===c.owner&&!c.hit.includes(p.id)){c.hit.push(p.id);rosterState(w,c.owner).resource=Math.min(3,rosterState(w,c.owner).resource+1);}
  if(c.kind==='buoy'&&friendly&&p.owner===c.owner&&c.charges>0){c.charges--;const owner=get(e,c.owner);if(owner)field(w,owner,'delayed-hit',end,.1,{points:[point(end),point(end)],radius:25,roster:{arm:w.tick+1,damage:p.damage*.25,slot:'skill1'}});}
  if(c.kind==='crossfire'&&friendly&&p.owner===c.owner&&c.charges>0&&!c.hit.includes(p.id)){
   c.hit.push(p.id);c.charges--;const owner=get(e,c.owner);if(owner){const a=Math.atan2(p.vy,p.vx);for(const sign of [-1,1])bolt(w,owner,end,along(end,a+sign*.18,100),p.damage*.6,'skill2',{oneShot:false,group:p.id});p.damage=0;}
  }
  if(p.redirected)continue;
  let turn=0;
  if(['wind-current','wind-ring'].includes(c.kind)){
   if(friendly&&!c.hit.includes(p.id)){c.hit.push(p.id);p.vx*=1.1;p.vy*=1.1;}
   else if(!friendly&&!p.homing)turn=15*Math.PI/180;
  }
  if(c.kind==='crystal-pane'&&friendly&&c.charges>0&&Math.abs(Math.cos(Math.atan2(p.vy,p.vx)-c.angle))>.65){turn=18*Math.PI/180;c.charges--;}
  if(c.kind==='mirror'&&friendly&&p.owner===c.owner){const heading=2*c.angle+Math.PI-Math.atan2(p.vy,p.vx);turn=heading-Math.atan2(p.vy,p.vx);}
  if(c.kind==='harrier-net'&&friendly)turn=5*Math.PI/180;
  if(turn){const vx=p.vx;p.vx=vx*Math.cos(turn)-p.vy*Math.sin(turn);p.vy=vx*Math.sin(turn)+p.vy*Math.cos(turn);p.redirected=true;emit(w,'projectile_redirected',c.owner,{object:p.id,value:turn});}
 }
}

/** Called after ordinary armor/item math, before actual shield/health subtraction.
 * Retaliation is scheduled for a later tick; triggered damage cannot recursively
 * create debts/retaliation chains or observe artificial nonlethal self costs. */
export function rosterBeforeDamage(w:V3World,e:V3Environment,source:V3Unit|undefined,target:V3Unit,amount:number,context:V3DamageContext):number {
 if(!source||source.team===target.team)return amount;
 const s=rosterState(w,target.id),attacker=rosterState(w,source.id);let result=amount;
 if((s.timers.roadGuard??0)>w.tick)result*=.82;
 if(target.hero==='murdle-ridgehide')result*=1-Math.min(4,s.resource)*.04;
 if(target.hero==='solenne-vaelor'&&front(target,source,55*Math.PI/180)){
  result*=.9;if((s.timers.radiance??0)<=w.tick){s.resource=Math.min(3,s.resource+1);s.timers.radiance=w.tick+90;}
 }
 for(const guard of e.units.filter(u=>u.alive&&u.team===target.team&&u.hero==='solenne-vaelor'&&distance(u,target)<65)){
  const m=marked(w,guard,'guard');if(m&&m.value>0&&Math.cos(angle(target,source)-(m.heading??0))>0)result*=.85;
 }
 for(const c of w.constructs.filter(c=>active(w,c)&&c.team===target.team)){
  const d=c.roster??{};
  if(c.kind==='sun-wedge'&&distance(target,c)<150&&Math.abs(Math.atan2(Math.sin(angle(c,target)-c.angle),Math.cos(angle(c,target)-c.angle)))<.6&&distance(source,c)>distance(target,c))result*=.82;
  if(c.kind==='shade-grove'&&context.overhead&&context.area&&distance(target,c)<65)result*=.8;
  if(c.kind==='suture'&&d.target===target.id&&c.charges>0){c.charges--;const prevented=result*.15;result-=prevented;const owner=get(e,c.owner);if(owner)care(w,owner,target,prevented);}
  if(c.kind==='shell-link'&&d.target===target.id){const hark=w.constructs.find(t=>t.id===c.supports[0]);if(hark?.roster){const absorb=Math.min(result*.2,hark.roster.reserve??0);hark.roster.reserve=(hark.roster.reserve??0)-absorb;result-=absorb;rosterState(w,c.owner).timers.shellExposure=w.tick+2;}}
  if(c.kind==='escort'&&d.target===target.id&&context.basic){const guard=get(e,c.owner);if(guard&&lineDistance(guard,source,target)<18&&distance(guard,target)<55&&distance(guard,target)<distance(source,target))result*=.7;}
 }
 if((s.timers.shellExposure??0)>w.tick)result*=1.1;
 if(context.basic&&marked(w,target,'intercession')){result=0;delete s.marks.intercession;}
 if(context.basic&&marked(w,target,'evade-basic')){result=0;delete s.marks['evade-basic'];}
 const shieldToken=marked(w,target,'next-shield');if(shieldToken){shield(w,target,shieldToken.value);delete s.marks['next-shield'];}
 if(target.hero==='kael-vespera'&&(s.timers.brace??0)>w.tick&&!context.triggered){s.timers.counter=w.tick+30;s.timers.brace=0;result*=.8;queueCounter(w,target,source,60);}
 if((s.timers.counter??0)>w.tick)result*=.85;
 if(target.hero==='toma-bellbreak'&&!context.triggered&&context.direct&&!context.ultimate&&front(target,source)&&((s.timers.guard??0)>w.tick)){
  const empowered=(s.timers.empowered??0)>w.tick;result*=empowered?.6:.85;s.timers.guard=0;queueCounter(w,target,source,empowered?70:25);
 }
 const bell=w.constructs.find(c=>c.kind==='bell-rhythm'&&active(w,c)&&c.owner===target.id);
 if(bell&&!context.basic&&!context.triggered&&w.tick>=(bell.roster?.arm??Infinity)&&w.tick<=bell.created+36){result*=.65;bell.hp=0;field(w,target,'delayed-hit',target,.1,{points:[point(target),point(source)],radius:35,roster:{arm:w.tick+1,damage:70,slot:'ultimate'}});}
 if(source.hero==='kael-vespera'&&marked(w,source,'contract:'+target.id))result*=.96;
 if(source.hero==='nyxara-vale'&&context.basic){
  if(!front(target,source)&&(attacker.timers['blind:'+target.id]??0)<=w.tick){result+=35;attacker.timers['blind:'+target.id]=w.tick+210;}
  if((attacker.timers.isolated??0)>w.tick&&allies(e,target,75).length<=1){result+=45;attacker.timers.isolated=0;}
  if((attacker.timers.veil??0)>w.tick){mark(w,target,'slow-turn',1,1);attacker.timers.veil=0;}
 }
 if(source.hero==='koro-cloudtail'&&context.basic&&(attacker.timers.balanced??0)>w.tick){target.shield=Math.max(0,target.shield-40);attacker.timers.balanced=0;}
 if(marked(w,target,'exposed'))result*=1.05;
 if(context.nonlethal)result=Math.min(result,Math.max(0,target.hp+target.shield-1));
 return Math.max(0,result);
}
function queueCounter(w:V3World,u:V3Unit,target:V3Unit,n:number){field(w,u,'delayed-hit',u,.1,{points:[point(u),point(target)],radius:15,roster:{arm:w.tick+1,damage:n,slot:'skill2'}});}
function care(w:V3World,u:V3Unit,target:V3Unit,n:number){const m=marked(w,u,'care:'+target.id);mark(w,u,'care:'+target.id,Math.min(180,(m?.value??0)+n),3);}
export function rosterAfterDamage(w:V3World,e:V3Environment,source:V3Unit,target:V3Unit,amount:number,context:V3DamageContext){
 if(source.team===target.team||amount<=0)return;
 const a=rosterState(w,source.id),t=rosterState(w,target.id);
 if(target.hero==='joruun-jadecoil')t.resource=Math.min(100,t.resource+amount*.2);
 if(target.hero==='brohm-caskfall'&&owned(w,target.id,'foam').some(c=>lineDistance(target,c.points[0],c.points[1])<16))t.resource=Math.min(100,t.resource+amount*.2);
 if(!context.triggered){
  for(const observer of e.units.filter(u=>u.alive&&distance(u,target)<180&&e.visible(u,target))){const s=rosterState(w,observer.id);
   if(observer.hero==='vesper-loom'&&observer.team===target.team&&owned(w,observer.id,'suture').some(c=>c.roster?.target===target.id))care(w,observer,target,amount*.16);
   if(observer.hero==='ashkar-veilhand'&&s.partner===target.id){const old=marked(w,observer,'ember:'+source.id);const residue=(old?.shield??0)+amount;mark(w,observer,'ember:'+source.id,Math.min(3,(old?.value??0)+Math.floor(residue/50)),5,{shield:residue%50,last:w.tick,target:target.id});}
   if(observer.hero==='orin-and-fen'&&observer.team===target.team)mark(w,observer,'scent:'+source.id,1,3,{point:point(source)});
   if(observer.hero==='maris-solquill'&&(s.timers.waylight??0)<=w.tick){cap(w,observer,'waylight',3);device(w,observer,'waylight',target,5,{radius:12});s.timers.waylight=w.tick+30;}
   if(observer.hero==='brakka-fenn'&&observer.team===target.team){const hit=marked(w,observer,'hit:'+source.id);if(hit?.target===target.id&&(s.timers['offender:'+source.id]??0)<=w.tick){mark(w,observer,'offender:'+source.id,1,4,{target:target.id,last:w.tick});s.timers['offender:'+source.id]=w.tick+240;}mark(w,observer,'hit:'+source.id,1,3,{target:target.id});const off=marked(w,observer,'offender:'+source.id);if(off?.target===target.id)off.last=w.tick;}
  }
 }
 if(source.hero==='thalara-rootwright'&&!context.basic&&!context.triggered){cap(w,source,'nutrient',4);device(w,source,'nutrient',target,6);}
 if(context.area&&!context.triggered)for(const thalara of e.units.filter(t=>t.hero==='thalara-rootwright'&&t.team!==source.team&&t.alive)){
  if(!owned(w,thalara.id,'understory').length)continue;
  const node=owned(w,thalara.id,'nutrient').find(c=>distance(c,target)<30&&!c.hit.includes('burned'));if(node){node.hit.push('burned');node.hp=0;field(w,thalara,'delayed-hit',node,.1,{points:[point(node),point(source)],radius:25,roster:{arm:w.tick+1,damage:35,slot:'ultimate'}});}
 }
 if(!context.basic)return;
 if(source.hero==='kael-vespera'&&!marked(w,source,'contract:'+target.id))mark(w,source,'contract:'+target.id,0,4,{shield:target.shield});
 if(source.hero==='ivera-frostwhistle'){mark(w,source,'tune:'+target.id,1,5,{point:point(target)});const tunes=Object.keys(a.marks).filter(k=>k.startsWith('tune:'));while(tunes.length>2)delete a.marks[tunes.shift()!];}
 if(source.hero==='quillene-rook'){a.resource=(a.resource+1)%3;if(a.resource===0){cap(w,source,'kite',3);device(w,source,'kite',target,3);}}
 if(source.hero==='rux-emberchain'&&(a.timers['stamp:'+target.id]??0)<=w.tick){mark(w,source,'stamp:'+target.id,1,4,{point:point(target)});a.timers['stamp:'+target.id]=w.tick+180;}
 if(source.hero==='prismelle-cade'&&(a.timers.optical??0)<=w.tick){const pane=owned(w,source.id,'crystal-pane').sort((a,b)=>distance(a,source)-distance(b,source))[0];if(pane){pane.charges=1;a.timers.optical=w.tick+150;}}
 if(source.hero==='toma-bellbreak'){const bell=marked(w,source,'bell:'+target.id);if(bell&&w.tick>=bell.value&&w.tick-bell.value<=36&&(a.timers['bellHeal:'+target.id]??0)<=w.tick){heal(w,e,source,(source.maxHp-source.hp)*.05);a.timers['bellHeal:'+target.id]=w.tick+180;}}
 if(source.hero==='ravelle-skyrake')survey(w,source,target);
 for(const c of owned(w,target.id,'mercy')){const contract=marked(w,target,'contract:'+c.roster?.target);if(contract){c.roster!.value=(c.roster!.value??0)+1;if(c.roster!.value>=2){delete t.marks['contract:'+c.roster!.target];c.hp=0;}}}
 if(source.hero==='bryx-emberkite'&&a.resource>0)a.resource--;
}
export function rosterConstructHit(w:V3World,e:V3Environment,attacker:V3Unit,c:V3Construct){
 if(attacker.hero==='bramm-coil'){const s=rosterState(w,attacker.id),old=marked(w,attacker,'survey-cover');if(old?.target===c.id){c.hp=Math.max(0,c.hp-1);delete s.marks['survey-cover'];}else mark(w,attacker,'survey-cover',1,4,{target:c.id});}
}
export function rosterCastStarted(w:V3World,e:V3Environment,u:V3Unit,r:V3Request,commit:number){
 const s=rosterState(w,u.id);s.timers.castStarted=w.tick;
 for(const odo of e.units.filter(t=>t.alive&&t.team===u.team&&t.hero==='odo-bogsong'&&distance(t,u)<130)){
  const remainder=w.tick%36,key='good-beat:'+r.slot;if(Math.min(remainder,36-remainder)<=5&&(s.timers[key]??0)<=w.tick){s.timers.goodRecovery=commit+1;s.timers[key]=w.tick+180;emit(w,'good_beat',odo.id,{target:u.id,reason:r.slot});}
 }
}
export function rosterCompleted(w:V3World,e:V3Environment,u:V3Unit,slot:V3Slot|undefined,endpoint?:V3Point):{tax:number;recovery:number}{
 const s=rosterState(w,u.id),category=slot?abilityCategory(u.hero,slot):'attack';let tax=0,recovery=1;
 if((s.timers.goodRecovery??0)>=w.tick){recovery*=.92;s.timers.goodRecovery=0;}
 if((s.timers.chorusRecovery??0)>w.tick)recovery*=.9;
 for(const observer of e.units.filter(v=>v.alive&&e.visible(v,u)&&distance(v,u)<180)){
  const o=rosterState(w,observer.id);
  if(observer.hero==='mourn-ashwake'&&distance(observer,u)<=125&&category==='attack'&&(o.timers['ash:'+u.id]??0)<=w.tick){cap(w,observer,'ash-patch',4);device(w,observer,'ash-patch',endpoint??u,6,{radius:18});o.timers['ash:'+u.id]=w.tick+120;}
  if(observer.hero==='nemea-halolink'&&observer.team===u.team){for(const other of allies(e,observer).filter(t=>t.id!==u.id)){const last=rosterState(w,other.id).lastCast,dt=last?w.tick-last.tick:Infinity,key=[u.id,other.id].sort().join('|');if(dt>=18&&dt<=42&&(o.timers[key]??0)<=w.tick){o.resource=Math.min(3,o.resource+1);o.timers[key]=w.tick+240;}}}
  if(observer.hero==='sevrin-inkseal'&&observer.team!==u.team&&distance(observer,u)<=125){
   mark(w,observer,'case:'+u.id,1,4,{category});
   for(const c of owned(w,observer.id,'court').filter(c=>distance(c,u)<c.radius)){
    // Each target has its own category history, never private cooldowns.
    const key='court:'+c.id+':'+u.id,m=o.marks[key],count=m?.category===category?m.value+1:1;
    o.marks[key]={expires:c.expires,value:count,category};
    if(count===2&&!c.hit.includes(u.id)){tax+=.25;c.hit.push(u.id);}
    if(count>=3&&c.roster?.value&&!c.hit.includes('review:'+u.id)){tax+=.35;u.shield=Math.max(0,u.shield-35);c.hit.push('review:'+u.id);emit(w,'precedent_shield_strip',observer.id,{target:u.id,value:35});}
   }
  }
 }
 for(const c of w.constructs.filter(c=>c.kind==='long-measure'&&active(w,c)&&distance(c,u)<c.radius)){
  if(c.team===u.team)status(w,e,u,'speed',1,.12);else if(Math.abs(w.tick-(c.roster?.arm??-100))<=3)tax+=.4;
 }
 s.lastCast={tick:w.tick,slot:slot??'skill1',category};return {tax,recovery};
}
export function abilityCategory(hero:V3Unit['hero'],slot:V3Slot):AbilityCategory {
 const index=slot==='skill1'?0:slot==='skill2'?1:2;
 if(isRosterHero(hero))return ROSTER_DEFINITIONS[hero].categories[index];
 const categories:Record<string,readonly AbilityCategory[]>={
  'lulla-faespring':['control','control','control'],'mirelle-vane':['attack','mobility','protection'],
  'mora-fenhook':['protection','mobility','mobility'],'vesper-nullcode':['control','control','control'],'teslan-veyr':['control','protection','control'],
 };return categories[hero??'']?.[index]??'attack';
}

export interface RosterProposal {slot:V3Slot;point:V3Point;utility:number;reason:string;target?:string;object?:string;direction?:1|-1}
/** Small public-state candidate set per kit. No hidden enemy cooldowns or RNG. */
export function rosterProposals(w:V3World,e:V3Environment,u:V3Unit):RosterProposal[]{
 if(!isRosterHero(u.hero))return [];
 const s=rosterState(w,u.id),foes=enemies(e,u,250).sort((a,b)=>distance(a,u)-distance(b,u)),foe=foes[0];if(!foe)return [];
 const friends=allies(e,u),injured=friends.filter(t=>t.id!==u.id).sort((a,b)=>a.hp/a.maxHp-b.hp/b.maxHp)[0]??u;
 const incoming=(e.projectiles??[]).filter(p=>p.team!==u.team&&distance(p,u)<200),pressure=foes.filter(t=>distance(t,injured)<100).length;
 const overheadThreat=incoming.some(p=>p.overhead)||w.constructs.some(c=>c.team!==u.team&&c.kind==='airspace-cell'&&active(w,c)&&!c.roster?.fired&&friends.some(t=>distance(t,c)<c.radius+45));
 const winding=w.casts.filter(c=>foes.some(t=>t.id===c.request.actor)),dir=u.team==='blue'?1:-1;
 const clamp=(p:V3Point,range=120)=>distance(u,p)>range?along(u,angle(u,p),range):point(p);
 const predicted=(horizon=.5)=>{const m=v3Actor(w,u.id).observed[foe.id];return clamp({x:foe.x+(m?.vx??0)*horizon,y:foe.y+(m?.vy??0)*horizon});};
 const p=predicted(),a=angle(u,p),own=(k:RosterKind)=>owned(w,u.id,k),has=(k:RosterKind,n=1)=>own(k).length>=n;
 const out:RosterProposal[]=[];
 const add=(slot:V3Slot,location:V3Point,value:number,reason:string,target?:V3Unit,object?:V3Construct)=>{
  if(value<=0)return;out.push({slot,point:clamp(location,slot==='skill1'?125:145),utility:value,reason,target:target?.id,object:object?.id});
 };
 const prepare=(kind:RosterKind,n:number,reason:string,location=p)=>{if(!has(kind,n))add('skill1',location,.66,reason);};
 const ult=(ready:boolean,value:number,reason:string,location=p,target?:V3Unit)=>{if(ready)add('ultimate',location,value,reason,target);};
 switch(u.hero){
 case 'solenne-vaelor':prepare('sun-panel',1,'orient-panel-to-visible-projectile-pressure',clamp(injured));if(has('sun-panel')&&incoming.length)add('skill2',p,.72,'pivot-panel-after-visible-angle-change');ult(has('sun-panel')&&friends.filter(t=>distance(t,injured)<100).length>=2&&foes.length>=2,.85,'protect-wedge-under-contested-pressure',p);break;
 case 'ivera-frostwhistle':prepare('frost-fork',2,'span-predicted-retreat-with-forks',clamp({x:p.x,y:p.y+(has('frost-fork')?40:-40)}));if(has('frost-fork',2))add('skill2',p,.72,'activate-destructible-crossing-line');ult(has('frost-fork',2)&&foes.length>=2,.8,'warn-triangle-with-safe-gaps');break;
 case 'mireth-lune':add('skill1',p,.6,'tax-recorded-route-direction',foe);if(pressure)add('skill2',clamp(injured),.52,'offer-disclosed-side-exit');ult(Object.keys(s.marks).some(k=>k.startsWith('heading:')),.75,'publish-observed-heading-roads');break;
 case 'bramm-coil':add('skill1',p,.7,'breach-visible-cover-approach');if(incoming.length)add('skill2',u,.45,'brace-with-firing-openings');ult(w.constructs.filter(c=>active(w,c)&&c.team!==u.team&&distance(c,foe)<80).length>=2,.85,'cut-temporary-defensive-structures');break;
 case 'kael-vespera':add('skill1',p,.55,'sweep-and-declare-contract-boundary');if(pressure)add('skill2',u,.6,'brace-against-observed-aggression');{const t=foes.find(t=>(marked(w,u,'contract:'+t.id)?.value??0)>40);ult(!!t,.83,'cash-real-shield-debt-with-defender-counterplay',t??p,t);}break;
 case 'nyxara-vale':prepare('shadow-plane',1,'occlude-forward-basic-acquisition');if(has('shadow-plane')&&u.hp/u.maxHp<.7)add('skill2',u,.62,'trade-stationary-plane-for-close-readable-veil');ult(foes.some(t=>allies(e,t,80).length<=1),.7,'announce-isolated-flank-with-false-silhouettes');break;
 case 'serrin-galecrest':if(incoming.length)prepare('wind-current',1,'cross-public-incoming-projectile-heading');if(s.resource)add('skill2',u,.55,'spend-earned-wind-notch');ult(incoming.length>=2,.83,'map-public-crosswind-channels');break;
 case 'orin-and-fen':prepare('track-lantern',1,'scout-visible-objective-approach');if(incoming.length)add('skill2',injured,.8,'intercept-one-shot-for-exposed-ally',injured);ult(injured.hp/injured.maxHp<.5&&pressure>0,.9,'offer-end-to-end-voluntary-retreat',injured,injured);break;
 case 'quillene-rook':prepare('kite',2,'prebuild-destructible-crossfire');if(has('kite',2))add('skill2',u,.7,'prepare-two-arrow-crossfire-window');ult(has('kite',2)&&foes.length>=2,.8,'deny-ranged-windups-beneath-net');break;
 case 'aurelio-vane':add('skill1',along(u,a-Math.PI/2,30),pressure?.72:.4,'offer-ordered-extraction-steps');if(injured.hp/injured.maxHp<.45&&distance(u,injured)<110)add('skill2',injured,.76,'offer-dual-consent-partner-trade',injured);ult(pressure>0,.84,'choreograph-readable-three-turn-route',along(u,Math.PI*(dir>0?1:0),100));break;
 case 'droven-bearmantle':prepare('hark',1,'anchor-finite-guard-tortoise',clamp(injured));if(has('hark')&&pressure)add('skill2',injured,.8,'redirect-real-ally-pressure-to-guard',injured);ult(has('hark')&&foes.length>=2,.72,'advance-breakable-cover-with-commitment');break;
 case 'thalara-rootwright':if(!has('nutrient'))add('skill1',foe,.75,'seed-first-node-with-real-light-impact',foe);else prepare('mycelium',2,'connect-limited-nutrient-network');if(has('nutrient')&&foes.some(t=>distance(t,own('nutrient')[0])<30))add('skill2',p,.5,'transplant-exposed-node');ult(has('mycelium')&&friends.some(t=>t.hp/t.maxHp<.7),.8,'activate-prepared-triage-web');break;
 case 'vesper-loom':if(injured.hp/injured.maxHp<.8)add('skill1',injured,.8,'tag-ally-before-visible-burst',injured);if(friends.length>=2)add('skill2',injured,.6,'split-future-healing-with-breakable-distance-link',injured);ult(u.hp/u.maxHp>.3&&Object.keys(s.marks).some(k=>k.startsWith('care:')&&s.marks[k].value>35),.9,'convert-real-care-debt-with-survivable-self-cost',u);break;
 case 'rux-emberchain':if(own('letter').length<3)add('skill1',p,.65,'seed-visible-mail-carriers',foe);if(Object.keys(s.marks).some(k=>k.startsWith('stamp:')))add('skill2',p,.55,'walk-declared-stamped-collection-route');ult(has('letter',2),.8,'converge-prepared-straight-letter-routes');break;
 case 'joruun-jadecoil':prepare('jade-slab',1,'raise-walk-around-side-cover',clamp(injured));if(has('jade-slab')&&incoming.length)add('skill2',u,.6,'warn-hinge-rotation');ult(pressure>=2&&s.resource>=40,.83,'create-open-gate-for-threatened-allies',clamp(injured));break;
 case 'astrax-mire':add('skill1',p,.6+(s.marks['footfall:'+foe.id]?.value??0)/400,'measure-actually-moving-foe',foe);prepare('mile-marker',1,'offer-seal-shedding-exit');ult(Object.keys(s.marks).some(k=>k.startsWith('measure:')&&s.marks[k].value>=2),.8,'announce-finite-nonlethal-travel-verdict',p,foe);break;
 case 'prismelle-cade':prepare('crystal-pane',1,'angle-attenuating-pane-for-allied-shots');if(has('crystal-pane')&&pressure)add('skill2',p,.55,'path-to-pane-edge-and-rotate');ult(incoming.length>=2,.8,'create-open-optical-fan');break;
 case 'ashkar-veilhand':{const accused=foes.find(t=>(marked(w,u,'ember:'+t.id)?.value??0)>0);if(accused)add('skill1',accused,.7,'brand-confirmed-protected-ally-attacker',accused);if(pressure&&distance(u,injured)>30)add('skill2',injured,.85,'intercede-only-to-sworn-ally',injured);ult(!!accused&&(marked(w,u,'ember:'+accused!.id)?.value??0)>=2,.85,'public-penance-on-repeated-aggression',accused??p,accused);break;}
 case 'maris-solquill':prepare('waypoint',2,'prepare-entire-lantern-healing-crossing',clamp(injured));if(has('waypoint'))add('skill2',injured,.5,'rotate-route-and-local-survey',injured);ult(has('waylight',2)&&injured.hp/injured.maxHp<.7,.85,'connect-earned-waylights-into-safe-trail',u);break;
 case 'odo-bogsong':prepare('drum',1,'place-public-three-beat-pad');if(has('drum')&&friends.some(t=>t.hp/t.maxHp<.7))add('skill2',u,.7,'announce-earlier-shield-beat');ult(winding.length>=1&&friends.length>=2,.8,'tempo-around-public-windup-completion',u);break;
 case 'mourn-ashwake':add('skill1',p,.6,'reuse-observed-ash-or-prime-first-patch');if(has('ash-patch'))add('skill2',p,.6,'burn-counterflow-through-spent-heat');ult(has('ash-patch',2),.85,'warn-moving-walls-from-prepared-ash');break;
 case 'dolm-runesunder':prepare('tilt-plate',1,'tilt-visible-diver-approach');if(foes.some(t=>distance(t,u)<65))add('skill2',p,.65,'shove-only-enemies-on-tilted-ground');ult(pressure>=2,.8,'sequence-three-plates-with-open-exits');break;
 case 'garruk-mawsuture':if(!has('jaw-tooth',2))add('skill1',p,.7,'arm-destructible-jaw-crossing');if(has('jaw-tooth'))add('skill2',clamp(own('jaw-tooth')[0]),.52,'scrape-and-reopen-spent-jaw');ult(foes.length>=2,.83,'stagger-jaw-lanes-leaving-corridors');break;
 case 'coiljack-ampfist':prepare('turnstile',1,'gate-dash-line-to-threatened-ally',clamp(injured));if(pressure)add('skill2',injured,.7,'reduce-next-real-displacement',injured);ult(pressure>=2&&s.resource>0,.8,'inspect-multiple-committed-divers',clamp(injured));break;
 case 'talan-slipshot':prepare('mirror',2,'prepare-one-bounce-public-reflector',along(u,a+.5,60));{const mirror=own('mirror')[0];add('skill2',mirror?along(u,angle(u,mirror),125):p,.66,'fire-direct-or-single-reflected-evidence');}ult(has('mirror')&&foes.length>=2,.8,'warn-legal-public-mirror-line',p,foe);break;
 case 'calixa-broadwake':prepare('buoy',2,'mark-fixed-sea-lane');if(pressure)add('skill2',u,.6,'legal-lateral-tack-with-one-broadside');ult(foes.length>=2&&s.resource>0,.8,'lock-facing-for-staggered-broadside',p);break;
 case 'brohm-caskfall':prepare('foam',2,'prepare-directional-pressure-channel');if(has('foam')&&s.resource>25)add('skill2',u,.75,'warn-reversal-and-consume-soaked-pressure');ult(has('foam')&&foes.length>=2,.83,'surge-only-through-existing-flow-junction');break;
 case 'maelis-chromabloom':prepare('canvas',2,'cut-artillery-angle-with-walkable-frame');if(has('canvas')&&own('canvas').some(c=>c.hp<c.maxHp))add('skill2',u,.65,'restore-damaged-frame-reveal-window');ult(has('canvas',2),.78,'rotate-imprinted-open-gallery-sequentially');break;
 case 'axiom-rail':prepare('rail',2,'route-fixed-track-with-open-junctions');if(has('rail'))add('skill2',u,.65,'send-LOS-limited-cart');ult(has('rail')&&s.resource>=1,.8,'charge-furthest-surviving-track-endpoint');break;
 case 'brakka-fenn':{const offender=foes.find(t=>marked(w,u,'offender:'+t.id));add('skill1',p,offender?.8:.45,'warn-complaint-against-actual-offender');if(pressure)add('skill2',injured,.7,'escort-one-pressured-ally',injured);ult(!!offender,.85,'publish-escapable-repeat-aggression-disk',offender??p,offender);break;}
 case 'pippa-fuseburst':prepare('firework-rack',1,'schedule-readable-rack-blast');if(has('firework-rack')&&foes.every(t=>lineDistance(t,own('firework-rack')[0].points[0],own('firework-rack')[0].points[1])>30))add('skill2',u,.5,'warn-rack-rotation-before-firing');ult(foes.length>=2,.82,'reserve-escape-corridor-before-stage-sequence');break;
 case 'bryx-emberkite':prepare('thermal',2,'prepare-voluntary-directional-current',clamp(injured));if(has('thermal')&&pressure)add('skill2',u,.65,'warn-rotation-and-offer-individual-boost');ult(has('thermal',2),.78,'connect-end-to-end-evade-route');break;
 case 'murdle-ridgehide':if(s.resource>1&&incoming.length)prepare('dorsal-wall',2,'trade-personal-plates-for-visible-shot-cover',clamp(injured));if(has('dorsal-wall')&&u.hp/u.maxHp<.5)add('skill2',u,.8,'recover-expended-personal-armor');ult(s.resource>=3&&pressure>=2,.82,'advance-gapped-palisade-for-allied-extraction');break;
 case 'nemea-halolink':prepare('score-circle',2,'spread-distinct-shield-note-destinations',clamp({x:injured.x,y:injured.y+(has('score-circle')?45:-45)}));if(has('score-circle',2))add('skill2',u,.6,'connect-two-separate-score-circles');ult(s.resource>0&&friends.length>=2,.82,'schedule-reachable-distinct-chorus-beats',u);break;
 case 'thimble-briarwish':if(overheadThreat)prepare('planter',1,'intercept-known-overhead-trajectories',clamp(injured));if(has('planter')&&injured.hp/injured.maxHp<.7)add('skill2',clamp(injured),.65,'move-regenerating-shade-along-legal-route');ult(overheadThreat&&friends.length>=2,.85,'separate-three-overhead-roof-routes',u);break;
 case 'sevrin-inkseal':prepare('court',1,'publish-local-category-jurisdiction');if(has('court')&&distance(own('court')[0],foe)>70)add('skill2',clamp(foe),.5,'relocate-court-with-public-warning');ult(has('court')&&Object.keys(s.marks).some(k=>k.startsWith('case:')),.8,'review-public-repeated-categories',u);break;
 case 'koro-cloudtail':prepare('pole',2,'prepare-legal-optional-vault',along(u,a,35));if(has('pole')&&distance(u,own('pole')[0])<35&&u.hp/u.maxHp<.6)add('skill2',u,.7,'commit-self-vault-only-from-reachable-pole');ult(has('pole',2)&&pressure>0,.8,'offer-individual-consent-scaffold-crossing',u);break;
 case 'bram-stonebranch':prepare('column',2,'prepare-breakable-roof-supports',clamp(injured));if(has('column')&&overheadThreat)add('skill2',u,.8,'catch-only-real-lobbed-threats');ult(overheadThreat&&friends.length>=2,.85,'open-grove-against-aerial-area-pressure');break;
 case 'toma-bellbreak':if(distance(u,foe)<60)add('skill1',foe,winding.length?.8:.5,'palm-during-public-windup-without-interrupt',foe);if(winding.some(c=>c.commit-w.tick<18))add('skill2',u,.78,'time-frontal-guard-from-public-commit');ult(winding.some(c=>c.commit-w.tick>=29&&c.commit-w.tick<=36),.9,'align-final-counter-window-with-visible-cast',u);break;
 case 'ravelle-skyrake':prepare('survey-sector',2,'survey-visible-ground-sector');add('skill1',p,.6,'expose-one-local-surveyed-sector');if(pressure)add('skill2',u,.7,'lateral-skiff-path-with-attack-lock');{const sector=own('survey-sector').find(c=>foes.some(t=>distance(t,c)<60));ult(!!sector&&foes.length>=2,.84,'sequence-only-previously-surveyed-airspace',sector??p);}break;
 }
 // Public horizon sensitivity and device survival reduce optimistic setup scores.
 for(const proposal of out){const candidate=proposal.point,escape=foes.filter(t=>distance(t,candidate)<70).length;
  const forecast=[.5,1.5,3].reduce((sum,h)=>sum+foes.filter(t=>{const m=v3Actor(w,u.id).observed[t.id];return distance(candidate,{x:t.x+(m?.vx??0)*h,y:t.y+(m?.vy??0)*h})<90;}).length,0)/3;
  if(proposal.slot==='ultimate')proposal.utility+=Math.min(.12,forecast*.04)-.08*(escape===0?1:0);
  if(proposal.slot==='skill1')proposal.utility-=Math.min(.12,foes.filter(t=>distance(t,candidate)<40).length*.04);
 }
 return out;
}
