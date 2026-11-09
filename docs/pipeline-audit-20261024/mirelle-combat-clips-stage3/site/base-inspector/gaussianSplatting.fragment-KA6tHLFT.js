import { t as e } from "./shaderStore-CXjvw9c2.js";
import { n as t, t as n } from "./clipPlaneFragment-CttnRwsP.js";
import { n as r, t as i } from "./fogFragment-CdxJqUKP.js";
import { t as a } from "./objectIdFunctions-BWxMHGsY.js";
import { n as o, t as s } from "./logDepthFragment-B1sT_71C.js";
import { t as c } from "./logDepthDeclaration-BVRSbJkA.js";
//#region node_modules/@babylonjs/core/Shaders/ShadersInclude/packingFunctions.js
var l = "packingFunctions", u = "vec4 pack(float depth)\n{const vec4 bit_shift=vec4(255.0*255.0*255.0,255.0*255.0,255.0,1.0);const vec4 bit_mask=vec4(0.0,1.0/255.0,1.0/255.0,1.0/255.0);vec4 res=fract(depth*bit_shift);res-=res.xxyz*bit_mask;return res;}\nfloat unpack(vec4 color)\n{const vec4 bit_shift=vec4(1.0/(255.0*255.0*255.0),1.0/(255.0*255.0),1.0/255.0,1.0);return dot(color,bit_shift);}";
e.IncludesShadersStore[l] || (e.IncludesShadersStore[l] = u);
var d = {
	name: l,
	shader: u
}, f = "gaussianSplattingFragmentDeclaration", p = "vec4 gaussianColor(vec4 inColor)\n{float A=-dot(vPosition,vPosition);if (A<-4.0) discard;float B=exp(A)*inColor.a;\n#include<logDepthFragment>\nvec3 color=inColor.rgb;\n#ifdef FOG\n#include<fogFragment>\n#endif\nreturn vec4(color,B);}\n";
e.IncludesShadersStore[f] || (e.IncludesShadersStore[f] = p);
var m = {
	name: f,
	shader: p
}, h = "geometryRenderingFragment", g = "#ifdef PREPASS\n#if SCENE_MRT_COUNT>0\nfloat geometryCoverage=geometryColor.a>0.4 ? 1.0 : 0.0;\n#ifdef PREPASS_COLOR\nWRITE_GEOMETRY_FRAGMENT_OUTPUT(PREPASS_COLOR_INDEX,geometryColor);\n#endif\n#ifdef PREPASS_POSITION\nWRITE_GEOMETRY_FRAGMENT_OUTPUT(PREPASS_POSITION_INDEX,vec4(geometryPositionW,geometryCoverage));\n#endif\n#ifdef PREPASS_LOCAL_POSITION\nWRITE_GEOMETRY_FRAGMENT_OUTPUT(PREPASS_LOCAL_POSITION_INDEX,vec4(geometryPositionL,geometryCoverage));\n#endif\n#ifdef PREPASS_DEPTH\nWRITE_GEOMETRY_FRAGMENT_OUTPUT(PREPASS_DEPTH_INDEX,vec4(geometryViewDepth,0.0,0.0,geometryCoverage));\n#endif\n#ifdef PREPASS_NORMALIZED_VIEW_DEPTH\nWRITE_GEOMETRY_FRAGMENT_OUTPUT(PREPASS_NORMALIZED_VIEW_DEPTH_INDEX,vec4(geometryNormalizedViewDepth,0.0,0.0,geometryCoverage));\n#endif\n#ifdef PREPASS_SCREENSPACE_DEPTH\nWRITE_GEOMETRY_FRAGMENT_OUTPUT(PREPASS_SCREENSPACE_DEPTH_INDEX,vec4(gl_FragCoord.z,0.0,0.0,geometryCoverage));\n#endif\n#ifdef PREPASS_NORMAL\nWRITE_GEOMETRY_FRAGMENT_OUTPUT(PREPASS_NORMAL_INDEX,vec4(geometryNormalV,geometryCoverage));\n#endif\n#ifdef PREPASS_WORLD_NORMAL\nWRITE_GEOMETRY_FRAGMENT_OUTPUT(PREPASS_WORLD_NORMAL_INDEX,vec4(geometryNormalW*0.5+0.5,geometryCoverage));\n#endif\n#ifdef PREPASS_ALBEDO\nWRITE_GEOMETRY_FRAGMENT_OUTPUT(PREPASS_ALBEDO_INDEX,vec4(geometryAlbedo,geometryCoverage));\n#endif\n#ifdef PREPASS_ALBEDO_SQRT\nWRITE_GEOMETRY_FRAGMENT_OUTPUT(PREPASS_ALBEDO_SQRT_INDEX,vec4(sqrt(max(geometryAlbedo,vec3(0.0))),geometryCoverage));\n#endif\n#ifdef PREPASS_REFLECTIVITY\nWRITE_GEOMETRY_FRAGMENT_OUTPUT(PREPASS_REFLECTIVITY_INDEX,vec4(0.0,0.0,0.0,geometryCoverage));\n#endif\n#ifdef PREPASS_IRRADIANCE\nWRITE_GEOMETRY_FRAGMENT_OUTPUT(PREPASS_IRRADIANCE_INDEX,vec4(0.0,0.0,0.0,geometryCoverage));\n#endif\n#ifdef PREPASS_IRRADIANCE_LEGACY\nWRITE_GEOMETRY_FRAGMENT_OUTPUT(PREPASS_IRRADIANCE_LEGACY_INDEX,vec4(0.0));\n#endif\n#if defined(PREPASS_VELOCITY) || defined(PREPASS_VELOCITY_LINEAR)\n#ifdef PREPASS_VELOCITY_ZERO\nvec2 geometryMotion=vec2(0.0);\n#else\nvec2 geometryMotion=0.5*(geometryCurrentPosition.xy/geometryCurrentPosition.w-geometryPreviousPosition.xy/geometryPreviousPosition.w);\n#endif\n#ifdef PREPASS_VELOCITY\nWRITE_GEOMETRY_FRAGMENT_OUTPUT(PREPASS_VELOCITY_INDEX,vec4(pow(abs(geometryMotion),vec2(1.0/3.0))*sign(geometryMotion)*0.5+0.5,0.0,geometryCoverage));\n#endif\n#ifdef PREPASS_VELOCITY_LINEAR\nWRITE_GEOMETRY_FRAGMENT_OUTPUT(PREPASS_VELOCITY_LINEAR_INDEX,vec4(-geometryMotion,0.0,geometryCoverage));\n#endif\n#endif\n#ifdef PREPASS_OBJECT_ID\nWRITE_GEOMETRY_FRAGMENT_OUTPUT(PREPASS_OBJECT_ID_INDEX,encodeObjectId(objectId)*geometryCoverage);\n#endif\n#ifdef PREPASS_MESH_BLEND_TAG\nmeshBlendTagOutput=geometryCoverage>0.0 ? uvec4(uint(meshBlendTag),0u,0u,0u) : uvec4(0u);\n#endif\n#endif\n#endif\n";
e.IncludesShadersStore[h] || (e.IncludesShadersStore[h] = g);
var _ = {
	name: h,
	shader: g
}, v = "gaussianSplattingPixelShader", y = "#include<clipPlaneFragmentDeclaration>\n#include<logDepthDeclaration>\n#include<fogFragmentDeclaration>\n#define PREPASS_CUSTOM_VARYINGS\n#include<prePassDeclaration>[SCENE_MRT_COUNT]\n#if defined(GPUPICKER_DEPTH) && !defined(PREPASS)\nlayout(location=0) out highp vec4 glFragData[2];\n#endif\n#ifdef GPUPICKER_PACK_DEPTH\n#include<packingFunctions>\n#endif\nvarying vec4 vColor;varying vec2 vPosition;\n#ifdef PREPASS\nuniform float geometryZeroAlphaDiscard;\n#ifdef PREPASS_POSITION\nvarying vec3 vGeometryPositionW;\n#endif\n#ifdef PREPASS_LOCAL_POSITION\nvarying vec3 vGeometryPositionL;\n#endif\n#ifdef PREPASS_DEPTH\nvarying float vGeometryViewDepth;\n#endif\n#ifdef PREPASS_NORMALIZED_VIEW_DEPTH\nvarying float vGeometryNormalizedViewDepth;\n#endif\n#ifdef PREPASS_NORMAL\nvarying vec3 vGeometryNormalV;\n#endif\n#ifdef PREPASS_WORLD_NORMAL\nvarying vec3 vGeometryNormalW;\n#endif\n#if defined(PREPASS_ALBEDO) || defined(PREPASS_ALBEDO_SQRT)\nvarying vec3 vGeometryAlbedo;\n#endif\n#if defined(PREPASS_VELOCITY) || defined(PREPASS_VELOCITY_LINEAR)\nvarying vec4 vGeometryCurrentPosition;varying vec4 vGeometryPreviousPosition;\n#endif\n#endif\n#define CUSTOM_FRAGMENT_DEFINITIONS\n#include<gaussianSplattingFragmentDeclaration>\nvoid main () {\n#define CUSTOM_FRAGMENT_MAIN_BEGIN\n#include<clipPlaneFragment>\nvec4 finalColor=gaussianColor(vColor);\n#define CUSTOM_FRAGMENT_BEFORE_FRAGCOLOR\n#ifdef PREPASS\nif (finalColor.a<=0.0 && geometryZeroAlphaDiscard>0.0) {discard;}\nvec4 geometryColor=finalColor;\n#if defined(PREPASS_ALBEDO) || defined(PREPASS_ALBEDO_SQRT)\nvec3 geometryAlbedo=vGeometryAlbedo;\n#endif\n#ifdef PREPASS_POSITION\nvec3 geometryPositionW=vGeometryPositionW;\n#endif\n#ifdef PREPASS_LOCAL_POSITION\nvec3 geometryPositionL=vGeometryPositionL;\n#endif\n#ifdef PREPASS_DEPTH\nfloat geometryViewDepth=vGeometryViewDepth;\n#endif\n#ifdef PREPASS_NORMALIZED_VIEW_DEPTH\nfloat geometryNormalizedViewDepth=vGeometryNormalizedViewDepth;\n#endif\n#ifdef PREPASS_NORMAL\nvec3 geometryNormalV=vGeometryNormalV;\n#endif\n#ifdef PREPASS_WORLD_NORMAL\nvec3 geometryNormalW=vGeometryNormalW;\n#endif\n#if defined(PREPASS_VELOCITY) || defined(PREPASS_VELOCITY_LINEAR)\nvec4 geometryCurrentPosition=vGeometryCurrentPosition;vec4 geometryPreviousPosition=vGeometryPreviousPosition;\n#endif\n#include<geometryRenderingFragment>\n#elif defined(GPUPICKER_DEPTH)\nglFragData[0]=finalColor;\n#ifdef GPUPICKER_PACK_DEPTH\nglFragData[1]=pack(gl_FragCoord.z);\n#else\nglFragData[1]=vec4(gl_FragCoord.z,0.0,0.0,1.0);\n#endif\n#else\ngl_FragColor=finalColor;\n#endif\n#define CUSTOM_FRAGMENT_MAIN_END\n}\n";
e.ShadersStore[v] || (e.ShadersStore[v] = y);
var b = [
	t,
	c,
	r,
	a,
	o,
	d,
	s,
	i,
	m,
	n,
	_
];
for (let t of b) e.IncludesShadersStore[t.name] || (e.IncludesShadersStore[t.name] = t.shader);
var x = {
	name: v,
	shader: y
};
//#endregion
export { x as gaussianSplattingPixelShader };
