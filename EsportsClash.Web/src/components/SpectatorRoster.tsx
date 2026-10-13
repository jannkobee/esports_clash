import type { AramChampionUnit, ItemDef } from '../types';
import { ChampionArtwork } from './ChampionArtwork';
import { maxMana } from '../abilityRules';
import { KAELEN_INVOKED_SPELLS } from '../kaelenAbilities';
import { deriveTeamPsychology } from '../playerPersonality';
import { abilityCompactSummary, getAbilityPresentation } from '../abilityPresentation';
import { abilityRank } from '../skillProgression';

const signed = (value: number) => `${value >= 0 ? '+' : ''}${value.toFixed(1)}`;
const decisionDetail = (unit: AramChampionUnit) => {
  const decision = unit.decisionTelemetry;
  if (!decision) return '';
  return `Decision ${decision.action.toUpperCase()}${decision.targetId ? ` → ${decision.targetId}` : ''} · Baseline ${signed(decision.baseline)} (${decision.baselineReason ?? 'existing policy'}) · Personality ${signed(decision.personalityDelta)} · Mood ${signed(decision.moodDelta)} · Team ${signed(decision.coordinationDelta)} · ${decision.safetyGate ?? 'existing safety checks'} · ${decision.explanation}`;
};

const abilityMechanicsSummary = (unit: AramChampionUnit) => unit.champion.name === 'Kaelen'
  ? 'Kaelen uses the dedicated Conflux invocation slots shown below.'
  : (['skill1', 'skill2', 'ultimate'] as const).map((slot, index) => {
    const ability = getAbilityPresentation(unit.champion, slot, abilityRank(unit.level, slot));
    return `${['Q', 'W', 'R'][index]} ${ability.name}: ${abilityCompactSummary(ability)}${ability.movement ? ` · ${ability.movement.kind.toUpperCase()}` : ''}`;
  }).join('\n');

export function SpectatorRoster({ units, team, onItem, onFocus, xpProgress, second }: {
  units: AramChampionUnit[]; team: 'blue' | 'red'; onItem: (item: ItemDef) => void;
  onFocus: (unit: AramChampionUnit) => void;
  xpProgress: (unit: AramChampionUnit) => number; second: number;
}) {
  const psychology = deriveTeamPsychology(units);
  const igl = units.find(unit => unit.id === psychology.iglId);
  return <div className={`spectator-roster ${team}`} aria-label={`${team} squad status and item inventory`}>
    <div className="spectator-team-psychology" title={`Morale ${Math.round(psychology.morale)} · Momentum ${Math.round(psychology.momentum)} · Cohesion ${Math.round(psychology.cohesion)} · Leadership authority ${Math.round(psychology.leadershipAuthority)}`}>
      <b>{psychology.mentalities.join(' · ') || 'STEADY'}</b><span>IGL {igl?.player.name ?? '—'}</span>
    </div>
    {units.map(unit => <div className={`spectator-unit ${unit.isAlive ? '' : 'fallen'}`} key={unit.id}>
      <button className="spectator-portrait" onClick={() => onFocus(unit)} title={`Follow ${unit.player.name} / ${unit.champion.displayName}, ${unit.champion.title}`}>
        <ChampionArtwork championId={unit.champion.id} size={29} className="h-full w-full" />
        <span>{unit.isAlive ? unit.level : `${Math.ceil(unit.respawnTimer)}s`}</span>
      </button>
      <div className="spectator-vitals">
        <div className="spectator-name"><b>{unit.player.name}</b><span title={`${unit.champion.displayName} — ${unit.champion.title}`}>{unit.champion.displayName}</span></div>
        {unit.psychology && <div className="spectator-psychology" title={`Confidence ${Math.round(unit.psychology.mood.confidence)} · Tilt ${Math.round(unit.psychology.mood.frustration)} · Trust ${Math.round(unit.psychology.mood.trust)}${unit.decisionTelemetry ? ` · ${decisionDetail(unit)}` : ''}`}>
          {unit.psychology.mood.frustration >= 65 ? 'TILTED' : unit.psychology.mood.confidence >= 70 ? 'CONFIDENT' : 'COMPOSED'}{unit.decisionTelemetry ? ` · ${unit.decisionTelemetry.action.toUpperCase()}` : ''}
        </div>}
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
      <div className="spectator-skills" aria-label={`${unit.player.name} ability cooldowns`} title={abilityMechanicsSummary(unit)}>
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
