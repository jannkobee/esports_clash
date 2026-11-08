import React, { useState } from 'react';
import { AvatarComponentInventory } from './AvatarComponentInventory';
import { MirellePatternBook } from './MirellePatternBook';
import { ContentImage } from './ContentImage';
import { ChampionKit, PlayerCard, AvatarRole, AvatarCombatType } from '../types';
import { AVATAR_COMBAT_TYPES, getAvatarCombatProfile } from '../avatarCombatRoles';
import { ChampionArtwork } from './ChampionArtwork';
import { AvatarModelPreview } from './AvatarModelPreview';
import { ChibiAvatar } from './ChibiAvatar';
import { sound } from '../audio';
import { getChampionLore } from '../championLore';
import { getAbilityPresentation } from '../abilityPresentation';
import {
  Shield,
  Swords,
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
  const selectedChamp = champions.find((champion) => champion.id === selection.id) ?? champions[0];
  const [activeSkillTab, setActiveSkillTab] = useState<'passive' | 'skill1' | 'skill2' | 'ultimate'>('ultimate');
  const [roleFilter, setRoleFilter] = useState<AvatarRole | 'All'>('All');
  const [combatTypeFilter, setCombatTypeFilter] = useState<AvatarCombatType | 'All'>('All');
  const [filterBy, setFilterBy] = useState<'Name' | 'Role' | 'Archetype' | 'HP' | 'AD' | 'Range'>('Name');
  const [searchQuery, setSearchQuery] = useState<string>('');

  const filteredChampions = [...champions]
    .filter((c) => {
      const matchesRole = roleFilter === 'All' || c.primaryRole === roleFilter || c.secondaryRole === roleFilter;
      const matchesCombatType = combatTypeFilter === 'All' || getAvatarCombatProfile(c)[combatTypeFilter] > 0;
      const matchesSearch =
        !searchQuery ||
        c.displayName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        c.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        c.archetype.toLowerCase().includes(searchQuery.toLowerCase()) ||
        AVATAR_COMBAT_TYPES.some(
          (type) => type.toLowerCase().includes(searchQuery.toLowerCase()) && getAvatarCombatProfile(c)[type] > 0
        );
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

  const signatureAthletes = allPlayers.filter((p) => p.signatureChampions.includes(selectedChamp.name));

  const handleTestSkill = (type: 's1' | 's2' | 'ult') => {
    sound.playAvatarSkill(selectedChamp.name, type === 'ult' ? 'ultimate' : type === 's1' ? 'skill1' : 'skill2');
  };

  const lore = selectedChamp.lore ?? getChampionLore(selectedChamp.id);
  const activePresentation =
    activeSkillTab === 'passive' ? undefined : getAbilityPresentation(selectedChamp, activeSkillTab);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
      {/* LEFT COLUMN: AVATAR DIRECTORY & FILTERS */}
      <section className="cm-panel lg:col-span-5 min-w-0">
        <div className="cm-panel-header">
          <span className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-[#f2c14e]" />
            <span>Avatar Roster Directory ({filteredChampions.length})</span>
          </span>
        </div>

        <div className="cm-panel-body space-y-3">
          {/* Role Filter Buttons */}
          <div className="flex flex-wrap gap-1">
            {(['All', 'Assassin', 'Fighter', 'Mage', 'Marksman', 'Support', 'Tank'] as const).map((r) => (
              <button
                type="button"
                key={r}
                onClick={() => {
                  sound.playClick();
                  setRoleFilter(r);
                }}
                className={`cm-btn py-1 px-2 text-xs ${roleFilter === r ? 'cm-btn-primary' : ''}`}
              >
                {r}
              </button>
            ))}
          </div>

          {/* Search + Combat Type + Sort */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-[#566173] absolute left-2.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search avatar..."
                className="cm-input w-full pl-8"
              />
            </div>

            <select
              value={combatTypeFilter}
              onChange={(e) => setCombatTypeFilter(e.target.value as AvatarCombatType | 'All')}
              aria-label="Filter by combat type"
              className="cm-select"
            >
              <option value="All">All Combat Types</option>
              {AVATAR_COMBAT_TYPES.map((type) => (
                <option key={type} value={type}>
                  {type}
                </option>
              ))}
            </select>

            <div className="flex items-center gap-1">
              <ArrowUpDown className="w-3.5 h-3.5 text-[#566173] shrink-0" />
              <select
                value={filterBy}
                onChange={(e) => {
                  sound.playClick();
                  setFilterBy(e.target.value as 'Name' | 'Role' | 'Archetype' | 'HP' | 'AD' | 'Range');
                }}
                aria-label="Sort avatars"
                className="cm-select w-full"
              >
                <option value="Name">Name (A–Z)</option>
                <option value="Role">Combat Role</option>
                <option value="Archetype">Archetype</option>
                <option value="HP">Base HP (Highest)</option>
                <option value="AD">Attack Damage</option>
                <option value="Range">Range (Longest)</option>
              </select>
            </div>
          </div>

          {/* Avatar Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 max-h-[65vh] overflow-y-auto p-0.5">
            {filteredChampions.length === 0 ? (
              <p className="col-span-full p-4 text-xs text-[#566173] text-center bg-white border border-[#b4bcc8]">
                No avatars match these filters.
              </p>
            ) : (
              filteredChampions.map((c) => {
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
                    className={`min-w-0 p-2 border transition flex flex-col items-center text-center cursor-pointer ${
                      isSelected
                        ? 'bg-[#fff3d1] border-2 border-[#c8961e]'
                        : 'bg-white border-[#b4bcc8] hover:bg-[#f6f8fb]'
                    }`}
                  >
                    <div
                      className="w-11 h-11 flex items-center justify-center p-1 border mb-1"
                      style={{ borderColor: c.primaryColor, backgroundColor: '#0b1f44' }}
                    >
                      <ChampionArtwork championId={c.id} size={36} />
                    </div>
                    <div className="w-full font-black text-[#0b1f44] text-xs truncate">{c.displayName}</div>
                    <div className="text-[10px] text-[#143570] font-bold">{c.primaryRole}</div>
                    <div className="text-[10px] text-[#566173] truncate max-w-full">{c.archetype}</div>
                  </button>
                );
              })
            )}
          </div>
        </div>
      </section>

      {/* RIGHT COLUMN: SELECTED AVATAR DOSSIER */}
      <section className="cm-panel lg:col-span-7 min-w-0">
        <div className="cm-panel-header">
          <span>
            Avatar Technical Dossier · {selectedChamp.displayName} ({selectedChamp.title})
          </span>
          <span className="cm-badge cm-badge-gold">{selectedChamp.primaryRole}</span>
        </div>

        <div className="cm-panel-body space-y-4">
          <AvatarComponentInventory avatarId={selectedChamp.id} />

          {/* Header Summary */}
          <div className="bg-white border border-[#b4bcc8] p-3 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div
                className="w-14 h-14 shrink-0 flex items-center justify-center p-1 border-2"
                style={{ borderColor: selectedChamp.primaryColor, backgroundColor: '#0b1f44' }}
              >
                <ChampionArtwork championId={selectedChamp.id} size={48} />
              </div>

              <div>
                <div className="flex flex-wrap items-baseline gap-2">
                  <h3 className="text-lg font-black text-[#0b1f44]">{selectedChamp.displayName}</h3>
                  <span className="text-xs font-bold text-[#b88406]">{selectedChamp.title}</span>
                </div>
                <div className="text-xs text-[#313a48] mt-0.5">
                  <strong>{selectedChamp.primaryRole}</strong>
                  {selectedChamp.secondaryRole ? <span> / {selectedChamp.secondaryRole}</span> : null} ·{' '}
                  <span className="text-[#566173]">{selectedChamp.archetype}</span>
                </div>
              </div>
            </div>

            <div className="flex flex-wrap gap-1">
              {AVATAR_COMBAT_TYPES.filter((type) => getAvatarCombatProfile(selectedChamp)[type] > 0).map((type) => (
                <span key={type} className="cm-badge cm-badge-blue">
                  {type}
                </span>
              ))}
            </div>
          </div>

          <AvatarModelPreview champion={selectedChamp} ability={activeSkillTab} />

          {/* Narrative Lore Section */}
          <div className="bg-white border border-[#b4bcc8] p-3 space-y-1">
            <div className="text-[11px] font-black uppercase text-[#0b1f44] flex items-center gap-1">
              <BookOpen className="w-3.5 h-3.5 text-[#143570]" /> Combat Dossier &amp; Lore:
            </div>
            <p className="text-xs text-[#313a48] leading-relaxed italic">&ldquo;{lore}&rdquo;</p>
          </div>

          {/* 6 Core In-Game Combat Stats */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs">
            <div className="flex justify-between items-center p-2 bg-white border border-[#b4bcc8]">
              <span className="text-[#566173] font-bold flex items-center gap-1">
                <Heart className="w-3.5 h-3.5 text-[#b91c1c]" /> Base HP:
              </span>
              <strong className="font-mono text-[#0b1f44]">{selectedChamp.hp}</strong>
            </div>

            <div className="flex justify-between items-center p-2 bg-white border border-[#b4bcc8]">
              <span className="text-[#566173] font-bold flex items-center gap-1">
                <Swords className="w-3.5 h-3.5 text-[#b88406]" /> Base AD:
              </span>
              <strong className="font-mono text-[#0b1f44]">{selectedChamp.ad}</strong>
            </div>

            <div className="flex justify-between items-center p-2 bg-white border border-[#b4bcc8]">
              <span className="text-[#566173] font-bold flex items-center gap-1">
                <Shield className="w-3.5 h-3.5 text-[#143570]" /> Armor:
              </span>
              <strong className="font-mono text-[#0b1f44]">{selectedChamp.armor}</strong>
            </div>

            <div className="flex justify-between items-center p-2 bg-white border border-[#b4bcc8]">
              <span className="text-[#566173] font-bold flex items-center gap-1">
                <Sparkles className="w-3.5 h-3.5 text-[#143570]" /> Magic Resist:
              </span>
              <strong className="font-mono text-[#0b1f44]">{selectedChamp.mr}</strong>
            </div>

            <div className="flex justify-between items-center p-2 bg-white border border-[#b4bcc8]">
              <span className="text-[#566173] font-bold flex items-center gap-1">
                <Activity className="w-3.5 h-3.5 text-[#127a3a]" /> Attack Speed:
              </span>
              <strong className="font-mono text-[#0b1f44]">{selectedChamp.aspd} /s</strong>
            </div>

            <div className="flex justify-between items-center p-2 bg-white border border-[#b4bcc8]">
              <span className="text-[#566173] font-bold flex items-center gap-1">
                <Crosshair className="w-3.5 h-3.5 text-[#127a3a]" /> Range:
              </span>
              <strong className="font-mono text-[#0b1f44]">{selectedChamp.range} units</strong>
            </div>
          </div>

          {/* Signature Athlete Pairings */}
          <div className="bg-white border border-[#b4bcc8] p-3">
            <div className="text-[11px] font-black uppercase text-[#0b1f44] mb-2 flex items-center gap-1">
              <Flame className="w-3.5 h-3.5 text-[#b88406]" /> Club Athletes with Signature Mastery (+10%):
            </div>
            {signatureAthletes.length === 0 ? (
              <div className="text-xs text-[#566173]">No current club athletes list this avatar as a signature pick.</div>
            ) : (
              <div className="flex flex-wrap gap-2">
                {signatureAthletes.map((ath) => (
                  <div
                    key={ath.id}
                    className="flex items-center gap-1.5 bg-[#eef1f5] px-2.5 py-1 border border-[#9aa4b4] text-xs font-bold text-[#0b1f44]"
                  >
                    <ChibiAvatar avatarType={ath.avatarSvg} size={20} />
                    <span>
                      {ath.name} ({ath.preferredRole || ath.role || 'Athlete'})
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Original Ability Kit */}
          <div className="pt-2 border-t border-[#c4cbd6] space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-black text-[#0b1f44] uppercase">Original Ability Kit</h4>
              <span className="text-[11px] text-[#566173]">Select slot to inspect ability parameters</span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {(['passive', 'skill1', 'skill2', 'ultimate'] as const).map((slot, index) => (
                <button
                  type="button"
                  key={slot}
                  onClick={() => setActiveSkillTab(slot)}
                  aria-pressed={activeSkillTab === slot}
                  className={`cm-btn py-1.5 text-xs ${activeSkillTab === slot ? 'cm-btn-primary' : ''}`}
                >
                  {['Passive', 'Q · Skill 1', 'W · Skill 2', 'R · Ultimate'][index]}
                </button>
              ))}
            </div>

            <div className="bg-white border border-[#9aa4b4] p-4 space-y-2.5">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                  <ContentImage
                    image={
                      activeSkillTab === 'passive'
                        ? selectedChamp.passiveImage
                        : selectedChamp[activeSkillTab].image
                    }
                    name={
                      activeSkillTab === 'passive'
                        ? selectedChamp.passiveName ?? 'Passive'
                        : selectedChamp[activeSkillTab].name
                    }
                  />
                  <div>
                    <h5 className="font-black text-sm text-[#0b1f44]">
                      {activeSkillTab === 'passive'
                        ? selectedChamp.passiveName ?? 'Passive'
                        : selectedChamp[activeSkillTab].name}
                    </h5>
                    {activePresentation && (
                      <div className="text-xs font-mono text-[#566173]">
                        {activePresentation.cooldown}s Cooldown · {activePresentation.manaCost} Mana
                      </div>
                    )}
                  </div>
                </div>

                {activeSkillTab !== 'passive' && (
                  <button
                    type="button"
                    className="cm-btn py-1 px-2.5 text-xs"
                    onClick={() =>
                      handleTestSkill(
                        activeSkillTab === 'ultimate' ? 'ult' : activeSkillTab === 'skill1' ? 's1' : 's2'
                      )
                    }
                  >
                    <Volume2 className="w-3.5 h-3.5" /> Preview SFX
                  </button>
                )}
              </div>

              <p className="text-xs text-[#11161f] leading-relaxed">
                {activeSkillTab === 'passive'
                  ? selectedChamp.passiveDesc
                  : selectedChamp[activeSkillTab].desc}
              </p>

              {activeSkillTab !== 'passive' && selectedChamp[activeSkillTab].disabled && (
                <p className="text-xs font-bold text-[#b91c1c]">This slot is disabled in the current catalog.</p>
              )}
              {activeSkillTab === 'ultimate' && selectedChamp.id === 'c_invoker' && <MirellePatternBook />}
            </div>
          </div>
        </div>
      </section>
    </div>
  );
};
