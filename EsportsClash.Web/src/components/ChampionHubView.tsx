import React, { useState } from 'react';
import { AvatarComponentInventory } from './AvatarComponentInventory';
import { MirellePatternBook } from './MirellePatternBook';
import { ContentImage } from './ContentImage';
import { ChampionKit, PlayerCard, AvatarRole, AvatarCombatType } from '../types';
import { AVATAR_COMBAT_TYPES, getAvatarCombatProfile } from '../avatarCombatRoles';
import { ChampionArtwork } from './ChampionArtwork';
import { AvatarModelPreview } from './AvatarModelPreview';
import { MeshyRiggingStudio } from './MeshyRiggingStudio';
import { ChibiAvatar } from './ChibiAvatar';
import { sound } from '../audio';
import { getChampionLore } from '../championLore';
import { getAbilityPresentation } from '../abilityPresentation';
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
  const [selection, setSelectedChamp] = useState<ChampionKit>(champions[0]);
  const selectedChamp=champions.find(champion=>champion.id===selection.id)??champions[0];
  const [activeSkillTab, setActiveSkillTab] = useState<'passive' | 'skill1' | 'skill2' | 'ultimate'>('ultimate');
  const [roleFilter, setRoleFilter] = useState<AvatarRole | 'All'>('All');
  const [combatTypeFilter, setCombatTypeFilter] = useState<AvatarCombatType | 'All'>('All');
  const [filterBy, setFilterBy] = useState<'Name' | 'Role' | 'Archetype' | 'HP' | 'AD' | 'Range'>('Name');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [showRiggingStudio, setShowRiggingStudio] = useState<boolean>(false);

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

  const lore = selectedChamp.lore ?? getChampionLore(selectedChamp.id);

  const activePresentation=activeSkillTab==='passive'?undefined:getAbilityPresentation(selectedChamp,activeSkillTab);

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
        <AvatarComponentInventory avatarId={selectedChamp.id} />
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

          <AvatarModelPreview champion={selectedChamp} ability={activeSkillTab} />

          <div className="flex justify-end mt-1">
            <button
              type="button"
              onClick={() => { sound.playClick(); setShowRiggingStudio(true); }}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-gradient-to-r from-cyan-600 to-blue-600 hover:brightness-110 text-white text-xs font-bold shadow-lg transition"
            >
              <Sparkles className="w-3.5 h-3.5 text-cyan-200" /> Open 3D Rigging Studio (Meshy AI)
            </button>
          </div>

          {showRiggingStudio && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-3 md:p-6 bg-black/80 backdrop-blur-md animate-fade-in">
              <div className="relative w-full max-w-6xl max-h-[92vh] flex flex-col overflow-hidden rounded-2xl border border-slate-700 bg-slate-950 shadow-2xl">
                <MeshyRiggingStudio
                  champion={selectedChamp}
                  onClose={() => setShowRiggingStudio(false)}
                />
              </div>
            </div>
          )}

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

        <div className="border-t border-slate-800 pt-4 space-y-4">
          <h4 className="text-sm font-black text-amber-300 uppercase">Original ability kit</h4>
          <p className="text-xs text-slate-400">Authored effects are active. Artwork and complete gameplay qualification are still pending.</p>
          <div className="grid grid-cols-4 gap-2">{(['passive','skill1','skill2','ultimate'] as const).map((slot,index)=><button key={slot} onClick={()=>setActiveSkillTab(slot)} aria-pressed={activeSkillTab===slot}
            className={`rounded-lg border p-2 text-xs font-black ${activeSkillTab===slot?'border-cyan-300 bg-cyan-950 text-white':'border-slate-700 text-slate-400'}`}>
            {['Passive','Q ? Skill 1','W ? Skill 2','R ? Ultimate'][index]}</button>)}</div>
          <div className="rounded-xl border border-slate-700 bg-slate-950 p-4 space-y-3">
            <ContentImage image={activeSkillTab==='passive'?selectedChamp.passiveImage:selectedChamp[activeSkillTab].image} name={activeSkillTab==='passive'?selectedChamp.passiveName??'Passive':selectedChamp[activeSkillTab].name}/>
            <h5 className="font-black text-cyan-200">{activeSkillTab==='passive'?selectedChamp.passiveName??'Passive':selectedChamp[activeSkillTab].name}</h5>
            <p className="text-sm text-slate-200">{activeSkillTab==='passive'?selectedChamp.passiveDesc:selectedChamp[activeSkillTab].desc}</p>
            {activePresentation&&<p className="text-xs text-amber-200">{activePresentation.cooldown}s base cooldown ? {activePresentation.manaCost} mana ? geometry and setup as described above</p>}
            {activeSkillTab!=='passive'&&selectedChamp[activeSkillTab].disabled&&<p className="text-amber-300">This slot is disabled in the current catalog.</p>}
            {activeSkillTab==='ultimate'&&selectedChamp.id==='c_invoker'&&<MirellePatternBook/>}
            {activeSkillTab!=='passive'&&<button className="rounded border border-cyan-700 px-3 py-2 text-xs" onClick={()=>handleTestSkill(activeSkillTab==='ultimate'?'ult':activeSkillTab==='skill1'?'s1':'s2')}>Preview sound</button>}
          </div>
        </div>
        </section>
      </div>
    </div>
  );
};
