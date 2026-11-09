import { t as e } from "./logger-DQIzSR_y.js";
import { x as t } from "./tools.functions-DEecYKlu.js";
import { n, o as r, s as i } from "./scene.pure-B0rulfRT.js";
import { n as a } from "./buffer.pure-CgsgX1aa.js";
import { c as o, d as s, i as c, l, t as u } from "./math.color.pure-CPmbqLkh.js";
import { n as d } from "./typeStore-pENEWnX2.js";
import { _ as f, a as p, b as m, f as h, i as g, n as _, p as v, v as y, y as b } from "./decorators-BldPRAAT.js";
import { t as x } from "./decorators.serialization-CGAHzP43.js";
import { t as S } from "./smartArray-BmGU7Yab.js";
import { C, D as w, E as T, M as E, N as D, O, S as k, T as A, a as j, b as M, c as N, d as P, f as F, g as I, h as L, i as R, j as z, k as B, l as V, m as H, n as U, o as W, p as G, r as K, s as q, t as ee, v as te, w as ne, x as re, y as ie } from "./material.pure-BwKfnJ6P.js";
import { a as ae, c as oe, d as J, f as Y, i as se, l as ce, n as le, o as ue, r as de, s as fe, t as pe, u as X } from "./imageProcessing-DRHeoyEC.js";
import { n as Z, t as me } from "./material.detailMapConfiguration-VQ7gkaCb.js";
import { t as he } from "./brdfTextureTools-DjkNyIiC.js";
//#region node_modules/@babylonjs/core/Materials/PBR/pbrBRDFConfiguration.js
var ge = class extends X {
	constructor() {
		super(...arguments), this.BRDF_V_HEIGHT_CORRELATED = !1, this.MS_BRDF_ENERGY_CONSERVATION = !1, this.SPHERICAL_HARMONICS = !1, this.SPECULAR_GLOSSINESS_ENERGY_CONSERVATION = !1, this.MIX_IBL_RADIANCE_WITH_IRRADIANCE = !0, this.LEGACY_SPECULAR_ENERGY_CONSERVATION = !1, this.BASE_DIFFUSE_MODEL = 0, this.DIELECTRIC_SPECULAR_MODEL = 0, this.CONDUCTOR_SPECULAR_MODEL = 0;
	}
}, _e = (() => {
	var e, t, n, r, i, a, o, s, c, l;
	let u = Z, d, p = [], h = [], v, x = [], S = [], C, w = [], T = [], E, D = [], O = [], k, A = [], j = [], M, N = [], P = [], F, I = [], L = [], R, z = [], B = [], V, H = [], U = [];
	return e = class extends u {
		get useEnergyConservation() {
			return f(this, t, "f");
		}
		set useEnergyConservation(e) {
			y(this, t, e, "f");
		}
		get useSmithVisibilityHeightCorrelated() {
			return f(this, n, "f");
		}
		set useSmithVisibilityHeightCorrelated(e) {
			y(this, n, e, "f");
		}
		get useSphericalHarmonics() {
			return f(this, r, "f");
		}
		set useSphericalHarmonics(e) {
			y(this, r, e, "f");
		}
		get useSpecularGlossinessInputEnergyConservation() {
			return f(this, i, "f");
		}
		set useSpecularGlossinessInputEnergyConservation(e) {
			y(this, i, e, "f");
		}
		get mixIblRadianceWithIrradiance() {
			return f(this, a, "f");
		}
		set mixIblRadianceWithIrradiance(e) {
			y(this, a, e, "f");
		}
		get useLegacySpecularEnergyConservation() {
			return f(this, o, "f");
		}
		set useLegacySpecularEnergyConservation(e) {
			y(this, o, e, "f");
		}
		get baseDiffuseModel() {
			return f(this, s, "f");
		}
		set baseDiffuseModel(e) {
			y(this, s, e, "f");
		}
		get dielectricSpecularModel() {
			return f(this, c, "f");
		}
		set dielectricSpecularModel(e) {
			y(this, c, e, "f");
		}
		get conductorSpecularModel() {
			return f(this, l, "f");
		}
		set conductorSpecularModel(e) {
			y(this, l, e, "f");
		}
		_markAllSubMeshesAsMiscDirty() {
			this._internalMarkAllSubMeshesAsMiscDirty();
		}
		isCompatible() {
			return !0;
		}
		constructor(u, d = !0) {
			super(u, "PBRBRDF", 90, new ge(), d), this._useEnergyConservation = e.DEFAULT_USE_ENERGY_CONSERVATION, t.set(this, m(this, p, e.DEFAULT_USE_ENERGY_CONSERVATION)), this._useSmithVisibilityHeightCorrelated = (m(this, h), e.DEFAULT_USE_SMITH_VISIBILITY_HEIGHT_CORRELATED), n.set(this, m(this, x, e.DEFAULT_USE_SMITH_VISIBILITY_HEIGHT_CORRELATED)), this._useSphericalHarmonics = (m(this, S), e.DEFAULT_USE_SPHERICAL_HARMONICS), r.set(this, m(this, w, e.DEFAULT_USE_SPHERICAL_HARMONICS)), this._useSpecularGlossinessInputEnergyConservation = (m(this, T), e.DEFAULT_USE_SPECULAR_GLOSSINESS_INPUT_ENERGY_CONSERVATION), i.set(this, m(this, D, e.DEFAULT_USE_SPECULAR_GLOSSINESS_INPUT_ENERGY_CONSERVATION)), this._mixIblRadianceWithIrradiance = (m(this, O), e.DEFAULT_MIX_IBL_RADIANCE_WITH_IRRADIANCE), a.set(this, m(this, A, e.DEFAULT_MIX_IBL_RADIANCE_WITH_IRRADIANCE)), this._useLegacySpecularEnergyConservation = (m(this, j), e.DEFAULT_USE_LEGACY_SPECULAR_ENERGY_CONSERVATION), o.set(this, m(this, N, e.DEFAULT_USE_LEGACY_SPECULAR_ENERGY_CONSERVATION)), this._baseDiffuseModel = (m(this, P), e.DEFAULT_DIFFUSE_MODEL), s.set(this, m(this, I, e.DEFAULT_DIFFUSE_MODEL)), this._dielectricSpecularModel = (m(this, L), e.DEFAULT_DIELECTRIC_SPECULAR_MODEL), c.set(this, m(this, z, e.DEFAULT_DIELECTRIC_SPECULAR_MODEL)), this._conductorSpecularModel = (m(this, B), e.DEFAULT_CONDUCTOR_SPECULAR_MODEL), l.set(this, m(this, H, e.DEFAULT_CONDUCTOR_SPECULAR_MODEL)), this._internalMarkAllSubMeshesAsMiscDirty = m(this, U), this._internalMarkAllSubMeshesAsMiscDirty = u._dirtyCallbacks[16], this._enable(!0);
		}
		prepareDefines(e) {
			e.BRDF_V_HEIGHT_CORRELATED = this._useSmithVisibilityHeightCorrelated, e.MS_BRDF_ENERGY_CONSERVATION = this._useEnergyConservation && this._useSmithVisibilityHeightCorrelated, e.SPHERICAL_HARMONICS = this._useSphericalHarmonics, e.SPECULAR_GLOSSINESS_ENERGY_CONSERVATION = this._useSpecularGlossinessInputEnergyConservation, e.MIX_IBL_RADIANCE_WITH_IRRADIANCE = this._mixIblRadianceWithIrradiance && !this._material._disableLighting, e.LEGACY_SPECULAR_ENERGY_CONSERVATION = this._useLegacySpecularEnergyConservation, e.BASE_DIFFUSE_MODEL = this._baseDiffuseModel, e.DIELECTRIC_SPECULAR_MODEL = this._dielectricSpecularModel, e.CONDUCTOR_SPECULAR_MODEL = this._conductorSpecularModel;
		}
		getClassName() {
			return "PBRBRDFConfiguration";
		}
	}, t = /* @__PURE__ */ new WeakMap(), n = /* @__PURE__ */ new WeakMap(), r = /* @__PURE__ */ new WeakMap(), i = /* @__PURE__ */ new WeakMap(), a = /* @__PURE__ */ new WeakMap(), o = /* @__PURE__ */ new WeakMap(), s = /* @__PURE__ */ new WeakMap(), c = /* @__PURE__ */ new WeakMap(), l = /* @__PURE__ */ new WeakMap(), (() => {
		let t = typeof Symbol == "function" && Symbol.metadata ? Object.create(u[Symbol.metadata] ?? null) : void 0;
		d = [g(), _("_markAllSubMeshesAsMiscDirty")], v = [g(), _("_markAllSubMeshesAsMiscDirty")], C = [g(), _("_markAllSubMeshesAsMiscDirty")], E = [g(), _("_markAllSubMeshesAsMiscDirty")], k = [g(), _("_markAllSubMeshesAsMiscDirty")], M = [g(), _("_markAllSubMeshesAsMiscDirty")], F = [g("baseDiffuseModel"), _("_markAllSubMeshesAsMiscDirty")], R = [g("dielectricSpecularModel"), _("_markAllSubMeshesAsMiscDirty")], V = [g("conductorSpecularModel"), _("_markAllSubMeshesAsMiscDirty")], b(e, null, d, {
			kind: "accessor",
			name: "useEnergyConservation",
			static: !1,
			private: !1,
			access: {
				has: (e) => "useEnergyConservation" in e,
				get: (e) => e.useEnergyConservation,
				set: (e, t) => {
					e.useEnergyConservation = t;
				}
			},
			metadata: t
		}, p, h), b(e, null, v, {
			kind: "accessor",
			name: "useSmithVisibilityHeightCorrelated",
			static: !1,
			private: !1,
			access: {
				has: (e) => "useSmithVisibilityHeightCorrelated" in e,
				get: (e) => e.useSmithVisibilityHeightCorrelated,
				set: (e, t) => {
					e.useSmithVisibilityHeightCorrelated = t;
				}
			},
			metadata: t
		}, x, S), b(e, null, C, {
			kind: "accessor",
			name: "useSphericalHarmonics",
			static: !1,
			private: !1,
			access: {
				has: (e) => "useSphericalHarmonics" in e,
				get: (e) => e.useSphericalHarmonics,
				set: (e, t) => {
					e.useSphericalHarmonics = t;
				}
			},
			metadata: t
		}, w, T), b(e, null, E, {
			kind: "accessor",
			name: "useSpecularGlossinessInputEnergyConservation",
			static: !1,
			private: !1,
			access: {
				has: (e) => "useSpecularGlossinessInputEnergyConservation" in e,
				get: (e) => e.useSpecularGlossinessInputEnergyConservation,
				set: (e, t) => {
					e.useSpecularGlossinessInputEnergyConservation = t;
				}
			},
			metadata: t
		}, D, O), b(e, null, k, {
			kind: "accessor",
			name: "mixIblRadianceWithIrradiance",
			static: !1,
			private: !1,
			access: {
				has: (e) => "mixIblRadianceWithIrradiance" in e,
				get: (e) => e.mixIblRadianceWithIrradiance,
				set: (e, t) => {
					e.mixIblRadianceWithIrradiance = t;
				}
			},
			metadata: t
		}, A, j), b(e, null, M, {
			kind: "accessor",
			name: "useLegacySpecularEnergyConservation",
			static: !1,
			private: !1,
			access: {
				has: (e) => "useLegacySpecularEnergyConservation" in e,
				get: (e) => e.useLegacySpecularEnergyConservation,
				set: (e, t) => {
					e.useLegacySpecularEnergyConservation = t;
				}
			},
			metadata: t
		}, N, P), b(e, null, F, {
			kind: "accessor",
			name: "baseDiffuseModel",
			static: !1,
			private: !1,
			access: {
				has: (e) => "baseDiffuseModel" in e,
				get: (e) => e.baseDiffuseModel,
				set: (e, t) => {
					e.baseDiffuseModel = t;
				}
			},
			metadata: t
		}, I, L), b(e, null, R, {
			kind: "accessor",
			name: "dielectricSpecularModel",
			static: !1,
			private: !1,
			access: {
				has: (e) => "dielectricSpecularModel" in e,
				get: (e) => e.dielectricSpecularModel,
				set: (e, t) => {
					e.dielectricSpecularModel = t;
				}
			},
			metadata: t
		}, z, B), b(e, null, V, {
			kind: "accessor",
			name: "conductorSpecularModel",
			static: !1,
			private: !1,
			access: {
				has: (e) => "conductorSpecularModel" in e,
				get: (e) => e.conductorSpecularModel,
				set: (e, t) => {
					e.conductorSpecularModel = t;
				}
			},
			metadata: t
		}, H, U), t && Object.defineProperty(e, Symbol.metadata, {
			enumerable: !0,
			configurable: !0,
			writable: !0,
			value: t
		});
	})(), e.DEFAULT_USE_ENERGY_CONSERVATION = !0, e.DEFAULT_USE_SMITH_VISIBILITY_HEIGHT_CORRELATED = !0, e.DEFAULT_USE_SPHERICAL_HARMONICS = !0, e.DEFAULT_USE_SPECULAR_GLOSSINESS_INPUT_ENERGY_CONSERVATION = !0, e.DEFAULT_MIX_IBL_RADIANCE_WITH_IRRADIANCE = !0, e.DEFAULT_USE_LEGACY_SPECULAR_ENERGY_CONSERVATION = !0, e.DEFAULT_DIFFUSE_MODEL = 0, e.DEFAULT_DIELECTRIC_SPECULAR_MODEL = 0, e.DEFAULT_CONDUCTOR_SPECULAR_MODEL = 0, e;
})(), ve = class extends X {
	constructor() {
		super(...arguments), this.CLEARCOAT = !1, this.CLEARCOAT_DEFAULTIOR = !1, this.CLEARCOAT_TEXTURE = !1, this.CLEARCOAT_TEXTURE_ROUGHNESS = !1, this.CLEARCOAT_TEXTUREDIRECTUV = 0, this.CLEARCOAT_TEXTURE_ROUGHNESSDIRECTUV = 0, this.CLEARCOAT_BUMP = !1, this.CLEARCOAT_BUMPDIRECTUV = 0, this.CLEARCOAT_USE_ROUGHNESS_FROM_MAINTEXTURE = !1, this.CLEARCOAT_REMAP_F0 = !1, this.CLEARCOAT_TINT = !1, this.CLEARCOAT_TINT_TEXTURE = !1, this.CLEARCOAT_TINT_TEXTUREDIRECTUV = 0, this.CLEARCOAT_TINT_GAMMATEXTURE = !1;
	}
}, ye = (() => {
	var e, t, n, r, i, a, o, s, c, l;
	let d = Z, v, x = [], S = [], C, w = [], T = [], E, D = [], O = [], A, j = [], M = [], N, F = [], I = [], L, R = [], B = [], V, H = [], U = [], W, G = [], K = [], q, ee = [], te = [], ne, re = [], ie = [], ae, oe = [], J = [], Y, se = [], ce = [], le, ue = [], de = [], fe, pe = [], X = [];
	return e = class extends d {
		get isEnabled() {
			return f(this, t, "f");
		}
		set isEnabled(e) {
			y(this, t, e, "f");
		}
		get indexOfRefraction() {
			return f(this, n, "f");
		}
		set indexOfRefraction(e) {
			y(this, n, e, "f");
		}
		get texture() {
			return f(this, r, "f");
		}
		set texture(e) {
			y(this, r, e, "f");
		}
		get useRoughnessFromMainTexture() {
			return f(this, i, "f");
		}
		set useRoughnessFromMainTexture(e) {
			y(this, i, e, "f");
		}
		get textureRoughness() {
			return f(this, a, "f");
		}
		set textureRoughness(e) {
			y(this, a, e, "f");
		}
		get remapF0OnInterfaceChange() {
			return f(this, o, "f");
		}
		set remapF0OnInterfaceChange(e) {
			y(this, o, e, "f");
		}
		get bumpTexture() {
			return f(this, s, "f");
		}
		set bumpTexture(e) {
			y(this, s, e, "f");
		}
		get isTintEnabled() {
			return f(this, c, "f");
		}
		set isTintEnabled(e) {
			y(this, c, e, "f");
		}
		get tintTexture() {
			return f(this, l, "f");
		}
		set tintTexture(e) {
			y(this, l, e, "f");
		}
		_markAllSubMeshesAsTexturesDirty() {
			this._enable(this._isEnabled), this._internalMarkAllSubMeshesAsTexturesDirty();
		}
		isCompatible() {
			return !0;
		}
		constructor(d, f = !0) {
			super(d, "PBRClearCoat", 100, new ve(), f), this._isEnabled = !1, t.set(this, m(this, x, !1)), this.intensity = (m(this, S), m(this, w, 1)), this.roughness = (m(this, T), m(this, D, 0)), this._indexOfRefraction = (m(this, O), e._DefaultIndexOfRefraction), n.set(this, m(this, j, e._DefaultIndexOfRefraction)), this._texture = (m(this, M), null), r.set(this, m(this, F, null)), this._useRoughnessFromMainTexture = (m(this, I), !0), i.set(this, m(this, R, !0)), this._textureRoughness = (m(this, B), null), a.set(this, m(this, H, null)), this._remapF0OnInterfaceChange = (m(this, U), !0), o.set(this, m(this, G, !0)), this._bumpTexture = (m(this, K), null), s.set(this, m(this, ee, null)), this._isTintEnabled = (m(this, te), !1), c.set(this, m(this, re, !1)), this.tintColor = (m(this, ie), m(this, oe, u.White())), this.tintColorAtDistance = (m(this, J), m(this, se, 1)), this.tintThickness = (m(this, ce), m(this, ue, 1)), this._tintTexture = (m(this, de), null), l.set(this, m(this, pe, null)), this._internalMarkAllSubMeshesAsTexturesDirty = m(this, X), this._internalMarkAllSubMeshesAsTexturesDirty = d._dirtyCallbacks[1];
		}
		isReadyForSubMesh(e, t, n) {
			if (!this._isEnabled) return !0;
			let r = this._material._disableBumpMap;
			return !(e._areTexturesDirty && t.texturesEnabled && (this._texture && z.ClearCoatTextureEnabled && !this._texture.isReadyOrNotBlocking() || this._textureRoughness && z.ClearCoatTextureEnabled && !this._textureRoughness.isReadyOrNotBlocking() || n.getCaps().standardDerivatives && this._bumpTexture && z.ClearCoatBumpTextureEnabled && !r && !this._bumpTexture.isReady() || this._isTintEnabled && this._tintTexture && z.ClearCoatTintTextureEnabled && !this._tintTexture.isReadyOrNotBlocking()));
		}
		prepareDefinesBeforeAttributes(t, n) {
			this._isEnabled ? (t.CLEARCOAT = !0, t.CLEARCOAT_USE_ROUGHNESS_FROM_MAINTEXTURE = this._useRoughnessFromMainTexture, t.CLEARCOAT_REMAP_F0 = this._remapF0OnInterfaceChange, t._areTexturesDirty && n.texturesEnabled && (this._texture && z.ClearCoatTextureEnabled ? k(this._texture, t, "CLEARCOAT_TEXTURE") : t.CLEARCOAT_TEXTURE = !1, this._textureRoughness && z.ClearCoatTextureEnabled ? k(this._textureRoughness, t, "CLEARCOAT_TEXTURE_ROUGHNESS") : t.CLEARCOAT_TEXTURE_ROUGHNESS = !1, this._bumpTexture && z.ClearCoatBumpTextureEnabled ? k(this._bumpTexture, t, "CLEARCOAT_BUMP") : t.CLEARCOAT_BUMP = !1, t.CLEARCOAT_DEFAULTIOR = this._indexOfRefraction === e._DefaultIndexOfRefraction, this._isTintEnabled ? (t.CLEARCOAT_TINT = !0, this._tintTexture && z.ClearCoatTintTextureEnabled ? (k(this._tintTexture, t, "CLEARCOAT_TINT_TEXTURE"), t.CLEARCOAT_TINT_GAMMATEXTURE = this._tintTexture.gammaSpace) : t.CLEARCOAT_TINT_TEXTURE = !1) : (t.CLEARCOAT_TINT = !1, t.CLEARCOAT_TINT_TEXTURE = !1))) : (t.CLEARCOAT = !1, t.CLEARCOAT_TEXTURE = !1, t.CLEARCOAT_TEXTURE_ROUGHNESS = !1, t.CLEARCOAT_BUMP = !1, t.CLEARCOAT_TINT = !1, t.CLEARCOAT_TINT_TEXTURE = !1, t.CLEARCOAT_USE_ROUGHNESS_FROM_MAINTEXTURE = !1, t.CLEARCOAT_DEFAULTIOR = !1, t.CLEARCOAT_TEXTUREDIRECTUV = 0, t.CLEARCOAT_TEXTURE_ROUGHNESSDIRECTUV = 0, t.CLEARCOAT_BUMPDIRECTUV = 0, t.CLEARCOAT_REMAP_F0 = !1, t.CLEARCOAT_TINT_TEXTUREDIRECTUV = 0, t.CLEARCOAT_TINT_GAMMATEXTURE = !1);
		}
		bindForSubMesh(e, t, n, r) {
			if (!this._isEnabled) return;
			let i = r.materialDefines, a = this._material.isFrozen, o = this._material._disableBumpMap, s = this._material._invertNormalMapX, c = this._material._invertNormalMapY;
			if (!e.useUbo || !a || !e.isSync) {
				(this._texture || this._textureRoughness) && z.ClearCoatTextureEnabled && (e.updateFloat4("vClearCoatInfos", this._texture?.coordinatesIndex ?? 0, this._texture?.level ?? 0, this._textureRoughness?.coordinatesIndex ?? 0, this._textureRoughness?.level ?? 0), this._texture && P(this._texture, e, "clearCoat"), this._textureRoughness && !i.CLEARCOAT_USE_ROUGHNESS_FROM_MAINTEXTURE && P(this._textureRoughness, e, "clearCoatRoughness")), this._bumpTexture && n.getCaps().standardDerivatives && z.ClearCoatTextureEnabled && !o && (e.updateFloat2("vClearCoatBumpInfos", this._bumpTexture.coordinatesIndex, this._bumpTexture.level), P(this._bumpTexture, e, "clearCoatBump"), t._mirroredCameraPosition ? e.updateFloat2("vClearCoatTangentSpaceParams", s ? 1 : -1, c ? 1 : -1) : e.updateFloat2("vClearCoatTangentSpaceParams", s ? -1 : 1, c ? -1 : 1)), this._tintTexture && z.ClearCoatTintTextureEnabled && (e.updateFloat2("vClearCoatTintInfos", this._tintTexture.coordinatesIndex, this._tintTexture.level), P(this._tintTexture, e, "clearCoatTint")), e.updateFloat2("vClearCoatParams", this.intensity, this.roughness);
				let r = 1 - this._indexOfRefraction, a = 1 + this._indexOfRefraction, l = (-r / a) ** 2, u = 1 / this._indexOfRefraction;
				e.updateFloat4("vClearCoatRefractionParams", l, u, r, a), this._isTintEnabled && (e.updateFloat4("vClearCoatTintParams", this.tintColor.r, this.tintColor.g, this.tintColor.b, Math.max(1e-5, this.tintThickness)), e.updateFloat("clearCoatColorAtDistance", Math.max(1e-5, this.tintColorAtDistance)));
			}
			t.texturesEnabled && (this._texture && z.ClearCoatTextureEnabled && e.setTexture("clearCoatSampler", this._texture), this._textureRoughness && !i.CLEARCOAT_USE_ROUGHNESS_FROM_MAINTEXTURE && z.ClearCoatTextureEnabled && e.setTexture("clearCoatRoughnessSampler", this._textureRoughness), this._bumpTexture && n.getCaps().standardDerivatives && z.ClearCoatBumpTextureEnabled && !o && e.setTexture("clearCoatBumpSampler", this._bumpTexture), this._isTintEnabled && this._tintTexture && z.ClearCoatTintTextureEnabled && e.setTexture("clearCoatTintSampler", this._tintTexture));
		}
		hasTexture(e) {
			return this._texture === e || this._textureRoughness === e || this._bumpTexture === e || this._tintTexture === e;
		}
		getActiveTextures(e) {
			this._texture && e.push(this._texture), this._textureRoughness && e.push(this._textureRoughness), this._bumpTexture && e.push(this._bumpTexture), this._tintTexture && e.push(this._tintTexture);
		}
		getAnimatables(e) {
			this._texture && this._texture.animations && this._texture.animations.length > 0 && e.push(this._texture), this._textureRoughness && this._textureRoughness.animations && this._textureRoughness.animations.length > 0 && e.push(this._textureRoughness), this._bumpTexture && this._bumpTexture.animations && this._bumpTexture.animations.length > 0 && e.push(this._bumpTexture), this._tintTexture && this._tintTexture.animations && this._tintTexture.animations.length > 0 && e.push(this._tintTexture);
		}
		dispose(e) {
			e && (this._texture?.dispose(), this._textureRoughness?.dispose(), this._bumpTexture?.dispose(), this._tintTexture?.dispose());
		}
		getClassName() {
			return "PBRClearCoatConfiguration";
		}
		addFallbacks(e, t, n) {
			return e.CLEARCOAT_BUMP && t.addFallback(n++, "CLEARCOAT_BUMP"), e.CLEARCOAT_TINT && t.addFallback(n++, "CLEARCOAT_TINT"), e.CLEARCOAT && t.addFallback(n++, "CLEARCOAT"), n;
		}
		getSamplers(e) {
			e.push("clearCoatSampler", "clearCoatRoughnessSampler", "clearCoatBumpSampler", "clearCoatTintSampler");
		}
		getUniforms() {
			return { ubo: [
				{
					name: "vClearCoatParams",
					size: 2,
					type: "vec2"
				},
				{
					name: "vClearCoatRefractionParams",
					size: 4,
					type: "vec4"
				},
				{
					name: "vClearCoatInfos",
					size: 4,
					type: "vec4"
				},
				{
					name: "clearCoatMatrix",
					size: 16,
					type: "mat4"
				},
				{
					name: "clearCoatRoughnessMatrix",
					size: 16,
					type: "mat4"
				},
				{
					name: "vClearCoatBumpInfos",
					size: 2,
					type: "vec2"
				},
				{
					name: "vClearCoatTangentSpaceParams",
					size: 2,
					type: "vec2"
				},
				{
					name: "clearCoatBumpMatrix",
					size: 16,
					type: "mat4"
				},
				{
					name: "vClearCoatTintParams",
					size: 4,
					type: "vec4"
				},
				{
					name: "clearCoatColorAtDistance",
					size: 1,
					type: "float"
				},
				{
					name: "vClearCoatTintInfos",
					size: 2,
					type: "vec2"
				},
				{
					name: "clearCoatTintMatrix",
					size: 16,
					type: "mat4"
				}
			] };
		}
	}, t = /* @__PURE__ */ new WeakMap(), n = /* @__PURE__ */ new WeakMap(), r = /* @__PURE__ */ new WeakMap(), i = /* @__PURE__ */ new WeakMap(), a = /* @__PURE__ */ new WeakMap(), o = /* @__PURE__ */ new WeakMap(), s = /* @__PURE__ */ new WeakMap(), c = /* @__PURE__ */ new WeakMap(), l = /* @__PURE__ */ new WeakMap(), (() => {
		let t = typeof Symbol == "function" && Symbol.metadata ? Object.create(d[Symbol.metadata] ?? null) : void 0;
		v = [g(), _("_markAllSubMeshesAsTexturesDirty")], C = [g()], E = [g()], A = [g(), _("_markAllSubMeshesAsTexturesDirty")], N = [h(), _("_markAllSubMeshesAsTexturesDirty")], L = [g(), _("_markAllSubMeshesAsTexturesDirty")], V = [h(), _("_markAllSubMeshesAsTexturesDirty")], W = [g(), _("_markAllSubMeshesAsTexturesDirty")], q = [h(), _("_markAllSubMeshesAsTexturesDirty")], ne = [g(), _("_markAllSubMeshesAsTexturesDirty")], ae = [p()], Y = [g()], le = [g()], fe = [h(), _("_markAllSubMeshesAsTexturesDirty")], b(e, null, v, {
			kind: "accessor",
			name: "isEnabled",
			static: !1,
			private: !1,
			access: {
				has: (e) => "isEnabled" in e,
				get: (e) => e.isEnabled,
				set: (e, t) => {
					e.isEnabled = t;
				}
			},
			metadata: t
		}, x, S), b(e, null, A, {
			kind: "accessor",
			name: "indexOfRefraction",
			static: !1,
			private: !1,
			access: {
				has: (e) => "indexOfRefraction" in e,
				get: (e) => e.indexOfRefraction,
				set: (e, t) => {
					e.indexOfRefraction = t;
				}
			},
			metadata: t
		}, j, M), b(e, null, N, {
			kind: "accessor",
			name: "texture",
			static: !1,
			private: !1,
			access: {
				has: (e) => "texture" in e,
				get: (e) => e.texture,
				set: (e, t) => {
					e.texture = t;
				}
			},
			metadata: t
		}, F, I), b(e, null, L, {
			kind: "accessor",
			name: "useRoughnessFromMainTexture",
			static: !1,
			private: !1,
			access: {
				has: (e) => "useRoughnessFromMainTexture" in e,
				get: (e) => e.useRoughnessFromMainTexture,
				set: (e, t) => {
					e.useRoughnessFromMainTexture = t;
				}
			},
			metadata: t
		}, R, B), b(e, null, V, {
			kind: "accessor",
			name: "textureRoughness",
			static: !1,
			private: !1,
			access: {
				has: (e) => "textureRoughness" in e,
				get: (e) => e.textureRoughness,
				set: (e, t) => {
					e.textureRoughness = t;
				}
			},
			metadata: t
		}, H, U), b(e, null, W, {
			kind: "accessor",
			name: "remapF0OnInterfaceChange",
			static: !1,
			private: !1,
			access: {
				has: (e) => "remapF0OnInterfaceChange" in e,
				get: (e) => e.remapF0OnInterfaceChange,
				set: (e, t) => {
					e.remapF0OnInterfaceChange = t;
				}
			},
			metadata: t
		}, G, K), b(e, null, q, {
			kind: "accessor",
			name: "bumpTexture",
			static: !1,
			private: !1,
			access: {
				has: (e) => "bumpTexture" in e,
				get: (e) => e.bumpTexture,
				set: (e, t) => {
					e.bumpTexture = t;
				}
			},
			metadata: t
		}, ee, te), b(e, null, ne, {
			kind: "accessor",
			name: "isTintEnabled",
			static: !1,
			private: !1,
			access: {
				has: (e) => "isTintEnabled" in e,
				get: (e) => e.isTintEnabled,
				set: (e, t) => {
					e.isTintEnabled = t;
				}
			},
			metadata: t
		}, re, ie), b(e, null, fe, {
			kind: "accessor",
			name: "tintTexture",
			static: !1,
			private: !1,
			access: {
				has: (e) => "tintTexture" in e,
				get: (e) => e.tintTexture,
				set: (e, t) => {
					e.tintTexture = t;
				}
			},
			metadata: t
		}, pe, X), b(null, null, C, {
			kind: "field",
			name: "intensity",
			static: !1,
			private: !1,
			access: {
				has: (e) => "intensity" in e,
				get: (e) => e.intensity,
				set: (e, t) => {
					e.intensity = t;
				}
			},
			metadata: t
		}, w, T), b(null, null, E, {
			kind: "field",
			name: "roughness",
			static: !1,
			private: !1,
			access: {
				has: (e) => "roughness" in e,
				get: (e) => e.roughness,
				set: (e, t) => {
					e.roughness = t;
				}
			},
			metadata: t
		}, D, O), b(null, null, ae, {
			kind: "field",
			name: "tintColor",
			static: !1,
			private: !1,
			access: {
				has: (e) => "tintColor" in e,
				get: (e) => e.tintColor,
				set: (e, t) => {
					e.tintColor = t;
				}
			},
			metadata: t
		}, oe, J), b(null, null, Y, {
			kind: "field",
			name: "tintColorAtDistance",
			static: !1,
			private: !1,
			access: {
				has: (e) => "tintColorAtDistance" in e,
				get: (e) => e.tintColorAtDistance,
				set: (e, t) => {
					e.tintColorAtDistance = t;
				}
			},
			metadata: t
		}, se, ce), b(null, null, le, {
			kind: "field",
			name: "tintThickness",
			static: !1,
			private: !1,
			access: {
				has: (e) => "tintThickness" in e,
				get: (e) => e.tintThickness,
				set: (e, t) => {
					e.tintThickness = t;
				}
			},
			metadata: t
		}, ue, de), t && Object.defineProperty(e, Symbol.metadata, {
			enumerable: !0,
			configurable: !0,
			writable: !0,
			value: t
		});
	})(), e._DefaultIndexOfRefraction = 1.5, e;
})(), be = class extends X {
	constructor() {
		super(...arguments), this.IRIDESCENCE = !1, this.IRIDESCENCE_TEXTURE = !1, this.IRIDESCENCE_TEXTUREDIRECTUV = 0, this.IRIDESCENCE_THICKNESS_TEXTURE = !1, this.IRIDESCENCE_THICKNESS_TEXTUREDIRECTUV = 0;
	}
}, xe = (() => {
	var e, t, n, r;
	let i = Z, a, o = [], s = [], c, l = [], u = [], d, p = [], v = [], x, S = [], C = [], w, T = [], E = [], D, O = [], A = [], j, M = [], N = [];
	return e = class extends i {
		get isEnabled() {
			return f(this, t, "f");
		}
		set isEnabled(e) {
			y(this, t, e, "f");
		}
		get texture() {
			return f(this, n, "f");
		}
		set texture(e) {
			y(this, n, e, "f");
		}
		get thicknessTexture() {
			return f(this, r, "f");
		}
		set thicknessTexture(e) {
			y(this, r, e, "f");
		}
		_markAllSubMeshesAsTexturesDirty() {
			this._enable(this._isEnabled), this._internalMarkAllSubMeshesAsTexturesDirty();
		}
		isCompatible() {
			return !0;
		}
		constructor(i, a = !0) {
			super(i, "PBRIridescence", 110, new be(), a), this._isEnabled = !1, t.set(this, m(this, o, !1)), this.intensity = (m(this, s), m(this, l, 1)), this.minimumThickness = (m(this, u), m(this, p, e._DefaultMinimumThickness)), this.maximumThickness = (m(this, v), m(this, S, e._DefaultMaximumThickness)), this.indexOfRefraction = (m(this, C), m(this, T, e._DefaultIndexOfRefraction)), this._texture = (m(this, E), null), n.set(this, m(this, O, null)), this._thicknessTexture = (m(this, A), null), r.set(this, m(this, M, null)), this._internalMarkAllSubMeshesAsTexturesDirty = m(this, N), this._internalMarkAllSubMeshesAsTexturesDirty = i._dirtyCallbacks[1];
		}
		isReadyForSubMesh(e, t) {
			return !this._isEnabled || !(e._areTexturesDirty && t.texturesEnabled && (this._texture && z.IridescenceTextureEnabled && !this._texture.isReadyOrNotBlocking() || this._thicknessTexture && z.IridescenceTextureEnabled && !this._thicknessTexture.isReadyOrNotBlocking()));
		}
		prepareDefinesBeforeAttributes(e, t) {
			this._isEnabled ? (e.IRIDESCENCE = !0, e._areTexturesDirty && t.texturesEnabled && (this._texture && z.IridescenceTextureEnabled ? k(this._texture, e, "IRIDESCENCE_TEXTURE") : e.IRIDESCENCE_TEXTURE = !1, this._thicknessTexture && z.IridescenceTextureEnabled ? k(this._thicknessTexture, e, "IRIDESCENCE_THICKNESS_TEXTURE") : e.IRIDESCENCE_THICKNESS_TEXTURE = !1)) : (e.IRIDESCENCE = !1, e.IRIDESCENCE_TEXTURE = !1, e.IRIDESCENCE_THICKNESS_TEXTURE = !1, e.IRIDESCENCE_TEXTUREDIRECTUV = 0, e.IRIDESCENCE_THICKNESS_TEXTUREDIRECTUV = 0);
		}
		bindForSubMesh(e, t) {
			if (!this._isEnabled) return;
			let n = this._material.isFrozen;
			(!e.useUbo || !n || !e.isSync) && ((this._texture || this._thicknessTexture) && z.IridescenceTextureEnabled && (e.updateFloat4("vIridescenceInfos", this._texture?.coordinatesIndex ?? 0, this._texture?.level ?? 0, this._thicknessTexture?.coordinatesIndex ?? 0, this._thicknessTexture?.level ?? 0), this._texture && P(this._texture, e, "iridescence"), this._thicknessTexture && P(this._thicknessTexture, e, "iridescenceThickness")), e.updateFloat4("vIridescenceParams", this.intensity, this.indexOfRefraction, this.minimumThickness, this.maximumThickness)), t.texturesEnabled && (this._texture && z.IridescenceTextureEnabled && e.setTexture("iridescenceSampler", this._texture), this._thicknessTexture && z.IridescenceTextureEnabled && e.setTexture("iridescenceThicknessSampler", this._thicknessTexture));
		}
		hasTexture(e) {
			return this._texture === e || this._thicknessTexture === e;
		}
		getActiveTextures(e) {
			this._texture && e.push(this._texture), this._thicknessTexture && e.push(this._thicknessTexture);
		}
		getAnimatables(e) {
			this._texture && this._texture.animations && this._texture.animations.length > 0 && e.push(this._texture), this._thicknessTexture && this._thicknessTexture.animations && this._thicknessTexture.animations.length > 0 && e.push(this._thicknessTexture);
		}
		dispose(e) {
			e && (this._texture?.dispose(), this._thicknessTexture?.dispose());
		}
		getClassName() {
			return "PBRIridescenceConfiguration";
		}
		addFallbacks(e, t, n) {
			return e.IRIDESCENCE && t.addFallback(n++, "IRIDESCENCE"), n;
		}
		getSamplers(e) {
			e.push("iridescenceSampler", "iridescenceThicknessSampler");
		}
		getUniforms() {
			return { ubo: [
				{
					name: "vIridescenceParams",
					size: 4,
					type: "vec4"
				},
				{
					name: "vIridescenceInfos",
					size: 4,
					type: "vec4"
				},
				{
					name: "iridescenceMatrix",
					size: 16,
					type: "mat4"
				},
				{
					name: "iridescenceThicknessMatrix",
					size: 16,
					type: "mat4"
				}
			] };
		}
	}, t = /* @__PURE__ */ new WeakMap(), n = /* @__PURE__ */ new WeakMap(), r = /* @__PURE__ */ new WeakMap(), (() => {
		let t = typeof Symbol == "function" && Symbol.metadata ? Object.create(i[Symbol.metadata] ?? null) : void 0;
		a = [g(), _("_markAllSubMeshesAsTexturesDirty")], c = [g()], d = [g()], x = [g()], w = [g()], D = [h(), _("_markAllSubMeshesAsTexturesDirty")], j = [h(), _("_markAllSubMeshesAsTexturesDirty")], b(e, null, a, {
			kind: "accessor",
			name: "isEnabled",
			static: !1,
			private: !1,
			access: {
				has: (e) => "isEnabled" in e,
				get: (e) => e.isEnabled,
				set: (e, t) => {
					e.isEnabled = t;
				}
			},
			metadata: t
		}, o, s), b(e, null, D, {
			kind: "accessor",
			name: "texture",
			static: !1,
			private: !1,
			access: {
				has: (e) => "texture" in e,
				get: (e) => e.texture,
				set: (e, t) => {
					e.texture = t;
				}
			},
			metadata: t
		}, O, A), b(e, null, j, {
			kind: "accessor",
			name: "thicknessTexture",
			static: !1,
			private: !1,
			access: {
				has: (e) => "thicknessTexture" in e,
				get: (e) => e.thicknessTexture,
				set: (e, t) => {
					e.thicknessTexture = t;
				}
			},
			metadata: t
		}, M, N), b(null, null, c, {
			kind: "field",
			name: "intensity",
			static: !1,
			private: !1,
			access: {
				has: (e) => "intensity" in e,
				get: (e) => e.intensity,
				set: (e, t) => {
					e.intensity = t;
				}
			},
			metadata: t
		}, l, u), b(null, null, d, {
			kind: "field",
			name: "minimumThickness",
			static: !1,
			private: !1,
			access: {
				has: (e) => "minimumThickness" in e,
				get: (e) => e.minimumThickness,
				set: (e, t) => {
					e.minimumThickness = t;
				}
			},
			metadata: t
		}, p, v), b(null, null, x, {
			kind: "field",
			name: "maximumThickness",
			static: !1,
			private: !1,
			access: {
				has: (e) => "maximumThickness" in e,
				get: (e) => e.maximumThickness,
				set: (e, t) => {
					e.maximumThickness = t;
				}
			},
			metadata: t
		}, S, C), b(null, null, w, {
			kind: "field",
			name: "indexOfRefraction",
			static: !1,
			private: !1,
			access: {
				has: (e) => "indexOfRefraction" in e,
				get: (e) => e.indexOfRefraction,
				set: (e, t) => {
					e.indexOfRefraction = t;
				}
			},
			metadata: t
		}, T, E), t && Object.defineProperty(e, Symbol.metadata, {
			enumerable: !0,
			configurable: !0,
			writable: !0,
			value: t
		});
	})(), e._DefaultMinimumThickness = 100, e._DefaultMaximumThickness = 400, e._DefaultIndexOfRefraction = 1.3, e;
})(), Se = class extends X {
	constructor() {
		super(...arguments), this.ANISOTROPIC = !1, this.ANISOTROPIC_TEXTURE = !1, this.ANISOTROPIC_TEXTUREDIRECTUV = 0, this.ANISOTROPIC_LEGACY = !1, this.MAINUV1 = !1;
	}
}, Ce = (() => {
	var e, t, n, r;
	let i = Z, o, s = [], c = [], u, d = [], p = [], x, S = [], C = [], w, T = [], E = [], D, O = [], A = [];
	return e = class extends i {
		get isEnabled() {
			return f(this, t, "f");
		}
		set isEnabled(e) {
			y(this, t, e, "f");
		}
		set angle(e) {
			this.direction.x = Math.cos(e), this.direction.y = Math.sin(e);
		}
		get angle() {
			return Math.atan2(this.direction.y, this.direction.x);
		}
		get texture() {
			return f(this, n, "f");
		}
		set texture(e) {
			y(this, n, e, "f");
		}
		get legacy() {
			return f(this, r, "f");
		}
		set legacy(e) {
			y(this, r, e, "f");
		}
		_markAllSubMeshesAsTexturesDirty() {
			this._enable(this._isEnabled), this._internalMarkAllSubMeshesAsTexturesDirty();
		}
		_markAllSubMeshesAsMiscDirty() {
			this._enable(this._isEnabled), this._internalMarkAllSubMeshesAsMiscDirty();
		}
		isCompatible() {
			return !0;
		}
		constructor(e, i = !0) {
			super(e, "PBRAnisotropic", 110, new Se(), i), this._isEnabled = !1, t.set(this, m(this, s, !1)), this.intensity = (m(this, c), m(this, d, 1)), this.direction = (m(this, p), m(this, S, new l(1, 0))), this._texture = (m(this, C), null), n.set(this, m(this, T, null)), this._legacy = (m(this, E), !1), r.set(this, m(this, O, !1)), this._internalMarkAllSubMeshesAsTexturesDirty = m(this, A), this._internalMarkAllSubMeshesAsTexturesDirty = e._dirtyCallbacks[1], this._internalMarkAllSubMeshesAsMiscDirty = e._dirtyCallbacks[16];
		}
		isReadyForSubMesh(e, t) {
			return !this._isEnabled || !(e._areTexturesDirty && t.texturesEnabled && this._texture && z.AnisotropicTextureEnabled && !this._texture.isReadyOrNotBlocking());
		}
		prepareDefinesBeforeAttributes(e, t, n) {
			this._isEnabled ? (e.ANISOTROPIC = this._isEnabled, this._isEnabled && !n.isVerticesDataPresent(a.TangentKind) && (e._needUVs = !0, e.MAINUV1 = !0), e._areTexturesDirty && t.texturesEnabled && (this._texture && z.AnisotropicTextureEnabled ? k(this._texture, e, "ANISOTROPIC_TEXTURE") : e.ANISOTROPIC_TEXTURE = !1), e._areMiscDirty && (e.ANISOTROPIC_LEGACY = this._legacy)) : (e.ANISOTROPIC = !1, e.ANISOTROPIC_TEXTURE = !1, e.ANISOTROPIC_TEXTUREDIRECTUV = 0, e.ANISOTROPIC_LEGACY = !1);
		}
		bindForSubMesh(e, t) {
			if (!this._isEnabled) return;
			let n = this._material.isFrozen;
			(!e.useUbo || !n || !e.isSync) && (this._texture && z.AnisotropicTextureEnabled && (e.updateFloat2("vAnisotropyInfos", this._texture.coordinatesIndex, this._texture.level), P(this._texture, e, "anisotropy")), e.updateFloat3("vAnisotropy", this.direction.x, this.direction.y, this.intensity)), t.texturesEnabled && this._texture && z.AnisotropicTextureEnabled && e.setTexture("anisotropySampler", this._texture);
		}
		hasTexture(e) {
			return this._texture === e;
		}
		getActiveTextures(e) {
			this._texture && e.push(this._texture);
		}
		getAnimatables(e) {
			this._texture && this._texture.animations && this._texture.animations.length > 0 && e.push(this._texture);
		}
		dispose(e) {
			e && this._texture && this._texture.dispose();
		}
		getClassName() {
			return "PBRAnisotropicConfiguration";
		}
		addFallbacks(e, t, n) {
			return e.ANISOTROPIC && t.addFallback(n++, "ANISOTROPIC"), n;
		}
		getSamplers(e) {
			e.push("anisotropySampler");
		}
		getUniforms() {
			return { ubo: [
				{
					name: "vAnisotropy",
					size: 3,
					type: "vec3"
				},
				{
					name: "vAnisotropyInfos",
					size: 2,
					type: "vec2"
				},
				{
					name: "anisotropyMatrix",
					size: 16,
					type: "mat4"
				}
			] };
		}
		parse(e, t, n) {
			super.parse(e, t, n), e.legacy === void 0 && (this.legacy = !0);
		}
	}, t = /* @__PURE__ */ new WeakMap(), n = /* @__PURE__ */ new WeakMap(), r = /* @__PURE__ */ new WeakMap(), (() => {
		let t = typeof Symbol == "function" && Symbol.metadata ? Object.create(i[Symbol.metadata] ?? null) : void 0;
		o = [g(), _("_markAllSubMeshesAsTexturesDirty")], u = [g()], x = [v()], w = [h(), _("_markAllSubMeshesAsTexturesDirty")], D = [g(), _("_markAllSubMeshesAsMiscDirty")], b(e, null, o, {
			kind: "accessor",
			name: "isEnabled",
			static: !1,
			private: !1,
			access: {
				has: (e) => "isEnabled" in e,
				get: (e) => e.isEnabled,
				set: (e, t) => {
					e.isEnabled = t;
				}
			},
			metadata: t
		}, s, c), b(e, null, w, {
			kind: "accessor",
			name: "texture",
			static: !1,
			private: !1,
			access: {
				has: (e) => "texture" in e,
				get: (e) => e.texture,
				set: (e, t) => {
					e.texture = t;
				}
			},
			metadata: t
		}, T, E), b(e, null, D, {
			kind: "accessor",
			name: "legacy",
			static: !1,
			private: !1,
			access: {
				has: (e) => "legacy" in e,
				get: (e) => e.legacy,
				set: (e, t) => {
					e.legacy = t;
				}
			},
			metadata: t
		}, O, A), b(null, null, u, {
			kind: "field",
			name: "intensity",
			static: !1,
			private: !1,
			access: {
				has: (e) => "intensity" in e,
				get: (e) => e.intensity,
				set: (e, t) => {
					e.intensity = t;
				}
			},
			metadata: t
		}, d, p), b(null, null, x, {
			kind: "field",
			name: "direction",
			static: !1,
			private: !1,
			access: {
				has: (e) => "direction" in e,
				get: (e) => e.direction,
				set: (e, t) => {
					e.direction = t;
				}
			},
			metadata: t
		}, S, C), t && Object.defineProperty(e, Symbol.metadata, {
			enumerable: !0,
			configurable: !0,
			writable: !0,
			value: t
		});
	})(), e;
})(), we = class extends X {
	constructor() {
		super(...arguments), this.SHEEN = !1, this.SHEEN_TEXTURE = !1, this.SHEEN_GAMMATEXTURE = !1, this.SHEEN_TEXTURE_ROUGHNESS = !1, this.SHEEN_TEXTUREDIRECTUV = 0, this.SHEEN_TEXTURE_ROUGHNESSDIRECTUV = 0, this.SHEEN_LINKWITHALBEDO = !1, this.SHEEN_ROUGHNESS = !1, this.SHEEN_ALBEDOSCALING = !1, this.SHEEN_USE_ROUGHNESS_FROM_MAINTEXTURE = !1;
	}
}, Te = (() => {
	var e, t, n, r, i, a, o, s;
	let c = Z, l, d = [], v = [], x, S = [], C = [], w, T = [], E = [], D, O = [], A = [], j, M = [], N = [], F, I = [], L = [], R, B = [], V = [], H, U = [], W = [], G, K = [], q = [];
	return e = class extends c {
		get isEnabled() {
			return f(this, t, "f");
		}
		set isEnabled(e) {
			y(this, t, e, "f");
		}
		get linkSheenWithAlbedo() {
			return f(this, n, "f");
		}
		set linkSheenWithAlbedo(e) {
			y(this, n, e, "f");
		}
		get texture() {
			return f(this, r, "f");
		}
		set texture(e) {
			y(this, r, e, "f");
		}
		get useRoughnessFromMainTexture() {
			return f(this, i, "f");
		}
		set useRoughnessFromMainTexture(e) {
			y(this, i, e, "f");
		}
		get roughness() {
			return f(this, a, "f");
		}
		set roughness(e) {
			y(this, a, e, "f");
		}
		get textureRoughness() {
			return f(this, o, "f");
		}
		set textureRoughness(e) {
			y(this, o, e, "f");
		}
		get albedoScaling() {
			return f(this, s, "f");
		}
		set albedoScaling(e) {
			y(this, s, e, "f");
		}
		_markAllSubMeshesAsTexturesDirty() {
			this._enable(this._isEnabled), this._internalMarkAllSubMeshesAsTexturesDirty();
		}
		isCompatible() {
			return !0;
		}
		constructor(e, c = !0) {
			super(e, "Sheen", 120, new we(), c), this._isEnabled = !1, t.set(this, m(this, d, !1)), this._linkSheenWithAlbedo = (m(this, v), !1), n.set(this, m(this, S, !1)), this.intensity = (m(this, C), m(this, T, 1)), this.color = (m(this, E), m(this, O, u.White())), this._texture = (m(this, A), null), r.set(this, m(this, M, null)), this._useRoughnessFromMainTexture = (m(this, N), !0), i.set(this, m(this, I, !0)), this._roughness = (m(this, L), null), a.set(this, m(this, B, null)), this._textureRoughness = (m(this, V), null), o.set(this, m(this, U, null)), this._albedoScaling = (m(this, W), !1), s.set(this, m(this, K, !1)), this._internalMarkAllSubMeshesAsTexturesDirty = m(this, q), this._internalMarkAllSubMeshesAsTexturesDirty = e._dirtyCallbacks[1];
		}
		isReadyForSubMesh(e, t) {
			return !this._isEnabled || !(e._areTexturesDirty && t.texturesEnabled && (this._texture && z.SheenTextureEnabled && !this._texture.isReadyOrNotBlocking() || this._textureRoughness && z.SheenTextureEnabled && !this._textureRoughness.isReadyOrNotBlocking()));
		}
		prepareDefinesBeforeAttributes(e, t) {
			this._isEnabled ? (e.SHEEN = !0, e.SHEEN_LINKWITHALBEDO = this._linkSheenWithAlbedo, e.SHEEN_ROUGHNESS = this._roughness !== null, e.SHEEN_ALBEDOSCALING = this._albedoScaling, e.SHEEN_USE_ROUGHNESS_FROM_MAINTEXTURE = this._useRoughnessFromMainTexture, e._areTexturesDirty && t.texturesEnabled && (this._texture && z.SheenTextureEnabled ? (k(this._texture, e, "SHEEN_TEXTURE"), e.SHEEN_GAMMATEXTURE = this._texture.gammaSpace) : e.SHEEN_TEXTURE = !1, this._textureRoughness && z.SheenTextureEnabled ? k(this._textureRoughness, e, "SHEEN_TEXTURE_ROUGHNESS") : e.SHEEN_TEXTURE_ROUGHNESS = !1)) : (e.SHEEN = !1, e.SHEEN_TEXTURE = !1, e.SHEEN_TEXTURE_ROUGHNESS = !1, e.SHEEN_LINKWITHALBEDO = !1, e.SHEEN_ROUGHNESS = !1, e.SHEEN_ALBEDOSCALING = !1, e.SHEEN_USE_ROUGHNESS_FROM_MAINTEXTURE = !1, e.SHEEN_GAMMATEXTURE = !1, e.SHEEN_TEXTUREDIRECTUV = 0, e.SHEEN_TEXTURE_ROUGHNESSDIRECTUV = 0);
		}
		bindForSubMesh(e, t, n, r) {
			if (!this._isEnabled) return;
			let i = r.materialDefines, a = this._material.isFrozen;
			(!e.useUbo || !a || !e.isSync) && ((this._texture || this._textureRoughness) && z.SheenTextureEnabled && (e.updateFloat4("vSheenInfos", this._texture?.coordinatesIndex ?? 0, this._texture?.level ?? 0, this._textureRoughness?.coordinatesIndex ?? 0, this._textureRoughness?.level ?? 0), this._texture && P(this._texture, e, "sheen"), this._textureRoughness && !i.SHEEN_USE_ROUGHNESS_FROM_MAINTEXTURE && P(this._textureRoughness, e, "sheenRoughness")), e.updateFloat4("vSheenColor", this.color.r, this.color.g, this.color.b, this.intensity), this._roughness !== null && e.updateFloat("vSheenRoughness", this._roughness)), t.texturesEnabled && (this._texture && z.SheenTextureEnabled && e.setTexture("sheenSampler", this._texture), this._textureRoughness && !i.SHEEN_USE_ROUGHNESS_FROM_MAINTEXTURE && z.SheenTextureEnabled && e.setTexture("sheenRoughnessSampler", this._textureRoughness));
		}
		hasTexture(e) {
			return this._texture === e || this._textureRoughness === e;
		}
		getActiveTextures(e) {
			this._texture && e.push(this._texture), this._textureRoughness && e.push(this._textureRoughness);
		}
		getAnimatables(e) {
			this._texture && this._texture.animations && this._texture.animations.length > 0 && e.push(this._texture), this._textureRoughness && this._textureRoughness.animations && this._textureRoughness.animations.length > 0 && e.push(this._textureRoughness);
		}
		dispose(e) {
			e && (this._texture?.dispose(), this._textureRoughness?.dispose());
		}
		getClassName() {
			return "PBRSheenConfiguration";
		}
		addFallbacks(e, t, n) {
			return e.SHEEN && t.addFallback(n++, "SHEEN"), n;
		}
		getSamplers(e) {
			e.push("sheenSampler", "sheenRoughnessSampler");
		}
		getUniforms() {
			return { ubo: [
				{
					name: "vSheenColor",
					size: 4,
					type: "vec4"
				},
				{
					name: "vSheenRoughness",
					size: 1,
					type: "float"
				},
				{
					name: "vSheenInfos",
					size: 4,
					type: "vec4"
				},
				{
					name: "sheenMatrix",
					size: 16,
					type: "mat4"
				},
				{
					name: "sheenRoughnessMatrix",
					size: 16,
					type: "mat4"
				}
			] };
		}
	}, t = /* @__PURE__ */ new WeakMap(), n = /* @__PURE__ */ new WeakMap(), r = /* @__PURE__ */ new WeakMap(), i = /* @__PURE__ */ new WeakMap(), a = /* @__PURE__ */ new WeakMap(), o = /* @__PURE__ */ new WeakMap(), s = /* @__PURE__ */ new WeakMap(), (() => {
		let t = typeof Symbol == "function" && Symbol.metadata ? Object.create(c[Symbol.metadata] ?? null) : void 0;
		l = [g(), _("_markAllSubMeshesAsTexturesDirty")], x = [g(), _("_markAllSubMeshesAsTexturesDirty")], w = [g()], D = [p()], j = [h(), _("_markAllSubMeshesAsTexturesDirty")], F = [g(), _("_markAllSubMeshesAsTexturesDirty")], R = [g(), _("_markAllSubMeshesAsTexturesDirty")], H = [h(), _("_markAllSubMeshesAsTexturesDirty")], G = [g(), _("_markAllSubMeshesAsTexturesDirty")], b(e, null, l, {
			kind: "accessor",
			name: "isEnabled",
			static: !1,
			private: !1,
			access: {
				has: (e) => "isEnabled" in e,
				get: (e) => e.isEnabled,
				set: (e, t) => {
					e.isEnabled = t;
				}
			},
			metadata: t
		}, d, v), b(e, null, x, {
			kind: "accessor",
			name: "linkSheenWithAlbedo",
			static: !1,
			private: !1,
			access: {
				has: (e) => "linkSheenWithAlbedo" in e,
				get: (e) => e.linkSheenWithAlbedo,
				set: (e, t) => {
					e.linkSheenWithAlbedo = t;
				}
			},
			metadata: t
		}, S, C), b(e, null, j, {
			kind: "accessor",
			name: "texture",
			static: !1,
			private: !1,
			access: {
				has: (e) => "texture" in e,
				get: (e) => e.texture,
				set: (e, t) => {
					e.texture = t;
				}
			},
			metadata: t
		}, M, N), b(e, null, F, {
			kind: "accessor",
			name: "useRoughnessFromMainTexture",
			static: !1,
			private: !1,
			access: {
				has: (e) => "useRoughnessFromMainTexture" in e,
				get: (e) => e.useRoughnessFromMainTexture,
				set: (e, t) => {
					e.useRoughnessFromMainTexture = t;
				}
			},
			metadata: t
		}, I, L), b(e, null, R, {
			kind: "accessor",
			name: "roughness",
			static: !1,
			private: !1,
			access: {
				has: (e) => "roughness" in e,
				get: (e) => e.roughness,
				set: (e, t) => {
					e.roughness = t;
				}
			},
			metadata: t
		}, B, V), b(e, null, H, {
			kind: "accessor",
			name: "textureRoughness",
			static: !1,
			private: !1,
			access: {
				has: (e) => "textureRoughness" in e,
				get: (e) => e.textureRoughness,
				set: (e, t) => {
					e.textureRoughness = t;
				}
			},
			metadata: t
		}, U, W), b(e, null, G, {
			kind: "accessor",
			name: "albedoScaling",
			static: !1,
			private: !1,
			access: {
				has: (e) => "albedoScaling" in e,
				get: (e) => e.albedoScaling,
				set: (e, t) => {
					e.albedoScaling = t;
				}
			},
			metadata: t
		}, K, q), b(null, null, w, {
			kind: "field",
			name: "intensity",
			static: !1,
			private: !1,
			access: {
				has: (e) => "intensity" in e,
				get: (e) => e.intensity,
				set: (e, t) => {
					e.intensity = t;
				}
			},
			metadata: t
		}, T, E), b(null, null, D, {
			kind: "field",
			name: "color",
			static: !1,
			private: !1,
			access: {
				has: (e) => "color" in e,
				get: (e) => e.color,
				set: (e, t) => {
					e.color = t;
				}
			},
			metadata: t
		}, O, A), t && Object.defineProperty(e, Symbol.metadata, {
			enumerable: !0,
			configurable: !0,
			writable: !0,
			value: t
		});
	})(), e;
})(), Ee = class extends X {
	constructor() {
		super(...arguments), this.SUBSURFACE = !1, this.SS_REFRACTION = !1, this.SS_REFRACTION_USE_INTENSITY_FROM_THICKNESS = !1, this.SS_TRANSLUCENCY = !1, this.SS_TRANSLUCENCY_USE_INTENSITY_FROM_THICKNESS = !1, this.SS_SCATTERING = !1, this.SS_DISPERSION = !1, this.SS_THICKNESSANDMASK_TEXTURE = !1, this.SS_THICKNESSANDMASK_TEXTUREDIRECTUV = 0, this.SS_HAS_THICKNESS = !1, this.SS_REFRACTIONINTENSITY_TEXTURE = !1, this.SS_REFRACTIONINTENSITY_TEXTUREDIRECTUV = 0, this.SS_TRANSLUCENCYINTENSITY_TEXTURE = !1, this.SS_TRANSLUCENCYINTENSITY_TEXTUREDIRECTUV = 0, this.SS_TRANSLUCENCYCOLOR_TEXTURE = !1, this.SS_TRANSLUCENCYCOLOR_TEXTUREDIRECTUV = 0, this.SS_TRANSLUCENCYCOLOR_TEXTURE_GAMMA = !1, this.SS_REFRACTIONMAP_3D = !1, this.SS_REFRACTIONMAP_OPPOSITEZ = !1, this.SS_LODINREFRACTIONALPHA = !1, this.SS_GAMMAREFRACTION = !1, this.SS_RGBDREFRACTION = !1, this.SS_LINEARSPECULARREFRACTION = !1, this.SS_LINKREFRACTIONTOTRANSPARENCY = !1, this.SS_ALBEDOFORREFRACTIONTINT = !1, this.SS_ALBEDOFORTRANSLUCENCYTINT = !1, this.SS_USE_LOCAL_REFRACTIONMAP_CUBIC = !1, this.SS_USE_THICKNESS_AS_DEPTH = !1, this.SS_USE_GLTF_TEXTURES = !1, this.SS_APPLY_ALBEDO_AFTER_SUBSURFACE = !1, this.SS_TRANSLUCENCY_LEGACY = !1;
	}
}, De = (() => {
	var e, t, n, r, i, a, s, c, l, d, v, x, S, C, w, T, E;
	let D = Z, O, A = [], j = [], M, N = [], F = [], I, L = [], R = [], B, V = [], H = [], U, W = [], G = [], K, q = [], ee = [], te, ne = [], re = [], ie, ae = [], oe = [], J, Y = [], se = [], ce, le = [], ue = [], de, fe = [], pe = [], X, me = [], he = [], ge, _e = [], ve = [], ye, be = [], xe = [], Se, Ce = [], we = [], Te, De = [], Q = [], Oe, ke = [], Ae = [], $, je = [], Me = [], Ne, Pe = [], Fe = [], Ie, Le = [], Re = [], ze, Be = [], Ve = [], He, Ue = [], We = [], Ge, Ke = [], qe = [], Je, Ye = [], Xe = [], Ze, Qe = [], $e = [], et, tt = [], nt = [], rt, it = [], at = [], ot, st = [], ct = [], lt, ut = [], dt = [], ft, pt = [], mt = [];
	return e = class extends D {
		get isRefractionEnabled() {
			return f(this, t, "f");
		}
		set isRefractionEnabled(e) {
			y(this, t, e, "f");
		}
		get isTranslucencyEnabled() {
			return f(this, n, "f");
		}
		set isTranslucencyEnabled(e) {
			y(this, n, e, "f");
		}
		get isDispersionEnabled() {
			return f(this, r, "f");
		}
		set isDispersionEnabled(e) {
			y(this, r, e, "f");
		}
		get isScatteringEnabled() {
			return f(this, i, "f");
		}
		set isScatteringEnabled(e) {
			y(this, i, e, "f");
		}
		get scatteringDiffusionProfile() {
			return this._scene.subSurfaceConfiguration ? this._scene.subSurfaceConfiguration.ssDiffusionProfileColors[this._scatteringDiffusionProfileIndex] : null;
		}
		set scatteringDiffusionProfile(e) {
			this._scene.enableSubSurfaceForPrePass() && e && (this._scatteringDiffusionProfileIndex = this._scene.subSurfaceConfiguration.addDiffusionProfile(e));
		}
		get useAlbedoToTintRefraction() {
			return f(this, a, "f");
		}
		set useAlbedoToTintRefraction(e) {
			y(this, a, e, "f");
		}
		get useAlbedoToTintTranslucency() {
			return f(this, s, "f");
		}
		set useAlbedoToTintTranslucency(e) {
			y(this, s, e, "f");
		}
		get thicknessTexture() {
			return f(this, c, "f");
		}
		set thicknessTexture(e) {
			y(this, c, e, "f");
		}
		get refractionTexture() {
			return f(this, l, "f");
		}
		set refractionTexture(e) {
			y(this, l, e, "f");
		}
		get indexOfRefraction() {
			return f(this, d, "f");
		}
		set indexOfRefraction(e) {
			y(this, d, e, "f");
		}
		get volumeIndexOfRefraction() {
			return this._volumeIndexOfRefraction >= 1 ? this._volumeIndexOfRefraction : this._indexOfRefraction;
		}
		set volumeIndexOfRefraction(e) {
			let t = e >= 1 ? e : -1;
			this._volumeIndexOfRefraction !== t && (this._volumeIndexOfRefraction = t, this._markAllSubMeshesAsTexturesDirty());
		}
		get invertRefractionY() {
			return f(this, v, "f");
		}
		set invertRefractionY(e) {
			y(this, v, e, "f");
		}
		get linkRefractionWithTransparency() {
			return f(this, x, "f");
		}
		set linkRefractionWithTransparency(e) {
			y(this, x, e, "f");
		}
		get useMaskFromThicknessTexture() {
			return f(this, S, "f");
		}
		set useMaskFromThicknessTexture(e) {
			y(this, S, e, "f");
		}
		get refractionIntensityTexture() {
			return f(this, C, "f");
		}
		set refractionIntensityTexture(e) {
			y(this, C, e, "f");
		}
		get translucencyIntensityTexture() {
			return f(this, w, "f");
		}
		set translucencyIntensityTexture(e) {
			y(this, w, e, "f");
		}
		get translucencyColorTexture() {
			return f(this, T, "f");
		}
		set translucencyColorTexture(e) {
			y(this, T, e, "f");
		}
		get useGltfStyleTextures() {
			return f(this, E, "f");
		}
		set useGltfStyleTextures(e) {
			y(this, E, e, "f");
		}
		get legacyTransluceny() {
			return this.legacyTranslucency;
		}
		set legacyTransluceny(e) {
			this.legacyTranslucency = e;
		}
		_markAllSubMeshesAsTexturesDirty() {
			this._enable(this._isRefractionEnabled || this._isTranslucencyEnabled || this._isScatteringEnabled), this._internalMarkAllSubMeshesAsTexturesDirty();
		}
		_markScenePrePassDirty() {
			this._enable(this._isRefractionEnabled || this._isTranslucencyEnabled || this._isScatteringEnabled), this._internalMarkAllSubMeshesAsTexturesDirty(), this._internalMarkScenePrePassDirty();
		}
		isCompatible() {
			return !0;
		}
		constructor(o, f = !0) {
			super(o, "PBRSubSurface", 130, new Ee(), f), this._isRefractionEnabled = !1, t.set(this, m(this, A, !1)), this._isTranslucencyEnabled = (m(this, j), !1), n.set(this, m(this, N, !1)), this._isDispersionEnabled = (m(this, F), !1), r.set(this, m(this, L, !1)), this._isScatteringEnabled = (m(this, R), !1), i.set(this, m(this, V, !1)), this._scatteringDiffusionProfileIndex = (m(this, H), m(this, W, 0)), this.refractionIntensity = (m(this, G), m(this, q, 1)), this.translucencyIntensity = (m(this, ee), m(this, ne, 1)), this._useAlbedoToTintRefraction = (m(this, re), !1), a.set(this, m(this, ae, !1)), this._useAlbedoToTintTranslucency = (m(this, oe), !1), s.set(this, m(this, Y, !1)), this._thicknessTexture = (m(this, se), null), c.set(this, m(this, le, null)), this._refractionTexture = (m(this, ue), null), l.set(this, m(this, fe, null)), this._indexOfRefraction = (m(this, pe), 1.5), d.set(this, m(this, me, 1.5)), this._volumeIndexOfRefraction = (m(this, he), m(this, _e, -1)), this._invertRefractionY = (m(this, ve), !1), v.set(this, m(this, be, !1)), this._linkRefractionWithTransparency = (m(this, xe), !1), x.set(this, m(this, Ce, !1)), this.minimumThickness = (m(this, we), m(this, De, 0)), this.maximumThickness = (m(this, Q), m(this, ke, 1)), this.useThicknessAsDepth = (m(this, Ae), m(this, je, !1)), this.tintColor = (m(this, Me), m(this, Pe, u.White())), this.tintColorAtDistance = (m(this, Fe), m(this, Le, 1)), this.dispersion = (m(this, Re), m(this, Be, 0)), this.diffusionDistance = (m(this, Ve), m(this, Ue, u.White())), this._useMaskFromThicknessTexture = (m(this, We), !1), S.set(this, m(this, Ke, !1)), this._refractionIntensityTexture = (m(this, qe), null), C.set(this, m(this, Ye, null)), this._translucencyIntensityTexture = (m(this, Xe), null), w.set(this, m(this, Qe, null)), this.translucencyColor = (m(this, $e), m(this, tt, null)), this._translucencyColorTexture = (m(this, nt), null), T.set(this, m(this, it, null)), this._useGltfStyleTextures = (m(this, at), !0), E.set(this, m(this, st, !0)), this.applyAlbedoAfterSubSurface = (m(this, ct), m(this, ut, e.DEFAULT_APPLY_ALBEDO_AFTERSUBSURFACE)), this.legacyTranslucency = (m(this, dt), m(this, pt, e.DEFAULT_LEGACY_TRANSLUCENCY)), this._scene = m(this, mt), this._scene = o.getScene(), this.registerForExtraEvents = !0, this._internalMarkAllSubMeshesAsTexturesDirty = o._dirtyCallbacks[1], this._internalMarkScenePrePassDirty = o._dirtyCallbacks[32];
		}
		isReadyForSubMesh(e, t) {
			if (!this._isRefractionEnabled && !this._isTranslucencyEnabled && !this._isScatteringEnabled) return !0;
			if (e._areTexturesDirty && t.texturesEnabled) {
				if (this._thicknessTexture && z.ThicknessTextureEnabled && !this._thicknessTexture.isReadyOrNotBlocking() || this._refractionIntensityTexture && z.RefractionIntensityTextureEnabled && !this._refractionIntensityTexture.isReadyOrNotBlocking() || this._translucencyColorTexture && z.TranslucencyColorTextureEnabled && !this._translucencyColorTexture.isReadyOrNotBlocking() || this._translucencyIntensityTexture && z.TranslucencyIntensityTextureEnabled && !this._translucencyIntensityTexture.isReadyOrNotBlocking()) return !1;
				let e = this._getRefractionTexture(t);
				if (e && z.RefractionTextureEnabled && !e.isReadyOrNotBlocking()) return !1;
			}
			return !0;
		}
		prepareDefinesBeforeAttributes(e, t) {
			if (!this._isRefractionEnabled && !this._isTranslucencyEnabled && !this._isScatteringEnabled) e.SUBSURFACE = !1, e.SS_DISPERSION = !1, e.SS_TRANSLUCENCY = !1, e.SS_SCATTERING = !1, e.SS_REFRACTION = !1, e.SS_REFRACTION_USE_INTENSITY_FROM_THICKNESS = !1, e.SS_TRANSLUCENCY_USE_INTENSITY_FROM_THICKNESS = !1, e.SS_THICKNESSANDMASK_TEXTURE = !1, e.SS_THICKNESSANDMASK_TEXTUREDIRECTUV = 0, e.SS_HAS_THICKNESS = !1, e.SS_REFRACTIONINTENSITY_TEXTURE = !1, e.SS_REFRACTIONINTENSITY_TEXTUREDIRECTUV = 0, e.SS_TRANSLUCENCYINTENSITY_TEXTURE = !1, e.SS_TRANSLUCENCYINTENSITY_TEXTUREDIRECTUV = 0, e.SS_REFRACTIONMAP_3D = !1, e.SS_REFRACTIONMAP_OPPOSITEZ = !1, e.SS_LODINREFRACTIONALPHA = !1, e.SS_GAMMAREFRACTION = !1, e.SS_RGBDREFRACTION = !1, e.SS_LINEARSPECULARREFRACTION = !1, e.SS_LINKREFRACTIONTOTRANSPARENCY = !1, e.SS_ALBEDOFORREFRACTIONTINT = !1, e.SS_ALBEDOFORTRANSLUCENCYTINT = !1, e.SS_USE_LOCAL_REFRACTIONMAP_CUBIC = !1, e.SS_USE_THICKNESS_AS_DEPTH = !1, e.SS_USE_GLTF_TEXTURES = !1, e.SS_TRANSLUCENCYCOLOR_TEXTURE = !1, e.SS_TRANSLUCENCYCOLOR_TEXTUREDIRECTUV = 0, e.SS_TRANSLUCENCYCOLOR_TEXTURE_GAMMA = !1, e.SS_APPLY_ALBEDO_AFTER_SUBSURFACE = !1;
			else if (e._areTexturesDirty) {
				if (e.SUBSURFACE = !0, e.SS_DISPERSION = this._isDispersionEnabled, e.SS_TRANSLUCENCY = this._isTranslucencyEnabled, e.SS_TRANSLUCENCY_USE_INTENSITY_FROM_THICKNESS = !1, e.SS_TRANSLUCENCY_LEGACY = this.legacyTranslucency, e.SS_SCATTERING = this._isScatteringEnabled, e.SS_THICKNESSANDMASK_TEXTURE = !1, e.SS_REFRACTIONINTENSITY_TEXTURE = !1, e.SS_TRANSLUCENCYINTENSITY_TEXTURE = !1, e.SS_HAS_THICKNESS = !1, e.SS_USE_GLTF_TEXTURES = !1, e.SS_REFRACTION = !1, e.SS_REFRACTION_USE_INTENSITY_FROM_THICKNESS = !1, e.SS_REFRACTIONMAP_3D = !1, e.SS_GAMMAREFRACTION = !1, e.SS_RGBDREFRACTION = !1, e.SS_LINEARSPECULARREFRACTION = !1, e.SS_REFRACTIONMAP_OPPOSITEZ = !1, e.SS_LODINREFRACTIONALPHA = !1, e.SS_LINKREFRACTIONTOTRANSPARENCY = !1, e.SS_ALBEDOFORREFRACTIONTINT = !1, e.SS_ALBEDOFORTRANSLUCENCYTINT = !1, e.SS_USE_LOCAL_REFRACTIONMAP_CUBIC = !1, e.SS_USE_THICKNESS_AS_DEPTH = !1, e.SS_TRANSLUCENCYCOLOR_TEXTURE = !1, e.SS_APPLY_ALBEDO_AFTER_SUBSURFACE = this.applyAlbedoAfterSubSurface, e._areTexturesDirty && t.texturesEnabled && (this._thicknessTexture && z.ThicknessTextureEnabled && k(this._thicknessTexture, e, "SS_THICKNESSANDMASK_TEXTURE"), this._refractionIntensityTexture && z.RefractionIntensityTextureEnabled && k(this._refractionIntensityTexture, e, "SS_REFRACTIONINTENSITY_TEXTURE"), this._translucencyIntensityTexture && z.TranslucencyIntensityTextureEnabled && k(this._translucencyIntensityTexture, e, "SS_TRANSLUCENCYINTENSITY_TEXTURE"), this._translucencyColorTexture && z.TranslucencyColorTextureEnabled && (k(this._translucencyColorTexture, e, "SS_TRANSLUCENCYCOLOR_TEXTURE"), e.SS_TRANSLUCENCYCOLOR_TEXTURE_GAMMA = this._translucencyColorTexture.gammaSpace)), e.SS_HAS_THICKNESS = this.maximumThickness - this.minimumThickness !== 0, e.SS_USE_GLTF_TEXTURES = this._useGltfStyleTextures, e.SS_REFRACTION_USE_INTENSITY_FROM_THICKNESS = this._useMaskFromThicknessTexture && !this._refractionIntensityTexture, e.SS_TRANSLUCENCY_USE_INTENSITY_FROM_THICKNESS = this._useMaskFromThicknessTexture && !this._translucencyIntensityTexture, this._isRefractionEnabled && t.texturesEnabled) {
					let n = this._getRefractionTexture(t);
					n && z.RefractionTextureEnabled && (e.SS_REFRACTION = !0, e.SS_REFRACTIONMAP_3D = n.isCube, e.SS_GAMMAREFRACTION = n.gammaSpace, e.SS_RGBDREFRACTION = n.isRGBD, e.SS_LINEARSPECULARREFRACTION = n.linearSpecularLOD, e.SS_REFRACTIONMAP_OPPOSITEZ = this._scene.useRightHandedSystem && n.isCube ? !n.invertZ : n.invertZ, e.SS_LODINREFRACTIONALPHA = n.lodLevelInAlpha, e.SS_LINKREFRACTIONTOTRANSPARENCY = this._linkRefractionWithTransparency, e.SS_ALBEDOFORREFRACTIONTINT = this._useAlbedoToTintRefraction, e.SS_USE_LOCAL_REFRACTIONMAP_CUBIC = n.isCube && n.boundingBoxSize, e.SS_USE_THICKNESS_AS_DEPTH = this.useThicknessAsDepth);
				}
				this._isTranslucencyEnabled && (e.SS_ALBEDOFORTRANSLUCENCYTINT = this._useAlbedoToTintTranslucency);
			}
		}
		hardBindForSubMesh(e, t, n, r) {
			if (this._isRefractionEnabled || this._isTranslucencyEnabled || this._isScatteringEnabled) {
				if (this.maximumThickness === 0 && this.minimumThickness === 0) e.updateFloat2("vThicknessParam", 0, 0);
				else {
					r.getRenderingMesh().getWorldMatrix().decompose(o.Vector3[0]);
					let t = Math.max(Math.abs(o.Vector3[0].x), Math.abs(o.Vector3[0].y), Math.abs(o.Vector3[0].z));
					e.updateFloat2("vThicknessParam", this.minimumThickness * t, (this.maximumThickness - this.minimumThickness) * t);
				}
			}
		}
		bindForSubMesh(e, t, n, r) {
			if (!this._isRefractionEnabled && !this._isTranslucencyEnabled && !this._isScatteringEnabled) return;
			let i = r.materialDefines, a = this._material.isFrozen, o = this._material.realTimeFiltering, s = i.LODBASEDMICROSFURACE, c = this._getRefractionTexture(t);
			if (!e.useUbo || !a || !e.isSync) {
				if (this._thicknessTexture && z.ThicknessTextureEnabled && (e.updateFloat2("vThicknessInfos", this._thicknessTexture.coordinatesIndex, this._thicknessTexture.level), P(this._thicknessTexture, e, "thickness")), this._refractionIntensityTexture && z.RefractionIntensityTextureEnabled && i.SS_REFRACTIONINTENSITY_TEXTURE && (e.updateFloat2("vRefractionIntensityInfos", this._refractionIntensityTexture.coordinatesIndex, this._refractionIntensityTexture.level), P(this._refractionIntensityTexture, e, "refractionIntensity")), this._translucencyColorTexture && z.TranslucencyColorTextureEnabled && i.SS_TRANSLUCENCYCOLOR_TEXTURE && (e.updateFloat2("vTranslucencyColorInfos", this._translucencyColorTexture.coordinatesIndex, this._translucencyColorTexture.level), P(this._translucencyColorTexture, e, "translucencyColor")), this._translucencyIntensityTexture && z.TranslucencyIntensityTextureEnabled && i.SS_TRANSLUCENCYINTENSITY_TEXTURE && (e.updateFloat2("vTranslucencyIntensityInfos", this._translucencyIntensityTexture.coordinatesIndex, this._translucencyIntensityTexture.level), P(this._translucencyIntensityTexture, e, "translucencyIntensity")), c && z.RefractionTextureEnabled) {
					e.updateMatrix("refractionMatrix", c.getRefractionTextureMatrix());
					let t = 1;
					c.isCube || c.depth && (t = c.depth);
					let n = c.getSize().width, r = this.volumeIndexOfRefraction;
					if (e.updateFloat4("vRefractionInfos", c.level, 1 / r, t, this._invertRefractionY ? -1 : 1), e.updateFloat4("vRefractionMicrosurfaceInfos", n, c.lodGenerationScale, c.lodGenerationOffset, 1 / this.indexOfRefraction), o && e.updateFloat2("vRefractionFilteringInfo", n, Math.log2(n)), c.boundingBoxSize) {
						let t = c;
						e.updateVector3("vRefractionPosition", t.boundingBoxPosition), e.updateVector3("vRefractionSize", t.boundingBoxSize);
					}
				}
				this._isScatteringEnabled && e.updateFloat("scatteringDiffusionProfile", this._scatteringDiffusionProfileIndex), e.updateColor3("vDiffusionDistance", this.diffusionDistance), e.updateFloat4("vTintColor", this.tintColor.r, this.tintColor.g, this.tintColor.b, Math.max(1e-5, this.tintColorAtDistance)), e.updateColor4("vTranslucencyColor", this.translucencyColor ?? this.tintColor, 0), e.updateFloat3("vSubSurfaceIntensity", this.refractionIntensity, this.translucencyIntensity, 0), e.updateFloat("dispersion", this.dispersion);
			}
			t.texturesEnabled && (this._thicknessTexture && z.ThicknessTextureEnabled && e.setTexture("thicknessSampler", this._thicknessTexture), this._refractionIntensityTexture && z.RefractionIntensityTextureEnabled && i.SS_REFRACTIONINTENSITY_TEXTURE && e.setTexture("refractionIntensitySampler", this._refractionIntensityTexture), this._translucencyIntensityTexture && z.TranslucencyIntensityTextureEnabled && i.SS_TRANSLUCENCYINTENSITY_TEXTURE && e.setTexture("translucencyIntensitySampler", this._translucencyIntensityTexture), this._translucencyColorTexture && z.TranslucencyColorTextureEnabled && i.SS_TRANSLUCENCYCOLOR_TEXTURE && e.setTexture("translucencyColorSampler", this._translucencyColorTexture), c && z.RefractionTextureEnabled && (s ? e.setTexture("refractionSampler", c) : (e.setTexture("refractionSampler", c._lodTextureMid || c), e.setTexture("refractionSamplerLow", c._lodTextureLow || c), e.setTexture("refractionSamplerHigh", c._lodTextureHigh || c))));
		}
		_getRefractionTexture(e) {
			return this._refractionTexture ? this._refractionTexture : this._isRefractionEnabled ? e.environmentTexture : null;
		}
		get disableAlphaBlending() {
			return this._isRefractionEnabled && this._linkRefractionWithTransparency;
		}
		fillRenderTargetTextures(e) {
			z.RefractionTextureEnabled && this._refractionTexture && this._refractionTexture.isRenderTarget && e.push(this._refractionTexture);
		}
		hasTexture(e) {
			return this._thicknessTexture === e || this._refractionTexture === e || this._refractionIntensityTexture === e || this._translucencyIntensityTexture === e || this._translucencyColorTexture === e;
		}
		hasRenderTargetTextures() {
			return !!(z.RefractionTextureEnabled && this._refractionTexture && this._refractionTexture.isRenderTarget);
		}
		getActiveTextures(e) {
			this._thicknessTexture && e.push(this._thicknessTexture), this._refractionTexture && e.push(this._refractionTexture), this._refractionIntensityTexture && e.push(this._refractionIntensityTexture), this._translucencyColorTexture && e.push(this._translucencyColorTexture), this._translucencyIntensityTexture && e.push(this._translucencyIntensityTexture);
		}
		getAnimatables(e) {
			this._thicknessTexture && this._thicknessTexture.animations && this._thicknessTexture.animations.length > 0 && e.push(this._thicknessTexture), this._refractionTexture && this._refractionTexture.animations && this._refractionTexture.animations.length > 0 && e.push(this._refractionTexture), this._refractionIntensityTexture && this._refractionIntensityTexture.animations && this._refractionIntensityTexture.animations.length > 0 && e.push(this._refractionIntensityTexture), this._translucencyColorTexture && this._translucencyColorTexture.animations && this._translucencyColorTexture.animations.length > 0 && e.push(this._translucencyColorTexture), this._translucencyIntensityTexture && this._translucencyIntensityTexture.animations && this._translucencyIntensityTexture.animations.length > 0 && e.push(this._translucencyIntensityTexture);
		}
		dispose(e) {
			e && (this._thicknessTexture && this._thicknessTexture.dispose(), this._refractionTexture && this._refractionTexture.dispose(), this._refractionIntensityTexture && this._refractionIntensityTexture.dispose(), this._translucencyColorTexture && this._translucencyColorTexture.dispose(), this._translucencyIntensityTexture && this._translucencyIntensityTexture.dispose());
		}
		getClassName() {
			return "PBRSubSurfaceConfiguration";
		}
		addFallbacks(e, t, n) {
			return e.SS_SCATTERING && t.addFallback(n++, "SS_SCATTERING"), e.SS_TRANSLUCENCY && t.addFallback(n++, "SS_TRANSLUCENCY"), n;
		}
		getSamplers(e) {
			e.push("thicknessSampler", "refractionIntensitySampler", "translucencyIntensitySampler", "refractionSampler", "refractionSamplerLow", "refractionSamplerHigh", "translucencyColorSampler");
		}
		getUniforms() {
			return { ubo: [
				{
					name: "vRefractionMicrosurfaceInfos",
					size: 4,
					type: "vec4"
				},
				{
					name: "vRefractionFilteringInfo",
					size: 2,
					type: "vec2"
				},
				{
					name: "vTranslucencyIntensityInfos",
					size: 2,
					type: "vec2"
				},
				{
					name: "vRefractionInfos",
					size: 4,
					type: "vec4"
				},
				{
					name: "refractionMatrix",
					size: 16,
					type: "mat4"
				},
				{
					name: "vThicknessInfos",
					size: 2,
					type: "vec2"
				},
				{
					name: "vRefractionIntensityInfos",
					size: 2,
					type: "vec2"
				},
				{
					name: "thicknessMatrix",
					size: 16,
					type: "mat4"
				},
				{
					name: "refractionIntensityMatrix",
					size: 16,
					type: "mat4"
				},
				{
					name: "translucencyIntensityMatrix",
					size: 16,
					type: "mat4"
				},
				{
					name: "vThicknessParam",
					size: 2,
					type: "vec2"
				},
				{
					name: "vDiffusionDistance",
					size: 3,
					type: "vec3"
				},
				{
					name: "vTintColor",
					size: 4,
					type: "vec4"
				},
				{
					name: "vSubSurfaceIntensity",
					size: 3,
					type: "vec3"
				},
				{
					name: "vRefractionPosition",
					size: 3,
					type: "vec3"
				},
				{
					name: "vRefractionSize",
					size: 3,
					type: "vec3"
				},
				{
					name: "scatteringDiffusionProfile",
					size: 1,
					type: "float"
				},
				{
					name: "dispersion",
					size: 1,
					type: "float"
				},
				{
					name: "vTranslucencyColor",
					size: 4,
					type: "vec4"
				},
				{
					name: "vTranslucencyColorInfos",
					size: 2,
					type: "vec2"
				},
				{
					name: "translucencyColorMatrix",
					size: 16,
					type: "mat4"
				}
			] };
		}
	}, t = /* @__PURE__ */ new WeakMap(), n = /* @__PURE__ */ new WeakMap(), r = /* @__PURE__ */ new WeakMap(), i = /* @__PURE__ */ new WeakMap(), a = /* @__PURE__ */ new WeakMap(), s = /* @__PURE__ */ new WeakMap(), c = /* @__PURE__ */ new WeakMap(), l = /* @__PURE__ */ new WeakMap(), d = /* @__PURE__ */ new WeakMap(), v = /* @__PURE__ */ new WeakMap(), x = /* @__PURE__ */ new WeakMap(), S = /* @__PURE__ */ new WeakMap(), C = /* @__PURE__ */ new WeakMap(), w = /* @__PURE__ */ new WeakMap(), T = /* @__PURE__ */ new WeakMap(), E = /* @__PURE__ */ new WeakMap(), (() => {
		let t = typeof Symbol == "function" && Symbol.metadata ? Object.create(D[Symbol.metadata] ?? null) : void 0;
		O = [g(), _("_markAllSubMeshesAsTexturesDirty")], M = [g(), _("_markAllSubMeshesAsTexturesDirty")], I = [g(), _("_markAllSubMeshesAsTexturesDirty")], B = [g(), _("_markScenePrePassDirty")], U = [g()], K = [g()], te = [g()], ie = [g(), _("_markAllSubMeshesAsTexturesDirty")], J = [g(), _("_markAllSubMeshesAsTexturesDirty")], ce = [h(), _("_markAllSubMeshesAsTexturesDirty")], de = [h(), _("_markAllSubMeshesAsTexturesDirty")], X = [g(), _("_markAllSubMeshesAsTexturesDirty")], ge = [g()], ye = [g(), _("_markAllSubMeshesAsTexturesDirty")], Se = [g(), _("_markAllSubMeshesAsTexturesDirty")], Te = [g()], Oe = [g()], $ = [g()], Ne = [p()], Ie = [g()], ze = [g()], He = [p()], Ge = [g(), _("_markAllSubMeshesAsTexturesDirty")], Je = [h(), _("_markAllSubMeshesAsTexturesDirty")], Ze = [h(), _("_markAllSubMeshesAsTexturesDirty")], et = [p()], rt = [h(), _("_markAllSubMeshesAsTexturesDirty")], ot = [g(), _("_markAllSubMeshesAsTexturesDirty")], lt = [g()], ft = [g()], b(e, null, O, {
			kind: "accessor",
			name: "isRefractionEnabled",
			static: !1,
			private: !1,
			access: {
				has: (e) => "isRefractionEnabled" in e,
				get: (e) => e.isRefractionEnabled,
				set: (e, t) => {
					e.isRefractionEnabled = t;
				}
			},
			metadata: t
		}, A, j), b(e, null, M, {
			kind: "accessor",
			name: "isTranslucencyEnabled",
			static: !1,
			private: !1,
			access: {
				has: (e) => "isTranslucencyEnabled" in e,
				get: (e) => e.isTranslucencyEnabled,
				set: (e, t) => {
					e.isTranslucencyEnabled = t;
				}
			},
			metadata: t
		}, N, F), b(e, null, I, {
			kind: "accessor",
			name: "isDispersionEnabled",
			static: !1,
			private: !1,
			access: {
				has: (e) => "isDispersionEnabled" in e,
				get: (e) => e.isDispersionEnabled,
				set: (e, t) => {
					e.isDispersionEnabled = t;
				}
			},
			metadata: t
		}, L, R), b(e, null, B, {
			kind: "accessor",
			name: "isScatteringEnabled",
			static: !1,
			private: !1,
			access: {
				has: (e) => "isScatteringEnabled" in e,
				get: (e) => e.isScatteringEnabled,
				set: (e, t) => {
					e.isScatteringEnabled = t;
				}
			},
			metadata: t
		}, V, H), b(e, null, ie, {
			kind: "accessor",
			name: "useAlbedoToTintRefraction",
			static: !1,
			private: !1,
			access: {
				has: (e) => "useAlbedoToTintRefraction" in e,
				get: (e) => e.useAlbedoToTintRefraction,
				set: (e, t) => {
					e.useAlbedoToTintRefraction = t;
				}
			},
			metadata: t
		}, ae, oe), b(e, null, J, {
			kind: "accessor",
			name: "useAlbedoToTintTranslucency",
			static: !1,
			private: !1,
			access: {
				has: (e) => "useAlbedoToTintTranslucency" in e,
				get: (e) => e.useAlbedoToTintTranslucency,
				set: (e, t) => {
					e.useAlbedoToTintTranslucency = t;
				}
			},
			metadata: t
		}, Y, se), b(e, null, ce, {
			kind: "accessor",
			name: "thicknessTexture",
			static: !1,
			private: !1,
			access: {
				has: (e) => "thicknessTexture" in e,
				get: (e) => e.thicknessTexture,
				set: (e, t) => {
					e.thicknessTexture = t;
				}
			},
			metadata: t
		}, le, ue), b(e, null, de, {
			kind: "accessor",
			name: "refractionTexture",
			static: !1,
			private: !1,
			access: {
				has: (e) => "refractionTexture" in e,
				get: (e) => e.refractionTexture,
				set: (e, t) => {
					e.refractionTexture = t;
				}
			},
			metadata: t
		}, fe, pe), b(e, null, X, {
			kind: "accessor",
			name: "indexOfRefraction",
			static: !1,
			private: !1,
			access: {
				has: (e) => "indexOfRefraction" in e,
				get: (e) => e.indexOfRefraction,
				set: (e, t) => {
					e.indexOfRefraction = t;
				}
			},
			metadata: t
		}, me, he), b(e, null, ye, {
			kind: "accessor",
			name: "invertRefractionY",
			static: !1,
			private: !1,
			access: {
				has: (e) => "invertRefractionY" in e,
				get: (e) => e.invertRefractionY,
				set: (e, t) => {
					e.invertRefractionY = t;
				}
			},
			metadata: t
		}, be, xe), b(e, null, Se, {
			kind: "accessor",
			name: "linkRefractionWithTransparency",
			static: !1,
			private: !1,
			access: {
				has: (e) => "linkRefractionWithTransparency" in e,
				get: (e) => e.linkRefractionWithTransparency,
				set: (e, t) => {
					e.linkRefractionWithTransparency = t;
				}
			},
			metadata: t
		}, Ce, we), b(e, null, Ge, {
			kind: "accessor",
			name: "useMaskFromThicknessTexture",
			static: !1,
			private: !1,
			access: {
				has: (e) => "useMaskFromThicknessTexture" in e,
				get: (e) => e.useMaskFromThicknessTexture,
				set: (e, t) => {
					e.useMaskFromThicknessTexture = t;
				}
			},
			metadata: t
		}, Ke, qe), b(e, null, Je, {
			kind: "accessor",
			name: "refractionIntensityTexture",
			static: !1,
			private: !1,
			access: {
				has: (e) => "refractionIntensityTexture" in e,
				get: (e) => e.refractionIntensityTexture,
				set: (e, t) => {
					e.refractionIntensityTexture = t;
				}
			},
			metadata: t
		}, Ye, Xe), b(e, null, Ze, {
			kind: "accessor",
			name: "translucencyIntensityTexture",
			static: !1,
			private: !1,
			access: {
				has: (e) => "translucencyIntensityTexture" in e,
				get: (e) => e.translucencyIntensityTexture,
				set: (e, t) => {
					e.translucencyIntensityTexture = t;
				}
			},
			metadata: t
		}, Qe, $e), b(e, null, rt, {
			kind: "accessor",
			name: "translucencyColorTexture",
			static: !1,
			private: !1,
			access: {
				has: (e) => "translucencyColorTexture" in e,
				get: (e) => e.translucencyColorTexture,
				set: (e, t) => {
					e.translucencyColorTexture = t;
				}
			},
			metadata: t
		}, it, at), b(e, null, ot, {
			kind: "accessor",
			name: "useGltfStyleTextures",
			static: !1,
			private: !1,
			access: {
				has: (e) => "useGltfStyleTextures" in e,
				get: (e) => e.useGltfStyleTextures,
				set: (e, t) => {
					e.useGltfStyleTextures = t;
				}
			},
			metadata: t
		}, st, ct), b(null, null, U, {
			kind: "field",
			name: "_scatteringDiffusionProfileIndex",
			static: !1,
			private: !1,
			access: {
				has: (e) => "_scatteringDiffusionProfileIndex" in e,
				get: (e) => e._scatteringDiffusionProfileIndex,
				set: (e, t) => {
					e._scatteringDiffusionProfileIndex = t;
				}
			},
			metadata: t
		}, W, G), b(null, null, K, {
			kind: "field",
			name: "refractionIntensity",
			static: !1,
			private: !1,
			access: {
				has: (e) => "refractionIntensity" in e,
				get: (e) => e.refractionIntensity,
				set: (e, t) => {
					e.refractionIntensity = t;
				}
			},
			metadata: t
		}, q, ee), b(null, null, te, {
			kind: "field",
			name: "translucencyIntensity",
			static: !1,
			private: !1,
			access: {
				has: (e) => "translucencyIntensity" in e,
				get: (e) => e.translucencyIntensity,
				set: (e, t) => {
					e.translucencyIntensity = t;
				}
			},
			metadata: t
		}, ne, re), b(null, null, ge, {
			kind: "field",
			name: "_volumeIndexOfRefraction",
			static: !1,
			private: !1,
			access: {
				has: (e) => "_volumeIndexOfRefraction" in e,
				get: (e) => e._volumeIndexOfRefraction,
				set: (e, t) => {
					e._volumeIndexOfRefraction = t;
				}
			},
			metadata: t
		}, _e, ve), b(null, null, Te, {
			kind: "field",
			name: "minimumThickness",
			static: !1,
			private: !1,
			access: {
				has: (e) => "minimumThickness" in e,
				get: (e) => e.minimumThickness,
				set: (e, t) => {
					e.minimumThickness = t;
				}
			},
			metadata: t
		}, De, Q), b(null, null, Oe, {
			kind: "field",
			name: "maximumThickness",
			static: !1,
			private: !1,
			access: {
				has: (e) => "maximumThickness" in e,
				get: (e) => e.maximumThickness,
				set: (e, t) => {
					e.maximumThickness = t;
				}
			},
			metadata: t
		}, ke, Ae), b(null, null, $, {
			kind: "field",
			name: "useThicknessAsDepth",
			static: !1,
			private: !1,
			access: {
				has: (e) => "useThicknessAsDepth" in e,
				get: (e) => e.useThicknessAsDepth,
				set: (e, t) => {
					e.useThicknessAsDepth = t;
				}
			},
			metadata: t
		}, je, Me), b(null, null, Ne, {
			kind: "field",
			name: "tintColor",
			static: !1,
			private: !1,
			access: {
				has: (e) => "tintColor" in e,
				get: (e) => e.tintColor,
				set: (e, t) => {
					e.tintColor = t;
				}
			},
			metadata: t
		}, Pe, Fe), b(null, null, Ie, {
			kind: "field",
			name: "tintColorAtDistance",
			static: !1,
			private: !1,
			access: {
				has: (e) => "tintColorAtDistance" in e,
				get: (e) => e.tintColorAtDistance,
				set: (e, t) => {
					e.tintColorAtDistance = t;
				}
			},
			metadata: t
		}, Le, Re), b(null, null, ze, {
			kind: "field",
			name: "dispersion",
			static: !1,
			private: !1,
			access: {
				has: (e) => "dispersion" in e,
				get: (e) => e.dispersion,
				set: (e, t) => {
					e.dispersion = t;
				}
			},
			metadata: t
		}, Be, Ve), b(null, null, He, {
			kind: "field",
			name: "diffusionDistance",
			static: !1,
			private: !1,
			access: {
				has: (e) => "diffusionDistance" in e,
				get: (e) => e.diffusionDistance,
				set: (e, t) => {
					e.diffusionDistance = t;
				}
			},
			metadata: t
		}, Ue, We), b(null, null, et, {
			kind: "field",
			name: "translucencyColor",
			static: !1,
			private: !1,
			access: {
				has: (e) => "translucencyColor" in e,
				get: (e) => e.translucencyColor,
				set: (e, t) => {
					e.translucencyColor = t;
				}
			},
			metadata: t
		}, tt, nt), b(null, null, lt, {
			kind: "field",
			name: "applyAlbedoAfterSubSurface",
			static: !1,
			private: !1,
			access: {
				has: (e) => "applyAlbedoAfterSubSurface" in e,
				get: (e) => e.applyAlbedoAfterSubSurface,
				set: (e, t) => {
					e.applyAlbedoAfterSubSurface = t;
				}
			},
			metadata: t
		}, ut, dt), b(null, null, ft, {
			kind: "field",
			name: "legacyTranslucency",
			static: !1,
			private: !1,
			access: {
				has: (e) => "legacyTranslucency" in e,
				get: (e) => e.legacyTranslucency,
				set: (e, t) => {
					e.legacyTranslucency = t;
				}
			},
			metadata: t
		}, pt, mt), t && Object.defineProperty(e, Symbol.metadata, {
			enumerable: !0,
			configurable: !0,
			writable: !0,
			value: t
		});
	})(), e.DEFAULT_APPLY_ALBEDO_AFTERSUBSURFACE = !1, e.DEFAULT_LEGACY_TRANSLUCENCY = !1, e;
})(), Q = {
	effect: null,
	subMesh: null
}, Oe = class extends le(de(X)) {}, ke = class extends ce(Oe) {
	constructor(e) {
		super(e), this.PBR = !0, this.NUM_SAMPLES = "0", this.REALTIME_FILTERING = !1, this.IBL_CDF_FILTERING = !1, this.ALBEDO = !1, this.GAMMAALBEDO = !1, this.ALBEDODIRECTUV = 0, this.VERTEXCOLOR = !1, this.BASE_WEIGHT = !1, this.BASE_WEIGHTDIRECTUV = 0, this.BASE_DIFFUSE_ROUGHNESS = !1, this.BASE_DIFFUSE_ROUGHNESSDIRECTUV = 0, this.BAKED_VERTEX_ANIMATION_TEXTURE = !1, this.AMBIENT = !1, this.AMBIENTDIRECTUV = 0, this.AMBIENTINGRAYSCALE = !1, this.OPACITY = !1, this.VERTEXALPHA = !1, this.OPACITYDIRECTUV = 0, this.OPACITYRGB = !1, this.ALPHATEST = !1, this.DEPTHPREPASS = !1, this.ALPHABLEND = !1, this.ALPHAFROMALBEDO = !1, this.ALPHATESTVALUE = "0.5", this.SPECULAROVERALPHA = !1, this.RADIANCEOVERALPHA = !1, this.ALPHAFRESNEL = !1, this.LINEARALPHAFRESNEL = !1, this.PREMULTIPLYALPHA = !1, this.EMISSIVE = !1, this.EMISSIVEDIRECTUV = 0, this.GAMMAEMISSIVE = !1, this.REFLECTIVITY = !1, this.REFLECTIVITY_GAMMA = !1, this.REFLECTIVITYDIRECTUV = 0, this.SPECULARTERM = !1, this.MICROSURFACEFROMREFLECTIVITYMAP = !1, this.MICROSURFACEAUTOMATIC = !1, this.LODBASEDMICROSFURACE = !1, this.MICROSURFACEMAP = !1, this.MICROSURFACEMAPDIRECTUV = 0, this.METALLICWORKFLOW = !1, this.ROUGHNESSSTOREINMETALMAPALPHA = !1, this.ROUGHNESSSTOREINMETALMAPGREEN = !1, this.METALLNESSSTOREINMETALMAPBLUE = !1, this.AOSTOREINMETALMAPRED = !1, this.METALLIC_REFLECTANCE = !1, this.METALLIC_REFLECTANCE_GAMMA = !1, this.METALLIC_REFLECTANCEDIRECTUV = 0, this.METALLIC_REFLECTANCE_USE_ALPHA_ONLY = !1, this.REFLECTANCE = !1, this.REFLECTANCE_GAMMA = !1, this.REFLECTANCEDIRECTUV = 0, this.ENVIRONMENTBRDF = !1, this.ENVIRONMENTBRDF_RGBD = !1, this.NORMAL = !1, this.TANGENT = !1, this.BUMP = !1, this.BUMPDIRECTUV = 0, this.OBJECTSPACE_NORMALMAP = !1, this.PARALLAX = !1, this.PARALLAX_RHS = !1, this.PARALLAXOCCLUSION = !1, this.NORMALXYSCALE = !0, this.LIGHTMAP = !1, this.LIGHTMAPDIRECTUV = 0, this.USELIGHTMAPASSHADOWMAP = !1, this.GAMMALIGHTMAP = !1, this.RGBDLIGHTMAP = !1, this.REFLECTION = !1, this.REFLECTIONMAP_3D = !1, this.REFLECTIONMAP_SPHERICAL = !1, this.REFLECTIONMAP_PLANAR = !1, this.REFLECTIONMAP_CUBIC = !1, this.USE_LOCAL_REFLECTIONMAP_CUBIC = !1, this.REFLECTIONMAP_PROJECTION = !1, this.REFLECTIONMAP_SKYBOX = !1, this.REFLECTIONMAP_EXPLICIT = !1, this.REFLECTIONMAP_EQUIRECTANGULAR = !1, this.REFLECTIONMAP_EQUIRECTANGULAR_FIXED = !1, this.REFLECTIONMAP_MIRROREDEQUIRECTANGULAR_FIXED = !1, this.INVERTCUBICMAP = !1, this.USESPHERICALFROMREFLECTIONMAP = !1, this.USEIRRADIANCEMAP = !1, this.USE_IRRADIANCE_DOMINANT_DIRECTION = !1, this.USESPHERICALINVERTEX = !1, this.REFLECTIONMAP_OPPOSITEZ = !1, this.LODINREFLECTIONALPHA = !1, this.GAMMAREFLECTION = !1, this.RGBDREFLECTION = !1, this.LINEARSPECULARREFLECTION = !1, this.RADIANCEOCCLUSION = !1, this.HORIZONOCCLUSION = !1, this.INSTANCES = !1, this.THIN_INSTANCES = !1, this.INSTANCESCOLOR = !1, this.NUM_BONE_INFLUENCERS = 0, this.BonesPerMesh = 0, this.BONETEXTURE = !1, this.BONES_VELOCITY_ENABLED = !1, this.NONUNIFORMSCALING = !1, this.MORPHTARGETS = !1, this.MORPHTARGETS_POSITION = !1, this.MORPHTARGETS_NORMAL = !1, this.MORPHTARGETS_TANGENT = !1, this.MORPHTARGETS_UV = !1, this.MORPHTARGETS_UV2 = !1, this.MORPHTARGETS_COLOR = !1, this.MORPHTARGETTEXTURE_HASPOSITIONS = !1, this.MORPHTARGETTEXTURE_HASNORMALS = !1, this.MORPHTARGETTEXTURE_HASTANGENTS = !1, this.MORPHTARGETTEXTURE_HASUVS = !1, this.MORPHTARGETTEXTURE_HASUV2S = !1, this.MORPHTARGETTEXTURE_HASCOLORS = !1, this.NUM_MORPH_INFLUENCERS = 0, this.MORPHTARGETS_TEXTURE = !1, this.MULTIVIEW = !1, this.ORDER_INDEPENDENT_TRANSPARENCY = !1, this.ORDER_INDEPENDENT_TRANSPARENCY_16BITS = !1, this.USEPHYSICALLIGHTFALLOFF = !1, this.USEGLTFLIGHTFALLOFF = !1, this.TWOSIDEDLIGHTING = !1, this.MIRRORED = !1, this.SHADOWFLOAT = !1, this.CLIPPLANE = !1, this.CLIPPLANE2 = !1, this.CLIPPLANE3 = !1, this.CLIPPLANE4 = !1, this.CLIPPLANE5 = !1, this.CLIPPLANE6 = !1, this.POINTSIZE = !1, this.FOG = !1, this.LOGARITHMICDEPTH = !1, this.CAMERA_ORTHOGRAPHIC = !1, this.CAMERA_PERSPECTIVE = !1, this.AREALIGHTSUPPORTED = !0, this.FORCENORMALFORWARD = !1, this.SPECULARAA = !1, this.UNLIT = !1, this.DECAL_AFTER_DETAIL = !1, this.TEXTURE_REPETITION_MODE = 0, this.DEBUGMODE = 0, this.USE_VERTEX_PULLING = !1, this.VERTEX_PULLING_USE_INDEX_BUFFER = !1, this.VERTEX_PULLING_INDEX_BUFFER_32BITS = !1, this.RIGHT_HANDED = !1, this.CLUSTLIGHT_SLICES = 0, this.CLUSTLIGHT_BATCH = 0, this.rebuild();
	}
	reset() {
		super.reset(), this.ALPHATESTVALUE = "0.5", this.PBR = !0, this.NORMALXYSCALE = !0;
	}
}, Ae = class extends pe(oe) {}, $ = (() => {
	var t, i;
	let o = Ae, l, d = [], p = [];
	return t = class extends o {
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
		get canRenderToMRT() {
			return !0;
		}
		get debugMode() {
			return f(this, i, "f");
		}
		set debugMode(e) {
			y(this, i, e, "f");
		}
		constructor(e, n, r = !1) {
			super(e, n, void 0, r || t.ForceGLSL), this._directIntensity = 1, this._emissiveIntensity = 1, this._environmentIntensity = 1, this._specularIntensity = 1, this._lightingInfos = new s(this._directIntensity, this._emissiveIntensity, this._environmentIntensity, this._specularIntensity), this._disableBumpMap = !1, this._albedoTexture = null, this._baseWeightTexture = null, this._baseDiffuseRoughnessTexture = null, this._ambientTexture = null, this._ambientTextureStrength = 1, this._ambientTextureImpactOnAnalyticalLights = t.DEFAULT_AO_ON_ANALYTICAL_LIGHTS, this._opacityTexture = null, this._reflectionTexture = null, this._emissiveTexture = null, this._reflectivityTexture = null, this._metallicTexture = null, this._metallic = null, this._roughness = null, this._metallicF0Factor = 1, this._metallicReflectanceColor = u.White(), this._useOnlyMetallicFromMetallicReflectanceTexture = !1, this._metallicReflectanceTexture = null, this._reflectanceTexture = null, this._microSurfaceTexture = null, this._bumpTexture = null, this._lightmapTexture = null, this._ambientColor = new u(0, 0, 0), this._albedoColor = new u(1, 1, 1), this._baseWeight = 1, this._baseDiffuseRoughness = null, this._reflectivityColor = new u(1, 1, 1), this._reflectionColor = new u(1, 1, 1), this._emissiveColor = new u(0, 0, 0), this._microSurface = .9, this._useLightmapAsShadowmap = !1, this._useHorizonOcclusion = !0, this._useRadianceOcclusion = !0, this._useAlphaFromAlbedoTexture = !1, this._useSpecularOverAlpha = !0, this._useMicroSurfaceFromReflectivityMapAlpha = !1, this._useRoughnessFromMetallicTextureAlpha = !0, this._useRoughnessFromMetallicTextureGreen = !1, this._useMetallnessFromMetallicTextureBlue = !1, this._useAmbientOcclusionFromMetallicTextureRed = !1, this._useAmbientInGrayScale = !1, this._useAutoMicroSurfaceFromReflectivityMap = !1, this._lightFalloff = t.LIGHTFALLOFF_PHYSICAL, this._useRadianceOverAlpha = !0, this._useObjectSpaceNormalMap = !1, this._useParallax = !1, this._useParallaxOcclusion = !1, this._parallaxScaleBias = .05, this._disableLighting = !1, this._maxSimultaneousLights = 4, this._invertNormalMapX = !1, this._invertNormalMapY = !1, this._twoSidedLighting = !1, this._alphaCutOff = .4, this._useAlphaFresnel = !1, this._useLinearAlphaFresnel = !1, this._environmentBRDFTexture = null, this._forceIrradianceInFragment = !1, this._realTimeFiltering = !1, this._realTimeFilteringQuality = 8, this._forceNormalForward = !1, this._enableSpecularAntiAliasing = !1, this._renderTargets = new S(16), this._globalAmbientColor = new u(0, 0, 0), this._unlit = !1, this._applyDecalMapAfterDetailMap = !1, this._debugMode = 0, this._breakShaderLoadedCheck = !1, this._vertexPullingMetadata = null, i.set(this, m(this, d, 0)), this.debugLimit = (m(this, p), -1), this.debugFactor = 1, this._cacheHasRenderTargetTextures = !1, this.brdf = new _e(this), this.clearCoat = new ye(this), this.iridescence = new xe(this), this.anisotropy = new Ce(this), this.sheen = new Te(this), this.subSurface = new De(this), this.detailMap = new me(this), this._attachImageProcessingConfiguration(null), this.getRenderTargetTextures = () => (this._renderTargets.reset(), z.ReflectionTextureEnabled && this._reflectionTexture && this._reflectionTexture.isRenderTarget && this._renderTargets.push(this._reflectionTexture), this._eventInfo.renderTargets = this._renderTargets, this._callbackPluginEventFillRenderTargetTextures(this._eventInfo), this._renderTargets), this._environmentBRDFTexture = he(this.getScene()), this.prePassConfiguration = new J();
		}
		get hasRenderTargetTextures() {
			return z.ReflectionTextureEnabled && this._reflectionTexture && this._reflectionTexture.isRenderTarget ? !0 : this._cacheHasRenderTargetTextures;
		}
		get isPrePassCapable() {
			return !this.disableDepthWrite;
		}
		getClassName() {
			return "PBRBaseMaterial";
		}
		get _disableAlphaBlending() {
			return this._transparencyMode === t.PBRMATERIAL_OPAQUE || this._transparencyMode === t.PBRMATERIAL_ALPHATEST || this.subSurface?.disableAlphaBlending;
		}
		needAlphaBlending() {
			return this._hasTransparencyMode ? this._transparencyModeIsBlend : this._disableAlphaBlending ? !1 : this.alpha < 1 || this._opacityTexture != null || this._shouldUseAlphaFromAlbedoTexture();
		}
		needAlphaTesting() {
			return this._hasTransparencyMode ? this._transparencyModeIsTest : !this.subSurface?.disableAlphaBlending && this._hasAlphaChannel() && (this._transparencyMode == null || this._transparencyMode === t.PBRMATERIAL_ALPHATEST);
		}
		_shouldUseAlphaFromAlbedoTexture() {
			return this._albedoTexture != null && this._albedoTexture.hasAlpha && this._useAlphaFromAlbedoTexture && this._transparencyMode !== t.PBRMATERIAL_OPAQUE;
		}
		_hasAlphaChannel() {
			return this._albedoTexture != null && this._albedoTexture.hasAlpha || this._opacityTexture != null;
		}
		getAlphaTestTexture() {
			return this._albedoTexture;
		}
		isReadyForSubMesh(t, n, r) {
			this._uniformBufferLayoutBuilt || this.buildUniformLayout();
			let i = n._drawWrapper;
			if (i.effect && this.isFrozen && i._wasPreviouslyReady && i._wasPreviouslyUsingInstances === r) return !0;
			n.materialDefines ||= (this._callbackPluginEventGeneric(4, this._eventInfo), new ke(this._eventInfo.defineNames));
			let o = n.materialDefines;
			if (this._isReadyForSubMesh(n)) return !0;
			let s = this.getScene(), c = s.getEngine();
			if (o._areTexturesDirty && (this._eventInfo.hasRenderTargetTextures = !1, this._callbackPluginEventHasRenderTargetTextures(this._eventInfo), this._cacheHasRenderTargetTextures = this._eventInfo.hasRenderTargetTextures, s.texturesEnabled)) {
				if (this._albedoTexture && z.DiffuseTextureEnabled && !this._albedoTexture.isReadyOrNotBlocking() || this._baseWeightTexture && z.BaseWeightTextureEnabled && !this._baseWeightTexture.isReadyOrNotBlocking() || this._baseDiffuseRoughnessTexture && z.BaseDiffuseRoughnessTextureEnabled && !this._baseDiffuseRoughnessTexture.isReadyOrNotBlocking() || this._ambientTexture && z.AmbientTextureEnabled && !this._ambientTexture.isReadyOrNotBlocking() || this._opacityTexture && z.OpacityTextureEnabled && !this._opacityTexture.isReadyOrNotBlocking()) return !1;
				let e = this._getReflectionTexture();
				if (e && z.ReflectionTextureEnabled) {
					if (!e.isReadyOrNotBlocking()) return !1;
					if (e.irradianceTexture) {
						if (!e.irradianceTexture.isReadyOrNotBlocking()) return !1;
					} else if (!e.sphericalPolynomial && e.getInternalTexture()?._sphericalPolynomialPromise) return !1;
				}
				if (this._lightmapTexture && z.LightmapTextureEnabled && !this._lightmapTexture.isReadyOrNotBlocking() || this._emissiveTexture && z.EmissiveTextureEnabled && !this._emissiveTexture.isReadyOrNotBlocking()) return !1;
				if (z.SpecularTextureEnabled) {
					if (this._metallicTexture) {
						if (!this._metallicTexture.isReadyOrNotBlocking()) return !1;
					} else if (this._reflectivityTexture && !this._reflectivityTexture.isReadyOrNotBlocking()) return !1;
					if (this._metallicReflectanceTexture && !this._metallicReflectanceTexture.isReadyOrNotBlocking() || this._reflectanceTexture && !this._reflectanceTexture.isReadyOrNotBlocking() || this._microSurfaceTexture && !this._microSurfaceTexture.isReadyOrNotBlocking()) return !1;
				}
				if (c.getCaps().standardDerivatives && this._bumpTexture && z.BumpTextureEnabled && !this._disableBumpMap && !this._bumpTexture.isReady() || this._environmentBRDFTexture && z.ReflectionTextureEnabled && !this._environmentBRDFTexture.isReady()) return !1;
			}
			if (this._eventInfo.isReadyForSubMesh = !0, this._eventInfo.defines = o, this._eventInfo.subMesh = n, this._callbackPluginEventIsReadyForSubMesh(this._eventInfo), !this._eventInfo.isReadyForSubMesh || o._areImageProcessingDirty && this._imageProcessingConfiguration && !this._imageProcessingConfiguration.isReady()) return !1;
			if (o.AREALIGHTUSED || o.CLUSTLIGHT_BATCH) {
				for (let e = 0; e < t.lightSources.length; e++) if (!t.lightSources[e]._isReady()) return !1;
			}
			if (!c.getCaps().standardDerivatives && !t.isVerticesDataPresent(a.NormalKind) && (t.createNormals(!0), e.Warn("PBRMaterial: Normals have been created for the mesh: " + t.name)), !U(s, t, this._maxSimultaneousLights, this._disableLighting)) return !1;
			let l = n.effect, u = o._areLightsDisposed, d = this._prepareEffect(t, n.getRenderingMesh(), o, this.onCompiled, this.onError, r, null), f = !1;
			if (d) {
				if (this._onEffectCreatedObservable && (Q.effect = d, Q.subMesh = n, this._onEffectCreatedObservable.notifyObservers(Q)), this.allowShaderHotSwapping && l && !d.isReady()) {
					if (o.markAsUnprocessed(), f = this.isFrozen, u) return o._areLightsDisposed = !0, !1;
				} else s.resetCachedMaterial(), n.setEffect(d, o, this._materialContext);
			}
			return !n.effect || !n.effect.isReady() ? !1 : (o._renderId = s.getRenderId(), i._wasPreviouslyReady = !f, i._wasPreviouslyUsingInstances = !!r, this._checkScenePerformancePriority(), !0);
		}
		isMetallicWorkflow() {
			return !!(this._metallic != null || this._roughness != null || this._metallicTexture);
		}
		_prepareEffect(e, n, i, o = null, s = null, c = null, l = null) {
			if (this._prepareDefines(e, n, i, c, l), !i.isDirty) return null;
			i.markAsProcessed();
			let u = this.getScene().getEngine(), d = new fe(), f = 0;
			i.USESPHERICALINVERTEX && d.addFallback(f++, "USESPHERICALINVERTEX"), i.FOG && d.addFallback(f, "FOG"), i.SPECULARAA && d.addFallback(f, "SPECULARAA"), i.POINTSIZE && d.addFallback(f, "POINTSIZE"), i.LOGARITHMICDEPTH && d.addFallback(f, "LOGARITHMICDEPTH"), i.PARALLAX && d.addFallback(f, "PARALLAX"), i.PARALLAX_RHS && d.addFallback(f, "PARALLAX_RHS"), i.PARALLAXOCCLUSION && d.addFallback(f++, "PARALLAXOCCLUSION"), i.ENVIRONMENTBRDF && d.addFallback(f++, "ENVIRONMENTBRDF"), i.TANGENT && d.addFallback(f++, "TANGENT"), i.BUMP && d.addFallback(f++, "BUMP"), f = F(i, d, this._maxSimultaneousLights, f), i.SPECULARTERM && d.addFallback(f++, "SPECULARTERM"), i.USESPHERICALFROMREFLECTIONMAP && d.addFallback(f++, "USESPHERICALFROMREFLECTIONMAP"), i.USEIRRADIANCEMAP && d.addFallback(f++, "USEIRRADIANCEMAP"), i.LIGHTMAP && d.addFallback(f++, "LIGHTMAP"), i.NORMAL && d.addFallback(f++, "NORMAL"), i.AMBIENT && d.addFallback(f++, "AMBIENT"), i.EMISSIVE && d.addFallback(f++, "EMISSIVE"), i.VERTEXCOLOR && d.addFallback(f++, "VERTEXCOLOR"), i.MORPHTARGETS && d.addFallback(f++, "MORPHTARGETS"), i.MULTIVIEW && d.addFallback(0, "MULTIVIEW");
			let p = [a.PositionKind];
			i.NORMAL && p.push(a.NormalKind), i.TANGENT && p.push(a.TangentKind);
			for (let e = 1; e <= 6; ++e) i["UV" + e] && p.push(`uv${e === 1 ? "" : e}`);
			i.VERTEXCOLOR && p.push(a.ColorKind), H(p, e, i, d), L(p, i), I(p, e, i), G(p, e, i);
			let m = "pbr", h = /* @__PURE__ */ "world.view.viewProjection.vEyePosition.vLightsType.vAmbientColor.vAlbedoColor.baseWeight.baseDiffuseRoughness.vReflectivityColor.vMetallicReflectanceFactors.vEmissiveColor.visibility.vFogInfos.vFogColor.pointSize.vAlbedoInfos.vBaseWeightInfos.vBaseDiffuseRoughnessInfos.vAmbientInfos.vOpacityInfos.vEmissiveInfos.vReflectivityInfos.vMetallicReflectanceInfos.vReflectanceInfos.vMicroSurfaceSamplerInfos.vBumpInfos.vLightmapInfos.mBones.albedoMatrix.baseWeightMatrix.baseDiffuseRoughnessMatrix.ambientMatrix.opacityMatrix.emissiveMatrix.reflectivityMatrix.normalMatrix.microSurfaceSamplerMatrix.bumpMatrix.lightmapMatrix.metallicReflectanceMatrix.reflectanceMatrix.vLightingIntensity.logarithmicDepthConstant.vTangentSpaceParams.boneTextureInfo.vDebugMode.morphTargetTextureInfo.morphTargetTextureIndices.cameraInfo.vTextureRepetitionHexTilingParams".split("."), g = [
				"albedoSampler",
				"baseWeightSampler",
				"baseDiffuseRoughnessSampler",
				"reflectivitySampler",
				"ambientSampler",
				"emissiveSampler",
				"bumpSampler",
				"lightmapSampler",
				"opacitySampler",
				"microSurfaceSampler",
				"environmentBrdfSampler",
				"boneSampler",
				"metallicReflectanceSampler",
				"reflectanceSampler",
				"morphTargets",
				"oitDepthSampler",
				"oitFrontColorSampler",
				"areaLightsLTC1Sampler",
				"areaLightsLTC2Sampler"
			];
			O(h, g, !0);
			let _ = [
				"Material",
				"Scene",
				"Mesh"
			], v = {
				maxSimultaneousLights: this._maxSimultaneousLights,
				maxSimultaneousMorphTargets: i.NUM_MORPH_INFLUENCERS
			};
			if (this._eventInfo.fallbacks = d, this._eventInfo.fallbackRank = f, this._eventInfo.defines = i, this._eventInfo.uniforms = h, this._eventInfo.attributes = p, this._eventInfo.samplers = g, this._eventInfo.uniformBuffersNames = _, this._eventInfo.customCode = void 0, this._eventInfo.mesh = e, this._eventInfo.indexParameters = v, this._callbackPluginEventGeneric(128, this._eventInfo), Y.AddUniformsAndSamplers(h, g), J.AddUniforms(h), J.AddSamplers(g), E(h), this._useVertexPulling) {
				let e = n?.geometry;
				e && (this._vertexPullingMetadata = ue(e), this._vertexPullingMetadata && this._vertexPullingMetadata.forEach((e, t) => {
					h.push(`vp_${t}_info`);
				}));
			} else this._vertexPullingMetadata = null;
			r && (r.PrepareUniforms(h, i), r.PrepareSamplers(g, i)), B({
				uniformsNames: h,
				uniformBuffersNames: _,
				samplers: g,
				defines: i,
				maxSimultaneousLights: this._maxSimultaneousLights,
				shaderLanguage: this._shaderLanguage
			});
			let y = {};
			this.customShaderNameResolve && (m = this.customShaderNameResolve(m, h, _, g, i, p, y));
			let b = i.toString(), x = u.createEffect(m, {
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
			return this._eventInfo.customCode = void 0, x;
		}
		_prepareDefines(e, n, r, i = null, o = null) {
			let s = n.hasThinInstances, c = this.getScene(), l = c.getEngine();
			re(c, e, r, !0, this._maxSimultaneousLights, this._disableLighting), r._needNormals = !0, ne(c, r);
			let u = this.needAlphaBlendingForMesh(e) && this.getScene().useOrderIndependentTransparency;
			if (T(c, r, this.canRenderToMRT && !u), A(c, r, u), Y.PrepareDefines(l.currentRenderPassId, e, r), r.METALLICWORKFLOW = this.isMetallicWorkflow(), r._areTexturesDirty) {
				r._needUVs = !1;
				for (let e = 1; e <= 6; ++e) r["MAINUV" + e] = !1;
				if (c.texturesEnabled) {
					r.ALBEDODIRECTUV = 0, r.BASE_WEIGHTDIRECTUV = 0, r.BASE_DIFFUSE_ROUGHNESSDIRECTUV = 0, r.AMBIENTDIRECTUV = 0, r.OPACITYDIRECTUV = 0, r.EMISSIVEDIRECTUV = 0, r.REFLECTIVITYDIRECTUV = 0, r.MICROSURFACEMAPDIRECTUV = 0, r.METALLIC_REFLECTANCEDIRECTUV = 0, r.REFLECTANCEDIRECTUV = 0, r.BUMPDIRECTUV = 0, r.LIGHTMAPDIRECTUV = 0, l.getCaps().textureLOD && (r.LODBASEDMICROSFURACE = !0), this._albedoTexture && z.DiffuseTextureEnabled ? (k(this._albedoTexture, r, "ALBEDO"), r.GAMMAALBEDO = this._albedoTexture.gammaSpace) : r.ALBEDO = !1, this._baseWeightTexture && z.BaseWeightTextureEnabled ? k(this._baseWeightTexture, r, "BASE_WEIGHT") : r.BASE_WEIGHT = !1, this._baseDiffuseRoughnessTexture && z.BaseDiffuseRoughnessTextureEnabled ? k(this._baseDiffuseRoughnessTexture, r, "BASE_DIFFUSE_ROUGHNESS") : r.BASE_DIFFUSE_ROUGHNESS = !1, this._ambientTexture && z.AmbientTextureEnabled ? (k(this._ambientTexture, r, "AMBIENT"), r.AMBIENTINGRAYSCALE = this._useAmbientInGrayScale) : r.AMBIENT = !1, this._opacityTexture && z.OpacityTextureEnabled ? (k(this._opacityTexture, r, "OPACITY"), r.OPACITYRGB = this._opacityTexture.getAlphaFromRGB) : r.OPACITY = !1;
					let e = this._getReflectionTexture(), t = this._forceIrradianceInFragment || this.realTimeFiltering || this._twoSidedLighting || l.getCaps().maxVaryingVectors <= 8 || this._baseDiffuseRoughnessTexture != null;
					M(c, e, r, this.realTimeFiltering, this.realTimeFilteringQuality, !t), this._lightmapTexture && z.LightmapTextureEnabled ? (k(this._lightmapTexture, r, "LIGHTMAP"), r.USELIGHTMAPASSHADOWMAP = this._useLightmapAsShadowmap, r.GAMMALIGHTMAP = this._lightmapTexture.gammaSpace, r.RGBDLIGHTMAP = this._lightmapTexture.isRGBD) : r.LIGHTMAP = !1, this._emissiveTexture && z.EmissiveTextureEnabled ? (k(this._emissiveTexture, r, "EMISSIVE"), r.GAMMAEMISSIVE = this._emissiveTexture.gammaSpace) : r.EMISSIVE = !1, z.SpecularTextureEnabled ? (this._metallicTexture ? (k(this._metallicTexture, r, "REFLECTIVITY"), r.ROUGHNESSSTOREINMETALMAPALPHA = this._useRoughnessFromMetallicTextureAlpha, r.ROUGHNESSSTOREINMETALMAPGREEN = !this._useRoughnessFromMetallicTextureAlpha && this._useRoughnessFromMetallicTextureGreen, r.METALLNESSSTOREINMETALMAPBLUE = this._useMetallnessFromMetallicTextureBlue, r.AOSTOREINMETALMAPRED = this._useAmbientOcclusionFromMetallicTextureRed, r.REFLECTIVITY_GAMMA = !1) : this._reflectivityTexture ? (k(this._reflectivityTexture, r, "REFLECTIVITY"), r.MICROSURFACEFROMREFLECTIVITYMAP = this._useMicroSurfaceFromReflectivityMapAlpha, r.MICROSURFACEAUTOMATIC = this._useAutoMicroSurfaceFromReflectivityMap, r.REFLECTIVITY_GAMMA = this._reflectivityTexture.gammaSpace) : r.REFLECTIVITY = !1, this._metallicReflectanceTexture || this._reflectanceTexture ? (r.METALLIC_REFLECTANCE_USE_ALPHA_ONLY = this._useOnlyMetallicFromMetallicReflectanceTexture, this._metallicReflectanceTexture ? (k(this._metallicReflectanceTexture, r, "METALLIC_REFLECTANCE"), r.METALLIC_REFLECTANCE_GAMMA = this._metallicReflectanceTexture.gammaSpace) : r.METALLIC_REFLECTANCE = !1, this._reflectanceTexture && (!this._metallicReflectanceTexture || this._metallicReflectanceTexture && this._useOnlyMetallicFromMetallicReflectanceTexture) ? (k(this._reflectanceTexture, r, "REFLECTANCE"), r.REFLECTANCE_GAMMA = this._reflectanceTexture.gammaSpace) : r.REFLECTANCE = !1) : (r.METALLIC_REFLECTANCE = !1, r.REFLECTANCE = !1), this._microSurfaceTexture ? k(this._microSurfaceTexture, r, "MICROSURFACEMAP") : r.MICROSURFACEMAP = !1) : (r.REFLECTIVITY = !1, r.MICROSURFACEMAP = !1), l.getCaps().standardDerivatives && this._bumpTexture && z.BumpTextureEnabled && !this._disableBumpMap ? (k(this._bumpTexture, r, "BUMP"), this._useParallax && this._albedoTexture && z.DiffuseTextureEnabled ? (r.PARALLAX = !0, r.PARALLAX_RHS = c.useRightHandedSystem, r.PARALLAXOCCLUSION = !!this._useParallaxOcclusion) : r.PARALLAX = !1, r.OBJECTSPACE_NORMALMAP = this._useObjectSpaceNormalMap) : (r.BUMP = !1, r.PARALLAX = !1, r.PARALLAX_RHS = !1, r.PARALLAXOCCLUSION = !1, r.OBJECTSPACE_NORMALMAP = !1), this._environmentBRDFTexture && z.ReflectionTextureEnabled ? (r.ENVIRONMENTBRDF = !0, r.ENVIRONMENTBRDF_RGBD = this._environmentBRDFTexture.isRGBD) : (r.ENVIRONMENTBRDF = !1, r.ENVIRONMENTBRDF_RGBD = !1), r.ALPHAFROMALBEDO = !!this._shouldUseAlphaFromAlbedoTexture();
				}
				r.SPECULAROVERALPHA = this._useSpecularOverAlpha, this._lightFalloff === t.LIGHTFALLOFF_STANDARD ? (r.USEPHYSICALLIGHTFALLOFF = !1, r.USEGLTFLIGHTFALLOFF = !1) : this._lightFalloff === t.LIGHTFALLOFF_GLTF ? (r.USEPHYSICALLIGHTFALLOFF = !1, r.USEGLTFLIGHTFALLOFF = !0) : (r.USEPHYSICALLIGHTFALLOFF = !0, r.USEGLTFLIGHTFALLOFF = !1), r.RADIANCEOVERALPHA = this._useRadianceOverAlpha, r.TWOSIDEDLIGHTING = !(this.backFaceCulling || !this._twoSidedLighting), r.MIRRORED = !!c._mirroredCameraPosition, r.SPECULARAA = l.getCaps().standardDerivatives && this._enableSpecularAntiAliasing;
			}
			(r._areTexturesDirty || r._areMiscDirty) && (r.ALPHATESTVALUE = `${this._alphaCutOff}${this._alphaCutOff % 1 == 0 ? "." : ""}`, r.PREMULTIPLYALPHA = this.alphaMode === 7 || this.alphaMode === 8, r.ALPHABLEND = this.needAlphaBlendingForMesh(e), r.ALPHAFRESNEL = this._useAlphaFresnel || this._useLinearAlphaFresnel, r.LINEARALPHAFRESNEL = this._useLinearAlphaFresnel), r._areTexturesDirty && (r.TEXTURE_REPETITION_MODE = l.version > 1 || l.isWebGPU ? this.textureRepetitionMode : 0), r._areImageProcessingDirty && this._imageProcessingConfiguration && this._imageProcessingConfiguration.prepareDefines(r), r.FORCENORMALFORWARD = this._forceNormalForward, r.RADIANCEOCCLUSION = this._useRadianceOcclusion, r.HORIZONOCCLUSION = this._useHorizonOcclusion, r._areMiscDirty && (C(e, c, this._useLogarithmicDepth, this.pointsCloud, this.fogEnabled, this.needAlphaTestingForMesh(e), r, this._applyDecalMapAfterDetailMap, this._useVertexPulling, n, this._isVertexOutputInvariant), r.UNLIT = this._unlit || (this.pointsCloud || this.wireframe) && !e.isVerticesDataPresent(a.NormalKind), r.DEBUGMODE = this._debugMode), ie(c, l, this, r, !!i, o, s), this._eventInfo.defines = r, this._eventInfo.mesh = e, this._callbackPluginEventPrepareDefinesBeforeAttributes(this._eventInfo), te(e, r, !0, !0, !0, this._transparencyMode !== t.PBRMATERIAL_OPAQUE), this._callbackPluginEventPrepareDefines(this._eventInfo);
		}
		forceCompilation(e, t, n) {
			let r = {
				clipPlane: !1,
				useInstances: !1,
				...n
			};
			this._uniformBufferLayoutBuilt || this.buildUniformLayout(), this._callbackPluginEventGeneric(4, this._eventInfo), (() => {
				if (this._breakShaderLoadedCheck) return;
				let n = new ke(this._eventInfo.defineNames), i = this._prepareEffect(e, e, n, void 0, void 0, r.useInstances, r.clipPlane);
				this._onEffectCreatedObservable && (Q.effect = i, Q.subMesh = null, this._onEffectCreatedObservable.notifyObservers(Q)), i.isReady() ? t && t(this) : i.onCompileObservable.add(() => {
					t && t(this);
				});
			})();
		}
		buildUniformLayout() {
			let e = this._uniformBuffer;
			e.addUniform("vAlbedoInfos", 2), e.addUniform("vBaseWeightInfos", 2), e.addUniform("vBaseDiffuseRoughnessInfos", 2), e.addUniform("vAmbientInfos", 4), e.addUniform("vOpacityInfos", 2), e.addUniform("vEmissiveInfos", 2), e.addUniform("vLightmapInfos", 2), e.addUniform("vReflectivityInfos", 3), e.addUniform("vMicroSurfaceSamplerInfos", 2), e.addUniform("vBumpInfos", 3), e.addUniform("albedoMatrix", 16), e.addUniform("baseWeightMatrix", 16), e.addUniform("baseDiffuseRoughnessMatrix", 16), e.addUniform("ambientMatrix", 16), e.addUniform("opacityMatrix", 16), e.addUniform("emissiveMatrix", 16), e.addUniform("lightmapMatrix", 16), e.addUniform("reflectivityMatrix", 16), e.addUniform("microSurfaceSamplerMatrix", 16), e.addUniform("bumpMatrix", 16), e.addUniform("vTangentSpaceParams", 2), e.addUniform("vAlbedoColor", 4), e.addUniform("baseWeight", 1), e.addUniform("baseDiffuseRoughness", 1), e.addUniform("vLightingIntensity", 4), e.addUniform("pointSize", 1), e.addUniform("vReflectivityColor", 4), e.addUniform("vEmissiveColor", 3), e.addUniform("vAmbientColor", 3), e.addUniform("vDebugMode", 2), e.addUniform("vMetallicReflectanceFactors", 4), e.addUniform("vMetallicReflectanceInfos", 2), e.addUniform("metallicReflectanceMatrix", 16), e.addUniform("vReflectanceInfos", 2), e.addUniform("reflectanceMatrix", 16), e.addUniform("cameraInfo", 4), e.addUniform("vTextureRepetitionHexTilingParams", 4), w(e, !0, !0, !0, !0, !0), super.buildUniformLayout();
		}
		bindForSubMesh(e, t, r) {
			let i = this.getScene(), a = r.materialDefines;
			if (!a) return;
			let o = r.effect;
			if (!o) return;
			this._activeEffect = o, t.getMeshUniformBuffer().bindToEffect(o, "Mesh"), t.transferToEffect(e);
			let s = i.getEngine();
			this._uniformBuffer.bindToEffect(o, "Material"), this.prePassConfiguration.bindForSubMesh(this._activeEffect, i, t, e, this.isFrozen), Y.Bind(s.currentRenderPassId, this._activeEffect, t, e, this);
			let l = i.activeCamera;
			l ? this._uniformBuffer.updateFloat4("cameraInfo", l.minZ, l.maxZ, 0, 0) : this._uniformBuffer.updateFloat4("cameraInfo", 0, 0, 0, 0);
			let d = this.textureRepetitionHexTilingParams;
			this._uniformBuffer.updateFloat4("vTextureRepetitionHexTilingParams", d[0], d[1], d[2], d[3]), this._eventInfo.subMesh = r, this._callbackPluginEventHardBindForSubMesh(this._eventInfo), a.OBJECTSPACE_NORMALMAP && (e.toNormalMatrix(this._normalMatrix), this.bindOnlyNormalMatrix(this._normalMatrix));
			let f = this._mustRebind(i, o, r, t.visibility), p = s._features.needToAlwaysBindUniformBuffers;
			K(t, this._activeEffect, this.prePassConfiguration), this._vertexPullingMetadata && ae(this._activeEffect, this._vertexPullingMetadata);
			let m = null, h = this._uniformBuffer;
			if (f) {
				if (this.bindViewProjection(o), m = this._getReflectionTexture(), !h.useUbo || !this.isFrozen || !h.isSync || r._drawWrapper._forceRebindOnNextCall) {
					if (i.texturesEnabled && (this._albedoTexture && z.DiffuseTextureEnabled && (h.updateFloat2("vAlbedoInfos", this._albedoTexture.coordinatesIndex, this._albedoTexture.level), P(this._albedoTexture, h, "albedo")), this._baseWeightTexture && z.BaseWeightTextureEnabled && (h.updateFloat2("vBaseWeightInfos", this._baseWeightTexture.coordinatesIndex, this._baseWeightTexture.level), P(this._baseWeightTexture, h, "baseWeight")), this._baseDiffuseRoughnessTexture && z.BaseDiffuseRoughnessTextureEnabled && (h.updateFloat2("vBaseDiffuseRoughnessInfos", this._baseDiffuseRoughnessTexture.coordinatesIndex, this._baseDiffuseRoughnessTexture.level), P(this._baseDiffuseRoughnessTexture, h, "baseDiffuseRoughness")), this._ambientTexture && z.AmbientTextureEnabled && (h.updateFloat4("vAmbientInfos", this._ambientTexture.coordinatesIndex, this._ambientTexture.level, this._ambientTextureStrength, this._ambientTextureImpactOnAnalyticalLights), P(this._ambientTexture, h, "ambient")), this._opacityTexture && z.OpacityTextureEnabled && (h.updateFloat2("vOpacityInfos", this._opacityTexture.coordinatesIndex, this._opacityTexture.level), P(this._opacityTexture, h, "opacity")), this._emissiveTexture && z.EmissiveTextureEnabled && (h.updateFloat2("vEmissiveInfos", this._emissiveTexture.coordinatesIndex, this._emissiveTexture.level), P(this._emissiveTexture, h, "emissive")), this._lightmapTexture && z.LightmapTextureEnabled && (h.updateFloat2("vLightmapInfos", this._lightmapTexture.coordinatesIndex, this._lightmapTexture.level), P(this._lightmapTexture, h, "lightmap")), z.SpecularTextureEnabled && (this._metallicTexture ? (h.updateFloat3("vReflectivityInfos", this._metallicTexture.coordinatesIndex, this._metallicTexture.level, this._ambientTextureStrength), P(this._metallicTexture, h, "reflectivity")) : this._reflectivityTexture && (h.updateFloat3("vReflectivityInfos", this._reflectivityTexture.coordinatesIndex, this._reflectivityTexture.level, 1), P(this._reflectivityTexture, h, "reflectivity")), this._metallicReflectanceTexture && (h.updateFloat2("vMetallicReflectanceInfos", this._metallicReflectanceTexture.coordinatesIndex, this._metallicReflectanceTexture.level), P(this._metallicReflectanceTexture, h, "metallicReflectance")), this._reflectanceTexture && a.REFLECTANCE && (h.updateFloat2("vReflectanceInfos", this._reflectanceTexture.coordinatesIndex, this._reflectanceTexture.level), P(this._reflectanceTexture, h, "reflectance")), this._microSurfaceTexture && (h.updateFloat2("vMicroSurfaceSamplerInfos", this._microSurfaceTexture.coordinatesIndex, this._microSurfaceTexture.level), P(this._microSurfaceTexture, h, "microSurfaceSampler"))), this._bumpTexture && s.getCaps().standardDerivatives && z.BumpTextureEnabled && !this._disableBumpMap && (h.updateFloat3("vBumpInfos", this._bumpTexture.coordinatesIndex, this._bumpTexture.level, this._parallaxScaleBias), P(this._bumpTexture, h, "bump"), i._mirroredCameraPosition ? h.updateFloat2("vTangentSpaceParams", this._invertNormalMapX ? 1 : -1, this._invertNormalMapY ? 1 : -1) : h.updateFloat2("vTangentSpaceParams", this._invertNormalMapX ? -1 : 1, this._invertNormalMapY ? -1 : 1)), j(i, a, h, this._reflectionColor, m, this.realTimeFiltering, !0, !0, !0, !0, !0)), this.pointsCloud && h.updateFloat("pointSize", this.pointSize), a.METALLICWORKFLOW) {
						c.Color4[0].r = this._metallic === void 0 || this._metallic === null ? 1 : this._metallic, c.Color4[0].g = this._roughness === void 0 || this._roughness === null ? 1 : this._roughness;
						let e = this.subSurface?._indexOfRefraction ?? 1.5;
						c.Color4[0].b = e;
						let t = ((e - 1) / (e + 1)) ** 2;
						c.Color4[0].a = t, h.updateDirectColor4("vReflectivityColor", c.Color4[0]), h.updateColor4("vMetallicReflectanceFactors", this._metallicReflectanceColor, this._metallicF0Factor);
					} else h.updateColor4("vReflectivityColor", this._reflectivityColor, this._microSurface);
					h.updateColor3("vEmissiveColor", z.EmissiveTextureEnabled ? this._emissiveColor : u.BlackReadOnly), !a.SS_REFRACTION && this.subSurface?._linkRefractionWithTransparency ? h.updateColor4("vAlbedoColor", this._albedoColor, 1) : h.updateColor4("vAlbedoColor", this._albedoColor, this.alpha), h.updateFloat("baseWeight", this._baseWeight), h.updateFloat("baseDiffuseRoughness", this._baseDiffuseRoughness || 0), this._lightingInfos.x = this._directIntensity, this._lightingInfos.y = this._emissiveIntensity, this._lightingInfos.z = this._environmentIntensity * i.environmentIntensity, this._lightingInfos.w = this._specularIntensity, h.updateVector4("vLightingIntensity", this._lightingInfos), i.ambientColor.multiplyToRef(this._ambientColor, this._globalAmbientColor), h.updateColor3("vAmbientColor", this._globalAmbientColor), h.updateFloat2("vDebugMode", this.debugLimit, this.debugFactor);
				}
				i.texturesEnabled && (this._albedoTexture && z.DiffuseTextureEnabled && h.setTexture("albedoSampler", this._albedoTexture), this._baseWeightTexture && z.BaseWeightTextureEnabled && h.setTexture("baseWeightSampler", this._baseWeightTexture), this._baseDiffuseRoughnessTexture && z.BaseDiffuseRoughnessTextureEnabled && h.setTexture("baseDiffuseRoughnessSampler", this._baseDiffuseRoughnessTexture), this._ambientTexture && z.AmbientTextureEnabled && h.setTexture("ambientSampler", this._ambientTexture), this._opacityTexture && z.OpacityTextureEnabled && h.setTexture("opacitySampler", this._opacityTexture), W(i, a, h, m, this.realTimeFiltering), a.ENVIRONMENTBRDF && h.setTexture("environmentBrdfSampler", this._environmentBRDFTexture), this._emissiveTexture && z.EmissiveTextureEnabled && h.setTexture("emissiveSampler", this._emissiveTexture), this._lightmapTexture && z.LightmapTextureEnabled && h.setTexture("lightmapSampler", this._lightmapTexture), z.SpecularTextureEnabled && (this._metallicTexture ? h.setTexture("reflectivitySampler", this._metallicTexture) : this._reflectivityTexture && h.setTexture("reflectivitySampler", this._reflectivityTexture), this._metallicReflectanceTexture && h.setTexture("metallicReflectanceSampler", this._metallicReflectanceTexture), this._reflectanceTexture && a.REFLECTANCE && h.setTexture("reflectanceSampler", this._reflectanceTexture), this._microSurfaceTexture && h.setTexture("microSurfaceSampler", this._microSurfaceTexture)), this._bumpTexture && s.getCaps().standardDerivatives && z.BumpTextureEnabled && !this._disableBumpMap && h.setTexture("bumpSampler", this._bumpTexture)), this.getScene().useOrderIndependentTransparency && this.needAlphaBlendingForMesh(t) && this.getScene().depthPeelingRenderer.bind(o), this._eventInfo.subMesh = r, this._callbackPluginEventBindForSubMesh(this._eventInfo), D(this._activeEffect, this, i), this.bindEyePosition(o);
			} else p && (this._needToBindSceneUbo = !0);
			(f || !this.isFrozen || p) && i.lightsEnabled && !this._disableLighting && q(i, t, this._activeEffect, a, this._maxSimultaneousLights), (f || !this.isFrozen) && ((i.fogEnabled && t.applyFog && i.fogMode !== n.FOGMODE_NONE || m || this.subSurface.refractionTexture || t.receiveShadows || a.PREPASS || a.CLUSTLIGHT_BATCH) && this.bindView(o), R(i, t, this._activeEffect, !0), a.NUM_MORPH_INFLUENCERS && V(t, this._activeEffect), a.BAKED_VERTEX_ANIMATION_TEXTURE && t.bakedVertexAnimationManager?.bind(o, a.INSTANCES), this._imageProcessingConfiguration.bind(this._activeEffect), N(a, this._activeEffect, i)), this._afterBind(t, this._activeEffect, r), h.update();
		}
		getAnimatables() {
			let e = super.getAnimatables();
			return this._albedoTexture && this._albedoTexture.animations && this._albedoTexture.animations.length > 0 && e.push(this._albedoTexture), this._baseWeightTexture && this._baseWeightTexture.animations && this._baseWeightTexture.animations.length > 0 && e.push(this._baseWeightTexture), this._baseDiffuseRoughnessTexture && this._baseDiffuseRoughnessTexture.animations && this._baseDiffuseRoughnessTexture.animations.length > 0 && e.push(this._baseDiffuseRoughnessTexture), this._ambientTexture && this._ambientTexture.animations && this._ambientTexture.animations.length > 0 && e.push(this._ambientTexture), this._opacityTexture && this._opacityTexture.animations && this._opacityTexture.animations.length > 0 && e.push(this._opacityTexture), this._reflectionTexture && this._reflectionTexture.animations && this._reflectionTexture.animations.length > 0 && e.push(this._reflectionTexture), this._emissiveTexture && this._emissiveTexture.animations && this._emissiveTexture.animations.length > 0 && e.push(this._emissiveTexture), this._metallicTexture && this._metallicTexture.animations && this._metallicTexture.animations.length > 0 ? e.push(this._metallicTexture) : this._reflectivityTexture && this._reflectivityTexture.animations && this._reflectivityTexture.animations.length > 0 && e.push(this._reflectivityTexture), this._bumpTexture && this._bumpTexture.animations && this._bumpTexture.animations.length > 0 && e.push(this._bumpTexture), this._lightmapTexture && this._lightmapTexture.animations && this._lightmapTexture.animations.length > 0 && e.push(this._lightmapTexture), this._metallicReflectanceTexture && this._metallicReflectanceTexture.animations && this._metallicReflectanceTexture.animations.length > 0 && e.push(this._metallicReflectanceTexture), this._reflectanceTexture && this._reflectanceTexture.animations && this._reflectanceTexture.animations.length > 0 && e.push(this._reflectanceTexture), this._microSurfaceTexture && this._microSurfaceTexture.animations && this._microSurfaceTexture.animations.length > 0 && e.push(this._microSurfaceTexture), e;
		}
		_getReflectionTexture() {
			return this._reflectionTexture ? this._reflectionTexture : this.getScene().environmentTexture;
		}
		getActiveTextures() {
			let e = super.getActiveTextures();
			return this._albedoTexture && e.push(this._albedoTexture), this._baseWeightTexture && e.push(this._baseWeightTexture), this._baseDiffuseRoughnessTexture && e.push(this._baseDiffuseRoughnessTexture), this._ambientTexture && e.push(this._ambientTexture), this._opacityTexture && e.push(this._opacityTexture), this._reflectionTexture && e.push(this._reflectionTexture), this._emissiveTexture && e.push(this._emissiveTexture), this._reflectivityTexture && e.push(this._reflectivityTexture), this._metallicTexture && e.push(this._metallicTexture), this._metallicReflectanceTexture && e.push(this._metallicReflectanceTexture), this._reflectanceTexture && e.push(this._reflectanceTexture), this._microSurfaceTexture && e.push(this._microSurfaceTexture), this._bumpTexture && e.push(this._bumpTexture), this._lightmapTexture && e.push(this._lightmapTexture), e;
		}
		hasTexture(e) {
			return !!(super.hasTexture(e) || this._albedoTexture === e || this._baseWeightTexture === e || this._baseDiffuseRoughnessTexture === e || this._ambientTexture === e || this._opacityTexture === e || this._reflectionTexture === e || this._emissiveTexture === e || this._reflectivityTexture === e || this._metallicTexture === e || this._metallicReflectanceTexture === e || this._reflectanceTexture === e || this._microSurfaceTexture === e || this._bumpTexture === e || this._lightmapTexture === e);
		}
		setPrePassRenderer() {
			if (!this.subSurface?.isScatteringEnabled) return !1;
			let e = this.getScene().enableSubSurfaceForPrePass();
			return e && (e.enabled = !0), !0;
		}
		dispose(e, t) {
			this._breakShaderLoadedCheck = !0, t && (this._environmentBRDFTexture && this.getScene().environmentBRDFTexture !== this._environmentBRDFTexture && this._environmentBRDFTexture.dispose(), this._albedoTexture?.dispose(), this._baseWeightTexture?.dispose(), this._baseDiffuseRoughnessTexture?.dispose(), this._ambientTexture?.dispose(), this._opacityTexture?.dispose(), this._reflectionTexture?.dispose(), this._emissiveTexture?.dispose(), this._metallicTexture?.dispose(), this._reflectivityTexture?.dispose(), this._bumpTexture?.dispose(), this._lightmapTexture?.dispose(), this._metallicReflectanceTexture?.dispose(), this._reflectanceTexture?.dispose(), this._microSurfaceTexture?.dispose()), this._renderTargets.dispose(), this._imageProcessingConfiguration && this._imageProcessingObserver && this._imageProcessingConfiguration.onUpdateParameters.remove(this._imageProcessingObserver), super.dispose(e, t);
		}
	}, i = /* @__PURE__ */ new WeakMap(), (() => {
		let e = typeof Symbol == "function" && Symbol.metadata ? Object.create(o[Symbol.metadata] ?? null) : void 0;
		l = [_("_markAllSubMeshesAsMiscDirty")], b(t, null, l, {
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
		}, d, p), e && Object.defineProperty(t, Symbol.metadata, {
			enumerable: !0,
			configurable: !0,
			writable: !0,
			value: e
		});
	})(), t.PBRMATERIAL_OPAQUE = ee.MATERIAL_OPAQUE, t.PBRMATERIAL_ALPHATEST = ee.MATERIAL_ALPHATEST, t.PBRMATERIAL_ALPHABLEND = ee.MATERIAL_ALPHABLEND, t.PBRMATERIAL_ALPHATESTANDBLEND = ee.MATERIAL_ALPHATESTANDBLEND, t.DEFAULT_AO_ON_ANALYTICAL_LIGHTS = 0, t.LIGHTFALLOFF_PHYSICAL = 0, t.LIGHTFALLOFF_GLTF = 1, t.LIGHTFALLOFF_STANDARD = 2, t.ForceGLSL = !1, t._ShaderLoader = new se(() => [import("./pbr.vertex-D5_SIt1r.js"), import("./pbr.fragment-CFAzgQ9k.js")], () => [import("./pbr.vertex-DqbxryAW.js"), import("./pbr.fragment-B8SiVM1C.js")]), t;
})();
Object.getOwnPropertyDescriptor($.prototype, "decalMap") || Object.defineProperty($.prototype, "decalMap", t("PBRBaseMaterial", "decalMap"));
//#endregion
//#region node_modules/@babylonjs/core/Materials/PBR/pbrMaterial.pure.js
var je = (() => {
	var e, t, n, r, i, a, o, s, c, l, d, v, S, C, w, T, E, D, O, k, A, j, M, N, P, F, I, L, R, z, B, V, H, U, W, G, K, q, te, ne, re, ie, ae, oe, J, Y, se, ce, le, ue, de, fe, pe, X, Z, me, ge, _e, ve, ye, be, xe, Se, Ce, we, Te, Ee;
	let De = $, Q = [], Oe, ke = [], Ae = [], je, Me = [], Ne = [], Pe, Fe = [], Ie = [], Le, Re = [], ze = [], Be, Ve = [], He = [], Ue, We = [], Ge = [], Ke, qe = [], Je = [], Ye, Xe = [], Ze = [], Qe, $e = [], et = [], tt, nt = [], rt = [], it, at = [], ot = [], st, ct = [], lt = [], ut, dt = [], ft = [], pt, mt = [], ht = [], gt, _t = [], vt = [], yt, bt = [], xt = [], St, Ct = [], wt = [], Tt, Et = [], Dt = [], Ot, kt = [], At = [], jt, Mt = [], Nt = [], Pt, Ft = [], It = [], Lt, Rt = [], zt = [], Bt, Vt = [], Ht = [], Ut, Wt = [], Gt = [], Kt, qt = [], Jt = [], Yt, Xt = [], Zt = [], Qt, $t = [], en = [], tn, nn = [], rn = [], an, on = [], sn = [], cn, ln = [], un = [], dn, fn = [], pn = [], mn, hn = [], gn = [], _n, vn = [], yn = [], bn, xn = [], Sn = [], Cn, wn = [], Tn = [], En, Dn = [], On = [], kn, An = [], jn = [], Mn, Nn = [], Pn = [], Fn, In = [], Ln = [], Rn, zn = [], Bn = [], Vn, Hn = [], Un = [], Wn, Gn = [], Kn = [], qn, Jn = [], Yn = [], Xn, Zn = [], Qn = [], $n, er = [], tr = [], nr, rr = [], ir = [], ar, or, sr, cr = [], lr = [], ur, dr = [], fr = [], pr, mr = [], hr = [], gr, _r = [], vr = [], yr, br = [], xr = [], Sr, Cr = [], wr = [], Tr, Er = [], Dr = [], Or, kr = [], Ar = [], jr, Mr = [], Nr = [], Pr, Fr = [], Ir = [], Lr, Rr = [], zr = [], Br, Vr = [], Hr = [], Ur, Wr = [], Gr = [], Kr, qr = [], Jr = [], Yr, Xr = [], Zr = [], Qr, $r = [], ei = [], ti, ni = [], ri = [], ii, ai = [], oi = [], si, ci = [], li = [], ui, di = [], fi = [];
	return e = class extends De {
		get directIntensity() {
			return f(this, t, "f");
		}
		set directIntensity(e) {
			y(this, t, e, "f");
		}
		get emissiveIntensity() {
			return f(this, n, "f");
		}
		set emissiveIntensity(e) {
			y(this, n, e, "f");
		}
		get environmentIntensity() {
			return f(this, r, "f");
		}
		set environmentIntensity(e) {
			y(this, r, e, "f");
		}
		get specularIntensity() {
			return f(this, i, "f");
		}
		set specularIntensity(e) {
			y(this, i, e, "f");
		}
		get disableBumpMap() {
			return f(this, a, "f");
		}
		set disableBumpMap(e) {
			y(this, a, e, "f");
		}
		get albedoTexture() {
			return f(this, o, "f");
		}
		set albedoTexture(e) {
			y(this, o, e, "f");
		}
		get baseWeightTexture() {
			return f(this, s, "f");
		}
		set baseWeightTexture(e) {
			y(this, s, e, "f");
		}
		get baseDiffuseRoughnessTexture() {
			return f(this, c, "f");
		}
		set baseDiffuseRoughnessTexture(e) {
			y(this, c, e, "f");
		}
		get ambientTexture() {
			return f(this, l, "f");
		}
		set ambientTexture(e) {
			y(this, l, e, "f");
		}
		get ambientTextureStrength() {
			return f(this, d, "f");
		}
		set ambientTextureStrength(e) {
			y(this, d, e, "f");
		}
		get ambientTextureImpactOnAnalyticalLights() {
			return f(this, v, "f");
		}
		set ambientTextureImpactOnAnalyticalLights(e) {
			y(this, v, e, "f");
		}
		get opacityTexture() {
			return f(this, S, "f");
		}
		set opacityTexture(e) {
			y(this, S, e, "f");
		}
		get reflectionTexture() {
			return f(this, C, "f");
		}
		set reflectionTexture(e) {
			y(this, C, e, "f");
		}
		get emissiveTexture() {
			return f(this, w, "f");
		}
		set emissiveTexture(e) {
			y(this, w, e, "f");
		}
		get reflectivityTexture() {
			return f(this, T, "f");
		}
		set reflectivityTexture(e) {
			y(this, T, e, "f");
		}
		get metallicTexture() {
			return f(this, E, "f");
		}
		set metallicTexture(e) {
			y(this, E, e, "f");
		}
		get metallic() {
			return f(this, D, "f");
		}
		set metallic(e) {
			y(this, D, e, "f");
		}
		get roughness() {
			return f(this, O, "f");
		}
		set roughness(e) {
			y(this, O, e, "f");
		}
		get metallicF0Factor() {
			return f(this, k, "f");
		}
		set metallicF0Factor(e) {
			y(this, k, e, "f");
		}
		get metallicReflectanceColor() {
			return f(this, A, "f");
		}
		set metallicReflectanceColor(e) {
			y(this, A, e, "f");
		}
		get useOnlyMetallicFromMetallicReflectanceTexture() {
			return f(this, j, "f");
		}
		set useOnlyMetallicFromMetallicReflectanceTexture(e) {
			y(this, j, e, "f");
		}
		get metallicReflectanceTexture() {
			return f(this, M, "f");
		}
		set metallicReflectanceTexture(e) {
			y(this, M, e, "f");
		}
		get reflectanceTexture() {
			return f(this, N, "f");
		}
		set reflectanceTexture(e) {
			y(this, N, e, "f");
		}
		get microSurfaceTexture() {
			return f(this, P, "f");
		}
		set microSurfaceTexture(e) {
			y(this, P, e, "f");
		}
		get bumpTexture() {
			return f(this, F, "f");
		}
		set bumpTexture(e) {
			y(this, F, e, "f");
		}
		get lightmapTexture() {
			return f(this, I, "f");
		}
		set lightmapTexture(e) {
			y(this, I, e, "f");
		}
		get refractionTexture() {
			return this.subSurface.refractionTexture;
		}
		set refractionTexture(e) {
			this.subSurface.refractionTexture = e, e ? this.subSurface.isRefractionEnabled = !0 : this.subSurface.linkRefractionWithTransparency || (this.subSurface.isRefractionEnabled = !1);
		}
		get ambientColor() {
			return f(this, L, "f");
		}
		set ambientColor(e) {
			y(this, L, e, "f");
		}
		get albedoColor() {
			return f(this, R, "f");
		}
		set albedoColor(e) {
			y(this, R, e, "f");
		}
		get baseWeight() {
			return f(this, z, "f");
		}
		set baseWeight(e) {
			y(this, z, e, "f");
		}
		get baseDiffuseRoughness() {
			return f(this, B, "f");
		}
		set baseDiffuseRoughness(e) {
			y(this, B, e, "f");
		}
		get reflectivityColor() {
			return f(this, V, "f");
		}
		set reflectivityColor(e) {
			y(this, V, e, "f");
		}
		get reflectionColor() {
			return f(this, H, "f");
		}
		set reflectionColor(e) {
			y(this, H, e, "f");
		}
		get emissiveColor() {
			return f(this, U, "f");
		}
		set emissiveColor(e) {
			y(this, U, e, "f");
		}
		get microSurface() {
			return f(this, W, "f");
		}
		set microSurface(e) {
			y(this, W, e, "f");
		}
		get indexOfRefraction() {
			return this.subSurface.indexOfRefraction;
		}
		set indexOfRefraction(e) {
			this.subSurface.indexOfRefraction = e;
		}
		get invertRefractionY() {
			return this.subSurface.invertRefractionY;
		}
		set invertRefractionY(e) {
			this.subSurface.invertRefractionY = e;
		}
		get linkRefractionWithTransparency() {
			return this.subSurface.linkRefractionWithTransparency;
		}
		set linkRefractionWithTransparency(e) {
			this.subSurface.linkRefractionWithTransparency = e, e && (this.subSurface.isRefractionEnabled = !0);
		}
		get useLightmapAsShadowmap() {
			return f(this, G, "f");
		}
		set useLightmapAsShadowmap(e) {
			y(this, G, e, "f");
		}
		get useAlphaFromAlbedoTexture() {
			return f(this, K, "f");
		}
		set useAlphaFromAlbedoTexture(e) {
			y(this, K, e, "f");
		}
		get forceAlphaTest() {
			return f(this, q, "f");
		}
		set forceAlphaTest(e) {
			y(this, q, e, "f");
		}
		get alphaCutOff() {
			return f(this, te, "f");
		}
		set alphaCutOff(e) {
			y(this, te, e, "f");
		}
		get useSpecularOverAlpha() {
			return f(this, ne, "f");
		}
		set useSpecularOverAlpha(e) {
			y(this, ne, e, "f");
		}
		get useMicroSurfaceFromReflectivityMapAlpha() {
			return f(this, re, "f");
		}
		set useMicroSurfaceFromReflectivityMapAlpha(e) {
			y(this, re, e, "f");
		}
		get useRoughnessFromMetallicTextureAlpha() {
			return f(this, ie, "f");
		}
		set useRoughnessFromMetallicTextureAlpha(e) {
			y(this, ie, e, "f");
		}
		get useRoughnessFromMetallicTextureGreen() {
			return f(this, ae, "f");
		}
		set useRoughnessFromMetallicTextureGreen(e) {
			y(this, ae, e, "f");
		}
		get useMetallnessFromMetallicTextureBlue() {
			return f(this, oe, "f");
		}
		set useMetallnessFromMetallicTextureBlue(e) {
			y(this, oe, e, "f");
		}
		get useAmbientOcclusionFromMetallicTextureRed() {
			return f(this, J, "f");
		}
		set useAmbientOcclusionFromMetallicTextureRed(e) {
			y(this, J, e, "f");
		}
		get useAmbientInGrayScale() {
			return f(this, Y, "f");
		}
		set useAmbientInGrayScale(e) {
			y(this, Y, e, "f");
		}
		get useAutoMicroSurfaceFromReflectivityMap() {
			return f(this, se, "f");
		}
		set useAutoMicroSurfaceFromReflectivityMap(e) {
			y(this, se, e, "f");
		}
		get usePhysicalLightFalloff() {
			return this._lightFalloff === $.LIGHTFALLOFF_PHYSICAL;
		}
		set usePhysicalLightFalloff(e) {
			e !== this.usePhysicalLightFalloff && (this._markAllSubMeshesAsTexturesDirty(), this._lightFalloff = e ? $.LIGHTFALLOFF_PHYSICAL : $.LIGHTFALLOFF_STANDARD);
		}
		get useGLTFLightFalloff() {
			return this._lightFalloff === $.LIGHTFALLOFF_GLTF;
		}
		set useGLTFLightFalloff(e) {
			e !== this.useGLTFLightFalloff && (this._markAllSubMeshesAsTexturesDirty(), this._lightFalloff = e ? $.LIGHTFALLOFF_GLTF : $.LIGHTFALLOFF_STANDARD);
		}
		get useRadianceOverAlpha() {
			return f(this, ce, "f");
		}
		set useRadianceOverAlpha(e) {
			y(this, ce, e, "f");
		}
		get useObjectSpaceNormalMap() {
			return f(this, le, "f");
		}
		set useObjectSpaceNormalMap(e) {
			y(this, le, e, "f");
		}
		get useParallax() {
			return f(this, ue, "f");
		}
		set useParallax(e) {
			y(this, ue, e, "f");
		}
		get useParallaxOcclusion() {
			return f(this, de, "f");
		}
		set useParallaxOcclusion(e) {
			y(this, de, e, "f");
		}
		get parallaxScaleBias() {
			return f(this, fe, "f");
		}
		set parallaxScaleBias(e) {
			y(this, fe, e, "f");
		}
		get disableLighting() {
			return f(this, pe, "f");
		}
		set disableLighting(e) {
			y(this, pe, e, "f");
		}
		get forceIrradianceInFragment() {
			return f(this, X, "f");
		}
		set forceIrradianceInFragment(e) {
			y(this, X, e, "f");
		}
		get maxSimultaneousLights() {
			return f(this, Z, "f");
		}
		set maxSimultaneousLights(e) {
			y(this, Z, e, "f");
		}
		get invertNormalMapX() {
			return f(this, me, "f");
		}
		set invertNormalMapX(e) {
			y(this, me, e, "f");
		}
		get invertNormalMapY() {
			return f(this, ge, "f");
		}
		set invertNormalMapY(e) {
			y(this, ge, e, "f");
		}
		get twoSidedLighting() {
			return f(this, _e, "f");
		}
		set twoSidedLighting(e) {
			y(this, _e, e, "f");
		}
		get useAlphaFresnel() {
			return f(this, ve, "f");
		}
		set useAlphaFresnel(e) {
			y(this, ve, e, "f");
		}
		get useLinearAlphaFresnel() {
			return f(this, ye, "f");
		}
		set useLinearAlphaFresnel(e) {
			y(this, ye, e, "f");
		}
		get environmentBRDFTexture() {
			return f(this, be, "f");
		}
		set environmentBRDFTexture(e) {
			y(this, be, e, "f");
		}
		get forceNormalForward() {
			return f(this, xe, "f");
		}
		set forceNormalForward(e) {
			y(this, xe, e, "f");
		}
		get enableSpecularAntiAliasing() {
			return f(this, Se, "f");
		}
		set enableSpecularAntiAliasing(e) {
			y(this, Se, e, "f");
		}
		get useHorizonOcclusion() {
			return f(this, Ce, "f");
		}
		set useHorizonOcclusion(e) {
			y(this, Ce, e, "f");
		}
		get useRadianceOcclusion() {
			return f(this, we, "f");
		}
		set useRadianceOcclusion(e) {
			y(this, we, e, "f");
		}
		get unlit() {
			return f(this, Te, "f");
		}
		set unlit(e) {
			y(this, Te, e, "f");
		}
		get applyDecalMapAfterDetailMap() {
			return f(this, Ee, "f");
		}
		set applyDecalMapAfterDetailMap(e) {
			y(this, Ee, e, "f");
		}
		constructor(f, p, h = !1) {
			super(f, p, h), t.set(this, (m(this, Q), m(this, ke, 1))), n.set(this, (m(this, Ae), m(this, Me, 1))), r.set(this, (m(this, Ne), m(this, Fe, 1))), i.set(this, (m(this, Ie), m(this, Re, 1))), a.set(this, (m(this, ze), m(this, Ve, !1))), o.set(this, (m(this, He), m(this, We, void 0))), s.set(this, (m(this, Ge), m(this, qe, void 0))), c.set(this, (m(this, Je), m(this, Xe, void 0))), l.set(this, (m(this, Ze), m(this, $e, void 0))), d.set(this, (m(this, et), m(this, nt, 1))), v.set(this, (m(this, rt), m(this, at, e.DEFAULT_AO_ON_ANALYTICAL_LIGHTS))), S.set(this, (m(this, ot), m(this, ct, void 0))), C.set(this, (m(this, lt), m(this, dt, void 0))), w.set(this, (m(this, ft), m(this, mt, void 0))), T.set(this, (m(this, ht), m(this, _t, void 0))), E.set(this, (m(this, vt), m(this, bt, void 0))), D.set(this, (m(this, xt), m(this, Ct, void 0))), O.set(this, (m(this, wt), m(this, Et, void 0))), k.set(this, (m(this, Dt), m(this, kt, 1))), A.set(this, (m(this, At), m(this, Mt, u.White()))), j.set(this, (m(this, Nt), m(this, Ft, !1))), M.set(this, (m(this, It), m(this, Rt, void 0))), N.set(this, (m(this, zt), m(this, Vt, void 0))), P.set(this, (m(this, Ht), m(this, Wt, void 0))), F.set(this, (m(this, Gt), m(this, qt, void 0))), I.set(this, (m(this, Jt), m(this, Xt, void 0))), L.set(this, (m(this, Zt), m(this, $t, new u(0, 0, 0)))), R.set(this, (m(this, en), m(this, nn, new u(1, 1, 1)))), z.set(this, (m(this, rn), m(this, on, 1))), B.set(this, (m(this, sn), m(this, ln, void 0))), V.set(this, (m(this, un), m(this, fn, new u(1, 1, 1)))), H.set(this, (m(this, pn), m(this, hn, new u(1, 1, 1)))), U.set(this, (m(this, gn), m(this, vn, new u(0, 0, 0)))), W.set(this, (m(this, yn), m(this, xn, 1))), G.set(this, (m(this, Sn), m(this, wn, !1))), K.set(this, (m(this, Tn), m(this, Dn, !1))), q.set(this, (m(this, On), m(this, An, !1))), te.set(this, (m(this, jn), m(this, Nn, .4))), ne.set(this, (m(this, Pn), m(this, In, !0))), re.set(this, (m(this, Ln), m(this, zn, !1))), ie.set(this, (m(this, Bn), m(this, Hn, !0))), ae.set(this, (m(this, Un), m(this, Gn, !1))), oe.set(this, (m(this, Kn), m(this, Jn, !1))), J.set(this, (m(this, Yn), m(this, Zn, !1))), Y.set(this, (m(this, Qn), m(this, er, !1))), se.set(this, (m(this, tr), m(this, rr, !1))), ce.set(this, (m(this, ir), m(this, cr, !0))), le.set(this, (m(this, lr), m(this, dr, !1))), ue.set(this, (m(this, fr), m(this, mr, !1))), de.set(this, (m(this, hr), m(this, _r, !1))), fe.set(this, (m(this, vr), m(this, br, .05))), pe.set(this, (m(this, xr), m(this, Cr, !1))), X.set(this, (m(this, wr), m(this, Er, !1))), Z.set(this, (m(this, Dr), m(this, kr, 4))), me.set(this, (m(this, Ar), m(this, Mr, !1))), ge.set(this, (m(this, Nr), m(this, Fr, !1))), _e.set(this, (m(this, Ir), m(this, Rr, !1))), ve.set(this, (m(this, zr), m(this, Vr, !1))), ye.set(this, (m(this, Hr), m(this, Wr, !1))), be.set(this, (m(this, Gr), m(this, qr, null))), xe.set(this, (m(this, Jr), m(this, Xr, !1))), Se.set(this, (m(this, Zr), m(this, $r, !1))), Ce.set(this, (m(this, ei), m(this, ni, !0))), we.set(this, (m(this, ri), m(this, ai, !0))), Te.set(this, (m(this, oi), m(this, ci, !1))), Ee.set(this, (m(this, li), m(this, di, !1))), m(this, fi), this._environmentBRDFTexture = he(this.getScene());
		}
		getClassName() {
			return "PBRMaterial";
		}
		clone(t, n = !0, r = "") {
			let i = x.Clone(() => new e(t, this.getScene()), this, { cloneTexturesOnlyOnce: n });
			return i.id = t, i.name = t, this.stencil.copyTo(i.stencil), this._clonePlugins(i, r), i;
		}
		serialize() {
			let e = super.serialize();
			return e.customType = "BABYLON.PBRMaterial", e;
		}
		static Parse(t, n, r) {
			let i = x.Parse(() => new e(t.name, n), t, n, r);
			return t.stencil && i.stencil.parse(t.stencil, n, r), ee._ParsePlugins(t, i, n, r), t.clearCoat && i.clearCoat.parse(t.clearCoat, n, r), t.anisotropy && i.anisotropy.parse(t.anisotropy, n, r), t.brdf && i.brdf.parse(t.brdf, n, r), t.sheen && i.sheen.parse(t.sheen, n, r), t.subSurface && i.subSurface.parse(t.subSurface, n, r), t.iridescence && i.iridescence.parse(t.iridescence, n, r), i;
		}
	}, t = /* @__PURE__ */ new WeakMap(), n = /* @__PURE__ */ new WeakMap(), r = /* @__PURE__ */ new WeakMap(), i = /* @__PURE__ */ new WeakMap(), a = /* @__PURE__ */ new WeakMap(), o = /* @__PURE__ */ new WeakMap(), s = /* @__PURE__ */ new WeakMap(), c = /* @__PURE__ */ new WeakMap(), l = /* @__PURE__ */ new WeakMap(), d = /* @__PURE__ */ new WeakMap(), v = /* @__PURE__ */ new WeakMap(), S = /* @__PURE__ */ new WeakMap(), C = /* @__PURE__ */ new WeakMap(), w = /* @__PURE__ */ new WeakMap(), T = /* @__PURE__ */ new WeakMap(), E = /* @__PURE__ */ new WeakMap(), D = /* @__PURE__ */ new WeakMap(), O = /* @__PURE__ */ new WeakMap(), k = /* @__PURE__ */ new WeakMap(), A = /* @__PURE__ */ new WeakMap(), j = /* @__PURE__ */ new WeakMap(), M = /* @__PURE__ */ new WeakMap(), N = /* @__PURE__ */ new WeakMap(), P = /* @__PURE__ */ new WeakMap(), F = /* @__PURE__ */ new WeakMap(), I = /* @__PURE__ */ new WeakMap(), L = /* @__PURE__ */ new WeakMap(), R = /* @__PURE__ */ new WeakMap(), z = /* @__PURE__ */ new WeakMap(), B = /* @__PURE__ */ new WeakMap(), V = /* @__PURE__ */ new WeakMap(), H = /* @__PURE__ */ new WeakMap(), U = /* @__PURE__ */ new WeakMap(), W = /* @__PURE__ */ new WeakMap(), G = /* @__PURE__ */ new WeakMap(), K = /* @__PURE__ */ new WeakMap(), q = /* @__PURE__ */ new WeakMap(), te = /* @__PURE__ */ new WeakMap(), ne = /* @__PURE__ */ new WeakMap(), re = /* @__PURE__ */ new WeakMap(), ie = /* @__PURE__ */ new WeakMap(), ae = /* @__PURE__ */ new WeakMap(), oe = /* @__PURE__ */ new WeakMap(), J = /* @__PURE__ */ new WeakMap(), Y = /* @__PURE__ */ new WeakMap(), se = /* @__PURE__ */ new WeakMap(), ce = /* @__PURE__ */ new WeakMap(), le = /* @__PURE__ */ new WeakMap(), ue = /* @__PURE__ */ new WeakMap(), de = /* @__PURE__ */ new WeakMap(), fe = /* @__PURE__ */ new WeakMap(), pe = /* @__PURE__ */ new WeakMap(), X = /* @__PURE__ */ new WeakMap(), Z = /* @__PURE__ */ new WeakMap(), me = /* @__PURE__ */ new WeakMap(), ge = /* @__PURE__ */ new WeakMap(), _e = /* @__PURE__ */ new WeakMap(), ve = /* @__PURE__ */ new WeakMap(), ye = /* @__PURE__ */ new WeakMap(), be = /* @__PURE__ */ new WeakMap(), xe = /* @__PURE__ */ new WeakMap(), Se = /* @__PURE__ */ new WeakMap(), Ce = /* @__PURE__ */ new WeakMap(), we = /* @__PURE__ */ new WeakMap(), Te = /* @__PURE__ */ new WeakMap(), Ee = /* @__PURE__ */ new WeakMap(), (() => {
		let t = typeof Symbol == "function" && Symbol.metadata ? Object.create(De[Symbol.metadata] ?? null) : void 0;
		Oe = [g(), _("_markAllSubMeshesAsTexturesDirty")], je = [g(), _("_markAllSubMeshesAsTexturesDirty")], Pe = [g(), _("_markAllSubMeshesAsTexturesDirty")], Le = [g(), _("_markAllSubMeshesAsTexturesDirty")], Be = [g(), _("_markAllSubMeshesAsTexturesDirty")], Ue = [h(), _("_markAllSubMeshesAsTexturesDirty")], Ke = [h(), _("_markAllSubMeshesAsTexturesDirty")], Ye = [h(), _("_markAllSubMeshesAsTexturesDirty")], Qe = [h(), _("_markAllSubMeshesAsTexturesDirty")], tt = [g(), _("_markAllSubMeshesAsTexturesDirty")], it = [g(), _("_markAllSubMeshesAsTexturesDirty")], st = [h(), _("_markAllSubMeshesAsTexturesAndMiscDirty")], ut = [h(), _("_markAllSubMeshesAsTexturesDirty")], pt = [h(), _("_markAllSubMeshesAsTexturesDirty")], gt = [h(), _("_markAllSubMeshesAsTexturesDirty")], yt = [h(), _("_markAllSubMeshesAsTexturesDirty")], St = [g(), _("_markAllSubMeshesAsTexturesDirty")], Tt = [g(), _("_markAllSubMeshesAsTexturesDirty")], Ot = [g(), _("_markAllSubMeshesAsTexturesDirty")], jt = [p(), _("_markAllSubMeshesAsTexturesDirty")], Pt = [g(), _("_markAllSubMeshesAsTexturesDirty")], Lt = [h(), _("_markAllSubMeshesAsTexturesDirty")], Bt = [h(), _("_markAllSubMeshesAsTexturesDirty")], Ut = [h(), _("_markAllSubMeshesAsTexturesDirty")], Kt = [h(), _("_markAllSubMeshesAsTexturesDirty")], Yt = [h(), _("_markAllSubMeshesAsTexturesDirty", null)], Qt = [p("ambient"), _("_markAllSubMeshesAsTexturesDirty")], tn = [p("albedo"), _("_markAllSubMeshesAsTexturesDirty")], an = [g("baseWeight"), _("_markAllSubMeshesAsTexturesDirty")], cn = [g("baseDiffuseRoughness"), _("_markAllSubMeshesAsTexturesDirty")], dn = [p("reflectivity"), _("_markAllSubMeshesAsTexturesDirty")], mn = [p("reflection"), _("_markAllSubMeshesAsTexturesDirty")], _n = [p("emissive"), _("_markAllSubMeshesAsTexturesDirty")], bn = [g(), _("_markAllSubMeshesAsTexturesDirty")], Cn = [g(), _("_markAllSubMeshesAsTexturesDirty")], En = [g(), _("_markAllSubMeshesAsTexturesAndMiscDirty")], kn = [g(), _("_markAllSubMeshesAsTexturesAndMiscDirty")], Mn = [g(), _("_markAllSubMeshesAsTexturesAndMiscDirty")], Fn = [g(), _("_markAllSubMeshesAsTexturesDirty")], Rn = [g(), _("_markAllSubMeshesAsTexturesDirty")], Vn = [g(), _("_markAllSubMeshesAsTexturesDirty")], Wn = [g(), _("_markAllSubMeshesAsTexturesDirty")], qn = [g(), _("_markAllSubMeshesAsTexturesDirty")], Xn = [g(), _("_markAllSubMeshesAsTexturesDirty")], $n = [g(), _("_markAllSubMeshesAsTexturesDirty")], nr = [g(), _("_markAllSubMeshesAsTexturesDirty")], ar = [g()], or = [g()], sr = [g(), _("_markAllSubMeshesAsTexturesDirty")], ur = [g(), _("_markAllSubMeshesAsTexturesDirty")], pr = [g(), _("_markAllSubMeshesAsTexturesDirty")], gr = [g(), _("_markAllSubMeshesAsTexturesDirty")], yr = [g(), _("_markAllSubMeshesAsTexturesDirty")], Sr = [g(), _("_markAllSubMeshesAsLightsDirty")], Tr = [g(), _("_markAllSubMeshesAsTexturesDirty")], Or = [g(), _("_markAllSubMeshesAsLightsDirty")], jr = [g(), _("_markAllSubMeshesAsTexturesDirty")], Pr = [g(), _("_markAllSubMeshesAsTexturesDirty")], Lr = [g(), _("_markAllSubMeshesAsTexturesDirty")], Br = [g(), _("_markAllSubMeshesAsTexturesDirty")], Ur = [g(), _("_markAllSubMeshesAsTexturesDirty")], Kr = [_("_markAllSubMeshesAsTexturesDirty")], Yr = [g(), _("_markAllSubMeshesAsTexturesDirty")], Qr = [g(), _("_markAllSubMeshesAsTexturesDirty")], ti = [g(), _("_markAllSubMeshesAsTexturesDirty")], ii = [g(), _("_markAllSubMeshesAsTexturesDirty")], si = [g(), _("_markAllSubMeshesAsMiscDirty")], ui = [g(), _("_markAllSubMeshesAsMiscDirty")], b(e, null, Oe, {
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
			metadata: t
		}, ke, Ae), b(e, null, je, {
			kind: "accessor",
			name: "emissiveIntensity",
			static: !1,
			private: !1,
			access: {
				has: (e) => "emissiveIntensity" in e,
				get: (e) => e.emissiveIntensity,
				set: (e, t) => {
					e.emissiveIntensity = t;
				}
			},
			metadata: t
		}, Me, Ne), b(e, null, Pe, {
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
			metadata: t
		}, Fe, Ie), b(e, null, Le, {
			kind: "accessor",
			name: "specularIntensity",
			static: !1,
			private: !1,
			access: {
				has: (e) => "specularIntensity" in e,
				get: (e) => e.specularIntensity,
				set: (e, t) => {
					e.specularIntensity = t;
				}
			},
			metadata: t
		}, Re, ze), b(e, null, Be, {
			kind: "accessor",
			name: "disableBumpMap",
			static: !1,
			private: !1,
			access: {
				has: (e) => "disableBumpMap" in e,
				get: (e) => e.disableBumpMap,
				set: (e, t) => {
					e.disableBumpMap = t;
				}
			},
			metadata: t
		}, Ve, He), b(e, null, Ue, {
			kind: "accessor",
			name: "albedoTexture",
			static: !1,
			private: !1,
			access: {
				has: (e) => "albedoTexture" in e,
				get: (e) => e.albedoTexture,
				set: (e, t) => {
					e.albedoTexture = t;
				}
			},
			metadata: t
		}, We, Ge), b(e, null, Ke, {
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
			metadata: t
		}, qe, Je), b(e, null, Ye, {
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
			metadata: t
		}, Xe, Ze), b(e, null, Qe, {
			kind: "accessor",
			name: "ambientTexture",
			static: !1,
			private: !1,
			access: {
				has: (e) => "ambientTexture" in e,
				get: (e) => e.ambientTexture,
				set: (e, t) => {
					e.ambientTexture = t;
				}
			},
			metadata: t
		}, $e, et), b(e, null, tt, {
			kind: "accessor",
			name: "ambientTextureStrength",
			static: !1,
			private: !1,
			access: {
				has: (e) => "ambientTextureStrength" in e,
				get: (e) => e.ambientTextureStrength,
				set: (e, t) => {
					e.ambientTextureStrength = t;
				}
			},
			metadata: t
		}, nt, rt), b(e, null, it, {
			kind: "accessor",
			name: "ambientTextureImpactOnAnalyticalLights",
			static: !1,
			private: !1,
			access: {
				has: (e) => "ambientTextureImpactOnAnalyticalLights" in e,
				get: (e) => e.ambientTextureImpactOnAnalyticalLights,
				set: (e, t) => {
					e.ambientTextureImpactOnAnalyticalLights = t;
				}
			},
			metadata: t
		}, at, ot), b(e, null, st, {
			kind: "accessor",
			name: "opacityTexture",
			static: !1,
			private: !1,
			access: {
				has: (e) => "opacityTexture" in e,
				get: (e) => e.opacityTexture,
				set: (e, t) => {
					e.opacityTexture = t;
				}
			},
			metadata: t
		}, ct, lt), b(e, null, ut, {
			kind: "accessor",
			name: "reflectionTexture",
			static: !1,
			private: !1,
			access: {
				has: (e) => "reflectionTexture" in e,
				get: (e) => e.reflectionTexture,
				set: (e, t) => {
					e.reflectionTexture = t;
				}
			},
			metadata: t
		}, dt, ft), b(e, null, pt, {
			kind: "accessor",
			name: "emissiveTexture",
			static: !1,
			private: !1,
			access: {
				has: (e) => "emissiveTexture" in e,
				get: (e) => e.emissiveTexture,
				set: (e, t) => {
					e.emissiveTexture = t;
				}
			},
			metadata: t
		}, mt, ht), b(e, null, gt, {
			kind: "accessor",
			name: "reflectivityTexture",
			static: !1,
			private: !1,
			access: {
				has: (e) => "reflectivityTexture" in e,
				get: (e) => e.reflectivityTexture,
				set: (e, t) => {
					e.reflectivityTexture = t;
				}
			},
			metadata: t
		}, _t, vt), b(e, null, yt, {
			kind: "accessor",
			name: "metallicTexture",
			static: !1,
			private: !1,
			access: {
				has: (e) => "metallicTexture" in e,
				get: (e) => e.metallicTexture,
				set: (e, t) => {
					e.metallicTexture = t;
				}
			},
			metadata: t
		}, bt, xt), b(e, null, St, {
			kind: "accessor",
			name: "metallic",
			static: !1,
			private: !1,
			access: {
				has: (e) => "metallic" in e,
				get: (e) => e.metallic,
				set: (e, t) => {
					e.metallic = t;
				}
			},
			metadata: t
		}, Ct, wt), b(e, null, Tt, {
			kind: "accessor",
			name: "roughness",
			static: !1,
			private: !1,
			access: {
				has: (e) => "roughness" in e,
				get: (e) => e.roughness,
				set: (e, t) => {
					e.roughness = t;
				}
			},
			metadata: t
		}, Et, Dt), b(e, null, Ot, {
			kind: "accessor",
			name: "metallicF0Factor",
			static: !1,
			private: !1,
			access: {
				has: (e) => "metallicF0Factor" in e,
				get: (e) => e.metallicF0Factor,
				set: (e, t) => {
					e.metallicF0Factor = t;
				}
			},
			metadata: t
		}, kt, At), b(e, null, jt, {
			kind: "accessor",
			name: "metallicReflectanceColor",
			static: !1,
			private: !1,
			access: {
				has: (e) => "metallicReflectanceColor" in e,
				get: (e) => e.metallicReflectanceColor,
				set: (e, t) => {
					e.metallicReflectanceColor = t;
				}
			},
			metadata: t
		}, Mt, Nt), b(e, null, Pt, {
			kind: "accessor",
			name: "useOnlyMetallicFromMetallicReflectanceTexture",
			static: !1,
			private: !1,
			access: {
				has: (e) => "useOnlyMetallicFromMetallicReflectanceTexture" in e,
				get: (e) => e.useOnlyMetallicFromMetallicReflectanceTexture,
				set: (e, t) => {
					e.useOnlyMetallicFromMetallicReflectanceTexture = t;
				}
			},
			metadata: t
		}, Ft, It), b(e, null, Lt, {
			kind: "accessor",
			name: "metallicReflectanceTexture",
			static: !1,
			private: !1,
			access: {
				has: (e) => "metallicReflectanceTexture" in e,
				get: (e) => e.metallicReflectanceTexture,
				set: (e, t) => {
					e.metallicReflectanceTexture = t;
				}
			},
			metadata: t
		}, Rt, zt), b(e, null, Bt, {
			kind: "accessor",
			name: "reflectanceTexture",
			static: !1,
			private: !1,
			access: {
				has: (e) => "reflectanceTexture" in e,
				get: (e) => e.reflectanceTexture,
				set: (e, t) => {
					e.reflectanceTexture = t;
				}
			},
			metadata: t
		}, Vt, Ht), b(e, null, Ut, {
			kind: "accessor",
			name: "microSurfaceTexture",
			static: !1,
			private: !1,
			access: {
				has: (e) => "microSurfaceTexture" in e,
				get: (e) => e.microSurfaceTexture,
				set: (e, t) => {
					e.microSurfaceTexture = t;
				}
			},
			metadata: t
		}, Wt, Gt), b(e, null, Kt, {
			kind: "accessor",
			name: "bumpTexture",
			static: !1,
			private: !1,
			access: {
				has: (e) => "bumpTexture" in e,
				get: (e) => e.bumpTexture,
				set: (e, t) => {
					e.bumpTexture = t;
				}
			},
			metadata: t
		}, qt, Jt), b(e, null, Yt, {
			kind: "accessor",
			name: "lightmapTexture",
			static: !1,
			private: !1,
			access: {
				has: (e) => "lightmapTexture" in e,
				get: (e) => e.lightmapTexture,
				set: (e, t) => {
					e.lightmapTexture = t;
				}
			},
			metadata: t
		}, Xt, Zt), b(e, null, Qt, {
			kind: "accessor",
			name: "ambientColor",
			static: !1,
			private: !1,
			access: {
				has: (e) => "ambientColor" in e,
				get: (e) => e.ambientColor,
				set: (e, t) => {
					e.ambientColor = t;
				}
			},
			metadata: t
		}, $t, en), b(e, null, tn, {
			kind: "accessor",
			name: "albedoColor",
			static: !1,
			private: !1,
			access: {
				has: (e) => "albedoColor" in e,
				get: (e) => e.albedoColor,
				set: (e, t) => {
					e.albedoColor = t;
				}
			},
			metadata: t
		}, nn, rn), b(e, null, an, {
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
			metadata: t
		}, on, sn), b(e, null, cn, {
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
			metadata: t
		}, ln, un), b(e, null, dn, {
			kind: "accessor",
			name: "reflectivityColor",
			static: !1,
			private: !1,
			access: {
				has: (e) => "reflectivityColor" in e,
				get: (e) => e.reflectivityColor,
				set: (e, t) => {
					e.reflectivityColor = t;
				}
			},
			metadata: t
		}, fn, pn), b(e, null, mn, {
			kind: "accessor",
			name: "reflectionColor",
			static: !1,
			private: !1,
			access: {
				has: (e) => "reflectionColor" in e,
				get: (e) => e.reflectionColor,
				set: (e, t) => {
					e.reflectionColor = t;
				}
			},
			metadata: t
		}, hn, gn), b(e, null, _n, {
			kind: "accessor",
			name: "emissiveColor",
			static: !1,
			private: !1,
			access: {
				has: (e) => "emissiveColor" in e,
				get: (e) => e.emissiveColor,
				set: (e, t) => {
					e.emissiveColor = t;
				}
			},
			metadata: t
		}, vn, yn), b(e, null, bn, {
			kind: "accessor",
			name: "microSurface",
			static: !1,
			private: !1,
			access: {
				has: (e) => "microSurface" in e,
				get: (e) => e.microSurface,
				set: (e, t) => {
					e.microSurface = t;
				}
			},
			metadata: t
		}, xn, Sn), b(e, null, Cn, {
			kind: "accessor",
			name: "useLightmapAsShadowmap",
			static: !1,
			private: !1,
			access: {
				has: (e) => "useLightmapAsShadowmap" in e,
				get: (e) => e.useLightmapAsShadowmap,
				set: (e, t) => {
					e.useLightmapAsShadowmap = t;
				}
			},
			metadata: t
		}, wn, Tn), b(e, null, En, {
			kind: "accessor",
			name: "useAlphaFromAlbedoTexture",
			static: !1,
			private: !1,
			access: {
				has: (e) => "useAlphaFromAlbedoTexture" in e,
				get: (e) => e.useAlphaFromAlbedoTexture,
				set: (e, t) => {
					e.useAlphaFromAlbedoTexture = t;
				}
			},
			metadata: t
		}, Dn, On), b(e, null, kn, {
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
			metadata: t
		}, An, jn), b(e, null, Mn, {
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
			metadata: t
		}, Nn, Pn), b(e, null, Fn, {
			kind: "accessor",
			name: "useSpecularOverAlpha",
			static: !1,
			private: !1,
			access: {
				has: (e) => "useSpecularOverAlpha" in e,
				get: (e) => e.useSpecularOverAlpha,
				set: (e, t) => {
					e.useSpecularOverAlpha = t;
				}
			},
			metadata: t
		}, In, Ln), b(e, null, Rn, {
			kind: "accessor",
			name: "useMicroSurfaceFromReflectivityMapAlpha",
			static: !1,
			private: !1,
			access: {
				has: (e) => "useMicroSurfaceFromReflectivityMapAlpha" in e,
				get: (e) => e.useMicroSurfaceFromReflectivityMapAlpha,
				set: (e, t) => {
					e.useMicroSurfaceFromReflectivityMapAlpha = t;
				}
			},
			metadata: t
		}, zn, Bn), b(e, null, Vn, {
			kind: "accessor",
			name: "useRoughnessFromMetallicTextureAlpha",
			static: !1,
			private: !1,
			access: {
				has: (e) => "useRoughnessFromMetallicTextureAlpha" in e,
				get: (e) => e.useRoughnessFromMetallicTextureAlpha,
				set: (e, t) => {
					e.useRoughnessFromMetallicTextureAlpha = t;
				}
			},
			metadata: t
		}, Hn, Un), b(e, null, Wn, {
			kind: "accessor",
			name: "useRoughnessFromMetallicTextureGreen",
			static: !1,
			private: !1,
			access: {
				has: (e) => "useRoughnessFromMetallicTextureGreen" in e,
				get: (e) => e.useRoughnessFromMetallicTextureGreen,
				set: (e, t) => {
					e.useRoughnessFromMetallicTextureGreen = t;
				}
			},
			metadata: t
		}, Gn, Kn), b(e, null, qn, {
			kind: "accessor",
			name: "useMetallnessFromMetallicTextureBlue",
			static: !1,
			private: !1,
			access: {
				has: (e) => "useMetallnessFromMetallicTextureBlue" in e,
				get: (e) => e.useMetallnessFromMetallicTextureBlue,
				set: (e, t) => {
					e.useMetallnessFromMetallicTextureBlue = t;
				}
			},
			metadata: t
		}, Jn, Yn), b(e, null, Xn, {
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
			metadata: t
		}, Zn, Qn), b(e, null, $n, {
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
			metadata: t
		}, er, tr), b(e, null, nr, {
			kind: "accessor",
			name: "useAutoMicroSurfaceFromReflectivityMap",
			static: !1,
			private: !1,
			access: {
				has: (e) => "useAutoMicroSurfaceFromReflectivityMap" in e,
				get: (e) => e.useAutoMicroSurfaceFromReflectivityMap,
				set: (e, t) => {
					e.useAutoMicroSurfaceFromReflectivityMap = t;
				}
			},
			metadata: t
		}, rr, ir), b(e, null, ar, {
			kind: "getter",
			name: "usePhysicalLightFalloff",
			static: !1,
			private: !1,
			access: {
				has: (e) => "usePhysicalLightFalloff" in e,
				get: (e) => e.usePhysicalLightFalloff
			},
			metadata: t
		}, null, Q), b(e, null, or, {
			kind: "getter",
			name: "useGLTFLightFalloff",
			static: !1,
			private: !1,
			access: {
				has: (e) => "useGLTFLightFalloff" in e,
				get: (e) => e.useGLTFLightFalloff
			},
			metadata: t
		}, null, Q), b(e, null, sr, {
			kind: "accessor",
			name: "useRadianceOverAlpha",
			static: !1,
			private: !1,
			access: {
				has: (e) => "useRadianceOverAlpha" in e,
				get: (e) => e.useRadianceOverAlpha,
				set: (e, t) => {
					e.useRadianceOverAlpha = t;
				}
			},
			metadata: t
		}, cr, lr), b(e, null, ur, {
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
			metadata: t
		}, dr, fr), b(e, null, pr, {
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
			metadata: t
		}, mr, hr), b(e, null, gr, {
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
			metadata: t
		}, _r, vr), b(e, null, yr, {
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
			metadata: t
		}, br, xr), b(e, null, Sr, {
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
			metadata: t
		}, Cr, wr), b(e, null, Tr, {
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
			metadata: t
		}, Er, Dr), b(e, null, Or, {
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
			metadata: t
		}, kr, Ar), b(e, null, jr, {
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
			metadata: t
		}, Mr, Nr), b(e, null, Pr, {
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
			metadata: t
		}, Fr, Ir), b(e, null, Lr, {
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
			metadata: t
		}, Rr, zr), b(e, null, Br, {
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
			metadata: t
		}, Vr, Hr), b(e, null, Ur, {
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
			metadata: t
		}, Wr, Gr), b(e, null, Kr, {
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
			metadata: t
		}, qr, Jr), b(e, null, Yr, {
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
			metadata: t
		}, Xr, Zr), b(e, null, Qr, {
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
			metadata: t
		}, $r, ei), b(e, null, ti, {
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
			metadata: t
		}, ni, ri), b(e, null, ii, {
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
			metadata: t
		}, ai, oi), b(e, null, si, {
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
			metadata: t
		}, ci, li), b(e, null, ui, {
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
			metadata: t
		}, di, fi), t && Object.defineProperty(e, Symbol.metadata, {
			enumerable: !0,
			configurable: !0,
			writable: !0,
			value: t
		});
	})(), e.PBRMATERIAL_OPAQUE = $.PBRMATERIAL_OPAQUE, e.PBRMATERIAL_ALPHATEST = $.PBRMATERIAL_ALPHATEST, e.PBRMATERIAL_ALPHABLEND = $.PBRMATERIAL_ALPHABLEND, e.PBRMATERIAL_ALPHATESTANDBLEND = $.PBRMATERIAL_ALPHATESTANDBLEND, e.DEFAULT_AO_ON_ANALYTICAL_LIGHTS = $.DEFAULT_AO_ON_ANALYTICAL_LIGHTS, e;
})(), Me = !1;
function Ne() {
	Me || (Me = !0, i(), d("BABYLON.PBRMaterial", je));
}
function Pe() {
	Ne();
}
//#endregion
export { je as PBRMaterial, Pe as RegisterPBRMaterial, Ne as RegisterPbrMaterial };
