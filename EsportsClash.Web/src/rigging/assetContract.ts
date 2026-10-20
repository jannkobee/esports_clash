/**
 * Phase 1: Character Generation Requirements & Asset Contract
 *
 * Enforces strict humanoid asset preparation rules, prompt templates,
 * weapon separation requirements, and standardized asset directory layout.
 */

import type { WeaponAssetConfig, CharacterAssetBundle } from './types.ts';

export const HUMANOID_GENERATION_CONTRACT = {
  pose: 'neutral_t_pose',
  armOrientation: 'horizontal_extended_90_deg',
  legSeparation: 'spaced_feet_shoulder_width',
  jointVisibility: ['head', 'neck', 'shoulders', 'elbows', 'wrists', 'hands', 'hips', 'knees', 'ankles', 'feet'],
  prohibitedFeatures: [
    'merged_weapons_in_body_mesh',
    'merged_shields_in_hands',
    'fused_legs',
    'occluded_arms_behind_back',
    'seated_or_crouched_pose',
    'missing_limbs',
  ],
  coordinateSystem: {
    upAxis: '+Y',
    forwardAxis: '+Z',
    rightAxis: '+X',
    worldUnitsPerMeter: 40,
    standardHeightUnits: 70, // Standard MOBA hero height in game units
  },
  supportedFormats: ['model/gltf-binary', 'model/gltf+json'],
} as const;

/**
 * Standardized AI generation prompt template requesting a pure humanoid body in T-pose
 * without attached weapons, guaranteeing clean joint detection and rigging.
 */
export function buildHumanoidCharacterPrompt(hero: {
  name: string;
  role: string;
  silhouette: string;
  costume: string;
  skinColor: string;
  hairColor: string;
}): string {
  return [
    `Full-body 3D humanoid character model of ${hero.name}, a stylized MOBA ${hero.role}.`,
    `STRICT ANATOMICAL T-POSE: Character must stand upright in a symmetrical neutral T-pose with both arms extended horizontally sideways at 90 degrees, palms facing downward.`,
    `LEGS SEPARATED: Legs must be clearly separated and straight, feet shoulder-width apart, standing flat on the ground plane.`,
    `NO MERGED WEAPONS: Absolutely no weapons, swords, shields, staffs, bows, guns, or handheld items attached or merged into the hands or body mesh. Bare hands with fingers visible. Weapons are created as separate assets.`,
    `VISIBILITY: Ensure clear, unobstructed views of the neck, elbows, wrists, hips, knees, and ankles.`,
    `VISUAL IDENTITY: ${hero.silhouette}. Costume: ${hero.costume}. Skin tone: ${hero.skinColor}, Hair: ${hero.hairColor}. Clean stylized textures, heroic MOBA proportions.`,
    `Output as a single clean humanoid GLB model with intact materials and textures, facing forward along +Z axis with Y-up orientation.`,
  ].join(' ');
}

/**
 * Prompt template for generating separate weapon assets.
 */
export function buildSeparateWeaponPrompt(weapon: {
  heroName: string;
  weaponType: string;
  description: string;
  signatureStyle: string;
}): string {
  return [
    `Isolated 3D weapon asset: ${weapon.weaponType} for MOBA character ${weapon.heroName}.`,
    `Style: ${weapon.description}. Signature visual: ${weapon.signatureStyle}.`,
    `ORIENTATION: Centered at world origin (0, 0, 0). The primary grip/handle must be located exactly at the origin for natural hand attachment.`,
    `ISOLATED ASSET: No character hands, fingers, or bodies attached to the weapon. Pure clean weapon mesh.`,
    `Output as a standalone GLB asset with PBR materials, ready for socket attachment.`,
  ].join(' ');
}

/**
 * Standard asset structure resolver
 */
export function resolveAssetBundlePaths(characterId: string, baseDir = '/models/characters'): CharacterAssetBundle {
  const root = `${baseDir}/${characterId}`;
  return {
    characterId,
    characterGlbUri: `${root}/character.glb`,
    metadataJsonUri: `${root}/character-metadata.json`,
    weapons: {
      primaryGlbUri: `${root}/weapons/primary.glb`,
      secondaryGlbUri: `${root}/weapons/secondary.glb`,
      configs: getDefaultWeaponConfigsForHero(characterId),
    },
    rig: {
      riggedGlbUri: `${root}/rig/rigged-character.glb`,
      skeletonJsonUri: `${root}/rig/skeleton.json`,
      landmarksJsonUri: `${root}/rig/landmarks.json`,
    },
    animations: {
      glbUri: `${root}/animations/clips.glb`,
      clips: [
        { name: 'Idle', duration: 2.0, fps: 30, frameCount: 60, isLooping: true, hasRootMotion: false },
        { name: 'Walk', duration: 1.0, fps: 30, frameCount: 30, isLooping: true, hasRootMotion: true },
        { name: 'Run', duration: 0.8, fps: 30, frameCount: 24, isLooping: true, hasRootMotion: true },
        { name: 'Attack', duration: 0.8, fps: 30, frameCount: 24, isLooping: false, hasRootMotion: false },
        { name: 'Cast', duration: 0.9, fps: 30, frameCount: 27, isLooping: false, hasRootMotion: false },
        { name: 'Hit', duration: 0.4, fps: 30, frameCount: 12, isLooping: false, hasRootMotion: false },
        { name: 'Death', duration: 1.5, fps: 30, frameCount: 45, isLooping: false, hasRootMotion: false },
      ],
    },
  };
}

/**
 * Default weapon configuration by hero ID
 */
export function getDefaultWeaponConfigsForHero(characterId: string): WeaponAssetConfig[] {
  switch (characterId) {
    case 'c_solana':
      return [
        {
          weaponId: 'w_solana_sunblade',
          name: 'Sunblade',
          weaponType: 'sword',
          primarySocket: 'right_hand_socket',
          gripTransform: { position: [0, 0, 0], rotation: [0, 0, 0], scale: [1, 1, 1] },
          tipOffset: [0, 42, 5],
          attackAnimationStyle: 'slash',
        },
      ];
    case 'c_astra':
      return [
        {
          weaponId: 'w_astra_crystal_bow',
          name: 'Crystal Longbow',
          weaponType: 'bow',
          primarySocket: 'left_hand_socket',
          secondarySocket: 'right_hand_socket',
          isTwoHanded: true,
          supportHandSocket: 'right_hand_socket',
          gripTransform: { position: [0, 0, 0], rotation: [0, 0, 0], scale: [1, 1, 1] },
          tipOffset: [10, 0, 0],
          attackAnimationStyle: 'bow_draw',
        },
      ];
    case 'c_buck':
      return [
        {
          weaponId: 'w_buck_shotgun',
          name: 'Double-Barrel Shotgun',
          weaponType: 'gun',
          primarySocket: 'right_hand_socket',
          isTwoHanded: true,
          supportHandSocket: 'left_hand_socket',
          gripTransform: { position: [0, 0, 0], rotation: [0, 0, 0], scale: [1, 1, 1] },
          tipOffset: [0, 2, 35],
          muzzleOffset: [0, 2, 35],
          attackAnimationStyle: 'shoot',
        },
      ];
    case 'c_zal':
      return [
        {
          weaponId: 'w_zal_bone_staff',
          name: 'Sanctuary Staff',
          weaponType: 'staff',
          primarySocket: 'right_hand_socket',
          gripTransform: { position: [0, 0, 0], rotation: [0, 0, 0], scale: [1, 1, 1] },
          tipOffset: [0, 50, 5],
          attackAnimationStyle: 'cast',
        },
      ];
    case 'c_valkira':
      return [
        {
          weaponId: 'w_valkira_cleavers',
          name: 'Paired Execution Blades',
          weaponType: 'dual_daggers',
          primarySocket: 'right_hand_socket',
          secondarySocket: 'left_hand_socket',
          gripTransform: { position: [0, 0, 0], rotation: [0, 0, 0], scale: [1, 1, 1] },
          tipOffset: [0, 35, 5],
          attackAnimationStyle: 'slash',
        },
      ];
    default:
      return [
        {
          weaponId: `w_${characterId}_primary`,
          name: 'Primary Armament',
          weaponType: 'sword',
          primarySocket: 'right_hand_socket',
          gripTransform: { position: [0, 0, 0], rotation: [0, 0, 0], scale: [1, 1, 1] },
          tipOffset: [0, 40, 5],
          attackAnimationStyle: 'slash',
        },
      ];
  }
}

