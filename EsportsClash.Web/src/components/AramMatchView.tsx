import React, { useEffect, useRef, useState } from 'react';
import { 
  AramChampionUnit, 
  ChampionKit, 
  CoachCard, 
  HealthRelic, 
  ItemDef, 
  LaneMinion, 
  LaneStructure, 
  PlayerCard 
} from '../types';
import { ALL_ITEMS, getRecommendedItem } from '../itemsData';
import { getItemPurchasePlan } from '../itemStrategy';
import { aimAtCast, dodgeProbability, segmentHitsCircle } from '../skillshotRules';
import { AVATAR_COMBOS, comboPracticeNeeded } from '../avatarCombos';
import { drawChampionSprite } from './ChampionSpriteRenderer';
import { ChibiAvatar } from './ChibiAvatar';
import { sound } from '../audio';
import { chooseTeamfightTarget, shouldContestBoss, shouldUseSecondSkill, shouldUseSkill, shouldUseUltimate } from '../combatDecision';
import { ARENA_WIDTH, BARRACKS_X, DRAGON_X, LANE_Y, NEXUS_X, WELL_X, isMinionEmpowered, waveStats } from '../arenaRules';
import confetti from 'canvas-confetti';
import { 
  Play, 
  Pause, 
  Swords, 
  Shield, 
  Zap, 
  Coins, 
  Trophy, 
  Info, 
  X, 
  Sparkles,
  ArrowRight,
  Crosshair,
  TrendingUp,
  Skull,
  Maximize2,
  Minimize2
} from 'lucide-react';

interface Projectile {
  id: string;
  x: number;
  y: number;
  targetX: number;
  targetY: number;
  vx: number;
  vy: number;
  speed: number;
  color: string;
  type: 'arrow' | 'ult_arrow' | 'orb' | 'pellet' | 'laser' | 'turret_shot' | 'minion_shot' | 'boss_breath'
    | 'jungle_shot'
    | 'tornado' | 'shuriken' | 'feather' | 'nature_bolt' | 'boulder' | 'spirit_arrow' | 'poison_dart' | 'electric_spark' | 'seed_shot';
  size: number;
  targetUnitId?: string;
  damage: number;
  attackerId: string;
  angle: number;
  skillshot?: boolean;
  dodgeAttempted?: boolean;
  stunOnHit?: number;
  charmOnHit?: number;
  splashRadius?: number;
  healAlliesOnHit?: number;
  pullOnHit?: number;
  trueDamage?: boolean;
  skillLabel?: string;
  collisionRadius?: number;
  comboStage?: 1 | 2;
}

interface SpellAOE {
  id: string;
  type: 'solar_flare' | 'smoke_screen' | 'chain_whirl' | 'charm_heart' | 'boss_slam' | 'aegis_aura'
    | 'skill_burst' | 'ultimate_burst'
    | 'wind_wall' | 'death_mark' | 'lambs_respite' | 'shallow_grave' | 'sprout_ring' | 'sleight_circle'
    | 'ball_lightning' | 'magnetize_pulse' | 'grand_entrance' | 'static_remnant' | 'spirit_bear' | 'savage_roar';
  x: number;
  y: number;
  radius: number;
  duration: number;
  maxDuration: number;
  color: string;
  sourceUnitId?: string;
  targetUnitId?: string;
  extraText?: string;
  sourceX?: number;
  sourceY?: number;
}

interface FloatingText {
  id: string;
  x: number;
  y: number;
  text: string;
  color: string;
  opacity: number;
  scale: number;
}

interface MatchEvent {
  id: string;
  text: string;
  type: 'kill' | 'tower' | 'item' | 'level' | 'combo' | 'micro' | 'fountain' | 'dragon' | 'jungle';
  time: string;
}

interface ItemMilestone {
  playerName: string;
  champName: string;
  itemName: string;
  itemIcon: string;
  time: string;
  stats: string;
  team: 'blue' | 'red';
}

// Jungle Monster Entity for Level & Gold Farming
interface JungleCamp {
  id: string;
  name: string;
  type: 'golem' | 'wolves' | 'behemoth' | 'drakes';
  x: number;
  y: number;
  hp: number;
  maxHp: number;
  ad: number;
  range: number;
  goldReward: number;
  xpReward: number;
  respawnTimer: number;
  isAlive: boolean;
  attackTimer: number;
  targetId?: string;
  color: string;
}

// Epic Boss: Embermaw Dragon Pit at Top of Map
interface DragonBoss {
  id: string;
  name: string;
  x: number;
  y: number;
  hp: number;
  maxHp: number;
  ad: number;
  range: number;
  attackTimer: number;
  slamTimer: number;
  isAlive: boolean;
  spawnTimer: number;
  slayerTeam: 'blue' | 'red' | null;
  slainCount: number;
}

interface AegisBuff {
  team: 'blue' | 'red';
  expiresAt: number;
  adBonus: number;
}

export interface KillCallout {
  id: string;
  killerName: string;
  killerChamp: string;
  killerTeam: 'blue' | 'red';
  killerAvatar?: string;
  victimName: string;
  victimChamp: string;
  victimTeam: 'blue' | 'red';
  victimAvatar?: string;
  multiKill?: 'DOUBLE KILL' | 'TRIPLE KILL' | 'QUADRA KILL' | 'PENTA KILL' | null;
  streakText?: string | null;
  isFirstBlood?: boolean;
}

interface AramMatchViewProps {
  blueLineup: { player: PlayerCard; champion: ChampionKit }[];
  redLineup: { player: PlayerCard; champion: ChampionKit }[];
  blueCoach?: CoachCard;
  redCoach?: CoachCard;
  onMatchComplete: (winner: 'blue' | 'red', mvp: any, stats: any[]) => void;
}

// XP Threshold curve for Levels 3 to 18
function getXpThreshold(lvl: number): number {
  const table: { [key: number]: number } = {
    3: 0,
    4: 180,
    5: 380,
    6: 640,
    7: 960,
    8: 1350,
    9: 1800,
    10: 2320,
    11: 2920,
    12: 3600,
    13: 4360,
    14: 5200,
    15: 6120,
    16: 7120,
    17: 8200,
    18: 9380
  };
  return table[lvl] || 99999;
}

function getChampionAttackRange(champName: string): number {
  switch (champName) {
    case 'Senna': return 205;
    case 'Shadow Fiend': return 180;
    case 'Locke': return 125;
    case 'Largo': return 65;
    case 'Astra': return 195;
    case 'Tequoia': return 190;
    case 'Kindra':
    case 'Kindra & Grim': return 185;
    case 'Cora': return 180;
    case 'Zal': return 170;
    case 'Raijin': return 165;
    case 'Kyumi': return 145;
    case 'Sylla': return 130;
    case 'Buck': return 95;
    case 'Renn': return 65;
    case 'Kazemaru': return 55;
    case 'Inai': return 55;
    case 'Kage': return 50;
    case 'Xin': return 50;
    case 'Kaolin': return 50;
    case 'Valkira': return 50;
    case 'Solana': return 40;
    default: return 55;
  }
}

const FIRST_SKILLSHOTS: Record<string, Partial<Projectile>> = {
  Kyumi: { type: 'orb', speed: 390, size: 9, trueDamage: true },
  Buck: { type: 'pellet', speed: 420, size: 9, splashRadius: 55 },
  Kage: { type: 'shuriken', speed: 510, size: 8 },
  Kazemaru: { type: 'tornado', speed: 370, size: 14, stunOnHit: 1.5, collisionRadius: 23 },
  Kindra: { type: 'spirit_arrow', speed: 480, size: 7 },
  Cora: { type: 'feather', speed: 470, size: 7 },
  Tequoia: { type: 'nature_bolt', speed: 380, size: 10, stunOnHit: 1.3 },
  Zal: { type: 'poison_dart', speed: 450, size: 7 },
  Xin: { type: 'pellet', speed: 420, size: 8, stunOnHit: 1.2 },
  Kaolin: { type: 'boulder', speed: 380, size: 14, stunOnHit: 1.5, collisionRadius: 23 },
  Inai: { type: 'orb', speed: 400, size: 10, stunOnHit: 1.2 },
  Qiyana: { type: 'shuriken', speed: 480, size: 9, stunOnHit: 0.8 },
  Locke: { type: 'pellet', speed: 460, size: 8, splashRadius: 55 },
  Senna: { type: 'laser', speed: 550, size: 9, healAlliesOnHit: 110 },
  Largo: { type: 'nature_bolt', speed: 360, size: 10, stunOnHit: 0.7, pullOnHit: 35 },
  'Shadow Fiend': { type: 'orb', speed: 420, size: 11, splashRadius: 60 },
  Earthshaker: { type: 'boulder', speed: 350, size: 15, stunOnHit: 1.4, splashRadius: 65, collisionRadius: 26 },
};

function getChampionFormationY(champName: string, idx: number): number {
  switch (champName) {
    case 'Solana':
    case 'Kaolin': return 380;
    case 'Valkira':
    case 'Kazemaru':
    case 'Xin': return 420;
    case 'Buck':
    case 'Sylla':
    case 'Renn': return 340;
    case 'Kyumi':
    case 'Raijin':
    case 'Tequoia':
    case 'Zal': return 365;
    case 'Astra':
    case 'Cora':
    case 'Kindra':
    case 'Kindra & Grim': return 400;
    case 'Kage':
    case 'Inai': return 350;
    default: return 350 + (idx % 5) * 20;
  }
}

// MOBA Scaled Death Timer: Early game is brief (15-20s), but late game scales up to 60-75s so players fear death!
function calculateDeathTimer(level: number, currentMatchTime: number): number {
  const baseLevelTimer = 10 + level * 2.8; // lvl 3 = 18.4s, lvl 6 = 26.8s, lvl 11 = 40.8s, lvl 18 = 60.4s
  const matchMinute = currentMatchTime / 60;
  const timeScaling = 1.0 + Math.max(0, matchMinute - 1.5) * 0.14;
  const rawTimer = baseLevelTimer * timeScaling;
  return Math.min(75, Math.max(14, Math.round(rawTimer)));
}

export const AramMatchView: React.FC<AramMatchViewProps> = ({
  blueLineup,
  redLineup,
  blueCoach,
  onMatchComplete
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const matchRootRef = useRef<HTMLDivElement>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [fullscreenError, setFullscreenError] = useState(false);
  const [speed, setSpeed] = useState<number>(1);
  const [paused, setPaused] = useState<boolean>(false);
  const [matchTime, setMatchTime] = useState<number>(0);
  const [matchOver, setMatchOver] = useState<boolean>(false);

  useEffect(() => {
    const syncFullscreen = () => setIsFullscreen(document.fullscreenElement === matchRootRef.current);
    document.addEventListener('fullscreenchange', syncFullscreen);
    return () => document.removeEventListener('fullscreenchange', syncFullscreen);
  }, []);

  const toggleFullscreen = async () => {
    try {
      setFullscreenError(false);
      if (document.fullscreenElement === matchRootRef.current) await document.exitFullscreen();
      else await matchRootRef.current?.requestFullscreen();
    } catch {
      setFullscreenError(true);
    }
  };

  // Scoreboard Stats
  const [blueKills, setBlueKills] = useState<number>(0);
  const [redKills, setRedKills] = useState<number>(0);
  const [blueGold, setBlueGold] = useState<number>(7000);
  const [redGold, setRedGold] = useState<number>(7000);
  const [blueTowersAlive, setBlueTowersAlive] = useState<number>(3);
  const [redTowersAlive, setRedTowersAlive] = useState<number>(3);

  // Event feed & Power Spike banners
  const [eventFeed, setEventFeed] = useState<MatchEvent[]>([]);
  const [activeBanner, setActiveBanner] = useState<{ text: string; subtext: string; icon: string } | null>(null);
  const [killCallout, setKillCallout] = useState<KillCallout | null>(null);
  const [itemMilestones, setItemMilestones] = useState<ItemMilestone[]>([]);

  // Multikill & First Blood Tracking Refs
  const firstBloodRef = useRef<boolean>(false);
  const killStreaksRef = useRef<{ [champId: string]: { count: number; lastTime: number; multiCount: number } }>({});


  // Selected item modal for inspection
  const [inspectedItem, setInspectedItem] = useState<ItemDef | null>(null);

  // Units State for UI bottom bar
  const [champions, setChampions] = useState<AramChampionUnit[]>([]);

  // Simulation Refs
  const championsRef = useRef<AramChampionUnit[]>([]);
  const minionsRef = useRef<LaneMinion[]>([]);
  const structuresRef = useRef<LaneStructure[]>([]);
  const relicsRef = useRef<HealthRelic[]>([]);
  const projectilesRef = useRef<Projectile[]>([]);
  const spellsRef = useRef<SpellAOE[]>([]);
  const floatsRef = useRef<FloatingText[]>([]);
  const waveTimerRef = useRef<number>(2.0);
  const waveCountRef = useRef<number>(0);

  // Epic Dragon Boss Ref
  const dragonRef = useRef<DragonBoss>({
    id: 'dragon_boss',
    name: 'Embermaw, the Ancient Dragon',
    x: DRAGON_X,
    y: 130,
    hp: 9200,
    maxHp: 9200,
    ad: 110,
    range: 160,
    attackTimer: 0,
    slamTimer: 6.0,
    isAlive: true,
    spawnTimer: 0,
    slayerTeam: null,
    slainCount: 0
  });

  // 4 Neutral Jungle Camps across the map
  const jungleCampsRef = useRef<JungleCamp[]>([
    { id: 'j_blue_golem', name: 'Frost Sentinel', type: 'golem', x: 576, y: 170, hp: 1250, maxHp: 1250, ad: 42, range: 230, goldReward: 75, xpReward: 95, respawnTimer: 0, isAlive: true, attackTimer: 0, color: '#38bdf8' },
    { id: 'j_red_wolves', name: 'Shadow Stalkers', type: 'wolves', x: 1424, y: 170, hp: 1250, maxHp: 1250, ad: 42, range: 230, goldReward: 75, xpReward: 95, respawnTimer: 0, isAlive: true, attackTimer: 0, color: '#a855f7' },
    { id: 'j_blue_behemoth', name: 'Murk Behemoth', type: 'behemoth', x: 667, y: 575, hp: 1350, maxHp: 1350, ad: 46, range: 230, goldReward: 85, xpReward: 110, respawnTimer: 0, isAlive: true, attackTimer: 0, color: '#10b981' },
    { id: 'j_red_drakes', name: 'Crimson Drakes', type: 'drakes', x: 1333, y: 575, hp: 1350, maxHp: 1350, ad: 46, range: 230, goldReward: 85, xpReward: 110, respawnTimer: 0, isAlive: true, attackTimer: 0, color: '#ef4444' }
  ]);

  const aegisBuffRef = useRef<AegisBuff | null>(null);

  const showBanner = (text: string, subtext: string, icon: string) => {
    setActiveBanner({ text, subtext, icon });
    setTimeout(() => {
      setActiveBanner((curr) => (curr?.text === text ? null : curr));
    }, 4500);
  };

  const addEvent = (text: string, type: 'kill' | 'tower' | 'item' | 'level' | 'combo' | 'micro' | 'fountain' | 'dragon' | 'jungle') => {
    const mins = Math.floor(matchTime / 60);
    const secs = (Math.floor(matchTime % 60)).toString().padStart(2, '0');
    setEventFeed((prev) => [
      { id: Math.random().toString(), text, type, time: `${mins}:${secs}` },
      ...prev.slice(0, 18)
    ]);
  };

  // Helper: Initial item purchase (Buys Starter 500g + 1st Component 700-1000g right at match start!)
  const buyInitialLoadout = (role: any, startingGold: number, champName?: string): { items: ItemDef[]; remainingGold: number } => {
    const items: ItemDef[] = [];
    let g = startingGold;
    // 1. Buy Starter item (500g)
    const starter = getRecommendedItem(role, [], g, champName);
    if (starter) {
      items.push(starter);
      g -= starter.cost;
    }
    // 2. Buy initial component (700-1000g) with remaining gold
    const comp = getRecommendedItem(role, items.map((it) => it.id), g, champName);
    if (comp) {
      items.push(comp);
      g -= comp.cost;
    }
    return { items, remainingGold: g };
  };

  // Initialize Structures, Relics, and Champions
  useEffect(() => {
    // Three spaced turrets, three destructible barracks, and a nexus per side.
    const makeBarracks = (team: 'blue' | 'red'): LaneStructure[] =>
      (['melee', 'ranged', 'catapult'] as const).map((kind, index) => ({
        id: `${team === 'blue' ? 'b' : 'r'}_${kind}_barracks`,
        team,
        type: 'barracks',
        barracksKind: kind,
        name: `${team === 'blue' ? 'Blue' : 'Red'} ${kind === 'ranged' ? 'Ranged' : kind === 'catapult' ? 'Catapult' : 'Melee'} Barracks`,
        x: BARRACKS_X[team], y: 305 + index * 75,
        hp: 1800, maxHp: 1800, ad: 0, range: 0, attackTimer: 0,
        isAlive: true, targetId: null, armor: 30
      }));
    const initialStructures: LaneStructure[] = [
      { id: 'b_t1', team: 'blue', type: 'outer_tower', name: 'Blue Outer Turret', x: 790, y: LANE_Y, hp: 2400, maxHp: 2400, ad: 160, range: 135, attackTimer: 0, isAlive: true, targetId: null, armor: 35 },
      { id: 'b_t2', team: 'blue', type: 'inner_tower', name: 'Blue Inner Turret', x: 590, y: LANE_Y, hp: 2800, maxHp: 2800, ad: 190, range: 135, attackTimer: 0, isAlive: true, targetId: null, armor: 40 },
      { id: 'b_t3', team: 'blue', type: 'nexus_tower', name: 'Blue Nexus Turret', x: 390, y: LANE_Y, hp: 3200, maxHp: 3200, ad: 220, range: 135, attackTimer: 0, isAlive: true, targetId: null, armor: 45 },
      ...makeBarracks('blue'),
      { id: 'b_nexus', team: 'blue', type: 'nexus', name: 'Blue Nexus', x: NEXUS_X.blue, y: LANE_Y, hp: 5500, maxHp: 5500, ad: 0, range: 0, attackTimer: 0, isAlive: true, targetId: null, armor: 60 },
      { id: 'r_t1', team: 'red', type: 'outer_tower', name: 'Red Outer Turret', x: 1210, y: LANE_Y, hp: 2400, maxHp: 2400, ad: 160, range: 135, attackTimer: 0, isAlive: true, targetId: null, armor: 35 },
      { id: 'r_t2', team: 'red', type: 'inner_tower', name: 'Red Inner Turret', x: 1410, y: LANE_Y, hp: 2800, maxHp: 2800, ad: 190, range: 135, attackTimer: 0, isAlive: true, targetId: null, armor: 40 },
      { id: 'r_t3', team: 'red', type: 'nexus_tower', name: 'Red Nexus Turret', x: 1610, y: LANE_Y, hp: 3200, maxHp: 3200, ad: 220, range: 135, attackTimer: 0, isAlive: true, targetId: null, armor: 45 },
      ...makeBarracks('red'),
      { id: 'r_nexus', team: 'red', type: 'nexus', name: 'Red Nexus', x: NEXUS_X.red, y: LANE_Y, hp: 5500, maxHp: 5500, ad: 0, range: 0, attackTimer: 0, isAlive: true, targetId: null, armor: 60 }
    ];
    structuresRef.current = initialStructures;

    // 2. Health & Mana Relics on Bridge & Lower Valley
    relicsRef.current = [
      { id: 'relic_top', x: 795, y: 295, respawnTimer: 0, healAmount: 260 },
      { id: 'relic_bot', x: 1205, y: 465, respawnTimer: 0, healAmount: 260 },
      { id: 'relic_river', x: DRAGON_X, y: 590, respawnTimer: 0, healAmount: 320 }
    ];

    // 3. Champions Initial Setup
    const initChamps: AramChampionUnit[] = [];

    blueLineup.forEach((item, idx) => {
      const loadout = buyInitialLoadout(item.champion.primaryRole, 1500, item.champion.name);
      const champCopy = { ...item.champion };
      let bonusHp = 0;
      loadout.items.forEach((it) => {
        if (it.stats.hp) bonusHp += it.stats.hp;
        if (it.stats.ad) champCopy.ad += it.stats.ad;
        if (it.stats.armor) champCopy.armor += it.stats.armor;
        if (it.stats.mr) champCopy.mr += it.stats.mr;
        if (it.stats.aspd) champCopy.aspd += it.stats.aspd;
      });

      initChamps.push({
        id: `blue_${item.player.id}`,
        player: item.player,
        champion: champCopy,
        team: 'blue',
        x: WELL_X.blue + (idx % 2) * 20,
        y: getChampionFormationY(item.champion.name, idx),
        vx: 0,
        vy: 0,
        hp: champCopy.hp + bonusHp,
        maxHp: champCopy.hp + bonusHp,
        mana: 100,
        shield: 0,
        level: 3,
        xp: 0,
        gold: loadout.remainingGold,
        items: loadout.items,
        kills: 0,
        deaths: 0,
        assists: 0,
        cs: 0,
        damageDealt: 0,
        damageTaken: 0,
        isAlive: true,
        respawnTimer: 0,
        attackTimer: 0,
        cd1: 0,
        cd2: 0,
        cdUlt: 999,
        stunTimer: 0,
        charmTimer: 0,
        facing: 'right',
        animState: 'idle',
        animTimer: 0,
        isInBush: false,
        sterakCooldown: 0,
        zhonyaActive: false,
        zhonyaTimer: 0,
        immolateTimer: 0,
        krakenCounter: 0,
        isRecalling: false,
        recallTimer: 0
      });
    });

    redLineup.forEach((item, idx) => {
      const loadout = buyInitialLoadout(item.champion.primaryRole, 1500, item.champion.name);
      const champCopy = { ...item.champion };
      let bonusHp = 0;
      loadout.items.forEach((it) => {
        if (it.stats.hp) bonusHp += it.stats.hp;
        if (it.stats.ad) champCopy.ad += it.stats.ad;
        if (it.stats.armor) champCopy.armor += it.stats.armor;
        if (it.stats.mr) champCopy.mr += it.stats.mr;
        if (it.stats.aspd) champCopy.aspd += it.stats.aspd;
      });

      initChamps.push({
        id: `red_${item.player.id}`,
        player: item.player,
        champion: champCopy,
        team: 'red',
        x: WELL_X.red - (idx % 2) * 20,
        y: getChampionFormationY(item.champion.name, idx),
        vx: 0,
        vy: 0,
        hp: champCopy.hp + bonusHp,
        maxHp: champCopy.hp + bonusHp,
        mana: 100,
        shield: 0,
        level: 3,
        xp: 0,
        gold: loadout.remainingGold,
        items: loadout.items,
        kills: 0,
        deaths: 0,
        assists: 0,
        cs: 0,
        damageDealt: 0,
        damageTaken: 0,
        isAlive: true,
        respawnTimer: 0,
        attackTimer: 0,
        cd1: 0,
        cd2: 0,
        cdUlt: 999,
        stunTimer: 0,
        charmTimer: 0,
        facing: 'left',
        animState: 'idle',
        animTimer: 0,
        isInBush: false,
        sterakCooldown: 0,
        zhonyaActive: false,
        zhonyaTimer: 0,
        immolateTimer: 0,
        krakenCounter: 0,
        isRecalling: false,
        recallTimer: 0
      });
    });

    championsRef.current = initChamps;
    setChampions(initChamps);
  }, [blueLineup, redLineup]);

  // Destroying an enemy barracks upgrades the matching class in future waves.
  const spawnMinionWave = () => {
    waveCountRef.current++;
    const newMinions: LaneMinion[] = [];
    (['blue', 'red'] as const).forEach((team) => {
      const direction = team === 'blue' ? 1 : -1;
      const prefix = team === 'blue' ? 'b' : 'r';
      const spawnX = BARRACKS_X[team] + direction * 42;
      const addMinion = (type: LaneMinion['type'], index: number, x: number, y: number) => {
        const empowered = isMinionEmpowered(team, type, structuresRef.current);
        const stats = waveStats(type, empowered);
        newMinions.push({
          id: `${prefix}_${type}_${waveCountRef.current}_${index}`,
          team, type, x, y,
          ...stats,
          maxHp: stats.hp,
          attackTimer: 0,
          isAlive: true,
          empowered
        });
      };
      for (let i = 0; i < 3; i++) {
        addMinion('melee', i, spawnX + direction * (20 + i * 16), 350 + i * 15);
        addMinion('caster', i, spawnX - direction * (16 + i * 16), 365 + i * 15);
      }
      if (waveCountRef.current % 3 === 0 || isMinionEmpowered(team, 'cannon', structuresRef.current)) {
        addMinion('cannon', 0, spawnX - direction * 38, 430);
      }
    });
    minionsRef.current = [...minionsRef.current, ...newMinions];
  };

  // Grant Champion XP & Level Spike Announcer
  const grantChampionXp = (u: AramChampionUnit, amount: number) => {
    if (u.level >= 18) return;

    u.xp += amount;
    const needed = getXpThreshold(u.level + 1);

    if (u.xp >= needed && u.level < 18) {
      u.level += 1;
      u.maxHp += 110;
      u.hp = Math.min(u.maxHp, u.hp + 120);
      u.champion.ad += 4;
      u.champion.armor += 3;

      sound.playCoin();
      floatsRef.current.push({
        id: Math.random().toString(),
        x: u.x,
        y: u.y - 35,
        text: `LEVEL UP! Lvl ${u.level} ✨`,
        color: '#facc15',
        opacity: 1,
        scale: 1.3
      });

      if (u.level === 6) {
        u.cdUlt = 0;
        const msg = `${u.player.name} (${u.champion.name}) hit Level 6!`;
        const sub = `Unlocked Ultimate: ${u.champion.ultimate.name}! (75s Cooldown)`;
        showBanner(msg, sub, '⚡');
        addEvent(`⚡ LEVEL 6 SPIKE: ${msg} Unlocked ${u.champion.ultimate.name}!`, 'level');
      } else if (u.level === 11) {
        const msg = `${u.player.name} reached Ultimate Rank 2!`;
        showBanner(msg, `+25% Damage & 60s Cooldown!`, '👑');
        addEvent(`⚡ LEVEL 11 SPIKE: ${msg}`, 'level');
      } else if (u.level === 16) {
        const msg = `${u.player.name} reached MAX Rank 3 Ultimate!`;
        showBanner(msg, `Peak Late Game Power: 45s Cooldown!`, '🔥');
        addEvent(`⚡ LEVEL 16 SPIKE: ${msg}`, 'level');
      }
    }
  };

  const practiceAvatarCombo = (u: AramChampionUnit) => {
    if (u.comboMastered) return;
    const needed = comboPracticeNeeded(u.player, u.champion.name);
    if (needed === null) return;
    u.comboPractice = (u.comboPractice ?? 0) + 1;
    if (u.comboPractice >= needed) {
      u.comboMastered = true;
      const name = AVATAR_COMBOS[u.champion.name].name;
      floatsRef.current.push({ id: Math.random().toString(), x: u.x, y: u.y - 42,
        text: `COMBO LEARNED: ${name}`, color: '#facc15', opacity: 1, scale: 1.2 });
      addEvent(`${u.player.name} learned ${name} on ${u.champion.name}!`, 'combo');
    }
  };

  const executeAvatarCombo = (
    u: AramChampionUnit, target: AramChampionUnit, enemies: AramChampionUnit[], allies: AramChampionUnit[],
    attackRange: number, cooldownFactor: number, dt: number
  ): boolean => {
    const recipe = AVATAR_COMBOS[u.champion.name];
    if (!recipe || !u.comboMastered) return false;
    if (u.comboStage && (u.comboExpiresAt ?? 0) < matchTime) {
      u.comboStage = 0;
      u.comboHitConfirmed = false;
    }
    if (u.comboStage && u.comboTargetId !== target.id) {
      u.comboStage = 0;
      u.comboHitConfirmed = false;
    }
    const castStep = (skill: 'skill1' | 'skill2', stage: 1 | 2) => {
      u.comboStage = stage;
      u.comboTargetId = target.id;
      u.comboHitConfirmed = false;
      u.comboExpiresAt = matchTime + 4.5;
      u.animState = 'cast';
      if (skill === 'skill1') {
        u.mana -= 45;
        u.cd1 = (u.champion.skill1.cooldown || 10) * cooldownFactor;
        castChampionSkill1(u, target);
        if (!FIRST_SKILLSHOTS[u.champion.name] && u.champion.name !== 'Astra') {
          u.comboHitConfirmed = true;
          u.mana = Math.min(100, u.mana + 45);
        }
      } else {
        u.mana -= 35;
        u.cd2 = (u.champion.skill2.cooldown || 10) * cooldownFactor;
        castChampionSkill2(u, target);
        u.comboHitConfirmed = true;
        u.mana = Math.min(100, u.mana + 35);
      }
    };
    if (!u.comboStage && u.level >= 6 && u.cd1 <= 0 && u.cd2 <= 0 && u.cdUlt <= 0
      && u.mana >= 100 && target.hp > u.champion.ad && shouldUseUltimate(u, target, enemies, allies)) {
      castStep(recipe.opener, 1);
      return true;
    }
    if (u.comboStage === 1 && u.comboHitConfirmed && u.mana >= (recipe.followup === 'skill1' ? 45 : 35)
      && (recipe.followup === 'skill1' ? u.cd1 <= 0 : u.cd2 <= 0)) {
      castStep(recipe.followup, 2);
      return true;
    }
    if (u.comboStage === 2 && u.comboHitConfirmed && u.mana >= 100 && u.cdUlt <= 0) {
      u.comboStage = 0;
      u.comboHitConfirmed = false;
      u.mana = 0;
      u.cdUlt = (u.level >= 16 ? 45 : u.level >= 11 ? 60 : 75) * cooldownFactor;
      u.animState = 'cast';
      castChampionUltimate(u, target, enemies);
      addEvent(`${u.player.name} executed ${recipe.name}: ${u.champion.skill1.name}, ${u.champion.skill2.name}, ${u.champion.ultimate.name}!`, 'combo');
      return true;
    }
    if (u.comboStage) {
      if (Math.hypot(target.x - u.x, target.y - u.y) <= attackRange && u.attackTimer <= 0) {
        u.attackTimer = 1 / Math.max(0.5, u.champion.aspd);
        u.animState = 'attack';
        performChampionAttack(u, target);
      } else {
        u.animState = 'walk';
        const angle = Math.atan2(target.y - u.y, target.x - u.x);
        u.x += Math.cos(angle) * 70 * dt;
        u.y += Math.sin(angle) * 70 * dt;
      }
      return true;
    }
    return false;
  };

  // Main Simulation Step (60 FPS tick)
  const updateAramSimulation = (dt: number) => {
    // 1. Minion Wave Spawn Timer (Every 22s)
    waveTimerRef.current -= dt;
    if (waveTimerRef.current <= 0) {
      spawnMinionWave();
      waveTimerRef.current = 22.0;
    }

    const champs = championsRef.current;
    const minions = minionsRef.current;
    const structures = structuresRef.current;
    const relics = relicsRef.current;
    const dragon = dragonRef.current;
    const jungleCamps = jungleCampsRef.current;

    // Check Aegis Buff Expiry
    if (aegisBuffRef.current && matchTime > aegisBuffRef.current.expiresAt) {
      aegisBuffRef.current = null;
      addEvent(`🛡️ Aegis of the Immortal has expired!`, 'dragon');
    }

    // 2. Jungle Camps Respawn & Logic
    jungleCamps.forEach((camp) => {
      if (!camp.isAlive) {
        camp.respawnTimer -= dt;
        if (camp.respawnTimer <= 0) {
          camp.isAlive = true;
          camp.hp = camp.maxHp;
          camp.targetId = undefined;
          addEvent(`🌲 ${camp.name} has respawned in the jungle!`, 'jungle');
        }
        return;
      }
      camp.attackTimer = Math.max(0, camp.attackTimer - dt);
      const target = champs.find((c) => c.id === camp.targetId && c.isAlive);
      if (!target || Math.hypot(target.x - camp.x, target.y - camp.y) > camp.range) {
        camp.targetId = undefined;
        camp.hp = Math.min(camp.maxHp, camp.hp + 12 * dt);
        return;
      }
      if (camp.attackTimer <= 0) {
        camp.attackTimer = 1.35;
        projectilesRef.current.push({
          id: Math.random().toString(), x: camp.x, y: camp.y - 16,
          targetX: target.x, targetY: target.y - 12,
          vx: 0, vy: 0, speed: 430, color: camp.color,
          type: 'jungle_shot', size: 7, targetUnitId: target.id,
          damage: camp.ad, attackerId: camp.id,
          angle: Math.atan2(target.y - camp.y, target.x - camp.x)
        });
      }
    });

    // 3. Dragon Boss Logic & Shockwave Slam
    if (!dragon.isAlive) {
      dragon.spawnTimer -= dt;
      if (dragon.spawnTimer <= 0) {
        dragon.isAlive = true;
        dragon.hp = dragon.maxHp + dragon.slainCount * 1200;
        dragon.maxHp = dragon.hp;
        showBanner('🔥 EMBERMAW HAS AWAKENED!', 'Contest the volcanic dragon pit for the Aegis!', '🐉');
        addEvent(`🐉 DRAGON: Embermaw has awakened in the Upper Cavern!`, 'dragon');
      }
    } else {
      dragon.slamTimer -= dt;
      dragon.attackTimer -= dt;

      const nearbyChallengers = champs.filter((c) => c.isAlive && Math.hypot(c.x - dragon.x, c.y - dragon.y) <= dragon.range);

      if (nearbyChallengers.length > 0) {
        const primaryTarget = nearbyChallengers.sort((a, b) => a.hp - b.hp)[0];

        // Boss Slam AOE Shockwave (every 6 seconds)
        if (dragon.slamTimer <= 0) {
          dragon.slamTimer = 6.0;
          sound.playUltimateExplosion();
          spellsRef.current.push({
            id: Math.random().toString(),
            type: 'boss_slam',
            x: dragon.x,
            y: dragon.y,
            radius: 120,
            duration: 1.0,
            maxDuration: 1.0,
            color: '#f97316'
          });
          nearbyChallengers.forEach((c) => {
            c.hp = Math.max(1, c.hp - 160);
            c.stunTimer = 1.0;
            floatsRef.current.push({
              id: Math.random().toString(),
              x: c.x,
              y: c.y - 30,
              text: `🔥 INFERNO SLAM -160!`,
              color: '#fb923c',
              opacity: 1,
              scale: 1.2
            });
          });
        }
        // Boss Flame Breath auto-attack
        else if (dragon.attackTimer <= 0) {
          dragon.attackTimer = 1.5;
          sound.playSpellHit();
          projectilesRef.current.push({
            id: Math.random().toString(),
            x: dragon.x,
            y: dragon.y - 10,
            targetX: primaryTarget.x,
            targetY: primaryTarget.y,
            vx: 0,
            vy: 0,
            speed: 400,
            color: '#fb923c',
            type: 'boss_breath',
            size: 8,
            targetUnitId: primaryTarget.id,
            damage: dragon.ad,
            attackerId: dragon.id,
            angle: 0
          });
        }
      }
    }

    // 5. Health Relics Regen
    relics.forEach((r) => {
      if (r.respawnTimer > 0) r.respawnTimer = Math.max(0, r.respawnTimer - dt);
    });

    // 6. Healing wells at the far ends of the expanded map.
    champs.forEach((c) => {
      if (!c.isAlive) return;

      const inBlueWell = c.team === 'blue' && (c.x <= WELL_X.blue + 85 && Math.abs(c.y - LANE_Y) <= 90);
      const inRedWell = c.team === 'red' && (c.x >= WELL_X.red - 85 && Math.abs(c.y - LANE_Y) <= 90);

      if (inBlueWell || inRedWell) {
        // High rapid fountain regeneration (+45% HP/s and +75 Mana/s)
        c.hp = Math.min(c.maxHp, c.hp + c.maxHp * 0.45 * dt);
        c.mana = Math.min(100, c.mana + 75 * dt);

        // Shop items while in well!
        evaluateAndBuyItems(c);

        if (Math.random() < 0.1) {
          floatsRef.current.push({
            id: Math.random().toString(),
            x: c.x + (Math.random() - 0.5) * 16,
            y: c.y - 25,
            text: `+HP/MANA 💧`,
            color: '#34d399',
            opacity: 0.8,
            scale: 0.85
          });
        }
      }

      // Fountain Defense Laser on Intruders
      const redInvadingBlueWell = c.team === 'red' && c.x <= WELL_X.blue + 50;
      const blueInvadingRedWell = c.team === 'blue' && c.x >= WELL_X.red - 50;
      if (redInvadingBlueWell || blueInvadingRedWell) {
        c.hp = Math.max(0, c.hp - 1400 * dt);
        sound.playSpellHit();
        floatsRef.current.push({
          id: Math.random().toString(),
          x: c.x,
          y: c.y - 35,
          text: `⚡ WELL DEFENSE -1400!`,
          color: '#ef4444',
          opacity: 1,
          scale: 1.3
        });
        if (c.hp <= 0 && c.isAlive) {
          c.isAlive = false;
          c.deaths++;
          c.respawnTimer = calculateDeathTimer(c.level, matchTime);
          c.isRecalling = false;
          c.recallTimer = 0;
          addEvent(`⚡ Fountain Defense laser executed ${c.player.name}!`, 'fountain');
        }
      }

      // Natural Mana & XP Tick
      c.gold += 6.5 * dt;
      c.mana = Math.min(100, c.mana + 1.5 * dt);
      c.animTimer += dt;
      grantChampionXp(c, 3.5 * dt);

      // Warmog's Passive Regen
      const hasWarmogs = c.items.some((it) => it.id === 'item_warmogs');
      if (hasWarmogs && c.hp < c.maxHp) {
        c.hp = Math.min(c.maxHp, c.hp + c.maxHp * 0.04 * dt);
      }

      // Sunfire Immolate Passive
      const hasSunfire = c.items.some((it) => it.id === 'item_sunfire' || it.id === 'item_bami_cinder');
      if (hasSunfire) {
        c.immolateTimer += dt;
        if (c.immolateTimer >= 1.0) {
          c.immolateTimer = 0;
          const enemyChamps = champs.filter((e) => e.team !== c.team && e.isAlive && Math.hypot(e.x - c.x, e.y - c.y) <= 100);
          enemyChamps.forEach((e) => applyDamageToChampion(c, e, 35, false, '🔥 Immolate'));
          const enemyMinions = minions.filter((m) => m.team !== c.team && m.isAlive && Math.hypot(m.x - c.x, m.y - c.y) <= 100);
          enemyMinions.forEach((m) => { m.hp -= 35; });
        }
      }
    });

    // Skillshots travel toward the cast-time position and collide with the path.
    projectilesRef.current = projectilesRef.current
      .map((p) => {
        // Yasuo Wind Wall Projectile Dissolution
        const blockedByWindWall = spellsRef.current.some(
          (s) => s.type === 'wind_wall' && Math.hypot(p.x - s.x, p.y - s.y) <= s.radius
        );
        if (blockedByWindWall && p.type !== 'boss_breath') {
          sound.playSpellHit();
          floatsRef.current.push({
            id: Math.random().toString(),
            x: p.x,
            y: p.y - 15,
            text: '💨 WIND WALL DEFLECT!',
            color: '#38bdf8',
            opacity: 1,
            scale: 1.0
          });
          return null;
        }

        if (p.skillshot) {
          const dx = p.targetX - p.x;
          const dy = p.targetY - p.y;
          const dist = Math.hypot(dx, dy);
          const travel = Math.min(dist, p.speed * dt);
          const end = dist > 0 ? { x: p.x + dx / dist * travel, y: p.y + dy / dist * travel } : { x: p.x, y: p.y };
          const attacker = champs.find(c => c.id === p.attackerId);
          const intended = champs.find(c => c.id === p.targetUnitId && c.isAlive);
          if (intended && !p.dodgeAttempted && intended.stunTimer <= 0 && intended.charmTimer <= 0
            && Math.hypot(intended.x - p.x, intended.y - p.y) < Math.min(190, p.speed * 0.45)
            && segmentHitsCircle({ x: p.x, y: p.y }, { x: p.targetX, y: p.targetY }, { x: intended.x, y: intended.y - 15 }, (p.collisionRadius ?? 17) + 20)) {
            p.dodgeAttempted = true;
            if (Math.random() < dodgeProbability(intended.player.stats.lan, intended.player.stats.iq, attacker?.player.stats.lan ?? 75)) {
              const length = Math.max(1, dist);
              const direction = intended.y > 550 ? -1 : intended.y < 150 ? 1 : Math.random() < 0.5 ? -1 : 1;
              intended.x = Math.max(40, Math.min(ARENA_WIDTH - 40, intended.x - dy / length * 58 * direction));
              intended.y = Math.max(80, Math.min(620, intended.y + dx / length * 58 * direction));
              floatsRef.current.push({ id: Math.random().toString(), x: intended.x, y: intended.y - 30,
                text: 'DODGED!', color: '#38bdf8', opacity: 1, scale: 1.3 });
              addEvent(`${intended.player.name} sidestepped ${p.skillLabel ?? 'a skillshot'}!`, 'micro');
            }
          }
          const hit = champs.find(c => c.isAlive && c.team !== attacker?.team
            && segmentHitsCircle({ x: p.x, y: p.y }, end, { x: c.x, y: c.y - 15 }, (p.collisionRadius ?? 17) + p.size));
          if (hit) {
            handleProjectileImpact({ ...p, targetUnitId: hit.id });
            return null;
          }
          if (travel >= dist) return null;
          return { ...p, x: end.x, y: end.y, angle: Math.atan2(dy, dx) };
        }

        const dx = p.targetX - p.x;
        const dy = p.targetY - p.y;
        const dist = Math.hypot(dx, dy);
        if (dist < 18) {
          handleProjectileImpact(p);
          return null;
        }
        const vx = (dx / dist) * p.speed * dt;
        const vy = (dy / dist) * p.speed * dt;
        return { ...p, x: p.x + vx, y: p.y + vy, angle: Math.atan2(dy, dx) };
      })
      .filter((p): p is Projectile => p !== null);

    // 8. Update Spell AOEs
    spellsRef.current = spellsRef.current
      .map((s) => ({ ...s, duration: s.duration - dt }))
      .filter((s) => s.duration > 0);

    // 9. Update Floating Text
    floatsRef.current = floatsRef.current
      .map((f) => ({ ...f, y: f.y - 30 * dt, opacity: f.opacity - 1.1 * dt }))
      .filter((f) => f.opacity > 0);

    // 10. Structures (Turrets) Logic & Diving Aggro
    structures.forEach((st) => {
      if (!st.isAlive || st.ad === 0) return;

      st.attackTimer = Math.max(0, st.attackTimer - dt);

      const inRangeEnemies = [
        ...minions.filter((m) => m.team !== st.team && m.isAlive && Math.hypot(m.x - st.x, m.y - st.y) <= st.range),
        ...champs.filter((c) => c.team !== st.team && c.isAlive && Math.hypot(c.x - st.x, c.y - st.y) <= st.range)
      ];

      if (inRangeEnemies.length === 0) {
        st.targetId = null;
        return;
      }

      let target = inRangeEnemies.find((e) => e.id === st.targetId);
      if (!target) {
        const minionTarget = inRangeEnemies.find((e) => 'type' in e);
        target = minionTarget || inRangeEnemies[0];
        st.targetId = target.id;
      }

      // Fire Turret Shot
      if (st.attackTimer <= 0) {
        st.attackTimer = 1.0;
        sound.playSpellHit();
        projectilesRef.current.push({
          id: Math.random().toString(),
          x: st.x,
          y: st.y - 32,
          targetX: target.x,
          targetY: target.y - 15,
          vx: 0,
          vy: 0,
          speed: 460,
          color: st.team === 'blue' ? '#38bdf8' : '#f43f5e',
          type: 'turret_shot',
          size: 9,
          targetUnitId: target.id,
          damage: st.ad,
          attackerId: st.id,
          angle: 0
        });
      }
    });

    // 11. Minions Logic
    minions.forEach((m) => {
      if (!m.isAlive) return;

      m.attackTimer = Math.max(0, m.attackTimer - dt);

      const dir = m.team === 'blue' ? 1 : -1;
      const enemyMinions = minions.filter((em) => em.team !== m.team && em.isAlive && Math.abs(em.x - m.x) <= m.range + 20);
      const enemyStructures = structures.filter((es) => es.team !== m.team && es.isAlive && Math.abs(es.x - m.x) <= m.range + 30);
      const enemyChamps = champs.filter((ec) => ec.team !== m.team && ec.isAlive && Math.hypot(ec.x - m.x, ec.y - m.y) <= m.range + 10);

      const target = enemyMinions[0] || enemyStructures[0] || enemyChamps[0];

      if (target) {
        if (m.attackTimer <= 0) {
          m.attackTimer = 1.2;
          if (m.type === 'caster' || m.type === 'cannon') {
            projectilesRef.current.push({
              id: Math.random().toString(),
              x: m.x,
              y: m.y - 8,
              targetX: target.x,
              targetY: target.y - 8,
              vx: 0,
              vy: 0,
              speed: 380,
              color: m.team === 'blue' ? '#60a5fa' : '#f87171',
              type: 'minion_shot',
              size: m.type === 'cannon' ? 6 : 4,
              targetUnitId: target.id,
              damage: m.ad,
              attackerId: m.id,
              angle: 0
            });
          } else {
            applyMinionDamage(m, target);
          }
        }
      } else {
        m.x += dir * m.speed * dt;
        m.x = Math.max(40, Math.min(ARENA_WIDTH - 40, m.x));
      }
    });

    minionsRef.current = minions.filter((m) => m.isAlive);

    // 12. Champions Micro & Macro Intelligence
    champs.forEach((u, uIdx) => {
      if (!u.isAlive) {
        u.respawnTimer = Math.max(0, u.respawnTimer - dt);
        if (u.respawnTimer <= 0) {
          u.isAlive = true;
          u.hp = u.maxHp;
          u.mana = 100;
          u.isRecalling = false;
          u.recallTimer = 0;
          u.x = WELL_X[u.team];
          u.y = getChampionFormationY(u.champion.name, uIdx);
          evaluateAndBuyItems(u);
          addEvent(`💧 ${u.player.name} respawned in home fountain!`, 'fountain');
        }
        return;
      }

      // Check Active Recalling Channel (2.5s channel to teleport to base well)
      if (u.isRecalling) {
        u.vx = 0;
        u.vy = 0;
        u.animState = 'cast';
        u.recallTimer = (u.recallTimer ?? 2.5) - dt;
        if (u.recallTimer <= 0) {
          u.isRecalling = false;
          u.recallTimer = 0;
          u.x = WELL_X[u.team];
          u.y = 380;
          u.hp = u.maxHp;
          u.mana = 100;
          evaluateAndBuyItems(u);
          sound.playCoin();
          floatsRef.current.push({
            id: Math.random().toString(),
            x: u.x,
            y: u.y - 35,
            text: `💧 RECALLED TO FOUNTAIN!`,
            color: '#38bdf8',
            opacity: 1,
            scale: 1.3
          });
          addEvent(`💧 ${u.player.name} (${u.champion.name}) safely recalled to base!`, 'fountain');
        }
        return;
      }

      // Decrement timers
      if (u.attackTimer > 0) u.attackTimer = Math.max(0, u.attackTimer - dt);
      if (u.cd1 > 0) u.cd1 = Math.max(0, u.cd1 - dt);
      if (u.cd2 > 0) u.cd2 = Math.max(0, u.cd2 - dt);
      if (u.cdUlt > 0 && u.level >= 6) u.cdUlt = Math.max(0, u.cdUlt - dt);
      if (u.stunTimer > 0) u.stunTimer = Math.max(0, u.stunTimer - dt);
      if (u.charmTimer > 0) u.charmTimer = Math.max(0, u.charmTimer - dt);

      // Recovery to Idle
      if (u.attackTimer <= 1.0 / Math.max(0.5, u.champion.aspd) - 0.28) {
        if (u.animState === 'attack') u.animState = 'idle';
      }

      if (u.stunTimer > 0 || u.charmTimer > 0) {
        if (u.isRecalling) {
          u.isRecalling = false;
          u.recallTimer = 0;
          floatsRef.current.push({
            id: Math.random().toString(),
            x: u.x,
            y: u.y - 35,
            text: `❌ RECALL STUNNED!`,
            color: '#ef4444',
            opacity: 1,
            scale: 1.2
          });
        }
        u.animState = 'idle';
        return;
      }

      // Check if currently inside fountain well recovering
      const inBlueWell = u.team === 'blue' && (u.x <= WELL_X.blue + 85 && Math.abs(u.y - LANE_Y) <= 90);
      const inRedWell = u.team === 'red' && (u.x >= WELL_X.red - 85 && Math.abs(u.y - LANE_Y) <= 90);
      const isInsideWell = inBlueWell || inRedWell;

      // If champion is inside the well, stay in well until HP >= 95% and Mana >= 90!
      if (isInsideWell && (u.hp < u.maxHp * 0.95 || u.mana < 90)) {
        u.animState = 'idle';
        u.vx = 0;
        u.vy = 0;
        return;
      }

      // Relic Pickup
      relics.forEach((r) => {
        if (r.respawnTimer <= 0 && Math.hypot(u.x - r.x, u.y - r.y) <= 32 && (u.hp < u.maxHp || u.mana < 90)) {
          r.respawnTimer = 45.0;
          u.hp = Math.min(u.maxHp, u.hp + r.healAmount);
          u.mana = Math.min(100, u.mana + 45);
          sound.playCoin();
          floatsRef.current.push({
            id: Math.random().toString(),
            x: u.x,
            y: u.y - 25,
            text: `+${r.healAmount} HP / +45 Mana! 💧`,
            color: '#10b981',
            opacity: 1,
            scale: 1.2
          });
        }
      });

      // Targets: Enemies, Allies, Dragon, Jungle, Structures, Minions
      const enemies = champs.filter((e) => e.team !== u.team && e.isAlive);
      const allies = champs.filter((a) => a.team === u.team && a.isAlive);
      const enemyStructures = structures.filter((st) => st.team !== u.team && st.isAlive);
      const enemyMinions = minions.filter((m) => m.team !== u.team && m.isAlive);
      const availableJungleCamps = jungleCamps.filter((c) => c.isAlive);

      // Read the local numbers before committing to a fight.
      const localEnemies = enemies.filter((e) => Math.hypot(e.x - u.x, e.y - u.y) <= 400);
      const localAllies = allies.filter((a) => Math.hypot(a.x - u.x, a.y - u.y) <= 400);
      const iq = Math.max(1, Math.min(99, u.player.stats.iq));
      const isOutnumbered = localEnemies.length > localAllies.length + (iq >= 70 ? 0 : 1);
      const deathFearThreshold = (matchTime > 360 ? 0.34 : matchTime > 180 ? 0.27 : 0.2) + iq * 0.001;
      const isLowHpScared = u.hp < u.maxHp * deathFearThreshold;
      const shouldDisengage = isLowHpScared || (isOutnumbered && u.hp < u.maxHp * (0.4 + iq * 0.002));

      const wellTargetX = WELL_X[u.team];

      // Disengage and recall when the player judges the fight unsafe.
      if (shouldDisengage && Math.abs(u.x - wellTargetX) > 40 && !isInsideWell) {
        // Recall only after creating enough distance.
        const nearestEnemyDist = localEnemies.length > 0
          ? Math.min(...localEnemies.map((e) => Math.hypot(e.x - u.x, e.y - u.y)))
          : 999;

        if (nearestEnemyDist > 290 && (u.hp < u.maxHp * 0.38 || u.mana < 22)) {
          u.isRecalling = true;
          u.recallTimer = 2.5;
          u.animState = 'cast';
          u.vx = 0;
          u.vy = 0;
          floatsRef.current.push({
            id: Math.random().toString(),
            x: u.x,
            y: u.y - 35,
            text: `💧 SAFE RECALLING...`,
            color: '#38bdf8',
            opacity: 1,
            scale: 1.15
          });
          addEvent(`💧 ${u.player.name} (${u.champion.name}) disengaged and recalled!`, 'fountain');
          return;
        }

        u.animState = 'walk';
        const retreatAngle = Math.atan2(380 - u.y, wellTargetX - u.x);
        u.vx = Math.cos(retreatAngle) * 95;
        u.vy = Math.sin(retreatAngle) * 95;
        u.x += u.vx * dt;
        u.y += u.vy * dt;
        u.facing = wellTargetX > u.x ? 'right' : 'left';
        return;
      }

      const shouldContestDragon = dragon.isAlive && shouldContestBoss(u, allies, enemies, dragon.hp / dragon.maxHp, matchTime);
      const nearestJungleCamp = availableJungleCamps.sort((a, b) => Math.hypot(a.x - u.x, a.y - u.y) - Math.hypot(b.x - u.x, b.y - u.y))[0];

      // AUTHENTIC WEAPON ATTACK RANGES
      const attackRange = getChampionAttackRange(u.champion.name);
      const isRanged = attackRange >= 90;
      const kiteBackstepThreshold = attackRange * 0.65;

      // Each athlete evaluates the same fight using their own game sense.
      const primaryTarget = chooseTeamfightTarget(u, enemies, allies, attackRange);

      const nearestStructure = enemyStructures.sort((a, b) => Math.abs(a.x - u.x) - Math.abs(b.x - u.x))[0];
      const nearestMinion = enemyMinions.sort((a, b) => Math.hypot(a.x - u.x, a.y - u.y) - Math.hypot(b.x - u.x, b.y - u.y))[0];

      // MACRO OBJECTIVE 1: CONTEST DRAGON IN UPPER PIT
      if (shouldContestDragon && (!primaryTarget || Math.hypot(primaryTarget.x - u.x, primaryTarget.y - u.y) > 220)) {
        const dragonDist = Math.hypot(dragon.x - u.x, dragon.y - u.y);
        u.facing = dragon.x > u.x ? 'right' : 'left';

        if (dragonDist <= attackRange + 20) {
          u.vx = 0; u.vy = 0;
          if (u.attackTimer <= 0) {
            u.attackTimer = 1.0 / Math.max(0.5, u.champion.aspd);
            u.animState = 'attack';
            u.mana = Math.min(100, u.mana + 4);
            applyDamageToDragon(u, u.champion.ad * 1.2);
          }
        } else {
          u.animState = 'walk';
          const angle = Math.atan2(dragon.y - u.y, dragon.x - u.x);
          u.vx = Math.cos(angle) * 85;
          u.vy = Math.sin(angle) * 85;
          u.x += u.vx * dt;
          u.y += u.vy * dt;
        }
        return;
      }

      // Farm a nearby camp only when the lane and local fight are quiet.
      if (nearestJungleCamp && iq >= 55 && u.hp > u.maxHp * 0.6
        && Math.hypot(nearestJungleCamp.x - u.x, nearestJungleCamp.y - u.y) < 300
        && localEnemies.length === 0 && (!nearestMinion || Math.hypot(nearestMinion.x - u.x, nearestMinion.y - u.y) > 200)) {
        const campDist = Math.hypot(nearestJungleCamp.x - u.x, nearestJungleCamp.y - u.y);
        u.facing = nearestJungleCamp.x > u.x ? 'right' : 'left';

        if (campDist <= attackRange + 15) {
          u.vx = 0; u.vy = 0;
          if (u.attackTimer <= 0) {
            u.attackTimer = 1.0 / Math.max(0.5, u.champion.aspd);
            u.animState = 'attack';
            u.mana = Math.min(100, u.mana + 4);
            applyDamageToJungleCamp(u, nearestJungleCamp, u.champion.ad);
          }
        } else {
          u.animState = 'walk';
          const angle = Math.atan2(nearestJungleCamp.y - u.y, nearestJungleCamp.x - u.x);
          u.vx = Math.cos(angle) * 85;
          u.vy = Math.sin(angle) * 85;
          u.x += u.vx * dt;
          u.y += u.vy * dt;
        }
        return;
      }

      // COMBAT ENGAGEMENT WITH ENEMIES:
      if (primaryTarget && Math.hypot(primaryTarget.x - u.x, primaryTarget.y - u.y) <= Math.max(attackRange * 1.5, 190)) {
        u.facing = primaryTarget.x > u.x ? 'right' : 'left';
        const dist = Math.hypot(primaryTarget.x - u.x, primaryTarget.y - u.y);
        const haste = u.items.reduce((total, item) => total + (item.stats.haste ?? 0), 0);
        const cooldownFactor = 100 / (100 + haste);

        // 1. REASONABLE ULTIMATE: Level 6+, 100 Mana, 45-75s Cooldown!
        if (executeAvatarCombo(u, primaryTarget, enemies, allies, attackRange, cooldownFactor, dt)) {
          // Continue the learned sequence, or wait for its aimed opening cast to hit.
        } else if (shouldUseUltimate(u, primaryTarget, enemies, allies)) {
          u.mana = 0;
          const baseUltCd = u.level >= 16 ? 45.0 : u.level >= 11 ? 60.0 : 75.0;
          u.cdUlt = baseUltCd * cooldownFactor;
          u.animState = 'cast';
          castChampionUltimate(u, primaryTarget, enemies);
        }
        // 2. REASONABLE SKILL 1: 8-12s Cooldown & 45 Mana Cost
        else if (shouldUseSkill(u, primaryTarget, enemies, Math.max(attackRange, 145))) {
          u.mana -= 45;
          u.cd1 = (u.champion.skill1.cooldown || 10.0) * cooldownFactor;
          u.animState = 'cast';
          castChampionSkill1(u, primaryTarget);
          practiceAvatarCombo(u);
        }
        // Skill 2 provides follow-up control, defense, or damage between first casts.
        else if (shouldUseSecondSkill(u, primaryTarget, enemies, allies, Math.max(attackRange, 145))) {
          u.mana -= 35;
          u.cd2 = (u.champion.skill2.cooldown || 10.0) * cooldownFactor;
          u.animState = 'cast';
          castChampionSkill2(u, primaryTarget);
          practiceAvatarCombo(u);
        }
        // 3. Basic Attack & Stutter-Step Kiting
        else if (dist <= attackRange) {
          if (isRanged && dist < kiteBackstepThreshold) {
            u.animState = 'walk';
            const retreatDir = u.team === 'blue' ? -1 : 1;
            u.x += retreatDir * 65 * dt;
            const formationY = getChampionFormationY(u.champion.name, uIdx);
            u.y += (formationY - u.y) * 1.5 * dt;
          } else {
            u.vx = 0;
            u.vy = 0;
          }

          if (u.attackTimer <= 0) {
            u.attackTimer = 1.0 / Math.max(0.5, u.champion.aspd);
            u.animState = 'attack';
            u.mana = Math.min(100, u.mana + 3.5);
            performChampionAttack(u, primaryTarget);
          }
        }
        // 4. Close the Distance
        else {
          u.animState = 'walk';
          const angle = Math.atan2(primaryTarget.y - u.y, primaryTarget.x - u.x);
          u.vx = Math.cos(angle) * 85;
          u.vy = Math.sin(angle) * 85;
          u.x += u.vx * dt;
          u.y += u.vy * dt;
        }
      }
      // SIEGE TURRET
      else if (nearestStructure && Math.abs(nearestStructure.x - u.x) <= attackRange + 40) {
        u.facing = nearestStructure.x > u.x ? 'right' : 'left';
        if (u.attackTimer <= 0) {
          u.attackTimer = 1.0 / Math.max(0.5, u.champion.aspd);
          u.animState = 'attack';
          applyDamageToStructure(u, nearestStructure, u.champion.ad);
        }
      }
      // WAVE CLEAR
      else if (nearestMinion && Math.hypot(nearestMinion.x - u.x, nearestMinion.y - u.y) <= attackRange) {
        u.facing = nearestMinion.x > u.x ? 'right' : 'left';
        if (u.attackTimer <= 0) {
          u.attackTimer = 1.0 / Math.max(0.5, u.champion.aspd);
          u.animState = 'attack';
          applyDamageToMinion(u, nearestMinion, u.champion.ad);
        }
      }
      // PUSH LANE IN FORMATION
      else {
        u.animState = 'walk';
        const pushDir = u.team === 'blue' ? 1 : -1;
        u.x += pushDir * 70 * dt;
        u.facing = pushDir === 1 ? 'right' : 'left';

        const targetFormY = getChampionFormationY(u.champion.name, uIdx);
        u.y += (targetFormY - u.y) * 2.0 * dt;
      }

      u.x = Math.max(40, Math.min(ARENA_WIDTH - 40, u.x));
      u.y = Math.max(80, Math.min(620, u.y));
    });

    // 13. PAIRWISE ANTI-CLUMPING SEPARATION PHYSICS
    for (let i = 0; i < champs.length; i++) {
      for (let j = i + 1; j < champs.length; j++) {
        const c1 = champs[i];
        const c2 = champs[j];
        if (!c1.isAlive || !c2.isAlive) continue;

        const dx = c2.x - c1.x;
        const dy = c2.y - c1.y;
        const d = Math.hypot(dx, dy);
        const minDistance = 34;

        if (d < minDistance && d > 0.05) {
          const overlap = (minDistance - d) / 2;
          const nx = dx / d;
          const ny = dy / d;
          c1.x -= nx * overlap;
          c1.y -= ny * overlap;
          c2.x += nx * overlap;
          c2.y += ny * overlap;

          c1.x = Math.max(40, Math.min(ARENA_WIDTH - 40, c1.x));
          c1.y = Math.max(80, Math.min(620, c1.y));
          c2.x = Math.max(40, Math.min(ARENA_WIDTH - 40, c2.x));
          c2.y = Math.max(80, Math.min(620, c2.y));
        }
      }
    }

    // Check Nexus Victory
    const blueNexus = structures.find((s) => s.id === 'b_nexus');
    const redNexus = structures.find((s) => s.id === 'r_nexus');

    if (redNexus && !redNexus.isAlive && !matchOver) {
      endAramMatch('blue');
    } else if (blueNexus && !blueNexus.isAlive && !matchOver) {
      endAramMatch('red');
    }

    setChampions(champs.map((c) => ({ ...c, items: [...c.items] })));
  };

  // Evaluate & Purchase Items progressively
  const evaluateAndBuyItems = (u: AramChampionUnit) => {
    for (let purchase = 0; purchase < 6; purchase++) {
      const plan = getItemPurchasePlan(u.champion.primaryRole, u.items, u.gold, u.champion.name, ALL_ITEMS);
      if (!plan) break;
      const nextItem = plan.item;
      u.gold -= plan.goldCost;
      for (const removed of plan.removed) {
        const index = u.items.findIndex(item => item.id === removed.id);
        if (index >= 0) u.items.splice(index, 1);
        u.champion.ad -= removed.stats.ad ?? 0;
        u.champion.armor -= removed.stats.armor ?? 0;
        u.champion.mr -= removed.stats.mr ?? 0;
        u.champion.aspd -= removed.stats.aspd ?? 0;
        u.maxHp -= removed.stats.hp ?? 0;
        u.hp = Math.min(u.hp, u.maxHp);
      }
      u.items.push(nextItem);
      u.champion.ad += nextItem.stats.ad ?? 0;
      u.champion.armor += nextItem.stats.armor ?? 0;
      u.champion.mr += nextItem.stats.mr ?? 0;
      u.champion.aspd += nextItem.stats.aspd ?? 0;
      u.maxHp += nextItem.stats.hp ?? 0;
      u.hp += nextItem.stats.hp ?? 0;

      sound.playCoin();
      const mins = Math.floor(matchTime / 60);
      const secs = (Math.floor(matchTime % 60)).toString().padStart(2, '0');
      const timeStr = `${mins}:${secs}`;

      setItemMilestones((prev) => [
        {
          playerName: u.player.name,
          champName: u.champion.name,
          itemName: nextItem.name,
          itemIcon: nextItem.icon,
          time: timeStr,
          stats: nextItem.tier,
          team: u.team
        },
        ...prev
      ]);

      showBanner(
        `🛍️ ${u.player.name} completed ${nextItem.name}!`,
        `${nextItem.tier} Spike: ${nextItem.passiveName}`,
        nextItem.icon
      );
      addEvent(`🛍️ ITEM TIMING: ${u.player.name} purchased ${nextItem.name} (${nextItem.icon})!`, 'item');
    }
  };

  // Attack Dragon Boss
  const applyDamageToDragon = (attacker: AramChampionUnit, damage: number) => {
    const dragon = dragonRef.current;
    if (!dragon.isAlive) return;

    dragon.hp -= damage;
    floatsRef.current.push({
      id: Math.random().toString(),
      x: dragon.x + (Math.random() - 0.5) * 40,
      y: dragon.y - 30,
      text: `-${Math.round(damage)}`,
      color: '#fb923c',
      opacity: 1,
      scale: 1.1
    });

    if (dragon.hp <= 0) {
      dragon.isAlive = false;
      dragon.slainCount++;
      dragon.spawnTimer = 120.0;
      sound.playUltimateExplosion();
      confetti({ particleCount: 160, spread: 80, origin: { x: dragon.x / ARENA_WIDTH, y: 0.25 } });

      aegisBuffRef.current = {
        team: attacker.team,
        expiresAt: matchTime + 90.0,
        adBonus: 25
      };

      const bounty = 350;
      if (attacker.team === 'blue') setBlueGold((g) => g + bounty * 5);
      else setRedGold((g) => g + bounty * 5);

      championsRef.current
        .filter((c) => c.team === attacker.team && c.isAlive)
        .forEach((ally) => {
          grantChampionXp(ally, 320);
          ally.shield += 300;
        });

      showBanner(
        `🐉 ${attacker.team.toUpperCase()} TEAM SLAIN EMBERMAW!`,
        `Claimed Aegis of the Immortal! +350g Team Bounty & Dragon Empowerment!`,
        '🐉'
      );
      addEvent(`🐉 DRAGON SLAIN: ${attacker.player.name} secured Embermaw! Team claimed the Aegis!`, 'dragon');
    }
  };

  // Farm Neutral Jungle Camps
  const applyDamageToJungleCamp = (attacker: AramChampionUnit, camp: JungleCamp, damage: number) => {
    if (!camp.isAlive) return;

    camp.targetId = attacker.id;
    camp.hp -= damage;
    floatsRef.current.push({
      id: Math.random().toString(),
      x: camp.x + (Math.random() - 0.5) * 20,
      y: camp.y - 20,
      text: `-${Math.round(damage)}`,
      color: '#facc15',
      opacity: 1,
      scale: 0.95
    });

    if (camp.hp <= 0) {
      camp.isAlive = false;
      camp.targetId = undefined;
      camp.respawnTimer = 55.0;
      attacker.gold += camp.goldReward;
      grantChampionXp(attacker, camp.xpReward);
      sound.playCoin();

      floatsRef.current.push({
        id: Math.random().toString(),
        x: camp.x,
        y: camp.y - 30,
        text: `+${camp.goldReward}g 🌲`,
        color: '#facc15',
        opacity: 1,
        scale: 1.2
      });

      addEvent(`🌲 JUNGLE: ${attacker.player.name} cleared ${camp.name} (+${camp.goldReward}g)!`, 'jungle');
    }
  };

  const handleProjectileImpact = (p: Projectile) => {
    sound.playSpellHit();

    if (p.targetUnitId) {
      const targetChamp = championsRef.current.find((c) => c.id === p.targetUnitId && c.isAlive);
      const targetMinion = minionsRef.current.find((m) => m.id === p.targetUnitId && m.isAlive);
      const targetStructure = structuresRef.current.find((st) => st.id === p.targetUnitId && st.isAlive);
      const attackerChamp = championsRef.current.find((c) => c.id === p.attackerId);

      if (targetChamp) {
        if (p.skillshot) {
          targetChamp.stunTimer = Math.max(targetChamp.stunTimer, p.stunOnHit ?? 0);
          targetChamp.charmTimer = Math.max(targetChamp.charmTimer, p.charmOnHit ?? 0);
          if (p.pullOnHit && attackerChamp) targetChamp.x += attackerChamp.team === 'blue' ? -p.pullOnHit : p.pullOnHit;
          applyDamageToChampion(attackerChamp ?? null, targetChamp, p.damage, !!p.trueDamage, p.skillLabel);
          if (p.splashRadius && attackerChamp) {
            championsRef.current.filter(c => c.team !== attackerChamp.team && c.id !== targetChamp.id && c.isAlive
              && Math.hypot(c.x - targetChamp.x, c.y - targetChamp.y) < p.splashRadius!)
              .forEach(c => applyDamageToChampion(attackerChamp, c, p.damage * 0.55, !!p.trueDamage, p.skillLabel));
          }
          if (p.healAlliesOnHit && attackerChamp) {
            championsRef.current.filter(c => c.team === attackerChamp.team && c.isAlive && Math.hypot(c.x - attackerChamp.x, c.y - attackerChamp.y) < 190)
              .forEach(c => { c.hp = Math.min(c.maxHp, c.hp + p.healAlliesOnHit!); emitSkillEffect(attackerChamp, c); });
          }
          if (attackerChamp) emitSkillEffect(attackerChamp, targetChamp, false, p.skillLabel);
          if (p.comboStage && attackerChamp?.comboStage === p.comboStage && attackerChamp.comboTargetId === targetChamp.id) {
            attackerChamp.comboHitConfirmed = true;
            attackerChamp.mana = Math.min(100, attackerChamp.mana + 45);
          }
          return;
        }
        applyDamageToChampion(attackerChamp || null, targetChamp, p.damage, false,
          p.type === 'turret_shot' ? '🏰 Turret' : p.type === 'boss_breath' ? '🔥 Flame Breath'
            : p.type === 'jungle_shot' ? '🌲 Jungle Camp' : undefined);
      } else if (targetMinion) {
        targetMinion.hp -= p.damage;
        if (targetMinion.hp <= 0 && targetMinion.isAlive) {
          targetMinion.isAlive = false;
        }
      } else if (targetStructure && p.type === 'minion_shot') {
        damageStructure(targetStructure, p.damage);
      }
    }
  };

  const applyMinionDamage = (m: LaneMinion, target: LaneMinion | LaneStructure | AramChampionUnit) => {
    if ('armor' in target) {
      damageStructure(target, m.ad);
      return;
    }
    if ('player' in target) {
      applyDamageToChampion(null, target, m.ad, false, 'Creep');
      return;
    }
    target.hp -= m.ad;
    if (target.hp <= 0 && target.isAlive) {
      target.isAlive = false;
    }
  };

  // Champion Basic Attack Projectile / Melee Strike
  const performChampionAttack = (u: AramChampionUnit, target: AramChampionUnit) => {
    sound.playSpellHit();

    let bonusAd = 0;
    const hasInfinity = u.items.some((it) => it.id === 'item_infinity_edge');
    const critChance = Math.min(0.85, 0.1 + u.items.reduce((total, item) => total + (item.stats.crit ?? 0) / 100, 0));
    const isCrit = Math.random() < critChance;
    if (isCrit) bonusAd += u.champion.ad * (hasInfinity ? 1.15 : 0.75);

    if (aegisBuffRef.current?.team === u.team) {
      bonusAd += aegisBuffRef.current.adBonus;
    }

    const totalDmg = u.champion.ad + bonusAd;

    if (u.champion.name === 'Astra') {
      const dx = target.x - u.x;
      const dy = target.y - u.y;
      const angle = Math.atan2(dy, dx);
      projectilesRef.current.push({
        id: Math.random().toString(),
        x: u.x + (u.facing === 'right' ? 18 : -18),
        y: u.y - 15,
        targetX: target.x,
        targetY: target.y - 15,
        vx: 0,
        vy: 0,
        speed: 520,
        color: '#38bdf8',
        type: 'arrow',
        size: 5,
        targetUnitId: target.id,
        damage: totalDmg,
        attackerId: u.id,
        angle
      });
    } else if (u.champion.name === 'Kindra' || u.champion.name === 'Kindra & Grim') {
      const dx = target.x - u.x;
      const dy = target.y - u.y;
      const angle = Math.atan2(dy, dx);
      projectilesRef.current.push({
        id: Math.random().toString(),
        x: u.x + (u.facing === 'right' ? 18 : -18),
        y: u.y - 15,
        targetX: target.x,
        targetY: target.y - 15,
        vx: 0,
        vy: 0,
        speed: 520,
        color: '#a855f7',
        type: 'spirit_arrow',
        size: 5,
        targetUnitId: target.id,
        damage: totalDmg,
        attackerId: u.id,
        angle
      });
    } else if (u.champion.name === 'Cora') {
      const dx = target.x - u.x;
      const dy = target.y - u.y;
      const angle = Math.atan2(dy, dx);
      projectilesRef.current.push({
        id: Math.random().toString(),
        x: u.x + (u.facing === 'right' ? 18 : -18),
        y: u.y - 15,
        targetX: target.x,
        targetY: target.y - 15,
        vx: 0,
        vy: 0,
        speed: 530,
        color: '#ec4899',
        type: 'feather',
        size: 5,
        targetUnitId: target.id,
        damage: totalDmg,
        attackerId: u.id,
        angle
      });
    } else if (u.champion.name === 'Tequoia') {
      const dx = target.x - u.x;
      const dy = target.y - u.y;
      const angle = Math.atan2(dy, dx);
      projectilesRef.current.push({
        id: Math.random().toString(),
        x: u.x + (u.facing === 'right' ? 16 : -16),
        y: u.y - 14,
        targetX: target.x,
        targetY: target.y - 15,
        vx: 0,
        vy: 0,
        speed: 480,
        color: '#22c55e',
        type: 'nature_bolt',
        size: 6,
        targetUnitId: target.id,
        damage: totalDmg,
        attackerId: u.id,
        angle
      });
    } else if (u.champion.name === 'Zal') {
      const dx = target.x - u.x;
      const dy = target.y - u.y;
      const angle = Math.atan2(dy, dx);
      projectilesRef.current.push({
        id: Math.random().toString(),
        x: u.x + (u.facing === 'right' ? 16 : -16),
        y: u.y - 14,
        targetX: target.x,
        targetY: target.y - 15,
        vx: 0,
        vy: 0,
        speed: 470,
        color: '#d946ef',
        type: 'poison_dart',
        size: 5,
        targetUnitId: target.id,
        damage: totalDmg,
        attackerId: u.id,
        angle
      });
    } else if (u.champion.name === 'Raijin') {
      const dx = target.x - u.x;
      const dy = target.y - u.y;
      const angle = Math.atan2(dy, dx);
      projectilesRef.current.push({
        id: Math.random().toString(),
        x: u.x + (u.facing === 'right' ? 16 : -16),
        y: u.y - 14,
        targetX: target.x,
        targetY: target.y - 15,
        vx: 0,
        vy: 0,
        speed: 490,
        color: '#06b6d4',
        type: 'electric_spark',
        size: 6,
        targetUnitId: target.id,
        damage: totalDmg,
        attackerId: u.id,
        angle
      });
    } else if (u.champion.name === 'Sylla') {
      const dx = target.x - u.x;
      const dy = target.y - u.y;
      const angle = Math.atan2(dy, dx);
      projectilesRef.current.push({
        id: Math.random().toString(),
        x: u.x + (u.facing === 'right' ? 16 : -16),
        y: u.y - 14,
        targetX: target.x,
        targetY: target.y - 15,
        vx: 0,
        vy: 0,
        speed: 480,
        color: '#15803d',
        type: 'seed_shot',
        size: 5,
        targetUnitId: target.id,
        damage: totalDmg,
        attackerId: u.id,
        angle
      });
    } else if (u.champion.name === 'Kyumi') {
      const dx = target.x - u.x;
      const dy = target.y - u.y;
      const angle = Math.atan2(dy, dx);
      projectilesRef.current.push({
        id: Math.random().toString(),
        x: u.x + (u.facing === 'right' ? 16 : -16),
        y: u.y - 14,
        targetX: target.x,
        targetY: target.y - 15,
        vx: 0,
        vy: 0,
        speed: 460,
        color: '#f472b6',
        type: 'orb',
        size: 7,
        targetUnitId: target.id,
        damage: totalDmg,
        attackerId: u.id,
        angle
      });
    } else if (u.champion.name === 'Buck') {
      const dx = target.x - u.x;
      const dy = target.y - u.y;
      const angle = Math.atan2(dy, dx);
      for (let s = -1; s <= 1; s++) {
        projectilesRef.current.push({
          id: Math.random().toString(),
          x: u.x + (u.facing === 'right' ? 20 : -20),
          y: u.y - 12,
          targetX: target.x,
          targetY: target.y - 15 + s * 12,
          vx: 0,
          vy: 0,
          speed: 480,
          color: '#fbbf24',
          type: 'pellet',
          size: 4,
          targetUnitId: target.id,
          damage: totalDmg / 2.2,
          attackerId: u.id,
          angle: angle + s * 0.12
        });
      }
    } else if (u.champion.name === 'Senna' || u.champion.name === 'Shadow Fiend' || u.champion.name === 'Locke') {
      const originX = u.x + (u.facing === 'right' ? 18 : -18);
      projectilesRef.current.push({
        id: Math.random().toString(), x: originX, y: u.y - 15,
        targetX: target.x, targetY: target.y - 15, vx: 0, vy: 0, speed: 520,
        color: u.champion.accentColor, type: u.champion.name === 'Senna' ? 'laser' : 'orb',
        size: 6, targetUnitId: target.id, damage: totalDmg, attackerId: u.id,
        angle: Math.atan2(target.y - u.y, target.x - originX)
      });
    } else {
      applyDamageToChampion(u, target, totalDmg, false);
    }
  };

  const emitSkillEffect = (u: AramChampionUnit, target: AramChampionUnit, ultimate = false, label = '') => {
    spellsRef.current.push({
      id: Math.random().toString(),
      type: ultimate ? 'ultimate_burst' : 'skill_burst',
      x: target.x, y: target.y,
      sourceX: u.x, sourceY: u.y,
      radius: ultimate ? 94 : 52,
      duration: ultimate ? 1.3 : 0.9,
      maxDuration: ultimate ? 1.3 : 0.9,
      color: ultimate ? u.champion.accentColor : u.champion.primaryColor,
      extraText: label
    });
  };

  const fireFirstSkillshot = (u: AramChampionUnit, target: AramChampionUnit, spec: Partial<Projectile>) => {
    const speed = spec.speed ?? 420;
    const accuracy = u.player.stats.lan * 0.75 + u.player.stats.flx * 0.15 + u.player.stats.iq * 0.1
      + (u.player.signatureChampions.includes(u.champion.name) ? 7 : 0);
    const origin = { x: u.x + (u.facing === 'right' ? 16 : -16), y: u.y - 15 };
    const aim = aimAtCast(origin, { x: target.x, y: target.y - 15, vx: target.vx, vy: target.vy }, speed, accuracy);
    projectilesRef.current.push({
      id: Math.random().toString(), x: origin.x, y: origin.y,
      targetX: aim.x, targetY: aim.y, vx: 0, vy: 0, speed,
      color: u.champion.accentColor, type: spec.type ?? 'orb', size: spec.size ?? 8,
      targetUnitId: target.id, damage: u.champion.skill1.damage,
      attackerId: u.id, angle: Math.atan2(aim.y - origin.y, aim.x - origin.x),
      skillshot: true, skillLabel: u.champion.skill1.name,
      comboStage: u.comboStage === 1 || u.comboStage === 2 ? u.comboStage : undefined,
      stunOnHit: spec.stunOnHit, charmOnHit: spec.charmOnHit,
      splashRadius: spec.splashRadius, healAlliesOnHit: spec.healAlliesOnHit,
      pullOnHit: spec.pullOnHit, trueDamage: spec.trueDamage,
      collisionRadius: spec.collisionRadius,
    });
    emitSkillEffect(u, u, false, u.champion.skill1.name);
  };

  // Champion Skill 1 Cast (Remarkable High-Visibility Abilities)
  const castChampionSkill1 = (u: AramChampionUnit, target: AramChampionUnit) => {
    sound.playSpellHit();
    const skillshotSpec = FIRST_SKILLSHOTS[u.champion.name];
    if (skillshotSpec) {
      fireFirstSkillshot(u, target, skillshotSpec);
      return;
    }
    emitSkillEffect(u, u.champion.name === 'Astra' ? u : target, false, u.champion.skill1.name);

    if (u.champion.name === 'Solana') {
      target.stunTimer = 1.2;
      applyDamageToChampion(u, target, 120, false, '☀️ Solar Shieldbash');
      spellsRef.current.push({
        id: Math.random().toString(),
        type: 'solar_flare',
        x: target.x,
        y: target.y,
        radius: 35,
        duration: 0.6,
        maxDuration: 0.6,
        color: '#facc15'
      });
      addEvent(`☀️ CC: Solana stunned ${target.player.name} with Solar Shieldbash!`, 'combo');
    } else if (u.champion.name === 'Astra') {
      const dx = target.x - u.x;
      const dy = target.y - u.y;
      const angle = Math.atan2(dy, dx);
      for (let w = -2; w <= 2; w++) {
        projectilesRef.current.push({
          id: Math.random().toString(),
          x: u.x + (u.facing === 'right' ? 18 : -18),
          y: u.y - 15,
          targetX: target.x,
          targetY: target.y - 15 + w * 20,
          vx: 0,
          vy: 0,
          speed: 550,
          color: '#06b6d4',
          type: 'arrow',
          size: 4,
          targetUnitId: target.id,
          damage: 90,
          attackerId: u.id,
          skillshot: true,
          skillLabel: 'Volley Cone',
          comboStage: u.comboStage === 1 || u.comboStage === 2 ? u.comboStage : undefined,
          angle: angle + w * 0.09
        });
      }
      addEvent(`🏹 POKE: Astra fired Volley barrage across the lane!`, 'micro');
    } else if (u.champion.name === 'Kyumi') {
      target.charmTimer = 1.4;
      applyDamageToChampion(u, target, 140, true, '💖 Charm Heart');
      addEvent(`💖 CHARM: Kyumi charmed ${target.player.name} with Fox Charm!`, 'combo');
    } else if (u.champion.name === 'Buck') {
      applyDamageToChampion(u, target, 160, false, '💥 Powder Keg Blast');
    } else if (u.champion.name === 'Valkira') {
      target.stunTimer = 0.8;
      applyDamageToChampion(u, target, 150, false, '⚔️ Crescent Cleave');
      u.shield += 100;
    } else if (u.champion.name === 'Kage') {
      // Zed: Razor Shuriken
      const dx = target.x - u.x;
      const dy = target.y - u.y;
      const angle = Math.atan2(dy, dx);
      projectilesRef.current.push({
        id: Math.random().toString(),
        x: u.x + (u.facing === 'right' ? 16 : -16),
        y: u.y - 14,
        targetX: target.x,
        targetY: target.y - 15,
        vx: 0,
        vy: 0,
        speed: 600,
        color: '#dc2626',
        type: 'shuriken',
        size: 7,
        targetUnitId: target.id,
        damage: 165,
        attackerId: u.id,
        angle
      });
      addEvent(`🥷 SHADOW: Kage hurled Razor Shuriken at ${target.player.name}!`, 'micro');
    } else if (u.champion.name === 'Kazemaru') {
      // Yasuo: Steel Tempest Tornado Knockup!
      const dx = target.x - u.x;
      const dy = target.y - u.y;
      const angle = Math.atan2(dy, dx);
      projectilesRef.current.push({
        id: Math.random().toString(),
        x: u.x + (u.facing === 'right' ? 16 : -16),
        y: u.y - 14,
        targetX: target.x,
        targetY: target.y - 15,
        vx: 0,
        vy: 0,
        speed: 560,
        color: '#38bdf8',
        type: 'tornado',
        size: 14,
        targetUnitId: target.id,
        damage: 145,
        attackerId: u.id,
        angle
      });
      target.stunTimer = 1.5;
      addEvent(`🌪️ TORNADO: Kazemaru knocked ${target.player.name} airborne with Steel Tempest Tornado!`, 'combo');
    } else if (u.champion.name === 'Kindra' || u.champion.name === 'Kindra & Grim') {
      // Kindred: Dance of Arrows
      const dx = target.x - u.x;
      const dy = target.y - u.y;
      const angle = Math.atan2(dy, dx);
      for (let a = -1; a <= 1; a++) {
        projectilesRef.current.push({
          id: Math.random().toString(),
          x: u.x + (u.facing === 'right' ? 16 : -16),
          y: u.y - 15,
          targetX: target.x,
          targetY: target.y - 15 + a * 25,
          vx: 0,
          vy: 0,
          speed: 540,
          color: '#a855f7',
          type: 'spirit_arrow',
          size: 5,
          targetUnitId: target.id,
          damage: 135 / 1.5,
          attackerId: u.id,
          angle: angle + a * 0.12
        });
      }
      addEvent(`🏹 DANCE: Kindra vaulted and unleashed Dance of Arrows!`, 'micro');
    } else if (u.champion.name === 'Cora') {
      // Xayah: Double Daggers
      const dx = target.x - u.x;
      const dy = target.y - u.y;
      const angle = Math.atan2(dy, dx);
      for (let f = -1; f <= 1; f += 2) {
        projectilesRef.current.push({
          id: Math.random().toString(),
          x: u.x + (u.facing === 'right' ? 16 : -16),
          y: u.y - 15,
          targetX: target.x,
          targetY: target.y - 15 + f * 15,
          vx: 0,
          vy: 0,
          speed: 580,
          color: '#ec4899',
          type: 'feather',
          size: 6,
          targetUnitId: target.id,
          damage: 75,
          attackerId: u.id,
          angle: angle + f * 0.08
        });
      }
      addEvent(`🪶 FEATHERS: Cora flung Double Dagger quill barrage!`, 'micro');
    } else if (u.champion.name === 'Renn') {
      // Rakan: Grand Entrance Knockup!
      u.x = target.x - (u.facing === 'right' ? 25 : -25);
      u.y = target.y;
      target.stunTimer = 1.2;
      applyDamageToChampion(u, target, 115, false, '✨ Grand Entrance');
      spellsRef.current.push({
        id: Math.random().toString(),
        type: 'grand_entrance',
        x: target.x,
        y: target.y,
        radius: 45,
        duration: 0.8,
        maxDuration: 0.8,
        color: '#f59e0b'
      });
      addEvent(`✨ DIVE: Renn leaped with Grand Entrance and knocked up ${target.player.name}!`, 'combo');
    } else if (u.champion.name === 'Sylla') {
      // Lone Druid: Summon Spirit Bear & Entangling Claws
      target.stunTimer = 1.5;
      applyDamageToChampion(u, target, 130, false, '🐻 Entangling Claws');
      spellsRef.current.push({
        id: Math.random().toString(),
        type: 'spirit_bear',
        x: target.x,
        y: target.y,
        radius: 35,
        duration: 1.5,
        maxDuration: 1.5,
        color: '#10b981'
      });
      addEvent(`🐻 BEAR: Sylla's Spirit Bear clamped down with Entangling Claws on ${target.player.name}!`, 'combo');
    } else if (u.champion.name === 'Tequoia') {
      // Nature's Prophet: Sprout Ring of Trees!
      target.stunTimer = 2.0;
      applyDamageToChampion(u, target, 90, false, '🌲 Sprout');
      spellsRef.current.push({
        id: Math.random().toString(),
        type: 'sprout_ring',
        x: target.x,
        y: target.y,
        radius: 42,
        duration: 2.8,
        maxDuration: 2.8,
        color: '#22c55e',
        targetUnitId: target.id
      });
      addEvent(`🌲 SPROUT: Tequoia encircled ${target.player.name} in a living cage of oak trees!`, 'combo');
    } else if (u.champion.name === 'Zal') {
      // Dazzle: Shadow Wave heal & zap
      championsRef.current.filter((c) => c.team === u.team && c.isAlive).forEach((ally) => {
        ally.hp = Math.min(ally.maxHp, ally.hp + 180);
      });
      applyDamageToChampion(u, target, 130, false, '⚡ Shadow Wave');
      addEvent(`💖 SHADOW WAVE: Zal restored +180 HP to all allies and zapped ${target.player.name}!`, 'combo');
    } else if (u.champion.name === 'Xin') {
      // Ember Spirit: Searing Chains
      target.stunTimer = 1.8;
      applyDamageToChampion(u, target, 140, false, '🔥 Searing Chains');
      addEvent(`🔥 CHAINS: Xin locked down ${target.player.name} in flaming Searing Chains!`, 'combo');
    } else if (u.champion.name === 'Raijin') {
      // Storm Spirit: Static Remnant
      spellsRef.current.push({
        id: Math.random().toString(),
        type: 'static_remnant',
        x: u.x,
        y: u.y,
        radius: 40,
        duration: 3.0,
        maxDuration: 3.0,
        color: '#06b6d4'
      });
      applyDamageToChampion(u, target, 140, false, '⚡ Static Remnant');
      addEvent(`⚡ STATIC: Raijin planted a crackling Static Remnant!`, 'micro');
    } else if (u.champion.name === 'Kaolin') {
      // Earth Spirit: Boulder Smash
      const dx = target.x - u.x;
      const dy = target.y - u.y;
      const angle = Math.atan2(dy, dx);
      projectilesRef.current.push({
        id: Math.random().toString(),
        x: u.x + (u.facing === 'right' ? 16 : -16),
        y: u.y - 12,
        targetX: target.x,
        targetY: target.y - 15,
        vx: 0,
        vy: 0,
        speed: 550,
        color: '#059669',
        type: 'boulder',
        size: 13,
        targetUnitId: target.id,
        damage: 135,
        attackerId: u.id,
        angle
      });
      target.stunTimer = 1.5;
      addEvent(`🗿 BOULDER: Kaolin smashed a giant jade boulder into ${target.player.name}!`, 'combo');
    } else if (u.champion.name === 'Inai') {
      // Void Spirit: Aether Remnant
      target.stunTimer = 1.4;
      applyDamageToChampion(u, target, 125, false, '🔮 Aether Remnant');
      addEvent(`🔮 VOID: Inai pulled ${target.player.name} through the Aether Remnant gaze!`, 'combo');
    } else if (u.champion.name === 'Qiyana') {
      target.stunTimer = Math.max(target.stunTimer, 0.8);
      applyDamageToChampion(u, target, u.champion.skill1.damage, false, 'Elemental Wrath');
    } else if (u.champion.name === 'Locke' || u.champion.name === 'Shadow Fiend') {
      applyDamageToChampion(u, target, u.champion.skill1.damage, false, u.champion.skill1.name);
      championsRef.current.filter(e => e.team !== u.team && e.id !== target.id && e.isAlive && Math.hypot(e.x - target.x, e.y - target.y) < 65)
        .forEach(e => applyDamageToChampion(u, e, 80, false, u.champion.skill1.name));
    } else if (u.champion.name === 'Senna') {
      applyDamageToChampion(u, target, u.champion.skill1.damage, false, 'Piercing Darkness');
      championsRef.current.filter(a => a.team === u.team && a.isAlive && Math.hypot(a.x - u.x, a.y - u.y) < 180)
        .forEach(a => { a.hp = Math.min(a.maxHp, a.hp + 110); emitSkillEffect(u, a); });
    } else if (u.champion.name === 'Largo') {
      target.x += u.team === 'blue' ? -35 : 35;
      target.stunTimer = Math.max(target.stunTimer, 0.7);
      applyDamageToChampion(u, target, u.champion.skill1.damage, false, 'Catchy Lick');
    } else if (u.champion.name === 'Earthshaker') {
      target.stunTimer = Math.max(target.stunTimer, 1.4);
      applyDamageToChampion(u, target, u.champion.skill1.damage, false, 'Fissure');
      championsRef.current.filter(e => e.team !== u.team && e.id !== target.id && e.isAlive && Math.abs(e.y - target.y) < 32 && Math.abs(e.x - target.x) < 90)
        .forEach(e => { e.stunTimer = Math.max(e.stunTimer, 0.9); applyDamageToChampion(u, e, 95, false, 'Fissure'); });
    }
  };

  const castChampionSkill2 = (u: AramChampionUnit, target: AramChampionUnit) => {
    const name = u.champion.name;
    const skill = u.champion.skill2;
    const nearbyAllies = championsRef.current.filter(c => c.team === u.team && c.isAlive);
    const nearbyEnemies = championsRef.current.filter(c => c.team !== u.team && c.isAlive);
    sound.playSpellHit();
    emitSkillEffect(u, target, false, skill.name);

    if (name === 'Solana') {
      u.x = target.x + (u.team === 'blue' ? -28 : 28);
      target.stunTimer = Math.max(target.stunTimer, 1.1);
    } else if (name === 'Kyumi') {
      target.charmTimer = Math.max(target.charmTimer, 1.4);
    } else if (name === 'Buck') {
      spellsRef.current.push({ id: Math.random().toString(), type: 'smoke_screen',
        x: target.x, y: target.y, radius: 55, duration: 2.5, maxDuration: 2.5, color: '#94a3b8' });
    } else if (name === 'Valkira' || name === 'Kaolin') {
      u.shield += name === 'Valkira' ? 200 : 160;
    } else if (name === 'Kage' || name === 'Inai') {
      u.x = target.x + (u.team === 'blue' ? -32 : 32);
      u.y = target.y - 12;
    } else if (name === 'Kazemaru') {
      spellsRef.current.push({ id: Math.random().toString(), type: 'wind_wall',
        x: u.x + (target.x - u.x) * 0.5, y: u.y, radius: 50,
        duration: 3.5, maxDuration: 3.5, color: '#38bdf8' });
    } else if (name === 'Cora' || name === 'Sylla' || name === 'Raijin') {
      target.stunTimer = Math.max(target.stunTimer, name === 'Cora' ? 1.3 : 1.0);
      if (name === 'Raijin') target.x = u.x + (u.team === 'blue' ? 45 : -45);
    } else if (name === 'Renn') {
      const ally = nearbyAllies.filter(c => c.id !== u.id).sort((a, b) => a.hp / a.maxHp - b.hp / b.maxHp)[0];
      u.shield += 220;
      if (ally) { ally.shield += 220; emitSkillEffect(u, ally); }
    } else if (name === 'Zal') {
      nearbyAllies.filter(c => Math.hypot(c.x - u.x, c.y - u.y) < 200).forEach(c => {
        c.hp = Math.min(c.maxHp, c.hp + 180);
        emitSkillEffect(u, c);
      });
    } else if (name === 'Xin') {
      nearbyEnemies.filter(c => c.id !== target.id && Math.hypot(c.x - target.x, c.y - target.y) < 90)
        .forEach(c => applyDamageToChampion(u, c, skill.damage * 0.6, false, skill.name));
    } else if (name === 'Qiyana' || name === 'Locke') {
      u.x = target.x + (u.team === 'blue' ? -30 : 30);
      u.y = target.y;
    } else if (name === 'Senna') {
      target.stunTimer = Math.max(target.stunTimer, 1.3);
      nearbyEnemies.filter(c => c.id !== target.id && Math.hypot(c.x - target.x, c.y - target.y) < 70)
        .forEach(c => { c.stunTimer = Math.max(c.stunTimer, 0.8); applyDamageToChampion(u, c, 65, false, skill.name); });
    } else if (name === 'Largo') {
      target.stunTimer = Math.max(target.stunTimer, 0.8);
      nearbyEnemies.filter(c => c.id !== target.id && Math.hypot(c.x - target.x, c.y - target.y) < 85)
        .forEach(c => { c.stunTimer = Math.max(c.stunTimer, 0.5); applyDamageToChampion(u, c, 75, false, skill.name); });
    } else if (name === 'Shadow Fiend') {
      u.shield += 110;
      nearbyEnemies.filter(c => c.id !== target.id && Math.hypot(c.x - u.x, c.y - u.y) < 95)
        .forEach(c => applyDamageToChampion(u, c, 65, false, skill.name));
    } else if (name === 'Earthshaker') {
      target.stunTimer = Math.max(target.stunTimer, 1.0);
      u.shield += 130;
    }

    if (skill.damage > 0 && target.isAlive) {
      applyDamageToChampion(u, target, skill.damage, skill.damageType === 'True', skill.name);
    }
    addEvent(`✨ ${u.player.name} used ${skill.name}!`, 'combo');
  };

  // Champion Ultimate Cast (Level 6 Spike: 75s / 60s / 45s CD)
  const castChampionUltimate = (u: AramChampionUnit, target: AramChampionUnit, enemies: AramChampionUnit[]) => {
    sound.playUltimateExplosion();
    emitSkillEffect(u, u.champion.name === 'Astra' ? u : target, true, u.champion.ultimate.name);
    confetti({ particleCount: 65, spread: 55, origin: { x: u.x / ARENA_WIDTH, y: 0.4 } });

    const ultRank = u.level >= 16 ? 3 : u.level >= 11 ? 2 : 1;
    const ultDamage = Math.round(u.champion.ultimate.damage * (1 + (ultRank - 1) * 0.25));

    showBanner(
      `💥 ${u.player.name.toUpperCase()} CAST ${u.champion.ultimate.name.toUpperCase()}!`,
      `Rank ${ultRank} Ultimate Power Spike Unleashed!`,
      '⚡'
    );
    addEvent(`💥 ULTIMATE: ${u.player.name} unleashed ${u.champion.ultimate.name} (Rank ${ultRank})!`, 'combo');

    if (u.champion.name === 'Solana') {
      spellsRef.current.push({
        id: Math.random().toString(),
        type: 'solar_flare',
        x: target.x,
        y: target.y,
        radius: 80,
        duration: 1.2,
        maxDuration: 1.2,
        color: '#f59e0b'
      });
      enemies.filter((e) => Math.hypot(e.x - target.x, e.y - target.y) <= 80).forEach((e) => {
        e.stunTimer = 1.8;
        applyDamageToChampion(u, e, ultDamage, false, '☀️ Solar Flare');
      });
    } else if (u.champion.name === 'Astra') {
      const dx = target.x - u.x;
      const dy = target.y - u.y;
      const angle = Math.atan2(dy, dx);
      projectilesRef.current.push({
        id: Math.random().toString(),
        x: u.x,
        y: u.y - 15,
        targetX: target.x,
        targetY: target.y - 15,
        vx: 0,
        vy: 0,
        speed: 620,
        color: '#38bdf8',
        type: 'ult_arrow',
        size: 14,
        targetUnitId: target.id,
        damage: ultDamage,
        attackerId: u.id,
        skillshot: true,
        skillLabel: 'Crystal Comet',
        stunOnHit: 2.5,
        collisionRadius: 25,
        angle
      });
    } else if (u.champion.name === 'Kyumi') {
      target.charmTimer = 1.6;
      applyDamageToChampion(u, target, ultDamage, true, '💖 Spirit Rush');
    } else if (u.champion.name === 'Buck') {
      applyDamageToChampion(u, target, ultDamage, false, '💥 Collateral Blast');
    } else if (u.champion.name === 'Valkira') {
      applyDamageToChampion(u, target, ultDamage * 1.3, false, '🩸 Executioner Descent');
    } else if (u.champion.name === 'Kage') {
      // Zed: Death Mark
      u.x = target.x - (u.facing === 'right' ? 25 : -25);
      u.y = target.y;
      spellsRef.current.push({
        id: Math.random().toString(),
        type: 'death_mark',
        x: target.x,
        y: target.y,
        radius: 40,
        duration: 3.0,
        maxDuration: 3.0,
        color: '#dc2626',
        targetUnitId: target.id
      });
      applyDamageToChampion(u, target, ultDamage, false, '🩸 Death Mark');
      showBanner(`🩸 DEATH MARK!`, `${u.player.name} branded ${target.player.name} with Death Mark!`, '🩸');
    } else if (u.champion.name === 'Kazemaru') {
      // Yasuo: Wind Wall & Last Breath
      spellsRef.current.push({
        id: Math.random().toString(),
        type: 'wind_wall',
        x: u.x + (u.facing === 'right' ? 35 : -35),
        y: u.y,
        radius: 50,
        duration: 3.5,
        maxDuration: 3.5,
        color: '#38bdf8'
      });
      u.x = target.x;
      u.y = target.y - 15;
      target.stunTimer = 1.8;
      applyDamageToChampion(u, target, ultDamage, false, '⚔️ Last Breath (50% Shred)');
      showBanner(`⚔️ LAST BREATH!`, `${u.player.name} suspended ${target.player.name} in mid-air with Last Breath!`, '⚔️');
    } else if (u.champion.name === 'Kindra' || u.champion.name === 'Kindra & Grim') {
      // Kindred: Lamb's Respite
      spellsRef.current.push({
        id: Math.random().toString(),
        type: 'lambs_respite',
        x: u.x,
        y: u.y,
        radius: 65,
        duration: 4.0,
        maxDuration: 4.0,
        color: '#facc15'
      });
      championsRef.current.filter((c) => c.team === u.team && c.isAlive).forEach((ally) => {
        ally.hp = Math.min(ally.maxHp, ally.hp + 450);
      });
      showBanner(`✨ LAMB'S RESPITE!`, `${u.player.name} blessed a golden sanctuary of immortality!`, '✨');
    } else if (u.champion.name === 'Cora') {
      // Xayah: Featherstorm & Bladecaller
      applyDamageToChampion(u, target, ultDamage, false, '🪶 Featherstorm');
      target.stunTimer = 1.3;
      showBanner(`🪶 FEATHERSTORM!`, `${u.player.name} leaped untargetable and recalled all quills!`, '🪶');
    } else if (u.champion.name === 'Renn') {
      // Rakan: The Quickness
      enemies.forEach((e) => {
        if (Math.hypot(e.x - u.x, e.y - u.y) <= 120) {
          e.charmTimer = 1.5;
          applyDamageToChampion(u, e, ultDamage * 0.75, false, '✨ The Quickness');
        }
      });
      showBanner(`✨ THE QUICKNESS!`, `${u.player.name} charmed the enemy team in high-speed dance!`, '✨');
    } else if (u.champion.name === 'Sylla') {
      // Lone Druid: True Form & Savage Roar
      u.maxHp += 600;
      u.hp += 600;
      u.champion.armor += 35;
      enemies.forEach((e) => {
        if (Math.hypot(e.x - u.x, e.y - u.y) <= 90) e.stunTimer = 1.3;
      });
      applyDamageToChampion(u, target, ultDamage, false, '🐻 True Form Roar');
      showBanner(`🐻 TRUE FORM!`, `${u.player.name} transformed into the colossal Ironclaw Bear!`, '🐻');
    } else if (u.champion.name === 'Tequoia') {
      // Nature's Prophet: Wrath of Nature
      enemies.forEach((e, idx) => {
        const bounceDmg = Math.round(ultDamage * (1 + idx * 0.1));
        applyDamageToChampion(u, e, bounceDmg, false, '⚡ Wrath of Nature');
      });
      showBanner(`⚡ WRATH OF NATURE!`, `${u.player.name} unleashed bouncing green solar lightning!`, '⚡');
    } else if (u.champion.name === 'Zal') {
      // Dazzle: Shallow Grave!
      const lowestAlly = championsRef.current
        .filter((c) => c.team === u.team && c.isAlive)
        .sort((a, b) => a.hp - b.hp)[0];
      if (lowestAlly) {
        spellsRef.current.push({
          id: Math.random().toString(),
          type: 'shallow_grave',
          x: lowestAlly.x,
          y: lowestAlly.y,
          radius: 35,
          duration: 4.5,
          maxDuration: 4.5,
          color: '#ec4899',
          targetUnitId: lowestAlly.id
        });
        showBanner(`💖 SHALLOW GRAVE!`, `${u.player.name} placed the pink cross of immortality on ${lowestAlly.player.name}!`, '💖');
      }
    } else if (u.champion.name === 'Xin') {
      // Ember Spirit: Sleight of Fist & Remnants
      spellsRef.current.push({
        id: Math.random().toString(),
        type: 'sleight_circle',
        x: target.x,
        y: target.y,
        radius: 45,
        duration: 1.0,
        maxDuration: 1.0,
        color: '#ea580c'
      });
      enemies.filter((e) => Math.hypot(e.x - target.x, e.y - target.y) <= 80).forEach((e) => {
        applyDamageToChampion(u, e, ultDamage, false, '🔥 Sleight of Fist');
      });
      showBanner(`🔥 SLEIGHT OF FIST!`, `${u.player.name} slashed through the flame remnant field!`, '🔥');
    } else if (u.champion.name === 'Raijin') {
      // Storm Spirit: Ball Lightning
      u.x = target.x;
      u.y = target.y;
      spellsRef.current.push({
        id: Math.random().toString(),
        type: 'ball_lightning',
        x: target.x,
        y: target.y,
        radius: 55,
        duration: 1.0,
        maxDuration: 1.0,
        color: '#06b6d4'
      });
      applyDamageToChampion(u, target, ultDamage, false, '⚡ Ball Lightning');
      showBanner(`⚡ BALL LIGHTNING!`, `${u.player.name} zipped in supersonic ball lightning blast!`, '⚡');
    } else if (u.champion.name === 'Kaolin') {
      // Earth Spirit: Magnetize
      spellsRef.current.push({
        id: Math.random().toString(),
        type: 'magnetize_pulse',
        x: u.x,
        y: u.y,
        radius: 55,
        duration: 2.0,
        maxDuration: 2.0,
        color: '#059669'
      });
      enemies.filter((e) => Math.hypot(e.x - u.x, e.y - u.y) <= 100).forEach((e) => {
        e.stunTimer = 1.0;
        applyDamageToChampion(u, e, ultDamage, false, '🗿 Magnetize');
      });
      showBanner(`🗿 MAGNETIZE!`, `${u.player.name} triggered resonant jade magnetic shockwaves!`, '🗿');
    } else if (u.champion.name === 'Inai') {
      // Void Spirit: Astral Step
      u.x = target.x + (u.facing === 'right' ? 30 : -30);
      applyDamageToChampion(u, target, ultDamage, true, '🔮 Astral Step');
      showBanner(`🔮 ASTRAL STEP!`, `${u.player.name} cut through reality with planar Astral Step!`, '🔮');
    } else if (u.champion.name === 'Qiyana' || u.champion.name === 'Locke' || u.champion.name === 'Shadow Fiend' || u.champion.name === 'Earthshaker') {
      const radius = u.champion.name === 'Earthshaker' ? 155 : 115;
      const center = u.champion.name === 'Shadow Fiend' || u.champion.name === 'Earthshaker' ? u : target;
      const victims = enemies.filter(e => e.isAlive && Math.hypot(e.x - center.x, e.y - center.y) <= radius);
      victims.forEach(e => {
        if (u.champion.name === 'Qiyana' || u.champion.name === 'Earthshaker') e.stunTimer = Math.max(e.stunTimer, 1.5);
        if (u.champion.name === 'Shadow Fiend') e.charmTimer = Math.max(e.charmTimer, 1.0);
        applyDamageToChampion(u, e, ultDamage * (u.champion.name === 'Earthshaker' ? 0.85 + victims.length * 0.08 : 1), false, u.champion.ultimate.name);
        emitSkillEffect(u, e, true, u.champion.ultimate.name);
      });
    } else if (u.champion.name === 'Senna') {
      enemies.filter(e => e.isAlive && Math.abs(e.y - target.y) < 90).forEach(e => {
        applyDamageToChampion(u, e, ultDamage, false, 'Dawning Shadow');
        emitSkillEffect(u, e, true, 'Dawning Shadow');
      });
      championsRef.current.filter(a => a.team === u.team && a.isAlive).forEach(a => {
        a.shield += 220;
        emitSkillEffect(u, a, true, 'Dawning Shadow');
      });
    } else if (u.champion.name === 'Largo') {
      championsRef.current.filter(a => a.team === u.team && a.isAlive).forEach(a => {
        a.hp = Math.min(a.maxHp, a.hp + 300);
        a.shield += 120;
        emitSkillEffect(u, a, true, 'Amphibian Rhapsody');
      });
      enemies.filter(e => e.isAlive && Math.hypot(e.x - u.x, e.y - u.y) < 145)
        .forEach(e => applyDamageToChampion(u, e, ultDamage, false, 'Amphibian Rhapsody'));
    }
  };

  const applyDamageToChampion = (
    attacker: AramChampionUnit | null,
    target: AramChampionUnit,
    rawDamage: number,
    isTrueDamage: boolean = false,
    label?: string
  ) => {
    if (target.zhonyaActive) return;

    // Interrupt Recall channel immediately if taking damage
    if (target.isRecalling) {
      target.isRecalling = false;
      target.recallTimer = 0;
      floatsRef.current.push({
        id: Math.random().toString(),
        x: target.x,
        y: target.y - 42,
        text: `❌ RECALL CANCELLED!`,
        color: '#ef4444',
        opacity: 1,
        scale: 1.2
      });
      sound.playSpellHit();
    }

    const ap = label && attacker && (attacker.champion.primaryRole === 'Mage' || attacker.champion.secondaryRole === 'Mage')
      ? attacker.items.reduce((total, item) => total + (item.stats.ap ?? 0), 0) : 0;
    const spellDamage = rawDamage + ap * 0.35;
    let effective = isTrueDamage ? spellDamage : spellDamage * (100 / (100 + target.champion.armor));

    if (attacker?.isInBush) {
      effective *= 1.3;
      showBanner('🌿 BRUSH AMBUSH TRAP!', `${attacker.player.name} leaped from brush with an ambush crit!`, '🌿');
      addEvent(`🌿 AMBUSH: ${attacker.player.name} caught ${target.player.name} from brush!`, 'combo');
    }

    const finalDamage = Math.round(effective);

    // Sterak's Lifeline
    const hasSteraks = target.items.some((it) => it.id === 'item_steraks');
    if (hasSteraks && target.hp - finalDamage <= target.maxHp * 0.3 && target.sterakCooldown <= 0) {
      target.shield += 600;
      target.sterakCooldown = 60.0;
      sound.playCoin();
      floatsRef.current.push({
        id: Math.random().toString(),
        x: target.x,
        y: target.y - 30,
        text: '🛡️ STERAK LIFELINE (+600)',
        color: '#f59e0b',
        opacity: 1,
        scale: 1.3
      });
    }

    // Zhonya's Stasis
    const hasZhonyas = target.items.some((it) => it.id === 'item_zhonyas');
    if (hasZhonyas && target.hp - finalDamage <= 0 && target.zhonyaTimer <= 0) {
      target.zhonyaActive = true;
      target.zhonyaTimer = 90.0;
      target.hp = 1;
      sound.playSpellHit();
      floatsRef.current.push({
        id: Math.random().toString(),
        x: target.x,
        y: target.y - 30,
        text: '⏳ GOLDEN STASIS!',
        color: '#facc15',
        opacity: 1,
        scale: 1.4
      });
      setTimeout(() => { target.zhonyaActive = false; }, 2500);
      return;
    }

    // Shallow Grave: Ally cannot fall below 1 HP!
    const hasShallowGrave = spellsRef.current.some((s) => s.type === 'shallow_grave' && s.targetUnitId === target.id);
    // Lamb's Respite: Units inside cannot fall below 10% HP!
    const inLambsRespite = spellsRef.current.some((s) => s.type === 'lambs_respite' && Math.hypot(s.x - target.x, s.y - target.y) <= s.radius);

    const minFloorHp = hasShallowGrave ? 1 : inLambsRespite ? Math.round(target.maxHp * 0.10) : 0;
    target.hp = Math.max(minFloorHp, target.hp - finalDamage);

    if (minFloorHp > 0 && target.hp === minFloorHp) {
      floatsRef.current.push({
        id: Math.random().toString(),
        x: target.x,
        y: target.y - 32,
        text: hasShallowGrave ? '💖 SHALLOW GRAVE RESCUE!' : '✨ IMMORTAL SANCTUARY!',
        color: hasShallowGrave ? '#ec4899' : '#facc15',
        opacity: 1,
        scale: 1.2
      });
    }

    target.damageTaken += finalDamage;
    if (attacker) attacker.damageDealt += finalDamage;

    floatsRef.current.push({
      id: Math.random().toString(),
      x: target.x + (Math.random() - 0.5) * 20,
      y: target.y - 28,
      text: label ? `${label} -${finalDamage}` : `-${finalDamage}`,
      color: attacker?.team === 'blue' ? '#38bdf8' : '#f43f5e',
      opacity: 1,
      scale: 1.0
    });

    if (target.hp <= 0 && target.isAlive) {
      target.isAlive = false;
      target.deaths++;
      target.respawnTimer = calculateDeathTimer(target.level, matchTime);
      target.comboStage = 0;
      target.comboHitConfirmed = false;
      target.isRecalling = false;
      target.recallTimer = 0;

      let multiKillTitle: 'DOUBLE KILL' | 'TRIPLE KILL' | 'QUADRA KILL' | 'PENTA KILL' | null = null;
      let streakTitle: string | null = null;
      let isFirstBlood = false;

      if (attacker) {
        attacker.kills++;
        attacker.gold += 300;
        grantChampionXp(attacker, 240);

        if (!firstBloodRef.current) {
          firstBloodRef.current = true;
          isFirstBlood = true;
          attacker.gold += 150;
        }

        // Multikill & Spree tracking
        const tracker = killStreaksRef.current[attacker.id] || { count: 0, lastTime: 0, multiCount: 0 };
        const timeSinceLast = matchTime - tracker.lastTime;
        if (timeSinceLast <= 11.0) {
          tracker.multiCount += 1;
        } else {
          tracker.multiCount = 1;
        }
        tracker.count += 1;
        tracker.lastTime = matchTime;
        killStreaksRef.current[attacker.id] = tracker;

        if (tracker.multiCount === 2) multiKillTitle = 'DOUBLE KILL';
        else if (tracker.multiCount === 3) multiKillTitle = 'TRIPLE KILL';
        else if (tracker.multiCount === 4) multiKillTitle = 'QUADRA KILL';
        else if (tracker.multiCount >= 5) multiKillTitle = 'PENTA KILL';

        if (tracker.count === 3) streakTitle = 'KILLING SPREE';
        else if (tracker.count === 4) streakTitle = 'RAMPAGE';
        else if (tracker.count === 5) streakTitle = 'UNSTOPPABLE';
        else if (tracker.count >= 6) streakTitle = 'GODLIKE / LEGENDARY';

        sound.playSpellHit();
        if (multiKillTitle) {
          sound.playUltimateExplosion();
          confetti({ particleCount: 75, spread: 70, origin: { x: 0.5, y: 0.2 } });
        }

        if (attacker.team === 'blue') setBlueGold((g) => g + 300 + (isFirstBlood ? 150 : 0));
        else setRedGold((g) => g + 300 + (isFirstBlood ? 150 : 0));
      }

      if (target && killStreaksRef.current[target.id]) {
        killStreaksRef.current[target.id].count = 0;
      }

      if (attacker?.team === 'blue') setBlueKills((k) => k + 1);
      else if (attacker?.team === 'red') setRedKills((k) => k + 1);

      const neutralKiller = label?.includes('Jungle Camp') ? 'Jungle Camp'
        : label?.includes('Flame Breath') ? dragonRef.current.name : null;
      const killerName = attacker?.player.name || neutralKiller || 'Turret';

      // Trigger the top kill callout
      const callout: KillCallout = {
        id: Math.random().toString(),
        killerName,
        killerChamp: attacker?.champion.name || 'Structure',
        killerTeam: attacker?.team || (target.team === 'blue' ? 'red' : 'blue'),
        killerAvatar: attacker?.player.avatarSvg,
        victimName: target.player.name,
        victimChamp: target.champion.name,
        victimTeam: target.team,
        victimAvatar: target.player.avatarSvg,
        multiKill: multiKillTitle,
        streakText: streakTitle,
        isFirstBlood
      };

      if (!neutralKiller) {
        setKillCallout(callout);
        setTimeout(() => {
          setKillCallout((curr) => (curr?.id === callout.id ? null : curr));
        }, 4200);
      }

      const killEventText = multiKillTitle
        ? `🔥 ${multiKillTitle}! ${attacker?.player.name} eliminated ${target.player.name}!`
        : `☠️ ${killerName} eliminated ${target.player.name} (${target.champion.name})`;
      addEvent(killEventText, 'kill');
    }
  };

  const applyDamageToStructure = (attacker: AramChampionUnit, structure: LaneStructure, damage: number) => {
    const nearbyAlliedMinions = minionsRef.current.filter((m) => m.team === attacker.team && Math.abs(m.x - structure.x) <= 220);
    const backdoorFactor = nearbyAlliedMinions.length > 0 ? 1.0 : 0.34;

    const finalDamage = Math.round(damage * backdoorFactor);
    damageStructure(structure, finalDamage);

    floatsRef.current.push({
      id: Math.random().toString(),
      x: structure.x,
      y: structure.y - 40,
      text: `-${finalDamage}`,
      color: '#facc15',
      opacity: 1,
      scale: 1.1
    });

  };

  const damageStructure = (structure: LaneStructure, damage: number) => {
    if (!structure.isAlive) return;
    structure.hp = Math.max(0, structure.hp - damage);
    if (structure.hp === 0) handleStructureDestruction(structure);
  };

  const handleStructureDestruction = (structure: LaneStructure) => {
    structure.isAlive = false;
    sound.playUltimateExplosion();

    if (structure.type === 'nexus') return;
    const isTower = structure.type !== 'barracks';
    const bounty = isTower ? 250 : 200;

    if (structure.team === 'blue') {
      setRedGold((g) => g + bounty * 5);
      if (isTower) setBlueTowersAlive((t) => Math.max(0, t - 1));
    } else {
      setBlueGold((g) => g + bounty * 5);
      if (isTower) setRedTowersAlive((t) => Math.max(0, t - 1));
    }

    const bonus = structure.barracksKind ? `${structure.barracksKind.toUpperCase()} creeps upgraded from the next wave!` : 'Causeways advanced!';
    showBanner(`🏰 ${structure.name} DESTROYED!`, `+${bounty}g Team Bounty. ${bonus}`, '🏰');
    addEvent(`🏰 ${structure.name} destroyed! ${bonus}`, 'tower');
    confetti({ particleCount: 80, spread: 60, origin: { x: structure.x / ARENA_WIDTH, y: 0.5 } });
  };

  const applyDamageToMinion = (attacker: AramChampionUnit, minion: LaneMinion, damage: number) => {
    minion.hp -= damage;
    if (minion.hp <= 0 && minion.isAlive) {
      minion.isAlive = false;
      attacker.cs += 1;
      attacker.gold += minion.goldReward;
      grantChampionXp(attacker, minion.xpReward);

      championsRef.current
        .filter((c) => c.team === attacker.team && c.id !== attacker.id && c.isAlive && Math.hypot(c.x - minion.x, c.y - minion.y) <= 320)
        .forEach((ally) => grantChampionXp(ally, Math.round(minion.xpReward * 0.7)));

      if (attacker.team === 'blue') setBlueGold((g) => g + minion.goldReward);
      else setRedGold((g) => g + minion.goldReward);

      floatsRef.current.push({
        id: Math.random().toString(),
        x: minion.x,
        y: minion.y - 15,
        text: `+${minion.goldReward}g`,
        color: '#facc15',
        opacity: 0.9,
        scale: 0.9
      });
    }
  };

  const endAramMatch = (winner: 'blue' | 'red') => {
    setMatchOver(true);
    sound.playWalkoutFanfare();
    confetti({ particleCount: 220, spread: 100, origin: { y: 0.4 } });

    const all = championsRef.current;
    const mvp = all.sort((a, b) => b.kills * 4 + b.cs * 2 + b.damageDealt / 300 - a.kills * 4 - a.cs * 2 - a.damageDealt / 300)[0];
    onMatchComplete(winner, mvp, all);
  };

  // =========================================================================
  // DEDICATED PROCEDURAL MODELS FOR JUNGLE MONSTERS & DRAGON
  // =========================================================================

  // 1. Frost Sentinel (Granite & Ice Golem)
  const drawFrostSentinelModel = (ctx: CanvasRenderingContext2D, animTime: number) => {
    const bob = Math.sin(animTime * 3) * 2;
    ctx.save();
    ctx.translate(0, bob);
    // Ground shadow
    ctx.fillStyle = 'rgba(0,0,0,0.45)';
    ctx.beginPath();
    ctx.ellipse(0, 14, 18, 6, 0, 0, Math.PI * 2);
    ctx.fill();

    // Stone Legs
    ctx.fillStyle = '#334155';
    ctx.fillRect(-10, 2, 8, 12);
    ctx.fillRect(2, 2, 8, 12);

    // Heavy Granite Torso
    ctx.fillStyle = '#1e293b';
    ctx.strokeStyle = '#475569';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.roundRect(-14, -14, 28, 18, 4);
    ctx.fill();
    ctx.stroke();

    // Glowing Cyan Core
    ctx.fillStyle = '#38bdf8';
    ctx.shadowColor = '#00f2ff';
    ctx.shadowBlur = 8;
    ctx.beginPath();
    ctx.arc(0, -5, 4.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;

    // Ice Crystal Shoulders
    ctx.fillStyle = '#67e8f9';
    ctx.beginPath();
    ctx.moveTo(-16, -14); ctx.lineTo(-24, -22); ctx.lineTo(-12, -18); ctx.fill();
    ctx.moveTo(16, -14); ctx.lineTo(24, -22); ctx.lineTo(12, -18); ctx.fill();

    // Golem Head & Eye Slit
    ctx.fillStyle = '#334155';
    ctx.fillRect(-7, -24, 14, 10);
    ctx.fillStyle = '#38bdf8';
    ctx.fillRect(-5, -21, 3, 2);
    ctx.fillRect(2, -21, 3, 2);

    // Stone Fists
    ctx.fillStyle = '#475569';
    ctx.beginPath();
    ctx.arc(-16, 0, 6, 0, Math.PI * 2);
    ctx.arc(16, 0, 6, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  };

  // 2. Shadow Stalkers (Dire Wolves)
  const drawShadowWolfModel = (ctx: CanvasRenderingContext2D, animTime: number) => {
    const breathe = Math.sin(animTime * 4) * 1.5;
    ctx.save();
    ctx.translate(0, breathe);
    ctx.fillStyle = 'rgba(0,0,0,0.45)';
    ctx.beginPath();
    ctx.ellipse(0, 12, 16, 5, 0, 0, Math.PI * 2);
    ctx.fill();

    // Tail
    ctx.strokeStyle = '#4c1d95';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(-12, -2);
    ctx.quadraticCurveTo(-20, -10, -22, 2);
    ctx.stroke();

    // Wolf Body
    ctx.fillStyle = '#2e1065';
    ctx.beginPath();
    ctx.ellipse(0, 0, 16, 9, 0, 0, Math.PI * 2);
    ctx.fill();

    // Spiky Fur Crest
    ctx.fillStyle = '#581c87';
    ctx.beginPath();
    ctx.moveTo(-6, -8); ctx.lineTo(2, -16); ctx.lineTo(10, -6); ctx.fill();

    // Head & Muzzle
    ctx.fillStyle = '#2e1065';
    ctx.beginPath();
    ctx.moveTo(8, -6);
    ctx.lineTo(20, -1);
    ctx.lineTo(10, 4);
    ctx.closePath();
    ctx.fill();

    // Ears
    ctx.fillStyle = '#7c3aed';
    ctx.beginPath();
    ctx.moveTo(8, -8); ctx.lineTo(10, -18); ctx.lineTo(13, -7); ctx.fill();

    // Glowing Purple Eye
    ctx.fillStyle = '#c084fc';
    ctx.beginPath();
    ctx.arc(12, -3, 2, 0, Math.PI * 2);
    ctx.fill();

    // Paws
    ctx.fillStyle = '#1e1b4b';
    ctx.fillRect(-8, 6, 4, 7);
    ctx.fillRect(6, 6, 4, 7);
    ctx.restore();
  };

  // 3. Murk Behemoth (Armored Swamp Beast)
  const drawMurkBehemothModel = (ctx: CanvasRenderingContext2D, animTime: number) => {
    const step = Math.sin(animTime * 3) * 1.5;
    ctx.save();
    ctx.translate(0, step);
    ctx.fillStyle = 'rgba(0,0,0,0.45)';
    ctx.beginPath();
    ctx.ellipse(0, 14, 20, 7, 0, 0, Math.PI * 2);
    ctx.fill();

    // Heavy Jade Shell
    ctx.fillStyle = '#065f46';
    ctx.strokeStyle = '#047857';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.ellipse(0, -2, 18, 12, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // Shell Plates
    ctx.fillStyle = '#10b981';
    ctx.beginPath();
    ctx.arc(-5, -4, 4, 0, Math.PI * 2);
    ctx.arc(5, -4, 4, 0, Math.PI * 2);
    ctx.fill();

    // Head
    ctx.fillStyle = '#047857';
    ctx.beginPath();
    ctx.arc(14, 0, 9, 0, Math.PI * 2);
    ctx.fill();

    // Curved Tusks
    ctx.strokeStyle = '#f8fafc';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(18, 3);
    ctx.quadraticCurveTo(25, 4, 24, -4);
    ctx.stroke();

    // Glowing Eye
    ctx.fillStyle = '#f59e0b';
    ctx.beginPath();
    ctx.arc(15, -3, 2, 0, Math.PI * 2);
    ctx.fill();

    // Paws
    ctx.fillStyle = '#064e3b';
    ctx.fillRect(-10, 6, 7, 9);
    ctx.fillRect(4, 6, 7, 9);
    ctx.restore();
  };

  // 4. Crimson Drakes (Fiery Drake)
  const drawCrimsonDrakeModel = (ctx: CanvasRenderingContext2D, animTime: number) => {
    const flap = Math.sin(animTime * 5) * 5;
    ctx.save();
    ctx.translate(0, flap);
    ctx.fillStyle = 'rgba(0,0,0,0.45)';
    ctx.beginPath();
    ctx.ellipse(0, 14, 17, 6, 0, 0, Math.PI * 2);
    ctx.fill();

    // Bat Wings
    ctx.fillStyle = '#991b1b';
    ctx.strokeStyle = '#dc2626';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(-6, -4);
    ctx.lineTo(-24, -22 - flap);
    ctx.lineTo(-12, 2);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(6, -4);
    ctx.lineTo(24, -22 - flap);
    ctx.lineTo(12, 2);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Body
    ctx.fillStyle = '#7f1d1d';
    ctx.beginPath();
    ctx.ellipse(0, 0, 14, 9, 0, 0, Math.PI * 2);
    ctx.fill();

    // Spiked Tail
    ctx.strokeStyle = '#991b1b';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(-10, 2);
    ctx.quadraticCurveTo(-20, 8, -24, 0);
    ctx.stroke();

    // Horned Head
    ctx.fillStyle = '#991b1b';
    ctx.beginPath();
    ctx.arc(12, -4, 8, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#f59e0b';
    ctx.beginPath();
    ctx.moveTo(10, -10); ctx.lineTo(14, -20); ctx.lineTo(16, -9); ctx.fill();

    // Eye
    ctx.fillStyle = '#fef08a';
    ctx.beginPath();
    ctx.arc(14, -5, 2, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  };

  // Embermaw has a long snout, scale plates, spined tail, and batlike wings.
  const drawEmbermawDragonModel = (ctx: CanvasRenderingContext2D, animTime: number) => {
    const flap = Math.sin(animTime * 3.6) * 9;
    const hover = Math.sin(animTime * 2.1) * 3;
    ctx.save();
    ctx.translate(0, hover);

    ctx.fillStyle = 'rgba(0, 0, 0, 0.55)';
    ctx.beginPath();
    ctx.ellipse(0, 28 - hover, 54, 17, 0, 0, Math.PI * 2);
    ctx.fill();

    // The forked, spined tail curls behind the body.
    ctx.strokeStyle = '#7c2d12';
    ctx.lineWidth = 13;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(-18, 13);
    ctx.bezierCurveTo(-48, 18, -46, 48, -78, 32);
    ctx.stroke();
    ctx.fillStyle = '#fb923c';
    ctx.beginPath();
    ctx.moveTo(-78, 32); ctx.lineTo(-93, 23); ctx.lineTo(-87, 40);
    ctx.closePath(); ctx.fill();

    // Veined wings lift independently of the torso.
    for (const side of [-1, 1]) {
      ctx.save();
      ctx.scale(side, 1);
      const wing = ctx.createLinearGradient(15, -48, 82, 16);
      wing.addColorStop(0, '#fb923c');
      wing.addColorStop(0.45, '#b91c1c');
      wing.addColorStop(1, '#431407');
      ctx.fillStyle = wing;
      ctx.strokeStyle = '#fdba74';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(12, -12);
      ctx.lineTo(42, -58 - flap);
      ctx.lineTo(88, -65 - flap);
      ctx.lineTo(70, -33 - flap * 0.5);
      ctx.lineTo(92, -10);
      ctx.lineTo(53, -15);
      ctx.lineTo(61, 20);
      ctx.lineTo(13, 7);
      ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.strokeStyle = '#7c2d12';
      ctx.beginPath();
      ctx.moveTo(12, -12); ctx.lineTo(88, -65 - flap);
      ctx.moveTo(12, -12); ctx.lineTo(92, -10);
      ctx.moveTo(12, -12); ctx.lineTo(61, 20);
      ctx.stroke();
      ctx.restore();
    }

    const scales = ctx.createLinearGradient(-30, -28, 35, 28);
    scales.addColorStop(0, '#fdba74');
    scales.addColorStop(0.35, '#c2410c');
    scales.addColorStop(1, '#7c2d12');
    ctx.fillStyle = scales;
    ctx.strokeStyle = '#431407';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.ellipse(-3, 2, 34, 25, -0.16, 0, Math.PI * 2);
    ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#fbbf24';
    ctx.beginPath();
    ctx.ellipse(5, 12, 21, 10, -0.1, 0, Math.PI * 2);
    ctx.fill();
    for (let i = 0; i < 5; i++) {
      ctx.fillStyle = i % 2 ? '#f97316' : '#fed7aa';
      ctx.beginPath();
      ctx.moveTo(-28 + i * 12, -17);
      ctx.lineTo(-24 + i * 12, -35 - (i % 2) * 5);
      ctx.lineTo(-16 + i * 12, -17);
      ctx.fill();
    }

    // Neck, horned skull and angular open jaws make the silhouette a dragon.
    ctx.fillStyle = '#9a3412';
    ctx.beginPath();
    ctx.moveTo(15, -11); ctx.quadraticCurveTo(30, -42, 42, -42);
    ctx.lineTo(47, -25); ctx.lineTo(31, 2); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#ea580c';
    ctx.beginPath();
    ctx.moveTo(31, -45); ctx.quadraticCurveTo(43, -58, 58, -49);
    ctx.lineTo(73, -35); ctx.lineTo(58, -28); ctx.lineTo(45, -32);
    ctx.closePath(); ctx.fill();
    ctx.strokeStyle = '#431407'; ctx.lineWidth = 2; ctx.stroke();
    ctx.fillStyle = '#fed7aa';
    ctx.beginPath();
    ctx.moveTo(38, -49); ctx.lineTo(31, -70); ctx.lineTo(48, -54);
    ctx.moveTo(48, -48); ctx.lineTo(54, -67); ctx.lineTo(59, -45);
    ctx.fill();
    ctx.fillStyle = '#431407';
    ctx.beginPath();
    ctx.moveTo(47, -28); ctx.lineTo(77, -29); ctx.lineTo(62, -21);
    ctx.lineTo(49, -24); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#fff7ed';
    ctx.beginPath();
    ctx.moveTo(57, -28); ctx.lineTo(61, -21); ctx.lineTo(64, -28);
    ctx.moveTo(69, -28); ctx.lineTo(71, -23); ctx.lineTo(74, -29);
    ctx.fill();
    ctx.shadowColor = '#fbbf24'; ctx.shadowBlur = 12;
    ctx.fillStyle = '#fef08a';
    ctx.beginPath(); ctx.arc(51, -43, 3.5, 0, Math.PI * 2); ctx.fill();
    ctx.shadowBlur = 0;

    if (Math.sin(animTime * 3) > 0.1) {
      for (let i = 0; i < 4; i++) {
        const px = 76 + i * 9;
        ctx.fillStyle = i % 2 ? '#f97316' : '#facc15';
        ctx.beginPath();
        ctx.moveTo(px, -28 + Math.sin(animTime * 8 + i) * 4);
        ctx.lineTo(px + 16, -24 + i * 2);
        ctx.lineTo(px, -20);
        ctx.fill();
      }
    }
    ctx.restore();
  };

  // =========================================================================
  // HIGH-FIDELITY SPECTATOR-GRADE CANVAS RENDERER (LARGER MIDDLE ARENA)
  // =========================================================================
  const drawAramBattleground = (ctx: CanvasRenderingContext2D, width: number, height: number, time: number) => {
    ctx.clearRect(0, 0, width, height);
    // Stretch the architectural backdrop to the wider world; actors use world coordinates.
    ctx.save();
    ctx.scale(width / 1320, 1);

    // 1. BASE BACKGROUND
    const bgGrad = ctx.createLinearGradient(0, 0, 0, height);
    bgGrad.addColorStop(0, '#020617');
    bgGrad.addColorStop(0.3, '#07152b');
    bgGrad.addColorStop(0.7, '#081a38');
    bgGrad.addColorStop(1, '#020617');
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, width, height);

    // Aurora Borealis in Sky
    for (let a = 0; a < 3; a++) {
      ctx.save();
      ctx.globalAlpha = 0.08 + Math.sin(time * 1.5 + a) * 0.04;
      const auroraGrad = ctx.createLinearGradient(0, 0, width, 0);
      auroraGrad.addColorStop(0, 'rgba(6, 182, 212, 0)');
      auroraGrad.addColorStop(0.3, a === 0 ? '#10b981' : '#06b6d4');
      auroraGrad.addColorStop(0.7, a === 1 ? '#a855f7' : '#38bdf8');
      auroraGrad.addColorStop(1, 'rgba(168, 85, 247, 0)');
      ctx.fillStyle = auroraGrad;
      ctx.beginPath();
      ctx.moveTo(0, a * 50);
      for (let x = 0; x <= width; x += 40) {
        const yOffset = Math.sin((x * 0.015) + (time * 1.2) + a) * 24 + (a * 40);
        ctx.lineTo(x, yOffset);
      }
      ctx.lineTo(width, a * 50 + 70);
      ctx.lineTo(0, a * 50 + 70);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }

    // Snowflakes
    ctx.fillStyle = 'rgba(255, 255, 255, 0.45)';
    for (let i = 0; i < 70; i++) {
      const sx = (i * 37 + time * 26) % width;
      const sy = (i * 53 + time * 42) % height;
      const sz = 1.0 + (i % 3) * 0.8;
      ctx.fillRect(sx, sy, sz, sz);
    }

    // 2. EMBERMAW'S VOLCANIC PIT
    ctx.save();
    ctx.fillStyle = '#090d16';
    ctx.beginPath();
    ctx.arc(660, 130, 95, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#fb923c';
    ctx.lineWidth = 3;
    ctx.stroke();

    const pitGrad = ctx.createRadialGradient(660, 130, 10, 660, 130, 90);
    pitGrad.addColorStop(0, '#451a03');
    pitGrad.addColorStop(0.5, '#9a3412');
    pitGrad.addColorStop(1, '#1c1917');
    ctx.fillStyle = pitGrad;
    ctx.beginPath();
    ctx.arc(660, 130, 88, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = 'rgba(251, 146, 60, 0.7)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(660, 130, 55, 0, Math.PI * 2);
    ctx.stroke();

    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 10px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('EMBERMAW • DRAGON PIT', 660, 25);
    ctx.restore();

    // 3. JUNGLE WALKWAYS & STAIR CONNECTORS
    ctx.fillStyle = '#1e293b';
    ctx.beginPath();
    ctx.roundRect(320, 120, 240, 95, 16);
    ctx.roundRect(760, 120, 240, 95, 16);
    ctx.fill();
    ctx.strokeStyle = '#334155';
    ctx.lineWidth = 2;
    ctx.stroke();

    ctx.fillStyle = '#1e293b';
    ctx.beginPath();
    ctx.roundRect(360, 520, 600, 105, 16);
    ctx.fill();
    ctx.strokeStyle = '#334155';
    ctx.stroke();

    // Stairways between main causeway and side paths
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(480, 205, 55, 60);
    ctx.fillRect(785, 205, 55, 60);
    ctx.fillRect(480, 495, 55, 55);
    ctx.fillRect(785, 495, 55, 55);

    // 4. MAIN CENTRAL ARAM CAUSEWAY (EXPANDED MIDDLE ARENA: y from 260 to 500)
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(50, 260, 1220, 240);

    ctx.fillStyle = '#1e293b';
    ctx.fillRect(54, 264, 1212, 232);

    ctx.fillStyle = '#334155';
    ctx.fillRect(58, 268, 1204, 224);

    // Pavers Grid Texture
    ctx.strokeStyle = '#1e293b';
    ctx.lineWidth = 1;
    for (let x = 70; x <= 1250; x += 40) {
      ctx.beginPath();
      ctx.moveTo(x, 268);
      ctx.lineTo(x, 492);
      ctx.stroke();
    }
    for (let y = 280; y <= 480; y += 30) {
      ctx.beginPath();
      ctx.moveTo(58, y);
      ctx.lineTo(1262, y);
      ctx.stroke();
    }

    // Snowdrifts
    ctx.fillStyle = 'rgba(241, 245, 249, 0.22)';
    ctx.fillRect(58, 268, 1204, 12);
    ctx.fillRect(58, 480, 1204, 12);

    // Central Ceremonial Highway
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(80, 350, 1160, 60);
    ctx.strokeStyle = 'rgba(6, 182, 212, 0.4)';
    ctx.lineWidth = 2;
    ctx.strokeRect(80, 350, 1160, 60);

    // EXPANDED GRAND MIDDLE BATTLE ARENA PLAZA (Diameter 280px at 660, 380!)
    ctx.fillStyle = '#0f172a';
    ctx.beginPath();
    ctx.arc(660, 380, 140, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#475569';
    ctx.lineWidth = 4;
    ctx.stroke();

    // Inner Runic Arena Ring
    ctx.strokeStyle = '#06b6d4';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.arc(660, 380, 95, 0, Math.PI * 2);
    ctx.stroke();

    // 5. Parapet Braziers
    const torchX = [180, 320, 460, 600, 720, 860, 1000, 1140];
    torchX.forEach((tx) => {
      // Top Brazier
      ctx.fillStyle = '#090d16';
      ctx.fillRect(tx - 6, 262, 12, 14);
      ctx.fillStyle = '#ea580c';
      ctx.beginPath();
      ctx.arc(tx, 262 + Math.sin(time * 9 + tx) * 2, 6, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#fef08a';
      ctx.beginPath();
      ctx.arc(tx, 261, 3, 0, Math.PI * 2);
      ctx.fill();

      // Bottom Brazier
      ctx.fillStyle = '#090d16';
      ctx.fillRect(tx - 6, 484, 12, 14);
      ctx.fillStyle = '#ea580c';
      ctx.beginPath();
      ctx.arc(tx, 494 + Math.sin(time * 9 + tx) * 2, 6, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#fef08a';
      ctx.beginPath();
      ctx.arc(tx, 494, 3, 0, Math.PI * 2);
      ctx.fill();
    });

    ctx.restore();

    // 6. ACTUAL PROCEDURAL JUNGLE MONSTER MODELS!
    jungleCampsRef.current.forEach((camp) => {
      ctx.save();
      ctx.translate(camp.x, camp.y);

      // Camp stone perimeter
      ctx.fillStyle = 'rgba(0, 0, 0, 0.4)';
      ctx.beginPath();
      ctx.arc(0, 0, 32, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = camp.isAlive ? camp.color : '#475569';
      ctx.lineWidth = 2;
      ctx.stroke();

      if (camp.isAlive) {
        // Draw Actual Procedural Model based on camp type!
        if (camp.type === 'golem') {
          drawFrostSentinelModel(ctx, time);
        } else if (camp.type === 'wolves') {
          drawShadowWolfModel(ctx, time);
        } else if (camp.type === 'behemoth') {
          drawMurkBehemothModel(ctx, time);
        } else {
          drawCrimsonDrakeModel(ctx, time);
        }

        // HP Bar
        const hpPct = Math.max(0, camp.hp / camp.maxHp);
        ctx.fillStyle = '#020617';
        ctx.fillRect(-18, -34, 36, 4);
        ctx.fillStyle = camp.color;
        ctx.fillRect(-18, -34, 36 * hpPct, 4);

        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 8px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(camp.name, 0, -38);
      } else {
        ctx.fillStyle = '#94a3b8';
        ctx.font = 'bold 9px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(`🌲 Respawns ${Math.ceil(camp.respawnTimer)}s`, 0, 4);
      }
      ctx.restore();
    });

    // 7. EMBERMAW DRAGON BOSS PROCEDURAL MODEL
    const dragon = dragonRef.current;
    ctx.save();
    ctx.translate(dragon.x, dragon.y);

    if (dragon.isAlive) {
      drawEmbermawDragonModel(ctx, time);

      // Boss Overhead HP Bar
      const bW = 66;
      ctx.fillStyle = '#020617';
      ctx.fillRect(-bW / 2, -78, bW, 6);
      const hpPct = Math.max(0, dragon.hp / dragon.maxHp);
      ctx.fillStyle = '#fb923c';
      ctx.fillRect(-bW / 2 + 1, -77, (bW - 2) * hpPct, 4);

      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 9px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(`🐉 ${dragon.name}`, 0, -84);
    } else {
      ctx.fillStyle = '#64748b';
      ctx.font = 'bold 11px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(`🔥 Respawns in ${Math.ceil(dragon.spawnTimer)}s`, 0, 0);
    }
    ctx.restore();

    // 8. HEALING WELLS AT THE MAP ENDS
    // BLUE HEALING WELL (Left)
    ctx.save();
    ctx.translate(WELL_X.blue, LANE_Y);
    ctx.fillStyle = '#0f172a';
    ctx.beginPath();
    ctx.arc(0, 0, 56, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#0284c7';
    ctx.lineWidth = 4;
    ctx.stroke();

    const blueWater = ctx.createRadialGradient(0, 0, 5, 0, 0, 52);
    blueWater.addColorStop(0, '#e0f2fe');
    blueWater.addColorStop(0.4, '#38bdf8');
    blueWater.addColorStop(0.8, '#0284c7');
    blueWater.addColorStop(1, '#075985');
    ctx.fillStyle = blueWater;
    ctx.beginPath();
    ctx.arc(0, 0, 52, 0, Math.PI * 2);
    ctx.fill();

    // Spire Crystal
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.moveTo(0, -16); ctx.lineTo(9, 0); ctx.lineTo(0, 16); ctx.lineTo(-9, 0);
    ctx.closePath();
    ctx.fill();
    ctx.restore();

    // RED HEALING WELL (Right)
    ctx.save();
    ctx.translate(WELL_X.red, LANE_Y);
    ctx.fillStyle = '#0f172a';
    ctx.beginPath();
    ctx.arc(0, 0, 56, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#e11d48';
    ctx.lineWidth = 4;
    ctx.stroke();

    const redWater = ctx.createRadialGradient(0, 0, 5, 0, 0, 52);
    redWater.addColorStop(0, '#ffe4e6');
    redWater.addColorStop(0.4, '#f43f5e');
    redWater.addColorStop(0.8, '#be123c');
    redWater.addColorStop(1, '#881337');
    ctx.fillStyle = redWater;
    ctx.beginPath();
    ctx.arc(0, 0, 52, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.moveTo(0, -16); ctx.lineTo(9, 0); ctx.lineTo(0, 16); ctx.lineTo(-9, 0);
    ctx.closePath();
    ctx.fill();
    ctx.restore();

    // 9. Ambush Brushes
    ctx.fillStyle = '#475569';
    ctx.beginPath();
    ctx.ellipse(818, 245, 45, 16, 0, 0, Math.PI * 2);
    ctx.ellipse(1182, 510, 45, 16, 0, 0, Math.PI * 2);
    ctx.fill();

    // 10. Health Relics
    relicsRef.current.forEach((r) => {
      ctx.fillStyle = '#0f172a';
      ctx.beginPath();
      ctx.arc(r.x, r.y, 14, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = r.respawnTimer <= 0 ? '#10b981' : '#64748b';
      ctx.lineWidth = 2;
      ctx.stroke();

      if (r.respawnTimer <= 0) {
        ctx.fillStyle = '#34d399';
        ctx.beginPath();
        ctx.arc(r.x, r.y + Math.sin(time * 4) * 2.5, 6, 0, Math.PI * 2);
        ctx.fill();
      }
    });

    // 11. STRUCTURES (Towers & Nexus)
    structuresRef.current.forEach((st) => {
      if (!st.isAlive) {
        ctx.fillStyle = '#1e293b';
        ctx.fillRect(st.x - 18, st.y - 14, 36, 28);
        ctx.strokeStyle = '#475569';
        ctx.strokeRect(st.x - 18, st.y - 14, 36, 28);
        return;
      }

      if (st.type === 'nexus') {
        ctx.save();
        ctx.translate(st.x, st.y);
        ctx.fillStyle = '#090d16';
        ctx.beginPath();
        ctx.arc(0, 0, 32, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = st.team === 'blue' ? '#0284c7' : '#e11d48';
        ctx.lineWidth = 3;
        ctx.stroke();

        for (let o = 0; o < 3; o++) {
          const orbitAngle = time * 2.5 + (o / 3) * Math.PI * 2;
          const ox = Math.cos(orbitAngle) * 36;
          const oy = Math.sin(orbitAngle) * 16;
          ctx.fillStyle = st.team === 'blue' ? '#38bdf8' : '#f43f5e';
          ctx.fillRect(ox - 3, oy - 4, 6, 8);
        }

        const nGrad = ctx.createLinearGradient(0, -26, 0, 26);
        nGrad.addColorStop(0, '#ffffff');
        nGrad.addColorStop(0.5, st.team === 'blue' ? '#38bdf8' : '#f43f5e');
        nGrad.addColorStop(1, st.team === 'blue' ? '#0369a1' : '#9f1239');
        ctx.fillStyle = nGrad;
        ctx.beginPath();
        ctx.moveTo(0, -28);
        ctx.lineTo(16, 0);
        ctx.lineTo(0, 28);
        ctx.lineTo(-16, 0);
        ctx.closePath();
        ctx.fill();
        ctx.restore();
      } else if (st.type === 'barracks') {
        ctx.save();
        ctx.translate(st.x, st.y);
        const glow = st.team === 'blue' ? '#38bdf8' : '#fb7185';
        ctx.shadowColor = glow;
        ctx.shadowBlur = 16;
        ctx.fillStyle = '#0f172a';
        ctx.strokeStyle = glow;
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.roundRect(-24, -19, 48, 38, 8);
        ctx.fill();
        ctx.stroke();
        ctx.shadowBlur = 0;
        ctx.fillStyle = glow;
        ctx.font = 'bold 21px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(st.barracksKind === 'melee' ? '⚔' : st.barracksKind === 'ranged' ? '⌁' : '✹', 0, 7);
        ctx.fillStyle = '#e2e8f0';
        ctx.font = 'bold 9px sans-serif';
        ctx.fillText(st.barracksKind?.toUpperCase() ?? '', 0, -27);
        ctx.restore();
      } else {
        ctx.save();
        ctx.translate(st.x, st.y);
        ctx.fillStyle = '#090d16';
        ctx.fillRect(-18, -10, 36, 20);
        ctx.fillStyle = '#1e293b';
        ctx.fillRect(-15, -34, 30, 48);

        ctx.strokeStyle = st.team === 'blue' ? '#38bdf8' : '#f43f5e';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(0, -30);
        ctx.lineTo(0, 10);
        ctx.stroke();

        const crystalY = -42 + Math.sin(time * 3 + st.x) * 3;
        ctx.fillStyle = st.team === 'blue' ? '#38bdf8' : '#f43f5e';
        ctx.shadowColor = st.team === 'blue' ? '#38bdf8' : '#f43f5e';
        ctx.shadowBlur = 14;
        ctx.beginPath();
        ctx.moveTo(0, crystalY - 12);
        ctx.lineTo(10, crystalY);
        ctx.lineTo(0, crystalY + 12);
        ctx.lineTo(-10, crystalY);
        ctx.closePath();
        ctx.fill();
        ctx.shadowBlur = 0;

        if (st.targetId) {
          const targetUnit = [
            ...championsRef.current,
            ...minionsRef.current
          ].find((u) => u.id === st.targetId);

          if (targetUnit) {
            ctx.strokeStyle = st.team === 'blue' ? '#00f2ff' : '#ff0055';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.moveTo(0, crystalY);
            ctx.lineTo(targetUnit.x - st.x, targetUnit.y - st.y - 12);
            ctx.stroke();
          }
        }
        ctx.restore();
      }

      const bW = 44;
      const bH = 5;
      const bX = st.x - bW / 2;
      const bY = st.y - (st.type === 'nexus' ? 42 : st.type === 'barracks' ? 42 : 62);

      ctx.fillStyle = '#020617';
      ctx.fillRect(bX, bY, bW, bH);
      const pct = Math.max(0, st.hp / st.maxHp);
      ctx.fillStyle = st.team === 'blue' ? '#38bdf8' : '#f43f5e';
      ctx.fillRect(bX + 0.5, bY + 0.5, (bW - 1) * pct, bH - 1);
    });

    // 12. MINIONS
    minionsRef.current.forEach((m) => {
      ctx.save();
      ctx.translate(m.x, m.y);

      ctx.fillStyle = 'rgba(0, 0, 0, 0.45)';
      ctx.beginPath();
      ctx.ellipse(0, 3, 9, 3.5, 0, 0, Math.PI * 2);
      ctx.fill();

      if (m.empowered) {
        ctx.strokeStyle = '#fbbf24';
        ctx.shadowColor = '#f59e0b';
        ctx.shadowBlur = 13;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.ellipse(0, -4, 13, 17, 0, 0, Math.PI * 2);
        ctx.stroke();
        ctx.shadowBlur = 0;
      }

      const teamColor = m.team === 'blue' ? '#2563eb' : '#dc2626';

      if (m.type === 'cannon') {
        ctx.fillStyle = '#451a03';
        ctx.fillRect(-10, -10, 20, 8);
        ctx.fillStyle = '#78716c';
        ctx.fillRect(m.team === 'blue' ? 2 : -16, -14, 15, 6);
        ctx.fillStyle = '#1c1917';
        ctx.beginPath();
        ctx.arc(-6, -2, 5, 0, Math.PI * 2);
        ctx.arc(6, -2, 5, 0, Math.PI * 2);
        ctx.fill();
      } else if (m.type === 'caster') {
        ctx.fillStyle = teamColor;
        ctx.beginPath();
        ctx.moveTo(-6, 2);
        ctx.lineTo(0, -14);
        ctx.lineTo(6, 2);
        ctx.closePath();
        ctx.fill();
        ctx.fillStyle = '#e2e8f0';
        ctx.beginPath();
        ctx.arc(0, -10, 4, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#78350f';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(m.team === 'blue' ? 4 : -4, -4);
        ctx.lineTo(m.team === 'blue' ? 8 : -8, -14);
        ctx.stroke();
        ctx.fillStyle = m.team === 'blue' ? '#67e8f9' : '#f472b6';
        ctx.beginPath();
        ctx.arc(m.team === 'blue' ? 8 : -8, -14, 3, 0, Math.PI * 2);
        ctx.fill();
      } else {
        ctx.fillStyle = teamColor;
        ctx.fillRect(-5, -11, 10, 10);
        ctx.fillStyle = '#cbd5e1';
        ctx.fillRect(-4, -15, 8, 5);
        ctx.fillStyle = '#94a3b8';
        ctx.strokeStyle = teamColor;
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        const sx = m.team === 'blue' ? 4 : -8;
        ctx.rect(sx, -10, 5, 9);
        ctx.fill();
        ctx.stroke();
      }

      const mW = 16;
      ctx.fillStyle = '#020617';
      ctx.fillRect(-mW / 2, -19, mW, 2.5);
      ctx.fillStyle = m.empowered ? '#fbbf24' : m.team === 'blue' ? '#38bdf8' : '#f43f5e';
      ctx.fillRect(-mW / 2 + 0.5, -18.5, (mW - 1) * (m.hp / m.maxHp), 1.5);
      ctx.restore();
    });

    // 13. PROJECTILES
    projectilesRef.current.forEach((p) => {
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.angle);

      if (p.skillshot) {
        ctx.shadowColor = p.color;
        ctx.shadowBlur = 20;
        ctx.strokeStyle = p.color;
        ctx.lineWidth = Math.max(4, p.size * 0.55);
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(-30, 0);
        ctx.lineTo(0, 0);
        ctx.stroke();
        ctx.shadowBlur = 0;
      }

      if (p.type === 'ult_arrow') {
        // Astra: Enchanted Crystal Comet (Global Ice Hawk)
        ctx.shadowColor = '#00f2ff';
        ctx.shadowBlur = 24;
        const tailGrad = ctx.createLinearGradient(-50, 0, 0, 0);
        tailGrad.addColorStop(0, 'rgba(56, 189, 248, 0)');
        tailGrad.addColorStop(1, '#38bdf8');
        ctx.fillStyle = tailGrad;
        ctx.beginPath();
        ctx.moveTo(0, -9); ctx.lineTo(-55, 0); ctx.lineTo(0, 9); ctx.closePath();
        ctx.fill();
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.moveTo(22, 0); ctx.lineTo(0, -9); ctx.lineTo(4, 0); ctx.lineTo(0, 9); ctx.closePath();
        ctx.fill();
        ctx.strokeStyle = '#bae6fd';
        ctx.lineWidth = 3;
        ctx.stroke();
      } else if (p.type === 'tornado') {
        // Yasuo / Kazemaru: Spinning Wind Tornado
        ctx.shadowColor = '#38bdf8';
        ctx.shadowBlur = 18;
        const spin = time * 20;
        ctx.rotate(spin);
        ctx.strokeStyle = '#38bdf8';
        ctx.lineWidth = 3.5;
        ctx.beginPath();
        ctx.arc(0, 0, 14, 0, Math.PI * 1.5);
        ctx.stroke();
        ctx.strokeStyle = '#e0f2fe';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(0, 0, 8, Math.PI * 0.5, Math.PI * 2);
        ctx.stroke();
        ctx.fillStyle = 'rgba(56, 189, 248, 0.4)';
        ctx.beginPath();
        ctx.arc(0, 0, 12, 0, Math.PI * 2);
        ctx.fill();
      } else if (p.type === 'shuriken') {
        // Zed / Kage: Razor Shuriken
        ctx.shadowColor = p.color;
        ctx.shadowBlur = 14;
        const spin = time * 28;
        ctx.rotate(spin);
        ctx.fillStyle = '#18181b';
        ctx.beginPath();
        for (let i = 0; i < 4; i++) {
          const a = (i * Math.PI) / 2;
          ctx.lineTo(Math.cos(a) * 12, Math.sin(a) * 12);
          ctx.lineTo(Math.cos(a + Math.PI / 4) * 4, Math.sin(a + Math.PI / 4) * 4);
        }
        ctx.closePath();
        ctx.fill();
        ctx.strokeStyle = p.color;
        ctx.lineWidth = 2;
        ctx.stroke();
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(0, 0, 2.5, 0, Math.PI * 2);
        ctx.fill();
      } else if (p.type === 'feather') {
        // Xayah / Cora: Magenta Quill Feather
        ctx.shadowColor = '#f472b6';
        ctx.shadowBlur = 12;
        ctx.fillStyle = '#ec4899';
        ctx.beginPath();
        ctx.moveTo(14, 0); ctx.lineTo(-10, -5); ctx.lineTo(-14, 0); ctx.lineTo(-10, 5); ctx.closePath();
        ctx.fill();
        ctx.strokeStyle = '#fbcfe8';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(-14, 0); ctx.lineTo(14, 0); ctx.stroke();
      } else if (p.type === 'spirit_arrow') {
        // Kindred / Kindra: Spectral Arrow
        ctx.shadowColor = '#c084fc';
        ctx.shadowBlur = 14;
        ctx.strokeStyle = '#a855f7';
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.moveTo(-14, 0); ctx.lineTo(8, 0); ctx.stroke();
        ctx.fillStyle = '#e9d5ff';
        ctx.beginPath();
        ctx.moveTo(14, 0); ctx.lineTo(6, -4); ctx.lineTo(6, 4); ctx.closePath();
        ctx.fill();
      } else if (p.type === 'nature_bolt') {
        // Furion / Tequoia: Wrath of Nature Solar Bolt
        ctx.shadowColor = p.color;
        ctx.shadowBlur = 16;
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(0, 0, 8, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(0, 0, 4, 0, Math.PI * 2);
        ctx.stroke();
      } else if (p.type === 'boulder') {
        // Earth Spirit / Kaolin: Rolling Jade Boulder
        ctx.shadowColor = p.color;
        ctx.shadowBlur = 14;
        const spin = time * 8;
        ctx.rotate(spin);
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(0, 0, 13, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 2.5;
        ctx.stroke();
        ctx.fillStyle = '#064e3b';
        ctx.fillRect(-6, -6, 4, 4);
        ctx.fillRect(2, 2, 5, 5);
      } else if (p.type === 'poison_dart') {
        // Dazzle / Zal: Shadow Dart
        ctx.shadowColor = p.color;
        ctx.shadowBlur = 12;
        ctx.fillStyle = '#d946ef';
        ctx.beginPath();
        ctx.moveTo(10, 0); ctx.lineTo(-8, -3.5); ctx.lineTo(-8, 3.5); ctx.closePath();
        ctx.fill();
      } else if (p.type === 'electric_spark') {
        // Storm Spirit / Raijin: Electric Spark
        ctx.shadowColor = '#06b6d4';
        ctx.shadowBlur = 16;
        ctx.fillStyle = '#38bdf8';
        ctx.beginPath();
        ctx.arc(0, 0, 7, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(0, 0, 3, 0, Math.PI * 2);
        ctx.fill();
      } else if (p.type === 'seed_shot') {
        // Lone Druid / Sylla: Seed Shot
        ctx.shadowColor = '#15803d';
        ctx.shadowBlur = 8;
        ctx.fillStyle = '#16a34a';
        ctx.beginPath();
        ctx.ellipse(0, 0, 6, 4, 0, 0, Math.PI * 2);
        ctx.fill();
      } else if (p.type === 'laser') {
        ctx.shadowColor = p.color;
        ctx.shadowBlur = 20;
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 6;
        ctx.beginPath(); ctx.moveTo(-24, 0); ctx.lineTo(18, 0); ctx.stroke();
        ctx.strokeStyle = p.color;
        ctx.lineWidth = 12;
        ctx.globalAlpha = 0.45;
        ctx.beginPath(); ctx.moveTo(-30, 0); ctx.lineTo(20, 0); ctx.stroke();
      } else if (p.type === 'pellet') {
        ctx.shadowColor = p.color;
        ctx.shadowBlur = 16;
        ctx.fillStyle = p.color;
        ctx.beginPath(); ctx.moveTo(14, 0); ctx.lineTo(-10, -7); ctx.lineTo(-5, 0); ctx.lineTo(-10, 7); ctx.closePath(); ctx.fill();
      } else if (p.type === 'arrow') {
        ctx.shadowColor = '#00f2ff';
        ctx.shadowBlur = 14;
        ctx.strokeStyle = '#38bdf8';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(-16, 0); ctx.lineTo(8, 0); ctx.stroke();
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.moveTo(14, 0); ctx.lineTo(6, -4); ctx.lineTo(6, 4); ctx.closePath();
        ctx.fill();
      } else if (p.type === 'orb') {
        ctx.shadowColor = p.color;
        ctx.shadowBlur = 18;
        const orbGrad = ctx.createRadialGradient(0, 0, 2, 0, 0, 10);
        orbGrad.addColorStop(0, '#ffffff');
        orbGrad.addColorStop(0.5, p.color);
        orbGrad.addColorStop(1, '#0f172a');
        ctx.fillStyle = orbGrad;
        ctx.beginPath();
        ctx.arc(0, 0, 9, 0, Math.PI * 2);
        ctx.fill();
      } else if (p.type === 'boss_breath') {
        ctx.shadowColor = '#f97316';
        ctx.shadowBlur = 24;
        ctx.fillStyle = '#fbbf24';
        ctx.beginPath();
        ctx.moveTo(12, 0);
        ctx.quadraticCurveTo(-3, -11, -18, -7);
        ctx.lineTo(-9, 0);
        ctx.lineTo(-18, 7);
        ctx.quadraticCurveTo(-3, 11, 12, 0);
        ctx.fill();
      } else if (p.type === 'jungle_shot') {
        ctx.shadowColor = p.color;
        ctx.shadowBlur = 14;
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.moveTo(11, 0); ctx.lineTo(-7, -6); ctx.lineTo(-4, 0); ctx.lineTo(-7, 6);
        ctx.closePath(); ctx.fill();
      } else {
        ctx.fillStyle = p.color;
        ctx.shadowColor = p.color;
        ctx.shadowBlur = 8;
        ctx.beginPath();
        ctx.arc(0, 0, p.size, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    });

    // 14. REMARKABLE SPELL AOES (UNMISTAKABLE ABILITY ANIMATIONS)
    spellsRef.current.forEach((s) => {
      const alpha = s.duration / s.maxDuration;
      ctx.save();

      if (s.type === 'skill_burst' || s.type === 'ultimate_burst') {
        const ultimate = s.type === 'ultimate_burst';
        const progress = 1 - alpha;
        const radius = s.radius * (0.45 + progress * 0.8);
        ctx.globalAlpha = alpha;
        ctx.shadowColor = s.color;
        ctx.shadowBlur = ultimate ? 32 : 20;
        if (s.sourceX !== undefined && s.sourceY !== undefined) {
          ctx.strokeStyle = s.color;
          ctx.lineWidth = ultimate ? 7 : 3;
          ctx.beginPath();
          ctx.moveTo(s.sourceX, s.sourceY - 14);
          ctx.lineTo(s.x, s.y - 12);
          ctx.stroke();
          ctx.fillStyle = '#ffffff';
          ctx.beginPath();
          ctx.arc(s.sourceX, s.sourceY - 14, ultimate ? 11 : 6, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.fillStyle = s.color;
        ctx.globalAlpha = alpha * (ultimate ? 0.36 : 0.25);
        ctx.beginPath();
        ctx.arc(s.x, s.y, radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = alpha;
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = ultimate ? 4 : 2.5;
        ctx.beginPath();
        ctx.arc(s.x, s.y, radius, 0, Math.PI * 2);
        ctx.stroke();
        if (ultimate) {
          ctx.strokeStyle = s.color;
          ctx.lineWidth = 3;
          ctx.beginPath();
          ctx.arc(s.x, s.y, radius * 1.22, 0, Math.PI * 2);
          ctx.stroke();
        }
        for (let i = 0; i < (ultimate ? 12 : 7); i++) {
          const angle = i * Math.PI * 2 / (ultimate ? 12 : 7) + time * 2;
          const sx = s.x + Math.cos(angle) * radius;
          const sy = s.y + Math.sin(angle) * radius;
          ctx.fillStyle = i % 2 ? '#ffffff' : s.color;
          ctx.beginPath();
          ctx.arc(sx, sy, ultimate ? 4 : 2.5, 0, Math.PI * 2);
          ctx.fill();
        }
        // Sharp outer rays and a readable skill label make casts stand out in a crowded fight.
        ctx.lineCap = 'round';
        for (let i = 0; i < (ultimate ? 16 : 9); i++) {
          const angle = i * Math.PI * 2 / (ultimate ? 16 : 9) - time * 0.8;
          const inner = radius * 1.12;
          const outer = radius * (ultimate ? 1.65 : 1.42);
          ctx.strokeStyle = i % 2 ? '#ffffff' : s.color;
          ctx.lineWidth = ultimate ? 4 : 2.5;
          ctx.beginPath();
          ctx.moveTo(s.x + Math.cos(angle) * inner, s.y + Math.sin(angle) * inner);
          ctx.lineTo(s.x + Math.cos(angle) * outer, s.y + Math.sin(angle) * outer);
          ctx.stroke();
        }
        if (s.extraText) {
          const label = s.extraText.toUpperCase();
          ctx.globalAlpha = Math.min(1, alpha * 2);
          ctx.font = `900 ${ultimate ? 17 : 12}px system-ui`;
          ctx.textAlign = 'center';
          ctx.lineWidth = ultimate ? 6 : 4;
          ctx.strokeStyle = '#020617';
          ctx.shadowBlur = 0;
          ctx.strokeText(label, s.x, s.y - radius - (ultimate ? 26 : 15));
          ctx.fillStyle = ultimate ? '#ffffff' : s.color;
          ctx.fillText(label, s.x, s.y - radius - (ultimate ? 26 : 15));
        }
      } else if (s.type === 'solar_flare') {
        // Leona / Solana: Blinding Daybreak Flare Solar Beam
        ctx.shadowColor = '#f59e0b';
        ctx.shadowBlur = 28;
        ctx.strokeStyle = '#fde047';
        ctx.lineWidth = 4;
        ctx.globalAlpha = alpha;
        ctx.beginPath();
        ctx.arc(s.x, s.y, s.radius, 0, Math.PI * 2);
        ctx.stroke();
        // Solar Beam Core
        ctx.fillStyle = 'rgba(251, 191, 36, 0.35)';
        ctx.beginPath();
        ctx.arc(s.x, s.y, s.radius * 0.7, 0, Math.PI * 2);
        ctx.fill();
        // Radiating Sunburst Rays
        for (let r = 0; r < 8; r++) {
          const rayAngle = (r / 8) * Math.PI * 2 + time * 2;
          ctx.beginPath();
          ctx.moveTo(s.x + Math.cos(rayAngle) * (s.radius * 0.4), s.y + Math.sin(rayAngle) * (s.radius * 0.4));
          ctx.lineTo(s.x + Math.cos(rayAngle) * s.radius, s.y + Math.sin(rayAngle) * s.radius);
          ctx.stroke();
        }
      } else if (s.type === 'wind_wall') {
        // Yasuo / Kazemaru: Shimmering Cyan Wind Wall Barrier
        ctx.shadowColor = '#38bdf8';
        ctx.shadowBlur = 22;
        ctx.globalAlpha = Math.min(1, alpha * 1.5);
        // Vertical Shimmering Air Curtain (90px wide, 14px thick)
        const wallGrad = ctx.createLinearGradient(s.x, s.y - 45, s.x, s.y + 45);
        wallGrad.addColorStop(0, 'rgba(56, 189, 248, 0.1)');
        wallGrad.addColorStop(0.5, 'rgba(186, 230, 253, 0.95)');
        wallGrad.addColorStop(1, 'rgba(56, 189, 248, 0.1)');
        ctx.fillStyle = wallGrad;
        ctx.fillRect(s.x - 7, s.y - 45, 14, 90);
        ctx.strokeStyle = '#00f2ff';
        ctx.lineWidth = 2.5;
        ctx.strokeRect(s.x - 7, s.y - 45, 14, 90);
        // Wind Mist Ripples
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 1.5;
        for (let w = -35; w <= 35; w += 20) {
          const wave = Math.sin(time * 14 + w) * 5;
          ctx.beginPath();
          ctx.moveTo(s.x - 6, s.y + w);
          ctx.quadraticCurveTo(s.x + wave, s.y + w, s.x + 6, s.y + w);
          ctx.stroke();
        }
      } else if (s.type === 'death_mark') {
        // Zed / Kage: Pulsing Crimson Death Mark
        ctx.shadowColor = '#dc2626';
        ctx.shadowBlur = 24;
        ctx.globalAlpha = Math.min(1, alpha * 1.4);
        // Blood Red Circle on Ground
        ctx.strokeStyle = '#dc2626';
        ctx.lineWidth = 3.5;
        ctx.beginPath();
        ctx.arc(s.x, s.y, s.radius * (1 - alpha * 0.2), 0, Math.PI * 2);
        ctx.stroke();
        // Crimson Crossed "X" of Death
        ctx.strokeStyle = '#ef4444';
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.moveTo(s.x - 16, s.y - 16); ctx.lineTo(s.x + 16, s.y + 16);
        ctx.moveTo(s.x + 16, s.y - 16); ctx.lineTo(s.x - 16, s.y + 16);
        ctx.stroke();
        // Countdown Pulse Text
        ctx.fillStyle = '#fee2e2';
        ctx.font = 'bold 10px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('🩸 MARK', s.x, s.y - 25);
      } else if (s.type === 'shallow_grave') {
        // Dazzle / Zal: Signature Pink Immortality Cross
        ctx.shadowColor = '#ec4899';
        ctx.shadowBlur = 26;
        ctx.globalAlpha = Math.min(1, alpha * 1.5);
        // Luminous Bright Pink Cross over Ally
        ctx.fillStyle = '#f472b6';
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 2;
        // Vertical beam
        ctx.beginPath();
        ctx.roundRect(s.x - 6, s.y - 48, 12, 36, 3);
        ctx.fill();
        ctx.stroke();
        // Horizontal bar
        ctx.beginPath();
        ctx.roundRect(s.x - 18, s.y - 39, 36, 11, 3);
        ctx.fill();
        ctx.stroke();
        // Protective Pink Life Halo
        ctx.strokeStyle = '#ec4899';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(s.x, s.y - 30, 24, 0, Math.PI * 2);
        ctx.stroke();
      } else if (s.type === 'lambs_respite') {
        // Kindred / Kindra: 130px Golden Sanctuary of Immortality
        ctx.shadowColor = '#facc15';
        ctx.shadowBlur = 28;
        ctx.globalAlpha = Math.min(1, alpha * 1.3);
        // Golden Protective Sanctuary Circle
        ctx.fillStyle = 'rgba(250, 204, 21, 0.18)';
        ctx.beginPath();
        ctx.arc(s.x, s.y, s.radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#facc15';
        ctx.lineWidth = 3.5;
        ctx.beginPath();
        ctx.arc(s.x, s.y, s.radius, 0, Math.PI * 2);
        ctx.stroke();
        // Celestial Rune Ring
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(s.x, s.y, s.radius * 0.75, 0, Math.PI * 2);
        ctx.stroke();
        // Center Lamb Ankh
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 11px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('✨ RESPITE', s.x, s.y + 4);
      } else if (s.type === 'sprout_ring') {
        // Furion / Tequoia: Ring of 8 Living Oak Trees
        ctx.globalAlpha = Math.min(1, alpha * 1.4);
        ctx.shadowColor = '#22c55e';
        ctx.shadowBlur = 14;
        for (let t = 0; t < 8; t++) {
          const treeAngle = (t / 8) * Math.PI * 2;
          const tx = s.x + Math.cos(treeAngle) * s.radius;
          const ty = s.y + Math.sin(treeAngle) * (s.radius * 0.65);
          // Tree Trunk
          ctx.fillStyle = '#713f12';
          ctx.fillRect(tx - 3, ty - 6, 6, 12);
          // Foliage Leaves
          ctx.fillStyle = '#15803d';
          ctx.beginPath();
          ctx.arc(tx, ty - 8, 9, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = '#4ade80';
          ctx.beginPath();
          ctx.arc(tx - 2, ty - 10, 4, 0, Math.PI * 2);
          ctx.fill();
        }
      } else if (s.type === 'sleight_circle') {
        // Ember Spirit / Xin: Sleight of Fist Blazing Rune Circle
        ctx.shadowColor = '#ea580c';
        ctx.shadowBlur = 24;
        ctx.strokeStyle = '#ea580c';
        ctx.lineWidth = 3.5;
        ctx.globalAlpha = alpha;
        ctx.beginPath();
        ctx.arc(s.x, s.y, s.radius, 0, Math.PI * 2);
        ctx.stroke();
        // Flame Slash Streaks
        ctx.strokeStyle = '#fef08a';
        ctx.lineWidth = 2.5;
        for (let sl = 0; sl < 4; sl++) {
          const a1 = (sl / 4) * Math.PI * 2 + time * 12;
          ctx.beginPath();
          ctx.moveTo(s.x + Math.cos(a1) * s.radius, s.y + Math.sin(a1) * s.radius);
          ctx.lineTo(s.x - Math.cos(a1) * s.radius, s.y - Math.sin(a1) * s.radius);
          ctx.stroke();
        }
      } else if (s.type === 'ball_lightning') {
        // Storm Spirit / Raijin: Supersonic Ball Lightning
        ctx.shadowColor = '#06b6d4';
        ctx.shadowBlur = 30;
        ctx.globalAlpha = alpha;
        ctx.fillStyle = 'rgba(6, 182, 212, 0.65)';
        ctx.beginPath();
        ctx.arc(s.x, s.y, s.radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(s.x, s.y, s.radius * 0.6, 0, Math.PI * 2);
        ctx.stroke();
      } else if (s.type === 'grand_entrance') {
        // Rakan / Renn: Grand Entrance Golden Knockup Ring
        ctx.shadowColor = '#f59e0b';
        ctx.shadowBlur = 22;
        ctx.strokeStyle = '#f59e0b';
        ctx.lineWidth = 4;
        ctx.globalAlpha = alpha;
        ctx.beginPath();
        ctx.arc(s.x, s.y, s.radius * (2 - alpha), 0, Math.PI * 2);
        ctx.stroke();
      } else if (s.type === 'static_remnant') {
        // Storm Spirit / Raijin: Static Remnant
        ctx.shadowColor = '#06b6d4';
        ctx.shadowBlur = 20;
        ctx.globalAlpha = alpha;
        ctx.fillStyle = '#38bdf8';
        ctx.beginPath();
        ctx.arc(s.x, s.y - 12, 10, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 2;
        ctx.stroke();
      } else if (s.type === 'magnetize_pulse') {
        // Earth Spirit / Kaolin: Magnetize Resonance Rings
        ctx.shadowColor = '#10b981';
        ctx.shadowBlur = 22;
        ctx.strokeStyle = '#059669';
        ctx.lineWidth = 3;
        ctx.globalAlpha = alpha;
        ctx.beginPath();
        ctx.arc(s.x, s.y, s.radius * (1 + (1 - alpha)), 0, Math.PI * 2);
        ctx.stroke();
      } else if (s.type === 'boss_slam') {
        ctx.shadowColor = '#f97316';
        ctx.shadowBlur = 24;
        ctx.strokeStyle = '#fbbf24';
        ctx.lineWidth = 4;
        ctx.globalAlpha = alpha;
        ctx.beginPath();
        ctx.arc(s.x, s.y, s.radius * (1 - alpha * 0.4), 0, Math.PI * 2);
        ctx.stroke();
        ctx.fillStyle = 'rgba(234, 88, 12, 0.25)';
        ctx.fill();
      } else {
        ctx.strokeStyle = s.color;
        ctx.lineWidth = 3;
        ctx.globalAlpha = alpha;
        ctx.beginPath();
        ctx.arc(s.x, s.y, s.radius, 0, Math.PI * 2);
        ctx.stroke();
      }
      ctx.restore();
    });

    // 15. CHAMPIONS RENDERING WITH OVERHEAD STATS
    const sortedChamps = [...championsRef.current].sort((a, b) => a.y - b.y);

    sortedChamps.forEach((u) => {
      if (!u.isAlive) {
        ctx.fillStyle = '#64748b';
        ctx.fillRect(u.x - 7, u.y - 10, 14, 10);
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 8px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(`${Math.ceil(u.respawnTimer)}s`, u.x, u.y - 14);
        return;
      }

      // Swirling Cyan Teleport Rings when Recalling (B)
      if (u.isRecalling && u.recallTimer !== undefined) {
        ctx.save();
        const progress = Math.max(0, Math.min(1, 1 - u.recallTimer / 2.5));
        ctx.shadowColor = '#38bdf8';
        ctx.shadowBlur = 18;
        ctx.strokeStyle = '#38bdf8';
        ctx.lineWidth = 2.5;

        // Ground rune circle
        ctx.beginPath();
        ctx.arc(u.x, u.y, 22, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * progress);
        ctx.stroke();

        ctx.strokeStyle = '#bae6fd';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(u.x, u.y, 14, 0, Math.PI * 2);
        ctx.stroke();

        // Channeling bar above champion
        const rBarW = 36;
        const rBarX = u.x - rBarW / 2;
        const rBarY = u.y - 58;
        ctx.fillStyle = '#0f172a';
        ctx.fillRect(rBarX, rBarY, rBarW, 4);
        ctx.fillStyle = '#38bdf8';
        ctx.fillRect(rBarX, rBarY, rBarW * progress, 4);
        ctx.font = 'bold 8px sans-serif';
        ctx.fillStyle = '#38bdf8';
        ctx.textAlign = 'center';
        ctx.fillText(`RECALL ${u.recallTimer.toFixed(1)}s`, u.x, rBarY - 2);
        ctx.restore();
      }

      // Aegis of the Immortal Golden Halo
      if (aegisBuffRef.current?.team === u.team) {
        ctx.save();
        ctx.strokeStyle = '#f59e0b';
        ctx.lineWidth = 2.5;
        ctx.shadowColor = '#fde047';
        ctx.shadowBlur = 12;
        ctx.beginPath();
        ctx.arc(u.x, u.y - 14, 22, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
      }

      // Draw Procedural TFT Chibi Sprite
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

      // Overhead MOBA Health & Mana Bar
      const barWidth = 38;
      const barHeight = 4.5;
      const barX = u.x - barWidth / 2;
      const barY = u.y - 44;

      // Level badge
      ctx.fillStyle = '#0f172a';
      ctx.fillRect(barX - 9, barY - 1, 8, 8);
      ctx.fillStyle = u.level >= 6 ? '#f59e0b' : '#94a3b8';
      ctx.font = 'bold 7px sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText(`${u.level}`, barX - 7, barY + 6);

      // HP Bar
      ctx.fillStyle = '#020617';
      ctx.fillRect(barX, barY, barWidth, barHeight);
      const hpPct = Math.max(0, u.hp / u.maxHp);
      ctx.fillStyle = u.team === 'blue' ? '#38bdf8' : '#f43f5e';
      ctx.fillRect(barX + 0.5, barY + 0.5, (barWidth - 1) * hpPct, barHeight - 1);

      // Shield bar
      if (u.shield > 0) {
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(barX + 0.5, barY + 0.5, Math.min(barWidth - 1, (u.shield / u.maxHp) * barWidth), barHeight - 1);
      }

      // Mana Bar
      ctx.fillStyle = '#020617';
      ctx.fillRect(barX, barY + 5.5, barWidth, 2);
      ctx.fillStyle = '#eab308';
      ctx.fillRect(barX + 0.5, barY + 5.5, (barWidth - 1) * (u.mana / 100), 1.5);

      // Champion & Athlete Name Tag
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 9px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(u.player.name, u.x, barY - 3);

      // Ultimate Cooldown Status Indicator
      if (u.level >= 6) {
        ctx.font = 'bold 7px sans-serif';
        if (u.cdUlt <= 0 && u.mana >= 100) {
          ctx.fillStyle = '#f59e0b';
          ctx.fillText('ULT [R]', u.x, barY - 12);
        } else if (u.cdUlt > 0) {
          ctx.fillStyle = '#94a3b8';
          ctx.fillText(`${Math.ceil(u.cdUlt)}s`, u.x, barY - 12);
        }
      }
    });

    // 16. FLOATING COMBAT TEXT
    floatsRef.current.forEach((f) => {
      ctx.save();
      ctx.fillStyle = f.color;
      ctx.globalAlpha = f.opacity;
      ctx.font = `bold ${Math.round(10 * f.scale)}px sans-serif`;
      ctx.textAlign = 'center';
      ctx.fillText(f.text, f.x, f.y);
      ctx.restore();
    });
  };

  // Animation Loop
  useEffect(() => {
    let animId: number;
    let lastTime = performance.now();

    const loop = (now: number) => {
      animId = requestAnimationFrame(loop);
      const dt = (now - lastTime) / 1000;
      lastTime = now;

      const simDt = paused || matchOver ? 0 : dt * speed;

      if (simDt > 0) {
        setMatchTime((t) => t + simDt);
        updateAramSimulation(simDt);
      }

      const canvas = canvasRef.current;
      if (canvas) {
        const ctx = canvas.getContext('2d');
        if (ctx) drawAramBattleground(ctx, canvas.width, canvas.height, now * 0.001);
      }
    };

    animId = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(animId);
  }, [paused, matchOver, speed]);

  const blueChamps = champions.filter((c) => c.team === 'blue');
  const redChamps = champions.filter((c) => c.team === 'red');

  const blueAvgLevel = (blueChamps.reduce((acc, c) => acc + c.level, 0) / Math.max(1, blueChamps.length)).toFixed(1);
  const redAvgLevel = (redChamps.reduce((acc, c) => acc + c.level, 0) / Math.max(1, redChamps.length)).toFixed(1);
  const barracksKinds = ['melee', 'ranged', 'catapult'] as const;
  const barracksIntact = (team: 'blue' | 'red', kind: typeof barracksKinds[number]) =>
    structuresRef.current.some(st => st.team === team && st.type === 'barracks' && st.barracksKind === kind && st.isAlive);
  const deadChampions = champions.filter(c => !c.isAlive);

  return (
    <div ref={matchRootRef} className={`space-y-4 animate-fade-in max-w-[1600px] mx-auto ${isFullscreen ? 'fixed inset-0 z-[100] max-w-none w-screen h-screen overflow-y-auto bg-slate-950 p-3' : ''}`}>
      {/* ======================================================== */}
      {/* 1. TOP BROADCAST SCOREBOARD */}
      {/* ======================================================== */}
      <div className="bg-slate-900 border-2 border-slate-700 rounded-2xl p-3 shadow-2xl flex justify-between items-center relative overflow-hidden">
        {/* Blue Squad Badge */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-cyan-600 rounded-xl flex items-center justify-center font-black text-white text-xl shadow">
            🛡️
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base font-black text-cyan-400">T-CHIBI SQUAD</h2>
              <span className="text-[10px] bg-cyan-950 text-cyan-300 px-1.5 py-0.5 rounded font-mono font-bold border border-cyan-400/40">
                {blueTowersAlive}/3 Towers
              </span>
              <span className="text-[10px] bg-amber-950 text-amber-300 px-1.5 py-0.5 rounded font-mono font-bold border border-amber-400/40">
                Avg Lvl {blueAvgLevel}
              </span>
            </div>
            <div className="text-[10px] text-slate-400 flex items-center gap-1.5 mt-0.5">
              <Coins className="w-3 h-3 text-amber-400" />
              <strong className="text-amber-300 font-mono">${blueGold.toLocaleString()}</strong>
              <span className="text-slate-500">|</span>
              <span>Coach: {blueCoach?.name || 'KkOpa'}</span>
            </div>
            <div className="flex gap-1 mt-1" aria-label="Blue barracks status">
              {barracksKinds.map(kind => <span key={kind} title={`${kind} barracks ${barracksIntact('blue', kind) ? 'intact' : 'destroyed'}`}
                className={`text-[9px] px-1.5 py-0.5 rounded border ${barracksIntact('blue', kind) ? 'text-cyan-300 border-cyan-700' : 'text-amber-300 border-amber-600'}`}>
                {kind === 'catapult' ? 'Cata' : kind === 'ranged' ? 'Range' : 'Melee'} {barracksIntact('blue', kind) ? '◆' : '✕'}
              </span>)}
            </div>
          </div>
        </div>

        {/* Center Live Scoreboard & Gold Advantage */}
        <div className="flex flex-col items-center">
          <div className="flex items-center bg-slate-950 px-6 py-1.5 rounded-xl border border-slate-700 gap-6">
            <span className="text-3xl font-black text-cyan-400 drop-shadow">{blueKills}</span>
            <div className="flex flex-col items-center">
              <Swords className="w-5 h-5 text-amber-400 animate-pulse" />
              <span className="text-[11px] text-amber-300 font-mono font-bold mt-0.5">
                {Math.floor(matchTime / 60)}:{(Math.floor(matchTime % 60)).toString().padStart(2, '0')}
              </span>
            </div>
            <span className="text-3xl font-black text-rose-400 drop-shadow">{redKills}</span>
          </div>

          <div className="mt-1 flex items-center gap-2 text-[10px] font-bold">
            {blueGold >= redGold ? (
              <span className="text-cyan-400 bg-cyan-950/80 px-2.5 py-0.5 rounded-full border border-cyan-500/30">
                +{Math.round(blueGold - redGold).toLocaleString()}g Blue Gold Lead
              </span>
            ) : (
              <span className="text-rose-400 bg-rose-950/80 px-2.5 py-0.5 rounded-full border border-rose-500/30">
                +{Math.round(redGold - blueGold).toLocaleString()}g Red Gold Lead
              </span>
            )}
          </div>
          <button onClick={toggleFullscreen} className="mt-1 flex items-center gap-1 text-[10px] font-bold text-slate-300 hover:text-amber-300" aria-label={isFullscreen ? 'Exit fullscreen' : 'Enter fullscreen'} aria-pressed={isFullscreen} title={isFullscreen ? 'Exit fullscreen (Esc)' : 'Fullscreen'}>
            {isFullscreen ? <Minimize2 className="w-3 h-3" /> : <Maximize2 className="w-3 h-3" />}
            {isFullscreen ? 'Exit fullscreen' : 'Fullscreen'}
          </button>
        </div>

        {/* Red Squad Badge */}
        <div className="flex items-center gap-3 text-right">
          <div>
            <div className="flex items-center gap-2 justify-end">
              <span className="text-[10px] bg-amber-950 text-amber-300 px-1.5 py-0.5 rounded font-mono font-bold border border-amber-400/40">
                Avg Lvl {redAvgLevel}
              </span>
              <span className="text-[10px] bg-rose-950 text-rose-300 px-1.5 py-0.5 rounded font-mono font-bold border border-rose-400/40">
                {redTowersAlive}/3 Towers
              </span>
              <h2 className="text-base font-black text-rose-400">RIVAL POINTIFY</h2>
            </div>
            <div className="text-[10px] text-slate-400 flex items-center gap-1.5 justify-end mt-0.5">
              <span>Split Contenders</span>
              <span className="text-slate-500">|</span>
              <Coins className="w-3 h-3 text-amber-400" />
              <strong className="text-amber-300 font-mono">${redGold.toLocaleString()}</strong>
            </div>
            <div className="flex gap-1 mt-1 justify-end" aria-label="Red barracks status">
              {barracksKinds.map(kind => <span key={kind} title={`${kind} barracks ${barracksIntact('red', kind) ? 'intact' : 'destroyed'}`}
                className={`text-[9px] px-1.5 py-0.5 rounded border ${barracksIntact('red', kind) ? 'text-rose-300 border-rose-700' : 'text-amber-300 border-amber-600'}`}>
                {kind === 'catapult' ? 'Cata' : kind === 'ranged' ? 'Range' : 'Melee'} {barracksIntact('red', kind) ? '◆' : '✕'}
              </span>)}
            </div>
          </div>
          <div className="w-10 h-10 bg-rose-600 rounded-xl flex items-center justify-center font-black text-white text-xl shadow">
            ⚔️
          </div>
        </div>
      </div>

      {/* ======================================================== */}
      {/* 2. THE EXPANDED ARENA CANVAS WITH DRAGON PIT & JUNGLE */}
      {/* ======================================================== */}
      <div className="relative w-full rounded-3xl overflow-hidden border-4 border-slate-700 shadow-2xl bg-black pt-[104px]">
        <div className="absolute inset-x-0 top-0 h-[104px] bg-gradient-to-r from-slate-950 via-indigo-950/80 to-slate-950 border-b border-amber-500/25 pointer-events-none flex items-center px-5">
          <span className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">Live kill feed</span>
        </div>
        <canvas
          ref={canvasRef}
          width={ARENA_WIDTH}
          height={760}
          className="w-full h-auto block"
        />

        {/* TOP KILL CALLOUT BANNER (ESPORTS BROADCAST ANNOUNCEMENT) */}
        {killCallout && (
          <div className="absolute top-3 left-1/2 -translate-x-1/2 z-40 pointer-events-none flex flex-col items-center animate-fade-in">
            {/* Main Kill Card */}
            <div className="bg-slate-950/95 border-2 border-amber-400/90 shadow-[0_0_30px_rgba(251,191,36,0.5)] px-6 py-2.5 rounded-2xl flex items-center gap-4 backdrop-blur-md">
              {/* Killer Info */}
              <div className="flex items-center gap-2.5">
                <ChibiAvatar avatarType={killCallout.killerAvatar || 'faker'} size={36} />
                <div className="text-left">
                  <div className={`font-black text-xs ${killCallout.killerTeam === 'blue' ? 'text-cyan-400' : 'text-rose-400'}`}>
                    {killCallout.killerName}
                  </div>
                  <div className="text-[10px] text-slate-400 font-semibold">{killCallout.killerChamp}</div>
                </div>
              </div>

              {/* Action Badge */}
              <div className="flex flex-col items-center px-3 border-x border-slate-700/60">
                <div className="text-[10px] font-black uppercase tracking-wider text-amber-300">
                  ⚔️ KILLED ⚔️
                </div>
                <div className="text-[9px] text-amber-400 font-mono font-bold">+300g</div>
              </div>

              {/* Victim Info */}
              <div className="flex items-center gap-2.5 opacity-80">
                <div className="text-right">
                  <div className={`font-bold text-xs ${killCallout.victimTeam === 'blue' ? 'text-cyan-400' : 'text-rose-400'}`}>
                    {killCallout.victimName}
                  </div>
                  <div className="text-[10px] text-slate-400">{killCallout.victimChamp}</div>
                </div>
                <ChibiAvatar avatarType={killCallout.victimAvatar || 'faker'} size={36} />
              </div>
            </div>

            {/* Multikill & Streak Callout Sub-Badge */}
            {(killCallout.multiKill || killCallout.isFirstBlood || killCallout.streakText) && (
              <div className="mt-1.5 px-5 py-1 bg-gradient-to-r from-amber-500 via-rose-500 to-amber-500 text-slate-950 font-black text-xs uppercase tracking-widest rounded-full shadow-lg border border-yellow-200 animate-pulse flex items-center gap-2">
                {killCallout.isFirstBlood && <span>🩸 FIRST BLOOD!</span>}
                {killCallout.multiKill && <span>⚡ {killCallout.multiKill}!</span>}
                {killCallout.streakText && <span className="text-[10px] font-bold">({killCallout.streakText})</span>}
              </div>
            )}
          </div>
        )}

        {/* Top-Right Flash Banner */}
        {activeBanner && (
          <div className="absolute top-[112px] right-3 bg-slate-900/95 backdrop-blur-md border-2 border-amber-400/70 p-3 rounded-2xl shadow-2xl flex items-center gap-3 animate-scale-up max-w-md">
            <div className="text-2xl">{activeBanner.icon}</div>
            <div>
              <div className="font-black text-amber-300 text-xs tracking-wider uppercase">{activeBanner.text}</div>
              <div className="text-[10px] text-slate-300 font-semibold mt-0.5">{activeBanner.subtext}</div>
            </div>
          </div>
        )}
      </div>

      <div className="bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 flex flex-wrap items-center gap-2 min-h-12" aria-live="polite" aria-label="Death timers">
        <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 mr-1">Respawn timers</span>
        {deadChampions.length === 0 && <span className="text-xs text-emerald-300">All champions alive</span>}
        {deadChampions.map(u => <div key={u.id} className={`flex items-center gap-1.5 px-2 py-1 rounded-lg border text-xs font-bold ${u.team === 'blue' ? 'border-cyan-700 text-cyan-200' : 'border-rose-700 text-rose-200'}`}>
          <ChibiAvatar avatarType={u.player.avatarSvg} size={24} />
          <span>{u.player.name}</span>
          <span className="font-mono text-amber-300">{Math.ceil(u.respawnTimer)}s</span>
        </div>)}
      </div>

      <div className="flex justify-end gap-2">
        {fullscreenError && <span className="text-xs text-amber-300 self-center">Fullscreen unavailable in this browser</span>}
        <button onClick={() => setPaused(!paused)} className="p-2 bg-slate-800 text-white rounded-lg" aria-label={paused ? 'Resume match' : 'Pause match'}>
          {paused ? <Play className="w-4 h-4" /> : <Pause className="w-4 h-4" />}
        </button>
        {[1, 2, 4].map((s) => (
          <button key={s} onClick={() => setSpeed(s)} className={`px-3 py-1 rounded-lg text-xs font-bold ${speed === s ? 'bg-amber-400 text-slate-950' : 'bg-slate-800 text-slate-300'}`}>
            {s}x
          </button>
        ))}
      </div>

      {/* ======================================================== */}
      {/* 3. DUAL TEAM ITEM INVENTORY, LEVEL TIMINGS & KDA PANELS */}
      {/* ======================================================== */}
      <div className="grid grid-cols-2 gap-4">
        {/* Blue Squad Athlete Stats & Items */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-3 space-y-2">
          <div className="flex justify-between items-center text-xs font-black uppercase text-cyan-400 border-b border-slate-800 pb-1.5">
            <span>Blue Squad (Levels & Cooldowns)</span>
            <span className="font-mono text-amber-300">${blueGold.toLocaleString()} Gold</span>
          </div>

          {blueChamps.map((u) => {
            return (
              <div
                key={u.id}
                className={`border rounded-xl p-2 transition flex items-center justify-between ${u.isAlive ? 'bg-slate-950 border-cyan-500/30' : 'bg-slate-950 border-slate-800 opacity-40'}`}
              >
                <div className="flex items-center gap-2">
                  <div className="relative">
                    <ChibiAvatar avatarType={u.player.avatarSvg} size={32} />
                    <span className="absolute -bottom-1 -right-1 bg-amber-400 text-slate-950 text-[8px] font-black px-1 rounded-full border border-black shadow">
                      L{u.level}
                    </span>
                  </div>
                  <div>
                    <div className="text-xs font-bold text-white flex items-center gap-1.5">
                      <span>{u.player.name}</span>
                      <span className="text-[10px] text-cyan-300">({u.champion.name})</span>
                      {u.comboMastered && <span className="text-[9px] bg-violet-500/20 text-violet-200 px-1 rounded font-bold" title={`${AVATAR_COMBOS[u.champion.name]?.name} learned`}>Combo: {AVATAR_COMBOS[u.champion.name]?.name}</span>}
                      {!u.comboMastered && comboPracticeNeeded(u.player, u.champion.name) !== null && <span className="text-[9px] text-violet-300">Combo {u.comboPractice ?? 0}/{comboPracticeNeeded(u.player, u.champion.name)}</span>}
                      {u.level >= 6 && u.cdUlt <= 0 && u.mana >= 100 && (
                        <span className="text-[9px] bg-amber-500/20 text-amber-300 px-1 rounded font-bold">Ult Ready!</span>
                      )}
                      {u.level >= 6 && u.cdUlt > 0 && (
                        <span className="text-[9px] bg-slate-800 text-slate-400 px-1 rounded font-mono">Ult: {Math.ceil(u.cdUlt)}s</span>
                      )}
                    </div>
                    <div className="text-[9px] text-slate-400 font-mono">
                      KDA: <strong className="text-amber-300">{u.kills}/{u.deaths}/{u.assists}</strong> | CS: <strong className="text-white">{u.cs}</strong>
                      <span className="text-slate-600"> | </span>
                      Mana: <strong className="text-yellow-400">{Math.round(u.mana)}/100</strong>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  {/* 6-Item Inventory Slots */}
                  <div className="flex items-center gap-1 bg-slate-900 px-2 py-1 rounded-lg border border-slate-800">
                    {Array.from({ length: 6 }).map((_, slotIdx) => {
                      const it = u.items[slotIdx];
                      return (
                        <button
                          key={slotIdx}
                          onClick={() => it && setInspectedItem(it)}
                          disabled={!it}
                          className={`w-7 h-7 rounded border flex items-center justify-center text-xs transition ${
                            it
                              ? it.tier === 'Mythic'
                                ? 'bg-amber-950/80 border-amber-400 text-amber-200 hover:scale-110 shadow'
                                : it.tier === 'Component'
                                ? 'bg-blue-950/70 border-cyan-500 text-cyan-200 hover:scale-110 shadow'
                                : 'bg-slate-800 border-slate-600 hover:border-slate-400 hover:scale-110'
                              : 'bg-slate-950 border-slate-800/60'
                          }`}
                        >
                          {it ? it.icon : ''}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Red Squad Athlete Stats & Items */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-3 space-y-2">
          <div className="flex justify-between items-center text-xs font-black uppercase text-rose-400 border-b border-slate-800 pb-1.5">
            <span>Red Squad (Levels & Cooldowns)</span>
            <span className="font-mono text-amber-300">${redGold.toLocaleString()} Gold</span>
          </div>

          {redChamps.map((u) => (
            <div
              key={u.id}
              className={`bg-slate-950 border rounded-xl p-2 transition flex items-center justify-between ${
                u.isAlive ? 'border-rose-500/30' : 'border-slate-800 opacity-40'
              }`}
            >
              <div className="flex items-center gap-2">
                <div className="relative">
                  <ChibiAvatar avatarType={u.player.avatarSvg} size={32} />
                  <span className="absolute -bottom-1 -right-1 bg-amber-400 text-slate-950 text-[8px] font-black px-1 rounded-full border border-black shadow">
                    L{u.level}
                  </span>
                </div>
                <div>
                  <div className="text-xs font-bold text-white flex items-center gap-1.5">
                    <span>{u.player.name}</span>
                    <span className="text-[10px] text-rose-300">({u.champion.name})</span>
                    {u.comboMastered && <span className="text-[9px] bg-violet-500/20 text-violet-200 px-1 rounded font-bold" title={`${AVATAR_COMBOS[u.champion.name]?.name} learned`}>Combo: {AVATAR_COMBOS[u.champion.name]?.name}</span>}
                    {!u.comboMastered && comboPracticeNeeded(u.player, u.champion.name) !== null && <span className="text-[9px] text-violet-300">Combo {u.comboPractice ?? 0}/{comboPracticeNeeded(u.player, u.champion.name)}</span>}
                    {u.level >= 6 && u.cdUlt <= 0 && u.mana >= 100 && (
                      <span className="text-[9px] bg-amber-500/20 text-amber-300 px-1 rounded font-bold">Ult Ready!</span>
                    )}
                    {u.level >= 6 && u.cdUlt > 0 && (
                      <span className="text-[9px] bg-slate-800 text-slate-400 px-1 rounded font-mono">Ult: {Math.ceil(u.cdUlt)}s</span>
                    )}
                  </div>
                  <div className="text-[9px] text-slate-400 font-mono">
                    KDA: <strong className="text-amber-300">{u.kills}/{u.deaths}/{u.assists}</strong> | CS: <strong className="text-white">{u.cs}</strong>
                    <span className="text-slate-600"> | </span>
                    Mana: <strong className="text-yellow-400">{Math.round(u.mana)}/100</strong>
                  </div>
                </div>
              </div>

              {/* 6-Item Inventory Slots */}
              <div className="flex items-center gap-1 bg-slate-900 px-2 py-1 rounded-lg border border-slate-800">
                {Array.from({ length: 6 }).map((_, slotIdx) => {
                  const it = u.items[slotIdx];
                  return (
                    <button
                      key={slotIdx}
                      onClick={() => it && setInspectedItem(it)}
                      disabled={!it}
                      className={`w-7 h-7 rounded border flex items-center justify-center text-xs transition ${
                        it
                          ? it.tier === 'Mythic'
                            ? 'bg-amber-950/80 border-amber-400 text-amber-200 hover:scale-110 shadow'
                            : it.tier === 'Component'
                            ? 'bg-blue-950/70 border-cyan-500 text-cyan-200 hover:scale-110 shadow'
                            : 'bg-slate-800 border-slate-600 hover:border-slate-400 hover:scale-110'
                          : 'bg-slate-950 border-slate-800/60'
                      }`}
                    >
                      {it ? it.icon : ''}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ======================================================== */}
      {/* 4. ITEM TIMINGS & POWER SPIKES DOSSIER PANEL */}
      {/* ======================================================== */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4 shadow-xl">
        <div className="flex justify-between items-center mb-3">
          <h3 className="text-xs font-black uppercase tracking-wider text-amber-300 flex items-center gap-1.5">
            <TrendingUp className="w-4 h-4 text-amber-400" />
            <span>Match Item Timings & Power Spikes</span>
          </h3>
          <span className="text-[10px] text-slate-400">Recorded In-Game Purchases & Objectives</span>
        </div>

        {itemMilestones.length === 0 ? (
          <div className="text-xs text-slate-500 italic p-3 text-center bg-slate-950 rounded-xl border border-slate-800/50">
            Champions building initial components and trading towards legendary item spikes...
          </div>
        ) : (
          <div className="grid grid-cols-4 gap-2.5">
            {itemMilestones.map((ms, idx) => (
              <div
                key={idx}
                className={`bg-slate-950 border rounded-xl p-2.5 shadow text-xs flex items-center gap-2.5 ${
                  ms.team === 'blue' ? 'border-cyan-500/30' : 'border-rose-500/30'
                }`}
              >
                <div className="w-8 h-8 rounded-lg bg-slate-800 border border-amber-400/40 flex items-center justify-center text-base shadow">
                  {ms.itemIcon}
                </div>
                <div>
                  <div className="font-black text-white leading-tight flex items-center gap-1">
                    <span>{ms.itemName}</span>
                    <span className="text-[9px] font-mono text-amber-400">[{ms.time}]</span>
                  </div>
                  <div className="text-[10px] text-slate-400 mt-0.5">
                    {ms.playerName} ({ms.champName}) • <strong className="text-amber-300">{ms.stats}</strong>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ======================================================== */}
      {/* 5. LIVE MATCH EVENT LOG & ANNOUNCEMENTS */}
      {/* ======================================================== */}
      <div className="bg-slate-950 border border-slate-800 rounded-2xl p-3 max-h-36 overflow-y-auto font-mono text-xs text-slate-300 space-y-1">
        {eventFeed.map((evt) => (
          <div key={evt.id} className="flex items-center gap-2 leading-relaxed">
            <span className="text-slate-500 font-bold">[{evt.time}]</span>
            <span className={
              evt.type === 'tower' ? 'text-amber-400 font-black' :
              evt.type === 'dragon' ? 'text-cyan-300 font-black' :
              evt.type === 'jungle' ? 'text-emerald-300 font-bold' :
              evt.type === 'item' ? 'text-yellow-300 font-bold' :
              evt.type === 'level' ? 'text-purple-300 font-bold' :
              evt.type === 'combo' ? 'text-emerald-400 font-black' :
              evt.type === 'micro' ? 'text-cyan-300 font-bold' :
              evt.type === 'fountain' ? 'text-blue-300 font-bold' :
              'text-rose-300'
            }>
              {evt.text}
            </span>
          </div>
        ))}
      </div>

      {/* ======================================================== */}
      {/* 6. ITEM INSPECTION MODAL */}
      {/* ======================================================== */}
      {inspectedItem && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border-2 border-amber-500/50 rounded-3xl p-6 max-w-sm w-full shadow-2xl relative animate-scale-up">
            <button
              onClick={() => setInspectedItem(null)}
              className="absolute top-4 right-4 text-slate-400 hover:text-white"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 bg-slate-800 rounded-2xl border border-amber-400/50 flex items-center justify-center text-2xl shadow">
                {inspectedItem.icon}
              </div>
              <div>
                <h3 className="font-black text-white text-base leading-tight">{inspectedItem.name}</h3>
                <div className="text-xs text-amber-400 font-bold flex items-center gap-1.5 mt-0.5">
                  <span>{inspectedItem.tier} Item</span>
                  <span>•</span>
                  <span>🪙 {inspectedItem.cost} Gold</span>
                </div>
              </div>
            </div>

            <div className="bg-slate-950 rounded-xl p-3 border border-slate-800 text-xs space-y-1 mb-3">
              {inspectedItem.stats.ad && <div className="text-orange-300 font-bold">+{inspectedItem.stats.ad} Attack Damage</div>}
              {inspectedItem.stats.ap && <div className="text-cyan-300 font-bold">+{inspectedItem.stats.ap} Ability Power</div>}
              {inspectedItem.stats.hp && <div className="text-emerald-300 font-bold">+{inspectedItem.stats.hp} Health</div>}
              {inspectedItem.stats.armor && <div className="text-yellow-300 font-bold">+{inspectedItem.stats.armor} Armor</div>}
              {inspectedItem.stats.mr && <div className="text-purple-300 font-bold">+{inspectedItem.stats.mr} Magic Resist</div>}
              {inspectedItem.stats.aspd && <div className="text-blue-300 font-bold">+{Math.round(inspectedItem.stats.aspd * 100)}% Attack Speed</div>}
              {inspectedItem.stats.haste && <div className="text-indigo-300 font-bold">+{inspectedItem.stats.haste} Ability Haste</div>}
              {inspectedItem.stats.crit && <div className="text-red-300 font-bold">+{inspectedItem.stats.crit}% Critical Strike Chance</div>}
            </div>

            <div className="bg-amber-950/30 border border-amber-500/30 rounded-xl p-3 text-xs">
              <div className="font-black text-amber-300 flex items-center gap-1 mb-1">
                <Sparkles className="w-3.5 h-3.5" /> Unique: {inspectedItem.passiveName}
              </div>
              <div className="text-slate-300 leading-relaxed">
                {inspectedItem.passiveDesc}
              </div>
            </div>

            <button
              onClick={() => setInspectedItem(null)}
              className="mt-4 w-full py-2 bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs rounded-xl transition"
            >
              Close Dossier
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
