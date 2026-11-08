import React from 'react';

export type MacroRegion = 'ASIA' | 'EUROPE' | 'AFRICA' | 'AMERICAS';

interface Props {
  avatarType: string;
  size?: number;
  className?: string;
}

function hashSeed(str: string): number {
  let h = 2166136261;
  const s = (str || 'pro').toLowerCase();
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return Math.abs(h);
}

export function getPlayerMacroRegion(seedStr: string): MacroRegion {
  const h = hashSeed(seedStr);
  const regions: MacroRegion[] = ['ASIA', 'EUROPE', 'AFRICA', 'AMERICAS'];
  return regions[h % regions.length];
}

const SKIN_PALETTES = [
  { base: '#f4c7a5', shade: '#d9a17c' },
  { base: '#e5b085', shade: '#c4885c' },
  { base: '#c68652', shade: '#9e6233' },
  { base: '#8d5524', shade: '#693b14' },
  { base: '#f7d6bf', shade: '#dfb093' },
  { base: '#b07448', shade: '#87522b' }
];

const HAIR_COLORS = [
  '#1c1c1c', // Jet Black
  '#4a2e1b', // Dark Brown
  '#8c4a27', // Chestnut / Auburn
  '#d96b27', // Ginger / Orange (like Ditmar Grond)
  '#d4af37', // Blonde
  '#5c6470', // Silver / Grey
  '#2c221e'  // Espresso
];

const JERSEY_STRIPES = [
  { primary: '#ffffff', stripe: '#1e293b', collar: '#16a34a' },
  { primary: '#f8fafc', stripe: '#dc2626', collar: '#1e293b' },
  { primary: '#ffffff', stripe: '#0284c7', collar: '#0f172a' },
  { primary: '#fef08a', stripe: '#15803d', collar: '#14532d' },
  { primary: '#ffffff', stripe: '#7c3aed', collar: '#1e1b4b' },
  { primary: '#e2e8f0', stripe: '#0f172a', collar: '#ca8a04' }
];

/**
 * Authentic Hattrick-Style Caricature Portrait Generator
 * Features the classic sky-blue sunburst background, bold black comic ink outlines,
 * distinctive caricature face shapes (long, round, angular), prominent noses,
 * quirky eyes/eyebrows, facial hair/stubble, and striped club jerseys.
 */
export const ChibiAvatar: React.FC<Props> = ({ avatarType, size = 84, className = '' }) => {
  const h = hashSeed(avatarType || 'hattrick_player');

  const skin = SKIN_PALETTES[h % SKIN_PALETTES.length];
  const hairColor = HAIR_COLORS[(h >> 3) % HAIR_COLORS.length];
  const jersey = JERSEY_STRIPES[(h >> 6) % JERSEY_STRIPES.length];

  const faceShape = (h >> 8) % 3; // 0: round/broad, 1: long/slim (Ditmar style), 2: oval/angular
  const noseStyle = (h >> 10) % 4; // 0: long bulbous, 1: wide flat, 2: hooked, 3: button
  const hairStyle = (h >> 12) % 6; // 0: full crop, 1: small ginger/tuft patch, 2: messy side-part, 3: curly top, 4: buzzcut, 5: spiky
  const mouthStyle = (h >> 15) % 4; // 0: toothy grin, 1: neutral cleft, 2: open surprised, 3: smirk
  const eyeStyle = (h >> 17) % 3; // 0: wide cartoon circles, 1: half-lidded relaxed, 2: intense focused
  const hasStubble = (h >> 19) % 3 === 0;
  const hasGlasses = (h >> 21) % 7 === 0;

  const uid = `ht_${h % 99999}`;
  const heightPx = Math.round(size * 1.12);

  return (
    <svg
      width={size}
      height={heightPx}
      viewBox="0 0 100 112"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={`shrink-0 select-none overflow-hidden rounded-[4px] border border-[#94a3b8] shadow-sm ${className}`}
      aria-label={`${avatarType} portrait`}
    >
      <defs>
        <radialGradient id={`sky_${uid}`} cx="50%" cy="45%" r="65%">
          <stop offset="0%" stopColor="#dff4ff" />
          <stop offset="55%" stopColor="#8cd3ff" />
          <stop offset="100%" stopColor="#56b4f5" />
        </radialGradient>
      </defs>

      {/* Sky-Blue Hattrick Sunburst Background */}
      <rect width="100" height="112" fill={`url(#sky_${uid})`} />
      <g opacity="0.28" fill="#ffffff">
        <polygon points="50,52 -10,-10 15,-10" />
        <polygon points="50,52 35,-10 60,-10" />
        <polygon points="50,52 80,-10 110,-10" />
        <polygon points="50,52 110,20 110,45" />
        <polygon points="50,52 110,65 110,95" />
        <polygon points="50,52 -10,20 -10,45" />
        <polygon points="50,52 -10,65 -10,95" />
      </g>

      {/* Shoulders & Striped Hattrick Club Jersey */}
      <g>
        <path
          d="M12 112 C14 84, 30 78, 50 78 C70 78, 86 84, 88 112 Z"
          fill={jersey.primary}
          stroke="#141414"
          strokeWidth="2.5"
        />
        {/* Vertical Jersey Stripes */}
        <path d="M28 83 L24 112 L34 112 L36 80 Z" fill={jersey.stripe} />
        <path d="M46 78 L45 112 L55 112 L54 78 Z" fill={jersey.stripe} />
        <path d="M64 80 L66 112 L76 112 L72 83 Z" fill={jersey.stripe} />
        {/* Jersey Collar & Neckline */}
        <path
          d="M36 78 C40 88, 60 88, 64 78"
          fill="none"
          stroke="#141414"
          strokeWidth="2.5"
        />
      </g>

      {/* Neck */}
      <path
        d="M41 64 L40 82 C45 86, 55 86, 60 82 L59 64 Z"
        fill={skin.shade}
        stroke="#141414"
        strokeWidth="2.4"
      />

      {/* Ears (Big Caricature Ears) */}
      {faceShape === 1 ? (
        <>
          <path
            d="M27 42 C16 38, 16 56, 28 55"
            fill={skin.base}
            stroke="#141414"
            strokeWidth="2.4"
          />
          <path
            d="M73 42 C84 38, 84 56, 72 55"
            fill={skin.base}
            stroke="#141414"
            strokeWidth="2.4"
          />
          <path d="M22 46 C24 45, 25 50, 23 51" stroke="#141414" strokeWidth="1.6" strokeLinecap="round" />
          <path d="M78 46 C76 45, 75 50, 77 51" stroke="#141414" strokeWidth="1.6" strokeLinecap="round" />
        </>
      ) : (
        <>
          <path
            d="M22 43 C12 40, 13 58, 24 56"
            fill={skin.base}
            stroke="#141414"
            strokeWidth="2.4"
          />
          <path
            d="M78 43 C88 40, 87 58, 76 56"
            fill={skin.base}
            stroke="#141414"
            strokeWidth="2.4"
          />
          <path d="M18 47 C20 46, 21 51, 19 52" stroke="#141414" strokeWidth="1.6" strokeLinecap="round" />
          <path d="M82 47 C80 46, 79 51, 81 52" stroke="#141414" strokeWidth="1.6" strokeLinecap="round" />
        </>
      )}

      {/* Caricature Head Shape */}
      {faceShape === 0 && (
        /* Broad / Round Face (Kumar style) */
        <path
          d="M22 38 C22 18, 78 18, 78 38 C80 58, 68 74, 50 74 C32 74, 20 58, 22 38 Z"
          fill={skin.base}
          stroke="#141414"
          strokeWidth="2.5"
        />
      )}
      {faceShape === 1 && (
        /* Long / Narrow Caricature Face (Ditmar style) */
        <path
          d="M29 30 C29 14, 71 14, 71 30 C73 54, 66 77, 50 77 C34 77, 27 54, 29 30 Z"
          fill={skin.base}
          stroke="#141414"
          strokeWidth="2.5"
        />
      )}
      {faceShape === 2 && (
        /* Angular / Oval Face (Luis style) */
        <path
          d="M24 34 C24 16, 76 16, 76 34 C76 54, 65 73, 50 75 C35 73, 24 54, 24 34 Z"
          fill={skin.base}
          stroke="#141414"
          strokeWidth="2.5"
        />
      )}

      {/* Optional 5-o'clock Stubble Shadow */}
      {hasStubble && (
        <path
          d="M30 56 C32 70, 68 70, 70 56 C66 72, 34 72, 30 56 Z"
          fill="#1f2937"
          opacity="0.22"
        />
      )}

      {/* Cartoon Eyes */}
      {eyeStyle === 0 && (
        <g>
          <ellipse cx="41" cy="41" rx="5.5" ry="6" fill="#ffffff" stroke="#141414" strokeWidth="2" />
          <ellipse cx="59" cy="41" rx="5.5" ry="6" fill="#ffffff" stroke="#141414" strokeWidth="2" />
          <circle cx="42" cy="41" r="2.2" fill="#141414" />
          <circle cx="58" cy="41" r="2.2" fill="#141414" />
        </g>
      )}
      {eyeStyle === 1 && (
        <g>
          <ellipse cx="41" cy="41" rx="5.5" ry="4.8" fill="#ffffff" stroke="#141414" strokeWidth="2" />
          <ellipse cx="59" cy="41" rx="5.5" ry="4.8" fill="#ffffff" stroke="#141414" strokeWidth="2" />
          <circle cx="41" cy="41.5" r="2.1" fill="#141414" />
          <circle cx="59" cy="41.5" r="2.1" fill="#141414" />
          <line x1="35" y1="39" x2="47" y2="39" stroke="#141414" strokeWidth="2" />
          <line x1="53" y1="39" x2="65" y2="39" stroke="#141414" strokeWidth="2" />
        </g>
      )}
      {eyeStyle === 2 && (
        <g>
          <circle cx="42" cy="41" r="4.5" fill="#ffffff" stroke="#141414" strokeWidth="2" />
          <circle cx="58" cy="41" r="4.5" fill="#ffffff" stroke="#141414" strokeWidth="2" />
          <circle cx="42.5" cy="41" r="2" fill="#141414" />
          <circle cx="57.5" cy="41" r="2" fill="#141414" />
        </g>
      )}

      {/* Thick Expressive Eyebrows */}
      <path d="M34 33 Q41 29 47 34" stroke="#141414" strokeWidth="2.8" strokeLinecap="round" fill="none" />
      <path d="M53 34 Q59 29 66 33" stroke="#141414" strokeWidth="2.8" strokeLinecap="round" fill="none" />

      {/* Prominent Hattrick Caricature Nose */}
      {noseStyle === 0 && (
        /* Long Bulbous Caricature Nose (Ditmar style) */
        <path
          d="M48 39 L44 54 C44 59, 56 59, 56 54 L52 39"
          fill={skin.shade}
          stroke="#141414"
          strokeWidth="2.2"
          strokeLinecap="round"
        />
      )}
      {noseStyle === 1 && (
        /* Wide Nostril Nose (Kumar style) */
        <path
          d="M47 40 L45 50 C41 51, 42 56, 46 55 C48 56, 52 56, 54 55 C58 56, 59 51, 55 50 L53 40"
          fill={skin.shade}
          stroke="#141414"
          strokeWidth="2.1"
          strokeLinecap="round"
        />
      )}
      {noseStyle === 2 && (
        /* Angular Hooked Nose */
        <path
          d="M49 39 L45 52 L53 54"
          fill={skin.shade}
          stroke="#141414"
          strokeWidth="2.2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      )}
      {noseStyle === 3 && (
        /* Rounded Button Nose (Luis style) */
        <path
          d="M47 45 C44 51, 56 51, 53 45"
          fill={skin.shade}
          stroke="#141414"
          strokeWidth="2.2"
          strokeLinecap="round"
        />
      )}

      {/* Mouth & Chin Details */}
      {mouthStyle === 0 && (
        /* Toothy Box Grin (Luis style) */
        <g>
          <rect x="42" y="60" width="16" height="6" rx="2" fill="#ffffff" stroke="#141414" strokeWidth="2" />
          <line x1="42" y1="63" x2="58" y2="63" stroke="#141414" strokeWidth="1.5" />
          <line x1="47" y1="60" x2="47" y2="66" stroke="#141414" strokeWidth="1.4" />
          <line x1="53" y1="60" x2="53" y2="66" stroke="#141414" strokeWidth="1.4" />
        </g>
      )}
      {mouthStyle === 1 && (
        /* Serious / Slight Smile with Chin Dimple (Kumar / Ditmar style) */
        <g>
          <path d="M42 62 Q50 66 58 62" stroke="#141414" strokeWidth="2.3" strokeLinecap="round" fill="none" />
          <path d="M48 69 Q50 72 52 69" stroke="#141414" strokeWidth="1.8" strokeLinecap="round" fill="none" />
        </g>
      )}
      {mouthStyle === 2 && (
        /* Confident Smirk */
        <path d="M41 63 Q51 65 59 59" stroke="#141414" strokeWidth="2.4" strokeLinecap="round" fill="none" />
      )}
      {mouthStyle === 3 && (
        /* Open Smile */
        <path
          d="M41 60 Q50 69 59 60 Z"
          fill="#ffffff"
          stroke="#141414"
          strokeWidth="2.1"
          strokeLinejoin="round"
        />
      )}

      {/* Optional Glasses */}
      {hasGlasses && (
        <g stroke="#141414" strokeWidth="2.2" fill="none">
          <rect x="33" y="36" width="14" height="10" rx="2" />
          <rect x="53" y="36" width="14" height="10" rx="2" />
          <line x1="47" y1="41" x2="53" y2="41" />
        </g>
      )}

      {/* Hairstyles (Hattrick Caricature Styles) */}
      {hairStyle === 0 && (
        /* Full Tousled Cap Hair (Kumar style) */
        <path
          d="M21 38 C20 15, 80 15, 79 38 C74 28, 65 26, 56 28 C52 24, 42 25, 36 28 C28 26, 23 31, 21 38 Z"
          fill={hairColor}
          stroke="#141414"
          strokeWidth="2.4"
        />
      )}
      {hairStyle === 1 && (
        /* Small Top Tuft / Patch (Ditmar style) */
        <ellipse
          cx="50"
          cy="21"
          rx="9"
          ry="5.5"
          fill={hairColor}
          stroke="#141414"
          strokeWidth="2.2"
        />
      )}
      {hairStyle === 2 && (
        /* Swept Side Part (Luis style) */
        <path
          d="M23 35 C24 16, 74 15, 77 34 C68 23, 52 20, 38 30 C32 25, 26 29, 23 35 Z"
          fill={hairColor}
          stroke="#141414"
          strokeWidth="2.4"
        />
      )}
      {hairStyle === 3 && (
        /* Curly / Afro Top */
        <path
          d="M22 35 C18 22, 28 13, 39 16 C46 10, 56 10, 62 16 C73 13, 82 22, 78 35 C70 25, 30 25, 22 35 Z"
          fill={hairColor}
          stroke="#141414"
          strokeWidth="2.4"
        />
      )}
      {hairStyle === 4 && (
        /* Close Buzzcut Hairline */
        <path
          d="M25 32 C28 17, 72 17, 75 32 C66 24, 34 24, 25 32 Z"
          fill={hairColor}
          stroke="#141414"
          strokeWidth="2.2"
        />
      )}
      {hairStyle === 5 && (
        /* Spiky Crest */
        <path
          d="M24 34 L28 19 L37 24 L45 13 L53 23 L62 14 L68 24 L76 20 L76 34 C64 25, 36 25, 24 34 Z"
          fill={hairColor}
          stroke="#141414"
          strokeWidth="2.3"
          strokeLinejoin="round"
        />
      )}
    </svg>
  );
};
