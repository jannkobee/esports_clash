import * as THREE from 'three';
import { AvatarModelResources, buildAvatarModel, type AvatarModel } from './threeAvatarModels.ts';
import type { ChampionKit } from './types.ts';
import { AvatarAssetLibrary } from './avatarModelAssets.ts';
import { disposeArenaTerrainResources } from './threeArenaTerrain.ts';
import {combatDuration} from './avatarCombatMotion.ts';

export class AvatarPreview {
  private readonly renderer: THREE.WebGLRenderer;
  private readonly scene = new THREE.Scene();
  private readonly camera = new THREE.OrthographicCamera(-70, 70, 70, -70, .1, 1200);
  private readonly resources: AvatarModelResources;
  private readonly assets: AvatarAssetLibrary;
  private kit?: ChampionKit;
  private readonly resize: ResizeObserver;
  private readonly visibility: IntersectionObserver;
  private readonly host: HTMLElement;
  private model?: AvatarModel;
  private yaw = .6;
  private pose = 'idle';
  private motion = false;
  private visible = true;
  private available = true;
  private disposed = false;
  private frame = 0;
  private second = .35;
  private lastTime = 0;
  private width = 0;
  private height = 0;
  private pixelRatio = 0;
  private readonly status: (available: boolean) => void;

  private readonly lost = (event: Event) => { event.preventDefault(); this.available = false; this.status(false); };
  private readonly restored = () => { this.available = true; this.status(true); this.requestFrame(); };

  constructor(host: HTMLElement, status: (available: boolean) => void) {
    this.host = host; this.status = status;
    this.renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true, powerPreference: 'low-power' });
    this.resources = new AvatarModelResources();
    this.assets = new AvatarAssetLibrary(this.resources);
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.setClearColor('#0d1824', 0);
    this.renderer.domElement.setAttribute('aria-hidden', 'true');
    host.replaceChildren(this.renderer.domElement);
    this.renderer.domElement.addEventListener('webglcontextlost', this.lost);
    this.renderer.domElement.addEventListener('webglcontextrestored', this.restored);
    this.scene.add(this.resources.owner, this.assets.owner, new THREE.HemisphereLight('#e8f5ff', '#252b43', 2.2));
    const key = new THREE.DirectionalLight('#ffe8cc', 3); key.position.set(-80, 150, 130); this.scene.add(key);
    const rim = new THREE.DirectionalLight('#85bbed', 2); rim.position.set(90, 70, -100); this.scene.add(rim);
    this.resources.mesh(this.scene, 'rod', '#27394a', [36, 4, 36], [0, -3, 0]);
    const ring = this.resources.mesh(this.scene, 'torus', '#809897', [33, 33, 33], [0, -.5, 0]); ring.rotation.x = Math.PI / 2;
    this.resize = new ResizeObserver(() => this.requestFrame()); this.resize.observe(host);
    this.visibility = new IntersectionObserver(entries => {
      this.visible = entries.some(entry => entry.isIntersecting); this.lastTime = 0;
      if (this.visible) this.requestFrame();
      else { cancelAnimationFrame(this.frame); this.frame = 0; }
    });
    this.visibility.observe(host); this.status(true);
  }

  setKit(kit: ChampionKit) {
    this.kit = kit;
    if (this.model) { this.model.dispose(); this.scene.remove(this.model.body); }
    this.model = this.assets.instantiate(kit.id) ?? buildAvatarModel(kit, this.resources); this.scene.add(this.model.body);
    this.host.dataset.modelFormat = this.assets.has(kit.id) ? 'glb' : 'surface';
    if (!this.assets.has(kit.id)) this.assets.request(kit.id, () => { if (!this.disposed && this.kit?.id === kit.id) this.setKit(this.kit); });
    this.host.dataset.designId = kit.id; this.requestFrame();
  }
  setView(yaw: number, pose: string, motion: boolean) {
    if(pose!==this.pose||motion!==this.motion){
      const phase=pose==='cast'?.55:pose==='death'?.85:pose==='hit'?.4:pose.startsWith('turn')?.5:.42;
      this.second=motion?0:combatDuration(this.kit?.id??'',pose)*phase;
    }
    this.yaw = yaw; this.pose = pose; this.motion = motion;
    this.lastTime = 0; this.requestFrame();
  }
  private requestFrame() {
    if (!this.disposed && this.available && this.visible && !this.frame) this.frame = requestAnimationFrame(this.render);
  }
  private readonly render = (now: number) => {
    this.frame = 0;
    if (this.disposed || !this.available || !this.visible || !this.model) return;
    const width = Math.max(1, this.host.clientWidth), height = Math.max(1, this.host.clientHeight);
    const ratio = Math.min(window.devicePixelRatio || 1, 2);
    if (width !== this.width || height !== this.height || ratio !== this.pixelRatio) {
      this.width = width; this.height = height; this.pixelRatio = ratio;
      this.renderer.setPixelRatio(ratio); this.renderer.setSize(width, height, false);
    }
    if (this.motion && this.lastTime) this.second += Math.min(.05, (now - this.lastTime) / 1000);
    this.lastTime = now;
    this.model.animate({ animState: this.pose, animTimer: this.second }, this.second);
    const span = this.kit?.id === 'c_invoker' ? Math.max(90, this.model.height * 1.12) : Math.max(110, this.model.height * 1.42);
    const aspect = width / height;
    const halfH = span / (2 * Math.min(1, aspect));
    Object.assign(this.camera, { left: -halfH * aspect, right: halfH * aspect, top: halfH, bottom: -halfH });
    this.camera.position.set(Math.sin(this.yaw) * 220, 115, Math.cos(this.yaw) * 220);
    this.camera.lookAt(0, this.model.height * .43, 0); this.camera.updateProjectionMatrix();
    try {
      this.renderer.render(this.scene, this.camera);
      this.host.dataset.drawCalls = String(this.renderer.info.render.calls);
      if (this.motion) this.requestFrame();
    } catch { this.available = false; this.status(false); }
  };

  dispose() {
    if (this.disposed) return; this.disposed = true;
    this.assets.close(); this.model?.dispose();
    cancelAnimationFrame(this.frame); this.resize.disconnect(); this.visibility.disconnect();
    const canvas = this.renderer.domElement;
    canvas.removeEventListener('webglcontextlost', this.lost); canvas.removeEventListener('webglcontextrestored', this.restored);
    disposeArenaTerrainResources(this.scene);
    this.renderer.dispose(); this.renderer.forceContextLoss(); canvas.remove();
  }
}
