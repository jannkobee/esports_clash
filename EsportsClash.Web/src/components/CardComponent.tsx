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
    if (card.isEvo) {
      return {
        border: 'border-emerald-400/90 shadow-emerald-500/40 ring-1 ring-emerald-400/50',
        bg: 'from-emerald-950 via-slate-900 to-teal-950',
        badge: 'bg-gradient-to-r from-emerald-400 to-teal-300 text-slate-950 font-black',
        textColor: 'text-emerald-200',
        cardGlow: 'shadow-[0_0_20px_rgba(16,185,129,0.35)]'
      };
    }
    switch (card.tier) {
      case 'GOAT':
        return {
          border: 'border-amber-400/80 shadow-amber-500/25',
          bg: 'from-amber-950 via-violet-950 to-slate-950',
          badge: 'bg-amber-300 text-slate-950 font-black',
          textColor: 'text-amber-200',
          cardGlow: 'shadow-[0_10px_30px_rgba(245,158,11,0.18)]'
        };
      case 'Diamond':
        return {
          border: 'border-sky-500/70 shadow-sky-500/20',
          bg: 'from-sky-950 via-indigo-950 to-slate-950',
          badge: 'bg-sky-300 text-slate-950 font-bold',
          textColor: 'text-blue-200',
          cardGlow: 'shadow-[0_10px_30px_rgba(56,189,248,0.14)]'
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
  const displayedRoles = card.playableRoles && card.playableRoles.length > 0
    ? card.playableRoles.join(' · ')
    : (card.preferredRole || card.role || 'Pro');

  if (compact) {
    return (
      <div
        onClick={onClick}
        role={onClick ? 'button' : undefined}
        tabIndex={onClick ? 0 : undefined}
        onKeyDown={onClick ? (event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); onClick(); } } : undefined}
        aria-label={onClick ? `${card.name}, ${card.ovr} overall ${displayedRoles}` : undefined}
        className={`group relative isolate w-full min-w-0 h-48 overflow-hidden rounded-2xl p-3 transition-all duration-200 hover:-translate-y-1 bg-gradient-to-br ${style.bg} border ${style.border} ${style.cardGlow} ${onClick ? 'cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-300' : ''} ${selected ? 'ring-2 ring-yellow-300' : ''}`}
      >
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_36%,rgba(255,255,255,0.15),transparent_55%)] pointer-events-none" />
        <div className="relative flex justify-between items-start gap-1">
          <div className="flex items-baseline gap-1">
            <span className="text-2xl font-black leading-none text-white tabular-nums drop-shadow">{card.ovr}</span>
            <span className="text-[9px] font-bold tracking-wider text-slate-300">OVR</span>
          </div>
          <div className="flex items-center gap-1">
            {card.isEvo && (
              <span className="text-[8px] bg-emerald-400 text-slate-950 font-black px-1.5 py-0.5 rounded shadow uppercase">
                EVO {card.evolutionLevel || 1}
              </span>
            )}
            <span className={`text-[9px] px-2 py-0.5 rounded-md uppercase tracking-wide ${style.badge}`}>{card.tier}</span>
          </div>
        </div>

        <div className="relative flex justify-center mt-1 mb-2">
          <div className="rounded-full bg-slate-950/60 border border-white/15 p-1 shadow-lg group-hover:border-white/35 transition-colors">
            <ChibiAvatar avatarType={card.avatarSvg} size={58} />
          </div>
        </div>

        <div className="relative text-center border-t border-white/10 pt-2">
          <div className="text-sm font-black text-white truncate drop-shadow" title={card.name}>{card.name}</div>
          <div className="text-[10px] text-slate-300 font-semibold truncate" title={displayedRoles}>{displayedRoles} <span className="text-slate-500">·</span> {card.origin}</div>
        </div>
      </div>
    );
  }

  return (
    <div
      onClick={onClick}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={onClick ? (event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); onClick(); } } : undefined}
      aria-label={onClick ? `${card.name}, ${card.ovr} overall ${displayedRoles}` : undefined}
      className={`card-shine relative w-full max-w-[230px] min-w-0 min-h-[440px] flex flex-col rounded-2xl p-3.5 transition-all duration-300 transform hover:-translate-y-2 hover:shadow-2xl bg-gradient-to-b ${style.bg} border-2 ${style.border} ${style.cardGlow} ${onClick ? 'cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-300' : ''} ${selected ? 'ring-4 ring-yellow-300 scale-105 z-10' : ''}`}
    >
      {/* Header: OVR + Role + Origin + Tier Badge */}
      <div className="flex justify-between items-start">
        <div className="flex flex-col items-center bg-black/40 px-2 py-1 rounded-lg border border-white/10 backdrop-blur-sm">
          <span className="text-2xl sm:text-3xl font-black text-white leading-tight drop-shadow-md">{card.ovr}</span>
          <span className="text-[10px] sm:text-xs font-black uppercase text-amber-300 text-center line-clamp-1" title={displayedRoles}>{displayedRoles}</span>
          <span className="text-[9px] text-slate-300 font-bold mt-0.5">{card.origin}</span>
        </div>

        <div className="flex flex-col items-end gap-1">
          <span className={`text-[10px] sm:text-xs px-2.5 py-0.5 rounded-full uppercase tracking-wider shadow ${style.badge}`}>
            {card.tier}
          </span>
          <div className="flex items-center gap-1">
            {card.isEvo && (
              <span className="text-[9px] bg-gradient-to-r from-emerald-400 to-teal-400 text-slate-950 font-black px-1.5 py-0.5 rounded shadow tracking-wide">
                ✦ EVO {card.evolutionLevel || 1}
              </span>
            )}
            <div className="text-[10px] bg-slate-900/80 text-slate-300 px-2 py-0.5 rounded border border-white/5">
              Lv. {card.level}
            </div>
          </div>
        </div>
      </div>

      {/* Chibi Character Portrait */}
      <div className="flex justify-center my-2 relative">
        {card.tier === 'GOAT' && (
          <div className="absolute -top-3">
            <Sparkles className="w-5 h-5 text-amber-300 animate-spin-slow" />
          </div>
        )}
        <ChibiAvatar avatarType={card.avatarSvg} size={76} />
      </div>

      {/* Fictional player identity and avatar specialties */}
      <div className="text-center mb-2">
        <div className="text-lg font-black text-white tracking-wide uppercase drop-shadow flex items-center justify-center gap-1 min-w-0">
          <span className="min-w-0 truncate" title={card.name}>{card.name}</span>
          {card.tier === 'GOAT' && <span className="text-amber-300 text-xs">👑</span>}
        </div>
        <div className="text-[11px] text-slate-300 font-medium leading-4 min-h-8 line-clamp-2" title={card.signatureChampions.slice(0, 2).join(' · ')}>
          Signature avatars: <span className="text-slate-100 font-semibold">{card.signatureChampions.slice(0, 2).join(' · ') || 'Flexible'}</span>
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
      <div className="mt-auto pt-3 flex flex-wrap gap-1 items-center justify-center">
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

