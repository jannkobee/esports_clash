import React, { useState } from 'react';
import { ChampionKit, PlayerCard } from '../types';
import { ChampionArtwork } from './ChampionArtwork';
import { ChibiAvatar } from './ChibiAvatar';
import { sound } from '../audio';
import { 
  Shield, 
  Swords, 
  Zap, 
  Flame, 
  Sparkles, 
  Heart, 
  Volume2, 
  Crosshair, 
  Activity,
  Layers
} from 'lucide-react';

interface ChampionHubViewProps {
  champions: ChampionKit[];
  allPlayers: PlayerCard[];
}

export const ChampionHubView: React.FC<ChampionHubViewProps> = ({ champions, allPlayers }) => {
  const [selectedChamp, setSelectedChamp] = useState<ChampionKit>(champions[0]);
  const [activeSkillTab, setActiveSkillTab] = useState<'passive' | 'skill1' | 'skill2' | 'ultimate'>('ultimate');

  // Find athletes who have this champion as their signature pool
  const signatureAthletes = allPlayers.filter((p) =>
    p.signatureChampions.includes(selectedChamp.name)
  );

  const handleTestSkill = (type: 's1' | 's2' | 'ult') => {
    if (type === 'ult') sound.playUltimateExplosion();
    else sound.playSpellHit();
  };

  return (
    <div className="space-y-6 animate-fade-in max-w-6xl mx-auto">
      {/* Top Banner */}
      <div className="bg-gradient-to-r from-indigo-950 via-slate-900 to-purple-950 border border-indigo-500/40 rounded-2xl p-5 shadow-xl flex justify-between items-center">
        <div>
          <div className="text-xs font-black uppercase tracking-widest text-cyan-400 flex items-center gap-1.5 mb-1">
            <Layers className="w-4 h-4" />
            CHAMPIONS & KIT ARCHETYPES
          </div>
          <h2 className="text-2xl font-black text-white">CHAMPION ROSTER DOSSIER</h2>
          <p className="text-slate-400 text-xs mt-0.5">
            Inspect combat stats, active ability kits, damage scalings, and esports athlete synergies.
          </p>
        </div>
      </div>

      {/* Champion Selector Ribbon */}
      <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 xl:grid-cols-9 gap-2.5 max-h-72 overflow-y-auto p-2 bg-slate-950/60 rounded-2xl border border-slate-800">
        {champions.map((c) => {
          const isSelected = selectedChamp.id === c.id;
          return (
            <div
              key={c.id}
              onClick={() => {
                sound.playClick();
                setSelectedChamp(c);
              }}
              className={`p-2.5 rounded-2xl border-2 cursor-pointer transition flex flex-col items-center relative overflow-hidden ${
                isSelected
                  ? 'border-amber-400 bg-gradient-to-b from-amber-950/40 via-slate-900 to-slate-900 scale-105 shadow-xl'
                  : 'border-slate-800 bg-slate-900/80 hover:border-slate-600'
              }`}
            >
              <ChampionArtwork championId={c.id} size={56} />
              <div className="mt-1.5 font-black text-white text-xs text-center truncate w-full">{c.name}</div>
              <div className="text-[9px] text-cyan-300 font-bold">{c.primaryRole}</div>
              <div className="mt-1 text-[8px] bg-slate-950 text-amber-300 px-1.5 py-0.5 rounded-full border border-white/10 truncate max-w-full">
                {c.archetype}
              </div>
            </div>
          );
        })}
      </div>

      {/* MAIN CHAMPION DOSSIER */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column: Visual Artwork & Combat Stats */}
        <div className="lg:col-span-5 bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-2xl flex flex-col items-center text-center space-y-4">
          <div className="relative">
            <div
              className="w-48 h-48 rounded-full flex items-center justify-center p-2 shadow-2xl border-4"
              style={{ borderColor: selectedChamp.primaryColor, backgroundColor: `${selectedChamp.primaryColor}15` }}
            >
              <ChampionArtwork championId={selectedChamp.id} size={170} />
            </div>
          </div>

          <div>
            <h3 className="text-2xl font-black text-white tracking-wide">{selectedChamp.name}</h3>
            <div className="text-sm font-bold text-amber-300">{selectedChamp.title}</div>
            <div className="text-xs text-slate-400 mt-1">
              Role: <strong className="text-cyan-300">{selectedChamp.primaryRole}</strong>{selectedChamp.secondaryRole ? <span> / <strong className="text-emerald-300">{selectedChamp.secondaryRole}</strong></span> : null}
            </div>
          </div>

          {/* 6 Core In-Game Combat Stats */}
          <div className="w-full grid grid-cols-2 gap-2 bg-slate-950/80 p-3 rounded-2xl border border-slate-800 text-xs">
            <div className="flex justify-between items-center p-1.5 bg-slate-900 rounded-lg">
              <span className="text-slate-400 font-bold flex items-center gap-1">
                <Heart className="w-3.5 h-3.5 text-rose-400" /> Base HP:
              </span>
              <strong className="text-white">{selectedChamp.hp}</strong>
            </div>

            <div className="flex justify-between items-center p-1.5 bg-slate-900 rounded-lg">
              <span className="text-slate-400 font-bold flex items-center gap-1">
                <Swords className="w-3.5 h-3.5 text-amber-400" /> Base AD:
              </span>
              <strong className="text-white">{selectedChamp.ad}</strong>
            </div>

            <div className="flex justify-between items-center p-1.5 bg-slate-900 rounded-lg">
              <span className="text-slate-400 font-bold flex items-center gap-1">
                <Shield className="w-3.5 h-3.5 text-blue-400" /> Armor:
              </span>
              <strong className="text-white">{selectedChamp.armor}</strong>
            </div>

            <div className="flex justify-between items-center p-1.5 bg-slate-900 rounded-lg">
              <span className="text-slate-400 font-bold flex items-center gap-1">
                <Sparkles className="w-3.5 h-3.5 text-purple-400" /> Magic Resist:
              </span>
              <strong className="text-white">{selectedChamp.mr}</strong>
            </div>

            <div className="flex justify-between items-center p-1.5 bg-slate-900 rounded-lg">
              <span className="text-slate-400 font-bold flex items-center gap-1">
                <Activity className="w-3.5 h-3.5 text-cyan-400" /> Attack Speed:
              </span>
              <strong className="text-white">{selectedChamp.aspd} /s</strong>
            </div>

            <div className="flex justify-between items-center p-1.5 bg-slate-900 rounded-lg">
              <span className="text-slate-400 font-bold flex items-center gap-1">
                <Crosshair className="w-3.5 h-3.5 text-emerald-400" /> Range:
              </span>
              <strong className="text-white">{selectedChamp.range} units</strong>
            </div>
          </div>

          {/* Signature Athlete Pairings */}
          <div className="w-full text-left pt-2 border-t border-slate-800">
            <div className="text-[11px] font-black uppercase text-amber-400 tracking-wider mb-2 flex items-center gap-1">
              <Flame className="w-3.5 h-3.5 text-amber-400" /> Signature Athletes (+10% Mastery Boost):
            </div>
            {signatureAthletes.length === 0 ? (
              <div className="text-xs text-slate-500">None yet</div>
            ) : (
              <div className="flex flex-wrap gap-2">
                {signatureAthletes.map((ath) => (
                  <div key={ath.id} className="flex items-center gap-1.5 bg-slate-950 px-2.5 py-1 rounded-xl border border-white/10 text-xs font-bold text-slate-200">
                    <ChibiAvatar avatarType={ath.avatarSvg} size={22} />
                    <span>{ath.name} ({ath.preferredRole || ath.role || 'Athlete'})</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Ability Breakdown & Interactive SFX Preview */}
        <div className="lg:col-span-7 bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-2xl space-y-5">
          <div className="border-b border-slate-800 pb-3">
            <h4 className="text-sm font-black text-amber-300 uppercase tracking-wide">
              Complete Ability Kit & Mechanics
            </h4>
            <p className="text-xs text-slate-400 mt-0.5">
              Click tabs to inspect cooldowns, damage types, and crowd control effects.
            </p>
          </div>

          {/* Skill Selector Tabs */}
          <div className="grid grid-cols-4 gap-2">
            <button
              onClick={() => { sound.playClick(); setActiveSkillTab('passive'); }}
              className={`p-2.5 rounded-xl text-xs font-black transition flex flex-col items-center gap-0.5 ${
                activeSkillTab === 'passive'
                  ? 'bg-amber-400 text-slate-950 shadow-lg'
                  : 'bg-slate-950 text-slate-400 hover:text-white'
              }`}
            >
              <span>PASSIVE</span>
              <span className="text-[9px] font-normal truncate">Innate Trait</span>
            </button>

            <button
              onClick={() => { sound.playClick(); setActiveSkillTab('skill1'); }}
              className={`p-2.5 rounded-xl text-xs font-black transition flex flex-col items-center gap-0.5 ${
                activeSkillTab === 'skill1'
                  ? 'bg-cyan-400 text-slate-950 shadow-lg'
                  : 'bg-slate-950 text-slate-400 hover:text-white'
              }`}
            >
              <span>SKILL 1 (Q)</span>
              <span className="text-[9px] font-normal truncate">{selectedChamp.skill1.name}</span>
            </button>

            <button
              onClick={() => { sound.playClick(); setActiveSkillTab('skill2'); }}
              className={`p-2.5 rounded-xl text-xs font-black transition flex flex-col items-center gap-0.5 ${
                activeSkillTab === 'skill2'
                  ? 'bg-purple-400 text-slate-950 shadow-lg'
                  : 'bg-slate-950 text-slate-400 hover:text-white'
              }`}
            >
              <span>SKILL 2 (W)</span>
              <span className="text-[9px] font-normal truncate">{selectedChamp.skill2.name}</span>
            </button>

            <button
              onClick={() => { sound.playClick(); setActiveSkillTab('ultimate'); }}
              className={`p-2.5 rounded-xl text-xs font-black transition flex flex-col items-center gap-0.5 ${
                activeSkillTab === 'ultimate'
                  ? 'bg-rose-500 text-white shadow-lg animate-pulse'
                  : 'bg-slate-950 text-slate-400 hover:text-white'
              }`}
            >
              <span>ULTIMATE (R)</span>
              <span className="text-[9px] font-normal truncate">{selectedChamp.ultimate.name}</span>
            </button>
          </div>

          {/* Active Skill Details Display */}
          <div className="bg-slate-950 border border-slate-800 rounded-2xl p-5 space-y-4">
            {activeSkillTab === 'passive' && (
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <h5 className="text-base font-black text-amber-300">PASSIVE: Innate Combat Trait</h5>
                  <span className="text-xs bg-amber-950 text-amber-300 px-2.5 py-0.5 rounded-full border border-amber-500/30 font-bold">
                    Always Active
                  </span>
                </div>
                <p className="text-sm text-slate-300 leading-relaxed">{selectedChamp.passiveDesc}</p>
              </div>
            )}

            {activeSkillTab === 'skill1' && (
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <h5 className="text-base font-black text-cyan-300">Q: {selectedChamp.skill1.name}</h5>
                  <div className="flex gap-2">
                    <span className="text-xs bg-slate-900 text-cyan-300 px-2 py-0.5 rounded border border-white/10 font-bold">
                      CD: {selectedChamp.skill1.cooldown}s
                    </span>
                    <span className="text-xs bg-slate-900 text-amber-300 px-2 py-0.5 rounded border border-white/10 font-bold">
                      {selectedChamp.skill1.damageType} Dmg: {selectedChamp.skill1.damage}
                    </span>
                  </div>
                </div>
                <p className="text-sm text-slate-300 leading-relaxed">{selectedChamp.skill1.desc}</p>
                <button
                  onClick={() => handleTestSkill('s1')}
                  className="px-4 py-2 bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-black rounded-xl transition flex items-center gap-1.5 shadow"
                >
                  <Volume2 className="w-4 h-4" /> Preview Skill 1 SFX
                </button>
              </div>
            )}

            {activeSkillTab === 'skill2' && (
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <h5 className="text-base font-black text-purple-300">W: {selectedChamp.skill2.name}</h5>
                  <div className="flex gap-2">
                    <span className="text-xs bg-slate-900 text-purple-300 px-2 py-0.5 rounded border border-white/10 font-bold">
                      CD: {selectedChamp.skill2.cooldown}s
                    </span>
                    <span className="text-xs bg-slate-900 text-amber-300 px-2 py-0.5 rounded border border-white/10 font-bold">
                      {selectedChamp.skill2.damageType} Dmg: {selectedChamp.skill2.damage}
                    </span>
                  </div>
                </div>
                <p className="text-sm text-slate-300 leading-relaxed">{selectedChamp.skill2.desc}</p>
                <button
                  onClick={() => handleTestSkill('s2')}
                  className="px-4 py-2 bg-purple-600 hover:bg-purple-500 text-white text-xs font-black rounded-xl transition flex items-center gap-1.5 shadow"
                >
                  <Volume2 className="w-4 h-4" /> Preview Skill 2 SFX
                </button>
              </div>
            )}

            {activeSkillTab === 'ultimate' && (
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <h5 className="text-base font-black text-rose-400">R (ULTIMATE): {selectedChamp.ultimate.name}</h5>
                  <div className="flex gap-2">
                    <span className="text-xs bg-slate-900 text-rose-300 px-2 py-0.5 rounded border border-white/10 font-bold">
                      CD: {selectedChamp.ultimate.cooldown}s (100 Mana)
                    </span>
                    <span className="text-xs bg-rose-950 text-rose-200 px-2 py-0.5 rounded border border-rose-500/40 font-bold">
                      {selectedChamp.ultimate.damageType} Dmg: {selectedChamp.ultimate.damage}
                    </span>
                  </div>
                </div>
                <p className="text-sm text-slate-200 leading-relaxed font-medium">{selectedChamp.ultimate.desc}</p>
                <button
                  onClick={() => handleTestSkill('ult')}
                  className="px-4 py-2 bg-gradient-to-r from-rose-600 to-pink-600 hover:brightness-110 text-white text-xs font-black rounded-xl transition flex items-center gap-1.5 shadow-lg"
                >
                  <Zap className="w-4 h-4" /> Preview Ultimate Explosive SFX!
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

