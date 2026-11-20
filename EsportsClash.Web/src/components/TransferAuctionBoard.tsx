import {SearchField} from './ui/SearchField';
import {fpsRoleFit} from '../fps/fpsRoleFit';
import {CountrySelect} from './CountrySelect';
import {useAccount} from '../AccountContext';
import {request} from '../cloudPersistence';
import {onWorldUpdate} from '../worldLive';
import {FPS_ATTRIBUTE_LABELS} from '../fps/fpsPersonality';
import {FPS_IDENTITY_PERSONALITIES} from '../fps/fpsIdentity';
import {useEffect,useMemo,useState} from 'react';
import {Search,Gavel,Clock3,ArrowUpRight,X,Check,TrendingUp,Repeat2,Layers,Sparkles,Target} from 'lucide-react';
import type {Auction,PlayerCard} from './ClubMarketView';
import {pediaHref,pediaMoney,pediaTime} from '../hexapedia';
// Manager-facing 1–10 levels use the one owner-mandated conversion (fpsScale10).
import {fpsScale10 as toScale10} from '../fps/fpsScale10';
import {PlayerCard as GameCard} from './game/PlayerCard';
import {HexRadar} from './game/HexRadar';
import {ATTRIBUTES,rarityOf,scaledAttributes,type AttributeKey} from './game/positions';
import './transfer-cards.css';

export interface ExchangeResult {ok:boolean;error?:string}
export function ExchangeSkills({stats}:{stats?:PlayerCard['stats']}){
  const labels=Object.entries(FPS_ATTRIBUTE_LABELS).map(([key,title])=>[key,key.toUpperCase(),title]);
  return <dl className="exchange-skills">{labels.map(([key,short,title])=><div key={key} title={title}><dt>{short}</dt><dd>{typeof stats?.[key]==='number'?toScale10(stats[key]):'—'}</dd></div>)}</dl>;
}

interface MyPlayer {id:string;name:string;ovr:number;stats?:Record<string,number>}
interface Impact {kind:'start'|'rotate'|'depth';title:string;detail:string;delta:number}

/** What a listing would do for your club, judged against your own starting five. */
function impactOf(a:Auction,five:MyPlayer[]):Impact|null{
  if(five.length<5)return null;
  const level=toScale10(a.overall),weakest=[...five].map((p,i)=>({p,i})).sort((x,y)=>x.p.ovr-y.p.ovr)[0],theirs=toScale10(weakest.p.ovr);
  if(level>theirs)return {kind:'start',title:'Walks into your five',detail:`Starts over #${weakest.i+1} ${weakest.p.name}`,delta:level-theirs};
  if(level===theirs)return {kind:'rotate',title:'Rotation option',detail:`Level with #${weakest.i+1} ${weakest.p.name}`,delta:0};
  return {kind:'depth',title:'Bench depth',detail:'Cover for injuries and form slumps',delta:level-theirs};
}

/** Time left on an auction, with urgency. */
function countdown(closes:string,now:number):{text:string;tone:'urgent'|'soon'|'calm'|'closed'}{
  const ms=Date.parse(closes)-now;if(ms<=0)return {text:'Closing',tone:'closed'};
  const h=Math.floor(ms/3600000),m=Math.floor(ms%3600000/60000);
  if(h<1)return {text:`${m} min left`,tone:'urgent'};
  if(h<6)return {text:`${h} h ${m} min left`,tone:'soon'};
  return {text:`Closes ${pediaTime(closes)}`,tone:'calm'};
}

function celebrate(){
  if(typeof window==='undefined'||window.matchMedia?.('(prefers-reduced-motion: reduce)').matches)return;
  void import('canvas-confetti').then(({default:confetti})=>{
    const colors=['#56d08a','#f5b942','#4ea8ff','#ffffff',getComputedStyle(document.documentElement).getPropertyValue('--hx-red').trim()||'#bd3049'];
    confetti({particleCount:90,spread:70,startVelocity:42,origin:{y:.75},colors,scalar:.9});
    setTimeout(()=>confetti({particleCount:60,spread:110,startVelocity:30,origin:{y:.7},colors,scalar:.8}),180);
  }).catch(()=>{});
}

function AuctionCard({auction:a,open,onOpen,busy,available,onBid,five,team,now}:{auction:Auction;open:boolean;onOpen:()=>void;busy:boolean;available:number;onBid:(id:number,amount:number)=>Promise<ExchangeResult>;five:MyPlayer[];team:Partial<Record<AttributeKey,number>>;now:number}){
  const [amount,setAmount]=useState(''),[error,setError]=useState(''),[won,setWon]=useState(false);
  const cents=Math.round(Number(amount)*100),valid=Number.isFinite(cents)&&cents>=a.minimum&&cents<=available&&cents<=1000000000;
  const impact=impactOf(a,five),attrs=scaledAttributes(a.stats),level=toScale10(a.overall),time=countdown(a.closes_at,now);
  const boost=ATTRIBUTES.map(x=>({...x,gain:(attrs[x.key]??0)-(team[x.key]??0)})).sort((x,y)=>y.gain-x.gain)[0];
  const deltas=Object.fromEntries(ATTRIBUTES.map(x=>[x.key,team[x.key]!=null&&attrs[x.key]!=null?Math.round(attrs[x.key]!-team[x.key]!):0]));
  const quick=[a.minimum,Math.ceil(a.minimum*1.05/100)*100,Math.ceil(a.minimum*1.15/100)*100].filter((v,i,all)=>all.indexOf(v)===i);
  const ImpactIcon=impact?.kind==='start'?TrendingUp:impact?.kind==='rotate'?Repeat2:Layers;
  return <article className={`auction-card is-${rarityOf(level)}${impact?' impact-'+impact.kind:''}${a.leading?' is-leading':''}${open?' is-open':''}${won?' is-won':''}`}>
    <GameCard size="md" player={{id:a.player_id,name:a.player,ovr:a.overall,stats:a.stats,nationality:a.nationality??undefined,appearance:a.presentation?.appearance}}
      deltas={five.length?deltas:undefined} ribbon={a.leading?'You lead':a.your_listing?'Your listing':undefined}/>
    <div className="auction-card__info">
      {impact&&<div className="auction-impact"><span className="auction-impact__icon"><ImpactIcon size={16} aria-hidden="true"/></span><div><strong>{impact.title}</strong><small>{impact.detail}</small></div>{impact.delta!==0&&<b className={impact.delta>0?'is-up':'is-down'}>{impact.delta>0?'+':''}{impact.delta} OVR</b>}</div>}
      <div className="auction-card__compare">
        <HexRadar values={attrs} compare={five.length?team:undefined} size={118} tone="rarity"/>
        <div className="auction-card__facts">
          {five.length>0&&boost&&boost.gain>0&&<p className="auction-card__boost"><Sparkles size={13} aria-hidden="true"/>Brings <b>{boost.label} +{Math.round(boost.gain)}</b> over your five</p>}
          {a.fpsIdentity?.personality&&<p className="auction-card__persona">{a.fpsIdentity.personality.name}</p>}
          <p className="auction-card__meta">{[fpsRoleFit(a.stats),a.age?a.age+' yrs':null].filter(Boolean).join(' · ')}</p>
          <p className="auction-card__meta">From <a href={pediaHref('teams',a.seller_id)}>{a.seller}</a>{a.bidder&&!a.leading&&<> · top bid <a href={pediaHref('teams',a.bidder.id)}>{a.bidder.name}</a></>}</p>
        </div>
      </div>
      <div className="auction-card__deal">
        <div className="auction-price"><small>{a.bid===null?'Opening price':'Current bid'}</small><strong>{pediaMoney(a.bid??a.minimum)}</strong><span>{a.wage==null?'Wage unlisted':pediaMoney(a.wage*100)+' / wk'}</span></div>
        <div className={'auction-timer is-'+time.tone}><Clock3 size={13} aria-hidden="true"/><time dateTime={a.closes_at}>{time.text}</time></div>
        {a.your_listing?<a className="cm-btn cm-btn-sm" href={pediaHref('players',a.player_id)}>Record<ArrowUpRight size={13}/></a>
          :a.leading?<span className="auction-leading"><Check size={13} aria-hidden="true"/>Leading</span>
          :<button type="button" className={'cm-btn '+(open?'':'cm-btn-primary')} disabled={busy} onClick={()=>{setAmount(String(a.minimum/100));setError('');onOpen();}}><Gavel size={14} aria-hidden="true"/>{open?'Close':'Bid'}</button>}
      </div>
      {won&&<p className="auction-card__won" role="status"><Sparkles size={14} aria-hidden="true"/>You're leading for {a.player}. Hold it until the hammer falls.</p>}
      {open&&!a.your_listing&&!a.leading&&<form className="auction-bid" onSubmit={async e=>{e.preventDefault();setError('');const result=await onBid(a.id,cents);if(result.ok){setWon(true);celebrate();onOpen();}else setError(result.error??'Your bid could not be placed.');}}>
        <div className="auction-bid__quick" role="group" aria-label="Quick bids">{quick.map((v,i)=><button key={v} type="button" className={'auction-chip'+(cents===v?' is-active':'')} disabled={busy||v>available} onClick={()=>setAmount(String(v/100))}>{i===0?'Minimum':i===1?'+5%':'+15%'}<b>{pediaMoney(v)}</b></button>)}</div>
        <label className="auction-bid__amount"><span className="ui-field-label">Your bid · PHP</span><span className="exchange-money-input"><span>₱</span><input aria-label={'Bid amount for '+a.player} type="number" min={a.minimum/100} max={Math.min(available,1000000000)/100} step=".01" required value={amount} onChange={e=>setAmount(e.target.value)}/></span></label>
        <button className="cm-btn cm-btn-primary" disabled={busy||!valid}><Gavel size={14} aria-hidden="true"/>{busy?'Placing…':'Place bid'}</button>
        <p className="auction-bid__note">Held from your {pediaMoney(available)} until you are outbid or the auction closes.</p>
        {a.minimum>available&&<p role="status" className="exchange-field-error">Your available money is below the next bid.</p>}{error&&<p className="exchange-field-error" role="alert">{error}</p>}
      </form>}
    </div>
  </article>;
}

export function TransferAuctionBoard({auctions,available,busy,onBid,initialOwnership='all'}:{auctions:Auction[];available:number;busy:boolean;onBid:(id:number,amount:number)=>Promise<ExchangeResult>;initialOwnership?:string}){
 const {session}=useAccount();
 const [query,setQuery]=useState(''),[role,setRole]=useState(''),[rating,setRating]=useState(0),[country,setCountry]=useState(''),[sort,setSort]=useState('closing'),[ownership,setOwnership]=useState(initialOwnership),[personality,setPersonality]=useState(''),[opened,setOpened]=useState<number|null>(null),[page,setPage]=useState(1),[perPage,setPerPage]=useState(20),[revision,setRevision]=useState(0);
 const [loading,setLoading]=useState(true),[error,setError]=useState(''),[result,setResult]=useState<{items:Auction[];meta:{total:number;last_page:number;page:number}}>({items:auctions,meta:{total:auctions.length,last_page:1,page:1}});
 const [five,setFive]=useState<MyPlayer[]>([]),[now,setNow]=useState(()=>Date.now());
 useEffect(()=>onWorldUpdate(['market','players','clubs'],()=>setRevision(r=>r+1)),[]);
 useEffect(()=>{const t=setInterval(()=>setNow(Date.now()),30000);return()=>clearInterval(t);},[]);
 useEffect(()=>{if(!session)return;const c=new AbortController();void request<{data:{club:{lineup:{instance_id:string}[]};cards:{id:string;definition:{name:string;ovr:number;stats?:Record<string,number>}}[]}}>('/online',session,{signal:c.signal}).then(r=>{const cards=r.data.cards;setFive(r.data.club.lineup.map(s=>cards.find(x=>x.id===s.instance_id)).filter((x):x is NonNullable<typeof x>=>!!x).map(x=>({id:x.id,name:x.definition.name,ovr:x.definition.ovr,stats:x.definition.stats})));}).catch(()=>{});return()=>c.abort();},[session?.token,revision]);
 useEffect(()=>{const c=new AbortController();let active=true;setLoading(true);const timer=setTimeout(()=>{const params=new URLSearchParams({q:query,role,minimum:String(rating),nationality:country,personality,sort,view:ownership,page:String(page),per_page:String(perPage)});void request<{data:typeof result}>('/online/market/auctions?'+params,session,{signal:c.signal}).then(r=>{if(active){setResult(r.data);setError('');}}).catch(e=>{if(active&&!c.signal.aborted)setError(e.message);}).finally(()=>{if(active)setLoading(false);});},250);return()=>{active=false;clearTimeout(timer);c.abort();};},[query,role,rating,country,personality,sort,ownership,page,perPage,revision,session?.token,available,busy]);
 const team=useMemo(()=>{const out:Partial<Record<AttributeKey,number>>={};for(const {key} of ATTRIBUTES){const v=five.map(p=>scaledAttributes(p.stats)[key]).filter((x):x is number=>x!=null);if(v.length)out[key]=v.reduce((s,x)=>s+x,0)/v.length;}return out;},[five]);
 const needs=ATTRIBUTES.filter(a=>team[a.key]!=null).sort((a,b)=>team[a.key]!-team[b.key]!).slice(0,2);
 const change=()=>{setPage(1);setOpened(null);},rows=result.items,filtered=!!(query||role||rating||country||personality||ownership!=='all');
 const upgrades=rows.filter(a=>impactOf(a,five)?.kind==='start').length;
 return <section className="exchange-board" aria-busy={loading}>
 <header className="auction-hero">
   <div className="auction-hero__intro"><h2><Gavel size={20} aria-hidden="true"/>Transfer market</h2><p>{loading?'Updating listings…':`${result.meta.total.toLocaleString()} players for sale`}{upgrades>0&&<> · <b className="auction-hero__hot">{upgrades} would walk into your five</b></>}</p></div>
   {needs.length>0&&<div className="auction-hero__needs"><span><Target size={14} aria-hidden="true"/>Your five needs</span>{needs.map(n=><b key={n.key}>{n.label} <small>{team[n.key]!.toFixed(1)}</small></b>)}</div>}
   <HexRadar className="auction-hero__radar" values={team} size={92}/>
 </header>
 <div className="exchange-filter-desk"><SearchField className="exchange-search" label="Find a player or club" showLabel placeholder="IGN, club or tag · search every listing" value={query} onChange={v=>{setQuery(v);change();}}/><label><span>Overall</span><select value={rating} onChange={e=>{setRating(Number(e.target.value));change();}}><option value={0}>Any skill</option>{[1,2,3,4,5,6,7,8,9,10].map(n=><option value={n} key={n}>{n}/10 or better</option>)}</select></label><label><span>Nationality</span><CountrySelect label="Nationality" value={country} onChange={v=>{setCountry(v);change();}} emptyLabel="Any country"/></label><label><span>Personality</span><select value={personality} onChange={e=>{setPersonality(e.target.value);change();}}><option value="">Every personality</option>{FPS_IDENTITY_PERSONALITIES.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}</select></label><label><span>Sort listings</span><select value={sort} onChange={e=>{setSort(e.target.value);change();}}><option value="closing">Closing soon</option><option value="price">Lowest price</option><option value="skill">Highest skill</option><option value="name">Player name</option></select></label></div>
 <div className="exchange-list-toolbar"><nav aria-label="Auction ownership">{[['all','All listings'],['mine','My listings'],['leading','Leading bids']].map(([key,label])=><button key={key} className={ownership===key?'active':''} aria-pressed={ownership===key} onClick={()=>{setOwnership(key);change();}}>{label}</button>)}</nav><label className="auction-page-size">Rows<select value={perPage} onChange={e=>{setPerPage(Number(e.target.value));change();}}><option>20</option><option>50</option></select></label>{filtered&&<button className="exchange-text-button" onClick={()=>{setQuery('');setRole('');setRating(0);setCountry('');setPersonality('');setOwnership('all');change();}}><X size={13}/>Clear filters</button>}</div>
 {error&&<p className="club-notice" role="alert">{error}</p>}
 <div className="auction-grid">{rows.map(a=><AuctionCard key={a.id} auction={a} open={opened===a.id} onOpen={()=>setOpened(opened===a.id?null:a.id)} busy={busy||loading} available={available} five={five} team={team} now={now} onBid={async(id,amount)=>{const r=await onBid(id,amount);if(r.ok)setRevision(v=>v+1);return r;}}/>)}</div>
 {!rows.length&&!loading&&<div className="exchange-empty"><Search size={28}/><h3>{filtered?'No matching players':'The exchange is quiet'}</h3><p>{filtered?'Try another personality, role or country. Filters search all listings.':'Reserve listings appear here when clubs publish them.'}</p></div>}
 <div className="record-pagination"><span>{result.meta.total} listings · page {page} of {result.meta.last_page}</span><button className="cm-btn" disabled={loading||page<=1} onClick={()=>{setPage(p=>p-1);setOpened(null);}}>Previous</button><button className="cm-btn" disabled={loading||page>=result.meta.last_page} onClick={()=>{setPage(p=>p+1);setOpened(null);}}>Next</button></div>
 </section>;
}
