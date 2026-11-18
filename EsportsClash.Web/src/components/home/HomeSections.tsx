import type {ReactNode} from 'react';
import {ArrowRight, CircleCheck, ClipboardList, Radio, ShieldAlert} from 'lucide-react';
import {fixturePhase, type BoardFixture} from '../matches/FixtureBoard';
import {relativeTime} from '../matches/time';
import {lineupReadiness, type SquadCard} from '../SquadRoster';
import './home.css';

export type AttentionTone = 'live' | 'urgent' | 'warn';
export interface AttentionItem {key: string; tone: AttentionTone; title: string; detail: string; action: {label: string; href?: string; onClick?: () => void}}

/** Turn club state into a short, ordered list of things the manager should do. Nothing optional goes here. */
export function attentionItems({fixtures, cards, lineup, cash, now, onWatch, onFixtures}: {
  fixtures: BoardFixture[]; cards: Pick<SquadCard, 'id' | 'definition'>[]; lineup: {instance_id: string}[]; cash: number | null; now: number;
  onWatch: (matchId: string) => void; onFixtures: () => void;
}): AttentionItem[] {
  const items: AttentionItem[] = [];
  for (const f of fixtures.filter(f => fixturePhase(f) === 'live' && f.match_id)) {
    items.push({key: 'live:' + f.id, tone: 'live', title: `Live now: ${f.clubs.blue.name} vs ${f.clubs.red.name}`, detail: `${f.competition} · started ${relativeTime(f.kickoff_at, now)}`,
      action: {label: 'Watch', onClick: () => onWatch(f.match_id!)}});
  }
  const open = fixtures.filter(f => fixturePhase(f) === 'orders').sort((a, b) => Date.parse(a.orders_close_at) - Date.parse(b.orders_close_at));
  if (open.length) {
    const custom = open.filter(f => f.orders).length;
    items.push({key: 'orders', tone: 'urgent', title: open.length === 1 ? 'Orders are open for your next fixture' : `Orders are open for ${open.length} fixtures`,
      detail: `First deadline ${relativeTime(open[0].orders_close_at, now)}. ${custom ? `${custom} with custom orders; the rest use` : 'All use'} your default lineup unless you change them.`,
      action: {label: 'Review orders', onClick: onFixtures}});
  }
  const held = fixtures.filter(f => fixturePhase(f) === 'review');
  if (held.length) items.push({key: 'review', tone: 'urgent', title: held.length === 1 ? 'A fixture needs review' : `${held.length} fixtures need review`,
    detail: 'Your club could not field an eligible lineup. Check that your five players are under contract and available.', action: {label: 'Open fixtures', onClick: onFixtures}});
  const r = lineupReadiness(cards, lineup);
  if (!r.ready) items.push({key: 'lineup', tone: 'warn', title: 'Your starting five is not ready',
    detail: !r.five ? `${r.distinct} of 5 starters selected.` : `Positions assigned: T side ${r.t} of 5, CT side ${r.ct} of 5. Official fixtures need all ten.`,
    action: {label: 'Fix in Squad', href: '#squad'}});
  if (cash !== null && cash < 0) items.push({key: 'cash', tone: 'warn', title: 'Your club is in debt', detail: 'Wages keep being charged. The board dismisses managers who stay away while deep in debt. Sell a player, end a staff contract or accept a sponsorship.', action: {label: 'Open finances', href: '#finances'}});
  return items;
}

const TONE_ICON = {live: Radio, urgent: ClipboardList, warn: ShieldAlert} as const;

export function AttentionList({items, allClear}: {items: AttentionItem[]; allClear: ReactNode}) {
  if (!items.length) return <div className="home-clear"><CircleCheck size={18} aria-hidden="true" /><div><strong>Nothing needs you right now</strong><p>{allClear}</p></div></div>;
  return <ul className="home-attention__list">{items.map(item => {
    const Icon = TONE_ICON[item.tone];
    const action = item.action.href
      ? <a className="cm-btn cm-btn-sm" href={item.action.href}>{item.action.label}<ArrowRight size={12} aria-hidden="true" /></a>
      : <button type="button" className={`cm-btn cm-btn-sm ${item.tone === 'live' ? 'cm-btn-primary' : ''}`} onClick={item.action.onClick}>{item.action.label}<ArrowRight size={12} aria-hidden="true" /></button>;
    return <li key={item.key} className={`home-attention__item is-${item.tone}`}>
      <Icon size={16} aria-hidden="true" />
      <div><strong>{item.title}</strong><p>{item.detail}</p></div>
      {action}
    </li>;
  })}</ul>;
}

export interface GlanceStat {label: string; value: ReactNode; note?: ReactNode; href?: string}

/** The club's standing in one row: money, squad, competition. */
export function ClubGlance({stats}: {stats: GlanceStat[]}) {
  return <dl className="home-glance">{stats.map(s => <div key={s.label}>
    <dt>{s.label}</dt>
    <dd>{s.href ? <a href={s.href}>{s.value}</a> : s.value}</dd>
    {s.note && <small>{s.note}</small>}
  </div>)}</dl>;
}

export function HomeSection({id, title, action, children, quiet = false}: {id: string; title: string; action?: ReactNode; children: ReactNode; quiet?: boolean}) {
  return <section className={`home-section ${quiet ? 'is-quiet' : ''}`} aria-labelledby={id}>
    <header className="home-section__head"><h2 id={id}>{title}</h2>{action}</header>
    {children}
  </section>;
}

