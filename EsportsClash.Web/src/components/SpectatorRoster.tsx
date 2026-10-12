import type { AramChampionUnit, ItemDef } from '../types';
import { ChampionArtwork } from './ChampionArtwork';
import { maxMana } from '../abilityRules';
import { KAELEN_INVOKED_SPELLS } from '../kaelenAbilities';

export function SpectatorRoster({ units, team, onItem, onFocus, xpProgress, second }: {
  units: AramChampionUnit[]; team: 'blue' | 'red'; onItem: (item: ItemDef) => void;
  onFocus: (unit: AramChampionUnit) => void;
  xpProgress: (unit: AramChampionUnit) => number; second: number;
}) {
  return <div className={`spectator-roster ${team}`} aria-label={`${team} squad status and item inventory`}>
    {units.map(unit => <div className={`spectator-unit ${unit.isAlive ? '' : 'fallen'}`} key={unit.id}>
      <button className="spectator-portrait" onClick={() => onFocus(unit)} title={`Follow ${unit.player.name} / ${unit.champion.displayName}, ${unit.champion.title}`}>
        <ChampionArtwork championId={unit.champion.id} size={29} className="h-full w-full" />
        <span>{unit.isAlive ? unit.level : `${Math.ceil(unit.respawnTimer)}s`}</span>
      </button>
      <div className="spectator-vitals">
        <div className="spectator-name"><b>{unit.player.name}</b><span title={`${unit.champion.displayName} — ${unit.champion.title}`}>{unit.champion.displayName}</span></div>
        <div className="spectator-health" role="meter" aria-label={`${unit.player.name} health`} aria-valuenow={Math.round(unit.hp)} aria-valuemin={0} aria-valuemax={Math.round(unit.maxHp)}
          title={`${Math.ceil(unit.hp)}/${Math.ceil(unit.maxHp)} HP · ${Math.ceil(unit.shield)} shield`}>
          <i style={{ width: `${Math.max(0, Math.min(100, unit.hp / unit.maxHp * 100))}%` }} />
          {unit.shield > 0 && <em style={{ width: `${Math.min(100, unit.shield / unit.maxHp * 100)}%` }} />}
        </div>
        <div className="spectator-mana" title={`${Math.ceil(unit.mana)}/${maxMana(unit)} mana`}><i style={{ width: `${Math.max(0, Math.min(100, unit.mana / maxMana(unit) * 100))}%` }} /></div>
        <div className="spectator-xp" title={`Level ${unit.level} · ${Math.round(xpProgress(unit) * 100)}% to next level`}><i style={{ width: `${xpProgress(unit) * 100}%` }} /></div>
      </div>
      <div className="spectator-kda" title={`${unit.kills} kills / ${unit.deaths} deaths / ${unit.assists} assists · ${unit.cs} CS · ${Math.floor(unit.gold)} gold`}>
        <b>{unit.kills}/{unit.deaths}/{unit.assists}</b><span>{unit.cs} CS · {Math.floor(unit.gold)}g</span>
      </div>
      <div className="spectator-skills" aria-label={`${unit.player.name} ability cooldowns`}>
        {unit.champion.name === 'Kaelen' ? ['D', 'F'].map((slot, index) => {
          const spell = KAELEN_INVOKED_SPELLS.find(s => s.id === unit.kaelenInvokedSlots?.[index]);
          const cd = spell ? unit.kaelenSpellCooldowns?.[spell.id] ?? 0 : -1;
          return <span key={slot} className={cd === 0 ? 'ready' : ''} title={`${slot}: ${spell?.name ?? 'Empty invocation'}${spell ? ` · ${Math.ceil(cd)}s` : ''}`}>{cd > 0 ? Math.ceil(cd) : slot}</span>;
        }) : [unit.cd1, unit.cd2, unit.cdUlt].map((cd, index) => <span key={index} className={cd <= 0 && (index < 2 || unit.level >= 6) ? 'ready' : ''}
          title={`${['Q', 'W', 'R'][index]}: ${index === 2 && unit.level < 6 ? 'locked' : `${Math.ceil(cd)}s cooldown`}`}>{index === 2 && unit.level < 6 ? '–' : cd > 0 ? Math.ceil(cd) : ['Q', 'W', 'R'][index]}</span>)}
      </div>
      <div className="spectator-items">
        {Array.from({ length: 6 }, (_, index) => {
          const item = unit.items[index];
          return <button key={index} disabled={!item} onClick={() => item && onItem(item)} aria-label={item ? `Inspect ${item.name}` : `Empty item slot ${index + 1}`} title={item?.name ?? 'Empty item slot'}>{item?.icon ?? '·'}</button>;
        })}
        <button disabled={!unit.boots} onClick={() => unit.boots && onItem(unit.boots)} title={unit.boots?.name ?? 'Boots slot'} aria-label={unit.boots ? `Inspect ${unit.boots.name}` : 'Empty boots slot'}>{unit.boots?.icon ?? '♧'}</button>
        <span className={second >= (unit.wardReadyAt ?? 0) ? 'ward-ready' : ''} title={second >= (unit.wardReadyAt ?? 0) ? 'Ward ready' : `Ward in ${Math.ceil((unit.wardReadyAt ?? 0) - second)}s`}>◉</span>
      </div>
    </div>)}
  </div>;
}
