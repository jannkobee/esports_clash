import type { Mesh, TransformNode } from '@babylonjs/core';

export type OperativeForce = 'ct' | 't';
export type CtHeadgearKind = 'fast-nvg' | 'mich-visor' | 'gign-shield' | 'recon-boonie' | 'swat-cap';
export type THeadgearKind = 'phoenix-hood' | 'elite-shemagh' | 'balkan-flatcap' | 'syndicate-suit' | 'anarchist-hoodie';
export type OperativeHeadgearKind = CtHeadgearKind | THeadgearKind;

export interface OperativeFaceTraits {
  code: string;
  skin: string;
  hairOrFacial: string;
  jawWidth: number;
  jawHeight: number;
  noseWidth: number;
  noseLength: number;
  browWidth: number;
  browTilt: number;
  eyeSpacing: number;
  headScaleX: number;
  headScaleY: number;
  facialHair: 'clean' | 'stubble' | 'goatee' | 'beard' | 'heavy';
}

export const OPERATIVE_FACE_TRAITS: readonly OperativeFaceTraits[] = [
  { code: 'square-jaw', skin: '#c99772', hairOrFacial: '#2a1d17', jawWidth: 1.06, jawHeight: 1.04, noseWidth: 1.02, noseLength: 1.00, browWidth: 1.04, browTilt: -.08, eyeSpacing: 1.00, headScaleX: 1.02, headScaleY: 1.00, facialHair: 'stubble' },
  { code: 'lean-hawk', skin: '#d8ab87', hairOrFacial: '#3e2c21', jawWidth: .91, jawHeight: 1.08, noseWidth: .84, noseLength: 1.14, browWidth: .96, browTilt: -.12, eyeSpacing: .93, headScaleX: .95, headScaleY: 1.04, facialHair: 'clean' },
  { code: 'broad-heavy', skin: '#b37d58', hairOrFacial: '#1c1816', jawWidth: 1.14, jawHeight: .96, noseWidth: 1.18, noseLength: .94, browWidth: 1.14, browTilt: -.05, eyeSpacing: 1.08, headScaleX: 1.06, headScaleY: .97, facialHair: 'heavy' },
  { code: 'sharp-fox', skin: '#e0ba99', hairOrFacial: '#4f3827', jawWidth: .94, jawHeight: 1.02, noseWidth: .90, noseLength: 1.08, browWidth: .94, browTilt: -.15, eyeSpacing: 1.04, headScaleX: .97, headScaleY: 1.02, facialHair: 'goatee' },
  { code: 'rugged-vet', skin: '#9d6a49', hairOrFacial: '#342c28', jawWidth: 1.03, jawHeight: .98, noseWidth: 1.10, noseLength: 1.02, browWidth: 1.08, browTilt: -.10, eyeSpacing: .97, headScaleX: 1.00, headScaleY: .99, facialHair: 'beard' },
];

export interface OperativeStyleProfile {
  force: OperativeForce;
  code: string;
  fabric: string;
  trousers: string;
  rig: string;
  pouch: string;
  hardware: string;
  trim: string;
  boot: string;
  glove: string;
  knuckle: string;
  skin: string;
  headColor: string;
  eyePatchColor: string;
  accent: string;
  secondaryAccent: string;
  lens: string;
  hairOrFacial?: string;
  headgear: OperativeHeadgearKind;
  sleeveRolled: boolean;
  fingerless: boolean;
  face?: OperativeFaceTraits;
}

export const CT_OPERATIVE_STYLES: readonly OperativeStyleProfile[] = [
  {
    force: 'ct',
    code: 'sas-fast',
    fabric: '#23374b',
    trousers: '#1f2c3a',
    rig: '#4f5a3e',
    pouch: '#5c6648',
    hardware: '#64748b',
    trim: '#11171f',
    boot: '#151920',
    glove: '#161c24',
    knuckle: '#3b4a5e',
    skin: '#c99772',
    headColor: '#1b242e',
    eyePatchColor: '#181e24',
    accent: '#cbd5e1',
    secondaryAccent: '#dc2626',
    lens: '#1b232c',
    headgear: 'fast-nvg',
    sleeveRolled: false,
    fingerless: false,
  },
  {
    force: 'ct',
    code: 'gsg-olive',
    fabric: '#2c3e35',
    trousers: '#252d28',
    rig: '#1e2420',
    pouch: '#5a5644',
    hardware: '#71717a',
    trim: '#161b18',
    boot: '#26211c',
    glove: '#232824',
    knuckle: '#3f4940',
    skin: '#d4a37d',
    headColor: '#36453b',
    eyePatchColor: '#2b3830',
    accent: '#f59e0b',
    secondaryAccent: '#ea580c',
    lens: '#475569',
    hairOrFacial: '#3f2e24',
    headgear: 'mich-visor',
    sleeveRolled: true,
    fingerless: false,
  },
  {
    force: 'ct',
    code: 'gign-heavy',
    fabric: '#2d3948',
    trousers: '#202833',
    rig: '#171e28',
    pouch: '#414b59',
    hardware: '#94a3b8',
    trim: '#0f141c',
    boot: '#131820',
    glove: '#151b24',
    knuckle: '#475569',
    skin: '#bc8863',
    headColor: '#334155',
    eyePatchColor: '#1c2430',
    accent: '#60a5fa',
    secondaryAccent: '#38bdf8',
    lens: '#7dd3fc',
    headgear: 'gign-shield',
    sleeveRolled: false,
    fingerless: false,
  },
  {
    force: 'ct',
    code: 'recon-boonie',
    fabric: '#354956',
    trousers: '#28333c',
    rig: '#293038',
    pouch: '#585b4c',
    hardware: '#7c8691',
    trim: '#1a2026',
    boot: '#2f2922',
    glove: '#2c352f',
    knuckle: '#4a554c',
    skin: '#c48f6a',
    headColor: '#3e5143',
    eyePatchColor: '#202528',
    accent: '#4d6150',
    secondaryAccent: '#e2e8f0',
    lens: '#38bdf8',
    hairOrFacial: '#2f221b',
    headgear: 'recon-boonie',
    sleeveRolled: true,
    fingerless: true,
  },
  {
    force: 'ct',
    code: 'swat-cap',
    fabric: '#1f252e',
    trousers: '#191e26',
    rig: '#2e3746',
    pouch: '#3f4754',
    hardware: '#94a3b8',
    trim: '#10141a',
    boot: '#14171d',
    glove: '#181e27',
    knuckle: '#475569',
    skin: '#a57250',
    headColor: '#1e293b',
    eyePatchColor: '#151921',
    accent: '#2563eb',
    secondaryAccent: '#e2e8f0',
    lens: '#eab308',
    headgear: 'swat-cap',
    sleeveRolled: false,
    fingerless: false,
  },
];

export const T_OPERATIVE_STYLES: readonly OperativeStyleProfile[] = [
  {
    force: 't',
    code: 'phoenix-hood',
    fabric: '#452629',
    trousers: '#3b4034',
    rig: '#5b4d3c',
    pouch: '#4e4233',
    hardware: '#8a7e6e',
    trim: '#1b1d20',
    boot: '#8c7451',
    glove: '#3f2e22',
    knuckle: '#5c4636',
    skin: '#c99772',
    headColor: '#24272b',
    eyePatchColor: '#1e2124',
    accent: '#dc2626',
    secondaryAccent: '#d2cfc6',
    lens: '#14181e',
    hairOrFacial: '#2a1d17',
    headgear: 'phoenix-hood',
    sleeveRolled: true,
    fingerless: false,
  },
  {
    force: 't',
    code: 'elite-desert',
    fabric: '#b39d7b',
    trousers: '#443e36',
    rig: '#594c38',
    pouch: '#6d5e48',
    hardware: '#9c8c74',
    trim: '#25211c',
    boot: '#9b825d',
    glove: '#4d3b2d',
    knuckle: '#b8845f',
    skin: '#b8845f',
    headColor: '#9b3333',
    eyePatchColor: '#b8845f',
    accent: '#d6d2c7',
    secondaryAccent: '#9b3333',
    lens: '#181c24',
    hairOrFacial: '#241813',
    headgear: 'elite-shemagh',
    sleeveRolled: true,
    fingerless: true,
  },
  {
    force: 't',
    code: 'balkan-coat',
    fabric: '#3b4942',
    trousers: '#232830',
    rig: '#362921',
    pouch: '#4c3e32',
    hardware: '#8b8378',
    trim: '#181b20',
    boot: '#2b241f',
    glove: '#2c221d',
    knuckle: '#cf9e79',
    skin: '#cf9e79',
    headColor: '#444841',
    eyePatchColor: '#cf9e79',
    accent: '#cbd5e1',
    secondaryAccent: '#756756',
    lens: '#334155',
    hairOrFacial: '#382a22',
    headgear: 'balkan-flatcap',
    sleeveRolled: false,
    fingerless: true,
  },
  {
    force: 't',
    code: 'syndicate-suit',
    fabric: '#232732',
    trousers: '#1c1f27',
    rig: '#3a2921',
    pouch: '#2b221e',
    hardware: '#b4bcc6',
    trim: '#12141a',
    boot: '#18181b',
    glove: '#1d1e22',
    knuckle: '#3b3e46',
    skin: '#d6a885',
    headColor: '#221b18',
    eyePatchColor: '#d6a885',
    accent: '#991b1b',
    secondaryAccent: '#d6d9de',
    lens: '#1f2937',
    hairOrFacial: '#261d19',
    headgear: 'syndicate-suit',
    sleeveRolled: false,
    fingerless: false,
  },
  {
    force: 't',
    code: 'anarchist-hoodie',
    fabric: '#5c493e',
    trousers: '#34404d',
    rig: '#4b453c',
    pouch: '#5a5042',
    hardware: '#8b857c',
    trim: '#1c1f24',
    boot: '#5a4938',
    glove: '#2d3138',
    knuckle: '#d6d3c9',
    skin: '#be8962',
    headColor: '#5c493e',
    eyePatchColor: '#22262b',
    accent: '#d6d3c9',
    secondaryAccent: '#e5e7eb',
    lens: '#d97706',
    hairOrFacial: '#2c1e16',
    headgear: 'anarchist-hoodie',
    sleeveRolled: true,
    fingerless: true,
  },
];

function hashOperativeId(id: string): number {
  let hash = 2166136261;
  for (let i = 0; i < id.length; i++) {
    hash ^= id.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

export function resolveOperativeVariantIndex(force: OperativeForce, id: string, slotHint?: number): number {
  const pool = OPERATIVE_FACE_TRAITS;
  if (typeof slotHint === 'number' && Number.isFinite(slotHint)) {
    return ((Math.trunc(slotHint) % pool.length) + pool.length) % pool.length;
  }
  return hashOperativeId(`${force}:${id}`) % pool.length;
}

/** Fontessa uses one unified CT unit outfit and one unified T unit outfit for crisp team ID, varying facial structure & skin tone per player; alternate style pools remain available via styleSlot for future maps. */
export function resolveOperativeStyle(
  force: OperativeForce,
  id: string,
  faceHint?: number,
  mapStyleSlot?: number,
): OperativeStyleProfile {
  const pool = force === 'ct' ? CT_OPERATIVE_STYLES : T_OPERATIVE_STYLES;
  const outfitIndex = typeof mapStyleSlot === 'number' && Number.isFinite(mapStyleSlot)
    ? ((Math.trunc(mapStyleSlot) % pool.length) + pool.length) % pool.length
    : 0;
  const base = pool[outfitIndex];
  const face = OPERATIVE_FACE_TRAITS[resolveOperativeVariantIndex(force, id, faceHint)];
  const balaclavaHead = base.headgear === 'fast-nvg' || base.headgear === 'gign-shield' || base.headgear === 'swat-cap';
  return {
    ...base,
    skin: face.skin,
    hairOrFacial: face.hairOrFacial,
    knuckle: base.fingerless ? face.skin : base.knuckle,
    eyePatchColor: balaclavaHead ? base.eyePatchColor : (base.headgear === 'phoenix-hood' || base.headgear === 'mich-visor' || base.headgear === 'recon-boonie' || base.headgear === 'anarchist-hoodie' ? base.eyePatchColor : face.skin),
    face,
  };
}

export type KitPartBuilder = (
  name: string,
  parent: TransformNode,
  x: number,
  y: number,
  z: number,
  w: number,
  h: number,
  d: number,
  color: string,
  shape?: 'box' | 'sphere' | 'cylinder',
  rotX?: number,
  rotY?: number,
  rotZ?: number,
  topScale?: number,
) => Mesh;

export interface KitRigNodes {
  spine: TransformNode;
  headPivot: TransformNode;
  leftArmPivot: TransformNode;
  rightArmPivot: TransformNode;
  leftElbowPivot: TransformNode;
  rightElbowPivot: TransformNode;
  leftLegPivot: TransformNode;
  rightLegPivot: TransformNode;
  leftKneePivot: TransformNode;
  rightKneePivot: TransformNode;
}

/** Populate variant-specific headgear, facial silhouette, torso armor/clothing accents, and limb fittings. */
export function buildVariantOperativeDetails(
  style: OperativeStyleProfile,
  nodes: KitRigNodes,
  part: KitPartBuilder,
): void {
  const { spine, headPivot, leftArmPivot, rightArmPivot, leftElbowPivot, rightElbowPivot } = nodes;
  const { hardware, trim, rig, pouch, accent, secondaryAccent, skin, fabric, headColor, lens, hairOrFacial } = style;
  const face = style.face ?? OPERATIVE_FACE_TRAITS[0];

  // Exposed face / balaclava jaw anchor (guarantees every headPivot has a merged kit part first)
  part('jaw-chin', headPivot, 0, -.058, .024, .138 * face.jawWidth, .095 * face.jawHeight, .142, style.eyePatchColor, 'cylinder', -.12, 0, 0, 1.18);
  part('chin-protuberance', headPivot, 0, -.086, .062, .068 * face.jawWidth, .042, .066, style.eyePatchColor, 'sphere', -.18, 0, 0);
  const fullBalaclava = style.headgear === 'fast-nvg' || style.headgear === 'gign-shield' || style.headgear === 'swat-cap';
  const mouthCovered = fullBalaclava || style.headgear === 'phoenix-hood' || style.headgear === 'recon-boonie' || style.headgear === 'anarchist-hoodie';
  const eyesBehindOptics = style.headgear === 'fast-nvg' || style.headgear === 'gign-shield' || style.headgear === 'swat-cap' || style.headgear === 'phoenix-hood' || style.headgear === 'syndicate-suit';
  for (const side of [-1, 1]) {
    part(`ear-${side}`, headPivot, side * .096 * face.headScaleX, .004, -.006, .024, .052, .034, style.eyePatchColor, 'sphere', 0, side * -.18, 0);
    part(`ear-lobe-${side}`, headPivot, side * .094 * face.headScaleX, -.02, -.004, .018, .02, .022, style.eyePatchColor, 'sphere');
    part(`cheekbone-${side}`, headPivot, side * .048 * face.headScaleX, -.002, .072, .046, .034, .044, skin, 'sphere', .1, side * .3, 0);
    part(`brow-ridge-${side}`, headPivot, side * .035 * face.eyeSpacing, .04, .089, .054 * face.browWidth, .016, .026, skin, 'sphere', .15, side * .18, side * face.browTilt);
    part(`eyebrow-${side}`, headPivot, side * .035 * face.eyeSpacing, .042, .095, .046 * face.browWidth, .01, .014, hairOrFacial ?? '#3f2e24', 'box', 0, 0, side * face.browTilt);
    if (!eyesBehindOptics) {
      part(`eye-sclera-${side}`, headPivot, side * .033 * face.eyeSpacing, .021, .093, .026, .012, .01, '#cbd5e1', 'sphere');
    }
    part(`eye-iris-${side}`, headPivot, side * .033 * face.eyeSpacing, .021, .098, .014, .011, .008, '#1e1b18', 'sphere');
    part(`eyelid-upper-${side}`, headPivot, side * .033 * face.eyeSpacing, .027, .096, .028, .007, .014, skin, 'box', -.18, 0, side * -.06);
  }
  part('nose-bridge', headPivot, 0, .012, .101, .024 * face.noseWidth, .044 * face.noseLength, .028, skin, 'cylinder', -.22, 0, 0, .72);
  part('nose-tip', headPivot, 0, -.005, .112, .024 * face.noseWidth, .018, .024, skin, 'sphere');
  for (const side of [-1, 1]) {
    part(`nostril-wing-${side}`, headPivot, side * .011 * face.noseWidth, -.009, .105, .012, .012, .015, skin, 'sphere');
  }
  if (!mouthCovered) {
    part('mouth-upper-lip', headPivot, 0, -.032, .094, .046 * face.jawWidth, .01, .016, skin, 'cylinder', .15, 0, 0, .85);
    part('mouth-lower-lip', headPivot, 0, -.042, .092, .04 * face.jawWidth, .011, .016, skin, 'cylinder', -.1, 0, 0, .9);
  }

  if (style.headgear === 'fast-nvg') {
    // Iconic SAS S10/FM12 rubber respirator gas mask & hood with convex dual ocular lenses, central snout & NBC canister
    part('hood-wrap', headPivot, 0, -.018, -.008, .196, .194, .202, style.eyePatchColor, 'sphere');
    part('respirator-hood-crown', headPivot, 0, .062, -.008, .204, .148, .218, headColor, 'sphere');
    for (const side of [-1, 1]) {
      part(`respirator-harness-${side}`, headPivot, side * .062, .052, .012, .016, .145, .175, trim, 'box', -.14, 0, side * -.12);
      part(`goggles-frame-${side}`, headPivot, side * .038, .024, .094, .056, .054, .028, trim, 'cylinder', Math.PI / 2, side * -.14, 0, .92);
      part(`goggles-lens-${side}`, headPivot, side * .038, .024, .105, .044, .042, .016, lens, 'sphere', 0, side * -.14, 0);
    }
    part('respirator-brow-seal', headPivot, 0, .052, .084, .132, .026, .048, trim, 'cylinder', -.12, 0, 0, .92);
    part('respirator-nose-bridge', headPivot, 0, .008, .106, .054, .052, .054, trim, 'sphere');
    part('respirator-snout', headPivot, 0, -.026, .118, .064, .058, .058, trim, 'cylinder', Math.PI / 2 + .22, 0, 0, .86);
    part('respirator-emitter-grille', headPivot, 0, -.032, .142, .044, .044, .016, hardware, 'cylinder', Math.PI / 2 + .22, 0, 0, .9);
    part('respirator-filter-canister', headPivot, -.064, -.044, .086, .068, .068, .058, rig, 'cylinder', Math.PI / 2 + .35, -.52, 0, .96);
    part('respirator-filter-collar', headPivot, -.054, -.040, .094, .048, .048, .022, hardware, 'cylinder', Math.PI / 2 + .35, -.52, 0, .95);
    part('respirator-valve-exhaust', headPivot, 0, -.064, .112, .036, .036, .024, trim, 'cylinder', Math.PI / 2 + .35, 0, 0, .9);
  } else if (style.headgear === 'mich-visor') {
    part('gaiter-neck', headPivot, 0, -.078, .008, .168, .088, .168, style.eyePatchColor, 'cylinder', 0, 0, 0, .95);
    part('stubble-jaw', headPivot, 0, -.03, .03, .144, .055, .142, hairOrFacial ?? '#3f2e24', 'sphere');
    part('mich-shell', headPivot, 0, .07, -.01, .228, .152, .242, headColor, 'sphere');
    part('mich-rim', headPivot, 0, .025, -.016, .232, .055, .236, rig, 'cylinder');
    part('brow-visor', headPivot, 0, .054, .112, .186, .048, .058, lens, 'cylinder', -.2, 0, 0);
    part('helmet-flashlight-body', headPivot, .116, .068, .045, .026, .026, .09, hardware, 'cylinder', Math.PI / 2, 0, 0);
    part('helmet-flashlight-lens', headPivot, .116, .068, .09, .022, .022, .008, secondaryAccent, 'cylinder', Math.PI / 2, 0, 0);
    part('chest-shears-tab', spine, .098, .165, .122, .024, .055, .014, accent, 'box', 0, 0, -.18);
  } else if (style.headgear === 'gign-shield') {
    part('gign-hood', headPivot, 0, -.025, -.008, .19, .178, .195, style.eyePatchColor, 'sphere');
    part('gign-dome', headPivot, 0, .075, -.008, .236, .168, .25, headColor, 'sphere');
    part('gign-brow-mount', headPivot, 0, .096, .114, .175, .028, .036, hardware, 'box');
    part('gign-face-shield', headPivot, 0, .018, .098, .198, .112, .092, lens, 'cylinder', -.06, 0, 0, .94);
    part('gign-shield-rim', headPivot, 0, -.035, .102, .192, .018, .086, trim, 'cylinder', -.06, 0, 0, .94);
    part('blast-collar-neck', spine, 0, .335, -.015, .235, .085, .215, rig, 'cylinder', -.08, 0, 0, .88);
    for (const side of [-1, 1]) {
      const armP = side < 0 ? leftArmPivot : rightArmPivot;
      part(`pauldron-plate-${side}`, armP, side * .025, -.045, 0, .135, .145, .142, rig, 'cylinder', 0, 0, side * .08, .92);
      part(`pauldron-trim-${side}`, armP, side * .028, -.005, 0, .138, .026, .144, accent, 'cylinder', 0, 0, side * .08);
    }
  } else if (style.headgear === 'recon-boonie') {
    part('mesh-mask-lower', headPivot, 0, -.045, .022, .176, .095, .17, style.eyePatchColor, 'sphere');
    part('boonie-crown', headPivot, 0, .082, -.008, .206, .112, .215, headColor, 'cylinder', -.05, 0, 0, .92);
    part('boonie-brim', headPivot, 0, .048, .002, .325, .018, .335, headColor, 'cylinder', -.08, 0, 0, .98);
    part('boonie-scrim-band', headPivot, 0, .068, -.006, .212, .028, .22, pouch, 'cylinder', -.05, 0, 0);
    part('recon-monocular', headPivot, .036, .026, .108, .034, .034, .048, lens, 'cylinder', Math.PI / 2, 0, 0);
    part('recon-comms-ear', headPivot, -.106, .01, 0, .028, .062, .052, trim, 'sphere');
    part('shoulder-scrim-cape', spine, 0, .275, -.05, .36, .07, .23, accent, 'cylinder', .12, 0, 0, .78);
  } else if (style.headgear === 'swat-cap') {
    part('swat-balaclava', headPivot, 0, -.026, -.008, .188, .175, .192, style.eyePatchColor, 'sphere');
    part('swat-cap-dome', headPivot, 0, .072, -.01, .206, .122, .216, headColor, 'sphere');
    part('swat-cap-brim', headPivot, 0, .044, .096, .152, .016, .112, headColor, 'box', .12, 0, 0);
    part('swat-cap-patch', headPivot, 0, .086, .096, .058, .032, .012, accent, 'box', -.24, 0, 0);
    part('swat-glasses', headPivot, 0, .024, .102, .154, .028, .034, lens, 'cylinder');
    part('swat-glasses-frame', headPivot, 0, .028, .086, .174, .016, .056, trim, 'box');
  } else if (style.headgear === 'phoenix-hood') {
    part('face-mask-lower', headPivot, 0, -.042, .028, .172 * face.jawWidth, .105, .168, style.eyePatchColor, 'sphere');
    if (face.facialHair !== 'clean') {
      const beardScale = face.facialHair === 'heavy' ? 1.14 : face.facialHair === 'goatee' ? .76 : .96;
      part('t-beard-jaw', headPivot, 0, -.068, .038, .134 * face.jawWidth * beardScale, .078, .125, hairOrFacial ?? '#2a1d17', 'sphere');
      if (face.facialHair !== 'stubble') {
        part('t-mustache', headPivot, 0, -.016, .098, .064 * face.noseWidth, .018, .024, hairOrFacial ?? '#2a1d17', 'box');
      }
    }
    part('scarf-neck-wrap', headPivot, 0, -.076, -.002, .176, .068, .174, accent, 'cylinder', 0, 0, 0, .92);
    part('scarf-pattern-trim', headPivot, 0, -.074, .004, .180, .020, .178, secondaryAccent, 'cylinder');
    part('knit-beanie-crown', headPivot, 0, .076, -.01, .206, .125, .218, headColor, 'sphere');
    part('knit-beanie-cuff', headPivot, 0, .048, -.008, .212, .038, .224, trim, 'cylinder');
    part('shades-lens', headPivot, 0, .024, .098, .148, .032, .032, lens, 'cylinder');
    part('shades-bridge', headPivot, 0, .028, .082, .176, .016, .065, trim, 'box');
    part('chest-sling-strap', spine, .02, .08, 0, .065, .42, .215, rig, 'box', 0, 0, .32);
    for (let i = 0; i < 3; i++) {
      part(`bandolier-pouch-${i}`, spine, -.03 + i * .055, .02 + i * .065, .114, .044, .078, .032, pouch, 'box', 0, 0, .32);
    }
    part('t-armband', leftArmPivot, -.008, -.12, 0, .122, .058, .122, accent, 'cylinder');
  } else if (style.headgear === 'elite-shemagh') {
    part('shemagh-drape-crown', headPivot, 0, .056, -.018, .224, .165, .238, headColor, 'sphere');
    part('shemagh-headband', headPivot, 0, .058, -.006, .226, .032, .232, accent, 'cylinder', -.08, 0, 0);
    part('shemagh-neck-coil', headPivot, 0, -.078, 0, .182, .074, .182, accent, 'cylinder', 0, 0, 0, .92);
    part('shemagh-tail-chest', spine, .04, .22, .106, .175, .095, .038, headColor, 'box', .14, 0, -.12);
    part('elite-full-beard', headPivot, 0, -.058, .034, .146, .092, .142, hairOrFacial ?? '#241813', 'sphere');
    part('elite-mustache', headPivot, 0, -.016, .1, .068, .018, .024, hairOrFacial ?? '#241813', 'box');
    part('aviator-lens', headPivot, 0, .022, .102, .144, .032, .028, lens, 'cylinder');
    part('aviator-rim', headPivot, 0, .026, .098, .156, .012, .03, hardware, 'box');
  } else if (style.headgear === 'balkan-flatcap') {
    part('balkan-hair-back', headPivot, 0, .022, -.024, .186, .112, .182, hairOrFacial ?? '#382a22', 'sphere');
    part('balkan-flatcap-crown', headPivot, 0, .074, -.012, .21, .096, .228, headColor, 'cylinder', -.08, 0, 0, 1.06);
    part('balkan-flatcap-visor', headPivot, 0, .042, .092, .148, .016, .095, headColor, 'box', .18, 0, 0);
    part('balkan-goatee', headPivot, 0, -.066, .045, .072, .054, .082, hairOrFacial ?? '#382a22', 'sphere');
    part('balkan-mustache', headPivot, 0, -.016, .099, .066, .016, .022, hairOrFacial ?? '#382a22', 'box');
    part('fur-collar', spine, 0, .312, -.005, .248, .085, .216, secondaryAccent, 'cylinder', .08, 0, 0, .9);
    for (const [side, armP] of [[-1, leftArmPivot], [1, rightArmPivot]] as const) {
      part(`track-stripe-${side}`, armP, side * .055, -.13, 0, .02, .24, .035, accent, 'box');
    }
  } else if (style.headgear === 'syndicate-suit') {
    part('suit-hair-top', headPivot, 0, .082, -.015, .184, .088, .206, headColor, 'sphere', -.12, 0, 0);
    part('suit-hair-crest', headPivot, 0, .102, .048, .115, .044, .112, headColor, 'sphere', -.18, 0, 0);
    part('suit-shades-lens', headPivot, 0, .024, .102, .148, .026, .028, lens, 'cylinder');
    part('suit-shades-chrome', headPivot, 0, .028, .09, .172, .012, .058, hardware, 'box');
    part('suit-shirt-v', spine, 0, .215, .106, .102, .175, .026, secondaryAccent, 'box');
    part('suit-necktie', spine, 0, .185, .122, .034, .19, .014, accent, 'box');
    part('suit-lapel-l', spine, -.058, .21, .114, .038, .18, .02, trim, 'box', 0, 0, -.16);
    part('suit-lapel-r', spine, .058, .21, .114, .038, .18, .02, trim, 'box', 0, 0, .16);
  } else {
    // anarchist-hoodie
    part('bandana-mask-lower', headPivot, 0, -.045, .028, .172, .092, .168, accent, 'sphere');
    part('hoodie-shroud-back', headPivot, 0, .042, -.028, .232, .218, .238, headColor, 'sphere');
    part('hoodie-inner-rim', headPivot, 0, .045, .02, .218, .195, .198, trim, 'cylinder', -.08, 0, 0, .94);
    part('forehead-goggles', headPivot, 0, .068, .092, .158, .036, .044, lens, 'cylinder', -.22, 0, 0);
    part('forehead-strap', headPivot, 0, .064, -.01, .218, .024, .216, trim, 'cylinder');
    part('anarchist-drawstring-l', spine, -.058, .215, .124, .012, .155, .012, secondaryAccent, 'cylinder', .12, 0, -.05);
    part('anarchist-drawstring-r', spine, .058, .215, .124, .012, .155, .012, secondaryAccent, 'cylinder', .12, 0, .05);
    part('anarchist-rucksack', spine, 0, .08, -.148, .235, .285, .115, pouch, 'cylinder', 0, 0, 0, .86);
  }

  // CT shoulder ear-pro, helmet chin-straps & rails vs T rolled sleeve cuffs / wrist wraps
  if (style.force === 'ct') {
    part('ct-id-placard', spine, 0, .165, .118, .12, .038, .014, accent, 'box');
    part('ct-ptt-box', spine, -.088, .195, .116, .038, .052, .024, trim, 'box');
    part('ct-defuse-pouch', spine, .145, -.235, -.09, .055, .095, .052, rig, 'box');
    part('ct-cutter-handle-l', spine, .136, -.185, -.086, .012, .036, .014, lens, 'box', 0, 0, .16);
    part('ct-cutter-handle-r', spine, .154, -.185, -.086, .012, .036, .014, lens, 'box', 0, 0, -.16);
    if (style.headgear === 'fast-nvg' || style.headgear === 'mich-visor' || style.headgear === 'gign-shield') {
      part('chin-cup', headPivot, 0, -.092, .056, .072 * face.jawWidth, .024, .044, trim, 'cylinder', -.35, 0, 0, .92);
      for (const side of [-1, 1]) {
        part(`chin-strap-front-${side}`, headPivot, side * .066 * face.headScaleX, -.03, .034, .014, .118, .018, trim, 'box', -.22, 0, side * -.34);
        part(`chin-strap-rear-${side}`, headPivot, side * .078 * face.headScaleX, -.026, -.018, .014, .116, .018, trim, 'box', .18, 0, side * -.28);
      }
    }
    for (const side of [-1, 1]) {
      part(`peltor-cup-${side}`, headPivot, side * .112, .004, -.005, .034, .068, .058, trim, 'sphere');
      part(`arc-rail-${side}`, headPivot, side * .114, .055, .006, .016, .022, .105, hardware, 'box');
      part(`helmet-patch-${side}`, headPivot, side * .106, .085, -.01, .014, .042, .064, pouch, 'box');
    }
  } else {
    for (const [side, armP, elbP] of [[-1, leftArmPivot, leftElbowPivot], [1, rightArmPivot, rightElbowPivot]] as const) {
      if (style.sleeveRolled) {
        part(`rolled-sleeve-${side}`, armP, 0, -.22, 0, .128, .064, .128, fabric, 'cylinder', 0, 0, 0, .95);
        part(`wrist-wrap-${side}`, elbP, 0, -.175, 0, .09, .052, .09, secondaryAccent, 'cylinder', 0, 0, 0, .96);
      }
    }
  }

  if (style.force === 'ct' && style.sleeveRolled) {
    for (const [side, armP] of [[-1, leftArmPivot], [1, rightArmPivot]] as const) {
      part(`ct-rolled-cuff-${side}`, armP, 0, -.215, 0, .124, .056, .124, fabric, 'cylinder', 0, 0, 0, .95);
    }
  }

  // Contoured boot toe-caps & guards + sculpted fingers
  for (const [side, kneeP] of [[-1, nodes.leftKneePivot], [1, nodes.rightKneePivot]] as const) {
    // Chunky lace-up combat boot: lugged sole, raised heel, rounded toe box, padded collar above the ankle.
    part('boot-sole', kneeP, 0, -.396, .042, .118, .026, .27, trim, 'box');
    part('boot-heel', kneeP, 0, -.39, -.066, .108, .034, .08, trim, 'box');
    part('boot-toe-cap', kneeP, 0, -.364, .14, .1, .058, .08, style.boot, 'sphere');
    part('boot-ankle-cuff', kneeP, 0, -.31, -.004, .114, .066, .12, style.boot, 'cylinder', 0, 0, 0, .92);
    part(`boot-tongue-${side}`, kneeP, 0, -.345, .078, .062, .05, .048, trim, 'box', -.42, 0, 0);
    for (let lace = 0; lace < 3; lace++) part(`boot-lace-${lace}-${side}`, kneeP, 0, -.36 + lace * .022, .09 - lace * .008, .05, .008, .012, style.trim, 'box', -.42, 0, 0);
  }
  for (const [side, armP, elbP] of [[-1, leftArmPivot, leftElbowPivot], [1, rightArmPivot, rightElbowPivot]] as const) {
    // Deltoid cap follows the shoulder slope into the arm instead of sitting on it as a ball.
    part(`deltoid-seam-${side}`, armP, side * .006, -.034, 0, .132, .1, .13, fabric, 'sphere', 0, 0, side * .32);
    part(`elbow-contour-${side}`, armP, 0, -.245, -.014, .098, .07, .094, trim, 'sphere');
    part(`wrist-watch-${side}`, elbP, 0, -.19, 0, .074, .025, .074, hardware, 'cylinder');
    const fingerColor = style.fingerless ? skin : style.glove;
    // Hand: glove cuff, dorsal metacarpal arch, thenar thumb pad, knuckle guard, opposable thumb & curled fingers.
    part(`glove-cuff-${side}`, elbP, 0, -.206, .002, .068, .03, .062, style.glove, 'cylinder', 0, 0, 0, .96);
    part(`glove-metacarpal-${side}`, elbP, 0, -.245, .008, .064, .052, .022, style.glove, 'sphere');
    part(`glove-thenar-${side}`, elbP, side * -.02, -.242, -.008, .028, .044, .026, style.glove, 'sphere', 0, 0, side * -.2);
    part(`glove-knuckles-${side}`, elbP, 0, -.274, .014, .062, .016, .02, style.knuckle, 'box');
    part(`glove-thumb-${side}`, elbP, side * -.03, -.262, .004, .02, .046, .02, fingerColor, 'cylinder', .45, 0, -side * .55, .82);
    for (let finger = 0; finger < 4; finger++) {
      const x = -.023 + finger * .0155, reach = finger === 3 ? .82 : finger === 0 ? .94 : 1;
      part(`glove-finger-${finger}-base-${side}`, elbP, x, -.292, .008, .0165, .036 * reach, .0165, fingerColor, 'cylinder', .38, 0, 0, .94);
      part(`glove-finger-${finger}-tip-${side}`, elbP, x, -.316, -.01, .015, .03 * reach, .015, fingerColor, 'cylinder', 1.15, 0, 0, .86);
    }
  }
}
