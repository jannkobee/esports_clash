import {useMemo,useState} from 'react';
import {Search,SlidersHorizontal,Gavel,Clock3,ArrowUpRight,X,ChevronDown,ChevronUp,Check} from 'lucide-react';
import type {Auction,PlayerCard} from './ClubMarketView';
import {WorldPlayerPortrait} from './WorldPlayerPortrait';
import {pediaHref,pediaMoney,pediaTime} from '../avatarpedia';
import {toScale10} from '../marketBatchEngine';

export interface ExchangeResult {ok:boolean;error?:string}
export function ExchangeSkills({stats}:{stats?:PlayerCard['stats']}){
  const labels=[['lan','LAN','Mechanics & laning'],['tf','TF','Teamfights'],['iq','IQ','Game sense'],['ldr','LDR','Leadership'],['clu','CLU','Clutch'],['sta','STA','Stamina'],['flx','FLX','Flexibility']];
  return <dl className="exchange-skills">{labels.map(([key,short,title])=><div key={key} title={title}><dt>{short}</dt><dd>{typeof stats?.[key]==='number'?toScale10(stats[key]):'—'}</dd></div>)}</dl>;
}

function AuctionRow({auction:a,open,onOpen,busy,available,onBid}:{auction:Auction;open:boolean;onOpen:()=>void;busy:boolean;available:number;onBid:(id:number,amount:number)=>Promise<ExchangeResult>}){
  const [amount,setAmount]=useState(''),[error,setError]=useState('');
  const cents=Math.round(Number(amount)*100),valid=Number.isFinite(cents)&&cents>=a.minimum&&cents<=available&&cents<=1000000000;
  return <article className={'exchange-auction'+(open?' exchange-auction--open':'')}>
    <div className="exchange-auction-main">
      <div className="exchange-person"><WorldPlayerPortrait id={a.player_id} name={a.player} size={76}/><div><a className="exchange-player-name" href={pediaHref('players',a.player_id)}>{a.player}<ArrowUpRight size={13}/></a><p>{a.role??'Role unlisted'} · {a.nationality?.name??'Nationality unlisted'}{a.age?' · '+a.age+' years':''}</p><span className="exchange-overall"><strong>{toScale10(a.overall)}</strong> / 10 overall</span></div></div>
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
  const [query,setQuery]=useState(''),[role,setRole]=useState(''),[rating,setRating]=useState(0),[country,setCountry]=useState(''),[sort,setSort]=useState('closing'),[ownership,setOwnership]=useState(initialOwnership),[opened,setOpened]=useState<number|null>(null);
  const roles=[...new Set([...auctions.map(a=>a.role??'Unspecified'),...(role?[role]:[])])].sort();
  const countries=[...new Set([...auctions.map(a=>a.nationality?.name).filter((x):x is string=>!!x),...(country?[country]:[])])].sort();
  const rows=useMemo(()=>auctions.filter(a=>(!query.trim()||(a.player+' '+a.seller+' '+a.seller_tag+' '+(a.nationality?.name??'')).toLowerCase().includes(query.trim().toLowerCase()))&&(!role||(a.role??'Unspecified')===role)&&toScale10(a.overall)>=rating&&(!country||a.nationality?.name===country)&&(ownership==='all'||ownership==='mine'&&a.your_listing||ownership==='leading'&&a.leading)).sort((a,b)=>sort==='price'?(a.bid??a.minimum)-(b.bid??b.minimum):sort==='skill'?b.overall-a.overall:sort==='name'?a.player.localeCompare(b.player):Date.parse(a.closes_at)-Date.parse(b.closes_at)),[auctions,query,role,rating,country,sort,ownership]);
  const filtered=!!(query||role||rating||country||ownership!=='all');
  return <section className="exchange-board"><header className="exchange-section-heading"><div><h2><Gavel size={19}/> Open auctions</h2><p>Compare the player. Check the wage. Set your price.</p></div><span>{rows.length} of {auctions.length} listings</span></header>
    <div className="exchange-filter-desk"><label className="exchange-search"><span><Search size={14}/> Find a player or club</span><input type="search" value={query} placeholder="IGN, club, tag or nationality" onChange={e=>setQuery(e.target.value)}/></label><label><span><SlidersHorizontal size={14}/> Role</span><select value={role} onChange={e=>setRole(e.target.value)}><option value="">Any role</option>{roles.map(r=><option key={r}>{r}</option>)}</select></label><label><span>Overall</span><select value={rating} onChange={e=>setRating(Number(e.target.value))}><option value={0}>Any skill</option>{[1,2,3,4,5,6,7,8,9,10].map(n=><option value={n} key={n}>{n}/10 or better</option>)}</select></label><label><span>Nationality</span><select value={country} onChange={e=>setCountry(e.target.value)}><option value="">Any country</option>{countries.map(c=><option key={c}>{c}</option>)}</select></label><label><span>Sort listings</span><select value={sort} onChange={e=>setSort(e.target.value)}><option value="closing">Closing soon</option><option value="price">Lowest price</option><option value="skill">Highest skill</option><option value="name">Player name</option></select></label></div>
    <div className="exchange-list-toolbar"><nav aria-label="Auction ownership">{[['all','All listings'],['mine','My listings'],['leading','Leading bids']].map(([key,label])=><button key={key} className={ownership===key?'active':''} aria-pressed={ownership===key} onClick={()=>setOwnership(key)}>{label}</button>)}</nav>{filtered&&<button className="exchange-text-button" onClick={()=>{setQuery('');setRole('');setRating(0);setCountry('');setOwnership('all');}}><X size={13}/> Clear filters</button>}</div>
    <div className="exchange-auctions">{rows.map(a=><AuctionRow key={a.id} auction={a} open={opened===a.id} onOpen={()=>setOpened(opened===a.id?null:a.id)} busy={busy} available={available} onBid={onBid}/>)}</div>
    {!rows.length&&<div className="exchange-empty"><Search size={28}/><h3>{auctions.length?'No matching players':'The exchange is quiet'}</h3><p>{auctions.length?'Adjust or clear your filters to see more listings.':'Eligible reserve listings appear here when managers publish them.'}</p></div>}
  </section>;
}
