export interface GameplaySample {
  second:number;actor:string;alive:boolean;intent:string;target?:string;
  x:number;y:number;hp:number;gold:number;cs:number;damage:number;deaths:number;
}
/** Sampled own execution/outcomes. No scoring, random draws or world mutations. */
export class GameplayEvidence {
  private previous=new Map<string,GameplaySample>();
  counters={samples:0,intentChanges:0,targetChanges:0,recallStarts:0,stalledSeconds:0,retreatsSurvived:0};
  intents:Record<string,number>={};
  events:{second:number;actor:string;from?:string;to:string;target?:string;reason:string}[]=[];
  observe(s:GameplaySample){
    const p=this.previous.get(s.actor);this.counters.samples++;
    this.intents[s.intent]=(this.intents[s.intent]??0)+1;
    if(!p||p.intent!==s.intent||p.target!==s.target){
      if(p?.intent!==s.intent&&p)this.counters.intentChanges++;
      if(p?.target!==s.target&&p)this.counters.targetChanges++;
      if(s.intent==='recall')this.counters.recallStarts++;
      if(p?.intent==='retreat'&&s.alive&&s.deaths===p.deaths)this.counters.retreatsSurvived++;
      this.events.push({second:s.second,actor:s.actor,from:p?.intent,to:s.intent,target:s.target,
        reason:!p?'initial':!s.alive?'death':p.intent!==s.intent?'intent-transition':'target-transition'});
      if(this.events.length>500)this.events.shift();
    }
    if(p&&s.alive&&p.alive&&!['recall','recover','channel','cast','retreat'].includes(s.intent)
      &&Math.hypot(s.x-p.x,s.y-p.y)<1&&s.cs===p.cs&&s.damage===p.damage&&s.hp===p.hp)
      this.counters.stalledSeconds+=Math.max(0,Math.min(1,s.second-p.second));
    this.previous.set(s.actor,{...s});
  }
  snapshot(){return structuredClone({counters:this.counters,intents:this.intents,events:this.events});}
}
