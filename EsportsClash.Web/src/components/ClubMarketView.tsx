import {onWorldUpdate} from '../worldLive';
import { useEffect, useState } from 'react';
import { isCloudPersistenceConfigured, request } from '../cloudPersistence';
import { useAccount } from '../AccountContext';
import { openAuthentication } from '../authNavigation';
import { toScale10 } from '../marketBatchEngine';
import {TransferAuctionBoard} from './TransferAuctionBoard';
import {ReserveTransferListing} from './ReserveTransferListing';
import './transfer-exchange.css';
import { ArrowLeftRight, Coins, Gavel, GraduationCap, Handshake, Users } from 'lucide-react';

export interface PlayerCard {primaryPersonality?:string|null;secondaryPersonality?:string|null;
  presentation?:import('../supporter').PlayerPresentation|null;
  id: string; name: string; role?: string | null; overall: number; age?: number | null; wage?: number | null;
  nationality?: { code: string; name: string } | null; stats?: Record<string, number>;
}
export interface Auction extends Omit<PlayerCard, 'id' | 'name'> {
  id: number; player: string; player_id: string;
  seller: string; your_listing: boolean; leading: boolean; bid: number | null; minimum: number; closes_at: string;
  seller_id: number; seller_tag: string | null; seller_is_bot: boolean;
  bidder: { id: number; name: string; tag: string | null; is_bot: boolean } | null;
}
interface TradeProposal {
  id: number; status: string; incoming: boolean; other_club: { id: number; name: string; tag: string | null } | null;
  offered_players: { id: string; name: string }[]; requested_players: { id: string; name: string }[];
  offered_cash: number; requested_cash: number; expires_at: string;
  comparison: { offered_value: number; requested_value: number; difference: number; assessment: string; binding: false };
}
interface Market {
  available: number; scout_cost: number; academy_opened_at: string | null; academy_opening_fee: number; youth_coach_wage: number;
  reserves: PlayerCard[]; auctions: Auction[]; trades: TradeProposal[];
}
interface TradeTarget { club: { id: number; name: string; tag: string | null }; players: PlayerCard[] }

const pesos = new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' });
const money = (minor: number) => pesos.format(minor / 100);
const deadline = new Intl.DateTimeFormat('en-PH', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Manila' });
const valueOf = (form: HTMLFormElement, field: string) => Math.round(Number(new FormData(form).get(field) ?? 0) * 100);

export function ClubMarketView() {
  const { session } = useAccount();
  const [market, setMarket] = useState<Market | null>(null);
  const [notice, setNotice] = useState('');
  const [noticeIsError, setNoticeIsError] = useState(false);
  const [busy, setBusy] = useState(false);
  const [marketTab,setMarketTab]=useState(()=>{const tab=new URLSearchParams(location.hash.split('?')[1]??'').get('tab');return tab&&['auctions','sell','trades','academy'].includes(tab)?tab:'auctions';});
  const [ownAuctions,setOwnAuctions]=useState(false);
  useEffect(()=>{const change=()=>{const tab=new URLSearchParams(location.hash.split('?')[1]??'').get('tab');if(tab&&['auctions','sell','trades','academy'].includes(tab))setMarketTab(tab);};window.addEventListener('hashchange',change);return()=>window.removeEventListener('hashchange',change);},[]);
  const [tradeTag, setTradeTag] = useState('');
  const [target, setTarget] = useState<TradeTarget | null>(null);
  const [offeredIds, setOfferedIds] = useState<string[]>([]);
  const [requestedIds, setRequestedIds] = useState<string[]>([]);
  const configured = isCloudPersistenceConfigured();

  const loadMarket = async (signal?: AbortSignal) => {
    const result = await request<{ data: Market }>('/online/market?include_auctions=0', session, { signal });
    setMarket(result.data);
  };

  useEffect(() => {
    if (!session || !configured) return;
    const controller = new AbortController();
    const load = () => loadMarket(controller.signal).catch(problem => {
      if (!controller.signal.aborted) { setNotice((problem as Error).message); setNoticeIsError(true); }
    });
    void load();
    const stopLive=onWorldUpdate(['market'],()=>void load());
    const timer = window.setInterval(() => void load(), 60000);
    return () => { controller.abort(); window.clearInterval(timer);stopLive(); };
  }, [session, configured]);

  async function submit(path: string, success: string, body?: object, method = 'POST') {
    setBusy(true); setNotice(''); setNoticeIsError(false);
    try {
      await request(path, session, { method, ...(body ? { body: JSON.stringify(body) } : {}) });
      await loadMarket();
      setNotice(success);return {ok:true};
    } catch (problem) { const error=(problem as Error).message;setNotice(error);setNoticeIsError(true);return {ok:false,error}; }
    finally { setBusy(false); }
  }

  async function loadTradeTarget() {
    setBusy(true); setNotice(''); setNoticeIsError(false);
    try {
      const result = await request<{ data: TradeTarget }>(`/online/market/trade-target?tag=${encodeURIComponent(tradeTag.trim().toUpperCase())}`, session);
      setTarget(result.data); setRequestedIds([]);
    } catch (problem) { setTarget(null); setNotice((problem as Error).message); setNoticeIsError(true); }
    finally { setBusy(false); }
  }

  if (!configured || !session) return <section className="club-workspace club-panel">
    <div className="club-empty">
      <p className="cm-eyebrow">HEXATRICK · PLAYER EXCHANGE</p>
      <h2>Transfer Exchange</h2>
      <p>Bid for players, negotiate trades, and build a roster that fits your club.</p>
      {configured && <button className="cm-btn cm-btn-primary" onClick={() => openAuthentication('sign-in', 'market')}>Sign in to your club</button>}
    </div>
  </section>;

  return <div className="club-workspace transfer-exchange">
    {notice && <p role={noticeIsError ? 'alert' : 'status'} className="club-notice exchange-notice">{notice}</p>}
    {!market && !notice && <p role="status">Loading Transfer Exchange…</p>}
    {market && <>
      <section className="club-panel transfer-balance">
        <div><p className="cm-eyebrow flex items-center gap-2"><Coins size={14}/> CLUB FINANCE · PHP</p>
          <h2>Available balance</h2><strong className="club-balance">{money(market.available)}</strong>
          <p className="club-help">Open auction bids and pending trade cash offers are already reserved.</p></div>
        <div className="exchange-account-facts"><span><Gavel size={15}/><strong>{market.auctions.length}</strong> open auctions</span><span><Users size={15}/><strong>{market.reserves.length}</strong> eligible reserves</span><a href="#hexapedia/guide"><ArrowLeftRight size={15}/> Transfer guide</a></div>
      </section>

      <nav className="exchange-tabs" aria-label="Transfer Exchange sections">{([['auctions','Auctions',Gavel],['sell','Sell a player',Users],['trades','Direct trades',Handshake],['academy','Youth academy',GraduationCap]] as const).map(([key,label,Icon])=><button key={String(key)} className={marketTab===key?'active':''} aria-pressed={marketTab===key} onClick={()=>{setMarketTab(String(key));location.hash='transfer-exchange?tab='+key;}}><Icon size={16}/>{String(label)}</button>)}</nav>
      {marketTab==='academy'&&<section className="club-panel exchange-academy">

        <div className="club-section-heading"><h3 className="flex items-center gap-2"><GraduationCap size={16}/> Youth academy</h3><span className="club-status">{market.academy_opened_at ? 'Open' : 'Optional'}</span></div>
        <p className="club-help">Develop your own prospects. Promotion becomes available after the academy has operated for a week.</p>
        <dl className="club-facts"><div><dt>Opening fee</dt><dd>{money(market.academy_opening_fee)}</dd></div><div><dt>Youth coach salary</dt><dd>{money(market.youth_coach_wage)} / week</dd></div></dl>

        {market.academy_opened_at ? <div className="flex flex-wrap gap-2">
          <button className="cm-btn" disabled={busy} onClick={() => void submit('/online/market/scout', 'Academy prospect promoted to your reserves.', { academy: true })}>Promote a prospect</button>
          <button className="cm-btn" disabled={busy} onClick={() => void submit('/online/market/academy', 'Youth academy closed.', { open: false }, 'PUT')}>Close academy</button>
        </div> : <button className="cm-btn" disabled={busy} onClick={() => void submit('/online/market/academy', 'Youth academy opened.', { open: true }, 'PUT')}>Open academy for {money(market.academy_opening_fee)}</button>}
      </section>}
      {marketTab==='sell'&&<ReserveTransferListing players={market.reserves} busy={busy} onList={async(id,opening)=>{const result=await submit('/online/market/auctions','Player listing published.',{card_id:id,opening_bid:opening});if(result.ok){setOwnAuctions(true);setMarketTab('auctions');location.hash='transfer-exchange?tab=auctions';}return result;}}/>}
      {marketTab==='auctions'&&<TransferAuctionBoard initialOwnership={ownAuctions?'mine':'all'} auctions={market.auctions} available={market.available} busy={busy} onBid={(id,amount)=>submit('/online/market/auctions/'+id+'/bid','Bid placed.',{amount})}/>}

      {marketTab==='trades'&&<section className="club-panel exchange-trades">
        <h3 className="flex items-center gap-2"><Handshake size={16}/> Direct player trades</h3>
        <p className="club-help">Offer one or more reserve players plus cash for another manager’s reserve players. The estimate values each overall point at ₱1,000 plus cash at face value. The other manager decides; this comparison is advisory and never blocks a trade.</p>
        <form className="trade-proposal-form" onSubmit={event => {
          event.preventDefault(); const form = event.currentTarget;
          void submit('/online/market/trades', 'Trade proposal sent. Offered cash is reserved until the proposal is resolved.', {
            tag: tradeTag.trim().toUpperCase(), offered_player_ids: offeredIds, requested_player_ids: requestedIds,
            offered_cash: valueOf(form, 'offeredCash'), requested_cash: valueOf(form, 'requestedCash'),
          });
        }}>
          <label>Other club tag<div className="trade-target-search"><input value={tradeTag} onChange={event => { setTradeTag(event.target.value); setTarget(null); }} maxLength={12} required placeholder="e.g. HXA7"/><button className="cm-btn" type="button" disabled={busy || !tradeTag.trim()} onClick={() => void loadTradeTarget()}><Users size={14}/> Find club</button></div></label>
          {target && <div className="club-fixture">
            <strong>{target.club.name}{target.club.tag ? ` · ${target.club.tag}` : ''}</strong>
            <div className="trade-player-columns">
              <fieldset><legend>Your reserve players</legend>{market.reserves.map(player => <label key={player.id} className="trade-player-option">
                <input type="checkbox" checked={offeredIds.includes(player.id)} onChange={event => setOfferedIds(current => event.target.checked ? [...current, player.id] : current.filter(id => id !== player.id))}/>
                <span>{player.name}<small>{player.role} · {toScale10(player.overall)}/10</small></span></label>)}</fieldset>
              <fieldset><legend>{target.club.name} · available reserves</legend>{target.players.map(player => <label key={player.id} className="trade-player-option">
                <input type="checkbox" checked={requestedIds.includes(player.id)} onChange={event => setRequestedIds(current => event.target.checked ? [...current, player.id] : current.filter(id => id !== player.id))}/>
                <span>{player.name}<small>{player.role} · {toScale10(player.overall)}/10</small></span></label>)}
                {!target.players.length && <p className="club-help">No eligible reserve players are currently available.</p>}</fieldset>
            </div>
            <div className="flex flex-wrap gap-3">
              <label>Cash you offer · PHP<input name="offeredCash" type="number" min="0" max={market.available / 100} step="0.01" defaultValue="0"/></label>
              <label>Cash requested · PHP<input name="requestedCash" type="number" min="0" step="0.01" defaultValue="0"/></label>
            </div>
            <button className="cm-btn cm-btn-primary" disabled={busy || !offeredIds.length || !requestedIds.length || !market.reserves.length || !target.players.length}>Send trade proposal</button>
          </div>}
        </form>
        <div className="trade-proposal-list">
          {market.trades.map(trade => <article className="club-fixture trade-proposal" key={trade.id}>
            <div className="club-section-heading"><h4>{trade.incoming ? 'Offer received' : 'Offer sent'} · {trade.other_club?.name ?? 'Former club'}</h4><span className="club-status">{trade.status}</span></div>
            <p><strong>{trade.incoming ? 'They offer' : 'You offer'}:</strong> {trade.offered_players.map(player => player.name).join(', ')}{trade.offered_cash ? ` + ${money(trade.offered_cash)}` : ''}</p>
            <p><strong>{trade.incoming ? 'They request' : 'You request'}:</strong> {trade.requested_players.map(player => player.name).join(', ')}{trade.requested_cash ? ` + ${money(trade.requested_cash)}` : ''}</p>
            <p className="trade-fairness">Estimate: {money(trade.comparison.offered_value)} vs {money(trade.comparison.requested_value)} · {trade.comparison.assessment.replaceAll('-', ' ')} · non-binding</p>
            {trade.status === 'pending' && <div className="flex flex-wrap gap-2">
              {trade.incoming ? <>
                <button className="cm-btn cm-btn-primary" disabled={busy} onClick={() => void submit(`/online/market/trades/${trade.id}/response`, 'Trade accepted and completed.', { action: 'accept' })}>Accept trade</button>
                <button className="cm-btn" disabled={busy} onClick={() => void submit(`/online/market/trades/${trade.id}/response`, 'Trade declined.', { action: 'decline' })}>Decline</button>
              </> : <button className="cm-btn" disabled={busy} onClick={() => void submit(`/online/market/trades/${trade.id}/response`, 'Trade proposal withdrawn.', { action: 'withdraw' })}>Withdraw offer</button>}
              <span className="club-help">Expires {deadline.format(new Date(trade.expires_at))}</span>
            </div>}
          </article>)}
          {!market.trades.length && <p className="club-help">No trade proposals yet.</p>}
        </div>
      </section>}
    </>}
  </div>;
}
