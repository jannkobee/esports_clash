import type { ChampionKit } from './types';

export function avatarDisplayName(name: string, avatars: readonly ChampionKit[]): string {
  return avatars.find(avatar => avatar.name === name)?.displayName ?? name;
}
