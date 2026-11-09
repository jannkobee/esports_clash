// src/components/FriendsChallengeView.tsx
// Friends & Direct Challenges Hub
// Add friends by Club Tag, manage incoming/outgoing friend challenges, wager Clash Coins,
// and earn +100% Real Match Training progression for your Starting Five!

import React, { useState } from 'react';
import type { FriendChallenge, FriendClub, MacroRegion } from '../types';
import { ChibiAvatar } from './ChibiAvatar';
import { sound } from '../audio';
import { INITIAL_FRIENDS, INITIAL_FRIEND_CHALLENGES } from '../marketBatchEngine';
import {
  Users,
  UserPlus,
  Swords,
  CheckCircle2,
  Coins,
  Zap,
  Globe,
  Send,
  Shield,
  Sparkles,
  XCircle
} from 'lucide-react';

interface FriendsChallengeViewProps {
  teamFunds: number;
  onUpdateFunds: (newFunds: number) => void;
  onPlayFriendMatch: (friendClubName: string, wagerCoins: number) => void;
  onQuickSimFriendChallenge: (friendClubName: string, wagerCoins: number, isWin: boolean) => void;
}

export const FriendsChallengeView: React.FC<FriendsChallengeViewProps> = ({
  teamFunds,
  onUpdateFunds,
  onPlayFriendMatch,
  onQuickSimFriendChallenge
}) => {
  const [friends, setFriends] = useState<FriendClub[]>(INITIAL_FRIENDS);
  const [challenges, setChallenges] = useState<FriendChallenge[]>(INITIAL_FRIEND_CHALLENGES);
  const [newFriendInput, setNewFriendInput] = useState('');
  const [newFriendRegion, setNewFriendRegion] = useState<MacroRegion>('ASIA');
  const [wagerSelect, setWagerSelect] = useState<number>(500);
  const [notice, setNotice] = useState<string | null>(null);

  const handleAddFriend = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = newFriendInput.trim();
    if (!trimmed) return;
    sound.playCoin();

    const cleanName = trimmed.replace(/^#/, '');
    const newFriend: FriendClub = {
      id: `fr_${Date.now()}`,
      managerName: cleanName,
      clubName: `${cleanName} Esports`,
      clubTag: `#${newFriendRegion}-${Math.floor(1000 + Math.random() * 8999)}`,
      region: newFriendRegion,
      avatarSeed: cleanName,
      status: 'online',
      avgOvr: 8,
      divisionLabel: `${newFriendRegion} · Tier 2 Challengers (Shard #8)`,
      headToHeadWins: 0,
      headToHeadLosses: 0
    };

    setFriends((prev) => [newFriend, ...prev]);
    setNewFriendInput('');
    setNotice(
      `🤝 Friend Added: ${newFriend.managerName} (${newFriend.clubName} · ${newFriend.region}) is now on your Club Friends List!`
    );
    setTimeout(() => setNotice(null), 4500);
  };

  const handleSendChallenge = (
    friend: FriendClub,
    mode: FriendChallenge['mode'],
    wager: number
  ) => {
    sound.playClick();
    if (wager > 0 && teamFunds < wager) {
      alert(`Insufficient Club Treasury for a 🪙 ${wager} Coin wager.`);
      return;
    }

    const newChallenge: FriendChallenge = {
      id: `ch_out_${Date.now()}`,
      friendId: friend.id,
      friendName: friend.managerName,
      clubName: friend.clubName,
      region: friend.region,
      avatarSeed: friend.avatarSeed,
      avgOvr: friend.avgOvr,
      mode,
      wagerCoins: wager,
      trainingBonusLabel: '+100% Real Match Training Progress (All 5 Starters)',
      direction: 'incoming', // Ready to launch immediately
      createdAtLabel: 'Just now',
      status: 'pending'
    };

    setChallenges((prev) => [newChallenge, ...prev]);
    setNotice(
      `⚔️ Challenge Created vs ${friend.clubName} (${mode}${wager > 0 ? ` · 🪙 ${wager} Wager` : ''})! Click "Play Live 3D" or "Quick Resolve" below.`
    );
    setTimeout(() => setNotice(null), 4500);
  };

  const handleAcceptAndPlay3D = (ch: FriendChallenge) => {
    sound.playWalkoutFanfare();
    setChallenges((prev) => prev.filter((item) => item.id !== ch.id));
    onPlayFriendMatch(ch.clubName, ch.wagerCoins);
  };

  const handleQuickResolve = (ch: FriendChallenge) => {
    sound.playWalkoutFanfare();
    const isWin = Math.random() < 0.68;
    setChallenges((prev) => prev.filter((item) => item.id !== ch.id));
    setFriends((prev) =>
      prev.map((f) =>
        f.id === ch.friendId
          ? {
              ...f,
              headToHeadWins: f.headToHeadWins + (isWin ? 1 : 0),
              headToHeadLosses: f.headToHeadLosses + (isWin ? 0 : 1)
            }
          : f
      )
    );
    onQuickSimFriendChallenge(ch.clubName, ch.wagerCoins, isWin);
    if (isWin) {
      setNotice(
        `🏆 Victory vs Friend ${ch.friendName} (${ch.clubName})! ${
          ch.wagerCoins > 0 ? `Won +🪙 ${ch.wagerCoins} Wager & ` : ''
        }All 5 Starters gained Real Match Training XP!`
      );
    } else {
      setNotice(
        `⚔️ Close match vs ${ch.friendName} (${ch.clubName}). Your 5 Starters still earned full Real Match Training XP!`
      );
    }
    setTimeout(() => setNotice(null), 5500);
  };

  const handleDeclineChallenge = (id: string) => {
    sound.playClick();
    setChallenges((prev) => prev.filter((c) => c.id !== id));
  };

  return (
    <div className="space-y-4">
      {/* Header & Add Friend Bar */}
      <div className="cm-panel">
        <div className="cm-panel-header">
          <span className="flex items-center gap-2">
            <Users className="w-4 h-4 text-emerald-400" />
            <span>Club Friends &amp; Direct Challenge Hub · Cross-Region Scrims &amp; Showmatches</span>
          </span>
          <div className="flex items-center gap-2">
            <span className="cm-badge cm-badge-green">{friends.length} Friends Connected</span>
            <span className="cm-badge cm-badge-gold">Your Club Tag: #GLOBAL-777</span>
          </div>
        </div>

        <div className="cm-panel-body flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className="text-base font-black text-white">
              Challenge Friends Across ASIA, EUROPE, AFRICA &amp; AMERICAS
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Friend Challenges count as <strong className="text-emerald-400">Real Matches</strong> for your Hattrick
              Training Center — unlocking <strong className="text-emerald-400">100%–135% training speed</strong> for
              all 5 starters!
            </p>
          </div>

          <form onSubmit={handleAddFriend} className="flex flex-wrap items-center gap-2">
            <input
              type="text"
              value={newFriendInput}
              onChange={(e) => setNewFriendInput(e.target.value)}
              placeholder="Enter Friend Name or #TAG..."
              className="cm-input text-xs min-w-[200px]"
            />
            <select
              value={newFriendRegion}
              onChange={(e) => setNewFriendRegion(e.target.value as MacroRegion)}
              className="cm-select text-xs"
            >
              <option value="ASIA">ASIA</option>
              <option value="EUROPE">EUROPE</option>
              <option value="AFRICA">AFRICA</option>
              <option value="AMERICAS">AMERICAS</option>
            </select>
            <button type="submit" className="cm-btn cm-btn-primary py-1.5 px-3 text-xs">
              <UserPlus className="w-3.5 h-3.5" />
              <span>Add Friend</span>
            </button>
          </form>
        </div>
      </div>

      {notice && (
        <div className="bg-emerald-500/15 border border-emerald-500/40 rounded-xl p-3 text-xs font-bold text-emerald-300 flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />
          <span>{notice}</span>
        </div>
      )}

      {/* Pending Friend Challenges Inbox */}
      <div className="cm-panel">
        <div className="cm-panel-header">
          <span className="flex items-center gap-2">
            <Swords className="w-4 h-4 text-amber-400" />
            <span>Active Friend Challenges ({challenges.length} Pending)</span>
          </span>
          <span className="cm-badge cm-badge-green">⚡ Grants Real-Match Training XP</span>
        </div>

        <div className="cm-panel-body">
          {challenges.length === 0 ? (
            <div className="text-center py-6 text-xs text-slate-400">
              No pending challenges. Pick any friend below to send a Friendly Scrimmage or Showmatch Wager!
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {challenges.map((ch) => (
                <div
                  key={ch.id}
                  className="bg-[#0f172a] border-2 border-amber-500/40 rounded-xl p-3.5 flex flex-col justify-between gap-3"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <ChibiAvatar avatarType={ch.avatarSeed} size={48} />
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-black text-white">{ch.clubName}</span>
                          <span className="cm-badge cm-badge-blue text-[10px]">{ch.region}</span>
                        </div>
                        <div className="text-xs text-slate-300">
                          Manager: <strong>{ch.friendName}</strong> · Rating:{' '}
                          <strong className="text-amber-400">{ch.avgOvr}/10</strong>
                        </div>
                        <div className="text-[11px] text-emerald-400 font-bold mt-1 flex items-center gap-1">
                          <Zap className="w-3 h-3" />
                          <span>{ch.trainingBonusLabel}</span>
                        </div>
                      </div>
                    </div>

                    <div className="text-right">
                      <span className="cm-badge cm-badge-gold">{ch.mode}</span>
                      {ch.wagerCoins > 0 && (
                        <div className="text-xs font-mono font-bold text-amber-300 mt-1">
                          🪙 {ch.wagerCoins} Wager
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-white/10">
                    <button
                      type="button"
                      onClick={() => handleAcceptAndPlay3D(ch)}
                      className="cm-btn cm-btn-primary flex-1 py-1.5 text-xs"
                    >
                      <Swords className="w-3.5 h-3.5" />
                      <span>Accept &amp; Play 3D Match ▸</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleQuickResolve(ch)}
                      className="cm-btn flex-1 py-1.5 text-xs"
                    >
                      <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                      <span>Quick Sim (+Training XP)</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDeclineChallenge(ch.id)}
                      className="cm-btn py-1.5 px-2.5 text-xs"
                      title="Decline challenge"
                    >
                      <XCircle className="w-3.5 h-3.5 text-rose-400" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Friends Directory & Challenge Dispatch */}
      <div className="cm-panel">
        <div className="cm-panel-header">
          <span>Your Global Friends Directory (ASIA · EUROPE · AFRICA · AMERICAS)</span>
          <div className="flex items-center gap-2 text-xs">
            <span className="text-slate-400">Showmatch Wager Stake:</span>
            <select
              value={wagerSelect}
              onChange={(e) => setWagerSelect(Number(e.target.value))}
              className="cm-select text-xs py-0.5"
            >
              <option value={250}>🪙 250 Coins</option>
              <option value={500}>🪙 500 Coins</option>
              <option value={1000}>🪙 1,000 Coins</option>
            </select>
          </div>
        </div>

        <div className="cm-panel-body grid grid-cols-1 md:grid-cols-2 gap-3.5">
          {friends.map((friend) => (
            <div
              key={friend.id}
              className="bg-[#0f172a] border border-white/10 rounded-xl p-3.5 flex flex-col justify-between gap-3"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="relative shrink-0">
                    <ChibiAvatar avatarType={friend.avatarSeed} size={52} />
                    <span
                      className={`w-3 h-3 rounded-full border-2 border-[#0f172a] absolute -bottom-0.5 -right-0.5 ${
                        friend.status === 'online'
                          ? 'bg-emerald-400'
                          : friend.status === 'in_match'
                          ? 'bg-amber-400'
                          : 'bg-slate-500'
                      }`}
                    />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <strong className="text-sm font-black text-white">{friend.clubName}</strong>
                      <span className="text-[10px] font-mono text-slate-400">{friend.clubTag}</span>
                    </div>
                    <div className="text-xs text-slate-300">
                      Manager: <strong>{friend.managerName}</strong> ·{' '}
                      <span className="text-emerald-400 uppercase font-bold text-[10px]">
                        {friend.status.replace('_', ' ')}
                      </span>
                    </div>
                    <div className="text-[11px] text-slate-400 mt-0.5">{friend.divisionLabel}</div>
                  </div>
                </div>

                <div className="text-right shrink-0">
                  <span className="cm-badge cm-badge-blue">{friend.region}</span>
                  <div className="text-xs font-mono font-bold text-amber-400 mt-1">
                    {friend.avgOvr}/10 OVR
                  </div>
                  <div className="text-[10px] font-mono text-slate-400">
                    H2H: {friend.headToHeadWins}W - {friend.headToHeadLosses}L
                  </div>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-white/10">
                <button
                  type="button"
                  onClick={() => handleSendChallenge(friend, 'Friendly Scrimmage', 0)}
                  className="cm-btn flex-1 py-1.5 text-xs"
                >
                  <Send className="w-3 h-3 text-emerald-400" />
                  <span>Challenge Scrim (Free)</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleSendChallenge(friend, 'Showmatch Wager', wagerSelect)}
                  className="cm-btn cm-btn-primary flex-1 py-1.5 text-xs"
                >
                  <Coins className="w-3.5 h-3.5" />
                  <span>Wager Match (🪙 {wagerSelect})</span>
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
