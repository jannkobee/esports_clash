import { ARENA_WIDTH, BARRACKS_X, LANE_Y, NEXUS_X, NEXUS_TOWER_X } from './arenaLayout.ts';
import { arenaCampArt } from './arenaArtDirection.ts';
import { ARAM_BUSHES, CAMP_ROCK_RINGS } from './arenaRules.ts';

type Team = 'blue' | 'red';
type Kind = 'melee' | 'ranged' | 'catapult';
export const WELL_RADII = { x: 105, y: 240 } as const;
export const HEALING_SHRINE_Y = LANE_Y - 58;
// Forested lowlands surround a raised stone lane and sanctuary courtyards.
export const LANDSCAPE = { left: 390, right: 2210, top: 24, bottom: 736, laneTop: 270, laneBottom: 490, corner: 86 } as const;
export function stoneLaneEdges(x: number) {
  const u = Math.max(0, Math.min(1, (x - LANDSCAPE.left) / (LANDSCAPE.right - LANDSCAPE.left)));
  return { top: LANDSCAPE.laneTop + Math.sin(u * Math.PI * 4) * 9 + Math.sin(u * Math.PI * 9) * 3,
    bottom: LANDSCAPE.laneBottom + Math.sin(u * Math.PI * 3 + .6) * 8 + Math.sin(u * Math.PI * 7) * 4 };
}

export function barracksPosition(team: Team, kind: Kind) {
  const outer = kind !== 'ranged';
  return { x: BARRACKS_X[team] + (outer ? (team === 'blue' ? -60 : 60) : 0),
    y: kind === 'melee' ? 140 : kind === 'catapult' ? 620 : LANE_Y };
}

/** All wave classes emerge from the Nexus; barracks still govern empowerment. */
export function minionSpawnPosition(team: Team, type: 'melee' | 'caster' | 'cannon', index: number) {
  const dir = team === 'blue' ? 1 : -1;
  const front = type === 'melee' ? 56 : type === 'caster' ? 24 : 10;
  return { x: NEXUS_X[team] + dir * (front + index * 14),
    y: LANE_Y + (type === 'melee' ? -11 : type === 'caster' ? 11 : 36) + (type === 'cannon' ? 0 : (index - 1) * 11) };
}

/** Nexus waves skirt the central barracks before joining the stone lane. */
export function advanceLaneMinion(m: { x: number; y: number; team: Team; speed: number; type?: string }, dt: number) {
  const dir = m.team === 'blue' ? 1 : -1, rallyX = NEXUS_TOWER_X[m.team] - dir * 55;
  const inBase = dir * (rallyX - m.x) > .01;
  const barracksX = BARRACKS_X[m.team], side = m.type === 'melee' || !m.type && m.y < LANE_Y ? -1 : 1;
  let goalX = inBase ? rallyX : m.x + dir * 100, goalY = LANE_Y;
  if (dir * (barracksX - dir * 60 - m.x) > .01) {
    goalX = barracksX - dir * 60; goalY = LANE_Y + side * 58;
  } else if (dir * (barracksX + dir * 60 - m.x) > .01) {
    goalX = barracksX + dir * 60; goalY = LANE_Y + side * 58;
  }
  const dx = goalX - m.x, dy = goalY - m.y, distance = Math.hypot(dx, dy);
  const step = Math.min(distance, Math.max(0, m.speed * dt));
  if (distance > 0) { m.x += dx / distance * step; m.y += dy / distance * step; }
  m.x = Math.max(40, Math.min(ARENA_WIDTH - 40, m.x));
}

/** Negative inside the northern/southern forest floor. Never a movement blocker. */
export function lowlandRegionDistance(x: number, y: number) {
  const lane = stoneLaneEdges(x);
  const rounded = (top: number, bottom: number) => {
    const radius = LANDSCAPE.corner, qx = Math.abs(x - (LANDSCAPE.left + LANDSCAPE.right) / 2) - (LANDSCAPE.right - LANDSCAPE.left) / 2 + radius;
    const qy = Math.abs(y - (top + bottom) / 2) - (bottom - top) / 2 + radius;
    return Math.min(Math.max(qx, qy), 0) + Math.hypot(Math.max(qx, 0), Math.max(qy, 0)) - radius;
  };
  return Math.min(rounded(LANDSCAPE.top, lane.top), rounded(lane.bottom, LANDSCAPE.bottom));
}

/** Shared tactical art: forest floor, worn ridge paving, shaded slopes and ramps. */
function paintNaturalArena(ctx: CanvasRenderingContext2D) {
  const floor = ctx.createLinearGradient(0,0,0,760);
  floor.addColorStop(0,'#263e32');floor.addColorStop(.5,'#45563b');floor.addColorStop(1,'#394331');
  ctx.fillStyle=floor;ctx.fillRect(0,0,ARENA_WIDTH,760);
  for(let i=0;i<240;i++){
    const x=(i*191+23)%2600,y=(i*137+37)%760;
    ctx.fillStyle=i%3?'rgba(138,142,79,.10)':'rgba(13,31,26,.20)';
    ctx.beginPath();ctx.ellipse(x,y,24+i%41,12+i%17,i*.31,0,Math.PI*2);ctx.fill();
  }
  // Soft forest trails lead into the camp clearings.
  ctx.lineCap='round';ctx.lineJoin='round';
  for(const y of [174,584]){
    ctx.beginPath();
    for(let i=0;i<=60;i++){const x=420+i*1760/60,z=y+Math.sin(x*.006)*13;if(!i)ctx.moveTo(x,z);else ctx.lineTo(x,z);}
    ctx.strokeStyle='rgba(109,99,63,.40)';ctx.lineWidth=30;ctx.stroke();
    ctx.strokeStyle='rgba(151,131,83,.15)';ctx.lineWidth=16;ctx.stroke();
  }
  // Cached tactical art shares the camp families without drawing tall props.
  for(const ring of CAMP_ROCK_RINGS){
    const ground=arenaCampArt(ring.id).ground.map(n=>Math.round(n*255));
    const pad=ctx.createRadialGradient(ring.x,ring.y,ring.radius*.25,ring.x,ring.y,ring.radius*.92);
    pad.addColorStop(0,`rgba(${ground.join(',')},.85)`);pad.addColorStop(1,`rgba(${ground.join(',')},0)`);
    ctx.fillStyle=pad;ctx.beginPath();ctx.ellipse(ring.x,ring.y,ring.radius,ring.radius*.85,0,0,Math.PI*2);ctx.fill();
    ctx.strokeStyle=`rgba(${ground.map(n=>Math.min(255,Math.round(n*1.18))).join(',')},.35)`;
    ctx.lineWidth=15;ctx.beginPath();ctx.moveTo(ring.x+Math.cos(ring.entrance)*ring.radius*.48,ring.y+Math.sin(ring.entrance)*ring.radius*.48);
    ctx.lineTo(ring.x+Math.cos(ring.entrance)*ring.radius*1.10,ring.y+Math.sin(ring.entrance)*ring.radius*1.10);ctx.stroke();
  }
  // Layered edge shading makes the lane read above the lowland floor in 2D.
  for(const north of [true,false]) for(const [offset,width,color] of [[20,31,'rgba(13,25,23,.38)'],[11,23,'#4c564a'],[3,11,'#8c8c74']] as const){
    ctx.beginPath();
    for(let i=0;i<=130;i++){
      const x=LANDSCAPE.left+(LANDSCAPE.right-LANDSCAPE.left)*i/130,e=stoneLaneEdges(x),y=north?e.top-offset:e.bottom+offset;
      if(!i)ctx.moveTo(x,y);else ctx.lineTo(x,y);
    }
    ctx.strokeStyle=color;ctx.lineWidth=width;ctx.stroke();
  }
  ctx.save();ctx.beginPath();ctx.rect(0,0,LANDSCAPE.left,760);ctx.rect(LANDSCAPE.right,0,ARENA_WIDTH-LANDSCAPE.right,760);
  ctx.moveTo(LANDSCAPE.left,stoneLaneEdges(LANDSCAPE.left).top);
  for(let i=1;i<=130;i++){const x=LANDSCAPE.left+(LANDSCAPE.right-LANDSCAPE.left)*i/130;ctx.lineTo(x,stoneLaneEdges(x).top);}
  for(let i=130;i>=0;i--){const x=LANDSCAPE.left+(LANDSCAPE.right-LANDSCAPE.left)*i/130;ctx.lineTo(x,stoneLaneEdges(x).bottom);}
  ctx.closePath();ctx.clip();
  for(let row=0;row<20;row++)for(let col=0;col<49;col++){
    const x=col*55-(row%2)*27,y=row*40,e=stoneLaneEdges(x+25),base=x+25<LANDSCAPE.left||x+25>LANDSCAPE.right;
    if(!base&&(y+20<e.top||y+20>e.bottom))continue;
    const n=Math.sin(col*17.2+row*43.1)*.5+.5;
    ctx.fillStyle=['#7b7d6e','#6b7267','#898572','#787c6d'][Math.floor(n*3.99)];
    ctx.beginPath();ctx.roundRect(x+2,y+2,51,36,3+n*3);ctx.fill();
    ctx.strokeStyle='rgba(198,183,142,.24)';ctx.lineWidth=1;ctx.stroke();
    if((col+row*3)%9===0){ctx.strokeStyle='rgba(35,48,38,.55)';ctx.beginPath();ctx.moveTo(x+18,y+3);ctx.lineTo(x+23,y+18);ctx.lineTo(x+35,y+23);ctx.stroke();}
    if((col*7+row)%13===0){ctx.fillStyle='rgba(75,105,57,.64)';ctx.fillRect(x+2,y+24,10,7);}
  }
  ctx.restore();
  // Sparse low moss breaks up the paving boundary without closing ramp mouths.
  for(let i=0;i<180;i++){
    const x=LANDSCAPE.left+12+(LANDSCAPE.right-LANDSCAPE.left-24)*i/179;
    const e=stoneLaneEdges(x),north=i%2===0,y=(north?e.top:e.bottom)+Math.sin(i*2.7)*4;
    ctx.fillStyle=i%3?'rgba(78,105,59,.45)':'rgba(112,127,75,.34)';
    ctx.beginPath();ctx.ellipse(x,y,4+i%5,2+i%3,i*.41,0,Math.PI*2);ctx.fill();
  }
  for(const north of [true,false])for(const x of north?[870,1110,1490,1730]:[960,1120,1480,1640]){
    const e=stoneLaneEdges(x),edge=north?e.top:e.bottom,sign=north?-1:1;
    ctx.strokeStyle='#777b66';ctx.lineWidth=48;ctx.beginPath();ctx.moveTo(x,edge-sign*8);ctx.lineTo(x,edge+sign*72);ctx.stroke();
    for(let step=0;step<6;step++){
      const y=edge+sign*(step*11);
      ctx.strokeStyle=step%2?'rgba(177,164,125,.40)':'rgba(40,52,41,.36)';ctx.lineWidth=1.5;
      ctx.beginPath();ctx.moveTo(x-21,y);ctx.lineTo(x+21,y);ctx.stroke();
    }
  }
  for(const bush of ARAM_BUSHES){
    ctx.fillStyle='rgba(23,43,27,.18)';ctx.strokeStyle='rgba(128,143,79,.46)';ctx.lineWidth=1.5;
    ctx.beginPath();ctx.ellipse(bush.x,bush.y,bush.width/2,bush.height/2,0,0,Math.PI*2);ctx.fill();ctx.stroke();
  }
}

// Cache immutable paving and forest-floor artwork for the fallback and minimap.
let naturalBackdrop: HTMLCanvasElement | undefined;
export function drawNaturalArena(ctx: CanvasRenderingContext2D, _time: number) {
  if(!naturalBackdrop){
    const canvas=ctx.canvas.ownerDocument.createElement('canvas');canvas.width=ARENA_WIDTH;canvas.height=760;
    const painter=canvas.getContext('2d');if(painter){paintNaturalArena(painter);naturalBackdrop=canvas;}
  }
  if(naturalBackdrop)ctx.drawImage(naturalBackdrop,0,0);else paintNaturalArena(ctx);
}
