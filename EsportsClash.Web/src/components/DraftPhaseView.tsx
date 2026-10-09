import React, { useState } from 'react';
import { ChampionKit, CoachCard, PlayerCard } from '../types';
import { ChibiAvatar } from './ChibiAvatar';
import { sound } from '../audio';
import { buildUniqueLineups, isChampionAvailable } from '../draftRules';
import { Shield, Sparkles, Swords, Ban, Check, UserCheck, Flame } from 'lucide-react';

interface DraftPhaseViewProps {
  startingFive: PlayerCard[];
  allChampions: ChampionKit[];
  userCoach?: CoachCard;
  opponentName: string;
  opponentRoster: PlayerCard[];
  onDraftComplete: (
    blueAssignments: { player: PlayerCard; champion: ChampionKit }[],
    redAssignments: { player: PlayerCard; champion: ChampionKit }[]
  ) => void;
}

export const DraftPhaseView: React.FC<DraftPhaseViewProps> = ({
  startingFive,
  allChampions,
  userCoach,
  opponentName,
  opponentRoster,
  onDraftComplete
}) => {
  const [bannedChampId, setBannedChampId] = useState<string | null>(null);
  const [enemyBannedChampId, setEnemyBannedChampId] = useState<string | null>(null);
  const [phase, setPhase] = useState<'ban' | 'pick'>('ban');
  const [selectedChampForPlayer, setSelectedChampForPlayer] = useState<{ [playerId: string]: string }>({});
  const [activePlayerIndex, setActivePlayerIndex] = useState<number>(0);

  const handleBan = (champId: string) => {
    sound.playClick();
    setBannedChampId(champId);

    // Enemy AI bans a random champion (not the same one)
    const remaining = allChampions.filter((c) => c.id !== champId);
    const aiBan = remaining[Math.floor(Math.random() * remaining.length)];
    setEnemyBannedChampId(aiBan.id);

    setTimeout(() => {
      setPhase('pick');
    }, 600);
  };

  const handlePickChampion = (champId: string) => {
    const activePlayer = startingFive[activePlayerIndex];
    if (!activePlayer) return;
    if (!isChampionAvailable(champId, activePlayer.id, selectedChampForPlayer, [bannedChampId, enemyBannedChampId])) return;
    sound.playClick();

    const newSelections = {
      ...selectedChampForPlayer,
      [activePlayer.id]: champId
    };
    setSelectedChampForPlayer(newSelections);

    if (activePlayerIndex < startingFive.length - 1) {
      setActivePlayerIndex(activePlayerIndex + 1);
    }
  };

  const autoFillDraft = () => {
    sound.playClick();
    const defaults: { [playerId: string]: string } = {};
    const used = new Set<string>();
    startingFive.forEach((p) => {
      // 1. Signature Avatar match
      let champ = allChampions.find((c) => {
        if (used.has(c.id) || c.id === bannedChampId || c.id === enemyBannedChampId) return false;
        return p.signatureChampions.includes(c.name);
      });
      // 2. Preferred combat role match
      if (!champ && p.preferredRole) {
        champ = allChampions.find((c) => {
          if (used.has(c.id) || c.id === bannedChampId || c.id === enemyBannedChampId) return false;
          return c.primaryRole === p.preferredRole || c.secondaryRole === p.preferredRole;
        });
      }
      // 3. Fallback
      if (!champ) {
        champ = allChampions.find((c) => !used.has(c.id) && c.id !== bannedChampId && c.id !== enemyBannedChampId);
      }
      if (champ) {
        used.add(champ.id);
        defaults[p.id] = champ.id;
      }
    });
    setSelectedChampForPlayer(defaults);
  };

  const handleLockIn = () => {
    sound.playWalkoutFanfare();
    const { blue, red } = buildUniqueLineups(startingFive, opponentRoster, allChampions, selectedChampForPlayer, [bannedChampId, enemyBannedChampId]);
    onDraftComplete(blue, red);
  };

  const allPicked = startingFive.every((p) => selectedChampForPlayer[p.id]);

  return (
    <div className="space-y-6 animate-fade-in max-w-6xl mx-auto">
      {/* Header */}
      <div className="bg-slate-900 border border-slate-700 rounded-2xl p-4 shadow-xl flex justify-between items-center">
        <div>
          <h2 className="text-xl font-black text-white flex items-center gap-2">
            <Swords className="w-5 h-5 text-amber-400" />
            1-LANE ARAM PICK & BAN DRAFT
          </h2>
          <p className="text-slate-400 text-xs mt-0.5">
            Phase: <strong className="text-amber-300 uppercase">{phase === 'ban' ? '1. Ban 1 Threat' : '2. Pick 5 Champions'}</strong>
          </p>
        </div>

        {userCoach && (
          <div className="bg-black/40 px-3 py-1.5 rounded-xl border border-white/10 text-xs flex items-center gap-2">
            <Shield className="w-4 h-4 text-cyan-400" />
            <span>Coach {userCoach.name}: <strong className="text-cyan-300">{userCoach.style} (+{userCoach.playbookBonus} Draft IQ)</strong></span>
          </div>
        )}
      </div>

      {/* BAN PHASE */}
      {phase === 'ban' && (
        <div className="bg-gradient-to-b from-rose-950/40 via-slate-900 to-slate-900 border border-rose-500/40 rounded-3xl p-6 text-center space-y-4 shadow-2xl">
          <div className="flex flex-col items-center">
            <Ban className="w-10 h-10 text-rose-400 animate-bounce mb-2" />
            <h3 className="text-lg font-black text-white">Select 1 Champion to BAN for both teams</h3>
            <p className="text-slate-400 text-xs">Prevent the rival squad from drafting high-synergy champions.</p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 lg:grid-cols-5 gap-4">
            {allChampions.map((c) => (
              <div
                key={c.id}
                onClick={() => handleBan(c.id)}
                className="bg-slate-950 border border-slate-800 hover:border-rose-500 rounded-2xl p-4 cursor-pointer transition transform hover:-translate-y-1 group"
              >
                <div
                  className="w-16 h-16 rounded-full mx-auto flex items-center justify-center font-black text-white text-xl shadow-lg mb-2"
                  style={{ backgroundColor: c.primaryColor }}
                >
                  {c.name[0]}
                </div>
                <div className="font-bold text-white text-sm">{c.name}</div>
                <div className="text-[10px] text-slate-400">{c.archetype}</div>
                <div className="mt-2 text-xs text-rose-400 font-bold group-hover:block">
                  Click to Ban 🚫
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* PICK PHASE */}
      {phase === 'pick' && (
        <div className="space-y-6">
          {/* Starting 5 Player Slot Selectors */}
          <div className="grid grid-cols-1 sm:grid-cols-3 lg:grid-cols-5 gap-4">
            {startingFive.map((player, idx) => {
              const selectedId = selectedChampForPlayer[player.id];
              const champ = allChampions.find((c) => c.id === selectedId);
              const isActive = activePlayerIndex === idx;
              const isSignature = champ && player.signatureChampions.includes(champ.name);

              return (
                <div
                  key={player.id}
                  onClick={() => {
                    sound.playClick();
                    setActivePlayerIndex(idx);
                  }}
                  className={`bg-slate-900 border-2 rounded-2xl p-4 cursor-pointer transition flex flex-col items-center ${
                    isActive
                      ? 'border-amber-400 ring-2 ring-amber-400/50 scale-105 shadow-xl bg-indigo-950/40'
                      : 'border-slate-800 hover:border-slate-700'
                  }`}
                >
                  <div className="text-[10px] font-bold text-slate-400 uppercase mb-1">
                    Slot {idx + 1}: {player.preferredRole || player.role || 'Athlete'}
                  </div>
                  <ChibiAvatar avatarType={player.avatarSvg} size={54} />
                  <div className="font-bold text-white text-sm mt-1">{player.name}</div>
                  <div className="text-[10px] text-amber-300 font-semibold">OVR: {player.ovr}</div>

                  {/* Assigned Champion Preview */}
                  <div className="mt-3 w-full bg-black/40 rounded-xl p-2 border border-white/10 text-center">
                    {champ ? (
                      <div>
                        <div className="text-xs font-black text-white">{champ.name}</div>
                        <div className="text-[9px] text-cyan-300 font-semibold">{champ.primaryRole} {champ.secondaryRole ? `• ${champ.secondaryRole}` : ''}</div>
                        {isSignature && (
                          <div className="text-[9px] text-amber-300 font-bold flex items-center justify-center gap-1 mt-0.5">
                            <Sparkles className="w-2.5 h-2.5" /> +10% Mastery
                          </div>
                        )}
                      </div>
                    ) : (
                      <span className="text-[10px] text-slate-500 font-medium">Select Below</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Champion Pool to Choose From */}
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-2xl">
            <h3 className="text-xs font-black uppercase text-amber-300 tracking-wider mb-4 flex items-center justify-between">
              <span>Choose Avatar for {startingFive[activePlayerIndex]?.name} ({startingFive[activePlayerIndex]?.preferredRole || startingFive[activePlayerIndex]?.role})</span>
              <span className="text-[11px] text-slate-400 normal-case">
                Banned: {allChampions.find((c) => c.id === bannedChampId)?.name || 'None'}, {allChampions.find((c) => c.id === enemyBannedChampId)?.name || 'None'}
              </span>
            </h3>

            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
              {allChampions.map((c) => {
                const isBanned = c.id === bannedChampId || c.id === enemyBannedChampId;
                const pickedBy = startingFive.find(p => p.id !== startingFive[activePlayerIndex]?.id && selectedChampForPlayer[p.id] === c.id);
                const isSelectedForCurrent = selectedChampForPlayer[startingFive[activePlayerIndex]?.id] === c.id;
                const isSignature = startingFive[activePlayerIndex]?.signatureChampions.includes(c.name);

                return (
                  <div
                    key={c.id}
                    onClick={() => !isBanned && !pickedBy && handlePickChampion(c.id)}
                    className={`relative rounded-2xl p-3 border-2 transition ${
                      isBanned || pickedBy
                        ? 'opacity-40 bg-slate-950 border-rose-950 cursor-not-allowed'
                        : isSelectedForCurrent
                        ? 'border-amber-400 bg-amber-950/30 scale-105 shadow-xl cursor-pointer'
                        : 'bg-slate-950 border-slate-800 hover:border-slate-600 cursor-pointer'
                    }`}
                  >
                    {isBanned && (
                      <div className="absolute top-2 right-2 bg-rose-600 text-white text-[8px] font-black px-1.5 py-0.5 rounded uppercase">
                        BANNED
                      </div>
                    )}
                    {pickedBy && !isBanned && <div className="absolute top-2 right-2 bg-slate-700 text-white text-[8px] font-black px-1.5 py-0.5 rounded uppercase">PICKED by {pickedBy.name}</div>}
                    {isSignature && (
                      <div className="absolute top-2 right-2 bg-amber-400 text-slate-950 text-[8px] font-black px-1 py-0.5 rounded uppercase flex items-center gap-0.5">
                        <Flame className="w-2.5 h-2.5" /> Sig
                      </div>
                    )}

                    <div
                      className="w-10 h-10 rounded-xl flex items-center justify-center font-black text-white text-base shadow mb-1.5"
                      style={{ backgroundColor: c.primaryColor }}
                    >
                      {c.name[0]}
                    </div>
                    <div className="font-bold text-white text-sm leading-tight">{c.name}</div>
                    <div className="text-[10px] text-slate-400 truncate">{c.title}</div>
                    
                    {/* Primary & Secondary Dual-Role Badges */}
                    <div className="flex flex-wrap gap-1 mt-1.5">
                      <span className="text-[8px] bg-cyan-950 text-cyan-300 font-bold px-1.5 py-0.5 rounded border border-cyan-800">
                        {c.primaryRole}
                      </span>
                      {c.secondaryRole && (
                        <span className="text-[8px] bg-slate-800 text-slate-300 font-medium px-1.5 py-0.5 rounded">
                          {c.secondaryRole}
                        </span>
                      )}
                    </div>

                    <div className="text-[9px] text-slate-500 mt-1 italic">
                      {c.archetype}
                    </div>

                    <div className="mt-2 text-[9px] text-slate-400 bg-black/40 p-1 rounded">
                      Ult: <strong className="text-white">{c.ultimate.name}</strong>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Lock In & Quick Fill Buttons */}
            <div className="mt-6 flex justify-between items-center">
              <button
                onClick={autoFillDraft}
                className="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-amber-300 font-bold text-xs rounded-xl border border-amber-500/30 flex items-center gap-1.5 transition shadow"
              >
                <Sparkles className="w-3.5 h-3.5" /> Auto-Fill Balanced 5-Role Lineup
              </button>

              <button
                onClick={handleLockIn}
                disabled={!allPicked}
                className={`px-8 py-3 rounded-xl font-black text-xs transition flex items-center gap-2 shadow-xl ${
                  allPicked
                    ? 'bg-gradient-to-r from-amber-400 to-yellow-500 text-slate-950 hover:brightness-110 shadow-amber-500/30'
                    : 'bg-slate-800 text-slate-500 cursor-not-allowed'
                }`}
              >
                <Check className="w-4 h-4" />
                Lock In Lineup & Enter ARAM Bridge!
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

