import { LANDSCAPE, stoneLaneEdges } from "../arenaLandform";
import { ARAM_BUSHES, CAMP_ROCK_RINGS, ROCK_TERRAIN } from "../arenaRules";
import { chasmCenterX, RIDGE_RAMPS } from "../arenaElevation";
import { mapLayoutY, laneY } from "../arenaLayout";

/**
 * Dota-inspired Radiant (West) vs. Dire (East) ground painter with a sunken rocky canyon chasm divide.
 * Ground-plane decoration only: no new routes, walls or collision facts.
 */
const PALETTE = {
  radTop: "#2f5434",
  radMid: "#3f6a3e",
  radLow: "#2b4b30",
  radPatchLight: "#6f9f52",
  radPatchDark: "#1d3d26",
  direTop: "#2d2829",
  direMid: "#3b3331",
  direLow: "#241f20",
  direPatchLight: "#57463e",
  direPatchDark: "#181415",
  laneRad: "#bcb195",
  laneDire: "#766e68",
  laneEdgeDark: "#454137",
  laneEdgeLight: "#e3d9bc",
  chasmFloor: "#1e1b19",
  chasmBedrock: "#141212",
  chasmRimRad: "#5c5445",
  chasmRimDire: "#453835",
  dirtRad: "#968055",
  dirtDire: "#615044",
  bushDark: "#18422b",
  bushMid: "#29683c",
  bushLight: "#569c56",
  blue: "#3cc4dc",
  red: "#e0566f",
  plazaRad: "#aea994",
  plazaDire: "#68605b",
  vignette: "6,14,13",
};

const lcg = (seed: number) => () => {
  seed = (seed * 1664525 + 1013904223) >>> 0;
  return seed / 4294967296;
};

export function paintProceduralArena(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
) {
  const rand = lcg(7);
  const between = (a: number, b: number) => a + rand() * (b - a);
  const L = LANDSCAPE.left,
    R = LANDSCAPE.right;
  ctx.save();
  ctx.lineCap = "round";
  ctx.lineJoin = "round";

  // 1. Base Radiant (West) and Dire (East) biome gradients.
  const radGrad = ctx.createLinearGradient(0, 0, 0, height);
  radGrad.addColorStop(0, PALETTE.radTop);
  radGrad.addColorStop(0.5, PALETTE.radMid);
  radGrad.addColorStop(1, PALETTE.radLow);
  ctx.fillStyle = radGrad;
  ctx.fillRect(0, 0, width * 0.55, height);

  const direGrad = ctx.createLinearGradient(0, 0, 0, height);
  direGrad.addColorStop(0, PALETTE.direTop);
  direGrad.addColorStop(0.5, PALETTE.direMid);
  direGrad.addColorStop(1, PALETTE.direLow);
  ctx.fillStyle = direGrad;
  ctx.fillRect(width * 0.45, 0, width * 0.55, height);

  // Smooth central biome blend under the canyon
  const biomeBlend = ctx.createLinearGradient(width * 0.38, 0, width * 0.62, 0);
  biomeBlend.addColorStop(0, PALETTE.radMid);
  biomeBlend.addColorStop(0.5, "#344238");
  biomeBlend.addColorStop(1, PALETTE.direMid);
  ctx.fillStyle = biomeBlend;
  ctx.fillRect(width * 0.38, 0, width * 0.24, height);

  // 2. Large soft moss, humus & canopy-dapple patches break up flat ground.
  for (let i = 0; i < 130; i++) {
    const x = between(0, width),
      y = between(0, height),
      r = between(65, 230);
    const isDire = x > width * 0.52;
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    const c = isDire
      ? i % 2
        ? PALETTE.direPatchLight
        : PALETTE.direPatchDark
      : i % 2
        ? PALETTE.radPatchLight
        : PALETTE.radPatchDark;
    g.addColorStop(0, c + "3c");
    g.addColorStop(1, c + "00");
    ctx.fillStyle = g;
    ctx.fillRect(x - r, y - r, r * 2, r * 2);
  }

  // 2b. Central Sunken Rocky Chasm Gorge divide (North-to-South through the lowlands).
  const traceChasm = () => {
    ctx.beginPath();
    for (let y = 0; y <= height; y += 18) {
      const cx = chasmCenterX(y);
      y === 0 ? ctx.moveTo(cx, y) : ctx.lineTo(cx, y);
    }
  };
  ctx.save();
  // Canyon outer rim shadow
  traceChasm();
  ctx.strokeStyle = "rgba(10,8,8,.65)";
  ctx.lineWidth = 170;
  ctx.stroke();
  // Canyon rock strata rim
  traceChasm();
  ctx.strokeStyle = PALETTE.chasmRimRad;
  ctx.lineWidth = 138;
  ctx.stroke();
  // Canyon floor dark bedrock
  traceChasm();
  ctx.strokeStyle = PALETTE.chasmFloor;
  ctx.lineWidth = 92;
  ctx.stroke();
  traceChasm();
  ctx.strokeStyle = PALETTE.chasmBedrock;
  ctx.lineWidth = 50;
  ctx.stroke();

  // Fractured canyon floor fissure cracks and scree
  for (let i = 0; i < 58; i++) {
    const cy = between(25, height - 25);
    const cx = chasmCenterX(cy) + between(-36, 36);
    ctx.strokeStyle = i % 4 === 0 ? "rgba(225,85,35,.35)" : "rgba(8,6,6,.75)";
    ctx.lineWidth = between(1.4, 3.2);
    ctx.beginPath();
    ctx.moveTo(cx, cy - 14);
    ctx.lineTo(cx + between(-16, 16), cy);
    ctx.lineTo(cx + between(-8, 8), cy + 14);
    ctx.stroke();
  }
  ctx.restore();

  // 2c. Radiant bioluminescent glade rings & Dire smoldering magma cracks in the jungles.
  for (let i = 0; i < 44; i++) {
    const sx = between(L + 40, R - 40),
      sy = between(55, height - 55);
    const e = stoneLaneEdges(sx);
    if (sy > e.top - 55 && sy < e.bottom + 55) continue;
    if (Math.abs(sx - chasmCenterX(sy)) < 65) continue;
    const isDire = sx > width * 0.52;
    ctx.save();
    if (isDire) {
      ctx.beginPath();
      let cx = sx,
        cy = sy;
      ctx.moveTo(cx, cy);
      for (let s = 0; s < 4; s++) {
        cx += between(-26, 26);
        cy += between(-18, 18);
        ctx.lineTo(cx, cy);
      }
      ctx.strokeStyle = "rgba(20,14,13,.58)";
      ctx.lineWidth = 4.5;
      ctx.stroke();
      ctx.strokeStyle = i % 3 === 0 ? "rgba(240,95,42,.42)" : "rgba(155,55,35,.26)";
      ctx.lineWidth = 1.6;
      ctx.stroke();
    } else {
      const gladeR = between(24, 52);
      const g = ctx.createRadialGradient(sx, sy, gladeR * 0.2, sx, sy, gladeR);
      g.addColorStop(0, "rgba(95,215,175,.14)");
      g.addColorStop(1, "rgba(95,215,175,0)");
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(sx, sy, gladeR, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  // 2d. Winding ancient jungle footpaths & stepping-stone trails linking ramps and camps.
  for (const yBase of [mapLayoutY(174), mapLayoutY(584)]) {
    for (const [passW, passColor] of [
      [38, "rgba(88,74,50,.44)"],
      [20, "rgba(142,122,82,.26)"],
    ] as const) {
      ctx.beginPath();
      for (let i = 0; i <= 64; i++) {
        const x = 410 + (i * 1780) / 64;
        const z = yBase + Math.sin(x * 0.006) * 18 + Math.cos(x * 0.013) * 8;
        i === 0 ? ctx.moveTo(x, z) : ctx.lineTo(x, z);
      }
      ctx.strokeStyle = passColor;
      ctx.lineWidth = passW;
      ctx.stroke();
    }
    for (let i = 0; i <= 46; i++) {
      const x = 440 + (i * 1720) / 46;
      const z = yBase + Math.sin(x * 0.006) * 18 + Math.cos(x * 0.013) * 8;
      ctx.fillStyle = x > width / 2 ? "rgba(98,88,82,.35)" : "rgba(165,154,125,.35)";
      ctx.beginPath();
      ctx.ellipse(x, z + (i % 2 ? 4 : -4), 10, 6, (i % 5) * 0.2, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // 3. Grass tufts, forest needles & pebbles.
  ctx.lineWidth = 1.4;
  for (let i = 0; i < 2200; i++) {
    const x = between(0, width),
      y = between(0, height),
      len = between(5, 12),
      dx = between(-4, 4);
    const isDire = x > width * 0.52;
    ctx.strokeStyle = isDire
      ? rand() > 0.5
        ? "rgba(150,130,105,.18)"
        : "rgba(22,18,16,.32)"
      : rand() > 0.5
        ? "rgba(185,230,130,.22)"
        : "rgba(18,55,32,.28)";
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.quadraticCurveTo(x + dx * 0.5, y - len, x + dx, y - len * 1.1);
    ctx.stroke();
  }

  // 4. Base plazas (sanctuary courtyards).
  const plaza = (cx: number, cy: number, tint: string, isDire: boolean) => {
    const rx = 240,
      ry = 220;
    ctx.save();
    ctx.translate(cx, cy);
    ctx.scale(1, ry / rx);
    ctx.shadowColor = "rgba(0,0,0,.48)";
    ctx.shadowBlur = 34;
    const g = ctx.createRadialGradient(0, 0, 20, 0, 0, rx);
    g.addColorStop(0, isDire ? "#847870" : "#d2ccb2");
    g.addColorStop(0.75, isDire ? PALETTE.plazaDire : PALETTE.plazaRad);
    g.addColorStop(1, isDire ? "#453e3b" : "#757360");
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(0, 0, rx, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.strokeStyle = isDire ? "rgba(30,24,22,.38)" : "rgba(85,78,60,.28)";
    ctx.lineWidth = 2;
    for (const rad of [65, 115, 165, 215]) {
      ctx.beginPath();
      ctx.arc(0, 0, rad, 0, Math.PI * 2);
      ctx.stroke();
    }
    for (let i = 0; i < 16; i++) {
      const a = (i * Math.PI) / 8;
      ctx.beginPath();
      ctx.moveTo(Math.cos(a) * 65, Math.sin(a) * 65);
      ctx.lineTo(Math.cos(a) * (rx - 10), Math.sin(a) * (rx - 10));
      ctx.stroke();
    }
    const t = ctx.createRadialGradient(0, 0, 0, 0, 0, rx * 0.85);
    t.addColorStop(0, tint + "55");
    t.addColorStop(1, tint + "00");
    ctx.fillStyle = t;
    ctx.beginPath();
    ctx.arc(0, 0, rx, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = PALETTE.laneEdgeDark;
    ctx.lineWidth = 7;
    ctx.beginPath();
    ctx.arc(0, 0, rx - 3, 0, Math.PI * 2);
    ctx.stroke();
    ctx.strokeStyle = PALETTE.laneEdgeLight + "99";
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.arc(0, 0, rx - 10, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  };
  plaza(220, laneY(220), PALETTE.blue, false);
  plaza(width - 220, laneY(width - 220), PALETTE.red, true);

  // 4b. 3D Cliff Wall Strata Bands along the raised middle lane edges.
  for (const north of [true, false]) {
    const sign = north ? -1 : 1;
    for (const [dist, lw, col] of [
      [26, 34, "rgba(10,20,16,.55)"],
      [15, 24, "#3b423a"],
      [6, 14, "#686b5c"],
    ] as const) {
      ctx.beginPath();
      for (let x = L; x <= R; x += 10) {
        const y = stoneLaneEdges(x)[north ? "top" : "bottom"] + sign * dist;
        x === L ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
      }
      ctx.strokeStyle = col;
      ctx.lineWidth = lw;
      ctx.stroke();
    }
  }

  // 5. Elevated Stone Causeway Bridge across the central chasm.
  const traceLane = () => {
    ctx.beginPath();
    ctx.moveTo(L, stoneLaneEdges(L).top);
    for (let x = L; x <= R; x += 10) ctx.lineTo(x, stoneLaneEdges(x).top);
    for (let x = R; x >= L; x -= 10) ctx.lineTo(x, stoneLaneEdges(x).bottom);
    ctx.closePath();
  };
  ctx.save();
  ctx.shadowColor = "rgba(0,0,0,.52)";
  ctx.shadowBlur = 30;
  ctx.shadowOffsetY = 8;
  traceLane();
  const laneGrad = ctx.createLinearGradient(L, 0, R, 0);
  laneGrad.addColorStop(0, PALETTE.laneRad);
  laneGrad.addColorStop(0.48, "#aca289");
  laneGrad.addColorStop(0.52, "#8e857b");
  laneGrad.addColorStop(1, PALETTE.laneDire);
  ctx.fillStyle = laneGrad;
  ctx.fill();
  ctx.restore();

  ctx.save();
  traceLane();
  ctx.clip();
  let top = Infinity,
    bottom = -Infinity;
  for (let x = L; x <= R; x += 20) {
    const e = stoneLaneEdges(x);
    top = Math.min(top, e.top);
    bottom = Math.max(bottom, e.bottom);
  }
  const row = 42;
  for (let y = top - row, r = 0; y < bottom + row; y += row, r++) {
    for (let x = L - 100 + (r % 2) * 40; x < R + 100; ) {
      const w = between(56, 96);
      const direRatio = Math.max(0, Math.min(1, (x - L) / (R - L)));
      const hue = between(36, 44) * (1 - direRatio) + between(18, 28) * direRatio;
      const sat = between(14, 22) * (1 - direRatio * 0.45);
      const light = between(60, 71) * (1 - direRatio * 0.28);
      ctx.fillStyle = `hsl(${hue},${sat}%,${light}%)`;
      ctx.fillRect(x + 1.5, y + 1.5, w - 3, row - 3);
      ctx.strokeStyle = direRatio > 0.55 ? "rgba(38,32,30,.52)" : "rgba(88,78,58,.46)";
      ctx.lineWidth = 2;
      ctx.strokeRect(x + 1.5, y + 1.5, w - 3, row - 3);
      ctx.fillStyle = direRatio > 0.55 ? "rgba(255,160,110,.08)" : "rgba(255,248,220,.14)";
      ctx.fillRect(x + 3, y + 3, w - 6, 3);
      x += w;
    }
  }
  for (let x = L; x <= R; x += 20) {
    const e = stoneLaneEdges(x),
      mid = (e.top + e.bottom) / 2,
      h = (e.bottom - e.top) / 2;
    const g = ctx.createLinearGradient(0, mid - h, 0, mid + h);
    g.addColorStop(0, "rgba(40,34,22,.26)");
    g.addColorStop(0.5, "rgba(255,245,210,.12)");
    g.addColorStop(1, "rgba(40,34,22,.26)");
    ctx.fillStyle = g;
    ctx.fillRect(x, e.top, 21, e.bottom - e.top);
  }
  ctx.restore();

  const edge = (pick: "top" | "bottom") => {
    ctx.beginPath();
    for (let x = L; x <= R; x += 10) {
      const y = stoneLaneEdges(x)[pick];
      x === L ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
    }
    ctx.stroke();
  };
  ctx.strokeStyle = PALETTE.laneEdgeDark;
  ctx.lineWidth = 8;
  edge("top");
  edge("bottom");
  ctx.save();
  ctx.strokeStyle = PALETTE.laneEdgeLight + "b5";
  ctx.lineWidth = 2.5;
  ctx.translate(0, 3);
  edge("top");
  ctx.translate(0, -6);
  edge("bottom");
  ctx.restore();

  // Frost glaze along the northern Howling Abyss bridge rim
  ctx.save();
  ctx.strokeStyle = "rgba(180,230,250,.35)";
  ctx.lineWidth = 3.5;
  edge("top");
  ctx.restore();

  // 6. Ramps with carved steps
  for (const north of [true, false])
    for (const x of north ? RIDGE_RAMPS.north : RIDGE_RAMPS.south) {
      const e = stoneLaneEdges(x),
        y = north ? e.top : e.bottom;
      const ry = north ? y - 72 : y - 8;
      ctx.fillStyle = x > width / 2 ? "#857c73" : PALETTE.laneRad;
      ctx.fillRect(x - 26, ry, 52, 80);
      ctx.strokeStyle = PALETTE.laneEdgeDark;
      ctx.lineWidth = 3.5;
      ctx.strokeRect(x - 26, ry, 52, 80);
      for (let k = 1; k < 6; k++) {
        const yy = ry + k * 13;
        ctx.strokeStyle = "rgba(55,48,38,.55)";
        ctx.lineWidth = 2.2;
        ctx.beginPath();
        ctx.moveTo(x - 24, yy);
        ctx.lineTo(x + 24, yy);
        ctx.stroke();
        ctx.strokeStyle = "rgba(235,225,195,.35)";
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(x - 24, yy + 2);
        ctx.lineTo(x + 24, yy + 2);
        ctx.stroke();
      }
    }

  // 7. Celestial Astrolabe Inlay on the central bridge
  const cx = width / 2,
    cy = height / 2;
  ctx.save();
  ctx.translate(cx, cy);
  const centerGlow = ctx.createRadialGradient(0, 0, 8, 0, 0, 96);
  centerGlow.addColorStop(0, "rgba(255,225,145,.32)");
  centerGlow.addColorStop(0.6, "rgba(95,195,215,.14)");
  centerGlow.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = centerGlow;
  ctx.beginPath();
  ctx.arc(0, 0, 96, 0, Math.PI * 2);
  ctx.fill();

  ctx.strokeStyle = "rgba(75,65,45,.75)";
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.arc(0, 0, 74, 0, Math.PI * 2);
  ctx.stroke();
  ctx.strokeStyle = "rgba(215,190,125,.65)";
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.arc(0, 0, 54, 0, Math.PI * 2);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(0, 0, 32, 0, Math.PI * 2);
  ctx.stroke();
  for (let i = 0; i < 12; i++) {
    const a = (i * Math.PI) / 6;
    ctx.beginPath();
    ctx.moveTo(Math.cos(a) * 32, Math.sin(a) * 32);
    ctx.lineTo(Math.cos(a) * 84, Math.sin(a) * 84);
    ctx.stroke();
  }
  ctx.fillStyle = "rgba(255,240,185,.42)";
  ctx.beginPath();
  ctx.arc(0, 0, 16, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  // 8. Jungle camp clearings & Dragon / Siege Golem boss sanctuaries
  for (const ring of CAMP_ROCK_RINGS) {
    const isBoss = ring.stones === 16;
    const isDragon = ring.id === "dragon_boss";
    const baseDirt = ring.x > width / 2 ? PALETTE.dirtDire : PALETTE.dirtRad;
    const g = ctx.createRadialGradient(
      ring.x,
      ring.y,
      ring.radius * 0.1,
      ring.x,
      ring.y,
      ring.radius * 1.05,
    );
    g.addColorStop(0, (isDragon ? "#663624" : baseDirt) + "ee");
    g.addColorStop(0.68, baseDirt + "99");
    g.addColorStop(1, baseDirt + "00");
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.ellipse(
      ring.x,
      ring.y,
      ring.radius * 1.02,
      ring.radius * 0.94,
      0,
      0,
      Math.PI * 2,
    );
    ctx.fill();
    if (isBoss) {
      ctx.save();
      ctx.translate(ring.x, ring.y);
      if (isDragon) {
        // Volcanic magma caldera with radiating molten veins and charcoal scorched earth
        const magmaCore = ctx.createRadialGradient(0, 0, 4, 0, 0, ring.radius * 0.55);
        magmaCore.addColorStop(0, "rgba(255,100,20,.65)");
        magmaCore.addColorStop(0.5, "rgba(230,50,15,.45)");
        magmaCore.addColorStop(1, "rgba(35,16,12,0)");
        ctx.fillStyle = magmaCore;
        ctx.beginPath();
        ctx.arc(0, 0, ring.radius * 0.55, 0, Math.PI * 2);
        ctx.fill();

        ctx.strokeStyle = "rgba(255,140,50,.72)";
        ctx.lineWidth = 2.8;
        for (let i = 0; i < 10; i++) {
          const a = (i * Math.PI) / 5 + 0.15;
          ctx.beginPath();
          ctx.moveTo(Math.cos(a) * ring.radius * 0.22, Math.sin(a) * ring.radius * 0.22);
          const midA = a + (i % 2 === 0 ? 0.08 : -0.08);
          ctx.lineTo(Math.cos(midA) * ring.radius * 0.58, Math.sin(midA) * ring.radius * 0.58);
          ctx.lineTo(Math.cos(a) * ring.radius * 0.88, Math.sin(a) * ring.radius * 0.88);
          ctx.stroke();
        }
      } else {
        // Siege Golem ancient weathered runic circle with glowing leyline channels
        const leyGlow = ctx.createRadialGradient(0, 0, 8, 0, 0, ring.radius * 0.65);
        leyGlow.addColorStop(0, "rgba(70,225,185,.32)");
        leyGlow.addColorStop(0.6, "rgba(30,140,110,.18)");
        leyGlow.addColorStop(1, "rgba(10,35,25,0)");
        ctx.fillStyle = leyGlow;
        ctx.beginPath();
        ctx.arc(0, 0, ring.radius * 0.65, 0, Math.PI * 2);
        ctx.fill();

        ctx.strokeStyle = "rgba(110,240,200,.65)";
        ctx.lineWidth = 2.4;
        ctx.beginPath();
        ctx.arc(0, 0, ring.radius * 0.68, 0, Math.PI * 2);
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(0, 0, ring.radius * 0.38, 0, Math.PI * 2);
        ctx.stroke();
        for (let i = 0; i < 12; i++) {
          const a = (i * Math.PI) / 6;
          ctx.beginPath();
          ctx.moveTo(Math.cos(a) * ring.radius * 0.38, Math.sin(a) * ring.radius * 0.38);
          ctx.lineTo(Math.cos(a) * ring.radius * 0.68, Math.sin(a) * ring.radius * 0.68);
          ctx.stroke();
        }
      }
      ctx.restore();
    }
    for (let i = 0; i < 28; i++) {
      const a = rand() * Math.PI * 2,
        d = ring.radius * between(0.42, 0.86),
        r = between(1.6, 3.8);
      ctx.fillStyle =
        rand() > 0.5 ? "rgba(210,195,150,.68)" : "rgba(65,52,36,.58)";
      ctx.beginPath();
      ctx.arc(
        ring.x + Math.cos(a) * d,
        ring.y + Math.sin(a) * d,
        r,
        0,
        Math.PI * 2,
      );
      ctx.fill();
    }
  }

  // 9. Contact shadows under rock instances
  for (const rock of ROCK_TERRAIN) {
    ctx.fillStyle = "rgba(8,18,14,.42)";
    ctx.beginPath();
    ctx.ellipse(
      rock.x + 3,
      rock.y + rock.radius * 0.22,
      rock.radius * 1.15,
      rock.radius * 0.78,
      0,
      0,
      Math.PI * 2,
    );
    ctx.fill();
  }

  // 10. Brush
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
    for (let i = 0; i < 9; i++)
      blob(
        between(-0.3, 0.3),
        between(-0.3, 0.3),
        between(0.2, 0.3),
        PALETTE.bushDark,
      );
    for (let i = 0; i < 9; i++)
      blob(
        between(-0.28, 0.28),
        between(-0.32, 0.22),
        between(0.15, 0.24),
        PALETTE.bushMid,
      );
    for (let i = 0; i < 7; i++)
      blob(
        between(-0.22, 0.22),
        between(-0.34, 0.1),
        between(0.08, 0.14),
        PALETTE.bushLight,
      );
    ctx.strokeStyle = "rgba(200,225,140,.55)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.ellipse(b.x, b.y, b.width / 2, b.height / 2, 0, 0, Math.PI * 2);
    ctx.stroke();
  }

  // 11. Sanctuary rings
  const ornament = (x: number, tint: string) => {
    ctx.save();
    ctx.translate(x, height / 2);
    ctx.scale(1, 2.3);
    ctx.shadowColor = tint;
    ctx.shadowBlur = 22;
    ctx.strokeStyle = tint + "cc";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(0, 0, 92, 0, Math.PI * 2);
    ctx.stroke();
    ctx.shadowBlur = 0;
    ctx.strokeStyle = tint + "66";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(0, 0, 70, 0, Math.PI * 2);
    ctx.stroke();
    ctx.lineWidth = 3;
    for (let i = 0; i < 24; i++) {
      const a = (i * Math.PI) / 12;
      ctx.beginPath();
      ctx.moveTo(Math.cos(a) * 100, Math.sin(a) * 100);
      ctx.lineTo(Math.cos(a) * 108, Math.sin(a) * 108);
      ctx.stroke();
    }
    const g = ctx.createRadialGradient(0, 0, 0, 0, 0, 70);
    g.addColorStop(0, tint + "44");
    g.addColorStop(1, tint + "00");
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(0, 0, 70, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  };
  ornament(90, PALETTE.blue);
  ornament(width - 90, PALETTE.red);

  // 12. Wildflowers & spores
  for (let i = 0; i < 260; i++) {
    const x = between(L, R),
      e = stoneLaneEdges(x),
      north = rand() > 0.5;
    const y = north ? e.top - between(28, 220) : e.bottom + between(28, 220);
    const isDire = x > width * 0.52;
    ctx.fillStyle =
      (isDire
        ? ["#ff7b3d", "#d94f30", "#b89f7d"]
        : ["#7ef5d8", "#f3e6a0", "#f2b7c5"])[i % 3] + "cc";
    ctx.beginPath();
    ctx.arc(x, y, between(1.5, 2.8), 0, Math.PI * 2);
    ctx.fill();
  }

  // 13. Directional sunbeam & vignette
  const sun = ctx.createLinearGradient(0, 0, width, height);
  sun.addColorStop(0, "rgba(255,242,195,.12)");
  sun.addColorStop(0.5, "rgba(180,220,190,.04)");
  sun.addColorStop(1, "rgba(12,8,22,.16)");
  ctx.fillStyle = sun;
  ctx.fillRect(0, 0, width, height);
  const vig = ctx.createRadialGradient(
    width / 2,
    height / 2,
    height * 0.44,
    width / 2,
    height / 2,
    width * 0.65,
  );
  vig.addColorStop(0, `rgba(${PALETTE.vignette},0)`);
  vig.addColorStop(1, `rgba(${PALETTE.vignette},.58)`);
  ctx.fillStyle = vig;
  ctx.fillRect(0, 0, width, height);

  ctx.restore();
}
