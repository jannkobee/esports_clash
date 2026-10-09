import React, { useState } from 'react';
import { Facility, PlayerCard } from '../types';
import { ChibiAvatar } from './ChibiAvatar';
import { sound } from '../audio';
import { 
  Monitor, 
  Brain, 
  Dumbbell, 
  Video, 
  Utensils, 
  Bed, 
  Zap, 
  Smile, 
  Battery, 
  ArrowUpCircle,
  Play
} from 'lucide-react';

interface GamingHouseViewProps {
  facilities: Facility[];
  roster: PlayerCard[];
  teamFunds: number;
  onUpgradeFacility: (facilityId: string) => void;
  onRunDailySchedule: (activityType: string) => void;
}

export const GamingHouseView: React.FC<GamingHouseViewProps> = ({
  facilities,
  roster,
  teamFunds,
  onUpgradeFacility,
  onRunDailySchedule
}) => {
  const [selectedActivity, setSelectedActivity] = useState<string>('scrim');
  const [activityLogs, setActivityLogs] = useState<string[]>([]);

  const getRoomIcon = (id: string) => {
    switch (id) {
      case 'f_scrim': return <Monitor className="w-5 h-5 text-cyan-400" />;
      case 'f_vod': return <Brain className="w-5 h-5 text-purple-400" />;
      case 'f_gym': return <Dumbbell className="w-5 h-5 text-amber-400" />;
      case 'f_stream': return <Video className="w-5 h-5 text-pink-400" />;
      case 'f_kitchen': return <Utensils className="w-5 h-5 text-emerald-400" />;
      default: return <Bed className="w-5 h-5 text-indigo-400" />;
    }
  };

  const getRoomEmoji = (id: string) => {
    switch (id) {
      case 'f_scrim': return '🎮';
      case 'f_vod': return '🧠';
      case 'f_gym': return '💪';
      case 'f_stream': return '🎥';
      case 'f_kitchen': return '🍕';
      default: return '💤';
    }
  };

  const handleExecuteActivity = (type: string) => {
    sound.playClick();
    onRunDailySchedule(type);
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Top Banner: Mansion Stats */}
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 border border-slate-700/80 rounded-2xl p-4 shadow-xl flex flex-wrap justify-between items-center gap-4">
        <div>
          <h2 className="text-xl font-black text-white flex items-center gap-2">
            🏠 GOAT GAMING MANSION
            <span className="text-xs bg-emerald-500/20 text-emerald-300 px-2 py-0.5 rounded-full border border-emerald-400/30">Tier 1 HQ</span>
          </h2>
          <p className="text-slate-400 text-xs mt-0.5">Manage player lifestyle, scrimmage regimens, gym wellness & stream sponsorships.</p>
        </div>

        <div className="flex items-center gap-4 text-xs font-bold">
          <div className="bg-black/40 px-3 py-1.5 rounded-lg border border-white/10 flex items-center gap-2">
            <Smile className="w-4 h-4 text-yellow-400" />
            <span>Avg Morale: {Math.round(roster.reduce((a, b) => a + b.morale, 0) / (roster.length || 1))}%</span>
          </div>
          <div className="bg-black/40 px-3 py-1.5 rounded-lg border border-white/10 flex items-center gap-2">
            <Battery className="w-4 h-4 text-cyan-400" />
            <span>Avg Fatigue: {Math.round(roster.reduce((a, b) => a + b.fatigue, 0) / (roster.length || 1))}%</span>
          </div>
        </div>
      </div>

      {/* Interactive 6-Room Isometric Facility Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {facilities.map((fac, idx) => {
          // Place 1 or 2 chibi players in this room for visual life-sim ambience
          const assignedPlayer = roster[idx % roster.length];
          const roomEmoji = getRoomEmoji(fac.id);

          return (
            <div
              key={fac.id}
              className="bg-slate-900/90 border border-slate-800 hover:border-slate-600 rounded-2xl p-4 transition-all duration-300 hover:shadow-xl relative overflow-hidden group"
            >
              {/* Room Header */}
              <div className="flex justify-between items-start mb-3">
                <div className="flex items-center gap-2">
                  <div className="p-2 bg-slate-800 rounded-xl border border-white/5">
                    {getRoomIcon(fac.id)}
                  </div>
                  <div>
                    <h3 className="font-bold text-sm text-white group-hover:text-amber-300 transition">{fac.name}</h3>
                    <div className="text-[11px] text-slate-400">Level {fac.level}/{fac.maxLevel}</div>
                  </div>
                </div>

                <button
                  onClick={() => {
                    sound.playClick();
                    onUpgradeFacility(fac.id);
                  }}
                  disabled={teamFunds < fac.cost || fac.level >= fac.maxLevel}
                  className={`px-2.5 py-1 rounded-lg text-xs font-bold flex items-center gap-1 transition ${
                    teamFunds >= fac.cost && fac.level < fac.maxLevel
                      ? 'bg-amber-500 hover:bg-amber-400 text-slate-950 shadow'
                      : 'bg-slate-800 text-slate-500 cursor-not-allowed'
                  }`}
                >
                  <ArrowUpCircle className="w-3.5 h-3.5" />
                  {fac.level >= fac.maxLevel ? 'MAX' : `$${fac.cost}`}
                </button>
              </div>

              {/* Room Visual Canvas with Chibi Inhabitants */}
              <div className="h-32 bg-slate-950/80 rounded-xl border border-slate-800/80 p-3 flex items-center justify-around relative">
                {/* Visual Ambient Decor */}
                <div className="text-3xl opacity-20 select-none">{roomEmoji}</div>

                {/* Chibi Character in Room */}
                {assignedPlayer && (
                  <div className="flex flex-col items-center relative animate-bounce" style={{ animationDuration: '3s' }}>
                    {/* Floating Thought Bubble */}
                    <div className="absolute -top-6 bg-white text-slate-950 text-xs px-2 py-0.5 rounded-full shadow-md font-bold flex items-center gap-1 border border-slate-300">
                      <span>{roomEmoji}</span>
                      <span className="text-[9px] font-semibold">{assignedPlayer.name}</span>
                    </div>
                    <ChibiAvatar avatarType={assignedPlayer.avatarSvg} size={48} />
                  </div>
                )}

                <div className="text-[10px] text-slate-400 max-w-[130px] leading-tight text-right">
                  {fac.desc}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Daily Routine Control Hub */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-lg">
        <h3 className="text-md font-black text-amber-300 uppercase tracking-wide mb-3 flex items-center gap-2">
          <Zap className="w-4 h-4" />
          Assign Daily Team Routine (Advances Day)
        </h3>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          <button
            onClick={() => handleExecuteActivity('scrim')}
            className="p-3 bg-slate-800 hover:bg-cyan-950 hover:border-cyan-500 border border-slate-700 rounded-xl text-center transition group flex flex-col items-center gap-1"
          >
            <Monitor className="w-5 h-5 text-cyan-400 group-hover:scale-110 transition" />
            <span className="text-xs font-bold text-white">5v5 Scrims</span>
            <span className="text-[10px] text-cyan-300 font-medium">+XP, +Synergy</span>
          </button>

          <button
            onClick={() => handleExecuteActivity('vod')}
            className="p-3 bg-slate-800 hover:bg-purple-950 hover:border-purple-500 border border-slate-700 rounded-xl text-center transition group flex flex-col items-center gap-1"
          >
            <Brain className="w-5 h-5 text-purple-400 group-hover:scale-110 transition" />
            <span className="text-xs font-bold text-white">VOD Review</span>
            <span className="text-[10px] text-purple-300 font-medium">+Macro IQ</span>
          </button>

          <button
            onClick={() => handleExecuteActivity('gym')}
            className="p-3 bg-slate-800 hover:bg-amber-950 hover:border-amber-500 border border-slate-700 rounded-xl text-center transition group flex flex-col items-center gap-1"
          >
            <Dumbbell className="w-5 h-5 text-amber-400 group-hover:scale-110 transition" />
            <span className="text-xs font-bold text-white">Gym & Physio</span>
            <span className="text-[10px] text-amber-300 font-medium">-Fatigue, +Stamina</span>
          </button>

          <button
            onClick={() => handleExecuteActivity('stream')}
            className="p-3 bg-slate-800 hover:bg-pink-950 hover:border-pink-500 border border-slate-700 rounded-xl text-center transition group flex flex-col items-center gap-1"
          >
            <Video className="w-5 h-5 text-pink-400 group-hover:scale-110 transition" />
            <span className="text-xs font-bold text-white">Stream to Fans</span>
            <span className="text-[10px] text-pink-300 font-medium">+Cash & Fans</span>
          </button>

          <button
            onClick={() => handleExecuteActivity('rest')}
            className="p-3 bg-slate-800 hover:bg-indigo-950 hover:border-indigo-500 border border-slate-700 rounded-xl text-center transition group flex flex-col items-center gap-1"
          >
            <Bed className="w-5 h-5 text-indigo-400 group-hover:scale-110 transition" />
            <span className="text-xs font-bold text-white">Sleep Pods</span>
            <span className="text-[10px] text-indigo-300 font-medium">Full Fatigue Reset</span>
          </button>

          <button
            onClick={() => handleExecuteActivity('dinner')}
            className="p-3 bg-slate-800 hover:bg-emerald-950 hover:border-emerald-500 border border-slate-700 rounded-xl text-center transition group flex flex-col items-center gap-1"
          >
            <Utensils className="w-5 h-5 text-emerald-400 group-hover:scale-110 transition" />
            <span className="text-xs font-bold text-white">Team Dinner</span>
            <span className="text-[10px] text-emerald-300 font-medium">+Morale & Synergy</span>
          </button>
        </div>
      </div>
    </div>
  );
};

