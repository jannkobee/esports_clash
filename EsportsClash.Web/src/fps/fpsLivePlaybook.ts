import { LIVE_SEED_ATTACK_PLAYS, LIVE_SEED_DEFENSE_PLAYS, type LiveAttackPlay, type LiveDefensePlay } from './fpsLivePlays.ts';
import type { LiveDefenseSetup, LiveTacticArchetype } from './fpsLiveTactics.ts';

/**
 * A team's persisted playbook for one map (Level 6 meta): plays with outcome statistics overall and
 * per opponent, chosen by Thompson sampling, plus learned variants. Variants are bounded mutations or
 * recombinations of existing plays; a variant joins the active book only after beating its parent
 * over enough trials. Nothing is deleted: failed or crowded-out plays are archived with their stats.
 *
 * Everything here is decision-only (which play to call). It never touches aim, spread, damage or
 * reaction, and opponent statistics come only from outcomes and lawful observations.
 */
export type FpsPlaySide='attack'|'defense';
export type FpsPlayStatus='active'|'candidate'|'archived';
export interface FpsPlayRecord<T> {
  spec:T;status:FpsPlayStatus;trials:number;wins:number;
  /** Results against specific opponents (lineage keys): the basis for counter-strategies. */
  vs:Record<string,{trials:number;wins:number}>;
  parent?:string;generation:number;
  /** Playbook round count when created / last status change. */
  bornAt:number;statusAt:number;
}
export interface FpsTeamPlaybook {
  version:1;map:string;rounds:number;innovations:number;promotions:number;archived:number;
  attack:Record<string,FpsPlayRecord<LiveAttackPlay>>;
  defense:Record<string,FpsPlayRecord<LiveDefensePlay>>;
}
export const FPS_PLAYBOOK_RULES=Object.freeze({
  /** A new variant is proposed every this many rounds played on a side. */
  innovateEvery:16,maxCandidates:3,
  /** Trials before a candidate can be judged; promotion needs this margin over its parent. */
  judgeAfter:12,promoteMargin:.04,giveUpAfter:36,
  /** Active plays per side; beyond it the weakest well-tested play is archived (kept). */
  maxActive:18,
  /** Posterior evidence is capped so the book keeps adapting as the meta shifts. */
  evidenceCap:60,vsWeight:2,
  maxVsOpponents:64,maxPlaysPerSide:400,
});

const ATTACK_RANGES:Record<string,[number,number]>={rushBelow:[0,1],rushSmokeBelow:[0,1],midOpenBelow:[0,1],defaultMidAbove:[.5,2],fakeOpenBelow:[0,1],fakeSmokeAbove:[0,2],lurkerHoldBelow:[0,1],fakeWindow:[14,36],pistolWeight:[.5,3]};
const DEFENSE_RANGES:Record<string,[number,number]>={stackSlots:[3,4],quietOpenBelow:[0,.6],midPushBelow:[0,1]};
const ATTACK_FLAGS=['fake'] as const;
const DEFENSE_FLAGS=['flexMid','flexMidOrientation','anchorGallery','rotatorDeck','aggressivePair','midPushPair'] as const;
const ATTACK_FAMILIES=Object.keys(LIVE_SEED_ATTACK_PLAYS) as LiveTacticArchetype[];
const DEFENSE_FAMILIES=Object.keys(LIVE_SEED_DEFENSE_PLAYS) as LiveDefenseSetup[];

function record<T>(spec:T,rounds:number,status:FpsPlayStatus='active',parent?:string,generation=0):FpsPlayRecord<T> {
  return {spec,status,trials:0,wins:0,vs:{},...(parent?{parent}:{}),generation,bornAt:rounds,statusAt:rounds};
}
export function createFpsTeamPlaybook(map:string):FpsTeamPlaybook {
  return {version:1,map,rounds:0,innovations:0,promotions:0,archived:0,
    // Specs are stored in the loader's canonical field order, so a stored book reloads byte-for-byte.
    attack:Object.fromEntries(Object.values(LIVE_SEED_ATTACK_PLAYS).map(p=>[p.id,record(validAttack(p)!,0)])),
    defense:Object.fromEntries(Object.values(LIVE_SEED_DEFENSE_PLAYS).map(p=>[p.id,record(validDefense(p)!,0)]))};
}

const finite=(v:unknown,lo:number,hi:number):v is number=>typeof v==='number'&&Number.isFinite(v)&&v>=lo&&v<=hi;
const idOk=(v:unknown):v is string=>typeof v==='string'&&/^(seed|v):[a-z0-9_]{1,40}$/.test(v);
function validAttack(p:unknown):LiveAttackPlay|undefined {
  const v=p as LiveAttackPlay;
  if(!v||typeof v!=='object'||!idOk(v.id)||typeof v.name!=='string'||v.name.length>80||!ATTACK_FAMILIES.includes(v.family)||!['A','B','any'].includes(v.site)||typeof v.fake!=='boolean')return;
  for(const [k,[lo,hi]] of Object.entries(ATTACK_RANGES))if(!finite((v as unknown as Record<string,unknown>)[k],lo,hi))return;
  return {id:v.id,name:v.name,family:v.family,site:v.site,fake:v.fake,rushBelow:v.rushBelow,rushSmokeBelow:v.rushSmokeBelow,midOpenBelow:v.midOpenBelow,defaultMidAbove:v.defaultMidAbove,
    fakeOpenBelow:v.fakeOpenBelow,fakeSmokeAbove:v.fakeSmokeAbove,lurkerHoldBelow:v.lurkerHoldBelow,fakeWindow:v.fakeWindow,pistolWeight:v.pistolWeight};
}
function validDefense(p:unknown):LiveDefensePlay|undefined {
  const v=p as LiveDefensePlay;
  if(!v||typeof v!=='object'||!idOk(v.id)||typeof v.name!=='string'||v.name.length>80||!DEFENSE_FAMILIES.includes(v.family)||(v.stack!==undefined&&v.stack!=='A'&&v.stack!=='B'))return;
  for(const [k,[lo,hi]] of Object.entries(DEFENSE_RANGES))if(!finite((v as unknown as Record<string,unknown>)[k],lo,hi))return;
  if(!Number.isInteger(v.stackSlots))return;
  for(const f of DEFENSE_FLAGS)if(typeof v[f]!=='boolean')return;
  return {id:v.id,name:v.name,family:v.family,...(v.stack?{stack:v.stack}:{}),stackSlots:v.stackSlots,flexMid:v.flexMid,flexMidOrientation:v.flexMidOrientation,anchorGallery:v.anchorGallery,
    rotatorDeck:v.rotatorDeck,aggressivePair:v.aggressivePair,midPushPair:v.midPushPair,quietOpenBelow:v.quietOpenBelow,midPushBelow:v.midPushBelow};
}
function loadRecords<T>(raw:unknown,valid:(p:unknown)=>T|undefined):Record<string,FpsPlayRecord<T>>|undefined {
  if(!raw||typeof raw!=='object'||Array.isArray(raw))return;
  const out:Record<string,FpsPlayRecord<T>>={},entries=Object.entries(raw);
  if(entries.length>FPS_PLAYBOOK_RULES.maxPlaysPerSide)return;
  for(const [id,r] of entries){
    const v=r as FpsPlayRecord<T>,spec=valid(v?.spec);
    if(!spec||(spec as unknown as {id:string}).id!==id||!['active','candidate','archived'].includes(v.status)||!finite(v.trials,0,1e9)||!finite(v.wins,0,v.trials)
      ||!finite(v.generation,0,1e6)||!finite(v.bornAt,0,1e9)||!finite(v.statusAt,0,1e9)||(v.parent!==undefined&&!idOk(v.parent))||!v.vs||typeof v.vs!=='object')return;
    const vs:Record<string,{trials:number;wins:number}>={};
    const opponents=Object.entries(v.vs);if(opponents.length>FPS_PLAYBOOK_RULES.maxVsOpponents)return;
    for(const [k,s] of opponents){if(k.length>80||!finite(s?.trials,0,1e9)||!finite(s.wins,0,s.trials))return;vs[k]={trials:s.trials,wins:s.wins};}
    out[id]={spec,status:v.status,trials:v.trials,wins:v.wins,vs,...(v.parent?{parent:v.parent}:{}),generation:v.generation,bornAt:v.bornAt,statusAt:v.statusAt};
  }
  return out;
}
/** Strict loader for untrusted playbooks: malformed books are rejected whole, never repaired. */
export function loadFpsTeamPlaybook(raw:unknown):FpsTeamPlaybook|undefined {
  const v=raw as FpsTeamPlaybook;
  if(!v||typeof v!=='object'||v.version!==1||typeof v.map!=='string'||!/^[a-z0-9-]{1,40}$/.test(v.map))return;
  for(const k of ['rounds','innovations','promotions','archived'] as const)if(!finite(v[k],0,1e9))return;
  const attack=loadRecords(v.attack,validAttack),defense=loadRecords(v.defense,validDefense);
  if(!attack||!defense)return;
  // Seed plays are part of every book (a book missing one is incompatible, not repaired).
  if(Object.keys(LIVE_SEED_ATTACK_PLAYS).some(f=>!attack[`seed:${f}`])||Object.keys(LIVE_SEED_DEFENSE_PLAYS).some(f=>!defense[`seed:${f}`]))return;
  return {version:1,map:v.map,rounds:v.rounds,innovations:v.innovations,promotions:v.promotions,archived:v.archived,attack,defense};
}

/** Deterministic PRNG from a string (round ids), so replaying round records reproduces the book. */
export function fpsPlaybookRandom(seed:string):()=>number {
  let h=2166136261;for(let i=0;i<seed.length;i++){h^=seed.charCodeAt(i);h=Math.imul(h,16777619);}
  let a=h>>>0;
  return ()=>{a=(a+0x6d2b79f5)>>>0;let t=a;t=Math.imul(t^(t>>>15),t|1);t^=t+Math.imul(t^(t>>>7),t|61);return ((t^(t>>>14))>>>0)/4294967296;};
}
/** Beta(a, b) for integer a, b >= 1: the a-th smallest of a+b-1 uniforms (exact, deterministic). */
function betaSample(a:number,b:number,random:()=>number):number {
  const n=a+b-1,u=Array.from({length:n},random).sort((x,y)=>x-y);
  return u[a-1];
}
function posterior(r:FpsPlayRecord<unknown>,opponent?:string):[number,number] {
  const R=FPS_PLAYBOOK_RULES,vs=opponent?r.vs[opponent]:undefined;
  let wins=r.wins+(vs?vs.wins*R.vsWeight:0),losses=(r.trials-r.wins)+(vs?(vs.trials-vs.wins)*R.vsWeight:0);
  const total=wins+losses;
  if(total>R.evidenceCap){wins*=R.evidenceCap/total;losses*=R.evidenceCap/total;}
  return [1+Math.round(wins),1+Math.round(losses)];
}
export const fpsPlayMean=(r:FpsPlayRecord<unknown>,opponent?:string)=>{const [a,b]=posterior(r,opponent);return a/(a+b);};

/**
 * Pick a play: Thompson sample per play (overall stats plus extra weight on results against this
 * opponent), multiplied by the caller's decision prior (gameplan, IGL tendencies, lawful opponent
 * reads). `exploration` (0..1, from adaptive/varied calling) flattens the prior.
 */
export function chooseFpsPlay<T extends {id:string}>(
  book:Record<string,FpsPlayRecord<T>>,random:()=>number,prior:(spec:T)=>number,opponent?:string,exploration=.5,
):T {
  let best:T|undefined,score=-Infinity;
  const priorPower=1.1-Math.max(0,Math.min(1,exploration))*.7;
  for(const id of Object.keys(book).sort()){
    const r=book[id];if(r.status==='archived')continue;
    const [a,b]=posterior(r,opponent);
    const value=betaSample(a,b,random)*Math.pow(Math.max(.05,prior(r.spec)),priorPower)*(r.status==='candidate'?.85:1);
    if(value>score){score=value;best=r.spec;}
  }
  return best??Object.values(book)[0].spec;
}

const round3=(v:number)=>Math.round(v*1000)/1000;
function describe(field:string,delta:number):string {
  const more=delta>0;
  const words:Record<string,[string,string]>={rushBelow:['more rushes','fewer rushes'],rushSmokeBelow:['lighter rush utility','fuller rush utility'],midOpenBelow:['more Mid openings','fewer Mid openings'],
    defaultMidAbove:['less Mid probing','more Mid probing'],fakeOpenBelow:['longer fake','shorter fake'],fakeSmokeAbove:['fewer fake smokes','more fake smokes'],lurkerHoldBelow:['patient lurk','active lurk'],
    fakeWindow:['extended fake window','tight fake window'],pistolWeight:['pistol favourite','pistol rarity'],stackSlots:['heavier stack','lighter stack'],quietOpenBelow:['quieter opening','busier opening'],midPushBelow:['committed Mid push','token Mid push']};
  return (words[field]??[field,field])[more?0:1];
}
function mutateSpec<T extends {id:string;name:string}>(parent:T,others:readonly T[],ranges:Record<string,[number,number]>,flags:readonly string[],random:()=>number,side:FpsPlaySide):{spec:T;label:string} {
  const spec={...parent} as Record<string,unknown>,labels:string[]=[];
  const fields=Object.keys(ranges),count=1+Number(random()<.4);
  for(let i=0;i<count;i++){
    const field=fields[Math.floor(random()*fields.length)],[lo,hi]=ranges[field],span=hi-lo;
    const step=(random()<.5?-1:1)*span*(.04+random()*.08);
    let next=Math.max(lo,Math.min(hi,(spec[field] as number)+step));
    if(field==='stackSlots')next=Math.round(next);
    if(next===spec[field])continue;
    labels.push(describe(field,next-(spec[field] as number)));spec[field]=round3(next);
  }
  // Recombination: borrow one formation flag or the target site from another play on this side.
  if(others.length&&random()<.3){
    const donor=others[Math.floor(random()*others.length)] as Record<string,unknown>;
    const options=side==='attack'?[...flags,'site']:[...flags,'stack'];
    const field=options[Math.floor(random()*options.length)];
    if(donor[field]!==spec[field]){spec[field]=donor[field];if(spec[field]===undefined)delete spec[field];labels.push(`${field} from ${String(donor.name)}`);}
  }
  if(side==='defense'&&spec.stack===undefined)spec.stackSlots=4;
  if(!labels.length){const field=fields[0],[lo,hi]=ranges[field];const v=spec[field] as number;spec[field]=round3(v<(lo+hi)/2?Math.min(hi,v+(hi-lo)*.06):Math.max(lo,v-(hi-lo)*.06));labels.push(describe(field,(spec[field] as number)-v));}
  return {spec:spec as unknown as T,label:labels.join(', ')};
}
function specId(spec:object):string {
  const body=JSON.stringify(Object.entries(spec).filter(([k])=>k!=='id'&&k!=='name').sort(([a],[b])=>a.localeCompare(b)));
  let h=2166136261;for(let i=0;i<body.length;i++){h^=body.charCodeAt(i);h=Math.imul(h,16777619);}
  return `v:${(h>>>0).toString(36)}`;
}

export interface FpsPlaybookRound {
  /** Unique round id (ledger dedup; also seeds the deterministic innovation step). */
  id:string;side:FpsPlaySide;playId:string;won:boolean;opponent?:string;
  /** A learned variant travels with its spec and lineage, so any copy of the book can adopt it. */
  variant?:{spec:LiveAttackPlay|LiveDefensePlay;parent?:string;generation:number};
}
export interface FpsPlaybookChange {innovated?:string;promoted?:string[];archived?:string[]}

/** Record one round's result for the play that was called, then judge candidates and innovate. */
export function applyFpsPlaybookRound(book:FpsTeamPlaybook,round:FpsPlaybookRound):FpsPlaybookChange {
  const R=FPS_PLAYBOOK_RULES,plays=(round.side==='attack'?book.attack:book.defense) as Record<string,FpsPlayRecord<{id:string;name:string}>>;
  let played=plays[round.playId];
  if(!played&&round.variant){
    // A copy of the book that missed this variant adopts it as a candidate (validated, never trusted blindly).
    const spec=round.side==='attack'?validAttack(round.variant.spec):validDefense(round.variant.spec);
    if(spec&&(spec as {id:string}).id===round.playId&&Object.keys(plays).length<R.maxPlaysPerSide&&finite(round.variant.generation,0,1e6)){
      plays[round.playId]=played=record(spec as {id:string;name:string},book.rounds,'candidate',round.variant.parent&&idOk(round.variant.parent)?round.variant.parent:undefined,round.variant.generation);
    }
  }
  if(!played)throw Error('Unknown play');
  book.rounds++;
  played.trials++;if(round.won)played.wins++;
  if(round.opponent){
    if(!played.vs[round.opponent]&&Object.keys(played.vs).length>=R.maxVsOpponents){
      // Fold the least-seen opponent into the overall stats only (they already are); keep the key space bounded.
      const least=Object.entries(played.vs).sort((a,b)=>a[1].trials-b[1].trials||a[0].localeCompare(b[0]))[0][0];delete played.vs[least];
    }
    const vs=played.vs[round.opponent]??={trials:0,wins:0};vs.trials++;if(round.won)vs.wins++;
  }
  const change:FpsPlaybookChange={};
  // Judge candidates against their parents.
  for(const [id,r] of Object.entries(plays).sort(([a],[b])=>a.localeCompare(b))){
    if(r.status!=='candidate'||r.trials<R.judgeAfter)continue;
    const parent=r.parent?plays[r.parent]:undefined,bar=parent&&parent.trials>0?parent.wins/parent.trials:.5;
    if(r.wins/r.trials>=bar+R.promoteMargin){r.status='active';r.statusAt=book.rounds;book.promotions++;(change.promoted??=[]).push(id);}
    else if(r.trials>=R.giveUpAfter){r.status='archived';r.statusAt=book.rounds;book.archived++;(change.archived??=[]).push(id);}
  }
  // Keep the active book bounded: archive (never delete) the weakest well-tested play.
  const active=Object.entries(plays).filter(([,r])=>r.status==='active');
  if(active.length>R.maxActive){
    const weakest=active.filter(([,r])=>r.trials>=20).sort((a,b)=>fpsPlayMean(a[1])-fpsPlayMean(b[1])||a[0].localeCompare(b[0]))[0];
    if(weakest){weakest[1].status='archived';weakest[1].statusAt=book.rounds;book.archived++;(change.archived??=[]).push(weakest[0]);}
  }
  // Innovate: mutate/recombine a strong active play into a low-prior candidate.
  const sideRounds=Object.values(plays).reduce((n,r)=>n+r.trials,0);
  const candidates=Object.values(plays).filter(r=>r.status==='candidate').length;
  if(sideRounds%R.innovateEvery===0&&candidates<R.maxCandidates&&Object.keys(plays).length<R.maxPlaysPerSide){
    const random=fpsPlaybookRandom(`${round.id}:innovate`);
    const pool=Object.entries(plays).filter(([,r])=>r.status==='active'&&r.trials>=4).sort((a,b)=>fpsPlayMean(b[1])-fpsPlayMean(a[1])||a[0].localeCompare(b[0])).slice(0,4);
    if(pool.length){
      const [parentId,parent]=pool[Math.floor(random()*pool.length)];
      const others=Object.values(plays).filter(r=>r.status==='active'&&r.spec.id!==parentId).map(r=>r.spec);
      const {spec,label}=round.side==='attack'
        ?mutateSpec(parent.spec as unknown as LiveAttackPlay,others as unknown as LiveAttackPlay[],ATTACK_RANGES,ATTACK_FLAGS,random,'attack')
        :mutateSpec(parent.spec as unknown as LiveDefensePlay,others as unknown as LiveDefensePlay[],DEFENSE_RANGES,DEFENSE_FLAGS,random,'defense');
      const id=specId(spec);
      if(!plays[id]){
        const generation=parent.generation+1,base=parent.spec.name.split(' · ')[0];
        const named={...spec,id,name:`${base} · ${label}`.slice(0,80)};
        const valid=round.side==='attack'?validAttack(named):validDefense(named);
        if(valid){plays[id]=record(valid as {id:string;name:string},book.rounds,'candidate',parentId,generation);book.innovations++;change.innovated=id;}
      }
    }
  }
  return change;
}

/** Most-called and best plays, innovations and promotions: the per-cycle meta report. */
export function summarizeFpsPlaybook(book:FpsTeamPlaybook){
  const side=(plays:Record<string,FpsPlayRecord<{id:string;name:string;family:string}>>)=>{
    const all=Object.values(plays);
    return {active:all.filter(r=>r.status==='active').length,candidates:all.filter(r=>r.status==='candidate').length,archived:all.filter(r=>r.status==='archived').length,
      learned:all.filter(r=>r.spec.id.startsWith('v:')&&r.status==='active').length,
      popular:all.filter(r=>r.trials).sort((a,b)=>b.trials-a.trials).slice(0,3).map(r=>({name:r.spec.name,trials:r.trials,winRate:r.wins/r.trials})),
      best:all.filter(r=>r.trials>=8).sort((a,b)=>fpsPlayMean(b)-fpsPlayMean(a)).slice(0,3).map(r=>({name:r.spec.name,trials:r.trials,winRate:r.wins/r.trials}))};
  };
  return {map:book.map,rounds:book.rounds,innovations:book.innovations,promotions:book.promotions,archived:book.archived,attack:side(book.attack),defense:side(book.defense)};
}

/**
 * Lawful opponent model, accumulated across matches: only what the observing team saw (planted
 * sites, where first blood happened, and the observed-habit flags), never the opponent's internal
 * play choice.
 */
export interface FpsOpponentProfile {rounds:number;attackRounds:number;plants:{A:number;B:number};firstBlood:{A:number;B:number;Mid:number};earlyRush:number;slowDefault:number;heavyUtility:number;saves:number;passiveAnchors:number}
export interface FpsOpponentModel {version:1;opponents:Record<string,FpsOpponentProfile>}
export interface FpsObservedRound {opponentAttacked:boolean;plantSite?:'A'|'B';firstBlood?:'A'|'B'|'Mid';earlyRush:boolean;slowDefault:boolean;heavyUtility:boolean;saved:boolean;passiveAnchors:boolean}
export const createFpsOpponentModel=():FpsOpponentModel=>({version:1,opponents:{}});
const emptyProfile=():FpsOpponentProfile=>({rounds:0,attackRounds:0,plants:{A:0,B:0},firstBlood:{A:0,B:0,Mid:0},earlyRush:0,slowDefault:0,heavyUtility:0,saves:0,passiveAnchors:0});
export function recordFpsOpponentRound(model:FpsOpponentModel,opponent:string,seen:FpsObservedRound):void {
  const p=model.opponents[opponent]??=emptyProfile();
  p.rounds++;if(seen.opponentAttacked)p.attackRounds++;
  if(seen.plantSite)p.plants[seen.plantSite]++;if(seen.firstBlood)p.firstBlood[seen.firstBlood]++;
  if(seen.earlyRush)p.earlyRush++;if(seen.slowDefault)p.slowDefault++;if(seen.heavyUtility)p.heavyUtility++;if(seen.saved)p.saves++;if(seen.passiveAnchors)p.passiveAnchors++;
}
export function loadFpsOpponentModel(raw:unknown):FpsOpponentModel|undefined {
  const v=raw as FpsOpponentModel;
  if(!v||typeof v!=='object'||v.version!==1||!v.opponents||typeof v.opponents!=='object'||Array.isArray(v.opponents))return;
  const out=createFpsOpponentModel(),entries=Object.entries(v.opponents);if(entries.length>2000)return;
  for(const [k,p] of entries){
    if(k.length>80||!p||typeof p!=='object')return;
    const n=(x:unknown)=>finite(x,0,1e9);
    if(![p.rounds,p.attackRounds,p.earlyRush,p.slowDefault,p.heavyUtility,p.saves,p.passiveAnchors,p.plants?.A,p.plants?.B,p.firstBlood?.A,p.firstBlood?.B,p.firstBlood?.Mid].every(n))return;
    out.opponents[k]={rounds:p.rounds,attackRounds:p.attackRounds,plants:{A:p.plants.A,B:p.plants.B},firstBlood:{A:p.firstBlood.A,B:p.firstBlood.B,Mid:p.firstBlood.Mid},
      earlyRush:p.earlyRush,slowDefault:p.slowDefault,heavyUtility:p.heavyUtility,saves:p.saves,passiveAnchors:p.passiveAnchors};
  }
  return out;
}
/** Decision prior from a lawful opponent profile (1 = neutral). Needs a few observed rounds first. */
export function fpsCounterPrior(profile:FpsOpponentProfile|undefined,side:FpsPlaySide,spec:LiveAttackPlay|LiveDefensePlay):number {
  if(!profile||profile.rounds<5)return 1;
  if(side==='defense'){
    const d=spec as LiveDefensePlay,plants=profile.plants.A+profile.plants.B;
    const atk=Math.max(1,profile.attackRounds);
    let w=1;
    if(d.stack&&plants>=3)w*=.6+1.2*(profile.plants[d.stack]/plants);
    if(d.midPushPair&&profile.attackRounds)w*=.8+profile.firstBlood.Mid/atk;
    if(d.quietOpenBelow>0&&profile.attackRounds)w*=1+.5*profile.earlyRush/atk;
    if(profile.attackRounds>0){
      const rushRate=profile.earlyRush/atk,slowRate=profile.slowDefault/atk,utilRate=profile.heavyUtility/atk;
      if(rushRate>=0.35){
        if(d.aggressivePair)w*=1+0.45*rushRate;
        const scoreA=profile.plants.A+profile.firstBlood.A,scoreB=profile.plants.B+profile.firstBlood.B;
        if(d.stack&&scoreA!==scoreB){
          const favored=scoreA>scoreB?'A':'B';
          if(d.stack===favored)w*=1+0.25*rushRate;
        }
        if(d.family==='retake_setup')w*=0.82;
      }
      if(slowRate>=0.40||utilRate>=0.40){
        if(d.family==='retake_setup')w*=1+0.4*Math.max(slowRate,utilRate);
        if(d.flexMid)w*=1+0.25*slowRate;
      }
    }
    return w;
  }
  const a=spec as LiveAttackPlay,defended=Math.max(1,profile.rounds-profile.attackRounds);
  let w=1;
  if(a.rushBelow>0)w*=.8+.6*profile.passiveAnchors/defended;
  if(a.fake)w*=.9+.4*profile.passiveAnchors/defended;
  const midFbRate=profile.firstBlood.Mid/defended;
  if(midFbRate>=0.25){
    if(a.family==='mid_control')w*=0.78;
    if(a.family==='split_a'||a.family==='split_b')w*=a.midOpenBelow>0.3?1.18:1;
    if(a.family==='rush_a'||a.family==='rush_b')w*=1.12;
  }
  const fbA=profile.firstBlood.A,fbB=profile.firstBlood.B;
  const highRush=profile.attackRounds>0&&profile.earlyRush/profile.attackRounds>=0.35;
  const siteAggression=fbA!==fbB&&Math.max(fbA,fbB)>=2;
  if(siteAggression){
    const strongSite=fbA>fbB?'A':'B',weakSite=strongSite==='A'?'B':'A';
    if(a.site===weakSite)w*=1.25;
    else if(a.site===strongSite)w*=0.82;
  }
  if(highRush||siteAggression){
    if(a.family==='default_pick'||a.family==='fake_execute')w*=1.25;
  }
  return w;
}
