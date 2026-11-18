import {workspacePath} from '../frontendRoutes';
import {matchDay, matchTime} from './matches/time';
import {FixtureBoard} from './matches/FixtureBoard';
import {onWorldUpdate,visibleInterval} from '../worldLive';
import {SquadRoster} from './SquadRoster';
import {FpsTacticalSystemEditor} from './FpsTacticalSystemEditor';
import type {PlayerFormData} from '../playerForm';
import {WorldPlayerPortrait} from './WorldPlayerPortrait';
import {FixtureReport} from './FixtureReport';
import {FixturePlanEditor} from './matches/FixturePlanEditor';
import type {FixturePlan} from './matches/FixtureBoard';
import { useEffect, useState } from 'react';
import { isCloudPersistenceConfigured, request } from '../cloudPersistence';
import { FpsOfficialBroadcast } from './FpsOfficialBroadcast';
import { useAccount } from '../AccountContext';
import { openAuthentication } from '../authNavigation';
import { FpsMatchView } from './FpsMatchView';
import type { FpsMatchReport } from '../fps/fpsTypes';
import { ClubCrest, ClubIdentityEditor, type ClubIdentity } from './ClubIdentityEditor';
import { Activity, ArrowRight, ClipboardList, Clock3, Swords, Users } from 'lucide-react';
import './club-management.css';

type MatchClub = { logo?:string; id?:number;identity?:ClubIdentity; name: string; tag?: string; crest?: ClubIdentity['crest']; colors?: ClubIdentity['colors'] };
interface FriendlyInvite { id: number; kickoff_at: string; home: MatchClub }

interface Match { id: string; status: string; sequence: number; error?: string;
  plan: { clubs: { blue: string; red: string }; game_mode?: string; fps?: { format: string; rules_version: number; map_id: string; simulation_version?: number }; bot_sides?: ('blue'|'red')[]; fixture?: { id:number; clubs: { blue: MatchClub; red: MatchClub } }; versions: Record<string, string>;
    intelligence?:{controller:string;release?:{id:string;qualification?:string;generation?:number}|null} }; result?: { winner: string; report?: FpsMatchReport; execution?:{mode:string;notice?:string} } }
interface Dashboard {
  club: { id: number; name: string; tag?: string | null; revision: number; lineup: { instance_id: string }[] };
  cards: { id: string; training_xp: number; form?:PlayerFormData; recent_rating?: number | null; recent_form_rating?: number; recent_form?: ('W'|'L')[]; definition: { id: string; name: string; ovr: number; wage?:number; nationality?:{code:string;name:string}; stats?:Record<string,number> } }[];
  ticket?: { status: string; match_id?: string }; matches: Match[];
  scrimmage_ticket?: { status: string; rating: number; tier: number; fixture_id?: number | null };
}
interface Fixture {
  id: number;
  competition: string;
  tournament_id?:number|null;
  kickoff_at: string;
  orders_close_at: string;
  started_at: string | null;
  clubs: { blue: MatchClub; red: MatchClub };
  status: string;
  can_submit: boolean;
  can_watch?:boolean;
  match_id: string | null;
  orders: Dashboard['club']['lineup'] | null;
  side?: 'blue' | 'red'; outcome?: 'win' | 'loss' | null; score?: {blue: number; red: number} | null;
  map?: {id: string; name: string} | null; opponent_id?: number | null; plan?: FixturePlan | null;
}
const button = 'cm-btn';
const manilaTime = new Intl.DateTimeFormat('en-PH', {
  timeZone: 'Asia/Manila', dateStyle: 'medium', timeStyle: 'short',
});

export function OnlineNormalView({ scheduled = false, initialMatchId, initialTool, broadcastOnly=false, matchCentre=false }: { scheduled?: boolean; initialMatchId?: string; initialTool?:'lineup';broadcastOnly?:boolean;matchCentre?:boolean }) {
  const { session } = useAccount();
  const [error, setError] = useState(''), [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');
  const [data, setData] = useState<Dashboard | null>(null), [selected, setSelected] = useState<Match | null>(null);
  const [refresh, setRefresh] = useState(0), [clubName, setClubName] = useState(''), [lineup, setLineup] = useState<Dashboard['club']['lineup']>([]);
  const [fixtures, setFixtures] = useState<Fixture[]>([]);
  useEffect(()=>onWorldUpdate(['fixtures','clubs','players'],()=>setRefresh(v=>v+1)),[]);
  const [invites, setInvites] = useState<FriendlyInvite[]>([]);
  const [editingFixture, setEditingFixture] = useState<Fixture | null>(null);
  const [fixturePlan, setFixturePlan] = useState<FixturePlan | null>(null);
  const [clubTab, setClubTab] = useState<'calendar' | 'lineup' | 'identity' | 'friendly'>(()=>{
    if(initialTool)return initialTool;
    const tab=new URLSearchParams(workspacePath(window.location.hash).split('?')[1]??'').get('club');
    return tab==='lineup'||tab==='identity'||tab==='friendly'?tab:'calendar';
  });
  useEffect(()=>{if(!matchCentre)return;const sync=()=>{const tab=new URLSearchParams(workspacePath(window.location.hash).split('?')[1]??'').get('club');setEditingFixture(null);setClubTab(tab==='friendly'?'friendly':tab==='lineup'?'lineup':tab==='identity'?'identity':'calendar');};window.addEventListener('hashchange',sync);return()=>window.removeEventListener('hashchange',sync);},[matchCentre]);

  useEffect(() => {
    if (!session || broadcastOnly || !isCloudPersistenceConfigured()) return;
    const controller = new AbortController(); let closed = false;
    const load = async () => {
      try {
        const [response, schedule] = await Promise.all([
          request<{ data: Dashboard }>('/online', session, { signal: controller.signal }),
          scheduled&&!initialTool ? request<{ data: Fixture[]; invites: FriendlyInvite[] }>('/online/fixtures', session, { signal: controller.signal }) : null,
        ]);
        if (!closed) { setData(response.data); setFixtures(schedule?.data ?? []); setInvites(schedule?.invites ?? []); }
      } catch (problem) { if (!closed) setError((problem as Error).message); }
    };
    void load(); const stopTimer=visibleInterval(() => void load(), initialTool?30000:15000);
    return () => { closed = true; controller.abort(); stopTimer(); };
  }, [session, refresh, scheduled,broadcastOnly]);
  useEffect(() => { if (data && !editingFixture) { setClubName(data.club.name); setLineup(data.club.lineup); } }, [data?.club.revision, editingFixture]);
  useEffect(() => {
    if (!data) return;
    if (!scheduled && !selected && data.ticket?.match_id) setSelected(data.matches.find(match => match.id === data.ticket?.match_id) ?? null);
    else if (selected) {
      const current = data.matches.find(match => match.id === selected.id);
      if (current && (current.status !== selected.status || current.sequence !== selected.sequence)) setSelected(current);
    }
  }, [data, selected, scheduled]);

  useEffect(() => {
    if (!session || selected?.plan.game_mode !== 'fps_mr15_v1' || ['completed', 'failed', 'interrupted'].includes(selected.status)) return;
    const controller = new AbortController();
    const refreshMatch = () => void request<{ data: Match }>(`/online/matches/${selected.id}`, session, { signal: controller.signal })
      .then(result => { if (!controller.signal.aborted) setSelected(current => current?.id === selected.id ? result.data : current); })
      .catch(problem => { if (!controller.signal.aborted) setError((problem as Error).message); });
    refreshMatch();
    const stopTimer=visibleInterval(refreshMatch, 2000);
    return () => { controller.abort(); stopTimer(); };
  }, [session, selected?.id, selected?.status, selected?.plan.game_mode]);

  const act = async (path: string, body?: unknown, method = 'POST', success = 'Changes saved.') => {
    setBusy(true); setError(''); setNotice('');
    try { await request(path, session, { method, ...(body === undefined ? {} : { body: JSON.stringify(body) }) }); setNotice(success); setRefresh(value => value + 1); return true; }
    catch (problem) { setError((problem as Error).message); }
    finally { setBusy(false); }
    return false;
  };

  async function openMatch(id: string) {
    try {
      const { data: match } = await request<{ data: Match }>(`/online/matches/${id}`, session);
      setSelected(match);
    } catch (problem) { setError((problem as Error).message); }
  }

  useEffect(() => {
    if (session && initialMatchId) void openMatch(initialMatchId);
  }, [initialMatchId, session]);

  if (!isCloudPersistenceConfigured()) return <p className="cm-panel cm-panel-body text-sm cm-muted">Open the local Docker app at localhost:8088 for server-owned Normal matches.</p>;
  if (!session) return <section className="club-panel"><h2>Open your club</h2><p className="club-help mb-3">Sign in to manage your fixtures and match orders.</p><button className={button} onClick={() => openAuthentication('sign-in', 'play')}>Go to sign-in</button></section>;
  return <div className="club-workspace space-y-5 pb-10">
    {error && <p role="alert" className="club-notice">{error}</p>}
    {notice && <p role="status" className="club-notice">{notice}</p>}
    {selected && <section className="club-panel space-y-3">
      <div className="club-section-heading"><p className="cm-eyebrow">Match coverage</p>{!broadcastOnly&&<button className={button} onClick={() => setSelected(null)}>Back to fixtures</button>}</div>
      <h3 className="flex flex-wrap items-center gap-2 font-black">
        {(['blue', 'red'] as const).map(side => {
          const club = selected.plan.fixture?.clubs[side];
          return <span key={side} className="inline-flex items-center gap-2">
            {side === 'red' && <span className="cm-muted">vs</span>}
            {club?.crest && club.colors && <ClubCrest crest={club.crest} colors={club.colors} logo={club.logo} />}
            {selected.plan.clubs[side]}
            {selected.plan.bot_sides?.includes(side) && <span className="cm-badge cm-badge-blue text-[9px]">BOT</span>}
          </span>;
        })}
      </h3>
      <p className="club-status">{`${selected.status === 'completed' ? 'Final' : selected.status === 'failed' ? 'Failed' : selected.status === 'interrupted' ? 'Interrupted recording' : 'FPS match'}${selected.result ? ` · ${selected.plan.clubs[selected.result.winner as 'blue' | 'red']} wins` : ''}`}</p>
      {selected.plan.game_mode === 'fps_mr15_v1' && selected.plan.fps?.simulation_version === 5
        ? (selected.status === 'running' || selected.status === 'completed') && session
          ? <FpsOfficialBroadcast matchId={selected.id} session={session} onExit={() => setSelected(null)} />
          : <p className="club-help">{selected.status === 'failed' ? 'The match could not be simulated.' : 'The broadcast starts at kickoff.'}</p>
        : selected.plan.game_mode === 'fps_mr15_v1' ? selected.result?.report
        ? <FpsMatchView
          report={selected.result.report}
          blueTeamName={selected.plan.clubs.blue}
          redTeamName={selected.plan.clubs.red}
          onExit={() => setSelected(null)}
        />
        : <p className="club-help">{selected.status === 'completed' ? 'The completed FPS match has no verified replay report.' : 'The FPS match report will appear when server simulation finishes.'}</p>
        : <>
      {selected.error && <p className="text-sm cm-error-text">{selected.error}</p>}
      <p className="club-notice">This archived match uses a legacy ruleset. Historical results and fixture reports remain recorded below.</p>
      </>}
      {selected.status==='completed'&&selected.plan.fixture?.id&&<FixtureReport id={selected.plan.fixture.id}/>}
      <details className="club-technical"><summary>Recording details</summary>
        <p>Match {selected.id}</p>
      </details>
    </section>}
    {!broadcastOnly && !initialTool && !matchCentre && scheduled && data && <nav className="cm-tabs" aria-label="Club tools">
      {(['calendar', 'lineup', 'identity', 'friendly'] as const).map(tab => <button type="button" key={tab} className={`cm-tab ${clubTab === tab ? 'active' : ''}`} aria-pressed={clubTab === tab} onClick={() => setClubTab(tab)}>
        {{ calendar: 'Fixtures', lineup: 'Lineup & orders', identity: 'Club identity', friendly: 'Scrimmages' }[tab]}
      </button>)}
    </nav>}
    {!broadcastOnly && scheduled && data && clubTab === 'calendar' && !selected && <FixtureBoard fixtures={fixtures} clubId={data.club.id}
      onOrders={f => { const fixture = fixtures.find(x => x.id === f.id)!; setLineup(fixture.orders ?? data.club.lineup); setFixturePlan(fixture.plan ?? null); setEditingFixture(fixture); setClubTab('lineup'); }}
      onWatch={f => { if (f.match_id) void openMatch(f.match_id); }} />}
    {!broadcastOnly && scheduled && data && clubTab === 'friendly' && <div className="scrim-layout">
      {invites.length > 0 && <section className="fx-group fx-group--orders" aria-labelledby="scrim-invites">
        <header className="fx-group__head"><h3 id="scrim-invites">Invitations for you<span className="fx-count">{invites.length}</span></h3><p>Clubs that asked you for a scrimmage. Accepting puts the game on your calendar.</p></header>
        <ol className="fx-list">{invites.map(invite => <li key={invite.id} className="fx-row scrim-invite-row">
          <time className="fx-when" dateTime={invite.kickoff_at}><strong>{matchDay(invite.kickoff_at)}</strong><span>{matchTime(invite.kickoff_at)}</span></time>
          <div className="fx-main"><span className="fx-competition">Scrimmage invitation</span><strong>{invite.home.name}</strong></div>
          <div className="fx-action"><button className={`${button} cm-btn-primary`} disabled={busy} onClick={() => void act(`/online/fixtures/invites/${invite.id}/accept`, undefined, 'POST', 'Scrimmage accepted. The fixture is on your calendar.')}>Accept</button></div>
        </li>)}</ol>
      </section>}
      <div className="scrim-options">
        <section className="cm-panel scrim-card" aria-labelledby="scrim-quick">
          <header><p className="ui-eyebrow">Fastest</p><h3 id="scrim-quick"><Swords size={16} aria-hidden="true"/> Quick match</h3>
            <p className="club-help">We pair you with a human-managed club in your tier with a similar lineup rating. The game kicks off 30 minutes after pairing.</p></header>
      {data.scrimmage_ticket?.status === 'queued' && <div className="scrimmage-state" role="status" aria-live="polite">
        <div className="scrimmage-state__top">
          <span className="scrimmage-searching"><span className="scrimmage-pulse"/><Activity size={15}/> Searching for a club</span>
          <span className="scrimmage-state__note">This queue matches human clubs only.</span>
        </div>
        <dl className="scrimmage-metrics">
          <div><dt>Your tier</dt><dd>{data.scrimmage_ticket.tier + 1}</dd></div>
          <div><dt>Squad rating</dt><dd>{data.scrimmage_ticket.rating.toFixed(1)} <span>/ 99</span></dd></div>
          <div><dt>Search rule</dt><dd>Same tier only</dd></div>
        </dl>
        <div className="scrimmage-actions">
          <button className={button} disabled={busy} onClick={() => void act('/online/scrimmage-queue', undefined, 'DELETE', 'You left the scrimmage queue.')}>Leave queue</button>
          <button className="cm-btn scrimmage-switch" disabled={busy} onClick={async () => {
            if (await act('/online/scrimmage-queue', undefined, 'DELETE', 'You left the scrimmage queue.')) window.location.hash = 'match-centre?club=queue';
          }}>Leave &amp; find a normal opponent <ArrowRight size={14}/></button>
        </div>
      </div>}
      {data.scrimmage_ticket?.status === 'matched' && <div className="scrimmage-state scrimmage-state--matched" role="status">
        <div className="scrimmage-state__top">
          <span className="scrimmage-searching"><Swords size={15}/> Scrimmage matched</span>
          <span className="scrimmage-state__note">Your fixture is ready for order review.</span>
        </div>
        <div className="scrimmage-actions">
          <span className="club-status">Fixture #{data.scrimmage_ticket.fixture_id}</span>
          <button className={`${button} cm-btn-primary`} onClick={() => setClubTab('calendar')}>Review in Fixtures <ArrowRight size={14}/></button>
        </div>
      </div>}
      {(!data.scrimmage_ticket || !['queued', 'matched'].includes(data.scrimmage_ticket.status)) && <div className="scrimmage-state">
        <div className="scrimmage-state__top">
          <span className="scrimmage-searching"><Clock3 size={15}/> Queue when you’re ready</span>
          <span className="scrimmage-state__note">Leave any time. Pairing schedules the match 30 minutes later.</span>
        </div>
        <div className="scrimmage-actions">
          <button className={`${button} cm-btn-primary`} disabled={busy || data.ticket?.status === 'queued' || data.matches.some(match => ['allocated', 'running'].includes(match.status))}
            onClick={() => void act('/online/scrimmage-queue', undefined, 'POST', 'Joined the same-tier scrimmage queue.')}>Find a same-tier club <ArrowRight size={14}/></button>
          <a className="cm-btn scrimmage-switch" href="#match-centre?club=queue">Go to normal matchmaking <ArrowRight size={14}/></a>
        </div>
      </div>}
        </section>
        <section className="cm-panel scrim-card" aria-labelledby="scrim-invite">
          <header><p className="ui-eyebrow">Pick your opponent</p><h3 id="scrim-invite"><Users size={16} aria-hidden="true"/> Invite a club</h3>
            <p className="club-help">Send an invitation to a club by its tag. The game is scheduled when they accept.</p></header>
      <form className="scrim-invite-form" onSubmit={async event => {
        event.preventDefault();
        const form = event.currentTarget;
        const fields = new FormData(form);
        const kickoff = String(fields.get('kickoff'));
        if (await act('/online/fixtures/invites', { tag: String(fields.get('tag')).toUpperCase(), kickoff_at: `${kickoff}:00+08:00` }, 'POST', 'Scrimmage invitation sent. Clubs respond when a suitable slot is available.')) form.reset();
      }}>
        <label><span className="ui-field-label">Opponent club tag</span><input className="cm-input" name="tag" required pattern="[A-Za-z0-9]{2,12}" placeholder="e.g. RATC" autoComplete="off" /></label>
        <label><span className="ui-field-label">Kickoff · Manila time</span><input className="cm-input" name="kickoff" type="datetime-local" required /></label>
        <button className={`${button} cm-btn-primary`} disabled={busy}>Send invitation</button>
      </form>
        </section>
      </div>
    </div>}
    {!broadcastOnly && data && session && (!scheduled || clubTab === 'identity') && <ClubIdentityEditor session={session} club={data.club} onSaved={() => setRefresh(value => value + 1)} />}
    {!broadcastOnly && data && (!scheduled || clubTab === 'lineup') && <section className="club-panel lineup-workbench">
      {editingFixture && <div className="orders-context" role="region" aria-label="Fixture orders">
        <div>
          <p className="ui-eyebrow">Match orders · {editingFixture.competition}</p>
          <h3>{editingFixture.clubs.blue.name} vs {editingFixture.clubs.red.name}</h3>
          <p className="club-help">Kickoff {matchDay(editingFixture.kickoff_at)}, {matchTime(editingFixture.kickoff_at)} · orders close {matchDay(editingFixture.orders_close_at)}, {matchTime(editingFixture.orders_close_at)} Manila. {editingFixture.orders ? 'This game uses custom orders.' : 'This game uses your default lineup until you save different orders.'}</p>
        </div>
        <div className="orders-context__actions">
          {editingFixture.orders && <button type="button" className="cm-btn" disabled={busy} onClick={async()=>{if(await act(`/online/fixtures/${editingFixture.id}/orders`,undefined,'DELETE','This fixture now uses your default lineup.')){setEditingFixture(null);if(matchCentre)setClubTab('calendar');}}}>Use default lineup</button>}
          <button type="button" className="cm-btn cm-btn-ghost" onClick={()=>{setEditingFixture(null);setClubTab('calendar');}}>Back to fixtures</button>
        </div>
      </div>}
      <form onSubmit={async event => {
        event.preventDefault();
        if (editingFixture) {
          if (await act(`/online/fixtures/${editingFixture.id}/orders`, { lineup, plan: fixturePlan }, 'PUT', 'Match orders saved.')) {setEditingFixture(null);if(matchCentre)setClubTab('calendar');}
        } else {
          await act('/online/club', { lineup, revision: data.club.revision, ...(scheduled ? {} : { name: clubName }) }, 'PUT', 'Default lineup saved.');
        }
      }}>
        {!scheduled && <label className="mt-3 block text-xs">Club name<input required minLength={2} maxLength={80} value={clubName} onChange={event => setClubName(event.target.value)} className="cm-input ml-3 max-w-full" /></label>}
        {editingFixture && <FixturePlanEditor plan={fixturePlan} onChange={setFixturePlan} map={editingFixture.map} starters={lineup.map(s=>({id:s.instance_id,name:data.cards.find(c=>c.id===s.instance_id)?.definition.name??'Player'}))}/>}
        <SquadRoster cards={data.cards} lineup={lineup} saved={editingFixture?.orders??data.club.lineup} onChange={setLineup} busy={busy||(!editingFixture&&(data.ticket?.status==='queued'||data.scrimmage_ticket?.status==='queued'))} fixture={!!editingFixture} onReset={()=>setLineup(editingFixture?.orders??data.club.lineup)}/>
      </form>
      {!scheduled && <div className="mt-4 flex flex-wrap items-center gap-3">
        <button className={button} disabled={busy || data.ticket?.status === 'queued' || data.matches.some(match => ['allocated', 'running'].includes(match.status))} onClick={() => void act('/online/queue')}>Find opponent</button>
        {data.ticket?.status === 'queued' && <><p className="text-sm text-[var(--hx-copper)]">Searching for another manager. If no one joins in 15 seconds, we’ll match you with an available bot.</p><button className={button} onClick={() => void act('/online/queue', undefined, 'DELETE')}>Leave queue</button></>}
      </div>}
    </section>}
    {!broadcastOnly && data && session && (!scheduled || clubTab === 'lineup') && !editingFixture && <div id="tactical-system" className="scroll-mt-4"><FpsTacticalSystemEditor session={session} players={data.cards} onSaved={()=>setRefresh(v=>v+1)}/></div>}
    {!scheduled && !!data?.matches.length && <section className="cm-panel cm-panel-body"><h3 className="font-black">Match history</h3><div className="mt-3 flex flex-wrap gap-2">{data.matches.map(match => <button key={match.id} className={button} onClick={() => void openMatch(match.id)}>{match.status} · {match.id.slice(0, 8)}</button>)}</div></section>}
  </div>;
}
