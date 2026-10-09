import React, { useState } from 'react';
import type { ProTeam } from '../proTeamsDatabase';
import { PRO_TEAMS_DATABASE } from '../proTeamsDatabase';
import { 
  CHAMPION_COUNTERS, 
  CHAMPION_SYNERGIES, 
  CHAMPION_META_STATS 
} from '../avatarSynergyData';
import { CHAMPIONS } from '../mockData';
import { ChampionArtwork } from './ChampionArtwork';
import { sound } from '../audio';
import { 
  Globe, 
  Shield, 
  Swords, 
  Trophy, 
  Search, 
  Zap, 
  Sparkles, 
  Filter, 
  Flame, 
  TrendingUp, 
  ChevronRight,
  Crosshair,
  Users,
  Target
} from 'lucide-react';

interface Props {
  onChallengeTeam: (team: ProTeam) => void;
  selectedOpponentId?: string;
}

export const ProCircuitView: React.FC<Props> = ({ onChallengeTeam, selectedOpponentId }) => {
  const [activeSubTab, setActiveSubTab] = useState<'teams' | 'synergy_matrix' | 'standings'>('teams');
  const [selectedLeague, setSelectedLeague] = useState<'All' | 'LCK' | 'LPL' | 'LEC' | 'LCS' | 'Challengers'>('All');
  const [selectedThreat, setSelectedThreat] = useState<string>('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<'rank' | 'ovr' | 'winRate'>('rank');
  const [inspectTeam, setInspectTeam] = useState<ProTeam | null>(null);

  // Filter & Sort Teams
  const filteredTeams = PRO_TEAMS_DATABASE.filter(team => {
    const matchesLeague = selectedLeague === 'All' || team.league === selectedLeague;
    const matchesThreat = selectedThreat === 'All' || team.threatLevel === selectedThreat;
    const matchesQuery = !searchQuery || 
      team.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      team.tag.toLowerCase().includes(searchQuery.toLowerCase()) ||
      team.coach.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      team.starters.some(p => p.name.toLowerCase().includes(searchQuery.toLowerCase()));
    return matchesLeague && matchesThreat && matchesQuery;
  }).sort((a, b) => {
    if (sortBy === 'ovr') return b.avgOvr - a.avgOvr;
    if (sortBy === 'winRate') return b.stats.winRate - a.stats.winRate;
    return a.globalRank - b.globalRank;
  });

  const getThreatBadge = (threat: ProTeam['threatLevel']) => {
    switch (threat) {
      case 'World Champion':
        return 'bg-gradient-to-r from-amber-400 to-pink-500 text-slate-950 font-black shadow-lg shadow-amber-500/20';
      case 'Elite Contender':
        return 'bg-gradient-to-r from-cyan-400 to-blue-500 text-slate-950 font-black';
      case 'Playoff Contender':
        return 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 font-bold';
      case 'Dark Horse':
        return 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 font-bold';
      default:
        return 'bg-slate-800 text-slate-400 font-medium';
    }
  };

  const getChampById = (id: string) => CHAMPIONS.find(c => c.id === id);

  return (
    <div className="space-y-6 max-w-7xl mx-auto animate-fade-in pb-12">
      {/* HEADER BANNER */}
      <div className="bg-gradient-to-r from-indigo-950 via-slate-900 to-slate-950 border border-slate-700/80 rounded-3xl p-6 shadow-2xl flex flex-wrap justify-between items-center gap-4">
        <div>
          <div className="flex items-center gap-2 text-cyan-400 text-xs font-black uppercase tracking-[0.2em] mb-1">
            <Globe className="w-4 h-4 text-cyan-400 animate-spin-slow" /> Global Pro Circuit Telemetry
          </div>
          <h2 className="text-2xl font-black text-white flex items-center gap-3">
            <span>PRO TEAMS & SCOUTING HUB</span>
            <span className="text-xs bg-amber-400 text-slate-950 px-2.5 py-0.5 rounded-full font-black uppercase">
              125 Pro Teams Active
            </span>
          </h2>
          <p className="text-slate-400 text-xs mt-1 max-w-2xl">
            A living pro esports simulation. Inspect scouting reports, tactical coaching philosophies, player counter-picks, and avatar synergy matrices, or challenge any world pro team directly in Clash Arena!
          </p>
        </div>

        {/* Sub-Tabs */}
        <div className="flex gap-1.5 bg-slate-950/80 p-1.5 rounded-2xl border border-white/10">
          <button
            onClick={() => { sound.playClick(); setActiveSubTab('teams'); }}
            className={`px-4 py-2 rounded-xl text-xs font-black transition flex items-center gap-1.5 ${
              activeSubTab === 'teams'
                ? 'bg-gradient-to-r from-cyan-400 to-blue-500 text-slate-950 shadow-lg'
                : 'text-slate-400 hover:text-white hover:bg-slate-900'
            }`}
          >
            <Users className="w-3.5 h-3.5" /> World Pro Teams ({PRO_TEAMS_DATABASE.length})
          </button>
          <button
            onClick={() => { sound.playClick(); setActiveSubTab('synergy_matrix'); }}
            className={`px-4 py-2 rounded-xl text-xs font-black transition flex items-center gap-1.5 ${
              activeSubTab === 'synergy_matrix'
                ? 'bg-gradient-to-r from-amber-400 to-yellow-500 text-slate-950 shadow-lg'
                : 'text-slate-400 hover:text-white hover:bg-slate-900'
            }`}
          >
            <Zap className="w-3.5 h-3.5" /> Counter & Synergy Matrix
          </button>
          <button
            onClick={() => { sound.playClick(); setActiveSubTab('standings'); }}
            className={`px-4 py-2 rounded-xl text-xs font-black transition flex items-center gap-1.5 ${
              activeSubTab === 'standings'
                ? 'bg-gradient-to-r from-purple-400 to-pink-500 text-slate-950 shadow-lg'
                : 'text-slate-400 hover:text-white hover:bg-slate-900'
            }`}
          >
            <Trophy className="w-3.5 h-3.5" /> Circuit Standings
          </button>
        </div>
      </div>

      {/* SUB-TAB 1: WORLD PRO TEAMS DIRECTORY */}
      {activeSubTab === 'teams' && (
        <div className="space-y-6">
          {/* SEARCH & FILTERS BAR */}
          <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-4 flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-2 flex-1 min-w-[240px] max-w-md relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="Search team, tag, coach, or player name..."
                className="w-full bg-slate-950 border border-slate-700 rounded-xl pl-9 pr-4 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-400"
              />
            </div>

            {/* League Filters */}
            <div className="flex items-center gap-1.5 flex-wrap">
              {(['All', 'LCK', 'LPL', 'LEC', 'LCS', 'Challengers'] as const).map(league => (
                <button
                  key={league}
                  onClick={() => { sound.playClick(); setSelectedLeague(league); }}
                  className={`px-3 py-1.5 rounded-lg text-xs font-black transition ${
                    selectedLeague === league
                      ? 'bg-cyan-400 text-slate-950 shadow'
                      : 'bg-slate-950 text-slate-400 hover:text-white border border-white/5'
                  }`}
                >
                  {league}
                </button>
              ))}
            </div>

            {/* Sort Dropdown */}
            <div className="flex items-center gap-2 text-xs font-bold text-slate-400">
              <span>Sort:</span>
              <select
                value={sortBy}
                onChange={e => setSortBy(e.target.value as any)}
                className="bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-cyan-400"
              >
                <option value="rank">Global Rank</option>
                <option value="ovr">Team OVR</option>
                <option value="winRate">Win Rate %</option>
              </select>
            </div>
          </div>

          {/* TEAMS GRID */}
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
            {filteredTeams.map(team => {
              const isSelected = selectedOpponentId === team.id;
              return (
                <div
                  key={team.id}
                  className={`bg-gradient-to-b from-slate-900 via-slate-900 to-slate-950 rounded-2xl border transition-all duration-300 p-5 flex flex-col justify-between shadow-xl relative overflow-hidden group hover:-translate-y-1 ${
                    isSelected ? 'border-amber-400 ring-2 ring-amber-400/50' : 'border-slate-800 hover:border-slate-600'
                  }`}
                >
                  {/* Top Bar: Rank + Name + Tag + Threat */}
                  <div>
                    <div className="flex items-start justify-between gap-2 mb-3">
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-xl bg-slate-950 border border-white/10 flex items-center justify-center font-black text-xs text-white shadow">
                          #{team.globalRank}
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <h3 className="text-base font-black text-white group-hover:text-cyan-300 transition">
                              {team.name}
                            </h3>
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-black/60 border border-white/10 text-slate-300 font-bold">
                              {team.tag}
                            </span>
                          </div>
                          <div className="text-[11px] text-slate-400 font-semibold flex items-center gap-2">
                            <span>{team.league} Conference</span>
                            <span>·</span>
                            <span className="text-amber-300 font-bold">{team.stats.wins}W - {team.stats.losses}L ({team.stats.winRate}%)</span>
                          </div>
                        </div>
                      </div>

                      <div className="text-right">
                        <div className="text-lg font-black text-amber-300 tabular-nums">
                          {team.avgOvr} <span className="text-[10px] text-slate-400 font-bold">OVR</span>
                        </div>
                        <span className={`text-[9px] px-2 py-0.5 rounded-full uppercase tracking-wider ${getThreatBadge(team.threatLevel)}`}>
                          {team.threatLevel}
                        </span>
                      </div>
                    </div>

                    {/* Coach Strip */}
                    <div className="bg-black/40 rounded-xl p-2.5 border border-white/5 mb-3 flex items-center justify-between text-xs">
                      <div className="flex items-center gap-2">
                        <Shield className="w-4 h-4 text-cyan-400" />
                        <div>
                          <div className="text-[11px] font-bold text-white">{team.coach.name}</div>
                          <div className="text-[9px] text-cyan-300 font-medium">Style: {team.coach.style}</div>
                        </div>
                      </div>
                      <div className="text-right text-[10px] text-slate-400">
                        Playbook: <strong className="text-amber-300">+{team.coach.playbookBonus}</strong>
                      </div>
                    </div>

                    {/* 5-Man Active Starting Lineup */}
                    <div className="space-y-1.5 mb-4">
                      <div className="text-[10px] font-black uppercase tracking-wider text-slate-400 flex items-center justify-between">
                        <span>Active Starting Lineup</span>
                        <span>Positions</span>
                      </div>
                      <div className="grid grid-cols-5 gap-1">
                        {team.starters.map((player, idx) => {
                          const slotLabel = ['TOP', 'JGL', 'MID', 'ADC', 'SUP'][idx];
                          return (
                            <div 
                              key={player.id} 
                              className="bg-slate-950/90 rounded-lg p-1.5 border border-white/5 text-center flex flex-col justify-between"
                            >
                              <span className="text-[8px] font-black text-slate-400 tracking-wider mb-0.5">{slotLabel}</span>
                              <div className="text-[10px] font-extrabold text-white truncate px-0.5" title={player.name}>
                                {player.name}
                              </div>
                              <div className="text-[9px] font-black text-amber-300 mt-0.5">
                                {player.ovr}
                              </div>
                              <div className="text-[8px] text-slate-400 truncate mt-0.5">
                                {player.signatureChampions[0] || 'Flex'}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    {/* Playstyle Tag */}
                    <p className="text-[11px] text-slate-400 italic mb-4 line-clamp-1">
                      "{team.playstyle}"
                    </p>
                  </div>

                  {/* Actions Bar */}
                  <div className="flex items-center gap-2 pt-2 border-t border-white/5">
                    <button
                      onClick={() => setInspectTeam(team)}
                      className="flex-1 bg-slate-800 hover:bg-slate-700 text-white rounded-xl py-2 text-xs font-bold transition text-center"
                    >
                      Scout Roster
                    </button>
                    <button
                      onClick={() => {
                        sound.playClick();
                        onChallengeTeam(team);
                      }}
                      className="flex-1 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-slate-950 font-black rounded-xl py-2 text-xs transition shadow-lg flex items-center justify-center gap-1.5"
                    >
                      <Swords className="w-3.5 h-3.5" /> Challenge in Arena
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* SUB-TAB 2: COUNTER & SYNERGY MATRIX */}
      {activeSubTab === 'synergy_matrix' && (
        <div className="space-y-6">
          {/* Section: S+ & S Tier Teamfight Synergies */}
          <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-6 shadow-2xl">
            <div className="flex items-center gap-2 text-amber-300 text-xs font-black uppercase tracking-wider mb-1">
              <Sparkles className="w-4 h-4 text-amber-400" /> High-Impact Teamfight Combos
            </div>
            <h3 className="text-xl font-black text-white mb-4">
              CHAMPION SYNERGY MATRIX (AI COMBO KNOWLEDGE)
            </h3>
            <p className="text-slate-400 text-xs mb-6 max-w-3xl">
              When drafting, AI coaches actively evaluate these exact synergy combinations. Pairing complementary champions unlocks dramatic combat multiplier buffs during 5v5 teamfights.
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {CHAMPION_SYNERGIES.map((syn, idx) => {
                const champ1 = getChampById(syn.champ1Id);
                const champ2 = getChampById(syn.champ2Id);
                return (
                  <div key={idx} className="bg-slate-950/80 border border-white/10 rounded-2xl p-4 flex gap-4 items-center shadow-lg hover:border-amber-400/40 transition">
                    <div className="flex items-center -space-x-3 shrink-0">
                      <div className="w-14 h-14 rounded-2xl bg-slate-900 border-2 border-amber-400 overflow-hidden shadow-md">
                        {champ1 && <ChampionArtwork championId={champ1.id} size={56} />}
                      </div>
                      <div className="w-14 h-14 rounded-2xl bg-slate-900 border-2 border-cyan-400 overflow-hidden shadow-md">
                        {champ2 && <ChampionArtwork championId={champ2.id} size={56} />}
                      </div>
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2 mb-1">
                        <h4 className="text-sm font-black text-white truncate">{syn.comboName}</h4>
                        <span className="text-[10px] font-black px-2 py-0.5 rounded bg-amber-400 text-slate-950 shadow">
                          {syn.tier} Tier (+{syn.bonus} Synergy)
                        </span>
                      </div>
                      <div className="text-[11px] font-bold text-amber-300 mb-1">
                        {champ1?.name} & {champ2?.name}
                      </div>
                      <p className="text-[11px] text-slate-300 leading-relaxed">
                        {syn.description}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Section: Counter Matchups Table */}
          <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-6 shadow-2xl">
            <div className="flex items-center gap-2 text-rose-400 text-xs font-black uppercase tracking-wider mb-1">
              <Crosshair className="w-4 h-4 text-rose-400" /> Matchup Win Rate Telemetry
            </div>
            <h3 className="text-xl font-black text-white mb-4">
              HARD COUNTER DATA MATRIX (AI DRAFT KNOWLEDGE)
            </h3>
            <p className="text-slate-400 text-xs mb-6 max-w-3xl">
              AI coaches use this counter matrix to identify vulnerability in your picks. Counter-picks grant +15 advantage in simulations and apply severe lane pressure.
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {CHAMPION_COUNTERS.map((cnt, idx) => {
                const champ = getChampById(cnt.championId);
                const victim = getChampById(cnt.countersId);
                return (
                  <div key={idx} className="bg-slate-950/80 border border-white/10 rounded-2xl p-4 flex gap-4 items-center shadow-lg hover:border-rose-500/40 transition">
                    <div className="w-14 h-14 rounded-2xl bg-slate-900 border-2 border-rose-500 overflow-hidden shrink-0 shadow-md">
                      {champ && <ChampionArtwork championId={champ.id} size={56} />}
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2 mb-1">
                        <div className="text-xs font-black text-white">
                          <span className="text-rose-400 font-extrabold">{champ?.name}</span> counters <span className="text-slate-300 font-extrabold">{victim?.name}</span>
                        </div>
                        <span className="text-[10px] font-black px-2 py-0.5 rounded bg-rose-500 text-white shadow">
                          +{cnt.advantage}% Win Delta
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-300 leading-relaxed">
                        {cnt.reason}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Section: Champion Meta Telemetry */}
          <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-6 shadow-2xl">
            <div className="flex items-center gap-2 text-cyan-400 text-xs font-black uppercase tracking-wider mb-1">
              <TrendingUp className="w-4 h-4 text-cyan-400" /> Meta Statistics & Win Rates
            </div>
            <h3 className="text-xl font-black text-white mb-4">
              SIMULATION TIER LIST & META RATINGS
            </h3>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-800 text-slate-400 font-bold uppercase tracking-wider">
                    <th className="py-3 px-4">Champion</th>
                    <th className="py-3 px-4">Meta Tier</th>
                    <th className="py-3 px-4">Win Rate</th>
                    <th className="py-3 px-4">Pick Rate</th>
                    <th className="py-3 px-4">Ban Rate</th>
                    <th className="py-3 px-4">Best Duo Partner</th>
                    <th className="py-3 px-4">Worst Counter</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 font-medium">
                  {CHAMPIONS.slice(0, 16).map(c => {
                    const meta = CHAMPION_META_STATS[c.id];
                    const partner = meta?.bestPartnerId ? getChampById(meta.bestPartnerId) : null;
                    const counter = meta?.worstMatchupId ? getChampById(meta.worstMatchupId) : null;
                    return (
                      <tr key={c.id} className="hover:bg-slate-800/40 transition">
                        <td className="py-3 px-4 flex items-center gap-2.5">
                          <div className="w-8 h-8 rounded-lg overflow-hidden bg-slate-950 border border-white/10 shrink-0">
                            <ChampionArtwork championId={c.id} size={32} />
                          </div>
                          <div>
                            <div className="font-extrabold text-white">{c.name}</div>
                            <div className="text-[10px] text-slate-400">{c.primaryRole}</div>
                          </div>
                        </td>
                        <td className="py-3 px-4">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-black ${
                            meta?.tier === 'S+' ? 'bg-amber-400 text-slate-950' :
                            meta?.tier === 'S' ? 'bg-cyan-400 text-slate-950' : 'bg-slate-800 text-slate-300'
                          }`}>
                            {meta?.tier || 'A'}
                          </span>
                        </td>
                        <td className="py-3 px-4 font-bold text-amber-300">{meta?.winRate || 50.0}%</td>
                        <td className="py-3 px-4 text-slate-300">{meta?.pickRate || 25.0}%</td>
                        <td className="py-3 px-4 text-rose-300">{meta?.banRate || 15.0}%</td>
                        <td className="py-3 px-4 text-emerald-300 font-bold">{partner?.name || 'Flexible'}</td>
                        <td className="py-3 px-4 text-rose-400 font-bold">{counter?.name || 'Even'}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* SUB-TAB 3: LIVING CIRCUIT STANDINGS */}
      {activeSubTab === 'standings' && (
        <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-6 shadow-2xl">
          <div className="flex items-center justify-between gap-4 mb-6">
            <div>
              <div className="flex items-center gap-2 text-purple-400 text-xs font-black uppercase tracking-wider mb-1">
                <Trophy className="w-4 h-4 text-purple-400" /> Living Pro Esports Circuit
              </div>
              <h3 className="text-xl font-black text-white">GLOBAL CIRCUIT STANDINGS</h3>
            </div>
            <div className="text-xs text-slate-400 font-bold">
              Showing top global contenders across all leagues
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-800 text-slate-400 font-bold uppercase tracking-wider">
                  <th className="py-3 px-4">Rank</th>
                  <th className="py-3 px-4">Team</th>
                  <th className="py-3 px-4">League</th>
                  <th className="py-3 px-4">Team OVR</th>
                  <th className="py-3 px-4">Record</th>
                  <th className="py-3 px-4">Win Rate</th>
                  <th className="py-3 px-4">Points</th>
                  <th className="py-3 px-4">Form</th>
                  <th className="py-3 px-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 font-medium">
                {PRO_TEAMS_DATABASE.slice(0, 30).map(t => (
                  <tr key={t.id} className="hover:bg-slate-800/40 transition">
                    <td className="py-3 px-4 font-black text-amber-300">#{t.globalRank}</td>
                    <td className="py-3 px-4">
                      <div className="font-extrabold text-white">{t.name}</div>
                      <div className="text-[10px] text-slate-400">Coach: {t.coach.name}</div>
                    </td>
                    <td className="py-3 px-4">
                      <span className="px-2 py-0.5 rounded bg-slate-950 border border-white/10 text-cyan-300 font-bold text-[10px]">
                        {t.league}
                      </span>
                    </td>
                    <td className="py-3 px-4 font-black text-white">{t.avgOvr} OVR</td>
                    <td className="py-3 px-4 font-bold text-slate-200">{t.stats.wins} - {t.stats.losses}</td>
                    <td className="py-3 px-4 font-bold text-amber-300">{t.stats.winRate}%</td>
                    <td className="py-3 px-4 font-black text-white">{t.stats.points} pts</td>
                    <td className="py-3 px-4">
                      <div className="flex gap-1">
                        {t.stats.form.map((res, i) => (
                          <span key={i} className={`w-4 h-4 rounded text-[9px] font-black flex items-center justify-center ${
                            res === 'W' ? 'bg-emerald-500 text-slate-950' : 'bg-rose-500 text-white'
                          }`}>
                            {res}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td className="py-3 px-4 text-right">
                      <button
                        onClick={() => { sound.playClick(); onChallengeTeam(t); }}
                        className="bg-cyan-500 hover:bg-cyan-400 text-slate-950 px-3 py-1.5 rounded-lg font-black text-xs transition"
                      >
                        Challenge
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* SCOUT TEAM INSPECTION MODAL */}
      {inspectTeam && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-fade-in">
          <div className="bg-slate-900 border border-slate-700 rounded-3xl p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto shadow-2xl relative">
            <button
              onClick={() => setInspectTeam(null)}
              className="absolute top-4 right-4 text-slate-400 hover:text-white text-xl font-bold"
            >
              ✕
            </button>

            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 rounded-2xl bg-slate-950 border border-amber-400/40 flex items-center justify-center text-xl font-black text-amber-300 shadow">
                #{inspectTeam.globalRank}
              </div>
              <div>
                <h3 className="text-xl font-black text-white">{inspectTeam.name} ({inspectTeam.tag})</h3>
                <p className="text-xs text-slate-400">{inspectTeam.league} League · {inspectTeam.avgOvr} Team OVR · {inspectTeam.stats.wins}W - {inspectTeam.stats.losses}L</p>
              </div>
            </div>

            <div className="bg-black/40 p-4 rounded-2xl border border-white/5 mb-4">
              <h4 className="text-xs font-black uppercase text-cyan-400 tracking-wider mb-2">Coach Strategy & Tactic</h4>
              <div className="text-sm font-bold text-white mb-1">{inspectTeam.coach.name} ({inspectTeam.coach.style})</div>
              <p className="text-xs text-slate-300 italic mb-2">"{inspectTeam.coach.quote}"</p>
              <div className="text-xs text-slate-400 flex gap-4">
                <span>Playbook Bonus: <strong className="text-amber-300">+{inspectTeam.coach.playbookBonus}</strong></span>
                <span>Chemistry Bonus: <strong className="text-cyan-300">+{inspectTeam.coach.chemistryBonus}</strong></span>
              </div>
            </div>

            <h4 className="text-xs font-black uppercase text-amber-300 tracking-wider mb-3">5-Man Starting Lineup</h4>
            <div className="space-y-2 mb-6">
              {inspectTeam.starters.map((p, i) => (
                <div key={p.id} className="bg-slate-950 p-3 rounded-xl border border-white/5 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className="text-xs font-black text-slate-400 w-8">{['TOP', 'JGL', 'MID', 'ADC', 'SUP'][i]}</span>
                    <div>
                      <div className="text-xs font-extrabold text-white">{p.name}</div>
                      <div className="text-[10px] text-slate-400">Signature: {p.signatureChampions.join(', ')}</div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-sm font-black text-amber-300">{p.ovr} OVR</div>
                    <div className="text-[10px] text-slate-400">{p.tier} Tier</div>
                  </div>
                </div>
              ))}
            </div>

            <button
              onClick={() => {
                const team = inspectTeam;
                setInspectTeam(null);
                onChallengeTeam(team);
              }}
              className="w-full bg-gradient-to-r from-cyan-400 to-blue-500 text-slate-950 font-black py-3 rounded-xl shadow-lg hover:brightness-110 transition flex items-center justify-center gap-2"
            >
              <Swords className="w-4 h-4" /> Challenge {inspectTeam.name} in Clash Arena
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
