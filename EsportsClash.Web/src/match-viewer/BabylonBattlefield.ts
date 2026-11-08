import { MeshBuilder, TransformNode, DynamicTexture, StandardMaterial, Color3, Vector3, Mesh, VertexBuffer, VertexData, type Scene, type InstancedMesh } from '@babylonjs/core';
import { arenaGroundHeight, RIDGE_HEIGHT, RIDGE_RAMPS, chasmCenterX } from '../arenaElevation';
import { drawNaturalArena, stoneLaneEdges, LANDSCAPE } from '../arenaLandform';
import { ROCK_TERRAIN, ARAM_BUSHES, CAMP_ROCK_RINGS } from '../arenaRules';
import { arenaCampArt } from '../arenaArtDirection';
import type { ViewerActor } from './MatchViewer';
import { paintProceduralArena } from './PaintedArenaProcedural';
import { ARENA_HEIGHT, LANE_SLOPE, laneY, topLaneY, botLaneY, LANE_HALF_WIDTH } from '../arenaLayout';

type Material = (color: string) => StandardMaterial;
const noise = (n: number) => {
  const v = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return v - Math.floor(v);
};

/**
 * Clean Summoner's Rift / Wild Rift inspired 3D battlefield builder (`straight-v4`).
 * All scenery follows authoritative terrain facts; it never adds colliders.
 */
export function buildBabylonBattlefield(scene: Scene, width: number, height: number, material: Material) {
  // 3D atmospheric woodland valley backdrop surrounding the arena
  const valleyMat = new StandardMaterial('decorative-valley-mat', scene);
  valleyMat.diffuseColor = new Color3(0.09, 0.16, 0.13);
  valleyMat.specularColor = Color3.Black();
  valleyMat.emissiveColor = new Color3(0.04, 0.08, 0.06);
  const backdrop = MeshBuilder.CreateGround('decorative-valley', { width: width + 2400, height: height + 2800 }, scene);
  backdrop.position.set(width / 2, -45, height / 2);
  backdrop.material = valleyMat;
  backdrop.isPickable = false;

  // 1. High-resolution 3D sculpted terrain mesh with smooth normal lighting.
  const ground = MeshBuilder.CreateGround('arena', { width, height, subdivisions: 200, updatable: true }, scene);
  ground.position.set(width / 2, 0, height / 2);
  const p = ground.getVerticesData(VertexBuffer.PositionKind)!,
    indices = ground.getIndices()!;
  for (let i = 0; i < p.length; i += 3) {
    const wx = p[i] + width / 2,
      wz = p[i + 2] + height / 2;
    const micro = (noise(wx * 0.05 + wz * 0.08) - 0.5) * 0.8;
    p[i + 1] = arenaGroundHeight(wx, wz) - 1 + micro;
  }
  const normals: number[] = [];
  VertexData.ComputeNormals(p, indices, normals);
  ground.updateVerticesData(VertexBuffer.PositionKind, p);
  ground.updateVerticesData(VertexBuffer.NormalKind, normals);
  ground.refreshBoundingInfo();

  const texture = new DynamicTexture('arena-paving', { width, height }, scene, false);
  const ctx = texture.getContext() as unknown as CanvasRenderingContext2D;
  drawNaturalArena(ctx, 0);
  paintProceduralArena(ctx, width, height);
  texture.update(false);

  const paving = new StandardMaterial('arena-surface', scene);
  paving.diffuseTexture = texture;
  paving.specularColor = new Color3(0.12, 0.13, 0.11);
  paving.specularPower = 42;
  paving.diffuseColor = new Color3(0.97, 0.97, 0.95);
  paving.emissiveColor = new Color3(0.24, 0.26, 0.24);
  ground.material = paving;

  scene.metadata = { ...scene.metadata, paintedArena: 'ready', paintedBackdrop: 'ready' };

  // Emissive glowing materials for clean MOBA accents
  const makeGlowMat = (name: string, diffuseHex: string, emissiveHex: string) => {
    const m = new StandardMaterial(name, scene);
    m.diffuseColor = Color3.FromHexString(diffuseHex);
    m.emissiveColor = Color3.FromHexString(emissiveHex);
    m.specularColor = Color3.White();
    m.specularPower = 64;
    return m;
  };
  const flameRadMat = makeGlowMat('flame-rad-mat', '#6bf0ff', '#2cb8d9');
  const flameDireMat = makeGlowMat('flame-dire-mat', '#ff7b52', '#d94426');
  const goldGlowMat = makeGlowMat('gold-glow-mat', '#ffe699', '#c99738');
  const jadeGlowMat = makeGlowMat('jade-glow-mat', '#7effd4', '#26a685');
  const purpleVoidMat = makeGlowMat('purple-void-mat', '#d8b4fe', '#9333ea');
  const torchFlameMat = makeGlowMat('torch-flame-mat', '#ffd166', '#ff6b00');

  const animatedRings: { mesh: Mesh; speed: number; baseY: number; amp: number }[] = [];

  // 2. Sculpted League of Legends Rock Prototypes (Dark Slate Base, Weathered Mid Crag, Mossy Cap & Gnarled Roots)
  const rockDarkProto = MeshBuilder.CreatePolyhedron('rock-dark-proto', { type: 1, size: 1 }, scene);
  rockDarkProto.material = material('#3a454a');
  rockDarkProto.isVisible = false;

  const rockMainProto = MeshBuilder.CreatePolyhedron('rock-main-proto', { type: 1, size: 1 }, scene);
  rockMainProto.material = material('#4f5c61');
  rockMainProto.isVisible = false;

  const rockWarmProto = MeshBuilder.CreatePolyhedron('rock-warm-proto', { type: 3, size: 1 }, scene);
  rockWarmProto.material = material('#5c584f');
  rockWarmProto.isVisible = false;

  const rockCapProto = MeshBuilder.CreatePolyhedron('rock-cap-proto', { type: 2, size: 1 }, scene);
  rockCapProto.material = material('#3d5e37');
  rockCapProto.isVisible = false;

  const rootTendrilProto = MeshBuilder.CreateCylinder('root-tendril-proto', { height: 1, diameterTop: 0.25, diameterBottom: 0.9, tessellation: 6 }, scene);
  rootTendrilProto.material = material('#543d28');
  rootTendrilProto.isVisible = false;

  const purpleShardProto = MeshBuilder.CreateCylinder('purple-shard-proto', { height: 1, diameterTop: 0.12, diameterBottom: 0.85, tessellation: 5 }, scene);
  purpleShardProto.material = purpleVoidMat;
  purpleShardProto.isVisible = false;

  // Natural Non-Straight Boulder Clusters & Weathered Ruins along the Outer/Inner Lane Edges
  // (Replaces the straight white stadium curbs and artificial staircases with organic rock & mossy stone)
  const sanctumR = 168;
  const isNearSanctumOrEntrance = (px: number, py: number) =>
    Math.hypot(px - 260, py - 720) < sanctumR + 28 ||
    Math.hypot(px - (width - 260), py - 720) < sanctumR + 28 ||
    Math.abs(px - 620) < 62 ||
    Math.abs(px - 920) < 62 ||
    Math.abs(px - 1400) < 125 ||
    Math.abs(px - (width - 620)) < 62 ||
    Math.abs(px - (width - 920)) < 62;

  let borderBoulderIdx = 0;
  for (const isTop of [true, false]) {
    const laneYFunc = isTop ? topLaneY : botLaneY;
    for (const sign of [-1, 1]) {
      for (let x = 350; x <= width - 350; x += 46) {
        const cy = laneYFunc(x);
        const dy = (laneYFunc(x + 4) - laneYFunc(x - 4)) / 8;
        const len = Math.hypot(1, dy);
        const nx = -dy / len;
        const ny = 1 / len;
        // Organic non-straight offset outside the lane corridor
        const wiggle = Math.sin(x * 0.041 + sign) * 10 + Math.cos(x * 0.093) * 6;
        const dist = LANE_HALF_WIDTH + 18 + wiggle;
        const bx = x + nx * sign * dist;
        const bz = cy + ny * sign * dist;
        if (isNearSanctumOrEntrance(bx, bz)) continue;
        // Skip inner lane edge where camp rings already form the natural rock wall
        const nearCampRock = ROCK_TERRAIN.some(r => Math.hypot(r.x - bx, r.y - bz) < r.radius + 26);
        if (nearCampRock) continue;

        borderBoulderIdx++;
        const gh = arenaGroundHeight(bx, bz);
        const proto = borderBoulderIdx % 3 === 0 ? rockWarmProto : rockMainProto;
        const b = proto.createInstance(`lane-verge-boulder:${borderBoulderIdx}`);
        const rx = 10 + (borderBoulderIdx % 4) * 3.5;
        const ry = 7 + (borderBoulderIdx % 3) * 3;
        const rz = 9 + ((borderBoulderIdx + 1) % 4) * 3;
        b.position.set(bx, gh + ry * 0.32, bz);
        b.scaling.set(rx, ry, rz);
        b.rotation.set(0.12, borderBoulderIdx * 1.3, -0.08);

        if (borderBoulderIdx % 2 === 0) {
          const moss = rockCapProto.createInstance(`lane-verge-moss:${borderBoulderIdx}`);
          moss.position.set(bx + 2, gh + ry * 0.68, bz - 1);
          moss.scaling.set(rx * 0.72, ry * 0.36, rz * 0.7);
          moss.rotation.y = borderBoulderIdx * 0.9;
        }
      }
    }
  }

  // Ancient Weathered Runic Monoliths & Team Standards around West (Blue) & East (Red) Base Sanctuaries
  const monolithProto = MeshBuilder.CreatePolyhedron('sanctum-monolith-proto', { type: 1, size: 1 }, scene);
  monolithProto.material = material('#4a5459');
  monolithProto.isVisible = false;

  for (const [side, sx, isRed] of [
    ['blue', 260, false],
    ['red', width - 260, true],
  ] as const) {
    const rockAngles = isRed
      ? [-0.78, -0.56, -0.36, 0.36, 0.56, 0.78, Math.PI - 0.34, Math.PI + 0.34]
      : [Math.PI - 0.78, Math.PI - 0.56, Math.PI - 0.36, Math.PI + 0.36, Math.PI + 0.56, Math.PI + 0.78, -0.34, 0.34];
    for (const [mIdx, ang] of rockAngles.entries()) {
      const mx = sx + Math.cos(ang) * (sanctumR + 6 + (mIdx % 2) * 8);
      const mz = 720 + Math.sin(ang) * (sanctumR + 6 + (mIdx % 2) * 8);
      const gh = arenaGroundHeight(mx, mz);
      const mono = monolithProto.createInstance(`sanctum-monolith:${side}:${mIdx}`);
      const mh = 22 + (mIdx % 3) * 7;
      mono.position.set(mx, gh + mh * 0.38, mz);
      mono.scaling.set(16, mh, 14);
      mono.rotation.set(0.08, ang + 0.4, -0.06);

      const mossCap = rockCapProto.createInstance(`sanctum-moss:${side}:${mIdx}`);
      mossCap.position.set(mx, gh + mh * 0.74, mz);
      mossCap.scaling.set(12, mh * 0.32, 11);
    }

    // Glowing Arcane Waystone at the Inner Jungle Gate (X = 425 for Blue, X = 2375 for Red)
    const gateX = isRed ? sx - sanctumR + 4 : sx + sanctumR - 4;
    for (const zOff of [-38, 38]) {
      const gh = arenaGroundHeight(gateX, 720 + zOff);
      const gateStone = rockDarkProto.createInstance(`sanctum-gate-stone:${side}:${zOff}`);
      gateStone.position.set(gateX, gh + 10, 720 + zOff);
      gateStone.scaling.set(13, 18, 12);

      const gateCrystal = MeshBuilder.CreateCylinder(`sanctum-gate-crystal:${side}:${zOff}`, { height: 18, diameterTop: 1.5, diameterBottom: 7, tessellation: 6 }, scene);
      gateCrystal.position.set(gateX, gh + 18, 720 + zOff);
      gateCrystal.rotation.z = isRed ? 0.22 : -0.22;
      gateCrystal.material = isRed ? flameDireMat : flameRadMat;
    }
  }

  // Natural River Ford Boulders flanking the Top (Y=270) & Bottom (Y=1170) River Crossings
  for (const [fIdx, fordY] of [
    [0, 270],
    [1, 1170],
  ] as const) {
    const fordX = chasmCenterX(fordY);
    for (const sign of [-1, 1]) {
      for (const [bIdx, dx] of [-56, -24, 24, 56].entries()) {
        const bx = fordX + dx;
        const bz = fordY + sign * (LANE_HALF_WIDTH + 12 + (bIdx % 2) * 6);
        const gh = arenaGroundHeight(bx, bz);
        const fordRock = rockDarkProto.createInstance(`ford-boulder:${fIdx}:${sign}:${bIdx}`);
        fordRock.position.set(bx, gh + 5, bz);
        fordRock.scaling.set(14 + (bIdx % 2) * 4, 9 + (bIdx % 2) * 3, 12);
        fordRock.rotation.y = bIdx * 1.1;
      }
    }
  }

  // 3. Organic River Shimmer Rings (replaces rectangular water planes so the river has zero boxy edges).
  const riverFoamMat = new StandardMaterial('river-foam-mat', scene);
  riverFoamMat.diffuseColor = Color3.FromHexString('#4ea8b8');
  riverFoamMat.emissiveColor = Color3.FromHexString('#1d5663');
  riverFoamMat.alpha = 0.16;
  riverFoamMat.backFaceCulling = false;

  const abyssFogPlanes: { mesh: Mesh; speed: number; baseOffset: number }[] = [];
  for (const [chanIdx, chanZ] of [
    [0, 415],
    [1, 495],
    [2, 945],
    [3, 1025],
  ] as const) {
    const waterDisc = MeshBuilder.CreateDisc(`river-shimmer-disc:${chanIdx}`, { radius: 42, tessellation: 24 }, scene);
    waterDisc.rotation.x = Math.PI / 2;
    const baseH = arenaGroundHeight(width / 2, chanZ) + 0.6;
    waterDisc.position.set(width / 2, baseH, chanZ);
    waterDisc.material = riverFoamMat;
    waterDisc.isPickable = false;
    abyssFogPlanes.push({ mesh: waterDisc, speed: (chanIdx % 2 === 0 ? 1 : -1) * 0.012, baseOffset: baseH });
  }

  // 4. Multi-Faceted League of Legends Rock Ridges (`ROCK_TERRAIN`), Center River Outcrop & Boss Coves (`CAMP_ROCK_RINGS`).
  // Center River Island (1400, 720): Natural Mossy Rock Outcrop & Ancient Crystal Sentinel (NO flat cylinder pad!)
  const sentinelMain = rockDarkProto.createInstance('island-sentinel-main');
  sentinelMain.position.set(1400, RIDGE_HEIGHT + 15, 720);
  sentinelMain.scaling.set(25, 28, 23);
  sentinelMain.rotation.set(0.08, 0.6, -0.05);

  const sentinelMoss = rockCapProto.createInstance('island-sentinel-moss');
  sentinelMoss.position.set(1400, RIDGE_HEIGHT + 27, 720);
  sentinelMoss.scaling.set(18, 10, 17);

  for (const [sIdx, ox, oz, sx, sy, hasCrystal] of [
    [0, -22, 7, 16, 17, true],
    [1, 21, 9, 15, 16, true],
    [2, -14, -17, 14, 15, true],
    [3, 16, -15, 16, 15, false],
    [4, 5, 21, 13, 12, true],
  ] as const) {
    const subRock = rockMainProto.createInstance(`island-sentinel-sub:${sIdx}`);
    subRock.position.set(1400 + ox, RIDGE_HEIGHT + sy * 0.42, 720 + oz);
    subRock.scaling.set(sx, sy, sx * 0.9);
    subRock.rotation.y = sIdx * 1.1;

    if (hasCrystal) {
      const shard = MeshBuilder.CreateCylinder(`island-crystal:${sIdx}`, { height: 21, diameterTop: 1.4, diameterBottom: 8, tessellation: 6 }, scene);
      shard.position.set(1400 + ox * 1.22, RIDGE_HEIGHT + 13, 720 + oz * 1.22);
      shard.rotation.z = ox < 0 ? 0.32 : -0.32;
      shard.rotation.x = oz < 0 ? -0.22 : 0.22;
      shard.material = flameRadMat;
    }
  }

  // Irregular mossy river boulders framing the North and South banks of the Center River Island
  for (let b = 0; b < 14; b++) {
    const ang = (b * Math.PI * 2) / 14;
    if (Math.abs(Math.sin(ang)) < 0.44) continue;
    const rad = 88 + (b % 3) * 6;
    const bx = 1400 + Math.cos(ang) * rad;
    const bz = 720 + Math.sin(ang) * rad;
    const gh = arenaGroundHeight(bx, bz);
    const boulder = (b % 2 === 0 ? rockDarkProto : rockMainProto).createInstance(`island-rim-boulder:${b}`);
    boulder.position.set(bx, gh + 6, bz);
    boulder.scaling.set(15 + (b % 3) * 3, 14 + (b % 3) * 4, 14);
    boulder.rotation.set(0.1, b * 0.85, -0.07);
  }

  // Sculpted Multi-Tiered Rock Formations for Every Authoritative `ROCK_TERRAIN` Collider
  for (const [i, rock] of ROCK_TERRAIN.entries()) {
    const baseH = arenaGroundHeight(rock.x, rock.y);
    const tall = rock.radius * (0.98 + noise(i) * 0.42);

    // Primary jagged slate crag
    const mainProto = i % 3 === 0 ? rockDarkProto : i % 3 === 1 ? rockMainProto : rockWarmProto;
    const main = mainProto.createInstance(`collision-rock:${i}`);
    main.position.set(rock.x, baseH + tall * 0.36, rock.y);
    main.scaling.set(rock.radius * 1.12, tall, rock.radius * 1.02);
    main.rotation.set((noise(i) - 0.5) * 0.28, noise(i + 10) * 6.2, (noise(i + 4) - 0.5) * 0.24);

    // Secondary interlocking side shoulder boulder so the ridge looks sculpted and non-straight
    const sideAngle = noise(i + 19) * Math.PI * 2;
    const sideDist = rock.radius * 0.48;
    const side = rockDarkProto.createInstance(`collision-rock-side:${i}`);
    side.position.set(
      rock.x + Math.cos(sideAngle) * sideDist,
      baseH + tall * 0.25,
      rock.y + Math.sin(sideAngle) * sideDist,
    );
    side.scaling.set(rock.radius * 0.78, tall * 0.66, rock.radius * 0.74);
    side.rotation.set(0.18, sideAngle, -0.14);

    // Lush mossy turf cap on top of the rock formation
    const cap = rockCapProto.createInstance(`collision-rock-cap:${i}`);
    cap.position.set(
      rock.x + (noise(i + 3) - 0.5) * rock.radius * 0.22,
      baseH + tall * 0.74,
      rock.y + (noise(i + 7) - 0.5) * rock.radius * 0.22,
    );
    cap.scaling.set(rock.radius * 0.76, tall * 0.36, rock.radius * 0.72);
    cap.rotation.set(0.08, noise(i + 22) * 5, -0.06);

    // Glowing Purple Arcane Crystal Fissures & Gnarled Roots on River-Facing & Boss Cove Rocks
    // (Matches the Summoner's Rift Baron Pit reference image!)
    const isRiverOrCoveRock = Math.abs(rock.x - width / 2) < 350 || i % 6 === 0;
    if (isRiverOrCoveRock && i % 2 === 0) {
      const shard = purpleShardProto.createInstance(`rock-purple-fissure:${i}`);
      const shardAng = Math.atan2(720 - rock.y, width / 2 - rock.x);
      shard.position.set(
        rock.x + Math.cos(shardAng) * rock.radius * 0.55,
        baseH + tall * 0.32,
        rock.y + Math.sin(shardAng) * rock.radius * 0.55,
      );
      shard.scaling.set(5.5, tall * 0.58, 5.5);
      shard.rotation.set(Math.sin(shardAng) * 0.42, shardAng, -Math.cos(shardAng) * 0.42);
    }

    if (i % 3 === 0) {
      const rootMesh = rootTendrilProto.createInstance(`rock-gnarled-root:${i}`);
      const rAng = noise(i + 41) * Math.PI * 2;
      rootMesh.position.set(
        rock.x + Math.cos(rAng) * rock.radius * 0.68,
        baseH + tall * 0.24,
        rock.y + Math.sin(rAng) * rock.radius * 0.68,
      );
      rootMesh.scaling.set(4.8, tall * 0.65, 4.8);
      rootMesh.rotation.set(Math.sin(rAng) * 0.55, rAng, -Math.cos(rAng) * 0.55);
    }
  }

  // Boss Cove Runic Fissure Shards & Flickering Jungle Camp Entrance Torches
  const torchFlames: { mesh: Mesh; baseY: number; phase: number }[] = [];
  const spawnTorchBrazier = (id: string, tx: number, tz: number) => {
    const gh = arenaGroundHeight(tx, tz);
    const post = MeshBuilder.CreateCylinder(`torch-post:${id}`, { height: 15, diameterTop: 3.6, diameterBottom: 5.2, tessellation: 7 }, scene);
    post.position.set(tx, gh + 7.5, tz);
    post.material = material('#38322e');

    const bowl = MeshBuilder.CreateCylinder(`torch-bowl:${id}`, { height: 4.5, diameterTop: 8.5, diameterBottom: 4.2, tessellation: 8 }, scene);
    bowl.position.set(tx, gh + 15.5, tz);
    bowl.material = material('#4f4339');

    const flame = MeshBuilder.CreatePolyhedron(`torch-flame:${id}`, { type: 1, size: 3.6 }, scene);
    flame.position.set(tx, gh + 19.5, tz);
    flame.scaling.set(0.9, 1.45, 0.9);
    flame.material = torchFlameMat;
    torchFlames.push({ mesh: flame, baseY: gh + 19.5, phase: tx * 0.03 + tz * 0.05 });
  };

  for (const ring of CAMP_ROCK_RINGS) {
    const isBoss = ring.stones === 16;
    const isDragon = ring.id === 'dragon_boss';
    const baseH = arenaGroundHeight(ring.x, ring.y);

    if (isBoss) {
      // Sunken Fractured Crystal Shards around the Boss Cove rim (matching Baron Pit in reference image)
      for (let s = 0; s < 8; s++) {
        const ang = ring.entrance + 0.65 + (s * (Math.PI * 2 - 1.3)) / 7;
        const sr = ring.radius - 12;
        const sx = ring.x + Math.cos(ang) * sr;
        const sz = ring.y + Math.sin(ang) * sr;
        const shard = MeshBuilder.CreateCylinder(`boss-cove-shard:${ring.id}:${s}`, { height: 18 + (s % 3) * 5, diameterTop: 1.2, diameterBottom: 7.5, tessellation: 5 }, scene);
        shard.position.set(sx, baseH + 8, sz);
        shard.rotation.z = Math.cos(ang) * 0.38;
        shard.rotation.x = -Math.sin(ang) * 0.38;
        shard.material = isDragon ? flameDireMat : purpleVoidMat;
      }

      // Flanking Fire Torch Braziers at the Boss Cove entrance
      for (const side of [-1, 1]) {
        const entAng = ring.entrance + side * 0.52;
        const tx = ring.x + Math.cos(entAng) * (ring.radius + 6);
        const tz = ring.y + Math.sin(entAng) * (ring.radius + 6);
        spawnTorchBrazier(`${ring.id}:${side}`, tx, tz);
      }
    } else {
      // Place a warm flickering fire torch at one side of each Buff & Major Camp entrance (like Summoner's Rift!)
      const torchAng = ring.entrance + 0.58;
      const tx = ring.x + Math.cos(torchAng) * (ring.radius + 4);
      const tz = ring.y + Math.sin(torchAng) * (ring.radius + 4);
      spawnTorchBrazier(ring.id, tx, tz);
    }
  }

  // Additional River-Entrance & Bush-Corner Fire Torches (matching left side of Summoner's Rift reference image)
  for (const [tIdx, tx, tz] of [
    [0, 1255, 355],
    [1, 1545, 355],
    [2, 1255, 1085],
    [3, 1545, 1085],
  ] as const) {
    spawnTorchBrazier(`river-corner:${tIdx}`, tx, tz);
  }

  // 5. Stylized Evergreen & Woodland Canopy (Perimeter + Lush 4-Quadrant Jungle Forest).
  const crownPine1 = MeshBuilder.CreateCylinder('crown-pine-1', { height: 1, diameterTop: 0.08, diameterBottom: 1, tessellation: 7 }, scene);
  crownPine1.material = material('#1f4d30');
  crownPine1.isVisible = false;

  const crownPine2 = MeshBuilder.CreateCylinder('crown-pine-2', { height: 1, diameterTop: 0.1, diameterBottom: 1, tessellation: 7 }, scene);
  crownPine2.material = material('#2f663e');
  crownPine2.isVisible = false;

  const crownOak = MeshBuilder.CreatePolyhedron('crown-oak-rad', { type: 2, size: 0.58 }, scene);
  crownOak.material = material('#3f783e');
  crownOak.isVisible = false;

  const trunkProto = MeshBuilder.CreateCylinder('trunk-proto', { height: 1, diameterTop: 0.7, diameterBottom: 1.15, tessellation: 6 }, scene);
  trunkProto.material = material('#4a3b2c');
  trunkProto.isVisible = false;

  const shroomProto = MeshBuilder.CreatePolyhedron('forest-shroom-proto', { type: 1, size: 2.8 }, scene);
  shroomProto.material = purpleVoidMat;
  shroomProto.isVisible = false;

  const foliage: (Mesh | InstancedMesh)[] = [];
  const spawnTree = (i: number, x: number, y: number, scaleBoost = 1) => {
    const h = (54 + noise(i + 40) * 28) * scaleBoost;
    const r = (20 + noise(i + 100) * 9) * scaleBoost;
    const base = arenaGroundHeight(x, y);

    const t = trunkProto.createInstance(`trunk:${i}`);
    t.position.set(x, base + h * 0.26, y);
    t.scaling.set(6.0, h * 0.52, 6.0);

    if (i % 3 === 0) {
      const dome = crownOak.createInstance(`oak-main:${i}`);
      dome.position.set(x, base + h * 0.65, y);
      dome.scaling.set(r * 1.15, h * 0.44, r * 1.15);
      dome.rotation.y = i * 0.9;
      foliage.push(dome);
    } else {
      for (let level = 0; level < 3; level++) {
        const proto = level % 2 === 0 ? crownPine1 : crownPine2;
        const c = proto.createInstance(`pine:${i}:${level}`);
        c.position.set(x, base + h * (0.46 + level * 0.21), y);
        const scaleR = r * (1 - level * 0.22);
        c.scaling.set(scaleR, h * 0.5, scaleR);
        c.rotation.y = (i + level) * 1.1;
        foliage.push(c);
      }
    }
  };

  // Perimeter forest wall & outer crags (leaving North & South Boss Coves wide open)
  for (let i = 0; i < 68; i++) {
    const x = -140 + (i * (width + 280)) / 67;
    if (Math.abs(x - width / 2) < 185) continue;
    for (const south of [false, true]) {
      const y = south ? ARENA_HEIGHT + 58 + Math.sin(i * 2.1) * 14 : -58 + Math.sin(i * 1.7) * 14;
      const crag = rockDarkProto.createInstance(`valley-crag:${south}:${i}`);
      const cragR = 24 + (i % 5) * 6;
      const cragH = 38 + (i % 4) * 12;
      crag.position.set(x, cragH * 0.35 - 6, y);
      crag.scaling.set(cragR * 1.25, cragH, cragR);
      crag.rotation.set(0.12, i * 0.9, 0.06);

      spawnTree(1000 + i * 2 + (south ? 1 : 0), x + (i % 2 ? 14 : -14), y + (south ? -16 : 16), 1.05);
    }
  }

  // Outer North/South woodland trees outside the Top & Bottom Lanes
  for (let i = 0; i < 48; i++) {
    const x = 320 + (i * (width - 640)) / 47;
    if (Math.abs(x - width / 2) < 175) continue;
    for (const south of [false, true]) {
      const y = south ? height - 62 - (i % 3) * 22 : 62 + (i % 3) * 22;
      if (Math.abs(y - topLaneY(x)) < LANE_HALF_WIDTH + 34 || Math.abs(y - botLaneY(x)) < LANE_HALF_WIDTH + 34) continue;
      spawnTree(2000 + i * 2 + (south ? 1 : 0), x, y, 0.9);
    }
  }

  // Lush Interior 4-Quadrant Jungle Trees (hugging rock ridges & camp backs while keeping all 12 camp clearings open)
  const interiorTreeSpots: [number, number, number][] = [
    // Center River Island conifer ring (North & South arcs)
    [1330, 625, 0.85], [1370, 608, 0.92], [1430, 608, 0.90], [1470, 625, 0.85],
    [1330, 815, 0.85], [1370, 832, 0.92], [1430, 832, 0.90], [1470, 815, 0.85],
  ];
  for (const mirror of [false, true]) {
    const mx = (x: number) => (mirror ? width - x : x);
    for (const [tx, ty, sc] of [
      // Behind Gromp & Krugs outer rock arcs (X ~ 420..560)
      [425, 395, 0.86], [565, 385, 0.82],
      [425, 1045, 0.86], [565, 1055, 0.82],
      // Behind Blue Buff & Red Buff rock arcs (X ~ 680..800)
      [685, 365, 0.88], [795, 365, 0.85],
      [685, 1075, 0.88], [795, 1075, 0.85],
      // Behind Wolves & Raptors rock arcs (X ~ 995..1120)
      [995, 375, 0.84], [1115, 380, 0.86],
      [995, 1065, 0.84], [1115, 1060, 0.86],
      // Forested central divider ridges between Top & Bottom quadrants (Y = 585..855)
      [515, 645, 0.85], [515, 795, 0.85],
      [685, 585, 0.92], [725, 600, 0.95], [765, 585, 0.88],
      [685, 855, 0.92], [725, 840, 0.95], [765, 855, 0.88],
      [1015, 600, 0.90], [1055, 585, 0.94], [1095, 600, 0.86],
      [1015, 840, 0.90], [1055, 855, 0.94], [1095, 840, 0.86],
      // River bluff trees flanking the river entrances
      [1235, 485, 0.88], [1235, 955, 0.88],
    ] as const) {
      interiorTreeSpots.push([mx(tx), ty, sc]);
    }
  }
  interiorTreeSpots.forEach(([tx, ty, sc], idx) => {
    spawnTree(3000 + idx, tx, ty, sc);
  });

  // Subtle Drifting Woodland & Arcane Spores
  const fireflies: { mesh: InstancedMesh; baseX: number; baseY: number; baseZ: number; phase: number }[] = [];
  for (let i = 0; i < 40; i++) {
    const fx = 440 + noise(i + 300) * (width - 880);
    const fz = 360 + noise(i + 600) * (height - 720);
    const fy = arenaGroundHeight(fx, fz) + 18 + noise(i + 900) * 28;
    const mote = shroomProto.createInstance(`atmosphere-mote:${i}`);
    mote.position.set(fx, fy, fz);
    mote.scaling.setAll(0.45 + (i % 3) * 0.15);
    fireflies.push({ mesh: mote, baseX: fx, baseY: fy, baseZ: fz, phase: i * 0.73 });
  }

  // 6. 3D Layered Stealth Brush (`ARAM_BUSHES`) with Wind Sway & Fade on Entry (Catalogue Item 14).
  const shrubDarkMat = new StandardMaterial('shrub-dark-mat', scene);
  shrubDarkMat.diffuseColor = Color3.FromHexString('#224d2c');
  shrubDarkMat.specularColor = new Color3(0.08, 0.12, 0.08);
  const shrubDarkProto = MeshBuilder.CreateSphere('brush-dark-proto', { diameter: 1, segments: 6 }, scene);
  shrubDarkProto.material = shrubDarkMat;
  shrubDarkProto.isVisible = false;

  const shrubLightMat = new StandardMaterial('shrub-light-mat', scene);
  shrubLightMat.diffuseColor = Color3.FromHexString('#4a803f');
  shrubLightMat.specularColor = new Color3(0.1, 0.14, 0.09);
  const shrubLightProto = MeshBuilder.CreateSphere('brush-light-proto', { diameter: 1, segments: 6 }, scene);
  shrubLightProto.material = shrubLightMat;
  shrubLightProto.isVisible = false;

  const bushClusters: { mesh: InstancedMesh; x: number; y: number; baseH: number; phase: number }[] = [];
  for (const b of ARAM_BUSHES) {
    const gh = arenaGroundHeight(b.x, b.y);
    for (let i = 0; i < 12; i++) {
      const proto = i % 3 === 0 ? shrubLightProto : shrubDarkProto;
      const m = proto.createInstance(`${b.id}:${i}`);
      const bx = b.x + (noise(i + 1) - 0.5) * b.width * 0.86;
      const by = b.y + (noise(i + 90) - 0.5) * b.height * 0.82;
      const sh = 15 + (i % 3) * 4.5;
      m.position.set(bx, gh + sh * 0.45, by);
      m.scaling.set(b.width * 0.25, sh, b.height * 0.46);
      bushClusters.push({ mesh: m, x: b.x, y: b.y, baseH: sh, phase: i * 0.65 + b.x * 0.01 });
    }
  }

  // 7. 3D Natural Sunken Slate Base Sanctum Wells (centered at 260,720 & 2540,720 — flush with forest floor).
  for (const [team, sanctumX] of [
    ['blue', 260],
    ['red', width - 260],
  ] as const) {
    const isBlue = team === 'blue';
    const accent = isBlue ? '#38c9ed' : '#f16b84';
    const glowMat = isBlue ? flameRadMat : flameDireMat;

    const wellBase = MeshBuilder.CreateCylinder(`well-plinth:${team}`, { height: 2.5, diameterTop: 124, diameterBottom: 134, tessellation: 32 }, scene);
    wellBase.position.set(sanctumX, RIDGE_HEIGHT + 0.2, height / 2);
    wellBase.material = material('#454f54');

    const pool = MeshBuilder.CreateCylinder(`well-pool:${team}`, { height: 3, diameter: 108, tessellation: 32 }, scene);
    pool.position.set(sanctumX, RIDGE_HEIGHT + 0.8, height / 2);
    pool.material = glowMat;

    const innerRing = MeshBuilder.CreateTorus(`well-inner-ring:${team}`, { diameter: 96, thickness: 2.2, tessellation: 36 }, scene);
    innerRing.position.set(sanctumX, RIDGE_HEIGHT + 2.6, height / 2);
    innerRing.material = material(accent);
    animatedRings.push({ mesh: innerRing, speed: isBlue ? 0.8 : -0.8, baseY: RIDGE_HEIGHT + 2.6, amp: 0.3 });
  }

  // 8. 3D River Wildlife & Flickering Torch Animation.
  const amberGlowMat = makeGlowMat('amber-glow-mat', '#ffaa22', '#e68a00');
  const frogSkinMat = material('#3d592b');
  const frogBellyMat = material('#c2ab4c');
  const dragonflyBodyMat = makeGlowMat('dragonfly-mat', '#38bdf8', '#0284c7');
  const dragonflyWingMat = new StandardMaterial('dragonfly-wing-mat', scene);
  dragonflyWingMat.diffuseColor = new Color3(0.8, 0.95, 1.0);
  dragonflyWingMat.alpha = 0.55;

  const animatedCritters: { update: (phase: number) => void }[] = [
    {
      update: (phase: number) => {
        for (const tf of torchFlames) {
          const flicker = 1 + Math.sin(phase * 7.5 + tf.phase) * 0.16;
          tf.mesh.scaling.set(0.9 * flicker, 1.45 * flicker, 0.9 * flicker);
          tf.mesh.position.y = tf.baseY + Math.sin(phase * 9 + tf.phase) * 0.6;
        }
      },
    },
  ];

  for (const [frogIdx, frogY, frogSide] of [
    [0, height / 2 - 220, 1],
    [1, height / 2 + 220, -1],
  ] as const) {
    const cx = chasmCenterX(frogY) + frogSide * 48;
    const ch = arenaGroundHeight(cx, frogY);

    const perch = MeshBuilder.CreatePolyhedron(`frog-perch:${frogIdx}`, { type: 1, size: 12 }, scene);
    perch.position.set(cx, ch + 4, frogY);
    perch.scaling.set(1.3, 0.65, 1.2);
    perch.material = material('#556368');

    const frogRoot = new TransformNode(`river-frog:${frogIdx}`, scene);
    frogRoot.position.set(cx, ch + 8, frogY);
    frogRoot.rotation.y = frogSide > 0 ? -Math.PI / 3 : (2 * Math.PI) / 3;

    const frogBody = MeshBuilder.CreateSphere(`frog-body:${frogIdx}`, { diameterX: 11, diameterY: 7, diameterZ: 12, segments: 8 }, scene);
    frogBody.parent = frogRoot;
    frogBody.position.set(0, 3.5, 0);
    frogBody.material = frogSkinMat;

    const frogThroat = MeshBuilder.CreateSphere(`frog-throat:${frogIdx}`, { diameterX: 7, diameterY: 5, diameterZ: 6, segments: 6 }, scene);
    frogThroat.parent = frogRoot;
    frogThroat.position.set(0, 2.5, 4.8);
    frogThroat.material = frogBellyMat;

    for (const eyeSide of [-1, 1]) {
      const eye = MeshBuilder.CreateSphere(`frog-eye:${frogIdx}:${eyeSide}`, { diameter: 2.8, segments: 6 }, scene);
      eye.parent = frogRoot;
      eye.position.set(eyeSide * 3, 6.5, 3.6);
      eye.material = amberGlowMat;
    }

    animatedCritters.push({
      update: (phase: number) => {
        const pulse = 1 + Math.sin(phase * 3.2 + frogIdx) * 0.2;
        frogThroat.scaling.set(pulse, pulse * 1.15, pulse);
      },
    });
  }

  for (let df = 0; df < 2; df++) {
    const dfY = height / 2 - 260 + df * 520;
    const dfX = chasmCenterX(dfY);
    const dfRoot = new TransformNode(`river-dragonfly:${df}`, scene);
    const dfH = arenaGroundHeight(dfX, dfY) + 18;
    dfRoot.position.set(dfX, dfH, dfY);

    const body = MeshBuilder.CreateCylinder(`df-body:${df}`, { height: 9, diameterTop: 1.1, diameterBottom: 0.5, tessellation: 6 }, scene);
    body.parent = dfRoot;
    body.rotation.x = Math.PI / 2;
    body.material = dragonflyBodyMat;

    const wings: Mesh[] = [];
    for (const wSide of [-1, 1]) {
      for (const wTier of [-1.4, 1.4]) {
        const wing = MeshBuilder.CreateBox(`df-wing:${df}:${wSide}:${wTier}`, { width: 7.5, height: 0.2, depth: 2.4 }, scene);
        wing.parent = dfRoot;
        wing.position.set(wSide * 4, 0.7, wTier);
        wing.material = dragonflyWingMat;
        wings.push(wing);
      }
    }

    animatedCritters.push({
      update: (phase: number) => {
        dfRoot.position.x = dfX + Math.sin(phase * 0.8 + df * 1.8) * 14;
        dfRoot.position.z = dfY + Math.cos(phase * 0.6 + df * 2.2) * 16;
        dfRoot.position.y = dfH + Math.sin(phase * 1.4 + df) * 3;
        for (let wi = 0; wi < wings.length; wi++) {
          wings[wi].rotation.z = Math.sin(phase * 28 + wi) * 0.38;
        }
      },
    });
  }

  let animPhase = 0;
  return {
    ground,
    update: (actors: readonly ViewerActor[]) => {
      animPhase += 0.045;
      for (const item of animatedRings) {
        item.mesh.rotation.y += item.speed * 0.025;
        item.mesh.position.y = item.baseY + Math.sin(animPhase + item.speed) * item.amp;
      }
      for (const p of abyssFogPlanes) {
        p.mesh.position.x = width / 2 + Math.sin(animPhase * 0.35 + p.speed) * 6;
        p.mesh.position.y = p.baseOffset + Math.sin(animPhase * 0.5) * 0.8;
      }
      for (const critter of animatedCritters) {
        critter.update(animPhase);
      }
      for (const f of fireflies) {
        f.mesh.position.x = f.baseX + Math.sin(animPhase * 0.8 + f.phase) * 8;
        f.mesh.position.y = f.baseY + Math.cos(animPhase * 1.1 + f.phase) * 4;
        f.mesh.position.z = f.baseZ + Math.sin(animPhase * 0.6 + f.phase * 1.7) * 8;
      }
      for (const mesh of foliage) {
        mesh.isVisible = !actors.some(
          a => a.kind === 'champion' && a.alive && Math.hypot(a.x - mesh.position.x, a.y - mesh.position.z) < 65,
        );
      }
      // Bush grass sway & fade on entry (Catalogue Item 14)
      let anyBushOccupied = false;
      for (const b of bushClusters) {
        const occupied = actors.some(
          a => (a.kind === 'champion' || a.kind === 'ward') && a.alive && Math.hypot(a.x - b.x, a.y - b.y) < 65,
        );
        if (occupied) anyBushOccupied = true;
        b.mesh.scaling.y = occupied ? b.baseH * 0.42 : b.baseH;
        b.mesh.rotation.z = Math.sin(animPhase * 1.6 + b.phase) * (occupied ? 0.14 : 0.05);
      }
      shrubDarkMat.alpha = anyBushOccupied ? 0.52 : 1.0;
      shrubLightMat.alpha = anyBushOccupied ? 0.52 : 1.0;
    },
  };
}


export type BattlefieldActorView = {
  root: TransformNode;
  body: TransformNode;
  height: number;
  animate?: (actor: ViewerActor, second: number, dt: number) => void;
};

export function buildBattlefieldActor(actor: ViewerActor, scene: Scene, material: Material): BattlefieldActorView {
  const root = new TransformNode(`actor:${actor.id}`, scene),
    body = new TransformNode(`body:${actor.id}`, scene);
  body.parent = root;
  const color = actor.team === 'blue' ? '#369bb5' : actor.team === 'red' ? '#b84862' : '#9c8660';
  const glow = actor.team === 'blue' ? '#5fe2ff' : actor.team === 'red' ? '#ff6b84' : '#e0b86b';
  const stone = actor.team === 'red' ? '#544c49' : '#6c7065',
    metal = actor.team === 'red' ? '#9e8878' : '#cfc5a8';
  const box = (name: string, w: number, h: number, d: number, x: number, y: number, z: number, c: string) => {
    const m = MeshBuilder.CreateBox(name, { width: w, height: h, depth: d }, scene);
    m.position.set(x, y, z);
    m.parent = body;
    m.material = material(c);
    return m;
  };
  const cylinder = (name: string, diameter: number, h: number, y: number, c: string, top = diameter, tess = 10) => {
    const m = MeshBuilder.CreateCylinder(name, { height: h, diameterTop: top, diameterBottom: diameter, tessellation: tess }, scene);
    m.position.y = y;
    m.parent = body;
    m.material = material(c);
    return m;
  };
  const orb = (name: string, r: number, x: number, y: number, z: number, c: string) => {
    const m = MeshBuilder.CreatePolyhedron(name, { type: 1, size: r }, scene);
    m.position.set(x, y, z);
    m.parent = body;
    m.material = material(c);
    return m;
  };

  let height = 38;
  let animate: ((actor: ViewerActor, second: number, dt: number) => void) | undefined;

  if (actor.kind === 'structure') {
    const isNexus = actor.subtype === 'nexus' || actor.id.includes('nexus');
    const isBarracks = actor.subtype === 'barracks' || actor.id.includes('barracks');
    const isOuterTower = actor.subtype === 'outer_tower' || actor.id.includes('_t1');
    const isInnerTower = actor.subtype === 'inner_tower' || actor.id.includes('_t2');

    if (isNexus) {
      height = 106;
      const isBlue = actor.team === 'blue';
      cylinder('dais-base', 82, 10, 5, isBlue ? metal : stone, 74, 16);
      cylinder('dais-top', 64, 8, 14, isBlue ? metal : stone, 56, 16);
      const halo = MeshBuilder.CreateTorus('nexus-halo', { diameter: 62, thickness: 3.2, tessellation: 32 }, scene);
      halo.parent = body;
      halo.position.y = 78;
      halo.rotation.x = isBlue ? 0.28 : -0.28;
      halo.material = material(glow);
      const core = orb('nexus-crystal-core', 26, 0, 84, 0, glow);

      const pylonShards: import('@babylonjs/core').Mesh[] = [];
      for (const [ox, oz] of [
        [-28, -28],
        [28, -28],
        [-28, 28],
        [28, 28],
      ] as const) {
        const pylon = box('nexus-pylon', 10, 56, 10, ox, 34, oz, stone);
        pylon.rotation.z = ox > 0 ? 0.14 : -0.14;
        pylonShards.push(orb('pylon-shard', 6, ox * 1.1, 68, oz * 1.1, glow));
      }

      animate = (a, sec, dt) => {
        if (!a.alive) {
          body.scaling.y = 0.12;
          body.position.y = -2;
          return;
        }
        // Nexus Crystal Health Pulse (Catalogue Item 48): faster pulse & scale throb as HP drops
        const hpRatio = Math.max(0.05, Math.min(1, a.hp / Math.max(1, a.maxHp)));
        const urgency = 1 - hpRatio;
        const pulseRate = 2.4 + urgency * 7.2;
        const pulseScale = 1 + Math.sin(sec * pulseRate) * (0.05 + urgency * 0.15);
        halo.rotation.y += dt * (1.2 + urgency * 2.4);
        halo.scaling.setAll(1 + Math.sin(sec * pulseRate * 0.8) * (0.03 + urgency * 0.08));
        core.position.y = 84 + Math.sin(sec * pulseRate) * (4 + urgency * 3);
        core.rotation.y += dt * (1.5 + urgency * 2.5);
        core.scaling.setAll(pulseScale);
        pylonShards.forEach((p, idx) => {
          p.position.y = 68 + Math.sin(sec * (3.5 + urgency * 4) + idx * 1.4) * (2.5 + urgency * 2);
        });
      };
    } else if (isBarracks) {
      height = 58;
      const isRanged = actor.id.includes('ranged');
      const isSiege = actor.id.includes('siege') || actor.id.includes('cannon');

      if (isRanged) {
        // Hexagonal Arcane Wizard Spire
        cylinder('wizard-base', 42, 14, 7, stone, 36, 6);
        cylinder('wizard-hall', 34, 32, 23, color, 28, 6);
        const cone = MeshBuilder.CreateCylinder('wizard-cone', { height: 26, diameterTop: 2, diameterBottom: 36, tessellation: 6 }, scene);
        cone.parent = body;
        cone.position.y = 52;
        cone.material = material(metal);
        const condenser = orb('condenser-gem', 7, 0, 68, 0, glow);
        const orbitShards: import('@babylonjs/core').Mesh[] = [];
        for (const side of [-1, 1]) {
          orbitShards.push(orb('orbit-shard', 3.5, side * 18, 52, 0, glow));
        }
        animate = (a, sec) => {
          if (!a.alive) { body.scaling.y = 0.15; return; }
          condenser.position.y = 68 + Math.sin(sec * 3.2) * 2;
          orbitShards.forEach((s, idx) => {
            const angle = sec * 2.8 + idx * Math.PI;
            s.position.x = Math.cos(angle) * 18;
            s.position.z = Math.sin(angle) * 18;
          });
        };
      } else if (isSiege) {
        // Steampunk Siege Foundry Depot
        cylinder('foundry-base', 46, 14, 7, stone, 42, 12);
        box('foundry-hall', 40, 24, 38, 0, 19, 0, color);
        box('foundry-rim', 44, 5, 42, 0, 31, 0, metal);
        const dome = MeshBuilder.CreateSphere('foundry-dome', { diameterX: 38, diameterY: 18, diameterZ: 38, segments: 8 }, scene);
        dome.parent = body;
        dome.position.y = 38;
        dome.material = material(metal);
        const vents: import('@babylonjs/core').Mesh[] = [];
        for (const cx of [-12, 12]) {
          cylinder(`chimney:${cx}`, 6, 18, 48, stone, 5);
          vents.push(orb(`smoke-vent:${cx}`, 4, cx, 58, 0, glow));
        }
        animate = (a, sec) => {
          if (!a.alive) { body.scaling.y = 0.15; return; }
          vents.forEach((v, idx) => {
            v.scaling.setAll(1 + Math.sin(sec * 4 + idx * 2) * 0.22);
          });
        };
      } else {
        // Vanguard Melee Gatehouse
        box('barracks-hall', 46, 28, 42, 0, 14, 0, color);
        box('barracks-trim', 50, 5, 46, 0, 28, 0, metal);
        const roof = MeshBuilder.CreateCylinder('roof', { height: 20, diameter: 62, tessellation: 4, diameterTop: 4 }, scene);
        roof.parent = body;
        roof.position.y = 38;
        roof.rotation.y = Math.PI / 4;
        roof.material = material(metal);
        const banners: import('@babylonjs/core').Mesh[] = [];
        for (const side of [-1, 1]) {
          box('gate-pillar', 9, 32, 9, side * 18, 16, 20, stone);
          orb('gate-gem', 4.5, side * 18, 34, 20, glow);
          banners.push(box('faction-banner', 4, 18, 1, side * 12, 18, 22, color));
        }
        animate = (a, sec) => {
          if (!a.alive) { body.scaling.y = 0.15; return; }
          banners.forEach(b => {
            b.rotation.y = Math.sin(sec * 3.5) * 0.22;
          });
        };
      }
    } else if (isOuterTower) {
      // Outer Bastion Turret
      height = 92;
      cylinder('outer-foundation', 56, 12, 6, stone, 48, 8);
      cylinder('outer-shaft', 42, 46, 35, color, 34, 8);
      box('outer-battlement', 46, 8, 46, 0, 62, 0, metal);
      for (const [bx, bz] of [
        [-22, 0],
        [22, 0],
        [0, -22],
        [0, 22],
      ] as const) {
        box('outer-buttress', bx !== 0 ? 10 : 12, 54, bz !== 0 ? 10 : 12, bx, 32, bz, stone);
      }
      const outerCrystal = orb('outer-crystal', 16, 0, 78, 0, glow);
      const orbitGems: import('@babylonjs/core').Mesh[] = [];
      for (const [ox, oz] of [
        [-16, -16],
        [16, -16],
        [-16, 16],
        [16, 16],
      ] as const) {
        orbitGems.push(orb('outer-orbit-gem', 4, ox * 0.9, 78, oz * 0.9, glow));
      }
      animate = (a, sec, dt) => {
        if (!a.alive) {
          body.scaling.y = 0.12;
          body.position.y = -2;
          return;
        }
        outerCrystal.position.y = 78 + Math.sin(sec * 3) * 3;
        outerCrystal.rotation.y += dt * 1.8;
        orbitGems.forEach((gem, idx) => {
          const ang = sec * 2.2 + idx * (Math.PI / 2);
          gem.position.x = Math.cos(ang) * 16;
          gem.position.z = Math.sin(ang) * 16;
          gem.position.y = 78 + Math.sin(sec * 4 + idx) * 2;
        });
      };
    } else if (isInnerTower) {
      // Inner Rampart Fortress Turret
      height = 96;
      box('inner-foundation', 56, 14, 56, 0, 7, 0, stone);
      cylinder('inner-core', 44, 48, 38, stone, 36, 10);
      box('inner-battlement', 48, 9, 48, 0, 66, 0, metal);
      for (const side of [-1, 1]) {
        box(`shield-x:${side}`, 5, 26, 22, side * 22, 42, 0, color);
        box(`shield-z:${side}`, 22, 26, 5, 0, 42, side * 22, color);
      }
      const ring1 = MeshBuilder.CreateTorus('inner-ring-1', { diameter: 44, thickness: 2.2, tessellation: 24 }, scene);
      ring1.parent = body;
      ring1.position.y = 72;
      ring1.material = material(metal);
      const innerCrystal = orb('inner-crystal', 15, 0, 82, 0, glow);
      animate = (a, sec, dt) => {
        if (!a.alive) {
          body.scaling.y = 0.12;
          body.position.y = -2;
          return;
        }
        ring1.rotation.y += dt * 1.5;
        ring1.rotation.x = Math.sin(sec * 2) * 0.15;
        innerCrystal.position.y = 82 + Math.sin(sec * 3.2) * 3;
      };
    } else {
      // Nexus Guardian Spire Turret (nexus_tower)
      height = 102;
      cylinder('nexus-tower-base', 48, 14, 7, stone, 38, 12);
      cylinder('nexus-tower-spire', 34, 62, 45, metal, 22, 10);
      const ring = MeshBuilder.CreateTorus('nexus-tower-ring', { diameter: 46, thickness: 2.8, tessellation: 28 }, scene);
      ring.parent = body;
      ring.position.y = 74;
      ring.material = material(metal);
      const spireCrystal = orb('nexus-tower-crystal', 14, 0, 86, 0, glow);
      for (const [bx, bz] of [
        [-18, 0],
        [18, 0],
        [0, -18],
        [0, 18],
      ] as const) {
        box('spire-buttress', 8, 48, 8, bx, 30, bz, stone);
      }
      animate = (a, sec, dt) => {
        if (!a.alive) {
          body.scaling.y = 0.12;
          body.position.y = -2;
          return;
        }
        ring.rotation.y += dt * 1.8;
        ring.rotation.z = Math.sin(sec * 2.5) * 0.2;
        spireCrystal.position.y = 86 + Math.sin(sec * 3.5) * 3.5;
      };
    }
  } else if (actor.kind === 'minion') {
    const isCannon = actor.subtype === 'cannon' || actor.subtype === 'siege';
    const isSuper = actor.subtype === 'super' || actor.id.includes('super');
    const isCaster = actor.subtype === 'caster';

    if (isSuper) {
      height = 48;
      box('super-torso', 24, 22, 18, 0, 22, 0, stone);
      orb('super-head', 7, 0, 36, 4, metal);
      orb('super-shoulder-l', 11, -16, 28, 0, stone);
      orb('super-shoulder-r', 11, 16, 28, 0, stone);
      const armL = box('super-arm-l', 9, 16, 9, -16, 14, 5, metal);
      const armR = box('super-arm-r', 9, 16, 9, 16, 14, 5, metal);
      const superCore = orb('super-core', 7, 0, 24, 8, glow);
      const legs: import('@babylonjs/core').Mesh[] = [];
      for (const side of [-1, 1]) {
        legs.push(box('super-leg', 8, 14, 8, side * 7, 7, 0, stone));
      }
      animate = (a, sec) => {
        if (!a.alive) { body.scaling.y = 0.2; return; }
        const isAttacking = (a.motion?.attackTimer ?? 0) > 0;
        if (isAttacking) {
          const slam = Math.sin((a.motion?.attackTimer ?? 0) * Math.PI * 4);
          armL.rotation.x = -1.2 * slam;
          armR.rotation.x = -1.2 * slam;
        } else {
          legs[0].rotation.x = Math.sin(sec * 7) * 0.5;
          legs[1].rotation.x = -Math.sin(sec * 7) * 0.5;
          armL.rotation.x = -Math.sin(sec * 7) * 0.4;
          armR.rotation.x = Math.sin(sec * 7) * 0.4;
        }
        superCore.scaling.setAll(1 + Math.sin(sec * 5) * 0.15);
      };
    } else if (isCannon) {
      height = 32;
      box('cart', 24, 13, 30, 0, 10, 0, color);
      box('armor-front', 26, 11, 4, 0, 12, 14, metal);
      const wheels: import('@babylonjs/core').Mesh[] = [];
      for (const sx of [-13, 13]) {
        for (const sz of [-10, 10]) {
          wheels.push(orb('wheel', 6, sx, 6.5, sz, stone));
        }
      }
      const barrel = cylinder('cannon-barrel', 8, 28, 21, metal, 6.5);
      animate = (a, _sec, dt) => {
        if (!a.alive) { body.scaling.y = 0.2; return; }
        wheels.forEach(w => { w.rotation.x += dt * 9; });
        const recoil = Math.max(0, Math.sin((a.motion?.attackTimer ?? 0) * Math.PI * 4)) * 6;
        barrel.position.z = 21 - recoil;
      };
    } else if (isCaster) {
      height = 27;
      cylinder('caster-robe', 13, 18, 10, color, 8);
      orb('caster-hood', 6.5, 0, 22, 0, color);
      orb('caster-eyes', 2.8, 0, 22, 4.5, glow);
      const staff = cylinder('caster-staff', 2, 26, 16, stone, 2);
      const staffGem = orb('caster-staff-gem', 4, 8, 30, 2, glow);
      animate = (a, sec) => {
        if (!a.alive) { body.scaling.y = 0.2; return; }
        body.position.y = Math.sin(sec * 4.5) * 2;
        const isAttacking = (a.motion?.attackTimer ?? 0) > 0;
        if (isAttacking) {
          staff.rotation.x = -0.65;
          staffGem.scaling.setAll(1.4);
        } else {
          staff.rotation.x = Math.sin(sec * 2.5) * 0.12;
          staffGem.scaling.setAll(1);
        }
      };
    } else {
      // Vanguard Melee Minion
      height = 26;
      cylinder('tabard', 14, 15, 10, color, 10);
      box('pauldrons', 18, 5, 10, 0, 17, 0, metal);
      orb('helmet', 6.6, 0, 23, 0, metal);
      const weapon = box('weapon', 2.4, 18, 2.4, 9, 16, 2, metal);
      const shield = box('shield', 5, 15, 11, -8, 13, 1, color);
      const legs: import('@babylonjs/core').Mesh[] = [];
      for (const side of [-1, 1]) {
        legs.push(box('leg', 4.5, 9, 4.5, side * 4.2, 4.5, 0, stone));
      }
      animate = (a, sec) => {
        if (!a.alive) { body.scaling.y = 0.2; return; }
        const isAttacking = (a.motion?.attackTimer ?? 0) > 0;
        if (isAttacking) {
          const slash = Math.sin((a.motion?.attackTimer ?? 0) * Math.PI * 4);
          weapon.rotation.x = -slash * 0.9;
          shield.position.z = 1 + slash * 3;
        } else {
          legs[0].rotation.x = Math.sin(sec * 12) * 0.55;
          legs[1].rotation.x = -Math.sin(sec * 12) * 0.55;
          body.position.y = Math.abs(Math.sin(sec * 12)) * 1.2;
          weapon.rotation.x = 0;
        }
      };
    }
  } else if (actor.kind === 'champion') {
    height = 60;
    cylinder('fallback-torso', 19, 30, 30, color, 15);
    orb('fallback-head', 9, 0, 53, 0, metal);
    const fallbackLegs: import('@babylonjs/core').Mesh[] = [];
    for (const side of [-1, 1]) {
      fallbackLegs.push(box('fallback-leg', 7, 22, 7, side * 5, 11, 0, stone));
    }

    // Recall Charge Circle & Rising Trail (Catalogue Item 63) attached to root so it works with GLB models too
    const recallRing = MeshBuilder.CreateTorus(`recall-ring:${actor.id}`, { diameter: 44, thickness: 2.2, tessellation: 32 }, scene);
    recallRing.parent = root;
    recallRing.position.y = 2.2;
    recallRing.material = material('#45bfd5');
    recallRing.isVisible = false;

    const recallMotes: import('@babylonjs/core').Mesh[] = [];
    for (let rm = 0; rm < 3; rm++) {
      const mote = MeshBuilder.CreatePolyhedron(`recall-mote:${actor.id}:${rm}`, { type: 1, size: 3.2 }, scene);
      mote.parent = root;
      mote.material = material('#5fe2ff');
      mote.isVisible = false;
      recallMotes.push(mote);
    }

    animate = (a, sec, dt) => {
      const isRecalling = Boolean(a.alive && a.recalling);
      recallRing.isVisible = isRecalling;
      if (isRecalling) {
        recallRing.rotation.y += dt * 3.2;
        const pulse = 0.85 + Math.sin(sec * 6) * 0.15;
        recallRing.scaling.set(pulse, 1, pulse);
      }
      for (let rm = 0; rm < recallMotes.length; rm++) {
        const mote = recallMotes[rm];
        mote.isVisible = isRecalling;
        if (isRecalling) {
          const cycle = (sec * 1.6 + rm * 0.33) % 1;
          const ang = sec * 4.5 + (rm * Math.PI * 2) / 3;
          mote.position.set(Math.cos(ang) * 18 * (1 - cycle * 0.35), 4 + cycle * 56, Math.sin(ang) * 18 * (1 - cycle * 0.35));
          mote.scaling.setAll(1 - cycle * 0.5);
        }
      }

      if (!body.isEnabled()) return;
      if (!a.alive) {
        body.rotation.z = Math.PI / 2;
        return;
      }
      body.rotation.z = 0;
      if (a.motion?.state === 'walk') {
        fallbackLegs[0].rotation.x = Math.sin(sec * 10) * 0.55;
        fallbackLegs[1].rotation.x = -Math.sin(sec * 10) * 0.55;
      } else {
        fallbackLegs[0].rotation.x = 0;
        fallbackLegs[1].rotation.x = 0;
      }
    };
  } else if (actor.kind === 'ward') {
    const wardKind = actor.subtype ?? 'stealth';
    if (wardKind === 'control') {
      height = 30;
      cylinder('ward-base', 12, 6, 3, stone, 8);
      cylinder('ward-obelisk', 7.5, 19, 13, '#9f1239', 4.5);
      const radarRing = MeshBuilder.CreateTorus(`ward-radar:${actor.id}`, { diameter: 18, thickness: 1.6, tessellation: 24 }, scene);
      radarRing.parent = body;
      radarRing.position.y = 18;
      radarRing.material = material('#f43f5e');
      const eye = orb('eye', 6.2, 0, 27, 0, '#fb7185');
      animate = (a, sec, dt) => {
        if (!a.alive) { body.scaling.y = 0.2; return; }
        radarRing.rotation.y += dt * 2.8;
        eye.scaling.setAll(1 + Math.sin(sec * 5) * 0.18);
      };
    } else if (wardKind === 'farsight') {
      height = 28;
      cylinder('ward-base', 9, 4, 2, stone, 6);
      const crystal = orb('farsight-orb', 6.8, 0, 22, 0, '#22d3ee');
      const halo = MeshBuilder.CreateTorus(`ward-halo:${actor.id}`, { diameter: 16, thickness: 1.2, tessellation: 24 }, scene);
      halo.parent = body;
      halo.position.y = 22;
      halo.material = material('#67e8f9');
      animate = (a, sec, dt) => {
        if (!a.alive) { body.scaling.y = 0.2; return; }
        crystal.position.y = 22 + Math.sin(sec * 3.8) * 2.5;
        halo.rotation.x = Math.sin(sec * 2.4) * 0.45;
        halo.rotation.y += dt * 3.2;
      };
    } else {
      height = 26;
      cylinder('ward-base', 10, 6, 3, stone, 7);
      cylinder('ward-stalk', 6, 16, 12, metal, 4);
      const eye = orb('eye', 5.5, 0, 24, 0, '#4ade80');
      animate = (a, sec) => {
        if (!a.alive) { body.scaling.y = 0.2; return; }
        eye.scaling.setAll(1 + Math.sin(sec * 4) * 0.15);
      };
    }
  } else if (actor.kind === 'feature') {
    // Interactive battlefield props (River Scuttler, Speed Shrine, Jungle Plants, Hexgates, Supply Drop).
    const teamGlow = actor.team === 'blue' ? '#5fe2ff' : actor.team === 'red' ? '#ff6b84' : '#e0b86b';
    const dormant = (a: ViewerActor) => a.hp <= 0 || a.motion?.state === 'dormant';
    const kind = actor.subtype ?? '';
    if (kind === 'scuttler') {
      height = 20;
      const shell = MeshBuilder.CreateSphere('scuttler-shell', { diameter: 22, segments: 8 }, scene);
      shell.parent = body; shell.position.y = 9; shell.scaling.set(1.25, 0.62, 1); shell.material = material('#2f9e8f');
      orb('scuttler-core', 5, 0, 13, 0, '#8be9d4');
      const legs: import('@babylonjs/core').Mesh[] = [];
      for (const side of [-1, 1]) {
        for (const off of [-7, 0, 7]) {
          const leg = box('scuttler-leg', 11, 1.8, 1.8, side * 14, 4, off, '#1f6f66');
          leg.rotation.z = side * 0.45;
          legs.push(leg);
        }
        box('scuttler-claw', 5, 4, 7, side * 12, 8, 15, '#d9f99d');
      }
      animate = (a, sec) => {
        const base = legs.length;
        for (let i = 0; i < base; i++) legs[i].rotation.y = Math.sin(sec * 7 + i * 1.7) * 0.28;
        body.position.y = Math.abs(Math.sin(sec * 3.2 + a.x * 0.01)) * 1.4;
      };
    } else if (kind === 'speed_shrine') {
      height = 40;
      cylinder('shrine-dais', 40, 3, 1.5, stone, 36, 24);
      const ring = MeshBuilder.CreateTorus(`shrine-ring:${actor.id}`, { diameter: 104, thickness: 2.2, tessellation: 48 }, scene);
      ring.parent = body; ring.position.y = 1.6; ring.material = material(teamGlow);
      const crystal = orb('shrine-crystal', 9, 0, 20, 0, teamGlow);
      cylinder('shrine-pylon', 10, 14, 8, metal, 5, 8);
      animate = (a, sec) => {
        const life = Math.max(0.05, a.progress ?? 1);
        const s = 0.45 + 0.55 * life;
        ring.scaling.set(s, 1, s);
        ring.scaling.y = 1 + Math.sin(sec * 4) * 0.3;
        crystal.rotation.y = sec * 1.8;
        crystal.position.y = 20 + Math.sin(sec * 2.6) * 2.4;
      };
    } else if (kind === 'blast_cone') {
      height = 28;
      cylinder('cone-base', 20, 4, 2, stone, 16, 8);
      const pod = cylinder('cone-pod', 15, 20, 14, '#b91c1c', 3, 7);
      const spikes: import('@babylonjs/core').Mesh[] = [];
      for (let i = 0; i < 6; i++) {
        const ang = (i / 6) * Math.PI * 2;
        const spike = box('cone-spike', 2, 8, 2, Math.cos(ang) * 7, 12, Math.sin(ang) * 7, '#ef4444');
        spike.rotation.set(Math.sin(ang) * 0.6, 0, -Math.cos(ang) * 0.6);
        spikes.push(spike);
      }
      const core = orb('cone-core', 3.4, 0, 26, 0, '#fb923c');
      animate = (a, sec) => {
        body.scaling.y = dormant(a) ? 0.3 : 1;
        core.scaling.setAll(dormant(a) ? 0.01 : 1 + Math.sin(sec * 5) * 0.2);
        pod.rotation.y = Math.sin(sec * 0.8) * 0.06;
        spikes.forEach(s => (s.isVisible = !dormant(a)));
      };
    } else if (kind === 'scryer_bloom') {
      height = 30;
      cylinder('bloom-stem', 3, 18, 9, '#166534', 2.4, 6);
      const petals = new TransformNode('bloom-petals', scene);
      petals.parent = body; petals.position.y = 20;
      for (let i = 0; i < 6; i++) {
        const ang = (i / 6) * Math.PI * 2;
        const petal = MeshBuilder.CreateBox('bloom-petal', { width: 4, height: 0.8, depth: 12 }, scene);
        petal.parent = petals; petal.material = material('#38bdf8');
        petal.position.set(Math.cos(ang) * 6, 0, Math.sin(ang) * 6);
        petal.rotation.y = -ang; petal.rotation.z = 0.0; petal.rotation.x = 0.35;
      }
      const eye = orb('bloom-eye', 3.8, 0, 22, 0, '#e0f2fe');
      animate = (a, sec) => {
        const asleep = dormant(a);
        petals.rotation.y = sec * (asleep ? 0.1 : 0.9);
        petals.scaling.setAll(asleep ? 0.45 : 1);
        eye.scaling.setAll(asleep ? 0.3 : 1 + Math.sin(sec * 3.1) * 0.12);
      };
    } else if (kind === 'honeyfruit') {
      height = 24;
      cylinder('fruit-stem', 3.4, 12, 6, '#14532d', 2, 6);
      const bulbs: import('@babylonjs/core').Mesh[] = [];
      for (let i = 0; i < 5; i++) {
        const ang = (i / 5) * Math.PI * 2;
        bulbs.push(orb('fruit-bulb', 4.4, Math.cos(ang) * 5.2, 15 + (i % 2) * 2.6, Math.sin(ang) * 5.2, '#22c55e'));
      }
      const honey = orb('fruit-honey', 3.6, 0, 18, 0, '#fbbf24');
      animate = (a, sec) => {
        const asleep = dormant(a);
        bulbs.forEach((b, i) => b.scaling.setAll(asleep ? 0.35 : 1 + Math.sin(sec * 2 + i) * 0.08));
        honey.scaling.setAll(asleep ? 0.01 : 1 + Math.sin(sec * 3) * 0.15);
      };
    } else if (kind === 'hexgate') {
      height = 46;
      cylinder('gate-base', 30, 4, 2, stone, 26, 6);
      const outer = MeshBuilder.CreateTorus(`gate-outer:${actor.id}`, { diameter: 34, thickness: 3, tessellation: 6 }, scene);
      outer.parent = body; outer.position.y = 24; outer.rotation.x = Math.PI / 2; outer.material = material(teamGlow);
      const inner = MeshBuilder.CreateTorus(`gate-inner:${actor.id}`, { diameter: 22, thickness: 1.8, tessellation: 6 }, scene);
      inner.parent = body; inner.position.y = 24; inner.rotation.x = Math.PI / 2; inner.material = material(teamGlow);
      const spark = orb('gate-spark', 3.6, 0, 24, 0, '#ffffff');
      animate = (_a, sec) => {
        outer.rotation.z = sec * 0.9;
        inner.rotation.z = -sec * 1.6;
        spark.scaling.setAll(1 + Math.sin(sec * 6) * 0.3);
      };
    } else if (kind === 'supply_drop') {
      height = 62;
      cylinder('drop-pad', 58, 3, 1.5, stone, 54, 8);
      const ring = MeshBuilder.CreateTorus(`drop-ring:${actor.id}`, { diameter: 70, thickness: 2.6, tessellation: 40 }, scene);
      ring.parent = body; ring.position.y = 2; ring.material = material('#e0b86b');
      const capture = MeshBuilder.CreateTorus(`drop-capture:${actor.id}`, { diameter: 54, thickness: 3.2, tessellation: 40 }, scene);
      capture.parent = body; capture.position.y = 3; capture.material = material(teamGlow);
      const crystal = MeshBuilder.CreatePolyhedron('drop-crystal', { type: 1, size: 15 }, scene);
      crystal.parent = body; crystal.scaling.y = 1.7; crystal.material = material('#e0b86b');
      animate = (a, sec) => {
        crystal.position.y = 34 + Math.sin(sec * 2.2) * 3.5;
        crystal.rotation.y = sec * 1.4;
        const p = Math.max(0.02, Math.min(1, a.progress ?? 0));
        capture.scaling.set(p, 1, p);
        capture.isVisible = (a.progress ?? 0) > 0.01;
        ring.rotation.y = -sec * 0.7;
      };
    }
  } else {
    // Neutral Camps & Bosses
    const dragon = actor.id.includes('dragon'),
      golem = actor.id.includes('golem') || actor.id.includes('behemoth');
    height = dragon ? 72 : golem ? 58 : 39;
    orb('creature-body', height * 0.4, 0, height * 0.46, 0, color);
    const head = orb('head', height * 0.24, 0, height * 0.82, 13, metal);

    if (dragon) {
      const wings: import('@babylonjs/core').Mesh[] = [];
      for (const side of [-1, 1]) {
        box('leg', height * 0.18, height * 0.4, height * 0.18, side * height * 0.25, height * 0.2, 0, stone);
        const wing = box('wing', 62, 3.5, 32, side * 38, 44, -2, color);
        wing.rotation.z = side * 0.38;
        box('horn', 3, 12, 3, side * 6, height * 0.96, 10, metal);
        wings.push(wing);
      }
      const tail = box('tail', 7, 7, 36, 0, 22, -26, stone);
      animate = (a, sec) => {
        if (!a.alive) {
          body.position.y = -height * 0.32;
          wings[0].rotation.z = 0.1;
          wings[1].rotation.z = -0.1;
          return;
        }
        const flapRate = a.motion?.state === 'walk' ? 10.5 : 7.5;
        wings[0].rotation.z = 0.38 + Math.sin(sec * flapRate) * 0.45;
        wings[1].rotation.z = -0.38 - Math.sin(sec * flapRate) * 0.45;
        wings[0].rotation.x = Math.cos(sec * flapRate) * 0.15;
        wings[1].rotation.x = Math.cos(sec * flapRate) * 0.15;
        tail.rotation.y = Math.sin(sec * 4.2) * 0.38;
        const isAttacking = (a.motion?.attackTimer ?? 0) > 0;
        if (isAttacking) {
          head.position.z = 13 + Math.sin((a.motion?.attackTimer ?? 0) * Math.PI * 4) * 8;
          head.position.y = height * 0.82 - 4;
        } else {
          head.position.z = 13;
          head.position.y = height * 0.82 + Math.sin(sec * 3.5) * 2.8;
        }
      };
    } else if (golem) {
      const fists: import('@babylonjs/core').Mesh[] = [];
      const golemLegs: import('@babylonjs/core').Mesh[] = [];
      for (const side of [-1, 1]) {
        orb('pauldron', height * 0.22, side * height * 0.34, height * 0.64, 2, stone);
        fists.push(box('fist', height * 0.18, height * 0.32, height * 0.18, side * height * 0.38, height * 0.32, 8, stone));
        golemLegs.push(box('leg', height * 0.18, height * 0.4, height * 0.18, side * height * 0.25, height * 0.2, 0, stone));
      }
      const golemCore = orb('golem-core', height * 0.15, 0, height * 0.52, 10, glow);
      animate = (a, sec) => {
        if (!a.alive) {
          body.scaling.y = 0.2;
          body.position.y = -4;
          return;
        }
        golemCore.scaling.setAll(1 + Math.sin(sec * 3.2) * 0.18);
        head.position.y = height * 0.82 + Math.sin(sec * 2.8) * 1.8;
        const isAttacking = (a.motion?.attackTimer ?? 0) > 0;
        if (isAttacking) {
          const slam = Math.sin((a.motion?.attackTimer ?? 0) * Math.PI * 4);
          fists[0].rotation.x = -1.3 * slam;
          fists[1].rotation.x = -1.3 * slam;
        } else if (a.motion?.state === 'walk') {
          golemLegs[0].rotation.x = Math.sin(sec * 5.5) * 0.45;
          golemLegs[1].rotation.x = -Math.sin(sec * 5.5) * 0.45;
          fists[0].rotation.x = -Math.sin(sec * 5.5) * 0.4;
          fists[1].rotation.x = Math.sin(sec * 5.5) * 0.4;
        } else {
          golemLegs[0].rotation.x = 0;
          golemLegs[1].rotation.x = 0;
          fists[0].rotation.x = 0;
          fists[1].rotation.x = 0;
        }
      };
    } else {
      // Normal Jungle Camp Creeps
      const creepLegs: import('@babylonjs/core').Mesh[] = [];
      for (const side of [-1, 1]) {
        creepLegs.push(box('leg', height * 0.18, height * 0.4, height * 0.18, side * height * 0.25, height * 0.2, 0, stone));
      }
      animate = (a, sec) => {
        if (!a.alive) { body.scaling.y = 0.2; return; }
        head.position.y = height * 0.82 + Math.sin(sec * 3) * 1.5;
        if (a.motion?.state === 'walk') {
          creepLegs[0].rotation.x = Math.sin(sec * 8) * 0.45;
          creepLegs[1].rotation.x = -Math.sin(sec * 8) * 0.45;
        } else {
          creepLegs[0].rotation.x = 0;
          creepLegs[1].rotation.x = 0;
        }
      };
    }
  }

  const shadow = MeshBuilder.CreateDisc(
    `contact:${actor.id}`,
    { radius: actor.kind === 'structure' ? 32 : actor.kind === 'champion' ? 18 : 11, tessellation: 24 },
    scene,
  );
  shadow.rotation.x = Math.PI / 2;
  shadow.position.y = 0.2;
  shadow.parent = root;
  shadow.material = material('#1a2921');

  if (actor.kind === 'champion') {
    const ring = MeshBuilder.CreateTorus(`team:${actor.id}`, { diameter: 34, thickness: 1.4, tessellation: 32 }, scene);
    ring.parent = root;
    ring.position.y = 1.5;
    ring.material = material(color);
  }

  return { root, body, height, animate };
}
