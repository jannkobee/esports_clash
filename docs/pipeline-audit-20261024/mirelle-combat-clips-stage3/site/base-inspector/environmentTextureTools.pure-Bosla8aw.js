import { i as e } from "./math.scalar.functions-D7lyzZPV.js";
import { t } from "./internalTexture-QUW4uXxg.js";
import { t as n } from "./logger-DQIzSR_y.js";
import { r } from "./tools.functions-DEecYKlu.js";
import { u as i } from "./math.color.pure-CPmbqLkh.js";
import { n as a } from "./sphericalPolynomial.pure-DQ1oR6Od.js";
import { t as o } from "./baseTexture.pure-CQS3PJ87.js";
import { _ as s } from "./tools.pure-Dy2G52NL.js";
import { t as c } from "./postProcess.pure-D4rgohp_.js";
//#region node_modules/@babylonjs/core/Misc/environmentTextureTools.pure.js
var l = "image/png", u = 2, d = [
	134,
	22,
	135,
	150,
	246,
	214,
	150,
	54
];
function f(e) {
	let t = new DataView(e.buffer, e.byteOffset, e.byteLength), r = 0;
	for (let e = 0; e < d.length; e++) if (t.getUint8(r++) !== d[e]) return n.Error("Not a babylon environment map"), null;
	let i = "", a;
	for (; a = t.getUint8(r++);) i += String.fromCharCode(a);
	let o = JSON.parse(i);
	return o = p(o), o.binaryDataPosition = r, o.specular && (o.specular.lodGenerationScale = o.specular.lodGenerationScale || .8), o;
}
function p(e) {
	if (e.version > u) throw Error(`Unsupported babylon environment map version "${e.version}". Latest supported version is "${u}".`);
	return e.version === 2 || (e = {
		...e,
		version: 2,
		imageType: l
	}), e;
}
function m(e, t) {
	t = p(t);
	let n = t.specular, r = Math.log2(t.width);
	if (r = Math.round(r) + 1, n.mipmaps.length !== 6 * r) throw Error(`Unsupported specular mipmaps number "${n.mipmaps.length}"`);
	let i = Array(r);
	for (let a = 0; a < r; a++) {
		i[a] = [
			,
			,
			,
			,
			,
			,
		];
		for (let r = 0; r < 6; r++) {
			let o = n.mipmaps[a * 6 + r];
			i[a][r] = new Uint8Array(e.buffer, e.byteOffset + t.binaryDataPosition + o.position, o.length);
		}
	}
	return i;
}
function h(e, t) {
	t = p(t);
	let n = [
		,
		,
		,
		,
		,
		,
	], r = t.irradiance?.irradianceTexture;
	if (r) {
		if (r.faces.length !== 6) throw Error(`Incorrect irradiance texture faces number "${r.faces.length}"`);
		for (let i = 0; i < 6; i++) {
			let a = r.faces[i];
			n[i] = new Uint8Array(e.buffer, e.byteOffset + t.binaryDataPosition + a.position, a.length);
		}
	}
	return n;
}
function g(e, t, n) {
	n = p(n);
	let r = n.specular;
	if (!r) return Promise.resolve([]);
	e._lodGenerationScale = r.lodGenerationScale;
	let a = [], o = m(t, n);
	a.push(v(e, o, n.imageType));
	let s = n.irradiance?.irradianceTexture;
	if (s) {
		let r = h(t, n), o = null;
		n.irradiance?.irradianceTexture?.dominantDirection && (o = i.FromArray(n.irradiance.irradianceTexture.dominantDirection)), a.push(y(e, r, s.size, n.imageType, o));
	}
	return Promise.all(a);
}
async function _(e, t, n, r, i, a, o, s, c, l, u) {
	return await new Promise((d, f) => {
		if (n) {
			let n = t.createTexture(null, !0, !0, null, 1, null, (e) => {
				f(e);
			}, e);
			r?.onEffectCreatedObservable.addOnce((s) => {
				s.executeWhenCompiled(() => {
					r.externalTextureSamplerBinding = !0, r.onApply = (r) => {
						r._bindTexture("textureSampler", n), r.setFloat2("scale", 1, t._features.needsInvertingBitmap && e instanceof ImageBitmap ? -1 : 1);
					}, t.scenes.length && (t.scenes[0].postProcessManager.directRender([r], l, !0, a, o), t.restoreDefaultFramebuffer(), n.dispose(), URL.revokeObjectURL(i), d());
				});
			});
		} else {
			if (t._uploadImageToTexture(u, e, a, o), s) {
				let n = c[o];
				n && t._uploadImageToTexture(n._texture, e, a, 0);
			}
			d();
		}
	});
}
async function v(e, t, n = l) {
	let r = e.getEngine();
	e.format = 5, e.type = 0, e.generateMipMaps = !0, e._cachedAnisotropicFilteringLevel = null, r.updateTextureSamplingMode(3, e), await b(e, t, !0, n), e.isReady = !0;
}
async function y(e, n, r, i = l, a = null) {
	let s = e.getEngine(), c = new t(s, 5), u = new o(s, c);
	e._irradianceTexture = u, u._dominantDirection = a, c.isCube = !0, c.format = 5, c.type = 0, c.generateMipMaps = !0, c._cachedAnisotropicFilteringLevel = null, c.generateMipMaps = !0, c.width = r, c.height = r, s.updateTextureSamplingMode(3, c), await b(c, [n], !1, i), s.generateMipMapsForCubemap(c), c.isReady = !0;
}
async function b(n, i, a, u = l) {
	if (!r(n.width)) throw Error("Texture size must be a power of two");
	let d = e(n.width) + 1, f = n.getEngine(), p = !1, m = !1, h = null, g = null, v = null, y = f.getCaps();
	y.textureLOD ? f._features.supportRenderAndCopyToLodForFloatTextures ? y.textureHalfFloatRender && y.textureHalfFloatLinearFiltering ? (p = !0, n.type = 2) : y.textureFloatRender && y.textureFloatLinearFiltering && (p = !0, n.type = 1) : p = !1 : (p = !1, m = a);
	let b = 0;
	if (p) f.isWebGPU ? (b = 1, await import("./rgbdDecode.fragment-CKa8YGsB.js")) : await import("./rgbdDecode.fragment-zGWpG1jY.js"), h = new c("rgbdDecode", "rgbdDecode", null, null, 1, null, 3, f, !1, void 0, n.type, void 0, null, !1, void 0, b), n._isRGBD = !1, n.invertY = !1, g = f.createRenderTargetCubeTexture(n.width, {
		generateDepthBuffer: !1,
		generateMipMaps: !0,
		generateStencilBuffer: !1,
		samplingMode: 3,
		type: n.type,
		format: 5
	});
	else if (n._isRGBD = !0, n.invertY = !0, m) {
		v = {};
		let e = n._lodGenerationScale, r = n._lodGenerationOffset;
		for (let i = 0; i < 3; i++) {
			let a = 1 - i / 2, s = r, c = (d - 1) * e + r, l = s + (c - s) * a, u = Math.round(Math.min(Math.max(l, 0), c)), p = new t(f, 2);
			p.isCube = !0, p.invertY = !0, p.generateMipMaps = !1, f.updateTextureSamplingMode(2, p);
			let m = new o(null);
			switch (m._isCube = !0, m._texture = p, v[u] = m, i) {
				case 0:
					n._lodTextureLow = m;
					break;
				case 1:
					n._lodTextureMid = m;
					break;
				case 2: n._lodTextureHigh = m;
			}
		}
	}
	let x = [];
	for (let e = 0; e < i.length; e++) for (let t = 0; t < 6; t++) {
		let r = i[e][t], a = s(r), o = new Blob([a], { type: u }), c = URL.createObjectURL(o), l;
		if (f._features.forceBitmapOverHTMLImageElement) l = f.createImageBitmap(o, {
			premultiplyAlpha: "none",
			colorSpaceConversion: "none"
		}).then(async (r) => await _(r, f, p, h, c, t, e, m, v, g, n));
		else {
			let r = new Image();
			r.src = c, l = new Promise((i, a) => {
				r.onload = () => {
					_(r, f, p, h, c, t, e, m, v, g, n).then(() => i()).catch((e) => {
						a(e);
					});
				}, r.onerror = (e) => {
					a(e);
				};
			});
		}
		x.push(l);
	}
	if (await Promise.all(x), i.length < d) {
		let e, t = 2 ** (d - 1 - i.length), r = t * t * 4;
		switch (n.type) {
			case 0:
				e = new Uint8Array(r);
				break;
			case 2:
				e = new Uint16Array(r);
				break;
			case 1: e = new Float32Array(r);
		}
		for (let t = i.length; t < d; t++) for (let r = 0; r < 6; r++) f._uploadArrayBufferViewToTexture(g?.texture || n, e, r, t);
	}
	if (g) {
		let e = n._irradianceTexture;
		n._irradianceTexture = null, f._releaseTexture(n), g._swapAndDie(n), n._irradianceTexture = e;
	}
	h && h.dispose(), m && (n._lodTextureHigh && n._lodTextureHigh._texture && (n._lodTextureHigh._texture.isReady = !0), n._lodTextureMid && n._lodTextureMid._texture && (n._lodTextureMid._texture.isReady = !0), n._lodTextureLow && n._lodTextureLow._texture && (n._lodTextureLow._texture.isReady = !0));
}
function x(e, t) {
	t = p(t);
	let n = t.irradiance;
	if (!n) return;
	let r = new a();
	i.FromArrayToRef(n.x, 0, r.x), i.FromArrayToRef(n.y, 0, r.y), i.FromArrayToRef(n.z, 0, r.z), i.FromArrayToRef(n.xx, 0, r.xx), i.FromArrayToRef(n.yy, 0, r.yy), i.FromArrayToRef(n.zz, 0, r.zz), i.FromArrayToRef(n.yz, 0, r.yz), i.FromArrayToRef(n.zx, 0, r.zx), i.FromArrayToRef(n.xy, 0, r.xy), e._sphericalPolynomial = r;
}
function S(e, t, n, r, i) {
	let a = v(e.getEngine().createRawCubeTexture(null, e.width, e.format, e.type, e.generateMipMaps, e.invertY, e.samplingMode, e._compression), t).then(() => e);
	return e.onRebuildCallback = (e) => ({
		proxy: a,
		isReady: !0,
		isAsync: !0
	}), e._source = 13, e._bufferViewArrayArray = t, e._lodGenerationScale = r, e._lodGenerationOffset = i, e._sphericalPolynomial = n, v(e, t).then(() => (e.isReady = !0, e));
}
//#endregion
export { S as i, g as n, x as r, f as t };
