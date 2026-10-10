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
          <circle cx="100" cy="100" r="90" fill="url(#solarGlow)" />
          <circle cx="100" cy="100" r="82" fill="#1e1b4b" stroke="#f59e0b" strokeWidth="3" />
          <polygon points="100,20 106,38 94,38" fill="#fde047" />
          <polygon points="125,28 122,44 112,40" fill="#fde047" />
          <polygon points="75,28 88,40 78,44" fill="#fde047" />
          <circle cx="100" cy="65" r="24" fill="#ffdfba" />
          <path d="M 76 60 C 76 42, 124 42, 124 60 L 120 75 L 80 75 Z" fill="#b45309" stroke="#fde047" strokeWidth="2" />
          <ellipse cx="92" cy="66" rx="4" ry="3" fill="#fef08a" />
          <ellipse cx="108" cy="66" rx="4" ry="3" fill="#fef08a" />
          <line x1="96" y1="78" x2="104" y2="78" stroke="#78350f" strokeWidth="2" strokeLinecap="round" />
          <path d="M 70 85 L 100 95 L 130 85 L 125 150 L 75 150 Z" fill="#d97706" stroke="#fde047" strokeWidth="2" />
          <polygon points="100,98 108,112 92,112" fill="#fef08a" />
          <polygon points="45,75 75,70 80,145 40,150 30,110" fill="#f59e0b" stroke="#fef08a" strokeWidth="3" />
          <circle cx="58" cy="110" r="14" fill="#b45309" stroke="#fde047" strokeWidth="2" />
          <circle cx="58" cy="110" r="6" fill="#fef08a" />
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
          <path d="M 70 65 C 65 30, 135 30, 130 65 C 135 90, 140 140, 125 160 C 115 140, 120 90, 115 75 C 85 90, 80 140, 75 160 Z" fill="#f0f9ff" />
          <polygon points="100,28 107,44 93,44" fill="#38bdf8" />
          <polygon points="118,34 116,48 108,46" fill="#7dd3fc" />
          <polygon points="82,34 92,46 84,48" fill="#7dd3fc" />
          <circle cx="100" cy="65" r="22" fill="#ffe4e6" />
          <ellipse cx="92" cy="65" rx="3.5" ry="4" fill="#0284c7" />
          <ellipse cx="108" cy="65" rx="3.5" ry="4" fill="#0284c7" />
          <path d="M 96 76 Q 100 80 104 76" fill="none" stroke="#e11d48" strokeWidth="2" strokeLinecap="round" />
          <path d="M 75 88 L 100 96 L 125 88 L 135 155 L 65 155 Z" fill="#0369a1" stroke="#38bdf8" strokeWidth="2" />
          <path d="M 145 35 Q 185 100 145 165" fill="none" stroke="#38bdf8" strokeWidth="5" strokeLinecap="round" />
          <line x1="145" y1="35" x2="145" y2="165" stroke="#bae6fd" strokeWidth="1.5" strokeDasharray="4 2" />
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
          <path d="M 40 130 C 10 90, 40 40, 70 75" fill="none" stroke="#f472b6" strokeWidth="12" strokeLinecap="round" opacity="0.8" />
          <path d="M 160 130 C 190 90, 160 40, 130 75" fill="none" stroke="#f472b6" strokeWidth="12" strokeLinecap="round" opacity="0.8" />
          <polygon points="76,46 64,15 90,36" fill="#18181b" stroke="#ec4899" strokeWidth="2" />
          <polygon points="124,46 136,15 110,36" fill="#18181b" stroke="#ec4899" strokeWidth="2" />
          <path d="M 70 60 C 65 30, 135 30, 130 60 C 135 90, 145 130, 130 150 C 115 135, 120 85, 115 70 C 85 85, 80 135, 70 150 Z" fill="#09090b" />
          <circle cx="100" cy="65" r="22" fill="#ffe4e6" />
          <ellipse cx="92" cy="63" rx="4" ry="4.5" fill="#f59e0b" />
          <ellipse cx="108" cy="63" rx="4" ry="4.5" fill="#f59e0b" />
          <path d="M 75 88 L 100 96 L 125 88 L 130 155 L 70 155 Z" fill="#be185d" stroke="#ec4899" strokeWidth="2" />
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
          <ellipse cx="100" cy="42" rx="36" ry="10" fill="#451a03" stroke="#78350f" strokeWidth="2" />
          <circle cx="100" cy="65" r="23" fill="#ffedd5" />
          <path d="M 80 65 C 80 88, 120 88, 120 65 L 115 80 L 85 80 Z" fill="#78350f" opacity="0.6" />
          <line x1="98" y1="74" x2="116" y2="78" stroke="#fef08a" strokeWidth="3" strokeLinecap="round" />
          <circle cx="118" cy="79" r="2.5" fill="#ea580c" />
          <path d="M 65 85 L 100 95 L 135 85 L 140 160 L 60 160 Z" fill="#78350f" stroke="#b45309" strokeWidth="2" />
          <rect x="110" y="110" width="65" height="14" rx="3" fill="#292524" stroke="#78716c" strokeWidth="2" transform="rotate(-15 110 110)" />
          <circle cx="168" cy="92" r="4" fill="#000000" stroke="#f97316" strokeWidth="1.5" />
          <circle cx="172" cy="98" r="4" fill="#000000" stroke="#f97316" strokeWidth="1.5" />
        </svg>
      );

    // 5. VALKIRA (Basis: Ambessa - The Warlord Matriarch)
    case 'c_valkira':
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
          <path d="M 94 15 C 94 35, 106 35, 106 15 Z" fill="#18181b" />
          <circle cx="100" cy="65" r="23" fill="#c27d53" />
          <line x1="88" y1="52" x2="94" y2="74" stroke="#ef4444" strokeWidth="2" strokeLinecap="round" />
          <ellipse cx="91" cy="62" rx="3.5" ry="3" fill="#dc2626" />
          <ellipse cx="109" cy="62" rx="3.5" ry="3" fill="#dc2626" />
          <path d="M 68 85 L 100 95 L 132 85 L 128 155 L 72 155 Z" fill="#1c1917" stroke="#78716c" strokeWidth="2" />
          <path d="M 40 60 Q 25 105 55 145" fill="none" stroke="#fca5a5" strokeWidth="5" strokeLinecap="round" />
          <path d="M 160 60 Q 175 105 145 145" fill="none" stroke="#fca5a5" strokeWidth="5" strokeLinecap="round" />
        </svg>
      );

    // 6. KAGE (Basis: Zed - The Shadow Assassin)
    case 'c_kage':
      return (
        <svg width={size} height={size} viewBox="0 0 200 200" className={className}>
          <defs>
            <radialGradient id="shadowGlow" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="#ef4444" stopOpacity="0.7" />
              <stop offset="70%" stopColor="#18181b" stopOpacity="0.5" />
              <stop offset="100%" stopColor="#09090b" stopOpacity="0" />
            </radialGradient>
          </defs>
          <circle cx="100" cy="100" r="90" fill="url(#shadowGlow)" />
          <circle cx="100" cy="100" r="82" fill="#09090b" stroke="#dc2626" strokeWidth="3" />
          <path d="M 60 50 L 100 20 L 140 50 L 135 105 L 100 120 L 65 105 Z" fill="#18181b" stroke="#71717a" strokeWidth="2" />
          {/* Silver Faceplate */}
          <polygon points="85,60 115,60 110,85 100,95 90,85" fill="#3f3f46" stroke="#a1a1aa" strokeWidth="1.5" />
          {/* Glowing Red Slit Visor Eyes */}
          <line x1="88" y1="68" x2="98" y2="70" stroke="#ef4444" strokeWidth="3" strokeLinecap="round" />
          <line x1="112" y1="68" x2="102" y2="70" stroke="#ef4444" strokeWidth="3" strokeLinecap="round" />
          {/* Shadow Cowl & Pauldrons */}
          <path d="M 50 110 L 100 130 L 150 110 L 140 170 L 60 170 Z" fill="#18181b" stroke="#dc2626" strokeWidth="2" />
          {/* Twin Shuriken Blades on Gauntlets */}
          <polygon points="35,115 55,100 45,135 25,125" fill="#e4e4e7" stroke="#dc2626" strokeWidth="1.5" />
          <polygon points="165,115 145,100 155,135 175,125" fill="#e4e4e7" stroke="#dc2626" strokeWidth="1.5" />
          {/* Red Shuriken Center */}
          <circle cx="100" cy="145" r="8" fill="#dc2626" stroke="#fca5a5" strokeWidth="1.5" />
        </svg>
      );

    // 7. KAZEMARU (Basis: Yasuo - The Wind Skirmisher)
    case 'c_kazemaru':
      return (
        <svg width={size} height={size} viewBox="0 0 200 200" className={className}>
          <defs>
            <radialGradient id="windGlow" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="#bae6fd" stopOpacity="0.8" />
              <stop offset="70%" stopColor="#0284c7" stopOpacity="0.4" />
              <stop offset="100%" stopColor="#082f49" stopOpacity="0" />
            </radialGradient>
          </defs>
          <circle cx="100" cy="100" r="90" fill="url(#windGlow)" />
          <circle cx="100" cy="100" r="82" fill="#075985" stroke="#38bdf8" strokeWidth="3" />
          {/* High Samurai Ponytail */}
          <path d="M 100 45 C 105 10, 155 15, 160 40 C 145 35, 120 40, 105 45 Z" fill="#0f172a" />
          {/* Steel Headband */}
          <path d="M 80 48 L 120 48 L 115 54 L 85 54 Z" fill="#94a3b8" stroke="#38bdf8" strokeWidth="1.5" />
          {/* Face */}
          <circle cx="100" cy="65" r="22" fill="#ffedd5" />
          <path d="M 82 54 C 82 85, 118 85, 118 54 Z" fill="#0f172a" opacity="0.3" />
          <line x1="90" y1="62" x2="97" y2="62" stroke="#0f172a" strokeWidth="2.5" />
          <line x1="103" y1="62" x2="110" y2="62" stroke="#0f172a" strokeWidth="2.5" />
          <line x1="95" y1="74" x2="105" y2="74" stroke="#78350f" strokeWidth="2" strokeLinecap="round" />
          {/* Blue Scarf */}
          <path d="M 75 80 Q 100 95 125 80 L 135 150 L 65 150 Z" fill="#0284c7" stroke="#38bdf8" strokeWidth="2" />
          {/* Swirling Katana Blade */}
          <line x1="40" y1="160" x2="155" y2="55" stroke="#e0f2fe" strokeWidth="4" strokeLinecap="round" />
          <line x1="38" y1="162" x2="52" y2="148" stroke="#f59e0b" strokeWidth="6" strokeLinecap="square" />
          {/* Wind Gust Vortex */}
          <path d="M 50 120 Q 90 90 140 125" fill="none" stroke="#7dd3fc" strokeWidth="3" strokeDasharray="6 3" />
        </svg>
      );

    // 8. KINDRA (Basis: Kindred - The Eternal Hunters)
    case 'c_kindra':
      return (
        <svg width={size} height={size} viewBox="0 0 200 200" className={className}>
          <defs>
            <radialGradient id="huntGlow" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="#c7d2fe" stopOpacity="0.8" />
              <stop offset="60%" stopColor="#6366f1" stopOpacity="0.4" />
              <stop offset="100%" stopColor="#312e81" stopOpacity="0" />
            </radialGradient>
          </defs>
          <circle cx="100" cy="100" r="90" fill="url(#huntGlow)" />
          <circle cx="100" cy="100" r="82" fill="#1e1b4b" stroke="#818cf8" strokeWidth="3" />
          {/* Dark Swirling Wolf Silhouette on Right */}
          <path d="M 100 40 C 145 25, 175 75, 160 125 C 150 155, 120 160, 100 150 Z" fill="#0f172a" opacity="0.85" />
          <ellipse cx="140" cy="85" rx="5" ry="3" fill="#38bdf8" />
          {/* White Lamb Mask on Left */}
          <path d="M 65 55 C 65 35, 100 35, 100 55 L 98 105 C 98 120, 68 120, 68 105 Z" fill="#f8fafc" stroke="#c7d2fe" strokeWidth="2" />
          {/* Lamb Horn Curves */}
          <path d="M 66 50 Q 45 40 55 65" fill="none" stroke="#818cf8" strokeWidth="4" strokeLinecap="round" />
          {/* Glowing Cyan Eye */}
          <ellipse cx="82" cy="72" rx="4" ry="4" fill="#06b6d4" />
          {/* Spirit Bow */}
          <path d="M 45 40 Q 25 100 45 160" fill="none" stroke="#818cf8" strokeWidth="4" strokeLinecap="round" />
          <line x1="45" y1="40" x2="45" y2="160" stroke="#e0e7ff" strokeWidth="1.5" strokeDasharray="4 2" />
          <polygon points="45,100 70,100 55,95" fill="#38bdf8" />
        </svg>
      );

    // 9. CORA (Basis: Xayah - The Rebel Feather Marksman)
    case 'c_cora':
      return (
        <svg width={size} height={size} viewBox="0 0 200 200" className={className}>
          <defs>
            <radialGradient id="rebelGlow" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="#f472b6" stopOpacity="0.8" />
              <stop offset="70%" stopColor="#a21caf" stopOpacity="0.4" />
              <stop offset="100%" stopColor="#4a044e" stopOpacity="0" />
            </radialGradient>
          </defs>
          <circle cx="100" cy="100" r="90" fill="url(#rebelGlow)" />
          <circle cx="100" cy="100" r="82" fill="#581c87" stroke="#f472b6" strokeWidth="3" />
          {/* Feathered Raptor Ears / Crest */}
          <polygon points="70,40 50,15 85,30" fill="#a21caf" stroke="#f472b6" strokeWidth="2" />
          <polygon points="130,40 150,15 115,30" fill="#a21caf" stroke="#f472b6" strokeWidth="2" />
          {/* Violet Rebel Hood */}
          <path d="M 68 50 C 68 25, 132 25, 132 50 L 128 100 L 72 100 Z" fill="#701a75" />
          {/* Face */}
          <circle cx="100" cy="68" r="21" fill="#fdf2f8" />
          <ellipse cx="91" cy="65" rx="3.5" ry="4" fill="#facc15" />
          <ellipse cx="109" cy="65" rx="3.5" ry="4" fill="#facc15" />
          {/* Feathers Fan */}
          <polygon points="120,110 165,85 140,115" fill="#f472b6" stroke="#ffffff" strokeWidth="1.5" />
          <polygon points="125,120 175,110 145,130" fill="#d946ef" stroke="#ffffff" strokeWidth="1.5" />
          <polygon points="120,135 168,140 138,145" fill="#a21caf" stroke="#ffffff" strokeWidth="1.5" />
          {/* Cloak */}
          <path d="M 70 95 L 100 110 L 130 95 L 125 160 L 75 160 Z" fill="#4a044e" stroke="#f472b6" strokeWidth="2" />
        </svg>
      );

    // 10. RENN (Basis: Rakan - The Charismatic Battle Dancer)
    case 'c_renn':
      return (
        <svg width={size} height={size} viewBox="0 0 200 200" className={className}>
          <defs>
            <radialGradient id="danceGlow" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="#fef08a" stopOpacity="0.8" />
              <stop offset="70%" stopColor="#eab308" stopOpacity="0.4" />
              <stop offset="100%" stopColor="#713f12" stopOpacity="0" />
            </radialGradient>
          </defs>
          <circle cx="100" cy="100" r="90" fill="url(#danceGlow)" />
          <circle cx="100" cy="100" r="82" fill="#78350f" stroke="#eab308" strokeWidth="3" />
          {/* Golden Feather Plume Headband */}
          <path d="M 95 15 C 95 35, 125 25, 130 45" fill="none" stroke="#fde047" strokeWidth="5" strokeLinecap="round" />
          <circle cx="100" cy="65" r="22" fill="#fef3c7" />
          {/* Emerald Eyes */}
          <ellipse cx="91" cy="63" rx="3.5" ry="4" fill="#10b981" />
          <ellipse cx="109" cy="63" rx="3.5" ry="4" fill="#10b981" />
          <path d="M 94 75 Q 100 82 106 75" fill="none" stroke="#b45309" strokeWidth="2.5" strokeLinecap="round" />
          {/* Golden Battle Cape & Ribbons */}
          <path d="M 65 90 L 100 105 L 135 90 L 145 165 L 55 165 Z" fill="#ca8a04" stroke="#facc15" strokeWidth="2" />
          <path d="M 70 95 Q 50 140 30 150" fill="none" stroke="#22c55e" strokeWidth="4" strokeLinecap="round" />
          <path d="M 130 95 Q 150 140 170 150" fill="none" stroke="#facc15" strokeWidth="4" strokeLinecap="round" />
        </svg>
      );

    // 11. SYLLA (Basis: Lone Druid - The Bear Shaman)
    case 'c_sylla':
      return (
        <svg width={size} height={size} viewBox="0 0 200 200" className={className}>
          <defs>
            <radialGradient id="druidGlow" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="#bbf7d0" stopOpacity="0.8" />
              <stop offset="70%" stopColor="#15803d" stopOpacity="0.4" />
              <stop offset="100%" stopColor="#14532d" stopOpacity="0" />
            </radialGradient>
          </defs>
          <circle cx="100" cy="100" r="90" fill="url(#druidGlow)" />
          <circle cx="100" cy="100" r="82" fill="#14532d" stroke="#22c55e" strokeWidth="3" />
          {/* Bear Pelt Horns / Antlers */}
          <path d="M 75 40 Q 55 20 65 10" fill="none" stroke="#854d0e" strokeWidth="4" strokeLinecap="round" />
          <path d="M 125 40 Q 145 20 135 10" fill="none" stroke="#854d0e" strokeWidth="4" strokeLinecap="round" />
          {/* Druid Bear Hood */}
          <path d="M 70 45 C 70 25, 130 25, 130 45 L 125 80 L 75 80 Z" fill="#3f2e18" />
          <circle cx="100" cy="65" r="21" fill="#fed7aa" />
          {/* Shaman Beard */}
          <path d="M 85 70 C 85 95, 115 95, 115 70 Z" fill="#e2e8f0" />
          {/* Green Runic Eye */}
          <ellipse cx="92" cy="63" rx="3.5" ry="3" fill="#22c55e" />
          <ellipse cx="108" cy="63" rx="3.5" ry="3" fill="#22c55e" />
          {/* Spirit Bear Claws Behind */}
          <circle cx="45" cy="115" r="8" fill="#166534" />
          <circle cx="155" cy="115" r="8" fill="#166534" />
          <path d="M 70 95 L 100 110 L 130 95 L 135 160 L 65 160 Z" fill="#1e3a1f" stroke="#22c55e" strokeWidth="2" />
        </svg>
      );

    // 12. TEQUOIA (Basis: Invoker - The Grand Magus)
    case 'c_tequoia':
      return (
        <svg width={size} height={size} viewBox="0 0 200 200" className={className}>
          <defs>
            <radialGradient id="magusGlow" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="#e0e7ff" stopOpacity="0.8" />
              <stop offset="70%" stopColor="#6366f1" stopOpacity="0.4" />
              <stop offset="100%" stopColor="#1e1b4b" stopOpacity="0" />
            </radialGradient>
          </defs>
          <circle cx="100" cy="100" r="90" fill="url(#magusGlow)" />
          <circle cx="100" cy="100" r="82" fill="#1e1b4b" stroke="#818cf8" strokeWidth="3" />
          {/* 3 Orbiting Elemental Orbs: Quas, Wex, Exort */}
          <circle cx="60" cy="35" r="10" fill="#38bdf8" stroke="#ffffff" strokeWidth="2" />
          <circle cx="100" cy="22" r="10" fill="#c084fc" stroke="#ffffff" strokeWidth="2" />
          <circle cx="140" cy="35" r="10" fill="#f97316" stroke="#ffffff" strokeWidth="2" />
          {/* High Magus Collar */}
          <polygon points="65,65 50,30 85,55" fill="#4f46e5" stroke="#facc15" strokeWidth="1.5" />
          <polygon points="135,65 150,30 115,55" fill="#4f46e5" stroke="#facc15" strokeWidth="1.5" />
          {/* Silver Elven Hair & Face */}
          <path d="M 75 55 C 75 35, 125 35, 125 55 L 120 75 L 80 75 Z" fill="#f8fafc" />
          <circle cx="100" cy="65" r="20" fill="#fef3c7" />
          <ellipse cx="92" cy="63" rx="3" ry="3.5" fill="#818cf8" />
          <ellipse cx="108" cy="63" rx="3" ry="3.5" fill="#818cf8" />
          {/* Regal Arcane Robes */}
          <path d="M 70 85 L 100 100 L 130 85 L 135 160 L 65 160 Z" fill="#312e81" stroke="#facc15" strokeWidth="2" />
        </svg>
      );

    // 13. ZAL (Basis: Dazzle - The Shadow Priest)
    case 'c_zal':
      return (
        <svg width={size} height={size} viewBox="0 0 200 200" className={className}>
          <defs>
            <radialGradient id="zalGlow" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="#f5d0fe" stopOpacity="0.8" />
              <stop offset="70%" stopColor="#d946ef" stopOpacity="0.4" />
              <stop offset="100%" stopColor="#4a044e" stopOpacity="0" />
            </radialGradient>
          </defs>
          <circle cx="100" cy="100" r="90" fill="url(#zalGlow)" />
          <circle cx="100" cy="100" r="82" fill="#581c87" stroke="#d946ef" strokeWidth="3" />
          {/* Neon Pink/Violet Feather Mohawk */}
          <polygon points="100,10 94,45 106,45" fill="#f43f5e" />
          <polygon points="88,20 86,48 96,48" fill="#d946ef" />
          <polygon points="112,20 114,48 104,48" fill="#a855f7" />
          {/* Tribal Witch Mask */}
          <circle cx="100" cy="65" r="23" fill="#3b0764" stroke="#d946ef" strokeWidth="2" />
          <ellipse cx="90" cy="63" rx="4" ry="5" fill="#22d3ee" />
          <ellipse cx="110" cy="63" rx="4" ry="5" fill="#22d3ee" />
          <line x1="100" y1="55" x2="100" y2="75" stroke="#f43f5e" strokeWidth="2" />
          {/* Shallow Grave Talisman Staff */}
          <line x1="145" y1="40" x2="145" y2="165" stroke="#701a75" strokeWidth="5" />
          <circle cx="145" cy="40" r="12" fill="#d946ef" stroke="#ffffff" strokeWidth="2" />
          <line x1="140" y1="40" x2="150" y2="40" stroke="#ffffff" strokeWidth="3" />
          <line x1="145" y1="35" x2="145" y2="45" stroke="#ffffff" strokeWidth="3" />
        </svg>
      );

    // 14. XIN (Basis: Ember Spirit - The Flame Skirmisher)
    case 'c_xin':
      return (
        <svg width={size} height={size} viewBox="0 0 200 200" className={className}>
          <defs>
            <radialGradient id="flameGlow" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="#fef08a" stopOpacity="0.9" />
              <stop offset="60%" stopColor="#ea580c" stopOpacity="0.5" />
              <stop offset="100%" stopColor="#7c2d12" stopOpacity="0" />
            </radialGradient>
          </defs>
          <circle cx="100" cy="100" r="90" fill="url(#flameGlow)" />
          <circle cx="100" cy="100" r="82" fill="#431407" stroke="#ea580c" strokeWidth="3" />
          {/* Flaming Topknot & Brow */}
          <polygon points="100,12 92,38 108,38" fill="#facc15" />
          <circle cx="100" cy="65" r="22" fill="#c2410c" />
          {/* Molten Beard */}
          <path d="M 85 70 C 85 96, 115 96, 115 70 Z" fill="#f97316" />
          <ellipse cx="91" cy="62" rx="3.5" ry="3" fill="#fef08a" />
          <ellipse cx="109" cy="62" rx="3.5" ry="3" fill="#fef08a" />
          {/* Dual Burning Scimitars */}
          <path d="M 40 70 Q 30 120 65 145" fill="none" stroke="#facc15" strokeWidth="4" strokeLinecap="round" />
          <path d="M 160 70 Q 170 120 135 145" fill="none" stroke="#facc15" strokeWidth="4" strokeLinecap="round" />
          <path d="M 70 85 L 100 98 L 130 85 L 135 160 L 65 160 Z" fill="#9a3412" stroke="#f97316" strokeWidth="2" />
        </svg>
      );

    // 15. RAIJIN (Basis: Storm Spirit - The Lightning Burst)
    case 'c_raijin':
      return (
        <svg width={size} height={size} viewBox="0 0 200 200" className={className}>
          <defs>
            <radialGradient id="stormGlow" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="#fef08a" stopOpacity="0.8" />
              <stop offset="70%" stopColor="#0284c7" stopOpacity="0.4" />
              <stop offset="100%" stopColor="#0c4a6e" stopOpacity="0" />
            </radialGradient>
          </defs>
          <circle cx="100" cy="100" r="90" fill="url(#stormGlow)" />
          <circle cx="100" cy="100" r="82" fill="#0369a1" stroke="#38bdf8" strokeWidth="3" />
          {/* Conical Straw Storm Hat */}
          <polygon points="100,22 45,55 155,55" fill="#0284c7" stroke="#fde047" strokeWidth="2" />
          <circle cx="100" cy="72" r="24" fill="#67e8f9" />
          {/* Lightning Bolts Radiating */}
          <polygon points="40,90 55,95 48,110 65,102 52,125" fill="#fde047" />
          <polygon points="160,90 145,95 152,110 135,102 148,125" fill="#fde047" />
          {/* Jovial Grin & Electric Eyes */}
          <ellipse cx="91" cy="70" rx="4" ry="4" fill="#fde047" />
          <ellipse cx="109" cy="70" rx="4" ry="4" fill="#fde047" />
          <path d="M 92 82 Q 100 92 108 82" fill="none" stroke="#0f172a" strokeWidth="3" strokeLinecap="round" />
          <circle cx="100" cy="130" r="32" fill="#0284c7" stroke="#38bdf8" strokeWidth="2" />
        </svg>
      );

    // 16. KAOLIN (Basis: Earth Spirit - The Earth Brawler)
    case 'c_kaolin':
      return (
        <svg width={size} height={size} viewBox="0 0 200 200" className={className}>
          <defs>
            <radialGradient id="jadeGlow" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="#6ee7b7" stopOpacity="0.8" />
              <stop offset="70%" stopColor="#059669" stopOpacity="0.4" />
              <stop offset="100%" stopColor="#064e3b" stopOpacity="0" />
            </radialGradient>
          </defs>
          <circle cx="100" cy="100" r="90" fill="url(#jadeGlow)" />
          <circle cx="100" cy="100" r="82" fill="#064e3b" stroke="#34d399" strokeWidth="3" />
          {/* Carved Terracotta / Jade Stone Armor */}
          <rect x="78" y="38" width="44" height="20" rx="4" fill="#047857" stroke="#6ee7b7" strokeWidth="1.5" />
          <circle cx="100" cy="65" r="23" fill="#10b981" />
          <ellipse cx="91" cy="63" rx="4" ry="3" fill="#a7f3d0" />
          <ellipse cx="109" cy="63" rx="4" ry="3" fill="#a7f3d0" />
          {/* Stone Bo Staff */}
          <line x1="35" y1="165" x2="165" y2="35" stroke="#047857" strokeWidth="6" strokeLinecap="round" />
          <circle cx="165" cy="35" r="8" fill="#34d399" />
          <path d="M 68 88 L 100 102 L 132 88 L 130 160 L 70 160 Z" fill="#065f46" stroke="#34d399" strokeWidth="2" />
        </svg>
      );

    // 17. INAI (Basis: Void Spirit - The Void Infiltrator)
    case 'c_inai':
      return (
        <svg width={size} height={size} viewBox="0 0 200 200" className={className}>
          <defs>
            <radialGradient id="voidSpiritGlow" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="#e9d5ff" stopOpacity="0.8" />
              <stop offset="70%" stopColor="#7c3aed" stopOpacity="0.4" />
              <stop offset="100%" stopColor="#2e1065" stopOpacity="0" />
            </radialGradient>
          </defs>
          <circle cx="100" cy="100" r="90" fill="url(#voidSpiritGlow)" />
          <circle cx="100" cy="100" r="82" fill="#2e1065" stroke="#a855f7" strokeWidth="3" />
          {/* Cosmic Void Cowl */}
          <path d="M 70 48 C 70 20, 130 20, 130 48 L 125 80 L 75 80 Z" fill="#581c87" />
          <circle cx="100" cy="65" r="22" fill="#3b0764" />
          {/* Glowing Third Eye */}
          <polygon points="100,50 104,56 96,56" fill="#c084fc" />
          <ellipse cx="91" cy="65" rx="3.5" ry="3" fill="#c084fc" />
          <ellipse cx="109" cy="65" rx="3.5" ry="3" fill="#c084fc" />
          {/* Twin Void Ether Blades */}
          <polygon points="40,80 50,130 35,115" fill="#a855f7" stroke="#ffffff" strokeWidth="1.5" />
          <polygon points="160,80 150,130 165,115" fill="#a855f7" stroke="#ffffff" strokeWidth="1.5" />
          <path d="M 70 90 L 100 105 L 130 90 L 135 160 L 65 160 Z" fill="#4c1d95" stroke="#a855f7" strokeWidth="2" />
        </svg>
      );

    // 18. VEYARA (Basis: Qiyana - The Prism Regent)
    case 'c_qiyana':
      return (
        <svg width={size} height={size} viewBox="0 0 200 200" className={className}>
          <defs>
            <radialGradient id="prismGlow" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="#99f6e4" stopOpacity="0.8" />
              <stop offset="70%" stopColor="#0d9488" stopOpacity="0.4" />
              <stop offset="100%" stopColor="#115e59" stopOpacity="0" />
            </radialGradient>
          </defs>
          <circle cx="100" cy="100" r="90" fill="url(#prismGlow)" />
          <circle cx="100" cy="100" r="82" fill="#134e4a" stroke="#2dd4bf" strokeWidth="3" />
          {/* Empress Tiara */}
          <polygon points="100,30 94,44 106,44" fill="#fde047" />
          <polygon points="80,36 84,46 76,46" fill="#fde047" />
          <polygon points="120,36 116,46 124,46" fill="#fde047" />
          <circle cx="100" cy="65" r="22" fill="#ffedd5" />
          <ellipse cx="91" cy="63" rx="3.5" ry="3.5" fill="#0d9488" />
          <ellipse cx="109" cy="63" rx="3.5" ry="3.5" fill="#0d9488" />
          {/* Giant Circular Ohmlatl Ring Blade with 3 Gems */}
          <circle cx="100" cy="115" r="45" fill="none" stroke="#fde047" strokeWidth="5" />
          <circle cx="100" cy="70" r="7" fill="#38bdf8" stroke="#ffffff" strokeWidth="1.5" />
          <circle cx="60" cy="135" r="7" fill="#22c55e" stroke="#ffffff" strokeWidth="1.5" />
          <circle cx="140" cy="135" r="7" fill="#ea580c" stroke="#ffffff" strokeWidth="1.5" />
        </svg>
      );

    // 19. CINDERLOCK (Basis: Locke - The Ash Exorcist)
    case 'c_locke':
      return (
        <svg width={size} height={size} viewBox="0 0 200 200" className={className}>
          <defs>
            <radialGradient id="ashGlow" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="#fed7aa" stopOpacity="0.8" />
              <stop offset="70%" stopColor="#ea580c" stopOpacity="0.4" />
              <stop offset="100%" stopColor="#431407" stopOpacity="0" />
            </radialGradient>
          </defs>
          <circle cx="100" cy="100" r="90" fill="url(#ashGlow)" />
          <circle cx="100" cy="100" r="82" fill="#291e10" stroke="#f97316" strokeWidth="3" />
          {/* Exorcist Charcoal Hood */}
          <path d="M 70 45 C 70 20, 130 20, 130 45 L 125 80 L 75 80 Z" fill="#18181b" />
          <circle cx="100" cy="65" r="21" fill="#fed7aa" />
          <ellipse cx="91" cy="63" rx="3.5" ry="3" fill="#ea580c" />
          <ellipse cx="109" cy="63" rx="3.5" ry="3" fill="#ea580c" />
          {/* Floating Molten Ritual Nails */}
          <polygon points="45,45 55,75 50,75" fill="#f97316" stroke="#fef08a" strokeWidth="1" />
          <polygon points="155,45 145,75 150,75" fill="#f97316" stroke="#fef08a" strokeWidth="1" />
          <polygon points="100,20 103,40 97,40" fill="#f97316" stroke="#fef08a" strokeWidth="1" />
          <path d="M 68 88 L 100 102 L 132 88 L 130 160 L 70 160 Z" fill="#431407" stroke="#ea580c" strokeWidth="2" />
        </svg>
      );

    // 20. SOLENNE (Basis: Senna - The Mist Lantern)
    case 'c_senna':
      return (
        <svg width={size} height={size} viewBox="0 0 200 200" className={className}>
          <defs>
            <radialGradient id="mistGlow" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="#ccfbf1" stopOpacity="0.8" />
              <stop offset="70%" stopColor="#14b8a6" stopOpacity="0.4" />
              <stop offset="100%" stopColor="#134e4a" stopOpacity="0" />
            </radialGradient>
          </defs>
          <circle cx="100" cy="100" r="90" fill="url(#mistGlow)" />
          <circle cx="100" cy="100" r="82" fill="#042f2e" stroke="#14b8a6" strokeWidth="3" />
          {/* Luminous Mist Shroud & Braids */}
          <path d="M 70 45 C 70 20, 130 20, 130 45 L 125 80 L 75 80 Z" fill="#0f172a" />
          <circle cx="100" cy="65" r="22" fill="#78350f" />
          <ellipse cx="91" cy="63" rx="3.5" ry="3" fill="#5eead4" />
          <ellipse cx="109" cy="63" rx="3.5" ry="3" fill="#5eead4" />
          {/* Colossal Relic Cannon Beam */}
          <rect x="40" y="105" width="120" height="24" rx="4" fill="#0f172a" stroke="#2dd4bf" strokeWidth="2" />
          <line x1="50" y1="117" x2="150" y2="117" stroke="#5eead4" strokeWidth="4" />
          <path d="M 68 90 L 100 102 L 132 90 L 130 160 L 70 160 Z" fill="#134e4a" />
        </svg>
      );

    // 21. CROAKWELL (Basis: Largo - The Marsh Minstrel)
    case 'c_largo':
      return (
        <svg width={size} height={size} viewBox="0 0 200 200" className={className}>
          <defs>
            <radialGradient id="croakGlow" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="#d9f99d" stopOpacity="0.8" />
              <stop offset="70%" stopColor="#84cc16" stopOpacity="0.4" />
              <stop offset="100%" stopColor="#365314" stopOpacity="0" />
            </radialGradient>
          </defs>
          <circle cx="100" cy="100" r="90" fill="url(#croakGlow)" />
          <circle cx="100" cy="100" r="82" fill="#14532d" stroke="#84cc16" strokeWidth="3" />
          {/* Frog Minstrel Crown / Cap */}
          <ellipse cx="100" cy="38" rx="35" ry="12" fill="#65a30d" stroke="#facc15" strokeWidth="2" />
          {/* Big Frog Eyes */}
          <circle cx="82" cy="48" r="14" fill="#84cc16" stroke="#365314" strokeWidth="2" />
          <circle cx="82" cy="48" r="6" fill="#1e293b" />
          <circle cx="118" cy="48" r="14" fill="#84cc16" stroke="#365314" strokeWidth="2" />
          <circle cx="118" cy="48" r="6" fill="#1e293b" />
          {/* Cheerful Mouth */}
          <ellipse cx="100" cy="72" rx="32" ry="18" fill="#a3e635" />
          <path d="M 80 75 Q 100 88 120 75" fill="none" stroke="#365314" strokeWidth="3" strokeLinecap="round" />
          {/* Acoustic Reed Lute */}
          <ellipse cx="140" cy="130" rx="18" ry="24" fill="#a16207" stroke="#facc15" strokeWidth="2" />
          <line x1="140" y1="90" x2="140" y2="150" stroke="#fef08a" strokeWidth="2" />
        </svg>
      );

    // 22. SOULSCOURGE (Basis: Shadow Fiend - The Gloom Harvester)
    case 'c_shadowfiend':
      return (
        <svg width={size} height={size} viewBox="0 0 200 200" className={className}>
          <defs>
            <radialGradient id="fiendGlow" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="#f87171" stopOpacity="0.8" />
              <stop offset="70%" stopColor="#991b1b" stopOpacity="0.5" />
              <stop offset="100%" stopColor="#450a0a" stopOpacity="0" />
            </radialGradient>
          </defs>
          <circle cx="100" cy="100" r="90" fill="url(#fiendGlow)" />
          <circle cx="100" cy="100" r="82" fill="#1c1917" stroke="#dc2626" strokeWidth="3" />
          {/* Demonic Obsidian Horns */}
          <path d="M 75 45 Q 40 20 50 5" fill="none" stroke="#b91c1c" strokeWidth="6" strokeLinecap="round" />
          <path d="M 125 45 Q 160 20 150 5" fill="none" stroke="#b91c1c" strokeWidth="6" strokeLinecap="round" />
          {/* Fiery Skull */}
          <circle cx="100" cy="65" r="23" fill="#09090b" stroke="#ef4444" strokeWidth="2" />
          <ellipse cx="91" cy="63" rx="4" ry="5" fill="#f87171" />
          <ellipse cx="109" cy="63" rx="4" ry="5" fill="#f87171" />
          {/* Chest Soul Furnace */}
          <rect x="80" y="105" width="40" height="35" rx="6" fill="#450a0a" stroke="#ef4444" strokeWidth="2" />
          <circle cx="95" cy="120" r="5" fill="#67e8f9" />
          <circle cx="105" cy="122" r="6" fill="#fca5a5" />
        </svg>
      );

    // 23. STONEWAKE (Basis: Earthshaker - The Faultline Warden)
    case 'c_earthshaker':
      return (
        <svg width={size} height={size} viewBox="0 0 200 200" className={className}>
          <defs>
            <radialGradient id="quakeGlow" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="#fef08a" stopOpacity="0.8" />
              <stop offset="70%" stopColor="#b45309" stopOpacity="0.4" />
              <stop offset="100%" stopColor="#451a03" stopOpacity="0" />
            </radialGradient>
          </defs>
          <circle cx="100" cy="100" r="90" fill="url(#quakeGlow)" />
          <circle cx="100" cy="100" r="82" fill="#292524" stroke="#d97706" strokeWidth="3" />
          {/* Beast Warden Horns */}
          <path d="M 70 45 Q 35 30 45 15" fill="none" stroke="#a16207" strokeWidth="5" strokeLinecap="round" />
          <path d="M 130 45 Q 165 30 155 15" fill="none" stroke="#a16207" strokeWidth="5" strokeLinecap="round" />
          <circle cx="100" cy="65" r="23" fill="#78716c" />
          <ellipse cx="91" cy="63" rx="3.5" ry="3" fill="#fde047" />
          <ellipse cx="109" cy="63" rx="3.5" ry="3" fill="#fde047" />
          {/* Massive Wooden Seismic Totem Log */}
          <rect x="35" y="105" width="130" height="26" rx="4" fill="#78350f" stroke="#facc15" strokeWidth="2.5" />
          <circle cx="100" cy="118" r="8" fill="#d97706" stroke="#fde047" strokeWidth="2" />
        </svg>
      );

    // 24. MIREHOOK (Basis: Pudge - The Bog Butcher)
    case 'c_mirehook':
      return (
        <svg width={size} height={size} viewBox="0 0 200 200" className={className}>
          <defs>
            <radialGradient id="rotGlow" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="#bef264" stopOpacity="0.8" />
              <stop offset="70%" stopColor="#4d7c0f" stopOpacity="0.4" />
              <stop offset="100%" stopColor="#1a2e05" stopOpacity="0" />
            </radialGradient>
          </defs>
          <circle cx="100" cy="100" r="90" fill="url(#rotGlow)" />
          <circle cx="100" cy="100" r="82" fill="#14532d" stroke="#84cc16" strokeWidth="3" />
          {/* Stitched Butcher Head */}
          <circle cx="100" cy="65" r="25" fill="#4d7c0f" />
          <line x1="88" y1="50" x2="112" y2="78" stroke="#14532d" strokeWidth="2" strokeDasharray="3 2" />
          <circle cx="91" cy="60" r="3.5" fill="#facc15" />
          <circle cx="109" cy="60" r="4.5" fill="#ef4444" />
          {/* Bloody Meat Hook */}
          <path d="M 145 90 Q 170 120 140 145 Q 120 135 135 115" fill="#e2e8f0" stroke="#ef4444" strokeWidth="3" />
          <line x1="145" y1="90" x2="120" y2="70" stroke="#94a3b8" strokeWidth="3" strokeDasharray="4 2" />
          <path d="M 65 95 L 100 115 L 135 95 L 135 165 L 65 165 Z" fill="#3f6212" stroke="#65a30d" strokeWidth="2" />
        </svg>
      );

    // 25. NULLWEAVER (Basis: Enigma - The Void Cartographer)
    case 'c_nullweaver':
      return (
        <svg width={size} height={size} viewBox="0 0 200 200" className={className}>
          <defs>
            <radialGradient id="singularityGlow" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="#c084fc" stopOpacity="0.8" />
              <stop offset="70%" stopColor="#581c87" stopOpacity="0.4" />
              <stop offset="100%" stopColor="#09090b" stopOpacity="0" />
            </radialGradient>
          </defs>
          <circle cx="100" cy="100" r="90" fill="url(#singularityGlow)" />
          <circle cx="100" cy="100" r="82" fill="#09090b" stroke="#a855f7" strokeWidth="3" />
          {/* Faceless Void Entity */}
          <circle cx="100" cy="65" r="22" fill="#2e1065" />
          <ellipse cx="92" cy="63" rx="3" ry="4" fill="#a855f7" />
          <ellipse cx="108" cy="63" rx="3" ry="4" fill="#a855f7" />
          {/* Swirling Gravitational Black Hole */}
          <circle cx="100" cy="125" r="24" fill="#000000" stroke="#c084fc" strokeWidth="3" />
          <circle cx="100" cy="125" r="16" fill="#3b0764" />
          <ellipse cx="100" cy="125" rx="38" ry="10" fill="none" stroke="#e879f9" strokeWidth="2" transform="rotate(-20 100 125)" />
        </svg>
      );

    // 26. VOLTGRIP (Basis: Blitzcrank - The Storm Automaton)
    case 'c_voltgrip':
      return (
        <svg width={size} height={size} viewBox="0 0 200 200" className={className}>
          <defs>
            <radialGradient id="voltGlow" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="#fef08a" stopOpacity="0.8" />
              <stop offset="70%" stopColor="#eab308" stopOpacity="0.4" />
              <stop offset="100%" stopColor="#713f12" stopOpacity="0" />
            </radialGradient>
          </defs>
          <circle cx="100" cy="100" r="90" fill="url(#voltGlow)" />
          <circle cx="100" cy="100" r="82" fill="#451a03" stroke="#facc15" strokeWidth="3" />
          {/* Yellow Brass Dome Head */}
          <ellipse cx="100" cy="60" rx="24" ry="20" fill="#eab308" stroke="#ca8a04" strokeWidth="2" />
          <circle cx="91" cy="58" r="4" fill="#38bdf8" />
          <circle cx="109" cy="58" r="4" fill="#38bdf8" />
          {/* Power Capacitor Core in Chest */}
          <circle cx="100" cy="115" r="14" fill="#0284c7" stroke="#38bdf8" strokeWidth="3" />
          {/* Giant Rocket Grab Fist */}
          <rect x="135" y="95" width="30" height="30" rx="6" fill="#ca8a04" stroke="#facc15" strokeWidth="2" />
          <polygon points="165,100 175,105 175,115 165,120" fill="#fde047" />
        </svg>
      );

    // 27. AETHERBOLT (Basis: Ezreal - The Relic Runner)
    case 'c_aetherbolt':
      return (
        <svg width={size} height={size} viewBox="0 0 200 200" className={className}>
          <defs>
            <radialGradient id="aetherGlow" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="#a5f3fc" stopOpacity="0.8" />
              <stop offset="70%" stopColor="#0284c7" stopOpacity="0.4" />
              <stop offset="100%" stopColor="#082f49" stopOpacity="0" />
            </radialGradient>
          </defs>
          <circle cx="100" cy="100" r="90" fill="url(#aetherGlow)" />
          <circle cx="100" cy="100" r="82" fill="#0c4a6e" stroke="#38bdf8" strokeWidth="3" />
          {/* Aviator Goggles & Golden Tousled Hair */}
          <path d="M 75 52 C 75 30, 125 30, 125 52 Z" fill="#facc15" />
          <rect x="80" y="42" width="18" height="10" rx="3" fill="#38bdf8" stroke="#0f172a" strokeWidth="1.5" />
          <rect x="102" y="42" width="18" height="10" rx="3" fill="#38bdf8" stroke="#0f172a" strokeWidth="1.5" />
          <circle cx="100" cy="65" r="21" fill="#fed7aa" />
          <ellipse cx="92" cy="63" rx="3.5" ry="3.5" fill="#0284c7" />
          <ellipse cx="108" cy="63" rx="3.5" ry="3.5" fill="#0284c7" />
          {/* Golden Mystic Gauntlet with Energy Blast */}
          <rect x="130" y="105" width="28" height="34" rx="5" fill="#eab308" stroke="#fef08a" strokeWidth="2" />
          <circle cx="144" cy="122" r="8" fill="#38bdf8" stroke="#ffffff" strokeWidth="2" />
        </svg>
      );

    // 28. CORSARA (Basis: Miss Fortune - The Scarlet Privateer)
    case 'c_corsara':
      return (
        <svg width={size} height={size} viewBox="0 0 200 200" className={className}>
          <defs>
            <radialGradient id="corsairGlow" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="#fecdd3" stopOpacity="0.8" />
              <stop offset="70%" stopColor="#e11d48" stopOpacity="0.4" />
              <stop offset="100%" stopColor="#4c0519" stopOpacity="0" />
            </radialGradient>
          </defs>
          <circle cx="100" cy="100" r="90" fill="url(#corsairGlow)" />
          <circle cx="100" cy="100" r="82" fill="#881337" stroke="#fb7185" strokeWidth="3" />
          {/* Pirate Captain Tricorn Hat */}
          <polygon points="100,22 50,45 150,45" fill="#1e1b4b" stroke="#facc15" strokeWidth="2" />
          <circle cx="100" cy="36" r="6" fill="#fb7185" />
          {/* Long Flowing Red Curls */}
          <path d="M 68 50 C 60 90, 65 140, 60 155" fill="none" stroke="#be123c" strokeWidth="12" strokeLinecap="round" />
          <path d="M 132 50 C 140 90, 135 140, 140 155" fill="none" stroke="#be123c" strokeWidth="12" strokeLinecap="round" />
          <circle cx="100" cy="65" r="21" fill="#ffe4e6" />
          <ellipse cx="91" cy="63" rx="3.5" ry="3.5" fill="#059669" />
          <ellipse cx="109" cy="63" rx="3.5" ry="3.5" fill="#059669" />
          {/* Dual Golden Flintlock Pistols */}
          <rect x="35" y="115" width="24" height="12" rx="2" fill="#ca8a04" stroke="#fde047" strokeWidth="1.5" />
          <rect x="141" y="115" width="24" height="12" rx="2" fill="#ca8a04" stroke="#fde047" strokeWidth="1.5" />
        </svg>
      );

    // 29. BREWMAW (Basis: Gragas - The Cask Colossus)
    case 'c_brewmaw':
      return (
        <svg width={size} height={size} viewBox="0 0 200 200" className={className}>
          <defs>
            <radialGradient id="brewGlow" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="#fef08a" stopOpacity="0.8" />
              <stop offset="70%" stopColor="#d97706" stopOpacity="0.4" />
              <stop offset="100%" stopColor="#451a03" stopOpacity="0" />
            </radialGradient>
          </defs>
          <circle cx="100" cy="100" r="90" fill="url(#brewGlow)" />
          <circle cx="100" cy="100" r="82" fill="#451a03" stroke="#f59e0b" strokeWidth="3" />
          {/* Huge Braided Ginger Beard */}
          <circle cx="100" cy="65" r="24" fill="#fed7aa" />
          <path d="M 75 68 C 75 110, 125 110, 125 68 Z" fill="#ea580c" />
          <ellipse cx="91" cy="60" rx="3.5" ry="3" fill="#451a03" />
          <ellipse cx="109" cy="60" rx="3.5" ry="3" fill="#451a03" />
          {/* Massive Wooden Brew Cask */}
          <ellipse cx="140" cy="130" rx="24" ry="28" fill="#78350f" stroke="#f59e0b" strokeWidth="2.5" />
          <line x1="120" y1="130" x2="160" y2="130" stroke="#facc15" strokeWidth="2" />
          {/* Spilled Froth */}
          <circle cx="140" cy="104" r="6" fill="#fef08a" />
        </svg>
      );

    // 30. WRAITHHOOK (Basis: Thresh - The Lantern Collector)
    case 'c_wraithhook':
      return (
        <svg width={size} height={size} viewBox="0 0 200 200" className={className}>
          <defs>
            <radialGradient id="wraithGlow" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="#a7f3d0" stopOpacity="0.8" />
              <stop offset="70%" stopColor="#059669" stopOpacity="0.4" />
              <stop offset="100%" stopColor="#022c22" stopOpacity="0" />
            </radialGradient>
          </defs>
          <circle cx="100" cy="100" r="90" fill="url(#wraithGlow)" />
          <circle cx="100" cy="100" r="82" fill="#022c22" stroke="#34d399" strokeWidth="3" />
          {/* Spectral Flaming Skull */}
          <path d="M 72 45 C 72 20, 128 20, 128 45 L 120 85 L 80 85 Z" fill="#064e3b" />
          <circle cx="100" cy="65" r="21" fill="#022c22" stroke="#34d399" strokeWidth="2" />
          <ellipse cx="91" cy="63" rx="4" ry="5" fill="#34d399" />
          <ellipse cx="109" cy="63" rx="4" ry="5" fill="#34d399" />
          {/* Green Soul Lantern */}
          <polygon points="45,95 65,95 60,130 50,130" fill="#064e3b" stroke="#34d399" strokeWidth="2" />
          <circle cx="55" cy="112" r="7" fill="#6ee7b7" />
          {/* Hooked Scythe Chain */}
          <path d="M 140 100 Q 165 115 150 140" fill="none" stroke="#6ee7b7" strokeWidth="4" strokeLinecap="round" />
        </svg>
      );

    // 31. KAELEN (Basis: Invoker - The Arsenal Prodigy)
    case 'c_invoker':
      return (
        <svg width={size} height={size} viewBox="0 0 200 200" className={className}>
          <defs>
            <radialGradient id="arsenalGlow" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="#fef08a" stopOpacity="0.8" />
              <stop offset="70%" stopColor="#f59e0b" stopOpacity="0.4" />
              <stop offset="100%" stopColor="#78350f" stopOpacity="0" />
            </radialGradient>
          </defs>
          <circle cx="100" cy="100" r="90" fill="url(#arsenalGlow)" />
          <circle cx="100" cy="100" r="82" fill="#18181b" stroke="#f59e0b" strokeWidth="3" />
          {/* High Regal Cape & Mantle */}
          <path d="M 50 160 L 70 85 L 100 95 L 130 85 L 150 160 Z" fill="#b45309" stroke="#fde047" strokeWidth="2" />
          {/* Face and Flowing Blonde Hair */}
          <path d="M 75 55 C 70 25, 130 25, 125 55 L 120 75 L 80 75 Z" fill="#fde047" />
          <circle cx="100" cy="65" r="20" fill="#fed7aa" />
          <line x1="92" y1="64" x2="98" y2="64" stroke="#eab308" strokeWidth="3" strokeLinecap="round" />
          <line x1="102" y1="64" x2="108" y2="64" stroke="#eab308" strokeWidth="3" strokeLinecap="round" />
          {/* Tri-Elemental Orbs: Quas (Blue), Wex (Purple), Exort (Orange) */}
          <circle cx="55" cy="50" r="13" fill="#38bdf8" stroke="#ffffff" strokeWidth="2" />
          <circle cx="145" cy="50" r="13" fill="#a855f7" stroke="#ffffff" strokeWidth="2" />
          <circle cx="100" cy="24" r="13" fill="#f97316" stroke="#ffffff" strokeWidth="2" />
        </svg>
      );

    // 32. HWEILIN (Basis: Hwei - The Ink Visionary)
    case 'c_hwei':
      return (
        <svg width={size} height={size} viewBox="0 0 200 200" className={className}>
          <defs>
            <radialGradient id="inkGlow" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="#a5f3fc" stopOpacity="0.8" />
              <stop offset="70%" stopColor="#06b6d4" stopOpacity="0.4" />
              <stop offset="100%" stopColor="#083344" stopOpacity="0" />
            </radialGradient>
          </defs>
          <circle cx="100" cy="100" r="90" fill="url(#inkGlow)" />
          <circle cx="100" cy="100" r="82" fill="#082f49" stroke="#22d3ee" strokeWidth="3" />
          {/* Swirling Calligraphic Ink Splashes */}
          <path d="M 40 130 Q 70 80 120 95 Q 160 110 155 145" fill="none" stroke="#a855f7" strokeWidth="6" strokeLinecap="round" opacity="0.7" />
          <path d="M 60 70 Q 110 50 140 80" fill="none" stroke="#f59e0b" strokeWidth="4" strokeLinecap="round" opacity="0.7" />
          {/* Hooded Figure */}
          <path d="M 75 50 C 75 30, 125 30, 125 50 L 130 95 L 70 95 Z" fill="#0f172a" stroke="#38bdf8" strokeWidth="1.5" />
          <circle cx="100" cy="65" r="18" fill="#e2e8f0" />
          {/* Glowing Paintbrush */}
          <line x1="130" y1="160" x2="165" y2="55" stroke="#78350f" strokeWidth="5" strokeLinecap="round" />
          <polygon points="165,55 160,40 172,44" fill="#06b6d4" stroke="#ffffff" strokeWidth="1.5" />
        </svg>
      );

    // 33. JAXON (Basis: Jayce - The Hextech Vanguard)
    case 'c_jayce':
      return (
        <svg width={size} height={size} viewBox="0 0 200 200" className={className}>
          <defs>
            <radialGradient id="hexGlow" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="#bae6fd" stopOpacity="0.8" />
              <stop offset="70%" stopColor="#0284c7" stopOpacity="0.4" />
              <stop offset="100%" stopColor="#082f49" stopOpacity="0" />
            </radialGradient>
          </defs>
          <circle cx="100" cy="100" r="90" fill="url(#hexGlow)" />
          <circle cx="100" cy="100" r="82" fill="#0c4a6e" stroke="#38bdf8" strokeWidth="3" />
          {/* Polished Vanguard Armor */}
          <path d="M 70 80 L 100 90 L 130 80 L 125 155 L 75 155 Z" fill="#64748b" stroke="#e0f2fe" strokeWidth="2" />
          <circle cx="100" cy="115" r="11" fill="#38bdf8" stroke="#ffffff" strokeWidth="2" />
          {/* Heroic Portrait */}
          <circle cx="100" cy="58" r="21" fill="#fed7aa" />
          <path d="M 80 48 C 80 30, 120 30, 120 48 L 115 58 L 85 58 Z" fill="#78350f" />
          {/* Massive Hextech Hammer Head */}
          <rect x="135" y="65" width="28" height="42" rx="4" fill="#94a3b8" stroke="#38bdf8" strokeWidth="2.5" />
          <line x1="149" y1="65" x2="149" y2="107" stroke="#38bdf8" strokeWidth="4" />
          <line x1="149" y1="107" x2="135" y2="165" stroke="#475569" strokeWidth="6" strokeLinecap="round" />
        </svg>
      );

    // 34. VALERIE (Basis: Vi - The Piltover Enforcer)
    case 'c_vi':
      return (
        <svg width={size} height={size} viewBox="0 0 200 200" className={className}>
          <defs>
            <radialGradient id="enforcerGlow" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="#fbcfe8" stopOpacity="0.8" />
              <stop offset="70%" stopColor="#ec4899" stopOpacity="0.4" />
              <stop offset="100%" stopColor="#831843" stopOpacity="0" />
            </radialGradient>
          </defs>
          <circle cx="100" cy="100" r="90" fill="url(#enforcerGlow)" />
          <circle cx="100" cy="100" r="82" fill="#500724" stroke="#f43f5e" strokeWidth="3" />
          {/* Pink Punk Hair & Goggles */}
          <circle cx="100" cy="62" r="22" fill="#fed7aa" />
          <path d="M 75 52 C 70 20, 115 20, 125 45 L 110 65 L 75 60 Z" fill="#ec4899" />
          <rect x="88" y="44" width="24" height="9" rx="3" fill="#334155" stroke="#facc15" strokeWidth="2" />
          {/* Massive Mechanical Atlas Gauntlet */}
          <rect x="35" y="85" width="46" height="60" rx="8" fill="#d97706" stroke="#facc15" strokeWidth="3" />
          <rect x="42" y="95" width="32" height="18" rx="3" fill="#f43f5e" />
          <circle cx="58" cy="125" r="7" fill="#38bdf8" stroke="#ffffff" strokeWidth="1.5" />
        </svg>
      );

    // 35. JINXY (Basis: Jinx - The Loose Cannon)
    case 'c_jinx':
      return (
        <svg width={size} height={size} viewBox="0 0 200 200" className={className}>
          <defs>
            <radialGradient id="chaosGlow" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="#bfdbfe" stopOpacity="0.8" />
              <stop offset="70%" stopColor="#3b82f6" stopOpacity="0.4" />
              <stop offset="100%" stopColor="#1e3a8a" stopOpacity="0" />
            </radialGradient>
          </defs>
          <circle cx="100" cy="100" r="90" fill="url(#chaosGlow)" />
          <circle cx="100" cy="100" r="82" fill="#172554" stroke="#f43f5e" strokeWidth="3" />
          {/* Long Twin Blue Braids */}
          <path d="M 80 50 Q 50 100 45 160" fill="none" stroke="#38bdf8" strokeWidth="7" strokeLinecap="round" />
          <path d="M 120 50 Q 150 100 155 160" fill="none" stroke="#38bdf8" strokeWidth="7" strokeLinecap="round" />
          <circle cx="100" cy="60" r="21" fill="#ffe4e6" />
          <ellipse cx="94" cy="58" rx="4" ry="4" fill="#ec4899" />
          <ellipse cx="106" cy="58" rx="4" ry="4" fill="#ec4899" />
          <path d="M 92 70 Q 100 78 108 70" fill="none" stroke="#be123c" strokeWidth="2.5" strokeLinecap="round" />
          {/* Sharkmouth Fishbones Rocket Launcher */}
          <rect x="110" y="85" width="48" height="24" rx="4" fill="#334155" stroke="#f43f5e" strokeWidth="2" />
          <polygon points="158,85 174,97 158,109" fill="#f43f5e" />
          <circle cx="130" cy="97" r="5" fill="#facc15" />
        </svg>
      );

    // 36. PAXI (Basis: Puck - The Faerie Dragon)
    case 'c_puck':
      return (
        <svg width={size} height={size} viewBox="0 0 200 200" className={className}>
          <defs>
            <radialGradient id="faerieGlow" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="#a7f3d0" stopOpacity="0.8" />
              <stop offset="70%" stopColor="#10b981" stopOpacity="0.4" />
              <stop offset="100%" stopColor="#064e3b" stopOpacity="0" />
            </radialGradient>
          </defs>
          <circle cx="100" cy="100" r="90" fill="url(#faerieGlow)" />
          <circle cx="100" cy="100" r="82" fill="#022c22" stroke="#34d399" strokeWidth="3" />
          {/* Iridescent Faerie Wings */}
          <path d="M 100 80 Q 40 40 35 90 Q 60 120 100 100" fill="#67e8f9" opacity="0.6" stroke="#ffffff" strokeWidth="1.5" />
          <path d="M 100 80 Q 160 40 165 90 Q 140 120 100 100" fill="#67e8f9" opacity="0.6" stroke="#ffffff" strokeWidth="1.5" />
          {/* Cute Dragon Head with Antenna Curls */}
          <circle cx="100" cy="85" r="24" fill="#34d399" stroke="#059669" strokeWidth="2" />
          <ellipse cx="90" cy="80" rx="6" ry="7" fill="#facc15" />
          <ellipse cx="110" cy="80" rx="6" ry="7" fill="#facc15" />
          <circle cx="90" cy="80" r="3" fill="#0f172a" />
          <circle cx="110" cy="80" r="3" fill="#0f172a" />
          <path d="M 88 65 Q 80 40 70 50" fill="none" stroke="#facc15" strokeWidth="3" strokeLinecap="round" />
          <path d="M 112 65 Q 120 40 130 50" fill="none" stroke="#facc15" strokeWidth="3" strokeLinecap="round" />
        </svg>
      );

    // 37. BATRIX (Basis: Batrider - The Flame Rider)
    case 'c_batrider':
      return (
        <svg width={size} height={size} viewBox="0 0 200 200" className={className}>
          <defs>
            <radialGradient id="lassoGlow" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="#fed7aa" stopOpacity="0.8" />
              <stop offset="70%" stopColor="#f97316" stopOpacity="0.4" />
              <stop offset="100%" stopColor="#7c2d12" stopOpacity="0" />
            </radialGradient>
          </defs>
          <circle cx="100" cy="100" r="90" fill="url(#lassoGlow)" />
          <circle cx="100" cy="100" r="82" fill="#431407" stroke="#fb923c" strokeWidth="3" />
          {/* Giant Flying Bat Wings */}
          <path d="M 100 110 L 35 80 L 50 120 L 75 110 L 100 130 L 125 110 L 150 120 L 165 80 Z" fill="#1c1917" stroke="#f97316" strokeWidth="2" />
          {/* Bat Head with Fangs */}
          <circle cx="100" cy="105" r="16" fill="#292524" />
          <polygon points="92,95 86,80 96,88" fill="#78716c" />
          <polygon points="108,95 114,80 104,88" fill="#78716c" />
          {/* Fiery Molten Lasso Swirling Overhead */}
          <ellipse cx="100" cy="45" rx="35" ry="15" fill="none" stroke="#ef4444" strokeWidth="4" />
          <ellipse cx="100" cy="45" rx="32" ry="12" fill="none" stroke="#fbbf24" strokeWidth="2" strokeDasharray="6,4" />
        </svg>
      );

    // 38. QUILLBACK (Basis: Bristleback - The Barbed Brawler)
    case 'c_bristleback':
      return (
        <svg width={size} height={size} viewBox="0 0 200 200" className={className}>
          <defs>
            <radialGradient id="quillGlow" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="#d9f99d" stopOpacity="0.8" />
              <stop offset="70%" stopColor="#84cc16" stopOpacity="0.4" />
              <stop offset="100%" stopColor="#365314" stopOpacity="0" />
            </radialGradient>
          </defs>
          <circle cx="100" cy="100" r="90" fill="url(#quillGlow)" />
          <circle cx="100" cy="100" r="82" fill="#14532d" stroke="#a3e635" strokeWidth="3" />
          {/* Spined Armored Carapace */}
          <path d="M 60 70 L 40 40 L 70 55 L 80 25 L 100 50 L 120 25 L 130 55 L 160 40 L 140 70 Z" fill="#65a30d" stroke="#facc15" strokeWidth="2.5" />
          {/* Boar Face with Tusks */}
          <circle cx="100" cy="95" r="28" fill="#84cc16" stroke="#4d7c0f" strokeWidth="3" />
          <ellipse cx="100" cy="105" rx="14" ry="9" fill="#4d7c0f" />
          <polygon points="80,110 70,95 85,102" fill="#fef08a" stroke="#ca8a04" strokeWidth="1.5" />
          <polygon points="120,110 130,95 115,102" fill="#fef08a" stroke="#ca8a04" strokeWidth="1.5" />
          <circle cx="90" cy="90" r="4" fill="#1e293b" />
          <circle cx="110" cy="90" r="4" fill="#1e293b" />
        </svg>
      );

    // 39. AETHERIS (Basis: Io - The Harmonic Spark)
    case 'c_io':
      return (
        <svg width={size} height={size} viewBox="0 0 200 200" className={className}>
          <defs>
            <radialGradient id="wispGlow" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="#ffffff" stopOpacity="1" />
              <stop offset="40%" stopColor="#38bdf8" stopOpacity="0.8" />
              <stop offset="80%" stopColor="#0284c7" stopOpacity="0.3" />
              <stop offset="100%" stopColor="#082f49" stopOpacity="0" />
            </radialGradient>
          </defs>
          <circle cx="100" cy="100" r="90" fill="url(#wispGlow)" />
          <circle cx="100" cy="100" r="82" fill="#0369a1" stroke="#e0f2fe" strokeWidth="3" />
          {/* Concentric Pulsing Energy Rings */}
          <circle cx="100" cy="100" r="55" fill="none" stroke="#bae6fd" strokeWidth="2" strokeDasharray="6,6" />
          <circle cx="100" cy="100" r="35" fill="none" stroke="#ffffff" strokeWidth="3" />
          {/* Core Pulsar */}
          <circle cx="100" cy="100" r="22" fill="#ffffff" />
          {/* 5 Orbiting Energy Wisps */}
          <circle cx="65" cy="70" r="8" fill="#7dd3fc" stroke="#ffffff" strokeWidth="1.5" />
          <circle cx="135" cy="70" r="8" fill="#7dd3fc" stroke="#ffffff" strokeWidth="1.5" />
          <circle cx="145" cy="130" r="8" fill="#7dd3fc" stroke="#ffffff" strokeWidth="1.5" />
          <circle cx="55" cy="130" r="8" fill="#7dd3fc" stroke="#ffffff" strokeWidth="1.5" />
          <circle cx="100" cy="155" r="8" fill="#7dd3fc" stroke="#ffffff" strokeWidth="1.5" />
        </svg>
      );

    case 'c_stepstone':
      return (
        <svg width={size} height={size} viewBox="0 0 200 200" className={className}>
          <defs>
            <radialGradient id="stepstoneGlow" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="#fde68a" stopOpacity="0.85" />
              <stop offset="72%" stopColor="#22c55e" stopOpacity="0.35" />
              <stop offset="100%" stopColor="#052e16" stopOpacity="0" />
            </radialGradient>
          </defs>
          <circle cx="100" cy="100" r="90" fill="url(#stepstoneGlow)" />
          <circle cx="100" cy="100" r="82" fill="#052e16" stroke="#4ade80" strokeWidth="3" />
          <path d="M45 126 Q55 82 78 87 L100 99 L122 87 Q145 82 155 126 L141 154 L59 154 Z" fill="#166534" stroke="#86efac" strokeWidth="3" />
          <circle cx="100" cy="67" r="25" fill="#d6a47a" />
          <path d="M75 64 Q79 35 100 39 Q122 38 126 63 L113 57 L88 57 Z" fill="#1f2937" stroke="#facc15" strokeWidth="3" />
          <path d="M79 60 Q100 70 121 60" fill="none" stroke="#facc15" strokeWidth="5" />
          <circle cx="91" cy="68" r="3" fill="#111827" />
          <circle cx="109" cy="68" r="3" fill="#111827" />
          <path d="M79 106 L58 119 L49 106 L65 95 Z M121 106 L142 119 L151 106 L135 95 Z" fill="#facc15" stroke="#fef3c7" strokeWidth="2" />
          <path d="M83 132 L100 120 L117 132 L100 145 Z" fill="#14532d" stroke="#fef08a" strokeWidth="2" />
        </svg>
      );

    case 'c_skybreaker':
      return (
        <svg width={size} height={size} viewBox="0 0 200 200" className={className}>
          <defs>
            <radialGradient id="skybreakerGlow" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="#bfdbfe" stopOpacity="0.9" />
              <stop offset="72%" stopColor="#2563eb" stopOpacity="0.35" />
              <stop offset="100%" stopColor="#172554" stopOpacity="0" />
            </radialGradient>
          </defs>
          <circle cx="100" cy="100" r="90" fill="url(#skybreakerGlow)" />
          <circle cx="100" cy="100" r="82" fill="#172554" stroke="#60a5fa" strokeWidth="3" />
          <path d="M49 126 Q58 83 78 87 L100 101 L122 87 Q143 83 152 126 L139 153 L61 153 Z" fill="#1e40af" stroke="#93c5fd" strokeWidth="3" />
          <circle cx="100" cy="70" r="24" fill="#e2b38d" />
          <path d="M76 69 Q78 42 100 42 Q123 42 124 70 L113 60 L87 60 Z" fill="#334155" stroke="#f97316" strokeWidth="3" />
          <path d="M84 72 Q100 79 116 72" fill="none" stroke="#0f172a" strokeWidth="5" />
          <circle cx="91" cy="68" r="3" fill="#0f172a" />
          <circle cx="109" cy="68" r="3" fill="#0f172a" />
          <path d="M42 48 L158 48 M57 37 L143 59" stroke="#bfdbfe" strokeWidth="5" strokeLinecap="round" />
          <circle cx="100" cy="48" r="8" fill="#f97316" stroke="#fed7aa" strokeWidth="2" />
          <path d="M122 110 L166 101 L169 112 L126 123 Z" fill="#475569" stroke="#fb923c" strokeWidth="3" />
          <circle cx="161" cy="108" r="6" fill="#fb923c" />
          <circle cx="69" cy="126" r="7" fill="#f97316" />
          <circle cx="131" cy="126" r="7" fill="#f97316" />
        </svg>
      );

    // DEFAULT FALLBACK (Elite Esports Crest)
    default:
      return (
        <svg width={size} height={size} viewBox="0 0 200 200" className={className}>
          <circle cx="100" cy="100" r="82" fill="#0f172a" stroke="#6366f1" strokeWidth="3" />
          <polygon points="100,45 140,80 125,145 75,145 60,80" fill="#1e1b4b" stroke="#818cf8" strokeWidth="2" />
          <circle cx="100" cy="100" r="16" fill="#6366f1" />
        </svg>
      );
  }
};
