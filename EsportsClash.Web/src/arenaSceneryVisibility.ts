import * as THREE from 'three';

const MAX_CUTAWAYS = 20;
/** Depth-aware scenery cutaways. Only copied, renderer-space numbers survive a frame. */
export class ArenaSceneryVisibility {
  private readonly starts = { value: Array.from({ length: MAX_CUTAWAYS }, () => new THREE.Vector4()) };
  private readonly ends = { value: Array.from({ length: MAX_CUTAWAYS }, () => new THREE.Vector4()) };
  private readonly count = { value: 0 };
  private readonly bound = new WeakSet<THREE.Material>();
  private readonly point = new THREE.Vector3();

  bind(material: THREE.MeshStandardMaterial): void {
    if (this.bound.has(material)) return;
    this.bound.add(material);
    const compile = material.onBeforeCompile, key = material.customProgramCacheKey();
    material.customProgramCacheKey = () => key + '|arena-cutaway-v1';
    material.onBeforeCompile = (shader, renderer) => {
      compile.call(material, shader, renderer);
      shader.uniforms.uCutawayStarts = this.starts;
      shader.uniforms.uCutawayEnds = this.ends;
      shader.uniforms.uCutawayCount = this.count;
      shader.vertexShader = 'varying vec3 vSceneryView;\n' + shader.vertexShader;
      shader.vertexShader = shader.vertexShader.replace('#include <project_vertex>',
        '#include <project_vertex>\nvSceneryView=vec3(mvPosition.xy,-mvPosition.z);');
      shader.fragmentShader = /* glsl */`
        varying vec3 vSceneryView;
        uniform vec4 uCutawayStarts[${MAX_CUTAWAYS}];
        uniform vec4 uCutawayEnds[${MAX_CUTAWAYS}];
        uniform int uCutawayCount;
      ` + shader.fragmentShader;
      shader.fragmentShader = shader.fragmentShader.replace('#include <clipping_planes_fragment>', /* glsl */`
        #include <clipping_planes_fragment>
        float cutaway=0.;
        for(int i=0;i<${MAX_CUTAWAYS};i++){
          if(i>=uCutawayCount)break;
          vec4 a=uCutawayStarts[i],b=uCutawayEnds[i];
          if(vSceneryView.x<min(a.x,b.x)-max(a.w,b.w)||vSceneryView.x>max(a.x,b.x)+max(a.w,b.w))continue;
          vec2 ab=b.xy-a.xy;
          float t=clamp(dot(vSceneryView.xy-a.xy,ab)/max(dot(ab,ab),.001),0.,1.);
          float depth=mix(a.z,b.z,t),radius=mix(a.w,b.w,t);
          float distanceToBody=length(vSceneryView.xy-mix(a.xy,b.xy,t))/radius;
          // Geometry behind the body and its immediate footing stay opaque.
          float front=1.-smoothstep(depth-7.,depth-2.,vSceneryView.z);
          cutaway=max(cutaway,(1.-smoothstep(.48,1.,distanceToBody))*front*.82);
        }
        float pattern=fract(sin(dot(floor(gl_FragCoord.xy),vec2(12.9898,78.233)))*43758.5453);
        if(pattern<cutaway)discard;
      `);
    };
    material.needsUpdate = true;
  }

  begin(): void { this.count.value = 0; }
  protect(camera: THREE.Camera, x: number, ground: number, z: number, height: number, radius = 25): void {
    const i = this.count.value;
    if (i >= MAX_CUTAWAYS || ![x, ground, z, height].every(Number.isFinite)) return;
    this.point.set(x, ground + 14, z).applyMatrix4(camera.matrixWorldInverse);
    this.starts.value[i].set(this.point.x, this.point.y, -this.point.z, radius);
    this.point.set(x, ground + Math.max(22, height - 5), z).applyMatrix4(camera.matrixWorldInverse);
    this.ends.value[i].set(this.point.x, this.point.y, -this.point.z, radius);
    this.count.value++;
  }
}
