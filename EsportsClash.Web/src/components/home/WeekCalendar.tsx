import {useEffect, useState} from 'react';
import {CalendarRange} from 'lucide-react';
import {useAccount} from '../../AccountContext';
import {request} from '../../cloudPersistence';
import {pediaHref, pediaMoney} from '../../hexapedia';
import {matchDateTime, relativeTime} from '../matches/time';

interface Week {
  week_starts_at: string;
  invitations: {id: number; name: string | null; tier: number | null; closes_at: string; starts_at: string | null; champion_prize: number; ranked: boolean}[];
  entered: {id: number; name: string | null; starts_at: string | null; status: string}[];
  community_cup: {id: number; status: string} | null;
  beats: {at: string; label: string}[];
}

/**
 * This week for the club: competitions that invited you (enter or decline in one click), what you are
 * entered in, the community cup, and the fixed beats of every week.
 */
export function WeekCalendar({now, onChange}: {now: number; onChange?: () => void}) {
  const {session} = useAccount();
  const [week, setWeek] = useState<Week | null>(null), [error, setError] = useState(''), [busy, setBusy] = useState<number | null>(null), [revision, setRevision] = useState(0);
  useEffect(() => {
    if (!session) return;
    const c = new AbortController();
    void request<{data: Week}>('/online/week', session, {signal: c.signal}).then(r => { setWeek(r.data); setError(''); }).catch(e => { if (!c.signal.aborted) setError((e as Error).message); });
    return () => c.abort();
  }, [session, revision]);
  async function answer(id: number, enter: boolean) {
    if (!session) return;
    setBusy(id); setError('');
    try {
      await request(enter ? `/competitions/editions/${id}/enter` : `/online/invitations/${id}/decline`, session, {method: 'POST'});
      setRevision(v => v + 1); onChange?.();
    } catch (e) { setError((e as Error).message); } finally { setBusy(null); }
  }
  if (!week) return error ? <p role="alert" className="home-quiet">{error}</p> : <p role="status" className="home-quiet">Loading this week…</p>;
  return <div className="week">
    {error && <p role="alert">{error}</p>}
    {week.invitations.length > 0 ? <ul className="week-invites">{week.invitations.map(i => <li key={i.id}>
      <div><strong><a href={pediaHref('tournaments', i.id)}>{i.name ?? 'Competition'}</a></strong>
        <small>{[i.tier ? 'Tier ' + i.tier : null, i.ranked ? 'Ranked' : 'Unranked', i.champion_prize > 0 ? 'Champion ' + pediaMoney(i.champion_prize) : null, 'entries close ' + relativeTime(i.closes_at, now)].filter(Boolean).join(' · ')}</small></div>
      <span className="week-invites__actions"><button type="button" className="cm-btn cm-btn-sm cm-btn-primary" disabled={busy !== null} onClick={() => void answer(i.id, true)}>{busy === i.id ? 'Entering…' : 'Enter'}</button>
        <button type="button" className="cm-btn cm-btn-sm cm-btn-ghost" disabled={busy !== null} onClick={() => void answer(i.id, false)}>Decline</button></span>
    </li>)}</ul> : <p className="home-quiet">No open invitations right now. Every competition you are eligible for invites you automatically.</p>}
    {week.entered.length > 0 && <p className="week-entered">Entered: {week.entered.map((e, n) => <span key={e.id}>{n > 0 && ', '}<a href={pediaHref('tournaments', e.id)}>{e.name ?? 'Competition'}</a>{e.starts_at ? ` (${matchDateTime(e.starts_at)})` : ''}</span>)}</p>}
    {week.community_cup && <p className="week-entered">Community cup: {week.community_cup.status === 'invited' ? <a href="#community-cups">answer this week's invitation</a> : week.community_cup.status}</p>}
    <ol className="week-beats">{week.beats.map(b => <li key={b.label} className={Date.parse(b.at) < now ? 'is-past' : ''}><CalendarRange size={13} aria-hidden="true" /><time dateTime={b.at}>{matchDateTime(b.at)}</time> {b.label}</li>)}</ol>
  </div>;
}
