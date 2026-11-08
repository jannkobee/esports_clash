import { ARAM_BUSHES, CAMP_ROCK_RINGS, ROCK_TERRAIN } from "../arenaRules";
import { chasmCenterX } from "../arenaElevation";
import { topLaneY, botLaneY, LANE_HALF_WIDTH } from "../arenaLayout";

/**
 * League of Legends / Summoner's Rift Inspired Organic Two-Lane Ground Artist (`two-lane-v5`).
 *
 * Replaces the raised beige stadium platform with a flush, natural woodland & rocky battlefield:
 * - Lush, varied forest grassy field with mossy glades, sunlit meadows, and wildflower/clover details
 * - Non-straight, weathered earthen & cracked-flagstone Top/Bottom lanes with grass-feathered edges
 * - Winding earthen jungle footpaths connecting all 12 regular jungle camps across 4 quadrants
 * - Deep dark-teal winding river with muddy/mossy banks, submerged stones, reeds, and natural rocky fords
 * - Sunken fractured-slate Boss Coves (Top Dragon Cove & Bottom Baron/Colossus Cove) with glowing arcane/molten fissures
 * - Ancient weathered-slate Base Sanctuaries embedded naturally into the forest floor
 */
const PALETTE = {
  turfDeep: "#243d21",
  turfMid: "#33542d",
  turfMeadow: "#426937",
  turfSun: "#568243",
  turfMoss: "#3b5934",
  turfShadow: "#1a2e18",
  laneEarthOuter: "#474a35",
  laneEarthMid: "#5c503e",
  laneEarthInner: "#6e604b",
  laneEarthLight: "#7d6e56",
  flagstoneDark: "#484d4a",
  flagstoneMid: "#5a605c",
  flagstoneLight: "#6c736e",
  flagstoneMoss: "#435739",
  dirtTrailOuter: "#4d4635",
  dirtTrailInner: "#665843",
  riverMudBank: "#3c4738",
  riverWetStone: "#274247",
  riverShallow: "#1c4752",
  riverDeep: "#14353d",
  riverAbyss: "#0f2830",
  riverCurrent: "#2b6775",
  riverFoam: "rgba(175, 228, 235, 0.24)",
  campEarthOuter: "#4b4635",
  campEarthInner: "#635541",
  bushDark: "#1c3b23",
  bushMid: "#2d5932",
  bushLight: "#4c7d42",
  bushTip: "#6fa153",
  blueArcane: "#2cc5f0",
  blueGlow: "#5ce1ff",
  redArcane: "#e84a5f",
  redGlow: "#ff758f",
  purpleVoid: "#a855f7",
  purpleGlow: "#d8b4fe",
  dragonEmber: "#f97316",
  dragonGlow: "#fde047",
  vignette: "8, 14, 12",
};

const lcg = (seed: number) => () => {
  seed = (seed * 1664525 + 1013904223) >>> 0;
  return seed / 4294967296;
};

/** Compute unit normal and tangent for a lane centerline at X */
function laneFrame(laneYFunc: (x: number) => number, x: number) {
  const cy = laneYFunc(x);
  const dy = (laneYFunc(x + 4) - laneYFunc(x - 4)) / 8;
  const len = Math.hypot(1, dy);
  return {
    x,
    y: cy,
    tx: 1 / len,
    ty: dy / len,
    nx: -dy / len,
    ny: 1 / len,
    angle: Math.atan2(dy, 1),
  };
}

/** Deterministic 1D organic edge wiggle so lane & path borders are never straight lines */
function edgeWiggle(x: number, seedOffset: number, amp = 14): number {
  return (
    Math.sin(x * 0.029 + seedOffset) * (amp * 0.55) +
    Math.cos(x * 0.067 + seedOffset * 1.7) * (amp * 0.3) +
    Math.sin(x * 0.13 + seedOffset * 2.3) * (amp * 0.15)
  );
}

export function paintProceduralArena(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
) {
  const rand = lcg(42);
  const between = (a: number, b: number) => a + rand() * (b - a);
  const halfLane = LANE_HALF_WIDTH;

  ctx.save();
  ctx.lineCap = "round";
  ctx.lineJoin = "round";

  // ---------------------------------------------------------------------------
  // 1. Lush Summoner's Rift Forest Grassy Field Base
  // ---------------------------------------------------------------------------
  const turfGrad = ctx.createLinearGradient(0, 0, 0, height);
  turfGrad.addColorStop(0, PALETTE.turfDeep);
  turfGrad.addColorStop(0.28, PALETTE.turfMid);
  turfGrad.addColorStop(0.5, PALETTE.turfMeadow);
  turfGrad.addColorStop(0.72, PALETTE.turfMid);
  turfGrad.addColorStop(1, PALETTE.turfDeep);
  ctx.fillStyle = turfGrad;
  ctx.fillRect(0, 0, width, height);

  // Organic dappled meadow glades & deep woodland canopy shadows
  for (let i = 0; i < 64; i++) {
    const x = between(60, width - 60);
    const y = between(50, height - 50);
    const r = between(90, 240);
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    const col =
      i % 3 === 0
        ? PALETTE.turfSun
        : i % 3 === 1
          ? PALETTE.turfShadow
          : PALETTE.turfMoss;
    g.addColorStop(0, col + "44");
    g.addColorStop(0.6, col + "1c");
    g.addColorStop(1, col + "00");
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }

  // Painted grass blade tufts & clover clusters across the grassy field
  for (let i = 0; i < 220; i++) {
    const gx = between(80, width - 80);
    const gy = between(60, height - 60);
    ctx.strokeStyle =
      i % 2 === 0 ? "rgba(96, 145, 72, 0.32)" : "rgba(32, 58, 28, 0.35)";
    ctx.lineWidth = 1.6;
    for (let b = -1; b <= 1; b++) {
      ctx.beginPath();
      ctx.moveTo(gx + b * 3.5, gy + 4);
      ctx.quadraticCurveTo(
        gx + b * 5,
        gy - 2,
        gx + b * 6.5 + between(-2, 2),
        gy - between(5, 9),
      );
      ctx.stroke();
    }
  }

  // ---------------------------------------------------------------------------
  // 2. Winding Earthen Jungle Footpaths Connecting All 12 Camps & Lanes
  // ---------------------------------------------------------------------------
  const strokeOrganicDirtTrail = (
    points: [number, number][],
    widthPx = 34,
  ) => {
    if (points.length < 2) return;
    const trace = () => {
      ctx.beginPath();
      ctx.moveTo(points[0][0], points[0][1]);
      for (let i = 1; i < points.length - 1; i++) {
        const xc = (points[i][0] + points[i + 1][0]) * 0.5;
        const yc = (points[i][1] + points[i + 1][1]) * 0.5;
        ctx.quadraticCurveTo(points[i][0], points[i][1], xc, yc);
      }
      const last = points[points.length - 1];
      ctx.lineTo(last[0], last[1]);
    };
    // Soft mossy-earth outer blend into the grass
    ctx.strokeStyle = "rgba(68, 78, 48, 0.48)";
    ctx.lineWidth = widthPx + 22;
    trace();
    ctx.stroke();

    // Mid worn dirt
    ctx.strokeStyle = "rgba(88, 75, 55, 0.62)";
    ctx.lineWidth = widthPx + 6;
    trace();
    ctx.stroke();

    // Inner trodden earth core
    ctx.strokeStyle = "rgba(108, 92, 68, 0.58)";
    ctx.lineWidth = widthPx - 8;
    trace();
    ctx.stroke();
  };

  for (const mirrorX of [false, true]) {
    const mx = (x: number) => (mirrorX ? width - x : x);
    // Base gate to Top-West / Top-East quadrant camps (Gromp 500,455 -> Blue Buff 740,435 -> Wolves 1055,445)
    strokeOrganicDirtTrail(
      [
        [mx(370), 660],
        [mx(485), 555],
        [mx(500), 465],
        [mx(630), 495],
        [mx(740), 450],
        [mx(900), 490],
        [mx(1055), 455],
        [mx(1220), 340],
      ],
      32,
    );
    // Base gate to Bot-West / Bot-East quadrant camps (Krugs 500,985 -> Red Buff 740,1005 -> Raptors 1055,995)
    strokeOrganicDirtTrail(
      [
        [mx(370), 780],
        [mx(485), 885],
        [mx(500), 975],
        [mx(630), 945],
        [mx(740), 990],
        [mx(900), 950],
        [mx(1055), 985],
        [mx(1220), 1100],
      ],
      32,
    );
    // North-South winding S-curve jungle trails between top and bottom quadrants
    strokeOrganicDirtTrail(
      [
        [mx(615), 295],
        [mx(655), 420],
        [mx(595), 565],
        [mx(645), 720],
        [mx(595), 875],
        [mx(655), 1020],
        [mx(615), 1145],
      ],
      26,
    );
    strokeOrganicDirtTrail(
      [
        [mx(915), 290],
        [mx(880), 430],
        [mx(955), 575],
        [mx(905), 720],
        [mx(955), 865],
        [mx(880), 1010],
        [mx(915), 1150],
      ],
      26,
    );
    // Winding trail to Center River Island
    strokeOrganicDirtTrail(
      [
        [mx(905), 720],
        [mx(1040), 695],
        [mx(1185), 740],
        [mx(1335), 720],
      ],
      24,
    );
  }

  // ---------------------------------------------------------------------------
  // 3. Organic Non-Straight Top & Bottom Lanes Blended into the Grassy Field
  // ---------------------------------------------------------------------------
  const drawOrganicLane = (isTop: boolean) => {
    const fn = isTop ? topLaneY : botLaneY;
    const seedBase = isTop ? 1.7 : 4.9;
    const visFn = (x: number): number => {
      const clamped = Math.max(210, Math.min(width - 210, x));
      if (clamped < 580) {
        const u = (clamped - 210) / (580 - 210);
        const topY = 270 + (675 - 270) * Math.pow(1 - u, 1.55);
        return isTop ? topY : height - topY;
      }
      if (clamped > width - 580) {
        const u = (width - 210 - clamped) / (580 - 210);
        const topY = 270 + (675 - 270) * Math.pow(1 - u, 1.55);
        return isTop ? topY : height - topY;
      }
      return fn(clamped);
    };

    const traceNoisyBand = (halfWidthPx: number, wiggleAmp: number, phase: number) => {
      const outerPts: { x: number; y: number }[] = [];
      const innerPts: { x: number; y: number }[] = [];
      // Build sample X list from 210..width-210 so the curved lane ends enter deeply inside the Base Sanctum circle
      const xs: number[] = [];
      for (let x = 210; x <= width - 210; ) {
        xs.push(x);
        const distFromEnd = Math.min(x - 210, width - 210 - x);
        x += distFromEnd < 30 ? 2 : distFromEnd < 90 ? 4 : 10;
      }
      if (xs[xs.length - 1] !== width - 210) xs.push(width - 210);

      for (const x of xs) {
        const f = laneFrame(visFn, x);
        const symX = Math.min(x, width - x);
        const wScale = Math.min(1, Math.max(0, (symX - 230) / 55));
        const wOut = edgeWiggle(symX, seedBase + phase, wiggleAmp * wScale);
        const wIn = edgeWiggle(symX, seedBase + phase + 2.1, wiggleAmp * wScale);
        outerPts.push({
          x: f.x - f.nx * (halfWidthPx + wOut),
          y: f.y - f.ny * (halfWidthPx + wOut),
        });
        innerPts.push({
          x: f.x + f.nx * (halfWidthPx + wIn),
          y: f.y + f.ny * (halfWidthPx + wIn),
        });
      }
      ctx.beginPath();
      outerPts.forEach((p, i) => (i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y)));
      for (let i = innerPts.length - 1; i >= 0; i--) {
        ctx.lineTo(innerPts[i].x, innerPts[i].y);
      }
      ctx.closePath();
    };

    // Layer A: Wide mossy-olive transition edge that blends the lane into the grassy field
    traceNoisyBand(halfLane + 24, 16, 0.3);
    ctx.fillStyle = "rgba(62, 82, 46, 0.55)";
    ctx.fill();

    // Layer B: Weathered outer dirt & turf transition
    traceNoisyBand(halfLane + 8, 14, 1.1);
    ctx.fillStyle = PALETTE.laneEarthOuter;
    ctx.fill();

    // Layer C: Main worn earthen lane floor
    traceNoisyBand(halfLane - 4, 11, 2.4);
    ctx.fillStyle = PALETTE.laneEarthMid;
    ctx.fill();

    // Layer D: Trodden center dirt track with subtle warm highlights
    traceNoisyBand(halfLane - 22, 9, 3.7);
    ctx.fillStyle = PALETTE.laneEarthInner;
    ctx.fill();

    // Layer E: Irregular weathered flagstones & mossy cobbles embedded in the dirt lane
    // (Matches the cracked grey-brown flagstones near turrets in Summoner's Rift)
    for (let x = 310; x <= width - 310; x += 26) {
      const f = laneFrame(visFn, x);
      const nearTurret =
        Math.abs(x - 420) < 95 ||
        Math.abs(x - 730) < 95 ||
        Math.abs(x - 1060) < 95 ||
        Math.abs(x - 1740) < 95 ||
        Math.abs(x - 2070) < 95 ||
        Math.abs(x - 2380) < 95;
      const stoneCount = nearTurret ? 3 : rand() < 0.55 ? 2 : 1;
      for (let s = 0; s < stoneCount; s++) {
        const lat = between(-halfLane + 18, halfLane - 18);
        const sx = f.x + f.nx * lat + between(-8, 8);
        const sy = f.y + f.ny * lat + between(-6, 6);
        const sw = between(16, 32);
        const sh = between(11, 22);
        const rot = f.angle + between(-0.28, 0.28);

        ctx.save();
        ctx.translate(sx, sy);
        ctx.rotate(rot);

        // Mossy crevice shadow around flagstone
        ctx.fillStyle = "rgba(42, 58, 34, 0.55)";
        ctx.beginPath();
        ctx.roundRect(-sw * 0.55, -sh * 0.55, sw * 1.1, sh * 1.1, 5);
        ctx.fill();

        // Cracked slate/brown flagstone
        ctx.fillStyle =
          s % 2 === 0
            ? "rgba(92, 96, 88, 0.68)"
            : "rgba(108, 102, 88, 0.62)";
        ctx.beginPath();
        ctx.roundRect(-sw * 0.48, -sh * 0.48, sw * 0.96, sh * 0.96, 4);
        ctx.fill();

        // Fracture line across stone
        ctx.strokeStyle = "rgba(38, 42, 36, 0.45)";
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.moveTo(-sw * 0.25, -sh * 0.35);
        ctx.lineTo(sw * 0.1, 0);
        ctx.lineTo(sw * 0.3, sh * 0.32);
        ctx.stroke();
        ctx.restore();
      }
    }

    // Layer F: Soft grassy encroaching tufts along the lane edges so it never looks straight
    for (let x = 290; x <= width - 290; x += 22) {
      const f = laneFrame(visFn, x);
      for (const side of [-1, 1]) {
        const edgeDist = halfLane - 4 + between(-10, 12);
        const gx = f.x + f.nx * side * edgeDist;
        const gy = f.y + f.ny * side * edgeDist;
        const gr = between(14, 28);
        const g = ctx.createRadialGradient(gx, gy, 2, gx, gy, gr);
        g.addColorStop(0, "rgba(58, 88, 45, 0.58)");
        g.addColorStop(1, "rgba(58, 88, 45, 0)");
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(gx, gy, gr, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  };

  drawOrganicLane(true);
  drawOrganicLane(false);

  // ---------------------------------------------------------------------------
  // 4. League of Legends Winding Dark-Teal River & Shallow Rocky Fords
  // ---------------------------------------------------------------------------
  const traceRiver = (offset = 0) => {
    ctx.beginPath();
    for (let y = 0; y <= height; y += 14) {
      const cx = chasmCenterX(y) + offset;
      y === 0 ? ctx.moveTo(cx, y) : ctx.lineTo(cx, y);
    }
  };

  ctx.save();
  // Muddy/mossy riverbanks blending into the grass and lanes
  traceRiver();
  ctx.strokeStyle = PALETTE.riverMudBank;
  ctx.lineWidth = 166;
  ctx.stroke();

  // Wet dark slate bank
  traceRiver();
  ctx.strokeStyle = PALETTE.riverWetStone;
  ctx.lineWidth = 142;
  ctx.stroke();

  // Shallow dark-teal water
  traceRiver();
  ctx.strokeStyle = PALETTE.riverShallow;
  ctx.lineWidth = 122;
  ctx.stroke();

  // Deep emerald-slate river channel
  traceRiver();
  ctx.strokeStyle = PALETTE.riverDeep;
  ctx.lineWidth = 92;
  ctx.stroke();

  // Center abyssal current
  traceRiver();
  ctx.strokeStyle = PALETTE.riverAbyss;
  ctx.lineWidth = 52;
  ctx.stroke();

  // Subtle bioluminescent teal river ripples
  for (let i = 0; i < 44; i++) {
    const cy = between(110, height - 110);
    const cx = chasmCenterX(cy) + between(-38, 38);
    ctx.strokeStyle =
      i % 2 === 0
        ? "rgba(110, 195, 205, 0.24)"
        : "rgba(18, 52, 62, 0.42)";
    ctx.lineWidth = between(1.4, 2.6);
    ctx.beginPath();
    ctx.moveTo(cx - 4, cy - 15);
    ctx.quadraticCurveTo(cx + between(-8, 8), cy, cx + 3, cy + 15);
    ctx.stroke();
  }

  // Shallow Rocky Stepping-Stone Fords where Top & Bottom Lanes cross the River
  for (const isTop of [true, false]) {
    const fn = isTop ? topLaneY : botLaneY;
    const fordY = fn(width / 2);
    const fordX = chasmCenterX(fordY);

    // Submerged sandbar / gravel shoal under the river crossing
    const shoalGrad = ctx.createRadialGradient(
      fordX,
      fordY,
      18,
      fordX,
      fordY,
      92,
    );
    shoalGrad.addColorStop(0, "rgba(76, 84, 68, 0.72)");
    shoalGrad.addColorStop(0.65, "rgba(44, 72, 74, 0.52)");
    shoalGrad.addColorStop(1, "rgba(28, 71, 82, 0)");
    ctx.fillStyle = shoalGrad;
    ctx.beginPath();
    ctx.ellipse(fordX, fordY, 92, halfLane + 14, 0, 0, Math.PI * 2);
    ctx.fill();

    // Natural flat river stepping stones & mossy flagstones across the ford
    const stoneOffsets = [
      [-48, -22, 26, 18],
      [-20, -28, 28, 19],
      [14, -24, 27, 18],
      [44, -18, 25, 17],
      [-38, 4, 30, 20],
      [-4, 2, 32, 22],
      [30, 6, 28, 19],
      [-44, 28, 25, 17],
      [-12, 30, 29, 19],
      [22, 28, 27, 18],
      [50, 22, 24, 16],
    ];
    for (const [dx, dy, sw, sh] of stoneOffsets) {
      const sx = fordX + dx;
      const sy = fordY + dy;
      // Water foam ring around stepping stone
      ctx.strokeStyle = "rgba(165, 225, 232, 0.28)";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.ellipse(sx, sy, sw * 0.62, sh * 0.62, 0.15, 0, Math.PI * 2);
      ctx.stroke();

      // Weathered river stone slab
      ctx.fillStyle = "#565d58";
      ctx.beginPath();
      ctx.ellipse(sx, sy, sw * 0.5, sh * 0.5, -0.1, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = "#68706a";
      ctx.beginPath();
      ctx.ellipse(sx - 2, sy - 2, sw * 0.36, sh * 0.34, -0.1, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  ctx.restore();

  // ---------------------------------------------------------------------------
  // 5. Center River Island (1400, 720) — Natural Mossy Rock Outcrop in the River
  // ---------------------------------------------------------------------------
  ctx.save();
  const islandX = width / 2;
  const islandY = height / 2;
  const islandR = 116;

  const islandGrad = ctx.createRadialGradient(
    islandX,
    islandY,
    24,
    islandX,
    islandY,
    islandR,
  );
  islandGrad.addColorStop(0, "#5e5643");
  islandGrad.addColorStop(0.45, "#4c593e");
  islandGrad.addColorStop(0.78, "#354d2f");
  islandGrad.addColorStop(1, "rgba(28, 71, 82, 0)");
  ctx.fillStyle = islandGrad;
  ctx.beginPath();
  for (let a = 0; a < Math.PI * 2; a += Math.PI / 18) {
    const r = islandR + Math.sin(a * 5) * 9 + Math.cos(a * 3) * 7;
    const px = islandX + Math.cos(a) * r;
    const py = islandY + Math.sin(a) * r;
    a === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py);
  }
  ctx.closePath();
  ctx.fill();

  // Subtle runic stone cracks on the center island floor
  ctx.strokeStyle = "rgba(56, 189, 248, 0.28)";
  ctx.lineWidth = 2;
  for (let i = 0; i < 6; i++) {
    const a = (i * Math.PI) / 3 + 0.2;
    ctx.beginPath();
    ctx.moveTo(islandX + Math.cos(a) * 14, islandY + Math.sin(a) * 14);
    ctx.lineTo(
      islandX + Math.cos(a + 0.15) * 38,
      islandY + Math.sin(a + 0.15) * 38,
    );
    ctx.lineTo(islandX + Math.cos(a) * 62, islandY + Math.sin(a) * 62);
    ctx.stroke();
  }
  ctx.restore();

  // ---------------------------------------------------------------------------
  // 6. Sunken Fractured-Slate Boss Coves (Top Dragon Cove & Bottom Baron/Colossus Pit)
  //    Directly inspired by the Baron pit in Summoner's Rift reference image!
  // ---------------------------------------------------------------------------
  const drawBossCove = (px: number, py: number, isDragon: boolean) => {
    ctx.save();
    ctx.translate(px, py);
    const pitR = 96;

    // Dark sunken slate floor blending into the river
    const floorGrad = ctx.createRadialGradient(0, 0, 8, 0, 0, pitR + 22);
    if (isDragon) {
      floorGrad.addColorStop(0, "#2b1d19");
      floorGrad.addColorStop(0.45, "#232528");
      floorGrad.addColorStop(0.78, "#1c2e33");
      floorGrad.addColorStop(1, "rgba(20, 53, 61, 0)");
    } else {
      floorGrad.addColorStop(0, "#1d1b38");
      floorGrad.addColorStop(0.42, "#192d3e");
      floorGrad.addColorStop(0.78, "#163540");
      floorGrad.addColorStop(1, "rgba(20, 53, 61, 0)");
    }
    ctx.fillStyle = floorGrad;
    ctx.beginPath();
    ctx.arc(0, 0, pitR + 22, 0, Math.PI * 2);
    ctx.fill();

    // Central arcane / molten glow pool under the fractures (like reference image)
    const coreGrad = ctx.createRadialGradient(0, 0, 2, 0, 0, 54);
    if (isDragon) {
      coreGrad.addColorStop(0, "rgba(251, 191, 36, 0.55)");
      coreGrad.addColorStop(0.45, "rgba(249, 115, 22, 0.32)");
      coreGrad.addColorStop(1, "rgba(249, 115, 22, 0)");
    } else {
      coreGrad.addColorStop(0, "rgba(192, 132, 252, 0.62)");
      coreGrad.addColorStop(0.45, "rgba(56, 189, 248, 0.34)");
      coreGrad.addColorStop(1, "rgba(168, 85, 247, 0)");
    }
    ctx.fillStyle = coreGrad;
    ctx.beginPath();
    ctx.arc(0, 0, 54, 0, Math.PI * 2);
    ctx.fill();

    // Jagged glowing rock fissures radiating from the center of the pit
    const fissureGlow = isDragon
      ? "rgba(251, 146, 60, 0.68)"
      : "rgba(168, 85, 247, 0.72)";
    const fissureCore = isDragon
      ? "rgba(254, 240, 138, 0.85)"
      : "rgba(216, 180, 254, 0.88)";

    for (let i = 0; i < 9; i++) {
      const baseAngle = (i * Math.PI * 2) / 9 + (isDragon ? 0.15 : -0.2);
      const len = 38 + (i % 3) * 18;
      const midR = len * 0.52;
      const mx = Math.cos(baseAngle + 0.18) * midR;
      const my = Math.sin(baseAngle + 0.18) * midR;
      const ex = Math.cos(baseAngle - 0.08) * len;
      const ey = Math.sin(baseAngle - 0.08) * len;

      ctx.strokeStyle = fissureGlow;
      ctx.lineWidth = 4.2;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(mx, my);
      ctx.lineTo(ex, ey);
      ctx.stroke();

      ctx.strokeStyle = fissureCore;
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(mx, my);
      ctx.lineTo(ex, ey);
      ctx.stroke();
    }

    // Fractured polygonal stone plates around the cove floor
    ctx.strokeStyle = "rgba(12, 20, 24, 0.65)";
    ctx.lineWidth = 2;
    for (const r of [28, 52, 74]) {
      ctx.beginPath();
      for (let a = 0; a <= Math.PI * 2 + 0.1; a += Math.PI / 5) {
        const jr = r + Math.sin(a * 3 + r) * 5;
        const x = Math.cos(a) * jr;
        const y = Math.sin(a) * jr;
        a === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
      }
      ctx.stroke();
    }
    ctx.restore();
  };

  drawBossCove(1400, 95, true);    // Top Ancient Dragon Cove
  drawBossCove(1400, 1345, false); // Bottom Baron / Colossus Cove

  // ---------------------------------------------------------------------------
  // 7. Natural Weathered-Slate & Mossy Base Sanctuaries (West Blue & East Red)
  // ---------------------------------------------------------------------------
  const drawNaturalBaseSanctum = (
    cx: number,
    cy: number,
    tint: string,
    glow: string,
    isRed: boolean,
  ) => {
    ctx.save();
    ctx.translate(cx, cy);
    const outerR = 165;

    // Outer mossy earth & forest floor blend (NO raised white curb!)
    const earthGrad = ctx.createRadialGradient(0, 0, 60, 0, 0, outerR + 28);
    earthGrad.addColorStop(0, "#4c5457");
    earthGrad.addColorStop(0.58, "#474f48");
    earthGrad.addColorStop(0.82, "#3c5233");
    earthGrad.addColorStop(1, "rgba(51, 84, 45, 0)");
    ctx.fillStyle = earthGrad;
    ctx.beginPath();
    for (let a = 0; a < Math.PI * 2; a += Math.PI / 24) {
      const r = outerR + 16 + Math.sin(a * 7) * 10 + Math.cos(a * 4) * 8;
      const px = Math.cos(a) * r;
      const py = Math.sin(a) * r;
      a === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py);
    }
    ctx.closePath();
    ctx.fill();

    // Irregular ancient slate flagstones arranged in concentric rings with moss in the seams
    for (const ringR of [136, 102, 68]) {
      const segments = ringR > 110 ? 16 : 12;
      for (let i = 0; i < segments; i++) {
        const a0 = (i * Math.PI * 2) / segments + 0.04;
        const a1 = ((i + 0.86) * Math.PI * 2) / segments;
        const rIn = ringR - 14 + (i % 2) * 3;
        const rOut = ringR + 12 - ((i + 1) % 2) * 3;

        ctx.fillStyle = i % 2 === 0 ? "#525a5e" : "#464e52";
        ctx.strokeStyle = "rgba(38, 54, 34, 0.65)";
        ctx.lineWidth = 2.2;
        ctx.beginPath();
        ctx.arc(0, 0, rOut, a0, a1);
        ctx.arc(0, 0, rIn, a1, a0, true);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
      }
    }

    // Glowing Arcane Nexus Well in the center of the sanctuary
    const poolR = 56;
    const poolGrad = ctx.createRadialGradient(0, 0, 4, 0, 0, poolR);
    poolGrad.addColorStop(0, "#ffffff");
    poolGrad.addColorStop(0.3, glow);
    poolGrad.addColorStop(0.68, tint);
    poolGrad.addColorStop(1, "rgba(26, 36, 42, 0.9)");
    ctx.fillStyle = poolGrad;
    ctx.beginPath();
    ctx.arc(0, 0, poolR, 0, Math.PI * 2);
    ctx.fill();

    // Glowing arcane fissures radiating from the Nexus into the flagstones
    ctx.strokeStyle = glow + "88";
    ctx.lineWidth = 2;
    for (let i = 0; i < 8; i++) {
      const a = (i * Math.PI) / 4 + (isRed ? 0.2 : 0);
      ctx.beginPath();
      ctx.moveTo(Math.cos(a) * (poolR - 4), Math.sin(a) * (poolR - 4));
      ctx.lineTo(
        Math.cos(a + 0.1) * (poolR + 24),
        Math.sin(a + 0.1) * (poolR + 24),
      );
      ctx.lineTo(
        Math.cos(a - 0.05) * (poolR + 48),
        Math.sin(a - 0.05) * (poolR + 48),
      );
      ctx.stroke();
    }

    ctx.restore();
  };

  drawNaturalBaseSanctum(260, 720, PALETTE.blueArcane, PALETTE.blueGlow, false);
  drawNaturalBaseSanctum(
    width - 260,
    720,
    PALETTE.redArcane,
    PALETTE.redGlow,
    true,
  );

  // ---------------------------------------------------------------------------
  // 8. 12 Interior Jungle Camp Clearings (Organic Earth & Mossy Stone Alcoves)
  // ---------------------------------------------------------------------------
  for (const ring of CAMP_ROCK_RINGS) {
    if (ring.stones === 16) continue; // Boss coves already drawn
    const g = ctx.createRadialGradient(
      ring.x,
      ring.y,
      ring.radius * 0.12,
      ring.x,
      ring.y,
      ring.radius * 1.25,
    );
    g.addColorStop(0, PALETTE.campEarthInner);
    g.addColorStop(0.55, PALETTE.campEarthOuter + "e0");
    g.addColorStop(0.82, "rgba(56, 78, 44, 0.55)");
    g.addColorStop(1, "rgba(56, 78, 44, 0)");
    ctx.fillStyle = g;
    ctx.beginPath();
    for (let a = 0; a < Math.PI * 2; a += Math.PI / 14) {
      const r =
        ring.radius * 1.18 +
        Math.sin(a * 4 + ring.x) * 7 +
        Math.cos(a * 3 + ring.y) * 5;
      const px = ring.x + Math.cos(a) * r;
      const py = ring.y + Math.sin(a) * r;
      a === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py);
    }
    ctx.closePath();
    ctx.fill();

    // Subtle weathered stone slabs inside each camp clearing
    for (let s = 0; s < 4; s++) {
      const sa = ring.entrance + Math.PI + (s - 1.5) * 0.55;
      const sr = ring.radius * 0.48;
      const sx = ring.x + Math.cos(sa) * sr;
      const sy = ring.y + Math.sin(sa) * sr;
      ctx.fillStyle = "rgba(82, 86, 78, 0.52)";
      ctx.beginPath();
      ctx.ellipse(sx, sy, 12, 8, sa, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // ---------------------------------------------------------------------------
  // 9. Rich Organic Rock Ridge Ground Bedding & Purple Arcane Crevice Glows
  //    (Blends the 3D rock formations into the grassy field like Summoner's Rift)
  // ---------------------------------------------------------------------------
  for (let i = 0; i < ROCK_TERRAIN.length; i++) {
    const rock = ROCK_TERRAIN[i];
    // Dark mossy forest soil & ambient occlusion under each rock formation
    const bedGrad = ctx.createRadialGradient(
      rock.x,
      rock.y,
      rock.radius * 0.2,
      rock.x,
      rock.y,
      rock.radius * 1.65,
    );
    bedGrad.addColorStop(0, "rgba(18, 28, 22, 0.72)");
    bedGrad.addColorStop(0.55, "rgba(32, 48, 30, 0.48)");
    bedGrad.addColorStop(1, "rgba(42, 68, 36, 0)");
    ctx.fillStyle = bedGrad;
    ctx.beginPath();
    ctx.ellipse(
      rock.x,
      rock.y + 3,
      rock.radius * 1.6,
      rock.radius * 1.35,
      (i % 5) * 0.3,
      0,
      Math.PI * 2,
    );
    ctx.fill();

    // Subtle purple arcane fissure glow at river-facing and buff-camp rock bases (like reference image)
    if (
      Math.abs(rock.x - width / 2) < 340 ||
      i % 7 === 0
    ) {
      ctx.strokeStyle = "rgba(168, 85, 247, 0.34)";
      ctx.lineWidth = 2.2;
      ctx.beginPath();
      ctx.moveTo(rock.x - rock.radius * 0.6, rock.y - rock.radius * 0.2);
      ctx.lineTo(rock.x, rock.y + rock.radius * 0.15);
      ctx.lineTo(rock.x + rock.radius * 0.55, rock.y - rock.radius * 0.1);
      ctx.stroke();
    }
  }

  // ---------------------------------------------------------------------------
  // 10. Crisp, Lush Stealth Brush Patches (Tall Summoner's Rift Grass)
  // ---------------------------------------------------------------------------
  for (const b of ARAM_BUSHES) {
    const blob = (dx: number, dy: number, s: number, c: string) => {
      ctx.fillStyle = c;
      ctx.beginPath();
      ctx.ellipse(
        b.x + dx * b.width,
        b.y + dy * b.height,
        b.width * s,
        b.height * s * 0.95,
        0,
        0,
        Math.PI * 2,
      );
      ctx.fill();
    };
    for (let i = 0; i < 8; i++)
      blob(
        between(-0.28, 0.28),
        between(-0.26, 0.26),
        between(0.22, 0.3),
        PALETTE.bushDark,
      );
    for (let i = 0; i < 8; i++)
      blob(
        between(-0.24, 0.24),
        between(-0.24, 0.22),
        between(0.16, 0.24),
        PALETTE.bushMid,
      );
    for (let i = 0; i < 6; i++)
      blob(
        between(-0.2, 0.2),
        between(-0.26, 0.14),
        between(0.1, 0.16),
        PALETTE.bushLight,
      );
  }

  // ---------------------------------------------------------------------------
  // 11. Atmospheric Forest Sunlight & Soft Edge Vignette
  // ---------------------------------------------------------------------------
  const sun = ctx.createLinearGradient(0, 0, width, height);
  sun.addColorStop(0, "rgba(255, 244, 205, 0.06)");
  sun.addColorStop(0.5, "rgba(185, 230, 195, 0.02)");
  sun.addColorStop(1, "rgba(10, 20, 22, 0.10)");
  ctx.fillStyle = sun;
  ctx.fillRect(0, 0, width, height);

  const vig = ctx.createRadialGradient(
    width / 2,
    height / 2,
    height * 0.54,
    width / 2,
    height / 2,
    width * 0.72,
  );
  vig.addColorStop(0, `rgba(${PALETTE.vignette},0)`);
  vig.addColorStop(1, `rgba(${PALETTE.vignette},0.34)`);
  ctx.fillStyle = vig;
  ctx.fillRect(0, 0, width, height);

  ctx.restore();
}
