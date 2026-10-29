import { useEffect, useRef, useState } from 'react';
import { isCloudPersistenceConfigured, loadApiSession, loginCloudAccount, persistApiSession, registerCloudAccount, request, type ApiSession } from '../cloudPersistence';
import { acceptOnlineSnapshot, type OnlineSnapshot } from '../onlineSpectator';
import { OnlineMatchViewer } from './OnlineMatchViewer';
import type { VisualRelease } from '../avatarVisualRelease';

interface Match { id: string; status: string; sequence: number; error?: string;
  plan: { clubs: { blue: string; red: string }; versions: Record<string, string>;visual_releases?:VisualRelease[];
    intelligence?:{controller:string;release?:{id:string;qualification?:string;generation?:number}|null} }; result?: { winner: string } }
interface Dashboard {
  club: { name: string; revision: number; lineup: { instance_id: string; avatar_id: string }[] };
  cards: { id: string; definition: { name: string; preferredRole?: string; role?: string; ovr: number } }[];
  avatars: { id: string; name: string; displayName?: string; primaryRole: string; secondaryRole?: string }[];
  ticket?: { status: string; match_id?: string }; matches: Match[];
}
const button = 'rounded-lg border border-slate-600 px-3 py-2 text-xs font-bold hover:border-cyan-400 disabled:opacity-40';

export function OnlineNormalView() {
  const [session, setSession] = useState<ApiSession | null>(loadApiSession);
  const [email, setEmail] = useState(''), [password, setPassword] = useState(''), [name, setName] = useState('');
  const [register, setRegister] = useState(false), [error, setError] = useState(''), [busy, setBusy] = useState(false);
  const [data, setData] = useState<Dashboard | null>(null), [selected, setSelected] = useState<Match | null>(null);
  const [frame, setFrame] = useState<OnlineSnapshot | null>(null), [connection, setConnection] = useState('Disconnected');
  const [refresh, setRefresh] = useState(0), [clubName, setClubName] = useState(''), [lineup, setLineup] = useState<Dashboard['club']['lineup']>([]);
  const [live, setLive] = useState(true), [replaySequence, setReplaySequence] = useState(1);
  const latestSequence = useRef(0);

  useEffect(() => {
    if (!session || !isCloudPersistenceConfigured()) return;
    const controller = new AbortController(); let closed = false;
    const load = async () => {
      try {
        const response = await request<{ data: Dashboard }>('/online', session, { signal: controller.signal });
        if (!closed) { setData(response.data); setError(''); }
      } catch (problem) { if (!closed) setError((problem as Error).message); }
    };
    void load(); const timer = window.setInterval(() => void load(), 4000);
    return () => { closed = true; controller.abort(); clearInterval(timer); };
  }, [session, refresh]);
  useEffect(() => { if (data) { setClubName(data.club.name); setLineup(data.club.lineup); } }, [data?.club.revision]);
  useEffect(() => {
    if (!data) return;
    if (!selected && data.ticket?.match_id) setSelected(data.matches.find(match => match.id === data.ticket?.match_id) ?? null);
    else if (selected) {
      const current = data.matches.find(match => match.id === selected.id);
      if (current && (current.status !== selected.status || current.sequence !== selected.sequence)) setSelected(current);
    }
  }, [data, selected]);

  useEffect(() => {
    if (!session || !selected || !live) return;
    const match = selected; let closed = false, terminal = false, socket: WebSocket | null = null, timer = 0;
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
            } else if (message.type === 'match-ended') { terminal = true; setConnection(message.status); setRefresh(value => value + 1); }
          } catch { setError('The server sent an invalid match frame.'); }
        };
        socket.onclose = () => { if (!closed && !terminal) { setConnection('Reconnecting'); timer = window.setTimeout(() => void connect(), 2000); } };
      } catch (problem) { if (!closed) { setError((problem as Error).message); timer = window.setTimeout(() => void connect(), 5000); } }
    };
    void connect();
    return () => { closed = true; clearTimeout(timer); socket?.close(); };
  }, [session, selected?.id, live]);

  const act = async (path: string, body?: unknown, method = 'POST') => {
    setBusy(true); setError('');
    try { await request(path, session, { method, ...(body === undefined ? {} : { body: JSON.stringify(body) }) }); setRefresh(value => value + 1); }
    catch (problem) { setError((problem as Error).message); }
    finally { setBusy(false); }
  };
  const authenticate = async (event: React.FormEvent) => {
    event.preventDefault(); setBusy(true); setError('');
    try {
      const next = register ? await registerCloudAccount({ name, email, password, password_confirmation: password }) : await loginCloudAccount({ email, password });
      persistApiSession(next); setSession(next); setPassword('');
    } catch (problem) { setError((problem as Error).message); }
    finally { setBusy(false); }
  };
  const replay = async () => {
    if (!selected) return;
    setLive(false);
    try {
      const response = await request<{ data: { frames: OnlineSnapshot[] } }>(`/online/matches/${selected.id}/replay?after=${Math.max(0, replaySequence - 1)}&limit=1`, session);
      const message = response.data.frames[0];
      if (acceptOnlineSnapshot(message, selected.id, selected.plan.versions, 0)) setFrame(message);
    } catch (problem) { setError((problem as Error).message); }
  };

  if (!isCloudPersistenceConfigured()) return <p className="rounded-xl bg-slate-900 p-5 text-sm text-slate-300">Open the local Docker app at localhost:8088 for server-owned Normal matches.</p>;
  return <div className="space-y-5 pb-10">
    <section className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
      <h2 className="text-xl font-black text-cyan-300">Online Normal</h2>
      <p className="mt-2 text-sm text-slate-300">Two club owners. One server-owned match. Free starter cards are issued once per account.</p>
      <p className="mt-2 text-xs text-slate-400">This local preview awards no global Rating, currency, or progression. Existing local collections stay separate.</p>
      {error && <p role="alert" className="mt-3 text-sm text-red-300">{error}</p>}
      {!session && <form onSubmit={authenticate} className="mt-4 flex flex-wrap items-end gap-3">
        {register && <label className="text-xs">Club owner<input required value={name} onChange={event => setName(event.target.value)} className="block rounded bg-slate-950 p-2" /></label>}
        <label className="text-xs">Email<input type="email" autoComplete="username" required value={email} onChange={event => setEmail(event.target.value)} className="block rounded bg-slate-950 p-2" /></label>
        <label className="text-xs">Password<input type="password" autoComplete={register ? 'new-password' : 'current-password'} minLength={register ? 12 : undefined} required value={password} onChange={event => setPassword(event.target.value)} className="block rounded bg-slate-950 p-2" /></label>
        <button className={button} disabled={busy}>{register ? 'Create account' : 'Sign in'}</button>
        <button type="button" className={button} onClick={() => setRegister(value => !value)}>{register ? 'Use existing account' : 'Register'}</button>
      </form>}
      {session && <button className={`${button} mt-3`} onClick={() => { persistApiSession(null); setSession(null); setData(null); setSelected(null); }}>Disconnect account</button>}
    </section>
    {data && <section className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
      <h3 className="font-black">Your trusted lineup</h3>
      <form onSubmit={event => { event.preventDefault(); void act('/online/club', { name: clubName, lineup, revision: data.club.revision }, 'PUT'); }}>
        <label className="mt-3 block text-xs">Club name<input required minLength={2} maxLength={80} value={clubName} onChange={event => setClubName(event.target.value)} className="ml-3 max-w-full rounded bg-slate-950 p-2" /></label>
        <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">{lineup.map((slot, index) => {
          const card = data.cards.find(card => card.id === slot.instance_id);
          return <div key={slot.instance_id} className="min-w-0 rounded-lg bg-slate-950 p-3">
            <p className="text-sm font-bold text-cyan-200">{card?.definition.name} · {card?.definition.ovr}</p>
            <p className="my-2 text-xs text-slate-400">{card?.definition.preferredRole ?? card?.definition.role}</p>
            <label className="text-xs">Avatar<select aria-label={`Avatar for ${card?.definition.name}`} className="mt-1 w-full rounded bg-slate-800 p-2" value={slot.avatar_id} onChange={event => setLineup(value => value.map((item, i) => i === index ? { ...item, avatar_id: event.target.value } : item))}>
              {data.avatars.filter(avatar => [avatar.primaryRole, avatar.secondaryRole].includes(card?.definition.preferredRole ?? card?.definition.role ?? '')).map(avatar => <option key={avatar.id} value={avatar.id}>{avatar.displayName ?? avatar.name}</option>)}
            </select></label>
          </div>;
        })}</div>
        <button className={`${button} mt-3`} disabled={busy || data.ticket?.status === 'queued'}>Save lineup</button>
      </form>
      <div className="mt-4 flex flex-wrap items-center gap-3">
        <button className={button} disabled={busy || data.ticket?.status === 'queued' || data.matches.some(match => ['allocated', 'running'].includes(match.status))} onClick={() => void act('/online/queue')}>Find human opponent</button>
        {data.ticket?.status === 'queued' && <><p className="text-sm text-amber-200">Waiting for another owner…</p><button className={button} onClick={() => void act('/online/queue', undefined, 'DELETE')}>Leave queue</button></>}
      </div>
    </section>}
    {selected && <section className="space-y-3 rounded-2xl border border-slate-800 bg-slate-900 p-4">
      <h3 className="font-black">{selected.plan.clubs.blue} vs {selected.plan.clubs.red}</h3>
      {selected.plan.intelligence?.controller==='hybrid'&&<p className="text-xs text-cyan-200">Coordinated gameplay baseline with learning. The server freezes the controller for this match; experimental command models cannot replace its baseline.</p>}
      {selected.plan.intelligence?.controller==='arena'&&<p className="text-xs text-cyan-200">Learning AI: {selected.plan.intelligence.release?.qualification==='qualified'?'qualified policy':selected.plan.intelligence.release?'experimental checkpoint':'instructional foundation'}{selected.plan.intelligence.release?.generation!==undefined?` · update ${selected.plan.intelligence.release.generation}`:''}. The server keeps this version fixed for the match. Experimental updates have no established competitive improvement.</p>}
      <p className="text-xs text-slate-300">{connection} · server sequence {frame?.sequence ?? 0} · {Math.floor(frame?.snapshot.second ?? 0)}s {selected.result && `· ${selected.result.winner} wins`}</p>
      {selected.error && <p className="text-sm text-red-300">{selected.error}</p>}
      <OnlineMatchViewer message={frame} matchId={selected.id} visuals={selected.plan.visual_releases} />
      <div className="flex flex-wrap items-center gap-2">
        <label className="text-xs">Replay snapshot<input type="number" min={1} max={Math.max(1, selected.sequence)} value={replaySequence} onChange={event => setReplaySequence(Number(event.target.value))} className="ml-2 w-24 rounded bg-slate-950 p-2" /></label>
        <button className={button} onClick={() => void replay()}>View saved snapshot</button>
        {!live && <button className={button} onClick={() => setLive(true)}>Return to live</button>}
      </div>
      <ol className="max-h-32 space-y-1 overflow-y-auto text-xs text-slate-400">{frame?.snapshot.events.slice(-8).map((event, index) => <li key={index}>{Math.floor(event.second)}s · {event.text}</li>)}</ol>
    </section>}
    {!!data?.matches.length && <section className="rounded-2xl border border-slate-800 bg-slate-900 p-4"><h3 className="font-black">Match history</h3><div className="mt-3 flex flex-wrap gap-2">{data.matches.map(match => <button key={match.id} className={button} onClick={() => { setSelected(match); setLive(true); }}>{match.status} · {match.id.slice(0, 8)}</button>)}</div></section>}
  </div>;
}
