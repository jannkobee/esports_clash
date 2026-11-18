import type {IconKey} from './icons';

/**
 * Workspace information architecture. Destinations are grouped by what the manager is trying to do:
 * run the club, compete, watch and follow, practise, and research. Every item is a real route.
 */
export type NavKey =
  | 'home' | 'squad' | 'matches' | 'market' | 'finances'
  | 'competitions' | 'communityCups'
  | 'hexacast' | 'wire' | 'crown'
  | 'practice' | 'broadcastLab'
  | 'scouting' | 'hexapedia'
  | 'supporter' | 'settings';

export interface NavItem {key: NavKey; label: string; href: string; icon: IconKey; hint: string}
export interface NavGroup {id: string; label: string; items: NavItem[]}

export const WORKSPACE_NAV: NavGroup[] = [
  {id: 'club', label: 'Your club', items: [
    {key: 'home', label: 'Home', href: '#club-home', icon: 'home', hint: 'What needs your attention today'},
    {key: 'squad', label: 'Squad', href: '#squad', icon: 'squad', hint: 'Starting five, training and staff'},
    {key: 'matches', label: 'Matches', href: '#match-centre', icon: 'play', hint: 'Fixtures, match orders, scrimmages and results'},
    {key: 'market', label: 'Transfers', href: '#transfer-exchange', icon: 'market', hint: 'Auctions, sales, trades, scouting and the academy'},
    {key: 'finances', label: 'Finances', href: '#finances', icon: 'finances', hint: 'Cash, income and payroll'},
  ]},
  {id: 'compete', label: 'Compete', items: [
    {key: 'competitions', label: 'Competitions', href: '#competitions', icon: 'competitions', hint: 'Championships, calendar and rankings'},
    {key: 'communityCups', label: 'Community cups', href: '#community-cups', icon: 'communityCups', hint: 'Weekly invitational cups'},
  ]},
  {id: 'watch', label: 'Watch & follow', items: [
    {key: 'hexacast', label: 'Hexacast', href: '#hexacast', icon: 'hexacast', hint: 'Live, upcoming and replayed broadcasts'},
    {key: 'wire', label: 'The Wire', href: '#wire', icon: 'wire', hint: 'News and reactions from the circuit'},
    {key: 'crown', label: 'Crown 2026', href: '#launch-championship', icon: 'crown', hint: 'The launch championship archive'},
  ]},
  {id: 'practice', label: 'Practice', items: [
    {key: 'practice', label: 'Practice match', href: '#arena-practice', icon: 'practice', hint: 'Play your five against a practice side'},
    {key: 'broadcastLab', label: '3D Broadcast Lab', href: '#fps-simulation', icon: 'broadcastLab', hint: 'Watch live 3D exhibitions'},
  ]},
  {id: 'research', label: 'Research', items: [
    {key: 'scouting', label: 'Player directory', href: '#hexapedia/players', icon: 'scouting', hint: 'Every player record'},
    {key: 'hexapedia', label: 'Hexapedia', href: '#hexapedia', icon: 'hexapedia', hint: 'Teams, tournaments and game reference'},
  ]},
  {id: 'account', label: 'Account', items: [
    {key: 'supporter', label: 'Supporter studio', href: '#supporter-studio', icon: 'supporter', hint: 'Membership and cosmetics'},
    {key: 'settings', label: 'Settings', href: '#settings', icon: 'settings', hint: 'Account, audio and practice preferences'},
  ]},
];

export type WorkspaceArea = 'home' | 'squad' | 'play' | 'market' | 'finances' | 'hexapedia' | 'history' | 'supporter' | 'settings';
export type PlayArea = 'modes' | 'split' | 'community' | 'competitions' | 'news' | 'broadcasts' | 'archive';

/** The sidebar item that owns the current view. */
export function activeNavKey(section: WorkspaceArea, play: PlayArea, hash: string): NavKey {
  if (section === 'history') return 'matches';
  if (section === 'hexapedia') return /^#?hexapedia\/players(\/|$|\?)/.test(hash) ? 'scouting' : 'hexapedia';
  if (section !== 'play') return section;
  return ({split: 'matches', competitions: 'competitions', community: 'communityCups', broadcasts: 'hexacast', news: 'wire', archive: 'crown', modes: 'practice'} as const)[play];
}

/** Title and purpose of each area, shown in the page header. Areas with their own masthead return null. */
export function areaHeading(key: NavKey): {title: string; description: string; group: string; icon: IconKey} | null {
  for (const group of WORKSPACE_NAV) {
    const item = group.items.find(i => i.key === key);
    if (item) return ['hexacast', 'wire', 'crown', 'hexapedia', 'scouting'].includes(key) ? null : {title: item.label, description: item.hint + '.', group: group.label, icon: item.icon};
  }
  return null;
}

/** Where the current view sits, for the top-bar breadcrumb. */
export function navTrail(key: NavKey): [string, string] {
  for (const group of WORKSPACE_NAV) {
    const item = group.items.find(i => i.key === key);
    if (item) return [group.label, item.label];
  }
  return ['Your club', 'Home'];
}
