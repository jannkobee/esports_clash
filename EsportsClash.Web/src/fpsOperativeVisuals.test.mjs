import test from 'node:test';
import assert from 'node:assert/strict';
import { Color3, FreeCamera, Mesh, NullEngine, Scene, StandardMaterial, TransformNode, Vector3, VertexBuffer } from '@babylonjs/core';
import {
  CT_OPERATIVE_STYLES,
  OPERATIVE_FACE_TRAITS,
  T_OPERATIVE_STYLES,
  resolveOperativeStyle,
  resolveOperativeVariantIndex,
} from './fps/fpsOperativeDesign.ts';
import { FpsBroadcastAudio } from './fps/fpsBroadcastAudio.ts';
import {
  applyOperativeAnimation,
  create3DWeaponMesh,
  createTacticalOperativeMesh,
  createViewmodelMesh,
  updateOperativeUtilityCarry,
} from './fps/fpsLiveViewer.ts';
import { FpsLiveSimulation } from './fps/fpsLiveSimulation.ts';
import { FPS_IDENTITY_PERSONALITIES, generatePlayerDNA } from './fps/fpsIdentity.ts';
import { FPS_CT_POSITIONS, FPS_T_POSITIONS } from './fps/fpsPlayerArchitecture.ts';

function createSceneFixture() {
  const engine = new NullEngine();
  const scene = new Scene(engine);
  const materials = new Map();
  const getMat = (hex) => {
    const key = hex.toLowerCase();
    let mat = materials.get(key);
    if (!mat) {
      mat = new StandardMaterial(`mat-${key}`, scene);
      mat.diffuseColor = Color3.FromHexString(hex);
      materials.set(key, mat);
    }
    return mat;
  };
  return {
    scene,
    getMat,
    dispose: () => {
      scene.dispose();
      engine.dispose();
    },
  };
}

function makeBasePlayer(force, id) {
  const plan = { tempo: 0.6, structure: 0.7, aggression: 0.5, preparation: 0.7, freedom: 0.5, economy: 0.8 };
  const coach = { ...plan, rigidity: 0.7, communication: 0.7, leadership: 0.7, adaptability: 0.7, development: 0.5 };
  const chemistry = { trust: 0.6, communication: 0.6, understanding: 0.6, leadershipAcceptance: 0.6, roleCompetition: 0.3 };
  const cards = Array.from({ length: 10 }, (_, i) => ({
    id: `vis-p-${i}`,
    name: `Vis ${i}`,
    stats: { rifling: 80, positioning: 80, entry: 80, sniping: 80, utility: 80, shotcalling: 80 },
  }));
  const identity = {
    players: Object.fromEntries(cards.map((p, i) => [
      p.id,
      {
        id: p.id,
        assignments: { t: FPS_T_POSITIONS[i % 5], ct: FPS_CT_POSITIONS[i % 5] },
        personality: FPS_IDENTITY_PERSONALITIES[i],
        dna: generatePlayerDNA(p.id),
        intensity: 0.6,
        roleSuitability: 0.6,
        familiarity: 0.5,
      },
    ])),
    teams: { blue: { coach, plan, chemistry }, red: { coach, plan, chemistry } },
  };
  const sim = new FpsLiveSimulation(cards.slice(0, 5), cards.slice(5), 1142026, identity);
  const snap = sim.snapshot();
  const template = snap.players.find((p) => (force === 't' ? p.attacking : !p.attacking)) ?? snap.players[0];
  return {
    ...template,
    id,
    attacking: force === 't',
    hp: 100,
    x: 0,
    z: 0,
    yaw: 0,
    pitch: 0,
    recoilYaw: 0,
    recoilPitch: 0,
    speed: 0,
    jump: false,
    jumpY: 0,
    crouch: false,
    weapon: 'ak47',
    equipped: 'ak47',
    weaponReady: 0,
    lastShot: -10,
    lastSwing: -10,
    reload: 0,
    reloadDuration: 2.2,
    channel: 0,
    blinded: 0,
    throwAt: undefined,
    utilityPrep: undefined,
    scopeState: 'hip',
    scopeLevel: 0,
    radioMessage: undefined,
  };
}

test('all 5 CT and 5 T operative variants are visually distinct, grounded, and bounded in mesh budget', () => {
  assert.equal(CT_OPERATIVE_STYLES.length, 5);
  assert.equal(T_OPERATIVE_STYLES.length, 5);
  assert.equal(new Set(CT_OPERATIVE_STYLES.map((s) => s.code)).size, 5);
  assert.equal(new Set(T_OPERATIVE_STYLES.map((s) => s.code)).size, 5);
  assert.equal(new Set(CT_OPERATIVE_STYLES.map((s) => s.headgear)).size, 5);
  assert.equal(new Set(T_OPERATIVE_STYLES.map((s) => s.headgear)).size, 5);
  assert.equal(new Set(CT_OPERATIVE_STYLES.map((s) => s.fabric)).size, 5);
  assert.equal(new Set(T_OPERATIVE_STYLES.map((s) => s.fabric)).size, 5);

  const f = createSceneFixture();
  try {
    for (const force of ['ct', 't']) {
      for (let variant = 0; variant < 5; variant++) {
        const id = `op-${force}-${variant}`;
        const op = createTacticalOperativeMesh(force, id, f.scene, f.getMat, variant);
        const expected = resolveOperativeStyle(force, id, variant);
        assert.equal(op.variantIndex, resolveOperativeVariantIndex(force, id, variant));
        assert.equal(op.variantStyle?.code, expected.code);

        const children = op.root.getChildMeshes();
        const kit = children.filter((m) => m.name.includes(`-${force}-kit-`));
        const pivots = new Set([
          op.spine, op.headPivot, op.leftArmPivot, op.rightArmPivot,
          op.leftElbowPivot, op.rightElbowPivot, op.leftLegPivot,
          op.rightLegPivot, op.leftKneePivot, op.rightKneePivot,
        ]);

        assert.ok(children.length < 75, `${expected.code} should stay under 75 meshes (got ${children.length})`);
        assert.ok(kit.length > 8, `${expected.code} should have > 8 kit groups (got ${kit.length})`);
        assert.ok(kit.some((m) => m.parent === op.headPivot), `${expected.code} must attach merged headgear to headPivot`);

        for (const suffix of ['torso', 'head', 'arm-l', 'arm-r', 'forearm-l', 'forearm-r', 'leg-l', 'leg-r', 'shin-l', 'shin-r', 'boot-l', 'boot-r']) {
          assert.ok(children.some((m) => m.name === `${id}-${suffix}`), `${expected.code} missing core limb ${suffix}`);
        }

        const forearmL = children.find((m) => m.name === `${id}-forearm-l`);
        assert.equal(forearmL?.material, f.getMat(expected.sleeveRolled ? expected.skin : expected.fabric));

        const fullBalaclava = expected.headgear === 'fast-nvg' || expected.headgear === 'gign-shield' || expected.headgear === 'swat-cap';
        assert.equal(op.head.material, f.getMat(fullBalaclava ? expected.eyePatchColor : expected.skin));

        for (const mesh of kit) {
          assert.equal(mesh.isPickable, false);
          assert.equal(mesh.receiveShadows, true);
          assert.ok(pivots.has(mesh.parent));
          const positions = mesh instanceof Mesh ? mesh.getVerticesData(VertexBuffer.PositionKind) : undefined;
          assert.ok(positions && positions.length > 0 && positions.every(Number.isFinite));
        }
      }
    }
  } finally {
    f.dispose();
  }
});

test('first-person viewmodels reflect operative sleeve roll, fingerless gloves, and fabric palette', () => {
  const f = createSceneFixture();
  try {
    const rolledCt = CT_OPERATIVE_STYLES.find((s) => s.sleeveRolled);
    const fullCt = CT_OPERATIVE_STYLES.find((s) => !s.sleeveRolled);
    const fingerlessT = T_OPERATIVE_STYLES.find((s) => s.fingerless);
    assert.ok(rolledCt && fullCt && fingerlessT);

    const vmRolled = createViewmodelMesh('m4a1_s', 'blue', 'vm-rolled', f.scene, f.getMat, false, rolledCt);
    const rolledMeshes = vmRolled.getChildMeshes();
    assert.ok(rolledMeshes.some((m) => m.name === 'vm-rolled-r-sleeve'), 'rolled variant builds right cuff');
    assert.ok(rolledMeshes.some((m) => m.name === 'vm-rolled-l-sleeve'), 'rolled variant builds left cuff');
    assert.equal(rolledMeshes.find((m) => m.name === 'vm-rolled-r-forearm')?.material, f.getMat(rolledCt.skin));
    assert.equal(rolledMeshes.find((m) => m.name === 'vm-rolled-r-fingers')?.material, f.getMat(rolledCt.glove));

    const vmFull = createViewmodelMesh('m4a1_s', 'blue', 'vm-full', f.scene, f.getMat, false, fullCt);
    const fullMeshes = vmFull.getChildMeshes();
    assert.ok(fullMeshes.some((m) => m.name === 'vm-full-r-strap'), 'full-sleeve variant wears watch/cuff strap');
    assert.equal(fullMeshes.some((m) => m.name === 'vm-full-r-sleeve'), false);
    assert.equal(fullMeshes.find((m) => m.name === 'vm-full-r-forearm')?.material, f.getMat(fullCt.fabric));

    const vmFingerless = createViewmodelMesh('ak47', 'red', 'vm-fingerless', f.scene, f.getMat, true, fingerlessT);
    const fingerlessMeshes = vmFingerless.getChildMeshes();
    assert.equal(fingerlessMeshes.find((m) => m.name === 'vm-fingerless-r-fingers')?.material, f.getMat(fingerlessT.skin));
    assert.equal(fingerlessMeshes.find((m) => m.name === 'vm-fingerless-l-fingers')?.material, f.getMat(fingerlessT.skin));
    assert.equal(fingerlessMeshes.find((m) => m.name === 'vm-fingerless-r-palm')?.material, f.getMat(fingerlessT.glove));
  } finally {
    f.dispose();
  }
});

test('applyOperativeAnimation differentiates weapon stances, landing compression, hit flinch, sprint lean, and converges cleanly across 60Hz/120Hz', () => {
  const f = createSceneFixture();
  try {
    const buildActor = (id, force, weapon) => {
      const operative = createTacticalOperativeMesh(force, id, f.scene, f.getMat, 0);
      const gunNode = create3DWeaponMesh(weapon, `${id}-gun`, f.scene, f.getMat, force === 't');
      gunNode.parent = new TransformNode(`${id}-gun-holder`, f.scene);
      return { operative, force, gunNode, gunWeapon: weapon };
    };

    // 1. Distinct stances for rifle vs pistol vs heavy vs knife
    const rifleActor = buildActor('st-rifle', 'ct', 'm4a1_s');
    const pistolActor = buildActor('st-pistol', 'ct', 'deagle');
    const heavyActor = buildActor('st-heavy', 'ct', 'negev');
    const knifeActor = buildActor('st-knife', 't', 'knife');

    const baseCt = makeBasePlayer('ct', 'st-ct');
    applyOperativeAnimation(rifleActor, { ...baseCt, equipped: 'm4a1_s', weapon: 'm4a1_s' }, 1, 1 / 60);
    applyOperativeAnimation(pistolActor, { ...baseCt, equipped: 'deagle', weapon: 'deagle' }, 1, 1 / 60);
    applyOperativeAnimation(heavyActor, { ...baseCt, equipped: 'negev', weapon: 'negev' }, 1, 1 / 60);
    const slashingT = { ...makeBasePlayer('t', 'st-t'), equipped: 'knife', weapon: 'knife', lastSwing: 0.9 };
    applyOperativeAnimation(knifeActor, slashingT, 1.02, 1 / 60);

    assert.ok(pistolActor.operative.rightElbowPivot.rotation.x > rifleActor.operative.rightElbowPivot.rotation.x + 0.25,
      'pistol extends right forearm more than rifle shoulder-stock grip');
    assert.ok(heavyActor.gunNode.position.y < rifleActor.gunNode.position.y - 0.02,
      'heavy weapon sits slightly lower at hip support height');
    assert.ok(Math.abs(knifeActor.operative.spine.rotation.y) > 0.1,
      'knife slash drives torso torque follow-through');
    assert.equal(rifleActor.operative.headPivot.rotation.y, 0,
      'stationary unblinded operative keeps zero idle head yaw sweep');

    // 2. Airborne jump tuck -> landing squash & recovery
    const jumpActor = buildActor('jump-actor', 'ct', 'm4a1_s');
    const jumpState = { ...baseCt, equipped: 'm4a1_s', weapon: 'm4a1_s' };
    applyOperativeAnimation(jumpActor, { ...jumpState, jump: false, jumpY: 0 }, 0.5, 1 / 60);
    applyOperativeAnimation(jumpActor, { ...jumpState, jump: true, jumpY: 0.65 }, 0.52, 1 / 60);
    const riseKneeX = jumpActor.operative.leftKneePivot.rotation.x;
    applyOperativeAnimation(jumpActor, { ...jumpState, jump: true, jumpY: 0.35 }, 0.54, 1 / 60);
    const fallKneeX = jumpActor.operative.leftKneePivot.rotation.x;
    assert.notEqual(riseKneeX, fallKneeX, 'rising and descending jump phases adjust knee tuck differently');

    applyOperativeAnimation(jumpActor, { ...jumpState, jump: false, jumpY: 0 }, 0.56, 1 / 60);
    assert.ok((jumpActor.operative.landSquash ?? 0) > 0.5, 'landing triggers impact compression impulse');
    assert.ok(jumpActor.operative.spine.position.y < 1.03, 'landing squash visibly dips pelvis/spine height');
    for (let i = 0; i < 20; i++) {
      applyOperativeAnimation(jumpActor, { ...jumpState, jump: false, jumpY: 0 }, 0.58 + i * (1 / 60), 1 / 60);
    }
    assert.ok((jumpActor.operative.landSquash ?? 1) < 0.08, 'landing squash recovers back to neutral stance');

    // 3. Non-lethal damage hit flinch
    const flinchActor = buildActor('flinch-actor', 't', 'ak47');
    const healthy = makeBasePlayer('t', 'flinch-t');
    applyOperativeAnimation(flinchActor, { ...healthy, hp: 100 }, 1.0, 1 / 60);
    applyOperativeAnimation(flinchActor, { ...healthy, hp: 60 }, 1.02, 1 / 60);
    applyOperativeAnimation(flinchActor, { ...healthy, hp: 60 }, 1.04, 1 / 60);
    assert.ok((flinchActor.operative.flinch ?? 0) > 0.5, 'non-lethal damage triggers hit flinch');
    assert.ok(Math.abs(flinchActor.operative.spine.rotation.z) > 0.02, 'hit flinch rolls torso');
    for (let i = 0; i < 20; i++) {
      applyOperativeAnimation(flinchActor, { ...healthy, hp: 60 }, 1.06 + i * (1 / 60), 1 / 60);
    }
    assert.ok((flinchActor.operative.flinch ?? 1) < 0.05, 'hit flinch recovers cleanly');

    // 4. Sprint forward lean + 60Hz vs 120Hz convergence
    const sprint60 = buildActor('conv-a', 'ct', 'm4a1_s');
    const sprint120 = buildActor('conv-b', 'ct', 'm4a1_s');
    const stepPose = (actor, dt, steps) => {
      for (let i = 0; i < steps; i++) {
        const t = i * dt;
        applyOperativeAnimation(actor, {
          ...baseCt,
          equipped: 'm4a1_s',
          weapon: 'm4a1_s',
          x: t * 2.5,
          z: t * 2.5,
          speed: 3.1,
          crouch: false,
          pitch: -0.08,
        }, t, dt);
      }
    };
    stepPose(sprint60, 1 / 60, 18);
    stepPose(sprint120, 1 / 120, 36);
    assert.ok(sprint60.operative.spine.rotation.x > 0.04, 'forward sprint produces athletic torso lean');
    const pivots60 = [
      sprint60.operative.spine, sprint60.operative.headPivot,
      sprint60.operative.leftArmPivot, sprint60.operative.rightArmPivot,
      sprint60.operative.leftElbowPivot, sprint60.operative.rightElbowPivot,
    ];
    const pivots120 = [
      sprint120.operative.spine, sprint120.operative.headPivot,
      sprint120.operative.leftArmPivot, sprint120.operative.rightArmPivot,
      sprint120.operative.leftElbowPivot, sprint120.operative.rightElbowPivot,
    ];
    for (let i = 0; i < pivots60.length; i++) {
      assert.ok(Math.abs(pivots60[i].rotation.x - pivots120[i].rotation.x) < 0.01);
      assert.ok(Math.abs(pivots60[i].rotation.y - pivots120[i].rotation.y) < 0.01);
      assert.ok(Math.abs(pivots60[i].rotation.z - pivots120[i].rotation.z) < 0.01);
    }
  } finally {
    f.dispose();
  }
});

test('Fontessa operatives use 1 CT and 1 T outfit with varied facial traits and reserve alternate outfits for map slots', () => {
  assert.equal(OPERATIVE_FACE_TRAITS.length, 5);
  const f = createSceneFixture();
  try {
    const ctIds = ['ct-alpha', 'ct-bravo', 'ct-charlie', 'ct-delta', 'ct-echo'];
    const tIds = ['t-alpha', 't-bravo', 't-charlie', 't-delta', 't-echo'];

    const ctStyles = ctIds.map((id, i) => resolveOperativeStyle('ct', id, i));
    const tStyles = tIds.map((id, i) => resolveOperativeStyle('t', id, i));
    assert.equal(new Set(ctStyles.map((s) => s.code)).size, 1, 'default Fontessa CT squad shares 1 unit outfit');
    assert.equal(new Set(tStyles.map((s) => s.code)).size, 1, 'default Fontessa T squad shares 1 unit outfit');
    assert.equal(new Set(ctStyles.map((s) => s.face?.code)).size, 5, '5 distinct facial profiles across CT squad');
    assert.equal(new Set(tStyles.map((s) => s.face?.code)).size, 5, '5 distinct facial profiles across T squad');

    const ctHeads = ctIds.map((id, i) => createTacticalOperativeMesh('ct', id, f.scene, f.getMat, i).head.scaling.clone());
    assert.ok(new Set(ctHeads.map((s) => `${s.x.toFixed(4)}:${s.y.toFixed(4)}`)).size >= 4, 'head proportions vary across look-alikes');

    // Other maps can still select all 5 CT and 5 T unit styles explicitly via mapStyleSlot
    assert.equal(new Set([0, 1, 2, 3, 4].map((slot) => resolveOperativeStyle('ct', 'm', 0, slot).code)).size, 5);
    assert.equal(new Set([0, 1, 2, 3, 4].map((slot) => resolveOperativeStyle('t', 'm', 0, slot).code)).size, 5);
  } finally {
    f.dispose();
  }
});

test('two-handed weapon IK seats both palms on grips and forends within 15mm across weapons, crouches, and pitch', () => {
  const f = createSceneFixture();
  new FreeCamera('ik-cam', new Vector3(0, 2, -5), f.scene);
  try {
    const cases = [
      { weapon: 'ak47', right: new Vector3(0, -0.058, -0.055), left: new Vector3(0, -0.010, 0.185) },
      { weapon: 'm4a1_s', right: new Vector3(0, -0.055, -0.055), left: new Vector3(0, -0.010, 0.185) },
      { weapon: 'deagle', right: new Vector3(0, -0.056, -0.030), left: new Vector3(-0.020, -0.054, -0.006) },
      { weapon: 'usp_s', right: new Vector3(0, -0.045, -0.025), left: new Vector3(-0.020, -0.048, -0.008) },
      { weapon: 'mp9', right: new Vector3(0, -0.048, -0.015), left: new Vector3(0, -0.048, 0.138) },
      { weapon: 'nova', right: new Vector3(0, -0.050, -0.055), left: new Vector3(0, 0.008, 0.195) },
      { weapon: 'sniper', right: new Vector3(0, -0.055, -0.115), left: new Vector3(0, 0.012, 0.125) },
    ];
    const palmOffset = new Vector3(0, -0.24, 0);
    const op = createTacticalOperativeMesh('ct', 'ik-check', f.scene, f.getMat, 0);

    for (const c of cases) {
      const gun = create3DWeaponMesh(c.weapon, `ik-${c.weapon}`, f.scene, f.getMat, false);
      const view = { operative: op, force: 'ct', gunNode: gun, gunWeapon: c.weapon };
      for (const [crouch, pitch] of [[false, 0], [true, 0], [false, 0.35], [false, -0.35]]) {
        if (op.poseMemory) op.poseMemory.initialized = false;
        op.crouchPose = crouch ? 1 : 0;
        op.root.position.set(1.5, 0, -0.8);
        op.root.rotation.y = 0.7;
        applyOperativeAnimation(view, {
          ...makeBasePlayer('ct', 'ik-p'),
          x: 1.5,
          z: -0.8,
          yaw: 0.7,
          pitch,
          crouch,
          equipped: c.weapon,
          weapon: c.weapon,
        }, 10, 1 / 60);
        op.root.computeWorldMatrix(true);
        op.leftElbowPivot.computeWorldMatrix(true);
        op.rightElbowPivot.computeWorldMatrix(true);
        gun.computeWorldMatrix(true);

        const rightPalm = Vector3.TransformCoordinates(palmOffset, op.rightElbowPivot.getWorldMatrix());
        const leftPalm = Vector3.TransformCoordinates(palmOffset, op.leftElbowPivot.getWorldMatrix());
        const rightSocket = Vector3.TransformCoordinates(c.right, gun.getWorldMatrix());
        const leftSocket = Vector3.TransformCoordinates(c.left, gun.getWorldMatrix());

        const errR = Vector3.Distance(rightPalm, rightSocket);
        const errL = Vector3.Distance(leftPalm, leftSocket);
        assert.ok(errR < 0.015, `${c.weapon} crouch=${crouch} pitch=${pitch} right hand err=${errR.toFixed(4)}`);
        assert.ok(errL < 0.015, `${c.weapon} crouch=${crouch} pitch=${pitch} left hand err=${errL.toFixed(4)}`);
      }
      gun.dispose();
    }
  } finally {
    f.dispose();
  }
});

test('CS2 steady walk keeps upper torso and firearms level with anatomical knee crouch', () => {
  const f = createSceneFixture();
  try {
    const op = createTacticalOperativeMesh('t', 'walk-t', f.scene, f.getMat, 1);
    const gun = create3DWeaponMesh('ak47', 'walk-ak', f.scene, f.getMat, true);
    const view = { operative: op, force: 't', gunNode: gun, gunWeapon: 'ak47' };
    const base = { ...makeBasePlayer('t', 'walk-p'), equipped: 'ak47', weapon: 'ak47', speed: 3.1 };

    const gunHeights = [];
    const spineYaws = [];
    const legAngles = [];
    for (let i = 0; i < 24; i++) {
      const t = i / 60;
      applyOperativeAnimation(view, { ...base, x: 0, z: t * 3.1 }, 5 + t, 1 / 60);
      gunHeights.push(gun.position.y);
      spineYaws.push(op.spine.rotation.y);
      legAngles.push(op.leftLegPivot.rotation.x);
    }

    const gunBobRange = Math.max(...gunHeights) - Math.min(...gunHeights);
    const spineYawRange = Math.max(...spineYaws) - Math.min(...spineYaws);
    const legSwingRange = Math.max(...legAngles) - Math.min(...legAngles);
    assert.ok(gunBobRange < 1e-4, `rifle height must not bounce during walk (range=${gunBobRange})`);
    assert.ok(spineYawRange < 1e-4, `spine must not twist sinusoidally during walk (range=${spineYawRange})`);
    assert.ok(legSwingRange > 0.35, `legs must stride visibly while running (range=${legSwingRange})`);

    // Crouch check: thighs pitch forward (-X) and knees flex backward (+X)
    for (let i = 0; i < 20; i++) {
      applyOperativeAnimation(view, { ...base, speed: 0, crouch: true }, 6 + i / 60, 1 / 60);
    }
    assert.ok(op.leftLegPivot.rotation.x < -0.4, 'crouch pitches thighs forward');
    assert.ok(op.leftKneePivot.rotation.x > 0.8, 'crouch bends knees anatomically backward');
  } finally {
    f.dispose();
  }
});

test('HE grenade detonation audio is synthesized separately from the C4 bomb explosion sample', () => {
  const audio = new FpsBroadcastAudio();
  const playedBuffers = [];
  const durations = [];
  const makeParam = () => ({ value: 0, setValueAtTime() {}, linearRampToValueAtTime() {}, exponentialRampToValueAtTime() {} });
  const fakeNode = () => ({ connect() {}, gain: makeParam(), frequency: makeParam(), Q: makeParam(), pan: makeParam(), type: 'lowpass' });
  const mockExplosionBuffer = { duration: 3.2 };
  const fakeContext = {
    sampleRate: 44100,
    currentTime: 10,
    createGain: () => fakeNode(),
    createBiquadFilter: () => fakeNode(),
    createStereoPanner: () => fakeNode(),
    createOscillator: () => ({
      ...fakeNode(),
      start() {},
      stop(endAt) { durations.push(endAt - 10); },
      onended: null,
    }),
    createBufferSource: () => {
      const src = {
        buffer: null,
        playbackRate: { value: 1 },
        connect() {},
        start() { playedBuffers.push(src.buffer); },
        stop(endAt) { durations.push(endAt - 10); },
        onended: null,
      };
      return src;
    },
  };

  Object.assign(audio, {
    context: fakeContext,
    dryBus: fakeNode(),
    wetBus: fakeNode(),
    noise: { duration: 1.6 },
    pinkNoise: { duration: 1.6 },
    explosionBuffer: mockExplosionBuffer,
  });

  audio.playHeExplode(fakeContext, 1, 0);
  assert.equal(playedBuffers.includes(mockExplosionBuffer), false, 'HE grenade must not play the C4 bomb explosion sample');
  assert.ok(durations.length >= 4 && Math.max(...durations) <= 0.45, 'HE grenade plays a punchy ~0.38s frag burst');

  playedBuffers.length = 0;
  audio.playBombExplode(fakeContext, 1, 0);
  assert.equal(playedBuffers.includes(mockExplosionBuffer), true, 'C4 bomb detonation continues to use explosionBuffer');
});

test('rig grenades follow the inventory: none carried, none shown; the one in hand leaves the pouch', () => {
  const f = createSceneFixture();
  try {
    for (const force of ['ct', 't']) {
      const op = createTacticalOperativeMesh(force, `carry-${force}`, f.scene, f.getMat);
      const shown = () => Object.fromEntries(op.utilityCarry.map((c) => [c.kind, c.mesh.isEnabled(false)]));
      assert.deepEqual(op.utilityCarry.map((c) => c.kind).sort(), ['flash', 'he', 'incendiary', 'smoke']);
      for (const c of op.utilityCarry) {
        assert.ok(c.mesh.name.includes(`-${force}-kit-`));
        assert.notEqual(c.mesh.name.endsWith('_merged'), true);
      }
      const player = { hp: 100, equipped: 'rifle', smoke: 0, flash: 0, he: 0, incendiary: 0 };
      updateOperativeUtilityCarry(op, player);
      assert.deepEqual(shown(), { smoke: false, flash: false, he: false, incendiary: false });
      updateOperativeUtilityCarry(op, { ...player, smoke: 1, flash: 2 });
      assert.deepEqual(shown(), { smoke: true, flash: true, he: false, incendiary: false });
      updateOperativeUtilityCarry(op, { ...player, smoke: 1, flash: 1, equipped: 'smoke' });
      assert.deepEqual(shown(), { smoke: false, flash: true, he: false, incendiary: false });
      updateOperativeUtilityCarry(op, { ...player, hp: 0, smoke: 1 });
      assert.equal(shown().smoke, false);
    }
  } finally {
    f.dispose();
  }
});

test('anatomically sculpted 3D human operatives mirror asymmetric limbs, sculpt front/back torso and facial skull contours', () => {
  const f = createSceneFixture();
  try {
    const op = createTacticalOperativeMesh('ct', 'anat-ct', f.scene, f.getMat, 1);
    const meshes = op.root.getChildMeshes();
    const posOf = (mesh) => Array.from(mesh.getVerticesData(VertexBuffer.PositionKind));

    // 1. Torso front (+z chest) differs from back (-z scapulae / spine)
    const torsoPts = posOf(op.torso);
    let frontMaxZ = 0, backMinZ = 0;
    for (let i = 0; i < torsoPts.length; i += 3) {
      frontMaxZ = Math.max(frontMaxZ, torsoPts[i + 2]);
      backMinZ = Math.min(backMinZ, torsoPts[i + 2]);
    }
    assert.ok(frontMaxZ > Math.abs(backMinZ) + 0.008, `pectoral projection (+z=${frontMaxZ.toFixed(4)}) exceeds back (${backMinZ.toFixed(4)})`);

    // 2. Left and right thighs & combat boots mirror medial/lateral 3D asymmetry
    const leftThigh = posOf(op.leftLeg), rightThigh = posOf(op.rightLeg);
    let leftMinX = Infinity, leftMaxX = -Infinity, rightMinX = Infinity, rightMaxX = -Infinity;
    for (let i = 0; i < rightThigh.length; i += 3) {
      leftMinX = Math.min(leftMinX, leftThigh[i]);
      leftMaxX = Math.max(leftMaxX, leftThigh[i]);
      rightMinX = Math.min(rightMinX, rightThigh[i]);
      rightMaxX = Math.max(rightMaxX, rightThigh[i]);
    }
    assert.ok(Math.abs(leftMinX + rightMaxX) < 1e-4 && Math.abs(leftMaxX + rightMinX) < 1e-4, 'mirrored thigh extents are exact X reflections');
    assert.ok(Math.abs(rightMaxX - Math.abs(rightMinX)) > 0.002, 'thigh has 3D outer/inner muscle asymmetry');

    const bootL = meshes.find((m) => m.name === 'anat-ct-boot-l');
    const bootR = meshes.find((m) => m.name === 'anat-ct-boot-r');
    assert.ok(bootL && bootR);
    const bootLPts = posOf(bootL), bootRPts = posOf(bootR);
    let asymDiff = 0;
    for (let i = 0; i < bootRPts.length; i += 3) asymDiff = Math.max(asymDiff, Math.abs(bootLPts[i] - bootRPts[i]));
    assert.ok(asymDiff > 0.004, 'left/right combat boots sculpt asymmetric medial toe sweeps');

    // 3. Head skull sculpts brow/cheek/chin projection (+z) differently from occiput/nape (-z)
    const headPts = posOf(op.head);
    let headFrontZ = 0, headBackZ = 0;
    for (let i = 0; i < headPts.length; i += 3) {
      headFrontZ = Math.max(headFrontZ, headPts[i + 2]);
      headBackZ = Math.min(headBackZ, headPts[i + 2]);
    }
    assert.ok(Math.abs(headFrontZ - Math.abs(headBackZ)) > 0.003, 'head features asymmetric anterior face vs posterior skull');

    // 4. SAS gas-mask CT variant builds thigh harness & sculpted respirator within mesh budget
    const sas = createTacticalOperativeMesh('ct', 'anat-sas', f.scene, f.getMat, 0);
    assert.equal(sas.variantStyle?.code, 'sas-fast');
    assert.ok(sas.root.getChildMeshes().length < 75, 'SAS gas-mask kit stays within mesh budget');
    assert.ok(sas.headPivot.getChildMeshes().some((m) => m.isEnabled()), 'SAS head pivot carries merged respirator parts');
  } finally {
    f.dispose();
  }
});

test('1st-person POV viewmodels use sculpted cylindrical forearms, contoured hands, and beveled AK/M4 receivers', () => {
  const f = createSceneFixture();
  try {
    const akVm = createViewmodelMesh('ak47', 'red', 'vm-pov-ak', f.scene, f.getMat, true);
    const meshes = akVm.getChildMeshes();
    const forearmL = meshes.find((m) => m.name === 'vm-pov-ak-l-forearm');
    const forearmR = meshes.find((m) => m.name === 'vm-pov-ak-r-forearm');
    const palmL = meshes.find((m) => m.name === 'vm-pov-ak-l-palm');
    const knuckleL = meshes.find((m) => m.name === 'vm-pov-ak-l-knuckle');
    const fingersL = meshes.find((m) => m.name === 'vm-pov-ak-l-fingers');
    assert.ok(forearmL && forearmR && palmL && knuckleL && fingersL);

    const vCount = (m) => (m.getVerticesData(VertexBuffer.PositionKind)?.length ?? 0) / 3;
    assert.ok(vCount(forearmL) > 80, `1P left forearm must be contoured 3D capsule geometry (got ${vCount(forearmL)} verts)`);
    assert.ok(vCount(forearmR) > 80, `1P right forearm must be contoured 3D capsule geometry (got ${vCount(forearmR)} verts)`);
    assert.ok(vCount(palmL) > 24 && vCount(fingersL) > 24, '1P hand and finger clusters are rounded 3D meshes, not raw boxes');

    assert.ok(meshes.some((m) => m.name === 'vm-pov-ak-gun-dust-cover'), 'AK-47 viewmodel has sculpted top dust cover');
    assert.ok(meshes.some((m) => m.name === 'vm-pov-ak-gun-upper-guard'), 'AK-47 viewmodel has contoured upper handguard');
    assert.ok(meshes.some((m) => m.name === 'vm-pov-ak-gun-gas-block'), 'AK-47 includes slanted gas block');
    assert.ok(meshes.some((m) => m.name === 'vm-pov-ak-gun-cleaning-rod'), 'AK-47 includes under-barrel cleaning rod');
    assert.ok(meshes.some((m) => m.name.includes('tritium')), 'firearms include 3-dot tritium iron sight beads');
    assert.ok(meshes.some((m) => m.name === 'vm-pov-ak-l-watch-case'), 'left wrist carries 3D tactical chronograph');
    assert.ok(meshes.some((m) => m.name === 'vm-pov-ak-l-digit-0') && meshes.some((m) => m.name === 'vm-pov-ak-r-digit-0'),
      'both hands sculpt individual articulated finger digits');
    assert.equal(meshes.some((m) => m.name.includes('top-rail')), false, 'AK-47 omits bulky boxy Picatinny studs along dust cover');

    const m4Vm = createViewmodelMesh('m4a1_s', 'blue', 'vm-pov-m4', f.scene, f.getMat, false);
    const m4Meshes = m4Vm.getChildMeshes();
    assert.ok(m4Meshes.some((m) => m.name === 'vm-pov-m4-gun-upper-crown'), 'M4A1-S viewmodel has rounded upper receiver crown');
    assert.ok(m4Meshes.some((m) => m.name === 'vm-pov-m4-gun-charging-handle'), 'M4A1-S includes T-charging handle');
    assert.ok(m4Meshes.some((m) => m.name === 'vm-pov-m4-gun-forward-assist'), 'M4A1-S includes forward assist');
    assert.ok(m4Meshes.some((m) => m.name === 'vm-pov-m4-r-trigger-finger'), 'right hand includes trigger finger geometry');
    assert.ok(meshes.every((m) => m.renderingGroupId === 1) && m4Meshes.every((m) => m.renderingGroupId === 1),
      '1st-person viewmodels render in foreground group 1 above smoke depth');
  } finally {
    f.dispose();
  }
});

test('crouching, planting and defusing keep headPivot cleanly above spine and aligned with forward neck tilt', () => {
  const f = createSceneFixture();
  try {
    const op = createTacticalOperativeMesh('t', 'crouch-neck-t', f.scene, f.getMat, 0);
    const gun = create3DWeaponMesh('glock', 'crouch-gun', f.scene, f.getMat, true);
    const view = { operative: op, force: 't', gunNode: gun, gunWeapon: 'glock' };
    const base = { ...makeBasePlayer('t', 'crouch-t'), equipped: 'glock', weapon: 'glock' };

    for (let i = 0; i < 35; i++) {
      applyOperativeAnimation(view, { ...base, crouch: true }, 1 + i / 60, 1 / 60);
    }
    const crouchSep = op.headPivot.position.y - op.spine.position.y;
    assert.ok(crouchSep >= 0.42, `crouched head-spine separation ${crouchSep.toFixed(3)}m must keep neck clear of torso`);
    assert.ok(op.headPivot.position.z > 0.04, `crouched head z (${op.headPivot.position.z.toFixed(3)}) tracks forward spine lean`);

    op.poseMemory.initialized = false;
    for (let i = 0; i < 20; i++) {
      applyOperativeAnimation(view, { ...base, equipped: 'bomb', weapon: 'glock', crouch: true, channel: 2.0 }, 3 + i / 60, 1 / 60);
    }
    assert.ok(op.headPivot.position.y - op.spine.position.y >= 0.40, 'planting head stays above tilted torso');
    assert.ok(op.headPivot.position.z > 0.12, `planting head z (${op.headPivot.position.z.toFixed(3)}) tracks forward plant bend`);
  } finally {
    f.dispose();
  }
});

test('semi-auto pistols animate slide blowback on firing and settle cleanly between shots', () => {
  const f = createSceneFixture();
  try {
    const op = createTacticalOperativeMesh('ct', 'recoil-ct', f.scene, f.getMat, 0);
    const deagle = create3DWeaponMesh('deagle', 'recoil-deagle', f.scene, f.getMat, false);
    const view = { operative: op, force: 'ct', gunNode: deagle, gunWeapon: 'deagle' };
    const meta = deagle.metadata;
    assert.ok(meta?.slide && meta?.slideHomeZ !== undefined, '3D Deagle tracks upper slide mesh for blowback');

    const base = { ...makeBasePlayer('ct', 'recoil-ct'), equipped: 'deagle', weapon: 'deagle', lastShot: 1.0 };
    applyOperativeAnimation(view, base, 1.03, 1 / 60);
    const kickedZ = meta.slide.position.z;
    assert.ok(kickedZ < meta.slideHomeZ - 0.015, `Deagle slide blows backward cleanly at t+0.03s (${kickedZ.toFixed(4)} vs home ${meta.slideHomeZ.toFixed(4)})`);

    applyOperativeAnimation(view, base, 1.30, 1 / 60);
    assert.ok(Math.abs(meta.slide.position.z - meta.slideHomeZ) < 1e-5, 'Deagle slide returns flush to rest position after cycle');

    const vm = createViewmodelMesh('usp_s', 'blue', 'vm-recoil-usp', f.scene, f.getMat, false);
    assert.ok(vm.metadata?.slide && vm.metadata?.slideHomeZ !== undefined, '1st-person pistol viewmodels expose slide metadata for blowback');
  } finally {
    f.dispose();
  }
});
