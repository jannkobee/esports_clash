import { t as e } from "./shaderStore-CXjvw9c2.js";
//#region node_modules/@babylonjs/core/Shaders/ShadersInclude/decalVertexDeclaration.js
var t = "decalVertexDeclaration", n = "#ifdef DECAL\nuniform vec4 vDecalInfos;uniform mat4 decalMatrix;\n#endif\n";
e.IncludesShadersStore[t] || (e.IncludesShadersStore[t] = n);
var r = {
	name: t,
	shader: n
}, i = "uvAttributeDeclaration", a = "#ifdef UV{X}\nattribute vec2 uv{X};\n#endif\n";
e.IncludesShadersStore[i] || (e.IncludesShadersStore[i] = a);
var o = {
	name: i,
	shader: a
}, s = "prePassVertexDeclaration", c = "#ifdef PREPASS\n#ifdef PREPASS_LOCAL_POSITION\nvarying vec3 vPosition;\n#endif\n#ifdef PREPASS_DEPTH\nvarying vec3 vViewPos;\n#endif\n#ifdef PREPASS_NORMALIZED_VIEW_DEPTH\nvarying float vNormViewDepth;\n#endif\n#if defined(PREPASS_VELOCITY) || defined(PREPASS_VELOCITY_LINEAR)\nuniform mat4 previousViewProjection;varying vec4 vCurrentPosition;varying vec4 vPreviousPosition;\n#endif\n#endif\n";
e.IncludesShadersStore[s] || (e.IncludesShadersStore[s] = c);
var l = {
	name: s,
	shader: c
}, u = "samplerVertexDeclaration", d = "#if defined(_DEFINENAME_) && _DEFINENAME_DIRECTUV==0\nvarying vec2 v_VARYINGNAME_UV;\n#endif\n";
e.IncludesShadersStore[u] || (e.IncludesShadersStore[u] = d);
var f = {
	name: u,
	shader: d
}, p = "lightVxFragmentDeclaration", m = "#ifdef LIGHT{X}\nuniform vec4 vLightData{X};uniform vec4 vLightDiffuse{X};\n#ifdef SPECULARTERM\nuniform vec4 vLightSpecular{X};\n#else\nvec4 vLightSpecular{X}=vec4(0.);\n#endif\n#ifdef SHADOW{X}\n#ifdef SHADOWCSM{X}\nuniform mat4 lightMatrix{X}[SHADOWCSMNUM_CASCADES{X}];varying vec4 vPositionFromLight{X}[SHADOWCSMNUM_CASCADES{X}];varying float vDepthMetric{X}[SHADOWCSMNUM_CASCADES{X}];varying vec4 vPositionFromCamera{X};\n#elif defined(SHADOWCUBE{X})\n#else\nvarying vec4 vPositionFromLight{X};varying float vDepthMetric{X};uniform mat4 lightMatrix{X};\n#endif\nuniform vec4 shadowsInfo{X};uniform vec2 depthValues{X};\n#endif\n#ifdef SPOTLIGHT{X}\nuniform vec4 vLightDirection{X};uniform vec4 vLightFalloff{X};\n#elif defined(POINTLIGHT{X})\nuniform vec4 vLightFalloff{X};\n#elif defined(HEMILIGHT{X})\nuniform vec3 vLightGround{X};\n#endif\n#if defined(AREALIGHT{X}) && defined(AREALIGHTUSED) && defined(AREALIGHTSUPPORTED)\nuniform vec4 vLightWidth{X};uniform vec4 vLightHeight{X};\n#endif\n#endif\n";
e.IncludesShadersStore[p] || (e.IncludesShadersStore[p] = m);
var h = {
	name: p,
	shader: m
}, g = "lightVxUboDeclaration", _ = "#ifdef LIGHT{X}\nuniform Light{X}\n{vec4 vLightData;vec4 vLightDiffuse;vec4 vLightSpecular;\n#ifdef SPOTLIGHT{X}\nvec4 vLightDirection;vec4 vLightFalloff;\n#elif defined(POINTLIGHT{X})\nvec4 vLightFalloff;\n#elif defined(HEMILIGHT{X})\nvec3 vLightGround;\n#elif defined(CLUSTLIGHT{X})\nvec2 vSliceData;vec2 vSliceRanges[CLUSTLIGHT_SLICES];\n#endif\n#if defined(AREALIGHT{X}) && defined(AREALIGHTUSED) && defined(AREALIGHTSUPPORTED)\nvec4 vLightWidth;vec4 vLightHeight;\n#endif\nvec4 shadowsInfo;vec2 depthValues;} light{X};\n#ifdef SHADOW{X}\n#ifdef SHADOWCSM{X}\nuniform mat4 lightMatrix{X}[SHADOWCSMNUM_CASCADES{X}];varying vec4 vPositionFromLight{X}[SHADOWCSMNUM_CASCADES{X}];varying float vDepthMetric{X}[SHADOWCSMNUM_CASCADES{X}];varying vec4 vPositionFromCamera{X};\n#elif defined(SHADOWCUBE{X})\n#else\nvarying vec4 vPositionFromLight{X};varying float vDepthMetric{X};uniform mat4 lightMatrix{X};\n#endif\n#endif\n#endif\n";
e.IncludesShadersStore[g] || (e.IncludesShadersStore[g] = _);
var v = {
	name: g,
	shader: _
}, y = "prePassVertex", b = "#ifdef PREPASS_DEPTH\nvViewPos=(view*worldPos).rgb;\n#endif\n#ifdef PREPASS_NORMALIZED_VIEW_DEPTH\nvNormViewDepth=((view*worldPos).z-cameraInfo.x)/(cameraInfo.y-cameraInfo.x);\n#endif\n#ifdef PREPASS_LOCAL_POSITION\nvPosition=positionUpdated.xyz;\n#endif\n#if (defined(PREPASS_VELOCITY) || defined(PREPASS_VELOCITY_LINEAR)) && defined(BONES_VELOCITY_ENABLED)\nvCurrentPosition=viewProjection*worldPos;\n#if NUM_BONE_INFLUENCERS>0\nmat4 previousInfluence;previousInfluence=mPreviousBones[int(matricesIndices[0])]*matricesWeights[0];\n#if NUM_BONE_INFLUENCERS>1\npreviousInfluence+=mPreviousBones[int(matricesIndices[1])]*matricesWeights[1];\n#endif \n#if NUM_BONE_INFLUENCERS>2\npreviousInfluence+=mPreviousBones[int(matricesIndices[2])]*matricesWeights[2];\n#endif \n#if NUM_BONE_INFLUENCERS>3\npreviousInfluence+=mPreviousBones[int(matricesIndices[3])]*matricesWeights[3];\n#endif\n#if NUM_BONE_INFLUENCERS>4\npreviousInfluence+=mPreviousBones[int(matricesIndicesExtra[0])]*matricesWeightsExtra[0];\n#endif \n#if NUM_BONE_INFLUENCERS>5\npreviousInfluence+=mPreviousBones[int(matricesIndicesExtra[1])]*matricesWeightsExtra[1];\n#endif \n#if NUM_BONE_INFLUENCERS>6\npreviousInfluence+=mPreviousBones[int(matricesIndicesExtra[2])]*matricesWeightsExtra[2];\n#endif \n#if NUM_BONE_INFLUENCERS>7\npreviousInfluence+=mPreviousBones[int(matricesIndicesExtra[3])]*matricesWeightsExtra[3];\n#endif\nvPreviousPosition=previousViewProjection*finalPreviousWorld*previousInfluence*vec4(positionUpdated,1.0);\n#else\nvPreviousPosition=previousViewProjection*finalPreviousWorld*vec4(positionUpdated,1.0);\n#endif\n#endif\n";
e.IncludesShadersStore[y] || (e.IncludesShadersStore[y] = b);
var x = {
	name: y,
	shader: b
}, S = "uvVariableDeclaration", C = "#if !defined(UV{X}) && defined(MAINUV{X})\nvec2 uv{X}=vec2(0.,0.);\n#endif\n#ifdef MAINUV{X}\nvMainUV{X}=uv{X};\n#endif\n";
e.IncludesShadersStore[S] || (e.IncludesShadersStore[S] = C);
var w = {
	name: S,
	shader: C
}, T = "samplerVertexImplementation", E = "#if defined(_DEFINENAME_) && _DEFINENAME_DIRECTUV==0\nif (v_INFONAME_==0.)\n{v_VARYINGNAME_UV=vec2(_MATRIXNAME_Matrix*vec4(uvUpdated,1.0,0.0));}\n#ifdef UV2\nelse if (v_INFONAME_==1.)\n{v_VARYINGNAME_UV=vec2(_MATRIXNAME_Matrix*vec4(uv2Updated,1.0,0.0));}\n#endif\n#ifdef UV3\nelse if (v_INFONAME_==2.)\n{v_VARYINGNAME_UV=vec2(_MATRIXNAME_Matrix*vec4(uv3,1.0,0.0));}\n#endif\n#ifdef UV4\nelse if (v_INFONAME_==3.)\n{v_VARYINGNAME_UV=vec2(_MATRIXNAME_Matrix*vec4(uv4,1.0,0.0));}\n#endif\n#ifdef UV5\nelse if (v_INFONAME_==4.)\n{v_VARYINGNAME_UV=vec2(_MATRIXNAME_Matrix*vec4(uv5,1.0,0.0));}\n#endif\n#ifdef UV6\nelse if (v_INFONAME_==5.)\n{v_VARYINGNAME_UV=vec2(_MATRIXNAME_Matrix*vec4(uv6,1.0,0.0));}\n#endif\n#endif\n";
e.IncludesShadersStore[T] || (e.IncludesShadersStore[T] = E);
var D = {
	name: T,
	shader: E
}, O = "shadowsVertex", k = "#ifdef SHADOWS\n#if defined(SHADOWCSM{X})\nvPositionFromCamera{X}=view*worldPos;for (int i=0; i<SHADOWCSMNUM_CASCADES{X}; i++) {vPositionFromLight{X}[i]=lightMatrix{X}[i]*worldPos;\n#ifdef USE_REVERSE_DEPTHBUFFER\nvDepthMetric{X}[i]=(-vPositionFromLight{X}[i].z+light{X}.depthValues.x)/light{X}.depthValues.y;\n#else\nvDepthMetric{X}[i]=(vPositionFromLight{X}[i].z+light{X}.depthValues.x)/light{X}.depthValues.y;\n#endif\n}\n#elif defined(SHADOW{X}) && !defined(SHADOWCUBE{X})\nvPositionFromLight{X}=lightMatrix{X}*worldPos;\n#ifdef USE_REVERSE_DEPTHBUFFER\nvDepthMetric{X}=(-vPositionFromLight{X}.z+light{X}.depthValues.x)/light{X}.depthValues.y;\n#else\nvDepthMetric{X}=(vPositionFromLight{X}.z+light{X}.depthValues.x)/light{X}.depthValues.y;\n#endif\n#endif\n#endif\n";
e.IncludesShadersStore[O] || (e.IncludesShadersStore[O] = k);
var A = {
	name: O,
	shader: k
};
//#endregion
export { v as a, l as c, x as i, o as l, D as n, h as o, w as r, f as s, A as t, r as u };
