import {createRoot} from 'react-dom/client';
import {useState} from 'react';
import '../src/index.css';
import '../src/hexatrick-world.css';
import '../src/personal-theme.css';
import '../src/hexatrick-records.css';
import '../src/components/ui/ui.css';
import {AppIcon} from '../src/components/ui/AppIcon';
import {PageHeader} from '../src/components/ui/PageHeader';
import {WORKSPACE_NAV, areaHeading, navTrail, type NavKey} from '../src/components/ui/navigation';
import {FixtureBoard, NextMatch, type BoardFixture} from '../src/components/matches/FixtureBoard';
import {AttentionList, ClubGlance, HomeSection, attentionItems} from '../src/components/home/HomeSections';
import {SquadRoster} from '../src/components/SquadRoster';

const NOW = Date.now(), H = 3600000;
const iso = (ms: number) => new Date(NOW + ms).toISOString();
const me = {id: 1, name: 'RAT CITY', identity: {crest: {shape: 'shield', mark: 'star'}, colors: {primary: '#1f2b38', secondary: '#f5efe1', accent: '#f1a450'}} as any};
const opp = (id: number, name: string) => ({id, name, identity: {crest: {shape: 'shield', mark: 'bolt'}, colors: {primary: '#3a2440', secondary: '#f1e6d2', accent: '#e0b96b'}} as any});
const fx = (id: number, status: string, kick: number, extra: Partial<BoardFixture> = {}): BoardFixture => ({
  id, competition: 'Hexa Weeklies · Tier 5 · Cup 1', tournament_id: 3, kickoff_at: iso(kick), orders_close_at: iso(kick - 1.75 * H), status,
  can_submit: status === 'Scheduled', match_id: ['Live', 'Completed', 'Interrupted'].includes(status) ? 'm' + id : null, orders: null,
  clubs: {blue: me, red: opp(10 + id, ['Taal Relay', 'Cebu Static', 'Iloilo Rift', 'Davao Halo', 'Baguio Frost', 'Naga Pulse'][id % 6])}, ...extra,
});
const fixtures: BoardFixture[] = [
  fx(1, 'Scheduled', 5 * H),
  fx(2, 'Scheduled', 29 * H, {orders: [{}], competition: 'Scrimmage', tournament_id: null}),
  fx(3, 'Orders locked', 1.2 * H),
  fx(4, 'Delayed', -0.3 * H),
  fx(5, 'Completed', -26 * H),
  fx(6, 'Completed', -50 * H),
  fx(7, 'Interrupted', -74 * H),
];

const pers = (t: string, p: string, m: string, d: string) => ({temperament: t, playstyle: p, mindset: m, decisionStyle: d, id: 'x', name: 'x'} as any);
const stats = {rifling: 46, sniping: 22, entry: 35, utility: 51, positioning: 63, shotcalling: 31};
const card = (id: string, name: string, ovr: number, p: any, tends: any[], assign: any, code = 'FR', country = 'France') => ({
  id, training_xp: 0, definition: {name, ovr, stats, wage: 26, nationality: {code, name: country},
    fpsIdentity: {player_id: id, personality: p, assignments: assign, mapping: '', confidence: '', observations: {risk: '', adaptability: '', preparation: '', team_orientation: ''}, top_tendencies: tends}}}) as any;
const cards = [
  card('1', 'Pibov4', 24, pers('STEADY', 'BALANCED', 'TEAM_FIRST', 'METHODICAL'), [{key: 'a', label: 'Support flash', value: 8, level: 'Strongly'}], {t: 'T_SUPPORT', ct: 'CT_ANCHOR_A'}),
  card('2', 'Jujono', 22, pers('VOLATILE', 'AGGRESSIVE', 'INDIVIDUALIST', 'ADAPTIVE'), [{key: 'a', label: 'Early aggression', value: 8, level: 'Strongly'}, {key: 'b', label: 'Wide swing', value: 8, level: 'Strongly'}, {key: 'c', label: 'Rotation proactivity', value: 7, level: 'Usually'}], {t: 'T_ENTRY'}),
  card('3', 'rekyizen', 31, pers('ICE_COLD', 'PASSIVE', 'TEAM_FIRST', 'INSTINCTIVE'), [], null, 'JP', 'Japan'),
  card('4', 'Kazaish', 23, pers('ICE_COLD', 'BALANCED', 'TEAM_FIRST', 'ADAPTIVE'), [{key: 'a', label: 'Play discipline', value: 7, level: 'Usually'}], {t: 'T_IGL', ct: 'CT_IGL'}),
  card('5', 'laekyuva', 29, pers('ICE_COLD', 'PASSIVE', 'INDIVIDUALIST', 'INSTINCTIVE'), [{key: 'a', label: 'Lurk flank', value: 9, level: 'Very strongly'}], null, 'ZA', 'South Africa'),
  card('6', 'Kebaik', 27, pers('STEADY', 'PASSIVE', 'TEAM_FIRST', 'INSTINCTIVE'), [], null, 'JP', 'Japan'),
  card('7', 'flopz', 18, pers('VOLATILE', 'AGGRESSIVE', 'TEAM_FIRST', 'METHODICAL'), [], null, 'PH', 'Philippines'),
];

function Shell({nav, children}: {nav: NavKey; children: React.ReactNode}) {
  const heading = areaHeading(nav), [group, label] = navTrail(nav);
  const open = new URLSearchParams(location.search).has('menu');
  return <div className="cm-shell">
    <aside className="cm-sidebar" aria-label="Club navigation">
      <div className="cm-brand"><span className="cm-brand-title">hexatrick</span><div className="cm-brand-sub">Your club. Every matchday.</div>
        <button type="button" className="cm-nav-toggle" aria-expanded={open}>{open ? 'Close menu' : label}</button></div>
      <nav className={`cm-nav ${open ? 'is-open' : ''}`} aria-label="Workspace">{WORKSPACE_NAV.map(g => <div className="cm-nav-group-block" key={g.id}>
        <div className="cm-nav-section">{g.label}</div>
        {g.items.map(i => <a key={i.key} href="#" className={`cm-nav-btn ${i.key === nav ? 'active' : ''}`}><span className="flex items-center gap-2"><AppIcon name={i.icon} size={16} /><span>{i.label}</span></span></a>)}
      </div>)}</nav>
    </aside>
    <div className="cm-main">
      <header className="cm-topbar"><div className="cm-breadcrumb">{group} <span aria-hidden="true">/</span> <strong>{label}</strong> <span>Manila · UTC+8</span></div></header>
      <main className="cm-content max-w-7xl mx-auto w-full">
        {heading && <PageHeader eyebrow={heading.group} icon={heading.icon} title={heading.title} description={heading.description} />}
        {children}
      </main>
    </div>
  </div>;
}

function Harness() {
  const view = new URLSearchParams(location.search).get('view') ?? 'matches';
  const [lineup, setLineup] = useState(cards.slice(0, 5).map(c => ({instance_id: c.id})));
  if (view === 'home') {
    const items = attentionItems({fixtures, cards, lineup, cash: 18250, now: NOW, onWatch: () => {}, onFixtures: () => {}});
    return <Shell nav="home"><div className="home">
      <div className="home-top">
        <HomeSection id="a" title="Needs your attention"><AttentionList items={items} allClear="All good." /></HomeSection>
        <HomeSection id="b" title="Next match" action={<button className="home-link">All fixtures</button>}><NextMatch showLabel={false} f={fixtures[2]} clubId={1} now={NOW} onOrders={() => {}} onWatch={() => {}} /></HomeSection>
      </div>
      <HomeSection id="c" title="Club at a glance"><ClubGlance stats={[
        {label: 'Cash available', value: '₱18,250', href: '#', note: 'Youth academy not opened'},
        {label: 'Contracted players', value: 7, href: '#', note: '0 training XP recorded'},
        {label: 'Global rating (HGR)', value: 'Unrated', href: '#', note: 'Play ranked games to get rated'},
        {label: 'Circuit points', value: 0, href: '#', note: '0 titles won'},
      ]} /></HomeSection>
    </div></Shell>;
  }
  if (view === 'squad') return <Shell nav="squad"><SquadRoster cards={cards} lineup={lineup} saved={lineup} onChange={setLineup} busy={false} onReset={() => {}} /></Shell>;
  return <Shell nav="matches">
    <nav className="cm-tabs matches-nav" aria-label="Matches">{([['fixtures', 'Fixtures', true], ['scrimmages', 'Scrimmages', false], ['history', 'Results', false]] as const).map(([icon, label, cur]) =>
      <a key={icon} href="#" className={`cm-tab ${cur ? 'active' : ''}`}><AppIcon name={icon} size={14} />{label}</a>)}</nav>
    <FixtureBoard fixtures={fixtures} clubId={1} onOrders={() => {}} onWatch={() => {}} />
  </Shell>;
}
createRoot(document.getElementById('root')!).render(<Harness />);
