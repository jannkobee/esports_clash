import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { ChampionKit, CoachCard, ItemDef, PlayerCard } from '../types';
import { getRecommendedItem } from '../itemsData';
import { sound } from '../audio';
import confetti from 'canvas-confetti';
import { 
  Play, 
  Pause, 
  Eye,
  Camera,
  RotateCcw
} from 'lucide-react';

// =========================================================================
// TYPES & 3-LANE MOBA DEFINITIONS
// =========================================================================

export type MobaLane = 'top' | 'mid' | 'bot' | 'roam';

interface CombatUnit3D {
  id: string;
  player: PlayerCard;
  champion: ChampionKit;
  team: 'blue' | 'red';
  lane: MobaLane;
  x: number;
  z: number;
  y: number;
  vx: number;
  vz: number;
  targetId: string | null;
  hp: number;
  maxHp: number;
  mana: number;
  shield: number;
  level: number;
  xp: number;
  gold: number;
  items: ItemDef[];
  kills: number;
  deaths: number;
  assists: number;
  cs: number;
  damageDealt: number;
  isAlive: boolean;
  respawnTimer: number;
  attackTimer: number;
  attackRange: number; // Authentic 3D combat range (3.5 for melee to 16.0 for Astra!)
  kiteTimer: number;
  animState: 'idle' | 'walk' | 'attack' | 'cast' | 'dead';
  animTimer: number;
  // 3D Objects & Meshes
  rootMesh: THREE.Group;
  dropShadowMesh: THREE.Mesh;
  billboardCanvas: HTMLCanvasElement;
  billboardTexture: THREE.CanvasTexture;
  billboardMesh: THREE.Sprite;
  // Champion specific 3D references
  tailMeshes?: THREE.Mesh[];
  orbGroup?: THREE.Group;
  weaponMesh?: THREE.Object3D;
  auraMesh?: THREE.Mesh;
}

interface Minion3D {
  id: string;
  team: 'blue' | 'red';
  lane: MobaLane;
  type: 'melee' | 'caster' | 'cannon';
  waypointIndex: number;
  x: number;
  z: number;
  y: number;
  hp: number;
  maxHp: number;
  ad: number;
  range: number;
  speed: number;
  attackTimer: number;
  isAlive: boolean;
  goldReward: number;
  xpReward: number;
  rootMesh: THREE.Group;
}

interface Structure3D {
  id: string;
  team: 'blue' | 'red';
  lane: MobaLane | 'nexus';
  type: 'outer_tower' | 'inner_tower' | 'nexus_tower' | 'nexus';
  name: string;
  x: number;
  z: number;
  y: number;
  hp: number;
  maxHp: number;
  ad: number;
  range: number;
  attackTimer: number;
  isAlive: boolean;
  targetId: string | null;
  rootMesh: THREE.Group;
  crystalMesh: THREE.Mesh;
}

interface Relic3D {
  id: string;
  x: number;
  z: number;
  y: number;
  respawnTimer: number;
  healAmount: number;
  rootMesh: THREE.Group;
  crystalMesh: THREE.Mesh;
}

interface Projectile3D {
  id: string;
  x: number;
  y: number;
  z: number;
  targetX: number;
  targetY: number;
  targetZ: number;
  speed: number;
  mesh: THREE.Object3D;
  targetUnitId?: string;
  damage: number;
  attackerId: string;
  team: 'blue' | 'red';
  type: 'arrow' | 'orb' | 'pellet' | 'turret_shot';
}

interface FloatingText3D {
  id: string;
  mesh: THREE.Sprite;
  yStart: number;
  timer: number;
  maxTimer: number;
}

interface ThreeAramArenaProps {
  blueLineup: { player: PlayerCard; champion: ChampionKit }[];
  redLineup: { player: PlayerCard; champion: ChampionKit }[];
  blueCoach?: CoachCard;
  redCoach?: CoachCard;
  onMatchComplete: (winner: 'blue' | 'red', mvp: any, stats: any[]) => void;
}

// 3-Lane Waypoint Routes for Creeps and Pathing
const LANE_WAYPOINTS: { [lane in 'top' | 'mid' | 'bot']: { blue: [number, number][]; red: [number, number][] } } = {
  top: {
    blue: [
      [-42, 0], [-36, -14], [-28, -20], [-15, -22], [0, -22], [15, -22], [28, -20], [36, -14], [42, 0]
    ],
    red: [
      [42, 0], [36, -14], [28, -20], [15, -22], [0, -22], [-15, -22], [-28, -20], [-36, -14], [-42, 0]
    ]
  },
  mid: {
    blue: [
      [-42, 0], [-30, 0], [-20, 0], [-10, 0], [0, 0], [10, 0], [20, 0], [30, 0], [42, 0]
    ],
    red: [
      [42, 0], [30, 0], [20, 0], [10, 0], [0, 0], [-10, 0], [-20, 0], [-30, 0], [-42, 0]
    ]
  },
  bot: {
    blue: [
      [-42, 0], [-36, 14], [-28, 20], [-15, 22], [0, 22], [15, 22], [28, 20], [36, 14], [42, 0]
    ],
    red: [
      [42, 0], [36, 14], [28, 20], [15, 22], [0, 22], [-15, 22], [-28, 20], [-36, 14], [-42, 0]
    ]
  }
};

// Calculate terrain elevation Y based on X and Z coordinates
function getTerrainElevation(x: number, z: number): number {
  // Center river channel cuts vertically between X: -6 and X: +6
  const inRiver = Math.abs(x) < 5.5;
  if (inRiver) {
    // 3 River bridges have higher elevation for crossing
    const onTopBridge = Math.abs(z - (-22)) < 3.5;
    const onMidBridge = Math.abs(z - 0) < 4.0;
    const onBotBridge = Math.abs(z - 22) < 3.5;
    if (onTopBridge || onMidBridge || onBotBridge) {
      return 0.8;
    }
    return -1.2; // Low ground waterbed
  }
  return 0.8; // High ground
}

// =========================================================================
// PROCEDURAL ANIME CHIBI FACE TEXTURE GENERATOR
// =========================================================================

function createChibiAnimeFaceTexture(champName: string): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = '#fff1ee';
  ctx.fillRect(0, 0, 512, 512);

  // Soft Rosy Cheek Blush
  const blushGradL = ctx.createRadialGradient(140, 310, 5, 140, 310, 55);
  blushGradL.addColorStop(0, 'rgba(251, 113, 133, 0.55)');
  blushGradL.addColorStop(1, 'rgba(251, 113, 133, 0)');
  ctx.fillStyle = blushGradL;
  ctx.beginPath(); ctx.arc(140, 310, 55, 0, Math.PI * 2); ctx.fill();

  const blushGradR = ctx.createRadialGradient(372, 310, 5, 372, 310, 55);
  blushGradR.addColorStop(0, 'rgba(251, 113, 133, 0.55)');
  blushGradR.addColorStop(1, 'rgba(251, 113, 133, 0)');
  ctx.fillStyle = blushGradR;
  ctx.beginPath(); ctx.arc(372, 310, 55, 0, Math.PI * 2); ctx.fill();

  if (champName === 'Kyumi') {
    // Red Shrine Whiskers
    ctx.strokeStyle = '#e11d48';
    ctx.lineWidth = 6;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(70, 290); ctx.lineTo(135, 296);
    ctx.moveTo(60, 312); ctx.lineTo(130, 314);
    ctx.moveTo(70, 334); ctx.lineTo(135, 330);
    ctx.moveTo(442, 290); ctx.lineTo(377, 296);
    ctx.moveTo(452, 312); ctx.lineTo(382, 314);
    ctx.moveTo(442, 334); ctx.lineTo(377, 330);
    ctx.stroke();

    // Golden Anime Eyes with Winged Fox Eyeliner
    const drawEye = (cx: number, cy: number, flip: boolean) => {
      ctx.save();
      ctx.translate(cx, cy);
      if (flip) ctx.scale(-1, 1);
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.moveTo(-65, 0); ctx.quadraticCurveTo(0, -60, 65, -15); ctx.quadraticCurveTo(20, 50, -65, 0);
      ctx.fill();

      const irisGrad = ctx.createRadialGradient(5, 5, 5, 5, 5, 50);
      irisGrad.addColorStop(0, '#fef08a');
      irisGrad.addColorStop(0.4, '#f59e0b');
      irisGrad.addColorStop(0.85, '#d97706');
      irisGrad.addColorStop(1, '#9a3412');
      ctx.fillStyle = irisGrad;
      ctx.beginPath(); ctx.arc(5, 0, 42, 0, Math.PI * 2); ctx.fill();

      ctx.fillStyle = '#18181b';
      ctx.beginPath(); ctx.arc(5, 2, 22, 0, Math.PI * 2); ctx.fill();

      ctx.fillStyle = '#ffffff';
      ctx.beginPath(); ctx.arc(-8, -12, 14, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(18, 14, 7, 0, Math.PI * 2); ctx.fill();

      ctx.strokeStyle = '#0f172a';
      ctx.lineWidth = 14;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(-70, 0); ctx.quadraticCurveTo(-10, -68, 75, -20);
      ctx.stroke();
      ctx.restore();
    };

    drawEye(160, 220, false);
    drawEye(352, 220, true);

    ctx.fillStyle = '#be123c';
    ctx.beginPath();
    ctx.moveTo(226, 360); ctx.quadraticCurveTo(256, 385, 286, 360); ctx.quadraticCurveTo(256, 366, 226, 360);
    ctx.fill();
  } else if (champName === 'Astra') {
    // Frost Sapphire Eyes
    const drawEye = (cx: number, cy: number, flip: boolean) => {
      ctx.save();
      ctx.translate(cx, cy);
      if (flip) ctx.scale(-1, 1);
      ctx.fillStyle = '#ffffff';
      ctx.beginPath(); ctx.arc(0, 0, 48, 0, Math.PI * 2); ctx.fill();
      const fGrad = ctx.createRadialGradient(0, 0, 4, 0, 0, 40);
      fGrad.addColorStop(0, '#e0f2fe'); fGrad.addColorStop(0.5, '#0284c7'); fGrad.addColorStop(1, '#0c4a6e');
      ctx.fillStyle = fGrad;
      ctx.beginPath(); ctx.arc(0, 0, 38, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#082f49';
      ctx.beginPath(); ctx.arc(0, 0, 18, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#ffffff';
      ctx.beginPath(); ctx.arc(-8, -10, 12, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = '#0f172a';
      ctx.lineWidth = 12;
      ctx.beginPath(); ctx.moveTo(-50, -8); ctx.quadraticCurveTo(0, -48, 50, -14); ctx.stroke();
      ctx.restore();
    };
    drawEye(165, 230, false);
    drawEye(347, 230, true);
    ctx.strokeStyle = '#0369a1';
    ctx.lineWidth = 5;
    ctx.beginPath(); ctx.moveTo(236, 368); ctx.lineTo(276, 368); ctx.stroke();
  } else if (champName === 'Solana') {
    // Golden Solar Eyes
    const drawEye = (cx: number, cy: number, flip: boolean) => {
      ctx.save();
      ctx.translate(cx, cy);
      if (flip) ctx.scale(-1, 1);
      ctx.fillStyle = '#ffffff';
      ctx.beginPath(); ctx.arc(0, 0, 48, 0, Math.PI * 2); ctx.fill();
      const sGrad = ctx.createRadialGradient(0, 0, 4, 0, 0, 40);
      sGrad.addColorStop(0, '#fef08a'); sGrad.addColorStop(0.6, '#eab308'); sGrad.addColorStop(1, '#ca8a04');
      ctx.fillStyle = sGrad;
      ctx.beginPath(); ctx.arc(0, 0, 38, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#713f12';
      ctx.beginPath(); ctx.arc(0, 0, 18, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#ffffff';
      ctx.beginPath(); ctx.arc(-8, -10, 12, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = '#1c1917';
      ctx.lineWidth = 12;
      ctx.beginPath(); ctx.moveTo(-50, -10); ctx.quadraticCurveTo(0, -50, 50, -18); ctx.stroke();
      ctx.restore();
    };
    drawEye(165, 230, false);
    drawEye(347, 230, true);
    ctx.strokeStyle = '#991b1b';
    ctx.lineWidth = 6;
    ctx.beginPath(); ctx.moveTo(230, 365); ctx.quadraticCurveTo(256, 380, 282, 365); ctx.stroke();
  } else if (champName === 'Buck') {
    // Stubble Beard & Rugged Eyes
    ctx.fillStyle = 'rgba(68, 64, 60, 0.45)';
    ctx.beginPath(); ctx.arc(256, 350, 95, 0, Math.PI); ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(125, 210, 70, 35); ctx.fillRect(317, 210, 70, 35);
    ctx.fillStyle = '#78350f';
    ctx.beginPath(); ctx.arc(160, 227, 22, 0, Math.PI * 2); ctx.arc(352, 227, 22, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#292524';
    ctx.fillRect(115, 180, 90, 18); ctx.fillRect(307, 180, 90, 18);
    // Cigar
    ctx.fillStyle = '#78350f'; ctx.fillRect(282, 350, 48, 14);
    ctx.fillStyle = '#ea580c'; ctx.fillRect(326, 350, 8, 14);
  } else {
    // Valkira War Paint & Ruby Eyes
    ctx.fillStyle = '#be123c';
    ctx.beginPath();
    ctx.moveTo(90, 260); ctx.lineTo(190, 290); ctx.lineTo(190, 305); ctx.lineTo(90, 275); ctx.fill();
    ctx.moveTo(422, 260); ctx.lineTo(322, 290); ctx.lineTo(322, 305); ctx.lineTo(422, 275); ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.beginPath(); ctx.arc(165, 230, 44, 0, Math.PI * 2); ctx.arc(347, 230, 44, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#e11d48';
    ctx.beginPath(); ctx.arc(165, 230, 32, 0, Math.PI * 2); ctx.arc(347, 230, 32, 0, Math.PI * 2); ctx.fill();
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

// =========================================================================
// PROCEDURAL 3D CHIBI CHAMPION BUILDER
// =========================================================================

function buildChibiChampion3D(champion: ChampionKit, team: 'blue' | 'red') {
  const root = new THREE.Group();

  // Drop Shadow
  const shadowCanvas = document.createElement('canvas');
  shadowCanvas.width = 128; shadowCanvas.height = 128;
  const sCtx = shadowCanvas.getContext('2d')!;
  const sGrad = sCtx.createRadialGradient(64, 64, 10, 64, 64, 60);
  sGrad.addColorStop(0, 'rgba(0, 0, 0, 0.7)');
  sGrad.addColorStop(0.5, 'rgba(0, 0, 0, 0.35)');
  sGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
  sCtx.fillStyle = sGrad;
  sCtx.beginPath(); sCtx.arc(64, 64, 60, 0, Math.PI * 2); sCtx.fill();

  const shadowTex = new THREE.CanvasTexture(shadowCanvas);
  const shadowGeo = new THREE.PlaneGeometry(2.6, 2.6);
  const shadowMat = new THREE.MeshBasicMaterial({ map: shadowTex, transparent: true, depthWrite: false, opacity: 0.85 });
  const dropShadow = new THREE.Mesh(shadowGeo, shadowMat);
  dropShadow.rotation.x = -Math.PI / 2;
  dropShadow.position.y = 0.04;
  root.add(dropShadow);

  // Team Ring
  const teamRingGeo = new THREE.RingGeometry(1.2, 1.45, 24);
  const teamRingMat = new THREE.MeshBasicMaterial({ color: team === 'blue' ? 0x38bdf8 : 0xf43f5e, side: THREE.DoubleSide });
  const teamRing = new THREE.Mesh(teamRingGeo, teamRingMat);
  teamRing.rotation.x = -Math.PI / 2;
  teamRing.position.y = 0.05;
  root.add(teamRing);

  // Body container
  const bodyGroup = new THREE.Group();
  bodyGroup.position.y = 1.35;
  root.add(bodyGroup);

  let tailMeshes: THREE.Mesh[] | undefined;
  let orbGroup: THREE.Group | undefined;
  let weaponMesh: THREE.Object3D | undefined;
  let auraMesh: THREE.Mesh | undefined;

  const faceTexture = createChibiAnimeFaceTexture(champion.name);

  if (champion.name === 'Kyumi') {
    // KYUMI (CHIBI AHRI)
    const head = new THREE.Mesh(
      new THREE.SphereGeometry(1.05, 32, 32),
      new THREE.MeshStandardMaterial({ map: faceTexture, roughness: 0.45, metalness: 0.05 })
    );
    head.position.set(0, 1.45, 0);
    head.rotation.y = Math.PI;
    head.castShadow = true;
    bodyGroup.add(head);

    // Midnight Navy Hair
    const hairMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.35 });
    const hairDome = new THREE.Mesh(new THREE.SphereGeometry(1.12, 24, 24, 0, Math.PI * 2, 0, Math.PI / 1.7), hairMat);
    hairDome.position.set(0, 1.5, -0.05);
    bodyGroup.add(hairDome);

    // Fox Ears
    [-0.48, 0.48].forEach((ex) => {
      const ear = new THREE.Mesh(new THREE.ConeGeometry(0.3, 0.85, 4), hairMat);
      ear.position.set(ex, 2.5, 0.1);
      ear.rotation.z = -ex * 0.35;
      bodyGroup.add(ear);
    });

    // Kimono Torso
    const torso = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.42, 0.9, 16), new THREE.MeshStandardMaterial({ color: 0xffffff }));
    torso.position.set(0, 0.45, 0);
    bodyGroup.add(torso);

    // 9 Bushy Fox Tails
    const tails: THREE.Mesh[] = [];
    const tailMat = new THREE.MeshStandardMaterial({ color: 0xfdf4ff, emissive: 0x38bdf8, emissiveIntensity: 0.25, roughness: 0.25 });
    for (let i = 0; i < 9; i++) {
      const angle = -Math.PI * 0.72 + (i / 8) * (Math.PI * 0.88);
      const tail = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.52, 3.2, 12), tailMat);
      tail.position.set(Math.sin(angle) * 1.0, 0.4 + (1 - Math.abs(angle) / (Math.PI * 0.7)) * 0.6, -0.6 - Math.cos(angle) * 0.7);
      tail.rotation.x = -0.55;
      tail.rotation.z = -angle * 0.85;
      tail.castShadow = true;
      bodyGroup.add(tail);
      tails.push(tail);
    }
    tailMeshes = tails;

    // Luminous Spirit Orb
    const orbContainer = new THREE.Group();
    orbContainer.position.set(0, 0.8, 1.6);
    const orbCore = new THREE.Mesh(
      new THREE.SphereGeometry(0.48, 24, 24),
      new THREE.MeshStandardMaterial({ color: 0x67e8f9, emissive: 0x00f2ff, emissiveIntensity: 2.4 })
    );
    orbContainer.add(orbCore);
    const orbLight = new THREE.PointLight(0x00f2ff, 2.2, 5);
    orbContainer.add(orbLight);
    bodyGroup.add(orbContainer);
    orbGroup = orbContainer;

    // Glowing Aura
    const aura = new THREE.Mesh(
      new THREE.TorusGeometry(1.65, 0.06, 16, 48),
      new THREE.MeshBasicMaterial({ color: 0x00f2ff, transparent: true, opacity: 0.85 })
    );
    aura.rotation.x = Math.PI / 2.3;
    aura.position.set(0, 0.4, 0);
    bodyGroup.add(aura);
    auraMesh = aura;

  } else if (champion.name === 'Astra') {
    // ASTRA (CHIBI ASHE)
    const head = new THREE.Mesh(
      new THREE.SphereGeometry(1.05, 32, 32),
      new THREE.MeshStandardMaterial({ map: faceTexture, roughness: 0.45 })
    );
    head.position.set(0, 1.45, 0);
    head.rotation.y = Math.PI;
    head.castShadow = true;
    bodyGroup.add(head);

    const hair = new THREE.Mesh(new THREE.SphereGeometry(1.12, 24, 24, 0, Math.PI * 2, 0, Math.PI / 1.7), new THREE.MeshStandardMaterial({ color: 0xf8fafc }));
    hair.position.set(0, 1.5, -0.05);
    bodyGroup.add(hair);

    const bowGroup = new THREE.Group();
    bowGroup.position.set(1.0, 0.6, 0.6);
    const bowArc = new THREE.Mesh(
      new THREE.TorusGeometry(1.4, 0.12, 8, 32, Math.PI * 0.8),
      new THREE.MeshStandardMaterial({ color: 0x38bdf8, emissive: 0x0284c7, emissiveIntensity: 0.8 })
    );
    bowArc.rotation.z = Math.PI / 4;
    bowGroup.add(bowArc);
    bodyGroup.add(bowGroup);
    weaponMesh = bowGroup;

  } else if (champion.name === 'Solana') {
    // SOLANA (CHIBI LEONA)
    const head = new THREE.Mesh(
      new THREE.SphereGeometry(1.05, 32, 32),
      new THREE.MeshStandardMaterial({ map: faceTexture, roughness: 0.45 })
    );
    head.position.set(0, 1.45, 0);
    head.rotation.y = Math.PI;
    head.castShadow = true;
    bodyGroup.add(head);

    // Shield
    const shield = new THREE.Mesh(new THREE.BoxGeometry(0.25, 2.4, 1.6), new THREE.MeshStandardMaterial({ color: 0xf59e0b, metalness: 0.85 }));
    shield.position.set(-1.1, 0.5, 0.4);
    bodyGroup.add(shield);

    // Lance
    const lance = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 3.6), new THREE.MeshStandardMaterial({ color: 0x78350f }));
    lance.position.set(1.1, 0.5, 0.4);
    lance.rotation.x = Math.PI / 3;
    bodyGroup.add(lance);
    weaponMesh = lance;

  } else if (champion.name === 'Buck') {
    // BUCK (CHIBI GRAVES)
    const head = new THREE.Mesh(
      new THREE.SphereGeometry(1.05, 32, 32),
      new THREE.MeshStandardMaterial({ map: faceTexture, roughness: 0.5 })
    );
    head.position.set(0, 1.45, 0);
    head.rotation.y = Math.PI;
    head.castShadow = true;
    bodyGroup.add(head);

    // Cowboy Hat
    const brim = new THREE.Mesh(new THREE.CylinderGeometry(1.8, 1.8, 0.12, 24), new THREE.MeshStandardMaterial({ color: 0x451a03 }));
    brim.position.set(0, 2.3, 0);
    bodyGroup.add(brim);

    // Double Barrel Shotgun
    const gun = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.45, 1.6), new THREE.MeshStandardMaterial({ color: 0x292524, metalness: 0.9 }));
    gun.position.set(0.9, 0.4, 0.8);
    bodyGroup.add(gun);
    weaponMesh = gun;

  } else {
    // VALKIRA (CHIBI AMBESSA)
    const head = new THREE.Mesh(
      new THREE.SphereGeometry(1.05, 32, 32),
      new THREE.MeshStandardMaterial({ map: faceTexture, roughness: 0.45 })
    );
    head.position.set(0, 1.45, 0);
    head.rotation.y = Math.PI;
    head.castShadow = true;
    bodyGroup.add(head);

    // Crescent Blades
    const blades = new THREE.Group();
    blades.position.set(0, 0.4, 0.8);
    [-0.8, 0.8].forEach((bx) => {
      const b = new THREE.Mesh(new THREE.TorusGeometry(0.65, 0.08, 8, 24, Math.PI), new THREE.MeshStandardMaterial({ color: 0xe11d48, emissive: 0xbe123c }));
      b.position.set(bx, 0, 0);
      b.rotation.y = Math.PI / 2;
      blades.add(b);
    });
    bodyGroup.add(blades);
    weaponMesh = blades;
  }

  // 3D Overhead MOBA Billboard
  const billboardCanvas = document.createElement('canvas');
  billboardCanvas.width = 256;
  billboardCanvas.height = 128;
  const billboardTexture = new THREE.CanvasTexture(billboardCanvas);
  const billboard = new THREE.Sprite(new THREE.SpriteMaterial({ map: billboardTexture, transparent: true, depthTest: false }));
  billboard.position.set(0, 4.4, 0);
  billboard.scale.set(3.2, 1.6, 1);
  root.add(billboard);

  return {
    root,
    dropShadow,
    billboardCanvas,
    billboardTexture,
    billboardMesh: billboard,
    tailMeshes,
    orbGroup,
    weaponMesh,
    auraMesh
  };
}

// Build 3D Map for 3 Lanes (Top, Mid, Bot + River + Jungle)
function build3LaneDotaMap(scene: THREE.Scene) {
  const mapGroup = new THREE.Group();

  // 1. TERRAIN BASE (Wide MOBA Ground: X: -50 to 50, Z: -36 to 36)
  // Radiant Emerald Side
  const radTerrain = new THREE.Mesh(
    new THREE.BoxGeometry(45, 2.0, 72),
    new THREE.MeshStandardMaterial({ color: 0x22543d, roughness: 0.75 })
  );
  radTerrain.position.set(-27.5, -0.2, 0);
  radTerrain.receiveShadow = true;
  mapGroup.add(radTerrain);

  // Dire Volcanic Basalt Side
  const direTerrain = new THREE.Mesh(
    new THREE.BoxGeometry(45, 2.0, 72),
    new THREE.MeshStandardMaterial({ color: 0x1c1917, roughness: 0.85 })
  );
  direTerrain.position.set(27.5, -0.2, 0);
  direTerrain.receiveShadow = true;
  mapGroup.add(direTerrain);

  // 2. THE 3 LANES (Cobblestone Paths)
  // A. Mid Lane Highway (Z: 0)
  const midRoad = new THREE.Mesh(new THREE.BoxGeometry(84, 0.12, 7.5), new THREE.MeshStandardMaterial({ color: 0x785338, roughness: 0.8 }));
  midRoad.position.set(0, 0.85, 0);
  midRoad.receiveShadow = true;
  mapGroup.add(midRoad);

  // B. Top Lane Highway (Z: -22)
  const topRoad = new THREE.Mesh(new THREE.BoxGeometry(78, 0.12, 6.5), new THREE.MeshStandardMaterial({ color: 0x785338, roughness: 0.8 }));
  topRoad.position.set(0, 0.85, -22);
  topRoad.receiveShadow = true;
  mapGroup.add(topRoad);

  // C. Bot Lane Highway (Z: +22)
  const botRoad = new THREE.Mesh(new THREE.BoxGeometry(78, 0.12, 6.5), new THREE.MeshStandardMaterial({ color: 0x785338, roughness: 0.8 }));
  botRoad.position.set(0, 0.85, 22);
  botRoad.receiveShadow = true;
  mapGroup.add(botRoad);

  // 3. CENTER DOTA RIVERBED & 3D WATER SURFACE (X: -5.5 to +5.5, Z: -36 to +36)
  const riverBed = new THREE.Mesh(new THREE.BoxGeometry(11, 2.0, 72), new THREE.MeshStandardMaterial({ color: 0x1f2937 }));
  riverBed.position.set(0, -2.2, 0);
  riverBed.receiveShadow = true;
  mapGroup.add(riverBed);

  const waterMesh = new THREE.Mesh(
    new THREE.PlaneGeometry(11, 72),
    new THREE.MeshStandardMaterial({ color: 0x0284c7, roughness: 0.1, transparent: true, opacity: 0.85 })
  );
  waterMesh.rotation.x = -Math.PI / 2;
  waterMesh.position.set(0, -0.4, 0);
  mapGroup.add(waterMesh);

  // 3 River Bridges (Top, Mid, Bot Crossing)
  [-22, 0, 22].forEach((bz) => {
    const bridge = new THREE.Mesh(new THREE.BoxGeometry(11.5, 0.25, 7.0), new THREE.MeshStandardMaterial({ color: 0x475569 }));
    bridge.position.set(0, 0.85, bz);
    bridge.receiveShadow = true;
    mapGroup.add(bridge);
  });

  // 4. JUNGLE TREES CLUSTERS BETWEEN LANES
  const treeMat = new THREE.MeshStandardMaterial({ color: 0x15803d, roughness: 0.7 });
  const trunkMat = new THREE.MeshStandardMaterial({ color: 0x451a03 });
  
  // Jungle clusters between Top and Mid, Mid and Bot
  [-11, 11].forEach((jz) => {
    for (let x = -30; x <= 30; x += 8) {
      if (Math.abs(x) < 7) continue; // Skip river
      const tree = new THREE.Group();
      tree.position.set(x, 0.8, jz + (Math.sin(x) * 2));
      const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.45, 3.2, 8), trunkMat);
      trunk.position.y = 1.6;
      tree.add(trunk);
      const foliage = new THREE.Mesh(new THREE.ConeGeometry(2.2, 3.5, 7), treeMat);
      foliage.position.y = 4.0;
      tree.add(foliage);
      mapGroup.add(tree);
    }
  });

  // 5. RADIANT & DIRE FOUNTAINS (HEALING WELLS)
  // Radiant Fountain (X: -44, Z: 0)
  const radFountain = new THREE.Mesh(new THREE.CylinderGeometry(5.5, 6.0, 0.4, 24), new THREE.MeshStandardMaterial({ color: 0xf1f5f9 }));
  radFountain.position.set(-44, 1.0, 0);
  mapGroup.add(radFountain);
  const radSpire = new THREE.Mesh(new THREE.OctahedronGeometry(1.6), new THREE.MeshStandardMaterial({ color: 0x38bdf8, emissive: 0x00f2ff, emissiveIntensity: 1.5 }));
  radSpire.position.set(-44, 4.2, 0);
  mapGroup.add(radSpire);

  // Dire Fountain (X: +44, Z: 0)
  const direFountain = new THREE.Mesh(new THREE.CylinderGeometry(5.5, 6.0, 0.4, 24), new THREE.MeshStandardMaterial({ color: 0x18181b }));
  direFountain.position.set(44, 1.0, 0);
  mapGroup.add(direFountain);
  const direSpire = new THREE.Mesh(new THREE.OctahedronGeometry(1.6), new THREE.MeshStandardMaterial({ color: 0xf43f5e, emissive: 0xe11d48, emissiveIntensity: 1.5 }));
  direSpire.position.set(44, 4.2, 0);
  mapGroup.add(direSpire);

  scene.add(mapGroup);
  return { waterMesh };
}

// Build 3D Tower
function buildTower3D(team: 'blue' | 'red', x: number, z: number): { root: THREE.Group; crystal: THREE.Mesh } {
  const root = new THREE.Group();
  const y = getTerrainElevation(x, z);
  root.position.set(x, y, z);

  const isBlue = team === 'blue';
  const shaft = new THREE.Mesh(
    new THREE.CylinderGeometry(1.3, 1.6, 5.2, 12),
    new THREE.MeshStandardMaterial({ color: isBlue ? 0xf8fafc : 0x18181b, roughness: 0.7 })
  );
  shaft.position.y = 2.6;
  shaft.castShadow = true;
  root.add(shaft);

  const crystal = new THREE.Mesh(
    new THREE.OctahedronGeometry(1.1),
    new THREE.MeshStandardMaterial({
      color: isBlue ? 0x00f2ff : 0xff0055,
      emissive: isBlue ? 0x00f2ff : 0xff0055,
      emissiveIntensity: 1.5
    })
  );
  crystal.position.y = 6.0;
  crystal.castShadow = true;
  root.add(crystal);

  return { root, crystal };
}

// Build 3D Minion
function buildMinion3D(team: 'blue' | 'red', type: 'melee' | 'caster' | 'cannon'): THREE.Group {
  const root = new THREE.Group();
  const color = team === 'blue' ? 0x2563eb : 0xdc2626;

  if (type === 'caster') {
    const robe = new THREE.Mesh(new THREE.ConeGeometry(0.5, 1.1, 8), new THREE.MeshStandardMaterial({ color }));
    robe.position.y = 0.55;
    root.add(robe);
    const orb = new THREE.Mesh(new THREE.SphereGeometry(0.16), new THREE.MeshBasicMaterial({ color: team === 'blue' ? 0x00f2ff : 0xff0055 }));
    orb.position.set(0.3, 1.2, 0.2);
    root.add(orb);
  } else {
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.8, 0.5), new THREE.MeshStandardMaterial({ color }));
    body.position.y = 0.5;
    root.add(body);
    const shield = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.7, 0.45), new THREE.MeshStandardMaterial({ color: 0x64748b }));
    shield.position.set(-0.35, 0.5, 0.2);
    root.add(shield);
  }

  return root;
}

// =========================================================================
// MAIN 3D 3-LANE DOTA MATCH COMPONENT
// =========================================================================

export const ThreeAramArena: React.FC<ThreeAramArenaProps> = ({
  blueLineup,
  redLineup,
  onMatchComplete
}) => {
  const mountRef = useRef<HTMLDivElement>(null);
  const [speed, setSpeed] = useState<number>(1);
  const [paused, setPaused] = useState<boolean>(false);
  const [matchTime, setMatchTime] = useState<number>(0);
  const [matchOver, setMatchOver] = useState<boolean>(false);
  const [cameraFocus, setCameraFocus] = useState<'map' | 'mid' | 'top' | 'bot' | 'flaker' | 'orbit'>('mid');

  // Scoreboard
  const [blueKills, setBlueKills] = useState<number>(0);
  const [redKills, setRedKills] = useState<number>(0);
  const [blueGold, setBlueGold] = useState<number>(7000);
  const [redGold, setRedGold] = useState<number>(7000);

  // Simulation Refs
  const unitsRef = useRef<CombatUnit3D[]>([]);
  const minionsRef = useRef<Minion3D[]>([]);
  const structuresRef = useRef<Structure3D[]>([]);
  const relicsRef = useRef<Relic3D[]>([]);
  const projectilesRef = useRef<Projectile3D[]>([]);
  const floatingTextsRef = useRef<FloatingText3D[]>([]);
  const waveTimerRef = useRef<number>(2.0);

  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const controlsRef = useRef<OrbitControls | null>(null);
  const waterMeshRef = useRef<THREE.Mesh | null>(null);

  // Spawn 3D Floating Text
  const spawnFloatingText = (scene: THREE.Scene, text: string, color: string, x: number, y: number, z: number) => {
    const canvas = document.createElement('canvas');
    canvas.width = 256; canvas.height = 64;
    const ctx = canvas.getContext('2d')!;
    ctx.fillStyle = color;
    ctx.font = 'bold 36px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(text, 128, 48);

    const texture = new THREE.CanvasTexture(canvas);
    const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: texture, transparent: true, depthTest: false }));
    sprite.position.set(x, y + 1.6, z);
    sprite.scale.set(3, 0.75, 1);
    scene.add(sprite);

    floatingTextsRef.current.push({
      id: Math.random().toString(),
      mesh: sprite,
      yStart: y + 1.6,
      timer: 0,
      maxTimer: 1.2
    });
  };

  useEffect(() => {
    if (!mountRef.current) return;
    const container = mountRef.current;
    const width = container.clientWidth;
    const height = container.clientHeight || 560;

    // 1. SCENE & CAMERA SETUP
    const scene = new THREE.Scene();
    sceneRef.current = scene;
    scene.background = new THREE.Color(0x0c1e18);
    scene.fog = new THREE.FogExp2(0x0c1e18, 0.007);

    const camera = new THREE.PerspectiveCamera(40, width / height, 0.5, 600);
    camera.position.set(0, 42, 40);
    camera.lookAt(0, 0, 0);
    cameraRef.current = camera;

    // 2. UNREAL-GRADE PBR RENDERER
    const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.15;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFShadowMap;
    container.innerHTML = '';
    container.appendChild(renderer.domElement);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    controls.maxPolarAngle = Math.PI / 2.1;
    controls.minDistance = 6;
    controls.maxDistance = 110;
    controlsRef.current = controls;

    // 3. PBR LIGHTING PIPELINE
    const sunLight = new THREE.DirectionalLight(0xfffaed, 2.2);
    sunLight.position.set(-30, 52, 24);
    sunLight.castShadow = true;
    sunLight.shadow.mapSize.width = 2048;
    sunLight.shadow.mapSize.height = 2048;
    sunLight.shadow.camera.near = 10;
    sunLight.shadow.camera.far = 140;
    sunLight.shadow.camera.left = -60;
    sunLight.shadow.camera.right = 60;
    sunLight.shadow.camera.top = 60;
    sunLight.shadow.camera.bottom = -60;
    scene.add(sunLight);

    const hemiLight = new THREE.HemisphereLight(0x93c5fd, 0x3f6212, 1.2);
    scene.add(hemiLight);

    // 4. BUILD 3-LANE DOTA MAP
    const mapData = build3LaneDotaMap(scene);
    waterMeshRef.current = mapData.waterMesh;

    // 5. BUILD TOWERS ON ALL 3 LANES
    const initStructures: Structure3D[] = [];
    const towerLayout: { team: 'blue' | 'red'; lane: MobaLane; type: any; name: string; x: number; z: number }[] = [
      // TOP LANE TOWERS
      { team: 'blue', lane: 'top', type: 'outer_tower', name: 'Blue Top T1', x: -15, z: -22 },
      { team: 'blue', lane: 'top', type: 'inner_tower', name: 'Blue Top T2', x: -28, z: -20 },
      { team: 'blue', lane: 'top', type: 'nexus_tower', name: 'Blue Top T3', x: -35, z: -15 },
      { team: 'red', lane: 'top', type: 'outer_tower', name: 'Red Top T1', x: 15, z: -22 },
      { team: 'red', lane: 'top', type: 'inner_tower', name: 'Red Top T2', x: 28, z: -20 },
      { team: 'red', lane: 'top', type: 'nexus_tower', name: 'Red Top T3', x: 35, z: -15 },

      // MID LANE TOWERS
      { team: 'blue', lane: 'mid', type: 'outer_tower', name: 'Blue Mid T1', x: -12, z: 0 },
      { team: 'blue', lane: 'mid', type: 'inner_tower', name: 'Blue Mid T2', x: -22, z: 0 },
      { team: 'blue', lane: 'mid', type: 'nexus_tower', name: 'Blue Mid T3', x: -32, z: 0 },
      { team: 'red', lane: 'mid', type: 'outer_tower', name: 'Red Mid T1', x: 12, z: 0 },
      { team: 'red', lane: 'mid', type: 'inner_tower', name: 'Red Mid T2', x: 22, z: 0 },
      { team: 'red', lane: 'mid', type: 'nexus_tower', name: 'Red Mid T3', x: 32, z: 0 },

      // BOT LANE TOWERS
      { team: 'blue', lane: 'bot', type: 'outer_tower', name: 'Blue Bot T1', x: -15, z: 22 },
      { team: 'blue', lane: 'bot', type: 'inner_tower', name: 'Blue Bot T2', x: -28, z: 20 },
      { team: 'blue', lane: 'bot', type: 'nexus_tower', name: 'Blue Bot T3', x: -35, z: 15 },
      { team: 'red', lane: 'bot', type: 'outer_tower', name: 'Red Bot T1', x: 15, z: 22 },
      { team: 'red', lane: 'bot', type: 'inner_tower', name: 'Red Bot T2', x: 28, z: 20 },
      { team: 'red', lane: 'bot', type: 'nexus_tower', name: 'Red Bot T3', x: 35, z: 15 }
    ];

    towerLayout.forEach((tl) => {
      const built = buildTower3D(tl.team, tl.x, tl.z);
      scene.add(built.root);
      initStructures.push({
        id: `${tl.team}_${tl.lane}_${tl.type}`,
        team: tl.team,
        lane: tl.lane,
        type: tl.type,
        name: tl.name,
        x: tl.x,
        z: tl.z,
        y: getTerrainElevation(tl.x, tl.z),
        hp: 2600,
        maxHp: 2600,
        ad: 180,
        range: 12.0,
        attackTimer: 0,
        isAlive: true,
        targetId: null,
        rootMesh: built.root,
        crystalMesh: built.crystal
      });
    });
    structuresRef.current = initStructures;

    // 6. BUILD HEALTH RUNES IN RIVER
    const runeLocs = [
      { id: 'rune_top', x: 0, z: -11 },
      { id: 'rune_bot', x: 0, z: 11 }
    ];
    const initRelics: Relic3D[] = [];
    runeLocs.forEach((rl) => {
      const root = new THREE.Group();
      root.position.set(rl.x, -1.2, rl.z);
      const ped = new THREE.Mesh(new THREE.CylinderGeometry(0.8, 1.0, 1.2, 12), new THREE.MeshStandardMaterial({ color: 0x334155 }));
      ped.position.y = 0.6;
      root.add(ped);
      const crystal = new THREE.Mesh(new THREE.OctahedronGeometry(0.6), new THREE.MeshStandardMaterial({ color: 0x34d399, emissive: 0x10b981, emissiveIntensity: 1.5 }));
      crystal.position.y = 1.8;
      root.add(crystal);
      scene.add(root);
      initRelics.push({ id: rl.id, x: rl.x, z: rl.z, y: -1.2, respawnTimer: 0, healAmount: 320, rootMesh: root, crystalMesh: crystal });
    });
    relicsRef.current = initRelics;

    // 7. ASSIGN CHAMPIONS TO 3 LANES WITH AUTHENTIC RANGES
    // Lane Assignment Policy:
    // Valkira -> Top (Bruiser 1v1)
    // Kyumi (RuneSage) -> Mid (Mage 1v1)
    // Astra -> Bot (ADC Duo)
    // Solana -> Bot (Support Duo)
    // Buck -> Roam / River Jungler
    const getLaneForRole = (champName: string, idx: number): MobaLane => {
      if (champName === 'Valkira') return 'top';
      if (champName === 'Kyumi') return 'mid';
      if (champName === 'Astra') return 'bot';
      if (champName === 'Solana') return 'bot';
      if (champName === 'Buck') return 'roam';
      // Default fallback
      if (idx === 0) return 'top';
      if (idx === 1) return 'mid';
      if (idx === 2) return 'bot';
      if (idx === 3) return 'bot';
      return 'roam';
    };

    // Authentic 3D Attack Ranges (No clumping! Astra snipes from 16 units, Solana at 3.5)
    const get3DRange = (name: string): number => {
      switch (name) {
        case 'Astra': return 16.0;   // Marksman Long Range
        case 'Kyumi': return 13.0;   // Mage Medium-Long Range
        case 'Buck': return 8.5;     // Short-Range Shotgun
        case 'Valkira': return 4.5;  // Skirmisher Reach
        case 'Solana': return 3.5;   // Frontline Tank Melee
        default: return 5.0;
      }
    };

    const getSpawnPos = (team: 'blue' | 'red', lane: MobaLane, idx: number): [number, number] => {
      const side = team === 'blue' ? -1 : 1;
      if (lane === 'top') return [side * 22, -22 + (idx % 2) * 2];
      if (lane === 'mid') return [side * 18, (idx % 2 === 0 ? 1 : -1) * 2];
      if (lane === 'bot') return [side * 22, 22 + (idx % 2) * 2];
      return [side * 14, (idx % 2 === 0 ? 1 : -1) * 7]; // Roamer in river
    };

    const initUnits: CombatUnit3D[] = [];

    // BLUE TEAM CHAMPIONS
    blueLineup.forEach((item, idx) => {
      const lane = getLaneForRole(item.champion.name, idx);
      const [sx, sz] = getSpawnPos('blue', lane, idx);
      const built = buildChibiChampion3D(item.champion, 'blue');
      built.root.position.set(sx, getTerrainElevation(sx, sz), sz);
      scene.add(built.root);

      initUnits.push({
        id: `b_${item.player.id}`,
        player: item.player,
        champion: item.champion,
        team: 'blue',
        lane,
        x: sx,
        z: sz,
        y: getTerrainElevation(sx, sz),
        vx: 0,
        vz: 0,
        targetId: null,
        hp: item.champion.hp + 200,
        maxHp: item.champion.hp + 200,
        mana: 100,
        shield: 0,
        level: 3,
        xp: 0,
        gold: 1400,
        items: [],
        kills: 0,
        deaths: 0,
        assists: 0,
        cs: 0,
        damageDealt: 0,
        isAlive: true,
        respawnTimer: 0,
        attackTimer: 0,
        attackRange: get3DRange(item.champion.name),
        kiteTimer: 0,
        animState: 'idle',
        animTimer: 0,
        rootMesh: built.root,
        dropShadowMesh: built.dropShadow,
        billboardCanvas: built.billboardCanvas,
        billboardTexture: built.billboardTexture,
        billboardMesh: built.billboardMesh,
        tailMeshes: built.tailMeshes,
        orbGroup: built.orbGroup,
        weaponMesh: built.weaponMesh,
        auraMesh: built.auraMesh
      });
    });

    // RED TEAM CHAMPIONS
    redLineup.forEach((item, idx) => {
      const lane = getLaneForRole(item.champion.name, idx);
      const [sx, sz] = getSpawnPos('red', lane, idx);
      const built = buildChibiChampion3D(item.champion, 'red');
      built.root.position.set(sx, getTerrainElevation(sx, sz), sz);
      scene.add(built.root);

      initUnits.push({
        id: `r_${item.player.id}`,
        player: item.player,
        champion: item.champion,
        team: 'red',
        lane,
        x: sx,
        z: sz,
        y: getTerrainElevation(sx, sz),
        vx: 0,
        vz: 0,
        targetId: null,
        hp: item.champion.hp + 200,
        maxHp: item.champion.hp + 200,
        mana: 100,
        shield: 0,
        level: 3,
        xp: 0,
        gold: 1400,
        items: [],
        kills: 0,
        deaths: 0,
        assists: 0,
        cs: 0,
        damageDealt: 0,
        isAlive: true,
        respawnTimer: 0,
        attackTimer: 0,
        attackRange: get3DRange(item.champion.name),
        kiteTimer: 0,
        animState: 'idle',
        animTimer: 0,
        rootMesh: built.root,
        dropShadowMesh: built.dropShadow,
        billboardCanvas: built.billboardCanvas,
        billboardTexture: built.billboardTexture,
        billboardMesh: built.billboardMesh,
        tailMeshes: built.tailMeshes,
        orbGroup: built.orbGroup,
        weaponMesh: built.weaponMesh,
        auraMesh: built.auraMesh
      });
    });

    unitsRef.current = initUnits;

    // 8. 60FPS SIMULATION LOOP
    let animId: number;
    let lastTime = performance.now();

    const loop = (now: number) => {
      animId = requestAnimationFrame(loop);
      const dt = (now - lastTime) / 1000;
      lastTime = now;

      const simDt = paused || matchOver ? 0 : dt * speed;
      const curTime = now * 0.001;

      if (waterMeshRef.current) {
        waterMeshRef.current.position.y = -0.4 + Math.sin(curTime * 2) * 0.04;
      }

      if (simDt > 0) {
        setMatchTime((t) => t + simDt);
        update3LaneSimulation(simDt, curTime, scene);
      }

      // Camera View Switching
      if (cameraFocus === 'map') {
        camera.position.set(0, 56, 44);
        camera.lookAt(0, 0, 0);
      } else if (cameraFocus === 'mid') {
        camera.position.lerp(new THREE.Vector3(0, 28, 26), 0.06);
        camera.lookAt(0, 0.8, 0);
      } else if (cameraFocus === 'top') {
        camera.position.lerp(new THREE.Vector3(0, 28, -22 + 24), 0.06);
        camera.lookAt(0, 0.8, -22);
      } else if (cameraFocus === 'bot') {
        camera.position.lerp(new THREE.Vector3(0, 28, 22 + 24), 0.06);
        camera.lookAt(0, 0.8, 22);
      } else if (cameraFocus === 'flaker') {
        const flaker = unitsRef.current.find((u) => u.player.name === 'RuneSage') || unitsRef.current[0];
        if (flaker && flaker.isAlive) {
          camera.position.lerp(new THREE.Vector3(flaker.x - 10, flaker.y + 14, flaker.z + 16), 0.08);
          camera.lookAt(flaker.x, flaker.y + 1.2, flaker.z);
        }
      } else if (controlsRef.current) {
        controlsRef.current.update();
      }

      renderer.render(scene, camera);
    };

    animId = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(animId);
      renderer.dispose();
      controls.dispose();
      if (container.contains(renderer.domElement)) {
        container.removeChild(renderer.domElement);
      }
    };
  }, [blueLineup, redLineup]);

  // =========================================================================
  // 3-LANE SIMULATION: ANTI-CLUMPING, RANGE, KITING & OBJECTIVES
  // =========================================================================

  const update3LaneSimulation = (dt: number, time: number, scene: THREE.Scene) => {
    // 1. Minion Wave Spawning on ALL 3 LANES (Every 24s)
    waveTimerRef.current -= dt;
    if (waveTimerRef.current <= 0) {
      waveTimerRef.current = 24.0;
      sound.playClick();

      const lanes: ('top' | 'mid' | 'bot')[] = ['top', 'mid', 'bot'];
      lanes.forEach((lane) => {
        ['melee', 'caster'].forEach((mType: any, idx) => {
          // Blue Minion
          const bWp = LANE_WAYPOINTS[lane].blue;
          const bMesh = buildMinion3D('blue', mType);
          bMesh.position.set(bWp[0][0], getTerrainElevation(bWp[0][0], bWp[0][1]), bWp[0][1] + idx * 1.2);
          scene.add(bMesh);
          minionsRef.current.push({
            id: `bm_${lane}_${Math.random()}`,
            team: 'blue',
            lane,
            type: mType,
            waypointIndex: 0,
            x: bWp[0][0],
            z: bWp[0][1] + idx * 1.2,
            y: getTerrainElevation(bWp[0][0], bWp[0][1]),
            hp: mType === 'melee' ? 240 : 160,
            maxHp: mType === 'melee' ? 240 : 160,
            ad: mType === 'melee' ? 14 : 22,
            range: mType === 'caster' ? 8.0 : 2.0,
            speed: 5.2,
            attackTimer: 0,
            isAlive: true,
            goldReward: 21,
            xpReward: 35,
            rootMesh: bMesh
          });

          // Red Minion
          const rWp = LANE_WAYPOINTS[lane].red;
          const rMesh = buildMinion3D('red', mType);
          rMesh.position.set(rWp[0][0], getTerrainElevation(rWp[0][0], rWp[0][1]), rWp[0][1] + idx * 1.2);
          scene.add(rMesh);
          minionsRef.current.push({
            id: `rm_${lane}_${Math.random()}`,
            team: 'red',
            lane,
            type: mType,
            waypointIndex: 0,
            x: rWp[0][0],
            z: rWp[0][1] + idx * 1.2,
            y: getTerrainElevation(rWp[0][0], rWp[0][1]),
            hp: mType === 'melee' ? 240 : 160,
            maxHp: mType === 'melee' ? 240 : 160,
            ad: mType === 'melee' ? 14 : 22,
            range: mType === 'caster' ? 8.0 : 2.0,
            speed: 5.2,
            attackTimer: 0,
            isAlive: true,
            goldReward: 21,
            xpReward: 35,
            rootMesh: rMesh
          });
        });
      });
    }

    // 2. Minions Movement along Waypoints
    minionsRef.current.forEach((m) => {
      if (!m.isAlive) return;

      // Find enemies in same lane
      const enemies = [
        ...minionsRef.current.filter((o) => o.team !== m.team && o.isAlive && o.lane === m.lane),
        ...unitsRef.current.filter((u) => u.team !== m.team && u.isAlive && (u.lane === m.lane || u.lane === 'roam')),
        ...structuresRef.current.filter((s) => s.team !== m.team && s.isAlive && s.lane === m.lane)
      ];

      let target: any = null;
      let targetDist = 999;
      enemies.forEach((e) => {
        const d = Math.hypot(e.x - m.x, e.z - m.z);
        if (d < targetDist) {
          targetDist = d;
          target = e;
        }
      });

      if (target && targetDist <= m.range) {
        // Attack
        m.attackTimer -= dt;
        if (m.attackTimer <= 0) {
          m.attackTimer = 1.2;
          target.hp -= m.ad;
          spawnFloatingText(scene, `-${m.ad}`, '#f1f5f9', target.x, target.y, target.z);
          if (target.hp <= 0) target.isAlive = false;
        }
      } else {
        // Walk along waypoint route
        const route = m.team === 'blue' ? LANE_WAYPOINTS[m.lane as 'top' | 'mid' | 'bot'].blue : LANE_WAYPOINTS[m.lane as 'top' | 'mid' | 'bot'].red;
        const wp = route[m.waypointIndex];
        if (wp) {
          const dx = wp[0] - m.x;
          const dz = wp[1] - m.z;
          const d = Math.hypot(dx, dz);
          if (d < 1.5 && m.waypointIndex < route.length - 1) {
            m.waypointIndex++;
          } else if (d > 0.1) {
            m.x += (dx / d) * m.speed * dt;
            m.z += (dz / d) * m.speed * dt;
            m.y = getTerrainElevation(m.x, m.z);
            m.rootMesh.position.set(m.x, m.y, m.z);
          }
        }
      }
    });

    minionsRef.current = minionsRef.current.filter((m) => {
      if (!m.isAlive) {
        scene.remove(m.rootMesh);
        return false;
      }
      return true;
    });

    // 3. ANTI-CLUMPING SEPARATION PHYSICS (No standing inside each other!)
    for (let i = 0; i < unitsRef.current.length; i++) {
      const u1 = unitsRef.current[i];
      if (!u1.isAlive) continue;

      for (let j = i + 1; j < unitsRef.current.length; j++) {
        const u2 = unitsRef.current[j];
        if (!u2.isAlive) continue;

        const dx = u2.x - u1.x;
        const dz = u2.z - u1.z;
        const dist = Math.hypot(dx, dz);
        const minDist = 3.2; // Minimum spacing buffer

        if (dist < minDist && dist > 0.01) {
          const overlap = (minDist - dist) * 0.5;
          const nx = dx / dist;
          const nz = dz / dist;
          u1.x -= nx * overlap;
          u1.z -= nz * overlap;
          u2.x += nx * overlap;
          u2.z += nz * overlap;
        }
      }
    }

    // 4. CHAMPIONS MICRO & KITING AI (Picture Perfect Spacing!)
    unitsRef.current.forEach((u) => {
      if (!u.isAlive) {
        u.respawnTimer -= dt;
        if (u.respawnTimer <= 0) {
          u.isAlive = true;
          u.hp = u.maxHp;
          u.mana = 100;
          u.x = u.team === 'blue' ? -42 : 42;
          u.z = 0;
          u.rootMesh.visible = true;
        } else {
          u.rootMesh.visible = false;
          return;
        }
      }

      // Tail physics for Kyumi
      if (u.tailMeshes) {
        u.tailMeshes.forEach((tail, idx) => {
          const swayZ = Math.sin(time * 3.6 + idx * 0.45) * 0.12;
          tail.rotation.z = (-Math.PI * 0.72 + (idx / 8) * (Math.PI * 0.88)) * -0.85 + swayZ;
        });
      }
      if (u.orbGroup) {
        u.orbGroup.position.y = 0.8 + Math.sin(time * 4) * 0.15;
      }

      // Priority Targeting: Opponents in same lane or closest nearby
      const enemyChamps = unitsRef.current.filter((e) => e.team !== u.team && e.isAlive);
      const enemyMinions = minionsRef.current.filter((m) => m.team !== u.team && m.isAlive && (m.lane === u.lane || Math.hypot(m.x - u.x, m.z - u.z) < 16));
      const enemyTowers = structuresRef.current.filter((s) => s.team !== u.team && s.isAlive && s.lane === u.lane);

      let target: any = null;
      let targetDist = 999;

      // Prioritize champions in same lane first
      const sameLaneEnemies = enemyChamps.filter((e) => e.lane === u.lane);
      const candidates = sameLaneEnemies.length > 0 ? [...sameLaneEnemies, ...enemyMinions, ...enemyTowers] : [...enemyChamps, ...enemyMinions, ...enemyTowers];

      candidates.forEach((cand) => {
        const d = Math.hypot(cand.x - u.x, cand.z - u.z);
        if (d < targetDist) {
          targetDist = d;
          target = cand;
        }
      });

      // MICRO BEHAVIORS BY ARCHETYPE
      const isRanged = u.attackRange >= 8.0;

      if (target) {
        const desiredMinRange = u.attackRange * 0.65; // Kite buffer!

        if (isRanged && targetDist < desiredMinRange) {
          // --- KITING BACKWARDS (ASTRA & KYUMI STUTTER-STEPPING!) ---
          // Step backwards away from advancing enemy while facing them!
          const dx = u.x - target.x;
          const dz = u.z - target.z;
          const dist = Math.hypot(dx, dz);
          u.x += (dx / dist) * 6.2 * dt;
          u.z += (dz / dist) * 6.2 * dt;
          u.animState = 'walk';
        } else if (targetDist > u.attackRange) {
          // Advance into attack range
          const dx = target.x - u.x;
          const dz = target.z - u.z;
          const dist = Math.hypot(dx, dz);
          u.x += (dx / dist) * 5.6 * dt;
          u.z += (dz / dist) * 5.6 * dt;
          u.animState = 'walk';
        } else {
          // IN ATTACK RANGE: ATTACK!
          u.animState = 'attack';
          u.attackTimer -= dt;

          // FLAKER MICRO: JUKING SIDE-TO-SIDE (Circling / Weaving!)
          if (u.player.name === 'RuneSage') {
            const sideAngle = Math.atan2(target.z - u.z, target.x - u.x) + Math.PI / 2;
            u.x += Math.cos(sideAngle) * Math.sin(time * 4) * 2.5 * dt;
            u.z += Math.sin(sideAngle) * Math.sin(time * 4) * 2.5 * dt;
          }

          if (u.attackTimer <= 0) {
            u.attackTimer = 1.0 / (u.champion.aspd / 100);
            const dmg = Math.round(u.champion.ad * 0.85);
            target.hp -= dmg;
            u.damageDealt += dmg;
            sound.playSpellHit();
            spawnFloatingText(scene, `-${dmg}`, u.team === 'blue' ? '#38bdf8' : '#f43f5e', target.x, target.y, target.z);

            // Fire visual 3D projectile for ranged champions
            if (isRanged) {
              const pGeo = new THREE.SphereGeometry(0.25);
              const pMat = new THREE.MeshBasicMaterial({ color: u.champion.name === 'Astra' ? 0x38bdf8 : 0xec4899 });
              const pMesh = new THREE.Mesh(pGeo, pMat);
              pMesh.position.set(u.x, u.y + 1.2, u.z);
              scene.add(pMesh);
              projectilesRef.current.push({
                id: Math.random().toString(),
                x: u.x,
                y: u.y + 1.2,
                z: u.z,
                targetX: target.x,
                targetY: target.y + 0.8,
                targetZ: target.z,
                speed: 28,
                mesh: pMesh,
                targetUnitId: target.id,
                damage: dmg,
                attackerId: u.id,
                team: u.team,
                type: u.champion.name === 'Astra' ? 'arrow' : 'orb'
              });
            }

            if (target.hp <= 0 && target.isAlive) {
              target.isAlive = false;
              u.kills++;
              u.gold += 300;
              u.xp += 280;
              if (u.team === 'blue') setBlueKills((k) => k + 1);
              else setRedKills((k) => k + 1);
              sound.playWalkoutFanfare();
            }
          }
        }
      } else {
        u.animState = 'idle';
      }

      u.y = getTerrainElevation(u.x, u.z);
      u.rootMesh.position.set(u.x, u.y, u.z);

      // Leaping bob for Kyumi
      if (u.champion.name === 'Kyumi') {
        u.rootMesh.children[2].position.y = 1.35 + Math.sin(time * 3 + u.x) * 0.22;
      }

      // Overhead Billboard update
      updateOverheadBillboard(u);
    });

    // 5. Towers Firing
    structuresRef.current.forEach((st) => {
      if (!st.isAlive) return;
      st.crystalMesh.rotation.y = time * 2;

      const enemies = [
        ...minionsRef.current.filter((m) => m.team !== st.team && m.isAlive && Math.hypot(m.x - st.x, m.z - st.z) <= st.range),
        ...unitsRef.current.filter((u) => u.team !== st.team && u.isAlive && Math.hypot(u.x - st.x, u.z - st.z) <= st.range)
      ];

      const target = enemies[0];
      if (target) {
        st.attackTimer -= dt;
        if (st.attackTimer <= 0) {
          st.attackTimer = 1.35;
          sound.playSpellHit();
          target.hp -= st.ad;
          spawnFloatingText(scene, `-${st.ad}`, '#f43f5e', target.x, target.y, target.z);
          if (target.hp <= 0) target.isAlive = false;
        }
      }

      if (st.hp <= 0 && st.isAlive) {
        st.isAlive = false;
        sound.playUltimateExplosion();
        scene.remove(st.crystalMesh);
        confetti({ particleCount: 70, spread: 50 });
      }
    });

    // 6. Projectiles Simulation
    projectilesRef.current.forEach((p) => {
      const dx = p.targetX - p.x;
      const dy = p.targetY - p.y;
      const dz = p.targetZ - p.z;
      const dist = Math.hypot(dx, dy, dz);
      if (dist < 1.0) {
        scene.remove(p.mesh);
        p.speed = 0;
      } else {
        p.x += (dx / dist) * p.speed * dt;
        p.y += (dy / dist) * p.speed * dt;
        p.z += (dz / dist) * p.speed * dt;
        p.mesh.position.set(p.x, p.y, p.z);
      }
    });
    projectilesRef.current = projectilesRef.current.filter((p) => p.speed > 0);

    // 7. Floating Texts
    floatingTextsRef.current.forEach((ft) => {
      ft.timer += dt;
      ft.mesh.position.y = ft.yStart + (ft.timer / ft.maxTimer) * 1.4;
      (ft.mesh.material as any).opacity = 1 - ft.timer / ft.maxTimer;
      if (ft.timer >= ft.maxTimer) scene.remove(ft.mesh);
    });
    floatingTextsRef.current = floatingTextsRef.current.filter((ft) => ft.timer < ft.maxTimer);
  };

  const updateOverheadBillboard = (u: CombatUnit3D) => {
    const ctx = u.billboardCanvas.getContext('2d')!;
    ctx.clearRect(0, 0, 256, 128);

    // Lane Tag & Athlete Name
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 22px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(`[${u.lane.toUpperCase()}] ${u.player.name}`, 128, 30);

    // HP Bar
    const barW = 160; const barH = 14; const barX = 48; const barY = 42;
    ctx.fillStyle = '#020617';
    ctx.fillRect(barX, barY, barW, barH);
    const hpPct = Math.max(0, u.hp / u.maxHp);
    ctx.fillStyle = u.team === 'blue' ? '#38bdf8' : '#f43f5e';
    ctx.fillRect(barX + 1, barY + 1, (barW - 2) * hpPct, barH - 2);

    // Level Badge
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(barX - 28, barY - 2, 22, 18);
    ctx.fillStyle = '#f59e0b';
    ctx.font = 'bold 16px sans-serif';
    ctx.fillText(`${u.level}`, barX - 17, barY + 13);

    u.billboardTexture.needsUpdate = true;
  };

  return (
    <div className="relative w-full rounded-3xl overflow-hidden border-2 border-slate-700 bg-slate-950 shadow-2xl select-none">
      {/* 3D WebGL Canvas */}
      <div ref={mountRef} className="w-full h-[620px] bg-slate-950" />

      {/* TOP BROADCAST SCOREBOARD BAR */}
      <div className="absolute top-4 left-6 right-6 flex items-center justify-between pointer-events-none">
        {/* Blue Team Info */}
        <div className="flex items-center gap-3 bg-slate-950/85 backdrop-blur-md px-4 py-2 rounded-2xl border border-cyan-500/40 shadow-xl pointer-events-auto">
          <div className="w-3.5 h-3.5 rounded-full bg-cyan-400 animate-pulse" />
          <div>
            <div className="text-[10px] font-black uppercase tracking-wider text-cyan-400">Radiant Blue</div>
            <div className="text-xl font-black text-white flex items-center gap-2">
              {blueKills} <span className="text-xs text-amber-400">({blueGold}g)</span>
            </div>
          </div>
        </div>

        {/* Center Match Clock & Controls */}
        <div className="flex items-center gap-3 bg-slate-950/90 backdrop-blur-md px-5 py-2.5 rounded-2xl border border-slate-700 shadow-2xl pointer-events-auto">
          <div className="text-sm font-black font-mono text-amber-400">
            {Math.floor(matchTime / 60)}:{(Math.floor(matchTime % 60)).toString().padStart(2, '0')}
          </div>
          <div className="h-4 w-px bg-slate-700" />
          <button
            onClick={() => setPaused(!paused)}
            className="p-1.5 hover:bg-slate-800 text-slate-300 hover:text-white rounded-lg transition"
          >
            {paused ? <Play className="w-4 h-4 text-emerald-400" /> : <Pause className="w-4 h-4" />}
          </button>
          <button
            onClick={() => setSpeed((s) => (s === 1 ? 2 : s === 2 ? 3 : 1))}
            className="px-2 py-0.5 text-xs font-black bg-slate-800 hover:bg-slate-700 text-amber-300 rounded-lg transition"
          >
            {speed}x
          </button>
          <div className="h-4 w-px bg-slate-700" />
          {/* Camera Quick-Jump Selectors for 3 Lanes */}
          <div className="flex items-center gap-1">
            <button
              onClick={() => setCameraFocus('map')}
              className={`px-2.5 py-1 text-[10px] font-black rounded-lg transition ${
                cameraFocus === 'map' ? 'bg-amber-400 text-slate-950 shadow' : 'bg-slate-800 text-slate-400 hover:text-white'
              }`}
            >
              🗺️ Full Map
            </button>
            <button
              onClick={() => setCameraFocus('mid')}
              className={`px-2.5 py-1 text-[10px] font-black rounded-lg transition ${
                cameraFocus === 'mid' ? 'bg-cyan-400 text-slate-950 shadow' : 'bg-slate-800 text-slate-400 hover:text-white'
              }`}
            >
              Mid Lane
            </button>
            <button
              onClick={() => setCameraFocus('top')}
              className={`px-2.5 py-1 text-[10px] font-black rounded-lg transition ${
                cameraFocus === 'top' ? 'bg-emerald-400 text-slate-950 shadow' : 'bg-slate-800 text-slate-400 hover:text-white'
              }`}
            >
              Top Lane
            </button>
            <button
              onClick={() => setCameraFocus('bot')}
              className={`px-2.5 py-1 text-[10px] font-black rounded-lg transition ${
                cameraFocus === 'bot' ? 'bg-indigo-400 text-slate-950 shadow' : 'bg-slate-800 text-slate-400 hover:text-white'
              }`}
            >
              Bot Lane
            </button>
            <button
              onClick={() => setCameraFocus('flaker')}
              className={`px-2.5 py-1 text-[10px] font-black rounded-lg transition ${
                cameraFocus === 'flaker' ? 'bg-pink-500 text-white shadow' : 'bg-slate-800 text-slate-400 hover:text-white'
              }`}
            >
              👑 RuneSage Cam
            </button>
            <button
              onClick={() => setCameraFocus('orbit')}
              className={`px-2.5 py-1 text-[10px] font-black rounded-lg transition ${
                cameraFocus === 'orbit' ? 'bg-amber-500 text-slate-950 shadow' : 'bg-slate-800 text-slate-400 hover:text-white'
              }`}
            >
              Free 360°
            </button>
          </div>
        </div>

        {/* Red Team Info */}
        <div className="flex items-center gap-3 bg-slate-950/85 backdrop-blur-md px-4 py-2 rounded-2xl border border-rose-500/40 shadow-xl pointer-events-auto">
          <div className="text-right">
            <div className="text-[10px] font-black uppercase tracking-wider text-rose-400">Dire Red</div>
            <div className="text-xl font-black text-white flex items-center justify-end gap-2">
              <span className="text-xs text-amber-400">({redGold}g)</span> {redKills}
            </div>
          </div>
          <div className="w-3.5 h-3.5 rounded-full bg-rose-500 animate-pulse" />
        </div>
      </div>

      {/* BOTTOM HINTS & LANE STATUS */}
      <div className="absolute bottom-4 left-6 pointer-events-none">
        <div className="text-[11px] font-bold bg-slate-950/80 backdrop-blur-md px-3.5 py-1.5 rounded-xl border border-slate-800 text-slate-300 shadow">
          🛡️ <span className="text-emerald-400">Top</span>: Valkira Duel • <span className="text-cyan-400">Mid</span>: RuneSage Kyumi • <span className="text-indigo-400">Bot</span>: Astra & Solana • <span className="text-amber-400">River</span>: Buck Roam
        </div>
      </div>

      <div className="absolute bottom-4 right-6 text-right pointer-events-none">
        <div className="text-[10px] font-black uppercase text-slate-400 bg-slate-950/80 px-3 py-1.5 rounded-xl border border-slate-800">
          ✨ Ranged Kiting Active • Anti-Clumping Spacing • Free Orbit Drag & Zoom
        </div>
      </div>
    </div>
  );
};
