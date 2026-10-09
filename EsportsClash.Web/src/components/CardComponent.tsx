import React from 'react';
import { PlayerCard } from '../types';
import { ChibiAvatar } from './ChibiAvatar';
import { Shield, Zap, Sparkles } from 'lucide-react';

interface CardComponentProps {
  card: PlayerCard;
  onClick?: () => void;
  compact?: boolean;
  selected?: boolean;
}

export const CardComponent: React.FC<CardComponentProps> = ({
  card,
  onClick,
  compact = false,
  selected = false
}) => {
  const getTierStyles = () => {
    switch (card.tier) {
      case 'GOAT':
        return {
          border: 'border-amber-300 ring-2 ring-pink-500 shadow-pink-500/50',
          bg: 'from-amber-600 via-purple-700 to-pink-600',
          badge: 'bg-gradient-to-r from-amber-400 to-pink-500 text-slate-950 font-black',
          textColor: 'text-amber-200',
          cardGlow: 'shadow-[0_0_25px_rgba(236,72,153,0.6)]'
        };
      case 'Diamond':
        return {
          border: 'border-blue-400 ring-1 ring-cyan-400 shadow-blue-500/40',
          bg: 'from-blue-900 via-indigo-900 to-slate-900',
          badge: 'bg-gradient-to-r from-cyan-400 to-blue-500 text-slate-950 font-bold',
          textColor: 'text-blue-200',
          cardGlow: 'shadow-[0_0_20px_rgba(59,130,246,0.5)]'
        };
      case 'Platinum':
        return {
          border: 'border-cyan-400 shadow-cyan-500/30',
          bg: 'from-teal-900 via-cyan-950 to-slate-900',
          badge: 'bg-cyan-400 text-slate-950 font-bold',
          textColor: 'text-cyan-200',
          cardGlow: 'shadow-[0_0_15px_rgba(6,182,212,0.4)]'
        };
      case 'Gold':
        return {
          border: 'border-amber-400 shadow-amber-500/30',
          bg: 'from-amber-900 via-yellow-950 to-slate-900',
          badge: 'bg-amber-400 text-slate-950 font-bold',
          textColor: 'text-amber-200',
          cardGlow: 'shadow-[0_0_15px_rgba(245,158,11,0.4)]'
        };
      case 'Silver':
        return {
          border: 'border-slate-300 shadow-slate-400/20',
          bg: 'from-slate-700 via-slate-800 to-slate-900',
          badge: 'bg-slate-300 text-slate-950 font-bold',
          textColor: 'text-slate-200',
          cardGlow: 'shadow-md'
        };
      default: // Bronze
        return {
          border: 'border-amber-800 shadow-amber-900/20',
          bg: 'from-amber-950 via-stone-900 to-slate-950',
          badge: 'bg-amber-700 text-amber-100 font-bold',
          textColor: 'text-amber-300',
          cardGlow: 'shadow-sm'
        };
    }
  };

  const style = getTierStyles();

  if (compact) {
    return (
      <div
        onClick={onClick}
        className={`relative w-28 h-40 rounded-xl p-2 cursor-pointer transition-all duration-200 transform hover:-translate-y-1 bg-gradient-to-b ${style.bg} border-2 ${style.border} ${style.cardGlow} ${selected ? 'ring-4 ring-yellow-400 scale-105' : ''}`}
      >
        <div className="flex justify-between items-start">
          <div className="text-center">
            <span className="text-xl font-black leading-none block text-white drop-shadow">{card.ovr}</span>
            <span className="text-[10px] font-bold text-slate-300 uppercase">{card.preferredRole || card.role || 'PRO'}</span>
          </div>
          <span className={`text-[9px] px-1.5 py-0.5 rounded-full ${style.badge}`}>{card.tier}</span>
        </div>

        <div className="flex justify-center my-1">
          <ChibiAvatar avatarType={card.avatarSvg} size={48} />
        </div>

        <div className="text-center">
          <div className="text-xs font-bold text-white truncate drop-shadow">{card.name}</div>
          <div className="text-[9px] text-slate-400 font-semibold">{card.origin}</div>
        </div>
      </div>
    );
  }

  return (
    <div
      onClick={onClick}
      className={`card-shine relative w-64 h-96 rounded-2xl p-4 cursor-pointer transition-all duration-300 transform hover:-translate-y-2 hover:shadow-2xl bg-gradient-to-b ${style.bg} border-2 ${style.border} ${style.cardGlow} ${selected ? 'ring-4 ring-yellow-300 scale-105' : ''}`}
    >
      {/* Header: OVR + Role + Origin + Tier Badge */}
      <div className="flex justify-between items-start">
        <div className="flex flex-col items-center bg-black/40 px-2.5 py-1 rounded-lg border border-white/10 backdrop-blur-sm">
          <span className="text-3xl font-black text-white leading-tight drop-shadow-md">{card.ovr}</span>
          <span className="text-xs font-black uppercase text-amber-300">{card.preferredRole || card.role || 'PRO ATHLETE'}</span>
          <span className="text-[10px] text-slate-300 font-bold mt-0.5">{card.origin}</span>
        </div>

        <div className="flex flex-col items-end gap-1">
          <span className={`text-xs px-2.5 py-0.5 rounded-full uppercase tracking-wider shadow ${style.badge}`}>
            {card.tier}
          </span>
          <div className="text-[10px] bg-slate-900/80 text-slate-300 px-2 py-0.5 rounded border border-white/5">
            Lv. {card.level}
          </div>
        </div>
      </div>

      {/* Chibi Character Portrait */}
      <div className="flex justify-center my-2 relative">
        {card.tier === 'GOAT' && (
          <div className="absolute -top-3">
            <Sparkles className="w-6 h-6 text-amber-300 animate-spin-slow" />
          </div>
        )}
        <ChibiAvatar avatarType={card.avatarSvg} size={84} />
      </div>

      {/* Name and Real Ref */}
      <div className="text-center mb-2">
        <div className="text-lg font-black text-white tracking-wide uppercase drop-shadow flex items-center justify-center gap-1">
          {card.name}
          {card.tier === 'GOAT' && <span className="text-amber-300 text-xs">👑</span>}
        </div>
        <div className="text-[11px] text-slate-400 font-medium">
          Based on: <span className="text-slate-200 font-semibold">{card.realName}</span>
        </div>
      </div>

      {/* 6 Core Face Attributes (EA FC Style) */}
      <div className="grid grid-cols-2 gap-x-3 gap-y-1 bg-black/40 backdrop-blur-sm p-2 rounded-xl border border-white/10 text-xs">
        <div className="flex justify-between items-center">
          <span className="text-slate-400 font-bold">LAN</span>
          <span className="font-extrabold text-white">{card.stats.lan}</span>
        </div>
        <div className="flex justify-between items-center">
          <span className="text-slate-400 font-bold">TF</span>
          <span className="font-extrabold text-white">{card.stats.tf}</span>
        </div>
        <div className="flex justify-between items-center">
          <span className="text-slate-400 font-bold">IQ</span>
          <span className="font-extrabold text-white">{card.stats.iq}</span>
        </div>
        <div className="flex justify-between items-center">
          <span className="text-slate-400 font-bold">CLU</span>
          <span className="font-extrabold text-amber-300">{card.stats.clu}</span>
        </div>
        <div className="flex justify-between items-center">
          <span className="text-slate-400 font-bold">STA</span>
          <span className="font-extrabold text-white">{card.stats.sta}</span>
        </div>
        <div className="flex justify-between items-center">
          <span className="text-slate-400 font-bold">FLX</span>
          <span className="font-extrabold text-white">{card.stats.flx}</span>
        </div>
      </div>

      {/* Badges & Traits */}
      <div className="mt-2 flex flex-wrap gap-1 items-center justify-center">
        {card.badges.slice(0, 2).map((b, i) => (
          <span key={i} className="text-[10px] bg-white/10 text-amber-200 px-2 py-0.5 rounded-full border border-amber-300/30 font-semibold flex items-center gap-1">
            <Zap className="w-2.5 h-2.5" />
            {b}
          </span>
        ))}
        {card.personality && (
          <span className="text-[10px] bg-purple-950/80 text-purple-200 px-2 py-0.5 rounded-full border border-purple-400/30">
            {card.personality}
          </span>
        )}
      </div>
    </div>
  );
};

