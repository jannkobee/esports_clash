import {useState, type DragEvent} from 'react';
import {Shield, Swords, Wand2, X} from 'lucide-react';
import type {PlayerAppearance} from '../../supporter';
import {WorldPlayerPortrait} from '../WorldPlayerPortrait';
import {POSITIONS, SIDE_POSITIONS, positionFit, type Position, type Side} from './positions';
import './game.css';
import './tactics-board.css';

export interface BoardPlayer {id: string; name: string; stats?: Partial<Record<string, number>>; appearance?: PlayerAppearance}
export type BoardAssignments = Record<string, {t?: Position; ct?: Position}>;

const DRAG = 'text/hexatrick-board';

/**
 * The tactics board: the five positions of one side placed where they play, sites at the top.
 * Click a position to choose who plays it (ranked by strength fit), or drag players between positions.
 * Positions stay unique: placing a player on a taken position swaps the two.
 */
export function TacticsBoard({players, assignments, onAssign, onSuggest, busy}: {
  players: BoardPlayer[];
  assignments: BoardAssignments;
  onAssign: (side: Side, position: Position, playerId: string | null) => void;
  onSuggest?: () => void;
  busy?: boolean;
}) {
  const [side, setSide] = useState<Side>('t');
  const [picking, setPicking] = useState<Position | null>(null);
  const [over, setOver] = useState<Position | null>(null);
  const holder = (position: Position) => players.find(p => assignments[p.id]?.[side] === position);
  const placed = SIDE_POSITIONS[side].filter(holder).length;
  const unplaced = players.filter(p => !assignments[p.id]?.[side]);
  const count = (s: Side) => SIDE_POSITIONS[s].filter(pos => players.some(p => assignments[p.id]?.[s] === pos)).length;
  const place = (position: Position, id: string | null) => { if (busy) return; onAssign(side, position, id); setPicking(null); };
  const dropOn = (position: Position) => ({
    onDragOver: (e: DragEvent) => { if (!e.dataTransfer.types.includes(DRAG)) return; e.preventDefault(); setOver(position); },
    onDragLeave: () => setOver(null),
    onDrop: (e: DragEvent) => { e.preventDefault(); setOver(null); const id = e.dataTransfer.getData(DRAG); if (id) place(position, id); },
  });
  const drag = (id: string) => ({draggable: !busy, onDragStart: (e: DragEvent) => { e.dataTransfer.setData(DRAG, id); e.dataTransfer.effectAllowed = 'move'; }});
  const pickMeta = picking ? POSITIONS[picking] : null;
  const ranked = picking ? [...players].sort((a, b) => positionFit(b.stats, picking) - positionFit(a.stats, picking)) : [];
  const bestFit = ranked.length && picking ? positionFit(ranked[0].stats, picking) : 0;

  return (
    <div className={`tactics-board is-side-${side}`}>
      <div className="tactics-board__bar">
        <div className="tactics-board__sides" role="tablist" aria-label="Side">
          {(['t', 'ct'] as const).map(s => <button key={s} type="button" role="tab" aria-selected={side === s} className={'is-side-' + s} onClick={() => { setSide(s); setPicking(null); }}>
            {s === 't' ? <Swords size={14} aria-hidden="true" /> : <Shield size={14} aria-hidden="true" />}{s === 't' ? 'Attack (T)' : 'Defence (CT)'}<b className={count(s) === 5 ? 'is-full' : ''}>{count(s)}/5</b>
          </button>)}
        </div>
        {onSuggest && <button type="button" className="cm-btn cm-btn-sm" disabled={busy} onClick={onSuggest}><Wand2 size={13} aria-hidden="true" />Auto-fill from strengths</button>}
      </div>

      <div className="tactics-board__stage">
        <div className="tactics-board__field" aria-label={`${side === 't' ? 'Attack' : 'Defence'} positions, ${placed} of 5 filled`} role="group">
          <svg className="tactics-board__map" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
            <rect x="6" y="6" width="28" height="24" rx="3" className="site" /><rect x="66" y="6" width="28" height="24" rx="3" className="site" />
            <path d="M20 30 V60 Q20 80 40 88 H60 Q80 80 80 60 V30" className="lane" />
            <path d="M50 88 V12" className="lane lane--mid" />
            <path d="M34 40 H66" className="lane lane--link" />
          </svg>
          <span className="board-label board-label--site" style={{left: '20%', top: '18%'}} aria-hidden="true">A</span>
          <span className="board-label board-label--site" style={{left: '80%', top: '18%'}} aria-hidden="true">B</span>
          <span className="board-label board-label--mid" style={{left: '50%', top: '52%'}} aria-hidden="true">Mid</span>
          <span className="board-label board-label--spawn" style={{left: '50%', top: side === 't' ? '95%' : '4%'}} aria-hidden="true">{side === 't' ? 'T spawn' : 'CT spawn'}</span>
          {SIDE_POSITIONS[side].map(position => {
            const meta = POSITIONS[position], Icon = meta.icon, p = holder(position), fit = p ? positionFit(p.stats, position) : 0;
            return <button key={position} type="button" style={{left: meta.x + '%', top: meta.y + '%'}}
              className={'board-node' + (p ? ' is-filled' : '') + (picking === position ? ' is-picking' : '') + (over === position ? ' is-over' : '')}
              aria-label={`${meta.label}: ${p ? p.name + `, fit ${fit} of 10` : 'empty'}. Choose who plays it.`} aria-pressed={picking === position}
              onClick={() => setPicking(picking === position ? null : position)} {...dropOn(position)} {...(p ? drag(p.id) : {})}>
              <span className="board-node__ring">{p ? <WorldPlayerPortrait id={p.id} name={p.name} appearance={p.appearance} size={50} /> : <Icon size={22} aria-hidden="true" />}
                {p && <span className="board-node__icon"><Icon size={11} aria-hidden="true" /></span>}
                {p && <span className={'board-node__fit' + (fit >= 7 ? ' is-high' : fit <= 3 ? ' is-low' : '')}>{fit}</span>}</span>
              <span className="board-node__label">{meta.short}</span>
              <span className="board-node__name">{p ? p.name : 'Choose'}</span>
            </button>;
          })}
        </div>

        <aside className="tactics-board__panel" aria-live="polite">
          {pickMeta && picking ? <>
            <header><span className="board-panel__icon"><pickMeta.icon size={16} aria-hidden="true" /></span><div><strong>{pickMeta.label}</strong><small>{pickMeta.job}</small></div>
              <button type="button" className="board-panel__close" aria-label="Close" onClick={() => setPicking(null)}><X size={14} /></button></header>
            <ul className="board-pick">{ranked.map(p => {
              const fit = positionFit(p.stats, picking), current = assignments[p.id]?.[side], here = current === picking;
              return <li key={p.id}><button type="button" disabled={busy || here} onClick={() => place(picking, p.id)} className={here ? 'is-here' : ''}>
                <WorldPlayerPortrait id={p.id} name={p.name} appearance={p.appearance} size={30} />
                <span className="board-pick__who"><b>{p.name}</b><small>{here ? 'Plays here' : current ? `Now ${POSITIONS[current].short}` : 'No position yet'}</small></span>
                <span className="board-pick__fit"><span><i style={{width: fit * 10 + '%'}} className={fit === bestFit ? 'is-best' : ''} /></span><b>{fit}</b></span>
              </button></li>;
            })}</ul>
            {holder(picking) && <button type="button" className="cm-btn cm-btn-ghost cm-btn-sm" disabled={busy} onClick={() => place(picking, null)}>Clear {pickMeta.short}</button>}
            <p className="board-panel__note">Fit is strength only, from 1 to 10. Personality still shapes how each player plays the job.</p>
          </> : <>
            <header><div><strong>{placed === 5 ? 'Side complete' : `${5 - placed} to place`}</strong><small>Tap a position on the board, or drag a player onto it.</small></div></header>
            {unplaced.length > 0 ? <ul className="board-tray">{unplaced.map(p => <li key={p.id} {...drag(p.id)}><WorldPlayerPortrait id={p.id} name={p.name} appearance={p.appearance} size={30} /><b>{p.name}</b></li>)}</ul>
              : <p className="board-panel__done">Every starter has a {side === 't' ? 'T' : 'CT'} position. Switch sides to check the other half.</p>}
          </>}
        </aside>
      </div>
    </div>
  );
}
