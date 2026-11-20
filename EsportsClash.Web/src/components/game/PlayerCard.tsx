import {useRef, useState, type DragEvent, type PointerEvent, type ReactNode} from 'react';
import {RotateCw} from 'lucide-react';
import type {PlayerAppearance} from '../../supporter';
import {fpsScale10} from '../../fps/fpsScale10';
import {CountryFlag} from '../CountryFlag';
import {WorldPlayerPortrait} from '../WorldPlayerPortrait';
import './game.css';
import {ATTRIBUTES, POSITIONS, RARITY_LABELS, rarityOf, scaledAttributes, type AttributeKey, type Position} from './positions';

export interface CardPlayer {
  id: string;
  name: string;
  /** Internal 0–100 overall; shown on the 1–10 scale. */
  ovr: number;
  stats?: Partial<Record<string, number>>;
  nationality?: {code: string; name: string};
  appearance?: PlayerAppearance;
  positions?: {t?: Position; ct?: Position};
}

/** The big rating number with its tier colour. */
export function RatingBadge({level, size = 'md'}: {level: number; size?: 'sm' | 'md' | 'lg'}) {
  return <span className={`rating-badge rating-badge--${size} is-${rarityOf(level)}`} title={`${RARITY_LABELS[rarityOf(level)]} · ${level}/10 overall`}><b>{level}</b><small>OVR</small></span>;
}

const reducedMotion = () => typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

/**
 * A collectible-style player card: tier, rating, portrait, six attributes and positions.
 * Optional: selection, a slot number, a flip side, drag and drop, attribute deltas against a comparison.
 */
export function PlayerCard({player, size = 'md', selected, slot, onSelect, selectLabel, back, footer, ribbon, deltas, dragData, onDropPlayer, className = ''}: {
  player: CardPlayer;
  size?: 'sm' | 'md' | 'lg';
  selected?: boolean;
  slot?: number;
  onSelect?: () => void;
  selectLabel?: string;
  back?: ReactNode;
  footer?: ReactNode;
  ribbon?: ReactNode;
  deltas?: Partial<Record<AttributeKey, number>>;
  dragData?: string;
  onDropPlayer?: (id: string) => void;
  className?: string;
}) {
  const level = fpsScale10(player.ovr), rarity = rarityOf(level), attrs = scaledAttributes(player.stats);
  const [flipped, setFlipped] = useState(false), [dropping, setDropping] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const tilt = (event: PointerEvent<HTMLDivElement>) => {
    if (size === 'sm' || reducedMotion() || !ref.current) return;
    const box = ref.current.getBoundingClientRect();
    ref.current.style.setProperty('--rx', `${((event.clientY - box.top) / box.height - 0.5) * -8}deg`);
    ref.current.style.setProperty('--ry', `${((event.clientX - box.left) / box.width - 0.5) * 10}deg`);
    ref.current.style.setProperty('--mx', `${((event.clientX - box.left) / box.width) * 100}%`);
  };
  const untilt = () => { ref.current?.style.setProperty('--rx', '0deg'); ref.current?.style.setProperty('--ry', '0deg'); };
  const drop = {
    onDragOver: (e: DragEvent) => { if (!onDropPlayer || !e.dataTransfer.types.includes('text/hexatrick-player')) return; e.preventDefault(); e.dataTransfer.dropEffect = 'move'; setDropping(true); },
    onDragLeave: () => setDropping(false),
    onDrop: (e: DragEvent) => { setDropping(false); const id = e.dataTransfer.getData('text/hexatrick-player'); if (id && onDropPlayer) { e.preventDefault(); onDropPlayer(id); } },
  };
  return (
    <div ref={ref} className={`player-card player-card--${size} is-${rarity}${selected ? ' is-selected' : ''}${flipped ? ' is-flipped' : ''}${dropping ? ' is-drop-target' : ''} ${className}`}
      onPointerMove={tilt} onPointerLeave={untilt} {...drop}
      draggable={!!dragData} onDragStart={dragData ? e => { e.dataTransfer.setData('text/hexatrick-player', dragData); e.dataTransfer.effectAllowed = 'move'; } : undefined}>
      <div className="player-card__inner">
        <div className="player-card__face">
          <div className="player-card__art">
            <RatingBadge level={level} size={size === 'lg' ? 'lg' : size === 'sm' ? 'sm' : 'md'} />
            <span className="player-card__tier">{RARITY_LABELS[rarity]}</span>
            {slot != null && <span className="player-card__slot">#{slot}</span>}
            {player.nationality && <span className="player-card__flag"><CountryFlag code={player.nationality.code} name={player.nationality.name} /></span>}
            <span className="player-card__portrait"><WorldPlayerPortrait id={player.id} name={player.name} appearance={player.appearance} size={size === 'lg' ? 156 : size === 'sm' ? 84 : 146} /></span>
            {ribbon && <span className="player-card__ribbon">{ribbon}</span>}
          </div>
          <div className="player-card__body">
            <strong className="player-card__name" title={player.name}>{player.name}</strong>
            {size !== 'sm' && <dl className="player-card__stats">{ATTRIBUTES.map(a => {
              const v = attrs[a.key], d = deltas?.[a.key] ?? 0;
              return <div key={a.key} className={v == null ? '' : v >= 7 ? 'is-high' : v <= 3 ? 'is-low' : ''}><dt>{a.short}</dt><dd>{v ?? '–'}{d !== 0 && <i className={d > 0 ? 'is-up' : 'is-down'} aria-label={d > 0 ? `${d} better` : `${-d} worse`}>{d > 0 ? `+${d}` : d}</i>}</dd></div>;
            })}</dl>}
            {(player.positions?.t || player.positions?.ct) && size !== 'sm' && <div className="player-card__positions">{(['t', 'ct'] as const).map(side => {
              const p = player.positions?.[side]; if (!p) return null; const meta = POSITIONS[p], Icon = meta.icon;
              return <span key={side} className={'position-chip is-' + side} title={`${side.toUpperCase()} · ${meta.label}`}><Icon size={11} aria-hidden="true" />{meta.short}</span>;
            })}</div>}
            {footer}
          </div>
          {onSelect && <button type="button" className="player-card__hit" aria-pressed={selected} aria-label={selectLabel ?? `Select ${player.name}`} onClick={onSelect} />}
          {back && <button type="button" className="player-card__flip" aria-label={`Show ${player.name}'s profile`} onClick={() => setFlipped(true)}><RotateCw size={12} aria-hidden="true" /></button>}
        </div>
        {back && <div className="player-card__back" aria-hidden={!flipped}>
          <div className="player-card__back-head"><strong>{player.name}</strong><button type="button" className="player-card__flip is-back" aria-label="Show the card front" onClick={() => setFlipped(false)} tabIndex={flipped ? 0 : -1}><RotateCw size={12} aria-hidden="true" /></button></div>
          {back}
        </div>}
      </div>
    </div>
  );
}
