// Dedicated Procedural TFT Chibi Champion Sprite Renderer
// Renders high-fidelity TFT Chibi champions: Solana, Astra, Kyumi, Buck, and Valkira
// Matching the chibi reference with expressive anime eyes, oversized signature weapons, and dynamic effects!

export interface FighterVisualState {
  championName: string;
  x: number;
  y: number;
  facing: 'left' | 'right';
  animState: 'idle' | 'walk' | 'attack' | 'cast' | 'dead';
  animTime: number;
  team: 'blue' | 'red';
  isStunned: boolean;
  isCharmed: boolean;
  isFeared?: boolean;
  isKnockedUp?: boolean;
  knockupHeight?: number;
  isInBush: boolean;
}

export function drawChampionSprite(ctx: CanvasRenderingContext2D, state: FighterVisualState) {
  const { championName, x, y, facing, animState, animTime, team, isStunned, isCharmed, isFeared, isKnockedUp, knockupHeight = 0, isInBush } = state;

  ctx.save();
  ctx.translate(x, y);

  if (isInBush) {
    ctx.globalAlpha = 0.55;
  }

  // Flip horizontally if facing left
  if (facing === 'left') {
    ctx.scale(-1, 1);
  }

  // Walking bounce / breathing
  const bob = animState === 'walk' ? Math.abs(Math.sin(animTime * 12)) * 3 : Math.sin(animTime * 3) * 1.2;
  const attackRecoil = animState === 'attack' ? -3 : 0;

  // Ground drop shadow
  ctx.fillStyle = 'rgba(0, 0, 0, 0.45)';
  ctx.beginPath();
  ctx.ellipse(0, 4, 17, 6.5, 0, 0, Math.PI * 2);
  ctx.fill();

  // Team Ring on ground
  ctx.strokeStyle = team === 'blue' ? '#38bdf8' : '#f43f5e';
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.ellipse(0, 4, 19, 7.5, 0, 0, Math.PI * 2);
  ctx.stroke();

  ctx.translate(attackRecoil, -bob - knockupHeight);

  switch (championName) {
    case 'Solana':
      drawChibiSolana(ctx, animState, animTime);
      break;
    case 'Astra':
      drawChibiAstra(ctx, animState, animTime);
      break;
    case 'Kyumi':
      drawChibiKyumi(ctx, animState, animTime);
      break;
    case 'Buck':
      drawChibiBuck(ctx, animState, animTime);
      break;
    case 'Valkira':
      drawChibiValkira(ctx, animState, animTime);
      break;
    case 'Kage':
      drawChibiKage(ctx, animState, animTime);
      break;
    case 'Kazemaru':
      drawChibiKazemaru(ctx, animState, animTime);
      break;
    case 'Kindra':
    case 'Kindra & Grim':
      drawChibiKindra(ctx, animState, animTime);
      break;
    case 'Cora':
      drawChibiCora(ctx, animState, animTime);
      break;
    case 'Renn':
      drawChibiRenn(ctx, animState, animTime);
      break;
    case 'Sylla':
      drawChibiSylla(ctx, animState, animTime);
      break;
    case 'Tequoia':
      drawChibiTequoia(ctx, animState, animTime);
      break;
    case 'Zal':
      drawChibiZal(ctx, animState, animTime);
      break;
    case 'Xin':
      drawChibiXin(ctx, animState, animTime);
      break;
    case 'Raijin':
      drawChibiRaijin(ctx, animState, animTime);
      break;
    case 'Kaolin':
      drawChibiKaolin(ctx, animState, animTime);
      break;
    case 'Inai':
      drawChibiInai(ctx, animState, animTime);
      break;
    case 'Veyara': case 'Cinderlock': case 'Solenne': case 'Croakwell': case 'Soulscourge': case 'Stonewake':
    case 'Mirehook': case 'Nullweaver': case 'Voltgrip': case 'Aetherbolt': case 'Corsara': case 'Brewmaw': case 'Wraithhook':
      drawNewChampionSprite(ctx, championName, animState, animTime);
      break;
    case 'Kaelen': case 'c_kaelen':
      drawChibiKaelen(ctx, animState, animTime);
      break;
    case 'Hweilin': case 'c_hwei':
      drawChibiHweilin(ctx, animState, animTime);
      break;
    case 'Jaxon': case 'c_jayce':
      drawChibiJaxon(ctx, animState, animTime);
      break;
    case 'Valerie': case 'c_vi':
      drawChibiValerie(ctx, animState, animTime);
      break;
    case 'Jinxy': case 'c_jinx':
      drawChibiJinxy(ctx, animState, animTime);
      break;
    case 'Paxi': case 'c_puck':
      drawChibiPaxi(ctx, animState, animTime);
      break;
    case 'Batrix': case 'c_batrider':
      drawChibiBatrix(ctx, animState, animTime);
      break;
    case 'Quillback': case 'c_bristleback':
      drawChibiQuillback(ctx, animState, animTime);
      break;
    case 'Aetheris': case 'c_io':
      drawChibiAetheris(ctx, animState, animTime);
      break;
    default:
      drawDefaultChampion(ctx, team);
      break;
  }

  ctx.restore();

  // Status Overlays
  if (isKnockedUp) {
    ctx.save();
    ctx.fillStyle = '#67e8f9';
    ctx.font = 'bold 11px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('🌪️ AIRBORNE', x, y - 56 - knockupHeight);
    ctx.restore();
  } else if (isFeared) {
    ctx.save();
    ctx.fillStyle = '#fda4af';
    ctx.font = 'bold 11px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('💀 FEARED', x, y - 50);
    ctx.restore();
  } else if (isStunned) {
    ctx.save();
    ctx.fillStyle = '#fde047';
    ctx.font = 'bold 11px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('💫 STUNNED', x, y - 50);
    ctx.restore();
  } else if (isCharmed) {
    ctx.save();
    ctx.fillStyle = '#f472b6';
    ctx.font = 'bold 11px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('💖 CHARMED', x, y - 50);
    ctx.restore();
  } else if (isInBush) {
    ctx.save();
    ctx.fillStyle = '#86efac';
    ctx.font = 'bold 9px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('🌿 HIDDEN', x, y - 50);
    ctx.restore();
  }
}

// =========================================================================
// 1. SOLANA: TFT CHIBI SUN PALADIN
// Sparkling Golden Anime Eyes, Solar Halo Tiara, Radiant Sun Shield & Zenith Spear
// =========================================================================
function drawChibiSolana(ctx: CanvasRenderingContext2D, animState: string, animTime: number) {
  // Royal Crimson/Gold Cape
  ctx.save();
  ctx.fillStyle = '#b45309';
  ctx.beginPath();
  ctx.moveTo(-10, -18);
  ctx.lineTo(-20, 2);
  ctx.lineTo(-4, 4);
  ctx.closePath();
  ctx.fill();
  ctx.restore();

  // Flowing Chestnut Ponytail Behind
  ctx.fillStyle = '#78350f';
  ctx.beginPath();
  ctx.moveTo(-6, -26);
  ctx.quadraticCurveTo(-18, -20, -18, -4);
  ctx.quadraticCurveTo(-10, -10, -4, -20);
  ctx.fill();

  // Cute Chibi Boots & Greaves
  ctx.fillStyle = '#d97706';
  ctx.fillRect(-7, -4, 5, 8);
  ctx.fillRect(2, -4, 5, 8);
  ctx.fillStyle = '#f59e0b';
  ctx.fillRect(-8, 0, 6, 4);
  ctx.fillRect(1, 0, 6, 4);

  // Golden Cuirass & White/Gold Tunic
  ctx.fillStyle = '#f59e0b';
  ctx.beginPath();
  ctx.roundRect(-8, -20, 16, 17, 4);
  ctx.fill();
  // Solar Crest on Breastplate
  ctx.fillStyle = '#fef08a';
  ctx.beginPath();
  ctx.arc(0, -13, 3.5, 0, Math.PI * 2);
  ctx.fill();
  // Red Sash
  ctx.fillStyle = '#dc2626';
  ctx.fillRect(-8, -9, 16, 2.5);

  // Big Cute Chibi Head
  ctx.fillStyle = '#ffedd5';
  ctx.beginPath();
  ctx.arc(0, -29, 13, 0, Math.PI * 2);
  ctx.fill();

  // Soft Rosy Cheeks
  ctx.fillStyle = 'rgba(244, 114, 182, 0.4)';
  ctx.beginPath();
  ctx.arc(-7, -26, 3, 0, Math.PI * 2);
  ctx.arc(7, -26, 3, 0, Math.PI * 2);
  ctx.fill();

  // Sparkling Golden Anime Eyes
  // Left Eye
  ctx.fillStyle = '#78350f';
  ctx.beginPath();
  ctx.ellipse(-5, -29, 3.2, 4.2, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#f59e0b';
  ctx.beginPath();
  ctx.ellipse(-5, -28, 2.2, 3, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.arc(-6, -30.5, 1.2, 0, Math.PI * 2);
  ctx.arc(-4, -27.5, 0.7, 0, Math.PI * 2);
  ctx.fill();

  // Right Eye
  ctx.fillStyle = '#78350f';
  ctx.beginPath();
  ctx.ellipse(5, -29, 3.2, 4.2, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#f59e0b';
  ctx.beginPath();
  ctx.ellipse(5, -28, 2.2, 3, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.arc(4, -30.5, 1.2, 0, Math.PI * 2);
  ctx.arc(6, -27.5, 0.7, 0, Math.PI * 2);
  ctx.fill();

  // Cute Smile
  ctx.strokeStyle = '#b45309';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.arc(0, -24, 2, 0.2, Math.PI - 0.2);
  ctx.stroke();

  // Front Bangs
  ctx.fillStyle = '#92400e';
  ctx.beginPath();
  ctx.moveTo(-13, -34);
  ctx.quadraticCurveTo(-6, -37, 0, -33);
  ctx.quadraticCurveTo(6, -37, 13, -34);
  ctx.quadraticCurveTo(10, -42, 0, -42);
  ctx.quadraticCurveTo(-10, -42, -13, -34);
  ctx.fill();

  // Golden Solar Halo Tiara Crown
  ctx.fillStyle = '#fde047';
  ctx.beginPath();
  ctx.moveTo(0, -46);
  ctx.lineTo(3, -38);
  ctx.lineTo(-3, -38);
  ctx.closePath();
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(7, -43);
  ctx.lineTo(8, -37);
  ctx.lineTo(3, -37);
  ctx.closePath();
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(-7, -43);
  ctx.lineTo(-3, -37);
  ctx.lineTo(-8, -37);
  ctx.closePath();
  ctx.fill();

  // RADIANT SUN SHIELD (Left Hand)
  ctx.save();
  ctx.translate(-11, -14);
  ctx.fillStyle = '#f59e0b';
  ctx.strokeStyle = '#fef08a';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(-9, -16);
  ctx.lineTo(9, -16);
  ctx.lineTo(13, 10);
  ctx.lineTo(0, 20);
  ctx.lineTo(-13, 10);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  // Sunburst Core with Pulsing Glow
  ctx.fillStyle = '#fef08a';
  ctx.shadowColor = '#fde047';
  ctx.shadowBlur = 8;
  ctx.beginPath();
  ctx.arc(0, 0, 5, 0, Math.PI * 2);
  ctx.fill();
  ctx.shadowBlur = 0;
  ctx.restore();

  // ZENITH SPEAR (Right Hand)
  const spearThrust = animState === 'attack' ? 14 : 0;
  ctx.save();
  ctx.translate(8 + spearThrust, -13);
  ctx.strokeStyle = '#78350f';
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.moveTo(-10, 12);
  ctx.lineTo(24, -18);
  ctx.stroke();

  // Sun Spear Blade
  ctx.fillStyle = '#fde047';
  ctx.shadowColor = '#f59e0b';
  ctx.shadowBlur = 10;
  ctx.beginPath();
  ctx.moveTo(24, -18);
  ctx.lineTo(34, -25);
  ctx.lineTo(22, -12);
  ctx.closePath();
  ctx.fill();
  ctx.shadowBlur = 0;
  ctx.restore();
}

// =========================================================================
// 2. ASTRA: TFT CHIBI FROST SOVEREIGN
// Sapphire Eyes, White Twin Braids, Plush Fur Hood & True Ice Crystal Longbow
// =========================================================================
function drawChibiAstra(ctx: CanvasRenderingContext2D, animState: string, animTime: number) {
  // Royal Blue Cape with Fur Trim
  ctx.fillStyle = '#0369a1';
  ctx.beginPath();
  ctx.moveTo(-9, -18);
  ctx.lineTo(-18, 4);
  ctx.lineTo(2, 4);
  ctx.closePath();
  ctx.fill();

  // Long White Braids Hanging on sides
  ctx.fillStyle = '#f8fafc';
  ctx.beginPath();
  ctx.roundRect(-14, -26, 5, 24, 2.5);
  ctx.roundRect(9, -26, 5, 24, 2.5);
  ctx.fill();
  // Braid bands
  ctx.fillStyle = '#38bdf8';
  ctx.fillRect(-14, -8, 5, 2);
  ctx.fillRect(9, -8, 5, 2);

  // Cute Boots & Tunic
  ctx.fillStyle = '#0c4a6e';
  ctx.fillRect(-6, -4, 5, 8);
  ctx.fillRect(1, -4, 5, 8);

  // Sapphire Frost Tunic with Fur Collar
  ctx.fillStyle = '#0284c7';
  ctx.fillRect(-7, -20, 14, 17);
  ctx.fillStyle = '#e0f2fe'; // Plush fur collar
  ctx.beginPath();
  ctx.roundRect(-9, -22, 18, 5, 2);
  ctx.fill();

  // Big Cute Chibi Head
  ctx.fillStyle = '#ffe4e6';
  ctx.beginPath();
  ctx.arc(0, -29, 13, 0, Math.PI * 2);
  ctx.fill();

  // Soft Pink Cheeks
  ctx.fillStyle = 'rgba(244, 114, 182, 0.45)';
  ctx.beginPath();
  ctx.arc(-7, -26, 3, 0, Math.PI * 2);
  ctx.arc(7, -26, 3, 0, Math.PI * 2);
  ctx.fill();

  // Sparkling Sapphire Anime Eyes
  // Left Eye
  ctx.fillStyle = '#0369a1';
  ctx.beginPath();
  ctx.ellipse(-5, -29, 3.2, 4.2, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#38bdf8';
  ctx.beginPath();
  ctx.ellipse(-5, -28, 2.2, 3, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.arc(-6, -30.5, 1.2, 0, Math.PI * 2);
  ctx.arc(-4, -27.5, 0.7, 0, Math.PI * 2);
  ctx.fill();

  // Right Eye
  ctx.fillStyle = '#0369a1';
  ctx.beginPath();
  ctx.ellipse(5, -29, 3.2, 4.2, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#38bdf8';
  ctx.beginPath();
  ctx.ellipse(5, -28, 2.2, 3, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.arc(4, -30.5, 1.2, 0, Math.PI * 2);
  ctx.arc(6, -27.5, 0.7, 0, Math.PI * 2);
  ctx.fill();

  // Cute Smile
  ctx.strokeStyle = '#0284c7';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.arc(0, -24, 2, 0.2, Math.PI - 0.2);
  ctx.stroke();

  // Flowing White Bangs
  ctx.fillStyle = '#f8fafc';
  ctx.beginPath();
  ctx.moveTo(-13, -34);
  ctx.quadraticCurveTo(-6, -37, 0, -33);
  ctx.quadraticCurveTo(6, -37, 13, -34);
  ctx.quadraticCurveTo(10, -42, 0, -42);
  ctx.quadraticCurveTo(-10, -42, -13, -34);
  ctx.fill();

  // Frost Crystal Tiara Crown
  ctx.fillStyle = '#38bdf8';
  ctx.beginPath();
  ctx.moveTo(0, -44);
  ctx.lineTo(4, -38);
  ctx.lineTo(-4, -38);
  ctx.closePath();
  ctx.fill();

  // TRUE ICE CRYSTAL LONGBOW (Right Hand)
  ctx.save();
  ctx.translate(11, -15);
  // Bow Arc
  ctx.strokeStyle = '#38bdf8';
  ctx.shadowColor = '#00f2ff';
  ctx.shadowBlur = 10;
  ctx.lineWidth = 3.5;
  ctx.beginPath();
  ctx.arc(0, 0, 18, -Math.PI / 2.2, Math.PI / 2.2);
  ctx.stroke();
  ctx.shadowBlur = 0;

  // Bowstring
  ctx.strokeStyle = '#bae6fd';
  ctx.lineWidth = 1;
  ctx.beginPath();
  const pull = animState === 'attack' ? -9 : 0;
  ctx.moveTo(6, -16);
  ctx.lineTo(pull, 0);
  ctx.lineTo(6, 16);
  ctx.stroke();

  // Nocked Frost Arrow
  if (animState === 'attack' || animState === 'idle') {
    ctx.strokeStyle = '#e0f2fe';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(pull, 0);
    ctx.lineTo(20, 0);
    ctx.stroke();
    // Glowing Arrowhead
    ctx.fillStyle = '#38bdf8';
    ctx.beginPath();
    ctx.moveTo(20, 0);
    ctx.lineTo(15, -4);
    ctx.lineTo(15, 4);
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();
}

// =========================================================================
// 3. KYUMI: TFT CHIBI AHRI (EXACT MATCH TO REFERENCE PHOTO!)
// 9 Voluminous Bushy Lotus Tails, Big Violet Anime Eyes, Airborne Leap Pose & Luminous Spirit Orb
// =========================================================================
function drawChibiKyumi(ctx: CanvasRenderingContext2D, animState: string, animTime: number) {
  const hoverBob = Math.sin(animTime * 3.5) * 3;

  // Real Ground Drop Shadows
  ctx.save();
  ctx.fillStyle = 'rgba(0, 0, 0, 0.45)';
  ctx.beginPath();
  ctx.ellipse(0, 4, 18, 7, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = 'rgba(0, 0, 0, 0.35)';
  ctx.beginPath();
  ctx.ellipse(16, 12, 10, 4.5, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  // Elevate Kyumi into Airborne Hovering Leap Pose
  ctx.save();
  ctx.translate(0, -14 + hoverBob);

  // 9 VOLUMINOUS PLUMP BUSHY FOX TAILS (Lotus Fan)
  for (let i = 0; i < 9; i++) {
    const angle = -Math.PI * 0.76 + (i / 8) * (Math.PI * 0.92);
    const sway = Math.sin(animTime * 4 + i * 0.4) * 4;
    const tailLen = 32 + (i % 2) * 5;

    ctx.save();
    const tailGrad = ctx.createLinearGradient(0, -10, Math.cos(angle) * tailLen, Math.sin(angle) * tailLen);
    tailGrad.addColorStop(0, '#ffffff');
    tailGrad.addColorStop(0.5, '#f5f3ff');
    tailGrad.addColorStop(0.85, '#e0e7ff');
    tailGrad.addColorStop(1, '#c7d2fe');

    ctx.fillStyle = tailGrad;
    ctx.strokeStyle = '#a5b4fc';
    ctx.lineWidth = 1.2;

    ctx.beginPath();
    ctx.moveTo(-2, -8);
    const tipX = Math.cos(angle) * tailLen + sway;
    const tipY = -8 + Math.sin(angle) * tailLen;
    const ctrl1X = Math.cos(angle - 0.25) * (tailLen * 0.6);
    const ctrl1Y = -8 + Math.sin(angle - 0.25) * (tailLen * 0.6);
    const ctrl2X = Math.cos(angle + 0.25) * (tailLen * 0.6);
    const ctrl2Y = -8 + Math.sin(angle + 0.25) * (tailLen * 0.6);

    ctx.quadraticCurveTo(ctrl1X, ctrl1Y, tipX, tipY);
    ctx.quadraticCurveTo(ctrl2X, ctrl2Y, 2, -6);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  }

  // SWIRLING CYAN SPIRIT ENERGY HALO
  ctx.save();
  ctx.strokeStyle = 'rgba(6, 182, 212, 0.85)';
  ctx.lineWidth = 2.5;
  ctx.shadowColor = '#00f2ff';
  ctx.shadowBlur = 12;
  ctx.beginPath();
  ctx.ellipse(0, 0, 22, 9, animTime * 3, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();

  // Dainty Legs in Mid-Air Leap
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(-5, 0, 3.5, 9);
  ctx.fillRect(2, 0, 3.5, 9);
  ctx.fillStyle = '#dc2626'; // Red geta soles
  ctx.fillRect(-6, 8, 4.5, 2.5);
  ctx.fillRect(1, 8, 4.5, 2.5);

  // Flowing Kimono Robe & Wide Sleeves
  ctx.fillStyle = '#f8fafc';
  ctx.beginPath();
  ctx.moveTo(-7, -18);
  ctx.lineTo(-13, 1);
  ctx.lineTo(13, 1);
  ctx.lineTo(7, -18);
  ctx.closePath();
  ctx.fill();

  // Red Obi Sash & Gold Bell Tassel
  ctx.fillStyle = '#dc2626';
  ctx.fillRect(-8, -10, 16, 4.5);
  ctx.fillStyle = '#fbbf24';
  ctx.beginPath();
  ctx.arc(0, -6, 2.8, 0, Math.PI * 2);
  ctx.fill();

  // Wide Trailing Bell Sleeves
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.ellipse(-11, -11, 4.5, 8.5, 0.4, 0, Math.PI * 2);
  ctx.ellipse(11, -11, 4.5, 8.5, -0.4, 0, Math.PI * 2);
  ctx.fill();

  // Big Cute Chibi Head
  ctx.fillStyle = '#ffedd5';
  ctx.beginPath();
  ctx.arc(0, -29, 13.5, 0, Math.PI * 2);
  ctx.fill();

  // Fluffy Pointed Fox Ears
  ctx.save();
  // Left Ear
  ctx.fillStyle = '#1e1b4b';
  ctx.beginPath();
  ctx.moveTo(-9, -38);
  ctx.lineTo(-16, -50);
  ctx.lineTo(-3, -42);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = '#f472b6';
  ctx.beginPath();
  ctx.moveTo(-8, -40);
  ctx.lineTo(-13, -48);
  ctx.lineTo(-4, -42);
  ctx.closePath();
  ctx.fill();

  // Right Ear
  ctx.fillStyle = '#1e1b4b';
  ctx.beginPath();
  ctx.moveTo(9, -38);
  ctx.lineTo(16, -50);
  ctx.lineTo(3, -42);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = '#f472b6';
  ctx.beginPath();
  ctx.moveTo(8, -40);
  ctx.lineTo(13, -48);
  ctx.lineTo(4, -42);
  ctx.closePath();
  ctx.fill();
  ctx.restore();

  // Soft Pink Cheeks & Red Fox Whisker Marks
  ctx.fillStyle = 'rgba(244, 114, 182, 0.5)';
  ctx.beginPath();
  ctx.arc(-8, -26, 3.2, 0, Math.PI * 2);
  ctx.arc(8, -26, 3.2, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#dc2626';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(-11, -26); ctx.lineTo(-7, -26);
  ctx.moveTo(7, -26); ctx.lineTo(11, -26);
  ctx.stroke();

  // Big Expressive Violet Anime Eyes
  // Left Eye
  ctx.fillStyle = '#4c1d95';
  ctx.beginPath();
  ctx.ellipse(-5, -29, 3.4, 4.5, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#a855f7';
  ctx.beginPath();
  ctx.ellipse(-5, -28, 2.4, 3.2, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.arc(-6, -30.5, 1.3, 0, Math.PI * 2);
  ctx.arc(-4, -27.5, 0.8, 0, Math.PI * 2);
  ctx.fill();

  // Right Eye
  ctx.fillStyle = '#4c1d95';
  ctx.beginPath();
  ctx.ellipse(5, -29, 3.4, 4.5, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#a855f7';
  ctx.beginPath();
  ctx.ellipse(5, -28, 2.4, 3.2, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.arc(4, -30.5, 1.3, 0, Math.PI * 2);
  ctx.arc(6, -27.5, 0.8, 0, Math.PI * 2);
  ctx.fill();

  // Cute Smile
  ctx.strokeStyle = '#be185d';
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.arc(0, -24, 2, 0.2, Math.PI - 0.2);
  ctx.stroke();

  // Black Hair Bangs
  ctx.fillStyle = '#0f172a';
  ctx.beginPath();
  ctx.moveTo(-14, -34);
  ctx.quadraticCurveTo(-7, -37, 0, -32);
  ctx.quadraticCurveTo(7, -37, 14, -34);
  ctx.quadraticCurveTo(11, -43, 0, -43);
  ctx.quadraticCurveTo(-11, -43, -14, -34);
  ctx.fill();

  // LUMINOUS FLOATING SPIRIT ORB
  const orbBob = Math.sin(animTime * 6) * 3;
  ctx.save();
  ctx.translate(16, -14 + orbBob);
  ctx.shadowColor = '#00f2ff';
  ctx.shadowBlur = 18;

  const orbGrad = ctx.createRadialGradient(0, 0, 1, 0, 0, 9);
  orbGrad.addColorStop(0, '#ffffff');
  orbGrad.addColorStop(0.4, '#67e8f9');
  orbGrad.addColorStop(0.8, '#06b6d4');
  orbGrad.addColorStop(1, 'rgba(6, 182, 212, 0)');
  ctx.fillStyle = orbGrad;
  ctx.beginPath();
  ctx.arc(0, 0, 9, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.arc(0, 0, 3.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  ctx.restore();
}

// =========================================================================
// 4. BUCK: TFT CHIBI OUTLAW BOOMSTICK
// Rugged Stilted Hat, Determined Smirk, Glowing Cigar Smoke & Chunky Shotgun
// =========================================================================
function drawChibiBuck(ctx: CanvasRenderingContext2D, animState: string, animTime: number) {
  // Red Outlaw Cape/Poncho Fluttering
  ctx.fillStyle = '#b91c1c';
  ctx.beginPath();
  ctx.moveTo(-10, -18);
  ctx.lineTo(-20, 4);
  ctx.lineTo(-3, 4);
  ctx.closePath();
  ctx.fill();

  // Heavy Boots & Pants
  ctx.fillStyle = '#292524';
  ctx.fillRect(-7, -4, 5, 8);
  ctx.fillRect(2, -4, 5, 8);

  // Brown Leather Trenchcoat & Bandolier
  ctx.fillStyle = '#78350f';
  ctx.fillRect(-8, -20, 16, 17);
  // Ammo Bandolier
  ctx.strokeStyle = '#451a03';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(-8, -20);
  ctx.lineTo(8, -4);
  ctx.stroke();
  // Shells
  ctx.fillStyle = '#facc15';
  ctx.fillRect(-4, -14, 2, 3);
  ctx.fillRect(0, -10, 2, 3);

  // Big Cute Chibi Head with Stubble
  ctx.fillStyle = '#ffedd5';
  ctx.beginPath();
  ctx.arc(0, -28, 13, 0, Math.PI * 2);
  ctx.fill();

  // Stubble Beard
  ctx.fillStyle = '#78716c';
  ctx.beginPath();
  ctx.arc(0, -26, 9, 0.2, Math.PI - 0.2);
  ctx.fill();
  ctx.fillStyle = '#ffedd5';
  ctx.beginPath();
  ctx.arc(0, -28, 7, 0, Math.PI * 2);
  ctx.fill();

  // Glowing Cigar & Smoke Puff
  ctx.fillStyle = '#ea580c';
  ctx.fillRect(3, -24, 4, 1.8);
  ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
  const smokeBob = Math.sin(animTime * 6) * 1.5;
  ctx.beginPath();
  ctx.arc(8, -26 + smokeBob, 2.5, 0, Math.PI * 2);
  ctx.fill();

  // Determined Eyes
  ctx.fillStyle = '#1c1917';
  ctx.beginPath();
  ctx.ellipse(-5, -29, 2.8, 3.5, 0, 0, Math.PI * 2);
  ctx.ellipse(5, -29, 2.8, 3.5, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.arc(-6, -30, 1, 0, Math.PI * 2);
  ctx.arc(4, -30, 1, 0, Math.PI * 2);
  ctx.fill();

  // Outlaw Cowboy Hat (Wide Brim & Crown)
  ctx.fillStyle = '#451a03';
  ctx.beginPath();
  ctx.ellipse(0, -35, 18, 5, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillRect(-10, -44, 20, 10);
  // Red Hat Band
  ctx.fillStyle = '#dc2626';
  ctx.fillRect(-10, -37, 20, 2.5);

  // CHUNKY DOUBLE-BARREL BOOMSTICK SHOTGUN
  const recoil = animState === 'attack' ? -7 : 0;
  ctx.save();
  ctx.translate(7 + recoil, -13);
  ctx.fillStyle = '#1c1917';
  ctx.fillRect(0, -3, 22, 6);
  ctx.fillStyle = '#78716c'; // Metal Barrels
  ctx.fillRect(10, -4, 15, 3);
  ctx.fillRect(10, 0, 15, 3);

  // Muzzle Flash Explosion if attacking
  if (animState === 'attack') {
    ctx.fillStyle = '#f97316';
    ctx.shadowColor = '#facc15';
    ctx.shadowBlur = 14;
    ctx.beginPath();
    ctx.arc(28, -1, 8, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#fef08a';
    ctx.beginPath();
    ctx.arc(28, -1, 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;
  }
  ctx.restore();
}

// =========================================================================
// 5. VALKIRA: TFT CHIBI WARLORD MATRIARCH
// Crimson Battle Scar, Spiked Mohawk Braids, Nose Ring & Twin Chained Blades
// =========================================================================
function drawChibiValkira(ctx: CanvasRenderingContext2D, animState: string, animTime: number) {
  // Red War Cape
  ctx.fillStyle = '#991b1b';
  ctx.beginPath();
  ctx.moveTo(-10, -18);
  ctx.lineTo(-20, 4);
  ctx.lineTo(-3, 4);
  ctx.closePath();
  ctx.fill();

  // Warlord Armored Legs
  ctx.fillStyle = '#292524';
  ctx.fillRect(-7, -4, 5, 8);
  ctx.fillRect(2, -4, 5, 8);

  // Steel Cuirass with Red Core Gem
  ctx.fillStyle = '#1c1917';
  ctx.fillRect(-8, -20, 16, 17);
  ctx.fillStyle = '#dc2626';
  ctx.fillRect(-3, -15, 6, 6);

  // Big Cute Chibi Head with Dark Skin
  ctx.fillStyle = '#c27d53';
  ctx.beginPath();
  ctx.arc(0, -29, 13, 0, Math.PI * 2);
  ctx.fill();

  // Red Battle Scar over left eye
  ctx.strokeStyle = '#ef4444';
  ctx.lineWidth = 1.8;
  ctx.beginPath();
  ctx.moveTo(-4, -34);
  ctx.lineTo(0, -25);
  ctx.stroke();

  // Golden Nose Ring & Earrings
  ctx.fillStyle = '#fde047';
  ctx.fillRect(4, -28, 1.8, 1.8);
  ctx.fillRect(-7, -28, 1.8, 1.8);

  // Fierce Amber/Ruby Anime Eyes
  ctx.fillStyle = '#450a0a';
  ctx.beginPath();
  ctx.ellipse(-5, -29, 3.2, 4.2, 0, 0, Math.PI * 2);
  ctx.ellipse(5, -29, 3.2, 4.2, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#ef4444';
  ctx.beginPath();
  ctx.ellipse(-5, -28, 2.2, 3, 0, 0, Math.PI * 2);
  ctx.ellipse(5, -28, 2.2, 3, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.arc(-6, -30.5, 1.2, 0, Math.PI * 2);
  ctx.arc(4, -30.5, 1.2, 0, Math.PI * 2);
  ctx.fill();

  // Spiked Mohawk Braids
  ctx.fillStyle = '#09090b';
  ctx.fillRect(-3, -46, 6, 16);
  ctx.beginPath();
  ctx.moveTo(-3, -46);
  ctx.lineTo(5, -41);
  ctx.lineTo(-3, -37);
  ctx.closePath();
  ctx.fill();

  // TWIN CHAINED CRESCENT BLADES
  const slashAngle = animState === 'attack' ? Math.sin(animTime * 20) * 1.5 : 0.3;

  // Blade 1 (Left hand)
  ctx.save();
  ctx.translate(-11, -14);
  ctx.rotate(-slashAngle);
  ctx.strokeStyle = '#a8a29e';
  ctx.lineWidth = 1.8;
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(-9, 7);
  ctx.stroke();
  ctx.strokeStyle = '#dc2626';
  ctx.lineWidth = 3.5;
  ctx.beginPath();
  ctx.arc(-11, 7, 13, -Math.PI / 2, Math.PI / 2);
  ctx.stroke();
  ctx.restore();

  // Blade 2 (Right hand)
  ctx.save();
  ctx.translate(11, -14);
  ctx.rotate(slashAngle);
  ctx.strokeStyle = '#a8a29e';
  ctx.lineWidth = 1.8;
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(9, 7);
  ctx.stroke();
  ctx.strokeStyle = '#dc2626';
  ctx.lineWidth = 3.5;
  ctx.beginPath();
  ctx.arc(11, 7, 13, -Math.PI / 2, Math.PI / 2);
  ctx.stroke();
  ctx.restore();
}

// =========================================================================
// 6. KAGE (ZED): SHADOW ASSASSIN
// Ninja Cowl, Piercing Crimson Eyes, Shadow Scarf & Twin Arm Blades
// =========================================================================
function drawChibiKage(ctx: CanvasRenderingContext2D, animState: string, animTime: number) {
  // Shadow Scarf / Cloak Behind
  ctx.save();
  ctx.fillStyle = '#09090b';
  ctx.beginPath();
  ctx.moveTo(-8, -18);
  ctx.lineTo(-22, -6 + Math.sin(animTime * 6) * 4);
  ctx.lineTo(-12, 4);
  ctx.closePath();
  ctx.fill();
  ctx.restore();

  // Ninja Boots
  ctx.fillStyle = '#18181b';
  ctx.fillRect(-7, -4, 5, 8);
  ctx.fillRect(2, -4, 5, 8);
  ctx.fillStyle = '#991b1b';
  ctx.fillRect(-7, 1, 5, 2);
  ctx.fillRect(2, 1, 5, 2);

  // Black Shinobi Gi & Crimson Armor
  ctx.fillStyle = '#27272a';
  ctx.beginPath();
  ctx.roundRect(-8, -20, 16, 17, 3);
  ctx.fill();
  ctx.fillStyle = '#b91c1c';
  ctx.fillRect(-8, -11, 16, 3);
  ctx.fillStyle = '#52525b';
  ctx.fillRect(-6, -18, 12, 5);

  // Ninja Hood Head
  ctx.fillStyle = '#18181b';
  ctx.beginPath();
  ctx.arc(0, -29, 13, 0, Math.PI * 2);
  ctx.fill();

  // Metal Mask Faceplate
  ctx.fillStyle = '#3f3f46';
  ctx.beginPath();
  ctx.moveTo(-9, -27);
  ctx.lineTo(0, -20);
  ctx.lineTo(9, -27);
  ctx.lineTo(7, -33);
  ctx.lineTo(-7, -33);
  ctx.closePath();
  ctx.fill();

  // Glowing Crimson Anime Slit Eyes
  ctx.fillStyle = '#ef4444';
  ctx.shadowColor = '#ef4444';
  ctx.shadowBlur = 8;
  ctx.fillRect(-6, -30, 4, 2.5);
  ctx.fillRect(2, -30, 4, 2.5);
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(-5, -29.5, 1.5, 1.5);
  ctx.fillRect(3, -29.5, 1.5, 1.5);
  ctx.shadowBlur = 0;

  // Twin Arm Blades
  const slash = animState === 'attack' ? Math.sin(animTime * 22) * 1.6 : 0.2;
  // Left Arm Blade
  ctx.save();
  ctx.translate(-11, -14);
  ctx.rotate(-slash);
  ctx.fillStyle = '#cbd5e1';
  ctx.beginPath();
  ctx.moveTo(0, 0); ctx.lineTo(-14, 8); ctx.lineTo(-9, 12); ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = '#ef4444'; ctx.lineWidth = 1.5; ctx.stroke();
  ctx.restore();

  // Right Arm Blade
  ctx.save();
  ctx.translate(11, -14);
  ctx.rotate(slash);
  ctx.fillStyle = '#cbd5e1';
  ctx.beginPath();
  ctx.moveTo(0, 0); ctx.lineTo(14, 8); ctx.lineTo(9, 12); ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = '#ef4444'; ctx.lineWidth = 1.5; ctx.stroke();
  ctx.restore();
}

// =========================================================================
// 7. KAZEMARU (YASUO): THE WANDERING TEMPEST
// High Samurai Ponytail, Flowing Blue Haori, Autumn Leaves & Wind Katana
// =========================================================================
function drawChibiKazemaru(ctx: CanvasRenderingContext2D, animState: string, animTime: number) {
  // Flowing Azure Blue Haori Coat
  ctx.save();
  ctx.fillStyle = '#0284c7';
  ctx.beginPath();
  ctx.moveTo(-10, -18);
  ctx.lineTo(-22, -2 + Math.sin(animTime * 8) * 3);
  ctx.lineTo(-4, 3);
  ctx.closePath();
  ctx.fill();
  ctx.restore();

  // Samurai Ponytail Behind
  ctx.fillStyle = '#0f172a';
  ctx.beginPath();
  ctx.moveTo(2, -38);
  ctx.quadraticCurveTo(-18, -42 + Math.sin(animTime * 7) * 4, -22, -18);
  ctx.quadraticCurveTo(-10, -28, 0, -32);
  ctx.fill();
  // Gold Hair Ribbon
  ctx.fillStyle = '#facc15';
  ctx.fillRect(-2, -38, 5, 3);

  // Boots
  ctx.fillStyle = '#78350f';
  ctx.fillRect(-7, -4, 5, 8);
  ctx.fillRect(2, -4, 5, 8);

  // White Gi & Rope Belt
  ctx.fillStyle = '#f8fafc';
  ctx.beginPath();
  ctx.roundRect(-8, -20, 16, 17, 3);
  ctx.fill();
  ctx.fillStyle = '#0284c7';
  ctx.fillRect(-8, -20, 4, 16);
  ctx.fillStyle = '#f59e0b';
  ctx.fillRect(-8, -10, 16, 2.5);

  // Chibi Head
  ctx.fillStyle = '#ffedd5';
  ctx.beginPath();
  ctx.arc(0, -29, 13, 0, Math.PI * 2);
  ctx.fill();

  // Cheeks
  ctx.fillStyle = 'rgba(244, 114, 182, 0.35)';
  ctx.beginPath();
  ctx.arc(-7, -26, 3, 0, Math.PI * 2);
  ctx.arc(7, -26, 3, 0, Math.PI * 2);
  ctx.fill();

  // Anime Eyes & Nose Scar
  ctx.fillStyle = '#0f172a';
  ctx.beginPath();
  ctx.ellipse(-5, -29, 3, 4, 0, 0, Math.PI * 2);
  ctx.ellipse(5, -29, 3, 4, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#38bdf8';
  ctx.beginPath();
  ctx.ellipse(-5, -28.5, 2, 2.8, 0, 0, Math.PI * 2);
  ctx.ellipse(5, -28.5, 2, 2.8, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.arc(-6, -30.5, 1.2, 0, Math.PI * 2);
  ctx.arc(4, -30.5, 1.2, 0, Math.PI * 2);
  ctx.fill();
  // Nose Scar
  ctx.strokeStyle = '#dc2626';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(-2, -26); ctx.lineTo(3, -24); ctx.stroke();

  // Spiky Front Bangs
  ctx.fillStyle = '#0f172a';
  ctx.beginPath();
  ctx.moveTo(-11, -34); ctx.lineTo(-6, -26); ctx.lineTo(0, -35); ctx.lineTo(6, -26); ctx.lineTo(11, -34);
  ctx.closePath();
  ctx.fill();

  // Wind Katana
  const swing = animState === 'attack' ? Math.sin(animTime * 22) * 1.8 : 0.4;
  ctx.save();
  ctx.translate(10, -12);
  ctx.rotate(swing);
  ctx.fillStyle = '#facc15';
  ctx.fillRect(-2, -2, 4, 4);
  ctx.strokeStyle = '#e2e8f0';
  ctx.lineWidth = 2.5;
  ctx.shadowColor = '#38bdf8';
  ctx.shadowBlur = 6;
  ctx.beginPath();
  ctx.moveTo(0, 0); ctx.lineTo(16, -16); ctx.stroke();
  ctx.shadowBlur = 0;
  ctx.restore();
}

// =========================================================================
// 8. KINDRA & GRIM (KINDRED): THE ETERNAL HUNTERS
// Fluffy White Lamb with Spirit Bow + Menacing Floating Wolf Spirit
// =========================================================================
function drawChibiKindra(ctx: CanvasRenderingContext2D, animState: string, animTime: number) {
  // Shadow Wolf Spirit Floating Behind
  ctx.save();
  const wolfFloat = Math.sin(animTime * 4) * 4;
  ctx.translate(-18, -32 + wolfFloat);
  ctx.fillStyle = '#3b0764';
  ctx.shadowColor = '#9333ea';
  ctx.shadowBlur = 10;
  ctx.beginPath();
  ctx.ellipse(0, 0, 11, 7, -0.2, 0, Math.PI * 2);
  ctx.fill();
  // Wolf Ears
  ctx.beginPath();
  ctx.moveTo(4, -4); ctx.lineTo(9, -12); ctx.lineTo(11, -3); ctx.fill();
  // Glowing Cyan Wolf Eye
  ctx.fillStyle = '#22d3ee';
  ctx.beginPath();
  ctx.arc(6, -1, 2, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  // Chibi Lamb Legs & Cloven Hooves
  ctx.fillStyle = '#1e1b4b';
  ctx.fillRect(-6, -3, 4, 7);
  ctx.fillRect(2, -3, 4, 7);

  // Soft White Wool Body
  ctx.fillStyle = '#f8fafc';
  ctx.beginPath();
  ctx.roundRect(-8, -18, 16, 16, 6);
  ctx.fill();

  // Fluffy Lamb Head
  ctx.fillStyle = '#f8fafc';
  ctx.beginPath();
  ctx.arc(0, -28, 13, 0, Math.PI * 2);
  ctx.fill();

  // Spiral Spirit Horns
  ctx.strokeStyle = '#64748b';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(-11, -34, 6, Math.PI * 0.4, Math.PI * 1.6);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(11, -34, 6, -Math.PI * 0.6, Math.PI * 0.6);
  ctx.stroke();

  // Lamb's Wooden Mask with Cyan/Violet Markings
  ctx.fillStyle = '#1e1b4b';
  ctx.beginPath();
  ctx.ellipse(0, -28, 9, 7, 0, 0, Math.PI * 2);
  ctx.fill();
  // Glowing Eyes
  ctx.fillStyle = '#38bdf8';
  ctx.beginPath();
  ctx.arc(-4, -28, 2.2, 0, Math.PI * 2);
  ctx.arc(4, -28, 2.2, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.arc(-4.5, -29, 1, 0, Math.PI * 2);
  ctx.arc(3.5, -29, 1, 0, Math.PI * 2);
  ctx.fill();

  // Spectral Spirit Bow
  ctx.save();
  ctx.translate(11, -16);
  ctx.strokeStyle = '#c084fc';
  ctx.lineWidth = 2.5;
  ctx.shadowColor = '#c084fc';
  ctx.shadowBlur = 8;
  ctx.beginPath();
  ctx.arc(0, 0, 13, -Math.PI * 0.4, Math.PI * 0.4);
  ctx.stroke();
  ctx.strokeStyle = '#f8fafc';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(8, -10); ctx.lineTo(8, 10); ctx.stroke();
  ctx.restore();
}

// =========================================================================
// 9. CORA (XAYAH): THE REBEL FEATHER
// Magenta Feathered Cloak, Feather Ears, Rebel Smirk & Quill Daggers
// =========================================================================
function drawChibiCora(ctx: CanvasRenderingContext2D, animState: string, animTime: number) {
  // Layered Violet & Magenta Wing Cloak
  ctx.save();
  ctx.fillStyle = '#701a75';
  ctx.beginPath();
  ctx.moveTo(-10, -18);
  ctx.lineTo(-22, -2 + Math.sin(animTime * 6) * 3);
  ctx.lineTo(-6, 4);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = '#d946ef';
  ctx.beginPath();
  ctx.moveTo(-8, -16);
  ctx.lineTo(-18, 0);
  ctx.lineTo(-4, 2);
  ctx.closePath();
  ctx.fill();
  ctx.restore();

  // Boots
  ctx.fillStyle = '#4a044e';
  ctx.fillRect(-7, -4, 5, 8);
  ctx.fillRect(2, -4, 5, 8);

  // Feathered Vest
  ctx.fillStyle = '#a21caf';
  ctx.beginPath();
  ctx.roundRect(-8, -20, 16, 17, 3);
  ctx.fill();
  ctx.fillStyle = '#f472b6';
  ctx.fillRect(-8, -10, 16, 2.5);

  // Head
  ctx.fillStyle = '#fce7f3';
  ctx.beginPath();
  ctx.arc(0, -29, 13, 0, Math.PI * 2);
  ctx.fill();

  // Feather Ears pointing up
  ctx.fillStyle = '#d946ef';
  ctx.beginPath();
  ctx.moveTo(-9, -38); ctx.lineTo(-14, -48); ctx.lineTo(-4, -36); ctx.fill();
  ctx.moveTo(9, -38); ctx.lineTo(14, -48); ctx.lineTo(4, -36); ctx.fill();

  // Cheeks
  ctx.fillStyle = 'rgba(236, 72, 153, 0.4)';
  ctx.beginPath();
  ctx.arc(-7, -26, 3, 0, Math.PI * 2);
  ctx.arc(7, -26, 3, 0, Math.PI * 2);
  ctx.fill();

  // Amber Anime Eyes
  ctx.fillStyle = '#78350f';
  ctx.beginPath();
  ctx.ellipse(-5, -29, 3, 4, 0, 0, Math.PI * 2);
  ctx.ellipse(5, -29, 3, 4, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#f59e0b';
  ctx.beginPath();
  ctx.ellipse(-5, -28.5, 2, 2.8, 0, 0, Math.PI * 2);
  ctx.ellipse(5, -28.5, 2, 2.8, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.arc(-6, -30.5, 1.2, 0, Math.PI * 2);
  ctx.arc(4, -30.5, 1.2, 0, Math.PI * 2);
  ctx.fill();

  // Magenta Quill Feathers in Hand
  const flick = animState === 'attack' ? Math.sin(animTime * 20) * 1.5 : 0.3;
  ctx.save();
  ctx.translate(11, -14);
  ctx.rotate(flick);
  ctx.fillStyle = '#ec4899';
  ctx.shadowColor = '#f472b6';
  ctx.shadowBlur = 8;
  ctx.beginPath();
  ctx.moveTo(0, 0); ctx.lineTo(14, -10); ctx.lineTo(16, -6); ctx.closePath();
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(0, 0); ctx.lineTo(14, -2); ctx.lineTo(16, 2); ctx.closePath();
  ctx.fill();
  ctx.restore();
}

// =========================================================================
// 10. RENN (RAKAN): THE BATTLE DANCER
// Radiant Golden Feather Cape, Flamboyant Crest & Charming Wink
// =========================================================================
function drawChibiRenn(ctx: CanvasRenderingContext2D, animState: string, animTime: number) {
  // Golden Feather Cape
  ctx.save();
  ctx.fillStyle = '#f59e0b';
  ctx.beginPath();
  ctx.moveTo(-10, -18);
  ctx.lineTo(-24, -4 + Math.sin(animTime * 7) * 4);
  ctx.lineTo(-6, 4);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = '#fbbf24';
  ctx.beginPath();
  ctx.moveTo(-8, -16); ctx.lineTo(-19, -2); ctx.lineTo(-4, 2); ctx.closePath();
  ctx.fill();
  ctx.restore();

  // Boots
  ctx.fillStyle = '#78350f';
  ctx.fillRect(-7, -4, 5, 8);
  ctx.fillRect(2, -4, 5, 8);

  // Open Dancer Vest & Green Sash
  ctx.fillStyle = '#ea580c';
  ctx.beginPath();
  ctx.roundRect(-8, -20, 16, 17, 3);
  ctx.fill();
  ctx.fillStyle = '#10b981';
  ctx.fillRect(-8, -10, 16, 3);

  // Head
  ctx.fillStyle = '#ffedd5';
  ctx.beginPath();
  ctx.arc(0, -29, 13, 0, Math.PI * 2);
  ctx.fill();

  // Golden Swept-Back Crest Feathers
  ctx.fillStyle = '#facc15';
  ctx.beginPath();
  ctx.moveTo(-4, -40); ctx.lineTo(-8, -52); ctx.lineTo(4, -40); ctx.fill();
  ctx.moveTo(2, -40); ctx.lineTo(8, -50); ctx.lineTo(10, -38); ctx.fill();

  // Left Eye: Big Anime Eye
  ctx.fillStyle = '#78350f';
  ctx.beginPath();
  ctx.ellipse(-5, -29, 3, 4, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#f59e0b';
  ctx.beginPath();
  ctx.ellipse(-5, -28.5, 2, 2.8, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.arc(-6, -30.5, 1.2, 0, Math.PI * 2);
  ctx.fill();

  // Right Eye: Charming Wink!
  ctx.strokeStyle = '#78350f';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(5, -29, 3, Math.PI * 0.1, Math.PI * 0.9);
  ctx.stroke();

  // Shiny Mirror Amulet in Hand
  ctx.save();
  ctx.translate(11, -12);
  ctx.fillStyle = '#38bdf8';
  ctx.shadowColor = '#facc15';
  ctx.shadowBlur = 8;
  ctx.beginPath();
  ctx.arc(0, 0, 5, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

// =========================================================================
// 11. SYLLA (LONE DRUID): THE BEAR SHAMAN
// Pelt Cowl, Druid Staff & Armored Spirit Bear Companion
// =========================================================================
function drawChibiSylla(ctx: CanvasRenderingContext2D, animState: string, animTime: number) {
  // Loyal Armored Spirit Bear Cub at Side
  ctx.save();
  ctx.translate(-19, -4);
  ctx.fillStyle = '#334155';
  ctx.beginPath();
  ctx.ellipse(0, 0, 9, 8, 0, 0, Math.PI * 2);
  ctx.fill();
  // Bear Ears
  ctx.fillStyle = '#1e293b';
  ctx.beginPath();
  ctx.arc(-5, -6, 2.5, 0, Math.PI * 2);
  ctx.arc(5, -6, 2.5, 0, Math.PI * 2);
  ctx.fill();
  // Emerald Rune on Chest
  ctx.fillStyle = '#10b981';
  ctx.beginPath();
  ctx.arc(0, 0, 2.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  // Boots
  ctx.fillStyle = '#451a03';
  ctx.fillRect(-7, -4, 5, 8);
  ctx.fillRect(2, -4, 5, 8);

  // Forest Druid Tunic
  ctx.fillStyle = '#166534';
  ctx.beginPath();
  ctx.roundRect(-8, -20, 16, 17, 3);
  ctx.fill();
  ctx.fillStyle = '#78350f';
  ctx.fillRect(-8, -11, 16, 3);

  // Head
  ctx.fillStyle = '#ffedd5';
  ctx.beginPath();
  ctx.arc(0, -29, 13, 0, Math.PI * 2);
  ctx.fill();

  // Bear Pelt Hood over Head
  ctx.fillStyle = '#78350f';
  ctx.beginPath();
  ctx.arc(0, -32, 14, Math.PI * 0.9, Math.PI * 2.1);
  ctx.fill();
  // Hood Ears
  ctx.beginPath();
  ctx.arc(-9, -42, 3, 0, Math.PI * 2);
  ctx.arc(9, -42, 3, 0, Math.PI * 2);
  ctx.fill();

  // Druid Braided Beard
  ctx.fillStyle = '#b45309';
  ctx.beginPath();
  ctx.moveTo(-6, -24); ctx.lineTo(0, -17); ctx.lineTo(6, -24); ctx.fill();

  // Calm Wise Anime Eyes
  ctx.fillStyle = '#14532d';
  ctx.beginPath();
  ctx.ellipse(-5, -29, 2.8, 3.5, 0, 0, Math.PI * 2);
  ctx.ellipse(5, -29, 2.8, 3.5, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#22c55e';
  ctx.beginPath();
  ctx.ellipse(-5, -28.5, 1.8, 2.2, 0, 0, Math.PI * 2);
  ctx.ellipse(5, -28.5, 1.8, 2.2, 0, 0, Math.PI * 2);
  ctx.fill();

  // Gnarled Druid Staff
  ctx.save();
  ctx.translate(11, -14);
  ctx.strokeStyle = '#78350f';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(0, 14); ctx.lineTo(0, -20); ctx.stroke();
  // Emerald Moss Orb on Top
  ctx.fillStyle = '#22c55e';
  ctx.shadowColor = '#22c55e';
  ctx.shadowBlur = 8;
  ctx.beginPath();
  ctx.arc(0, -20, 5, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

// =========================================================================
// 12. TEQUOIA (FURION / NATURE'S PROPHET): NATURE'S SOVEREIGN
// Sprouting Antlers Crown, Emerald Robes & Living Oak Stave
// =========================================================================
function drawChibiTequoia(ctx: CanvasRenderingContext2D, animState: string, animTime: number) {
  // Robe skirt
  ctx.fillStyle = '#15803d';
  ctx.beginPath();
  ctx.moveTo(-8, -6); ctx.lineTo(-12, 4); ctx.lineTo(12, 4); ctx.lineTo(8, -6);
  ctx.fill();

  // Boots
  ctx.fillStyle = '#713f12';
  ctx.fillRect(-6, 2, 4, 4);
  ctx.fillRect(2, 2, 4, 4);

  // Emerald Robe Torso
  ctx.fillStyle = '#16a34a';
  ctx.beginPath();
  ctx.roundRect(-8, -20, 16, 15, 3);
  ctx.fill();
  ctx.fillStyle = '#facc15';
  ctx.fillRect(-8, -12, 16, 2);

  // Head
  ctx.fillStyle = '#ffedd5';
  ctx.beginPath();
  ctx.arc(0, -29, 13, 0, Math.PI * 2);
  ctx.fill();

  // Wooden Antler Crown
  ctx.strokeStyle = '#713f12';
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  // Left Antler
  ctx.moveTo(-6, -40); ctx.lineTo(-14, -52); ctx.lineTo(-20, -50);
  ctx.moveTo(-11, -47); ctx.lineTo(-7, -54);
  // Right Antler
  ctx.moveTo(6, -40); ctx.lineTo(14, -52); ctx.lineTo(20, -50);
  ctx.moveTo(11, -47); ctx.lineTo(7, -54);
  ctx.stroke();

  // Fresh Green Sprouts on Antlers
  ctx.fillStyle = '#4ade80';
  ctx.beginPath();
  ctx.arc(-18, -50, 2.5, 0, Math.PI * 2);
  ctx.arc(18, -50, 2.5, 0, Math.PI * 2);
  ctx.fill();

  // Emerald Wise Eyes
  ctx.fillStyle = '#14532d';
  ctx.beginPath();
  ctx.ellipse(-5, -29, 3, 4, 0, 0, Math.PI * 2);
  ctx.ellipse(5, -29, 3, 4, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#22c55e';
  ctx.beginPath();
  ctx.ellipse(-5, -28.5, 2, 2.8, 0, 0, Math.PI * 2);
  ctx.ellipse(5, -28.5, 2, 2.8, 0, 0, Math.PI * 2);
  ctx.fill();

  // Sprout Stave
  ctx.save();
  ctx.translate(11, -14);
  ctx.strokeStyle = '#854d0e';
  ctx.lineWidth = 2.8;
  ctx.beginPath();
  ctx.moveTo(0, 12); ctx.lineTo(0, -18); ctx.stroke();
  ctx.fillStyle = '#22c55e';
  ctx.beginPath();
  ctx.arc(0, -20, 5, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

// =========================================================================
// 13. ZAL (DAZZLE): THE SHADOW PRIEST
// Tribal Feather Headdress, Warpaint, Pink Skull Stave & Shallow Grave Aura
// =========================================================================
function drawChibiZal(ctx: CanvasRenderingContext2D, animState: string, animTime: number) {
  // Boots
  ctx.fillStyle = '#4a044e';
  ctx.fillRect(-7, -4, 5, 8);
  ctx.fillRect(2, -4, 5, 8);

  // Voodoo Tribal Vest
  ctx.fillStyle = '#701a75';
  ctx.beginPath();
  ctx.roundRect(-8, -20, 16, 17, 3);
  ctx.fill();
  ctx.fillStyle = '#ec4899';
  ctx.fillRect(-8, -11, 16, 2.5);

  // Head
  ctx.fillStyle = '#fce7f3';
  ctx.beginPath();
  ctx.arc(0, -29, 13, 0, Math.PI * 2);
  ctx.fill();

  // Exotic Feather Headdress
  ctx.fillStyle = '#ec4899';
  ctx.beginPath();
  ctx.moveTo(-6, -40); ctx.lineTo(-12, -54); ctx.lineTo(-2, -40); ctx.fill();
  ctx.fillStyle = '#a855f7';
  ctx.beginPath();
  ctx.moveTo(0, -40); ctx.lineTo(0, -56); ctx.lineTo(4, -40); ctx.fill();
  ctx.fillStyle = '#06b6d4';
  ctx.beginPath();
  ctx.moveTo(4, -40); ctx.lineTo(12, -54); ctx.lineTo(6, -40); ctx.fill();

  // Tribal Warpaint Stripes on Cheeks
  ctx.strokeStyle = '#ec4899';
  ctx.lineWidth = 1.8;
  ctx.beginPath();
  ctx.moveTo(-8, -26); ctx.lineTo(-3, -24);
  ctx.moveTo(8, -26); ctx.lineTo(3, -24);
  ctx.stroke();

  // Glowing Pink Anime Eyes
  ctx.fillStyle = '#831843';
  ctx.beginPath();
  ctx.ellipse(-5, -29, 3, 4, 0, 0, Math.PI * 2);
  ctx.ellipse(5, -29, 3, 4, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#f472b6';
  ctx.beginPath();
  ctx.ellipse(-5, -28.5, 2, 2.8, 0, 0, Math.PI * 2);
  ctx.ellipse(5, -28.5, 2, 2.8, 0, 0, Math.PI * 2);
  ctx.fill();

  // Pink Voodoo Skull Stave
  ctx.save();
  ctx.translate(11, -14);
  ctx.strokeStyle = '#713f12';
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.moveTo(0, 14); ctx.lineTo(0, -18); ctx.stroke();
  // Skull Head
  ctx.fillStyle = '#fdf2f8';
  ctx.shadowColor = '#ec4899';
  ctx.shadowBlur = 10;
  ctx.beginPath();
  ctx.arc(0, -20, 5, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#ec4899';
  ctx.beginPath();
  ctx.arc(-2, -21, 1.2, 0, Math.PI * 2);
  ctx.arc(2, -21, 1.2, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

// =========================================================================
// 14. XIN (EMBER SPIRIT): THE EMBER WARRIOR
// Flaming Beard, Martial Crimson Robes & Twin Curved Flame Dao Swords
// =========================================================================
function drawChibiXin(ctx: CanvasRenderingContext2D, animState: string, animTime: number) {
  // Fire aura particles
  ctx.save();
  ctx.fillStyle = '#f97316';
  ctx.beginPath();
  ctx.arc(-14, -18 + Math.sin(animTime * 10) * 3, 2.5, 0, Math.PI * 2);
  ctx.arc(14, -22 + Math.cos(animTime * 9) * 3, 2, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  // Boots
  ctx.fillStyle = '#450a0a';
  ctx.fillRect(-7, -4, 5, 8);
  ctx.fillRect(2, -4, 5, 8);

  // Crimson & Gold Robes
  ctx.fillStyle = '#dc2626';
  ctx.beginPath();
  ctx.roundRect(-8, -20, 16, 17, 3);
  ctx.fill();
  ctx.fillStyle = '#facc15';
  ctx.fillRect(-8, -11, 16, 2.5);

  // Head
  ctx.fillStyle = '#ffedd5';
  ctx.beginPath();
  ctx.arc(0, -29, 13, 0, Math.PI * 2);
  ctx.fill();

  // Fiery Orange Beard
  ctx.fillStyle = '#ea580c';
  ctx.beginPath();
  ctx.moveTo(-7, -24);
  ctx.quadraticCurveTo(0, -14 + Math.sin(animTime * 12) * 2, 7, -24);
  ctx.lineTo(0, -18);
  ctx.closePath();
  ctx.fill();

  // Blazing Eyes
  ctx.fillStyle = '#7c2d12';
  ctx.beginPath();
  ctx.ellipse(-5, -29, 3, 4, 0, 0, Math.PI * 2);
  ctx.ellipse(5, -29, 3, 4, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#f97316';
  ctx.beginPath();
  ctx.ellipse(-5, -28.5, 2, 2.8, 0, 0, Math.PI * 2);
  ctx.ellipse(5, -28.5, 2, 2.8, 0, 0, Math.PI * 2);
  ctx.fill();

  // Twin Curved Flaming Dao Blades
  const slash = animState === 'attack' ? Math.sin(animTime * 24) * 1.8 : 0.3;
  // Sword 1
  ctx.save();
  ctx.translate(-11, -12);
  ctx.rotate(-slash);
  ctx.strokeStyle = '#f97316';
  ctx.lineWidth = 3;
  ctx.shadowColor = '#ea580c';
  ctx.shadowBlur = 8;
  ctx.beginPath();
  ctx.arc(0, 0, 13, -Math.PI * 0.5, 0);
  ctx.stroke();
  ctx.restore();

  // Sword 2
  ctx.save();
  ctx.translate(11, -12);
  ctx.rotate(slash);
  ctx.strokeStyle = '#f97316';
  ctx.lineWidth = 3;
  ctx.shadowColor = '#ea580c';
  ctx.shadowBlur = 8;
  ctx.beginPath();
  ctx.arc(0, 0, 13, 0, Math.PI * 0.5);
  ctx.stroke();
  ctx.restore();
}

// =========================================================================
// 15. RAIJIN (STORM SPIRIT): THE JOVIAL ELEMENTAL
// Plump Jovial Face, Jade Vest, Crackling Lightning Orbs
// =========================================================================
function drawChibiRaijin(ctx: CanvasRenderingContext2D, animState: string, animTime: number) {
  // Round Blue Elemental Body
  ctx.fillStyle = '#38bdf8';
  ctx.beginPath();
  ctx.roundRect(-10, -18, 20, 18, 8);
  ctx.fill();

  // Imperial Jade Vest
  ctx.fillStyle = '#059669';
  ctx.fillRect(-10, -18, 6, 16);
  ctx.fillRect(4, -18, 6, 16);
  ctx.fillStyle = '#facc15';
  ctx.fillRect(-10, -9, 20, 2.5);

  // Plump Round Head
  ctx.fillStyle = '#bae6fd';
  ctx.beginPath();
  ctx.arc(0, -29, 14, 0, Math.PI * 2);
  ctx.fill();

  // Cheerful Chubby Cheeks
  ctx.fillStyle = '#38bdf8';
  ctx.beginPath();
  ctx.arc(-9, -27, 4, 0, Math.PI * 2);
  ctx.arc(9, -27, 4, 0, Math.PI * 2);
  ctx.fill();

  // Jovial Smiling Anime Eyes
  ctx.strokeStyle = '#0284c7';
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.arc(-5, -29, 3, Math.PI * 0.2, Math.PI * 0.8, true);
  ctx.arc(5, -29, 3, Math.PI * 0.2, Math.PI * 0.8, true);
  ctx.stroke();

  // Big Happy Grin
  ctx.beginPath();
  ctx.arc(0, -24, 4, 0, Math.PI);
  ctx.stroke();

  // Little Elemental Hat
  ctx.fillStyle = '#059669';
  ctx.beginPath();
  ctx.roundRect(-6, -44, 12, 6, 2);
  ctx.fill();
  ctx.fillStyle = '#facc15';
  ctx.beginPath();
  ctx.arc(0, -45, 2.5, 0, Math.PI * 2);
  ctx.fill();

  // Crackling Electric Sparks Orbiting Hands
  const sparkX = Math.cos(animTime * 12) * 16;
  const sparkY = Math.sin(animTime * 12) * 8 - 14;
  ctx.fillStyle = '#ffffff';
  ctx.shadowColor = '#00f2ff';
  ctx.shadowBlur = 10;
  ctx.beginPath();
  ctx.arc(sparkX, sparkY, 3, 0, Math.PI * 2);
  ctx.fill();
}

// =========================================================================
// 16. KAOLIN (EARTH SPIRIT): THE TERRACOTTA WARRIOR
// Terracotta Armor, Jade Stone Staff & Floating Jade Boulder
// =========================================================================
function drawChibiKaolin(ctx: CanvasRenderingContext2D, animState: string, animTime: number) {
  // Floating Jade Stone Boulder beside shoulder
  ctx.save();
  const rockBob = Math.sin(animTime * 5) * 4;
  ctx.translate(-18, -32 + rockBob);
  ctx.fillStyle = '#059669';
  ctx.shadowColor = '#10b981';
  ctx.shadowBlur = 6;
  ctx.beginPath();
  ctx.arc(0, 0, 6, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  // Boots
  ctx.fillStyle = '#451a03';
  ctx.fillRect(-7, -4, 5, 8);
  ctx.fillRect(2, -4, 5, 8);

  // Terracotta & Jade Armor Plates
  ctx.fillStyle = '#78350f';
  ctx.beginPath();
  ctx.roundRect(-9, -20, 18, 17, 3);
  ctx.fill();
  ctx.fillStyle = '#059669';
  ctx.fillRect(-9, -16, 18, 4);

  // Head
  ctx.fillStyle = '#fed7aa';
  ctx.beginPath();
  ctx.arc(0, -29, 13, 0, Math.PI * 2);
  ctx.fill();

  // Warrior Topknot & Headband
  ctx.fillStyle = '#1c1917';
  ctx.beginPath();
  ctx.arc(0, -42, 4, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#059669';
  ctx.fillRect(-10, -38, 20, 3.5);

  // Firm Jade Eyes
  ctx.fillStyle = '#065f46';
  ctx.beginPath();
  ctx.ellipse(-5, -29, 3, 4, 0, 0, Math.PI * 2);
  ctx.ellipse(5, -29, 3, 4, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#10b981';
  ctx.beginPath();
  ctx.ellipse(-5, -28.5, 2, 2.5, 0, 0, Math.PI * 2);
  ctx.ellipse(5, -28.5, 2, 2.5, 0, 0, Math.PI * 2);
  ctx.fill();

  // Carved Jade Stone Staff
  ctx.save();
  ctx.translate(11, -14);
  ctx.strokeStyle = '#059669';
  ctx.lineWidth = 3.5;
  ctx.shadowColor = '#34d399';
  ctx.shadowBlur = 6;
  ctx.beginPath();
  ctx.moveTo(0, 14); ctx.lineTo(0, -20); ctx.stroke();
  ctx.fillStyle = '#34d399';
  ctx.fillRect(-4, -22, 8, 4);
  ctx.restore();
}

// =========================================================================
// 17. INAI (VOID SPIRIT): THE ASTRAL ENIGMA
// Deep Purple Cosmic Robes, Glowing Astral Eyes & Void Double Blade
// =========================================================================
function drawChibiInai(ctx: CanvasRenderingContext2D, animState: string, animTime: number) {
  // Astral Void Cloak
  ctx.save();
  ctx.fillStyle = '#2e1065';
  ctx.beginPath();
  ctx.moveTo(-10, -18);
  ctx.lineTo(-22, -2 + Math.sin(animTime * 6) * 3);
  ctx.lineTo(-6, 4);
  ctx.closePath();
  ctx.fill();
  ctx.restore();

  // Boots
  ctx.fillStyle = '#1e1b4b';
  ctx.fillRect(-7, -4, 5, 8);
  ctx.fillRect(2, -4, 5, 8);

  // Cosmic Astral Robe
  ctx.fillStyle = '#4c1d95';
  ctx.beginPath();
  ctx.roundRect(-8, -20, 16, 17, 3);
  ctx.fill();
  ctx.fillStyle = '#c084fc';
  ctx.fillRect(-8, -11, 16, 2.5);

  // Head in Cosmic Cowl
  ctx.fillStyle = '#2e1065';
  ctx.beginPath();
  ctx.arc(0, -29, 13, 0, Math.PI * 2);
  ctx.fill();

  // Glowing Purple Astral Eyes
  ctx.fillStyle = '#c084fc';
  ctx.shadowColor = '#c084fc';
  ctx.shadowBlur = 10;
  ctx.beginPath();
  ctx.arc(-5, -29, 2.8, 0, Math.PI * 2);
  ctx.arc(5, -29, 2.8, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.arc(-5.5, -29.5, 1.2, 0, Math.PI * 2);
  ctx.arc(4.5, -29.5, 1.2, 0, Math.PI * 2);
  ctx.fill();
  ctx.shadowBlur = 0;

  // Double-Ended Void Glaive
  const spin = animState === 'attack' ? Math.sin(animTime * 24) * 2.2 : 0.4;
  ctx.save();
  ctx.translate(11, -14);
  ctx.rotate(spin);
  ctx.strokeStyle = '#a855f7';
  ctx.lineWidth = 3;
  ctx.shadowColor = '#c084fc';
  ctx.shadowBlur = 8;
  ctx.beginPath();
  ctx.moveTo(0, -18); ctx.lineTo(0, 18); ctx.stroke();
  // Blade Tips
  ctx.fillStyle = '#e9d5ff';
  ctx.beginPath();
  ctx.moveTo(-3, -18); ctx.lineTo(0, -24); ctx.lineTo(3, -18); ctx.fill();
  ctx.moveTo(-3, 18); ctx.lineTo(0, 24); ctx.lineTo(3, 18); ctx.fill();
  ctx.restore();
}

function drawDefaultChampion(ctx: CanvasRenderingContext2D, team: string) {
  ctx.fillStyle = team === 'blue' ? '#0284c7' : '#e11d48';
  ctx.beginPath();
  ctx.arc(0, -20, 11, 0, Math.PI * 2);
  ctx.fill();
}

function drawNewChampionSprite(ctx: CanvasRenderingContext2D, name: string, animState: string, animTime: number) {
  const colors: Record<string, [string, string]> = {
    Veyara: ['#0f766e', '#fde047'], Cinderlock: ['#7c2d12', '#fb923c'],
    Solenne: ['#0f766e', '#f8fafc'], Croakwell: ['#65a30d', '#facc15'],
    'Soulscourge': ['#450a0a', '#fb7185'], Stonewake: ['#92400e', '#fcd34d'],
    Mirehook: ['#36513e', '#b5d36b'], Nullweaver: ['#34205f', '#a78bfa'],
    Voltgrip: ['#70591d', '#fde047'], Aetherbolt: ['#14527b', '#67e8f9'],
    Corsara: ['#7f1d35', '#fb7185'], Brewmaw: ['#693916', '#f59e0b'],
    Wraithhook: ['#155e58', '#5eead4'],
  };
  const [body, glow] = colors[name];
  const casting = animState === 'cast' || animState === 'attack';
  ctx.save();
  ctx.shadowColor = glow;
  ctx.shadowBlur = casting ? 20 : 7;
  ctx.fillStyle = body;
  ctx.beginPath();
  ctx.moveTo(-12, -22); ctx.lineTo(12, -22); ctx.lineTo(16, 0); ctx.lineTo(-16, 0); ctx.closePath();
  ctx.fill();
  ctx.fillStyle = name === 'Croakwell' ? '#a3e635' : name === 'Soulscourge' ? '#7f1d1d' : '#f5cba7';
  ctx.beginPath(); ctx.arc(0, -32, 14, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = name === 'Soulscourge' ? '#fda4af' : '#0f172a';
  ctx.beginPath(); ctx.arc(-5, -33, 2.2, 0, Math.PI * 2); ctx.arc(5, -33, 2.2, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = glow;
  ctx.fillStyle = glow;
  ctx.lineWidth = 4;
  ctx.lineCap = 'round';
  const pulse = casting ? Math.sin(animTime * 18) * 3 : 0;
  if (name === 'Veyara') {
    ctx.beginPath(); ctx.arc(13, -18, 15 + pulse, -1.1, 1.35); ctx.stroke();
  } else if (name === 'Cinderlock') {
    for (let i = 0; i < 3; i++) {
      ctx.beginPath(); ctx.moveTo(10, -27 + i * 8); ctx.lineTo(29 + pulse, -34 + i * 8); ctx.stroke();
    }
  } else if (name === 'Solenne') {
    ctx.lineWidth = 6;
    ctx.beginPath(); ctx.moveTo(8, -18); ctx.lineTo(32 + pulse, -21); ctx.stroke();
    ctx.fillRect(19, -28, 11, 5);
  } else if (name === 'Croakwell') {
    ctx.beginPath(); ctx.arc(-8, -45, 6, 0, Math.PI * 2); ctx.arc(8, -45, 6, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.ellipse(15, -14, 8, 11, -0.5, 0, Math.PI * 2); ctx.stroke();
    ctx.lineWidth = 1.5;
    for (let i = 0; i < 3; i++) { ctx.beginPath(); ctx.moveTo(10 + i * 3, -23); ctx.lineTo(16 + i * 3, -5); ctx.stroke(); }
  } else if (name === 'Soulscourge') {
    ctx.beginPath(); ctx.moveTo(-11, -41); ctx.lineTo(-17, -55); ctx.lineTo(-2, -44);
    ctx.moveTo(11, -41); ctx.lineTo(17, -55); ctx.lineTo(2, -44); ctx.stroke();
    ctx.beginPath(); ctx.arc(20, -16, 6 + pulse, 0, Math.PI * 2); ctx.fill();
  } else if (name === 'Mirehook' || name === 'Wraithhook') {
    ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(10, -24); ctx.lineTo(29 + pulse, -21);
    ctx.lineTo(34 + pulse, -8); ctx.arc(29 + pulse, -7, 5, 0, Math.PI); ctx.stroke();
    if (name === 'Wraithhook') { ctx.fillRect(-28, -22, 12, 16); ctx.strokeRect(-29, -23, 14, 18); }
  } else if (name === 'Nullweaver') {
    ctx.beginPath(); ctx.arc(21, -23, 10 + pulse, 0, Math.PI * 2); ctx.stroke();
    ctx.beginPath(); ctx.arc(21, -23, 4, 0, Math.PI * 2); ctx.fill();
  } else if (name === 'Voltgrip') {
    ctx.lineWidth = 8; ctx.beginPath(); ctx.moveTo(10, -22); ctx.lineTo(31 + pulse, -18); ctx.stroke();
    ctx.lineWidth = 3; ctx.strokeRect(26 + pulse, -24, 16, 12);
  } else if (name === 'Aetherbolt') {
    ctx.lineWidth = 6; ctx.beginPath(); ctx.moveTo(10, -22); ctx.lineTo(31 + pulse, -29); ctx.stroke();
    ctx.beginPath(); ctx.arc(32 + pulse, -29, 5, 0, Math.PI * 2); ctx.fill();
  } else if (name === 'Corsara') {
    ctx.fillRect(-26, -24, 19, 5); ctx.fillRect(9, -24, 20, 5);
    ctx.fillRect(-22, -19, 4, 8); ctx.fillRect(22, -19, 4, 8);
  } else if (name === 'Brewmaw') {
    ctx.fillStyle = '#a16207'; ctx.beginPath(); ctx.ellipse(25, -16, 14, 18, 0, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#fbbf24'; ctx.strokeRect(14, -25, 22, 18);
  } else {
    ctx.lineWidth = 7;
    ctx.beginPath(); ctx.moveTo(13, -21); ctx.lineTo(25, -49); ctx.stroke();
    ctx.fillRect(17, -55, 19, 10);
  }
  // Each recent avatar has a distinct cast pose and animated accessory.
  if (casting) {
    const phase = animTime * 13;
    ctx.lineWidth = 2.5;
    ctx.shadowBlur = 16;
    if (name === 'Veyara') {
      ['#38bdf8', '#a3e635', '#fbbf24'].forEach((element, i) => {
        const a = phase + i * Math.PI * 2 / 3;
        ctx.fillStyle = element;
        ctx.beginPath(); ctx.arc(Math.cos(a) * 24, -20 + Math.sin(a) * 16, 4, 0, Math.PI * 2); ctx.fill();
      });
    } else if (name === 'Cinderlock') {
      ctx.strokeStyle = '#fed7aa';
      for (let i = 0; i < 3; i++) {
        ctx.beginPath(); ctx.moveTo(13, -27 + i * 8);
        ctx.lineTo(31 + Math.sin(phase + i) * 8, -35 + i * 8); ctx.stroke();
      }
    } else if (name === 'Solenne') {
      ctx.strokeStyle = '#ffffff';
      ctx.beginPath(); ctx.moveTo(25, -22); ctx.lineTo(42 + Math.sin(phase) * 7, -22); ctx.stroke();
      ctx.beginPath(); ctx.arc(32, -22, 5 + Math.sin(phase) * 2, 0, Math.PI * 2); ctx.stroke();
    } else if (name === 'Croakwell') {
      ctx.fillStyle = '#fef08a';
      ctx.font = 'bold 16px system-ui';
      ctx.fillText('♪', 24, -32 + Math.sin(phase) * 5);
      ctx.fillText('♫', -28, -38 - Math.sin(phase) * 4);
    } else if (name === 'Soulscourge') {
      ctx.fillStyle = '#fda4af';
      for (let i = 0; i < 4; i++) {
        const a = phase * 0.5 + i * Math.PI / 2;
        ctx.beginPath(); ctx.arc(Math.cos(a) * 26, -22 + Math.sin(a) * 14,
          3 + Math.sin(phase + i), 0, Math.PI * 2); ctx.fill();
      }
    } else if (name === 'Stonewake') {
      ctx.strokeStyle = '#fef08a';
      for (let i = -1; i <= 1; i++) {
        ctx.beginPath(); ctx.moveTo(i * 8, 3);
        ctx.lineTo(i * 15 + Math.sin(phase + i) * 4, 11);
        ctx.lineTo(i * 20, 16); ctx.stroke();
      }
    } else {
      ctx.strokeStyle = glow;
      ctx.beginPath(); ctx.arc(0, -22, 24 + Math.sin(phase) * 3, 0, Math.PI * 2); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(12, -20); ctx.lineTo(34 + Math.sin(phase) * 9, -22); ctx.stroke();
    }
  }
  ctx.restore();
}

// =========================================================================
// 31. KAELEN (INVOKER): ARSENAL GRAND MAGUS
// Royal Crimson Robes, High Mantle Collar, Golden Hair, Crown & Spellweave Catalyst
// =========================================================================
function drawChibiKaelen(ctx: CanvasRenderingContext2D, animState: string, animTime: number) {
  const isCasting = animState === 'cast' || animState === 'attack';

  // Flowing Royal Crimson & Gold Cape Behind
  ctx.save();
  ctx.fillStyle = '#991b1b';
  ctx.strokeStyle = '#f59e0b';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(-10, -18);
  ctx.quadraticCurveTo(-22 + Math.sin(animTime * 3) * 4, -5, -18, 6);
  ctx.lineTo(-4, 4);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.restore();

  // Regal White Trousers & Gold Pointed Boots
  ctx.fillStyle = '#f8fafc';
  ctx.fillRect(-7, -4, 5, 8);
  ctx.fillRect(2, -4, 5, 8);
  ctx.fillStyle = '#d97706';
  ctx.fillRect(-8, 1, 6, 4);
  ctx.fillRect(1, 1, 6, 4);
  // Gold Pointed Boot Tips
  ctx.fillStyle = '#fbbf24';
  ctx.beginPath();
  ctx.moveTo(-2, 3); ctx.lineTo(1, 5); ctx.lineTo(-2, 5); ctx.fill();
  ctx.moveTo(7, 3); ctx.lineTo(10, 5); ctx.lineTo(7, 5); ctx.fill();

  // Regal Grand Magus Robe (Crimson & Gold Embroidered)
  ctx.fillStyle = '#7f1d1d';
  ctx.beginPath();
  ctx.roundRect(-8, -20, 16, 17, 3);
  ctx.fill();
  // Gold Trim Brocade Center
  ctx.fillStyle = '#fde047';
  ctx.fillRect(-2, -20, 4, 17);
  // Royal Sash
  ctx.fillStyle = '#b45309';
  ctx.fillRect(-8, -10, 16, 2.5);

  // High Upturned Magus Mantle Collar
  ctx.fillStyle = '#dc2626';
  ctx.strokeStyle = '#fde047';
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.moveTo(-11, -19); ctx.lineTo(-17, -32); ctx.lineTo(-8, -24); ctx.closePath(); ctx.fill(); ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(11, -19); ctx.lineTo(17, -32); ctx.lineTo(8, -24); ctx.closePath(); ctx.fill(); ctx.stroke();

  // Long Flowing Golden Platinum Hair (Back locks)
  ctx.fillStyle = '#fde047';
  ctx.beginPath();
  ctx.moveTo(-12, -28); ctx.quadraticCurveTo(-18, -16, -15, -4); ctx.lineTo(-8, -12); ctx.fill();
  ctx.beginPath();
  ctx.moveTo(12, -28); ctx.quadraticCurveTo(18, -16, 15, -4); ctx.lineTo(8, -12); ctx.fill();

  // Chibi Head
  ctx.fillStyle = '#fffbeb';
  ctx.beginPath();
  ctx.arc(0, -29, 13, 0, Math.PI * 2);
  ctx.fill();

  // Soft Noble Blush
  ctx.fillStyle = 'rgba(251, 146, 60, 0.35)';
  ctx.beginPath();
  ctx.arc(-7, -26, 2.8, 0, Math.PI * 2);
  ctx.arc(7, -26, 2.8, 0, Math.PI * 2);
  ctx.fill();

  // Glowing Golden Anime Eyes
  ctx.fillStyle = '#92400e';
  ctx.beginPath();
  ctx.ellipse(-5, -29, 3.2, 4.2, 0, 0, Math.PI * 2);
  ctx.ellipse(5, -29, 3.2, 4.2, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#f59e0b';
  ctx.beginPath();
  ctx.ellipse(-5, -28.5, 2.2, 3, 0, 0, Math.PI * 2);
  ctx.ellipse(5, -28.5, 2.2, 3, 0, 0, Math.PI * 2);
  ctx.fill();
  // Starry Glimmer in Eyes
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.arc(-6, -30.5, 1.2, 0, Math.PI * 2);
  ctx.arc(4, -30.5, 1.2, 0, Math.PI * 2);
  ctx.fill();

  // Elegant Magus Smile
  ctx.strokeStyle = '#b45309';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.arc(0, -24, 2, 0.2, Math.PI - 0.2);
  ctx.stroke();

  // Front Golden Hair Bangs
  ctx.fillStyle = '#fef08a';
  ctx.beginPath();
  ctx.moveTo(-13, -34);
  ctx.quadraticCurveTo(-6, -37, 0, -32);
  ctx.quadraticCurveTo(6, -37, 13, -34);
  ctx.quadraticCurveTo(8, -43, 0, -43);
  ctx.quadraticCurveTo(-8, -43, -13, -34);
  ctx.fill();

  // Arcane Magus Diadem / Crown
  ctx.fillStyle = '#f59e0b';
  ctx.strokeStyle = '#fef08a';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(-8, -39); ctx.lineTo(0, -45); ctx.lineTo(8, -39); ctx.lineTo(0, -40); ctx.closePath();
  ctx.fill(); ctx.stroke();
  // Crown Ruby
  ctx.fillStyle = '#ef4444';
  ctx.beginPath();
  ctx.arc(0, -41, 1.8, 0, Math.PI * 2);
  ctx.fill();

  // Grand Magus Scepter / Spellweave Catalyst
  ctx.save();
  ctx.translate(12, -14);
  const castTilt = isCasting ? -0.4 + Math.sin(animTime * 16) * 0.2 : 0.1;
  ctx.rotate(castTilt);
  ctx.strokeStyle = '#78350f';
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.moveTo(0, 14); ctx.lineTo(0, -18); ctx.stroke();
  // Golden Scepter Head
  ctx.fillStyle = '#f59e0b';
  ctx.strokeStyle = '#fef08a';
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.arc(0, -20, 4.5, 0, Math.PI * 2);
  ctx.fill(); ctx.stroke();
  // Channeling Arcane Core Gem
  ctx.fillStyle = isCasting ? '#fde047' : '#f97316';
  ctx.shadowColor = '#fbbf24';
  ctx.shadowBlur = isCasting ? 14 : 6;
  ctx.beginPath();
  ctx.arc(0, -20, 2.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

// =========================================================================
// 32. HWEILIN (HWEI): VISIONARY INK PAINTER
// Teal Flowing Scarf, Ink-Splattered Coat, Giant Bamboo Brush & Pigment Sparks
// =========================================================================
function drawChibiHweilin(ctx: CanvasRenderingContext2D, animState: string, animTime: number) {
  const isCasting = animState === 'cast' || animState === 'attack';

  // Flowing Turquoise/Cyan Ink-Stained Scarf
  ctx.save();
  ctx.fillStyle = '#0f766e';
  ctx.strokeStyle = '#2dd4bf';
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.moveTo(-10, -20);
  ctx.quadraticCurveTo(-22 + Math.sin(animTime * 4) * 3, -12, -18 + Math.sin(animTime * 5) * 4, 3);
  ctx.lineTo(-12, -3);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.restore();

  // Dark Indigo Artist Trousers & Cloth Sandals
  ctx.fillStyle = '#1e1b4b';
  ctx.fillRect(-7, -4, 5, 8);
  ctx.fillRect(2, -4, 5, 8);
  ctx.fillStyle = '#312e81';
  ctx.fillRect(-8, 1, 6, 3.5);
  ctx.fillRect(1, 1, 6, 3.5);

  // Painter's Ink Tunic (Slate Blue & Indigo)
  ctx.fillStyle = '#1e293b';
  ctx.beginPath();
  ctx.roundRect(-8, -20, 16, 17, 3);
  ctx.fill();
  // Turquoise Sash & Ink Palette Belt
  ctx.fillStyle = '#0d9488';
  ctx.fillRect(-8, -10, 16, 2.5);
  // Colorful Pigment Stains on Coat
  ctx.fillStyle = '#ec4899';
  ctx.beginPath(); ctx.arc(-4, -14, 1.4, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#06b6d4';
  ctx.beginPath(); ctx.arc(3, -16, 1.2, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#eab308';
  ctx.beginPath(); ctx.arc(5, -7, 1.3, 0, Math.PI * 2); ctx.fill();

  // Chibi Head
  ctx.fillStyle = '#ffedd5';
  ctx.beginPath();
  ctx.arc(0, -29, 13, 0, Math.PI * 2);
  ctx.fill();

  // Soft Artistic Blush
  ctx.fillStyle = 'rgba(20, 184, 166, 0.25)';
  ctx.beginPath();
  ctx.arc(-7, -26, 2.8, 0, Math.PI * 2);
  ctx.arc(7, -26, 2.8, 0, Math.PI * 2);
  ctx.fill();

  // Expressive Deep Teal/Indigo Anime Eyes
  ctx.fillStyle = '#0f172a';
  ctx.beginPath();
  ctx.ellipse(-5, -29, 3, 4, 0, 0, Math.PI * 2);
  ctx.ellipse(5, -29, 3, 4, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#14b8a6';
  ctx.beginPath();
  ctx.ellipse(-5, -28.5, 2, 2.8, 0, 0, Math.PI * 2);
  ctx.ellipse(5, -28.5, 2, 2.8, 0, 0, Math.PI * 2);
  ctx.fill();
  // Specular Reflection
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.arc(-6, -30.5, 1.1, 0, Math.PI * 2);
  ctx.arc(4, -30.5, 1.1, 0, Math.PI * 2);
  ctx.fill();

  // Gentle Pensive Smile
  ctx.strokeStyle = '#0f766e';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.arc(0, -24, 2, 0.3, Math.PI - 0.3);
  ctx.stroke();

  // Tousled Dark Ink-Black Hair with Flowing Bangs
  ctx.fillStyle = '#0f172a';
  ctx.beginPath();
  ctx.moveTo(-13, -32);
  ctx.quadraticCurveTo(-6, -37, -2, -31);
  ctx.quadraticCurveTo(4, -37, 13, -33);
  ctx.quadraticCurveTo(10, -43, 0, -43);
  ctx.quadraticCurveTo(-10, -43, -13, -32);
  ctx.fill();
  // Side Forehead Lock
  ctx.beginPath();
  ctx.moveTo(-3, -34); ctx.quadraticCurveTo(2, -26, 1, -22); ctx.lineTo(-1, -30); ctx.fill();

  // Giant Bamboo Ink Brush (Signature Weapon)
  ctx.save();
  ctx.translate(11, -14);
  const brushSwing = isCasting ? Math.sin(animTime * 18) * 0.7 - 0.3 : 0.2;
  ctx.rotate(brushSwing);
  // Bamboo Shaft
  ctx.strokeStyle = '#78350f';
  ctx.lineWidth = 3.2;
  ctx.beginPath();
  ctx.moveTo(0, 14); ctx.lineTo(0, -18); ctx.stroke();
  // Golden Brass Ferrule
  ctx.fillStyle = '#eab308';
  ctx.fillRect(-2.5, -21, 5, 4);
  // White Horsehair Brush Bristles
  ctx.fillStyle = '#f8fafc';
  ctx.beginPath();
  ctx.moveTo(-3, -21); ctx.lineTo(3, -21); ctx.lineTo(2, -29); ctx.lineTo(-2, -29); ctx.closePath();
  ctx.fill();
  // Glowing Violet & Cyan Ink Tip
  ctx.fillStyle = isCasting ? '#a855f7' : '#06b6d4';
  ctx.shadowColor = '#a855f7';
  ctx.shadowBlur = isCasting ? 12 : 5;
  ctx.beginPath();
  ctx.moveTo(-2, -28); ctx.lineTo(2, -28); ctx.lineTo(0, -35); ctx.closePath();
  ctx.fill();
  ctx.shadowBlur = 0;

  // Floating Ink Splatters when casting
  if (isCasting) {
    ctx.fillStyle = '#a855f7';
    ctx.beginPath(); ctx.arc(-6, -32, 1.8, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#06b6d4';
    ctx.beginPath(); ctx.arc(6, -34, 1.5, 0, Math.PI * 2); ctx.fill();
  }
  ctx.restore();
}

// =========================================================================
// 33. JAXON (JAYCE): HEXTECH DEFENDER
// Polished Piltover Cuirass, Gold Pauldron, Mercury Hammer with Cyan Core
// =========================================================================
function drawChibiJaxon(ctx: CanvasRenderingContext2D, animState: string, animTime: number) {
  const isAttacking = animState === 'attack' || animState === 'cast';

  // Piltover Armored Boots & Greaves
  ctx.fillStyle = '#1e293b';
  ctx.fillRect(-7, -4, 5, 8);
  ctx.fillRect(2, -4, 5, 8);
  ctx.fillStyle = '#e2e8f0';
  ctx.fillRect(-8, 1, 6, 4);
  ctx.fillRect(1, 1, 6, 4);
  ctx.fillStyle = '#eab308';
  ctx.fillRect(-8, -2, 6, 2.5); // Gold knee plates
  ctx.fillRect(1, -2, 6, 2.5);

  // Polished Ivory/Navy Cuirass & Gold Pauldron
  ctx.fillStyle = '#0f172a';
  ctx.beginPath();
  ctx.roundRect(-8, -20, 16, 17, 3);
  ctx.fill();
  // Silver Breastplate Inset
  ctx.fillStyle = '#e2e8f0';
  ctx.beginPath();
  ctx.roundRect(-5, -19, 10, 11, 2);
  ctx.fill();
  // Hextech Power Conduit on Chest
  ctx.fillStyle = '#00f2ff';
  ctx.shadowColor = '#38bdf8';
  ctx.shadowBlur = 6;
  ctx.beginPath();
  ctx.arc(0, -14, 2.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.shadowBlur = 0;
  // Gold Belt
  ctx.fillStyle = '#eab308';
  ctx.fillRect(-8, -8, 16, 2.5);

  // Left Heavy Gold Pauldron
  ctx.fillStyle = '#f59e0b';
  ctx.strokeStyle = '#fef08a';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.roundRect(-13, -22, 6, 8, 2);
  ctx.fill(); ctx.stroke();

  // Handsome Hero Chibi Head
  ctx.fillStyle = '#ffedd5';
  ctx.beginPath();
  ctx.arc(0, -29, 13, 0, Math.PI * 2);
  ctx.fill();

  // Subtle Cheek Tone
  ctx.fillStyle = 'rgba(251, 146, 60, 0.25)';
  ctx.beginPath();
  ctx.arc(-7, -26, 2.5, 0, Math.PI * 2);
  ctx.arc(7, -26, 2.5, 0, Math.PI * 2);
  ctx.fill();

  // Confident Sapphire Blue Anime Eyes
  ctx.fillStyle = '#1e3a8a';
  ctx.beginPath();
  ctx.ellipse(-5, -29, 3.2, 4.2, 0, 0, Math.PI * 2);
  ctx.ellipse(5, -29, 3.2, 4.2, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#38bdf8';
  ctx.beginPath();
  ctx.ellipse(-5, -28.5, 2.2, 3, 0, 0, Math.PI * 2);
  ctx.ellipse(5, -28.5, 2.2, 3, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.arc(-6, -30.5, 1.2, 0, Math.PI * 2);
  ctx.arc(4, -30.5, 1.2, 0, Math.PI * 2);
  ctx.fill();

  // Confident Hero Smirk
  ctx.strokeStyle = '#9a3412';
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.moveTo(-2, -24); ctx.quadraticCurveTo(1, -22, 4, -24.5);
  ctx.stroke();

  // Styled Chestnut Hero Hair
  ctx.fillStyle = '#451a03';
  ctx.beginPath();
  ctx.moveTo(-13, -33);
  ctx.quadraticCurveTo(-6, -38, 0, -34);
  ctx.quadraticCurveTo(6, -38, 13, -33);
  ctx.quadraticCurveTo(11, -44, 2, -44);
  ctx.quadraticCurveTo(-8, -44, -13, -33);
  ctx.fill();
  // Hero Hair Quiff
  ctx.fillStyle = '#78350f';
  ctx.beginPath();
  ctx.moveTo(-3, -38); ctx.quadraticCurveTo(4, -46, 8, -39); ctx.lineTo(1, -38); ctx.fill();

  // Hextech Mercury Hammer / Shock Cannon (Right Hand)
  ctx.save();
  ctx.translate(12, -14);
  const hammerSwing = isAttacking ? -0.5 + Math.sin(animTime * 20) * 0.4 : 0.2;
  ctx.rotate(hammerSwing);
  // Heavy Steel Shaft
  ctx.strokeStyle = '#475569';
  ctx.lineWidth = 3.5;
  ctx.beginPath();
  ctx.moveTo(0, 14); ctx.lineTo(0, -20); ctx.stroke();
  // Brass Gears & Core Mount
  ctx.fillStyle = '#f59e0b';
  ctx.fillRect(-4, -24, 8, 6);
  // Massive Hammerhead (Steel & Gold Trim)
  ctx.fillStyle = '#1e293b';
  ctx.strokeStyle = '#eab308';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.roundRect(-10, -32, 20, 9, 3);
  ctx.fill(); ctx.stroke();
  // Glowing Cyan Hextech Crystal Core
  ctx.fillStyle = '#00f2ff';
  ctx.shadowColor = '#00f2ff';
  ctx.shadowBlur = isAttacking ? 16 : 8;
  ctx.beginPath();
  ctx.arc(0, -27.5, 3.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.shadowBlur = 0;
  ctx.restore();
}

// =========================================================================
// 34. VALERIE (VI): PILTOVER ENFORCER
// Hot Pink Punk Hair, Goggles, Crimson Vest & Massive Dual Steam Gauntlets
// =========================================================================
function drawChibiValerie(ctx: CanvasRenderingContext2D, animState: string, animTime: number) {
  const isPunching = animState === 'attack' || animState === 'cast';
  const punchL = isPunching ? Math.sin(animTime * 24) * 6 : 0;
  const punchR = isPunching ? -Math.sin(animTime * 24) * 6 : 0;

  // Tough Brawler Trousers & Heavy Combat Boots
  ctx.fillStyle = '#1e293b';
  ctx.fillRect(-7, -4, 5, 8);
  ctx.fillRect(2, -4, 5, 8);
  ctx.fillStyle = '#0f172a';
  ctx.fillRect(-8, 1, 6, 4);
  ctx.fillRect(1, 1, 6, 4);
  // Knee Metal Plates
  ctx.fillStyle = '#64748b';
  ctx.fillRect(-7.5, -2, 5, 2);
  ctx.fillRect(2.5, -2, 5, 2);

  // Crimson Leather Brawler Vest
  ctx.fillStyle = '#991b1b';
  ctx.beginPath();
  ctx.roundRect(-8, -20, 16, 17, 3);
  ctx.fill();
  // White Undershirt Lapel
  ctx.fillStyle = '#f8fafc';
  ctx.beginPath();
  ctx.moveTo(-4, -20); ctx.lineTo(0, -14); ctx.lineTo(4, -20); ctx.closePath();
  ctx.fill();
  // Utility Belt
  ctx.fillStyle = '#0f172a';
  ctx.fillRect(-8, -9, 16, 2.5);

  // Chibi Head
  ctx.fillStyle = '#ffedd5';
  ctx.beginPath();
  ctx.arc(0, -29, 13, 0, Math.PI * 2);
  ctx.fill();

  // Cheek Tattoo ('VI') & Cheek Tone
  ctx.fillStyle = '#0f172a';
  ctx.font = 'bold 5px sans-serif';
  ctx.fillText('VI', -9, -25);
  ctx.fillStyle = 'rgba(244, 63, 94, 0.3)';
  ctx.beginPath();
  ctx.arc(7, -26, 2.5, 0, Math.PI * 2);
  ctx.fill();

  // Fierce Hazel Anime Eyes
  ctx.fillStyle = '#451a03';
  ctx.beginPath();
  ctx.ellipse(-5, -29, 3.2, 4.2, 0, 0, Math.PI * 2);
  ctx.ellipse(5, -29, 3.2, 4.2, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#fbbf24';
  ctx.beginPath();
  ctx.ellipse(-5, -28.5, 2.2, 3, 0, 0, Math.PI * 2);
  ctx.ellipse(5, -28.5, 2.2, 3, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.arc(-6, -30.5, 1.2, 0, Math.PI * 2);
  ctx.arc(4, -30.5, 1.2, 0, Math.PI * 2);
  ctx.fill();

  // Feisty Grin
  ctx.strokeStyle = '#991b1b';
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.moveTo(-2, -24); ctx.quadraticCurveTo(2, -22, 4, -25);
  ctx.stroke();

  // Spiky Vibrant Hot-Pink Punk Hair
  ctx.fillStyle = '#db2777';
  ctx.beginPath();
  ctx.moveTo(-13, -33);
  ctx.quadraticCurveTo(-6, -39, 0, -34);
  ctx.quadraticCurveTo(6, -39, 13, -33);
  ctx.quadraticCurveTo(12, -45, 0, -45);
  ctx.quadraticCurveTo(-10, -45, -13, -33);
  ctx.fill();
  // Spiky Highlights
  ctx.fillStyle = '#f472b6';
  ctx.beginPath();
  ctx.moveTo(-8, -38); ctx.lineTo(-14, -46); ctx.lineTo(-4, -40); ctx.fill();
  ctx.beginPath();
  ctx.moveTo(-2, -40); ctx.lineTo(2, -48); ctx.lineTo(6, -39); ctx.fill();
  ctx.beginPath();
  ctx.moveTo(5, -39); ctx.lineTo(12, -45); ctx.lineTo(10, -36); ctx.fill();

  // Brass Aviator Goggles on Forehead
  ctx.fillStyle = '#b45309';
  ctx.fillRect(-9, -38, 18, 3.5);
  ctx.fillStyle = '#38bdf8';
  ctx.fillRect(-7, -37.5, 5, 2.5);
  ctx.fillRect(2, -37.5, 5, 2.5);

  // Left Atlas Gauntlet
  ctx.save();
  ctx.translate(-14 + punchL, -14);
  ctx.fillStyle = '#d97706';
  ctx.strokeStyle = '#475569';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.roundRect(-6, -7, 12, 14, 3);
  ctx.fill(); ctx.stroke();
  // Heavy Knuckle Plate
  ctx.fillStyle = '#334155';
  ctx.fillRect(-5, -6, 10, 4);
  // Glowing Steam Valve
  ctx.fillStyle = '#fef08a';
  ctx.beginPath(); ctx.arc(0, 3, 2, 0, Math.PI * 2); ctx.fill();
  ctx.restore();

  // Right Atlas Gauntlet
  ctx.save();
  ctx.translate(14 + punchR, -14);
  ctx.fillStyle = '#d97706';
  ctx.strokeStyle = '#475569';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.roundRect(-6, -7, 12, 14, 3);
  ctx.fill(); ctx.stroke();
  // Heavy Knuckle Plate
  ctx.fillStyle = '#334155';
  ctx.fillRect(-5, -6, 10, 4);
  // Glowing Steam Valve
  ctx.fillStyle = '#fef08a';
  ctx.beginPath(); ctx.arc(0, 3, 2, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
}

// =========================================================================
// 35. JINXY (JINX): LOOSE CANNON
// Twin Floor-Length Cyan Braids, Starry Pink Eyes & Shark Rocket Launcher
// =========================================================================
function drawChibiJinxy(ctx: CanvasRenderingContext2D, animState: string, animTime: number) {
  const isShooting = animState === 'attack' || animState === 'cast';
  const recoil = isShooting ? Math.sin(animTime * 24) * 3 : 0;

  // Twin Floor-Length Electric Blue Braids (Rendered Behind)
  const braidWave = Math.sin(animTime * 6) * 3;
  ctx.save();
  ctx.fillStyle = '#0284c7';
  ctx.strokeStyle = '#38bdf8';
  ctx.lineWidth = 1;
  // Left Braid
  ctx.beginPath();
  ctx.moveTo(-11, -30);
  ctx.quadraticCurveTo(-18 + braidWave, -15, -15 - braidWave, 4);
  ctx.quadraticCurveTo(-12 + braidWave, 14, -14, 20);
  ctx.lineTo(-9, 19);
  ctx.quadraticCurveTo(-8 + braidWave, 10, -9 - braidWave, 0);
  ctx.closePath();
  ctx.fill(); ctx.stroke();
  // Right Braid
  ctx.beginPath();
  ctx.moveTo(11, -30);
  ctx.quadraticCurveTo(18 - braidWave, -15, 15 + braidWave, 4);
  ctx.quadraticCurveTo(12 - braidWave, 14, 14, 20);
  ctx.lineTo(9, 19);
  ctx.quadraticCurveTo(8 - braidWave, 10, 9 + braidWave, 0);
  ctx.closePath();
  ctx.fill(); ctx.stroke();
  // Braid Ties
  ctx.fillStyle = '#ec4899';
  ctx.fillRect(-16, 12, 4, 2);
  ctx.fillRect(12, 12, 4, 2);
  ctx.restore();

  // Striped Punk Boots & Stockings
  ctx.fillStyle = '#18181b';
  ctx.fillRect(-7, -4, 5, 8);
  ctx.fillRect(2, -4, 5, 8);
  ctx.fillStyle = '#ec4899';
  ctx.fillRect(-8, 1, 6, 4);
  ctx.fillStyle = '#0284c7';
  ctx.fillRect(1, 1, 6, 4);

  // Black Leather Crop Top & Bullet Bandolier
  ctx.fillStyle = '#18181b';
  ctx.beginPath();
  ctx.roundRect(-7, -20, 14, 16, 2);
  ctx.fill();
  // Pink Harness Straps
  ctx.fillStyle = '#ec4899';
  ctx.fillRect(-7, -19, 14, 2);
  // Gold Bullet Bandolier across chest
  ctx.fillStyle = '#facc15';
  for (let b = -4; b <= 4; b += 2.5) {
    ctx.fillRect(b - 0.7, -15 + b * 0.5, 1.4, 3);
  }

  // Porcelain Chibi Head
  ctx.fillStyle = '#fdf4ff';
  ctx.beginPath();
  ctx.arc(0, -29, 13, 0, Math.PI * 2);
  ctx.fill();

  // Manic Rosy Cheeks
  ctx.fillStyle = 'rgba(244, 63, 94, 0.4)';
  ctx.beginPath();
  ctx.arc(-7, -26, 3, 0, Math.PI * 2);
  ctx.arc(7, -26, 3, 0, Math.PI * 2);
  ctx.fill();

  // Wild Neon-Pink Anime Eyes with Star Sparkles
  ctx.fillStyle = '#831843';
  ctx.beginPath();
  ctx.ellipse(-5, -29, 3.2, 4.2, 0, 0, Math.PI * 2);
  ctx.ellipse(5, -29, 3.2, 4.2, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#f43f5e';
  ctx.beginPath();
  ctx.ellipse(-5, -28.5, 2.2, 3, 0, 0, Math.PI * 2);
  ctx.ellipse(5, -28.5, 2.2, 3, 0, 0, Math.PI * 2);
  ctx.fill();
  // Starry Highlights
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.arc(-6, -30.5, 1.3, 0, Math.PI * 2);
  ctx.arc(4, -30.5, 1.3, 0, Math.PI * 2);
  ctx.fill();

  // Wide Manic Toothy Grin
  ctx.fillStyle = '#991b1b';
  ctx.beginPath();
  ctx.arc(0, -23, 4, 0.1, Math.PI - 0.1);
  ctx.fill();
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(-3, -24, 6, 2); // White teeth row

  // Messy Neon Blue Bangs
  ctx.fillStyle = '#0284c7';
  ctx.beginPath();
  ctx.moveTo(-13, -33);
  ctx.quadraticCurveTo(-6, -39, 0, -32);
  ctx.quadraticCurveTo(6, -39, 13, -33);
  ctx.quadraticCurveTo(11, -44, 0, -44);
  ctx.quadraticCurveTo(-11, -44, -13, -33);
  ctx.fill();
  // Zigzag Bang strands
  ctx.fillStyle = '#38bdf8';
  ctx.beginPath();
  ctx.moveTo(-6, -34); ctx.lineTo(-2, -26); ctx.lineTo(1, -33); ctx.fill();

  // "Fishbones" Shark Rocket Launcher (Held on Right Shoulder)
  ctx.save();
  ctx.translate(12 - recoil, -16);
  ctx.fillStyle = '#475569';
  ctx.strokeStyle = '#94a3b8';
  ctx.lineWidth = 1.2;
  // Shark Body Tube
  ctx.beginPath();
  ctx.roundRect(-6, -8, 22, 10, 4);
  ctx.fill(); ctx.stroke();
  // Shark Jaws (White Painted Teeth)
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.moveTo(16, -8); ctx.lineTo(13, -5); ctx.lineTo(16, -2); ctx.lineTo(13, 1); ctx.lineTo(16, 2);
  ctx.stroke();
  // Glowing Red Shark Eye
  ctx.fillStyle = '#ef4444';
  ctx.shadowColor = '#ef4444';
  ctx.shadowBlur = 6;
  ctx.beginPath();
  ctx.arc(8, -5, 2, 0, Math.PI * 2);
  ctx.fill();
  ctx.shadowBlur = 0;
  // Gunpowder Smoke Puff when shooting
  if (isShooting) {
    ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
    ctx.beginPath();
    ctx.arc(19, -3, 4, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

// =========================================================================
// 36. PAXI (PUCK): FAERIE DRAGON
// Levitating Cute Dragon, Translucent Wings, Glowing Antennae & Stardust
// =========================================================================
function drawChibiPaxi(ctx: CanvasRenderingContext2D, animState: string, animTime: number) {
  const isCasting = animState === 'cast' || animState === 'attack';
  const floatBob = Math.sin(animTime * 6) * 3;
  const wingFlap = Math.sin(animTime * 18);

  ctx.save();
  ctx.translate(0, floatBob - 4);

  // Iridescent Butterfly / Faerie Dragon Wings Behind
  ctx.save();
  ctx.strokeStyle = '#f472b6';
  ctx.lineWidth = 1.5;
  // Left Upper Wing
  ctx.fillStyle = 'rgba(165, 243, 252, 0.85)';
  ctx.beginPath();
  ctx.ellipse(-14, -28, 12, 8 + wingFlap * 4, -0.4, 0, Math.PI * 2);
  ctx.fill(); ctx.stroke();
  // Right Upper Wing
  ctx.beginPath();
  ctx.ellipse(14, -28, 12, 8 - wingFlap * 4, 0.4, 0, Math.PI * 2);
  ctx.fill(); ctx.stroke();
  // Lower Wings
  ctx.fillStyle = 'rgba(244, 114, 182, 0.75)';
  ctx.beginPath();
  ctx.ellipse(-12, -16, 8, 6 - wingFlap * 2, -0.2, 0, Math.PI * 2);
  ctx.fill(); ctx.stroke();
  ctx.beginPath();
  ctx.ellipse(12, -16, 8, 6 + wingFlap * 2, 0.2, 0, Math.PI * 2);
  ctx.fill(); ctx.stroke();
  ctx.restore();

  // Curled Chubby Dragon Tail
  ctx.strokeStyle = '#06b6d4';
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(-6, -6);
  ctx.quadraticCurveTo(-16, -2, -14, 6);
  ctx.stroke();
  // Cute Pink Tail Fin
  ctx.fillStyle = '#ec4899';
  ctx.beginPath();
  ctx.arc(-14, 6, 3, 0, Math.PI * 2);
  ctx.fill();

  // Chubby Cute Cyan Dragon Body
  ctx.fillStyle = '#06b6d4';
  ctx.beginPath();
  ctx.ellipse(0, -12, 10, 11, 0, 0, Math.PI * 2);
  ctx.fill();
  // Lavender Underbelly Plates
  ctx.fillStyle = '#e9d5ff';
  ctx.beginPath();
  ctx.ellipse(0, -10, 6, 7, 0, 0, Math.PI * 2);
  ctx.fill();
  // Tiny Stubby Dragon Feet
  ctx.fillStyle = '#0891b2';
  ctx.beginPath();
  ctx.arc(-5, -2, 3, 0, Math.PI * 2);
  ctx.arc(5, -2, 3, 0, Math.PI * 2);
  ctx.fill();

  // Cute Round Chibi Dragon Head
  ctx.fillStyle = '#22d3ee';
  ctx.beginPath();
  ctx.arc(0, -28, 13, 0, Math.PI * 2);
  ctx.fill();

  // Cheerful Rosy Dragon Cheeks
  ctx.fillStyle = 'rgba(244, 114, 182, 0.5)';
  ctx.beginPath();
  ctx.arc(-8, -25, 3.2, 0, Math.PI * 2);
  ctx.arc(8, -25, 3.2, 0, Math.PI * 2);
  ctx.fill();

  // Enormous Glossy Anime Dragon Eyes
  ctx.fillStyle = '#581c87';
  ctx.beginPath();
  ctx.ellipse(-5, -28, 3.5, 4.5, 0, 0, Math.PI * 2);
  ctx.ellipse(5, -28, 3.5, 4.5, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#c084fc';
  ctx.beginPath();
  ctx.ellipse(-5, -27.5, 2.5, 3.2, 0, 0, Math.PI * 2);
  ctx.ellipse(5, -27.5, 2.5, 3.2, 0, 0, Math.PI * 2);
  ctx.fill();
  // Big Glossy Star Highlights
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.arc(-6, -30, 1.4, 0, Math.PI * 2);
  ctx.arc(4, -30, 1.4, 0, Math.PI * 2);
  ctx.fill();

  // Joyful Smiling Snout
  ctx.fillStyle = '#be185d';
  ctx.beginPath();
  ctx.arc(0, -22, 2.5, 0, Math.PI);
  ctx.fill();

  // Curved Antennae with Glowing Faerie Lanterns
  ctx.strokeStyle = '#06b6d4';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(-4, -39); ctx.quadraticCurveTo(-10, -48, -14, -45); ctx.stroke();
  ctx.moveTo(4, -39); ctx.quadraticCurveTo(10, -48, 14, -45); ctx.stroke();
  // Glowing Faerie Light Bulbs
  ctx.fillStyle = '#fde047';
  ctx.shadowColor = '#fde047';
  ctx.shadowBlur = isCasting ? 14 : 7;
  ctx.beginPath();
  ctx.arc(-14, -45, 3, 0, Math.PI * 2);
  ctx.arc(14, -45, 3, 0, Math.PI * 2);
  ctx.fill();
  ctx.shadowBlur = 0;

  // Swirling Faerie Dust Sparkles
  ctx.fillStyle = '#fef08a';
  for (let s = 0; s < 3; s++) {
    const ang = animTime * 4 + s * (Math.PI * 2 / 3);
    const sx = Math.cos(ang) * 18;
    const sy = -20 + Math.sin(ang) * 8;
    ctx.beginPath(); ctx.arc(sx, sy, 1.2, 0, Math.PI * 2); ctx.fill();
  }

  ctx.restore();
}

// =========================================================================
// 37. BATRIX (BATRIDER): FLAME RIDER
// Giant Flapping Shadow Bat Mount, Goggled Goblin Rider & Blazing Fire Weapon
// =========================================================================
function drawChibiBatrix(ctx: CanvasRenderingContext2D, animState: string, animTime: number) {
  const isAttacking = animState === 'attack' || animState === 'cast';
  const batWingFlap = Math.sin(animTime * 12);
  const batBob = Math.sin(animTime * 4) * 2;

  ctx.save();
  ctx.translate(0, batBob - 4);

  // GIANT SHADOW BAT MOUNT
  // Leathery Wings Flapping
  ctx.fillStyle = '#312e81';
  ctx.strokeStyle = '#4c1d95';
  ctx.lineWidth = 1.5;
  // Left Bat Wing
  ctx.beginPath();
  ctx.moveTo(-6, -10);
  ctx.lineTo(-24, -22 + batWingFlap * 6);
  ctx.lineTo(-18, -12);
  ctx.lineTo(-22, -4 + batWingFlap * 4);
  ctx.lineTo(-6, -4);
  ctx.closePath();
  ctx.fill(); ctx.stroke();
  // Right Bat Wing
  ctx.beginPath();
  ctx.moveTo(6, -10);
  ctx.lineTo(24, -22 - batWingFlap * 6);
  ctx.lineTo(18, -12);
  ctx.lineTo(22, -4 - batWingFlap * 4);
  ctx.lineTo(6, -4);
  ctx.closePath();
  ctx.fill(); ctx.stroke();

  // Dark Bat Body & Fur Collar
  ctx.fillStyle = '#1e1b4b';
  ctx.beginPath();
  ctx.ellipse(0, -6, 9, 8, 0, 0, Math.PI * 2);
  ctx.fill();
  // Pointy Bat Ears
  ctx.fillStyle = '#4c1d95';
  ctx.beginPath();
  ctx.moveTo(-7, -12); ctx.lineTo(-12, -22); ctx.lineTo(-3, -13); ctx.fill();
  ctx.moveTo(7, -12); ctx.lineTo(12, -22); ctx.lineTo(3, -13); ctx.fill();
  // Bat Snout & Little White Fangs
  ctx.fillStyle = '#0f172a';
  ctx.beginPath(); ctx.arc(0, -7, 4, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.moveTo(-2, -5); ctx.lineTo(-1, -2); ctx.lineTo(0, -5); ctx.fill();
  ctx.moveTo(2, -5); ctx.lineTo(1, -2); ctx.lineTo(0, -5); ctx.fill();

  // CRAZED GOBLIN RIDER (Perched on Bat's Back)
  // Green Goblin Torso
  ctx.fillStyle = '#84cc16';
  ctx.beginPath();
  ctx.roundRect(-6, -24, 12, 12, 3);
  ctx.fill();
  // Leather Harness
  ctx.fillStyle = '#78350f';
  ctx.fillRect(-6, -18, 12, 2.5);

  // Goblin Head
  ctx.fillStyle = '#a3e635';
  ctx.beginPath();
  ctx.arc(0, -29, 10, 0, Math.PI * 2);
  ctx.fill();

  // Pointy Goblin Ears
  ctx.fillStyle = '#84cc16';
  ctx.beginPath();
  ctx.moveTo(-8, -28); ctx.lineTo(-18, -32); ctx.lineTo(-8, -24); ctx.fill();
  ctx.moveTo(8, -28); ctx.lineTo(18, -32); ctx.lineTo(8, -24); ctx.fill();

  // Pilot Aviator Leather Cap & Brass Goggles
  ctx.fillStyle = '#78350f';
  ctx.beginPath();
  ctx.arc(0, -32, 10, Math.PI, Math.PI * 2);
  ctx.fill();
  // Round Brass Goggles
  ctx.fillStyle = '#ca8a04';
  ctx.beginPath();
  ctx.arc(-4, -30, 3.5, 0, Math.PI * 2);
  ctx.arc(4, -30, 3.5, 0, Math.PI * 2);
  ctx.fill();
  // Cyan Glass Lenses
  ctx.fillStyle = '#bae6fd';
  ctx.beginPath();
  ctx.arc(-4, -30, 2.2, 0, Math.PI * 2);
  ctx.arc(4, -30, 2.2, 0, Math.PI * 2);
  ctx.fill();

  // Wide Grinning Goblin Mouth
  ctx.fillStyle = '#451a03';
  ctx.beginPath();
  ctx.arc(0, -24, 3, 0, Math.PI);
  ctx.fill();
  ctx.fillStyle = '#fef08a';
  ctx.fillRect(-1.5, -24, 3, 1.5); // Yellow tooth

  // Flaming Torch / Fire Cocktail (Raised in Hand)
  ctx.save();
  ctx.translate(11, -22);
  const flameWobble = Math.sin(animTime * 14) * 2;
  // Bottle / Torch Handle
  ctx.fillStyle = '#78350f';
  ctx.fillRect(-2, 0, 4, 10);
  // Licking Fiery Flames
  ctx.fillStyle = '#ea580c';
  ctx.shadowColor = '#f59e0b';
  ctx.shadowBlur = isAttacking ? 16 : 8;
  ctx.beginPath();
  ctx.moveTo(-4, 0);
  ctx.quadraticCurveTo(-6 + flameWobble, -8, 0, -16);
  ctx.quadraticCurveTo(6 - flameWobble, -8, 4, 0);
  ctx.closePath();
  ctx.fill();
  // Inner Yellow Flame
  ctx.fillStyle = '#fde047';
  ctx.beginPath();
  ctx.moveTo(-2, 0);
  ctx.quadraticCurveTo(-3 + flameWobble, -5, 0, -11);
  ctx.quadraticCurveTo(3 - flameWobble, -5, 2, 0);
  ctx.closePath();
  ctx.fill();
  ctx.shadowBlur = 0;
  ctx.restore();

  ctx.restore();
}

// =========================================================================
// 38. QUILLBACK (BRISTLEBACK): SPINY BRAWLER
// Burly Boar Snout, Ivory Tusks, Fan of Lethal Spine Quills & Spiked War Club
// =========================================================================
function drawChibiQuillback(ctx: CanvasRenderingContext2D, animState: string, animTime: number) {
  const isAttacking = animState === 'attack' || animState === 'cast';
  const bristle = Math.sin(animTime * 8) * 2;

  // Massive Jagged Quills Radiating From Back (Rendered Behind)
  ctx.save();
  ctx.strokeStyle = '#451a03';
  ctx.lineWidth = 2.5;
  const quillAngles = [-1.8, -1.4, -1.0, -0.6, -0.2, 0.2];
  quillAngles.forEach((ang, idx) => {
    const qLen = 18 + (idx % 2 === 0 ? 4 : 0) + bristle;
    const qBaseX = -4 + idx * 2.5;
    const qBaseY = -18;
    const tipX = qBaseX + Math.cos(ang) * qLen;
    const tipY = qBaseY + Math.sin(ang) * qLen;

    // Quill Body (Dark brown base to sharp yellow tip)
    ctx.strokeStyle = '#78350f';
    ctx.beginPath();
    ctx.moveTo(qBaseX, qBaseY);
    ctx.lineTo(tipX, tipY);
    ctx.stroke();

    // Lethal Sharp Amber/Yellow Tip
    ctx.fillStyle = '#fde047';
    ctx.beginPath();
    ctx.arc(tipX, tipY, 2, 0, Math.PI * 2);
    ctx.fill();
  });
  ctx.restore();

  // Stocky Brawler Legs & Wrapped Claws
  ctx.fillStyle = '#713f12';
  ctx.fillRect(-8, -4, 6, 8);
  ctx.fillRect(2, -4, 6, 8);
  ctx.fillStyle = '#a8a29e'; // Wrapping bandages
  ctx.fillRect(-9, 0, 7, 3);
  ctx.fillRect(1, 0, 7, 3);

  // Hunched Muscular Brawler Torso
  ctx.fillStyle = '#854d0e';
  ctx.beginPath();
  ctx.roundRect(-9, -20, 18, 17, 4);
  ctx.fill();
  // Studded Leather Armor Harness
  ctx.fillStyle = '#451a03';
  ctx.fillRect(-9, -12, 18, 3);
  ctx.fillStyle = '#e2e8f0'; // Iron Studs
  ctx.beginPath();
  ctx.arc(-5, -10.5, 1.2, 0, Math.PI * 2);
  ctx.arc(0, -10.5, 1.2, 0, Math.PI * 2);
  ctx.arc(5, -10.5, 1.2, 0, Math.PI * 2);
  ctx.fill();

  // Tough Hunched Porcupine/Boar Head
  ctx.fillStyle = '#a16207';
  ctx.beginPath();
  ctx.arc(0, -28, 13, 0, Math.PI * 2);
  ctx.fill();

  // Tough Snout & Nostrils
  ctx.fillStyle = '#78350f';
  ctx.beginPath();
  ctx.ellipse(0, -24, 5.5, 4, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#451a03';
  ctx.beginPath();
  ctx.arc(-2, -24, 1.2, 0, Math.PI * 2);
  ctx.arc(2, -24, 1.2, 0, Math.PI * 2);
  ctx.fill();

  // Brass Septum Nose Ring
  ctx.strokeStyle = '#f59e0b';
  ctx.lineWidth = 1.4;
  ctx.beginPath();
  ctx.arc(0, -21, 2.5, 0, Math.PI);
  ctx.stroke();

  // Curved Ivory Tusks
  ctx.fillStyle = '#fef3c7';
  ctx.beginPath();
  ctx.moveTo(-5, -24); ctx.quadraticCurveTo(-9, -28, -8, -32); ctx.lineTo(-4, -26); ctx.fill();
  ctx.moveTo(5, -24); ctx.quadraticCurveTo(9, -28, 8, -32); ctx.lineTo(4, -26); ctx.fill();

  // Fierce Squinting Brawler Eyes
  ctx.fillStyle = '#451a03';
  ctx.beginPath();
  ctx.ellipse(-5, -29, 2.5, 3.2, 0, 0, Math.PI * 2);
  ctx.ellipse(5, -29, 2.5, 3.2, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#f59e0b';
  ctx.beginPath();
  ctx.ellipse(-5, -29, 1.5, 2, 0, 0, Math.PI * 2);
  ctx.ellipse(5, -29, 1.5, 2, 0, 0, Math.PI * 2);
  ctx.fill();

  // Spiked Morningstar / Heavy War Club (Right Hand)
  ctx.save();
  ctx.translate(13, -14);
  const maceSwing = isAttacking ? -0.4 + Math.sin(animTime * 20) * 0.5 : 0.2;
  ctx.rotate(maceSwing);
  // Heavy Wood Shaft
  ctx.strokeStyle = '#451a03';
  ctx.lineWidth = 3.2;
  ctx.beginPath();
  ctx.moveTo(0, 12); ctx.lineTo(0, -18); ctx.stroke();
  // Spiked Iron Macehead
  ctx.fillStyle = '#1e293b';
  ctx.beginPath();
  ctx.arc(0, -20, 6.5, 0, Math.PI * 2);
  ctx.fill();
  // Lethal Steel Spikes
  ctx.fillStyle = '#cbd5e1';
  ctx.beginPath();
  ctx.moveTo(0, -28); ctx.lineTo(-2, -24); ctx.lineTo(2, -24); ctx.fill();
  ctx.moveTo(8, -20); ctx.lineTo(4, -22); ctx.lineTo(4, -18); ctx.fill();
  ctx.moveTo(-8, -20); ctx.lineTo(-4, -22); ctx.lineTo(-4, -18); ctx.fill();
  ctx.restore();
}

// =========================================================================
// 39. AETHERIS (IO): CELESTIAL WISP
// Radiant Stellar Corona, Gyroscopic Orbit Rings, Twin Starlight Eyes & Satellite Spirits
// =========================================================================
function drawChibiAetheris(ctx: CanvasRenderingContext2D, animState: string, animTime: number) {
  const isCasting = animState === 'cast' || animState === 'attack';
  const pulse = Math.sin(animTime * 5) * 2;
  const spin = animTime * 3;

  ctx.save();
  ctx.translate(0, -20); // Hovering centered above ground

  // Radiant Outer Corona Flare
  ctx.save();
  ctx.shadowColor = '#00f2ff';
  ctx.shadowBlur = isCasting ? 24 : 16;
  ctx.fillStyle = 'rgba(6, 182, 212, 0.35)';
  ctx.beginPath();
  ctx.arc(0, 0, 16 + pulse, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  // Gyroscopic Concentric Celestial Rings (Rotating in 3D perspective)
  ctx.save();
  ctx.strokeStyle = '#bae6fd';
  ctx.lineWidth = 1.6;
  // Outer Ring
  ctx.beginPath();
  ctx.ellipse(0, 0, 20 + pulse, 8, spin, 0, Math.PI * 2);
  ctx.stroke();
  // Inner Intersecting Ring
  ctx.strokeStyle = '#06b6d4';
  ctx.beginPath();
  ctx.ellipse(0, 0, 18 + pulse, 7, -spin * 0.8, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();

  // Multi-Tonal Radiant Plasma Orb Core
  ctx.save();
  const grad = ctx.createRadialGradient(0, 0, 2, 0, 0, 13);
  grad.addColorStop(0, '#ffffff'); // White-hot center
  grad.addColorStop(0.4, '#38bdf8'); // Azure plasma
  grad.addColorStop(0.85, '#0284c7'); // Deep cyan rim
  grad.addColorStop(1, 'rgba(2, 132, 199, 0)');
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.arc(0, 0, 13 + pulse * 0.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  // Starlight Optic Star Eyes (Expressive Twin Celestial Points)
  ctx.fillStyle = '#ffffff';
  ctx.shadowColor = '#ffffff';
  ctx.shadowBlur = 8;
  ctx.beginPath();
  ctx.arc(-4, -2, 2.2, 0, Math.PI * 2);
  ctx.arc(4, -2, 2.2, 0, Math.PI * 2);
  ctx.fill();
  ctx.shadowBlur = 0;

  // Orbiting Satellite Spirits / Wisps (Tethered with Electric Arcs)
  for (let i = 0; i < 3; i++) {
    const orbAngle = spin * 1.5 + i * (Math.PI * 2 / 3);
    const orbDist = 22 + Math.sin(animTime * 4 + i) * 3;
    const orbX = Math.cos(orbAngle) * orbDist;
    const orbY = Math.sin(orbAngle) * (orbDist * 0.45);

    // Crackling Electric Arc to Core
    ctx.strokeStyle = 'rgba(103, 232, 249, 0.6)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(orbX, orbY);
    ctx.stroke();

    // Satellite Spirit Orb
    ctx.fillStyle = '#ffffff';
    ctx.shadowColor = '#38bdf8';
    ctx.shadowBlur = 8;
    ctx.beginPath();
    ctx.arc(orbX, orbY, 3, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;
  }

  ctx.restore();
}

