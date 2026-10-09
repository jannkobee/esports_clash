import React, { useState, useEffect } from 'react';
import { ChampionKit, CoachCard, PlayerCard } from '../types';
import { ChibiAvatar } from './ChibiAvatar';
import { sound } from '../audio';
import confetti from 'canvas-confetti';
import { 
  Play, 
  Pause, 
  Trophy, 
  Zap, 
  ShieldAlert, 
  Flame,
  Swords,
  Heart,
  EyeOff
} from 'lucide-react';

interface CombatUnit {
  id: string;
  player: PlayerCard;
  champion: ChampionKit;
  team: 'blue' | 'red';
  x: number; // 0 to 100 on lane
  y: number; // 20 to 80 (slight lane spread)
  hp: number;
  maxHp: number;
  shield: number;
  attackTimer: number;
  cd1: number;
  cd2: number;
  cdUlt: number;
  stun: number;
  charm: number;
  bleed: number;
  isInBush: boolean;
  kills: number;
  deaths: number;
  assists: number;
  damageDealt: number;
  damageTaken: number;
  isAlive: boolean;
}

interface RelicPad {
  id: string;
  x: number;
  y: number;
  isAvailable: boolean;
  respawnTimer: number;
}

interface DamageFloat {
  id: string;
  x: number;
  y: number;
  text: string;
  color: string;
  opacity: number;
}

interface ArenaMatchViewProps {
  blueLineup: { player: PlayerCard; champion: ChampionKit }[];
  redLineup: { player: PlayerCard; champion: ChampionKit }[];
  blueCoach?: CoachCard;
  redCoach?: CoachCard;
  onMatchComplete: (winner: 'blue' | 'red', mvp: CombatUnit, stats: CombatUnit[]) => void;
}

export const ArenaMatchView: React.FC<ArenaMatchViewProps> = ({
  blueLineup,
  redLineup,
  onMatchComplete
}) => {
  const [speed, setSpeed] = useState<number>(1);
  const [paused, setPaused] = useState<boolean>(false);
  const [matchTime, setMatchTime] = useState<number>(0);
  const [combatLogs, setCombatLogs] = useState<string[]>([]);
  const [matchOver, setMatchOver] = useState<boolean>(false);
  const [shrineProgress, setShrineProgress] = useState<number>(0); // -100 (blue) to +100 (red)
  const [shrineOwner, setShrineOwner] = useState<'blue' | 'red' | null>(null);

  // Tower & Nexus HPs
  const [blueTowerHp, setBlueTowerHp] = useState<number>(2500);
  const [blueNexusHp, setBlueNexusHp] = useState<number>(5000);
  const [redTowerHp, setRedTowerHp] = useState<number>(2500);
  const [redNexusHp, setRedNexusHp] = useState<number>(5000);

  // Healing Relic Shrines on Map
  const [relics, setRelics] = useState<RelicPad[]>([
    { id: 'relic_top', x: 38, y: 22, isAvailable: true, respawnTimer: 0 },
    { id: 'relic_bot', x: 62, y: 78, isAvailable: true, respawnTimer: 0 }
  ]);

  // Units State
  const [units, setUnits] = useState<CombatUnit[]>([]);
  const [damageFloats, setDamageFloats] = useState<DamageFloat[]>([]);

  // Initialize Units on the 1-Lane Bridge
  useEffect(() => {
    const blueUnits: CombatUnit[] = blueLineup.map((item, idx) => ({
      id: `b_${item.player.id}_${idx}`,
      player: item.player,
      champion: item.champion,
      team: 'blue',
      x: 10 + idx * 3,
      y: 35 + idx * 7,
      hp: item.champion.hp * (1 + (item.player.stats.sta - 50) * 0.006),
      maxHp: item.champion.hp * (1 + (item.player.stats.sta - 50) * 0.006),
      shield: 0,
      attackTimer: 0,
      cd1: 0,
      cd2: 0,
      cdUlt: 5,
      stun: 0,
      charm: 0,
      bleed: 0,
      isInBush: false,
      kills: 0,
      deaths: 0,
      assists: 0,
      damageDealt: 0,
      damageTaken: 0,
      isAlive: true
    }));

    const redUnits: CombatUnit[] = redLineup.map((item, idx) => ({
      id: `r_${item.player.id}_${idx}`,
      player: item.player,
      champion: item.champion,
      team: 'red',
      x: 90 - idx * 3,
      y: 35 + idx * 7,
      hp: item.champion.hp * (1 + (item.player.stats.sta - 50) * 0.006),
      maxHp: item.champion.hp * (1 + (item.player.stats.sta - 50) * 0.006),
      shield: 0,
      attackTimer: 0,
      cd1: 0,
      cd2: 0,
      cdUlt: 5,
      stun: 0,
      charm: 0,
      bleed: 0,
      isInBush: false,
      kills: 0,
      deaths: 0,
      assists: 0,
      damageDealt: 0,
      damageTaken: 0,
      isAlive: true
    }));

    setUnits([...blueUnits, ...redUnits]);
    addLog(`📍 Welcome to The Howling Bridge of Mayhem (1-Lane MOBA)`);
  }, []);

  const addLog = (msg: string) => {
    setCombatLogs((prev) => [msg, ...prev.slice(0, 15)]);
  };

  // Main Simulation Loop
  useEffect(() => {
    if (paused || matchOver || units.length === 0) return;

    const interval = setInterval(() => {
      const dt = 0.1 * speed;
      setMatchTime((t) => t + dt);

      // 1. Process Relic Spawns
      setRelics((prevRelics) =>
        prevRelics.map((r) => {
          if (!r.isAvailable) {
            const nextTimer = r.respawnTimer - dt;
            if (nextTimer <= 0) return { ...r, isAvailable: true, respawnTimer: 0 };
            return { ...r, respawnTimer: nextTimer };
          }
          return r;
        })
      );

      // 2. Process Units & Combat
      setUnits((prevUnits) => {
        const nextUnits = [...prevUnits];

        // Central Shrine Capture Logic
        const blueInMid = nextUnits.filter((u) => u.isAlive && u.team === 'blue' && Math.abs(u.x - 50) < 8).length;
        const redInMid = nextUnits.filter((u) => u.isAlive && u.team === 'red' && Math.abs(u.x - 50) < 8).length;

        if (blueInMid > redInMid) {
          setShrineProgress((p) => {
            const nextP = Math.max(-100, p - 15 * dt);
            if (nextP <= -100 && shrineOwner !== 'blue') {
              setShrineOwner('blue');
              sound.playUltimateExplosion();
              addLog(`⚡ BLUE TEAM CAPTURED MAYHEM SHRINE! Overcharged Lightning Shield granted!`);
              nextUnits.filter((u) => u.team === 'blue' && u.isAlive).forEach((u) => { u.shield += 300; });
            }
            return nextP;
          });
        } else if (redInMid > blueInMid) {
          setShrineProgress((p) => {
            const nextP = Math.min(100, p + 15 * dt);
            if (nextP >= 100 && shrineOwner !== 'red') {
              setShrineOwner('red');
              sound.playUltimateExplosion();
              addLog(`⚡ RED TEAM CAPTURED MAYHEM SHRINE! Overcharged Lightning Shield granted!`);
              nextUnits.filter((u) => u.team === 'red' && u.isAlive).forEach((u) => { u.shield += 300; });
            }
            return nextP;
          });
        }

        // Process Living Champions
        nextUnits.forEach((u) => {
          if (!u.isAlive) return;

          // Status & Cooldown Tick
          if (u.stun > 0) u.stun = Math.max(0, u.stun - dt);
          if (u.charm > 0) u.charm = Math.max(0, u.charm - dt);
          if (u.cd1 > 0) u.cd1 = Math.max(0, u.cd1 - dt);
          if (u.cd2 > 0) u.cd2 = Math.max(0, u.cd2 - dt);
          if (u.cdUlt > 0) u.cdUlt = Math.max(0, u.cdUlt - dt);
          if (u.attackTimer > 0) u.attackTimer = Math.max(0, u.attackTimer - dt);

          // Check Bush Stealth: Upper Bush (x: 40-48, y: 15-30) or Lower Bush (x: 52-60, y: 70-85)
          const inUpperBush = u.x >= 40 && u.x <= 48 && u.y <= 32;
          const inLowerBush = u.x >= 52 && u.x <= 60 && u.y >= 68;
          u.isInBush = inUpperBush || inLowerBush;

          // Check Health Relic Pickup if HP < 60%
          if (u.hp < u.maxHp * 0.6) {
            relics.forEach((r) => {
              if (r.isAvailable && Math.hypot(u.x - r.x, u.y - r.y) < 6) {
                r.isAvailable = false;
                r.respawnTimer = 25; // 25s respawn
                const healAmt = Math.round(u.maxHp * 0.35);
                u.hp = Math.min(u.maxHp, u.hp + healAmt);
                sound.playCoin();
                addLog(`💚 ${u.player.name} grabbed a Healing Relic (+${healAmt} HP)!`);
              }
            });
          }

          if (u.stun > 0 || u.charm > 0) return;

          // Enemy Targeting
          const enemies = nextUnits.filter((e) => e.team !== u.team && e.isAlive);
          if (enemies.length === 0) {
            // Push Structures
            if (u.team === 'blue') {
              setRedTowerHp((hp) => {
                if (hp > 0) return Math.max(0, hp - 40 * dt);
                setRedNexusHp((nx) => Math.max(0, nx - 60 * dt));
                return 0;
              });
            } else {
              setBlueTowerHp((hp) => {
                if (hp > 0) return Math.max(0, hp - 40 * dt);
                setBlueNexusHp((nx) => Math.max(0, nx - 60 * dt));
                return 0;
              });
            }
            return;
          }

          const target = enemies.sort((a, b) => a.hp - b.hp)[0];
          const dist = Math.abs(u.x - target.x);
          const range = u.champion.range * 6;

          if (dist > range) {
            const dir = u.team === 'blue' ? 1 : -1;
            u.x += dir * (7 * dt);
          } else {
            // In Combat Range
            if (u.cdUlt <= 0 && target.hp < target.maxHp * 0.7) {
              u.cdUlt = u.champion.ultimate.cooldown;
              const dmg = u.champion.ultimate.damage * (1 + (u.player.stats.lan - 50) * 0.01);
              applyDamage(u, target, dmg, `${u.champion.name} ULT!`);
              sound.playUltimateExplosion();
              addLog(`💥 ${u.player.name} (${u.champion.name}) cast ${u.champion.ultimate.name}!`);

              if (u.champion.name === 'Solana') enemies.forEach((e) => { e.stun = 2.0; });
              else if (u.champion.name === 'Astra') target.stun = 2.5;
            } else if (u.cd1 <= 0) {
              u.cd1 = u.champion.skill1.cooldown;
              applyDamage(u, target, u.champion.skill1.damage, u.champion.skill1.name);
              sound.playSpellHit();
              if (u.champion.name === 'Solana') { target.stun = 1.2; u.shield += 180; }
            } else if (u.cd2 <= 0) {
              u.cd2 = u.champion.skill2.cooldown;
              applyDamage(u, target, u.champion.skill2.damage, u.champion.skill2.name);
              if (u.champion.name === 'Kyumi') { target.charm = 1.5; addLog(`💖 ${u.player.name} charmed ${target.player.name}!`); }
            } else if (u.attackTimer <= 0) {
              u.attackTimer = 1.0 / Math.max(0.5, u.champion.aspd);
              applyDamage(u, target, u.champion.ad);
            }
          }
        });

        // Check Victory
        if (redNexusHp <= 0) handleVictory('blue', nextUnits);
        else if (blueNexusHp <= 0) handleVictory('red', nextUnits);

        return nextUnits;
      });

      // Decay floating damage text
      setDamageFloats((floats) =>
        floats
          .map((f) => ({ ...f, y: f.y - 1, opacity: f.opacity - 0.08 }))
          .filter((f) => f.opacity > 0)
      );
    }, 100);

    return () => clearInterval(interval);
  }, [paused, speed, matchOver, units, blueNexusHp, redNexusHp, matchTime, shrineOwner, relics]);

  const applyDamage = (attacker: CombatUnit, target: CombatUnit, rawDamage: number, label?: string) => {
    let effective = rawDamage * (100 / (100 + target.champion.armor));

    // Ambush Bush crit bonus
    if (attacker.isInBush) {
      effective *= 1.25;
      label = `AMBUSH CRIT! ${label || ''}`;
    }

    const finalDamage = Math.round(effective);
    target.hp = Math.max(0, target.hp - finalDamage);
    target.damageTaken += finalDamage;
    attacker.damageDealt += finalDamage;

    setDamageFloats((prev) => [
      ...prev,
      {
        id: Math.random().toString(),
        x: target.x,
        y: target.y - 8,
        text: label ? `${label} -${finalDamage}` : `-${finalDamage}`,
        color: attacker.team === 'blue' ? '#38bdf8' : '#f87171',
        opacity: 1
      }
    ]);

    if (target.hp <= 0 && target.isAlive) {
      target.isAlive = false;
      target.deaths++;
      attacker.kills++;
      addLog(`☠️ [KILL] ${attacker.player.name} (${attacker.champion.name}) slain ${target.player.name}!`);
    }
  };

  const handleVictory = (winTeam: 'blue' | 'red', finalUnits: CombatUnit[]) => {
    setMatchOver(true);
    sound.playWalkoutFanfare();
    confetti({ particleCount: 160, spread: 90, origin: { y: 0.5 } });

    const mvp = finalUnits.sort((a, b) => b.kills * 4 + b.damageDealt / 300 - a.kills * 4 - a.damageDealt / 300)[0];
    onMatchComplete(winTeam, mvp, finalUnits);
  };

  const triggerCoachTactic = (tactic: 'focus' | 'retreat' | 'sync') => {
    sound.playClick();
    if (tactic === 'focus') {
      addLog(`📢 COACH TACTIC: "FOCUS BACKLINE CARRIES!" (+Cooldown Reset)`);
      setUnits((prev) => prev.map((u) => (u.team === 'blue' ? { ...u, cd1: 0, cd2: 0 } : u)));
    } else if (tactic === 'sync') {
      addLog(`📢 COACH TACTIC: "UNLEASH ALL ULTIMATES TOGETHER!"`);
      setUnits((prev) => prev.map((u) => (u.team === 'blue' ? { ...u, cdUlt: 0 } : u)));
    } else {
      addLog(`📢 COACH TACTIC: "FALL BACK TO DEFENSIVE TOWER!" (+200 Shield)`);
      setUnits((prev) => prev.map((u) => (u.team === 'blue' ? { ...u, shield: u.shield + 200 } : u)));
    }
  };

  const blueKills = units.filter((u) => u.team === 'blue').reduce((a, b) => a + b.kills, 0);
  const redKills = units.filter((u) => u.team === 'red').reduce((a, b) => a + b.kills, 0);

  return (
    <div className="space-y-4 animate-fade-in max-w-6xl mx-auto">
      {/* Top Match Broadcast Scoreboard */}
      <div className="bg-slate-900 border border-slate-700 rounded-2xl p-4 shadow-2xl flex justify-between items-center">
        {/* Blue Squad Overview */}
        <div className="text-left">
          <h3 className="font-black text-cyan-400 text-lg">T-CHIBI SQUAD (Blue)</h3>
          <div className="text-xs text-slate-400 flex items-center gap-2">
            <span>Outer Turret: {Math.round(blueTowerHp)}</span>
            <span>•</span>
            <span className="text-cyan-300 font-bold">Nexus: {Math.round(blueNexusHp)}</span>
          </div>
        </div>

        {/* Score & Time */}
        <div className="flex flex-col items-center">
          <div className="text-3xl font-black tracking-widest text-white drop-shadow flex items-center gap-4">
            <span className="text-cyan-400">{blueKills}</span>
            <span className="text-slate-500 text-lg font-normal">VS</span>
            <span className="text-rose-400">{redKills}</span>
          </div>
          <div className="text-xs text-amber-300 font-mono font-bold mt-1">
            ⏱️ {Math.floor(matchTime / 60)}:{(Math.floor(matchTime % 60)).toString().padStart(2, '0')}
          </div>
        </div>

        {/* Red Squad Overview */}
        <div className="text-right">
          <h3 className="font-black text-rose-400 text-lg">RIVAL CHIBI (Red)</h3>
          <div className="text-xs text-slate-400 flex items-center gap-2 justify-end">
            <span>Outer Turret: {Math.round(redTowerHp)}</span>
            <span>•</span>
            <span className="text-rose-300 font-bold">Nexus: {Math.round(redNexusHp)}</span>
          </div>
        </div>
      </div>

      {/* ======================================================== */}
      {/* AUTHENTIC 1-LANE ARAM MAYHEM ARENA MAP ("THE HOWLING BRIDGE") */}
      {/* ======================================================== */}
      <div className="relative w-full h-96 bg-slate-950 rounded-3xl border-2 border-indigo-900/80 overflow-hidden shadow-[inset_0_0_60px_rgba(0,0,0,0.9)]">
        {/* Deep Abyss Background with Falling Star Particles */}
        <div className="absolute inset-0 bg-gradient-to-b from-indigo-950/40 via-slate-950 to-slate-950" />

        {/* 1-Lane Stone Bridge */}
        <div className="absolute inset-x-0 top-1/2 -translate-y-1/2 h-52 bg-gradient-to-r from-slate-900 via-stone-900 to-slate-900 border-y-4 border-slate-700/80 shadow-2xl flex items-center justify-between px-6">
          {/* Blue Base, Spawn Hex-Gate, Nexus, and Turret */}
          <div className="flex items-center gap-3 relative z-10">
            {/* Spawn Gate */}
            <div className="w-6 h-28 bg-cyan-900/40 border border-cyan-400/50 rounded-l flex items-center justify-center text-[8px] text-cyan-300 font-black rotate-180 writing-vertical">
              SPEED GATE
            </div>
            {/* Blue Nexus */}
            <div className="w-12 h-28 bg-gradient-to-b from-cyan-950 to-slate-900 border-2 border-cyan-400 rounded-xl flex flex-col items-center justify-center text-[9px] font-black text-cyan-200 shadow-[0_0_20px_rgba(6,182,212,0.6)]">
              💎
              <span>NEXUS</span>
              <span className="text-[8px] text-cyan-400">{Math.round(blueNexusHp)}</span>
            </div>
            {/* Blue Outer Turret */}
            <div className="w-8 h-20 bg-slate-900 border-2 border-cyan-300 rounded-lg flex flex-col items-center justify-center text-[8px] font-bold text-cyan-200 shadow-md">
              🗼
              <span>{Math.round(blueTowerHp)}</span>
            </div>
          </div>

          {/* Central Mayhem Altar & Capture Ring */}
          <div className="flex flex-col items-center relative z-10">
            <div className={`w-20 h-20 rounded-full border-4 flex flex-col items-center justify-center shadow-2xl transition-all ${
              shrineOwner === 'blue'
                ? 'border-cyan-400 bg-cyan-950/90 text-cyan-300 shadow-cyan-500/80 animate-pulse'
                : shrineOwner === 'red'
                ? 'border-rose-400 bg-rose-950/90 text-rose-300 shadow-rose-500/80 animate-pulse'
                : 'border-amber-400 bg-amber-950/70 text-amber-300'
            }`}>
              <Zap className="w-7 h-7 animate-bounce" />
              <span className="text-[8px] font-black uppercase">Altar</span>
              {/* Progress Gauge */}
              <div className="w-12 h-1 bg-black rounded-full overflow-hidden mt-0.5">
                <div
                  className="h-full bg-amber-400 transition-all"
                  style={{ width: `${Math.abs(shrineProgress)}%` }}
                />
              </div>
            </div>
          </div>

          {/* Red Turret, Nexus, and Spawn Gate */}
          <div className="flex items-center gap-3 relative z-10">
            {/* Red Outer Turret */}
            <div className="w-8 h-20 bg-slate-900 border-2 border-rose-300 rounded-lg flex flex-col items-center justify-center text-[8px] font-bold text-rose-200 shadow-md">
              🗼
              <span>{Math.round(redTowerHp)}</span>
            </div>
            {/* Red Nexus */}
            <div className="w-12 h-28 bg-gradient-to-b from-rose-950 to-slate-900 border-2 border-rose-400 rounded-xl flex flex-col items-center justify-center text-[9px] font-black text-rose-200 shadow-[0_0_20px_rgba(244,63,94,0.6)]">
              💎
              <span>NEXUS</span>
              <span className="text-[8px] text-rose-400">{Math.round(redNexusHp)}</span>
            </div>
            {/* Spawn Gate */}
            <div className="w-6 h-28 bg-rose-900/40 border border-rose-400/50 rounded-r flex items-center justify-center text-[8px] text-rose-300 font-black writing-vertical">
              SPEED GATE
            </div>
          </div>
        </div>

        {/* Top & Bottom Ambush Bushes along the bridge */}
        <div
          className="absolute w-20 h-10 bg-emerald-950/90 border-2 border-emerald-500/60 rounded-full flex items-center justify-center text-[9px] font-bold text-emerald-300 shadow-inner z-10"
          style={{ left: '40%', top: '16%' }}
        >
          🌿 Upper Bush
        </div>
        <div
          className="absolute w-20 h-10 bg-emerald-950/90 border-2 border-emerald-500/60 rounded-full flex items-center justify-center text-[9px] font-bold text-emerald-300 shadow-inner z-10"
          style={{ left: '52%', bottom: '16%' }}
        >
          🌿 Lower Bush
        </div>

        {/* Healing Relic Shrines */}
        {relics.map((r) => (
          <div
            key={r.id}
            className={`absolute w-8 h-8 rounded-full border-2 flex items-center justify-center shadow-lg transition-all z-10 ${
              r.isAvailable
                ? 'border-emerald-400 bg-emerald-950 text-emerald-300 shadow-emerald-500/50 animate-bounce'
                : 'border-slate-700 bg-slate-900 text-slate-600'
            }`}
            style={{ left: `${r.x}%`, top: `${r.y}%` }}
          >
            <Heart className="w-4 h-4" />
          </div>
        ))}

        {/* COMBAT CHIBI CHAMPIONS WITH ANIMATIONS */}
        {units.map((u) => {
          if (!u.isAlive) return null;

          return (
            <div
              key={u.id}
              className={`absolute transform -translate-x-1/2 -translate-y-1/2 transition-all duration-100 flex flex-col items-center cursor-pointer ${
                u.isInBush ? 'opacity-50' : 'opacity-100'
              }`}
              style={{
                left: `${u.x}%`,
                top: `${u.y}%`,
                zIndex: Math.round(u.y) + 20
              }}
            >
              {/* CC and Stealth Status */}
              {u.stun > 0 && (
                <div className="bg-yellow-400 text-slate-950 text-[8px] font-black px-1.5 py-0.2 rounded-full uppercase animate-bounce mb-0.5">
                  STUNNED
                </div>
              )}
              {u.charm > 0 && (
                <div className="bg-pink-500 text-white text-[8px] font-black px-1.5 py-0.2 rounded-full uppercase animate-bounce mb-0.5">
                  CHARMED 💖
                </div>
              )}
              {u.isInBush && (
                <div className="bg-emerald-600 text-white text-[7px] font-bold px-1 rounded-full flex items-center gap-0.5 mb-0.5">
                  <EyeOff className="w-2 h-2" /> Stealthed
                </div>
              )}

              {/* Health & Shield Bar */}
              <div className="w-12 h-1.5 bg-slate-900 border border-black rounded-full overflow-hidden mb-1">
                <div
                  className={`h-full ${u.team === 'blue' ? 'bg-cyan-400' : 'bg-rose-500'}`}
                  style={{ width: `${(u.hp / u.maxHp) * 100}%` }}
                />
              </div>

              {/* Chibi Character Portrait */}
              <div
                className={`relative rounded-full p-0.5 border-2 ${
                  u.team === 'blue'
                    ? 'border-cyan-400 shadow-[0_0_12px_rgba(6,182,212,0.8)]'
                    : 'border-rose-400 shadow-[0_0_12px_rgba(244,63,94,0.8)]'
                }`}
                style={{ backgroundColor: u.champion.primaryColor }}
              >
                <ChibiAvatar avatarType={u.player.avatarSvg} size={38} />
                <div className="absolute -bottom-1 -right-1 text-[8px] bg-slate-900 text-white px-1 rounded-full font-bold border border-white/20">
                  {u.champion.name[0]}
                </div>
              </div>

              <span className="text-[9px] font-bold text-white drop-shadow mt-0.5 whitespace-nowrap">
                {u.player.name}
              </span>
            </div>
          );
        })}

        {/* Floating Combat Damage Numbers */}
        {damageFloats.map((f) => (
          <div
            key={f.id}
            className="absolute text-xs font-black drop-shadow-md pointer-events-none transition-all duration-75 transform -translate-x-1/2 z-40"
            style={{
              left: `${f.x}%`,
              top: `${f.y}%`,
              color: f.color,
              opacity: f.opacity
            }}
          >
            {f.text}
          </div>
        ))}
      </div>

      {/* COACH TACTICS & SPEED CONTROLS */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 flex flex-wrap justify-between items-center gap-3">
        <div className="flex items-center gap-2">
          <span className="text-xs font-black uppercase text-amber-300 flex items-center gap-1">
            <Swords className="w-4 h-4" />
            Tactical Orders:
          </span>
          <button
            onClick={() => triggerCoachTactic('focus')}
            disabled={matchOver}
            className="px-3 py-1.5 bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold rounded-xl transition shadow flex items-center gap-1"
          >
            <Flame className="w-3.5 h-3.5" />
            Focus Carry!
          </button>
          <button
            onClick={() => triggerCoachTactic('sync')}
            disabled={matchOver}
            className="px-3 py-1.5 bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold rounded-xl transition shadow flex items-center gap-1"
          >
            <Zap className="w-3.5 h-3.5" />
            Sync Ultimates!
          </button>
          <button
            onClick={() => triggerCoachTactic('retreat')}
            disabled={matchOver}
            className="px-3 py-1.5 bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-bold rounded-xl transition shadow flex items-center gap-1"
          >
            <ShieldAlert className="w-3.5 h-3.5" />
            Tower Fortify
          </button>
        </div>

        {/* Speed Controls */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => setPaused(!paused)}
            className="p-2 bg-slate-800 hover:bg-slate-700 text-white rounded-lg transition"
          >
            {paused ? <Play className="w-4 h-4" /> : <Pause className="w-4 h-4" />}
          </button>
          {[1, 2, 4].map((s) => (
            <button
              key={s}
              onClick={() => setSpeed(s)}
              className={`px-3 py-1 text-xs font-bold rounded-lg transition ${
                speed === s
                  ? 'bg-amber-400 text-slate-950 font-black'
                  : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
              }`}
            >
              {s}x
            </button>
          ))}
        </div>
      </div>

      {/* Live Commentary Log */}
      <div className="bg-slate-950 border border-slate-800/80 rounded-2xl p-4 max-h-32 overflow-y-auto font-mono text-xs text-slate-300 space-y-1">
        {combatLogs.map((log, i) => (
          <div key={i} className="border-l-2 border-slate-700 pl-2">
            {log}
          </div>
        ))}
      </div>
    </div>
  );
};
