import React, { useEffect, useRef, useState } from 'react';
import { AvatarRole, CardTier, CoachCard, PlayerCard } from '../types';
import { PlayerProfileCard } from './PlayerProfileCard';
import { getPlayerMacroRegion } from './ChibiAvatar';
import { sound } from '../audio';
import { Users, RefreshCw, Search, LayoutList, Table as TableIcon } from 'lucide-react';
import { filterReserveCards, type ReserveFilters } from '../reserveFilters';
import { CHAMPIONS } from '../mockData';
import { avatarDisplayName } from '../avatarDisplayName';
import { toScale10, canBecomeCoach, resolveTeamCaptain } from '../marketBatchEngine';

interface SquadViewProps {
  startingFive: PlayerCard[];
  bench: PlayerCard[];
  coach?: CoachCard;
  onSwapPlayer: (startingIndex: number, benchId: string) => void;
  onUpdatePlayerRole?: (playerId: string, role: AvatarRole) => void;
  onRecycleDuplicates?: () => void;
  duplicateCount?: number;
  duplicateValue?: number;
  onReleasePlayer?: (player: PlayerCard) => void;
}

const ALL_ROLES: AvatarRole[] = ['Tank', 'Fighter', 'Assassin', 'Mage', 'Marksman', 'Support'];

export const SquadView: React.FC<SquadViewProps> = ({
  startingFive,
  bench,
  coach,
  onSwapPlayer,
  onUpdatePlayerRole,
  onRecycleDuplicates,
  duplicateCount = 0,
  duplicateValue = 0
}) => {
  const [inspectCard, setInspectCard] = useState<PlayerCard | null>(null);
  const inspectorRef = useRef<HTMLDivElement>(null);
  const [reserveViewMode, setReserveViewMode] = useState<'profiles' | 'table'>('profiles');

  useEffect(() => {
    if (!inspectCard) return;
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    inspectorRef.current?.querySelector<HTMLButtonElement>('button')?.focus();
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setInspectCard(null);
      if (event.key === 'Tab') {
        const buttons = inspectorRef.current?.querySelectorAll<HTMLElement>('button, [tabindex="0"]');
        if (!buttons?.length) return;
        const first = buttons[0],
          last = buttons[buttons.length - 1];
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener('keydown', handleKey);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener('keydown', handleKey);
      previousFocus?.focus();
    };
  }, [inspectCard]);

  const [selectedStartingIdx, setSelectedStartingIdx] = useState<number | null>(null);
  const [reserveFilters, setReserveFilters] = useState<ReserveFilters>({
    query: '',
    role: 'all',
    origin: 'all',
    tier: 'all',
    sort: 'rating'
  });
  const [reservePage, setReservePage] = useState(1);
  const reservePageSize = 10;
  const filteredBench = filterReserveCards(bench, reserveFilters);
  const reservePages = Math.max(1, Math.ceil(filteredBench.length / reservePageSize));
  const visiblePage = Math.min(reservePage, reservePages);
  const visibleBench = filteredBench.slice((visiblePage - 1) * reservePageSize, visiblePage * reservePageSize);

  const updateReserveFilter = <K extends keyof ReserveFilters>(key: K, value: ReserveFilters[K]) => {
    setReserveFilters((current) => ({ ...current, [key]: value }));
    setReservePage(1);
  };

  // Chemistry Calculation: based on regional synergy & coach bonus
  const regionCounts: { [k: string]: number } = {};
  startingFive.forEach((p) => {
    const reg = p.macroRegion || getPlayerMacroRegion(p.avatarSvg || p.name);
    regionCounts[reg] = (regionCounts[reg] || 0) + 1;
  });
  const maxSynergy = Math.max(...Object.values(regionCounts), 1);
  const chemistryScore = Math.min(100, maxSynergy * 20 + (coach?.chemistryBonus || 0) + 20);
  const captainInfo = resolveTeamCaptain(startingFive);

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
  const teamAvg10 = toScale10(teamAvgOvr);

  return (
    <div className="space-y-4">
      {/* Squad Overview Panel — Hattrick Horizontal Player List */}
      <div className="cm-panel">
        <div className="cm-panel-header">
          <span className="flex items-center gap-2">
            <Users className="w-4 h-4 text-[#f2c14e]" />
            <span>Starting five</span>
          </span>
          <div className="cm-inline-facts">
            <span>Overall <strong>{teamAvg10}/10</strong></span>
            <span>Chemistry <strong>{chemistryScore}/100</strong></span>
            {captainInfo && (
              <span>Captain <strong>{captainInfo.captainName}</strong></span>
            )}
            {coach && (
              <span>
                Coach <strong>{coach.name}</strong>
              </span>
            )}
          </div>
        </div>

        <div className="cm-panel-body space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2 bg-[#0f172a] border border-white/10 rounded-lg px-3 py-2 text-xs">
            {selectedStartingIdx !== null ? (
              <span className="font-bold text-amber-300 flex items-center gap-1.5">
                <RefreshCw className="w-3.5 h-3.5 text-amber-400" />
                <span>
                  Substituting Starter #{selectedStartingIdx + 1} ({startingFive[selectedStartingIdx]?.name} ·{' '}
                  {startingFive[selectedStartingIdx]?.preferredRole || startingFive[selectedStartingIdx]?.role}) · Choose a reserve below to complete the swap.
                </span>
              </span>
            ) : (
              <span className="text-slate-300">
                Select <strong>Swap starter</strong>, then choose a reserve. Open any profile to inspect all seven attributes.
              </span>
            )}

          </div>

          {/* Hattrick Vertical Stack of Horizontal Player Profile Blocks */}
          <div className="space-y-2.5">
            {startingFive.map((player, idx) => {
              const isSelected = selectedStartingIdx === idx;
              const currentRole = (player.preferredRole || player.role || 'Fighter') as AvatarRole;
              return (
                <PlayerProfileCard
                  key={player.id}
                  card={player}
                  shirtNumber={idx + 1}
                  selected={isSelected}
                  onClick={() => setInspectCard(player)}
                  actionSlot={
                    <div
                      className="flex flex-wrap items-center justify-between gap-2 w-full"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <div className="flex items-center gap-2 text-xs">
                        <span className="text-slate-400">
                          Assigned role
                        </span>
                        {onUpdatePlayerRole ? (
                          <select
                            aria-label={`Assign role position for ${player.name}`}
                            value={currentRole}
                            onChange={(e) => onUpdatePlayerRole(player.id, e.target.value as AvatarRole)}
                            className="cm-select text-xs"
                          >
                            {ALL_ROLES.map((r) => (
                              <option key={r} value={r}>
                                {r}
                              </option>
                            ))}
                          </select>
                        ) : (
                          <span className="text-slate-200">
                            {currentRole}
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => handleStartingSlotClick(idx)}
                          className={`cm-btn py-1 px-2.5 text-[11px] ${isSelected ? 'cm-btn-primary' : ''}`}
                        >
                          <RefreshCw className="w-3 h-3" />
                          <span>{isSelected ? 'Cancel swap' : 'Swap starter'}</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => setInspectCard(player)}
                          className="cm-btn py-1 px-2.5 text-[11px]"
                        >
                          Dossier
                        </button>
                      </div>
                    </div>
                  }
                />
              );
            })}
          </div>
        </div>
      </div>

      {/* Club Reserves & Bench */}
      <div className="cm-panel">
        <div className="cm-panel-header">
          <span>
            Club reserves · {filteredBench.length} of {bench.length}
          </span>
          <div className="flex flex-wrap items-center gap-2">
            {onRecycleDuplicates && duplicateCount > 0 && (
              <button
                type="button"
                onClick={() => {
                  sound.playCoin();
                  onRecycleDuplicates();
                }}
                className="cm-btn cm-btn-primary py-0.5 px-2.5 text-[11px]"
                title="Release duplicate contracts into Clash Coins, keeping your highest rated version of each player"
              >
                Release {duplicateCount} duplicates (+{duplicateValue.toLocaleString()} practice credits)
              </button>
            )}

            <div className="flex gap-1">
              <button
                type="button"
                onClick={() => setReserveViewMode('profiles')}
                className={`cm-btn py-0.5 px-2 text-[11px] ${reserveViewMode === 'profiles' ? 'cm-btn-primary' : ''}`}
              >
                <LayoutList className="w-3 h-3" />
                <span>Profiles</span>
              </button>
              <button
                type="button"
                onClick={() => setReserveViewMode('table')}
                className={`cm-btn py-0.5 px-2 text-[11px] ${reserveViewMode === 'table' ? 'cm-btn-primary' : ''}`}
              >
                <TableIcon className="w-3 h-3" />
                <span>Table</span>
              </button>
            </div>
          </div>
        </div>

        <div className="cm-panel-body space-y-3">
          {/* Reserve Filter Controls */}
          <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-[minmax(200px,1.5fr)_repeat(4,minmax(0,1fr))] gap-2">
            <label className="relative col-span-2 md:col-span-3 xl:col-span-1">
              <span className="sr-only">Search reserves by player name</span>
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-[#566173]" />
              <input
                value={reserveFilters.query}
                onChange={(event) => updateReserveFilter('query', event.target.value)}
                placeholder="Search player name..."
                className="cm-input w-full pl-8"
              />
            </label>
            <label className="sr-only" htmlFor="reserve-role">
              Filter reserves by role position
            </label>
            <select
              id="reserve-role"
              value={reserveFilters.role}
              onChange={(event) => updateReserveFilter('role', event.target.value as AvatarRole | 'all')}
              className="cm-select"
            >
              <option value="all">All Role Positions</option>
              {ALL_ROLES.map((role) => (
                <option key={role} value={role}>
                  {role}
                </option>
              ))}
            </select>
            <label className="sr-only" htmlFor="reserve-tier">
              Filter reserves by tier
            </label>
            <select
              id="reserve-tier"
              value={reserveFilters.tier}
              onChange={(event) => updateReserveFilter('tier', event.target.value as CardTier | 'all')}
              className="cm-select"
            >
              <option value="all">All Tiers</option>
              {(['GOAT', 'Diamond', 'Platinum', 'Gold', 'Silver', 'Bronze'] as CardTier[]).map((tier) => (
                <option key={tier} value={tier}>
                  {tier}
                </option>
              ))}
            </select>
            <label className="sr-only" htmlFor="reserve-sort">
              Sort reserves
            </label>
            <select
              id="reserve-sort"
              value={reserveFilters.sort}
              onChange={(event) => updateReserveFilter('sort', event.target.value as ReserveFilters['sort'])}
              className="cm-select"
            >
              <option value="rating">Highest Skill Rating (1–10)</option>
              <option value="name">Name A–Z</option>
            </select>
          </div>

          {bench.length === 0 ? (
            <div className="bg-[#0f172a] border border-white/10 rounded-lg py-8 text-center text-slate-400 text-xs">
              No bench reserves. Visit the Transfer Market to bid on new players!
            </div>
          ) : visibleBench.length === 0 ? (
            <div className="bg-[#0f172a] border border-white/10 rounded-lg py-8 text-center text-slate-400 text-xs">
              No reserves match these filters.
            </div>
          ) : reserveViewMode === 'table' ? (
            <div className="cm-table-wrap">
              <table className="cm-table">
                <thead>
                  <tr>
                    <th>Player</th>
                    <th>Age</th>
                    <th>Role Position</th>
                    <th>Rating</th>
                    <th>LAN</th>
                    <th>TF</th>
                    <th>IQ</th>
                    <th>LDR</th>
                    <th>CLU</th>
                    <th>STA</th>
                    <th>FLX</th>
                    <th>Coach?</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {visibleBench.map((player) => {
                    const coachCheck = canBecomeCoach(player);
                    return (
                      <tr key={player.id}>
                        <td className="font-bold">
                          {player.name}
                          {player.isEvo && <span className="ml-1.5 cm-badge cm-badge-green">EVO</span>}
                        </td>
                        <td className="font-mono text-xs">{player.age ?? 21}yo</td>
                        <td>{player.preferredRole || player.role}</td>
                        <td className="font-mono font-bold text-emerald-400">
                          {toScale10(player.ovr)}/10
                        </td>
                        <td className="font-mono">{toScale10(player.stats.lan)}</td>
                        <td className="font-mono">{toScale10(player.stats.tf)}</td>
                        <td className="font-mono">{toScale10(player.stats.iq)}</td>
                        <td className="font-mono font-bold text-amber-400">{toScale10(player.stats.ldr ?? 55)}</td>
                        <td className="font-mono">{toScale10(player.stats.clu)}</td>
                        <td className="font-mono">{toScale10(player.stats.sta)}</td>
                        <td className="font-mono">{toScale10(player.stats.flx)}</td>
                        <td>
                          {coachCheck.eligible ? (
                            <span className="cm-badge cm-badge-green text-[10px]">COACH</span>
                          ) : (
                            <span className="text-[10px] text-slate-500">—</span>
                          )}
                        </td>
                        <td>
                          <div className="flex items-center gap-1">
                            {selectedStartingIdx !== null && (
                              <button
                                type="button"
                                onClick={() => handleBenchClick(player)}
                                className="cm-btn cm-btn-primary py-0.5 px-2 text-[11px]"
                              >
                                Sub In
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={() => setInspectCard(player)}
                              className="cm-btn py-0.5 px-2 text-[11px]"
                            >
                              Dossier
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="space-y-2.5">
              {visibleBench.map((player, idx) => (
                <PlayerProfileCard
                  key={player.id}
                  card={player}
                  shirtNumber={idx + 6 + (visiblePage - 1) * reservePageSize}
                  onClick={() => handleBenchClick(player)}
                  actionSlot={
                    <div
                      className="flex items-center justify-between w-full text-xs"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <span className="text-[#4b5563]">
                        Role Position: <strong className="text-[#14532d]">{player.preferredRole || player.role}</strong>
                      </span>
                      <div className="flex items-center gap-1.5">
                        {selectedStartingIdx !== null && (
                          <button
                            type="button"
                            onClick={() => handleBenchClick(player)}
                            className="cm-btn cm-btn-primary py-0.5 px-2.5 text-[11px]"
                          >
                            ⇄ Substitute Into Starting Five
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => setInspectCard(player)}
                          className="cm-btn py-0.5 px-2.5 text-[11px]"
                        >
                          Full Dossier
                        </button>
                      </div>
                    </div>
                  }
                />
              ))}
            </div>
          )}

          {reservePages > 1 && (
            <div className="flex items-center justify-between gap-3 pt-3 border-t border-white/10 text-xs text-slate-300">
              <span>
                Page <strong>{visiblePage}</strong> of <strong>{reservePages}</strong>
              </span>
              <div className="flex gap-2">
                <button
                  type="button"
                  disabled={visiblePage === 1}
                  onClick={() => setReservePage((page) => Math.max(1, page - 1))}
                  className="cm-btn py-1 px-3 text-xs"
                >
                  Previous
                </button>
                <button
                  type="button"
                  disabled={visiblePage === reservePages}
                  onClick={() => setReservePage((page) => Math.min(reservePages, page + 1))}
                  className="cm-btn py-1 px-3 text-xs"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Player Dossier Inspector Modal */}
      {inspectCard && (
        <div
          className="cm-modal-backdrop"
          onClick={(event) => {
            if (event.target === event.currentTarget) setInspectCard(null);
          }}
        >
          <div
            ref={inspectorRef}
            role="dialog"
            aria-modal="true"
            aria-label={`${inspectCard.name} player details`}
            className="cm-modal max-w-2xl w-full max-h-[92dvh] overflow-y-auto"
          >
            <div className="cm-panel-header">
              <span>Player Scouting Dossier · {inspectCard.name}</span>
              <button
                type="button"
                onClick={() => setInspectCard(null)}
                aria-label="Close player details"
                className="cm-btn py-0.5 px-2 text-xs"
              >
                ✕ Close
              </button>
            </div>
            <div className="cm-panel-body flex flex-col items-center space-y-3">
              <PlayerProfileCard card={inspectCard} />
              <div className="w-full space-y-1.5 text-xs bg-[#0f172a] border border-white/10 rounded-lg p-3 text-slate-200">
                <div className="flex justify-between items-center py-1 border-b border-white/10">
                  <span className="text-slate-400 font-bold">Playable Role Positions:</span>
                  <strong className="text-emerald-400 uppercase">
                    {(inspectCard.playableRoles && inspectCard.playableRoles.length > 0
                      ? inspectCard.playableRoles
                      : [inspectCard.preferredRole || inspectCard.role || 'Fighter']
                    ).join(' · ')}
                  </strong>
                </div>
                <div className="flex justify-between items-center py-1 border-b border-white/10">
                  <span className="text-slate-400 font-bold">Contract Status:</span>
                  <strong className={inspectCard.isEvo ? 'text-emerald-400' : 'text-slate-300'}>
                    {inspectCard.isEvo
                      ? `✦ Veteran Level ${inspectCard.evolutionLevel || 1}`
                      : 'Active Club Contract'}
                  </strong>
                </div>
                <div className="pt-1 text-slate-300">
                  <span className="text-slate-400 font-bold">Signature Avatars: </span>
                  <strong>
                    {inspectCard.signatureChampions.map((name) => avatarDisplayName(name, CHAMPIONS)).join(', ')}
                  </strong>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
