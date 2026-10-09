import React, { useEffect, useState } from 'react';
import type { ChampionKit, CoachCard, PlayerCard } from '../types';
import type { DraftSide, DraftSnapshot } from '../draftRules';
import { chooseCoachBan, chooseCoachPick, chooseCoachTeamPick, DRAFT_TURNS, draftLineups } from '../draftRules';
import { ChibiAvatar } from './ChibiAvatar';
import { sound } from '../audio';
import { Ban, Swords, Sparkles } from 'lucide-react';

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
            snapshot.picks.red, used, snapshot.redCoach, snapshot.seed + snapshot.turnIndex * 23);
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
      mySide === 'blue' ? snapshot.blueCoach : snapshot.redCoach, snapshot.seed + snapshot.turnIndex)?.id : null;

  return <div className="space-y-5 max-w-7xl mx-auto animate-fade-in">
    <div className="bg-slate-900 border border-slate-700 rounded-2xl p-5 flex flex-wrap gap-3 items-center justify-between">
      <div><h2 className="text-xl font-black text-white flex items-center gap-2"><Swords className="w-5 h-5 text-amber-400" /> PICK & BAN</h2>
        <p className="text-slate-400 text-xs mt-1">{online ? `Online room ${snapshot.roomCode} · You are ${mySide.toUpperCase()}` : 'Vs AI · coach guided draft'}</p></div>
      <div className="text-xs font-bold text-amber-300">{turn ? `${turn.side.toUpperCase()} ${turn.action.toUpperCase()} · ${snapshot.turnIndex + 1}/${DRAFT_TURNS.length}` : 'Draft complete'}</div>
    </div>
    <div className="grid grid-cols-3 sm:grid-cols-6 gap-1" aria-label="Draft turn order">
      {DRAFT_TURNS.map((step, i) => <div key={i} className={`rounded-lg p-2 text-center text-[10px] font-black ${i === snapshot.turnIndex ? 'bg-amber-400 text-slate-950' : i < snapshot.turnIndex ? 'bg-slate-700 text-white' : 'bg-slate-900 text-slate-500'}`}>
        {i + 1}. {step.side.toUpperCase()} {step.action.toUpperCase()}
      </div>)}
    </div>
    <div className="grid md:grid-cols-2 gap-4">{(['blue', 'red'] as const).map(side => {
      const roster = side === 'blue' ? snapshot.blueRoster : snapshot.redRoster;
      const coach = side === 'blue' ? snapshot.blueCoach : snapshot.redCoach;
      return <div key={side} className={`bg-slate-900 border rounded-2xl p-4 ${side === 'blue' ? 'border-cyan-600/50' : 'border-rose-600/50'}`}>
        <div className="flex justify-between items-center mb-3"><strong className={side === 'blue' ? 'text-cyan-300' : 'text-rose-300'}>{side.toUpperCase()} TEAM</strong><span className="text-slate-400 text-xs">{coach.name} · {coach.style}</span></div>
        <div className="grid grid-cols-5 gap-2">{roster.map((player, slot) => {
          const pick = snapshot.picks[side].find(entry => entry.slot === slot);
          const champion = allChampions.find(entry => entry.id === pick?.championId);
          const selectable = side === mySide && isMyTurn && turn.action === 'pick' && !pick;
          return <button key={`${side}-${slot}`} type="button" disabled={!selectable} onClick={() => setChosenSlot(slot)} className={`rounded-xl p-2 text-center border min-w-0 ${selectable && selectedSlot === slot ? 'border-amber-400 bg-amber-400/10' : 'border-slate-700 bg-slate-950'}`}>
            <ChibiAvatar avatarType={player.avatarSvg} size={38} /><div className="truncate text-white text-[11px] font-bold">{player.name}</div>
            <div className="truncate text-slate-400 text-[10px]">{player.preferredRole ?? player.role}</div><div className="truncate text-amber-300 text-[11px] font-black">{champion?.name ?? 'Empty'}</div>
          </button>;
        })}</div><div className="text-[11px] text-slate-400 mt-3">Ban: {allChampions.find(c => c.id === snapshot.bans[side])?.name ?? '—'}</div>
      </div>;
    })}</div>
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
      <div className="flex flex-wrap justify-between gap-2 mb-4"><h3 className="text-white font-black text-sm flex gap-2 items-center">{turn?.action === 'ban' ? <Ban className="w-4 h-4 text-rose-400" /> : <Sparkles className="w-4 h-4 text-cyan-400" />}{isMyTurn ? turn.action === 'ban' ? 'Ban one avatar' : `Pick for ${myRoster[selectedSlot]?.name}` : `Waiting for ${turn?.side === 'red' ? opponentName : 'Blue team'}...`}</h3><span className="text-xs text-slate-400">Each avatar can be picked once across both teams</span></div>
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2 max-h-[460px] overflow-y-auto">{allChampions.map(champion => <button key={champion.id} type="button" disabled={!isMyTurn || busy || used.has(champion.id)} onClick={() => submit(champion.id, selectedSlot)} className={`rounded-xl border p-3 text-left transition ${used.has(champion.id) ? 'opacity-30 border-slate-800 bg-slate-950' : isMyTurn ? 'border-slate-700 bg-slate-950 hover:border-amber-400 hover:bg-slate-800' : 'border-slate-800 bg-slate-950/50 opacity-70'}`}>
        <div className="w-9 h-9 rounded-lg flex items-center justify-center text-white font-black mb-1" style={{ backgroundColor: champion.primaryColor }}>{champion.name[0]}</div>
        <div className="text-white font-bold text-xs truncate">{champion.name}</div><div className="text-slate-400 text-[10px] truncate">{champion.primaryRole} · {champion.archetype}</div>
        {recommendation === champion.id && <div className="text-cyan-300 text-[10px]">Coach pick</div>}
        {used.has(champion.id) && <div className="text-rose-300 text-[10px]">Unavailable</div>}
      </button>)}</div>
    </div>
  </div>;
};
