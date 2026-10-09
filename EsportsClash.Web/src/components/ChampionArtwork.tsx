import React from 'react';

interface ChampionArtworkProps {
  championId: string;
  size?: number;
  className?: string;
}

export const ChampionArtwork: React.FC<ChampionArtworkProps> = ({ championId, size = 180, className = '' }) => {
  switch (championId) {
    // 1. SOLANA (Basis: Leona - The Sun Vanguard)
    case 'c_solana':
      return (
        <svg width={size} height={size} viewBox="0 0 200 200" className={className}>
          <defs>
            <radialGradient id="solarGlow" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="#fef08a" stopOpacity="0.8" />
              <stop offset="70%" stopColor="#f59e0b" stopOpacity="0.3" />
              <stop offset="100%" stopColor="#b45309" stopOpacity="0" />
            </radialGradient>
          </defs>
          {/* Background Aura */}
          <circle cx="100" cy="100" r="90" fill="url(#solarGlow)" />
          <circle cx="100" cy="100" r="82" fill="#1e1b4b" stroke="#f59e0b" strokeWidth="3" />

          {/* Golden Sun Halo Crown */}
          <polygon points="100,20 106,38 94,38" fill="#fde047" />
          <polygon points="125,28 122,44 112,40" fill="#fde047" />
          <polygon points="75,28 88,40 78,44" fill="#fde047" />

          {/* Head & Sun Helmet */}
          <circle cx="100" cy="65" r="24" fill="#ffdfba" />
          <path d="M 76 60 C 76 42, 124 42, 124 60 L 120 75 L 80 75 Z" fill="#b45309" stroke="#fde047" strokeWidth="2" />
          {/* Glowing Golden Eyes */}
          <ellipse cx="92" cy="66" rx="4" ry="3" fill="#fef08a" />
          <ellipse cx="108" cy="66" rx="4" ry="3" fill="#fef08a" />
          {/* Mouth */}
          <line x1="96" y1="78" x2="104" y2="78" stroke="#78350f" strokeWidth="2" strokeLinecap="round" />

          {/* Heavy Golden Sun Cuirass & Pauldrons */}
          <path d="M 70 85 L 100 95 L 130 85 L 125 150 L 75 150 Z" fill="#d97706" stroke="#fde047" strokeWidth="2" />
          <polygon points="100,98 108,112 92,112" fill="#fef08a" />

          {/* Left: Giant Radiant Sun Shield */}
          <polygon points="45,75 75,70 80,145 40,150 30,110" fill="#f59e0b" stroke="#fef08a" strokeWidth="3" />
          <circle cx="58" cy="110" r="14" fill="#b45309" stroke="#fde047" strokeWidth="2" />
          <circle cx="58" cy="110" r="6" fill="#fef08a" />

          {/* Right: Zenith Solar Lance */}
          <line x1="130" y1="170" x2="170" y2="30" stroke="#78350f" strokeWidth="5" strokeLinecap="round" />
          <polygon points="170,30 162,55 178,55" fill="#fde047" stroke="#f59e0b" strokeWidth="2" />
        </svg>
      );

    // 2. ASTRA (Basis: Ashe - The Frost Sovereign)
    case 'c_astra':
      return (
        <svg width={size} height={size} viewBox="0 0 200 200" className={className}>
          <defs>
            <radialGradient id="frostGlow" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="#e0f2fe" stopOpacity="0.8" />
              <stop offset="70%" stopColor="#38bdf8" stopOpacity="0.3" />
              <stop offset="100%" stopColor="#0284c7" stopOpacity="0" />
            </radialGradient>
          </defs>
          <circle cx="100" cy="100" r="90" fill="url(#frostGlow)" />
          <circle cx="100" cy="100" r="82" fill="#0c4a6e" stroke="#38bdf8" strokeWidth="3" />

          {/* Frost Crystal Crown & White Braided Hair */}
          <path d="M 70 65 C 65 30, 135 30, 130 65 C 135 90, 140 140, 125 160 C 115 140, 120 90, 115 75 C 85 90, 80 140, 75 160 Z" fill="#f0f9ff" />
          <polygon points="100,28 107,44 93,44" fill="#38bdf8" />
          <polygon points="118,34 116,48 108,46" fill="#7dd3fc" />
          <polygon points="82,34 92,46 84,48" fill="#7dd3fc" />

          {/* Face */}
          <circle cx="100" cy="65" r="22" fill="#ffe4e6" />
          <ellipse cx="92" cy="65" rx="3.5" ry="4" fill="#0284c7" />
          <ellipse cx="108" cy="65" rx="3.5" ry="4" fill="#0284c7" />
          <ellipse cx="93" cy="63" rx="1.5" ry="1.5" fill="#ffffff" />
          <ellipse cx="109" cy="63" rx="1.5" ry="1.5" fill="#ffffff" />
          <path d="M 96 76 Q 100 80 104 76" fill="none" stroke="#e11d48" strokeWidth="2" strokeLinecap="round" />

          {/* Frost Queen Cloak & Royal Bow */}
          <path d="M 75 88 L 100 96 L 125 88 L 135 155 L 65 155 Z" fill="#0369a1" stroke="#38bdf8" strokeWidth="2" />
          <path d="M 80 85 Q 100 100 120 85" fill="none" stroke="#f0f9ff" strokeWidth="4" />

          {/* True Ice Crystal Longbow */}
          <path d="M 145 35 Q 185 100 145 165" fill="none" stroke="#38bdf8" strokeWidth="5" strokeLinecap="round" />
          <line x1="145" y1="35" x2="145" y2="165" stroke="#bae6fd" strokeWidth="1.5" strokeDasharray="4 2" />
          {/* Nocked Ice Arrow */}
          <line x1="110" y1="100" x2="165" y2="100" stroke="#f0f9ff" strokeWidth="3" />
          <polygon points="165,100 155,95 155,105" fill="#38bdf8" />
        </svg>
      );

    // 3. KYUMI (Basis: Ahri - The Nine-Tailed Spirit)
    case 'c_kyumi':
      return (
        <svg width={size} height={size} viewBox="0 0 200 200" className={className}>
          <defs>
            <radialGradient id="spiritGlow" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="#fbcfe8" stopOpacity="0.8" />
              <stop offset="70%" stopColor="#ec4899" stopOpacity="0.3" />
              <stop offset="100%" stopColor="#831843" stopOpacity="0" />
            </radialGradient>
          </defs>
          <circle cx="100" cy="100" r="90" fill="url(#spiritGlow)" />
          <circle cx="100" cy="100" r="82" fill="#500724" stroke="#ec4899" strokeWidth="3" />

          {/* 9 Glowing Fox Tails */}
          <path d="M 40 130 C 10 90, 40 40, 70 75" fill="none" stroke="#f472b6" strokeWidth="12" strokeLinecap="round" opacity="0.8" />
          <path d="M 30 150 C 0 120, 20 70, 65 95" fill="none" stroke="#ec4899" strokeWidth="14" strokeLinecap="round" opacity="0.9" />
          <path d="M 160 130 C 190 90, 160 40, 130 75" fill="none" stroke="#f472b6" strokeWidth="12" strokeLinecap="round" opacity="0.8" />
          <path d="M 170 150 C 200 120, 180 70, 135 95" fill="none" stroke="#ec4899" strokeWidth="14" strokeLinecap="round" opacity="0.9" />

          {/* Fox Ears */}
          <polygon points="76,46 64,15 90,36" fill="#18181b" stroke="#ec4899" strokeWidth="2" />
          <polygon points="74,42 68,22 84,36" fill="#f472b6" />
          <polygon points="124,46 136,15 110,36" fill="#18181b" stroke="#ec4899" strokeWidth="2" />
          <polygon points="126,42 132,22 116,36" fill="#f472b6" />

          {/* Black Fox Hair */}
          <path d="M 70 60 C 65 30, 135 30, 130 60 C 135 90, 145 130, 130 150 C 115 135, 120 85, 115 70 C 85 85, 80 135, 70 150 Z" fill="#09090b" />

          {/* Face & Whiskers */}
          <circle cx="100" cy="65" r="22" fill="#ffe4e6" />
          {/* Whiskers */}
          <line x1="72" y1="64" x2="84" y2="66" stroke="#ec4899" strokeWidth="2" />
          <line x1="72" y1="70" x2="84" y2="70" stroke="#ec4899" strokeWidth="2" />
          <line x1="128" y1="64" x2="116" y2="66" stroke="#ec4899" strokeWidth="2" />
          <line x1="128" y1="70" x2="116" y2="70" stroke="#ec4899" strokeWidth="2" />

          {/* Amber Fox Eyes */}
          <ellipse cx="92" cy="63" rx="4" ry="4.5" fill="#f59e0b" />
          <ellipse cx="108" cy="63" rx="4" ry="4.5" fill="#f59e0b" />
          <ellipse cx="93" cy="61" rx="1.5" ry="1.5" fill="#ffffff" />
          <ellipse cx="109" cy="61" rx="1.5" ry="1.5" fill="#ffffff" />
          <path d="M 97 74 Q 100 78 103 74" fill="none" stroke="#be185d" strokeWidth="2" strokeLinecap="round" />

          {/* Shrine Robes */}
          <path d="M 75 88 L 100 96 L 125 88 L 130 155 L 70 155 Z" fill="#be185d" stroke="#ec4899" strokeWidth="2" />
          <path d="M 80 88 L 100 110 L 120 88" fill="#ffffff" />

          {/* Floating Spirit Orb of True Damage */}
          <circle cx="100" cy="115" r="16" fill="#f472b6" stroke="#ffffff" strokeWidth="3" />
          <circle cx="100" cy="115" r="10" fill="#67e8f9" />
        </svg>
      );

    // 4. BUCK (Basis: Graves - The Boomstick Outlaw)
    case 'c_buck':
      return (
        <svg width={size} height={size} viewBox="0 0 200 200" className={className}>
          <defs>
            <radialGradient id="smokeGlow" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="#fdba74" stopOpacity="0.8" />
              <stop offset="70%" stopColor="#d97706" stopOpacity="0.3" />
              <stop offset="100%" stopColor="#78350f" stopOpacity="0" />
            </radialGradient>
          </defs>
          <circle cx="100" cy="100" r="90" fill="url(#smokeGlow)" />
          <circle cx="100" cy="100" r="82" fill="#291e10" stroke="#f97316" strokeWidth="3" />

          {/* Rugged Outlaw Hat & Hair */}
          <ellipse cx="100" cy="42" rx="36" ry="10" fill="#451a03" stroke="#78350f" strokeWidth="2" />
          <path d="M 75 42 C 75 22, 125 22, 125 42 Z" fill="#291404" />

          {/* Face & Beard */}
          <circle cx="100" cy="65" r="23" fill="#ffedd5" />
          {/* Stubble Beard */}
          <path d="M 80 65 C 80 88, 120 88, 120 65 L 115 80 L 85 80 Z" fill="#78350f" opacity="0.6" />
          {/* Matchstick / Cigar in Mouth */}
          <line x1="98" y1="74" x2="116" y2="78" stroke="#fef08a" strokeWidth="3" strokeLinecap="round" />
          <circle cx="118" cy="79" r="2.5" fill="#ea580c" />

          {/* Rugged Intense Eyes */}
          <ellipse cx="91" cy="62" rx="3.5" ry="3" fill="#292524" />
          <ellipse cx="109" cy="62" rx="3.5" ry="3" fill="#292524" />

          {/* Leather Trenchcoat & Heavy Red Cape */}
          <path d="M 65 85 L 100 95 L 135 85 L 140 160 L 60 160 Z" fill="#78350f" stroke="#b45309" strokeWidth="2" />
          <path d="M 60 85 L 75 160 L 50 160 Z" fill="#b91c1c" />
          {/* Ammo Bandolier */}
          <line x1="72" y1="88" x2="128" y2="148" stroke="#451a03" strokeWidth="8" />
          <circle cx="85" cy="102" r="3" fill="#facc15" />
          <circle cx="98" cy="116" r="3" fill="#facc15" />
          <circle cx="112" cy="130" r="3" fill="#facc15" />

          {/* Heavy 12-Gauge Double Barrel Shotgun */}
          <rect x="110" y="110" width="65" height="14" rx="3" fill="#292524" stroke="#78716c" strokeWidth="2" transform="rotate(-15 110 110)" />
          <circle cx="168" cy="92" r="4" fill="#000000" stroke="#f97316" strokeWidth="1.5" />
          <circle cx="172" cy="98" r="4" fill="#000000" stroke="#f97316" strokeWidth="1.5" />
        </svg>
      );

    // 5. VALKIRA (Basis: Ambessa - The Warlord Matriarch)
    case 'c_valkira':
    default:
      return (
        <svg width={size} height={size} viewBox="0 0 200 200" className={className}>
          <defs>
            <radialGradient id="bloodGlow" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="#fca5a5" stopOpacity="0.8" />
              <stop offset="70%" stopColor="#dc2626" stopOpacity="0.3" />
              <stop offset="100%" stopColor="#450a0a" stopOpacity="0" />
            </radialGradient>
          </defs>
          <circle cx="100" cy="100" r="90" fill="url(#bloodGlow)" />
          <circle cx="100" cy="100" r="82" fill="#3f0708" stroke="#dc2626" strokeWidth="3" />

          {/* Braided Mohawk & Golden Nose Ring */}
          <path d="M 94 15 C 94 35, 106 35, 106 15 Z" fill="#18181b" />
          <path d="M 85 45 C 85 20, 115 20, 115 45 Z" fill="#09090b" />

          {/* Face with Battle Scar */}
          <circle cx="100" cy="65" r="23" fill="#c27d53" />
          {/* Battle Scar over left eye */}
          <line x1="88" y1="52" x2="94" y2="74" stroke="#ef4444" strokeWidth="2" strokeLinecap="round" />
          {/* Golden Nose Ring & Earrings */}
          <circle cx="100" cy="72" r="2.5" fill="none" stroke="#fde047" strokeWidth="1.5" />
          <circle cx="76" cy="68" r="2.5" fill="none" stroke="#fde047" strokeWidth="1.5" />
          <circle cx="124" cy="68" r="2.5" fill="none" stroke="#fde047" strokeWidth="1.5" />

          {/* Fierce Amber/Red Eyes */}
          <ellipse cx="91" cy="62" rx="3.5" ry="3" fill="#dc2626" />
          <ellipse cx="109" cy="62" rx="3.5" ry="3" fill="#dc2626" />
          <ellipse cx="92" cy="61" rx="1.5" ry="1.5" fill="#fde047" />
          <ellipse cx="110" cy="61" rx="1.5" ry="1.5" fill="#fde047" />
          <path d="M 95 78 L 105 78" stroke="#450a0a" strokeWidth="2" strokeLinecap="round" />

          {/* Heavy Warlord Armor & Red War Cape */}
          <path d="M 68 85 L 100 95 L 132 85 L 128 155 L 72 155 Z" fill="#1c1917" stroke="#78716c" strokeWidth="2" />
          <polygon points="100,98 108,115 92,115" fill="#dc2626" />
          <path d="M 65 85 L 50 160 L 72 155 Z" fill="#991b1b" />
          <path d="M 135 85 L 150 160 L 128 155 Z" fill="#991b1b" />

          {/* Twin Chained Crescent Blades */}
          {/* Left Crescent Blade */}
          <path d="M 40 60 Q 25 105 55 145" fill="none" stroke="#fca5a5" strokeWidth="5" strokeLinecap="round" />
          <path d="M 40 60 Q 30 105 55 145" fill="none" stroke="#dc2626" strokeWidth="2" />
          {/* Right Crescent Blade */}
          <path d="M 160 60 Q 175 105 145 145" fill="none" stroke="#fca5a5" strokeWidth="5" strokeLinecap="round" />
          <path d="M 160 60 Q 170 105 145 145" fill="none" stroke="#dc2626" strokeWidth="2" />
          {/* Steel Chains */}
          <line x1="55" y1="145" x2="80" y2="125" stroke="#a8a29e" strokeWidth="2" strokeDasharray="3 2" />
          <line x1="145" y1="145" x2="120" y2="125" stroke="#a8a29e" strokeWidth="2" strokeDasharray="3 2" />
        </svg>
      );
  }
};

