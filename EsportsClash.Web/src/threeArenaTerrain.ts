import { arenaElevationGLSL } from './arenaElevation.ts';
import { ARENA_LIGHTING, arenaCampArt } from './arenaArtDirection.ts';
import { LANDSCAPE, WELL_RADII, HEALING_SHRINE_Y } from './arenaLandform.ts';
import { ARAM_BUSHES, CAMP_ROCK_RINGS } from './arenaRules.ts';
import * as THREE from 'three';
import type { VisualRelease } from './avatarVisualRelease.ts';
import { ArenaScene, applyArenaSceneCamera, arenaScenePan, clampArenaSceneCamera, type ArenaSceneFrame } from './threeArenaScene.ts';
import {
  clampArenaCamera,
  type ArenaCameraViewport,
} from './arenaPresentationCamera.ts';

export const LEGACY_TERRAIN_WIDTH = 1320;
export const MAX_TERRAIN_PIXEL_RATIO = 2;

export const ARENA_STATIC_TERRAIN_LAYERS = [
  'forest-floor',
  'forested-lowlands',
  'raised-stone-ridge',
  'stone-base-courtyards',
  'sanctuary-shrines',
] as const;

export function applyArenaCamera(
  camera: THREE.OrthographicCamera,
  viewport: ArenaCameraViewport,
  worldHeight: number,
): void {
  camera.left = -viewport.halfW;
  camera.right = viewport.halfW;
  camera.top = viewport.halfH;
  camera.bottom = -viewport.halfH;
  camera.position.set(viewport.x, worldHeight - viewport.y, 10);
  camera.updateProjectionMatrix();
}

export type ArenaTerrainDisposalStats = {
  geometries: number;
  materials: number;
  textures: number;
};

function collectTexture(value: unknown, textures: Set<THREE.Texture>): void {
  if (value instanceof THREE.Texture) {
    textures.add(value);
  } else if (Array.isArray(value)) {
    value.forEach(entry => collectTexture(entry, textures));
  }
}

export function disposeArenaTerrainResources(root: THREE.Object3D): ArenaTerrainDisposalStats {
  const geometries = new Set<THREE.BufferGeometry>();
  const materials = new Set<THREE.Material>();
  const textures = new Set<THREE.Texture>();
  const skeletons = new Set<THREE.Skeleton>();

  root.traverse(object => {
    if (object instanceof THREE.InstancedMesh) object.dispose();
    if (object instanceof THREE.SkinnedMesh) skeletons.add(object.skeleton);
    const renderObject = object as THREE.Object3D & {
      geometry?: THREE.BufferGeometry;
      material?: THREE.Material | THREE.Material[];
    };
    if (renderObject.geometry) geometries.add(renderObject.geometry);
    const objectMaterials = Array.isArray(renderObject.material)
      ? renderObject.material
      : renderObject.material
        ? [renderObject.material]
        : [];
    objectMaterials.forEach(material => {
      materials.add(material);
      Object.values(material).forEach(value => collectTexture(value, textures));
      const uniforms = (material as THREE.ShaderMaterial).uniforms;
      if (uniforms) Object.values(uniforms).forEach(uniform => collectTexture(uniform.value, textures));
    });
  });

  const bitmaps = new Set<ImageBitmap>();
  textures.forEach(texture => {
    if (typeof ImageBitmap !== 'undefined' && texture.image instanceof ImageBitmap) bitmaps.add(texture.image);
    texture.dispose();
  });
  bitmaps.forEach(bitmap => bitmap.close());
  skeletons.forEach(skeleton => skeleton.dispose());
  materials.forEach(material => material.dispose());
  geometries.forEach(geometry => geometry.dispose());
  return { geometries: geometries.size, materials: materials.size, textures: textures.size };
}

const terrainVertexShader = /* glsl */`
  varying vec2 vWorld;
  varying vec3 vTerrainNormal;
  uniform vec2 uWorldSize;
  uniform float uRelief;
  ${arenaElevationGLSL}

  void main() {
    vWorld = vec2(uv.x * uWorldSize.x, (1.0 - uv.y) * uWorldSize.y);
    vec3 raised=position;raised.z+=uRelief*ridgeHeight(vWorld);
    // World-space slope normal uses the same height profile as the CPU grounding.
    float dx=(ridgeHeight(vWorld+vec2(2.,0.))-ridgeHeight(vWorld-vec2(2.,0.)))*.25;
    float dz=(ridgeHeight(vWorld+vec2(0.,2.))-ridgeHeight(vWorld-vec2(0.,2.)))*.25;
    vTerrainNormal=normalize(vec3(-dx,1.,-dz));
    gl_Position = projectionMatrix * modelViewMatrix * vec4(raised, 1.0);
  }
`;

const terrainFragmentShader = /* glsl */`
 varying vec2 vWorld;
 varying vec3 vTerrainNormal;
 uniform vec2 uWorldSize;
 uniform float uTime;
 float hash21(vec2 p){p=fract(p*vec2(123.34,456.21));p+=dot(p,p+45.32);return fract(p.x*p.y);}
 float grain(vec2 p){vec2 c=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(hash21(c),hash21(c+vec2(1.,0.)),f.x),mix(hash21(c+vec2(0.,1.)),hash21(c+vec2(1.)),f.x),f.y);}
 ${arenaElevationGLSL}
 void main(){
  vec2 p=vWorld,edges=ridgeLaneEdges(p.x);float north=edges.x,south=edges.y;
  float n=grain(p*.026)*.55+grain(p*.087)*.28+grain(p*.31)*.17;
  float warm=smoothstep(250.,650.,p.y)*.30+smoothstep(1500.,2400.,p.x)*.12;
  vec3 forest=mix(vec3(.11,.22,.16),vec3(.24,.27,.15),warm);
  vec3 color=forest*(.72+n*.66);
  float leafLitter=smoothstep(.70,.89,grain(p*.14))*grain(p*.029);
  color=mix(color,vec3(.36,.31,.17),leafLitter*.34);
  float moss=smoothstep(.49,.76,grain(p*.038));
  color=mix(color,vec3(.20,.31,.17),moss*.28);
  float trail=min(abs(p.y-(174.+sin(p.x*.006)*13.)),abs(p.y-(584.+sin(p.x*.006)*13.)));
  float dirt=1.-smoothstep(8.,26.,trail+grain(p*.09)*9.);
  color=mix(color,vec3(.34,.30,.20)*(.85+n*.25),dirt*.73);
  ${CAMP_ROCK_RINGS.map(ring=>`if(all(lessThan(abs(p-vec2(${ring.x.toFixed(1)},${ring.y.toFixed(1)})),vec2(${(ring.radius*1.18).toFixed(1)})))){
   float clearing=length((p-vec2(${ring.x.toFixed(1)},${ring.y.toFixed(1)}))/vec2(${(ring.radius*.82).toFixed(1)},${(ring.radius*.77).toFixed(1)}));
   float pad=1.-smoothstep(.70,1.12,clearing+(grain(p*.07)-.5)*.16);
   color=mix(color,vec3(${arenaCampArt(ring.id).ground.map(n=>n.toFixed(3)).join(',')})*(.83+n*.30),pad*.9);
   vec2 local=p-vec2(${ring.x.toFixed(1)},${ring.y.toFixed(1)});
   float angle=atan(local.y,local.x)-(${ring.entrance.toFixed(6)});
   float mouth=1.-smoothstep(.5,1.05,abs(atan(sin(angle),cos(angle))));
   float bankShade=(1.-smoothstep(.06,.27,abs(clearing-1.07)))*(1.-mouth);
   color*=1.-bankShade*.19;
   float debris=pad*(1.-smoothstep(.65,1.08,clearing))*smoothstep(.74,.88,grain(p*.27));
   color=mix(color,vec3(.43,.39,.28),debris*.18);
   vec2 entrance=vec2(${Math.cos(ring.entrance).toFixed(6)},${Math.sin(ring.entrance).toFixed(6)});
   float approach=dot(local,entrance),crossing=abs(dot(local,vec2(-entrance.y,entrance.x)));
   float scuff=smoothstep(${(ring.radius*.35).toFixed(1)},${(ring.radius*.70).toFixed(1)},approach)*
    (1.-smoothstep(${(ring.radius*.98).toFixed(1)},${(ring.radius*1.15).toFixed(1)},approach))*(1.-smoothstep(5.,18.,crossing));
   color=mix(color,vec3(${arenaCampArt(ring.id).ground.map(n=>(n*1.18).toFixed(3)).join(',')}),scuff*.48);
  }`).join('\n')}
  float elevation=ridgeHeight(p),outside=max(north-p.y,p.y-south),ramp=ridgeRamp(p.x,p.y<380.);
  float shoulder=step(.1,outside)*smoothstep(.1,3.,elevation)*(1.-smoothstep(31.,32.,elevation));
  float strata=1.-smoothstep(.08,.24,abs(sin(elevation*.54+grain(p*.05)*.9)));
  vec3 bank=mix(vec3(.24,.29,.25),vec3(.43,.43,.34),elevation/32.);
  bank*=.86+n*.24;bank=mix(bank,bank*.57,strata*.32);
  color=mix(color,bank,shoulder*.95);
  float rampPath=ramp*(1.-smoothstep(66.,94.,outside))*step(-10.,outside);
  float stepMark=(1.-smoothstep(.5,1.5,abs(mod(outside+2.,11.)-5.5)))*step(0.,outside);
  color=mix(color,vec3(.40,.39,.29)*(.90+n*.17),rampPath*.88);
  color=mix(color,vec3(.58,.55,.40),stepMark*rampPath*.30);
  // Eroded edges blend paving into turf while the wide center stays readable.
  float encroachment=(grain(p*.062)-.5)*9.+(grain(p*.18)-.5)*3.;
  float base=1.-smoothstep(${LANDSCAPE.left-6}.0,${LANDSCAPE.left+7}.0,min(p.x,uWorldSize.x-p.x)+encroachment*.45);
  float lane=smoothstep(north-7.,north+7.,p.y+encroachment)*(1.-smoothstep(south-7.,south+7.,p.y+encroachment));
  float stone=max(base,lane);
  vec2 paving=p+vec2(mod(floor(p.y/38.),2.)*29.,0.);
  vec2 cell=floor(paving/vec2(58.,38.)),tile=mod(paving,vec2(58.,38.));
  float edge=min(min(tile.x,58.-tile.x),min(tile.y,38.-tile.y));
  float grout=1.-smoothstep(.7,2.1,edge+(grain(p*.2)-.5)*1.2);
  float slab=hash21(cell);
  vec3 flagstone=mix(vec3(.32,.36,.34),vec3(.49,.48,.40),slab);
  flagstone*=.86+n*.28;
  float bevel=(1.-smoothstep(2.,4.8,edge))*(1.-grout);
  flagstone+=vec3(.048,.042,.030)*bevel;
  float crack=(1.-smoothstep(.012,.035,abs(grain(p*.052+cell*.13)-.49)))*step(.63,slab);
  flagstone=mix(flagstone,vec3(.14,.20,.17),crack*.58);
  vec3 joint=mix(vec3(.13,.18,.16),vec3(.25,.31,.18),smoothstep(.42,.75,grain(p*.10)));
  flagstone=mix(flagstone,joint,grout*.85);
  flagstone=mix(flagstone,vec3(.23,.31,.17),smoothstep(.68,.86,grain(p*.037))*.26);
  float laneEdge=min(abs(p.y-north),abs(p.y-south));
  float verge=(1.-smoothstep(3.,25.,laneEdge+encroachment))*(1.-base);
  float rooted=verge*smoothstep(.36,.73,grain(p*.11));
  flagstone=mix(flagstone,vec3(.26,.33,.19)*(.83+n*.25),rooted*.72);
  // Travel wear warms the lane center; joints retain dirt and small moss colonies.
  float wear=1.-smoothstep(28.,88.,abs(p.y-(north+south)*.5));
  flagstone=mix(flagstone,flagstone*vec3(1.10,1.05,.93),wear*.42);
  color=mix(color,flagstone,stone);
  color=mix(color,vec3(.52,.51,.40),(1.-smoothstep(2.,5.,laneEdge))*stone*(1.-rooted)*.24);
  float footShade=(1.-smoothstep(0.,15.,outside-(44.+ramp*46.)))*step(44.+ramp*46.,outside)*(1.-base);
  color*=1.-footShade*.15;
  // Warm key and cool shade match model lighting without a shadow-map pass.
  vec3 lightDirection=normalize(vec3(${ARENA_LIGHTING.sunDirection.map(n=>n.toFixed(3)).join(',')}));
  float slopeLight=max(0.,dot(normalize(vTerrainNormal),lightDirection));
  color*=mix(vec3(.76,.84,.87),vec3(1.05,1.02,.94),slopeLight);
  float canopy=grain(p*.008+vec2(uTime*.002,-uTime*.0015));
  float woodland=(1.-stone)*(1.-rampPath*.8);
  color*=1.-smoothstep(.40,.76,canopy)*(.04+woodland*.12);
  // Only actual concealment ellipses receive a dark root bed and olive boundary.
  ${ARAM_BUSHES.map(b=>`{
   float brush=length((p-vec2(${b.x.toFixed(1)},${b.y.toFixed(1)}))/vec2(${(b.width/2).toFixed(1)},${(b.height/2).toFixed(1)}));
   float rootBed=1.-smoothstep(.82,1.04,brush);
   color=mix(color,color*vec3(.69,.79,.66),rootBed*.56);
   float edge=(1.-smoothstep(.015,.075,abs(brush-.98)));
   color=mix(color,vec3(.40,.45,.25),edge*.27);
  }`).join('\n')}
  // The safe grounds read as warm courtyards, never as giant healing pools.
  for(int side=0;side<2;side++){
   float homeX=side==0?65.:2535.;
   vec3 accent=side==0?vec3(.28,.64,.64):vec3(.66,.35,.40);
   float sanctuary=1.-smoothstep(.75,1.10,length((p-vec2(homeX,380.))/vec2(${WELL_RADII.x}.0,${WELL_RADII.y}.0)));
   color=mix(color,color*vec3(1.08,1.02,.91),sanctuary*.45);
   float shrine=1.-smoothstep(12.,22.,length(p-vec2(homeX,${HEALING_SHRINE_Y}.0)));
   color+=accent*shrine*(.09+sin(uTime*1.3)*.025);
   float nexusX=side==0?235.:2365.;
   float inlay=(1.-smoothstep(.4,1.5,abs(length(p-vec2(nexusX,380.))-67.)))*base;
   color=mix(color,vec3(.63,.56,.37),inlay*.40);
  }
  gl_FragColor=vec4(color,1.);
 }
`;

export class ThreeArenaTerrain {
  private readonly host: HTMLElement;
  private readonly worldWidth: number;
  private readonly worldHeight: number;
  private readonly onAvailabilityChange: (available: boolean) => void;
  private readonly scene = new THREE.Scene();
  private readonly camera = new THREE.OrthographicCamera();
  private readonly arena: ArenaScene;
  private readonly renderer: THREE.WebGLRenderer;
  private readonly resizeObserver: ResizeObserver;
  private available = true;
  private disposed = false;
  private renderWidth = 0;
  private renderHeight = 0;
  private pixelRatio = 0;

  private readonly handleContextLost = (event: Event) => {
    event.preventDefault();
    this.setAvailable(false);
  };

  private readonly handleContextRestored = () => {
    this.setAvailable(true);
  };

  constructor(
    host: HTMLElement,
    worldWidth: number,
    worldHeight: number,
    blueRampX: number,
    redRampX: number,
    onAvailabilityChange: (available: boolean) => void,
    visualSnapshot?:Promise<ReadonlyMap<string,VisualRelease>>,
  ) {
    this.host = host;
    this.worldWidth = worldWidth;
    this.worldHeight = worldHeight;
    this.onAvailabilityChange = onAvailabilityChange;
    this.renderer = new THREE.WebGLRenderer({
      alpha: true,
      antialias: true,
      powerPreference: 'high-performance',
    });
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.setClearColor(0x000000, 0);
    this.renderer.domElement.className = 'spectator-three-terrain';
    this.renderer.domElement.setAttribute('aria-hidden', 'true');
    this.renderer.domElement.addEventListener('webglcontextlost', this.handleContextLost);
    this.renderer.domElement.addEventListener('webglcontextrestored', this.handleContextRestored);
    this.host.replaceChildren(this.renderer.domElement);

    const geometry = new THREE.PlaneGeometry(worldWidth, worldHeight, Math.ceil(worldWidth / 10), Math.ceil(worldHeight / 10));
    const material = new THREE.ShaderMaterial({
      uniforms: {
        uWorldSize: { value: new THREE.Vector2(worldWidth, worldHeight) },
        uBlueRampX: { value: blueRampX },
        uRedRampX: { value: redRampX },
        uTime:{value:0},
        uRelief:{value:0},
      },
      vertexShader: terrainVertexShader,
      fragmentShader: terrainFragmentShader,
      depthTest: false,
      depthWrite: false,
    });
    const terrain = new THREE.Mesh(geometry, material);
    terrain.position.set(worldWidth / 2, worldHeight / 2, 0);
    terrain.frustumCulled = false;
    this.scene.add(terrain);
    this.arena = new ArenaScene(terrain.clone(), worldWidth, worldHeight,visualSnapshot);

    this.camera.position.z = 10;
    this.resizeObserver = new ResizeObserver(() => this.resizeToHost());
    this.resizeObserver.observe(host);
    this.resizeToHost();
    this.onAvailabilityChange(true);
  }

  isAvailable(): boolean {
    return this.available && !this.disposed;
  }

  render(centerX: number, centerY: number, zoom: number): ArenaCameraViewport {
    const viewport = clampArenaCamera(centerX, centerY, zoom, this.worldWidth, this.worldHeight);
    if (!this.isAvailable()) return viewport;
    this.resizeToHost();
    applyArenaCamera(this.camera, viewport, this.worldHeight);
    try {
      this.renderer.render(this.scene, this.camera);
    } catch {
      this.setAvailable(false);
    }
    return viewport;
  }

  renderArena(frame: ArenaSceneFrame, centerX: number, centerY: number, zoom: number): boolean {
    if (!this.isAvailable()) return false;
    this.resizeToHost();
    applyArenaSceneCamera(this.arena.camera, centerX, centerY, zoom,
      this.renderWidth / this.renderHeight, this.worldWidth);
    try {
      this.arena.update(frame);
      this.renderer.render(this.arena.scene, this.arena.camera);
      this.host.dataset.actors = String(this.arena.stats().actors);
      return true;
    } catch {
      this.setAvailable(false);
      return false;
    }
  }

  project(x: number, y: number, height: number, width: number, screenHeight: number) {
    return this.arena.project(x, y, height, width, screenHeight);
  }

  actorHeight(id: string): number { return this.arena.actorHeight(id); }

  pan(dx: number, dy: number, zoom: number) {
    return arenaScenePan(dx, dy, zoom, this.renderWidth / this.renderHeight, this.worldWidth);
  }

  viewport(x: number, y: number, zoom: number) {
    return clampArenaSceneCamera(x, y, zoom, Math.max(1, this.host.clientWidth) / Math.max(1, this.host.clientHeight),
      this.worldWidth, this.worldHeight);
  }

  dispose(): ArenaTerrainDisposalStats {
    if (this.disposed) return { geometries: 0, materials: 0, textures: 0 };
    this.disposed = true;
    this.arena.close();
    this.resizeObserver.disconnect();
    const canvas = this.renderer.domElement;
    canvas.removeEventListener('webglcontextlost', this.handleContextLost);
    canvas.removeEventListener('webglcontextrestored', this.handleContextRestored);
    const resources = new THREE.Group();
    resources.add(this.scene, this.arena.scene);
    const stats = disposeArenaTerrainResources(resources);
    this.renderer.dispose();
    this.renderer.forceContextLoss();
    if (canvas.parentElement === this.host) this.host.removeChild(canvas);
    return stats;
  }

  private resizeToHost(): void {
    if (this.disposed) return;
    const width = Math.max(1, Math.round(this.host.clientWidth));
    const height = Math.max(1, Math.round(this.host.clientHeight));
    const nextPixelRatio = Math.min(window.devicePixelRatio || 1, MAX_TERRAIN_PIXEL_RATIO);
    if (width === this.renderWidth && height === this.renderHeight && nextPixelRatio === this.pixelRatio) return;
    this.renderWidth = width;
    this.renderHeight = height;
    this.pixelRatio = nextPixelRatio;
    this.renderer.setPixelRatio(nextPixelRatio);
    this.renderer.setSize(width, height, false);
  }

  private setAvailable(available: boolean): void {
    if (this.disposed || this.available === available) return;
    this.available = available;
    this.onAvailabilityChange(available);
  }
}
