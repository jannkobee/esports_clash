import {ARENA_AVATAR_IDS,ARENA_IDENTITY_INPUTS,arenaSkillTraits,type ArenaIdentityContext} from './arenaIdentity.ts';
import {PLAY_MIN_Y,PLAY_MAX_Y} from './arenaLayout.ts';
/** The learner ranks concrete legal commands. There is no strategic veto here. */
export const ARENA_INPUTS=224, ARENA_HIDDEN=32, ARENA_DECISION_SECONDS=.5;
export interface ArenaActor { kind:'arena-actor';version:1|2|3;input:48|224;hidden:32;
  w1:number[][];b1:number[];w2:number[];b2:number }
export type ArenaCommandKind='hold'|'move'|'attack'|'skill1'|'skill2'|'ultimate'|'recall'|'ward'|'orb'|'invoke';
export interface ArenaTarget {id:string;x:number;y:number;hp:number;maxHp:number;
  kind:'champion'|'minion'|'structure'|'camp'|'dragon'|'waypoint';ally?:boolean;nexus?:boolean;epic?:boolean;attackable?:boolean;shield?:number;healing?:boolean;
  avatarId?:string;kit?:readonly number[];role?:number;attackRange?:number;controlled?:number}
export interface ArenaCommand {id:string;kind:ArenaCommandKind;x:number;y:number;targetId?:string;
  targetKind?:ArenaTarget['kind'];element?:'ice'|'wind'|'fire';invokedIndex?:number;features:number[]}
export interface ArenaSituation {
  own:{id:string;x:number;y:number;hp:number;mana:number;level:number;iq:number;lan:number;tf:number;sta:number;
    role:number;attackReady:boolean;attackRange:number;ad:number;recalling:boolean;recallReady:boolean;wardReady:boolean;kaelen:boolean;
    skills:{slot:'skill1'|'skill2'|'ultimate';ready:boolean;range:number;mana:number;damage:number;selfCast?:boolean;ally?:boolean}[];
    identity?:ArenaIdentityContext;orbs?:readonly ('ice'|'wind'|'fire')[];orbReady?:boolean;invokeReady?:boolean;
    invoked?:{index:number;identity?:number;mana?:number;damage?:number;range:number;ready:boolean;ally:boolean}[]};
  direction:1|-1;second:number;targets:readonly ArenaTarget[];
  structures:readonly {x:number;y:number;range:number;enemy:boolean;alive:boolean}[];
  home:{x:number;y:number};width:number;ownNexus:number;enemyNexus:number;
  projectiles:readonly {x:number;y:number;vx:number;vy:number}[];
}
const bounded=(n:number)=>Number.isFinite(n)?Math.max(-1,Math.min(1,n)):0;
export function loadArenaActor(raw:unknown):ArenaActor|undefined {
  if(!raw||typeof raw!=='object'||Array.isArray(raw))return;
  const p=raw as ArenaActor;
  const vector=(v:unknown,n:number):v is number[]=>Array.isArray(v)&&v.length===n&&v.every(x=>typeof x==='number'&&Number.isFinite(x)&&Math.abs(x)<=20);
  if(Object.keys(p).length!==8||p.kind!=='arena-actor'||!((p.version===1&&p.input===48)||([2,3].includes(p.version)&&p.input===ARENA_IDENTITY_INPUTS))||p.hidden!==32
    ||!Array.isArray(p.w1)||p.w1.length!==32||!p.w1.every(r=>vector(r,p.input))||!vector(p.b1,32)
    ||!vector(p.w2,32)||typeof p.b2!=='number'||!Number.isFinite(p.b2)||Math.abs(p.b2)>20)return;
  return structuredClone(p);
}
const kinds:ArenaCommandKind[]=['hold','move','attack','skill1','skill2','ultimate','recall','ward','orb','invoke'];
export function arenaCommands(s:ArenaSituation,inputs:48|224=48,version:1|2|3=inputs===48?1:2):ArenaCommand[] {
  const u=s.own,out:ArenaCommand[]=[];
  const visible=s.targets.filter(t=>t.hp>0);
  const enemy=visible.filter(t=>t.kind==='champion'&&!t.ally);
  const allies=visible.filter(t=>t.kind==='champion'&&t.ally);
  const push=(kind:ArenaCommandKind,x:number,y:number,target?:ArenaTarget,element?:ArenaCommand['element'])=>{
    const distance=Math.hypot(x-u.x,y-u.y),f=Array(48).fill(0);
    f.splice(0,9,u.hp,u.mana,u.level/18,u.iq/100,u.lan/100,u.tf/100,u.sta/100,u.role/6,s.second/1200);
    f[9]=(x-u.x)*s.direction/s.width;f[10]=(y-u.y)/620;f[11]=distance/s.width;
    f[12]=target?target.hp/Math.max(1,target.maxHp):0;
    f[13]=+(target?.kind==='champion'&&!target.ally);f[14]=+(target?.kind==='champion'&&!!target.ally);
    f[15]=+(target?.kind==='minion');f[16]=+(target?.kind==='structure');f[17]=+(target?.kind==='camp'||target?.kind==='dragon');
    f[18]=+(!!target?.healing||Math.hypot(x-s.home.x,y-s.home.y)<100);
    f[19]=s.structures.filter(t=>t.enemy&&t.alive&&Math.hypot(t.x-x,t.y-y)<t.range).length/2;
    f[20]=enemy.filter(t=>Math.hypot(t.x-u.x,t.y-u.y)<400).length/5;
    f[21]=allies.filter(t=>Math.hypot(t.x-u.x,t.y-u.y)<400).length/5;
    f[22+kinds.indexOf(kind)]=1;
    f[32]=Math.min(2,distance/Math.max(30,u.attackRange))/2;
    f[33]=u.kaelen?(u.orbs??[]).reduce((code,orb)=>code*3+['ice','wind','fire'].indexOf(orb)+1,0)/39
      :target?u.hp-target.hp/Math.max(1,target.maxHp):0;
    f[34]=target?.attackable===false?-1:element?(['ice','wind','fire'].indexOf(element)+1)/3:target?u.ad/Math.max(1,target.hp):0;
    f[35]=+(target?.kind==='dragon'||!!target?.epic);f[36]=target?.nexus?(target.attackable===false?-1:1):0;
    f[37]=Math.hypot(x-s.home.x,y-s.home.y)/s.width;
    const missile=s.projectiles.reduce((nearest,p)=>Math.min(nearest,Math.hypot(p.x-x,p.y-y)),1000);
    f[38]=missile/1000;f[39]=s.projectiles.reduce((nearest,p)=>Math.min(nearest,Math.hypot(p.x+p.vx*.5-x,p.y+p.vy*.5-y)),1000)/1000;
    f[40]=Math.max(-1,Math.min(1,(x-u.x)*s.direction/200));f[41]=(target?.shield??0)/Math.max(1,target?.maxHp??1);
    f[42]=+u.recalling;const skill=u.skills.find(a=>a.slot===kind);
    f[43]=skill?.mana??0;f[44]=skill&&target?skill.damage/Math.max(1,target.hp):0;
    f[45]=s.ownNexus;f[46]=s.enemyNexus;f[47]=1;
    if(inputs===224){
      f.length=224;f.fill(0,48);
      const identity=u.identity,ownIndex=ARENA_AVATAR_IDS.indexOf(identity?.avatarId??''),targetIndex=ARENA_AVATAR_IDS.indexOf(target?.avatarId??'');
      if(ownIndex>=0)f[48+ownIndex]=1;if(targetIndex>=0)f[93+targetIndex]=1;
      if(version===3){
        f.fill(0,48,138);
        if(identity?.kit)f.splice(48,45,...identity.kit);
        if(target?.kit)f.splice(93,45,...target.kit);
      }
      if(identity)f.splice(138,71,...identity.values);
      f[209]=(target?.role??0)/6;f[210]=(target?.attackRange??0)/600;
      f[211]=target?enemy.filter(t=>Math.hypot(t.x-x,t.y-y)<155).length/5:0;
      f[212]=target?enemy.filter(t=>Math.hypot(t.x-x,t.y-y)<180).length/5:0;
      f[213]=(target?.controlled??0)/3;
      for(let i=0;i<3;i++)f[214+i]=identity?.cooldowns[i]??0;
      const traits=version===3?identity?.traits[['skill1','skill2','ultimate'].indexOf(kind)]:arenaSkillTraits(identity?.avatarId??'',kind);
      f[217]=+!!traits?.control;f[218]=+!!traits?.protect;f[219]=+!!traits?.mobility;f[220]=+!!traits?.channel;
      f[221]=allies.filter(t=>t.hp/Math.max(1,t.maxHp)<.5&&Math.hypot(t.x-x,t.y-y)<250).length/5;
      f[222]=(skill?.range??0)/600;f[223]=identity?.shield??0;
    }
    out.push({id:`${kind}:${target?.id??`${x.toFixed(1)}:${y.toFixed(1)}`}:${element??''}`,kind,x,y,
      targetId:target?.id,targetKind:target?.kind,element,features:f.map(v=>Math.round(bounded(v)*10000)/10000)});
  };
  push('hold',u.x,u.y);
  for(let i=0;i<8;i++){const a=i*Math.PI/4;push('move',Math.max(40,Math.min(s.width-40,u.x+Math.cos(a)*120)),Math.max(PLAY_MIN_Y,Math.min(PLAY_MAX_Y,u.y+Math.sin(a)*120)));}
  if(!u.recalling){
    push('move',s.home.x,s.home.y,{id:'own-well',...s.home,hp:1,maxHp:1,kind:'waypoint'});
    for(const t of visible)push('move',t.x,t.y,t);
    if(u.attackReady)for(const t of visible.filter(t=>!t.ally&&t.kind!=='waypoint'&&t.attackable!==false))
      if(Math.hypot(t.x-u.x,t.y-u.y)<=u.attackRange)push('attack',t.x,t.y,t);
    for(const ability of u.skills.filter(a=>a.ready)){
      for(const t of ability.ally?allies:enemy)if(Math.hypot(t.x-u.x,t.y-u.y)<=ability.range)push(ability.slot,t.x,t.y,t);
      if(ability.selfCast)push(ability.slot,u.x,u.y);
    }
    if(u.wardReady)push('ward',u.x,u.y);
    if(u.kaelen&&u.orbReady)for(const element of ['ice','wind','fire'] as const)push('orb',u.x,u.y,undefined,element);
    if(u.kaelen&&u.invokeReady)push('invoke',u.x,u.y);
    for(const spell of u.invoked??[])if(spell.ready)for(const t of spell.ally?allies:enemy){
      if(Math.hypot(t.x-u.x,t.y-u.y)>spell.range)continue;
      push('ultimate',t.x,t.y,t);out[out.length-1].id+=`:invoked${spell.index}`;out[out.length-1].invokedIndex=spell.index;
      const command=out[out.length-1];command.features[34]=Math.round((spell.identity??spell.index+1)/10*10000)/10000;
      command.features[43]=bounded(spell.mana??0);command.features[44]=bounded((spell.damage??0)/Math.max(1,t.hp));
    }
    if(u.recallReady)push('recall',s.home.x,s.home.y);
  }
  return out;
}
export function arenaScores(actor:ArenaActor,commands:readonly ArenaCommand[]):number[] {
  if(commands.some(c=>c.features.length!==actor.input||!c.features.every(Number.isFinite)))throw Error('Arena observation/model version mismatch');
  return commands.map(c=>actor.b2+actor.w1.reduce((v,row,i)=>v+Math.tanh(row.reduce((a,w,j)=>a+w*c.features[j],actor.b1[i]))*actor.w2[i],0));
}
export function chooseArenaCommand(actor:ArenaActor,commands:readonly ArenaCommand[],draw?:number){
  if(!commands.length)throw Error('No legal arena commands');
  const scores=arenaScores(actor,commands),max=Math.max(...scores),exps=scores.map(s=>Math.exp(s-max));
  const total=exps.reduce((a,b)=>a+b,0),prob=exps.map(v=>v/total);
  let index=scores.indexOf(max);
  if(draw!==undefined){if(!(draw>=0&&draw<1))throw Error('Invalid arena policy RNG');let cumulative=0;index=prob.findIndex(p=>(cumulative+=p)>draw);}
  return {command:commands[index],index,logp:Math.log(prob[index]),probability:prob[index]};
}
