export interface PersonalTheme {
  id: string; name: string; background: string; surface: string; text: string; accent: string;
  density: 'comfortable' | 'compact';
}
export interface SupporterMembership {
  active: boolean; kind: string; level: 'free' | 'signal' | 'beacon'; label: string;
  unlimited: boolean; ends_at: string | null;
  features: {custom_logo:boolean; custom_jerseys:boolean; themes:boolean; custom_theme:boolean; player_identity:boolean};
}
export interface PlayerAppearance {
  skin?: number; hair?: number; style?: number; glasses?: boolean; headset?: boolean; jersey?: string; accent?: string;
}
export interface PlayerPresentation {bio?: string; appearance?: PlayerAppearance}
export const DEFAULT_THEME: PersonalTheme = {id:'cinder',name:'Cinder',background:'#141416',surface:'#242125',text:'#e8e2e6',accent:'#bd3049',density:'comfortable'};
