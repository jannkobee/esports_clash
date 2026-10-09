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
  isInBush: boolean;
}

export function drawChampionSprite(ctx: CanvasRenderingContext2D, state: FighterVisualState) {
  const { championName, x, y, facing, animState, animTime, team, isStunned, isCharmed, isInBush } = state;

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

  ctx.translate(attackRecoil, -bob);

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
    default:
      drawDefaultChampion(ctx, team);
      break;
  }

  ctx.restore();

  // Status Overlays
  if (isStunned) {
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

