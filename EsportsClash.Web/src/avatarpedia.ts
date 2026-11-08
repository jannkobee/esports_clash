import type { ClubIdentity } from './components/ClubIdentityEditor';

export const PEDIA_KINDS = ['tournaments', 'teams', 'nations', 'players', 'coaches', 'avatars', 'items', 'releases', 'organizers', 'sponsors', 'talent'] as const;
export type PediaKind = typeof PEDIA_KINDS[number];
export const PEDIA_LABELS: Record<PediaKind, string> = { tournaments: 'Tournaments', teams: 'Teams', nations: 'National teams', players: 'Players', coaches: 'Coaches', avatars: 'Avatars', items: 'Items', releases: 'Releases', organizers: 'Organizers', sponsors: 'Sponsors',talent:'Talent & officials' };
export interface PediaTeam { id: number; name: string; tag: string; tier: number; is_bot: boolean; identity?: ClubIdentity; created_at?: string; updated_at?: string; roster?: {player:PediaPlayer;training_xp:number}[] }
export interface PediaPlayer { nationality?:{id:number;code:string;name:string}|null; status?:string; id: string; name: string; role: string; age: number | null; overall: number | null; stats: Record<string, number>; primaryPersonality?: string | null; secondaryPersonality?: string | null; signature_avatar_ids: string[] }
export interface PediaAvatar { id: string; name: string; title?: string; primaryRole: string; secondaryRole?: string; archetype?: string; lore?: string; hp: number; ad: number; armor: number; mr: number; aspd: number; range: number; skills: { id: string; slot: string; name: string; desc: string; damage?: number; cooldown?: number; disabled?: boolean }[] }
export interface PediaItem { id: string; name: string; cost: number; tier: string; stats: Record<string, number>; passiveName: string; passiveDesc: string; suitableRoles: string[]; version: number }
export interface PediaRelease { id: string; name: string; active: boolean; date: string; rules: string | null; ability_ruleset: string | null }
export interface PediaFixture { id: number; competition: string; kickoff_at: string; orders_close_at: string; status: string; started_at: string | null; tournament_id: number | null; bracket_slot: number | null; home: {id: number; name: string; national?:boolean}; away: {id: number; name: string; national?:boolean}; winner: string | null; winner_id: number | null; watch_match_id: string | null; score: { blue: number; red: number } | null; duration_seconds: number | null }
export interface PediaTournament { starts_at?:string|null;ends_at?:string|null;regulations?:{stages?:{format:string}[]};sponsor_ids?:string[]; provenance?:string; capacity?:number; definition_id?:number|null; participant_type?:string; id: number; name: string; year: number; tier: number|null; status: string; organizer: string; organizer_id: string; sponsor: string; sponsor_id: string; rules: string; entries: number; champion_id: number | null; champion_prize: number; runner_up_prize: number; registration_closes_at: string; semifinals_at: string; second_semifinal_at: string; final_at: string; updated_at: string; currency: string }
export interface PediaStatistics { appearances: number; wins: number; losses: number; minutes: number }
export interface PediaCoach { id:string; name:string; style:string; tier:string; quote?:string; rating10?:number; chemistryBonus?:number; playbookBonus?:number; extraBans?:number; coachAttributes?:Record<string,number> }
export interface PediaHub { name: string; generated_at: string; catalog_id: string | null; content_hash: string; clubs: PediaTeam[]; players: PediaPlayer[]; avatars: PediaAvatar[]; items: PediaItem[]; patches: PediaRelease[]; events: PediaTournament[]; fixtures: PediaFixture[]; standings: {competition: string; year: number; clubs: {id: number; name: string; wins: number; losses: number}[]}[]; counts: Record<string, number> }
type PediaFields<T> = Partial<Omit<T, 'id' | 'name' | 'tier'>>;
export type PediaRow = { id: string | number; name: string; tier?: number | string | null } & PediaFields<PediaTeam> & PediaFields<PediaPlayer> & PediaFields<PediaCoach> & PediaFields<PediaAvatar> & PediaFields<PediaItem> & PediaFields<PediaRelease> & PediaFields<PediaTournament>;
export interface PlayerCareerData {form?:import('./playerForm').PlayerFormData;registered_at:string|null;retired_at:string|null;current_contract:{id:number;name:string}|null;transfers:{id:string|number;date:string|null;from:{id:number;name:string};to:{id:number;name:string};fee:number|null;method:string}[];development:{observed_at:string;training_xp:number;stats:Record<string,number>;overall:number}[];appearances:{fixture_id:number;match_id:string|null;date:string;competition:string;club:{id:number|null;name:string};won:boolean}[];match_ratings:{match_id:string;date:string;competition:string;club:{id:number|null;name:string};won:boolean;rating:number;performance:Record<string,number>}[];honors:{tournament_id:number;name:string;year:number;club_id:number;basis:string}[];note:string}
export interface PediaArticle {
  kind: PediaKind;
  record: PediaRow & {
    stats?: Record<string, number>; teams?: PediaTeam[]; signature_avatars?: PediaAvatar[]; signature_players?: PediaPlayer[];
    roster?: {player: PediaPlayer; training_xp: number}[]; tournaments?: PediaTournament[]; champion?: PediaTeam | null;
    record?: {played: number; wins: number; losses: number}; statistics?: PediaStatistics; fixtures?: PediaFixture[];
    type?: string;bio?:string;profile?:{nationality?:string;languages?:string[];specialty?:string};posts?:{id:number;headline:string;body:string;published_at:string}[];appointments?:{id:number;competition:string;kickoff_at:string;tournament_id:number|null;role:string}[];talent?:{id:number;name:string;role:string}[]; career?:PlayerCareerData;
  };
  source: {catalog_id: string | null; content_hash: string; generated_at: string};
}
export interface PediaDirectory { items: PediaRow[]; meta: {page: number; per_page: number; total: number; last_page: number} }
export type PediaPage='guide'|'laboratory'|'catalog';
export interface PediaRoute { kind?: PediaKind; id?: string; page?:PediaPage }

export function pediaHref(kind?: PediaKind, id?: string | number): string {
  return '#codex' + (kind ? '/'+kind : '') + (id !== undefined ? '/'+encodeURIComponent(String(id)) : '');
}

export function readPediaRoute(): PediaRoute {
  const [root, category, encoded] = window.location.hash.slice(1).split('?')[0].split('/');
  if (!['avatarpedia','codex'].includes(root))return {};
  if(['guide','laboratory','catalog'].includes(category))return {page:category as PediaPage};
  if(!PEDIA_KINDS.includes(category as PediaKind))return {};
  try { return {kind: category as PediaKind, id: encoded ? decodeURIComponent(encoded) : undefined}; }
  catch { return {kind: category as PediaKind}; }
}

const referenceDate=new Intl.DateTimeFormat('en-PH',{timeZone:'Asia/Manila',dateStyle:'medium',timeStyle:'short'});
export const pediaTime=(value?:string|null)=>{if(!value)return 'To be announced';const date=new Date(value);return Number.isFinite(date.getTime())?referenceDate.format(date):'To be announced';};
export const pediaMoney = (minor: number) => new Intl.NumberFormat('en-PH', {style: 'currency', currency: 'PHP', minimumFractionDigits: 0, maximumFractionDigits: 2}).format(minor / 100);
export const pediaStatus = (value: string) => value.replaceAll('_', ' ').replace(/^./, char => char.toUpperCase());
export const pediaTier=(tier?:number|string|null)=>tier===null?'Open tier':tier===undefined?'Tier unlisted':'Tier '+tier;
