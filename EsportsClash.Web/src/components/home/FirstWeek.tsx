import {useState, type ReactNode} from 'react';
import {Check, Circle} from 'lucide-react';

export interface FirstWeekState {
  hasTag: boolean; lineupReady: boolean; t: number; ct: number;
  hasFixture: boolean; entered: boolean; playedOfficial: boolean;
}
const KEY = 'hexatrick-first-week';
const read = (key: string) => { try { return localStorage.getItem(KEY + ':' + key) === '1'; } catch { return false; } };
const write = (key: string) => { try { localStorage.setItem(KEY + ':' + key, '1'); } catch { /* storage unavailable: the step simply stays open */ } };

/**
 * A new manager's first week as a checklist on Home. Each step ticks off from real club data (the practice
 * step from this browser). Nothing is done for the manager: roles stay their choice, and entering a
 * competition is their click.
 */
export function FirstWeek({state, onIdentity}: {state: FirstWeekState; onIdentity: () => void}) {
  const [hidden, setHidden] = useState(() => read('hidden')), [watched, setWatched] = useState(() => read('practice'));
  const steps: {key: string; done: boolean; title: string; detail: string; action: ReactNode}[] = [
    {key: 'identity', done: state.hasTag, title: 'Name your club', detail: 'Pick a short tag, crest and colours. Competitions need a published club identity.',
      action: <button type="button" className="cm-btn cm-btn-sm" onClick={onIdentity}>Edit club identity</button>},
    {key: 'roles', done: state.lineupReady, title: 'Give your five their positions', detail: `Each starter needs one T-side and one CT-side position (T ${state.t} of 5, CT ${state.ct} of 5). "Suggest roles from strengths" fills a draft you can change before saving.`,
      action: <a className="cm-btn cm-btn-sm" href="#squad">Open Squad</a>},
    {key: 'practice', done: watched, title: 'Watch your five play', detail: 'A 3D practice scrimmage starts now and changes nothing in your career or finances.',
      action: <a className="cm-btn cm-btn-sm" href="#arena-practice" onClick={() => { write('practice'); setWatched(true); }}>Start practice</a>},
    {key: 'scrimmage', done: state.hasFixture, title: 'Book your first game', detail: 'Join quick match or invite a club by tag. It kicks off on schedule, even when you are offline.',
      action: <a className="cm-btn cm-btn-sm" href="#scrimmages">Arrange a scrimmage</a>},
    {key: 'enter', done: state.entered, title: 'Enter a competition', detail: 'Every competition you are eligible for invites you. Division Trials close on Wednesday at 18:00 Manila; the champion moves up a tier.',
      action: <button type="button" className="cm-btn cm-btn-sm" onClick={() => document.getElementById('home-week')?.scrollIntoView({behavior: 'smooth', block: 'start'})}>See invitations</button>},
    {key: 'played', done: state.playedOfficial, title: 'Play your first official match', detail: 'Results, the round-by-round report and your players\' new levels appear here and in your inbox.',
      action: <a className="cm-btn cm-btn-sm" href="#match-centre">Your fixtures</a>},
  ];
  const remaining = steps.filter(s => !s.done).length;
  if (hidden || remaining === 0) return null;
  return <section className="home-section first-week" aria-labelledby="first-week-title">
    <header className="home-section__head"><h2 id="first-week-title">Your first week <small>{steps.length - remaining} of {steps.length} done</small></h2>
      <button type="button" className="home-link" onClick={() => { write('hidden'); setHidden(true); }}>Hide</button></header>
    <ol className="first-week__steps">{steps.map(s => <li key={s.key} className={s.done ? 'is-done' : ''}>
      {s.done ? <Check size={16} aria-hidden="true" /> : <Circle size={16} aria-hidden="true" />}
      <div><strong>{s.title}</strong>{!s.done && <p>{s.detail}</p>}</div>
      {!s.done && s.action}
    </li>)}</ol>
  </section>;
}
