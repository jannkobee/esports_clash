/**
 * Meshy-Inspired Automated 3D Character Rigging Studio
 *
 * Full interactive 3D suite providing model alignment, anatomical landmark marker editing,
 * hierarchical skeleton inspection, weapon attachment, live animation playback, automated
 * 10-point validation, and pipeline execution monitoring.
 */

import React, { useEffect, useRef, useState, useMemo } from 'react';
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import type { ChampionKit } from '../types.ts';
import type {
  LandmarkName,
  LandmarksMap,
  AlignmentTransform,
  PipelineStage,
  RiggingJobStatus,
  WeaponType,
  RigValidationReport,
} from '../rigging/types.ts';
import { LANDMARK_COLORS, updateLandmarkPosition, detectLandmarksFromGeometry } from '../rigging/landmarkDetection.ts';
import { executeRiggingPipeline, type RiggingPipelineResult } from '../rigging/riggingPipeline.ts';
import { applyAlignmentTransform } from '../rigging/autoAlignment.ts';
import { createProceduralWeaponMesh } from '../rigging/weaponAttachment.ts';
import { STANDARD_BONE_NAMES } from '../rigging/skeletonGenerator.ts';
import './meshy-rigging-studio.css';

interface MeshyRiggingStudioProps {
  champion: ChampionKit;
  onClose?: () => void;
  onDeployReady?: (result: RiggingPipelineResult) => void;
}

const STAGES: { id: PipelineStage; label: string }[] = [
  { id: 'CHARACTER_GENERATED', label: 'Generate' },
  { id: 'ASSET_VALIDATION', label: 'Validate' },
  { id: 'AUTO_ALIGNMENT', label: 'Align' },
  { id: 'LANDMARK_DETECTION', label: 'Joints' },
  { id: 'SKELETON_GENERATION', label: 'Skeleton' },
  { id: 'SKINNING', label: 'Skinning' },
  { id: 'WEAPON_ATTACHMENT', label: 'Weapons' },
  { id: 'RIG_VALIDATION', label: 'Rig Check' },
  { id: 'ANIMATION_SETUP', label: 'Animate' },
  { id: 'READY', label: 'Ready' },
];

export const MeshyRiggingStudio: React.FC<MeshyRiggingStudioProps> = ({
  champion,
  onClose,
  onDeployReady,
}) => {
  const mountRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const modelGroupRef = useRef<THREE.Group>(new THREE.Group());
  const markersGroupRef = useRef<THREE.Group>(new THREE.Group());
  const skeletonHelperRef = useRef<THREE.SkeletonHelper | null>(null);
  const mixerRef = useRef<THREE.AnimationMixer | null>(null);
  const animActionsRef = useRef<Map<string, THREE.AnimationAction>>(new Map());

  // UI state
  const [activeTab, setActiveTab] = useState<'upload' | 'align' | 'joints' | 'skeleton' | 'weapons' | 'anim' | 'validation'>('upload');
  const [pipelineStatus, setPipelineStatus] = useState<RiggingJobStatus | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [pipelineResult, setPipelineResult] = useState<RiggingPipelineResult | null>(null);

  // Asset Upload & Ingestion State
  const [uploadedBodyName, setUploadedBodyName] = useState<string>('');
  const [uploadedWeaponName, setUploadedWeaponName] = useState<string>('');
  const [selectedSocket, setSelectedSocket] = useState<string>('right_hand_socket');

  // Alignment Controls State
  const [rotX, setRotX] = useState(0);
  const [rotY, setRotY] = useState(0);
  const [rotZ, setRotZ] = useState(0);
  const [offY, setOffY] = useState(0);
  const [scale, setScale] = useState(1);

  // Landmarks State
  const [landmarks, setLandmarks] = useState<LandmarksMap | null>(null);
  const [selectedLandmark, setSelectedLandmark] = useState<LandmarkName>('chest');
  const [symmetryEnabled, setSymmetryEnabled] = useState(true);

  // Weapon State
  const [weaponType, setWeaponType] = useState<WeaponType>('sword');
  const [weaponMeshRef, setWeaponMeshRef] = useState<THREE.Object3D | null>(null);

  // Animation State
  const [activeClipName, setActiveClipName] = useState<string>('idle');
  const [isPlaying, setIsPlaying] = useState(true);
  const [playbackSpeed, setPlaybackSpeed] = useState<number>(1.0);

  // Overlays
  const [showSkeleton, setShowSkeleton] = useState(true);
  const [showMarkers, setShowMarkers] = useState(true);
  const [showSilhouette, setShowSilhouette] = useState(true);

  // Camera Orbit drag tracking
  const dragRef = useRef<{ isDragging: boolean; lastX: number; lastY: number; spherical: { radius: number; theta: number; phi: number } }>({
    isDragging: false,
    lastX: 0,
    lastY: 0,
    spherical: { radius: 110, theta: Math.PI * 0.25, phi: Math.PI * 0.4 },
  });

  // 1. Initialize Three.js Viewport
  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    const width = container.clientWidth || 800;
    const height = container.clientHeight || 650;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color('#0a0f1d');
    sceneRef.current = scene;

    const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 1000);
    cameraRef.current = camera;
    updateCameraPosition();

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    container.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    // Lighting
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.9);
    scene.add(ambientLight);

    const dirLight1 = new THREE.DirectionalLight(0xffffff, 1.2);
    dirLight1.position.set(40, 80, 60);
    dirLight1.castShadow = true;
    scene.add(dirLight1);

    const dirLight2 = new THREE.DirectionalLight(0x38bdf8, 0.6);
    dirLight2.position.set(-40, 20, -40);
    scene.add(dirLight2);

    // Ground Grid & Coordinate Axis
    const grid = new THREE.GridHelper(120, 24, 0x0284c7, 0x1e293b);
    grid.position.y = 0;
    scene.add(grid);

    // Groups
    const modelGroup = new THREE.Group();
    modelGroup.name = 'studio_model_root';
    scene.add(modelGroup);
    modelGroupRef.current = modelGroup;

    const markersGroup = new THREE.Group();
    markersGroup.name = 'studio_landmarks';
    scene.add(markersGroup);
    markersGroupRef.current = markersGroup;

    // Create Base Humanoid T-Pose Mesh (or load avatar model)
    buildBaseHumanoidMesh(modelGroup);

    // Initial autonomous pipeline run
    void runAutonomousPipeline(modelGroup);

    // Render loop
    let animFrameId: number;
    let clock = new THREE.Clock();

    const animate = () => {
      animFrameId = requestAnimationFrame(animate);
      const delta = clock.getDelta();
      if (mixerRef.current && isPlaying) {
        mixerRef.current.update(delta * playbackSpeed);
      }
      renderer.render(scene, camera);
    };
    animate();

    const handleResize = () => {
      if (!container || !renderer || !camera) return;
      const w = container.clientWidth;
      const h = container.clientHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };
    window.addEventListener('resize', handleResize);

    return () => {
      cancelAnimationFrame(animFrameId);
      window.removeEventListener('resize', handleResize);
      renderer.dispose();
      if (renderer.domElement.parentElement) {
        renderer.domElement.parentElement.removeChild(renderer.domElement);
      }
    };
  }, [champion.id]);

  function updateCameraPosition() {
    const cam = cameraRef.current;
    if (!cam) return;
    const { radius, theta, phi } = dragRef.current.spherical;
    cam.position.x = radius * Math.sin(phi) * Math.sin(theta);
    cam.position.y = radius * Math.cos(phi) + 35; // Look at model center height
    cam.position.z = radius * Math.sin(phi) * Math.cos(theta);
    cam.lookAt(0, 35, 0);
  }

  // Camera Presets
  const setCameraView = (view: 'front' | 'side' | 'back' | 'top' | 'iso') => {
    const s = dragRef.current.spherical;
    switch (view) {
      case 'front':
        s.theta = 0;
        s.phi = Math.PI * 0.5;
        break;
      case 'side':
        s.theta = Math.PI * 0.5;
        s.phi = Math.PI * 0.5;
        break;
      case 'back':
        s.theta = Math.PI;
        s.phi = Math.PI * 0.5;
        break;
      case 'top':
        s.theta = 0;
        s.phi = 0.05;
        break;
      case 'iso':
        s.theta = Math.PI * 0.25;
        s.phi = Math.PI * 0.38;
        break;
    }
    updateCameraPosition();
  };

  // Procedural base demonstration; generated species anatomy comes from its own source.
  function buildBaseHumanoidMesh(root: THREE.Group) {
    // Clear children
    while (root.children.length > 0) {
      root.remove(root.children[0]);
    }

    const skinMat = new THREE.MeshStandardMaterial({ color: '#999999', roughness: 0.8 });
    const clothMat = skinMat;
    const armorMat = skinMat;

    // Torso / Chest
    const torso = new THREE.Mesh(new THREE.CylinderGeometry(5.2, 4.4, 18, 12), clothMat);
    torso.position.set(0, 44, 0);
    root.add(torso);

    // Pelvis
    const pelvis = new THREE.Mesh(new THREE.CylinderGeometry(4.4, 4.0, 7, 10), armorMat);
    pelvis.position.set(0, 32, 0);
    root.add(pelvis);

    // Neck & Head
    const neck = new THREE.Mesh(new THREE.CylinderGeometry(2.0, 2.3, 4, 8), skinMat);
    neck.position.set(0, 55, 0);
    root.add(neck);

    const head = new THREE.Mesh(new THREE.SphereGeometry(4.8, 16, 16), skinMat);
    head.position.set(0, 61, 0);
    root.add(head);

    // Left Arm (T-pose: extending along +X)
    const upperArmL = new THREE.Mesh(new THREE.CylinderGeometry(2.2, 1.9, 14, 8), clothMat);
    upperArmL.rotation.z = Math.PI * 0.5;
    upperArmL.position.set(12, 50, 0);
    root.add(upperArmL);

    const foreArmL = new THREE.Mesh(new THREE.CylinderGeometry(1.8, 1.5, 14, 8), skinMat);
    foreArmL.rotation.z = Math.PI * 0.5;
    foreArmL.position.set(26, 50, 0);
    root.add(foreArmL);

    const handL = new THREE.Mesh(new THREE.BoxGeometry(3.5, 1.5, 3.0), skinMat);
    handL.position.set(34, 50, 0);
    root.add(handL);

    // Right Arm (T-pose: extending along -X)
    const upperArmR = new THREE.Mesh(new THREE.CylinderGeometry(2.2, 1.9, 14, 8), clothMat);
    upperArmR.rotation.z = -Math.PI * 0.5;
    upperArmR.position.set(-12, 50, 0);
    root.add(upperArmR);

    const foreArmR = new THREE.Mesh(new THREE.CylinderGeometry(1.8, 1.5, 14, 8), skinMat);
    foreArmR.rotation.z = -Math.PI * 0.5;
    foreArmR.position.set(-26, 50, 0);
    root.add(foreArmR);

    const handR = new THREE.Mesh(new THREE.BoxGeometry(3.5, 1.5, 3.0), skinMat);
    handR.position.set(-34, 50, 0);
    root.add(handR);

    // Rotate actual base geometry around each shoulder into the static A-pose.
    for (const [sign, parts] of [[1, [upperArmL, foreArmL, handL]], [-1, [upperArmR, foreArmR, handR]]] as const) {
      const pivot = new THREE.Vector3(sign * 5, 50, 0);
      const rotation = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), -sign * Math.PI / 4);
      for (const part of parts) {
        part.position.sub(pivot).applyQuaternion(rotation).add(pivot);
        part.quaternion.premultiply(rotation);
      }
    }

    // Left Leg
    const thighL = new THREE.Mesh(new THREE.CylinderGeometry(2.8, 2.3, 16, 8), clothMat);
    thighL.position.set(4.5, 21, 0);
    root.add(thighL);

    const calfL = new THREE.Mesh(new THREE.CylinderGeometry(2.2, 1.8, 16, 8), armorMat);
    calfL.position.set(4.5, 8, 0);
    root.add(calfL);

    const footL = new THREE.Mesh(new THREE.BoxGeometry(3.2, 2.0, 7.0), armorMat);
    footL.position.set(4.5, 1, 2.0);
    root.add(footL);

    // Right Leg
    const thighR = new THREE.Mesh(new THREE.CylinderGeometry(2.8, 2.3, 16, 8), clothMat);
    thighR.position.set(-4.5, 21, 0);
    root.add(thighR);

    const calfR = new THREE.Mesh(new THREE.CylinderGeometry(2.2, 1.8, 16, 8), armorMat);
    calfR.position.set(-4.5, 8, 0);
    root.add(calfR);

    const footR = new THREE.Mesh(new THREE.BoxGeometry(3.2, 2.0, 7.0), armorMat);
    footR.position.set(-4.5, 1, 2.0);
    root.add(footR);
  }

  // 2. Autonomous Pipeline Execution
  const runAutonomousPipeline = async (model: THREE.Group) => {
    setIsProcessing(true);
    try {
      const result = await executeRiggingPipeline(model, champion.id, {
        targetHeight: 70,
        onProgress: (status) => setPipelineStatus(status),
      });

      setPipelineResult(result);
      setLandmarks(result.landmarks);

      // Render 3D joint landmark spheres
      renderLandmarkMarkers(result.landmarks);

      // Add SkeletonHelper overlay
      if (sceneRef.current && result.constructedSkeleton.skeleton) {
        if (skeletonHelperRef.current) {
          sceneRef.current.remove(skeletonHelperRef.current);
        }
        const skHelper = new THREE.SkeletonHelper(result.constructedSkeleton.rootBone);
        (skHelper.material as THREE.LineBasicMaterial).linewidth = 2;
        (skHelper.material as THREE.LineBasicMaterial).color.set('#00ffcc');
        sceneRef.current.add(skHelper);
        skeletonHelperRef.current = skHelper;
      }

      // Initialize Animation Mixer
      if (result.animationClips && result.constructedSkeleton.rootBone) {
        const mixer = new THREE.AnimationMixer(model);
        mixerRef.current = mixer;
        animActionsRef.current.clear();

        for (const clip of result.animationClips.clips) {
          const action = mixer.clipAction(clip);
          animActionsRef.current.set(clip.name.toLowerCase(), action);
        }

        // Play default Idle clip
        const idleAction = animActionsRef.current.get('idle');
        if (idleAction) {
          idleAction.play();
        }
      }
    } catch (err) {
      console.error('Rigging pipeline execution error:', err);
    } finally {
      setIsProcessing(false);
    }
  };

  // Render 3D Landmark Markers
  function renderLandmarkMarkers(lm: LandmarksMap) {
    const group = markersGroupRef.current;
    if (!group) return;

    while (group.children.length > 0) {
      group.remove(group.children[0]);
    }

    const sphereGeo = new THREE.SphereGeometry(1.2, 12, 12);

    for (const [name, data] of Object.entries(lm) as [LandmarkName, LandmarksMap[LandmarkName]][]) {
      const mat = new THREE.MeshBasicMaterial({
        color: LANDMARK_COLORS[name] ?? '#ffffff',
        wireframe: false,
      });
      const marker = new THREE.Mesh(sphereGeo, mat);
      marker.position.set(...data.position);
      marker.name = `marker_${name}`;
      marker.userData.landmarkName = name;
      group.add(marker);
    }
  }

  // Handle Landmark Manual Adjustment
  const handleMarkerCoordChange = (axisIndex: 0 | 1 | 2, value: number) => {
    if (!landmarks) return;
    const currentPos = [...landmarks[selectedLandmark].position] as [number, number, number];
    currentPos[axisIndex] = value;

    const updated = updateLandmarkPosition(landmarks, selectedLandmark, currentPos, symmetryEnabled);
    setLandmarks(updated);
    renderLandmarkMarkers(updated);
  };

  // Switch Animation Clip
  const playClip = (clipName: string) => {
    setActiveClipName(clipName);
    const mixer = mixerRef.current;
    if (!mixer) return;

    // Cross-fade to selected clip
    const targetAction = animActionsRef.current.get(clipName.toLowerCase());
    if (targetAction) {
      animActionsRef.current.forEach((action) => action.stop());
      targetAction.reset().fadeIn(0.2).play();
    }
  };

  // Change Weapon
  const handleWeaponChange = (type: WeaponType) => {
    setWeaponType(type);
    if (!modelGroupRef.current) return;

    // Remove existing weapon
    const rightGrip = modelGroupRef.current.getObjectByName('right-grip') ?? modelGroupRef.current.getObjectByName('HandR');
    if (rightGrip) {
      const oldWeapon = rightGrip.children.find((c) => c.name.startsWith('weapon_'));
      if (oldWeapon) rightGrip.remove(oldWeapon);

      const newWeapon = createProceduralWeaponMesh(type, champion.name);
      rightGrip.add(newWeapon);
      setWeaponMeshRef(newWeapon);
    }
  };

  // Visibility Toggles
  useEffect(() => {
    if (skeletonHelperRef.current) {
      skeletonHelperRef.current.visible = showSkeleton;
    }
  }, [showSkeleton]);

  useEffect(() => {
    if (markersGroupRef.current) {
      markersGroupRef.current.visible = showMarkers;
    }
  }, [showMarkers]);

  // Orbit drag events on viewport canvas
  const handlePointerDown = (e: React.PointerEvent) => {
    dragRef.current.isDragging = true;
    dragRef.current.lastX = e.clientX;
    dragRef.current.lastY = e.clientY;
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!dragRef.current.isDragging) return;
    const dx = e.clientX - dragRef.current.lastX;
    const dy = e.clientY - dragRef.current.lastY;
    dragRef.current.lastX = e.clientX;
    dragRef.current.lastY = e.clientY;

    const s = dragRef.current.spherical;
    s.theta -= dx * 0.01;
    s.phi = Math.max(0.05, Math.min(Math.PI - 0.05, s.phi - dy * 0.01));
    updateCameraPosition();
  };

  const handlePointerUp = () => {
    dragRef.current.isDragging = false;
  };

  const handleWheel = (e: React.WheelEvent) => {
    const s = dragRef.current.spherical;
    s.radius = Math.max(30, Math.min(250, s.radius + e.deltaY * 0.1));
    updateCameraPosition();
  };

  return (
    <div className="meshy-studio">
      {/* Header */}
      <div className="meshy-studio__header">
        <div className="meshy-studio__title">
          <span className="meshy-studio__badge">Meshy-Inspired Auto-Rigging</span>
          <h2>{champion.displayName} &middot; 3D Production Studio</h2>
        </div>
        <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
          <button
            type="button"
            className="meshy-btn-primary"
            disabled={isProcessing}
            onClick={() => runAutonomousPipeline(modelGroupRef.current)}
          >
            {isProcessing ? '⚡ Processing Pipeline…' : '▶ Run Autonomous Pipeline'}
          </button>
          {onClose && (
            <button type="button" className="meshy-btn-secondary" onClick={onClose}>
              ✕ Close Studio
            </button>
          )}
        </div>
      </div>

      {/* 10-Stage Pipeline Stepper */}
      <div className="meshy-stepper">
        {STAGES.map((stage, idx) => {
          const isDone = pipelineResult !== null || (pipelineStatus && (STAGES.findIndex((s) => s.id === pipelineStatus.currentStage) > idx));
          const isActive = pipelineStatus?.currentStage === stage.id;
          return (
            <div
              key={stage.id}
              className={`meshy-step ${isActive ? 'meshy-step--active' : ''} ${isDone ? 'meshy-step--completed' : ''}`}
            >
              <div className="meshy-step__bubble">
                {isDone ? '✓' : idx + 1}
              </div>
              <span className="meshy-step__label">{stage.label}</span>
            </div>
          );
        })}
      </div>

      {/* Body */}
      <div className="meshy-studio__body">
        {/* Viewport */}
        <div
          ref={mountRef}
          className="meshy-viewport-container"
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerUp}
          onWheel={handleWheel}
        >
          {/* Camera Presets */}
          <div className="meshy-camera-presets">
            <button type="button" className="meshy-btn-view" onClick={() => setCameraView('front')}>Front</button>
            <button type="button" className="meshy-btn-view" onClick={() => setCameraView('side')}>Side</button>
            <button type="button" className="meshy-btn-view" onClick={() => setCameraView('back')}>Back</button>
            <button type="button" className="meshy-btn-view" onClick={() => setCameraView('top')}>Top</button>
            <button type="button" className="meshy-btn-view meshy-btn-view--active" onClick={() => setCameraView('iso')}>3/4 View</button>
          </div>

          {/* Viewport Overlays */}
          <div className="meshy-viewport-overlays">
            <button
              type="button"
              className={`meshy-toggle-btn ${showSkeleton ? 'meshy-toggle-btn--active' : ''}`}
              onClick={() => setShowSkeleton((v) => !v)}
            >
              🦴 Skeleton {showSkeleton ? 'ON' : 'OFF'}
            </button>
            <button
              type="button"
              className={`meshy-toggle-btn ${showMarkers ? 'meshy-toggle-btn--active' : ''}`}
              onClick={() => setShowMarkers((v) => !v)}
            >
              📍 Joint Markers {showMarkers ? 'ON' : 'OFF'}
            </button>
          </div>
        </div>

        {/* Sidebar Controls */}
        <div className="meshy-sidebar">
          {/* Navigation Tabs */}
          <div className="meshy-tabs">
            <button
              type="button"
              className={`meshy-tab ${activeTab === 'upload' ? 'meshy-tab--active' : ''}`}
              onClick={() => setActiveTab('upload')}
            >
              Requirements &amp; Upload
            </button>
            <button
              type="button"
              className={`meshy-tab ${activeTab === 'align' ? 'meshy-tab--active' : ''}`}
              onClick={() => setActiveTab('align')}
            >
              Alignment
            </button>
            <button
              type="button"
              className={`meshy-tab ${activeTab === 'joints' ? 'meshy-tab--active' : ''}`}
              onClick={() => setActiveTab('joints')}
            >
              Joints
            </button>
            <button
              type="button"
              className={`meshy-tab ${activeTab === 'skeleton' ? 'meshy-tab--active' : ''}`}
              onClick={() => setActiveTab('skeleton')}
            >
              Skeleton
            </button>
            <button
              type="button"
              className={`meshy-tab ${activeTab === 'weapons' ? 'meshy-tab--active' : ''}`}
              onClick={() => setActiveTab('weapons')}
            >
              Weapons
            </button>
            <button
              type="button"
              className={`meshy-tab ${activeTab === 'anim' ? 'meshy-tab--active' : ''}`}
              onClick={() => setActiveTab('anim')}
            >
              Animations
            </button>
            <button
              type="button"
              className={`meshy-tab ${activeTab === 'validation' ? 'meshy-tab--active' : ''}`}
              onClick={() => setActiveTab('validation')}
            >
              Checks
            </button>
          </div>

          {/* Tab 0: Asset Requirements & Ingestion */}
          {activeTab === 'upload' && (
            <div className="meshy-panel">
              <h3 className="meshy-panel__title">Dual Asset Requirements (Phase 1)</h3>
              <p className="meshy-panel__desc">
                Start with a clean adult base in a wide, symmetrical A-pose. Validate its deformation before fitting clothing, hair and separate equipment. Preserve species anatomy; other body types need a compatible rig.
              </p>

              <div className="meshy-contract-spec" style={{ borderLeft: '3px solid #10b981' }}>
                <h4 style={{ color: '#34d399' }}>🧍 Requirement 1: Neutral Humanoid T-Pose Body</h4>
                <ul>
                  <li><strong>Arms Horizontal (90°):</strong> Both arms fully extended sideways, palms down.</li>
                  <li><strong>Legs Separated:</strong> Straight legs shoulder-width apart, feet flat on the ground plane.</li>
                  <li><strong>STRICT INVARIANT &mdash; ZERO MERGED WEAPONS:</strong> Bare open hands with separated fingers. No swords, staffs, shields, bows, or guns merged into body mesh.</li>
                </ul>
              </div>

              <div className="meshy-contract-spec" style={{ borderLeft: '3px solid #6366f1' }}>
                <h4 style={{ color: '#a5b4fc' }}>⚔️ Requirement 2: Separate Modular Weapon Asset</h4>
                <ul>
                  <li><strong>Isolated 3D Mesh:</strong> Standalone GLB model or concept PNG cutout of weapon only.</li>
                  <li><strong>Origin Pivot:</strong> Primary handle/grip centered at origin (0, 0, 0) for natural socket placement.</li>
                  <li><strong>Modular Sockets:</strong> Attaches to <code>right_hand_socket</code>, <code>left_hand_socket</code>, <code>weapon_primary</code>, or <code>weapon_secondary</code>.</li>
                  <li><strong>Zero Skin Contamination:</strong> Keeps weapons rigid so they never deform like rubber with humanoid skinning weights.</li>
                </ul>
              </div>

              <div style={{ marginTop: '0.75rem' }}>
                <label className="meshy-upload-zone" style={{ display: 'block' }}>
                  <div className="zone-title">🧍 Upload Character Body Asset (.glb / .gltf / .png)</div>
                  <p>Clean base in a static A-pose, straight arms 45° down and out, clear joint gaps, no outfit or held objects</p>
                  <input
                    type="file"
                    accept=".glb,.gltf,image/png"
                    style={{ display: 'none' }}
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (!file) return;
                      setUploadedBodyName(file.name);
                      if (file.name.endsWith('.glb') || file.name.endsWith('.gltf')) {
                        const url = URL.createObjectURL(file);
                        const loader = new GLTFLoader();
                        loader.load(url, (gltf) => {
                          while (modelGroupRef.current.children.length > 0) {
                            modelGroupRef.current.remove(modelGroupRef.current.children[0]);
                          }
                          modelGroupRef.current.add(gltf.scene);
                          URL.revokeObjectURL(url);
                        });
                      }
                    }}
                  />
                  {uploadedBodyName && (
                    <div className="meshy-file-selected">✓ Body Loaded: {uploadedBodyName}</div>
                  )}
                </label>

                <label className="meshy-upload-zone" style={{ display: 'block', borderColor: 'rgba(99, 102, 241, 0.4)', background: 'rgba(99, 102, 241, 0.04)' }}>
                  <div className="zone-title" style={{ color: '#a5b4fc' }}>⚔️ Upload Separate Modular Weapon (.glb / .gltf / .png)</div>
                  <p>Standalone weapon asset centered at origin (0, 0, 0) for socket attachment</p>
                  <input
                    type="file"
                    accept=".glb,.gltf,image/png"
                    style={{ display: 'none' }}
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (!file) return;
                      setUploadedWeaponName(file.name);
                    }}
                  />
                  {uploadedWeaponName && (
                    <div className="meshy-file-selected">✓ Weapon Loaded: {uploadedWeaponName}</div>
                  )}
                </label>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem', marginBottom: '0.75rem' }}>
                  <div>
                    <label style={{ fontSize: '0.7rem', color: '#94a3b8', display: 'block', marginBottom: '0.2rem' }}>Weapon Class</label>
                    <select
                      value={weaponType}
                      onChange={(e) => setWeaponType(e.target.value as WeaponType)}
                      style={{ width: '100%', background: '#0f172a', border: '1px solid #334155', borderRadius: '0.35rem', color: '#f1f5f9', padding: '0.35rem', fontSize: '0.75rem' }}
                    >
                      <option value="sword">One-Handed Sword</option>
                      <option value="dual_daggers">Dual Daggers</option>
                      <option value="staff">Magic Staff</option>
                      <option value="bow">Bow / Crossbow</option>
                      <option value="two_handed">Two-Handed Heavy</option>
                      <option value="gun">Gun / Firearm</option>
                    </select>
                  </div>
                  <div>
                    <label style={{ fontSize: '0.7rem', color: '#94a3b8', display: 'block', marginBottom: '0.2rem' }}>Target Socket</label>
                    <select
                      value={selectedSocket}
                      onChange={(e) => setSelectedSocket(e.target.value)}
                      style={{ width: '100%', background: '#0f172a', border: '1px solid #334155', borderRadius: '0.35rem', color: '#f1f5f9', padding: '0.35rem', fontSize: '0.75rem' }}
                    >
                      <option value="right_hand_socket">Right Hand (right_hand_socket)</option>
                      <option value="left_hand_socket">Left Hand (left_hand_socket)</option>
                      <option value="weapon_primary">Primary Weapon Mount (weapon_primary)</option>
                      <option value="weapon_secondary">Secondary Weapon Mount (weapon_secondary)</option>
                      <option value="weapon_tip">Weapon Tip / Blade (weapon_tip)</option>
                      <option value="weapon_muzzle">Weapon Muzzle (weapon_muzzle)</option>
                    </select>
                  </div>
                </div>

                <button
                  type="button"
                  className="meshy-btn-primary"
                  style={{ width: '100%', padding: '0.7rem', fontWeight: 800, fontSize: '0.8rem', background: 'linear-gradient(135deg, #059669, #0ea5e9)' }}
                  disabled={isProcessing}
                  onClick={() => {
                    runAutonomousPipeline(modelGroupRef.current);
                    setActiveTab('align');
                  }}
                >
                  {isProcessing ? '⏳ Processing Automated Pipeline...' : '⚡ Run Automated Meshy Rigging Pipeline'}
                </button>
              </div>
            </div>
          )}

          {/* Tab 1: Alignment */}
          {activeTab === 'align' && (
            <div className="meshy-panel">
              <h3 className="meshy-panel__title">Model Alignment (Phase 2)</h3>
              <p className="meshy-panel__desc">
                Adjust 3D rotation, height, and ground alignment. The system automatically centers and uprights the character.
              </p>

              <div className="meshy-control-group">
                <div className="meshy-slider-row">
                  <label>Rotate X</label>
                  <input
                    type="range"
                    min="-180"
                    max="180"
                    value={rotX}
                    onChange={(e) => {
                      const v = Number(e.target.value);
                      setRotX(v);
                      modelGroupRef.current.rotation.x = THREE.MathUtils.degToRad(v);
                    }}
                  />
                  <span className="meshy-slider-val">{rotX}°</span>
                </div>
                <div className="meshy-slider-row">
                  <label>Rotate Y (Yaw)</label>
                  <input
                    type="range"
                    min="-180"
                    max="180"
                    value={rotY}
                    onChange={(e) => {
                      const v = Number(e.target.value);
                      setRotY(v);
                      modelGroupRef.current.rotation.y = THREE.MathUtils.degToRad(v);
                    }}
                  />
                  <span className="meshy-slider-val">{rotY}°</span>
                </div>
                <div className="meshy-slider-row">
                  <label>Rotate Z</label>
                  <input
                    type="range"
                    min="-180"
                    max="180"
                    value={rotZ}
                    onChange={(e) => {
                      const v = Number(e.target.value);
                      setRotZ(v);
                      modelGroupRef.current.rotation.z = THREE.MathUtils.degToRad(v);
                    }}
                  />
                  <span className="meshy-slider-val">{rotZ}°</span>
                </div>
              </div>

              <div className="meshy-control-group">
                <div className="meshy-slider-row">
                  <label>Ground Y</label>
                  <input
                    type="range"
                    min="-15"
                    max="15"
                    step="0.5"
                    value={offY}
                    onChange={(e) => {
                      const v = Number(e.target.value);
                      setOffY(v);
                      modelGroupRef.current.position.y = v;
                    }}
                  />
                  <span className="meshy-slider-val">{offY}</span>
                </div>
                <div className="meshy-slider-row">
                  <label>Scale</label>
                  <input
                    type="range"
                    min="0.5"
                    max="2.0"
                    step="0.05"
                    value={scale}
                    onChange={(e) => {
                      const v = Number(e.target.value);
                      setScale(v);
                      modelGroupRef.current.scale.setScalar(v);
                    }}
                  />
                  <span className="meshy-slider-val">{scale.toFixed(2)}x</span>
                </div>
              </div>

              <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem' }}>
                <button
                  type="button"
                  className="meshy-btn-secondary"
                  style={{ flex: 1 }}
                  onClick={() => {
                    modelGroupRef.current.position.set(0, 0, 0);
                    modelGroupRef.current.rotation.set(0, 0, 0);
                    modelGroupRef.current.scale.set(1, 1, 1);
                    setRotX(0);
                    setRotY(0);
                    setRotZ(0);
                    setOffY(0);
                    setScale(1);
                  }}
                >
                  Reset Transforms
                </button>
                <button
                  type="button"
                  className="meshy-btn-primary"
                  style={{ flex: 1 }}
                  onClick={() => {
                    if (pipelineResult?.alignmentTransform) {
                      applyAlignmentTransform(modelGroupRef.current, pipelineResult.alignmentTransform);
                      setOffY(pipelineResult.alignmentTransform.positionOffset[1]);
                    }
                  }}
                >
                  Auto-Align Model
                </button>
              </div>
            </div>
          )}

          {/* Tab 2: Anatomical Joint Markers */}
          {activeTab === 'joints' && (
            <div className="meshy-panel">
              <h3 className="meshy-panel__title">Anatomical Joint Markers (Phase 3)</h3>
              <p className="meshy-panel__desc">
                Select and adjust 3D joint landmark coordinates. Bilateral symmetry automatically mirrors edits across the sagittal plane.
              </p>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.75rem', cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={symmetryEnabled}
                    onChange={(e) => setSymmetryEnabled(e.target.checked)}
                  />
                  <span>Mirror Sagittal Symmetry (X = -X)</span>
                </label>
                <button
                  type="button"
                  className="meshy-btn-secondary"
                  onClick={() => {
                    const fresh = detectLandmarksFromGeometry(modelGroupRef.current);
                    setLandmarks(fresh);
                    renderLandmarkMarkers(fresh);
                  }}
                >
                  Re-Detect
                </button>
              </div>

              {landmarks && (
                <div className="meshy-control-group">
                  <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#38bdf8' }}>
                    Active: {selectedLandmark} (Confidence: {((landmarks[selectedLandmark]?.confidence ?? 1) * 100).toFixed(0)}%)
                  </span>
                  <div className="meshy-slider-row">
                    <label>Pos X</label>
                    <input
                      type="range"
                      min="-45"
                      max="45"
                      step="0.5"
                      value={landmarks[selectedLandmark]?.position[0] ?? 0}
                      onChange={(e) => handleMarkerCoordChange(0, Number(e.target.value))}
                    />
                    <span className="meshy-slider-val">{landmarks[selectedLandmark]?.position[0]?.toFixed(1)}</span>
                  </div>
                  <div className="meshy-slider-row">
                    <label>Pos Y</label>
                    <input
                      type="range"
                      min="0"
                      max="75"
                      step="0.5"
                      value={landmarks[selectedLandmark]?.position[1] ?? 35}
                      onChange={(e) => handleMarkerCoordChange(1, Number(e.target.value))}
                    />
                    <span className="meshy-slider-val">{landmarks[selectedLandmark]?.position[1]?.toFixed(1)}</span>
                  </div>
                  <div className="meshy-slider-row">
                    <label>Pos Z</label>
                    <input
                      type="range"
                      min="-20"
                      max="20"
                      step="0.5"
                      value={landmarks[selectedLandmark]?.position[2] ?? 0}
                      onChange={(e) => handleMarkerCoordChange(2, Number(e.target.value))}
                    />
                    <span className="meshy-slider-val">{landmarks[selectedLandmark]?.position[2]?.toFixed(1)}</span>
                  </div>
                </div>
              )}

              {/* Landmark List */}
              <div className="meshy-landmark-list">
                {landmarks &&
                  (Object.keys(landmarks) as LandmarkName[]).map((name) => {
                    const item = landmarks[name];
                    const isSelected = selectedLandmark === name;
                    return (
                      <div
                        key={name}
                        className={`meshy-landmark-item ${isSelected ? 'meshy-landmark-item--selected' : ''}`}
                        onClick={() => setSelectedLandmark(name)}
                      >
                        <div style={{ display: 'flex', alignItems: 'center' }}>
                          <span className="meshy-landmark-dot" style={{ backgroundColor: LANDMARK_COLORS[name] }} />
                          <span>{name}</span>
                        </div>
                        <span className="meshy-conf-badge">{(item.confidence * 100).toFixed(0)}%</span>
                      </div>
                    );
                  })}
              </div>
            </div>
          )}

          {/* Tab 3: Skeleton & Hierarchy */}
          {activeTab === 'skeleton' && (
            <div className="meshy-panel">
              <h3 className="meshy-panel__title">Skeletal Hierarchy & Rig (Phase 4)</h3>
              <p className="meshy-panel__desc">
                Standard humanoid 18-bone hierarchy with native game engine helper attachments.
              </p>

              <div className="meshy-control-group">
                <span style={{ fontSize: '0.75rem', fontWeight: 600, color: '#94a3b8' }}>
                  Total Bones: {STANDARD_BONE_NAMES.length} &middot; Vertex Influences: Max 4 (glTF)
                </span>
                <span style={{ fontSize: '0.7rem', color: '#10b981' }}>
                  ✓ Native Helpers: avatar-root, left-arm, right-arm, leg:-1, leg:1
                </span>
              </div>

              <div className="meshy-landmark-list">
                {STANDARD_BONE_NAMES.map((boneName) => (
                  <div key={boneName} className="meshy-landmark-item">
                    <span>🦴 {boneName}</span>
                    <span style={{ fontSize: '0.65rem', color: '#64748b' }}>Armature</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Tab 4: Weapon Attachment */}
          {activeTab === 'weapons' && (
            <div className="meshy-panel">
              <h3 className="meshy-panel__title">Weapon Sockets (Phase 5)</h3>
              <p className="meshy-panel__desc">
                Attach modular 3D weapon assets to character hand sockets with weapon-specific transforms.
              </p>

              <div className="meshy-control-group">
                <label style={{ fontSize: '0.75rem', fontWeight: 600, color: '#94a3b8' }}>
                  Weapon Class
                </label>
                <select
                  style={{
                    background: '#1e293b',
                    color: '#f8fafc',
                    padding: '0.4rem',
                    borderRadius: '0.35rem',
                    border: '1px solid rgba(255,255,255,0.1)',
                  }}
                  value={weaponType}
                  onChange={(e) => handleWeaponChange(e.target.value as WeaponType)}
                >
                  <option value="sword">One-Handed Sword (Sunblade)</option>
                  <option value="dual_daggers">Dual Crescent Daggers</option>
                  <option value="staff">Arcane Staff / Wand</option>
                  <option value="bow">Composite Recurve Bow</option>
                  <option value="two_handed">Two-Handed Greatsword</option>
                  <option value="gun">Double-Barrel Flak Gun</option>
                </select>
              </div>

              <div className="meshy-control-group">
                <span style={{ fontSize: '0.75rem', fontWeight: 600, color: '#38bdf8' }}>
                  Socket: right_hand_socket (Primary Grip)
                </span>
                <p style={{ fontSize: '0.7rem', color: '#94a3b8' }}>
                  Tip Marker: <code>weapon_tip</code> &middot; Muzzle: <code>weapon_muzzle</code>
                </p>
              </div>
            </div>
          )}

          {/* Tab 5: Animations */}
          {activeTab === 'anim' && (
            <div className="meshy-panel">
              <h3 className="meshy-panel__title">Humanoid Animations (Phase 6)</h3>
              <p className="meshy-panel__desc">
                Preview retargeted locomotion and combat clips with smooth skeletal deformation.
              </p>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.4rem' }}>
                {['idle', 'walk', 'run', 'attack', 'cast', 'hit', 'death'].map((clip) => (
                  <button
                    key={clip}
                    type="button"
                    className={`meshy-btn-secondary ${activeClipName === clip ? 'meshy-btn-view--active' : ''}`}
                    onClick={() => playClip(clip)}
                  >
                    {clip.toUpperCase()}
                  </button>
                ))}
              </div>

              <div className="meshy-control-group" style={{ marginTop: '0.5rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <button
                    type="button"
                    className="meshy-btn-primary"
                    style={{ flex: 1, marginRight: '0.5rem' }}
                    onClick={() => setIsPlaying((p) => !p)}
                  >
                    {isPlaying ? '⏸ Pause' : '▶ Play'}
                  </button>
                  <div style={{ display: 'flex', gap: '0.25rem' }}>
                    {[0.5, 1.0, 2.0].map((spd) => (
                      <button
                        key={spd}
                        type="button"
                        className={`meshy-btn-view ${playbackSpeed === spd ? 'meshy-btn-view--active' : ''}`}
                        onClick={() => setPlaybackSpeed(spd)}
                      >
                        {spd}x
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Tab 6: Validation Checks */}
          {activeTab === 'validation' && (
            <div className="meshy-panel">
              <h3 className="meshy-panel__title">Rig Validation Report (Phase 7)</h3>
              <p className="meshy-panel__desc">
                Automated 10-point structural integrity and deformation verification suite.
              </p>

              <div className="meshy-landmark-list">
                {pipelineResult?.validationReport.checks.map((check) => (
                  <div key={check.id} className="meshy-check-item">
                    <span className={`meshy-check-status ${check.passed ? 'meshy-check-status--passed' : 'meshy-check-status--warning'}`}>
                      {check.passed ? '✓' : '!'}
                    </span>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 600, color: check.passed ? '#f8fafc' : '#f59e0b' }}>
                        {check.name}
                      </div>
                      <div style={{ fontSize: '0.65rem', color: '#94a3b8', marginTop: '0.15rem' }}>
                        {check.message}
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {pipelineResult && (
                <button
                  type="button"
                  className="meshy-btn-primary"
                  style={{ marginTop: '0.75rem' }}
                  onClick={() => onDeployReady?.(pipelineResult)}
                >
                  🚀 Accept & Deploy to Game Roster
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
