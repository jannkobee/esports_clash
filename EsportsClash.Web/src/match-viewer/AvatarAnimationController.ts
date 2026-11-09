import type { AnimationGroup } from '@babylonjs/core';
import type { ViewerActor } from './MatchViewer';
import { sampleAvatarAnimation } from './avatarPresentation';

/** Imported clips are paused and sampled at simulation timestamps, including on seek. */
export class AvatarAnimationController {
  private clips=new Map<string,AnimationGroup>();
  private current?:AnimationGroup;
  private previous?:AnimationGroup;private transition=0;
  private lastState='';private started=0;private lastSecond=-1;private hp=0;private hit=-Infinity;
  constructor(private groups:AnimationGroup[]){
    for(const group of groups){
      const key=group.name.toLowerCase().split(':').at(-1)!;
      this.clips.set(key,group);group.start(true);group.pause();group.setWeightForAllAnimatables(0);
    }
  }
  sample(actor:ViewerActor,second:number){
    const state=actor.alive?(actor.motion?.state??'idle'):'dead';
    const rewind=second<this.lastSecond;
    if(rewind||this.lastSecond<0||state!==this.lastState)this.started=second;
    if(this.lastSecond>=0&&!rewind&&actor.hp<this.hp)this.hit=second;
    const sample=sampleAvatarAnimation(actor,second,this.started,rewind?-Infinity:this.hit);
    const group=this.clips.get(sample.clip)??this.clips.get('idle');
    if(group){
      if(group!==this.current){this.previous?.setWeightForAllAnimatables(0);this.previous=this.current;this.current=group;this.transition=second;}
      const blend=this.previous&&!rewind?Math.min(1,Math.max(0,(second-this.transition)/.12)):1;
      group.setWeightForAllAnimatables(blend);this.previous?.setWeightForAllAnimatables(1-blend);
      if(blend===1)this.previous=undefined;
      const first=group.targetedAnimations[0]?.animation;
      const fps=first?.framePerSecond??30;
      const span=Math.max(.001,group.to-group.from);
      const phase=sample.loop ? ((sample.phase*fps)%span)/span : sample.clip==='death'?Math.min(1,sample.phase/(span/fps)):sample.phase;
      group.goToFrame(group.from+Math.max(0,Math.min(1,phase))*span,true);
    }
    this.lastState=state;this.lastSecond=second;this.hp=actor.hp;
  }
  diagnostics(){return {clips:[...this.clips.keys()],active:this.current?.name,second:this.lastSecond};}
  dispose(){for(const group of this.groups)group.stop();this.groups=[];this.clips.clear();}
}
