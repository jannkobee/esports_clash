import { captureViewerSnapshot } from './MatchViewer.ts';
import type { ArenaSceneFrame } from './ArenaFrame';
import type { ViewerSnapshot, ViewerActor, ViewerEffect, ViewerConstruct, ViewerMotion, ViewerCue } from './MatchViewer';

/** Presentation recording, not a replacement for authoritative action-log replay. */
export class ViewerReplay {
  private frames: ViewerSnapshot[] = [];
  private cursor = 0;
  private rate: 1 | 2 | 4 = 1;
  paused = true;
  readonly capacity: number;
  constructor(capacity = 18000) { this.capacity = capacity; }
  record(snapshot: ViewerSnapshot) {
    const last=this.frames.at(-1);
    if(last && snapshot.tick<=last.tick)return;
    this.frames.push(snapshot);
    if(this.frames.length>this.capacity)this.frames.shift();
  }
  capture(frame:ArenaSceneFrame){if(this.frames.at(-1)?.tick!==Math.round(frame.second*30))this.record(captureViewerSnapshot(frame,this.frames.at(-1)));}
  setPlaybackRate(rate:1|2|4){this.rate=rate;}
  seek(second:number){this.cursor=Math.max(this.frames[0]?.second??0,Math.min(this.frames.at(-1)?.second??0,second));return this.sample();}
  advance(seconds:number){if(!this.paused)this.seek(this.cursor+Math.max(0,seconds)*this.rate);return this.sample();}
  sample(){let lo=0,hi=this.frames.length-1;while(lo<hi){const mid=Math.ceil((lo+hi)/2);if(this.frames[mid].second<=this.cursor)lo=mid;else hi=mid-1;}return this.frames[lo];}
  export(){return JSON.stringify({version:2,kind:'presentation-only',frames:this.frames});}
  static parse(text:string){
    const value:unknown=JSON.parse(text);
    if(!value||typeof value!=='object'||!('version' in value)||(value.version!==1&&value.version!==2)||!('kind' in value)||value.kind!=='presentation-only'||!('frames' in value)||!Array.isArray(value.frames))throw new Error('Unsupported viewer recording');
    if(value.frames.length>18000)throw new Error('Recording exceeds 18,000 snapshots');
    const replay=new ViewerReplay();let last=-1;
    for(const frame of value.frames){
      if(!frame||!Number.isInteger(frame.tick)||frame.tick<=last||!Number.isFinite(frame.second)||frame.second<0||Math.abs(frame.second*30-frame.tick)>.01||
        !Array.isArray(frame.actors)||frame.actors.length>2048||!Array.isArray(frame.effects)||frame.effects.length>4096)throw new Error('Invalid snapshot');
      for(const a of frame.actors)if(!a||typeof a.id!=='string'||typeof a.heroId!=='string'||typeof a.label!=='string'||typeof a.team!=='string'||typeof a.alive!=='boolean'||a.assetVariant!==undefined&&a.assetVariant!=='current'||
        !['champion','minion','structure','neutral','ward'].includes(a.kind)||![a.x,a.y,a.hp,a.maxHp,a.facing].every(Number.isFinite))throw new Error('Invalid actor');
      for(const e of frame.effects)if(!e||typeof e.id!=='string'||typeof e.color!=='string'||!['projectile','zone','impact'].includes(e.kind)||![e.x,e.y,e.radius].every(Number.isFinite))throw new Error('Invalid effect');
      for(const e of frame.effects)for(const key of ['angle','halfWidth','halfHeight','sourceX','sourceY','originX','originY','age'])if(e[key]!==undefined&&!Number.isFinite(e[key]))throw new Error('Invalid effect geometry');
      const artFields=(item:{heroId?:unknown;slot?:unknown;owner?:unknown})=>{
        if(item.heroId!==undefined&&typeof item.heroId!=='string'||item.owner!==undefined&&typeof item.owner!=='string'||item.slot!==undefined&&!['passive','skill1','skill2','ultimate'].includes(String(item.slot)))throw new Error('Invalid ability artwork metadata');
      };
      for(const e of frame.effects)artFields(e);
      if(frame.cues!==undefined&&(!Array.isArray(frame.cues)||frame.cues.length>256))throw new Error('Invalid ability cues');
      for(const cue of frame.cues??[]){artFields(cue);if(typeof cue.id!=='string'||typeof cue.actor!=='string'||typeof cue.heroId!=='string'||!Number.isInteger(cue.tick)||cue.tick>frame.tick||!['skill1','skill2','ultimate'].includes(cue.slot))throw new Error('Invalid ability cue');}
      for(const a of frame.actors){
        if(a.motion && (typeof a.motion!=='object'||typeof a.motion.state!=='string'||![a.motion.vx,a.motion.vy,a.motion.attackTimer].every(Number.isFinite)))throw new Error('Invalid motion');
        if(a.motion)for(const key of ['castStart','castCommit','castEnd','attackReleased','knockup','stateSince','hitAt'])if(a.motion[key]!==undefined&&!Number.isFinite(a.motion[key]))throw new Error('Invalid motion timing');
        for(const key of ['shield'])if(a[key]!==undefined&&!Number.isFinite(a[key]))throw new Error('Invalid actor status');
        for(const key of ['controlled','recalling'])if(a[key]!==undefined&&typeof a[key]!=='boolean')throw new Error('Invalid actor status');
      }
      if(frame.constructs!==undefined&&(!Array.isArray(frame.constructs)||frame.constructs.length>256))throw new Error('Invalid constructs');
      for(const c of frame.constructs??[]){
        artFields(c);
        if(!c||typeof c.id!=='string'||typeof c.kind!=='string'||typeof c.team!=='string'||typeof c.attackable!=='boolean'||
          ![c.x,c.y,c.radius,c.angle,c.hp,c.maxHp,c.created,c.expires,c.disabledUntil].every(Number.isFinite)||
          !Array.isArray(c.points)||c.points.length>128||c.points.some((p:unknown)=>!p||typeof p!=='object'||!('x' in p)||!('y' in p)||!Number.isFinite(p.x)||!Number.isFinite(p.y)))throw new Error('Invalid construct geometry');
        if(c.arm!==undefined&&!Number.isFinite(c.arm)||c.safeY!==undefined&&!Number.isFinite(c.safeY))throw new Error('Invalid construct timing');
      }
      replay.record(Object.freeze({...frame,
        cues:Object.freeze((frame.cues??[]).map((c:ViewerCue)=>Object.freeze({...c}))),
        constructs:Object.freeze((frame.constructs??[]).map((c:ViewerConstruct)=>Object.freeze({...c,points:Object.freeze(c.points.map(p=>Object.freeze({...p})))}))),actors:Object.freeze(frame.actors.map((a:ViewerActor)=>Object.freeze({...a,...(a.motion?{motion:Object.freeze({...a.motion})}:{})}))),effects:Object.freeze(frame.effects.map((e:object)=>Object.freeze(e)))}));last=frame.tick;
    }
    replay.seek(0);return replay;
  }
  get range(){return {start:this.frames[0]?.second??0,end:this.frames.at(-1)?.second??0};}
  get second(){return this.cursor;}
}
