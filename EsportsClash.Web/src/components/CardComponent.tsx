import React from 'react';
import type { PlayerAttributes, PlayerCard } from '../types';
import { Check, Crown, Sparkles } from 'lucide-react';
import { CHAMPIONS } from '../mockData';
import { avatarDisplayName } from '../avatarDisplayName';
import { PERSONALITIES, personalityOf } from '../playerPersonality';
import { portraitPosition } from '../playerPortraits';
import './player-card.css';

interface CardComponentProps {
  card: PlayerCard;
  onClick?: () => void;
  compact?: boolean;
  selected?: boolean;
}

const attributes: { key: keyof PlayerAttributes; label: string }[] = [
  { key: 'lan', label: 'Mechanics' }, { key: 'tf', label: 'Teamfight' },
  { key: 'iq', label: 'Game sense' }, { key: 'clu', label: 'Clutch' },
  { key: 'sta', label: 'Stamina' }, { key: 'flx', label: 'Flexibility' },
];

/** Presentation only: ratings, card identity and gameplay attributes remain authored data. */
export const CardComponent: React.FC<CardComponentProps> = ({ card, onClick, compact = false, selected = false }) => {
  const roles = card.playableRoles?.length ? card.playableRoles : [card.preferredRole || card.role || 'Pro'];
  const traits = personalityOf(card).filter((trait): trait is NonNullable<typeof trait> => !!trait);
  const signatures = card.signatureChampions.slice(0, 2).map(name => avatarDisplayName(name, CHAMPIONS)).join(' · ') || 'Flexible';
  const portrait = portraitPosition(card.avatarSvg);
  const xp = card.maxXp > 0 ? Math.max(0, Math.min(100, card.currentXp / card.maxXp * 100)) : 0;
  return (
    <div role={onClick ? 'button' : undefined} tabIndex={onClick ? 0 : undefined}
      onClick={onClick} aria-pressed={onClick ? selected : undefined}
      aria-label={onClick ? `${card.name}, ${card.ovr} overall, ${roles.join(', ')}, ${card.tier}${selected ? ', selected' : ''}` : undefined}
      onKeyDown={onClick ? event => {
        if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); onClick(); }
      } : undefined}
      data-tier={card.tier.toLowerCase()} data-evolved={card.isEvo || undefined}
      className={`player-card${compact ? ' player-card--compact' : ''}${selected ? ' player-card--selected' : ''}${onClick ? ' player-card--interactive' : ''}`}>
      <div className="player-card__edition">
        <span>CLASH <span className="player-card__edition-divider">/</span> PLAYER SERIES</span>
        {card.isEvo ? <span className="player-card__evo"><Sparkles size={10} /> EVO {card.evolutionLevel || 1}</span>
          : <span>{card.tier === 'GOAT' ? <Crown size={12} /> : '◆'} {card.tier}</span>}
      </div>
      <div className="player-card__hero">
        <div className="player-card__portrait" aria-hidden="true" style={portrait
          ? { backgroundImage: `url('${import.meta.env.BASE_URL}images/player-portraits-v1.png')`, backgroundPosition: portrait }
          : undefined}>
          {!portrait && <span className="player-card__monogram">{card.name.slice(0, 2).toUpperCase()}</span>}
        </div>
        <div className="player-card__rating"><strong>{card.ovr}</strong><span>OVERALL</span></div>
        <span className="player-card__origin">{card.origin}</span>
        {selected && <span className="player-card__selected"><Check size={12} /> Selected</span>}
        <div className="player-card__identity">
          <span className="player-card__role" title={roles.join(' · ')}>{roles.join(' · ')}</span>
          <h3 title={card.name}>{card.name}</h3>
        </div>
      </div>
      {!compact && <div className="player-card__specialty" title={signatures}><span>Signature avatars</span><strong>{signatures}</strong></div>}
      <dl className="player-card__stats">
        {(compact ? attributes.filter(({ key }) => key === 'lan' || key === 'tf' || key === 'iq') : attributes).map(({ key, label }) => (
          <div key={key}><dt>{label}</dt><dd>{card.stats[key]}</dd></div>
        ))}
      </dl>
      {!compact && <div className="player-card__traits" aria-label="Player personality">
        {traits.map((trait, i) => <span key={trait} title={`${i === 0 ? 'Primary' : 'Secondary'} personality: ${PERSONALITIES[trait].description} Strengths: ${PERSONALITIES[trait].strengths.join(', ')}. Risks: ${PERSONALITIES[trait].weaknesses.join(', ')}.`}>
          <span aria-hidden="true">{i === 0 ? '◆' : '◇'}</span> {PERSONALITIES[trait].name}
        </span>)}
      </div>}
      <div className="player-card__footer"><span>LVL <strong>{card.level}</strong></span><span>{compact ? card.tier : `${card.currentXp.toLocaleString()} / ${card.maxXp.toLocaleString()} XP`}</span></div>
      {!compact && <div className="player-card__xp" role="progressbar" aria-label={`${card.name} level progress`} aria-valuenow={Math.round(xp)} aria-valuemin={0} aria-valuemax={100}><span style={{ width: `${xp}%` }} /></div>}
    </div>
  );
};
