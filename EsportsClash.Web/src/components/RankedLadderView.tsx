// src/components/RankedLadderView.tsx
// Pure Chess-Style Competitive Ladder for Esports Clash
// Rating begins at 300. Follows authentic Chess hierarchy (Pawn to Grandmaster).

import React, { useState } from 'react';
import {
  CHESS_RANK_TIERS,
  LadderEntry,
  LadderProfile,
  getChessRank,
  getNextChessRank,
  getRankProgressPercent,
  getLadderLeaderboard
} from '../ladderRating';
import { sound } from '../audio';
import { Swords, Trophy, Flame, Award, Search, CheckCircle2, XCircle, History } from 'lucide-react';

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
  const playerEntry = leaderboard.find((e) => e.isPlayer) || leaderboard[leaderboard.length - 1];
  const currentTier = getChessRank(profile.rating);
  const nextTier = getNextChessRank(profile.rating);
  const progressPercent = getRankProgressPercent(profile.rating);

  const filteredLeaderboard = leaderboard.filter((entry) => {
    const matchesTier = activeTierFilter === 'all' || entry.tier.id === activeTierFilter;
    const matchesSearch =
      !searchQuery ||
      entry.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      entry.tag.toLowerCase().includes(searchQuery.toLowerCase()) ||
      entry.tier.name.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesTier && matchesSearch;
  });

  return (
    <div className="space-y-4">
      {/* 1. HERO LADDER STATUS PANEL */}
      <div className="cm-panel">
        <div className="cm-panel-header">
          <span className="flex items-center gap-2">
            <Trophy className="w-4 h-4 text-[#f2c14e]" />
            <span>Chess Competitive Ranked Ladder · Global Rank #{playerEntry.rank}</span>
          </span>
          <span className="cm-badge cm-badge-gold">
            {currentTier.icon} {currentTier.name} ({currentTier.title})
          </span>
        </div>

        <div className="cm-panel-body">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-white border border-[#b4bcc8] p-4">
            {/* Left: Player Status & Current Chess Rank */}
            <div className="flex items-start sm:items-center gap-4">
              <div className="w-16 h-16 bg-[#0b1f44] border-2 border-[#f2c14e] flex flex-col items-center justify-center text-white shrink-0">
                <span className="text-3xl leading-none">{currentTier.icon}</span>
                <span className="text-[10px] font-bold uppercase text-[#f2c14e] mt-1">{currentTier.name}</span>
              </div>

              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="text-xl font-black text-[#0b1f44]">{playerName}</h2>
                  <span className="cm-badge cm-badge-navy">
                    {currentTier.icon} {currentTier.title}
                  </span>
                  {profile.streak >= 2 && (
                    <span className="cm-badge cm-badge-gold flex items-center gap-1">
                      <Flame className="w-3 h-3" /> {profile.streak}W Streak
                    </span>
                  )}
                </div>

                <div className="flex items-baseline gap-2 mt-1">
                  <span className="text-2xl font-black text-[#0b1f44] font-mono">{profile.rating}</span>
                  <span className="text-xs font-bold text-[#566173] uppercase">Chess Rating</span>
                  <span className="text-xs text-[#566173] ml-1">
                    (Peak: <strong>{profile.peakRating}</strong>)
                  </span>
                </div>

                {nextTier ? (
                  <div className="mt-2 max-w-sm">
                    <div className="flex justify-between text-[11px] font-bold text-[#313a48] mb-0.5">
                      <span>
                        Progress to {nextTier.icon} {nextTier.name}
                      </span>
                      <span className="font-mono text-[#0b1f44]">
                        {profile.rating} / {nextTier.minRating} ({progressPercent}%)
                      </span>
                    </div>
                    <div className="h-2 bg-[#d7dce5] border border-[#9aa4b4] w-64 max-w-full">
                      <div className="h-full bg-[#143570]" style={{ width: `${progressPercent}%` }} />
                    </div>
                  </div>
                ) : (
                  <div className="text-xs text-[#b88406] font-black mt-1">
                    👑 Peak Pinnacle Achieved: Super Grandmaster Tier
                  </div>
                )}
              </div>
            </div>

            {/* Right: Career Stats & Fast Queue Button */}
            <div className="flex flex-wrap items-center gap-3">
              <div className="grid grid-cols-3 gap-2 text-center">
                <div className="bg-[#eef1f5] border border-[#b4bcc8] px-3 py-1.5">
                  <div className="text-[10px] text-[#566173] uppercase font-bold">Record</div>
                  <div className="text-xs font-black font-mono mt-0.5">
                    <span className="text-[#127a3a]">{profile.wins}W</span>-
                    <span className="text-[#b91c1c]">{profile.losses}L</span>
                  </div>
                </div>

                <div className="bg-[#eef1f5] border border-[#b4bcc8] px-3 py-1.5">
                  <div className="text-[10px] text-[#566173] uppercase font-bold">Win %</div>
                  <div className="text-xs font-black text-[#0b1f44] font-mono mt-0.5">{playerEntry.winRate}%</div>
                </div>

                <div className="bg-[#eef1f5] border border-[#b4bcc8] px-3 py-1.5">
                  <div className="text-[10px] text-[#566173] uppercase font-bold">Streak</div>
                  <div className="text-xs font-black font-mono mt-0.5">
                    {profile.streak > 0 ? `+${profile.streak}W` : profile.streak < 0 ? `${profile.streak}L` : '0'}
                  </div>
                </div>
              </div>

              <button
                type="button"
                onClick={() => {
                  sound.playClick();
                  onPlayRankedMultiplayer();
                }}
                className="cm-btn cm-btn-primary px-5 py-2.5 text-sm"
              >
                <Swords className="w-4 h-4" />
                <span>Play Ranked (Vs Player)</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* 2. SUB-VIEW TABS & SEARCH BAR */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="cm-tabs mb-0 border-b-0">
          <button
            type="button"
            onClick={() => {
              sound.playClick();
              setActiveSubView('standings');
            }}
            className={`cm-tab ${activeSubView === 'standings' ? 'active' : ''}`}
          >
            <Trophy className="w-3.5 h-3.5 inline mr-1.5" /> Global Standings
          </button>

          <button
            type="button"
            onClick={() => {
              sound.playClick();
              setActiveSubView('history');
            }}
            className={`cm-tab ${activeSubView === 'history' ? 'active' : ''}`}
          >
            <History className="w-3.5 h-3.5 inline mr-1.5" /> Match History ({profile.recentMatches.length})
          </button>

          <button
            type="button"
            onClick={() => {
              sound.playClick();
              setActiveSubView('tiers');
            }}
            className={`cm-tab ${activeSubView === 'tiers' ? 'active' : ''}`}
          >
            <Award className="w-3.5 h-3.5 inline mr-1.5" /> Chess Tier Codex
          </button>
        </div>

        {activeSubView === 'standings' && (
          <div className="relative w-64">
            <Search className="w-3.5 h-3.5 text-[#566173] absolute left-2.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search team, tag or tier..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="cm-input w-full pl-8"
            />
          </div>
        )}
      </div>

      {/* 3. TIER FILTER PILLS */}
      {activeSubView === 'standings' && (
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs">
          <span className="text-[#313a48] font-bold text-[11px] whitespace-nowrap mr-1">Chess Tier:</span>
          <button
            type="button"
            onClick={() => {
              sound.playClick();
              setActiveTierFilter('all');
            }}
            className={`cm-btn py-1 px-2.5 text-xs ${activeTierFilter === 'all' ? 'cm-btn-primary' : ''}`}
          >
            All Tiers ({leaderboard.length})
          </button>

          {CHESS_RANK_TIERS.map((tier) => {
            const count = leaderboard.filter((e) => e.tier.id === tier.id).length;
            const isSelected = activeTierFilter === tier.id;
            return (
              <button
                type="button"
                key={tier.id}
                onClick={() => {
                  sound.playClick();
                  setActiveTierFilter(tier.id);
                }}
                className={`cm-btn py-1 px-2.5 text-xs whitespace-nowrap ${isSelected ? 'cm-btn-primary' : ''}`}
              >
                <span>{tier.icon}</span>
                <span>{tier.name}</span>
                <span className="font-mono text-[10px] opacity-80">({count})</span>
              </button>
            );
          })}
        </div>
      )}

      {/* 4. VIEW: STANDINGS TABLE */}
      {activeSubView === 'standings' && (
        <div className="cm-panel">
          <div className="cm-panel-header">
            <span>Global Chess Ladder Standings ({filteredLeaderboard.length} Clubs)</span>
          </div>
          <div className="cm-panel-body p-0">
            <div className="cm-table-wrap border-0">
              <table className="cm-table">
                <thead>
                  <tr>
                    <th>Rank</th>
                    <th>Club</th>
                    <th>Coach</th>
                    <th>Chess Tier</th>
                    <th>Rating</th>
                    <th>Record</th>
                    <th>Win %</th>
                    <th>Form</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredLeaderboard.map((entry) => {
                    const isPlayer = entry.isPlayer;
                    return (
                      <tr key={entry.id} className={isPlayer ? 'cm-row-highlight' : ''}>
                        <td className="font-mono font-black text-[#0b1f44]">
                          {entry.rank === 1
                            ? '👑 #1'
                            : entry.rank === 2
                            ? '🥈 #2'
                            : entry.rank === 3
                            ? '🥉 #3'
                            : `#${entry.rank}`}
                        </td>
                        <td className="font-bold text-[#0b1f44]">
                          <span>{entry.name}</span>
                          <span className="ml-1.5 font-mono text-[11px] text-[#566173]">[{entry.tag}]</span>
                          {isPlayer && <span className="ml-1.5 cm-badge cm-badge-gold">YOU</span>}
                        </td>
                        <td className="text-xs text-[#313a48]">{entry.coachName}</td>
                        <td>
                          <span className="font-bold text-[#0b1f44]">
                            {entry.tier.icon} {entry.tier.name}
                          </span>
                          <span className="text-[11px] text-[#566173] ml-1">({entry.tier.title})</span>
                        </td>
                        <td className="font-mono font-black text-[#0b1f44]">{entry.rating}</td>
                        <td className="font-mono">
                          <span className="text-[#127a3a] font-bold">{entry.wins}W</span>-
                          <span className="text-[#b91c1c] font-bold">{entry.losses}L</span>
                        </td>
                        <td className="font-mono font-bold">{entry.winRate}%</td>
                        <td>
                          <div className="inline-flex items-center gap-0.5">
                            {entry.recentForm.slice(-5).map((res, idx) => (
                              <span
                                key={idx}
                                className={`px-1 py-0.2 text-[10px] font-mono font-bold border ${
                                  res === 'W'
                                    ? 'bg-[#dcfce7] text-[#14532d] border-[#4ade80]'
                                    : 'bg-[#fee2e2] text-[#7f1d1d] border-[#f87171]'
                                }`}
                              >
                                {res}
                              </span>
                            ))}
                          </div>
                        </td>
                        <td>
                          {isPlayer ? (
                            <span className="text-[11px] font-bold text-[#566173]">Your Club</span>
                          ) : (
                            <div className="flex items-center gap-1">
                              {onQueueRankedMatch && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    sound.playClick();
                                    onQueueRankedMatch(entry);
                                  }}
                                  className="cm-btn py-0.5 px-2 text-[11px]"
                                  title="Challenge this ladder club in an AI scrimmage"
                                >
                                  Scrim AI
                                </button>
                              )}
                              <button
                                type="button"
                                onClick={() => {
                                  sound.playClick();
                                  onPlayRankedMultiplayer();
                                }}
                                className="cm-btn cm-btn-primary py-0.5 px-2 text-[11px]"
                              >
                                Play Ranked
                              </button>
                              {onPracticeMatch && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    sound.playClick();
                                    onPracticeMatch(entry);
                                  }}
                                  className="cm-btn py-0.5 px-2 text-[11px]"
                                >
                                  Practice
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
        </div>
      )}

      {/* 5. VIEW: MATCH HISTORY */}
      {activeSubView === 'history' && (
        <div className="cm-panel">
          <div className="cm-panel-header">
            <span>Ranked Match History</span>
            <span className="cm-badge cm-badge-blue">Total Played: {profile.matchesPlayed}</span>
          </div>

          <div className="cm-panel-body">
            {profile.recentMatches.length === 0 ? (
              <div className="bg-white border border-[#b4bcc8] text-center py-10 text-xs text-[#566173] space-y-2">
                <p className="font-bold text-sm text-[#0b1f44]">♟️ No Ranked Matches Recorded Yet</p>
                <p>Queue for your first competitive multiplayer match to start climbing toward Grandmaster.</p>
                <button
                  type="button"
                  onClick={() => {
                    sound.playClick();
                    onPlayRankedMultiplayer();
                  }}
                  className="cm-btn cm-btn-primary mt-2"
                >
                  <Swords className="w-4 h-4" /> Play First Ranked Match (Vs Player)
                </button>
              </div>
            ) : (
              <div className="space-y-2">
                {profile.recentMatches
                  .slice()
                  .reverse()
                  .map((match) => {
                    const isWin = match.result === 'win';
                    return (
                      <div
                        key={match.id}
                        className="bg-white border border-[#b4bcc8] p-3 flex flex-wrap items-center justify-between gap-3 text-xs"
                      >
                        <div className="flex items-center gap-3">
                          {isWin ? (
                            <CheckCircle2 className="w-5 h-5 text-[#127a3a]" />
                          ) : (
                            <XCircle className="w-5 h-5 text-[#b91c1c]" />
                          )}
                          <div>
                            <div className="flex items-center gap-2">
                              <span className={`cm-badge ${isWin ? 'cm-badge-green' : 'cm-badge-red'}`}>
                                {isWin ? 'VICTORY' : 'DEFEAT'}
                              </span>
                              <strong className="text-[#0b1f44]">vs {match.opponentName}</strong>
                              <span className="text-[#566173]">({match.opponentRating} Rating)</span>
                            </div>
                            <div className="text-[11px] text-[#566173] mt-0.5">
                              {new Date(match.timestamp).toLocaleDateString()} ·{' '}
                              {new Date(match.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-3 font-mono">
                          <span>
                            {match.ratingBefore} ➔ <strong>{match.ratingAfter}</strong>
                          </span>
                          <span className={`cm-badge ${isWin ? 'cm-badge-green' : 'cm-badge-red'}`}>
                            {match.delta >= 0 ? `+${match.delta}` : match.delta}
                          </span>
                        </div>
                      </div>
                    );
                  })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* 6. VIEW: CHESS TIER CODEX */}
      {activeSubView === 'tiers' && (
        <div className="space-y-4">
          <div className="cm-panel">
            <div className="cm-panel-header">
              <span>Chess-Style Ladder Hierarchy</span>
            </div>
            <div className="cm-panel-body text-xs text-[#313a48] leading-relaxed">
              Hexatrick uses Chess Elo ratings beginning at <strong>300 Rating (Pawn tier)</strong>.
              Every match evaluates your opponent&apos;s rating relative to yours: triumphing against a higher-rated
              master awards abundant rating, while win streaks accelerate your ascent toward Super Grandmaster.
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {CHESS_RANK_TIERS.map((tier) => {
              const isUserCurrent = currentTier.id === tier.id;
              return (
                <div
                  key={tier.id}
                  className={`cm-panel ${isUserCurrent ? 'ring-2 ring-[#c8961e]' : ''}`}
                >
                  <div className="cm-panel-header">
                    <span>
                      {tier.icon} {tier.name} · {tier.title}
                    </span>
                    {isUserCurrent && <span className="cm-badge cm-badge-gold">Current Rank</span>}
                  </div>
                  <div className="cm-panel-body space-y-2 text-xs">
                    <div className="bg-white border border-[#b4bcc8] px-2.5 py-1.5 flex items-center justify-between font-mono">
                      <span className="text-[#566173] font-bold">Rating Range:</span>
                      <strong className="text-[#0b1f44]">
                        {tier.minRating} {tier.maxRating < 9999 ? `– ${tier.maxRating}` : '+'}
                      </strong>
                    </div>
                    <p className="text-[#313a48] leading-relaxed">{tier.description}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};
