import { AVATAR_ANIMATION_MOTIFS, type SkillSlot } from './avatarSkillAnimation.ts';

// The recordings are Kenney CC0 assets in public/audio/kenney. Each kit has a
// deliberate material palette; a small stable pitch offset separates kits that
// share a recording without making combat sounds chipmunk-like.
const KITS: Record<string, readonly [string, string, string]> = {
  Solana: ['impact-impactBell_heavy_000', 'sci-forceField_000', 'sci-explosionCrunch_000'],
  Astra: ['rpg-drawKnife1', 'rpg-knifeSlice', 'impact-impactWood_heavy_000'],
  Kyumi: ['sci-forceField_000', 'sci-laserSmall_000', 'sci-laserLarge_000'],
  Buck: ['impact-impactMetal_medium_000', 'rpg-metalClick', 'sci-explosionCrunch_000'],
  Valkira: ['rpg-drawKnife1', 'rpg-knifeSlice', 'impact-impactMetal_heavy_000'],
  Kage: ['rpg-cloth1', 'rpg-knifeSlice', 'sci-spaceEngineLow_000'],
  Kazemaru: ['rpg-cloth1', 'rpg-knifeSlice', 'sci-thrusterFire_000'],
  Kindra: ['impact-impactSoft_heavy_000', 'rpg-knifeSlice', 'impact-impactPunch_heavy_000'],
  Cora: ['rpg-cloth1', 'rpg-knifeSlice', 'impact-impactBell_heavy_000'],
  Renn: ['rpg-cloth1', 'sci-thrusterFire_000', 'impact-impactWood_heavy_000'],
  Sylla: ['impact-impactWood_heavy_000', 'rpg-creak1', 'impact-impactPunch_heavy_000'],
  Tequoia: ['rpg-creak1', 'impact-impactWood_heavy_000', 'impact-impactMining_000'],
  Zal: ['sci-spaceEngineLow_000', 'impact-impactSoft_heavy_000', 'sci-lowFrequency_explosion_000'],
  Xin: ['sci-thrusterFire_000', 'impact-impactGeneric_light_000', 'sci-explosionCrunch_000'],
  Raijin: ['sci-laserSmall_000', 'sci-laserRetro_000', 'sci-laserLarge_000'],
  Kaolin: ['impact-impactMining_000', 'impact-impactWood_heavy_000', 'impact-impactPunch_heavy_000'],
  Inai: ['sci-forceField_000', 'sci-spaceEngineLow_000', 'sci-lowFrequency_explosion_000'],
  Veyara: ['impact-impactGlass_light_000', 'sci-forceField_000', 'impact-impactGlass_heavy_000'],
  Cinderbloom: ['sci-thrusterFire_000', 'sci-explosionCrunch_000', 'sci-lowFrequency_explosion_000'],
  Solenne: ['rpg-cloth1', 'sci-forceField_000', 'impact-impactGlass_heavy_000'],
  Croakwell: ['impact-impactBell_heavy_000', 'rpg-metalPot1', 'sci-explosionCrunch_000'],
  Soulscourge: ['sci-spaceEngineLow_000', 'sci-slime_000', 'sci-lowFrequency_explosion_000'],
  Stonewake: ['impact-impactMining_000', 'impact-impactWood_heavy_000', 'impact-impactMetal_heavy_000'],
  Mirehook: ['rpg-metalClick', 'impact-impactMetal_medium_000', 'impact-impactMetal_heavy_000'],
  Nullweaver: ['sci-forceField_000', 'sci-spaceEngineLow_000', 'sci-lowFrequency_explosion_000'],
  Voltgrip: ['sci-laserSmall_000', 'impact-impactMetal_medium_000', 'sci-laserLarge_000'],
  Aetherbolt: ['sci-laserRetro_000', 'sci-forceField_000', 'sci-laserLarge_000'],
  Corsara: ['impact-impactMetal_medium_000', 'sci-explosionCrunch_000', 'sci-lowFrequency_explosion_000'],
  Brewmaw: ['rpg-metalPot1', 'sci-slime_000', 'impact-impactGlass_heavy_000'],
  Wraithhook: ['rpg-metalClick', 'sci-spaceEngineLow_000', 'impact-impactBell_heavy_000'],
  Kaelen: ['rpg-drawKnife1', 'impact-impactMetal_medium_000', 'impact-impactMetal_heavy_000'],
  Hweilin: ['rpg-cloth1', 'sci-slime_000', 'impact-impactGlass_heavy_000'],
  Jaxon: ['impact-impactMetal_medium_000', 'sci-laserSmall_000', 'impact-impactMetal_heavy_000'],
  Valerie: ['impact-impactPunch_medium_000', 'impact-impactMetal_medium_000', 'impact-impactPunch_heavy_000'],
  Jinxy: ['rpg-metalClick', 'sci-laserRetro_000', 'sci-explosionCrunch_000'],
  Paxi: ['sci-forceField_000', 'impact-impactGlass_light_000', 'impact-impactBell_heavy_000'],
  Batrix: ['rpg-cloth1', 'sci-thrusterFire_000', 'sci-explosionCrunch_000'],
  Quillback: ['rpg-knifeSlice', 'impact-impactPunch_medium_000', 'impact-impactWood_heavy_000'],
  Aetheris: ['sci-laserSmall_000', 'sci-forceField_000', 'sci-lowFrequency_explosion_000'],
  Faelith: ['impact-impactGlass_light_000', 'sci-forceField_000', 'impact-impactBell_heavy_000'],
  Oathmute: ['sci-laserRetro_000', 'rpg-cloth1', 'sci-spaceEngineLow_000'],
  Cloudtail: ['impact-impactWood_heavy_000', 'rpg-cloth1', 'impact-impactPunch_heavy_000'],
  Stonebranch: ['impact-impactMining_000', 'rpg-creak1', 'impact-impactWood_heavy_000'],
  Stepstone: ['impact-impactPunch_medium_000', 'rpg-metalClick', 'impact-impactPunch_heavy_000'],
  Skybreaker: ['impact-impactMetal_medium_000', 'sci-thrusterFire_000', 'sci-explosionCrunch_000'],
};

export const AVATAR_SOUND_ASSETS = [...new Set(Object.values(KITS).flat())];
const AVATAR_SOUND_INDEX = new Map(Object.keys(KITS).map((name, index) => [name, index]));

export type SoundCharacter = 'arcane' | 'fire' | 'steel' | 'organic' | 'void' | 'wind' | 'impact';

export interface SkillSoundCue {
  sample: string;
  generatedFilename: string;
  accent: string;
  rate: number;
  gain: number;
  accentDelay: number;
  accentRate: number;
  accentGain: number;
  lowpassHz: number;
  reverb: number;
  character: SoundCharacter;
}

function soundCharacterFor(sample: string): SoundCharacter {
  if (/thruster|explosionCrunch/.test(sample)) return 'fire';
  if (/forceField|laser/.test(sample)) return 'arcane';
  if (/spaceEngine|lowFrequency/.test(sample)) return 'void';
  if (/Metal|metalClick|Bell|Mining/.test(sample)) return 'steel';
  if (/Wood|creak|Soft|slime|metalPot/.test(sample)) return 'organic';
  if (/cloth|knife|drawKnife/.test(sample)) return 'wind';
  return 'impact';
}

export function getAvatarSkillSoundCue(avatarName: string, slot: SkillSlot): SkillSoundCue | null {
  const kit = KITS[avatarName];
  if (!kit || !AVATAR_ANIMATION_MOTIFS[avatarName]) return null;
  const index = AVATAR_SOUND_INDEX.get(avatarName) ?? 0;
  const slotIndex = slot === 'skill1' ? 0 : slot === 'skill2' ? 1 : 2;
  const rate = 0.91 + (index % 11) * 0.017 + slotIndex * 0.025;
  const character = soundCharacterFor(kit[slotIndex]);
  const ultimate = slot === 'ultimate';
  const lowpassHz = character === 'void' ? 2400 : character === 'organic' ? 4200
    : character === 'steel' ? 7600 : 6200;
  return {
    sample: kit[slotIndex],
    generatedFilename: `${avatarName.toLowerCase()}_${slot === 'ultimate' ? 'ultimate' : slot}.wav`,
    accent: ultimate ? kit[0] : kit[(slotIndex + 1) % 3],
    rate,
    gain: ultimate ? 0.26 : 0.19,
    accentDelay: ultimate ? 0.072 : 0.028,
    accentRate: rate * (ultimate ? 0.76 : 0.86),
    accentGain: ultimate ? 0.105 : 0.058,
    lowpassHz,
    reverb: ultimate ? 0.22 : character === 'arcane' || character === 'void' ? 0.13 : 0.07,
    character,
  };
}
