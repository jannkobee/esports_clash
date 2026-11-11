import {workspacePath} from '../frontendRoutes';
import {onWorldUpdate} from '../worldLive';
import {TournamentLogo} from './TournamentLogo';
import {SquadRoster} from './SquadRoster';
import {FpsTacticalSystemEditor} from './FpsTacticalSystemEditor';
import type {PlayerFormData} from '../playerForm';
import {WorldPlayerPortrait} from './WorldPlayerPortrait';
import {FixtureReport} from './FixtureReport';
import { useEffect, useRef, useState } from 'react';
import { isCloudPersistenceConfigured, request } from '../cloudPersistence';
import { useAccount } from '../AccountContext';
import { openAuthentication } from '../authNavigation';
import { pediaHref } from '../hexapedia';
import { acceptOnlineSnapshot, type OnlineSnapshot } from '../onlineSpectator';
import { OnlineMatchViewer } from './OnlineMatchViewer';
import { FpsMatchView } from './FpsMatchView';
import type { FpsMatchReport } from '../fps/types';
import type { VisualRelease } from '../avatarVisualRelease';
import { ClubCrest, ClubIdentityEditor, type ClubIdentity } from './ClubIdentityEditor';
import { Activity, ArrowRight, ClipboardList, Clock3, Swords, Users } from 'lucide-react';
import './club-management.css';

type MatchClub = { logo?:string; id?:number;identity?:ClubIdentity; name: string; tag?: string; crest?: ClubIdentity['crest']; colors?: ClubIdentity['colors'] };
interface FriendlyInvite { id: number; kickoff_at: string; home: MatchClub }

interface Match { id: string; status: string; sequence: number; error?: string;
  plan: { clubs: { blue: string; red: string }; game_mode?: string; fps?: { format: string; rules_version: number; map_id: string }; bot_sides?: ('blue'|'red')[]; fixture?: { id:number; clubs: { blue: MatchClub; red: MatchClub } }; versions: Record<string, string>;visual_releases?:VisualRelease[];
    intelligence?:{controller:string;release?:{id:string;qualification?:string;generation?:number}|null} }; result?: { winner: string; report?: FpsMatchReport; execution?:{mode:string;notice?:string} } }
interface Dashboard {
  club: { id: number; name: string; tag?: string | null; revision: number; lineup: { instance_id: string }[] };
  cards: { id: string; training_xp: number; form?:PlayerFormData; recent_rating?: number | null; recent_form_rating?: number; recent_form?: ('W'|'L')[]; definition: { id: string; name: string; preferredRole?: string; role?: string; playableRoles?: string[]; ovr: number; wage?:number; nationality?:{code:string;name:string}; stats?:Record<string,number> } }[];
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
  const [frame, setFrame] = useState<OnlineSnapshot | null>(null), [connection, setConnection] = useState('Disconnected');
  const [refresh, setRefresh] = useState(0), [clubName, setClubName] = useState(''), [lineup, setLineup] = useState<Dashboard['club']['lineup']>([]);
  const [live, setLive] = useState(true), [replaySequence, setReplaySequence] = useState(1);
  const [fixtures, setFixtures] = useState<Fixture[]>([]);
  useEffect(()=>onWorldUpdate(['fixtures','clubs','players'],()=>setRefresh(v=>v+1)),[]);
  const [fixtureFilter,setFixtureFilter]=useState<'upcoming'|'completed'|'all'>('upcoming');
  const [invites, setInvites] = useState<FriendlyInvite[]>([]);
  const [editingFixture, setEditingFixture] = useState<Fixture | null>(null);
  const [matchTab, setMatchTab] = useState<'arena' | 'text'>('arena');
  const [clubTab, setClubTab] = useState<'calendar' | 'lineup' | 'identity' | 'friendly'>(()=>{
    if(initialTool)return initialTool;
    const tab=new URLSearchParams(workspacePath(window.location.hash).split('?')[1]??'').get('club');
    return tab==='lineup'||tab==='identity'||tab==='friendly'?tab:'calendar';
  });
  useEffect(()=>{if(!matchCentre)return;const sync=()=>{const tab=new URLSearchParams(workspacePath(window.location.hash).split('?')[1]??'').get('club');setEditingFixture(null);setClubTab(tab==='friendly'?'friendly':tab==='lineup'?'lineup':tab==='identity'?'identity':'calendar');};window.addEventListener('hashchange',sync);return()=>window.removeEventListener('hashchange',sync);},[matchCentre]);
  const latestSequence = useRef(0);
  const [commentaryEnd,setCommentaryEnd]=useState<number|null>(null);
  const eventTotal=frame?.snapshot.events.length??0;
  const eventEnd=Math.min(commentaryEnd??eventTotal,eventTotal);
  const eventStart=Math.max(0,eventEnd-100);
  const commentary=frame?.snapshot.events.slice(eventStart,eventEnd)??[];
  useEffect(()=>setCommentaryEnd(null),[selected?.id]);

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
    void load(); const timer = window.setInterval(() => void load(), initialTool?30000:15000);
    return () => { closed = true; controller.abort(); clearInterval(timer); };
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
    if (!session || !selected || !live) return;
    const match = selected; let closed = false, terminal = false, socket: WebSocket | null = null, timer = 0;
    if (match.plan.game_mode === 'fps_mr15_v1') {
      setConnection('FPS report');
      return () => { closed = true; };
    }
    latestSequence.current = 0; setFrame(null);
    const connect = async () => {
      if (closed) return;
      setConnection('Connecting');
      try {
        const response = await request<{ data: { grant: string; path: string } }>(`/online/matches/${match.id}/stream`, session, { method: 'POST' });
        if (closed) return;
        const url = new URL(response.data.path, location.href); url.protocol = location.protocol === 'https:' ? 'wss:' : 'ws:';
        socket = new WebSocket(url);
        socket.onopen = () => { socket?.send(JSON.stringify({ grant: response.data.grant })); setConnection('Live'); };
        socket.onmessage = event => {
          try {
            const message = JSON.parse(event.data);
            if (acceptOnlineSnapshot(message, match.id, match.plan.versions, latestSequence.current)) {
              latestSequence.current = message.sequence; setFrame(message);
            } else if (message.type === 'match-ended') {
              terminal = true;
              setConnection(message.status);
              setRefresh(value => value + 1);
            }
          } catch { setError('The server sent an invalid match frame.'); }
        };
        socket.onclose = () => { if (!closed && !terminal) { setConnection('Reconnecting'); timer = window.setTimeout(() => void connect(), 2000); } };
      } catch (problem) { if (!closed) { setError((problem as Error).message); timer = window.setTimeout(() => void connect(), 5000); } }
    };
    void connect();
    return () => { closed = true; clearTimeout(timer); socket?.close(); };
  }, [session, selected?.id, live]);

  useEffect(() => {
    if (!session || !selected || !['completed', 'failed', 'interrupted'].includes(connection) || selected.status === connection) return;
    const matchId = selected.id;
    const controller = new AbortController();
    const refreshResult = () => void request<{ data: Match }>(`/online/matches/${matchId}`, session, { signal: controller.signal })
      .then(result => {
        if (!controller.signal.aborted) setSelected(current => current?.id === matchId ? result.data : current);
      }).catch(problem => { if (!controller.signal.aborted) setError((problem as Error).message); });
    refreshResult();
    const timer = window.setInterval(refreshResult, 2000);
    return () => { controller.abort(); window.clearInterval(timer); };
  }, [session, selected?.id, selected?.status, connection]);
  useEffect(() => {
    if (!session || selected?.plan.game_mode !== 'fps_mr15_v1' || ['completed', 'failed', 'interrupted'].includes(selected.status)) return;
    const controller = new AbortController();
    const refreshMatch = () => void request<{ data: Match }>(`/online/matches/${selected.id}`, session, { signal: controller.signal })
      .then(result => { if (!controller.signal.aborted) setSelected(current => current?.id === selected.id ? result.data : current); })
      .catch(problem => { if (!controller.signal.aborted) setError((problem as Error).message); });
    refreshMatch();
    const timer = window.setInterval(refreshMatch, 2000);
    return () => { controller.abort(); window.clearInterval(timer); };
  }, [session, selected?.id, selected?.status, selected?.plan.game_mode]);

  const act = async (path: string, body?: unknown, method = 'POST', success = 'Changes saved.') => {
    setBusy(true); setError(''); setNotice('');
    try { await request(path, session, { method, ...(body === undefined ? {} : { body: JSON.stringify(body) }) }); setNotice(success); setRefresh(value => value + 1); return true; }
    catch (problem) { setError((problem as Error).message); }
    finally { setBusy(false); }
    return false;
  };

  const replay = async (match = selected, sequence = replaySequence) => {
    if (!match || match.plan.game_mode === 'fps_mr15_v1') return;
    setLive(false);
    setReplaySequence(sequence);
    try {
      const response = await request<{ data: { frames: OnlineSnapshot[] } }>(`/online/matches/${match.id}/replay?after=${Math.max(0, sequence - 1)}&limit=1`, session);
      const message = response.data.frames[0];
      if (acceptOnlineSnapshot(message, match.id, match.plan.versions, 0)) setFrame(message);
    } catch (problem) { setError((problem as Error).message); }
  };

  async function openMatch(id: string) {
    try {
      const { data: match } = await request<{ data: Match }>(`/online/matches/${id}`, session);
      setFrame(null); setSelected(match);
      if (match.plan.game_mode === 'fps_mr15_v1') setLive(false);
      else if (['completed','interrupted'].includes(match.status)) await replay(match, match.sequence);
      else setLive(true);
    } catch (problem) { setError((problem as Error).message); }
  }

  useEffect(() => {
    if (session && initialMatchId) void openMatch(initialMatchId);
  }, [initialMatchId, session]);

  if (!isCloudPersistenceConfigured()) return <p className="rounded-xl bg-slate-900 p-5 text-sm text-slate-300">Open the local Docker app at localhost:8088 for server-owned Normal matches.</p>;
  if (!session) return <section className="club-panel"><h2>Open your club</h2><p className="club-help mb-3">Sign in to manage your fixtures and match orders.</p><button className={button} onClick={() => openAuthentication('sign-in', 'play')}>Go to sign-in</button></section>;
  return <div className="club-workspace space-y-5 pb-10">
    {!broadcastOnly&&<section className="club-panel club-account club-account--signed-in">
      <div><p className="cm-eyebrow">Matchday</p><h2>{data?.club.tag?<a href={pediaHref('teams',data.club.id)}>{data.club.name}</a>:data?.club.name??'Your club calendar'}</h2></div>
      <p className="club-help">Fixtures start automatically, even when you are offline.</p>
    </section>}
    {error && <p role="alert" className="club-notice">{error}</p>}
    {notice && <p role="status" className="club-notice">{notice}</p>}
    {selected && <section className="club-panel space-y-3">
      <div className="club-section-heading"><p className="cm-eyebrow">Match coverage</p>{!broadcastOnly&&<button className={button} onClick={() => { setSelected(null); setLive(false); }}>Back to fixtures</button>}</div>
      <h3 className="flex flex-wrap items-center gap-2 font-black">
        {(['blue', 'red'] as const).map(side => {
          const club = selected.plan.fixture?.clubs[side];
          return <span key={side} className="inline-flex items-center gap-2">
            {side === 'red' && <span className="text-slate-400">vs</span>}
            {club?.crest && club.colors && <ClubCrest crest={club.crest} colors={club.colors} logo={club.logo} />}
            {selected.plan.clubs[side]}
            {selected.plan.bot_sides?.includes(side) && <span className="cm-badge cm-badge-blue text-[9px]">BOT</span>}
          </span>;
        })}
      </h3>
      <p className="club-status">{selected.plan.game_mode === 'fps_mr15_v1'
        ? `${selected.status === 'completed' ? 'Final' : selected.status === 'failed' ? 'Failed' : 'FPS match'}${selected.result ? ` · ${selected.plan.clubs[selected.result.winner as 'blue' | 'red']} wins` : ''}`
        : <>{selected.status === 'interrupted' ? 'Interrupted recording' : selected.status === 'completed' ? 'Final' : live ? connection : 'Replay'} · {Math.floor((frame?.snapshot.second ?? 0) / 60)}:{String(Math.floor((frame?.snapshot.second ?? 0) % 60)).padStart(2, '0')}{selected.result && ` · ${selected.plan.clubs[selected.result.winner as 'blue' | 'red']} wins`}</>}</p>
      {selected.plan.game_mode === 'fps_mr15_v1' ? selected.result?.report
        ? <FpsMatchView
          report={selected.result.report}
          blueTeamName={selected.plan.clubs.blue}
          redTeamName={selected.plan.clubs.red}
          onExit={() => { setSelected(null); setLive(false); }}
        />
        : <p className="club-help">{selected.status === 'completed' ? 'The completed FPS match has no verified replay report.' : 'The FPS match report will appear when server simulation finishes.'}</p>
        : <>
      {frame && <dl className="club-score">
        {(['blue', 'red'] as const).map(side => {
          const kills = frame.snapshot.frame.champions.filter(unit => unit.team === side).reduce((total, unit) => total + unit.kills, 0);
          const towers = frame.snapshot.frame.structures.filter(structure => structure.team !== side && !structure.isAlive && structure.type.includes('tower')).length;
          return <div key={side}>
            <dt className="font-bold">{selected.plan.clubs[side]}</dt>
            <dd>{kills} kills · {towers} towers destroyed</dd>
          </div>;
        })}
      </dl>}
      {selected.error && <p className="text-sm text-red-300">{selected.error}</p>}
      <div className="cm-tabs" aria-label="Match coverage">
        <button className={`cm-tab ${matchTab === 'arena' ? 'active' : ''}`} aria-pressed={matchTab === 'arena'} onClick={() => setMatchTab('arena')}>Arena</button>
        <button className={`cm-tab ${matchTab === 'text' ? 'active' : ''}`} aria-pressed={matchTab === 'text'} onClick={() => setMatchTab('text')}>Text broadcast</button>
      </div>
      {selected.status==='interrupted'&&<p className="club-notice">This Arena was interrupted without a Nexus finish. A separately labeled statistical launch-exhibition result is available in the <a href="#launch-championship">launch archive</a>. This recording awards no player ratings or training.</p>}
      {(frame?.execution?.mode==='owner_requested_fast_forward'||selected.result?.execution?.mode==='owner_requested_fast_forward')&&<p className="club-notice"><Clock3 size={14}/> Owner-requested simulated completion. The original live recording is retained; later Arena coverage is sampled. Event timestamps and the Nexus outcome come from the same simulation.</p>}
      {matchTab === 'arena' && <OnlineMatchViewer message={frame} matchId={selected.id} visuals={selected.plan.visual_releases} live={live&&selected.status==='running'} />}
      <div className="flex flex-wrap items-center gap-2">
        <label className="text-xs">Replay snapshot<input type="number" min={1} max={Math.max(1, selected.sequence)} value={replaySequence} onChange={event => setReplaySequence(Number(event.target.value))} className="ml-2 w-24 rounded bg-slate-950 p-2" /></label>
        <button className={button} onClick={() => void replay()}>View saved snapshot</button>
        {!live && selected.status!=='interrupted' && <button className={button} onClick={() => selected.status === 'completed' ? void replay(selected, selected.sequence) : setLive(true)}>{selected.status === 'completed' ? 'Final frame' : 'Return to live'}</button>}
      </div>
      {matchTab === 'text' && <><p className="club-help">Select a report to view the Arena at that moment.</p>{!frame?.snapshot.events.length && <p className="club-help py-4">Commentary will appear as events unfold.</p>}<div className="club-commentary-pages"><button className={button} disabled={eventStart===0} onClick={()=>setCommentaryEnd(eventStart)}>Older events</button><span>Events {eventTotal?eventStart+1:0}-{eventEnd} of {eventTotal}</span><button className={button} disabled={eventEnd>=eventTotal} onClick={()=>setCommentaryEnd(eventEnd+100>=eventTotal?null:eventEnd+100)}>Newer events</button>{commentaryEnd!==null&&<button className={button} onClick={()=>setCommentaryEnd(null)}>Follow latest</button>}</div><ol className="club-commentary">{commentary.map((event, index) => <li key={event.sequence ?? eventStart+index}>
        <button onClick={() => {
          setMatchTab('arena');
          const sequence = Math.ceil(event.tick === undefined ? event.second * 2 : event.tick / 15) + 1;
          void replay(selected, Math.min(sequence, frame?.sequence??sequence));
        }}><time>{Math.floor(event.second / 60)}:{String(Math.floor(event.second % 60)).padStart(2, '0')}</time><span>{event.text.replace(/^[\p{Extended_Pictographic}\uFE0F ]+/u, '')}</span></button>
      </li>)}</ol></>}
      </>}
      {selected.status==='completed'&&selected.plan.fixture?.id&&<FixtureReport id={selected.plan.fixture.id}/>}
      <details className="club-technical"><summary>Recording details</summary>
        <p>Server sequence {frame?.sequence ?? 0} · Match {selected.id}</p>
        {selected.plan.intelligence?.controller === 'arena' && <p>Controller {selected.plan.intelligence.release?.qualification ?? 'instructional foundation'}. The server keeps this version fixed for the match. Competitive improvement is unproven.</p>}
        {selected.plan.intelligence?.controller === 'hybrid' && <p>Coordinated gameplay baseline with learning. The server freezes the controller for this match.</p>}
      </details>
    </section>}
    {!broadcastOnly && !initialTool && !matchCentre && scheduled && data && <nav className="cm-tabs" aria-label="Club tools">
      {(['calendar', 'lineup', 'identity', 'friendly'] as const).map(tab => <button type="button" key={tab} className={`cm-tab ${clubTab === tab ? 'active' : ''}`} aria-pressed={clubTab === tab} onClick={() => setClubTab(tab)}>
        {{ calendar: 'Fixtures', lineup: 'Lineup & orders', identity: 'Club identity', friendly: 'Scrimmages' }[tab]}
      </button>)}
    </nav>}
    {!broadcastOnly && scheduled && data && clubTab === 'calendar' && <section className="club-panel space-y-3">
      <div className="club-section-heading"><h3><Clock3 size={15}/> Your fixture calendar</h3><span className="club-help">Manila - UTC+8</span></div>
      <nav className="fixture-filters" aria-label="Fixture filter">{(['upcoming','completed','all'] as const).map(f=><button className={fixtureFilter===f?'active':''} onClick={()=>setFixtureFilter(f)} key={f}>{f==='upcoming'?'Upcoming & live':f==='completed'?'Past games':'All games'} <span>{fixtures.filter(g=>f==='all'||(f==='completed'?['Completed','Interrupted'].includes(g.status):!['Completed','Interrupted'].includes(g.status))).length}</span></button>)}</nav>
      {!fixtures.filter(f=>fixtureFilter==='all'||(fixtureFilter==='completed'?['Completed','Interrupted'].includes(f.status):!['Completed','Interrupted'].includes(f.status))).length&&<div className="club-empty"><h4>{fixtureFilter==='completed'?'No past games in this window':'Your calendar is clear'}</h4><p>Fixtures from the last 30 days and published upcoming games appear here.</p><div className="flex gap-2"><a className="cm-btn" href="#hexapedia/tournaments">Find a tournament</a><button className={button} onClick={()=>{setClubTab('friendly');if(matchCentre)window.location.hash='scrimmages';}}>Arrange a scrimmage</button></div></div>}
      <div className="fixture-desk-list">{fixtures.filter(f=>fixtureFilter==='all'||(fixtureFilter==='completed'?['Completed','Interrupted'].includes(f.status):!['Completed','Interrupted'].includes(f.status))).sort((a,b)=>fixtureFilter==='completed'?Date.parse(b.kickoff_at)-Date.parse(a.kickoff_at):Date.parse(a.kickoff_at)-Date.parse(b.kickoff_at)).map(fixture=><article key={fixture.id} className="fixture-desk-row">
        <header><TournamentLogo id={fixture.tournament_id??'scrimmage'} name={fixture.competition} size={23}/>{fixture.tournament_id?<a href={pediaHref('tournaments',fixture.tournament_id)}>{fixture.competition}</a>:<span>{fixture.competition}</span>}<span className={'fixture-status '+(fixture.status==='Live'?'is-live':'')}>{fixture.status}</span></header>
        <div className="fixture-desk-teams"><span>{(fixture.clubs.blue.identity||(fixture.clubs.blue.crest&&fixture.clubs.blue.colors))&&<ClubCrest crest={fixture.clubs.blue.identity?.crest??fixture.clubs.blue.crest!} colors={fixture.clubs.blue.identity?.colors??fixture.clubs.blue.colors!} logo={fixture.clubs.blue.identity?.assets?.logo??fixture.clubs.blue.logo}/>}<strong>{fixture.clubs.blue.name}</strong></span><b>vs</b><span>{(fixture.clubs.red.identity||(fixture.clubs.red.crest&&fixture.clubs.red.colors))&&<ClubCrest crest={fixture.clubs.red.identity?.crest??fixture.clubs.red.crest!} colors={fixture.clubs.red.identity?.colors??fixture.clubs.red.colors!} logo={fixture.clubs.red.identity?.assets?.logo??fixture.clubs.red.logo}/>}<strong>{fixture.clubs.red.name}</strong></span></div>
        <footer><div><time><Clock3 size={12}/>{manilaTime.format(new Date(fixture.kickoff_at))}</time>{fixture.can_submit&&<small>Orders close {manilaTime.format(new Date(fixture.orders_close_at))}</small>}</div><div>{fixture.can_submit&&<button className={`${button} cm-btn-primary`} onClick={()=>{setLineup(fixture.orders??data.club.lineup);setEditingFixture(fixture);setClubTab('lineup');}}><ClipboardList size={13}/>{fixture.orders?'Edit orders':'Set orders'}</button>}{fixture.match_id&&(fixture.can_watch??['Live','Completed'].includes(fixture.status))&&<button className={button} onClick={()=>void openMatch(fixture.match_id!)}>{fixture.status==='Live'?'Watch live':fixture.status==='Interrupted'?'Interrupted recording':'Replay & report'}</button>}</div></footer>
      </article>)}</div>
    </section>}
    {!broadcastOnly && scheduled && data && clubTab === 'friendly' && <section className="club-panel space-y-3">
      <header className="scrimmage-heading">
        <div className="scrimmage-heading__icon"><Swords size={19}/></div>
        <div><p className="scrimmage-eyebrow">CLUB VS CLUB · HUMAN MANAGERS</p><h3>Same-tier scrimmage</h3></div>
        <span className="scrimmage-human-tag"><Users size={13}/> Invitations only</span>
      </header>
      <p className="club-help scrimmage-intro">Find a real club near your squad’s level. We compare server-calculated lineup ratings and only pair clubs in the same tier—never widen the search. A fixture is scheduled 30 minutes after pairing so both managers can review orders.</p>
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
      <h3>Invite a club directly</h3>
      <p className="club-help">Invite a club by its tag and choose a future kickoff. The match is scheduled when they accept.</p>
      <form className="flex flex-wrap items-end gap-3" onSubmit={async event => {
        event.preventDefault();
        const form = event.currentTarget;
        const fields = new FormData(form);
        const kickoff = String(fields.get('kickoff'));
        if (await act('/online/fixtures/invites', { tag: String(fields.get('tag')).toUpperCase(), kickoff_at: `${kickoff}:00+08:00` }, 'POST', 'Scrimmage invitation sent. Clubs respond when a suitable slot is available.')) form.reset();
      }}>
        <label className="text-sm">Opponent club tag<input className="cm-input block" name="tag" required pattern="[A-Za-z0-9]{2,12}" /></label>
        <label className="text-sm">Kickoff in Manila time<input className="cm-input block" name="kickoff" type="datetime-local" required /></label>
        <button className={button} disabled={busy}>Send invitation</button>
      </form>
      {invites.map(invite => <div key={invite.id} className="flex flex-wrap items-center gap-3">
        <p>{invite.home.name} · {manilaTime.format(new Date(invite.kickoff_at))} Manila</p>
        <button className={button} disabled={busy} onClick={() => void act(`/online/fixtures/invites/${invite.id}/accept`, undefined, 'POST', 'Scrimmage accepted. The fixture is on your calendar.')}>Accept scrimmage</button>
      </div>)}
    </section>}
    {!broadcastOnly && data && session && (!scheduled || clubTab === 'identity') && <ClubIdentityEditor session={session} club={data.club} onSaved={() => setRefresh(value => value + 1)} />}
    {!broadcastOnly && data && (!scheduled || clubTab === 'lineup') && <section className="club-panel lineup-workbench">
      <div className="lineup-workbench__heading">
        <div>
          <p className="lineup-workbench__eyebrow"><ClipboardList size={14}/>{editingFixture ? 'FIXTURE ORDERS' : 'SQUAD MANAGEMENT'}</p>
          <h3>{editingFixture ? `${editingFixture.clubs.blue.name} vs ${editingFixture.clubs.red.name}` : 'Your starting five'}</h3>
          <p className="club-help">{editingFixture ? 'Set the five players for this tactical FPS fixture.' : 'Set your starters and review their FPS skills, personalities and role fit.'}</p>
        </div>
        <div className="lineup-workbench__badge"><Swords size={15}/><span>STAFF-LED DRAFT</span></div>
      </div>
      <form onSubmit={async event => {
        event.preventDefault();
        if (editingFixture) {
          if (await act(`/online/fixtures/${editingFixture.id}/orders`, { lineup }, 'PUT', 'Match orders saved.')) {setEditingFixture(null);if(matchCentre)setClubTab('calendar');}
        } else {
          await act('/online/club', { lineup, revision: data.club.revision, ...(scheduled ? {} : { name: clubName }) }, 'PUT', 'Default lineup saved.');
        }
      }}>
        {!scheduled && <label className="mt-3 block text-xs">Club name<input required minLength={2} maxLength={80} value={clubName} onChange={event => setClubName(event.target.value)} className="ml-3 max-w-full rounded bg-slate-950 p-2" /></label>}
        <SquadRoster cards={data.cards} lineup={lineup} saved={editingFixture?.orders??data.club.lineup} onChange={setLineup} busy={busy||(!editingFixture&&(data.ticket?.status==='queued'||data.scrimmage_ticket?.status==='queued'))} fixture={!!editingFixture} onReset={()=>setLineup(editingFixture?.orders??data.club.lineup)}/>
        {editingFixture&&<button type="button" className="cm-btn" onClick={()=>{setEditingFixture(null);setClubTab('calendar');}}>Back to fixtures</button>}
      </form>
      {!scheduled && <div className="mt-4 flex flex-wrap items-center gap-3">
        <button className={button} disabled={busy || data.ticket?.status === 'queued' || data.matches.some(match => ['allocated', 'running'].includes(match.status))} onClick={() => void act('/online/queue')}>Find opponent</button>
        {data.ticket?.status === 'queued' && <><p className="text-sm text-amber-200">Searching for another manager. If no one joins in 15 seconds, we’ll match you with an available bot.</p><button className={button} onClick={() => void act('/online/queue', undefined, 'DELETE')}>Leave queue</button></>}
      </div>}
    </section>}
    {!broadcastOnly && data && session && (!scheduled || clubTab === 'lineup') && !editingFixture && <FpsTacticalSystemEditor session={session} players={data.cards}/>}
    {!scheduled && !!data?.matches.length && <section className="rounded-2xl border border-slate-800 bg-slate-900 p-4"><h3 className="font-black">Match history</h3><div className="mt-3 flex flex-wrap gap-2">{data.matches.map(match => <button key={match.id} className={button} onClick={() => void openMatch(match.id)}>{match.status} · {match.id.slice(0, 8)}</button>)}</div></section>}
  </div>;
}
