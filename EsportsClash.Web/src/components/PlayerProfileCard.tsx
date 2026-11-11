import type { ReactNode } from 'react';
import type { PlayerCard } from '../types';
import { avatarDisplayName } from '../avatarDisplayName';
import { toScale10 } from '../marketBatchEngine';
import { CHAMPIONS, INITIAL_PLAYERS } from '../mockData';
import { pediaHref } from '../hexapedia';
import { ChibiAvatar } from './ChibiAvatar';
import './player-card.css';
import {FPS_ATTRIBUTE_LABELS} from '../fps/fpsPersonality';
import {PersonalityMarks} from './PersonalityMarks';
import {FpsIdentityMarks} from './FpsIdentityMarks';
import {fpsRoleFit} from '../fps/fpsRoleFit';
import {useGameModes} from '../gameModes';

interface Props {
  card: PlayerCard;
  onClick?: () => void;
  selected?: boolean;
  compact?: boolean;
  jerseyNumber?: number;
  shirtNumber?: number;
  actionSlot?: ReactNode;
}

const attributes = Object.entries(FPS_ATTRIBUTE_LABELS) as [keyof PlayerCard['stats'], string][];

export function PlayerProfileCard({ card, onClick, selected, compact, jerseyNumber, shirtNumber, actionSlot }: Props) {
  const modes=useGameModes();
  const number = shirtNumber ?? jerseyNumber;
  const role = card.preferredRole ?? card.role;
  const signature = card.signatureChampions.slice(0, 2).map(name => avatarDisplayName(name, CHAMPIONS));
  const catalogPlayer = INITIAL_PLAYERS.find(player => player.id === card.id || player.name === card.name);
  return <article className={`player-card${compact ? ' player-card--compact' : ''}${selected ? ' player-card--selected' : ''}`}>
    <div className="player-card__profile" role={onClick ? 'button' : undefined} tabIndex={onClick ? 0 : undefined}
      aria-pressed={onClick ? Boolean(selected) : undefined} onClick={onClick} onKeyDown={onClick ? event => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          onClick();
        }
      } : undefined}>
      <header className="player-card__header">
        <div className="player-card__portrait" aria-hidden="true"><ChibiAvatar avatarType={card.avatarSvg || card.name} size={compact ? 44 : 58} /></div>
        <div className="player-card__identity">
          <h3>{number !== undefined && <span className="player-card__number">{number} </span>}{card.name}</h3>
          <p>{fpsRoleFit(card.stats)}{card.age === undefined ? '' : ` · Age ${card.age}`}{card.nationality?' · '+card.nationality.name:''}</p>
        </div>
        <div className="player-card__rating"><strong>{toScale10(card.ovr)}/10</strong><span>Overall</span></div>
      </header>
      {card.fpsIdentity?<FpsIdentityMarks profile={card.fpsIdentity}/>:<PersonalityMarks primary={card.primaryPersonality} secondary={card.secondaryPersonality} compact={compact}/>}
      <dl className="player-card__attributes">
        {attributes.map(([key, label]) => {
          const value = toScale10(card.stats[key] ?? 55);
          return <div key={key} className="player-card__attribute">
            <dt>{label}</dt>
            <dd><meter min={0} max={10} value={value} aria-label={label} /><span>{value}/10</span></dd>
          </div>;
        })}
      </dl>
      {modes.moba_enabled && !compact && signature.length > 0 && <p className="player-card__signature">Signature avatars · {signature.join(', ')}</p>}
    </div>
    {actionSlot && <div className="player-card__actions">{actionSlot}</div>}
    {!compact && catalogPlayer && <footer className="player-card__reference"><a href={pediaHref('players', catalogPlayer.id)}>Hexapedia profile</a></footer>}
  </article>;
}
