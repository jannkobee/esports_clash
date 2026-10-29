import {HERO_IDENTITIES_V3} from './heroIdentityV3.ts';
import type { ChampionKit } from './types';

export interface AvatarIdentity {
  internalName: string;
  displayName: string;
  title: string;
}

// Internal names remain stable gameplay/save keys. Display names and titles
// are presentation-only and preserve the requested avatar-parody direction.
export const AVATAR_IDENTITIES: readonly AvatarIdentity[] = HERO_IDENTITIES_V3.map(hero=>({internalName:hero.internalName,displayName:hero.displayName,title:hero.title}));

const IDENTITY_BY_INTERNAL_NAME = new Map(AVATAR_IDENTITIES.map(identity => [identity.internalName, identity]));

export function getAvatarIdentity(internalName: string): AvatarIdentity | undefined {
  return IDENTITY_BY_INTERNAL_NAME.get(internalName);
}

export function applyAvatarIdentities(avatars: readonly ChampionKit[]): ChampionKit[] {
  return avatars.map(avatar => {
    const identity = getAvatarIdentity(avatar.name);
    return identity ? { ...avatar, displayName: identity.displayName, title: identity.title } : avatar;
  });
}

export function refreshAvatarPresentation<T extends Pick<ChampionKit, 'id' | 'name' | 'displayName' | 'title'>>(
  savedAvatar: T,
  catalog: readonly ChampionKit[],
): T {
  const current = catalog.find(avatar => avatar.id === savedAvatar.id)
    ?? catalog.find(avatar => avatar.name === savedAvatar.name);
  return current ? { ...savedAvatar, displayName: current.displayName, title: current.title } : savedAvatar;
}
