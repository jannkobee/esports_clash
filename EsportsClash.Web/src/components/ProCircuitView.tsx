import React, { useState } from 'react';
import type { ProTeam } from '../proTeamsDatabase';
import { PRO_TEAMS_DATABASE } from '../proTeamsDatabase';
import { CHAMPION_COUNTERS, CHAMPION_SYNERGIES, CHAMPION_META_STATS } from '../avatarSynergyData';
import { CHAMPIONS } from '../mockData';
import { avatarDisplayName } from '../avatarDisplayName';
import { ChampionArtwork } from './ChampionArtwork';
import { sound } from '../audio';
import { mapToMacroRegion, toScale10 } from '../marketBatchEngine';
import type { MacroRegion } from '../types';
import { Globe, Shield, Swords, Trophy, Search, Zap, Sparkles, Crosshair, Users } from 'lucide-react';

interface Props {
  onChallengeTeam: (team: ProTeam) => void;
  selectedOpponentId?: string;
}

export const ProCircuitView: React.FC<Props> = ({ onChallengeTeam, selectedOpponentId }) => {
  const [activeSubTab, setActiveSubTab] = useState<'teams' | 'synergy_matrix' | 'standings'>('teams');
  const [selectedLeague, setSelectedLeague] = useState<'All' | MacroRegion>('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<'rank' | 'ovr' | 'winRate'>('rank');
  const [inspectTeam, setInspectTeam] = useState<ProTeam | null>(null);

  const filteredTeams = PRO_TEAMS_DATABASE.filter((team) => {
    const teamMacro = mapToMacroRegion(team.league);
    const matchesLeague = selectedLeague === 'All' || teamMacro === selectedLeague;
    const matchesQuery =
      !searchQuery ||
      team.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      team.tag.toLowerCase().includes(searchQuery.toLowerCase()) ||
      team.coach.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      team.starters.some((p) => p.name.toLowerCase().includes(searchQuery.toLowerCase()));
    return matchesLeague && matchesQuery;
  }).sort((a, b) => {
    if (sortBy === 'ovr') return b.avgOvr - a.avgOvr;
    if (sortBy === 'winRate') return b.stats.winRate - a.stats.winRate;
    return a.globalRank - b.globalRank;
  });

  const getChampById = (id: string) => CHAMPIONS.find((c) => c.id === id);

  return (
    <div className="space-y-4">
      {/* Sub-Tabs */}
      <div className="cm-tabs">
        <button
          type="button"
          onClick={() => {
            sound.playClick();
            setActiveSubTab('teams');
          }}
          className={`cm-tab ${activeSubTab === 'teams' ? 'active' : ''}`}
        >
          <Users className="w-3.5 h-3.5 inline mr-1.5" /> World Pro Teams ({PRO_TEAMS_DATABASE.length})
        </button>
        <button
          type="button"
          onClick={() => {
            sound.playClick();
            setActiveSubTab('synergy_matrix');
          }}
          className={`cm-tab ${activeSubTab === 'synergy_matrix' ? 'active' : ''}`}
        >
          <Zap className="w-3.5 h-3.5 inline mr-1.5" /> Counter &amp; Synergy Matrix
        </button>
        <button
          type="button"
          onClick={() => {
            sound.playClick();
            setActiveSubTab('standings');
          }}
          className={`cm-tab ${activeSubTab === 'standings' ? 'active' : ''}`}
        >
          <Trophy className="w-3.5 h-3.5 inline mr-1.5" /> Global Circuit Standings
        </button>
      </div>

      {/* SUB-TAB 1: WORLD PRO TEAMS DIRECTORY */}
      {activeSubTab === 'teams' && (
        <div className="space-y-4">
          {/* Search & Filters Panel */}
          <div className="cm-panel">
            <div className="cm-panel-body flex flex-wrap items-center justify-between gap-3">
              <div className="relative flex-1 min-w-[220px] max-w-md">
                <Search className="w-3.5 h-3.5 text-[#566173] absolute left-2.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search team, tag, coach, or player name..."
                  className="cm-input w-full pl-8"
                />
              </div>

              <div className="flex items-center gap-1.5 flex-wrap">
                {(['All', 'ASIA', 'EUROPE', 'AFRICA', 'AMERICAS'] as const).map((league) => (
                  <button
                    type="button"
                    key={league}
                    onClick={() => {
                      sound.playClick();
                      setSelectedLeague(league);
                    }}
                    className={`cm-btn py-1 px-2.5 text-xs ${selectedLeague === league ? 'cm-btn-primary' : ''}`}
                  >
                    {league}
                  </button>
                ))}
              </div>

              <div className="flex items-center gap-2 text-xs font-bold text-[#313a48]">
                <span>Sort:</span>
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as 'rank' | 'ovr' | 'winRate')}
                  className="cm-select"
                >
                  <option value="rank">Global Rank</option>
                  <option value="ovr">Team Rating (1–10)</option>
                  <option value="winRate">Win Rate %</option>
                </select>
              </div>
            </div>
          </div>

          {/* Teams Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {filteredTeams.map((team) => {
              const isSelected = selectedOpponentId === team.id;
              const teamRegion = mapToMacroRegion(team.league);
              return (
                <div
                  key={team.id}
                  className={`cm-panel flex flex-col justify-between ${
                    isSelected ? 'ring-2 ring-[#c8961e]' : ''
                  }`}
                >
                  <div className="cm-panel-header">
                    <span>
                      #{team.globalRank} · {team.name} [{team.tag}]
                    </span>
                    <span className="cm-badge cm-badge-gold">{toScale10(team.avgOvr)}/10 Rating</span>
                  </div>

                  <div className="cm-panel-body flex-1 flex flex-col justify-between space-y-3">
                    <div>
                      <div className="flex items-center justify-between text-xs mb-2">
                        <span className="font-bold text-[#0b1f44]">{teamRegion} Regional Circuit</span>
                        <span className="font-mono font-bold text-[#127a3a]">
                          {team.stats.wins}W - {team.stats.losses}L ({team.stats.winRate}%)
                        </span>
                      </div>

                      {/* Coach Strip */}
                      <div className="bg-white border border-[#b4bcc8] p-2 mb-2.5 flex items-center justify-between text-xs">
                        <div className="flex items-center gap-1.5">
                          <Shield className="w-3.5 h-3.5 text-[#143570]" />
                          <div>
                            <div className="font-bold text-[#0b1f44]">{team.coach.name}</div>
                            <div className="text-[11px] text-[#566173]">Style: {team.coach.style}</div>
                          </div>
                        </div>
                        <span className="cm-badge cm-badge-blue">+{team.coach.playbookBonus} Playbook</span>
                      </div>

                      {/* 5-Man Active Starting Lineup */}
                      <div className="grid grid-cols-5 gap-1">
                        {team.starters.map((player) => {
                          const slotLabel = player.preferredRole || player.role || 'Fighter';
                          return (
                            <div
                              key={player.id}
                              className="bg-white border border-[#b4bcc8] p-1 text-center flex flex-col justify-between"
                            >
                              <span className="text-[9px] font-bold text-[#566173]">{slotLabel}</span>
                              <div className="text-[11px] font-bold text-[#0b1f44] truncate" title={player.name}>
                                {player.name}
                              </div>
                              <div className="text-[10px] font-mono font-black text-[#b88406]">{toScale10(player.ovr)}/10</div>
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    <div className="flex items-center gap-2 pt-2 border-t border-[#c4cbd6]">
                      <button
                        type="button"
                        onClick={() => setInspectTeam(team)}
                        className="cm-btn flex-1 text-xs"
                      >
                        Scout Dossier
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          sound.playClick();
                          onChallengeTeam(team);
                        }}
                        className="cm-btn cm-btn-primary flex-1 text-xs"
                      >
                        <Swords className="w-3.5 h-3.5" /> Challenge ▸
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* SUB-TAB 2: COUNTER & SYNERGY MATRIX */}
      {activeSubTab === 'synergy_matrix' && (
        <div className="space-y-4">
          <div className="cm-panel">
            <div className="cm-panel-header">
              <span className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-[#f2c14e]" />
                <span>Avatar Synergy Matrix (AI Combo Knowledge)</span>
              </span>
            </div>
            <div className="cm-panel-body space-y-3">
              <p className="text-xs text-[#313a48]">
                When drafting, AI coaches evaluate these synergy pairs. Pairing complementary avatars unlocks combat multiplier bonuses during 5v5 teamfights.
              </p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {CHAMPION_SYNERGIES.map((syn, idx) => {
                  const champ1 = getChampById(syn.champ1Id);
                  const champ2 = getChampById(syn.champ2Id);
                  return (
                    <div
                      key={idx}
                      className="bg-white border border-[#b4bcc8] p-3 flex gap-3 items-center"
                    >
                      <div className="flex items-center gap-1 shrink-0">
                        <div className="w-11 h-11 bg-[#0b1f44] border border-[#0b1f44] overflow-hidden">
                          {champ1 && <ChampionArtwork championId={champ1.id} size={44} />}
                        </div>
                        <div className="w-11 h-11 bg-[#0b1f44] border border-[#0b1f44] overflow-hidden">
                          {champ2 && <ChampionArtwork championId={champ2.id} size={44} />}
                        </div>
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2">
                          <h4 className="text-xs font-black text-[#0b1f44] truncate">{syn.comboName}</h4>
                          <span className="cm-badge cm-badge-gold">
                            {syn.tier} (+{syn.bonus})
                          </span>
                        </div>
                        <div className="text-[11px] font-bold text-[#143570]">
                          {champ1?.name} + {champ2?.name}
                        </div>
                        <p className="text-[11px] text-[#313a48] mt-0.5">{syn.description}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          <div className="cm-panel">
            <div className="cm-panel-header">
              <span className="flex items-center gap-2">
                <Crosshair className="w-4 h-4 text-[#f2c14e]" />
                <span>Hard Counter Data Matrix (AI Draft Knowledge)</span>
              </span>
            </div>
            <div className="cm-panel-body grid grid-cols-1 md:grid-cols-2 gap-3">
              {CHAMPION_COUNTERS.map((cnt, idx) => {
                const champ = getChampById(cnt.championId);
                const victim = getChampById(cnt.countersId);
                return (
                  <div key={idx} className="bg-white border border-[#b4bcc8] p-3 flex gap-3 items-center">
                    <div className="w-11 h-11 bg-[#0b1f44] border border-[#0b1f44] overflow-hidden shrink-0">
                      {champ && <ChampionArtwork championId={champ.id} size={44} />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <div className="text-xs font-black text-[#0b1f44]">
                          {champ?.name} counters {victim?.name}
                        </div>
                        <span className="cm-badge cm-badge-red">+{cnt.advantage}% Win Delta</span>
                      </div>
                      <p className="text-[11px] text-[#313a48] mt-0.5">{cnt.reason}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="cm-panel">
            <div className="cm-panel-header">
              <span>Simulation Tier List &amp; Meta Telemetry</span>
            </div>
            <div className="cm-panel-body p-0">
              <div className="cm-table-wrap border-0">
                <table className="cm-table">
                  <thead>
                    <tr>
                      <th>Avatar</th>
                      <th>Role</th>
                      <th>Meta Tier</th>
                      <th>Win Rate</th>
                      <th>Pick Rate</th>
                      <th>Ban Rate</th>
                      <th>Best Duo Partner</th>
                      <th>Worst Counter</th>
                    </tr>
                  </thead>
                  <tbody>
                    {CHAMPIONS.slice(0, 16).map((c) => {
                      const meta = CHAMPION_META_STATS[c.id];
                      const partner = meta?.bestPartnerId ? getChampById(meta.bestPartnerId) : null;
                      const counter = meta?.worstMatchupId ? getChampById(meta.worstMatchupId) : null;
                      return (
                        <tr key={c.id}>
                          <td className="font-bold text-[#0b1f44]">{c.displayName}</td>
                          <td>{c.primaryRole}</td>
                          <td>
                            <span
                              className={`cm-badge ${
                                meta?.tier === 'S+' || meta?.tier === 'S' ? 'cm-badge-gold' : 'cm-badge-blue'
                              }`}
                            >
                              {meta?.tier || 'A'}
                            </span>
                          </td>
                          <td className="font-mono font-bold text-[#127a3a]">{meta?.winRate || 50.0}%</td>
                          <td className="font-mono">{meta?.pickRate || 25.0}%</td>
                          <td className="font-mono text-[#b91c1c]">{meta?.banRate || 15.0}%</td>
                          <td className="font-bold text-[#143570]">{partner?.name || 'Flexible'}</td>
                          <td className="font-bold text-[#b91c1c]">{counter?.name || 'Even'}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* SUB-TAB 3: LIVING CIRCUIT STANDINGS */}
      {activeSubTab === 'standings' && (
        <div className="cm-panel">
          <div className="cm-panel-header">
            <span className="flex items-center gap-2">
              <Globe className="w-4 h-4 text-[#f2c14e]" />
              <span>Global Circuit Standings (Top 30 Contenders)</span>
            </span>
          </div>
          <div className="cm-panel-body p-0">
            <div className="cm-table-wrap border-0">
              <table className="cm-table">
                <thead>
                  <tr>
                    <th>Rank</th>
                    <th>Club</th>
                    <th>Coach</th>
                    <th>League</th>
                    <th>OVR</th>
                    <th>Record</th>
                    <th>Win %</th>
                    <th>Pts</th>
                    <th>Form</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {PRO_TEAMS_DATABASE.slice(0, 30).map((t) => (
                    <tr key={t.id}>
                      <td className="font-mono font-black text-[#0b1f44]">#{t.globalRank}</td>
                      <td className="font-bold text-[#0b1f44]">{t.name}</td>
                      <td>{t.coach.name}</td>
                      <td>
                        <span className="cm-badge cm-badge-blue">{mapToMacroRegion(t.league)}</span>
                      </td>
                      <td className="font-mono font-black">{toScale10(t.avgOvr)}/10</td>
                      <td className="font-mono">
                        {t.stats.wins}W - {t.stats.losses}L
                      </td>
                      <td className="font-mono font-bold text-[#127a3a]">{t.stats.winRate}%</td>
                      <td className="font-mono font-black text-[#0b1f44]">{t.stats.points}</td>
                      <td>
                        <div className="inline-flex gap-0.5">
                          {t.stats.form.map((res, i) => (
                            <span
                              key={i}
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
                        <button
                          type="button"
                          onClick={() => {
                            sound.playClick();
                            onChallengeTeam(t);
                          }}
                          className="cm-btn cm-btn-primary py-0.5 px-2.5 text-[11px]"
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
        </div>
      )}

      {/* SCOUT TEAM INSPECTION MODAL */}
      {inspectTeam && (
        <div
          className="cm-modal-backdrop"
          onClick={(e) => {
            if (e.target === e.currentTarget) setInspectTeam(null);
          }}
        >
          <div className="cm-modal max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="cm-panel-header">
              <span>
                Pro Scouting Dossier · #{inspectTeam.globalRank} {inspectTeam.name} ({inspectTeam.tag})
              </span>
              <button
                type="button"
                onClick={() => setInspectTeam(null)}
                className="cm-btn py-0.5 px-2 text-xs"
              >
                ✕ Close
              </button>
            </div>

            <div className="cm-panel-body space-y-4">
              <div className="bg-white border border-[#b4bcc8] p-3">
                <div className="text-xs font-black uppercase text-[#0b1f44] mb-1">
                  Coach Philosophy &amp; Tactical Setup
                </div>
                <div className="text-sm font-bold text-[#0b1f44]">
                  {inspectTeam.coach.name} ({inspectTeam.coach.style})
                </div>
                <p className="text-xs text-[#313a48] italic mt-0.5">&ldquo;{inspectTeam.coach.quote}&rdquo;</p>
                <div className="text-xs text-[#566173] flex gap-4 mt-2 pt-2 border-t border-[#d0d6e0]">
                  <span>
                    Playbook Bonus: <strong className="text-[#0b1f44]">+{inspectTeam.coach.playbookBonus}</strong>
                  </span>
                  <span>
                    Chemistry Bonus: <strong className="text-[#0b1f44]">+{inspectTeam.coach.chemistryBonus}</strong>
                  </span>
                </div>
              </div>

              <div className="cm-table-wrap">
                <table className="cm-table">
                  <thead>
                    <tr>
                      <th>Role Position</th>
                      <th>Player</th>
                      <th>Tier</th>
                      <th>Signature Avatars</th>
                      <th>Rating</th>
                    </tr>
                  </thead>
                  <tbody>
                    {inspectTeam.starters.map((p) => (
                      <tr key={p.id}>
                        <td className="font-bold text-[#0b1f44]">{p.preferredRole || p.role || 'Fighter'}</td>
                        <td className="font-bold text-[#0b1f44]">{p.name}</td>
                        <td>
                          <span className="cm-badge cm-badge-gold">{p.tier}</span>
                        </td>
                        <td className="text-xs text-[#313a48]">
                          {p.signatureChampions.map((name) => avatarDisplayName(name, CHAMPIONS)).join(', ')}
                        </td>
                        <td className="font-mono font-black text-[#0b1f44]">{toScale10(p.ovr)}/10</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <button
                type="button"
                onClick={() => {
                  const team = inspectTeam;
                  setInspectTeam(null);
                  onChallengeTeam(team);
                }}
                className="cm-btn cm-btn-primary w-full py-2.5"
              >
                <Swords className="w-4 h-4" /> Challenge {inspectTeam.name} in Clash Arena ▸
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
