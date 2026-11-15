import type {FpsPoint} from './fpsSpatialWorld.ts';
import {LIVE_COLLISION_SOLIDS,distance,liveWalkable} from './fpsLiveMap.ts';
import {liveGroundHeight} from './fpsLiveTerrain.ts';
import {createLiveGeometryIndex} from './fpsStaticGeometry.ts';
import {LIVE_UTILITY_RULES,computeLiveThrowAngles,launchLiveGrenade,liveGrenadeSightline,predictLiveGrenade,stepLiveGrenade,type LiveGrenade,type LiveGrenadeKind,type LiveThrowStyle} from './fpsLiveGrenades.ts';
export {LIVE_AUTHORED_SMOKE_LINEUPS,type LiveSmokeLineup} from './fpsSmokeLineupDefinitions.ts';

const lineupSolidsAt=createLiveGeometryIndex(LIVE_COLLISION_SOLIDS);

export interface LiveSmokeSolution {
  target:FpsPoint;aimTarget?:FpsPoint;throwStyle:LiveThrowStyle;flightTime:number;forecast:LiveGrenade;launchYaw:number;launchPitch:number;isBankedPop?:boolean;
}
export const LIVE_SMOKE_SOLUTION_LIMITS=Object.freeze({maxRange:42,maxLaunchSpeed:32,maxLandingError:.6,maxFloorOffset:.45,candidates:24,cacheSize:256});
const solutionCache=new Map<string,LiveSmokeSolution|undefined>();
const copySolution=(solution:LiveSmokeSolution|undefined):LiveSmokeSolution|undefined=>solution?{...solution,target:{...solution.target},...(solution.aimTarget?{aimTarget:{...solution.aimTarget}}:{}),forecast:{...solution.forecast}}:undefined;

/** Solve only when the actor has reached its launch point. Each candidate style
 * tests at most 24 fixed arcs against authoritative static collision, then caches
 * by exact coordinates/height. No enemies, RNG, live utility or actor stats enter
 * this physical calculation; the caller applies its one skill error beforehand. */
export function solveLiveGrenadeThrow(
  kind:LiveGrenadeKind,
  from:FpsPoint,
  target:FpsPoint,
  height:number,
  preferredStyle?:LiveThrowStyle,
  maxError:number=kind==='flash'?2.5:3,
):LiveSmokeSolution|undefined {
  if(!Number.isFinite(from.x+from.z+target.x+target.z+height)||distance(from,target)>LIVE_SMOKE_SOLUTION_LIMITS.maxRange
    ||!liveWalkable(from)||(kind==='smoke'&&!liveWalkable(target)))return;
  const dist=distance(from,target),floor=liveGroundHeight(target);
  // Check chest/head clearance above ground curbs/canals so only real walls/buildings force high-arc sky lobs.
  const unobstructed=liveGrenadeSightline({x:from.x,y:height,z:from.z},{x:target.x,y:Math.max(height-.15,floor+1.45),z:target.z});
  const styleOrder:LiveThrowStyle[]=preferredStyle
    ?(unobstructed
      ?[preferredStyle,'underhand','medium','standard','walk','overhead','jump','walk-jump','run-jump']
      :[preferredStyle,'underhand','medium','overhead','standard','walk','jump','walk-jump','run-jump']
    ).filter((v,i,a)=>a.indexOf(v)===i) as LiveThrowStyle[]
    :dist<7.8
      ?(unobstructed?['underhand','medium','standard','overhead']:['overhead','jump','medium','underhand'])
      :dist<12.2
        ?(unobstructed?['medium','standard','underhand','overhead']:['overhead','jump','medium','standard','underhand'])
        :dist<=24.5
          ?(unobstructed?['standard','medium','walk','overhead','jump']:['overhead','jump','standard','walk'])
          :dist<=26.5
            ?(unobstructed?['walk','standard','overhead','jump']:['overhead','jump','standard','walk'])
            :dist<=30.8
              ?['walk','jump','walk-jump','overhead']
              :dist<=36.2
                ?['jump','walk-jump','run-jump']
                :['walk-jump','run-jump','jump'];
  const key=[kind,from.x,from.z,from.level??'',target.x,target.z,target.level??'',height,maxError,styleOrder[0],unobstructed?'clear':'blocked'].join(':');
  if(solutionCache.has(key))return copySolution(solutionCache.get(key));
  const targetEye={x:target.x,y:floor+1.5,z:target.z};
  const aimScales=kind!=='smoke'?[1]:dist>28?[1,.92,.84,.76,.68,.96,.88,.80,.72,.64,1.06,1.14]:[1,.92,.84,.76,.68,.96,.88,.80,.72,.64];
  const dirLen=Math.hypot(target.x-from.x,target.z-from.z)||1;
  const perpX=-(target.z-from.z)/dirLen,perpZ=(target.x-from.x)/dirLen;
  const flashMaxHeight=unobstructed?5.5:9.5;
  const trySolve=(lateralOffsets:readonly number[]):LiveSmokeSolution|undefined=>{
    let best:LiveSmokeSolution|undefined;
    let bestScore=Infinity;
    for(const throwStyle of styleOrder){
      const initial=launchLiveGrenade(-1,kind,'lineup','blue',from,target,0,false,throwStyle,height);
      // High-arc overhead, jump, walk-jump, and run-jump throws clear multi-storey roofs across the map.
      const highArc=throwStyle==='overhead'||throwStyle==='jump'||throwStyle==='walk-jump'||throwStyle==='run-jump';
      const flights=kind==='flash'
        ?[1.45,1.3,1.15,.95,initial.detonateAt,...Array.from({length:17},(_,i)=>.6+i*.12)]
        :highArc
          ?[Math.min(3.2,dist/15.2+.28),...Array.from({length:25},(_,i)=>.7+i*.12),...(kind==='he'?Array.from({length:16},(_,i)=>.76+i*.12):[])]
          :unobstructed
            ?(kind==='smoke'&&dist>10
              ?[...Array.from({length:18},(_,i)=>1.05+i*.1),.75,.85,.95]
              :[...Array.from({length:24},(_,i)=>.45+i*.1)])
            :[Math.min(2.4,dist/19+.22),...Array.from({length:23},(_,i)=>.45+i*.1)];
      for(const lat of lateralOffsets){
        const baseTarget:FpsPoint=lat===0?target:{x:target.x+perpX*lat,z:target.z+perpZ*lat,level:target.level};
        for(const flightTime of flights){
          for(const scale of aimScales){
            const aimTarget:FpsPoint=scale===1&&lat===0?{...target}:{x:from.x+(baseTarget.x-from.x)*scale,z:from.z+(baseTarget.z-from.z)*scale,level:baseTarget.level};
            const grenade=launchLiveGrenade(-1,kind,'lineup','blue',from,aimTarget,0,false,throwStyle,height,{x:0,z:0},flightTime);
            if(Math.hypot(grenade.vx,grenade.vy,grenade.vz)>LIVE_SMOKE_SOLUTION_LIMITS.maxLaunchSpeed)continue;
            const forecast=predictLiveGrenade(grenade,0),floorOffset=forecast.y-floor,err=distance(forecast,target);
            // XZ alone accepts grenades bursting on an eight-metre roof above the entry.
            // Require settled ground smokes near destination floor, floor-impact fires, or clear air pop-flashes.
            const validLanding=kind==='smoke'
              ?err<=maxError&&floorOffset>=.04&&floorOffset<=LIVE_SMOKE_SOLUTION_LIMITS.maxFloorOffset+.1
              :kind==='flash'
                ?(err<=maxError&&floorOffset>=-.1&&floorOffset<=2.6)
                  ||(err<=maxError+2.5&&floorOffset>=.25&&floorOffset<=flashMaxHeight&&liveGrenadeSightline(forecast,targetEye))
                :kind==='he'
                  ?(err<=maxError&&floorOffset>=-.1&&floorOffset<=2.6)
                    ||(err<=maxError+(unobstructed?0:1.2)&&floorOffset>=.04&&floorOffset<=(unobstructed?4.5:7.5)&&liveGrenadeSightline(forecast,targetEye))
                  :err<=maxError&&floorOffset>=.04&&floorOffset<=1.0;
            if(!validLanding)continue;
            const airAirburst=kind==='flash'?floorOffset>5.5:kind==='he'?floorOffset>2.6:false;
            const score=airAirburst?100+err:err;
            if(kind==='smoke'&&err>=bestScore)continue;
            if((kind==='flash'||kind==='he')&&score>=bestScore)continue;
            const angles=computeLiveThrowAngles(grenade);
            best={target:{...target},aimTarget:{...aimTarget},throwStyle,flightTime,forecast,launchYaw:angles.yaw,launchPitch:angles.pitch};
            bestScore=score;
            if((kind==='flash'||kind==='he')&&!airAirburst)break;
            if(kind!=='smoke'&&kind!=='flash'&&kind!=='he')break;
            if(kind==='smoke'&&bestScore<=.28&&(!unobstructed||angles.pitch<.52||highArc))break;
          }
          if(best&&((kind==='flash'||kind==='he')?bestScore<100:kind==='smoke'?(bestScore<=.28&&(!unobstructed||best.launchPitch<.52||highArc)):true))break;
        }
        if(best&&((kind==='flash'||kind==='he')?bestScore<100:kind==='smoke'?(bestScore<=.28&&(!unobstructed||best.launchPitch<.52||highArc)):true))break;
      }
      if(best&&((kind==='flash'||kind==='he')?bestScore<100:true))break;
    }
    return best;
  };
  let solution=trySolve([0]);
  if(!solution&&kind==='smoke')solution=trySolve([-.5,.5,-.9,.9]);
  if(solutionCache.size>=LIVE_SMOKE_SOLUTION_LIMITS.cacheSize)solutionCache.delete(solutionCache.keys().next().value!);
  solutionCache.set(key,copySolution(solution));
  return copySolution(solution);
}

export function solveLiveSmokeThrow(from:FpsPoint,target:FpsPoint,height:number,preferredStyle?:LiveThrowStyle,maxError:number=LIVE_SMOKE_SOLUTION_LIMITS.maxLandingError):LiveSmokeSolution|undefined {
  return solveLiveGrenadeThrow('smoke',from,target,height,preferredStyle,maxError);
}

export interface PopFlashAllyEye {x:number;z:number;yaw:number;crouch?:boolean;jumpY?:number}

/** Solve a wall-banked or overhead air-pop flash with 1.5s fuse that conceals its flight until just before detonation. */
export function solveLivePopFlash(
  from:FpsPoint,
  target:FpsPoint,
  height:number,
  allies:readonly PopFlashAllyEye[]=[],
):LiveSmokeSolution|undefined {
  if(!Number.isFinite(from.x+from.z+target.x+target.z+height)||distance(from,target)>LIVE_SMOKE_SOLUTION_LIMITS.maxRange||!liveWalkable(from))return;
  const floor=liveGroundHeight(target),targetEye={x:target.x,y:floor+1.55,z:target.z};
  const mid={x:(from.x+target.x)/2,z:(from.z+target.z)/2};
  const candidates:{aim:FpsPoint;style:LiveThrowStyle;flight:number}[]=[];

  // Wall-bank reflections off nearby opaque walls accounting for .52 normal / .82 tangent wall restitution
  const seenWalls=new Set<string>();
  const nearWalls=[...lineupSolidsAt(from,mid,9),...lineupSolidsAt(from,target,10)]
    .filter(w=>{if(seenWalls.has(w.id))return false;seenWalls.add(w.id);return w.height>=2.0&&(w.baseY??0)<=height+.4;});
  for(const w of nearWalls.slice(0,6)){
    const planes:{aim:FpsPoint}[]=[];
    if(from.x<w.minX&&target.x<w.minX)planes.push({aim:{x:(w.minX-.12)+(w.minX-.12-target.x)/.52,z:from.z+(target.z-from.z)*1.12}});
    if(from.x>w.maxX&&target.x>w.maxX)planes.push({aim:{x:(w.maxX+.12)+(w.maxX+.12-target.x)/.52,z:from.z+(target.z-from.z)*1.12}});
    if(from.z<w.minZ&&target.z<w.minZ)planes.push({aim:{x:from.x+(target.x-from.x)*1.12,z:(w.minZ-.12)+(w.minZ-.12-target.z)/.52}});
    if(from.z>w.maxZ&&target.z>w.maxZ)planes.push({aim:{x:from.x+(target.x-from.x)*1.12,z:(w.maxZ+.12)+(w.maxZ+.12-target.z)/.52}});
    for(const p of planes){
      const d=distance(from,p.aim);
      if(d<4||d>40)continue;
      candidates.push({aim:p.aim,style:d<11?'medium':'standard',flight:1.48});
      candidates.push({aim:p.aim,style:'standard',flight:1.62});
    }
  }

  // Elevated shoulder/sky air-bursts timed for the 1.5s flashbang fuse
  const dist=distance(from,target);
  const baseStyle:LiveThrowStyle=dist<8?'underhand':dist<14?'medium':'standard';
  for(const ft of [1.48,1.35,1.2,1.0,1.65]){
    candidates.push({aim:{...target},style:baseStyle,flight:ft});
    if(dist>=10)candidates.push({aim:{...target},style:'overhead',flight:ft+.22});
  }

  let best:LiveSmokeSolution|undefined,bestScore=-Infinity;
  for(const cand of candidates){
    const grenade=launchLiveGrenade(-1,'flash','popflash','blue',from,cand.aim,0,false,cand.style,height,{x:0,z:0},cand.flight);
    if(Math.hypot(grenade.vx,grenade.vy,grenade.vz)>LIVE_SMOKE_SOLUTION_LIMITS.maxLaunchSpeed)continue;
    const forecast=predictLiveGrenade(grenade,0);
    const range=Math.hypot(distance(forecast,target),forecast.y-targetEye.y);
    if(range>=LIVE_UTILITY_RULES.flashRadius-1.0)continue;
    if(forecast.y<floor+.55||forecast.y>floor+5.0)continue;
    if(!liveGrenadeSightline(forecast,targetEye))continue;

    const prePop={...grenade};
    const preEnd=Math.max(0,grenade.detonateAt-.30);
    for(let at=0;at<preEnd-1e-8;at+=1/30)stepLiveGrenade(prePop,Math.min(1/30,preEnd-at));
    const surprisePop=!liveGrenadeSightline(prePop,targetEye);
    const bounced=(forecast.vx*grenade.vx+forecast.vz*grenade.vz)<0||Math.hypot(forecast.vx-grenade.vx,forecast.vz-grenade.vz)>3.5;

    let allyHazard=0;
    for(const a of allies){
      const eyeY=(a.crouch?1.08:1.6)+(a.jumpY??0);
      const allyDist=Math.hypot(distance(a,forecast),forecast.y-eyeY);
      if(allyDist<12&&liveGrenadeSightline(forecast,{x:a.x,y:eyeY,z:a.z})){
        const facing=Math.cos(Math.atan2(forecast.x-a.x,forecast.z-a.z)-a.yaw);
        if(facing>.25)allyHazard+=(facing>.45?28:18)*facing;
      }
    }
    if(allyHazard>=18)continue;

    const airHeightBonus=forecast.y>=floor+1.2&&forecast.y<=floor+3.4?3.5:0;
    const score=(surprisePop?12:0)+(bounced?4:0)+airHeightBonus+(LIVE_UTILITY_RULES.flashRadius-range)-allyHazard;
    if(score>bestScore){
      bestScore=score;
      const angles=computeLiveThrowAngles(grenade);
      best={target:{...target},aimTarget:{...cand.aim},throwStyle:cand.style,flightTime:cand.flight,forecast,launchYaw:angles.yaw,launchPitch:angles.pitch,isBankedPop:surprisePop||bounced};
    }
  }
  return best;
}
