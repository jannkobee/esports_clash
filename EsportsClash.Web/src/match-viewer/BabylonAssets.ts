import { LoadAssetContainerAsync, TransformNode, type Scene, type AssetContainer, type InstantiatedEntries } from '@babylonjs/core';
import { registerBuiltInLoaders } from '@babylonjs/loaders/dynamic';
import { avatarModelUrl, getArsenaldoModelVariant,legacyAvatarAssetsAvailable } from '../avatarModelUrl';
import { avatarDesign } from '../avatarDesigns';
import { visualReleaseUrl, type VisualRelease } from '../avatarVisualRelease';
import { AvatarAnimationController } from './AvatarAnimationController';

registerBuiltInLoaders();
export type MatchAssetManifestStatus = {
  stage: 'idle' | 'loading' | 'ready' | 'error';
  total: number;
  loaded: number;
  percent: number;
  ready: boolean;
  errors: string[];
};

export type AvatarAssetInstance={root:TransformNode;height:number;animation:AvatarAnimationController;dispose:()=>void;source:string};
type Loaded={container:AssetContainer;source:string};
/** Scene-owned cache. Published/legacy art can render without being requalified as V3 art. */
export class BabylonAssets {
  private disposed=false;
  private files=new Map<string,Promise<Loaded|null>>();
  private containers=new Set<AssetContainer>();
  private active=0;
  private queue:(()=>void)[]=[];
  readonly diagnostics=new Map<string,readonly string[]>();
  constructor(private scene:Scene,private releases:Promise<ReadonlyMap<string,VisualRelease>>=Promise.resolve(new Map())){}
  private async slot(){if(this.active>=2)await new Promise<void>(resolve=>this.queue.push(resolve));this.active++;}
  private release(){this.active--;this.queue.shift()?.();}
    private manifestStatus: MatchAssetManifestStatus = {
    stage: 'idle',
    total: 0,
    loaded: 0,
    percent: 0,
    ready: false,
    errors: [],
  };

  getManifest(): Readonly<MatchAssetManifestStatus> {
    return this.manifestStatus;
  }

  async preloadAll(heroIds: string[], onProgress?: (status: MatchAssetManifestStatus) => void): Promise<void> {
    this.manifestStatus = {
      stage: 'loading',
      total: heroIds.length,
      loaded: 0,
      percent: 0,
      ready: false,
      errors: [],
    };
    onProgress?.({ ...this.manifestStatus });

    await Promise.all(
      heroIds.map(async id => {
        try {
          await this.load(id);
        } catch (err) {
          this.manifestStatus.errors.push(`${id}: ${String(err)}`);
        } finally {
          this.manifestStatus.loaded++;
          this.manifestStatus.percent = this.manifestStatus.total > 0 ? Math.round((this.manifestStatus.loaded / this.manifestStatus.total) * 100) : 100;
          onProgress?.({ ...this.manifestStatus });
        }
      })
    );

    this.manifestStatus.stage = this.manifestStatus.errors.length > 0 ? 'error' : 'ready';
    this.manifestStatus.ready = true;
    onProgress?.({ ...this.manifestStatus });
  }
  private load(heroId:string,selected?:'current'){
    const key=heroId+':'+(selected??'selected');
    let pending=this.files.get(key);if(pending)return pending;
    pending=(async()=>{await this.slot();try{
      if(this.disposed)return null;
      const variant=selected??(heroId==='c_invoker'?getArsenaldoModelVariant():'current');
      const release=(await this.releases).get(`${heroId}:${variant}`);
      if(!release&&!legacyAvatarAssetsAvailable){this.diagnostics.set(heroId,['No character asset: owner requested a fresh asset pipeline']);return null;}
      const fallback=avatarModelUrl(heroId,variant);
      const url=release?visualReleaseUrl(release)??fallback:fallback;
      let container:AssetContainer,source=url;
      try{container=await LoadAssetContainerAsync(url,this.scene);}
      catch(error){if(url===fallback||!fallback)throw error;container=await LoadAssetContainerAsync(fallback,this.scene);source=fallback;}
      if(this.disposed){container.dispose();return null;}
      const warnings:string[]=['Legacy artwork; original V3 appearance is not qualified'];
      const clips=new Set(container.animationGroups.map(g=>g.name.toLowerCase()));
      for(const clip of ['idle','run','attack','cast','hit','death'])if(!clips.has(clip))warnings.push(`Missing clip: ${clip}`);
      if(!container.skeletons.length)warnings.push('No skeleton; static fallback');
      const sockets=container.transformNodes.filter(n=>/socket/i.test(n.name));
      if(!sockets.length)warnings.push('No named sockets; projectile origin stays authoritative');
      this.diagnostics.set(heroId,warnings);this.containers.add(container);return {container,source};
    }catch(error){if(!this.disposed){this.diagnostics.set(heroId,[`Asset failed: ${String(error)}`]);console.warn('Avatar load failed',heroId,error);}return null;}
    finally{this.release();}})();
    this.files.set(key,pending);return pending;
  }
  async instantiate(heroId:string,id:string,variant?:'current'):Promise<AvatarAssetInstance|null>{
    if(!avatarDesign(heroId)||this.disposed)return null;
    const loaded=await this.load(heroId,variant);if(!loaded||this.disposed)return null;
    let entries:InstantiatedEntries|undefined;const root=new TransformNode(`avatar:${id}`,this.scene);
    try{
      entries=loaded.container.instantiateModelsToScene(name=>`${id}:${name}`,false,{doNotInstantiate:true});
      for(const node of entries.rootNodes){node.parent=root;node.setEnabled(true);}
      root.computeWorldMatrix(true);
      const bounds=root.getHierarchyBoundingVectors(true);
      const measured=bounds.max.y-bounds.min.y;
      if(![bounds.min.x,bounds.min.y,bounds.min.z,bounds.max.x,bounds.max.y,bounds.max.z,measured].every(Number.isFinite)||measured<=.001||measured>10000)throw new Error('Invalid model bounds');
      const height=avatarDesign(heroId)?.height??65,scale=height/measured;
      const visual=new TransformNode(`normalized:${id}`,this.scene);visual.parent=root;
      for(const node of entries.rootNodes)node.parent=visual;
      visual.scaling.setAll(scale);visual.position.set(-(bounds.min.x+bounds.max.x)/2*scale,-bounds.min.y*scale,-(bounds.min.z+bounds.max.z)/2*scale);
      const animation=new AvatarAnimationController(entries.animationGroups);
      const owned=entries;
      return {root,height,animation,source:loaded.source,dispose:()=>{animation.dispose();owned.dispose();root.dispose();}};
    }catch(error){entries?.dispose();root.dispose();this.diagnostics.set(heroId,[`Instance rejected: ${String(error)}`]);return null;}
  }
  dispose(){this.disposed=true;for(const container of this.containers)container.dispose();this.containers.clear();this.files.clear();}
}
