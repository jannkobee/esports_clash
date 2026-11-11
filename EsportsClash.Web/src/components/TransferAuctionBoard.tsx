import {CountryFlag} from './CountryFlag';
import {fpsRoleFit} from '../fps/fpsRoleFit';
import {CountrySelect} from './CountrySelect';
import {useAccount} from '../AccountContext';
import {request} from '../cloudPersistence';
import {onWorldUpdate} from '../worldLive';
import {FPS_ATTRIBUTE_LABELS} from '../fps/fpsPersonality';
import {PersonalityMarks} from './PersonalityMarks';
import {FPS_IDENTITY_PERSONALITIES} from '../fps/fpsIdentity';
import {FpsIdentityMarks} from './FpsIdentityMarks';
import {useEffect,useState} from 'react';
import {Search,SlidersHorizontal,Gavel,Clock3,ArrowUpRight,X,ChevronDown,ChevronUp,Check} from 'lucide-react';
import type {Auction,PlayerCard} from './ClubMarketView';
import {WorldPlayerPortrait} from './WorldPlayerPortrait';
import {pediaHref,pediaMoney,pediaTime} from '../hexapedia';
import {toScale10} from '../marketBatchEngine';

export interface ExchangeResult {ok:boolean;error?:string}
export function ExchangeSkills({stats}:{stats?:PlayerCard['stats']}){
  const labels=Object.entries(FPS_ATTRIBUTE_LABELS).map(([key,title])=>[key,key.toUpperCase(),title]);
  return <dl className="exchange-skills">{labels.map(([key,short,title])=><div key={key} title={title}><dt>{short}</dt><dd>{typeof stats?.[key]==='number'?toScale10(stats[key]):'—'}</dd></div>)}</dl>;
}

function AuctionRow({auction:a,open,onOpen,busy,available,onBid}:{auction:Auction;open:boolean;onOpen:()=>void;busy:boolean;available:number;onBid:(id:number,amount:number)=>Promise<ExchangeResult>}){
  const [amount,setAmount]=useState(''),[error,setError]=useState('');
  const cents=Math.round(Number(amount)*100),valid=Number.isFinite(cents)&&cents>=a.minimum&&cents<=available&&cents<=1000000000;
  return <article className={'exchange-auction'+(open?' exchange-auction--open':'')}>
    <div className="exchange-auction-main">
      <div className="exchange-person"><WorldPlayerPortrait id={a.player_id} name={a.player} appearance={a.presentation?.appearance} size={76}/><div><a className="exchange-player-name" href={pediaHref('players',a.player_id)}>{a.player}<ArrowUpRight size={13}/></a><p>{fpsRoleFit(a.stats)} · {a.nationality?<CountryFlag code={a.nationality.code} name={a.nationality.name}/>:'Nationality unlisted'}{a.age?' · '+a.age+' years':''}</p><span className="exchange-overall"><strong>{toScale10(a.overall)}</strong> / 10 overall</span><>{a.fpsIdentity?<FpsIdentityMarks profile={a.fpsIdentity}/>:<PersonalityMarks primary={a.primaryPersonality} secondary={a.secondaryPersonality}/>}</></div></div>
      <ExchangeSkills stats={a.stats}/>
      <div className="exchange-auction-price"><small>{a.bid===null?'Opening price':'Current bid'}</small><strong>{pediaMoney(a.bid??a.minimum)}</strong><span>{a.wage==null?'Wage unlisted':pediaMoney(a.wage*100)+' / week'}</span></div>
      <div className="exchange-auction-deadline"><small><Clock3 size={12}/> Closes · Manila</small><time dateTime={a.closes_at}>{pediaTime(a.closes_at)}</time>{a.leading?<span className="exchange-leading"><Check size={12}/> You're leading</span>:a.your_listing?<span>Your listing</span>:<span>Next bid {pediaMoney(a.minimum)}</span>}</div>
      {a.your_listing?<a className="exchange-record-link" href={pediaHref('players',a.player_id)}>Player record<ArrowUpRight size={13}/></a>:<button className={'cm-btn '+(open?'':'cm-btn-primary')} disabled={busy||a.leading} onClick={()=>{setAmount(String(a.minimum/100));setError('');onOpen();}}><Gavel size={14}/>{a.leading?'Leading':open?'Close bid':'Bid'}{open?<ChevronUp size={13}/>:!a.leading&&<ChevronDown size={13}/>}</button>}
    </div>
    <div className="exchange-auction-meta"><span>Seller <a href={pediaHref('teams',a.seller_id)}>{a.seller}</a></span>{a.bidder&&<span>Leading club <a href={pediaHref('teams',a.bidder.id)}>{a.bidder.name}</a></span>}</div>
    {open&&!a.your_listing&&!a.leading&&<form className="exchange-bid-desk" onSubmit={async e=>{e.preventDefault();setError('');const result=await onBid(a.id,cents);if(result.ok)onOpen();else setError(result.error??'Your bid could not be placed.');}}>
      <div><h4>Bid for {a.player}</h4><p>Your bid is held from available money. The server checks the latest price.</p><small>Available {pediaMoney(available)}</small></div>
      <label>Bid amount · PHP<div className="exchange-money-input"><span>₱</span><input aria-label={'Bid amount for '+a.player} type="number" min={a.minimum/100} max={Math.min(available,1000000000)/100} step=".01" required value={amount} onChange={e=>setAmount(e.target.value)}/></div><small>Minimum {pediaMoney(a.minimum)}</small></label>
      <div className="exchange-bid-actions"><button className="cm-btn" type="button" disabled={busy} onClick={()=>setAmount(String((a.minimum+5000)/100))}>Minimum + ₱50</button><button className="cm-btn cm-btn-primary" disabled={busy||!valid}><Gavel size={14}/>{busy?'Submitting…':'Confirm bid'}</button></div>
      {a.minimum>available&&<p role="status" className="exchange-field-error">Available money is below the next bid.</p>}{error&&<p className="exchange-field-error" role="alert">{error}</p>}
    </form>}
  </article>;
}

export function TransferAuctionBoard({auctions,available,busy,onBid,initialOwnership='all'}:{auctions:Auction[];available:number;busy:boolean;onBid:(id:number,amount:number)=>Promise<ExchangeResult>;initialOwnership?:string}){
 const {session}=useAccount();
 const [query,setQuery]=useState(''),[role,setRole]=useState(''),[rating,setRating]=useState(0),[country,setCountry]=useState(''),[sort,setSort]=useState('closing'),[ownership,setOwnership]=useState(initialOwnership),[personality,setPersonality]=useState(''),[opened,setOpened]=useState<number|null>(null),[page,setPage]=useState(1),[perPage,setPerPage]=useState(20),[revision,setRevision]=useState(0);
 const [loading,setLoading]=useState(true),[error,setError]=useState(''),[result,setResult]=useState<{items:Auction[];meta:{total:number;last_page:number;page:number}}>({items:auctions,meta:{total:auctions.length,last_page:1,page:1}});
 useEffect(()=>onWorldUpdate(['market','players','clubs'],()=>setRevision(r=>r+1)),[]);
 useEffect(()=>{const c=new AbortController();let active=true;setLoading(true);const timer=setTimeout(()=>{const params=new URLSearchParams({q:query,role,minimum:String(rating),nationality:country,personality,sort,view:ownership,page:String(page),per_page:String(perPage)});void request<{data:typeof result}>('/online/market/auctions?'+params,session,{signal:c.signal}).then(r=>{if(active){setResult(r.data);setError('');}}).catch(e=>{if(active&&!c.signal.aborted)setError(e.message);}).finally(()=>{if(active)setLoading(false);});},250);return()=>{active=false;clearTimeout(timer);c.abort();};},[query,role,rating,country,personality,sort,ownership,page,perPage,revision,session?.token,available,busy]);
 const change=()=>{setPage(1);setOpened(null);},rows=result.items,filtered=!!(query||role||rating||country||personality||ownership!=='all');
 return <section className="exchange-board" aria-busy={loading}><header className="exchange-section-heading"><div><h2><Gavel size={19}/>Open auctions</h2><p>Compare skills and personalities. Review the contract. Set your price.</p></div><span>{loading?'Updating listings…':result.meta.total.toLocaleString()+' matching listings'}</span></header>
 <div className="exchange-filter-desk"><label className="exchange-search"><span><Search size={14}/>Find a player or club</span><input type="search" value={query} maxLength={100} placeholder="IGN, club or tag · search every listing" onChange={e=>{setQuery(e.target.value);change();}}/></label><label><span>Overall</span><select value={rating} onChange={e=>{setRating(Number(e.target.value));change();}}><option value={0}>Any skill</option>{[1,2,3,4,5,6,7,8,9,10].map(n=><option value={n} key={n}>{n}/10 or better</option>)}</select></label><label><span>Nationality</span><CountrySelect label="Nationality" value={country} onChange={v=>{setCountry(v);change();}} emptyLabel="Any country"/></label><label><span>Personality</span><select value={personality} onChange={e=>{setPersonality(e.target.value);change();}}><option value="">Every personality</option>{FPS_IDENTITY_PERSONALITIES.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}</select></label><label><span>Sort listings</span><select value={sort} onChange={e=>{setSort(e.target.value);change();}}><option value="closing">Closing soon</option><option value="price">Lowest price</option><option value="skill">Highest skill</option><option value="name">Player name</option></select></label></div>
 <div className="exchange-list-toolbar"><nav aria-label="Auction ownership">{[['all','All listings'],['mine','My listings'],['leading','Leading bids']].map(([key,label])=><button key={key} className={ownership===key?'active':''} aria-pressed={ownership===key} onClick={()=>{setOwnership(key);change();}}>{label}</button>)}</nav><label className="auction-page-size">Rows<select value={perPage} onChange={e=>{setPerPage(Number(e.target.value));change();}}><option>20</option><option>50</option></select></label>{filtered&&<button className="exchange-text-button" onClick={()=>{setQuery('');setRole('');setRating(0);setCountry('');setPersonality('');setOwnership('all');change();}}><X size={13}/>Clear filters</button>}</div>
 {error&&<p className="club-notice" role="alert">{error}</p>}<div className="exchange-auctions">{rows.map(a=><AuctionRow key={a.id} auction={a} open={opened===a.id} onOpen={()=>setOpened(opened===a.id?null:a.id)} busy={busy||loading} available={available} onBid={async(id,amount)=>{const r=await onBid(id,amount);if(r.ok)setRevision(v=>v+1);return r;}}/>)}</div>
 {!rows.length&&!loading&&<div className="exchange-empty"><Search size={28}/><h3>{filtered?'No matching players':'The exchange is quiet'}</h3><p>{filtered?'Try another personality, role or country. Filters search all listings.':'Reserve listings appear here when clubs publish them.'}</p></div>}
 <div className="record-pagination"><span>{result.meta.total} listings · page {page} of {result.meta.last_page}</span><button className="cm-btn" disabled={loading||page<=1} onClick={()=>{setPage(p=>p-1);setOpened(null);}}>Previous</button><button className="cm-btn" disabled={loading||page>=result.meta.last_page} onClick={()=>{setPage(p=>p+1);setOpened(null);}}>Next</button></div>
 </section>;
}
