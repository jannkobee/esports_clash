/**
 * Phase 5: Automatic Weapon Attachment & Socket System
 *
 * Configurable attachment points (right_hand_socket, left_hand_socket, weapon_primary,
 * weapon_secondary, weapon_muzzle, weapon_tip, projectile_origin), support for all 6 core
 * MOBA weapon classes, procedural weapon asset generators, and runtime socket bindings.
 */

import * as THREE from 'three';
import type { WeaponAssetConfig, WeaponType, SocketName } from './types.ts';

export interface AttachedWeaponInstance {
  config: WeaponAssetConfig;
  rootObject: THREE.Object3D;
  primarySocketNode: THREE.Object3D;
  secondarySocketNode?: THREE.Object3D;
  tipMarker: THREE.Object3D;
  muzzleMarker?: THREE.Object3D;
}

/**
 * Creates socket anchors on the character hierarchy.
 */
export function ensureWeaponSockets(
  characterRoot: THREE.Object3D
): Map<SocketName, THREE.Object3D> {
  const sockets = new Map<SocketName, THREE.Object3D>();

  function findOrCreateSocket(
    parentName: string,
    socketName: SocketName,
    defaultOffset: [number, number, number] = [0, 0, 0]
  ): THREE.Object3D {
    let existing: THREE.Object3D | null = null;
    characterRoot.traverse((node) => {
      if (node.name === socketName || node.userData.socketName === socketName) {
        existing = node;
      }
    });

    if (existing) {
      sockets.set(socketName, existing);
      return existing;
    }

    let parentNode: THREE.Object3D | null = null;
    characterRoot.traverse((node) => {
      if (node.name === parentName || node.userData.avatarPart === parentName) {
        parentNode = node;
      }
    });

    if (!parentNode) {
      parentNode = characterRoot;
    }

    const socketNode = new THREE.Group();
    socketNode.name = socketName;
    socketNode.userData.socketName = socketName;
    socketNode.position.set(...defaultOffset);
    parentNode.add(socketNode);

    sockets.set(socketName, socketNode);
    return socketNode;
  }

  // Right Hand Primary
  findOrCreateSocket('HandR', 'right_hand_socket', [0, -1, 2]);
  findOrCreateSocket('HandR', 'weapon_primary', [0, -1, 2]);

  // Left Hand Secondary / Offhand
  findOrCreateSocket('HandL', 'left_hand_socket', [0, -1, 2]);
  findOrCreateSocket('HandL', 'weapon_secondary', [0, -1, 2]);

  return sockets;
}

/**
 * Creates high-quality procedural 3D weapon meshes for the 6 core MOBA weapon types
 * when external weapon GLB assets are not yet imported.
 */
export function createProceduralWeaponMesh(
  type: WeaponType,
  name: string
): THREE.Group {
  const group = new THREE.Group();
  group.name = `weapon_${name}`;

  const bladeMat = new THREE.MeshStandardMaterial({
    color: '#e2e8f0',
    metalness: 0.85,
    roughness: 0.25,
  });
  const goldMat = new THREE.MeshStandardMaterial({
    color: '#fbbf24',
    metalness: 0.9,
    roughness: 0.3,
  });
  const leatherMat = new THREE.MeshStandardMaterial({
    color: '#78350f',
    roughness: 0.8,
  });
  const woodMat = new THREE.MeshStandardMaterial({
    color: '#92400e',
    roughness: 0.7,
  });
  const energyMat = new THREE.MeshStandardMaterial({
    color: '#38bdf8',
    emissive: '#0284c7',
    emissiveIntensity: 0.6,
  });

  switch (type) {
    case 'sword': {
      // Handle / Grip
      const grip = new THREE.Mesh(new THREE.CylinderGeometry(0.7, 0.7, 7, 8), leatherMat);
      grip.position.set(0, -3.5, 0);
      group.add(grip);

      // Pommel
      const pommel = new THREE.Mesh(new THREE.SphereGeometry(1.2, 8, 8), goldMat);
      pommel.position.set(0, -7, 0);
      group.add(pommel);

      // Guard / Crossguard
      const guard = new THREE.Mesh(new THREE.BoxGeometry(10, 1.4, 2.2), goldMat);
      guard.position.set(0, 0, 0);
      group.add(guard);

      // Blade
      const blade = new THREE.Mesh(new THREE.BoxGeometry(2.4, 32, 0.6), bladeMat);
      blade.position.set(0, 16, 0);
      group.add(blade);

      // Blade Tip
      const tipGeo = new THREE.ConeGeometry(1.7, 6, 4);
      tipGeo.rotateY(Math.PI * 0.25);
      const tip = new THREE.Mesh(tipGeo, bladeMat);
      tip.position.set(0, 35, 0);
      group.add(tip);
      break;
    }

    case 'dual_daggers': {
      const grip = new THREE.Mesh(new THREE.CylinderGeometry(0.6, 0.6, 5, 8), leatherMat);
      grip.position.set(0, -2.5, 0);
      group.add(grip);

      const guard = new THREE.Mesh(new THREE.BoxGeometry(6, 1.0, 1.6), goldMat);
      group.add(guard);

      const blade = new THREE.Mesh(new THREE.BoxGeometry(1.6, 18, 0.5), bladeMat);
      blade.position.set(0, 9, 0);
      group.add(blade);
      break;
    }

    case 'staff': {
      // Long shaft
      const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.8, 0.9, 52, 8), woodMat);
      shaft.position.set(0, 10, 0);
      group.add(shaft);

      // Metallic bands
      const band1 = new THREE.Mesh(new THREE.CylinderGeometry(1.1, 1.1, 2, 8), goldMat);
      band1.position.set(0, 24, 0);
      group.add(band1);

      // Crystal head
      const crystal = new THREE.Mesh(new THREE.OctahedronGeometry(3.5), energyMat);
      crystal.position.set(0, 38, 0);
      group.add(crystal);
      break;
    }

    case 'bow': {
      // Curved limb
      const curve = new THREE.CatmullRomCurve3([
        new THREE.Vector3(0, -22, 4),
        new THREE.Vector3(0, -10, 0),
        new THREE.Vector3(0, 0, -2),
        new THREE.Vector3(0, 10, 0),
        new THREE.Vector3(0, 22, 4),
      ]);
      const bowGeo = new THREE.TubeGeometry(curve, 20, 0.9, 8, false);
      const bowMesh = new THREE.Mesh(bowGeo, woodMat);
      group.add(bowMesh);

      // Bowstring
      const stringGeo = new THREE.CylinderGeometry(0.15, 0.15, 42, 4);
      const stringMesh = new THREE.Mesh(stringGeo, bladeMat);
      stringMesh.position.set(0, 0, 4);
      group.add(stringMesh);
      break;
    }

    case 'two_handed': {
      // Massive Greatsword
      const grip = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 0.9, 12, 8), leatherMat);
      grip.position.set(0, -6, 0);
      group.add(grip);

      const guard = new THREE.Mesh(new THREE.BoxGeometry(16, 2.5, 3.5), goldMat);
      group.add(guard);

      const blade = new THREE.Mesh(new THREE.BoxGeometry(4.8, 48, 1.2), bladeMat);
      blade.position.set(0, 24, 0);
      group.add(blade);
      break;
    }

    case 'gun': {
      // Receiver / Body
      const body = new THREE.Mesh(new THREE.BoxGeometry(3.5, 4.5, 14), bladeMat);
      body.position.set(0, 1.5, 5);
      group.add(body);

      // Grip
      const grip = new THREE.Mesh(new THREE.BoxGeometry(2.2, 7, 3), woodMat);
      grip.position.set(0, -3, 0);
      grip.rotation.x = -0.3;
      group.add(grip);

      // Twin Barrels
      const barrel1 = new THREE.Mesh(new THREE.CylinderGeometry(1.1, 1.1, 24, 8), bladeMat);
      barrel1.rotation.x = Math.PI * 0.5;
      barrel1.position.set(-1.2, 2.2, 18);
      group.add(barrel1);

      const barrel2 = new THREE.Mesh(new THREE.CylinderGeometry(1.1, 1.1, 24, 8), bladeMat);
      barrel2.rotation.x = Math.PI * 0.5;
      barrel2.position.set(1.2, 2.2, 18);
      group.add(barrel2);
      break;
    }
  }

  return group;
}

/**
 * Attaches a weapon asset to a character's designated socket.
 */
export function attachWeaponToCharacter(
  characterRoot: THREE.Object3D,
  weaponConfig: WeaponAssetConfig,
  customWeaponMesh?: THREE.Object3D
): AttachedWeaponInstance {
  const sockets = ensureWeaponSockets(characterRoot);
  const targetSocket = sockets.get(weaponConfig.primarySocket) ?? characterRoot;

  const weaponMesh = customWeaponMesh ?? createProceduralWeaponMesh(weaponConfig.weaponType, weaponConfig.name);

  // Apply grip transforms
  const grip = weaponConfig.gripTransform;
  weaponMesh.position.set(...grip.position);
  weaponMesh.rotation.set(...grip.rotation);
  weaponMesh.scale.set(...grip.scale);

  targetSocket.add(weaponMesh);

  // Create socket tip marker
  const tipMarker = new THREE.Group();
  tipMarker.name = 'weapon_tip';
  tipMarker.userData.socketName = 'weapon_tip';
  tipMarker.position.set(...weaponConfig.tipOffset);
  weaponMesh.add(tipMarker);

  let muzzleMarker: THREE.Object3D | undefined;
  if (weaponConfig.muzzleOffset) {
    muzzleMarker = new THREE.Group();
    muzzleMarker.name = 'weapon_muzzle';
    muzzleMarker.userData.socketName = 'weapon_muzzle';
    muzzleMarker.position.set(...weaponConfig.muzzleOffset);
    weaponMesh.add(muzzleMarker);
  }

  return {
    config: weaponConfig,
    rootObject: weaponMesh,
    primarySocketNode: targetSocket,
    secondarySocketNode: weaponConfig.secondarySocket ? sockets.get(weaponConfig.secondarySocket) : undefined,
    tipMarker,
    muzzleMarker,
  };
}

