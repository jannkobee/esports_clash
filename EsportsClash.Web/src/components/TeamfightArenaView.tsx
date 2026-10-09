import React, { useEffect, useRef, useState } from 'react';
import { ChampionKit, CoachCard, PlayerCard } from '../types';
import { ChibiAvatar } from './ChibiAvatar';
import { drawChampionSprite } from './ChampionSpriteRenderer';
import { sound } from '../audio';
import confetti from 'canvas-confetti';
import { 
  Play, 
  Pause, 
  Swords, 
  Flame, 
  Zap, 
  ShieldAlert,
  Heart
} from 'lucide-react';

interface ChampionFighter {
  id: string;
  player: PlayerCard;
  champion: ChampionKit;
  team: 'blue' | 'red';
  x: number;
  y: number;
  vx: number;
  vy: number;
  hp: number;
  maxHp: number;
  mana: number; // 0 to 100
  shield: number;
  attackTimer: number;
  cd1: number;
  cd2: number;
  stunTimer: number;
  charmTimer: number;
  isInBush: boolean;
  kills: number;
  deaths: number;
  assists: number;
  damageDealt: number;
  damageTaken: number;
  isAlive: boolean;
  facing: 'left' | 'right';
  animState: 'idle' | 'walk' | 'attack' | 'cast' | 'dead';
  animTimer: number;
}

interface Projectile {
  id: string;
  x: number;
  y: number;
  targetX: number;
  targetY: number;
  speed: number;
  color: string;
  type: 'arrow' | 'orb' | 'pellet' | 'laser';
  size: number;
}

interface SpellAOE {
  id: string;
  type: 'solar_flare' | 'smoke_screen' | 'chain_whirl' | 'charm_heart';
  x: number;
  y: number;
  radius: number;
  duration: number;
  maxDuration: number;
  color: string;
}

interface FloatingCombatText {
  id: string;
  x: number;
  y: number;
  text: string;
  color: string;
  opacity: number;
  scale: number;
}

interface KillFeedEntry {
  id: string;
  killer: string;
  killerChamp: string;
  victim: string;
  victimChamp: string;
  killerTeam: 'blue' | 'red';
}

interface TeamfightArenaViewProps {
  blueLineup: { player: PlayerCard; champion: ChampionKit }[];
  redLineup: { player: PlayerCard; champion: ChampionKit }[];
  blueCoach?: CoachCard;
  redCoach?: CoachCard;
  onMatchComplete: (winner: 'blue' | 'red', mvp: any, stats: any[]) => void;
}

export const TeamfightArenaView: React.FC<TeamfightArenaViewProps> = ({
  blueLineup,
  redLineup,
  blueCoach,
  onMatchComplete
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [speed, setSpeed] = useState<number>(1);
  const [paused, setPaused] = useState<boolean>(false);
  const [matchTime, setMatchTime] = useState<number>(0);
  const [matchOver, setMatchOver] = useState<boolean>(false);

  // Score & Kill Feed
  const [blueScore, setBlueScore] = useState<number>(0);
  const [redScore, setRedScore] = useState<number>(0);
  const [killFeed, setKillFeed] = useState<KillFeedEntry[]>([]);

  // Units State for Left & Right Panels
  const [fighters, setFighters] = useState<ChampionFighter[]>([]);
  const fightersRef = useRef<ChampionFighter[]>([]);
  const projectilesRef = useRef<Projectile[]>([]);
  const spellsRef = useRef<SpellAOE[]>([]);
  const floatsRef = useRef<FloatingCombatText[]>([]);

  // Turret Healths
  const [blueTowerHp, setBlueTowerHp] = useState<number>(3000);
  const [redTowerHp, setRedTowerHp] = useState<number>(3000);

  // Initialize Fighters
  useEffect(() => {
    const blueFighters: ChampionFighter[] = blueLineup.map((item, idx) => ({
      id: `b_${item.player.id}_${idx}`,
      player: item.player,
      champion: item.champion,
      team: 'blue',
      x: 180 + (idx % 2) * 45,
      y: 190 + idx * 55,
      vx: 0,
      vy: 0,
      hp: item.champion.hp * (1 + (item.player.stats.sta - 50) * 0.006),
      maxHp: item.champion.hp * (1 + (item.player.stats.sta - 50) * 0.006),
      mana: 25 + Math.random() * 20,
      shield: 0,
      attackTimer: 0,
      cd1: 1,
      cd2: 3,
      stunTimer: 0,
      charmTimer: 0,
      isInBush: false,
      kills: 0,
      deaths: 0,
      assists: 0,
      damageDealt: 0,
      damageTaken: 0,
      isAlive: true,
      facing: 'right',
      animState: 'idle',
      animTimer: Math.random() * 5
    }));

    const redFighters: ChampionFighter[] = redLineup.map((item, idx) => ({
      id: `r_${item.player.id}_${idx}`,
      player: item.player,
      champion: item.champion,
      team: 'red',
      x: 620 - (idx % 2) * 45,
      y: 190 + idx * 55,
      vx: 0,
      vy: 0,
      hp: item.champion.hp * (1 + (item.player.stats.sta - 50) * 0.006),
      maxHp: item.champion.hp * (1 + (item.player.stats.sta - 50) * 0.006),
      mana: 25 + Math.random() * 20,
      shield: 0,
      attackTimer: 0,
      cd1: 1,
      cd2: 3,
      stunTimer: 0,
      charmTimer: 0,
      isInBush: false,
      kills: 0,
      deaths: 0,
      assists: 0,
      damageDealt: 0,
      damageTaken: 0,
      isAlive: true,
      facing: 'left',
      animState: 'idle',
      animTimer: Math.random() * 5
    }));

    const all = [...blueFighters, ...redFighters];
    fightersRef.current = all;
    setFighters(all);
  }, []);

  // 60 FPS Canvas Game Loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationId: number;
    let lastTime = performance.now();

    const loop = (time: number) => {
      animationId = requestAnimationFrame(loop);

      const rawDt = (time - lastTime) / 1000;
      lastTime = time;
      const dt = Math.min(0.1, rawDt) * (paused || matchOver ? 0 : speed);

      if (dt > 0) {
        setMatchTime((t) => t + dt);
        updateCombatSimulation(dt);
      }

      drawLeagueAramMap(ctx, canvas.width, canvas.height, time / 1000);
    };

    animationId = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(animationId);
  }, [paused, speed, matchOver]);

  // Main Combat Simulation Step
  const updateCombatSimulation = (dt: number) => {
    const units = fightersRef.current;

    // 1. Update Projectiles
    projectilesRef.current = projectilesRef.current
      .map((p) => {
        const dx = p.targetX - p.x;
        const dy = p.targetY - p.y;
        const dist = Math.hypot(dx, dy);
        if (dist < 15) return null; // Hit target
        const vx = (dx / dist) * p.speed * dt;
        const vy = (dy / dist) * p.speed * dt;
        return { ...p, x: p.x + vx, y: p.y + vy };
      })
      .filter((p): p is Projectile => p !== null);

    // 2. Update Spell AOEs
    spellsRef.current = spellsRef.current
      .map((s) => ({ ...s, duration: s.duration - dt }))
      .filter((s) => s.duration > 0);

    // 3. Update Floating Combat Numbers
    floatsRef.current = floatsRef.current
      .map((f) => ({ ...f, y: f.y - 28 * dt, opacity: f.opacity - 1.2 * dt }))
      .filter((f) => f.opacity > 0);

    // 4. Update Each Living Champion
    units.forEach((u) => {
      if (!u.isAlive) return;

      u.animTimer += dt;

      // Status Timers
      if (u.stunTimer > 0) u.stunTimer = Math.max(0, u.stunTimer - dt);
      if (u.charmTimer > 0) u.charmTimer = Math.max(0, u.charmTimer - dt);
      if (u.attackTimer > 0) u.attackTimer = Math.max(0, u.attackTimer - dt);
      if (u.cd1 > 0) u.cd1 = Math.max(0, u.cd1 - dt);
      if (u.cd2 > 0) u.cd2 = Math.max(0, u.cd2 - dt);

      // Mana Regen
      u.mana = Math.min(100, u.mana + 14 * dt);

      // Bush Detection: Upper Bush (x: 360-440, y: 140-200) or Lower Bush (x: 360-440, y: 360-420)
      const inUpper = u.x >= 350 && u.x <= 450 && u.y >= 140 && u.y <= 210;
      const inLower = u.x >= 350 && u.x <= 450 && u.y >= 350 && u.y <= 420;
      u.isInBush = inUpper || inLower;

      if (u.stunTimer > 0 || u.charmTimer > 0) {
        u.animState = 'idle';
        return;
      }

      // Find Closest Living Enemy Target
      const enemies = units.filter((e) => e.team !== u.team && e.isAlive);
      if (enemies.length === 0) return;

      const target = enemies.sort((a, b) => Math.hypot(a.x - u.x, a.y - u.y) - Math.hypot(b.x - u.x, b.y - u.y))[0];
      const dist = Math.hypot(target.x - u.x, target.y - u.y);
      const attackRange = u.champion.range * 30;

      u.facing = target.x > u.x ? 'right' : 'left';

      // Ultimate Cast (100 Mana)
      if (u.mana >= 100) {
        u.mana = 0;
        u.animState = 'cast';
        castChampionUltimate(u, target, enemies);
      }
      // Skill 1 Cast
      else if (u.cd1 <= 0 && dist <= attackRange * 1.5) {
        u.cd1 = u.champion.skill1.cooldown;
        u.mana = Math.min(100, u.mana + 15);
        u.animState = 'cast';
        castChampionSkill1(u, target);
      }
      // Basic Attack in Range
      else if (dist <= attackRange) {
        u.vx = 0;
        u.vy = 0;
        if (u.attackTimer <= 0) {
          u.attackTimer = 1.0 / Math.max(0.5, u.champion.aspd);
          u.animState = 'attack';
          u.mana = Math.min(100, u.mana + 18);
          performBasicAttack(u, target);
        } else if (u.attackTimer <= 1.0 / Math.max(0.5, u.champion.aspd) - 0.28) {
          u.animState = 'idle';
        }
      }
      // Move Toward Target
      else {
        u.animState = 'walk';
        const moveSpeed = 85;
        const angle = Math.atan2(target.y - u.y, target.x - u.x);
        u.vx = Math.cos(angle) * moveSpeed;
        u.vy = Math.sin(angle) * moveSpeed;
        u.x += u.vx * dt;
        u.y += u.vy * dt;

        // Bridge Bounds (Keep on stone bridge)
        u.x = Math.max(140, Math.min(660, u.x));
        u.y = Math.max(150, Math.min(410, u.y));
      }
    });

    // Check Victory Condition
    const blueAlive = units.filter((u) => u.team === 'blue' && u.isAlive).length;
    const redAlive = units.filter((u) => u.team === 'red' && u.isAlive).length;

    if (redAlive === 0 && !matchOver) {
      endMatch('blue');
    } else if (blueAlive === 0 && !matchOver) {
      endMatch('red');
    }

    setFighters([...units]);
  };

  // Basic Attack with Champion Projectiles
  const performBasicAttack = (u: ChampionFighter, target: ChampionFighter) => {
    // Projectiles for ranged champions
    if (u.champion.name === 'Astra') {
      sound.playSpellHit();
      projectilesRef.current.push({
        id: Math.random().toString(),
        x: u.x,
        y: u.y - 12,
        targetX: target.x,
        targetY: target.y - 12,
        speed: 400,
        color: '#38bdf8',
        type: 'arrow',
        size: 3
      });
    } else if (u.champion.name === 'Buck') {
      sound.playSpellHit();
      for (let i = -1; i <= 1; i++) {
        projectilesRef.current.push({
          id: Math.random().toString(),
          x: u.x,
          y: u.y - 12,
          targetX: target.x + i * 10,
          targetY: target.y - 12 + i * 8,
          speed: 450,
          color: '#f97316',
          type: 'pellet',
          size: 2.5
        });
      }
    } else if (u.champion.name === 'Kyumi') {
      sound.playSpellHit();
      projectilesRef.current.push({
        id: Math.random().toString(),
        x: u.x,
        y: u.y - 14,
        targetX: target.x,
        targetY: target.y - 12,
        speed: 350,
        color: '#ec4899',
        type: 'orb',
        size: 4
      });
    }

    applyDamage(u, target, u.champion.ad);
  };

  // Skill 1 Cast
  const castChampionSkill1 = (u: ChampionFighter, target: ChampionFighter) => {
    sound.playSpellHit();

    if (u.champion.name === 'Solana') {
      target.stunTimer = 1.2;
      u.shield += 180;
      spellsRef.current.push({
        id: Math.random().toString(),
        type: 'solar_flare',
        x: target.x,
        y: target.y,
        radius: 35,
        duration: 0.5,
        maxDuration: 0.5,
        color: '#fde047'
      });
      applyDamage(u, target, u.champion.skill1.damage, '☀️ Shieldbash');
    } else if (u.champion.name === 'Astra') {
      // 5-Arrow Frost Flurry spread
      for (let i = -2; i <= 2; i++) {
        projectilesRef.current.push({
          id: Math.random().toString(),
          x: u.x,
          y: u.y - 12,
          targetX: target.x + i * 12,
          targetY: target.y - 12 + i * 10,
          speed: 480,
          color: '#7dd3fc',
          type: 'arrow',
          size: 3
        });
      }
      applyDamage(u, target, u.champion.skill1.damage, '❄️ Volley');
    } else if (u.champion.name === 'Kyumi') {
      // True Damage Orb of Illusion
      projectilesRef.current.push({
        id: Math.random().toString(),
        x: u.x,
        y: u.y - 14,
        targetX: target.x,
        targetY: target.y - 12,
        speed: 380,
        color: '#67e8f9',
        type: 'orb',
        size: 6
      });
      applyDamage(u, target, u.champion.skill1.damage, '🔮 True Orb');
    } else if (u.champion.name === 'Buck') {
      spellsRef.current.push({
        id: Math.random().toString(),
        type: 'smoke_screen',
        x: target.x,
        y: target.y,
        radius: 45,
        duration: 1.0,
        maxDuration: 1.0,
        color: '#78716c'
      });
      applyDamage(u, target, u.champion.skill1.damage, '💥 Powder Keg');
    } else if (u.champion.name === 'Valkira') {
      spellsRef.current.push({
        id: Math.random().toString(),
        type: 'chain_whirl',
        x: u.x,
        y: u.y,
        radius: 50,
        duration: 0.6,
        maxDuration: 0.6,
        color: '#dc2626'
      });
      applyDamage(u, target, u.champion.skill1.damage, '⚔️ Crescent Cleave');
    }
  };

  // Ultimate Cast
  const castChampionUltimate = (u: ChampionFighter, target: ChampionFighter, enemies: ChampionFighter[]) => {
    sound.playUltimateExplosion();

    if (u.champion.name === 'Solana') {
      // Giant Golden Daybreak Flare Solar Beam
      spellsRef.current.push({
        id: Math.random().toString(),
        type: 'solar_flare',
        x: target.x,
        y: target.y,
        radius: 90,
        duration: 1.2,
        maxDuration: 1.2,
        color: '#f59e0b'
      });
      enemies.forEach((e) => {
        if (Math.hypot(e.x - target.x, e.y - target.y) <= 90) {
          e.stunTimer = 2.0;
          applyDamage(u, e, u.champion.ultimate.damage * 0.8, '☀️ Daybreak Flare');
        }
      });
    } else if (u.champion.name === 'Astra') {
      // Giant Crystal Arrow Snipe
      projectilesRef.current.push({
        id: Math.random().toString(),
        x: u.x,
        y: u.y - 12,
        targetX: target.x,
        targetY: target.y - 12,
        speed: 550,
        color: '#38bdf8',
        type: 'arrow',
        size: 8
      });
      target.stunTimer = 2.5;
      applyDamage(u, target, u.champion.ultimate.damage, '🏹 Crystal Comet');
    } else if (u.champion.name === 'Kyumi') {
      // Charm of Longing Heart + Spirit Rush
      target.charmTimer = 1.5;
      spellsRef.current.push({
        id: Math.random().toString(),
        type: 'charm_heart',
        x: target.x,
        y: target.y - 20,
        radius: 30,
        duration: 1.2,
        maxDuration: 1.2,
        color: '#ec4899'
      });
      applyDamage(u, target, u.champion.ultimate.damage, '💖 Spirit Rush');
    } else if (u.champion.name === 'Buck') {
      // Collateral Blast Recoil
      spellsRef.current.push({
        id: Math.random().toString(),
        type: 'smoke_screen',
        x: u.x,
        y: u.y,
        radius: 80,
        duration: 0.8,
        maxDuration: 0.8,
        color: '#ea580c'
      });
      applyDamage(u, target, u.champion.ultimate.damage, '💥 Collateral Blast');
    } else if (u.champion.name === 'Valkira') {
      // Executioner's Descent
      spellsRef.current.push({
        id: Math.random().toString(),
        type: 'chain_whirl',
        x: target.x,
        y: target.y,
        radius: 70,
        duration: 0.9,
        maxDuration: 0.9,
        color: '#991b1b'
      });
      applyDamage(u, target, u.champion.ultimate.damage * 1.3, '🩸 Executioner Descent');
    }
  };

  const applyDamage = (attacker: ChampionFighter, target: ChampionFighter, rawDamage: number, label?: string) => {
    let effective = rawDamage * (100 / (100 + target.champion.armor));

    // Ambush Crit from Bush
    if (attacker.isInBush) {
      effective *= 1.25;
      label = `AMBUSH! ${label || ''}`;
    }

    const finalDamage = Math.round(effective);
    target.hp = Math.max(0, target.hp - finalDamage);
    target.damageTaken += finalDamage;
    attacker.damageDealt += finalDamage;

    // Floating combat numbers
    floatsRef.current.push({
      id: Math.random().toString(),
      x: target.x + (Math.random() - 0.5) * 20,
      y: target.y - 28,
      text: label ? `${label} -${finalDamage}` : `-${finalDamage}`,
      color: attacker.team === 'blue' ? '#38bdf8' : '#f43f5e',
      opacity: 1,
      scale: label ? 1.3 : 1.0
    });

    if (target.hp <= 0 && target.isAlive) {
      target.isAlive = false;
      target.deaths++;
      attacker.kills++;

      if (attacker.team === 'blue') setBlueScore((s) => s + 1);
      else setRedScore((s) => s + 1);

      setKillFeed((feed) => [
        {
          id: Math.random().toString(),
          killer: attacker.player.name,
          killerChamp: attacker.champion.name,
          victim: target.player.name,
          victimChamp: target.champion.name,
          killerTeam: attacker.team
        },
        ...feed.slice(0, 3)
      ]);
    }
  };

  const endMatch = (winTeam: 'blue' | 'red') => {
    setMatchOver(true);
    sound.playWalkoutFanfare();
    confetti({ particleCount: 180, spread: 100, origin: { y: 0.5 } });

    const all = fightersRef.current;
    const mvp = all.sort((a, b) => b.kills * 5 + b.damageDealt / 200 - a.kills * 5 - a.damageDealt / 200)[0];
    onMatchComplete(winTeam, mvp, all);
  };

  // Draw Authentic League of Legends Howling Abyss ARAM Map
  const drawLeagueAramMap = (ctx: CanvasRenderingContext2D, width: number, height: number, time: number) => {
    ctx.clearRect(0, 0, width, height);

    // 1. Deep Blue Snowy Abyss (Top & Bottom Chasm)
    ctx.fillStyle = '#060f1e';
    ctx.fillRect(0, 0, width, height);

    // Falling Snowflakes in the Abyss
    ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
    for (let i = 0; i < 40; i++) {
      const sx = ((i * 37 + time * 20) % width);
      const sy = ((i * 53 + time * 35) % height);
      ctx.fillRect(sx, sy, 1.5, 1.5);
    }

    // 2. The Howling Abyss Stone Bridge Deck
    // Bridge Stone Base
    ctx.fillStyle = '#1e293b';
    ctx.fillRect(100, 130, 600, 300);

    // Bridge Guardrails & Stone Tiles
    ctx.fillStyle = '#334155';
    ctx.fillRect(110, 140, 580, 280);

    // Center Stone Pavement with Freljordian Runes
    ctx.fillStyle = '#1e293b';
    ctx.fillRect(130, 250, 540, 60);

    // Center Circular Arena / Mayhem Altar
    ctx.strokeStyle = '#475569';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(400, 280, 80, 0, Math.PI * 2);
    ctx.stroke();

    ctx.strokeStyle = '#06b6d4';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(400, 280, 45, 0, Math.PI * 2);
    ctx.stroke();

    // 3. Torches & Braziers along Bridge Guardrails (Matching Reference Image)
    const torchOffsets = [150, 260, 370, 480, 590];
    torchOffsets.forEach((tx) => {
      // Top Railing Torches
      ctx.fillStyle = '#0f172a';
      ctx.fillRect(tx - 6, 128, 12, 14);
      // Flame Glow
      ctx.fillStyle = '#ea580c';
      ctx.beginPath();
      ctx.arc(tx, 128 + Math.sin(time * 8 + tx) * 2, 5, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#fef08a';
      ctx.beginPath();
      ctx.arc(tx, 128, 2.5, 0, Math.PI * 2);
      ctx.fill();

      // Bottom Railing Torches
      ctx.fillStyle = '#0f172a';
      ctx.fillRect(tx - 6, 418, 12, 14);
      ctx.fillStyle = '#ea580c';
      ctx.beginPath();
      ctx.arc(tx, 428 + Math.sin(time * 8 + tx) * 2, 5, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#fef08a';
      ctx.beginPath();
      ctx.arc(tx, 428, 2.5, 0, Math.PI * 2);
      ctx.fill();
    });

    // 4. Ambush Winter Bushes (Upper & Lower)
    // Upper Frost Bush
    ctx.fillStyle = '#475569';
    ctx.beginPath();
    ctx.ellipse(400, 165, 45, 18, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#94a3b8';
    ctx.font = 'bold 9px sans-serif';
    ctx.fillText('🌿 Frost Bush', 375, 168);

    // Lower Frost Bush
    ctx.fillStyle = '#475569';
    ctx.beginPath();
    ctx.ellipse(400, 395, 45, 18, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillText('🌿 Frost Bush', 375, 398);

    // 5. Health Relic Shrines on Bridge
    const drawRelic = (rx: number, ry: number) => {
      ctx.fillStyle = '#0f172a';
      ctx.beginPath();
      ctx.arc(rx, ry, 14, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#10b981';
      ctx.lineWidth = 2;
      ctx.stroke();

      // Floating Health Plus / Crystal
      ctx.fillStyle = '#34d399';
      ctx.beginPath();
      ctx.arc(rx, ry + Math.sin(time * 4) * 3, 5, 0, Math.PI * 2);
      ctx.fill();
    };
    drawRelic(260, 280);
    drawRelic(540, 280);

    // 6. Blue & Red Outer Turrets with Glowing Crystal Heads
    // Blue Turret (Left)
    ctx.fillStyle = '#1e293b';
    ctx.fillRect(115, 255, 20, 50);
    ctx.fillStyle = '#0284c7';
    ctx.beginPath();
    ctx.arc(125, 250, 9, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#38bdf8';
    ctx.beginPath();
    ctx.arc(125, 250, 4, 0, Math.PI * 2);
    ctx.fill();

    // Red Turret (Right)
    ctx.fillStyle = '#1e293b';
    ctx.fillRect(665, 255, 20, 50);
    ctx.fillStyle = '#be123c';
    ctx.beginPath();
    ctx.arc(675, 250, 9, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#f43f5e';
    ctx.beginPath();
    ctx.arc(675, 250, 4, 0, Math.PI * 2);
    ctx.fill();

    // 7. Draw Active Spell AOEs (Giant Solar Flare, Smoke Screen, etc.)
    spellsRef.current.forEach((s) => {
      const alpha = s.duration / s.maxDuration;
      ctx.save();
      ctx.strokeStyle = s.color;
      ctx.lineWidth = 4;
      ctx.globalAlpha = alpha;
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.radius, 0, Math.PI * 2);
      ctx.stroke();

      ctx.fillStyle = s.color;
      ctx.globalAlpha = alpha * 0.25;
      ctx.fill();
      ctx.restore();
    });

    // 8. Draw Flying Projectiles (Ice Arrows, Shotgun Pellets, Orbs)
    projectilesRef.current.forEach((p) => {
      ctx.save();
      ctx.fillStyle = p.color;
      ctx.shadowColor = p.color;
      ctx.shadowBlur = 8;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    });

    // 9. DRAW ACTUAL DETAILED CHAMPIONS USING ChampionSpriteRenderer
    const sortedUnits = [...fightersRef.current].sort((a, b) => a.y - b.y);

    sortedUnits.forEach((u) => {
      if (!u.isAlive) {
        // Draw Tombstone
        ctx.fillStyle = '#64748b';
        ctx.fillRect(u.x - 7, u.y - 10, 14, 10);
        return;
      }

      // Draw the Authentic Champion Sprite
      drawChampionSprite(ctx, {
        championName: u.champion.name,
        x: u.x,
        y: u.y,
        facing: u.facing,
        animState: u.animState,
        animTime: u.animTimer,
        team: u.team,
        isStunned: u.stunTimer > 0,
        isCharmed: u.charmTimer > 0,
        isInBush: u.isInBush
      });

      // Overhead League-Style Health Bar (Enlarged)
      const barWidth = 56;
      const barHeight = 7;
      const barX = u.x - barWidth / 2;
      const barY = u.y - 46;

      // Level Badge on Left (14x14)
      const lvlSize = 14;
      ctx.fillStyle = '#0f172a';
      ctx.fillRect(barX - lvlSize - 2, barY - 2, lvlSize, lvlSize);
      ctx.strokeStyle = '#38bdf8';
      ctx.lineWidth = 1;
      ctx.strokeRect(barX - lvlSize - 2, barY - 2, lvlSize, lvlSize);
      ctx.fillStyle = '#fde047';
      ctx.font = 'bold 9px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(`${u.player.level}`, barX - lvlSize / 2 - 2, barY + lvlSize - 4.5);

      // HP Bar Background
      ctx.fillStyle = '#020617';
      ctx.fillRect(barX, barY, barWidth, barHeight);

      // Current HP
      const hpPct = Math.max(0, u.hp / u.maxHp);
      ctx.fillStyle = u.team === 'blue' ? '#38bdf8' : '#f43f5e';
      ctx.fillRect(barX + 0.5, barY + 0.5, (barWidth - 1) * hpPct, barHeight - 1);

      // Mana Bar
      ctx.fillStyle = '#020617';
      ctx.fillRect(barX, barY + barHeight + 1.5, barWidth, 2.5);
      ctx.fillStyle = '#eab308';
      ctx.fillRect(barX + 0.5, barY + barHeight + 1.5, (barWidth - 1) * (u.mana / 100), 2);

      // Champion & Athlete Name Tag
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 9px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(u.player.name, u.x, barY - 3);
    });

    // 10. Draw Floating Combat Text
    floatsRef.current.forEach((f) => {
      ctx.save();
      ctx.globalAlpha = f.opacity;
      ctx.fillStyle = f.color;
      ctx.font = `bold ${Math.round(11 * f.scale)}px sans-serif`;
      ctx.textAlign = 'center';
      ctx.shadowColor = '#000000';
      ctx.shadowBlur = 4;
      ctx.fillText(f.text, f.x, f.y);
      ctx.restore();
    });
  };

  const triggerTactic = (type: 'focus' | 'sync' | 'shield') => {
    sound.playClick();
    if (type === 'focus') {
      fightersRef.current.filter((u) => u.team === 'blue').forEach((u) => { u.cd1 = 0; u.cd2 = 0; });
    } else if (type === 'sync') {
      fightersRef.current.filter((u) => u.team === 'blue').forEach((u) => { u.mana = 100; });
    } else {
      fightersRef.current.filter((u) => u.team === 'blue').forEach((u) => { u.shield += 250; });
    }
  };

  const blueUnits = fighters.filter((u) => u.team === 'blue');
  const redUnits = fighters.filter((u) => u.team === 'red');

  return (
    <div className="space-y-4 animate-fade-in max-w-7xl mx-auto">
      {/* ======================================================== */}
      {/* LEAGUE OF LEGENDS ARAM BROADCAST SCOREBOARD */}
      {/* ======================================================== */}
      <div className="bg-slate-900 border-2 border-slate-700 rounded-2xl p-3 shadow-2xl flex justify-between items-center relative overflow-hidden">
        {/* Blue Squad Info */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-cyan-600 rounded-xl flex items-center justify-center font-black text-white text-xl shadow">
            🛡️
          </div>
          <div>
            <h2 className="text-lg font-black text-cyan-400">T-CHIBI SQUAD</h2>
            <div className="text-[10px] text-slate-400">Coach: {blueCoach?.name || 'KkOpa'} ({blueCoach?.style || 'Macro'})</div>
          </div>
        </div>

        {/* Center Live Scoreboard & Killfeed Banner */}
        <div className="flex flex-col items-center">
          <div className="flex items-center bg-slate-950 px-6 py-1.5 rounded-xl border border-slate-700 gap-6">
            <span className="text-3xl font-black text-cyan-400 drop-shadow">{blueScore}</span>
            <div className="flex flex-col items-center">
              <Swords className="w-5 h-5 text-amber-400 animate-pulse" />
              <span className="text-[10px] text-amber-300 font-mono font-bold mt-0.5">
                {Math.floor(matchTime / 60)}:{(Math.floor(matchTime % 60)).toString().padStart(2, '0')}
              </span>
            </div>
            <span className="text-3xl font-black text-rose-400 drop-shadow">{redScore}</span>
          </div>

          {killFeed.length > 0 && (
            <div className="mt-1 flex items-center gap-2 bg-black/60 px-3 py-0.5 rounded-full text-[10px] font-bold border border-white/10 animate-fade-in">
              <span className={killFeed[0].killerTeam === 'blue' ? 'text-cyan-300' : 'text-rose-300'}>
                {killFeed[0].killer} ({killFeed[0].killerChamp})
              </span>
              <span className="text-amber-400">⚔️</span>
              <span className="text-slate-400">
                {killFeed[0].victim} ({killFeed[0].victimChamp})
              </span>
            </div>
          )}
        </div>

        {/* Red Squad Info */}
        <div className="flex items-center gap-3 text-right">
          <div>
            <h2 className="text-lg font-black text-rose-400">RIVAL POINTIFY</h2>
            <div className="text-[10px] text-slate-400">Split Challenger Match</div>
          </div>
          <div className="w-10 h-10 bg-rose-600 rounded-xl flex items-center justify-center font-black text-white text-xl shadow">
            ⚔️
          </div>
        </div>
      </div>

      {/* ======================================================== */}
      {/* 3-COLUMN MAIN BATTLE INTERFACE */}
      {/* ======================================================== */}
      <div className="grid grid-cols-12 gap-3 items-start">
        {/* LEFT BLUE 5-ATHLETE COLUMN */}
        <div className="col-span-3 space-y-2">
          <div className="text-xs font-black uppercase text-cyan-400 tracking-wider mb-1 flex items-center gap-1">
            <span>Blue Lineup ({blueUnits.filter((u) => u.isAlive).length}/5)</span>
          </div>
          {blueUnits.map((u) => (
            <div
              key={u.id}
              className={`bg-slate-900 border rounded-xl p-2.5 transition ${
                u.isAlive ? 'border-cyan-500/40 bg-slate-900' : 'border-slate-800 opacity-40 bg-slate-950'
              }`}
            >
              <div className="flex justify-between items-start mb-1">
                <div className="flex items-center gap-2">
                  <ChibiAvatar avatarType={u.player.avatarSvg} size={32} />
                  <div>
                    <div className="font-bold text-xs text-white leading-tight">{u.player.name}</div>
                    <div className="text-[10px] text-cyan-300 font-semibold">{u.champion.name} ({u.player.role})</div>
                  </div>
                </div>
                <span className="text-[10px] font-mono font-black text-amber-300">
                  {u.kills}/{u.deaths}
                </span>
              </div>

              <div className="w-full h-2 bg-slate-950 rounded-full overflow-hidden border border-black/40 mb-1">
                <div
                  className="h-full bg-cyan-400 transition-all duration-150"
                  style={{ width: `${Math.max(0, (u.hp / u.maxHp) * 100)}%` }}
                />
              </div>
              <div className="w-full h-1 bg-slate-950 rounded-full overflow-hidden border border-black/40">
                <div
                  className="h-full bg-yellow-400 transition-all duration-150"
                  style={{ width: `${u.mana}%` }}
                />
              </div>

              <div className="mt-1.5 flex justify-between text-[9px] text-slate-400 font-semibold">
                <span>Dmg: <strong className="text-white">{u.damageDealt}</strong></span>
                <span>Taken: <strong className="text-white">{u.damageTaken}</strong></span>
              </div>
            </div>
          ))}
        </div>

        {/* CENTER ACTUAL HOWLING ABYSS ARAM BATTLEGROUND CANVAS */}
        <div className="col-span-6 flex flex-col items-center">
          <div className="relative w-full rounded-2xl overflow-hidden border-4 border-slate-700 shadow-2xl bg-black">
            <canvas
              ref={canvasRef}
              width={800}
              height={560}
              className="w-full h-auto block cursor-crosshair"
            />
          </div>

          {/* Tactical Action & Speed Control Bar */}
          <div className="w-full mt-2 bg-slate-900 border border-slate-800 rounded-xl p-2.5 flex justify-between items-center">
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-black uppercase text-amber-300">Tactics:</span>
              <button
                onClick={() => triggerTactic('focus')}
                disabled={matchOver}
                className="px-2.5 py-1 bg-rose-600 hover:bg-rose-500 text-white text-[10px] font-bold rounded-lg shadow transition"
              >
                🔥 Focus Carry
              </button>
              <button
                onClick={() => triggerTactic('sync')}
                disabled={matchOver}
                className="px-2.5 py-1 bg-amber-500 hover:bg-amber-400 text-slate-950 text-[10px] font-bold rounded-lg shadow transition"
              >
                ⚡ Sync Ults
              </button>
              <button
                onClick={() => triggerTactic('shield')}
                disabled={matchOver}
                className="px-2.5 py-1 bg-cyan-600 hover:bg-cyan-500 text-white text-[10px] font-bold rounded-lg shadow transition"
              >
                🛡️ Shield
              </button>
            </div>

            <div className="flex items-center gap-1.5">
              <button
                onClick={() => setPaused(!paused)}
                className="p-1.5 bg-slate-800 hover:bg-slate-700 text-white rounded-lg transition"
              >
                {paused ? <Play className="w-3.5 h-3.5" /> : <Pause className="w-3.5 h-3.5" />}
              </button>
              {[1, 2, 4].map((s) => (
                <button
                  key={s}
                  onClick={() => setSpeed(s)}
                  className={`px-2 py-0.5 text-[10px] font-black rounded-lg transition ${
                    speed === s
                      ? 'bg-amber-400 text-slate-950'
                      : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                  }`}
                >
                  {s}x
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* RIGHT RED 5-ATHLETE COLUMN */}
        <div className="col-span-3 space-y-2">
          <div className="text-xs font-black uppercase text-rose-400 tracking-wider mb-1 flex items-center justify-end gap-1">
            <span>Red Lineup ({redUnits.filter((u) => u.isAlive).length}/5)</span>
          </div>
          {redUnits.map((u) => (
            <div
              key={u.id}
              className={`bg-slate-900 border rounded-xl p-2.5 transition ${
                u.isAlive ? 'border-rose-500/40 bg-slate-900' : 'border-slate-800 opacity-40 bg-slate-950'
              }`}
            >
              <div className="flex justify-between items-start mb-1">
                <span className="text-[10px] font-mono font-black text-amber-300">
                  {u.kills}/{u.deaths}
                </span>
                <div className="flex items-center gap-2 text-right">
                  <div>
                    <div className="font-bold text-xs text-white leading-tight">{u.player.name}</div>
                    <div className="text-[10px] text-rose-300 font-semibold">{u.champion.name} ({u.player.role})</div>
                  </div>
                  <ChibiAvatar avatarType={u.player.avatarSvg} size={32} />
                </div>
              </div>

              <div className="w-full h-2 bg-slate-950 rounded-full overflow-hidden border border-black/40 mb-1">
                <div
                  className="h-full bg-rose-500 transition-all duration-150"
                  style={{ width: `${Math.max(0, (u.hp / u.maxHp) * 100)}%` }}
                />
              </div>
              <div className="w-full h-1 bg-slate-950 rounded-full overflow-hidden border border-black/40">
                <div
                  className="h-full bg-yellow-400 transition-all duration-150"
                  style={{ width: `${u.mana}%` }}
                />
              </div>

              <div className="mt-1.5 flex justify-between text-[9px] text-slate-400 font-semibold">
                <span>Taken: <strong className="text-white">{u.damageTaken}</strong></span>
                <span>Dmg: <strong className="text-white">{u.damageDealt}</strong></span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
