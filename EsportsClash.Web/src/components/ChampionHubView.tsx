import React, { useState } from 'react';
import { ChampionKit, PlayerCard, AvatarRole, AvatarCombatType } from '../types';
import { AVATAR_COMBAT_TYPES, getAvatarCombatProfile } from '../avatarCombatRoles';
import { ChampionArtwork } from './ChampionArtwork';
import { ChibiAvatar } from './ChibiAvatar';
import { sound } from '../audio';
import { getChampionLore } from '../championLore';
import { KAELEN_INVOKED_SPELLS } from '../kaelenAbilities';
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
  Layers,
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

  // Filtered and sorted champion list (Filtered by Name by default)
  const filteredChampions = [...champions]
    .filter((c) => {
      const matchesRole = roleFilter === 'All' || c.primaryRole === roleFilter || c.secondaryRole === roleFilter;
      const matchesCombatType = combatTypeFilter === 'All' || getAvatarCombatProfile(c)[combatTypeFilter] > 0;
      const matchesSearch = !searchQuery || c.name.toLowerCase().includes(searchQuery.toLowerCase()) || c.title.toLowerCase().includes(searchQuery.toLowerCase()) || c.archetype.toLowerCase().includes(searchQuery.toLowerCase()) || AVATAR_COMBAT_TYPES.some(type => type.toLowerCase().includes(searchQuery.toLowerCase()) && getAvatarCombatProfile(c)[type] > 0);
      return matchesRole && matchesCombatType && matchesSearch;
    })
    .sort((a, b) => {
      if (filterBy === 'Name') return a.name.localeCompare(b.name);
      if (filterBy === 'Role') return a.primaryRole.localeCompare(b.primaryRole) || a.name.localeCompare(b.name);
      if (filterBy === 'Archetype') return a.archetype.localeCompare(b.archetype);
      if (filterBy === 'HP') return b.hp - a.hp;
      if (filterBy === 'AD') return b.ad - a.ad;
      if (filterBy === 'Range') return b.range - a.range;
      return a.name.localeCompare(b.name);
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
    <div className="space-y-6 animate-fade-in max-w-6xl mx-auto">
      {/* Top Banner */}
      <div className="bg-gradient-to-r from-indigo-950 via-slate-900 to-purple-950 border border-indigo-500/40 rounded-2xl p-5 shadow-xl flex flex-wrap justify-between items-center gap-4">
        <div>
          <div className="text-xs font-black uppercase tracking-widest text-cyan-400 flex items-center gap-1.5 mb-1">
            <Layers className="w-4 h-4" />
            CHAMPIONS, ABILITY KITS & NARRATIVE LORE
          </div>
          <h2 className="text-2xl font-black text-white">AVATAR ROSTER & COMBAT TYPES</h2>
          <p className="text-slate-400 text-xs mt-0.5">
            Explore all 39 avatars with narrative lore, Ice/Wind/Fire Conflux spellweaving (Kaelen), 18-level progression, and athlete masteries.
          </p>
        </div>

        <div className="flex items-center gap-2 bg-slate-950/80 px-3 py-1.5 rounded-xl border border-white/10 text-xs">
          <span className="text-amber-400 font-bold">Level 18 Cap:</span>
          <span className="text-slate-300">Standard: 7 Ranks Q/W + 4 Ranks R · Kaelen: Q/W/E Orbs + Conflux + D/F FIFO</span>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-3 flex flex-wrap items-center justify-between gap-3">
        {/* Role Filters */}
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-xs font-bold text-slate-400 flex items-center gap-1 mr-1">
            <Filter className="w-3.5 h-3.5 text-cyan-400" /> Role:
          </span>
          {(['All', 'Tank', 'Mage', 'Marksman', 'Support', 'Fighter', 'Assassin'] as const).map((r) => (
            <button
              key={r}
              onClick={() => { sound.playClick(); setRoleFilter(r); }}
              className={`px-3 py-1 rounded-lg text-xs font-bold transition ${
                roleFilter === r
                  ? 'bg-cyan-500 text-slate-950 shadow'
                  : 'bg-slate-950 text-slate-400 hover:text-white hover:bg-slate-800'
              }`}
            >
              {r}
            </button>
          ))}
        </div>

        {/* Filter / Sort by Selector & Search Box */}
        <div className="flex flex-wrap items-center gap-2.5">
          <div className="flex items-center gap-1.5 bg-slate-950 px-2.5 py-1.5 rounded-xl border border-slate-800 text-xs font-bold text-slate-400">
            <span>Combat type:</span>
            <select value={combatTypeFilter} onChange={(e) => setCombatTypeFilter(e.target.value as AvatarCombatType | 'All')}
              className="bg-transparent text-cyan-300 font-bold focus:outline-none cursor-pointer">
              <option value="All">All types</option>
              {AVATAR_COMBAT_TYPES.map(type => <option key={type} value={type}>{type}</option>)}
            </select>
          </div>
          <div className="flex items-center gap-1.5 bg-slate-950 px-2.5 py-1.5 rounded-xl border border-slate-800">
            <ArrowUpDown className="w-3.5 h-3.5 text-amber-400" />
            <span className="text-xs font-bold text-slate-400">Filter by:</span>
            <select
              value={filterBy}
              onChange={(e) => {
                sound.playClick();
                setFilterBy(e.target.value as any);
              }}
              className="bg-transparent text-amber-300 font-bold text-xs focus:outline-none cursor-pointer"
            >
              <option value="Name" className="bg-slate-900 text-amber-300">Name (A–Z) [Default]</option>
              <option value="Role" className="bg-slate-900 text-white">Combat Role</option>
              <option value="Archetype" className="bg-slate-900 text-white">Archetype</option>
              <option value="HP" className="bg-slate-900 text-white">Base HP (Highest)</option>
              <option value="AD" className="bg-slate-900 text-white">Attack Damage (Highest)</option>
              <option value="Range" className="bg-slate-900 text-white">Range (Longest)</option>
            </select>
          </div>

          <div className="relative min-w-[190px]">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search avatar or title..."
              className="w-full bg-slate-950 text-white placeholder-slate-500 text-xs pl-8 pr-3 py-1.5 rounded-xl border border-slate-800 focus:outline-none focus:border-cyan-400"
            />
          </div>
        </div>
      </div>

      {/* Champion Selector Ribbon */}
      <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 xl:grid-cols-10 gap-2.5 max-h-72 overflow-y-auto p-2 bg-slate-950/60 rounded-2xl border border-slate-800">
        {filteredChampions.map((c) => {
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
              <div 
                className="w-14 h-14 rounded-full flex items-center justify-center p-1 border shadow-md"
                style={{ borderColor: c.primaryColor, backgroundColor: `${c.primaryColor}20` }}
              >
                <ChampionArtwork championId={c.id} size={48} />
              </div>
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
        {/* Left Column: Visual Artwork & Combat Stats & Lore */}
        <div className="lg:col-span-5 bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-2xl flex flex-col items-center text-center space-y-4">
          <div className="relative">
            <div
              className="w-44 h-44 rounded-full flex items-center justify-center p-2 shadow-2xl border-4"
              style={{ borderColor: selectedChamp.primaryColor, backgroundColor: `${selectedChamp.primaryColor}15` }}
            >
              <ChampionArtwork championId={selectedChamp.id} size={150} />
            </div>
          </div>

          <div>
            <h3 className="text-2xl font-black text-white tracking-wide">{selectedChamp.name}</h3>
            <div className="text-sm font-bold text-amber-300">{selectedChamp.title}</div>
            <div className="text-xs text-slate-400 mt-1">
              Role: <strong className="text-cyan-300">{selectedChamp.primaryRole}</strong>{selectedChamp.secondaryRole ? <span> / <strong className="text-emerald-300">{selectedChamp.secondaryRole}</strong></span> : null}
              <span className="text-slate-600"> · </span>
              <span className="text-purple-300 font-medium">{selectedChamp.archetype}</span>
            </div>
          </div>

          <div className="w-full rounded-2xl border border-slate-800 bg-slate-950/80 p-3 text-left">
            <div className="text-[11px] font-black uppercase tracking-wider text-cyan-300 mb-2">Combat types</div>
            <div className="grid grid-cols-3 gap-x-3 gap-y-2">
              {AVATAR_COMBAT_TYPES.map(type => {
                const strength = getAvatarCombatProfile(selectedChamp)[type];
                return <div key={type} className="min-w-0">
                  <div className={`text-[10px] font-semibold ${strength ? 'text-slate-200' : 'text-slate-500'}`}>{type}</div>
                  <div className="mt-1 h-1.5 rounded-full bg-slate-700 overflow-hidden">
                    <div className="h-full rounded-full bg-cyan-300" style={{ width: `${strength / 3 * 100}%` }} />
                  </div>
                </div>;
              })}
            </div>
            <p className="mt-2 text-[10px] text-slate-500">Shows how this avatar tends to play. Player IQ and teamfight skill decide when to use it.</p>
          </div>

          {/* Narrative Lore Section */}
          <div className="w-full text-left bg-slate-950/80 p-3.5 rounded-2xl border border-slate-800 space-y-1.5">
            <div className="text-[11px] font-black uppercase text-amber-400 tracking-wider flex items-center gap-1.5">
              <BookOpen className="w-3.5 h-3.5 text-amber-400" /> Narrative Lore & Legend:
            </div>
            <p className="text-xs text-slate-300 leading-relaxed italic font-serif">
              "{lore}"
            </p>
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

        {/* Right Column: Ability Breakdown & Interactive SFX Preview & Level 18 Rank Progression */}
        <div className="lg:col-span-7 bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-2xl space-y-5">
          <div className="border-b border-slate-800 pb-3 flex flex-wrap justify-between items-center gap-2">
            <div>
              <h4 className="text-sm font-black text-amber-300 uppercase tracking-wide">
                Complete Ability Kit & Level Progression
              </h4>
              <p className="text-xs text-slate-400 mt-0.5">
                {isKaelen
                  ? 'Kaelen: Q Ice · W Wind · E Fire · Conflux active innate · Two FIFO invoked slots (D/F), no ultimate.'
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
              <span>{isKaelen ? 'CONFLUX' : 'PASSIVE'}</span>
              <span className="text-[9px] font-normal truncate">{isKaelen ? 'Active Innate' : 'Innate (Always)'}</span>
            </button>

            <button
              onClick={() => { sound.playClick(); setActiveSkillTab('skill1'); }}
              className={`p-2.5 rounded-xl text-xs font-black transition flex flex-col items-center gap-0.5 ${
                activeSkillTab === 'skill1'
                  ? 'bg-cyan-400 text-slate-950 shadow-lg'
                  : 'bg-slate-950 text-slate-400 hover:text-white'
              }`}
            >
              <span>{isKaelen ? 'ORB OF ICE (Q)' : 'SKILL 1 (Q)'}</span>
              <span className="text-[9px] font-normal truncate">{isKaelen ? 'Elemental Orb' : 'Rank 1-7 (7 Levels)'}</span>
            </button>

            <button
              onClick={() => { sound.playClick(); setActiveSkillTab('skill2'); }}
              className={`p-2.5 rounded-xl text-xs font-black transition flex flex-col items-center gap-0.5 ${
                activeSkillTab === 'skill2'
                  ? 'bg-purple-400 text-slate-950 shadow-lg'
                  : 'bg-slate-950 text-slate-400 hover:text-white'
              }`}
            >
              <span>{isKaelen ? 'ORB OF WIND (W)' : 'SKILL 2 (W)'}</span>
              <span className="text-[9px] font-normal truncate">{isKaelen ? 'Elemental Orb' : 'Rank 1-7 (7 Levels)'}</span>
            </button>

            <button
              onClick={() => { sound.playClick(); setActiveSkillTab('ultimate'); }}
              className={`p-2.5 rounded-xl text-xs font-black transition flex flex-col items-center gap-0.5 ${
                activeSkillTab === 'ultimate'
                  ? 'bg-rose-500 text-white shadow-lg animate-pulse'
                  : 'bg-slate-950 text-slate-400 hover:text-white'
              }`}
            >
              <span>{isKaelen ? 'ORB OF FIRE (E)' : 'ULTIMATE (R)'}</span>
              <span className="text-[9px] font-normal truncate">{isKaelen ? 'Elemental Orb · Not an ultimate' : 'Rank 1-4 (4 Levels)'}</span>
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
                  <h5 className="text-base font-black text-amber-300">{isKaelen ? 'ACTIVE INNATE: CONFLUX' : 'PASSIVE: Innate Combat Trait'}</h5>
                  <span className="text-xs bg-amber-950 text-amber-300 px-2.5 py-0.5 rounded-full border border-amber-500/30 font-bold">
                    {isKaelen ? 'Press to Invoke · Level-scaled cooldown' : 'Innate (Always Available)'}
                  </span>
                </div>
                <p className="text-sm text-slate-300 leading-relaxed">{selectedChamp.passiveDesc}</p>
                <div className="text-xs text-slate-400 bg-slate-900/60 p-2.5 rounded-xl border border-white/5">
                  {isKaelen
                    ? 'Conflux consumes the oldest three-orb FIFO, creates a unique invoked spell, then adds it to D/F. Cooldown: 3s at levels 1-6, 2s at 7-12, 1s at 13-17, and 0s at level 18.'
                    : 'Innate traits do not require skill points and are active across all Levels 1 through 18.'}
                </div>
              </div>
            )}

            {activeSkillTab === 'skill1' && (
              <div className="space-y-3">
                <div className="flex flex-wrap justify-between items-center gap-2">
                  <h5 className="text-base font-black text-cyan-300">
                    Q: {selectedChamp.skill1.name}{!isKaelen && <span className="text-xs text-amber-300 font-bold">(Rank {clampedRank}/7)</span>}
                  </h5>
                  <div className="flex gap-2">
                    <span className="text-xs bg-slate-900 text-cyan-300 px-2 py-0.5 rounded border border-white/10 font-bold">
                      CD: {isKaelen ? selectedChamp.skill1.cooldown : getSkillCdAtRank(selectedChamp.skill1.cooldown || 10, clampedRank, false)}s
                    </span>
                    <span className="text-xs bg-slate-900 text-amber-300 px-2 py-0.5 rounded border border-white/10 font-bold">
                      {isKaelen ? 'Adds Ice orb · No direct damage' : `${selectedChamp.skill1.damageType} Dmg: ${getSkillDamageAtRank(selectedChamp.skill1.damage, clampedRank, false)}`}
                    </span>
                  </div>
                </div>
                <p className="text-sm text-slate-300 leading-relaxed">{selectedChamp.skill1.desc}</p>
                <div className="text-xs text-slate-400 bg-slate-900/60 p-2.5 rounded-xl border border-white/5">
                  {isKaelen ? 'Orb of Ice joins the three-element FIFO. It has its own cooldown and can be gathered without a target.' : `⭐ Basic Skill 1 upgrades across 7 milestones up to Level 18. Base Damage: ${selectedChamp.skill1.damage} | Base CD: ${selectedChamp.skill1.cooldown}s.`}
                </div>
                <button
                  onClick={() => handleTestSkill('s1')}
                  className="px-4 py-2 bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-black rounded-xl transition flex items-center gap-1.5 shadow"
                >
                  <Volume2 className="w-4 h-4" /> {isKaelen ? 'Preview Orb of Ice SFX' : 'Preview Skill 1 SFX'}
                </button>
              </div>
            )}

            {activeSkillTab === 'skill2' && (
              <div className="space-y-3">
                <div className="flex flex-wrap justify-between items-center gap-2">
                  <h5 className="text-base font-black text-purple-300">
                    W: {selectedChamp.skill2.name}{!isKaelen && <span className="text-xs text-amber-300 font-bold">(Rank {clampedRank}/7)</span>}
                  </h5>
                  <div className="flex gap-2">
                    <span className="text-xs bg-slate-900 text-purple-300 px-2 py-0.5 rounded border border-white/10 font-bold">
                      CD: {isKaelen ? selectedChamp.skill2.cooldown : getSkillCdAtRank(selectedChamp.skill2.cooldown || 10, clampedRank, false)}s
                    </span>
                    <span className="text-xs bg-slate-900 text-amber-300 px-2 py-0.5 rounded border border-white/10 font-bold">
                      {isKaelen ? 'Adds Wind orb · No direct damage' : `${selectedChamp.skill2.damageType} Dmg: ${getSkillDamageAtRank(selectedChamp.skill2.damage, clampedRank, false)}`}
                    </span>
                  </div>
                </div>
                <p className="text-sm text-slate-300 leading-relaxed">{selectedChamp.skill2.desc}</p>
                <div className="text-xs text-slate-400 bg-slate-900/60 p-2.5 rounded-xl border border-white/5">
                  {isKaelen ? 'Orb of Wind joins the three-element FIFO. It has its own cooldown and can be gathered without a target.' : `⭐ Basic Skill 2 upgrades across 7 milestones up to Level 18. Base Damage: ${selectedChamp.skill2.damage} | Base CD: ${selectedChamp.skill2.cooldown}s.`}
                </div>
                <button
                  onClick={() => handleTestSkill('s2')}
                  className="px-4 py-2 bg-purple-600 hover:bg-purple-500 text-white text-xs font-black rounded-xl transition flex items-center gap-1.5 shadow"
                >
                  <Volume2 className="w-4 h-4" /> {isKaelen ? 'Preview Orb of Wind SFX' : 'Preview Skill 2 SFX'}
                </button>
              </div>
            )}

            {activeSkillTab === 'ultimate' && isKaelen && (
              <div className="space-y-3">
                <div className="flex flex-wrap justify-between items-center gap-2">
                  <h5 className="text-base font-black text-orange-300">E: {selectedChamp.ultimate.name}</h5>
                  <span className="text-xs bg-slate-900 text-orange-200 px-2 py-0.5 rounded border border-orange-400/20 font-bold">
                    CD: {selectedChamp.ultimate.cooldown}s · Not an ultimate
                  </span>
                </div>
                <p className="text-sm text-slate-200 leading-relaxed font-medium">{selectedChamp.ultimate.desc}</p>
                <div className="rounded-xl border border-cyan-500/20 bg-slate-900/60 p-2.5 text-xs text-slate-300">
                  <strong className="text-cyan-200">D</strong> holds the oldest invocation and <strong className="text-orange-200">F</strong> the newest. A new Conflux result shifts the previous F spell to D and drops the old D spell (FIFO).
                </div>
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
                  <Zap className="w-4 h-4" /> Preview Orb of Fire SFX
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
                      {selectedChamp.ultimate.damageType} Dmg: {getSkillDamageAtRank(selectedChamp.ultimate.damage, clampedRank, true)}
                    </span>
                  </div>
                </div>
                <p className="text-sm text-slate-200 leading-relaxed font-medium">{selectedChamp.ultimate.desc}</p>
                <div className="text-xs text-slate-400 bg-slate-900/60 p-2.5 rounded-xl border border-white/5">
                  👑 Ultimate unlocks at Level 6 (Rank 1), ranks up at Level 11 (Rank 2), Level 16 (Rank 3), and hits maximum power at Level 18 (Rank 4)!
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
      </div>
    </div>
  );
};
