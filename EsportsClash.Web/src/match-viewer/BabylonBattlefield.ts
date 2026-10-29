import { MeshBuilder, TransformNode, DynamicTexture, StandardMaterial, Color3, VertexBuffer, VertexData, type Scene, type Mesh, type InstancedMesh } from '@babylonjs/core';
import { arenaGroundHeight, RIDGE_HEIGHT, RIDGE_RAMPS, chasmCenterX } from '../arenaElevation';
import { drawNaturalArena, stoneLaneEdges, LANDSCAPE } from '../arenaLandform';
import { ROCK_TERRAIN, ARAM_BUSHES, CAMP_ROCK_RINGS } from '../arenaRules';
import { arenaCampArt } from '../arenaArtDirection';
import type { ViewerActor } from './MatchViewer';
import { paintProceduralArena } from './PaintedArenaProcedural';
import { ARENA_HEIGHT, LANE_SLOPE } from '../arenaLayout';

type Material = (color: string) => StandardMaterial;
const noise = (n: number) => {
  const v = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return v - Math.floor(v);
};

/** All scenery follows the existing terrain facts; it never adds colliders. */
export function buildBabylonBattlefield(scene: Scene, width: number, height: number, material: Material) {
  // 3D atmospheric canyon backdrop surrounding the arena
  const valleyMat = new StandardMaterial('decorative-valley-mat', scene);
  valleyMat.diffuseColor = new Color3(0.08, 0.12, 0.10);
  valleyMat.specularColor = Color3.Black();
  valleyMat.emissiveColor = new Color3(0.04, 0.06, 0.05);
  const backdrop = MeshBuilder.CreateGround('decorative-valley', { width: width + 2400, height: height + 2800 }, scene);
  backdrop.position.set(width / 2, -45, height / 2);
  backdrop.material = valleyMat;
  backdrop.isPickable = false;

  // 1. High-resolution 3D sculpted terrain mesh with true normal lighting.
  const ground = MeshBuilder.CreateGround('arena', { width, height, subdivisions: 200, updatable: true }, scene);
  ground.position.set(width / 2, 0, height / 2);
  const p = ground.getVerticesData(VertexBuffer.PositionKind)!,
    indices = ground.getIndices()!;
  for (let i = 0; i < p.length; i += 3) {
    const wx = p[i] + width / 2,
      wz = p[i + 2] + height / 2;
    const micro = (noise(wx * 0.07 + wz * 0.11) - 0.5) * 1.5;
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
  paving.specularColor = new Color3(0.15, 0.15, 0.12);
  paving.specularPower = 36;
  paving.diffuseColor = new Color3(0.96, 0.96, 0.94);
  paving.emissiveColor = new Color3(0.25, 0.26, 0.24);
  ground.material = paving;

  scene.metadata = { ...scene.metadata, paintedArena: 'ready', paintedBackdrop: 'ready' };

  // Emissive glowing materials for cinematic bloom highlights
  const makeGlowMat = (name: string, diffuseHex: string, emissiveHex: string) => {
    const m = new StandardMaterial(name, scene);
    m.diffuseColor = Color3.FromHexString(diffuseHex);
    m.emissiveColor = Color3.FromHexString(emissiveHex);
    m.specularColor = Color3.White();
    m.specularPower = 64;
    return m;
  };
  const flameRadMat = makeGlowMat('flame-rad-mat', '#6bf0ff', '#2cb8d9');
  const flameDireMat = makeGlowMat('flame-dire-mat', '#ff7b3a', '#d93f18');
  const goldGlowMat = makeGlowMat('gold-glow-mat', '#ffe699', '#c99738');
  const jadeGlowMat = makeGlowMat('jade-glow-mat', '#7effd4', '#26a685');

  // 2. 3D Cliff Retaining Walls, Bastions & Stepped Stone Ramps.
  const cliffRadProto = MeshBuilder.CreateBox('cliff-rad-proto', { width: 38, height: RIDGE_HEIGHT, depth: 20 }, scene);
  cliffRadProto.material = material('#6b6e5e');
  cliffRadProto.isVisible = false;

  const cliffDireProto = MeshBuilder.CreateBox('cliff-dire-proto', { width: 38, height: RIDGE_HEIGHT, depth: 20 }, scene);
  cliffDireProto.material = material('#4c4542');
  cliffDireProto.isVisible = false;

  const curbRadProto = MeshBuilder.CreateBox('curb-rad-proto', { width: 36, height: 7, depth: 10 }, scene);
  curbRadProto.material = material('#b8ae94');
  curbRadProto.isVisible = false;

  const curbDireProto = MeshBuilder.CreateBox('curb-dire-proto', { width: 36, height: 7, depth: 10 }, scene);
  curbDireProto.material = material('#7b726b');
  curbDireProto.isVisible = false;

  const pillarRadProto = MeshBuilder.CreateCylinder('pillar-rad-proto', { height: RIDGE_HEIGHT + 16, diameterTop: 14, diameterBottom: 18, tessellation: 8 }, scene);
  pillarRadProto.material = material('#8f8872');
  pillarRadProto.isVisible = false;

  const pillarDireProto = MeshBuilder.CreateCylinder('pillar-dire-proto', { height: RIDGE_HEIGHT + 16, diameterTop: 14, diameterBottom: 18, tessellation: 8 }, scene);
  pillarDireProto.material = material('#5c524d');
  pillarDireProto.isVisible = false;

  const isNearRamp = (x: number, north: boolean) =>
    (north ? RIDGE_RAMPS.north : RIDGE_RAMPS.south).some(rx => Math.abs(x - rx) < 42);

  for (let x = LANDSCAPE.left + 18; x <= LANDSCAPE.right - 18; x += 34) {
    const e = stoneLaneEdges(x);
    const isDire = x > width / 2;
    for (const north of [true, false]) {
      if (isNearRamp(x, north)) continue;
      const edgeY = north ? e.top : e.bottom;
      const sign = north ? -1 : 1;
      const cliff = (isDire ? cliffDireProto : cliffRadProto).createInstance(`lane-cliff:${north ? 'n' : 's'}:${x}`);
      cliff.position.set(x, RIDGE_HEIGHT * 0.45, edgeY + sign * 11);
      cliff.rotation.y = Math.atan(LANE_SLOPE);

      const curb = (isDire ? curbDireProto : curbRadProto).createInstance(`lane-curb:${north ? 'n' : 's'}:${x}`);
      curb.position.set(x, RIDGE_HEIGHT + 2.2, edgeY + sign * 2);
      curb.rotation.y = Math.atan(LANE_SLOPE);

      if (Math.abs(x - width / 2) < 90 || x % 136 === 0) {
        const pil = (isDire ? pillarDireProto : pillarRadProto).createInstance(`lane-pillar:${north ? 'n' : 's'}:${x}`);
        pil.position.set(x, (RIDGE_HEIGHT + 14) * 0.5, edgeY + sign * 6);
      }
    }
  }

  // Highground Base Cliff Walls (Radiant West & Dire East plateaus outside the lane)
  for (const [side, baseX, isDire] of [
    ['blue', LANDSCAPE.left, false],
    ['red', LANDSCAPE.right, true],
  ] as const) {
    const laneEdge = stoneLaneEdges(baseX);
    const dir = isDire ? -1 : 1;
    for (let y = 36; y <= height - 36; y += 36) {
      if (y > laneEdge.top - 12 && y < laneEdge.bottom + 12) continue;
      const wall = (isDire ? cliffDireProto : cliffRadProto).createInstance(`base-cliff:${side}:${y}`);
      wall.position.set(baseX + dir * 10, RIDGE_HEIGHT * 0.46, y);
      wall.rotation.y = Math.PI / 2;

      const trim = (isDire ? curbDireProto : curbRadProto).createInstance(`base-curb:${side}:${y}`);
      trim.position.set(baseX + dir * 2, RIDGE_HEIGHT + 2.2, y);
      trim.rotation.y = Math.PI / 2;

      if (y % 144 === 0) {
        const bastion = (isDire ? pillarDireProto : pillarRadProto).createInstance(`base-bastion:${side}:${y}`);
        bastion.position.set(baseX + dir * 5, (RIDGE_HEIGHT + 18) * 0.5, y);
      }
    }
  }

  // 2b. 3D Stepped Stone Staircases & Flaming Braziers at all 8 Ramps.
  const stairRadProto = MeshBuilder.CreateBox('stair-rad-proto', { width: 48, height: 6, depth: 11 }, scene);
  stairRadProto.material = material('#7d776a');
  stairRadProto.isVisible = false;

  const stairDireProto = MeshBuilder.CreateBox('stair-dire-proto', { width: 48, height: 6, depth: 11 }, scene);
  stairDireProto.material = material('#4a4440');
  stairDireProto.isVisible = false;

  const brazierPostProto = MeshBuilder.CreateCylinder('brazier-post-proto', { height: 22, diameterTop: 6, diameterBottom: 9, tessellation: 8 }, scene);
  brazierPostProto.material = material('#4d4943');
  brazierPostProto.isVisible = false;

  const flameRadProto = MeshBuilder.CreatePolyhedron('flame-rad-proto', { type: 1, size: 4.8 }, scene);
  flameRadProto.material = flameRadMat;
  flameRadProto.isVisible = false;

  const flameDireProto = MeshBuilder.CreatePolyhedron('flame-dire-proto', { type: 1, size: 4.8 }, scene);
  flameDireProto.material = flameDireMat;
  flameDireProto.isVisible = false;

  for (const north of [true, false]) {
    const sign = north ? -1 : 1;
    for (const rx of north ? RIDGE_RAMPS.north : RIDGE_RAMPS.south) {
      const e = stoneLaneEdges(rx);
      const edgeY = north ? e.top : e.bottom;
      const isDire = rx > width / 2;
      for (let step = 0; step < 6; step++) {
        const sy = edgeY + sign * (step * 11 + 4);
        const sh = RIDGE_HEIGHT * (1 - step / 6);
        const tread = (isDire ? stairDireProto : stairRadProto).createInstance(`ramp-step:${north ? 'n' : 's'}:${rx}:${step}`);
        tread.position.set(rx, sh - 2, sy);
      }
      for (const side of [-1, 1]) {
        const postX = rx + side * 27;
        const postY = edgeY + sign * 6;
        const post = brazierPostProto.createInstance(`ramp-post:${north ? 'n' : 's'}:${rx}:${side}`);
        post.position.set(postX, RIDGE_HEIGHT + 10, postY);
        const flame = (isDire ? flameDireProto : flameRadProto).createInstance(`ramp-flame:${north ? 'n' : 's'}:${rx}:${side}`);
        flame.position.set(postX, RIDGE_HEIGHT + 24, postY);
      }
    }
  }

  // 3. Central Sunken Canyon Chasm Architecture & Causeway Bridge Piers.
  const chasmCragProto = MeshBuilder.CreatePolyhedron('chasm-crag-proto', { type: 1, size: 1 }, scene);
  chasmCragProto.material = material('#3d3735');
  chasmCragProto.isVisible = false;

  const bridgeArchProto = MeshBuilder.CreateBox('bridge-arch-proto', { width: 34, height: 42, depth: 24 }, scene);
  bridgeArchProto.material = material('#625b52');
  bridgeArchProto.isVisible = false;

  // Bridge piers under the stone causeway spanning the canyon chasm
  const laneMid = stoneLaneEdges(width / 2);
  for (const north of [true, false]) {
    const edgeY = north ? laneMid.top : laneMid.bottom;
    const sign = north ? -1 : 1;
    for (const px of [width / 2 - 42, width / 2 + 42]) {
      const pier = bridgeArchProto.createInstance(`chasm-pier:${north ? 'n' : 's'}:${px}`);
      pier.position.set(px, (RIDGE_HEIGHT - 12) * 0.5, edgeY + sign * 8);
      pier.scaling.set(1.15, 1.25, 0.95);
    }
  }

  // Jagged canyon walls & rocky gorge formations along the chasm divide
  for (let y = 32; y <= height - 32; y += 38) {
    if (y > laneMid.top - 24 && y < laneMid.bottom + 24) continue;
    const cx = chasmCenterX(y);
    const gorgeH = arenaGroundHeight(cx, y);
    // Crags on Radiant West and Dire East rims of the chasm
    for (const side of [-1, 1]) {
      const cragX = cx + side * (52 + noise(y + side) * 16);
      const crag = chasmCragProto.createInstance(`chasm-rim-crag:${y}:${side}`);
      const cragSize = 22 + (y % 4) * 5;
      crag.position.set(cragX, arenaGroundHeight(cragX, y) + cragSize * 0.45, y);
      crag.scaling.set(cragSize * 1.1, cragSize * 1.35, cragSize * 0.95);
      crag.rotation.set(0.18 * side, (y + side) * 0.4, 0.1);
    }
    // Boulder formations in the canyon floor
    if (y % 76 === 0) {
      const bedStone = chasmCragProto.createInstance(`chasm-bed-stone:${y}`);
      bedStone.position.set(cx + (noise(y) - 0.5) * 24, gorgeH + 4, y);
      bedStone.scaling.set(16, 12, 18);
      bedStone.rotation.y = noise(y) * Math.PI;
    }
  }

  // 3b. Central Celestial Astrolabe Spire Setpieces on the causeway bridge.
  const animatedRings: { mesh: Mesh; speed: number; baseY: number; amp: number }[] = [];
  for (const [north, edgeY] of [
    [true, laneMid.top],
    [false, laneMid.bottom],
  ] as const) {
    const sign = north ? -1 : 1;
    const spireY = edgeY + sign * 18;
    const spire = MeshBuilder.CreateCylinder(`mid-gate-spire:${north}`, { height: 74, diameterTop: 10, diameterBottom: 22, tessellation: 8 }, scene);
    spire.position.set(width / 2, RIDGE_HEIGHT + 34, spireY);
    spire.material = material('#8f856e');

    const crown = MeshBuilder.CreateTorus(`mid-gate-halo:${north}`, { diameter: 34, thickness: 2.4, tessellation: 24 }, scene);
    crown.position.set(width / 2, RIDGE_HEIGHT + 76, spireY);
    crown.rotation.x = 0.35 * sign;
    crown.material = goldGlowMat;
    animatedRings.push({ mesh: crown, speed: north ? 0.9 : -0.9, baseY: RIDGE_HEIGHT + 76, amp: 2.5 });

    const star = MeshBuilder.CreatePolyhedron(`mid-gate-star:${north}`, { type: 1, size: 7.5 }, scene);
    star.position.set(width / 2, RIDGE_HEIGHT + 76, spireY);
    star.material = goldGlowMat;
    animatedRings.push({ mesh: star, speed: north ? -1.4 : 1.4, baseY: RIDGE_HEIGHT + 76, amp: 3.2 });
  }

  // 3c. Howling Abyss Atmospheric Chasm Fog & Rising Frost Mist
  const frostMistMat = new StandardMaterial('frost-mist-mat', scene);
  frostMistMat.diffuseColor = Color3.FromHexString('#8fd6f2');
  frostMistMat.emissiveColor = Color3.FromHexString('#3a7594');
  frostMistMat.alpha = 0.28;
  frostMistMat.backFaceCulling = false;
  frostMistMat.specularColor = Color3.Black();

  const abyssVoidMat = new StandardMaterial('abyss-void-mat', scene);
  abyssVoidMat.diffuseColor = Color3.FromHexString('#04090f');
  abyssVoidMat.emissiveColor = Color3.FromHexString('#020508');
  abyssVoidMat.alpha = 0.62;
  abyssVoidMat.backFaceCulling = false;

  const abyssFogPlanes: { mesh: Mesh; speed: number; baseOffset: number }[] = [];
  for (let m = 0; m < 3; m++) {
    const mistPlane = MeshBuilder.CreatePlane(`abyss-frost-mist:${m}`, { width: 340 + m * 50, height: height * 0.96 }, scene);
    mistPlane.rotation.x = Math.PI / 2;
    mistPlane.position.set(width / 2, -26 - m * 5, height / 2);
    mistPlane.material = m === 2 ? abyssVoidMat : frostMistMat;
    mistPlane.isPickable = false;
    abyssFogPlanes.push({ mesh: mistPlane, speed: (m % 2 === 0 ? 1 : -1) * (0.015 + m * 0.008), baseOffset: -26 - m * 5 });
  }

  // 3d. Hanging Giant Iron Chains & Under-Bridge Stone Buttress Arches
  const ironChainMat = new StandardMaterial('iron-chain-mat', scene);
  ironChainMat.diffuseColor = Color3.FromHexString('#25272a');
  ironChainMat.specularColor = new Color3(0.18, 0.18, 0.18);
  ironChainMat.specularPower = 24;

  const chainLinkProto = MeshBuilder.CreateTorus('chain-link-proto', { diameter: 14, thickness: 3.2, tessellation: 12 }, scene);
  chainLinkProto.material = ironChainMat;
  chainLinkProto.isVisible = false;

  const underArchProto = MeshBuilder.CreateBox('under-arch-proto', { width: 44, height: 56, depth: 32 }, scene);
  underArchProto.material = material('#48423c');
  underArchProto.isVisible = false;

  for (const north of [true, false]) {
    const edgeY = north ? laneMid.top : laneMid.bottom;
    const sign = north ? -1 : 1;
    for (const [offsetPx, tilt] of [[-68, 0.22], [68, -0.22]] as const) {
      const arch = underArchProto.createInstance(`chasm-buttress:${north ? 'n' : 's'}:${offsetPx}`);
      arch.position.set(width / 2 + offsetPx, RIDGE_HEIGHT * 0.2, edgeY + sign * 14);
      arch.rotation.z = tilt;
      arch.rotation.y = Math.atan(LANE_SLOPE);
    }
    for (const cx of [width / 2 - 58, width / 2 - 22, width / 2 + 22, width / 2 + 58]) {
      const startY = RIDGE_HEIGHT - 6;
      for (let link = 0; link < 7; link++) {
        const cl = chainLinkProto.createInstance(`abyss-chain:${north ? 'n' : 's'}:${cx}:${link}`);
        const sag = Math.sin((link / 6) * Math.PI) * 5;
        cl.position.set(cx + (link % 2 === 0 ? 0 : 1.2), startY - link * 7.5, edgeY + sign * (12 + sag));
        cl.rotation.x = link % 2 === 0 ? 0 : Math.PI / 2;
        cl.rotation.y = Math.atan(LANE_SLOPE);
        cl.scaling.setAll(1 - link * 0.04);
      }
    }
  }

  // 3e. Stone Balustrades with Broken Crenellations & Guardian Runic Obelisks
  const balustradeProto = MeshBuilder.CreateBox('balustrade-proto', { width: 30, height: 13, depth: 7 }, scene);
  balustradeProto.material = material('#635e54');
  balustradeProto.isVisible = false;

  const balustradeDireProto = MeshBuilder.CreateBox('balustrade-dire-proto', { width: 30, height: 13, depth: 7 }, scene);
  balustradeDireProto.material = material('#48423e');
  balustradeDireProto.isVisible = false;

  const rubbleProto = MeshBuilder.CreatePolyhedron('rubble-proto', { type: 1, size: 3.5 }, scene);
  rubbleProto.material = material('#524c44');
  rubbleProto.isVisible = false;

  const runeFrostMat = makeGlowMat('rune-frost-mat', '#80e5ff', '#32b8e8');
  const runeEmberMat = makeGlowMat('rune-ember-mat', '#ff8442', '#e04a12');

  const runeObeliskProto = MeshBuilder.CreateCylinder('rune-obelisk-proto', { height: 38, diameterTop: 7, diameterBottom: 12, tessellation: 6 }, scene);
  runeObeliskProto.material = material('#55524b');
  runeObeliskProto.isVisible = false;

  // Stone Balustrades along the slanted bridge edges
  for (let x = LANDSCAPE.left + 24; x <= LANDSCAPE.right - 24; x += 32) {
    const e = stoneLaneEdges(x);
    const isDire = x > width / 2;
    for (const north of [true, false]) {
      if (isNearRamp(x, north)) continue;
      const edgeY = north ? e.top : e.bottom;
      const sign = north ? -1 : 1;
      const broken = (x % 160 === 0);
      if (broken) {
        for (let r = 0; r < 2; r++) {
          const rub = rubbleProto.createInstance(`balustrade-rubble:${north ? 'n' : 's'}:${x}:${r}`);
          rub.position.set(x + (r - 0.5) * 12, RIDGE_HEIGHT + 3.2, edgeY + sign * (6 + r * 3));
          rub.rotation.set(r * 0.4, x * 0.1, r * 0.2);
        }
        continue;
      }
      const parapet = (isDire ? balustradeDireProto : balustradeProto).createInstance(`balustrade:${north ? 'n' : 's'}:${x}`);
      parapet.position.set(x, RIDGE_HEIGHT + 6.5, edgeY + sign * 5);
      parapet.rotation.y = Math.atan(LANE_SLOPE);
    }
  }

  // Guardian Runic Obelisks at bridge ramp gateways
  for (const north of [true, false]) {
    for (const rx of north ? RIDGE_RAMPS.north : RIDGE_RAMPS.south) {
      const e = stoneLaneEdges(rx);
      const edgeY = north ? e.top : e.bottom;
      const sign = north ? -1 : 1;
      const isDire = rx > width / 2;
      const obelisk = runeObeliskProto.createInstance(`gate-obelisk:${north ? 'n' : 's'}:${rx}`);
      obelisk.position.set(rx + 34, RIDGE_HEIGHT + 18, edgeY + sign * 14);
      obelisk.rotation.y = Math.atan(LANE_SLOPE) + (sign > 0 ? 0.1 : -0.1);

      const runeGem = MeshBuilder.CreatePolyhedron(`gate-obelisk-gem:${north ? 'n' : 's'}:${rx}`, { type: 1, size: 5.5 }, scene);
      runeGem.position.set(rx + 34, RIDGE_HEIGHT + 39, edgeY + sign * 14);
      runeGem.material = isDire ? runeEmberMat : runeFrostMat;
      animatedRings.push({ mesh: runeGem, speed: isDire ? 1.4 : -1.4, baseY: RIDGE_HEIGHT + 39, amp: 2.2 });
    }
  }

  // 4. 3D Multi-Part Rock Crags (ROCK_TERRAIN) & Boss/Camp Architecture (CAMP_ROCK_RINGS).
  const rockRadProto = MeshBuilder.CreatePolyhedron('rock-rad-proto', { type: 1, size: 1 }, scene);
  rockRadProto.material = material('#5d6b5c');
  rockRadProto.isVisible = false;

  const rockDireProto = MeshBuilder.CreatePolyhedron('rock-dire-proto', { type: 1, size: 1 }, scene);
  rockDireProto.material = material('#4a4341');
  rockDireProto.isVisible = false;

  const rockCapRadProto = MeshBuilder.CreatePolyhedron('rock-cap-rad-proto', { type: 2, size: 1 }, scene);
  rockCapRadProto.material = material('#4e7548');
  rockCapRadProto.isVisible = false;

  const rockCapDireProto = MeshBuilder.CreatePolyhedron('rock-cap-dire-proto', { type: 2, size: 1 }, scene);
  rockCapDireProto.material = material('#634138');
  rockCapDireProto.isVisible = false;

  for (const [i, rock] of ROCK_TERRAIN.entries()) {
    const isDire = rock.x > width / 2;
    const baseH = arenaGroundHeight(rock.x, rock.y);
    const main = (isDire ? rockDireProto : rockRadProto).createInstance(`collision-rock:${i}`);
    const tall = rock.radius * (1.28 + noise(i) * 0.78);
    main.position.set(rock.x, baseH + tall * 0.42, rock.y);
    main.scaling.set(rock.radius * 1.06, tall, rock.radius * 0.96);
    main.rotation.set(noise(i) * 0.35, noise(i + 10) * 6.2, 0.12);

    const cap = (isDire ? rockCapDireProto : rockCapRadProto).createInstance(`collision-rock-cap:${i}`);
    cap.position.set(
      rock.x + (noise(i + 3) - 0.5) * rock.radius * 0.35,
      baseH + tall * 0.82,
      rock.y + (noise(i + 7) - 0.5) * rock.radius * 0.35,
    );
    cap.scaling.set(rock.radius * 0.68, tall * 0.55, rock.radius * 0.62);
    cap.rotation.set(0.2, noise(i + 22) * 5, -0.15);
  }

  let dragonMagmaMesh: Mesh | null = null;
  const floatingGolemStones: { mesh: InstancedMesh; orbitR: number; speed: number; baseAngle: number; baseY: number; center: { x: number; z: number } }[] = [];

  for (const ring of CAMP_ROCK_RINGS) {
    const art = arenaCampArt(ring.id);
    const isBoss = ring.stones === 16;
    const isDragon = ring.id === 'dragon_boss';
    const baseH = arenaGroundHeight(ring.x, ring.y);
    const altar = MeshBuilder.CreateTorus(
      `camp-altar:${ring.id}`,
      { diameter: ring.radius * (isBoss ? 1.18 : 0.86), thickness: isBoss ? 3.4 : 2, tessellation: 28 },
      scene,
    );
    altar.position.set(ring.x, baseH + 0.9, ring.y);
    altar.material = isBoss ? (isDragon ? flameDireMat : jadeGlowMat) : material(art.accent);

    for (const side of [-1, 1]) {
      const gateAngle = ring.entrance + side * (isBoss ? 0.54 : 0.66);
      const gx = ring.x + Math.cos(gateAngle) * (ring.radius + 4);
      const gy = ring.y + Math.sin(gateAngle) * (ring.radius + 4);
      const gh = arenaGroundHeight(gx, gy);
      const totem = brazierPostProto.createInstance(`camp-totem:${ring.id}:${side}`);
      totem.position.set(gx, gh + (isBoss ? 20 : 12), gy);
      totem.scaling.set(isBoss ? 1.6 : 1.1, isBoss ? 1.85 : 1.1, isBoss ? 1.6 : 1.1);
      const crystal = MeshBuilder.CreatePolyhedron(`camp-gem:${ring.id}:${side}`, { type: 1, size: isBoss ? 7 : 4.2 }, scene);
      crystal.position.set(gx, gh + (isBoss ? 42 : 26), gy);
      crystal.material = isBoss ? (isDragon ? flameDireMat : jadeGlowMat) : material(art.accent);
      if (isBoss) animatedRings.push({ mesh: crystal, speed: side * 1.2, baseY: gh + 42, amp: 2.8 });
    }

    // Boss Pit Grand Architecture (Dragon Volcanic Ribs vs Siege Golem Colosseum Pillars)
    if (isBoss) {
      for (let k = 0; k < 7; k++) {
        const arc = ring.entrance + Math.PI + (k - 3) * 0.36;
        const px = ring.x + Math.cos(arc) * (ring.radius + 14);
        const pz = ring.y + Math.sin(arc) * (ring.radius + 14);
        const ph = arenaGroundHeight(px, pz);
        if (isDragon) {
          const rib = MeshBuilder.CreateCylinder(
            `dragon-rib:${k}`,
            { height: 64, diameterTop: 3, diameterBottom: 15, tessellation: 6 },
            scene,
          );
          rib.position.set(px, ph + 28, pz);
          rib.rotation.y = -arc + Math.PI / 2;
          rib.rotation.z = 0.38;
          rib.material = material('#3c2d2a');
        } else {
          const col = MeshBuilder.CreateCylinder(
            `golem-col:${k}`,
            { height: 58, diameterTop: 12, diameterBottom: 15, tessellation: 8 },
            scene,
          );
          col.position.set(px, ph + 27, pz);
          col.material = material('#707a72');
          if (k % 2 === 0) {
            const capGem = MeshBuilder.CreatePolyhedron(`golem-cap:${k}`, { type: 1, size: 5 }, scene);
            capGem.position.set(px, ph + 61, pz);
            capGem.material = jadeGlowMat;
          }
        }
      }

      if (isDragon) {
        // Dragon Molten Magma Pool
        const magmaMat = new StandardMaterial('dragon-magma-mat', scene);
        magmaMat.diffuseColor = Color3.FromHexString('#ff4400');
        magmaMat.emissiveColor = Color3.FromHexString('#e63600');
        magmaMat.specularColor = Color3.White();
        magmaMat.specularPower = 64;
        const magmaPool = MeshBuilder.CreateDisc('dragon-magma-pool', { radius: 48, tessellation: 32 }, scene);
        magmaPool.rotation.x = Math.PI / 2;
        magmaPool.position.set(ring.x, baseH + 1.2, ring.y);
        magmaPool.material = magmaMat;
        dragonMagmaMesh = magmaPool;
      } else {
        // Siege Golem Runic Seal Floor & Levitating Orbit Stones
        const golemSealMat = new StandardMaterial('golem-seal-mat', scene);
        golemSealMat.diffuseColor = Color3.FromHexString('#25483e');
        golemSealMat.emissiveColor = Color3.FromHexString('#148762');
        golemSealMat.specularColor = Color3.Black();
        const golemSeal = MeshBuilder.CreateDisc('golem-runic-seal', { radius: 52, tessellation: 32 }, scene);
        golemSeal.rotation.x = Math.PI / 2;
        golemSeal.position.set(ring.x, baseH + 1.2, ring.y);
        golemSeal.material = golemSealMat;

        const floatStoneProto = MeshBuilder.CreatePolyhedron('float-stone-proto', { type: 1, size: 7.5 }, scene);
        floatStoneProto.material = material('#626b64');
        floatStoneProto.isVisible = false;
        for (let s = 0; s < 4; s++) {
          const fs = floatStoneProto.createInstance(`golem-float-stone:${s}`);
          const ang = (s * Math.PI) / 2;
          fs.position.set(ring.x + Math.cos(ang) * 44, baseH + 22, ring.y + Math.sin(ang) * 44);
          floatingGolemStones.push({ mesh: fs, orbitR: 44, speed: 0.7, baseAngle: ang, baseY: baseH + 22, center: { x: ring.x, z: ring.y } });
        }
      }
    }
  }

  // 5. Dense, Creative Multi-Species 3D Forest (~640 Trees + Woodland Undergrowth).
  const crownRad1 = MeshBuilder.CreateCylinder('crown-rad-1', { height: 1, diameterTop: 0.06, diameterBottom: 1, tessellation: 7 }, scene);
  crownRad1.material = material('#224934');
  crownRad1.isVisible = false;

  const crownRad2 = MeshBuilder.CreateCylinder('crown-rad-2', { height: 1, diameterTop: 0.08, diameterBottom: 1, tessellation: 7 }, scene);
  crownRad2.material = material('#346a44');
  crownRad2.isVisible = false;

  const crownOakRad = MeshBuilder.CreatePolyhedron('crown-oak-rad', { type: 2, size: 0.58 }, scene);
  crownOakRad.material = material('#447c48');
  crownOakRad.isVisible = false;

  const crownGoldRad = MeshBuilder.CreatePolyhedron('crown-gold-rad', { type: 2, size: 0.56 }, scene);
  crownGoldRad.material = material('#8f8842');
  crownGoldRad.isVisible = false;

  const crownCrystalWillow = MeshBuilder.CreatePolyhedron('crown-willow', { type: 1, size: 0.54 }, scene);
  crownCrystalWillow.material = jadeGlowMat;
  crownCrystalWillow.isVisible = false;

  const crownDire1 = MeshBuilder.CreateCylinder('crown-dire-1', { height: 1, diameterTop: 0.04, diameterBottom: 0.92, tessellation: 6 }, scene);
  crownDire1.material = material('#2a2529');
  crownDire1.isVisible = false;

  const crownDire2 = MeshBuilder.CreateCylinder('crown-dire-2', { height: 1, diameterTop: 0.05, diameterBottom: 0.88, tessellation: 6 }, scene);
  crownDire2.material = material('#453130');
  crownDire2.isVisible = false;

  const crownDireAsh = MeshBuilder.CreatePolyhedron('crown-dire-ash', { type: 2, size: 0.55 }, scene);
  crownDireAsh.material = material('#5c3933');
  crownDireAsh.isVisible = false;

  const trunkRad = MeshBuilder.CreateCylinder('trunk-rad-proto', { height: 1, diameterTop: 0.7, diameterBottom: 1.18, tessellation: 6 }, scene);
  trunkRad.material = material('#52422f');
  trunkRad.isVisible = false;

  const trunkDire = MeshBuilder.CreateCylinder('trunk-dire-proto', { height: 1, diameterTop: 0.65, diameterBottom: 1.22, tessellation: 6 }, scene);
  trunkDire.material = material('#322724');
  trunkDire.isVisible = false;

  const logProto = MeshBuilder.CreateCylinder('fallen-log-proto', { height: 28, diameter: 6.5, tessellation: 6 }, scene);
  logProto.material = material('#4a3b2a');
  logProto.isVisible = false;

  const shroomProto = MeshBuilder.CreatePolyhedron('forest-shroom-proto', { type: 1, size: 3.2 }, scene);
  shroomProto.material = jadeGlowMat;
  shroomProto.isVisible = false;

  const emberShardProto = MeshBuilder.CreatePolyhedron('forest-ember-proto', { type: 1, size: 3.2 }, scene);
  emberShardProto.material = flameDireMat;
  emberShardProto.isVisible = false;

  const foliage: (Mesh | InstancedMesh)[] = [];
  const spawnTree = (i: number, x: number, y: number, isExterior: boolean) => {
    const isDire = x > width / 2;
    const species = i % 9;
    const h = (isExterior ? 68 : 52) + noise(i + 40) * 42;
    const r = (isExterior ? 23 : 18) + noise(i + 100) * 12;
    const base = arenaGroundHeight(x, y);

    const t = (isDire ? trunkDire : trunkRad).createInstance(`trunk:${i}`);
    t.position.set(x, base + h * 0.28, y);
    t.scaling.set(6.5, h * 0.56, 6.5);
    t.rotation.z = (noise(i + 5) - 0.5) * 0.08;

    if (!isDire && (species === 0 || species === 4)) {
      const mainDome = (species === 0 ? crownGoldRad : crownOakRad).createInstance(`oak-main:${i}`);
      mainDome.position.set(x, base + h * 0.68, y);
      mainDome.scaling.set(r * 1.15, h * 0.45, r * 1.15);
      mainDome.rotation.y = i * 0.9;
      foliage.push(mainDome);
      for (const side of [-1, 1]) {
        const sub = crownOakRad.createInstance(`oak-sub:${i}:${side}`);
        sub.position.set(x + side * r * 0.42, base + h * 0.56, y + (side > 0 ? 1 : -1) * r * 0.28);
        sub.scaling.set(r * 0.82, h * 0.34, r * 0.82);
        foliage.push(sub);
      }
    } else if (!isDire && species === 8) {
      const core = crownRad2.createInstance(`willow-base:${i}`);
      core.position.set(x, base + h * 0.55, y);
      core.scaling.set(r, h * 0.5, r);
      foliage.push(core);
      const glow = crownCrystalWillow.createInstance(`willow-glow:${i}`);
      glow.position.set(x, base + h * 0.78, y);
      glow.scaling.set(r * 0.65, h * 0.32, r * 0.65);
      foliage.push(glow);
    } else if (isDire && species === 3) {
      const ash = crownDireAsh.createInstance(`dire-ash:${i}`);
      ash.position.set(x, base + h * 0.66, y);
      ash.scaling.set(r * 1.08, h * 0.44, r * 1.08);
      ash.rotation.set(0.1, i * 1.3, -0.08);
      foliage.push(ash);
    } else {
      for (let level = 0; level < 3; level++) {
        const proto = isDire ? (level % 2 === 0 ? crownDire1 : crownDire2) : level % 2 === 0 ? crownRad1 : crownRad2;
        const c = proto.createInstance(`pine:${i}:${level}`);
        c.position.set(x, base + h * (0.48 + level * 0.22), y);
        const scaleR = r * (1 - level * 0.23);
        c.scaling.set(scaleR, h * 0.52, scaleR);
        c.rotation.y = (i + level) * 1.1;
        foliage.push(c);
      }
    }

    if (i % 11 === 0) {
      const log = logProto.createInstance(`undergrowth-log:${i}`);
      log.position.set(x + 14, base + 2.5, y + 8);
      log.rotation.z = Math.PI / 2;
      log.rotation.y = noise(i) * Math.PI;
    }
    if (i % 7 === 0) {
      const gem = (isDire ? emberShardProto : shroomProto).createInstance(`undergrowth-gem:${i}`);
      gem.position.set(x - 10, base + 3.2, y - 9);
    }
  };

  // Playable jungle trees (dense coverage across North & South jungles while keeping camps/bushes/lane and central chasm clear)
  for (let i = 0; i < 520; i++) {
    const x = 395 + noise(i + 15) * 1810,
      y = 18 + noise(i + 800) * (height - 36),
      lane = stoneLaneEdges(x);
    if (y > lane.top - 68 && y < lane.bottom + 68) continue;
    if (Math.abs(x - chasmCenterX(y)) < 42) continue; // Keep the canyon gorge bed clear of trunks
    if (
      CAMP_ROCK_RINGS.some(c => Math.hypot(c.x - x, c.y - y) < c.radius + 28) ||
      ARAM_BUSHES.some(b => Math.abs(b.x - x) < b.width / 2 + 18 && Math.abs(b.y - y) < b.height / 2 + 18) ||
      ROCK_TERRAIN.some(r => Math.hypot(r.x - x, r.y - y) < r.radius + 14)
    )
      continue;
    spawnTree(i, x, y, false);
  }

  // Exterior 3D Forest Canopy & Mountain Crags framing the entire valley perimeter
  for (let i = 0; i < 68; i++) {
    const x = -140 + (i * 2880) / 67;
    const isDire = x > width / 2;
    for (const south of [false, true]) {
      const y = south ? ARENA_HEIGHT + 42 + Math.sin(i * 2.1) * 24 : -42 + Math.sin(i * 1.7) * 24;
      const crag = (isDire ? rockDireProto : rockRadProto).createInstance(`valley-crag:${south}:${i}`);
      const cragR = 36 + (i % 5) * 11;
      const cragH = 56 + (i % 4) * 24;
      crag.position.set(x, cragH * 0.35 - 8, y);
      crag.scaling.set(cragR * 1.3, cragH, cragR);
      crag.rotation.set(0.15, i * 0.9, 0.08);

      spawnTree(1000 + i * 2 + (south ? 1 : 0), x + (i % 2 ? 22 : -22), y + (south ? 18 : -18), true);
    }
  }

  // Floating Celestial Monoliths along the valley horizon
  for (const [idx, mx, mz, isDire] of [
    [0, 620, -65, false],
    [1, 1980, -65, true],
    [2, 620, ARENA_HEIGHT + 65, false],
    [3, 1980, ARENA_HEIGHT + 65, true],
  ] as const) {
    const monolith = MeshBuilder.CreatePolyhedron(`horizon-monolith:${idx}`, { type: 1, size: 16 }, scene);
    monolith.position.set(mx, 68, mz);
    monolith.scaling.set(0.75, 2.2, 0.75);
    monolith.material = material(isDire ? '#4a3d3b' : '#6c7566');
    animatedRings.push({ mesh: monolith, speed: 0.45 * (isDire ? -1 : 1), baseY: 68, amp: 5.5 });

    const ring = MeshBuilder.CreateTorus(`horizon-ring:${idx}`, { diameter: 36, thickness: 1.8, tessellation: 24 }, scene);
    ring.position.set(mx, 68, mz);
    ring.rotation.x = 0.4;
    ring.material = isDire ? flameDireMat : jadeGlowMat;
    animatedRings.push({ mesh: ring, speed: 1.1 * (isDire ? 1 : -1), baseY: 68, amp: 5.5 });
  }

  // Atmospheric Drifting Fireflies & Canyon Motes
  const fireflies: { mesh: InstancedMesh; baseX: number; baseY: number; baseZ: number; phase: number }[] = [];
  for (let i = 0; i < 90; i++) {
    const fx = 420 + noise(i + 300) * 1760;
    const fz = 35 + noise(i + 600) * (height - 70);
    const e = stoneLaneEdges(fx);
    if (fz > e.top - 40 && fz < e.bottom + 40) continue;
    const isDire = fx > width / 2;
    const fy = arenaGroundHeight(fx, fz) + 18 + noise(i + 900) * 34;
    const mote = (isDire ? emberShardProto : shroomProto).createInstance(`atmosphere-mote:${i}`);
    mote.position.set(fx, fy, fz);
    mote.scaling.setAll(0.55 + (i % 3) * 0.2);
    fireflies.push({ mesh: mote, baseX: fx, baseY: fy, baseZ: fz, phase: i * 0.73 });
  }

  // 6. 3D Layered Brush (ARAM_BUSHES) with proximity crouch.
  const shrubDarkProto = MeshBuilder.CreateSphere('brush-dark-proto', { diameter: 1, segments: 6 }, scene);
  shrubDarkProto.material = material('#2c5938');
  shrubDarkProto.isVisible = false;

  const shrubLightProto = MeshBuilder.CreateSphere('brush-light-proto', { diameter: 1, segments: 6 }, scene);
  shrubLightProto.material = material('#5d8c47');
  shrubLightProto.isVisible = false;

  const bushClusters: { mesh: InstancedMesh; x: number; y: number; baseH: number }[] = [];
  for (const b of ARAM_BUSHES) {
    const gh = arenaGroundHeight(b.x, b.y);
    for (let i = 0; i < 12; i++) {
      const proto = i % 3 === 0 ? shrubLightProto : shrubDarkProto;
      const m = proto.createInstance(`${b.id}:${i}`);
      const bx = b.x + (noise(i + 1) - 0.5) * b.width * 0.86;
      const by = b.y + (noise(i + 90) - 0.5) * b.height * 0.82;
      const sh = 16 + (i % 3) * 5;
      m.position.set(bx, gh + sh * 0.45, by);
      m.scaling.set(b.width * 0.26, sh, b.height * 0.48);
      bushClusters.push({ mesh: m, x: b.x, y: b.y, baseH: sh });
    }
  }

  // 7. 3D Sanctuary Fountains, Obelisks & Glowing Rings at Blue and Red Bases.
  for (const [team, x] of [
    ['blue', 65],
    ['red', width - 65],
  ] as const) {
    const isBlue = team === 'blue';
    const accent = isBlue ? '#45bfd5' : '#d9536f';
    const glowMat = isBlue ? flameRadMat : flameDireMat;
    const stoneCol = isBlue ? '#8c8976' : '#574d49';
    const wellBase = MeshBuilder.CreateCylinder(`well-plinth:${team}`, { height: 10, diameterTop: 152, diameterBottom: 168, tessellation: 24 }, scene);
    wellBase.position.set(x, RIDGE_HEIGHT + 4, height / 2);
    wellBase.scaling.z = 1.85;
    wellBase.material = material(stoneCol);

    const pool = MeshBuilder.CreateCylinder(`well-pool:${team}`, { height: 11, diameter: 126, tessellation: 24 }, scene);
    pool.position.set(x, RIDGE_HEIGHT + 4.8, height / 2);
    pool.scaling.z = 1.85;
    pool.material = glowMat;

    const ring = MeshBuilder.CreateTorus(`well:${team}`, { diameter: 180, thickness: 3.5, tessellation: 64 }, scene);
    ring.scaling.z = 2.3;
    ring.position.set(x, RIDGE_HEIGHT + 6, height / 2);
    ring.material = material(accent);

    for (const [ox, oz] of [
      [-45, -135],
      [45, -135],
      [-45, 135],
      [45, 135],
    ] as const) {
      const obelisk = MeshBuilder.CreateCylinder(`well-obelisk:${team}:${ox}:${oz}`, { height: 52, diameterTop: 6, diameterBottom: 14, tessellation: 6 }, scene);
      obelisk.position.set(x + ox, RIDGE_HEIGHT + 26, height / 2 + oz);
      obelisk.material = material(stoneCol);
      const gem = MeshBuilder.CreatePolyhedron(`well-gem:${team}:${ox}:${oz}`, { type: 1, size: 6.5 }, scene);
      gem.position.set(x + ox, RIDGE_HEIGHT + 58, height / 2 + oz);
      gem.material = glowMat;
      animatedRings.push({ mesh: gem, speed: isBlue ? 1.0 : -1.0, baseY: RIDGE_HEIGHT + 58, amp: 2.5 });
    }
  }

  // 8. 3D River Wildlife: River Amber Frogs, Iridescent Dragonflies, and Pebble Crabs.
  const amberGlowMat = makeGlowMat('amber-glow-mat', '#ffaa22', '#e68a00');
  const frogSkinMat = material('#3d592b');
  const frogBellyMat = material('#c2ab4c');
  const dragonflyBodyMat = makeGlowMat('dragonfly-mat', '#38bdf8', '#0284c7');
  const dragonflyWingMat = new StandardMaterial('dragonfly-wing-mat', scene);
  dragonflyWingMat.diffuseColor = new Color3(0.8, 0.95, 1.0);
  dragonflyWingMat.alpha = 0.55;

  const animatedCritters: { update: (phase: number) => void }[] = [];

  // Spawn River Amber Frogs resting on boulders in the central chasm riverbed
  for (const [frogIdx, frogY, frogSide] of [
    [0, height / 2 - 95, 1],
    [1, height / 2 + 95, -1],
  ] as const) {
    const cx = chasmCenterX(frogY) + frogSide * 26;
    const ch = arenaGroundHeight(cx, frogY);

    const perch = MeshBuilder.CreatePolyhedron(`frog-perch:${frogIdx}`, { type: 1, size: 14 }, scene);
    perch.position.set(cx, ch + 5, frogY);
    perch.scaling.set(1.4, 0.7, 1.3);
    perch.material = material('#4d4b47');

    const frogRoot = new TransformNode(`river-frog:${frogIdx}`, scene);
    frogRoot.position.set(cx, ch + 10, frogY);
    frogRoot.rotation.y = frogSide > 0 ? -Math.PI / 3 : (2 * Math.PI) / 3;

    const frogBody = MeshBuilder.CreateSphere(`frog-body:${frogIdx}`, { diameterX: 13, diameterY: 8, diameterZ: 14, segments: 8 }, scene);
    frogBody.parent = frogRoot;
    frogBody.position.set(0, 4, 0);
    frogBody.material = frogSkinMat;

    const frogThroat = MeshBuilder.CreateSphere(`frog-throat:${frogIdx}`, { diameterX: 8, diameterY: 6, diameterZ: 7, segments: 6 }, scene);
    frogThroat.parent = frogRoot;
    frogThroat.position.set(0, 3, 5.5);
    frogThroat.material = frogBellyMat;

    for (const eyeSide of [-1, 1]) {
      const eye = MeshBuilder.CreateSphere(`frog-eye:${frogIdx}:${eyeSide}`, { diameter: 3.4, segments: 6 }, scene);
      eye.parent = frogRoot;
      eye.position.set(eyeSide * 3.5, 7.5, 4.2);
      eye.material = amberGlowMat;

      const hindLeg = MeshBuilder.CreateBox(`frog-hind:${frogIdx}:${eyeSide}`, { width: 4.5, height: 5.5, depth: 8 }, scene);
      hindLeg.parent = frogRoot;
      hindLeg.position.set(eyeSide * 6.5, 3.2, -2.5);
      hindLeg.rotation.z = eyeSide * 0.35;
      hindLeg.material = frogSkinMat;

      const frontFoot = MeshBuilder.CreateBox(`frog-front:${frogIdx}:${eyeSide}`, { width: 3, height: 1.2, depth: 4.5 }, scene);
      frontFoot.parent = frogRoot;
      frontFoot.position.set(eyeSide * 4.2, 0.6, 5.8);
      frontFoot.material = frogSkinMat;
    }

    animatedCritters.push({
      update: (phase: number) => {
        const pulse = 1 + Math.sin(phase * 3.2 + frogIdx) * 0.22;
        frogThroat.scaling.set(pulse, pulse * 1.15, pulse);
      },
    });
  }

  // Spawn Iridescent River Dragonflies hovering above the river pools
  for (let df = 0; df < 3; df++) {
    const dfY = height / 2 - 120 + df * 120;
    const dfX = chasmCenterX(dfY);
    const dfRoot = new TransformNode(`river-dragonfly:${df}`, scene);
    const dfH = arenaGroundHeight(dfX, dfY) + 18;
    dfRoot.position.set(dfX, dfH, dfY);

    const body = MeshBuilder.CreateCylinder(`df-body:${df}`, { height: 10, diameterTop: 1.2, diameterBottom: 0.6, tessellation: 6 }, scene);
    body.parent = dfRoot;
    body.rotation.x = Math.PI / 2;
    body.material = dragonflyBodyMat;

    const head = MeshBuilder.CreateSphere(`df-head:${df}`, { diameter: 2.2, segments: 6 }, scene);
    head.parent = dfRoot;
    head.position.set(0, 0, 5.5);
    head.material = goldGlowMat;

    const wings: Mesh[] = [];
    for (const wSide of [-1, 1]) {
      for (const wTier of [-1.5, 1.5]) {
        const wing = MeshBuilder.CreateBox(`df-wing:${df}:${wSide}:${wTier}`, { width: 8.5, height: 0.2, depth: 2.8 }, scene);
        wing.parent = dfRoot;
        wing.position.set(wSide * 4.5, 0.8, wTier);
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
      if (dragonMagmaMesh) {
        dragonMagmaMesh.scaling.setAll(1 + Math.sin(animPhase * 1.8) * 0.045);
      }
      for (const st of floatingGolemStones) {
        const curAng = st.baseAngle + animPhase * st.speed * 0.4;
        st.mesh.position.x = st.center.x + Math.cos(curAng) * st.orbitR;
        st.mesh.position.z = st.center.z + Math.sin(curAng) * st.orbitR;
        st.mesh.position.y = st.baseY + Math.sin(animPhase * 1.5 + st.baseAngle) * 3.5;
        st.mesh.rotation.y += 0.02;
      }
      for (const p of abyssFogPlanes) {
        p.mesh.position.x = width / 2 + Math.sin(animPhase * 0.35 + p.speed) * 16;
        p.mesh.position.y = p.baseOffset + Math.sin(animPhase * 0.5) * 1.8;
      }
      for (const critter of animatedCritters) {
        critter.update(animPhase);
      }
      for (const f of fireflies) {
        f.mesh.position.x = f.baseX + Math.sin(animPhase * 0.8 + f.phase) * 9;
        f.mesh.position.y = f.baseY + Math.cos(animPhase * 1.1 + f.phase) * 5;
        f.mesh.position.z = f.baseZ + Math.sin(animPhase * 0.6 + f.phase * 1.7) * 9;
      }
      for (const mesh of foliage) {
        mesh.isVisible = !actors.some(
          a => a.kind === 'champion' && a.alive && Math.hypot(a.x - mesh.position.x, a.y - mesh.position.z) < 65,
        );
      }
      for (const b of bushClusters) {
        const occupied = actors.some(
          a => a.kind === 'champion' && a.alive && Math.hypot(a.x - b.x, a.y - b.y) < 65,
        );
        b.mesh.scaling.y = occupied ? b.baseH * 0.42 : b.baseH;
      }
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
        halo.rotation.y += dt * 1.2;
        core.position.y = 84 + Math.sin(sec * 2.4) * 4;
        core.rotation.y += dt * 1.5;
        pylonShards.forEach((p, idx) => {
          p.position.y = 68 + Math.sin(sec * 3.5 + idx * 1.4) * 2.5;
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
    animate = (a, sec) => {
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
    height = 26;
    cylinder('ward-base', 10, 6, 3, stone, 7);
    cylinder('ward-stalk', 6, 16, 12, metal, 4);
    const eye = orb('eye', 5.5, 0, 24, 0, glow);
    animate = (a, sec) => {
      if (!a.alive) { body.scaling.y = 0.2; return; }
      eye.scaling.setAll(1 + Math.sin(sec * 4) * 0.15);
    };
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
