import { d as e, t } from "./math.scalar.functions-D7lyzZPV.js";
import { t as n } from "./engineStore-D0BoPdea.js";
import { t as r } from "./logger-DQIzSR_y.js";
import { n as i, t as a } from "./effectRenderer.pure-CXa3ZM9e.js";
import { b as o, r as s, y as c } from "./decorators-BldPRAAT.js";
import { r as l, w as u } from "./tools.pure-Dy2G52NL.js";
//#region node_modules/@babylonjs/core/Misc/dumpTools.pure.js
var d = /* @__PURE__ */ e({
	Dispose: () => b,
	DumpData: () => y,
	DumpDataAsync: () => v,
	DumpFramebuffer: () => _,
	DumpTools: () => x,
	EncodeImageAsync: () => g,
	RegisterDumpTools: () => C
}), f = null;
async function p() {
	let e = n.LastCreatedEngine?.createCanvas(100, 100) ?? new OffscreenCanvas(100, 100);
	e instanceof OffscreenCanvas && r.Warn("DumpData: OffscreenCanvas will be used for dumping data. This may result in lossy alpha values.");
	let { ThinEngine: t } = await import("./thinEngine.pure-CFnvxmRZ.js").then((e) => e.n);
	if (!t.IsSupported) throw Error("DumpData: No WebGL context available. Cannot dump data.");
	let o = new t(e, !1, {
		preserveDrawingBuffer: !0,
		depth: !1,
		stencil: !1,
		alpha: !0,
		premultipliedAlpha: !1,
		antialias: !1,
		failIfMajorPerformanceCaveat: !1
	});
	n.Instances.pop(), n.OnEnginesDisposedObservable.add((e) => {
		o && e !== o && !o.isDisposed && n.Instances.length === 0 && b();
	}), o.getCaps().parallelShaderCompile = void 0;
	let s = new a(o), { passPixelShader: c } = await import("./pass.fragment-DUzd5yX2.js");
	return {
		canvas: e,
		dumpEngine: {
			engine: o,
			renderer: s,
			wrapper: new i({
				engine: o,
				name: c.name,
				fragmentShader: c.shader,
				samplerNames: ["textureSampler"]
			})
		}
	};
}
async function m() {
	return f ||= p(), await f;
}
var h = (() => {
	var e;
	let t = [], n;
	return e = class {
		static async EncodeImageAsync(e, t, n, r, i, a) {
			let o = await m(), s = o.dumpEngine;
			s.engine.setSize(t, n, !0);
			let c = s.engine.createRawTexture(e, t, n, 5, !1, !i, 1);
			return s.renderer.setViewport(), s.renderer.applyEffectWrapper(s.wrapper), s.wrapper.effect._bindTexture("textureSampler", c), s.renderer.draw(), c.dispose(), await new Promise((e, t) => {
				l.ToBlob(o.canvas, (n) => {
					n ? e(n) : t(/* @__PURE__ */ Error("EncodeImageAsync: Failed to convert canvas to blob."));
				}, r, a);
			});
		}
	}, (() => {
		let r = typeof Symbol == "function" && Symbol.metadata ? Object.create(null) : void 0;
		n = [s], c(e, null, n, {
			kind: "method",
			name: "EncodeImageAsync",
			static: !0,
			private: !1,
			access: {
				has: (e) => "EncodeImageAsync" in e,
				get: (e) => e.EncodeImageAsync
			},
			metadata: r
		}, null, t), r && Object.defineProperty(e, Symbol.metadata, {
			enumerable: !0,
			configurable: !0,
			writable: !0,
			value: r
		}), o(e, t);
	})(), e;
})(), g = h.EncodeImageAsync;
async function _(e, t, n, r, i = "image/png", a, o) {
	let s = await n.readPixels(0, 0, e, t);
	y(e, t, new Uint8Array(s.buffer), r, i, a, !0, void 0, o);
}
async function v(e, n, i, a = "image/png", o, s = !1, c = !1, d) {
	if (i instanceof Float32Array) {
		let e = new Uint8Array(i.length), n = i.length;
		for (; n--;) {
			let r = i[n];
			e[n] = Math.round(t(r) * 255);
		}
		i = e;
	}
	let f = await h.EncodeImageAsync(i, e, n, a, s, d);
	o !== void 0 && l.DownloadBlob(f, o), f.type !== a && r.Warn(`DumpData: The requested mimeType '${a}' is not supported. The result has mimeType '${f.type}' instead.`);
	let p = await f.arrayBuffer();
	return c ? p : `data:${a};base64,${u(p)}`;
}
function y(e, t, n, r, i = "image/png", a, o = !1, s = !1, c) {
	a === void 0 && !r && (a = ""), v(e, t, n, i, a, o, s, c).then((e) => {
		r && r(e);
	});
}
function b() {
	f &&= (f?.then((e) => {
		e.canvas instanceof HTMLCanvasElement && e.canvas.remove(), e.dumpEngine && (e.dumpEngine.engine.dispose(), e.dumpEngine.renderer.dispose(), e.dumpEngine.wrapper.dispose());
	}), null);
}
var x = {
	DumpData: y,
	DumpDataAsync: v,
	DumpFramebuffer: _,
	Dispose: b
}, S = !1;
function C() {
	S || (S = !0, l.DumpData = y, l.DumpDataAsync = v, l.DumpFramebuffer = _);
}
//#endregion
export { d as t };
