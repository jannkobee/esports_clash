import type {V3World,V3Point} from './v3Combat.ts';
/** Public simulation geometry only. No hits, RNG or state writes. */
export function drawV3Telegraphs(ctx:CanvasRenderingContext2D,w:V3World,project:(p:V3Point)=>V3Point=p=>p,units:readonly (V3Point&{id:string})[]=[]){
  ctx.save();ctx.font='bold 10px system-ui';ctx.textAlign='center';ctx.lineWidth=2;
  const line=(points:V3Point[],close=false)=>{ctx.beginPath();points.forEach((point,i)=>{const p=project(point);if(i)ctx.lineTo(p.x,p.y);else ctx.moveTo(p.x,p.y);});if(close)ctx.closePath();ctx.stroke();};
  for(const c of w.constructs.filter(c=>c.hp>0&&c.expires>w.tick)){
    const p=project(c);ctx.strokeStyle=c.team==='blue'?'#72e5fa':'#ffc17c';ctx.fillStyle='#fff';
    ctx.setLineDash(['cutout','bridge','hem','waltz'].includes(c.kind)?[5,4]:[]);
    const arm=c.roster?.arm??c.roster?.next,warning=arm!==undefined&&arm>w.tick;
    if(warning){ctx.strokeStyle='#ffdb70';ctx.setLineDash([5,4]);}
    if(c.points.length>1)line(c.points,c.points.length===3);
    if(c.kind==='stage-cell'||c.kind==='airspace-cell'){
      const corners=[{x:c.x-c.radius,y:c.y-c.radius},{x:c.x+c.radius,y:c.y-c.radius},{x:c.x+c.radius,y:c.y+c.radius},{x:c.x-c.radius,y:c.y+c.radius}];line(corners,true);
      if(c.roster?.safeY!==undefined){ctx.strokeStyle='#8affc8';line([{x:c.x-c.radius,y:c.roster.safeY-20},{x:c.x+c.radius,y:c.roster.safeY-20}]);line([{x:c.x-c.radius,y:c.roster.safeY+20},{x:c.x+c.radius,y:c.roster.safeY+20}]);}
    }else if(c.radius>20)line(Array.from({length:49},(_,i)=>({x:c.x+Math.cos(i*Math.PI/24)*c.radius,y:c.y+Math.sin(i*Math.PI/24)*c.radius})));
    if(['wind-current','foam','thermal','tangent','tilt-plate','circuit','mirror','crystal-pane','sun-panel'].includes(c.kind)){
      const end={x:c.x+Math.cos(c.angle)*22,y:c.y+Math.sin(c.angle)*22};line([{x:c.x,y:c.y},end,{x:end.x+Math.cos(c.angle+2.5)*8,y:end.y+Math.sin(c.angle+2.5)*8}]);
    }
    if(c.attackable!==false)ctx.strokeRect(p.x-5,p.y-5,10,10);ctx.setLineDash([]);
    for(let hp=0;hp<c.hp;hp++)ctx.fillRect(p.x-7+hp*7,p.y-12,5,3);
    const remaining=warning?Math.max(0,(arm!-w.tick)/30):Math.max(0,(c.expires-w.tick)/30);
    if(c.kind!=='roster-bolt')ctx.fillText(`${c.kind.replaceAll('-',' ')} ${remaining.toFixed(1)}s`,p.x,p.y-17-(c.created%3)*10);
    if(c.kind==='theater')ctx.fillText([1,2,3].map(n=>`${n}s${w.tick-c.created>n*30?' ✓':''}`).join(' · '),p.x,p.y+18);
    if(c.kind==='ferry')ctx.fillText(`Opt in · ${c.passengers.length}/${c.capacity}`,p.x,p.y+18);
  }
  for(const cast of w.casts){const p=project(cast.request.point);ctx.strokeStyle='#fff';ctx.setLineDash([3,3]);ctx.beginPath();ctx.arc(p.x,p.y,16,0,Math.PI*2);ctx.stroke();ctx.fillStyle='#fff';ctx.fillText(`${cast.request.slot} · ${Math.max(0,(cast.commit-w.tick)/30).toFixed(2)}s`,p.x,p.y-23);}
  for(const unit of units){const state=w.actors[unit.id],p=project(unit);if(!state)continue;
    if(state.recoveryUntil>w.tick){ctx.fillStyle='#e9d5ff';ctx.fillText(`◷ recovery ${((state.recoveryUntil-w.tick)/30).toFixed(2)}s`,p.x,p.y-46);}
    const notes=Object.values(w.actors).reduce((sum,a)=>sum+(a.notes[unit.id]?.count??0),0);
    if(notes){ctx.fillStyle='#fff';ctx.fillText(`Drowse ${notes}`,p.x,p.y-59);}
    if(state.roster){
      const marks=Object.entries(state.roster.marks).filter(([key,m])=>m.expires>w.tick&&!key.startsWith('motion:')&&!key.startsWith('near-shot:')).slice(0,2);
      ctx.fillStyle='#a9f4dd';ctx.fillText(`Resource ${Math.round(state.roster.resource)}`,p.x,p.y+24);
      if(marks.length)ctx.fillText(marks.map(([key,m])=>`${key.split(':')[0]} ${Math.round(m.value)}`).join(' / '),p.x,p.y+35);
    }
  }
  ctx.restore();
}
