import { d as e } from "./math.scalar.functions-D7lyzZPV.js";
import { a as t, c as n, i as r, l as i, n as a, o, t as s, u as c } from "./math.color.pure-CPmbqLkh.js";
import { t as l } from "./typeStore-pENEWnX2.js";
import { _ as u, a as d, b as f, f as p, i as m, m as h, n as ee, v as g, y as _ } from "./decorators-BldPRAAT.js";
import { t as v } from "./decorators.serialization-CGAHzP43.js";
import { n as te, t as y } from "./lightConstants-Dqs8OH2d.js";
import { t as ne } from "./node-DAxRHzT3.js";
import { t as re } from "./texture.pure-Ce-ILsRv.js";
import { t as b } from "./animation.pure-D6aX6Q8L.js";
import { t as x } from "./constants-GiSaWNVD.js";
import { t as S } from "./flowGraphInteger.pure-DqL1vt3x.js";
//#region node_modules/@babylonjs/core/Maths/math.axis.js
var C;
(function(e) {
	e[e.LOCAL = 0] = "LOCAL", e[e.WORLD = 1] = "WORLD", e[e.BONE = 2] = "BONE";
})(C ||= {});
var w = class {};
w.X = new c(1, 0, 0), w.Y = new c(0, 1, 0), w.Z = new c(0, 0, 1);
var T;
(function(e) {
	e[e.X = 0] = "X", e[e.Y = 1] = "Y", e[e.Z = 2] = "Z";
})(T ||= {});
//#endregion
//#region node_modules/@babylonjs/core/Lights/light.js
var E = (() => {
	var e, t;
	let n = ne, i = [], a, o = [], p = [], h, re = [], b = [], x, S = [], C = [], w, T = [], E = [], D, O, k, A, j = [], M = [], N, P = [], F = [], I, L = [], R = [], z, B = [], V = [], H, U = [], W = [], G, K = [], q = [];
	return e = class extends n {
		get range() {
			return this._range;
		}
		set range(e) {
			this._range = e, this._inverseSquaredRange = 1 / (this.range * this.range);
		}
		get intensityMode() {
			return this._intensityMode;
		}
		set intensityMode(e) {
			this._intensityMode = e, this._computePhotometricScale();
		}
		get radius() {
			return this._radius;
		}
		set radius(e) {
			this._radius = e, this._computePhotometricScale();
		}
		get renderPriority() {
			return u(this, t, "f");
		}
		set renderPriority(e) {
			g(this, t, e, "f");
		}
		get shadowEnabled() {
			return this._shadowEnabled;
		}
		set shadowEnabled(e) {
			this._shadowEnabled !== e && (this._shadowEnabled = e, this._markMeshesAsLightDirty());
		}
		get includedOnlyMeshes() {
			return this._includedOnlyMeshes;
		}
		set includedOnlyMeshes(e) {
			this._includedOnlyMeshes = e, this._hookArrayForIncludedOnly(e);
		}
		get excludedMeshes() {
			return this._excludedMeshes;
		}
		set excludedMeshes(e) {
			this._excludedMeshes = e, this._hookArrayForExcluded(e);
		}
		get excludeWithLayerMask() {
			return this._excludeWithLayerMask;
		}
		set excludeWithLayerMask(e) {
			this._excludeWithLayerMask = e, this._resyncMeshes();
		}
		get includeOnlyWithLayerMask() {
			return this._includeOnlyWithLayerMask;
		}
		set includeOnlyWithLayerMask(e) {
			this._includeOnlyWithLayerMask = e, this._resyncMeshes();
		}
		get lightmapMode() {
			return this._lightmapMode;
		}
		set lightmapMode(e) {
			this._lightmapMode !== e && (this._lightmapMode = e, this._markMeshesAsLightDirty());
		}
		getViewMatrix(e) {
			return null;
		}
		getProjectionMatrix(e, t) {
			return null;
		}
		constructor(n, r, a) {
			super(n, r, !1), this.diffuse = (f(this, i), f(this, o, new s(1, 1, 1))), this.specular = (f(this, p), f(this, re, new s(1, 1, 1))), this.falloffType = (f(this, b), f(this, S, e.FALLOFF_DEFAULT)), this.intensity = (f(this, C), f(this, T, 1)), this._range = (f(this, E), Number.MAX_VALUE), this._inverseSquaredRange = 0, this._photometricScale = 1, this._intensityMode = e.INTENSITYMODE_AUTOMATIC, this._radius = 1e-5, this._renderPriority = f(this, j, void 0), t.set(this, (f(this, M), f(this, P, 0))), this._shadowEnabled = (f(this, F), f(this, L, !0)), this._includedOnlyMeshes = f(this, R), this._excludeWithLayerMask = f(this, B, 0), this._includeOnlyWithLayerMask = (f(this, V), f(this, U, 0)), this._lightmapMode = (f(this, W), f(this, K, 0)), this._shadowGenerators = (f(this, q), null), this._excludedMeshesIds = [], this._includedOnlyMeshesIds = [], this._currentViewDepth = 0, this._clusteredContainer = null, this._isLight = !0, a || this.getScene().addLight(this), this._uniformBuffer = new te(this.getScene().getEngine(), void 0, void 0, n), this._buildUniformLayout(), this.includedOnlyMeshes = [], this.excludedMeshes = [], a || this._resyncMeshes();
		}
		transferTexturesToEffect(e, t) {
			return this;
		}
		_bindLight(e, t, n, i, a = !0) {
			let o = e.toString(), s = !1;
			if (this._uniformBuffer.bindToEffect(n, "Light" + o), this._renderId !== t.getRenderId() || this._lastUseSpecular !== i || !this._uniformBuffer.useUbo) {
				this._renderId = t.getRenderId(), this._lastUseSpecular = i;
				let e = this.getScaledIntensity();
				this.transferToEffect(n, o), this.diffuse.scaleToRef(e, r.Color3[0]), this._uniformBuffer.updateColor4("vLightDiffuse", r.Color3[0], this.range, o), i && (this.specular.scaleToRef(e, r.Color3[1]), this._uniformBuffer.updateColor4("vLightSpecular", r.Color3[1], this.radius, o)), s = !0;
			}
			if (this.transferTexturesToEffect(n, o), t.shadowsEnabled && this.shadowEnabled && a) {
				let e = this.getShadowGenerator(t.activeCamera) ?? this.getShadowGenerator();
				e && (e.bindShadowLight(o, n), s = !0);
			}
			s ? this._uniformBuffer.update() : this._uniformBuffer.bindUniformBuffer();
		}
		getClassName() {
			return "Light";
		}
		toString(e) {
			let t = "Name: " + this.name;
			if (t += ", type: " + [
				"Point",
				"Directional",
				"Spot",
				"Hemispheric",
				"Clustered"
			][this.getTypeID()], this.animations) for (let n = 0; n < this.animations.length; n++) t += ", animation[0]: " + this.animations[n].toString(e);
			return t;
		}
		_syncParentEnabledState() {
			super._syncParentEnabledState(), this.isDisposed() || this._resyncMeshes();
		}
		setEnabled(e) {
			super.setEnabled(e), this._resyncMeshes();
		}
		getShadowGenerator(e = null) {
			return this._shadowGenerators === null ? null : this._shadowGenerators.get(e) ?? null;
		}
		getShadowGenerators() {
			return this._shadowGenerators;
		}
		getAbsolutePosition() {
			return c.Zero();
		}
		canAffectMesh(e) {
			return !e || !(this.includedOnlyMeshes && this.includedOnlyMeshes.length > 0 && this.includedOnlyMeshes.indexOf(e) === -1 || this.excludedMeshes && this.excludedMeshes.length > 0 && this.excludedMeshes.indexOf(e) !== -1 || this.includeOnlyWithLayerMask !== 0 && (this.includeOnlyWithLayerMask & e.layerMask) === 0 || this.excludeWithLayerMask !== 0 && this.excludeWithLayerMask & e.layerMask);
		}
		dispose(e, t = !1) {
			if (this._shadowGenerators) {
				let e = this._shadowGenerators.values();
				for (let t = e.next(); t.done !== !0; t = e.next()) t.value.dispose();
				this._shadowGenerators = null;
			}
			if (this.getScene().stopAnimation(this), this._parentContainer) {
				let e = this._parentContainer.lights.indexOf(this);
				e > -1 && this._parentContainer.lights.splice(e, 1), this._parentContainer = null;
			}
			for (let e of this.getScene().meshes) e._removeLightSource(this, !0);
			this._uniformBuffer.dispose(), this.getScene().removeLight(this), super.dispose(e, t);
		}
		getTypeID() {
			return 0;
		}
		getScaledIntensity() {
			return this._photometricScale * this.intensity;
		}
		clone(t, n = null) {
			let r = e.GetConstructorFromName(this.getTypeID(), t, this.getScene());
			if (!r) return null;
			let i = v.Clone(r, this);
			return t && (i.name = t), n && (i.parent = n), i.setEnabled(this.isEnabled()), this.onClonedObservable.notifyObservers(i), i;
		}
		serialize() {
			let e = v.Serialize(this);
			if (e.uniqueId = this.uniqueId, e.type = this.getTypeID(), this.parent && this.parent._serializeAsParent(e), this.excludedMeshes.length > 0) {
				e.excludedMeshesIds = [];
				for (let t of this.excludedMeshes) e.excludedMeshesIds.push(t.id);
			}
			if (this.includedOnlyMeshes.length > 0) {
				e.includedOnlyMeshesIds = [];
				for (let t of this.includedOnlyMeshes) e.includedOnlyMeshesIds.push(t.id);
			}
			return v.AppendSerializedAnimations(this, e), e.ranges = this.serializeAnimationRanges(), e.isEnabled = this.isEnabled(), e;
		}
		static GetConstructorFromName(e, t, n) {
			return ne.Construct("Light_Type_" + e, t, n) || null;
		}
		static Parse(t, n, r = "") {
			let i = e.GetConstructorFromName(t.type, t.name, n);
			if (!i) return null;
			let a = v.Parse(i, t, n, r);
			if (t.excludedMeshesIds && (a._excludedMeshesIds = t.excludedMeshesIds), t.includedOnlyMeshesIds && (a._includedOnlyMeshesIds = t.includedOnlyMeshesIds), t.parentId !== void 0 && (a._waitingParentId = t.parentId), t.parentInstanceIndex !== void 0 && (a._waitingParentInstanceIndex = t.parentInstanceIndex), t.falloffType !== void 0 && (a.falloffType = t.falloffType), t.lightmapMode !== void 0 && (a.lightmapMode = t.lightmapMode), t.animations) {
				for (let e = 0; e < t.animations.length; e++) {
					let n = t.animations[e], r = l("BABYLON.Animation");
					r && a.animations.push(r.Parse(n));
				}
				ne.ParseAnimationRanges(a, t, n);
			}
			return t.autoAnimate && n.beginAnimation(a, t.autoAnimateFrom, t.autoAnimateTo, t.autoAnimateLoop, t.autoAnimateSpeed || 1), t.isEnabled !== void 0 && a.setEnabled(t.isEnabled), a._onParsed(t, n, r), a;
		}
		_onParsed(e, t, n = "") {}
		_hookArrayForExcluded(e) {
			let t = e.push;
			e.push = (...n) => {
				let r = t.apply(e, n);
				if (this._clusteredContainer) return r;
				for (let e of n) e._resyncLightSource(this);
				return r;
			};
			let n = e.splice;
			e.splice = (t, r) => {
				let i = n.call(e, t, r ?? e.length);
				if (this._clusteredContainer) return i;
				for (let e of i) e._resyncLightSource(this);
				return i;
			}, this._resyncMeshes();
		}
		_hookArrayForIncludedOnly(e) {
			let t = e.push;
			e.push = (...n) => {
				let r = t.apply(e, n);
				return this._resyncMeshes(), r;
			};
			let n = e.splice;
			e.splice = (t, r) => {
				let i = n.call(e, t, r ?? e.length);
				return this._resyncMeshes(), i;
			}, this._resyncMeshes();
		}
		_resyncMeshes() {
			if (!this._clusteredContainer) for (let e of this.getScene().meshes) e._resyncLightSource(this);
		}
		_markMeshesAsLightDirty() {
			for (let e of this.getScene().meshes) e.lightSources.indexOf(this) !== -1 && e._markSubMeshesAsLightDirty();
		}
		_computePhotometricScale() {
			this._photometricScale = this._getPhotometricScale(), this.getScene().resetCachedMaterial();
		}
		_getPhotometricScale() {
			let t = 0, n = this.getTypeID(), r = this.intensityMode;
			switch (r === e.INTENSITYMODE_AUTOMATIC && (r = n === e.LIGHTTYPEID_DIRECTIONALLIGHT ? e.INTENSITYMODE_ILLUMINANCE : e.INTENSITYMODE_LUMINOUSINTENSITY), n) {
				case e.LIGHTTYPEID_POINTLIGHT:
				case e.LIGHTTYPEID_SPOTLIGHT:
					switch (r) {
						case e.INTENSITYMODE_LUMINOUSPOWER:
							t = 1 / (4 * Math.PI);
							break;
						case e.INTENSITYMODE_LUMINOUSINTENSITY:
							t = 1;
							break;
						case e.INTENSITYMODE_LUMINANCE: t = this.radius * this.radius;
					}
					break;
				case e.LIGHTTYPEID_DIRECTIONALLIGHT:
					switch (r) {
						case e.INTENSITYMODE_ILLUMINANCE:
							t = 1;
							break;
						case e.INTENSITYMODE_LUMINANCE: {
							let e = this.radius;
							e = Math.max(e, .001), t = 2 * Math.PI * (1 - Math.cos(e));
							break;
						}
					}
					break;
				case e.LIGHTTYPEID_HEMISPHERICLIGHT:
					t = 1;
					break;
				case e.LIGHTTYPEID_RECT_AREALIGHT: t = 1;
			}
			return t;
		}
		_reorderLightsInScene() {
			let e = this.getScene();
			this._renderPriority != 0 && (e.requireLightSorting = !0), this.getScene().sortLightsByPriority();
		}
		areLightTexturesReady() {
			return !0;
		}
		_isReady() {
			return !0;
		}
	}, t = /* @__PURE__ */ new WeakMap(), (() => {
		let t = typeof Symbol == "function" && Symbol.metadata ? Object.create(n[Symbol.metadata] ?? null) : void 0;
		a = [d()], h = [d()], x = [m()], w = [m()], D = [m()], O = [m()], k = [m()], A = [m()], N = [ee("_reorderLightsInScene")], I = [m("shadowEnabled")], z = [m("excludeWithLayerMask")], H = [m("includeOnlyWithLayerMask")], G = [m("lightmapMode")], _(e, null, D, {
			kind: "getter",
			name: "range",
			static: !1,
			private: !1,
			access: {
				has: (e) => "range" in e,
				get: (e) => e.range
			},
			metadata: t
		}, null, i), _(e, null, O, {
			kind: "getter",
			name: "intensityMode",
			static: !1,
			private: !1,
			access: {
				has: (e) => "intensityMode" in e,
				get: (e) => e.intensityMode
			},
			metadata: t
		}, null, i), _(e, null, k, {
			kind: "getter",
			name: "radius",
			static: !1,
			private: !1,
			access: {
				has: (e) => "radius" in e,
				get: (e) => e.radius
			},
			metadata: t
		}, null, i), _(e, null, N, {
			kind: "accessor",
			name: "renderPriority",
			static: !1,
			private: !1,
			access: {
				has: (e) => "renderPriority" in e,
				get: (e) => e.renderPriority,
				set: (e, t) => {
					e.renderPriority = t;
				}
			},
			metadata: t
		}, P, F), _(null, null, a, {
			kind: "field",
			name: "diffuse",
			static: !1,
			private: !1,
			access: {
				has: (e) => "diffuse" in e,
				get: (e) => e.diffuse,
				set: (e, t) => {
					e.diffuse = t;
				}
			},
			metadata: t
		}, o, p), _(null, null, h, {
			kind: "field",
			name: "specular",
			static: !1,
			private: !1,
			access: {
				has: (e) => "specular" in e,
				get: (e) => e.specular,
				set: (e, t) => {
					e.specular = t;
				}
			},
			metadata: t
		}, re, b), _(null, null, x, {
			kind: "field",
			name: "falloffType",
			static: !1,
			private: !1,
			access: {
				has: (e) => "falloffType" in e,
				get: (e) => e.falloffType,
				set: (e, t) => {
					e.falloffType = t;
				}
			},
			metadata: t
		}, S, C), _(null, null, w, {
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
		}, T, E), _(null, null, A, {
			kind: "field",
			name: "_renderPriority",
			static: !1,
			private: !1,
			access: {
				has: (e) => "_renderPriority" in e,
				get: (e) => e._renderPriority,
				set: (e, t) => {
					e._renderPriority = t;
				}
			},
			metadata: t
		}, j, M), _(null, null, I, {
			kind: "field",
			name: "_shadowEnabled",
			static: !1,
			private: !1,
			access: {
				has: (e) => "_shadowEnabled" in e,
				get: (e) => e._shadowEnabled,
				set: (e, t) => {
					e._shadowEnabled = t;
				}
			},
			metadata: t
		}, L, R), _(null, null, z, {
			kind: "field",
			name: "_excludeWithLayerMask",
			static: !1,
			private: !1,
			access: {
				has: (e) => "_excludeWithLayerMask" in e,
				get: (e) => e._excludeWithLayerMask,
				set: (e, t) => {
					e._excludeWithLayerMask = t;
				}
			},
			metadata: t
		}, B, V), _(null, null, H, {
			kind: "field",
			name: "_includeOnlyWithLayerMask",
			static: !1,
			private: !1,
			access: {
				has: (e) => "_includeOnlyWithLayerMask" in e,
				get: (e) => e._includeOnlyWithLayerMask,
				set: (e, t) => {
					e._includeOnlyWithLayerMask = t;
				}
			},
			metadata: t
		}, U, W), _(null, null, G, {
			kind: "field",
			name: "_lightmapMode",
			static: !1,
			private: !1,
			access: {
				has: (e) => "_lightmapMode" in e,
				get: (e) => e._lightmapMode,
				set: (e, t) => {
					e._lightmapMode = t;
				}
			},
			metadata: t
		}, K, q), t && Object.defineProperty(e, Symbol.metadata, {
			enumerable: !0,
			configurable: !0,
			writable: !0,
			value: t
		});
	})(), e.FALLOFF_DEFAULT = y.FALLOFF_DEFAULT, e.FALLOFF_PHYSICAL = y.FALLOFF_PHYSICAL, e.FALLOFF_GLTF = y.FALLOFF_GLTF, e.FALLOFF_STANDARD = y.FALLOFF_STANDARD, e.LIGHTMAP_DEFAULT = y.LIGHTMAP_DEFAULT, e.LIGHTMAP_SPECULAR = y.LIGHTMAP_SPECULAR, e.LIGHTMAP_SHADOWSONLY = y.LIGHTMAP_SHADOWSONLY, e.INTENSITYMODE_AUTOMATIC = y.INTENSITYMODE_AUTOMATIC, e.INTENSITYMODE_LUMINOUSPOWER = y.INTENSITYMODE_LUMINOUSPOWER, e.INTENSITYMODE_LUMINOUSINTENSITY = y.INTENSITYMODE_LUMINOUSINTENSITY, e.INTENSITYMODE_ILLUMINANCE = y.INTENSITYMODE_ILLUMINANCE, e.INTENSITYMODE_LUMINANCE = y.INTENSITYMODE_LUMINANCE, e.LIGHTTYPEID_POINTLIGHT = y.LIGHTTYPEID_POINTLIGHT, e.LIGHTTYPEID_DIRECTIONALLIGHT = y.LIGHTTYPEID_DIRECTIONALLIGHT, e.LIGHTTYPEID_SPOTLIGHT = y.LIGHTTYPEID_SPOTLIGHT, e.LIGHTTYPEID_HEMISPHERICLIGHT = y.LIGHTTYPEID_HEMISPHERICLIGHT, e.LIGHTTYPEID_RECT_AREALIGHT = y.LIGHTTYPEID_RECT_AREALIGHT, e;
})(), D = (() => {
	var e;
	let r = E, i = [], a, o, s, l;
	return e = class extends r {
		constructor() {
			super(...arguments), this._position = f(this, i), this._needProjectionMatrixCompute = !0, this._viewMatrix = t.Identity(), this._projectionMatrix = t.Identity();
		}
		_setPosition(e) {
			this._position = e;
		}
		get position() {
			return this._position;
		}
		set position(e) {
			this._setPosition(e);
		}
		_setDirection(e) {
			this._direction = e;
		}
		get direction() {
			return this._direction;
		}
		set direction(e) {
			this._setDirection(e);
		}
		get shadowMinZ() {
			return this._shadowMinZ;
		}
		set shadowMinZ(e) {
			this._shadowMinZ = e, this.forceProjectionMatrixCompute();
		}
		get shadowMaxZ() {
			return this._shadowMaxZ;
		}
		set shadowMaxZ(e) {
			this._shadowMaxZ = e, this.forceProjectionMatrixCompute();
		}
		computeTransformedInformation() {
			return this.parent && this.parent.getWorldMatrix ? (this.transformedPosition ||= c.Zero(), c.TransformCoordinatesToRef(this.position, this.parent.getWorldMatrix(), this.transformedPosition), this.direction && (this.transformedDirection ||= c.Zero(), c.TransformNormalToRef(this.direction, this.parent.getWorldMatrix(), this.transformedDirection)), !0) : !1;
		}
		getDepthScale() {
			return 50;
		}
		getShadowDirection(e) {
			return this.transformedDirection ? this.transformedDirection : this.direction;
		}
		getAbsolutePosition() {
			return this.transformedPosition ? this.transformedPosition : this.position;
		}
		setDirectionToTarget(e) {
			return this.direction = c.Normalize(e.subtract(this.position)), this.direction;
		}
		getRotation() {
			this.direction.normalize();
			let e = c.Cross(this.direction, w.Y), t = c.Cross(e, this.direction);
			return c.RotationFromAxis(e, t, this.direction);
		}
		needCube() {
			return !1;
		}
		needProjectionMatrixCompute() {
			return this._needProjectionMatrixCompute;
		}
		forceProjectionMatrixCompute() {
			this._needProjectionMatrixCompute = !0;
		}
		_initCache() {
			super._initCache(), this._cache.position = c.Zero();
		}
		_isSynchronized() {
			return !!this._cache.position.equals(this.position);
		}
		computeWorldMatrix(e) {
			return !e && this.isSynchronized() ? (this._currentRenderId = this.getScene().getRenderId(), this._worldMatrix) : (this._updateCache(), this._cache.position.copyFrom(this.position), this._worldMatrix ||= t.Identity(), t.TranslationToRef(this.position.x, this.position.y, this.position.z, this._worldMatrix), this.parent && this.parent.getWorldMatrix && (this._worldMatrix.multiplyToRef(this.parent.getWorldMatrix(), this._worldMatrix), this._markSyncedWithParent()), this._worldMatrixDeterminantIsDirty = !0, this._worldMatrix);
		}
		getDepthMinZ(e) {
			return this.shadowMinZ === void 0 ? e?.minZ || 0 : this.shadowMinZ;
		}
		getDepthMaxZ(e) {
			return this.shadowMaxZ === void 0 ? e?.maxZ || 1e4 : this.shadowMaxZ;
		}
		setShadowProjectionMatrix(e, t, n) {
			return this.customProjectionMatrixBuilder ? this.customProjectionMatrixBuilder(t, n, e) : this._setDefaultShadowProjectionMatrix(e, t, n), this;
		}
		_syncParentEnabledState() {
			super._syncParentEnabledState(), (!this.parent || !this.parent.getWorldMatrix) && (this.transformedPosition = null, this.transformedDirection = null);
		}
		getViewMatrix(e) {
			let r = n.Vector3[0], i = this.position;
			this.computeTransformedInformation() && (i = this.transformedPosition), c.NormalizeToRef(this.getShadowDirection(e), r), Math.abs(c.Dot(r, c.Up())) === 1 && (r.z = 1e-13);
			let a = n.Vector3[1];
			return i.addToRef(r, a), t.LookAtLHToRef(i, a, c.Up(), this._viewMatrix), this._viewMatrix;
		}
		getProjectionMatrix(e, t) {
			return this.setShadowProjectionMatrix(this._projectionMatrix, e ?? this._viewMatrix, t ?? []), this._projectionMatrix;
		}
	}, (() => {
		let t = typeof Symbol == "function" && Symbol.metadata ? Object.create(r[Symbol.metadata] ?? null) : void 0;
		a = [h()], o = [h()], s = [m()], l = [m()], _(e, null, a, {
			kind: "getter",
			name: "position",
			static: !1,
			private: !1,
			access: {
				has: (e) => "position" in e,
				get: (e) => e.position
			},
			metadata: t
		}, null, i), _(e, null, o, {
			kind: "getter",
			name: "direction",
			static: !1,
			private: !1,
			access: {
				has: (e) => "direction" in e,
				get: (e) => e.direction
			},
			metadata: t
		}, null, i), _(e, null, s, {
			kind: "getter",
			name: "shadowMinZ",
			static: !1,
			private: !1,
			access: {
				has: (e) => "shadowMinZ" in e,
				get: (e) => e.shadowMinZ
			},
			metadata: t
		}, null, i), _(e, null, l, {
			kind: "getter",
			name: "shadowMaxZ",
			static: !1,
			private: !1,
			access: {
				has: (e) => "shadowMaxZ" in e,
				get: (e) => e.shadowMaxZ
			},
			metadata: t
		}, null, i), t && Object.defineProperty(e, Symbol.metadata, {
			enumerable: !0,
			configurable: !0,
			writable: !0,
			value: t
		});
	})(), e;
})(), O = (() => {
	var e;
	let n = D, r = [], i, a, o, s, l = [], u = [], d, h, ee, g, v = [], te = [];
	return e = class extends n {
		get iesProfileTexture() {
			return this._iesProfileTexture;
		}
		set iesProfileTexture(t) {
			this._iesProfileTexture !== t && (this._iesProfileTexture = t, this._iesProfileTexture && e._IsTexture(this._iesProfileTexture) && this._iesProfileTexture.onLoadObservable.addOnce(() => {
				this._markMeshesAsLightDirty();
			}));
		}
		get angle() {
			return this._angle;
		}
		set angle(e) {
			this._angle = e, this._cosHalfAngle = Math.cos(e * .5), this._projectionTextureProjectionLightDirty = !0, this.forceProjectionMatrixCompute(), this._computeAngleValues();
		}
		get innerAngle() {
			return this._innerAngle;
		}
		set innerAngle(e) {
			this._innerAngle = e, this._computeAngleValues();
		}
		get shadowAngleScale() {
			return this._shadowAngleScale;
		}
		set shadowAngleScale(e) {
			this._shadowAngleScale = e, this.forceProjectionMatrixCompute();
		}
		get projectionTextureMatrix() {
			return this._projectionTextureMatrix;
		}
		get projectionTextureLightNear() {
			return this._projectionTextureLightNear;
		}
		set projectionTextureLightNear(e) {
			this._projectionTextureLightNear = e, this._projectionTextureProjectionLightDirty = !0;
		}
		get projectionTextureLightFar() {
			return this._projectionTextureLightFar;
		}
		set projectionTextureLightFar(e) {
			this._projectionTextureLightFar = e, this._projectionTextureProjectionLightDirty = !0;
		}
		get projectionTextureUpDirection() {
			return this._projectionTextureUpDirection;
		}
		set projectionTextureUpDirection(e) {
			this._projectionTextureUpDirection = e, this._projectionTextureViewLightDirty = !0;
		}
		get projectionTexture() {
			return this._projectionTexture;
		}
		set projectionTexture(t) {
			this._projectionTexture !== t && (this._projectionTexture = t, this._projectionTextureDirty = !0, this._projectionTexture && !this._projectionTexture.isReady() && (e._IsProceduralTexture(this._projectionTexture) ? this._projectionTexture.getEffect().executeWhenCompiled(() => {
				this._markMeshesAsLightDirty();
			}) : e._IsTexture(this._projectionTexture) && this._projectionTexture.onLoadObservable.addOnce(() => {
				this._markMeshesAsLightDirty();
			})));
		}
		static _IsProceduralTexture(e) {
			return e.onGeneratedObservable !== void 0;
		}
		static _IsTexture(e) {
			return e.onLoadObservable !== void 0;
		}
		get projectionTextureProjectionLightMatrix() {
			return this._projectionTextureProjectionLightMatrix;
		}
		set projectionTextureProjectionLightMatrix(e) {
			this._projectionTextureProjectionLightMatrix = e, this._projectionTextureProjectionLightDirty = !1, this._projectionTextureDirty = !0;
		}
		constructor(e, n, i, a, o, s, d) {
			super(e, s, d), this._angle = f(this, r), this._innerAngle = 0, this._iesProfileTexture = null, this.exponent = f(this, l, void 0), this._projectionTextureMatrix = (f(this, u), t.Zero()), this._projectionTextureLightNear = 1e-6, this._projectionTextureLightFar = 1e3, this._projectionTextureUpDirection = c.Up(), this._projectionTexture = f(this, v, void 0), this._projectionTextureViewLightDirty = (f(this, te), !0), this._projectionTextureProjectionLightDirty = !0, this._projectionTextureDirty = !0, this._projectionTextureViewTargetVector = c.Zero(), this._projectionTextureViewLightMatrix = t.Zero(), this._projectionTextureProjectionLightMatrix = t.Zero(), this._projectionTextureScalingMatrix = t.FromValues(.5, 0, 0, 0, 0, .5, 0, 0, 0, 0, .5, 0, .5, .5, .5, 1), this.position = n, this.direction = i, this.angle = a, this.exponent = o;
		}
		getClassName() {
			return "SpotLight";
		}
		getTypeID() {
			return E.LIGHTTYPEID_SPOTLIGHT;
		}
		_setDirection(e) {
			super._setDirection(e), this._projectionTextureViewLightDirty = !0;
		}
		_setPosition(e) {
			super._setPosition(e), this._projectionTextureViewLightDirty = !0;
		}
		_setDefaultShadowProjectionMatrix(e, n, r) {
			let i = this.getScene().activeCamera;
			if (!i) return;
			this._shadowAngleScale = this._shadowAngleScale || 1;
			let a = this._shadowAngleScale * this._angle, o = this.shadowMinZ === void 0 ? i.minZ : this.shadowMinZ, s = this.shadowMaxZ === void 0 ? i.maxZ : this.shadowMaxZ, c = this.getScene().getEngine().useReverseDepthBuffer;
			t.PerspectiveFovLHToRef(a, 1, c ? s : o, c ? o : s, e, !0, this._scene.getEngine().isNDCHalfZRange, void 0, c);
		}
		_computeProjectionTextureViewLightMatrix() {
			this._projectionTextureViewLightDirty = !1, this._projectionTextureDirty = !0, this.getAbsolutePosition().addToRef(this.getShadowDirection(), this._projectionTextureViewTargetVector), t.LookAtLHToRef(this.getAbsolutePosition(), this._projectionTextureViewTargetVector, this._projectionTextureUpDirection, this._projectionTextureViewLightMatrix);
		}
		_computeProjectionTextureProjectionLightMatrix() {
			this._projectionTextureProjectionLightDirty = !1, this._projectionTextureDirty = !0;
			let e = this.projectionTextureLightFar, n = this.projectionTextureLightNear, r = e / (e - n), i = -r * n, a = 1 / Math.tan(this._angle / 2);
			t.FromValuesToRef(a / 1, 0, 0, 0, 0, a, 0, 0, 0, 0, r, 1, 0, 0, i, 0, this._projectionTextureProjectionLightMatrix);
		}
		_computeProjectionTextureMatrix() {
			if (this._projectionTextureDirty = !1, this._projectionTextureViewLightMatrix.multiplyToRef(this._projectionTextureProjectionLightMatrix, this._projectionTextureMatrix), this._projectionTexture instanceof re) {
				let e = this._projectionTexture.uScale / 2, n = this._projectionTexture.vScale / 2;
				t.FromValuesToRef(e, 0, 0, 0, 0, n, 0, 0, 0, 0, .5, 0, .5, .5, .5, 1, this._projectionTextureScalingMatrix);
			}
			this._projectionTextureMatrix.multiplyToRef(this._projectionTextureScalingMatrix, this._projectionTextureMatrix);
		}
		_buildUniformLayout() {
			this._uniformBuffer.addUniform("vLightData", 4), this._uniformBuffer.addUniform("vLightDiffuse", 4), this._uniformBuffer.addUniform("vLightSpecular", 4), this._uniformBuffer.addUniform("vLightDirection", 3), this._uniformBuffer.addUniform("vLightFalloff", 4), this._uniformBuffer.addUniform("shadowsInfo", 3), this._uniformBuffer.addUniform("depthValues", 2), this._uniformBuffer.create();
		}
		_computeAngleValues() {
			this._lightAngleScale = 1 / Math.max(.001, Math.cos(this._innerAngle * .5) - this._cosHalfAngle), this._lightAngleOffset = -this._cosHalfAngle * this._lightAngleScale;
		}
		transferTexturesToEffect(e, t) {
			return this.projectionTexture && this.projectionTexture.isReady() && (this._projectionTextureViewLightDirty && this._computeProjectionTextureViewLightMatrix(), this._projectionTextureProjectionLightDirty && this._computeProjectionTextureProjectionLightMatrix(), this._projectionTextureDirty && this._computeProjectionTextureMatrix(), e.setMatrix("textureProjectionMatrix" + t, this._projectionTextureMatrix), e.setTexture("projectionLightTexture" + t, this.projectionTexture)), this._iesProfileTexture && this._iesProfileTexture.isReady() && e.setTexture("iesLightTexture" + t, this._iesProfileTexture), this;
		}
		transferToEffect(e, t) {
			let n, r = this._scene.floatingOriginOffset;
			return this.computeTransformedInformation() ? (this._uniformBuffer.updateFloat4("vLightData", this.transformedPosition.x - r.x, this.transformedPosition.y - r.y, this.transformedPosition.z - r.z, this.exponent, t), n = c.Normalize(this.transformedDirection)) : (this._uniformBuffer.updateFloat4("vLightData", this.position.x - r.x, this.position.y - r.y, this.position.z - r.z, this.exponent, t), n = c.Normalize(this.direction)), this._uniformBuffer.updateFloat4("vLightDirection", n.x, n.y, n.z, this._cosHalfAngle, t), this._uniformBuffer.updateFloat4("vLightFalloff", this.range, this._inverseSquaredRange, this._lightAngleScale, this._lightAngleOffset, t), this;
		}
		transferToNodeMaterialEffect(e, t) {
			let n;
			return n = this.computeTransformedInformation() ? c.Normalize(this.transformedDirection) : c.Normalize(this.direction), this.getScene().useRightHandedSystem ? e.setFloat3(t, -n.x, -n.y, -n.z) : e.setFloat3(t, n.x, n.y, n.z), this;
		}
		dispose() {
			super.dispose(), this._projectionTexture && this._projectionTexture.dispose(), this._iesProfileTexture &&= (this._iesProfileTexture.dispose(), null);
		}
		getDepthMinZ(e) {
			let t = this._scene.getEngine(), n = this.shadowMinZ === void 0 ? e?.minZ ?? 0 : this.shadowMinZ;
			return t.useReverseDepthBuffer && t.isNDCHalfZRange ? n : this._scene.getEngine().isNDCHalfZRange ? 0 : n;
		}
		getDepthMaxZ(e) {
			let t = this._scene.getEngine(), n = this.shadowMaxZ === void 0 ? e?.maxZ ?? 1e4 : this.shadowMaxZ;
			return t.useReverseDepthBuffer && t.isNDCHalfZRange ? 0 : n;
		}
		areLightTexturesReady() {
			return !(this._projectionTexture && !this._projectionTexture.isReadyOrNotBlocking() || this._iesProfileTexture && !this._iesProfileTexture.isReadyOrNotBlocking());
		}
		prepareLightSpecificDefines(e, t) {
			e["SPOTLIGHT" + t] = !0, e["PROJECTEDLIGHTTEXTURE" + t] = !!(this.projectionTexture && this.projectionTexture.isReady()), e["IESLIGHTTEXTURE" + t] = !!(this._iesProfileTexture && this._iesProfileTexture.isReady());
		}
	}, (() => {
		let t = typeof Symbol == "function" && Symbol.metadata ? Object.create(n[Symbol.metadata] ?? null) : void 0;
		i = [m()], a = [m()], o = [m()], s = [m()], d = [m()], h = [m()], ee = [m()], g = [p("projectedLightTexture")], _(e, null, i, {
			kind: "getter",
			name: "angle",
			static: !1,
			private: !1,
			access: {
				has: (e) => "angle" in e,
				get: (e) => e.angle
			},
			metadata: t
		}, null, r), _(e, null, a, {
			kind: "getter",
			name: "innerAngle",
			static: !1,
			private: !1,
			access: {
				has: (e) => "innerAngle" in e,
				get: (e) => e.innerAngle
			},
			metadata: t
		}, null, r), _(e, null, o, {
			kind: "getter",
			name: "shadowAngleScale",
			static: !1,
			private: !1,
			access: {
				has: (e) => "shadowAngleScale" in e,
				get: (e) => e.shadowAngleScale
			},
			metadata: t
		}, null, r), _(e, null, d, {
			kind: "getter",
			name: "projectionTextureLightNear",
			static: !1,
			private: !1,
			access: {
				has: (e) => "projectionTextureLightNear" in e,
				get: (e) => e.projectionTextureLightNear
			},
			metadata: t
		}, null, r), _(e, null, h, {
			kind: "getter",
			name: "projectionTextureLightFar",
			static: !1,
			private: !1,
			access: {
				has: (e) => "projectionTextureLightFar" in e,
				get: (e) => e.projectionTextureLightFar
			},
			metadata: t
		}, null, r), _(e, null, ee, {
			kind: "getter",
			name: "projectionTextureUpDirection",
			static: !1,
			private: !1,
			access: {
				has: (e) => "projectionTextureUpDirection" in e,
				get: (e) => e.projectionTextureUpDirection
			},
			metadata: t
		}, null, r), _(null, null, s, {
			kind: "field",
			name: "exponent",
			static: !1,
			private: !1,
			access: {
				has: (e) => "exponent" in e,
				get: (e) => e.exponent,
				set: (e, t) => {
					e.exponent = t;
				}
			},
			metadata: t
		}, l, u), _(null, null, g, {
			kind: "field",
			name: "_projectionTexture",
			static: !1,
			private: !1,
			access: {
				has: (e) => "_projectionTexture" in e,
				get: (e) => e._projectionTexture,
				set: (e, t) => {
					e._projectionTexture = t;
				}
			},
			metadata: t
		}, v, te), t && Object.defineProperty(e, Symbol.metadata, {
			enumerable: !0,
			configurable: !0,
			writable: !0,
			value: t
		});
	})(), e;
})(), k = [
	{ regex: /* @__PURE__ */ RegExp("^/nodes/\\d+/extensions/") },
	{ regex: /* @__PURE__ */ RegExp("^/animations/\\d+/extensions/") },
	{ regex: /* @__PURE__ */ RegExp("^/nodes/\\d+/weights") },
	{ regex: /* @__PURE__ */ RegExp("^/meshes/\\d+/weights") },
	{ regex: /* @__PURE__ */ RegExp("/extensions/KHR_texture_transform/") }
], A = class {
	constructor(e, t) {
		this._gltf = e, this._infoTree = t;
	}
	convert(e) {
		let t = this._gltf, n = this._infoTree, r;
		if (!e.startsWith("/")) throw Error("Path must start with a /");
		let i = e.split("/");
		if (i.shift(), i[i.length - 1].includes(".length")) {
			let e = i[i.length - 1].split(".");
			i.pop(), i.push(...e);
		}
		let a = !1;
		for (let o of i) if (o === "length") {
			if (n.length) n = n.length;
			else if (n.__array__) throw Error(`Path ${e} is invalid - no length accessor`);
			else throw Error(`Path ${e} is invalid`);
			t !== void 0 && (r = t);
		} else {
			if (n.__ignoreObjectTree__ && (a = !0), n.__array__) n = n.__array__;
			else if (n = n[o], !n) throw Error(`Path ${e} is invalid`);
			if (n.__passThroughTarget__) a = !0;
			else if (a) {
				let e = /^\d+$/.test(o) ? parseInt(o, 10) : NaN;
				if (!isNaN(e) && typeof n.get == "function") {
					let t = n;
					n = { ...t }, n.get = (n, r, ...i) => t.get(n, e, ...i), typeof t.set == "function" && (n.set = (n, r, i, ...a) => t.set(n, r, e, ...a)), typeof t.getTarget == "function" && (n.getTarget = (n, r, ...i) => t.getTarget(n, e, ...i)), t.getPropertyName && (n.getPropertyName = t.getPropertyName.map((t) => (n) => t(n, e)));
				}
			} else if (t === void 0) {
				if (!k.find((t) => t.regex.test(e))) throw Error(`Path ${e} is invalid`);
			} else t = t?.[o];
			n.__target__ && t !== void 0 && (r = t);
		}
		return {
			object: r,
			info: n
		};
	}
}, j = class {
	constructor(e, t) {
		this._light = e, this.animations = [], this._aspect = e.height === 0 ? t.rect?.aspect ?? 1 : e.width / e.height, this._sizeScale = t.type === "disk" ? Math.sqrt(Math.PI) / 2 : 1;
	}
	get size() {
		return this._light.height / this._sizeScale;
	}
	set size(e) {
		let t = this.aspect;
		this._light.height = e * this._sizeScale, this._light.width = this._light.height * t;
	}
	get aspect() {
		return this._light.height !== 0 && (this._aspect = this._light.width / this._light.height), this._aspect;
	}
	set aspect(e) {
		this._aspect = e, this._light.width = this._light.height * e;
	}
}, M = /*#__PURE__*/ new WeakMap();
function N(e) {
	let t = e._babylonLight;
	if (!t) return;
	let n = M.get(t);
	return n || (n = new j(t, e), M.set(t, n)), n;
}
//#endregion
//#region node_modules/@babylonjs/loaders/glTF/2.0/Extensions/objectModelMapping.js
function P(e, t) {
	return {
		type: "FlowGraphInteger",
		isReadOnly: !0,
		get: (t) => {
			let n = e(t);
			return n === void 0 ? void 0 : S.FromValue(n);
		},
		getTarget: t,
		getPropertyName: [() => "length"]
	};
}
var F = {
	length: P((e) => e.length, (e) => e.map((e) => e._babylonTransformNode)),
	__array__: {
		__target__: !0,
		translation: {
			type: "Vector3",
			get: (e) => e._babylonTransformNode?.position,
			set: (e, t) => t._babylonTransformNode?.position.copyFrom(e),
			getTarget: (e) => e._babylonTransformNode,
			getPropertyName: [() => "position"]
		},
		rotation: {
			type: "Quaternion",
			get: (e) => e._babylonTransformNode?.rotationQuaternion,
			set: (e, t) => t._babylonTransformNode?.rotationQuaternion?.copyFrom(e),
			getTarget: (e) => e._babylonTransformNode,
			getPropertyName: [() => "rotationQuaternion"]
		},
		scale: {
			type: "Vector3",
			get: (e) => e._babylonTransformNode?.scaling,
			set: (e, t) => t._babylonTransformNode?.scaling.copyFrom(e),
			getTarget: (e) => e._babylonTransformNode,
			getPropertyName: [() => "scaling"]
		},
		weights: {
			__passThroughTarget__: !0,
			length: P((e) => {
				let t = K(e);
				return t ? t.mtm.numTargets : e?.mesh === void 0 ? void 0 : e._morphTargetWeights?.length ?? 0;
			}, (e) => e?._babylonTransformNode ?? e?._morphTargetWeights),
			__array__: {
				__target__: !0,
				type: "number",
				get: (e, t) => {
					let n = K(e);
					if (n && t !== void 0 && t >= 0 && t < n.mtm.numTargets) return q(n.mtm.getTarget(t).influence);
					if (!n && t !== void 0) return e?._morphTargetWeights?.[t];
				},
				set: (e, t, n) => {
					let r = typeof e == "number" ? e : typeof e?.value == "number" ? e.value : e, i = K(t), a = i?.mtm.numTargets ?? t?._morphTargetWeights?.length ?? 0;
					if (n === void 0 || n < 0 || n >= a) throw Error("Morph target weight index is out of range.");
					if (!i) t._morphTargetWeights[n] = r;
					else for (let e of i.meshes) {
						let t = e.morphTargetManager?.getTarget(n);
						t && (t.influence = r);
					}
				},
				getTarget: (e, t) => {
					let n = K(e);
					return n && t !== void 0 && t >= 0 && t < n.mtm.numTargets ? n.mtm.getTarget(t) : e?._babylonTransformNode ?? e?._morphTargetWeights;
				},
				getPropertyName: [(e, t) => K(e) ? "influence" : String(t)]
			},
			type: "number[]",
			get: (e) => {
				let t = K(e);
				if (!t) return e?._morphTargetWeights?.slice() ?? [];
				let n = [];
				for (let e = 0; e < t.mtm.numTargets; e++) n.push(q(t.mtm.getTarget(e).influence));
				return n;
			},
			getTarget: (e) => e?._babylonTransformNode ?? e?._morphTargetWeights,
			getPropertyName: [() => "influence"]
		},
		matrix: {
			type: "Matrix",
			get: (e) => t.Compose(e._babylonTransformNode?.scaling, e._babylonTransformNode?.rotationQuaternion, e._babylonTransformNode?.position),
			getTarget: (e) => e._babylonTransformNode,
			isReadOnly: !0
		},
		globalMatrix: {
			type: "Matrix",
			get: (e) => {
				let n = t.Identity(), r = e.parent;
				for (; r && r.parent;) r = r.parent;
				let i = e._babylonTransformNode?.position._isDirty || e._babylonTransformNode?.rotationQuaternion?._isDirty || e._babylonTransformNode?.scaling._isDirty;
				if (r) {
					let t = r._babylonTransformNode?.computeWorldMatrix(!0).invert();
					t && e._babylonTransformNode?.computeWorldMatrix(i)?.multiplyToRef(t, n);
				} else e._babylonTransformNode && n.copyFrom(e._babylonTransformNode.computeWorldMatrix(i));
				return n;
			},
			getTarget: (e) => e._babylonTransformNode,
			isReadOnly: !0
		},
		camera: {
			type: "string",
			get: (e) => e.camera === void 0 ? "" : `/cameras/${e.camera}`,
			getTarget: (e) => e,
			isReadOnly: !0
		},
		mesh: {
			type: "string",
			get: (e) => e.mesh === void 0 ? "" : `/meshes/${e.mesh}`,
			getTarget: (e) => e,
			isReadOnly: !0
		},
		skin: {
			type: "string",
			get: (e) => e.skin === void 0 ? "" : `/skins/${e.skin}`,
			getTarget: (e) => e,
			isReadOnly: !0
		},
		parent: {
			type: "string",
			get: (e) => e.parent && e.parent.index !== void 0 ? `/nodes/${e.parent.index}` : "",
			getTarget: (e) => e,
			isReadOnly: !0
		},
		children: {
			length: P((e) => e?.length ?? 0, (e) => e ?? []),
			__array__: {
				__target__: !0,
				type: "string",
				get: (e) => typeof e == "number" ? `/nodes/${e}` : "",
				getTarget: () => ({ __nodeIndex: !0 }),
				isReadOnly: !0
			}
		},
		extensions: {
			EXT_lights_ies: {
				multiplier: {
					type: "number",
					get: (e) => e._babylonTransformNode?.getChildren((e) => e instanceof O, !0)[0]?.intensity,
					getTarget: (e) => e._babylonTransformNode?.getChildren((e) => e instanceof O, !0)[0],
					set: (e, t) => {
						if (t._babylonTransformNode) {
							let n = t._babylonTransformNode.getChildren((e) => e instanceof O, !0)[0];
							n && (n.intensity = e);
						}
					}
				},
				color: {
					type: "Color3",
					get: (e) => e._babylonTransformNode?.getChildren((e) => e instanceof O, !0)[0]?.diffuse,
					getTarget: (e) => e._babylonTransformNode?.getChildren((e) => e instanceof O, !0)[0],
					set: (e, t) => {
						if (t._babylonTransformNode) {
							let n = t._babylonTransformNode.getChildren((e) => e instanceof O, !0)[0];
							n && (n.diffuse = e);
						}
					}
				}
			},
			KHR_node_visibility: { visible: {
				type: "boolean",
				get: (e) => e._primitiveBabylonMeshes ? e._primitiveBabylonMeshes[0].isVisible : !1,
				getTarget: () => void 0,
				set: (e, t) => {
					t._primitiveBabylonMeshes && t._primitiveBabylonMeshes.forEach((t) => t.isVisible = e);
				}
			} }
		}
	}
}, I = {
	length: P((e) => e.length, (e) => e.map((e) => e._babylonAnimationGroup)),
	__array__: {
		__target__: !0,
		type: "string",
		get: (e) => e && typeof e.index == "number" ? `/animations/${e.index}` : "",
		getTarget: (e) => e._babylonAnimationGroup,
		isReadOnly: !0
	}
}, L = {
	length: P((e) => e.length, (e) => e.map((e) => e.primitives[0]._instanceData?.babylonSourceMesh)),
	__array__: {
		__target__: !0,
		primitives: {
			length: P((e) => e?.length ?? 0, (e) => e ?? []),
			__array__: {
				__target__: !0,
				material: {
					type: "string",
					get: (e) => e.material === void 0 ? "" : `/materials/${e.material}`,
					getTarget: (e) => e,
					isReadOnly: !0
				}
			}
		},
		weights: {
			length: P((e) => e?.length ?? 0, (e) => e ?? []),
			__array__: {
				__target__: !0,
				type: "number",
				get: (e) => e,
				getTarget: () => ({ __weightValue: !0 }),
				isReadOnly: !0
			}
		}
	}
}, R = {
	length: P((e) => e.length, (e) => e.map((e) => e._babylonCamera)),
	__array__: {
		__target__: !0,
		orthographic: {
			xmag: {
				componentsCount: 2,
				type: "number",
				get: (e) => e._babylonCamera?.orthoRight ?? 0,
				set: (e, t) => {
					t._babylonCamera && (t._babylonCamera.orthoLeft = -e, t._babylonCamera.orthoRight = e);
				},
				getTarget: (e) => e._babylonCamera,
				getPropertyName: [() => "orthoLeft", () => "orthoRight"]
			},
			ymag: {
				componentsCount: 2,
				type: "number",
				get: (e) => e._babylonCamera?.orthoTop ?? 0,
				set: (e, t) => {
					t._babylonCamera && (t._babylonCamera.orthoBottom = -e, t._babylonCamera.orthoTop = e);
				},
				getTarget: (e) => e._babylonCamera,
				getPropertyName: [() => "orthoBottom", () => "orthoTop"]
			},
			zfar: {
				type: "number",
				get: (e) => e._babylonCamera?.maxZ,
				set: (e, t) => {
					t._babylonCamera && (t._babylonCamera.maxZ = e);
				},
				getTarget: (e) => e._babylonCamera,
				getPropertyName: [() => "maxZ"]
			},
			znear: {
				type: "number",
				get: (e) => e._babylonCamera?.minZ,
				set: (e, t) => {
					t._babylonCamera && (t._babylonCamera.minZ = e);
				},
				getTarget: (e) => e._babylonCamera,
				getPropertyName: [() => "minZ"]
			}
		},
		perspective: {
			aspectRatio: {
				type: "number",
				get: (e) => e._babylonCamera?.getEngine().getAspectRatio(e._babylonCamera),
				getTarget: (e) => e._babylonCamera,
				getPropertyName: [() => "aspectRatio"],
				isReadOnly: !0
			},
			yfov: {
				type: "number",
				get: (e) => e._babylonCamera?.fov,
				set: (e, t) => {
					t._babylonCamera && (t._babylonCamera.fov = e);
				},
				getTarget: (e) => e._babylonCamera,
				getPropertyName: [() => "fov"]
			},
			zfar: {
				type: "number",
				get: (e) => e._babylonCamera?.maxZ,
				set: (e, t) => {
					t._babylonCamera && (t._babylonCamera.maxZ = e);
				},
				getTarget: (e) => e._babylonCamera,
				getPropertyName: [() => "maxZ"]
			},
			znear: {
				type: "number",
				get: (e) => e._babylonCamera?.minZ,
				set: (e, t) => {
					t._babylonCamera && (t._babylonCamera.minZ = e);
				},
				getTarget: (e) => e._babylonCamera,
				getPropertyName: [() => "minZ"]
			}
		}
	}
}, z = {
	length: P((e) => e.length, (e) => e.map((e) => U(e))),
	__array__: {
		__target__: !0,
		doubleSided: {
			type: "boolean",
			get: (e, t, n) => !U(e, t, n)?.backFaceCulling,
			set: /*#__PURE__*/ W((e, t) => {
				t && (t.backFaceCulling = !e);
			}),
			getTarget: (e, t, n) => U(e, t, n),
			getPropertyName: [() => "backFaceCulling"]
		},
		alphaCutoff: {
			type: "number",
			get: (e, t, n) => U(e, t, n)?.alphaCutOff,
			set: /*#__PURE__*/ W((e, t) => {
				t && (t.alphaCutOff = e);
			}),
			getTarget: (e, t, n) => U(e, t, n),
			getPropertyName: [() => "alphaCutOff"]
		},
		emissiveFactor: {
			type: "Color3",
			get: (e, t, n) => U(e, t, n).emissiveColor,
			set: /*#__PURE__*/ W((e, t) => t.emissiveColor.copyFrom(e)),
			getTarget: (e, t, n) => U(e, t, n),
			getPropertyName: [() => "emissiveColor"]
		},
		emissiveTexture: { extensions: { KHR_texture_transform: Y("emissiveTexture") } },
		normalTexture: {
			scale: {
				type: "number",
				get: (e, t, n) => V(e, n, "bumpTexture")?.level,
				set: /*#__PURE__*/ W((e, t) => {
					let n = H(t, "bumpTexture");
					n && (n.level = e);
				}),
				getTarget: (e, t, n) => U(e, t, n),
				getPropertyName: [() => "bumpTexture.level"]
			},
			extensions: { KHR_texture_transform: Y("bumpTexture") }
		},
		occlusionTexture: {
			strength: {
				type: "number",
				get: (e, t, n) => U(e, t, n).ambientTextureStrength,
				set: /*#__PURE__*/ W((e, t) => {
					t && (t.ambientTextureStrength = e);
				}),
				getTarget: (e, t, n) => U(e, t, n),
				getPropertyName: [() => "ambientTextureStrength"]
			},
			extensions: { KHR_texture_transform: Y("ambientTexture") }
		},
		pbrMetallicRoughness: {
			baseColorFactor: {
				type: "Color4",
				get: (e, t, n) => {
					let r = U(e, t, n);
					return a.FromColor3(r.albedoColor, r.alpha);
				},
				set: /*#__PURE__*/ W((e, t) => {
					t.albedoColor.set(e.r, e.g, e.b), t.alpha = e.a;
				}),
				getTarget: (e, t, n) => U(e, t, n),
				getPropertyName: [() => "albedoColor", () => "alpha"]
			},
			baseColorTexture: { extensions: { KHR_texture_transform: Y("albedoTexture") } },
			metallicFactor: {
				type: "number",
				get: (e, t, n) => U(e, t, n).metallic,
				set: /*#__PURE__*/ W((e, t) => {
					t && (t.metallic = e);
				}),
				getTarget: (e, t, n) => U(e, t, n),
				getPropertyName: [() => "metallic"]
			},
			roughnessFactor: {
				type: "number",
				get: (e, t, n) => U(e, t, n).roughness,
				set: /*#__PURE__*/ W((e, t) => {
					t && (t.roughness = e);
				}),
				getTarget: (e, t, n) => U(e, t, n),
				getPropertyName: [() => "roughness"]
			},
			metallicRoughnessTexture: { extensions: { KHR_texture_transform: Y("metallicTexture") } }
		},
		extensions: {
			KHR_materials_anisotropy: {
				anisotropyStrength: {
					type: "number",
					get: (e, t, n) => U(e, t, n)?.anisotropy?.intensity,
					set: /*#__PURE__*/ W((e, t) => {
						t && (t.anisotropy.intensity = e);
					}),
					getTarget: (e, t, n) => U(e, t, n),
					getPropertyName: [() => "anisotropy.intensity"]
				},
				anisotropyRotation: {
					type: "number",
					get: (e, t, n) => U(e, t, n)?.anisotropy?.angle,
					set: /*#__PURE__*/ W((e, t) => {
						t && (t.anisotropy.angle = e);
					}),
					getTarget: (e, t, n) => U(e, t, n),
					getPropertyName: [() => "anisotropy.angle"]
				},
				anisotropyTexture: { extensions: { KHR_texture_transform: Y("anisotropy", "texture") } }
			},
			KHR_materials_clearcoat: {
				clearcoatFactor: {
					type: "number",
					get: (e, t, n) => U(e, t, n).clearCoat.intensity,
					set: /*#__PURE__*/ W((e, t) => {
						t.clearCoat.intensity = e;
					}),
					getTarget: (e, t, n) => U(e, t, n),
					getPropertyName: [() => "clearCoat.intensity"]
				},
				clearcoatRoughnessFactor: {
					type: "number",
					get: (e, t, n) => U(e, t, n).clearCoat.roughness,
					set: /*#__PURE__*/ W((e, t) => {
						t.clearCoat.roughness = e;
					}),
					getTarget: (e, t, n) => U(e, t, n),
					getPropertyName: [() => "clearCoat.roughness"]
				},
				clearcoatTexture: { extensions: { KHR_texture_transform: Y("clearCoat", "texture") } },
				clearcoatNormalTexture: {
					scale: {
						type: "number",
						get: (e, t, n) => U(e, t, n).clearCoat.bumpTexture?.level,
						getTarget: U,
						set: /*#__PURE__*/ W((e, t) => t.clearCoat.bumpTexture.level = e)
					},
					extensions: { KHR_texture_transform: Y("clearCoat", "bumpTexture") }
				},
				clearcoatRoughnessTexture: { extensions: { KHR_texture_transform: Y("clearCoat", "textureRoughness") } }
			},
			KHR_materials_dispersion: { dispersion: {
				type: "number",
				get: (e, t, n) => U(e, t, n).subSurface.dispersion,
				getTarget: U,
				set: /*#__PURE__*/ W((e, t) => t.subSurface.dispersion = e)
			} },
			KHR_materials_emissive_strength: { emissiveStrength: {
				type: "number",
				get: (e, t, n) => U(e, t, n).emissiveIntensity,
				getTarget: U,
				set: /*#__PURE__*/ W((e, t) => t.emissiveIntensity = e)
			} },
			KHR_materials_ior: { ior: {
				type: "number",
				get: (e, t, n) => U(e, t, n).indexOfRefraction,
				getTarget: U,
				set: /*#__PURE__*/ W((e, t) => t.indexOfRefraction = e)
			} },
			KHR_materials_iridescence: {
				iridescenceFactor: {
					type: "number",
					get: (e, t, n) => U(e, t, n).iridescence.intensity,
					getTarget: U,
					set: /*#__PURE__*/ W((e, t) => t.iridescence.intensity = e)
				},
				iridescenceIor: {
					type: "number",
					get: (e, t, n) => U(e, t, n).iridescence.indexOfRefraction,
					getTarget: U,
					set: /*#__PURE__*/ W((e, t) => t.iridescence.indexOfRefraction = e)
				},
				iridescenceTexture: { extensions: { KHR_texture_transform: Y("iridescence", "texture") } },
				iridescenceThicknessMaximum: {
					type: "number",
					get: (e, t, n) => U(e, t, n).iridescence.maximumThickness,
					getTarget: U,
					set: /*#__PURE__*/ W((e, t) => t.iridescence.maximumThickness = e)
				},
				iridescenceThicknessMinimum: {
					type: "number",
					get: (e, t, n) => U(e, t, n).iridescence.minimumThickness,
					getTarget: U,
					set: /*#__PURE__*/ W((e, t) => t.iridescence.minimumThickness = e)
				},
				iridescenceThicknessTexture: { extensions: { KHR_texture_transform: Y("iridescence", "thicknessTexture") } }
			},
			KHR_materials_sheen: {
				sheenColorFactor: {
					type: "Color3",
					get: (e, t, n) => U(e, t, n).sheen.color,
					getTarget: U,
					set: /*#__PURE__*/ W((e, t) => t.sheen.color.copyFrom(e))
				},
				sheenColorTexture: { extensions: { KHR_texture_transform: Y("sheen", "texture") } },
				sheenRoughnessFactor: {
					type: "number",
					get: (e, t, n) => U(e, t, n).sheen.roughness ?? 0,
					getTarget: U,
					set: /*#__PURE__*/ W((e, t) => t.sheen.roughness = e),
					getPropertyName: [() => "sheen.roughness"]
				},
				sheenRoughnessTexture: { extensions: { KHR_texture_transform: Y("sheen", "textureRoughness") } }
			},
			KHR_materials_specular: {
				specularFactor: {
					type: "number",
					get: (e, t, n) => U(e, t, n).metallicF0Factor,
					getTarget: U,
					set: /*#__PURE__*/ W((e, t) => t.metallicF0Factor = e),
					getPropertyName: [() => "metallicF0Factor"]
				},
				specularColorFactor: {
					type: "Color3",
					get: (e, t, n) => U(e, t, n).metallicReflectanceColor,
					getTarget: U,
					set: /*#__PURE__*/ W((e, t) => t.metallicReflectanceColor.copyFrom(e)),
					getPropertyName: [() => "metallicReflectanceColor"]
				},
				specularTexture: { extensions: { KHR_texture_transform: Y("metallicReflectanceTexture") } },
				specularColorTexture: { extensions: { KHR_texture_transform: Y("reflectanceTexture") } }
			},
			KHR_materials_transmission: {
				transmissionFactor: {
					type: "number",
					get: (e, t, n) => U(e, t, n).subSurface.refractionIntensity,
					getTarget: U,
					set: /*#__PURE__*/ W((e, t) => t.subSurface.refractionIntensity = e),
					getPropertyName: [() => "subSurface.refractionIntensity"]
				},
				transmissionTexture: { extensions: { KHR_texture_transform: Y("subSurface", "refractionIntensityTexture", {
					extensionKey: "KHR_materials_transmission",
					texturePath: ["transmissionTexture"]
				}) } }
			},
			KHR_materials_diffuse_transmission: {
				diffuseTransmissionFactor: {
					type: "number",
					get: (e, t, n) => U(e, t, n).subSurface.translucencyIntensity,
					getTarget: U,
					set: /*#__PURE__*/ W((e, t) => t.subSurface.translucencyIntensity = e)
				},
				diffuseTransmissionTexture: { extensions: { KHR_texture_transform: Y("subSurface", "translucencyIntensityTexture", {
					extensionKey: "KHR_materials_diffuse_transmission",
					texturePath: ["diffuseTransmissionTexture"]
				}) } },
				diffuseTransmissionColorFactor: {
					type: "Color3",
					get: (e, t, n) => U(e, t, n).subSurface.translucencyColor,
					getTarget: U,
					set: /*#__PURE__*/ W((e, t) => e && t.subSurface.translucencyColor?.copyFrom(e))
				},
				diffuseTransmissionColorTexture: { extensions: { KHR_texture_transform: Y("subSurface", "translucencyColorTexture", {
					extensionKey: "KHR_materials_diffuse_transmission",
					texturePath: ["diffuseTransmissionColorTexture"]
				}) } }
			},
			KHR_materials_volume: {
				attenuationColor: {
					type: "Color3",
					get: (e, t, n) => U(e, t, n).subSurface.tintColor,
					getTarget: U,
					set: /*#__PURE__*/ W((e, t) => t.subSurface.tintColor.copyFrom(e))
				},
				attenuationDistance: {
					type: "number",
					get: (e, t, n) => U(e, t, n).subSurface.tintColorAtDistance,
					getTarget: U,
					set: /*#__PURE__*/ W((e, t) => t.subSurface.tintColorAtDistance = e)
				},
				thicknessFactor: {
					type: "number",
					get: (e, t, n) => U(e, t, n).subSurface.maximumThickness,
					getTarget: U,
					set: /*#__PURE__*/ W((e, t) => t.subSurface.maximumThickness = e)
				},
				thicknessTexture: { extensions: { KHR_texture_transform: Y("subSurface", "thicknessTexture", {
					extensionKey: "KHR_materials_volume",
					texturePath: ["thicknessTexture"]
				}) } }
			}
		}
	}
}, B = {
	KHR_lights_punctual: { lights: {
		length: P((e) => e.length, (e) => e.map((e) => e._babylonLight)),
		__array__: {
			__target__: !0,
			color: {
				type: "Color3",
				get: (e) => e._babylonLight?.diffuse,
				set: (e, t) => t._babylonLight?.diffuse.copyFrom(e),
				getTarget: (e) => e._babylonLight,
				getPropertyName: [(e) => "diffuse"]
			},
			intensity: {
				type: "number",
				get: (e) => e._babylonLight?.intensity,
				set: (e, t) => t._babylonLight ? t._babylonLight.intensity = e : void 0,
				getTarget: (e) => e._babylonLight,
				getPropertyName: [(e) => "intensity"]
			},
			range: {
				type: "number",
				get: (e) => e._babylonLight?.range,
				set: (e, t) => t._babylonLight ? t._babylonLight.range = e : void 0,
				getTarget: (e) => e._babylonLight,
				getPropertyName: [(e) => "range"]
			},
			spot: {
				innerConeAngle: {
					type: "number",
					get: (e) => e._babylonLight?.innerAngle / 2,
					set: (e, t) => t._babylonLight ? t._babylonLight.innerAngle = e * 2 : void 0,
					getTarget: (e) => e._babylonLight,
					getPropertyName: [() => "innerAngle"]
				},
				outerConeAngle: {
					type: "number",
					get: (e) => e._babylonLight?.angle / 2,
					set: (e, t) => t._babylonLight ? t._babylonLight.angle = e * 2 : void 0,
					getTarget: (e) => e._babylonLight,
					getPropertyName: [() => "angle"]
				}
			}
		}
	} },
	EXT_lights_area: { lights: {
		length: P((e) => e.length, (e) => e.map((e) => e._babylonLight)),
		__array__: {
			__target__: !0,
			color: {
				type: "Color3",
				get: (e) => e._babylonLight?.diffuse,
				set: (e, t) => t._babylonLight?.diffuse.copyFrom(e),
				getTarget: (e) => e._babylonLight,
				getPropertyName: [(e) => "diffuse"]
			},
			intensity: {
				type: "number",
				get: (e) => e._babylonLight?.intensity,
				set: (e, t) => t._babylonLight ? t._babylonLight.intensity = e : void 0,
				getTarget: (e) => e._babylonLight,
				getPropertyName: [(e) => "intensity"]
			},
			size: {
				type: "number",
				get: (e) => N(e)?.size,
				set: (e, t) => {
					let n = N(t);
					n && (n.size = e);
				},
				getTarget: N,
				getPropertyName: [() => "size"]
			},
			rect: { aspect: {
				type: "number",
				get: (e) => N(e)?.aspect,
				set: (e, t) => {
					let n = N(t);
					n && (n.aspect = e);
				},
				getTarget: N,
				getPropertyName: [() => "aspect"]
			} }
		}
	} },
	EXT_lights_ies: { lights: { length: P((e) => e.length, (e) => e.map((e) => e._babylonLight)) } },
	EXT_lights_image_based: { lights: {
		length: P((e) => e.length, (e) => e.map((e) => e._babylonTexture)),
		__array__: {
			__target__: !0,
			intensity: {
				type: "number",
				get: (e) => e._babylonTexture?.level,
				set: (e, t) => {
					t._babylonTexture && (t._babylonTexture.level = e);
				},
				getTarget: (e) => e._babylonTexture
			},
			rotation: {
				type: "Quaternion",
				get: (e) => e._babylonTexture && o.FromRotationMatrix(e._babylonTexture?.getReflectionTextureMatrix()),
				set: (e, n) => {
					n._babylonTexture && (n._babylonTexture.getScene()?.useRightHandedSystem || (e = o.Inverse(e)), t.FromQuaternionToRef(e, n._babylonTexture.getReflectionTextureMatrix()));
				},
				getTarget: (e) => e._babylonTexture
			}
		}
	} }
};
function V(e, t, n, r) {
	return H(U(e, void 0, t), n, r);
}
function H(e, t, n) {
	return n ? e[t][n] : e[t];
}
function U(e, t, n) {
	let r = e._data?.[n?.fillMode ?? x.MATERIAL_TriangleFillMode]?.babylonMaterial;
	if (!r && n?.fillMode === void 0) for (let t in e._data) {
		r = e._data[Number(t)].babylonMaterial;
		break;
	}
	return r;
}
function W(e) {
	return (t, n, r, i) => {
		if (i?.fillMode !== void 0) {
			e(t, U(n, r, i), n);
			return;
		}
		let a = !1;
		for (let r in n._data) a = !0, e(t, n._data[Number(r)].babylonMaterial, n);
		a || e(t, U(n, r, i), n);
	};
}
function G(e) {
	let t = e?._babylonTransformNode;
	if (!t) return;
	if (t.morphTargetManager) return t.morphTargetManager;
	let n = e._primitiveBabylonMeshes;
	if (n) for (let e of n) {
		if (e?.morphTargetManager) return e.morphTargetManager;
		if (e?.sourceMesh?.morphTargetManager) return e.sourceMesh.morphTargetManager;
	}
}
function K(e) {
	let t = e?._babylonTransformNode;
	if (!t) return;
	let n = G(e);
	if (n && e._primitiveBabylonMeshes && e._primitiveBabylonMeshes.length > 0) return {
		mtm: n,
		meshes: e._primitiveBabylonMeshes
	};
	let r = t.getDescendants(!1);
	for (let e of r) {
		let t = e, n = t.morphTargetManager ?? t.sourceMesh?.morphTargetManager;
		if (!n) continue;
		let r = [], i = t.parent;
		if (i) for (let e of i.getChildMeshes(!0)) (e.morphTargetManager ?? e.sourceMesh?.morphTargetManager) === n && r.push(e);
		return r.length === 0 && r.push(t), {
			mtm: n,
			meshes: r
		};
	}
}
function q(e) {
	return Number.isFinite(e) ? parseFloat(e.toPrecision(7)) : e;
}
function J(e, t, n) {
	if (!e) return;
	let r = e.extensions;
	if (!r) {
		if (!n) return;
		r = {}, e.extensions = r;
	}
	let i = r[t.extensionKey];
	if (!i) {
		if (!n) return;
		i = {}, r[t.extensionKey] = i;
	}
	for (let e of t.texturePath) {
		let t = i[e];
		if (!t) {
			if (!n) return;
			t = {}, i[e] = t;
		}
		i = t;
	}
	if (!i.extensions) {
		if (!n) return;
		i.extensions = {};
	}
	let a = i.extensions.KHR_texture_transform;
	if (!a) {
		if (!n) return;
		a = {}, i.extensions.KHR_texture_transform = a;
	}
	return a;
}
function Y(e, t, n) {
	return {
		offset: {
			componentsCount: 2,
			type: "Vector2",
			get: (r, a, o) => {
				let s = V(r, o, e, t);
				if (s) return new i(s.uOffset, s.vOffset);
				if (n) {
					let e = J(r, n, !1)?.offset;
					return new i(e?.[0] ?? 0, e?.[1] ?? 0);
				}
				return new i(0, 0);
			},
			getTarget: U,
			set: /*#__PURE__*/ W((r, i, a) => {
				let o = H(i, e, t);
				if (o && (o.uOffset = r.x, o.vOffset = r.y), n) {
					let e = J(a, n, !0);
					e && (e.offset = [r.x, r.y]);
				}
			}),
			getPropertyName: [() => `${e}${t ? "." + t : ""}.uOffset`, () => `${e}${t ? "." + t : ""}.vOffset`]
		},
		rotation: {
			type: "number",
			get: (r, i, a) => {
				let o = V(r, a, e, t);
				return o ? -o.wAng : n ? J(r, n, !1)?.rotation ?? 0 : 0;
			},
			getTarget: U,
			set: /*#__PURE__*/ W((r, i, a) => {
				let o = H(i, e, t);
				if (o && (o.wAng = -r), n) {
					let e = J(a, n, !0);
					e && (e.rotation = r);
				}
			}),
			getPropertyName: [() => `${e}${t ? "." + t : ""}.wAng`]
		},
		scale: {
			componentsCount: 2,
			type: "Vector2",
			get: (r, a, o) => {
				let s = V(r, o, e, t);
				if (s) return new i(s.uScale, s.vScale);
				if (n) {
					let e = J(r, n, !1)?.scale;
					return new i(e?.[0] ?? 1, e?.[1] ?? 1);
				}
				return new i(1, 1);
			},
			getTarget: U,
			set: /*#__PURE__*/ W((r, i, a) => {
				let o = H(i, e, t);
				if (o && (o.uScale = r.x, o.vScale = r.y), n) {
					let e = J(a, n, !0);
					e && (e.scale = [r.x, r.y]);
				}
			}),
			getPropertyName: [() => `${e}${t ? "." + t : ""}.uScale`, () => `${e}${t ? "." + t : ""}.vScale`]
		}
	};
}
var X = {
	scene: {
		__target__: !0,
		type: "number",
		get: (e) => e ?? 0,
		getTarget: () => ({ __gltfRoot: !0 }),
		isReadOnly: !0,
		getPropertyName: [() => "scene"]
	},
	cameras: R,
	nodes: F,
	materials: z,
	extensions: B,
	animations: I,
	meshes: L,
	scenes: {
		length: P((e) => e.length, (e) => e),
		__array__: {
			__target__: !0,
			nodes: {
				length: P((e) => e?.length ?? 0, (e) => e ?? []),
				__array__: {
					__target__: !0,
					type: "string",
					get: (e) => typeof e == "number" ? `/nodes/${e}` : "",
					getTarget: () => ({ __nodeIndex: !0 }),
					isReadOnly: !0
				}
			}
		}
	},
	skins: {
		length: P((e) => e.length, (e) => e.map((e) => e._data?.babylonSkeleton)),
		__array__: {
			__target__: !0,
			joints: {
				length: P((e) => e?.length ?? 0, (e) => e ?? []),
				__array__: {
					__target__: !0,
					type: "string",
					get: (e) => typeof e == "number" ? `/nodes/${e}` : "",
					getTarget: () => ({ __nodeIndex: !0 }),
					isReadOnly: !0
				}
			},
			skeleton: {
				type: "string",
				get: (e) => {
					let t = e.skeleton;
					return typeof t == "number" ? `/nodes/${t}` : "";
				},
				getTarget: (e) => e,
				isReadOnly: !0
			}
		}
	}
};
function ie(e) {
	if (Array.isArray(e)) return e.map((e) => ie(e));
	if (typeof e == "object" && e) {
		let t = Object.getPrototypeOf(e);
		if (t !== Object.prototype && t !== null) return e;
		let n = {};
		for (let [t, r] of Object.entries(e)) n[t] = ie(r);
		return n;
	}
	return e;
}
function ae(e, t) {
	for (let t of e?.nodes ?? []) {
		if (t._babylonTransformNode || t.mesh === void 0 || t._morphTargetWeights) continue;
		let n = e.meshes?.[t.mesh];
		if (n) {
			let e = n.primitives[0]?.targets?.length ?? 0;
			t._morphTargetWeights = Array.from({ length: e }, (e, r) => t.weights?.[r] ?? n.weights?.[r] ?? 0);
		}
	}
	if (!t) return new A(e, X);
	let n = ie(X);
	return t(n), new A(e, n);
}
function oe(e) {
	let t = e.split("/").map((e) => e.replace(/{}/g, "__array__")), n = X;
	for (let e of t) e && (n = n[e]);
	if (n && n.type && n.get) return n;
}
function Z(e, t) {
	let n = e.split("/").map((e) => e.replace(/{}/g, "__array__")), r = X;
	for (let e of n) e && (r = r[e]);
	r && r.type && r.get && (r.interpolation = t);
}
function se(e, t, n = X) {
	let r = e.split("/").map((e) => e.replace(/{}/g, "__array__")), i = n;
	for (let e of r) if (e) {
		if (!i[e]) {
			if (e === "?") {
				i.__ignoreObjectTree__ = !0;
				continue;
			}
			i[e] = {}, e === "__array__" && (i[e].__target__ = !0);
		}
		i = i[e];
	}
	Object.assign(i, t);
}
//#endregion
//#region node_modules/@babylonjs/loaders/glTF/2.0/glTFLoaderAnimation.pure.js
var ce = /* @__PURE__ */ e({
	AnimationPropertyInfo: () => Q,
	RegisterGLTFLoaderAnimation: () => me,
	TransformNodeAnimationPropertyInfo: () => $,
	WeightAnimationPropertyInfo: () => fe,
	getQuaternion: () => ue,
	getVector3: () => le,
	getWeights: () => de
});
function le(e, t, n, r) {
	return c.FromArray(t, n).scaleInPlace(r);
}
function ue(e, t, n, r) {
	return o.FromArray(t, n).scaleInPlace(r);
}
function de(e, t, n, r) {
	let i = Array(e._numMorphTargets);
	for (let e = 0; e < i.length; e++) i[e] = t[n++] * r;
	return i;
}
var Q = class {
	constructor(e, t, n, r) {
		this.type = e, this.name = t, this.getValue = n, this.getStride = r;
	}
	_buildAnimation(e, t, n) {
		let r = new b(e, this.name, t, this.type);
		return r.setKeys(n, !0), r;
	}
}, $ = class extends Q {
	buildAnimations(e, t, n, r) {
		let i = [];
		return i.push({
			babylonAnimatable: e._babylonTransformNode,
			babylonAnimation: this._buildAnimation(t, n, r)
		}), i;
	}
}, fe = class extends Q {
	buildAnimations(e, t, n, r) {
		let i = [];
		if (e._numMorphTargets) for (let a = 0; a < e._numMorphTargets; a++) {
			let o = new b(`${t}_${a}`, this.name, n, this.type);
			if (o.setKeys(r.map((e) => ({
				frame: e.frame,
				inTangent: e.inTangent ? e.inTangent[a] : void 0,
				value: e.value[a],
				outTangent: e.outTangent ? e.outTangent[a] : void 0,
				interpolation: e.interpolation
			})), !0), e._primitiveBabylonMeshes) {
				for (let t of e._primitiveBabylonMeshes) if (t.morphTargetManager) {
					let e = t.morphTargetManager.getTarget(a), n = o.clone();
					e.animations.push(n), i.push({
						babylonAnimatable: e,
						babylonAnimation: n
					});
				}
			}
		}
		return i;
	}
}, pe = !1;
function me() {
	pe || (pe = !0, Z("/nodes/{}/translation", [new $(b.ANIMATIONTYPE_VECTOR3, "position", le, () => 3)]), Z("/nodes/{}/rotation", [new $(b.ANIMATIONTYPE_QUATERNION, "rotationQuaternion", ue, () => 4)]), Z("/nodes/{}/scale", [new $(b.ANIMATIONTYPE_VECTOR3, "scaling", le, () => 3)]), Z("/nodes/{}/weights", [new fe(b.ANIMATIONTYPE_FLOAT, "influence", de, (e) => e._numMorphTargets)]));
}
//#endregion
export { oe as a, N as c, E as d, w as f, se as i, O as l, me as n, ae as o, ce as r, Z as s, Q as t, D as u };
