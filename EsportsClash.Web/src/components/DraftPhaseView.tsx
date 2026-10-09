import React, { useEffect, useState } from 'react';
import type { ChampionKit, CoachCard, PlayerCard, AvatarRole } from '../types';
import type { DraftSide, DraftSnapshot } from '../draftRules';
import { chooseCoachBan, chooseCoachPick, chooseCoachTeamPick, DRAFT_TURNS, draftLineups } from '../draftRules';
import { ChampionArtwork } from './ChampionArtwork';
import { ChibiAvatar } from './ChibiAvatar';
import { sound } from '../audio';
import { getChampionLore } from '../championLore';
import { 
  Ban, 
  Swords, 
  Sparkles, 
  Shield, 
  Heart, 
  Crosshair, 
  Activity, 
  Filter, 
  Search, 
  Info, 
  Flame, 
  Check, 
  ChevronRight,
  BookOpen
} from 'lucide-react';

interface Props {
  startingFive: PlayerCard[];
  allChampions: ChampionKit[];
  userCoach: CoachCard;
  opponentCoach: CoachCard;
  opponentName: string;
  opponentRoster: PlayerCard[];
  draftSeed: number;
  online?: { room: DraftSnapshot; side: DraftSide; onAction: (championId: string, slot: number) => Promise<void> };
  onDraftComplete: (blue: { player: PlayerCard; champion: ChampionKit }[],
    red: { player: PlayerCard; champion: ChampionKit }[], seed: number) => void;
}

export const DraftPhaseView: React.FC<Props> = ({ startingFive, allChampions, userCoach, opponentCoach,
  opponentName, opponentRoster, draftSeed, online, onDraftComplete }) => {
  const [local, setLocal] = useState<DraftSnapshot>(() => ({
    turnIndex: 0, bans: {}, picks: { blue: [], red: [] }, blueRoster: startingFive,
    redRoster: opponentRoster, blueCoach: userCoach, redCoach: opponentCoach, seed: draftSeed, revision: 0
  }));
  const [chosenSlot, setChosenSlot] = useState(0);
  const [busy, setBusy] = useState(false);
  const [selectedInspectChamp, setSelectedInspectChamp] = useState<ChampionKit | null>(() => allChampions[0] ?? null);
  const [roleFilter, setRoleFilter] = useState<AvatarRole | 'All'>('All');
  const [searchQuery, setSearchQuery] = useState('');

  const snapshot = online?.room ?? local;
  const turn = DRAFT_TURNS[snapshot.turnIndex];
  const mySide: DraftSide = online?.side ?? 'blue';
  const isMyTurn = turn?.side === mySide;
  const myRoster = mySide === 'blue' ? snapshot.blueRoster : snapshot.redRoster;
  const used = new Set([...Object.values(snapshot.bans), ...snapshot.picks.blue.map(p => p.championId),
    ...snapshot.picks.red.map(p => p.championId)]);
  const openSlots = myRoster.map((_, i) => i).filter(i => !snapshot.picks[mySide].some(p => p.slot === i));
  const selectedSlot = openSlots.includes(chosenSlot) ? chosenSlot : openSlots[0] ?? 0;
  const team = (side: DraftSide) => snapshot.picks[side].map(p => allChampions.find(c => c.id === p.championId))
    .filter((c): c is ChampionKit => !!c);

  const submit = async (championId: string, slot: number) => {
    if (!turn || !isMyTurn || busy || used.has(championId)) return;
    if (turn.action === 'pick' && !openSlots.includes(slot)) return;
    sound.playClick();
    if (online) {
      setBusy(true);
      try { await online.onAction(championId, slot); } finally { setBusy(false); }
    } else {
      setLocal(previous => previous.turnIndex !== snapshot.turnIndex ? previous : {
        ...previous, turnIndex: previous.turnIndex + 1, revision: previous.revision + 1,
        bans: turn.action === 'ban' ? { ...previous.bans, blue: championId } : previous.bans,
        picks: turn.action === 'pick' ? { ...previous.picks, blue: [...previous.picks.blue, { slot, championId }] } : previous.picks
      });
    }
  };

  useEffect(() => {
    if (online || !turn || turn.side !== 'red') return;
    const timer = window.setTimeout(() => {
      const available = allChampions.filter(c => !used.has(c.id));
      const choice = turn.action === 'ban'
        ? { slot: 0, champion: chooseCoachBan(available, snapshot.blueRoster, used, snapshot.seed + snapshot.turnIndex) }
        : (() => { const pick = chooseCoachTeamPick(allChampions, snapshot.redRoster,
            snapshot.picks.red, used, snapshot.redCoach, snapshot.seed + snapshot.turnIndex * 23, snapshot.picks.blue);
            return pick ? { slot: pick.slot, champion: allChampions.find(c => c.id === pick.championId) } : undefined; })();
      if (!choice?.champion) return;
      const championId = choice.champion.id;
      setLocal(previous => previous.turnIndex !== snapshot.turnIndex ? previous : {
        ...previous, turnIndex: previous.turnIndex + 1, revision: previous.revision + 1,
        bans: turn.action === 'ban' ? { ...previous.bans, red: championId } : previous.bans,
        picks: turn.action === 'pick' ? { ...previous.picks,
          red: [...previous.picks.red, { slot: choice.slot, championId }] } : previous.picks
      });
    }, 500);
    return () => clearTimeout(timer);
  }, [online, snapshot.turnIndex]);

  useEffect(() => {
    if (snapshot.turnIndex !== DRAFT_TURNS.length) return;
    const { blue, red } = draftLineups(snapshot, allChampions);
    if (blue.length === 5 && red.length === 5) {
      sound.playWalkoutFanfare();
      onDraftComplete(blue, red, snapshot.seed);
    }
  }, [snapshot.turnIndex]);

  const recommendation = isMyTurn && turn.action === 'pick' && myRoster[selectedSlot]
    ? chooseCoachPick(allChampions, myRoster[selectedSlot], team(mySide), used,
      mySide === 'blue' ? snapshot.blueCoach : snapshot.redCoach, snapshot.seed + snapshot.turnIndex, team(mySide === 'blue' ? 'red' : 'blue'))?.id : null;

  // Filter champions
  const filteredChampions = allChampions.filter(c => {
    const matchesRole = roleFilter === 'All' || c.primaryRole === roleFilter || c.secondaryRole === roleFilter;
    const matchesQuery = !searchQuery || c.name.toLowerCase().includes(searchQuery.toLowerCase()) || c.title.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesRole && matchesQuery;
  });

  const inspected = selectedInspectChamp ?? allChampions[0];
  const currentPlayer = myRoster[selectedSlot];
  const isSignatureForCurrent = inspected && currentPlayer?.signatureChampions.includes(inspected.name);

  return <div className="space-y-5 max-w-7xl mx-auto animate-fade-in">
    {/* Header Banner */}
    <div className="bg-slate-900 border border-slate-700 rounded-2xl p-5 flex flex-wrap gap-3 items-center justify-between">
      <div>
        <h2 className="text-xl font-black text-white flex items-center gap-2">
          <Swords className="w-5 h-5 text-amber-400" /> PICK & BAN PHASE
        </h2>
        <p className="text-slate-400 text-xs mt-1">
          {online ? `Online room ${snapshot.roomCode} · You are ${mySide.toUpperCase()}` : 'Vs AI · Coach guided tactical draft'}
        </p>
      </div>
      <div className="text-xs font-bold text-amber-300">
        {turn ? `${turn.side.toUpperCase()} ${turn.action.toUpperCase()} · Step ${snapshot.turnIndex + 1}/${DRAFT_TURNS.length}` : 'Draft complete'}
      </div>
    </div>

    {/* Turn Sequence Stepper */}
    <div className="grid grid-cols-3 sm:grid-cols-6 gap-1" aria-label="Draft turn order">
      {DRAFT_TURNS.map((step, i) => (
        <div key={i} className={`rounded-lg p-2 text-center text-[10px] font-black transition ${
          i === snapshot.turnIndex
            ? 'bg-amber-400 text-slate-950 shadow-md scale-105'
            : i < snapshot.turnIndex
            ? 'bg-slate-700 text-slate-300'
            : 'bg-slate-900 text-slate-500'
        }`}>
          {i + 1}. {step.side.toUpperCase()} {step.action.toUpperCase()}
        </div>
      ))}
    </div>

    {/* Team Rosters */}
    <div className="grid md:grid-cols-2 gap-4">
      {(['blue', 'red'] as const).map(side => {
        const roster = side === 'blue' ? snapshot.blueRoster : snapshot.redRoster;
        const coach = side === 'blue' ? snapshot.blueCoach : snapshot.redCoach;
        return (
          <div key={side} className={`bg-slate-900 border rounded-2xl p-4 ${side === 'blue' ? 'border-cyan-600/50' : 'border-rose-600/50'}`}>
            <div className="flex justify-between items-center mb-3">
              <strong className={side === 'blue' ? 'text-cyan-300' : 'text-rose-300'}>{side.toUpperCase()} TEAM</strong>
              <span className="text-slate-400 text-xs font-semibold">{coach.name} · {coach.style}</span>
            </div>

            <div className="grid grid-cols-5 gap-2">
              {roster.map((player, slot) => {
                const pick = snapshot.picks[side].find(entry => entry.slot === slot);
                const champion = allChampions.find(entry => entry.id === pick?.championId);
                const selectable = side === mySide && isMyTurn && turn?.action === 'pick' && !pick;
                return (
                  <button
                    key={`${side}-${slot}`}
                    type="button"
                    disabled={!selectable}
                    onClick={() => { sound.playClick(); setChosenSlot(slot); }}
                    className={`rounded-xl p-2 text-center border min-w-0 transition ${
                      selectable && selectedSlot === slot
                        ? 'border-amber-400 bg-amber-400/20 shadow-lg'
                        : 'border-slate-700 bg-slate-950 hover:border-slate-500'
                    }`}
                  >
                    <div className="flex justify-center mb-1">
                      <ChibiAvatar avatarType={player.avatarSvg} size={38} />
                    </div>
                    <div className="truncate text-white text-[11px] font-bold">{player.name}</div>
                    <div className="truncate text-slate-400 text-[10px]">{player.preferredRole ?? player.role}</div>
                    <div className={`truncate text-[11px] font-black mt-1 ${champion ? 'text-cyan-300' : 'text-amber-400'}`}>
                      {champion?.name ?? 'Empty'}
                    </div>
                  </button>
                );
              })}
            </div>

            <div className="text-[11px] text-slate-400 mt-3 flex items-center gap-1.5">
              <Ban className="w-3.5 h-3.5 text-rose-400" />
              <span>Banned:</span>
              <strong className="text-white">
                {allChampions.find(c => c.id === snapshot.bans[side])?.name ?? 'None'}
              </strong>
            </div>
          </div>
        );
      })}
    </div>

    {/* Main Pick/Ban Selection & Actual Champions & Lore Dossier Side-by-Side */}
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
      {/* Left Column: Avatar Grid with Role Filters and Search */}
      <div className="lg:col-span-7 bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-4">
        <div className="flex flex-wrap justify-between items-center gap-2">
          <h3 className="text-white font-black text-sm flex gap-2 items-center">
            {turn?.action === 'ban' ? <Ban className="w-4 h-4 text-rose-400" /> : <Sparkles className="w-4 h-4 text-cyan-400" />}
            {isMyTurn ? (
              turn.action === 'ban' ? 'Select Avatar to Ban' : `Drafting for ${myRoster[selectedSlot]?.name} (${myRoster[selectedSlot]?.preferredRole ?? myRoster[selectedSlot]?.role})`
            ) : (
              `Waiting for ${turn?.side === 'red' ? opponentName : 'Blue team'}...`
            )}
          </h3>
          <span className="text-xs text-slate-400">Click avatar to inspect full lore & ability kit</span>
        </div>

        {/* Filter and Search Bar */}
        <div className="flex flex-wrap items-center justify-between gap-2 bg-slate-950 p-2.5 rounded-xl border border-slate-800 text-xs">
          <div className="flex flex-wrap gap-1">
            {(['All', 'Tank', 'Mage', 'Marksman', 'Support', 'Fighter', 'Assassin'] as const).map(role => (
              <button
                key={role}
                onClick={() => { sound.playClick(); setRoleFilter(role); }}
                className={`px-2.5 py-1 rounded-lg font-bold transition ${
                  roleFilter === role ? 'bg-cyan-500 text-slate-950' : 'bg-slate-900 text-slate-400 hover:text-white'
                }`}
              >
                {role}
              </button>
            ))}
          </div>

          <div className="relative min-w-[140px]">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Search..."
              className="w-full bg-slate-900 text-white placeholder-slate-500 text-xs pl-7 pr-2 py-1 rounded-lg border border-slate-700 focus:outline-none focus:border-cyan-400"
            />
          </div>
        </div>

        {/* 30-Avatar Grid with Actual Artwork */}
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2.5 max-h-[480px] overflow-y-auto p-1">
          {filteredChampions.map(champion => {
            const isUsed = used.has(champion.id);
            const isInspected = inspected?.id === champion.id;
            const isRec = recommendation === champion.id;

            return (
              <button
                key={champion.id}
                type="button"
                onClick={() => {
                  sound.playClick();
                  setSelectedInspectChamp(champion);
                }}
                className={`rounded-2xl border p-2.5 text-left transition relative flex flex-col items-center ${
                  isUsed
                    ? 'opacity-40 border-slate-800 bg-slate-950 cursor-not-allowed'
                    : isInspected
                    ? 'border-amber-400 bg-amber-400/10 shadow-lg scale-105'
                    : 'border-slate-800 bg-slate-950 hover:border-slate-600 hover:bg-slate-900/80'
                }`}
              >
                <div 
                  className="w-12 h-12 rounded-full flex items-center justify-center p-1 border shadow mb-1.5"
                  style={{ borderColor: champion.primaryColor, backgroundColor: `${champion.primaryColor}20` }}
                >
                  <ChampionArtwork championId={champion.id} size={42} />
                </div>

                <div className="text-white font-black text-xs text-center truncate w-full">{champion.name}</div>
                <div className="text-[10px] text-cyan-300 font-bold">{champion.primaryRole}</div>
                <div className="text-[9px] text-slate-400 truncate max-w-full text-center mt-0.5">{champion.archetype}</div>

                {isRec && !isUsed && (
                  <span className="mt-1 text-[8px] bg-cyan-950 text-cyan-300 px-1.5 py-0.5 rounded-full font-bold border border-cyan-500/40">
                    Coach Pick
                  </span>
                )}
                {isUsed && (
                  <span className="mt-1 text-[8px] bg-rose-950 text-rose-300 px-1.5 py-0.5 rounded-full font-bold">
                    Unavailable
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Right Column: Actual Champions & Lore Dossier Panel */}
      <div className="lg:col-span-5 bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-4 shadow-xl">
        {inspected ? (
          <>
            <div className="flex items-center gap-3 border-b border-slate-800 pb-3">
              <div 
                className="w-16 h-16 rounded-full flex items-center justify-center p-1 border-2 shadow-lg shrink-0"
                style={{ borderColor: inspected.primaryColor, backgroundColor: `${inspected.primaryColor}25` }}
              >
                <ChampionArtwork championId={inspected.id} size={56} />
              </div>

              <div className="min-w-0 flex-1">
                <div className="flex items-baseline gap-2">
                  <h4 className="text-lg font-black text-white truncate">{inspected.name}</h4>
                  <span className="text-xs text-amber-300 font-bold">{inspected.title}</span>
                </div>
                <div className="text-xs text-slate-400 mt-0.5">
                  <span className="text-cyan-300 font-bold">{inspected.primaryRole}</span>
                  {inspected.secondaryRole && <span> / <strong className="text-emerald-300">{inspected.secondaryRole}</strong></span>}
                  <span className="text-slate-600"> · </span>
                  <span className="text-purple-300">{inspected.archetype}</span>
                </div>
              </div>
            </div>

            {/* Narrative Lore Dossier */}
            <div className="bg-slate-950/80 p-3 rounded-xl border border-slate-800 space-y-1">
              <div className="text-[10px] font-black uppercase text-amber-400 flex items-center gap-1">
                <BookOpen className="w-3 h-3 text-amber-400" /> Champions & Lore Dossier:
              </div>
              <p className="text-xs text-slate-300 italic font-serif leading-relaxed line-clamp-3">
                "{getChampionLore(inspected.id)}"
              </p>
            </div>

            {/* Base Combat Stats */}
            <div className="grid grid-cols-3 gap-2 bg-slate-950/90 p-2.5 rounded-xl border border-slate-800 text-[11px]">
              <div>
                <span className="text-slate-400 block font-bold">HP</span>
                <strong className="text-white">{inspected.hp}</strong>
              </div>
              <div>
                <span className="text-slate-400 block font-bold">AD</span>
                <strong className="text-amber-300">{inspected.ad}</strong>
              </div>
              <div>
                <span className="text-slate-400 block font-bold">Armor</span>
                <strong className="text-blue-300">{inspected.armor}</strong>
              </div>
              <div>
                <span className="text-slate-400 block font-bold">MR</span>
                <strong className="text-purple-300">{inspected.mr}</strong>
              </div>
              <div>
                <span className="text-slate-400 block font-bold">Atk Spd</span>
                <strong className="text-cyan-300">{inspected.aspd}/s</strong>
              </div>
              <div>
                <span className="text-slate-400 block font-bold">Range</span>
                <strong className="text-emerald-300">{inspected.range}</strong>
              </div>
            </div>

            {/* Ability Kit Breakdown */}
            <div className="space-y-2 border-t border-slate-800 pt-3">
              <div className="text-xs font-black text-amber-300 uppercase tracking-wide">
                Ability Kit & Mechanics
              </div>

              {/* Passive */}
              <div className="bg-slate-950 p-2 rounded-lg border border-slate-800 text-xs">
                <div className="text-amber-300 font-bold text-[11px] mb-0.5">
                  PASSIVE: Innate Combat Trait
                </div>
                <div className="text-slate-300 text-[11px] leading-tight">{inspected.passiveDesc}</div>
              </div>

              {/* Skill 1 */}
              <div className="bg-slate-950 p-2 rounded-lg border border-slate-800 text-xs">
                <div className="flex justify-between items-baseline mb-0.5">
                  <span className="text-cyan-300 font-bold text-[11px]">Q: {inspected.skill1.name}</span>
                  <span className="text-slate-400 text-[10px]">CD: {inspected.skill1.cooldown}s | {inspected.skill1.damageType} {inspected.skill1.damage}</span>
                </div>
                <div className="text-slate-300 text-[11px] leading-tight">{inspected.skill1.desc}</div>
              </div>

              {/* Skill 2 */}
              <div className="bg-slate-950 p-2 rounded-lg border border-slate-800 text-xs">
                <div className="flex justify-between items-baseline mb-0.5">
                  <span className="text-purple-300 font-bold text-[11px]">W: {inspected.skill2.name}</span>
                  <span className="text-slate-400 text-[10px]">CD: {inspected.skill2.cooldown}s | {inspected.skill2.damageType} {inspected.skill2.damage}</span>
                </div>
                <div className="text-slate-300 text-[11px] leading-tight">{inspected.skill2.desc}</div>
              </div>

              {/* Ultimate */}
              <div className="bg-slate-950 p-2 rounded-lg border border-slate-800 text-xs">
                <div className="flex justify-between items-baseline mb-0.5">
                  <span className="text-rose-400 font-bold text-[11px]">R: {inspected.ultimate.name}</span>
                  <span className="text-rose-300 text-[10px]">CD: {inspected.ultimate.cooldown}s | {inspected.ultimate.damageType} {inspected.ultimate.damage}</span>
                </div>
                <div className="text-slate-300 text-[11px] leading-tight">{inspected.ultimate.desc}</div>
              </div>
            </div>

            {/* Signature Athlete Synergy Notification */}
            {isSignatureForCurrent && (
              <div className="bg-amber-950/50 border border-amber-500/40 rounded-xl p-2.5 text-xs flex items-center gap-2 text-amber-200 font-semibold">
                <Flame className="w-4 h-4 text-amber-400 shrink-0" />
                <span>
                  <strong>Signature Avatar for {currentPlayer?.name}!</strong> Grants +10% Combat Mastery Boost.
                </span>
              </div>
            )}

            {/* Action Lock-In Buttons */}
            {isMyTurn && !used.has(inspected.id) && (
              <div className="pt-2">
                {turn.action === 'ban' ? (
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => submit(inspected.id, selectedSlot)}
                    className="w-full py-3 bg-gradient-to-r from-rose-600 to-red-600 hover:brightness-110 text-white font-black text-xs rounded-xl shadow-lg transition flex items-center justify-center gap-2"
                  >
                    <Ban className="w-4 h-4" />
                    CONFIRM BAN: {inspected.name.toUpperCase()}
                  </button>
                ) : (
                  <button
                    type="button"
                    disabled={busy || !openSlots.includes(selectedSlot)}
                    onClick={() => submit(inspected.id, selectedSlot)}
                    className="w-full py-3 bg-gradient-to-r from-amber-400 via-yellow-400 to-amber-500 hover:brightness-110 text-slate-950 font-black text-xs rounded-xl shadow-lg transition flex items-center justify-center gap-2"
                  >
                    <Check className="w-4 h-4" />
                    CONFIRM PICK FOR {currentPlayer?.name?.toUpperCase()}: {inspected.name.toUpperCase()}
                  </button>
                )}
              </div>
            )}
          </>
        ) : (
          <div className="py-20 text-center text-slate-500 text-xs">
            Select any avatar from the grid to inspect details
          </div>
        )}
      </div>
    </div>
  </div>;
};
