import {useEffect, useState, type ReactNode} from 'react';
import {ArrowRight, CircleAlert, ClipboardList, Lock, PlayCircle, Radio, FileText} from 'lucide-react';
import {ClubCrest, type ClubIdentity} from '../ClubIdentityEditor';
import {TournamentLogo} from '../TournamentLogo';
import {pediaHref} from '../../hexapedia';
import {EmptyState} from '../ui/States';
import {matchDay, matchTime, matchDateTime, relativeTime} from './time';
import {OpponentReport} from './OpponentReport';
import './matches.css';

export type BoardClub = {id?: number; name: string; tag?: string; logo?: string; identity?: ClubIdentity; crest?: ClubIdentity['crest']; colors?: ClubIdentity['colors']};
export interface BoardFixture {
  id: number; competition: string; tournament_id?: number | null; kickoff_at: string; orders_close_at: string; status: string;
  can_submit: boolean; can_watch?: boolean; match_id: string | null; orders: unknown[] | null; clubs: {blue: BoardClub; red: BoardClub};
  /** Your side, the verified outcome and round score (from the server), and the announced map. */
  side?: 'blue' | 'red'; outcome?: 'win' | 'loss' | null; score?: {blue: number; red: number} | null; map?: {id: string; name: string} | null;
  opponent_id?: number | null; plan?: FixturePlan | null;
}
export interface FixturePlan {gameplan?: Record<string, number>; instructions?: Record<string, string>}

/** "Won 16–11" from your side; null until a verified outcome exists. */
export function resultText(f: Pick<BoardFixture, 'outcome' | 'score' | 'side'>): string | null {
  if (!f.outcome) return null;
  const mine = f.side ?? 'blue', theirs = mine === 'blue' ? 'red' : 'blue';
  return (f.outcome === 'win' ? 'Won' : 'Lost') + (f.score ? ` ${f.score[mine]}–${f.score[theirs]}` : '');
}

/** Where a fixture is in its life, from the manager's point of view. */
export type FixturePhase = 'live' | 'orders' | 'locked' | 'review' | 'result';
export function fixturePhase(f: BoardFixture): FixturePhase {
  if (f.status === 'Live') return 'live';
  if (f.status === 'Needs review') return 'review';
  if (f.status === 'Completed' || f.status === 'Interrupted') return 'result';
  return f.can_submit ? 'orders' : 'locked';
}

const GROUPS: {phase: FixturePhase; title: string; explain: string}[] = [
  {phase: 'live', title: 'Live now', explain: 'On air. Results are confirmed when the broadcast ends.'},
  {phase: 'orders', title: 'Set your orders', explain: 'Orders are open. Your saved default lineup plays unless you set orders for a game.'},
  {phase: 'locked', title: 'Locked in', explain: 'Lineups are locked and the match is being prepared for broadcast.'},
  {phase: 'review', title: 'Needs review', explain: 'An eligible lineup could not be fielded. The fixture is held for review.'},
  {phase: 'result', title: 'Recent results', explain: 'Fixtures from the last 30 days.'},
];

export function useNow(intervalMs = 30000) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => { const id = window.setInterval(() => setNow(Date.now()), intervalMs); return () => window.clearInterval(id); }, [intervalMs]);
  return now;
}

function Crest({club}: {club: BoardClub}) {
  const crest = club.identity?.crest ?? club.crest, colors = club.identity?.colors ?? club.colors;
  return crest && colors ? <ClubCrest crest={crest} colors={colors} logo={club.identity?.assets?.logo ?? club.logo} /> : <span className="fx-crest-fallback" aria-hidden="true">{club.name.slice(0, 1)}</span>;
}

/** Rows name only the opponent (your club plays every fixture) and whether you are home or away. */
function Opponent({f, clubId}: {f: BoardFixture; clubId?: number}) {
  const mySide = clubId === undefined ? null : f.clubs.blue.id === clubId ? 'blue' : f.clubs.red.id === clubId ? 'red' : null;
  if (!mySide) return <Teams f={f} clubId={clubId} />;
  const club = f.clubs[mySide === 'blue' ? 'red' : 'blue'];
  return <div className="fx-teams"><span className="fx-team"><span className="fx-vs" aria-hidden="true">vs</span><Crest club={club} />
    <span className="fx-team__name">{club.id ? <a href={pediaHref('teams', club.id)}>{club.name}</a> : club.name}</span>
    <span className="fx-side">{mySide === 'blue' ? 'Home' : 'Away'}</span></span></div>;
}

function Teams({f, clubId, size = 'md'}: {f: BoardFixture; clubId?: number; size?: 'md' | 'lg'}) {
  return <div className={`fx-teams fx-teams--${size}`}>
    {(['blue', 'red'] as const).map((side, i) => {
      const club = f.clubs[side], mine = clubId !== undefined && club.id === clubId;
      return <span key={side} className={`fx-team ${mine ? 'is-mine' : ''}`}>
        {i === 1 && <span className="fx-vs" aria-hidden="true">vs</span>}
        <Crest club={club} />
        <span className="fx-team__name">{club.id && !mine ? <a href={pediaHref('teams', club.id)}>{club.name}</a> : club.name}</span>
        {mine && <span className="fx-you">You</span>}
      </span>;
    })}
  </div>;
}

/** One line telling the manager exactly what state the game is in. */
function stateLine(f: BoardFixture, phase: FixturePhase, now: number): ReactNode {
  switch (phase) {
    case 'live': return <><Radio size={13} aria-hidden="true" />On air · started {relativeTime(f.kickoff_at, now)}</>;
    case 'orders': return <><ClipboardList size={13} aria-hidden="true" />{f.orders ? 'Custom orders' : 'Default lineup'}{f.map ? ` · ${f.map.name}` : ''} · orders close {relativeTime(f.orders_close_at, now)}</>;
    case 'locked': return f.status === 'Delayed'
      ? <><CircleAlert size={13} aria-hidden="true" />Delayed · waiting for the previous game on this stream</>
      : <><Lock size={13} aria-hidden="true" />Lineup locked{f.map ? ` · ${f.map.name}` : ''} · kickoff {relativeTime(f.kickoff_at, now)}</>;
    case 'review': return <><CircleAlert size={13} aria-hidden="true" />Lineup could not be fielded</>;
    case 'result': {
      const result = resultText(f);
      return <><FileText size={13} aria-hidden="true" />{f.status === 'Interrupted' ? 'Recording interrupted' : result ? <strong className={`fx-outcome is-${f.outcome}`}>{result}</strong> : 'Final'}{f.map ? ` · ${f.map.name}` : ''} · {relativeTime(f.kickoff_at, now)}</>;
    }
  }
}

function Action({f, phase, onOrders, onWatch}: {f: BoardFixture; phase: FixturePhase; onOrders: (f: BoardFixture) => void; onWatch: (f: BoardFixture) => void}) {
  if (phase === 'orders') return <button type="button" className="cm-btn cm-btn-primary" onClick={() => onOrders(f)}><ClipboardList size={13} aria-hidden="true" />{f.orders ? 'Edit orders' : 'Set orders'}</button>;
  if (f.match_id && (f.can_watch ?? (phase === 'live' || phase === 'result'))) {
    return phase === 'live'
      ? <button type="button" className="cm-btn cm-btn-primary" onClick={() => onWatch(f)}><PlayCircle size={13} aria-hidden="true" />Watch live</button>
      : <button type="button" className="cm-btn" onClick={() => onWatch(f)}>{f.status === 'Interrupted' ? 'Open recording' : 'Replay & report'}</button>;
  }
  return null;
}

function Competition({f}: {f: BoardFixture}) {
  return <span className="fx-competition"><TournamentLogo id={f.tournament_id ?? 'scrimmage'} name={f.competition} size={16} />
    {f.tournament_id ? <a href={pediaHref('tournaments', f.tournament_id)}>{f.competition}</a> : <span>{f.competition}</span>}</span>;
}

/** The next game to care about, in full. */
export function NextMatch({f, clubId, now, onOrders, onWatch, showLabel = true}: {f: BoardFixture; clubId?: number; now: number; onOrders: (f: BoardFixture) => void; onWatch: (f: BoardFixture) => void; showLabel?: boolean}) {
  const phase = fixturePhase(f);
  return <section className={`fx-hero fx-hero--${phase}`} aria-label={phase === 'live' ? 'Live now' : 'Next match'}>
    <div className="fx-hero__head">
      {showLabel && <p className="ui-eyebrow">{phase === 'live' ? 'Live now' : 'Next match'}</p>}
      <Competition f={f} />
    </div>
    <Teams f={f} clubId={clubId} size="lg" />
    <p className={`fx-state fx-state--${phase}`}>{stateLine(f, phase, now)}</p>
    <dl className="fx-hero__facts">
      <div><dt>Kickoff · Manila</dt><dd>{matchDateTime(f.kickoff_at)}<small>{relativeTime(f.kickoff_at, now)}</small></dd></div>
      <div><dt>Match orders</dt><dd>{phase === 'orders' ? (f.orders ? 'Custom orders for this game' : 'Your default lineup') : phase === 'live' ? 'Locked' : f.status === 'Delayed' ? 'Locked · delayed start' : 'Locked'}
        {phase === 'orders' && <small>Close {matchDateTime(f.orders_close_at)} · {relativeTime(f.orders_close_at, now)}</small>}</dd></div>
      {f.map && <div><dt>Map</dt><dd>{f.map.name}<small>{phase === 'orders' ? 'Announced; prepare your plan' : 'Played on'}</small></dd></div>}
    </dl>
    {f.opponent_id && phase !== 'result' && <OpponentReport fixtureId={f.id} now={now} />}
    <div className="fx-hero__actions">
      <Action f={f} phase={phase} onOrders={onOrders} onWatch={onWatch} />
      {phase === 'orders' && <a className="cm-btn cm-btn-ghost" href="#squad">Change default lineup <ArrowRight size={13} aria-hidden="true" /></a>}
    </div>
  </section>;
}

/**
 * The manager's fixtures, grouped by what they need to do: watch, set orders, wait, or review.
 * The next relevant game is shown in full above the groups.
 */
export function FixtureBoard({fixtures, clubId, onOrders, onWatch, resultsHref = '#match-history', resultLimit = 5}: {
  fixtures: BoardFixture[]; clubId?: number; onOrders: (f: BoardFixture) => void; onWatch: (f: BoardFixture) => void; resultsHref?: string; resultLimit?: number;
}) {
  const now = useNow();
  if (!fixtures.length) return <EmptyState title="No fixtures yet"
    action={<><a className="cm-btn cm-btn-primary" href="#competitions">Enter a competition</a><a className="cm-btn" href="#scrimmages">Arrange a scrimmage</a></>}>
    Fixtures appear here when you enter a competition or arrange a scrimmage. They start automatically, even when you are offline.
  </EmptyState>;
  const byKickoff = [...fixtures].sort((a, b) => Date.parse(a.kickoff_at) - Date.parse(b.kickoff_at));
  const upcoming = byKickoff.filter(f => fixturePhase(f) !== 'result');
  const hero = upcoming.find(f => fixturePhase(f) === 'live') ?? upcoming[0];
  const grouped = GROUPS.map(g => {
    let rows = (g.phase === 'result' ? [...byKickoff].reverse() : byKickoff).filter(f => fixturePhase(f) === g.phase && f !== hero);
    const total = rows.length;
    if (g.phase === 'result') rows = rows.slice(0, resultLimit);
    return {...g, rows, total};
  }).filter(g => g.rows.length);
  return <div className="fx-board">
    {hero && <NextMatch f={hero} clubId={clubId} now={now} onOrders={onOrders} onWatch={onWatch} />}
    {!hero && <p className="fx-quiet">No upcoming games. Enter a competition or arrange a scrimmage to fill your calendar.</p>}
    {grouped.map(g => <section key={g.phase} className={`fx-group fx-group--${g.phase}`} aria-labelledby={'fx-group-' + g.phase}>
      <header className="fx-group__head">
        <h3 id={'fx-group-' + g.phase}>{g.title}<span className="fx-count">{g.total}</span></h3>
        <p>{g.explain}</p>
        {g.phase === 'result' && g.total > g.rows.length && <a href={resultsHref} className="fx-more">All results <ArrowRight size={13} aria-hidden="true" /></a>}
      </header>
      <ol className="fx-list">
        {g.rows.map(f => <li key={f.id} className="fx-row">
          <time className="fx-when" dateTime={f.kickoff_at}><strong>{matchDay(f.kickoff_at)}</strong><span>{matchTime(f.kickoff_at)}</span></time>
          <div className="fx-main"><Competition f={f} /><Opponent f={f} clubId={clubId} /></div>
          <p className={`fx-state fx-state--${g.phase}`}>{stateLine(f, g.phase, now)}</p>
          <div className="fx-action"><Action f={f} phase={g.phase} onOrders={onOrders} onWatch={onWatch} /></div>
        </li>)}
      </ol>
    </section>)}
    <p className="fx-footnote">All times are Manila time (UTC+8).</p>
  </div>;
}
