import React, { useEffect, useState } from 'react';
import { MirellePatternBook } from './MirellePatternBook';
import type { ChampionKit, CoachCard, PlayerCard, AvatarRole } from '../types';
import type { DraftSide, DraftSnapshot } from '../draftRules';
import { chooseCoachBan, chooseCoachPick, chooseCoachTeamPick, DRAFT_TURNS, draftLineups } from '../draftRules';
import { ChampionArtwork } from './ChampionArtwork';
import { ChibiAvatar } from './ChibiAvatar';
import { sound } from '../audio';
import { getChampionLore } from '../championLore';
import { AVATAR_COMBAT_TYPES, getAvatarCombatProfile } from '../avatarCombatRoles';
import { abilityCompactSummary, getAbilityPresentation } from '../abilityPresentation';
import { Ban, Swords, Sparkles, Search, Flame, Check, BookOpen } from 'lucide-react';

interface Props {
  startingFive: PlayerCard[];
  allChampions: ChampionKit[];
  userCoach: CoachCard;
  opponentCoach: CoachCard;
  opponentName: string;
  opponentRoster: PlayerCard[];
  draftSeed: number;
  online?: { room: DraftSnapshot; side: DraftSide; onAction: (championId: string, slot: number) => Promise<void> };
  onDraftComplete: (
    blue: { player: PlayerCard; champion: ChampionKit }[],
    red: { player: PlayerCard; champion: ChampionKit }[],
    seed: number
  ) => void;
}

export const DraftPhaseView: React.FC<Props> = ({
  startingFive,
  allChampions,
  userCoach,
  opponentCoach,
  opponentName,
  opponentRoster,
  draftSeed,
  online,
  onDraftComplete
}) => {
  const [local, setLocal] = useState<DraftSnapshot>(() => ({
    turnIndex: 0,
    bans: {},
    picks: { blue: [], red: [] },
    blueRoster: startingFive,
    redRoster: opponentRoster,
    blueCoach: userCoach,
    redCoach: opponentCoach,
    seed: draftSeed,
    revision: 0
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
  const used = new Set([
    ...Object.values(snapshot.bans),
    ...snapshot.picks.blue.map((p) => p.championId),
    ...snapshot.picks.red.map((p) => p.championId)
  ]);
  const openSlots = myRoster.map((_, i) => i).filter((i) => !snapshot.picks[mySide].some((p) => p.slot === i));
  const selectedSlot = openSlots.includes(chosenSlot) ? chosenSlot : openSlots[0] ?? 0;
  const team = (side: DraftSide) =>
    snapshot.picks[side]
      .map((p) => allChampions.find((c) => c.id === p.championId))
      .filter((c): c is ChampionKit => !!c);

  const submit = async (championId: string, slot: number) => {
    if (!turn || !isMyTurn || busy || used.has(championId)) return;
    if (turn.action === 'pick' && !openSlots.includes(slot)) return;
    sound.playClick();
    if (online) {
      setBusy(true);
      try {
        await online.onAction(championId, slot);
      } finally {
        setBusy(false);
      }
    } else {
      setLocal((previous) =>
        previous.turnIndex !== snapshot.turnIndex
          ? previous
          : {
              ...previous,
              turnIndex: previous.turnIndex + 1,
              revision: previous.revision + 1,
              bans: turn.action === 'ban' ? { ...previous.bans, blue: championId } : previous.bans,
              picks:
                turn.action === 'pick'
                  ? { ...previous.picks, blue: [...previous.picks.blue, { slot, championId }] }
                  : previous.picks
            }
      );
    }
  };

  useEffect(() => {
    if (online || !turn || turn.side !== 'red') return;
    const timer = window.setTimeout(() => {
      const available = allChampions.filter((c) => !used.has(c.id));
      const choice =
        turn.action === 'ban'
          ? {
              slot: 0,
              champion: chooseCoachBan(available, snapshot.blueRoster, used, snapshot.seed + snapshot.turnIndex)
            }
          : (() => {
              const pick = chooseCoachTeamPick(
                allChampions,
                snapshot.redRoster,
                snapshot.picks.red,
                used,
                snapshot.redCoach,
                snapshot.seed + snapshot.turnIndex * 23,
                snapshot.picks.blue
              );
              return pick ? { slot: pick.slot, champion: allChampions.find((c) => c.id === pick.championId) } : undefined;
            })();
      if (!choice?.champion) return;
      const championId = choice.champion.id;
      setLocal((previous) =>
        previous.turnIndex !== snapshot.turnIndex
          ? previous
          : {
              ...previous,
              turnIndex: previous.turnIndex + 1,
              revision: previous.revision + 1,
              bans: turn.action === 'ban' ? { ...previous.bans, red: championId } : previous.bans,
              picks:
                turn.action === 'pick'
                  ? {
                      ...previous.picks,
                      red: [...previous.picks.red, { slot: choice.slot, championId }]
                    }
                  : previous.picks
            }
      );
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

  const recommendation =
    isMyTurn && turn.action === 'pick' && myRoster[selectedSlot]
      ? chooseCoachPick(
          allChampions,
          myRoster[selectedSlot],
          team(mySide),
          used,
          mySide === 'blue' ? snapshot.blueCoach : snapshot.redCoach,
          snapshot.seed + snapshot.turnIndex,
          team(mySide === 'blue' ? 'red' : 'blue')
        )?.id
      : null;

  const filteredChampions = allChampions
    .filter((c) => {
      const matchesRole = roleFilter === 'All' || c.primaryRole === roleFilter || c.secondaryRole === roleFilter;
      const matchesQuery =
        !searchQuery ||
        c.displayName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        c.title.toLowerCase().includes(searchQuery.toLowerCase());
      return matchesRole && matchesQuery;
    })
    .sort((a, b) => a.displayName.localeCompare(b.displayName));

  const inspected = selectedInspectChamp ?? allChampions[0];
  const currentPlayer = myRoster[selectedSlot];
  const isSignatureForCurrent = inspected && currentPlayer?.signatureChampions.includes(inspected.name);
  const inspectedAbilities =
    inspected && inspected.name !== 'Kaelen'
      ? {
          skill1: getAbilityPresentation(inspected, 'skill1'),
          skill2: getAbilityPresentation(inspected, 'skill2'),
          ultimate: getAbilityPresentation(inspected, 'ultimate')
        }
      : undefined;

  return (
    <div className="space-y-4">
      {/* Header Banner + Turn Stepper */}
      <div className="cm-panel">
        <div className="cm-panel-header">
          <span className="flex items-center gap-2">
            <Swords className="w-4 h-4 text-[#f2c14e]" />
            <span>
              Tactical Pick &amp; Ban Phase ·{' '}
              {online
                ? `Online Room ${snapshot.roomCode} (${mySide.toUpperCase()})`
                : `Vs AI (${opponentName})`}
            </span>
          </span>
          <span className="cm-badge cm-badge-gold">
            {turn
              ? `${turn.side.toUpperCase()} ${turn.action.toUpperCase()} · Step ${snapshot.turnIndex + 1}/${DRAFT_TURNS.length}`
              : 'Draft Complete'}
          </span>
        </div>

        <div className="cm-panel-body space-y-3">
          {/* Turn Sequence Stepper */}
          <div className="grid grid-cols-3 sm:grid-cols-6 gap-1.5" aria-label="Draft turn order">
            {DRAFT_TURNS.map((step, i) => (
              <div
                key={i}
                className={`p-1.5 text-center text-[11px] font-bold border ${
                  i === snapshot.turnIndex
                    ? 'bg-[#f2c14e] text-[#09152b] border-[#b88406]'
                    : i < snapshot.turnIndex
                    ? 'bg-[#d0d6e0] text-[#566173] border-[#9aa4b4]'
                    : 'bg-white text-[#313a48] border-[#b4bcc8]'
                }`}
              >
                {i + 1}. {step.side.toUpperCase()} {step.action.toUpperCase()}
              </div>
            ))}
          </div>

          {/* Team Rosters */}
          <div className="grid md:grid-cols-2 gap-3">
            {(['blue', 'red'] as const).map((side) => {
              const roster = side === 'blue' ? snapshot.blueRoster : snapshot.redRoster;
              const coach = side === 'blue' ? snapshot.blueCoach : snapshot.redCoach;
              return (
                <div
                  key={side}
                  className={`bg-white border-2 p-3 ${
                    side === 'blue' ? 'border-[#143570]' : 'border-[#8f1d2c]'
                  }`}
                >
                  <div className="flex justify-between items-center mb-2 pb-1.5 border-b border-[#d0d6e0]">
                    <strong className={`text-xs uppercase ${side === 'blue' ? 'text-[#143570]' : 'text-[#8f1d2c]'}`}>
                      {side.toUpperCase()} TEAM {side === 'red' ? `(${opponentName})` : ''}
                    </strong>
                    <span className="text-[11px] text-[#566173] font-bold">
                      Coach: {coach.name} ({coach.style})
                    </span>
                  </div>

                  <div className="grid grid-cols-5 gap-1.5">
                    {roster.map((player, slot) => {
                      const pick = snapshot.picks[side].find((entry) => entry.slot === slot);
                      const champion = allChampions.find((entry) => entry.id === pick?.championId);
                      const selectable = side === mySide && isMyTurn && turn?.action === 'pick' && !pick;
                      return (
                        <button
                          key={`${side}-${slot}`}
                          type="button"
                          disabled={!selectable}
                          onClick={() => {
                            sound.playClick();
                            setChosenSlot(slot);
                          }}
                          className={`p-1.5 text-center border min-w-0 transition ${
                            selectable && selectedSlot === slot
                              ? 'border-2 border-[#c8961e] bg-[#fff3d1]'
                              : 'border-[#b4bcc8] bg-[#eef1f5]'
                          }`}
                        >
                          <div className="flex justify-center mb-1">
                            <ChibiAvatar avatarType={player.avatarSvg} size={32} />
                          </div>
                          <div className="truncate text-[#0b1f44] text-[11px] font-bold">{player.name}</div>
                          <div className="truncate text-[#566173] text-[10px]">
                            {player.preferredRole ?? player.role}
                          </div>
                          <div
                            className={`truncate text-[11px] font-black mt-0.5 ${
                              champion ? 'text-[#127a3a]' : 'text-[#b88406]'
                            }`}
                          >
                            {champion?.name ?? 'Empty'}
                          </div>
                        </button>
                      );
                    })}
                  </div>

                  <div className="text-[11px] text-[#313a48] mt-2 pt-1.5 border-t border-[#d0d6e0] flex items-center gap-1.5">
                    <Ban className="w-3.5 h-3.5 text-[#b91c1c]" />
                    <span>Banned:</span>
                    <strong className="text-[#0b1f44]">
                      {allChampions.find((c) => c.id === snapshot.bans[side])?.name ?? 'None'}
                    </strong>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Main Avatar Pick/Ban Selection and Dossier */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
        {/* Left Column: Avatar Grid with Role Filters and Search */}
        <div className="cm-panel lg:col-span-7">
          <div className="cm-panel-header">
            <span className="flex gap-2 items-center">
              {turn?.action === 'ban' ? (
                <Ban className="w-4 h-4 text-[#f2c14e]" />
              ) : (
                <Sparkles className="w-4 h-4 text-[#f2c14e]" />
              )}
              {isMyTurn
                ? turn.action === 'ban'
                  ? 'Select Avatar to Ban'
                  : `Drafting for ${myRoster[selectedSlot]?.name} (${
                      myRoster[selectedSlot]?.preferredRole ?? myRoster[selectedSlot]?.role
                    })`
                : `Waiting for ${turn?.side === 'red' ? opponentName : 'Blue team'}...`}
            </span>
          </div>

          <div className="cm-panel-body space-y-3">
            {/* Filter and Search Bar */}
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex flex-wrap gap-1">
                {(['All', 'Assassin', 'Fighter', 'Mage', 'Marksman', 'Support', 'Tank'] as const).map((role) => (
                  <button
                    type="button"
                    key={role}
                    onClick={() => {
                      sound.playClick();
                      setRoleFilter(role);
                    }}
                    className={`cm-btn py-1 px-2 text-xs ${roleFilter === role ? 'cm-btn-primary' : ''}`}
                  >
                    {role}
                  </button>
                ))}
              </div>

              <div className="relative min-w-[150px]">
                <Search className="w-3.5 h-3.5 text-[#566173] absolute left-2.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search avatar..."
                  className="cm-input w-full pl-8"
                />
              </div>
            </div>

            {/* Avatar Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2 max-h-[460px] overflow-y-auto p-0.5">
              {filteredChampions.map((champion) => {
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
                    className={`border p-2 text-left transition relative flex flex-col items-center cursor-pointer ${
                      isUsed
                        ? 'opacity-40 border-[#9aa4b4] bg-[#d7dce5] cursor-not-allowed'
                        : isInspected
                        ? 'border-2 border-[#c8961e] bg-[#fff3d1]'
                        : 'border-[#b4bcc8] bg-white hover:bg-[#f6f8fb]'
                    }`}
                  >
                    <div
                      className="w-11 h-11 flex items-center justify-center p-1 border mb-1"
                      style={{ borderColor: champion.primaryColor, backgroundColor: '#0b1f44' }}
                    >
                      <ChampionArtwork championId={champion.id} size={36} />
                    </div>

                    <div className="text-[#0b1f44] font-black text-xs text-center truncate w-full">
                      {champion.displayName}
                    </div>
                    <div className="text-[10px] text-[#143570] font-bold">{champion.primaryRole}</div>
                    <div className="text-[10px] text-[#566173] truncate max-w-full text-center">
                      {champion.archetype}
                    </div>

                    {isRec && !isUsed && (
                      <span className="mt-1 cm-badge cm-badge-gold">Coach Pick</span>
                    )}
                    {isUsed && <span className="mt-1 cm-badge cm-badge-red">Unavailable</span>}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Right Column: Avatar details and Lock-In */}
        <div className="cm-panel lg:col-span-5">
          <div className="cm-panel-header">
            <span>Scouting Dossier · {inspected?.displayName ?? 'Select Avatar'}</span>
            {inspected && <span className="cm-badge cm-badge-gold">{inspected.primaryRole}</span>}
          </div>

          <div className="cm-panel-body space-y-3">
            {inspected ? (
              <>
                {/* Lock-In Button at Top of Dossier so it's immediately reachable */}
                {isMyTurn && !used.has(inspected.id) && (
                  <div>
                    {turn.action === 'ban' ? (
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => submit(inspected.id, selectedSlot)}
                        className="cm-btn cm-btn-danger w-full py-2.5 text-xs"
                      >
                        <Ban className="w-4 h-4" />
                        <span>CONFIRM BAN: {inspected.displayName.toUpperCase()}</span>
                      </button>
                    ) : (
                      <button
                        type="button"
                        disabled={busy || !openSlots.includes(selectedSlot)}
                        onClick={() => submit(inspected.id, selectedSlot)}
                        className="cm-btn cm-btn-primary w-full py-2.5 text-xs"
                      >
                        <Check className="w-4 h-4" />
                        <span>
                          CONFIRM PICK FOR {currentPlayer?.name?.toUpperCase()}: {inspected.displayName.toUpperCase()}
                        </span>
                      </button>
                    )}
                  </div>
                )}

                {isSignatureForCurrent && (
                  <div className="bg-[#fff3d1] border border-[#c8961e] p-2.5 text-xs flex items-center gap-2 text-[#0b1f44] font-bold">
                    <Flame className="w-4 h-4 text-[#b88406] shrink-0" />
                    <span>
                      Signature Avatar for {currentPlayer?.name}! Grants +10% Combat Mastery Boost.
                    </span>
                  </div>
                )}

                <div className="flex items-center gap-3 bg-white border border-[#b4bcc8] p-3">
                  <div
                    className="w-14 h-14 flex items-center justify-center p-1 border-2 shrink-0"
                    style={{ borderColor: inspected.primaryColor, backgroundColor: '#0b1f44' }}
                  >
                    <ChampionArtwork championId={inspected.id} size={48} />
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline gap-2">
                      <h4 className="text-base font-black text-[#0b1f44] truncate">{inspected.displayName}</h4>
                      <span className="text-xs text-[#b88406] font-bold">{inspected.title}</span>
                    </div>
                    <div className="text-xs text-[#313a48] mt-0.5">
                      <strong>{inspected.primaryRole}</strong>
                      {inspected.secondaryRole && <span> / {inspected.secondaryRole}</span>} ·{' '}
                      <span className="text-[#566173]">{inspected.archetype}</span>
                    </div>
                  </div>
                </div>

                <div className="flex flex-wrap gap-1">
                  {AVATAR_COMBAT_TYPES.filter((type) => getAvatarCombatProfile(inspected)[type] > 0).map((type) => (
                    <span key={type} className="cm-badge cm-badge-blue">
                      {type}
                    </span>
                  ))}
                </div>

                {/* Base Combat Stats */}
                <div className="grid grid-cols-3 gap-1.5 bg-white p-2.5 border border-[#b4bcc8] text-xs">
                  <div>
                    <span className="text-[#566173] block text-[10px] font-bold">HP</span>
                    <strong className="font-mono text-[#0b1f44]">{inspected.hp}</strong>
                  </div>
                  <div>
                    <span className="text-[#566173] block text-[10px] font-bold">AD</span>
                    <strong className="font-mono text-[#0b1f44]">{inspected.ad}</strong>
                  </div>
                  <div>
                    <span className="text-[#566173] block text-[10px] font-bold">Armor</span>
                    <strong className="font-mono text-[#0b1f44]">{inspected.armor}</strong>
                  </div>
                  <div>
                    <span className="text-[#566173] block text-[10px] font-bold">MR</span>
                    <strong className="font-mono text-[#0b1f44]">{inspected.mr}</strong>
                  </div>
                  <div>
                    <span className="text-[#566173] block text-[10px] font-bold">Atk Spd</span>
                    <strong className="font-mono text-[#0b1f44]">{inspected.aspd}/s</strong>
                  </div>
                  <div>
                    <span className="text-[#566173] block text-[10px] font-bold">Range</span>
                    <strong className="font-mono text-[#0b1f44]">{inspected.range}</strong>
                  </div>
                </div>

                {/* Narrative lore */}
                <div className="bg-white p-2.5 border border-[#b4bcc8] space-y-1">
                  <div className="text-[10px] font-black uppercase text-[#0b1f44] flex items-center gap-1">
                    <BookOpen className="w-3 h-3 text-[#143570]" /> Avatar Lore:
                  </div>
                  <p className="text-xs text-[#313a48] italic leading-relaxed line-clamp-2">
                    &ldquo;{getChampionLore(inspected.id)}&rdquo;
                  </p>
                </div>

                {/* Ability Kit Breakdown */}
                {inspectedAbilities && (
                  <div className="border border-[#9aa4b4] bg-white p-2.5 text-[11px] leading-relaxed text-[#313a48]">
                    <strong className="text-[#0b1f44]">Authoritative Ability Mechanics</strong>
                    <div className="mt-1 grid gap-1">
                      {(['skill1', 'skill2', 'ultimate'] as const).map((slot) => {
                        const ability = inspectedAbilities[slot];
                        return (
                          <div key={slot}>
                            <b>
                              {slot === 'skill1' ? 'Q' : slot === 'skill2' ? 'W' : 'R'}: {ability.name}
                            </b>{' '}
                            — {abilityCompactSummary(ability)}
                            {ability.movement ? ` · ${ability.movement.kind.toUpperCase()}` : ''}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                <div className="space-y-1.5 border-t border-[#c4cbd6] pt-2">
                  <h4 className="text-xs font-black text-[#0b1f44] uppercase">Original Ability Kit</h4>
                  <div className="border border-[#b4bcc8] bg-white p-2 text-xs">
                    <b className="text-[#0b1f44]">{inspected.passiveName ?? 'Passive'}</b>
                    <p className="text-[#313a48] mt-0.5">{inspected.passiveDesc}</p>
                  </div>
                  {(['skill1', 'skill2', 'ultimate'] as const).map((slot, index) => (
                    <div key={slot} className="border border-[#b4bcc8] bg-white p-2 text-xs">
                      <b className="text-[#0b1f44]">
                        {['Q', 'W', 'R'][index]}: {inspected[slot].name}
                      </b>
                      <p className="text-[#313a48] mt-0.5">{inspected[slot].desc}</p>
                      <small className="text-[#566173] font-mono">
                        {inspected[slot].cooldown}s base cooldown
                      </small>
                    </div>
                  ))}
                  {inspected.id === 'c_invoker' && <MirellePatternBook />}
                </div>
              </>
            ) : (
              <div className="py-12 text-center text-[#566173] text-xs">
                Select any avatar from the grid to inspect details.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
