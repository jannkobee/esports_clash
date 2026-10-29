import {INTELLIGENCE_ACTIONS,policyLogits,type NeuralPolicy} from './intelligencePolicy.ts';
export interface BaselineExample {observation:number[];action:number;mask:boolean[]}
export function validateBaselineExample(e:BaselineExample){
  if(e.observation.length!==20||!e.observation.every(n=>Number.isFinite(n)&&Math.abs(n)<=1)
    ||e.mask.length!==5||!e.mask.every(n=>typeof n==='boolean')||!Number.isInteger(e.action)||!e.mask[e.action])
    throw Error('Invalid baseline demonstration');
}
/** Offline supervised warm start only. Match outcomes must independently qualify it. */
export function fitBaselineActor(examples:readonly BaselineExample[],epochs=40):NeuralPolicy {
  if(!examples.length||!Number.isInteger(epochs)||epochs<1||epochs>200)throw Error('Invalid imitation budget');
  examples.forEach(validateBaselineExample);
  let state=1729;const random=()=>{state=(Math.imul(state,1664525)+1013904223)>>>0;return (state/4294967296-.5)*.2;};
  const p:NeuralPolicy={kind:'macro-actor',version:1,input:20,hidden:16,
    w1:Array.from({length:16},()=>Array.from({length:20},random)),b1:Array(16).fill(0),
    w2:Array.from({length:5},()=>Array.from({length:16},random)),b2:Array(5).fill(0)};
  const bound=(x:number)=>Math.max(-19,Math.min(19,x));
  for(let epoch=0;epoch<epochs;epoch++)for(const e of examples){
    const h=p.w1.map((row,i)=>Math.tanh(row.reduce((n,w,j)=>n+w*e.observation[j],p.b1[i])));
    const z=p.w2.map((row,i)=>row.reduce((n,w,j)=>n+w*h[j],p.b2[i]));
    const max=Math.max(...z.filter((_,i)=>e.mask[i]));const exp=z.map((v,i)=>e.mask[i]?Math.exp(v-max):0),total=exp.reduce((a,b)=>a+b,0);
    const delta=exp.map((v,i)=>v/total-+(i===e.action));
    const dh=h.map((v,j)=>(1-v*v)*delta.reduce((n,d,i)=>n+d*p.w2[i][j],0));
    const lr=.015/(1+epoch/40);
    for(let i=0;i<5;i++){for(let j=0;j<16;j++)p.w2[i][j]=bound(p.w2[i][j]-lr*delta[i]*h[j]);p.b2[i]=bound(p.b2[i]-lr*delta[i]);}
    for(let i=0;i<16;i++){for(let j=0;j<20;j++)p.w1[i][j]=bound(p.w1[i][j]-lr*dh[i]*e.observation[j]);p.b1[i]=bound(p.b1[i]-lr*dh[i]);}
  }
  return p;
}
export function baselineImitationMetrics(policy:NeuralPolicy,examples:readonly BaselineExample[]){
  let correct=0,loss=0;
  for(const e of examples){validateBaselineExample(e);const z=policyLogits(policy,e.observation),max=Math.max(...z.filter((_,i)=>e.mask[i]));
    const exp=z.map((v,i)=>e.mask[i]?Math.exp(v-max):0),sum=exp.reduce((a,b)=>a+b,0);
    if(z.findIndex((v,i)=>e.mask[i]&&v===max)===e.action)correct++;
    loss-=Math.log(Math.max(1e-15,exp[e.action]/sum));
  }
  return {samples:examples.length,accuracy:examples.length?correct/examples.length:null,loss:examples.length?loss/examples.length:null,
    actions:INTELLIGENCE_ACTIONS};
}
