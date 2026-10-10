import React, { useState } from 'react';
import { AvatarRole, CardTier, CoachCard, GameOrigin, PlayerCard } from '../types';
import { CardComponent } from './CardComponent';
import { sound } from '../audio';
import { Shield, Sparkles, Users, RefreshCw, Search, SlidersHorizontal } from 'lucide-react';
import { filterReserveCards, type ReserveFilters } from '../reserveFilters';

interface SquadViewProps {
  startingFive: PlayerCard[];
  bench: PlayerCard[];
  coach?: CoachCard;
  onSwapPlayer: (startingIndex: number, benchId: string) => void;
  onRecycleDuplicates?: () => void;
  duplicateCount?: number;
  duplicateValue?: number;
}

export const SquadView: React.FC<SquadViewProps> = ({
  startingFive,
  bench,
  coach,
  onSwapPlayer,
  onRecycleDuplicates,
  duplicateCount = 0,
  duplicateValue = 0
}) => {
  const [inspectCard, setInspectCard] = useState<PlayerCard | null>(null);
  const [selectedStartingIdx, setSelectedStartingIdx] = useState<number | null>(null);
  const [reserveFilters, setReserveFilters] = useState<ReserveFilters>({ query: '', role: 'all', origin: 'all', tier: 'all', sort: 'rating' });
  const [reservePage, setReservePage] = useState(1);
  const reservePageSize = 18;
  const filteredBench = filterReserveCards(bench, reserveFilters);
  const reservePages = Math.max(1, Math.ceil(filteredBench.length / reservePageSize));
  const visiblePage = Math.min(reservePage, reservePages);
  const visibleBench = filteredBench.slice((visiblePage - 1) * reservePageSize, visiblePage * reservePageSize);
  const updateReserveFilter = <K extends keyof ReserveFilters>(key: K, value: ReserveFilters[K]) => {
    setReserveFilters(current => ({ ...current, [key]: value }));
    setReservePage(1);
  };

  // Chemistry Calculation: based on shared game origins & coach bonus
  const originCounts: { [k: string]: number } = {};
  startingFive.forEach((p) => {
    originCounts[p.origin] = (originCounts[p.origin] || 0) + 1;
  });
  const maxSynergy = Math.max(...Object.values(originCounts), 1);
  const chemistryScore = Math.min(100, maxSynergy * 20 + (coach?.chemistryBonus || 0) + 20);

  const handleStartingSlotClick = (idx: number) => {
    sound.playClick();
    if (selectedStartingIdx === idx) setSelectedStartingIdx(null);
    else setSelectedStartingIdx(idx);
  };

  const handleBenchClick = (benchCard: PlayerCard) => {
    sound.playClick();
    if (selectedStartingIdx !== null) {
      onSwapPlayer(selectedStartingIdx, benchCard.id);
      setSelectedStartingIdx(null);
    } else {
      setInspectCard(benchCard);
    }
  };

  const teamAvgOvr = Math.round(startingFive.reduce((acc, p) => acc + p.ovr, 0) / Math.max(1, startingFive.length));

  const FORMATION_SLOTS = [
    { roleName: 'FRONTLINE', icon: '🛡️', roleDesc: 'Tank / Fighter Anchor', color: 'border-orange-500/40 bg-orange-500/10 text-orange-300' },
    { roleName: 'SKIRMISHER', icon: '⚔️', roleDesc: 'Assassin / Flanker', color: 'border-rose-500/40 bg-rose-500/10 text-rose-300' },
    { roleName: 'CORE PLAYMAKER', icon: '🔮', roleDesc: 'Mage / Arcane Control', color: 'border-purple-500/40 bg-purple-500/10 text-purple-300' },
    { roleName: 'DAMAGE CARRY', icon: '🏹', roleDesc: 'Marksman / Sustained DPS', color: 'border-cyan-500/40 bg-cyan-500/10 text-cyan-300' },
    { roleName: 'TACTICAL SUPPORT', icon: '💚', roleDesc: 'Support / Protection', color: 'border-emerald-500/40 bg-emerald-500/10 text-emerald-300' },
  ];

  return (
    <div className="space-y-6 animate-fade-in max-w-7xl mx-auto px-2 sm:px-4">
      {/* Squad Overview Banner */}
      <div className="bg-slate-900 border border-slate-700/80 rounded-2xl p-4 shadow-xl flex flex-wrap justify-between items-center gap-4">
        <div>
          <h2 className="text-xl font-black text-white flex items-center gap-2">
            <Users className="w-5 h-5 text-amber-400" />
            SQUAD MANAGEMENT & TACTICAL LINEUP
          </h2>
          <p className="text-slate-400 text-xs mt-0.5">
            Set your Starting 5 for the Clash Arena split matches. Click a starter then click a bench player to swap!
          </p>
        </div>

        <div className="flex items-center gap-4 text-xs font-bold">
          <div className="bg-black/40 px-3 py-1.5 rounded-lg border border-amber-400/30 flex items-center gap-2">
            <span className="text-lg font-black text-amber-300">{teamAvgOvr}</span>
            <span className="text-slate-300">Team OVR</span>
          </div>
          <div className="bg-black/40 px-3 py-1.5 rounded-lg border border-white/10 flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-amber-400" />
            <span>Squad Chemistry: <strong className="text-amber-300">{chemistryScore}/100</strong></span>
          </div>
          {coach && (
            <div className="bg-black/40 px-3 py-1.5 rounded-lg border border-white/10 flex items-center gap-2">
              <Shield className="w-4 h-4 text-cyan-400" />
              <span>Coach: <strong className="text-cyan-300">{coach.name} ({coach.style})</strong></span>
            </div>
          )}
        </div>
      </div>

      {/* Starting 5 Lineup Formation */}
      <div className="bg-gradient-to-b from-indigo-950/40 via-slate-900 to-slate-950 border border-slate-800 rounded-3xl p-5 md:p-6 shadow-2xl">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
          <div className="flex items-center gap-3">
            <h3 className="text-sm font-black uppercase text-amber-300 tracking-wider flex items-center gap-2">
              <span>Starting 5 (Active Combat Formation)</span>
            </h3>
            <span className="text-xs bg-cyan-400/10 border border-cyan-400/30 text-cyan-300 px-2.5 py-0.5 rounded-full font-bold">
              Tactical 5v5 Combat Formation
            </span>
          </div>

          {selectedStartingIdx !== null ? (
            <span className="text-amber-300 font-bold text-xs animate-pulse flex items-center gap-1.5 bg-amber-400/10 border border-amber-400/30 px-3 py-1 rounded-xl">
              <RefreshCw className="w-3.5 h-3.5 animate-spin" /> Substitute Slot #{selectedStartingIdx + 1} ({FORMATION_SLOTS[selectedStartingIdx].roleName}) - Select a player from Club Reserves below
            </span>
          ) : (
            <span className="text-slate-400 text-xs font-medium">
              Click any starter card to substitute from reserves or swap position
            </span>
          )}
        </div>

        {/* Tactical Synergy Connectors Banner */}
        <div className="hidden lg:grid grid-cols-4 gap-2 mb-3 px-8 text-center text-[10px] font-bold text-slate-400">
          <div className="bg-black/30 border border-white/5 py-1 rounded-lg">🛡️ Frontline-Skirmisher Dive Axis (+8)</div>
          <div className="bg-black/30 border border-white/5 py-1 rounded-lg">⚡ Arcane-Skirmisher Burst Synergy (+12)</div>
          <div className="bg-black/30 border border-white/5 py-1 rounded-lg">🎯 Core Carry DPS Focus (+10)</div>
          <div className="bg-black/30 border border-white/5 py-1 rounded-lg">💚 Carry-Protector Peel Bond (+15)</div>
        </div>

        {/* 5 Starting Cards Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3 xl:gap-4 justify-items-center">
          {startingFive.map((player, idx) => {
            const slot = FORMATION_SLOTS[idx];
            const isSelected = selectedStartingIdx === idx;
            return (
              <div 
                key={player.id} 
                className={`flex flex-col items-center w-full max-w-[230px] rounded-2xl p-2 transition-all duration-200 ${
                  isSelected ? 'bg-amber-400/10 border-2 border-amber-400 shadow-xl shadow-amber-400/10' : 'bg-slate-950/40 border border-white/5'
                }`}
              >
                {/* Slot Position Header */}
                <div className="w-full min-h-[43px] flex flex-col justify-center gap-0.5 px-2 py-1 mb-2 bg-slate-950/80 rounded-xl border border-white/5 text-[10px]">
                  <span className="font-black text-amber-300 flex items-center gap-1 leading-tight">
                    <span>{slot.icon}</span>
                    <span>{slot.roleName}</span>
                  </span>
                  <span className="text-[9px] text-slate-400 font-semibold leading-tight line-clamp-2" title={slot.roleDesc}>
                    {slot.roleDesc}
                  </span>
                </div>

                {/* Card Container */}
                <CardComponent
                  card={player}
                  selected={isSelected}
                  onClick={() => handleStartingSlotClick(idx)}
                />

                {/* Slot Actions Bar */}
                <div className="w-full flex items-center justify-between gap-2 mt-auto pt-2.5 border-t border-white/5">
                  <button
                    onClick={() => handleStartingSlotClick(idx)}
                    className={`flex-1 text-[11px] font-black py-1 px-2 rounded-lg transition flex items-center justify-center gap-1 ${
                      isSelected ? 'bg-amber-400 text-slate-950 font-black' : 'bg-slate-800 hover:bg-slate-700 text-slate-200'
                    }`}
                  >
                    <RefreshCw className="w-3 h-3" />
                    <span>{isSelected ? 'Selecting...' : 'Swap'}</span>
                  </button>
                  <button
                    onClick={() => setInspectCard(player)}
                    className="text-[11px] font-semibold text-slate-400 hover:text-white px-2 py-1 rounded-lg hover:bg-white/5 transition"
                  >
                    Inspect
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Club Reserves & Bench */}
      <div className="bg-gradient-to-b from-slate-900 via-slate-900 to-slate-950 border border-slate-700/70 rounded-3xl p-5 md:p-6 shadow-2xl">
        <div className="flex flex-wrap items-start justify-between gap-3 mb-5">
          <div>
            <div className="flex items-center gap-2 text-cyan-300 text-[10px] font-black uppercase tracking-[0.2em] mb-1"><SlidersHorizontal className="w-4 h-4" /> Roster scouting</div>
            <h3 className="text-lg font-black text-white">Club Reserves <span className="text-slate-400 font-semibold">/ {bench.length} players</span></h3>
            <p className="text-xs text-slate-400 mt-1">Search your club and pick a reserve to inspect or substitute.</p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <div className="rounded-xl border border-cyan-400/20 bg-cyan-400/5 px-3 py-2 text-xs font-bold text-cyan-200">
              {filteredBench.length} matching cards
            </div>
            {onRecycleDuplicates && duplicateCount > 0 && (
              <button
                onClick={() => {
                  sound.playCoin();
                  onRecycleDuplicates();
                }}
                className="rounded-xl border border-amber-500/40 bg-gradient-to-r from-amber-500/20 to-yellow-500/20 px-3 py-2 text-xs font-black text-amber-300 hover:brightness-125 transition flex items-center gap-1.5 shadow cursor-pointer animate-pulse"
                title="Recycle all duplicate cards into Clash Coins, keeping your highest OVR version of each player"
              >
                <span>🪙</span>
                <span>Recycle {duplicateCount} Duplicates (+{duplicateValue.toLocaleString()} Coins)</span>
              </button>
            )}
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-[minmax(180px,1.4fr)_repeat(4,minmax(0,1fr))] gap-2 mb-5">
          <label className="relative col-span-2 md:col-span-3 xl:col-span-1">
            <span className="sr-only">Search reserves by player name</span>
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
            <input value={reserveFilters.query} onChange={event => updateReserveFilter('query', event.target.value)} placeholder="Search player name"
              className="w-full h-10 rounded-xl border border-slate-700 bg-slate-950/70 pl-9 pr-3 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-cyan-400" />
          </label>
          <label className="sr-only" htmlFor="reserve-role">Filter reserves by role</label>
          <select id="reserve-role" value={reserveFilters.role} onChange={event => updateReserveFilter('role', event.target.value as AvatarRole | 'all')}
            className="h-10 rounded-xl border border-slate-700 bg-slate-950/70 px-3 text-xs text-slate-200 focus:outline-none focus:border-cyan-400">
            <option value="all">All roles</option>
            {(['Tank', 'Fighter', 'Assassin', 'Mage', 'Marksman', 'Support'] as AvatarRole[]).map(role => <option key={role} value={role}>{role}</option>)}
          </select>
          <label className="sr-only" htmlFor="reserve-origin">Filter reserves by game</label>
          <select id="reserve-origin" value={reserveFilters.origin} onChange={event => updateReserveFilter('origin', event.target.value as GameOrigin | 'all')}
            className="h-10 rounded-xl border border-slate-700 bg-slate-950/70 px-3 text-xs text-slate-200 focus:outline-none focus:border-cyan-400">
            <option value="all">All games</option>
            {(['LoL', 'Dota2', 'CS', 'Valorant'] as GameOrigin[]).map(origin => <option key={origin} value={origin}>{origin}</option>)}
          </select>
          <label className="sr-only" htmlFor="reserve-tier">Filter reserves by tier</label>
          <select id="reserve-tier" value={reserveFilters.tier} onChange={event => updateReserveFilter('tier', event.target.value as CardTier | 'all')}
            className="h-10 rounded-xl border border-slate-700 bg-slate-950/70 px-3 text-xs text-slate-200 focus:outline-none focus:border-cyan-400">
            <option value="all">All tiers</option>
            {(['GOAT', 'Diamond', 'Platinum', 'Gold', 'Silver', 'Bronze'] as CardTier[]).map(tier => <option key={tier} value={tier}>{tier}</option>)}
          </select>
          <label className="sr-only" htmlFor="reserve-sort">Sort reserves</label>
          <select id="reserve-sort" value={reserveFilters.sort} onChange={event => updateReserveFilter('sort', event.target.value as ReserveFilters['sort'])}
            className="h-10 rounded-xl border border-slate-700 bg-slate-950/70 px-3 text-xs text-slate-200 focus:outline-none focus:border-cyan-400">
            <option value="rating">Highest OVR</option>
            <option value="name">Name A–Z</option>
          </select>
        </div>

        {bench.length === 0 ? (
          <div className="text-center py-6 text-slate-500 text-xs">
            No bench reserves. Open more packs in the Store to build squad depth!
          </div>
        ) : (
          <>
            {visibleBench.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-slate-700 bg-slate-950/40 py-10 text-center text-slate-400 text-xs">No reserves match these filters.</div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-3">
                {visibleBench.map(player => <CardComponent key={player.id} card={player} compact onClick={() => handleBenchClick(player)} />)}
              </div>
            )}
            {reservePages > 1 && (
              <div className="flex items-center justify-between gap-3 mt-5 pt-4 border-t border-slate-700/60 text-xs text-slate-400">
                <span>Page {visiblePage} of {reservePages}</span>
                <div className="flex gap-2">
                  <button disabled={visiblePage === 1} onClick={() => setReservePage(page => Math.max(1, page - 1))} className="rounded-lg border border-slate-700 px-3 py-1.5 text-white disabled:opacity-40 hover:border-cyan-400">Previous</button>
                  <button disabled={visiblePage === reservePages} onClick={() => setReservePage(page => Math.min(reservePages, page + 1))} className="rounded-lg border border-slate-700 px-3 py-1.5 text-white disabled:opacity-40 hover:border-cyan-400">Next</button>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* Full Screen Card Inspector Modal */}
      {inspectCard && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-3xl p-6 shadow-2xl max-w-md w-full relative animate-fade-in flex flex-col items-center">
            <button
              onClick={() => setInspectCard(null)}
              className="absolute top-4 right-4 text-slate-400 hover:text-white font-bold"
            >
              ✕
            </button>
            <CardComponent card={inspectCard} />
            <div className="mt-4 w-full space-y-2 text-xs">
              <div className="flex justify-between items-center bg-black/40 px-3 py-1.5 rounded-xl border border-white/5">
                <span className="text-slate-400">Playable Roles:</span>
                <strong className="text-amber-300 uppercase">{(inspectCard.playableRoles && inspectCard.playableRoles.length > 0 ? inspectCard.playableRoles : [inspectCard.preferredRole || inspectCard.role || 'Pro']).join(' · ')}</strong>
              </div>
              <div className="flex justify-between items-center bg-black/40 px-3 py-1.5 rounded-xl border border-white/5">
                <span className="text-slate-400">Evolution Status:</span>
                <strong className={inspectCard.isEvo ? 'text-emerald-400 flex items-center gap-1' : 'text-slate-400'}>
                  {inspectCard.isEvo ? `✦ EVO Level ${inspectCard.evolutionLevel || 1}` : 'Standard Card (Ready for Evo)'}
                </strong>
              </div>
              <div className="text-center text-slate-400 pt-1">
                Signature Champions: <strong className="text-white">{inspectCard.signatureChampions.join(', ')}</strong>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

