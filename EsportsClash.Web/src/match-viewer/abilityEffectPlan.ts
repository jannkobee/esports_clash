import type {ViewerSnapshot} from './MatchViewer';
import {PAINTED_ROSTER_ART} from './paintedRosterArt.ts';

type Point={x:number;y:number;height:number};
export type AbilityPrimitive={id:string;shape:'path'|'orb';points:Point[];radius:number;color:string;opacity:number};
const families:Record<string,readonly [string,string]>={
  sun:['#ffb632','#fff4bd'],ice:['#24aaff','#d5fcff'],ember:['#ff5738','#ffefad'],
  electric:['#8a65ff','#d3ffff'],thread:['#ee3d82','#fff2d4'],nature:['#4cde84','#e2ffc0'],
  stone:['#df9e47','#ffebbd'],ink:['#b775ff','#f4dbff'],wind:['#36dce1','#e7ffff'],
  sound:['#e6bd4c','#f1d6ff'],metal:['#f39e43','#c6f4ff'],glass:['#e77edd','#d1ffff'],
};
const theme:Record<string,string>={
  'solenne-vaelor':'sun','ivera-frostwhistle':'ice','mireth-lune':'ink','bramm-coil':'metal','kael-vespera':'ember',
  'nyxara-vale':'ink','serrin-galecrest':'wind','orin-and-fen':'ember','quillene-rook':'wind','aurelio-vane':'sun',
  'droven-bearmantle':'nature','thalara-rootwright':'nature','vesper-loom':'thread','rux-emberchain':'ember','teslan-veyr':'electric',
  'joruun-jadecoil':'nature','astrax-mire':'glass','prismelle-cade':'glass','ashkar-veilhand':'ember','maris-solquill':'sun',
  'odo-bogsong':'sound','mourn-ashwake':'ember','dolm-runesunder':'stone','garruk-mawsuture':'metal','vesper-nullcode':'ink',
  'coiljack-ampfist':'electric','talan-slipshot':'metal','calixa-broadwake':'wind','brohm-caskfall':'sun','mora-fenhook':'wind',
  'mirelle-vane':'thread','maelis-chromabloom':'glass','axiom-rail':'metal','brakka-fenn':'stone','pippa-fuseburst':'ember',
  'lulla-faespring':'sound','bryx-emberkite':'ember','murdle-ridgehide':'stone','nemea-halolink':'sound','thimble-briarwish':'nature',
  'sevrin-inkseal':'ink','koro-cloudtail':'wind','bram-stonebranch':'nature','toma-bellbreak':'sound','ravelle-skyrake':'metal',
};
export function abilityEffectPalette(heroId?:string,fallback='#a377ff'):readonly [string,string]{
  const art=heroId&&Object.hasOwn(PAINTED_ROSTER_ART,heroId)?PAINTED_ROSTER_ART[heroId]:undefined;
  return art?families[theme[art.slug]]??families.ink:[/^#[a-f0-9]{6}$/i.test(fallback)?fallback:'#a377ff','#fff4dc'];
}
const seed=(id:string)=>[...id].reduce((a,c)=>(a*31+c.charCodeAt(0))%997,0)/997;

/** Read-only, bounded choreography. Every position comes from a real effect or construct. */
export function buildAbilityEffectPlan(s:ViewerSnapshot):AbilityPrimitive[]{
  const plan:AbilityPrimitive[]=[];
  const add=(p:AbilityPrimitive)=>{if(plan.length<600&&p.points.length&&p.points.every(p=>[p.x,p.y,p.height].every(Number.isFinite))&&p.radius>0&&p.opacity>0)plan.push(p);};
  const path=(id:string,points:Point[],radius:number,color:string,opacity=1)=>add({id,shape:'path',points,radius,color,opacity});
  const orb=(id:string,p:Point,radius:number,color:string,opacity=1)=>add({id,shape:'orb',points:[p],radius,color,opacity});
  const ring=(id:string,x:number,y:number,r:number,height:number,color:string,opacity:number,width=1.7)=>{
    if(r<1)return;path(id,Array.from({length:33},(_,i)=>({x:x+Math.cos(i*Math.PI/16)*r,y:y+Math.sin(i*Math.PI/16)*r,height})),width,color,opacity);
  };
  for(const e of s.effects.slice(0,160)){
    const [tint,core]=abilityEffectPalette(e.heroId,e.color),id=`fx:${e.kind}:${e.id}`;
    if(e.kind==='projectile'){
      const a=e.angle??0,length=Math.min(54,12+Math.max(2,e.radius)*5),dx=Math.cos(a),dy=Math.sin(a),skill=!!e.slot;
      const points=Array.from({length:7},(_,i)=>({x:e.x-dx*length*(1-i/6),y:e.y-dy*length*(1-i/6),height:24}));
      path(id+':glow',points,skill?4:2.4,tint,.45);path(id+':trail',points,skill?1.8:1.1,core,.96);
      orb(id+':head',{x:e.x,y:e.y,height:24},skill?4.5:3,tint);
      orb(id+':core',{x:e.x,y:e.y,height:25},skill?2.4:1.6,core);
      continue;
    }
    const phase=e.age===undefined?(s.second*2+seed(e.id))%1:Math.min(1,Math.max(0,e.age/.7));
    const alpha=e.kind==='impact'?1-phase:.65;
    if(e.kind==='impact'){
      const r=Math.max(8,e.radius)*(.3+.7*phase);
      ring(id+':burst',e.x,e.y,r,18,tint,alpha,2.2);
      for(let i=0;i<5;i++){
        const a=i*Math.PI*2/5+seed(e.id)*6.28;
        path(id+':spark:'+i,[{x:e.x+Math.cos(a)*r*.3,y:e.y+Math.sin(a)*r*.3,height:19},
          {x:e.x+Math.cos(a)*r,y:e.y+Math.sin(a)*r,height:22+Math.sin(phase*Math.PI)*8}],1.3,core,alpha);
      }
      if(e.slot&&e.originX!==undefined&&e.originY!==undefined){
        const dx=e.x-e.originX,dy=e.y-e.originY;
        // A short-lived tracer joins the recorded resolution points; no new flight or damage.
        if(phase<.45)path(id+':resolve',[{x:e.originX,y:e.originY,height:30},{x:e.originX+dx*.5,y:e.originY+dy*.5,height:34},{x:e.x,y:e.y,height:22}],1.8,tint,(1-phase/.45)*.8);
      }
    }else if(e.sourceX!==undefined&&e.sourceY!==undefined){
      const pts=[{x:e.sourceX,y:e.sourceY,height:25},{x:e.x,y:e.y,height:25}];
      path(id+':beam-glow',pts,4,tint,.4);path(id+':beam',pts,1.6,core,.95);
    }else if(e.halfWidth!==undefined&&e.halfHeight!==undefined){
      const w=e.halfWidth,h=e.halfHeight;
      path(id+':edge',[{x:e.x-w,y:e.y-h,height:6},{x:e.x+w,y:e.y-h,height:6},{x:e.x+w,y:e.y+h,height:6},{x:e.x-w,y:e.y+h,height:6},{x:e.x-w,y:e.y-h,height:6}],2,tint,.8);
    }else ring(id+':field',e.x,e.y,e.radius*(.84+.1*Math.sin(s.second*6)),6,tint,alpha,2.1);
  }
  for(const c of (s.constructs??[]).slice(0,128)){
    if(c.hp<=0||c.expires<=s.tick)continue;
    const active=c.disabledUntil<=s.tick&&(c.arm===undefined||c.arm<=s.tick);
    const [tint,core]=active?abilityEffectPalette(c.heroId):['#c3b781','#d9d4b3'];
    const alpha=active?.88:.22,id=`device:${c.id}`,phase=(s.second*.85+seed(c.id))%1;
    const square=c.kind==='stage-cell'||c.kind==='airspace-cell';
    const coords=square?[{x:c.x-c.radius,y:c.y-c.radius},{x:c.x+c.radius,y:c.y-c.radius},{x:c.x+c.radius,y:c.y+c.radius},{x:c.x-c.radius,y:c.y+c.radius},{x:c.x-c.radius,y:c.y-c.radius}]:
      c.points.length>1?[...c.points,...(c.points.length===3?[c.points[0]]:[])]:[];
    if(coords.length>1){
      const points=coords.map(p=>({...p,height:8}));path(id+':edge-glow',points,3.4,tint,alpha*.32);path(id+':edge',points,1.6,core,alpha);
      if(active)for(let i=0;i<coords.length-1;i++){
        const a=coords[i],b=coords[i+1],t=(phase+i*.2)%1;
        orb(id+':flow:'+i,{x:a.x+(b.x-a.x)*t,y:a.y+(b.y-a.y)*t,height:10},3,tint,.95);
      }
      if(square&&c.safeY!==undefined)for(const dir of [-1,1])path(id+':safe:'+dir,[{x:c.x-c.radius,y:c.safeY+dir*20,height:9},{x:c.x+c.radius,y:c.safeY+dir*20,height:9}],1.3,'#91ffd4',.7);
    }else if(c.radius>0){
      ring(id+':rim',c.x,c.y,c.radius,7,tint,alpha,2.1);
      if(active)ring(id+':pulse',c.x,c.y,c.radius*(.5+.42*phase),8,core,(1-phase)*.55,1.2);
    }
    if(c.attackable){
      path(id+':stem',[{x:c.x,y:c.y,height:3},{x:c.x,y:c.y,height:32}],1.6,tint,alpha);
      orb(id+':beacon',{x:c.x,y:c.y,height:29},4,core,alpha);
    }
  }
  const actors=new Map(s.actors.map(a=>[a.id,a]));
  for(const cue of s.cues??[]){
    const a=actors.get(cue.actor),age=(s.tick-cue.tick)/30;if(!a?.alive||age<0||age>=.65)continue;
    const [tint,core]=abilityEffectPalette(cue.heroId),p=age/.65,r=12+p*25;
    const height=(PAINTED_ROSTER_ART[a.heroId]?.height??84)+8;
    for(let i=0;i<5;i++){
      const angle=i*Math.PI*2/5;
      path(`cast:${cue.id}:${i}`,[{x:a.x+Math.cos(angle)*r*.4,y:a.y,height:height+Math.sin(angle)*r*.4},
        {x:a.x+Math.cos(angle)*r,y:a.y,height:height+Math.sin(angle)*r}],1.4,i%2?tint:core,1-p);
    }
  }
  return plan;
}
