import * as THREE from 'three';
import { GLTFLoader, type GLTF } from 'three/addons/loaders/GLTFLoader.js';
import { clone as cloneSkeleton } from 'three/addons/utils/SkeletonUtils.js';
import { avatarDesign } from './avatarDesigns.ts';
import { bindAvatarModel, disposeAvatarRig, type AvatarModel, type AvatarModelResources } from './threeAvatarModels.ts';
import { avatarModelUrl } from './avatarModelUrl.ts';
import { disposeArenaTerrainResources } from './threeArenaTerrain.ts';

export { avatarModelUrl } from './avatarModelUrl.ts';

/** Per-renderer ownership, so unmount never disposes another view's GPU resources. */
export class AvatarAssetLibrary {
  readonly owner = new THREE.Group();
  private readonly files = new Map<string, GLTF>();
  private readonly pending = new Map<string, Promise<boolean>>();
  private readonly loader = new GLTFLoader();
  private closed = false;
  private readonly resources: AvatarModelResources;
  constructor(resources: AvatarModelResources) { this.resources = resources; this.owner.visible = false; }
  has(id: string) { return this.files.has(id); }
  request(id: string, ready?: () => void) {
    if (typeof window === 'undefined' || this.closed || !avatarDesign(id)) return;
    let promise = this.pending.get(id);
    if (!promise) {
      promise = this.loader.loadAsync(avatarModelUrl(id)).then(file => {
        if (this.closed) {
          disposeAvatarRig(file.scene); disposeArenaTerrainResources(file.scene); return false;
        }
        this.files.set(id, file); this.owner.add(file.scene); return true;
      }).catch(() => false);
      this.pending.set(id, promise);
    }
    if (ready) void promise.then(ok => { if (ok && !this.closed) ready(); });
    return promise;
  }
  instantiate(id: string): AvatarModel | undefined {
    const file = this.files.get(id); if (!file || this.closed) return;
    const scene = cloneSkeleton(file.scene);
    scene.traverse(node => { if (node instanceof THREE.SkinnedMesh) node.frustumCulled = false; });
    let root: THREE.Group | undefined;
    scene.traverse(node => { if (node.userData.avatarPart === 'avatar-root') root = node as THREE.Group; });
    if (!root) return;
    const binding = bindAvatarModel(root, this.resources);
    const body = new THREE.Group(); body.scale.setScalar(40); body.add(scene);
    body.userData = { designId: id, assetFormat: 'glb', clips: file.animations.map(clip => clip.name) };
    return { body, height: binding.height, animate: binding.animate, dispose: () => disposeAvatarRig(body) };
  }
  close() { this.closed = true; }
}
