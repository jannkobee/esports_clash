import * as THREE from 'three';
import {
  clampArenaCamera,
  type ArenaCameraViewport,
} from './arenaPresentationCamera.ts';

export const LEGACY_TERRAIN_WIDTH = 1320;
export const MAX_TERRAIN_PIXEL_RATIO = 2;

export const ARENA_STATIC_TERRAIN_LAYERS = [
  'forest-floor',
  'river-bed',
  'central-causeway',
  'base-floor-plates',
  'central-plaza',
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

  root.traverse(object => {
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

  textures.forEach(texture => texture.dispose());
  materials.forEach(material => material.dispose());
  geometries.forEach(geometry => geometry.dispose());
  return { geometries: geometries.size, materials: materials.size, textures: textures.size };
}

const terrainVertexShader = /* glsl */`
  varying vec2 vWorld;
  uniform vec2 uWorldSize;

  void main() {
    vWorld = vec2(uv.x * uWorldSize.x, (1.0 - uv.y) * uWorldSize.y);
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const terrainFragmentShader = /* glsl */`
  varying vec2 vWorld;
  uniform vec2 uWorldSize;
  uniform float uBlueRampX;
  uniform float uRedRampX;

  float hash21(vec2 p) {
    p = fract(p * vec2(123.34, 456.21));
    p += dot(p, p + 45.32);
    return fract(p.x * p.y);
  }

  float roundedBoxMask(vec2 p, vec2 center, vec2 halfSize, float radius) {
    vec2 q = abs(p - center) - halfSize + vec2(radius);
    float distance = min(max(q.x, q.y), 0.0) + length(max(q, 0.0)) - radius;
    return 1.0 - smoothstep(-1.0, 1.0, distance);
  }

  float rectMask(vec2 p, vec2 minimum, vec2 maximum) {
    vec2 enter = smoothstep(minimum - vec2(1.0), minimum + vec2(1.0), p);
    vec2 leave = 1.0 - smoothstep(maximum - vec2(1.0), maximum + vec2(1.0), p);
    return enter.x * enter.y * leave.x * leave.y;
  }

  void main() {
    float sx = uWorldSize.x / 1320.0;
    vec2 design = vec2(vWorld.x / sx, vWorld.y);
    float y = clamp(vWorld.y / uWorldSize.y, 0.0, 1.0);

    vec3 top = vec3(0.106, 0.188, 0.157);
    vec3 middle = vec3(0.251, 0.329, 0.255);
    vec3 bottom = vec3(0.102, 0.176, 0.149);
    vec3 color = y < 0.5 ? mix(top, middle, y * 2.0) : mix(middle, bottom, (y - 0.5) * 2.0);

    vec2 meadowCell = floor(vec2(design.x / 92.0, design.y / 58.0));
    float meadowNoise = hash21(meadowCell);
    color += meadowNoise > 0.67 ? vec3(0.025, 0.033, 0.014) : vec3(0.0);
    float vignette = smoothstep(300.0, 790.0, length(vec2(design.x - 660.0, (design.y - 380.0) * 1.25)));
    color = mix(color, vec3(0.02, 0.059, 0.051), vignette * 0.42);

    float riverCenter = 670.0 + sin((design.y / 760.0) * 6.2831853 - 0.7) * 16.0;
    float riverDistance = abs(design.x - riverCenter);
    float riverEdge = 42.0 + sin(design.y * 0.015) * 4.0;
    float riverOutline = 1.0 - smoothstep(riverEdge + 5.0, riverEdge + 8.0, riverDistance);
    float river = 1.0 - smoothstep(riverEdge - 2.0, riverEdge + 1.0, riverDistance);
    color = mix(color, vec3(0.051, 0.137, 0.145), riverOutline * 0.65);
    float riverLight = 1.0 - smoothstep(0.0, riverEdge, riverDistance);
    color = mix(color, mix(vec3(0.153, 0.412, 0.435), vec3(0.243, 0.545, 0.561), riverLight), river * 0.82);

    float causewayShadow = roundedBoxMask(design, vec2(660.0, 381.0), vec2(614.0, 115.0), 23.0);
    color = mix(color, vec3(0.055, 0.082, 0.086), causewayShadow * 0.72);
    float causeway = roundedBoxMask(design, vec2(660.0, 380.0), vec2(608.0, 116.0), 20.0);
    float causewayY = clamp((design.y - 264.0) / 232.0, 0.0, 1.0);
    vec3 causewayColor = causewayY < 0.5
      ? mix(vec3(0.318, 0.310, 0.271), vec3(0.486, 0.467, 0.392), causewayY * 2.0)
      : mix(vec3(0.486, 0.467, 0.392), vec3(0.278, 0.282, 0.247), (causewayY - 0.5) * 2.0);
    color = mix(color, causewayColor, causeway);

    float causewayInner = roundedBoxMask(design, vec2(660.0, 380.0), vec2(602.0, 110.0), 15.0);
    float causewayBorder = max(0.0, causeway - causewayInner);
    color = mix(color, vec3(0.80, 0.75, 0.60), causewayBorder * 0.42);

    float verticalJoint = 1.0 - smoothstep(0.7, 1.5, min(mod(design.x - 60.0, 44.0), 44.0 - mod(design.x - 60.0, 44.0)));
    float horizontalJoint = 1.0 - smoothstep(0.7, 1.5, min(mod(design.y - 280.0, 32.0), 32.0 - mod(design.y - 280.0, 32.0)));
    float joint = max(verticalJoint, horizontalJoint) * causewayInner;
    color = mix(color, vec3(0.122, 0.153, 0.133), joint * 0.28);

    float sheen = rectMask(design, vec2(70.0, 350.0), vec2(1250.0, 410.0));
    float sheenStrength = 1.0 - abs(design.y - 380.0) / 30.0;
    color = mix(color, vec3(0.835, 0.773, 0.592), sheen * max(0.0, sheenStrength) * 0.18);
    float moss = max(rectMask(design, vec2(60.0, 268.0), vec2(1260.0, 273.0)), rectMask(design, vec2(60.0, 487.0), vec2(1260.0, 492.0)));
    color = mix(color, vec3(0.322, 0.467, 0.282), moss * 0.62);

    float bluePlate = rectMask(vWorld, vec2(50.0 * sx, 269.0), vec2(uBlueRampX, 491.0));
    float redPlate = rectMask(vWorld, vec2(uRedRampX, 269.0), vec2(1270.0 * sx, 491.0));
    color = mix(color, vec3(0.24, 0.28, 0.34), (bluePlate + redPlate) * 0.23);
    float plateCap = max(
      max(rectMask(vWorld, vec2(50.0 * sx, 264.0), vec2(uBlueRampX, 272.0)), rectMask(vWorld, vec2(50.0 * sx, 488.0), vec2(uBlueRampX, 496.0))),
      max(rectMask(vWorld, vec2(uRedRampX, 264.0), vec2(1270.0 * sx, 272.0)), rectMask(vWorld, vec2(uRedRampX, 488.0), vec2(1270.0 * sx, 496.0)))
    );
    color = mix(color, vec3(0.059, 0.090, 0.165), plateCap * 0.55);
    float blueEdge = 1.0 - smoothstep(1.0, 3.0, abs(vWorld.x - uBlueRampX));
    float redEdge = 1.0 - smoothstep(1.0, 3.0, abs(vWorld.x - uRedRampX));
    float edgeY = rectMask(vWorld, vec2(0.0, 270.0), vec2(uWorldSize.x, 490.0));
    color = mix(color, vec3(0.22, 0.74, 0.97), blueEdge * edgeY);
    color = mix(color, vec3(0.98, 0.44, 0.53), redEdge * edgeY);

    float highway = rectMask(design, vec2(80.0, 350.0), vec2(1240.0, 410.0));
    color = mix(color, vec3(0.357, 0.353, 0.290), highway);
    float highwayInner = rectMask(design, vec2(81.0, 352.0), vec2(1239.0, 408.0));
    color = mix(color, vec3(0.50, 0.46, 0.35), max(0.0, highway - highwayInner) * 0.52);

    vec2 plazaDelta = vec2((design.x - 660.0) / 140.0, (design.y - 380.0) / 140.0);
    float plazaDistance = length(plazaDelta);
    float plaza = 1.0 - smoothstep(0.985, 1.015, plazaDistance);
    color = mix(color, vec3(0.082, 0.129, 0.196), plaza);
    float plazaOuterRing = 1.0 - smoothstep(0.0, 0.018, abs(plazaDistance - 0.985));
    color = mix(color, vec3(0.278, 0.341, 0.412), plazaOuterRing);
    vec2 insetDelta = vec2((design.x - 660.0) / 95.0, (design.y - 380.0) / 95.0);
    float insetRing = 1.0 - smoothstep(0.0, 0.025, abs(length(insetDelta) - 1.0));
    color = mix(color, vec3(0.063, 0.725, 0.506), insetRing * 0.4);

    gl_FragColor = vec4(color, 1.0);
  }
`;

export class ThreeArenaTerrain {
  private readonly host: HTMLElement;
  private readonly worldWidth: number;
  private readonly worldHeight: number;
  private readonly onAvailabilityChange: (available: boolean) => void;
  private readonly scene = new THREE.Scene();
  private readonly camera = new THREE.OrthographicCamera();
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

    const geometry = new THREE.PlaneGeometry(worldWidth, worldHeight);
    const material = new THREE.ShaderMaterial({
      uniforms: {
        uWorldSize: { value: new THREE.Vector2(worldWidth, worldHeight) },
        uBlueRampX: { value: blueRampX },
        uRedRampX: { value: redRampX },
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

  dispose(): ArenaTerrainDisposalStats {
    if (this.disposed) return { geometries: 0, materials: 0, textures: 0 };
    this.disposed = true;
    this.resizeObserver.disconnect();
    const canvas = this.renderer.domElement;
    canvas.removeEventListener('webglcontextlost', this.handleContextLost);
    canvas.removeEventListener('webglcontextrestored', this.handleContextRestored);
    const stats = disposeArenaTerrainResources(this.scene);
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
