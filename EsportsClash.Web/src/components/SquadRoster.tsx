import {Fragment, useState} from 'react';
import {ArrowLeft, ArrowLeftRight, ArrowRight, Check, ChevronDown, CircleAlert, CircleCheck, RotateCcw, Save, ShoppingBag, Users} from 'lucide-react';
import {FpsPlayerRole} from './FpsPlayerRole';
import {fpsRoleFit} from '../fps/fpsRoleFit';
import {FPS_BASE_BEHAVIORAL_PROFILES, fpsBaseProfileId, personalityLabel, type FpsScoutingProfile} from '../fps/fpsIdentity';
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
import {PlayerCard, type CardPlayer} from './game/PlayerCard';
import {HexRadar} from './game/HexRadar';
import {PipMeter} from './game/PipMeter';
import {ATTRIBUTES, RARITY_LABELS, rarityOf, scaledAttributes, type AttributeKey} from './game/positions';
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

const toCardPlayer = (c: SquadCard): CardPlayer => ({
  id: c.id, name: c.definition.name, ovr: c.definition.ovr, stats: c.definition.stats, nationality: c.definition.nationality,
  appearance: c.definition.presentation?.appearance, positions: c.definition.fpsIdentity?.assignments ?? undefined,
});

const goToTactics = () => document.getElementById('tactical-system')?.scrollIntoView({behavior: 'smooth', block: 'start'});

/** The team at a glance: rating, shape across the six attributes, and whether it may play official games. */
function TeamHero({cards, lineup}: {cards: SquadCard[]; lineup: Slot[]}) {
  const r = lineupReadiness(cards, lineup);
  const five = lineup.map(s => cards.find(c => c.id === s.instance_id)).filter((c): c is SquadCard => !!c);
  const rating = five.length ? five.reduce((sum, c) => sum + toScale10(c.definition.ovr), 0) / five.length : 0;
  const average: Partial<Record<AttributeKey, number>> = {};
  for (const {key} of ATTRIBUTES) {
    const values = five.map(c => scaledAttributes(c.definition.stats)[key]).filter((v): v is number => v != null);
    if (values.length) average[key] = values.reduce((a, b) => a + b, 0) / values.length;
  }
  const best = ATTRIBUTES.filter(a => average[a.key] != null).sort((a, b) => average[b.key]! - average[a.key]!)[0];
  const tier = rarityOf(Math.round(rating));
  const circumference = 2 * Math.PI * 44;
  return <section className={`team-hero is-${tier}`} aria-label="Team overview">
    <div className="team-hero__rating">
      <svg viewBox="0 0 100 100" width="112" height="112" aria-hidden="true">
        <circle cx="50" cy="50" r="44" className="team-hero__track" />
        <circle cx="50" cy="50" r="44" className="team-hero__progress" style={{strokeDasharray: `${circumference * rating / 10} ${circumference}`}} />
      </svg>
      <div><b>{rating.toFixed(1)}</b><small>Team rating</small></div>
      <span className="team-hero__tier">{RARITY_LABELS[tier]} squad</span>
    </div>
    <div className="team-hero__shape">
      <HexRadar values={average} size={176} labels />
      {best && <p>Strongest at <strong>{best.label}</strong></p>}
    </div>
    <div className="team-hero__ready">
      <span className={'team-hero__status' + (r.ready ? ' is-ready' : '')}>{r.ready ? <CircleCheck size={15} aria-hidden="true" /> : <CircleAlert size={15} aria-hidden="true" />}{r.ready ? 'Match ready' : 'Not match ready'}</span>
      <PipMeter label="Starters" value={r.distinct} />
      <PipMeter label="T positions" value={r.t} color="#e8a948" />
      <PipMeter label="CT positions" value={r.ct} color="#5aa9ff" />
      {!r.ready && <button type="button" className="cm-btn cm-btn-sm cm-btn-primary" onClick={goToTactics}>Set positions <ArrowRight size={13} aria-hidden="true" /></button>}
    </div>
  </section>;
}

/** The back of a card: who the player is, beyond the numbers. */
function CardBack({card, sellable}: {card: SquadCard; sellable: boolean}) {
  const profile = card.definition.fpsIdentity, p = profile?.personality;
  const notes = (profile?.top_tendencies ?? []).filter(t => t.value <= 4 || t.value >= 7).slice(0, 3);
  return <div className="card-back">
    {p ? <p className="card-back__persona" title={FPS_BASE_BEHAVIORAL_PROFILES[fpsBaseProfileId(p) - 1]?.tendency}>{[p.temperament, p.playstyle, p.mindset, p.decisionStyle].map(personalityLabel).join(' · ')}</p> : <p className="squad-muted">Not scouted yet.</p>}
    {notes.length > 0 && <ul className="card-back__tends">{notes.map(t => <li key={t.key}><span>{t.label}</span><b>{t.value}</b></li>)}</ul>}
    <dl className="card-back__facts">
      <div><dt>Form</dt><dd><PlayerForm form={card.form} /></dd></div>
      <div><dt>Wage</dt><dd>{card.definition.wage != null ? pediaMoney(card.definition.wage * 100) + ' / wk' : '—'}</dd></div>
    </dl>
    <div className="card-back__links"><a href={pediaHref('players', card.id)}>Full record</a>{sellable && <a href={'#transfer-exchange?tab=sell&player=' + card.id}>Sell</a>}</div>
  </div>;
}

/**
 * Squad: the team at a glance, the starting five as cards, the bench, then a searchable roster list.
 * Click a starter and then a bench player, or drag a bench card onto a starter, to make a change.
 */
export function SquadRoster({cards, lineup, saved, onChange, busy, onReset, fixture = false}: {cards: SquadCard[]; lineup: Slot[]; saved: Slot[]; onChange: (slots: Slot[]) => void; busy: boolean; onReset: () => void; fixture?: boolean}) {
  const [slot, setSlot] = useState(0), [search, setSearch] = useState(''), [sort, setSort] = useState('overall');
  const [open, setOpen] = useState<Set<string>>(() => new Set());
  const dirty = JSON.stringify(lineup) !== JSON.stringify(saved);
  const starterIds = lineup.map(s => s.instance_id);
  const starters = new Set(starterIds);
  const assignTo = (target: number, id: string) => {
    if (busy) return;
    const next = lineup.map(s => ({...s})), existing = next.findIndex(s => s.instance_id === id);
    if (existing === target) return;
    if (existing >= 0) [next[target], next[existing]] = [next[existing], next[target]]; else next[target] = {instance_id: id};
    onChange(next);
    setSlot(target);
  };
  const assign = (id: string) => assignTo(slot, id);
  const move = (from: number, to: number) => { const next = [...lineup]; [next[from], next[to]] = [next[to], next[from]]; onChange(next); setSlot(to); };
  const toggle = (id: string) => setOpen(prev => { const next = new Set(prev); if (next.has(id)) next.delete(id); else next.add(id); return next; });
  const term = search.trim().toLowerCase();
  const matches = (c: SquadCard) => !term || [c.definition.name, fpsRoleFit(c.definition.stats), c.definition.nationality?.name].join(' ').toLowerCase().includes(term);
  const order = (a: SquadCard, b: SquadCard) => sort === 'overall' ? b.definition.ovr - a.definition.ovr : sort === 'form' ? (b.form?.score ?? -1) - (a.form?.score ?? -1) : sort === 'wage' ? (b.definition.wage ?? 0) - (a.definition.wage ?? 0) : a.definition.name.localeCompare(b.definition.name);
  const startingRows = starterIds.map(id => cards.find(c => c.id === id)).filter((c): c is SquadCard => !!c && matches(c));
  const reserves = cards.filter(c => !starters.has(c.id)).sort(order);
  const reserveRows = reserves.filter(matches);
  const shown = startingRows.length + reserveRows.length;
  const slotOf = (id: string) => starterIds.indexOf(id);
  const selectedCard = cards.find(c => c.id === lineup[slot]?.instance_id);
  const sellable = (c: SquadCard) => !starters.has(c.id) && !saved.some(s => s.instance_id === c.id);

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
      {expanded && <tr className="squad-detail-row" id={'squad-details-' + c.id}><td colSpan={5}><CardBack card={c} sellable={sellable(c)} /></td></tr>}
    </Fragment>;
  };

  return <div className="squad-desk">
    {!fixture && <TeamHero cards={cards} lineup={lineup} />}

    <section className="squad-five" aria-labelledby="squad-five-title">
      <header className="squad-section-head squad-section-head--row">
        <h3 id="squad-five-title">Starting five</h3>
        <p className="squad-hint" aria-live="polite">{selectedCard ? <>Replacing <strong>#{slot + 1} {selectedCard.definition.name}</strong>: pick a bench player, or drag one onto any card.</> : 'Pick a slot to fill.'}</p>
      </header>
      <div className="squad-five__cards">{lineup.map((s, i) => {
        const c = cards.find(card => card.id === s.instance_id);
        if (!c) return <button type="button" key={'empty' + i} className={'squad-empty-slot' + (slot === i ? ' is-selected' : '')} onClick={() => setSlot(i)}><span>#{i + 1}</span>Empty slot</button>;
        return <div className="squad-five__slot" key={c.id} style={{animationDelay: `${i * 60}ms`}}>
          <PlayerCard className="is-new" size="lg" player={toCardPlayer(c)} slot={i + 1} selected={slot === i} onSelect={() => setSlot(i)} selectLabel={`Select slot ${i + 1}, ${c.definition.name}`}
            dragData={c.id} onDropPlayer={id => assignTo(i, id)} back={<CardBack card={c} sellable={false} />} />
          <div className="squad-five__order">
            <button type="button" disabled={busy || i === 0} onClick={() => move(i, i - 1)} aria-label={`Move ${c.definition.name} earlier`}><ArrowLeft size={13} /></button>
            <button type="button" disabled={busy || i === 4} onClick={() => move(i, i + 1)} aria-label={`Move ${c.definition.name} later`}><ArrowRight size={13} /></button>
          </div>
        </div>;
      })}</div>
    </section>

    <section className="squad-bench" aria-labelledby="squad-bench-title">
      <header className="squad-section-head squad-section-head--row">
        <h3 id="squad-bench-title"><Users size={16} aria-hidden="true" /> Bench <span className="squad-count">{reserves.length}</span></h3>
        {reserves.length > 0 && <a className="squad-link" href="#transfer-exchange"><ShoppingBag size={13} aria-hidden="true" /> Find more players</a>}
      </header>
      {reserves.length ? <div className="squad-bench__cards">{reserves.map(c => {
        const inSlot = lineup[slot]?.instance_id === c.id;
        const better = selectedCard ? toScale10(c.definition.ovr) - toScale10(selectedCard.definition.ovr) : 0;
        return <PlayerCard key={c.id} size="md" player={toCardPlayer(c)} dragData={c.id} back={<CardBack card={c} sellable={sellable(c)} />}
          ribbon={better > 0 ? `+${better} on #${slot + 1}` : undefined}
          footer={<button type="button" className={"cm-btn cm-btn-sm squad-sub"+(better>0?" is-upgrade":"")} disabled={busy || inSlot || !selectedCard} onClick={() => assign(c.id)}>
            <ArrowLeftRight size={12} aria-hidden="true" />{selectedCard ? `Sub in for #${slot + 1}` : 'Sub in'}</button>} />;
      })}</div>
        : <div className="squad-bench__empty">
          <p><strong>No one on the bench.</strong> Injuries, form slumps and fixture pile-ups hurt a five with no cover.</p>
          <a className="cm-btn cm-btn-primary cm-btn-sm" href="#transfer-exchange"><ShoppingBag size={13} aria-hidden="true" /> Sign a player</a>
        </div>}
    </section>

    <details className="squad-list">
      <summary><ChevronDown size={14} aria-hidden="true" /> Roster list <span className="squad-count">{cards.length}</span><small>Search, sort and compare everyone</small></summary>
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
    </details>

    <footer className={'squad-save' + (dirty || fixture ? ' is-visible' : '')} aria-hidden={!(dirty || fixture)}>
      <span role="status">{dirty ? 'Lineup changed' : fixture ? 'Orders for this fixture' : 'Starting five saved'}</span>
      <button type="button" className="cm-btn cm-btn-ghost" disabled={busy || !dirty} onClick={onReset} tabIndex={dirty ? 0 : -1}><RotateCcw size={13} aria-hidden="true" />Undo</button>
      <button className="cm-btn cm-btn-primary" disabled={busy || (!dirty && !fixture)} tabIndex={dirty || fixture ? 0 : -1}><Save size={13} aria-hidden="true" />{busy ? 'Saving…' : fixture ? 'Save fixture orders' : 'Save starting five'}</button>
    </footer>
  </div>;
}
