import {Fragment, useState} from 'react';
import {ArrowLeft, ArrowRight, Check, ChevronDown, CircleAlert, CircleCheck, RotateCcw, Save, Users} from 'lucide-react';
import {FpsPlayerRole} from './FpsPlayerRole';
import {fpsRoleFit} from '../fps/fpsRoleFit';
import {FPS_ATTRIBUTE_LABELS} from '../fps/fpsPersonality';
import {FPS_BASE_BEHAVIORAL_PROFILES, FPS_POSITION_LABELS, fpsBaseProfileId, personalityLabel, type FpsScoutingProfile} from '../fps/fpsIdentity';
import {CountryFlag} from './CountryFlag';
import {SearchField} from './ui/SearchField';
import {FilterBar, SelectField} from './ui/FilterBar';
import {EmptyState} from './ui/States';
import {WorldPlayerPortrait} from './WorldPlayerPortrait';
import {PlayerForm} from './PlayerForm';
import type {PlayerFormData} from '../playerForm';
// Manager-facing 1–10 levels use the one owner-mandated conversion (fpsScale10).
import {fpsScale10 as toScale10} from '../fps/fpsScale10';
import {pediaHref, pediaMoney} from '../hexapedia';
import './squad-roster.css';

export interface SquadCard {id:string;training_xp:number;form?:PlayerFormData;definition:{fpsIdentity?:FpsScoutingProfile;presentation?:import('../supporter').PlayerPresentation|null;name:string;ovr:number;wage?:number;nationality?:{code:string;name:string};stats?:Record<string,number>}}
type Slot = {instance_id: string};

/** Can this five play an official match? Five distinct starters and a T and CT position for each. */
export function lineupReadiness(cards: Pick<SquadCard, 'id' | 'definition'>[], lineup: Slot[]) {
  const starters = lineup.map(s => cards.find(c => c.id === s.instance_id)).filter((c): c is Pick<SquadCard, 'id' | 'definition'> => !!c);
  const distinct = new Set(starters.map(c => c.id)).size;
  const t = starters.filter(c => c.definition.fpsIdentity?.assignments?.t).length;
  const ct = starters.filter(c => c.definition.fpsIdentity?.assignments?.ct).length;
  return {five: distinct === 5, distinct, t, ct, ready: distinct === 5 && t === 5 && ct === 5};
}

function Readiness({cards, lineup}: {cards: SquadCard[]; lineup: Slot[]}) {
  const r = lineupReadiness(cards, lineup);
  const items: [boolean, string, string | null][] = [
    [r.five, r.five ? 'Five starters selected' : `${r.distinct} of 5 starters selected`, null],
    [r.t === 5, `T-side positions · ${r.t} of 5 assigned`, r.t === 5 ? null : '#tactical-system'],
    [r.ct === 5, `CT-side positions · ${r.ct} of 5 assigned`, r.ct === 5 ? null : '#tactical-system'],
  ];
  return <section className={`squad-ready ${r.ready ? 'is-ready' : ''}`} aria-labelledby="squad-ready-title">
    <div className="squad-ready__summary">
      {r.ready ? <CircleCheck size={20} aria-hidden="true" /> : <CircleAlert size={20} aria-hidden="true" />}
      <div><h3 id="squad-ready-title">{r.ready ? 'Ready for official matches' : 'Not ready for official matches yet'}</h3>
        <p>{r.ready ? 'This five plays every fixture unless you set orders for a specific game.' : 'Official fixtures and matchmaking need five starters with a unique T and CT position each.'}</p></div>
    </div>
    <ul className="squad-ready__checks">{items.map(([ok, label, href]) => <li key={label} className={ok ? 'is-ok' : 'is-todo'}>
      {ok ? <Check size={14} aria-hidden="true" /> : <CircleAlert size={14} aria-hidden="true" />}<span>{label}</span>
      {href && <a href={href} onClick={e => { e.preventDefault(); document.getElementById('tactical-system')?.scrollIntoView({behavior: 'smooth', block: 'start'}); }}>Assign</a>}
    </li>)}</ul>
  </section>;
}

function tendencyNotes(profile?: FpsScoutingProfile) {
  return (profile?.top_tendencies ?? []).filter(t => t.value <= 4 || t.value >= 7).map(t => `${t.label} ${t.value} · ${t.level}`);
}

/** Everything about a player that is useful once, not on every scan: personality, positions, attributes. */
function PlayerDetails({card}: {card: SquadCard}) {
  const profile = card.definition.fpsIdentity, p = profile?.personality, notes = tendencyNotes(profile);
  return <div className="squad-details">
    <section><h4>Personality</h4>
      {p ? <><p className="squad-details__lead" title={FPS_BASE_BEHAVIORAL_PROFILES[fpsBaseProfileId(p) - 1]?.tendency}>{[p.temperament, p.playstyle, p.mindset, p.decisionStyle].map(personalityLabel).join(' · ')}</p>
        {notes.length ? <ul className="squad-details__list">{notes.map(n => <li key={n}>{n}</li>)}</ul> : <p className="squad-muted">No strong natural tendencies.</p>}</>
        : <p className="squad-muted">Not scouted yet.</p>}
    </section>
    <section><h4>Positions</h4>
      <dl className="squad-details__pairs">
        <div><dt>T side</dt><dd>{profile?.assignments?.t ? FPS_POSITION_LABELS[profile.assignments.t].replace(/^T · /, '') : <span className="squad-muted">Not assigned</span>}</dd></div>
        <div><dt>CT side</dt><dd>{profile?.assignments?.ct ? FPS_POSITION_LABELS[profile.assignments.ct].replace(/^CT · /, '') : <span className="squad-muted">Not assigned</span>}</dd></div>
        <div><dt>Best fit</dt><dd><FpsPlayerRole stats={card.definition.stats} /></dd></div>
      </dl>
    </section>
    <section><h4>Attributes</h4>
      <dl className="squad-details__bars">{Object.entries(FPS_ATTRIBUTE_LABELS).map(([key, label]) => {
        const value = card.definition.stats?.[key];
        const level = value == null ? null : toScale10(value);
        return <div key={key}><dt>{label}</dt><dd><span className="squad-bar" aria-hidden="true"><span style={{width: `${(level ?? 0) * 10}%`}} /></span><b>{level ?? '—'}</b><small>/10</small></dd></div>;
      })}</dl>
    </section>
  </div>;
}

/**
 * Squad roster: readiness first, then the starting five, then the roster grouped into starters and reserves.
 * Rows carry only what a manager scans for; personality, positions and attributes open per player.
 */
export function SquadRoster({cards, lineup, saved, onChange, busy, onReset, fixture = false}: {cards: SquadCard[]; lineup: Slot[]; saved: Slot[]; onChange: (slots: Slot[]) => void; busy: boolean; onReset: () => void; fixture?: boolean}) {
  const [slot, setSlot] = useState(0), [search, setSearch] = useState(''), [sort, setSort] = useState('overall');
  const [open, setOpen] = useState<Set<string>>(() => new Set());
  const dirty = JSON.stringify(lineup) !== JSON.stringify(saved);
  const starterIds = lineup.map(s => s.instance_id);
  const starters = new Set(starterIds);
  const assign = (id: string) => {
    const next = lineup.map(s => ({...s})), existing = next.findIndex(s => s.instance_id === id);
    if (existing === slot) return;
    if (existing >= 0) [next[slot], next[existing]] = [next[existing], next[slot]]; else next[slot] = {instance_id: id};
    onChange(next);
  };
  const move = (from: number, to: number) => { const next = [...lineup]; [next[from], next[to]] = [next[to], next[from]]; onChange(next); setSlot(to); };
  const toggle = (id: string) => setOpen(prev => { const next = new Set(prev); if (next.has(id)) next.delete(id); else next.add(id); return next; });
  const term = search.trim().toLowerCase();
  const matches = (c: SquadCard) => !term || [c.definition.name, fpsRoleFit(c.definition.stats), c.definition.nationality?.name].join(' ').toLowerCase().includes(term);
  const order = (a: SquadCard, b: SquadCard) => sort === 'overall' ? b.definition.ovr - a.definition.ovr : sort === 'form' ? (b.form?.score ?? -1) - (a.form?.score ?? -1) : sort === 'wage' ? (b.definition.wage ?? 0) - (a.definition.wage ?? 0) : a.definition.name.localeCompare(b.definition.name);
  const startingRows = starterIds.map(id => cards.find(c => c.id === id)).filter((c): c is SquadCard => !!c && matches(c));
  const reserveRows = cards.filter(c => !starters.has(c.id) && matches(c)).sort(order);
  const shown = startingRows.length + reserveRows.length;
  const slotOf = (id: string) => starterIds.indexOf(id);

  const row = (c: SquadCard) => {
    const inSlot = lineup[slot]?.instance_id === c.id, expanded = open.has(c.id), n = slotOf(c.id);
    return <Fragment key={c.id}>
      <tr className={`squad-row ${starters.has(c.id) ? 'is-starter' : ''} ${expanded ? 'is-open' : ''}`}>
        <th scope="row">
          <div className="squad-player">
            <WorldPlayerPortrait id={c.id} name={c.definition.name} appearance={c.definition.presentation?.appearance} size={40} />
            <div className="squad-player__text">
              <a href={pediaHref('players', c.id)} className="squad-player__name">{c.definition.name}</a>
              <span className="squad-player__meta"><FpsPlayerRole stats={c.definition.stats} />{c.definition.nationality && <CountryFlag code={c.definition.nationality.code} name={c.definition.nationality.name} showName />}</span>
            </div>
            {n >= 0 && <span className="squad-slot-tag" title={`Starting slot ${n + 1}`}>#{n + 1}</span>}
          </div>
        </th>
        <td className="squad-num"><strong>{toScale10(c.definition.ovr)}</strong><small>/10</small></td>
        <td><PlayerForm form={c.form} /></td>
        <td className="squad-num">{c.definition.wage != null ? pediaMoney(c.definition.wage * 100) : '—'}</td>
        <td className="squad-actions">
          <button type="button" className={'cm-btn cm-btn-sm ' + (starters.has(c.id) ? '' : 'cm-btn-primary')} disabled={busy || inSlot} onClick={() => assign(c.id)}
            title={inSlot ? undefined : starters.has(c.id) ? `Swap this starter into slot ${slot + 1}` : `Bring this reserve into slot ${slot + 1}`}>
            {inSlot ? <><Check size={12} aria-hidden="true" />In slot {slot + 1}</> : starters.has(c.id) ? `Move to slot ${slot + 1}` : `Start in slot ${slot + 1}`}
          </button>
          <button type="button" className="cm-btn cm-btn-ghost cm-btn-sm squad-toggle" aria-expanded={expanded} aria-controls={'squad-details-' + c.id} onClick={() => toggle(c.id)}>
            Details <ChevronDown size={13} aria-hidden="true" />
          </button>
        </td>
      </tr>
      {expanded && <tr className="squad-detail-row" id={'squad-details-' + c.id}><td colSpan={5}>
        <PlayerDetails card={c} />
        {!starters.has(c.id) && !saved.some(s => s.instance_id === c.id) && <p className="squad-detail-foot"><a href={'#transfer-exchange?tab=sell&player=' + c.id}>List {c.definition.name} for auction</a></p>}
      </td></tr>}
    </Fragment>;
  };

  return <div className="squad-desk">
    {!fixture && <Readiness cards={cards} lineup={lineup} />}

    <section className="squad-five" aria-labelledby="squad-five-title">
      <header className="squad-section-head"><h3 id="squad-five-title">Starting five</h3><p>Choose a slot, then pick a player from the roster below to fill it. Arrows change the order.</p></header>
      <div className="squad-slots">{lineup.map((s, i) => {
        const c = cards.find(card => card.id === s.instance_id);
        return <div className={'squad-slot ' + (slot === i ? 'selected' : '')} key={i}>
          <button type="button" className="squad-slot__select" aria-pressed={slot === i} onClick={() => setSlot(i)}>
            <span className="squad-slot__number">{i + 1}</span>
            {c && <WorldPlayerPortrait id={c.id} name={c.definition.name} appearance={c.definition.presentation?.appearance} size={44} />}
            <span><strong>{c?.definition.name ?? 'Empty slot'}</strong><small><FpsPlayerRole stats={c?.definition.stats} /></small></span>
            <b>{c ? toScale10(c.definition.ovr) : '—'}<small>OVR</small></b>
          </button>
          <div className="squad-slot__order">
            <button type="button" disabled={busy || i === 0} onClick={() => move(i, i - 1)} aria-label={`Move starter ${i + 1} earlier`}><ArrowLeft size={12} /></button>
            <small>{slot === i ? 'Picking for this slot' : 'Select to replace'}</small>
            <button type="button" disabled={busy || i === 4} onClick={() => move(i, i + 1)} aria-label={`Move starter ${i + 1} later`}><ArrowRight size={12} /></button>
          </div>
        </div>;
      })}</div>
    </section>

    <section className="squad-roster" aria-labelledby="squad-roster-title">
      <header className="squad-section-head"><h3 id="squad-roster-title"><Users size={16} aria-hidden="true" /> Club roster <span className="squad-count">{cards.length}</span></h3></header>
      <FilterBar count={term ? `${shown} of ${cards.length} players` : `${cards.length} players`} active={!!term || sort !== 'overall'} onClear={() => { setSearch(''); setSort('overall'); }}>
        <SearchField label="Search squad" placeholder="Player, role or nationality" value={search} onChange={setSearch} />
        <SelectField label="Sort reserves by" value={sort} onChange={setSort}><option value="overall">Overall</option><option value="form">Form</option><option value="wage">Weekly wage</option><option value="name">Name</option></SelectField>
      </FilterBar>
      {!shown ? <EmptyState title="No players match" action={<button type="button" className="cm-btn" onClick={() => setSearch('')}>Clear search</button>}>Try another name, role or nationality.</EmptyState>
        : <div className="cm-table-wrap"><table className="cm-table squad-table">
          <thead><tr><th scope="col">Player</th><th scope="col">Overall</th><th scope="col">Form</th><th scope="col">Wage / week</th><th scope="col"><span className="sr-only">Actions</span></th></tr></thead>
          {startingRows.length > 0 && <tbody><tr className="squad-group-row"><th colSpan={5} scope="colgroup">Starting five <span>{startingRows.length}</span></th></tr>{startingRows.map(row)}</tbody>}
          {reserveRows.length > 0 && <tbody><tr className="squad-group-row"><th colSpan={5} scope="colgroup">Reserves <span>{reserveRows.length}</span></th></tr>{reserveRows.map(row)}</tbody>}
        </table></div>}
    </section>

    <footer className="squad-save">
      <span role="status">{dirty ? 'You have unsaved changes to the starting five.' : fixture ? 'These are the orders for this fixture.' : 'Starting five saved.'}</span>
      <button type="button" className="cm-btn" disabled={busy || !dirty} onClick={onReset}><RotateCcw size={13} aria-hidden="true" />Undo changes</button>
      <button className="cm-btn cm-btn-primary" disabled={busy || (!dirty && !fixture)}><Save size={13} aria-hidden="true" />{busy ? 'Saving…' : fixture ? 'Save fixture orders' : 'Save starting five'}</button>
    </footer>
  </div>;
}
