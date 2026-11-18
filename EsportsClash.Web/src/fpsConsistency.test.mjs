import {test} from 'node:test';
import assert from 'node:assert/strict';
import {deriveFpsConsistency,fpsMatchFormNoiseScale,FPS_FORM_SPREAD} from './fps/fpsConsistency.ts';
import {detailedInputError} from './fps/fpsDetailedExecution.ts';
import {liveRecoilResidual} from './fps/fpsLiveGunplay.ts';
import {FpsLiveSimulation} from './fps/fpsLiveSimulation.ts';
import {deriveFpsTendencies} from './fps/fpsPlayerTendencies.ts';
import {fixture} from '../../infrastructure/automatic-learning/fixtures.mjs';

const prng=seed=>()=>{seed=(seed*1664525+1013904223)>>>0;return seed/4294967296;};
const sd=values=>{const m=values.reduce((a,b)=>a+b,0)/values.length;return Math.sqrt(values.reduce((a,b)=>a+(b-m)**2,0)/values.length);};

test('the live simulation reads each player\'s own consistency with a seeded, bounded match form',()=>{
  const f=fixture(42,1),sim=new FpsLiveSimulation(f.cards.slice(0,5),f.cards.slice(5),42,f.identity,{skillProfiles:f.profiles});
  const values=new Set();
  for(const card of f.cards){
    const player=f.identity.players[card.id],natural=deriveFpsConsistency(player.personality,player.dna)/100;
    const expected=1-(1-natural)*fpsMatchFormNoiseScale(natural,42,card.id);
    assert.equal(sim.executionConsistency(card.id),expected);
    const actor=sim.actors.find(a=>a.id===card.id);
    assert.equal(sim.skill(actor,'consistency',.5),expected,'consistency channel no longer falls back to a shared value');
    values.add(expected.toFixed(4));
  }
  assert.ok(values.size>=5,'players differ');
  // Reproducible for a seed, different between matches.
  const again=new FpsLiveSimulation(f.cards.slice(0,5),f.cards.slice(5),42,f.identity,{skillProfiles:f.profiles});
  const other=new FpsLiveSimulation(f.cards.slice(0,5),f.cards.slice(5),43,f.identity,{skillProfiles:f.profiles});
  assert.equal(again.executionConsistency(f.cards[0].id),sim.executionConsistency(f.cards[0].id));
  assert.ok(f.cards.some(c=>other.executionConsistency(c.id)!==sim.executionConsistency(c.id)));
  // Consistency is a capability trait, not a tendency: natural tendencies do not include it.
  assert.equal(deriveFpsTendencies(f.identity.players[f.cards[0].id].personality,f.identity.players[f.cards[0].id].dna).consistency,undefined);
});

test('low-consistency players vary more from match to match than high-consistency players, within bounds',()=>{
  const forms=c=>Array.from({length:400},(_,seed)=>fpsMatchFormNoiseScale(c,seed+1,'player-a'));
  const streaky=forms(.2),steady=forms(.9);
  assert.ok(sd(streaky)>3*sd(steady),`streaky ${sd(streaky)} vs steady ${sd(steady)}`);
  for(const [c,list] of [[.2,streaky],[.9,steady]])for(const v of list)assert.ok(Math.abs(v-1)<=FPS_FORM_SPREAD*(1-c)+1e-12);
  // Match-effective noise (1 - effective consistency) across seeded matches.
  const f=fixture(7,1),ids=f.cards.map(c=>c.id);
  const natural=Object.fromEntries(ids.map(id=>[id,deriveFpsConsistency(f.identity.players[id].personality,f.identity.players[id].dna)/100]));
  const low=ids.reduce((a,b)=>natural[a]<natural[b]?a:b),high=ids.reduce((a,b)=>natural[a]>natural[b]?a:b);
  assert.ok(natural[high]-natural[low]>.15,'fixture spans consistency');
  const noise={[low]:[],[high]:[]};
  for(let seed=1;seed<=40;seed++){
    const sim=new FpsLiveSimulation(f.cards.slice(0,5),f.cards.slice(5),seed,f.identity,{skillProfiles:f.profiles});
    for(const id of [low,high])noise[id].push(1-sim.executionConsistency(id));
  }
  assert.ok(sd(noise[low])>sd(noise[high]),`low ${sd(noise[low])} vs high ${sd(noise[high])}`);
  for(const id of [low,high])for(const v of noise[id])assert.ok(Math.abs(v-(1-natural[id]))<=FPS_FORM_SPREAD*(1-natural[id])**2+1e-12);
});

test('consistency scales zero-mean execution noise only, never the mean aim or recoil pull',()=>{
  const profile={values:{rifling:6,sniping:6,entry:6,utility:6,positioning:6,shotcalling:6}};
  const sample=c=>{const r=prng(99);return Array.from({length:20000},()=>detailedInputError(profile,.4,r,false,c));};
  const loose=sample(.1),tight=sample(.95),mean=v=>v.reduce((a,b)=>a+b,0)/v.length;
  assert.ok(sd(loose)>sd(tight)*1.3);
  assert.ok(Math.abs(mean(loose))<sd(loose)*.03&&Math.abs(mean(tight))<sd(tight)*.03,'zero-mean input error');
  // Recoil: the same pull-down on average; only its shot-to-shot wobble widens.
  const residuals=c=>{const r=prng(5);return Array.from({length:20000},()=>liveRecoilResidual('ak47',6,.6,c,r).pitch);};
  const lo=residuals(.1),hi=residuals(.95);
  assert.ok(sd(lo)>sd(hi)*1.5);
  assert.ok(Math.abs(mean(lo)-mean(hi))<Math.max(sd(lo),sd(hi))*.05,'mean residual unchanged by consistency');
});
