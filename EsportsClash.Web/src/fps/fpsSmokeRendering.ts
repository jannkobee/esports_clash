import { MeshBuilder, Mesh, ShaderMaterial, TransformNode, Vector3, type Scene } from '@babylonjs/core';
import { liveSmokeCloudLobes, liveSmokeSettle, LIVE_SMOKE_FLOOR_DROP, type LiveSmokeVolume } from './fpsLiveBrain.ts';

const vertexSource=`precision highp float;
attribute vec3 position;
uniform mat4 world;
uniform mat4 worldViewProjection;
varying vec3 worldPoint;
void main(){worldPoint=(world*vec4(position,1.0)).xyz;gl_Position=worldViewProjection*vec4(position,1.0);}`;
const fragmentSource=`precision highp float;
varying vec3 worldPoint;
uniform vec3 eyePosition;
uniform vec3 cloudOrigin;
uniform float floorLevel;
uniform mat4 viewProjection;
uniform vec4 lobes[15];
uniform vec3 radii[15];
uniform float cloudTime;
uniform float fade;
float hash(vec3 p){return fract(sin(dot(p,vec3(127.1,311.7,74.7)))*43758.5453);}
float noise(vec3 p){vec3 i=floor(p),f=fract(p);f=f*f*(3.0-2.0*f);
return mix(mix(mix(hash(i),hash(i+vec3(1,0,0)),f.x),mix(hash(i+vec3(0,1,0)),hash(i+vec3(1,1,0)),f.x),f.y),
mix(mix(hash(i+vec3(0,0,1)),hash(i+vec3(1,0,1)),f.x),mix(hash(i+vec3(0,1,1)),hash(i+vec3(1,1,1)),f.x),f.y),f.z);}
float fbm(vec3 p){
  float v=0.0;
  v+=0.55*noise(p);
  v+=0.30*noise(p*2.13+vec3(13.1,7.7,5.3));
  v+=0.15*noise(p*4.27+vec3(2.9,19.4,11.2));
  return v;
}
void main(){
  vec3 direction=normalize(worldPoint-eyePosition);
  float opticalDepth=0.0;float weightedEntry=0.0;float weightedMid=0.0;float weightSum=0.0;float frontEntry=10000.0;
  float floorY=floorLevel;
  float minT=0.0;
  float maxT=10000.0;
  if(eyePosition.y>=floorY){
    if(direction.y<-0.0001)maxT=(floorY-eyePosition.y)/direction.y;
  }else{
    if(direction.y>0.0001)minT=(floorY-eyePosition.y)/direction.y;
    else discard;
  }
  for(int i=0;i<15;i++){
    vec3 r=max(radii[i],vec3(0.001)),o=(eyePosition-lobes[i].xyz)/r,d=direction/r;
    float a=dot(d,d),b=dot(o,d),c=dot(o,o)-1.0,disc=b*b-a*c;
    if(disc>=0.0){float root=sqrt(disc),entry=max(minT,(-b-root)/a),exit=min(maxT,(-b+root)/a);
      if(exit>entry){
        float chord=exit-entry;
        vec3 pMid=o+d*(0.5*(entry+exit));
        float r2=clamp(dot(pMid,pMid),0.0,1.0);
        float radial=(1.0-r2)*(1.0-r2);
        float layer=chord*(0.28+0.72*radial);
        opticalDepth+=layer;
        float w=chord*chord*(0.2+0.8*radial);
        weightedEntry+=(entry+chord*0.06)*w;
        weightedMid+=0.5*(entry+exit)*w;
        weightSum+=w;
        if(layer>0.08)frontEntry=min(frontEntry,entry+chord*0.05);
      }}
  }
  if(opticalDepth*fade<0.005||weightSum<=1e-6)discard;
  float effectiveEntry=weightedEntry/weightSum;
  float effectiveMid=weightedMid/weightSum;
  float depthEntry=frontEntry<9999.0?min(effectiveEntry,frontEntry+0.15):effectiveEntry;
  vec3 flow=vec3(cloudTime*.055,-cloudTime*.032,cloudTime*.025);
  float sampleDist=max(1.65,max(effectiveEntry+min(opticalDepth,1.8)*.55,effectiveMid));
  vec3 samplePoint=eyePosition+direction*sampleDist;
  float billow=fbm(samplePoint*1.35+flow);
  float detail=fbm(samplePoint*2.8-flow*1.4);
  float edgeNoise=mix(billow,detail,0.35);
  float sculptedOptical=max(0.0,opticalDepth-(1.0-edgeNoise)*0.20*clamp(1.2-opticalDepth*0.35,0.25,1.0));
  float density=sculptedOptical*(0.68+0.50*billow)*fade;
  float alpha=clamp(1.0-exp(-density*2.2),0.0,0.99)*smoothstep(0.18,0.88,density);
  if(alpha<0.015)discard;
  vec3 normalApprox=normalize((samplePoint-vec3(cloudOrigin.x,cloudOrigin.y-0.15,cloudOrigin.z))*vec3(1.0,1.35,1.0)+(detail-0.5)*0.85);
  float sunWrap=clamp(dot(normalApprox,normalize(vec3(0.45,0.78,-0.35)))*0.5+0.5,0.0,1.0);
  float heightShade=smoothstep(-1.35,1.75,samplePoint.y-cloudOrigin.y);
  vec3 warmSun=vec3(0.84,0.86,0.85);
  vec3 coolShadow=vec3(0.44,0.49,0.53);
  vec3 color=mix(coolShadow,warmSun,clamp(heightShade*0.52+sunWrap*0.34+billow*0.24-0.08,0.0,1.0));
  vec4 hit=viewProjection*vec4(eyePosition+direction*max(0.48,depthEntry),1.0);
  SMOKE_DEPTH=clamp(hit.z/hit.w*.5+.5,0.0,1.0);
  gl_FragColor=vec4(color,alpha);
}`;

/** Analytic optical depth of the exact shared smoke ellipsoids, with depth-tested front entry. */
export interface LiveSmokeRenderVolume { root:TransformNode; mesh:Mesh; material:ShaderMaterial }
export function createLiveSmokeRenderVolume(scene:Scene,id:number):LiveSmokeRenderVolume|undefined {
  const engine=scene.getEngine();
  if(!engine.getCaps().fragmentDepthSupported||engine.getCaps().maxFragmentUniformVectors<40)return;
  const webgl2='webGLVersion' in engine&&Number(engine.webGLVersion)>1;
  const fragment=(webgl2?'#define SMOKE_DEPTH gl_FragDepth\n':'#extension GL_EXT_frag_depth : enable\n#define SMOKE_DEPTH gl_FragDepthEXT\n')+fragmentSource;
  const material=new ShaderMaterial(`smoke-volume-${id}`,scene,{vertexSource,fragmentSource:fragment},{
    attributes:['position'],uniforms:['world','worldViewProjection','viewProjection','eyePosition','cloudOrigin','floorLevel','lobes','radii','cloudTime','fade'],needAlphaBlending:true,
  });
  material.disableDepthWrite=true;material.backFaceCulling=true;
  material.onBindObservable.add(()=>{
    const camera=scene.activeCamera;if(!camera)return;
    material.setVector3('eyePosition',camera.globalPosition);material.setMatrix('viewProjection',camera.getTransformationMatrix());
  });
  const root=new TransformNode(`smoke-cloud-${id}`,scene);
  const mesh=MeshBuilder.CreateBox(`smoke-volume-bounds-${id}`,{size:1,sideOrientation:Mesh.BACKSIDE},scene);
  mesh.parent=root;mesh.material=material;mesh.isPickable=false;mesh.alphaIndex=20;
  return {root,mesh,material};
}
export function updateLiveSmokeRenderVolume(view:LiveSmokeRenderVolume,smoke:LiveSmokeVolume,time:number):void {
  const lobes=liveSmokeCloudLobes(smoke,time),centers:number[]=[],radii:number[]=[];
  for(const lobe of lobes){centers.push(smoke.x+lobe.x,smoke.y+lobe.y,smoke.z+lobe.z,0);radii.push(lobe.scaleX/2,lobe.scaleY/2,lobe.scaleZ/2);}
  view.root.position.set(smoke.x,smoke.y,smoke.z);
  view.mesh.scaling.set(Math.max(.05,smoke.radius*2.2),Math.max(7.2,smoke.radius*2.4),Math.max(.05,smoke.radius*2.2));
  view.material.setArray4('lobes',centers);view.material.setArray3('radii',radii);
  // Shading follows the settled cloud body; the floor clip stays where sight tests put it.
  view.material.setVector3('cloudOrigin',new Vector3(smoke.x,smoke.y+liveSmokeSettle(smoke.radius),smoke.z));
  view.material.setFloat('floorLevel',smoke.y-LIVE_SMOKE_FLOOR_DROP);view.material.setFloat('cloudTime',time);
  view.material.setFloat('fade',Math.min(1,Math.max(0,(smoke.expires-time)/1.2)));
}
