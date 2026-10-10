import React, { useState } from 'react';
import { ChampionKit, PlayerCard, AvatarRole, AvatarCombatType } from '../types';
import { AVATAR_COMBAT_TYPES, getAvatarCombatProfile } from '../avatarCombatRoles';
import { ChampionArtwork } from './ChampionArtwork';
import { ChibiAvatar } from './ChibiAvatar';
import { sound } from '../audio';
import { getChampionLore } from '../championLore';
import { KAELEN_INVOKED_SPELLS, kaelenOrbRankAtLevel, kaelenOrbStatBonuses } from '../kaelenAbilities';
import { abilityTargetingDetails } from '../aetherisAbilities';
import { getAbilityRatios } from '../abilityRules';
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
  BookOpen,
  ArrowUpDown,
  Search,
  Filter
} from 'lucide-react';

interface ChampionHubViewProps {
  champions: ChampionKit[];
  allPlayers: PlayerCard[];
}

export const ChampionHubView: React.FC<ChampionHubViewProps> = ({ champions, allPlayers }) => {
  const [selectedChamp, setSelectedChamp] = useState<ChampionKit>(champions[0]);
  const [activeSkillTab, setActiveSkillTab] = useState<'passive' | 'skill1' | 'skill2' | 'ultimate'>('ultimate');
  const [roleFilter, setRoleFilter] = useState<AvatarRole | 'All'>('All');
  const [combatTypeFilter, setCombatTypeFilter] = useState<AvatarCombatType | 'All'>('All');
  const [filterBy, setFilterBy] = useState<'Name' | 'Role' | 'Archetype' | 'HP' | 'AD' | 'Range'>('Name');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [inspectRank, setInspectRank] = useState<number>(1);

  // Filtered and sorted avatar list (name A-Z by default)
  const filteredChampions = [...champions]
    .filter((c) => {
      const matchesRole = roleFilter === 'All' || c.primaryRole === roleFilter || c.secondaryRole === roleFilter;
      const matchesCombatType = combatTypeFilter === 'All' || getAvatarCombatProfile(c)[combatTypeFilter] > 0;
      const matchesSearch = !searchQuery || c.displayName.toLowerCase().includes(searchQuery.toLowerCase()) || c.name.toLowerCase().includes(searchQuery.toLowerCase()) || c.title.toLowerCase().includes(searchQuery.toLowerCase()) || c.archetype.toLowerCase().includes(searchQuery.toLowerCase()) || AVATAR_COMBAT_TYPES.some(type => type.toLowerCase().includes(searchQuery.toLowerCase()) && getAvatarCombatProfile(c)[type] > 0);
      return matchesRole && matchesCombatType && matchesSearch;
    })
    .sort((a, b) => {
      if (filterBy === 'Name') return a.displayName.localeCompare(b.displayName);
      if (filterBy === 'Role') return a.primaryRole.localeCompare(b.primaryRole) || a.displayName.localeCompare(b.displayName);
      if (filterBy === 'Archetype') return a.archetype.localeCompare(b.archetype);
      if (filterBy === 'HP') return b.hp - a.hp;
      if (filterBy === 'AD') return b.ad - a.ad;
      if (filterBy === 'Range') return b.range - a.range;
      return a.displayName.localeCompare(b.displayName);
    });

  // Find athletes who have this champion as their signature pool
  const signatureAthletes = allPlayers.filter((p) =>
    p.signatureChampions.includes(selectedChamp.name)
  );

  const handleTestSkill = (type: 's1' | 's2' | 'ult') => {
    sound.playAvatarSkill(selectedChamp.name, type === 'ult' ? 'ultimate' : type === 's1' ? 'skill1' : 'skill2');
  };

  const lore = getChampionLore(selectedChamp.id);

  // Scaled calculations for ranks
  // 7 Ranks for basic skills, 4 Ranks for ultimate, Level 18 cap
  const getSkillDamageAtRank = (baseDamage: number, rank: number, isUlt: boolean) => {
    if (isUlt) {
      const mult = [0, 0.55, 0.80, 1.05, 1.30][rank] ?? 1.30;
      return Math.round(baseDamage * mult);
    }
    const mult = [0, 0.40, 0.55, 0.70, 0.85, 1.00, 1.15, 1.30][rank] ?? 1.30;
    return Math.round(baseDamage * mult);
  };

  const getSkillCdAtRank = (baseCd: number, rank: number, isUlt: boolean) => {
    if (isUlt) {
      const mult = [1.20, 1.15, 1.00, 0.85, 0.70][rank] ?? 0.70;
      return (baseCd * mult).toFixed(1);
    }
    const mult = [1.35, 1.30, 1.20, 1.10, 1.00, 0.90, 0.80, 0.70][rank] ?? 0.70;
    return (baseCd * mult).toFixed(1);
  };

  const isKaelen = selectedChamp.name === 'Kaelen';
  const currentMaxRank = isKaelen ? 1 : activeSkillTab === 'ultimate' ? 4 : activeSkillTab === 'passive' ? 1 : 7;
  const clampedRank = Math.min(currentMaxRank, Math.max(1, inspectRank));

  return (
    <div className="min-h-[calc(100vh-8rem)] w-full min-w-0 px-3 xl:px-6 py-4 animate-fade-in">
      <div className="grid grid-cols-1 gap-5 items-start">
        <section className="min-w-0 bg-slate-900 border border-slate-800 rounded-2xl p-4 space-y-3 shadow-xl">
          <div className="flex flex-wrap justify-between items-center gap-2">
            <h2 className="text-white font-black text-sm flex items-center gap-2">
              <Filter className="w-4 h-4 text-rose-400" /> Select Avatar
            </h2>
            <span className="text-xs text-slate-400">Click an avatar to inspect lore & ability kit</span>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2 bg-slate-950 p-2.5 rounded-xl border border-slate-800">
            <div className="flex flex-wrap gap-1">
              {(['All', 'Assassin', 'Fighter', 'Mage', 'Marksman', 'Support', 'Tank'] as const).map((r) => (
                <button
                  key={r}
                  onClick={() => { sound.playClick(); setRoleFilter(r); }}
                  className={`px-2.5 py-1 rounded-lg text-xs font-bold transition ${
                    roleFilter === r ? 'bg-cyan-500 text-slate-950 shadow' : 'bg-slate-900 text-slate-400 hover:text-white'
                  }`}
                >
                  {r}
                </button>
              ))}
            </div>
            <div className="relative min-w-[140px] flex-1 sm:flex-none sm:w-44">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search..."
                className="w-full bg-slate-900 text-white placeholder-slate-500 text-xs pl-7 pr-2 py-1.5 rounded-lg border border-slate-700 focus:outline-none focus:border-cyan-400"
              />
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <label className="flex items-center gap-1.5 bg-slate-950 px-2.5 py-1.5 rounded-xl border border-slate-800 text-[10px] font-bold text-slate-400">
              Combat type
              <select value={combatTypeFilter} onChange={(e) => setCombatTypeFilter(e.target.value as AvatarCombatType | 'All')}
                className="bg-transparent text-cyan-300 font-bold focus:outline-none cursor-pointer">
                <option value="All">All types</option>
                {AVATAR_COMBAT_TYPES.map(type => <option key={type} value={type}>{type}</option>)}
              </select>
            </label>
            <label className="flex items-center gap-1.5 bg-slate-950 px-2.5 py-1.5 rounded-xl border border-slate-800">
              <ArrowUpDown className="w-3.5 h-3.5 text-amber-400" />
              <span className="text-[10px] font-bold text-slate-400">Sort</span>
              <select
                value={filterBy}
                onChange={(e) => {
                  sound.playClick();
                  setFilterBy(e.target.value as 'Name' | 'Role' | 'Archetype' | 'HP' | 'AD' | 'Range');
                }}
                className="bg-transparent text-amber-300 font-bold text-[10px] focus:outline-none cursor-pointer"
              >
                <option value="Name" className="bg-slate-900 text-amber-300">Name (A–Z)</option>
                <option value="Role" className="bg-slate-900 text-white">Combat Role</option>
                <option value="Archetype" className="bg-slate-900 text-white">Archetype</option>
                <option value="HP" className="bg-slate-900 text-white">Base HP (Highest)</option>
                <option value="AD" className="bg-slate-900 text-white">Attack Damage (Highest)</option>
                <option value="Range" className="bg-slate-900 text-white">Range (Longest)</option>
              </select>
            </label>
            <span className="ml-auto text-[10px] text-slate-500">{filteredChampions.length} avatars</span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5 gap-2.5 max-h-[42vh] overflow-y-auto p-1">
            {filteredChampions.length === 0 ? (
              <p className="col-span-full p-3 text-sm text-slate-400">No avatars match these filters.</p>
            ) : filteredChampions.map((c) => {
              const isSelected = selectedChamp.id === c.id;
              return (
                <button
                  type="button"
                  key={c.id}
                  onClick={() => {
                    sound.playClick();
                    setSelectedChamp(c);
                  }}
                  aria-pressed={isSelected}
                  className={`min-w-0 p-2.5 rounded-2xl border transition flex flex-col items-center text-center ${
                    isSelected
                      ? 'border-amber-400 bg-amber-400/10 shadow-lg'
                      : 'border-slate-800 bg-slate-950 hover:border-slate-600 hover:bg-slate-900/80'
                  }`}
                >
                  <div
                    className="w-12 h-12 rounded-full flex items-center justify-center p-1 border shadow mb-1.5"
                    style={{ borderColor: c.primaryColor, backgroundColor: `${c.primaryColor}20` }}
                  >
                    <ChampionArtwork championId={c.id} size={40} />
                  </div>
                  <div className="w-full font-black text-white text-xs truncate">{c.displayName}</div>
                  <div className="text-[10px] text-cyan-300 font-bold">{c.primaryRole}</div>
                  <div className="mt-0.5 text-[9px] text-slate-400 truncate max-w-full">{c.archetype}</div>
                  <div className="mt-0.5 text-[9px] text-cyan-200 truncate max-w-full">
                    {AVATAR_COMBAT_TYPES.filter(type => getAvatarCombatProfile(c)[type] >= 2).slice(0, 2).join(' · ')}
                  </div>
                </button>
              );
            })}
          </div>
        </section>

        {/* Selected avatar details */}
        <section className="min-w-0 bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-xl space-y-4">
        {/* Selected avatar profile */}
        <div className="space-y-3">
          <div className="flex items-center gap-3 border-b border-slate-800 pb-3">
            <div
              className="w-16 h-16 shrink-0 rounded-full flex items-center justify-center p-1 border-2 shadow-lg"
              style={{ borderColor: selectedChamp.primaryColor, backgroundColor: `${selectedChamp.primaryColor}25` }}
            >
              <ChampionArtwork championId={selectedChamp.id} size={56} />
            </div>

            <div className="min-w-0">
              <div className="flex flex-wrap items-baseline gap-x-2">
                <h3 className="text-lg font-black text-white tracking-wide">{selectedChamp.displayName}</h3>
                <span className="text-xs font-bold text-amber-300">{selectedChamp.title}</span>
              </div>
              <div className="text-xs text-slate-400 mt-0.5">
                <strong className="text-cyan-300">{selectedChamp.primaryRole}</strong>{selectedChamp.secondaryRole ? <span> / <strong className="text-emerald-300">{selectedChamp.secondaryRole}</strong></span> : null}
                <span className="text-slate-600"> · </span>
                <span className="text-purple-300 font-medium">{selectedChamp.archetype}</span>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap gap-1.5">
            {AVATAR_COMBAT_TYPES.filter(type => getAvatarCombatProfile(selectedChamp)[type] > 0).map(type => (
              <span key={type} className="rounded-full border border-cyan-500/30 bg-cyan-950/40 px-2 py-0.5 text-[10px] font-semibold text-cyan-200">
                {type}
              </span>
            ))}
          </div>

          {/* Narrative Lore Section */}
          <div className="bg-slate-950/80 p-3 rounded-xl border border-slate-800 space-y-1">
            <div className="text-[10px] font-black uppercase text-amber-400 flex items-center gap-1">
              <BookOpen className="w-3 h-3 text-amber-400" /> Avatar lore:
            </div>
            <p className="text-xs text-slate-300 leading-relaxed italic font-serif line-clamp-3">
              "{lore}"
            </p>
          </div>

          {/* 6 Core In-Game Combat Stats */}
          <div className="grid grid-cols-3 gap-2 bg-slate-950/90 p-2.5 rounded-xl border border-slate-800 text-[11px]">
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
          <div className="pt-2 border-t border-slate-800">
            <div className="text-[10px] font-black uppercase text-amber-400 tracking-wider mb-2 flex items-center gap-1">
              <Flame className="w-3.5 h-3.5 text-amber-400" /> Signature athletes (+10% mastery):
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

        {/* Ability breakdown, SFX preview, and level progression */}
        <div className="border-t border-slate-800 pt-4 space-y-4">
          <div className="border-b border-slate-800 pb-3 flex flex-wrap justify-between items-center gap-2">
            <div>
              <h4 className="text-sm font-black text-amber-300 uppercase tracking-wide">
                Complete Ability Kit & Level Progression
              </h4>
              <p className="text-xs text-slate-400 mt-0.5">
                {isKaelen
                  ? 'Kaelen: cooldown-free Q/W/E orbs grant rank-scaled stats while held in the three-orb FIFO · Conflux occupies R · Invoked slots D/F.'
                  : 'Cap 18: Innate Passive Always Active · Q & W reach Rank 7 · Ultimate reaches Rank 4!'}
              </p>
            </div>
          </div>

          {/* Skill Selector Tabs */}
          <div className="grid grid-cols-4 gap-2">
            <button
              onClick={() => { sound.playClick(); setActiveSkillTab('passive'); setInspectRank(1); }}
              className={`p-2.5 rounded-xl text-xs font-black transition flex flex-col items-center gap-0.5 ${
                activeSkillTab === 'passive'
                  ? 'bg-amber-400 text-slate-950 shadow-lg'
                  : 'bg-slate-950 text-slate-400 hover:text-white'
              }`}
            >
              <span>{isKaelen ? 'ORB OF ICE (Q)' : 'PASSIVE'}</span>
              <span className="text-[9px] font-normal truncate">{isKaelen ? 'Stat Stack · No CD' : 'Innate (Always)'}</span>
            </button>

            <button
              onClick={() => { sound.playClick(); setActiveSkillTab('skill1'); }}
              className={`p-2.5 rounded-xl text-xs font-black transition flex flex-col items-center gap-0.5 ${
                activeSkillTab === 'skill1'
                  ? 'bg-cyan-400 text-slate-950 shadow-lg'
                  : 'bg-slate-950 text-slate-400 hover:text-white'
              }`}
            >
              <span>{isKaelen ? 'ORB OF WIND (W)' : 'SKILL 1 (Q)'}</span>
              <span className="text-[9px] font-normal truncate">{isKaelen ? 'Stat Stack · No CD' : 'Rank 1-7 (7 Levels)'}</span>
            </button>

            <button
              onClick={() => { sound.playClick(); setActiveSkillTab('skill2'); }}
              className={`p-2.5 rounded-xl text-xs font-black transition flex flex-col items-center gap-0.5 ${
                activeSkillTab === 'skill2'
                  ? 'bg-purple-400 text-slate-950 shadow-lg'
                  : 'bg-slate-950 text-slate-400 hover:text-white'
              }`}
            >
              <span>{isKaelen ? 'ORB OF FIRE (E)' : 'SKILL 2 (W)'}</span>
              <span className="text-[9px] font-normal truncate">{isKaelen ? 'Stat Stack · No CD' : 'Rank 1-7 (7 Levels)'}</span>
            </button>

            <button
              onClick={() => { sound.playClick(); setActiveSkillTab('ultimate'); }}
              className={`p-2.5 rounded-xl text-xs font-black transition flex flex-col items-center gap-0.5 ${
                activeSkillTab === 'ultimate'
                  ? 'bg-rose-500 text-white shadow-lg animate-pulse'
                  : 'bg-slate-950 text-slate-400 hover:text-white'
              }`}
            >
              <span>{isKaelen ? 'CONFLUX (R)' : 'ULTIMATE (R)'}</span>
              <span className="text-[9px] font-normal truncate">{isKaelen ? 'Active Innate · 10 Spells' : 'Rank 1-4 (4 Levels)'}</span>
            </button>
          </div>

          {/* Interactive Rank Selector Slider / Buttons */}
          {activeSkillTab !== 'passive' && !isKaelen && (
            <div className="bg-slate-950 p-3 rounded-2xl border border-slate-800 flex items-center justify-between gap-2">
              <span className="text-xs font-bold text-slate-300">
                Inspect Rank Level:
              </span>
              <div className="flex gap-1.5">
                {Array.from({ length: currentMaxRank }).map((_, idx) => {
                  const rankNum = idx + 1;
                  const isCurrent = clampedRank === rankNum;
                  return (
                    <button
                      key={rankNum}
                      onClick={() => { sound.playClick(); setInspectRank(rankNum); }}
                      className={`w-7 h-7 rounded-lg text-xs font-black transition flex items-center justify-center ${
                        isCurrent
                          ? activeSkillTab === 'ultimate'
                            ? 'bg-rose-500 text-white shadow-md'
                            : 'bg-cyan-400 text-slate-950 shadow-md'
                          : 'bg-slate-900 text-slate-400 hover:text-white hover:bg-slate-800'
                      }`}
                    >
                      {rankNum}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Active Skill Details Display */}
          <div className="bg-slate-950 border border-slate-800 rounded-2xl p-5 space-y-4">
            {activeSkillTab === 'passive' && (
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <h5 className="text-base font-black text-amber-300">{isKaelen ? 'Q: ORB OF ICE' : 'PASSIVE: Innate Combat Trait'}</h5>
                  <span className="text-xs bg-amber-950 text-amber-300 px-2.5 py-0.5 rounded-full border border-amber-500/30 font-bold">
                    {isKaelen ? 'No cooldown · +0.2 HP regen/s per orb at rank 1' : 'Innate (Always Available)'}
                  </span>
                </div>
                <p className="text-sm text-slate-300 leading-relaxed">
                  {isKaelen ? selectedChamp.skill1.desc : selectedChamp.passiveDesc}
                </p>
                <div className="text-xs text-slate-400 bg-slate-900/60 p-2.5 rounded-xl border border-white/5">
                  {isKaelen
                    ? `Each held Ice orb adds health regeneration while it remains in the three-orb FIFO. Per-orb value scales 25% each rank: +0.2 at rank 1 to +${kaelenOrbStatBonuses(18, { ice: 1, wind: 0, fire: 0 }).healthRegen.toFixed(1)} HP regen/s at rank ${kaelenOrbRankAtLevel(18)}.`
                    : selectedChamp.name === 'Aetheris'
                    ? 'Targeting: automatically links to the nearest living ally within 280 arena units; the link is visible for as long as they remain in range.'
                    : 'Innate traits do not require skill points and are active across all Levels 1 through 18.'}
                </div>
                {isKaelen && (
                  <div className="text-xs text-cyan-200 bg-cyan-950/30 p-2.5 rounded-xl border border-cyan-500/20">
                    {abilityTargetingDetails(selectedChamp.skill1)}
                  </div>
                )}
              </div>
            )}

            {activeSkillTab === 'skill1' && (
              <div className="space-y-3">
                <div className="flex flex-wrap justify-between items-center gap-2">
                  <h5 className="text-base font-black text-cyan-300">
                    {isKaelen ? `W: ${selectedChamp.skill2.name}` : `Q: ${selectedChamp.skill1.name}`}{!isKaelen && <span className="text-xs text-amber-300 font-bold">(Rank {clampedRank}/7)</span>}
                  </h5>
                  <div className="flex gap-2">
                    <span className="text-xs bg-slate-900 text-cyan-300 px-2 py-0.5 rounded border border-white/10 font-bold">
                      {isKaelen ? 'No cooldown' : `CD: ${getSkillCdAtRank(selectedChamp.skill1.cooldown || 10, clampedRank, false)}s`}
                    </span>
                    <span className="text-xs bg-slate-900 text-amber-300 px-2 py-0.5 rounded border border-white/10 font-bold">
                      {isKaelen ? '+1.0 movement speed/orb at rank 1' : `${selectedChamp.skill1.damageType} Dmg: ${getSkillDamageAtRank(selectedChamp.skill1.damage, clampedRank, false)}`}
                    </span>
                    {!isKaelen && selectedChamp.skill1.damage > 0 && (
                      <span className="text-xs bg-slate-900 text-slate-300 px-2 py-0.5 rounded border border-white/10 font-bold">
                        <span className="text-amber-400">+{getAbilityRatios(selectedChamp, selectedChamp.skill1).adPercent}% AD</span>
                        {' · '}
                        <span className="text-cyan-400">+{getAbilityRatios(selectedChamp, selectedChamp.skill1).apPercent}% AP</span>
                      </span>
                    )}
                  </div>
                </div>
                <p className="text-sm text-slate-300 leading-relaxed">
                  {isKaelen ? selectedChamp.skill2.desc : selectedChamp.skill1.desc}
                </p>
                <div className="text-xs text-slate-400 bg-slate-900/60 p-2.5 rounded-xl border border-white/5">
                  {isKaelen
                    ? `Each held Wind orb adds movement speed while it remains in the three-orb FIFO, scaling 25% each rank from +1 at rank 1 to +${kaelenOrbStatBonuses(18, { ice: 0, wind: 1, fire: 0 }).moveSpeed.toFixed(1)} at rank ${kaelenOrbRankAtLevel(18)}.`
                    : `⭐ Basic Skill 1 upgrades across 7 milestones up to Level 18. Base Damage: ${selectedChamp.skill1.damage} | Base CD: ${selectedChamp.skill1.cooldown}s.`}
                </div>
                <div className="text-xs text-cyan-200 bg-cyan-950/30 p-2.5 rounded-xl border border-cyan-500/20">
                  {abilityTargetingDetails(isKaelen ? selectedChamp.skill2 : selectedChamp.skill1)}
                </div>
                <button
                  onClick={() => handleTestSkill(isKaelen ? 's2' : 's1')}
                  className="px-4 py-2 bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-black rounded-xl transition flex items-center gap-1.5 shadow"
                >
                  <Volume2 className="w-4 h-4" /> {isKaelen ? 'Preview Orb of Wind SFX' : 'Preview Skill 1 SFX'}
                </button>
              </div>
            )}

            {activeSkillTab === 'skill2' && (
              <div className="space-y-3">
                <div className="flex flex-wrap justify-between items-center gap-2">
                  <h5 className="text-base font-black text-purple-300">
                    {isKaelen ? `E: ${selectedChamp.ultimate.name}` : `W: ${selectedChamp.skill2.name}`}{!isKaelen && <span className="text-xs text-amber-300 font-bold">(Rank {clampedRank}/7)</span>}
                  </h5>
                  <div className="flex gap-2">
                    <span className="text-xs bg-slate-900 text-purple-300 px-2 py-0.5 rounded border border-white/10 font-bold">
                      {isKaelen ? 'No cooldown' : `CD: ${getSkillCdAtRank(selectedChamp.skill2.cooldown || 10, clampedRank, false)}s`}
                    </span>
                    <span className="text-xs bg-slate-900 text-amber-300 px-2 py-0.5 rounded border border-white/10 font-bold">
                      {isKaelen ? '+1% spell + damage amp/orb at rank 1'
                        : selectedChamp.name === 'Aetheris' ? '100 shield · +15% attack damage · 5s'
                          : `${selectedChamp.skill2.damageType} Dmg: ${getSkillDamageAtRank(selectedChamp.skill2.damage, clampedRank, false)}`}
                    </span>
                    {!isKaelen && selectedChamp.skill2.damage > 0 && (
                      <span className="text-xs bg-slate-900 text-slate-300 px-2 py-0.5 rounded border border-white/10 font-bold">
                        <span className="text-amber-400">+{getAbilityRatios(selectedChamp, selectedChamp.skill2).adPercent}% AD</span>
                        {' · '}
                        <span className="text-cyan-400">+{getAbilityRatios(selectedChamp, selectedChamp.skill2).apPercent}% AP</span>
                      </span>
                    )}
                  </div>
                </div>
                <p className="text-sm text-slate-300 leading-relaxed">
                  {isKaelen ? selectedChamp.ultimate.desc : selectedChamp.skill2.desc}
                </p>
                <div className="text-xs text-slate-400 bg-slate-900/60 p-2.5 rounded-xl border border-white/5">
                  {isKaelen
                    ? `Each held Fire orb adds spell amp and damage amp while it remains in the three-orb FIFO, scaling 25% each rank from +1% of each at rank 1 to +${(kaelenOrbStatBonuses(18, { ice: 0, wind: 0, fire: 1 }).spellAmp * 100).toFixed(1)}% at rank ${kaelenOrbRankAtLevel(18)}.`
                    : `⭐ Basic Skill 2 upgrades across 7 milestones up to Level 18. Base Damage: ${selectedChamp.skill2.damage} | Base CD: ${selectedChamp.skill2.cooldown}s.`}
                </div>
                <div className="text-xs text-cyan-200 bg-cyan-950/30 p-2.5 rounded-xl border border-cyan-500/20">
                  {abilityTargetingDetails(isKaelen ? selectedChamp.ultimate : selectedChamp.skill2)}
                </div>
                <button
                  onClick={() => handleTestSkill('ult')}
                  className="px-4 py-2 bg-purple-600 hover:bg-purple-500 text-white text-xs font-black rounded-xl transition flex items-center gap-1.5 shadow"
                >
                  <Volume2 className="w-4 h-4" /> {isKaelen ? 'Preview Orb of Fire SFX' : 'Preview Skill 2 SFX'}
                </button>
              </div>
            )}

            {activeSkillTab === 'ultimate' && isKaelen && (
              <div className="space-y-3">
                <div className="flex flex-wrap justify-between items-center gap-2">
                  <h5 className="text-base font-black text-rose-300">R: CONFLUX</h5>
                  <span className="text-xs bg-slate-900 text-rose-200 px-2 py-0.5 rounded border border-rose-400/20 font-bold">
                    Active innate · CD: 3 / 2 / 1 / 0s by level
                  </span>
                </div>
                <p className="text-sm text-slate-200 leading-relaxed font-medium">{selectedChamp.passiveDesc}</p>
                <div className="rounded-xl border border-cyan-500/20 bg-slate-900/60 p-2.5 text-xs text-slate-300">
                  <strong className="text-cyan-200">D</strong> holds the oldest invocation and <strong className="text-orange-200">F</strong> the newest. A new Conflux result shifts the previous F spell to D and drops the old D spell (FIFO).
                </div>
                <h6 className="text-xs font-black uppercase tracking-wide text-amber-300">Conflux spellbook (10 recipes)</h6>
                <div className="grid gap-1.5 sm:grid-cols-2">
                  {KAELEN_INVOKED_SPELLS.map(spell => (
                    <div key={spell.id} className="flex items-center justify-between gap-2 rounded-lg border border-slate-800 bg-slate-900 px-2.5 py-1.5 text-[11px]">
                      <span className="font-bold text-slate-200">{spell.name}</span>
                      <span className="shrink-0 text-slate-400">{spell.recipe.map(element => element === 'ice' ? 'Q' : element === 'wind' ? 'W' : 'E').join(' ')} · {spell.cooldown}s</span>
                    </div>
                  ))}
                </div>
                <button
                  onClick={() => handleTestSkill('ult')}
                  className="px-4 py-2 bg-gradient-to-r from-orange-600 to-amber-500 hover:brightness-110 text-white text-xs font-black rounded-xl transition flex items-center gap-1.5 shadow-lg"
                >
                  <Zap className="w-4 h-4" /> Preview Conflux SFX
                </button>
              </div>
            )}

            {activeSkillTab === 'ultimate' && !isKaelen && (
              <div className="space-y-3">
                <div className="flex flex-wrap justify-between items-center gap-2">
                  <h5 className="text-base font-black text-rose-400">
                    R (ULTIMATE): {selectedChamp.ultimate.name} <span className="text-xs text-amber-300 font-bold">(Rank {clampedRank}/4)</span>
                  </h5>
                  <div className="flex gap-2">
                    <span className="text-xs bg-slate-900 text-rose-300 px-2 py-0.5 rounded border border-white/10 font-bold">
                      CD: {getSkillCdAtRank(selectedChamp.ultimate.cooldown || 70, clampedRank, true)}s (100 Mana)
                    </span>
                    <span className="text-xs bg-rose-950 text-rose-200 px-2 py-0.5 rounded border border-rose-500/40 font-bold">
                      {selectedChamp.name === 'Aetheris'
                        ? `Nearby allies linked for ${clampedRank + 4}s`
                        : `${selectedChamp.ultimate.damageType} Dmg: ${getSkillDamageAtRank(selectedChamp.ultimate.damage, clampedRank, true)}`}
                    </span>
                    {selectedChamp.ultimate.damage > 0 && (
                      <span className="text-xs bg-slate-900 text-slate-300 px-2 py-0.5 rounded border border-white/10 font-bold">
                        <span className="text-amber-400">+{getAbilityRatios(selectedChamp, selectedChamp.ultimate).adPercent}% AD</span>
                        {' · '}
                        <span className="text-cyan-400">+{getAbilityRatios(selectedChamp, selectedChamp.ultimate).apPercent}% AP</span>
                      </span>
                    )}
                  </div>
                </div>
                <p className="text-sm text-slate-200 leading-relaxed font-medium">{selectedChamp.ultimate.desc}</p>
                <div className="text-xs text-slate-400 bg-slate-900/60 p-2.5 rounded-xl border border-white/5">
                  {selectedChamp.name === 'Aetheris'
                    ? `👑 Rank ${clampedRank} links nearby allies for ${clampedRank + 4} seconds. Duration increases at ultimate ranks 1-4 (5 / 6 / 7 / 8 seconds).`
                    : '👑 Ultimate unlocks at Level 6 (Rank 1), ranks up at Level 11 (Rank 2), Level 16 (Rank 3), and hits maximum power at Level 18 (Rank 4)!'}
                </div>
                <div className="text-xs text-cyan-200 bg-cyan-950/30 p-2.5 rounded-xl border border-cyan-500/20">
                  {abilityTargetingDetails(selectedChamp.ultimate)}
                </div>
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
        </section>
      </div>
    </div>
  );
};
