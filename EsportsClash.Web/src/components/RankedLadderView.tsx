// src/components/RankedLadderView.tsx
// Pure Chess-Style Competitive Ladder for Esports Clash
// Rating begins at 300. Follows authentic Chess hierarchy (Pawn to Grandmaster).

import React, { useState } from 'react';
import { 
  CHESS_RANK_TIERS, 
  ChessRankTier, 
  LadderEntry, 
  LadderProfile, 
  getChessRank, 
  getNextChessRank, 
  getRankProgressPercent,
  getLadderLeaderboard
} from '../ladderRating';
import { sound } from '../audio';
import { 
  Swords, 
  Trophy, 
  TrendingUp, 
  Flame, 
  Target, 
  Shield, 
  Info, 
  Award, 
  Search, 
  CheckCircle2, 
  XCircle,
  History,
  Zap,
  ChevronRight
} from 'lucide-react';

interface Props {
  profile: LadderProfile;
  playerName?: string;
  onPlayRankedMultiplayer: () => void;
  onPracticeMatch?: (opponent: LadderEntry) => void;
  onQueueRankedMatch?: (opponent: LadderEntry) => void;
}

export const RankedLadderView: React.FC<Props> = ({
  profile,
  playerName = 'T-Chibi Squad',
  onPlayRankedMultiplayer,
  onPracticeMatch,
  onQueueRankedMatch
}) => {
  const [activeTierFilter, setActiveTierFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [activeSubView, setActiveSubView] = useState<'standings' | 'history' | 'tiers'>('standings');

  const leaderboard = getLadderLeaderboard(profile, playerName);
  const playerEntry = leaderboard.find(e => e.isPlayer) || leaderboard[leaderboard.length - 1];
  const currentTier = getChessRank(profile.rating);
  const nextTier = getNextChessRank(profile.rating);
  const progressPercent = getRankProgressPercent(profile.rating);

  // Filter leaderboard
  const filteredLeaderboard = leaderboard.filter(entry => {
    const matchesTier = activeTierFilter === 'all' || entry.tier.id === activeTierFilter;
    const matchesSearch = !searchQuery || 
      entry.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      entry.tag.toLowerCase().includes(searchQuery.toLowerCase()) ||
      entry.tier.name.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesTier && matchesSearch;
  });

  // Find recommended opponent within +/- 120 rating
  const candidates = leaderboard.filter(e => !e.isPlayer && Math.abs(e.rating - profile.rating) <= 150);
  const recommendedOpponent = candidates.length > 0
    ? candidates.sort((a, b) => Math.abs(a.rating - profile.rating) - Math.abs(b.rating - profile.rating))[0]
    : leaderboard.find(e => !e.isPlayer) || leaderboard[0];

  const handleQuickQueue = () => {
    sound.playClick();
    if (onPlayRankedMultiplayer) {
      onPlayRankedMultiplayer();
    } else if (onQueueRankedMatch) {
      onQueueRankedMatch(recommendedOpponent);
    }
  };

  return (
    <div className="space-y-6 animate-fade-in max-w-6xl mx-auto">
      {/* ======================================================== */}
      {/* 1. HERO LADDER STATUS BANNER */}
      {/* ======================================================== */}
      <div className="bg-gradient-to-r from-slate-900 via-slate-950 to-indigo-950/80 border border-slate-800 rounded-3xl p-6 shadow-2xl relative overflow-hidden">
        {/* Subtle decorative glow */}
        <div className="absolute top-0 right-0 w-96 h-96 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none -mr-20 -mt-20" />
        <div className="absolute bottom-0 left-0 w-96 h-96 bg-amber-500/10 rounded-full blur-3xl pointer-events-none -ml-20 -mb-20" />

        <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          {/* Left: Player Status & Current Chess Rank */}
          <div className="flex items-start sm:items-center gap-5">
            <div className={`w-20 h-20 sm:w-24 sm:h-24 rounded-3xl bg-slate-950 border-2 ${currentTier.borderColor} flex flex-col items-center justify-center shadow-xl relative group`}>
              <span className="text-4xl sm:text-5xl">{currentTier.icon}</span>
              <span className="text-[10px] font-black uppercase text-slate-400 mt-1">{currentTier.name}</span>
              {profile.streak >= 2 && (
                <div className="absolute -top-2 -right-2 bg-gradient-to-r from-amber-500 to-rose-500 text-white text-[9px] font-black px-2 py-0.5 rounded-full flex items-center gap-0.5 shadow-lg animate-pulse">
                  <Flame className="w-3 h-3" /> {profile.streak} W
                </div>
              )}
            </div>

            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="text-[11px] font-black tracking-widest uppercase text-cyan-400 flex items-center gap-1">
                  <Trophy className="w-3.5 h-3.5" /> CHESS COMPETITIVE LADDER
                </span>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 font-bold border border-slate-700">
                  Global Rank #{playerEntry.rank}
                </span>
              </div>

              <h2 className="text-2xl sm:text-3xl font-black text-white flex items-center gap-3">
                <span>{playerName}</span>
                <span className={`text-xs px-2.5 py-1 rounded-xl font-black border ${currentTier.badgeColor}`}>
                  {currentTier.icon} {currentTier.title}
                </span>
              </h2>

              {/* Big Rating Display */}
              <div className="flex items-baseline gap-2 mt-1">
                <span className="text-3xl sm:text-4xl font-black text-amber-300 font-mono tracking-tight">
                  {profile.rating}
                </span>
                <span className="text-sm font-black text-slate-400 uppercase tracking-wider">
                  Rating
                </span>
                <span className="text-xs text-slate-500 ml-2">
                  (Peak: <strong className="text-slate-300">{profile.peakRating}</strong>)
                </span>
              </div>

              {/* Progress to next tier */}
              {nextTier ? (
                <div className="mt-3 max-w-md">
                  <div className="flex justify-between text-[11px] font-bold text-slate-400 mb-1">
                    <span>Progress to {nextTier.icon} {nextTier.name}</span>
                    <span className="text-cyan-300 font-mono">{profile.rating} / {nextTier.minRating} ({progressPercent}%)</span>
                  </div>
                  <div className="h-2.5 bg-slate-800/80 rounded-full overflow-hidden border border-slate-700">
                    <div 
                      className="h-full bg-gradient-to-r from-cyan-400 via-blue-500 to-indigo-500 rounded-full transition-all duration-500"
                      style={{ width: `${progressPercent}%` }}
                    />
                  </div>
                </div>
              ) : (
                <div className="text-xs text-amber-300 font-black mt-2 flex items-center gap-1.5">
                  👑 Peak Pinnacle Achieved: Super Grandmaster Tier
                </div>
              )}
            </div>
          </div>

          {/* Right: Career Stats & Fast Queue Button */}
          <div className="flex flex-col sm:flex-row lg:flex-col items-start lg:items-end justify-between gap-4 border-t lg:border-t-0 lg:border-l border-slate-800 pt-4 lg:pt-0 lg:pl-6">
            <div className="grid grid-cols-3 gap-4 text-center w-full lg:w-auto">
              <div className="bg-slate-950/70 border border-slate-800 rounded-2xl px-4 py-2">
                <div className="text-[10px] text-slate-400 uppercase font-black">Record</div>
                <div className="text-sm font-black text-white font-mono mt-0.5">
                  <span className="text-emerald-400">{profile.wins}W</span>
                  <span className="text-slate-500 mx-1">-</span>
                  <span className="text-rose-400">{profile.losses}L</span>
                </div>
              </div>

              <div className="bg-slate-950/70 border border-slate-800 rounded-2xl px-4 py-2">
                <div className="text-[10px] text-slate-400 uppercase font-black">Win Rate</div>
                <div className="text-sm font-black text-cyan-300 font-mono mt-0.5">
                  {playerEntry.winRate}%
                </div>
              </div>

              <div className="bg-slate-950/70 border border-slate-800 rounded-2xl px-4 py-2">
                <div className="text-[10px] text-slate-400 uppercase font-black">Streak</div>
                <div className="text-sm font-black font-mono mt-0.5">
                  {profile.streak > 0 ? (
                    <span className="text-amber-400">+{profile.streak} W</span>
                  ) : profile.streak < 0 ? (
                    <span className="text-rose-400">{profile.streak} L</span>
                  ) : (
                    <span className="text-slate-400">0</span>
                  )}
                </div>
              </div>
            </div>

            <button
              onClick={() => {
                sound.playClick();
                onPlayRankedMultiplayer();
              }}
              className="w-full sm:w-auto px-6 py-3 bg-gradient-to-r from-amber-400 via-yellow-500 to-amber-500 hover:brightness-110 text-slate-950 font-black text-sm rounded-2xl shadow-xl transition-all flex items-center justify-center gap-2 transform hover:-translate-y-0.5 cursor-pointer"
            >
              <Swords className="w-5 h-5 text-slate-950" />
              <span>Play Ranked (Vs Player)</span>
            </button>
          </div>
        </div>
      </div>

      {/* ======================================================== */}
      {/* 2. SUB-VIEW NAVIGATION & SEARCH BAR */}
      {/* ======================================================== */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-slate-900/60 p-2 rounded-2xl border border-slate-800">
        <div className="flex items-center gap-1.5 overflow-x-auto">
          <button
            onClick={() => { sound.playClick(); setActiveSubView('standings'); }}
            className={`px-4 py-2 rounded-xl text-xs font-black transition flex items-center gap-1.5 whitespace-nowrap ${
              activeSubView === 'standings'
                ? 'bg-amber-400 text-slate-950 shadow'
                : 'text-slate-400 hover:text-white hover:bg-slate-800'
            }`}
          >
            <Trophy className="w-4 h-4" /> Global Standings
          </button>

          <button
            onClick={() => { sound.playClick(); setActiveSubView('history'); }}
            className={`px-4 py-2 rounded-xl text-xs font-black transition flex items-center gap-1.5 whitespace-nowrap ${
              activeSubView === 'history'
                ? 'bg-cyan-400 text-slate-950 shadow'
                : 'text-slate-400 hover:text-white hover:bg-slate-800'
            }`}
          >
            <History className="w-4 h-4" /> Match History ({profile.recentMatches.length})
          </button>

          <button
            onClick={() => { sound.playClick(); setActiveSubView('tiers'); }}
            className={`px-4 py-2 rounded-xl text-xs font-black transition flex items-center gap-1.5 whitespace-nowrap ${
              activeSubView === 'tiers'
                ? 'bg-purple-500 text-white shadow'
                : 'text-slate-400 hover:text-white hover:bg-slate-800'
            }`}
          >
            <Award className="w-4 h-4" /> Chess Tier Codex
          </button>
        </div>

        {activeSubView === 'standings' && (
          <div className="relative flex-1 sm:flex-initial sm:w-64">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder="Search team, tag or tier..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500"
            />
          </div>
        )}
      </div>

      {/* ======================================================== */}
      {/* 3. TIER FILTER PILLS (Only for Standings sub-view) */}
      {/* ======================================================== */}
      {activeSubView === 'standings' && (
        <div className="flex items-center gap-2 overflow-x-auto pb-1 text-xs">
          <span className="text-slate-500 font-bold text-[11px] whitespace-nowrap">Tier Filter:</span>
          <button
            onClick={() => { sound.playClick(); setActiveTierFilter('all'); }}
            className={`px-3 py-1.5 rounded-xl font-bold whitespace-nowrap transition ${
              activeTierFilter === 'all'
                ? 'bg-slate-200 text-slate-950 shadow'
                : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
            }`}
          >
            All Tiers ({leaderboard.length})
          </button>

          {CHESS_RANK_TIERS.map(tier => {
            const count = leaderboard.filter(e => e.tier.id === tier.id).length;
            const isSelected = activeTierFilter === tier.id;
            return (
              <button
                key={tier.id}
                onClick={() => { sound.playClick(); setActiveTierFilter(tier.id); }}
                className={`px-3 py-1.5 rounded-xl font-bold whitespace-nowrap transition flex items-center gap-1.5 ${
                  isSelected
                    ? 'bg-amber-400 text-slate-950 shadow'
                    : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
                }`}
              >
                <span>{tier.icon}</span>
                <span>{tier.name}</span>
                <span className={`text-[10px] px-1.5 py-0.2 rounded-full ${isSelected ? 'bg-slate-950/30 text-slate-950 font-mono' : 'bg-slate-800 text-slate-400'}`}>
                  {count}
                </span>
              </button>
            );
          })}
        </div>
      )}

      {/* ======================================================== */}
      {/* 4. VIEW: STANDINGS TABLE */}
      {/* ======================================================== */}
      {activeSubView === 'standings' && (
        <div className="bg-slate-900/80 border border-slate-800 rounded-3xl overflow-hidden shadow-xl">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-950/80 border-b border-slate-800 text-slate-400 uppercase text-[10px] font-black tracking-wider">
                <tr>
                  <th className="py-3.5 px-4 w-16 text-center">Rank</th>
                  <th className="py-3.5 px-4">Club</th>
                  <th className="py-3.5 px-4">Chess Tier</th>
                  <th className="py-3.5 px-4 font-mono">Rating</th>
                  <th className="py-3.5 px-4 text-center">Record</th>
                  <th className="py-3.5 px-4 text-center">Win %</th>
                  <th className="py-3.5 px-4 text-center">Form</th>
                  <th className="py-3.5 px-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {filteredLeaderboard.map((entry) => {
                  const isPlayer = entry.isPlayer;
                  const ratingDiff = entry.rating - profile.rating;
                  const canChallenge = !isPlayer && Math.abs(ratingDiff) <= 150;

                  return (
                    <tr
                      key={entry.id}
                      className={`transition-colors ${
                        isPlayer
                          ? 'bg-amber-500/10 hover:bg-amber-500/15 border-l-4 border-l-amber-400'
                          : 'hover:bg-slate-800/40'
                      }`}
                    >
                      {/* Rank Number */}
                      <td className="py-3.5 px-4 text-center font-black">
                        {entry.rank === 1 ? (
                          <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-amber-400 text-slate-950 text-xs shadow">
                            👑
                          </span>
                        ) : entry.rank === 2 ? (
                          <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-slate-300 text-slate-950 text-xs shadow">
                            🥈
                          </span>
                        ) : entry.rank === 3 ? (
                          <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-amber-700 text-white text-xs shadow">
                            🥉
                          </span>
                        ) : (
                          <span className="font-mono text-slate-400">#{entry.rank}</span>
                        )}
                      </td>

                      {/* Team Name & Tag */}
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-2">
                          <div className="font-black text-white flex items-center gap-1.5">
                            <span>{entry.name}</span>
                            <span className="text-[10px] text-slate-400 font-mono px-1.5 py-0.5 rounded bg-slate-800">
                              [{entry.tag}]
                            </span>
                            {isPlayer && (
                              <span className="text-[9px] font-black uppercase px-2 py-0.5 rounded-full bg-amber-400 text-slate-950 shadow">
                                YOU
                              </span>
                            )}
                          </div>
                        </div>
                        <div className="text-[10px] text-slate-500">Coach: {entry.coachName}</div>
                      </td>

                      {/* Chess Tier */}
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-1.5">
                          <span className="text-base">{entry.tier.icon}</span>
                          <div>
                            <div className="font-bold text-white text-xs leading-none">{entry.tier.name}</div>
                            <div className="text-[10px] text-slate-400 leading-tight mt-0.5">{entry.tier.title}</div>
                          </div>
                        </div>
                      </td>

                      {/* Rating */}
                      <td className="py-3.5 px-4">
                        <span className="font-mono font-black text-sm text-amber-300">
                          {entry.rating}
                        </span>
                        <span className="text-[10px] text-slate-500 ml-1">Rating</span>
                      </td>

                      {/* Record */}
                      <td className="py-3.5 px-4 text-center font-mono">
                        <span className="text-emerald-400 font-bold">{entry.wins}W</span>
                        <span className="text-slate-600 mx-1">-</span>
                        <span className="text-rose-400 font-bold">{entry.losses}L</span>
                      </td>

                      {/* Win Rate */}
                      <td className="py-3.5 px-4 text-center font-mono font-bold text-slate-300">
                        {entry.winRate}%
                      </td>

                      {/* Recent Form */}
                      <td className="py-3.5 px-4 text-center">
                        <div className="inline-flex items-center gap-1">
                          {entry.recentForm.slice(-5).map((res, idx) => (
                            <span
                              key={idx}
                              className={`w-4 h-4 rounded text-[9px] font-black flex items-center justify-center ${
                                res === 'W'
                                  ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40'
                                  : 'bg-rose-500/20 text-rose-400 border border-rose-500/40'
                              }`}
                            >
                              {res}
                            </span>
                          ))}
                        </div>
                      </td>

                      {/* Challenge Action */}
                      <td className="py-3.5 px-4 text-right">
                        {isPlayer ? (
                          <span className="text-[10px] text-amber-400 font-bold italic">Your Squad</span>
                        ) : (
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              onClick={() => { sound.playClick(); onPlayRankedMultiplayer(); }}
                              className="px-2.5 py-1.5 bg-gradient-to-r from-amber-400 to-yellow-500 hover:brightness-110 text-slate-950 font-black text-[11px] rounded-xl shadow transition flex items-center gap-1 cursor-pointer"
                              title="Enter multiplayer lobby to play a Ranked match"
                            >
                              <Swords className="w-3 h-3" />
                              <span>Play Ranked</span>
                            </button>
                            {onPracticeMatch && (
                              <button
                                onClick={() => { sound.playClick(); onPracticeMatch(entry); }}
                                className="px-2 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-[11px] rounded-xl transition cursor-pointer"
                                title="Practice scrimmage (unranked offline test)"
                              >
                                Scrim
                              </button>
                            )}
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* 5. VIEW: MATCH HISTORY */}
      {/* ======================================================== */}
      {activeSubView === 'history' && (
        <div className="bg-slate-900/80 border border-slate-800 rounded-3xl p-6 shadow-xl">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-base font-black text-white flex items-center gap-2">
              <History className="w-4 h-4 text-cyan-400" />
              <span>Ranked Match History</span>
            </h3>
            <span className="text-xs text-slate-400">
              Total Ranked Matches: <strong className="text-white">{profile.matchesPlayed}</strong>
            </span>
          </div>

          {profile.recentMatches.length === 0 ? (
            <div className="text-center py-12 text-slate-500 text-xs">
              <p className="text-base mb-2">♟️ No Ranked Matches Recorded Yet</p>
              <p>Queue for your first competitive multiplayer match to start climbing towards Grandmaster!</p>
              <button
                onClick={() => { sound.playClick(); onPlayRankedMultiplayer(); }}
                className="mt-4 px-5 py-2.5 bg-amber-400 text-slate-950 font-black text-xs rounded-xl shadow hover:brightness-110 transition inline-flex items-center gap-2 cursor-pointer"
              >
                <Swords className="w-4 h-4" /> Play First Ranked Match (Vs Player)
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              {profile.recentMatches.slice().reverse().map((match) => {
                const isWin = match.result === 'win';
                return (
                  <div
                    key={match.id}
                    className={`border rounded-2xl p-4 flex flex-wrap items-center justify-between gap-4 transition ${
                      isWin
                        ? 'bg-emerald-950/20 border-emerald-500/30'
                        : 'bg-rose-950/20 border-rose-500/30'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-lg ${
                        isWin ? 'bg-emerald-500/20 text-emerald-300' : 'bg-rose-500/20 text-rose-300'
                      }`}>
                        {isWin ? <CheckCircle2 className="w-5 h-5" /> : <XCircle className="w-5 h-5" />}
                      </div>

                      <div>
                        <div className="flex items-center gap-2">
                          <span className={`text-xs font-black uppercase px-2 py-0.5 rounded ${
                            isWin ? 'bg-emerald-500 text-slate-950' : 'bg-rose-500 text-white'
                          }`}>
                            {isWin ? 'VICTORY' : 'DEFEAT'}
                          </span>
                          <span className="text-sm font-black text-white">vs {match.opponentName}</span>
                          <span className="text-xs text-slate-400">({match.opponentRating} Rating)</span>
                        </div>
                        <div className="text-[10px] text-slate-500 mt-0.5">
                          {new Date(match.timestamp).toLocaleDateString()} · {new Date(match.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-4 text-right">
                      <div>
                        <div className="text-xs font-bold text-slate-400">Rating Progression</div>
                        <div className="text-sm font-mono font-black text-white flex items-center gap-1.5 justify-end">
                          <span className="text-slate-400">{match.ratingBefore}</span>
                          <ChevronRight className="w-3.5 h-3.5 text-slate-600" />
                          <span className="text-amber-300">{match.ratingAfter}</span>
                        </div>
                      </div>

                      <div className={`px-3 py-1.5 rounded-xl text-sm font-mono font-black ${
                        isWin ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40' : 'bg-rose-500/20 text-rose-300 border border-rose-500/40'
                      }`}>
                        {match.delta >= 0 ? `+${match.delta}` : match.delta} Rating
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ======================================================== */}
      {/* 6. VIEW: CHESS TIER CODEX */}
      {/* ======================================================== */}
      {activeSubView === 'tiers' && (
        <div className="space-y-4">
          <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-6 shadow-xl">
            <h3 className="text-lg font-black text-white flex items-center gap-2 mb-2">
              <Award className="w-5 h-5 text-amber-400" />
              <span>Chess-Style Ladder Hierarchy</span>
            </h3>
            <p className="text-xs text-slate-300 leading-relaxed max-w-3xl">
              Esports Clash utilizes authentic Chess Elo ratings beginning at <strong>300 Rating (Pawn tier)</strong>. 
              There are no League Points (LP) or traditional Bronze/Silver/Gold badges. Every match evaluates your opponent's rating relative to yours: 
              triumphing against a higher-rated master awards abundant rating, while early win streaks accelerate your ascent toward the Super Grandmaster summit.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {CHESS_RANK_TIERS.map((tier) => {
              const isUserCurrent = currentTier.id === tier.id;
              return (
                <div
                  key={tier.id}
                  className={`border rounded-3xl p-5 shadow-lg relative overflow-hidden transition ${
                    isUserCurrent
                      ? 'bg-gradient-to-br from-amber-500/10 to-slate-900 border-amber-400 ring-2 ring-amber-400/40'
                      : 'bg-slate-900/80 border-slate-800'
                  }`}
                >
                  {isUserCurrent && (
                    <div className="absolute top-3 right-3 text-[9px] font-black px-2 py-0.5 rounded-full bg-amber-400 text-slate-950 uppercase shadow">
                      CURRENT RANK
                    </div>
                  )}

                  <div className="flex items-center gap-3 mb-3">
                    <div className={`w-12 h-12 rounded-2xl bg-slate-950 border ${tier.borderColor} flex items-center justify-center text-2xl shadow`}>
                      {tier.icon}
                    </div>
                    <div>
                      <h4 className="text-base font-black text-white">{tier.name}</h4>
                      <div className="text-xs text-slate-400 font-bold">{tier.title}</div>
                    </div>
                  </div>

                  <div className="bg-slate-950/80 rounded-xl p-2.5 border border-slate-800/80 text-xs mb-3 flex items-center justify-between font-mono">
                    <span className="text-slate-400">Rating Range:</span>
                    <span className="text-amber-300 font-black">
                      {tier.minRating} {tier.maxRating < 9999 ? `– ${tier.maxRating}` : '+'}
                    </span>
                  </div>

                  <p className="text-xs text-slate-400 leading-relaxed">
                    {tier.description}
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};

