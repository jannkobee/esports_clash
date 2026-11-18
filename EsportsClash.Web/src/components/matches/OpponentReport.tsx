import {useEffect, useState} from 'react';
import {Binoculars} from 'lucide-react';
import {useAccount} from '../../AccountContext';
import {request} from '../../cloudPersistence';
import {pediaHref} from '../../hexapedia';
import {relativeTime} from './time';

interface Tendency {key: string; label: string; value?: number; level: string | null; reason?: string}
interface Report {
  club: {id: number; name: string; tag: string | null; tier: number}; is_bot: boolean;
  rating: {score: number; games: number} | null;
  recent: {competition: string; kickoff_at: string; outcome: 'win' | 'loss' | null; opponent: string | null; score: ['blue' | 'red', {blue: number; red: number}] | null}[];
  head_to_head: {games: number; wins: number; losses: number};
  tendencies: Tendency[]; samples: number; analyst: {name: string | null; categories: number};
  map: {id: string; name: string} | null;
}

/**
 * What your staff can lawfully tell you about the next opponent: public results and rating, your meetings,
 * and their observed team tendencies (recorded matches only, in whole 1–10 levels). Your analyst decides how
 * many categories the report covers.
 */
export function OpponentReport({fixtureId, now}: {fixtureId: number; now: number}) {
  const {session} = useAccount();
  const [open, setOpen] = useState(false), [data, setData] = useState<Report | null>(null), [error, setError] = useState('');
  useEffect(() => {
    if (!open || !session || data) return;
    const controller = new AbortController();
    void request<{data: Report}>(`/online/fixtures/${fixtureId}/opponent`, session, {signal: controller.signal})
      .then(r => setData(r.data)).catch(e => { if (!controller.signal.aborted) setError((e as Error).message); });
    return () => controller.abort();
  }, [open, session, fixtureId, data]);
  return <details className="fx-scout" onToggle={e => setOpen(e.currentTarget.open)}>
    <summary><Binoculars size={14} aria-hidden="true" /> Scout this opponent</summary>
    {error && <p role="alert">{error}</p>}
    {open && !data && !error && <p role="status">Opening your analyst's report…</p>}
    {data && <div className="fx-scout__body">
      <dl className="fx-scout__facts">
        <div><dt>Club</dt><dd><a href={pediaHref('teams', data.club.id)}>{data.club.name}</a> · Tier {data.club.tier}{data.is_bot ? ' · AI-managed' : ''}</dd></div>
        <div><dt>Rating (HGR)</dt><dd>{data.rating ? `${data.rating.score.toFixed(1)} · ${data.rating.games} rated games` : 'Unrated'}</dd></div>
        <div><dt>Your meetings</dt><dd>{data.head_to_head.games ? `${data.head_to_head.wins} won, ${data.head_to_head.losses} lost` : 'First meeting'}</dd></div>
        {data.map && <div><dt>Map</dt><dd>{data.map.name}</dd></div>}
      </dl>
      <h4>Recent results</h4>
      {data.recent.length ? <ul className="fx-scout__recent">{data.recent.map((r, i) => {
        const score = r.score ? `${r.score[1][r.score[0]]}–${r.score[1][r.score[0] === 'blue' ? 'red' : 'blue']}` : '';
        return <li key={i}><strong className={`fx-outcome is-${r.outcome}`}>{r.outcome === 'win' ? 'Won' : 'Lost'} {score}</strong> vs {r.opponent ?? 'a club'} <small>{r.competition} · {relativeTime(r.kickoff_at, now)}</small></li>;
      })}</ul> : <p className="fx-quiet">No verified results yet.</p>}
      <h4>How they play</h4>
      <p className="fx-quiet">From {data.samples} recorded player appearances. {data.analyst.name ?? 'Your analyst'} covers {data.analyst.categories} of 9 categories.</p>
      <ul className="fx-scout__tendencies">{data.tendencies.map(t => <li key={t.key}>
        <span>{t.label}</span>{t.level ? <b>{t.value} · {t.level}</b> : <small>{t.reason === 'beyond your analyst\'s report' ? 'Not covered by your analyst' : 'Not enough recorded matches'}</small>}
      </li>)}</ul>
    </div>}
  </details>;
}
