import {
  Archive, ArrowLeftRight, Award, BookOpen, Bot, Box, Briefcase, Backpack, Brain, Building2, CalendarDays, Clapperboard, Cpu,
  Crosshair, Crown, Flag, GraduationCap, Gauge, Handshake, History, House, LayoutGrid, LifeBuoy, Map, Medal, Megaphone,
  Mic, Newspaper, Palette, Radio, Scale, ScanSearch, Settings, Shield, Swords, Target, Trophy, UserRoundCog, Users, Wallet,
  type LucideIcon,
} from 'lucide-react';

/**
 * One icon per destination. Navigation sets below must not repeat an icon inside the same set
 * (`ui/icons.test.mjs` asserts it), so a glance at the icon alone identifies the page.
 * The same destination may reuse its icon across sets (Hexacast in the sidebar and in Match centre).
 */
export const ICONS = {
  // Sidebar
  home: House, squad: Users, play: Swords, market: ArrowLeftRight, finances: Wallet, history: History,
  wire: Newspaper, hexacast: Radio, crown: Crown, broadcastLab: Clapperboard, scouting: ScanSearch, circuit: Mic,
  hexapedia: BookOpen, supporter: Palette, settings: Settings,
  // Match centre
  fixtures: CalendarDays, scrimmages: Handshake, competitions: Trophy, communityCups: Medal, practice: Box,
  // Hexapedia: game reference
  pediaHome: LayoutGrid, tacticalFps: Crosshair, roles: UserRoundCog, personalities: Brain, personalityEngine: Cpu,
  weapons: Target, gear: Backpack, maps: Map, skills: Gauge, live3d: Bot, rules: Scale,
  // Hexapedia: world records
  tournaments: Trophy, teams: Shield, nations: Flag, players: Users, coaches: GraduationCap, organizers: Building2,
  sponsors: Megaphone, talent: Mic, managers: Briefcase, laurels: Award, guide: LifeBuoy, records: Archive,
} as const satisfies Record<string, LucideIcon>;

export type IconKey = keyof typeof ICONS;

/** Navigation sets: every key in a set has a distinct icon. */
export const NAV_SETS: Record<string, readonly IconKey[]> = {
  sidebar: ['home', 'squad', 'play', 'market', 'finances', 'competitions', 'communityCups', 'hexacast', 'wire', 'crown', 'practice', 'broadcastLab', 'scouting', 'hexapedia', 'supporter', 'settings'],
  matches: ['fixtures', 'scrimmages', 'history'],
  pediaOverview: ['pediaHome', 'guide'],
  pediaReference: ['tacticalFps', 'roles', 'personalities', 'personalityEngine', 'weapons', 'gear', 'maps', 'skills', 'live3d', 'rules'],
  pediaRecords: ['tournaments', 'teams', 'nations', 'players', 'coaches', 'organizers', 'sponsors', 'talent', 'managers', 'laurels'],
};

/** Hexapedia FPS reference section id → icon key. */
export const FPS_SECTION_ICONS: Record<string, IconKey> = {
  fps: 'tacticalFps', roles: 'roles', personalities: 'personalities', identityPersonalities: 'personalityEngine',
  weapons: 'weapons', equipment: 'gear', maps: 'maps', attributes: 'skills', liveSimulation: 'live3d', rules: 'rules',
};
