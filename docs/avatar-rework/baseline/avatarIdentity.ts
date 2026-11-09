import type { ChampionKit } from './types';

export interface AvatarIdentity {
  internalName: string;
  displayName: string;
  title: string;
}

// Internal names remain stable gameplay/save keys. Display names and titles
// are presentation-only and preserve the requested avatar-parody direction.
export const AVATAR_IDENTITIES: readonly AvatarIdentity[] = [
  ['Solana', 'Dawnna', 'The Daybreak Bulwark'], ['Astra', 'Aiselle', 'The Glacial Regent'],
  ['Kyumi', 'Vixelle', 'The Foxfire Enchantress'], ['Buck', 'Gritlock', 'The Trench Gunslinger'],
  ['Valkira', 'Bessara', 'The Shattered Blade'], ['Kage', 'Vanta', 'The Umbral Executioner'],
  ['Kazemaru', 'Galejandro', 'The Exiled Gale'], ['Kindra', 'Lambent', 'The Twin Verdict'],
  ['Cora', 'Plumeira', 'The Feather Rebellion'], ['Renn', 'Gildan', 'The Tidebound Herald'],
  ['Sylla', 'Sylvan Solo', 'The Wildbound Hermit'], ['Tequoia', 'Fernanda', 'The Stoneweaver Nomad'],
  ['Zal', 'Glimmerick', 'The Chronal Shepherd'], ['Xin', 'Cindergent', 'The Ember Ascendant'],
  ['Raijin', 'Voltaire', 'The Living Tempest'], ['Kaolin', 'TerraByte', 'The Jade Remnant'],
  ['Inai', 'Nulliver', 'The Veilwalker'], ['Veyara', 'Crownfetti', 'The Elemental Regent'],
  ['Cinderbloom', 'Sootcase', 'The Ashen Exorcist'], ['Solenne', 'Sennova', 'The Waylight Sentinel'],
  ['Croakwell', 'Basso Croak', 'The River Bargainer'], ['Soulscourge', 'Razeberry', 'The Soul Furnace'],
  ['Stonewake', 'Quakewell', 'The Faultborn Colossus'], ['Mirehook', 'Rotisserie', 'The Mire Reaver'],
  ['Nullweaver', 'Midnight Equation', 'The Void Cartographer'], ['Voltgrip', 'Plugsy', 'The Galvanic Grappler'],
  ['Aetherbolt', 'Relic Rick', 'The Riftway Explorer'], ['Corsara', 'Bounty Belle', 'The Scarlet Privateer'],
  ['Brewmaw', 'Kegory', 'The Cask Colossus'], ['Wraithhook', 'Hooklyn', 'The Lantern Collector'],
  ['Kaelen', 'Arsenaldo', 'The Conflux Savant'], ['Hweilin', 'Inkognito', 'The Living Canvas'],
  ['Jaxon', 'Hexley', 'The Twinform Vanguard'], ['Valerie', 'Knuckleberry', 'The Breakline Enforcer'],
  ['Jinxy', 'Boomie', 'The Mayhem Artillerist'], ['Paxi', 'Fizzlewing', 'The Dreamrift Trickster'],
  ['Batrix', 'Wickety', 'The Cinderwing Raider'], ['Quillback', 'Hedgehoggin', 'The Barbed Vanguard'],
  ['Aetheris', 'Orbiton', 'The Harmonic Wisp'], ['Faelith', 'Pixabelle', 'The Briar Enchanter'],
  ['Oathmute', 'Muffleton', 'The Silent Edict'], ['Cloudtail', 'Stafford', 'The Miststaff Trickster'],
  ['Stonebranch', 'Primate Minister', 'The Canopy Sovereign'], ['Stepstone', 'Kickswitch', 'The Quiet Bell'],
  ['Skybreaker', 'Propella', 'The Flakwing Ace'],
].map(([internalName, displayName, title]) => ({ internalName, displayName, title }));

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
