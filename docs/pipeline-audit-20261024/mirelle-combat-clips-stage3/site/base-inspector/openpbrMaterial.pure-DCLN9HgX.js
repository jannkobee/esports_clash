import { t as e } from "./logger-DQIzSR_y.js";
import { S as t } from "./tools.functions-DEecYKlu.js";
import { n, o as r, s as i } from "./scene.pure-B0rulfRT.js";
import { n as a } from "./buffer.pure-CgsgX1aa.js";
import { a as o, c as s, d as c, l, n as u, t as d, u as f } from "./math.color.pure-CPmbqLkh.js";
import { n as p } from "./typeStore-pENEWnX2.js";
import { _ as m, b as h, i as g, n as _, t as v, v as y, y as b } from "./decorators-BldPRAAT.js";
import { t as ee } from "./decorators.serialization-CGAHzP43.js";
import { r as te } from "./tools.pure-Dy2G52NL.js";
import { t as ne } from "./smartArray-BmGU7Yab.js";
import { t as x } from "./sceneComponent-C2CdEKig.js";
import { A as S, C as re, D as ie, E as ae, M as oe, N as se, O as ce, P as C, S as le, T as ue, _ as w, a as de, b as fe, c as pe, d as me, f as he, g as ge, h as _e, i as ve, j as T, k as ye, l as be, m as xe, n as Se, o as Ce, p as we, r as Te, s as Ee, t as E, u as D, v as De, w as Oe, x as ke, y as Ae } from "./material.pure-BwKfnJ6P.js";
import { t as je } from "./texture.pure-Ce-ILsRv.js";
import { a as Me, c as Ne, d as Pe, f as Fe, i as Ie, l as Le, m as O, n as k, o as Re, p as A, r as j, s as ze, t as M, u as N } from "./imageProcessing-DRHeoyEC.js";
import { n as Be, r as Ve } from "./brdfTextureTools-DjkNyIiC.js";
import { t as P } from "./multiRenderTarget.pure-CL227SJx.js";
//#region node_modules/@babylonjs/core/Meshes/GaussianSplatting/gaussianSplatting.functions.js
function F(e) {
	return e === "GaussianSplattingMesh" || e === "GaussianSplattingStream";
}
function I(e) {
	return e._isGaussianSplatting || F(e.getClassName());
}
//#endregion
//#region node_modules/@babylonjs/core/Materials/environmentLighting.defines.js
function L(e) {
	return class extends e {
		constructor() {
			super(...arguments), this.REFLECTION = !1, this.REFLECTIONMAP_3D = !1, this.REFLECTIONMAP_SPHERICAL = !1, this.REFLECTIONMAP_PLANAR = !1, this.REFLECTIONMAP_CUBIC = !1, this.USE_LOCAL_REFLECTIONMAP_CUBIC = !1, this.REFLECTIONMAP_PROJECTION = !1, this.REFLECTIONMAP_SKYBOX = !1, this.REFLECTIONMAP_EXPLICIT = !1, this.REFLECTIONMAP_EQUIRECTANGULAR = !1, this.REFLECTIONMAP_EQUIRECTANGULAR_FIXED = !1, this.REFLECTIONMAP_MIRROREDEQUIRECTANGULAR_FIXED = !1, this.INVERTCUBICMAP = !1, this.USESPHERICALFROMREFLECTIONMAP = !1, this.USEIRRADIANCEMAP = !1, this.USE_IRRADIANCE_DOMINANT_DIRECTION = !1, this.USESPHERICALINVERTEX = !1, this.REFLECTIONMAP_OPPOSITEZ = !1, this.LODINREFLECTIONALPHA = !1, this.GAMMAREFLECTION = !1, this.RGBDREFLECTION = !1;
		}
	};
}
//#endregion
//#region node_modules/@babylonjs/core/Rendering/geometryBufferRendererSceneComponent.pure.js
var R = class {
	constructor(e) {
		this.name = x.NAME_GEOMETRYBUFFERRENDERER, this.scene = e;
	}
	register() {
		this.scene._gatherRenderTargetsStage.registerStep(x.STEP_GATHERRENDERTARGETS_GEOMETRYBUFFERRENDERER, this, this._gatherRenderTargets);
	}
	rebuild() {}
	dispose() {}
	_gatherRenderTargets(e) {
		this.scene._geometryBufferRenderer && e.push(this.scene._geometryBufferRenderer.getGBuffer());
	}
}, z = !1;
function B(e) {
	z || (z = !0, Object.defineProperty(n.prototype, "geometryBufferRenderer", {
		get: function() {
			return this._geometryBufferRenderer;
		},
		set: function(e) {
			e && e.isSupported && (this._geometryBufferRenderer = e);
		},
		enumerable: !0,
		configurable: !0
	}), n.prototype.enableGeometryBufferRenderer = function(t = 1, n = 15, r) {
		return this._geometryBufferRenderer || (this._geometryBufferRenderer = new e(this, t, n, r), this._geometryBufferRenderer.isSupported || (this._geometryBufferRenderer = null)), this._geometryBufferRenderer;
	}, n.prototype.disableGeometryBufferRenderer = function() {
		this._geometryBufferRenderer &&= (this._geometryBufferRenderer.dispose(), null);
	}, e._SceneComponentInitialization = (e) => {
		let t = e._getComponent(x.NAME_GEOMETRYBUFFERRENDERER);
		t || (t = new R(e), e._addComponent(t));
	});
}
//#endregion
//#region node_modules/@babylonjs/core/Meshes/meshBlendingTag.js
function V(e) {
	return e.shaderPlatformName !== "NATIVE" && (e.isWebGPU || e.webGLVersion === 2);
}
var H;
(function(e) {
	e[e.Small = 0] = "Small", e[e.Medium = 1] = "Medium", e[e.Large = 2] = "Large", e[e.ExtraLarge = 3] = "ExtraLarge";
})(H ||= {});
//#endregion
//#region node_modules/@babylonjs/core/Rendering/geometryBufferRenderer.pure.js
var U = [
	"diffuseSampler",
	"bumpSampler",
	"reflectivitySampler",
	"albedoSampler",
	"morphTargets",
	"boneSampler",
	"transmissionWeightSampler",
	"subsurfaceWeightSampler",
	"iblShadowSampler"
], W = /* @__PURE__ */ "world.mBones.viewProjection.diffuseMatrix.alphaCutOff.view.previousWorld.previousViewProjection.mPreviousBones.bumpMatrix.reflectivityMatrix.albedoMatrix.reflectivityColor.albedoColor.reflectionMatrix.vTransmissionWeight.vSubsurfaceWeight.vEyePosition.vTransmissionScatterAnisotropy.vSubsurfaceScatterAnisotropy.shadowTextureSize.metallic.glossiness.vTangentSpaceParams.vBumpInfos.morphTargetInfluences.morphTargetCount.morphTargetTextureInfo.morphTargetTextureIndices.boneTextureInfo.objectId.meshBlendTag".split("."), G = class e {
	get renderTransparentMeshes() {
		return this._renderTransparentMeshes;
	}
	set renderTransparentMeshes(e) {
		if (e && this._enableMeshBlendTag && !this._scene.getEngine().getCaps().blendParametersPerTarget) throw Error("GeometryBufferRenderer: transparent mesh-blending tags require per-target blend parameters");
		this._renderTransparentMeshes = e;
	}
	get normalsAreUnsigned() {
		return this._normalsAreUnsigned;
	}
	_linkPrePassRenderer(e) {
		if (this._enableObjectId || this._enableMeshBlendTag) throw Error("GeometryBufferRenderer: object ID and mesh-blending tag textures are not supported when linked to the PrePassRenderer");
		this._linkedWithPrePass = !0, this._prePassRenderer = e, this._scene._setPreviousWorldMatricesRequired(this, !1), this._multiRenderTarget && (this._multiRenderTarget.onClearObservable.clear(), this._multiRenderTarget.onClearObservable.add(() => {}));
	}
	_unlinkPrePassRenderer() {
		this._linkedWithPrePass = !1, this._createRenderTargets();
	}
	_resetLayout() {
		this._enableDepth = !0, this._enableNormal = !0, this._enablePosition = !1, this._enableReflectivity = !1, this._enableVelocity = !1, this._enableVelocityLinear = !1, this._enableScreenspaceDepth = !1, this._enableIrradiance = !1, this._enableObjectId = !1, this._enableMeshBlendTag = !1, this._attachmentsFromPrePass = [], this._scene._setPreviousWorldMatricesRequired(this, !1);
	}
	_forceTextureType(t, n) {
		t === e.POSITION_TEXTURE_TYPE ? (this._positionIndex = n, this._enablePosition = !0) : t === e.VELOCITY_TEXTURE_TYPE ? (this._velocityIndex = n, this._enableVelocity = !0) : t === e.VELOCITY_LINEAR_TEXTURE_TYPE ? (this._velocityLinearIndex = n, this._enableVelocityLinear = !0) : t === e.REFLECTIVITY_TEXTURE_TYPE ? (this._reflectivityIndex = n, this._enableReflectivity = !0) : t === e.DEPTH_TEXTURE_TYPE ? (this._depthIndex = n, this._enableDepth = !0) : t === e.NORMAL_TEXTURE_TYPE ? (this._normalIndex = n, this._enableNormal = !0) : t === e.SCREENSPACE_DEPTH_TEXTURE_TYPE ? (this._screenspaceDepthIndex = n, this._enableScreenspaceDepth = !0) : t === e.IRRADIANCE_TEXTURE_TYPE ? (this._irradianceIndex = n, this._enableIrradiance = !0) : t === e.OBJECT_ID_TEXTURE_TYPE ? (this._objectIdIndex = n, this._enableObjectId = !0) : t === e.MESH_BLEND_TAG_TEXTURE_TYPE && (this._meshBlendTagIndex = n, this._enableMeshBlendTag = !0);
	}
	_setAttachments(e) {
		this._attachmentsFromPrePass = e;
	}
	_linkInternalTexture(e) {
		this._multiRenderTarget.setInternalTexture(e, 0, !1);
	}
	get renderList() {
		return this._multiRenderTarget.renderList;
	}
	set renderList(e) {
		this._multiRenderTarget.renderList = e;
	}
	get isSupported() {
		return this._multiRenderTarget.isSupported;
	}
	getTextureIndex(t) {
		switch (t) {
			case e.POSITION_TEXTURE_TYPE: return this._positionIndex;
			case e.VELOCITY_TEXTURE_TYPE: return this._velocityIndex;
			case e.VELOCITY_LINEAR_TEXTURE_TYPE: return this._velocityLinearIndex;
			case e.REFLECTIVITY_TEXTURE_TYPE: return this._reflectivityIndex;
			case e.DEPTH_TEXTURE_TYPE: return this._depthIndex;
			case e.NORMAL_TEXTURE_TYPE: return this._normalIndex;
			case e.SCREENSPACE_DEPTH_TEXTURE_TYPE: return this._screenspaceDepthIndex;
			case e.IRRADIANCE_TEXTURE_TYPE: return this._irradianceIndex;
			case e.OBJECT_ID_TEXTURE_TYPE: return this._objectIdIndex;
			case e.MESH_BLEND_TAG_TEXTURE_TYPE: return this._meshBlendTagIndex;
			default: return -1;
		}
	}
	get enableDepth() {
		return this._enableDepth;
	}
	set enableDepth(e) {
		this._enableDepth = e, this._linkedWithPrePass || (this.dispose(), this._createRenderTargets());
	}
	get enableNormal() {
		return this._enableNormal;
	}
	set enableNormal(e) {
		this._enableNormal = e, this._linkedWithPrePass || (this.dispose(), this._createRenderTargets());
	}
	get enablePosition() {
		return this._enablePosition;
	}
	set enablePosition(e) {
		this._enablePosition = e, this._linkedWithPrePass || (this.dispose(), this._createRenderTargets());
	}
	get enableVelocity() {
		return this._enableVelocity;
	}
	set enableVelocity(e) {
		this._enableVelocity = e, e || (this._previousTransformationMatrices = {}), this._linkedWithPrePass || (this.dispose(), this._createRenderTargets());
	}
	get enableVelocityLinear() {
		return this._enableVelocityLinear;
	}
	set enableVelocityLinear(e) {
		this._enableVelocityLinear = e, this._linkedWithPrePass || (this.dispose(), this._createRenderTargets());
	}
	get enableReflectivity() {
		return this._enableReflectivity;
	}
	set enableReflectivity(e) {
		this._enableReflectivity = e, this._linkedWithPrePass || (this.dispose(), this._createRenderTargets());
	}
	get enableScreenspaceDepth() {
		return this._enableScreenspaceDepth;
	}
	set enableScreenspaceDepth(e) {
		this._enableScreenspaceDepth = e, this._linkedWithPrePass || (this.dispose(), this._createRenderTargets());
	}
	get enableIrradiance() {
		return this._enableIrradiance;
	}
	set enableIrradiance(e) {
		this._enableIrradiance = e, this._linkedWithPrePass || (this.dispose(), this._createRenderTargets());
	}
	get enableObjectId() {
		return this._enableObjectId;
	}
	set enableObjectId(e) {
		if (e && this._linkedWithPrePass) throw Error("GeometryBufferRenderer: object ID textures are not supported when linked to the PrePassRenderer");
		if (e && this.samples !== 1) throw Error("GeometryBufferRenderer: object ID textures currently require samples to be 1");
		if (e && !this._enableObjectId && !this._linkedWithPrePass) {
			let e = this._scene.getEngine(), t = Math.min(e.getCaps().maxDrawBuffers ?? 1, 8), n = this._assignRenderTargetIndices()[0] + 1;
			if (e.getCaps().drawBuffersExtension && n > t) throw Error(`GeometryBufferRenderer: ${n} color attachments were requested, but this engine supports at most ${t}`);
		}
		this._enableObjectId = e, e || (this._objectIdIndex = -1), this._linkedWithPrePass || (this.dispose(), this._createRenderTargets());
	}
	get enableMeshBlendingTag() {
		return this._enableMeshBlendTag;
	}
	set enableMeshBlendingTag(e) {
		if (this._enableMeshBlendTag !== e) {
			if (e) {
				let e = this._scene.getEngine();
				if (!V(e)) throw Error("GeometryBufferRenderer: mesh-blending tag textures require WebGL2 or WebGPU");
				if (this.renderTransparentMeshes && !e.isWebGPU && !e.getCaps().blendParametersPerTarget) throw Error("GeometryBufferRenderer: transparent mesh-blending tags require per-target blend parameters");
				if (this._linkedWithPrePass) throw Error("GeometryBufferRenderer: mesh-blending tag textures are not supported when linked to the PrePassRenderer");
				if (this.samples !== 1) throw Error("GeometryBufferRenderer: mesh-blending tag textures require samples to be 1");
				if (!this._enableMeshBlendTag) {
					let t = Math.min(e.getCaps().maxDrawBuffers ?? 1, 8), n = this._assignRenderTargetIndices()[0] + 1;
					if (e.getCaps().drawBuffersExtension && n > t) throw Error(`GeometryBufferRenderer: ${n} color attachments were requested, but this engine supports at most ${t}`);
				}
			}
			this._enableMeshBlendTag = e, e || (this._meshBlendTagIndex = -1), this._linkedWithPrePass || (this.dispose(), this._createRenderTargets());
		}
	}
	get scene() {
		return this._scene;
	}
	get ratio() {
		return typeof this._ratioOrDimensions == "object" ? 1 : this._ratioOrDimensions;
	}
	get shaderLanguage() {
		return this._shaderLanguage;
	}
	constructor(t, n = 1, r = 15, i) {
		this._previousTransformationMatrices = {}, this._previousBonesTransformationMatrices = {}, this.excludedSkinnedMeshesFromVelocity = [], this._renderTransparentMeshes = !0, this.generateNormalsInWorldSpace = !1, this._normalsAreUnsigned = !1, this._resizeObserver = null, this._enableDepth = !0, this._enableNormal = !0, this._enablePosition = !1, this._enableVelocity = !1, this._enableVelocityLinear = !1, this._enableReflectivity = !1, this._enableScreenspaceDepth = !1, this._enableIrradiance = !1, this._enableObjectId = !1, this._enableMeshBlendTag = !1, this._clearColor = new u(0, 0, 0, 0), this._clearDepthColor = new u(0, 0, 0, 1), this._positionIndex = -1, this._velocityIndex = -1, this._velocityLinearIndex = -1, this._reflectivityIndex = -1, this._depthIndex = -1, this._normalIndex = -1, this._screenspaceDepthIndex = -1, this._irradianceIndex = -1, this._objectIdIndex = -1, this._meshBlendTagIndex = -1, this._linkedWithPrePass = !1, this.generateIrradianceWithScatterMask = !1, this.useSpecificClearForDepthTexture = !1, this._shaderLanguage = 0, this._shadersLoaded = !1, this._scene = t, this._ratioOrDimensions = n, this._useUbo = t.getEngine().supportsUniformBuffers, this._depthFormat = r, this._textureTypesAndFormats = i || {}, this._initShaderSourceAsync(), B(e), e._SceneComponentInitialization(this._scene), this._createRenderTargets();
	}
	async _initShaderSourceAsync() {
		this._scene.getEngine().isWebGPU && !e.ForceGLSL ? (this._shaderLanguage = 1, await Promise.all([import("./geometry.vertex-xEPlxj82.js"), import("./geometry.fragment-C_jgem5M.js")])) : await Promise.all([import("./geometry.vertex-CpG3kKkG.js"), import("./geometry.fragment-KwT2VXvs.js")]), this._shadersLoaded = !0;
	}
	isReady(e, t) {
		if (!this._shadersLoaded) return !1;
		let n = e.getMaterial();
		if (n && n.disableDepthWrite || I(e.getMesh())) return !1;
		let r = [], i = [a.PositionKind], o = e.getMesh();
		o.isVerticesDataPresent(a.NormalKind) && (r.push("#define HAS_NORMAL_ATTRIBUTE"), i.push(a.NormalKind));
		let s = !1, c = !1;
		if (n) {
			let e = !1;
			if (n.needAlphaTestingForMesh(o) && n.getAlphaTestTexture() && (r.push("#define ALPHATEST"), r.push(`#define ALPHATEST_UV${n.getAlphaTestTexture().coordinatesIndex + 1}`), e = !0), (n.bumpTexture || n.normalTexture || n.geometryNormalTexture) && T.BumpTextureEnabled) {
				let t = n.bumpTexture || n.normalTexture || n.geometryNormalTexture;
				r.push("#define BUMP"), r.push(`#define BUMP_UV${t.coordinatesIndex + 1}`), e = !0;
			}
			if (this._enableReflectivity) {
				let t = !1;
				if (n.getClassName() === "PBRMetallicRoughnessMaterial") n.metallicRoughnessTexture && (r.push("#define ORMTEXTURE"), r.push(`#define REFLECTIVITY_UV${n.metallicRoughnessTexture.coordinatesIndex + 1}`), r.push("#define METALLICWORKFLOW"), e = !0, t = !0), n.metallic != null && (r.push("#define METALLIC"), r.push("#define METALLICWORKFLOW"), t = !0), n.roughness != null && (r.push("#define ROUGHNESS"), r.push("#define METALLICWORKFLOW"), t = !0), t && (n.baseTexture && (r.push("#define ALBEDOTEXTURE"), r.push(`#define ALBEDO_UV${n.baseTexture.coordinatesIndex + 1}`), n.baseTexture.gammaSpace && r.push("#define GAMMAALBEDO"), e = !0), n.baseColor && r.push("#define ALBEDOCOLOR"));
				else if (n.getClassName() === "PBRSpecularGlossinessMaterial") n.specularGlossinessTexture ? (r.push("#define SPECULARGLOSSINESSTEXTURE"), r.push(`#define REFLECTIVITY_UV${n.specularGlossinessTexture.coordinatesIndex + 1}`), e = !0, n.specularGlossinessTexture.gammaSpace && r.push("#define GAMMAREFLECTIVITYTEXTURE")) : n.specularColor && r.push("#define REFLECTIVITYCOLOR"), n.glossiness != null && r.push("#define GLOSSINESS");
				else if (n.getClassName() === "PBRMaterial") n.metallicTexture && (r.push("#define ORMTEXTURE"), r.push(`#define REFLECTIVITY_UV${n.metallicTexture.coordinatesIndex + 1}`), r.push("#define METALLICWORKFLOW"), e = !0, t = !0), n.metallic != null && (r.push("#define METALLIC"), r.push("#define METALLICWORKFLOW"), t = !0), n.roughness != null && (r.push("#define ROUGHNESS"), r.push("#define METALLICWORKFLOW"), t = !0), t ? (n.albedoTexture && (r.push("#define ALBEDOTEXTURE"), r.push(`#define ALBEDO_UV${n.albedoTexture.coordinatesIndex + 1}`), n.albedoTexture.gammaSpace && r.push("#define GAMMAALBEDO"), e = !0), n.albedoColor && r.push("#define ALBEDOCOLOR")) : (n.reflectivityTexture ? (r.push("#define SPECULARGLOSSINESSTEXTURE"), r.push(`#define REFLECTIVITY_UV${n.reflectivityTexture.coordinatesIndex + 1}`), n.reflectivityTexture.gammaSpace && r.push("#define GAMMAREFLECTIVITYTEXTURE"), e = !0) : n.reflectivityColor && r.push("#define REFLECTIVITYCOLOR"), n.microSurface != null && r.push("#define GLOSSINESS"));
				else if (n.getClassName() === "StandardMaterial") n.specularTexture && (r.push("#define REFLECTIVITYTEXTURE"), r.push(`#define REFLECTIVITY_UV${n.specularTexture.coordinatesIndex + 1}`), n.specularTexture.gammaSpace && r.push("#define GAMMAREFLECTIVITYTEXTURE"), e = !0), n.specularColor && r.push("#define REFLECTIVITYCOLOR");
				else if (n.getClassName() === "OpenPBRMaterial") {
					let t = n;
					r.push("#define METALLIC"), r.push("#define ROUGHNESS"), t._useRoughnessFromMetallicTextureGreen && t.baseMetalnessTexture ? (r.push("#define ORMTEXTURE"), r.push(`#define REFLECTIVITY_UV${t.baseMetalnessTexture.coordinatesIndex + 1}`), e = !0) : t.baseMetalnessTexture ? (r.push("#define METALLIC_TEXTURE"), r.push(`#define METALLIC_UV${t.baseMetalnessTexture.coordinatesIndex + 1}`), e = !0) : t.specularRoughnessTexture && (r.push("#define ROUGHNESS_TEXTURE"), r.push(`#define ROUGHNESS_UV${t.specularRoughnessTexture.coordinatesIndex + 1}`), e = !0), t.baseColorTexture && (r.push("#define ALBEDOTEXTURE"), r.push(`#define ALBEDO_UV${t.baseColorTexture.coordinatesIndex + 1}`), t.baseColorTexture.gammaSpace && r.push("#define GAMMAALBEDO"), e = !0), t.baseColor && r.push("#define ALBEDOCOLOR");
				}
			}
			if (this._enableIrradiance && this.generateIrradianceWithScatterMask && (r.push("#define IRRADIANCE_SCATTER_MASK"), n.getClassName() === "OpenPBRMaterial")) {
				let t = n;
				t.subsurfaceWeight > 0 && t.subsurfaceWeightTexture && (r.push("#define SUBSURFACE_WEIGHT"), r.push(`#define SUBSURFACEWEIGHT_UV${t.subsurfaceWeightTexture.coordinatesIndex + 1}`), e = !0), t.transmissionWeight > 0 && t.transmissionWeightTexture && (r.push("#define TRANSMISSION_WEIGHT"), r.push(`#define TRANSMISSIONWEIGHT_UV${t.transmissionWeightTexture.coordinatesIndex + 1}`), e = !0);
			}
			e && (r.push("#define NEED_UV"), o.isVerticesDataPresent(a.UVKind) && (i.push(a.UVKind), r.push("#define UV1"), s = !0), o.isVerticesDataPresent(a.UV2Kind) && (i.push(a.UV2Kind), r.push("#define UV2"), c = !0));
		}
		if (this._enableDepth && (r.push("#define DEPTH"), r.push("#define DEPTH_INDEX " + this._depthIndex)), this._enableNormal && (r.push("#define NORMAL"), r.push("#define NORMAL_INDEX " + this._normalIndex)), this._enablePosition && (r.push("#define POSITION"), r.push("#define POSITION_INDEX " + this._positionIndex)), this._enableVelocity && (r.push("#define VELOCITY"), r.push("#define VELOCITY_INDEX " + this._velocityIndex), this.excludedSkinnedMeshesFromVelocity.indexOf(o) === -1 && r.push("#define BONES_VELOCITY_ENABLED")), this._enableVelocityLinear && (r.push("#define VELOCITY_LINEAR"), r.push("#define VELOCITY_LINEAR_INDEX " + this._velocityLinearIndex), this.excludedSkinnedMeshesFromVelocity.indexOf(o) === -1 && r.push("#define BONES_VELOCITY_ENABLED")), this._enableReflectivity && (r.push("#define REFLECTIVITY"), r.push("#define REFLECTIVITY_INDEX " + this._reflectivityIndex)), this._enableScreenspaceDepth && this._screenspaceDepthIndex !== -1 && (r.push("#define SCREENSPACE_DEPTH_INDEX " + this._screenspaceDepthIndex), r.push("#define SCREENSPACE_DEPTH")), this._enableIrradiance && this._irradianceIndex !== -1) {
			r.push("#define IRRADIANCE_INDEX " + this._irradianceIndex), r.push("#define IRRADIANCE");
			let e = this._scene;
			if (e.environmentTexture) {
				let t = {}, i = !1, a = 0;
				(n.getClassName() === "OpenPBRMaterial" || n.getClassName() === "StandardMaterial" || n.getClassName() === "PBRMetallicRoughnessMaterial" || n.getClassName() === "PBRSpecularGlossinessMaterial" || n.getClassName() === "PBRMaterial") && (i = !!n.realtimeFiltering, a = n.realtimeFilteringQuality || 0), fe(e, e.environmentTexture, t, i, a, !0);
				for (let e in t) t[e] && r.push("#define " + e);
				t.USEIRRADIANCEMAP || r.push("#define SPHERICAL_HARMONICS");
				let o = e.postProcessRenderPipelineManager.supportedPipelines.find((e) => e.getClassName() === "IBLShadowsRenderPipeline");
				if (o) {
					let e = o;
					e._getAccumulatedTexture() && (r.push("#define IBL_SHADOW_TEXTURE"), e.coloredShadows && r.push("#define COLORED_IBL_SHADOWS"));
				}
			}
		}
		this._enableObjectId && (r.push("#define OBJECT_ID"), r.push("#define OBJECT_ID_INDEX " + this._objectIdIndex)), this._enableMeshBlendTag && (r.push("#define MESH_BLEND_TAG"), r.push("#define MESH_BLEND_TAG_INDEX " + this._meshBlendTagIndex)), this.generateNormalsInWorldSpace && r.push("#define NORMAL_WORLDSPACE"), this._normalsAreUnsigned && r.push("#define ENCODE_NORMAL"), o.useBones && o.computeBonesUsingShaders && o.skeleton ? (i.push(a.MatricesIndicesKind), i.push(a.MatricesWeightsKind), o.numBoneInfluencers > 4 && (i.push(a.MatricesIndicesExtraKind), i.push(a.MatricesWeightsExtraKind)), r.push("#define NUM_BONE_INFLUENCERS " + o.numBoneInfluencers), r.push("#define BONETEXTURE " + o.skeleton.isUsingTextureForMatrices), r.push("#define BonesPerMesh " + (o.skeleton.bones.length + 1))) : (r.push("#define NUM_BONE_INFLUENCERS 0"), r.push("#define BONETEXTURE false"), r.push("#define BonesPerMesh 0"));
		let l = o.morphTargetManager ? w(o.morphTargetManager, r, i, o, !0, !0, !1, s, c, !1) : 0;
		t && (r.push("#define INSTANCES"), S(i, this._enableVelocity || this._enableVelocityLinear), e.getRenderingMesh().hasThinInstances && r.push("#define THIN_INSTANCES")), this._linkedWithPrePass ? r.push("#define SCENE_MRT_COUNT " + this._attachmentsFromPrePass.length) : r.push("#define SCENE_MRT_COUNT " + this._multiRenderTarget.textures.length), C(n, this._scene, r);
		let u = this._scene.getEngine(), d = e._getDrawWrapper(void 0, !0), f = d.defines, p = r.join("\n");
		return f !== p && d.setEffect(u.createEffect("geometry", {
			attributes: i,
			uniformsNames: W,
			samplers: U,
			defines: p,
			onCompiled: null,
			fallbacks: null,
			onError: null,
			uniformBuffersNames: ["Scene"],
			indexParameters: {
				buffersCount: this._multiRenderTarget.textures.length - 1,
				maxSimultaneousMorphTargets: l
			},
			shaderLanguage: this.shaderLanguage
		}, u), p), d.effect.isReady();
	}
	getGBuffer() {
		return this._multiRenderTarget;
	}
	get samples() {
		return this._multiRenderTarget.samples;
	}
	set samples(e) {
		if (this._enableObjectId && e !== 1) throw Error("GeometryBufferRenderer: object ID textures currently require samples to be 1");
		if (this._enableMeshBlendTag && e !== 1) throw Error("GeometryBufferRenderer: mesh-blending tag textures require samples to be 1");
		this._multiRenderTarget.samples = e;
	}
	dispose() {
		this._scene._setPreviousWorldMatricesRequired(this, !1), this._resizeObserver &&= (this._scene.getEngine().onResizeObservable.remove(this._resizeObserver), null), this._multiRenderTarget?.renderTarget && this.scene.getEngine()._currentRenderTarget === this._multiRenderTarget.renderTarget && this.scene.getEngine().unBindFramebuffer(this._multiRenderTarget?.renderTarget), this.getGBuffer().dispose();
	}
	_assignRenderTargetIndices() {
		let t = [], n = [], r = 0;
		return this._enableDepth && (this._depthIndex = r, r++, t.push("gBuffer_Depth"), n.push(this._textureTypesAndFormats[e.DEPTH_TEXTURE_TYPE])), this._enableNormal && (this._normalIndex = r, r++, t.push("gBuffer_Normal"), n.push(this._textureTypesAndFormats[e.NORMAL_TEXTURE_TYPE])), this._enablePosition && (this._positionIndex = r, r++, t.push("gBuffer_Position"), n.push(this._textureTypesAndFormats[e.POSITION_TEXTURE_TYPE])), this._enableVelocity && (this._velocityIndex = r, r++, t.push("gBuffer_Velocity"), n.push(this._textureTypesAndFormats[e.VELOCITY_TEXTURE_TYPE])), this._enableVelocityLinear && (this._velocityLinearIndex = r, r++, t.push("gBuffer_VelocityLinear"), n.push(this._textureTypesAndFormats[e.VELOCITY_LINEAR_TEXTURE_TYPE])), this._enableReflectivity && (this._reflectivityIndex = r, r++, t.push("gBuffer_Reflectivity"), n.push(this._textureTypesAndFormats[e.REFLECTIVITY_TEXTURE_TYPE])), this._enableScreenspaceDepth && (this._screenspaceDepthIndex = r, r++, t.push("gBuffer_ScreenspaceDepth"), n.push(this._textureTypesAndFormats[e.SCREENSPACE_DEPTH_TEXTURE_TYPE])), this._enableIrradiance && (this._irradianceIndex = r, r++, t.push("gBuffer_Irradiance"), n.push(this._textureTypesAndFormats[e.IRRADIANCE_TEXTURE_TYPE])), this._enableObjectId && (this._objectIdIndex = r, r++, t.push("gBuffer_ObjectId"), n.push({
			textureType: 0,
			textureFormat: 5,
			samplingMode: 1
		})), this._enableMeshBlendTag && (this._meshBlendTagIndex = r, r++, t.push("gBuffer_MeshBlendTag"), n.push({
			textureType: 0,
			textureFormat: 8,
			samplingMode: 1
		})), [
			r,
			t,
			n
		];
	}
	_createRenderTargets() {
		let t = this._scene.getEngine(), [n, r, i] = this._assignRenderTargetIndices(), a = Math.min(t.getCaps().maxDrawBuffers ?? 1, 8);
		if (t.getCaps().drawBuffersExtension && n > a) throw Error(`GeometryBufferRenderer: ${n} color attachments were requested, but this engine supports at most ${a}`);
		let s = 0;
		t._caps.textureFloat && t._caps.textureFloatLinearFiltering ? s = 1 : t._caps.textureHalfFloat && t._caps.textureHalfFloatLinearFiltering && (s = 2);
		let c = this._getRenderTargetDimensions(), l = [], u = [], d = [];
		for (let e of i) e ? (l.push(e.textureType), u.push(e.textureFormat), d.push(e.samplingMode ?? 2)) : (l.push(s), u.push(5), d.push(2));
		if (this._normalsAreUnsigned = l[e.NORMAL_TEXTURE_TYPE] === 11 || l[e.NORMAL_TEXTURE_TYPE] === 13, this._multiRenderTarget = new P("gBuffer", c, n, this._scene, {
			generateMipMaps: !1,
			generateDepthTexture: !0,
			types: l,
			formats: u,
			samplingModes: d,
			depthTextureFormat: this._depthFormat
		}, r.concat("gBuffer_DepthBuffer")), !this.isSupported) return;
		this._scene._setPreviousWorldMatricesRequired(this, !this._linkedWithPrePass && (this._enableVelocity || this._enableVelocityLinear)), this._multiRenderTarget.wrapU = je.CLAMP_ADDRESSMODE, this._multiRenderTarget.wrapV = je.CLAMP_ADDRESSMODE, this._multiRenderTarget.refreshRate = 1, this._multiRenderTarget.renderParticles = !1, this._multiRenderTarget.renderList = null;
		let f = [!0], p = [!1], m = [!0];
		for (let e = 1; e < n; ++e) f.push(!0), m.push(!1), p.push(!0);
		let h = t.buildTextureLayout(f), g = t.buildTextureLayout(p), _ = t.buildTextureLayout(m);
		this._multiRenderTarget.onClearObservable.add((e) => {
			let t = this.useSpecificClearForDepthTexture ? g : h;
			e.clearAttachments(this._clearColor, t, !0, !0, !0), this.useSpecificClearForDepthTexture && e.clearAttachments(this._clearDepthColor, _, !0, !1, !1), e.bindAttachments(h);
		}), this._resizeObserver = t.onResizeObservable.add(() => {
			this._multiRenderTarget && this._multiRenderTarget.resize(this._getRenderTargetDimensions());
		});
		let v = (e) => {
			let t = e.getRenderingMesh(), n = e.getEffectiveMesh(), r = this._scene, i = r.getEngine(), a = e.getMaterial();
			if (!a) return;
			if (n._internalAbstractMeshDataInfo._isActiveIntermediate = !1, (this._enableVelocity || this._enableVelocityLinear) && !this._previousTransformationMatrices[n.uniqueId] && (this._previousTransformationMatrices[n.uniqueId] = {
				world: o.Identity(),
				viewProjection: r.getTransformMatrix()
			}, t.skeleton)) {
				let e = t.skeleton.getTransformMatrices(t);
				this._previousBonesTransformationMatrices[t.uniqueId] = this._copyBonesTransformationMatrices(e, new Float32Array(e.length));
			}
			let s = t._getInstancesRenderList(e._id, !!e.getReplacementMesh());
			if (s.mustReturn) return;
			let c = i.getCaps().instancedArrays && (s.visibleInstances[e._id] !== null || t.hasThinInstances), l = n.getWorldMatrix();
			if (this.isReady(e, c)) {
				let o = e._getDrawWrapper();
				if (!o) return;
				let u = o.effect;
				i.enableEffect(o), c || t._bind(e, u, a.fillMode), this._useUbo ? (D(u, this._scene.getSceneUniformBuffer()), this._scene.finalizeSceneUbo()) : (u.setMatrix("viewProjection", r.getTransformMatrix()), u.setMatrix("view", r.getViewMatrix()), this._scene.bindEyePosition(u, "vEyePosition"));
				let d;
				if (!t._instanceDataStorage.isFrozen && (a.backFaceCulling || a.sideOrientation !== null)) {
					let e = n._getWorldMatrixDeterminant();
					d = a._getEffectiveOrientation(t), e < 0 && (d = d === E.ClockWiseSideOrientation ? E.CounterClockWiseSideOrientation : E.ClockWiseSideOrientation);
				} else d = t._effectiveSideOrientation;
				if (a._preBind(o, d), a.needAlphaTestingForMesh(n)) {
					let e = a.getAlphaTestTexture();
					e && (u.setTexture("diffuseSampler", e), u.setMatrix("diffuseMatrix", e.getTextureMatrix()), u.setFloat("alphaCutOff", a.alphaCutOff ?? .4));
				}
				if ((a.bumpTexture || a.normalTexture || a.geometryNormalTexture) && r.getEngine().getCaps().standardDerivatives && T.BumpTextureEnabled) {
					let e = a.bumpTexture || a.normalTexture || a.geometryNormalTexture;
					u.setFloat3("vBumpInfos", e.coordinatesIndex, 1 / e.level, a.parallaxScaleBias), u.setMatrix("bumpMatrix", e.getTextureMatrix()), u.setTexture("bumpSampler", e), u.setFloat2("vTangentSpaceParams", a.invertNormalMapX ? -1 : 1, a.invertNormalMapY ? -1 : 1);
				}
				if (this._enableReflectivity) {
					if (a.getClassName() === "PBRMetallicRoughnessMaterial") a.metallicRoughnessTexture !== null && (u.setTexture("reflectivitySampler", a.metallicRoughnessTexture), u.setMatrix("reflectivityMatrix", a.metallicRoughnessTexture.getTextureMatrix())), a.metallic !== null && u.setFloat("metallic", a.metallic), a.roughness !== null && u.setFloat("glossiness", 1 - a.roughness), a.baseTexture !== null && (u.setTexture("albedoSampler", a.baseTexture), u.setMatrix("albedoMatrix", a.baseTexture.getTextureMatrix())), a.baseColor !== null && u.setColor3("albedoColor", a.baseColor);
					else if (a.getClassName() === "PBRSpecularGlossinessMaterial") a.specularGlossinessTexture === null ? a.specularColor !== null && u.setColor3("reflectivityColor", a.specularColor) : (u.setTexture("reflectivitySampler", a.specularGlossinessTexture), u.setMatrix("reflectivityMatrix", a.specularGlossinessTexture.getTextureMatrix())), a.glossiness !== null && u.setFloat("glossiness", a.glossiness);
					else if (a.getClassName() === "PBRMaterial") a.metallicTexture !== null && (u.setTexture("reflectivitySampler", a.metallicTexture), u.setMatrix("reflectivityMatrix", a.metallicTexture.getTextureMatrix())), a.metallic !== null && u.setFloat("metallic", a.metallic), a.roughness !== null && u.setFloat("glossiness", 1 - a.roughness), a.roughness !== null || a.metallic !== null || a.metallicTexture !== null ? (a.albedoTexture !== null && (u.setTexture("albedoSampler", a.albedoTexture), u.setMatrix("albedoMatrix", a.albedoTexture.getTextureMatrix())), a.albedoColor !== null && u.setColor3("albedoColor", a.albedoColor)) : (a.reflectivityTexture === null ? a.reflectivityColor !== null && u.setColor3("reflectivityColor", a.reflectivityColor) : (u.setTexture("reflectivitySampler", a.reflectivityTexture), u.setMatrix("reflectivityMatrix", a.reflectivityTexture.getTextureMatrix())), a.microSurface !== null && u.setFloat("glossiness", a.microSurface));
					else if (a.getClassName() === "StandardMaterial") a.specularTexture !== null && (u.setTexture("reflectivitySampler", a.specularTexture), u.setMatrix("reflectivityMatrix", a.specularTexture.getTextureMatrix())), a.specularColor !== null && u.setColor3("reflectivityColor", a.specularColor);
					else if (a.getClassName() === "OpenPBRMaterial") {
						let e = a;
						e._useRoughnessFromMetallicTextureGreen && e.baseMetalnessTexture ? (u.setTexture("reflectivitySampler", e.baseMetalnessTexture), u.setMatrix("reflectivityMatrix", e.baseMetalnessTexture.getTextureMatrix())) : e.baseMetalnessTexture ? (u.setTexture("metallicSampler", e.baseMetalnessTexture), u.setMatrix("metallicMatrix", e.baseMetalnessTexture.getTextureMatrix())) : e.specularRoughnessTexture && (u.setTexture("roughnessSampler", e.specularRoughnessTexture), u.setMatrix("roughnessMatrix", e.specularRoughnessTexture.getTextureMatrix())), u.setFloat("metallic", e.baseMetalness), u.setFloat("glossiness", 1 - e.specularRoughness), e.baseColorTexture !== null && (u.setTexture("albedoSampler", e.baseColorTexture), u.setMatrix("albedoMatrix", e.baseColorTexture.getTextureMatrix())), e.baseColor !== null && u.setColor3("albedoColor", e.baseColor);
					}
				}
				if (this._enableIrradiance && r.environmentTexture) {
					let e = r.environmentTexture, t = r.postProcessRenderPipelineManager.supportedPipelines.find((e) => e.getClassName() === "IBLShadowsRenderPipeline");
					if (t) {
						let e = t._getAccumulatedTexture();
						e && (u.setTexture("iblShadowSampler", e), u.setFloat2("shadowTextureSize", e.getSize().width, e.getSize().height));
					}
					if (u.setMatrix("reflectionMatrix", e.getReflectionTextureMatrix()), u.setFloat2("vReflectionInfos", e.level * r.iblIntensity, 0), u.setTexture("reflectionSampler", e), e.irradianceTexture && (u.setTexture("irradianceSampler", e.irradianceTexture), e.irradianceTexture._dominantDirection && u.setVector3("vReflectionDominantDirection", e.irradianceTexture._dominantDirection)), e.sphericalPolynomial) {
						let t = e.sphericalPolynomial;
						if (t.preScaledHarmonics) {
							let e = t.preScaledHarmonics;
							u.setVector3("vSphericalL00", e.l00), u.setVector3("vSphericalL1_1", e.l1_1), u.setVector3("vSphericalL10", e.l10), u.setVector3("vSphericalL11", e.l11), u.setVector3("vSphericalL2_2", e.l2_2), u.setVector3("vSphericalL2_1", e.l2_1), u.setVector3("vSphericalL20", e.l20), u.setVector3("vSphericalL21", e.l21), u.setVector3("vSphericalL22", e.l22);
						} else u.setFloat3("vSphericalX", t.x.x, t.x.y, t.x.z), u.setFloat3("vSphericalY", t.y.x, t.y.y, t.y.z), u.setFloat3("vSphericalZ", t.z.x, t.z.y, t.z.z), u.setFloat3("vSphericalXX_ZZ", t.xx.x - t.zz.x, t.xx.y - t.zz.y, t.xx.z - t.zz.z), u.setFloat3("vSphericalYY_ZZ", t.yy.x - t.zz.x, t.yy.y - t.zz.y, t.yy.z - t.zz.z), u.setFloat3("vSphericalZZ", t.zz.x, t.zz.y, t.zz.z), u.setFloat3("vSphericalXY", t.xy.x, t.xy.y, t.xy.z), u.setFloat3("vSphericalYZ", t.yz.x, t.yz.y, t.yz.z), u.setFloat3("vSphericalZX", t.zx.x, t.zx.y, t.zx.z);
					}
					if (this.generateIrradianceWithScatterMask && a.getClassName() === "OpenPBRMaterial") {
						let e = a;
						u.setFloat("vSubsurfaceWeight", e.subsurfaceWeight), e.subsurfaceWeightTexture && (u.setTexture("subsurfaceWeightSampler", e.subsurfaceWeightTexture), u.setMatrix("subsurfaceWeightMatrix", e.subsurfaceWeightTexture.getTextureMatrix())), u.setFloat("vTransmissionWeight", e.transmissionWeight), e.transmissionWeightTexture && (u.setTexture("transmissionWeightSampler", e.transmissionWeightTexture), u.setMatrix("transmissionWeightMatrix", e.transmissionWeightTexture.getTextureMatrix())), u.setFloat("vTransmissionScatterAnisotropy", e.transmissionScatterAnisotropy), u.setFloat("vSubsurfaceScatterAnisotropy", e.subsurfaceScatterAnisotropy);
					}
				}
				if (se(u, a, this._scene), t.useBones && t.computeBonesUsingShaders && t.skeleton) {
					let e = t.skeleton;
					if (e.isUsingTextureForMatrices && u.getUniformIndex("boneTextureInfo") > -1) {
						let n = e.getTransformMatrixTexture(t);
						u.setTexture("boneSampler", n), u.setFloat2("boneTextureInfo", e._textureWidth, e._textureHeight);
					} else u.setMatrices("mBones", t.skeleton.getTransformMatrices(t));
					(this._enableVelocity || this._enableVelocityLinear) && u.setMatrices("mPreviousBones", this._previousBonesTransformationMatrices[t.uniqueId]);
				}
				if (be(t, u), t.morphTargetManager && t.morphTargetManager.isUsingTextureForTargets && t.morphTargetManager._bind(u), (this._enableVelocity || this._enableVelocityLinear) && (u.setMatrix("previousWorld", this._previousTransformationMatrices[n.uniqueId].world), u.setMatrix("previousViewProjection", this._previousTransformationMatrices[n.uniqueId].viewProjection)), this._enableObjectId) {
					let e = t.uniqueId;
					if (this.objectIdProvider) e = O(t, this.objectIdProvider);
					else if (e > 16777215) throw Error(`Invalid geometry object ID ${e} for mesh "${t.name}". Object IDs must be integers between 0 and 0xFFFFFF.`);
					u.setFloat("objectId", e);
				}
				if (this._enableMeshBlendTag) {
					let e = this.meshBlendTagProvider ? A(t, this.meshBlendTagProvider) : t.meshBlendingTag;
					u.setInt("meshBlendTag", e);
				}
				c && t.hasThinInstances && u.setMatrix("world", l), t._processRendering(n, e, u, a.fillMode, s, c, (e, t) => {
					e || u.setMatrix("world", t);
				});
			}
			(this._enableVelocity || this._enableVelocityLinear) && (this._previousTransformationMatrices[n.uniqueId].world = l.clone(), this._previousTransformationMatrices[n.uniqueId].viewProjection = this._scene.getTransformMatrix().clone(), t.skeleton && this._copyBonesTransformationMatrices(t.skeleton.getTransformMatrices(t), this._previousBonesTransformationMatrices[n.uniqueId]));
		};
		this._multiRenderTarget.customIsReadyFunction = (e, n, r) => {
			if ((r || n === 0) && e.subMeshes) for (let n = 0; n < e.subMeshes.length; ++n) {
				let r = e.subMeshes[n], i = r.getMaterial(), a = r.getRenderingMesh();
				if (!i) continue;
				let o = a._getInstancesRenderList(r._id, !!r.getReplacementMesh()), s = t.getCaps().instancedArrays && (o.visibleInstances[r._id] !== null || a.hasThinInstances);
				if (!this.isReady(r, s)) return !1;
			}
			return !0;
		}, this._multiRenderTarget.customRenderFunction = (e, n, r, i) => {
			let a;
			if (this._linkedWithPrePass) {
				if (!this._prePassRenderer.enabled) return;
				this._scene.getEngine().bindAttachments(this._attachmentsFromPrePass);
			}
			if (i.length) {
				for (t.setColorWrite(!1), a = 0; a < i.length; a++) v(i.data[a]);
				t.setColorWrite(!0);
			}
			for (a = 0; a < e.length; a++) v(e.data[a]);
			for (t.setDepthWrite(!1), a = 0; a < n.length; a++) v(n.data[a]);
			if (this.renderTransparentMeshes) for (a = 0; a < r.length; a++) v(r.data[a]);
			t.setDepthWrite(!0);
		};
	}
	_getRenderTargetDimensions() {
		if (typeof this._ratioOrDimensions == "object") return {
			width: Math.max(1, Math.floor(this._ratioOrDimensions.width)),
			height: Math.max(1, Math.floor(this._ratioOrDimensions.height))
		};
		let e = this._scene.getEngine();
		return {
			width: Math.max(1, Math.floor(e.getRenderWidth() * this._ratioOrDimensions)),
			height: Math.max(1, Math.floor(e.getRenderHeight() * this._ratioOrDimensions))
		};
	}
	_copyBonesTransformationMatrices(e, t) {
		for (let n = 0; n < e.length; n++) t[n] = e[n];
		return t;
	}
};
G.ForceGLSL = !1, G.DEPTH_TEXTURE_TYPE = 0, G.NORMAL_TEXTURE_TYPE = 1, G.POSITION_TEXTURE_TYPE = 2, G.VELOCITY_TEXTURE_TYPE = 3, G.REFLECTIVITY_TEXTURE_TYPE = 4, G.SCREENSPACE_DEPTH_TEXTURE_TYPE = 5, G.VELOCITY_LINEAR_TEXTURE_TYPE = 6, G.IRRADIANCE_TEXTURE_TYPE = 7, G.OBJECT_ID_TEXTURE_TYPE = 8, G.MESH_BLEND_TAG_TEXTURE_TYPE = 9, G._SceneComponentInitialization = (e) => {
	throw t("GeometryBufferRendererSceneComponent");
};
//#endregion
//#region node_modules/@babylonjs/core/Materials/PBR/openpbrMaterial.pure.js
var K = {
	effect: null,
	subMesh: null
};
function q(e) {
	if (typeof e == "number") return 1;
	if (e instanceof l) return 2;
	if (e instanceof f || e instanceof d) return 3;
	if (e instanceof c || e instanceof u) return 4;
	throw Error("Unsupported OpenPBR property type.");
}
var He = class t {
	populateVectorFromLinkedProperties(n) {
		let r = q(n);
		for (let n in this.linkedProperties) {
			let i = this.linkedProperties[n], a = i.numComponents;
			if (r < a || i.targetUniformComponentOffset > r - a) {
				a == 1 ? e.Error(`Float property ${i.name} has an offset that is too large.`) : e.Error(`Vector${a} property ${i.name} won't fit in Vector${r} or has an offset that is too large.`);
				return;
			}
			typeof i.value == "number" ? t._tmpArray[i.targetUniformComponentOffset] = i.value : i.value.toArray(t._tmpArray, i.targetUniformComponentOffset);
		}
		n.fromArray(t._tmpArray);
	}
	constructor(e, t) {
		this.linkedProperties = {}, this.firstLinkedKey = "", this.name = e, this.numComponents = t;
	}
};
He._tmpArray = [
	0,
	0,
	0,
	0
];
var J = class {
	constructor(e, t, n, r, i = 0, a) {
		this.targetUniformComponentNum = 4, this.targetUniformComponentOffset = 0, this.name = e, this.targetUniformName = n, this.defaultValue = t, this.value = t, this.targetUniformComponentNum = r, this.targetUniformComponentOffset = i, this.requiredDefine = a;
	}
	get numComponents() {
		return typeof this.defaultValue == "number" ? 1 : q(this.defaultValue);
	}
}, Y = class {
	get samplerName() {
		return this.samplerPrefix + "Sampler";
	}
	get samplerInfoName() {
		return "v" + this.samplerPrefix.charAt(0).toUpperCase() + this.samplerPrefix.slice(1) + "Infos";
	}
	get samplerMatrixName() {
		return this.samplerPrefix + "Matrix";
	}
	constructor(e, t, n) {
		this.value = null, this.samplerPrefix = "", this.textureDefine = "", this.name = e, this.samplerPrefix = t, this.textureDefine = n;
	}
}, X = class extends k(j(N)) {}, Z = class extends L(X) {}, Ue = class extends Le(Z) {
	constructor(e) {
		super(e), this.NUM_SAMPLES = "0", this.REALTIME_FILTERING = !1, this.IBL_CDF_FILTERING = !1, this.LIGHTCOUNT = 0, this.VERTEXCOLOR = !1, this.BAKED_VERTEX_ANIMATION_TEXTURE = !1, this.VERTEXALPHA = !1, this.ALPHATEST = !1, this.DEPTHPREPASS = !1, this.ALPHABLEND = !1, this.ALPHA_FROM_BASE_COLOR_TEXTURE = !1, this.ALPHATESTVALUE = "0.5", this.PREMULTIPLYALPHA = !1, this.REFLECTIVITY_GAMMA = !1, this.REFLECTIVITYDIRECTUV = 0, this.SPECULARTERM = !1, this.LODBASEDMICROSFURACE = !0, this.SPECULAR_ROUGHNESS_FROM_METALNESS_TEXTURE_GREEN = !1, this.BASE_METALNESS_FROM_METALNESS_TEXTURE_BLUE = !1, this.AOSTOREINMETALMAPRED = !1, this.SPECULAR_WEIGHT_IN_ALPHA = !1, this.SPECULAR_WEIGHT_FROM_SPECULAR_COLOR_TEXTURE = !1, this.SPECULAR_ROUGHNESS_ANISOTROPY_FROM_TANGENT_TEXTURE = !1, this.COAT_ROUGHNESS_FROM_GREEN_CHANNEL = !1, this.COAT_ROUGHNESS_ANISOTROPY_FROM_TANGENT_TEXTURE = !1, this.USE_GLTF_STYLE_ANISOTROPY = !1, this.THIN_FILM_THICKNESS_FROM_THIN_FILM_TEXTURE = !1, this.FUZZ_ROUGHNESS_FROM_TEXTURE_ALPHA = !1, this.SUBSURFACE_WEIGHT_FROM_TEXTURE_ALPHA = !1, this.GEOMETRY_THICKNESS_FROM_GREEN_CHANNEL = !1, this.ENVIRONMENTBRDF = !1, this.ENVIRONMENTBRDF_RGBD = !1, this.FUZZENVIRONMENTBRDF = !1, this.NORMAL = !1, this.TANGENT = !1, this.OBJECTSPACE_NORMALMAP = !1, this.PARALLAX = !1, this.PARALLAX_RHS = !1, this.PARALLAXOCCLUSION = !1, this.NORMALXYSCALE = !0, this.ANISOTROPIC = !1, this.ANISOTROPIC_OPENPBR = !0, this.ANISOTROPIC_BASE = !1, this.ANISOTROPIC_COAT = !1, this.FUZZ_IBL_SAMPLES = 6, this.REFRACTION_HIGH_QUALITY_BLUR = !1, this.FUZZ = !1, this.THIN_FILM = !1, this.IRIDESCENCE = !1, this.DISPERSION = !1, this.SCATTERING = !1, this.USE_IRRADIANCE_TEXTURE_FOR_SCATTERING = !1, this.SSS_SAMPLE_COUNT = 16, this.USE_IRRADIANCE_TEXTURE_FOR_SCATTERING_GBUFFER = !1, this.TRANSMISSION_SLAB = !1, this.TRANSMISSION_SLAB_VOLUME = !1, this.SUBSURFACE_SLAB = !1, this.GEOMETRY_THIN_WALLED = !1, this.REFRACTED_BACKGROUND = !1, this.REFRACTED_LIGHTS = !1, this.REFRACTED_ENVIRONMENT = !1, this.REFRACTED_ENVIRONMENT_OPPOSITEZ = !1, this.REFRACTED_ENVIRONMENT_LOCAL_CUBE = !1, this.RADIANCEOCCLUSION = !1, this.HORIZONOCCLUSION = !1, this.INSTANCES = !1, this.THIN_INSTANCES = !1, this.INSTANCESCOLOR = !1, this.NUM_BONE_INFLUENCERS = 0, this.BonesPerMesh = 0, this.BONETEXTURE = !1, this.BONES_VELOCITY_ENABLED = !1, this.NONUNIFORMSCALING = !1, this.MORPHTARGETS = !1, this.MORPHTARGETS_POSITION = !1, this.MORPHTARGETS_NORMAL = !1, this.MORPHTARGETS_TANGENT = !1, this.MORPHTARGETS_UV = !1, this.MORPHTARGETS_UV2 = !1, this.MORPHTARGETS_COLOR = !1, this.MORPHTARGETTEXTURE_HASPOSITIONS = !1, this.MORPHTARGETTEXTURE_HASNORMALS = !1, this.MORPHTARGETTEXTURE_HASTANGENTS = !1, this.MORPHTARGETTEXTURE_HASUVS = !1, this.MORPHTARGETTEXTURE_HASUV2S = !1, this.MORPHTARGETTEXTURE_HASCOLORS = !1, this.NUM_MORPH_INFLUENCERS = 0, this.MORPHTARGETS_TEXTURE = !1, this.USEPHYSICALLIGHTFALLOFF = !1, this.USEGLTFLIGHTFALLOFF = !1, this.TWOSIDEDLIGHTING = !1, this.MIRRORED = !1, this.SHADOWFLOAT = !1, this.CLIPPLANE = !1, this.CLIPPLANE2 = !1, this.CLIPPLANE3 = !1, this.CLIPPLANE4 = !1, this.CLIPPLANE5 = !1, this.CLIPPLANE6 = !1, this.POINTSIZE = !1, this.FOG = !1, this.LOGARITHMICDEPTH = !1, this.CAMERA_ORTHOGRAPHIC = !1, this.CAMERA_PERSPECTIVE = !1, this.AREALIGHTSUPPORTED = !0, this.FORCENORMALFORWARD = !1, this.SPECULARAA = !1, this.UNLIT = !1, this.DECAL_AFTER_DETAIL = !1, this.TEXTURE_REPETITION_MODE = 0, this.DEBUGMODE = 0, this.USE_VERTEX_PULLING = !1, this.VERTEX_PULLING_USE_INDEX_BUFFER = !1, this.VERTEX_PULLING_INDEX_BUFFER_32BITS = !1, this.RIGHT_HANDED = !1, this.CLUSTLIGHT_SLICES = 0, this.CLUSTLIGHT_BATCH = 0, this.BRDF_V_HEIGHT_CORRELATED = !0, this.MS_BRDF_ENERGY_CONSERVATION = !0, this.SPHERICAL_HARMONICS = !0, this.SPECULAR_GLOSSINESS_ENERGY_CONSERVATION = !0, this.MIX_IBL_RADIANCE_WITH_IRRADIANCE = !0, this.LEGACY_SPECULAR_ENERGY_CONSERVATION = !1, this.BASE_DIFFUSE_MODEL = 0, this.DIELECTRIC_SPECULAR_MODEL = 1, this.CONDUCTOR_SPECULAR_MODEL = 1, this.rebuild();
	}
	reset() {
		super.reset(), this.ALPHATESTVALUE = "0.5", this.NORMALXYSCALE = !0;
	}
}, We = class extends M(Ne) {}, Q = (() => {
	var t, n, i, o, u, f, p, x, S, C, w, D, Ne, Le, O, k, A, j, M, N, P, F, I, L, R, z, B, V, H, U, W, q, X, Z, Q, $, Ge, Ke, qe, Je, Ye, Xe, Ze, Qe, $e, et, tt, nt, rt, it, at, ot, st, ct, lt, ut, dt, ft, pt, mt, ht, gt, _t, vt, yt, bt, xt, St, Ct, wt, Tt, Et, Dt, Ot, kt, At, jt, Mt, Nt, Pt, Ft, It, Lt, Rt, zt, Bt, Vt, Ht, Ut, Wt, Gt, Kt, qt, Jt, Yt, Xt, Zt, Qt, $t, en, tn, nn, rn;
	let an = We, on = [], sn, cn = [], ln = [], un, dn = [], fn = [], pn, mn = [], hn = [], gn, _n = [], vn = [], yn, bn = [], xn = [], Sn, Cn = [], wn = [], Tn, En = [], Dn = [], On, kn = [], An = [], jn, Mn = [], Nn = [], Pn, Fn = [], In = [], Ln, Rn = [], zn = [], Bn, Vn = [], Hn = [], Un, Wn = [], Gn = [], Kn, qn = [], Jn = [], Yn, Xn = [], Zn = [], Qn, $n = [], er = [], tr, nr = [], rr = [], ir, ar = [], or = [], sr, cr = [], lr = [], ur, dr = [], fr = [], pr, mr = [], hr = [], gr, _r = [], vr = [], yr, br = [], xr = [], Sr, Cr = [], wr = [], Tr, Er = [], Dr = [], Or, kr = [], Ar = [], jr, Mr = [], Nr = [], Pr, Fr = [], Ir = [], Lr, Rr = [], zr = [], Br, Vr = [], Hr = [], Ur, Wr = [], Gr = [], Kr, qr = [], Jr = [], Yr, Xr = [], Zr = [], Qr, $r = [], ei = [], ti, ni = [], ri = [], ii, ai = [], oi = [], si, ci = [], li = [], ui, di = [], fi = [], pi, mi = [], hi = [], gi, _i = [], vi = [], yi, bi = [], xi = [], Si, Ci = [], wi = [], Ti, Ei = [], Di = [], Oi, ki = [], Ai = [], ji, Mi = [], Ni = [], Pi, Fi = [], Ii = [], Li, Ri = [], zi = [], Bi, Vi = [], Hi = [], Ui, Wi = [], Gi = [], Ki, qi = [], Ji = [], Yi, Xi = [], Zi = [], Qi, $i = [], ea = [], ta, na = [], ra = [], ia, aa = [], oa = [], sa, ca = [], la = [], ua, da = [], fa = [], pa, ma = [], ha = [], ga, _a = [], va = [], ya, ba = [], xa = [], Sa, Ca = [], wa = [], Ta, Ea = [], Da = [], Oa, ka = [], Aa = [], ja, Ma = [], Na = [], Pa, Fa = [], Ia = [], La, Ra = [], za = [], Ba, Va = [], Ha = [], Ua, Wa = [], Ga = [], Ka, qa = [], Ja = [], Ya, Xa = [], Za = [], Qa, $a = [], eo = [], to, no = [], ro = [], io, ao = [], oo = [], so, co = [], lo = [], uo, fo = [], po = [], mo, ho = [], go = [], _o, vo = [], yo = [], bo, xo = [], So = [], Co, wo = [], To = [], Eo, Do = [], Oo = [], ko, Ao = [], jo = [], Mo, No = [], Po = [], Fo, Io = [], Lo = [], Ro, zo, Bo, Vo = [], Ho = [], Uo, Wo = [], Go = [], Ko, qo = [], Jo = [], Yo, Xo = [], Zo = [], Qo, $o = [], es = [], ts, ns = [], rs = [], is, as = [], os = [], ss, cs = [], ls = [], us, ds = [], fs = [], ps, ms = [], hs = [], gs, _s = [], vs = [], ys, bs = [], xs = [], Ss, Cs = [], ws = [], Ts, Es = [], Ds = [], Os, ks = [], As = [], js, Ms = [], Ns = [], Ps, Fs = [], Is = [], Ls, Rs = [], zs = [], Bs, Vs = [], Hs = [], Us, Ws = [], Gs = [], Ks;
	return t = class extends an {
		get baseWeight() {
			return m(this, n, "f");
		}
		set baseWeight(e) {
			y(this, n, e, "f");
		}
		get baseWeightTexture() {
			return m(this, i, "f");
		}
		set baseWeightTexture(e) {
			y(this, i, e, "f");
		}
		get baseColor() {
			return m(this, o, "f");
		}
		set baseColor(e) {
			y(this, o, e, "f");
		}
		get baseColorTexture() {
			return m(this, u, "f");
		}
		set baseColorTexture(e) {
			y(this, u, e, "f");
		}
		get baseDiffuseRoughness() {
			return m(this, f, "f");
		}
		set baseDiffuseRoughness(e) {
			y(this, f, e, "f");
		}
		get baseDiffuseRoughnessTexture() {
			return m(this, p, "f");
		}
		set baseDiffuseRoughnessTexture(e) {
			y(this, p, e, "f");
		}
		get baseMetalness() {
			return m(this, x, "f");
		}
		set baseMetalness(e) {
			y(this, x, e, "f");
		}
		get baseMetalnessTexture() {
			return m(this, S, "f");
		}
		set baseMetalnessTexture(e) {
			y(this, S, e, "f");
		}
		get specularWeight() {
			return m(this, C, "f");
		}
		set specularWeight(e) {
			y(this, C, e, "f");
		}
		get specularWeightTexture() {
			return m(this, w, "f");
		}
		set specularWeightTexture(e) {
			y(this, w, e, "f");
		}
		get specularColor() {
			return m(this, D, "f");
		}
		set specularColor(e) {
			y(this, D, e, "f");
		}
		get specularColorTexture() {
			return m(this, Ne, "f");
		}
		set specularColorTexture(e) {
			y(this, Ne, e, "f");
		}
		get specularRoughness() {
			return m(this, Le, "f");
		}
		set specularRoughness(e) {
			y(this, Le, e, "f");
		}
		get specularRoughnessTexture() {
			return m(this, O, "f");
		}
		set specularRoughnessTexture(e) {
			y(this, O, e, "f");
		}
		get specularRoughnessAnisotropy() {
			return m(this, k, "f");
		}
		set specularRoughnessAnisotropy(e) {
			y(this, k, e, "f");
		}
		get specularRoughnessAnisotropyTexture() {
			return m(this, A, "f");
		}
		set specularRoughnessAnisotropyTexture(e) {
			y(this, A, e, "f");
		}
		get specularIor() {
			return m(this, j, "f");
		}
		set specularIor(e) {
			y(this, j, e, "f");
		}
		get transmissionWeight() {
			return m(this, M, "f");
		}
		set transmissionWeight(e) {
			y(this, M, e, "f");
		}
		get transmissionWeightTexture() {
			return m(this, N, "f");
		}
		set transmissionWeightTexture(e) {
			y(this, N, e, "f");
		}
		get transmissionColor() {
			return m(this, P, "f");
		}
		set transmissionColor(e) {
			y(this, P, e, "f");
		}
		get transmissionColorTexture() {
			return m(this, F, "f");
		}
		set transmissionColorTexture(e) {
			y(this, F, e, "f");
		}
		get transmissionDepth() {
			return m(this, I, "f");
		}
		set transmissionDepth(e) {
			y(this, I, e, "f");
		}
		get transmissionDepthTexture() {
			return m(this, L, "f");
		}
		set transmissionDepthTexture(e) {
			y(this, L, e, "f");
		}
		get transmissionScatter() {
			return m(this, R, "f");
		}
		set transmissionScatter(e) {
			y(this, R, e, "f");
		}
		get transmissionScatterTexture() {
			return m(this, z, "f");
		}
		set transmissionScatterTexture(e) {
			y(this, z, e, "f");
		}
		get transmissionScatterAnisotropy() {
			return m(this, B, "f");
		}
		set transmissionScatterAnisotropy(e) {
			y(this, B, e, "f");
		}
		get transmissionDispersionScale() {
			return m(this, V, "f");
		}
		set transmissionDispersionScale(e) {
			y(this, V, e, "f");
		}
		get transmissionDispersionScaleTexture() {
			return m(this, H, "f");
		}
		set transmissionDispersionScaleTexture(e) {
			y(this, H, e, "f");
		}
		get transmissionDispersionAbbeNumber() {
			return m(this, U, "f");
		}
		set transmissionDispersionAbbeNumber(e) {
			y(this, U, e, "f");
		}
		get subsurfaceWeight() {
			return m(this, W, "f");
		}
		set subsurfaceWeight(e) {
			y(this, W, e, "f");
		}
		get subsurfaceWeightTexture() {
			return m(this, q, "f");
		}
		set subsurfaceWeightTexture(e) {
			y(this, q, e, "f");
		}
		get subsurfaceColor() {
			return m(this, X, "f");
		}
		set subsurfaceColor(e) {
			y(this, X, e, "f");
		}
		get subsurfaceColorTexture() {
			return m(this, Z, "f");
		}
		set subsurfaceColorTexture(e) {
			y(this, Z, e, "f");
		}
		get subsurfaceRadius() {
			return m(this, Q, "f");
		}
		set subsurfaceRadius(e) {
			y(this, Q, e, "f");
		}
		get subsurfaceRadiusScale() {
			return m(this, $, "f");
		}
		set subsurfaceRadiusScale(e) {
			y(this, $, e, "f");
		}
		get subsurfaceRadiusScaleTexture() {
			return m(this, Ge, "f");
		}
		set subsurfaceRadiusScaleTexture(e) {
			y(this, Ge, e, "f");
		}
		get subsurfaceScatterAnisotropy() {
			return m(this, Ke, "f");
		}
		set subsurfaceScatterAnisotropy(e) {
			y(this, Ke, e, "f");
		}
		get coatWeight() {
			return m(this, qe, "f");
		}
		set coatWeight(e) {
			y(this, qe, e, "f");
		}
		get coatWeightTexture() {
			return m(this, Je, "f");
		}
		set coatWeightTexture(e) {
			y(this, Je, e, "f");
		}
		get coatColor() {
			return m(this, Ye, "f");
		}
		set coatColor(e) {
			y(this, Ye, e, "f");
		}
		get coatColorTexture() {
			return m(this, Xe, "f");
		}
		set coatColorTexture(e) {
			y(this, Xe, e, "f");
		}
		get coatRoughness() {
			return m(this, Ze, "f");
		}
		set coatRoughness(e) {
			y(this, Ze, e, "f");
		}
		get coatRoughnessTexture() {
			return m(this, Qe, "f");
		}
		set coatRoughnessTexture(e) {
			y(this, Qe, e, "f");
		}
		get coatRoughnessAnisotropy() {
			return m(this, $e, "f");
		}
		set coatRoughnessAnisotropy(e) {
			y(this, $e, e, "f");
		}
		get coatRoughnessAnisotropyTexture() {
			return m(this, et, "f");
		}
		set coatRoughnessAnisotropyTexture(e) {
			y(this, et, e, "f");
		}
		get coatIor() {
			return m(this, tt, "f");
		}
		set coatIor(e) {
			y(this, tt, e, "f");
		}
		get coatDarkening() {
			return m(this, nt, "f");
		}
		set coatDarkening(e) {
			y(this, nt, e, "f");
		}
		get coatDarkeningTexture() {
			return m(this, rt, "f");
		}
		set coatDarkeningTexture(e) {
			y(this, rt, e, "f");
		}
		get fuzzWeight() {
			return m(this, it, "f");
		}
		set fuzzWeight(e) {
			y(this, it, e, "f");
		}
		get fuzzWeightTexture() {
			return m(this, at, "f");
		}
		set fuzzWeightTexture(e) {
			y(this, at, e, "f");
		}
		get fuzzColor() {
			return m(this, ot, "f");
		}
		set fuzzColor(e) {
			y(this, ot, e, "f");
		}
		get fuzzColorTexture() {
			return m(this, st, "f");
		}
		set fuzzColorTexture(e) {
			y(this, st, e, "f");
		}
		get fuzzRoughness() {
			return m(this, ct, "f");
		}
		set fuzzRoughness(e) {
			y(this, ct, e, "f");
		}
		get fuzzRoughnessTexture() {
			return m(this, lt, "f");
		}
		set fuzzRoughnessTexture(e) {
			y(this, lt, e, "f");
		}
		get geometryThinWalled() {
			return m(this, ut, "f");
		}
		set geometryThinWalled(e) {
			y(this, ut, e, "f");
		}
		get geometryNormalTexture() {
			return m(this, dt, "f");
		}
		set geometryNormalTexture(e) {
			y(this, dt, e, "f");
		}
		get geometryTangent() {
			return m(this, ft, "f");
		}
		set geometryTangent(e) {
			y(this, ft, e, "f");
		}
		get geometryTangentAngle() {
			return Math.atan2(this.geometryTangent.y, this.geometryTangent.x);
		}
		set geometryTangentAngle(e) {
			this.geometryTangent = new l(Math.cos(e), Math.sin(e));
		}
		get geometryTangentTexture() {
			return m(this, pt, "f");
		}
		set geometryTangentTexture(e) {
			y(this, pt, e, "f");
		}
		get geometryCoatNormalTexture() {
			return m(this, mt, "f");
		}
		set geometryCoatNormalTexture(e) {
			y(this, mt, e, "f");
		}
		get geometryCoatTangent() {
			return m(this, ht, "f");
		}
		set geometryCoatTangent(e) {
			y(this, ht, e, "f");
		}
		get geometryCoatTangentAngle() {
			return Math.atan2(this.geometryCoatTangent.y, this.geometryCoatTangent.x);
		}
		set geometryCoatTangentAngle(e) {
			this.geometryCoatTangent = new l(Math.cos(e), Math.sin(e));
		}
		get geometryCoatTangentTexture() {
			return m(this, gt, "f");
		}
		set geometryCoatTangentTexture(e) {
			y(this, gt, e, "f");
		}
		get geometryOpacity() {
			return m(this, _t, "f");
		}
		set geometryOpacity(e) {
			y(this, _t, e, "f");
		}
		get geometryOpacityTexture() {
			return m(this, vt, "f");
		}
		set geometryOpacityTexture(e) {
			y(this, vt, e, "f");
		}
		get geometryThickness() {
			return m(this, yt, "f");
		}
		set geometryThickness(e) {
			y(this, yt, e, "f");
		}
		get geometryThicknessTexture() {
			return m(this, bt, "f");
		}
		set geometryThicknessTexture(e) {
			y(this, bt, e, "f");
		}
		get emissionLuminance() {
			return m(this, xt, "f");
		}
		set emissionLuminance(e) {
			y(this, xt, e, "f");
		}
		get emissionColor() {
			return m(this, St, "f");
		}
		set emissionColor(e) {
			y(this, St, e, "f");
		}
		get emissionColorTexture() {
			return m(this, Ct, "f");
		}
		set emissionColorTexture(e) {
			y(this, Ct, e, "f");
		}
		get thinFilmWeight() {
			return m(this, wt, "f");
		}
		set thinFilmWeight(e) {
			y(this, wt, e, "f");
		}
		get thinFilmWeightTexture() {
			return m(this, Tt, "f");
		}
		set thinFilmWeightTexture(e) {
			y(this, Tt, e, "f");
		}
		get thinFilmThickness() {
			return m(this, Et, "f");
		}
		set thinFilmThickness(e) {
			y(this, Et, e, "f");
		}
		get thinFilmThicknessMin() {
			return m(this, Dt, "f");
		}
		set thinFilmThicknessMin(e) {
			y(this, Dt, e, "f");
		}
		get thinFilmThicknessTexture() {
			return m(this, Ot, "f");
		}
		set thinFilmThicknessTexture(e) {
			y(this, Ot, e, "f");
		}
		get thinFilmIor() {
			return m(this, kt, "f");
		}
		set thinFilmIor(e) {
			y(this, kt, e, "f");
		}
		get ambientOcclusionTexture() {
			return m(this, At, "f");
		}
		set ambientOcclusionTexture(e) {
			y(this, At, e, "f");
		}
		get sssQuality() {
			return this._sssQuality;
		}
		set sssQuality(e) {
			this._sssQuality !== e && (this._sssQuality = e, this.markAsDirty(1));
		}
		get sssIrradianceTexture() {
			return this._sssIrradianceTexture;
		}
		set sssIrradianceTexture(e) {
			this._sssIrradianceTexture !== e && (this._sssIrradianceTexture = e, this._markAllSubMeshesAsTexturesDirty());
		}
		get sssDepthTexture() {
			return this._sssDepthTexture;
		}
		set sssDepthTexture(e) {
			this._sssDepthTexture !== e && (this._sssDepthTexture = e, this._markAllSubMeshesAsTexturesDirty());
		}
		get directIntensity() {
			return m(this, jt, "f");
		}
		set directIntensity(e) {
			y(this, jt, e, "f");
		}
		get environmentIntensity() {
			return m(this, Mt, "f");
		}
		set environmentIntensity(e) {
			y(this, Mt, e, "f");
		}
		get useSpecularWeightFromTextureAlpha() {
			return m(this, Nt, "f");
		}
		set useSpecularWeightFromTextureAlpha(e) {
			y(this, Nt, e, "f");
		}
		get forceAlphaTest() {
			return m(this, Pt, "f");
		}
		set forceAlphaTest(e) {
			y(this, Pt, e, "f");
		}
		get alphaCutOff() {
			return m(this, Ft, "f");
		}
		set alphaCutOff(e) {
			y(this, Ft, e, "f");
		}
		get useAmbientOcclusionFromMetallicTextureRed() {
			return m(this, It, "f");
		}
		set useAmbientOcclusionFromMetallicTextureRed(e) {
			y(this, It, e, "f");
		}
		get useAmbientInGrayScale() {
			return m(this, Lt, "f");
		}
		set useAmbientInGrayScale(e) {
			y(this, Lt, e, "f");
		}
		get hasTransparency() {
			return this.subsurfaceWeight > 0 || this.transmissionWeight > 0;
		}
		get hasScattering() {
			return this.transmissionWeight > 0 && this.transmissionDepth > 0 && !this.transmissionScatter.equals(d.BlackReadOnly) || this.subsurfaceWeight > 0;
		}
		get usePhysicalLightFalloff() {
			return this._lightFalloff === E.LIGHTFALLOFF_PHYSICAL;
		}
		set usePhysicalLightFalloff(e) {
			e !== this.usePhysicalLightFalloff && (this._markAllSubMeshesAsTexturesDirty(), this._lightFalloff = e ? E.LIGHTFALLOFF_PHYSICAL : E.LIGHTFALLOFF_STANDARD);
		}
		get useGLTFLightFalloff() {
			return this._lightFalloff === E.LIGHTFALLOFF_GLTF;
		}
		set useGLTFLightFalloff(e) {
			e !== this.useGLTFLightFalloff && (this._markAllSubMeshesAsTexturesDirty(), this._lightFalloff = e ? E.LIGHTFALLOFF_GLTF : E.LIGHTFALLOFF_STANDARD);
		}
		get useObjectSpaceNormalMap() {
			return m(this, Rt, "f");
		}
		set useObjectSpaceNormalMap(e) {
			y(this, Rt, e, "f");
		}
		get useParallax() {
			return m(this, zt, "f");
		}
		set useParallax(e) {
			y(this, zt, e, "f");
		}
		get useParallaxOcclusion() {
			return m(this, Bt, "f");
		}
		set useParallaxOcclusion(e) {
			y(this, Bt, e, "f");
		}
		get parallaxScaleBias() {
			return m(this, Vt, "f");
		}
		set parallaxScaleBias(e) {
			y(this, Vt, e, "f");
		}
		get disableLighting() {
			return m(this, Ht, "f");
		}
		set disableLighting(e) {
			y(this, Ht, e, "f");
		}
		get forceIrradianceInFragment() {
			return m(this, Ut, "f");
		}
		set forceIrradianceInFragment(e) {
			y(this, Ut, e, "f");
		}
		get maxSimultaneousLights() {
			return m(this, Wt, "f");
		}
		set maxSimultaneousLights(e) {
			y(this, Wt, e, "f");
		}
		get invertNormalMapX() {
			return m(this, Gt, "f");
		}
		set invertNormalMapX(e) {
			y(this, Gt, e, "f");
		}
		get invertNormalMapY() {
			return m(this, Kt, "f");
		}
		set invertNormalMapY(e) {
			y(this, Kt, e, "f");
		}
		get twoSidedLighting() {
			return m(this, qt, "f");
		}
		set twoSidedLighting(e) {
			y(this, qt, e, "f");
		}
		get useAlphaFresnel() {
			return m(this, Jt, "f");
		}
		set useAlphaFresnel(e) {
			y(this, Jt, e, "f");
		}
		get useLinearAlphaFresnel() {
			return m(this, Yt, "f");
		}
		set useLinearAlphaFresnel(e) {
			y(this, Yt, e, "f");
		}
		get environmentBRDFTexture() {
			return m(this, Xt, "f");
		}
		set environmentBRDFTexture(e) {
			y(this, Xt, e, "f");
		}
		get forceNormalForward() {
			return m(this, Zt, "f");
		}
		set forceNormalForward(e) {
			y(this, Zt, e, "f");
		}
		get enableSpecularAntiAliasing() {
			return m(this, Qt, "f");
		}
		set enableSpecularAntiAliasing(e) {
			y(this, Qt, e, "f");
		}
		get useHorizonOcclusion() {
			return m(this, $t, "f");
		}
		set useHorizonOcclusion(e) {
			y(this, $t, e, "f");
		}
		get useRadianceOcclusion() {
			return m(this, en, "f");
		}
		set useRadianceOcclusion(e) {
			y(this, en, e, "f");
		}
		get unlit() {
			return m(this, tn, "f");
		}
		set unlit(e) {
			y(this, tn, e, "f");
		}
		get applyDecalMapAfterDetailMap() {
			return m(this, nn, "f");
		}
		set applyDecalMapAfterDetailMap(e) {
			y(this, nn, e, "f");
		}
		get backgroundRefractionTexture() {
			return this._backgroundRefractionTexture;
		}
		set backgroundRefractionTexture(e) {
			this._backgroundRefractionTexture = e, this._markAllSubMeshesAsTexturesDirty();
		}
		get refractionHighQualityBlur() {
			return this._refractionHighQualityBlur;
		}
		set refractionHighQualityBlur(e) {
			this._refractionHighQualityBlur !== e && (this._refractionHighQualityBlur = e, this.markAsDirty(1));
		}
		get realTimeFiltering() {
			return this._realTimeFiltering;
		}
		set realTimeFiltering(e) {
			this._realTimeFiltering = e, this.markAsDirty(1);
		}
		get realTimeFilteringQuality() {
			return this._realTimeFilteringQuality;
		}
		set realTimeFilteringQuality(e) {
			this._realTimeFilteringQuality = e, this.markAsDirty(1);
		}
		get fuzzSampleNumber() {
			return this._fuzzSampleNumber;
		}
		set fuzzSampleNumber(e) {
			this._fuzzSampleNumber = e, this.markAsDirty(1);
		}
		get canRenderToMRT() {
			return !0;
		}
		get debugMode() {
			return m(this, rn, "f");
		}
		set debugMode(e) {
			y(this, rn, e, "f");
		}
		constructor(r, a, s = !1) {
			super(r, a, void 0, s || t.ForceGLSL), n.set(this, (h(this, on), h(this, cn, void 0))), this._baseWeight = (h(this, ln), new J("base_weight", 1, "vBaseWeight", 1)), i.set(this, h(this, dn, void 0)), this._baseWeightTexture = (h(this, fn), new Y("base_weight", "baseWeight", "BASE_WEIGHT")), o.set(this, h(this, mn, void 0)), this._baseColor = (h(this, hn), new J("base_color", d.White(), "vBaseColor", 4)), u.set(this, h(this, _n, void 0)), this._baseColorTexture = (h(this, vn), new Y("base_color", "baseColor", "BASE_COLOR")), f.set(this, h(this, bn, void 0)), this._baseDiffuseRoughness = (h(this, xn), new J("base_diffuse_roughness", 0, "vBaseDiffuseRoughness", 1)), p.set(this, h(this, Cn, void 0)), this._baseDiffuseRoughnessTexture = (h(this, wn), new Y("base_diffuse_roughness", "baseDiffuseRoughness", "BASE_DIFFUSE_ROUGHNESS")), x.set(this, h(this, En, void 0)), this._baseMetalness = (h(this, Dn), new J("base_metalness", 0, "vReflectanceInfo", 4, 0)), S.set(this, h(this, kn, void 0)), this._baseMetalnessTexture = (h(this, An), new Y("base_metalness", "baseMetalness", "BASE_METALNESS")), C.set(this, h(this, Mn, void 0)), this._specularWeight = (h(this, Nn), new J("specular_weight", 1, "vReflectanceInfo", 4, 3)), w.set(this, h(this, Fn, void 0)), this._specularWeightTexture = (h(this, In), new Y("specular_weight", "specularWeight", "SPECULAR_WEIGHT")), D.set(this, h(this, Rn, void 0)), this._specularColor = (h(this, zn), new J("specular_color", d.White(), "vSpecularColor", 4)), Ne.set(this, h(this, Vn, void 0)), this._specularColorTexture = (h(this, Hn), new Y("specular_color", "specularColor", "SPECULAR_COLOR")), Le.set(this, h(this, Wn, void 0)), this._specularRoughness = (h(this, Gn), new J("specular_roughness", .3, "vReflectanceInfo", 4, 1)), O.set(this, h(this, qn, void 0)), this._specularRoughnessTexture = (h(this, Jn), new Y("specular_roughness", "specularRoughness", "SPECULAR_ROUGHNESS")), k.set(this, h(this, Xn, void 0)), this._specularRoughnessAnisotropy = (h(this, Zn), new J("specular_roughness_anisotropy", 0, "vSpecularAnisotropy", 3, 2)), A.set(this, h(this, $n, void 0)), this._specularRoughnessAnisotropyTexture = (h(this, er), new Y("specular_roughness_anisotropy", "specularRoughnessAnisotropy", "SPECULAR_ROUGHNESS_ANISOTROPY")), j.set(this, h(this, nr, void 0)), this._specularIor = (h(this, rr), new J("specular_ior", 1.5, "vReflectanceInfo", 4, 2)), M.set(this, h(this, ar, void 0)), this._transmissionWeight = (h(this, or), new J("transmission_weight", 0, "vTransmissionWeight", 1)), N.set(this, h(this, cr, void 0)), this._transmissionWeightTexture = (h(this, lr), new Y("transmission_weight", "transmissionWeight", "TRANSMISSION_WEIGHT")), P.set(this, h(this, dr, void 0)), this._transmissionColor = (h(this, fr), new J("transmission_color", d.White(), "vTransmissionColor", 3, 0)), F.set(this, h(this, mr, void 0)), this._transmissionColorTexture = (h(this, hr), new Y("transmission_color", "transmissionColor", "TRANSMISSION_COLOR")), I.set(this, h(this, _r, void 0)), this._transmissionDepth = (h(this, vr), new J("transmission_depth", 0, "vTransmissionDepth", 1, 0)), L.set(this, h(this, br, void 0)), this._transmissionDepthTexture = (h(this, xr), new Y("transmission_depth", "transmissionDepth", "TRANSMISSION_DEPTH")), R.set(this, h(this, Cr, void 0)), this._transmissionScatter = (h(this, wr), new J("transmission_scatter", d.Black(), "vTransmissionScatter", 3, 0)), z.set(this, h(this, Er, void 0)), this._transmissionScatterTexture = (h(this, Dr), new Y("transmission_scatter", "transmissionScatter", "TRANSMISSION_SCATTER")), B.set(this, h(this, kr, void 0)), this._transmissionScatterAnisotropy = (h(this, Ar), new J("transmission_scatter_anisotropy", 0, "vTransmissionScatterAnisotropy", 1, 0)), V.set(this, h(this, Mr, void 0)), this._transmissionDispersionScale = (h(this, Nr), new J("transmission_dispersion_scale", 0, "vTransmissionDispersionScale", 1, 0)), H.set(this, h(this, Fr, void 0)), this._transmissionDispersionScaleTexture = (h(this, Ir), new Y("transmission_dispersion_scale", "transmissionDispersionScale", "TRANSMISSION_DISPERSION_SCALE")), U.set(this, h(this, Rr, void 0)), this._transmissionDispersionAbbeNumber = (h(this, zr), new J("transmission_dispersion_abbe_number", 20, "vTransmissionDispersionAbbeNumber", 1, 0)), W.set(this, h(this, Vr, void 0)), this._subsurfaceWeight = (h(this, Hr), new J("subsurface_weight", 0, "vSubsurfaceWeight", 1, 0, "SUBSURFACE_SLAB")), q.set(this, h(this, Wr, void 0)), this._subsurfaceWeightTexture = (h(this, Gr), new Y("subsurface_weight", "subsurfaceWeight", "SUBSURFACE_WEIGHT")), X.set(this, h(this, qr, void 0)), this._subsurfaceColor = (h(this, Jr), new J("subsurface_color", new d(.8, .8, .8), "vSubsurfaceColor", 3, 0, "SUBSURFACE_SLAB")), Z.set(this, h(this, Xr, void 0)), this._subsurfaceColorTexture = (h(this, Zr), new Y("subsurface_color", "subsurfaceColor", "SUBSURFACE_COLOR")), Q.set(this, h(this, $r, void 0)), this._subsurfaceRadius = (h(this, ei), new J("subsurface_radius", .1, "vSubsurfaceRadius", 1, 0, "SUBSURFACE_SLAB")), $.set(this, h(this, ni, void 0)), this._subsurfaceRadiusScale = (h(this, ri), new J("subsurface_radius_scale", new d(1, .5, .25), "vSubsurfaceRadiusScale", 3, 0, "SUBSURFACE_SLAB")), Ge.set(this, h(this, ai, void 0)), this._subsurfaceRadiusScaleTexture = (h(this, oi), new Y("subsurface_radius_scale", "subsurfaceRadiusScale", "SUBSURFACE_RADIUS_SCALE")), Ke.set(this, h(this, ci, void 0)), this._subsurfaceScatterAnisotropy = (h(this, li), new J("subsurface_scatter_anisotropy", 0, "vSubsurfaceScatterAnisotropy", 1, 0, "SUBSURFACE_SLAB")), qe.set(this, h(this, di, void 0)), this._coatWeight = (h(this, fi), new J("coat_weight", 0, "vCoatWeight", 1, 0)), Je.set(this, h(this, mi, void 0)), this._coatWeightTexture = (h(this, hi), new Y("coat_weight", "coatWeight", "COAT_WEIGHT")), Ye.set(this, h(this, _i, void 0)), this._coatColor = (h(this, vi), new J("coat_color", d.White(), "vCoatColor", 3, 0)), Xe.set(this, h(this, bi, void 0)), this._coatColorTexture = (h(this, xi), new Y("coat_color", "coatColor", "COAT_COLOR")), Ze.set(this, h(this, Ci, void 0)), this._coatRoughness = (h(this, wi), new J("coat_roughness", 0, "vCoatRoughness", 1, 0)), Qe.set(this, h(this, Ei, void 0)), this._coatRoughnessTexture = (h(this, Di), new Y("coat_roughness", "coatRoughness", "COAT_ROUGHNESS")), $e.set(this, h(this, ki, void 0)), this._coatRoughnessAnisotropy = (h(this, Ai), new J("coat_roughness_anisotropy", 0, "vCoatRoughnessAnisotropy", 1)), et.set(this, h(this, Mi, void 0)), this._coatRoughnessAnisotropyTexture = (h(this, Ni), new Y("coat_roughness_anisotropy", "coatRoughnessAnisotropy", "COAT_ROUGHNESS_ANISOTROPY")), tt.set(this, h(this, Fi, void 0)), this._coatIor = (h(this, Ii), new J("coat_ior", 1.5, "vCoatIor", 1, 0)), nt.set(this, h(this, Ri, void 0)), this._coatDarkening = (h(this, zi), new J("coat_darkening", 1, "vCoatDarkening", 1, 0)), rt.set(this, h(this, Vi, void 0)), this._coatDarkeningTexture = (h(this, Hi), new Y("coat_darkening", "coatDarkening", "COAT_DARKENING")), this.useCoatRoughnessFromWeightTexture = !1, it.set(this, h(this, Wi, void 0)), this._fuzzWeight = (h(this, Gi), new J("fuzz_weight", 0, "vFuzzWeight", 1, 0)), at.set(this, h(this, qi, void 0)), this._fuzzWeightTexture = (h(this, Ji), new Y("fuzz_weight", "fuzzWeight", "FUZZ_WEIGHT")), ot.set(this, h(this, Xi, void 0)), this._fuzzColor = (h(this, Zi), new J("fuzz_color", d.White(), "vFuzzColor", 3, 0)), st.set(this, h(this, $i, void 0)), this._fuzzColorTexture = (h(this, ea), new Y("fuzz_color", "fuzzColor", "FUZZ_COLOR")), ct.set(this, h(this, na, void 0)), this._fuzzRoughness = (h(this, ra), new J("fuzz_roughness", .5, "vFuzzRoughness", 1, 0)), lt.set(this, h(this, aa, void 0)), this._fuzzRoughnessTexture = (h(this, oa), new Y("fuzz_roughness", "fuzzRoughness", "FUZZ_ROUGHNESS")), ut.set(this, h(this, ca, void 0)), this._geometryThinWalled = (h(this, la), new J("geometry_thin_walled", 0, "vGeometryThinWalled", 1, 0)), dt.set(this, h(this, da, void 0)), this._geometryNormalTexture = (h(this, fa), new Y("geometry_normal", "geometryNormal", "GEOMETRY_NORMAL")), ft.set(this, h(this, ma, void 0)), this._geometryTangent = (h(this, ha), new J("geometry_tangent", new l(1, 0), "vSpecularAnisotropy", 3, 0)), pt.set(this, h(this, _a, void 0)), this._geometryTangentTexture = (h(this, va), new Y("geometry_tangent", "geometryTangent", "GEOMETRY_TANGENT")), mt.set(this, h(this, ba, void 0)), this._geometryCoatNormalTexture = (h(this, xa), new Y("geometry_coat_normal", "geometryCoatNormal", "GEOMETRY_COAT_NORMAL")), ht.set(this, h(this, Ca, void 0)), this._geometryCoatTangent = (h(this, wa), new J("geometry_coat_tangent", new l(1, 0), "vGeometryCoatTangent", 2, 0)), gt.set(this, h(this, Ea, void 0)), this._geometryCoatTangentTexture = (h(this, Da), new Y("geometry_coat_tangent", "geometryCoatTangent", "GEOMETRY_COAT_TANGENT")), _t.set(this, h(this, ka, void 0)), this._geometryOpacity = (h(this, Aa), new J("geometry_opacity", 1, "vBaseColor", 4, 3)), vt.set(this, h(this, Ma, void 0)), this._geometryOpacityTexture = (h(this, Na), new Y("geometry_opacity", "geometryOpacity", "GEOMETRY_OPACITY")), yt.set(this, h(this, Fa, void 0)), this._geometryThickness = (h(this, Ia), new J("geometry_thickness", 0, "vGeometryThickness", 1, 0)), bt.set(this, h(this, Ra, void 0)), this._geometryThicknessTexture = (h(this, za), new Y("geometry_thickness", "geometryThickness", "GEOMETRY_THICKNESS")), xt.set(this, h(this, Va, void 0)), this._emissionLuminance = (h(this, Ha), new J("emission_luminance", 1, "vLightingIntensity", 4, 1)), St.set(this, h(this, Wa, void 0)), this._emissionColor = (h(this, Ga), new J("emission_color", d.Black(), "vEmissionColor", 3)), Ct.set(this, h(this, qa, void 0)), this._emissionColorTexture = (h(this, Ja), new Y("emission_color", "emissionColor", "EMISSION_COLOR")), wt.set(this, h(this, Xa, void 0)), this._thinFilmWeight = (h(this, Za), new J("thin_film_weight", 0, "vThinFilmWeight", 1, 0)), Tt.set(this, h(this, $a, void 0)), this._thinFilmWeightTexture = (h(this, eo), new Y("thin_film_weight", "thinFilmWeight", "THIN_FILM_WEIGHT")), Et.set(this, h(this, no, void 0)), this._thinFilmThickness = (h(this, ro), new J("thin_film_thickness", .5, "vThinFilmThickness", 2, 0)), Dt.set(this, h(this, ao, void 0)), this._thinFilmThicknessMin = (h(this, oo), new J("thin_film_thickness_min", 0, "vThinFilmThickness", 2, 1)), Ot.set(this, h(this, co, void 0)), this._thinFilmThicknessTexture = (h(this, lo), new Y("thin_film_thickness", "thinFilmThickness", "THIN_FILM_THICKNESS")), kt.set(this, h(this, fo, void 0)), this._thinFilmIor = (h(this, po), new J("thin_film_ior", 1.4, "vThinFilmIor", 1, 0)), At.set(this, h(this, ho, void 0)), this._ambientOcclusionTexture = (h(this, go), new Y("ambient_occlusion", "ambientOcclusion", "AMBIENT_OCCLUSION")), this._sssQuality = t.SSS_QUALITY_MEDIUM, this._sssIrradianceTexture = null, this._sssDepthTexture = null, this._uniformsList = {}, this._uniformsArray = [], this._samplersList = {}, this._samplerDefines = {}, jt.set(this, h(this, vo, 1)), Mt.set(this, (h(this, yo), h(this, xo, 1))), Nt.set(this, (h(this, So), h(this, wo, !1))), Pt.set(this, (h(this, To), h(this, Do, !1))), Ft.set(this, (h(this, Oo), h(this, Ao, .4))), It.set(this, (h(this, jo), h(this, No, !1))), Lt.set(this, (h(this, Po), h(this, Io, !1))), Rt.set(this, (h(this, Lo), h(this, Vo, !1))), zt.set(this, (h(this, Ho), h(this, Wo, !1))), Bt.set(this, (h(this, Go), h(this, qo, !1))), Vt.set(this, (h(this, Jo), h(this, Xo, .05))), Ht.set(this, (h(this, Zo), h(this, $o, !1))), Ut.set(this, (h(this, es), h(this, ns, !1))), Wt.set(this, (h(this, rs), h(this, as, 4))), Gt.set(this, (h(this, os), h(this, cs, !1))), Kt.set(this, (h(this, ls), h(this, ds, !1))), qt.set(this, (h(this, fs), h(this, ms, !1))), Jt.set(this, (h(this, hs), h(this, _s, !1))), Yt.set(this, (h(this, vs), h(this, bs, !1))), Xt.set(this, (h(this, xs), h(this, Cs, null))), Zt.set(this, (h(this, ws), h(this, Es, !1))), Qt.set(this, (h(this, Ds), h(this, ks, !1))), $t.set(this, (h(this, As), h(this, Ms, !0))), en.set(this, (h(this, Ns), h(this, Fs, !0))), tn.set(this, (h(this, Is), h(this, Rs, !1))), nn.set(this, (h(this, zs), h(this, Vs, !1))), this._lightingInfos = (h(this, Hs), new c(this.directIntensity, 1, this.environmentIntensity, 1)), this._radianceTexture = null, this._useSpecularWeightFromAlpha = !1, this._useSpecularWeightFromSpecularColorTexture = !1, this._useSpecularRoughnessAnisotropyFromTangentTexture = !1, this._useCoatRoughnessAnisotropyFromTangentTexture = !1, this._useCoatRoughnessFromGreenChannel = !1, this._useGltfStyleAnisotropy = !1, this._useFuzzRoughnessFromTextureAlpha = !1, this._useSubsurfaceWeightFromTextureAlpha = !1, this._useHorizonOcclusion = !0, this._useRadianceOcclusion = !0, this._useAlphaFromBaseColorTexture = !1, this._useAmbientOcclusionFromMetallicTextureRed = !1, this._useRoughnessFromMetallicTextureGreen = !1, this._useMetallicFromMetallicTextureBlue = !1, this._useThinFilmThicknessFromTextureGreen = !1, this._useGeometryThicknessFromGreenChannel = !1, this._lightFalloff = E.LIGHTFALLOFF_PHYSICAL, this._useObjectSpaceNormalMap = !1, this._useParallax = !1, this._useParallaxOcclusion = !1, this._parallaxScaleBias = .05, this._disableLighting = !1, this._maxSimultaneousLights = 4, this._invertNormalMapX = !1, this._invertNormalMapY = !1, this._twoSidedLighting = !1, this._alphaCutOff = .4, this._useAlphaFresnel = !1, this._useLinearAlphaFresnel = !1, this._environmentBRDFTexture = null, this._environmentFuzzBRDFTexture = null, this._backgroundRefractionTexture = null, this._refractionHighQualityBlur = !0, this._forceIrradianceInFragment = !1, this._realTimeFiltering = !1, this._realTimeFilteringQuality = 8, this._fuzzSampleNumber = 4, this._forceNormalForward = !1, this._enableSpecularAntiAliasing = !1, this._renderTargets = new ne(16), this._unlit = !1, this._applyDecalMapAfterDetailMap = !1, this._debugMode = 0, this._breakShaderLoadedCheck = !1, this._vertexPullingMetadata = null, rn.set(this, h(this, Ws, 0)), this.debugLimit = (h(this, Gs), -1), this.debugFactor = 1, this._cacheHasRenderTargetTextures = !1, this._transparencyMode = E.MATERIAL_OPAQUE, this.getScene() && !this.getScene()?.getEngine().isWebGPU && this.getScene().getEngine().webGLVersion < 2 && e.Error("OpenPBRMaterial: WebGL 2.0 or above is required for this material."), t._noiseTextures[this.getScene().uniqueId] || (t._noiseTextures[this.getScene().uniqueId] = new je(te.GetAssetUrl("https://assets.babylonjs.com/core/blue_noise/blue_noise_rgb.png"), this.getScene(), !1, !0, 1), this.getScene().onDisposeObservable.addOnce(() => {
				t._noiseTextures[this.getScene().uniqueId]?.dispose(), delete t._noiseTextures[this.getScene().uniqueId];
			})), this._attachImageProcessingConfiguration(null), this.getRenderTargetTextures = () => (this._renderTargets.reset(), T.ReflectionTextureEnabled && this._radianceTexture && this._radianceTexture.isRenderTarget && this._renderTargets.push(this._radianceTexture), T.RefractionTextureEnabled && this._backgroundRefractionTexture && this._backgroundRefractionTexture.isRenderTarget && this._renderTargets.push(this._backgroundRefractionTexture), this._eventInfo.renderTargets = this._renderTargets, this._callbackPluginEventFillRenderTargetTextures(this._eventInfo), this._renderTargets), this._environmentBRDFTexture = Ve(this.getScene()), this._environmentFuzzBRDFTexture = Be(this.getScene()), this.prePassConfiguration = new Pe(), this._propertyList = {};
			for (let e of Object.getOwnPropertyNames(this)) {
				let t = this[e];
				t instanceof J && (this._propertyList[e] = t);
			}
			Object.keys(this._propertyList).forEach((t) => {
				let n = this._propertyList[t], r = this._uniformsList[n.targetUniformName];
				r ? r.numComponents === n.targetUniformComponentNum ? r.requiredDefine !== n.requiredDefine && (r.requiredDefine = void 0) : e.Error(`Uniform ${n.targetUniformName} already exists of size ${r.numComponents}, but trying to set it to ${n.targetUniformComponentNum}.`) : (r = new He(n.targetUniformName, n.targetUniformComponentNum), r.requiredDefine = n.requiredDefine, this._uniformsList[n.targetUniformName] = r), r.firstLinkedKey === "" && (r.firstLinkedKey = n.name), r.linkedProperties[n.name] = n;
			}), this._uniformsArray = Object.values(this._uniformsList), this._samplersList = {};
			for (let e of Object.getOwnPropertyNames(this)) {
				let t = this[e];
				t instanceof Y && (this._samplersList[e] = t);
			}
			for (let e in this._samplersList) {
				let t = this._samplersList[e].textureDefine;
				this._samplerDefines[t] = {
					type: "boolean",
					default: !1
				}, this._samplerDefines[t + "DIRECTUV"] = {
					type: "number",
					default: 0
				}, this._samplerDefines[t + "_GAMMA"] = {
					type: "boolean",
					default: !1
				};
			}
			this._baseWeight, this._baseWeightTexture, this._baseColor, this._baseColorTexture, this._baseDiffuseRoughness, this._baseDiffuseRoughnessTexture, this._baseMetalness, this._baseMetalnessTexture, this._specularWeight, this._specularWeightTexture, this._specularColor, this._specularColorTexture, this._specularRoughness, this._specularIor, this._specularRoughnessTexture, this._specularRoughnessAnisotropy, this._specularRoughnessAnisotropyTexture, this._transmissionWeight, this._transmissionWeightTexture, this._transmissionColor, this._transmissionColorTexture, this._transmissionDepth, this._transmissionDepthTexture, this._transmissionScatter, this._transmissionScatterTexture, this._transmissionScatterAnisotropy, this._transmissionDispersionScale, this._transmissionDispersionScaleTexture, this._transmissionDispersionAbbeNumber, this._subsurfaceWeight, this._subsurfaceWeightTexture, this._subsurfaceColor, this._subsurfaceColorTexture, this._subsurfaceRadius, this._subsurfaceRadiusScale, this._subsurfaceRadiusScaleTexture, this._subsurfaceScatterAnisotropy, this._coatWeight, this._coatWeightTexture, this._coatColor, this._coatColorTexture, this._coatRoughness, this._coatRoughnessTexture, this._coatRoughnessAnisotropy, this._coatRoughnessAnisotropyTexture, this._coatIor, this._coatDarkening, this._coatDarkeningTexture, this._fuzzWeight, this._fuzzWeightTexture, this._fuzzColor, this._fuzzColorTexture, this._fuzzRoughness, this._fuzzRoughnessTexture, this._geometryThinWalled, this._geometryNormalTexture, this._geometryTangent, this._geometryTangentTexture, this._geometryCoatNormalTexture, this._geometryCoatTangent, this._geometryCoatTangentTexture, this._geometryOpacity, this._geometryOpacityTexture, this._geometryThickness, this._geometryThicknessTexture, this._thinFilmWeight, this._thinFilmWeightTexture, this._thinFilmThickness, this._thinFilmThicknessMin, this._thinFilmThicknessTexture, this._thinFilmIor, this._emissionLuminance, this._emissionColor, this._emissionColorTexture, this._ambientOcclusionTexture;
		}
		get hasRenderTargetTextures() {
			return T.ReflectionTextureEnabled && this._radianceTexture && this._radianceTexture.isRenderTarget || T.RefractionTextureEnabled && this._backgroundRefractionTexture && this._backgroundRefractionTexture.isRenderTarget ? !0 : this._cacheHasRenderTargetTextures;
		}
		get isPrePassCapable() {
			return !this.disableDepthWrite;
		}
		getClassName() {
			return "OpenPBRMaterial";
		}
		get transparencyMode() {
			return this._transparencyMode;
		}
		set transparencyMode(e) {
			this._transparencyMode !== e && (this._transparencyMode = e, this._markAllSubMeshesAsTexturesAndMiscDirty());
		}
		_shouldUseAlphaFromBaseColorTexture() {
			return this._hasAlphaChannel() && this._transparencyMode !== E.MATERIAL_OPAQUE && !this.geometryOpacityTexture;
		}
		_hasAlphaChannel() {
			return this.baseColorTexture != null && this.baseColorTexture.hasAlpha && this._useAlphaFromBaseColorTexture || this.geometryOpacityTexture != null;
		}
		needAlphaBlending() {
			return this.geometryOpacity < 1 || this.geometryOpacityTexture != null;
		}
		needAlphaBlendingForMesh(e) {
			return this.geometryOpacity < 1 || this.geometryOpacityTexture != null || super.needAlphaBlendingForMesh(e);
		}
		clone(e, n = !0, r = "") {
			let i = ee.Clone(() => new t(e, this.getScene()), this, { cloneTexturesOnlyOnce: n });
			return i.id = e, i.name = e, this.stencil.copyTo(i.stencil), this._clonePlugins(i, r), i;
		}
		serialize() {
			let e = super.serialize();
			return e.customType = "BABYLON.OpenPBRMaterial", e;
		}
		static Parse(e, n, r) {
			let i = ee.Parse(() => new t(e.name, n), e, n, r);
			return e.stencil && i.stencil.parse(e.stencil, n, r), E._ParsePlugins(e, i, n, r), i;
		}
		forceCompilation(e, t, n) {
			let r = {
				clipPlane: !1,
				useInstances: !1,
				...n
			};
			this._uniformBufferLayoutBuilt || this.buildUniformLayout(), this._callbackPluginEventGeneric(4, this._eventInfo), (() => {
				if (this._breakShaderLoadedCheck) return;
				let n = new Ue({
					...this._eventInfo.defineNames || {},
					...this._samplerDefines || {}
				}), i = this._prepareEffect(e, e, n, void 0, void 0, r.useInstances, r.clipPlane);
				this._onEffectCreatedObservable && (K.effect = i, K.subMesh = null, this._onEffectCreatedObservable.notifyObservers(K)), i.isReady() ? t && t(this) : i.onCompileObservable.add(() => {
					t && t(this);
				});
			})();
		}
		isReadyForSubMesh(n, r, i) {
			this._uniformBufferLayoutBuilt || this.buildUniformLayout();
			let o = r._drawWrapper;
			if (o.effect && this.isFrozen && o._wasPreviouslyReady && o._wasPreviouslyUsingInstances === i) return !0;
			r.materialDefines ||= (this._callbackPluginEventGeneric(4, this._eventInfo), new Ue({
				...this._eventInfo.defineNames || {},
				...this._samplerDefines || {}
			}));
			let s = r.materialDefines;
			if (this._isReadyForSubMesh(r)) return !0;
			let c = this.getScene(), l = c.getEngine();
			if (s._areTexturesDirty && (this._eventInfo.hasRenderTargetTextures = !1, this._callbackPluginEventHasRenderTargetTextures(this._eventInfo), this._cacheHasRenderTargetTextures = this._eventInfo.hasRenderTargetTextures, c.texturesEnabled)) {
				for (let e in this._samplersList) {
					let t = this._samplersList[e];
					if (t.value && !t.value.isReadyOrNotBlocking()) return !1;
				}
				let e = this._getRadianceTexture();
				if (e && T.ReflectionTextureEnabled) {
					if (!e.isReadyOrNotBlocking()) return !1;
					if (e.irradianceTexture) {
						if (!e.irradianceTexture.isReadyOrNotBlocking()) return !1;
					} else if (!e.sphericalPolynomial && e.getInternalTexture()?._sphericalPolynomialPromise) return !1;
				}
				if (this._environmentBRDFTexture && T.ReflectionTextureEnabled && !this._environmentBRDFTexture.isReady() || this._environmentFuzzBRDFTexture && T.ReflectionTextureEnabled && !this._environmentFuzzBRDFTexture.isReady() || this._backgroundRefractionTexture && T.RefractionTextureEnabled && !this._backgroundRefractionTexture.isReadyOrNotBlocking() || t._noiseTextures[c.uniqueId] && !t._noiseTextures[c.uniqueId].isReady() || this._sssIrradianceTexture && this._sssDepthTexture && (!this._sssIrradianceTexture.isReady() || !this._sssDepthTexture.isReady())) return !1;
			}
			if (this._eventInfo.isReadyForSubMesh = !0, this._eventInfo.defines = s, this._eventInfo.subMesh = r, this._callbackPluginEventIsReadyForSubMesh(this._eventInfo), !this._eventInfo.isReadyForSubMesh || s._areImageProcessingDirty && this._imageProcessingConfiguration && !this._imageProcessingConfiguration.isReady()) return !1;
			if (s.AREALIGHTUSED) {
				for (let e = 0; e < n.lightSources.length; e++) if (!n.lightSources[e]._isReady()) return !1;
			}
			if (!l.getCaps().standardDerivatives && !n.isVerticesDataPresent(a.NormalKind) && (n.createNormals(!0), e.Warn("OpenPBRMaterial: Normals have been created for the mesh: " + n.name)), !Se(c, n, this._maxSimultaneousLights, this._disableLighting)) return !1;
			let u = r.effect, d = s._areLightsDisposed, f = this._prepareEffect(n, r.getRenderingMesh(), s, this.onCompiled, this.onError, i, null), p = !1;
			if (f) {
				if (this._onEffectCreatedObservable && (K.effect = f, K.subMesh = r, this._onEffectCreatedObservable.notifyObservers(K)), this.allowShaderHotSwapping && u && !f.isReady()) {
					if (s.markAsUnprocessed(), p = this.isFrozen, d) return s._areLightsDisposed = !0, !1;
				} else c.resetCachedMaterial(), r.setEffect(f, s, this._materialContext);
			}
			return !r.effect || !r.effect.isReady() ? !1 : (s._renderId = c.getRenderId(), o._wasPreviouslyReady = !p, o._wasPreviouslyUsingInstances = !!i, this._checkScenePerformancePriority(), !0);
		}
		buildUniformLayout() {
			let e = this._uniformBuffer;
			e.addUniform("vTangentSpaceParams", 2), e.addUniform("vLightingIntensity", 4), e.addUniform("pointSize", 1), e.addUniform("vDebugMode", 2), e.addUniform("renderTargetSize", 2), e.addUniform("cameraInfo", 4), e.addUniform("vTextureRepetitionHexTilingParams", 4), e.addUniform("backgroundRefractionMatrix", 16), e.addUniform("vBackgroundRefractionInfos", 3), ie(e, !0, !0, !0, !0, !0), Object.values(this._uniformsList).forEach((t) => {
				e.addUniform(t.name, t.numComponents);
			}), Object.values(this._samplersList).forEach((t) => {
				e.addUniform(t.samplerInfoName, 2), e.addUniform(t.samplerMatrixName, 16);
			}), super.buildUniformLayout();
		}
		bindPropertiesForSubMesh(e, t, n, r) {
			if (this.geometryThickness === 0) e.updateFloat("vGeometryThickness", 0);
			else {
				r.getRenderingMesh().getWorldMatrix().decompose(s.Vector3[0]);
				let t = Math.max(Math.abs(s.Vector3[0].x), Math.abs(s.Vector3[0].y), Math.abs(s.Vector3[0].z));
				e.updateFloat("vGeometryThickness", this.geometryThickness * t);
			}
		}
		bindForSubMesh(e, n, r) {
			let i = this.getScene(), a = r.materialDefines;
			if (!a) return;
			let o = r.effect;
			if (!o) return;
			this._activeEffect = o, n.getMeshUniformBuffer().bindToEffect(o, "Mesh"), n.transferToEffect(e);
			let c = i.getEngine();
			this._uniformBuffer.bindToEffect(o, "Material"), this.prePassConfiguration.bindForSubMesh(this._activeEffect, i, n, e, this.isFrozen), Fe.Bind(c.currentRenderPassId, this._activeEffect, n, e, this);
			let l = i.activeCamera;
			l ? this._uniformBuffer.updateFloat4("cameraInfo", l.minZ, l.maxZ, 0, 0) : this._uniformBuffer.updateFloat4("cameraInfo", 0, 0, 0, 0);
			let u = this.textureRepetitionHexTilingParams;
			this._uniformBuffer.updateFloat4("vTextureRepetitionHexTilingParams", u[0], u[1], u[2], u[3]), this._eventInfo.subMesh = r, this._callbackPluginEventHardBindForSubMesh(this._eventInfo), a.OBJECTSPACE_NORMALMAP && (e.toNormalMatrix(this._normalMatrix), this.bindOnlyNormalMatrix(this._normalMatrix));
			let f = this._mustRebind(i, o, r, n.visibility), p = c._features.needToAlwaysBindUniformBuffers;
			Te(n, this._activeEffect, this.prePassConfiguration), this._vertexPullingMetadata && Me(this._activeEffect, this._vertexPullingMetadata);
			let m = this._uniformBuffer;
			if (f) {
				this.bindViewProjection(o);
				let e = this._getRadianceTexture();
				if (!m.useUbo || !this.isFrozen || !m.isSync || r._drawWrapper._forceRebindOnNextCall) {
					if (i.texturesEnabled) {
						for (let e in this._samplersList) {
							let t = this._samplersList[e];
							t.value && (m.updateFloat2(t.samplerInfoName, t.value.coordinatesIndex, t.value.level), me(t.value, m, t.samplerPrefix));
						}
						(this.geometryNormalTexture || this.geometryCoatNormalTexture) && (i._mirroredCameraPosition ? m.updateFloat2("vTangentSpaceParams", this._invertNormalMapX ? 1 : -1, this._invertNormalMapY ? 1 : -1) : m.updateFloat2("vTangentSpaceParams", this._invertNormalMapX ? -1 : 1, this._invertNormalMapY ? -1 : 1)), de(i, a, m, d.White(), e, this.realTimeFiltering, !0, !0, !0, !0, !0);
					}
					this.pointsCloud && m.updateFloat("pointSize", this.pointSize);
					let t = this._uniformsArray;
					for (let e = 0, n = t.length; e < n; e++) {
						let n = t[e];
						(n.requiredDefine === void 0 || a[n.requiredDefine]) && (n.numComponents === 4 ? (n.populateVectorFromLinkedProperties(s.Vector4[0]), m.updateVector4(n.name, s.Vector4[0])) : n.numComponents === 3 ? (n.populateVectorFromLinkedProperties(s.Vector3[0]), m.updateVector3(n.name, s.Vector3[0])) : n.numComponents === 2 ? (n.populateVectorFromLinkedProperties(s.Vector2[0]), m.updateFloat2(n.name, s.Vector2[0].x, s.Vector2[0].y)) : n.numComponents === 1 && m.updateFloat(n.name, n.linkedProperties[n.firstLinkedKey].value));
					}
					this._lightingInfos.x = this.directIntensity, this._lightingInfos.y = this.emissionLuminance, this._lightingInfos.z = this.environmentIntensity * i.environmentIntensity, this._lightingInfos.w = 1, m.updateVector4("vLightingIntensity", this._lightingInfos), m.updateFloat2("vDebugMode", this.debugLimit, this.debugFactor);
				}
				if (i.texturesEnabled) {
					for (let e in this._samplersList) {
						let t = this._samplersList[e];
						t.value && m.setTexture(t.samplerName, t.value);
					}
					if (Ce(i, a, m, e, this.realTimeFiltering), a.ENVIRONMENTBRDF && m.setTexture("environmentBrdfSampler", this._environmentBRDFTexture), a.FUZZENVIRONMENTBRDF && m.setTexture("environmentFuzzBrdfSampler", this._environmentFuzzBRDFTexture), a.REFRACTED_BACKGROUND && (m.setTexture("backgroundRefractionSampler", this._backgroundRefractionTexture), m.updateMatrix("backgroundRefractionMatrix", this._backgroundRefractionTexture.getReflectionTextureMatrix()), s.Vector3[1].set(Math.log2(this._backgroundRefractionTexture.getSize().width), 0, 0), m.updateVector3("vBackgroundRefractionInfos", s.Vector3[1])), (a.ANISOTROPIC || a.FUZZ || a.REFRACTED_BACKGROUND || a.USE_IRRADIANCE_TEXTURE_FOR_SCATTERING) && m.setTexture("blueNoiseSampler", t._noiseTextures[this.getScene().uniqueId]), a.USE_IRRADIANCE_TEXTURE_FOR_SCATTERING && this.sssIrradianceTexture && this.sssDepthTexture) {
						let e = this.sssIrradianceTexture.getSize().width, t = this.sssIrradianceTexture.getSize().height;
						m.setTexture("sceneIrradianceSampler", this.sssIrradianceTexture), m.setTexture("sceneDepthSampler", this.sssDepthTexture), m.updateFloat2("renderTargetSize", e, t);
					}
				}
				this.getScene().useOrderIndependentTransparency && this.needAlphaBlendingForMesh(n) && this.getScene().depthPeelingRenderer.bind(o), this._eventInfo.subMesh = r, this._callbackPluginEventBindForSubMesh(this._eventInfo), se(this._activeEffect, this, i), this.bindEyePosition(o);
			} else p && (this._needToBindSceneUbo = !0);
			this.bindPropertiesForSubMesh(this._uniformBuffer, i, i.getEngine(), r), (f || !this.isFrozen || p) && i.lightsEnabled && !this._disableLighting && Ee(i, n, this._activeEffect, a, this._maxSimultaneousLights), (f || !this.isFrozen) && (this.bindView(o), ve(i, n, this._activeEffect, !0), a.NUM_MORPH_INFLUENCERS && be(n, this._activeEffect), a.BAKED_VERTEX_ANIMATION_TEXTURE && n.bakedVertexAnimationManager?.bind(o, a.INSTANCES), this._imageProcessingConfiguration.bind(this._activeEffect), pe(a, this._activeEffect, i)), this._afterBind(n, this._activeEffect, r), m.update();
		}
		getAnimatables() {
			let e = super.getAnimatables();
			for (let t in this._samplersList) {
				let n = this._samplersList[t];
				n.value && n.value.animations && n.value.animations.length > 0 && e.push(n.value);
			}
			return this._radianceTexture && this._radianceTexture.animations && this._radianceTexture.animations.length > 0 && e.push(this._radianceTexture), e;
		}
		getActiveTextures() {
			let e = super.getActiveTextures();
			for (let t in this._samplersList) {
				let n = this._samplersList[t];
				n.value && e.push(n.value);
			}
			return this._radianceTexture && e.push(this._radianceTexture), e;
		}
		hasTexture(e) {
			if (super.hasTexture(e)) return !0;
			for (let t in this._samplersList) if (this._samplersList[t].value === e) return !0;
			return this._radianceTexture === e;
		}
		setPrePassRenderer() {
			return !1;
		}
		dispose(e, t) {
			if (this._breakShaderLoadedCheck = !0, t) {
				this._environmentBRDFTexture && this.getScene().openPBREnvironmentBRDFTexture !== this._environmentBRDFTexture && this._environmentBRDFTexture.dispose(), this._environmentFuzzBRDFTexture && this.getScene().environmentFuzzBRDFTexture !== this._environmentFuzzBRDFTexture && this._environmentFuzzBRDFTexture.dispose(), this._backgroundRefractionTexture = null;
				for (let e in this._samplersList) this._samplersList[e].value?.dispose();
				this._radianceTexture?.dispose();
			}
			this._renderTargets.dispose(), this._imageProcessingConfiguration && this._imageProcessingObserver && this._imageProcessingConfiguration.onUpdateParameters.remove(this._imageProcessingObserver), super.dispose(e, t);
		}
		_getRadianceTexture() {
			return this._radianceTexture ? this._radianceTexture : this.getScene().environmentTexture;
		}
		_prepareEffect(e, n, i, o = null, s = null, c = null, l = null) {
			if (this._prepareDefines(e, n, i, c, l), !i.isDirty) return null;
			i.markAsProcessed();
			let u = this.getScene().getEngine(), d = new ze(), f = 0;
			i.USESPHERICALINVERTEX && d.addFallback(f++, "USESPHERICALINVERTEX"), i.FOG && d.addFallback(f, "FOG"), i.SPECULARAA && d.addFallback(f, "SPECULARAA"), i.POINTSIZE && d.addFallback(f, "POINTSIZE"), i.LOGARITHMICDEPTH && d.addFallback(f, "LOGARITHMICDEPTH"), i.PARALLAX && d.addFallback(f, "PARALLAX"), i.PARALLAX_RHS && d.addFallback(f, "PARALLAX_RHS"), i.PARALLAXOCCLUSION && d.addFallback(f++, "PARALLAXOCCLUSION"), i.ENVIRONMENTBRDF && d.addFallback(f++, "ENVIRONMENTBRDF"), i.TANGENT && d.addFallback(f++, "TANGENT"), f = he(i, d, this._maxSimultaneousLights, f), i.SPECULARTERM && d.addFallback(f++, "SPECULARTERM"), i.USESPHERICALFROMREFLECTIONMAP && d.addFallback(f++, "USESPHERICALFROMREFLECTIONMAP"), i.USEIRRADIANCEMAP && d.addFallback(f++, "USEIRRADIANCEMAP"), i.NORMAL && d.addFallback(f++, "NORMAL"), i.VERTEXCOLOR && d.addFallback(f++, "VERTEXCOLOR"), i.MORPHTARGETS && d.addFallback(f++, "MORPHTARGETS"), i.MULTIVIEW && d.addFallback(0, "MULTIVIEW");
			let p = [a.PositionKind];
			i.NORMAL && p.push(a.NormalKind), i.TANGENT && p.push(a.TangentKind);
			for (let e = 1; e <= 6; ++e) i["UV" + e] && p.push(`uv${e === 1 ? "" : e}`);
			i.VERTEXCOLOR && p.push(a.ColorKind), xe(p, e, i, d), _e(p, i), ge(p, e, i), we(p, e, i);
			let m = "openpbr", h = [
				"world",
				"view",
				"viewProjection",
				"projection",
				"vEyePosition",
				"inverseProjection",
				"renderTargetSize",
				"vLightsType",
				"visibility",
				"vFogInfos",
				"vFogColor",
				"pointSize",
				"mBones",
				"normalMatrix",
				"vLightingIntensity",
				"logarithmicDepthConstant",
				"vTangentSpaceParams",
				"boneTextureInfo",
				"vDebugMode",
				"morphTargetTextureInfo",
				"morphTargetTextureIndices",
				"cameraInfo",
				"vTextureRepetitionHexTilingParams",
				"backgroundRefractionMatrix",
				"vBackgroundRefractionInfos"
			];
			for (let e in this._uniformsList) h.push(e);
			let g = [
				"environmentBrdfSampler",
				"boneSampler",
				"morphTargets",
				"oitDepthSampler",
				"oitFrontColorSampler",
				"areaLightsLTC1Sampler",
				"areaLightsLTC2Sampler"
			];
			i.FUZZENVIRONMENTBRDF && g.push("environmentFuzzBrdfSampler"), i.REFRACTED_BACKGROUND && g.push("backgroundRefractionSampler"), (i.ANISOTROPIC || i.FUZZ || i.REFRACTED_BACKGROUND || i.USE_IRRADIANCE_TEXTURE_FOR_SCATTERING) && g.push("blueNoiseSampler"), i.USE_IRRADIANCE_TEXTURE_FOR_SCATTERING && (g.push("sceneIrradianceSampler"), g.push("sceneDepthSampler"));
			for (let e in this._samplersList) {
				let t = this._samplersList[e];
				g.push(t.samplerName), h.push(t.samplerInfoName), h.push(t.samplerMatrixName);
			}
			ce(h, g, !0);
			let _ = [
				"Material",
				"Scene",
				"Mesh"
			], v = {
				maxSimultaneousLights: this._maxSimultaneousLights,
				maxSimultaneousMorphTargets: i.NUM_MORPH_INFLUENCERS
			};
			if (this._eventInfo.fallbacks = d, this._eventInfo.fallbackRank = f, this._eventInfo.defines = i, this._eventInfo.uniforms = h, this._eventInfo.attributes = p, this._eventInfo.samplers = g, this._eventInfo.uniformBuffersNames = _, this._eventInfo.customCode = void 0, this._eventInfo.mesh = e, this._eventInfo.indexParameters = v, this._callbackPluginEventGeneric(128, this._eventInfo), Fe.AddUniformsAndSamplers(h, g), Pe.AddUniforms(h), Pe.AddSamplers(g), oe(h), this._useVertexPulling) {
				let e = n?.geometry;
				e && (this._vertexPullingMetadata = Re(e), this._vertexPullingMetadata && this._vertexPullingMetadata.forEach((e, t) => {
					h.push(`vp_${t}_info`);
				}));
			} else this._vertexPullingMetadata = null;
			r && (r.PrepareUniforms(h, i), r.PrepareSamplers(g, i)), ye({
				uniformsNames: h,
				uniformBuffersNames: _,
				samplers: g,
				defines: i,
				maxSimultaneousLights: this._maxSimultaneousLights,
				shaderLanguage: this._shaderLanguage
			});
			let y = {};
			this.customShaderNameResolve && (m = this.customShaderNameResolve(m, h, _, g, i, p, y));
			let b = i.toString(), ee = u.createEffect(m, {
				attributes: p,
				uniformsNames: h,
				uniformBuffersNames: _,
				samplers: g,
				defines: b,
				fallbacks: d,
				onCompiled: o,
				onError: s,
				indexParameters: v,
				processFinalCode: y.processFinalCode,
				processCodeAfterIncludes: this._eventInfo.customCode,
				multiTarget: i.PREPASS,
				shaderLanguage: this._shaderLanguage,
				extraInitializationsAsync: t._ShaderLoader.getLoadCallback(this._shaderLanguage)
			}, u);
			return this._eventInfo.customCode = void 0, ee;
		}
		_prepareDefines(e, n, r, i = null, o = null) {
			let s = n.hasThinInstances, c = this.getScene(), l = c.getEngine();
			ke(c, e, r, !0, this._maxSimultaneousLights, this._disableLighting), r._needNormals = !0, Oe(c, r);
			let u = this.needAlphaBlendingForMesh(e) && this.getScene().useOrderIndependentTransparency;
			if (ae(c, r, this.canRenderToMRT && !u), ue(c, r, u), Fe.PrepareDefines(l.currentRenderPassId, e, r), r._areTexturesDirty) {
				r._needUVs = !1;
				for (let e = 1; e <= 6; ++e) r["MAINUV" + e] = !1;
				if (c.texturesEnabled) {
					for (let e in this._samplersList) {
						let t = this._samplersList[e];
						t.value ? (le(t.value, r, t.textureDefine), r[t.textureDefine + "_GAMMA"] = t.value.gammaSpace) : r[t.textureDefine] = !1;
					}
					let e = this._getRadianceTexture(), t = this._forceIrradianceInFragment || this.realTimeFiltering || this._twoSidedLighting || l.getCaps().maxVaryingVectors <= 8 || this._baseDiffuseRoughnessTexture != null;
					if (fe(c, e, r, this.realTimeFiltering, this.realTimeFilteringQuality, !t), this._baseMetalnessTexture && (r.AOSTOREINMETALMAPRED = this._useAmbientOcclusionFromMetallicTextureRed), r.SPECULAR_WEIGHT_IN_ALPHA = this._useSpecularWeightFromAlpha, r.SPECULAR_WEIGHT_FROM_SPECULAR_COLOR_TEXTURE = this._useSpecularWeightFromSpecularColorTexture, r.SPECULAR_ROUGHNESS_ANISOTROPY_FROM_TANGENT_TEXTURE = this._useSpecularRoughnessAnisotropyFromTangentTexture, r.COAT_ROUGHNESS_ANISOTROPY_FROM_TANGENT_TEXTURE = this._useCoatRoughnessAnisotropyFromTangentTexture, r.COAT_ROUGHNESS_FROM_GREEN_CHANNEL = this._useCoatRoughnessFromGreenChannel, r.SPECULAR_ROUGHNESS_FROM_METALNESS_TEXTURE_GREEN = this._useRoughnessFromMetallicTextureGreen, r.FUZZ_ROUGHNESS_FROM_TEXTURE_ALPHA = this._useFuzzRoughnessFromTextureAlpha, r.SUBSURFACE_WEIGHT_FROM_TEXTURE_ALPHA = this._useSubsurfaceWeightFromTextureAlpha, r.BASE_METALNESS_FROM_METALNESS_TEXTURE_BLUE = this._useMetallicFromMetallicTextureBlue, r.THIN_FILM_THICKNESS_FROM_THIN_FILM_TEXTURE = this._useThinFilmThicknessFromTextureGreen, r.GEOMETRY_THICKNESS_FROM_GREEN_CHANNEL = this._useGeometryThicknessFromGreenChannel, this.geometryNormalTexture ? (this._useParallax && this.baseColorTexture && T.DiffuseTextureEnabled ? (r.PARALLAX = !0, r.PARALLAX_RHS = c.useRightHandedSystem, r.PARALLAXOCCLUSION = !!this._useParallaxOcclusion) : r.PARALLAX = !1, r.OBJECTSPACE_NORMALMAP = this._useObjectSpaceNormalMap) : (r.PARALLAX = !1, r.PARALLAX_RHS = !1, r.PARALLAXOCCLUSION = !1, r.OBJECTSPACE_NORMALMAP = !1), this._environmentBRDFTexture && T.ReflectionTextureEnabled ? (r.ENVIRONMENTBRDF = !0, r.ENVIRONMENTBRDF_RGBD = this._environmentBRDFTexture.isRGBD) : (r.ENVIRONMENTBRDF = !1, r.ENVIRONMENTBRDF_RGBD = !1), r.FUZZENVIRONMENTBRDF = !!this._environmentFuzzBRDFTexture, this.hasTransparency) {
						r.REFRACTED_BACKGROUND = !!this._backgroundRefractionTexture && T.RefractionTextureEnabled, r.REFRACTION_HIGH_QUALITY_BLUR = this._refractionHighQualityBlur, r.REFRACTED_LIGHTS = !0;
						let e = this._getRadianceTexture();
						e ? (r.REFRACTED_ENVIRONMENT = T.RefractionTextureEnabled, r.REFRACTED_ENVIRONMENT_OPPOSITEZ = this.getScene().useRightHandedSystem ? !e.invertZ : e.invertZ, r.REFRACTED_ENVIRONMENT_LOCAL_CUBE = e.isCube && e.boundingBoxSize) : r.REFRACTED_ENVIRONMENT = !1;
					} else r.REFRACTED_BACKGROUND = !1, r.REFRACTED_LIGHTS = !1, r.REFRACTED_ENVIRONMENT = !1;
					r.ALPHA_FROM_BASE_COLOR_TEXTURE = !!this._shouldUseAlphaFromBaseColorTexture();
				}
				this._lightFalloff === E.LIGHTFALLOFF_STANDARD ? (r.USEPHYSICALLIGHTFALLOFF = !1, r.USEGLTFLIGHTFALLOFF = !1) : this._lightFalloff === E.LIGHTFALLOFF_GLTF ? (r.USEPHYSICALLIGHTFALLOFF = !1, r.USEGLTFLIGHTFALLOFF = !0) : (r.USEPHYSICALLIGHTFALLOFF = !0, r.USEGLTFLIGHTFALLOFF = !1), r.TWOSIDEDLIGHTING = !(this.backFaceCulling || !this._twoSidedLighting), r.MIRRORED = !!c._mirroredCameraPosition, r.SPECULARAA = l.getCaps().standardDerivatives && this._enableSpecularAntiAliasing;
			}
			if ((r._areTexturesDirty || r._areMiscDirty) && (r.ALPHATESTVALUE = `${this._alphaCutOff}${this._alphaCutOff % 1 == 0 ? "." : ""}`, r.PREMULTIPLYALPHA = this.alphaMode === 7 || this.alphaMode === 8, r.ALPHABLEND = this.needAlphaBlendingForMesh(e)), r._areTexturesDirty && (r.TEXTURE_REPETITION_MODE = l.version > 1 || l.isWebGPU ? this.textureRepetitionMode : 0), r._areImageProcessingDirty && this._imageProcessingConfiguration && this._imageProcessingConfiguration.prepareDefines(r), r.FORCENORMALFORWARD = this._forceNormalForward, r.RADIANCEOCCLUSION = this._useRadianceOcclusion, r.HORIZONOCCLUSION = this._useHorizonOcclusion, (this.specularRoughnessAnisotropy > 0 || this.coatRoughnessAnisotropy > 0) && t._noiseTextures[c.uniqueId] && T.ReflectionTextureEnabled ? (r.ANISOTROPIC = !0, e.isVerticesDataPresent(a.TangentKind) || (r._needUVs = !0, r.MAINUV1 = !0), this._useGltfStyleAnisotropy && (r.USE_GLTF_STYLE_ANISOTROPY = !0), r.ANISOTROPIC_BASE = this.specularRoughnessAnisotropy > 0, r.ANISOTROPIC_COAT = this.coatRoughnessAnisotropy > 0) : (r.ANISOTROPIC = !1, r.USE_GLTF_STYLE_ANISOTROPY = !1, r.ANISOTROPIC_BASE = !1, r.ANISOTROPIC_COAT = !1), r.THIN_FILM = this.thinFilmWeight > 0, r.IRIDESCENCE = this.thinFilmWeight > 0, r.DISPERSION = this.transmissionDispersionScale > 0, r.SCATTERING = this.hasScattering, r.SSS_SAMPLE_COUNT = [
				8,
				16,
				32
			][this._sssQuality] ?? 16, r.TRANSMISSION_SLAB = this.transmissionWeight > 0, r.TRANSMISSION_SLAB_VOLUME = this.transmissionWeight > 0 && this.transmissionDepth > 0, r.SUBSURFACE_SLAB = this.subsurfaceWeight > 0, !r.PREPASS && (r.SUBSURFACE_SLAB || r.TRANSMISSION_SLAB_VOLUME)) {
				let e = !1;
				if (!this.sssIrradianceTexture && c.geometryBufferRenderer) {
					let t = c.geometryBufferRenderer.getTextureIndex(G.IRRADIANCE_TEXTURE_TYPE);
					this.sssIrradianceTexture = c.geometryBufferRenderer.getGBuffer().textures[t], e = !0;
				}
				if (!this.sssDepthTexture && c.geometryBufferRenderer) {
					let t = c.geometryBufferRenderer.getTextureIndex(G.SCREENSPACE_DEPTH_TEXTURE_TYPE);
					this.sssDepthTexture = c.geometryBufferRenderer.getGBuffer().textures[t], e = !0;
				}
				this.sssIrradianceTexture && this.sssDepthTexture && (r.USE_IRRADIANCE_TEXTURE_FOR_SCATTERING = !0, e && (r.USE_IRRADIANCE_TEXTURE_FOR_SCATTERING_GBUFFER = !0));
			}
			r.FUZZ = this.fuzzWeight > 0 && T.ReflectionTextureEnabled, r.GEOMETRY_THIN_WALLED = this.geometryThinWalled != 0, r.FUZZ ? (e.isVerticesDataPresent(a.TangentKind) || (r._needUVs = !0, r.MAINUV1 = !0), this._environmentFuzzBRDFTexture = Be(this.getScene()), r.FUZZ_IBL_SAMPLES = this.fuzzSampleNumber) : (this._environmentFuzzBRDFTexture = null, r.FUZZENVIRONMENTBRDF = !1, r.FUZZ_IBL_SAMPLES = 0), r._areMiscDirty && (re(e, c, this._useLogarithmicDepth, this.pointsCloud, this.fogEnabled, this.needAlphaTestingForMesh(e), r, this._applyDecalMapAfterDetailMap, this._useVertexPulling, n, this._isVertexOutputInvariant), r.UNLIT = this._unlit || (this.pointsCloud || this.wireframe) && !e.isVerticesDataPresent(a.NormalKind), r.DEBUGMODE = this._debugMode), Ae(c, l, this, r, !!i, o, s), this._eventInfo.defines = r, this._eventInfo.mesh = e, this._callbackPluginEventPrepareDefinesBeforeAttributes(this._eventInfo), De(e, r, !0, !0, !0, this._transparencyMode !== E.MATERIAL_OPAQUE), this._callbackPluginEventPrepareDefines(this._eventInfo);
		}
	}, n = /* @__PURE__ */ new WeakMap(), i = /* @__PURE__ */ new WeakMap(), o = /* @__PURE__ */ new WeakMap(), u = /* @__PURE__ */ new WeakMap(), f = /* @__PURE__ */ new WeakMap(), p = /* @__PURE__ */ new WeakMap(), x = /* @__PURE__ */ new WeakMap(), S = /* @__PURE__ */ new WeakMap(), C = /* @__PURE__ */ new WeakMap(), w = /* @__PURE__ */ new WeakMap(), D = /* @__PURE__ */ new WeakMap(), Ne = /* @__PURE__ */ new WeakMap(), Le = /* @__PURE__ */ new WeakMap(), O = /* @__PURE__ */ new WeakMap(), k = /* @__PURE__ */ new WeakMap(), A = /* @__PURE__ */ new WeakMap(), j = /* @__PURE__ */ new WeakMap(), M = /* @__PURE__ */ new WeakMap(), N = /* @__PURE__ */ new WeakMap(), P = /* @__PURE__ */ new WeakMap(), F = /* @__PURE__ */ new WeakMap(), I = /* @__PURE__ */ new WeakMap(), L = /* @__PURE__ */ new WeakMap(), R = /* @__PURE__ */ new WeakMap(), z = /* @__PURE__ */ new WeakMap(), B = /* @__PURE__ */ new WeakMap(), V = /* @__PURE__ */ new WeakMap(), H = /* @__PURE__ */ new WeakMap(), U = /* @__PURE__ */ new WeakMap(), W = /* @__PURE__ */ new WeakMap(), q = /* @__PURE__ */ new WeakMap(), X = /* @__PURE__ */ new WeakMap(), Z = /* @__PURE__ */ new WeakMap(), Q = /* @__PURE__ */ new WeakMap(), $ = /* @__PURE__ */ new WeakMap(), Ge = /* @__PURE__ */ new WeakMap(), Ke = /* @__PURE__ */ new WeakMap(), qe = /* @__PURE__ */ new WeakMap(), Je = /* @__PURE__ */ new WeakMap(), Ye = /* @__PURE__ */ new WeakMap(), Xe = /* @__PURE__ */ new WeakMap(), Ze = /* @__PURE__ */ new WeakMap(), Qe = /* @__PURE__ */ new WeakMap(), $e = /* @__PURE__ */ new WeakMap(), et = /* @__PURE__ */ new WeakMap(), tt = /* @__PURE__ */ new WeakMap(), nt = /* @__PURE__ */ new WeakMap(), rt = /* @__PURE__ */ new WeakMap(), it = /* @__PURE__ */ new WeakMap(), at = /* @__PURE__ */ new WeakMap(), ot = /* @__PURE__ */ new WeakMap(), st = /* @__PURE__ */ new WeakMap(), ct = /* @__PURE__ */ new WeakMap(), lt = /* @__PURE__ */ new WeakMap(), ut = /* @__PURE__ */ new WeakMap(), dt = /* @__PURE__ */ new WeakMap(), ft = /* @__PURE__ */ new WeakMap(), pt = /* @__PURE__ */ new WeakMap(), mt = /* @__PURE__ */ new WeakMap(), ht = /* @__PURE__ */ new WeakMap(), gt = /* @__PURE__ */ new WeakMap(), _t = /* @__PURE__ */ new WeakMap(), vt = /* @__PURE__ */ new WeakMap(), yt = /* @__PURE__ */ new WeakMap(), bt = /* @__PURE__ */ new WeakMap(), xt = /* @__PURE__ */ new WeakMap(), St = /* @__PURE__ */ new WeakMap(), Ct = /* @__PURE__ */ new WeakMap(), wt = /* @__PURE__ */ new WeakMap(), Tt = /* @__PURE__ */ new WeakMap(), Et = /* @__PURE__ */ new WeakMap(), Dt = /* @__PURE__ */ new WeakMap(), Ot = /* @__PURE__ */ new WeakMap(), kt = /* @__PURE__ */ new WeakMap(), At = /* @__PURE__ */ new WeakMap(), jt = /* @__PURE__ */ new WeakMap(), Mt = /* @__PURE__ */ new WeakMap(), Nt = /* @__PURE__ */ new WeakMap(), Pt = /* @__PURE__ */ new WeakMap(), Ft = /* @__PURE__ */ new WeakMap(), It = /* @__PURE__ */ new WeakMap(), Lt = /* @__PURE__ */ new WeakMap(), Rt = /* @__PURE__ */ new WeakMap(), zt = /* @__PURE__ */ new WeakMap(), Bt = /* @__PURE__ */ new WeakMap(), Vt = /* @__PURE__ */ new WeakMap(), Ht = /* @__PURE__ */ new WeakMap(), Ut = /* @__PURE__ */ new WeakMap(), Wt = /* @__PURE__ */ new WeakMap(), Gt = /* @__PURE__ */ new WeakMap(), Kt = /* @__PURE__ */ new WeakMap(), qt = /* @__PURE__ */ new WeakMap(), Jt = /* @__PURE__ */ new WeakMap(), Yt = /* @__PURE__ */ new WeakMap(), Xt = /* @__PURE__ */ new WeakMap(), Zt = /* @__PURE__ */ new WeakMap(), Qt = /* @__PURE__ */ new WeakMap(), $t = /* @__PURE__ */ new WeakMap(), en = /* @__PURE__ */ new WeakMap(), tn = /* @__PURE__ */ new WeakMap(), nn = /* @__PURE__ */ new WeakMap(), rn = /* @__PURE__ */ new WeakMap(), (() => {
		let e = typeof Symbol == "function" && Symbol.metadata ? Object.create(an[Symbol.metadata] ?? null) : void 0;
		sn = [v("_markAllSubMeshesAsTexturesDirty")], un = [v("_markAllSubMeshesAsTexturesDirty")], pn = [v("_markAllSubMeshesAsTexturesDirty")], gn = [v("_markAllSubMeshesAsTexturesDirty")], yn = [v("_markAllSubMeshesAsTexturesDirty")], Sn = [v("_markAllSubMeshesAsTexturesDirty")], Tn = [v("_markAllSubMeshesAsTexturesDirty")], On = [v("_markAllSubMeshesAsTexturesDirty")], jn = [v("_markAllSubMeshesAsTexturesDirty")], Pn = [v("_markAllSubMeshesAsTexturesDirty")], Ln = [v("_markAllSubMeshesAsTexturesDirty")], Bn = [v("_markAllSubMeshesAsTexturesDirty")], Un = [v("_markAllSubMeshesAsTexturesDirty")], Kn = [v("_markAllSubMeshesAsTexturesDirty")], Yn = [v("_markAllSubMeshesAsTexturesDirty")], Qn = [v("_markAllSubMeshesAsTexturesDirty")], tr = [v("_markAllSubMeshesAsTexturesDirty")], ir = [v("_markAllSubMeshesAsTexturesDirty")], sr = [v("_markAllSubMeshesAsTexturesDirty")], ur = [v("_markAllSubMeshesAsTexturesDirty")], pr = [v("_markAllSubMeshesAsTexturesDirty")], gr = [v("_markAllSubMeshesAsTexturesDirty")], yr = [v("_markAllSubMeshesAsTexturesDirty")], Sr = [v("_markAllSubMeshesAsTexturesDirty")], Tr = [v("_markAllSubMeshesAsTexturesDirty")], Or = [v("_markAllSubMeshesAsTexturesDirty")], jr = [v("_markAllSubMeshesAsTexturesDirty")], Pr = [v("_markAllSubMeshesAsTexturesDirty")], Lr = [v("_markAllSubMeshesAsTexturesDirty")], Br = [v("_markAllSubMeshesAsTexturesDirty")], Ur = [v("_markAllSubMeshesAsTexturesDirty")], Kr = [v("_markAllSubMeshesAsTexturesDirty")], Yr = [v("_markAllSubMeshesAsTexturesDirty")], Qr = [v("_markAllSubMeshesAsTexturesDirty")], ti = [v("_markAllSubMeshesAsTexturesDirty")], ii = [v("_markAllSubMeshesAsTexturesDirty")], si = [v("_markAllSubMeshesAsTexturesDirty")], ui = [v("_markAllSubMeshesAsTexturesDirty")], pi = [v("_markAllSubMeshesAsTexturesDirty")], gi = [v("_markAllSubMeshesAsTexturesDirty")], yi = [v("_markAllSubMeshesAsTexturesDirty")], Si = [v("_markAllSubMeshesAsTexturesDirty")], Ti = [v("_markAllSubMeshesAsTexturesDirty")], Oi = [v("_markAllSubMeshesAsTexturesDirty")], ji = [v("_markAllSubMeshesAsTexturesDirty")], Pi = [v("_markAllSubMeshesAsTexturesDirty")], Li = [v("_markAllSubMeshesAsTexturesDirty")], Bi = [v("_markAllSubMeshesAsTexturesDirty")], Ui = [v("_markAllSubMeshesAsTexturesDirty")], Ki = [v("_markAllSubMeshesAsTexturesDirty")], Yi = [v("_markAllSubMeshesAsTexturesDirty")], Qi = [v("_markAllSubMeshesAsTexturesDirty")], ta = [v("_markAllSubMeshesAsTexturesDirty")], ia = [v("_markAllSubMeshesAsTexturesDirty")], sa = [v("_markAllSubMeshesAsTexturesDirty")], ua = [v("_markAllSubMeshesAsTexturesDirty")], pa = [v("_markAllSubMeshesAsTexturesDirty")], ga = [v("_markAllSubMeshesAsTexturesDirty")], ya = [v("_markAllSubMeshesAsTexturesDirty")], Sa = [v("_markAllSubMeshesAsTexturesDirty")], Ta = [v("_markAllSubMeshesAsTexturesDirty")], Oa = [v("_markAllSubMeshesAsTexturesDirty")], ja = [v("_markAllSubMeshesAsTexturesDirty")], Pa = [v("_markAllSubMeshesAsTexturesDirty")], La = [v("_markAllSubMeshesAsTexturesDirty")], Ba = [v("_markAllSubMeshesAsTexturesDirty")], Ua = [v("_markAllSubMeshesAsTexturesDirty")], Ka = [v("_markAllSubMeshesAsTexturesDirty")], Ya = [v("_markAllSubMeshesAsTexturesDirty")], Qa = [v("_markAllSubMeshesAsTexturesDirty")], to = [v("_markAllSubMeshesAsTexturesDirty")], io = [v("_markAllSubMeshesAsTexturesDirty")], so = [v("_markAllSubMeshesAsTexturesDirty")], uo = [v("_markAllSubMeshesAsTexturesDirty")], mo = [v("_markAllSubMeshesAsTexturesDirty")], _o = [g(), _("_markAllSubMeshesAsTexturesDirty")], bo = [g(), _("_markAllSubMeshesAsTexturesDirty")], Co = [g(), _("_markAllSubMeshesAsTexturesDirty")], Eo = [g(), _("_markAllSubMeshesAsTexturesAndMiscDirty")], ko = [g(), _("_markAllSubMeshesAsTexturesAndMiscDirty")], Mo = [g(), _("_markAllSubMeshesAsTexturesDirty")], Fo = [g(), _("_markAllSubMeshesAsTexturesDirty")], Ro = [g()], zo = [g()], Bo = [g(), _("_markAllSubMeshesAsTexturesDirty")], Uo = [g(), _("_markAllSubMeshesAsTexturesDirty")], Ko = [g(), _("_markAllSubMeshesAsTexturesDirty")], Yo = [g(), _("_markAllSubMeshesAsTexturesDirty")], Qo = [g(), _("_markAllSubMeshesAsLightsDirty")], ts = [g(), _("_markAllSubMeshesAsTexturesDirty")], is = [g(), _("_markAllSubMeshesAsLightsDirty")], ss = [g(), _("_markAllSubMeshesAsTexturesDirty")], us = [g(), _("_markAllSubMeshesAsTexturesDirty")], ps = [g(), _("_markAllSubMeshesAsTexturesDirty")], gs = [g(), _("_markAllSubMeshesAsTexturesDirty")], ys = [g(), _("_markAllSubMeshesAsTexturesDirty")], Ss = [_("_markAllSubMeshesAsTexturesDirty")], Ts = [g(), _("_markAllSubMeshesAsTexturesDirty")], Os = [g(), _("_markAllSubMeshesAsTexturesDirty")], js = [g(), _("_markAllSubMeshesAsTexturesDirty")], Ps = [g(), _("_markAllSubMeshesAsTexturesDirty")], Ls = [g(), _("_markAllSubMeshesAsMiscDirty")], Bs = [g(), _("_markAllSubMeshesAsMiscDirty")], Us = [_("_markAllSubMeshesAsMiscDirty")], Ks = [g()], b(t, null, sn, {
			kind: "accessor",
			name: "baseWeight",
			static: !1,
			private: !1,
			access: {
				has: (e) => "baseWeight" in e,
				get: (e) => e.baseWeight,
				set: (e, t) => {
					e.baseWeight = t;
				}
			},
			metadata: e
		}, cn, ln), b(t, null, un, {
			kind: "accessor",
			name: "baseWeightTexture",
			static: !1,
			private: !1,
			access: {
				has: (e) => "baseWeightTexture" in e,
				get: (e) => e.baseWeightTexture,
				set: (e, t) => {
					e.baseWeightTexture = t;
				}
			},
			metadata: e
		}, dn, fn), b(t, null, pn, {
			kind: "accessor",
			name: "baseColor",
			static: !1,
			private: !1,
			access: {
				has: (e) => "baseColor" in e,
				get: (e) => e.baseColor,
				set: (e, t) => {
					e.baseColor = t;
				}
			},
			metadata: e
		}, mn, hn), b(t, null, gn, {
			kind: "accessor",
			name: "baseColorTexture",
			static: !1,
			private: !1,
			access: {
				has: (e) => "baseColorTexture" in e,
				get: (e) => e.baseColorTexture,
				set: (e, t) => {
					e.baseColorTexture = t;
				}
			},
			metadata: e
		}, _n, vn), b(t, null, yn, {
			kind: "accessor",
			name: "baseDiffuseRoughness",
			static: !1,
			private: !1,
			access: {
				has: (e) => "baseDiffuseRoughness" in e,
				get: (e) => e.baseDiffuseRoughness,
				set: (e, t) => {
					e.baseDiffuseRoughness = t;
				}
			},
			metadata: e
		}, bn, xn), b(t, null, Sn, {
			kind: "accessor",
			name: "baseDiffuseRoughnessTexture",
			static: !1,
			private: !1,
			access: {
				has: (e) => "baseDiffuseRoughnessTexture" in e,
				get: (e) => e.baseDiffuseRoughnessTexture,
				set: (e, t) => {
					e.baseDiffuseRoughnessTexture = t;
				}
			},
			metadata: e
		}, Cn, wn), b(t, null, Tn, {
			kind: "accessor",
			name: "baseMetalness",
			static: !1,
			private: !1,
			access: {
				has: (e) => "baseMetalness" in e,
				get: (e) => e.baseMetalness,
				set: (e, t) => {
					e.baseMetalness = t;
				}
			},
			metadata: e
		}, En, Dn), b(t, null, On, {
			kind: "accessor",
			name: "baseMetalnessTexture",
			static: !1,
			private: !1,
			access: {
				has: (e) => "baseMetalnessTexture" in e,
				get: (e) => e.baseMetalnessTexture,
				set: (e, t) => {
					e.baseMetalnessTexture = t;
				}
			},
			metadata: e
		}, kn, An), b(t, null, jn, {
			kind: "accessor",
			name: "specularWeight",
			static: !1,
			private: !1,
			access: {
				has: (e) => "specularWeight" in e,
				get: (e) => e.specularWeight,
				set: (e, t) => {
					e.specularWeight = t;
				}
			},
			metadata: e
		}, Mn, Nn), b(t, null, Pn, {
			kind: "accessor",
			name: "specularWeightTexture",
			static: !1,
			private: !1,
			access: {
				has: (e) => "specularWeightTexture" in e,
				get: (e) => e.specularWeightTexture,
				set: (e, t) => {
					e.specularWeightTexture = t;
				}
			},
			metadata: e
		}, Fn, In), b(t, null, Ln, {
			kind: "accessor",
			name: "specularColor",
			static: !1,
			private: !1,
			access: {
				has: (e) => "specularColor" in e,
				get: (e) => e.specularColor,
				set: (e, t) => {
					e.specularColor = t;
				}
			},
			metadata: e
		}, Rn, zn), b(t, null, Bn, {
			kind: "accessor",
			name: "specularColorTexture",
			static: !1,
			private: !1,
			access: {
				has: (e) => "specularColorTexture" in e,
				get: (e) => e.specularColorTexture,
				set: (e, t) => {
					e.specularColorTexture = t;
				}
			},
			metadata: e
		}, Vn, Hn), b(t, null, Un, {
			kind: "accessor",
			name: "specularRoughness",
			static: !1,
			private: !1,
			access: {
				has: (e) => "specularRoughness" in e,
				get: (e) => e.specularRoughness,
				set: (e, t) => {
					e.specularRoughness = t;
				}
			},
			metadata: e
		}, Wn, Gn), b(t, null, Kn, {
			kind: "accessor",
			name: "specularRoughnessTexture",
			static: !1,
			private: !1,
			access: {
				has: (e) => "specularRoughnessTexture" in e,
				get: (e) => e.specularRoughnessTexture,
				set: (e, t) => {
					e.specularRoughnessTexture = t;
				}
			},
			metadata: e
		}, qn, Jn), b(t, null, Yn, {
			kind: "accessor",
			name: "specularRoughnessAnisotropy",
			static: !1,
			private: !1,
			access: {
				has: (e) => "specularRoughnessAnisotropy" in e,
				get: (e) => e.specularRoughnessAnisotropy,
				set: (e, t) => {
					e.specularRoughnessAnisotropy = t;
				}
			},
			metadata: e
		}, Xn, Zn), b(t, null, Qn, {
			kind: "accessor",
			name: "specularRoughnessAnisotropyTexture",
			static: !1,
			private: !1,
			access: {
				has: (e) => "specularRoughnessAnisotropyTexture" in e,
				get: (e) => e.specularRoughnessAnisotropyTexture,
				set: (e, t) => {
					e.specularRoughnessAnisotropyTexture = t;
				}
			},
			metadata: e
		}, $n, er), b(t, null, tr, {
			kind: "accessor",
			name: "specularIor",
			static: !1,
			private: !1,
			access: {
				has: (e) => "specularIor" in e,
				get: (e) => e.specularIor,
				set: (e, t) => {
					e.specularIor = t;
				}
			},
			metadata: e
		}, nr, rr), b(t, null, ir, {
			kind: "accessor",
			name: "transmissionWeight",
			static: !1,
			private: !1,
			access: {
				has: (e) => "transmissionWeight" in e,
				get: (e) => e.transmissionWeight,
				set: (e, t) => {
					e.transmissionWeight = t;
				}
			},
			metadata: e
		}, ar, or), b(t, null, sr, {
			kind: "accessor",
			name: "transmissionWeightTexture",
			static: !1,
			private: !1,
			access: {
				has: (e) => "transmissionWeightTexture" in e,
				get: (e) => e.transmissionWeightTexture,
				set: (e, t) => {
					e.transmissionWeightTexture = t;
				}
			},
			metadata: e
		}, cr, lr), b(t, null, ur, {
			kind: "accessor",
			name: "transmissionColor",
			static: !1,
			private: !1,
			access: {
				has: (e) => "transmissionColor" in e,
				get: (e) => e.transmissionColor,
				set: (e, t) => {
					e.transmissionColor = t;
				}
			},
			metadata: e
		}, dr, fr), b(t, null, pr, {
			kind: "accessor",
			name: "transmissionColorTexture",
			static: !1,
			private: !1,
			access: {
				has: (e) => "transmissionColorTexture" in e,
				get: (e) => e.transmissionColorTexture,
				set: (e, t) => {
					e.transmissionColorTexture = t;
				}
			},
			metadata: e
		}, mr, hr), b(t, null, gr, {
			kind: "accessor",
			name: "transmissionDepth",
			static: !1,
			private: !1,
			access: {
				has: (e) => "transmissionDepth" in e,
				get: (e) => e.transmissionDepth,
				set: (e, t) => {
					e.transmissionDepth = t;
				}
			},
			metadata: e
		}, _r, vr), b(t, null, yr, {
			kind: "accessor",
			name: "transmissionDepthTexture",
			static: !1,
			private: !1,
			access: {
				has: (e) => "transmissionDepthTexture" in e,
				get: (e) => e.transmissionDepthTexture,
				set: (e, t) => {
					e.transmissionDepthTexture = t;
				}
			},
			metadata: e
		}, br, xr), b(t, null, Sr, {
			kind: "accessor",
			name: "transmissionScatter",
			static: !1,
			private: !1,
			access: {
				has: (e) => "transmissionScatter" in e,
				get: (e) => e.transmissionScatter,
				set: (e, t) => {
					e.transmissionScatter = t;
				}
			},
			metadata: e
		}, Cr, wr), b(t, null, Tr, {
			kind: "accessor",
			name: "transmissionScatterTexture",
			static: !1,
			private: !1,
			access: {
				has: (e) => "transmissionScatterTexture" in e,
				get: (e) => e.transmissionScatterTexture,
				set: (e, t) => {
					e.transmissionScatterTexture = t;
				}
			},
			metadata: e
		}, Er, Dr), b(t, null, Or, {
			kind: "accessor",
			name: "transmissionScatterAnisotropy",
			static: !1,
			private: !1,
			access: {
				has: (e) => "transmissionScatterAnisotropy" in e,
				get: (e) => e.transmissionScatterAnisotropy,
				set: (e, t) => {
					e.transmissionScatterAnisotropy = t;
				}
			},
			metadata: e
		}, kr, Ar), b(t, null, jr, {
			kind: "accessor",
			name: "transmissionDispersionScale",
			static: !1,
			private: !1,
			access: {
				has: (e) => "transmissionDispersionScale" in e,
				get: (e) => e.transmissionDispersionScale,
				set: (e, t) => {
					e.transmissionDispersionScale = t;
				}
			},
			metadata: e
		}, Mr, Nr), b(t, null, Pr, {
			kind: "accessor",
			name: "transmissionDispersionScaleTexture",
			static: !1,
			private: !1,
			access: {
				has: (e) => "transmissionDispersionScaleTexture" in e,
				get: (e) => e.transmissionDispersionScaleTexture,
				set: (e, t) => {
					e.transmissionDispersionScaleTexture = t;
				}
			},
			metadata: e
		}, Fr, Ir), b(t, null, Lr, {
			kind: "accessor",
			name: "transmissionDispersionAbbeNumber",
			static: !1,
			private: !1,
			access: {
				has: (e) => "transmissionDispersionAbbeNumber" in e,
				get: (e) => e.transmissionDispersionAbbeNumber,
				set: (e, t) => {
					e.transmissionDispersionAbbeNumber = t;
				}
			},
			metadata: e
		}, Rr, zr), b(t, null, Br, {
			kind: "accessor",
			name: "subsurfaceWeight",
			static: !1,
			private: !1,
			access: {
				has: (e) => "subsurfaceWeight" in e,
				get: (e) => e.subsurfaceWeight,
				set: (e, t) => {
					e.subsurfaceWeight = t;
				}
			},
			metadata: e
		}, Vr, Hr), b(t, null, Ur, {
			kind: "accessor",
			name: "subsurfaceWeightTexture",
			static: !1,
			private: !1,
			access: {
				has: (e) => "subsurfaceWeightTexture" in e,
				get: (e) => e.subsurfaceWeightTexture,
				set: (e, t) => {
					e.subsurfaceWeightTexture = t;
				}
			},
			metadata: e
		}, Wr, Gr), b(t, null, Kr, {
			kind: "accessor",
			name: "subsurfaceColor",
			static: !1,
			private: !1,
			access: {
				has: (e) => "subsurfaceColor" in e,
				get: (e) => e.subsurfaceColor,
				set: (e, t) => {
					e.subsurfaceColor = t;
				}
			},
			metadata: e
		}, qr, Jr), b(t, null, Yr, {
			kind: "accessor",
			name: "subsurfaceColorTexture",
			static: !1,
			private: !1,
			access: {
				has: (e) => "subsurfaceColorTexture" in e,
				get: (e) => e.subsurfaceColorTexture,
				set: (e, t) => {
					e.subsurfaceColorTexture = t;
				}
			},
			metadata: e
		}, Xr, Zr), b(t, null, Qr, {
			kind: "accessor",
			name: "subsurfaceRadius",
			static: !1,
			private: !1,
			access: {
				has: (e) => "subsurfaceRadius" in e,
				get: (e) => e.subsurfaceRadius,
				set: (e, t) => {
					e.subsurfaceRadius = t;
				}
			},
			metadata: e
		}, $r, ei), b(t, null, ti, {
			kind: "accessor",
			name: "subsurfaceRadiusScale",
			static: !1,
			private: !1,
			access: {
				has: (e) => "subsurfaceRadiusScale" in e,
				get: (e) => e.subsurfaceRadiusScale,
				set: (e, t) => {
					e.subsurfaceRadiusScale = t;
				}
			},
			metadata: e
		}, ni, ri), b(t, null, ii, {
			kind: "accessor",
			name: "subsurfaceRadiusScaleTexture",
			static: !1,
			private: !1,
			access: {
				has: (e) => "subsurfaceRadiusScaleTexture" in e,
				get: (e) => e.subsurfaceRadiusScaleTexture,
				set: (e, t) => {
					e.subsurfaceRadiusScaleTexture = t;
				}
			},
			metadata: e
		}, ai, oi), b(t, null, si, {
			kind: "accessor",
			name: "subsurfaceScatterAnisotropy",
			static: !1,
			private: !1,
			access: {
				has: (e) => "subsurfaceScatterAnisotropy" in e,
				get: (e) => e.subsurfaceScatterAnisotropy,
				set: (e, t) => {
					e.subsurfaceScatterAnisotropy = t;
				}
			},
			metadata: e
		}, ci, li), b(t, null, ui, {
			kind: "accessor",
			name: "coatWeight",
			static: !1,
			private: !1,
			access: {
				has: (e) => "coatWeight" in e,
				get: (e) => e.coatWeight,
				set: (e, t) => {
					e.coatWeight = t;
				}
			},
			metadata: e
		}, di, fi), b(t, null, pi, {
			kind: "accessor",
			name: "coatWeightTexture",
			static: !1,
			private: !1,
			access: {
				has: (e) => "coatWeightTexture" in e,
				get: (e) => e.coatWeightTexture,
				set: (e, t) => {
					e.coatWeightTexture = t;
				}
			},
			metadata: e
		}, mi, hi), b(t, null, gi, {
			kind: "accessor",
			name: "coatColor",
			static: !1,
			private: !1,
			access: {
				has: (e) => "coatColor" in e,
				get: (e) => e.coatColor,
				set: (e, t) => {
					e.coatColor = t;
				}
			},
			metadata: e
		}, _i, vi), b(t, null, yi, {
			kind: "accessor",
			name: "coatColorTexture",
			static: !1,
			private: !1,
			access: {
				has: (e) => "coatColorTexture" in e,
				get: (e) => e.coatColorTexture,
				set: (e, t) => {
					e.coatColorTexture = t;
				}
			},
			metadata: e
		}, bi, xi), b(t, null, Si, {
			kind: "accessor",
			name: "coatRoughness",
			static: !1,
			private: !1,
			access: {
				has: (e) => "coatRoughness" in e,
				get: (e) => e.coatRoughness,
				set: (e, t) => {
					e.coatRoughness = t;
				}
			},
			metadata: e
		}, Ci, wi), b(t, null, Ti, {
			kind: "accessor",
			name: "coatRoughnessTexture",
			static: !1,
			private: !1,
			access: {
				has: (e) => "coatRoughnessTexture" in e,
				get: (e) => e.coatRoughnessTexture,
				set: (e, t) => {
					e.coatRoughnessTexture = t;
				}
			},
			metadata: e
		}, Ei, Di), b(t, null, Oi, {
			kind: "accessor",
			name: "coatRoughnessAnisotropy",
			static: !1,
			private: !1,
			access: {
				has: (e) => "coatRoughnessAnisotropy" in e,
				get: (e) => e.coatRoughnessAnisotropy,
				set: (e, t) => {
					e.coatRoughnessAnisotropy = t;
				}
			},
			metadata: e
		}, ki, Ai), b(t, null, ji, {
			kind: "accessor",
			name: "coatRoughnessAnisotropyTexture",
			static: !1,
			private: !1,
			access: {
				has: (e) => "coatRoughnessAnisotropyTexture" in e,
				get: (e) => e.coatRoughnessAnisotropyTexture,
				set: (e, t) => {
					e.coatRoughnessAnisotropyTexture = t;
				}
			},
			metadata: e
		}, Mi, Ni), b(t, null, Pi, {
			kind: "accessor",
			name: "coatIor",
			static: !1,
			private: !1,
			access: {
				has: (e) => "coatIor" in e,
				get: (e) => e.coatIor,
				set: (e, t) => {
					e.coatIor = t;
				}
			},
			metadata: e
		}, Fi, Ii), b(t, null, Li, {
			kind: "accessor",
			name: "coatDarkening",
			static: !1,
			private: !1,
			access: {
				has: (e) => "coatDarkening" in e,
				get: (e) => e.coatDarkening,
				set: (e, t) => {
					e.coatDarkening = t;
				}
			},
			metadata: e
		}, Ri, zi), b(t, null, Bi, {
			kind: "accessor",
			name: "coatDarkeningTexture",
			static: !1,
			private: !1,
			access: {
				has: (e) => "coatDarkeningTexture" in e,
				get: (e) => e.coatDarkeningTexture,
				set: (e, t) => {
					e.coatDarkeningTexture = t;
				}
			},
			metadata: e
		}, Vi, Hi), b(t, null, Ui, {
			kind: "accessor",
			name: "fuzzWeight",
			static: !1,
			private: !1,
			access: {
				has: (e) => "fuzzWeight" in e,
				get: (e) => e.fuzzWeight,
				set: (e, t) => {
					e.fuzzWeight = t;
				}
			},
			metadata: e
		}, Wi, Gi), b(t, null, Ki, {
			kind: "accessor",
			name: "fuzzWeightTexture",
			static: !1,
			private: !1,
			access: {
				has: (e) => "fuzzWeightTexture" in e,
				get: (e) => e.fuzzWeightTexture,
				set: (e, t) => {
					e.fuzzWeightTexture = t;
				}
			},
			metadata: e
		}, qi, Ji), b(t, null, Yi, {
			kind: "accessor",
			name: "fuzzColor",
			static: !1,
			private: !1,
			access: {
				has: (e) => "fuzzColor" in e,
				get: (e) => e.fuzzColor,
				set: (e, t) => {
					e.fuzzColor = t;
				}
			},
			metadata: e
		}, Xi, Zi), b(t, null, Qi, {
			kind: "accessor",
			name: "fuzzColorTexture",
			static: !1,
			private: !1,
			access: {
				has: (e) => "fuzzColorTexture" in e,
				get: (e) => e.fuzzColorTexture,
				set: (e, t) => {
					e.fuzzColorTexture = t;
				}
			},
			metadata: e
		}, $i, ea), b(t, null, ta, {
			kind: "accessor",
			name: "fuzzRoughness",
			static: !1,
			private: !1,
			access: {
				has: (e) => "fuzzRoughness" in e,
				get: (e) => e.fuzzRoughness,
				set: (e, t) => {
					e.fuzzRoughness = t;
				}
			},
			metadata: e
		}, na, ra), b(t, null, ia, {
			kind: "accessor",
			name: "fuzzRoughnessTexture",
			static: !1,
			private: !1,
			access: {
				has: (e) => "fuzzRoughnessTexture" in e,
				get: (e) => e.fuzzRoughnessTexture,
				set: (e, t) => {
					e.fuzzRoughnessTexture = t;
				}
			},
			metadata: e
		}, aa, oa), b(t, null, sa, {
			kind: "accessor",
			name: "geometryThinWalled",
			static: !1,
			private: !1,
			access: {
				has: (e) => "geometryThinWalled" in e,
				get: (e) => e.geometryThinWalled,
				set: (e, t) => {
					e.geometryThinWalled = t;
				}
			},
			metadata: e
		}, ca, la), b(t, null, ua, {
			kind: "accessor",
			name: "geometryNormalTexture",
			static: !1,
			private: !1,
			access: {
				has: (e) => "geometryNormalTexture" in e,
				get: (e) => e.geometryNormalTexture,
				set: (e, t) => {
					e.geometryNormalTexture = t;
				}
			},
			metadata: e
		}, da, fa), b(t, null, pa, {
			kind: "accessor",
			name: "geometryTangent",
			static: !1,
			private: !1,
			access: {
				has: (e) => "geometryTangent" in e,
				get: (e) => e.geometryTangent,
				set: (e, t) => {
					e.geometryTangent = t;
				}
			},
			metadata: e
		}, ma, ha), b(t, null, ga, {
			kind: "accessor",
			name: "geometryTangentTexture",
			static: !1,
			private: !1,
			access: {
				has: (e) => "geometryTangentTexture" in e,
				get: (e) => e.geometryTangentTexture,
				set: (e, t) => {
					e.geometryTangentTexture = t;
				}
			},
			metadata: e
		}, _a, va), b(t, null, ya, {
			kind: "accessor",
			name: "geometryCoatNormalTexture",
			static: !1,
			private: !1,
			access: {
				has: (e) => "geometryCoatNormalTexture" in e,
				get: (e) => e.geometryCoatNormalTexture,
				set: (e, t) => {
					e.geometryCoatNormalTexture = t;
				}
			},
			metadata: e
		}, ba, xa), b(t, null, Sa, {
			kind: "accessor",
			name: "geometryCoatTangent",
			static: !1,
			private: !1,
			access: {
				has: (e) => "geometryCoatTangent" in e,
				get: (e) => e.geometryCoatTangent,
				set: (e, t) => {
					e.geometryCoatTangent = t;
				}
			},
			metadata: e
		}, Ca, wa), b(t, null, Ta, {
			kind: "accessor",
			name: "geometryCoatTangentTexture",
			static: !1,
			private: !1,
			access: {
				has: (e) => "geometryCoatTangentTexture" in e,
				get: (e) => e.geometryCoatTangentTexture,
				set: (e, t) => {
					e.geometryCoatTangentTexture = t;
				}
			},
			metadata: e
		}, Ea, Da), b(t, null, Oa, {
			kind: "accessor",
			name: "geometryOpacity",
			static: !1,
			private: !1,
			access: {
				has: (e) => "geometryOpacity" in e,
				get: (e) => e.geometryOpacity,
				set: (e, t) => {
					e.geometryOpacity = t;
				}
			},
			metadata: e
		}, ka, Aa), b(t, null, ja, {
			kind: "accessor",
			name: "geometryOpacityTexture",
			static: !1,
			private: !1,
			access: {
				has: (e) => "geometryOpacityTexture" in e,
				get: (e) => e.geometryOpacityTexture,
				set: (e, t) => {
					e.geometryOpacityTexture = t;
				}
			},
			metadata: e
		}, Ma, Na), b(t, null, Pa, {
			kind: "accessor",
			name: "geometryThickness",
			static: !1,
			private: !1,
			access: {
				has: (e) => "geometryThickness" in e,
				get: (e) => e.geometryThickness,
				set: (e, t) => {
					e.geometryThickness = t;
				}
			},
			metadata: e
		}, Fa, Ia), b(t, null, La, {
			kind: "accessor",
			name: "geometryThicknessTexture",
			static: !1,
			private: !1,
			access: {
				has: (e) => "geometryThicknessTexture" in e,
				get: (e) => e.geometryThicknessTexture,
				set: (e, t) => {
					e.geometryThicknessTexture = t;
				}
			},
			metadata: e
		}, Ra, za), b(t, null, Ba, {
			kind: "accessor",
			name: "emissionLuminance",
			static: !1,
			private: !1,
			access: {
				has: (e) => "emissionLuminance" in e,
				get: (e) => e.emissionLuminance,
				set: (e, t) => {
					e.emissionLuminance = t;
				}
			},
			metadata: e
		}, Va, Ha), b(t, null, Ua, {
			kind: "accessor",
			name: "emissionColor",
			static: !1,
			private: !1,
			access: {
				has: (e) => "emissionColor" in e,
				get: (e) => e.emissionColor,
				set: (e, t) => {
					e.emissionColor = t;
				}
			},
			metadata: e
		}, Wa, Ga), b(t, null, Ka, {
			kind: "accessor",
			name: "emissionColorTexture",
			static: !1,
			private: !1,
			access: {
				has: (e) => "emissionColorTexture" in e,
				get: (e) => e.emissionColorTexture,
				set: (e, t) => {
					e.emissionColorTexture = t;
				}
			},
			metadata: e
		}, qa, Ja), b(t, null, Ya, {
			kind: "accessor",
			name: "thinFilmWeight",
			static: !1,
			private: !1,
			access: {
				has: (e) => "thinFilmWeight" in e,
				get: (e) => e.thinFilmWeight,
				set: (e, t) => {
					e.thinFilmWeight = t;
				}
			},
			metadata: e
		}, Xa, Za), b(t, null, Qa, {
			kind: "accessor",
			name: "thinFilmWeightTexture",
			static: !1,
			private: !1,
			access: {
				has: (e) => "thinFilmWeightTexture" in e,
				get: (e) => e.thinFilmWeightTexture,
				set: (e, t) => {
					e.thinFilmWeightTexture = t;
				}
			},
			metadata: e
		}, $a, eo), b(t, null, to, {
			kind: "accessor",
			name: "thinFilmThickness",
			static: !1,
			private: !1,
			access: {
				has: (e) => "thinFilmThickness" in e,
				get: (e) => e.thinFilmThickness,
				set: (e, t) => {
					e.thinFilmThickness = t;
				}
			},
			metadata: e
		}, no, ro), b(t, null, io, {
			kind: "accessor",
			name: "thinFilmThicknessMin",
			static: !1,
			private: !1,
			access: {
				has: (e) => "thinFilmThicknessMin" in e,
				get: (e) => e.thinFilmThicknessMin,
				set: (e, t) => {
					e.thinFilmThicknessMin = t;
				}
			},
			metadata: e
		}, ao, oo), b(t, null, so, {
			kind: "accessor",
			name: "thinFilmThicknessTexture",
			static: !1,
			private: !1,
			access: {
				has: (e) => "thinFilmThicknessTexture" in e,
				get: (e) => e.thinFilmThicknessTexture,
				set: (e, t) => {
					e.thinFilmThicknessTexture = t;
				}
			},
			metadata: e
		}, co, lo), b(t, null, uo, {
			kind: "accessor",
			name: "thinFilmIor",
			static: !1,
			private: !1,
			access: {
				has: (e) => "thinFilmIor" in e,
				get: (e) => e.thinFilmIor,
				set: (e, t) => {
					e.thinFilmIor = t;
				}
			},
			metadata: e
		}, fo, po), b(t, null, mo, {
			kind: "accessor",
			name: "ambientOcclusionTexture",
			static: !1,
			private: !1,
			access: {
				has: (e) => "ambientOcclusionTexture" in e,
				get: (e) => e.ambientOcclusionTexture,
				set: (e, t) => {
					e.ambientOcclusionTexture = t;
				}
			},
			metadata: e
		}, ho, go), b(t, null, _o, {
			kind: "accessor",
			name: "directIntensity",
			static: !1,
			private: !1,
			access: {
				has: (e) => "directIntensity" in e,
				get: (e) => e.directIntensity,
				set: (e, t) => {
					e.directIntensity = t;
				}
			},
			metadata: e
		}, vo, yo), b(t, null, bo, {
			kind: "accessor",
			name: "environmentIntensity",
			static: !1,
			private: !1,
			access: {
				has: (e) => "environmentIntensity" in e,
				get: (e) => e.environmentIntensity,
				set: (e, t) => {
					e.environmentIntensity = t;
				}
			},
			metadata: e
		}, xo, So), b(t, null, Co, {
			kind: "accessor",
			name: "useSpecularWeightFromTextureAlpha",
			static: !1,
			private: !1,
			access: {
				has: (e) => "useSpecularWeightFromTextureAlpha" in e,
				get: (e) => e.useSpecularWeightFromTextureAlpha,
				set: (e, t) => {
					e.useSpecularWeightFromTextureAlpha = t;
				}
			},
			metadata: e
		}, wo, To), b(t, null, Eo, {
			kind: "accessor",
			name: "forceAlphaTest",
			static: !1,
			private: !1,
			access: {
				has: (e) => "forceAlphaTest" in e,
				get: (e) => e.forceAlphaTest,
				set: (e, t) => {
					e.forceAlphaTest = t;
				}
			},
			metadata: e
		}, Do, Oo), b(t, null, ko, {
			kind: "accessor",
			name: "alphaCutOff",
			static: !1,
			private: !1,
			access: {
				has: (e) => "alphaCutOff" in e,
				get: (e) => e.alphaCutOff,
				set: (e, t) => {
					e.alphaCutOff = t;
				}
			},
			metadata: e
		}, Ao, jo), b(t, null, Mo, {
			kind: "accessor",
			name: "useAmbientOcclusionFromMetallicTextureRed",
			static: !1,
			private: !1,
			access: {
				has: (e) => "useAmbientOcclusionFromMetallicTextureRed" in e,
				get: (e) => e.useAmbientOcclusionFromMetallicTextureRed,
				set: (e, t) => {
					e.useAmbientOcclusionFromMetallicTextureRed = t;
				}
			},
			metadata: e
		}, No, Po), b(t, null, Fo, {
			kind: "accessor",
			name: "useAmbientInGrayScale",
			static: !1,
			private: !1,
			access: {
				has: (e) => "useAmbientInGrayScale" in e,
				get: (e) => e.useAmbientInGrayScale,
				set: (e, t) => {
					e.useAmbientInGrayScale = t;
				}
			},
			metadata: e
		}, Io, Lo), b(t, null, Ro, {
			kind: "getter",
			name: "usePhysicalLightFalloff",
			static: !1,
			private: !1,
			access: {
				has: (e) => "usePhysicalLightFalloff" in e,
				get: (e) => e.usePhysicalLightFalloff
			},
			metadata: e
		}, null, on), b(t, null, zo, {
			kind: "getter",
			name: "useGLTFLightFalloff",
			static: !1,
			private: !1,
			access: {
				has: (e) => "useGLTFLightFalloff" in e,
				get: (e) => e.useGLTFLightFalloff
			},
			metadata: e
		}, null, on), b(t, null, Bo, {
			kind: "accessor",
			name: "useObjectSpaceNormalMap",
			static: !1,
			private: !1,
			access: {
				has: (e) => "useObjectSpaceNormalMap" in e,
				get: (e) => e.useObjectSpaceNormalMap,
				set: (e, t) => {
					e.useObjectSpaceNormalMap = t;
				}
			},
			metadata: e
		}, Vo, Ho), b(t, null, Uo, {
			kind: "accessor",
			name: "useParallax",
			static: !1,
			private: !1,
			access: {
				has: (e) => "useParallax" in e,
				get: (e) => e.useParallax,
				set: (e, t) => {
					e.useParallax = t;
				}
			},
			metadata: e
		}, Wo, Go), b(t, null, Ko, {
			kind: "accessor",
			name: "useParallaxOcclusion",
			static: !1,
			private: !1,
			access: {
				has: (e) => "useParallaxOcclusion" in e,
				get: (e) => e.useParallaxOcclusion,
				set: (e, t) => {
					e.useParallaxOcclusion = t;
				}
			},
			metadata: e
		}, qo, Jo), b(t, null, Yo, {
			kind: "accessor",
			name: "parallaxScaleBias",
			static: !1,
			private: !1,
			access: {
				has: (e) => "parallaxScaleBias" in e,
				get: (e) => e.parallaxScaleBias,
				set: (e, t) => {
					e.parallaxScaleBias = t;
				}
			},
			metadata: e
		}, Xo, Zo), b(t, null, Qo, {
			kind: "accessor",
			name: "disableLighting",
			static: !1,
			private: !1,
			access: {
				has: (e) => "disableLighting" in e,
				get: (e) => e.disableLighting,
				set: (e, t) => {
					e.disableLighting = t;
				}
			},
			metadata: e
		}, $o, es), b(t, null, ts, {
			kind: "accessor",
			name: "forceIrradianceInFragment",
			static: !1,
			private: !1,
			access: {
				has: (e) => "forceIrradianceInFragment" in e,
				get: (e) => e.forceIrradianceInFragment,
				set: (e, t) => {
					e.forceIrradianceInFragment = t;
				}
			},
			metadata: e
		}, ns, rs), b(t, null, is, {
			kind: "accessor",
			name: "maxSimultaneousLights",
			static: !1,
			private: !1,
			access: {
				has: (e) => "maxSimultaneousLights" in e,
				get: (e) => e.maxSimultaneousLights,
				set: (e, t) => {
					e.maxSimultaneousLights = t;
				}
			},
			metadata: e
		}, as, os), b(t, null, ss, {
			kind: "accessor",
			name: "invertNormalMapX",
			static: !1,
			private: !1,
			access: {
				has: (e) => "invertNormalMapX" in e,
				get: (e) => e.invertNormalMapX,
				set: (e, t) => {
					e.invertNormalMapX = t;
				}
			},
			metadata: e
		}, cs, ls), b(t, null, us, {
			kind: "accessor",
			name: "invertNormalMapY",
			static: !1,
			private: !1,
			access: {
				has: (e) => "invertNormalMapY" in e,
				get: (e) => e.invertNormalMapY,
				set: (e, t) => {
					e.invertNormalMapY = t;
				}
			},
			metadata: e
		}, ds, fs), b(t, null, ps, {
			kind: "accessor",
			name: "twoSidedLighting",
			static: !1,
			private: !1,
			access: {
				has: (e) => "twoSidedLighting" in e,
				get: (e) => e.twoSidedLighting,
				set: (e, t) => {
					e.twoSidedLighting = t;
				}
			},
			metadata: e
		}, ms, hs), b(t, null, gs, {
			kind: "accessor",
			name: "useAlphaFresnel",
			static: !1,
			private: !1,
			access: {
				has: (e) => "useAlphaFresnel" in e,
				get: (e) => e.useAlphaFresnel,
				set: (e, t) => {
					e.useAlphaFresnel = t;
				}
			},
			metadata: e
		}, _s, vs), b(t, null, ys, {
			kind: "accessor",
			name: "useLinearAlphaFresnel",
			static: !1,
			private: !1,
			access: {
				has: (e) => "useLinearAlphaFresnel" in e,
				get: (e) => e.useLinearAlphaFresnel,
				set: (e, t) => {
					e.useLinearAlphaFresnel = t;
				}
			},
			metadata: e
		}, bs, xs), b(t, null, Ss, {
			kind: "accessor",
			name: "environmentBRDFTexture",
			static: !1,
			private: !1,
			access: {
				has: (e) => "environmentBRDFTexture" in e,
				get: (e) => e.environmentBRDFTexture,
				set: (e, t) => {
					e.environmentBRDFTexture = t;
				}
			},
			metadata: e
		}, Cs, ws), b(t, null, Ts, {
			kind: "accessor",
			name: "forceNormalForward",
			static: !1,
			private: !1,
			access: {
				has: (e) => "forceNormalForward" in e,
				get: (e) => e.forceNormalForward,
				set: (e, t) => {
					e.forceNormalForward = t;
				}
			},
			metadata: e
		}, Es, Ds), b(t, null, Os, {
			kind: "accessor",
			name: "enableSpecularAntiAliasing",
			static: !1,
			private: !1,
			access: {
				has: (e) => "enableSpecularAntiAliasing" in e,
				get: (e) => e.enableSpecularAntiAliasing,
				set: (e, t) => {
					e.enableSpecularAntiAliasing = t;
				}
			},
			metadata: e
		}, ks, As), b(t, null, js, {
			kind: "accessor",
			name: "useHorizonOcclusion",
			static: !1,
			private: !1,
			access: {
				has: (e) => "useHorizonOcclusion" in e,
				get: (e) => e.useHorizonOcclusion,
				set: (e, t) => {
					e.useHorizonOcclusion = t;
				}
			},
			metadata: e
		}, Ms, Ns), b(t, null, Ps, {
			kind: "accessor",
			name: "useRadianceOcclusion",
			static: !1,
			private: !1,
			access: {
				has: (e) => "useRadianceOcclusion" in e,
				get: (e) => e.useRadianceOcclusion,
				set: (e, t) => {
					e.useRadianceOcclusion = t;
				}
			},
			metadata: e
		}, Fs, Is), b(t, null, Ls, {
			kind: "accessor",
			name: "unlit",
			static: !1,
			private: !1,
			access: {
				has: (e) => "unlit" in e,
				get: (e) => e.unlit,
				set: (e, t) => {
					e.unlit = t;
				}
			},
			metadata: e
		}, Rs, zs), b(t, null, Bs, {
			kind: "accessor",
			name: "applyDecalMapAfterDetailMap",
			static: !1,
			private: !1,
			access: {
				has: (e) => "applyDecalMapAfterDetailMap" in e,
				get: (e) => e.applyDecalMapAfterDetailMap,
				set: (e, t) => {
					e.applyDecalMapAfterDetailMap = t;
				}
			},
			metadata: e
		}, Vs, Hs), b(t, null, Us, {
			kind: "accessor",
			name: "debugMode",
			static: !1,
			private: !1,
			access: {
				has: (e) => "debugMode" in e,
				get: (e) => e.debugMode,
				set: (e, t) => {
					e.debugMode = t;
				}
			},
			metadata: e
		}, Ws, Gs), b(t, null, Ks, {
			kind: "getter",
			name: "transparencyMode",
			static: !1,
			private: !1,
			access: {
				has: (e) => "transparencyMode" in e,
				get: (e) => e.transparencyMode
			},
			metadata: e
		}, null, on), e && Object.defineProperty(t, Symbol.metadata, {
			enumerable: !0,
			configurable: !0,
			writable: !0,
			value: e
		});
	})(), t.SSS_QUALITY_LOW = 0, t.SSS_QUALITY_MEDIUM = 1, t.SSS_QUALITY_HIGH = 2, t._noiseTextures = {}, t.ForceGLSL = !1, t._ShaderLoader = new Ie(() => [import("./openpbr.vertex-BUwKBjtG.js"), import("./openpbr.fragment-DHzcV46A.js")], () => [import("./openpbr.vertex-C0clfgIk.js"), import("./openpbr.fragment-CJBqABcZ.js")]), t;
})(), $ = !1;
function Ge() {
	$ || ($ = !0, i(), p("BABYLON.OpenPBRMaterial", Q));
}
//#endregion
export { Q as OpenPBRMaterial, Ue as OpenPBRMaterialDefines, Ge as RegisterOpenpbrMaterial };
