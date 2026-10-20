import * as THREE from 'three';
import { GLTFLoader, type GLTF } from 'three/addons/loaders/GLTFLoader.js';
import { clone as cloneSkeleton } from 'three/addons/utils/SkeletonUtils.js';
import { avatarDesign } from './avatarDesigns.ts';
import { bindAvatarModel, disposeAvatarRig, type AvatarModel, type AvatarModelResources, type AvatarPose } from './threeAvatarModels.ts';
import { avatarModelUrl,type AvatarModelVariant } from './avatarModelUrl.ts';
import { disposeArenaTerrainResources } from './threeArenaTerrain.ts';
import {loadVisualReleases,visualReleaseUrl,reportVisualHealth,type VisualRelease} from './avatarVisualRelease.ts';
import {bindSubmittedArsenaldo} from './submittedArsenaldo.ts';
import {avatarSecondaryMotion} from './avatarSecondaryMotion.ts';
import {contactGait} from './avatarContactProfiles.ts';

export { avatarModelUrl } from './avatarModelUrl.ts';

/** Per-renderer ownership, so unmount never disposes another view's GPU resources. */
export class AvatarAssetLibrary {
  readonly owner = new THREE.Group();
  private readonly files = new Map<string, GLTF>();
  private readonly pending = new Map<string, Promise<boolean>>();
  private readonly resolvedURLs=new Map<string,string>();
  private readonly selectedReleases=new Map<string,VisualRelease>();
  private readonly nativeImports=new WeakSet<GLTF>();
  private readonly loader = new GLTFLoader();
  private closed = false;
  private readonly resources: AvatarModelResources;
  private releaseSnapshot?:Promise<ReadonlyMap<string,VisualRelease>>;
  private readonly override?: (id:string,variant:AvatarModelVariant)=>string;
  constructor(resources: AvatarModelResources,override?: (id:string,variant:AvatarModelVariant)=>string,
    snapshot?:Promise<ReadonlyMap<string,VisualRelease>>) {
    this.resources = resources; this.override=override;this.owner.visible = false;this.releaseSnapshot=snapshot;
  }
  private key(id:string,variant:AvatarModelVariant){return id==='c_invoker'&&variant!=='current'?`${id}:${variant}`:id;}
  has(id: string,variant:AvatarModelVariant='current') { return this.files.has(this.key(id,variant)); }
  sourceUrl(id:string,variant:AvatarModelVariant='current'){return this.resolvedURLs.get(this.key(id,variant))??avatarModelUrl(id,variant);}
  request(id: string, ready?: () => void,variant:AvatarModelVariant='current') {
    if (typeof window === 'undefined' || this.closed || !avatarDesign(id)) return;
    const key=this.key(id,variant);
    let promise = this.pending.get(key);
    if (!promise) {
      const url=this.override?Promise.resolve(this.override(id,variant)):(this.releaseSnapshot??=loadVisualReleases()).then(releases=>{
        const release=releases.get(`${id}:${variant}`);if(release)this.selectedReleases.set(key,release);
        return release?visualReleaseUrl(release)??avatarModelUrl(id,variant):avatarModelUrl(id,variant);
      });
      promise = url.then(async path=>{
        try{const file=await this.loader.loadAsync(path);this.resolvedURLs.set(key,path);return file;}
        catch(error){if(path!==avatarModelUrl(id,variant)){
          const release=this.selectedReleases.get(key);if(release)reportVisualHealth(release,'load');
          const file=await this.loader.loadAsync(avatarModelUrl(id,variant));this.resolvedURLs.set(key,avatarModelUrl(id,variant));return file;}throw error;}
      }).then(file => {
        if (this.closed) {
          disposeAvatarRig(file.scene); disposeArenaTerrainResources(file.scene); return false;
        }
        this.files.set(key, file); this.owner.add(file.scene);
        if(id==='c_invoker'&&variant==='claude')this.nativeImports.add(file);
        return true;
      }).catch(async () => {
        if(key===id||this.closed)return false;
        const ok=await this.request(id,undefined,'current');
        if(ok&&!this.closed){this.files.set(key,this.files.get(id)!);this.resolvedURLs.set(key,this.sourceUrl(id,'current'));return true;}
        return false;
      });
      this.pending.set(key, promise);
    }
    if (ready) void promise.then(ok => { if (ok && !this.closed) ready(); });
    return promise;
  }
  instantiate(id: string,variant:AvatarModelVariant='current'): AvatarModel | undefined {
    const file = this.files.get(this.key(id,variant)); if (!file || this.closed) return;
    const scene = cloneSkeleton(file.scene);
    scene.traverse(node => { if (node instanceof THREE.SkinnedMesh) node.frustumCulled = false; });
    if(id==='c_invoker'&&variant==='submitted'&&this.sourceUrl(id,variant)===avatarModelUrl(id,'submitted')){
      return bindSubmittedArsenaldo(scene,this.resources);
    }
    let root: THREE.Group | undefined;
    scene.traverse(node => { if (node.userData.avatarPart === 'avatar-root') root = node as THREE.Group; });
    if (!root) return;
    const hasAnimations = file.animations && file.animations.length > 0;
    const retargetedNativeMotion=root.userData.assetPreparation?.provider==='unirig'&&root.userData.assetPreparation?.animation_mode==='retargeted-native-clips';
    const preserveNativeMotion=this.nativeImports.has(file)||retargetedNativeMotion;
    scene.updateMatrixWorld(true);
    const meshBounds = new THREE.Box3();
    let hasMesh = false;
    const tempPoint = new THREE.Vector3();
    scene.traverse(node => {
      if (node instanceof THREE.SkinnedMesh && node.geometry) {
        node.skeleton?.update();
        const pos = node.geometry.attributes.position;
        if (pos && pos.count > 0) {
          const step = Math.max(1, Math.floor(pos.count / 500));
          for (let i = 0; i < pos.count; i += step) {
            node.getVertexPosition(i, tempPoint).applyMatrix4(node.matrixWorld);
            if (Number.isFinite(tempPoint.x) && Number.isFinite(tempPoint.y) && Number.isFinite(tempPoint.z)) {
              meshBounds.expandByPoint(tempPoint);
              hasMesh = true;
            }
          }
        }
      } else if (node instanceof THREE.Mesh && node.geometry) {
        if (!node.geometry.boundingBox) node.geometry.computeBoundingBox();
        const box = node.geometry.boundingBox;
        if (box) {
          const transformed = box.clone().applyMatrix4(node.matrixWorld);
          meshBounds.union(transformed);
          hasMesh = true;
        }
      }
    });
    const bounds = hasMesh ? meshBounds : new THREE.Box3().setFromObject(scene);
    const rawHeight = bounds.max.y - bounds.min.y;
    const baseHeight = avatarDesign(id)?.height ?? 70;
    // Procedural champions feature stylized chunky/heroic MOBA silhouettes.
    // Neural AI meshes (e.g. TRELLIS 7.5-8 heads tall) need a top-down readability presence
    // multiplier (1.25x) so their screen volume and head silhouette match top-down orthographic view.
    const mobaPresenceMultiplier = 1.25;
    const targetHeight = baseHeight * mobaPresenceMultiplier;
    const scaleFactor = rawHeight > 0.1 ? targetHeight / rawHeight : 40;
    const strideDistances:Record<string,number>={};
    for(const state of ['walk','run','strafe']){
      const authored=Number(root.userData.assetPreparation?.stride_distances?.[state]);
      const gait=contactGait(state);
      strideDistances[state]=Number.isFinite(authored)&&authored>0?authored*scaleFactor:gait.span/gait.stance*scaleFactor/40;
    }
    if (bounds.min.y < -0.05 || bounds.min.y > 0.05) {
      scene.position.y = -bounds.min.y;
    }
    root.userData.hudHeight = targetHeight;
    root.userData.designId = id;
    const binding = bindAvatarModel(root, this.resources, { drivenByMixer: hasAnimations, preserveNativeMotion });
    const body = new THREE.Group(); body.scale.setScalar(scaleFactor); body.add(scene);
    body.userData = { designId: id, hudHeight: targetHeight, assetFormat: 'glb', modelVariant: this.nativeImports.has(file) ? 'claude' : 'current', clips: file.animations.map(clip => clip.name), visualEvolution: root.userData.avatarEvolution?.visual };
    body.userData.strideDistances=strideDistances;
    const release = this.selectedReleases.get(this.key(id, variant));
    if (release && this.sourceUrl(id, variant) === visualReleaseUrl(release)) body.userData.visualRelease = { ...release };

    if (!hasAnimations) {
      return { body, height: targetHeight, animate: binding.animate, dispose: () => disposeAvatarRig(body) };
    }

    const mixer = new THREE.AnimationMixer(scene);
    const secondary=this.nativeImports.has(file)?undefined:avatarSecondaryMotion(root);
    const actions = new Map<string, THREE.AnimationAction>();
    for (const clip of file.animations) {
      const action = mixer.clipAction(clip);
      action.play();
      action.setEffectiveWeight(0);
      actions.set(clip.name.toLowerCase(), action);
    }

    // PropertyMixer skips writes when a track's value has not changed. Keep the
    // evaluated clip pose separate from contact/recoil/form edits, otherwise a
    // constant hip track lets the per-frame contact offset accumulate underground.
    const clipPose: {node: THREE.Object3D; position: THREE.Vector3; quaternion: THREE.Quaternion; scale: THREE.Vector3}[] = [];
    scene.traverse(node => {
      if (node instanceof THREE.Bone || node.userData.avatarPart) {
        clipPose.push({node, position: node.position.clone(), quaternion: node.quaternion.clone(), scale: node.scale.clone()});
      }
    });
    const transitionPose=clipPose.map(frame=>({position:frame.position.clone(),quaternion:frame.quaternion.clone(),scale:frame.scale.clone()}));
    const displayedPose=clipPose.map(frame=>({position:frame.position.clone(),quaternion:frame.quaternion.clone(),scale:frame.scale.clone()}));
    let lastState='',lastBlend=1,hasTransition=false,lastSecond=-Infinity;

    // Map simulation animation states to the GLB's native Blender clip names.
    // Every avatar GLB ships with dedicated TurnLeft/TurnRight, Hit and Death clips;
    // run and strafe each have their own clip rather than falling back to walk.
    const CLIP_FOR_STATE: Record<string, string> = {
      idle: 'Idle', walk: 'Walk', run: 'Run', strafe: 'Strafe',
      attack: 'Attack', cast: 'Cast', hit: 'Hit', death: 'Death',
      turnleft: 'TurnLeft', turnright: 'TurnRight',
    };

    const findAction = (state: string) => {
      const s = state.toLowerCase();
      return actions.get((CLIP_FOR_STATE[s] ?? s).toLowerCase()) ?? actions.get('idle');
    };

    /** Smoothstep ease for crossfade blending between animation clips. */
    const easeBlend = (t: number) => { const c = Math.max(0, Math.min(1, t)); return c * c * (3 - 2 * c); };

    const animate = (pose: AvatarPose, second: number) => {
      for (const frame of clipPose) {
        frame.node.position.copy(frame.position);
        frame.node.quaternion.copy(frame.quaternion);
        frame.node.scale.copy(frame.scale);
      }
      const state = (pose.motionState ?? (pose.animState === 'dead' ? 'death' : pose.animState ?? 'idle')).toLowerCase();
      const fade=pose.motionBlend??1;
      if(second<lastSecond){hasTransition=false;lastState='';}
      if(lastState&&fade<.15&&(state!==lastState||fade<lastBlend)){
        displayedPose.forEach((frame,i)=>{transitionPose[i].position.copy(frame.position);transitionPose[i].quaternion.copy(frame.quaternion);transitionPose[i].scale.copy(frame.scale);});
        hasTransition=true;
      }
      if(fade>=1)hasTransition=false;
      const currAction = findAction(state);
      const time = pose.motionTime ?? pose.animTimer ?? second;

      if (currAction) {
        const duration = currAction.getClip().duration;
        const gaitPhase=!this.nativeImports.has(file)&&['walk','run','strafe'].includes(state)&&Number.isFinite(pose.gaitPhase)?(((pose.gaitPhase!%1)+1)%1)*duration:undefined;
        const currPhase = gaitPhase ?? (preserveNativeMotion&&state==='death'?Math.min(Math.max(0,time),duration):((time % duration) + duration) % duration);

        const prevAction = pose.previousMotion ? findAction(pose.previousMotion) : undefined;
        if (!hasTransition&&prevAction && prevAction !== currAction && pose.motionBlend !== undefined && pose.motionBlend < 1) {
          // Crossfade from the previous clip to the current clip.
          const blend = Math.max(0, Math.min(1, pose.motionBlend));
          const t = easeBlend(blend);

          const pDur = prevAction ? prevAction.getClip().duration : duration;
          const pTime = pose.previousMotionTime ?? 0;
          const prevPhase = !this.nativeImports.has(file)&&['walk','run','strafe'].includes(pose.previousMotion??'')&&Number.isFinite(pose.previousGaitPhase)
            ?((pose.previousGaitPhase!%1)+1)%1*pDur:((pTime % pDur) + pDur) % pDur;

          for (const act of actions.values()) {
            if (act === currAction) {
              act.setEffectiveWeight(t);
              act.time = currPhase;
            } else if (act === prevAction) {
              act.setEffectiveWeight(1 - t);
              act.time = prevPhase;
            } else {
              act.setEffectiveWeight(0);
            }
          }
        } else {
          // Play the current clip at full weight; all others at zero.
          for (const act of actions.values()) {
            if (act === currAction) {
              act.setEffectiveWeight(1);
              act.time = currPhase;
            } else {
              act.setEffectiveWeight(0);
            }
          }
        }
        mixer.update(0);
      }
      for (const frame of clipPose) {
        frame.position.copy(frame.node.position);
        frame.quaternion.copy(frame.node.quaternion);
        frame.scale.copy(frame.node.scale);
      }
      if(hasTransition){
        const t=easeBlend(fade);
        clipPose.forEach((frame,i)=>{
          frame.node.position.lerpVectors(transitionPose[i].position,frame.position,t);
          frame.node.quaternion.slerpQuaternions(transitionPose[i].quaternion,frame.quaternion,t);
          frame.node.scale.lerpVectors(transitionPose[i].scale,frame.scale,t);
        });
      }
      clipPose.forEach((frame,i)=>{displayedPose[i].position.copy(frame.node.position);displayedPose[i].quaternion.copy(frame.node.quaternion);displayedPose[i].scale.copy(frame.node.scale);});
      // Additive overlays (aiming, recoil, contacts) run on top of the clip base.
      binding.animate(pose, second);
      secondary?.(pose,second);
      lastState=state;lastBlend=fade;lastSecond=second;
    };

    return {
      body,
      height: targetHeight || binding.height || 70,
      animate,
      dispose: () => {
        mixer.stopAllAction();
        mixer.uncacheRoot(scene);
        disposeAvatarRig(body);
      }
    };
  }
  close() { this.closed = true; }
}
