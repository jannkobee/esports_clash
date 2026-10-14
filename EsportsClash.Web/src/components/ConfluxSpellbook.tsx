import { useState } from 'react';
import type { ChampionKit } from '../types';
import { KAELEN_COMBOS, KAELEN_INVOKED_SPELLS, KAELEN_ORB_MANA } from '../kaelenAbilities';
import { getAbilityRatios } from '../abilityRules';
import { abilityDamageMultiplier } from '../skillProgression';

export function ConfluxSpellbook({ champion }: { champion: ChampionKit }) {
  const [selected, setSelected] = useState(KAELEN_INVOKED_SPELLS[0].id);
  const [level, setLevel] = useState(1);
  const spell = KAELEN_INVOKED_SPELLS.find(entry => entry.id === selected)!;
  const inheritedRatios = getAbilityRatios(champion, champion.skill1);
  const ratios = spell.ratios ?? inheritedRatios;
  const targeting = spell.targeting === 'ally' ? 'Allied ground-targeted aura' : spell.targeting === 'summon' ? 'Ground-targeted summon' : spell.speed > 0 ? 'Aimed moving skillshot' : 'Ground-targeted area';
  return <section aria-label="Conflux spellbook" className="rounded-xl border border-cyan-800/50 bg-slate-950 p-3 text-xs">
    <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
      <strong className="text-cyan-200">CONFLUX / 10 SPELLS</strong>
      <label className="text-slate-400">Preview level <select aria-label="Spellbook preview level" className="rounded bg-slate-800 p-1 text-white" value={level} onChange={event => setLevel(Number(event.target.value))}>
        {[1, 4, 7, 9, 12, 14, 17, 18].map(entry => <option key={entry}>{entry}</option>)}
      </select></label>
    </div>
    <div className="grid grid-cols-2 gap-1 sm:grid-cols-5" role="group" aria-label="Choose invoked spell">
      {KAELEN_INVOKED_SPELLS.map(entry => <button key={entry.id} aria-pressed={selected === entry.id} onClick={() => setSelected(entry.id)} className={`rounded border p-1.5 text-left ${selected === entry.id ? 'border-cyan-400 bg-cyan-950 text-white' : 'border-slate-800 text-slate-400 hover:text-white'}`}>
        <span className="block font-mono text-[10px]" style={{ color: entry.color }}>{entry.recipe.map(orb => orb === 'ice' ? 'Q' : orb === 'wind' ? 'W' : 'E').join('')}</span>
        <span className="text-[11px] font-bold">{entry.name}</span>
      </button>)}
    </div>
    <article className="mt-3 space-y-2" aria-live="polite">
      <h6 className="text-sm font-black" style={{ color: spell.color }}>{spell.name}</h6>
      <div className="flex flex-wrap gap-x-3 gap-y-1 font-mono text-[11px] text-amber-200">
        <span>{Math.round(spell.damage * abilityDamageMultiplier(level, 'skill1'))} damage</span><span>{spell.cooldown}s cooldown</span><span>{spell.mana} mana</span><span>{spell.range} range</span><span>{spell.radius} area</span><span>{spell.delay}s windup</span>{spell.speed > 0 && <span>{spell.speed} speed</span>}
      </div>
      <p className="leading-relaxed text-slate-200">{spell.description}</p>
      <p className="text-[11px] text-cyan-200">{targeting} · {spell.control === 'none' ? 'No hard crowd control' : `${spell.control} ${spell.controlDuration}s`}{spell.slow && ` · ${Math.round(spell.slow.amount * 100)}% slow for ${spell.slow.duration}s`}</p>
      <p className="text-[11px] text-slate-400">{spell.damage > 0 ? `Base ${spell.damage} + ${Math.round(ratios.adRatio * 100)}% bonus AD + ${Math.round(ratios.apRatio * 100)}% AP, then basic-skill level scaling and normal mitigation. ` : ''}{spell.zone && `${spell.zone.duration}s zone: ${spell.zone.tickDamage} damage / ${spell.zone.tickInterval}s. `}{spell.debuff && `${spell.debuff.duration}s target DoT: ${spell.debuff.tickDamage} damage / ${spell.debuff.tickInterval}s, maximum ${spell.debuff.maxStacks ?? 1} stack(s). `}{spell.shield && `${spell.shield.amount} shield for ${spell.shield.duration}s and +${spell.shield.moveSpeed} move speed. `}{spell.summon && `One killable Warden: ${spell.summon.health} HP, ${spell.summon.duration}s, ${spell.summon.attackDamage} damage / ${spell.summon.attackInterval}s; it cannot attack structures. `}Orb gathering costs {KAELEN_ORB_MANA} mana each; Conflux consumes three orbs, keeps newest two spells on D/F, and never resets spell cooldowns.</p>
      <p className="rounded bg-cyan-950/40 p-2 text-cyan-100">Combo: {spell.comboTip}</p>
    </article>
    <div className="mt-3 grid gap-1 border-t border-slate-800 pt-2">
      <strong className="text-cyan-200">RECOMMENDED COMBINATION LIBRARY</strong>
      {KAELEN_COMBOS.map(combo => <div key={combo.id} className="text-[11px] leading-relaxed"><strong className="text-amber-200">{combo.name}</strong>{' · '}{combo.spells.map((id, index) => <span key={id}>{index > 0 && ' → '}<button className="text-slate-300 underline decoration-slate-600 hover:text-white" onClick={() => setSelected(id)}>{KAELEN_INVOKED_SPELLS.find(entry => entry.id === id)!.name}</button></span>)}<span className="block text-slate-500">{combo.description}</span></div>)}
      <p className="mt-1 text-[10px] text-slate-500">These are recommended strategies, not fixed scripts. Arsenaldo replans from live threat, target geometry, D/F loadout, mana, cooldowns, IQ and personality preference; protected arena safety rules remain authoritative.</p>
    </div>
  </section>;
}
