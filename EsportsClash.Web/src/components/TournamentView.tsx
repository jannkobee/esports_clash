import React from 'react';
import { TournamentTeam } from '../types';
import { sound } from '../audio';
import { Trophy, Swords, Shield, Medal, ArrowRight } from 'lucide-react';

interface TournamentViewProps {
  currentLeague: string;
  round: number;
  maxRounds: number;
  standings: TournamentTeam[];
  onStartMatch: () => void;
}

export const TournamentView: React.FC<TournamentViewProps> = ({
  currentLeague,
  round,
  maxRounds,
  standings,
  onStartMatch
}) => {
  return (
    <div className="space-y-6 animate-fade-in max-w-5xl mx-auto">
      {/* Top Banner */}
      <div className="bg-gradient-to-r from-amber-950/60 via-slate-900 to-indigo-950 border border-amber-500/40 rounded-2xl p-5 shadow-xl flex flex-wrap justify-between items-center gap-4">
        <div>
          <div className="text-xs font-black uppercase tracking-widest text-amber-400 flex items-center gap-1.5 mb-1">
            <Trophy className="w-4 h-4" />
            Seasonal Split League
          </div>
          <h2 className="text-2xl font-black text-white">{currentLeague.toUpperCase()}</h2>
          <p className="text-slate-400 text-xs mt-0.5">
            Round {round} of {maxRounds} • Win matches to earn Diamond/GOAT packs & promotion to Worlds!
          </p>
        </div>

        <button
          onClick={() => {
            sound.playClick();
            onStartMatch();
          }}
          className="px-6 py-3 bg-gradient-to-r from-amber-400 to-yellow-500 text-slate-950 font-black rounded-xl hover:brightness-110 shadow-lg transition flex items-center gap-2"
        >
          <Swords className="w-5 h-5" />
          Enter Round {round} Match
        </button>
      </div>

      {/* Standings Table */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
        <div className="p-4 border-b border-slate-800 flex justify-between items-center">
          <h3 className="font-bold text-sm text-white flex items-center gap-2">
            <Medal className="w-4 h-4 text-amber-400" />
            League Standings Table
          </h3>
          <span className="text-xs text-slate-400">Top 2 Teams Qualify for Promotion</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-950/80 text-slate-400 uppercase tracking-wider font-bold text-[10px]">
              <tr>
                <th className="py-3 px-4">Pos</th>
                <th className="py-3 px-4">Team</th>
                <th className="py-3 px-4 text-center">Wins</th>
                <th className="py-3 px-4 text-center">Losses</th>
                <th className="py-3 px-4 text-center">Avg OVR</th>
                <th className="py-3 px-4 text-right">Points</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 font-semibold">
              {standings.map((team, idx) => (
                <tr
                  key={team.name}
                  className={`transition ${
                    team.isPlayer
                      ? 'bg-amber-500/10 text-amber-200 border-l-4 border-amber-400'
                      : 'hover:bg-slate-800/40 text-slate-300'
                  }`}
                >
                  <td className="py-3 px-4 font-black text-sm">
                    {idx === 0 ? '🥇 1' : idx === 1 ? '🥈 2' : idx === 2 ? '🥉 3' : idx + 1}
                  </td>
                  <td className="py-3 px-4 font-bold flex items-center gap-2">
                    {team.name}
                    {team.isPlayer && (
                      <span className="text-[9px] bg-amber-400 text-slate-950 px-1.5 py-0.2 rounded font-black uppercase">
                        YOU
                      </span>
                    )}
                  </td>
                  <td className="py-3 px-4 text-center font-bold text-emerald-400">{team.wins}</td>
                  <td className="py-3 px-4 text-center text-slate-400">{team.losses}</td>
                  <td className="py-3 px-4 text-center">{team.avgOvr}</td>
                  <td className="py-3 px-4 text-right font-black text-sm text-amber-400">{team.points}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

