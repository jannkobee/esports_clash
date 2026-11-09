import { l as e } from "./math.scalar.functions-D7lyzZPV.js";
import { a as t, o as n, u as r } from "./math.color.pure-CPmbqLkh.js";
//#region node_modules/@babylonjs/core/Maths/math.path.js
var i;
(function(e) {
	e[e.CW = 0] = "CW", e[e.CCW = 1] = "CCW";
})(i ||= {});
var a = class {
	static Interpolate(e, t, n, r, i) {
		if (e === 0) return 0;
		let a = 1 - 3 * r + 3 * t, o = 3 * r - 6 * t, s = 3 * t, c = e;
		for (let t = 0; t < 5; t++) {
			let t = c * c, n = t * c * a + o * t + s * c, r = 1 / (3 * a * t + 2 * o * c + s);
			c -= (n - e) * r, c = Math.min(1, Math.max(0, c));
		}
		return 3 * (1 - c) ** 2 * c * n + 3 * (1 - c) * c ** 2 * i + c ** 3;
	}
}, o = class i {
	constructor(e, n = null, i, a = !1) {
		this.path = e, this._curve = [], this._distances = [], this._tangents = [], this._normals = [], this._binormals = [], this._pointAtData = {
			id: 0,
			point: r.Zero(),
			previousPointArrayIndex: 0,
			position: 0,
			subPosition: 0,
			interpolateReady: !1,
			interpolationMatrix: t.Identity()
		};
		for (let t = 0; t < e.length; t++) this._curve[t] = e[t].clone();
		this._raw = i || !1, this._alignTangentsWithPath = a, this._compute(n, a);
	}
	getCurve() {
		return this._curve;
	}
	getPoints() {
		return this._curve;
	}
	length() {
		return this._distances[this._distances.length - 1];
	}
	getTangents() {
		return this._tangents;
	}
	getNormals() {
		return this._normals;
	}
	getBinormals() {
		return this._binormals;
	}
	getDistances() {
		return this._distances;
	}
	getPointAt(e) {
		return this._updatePointAtData(e).point;
	}
	getTangentAt(e, t = !1) {
		return this._updatePointAtData(e, t), t ? r.TransformCoordinates(r.Forward(), this._pointAtData.interpolationMatrix) : this._tangents[this._pointAtData.previousPointArrayIndex];
	}
	getNormalAt(e, t = !1) {
		return this._updatePointAtData(e, t), t ? r.TransformCoordinates(r.Right(), this._pointAtData.interpolationMatrix) : this._normals[this._pointAtData.previousPointArrayIndex];
	}
	getBinormalAt(e, t = !1) {
		return this._updatePointAtData(e, t), t ? r.TransformCoordinates(r.UpReadOnly, this._pointAtData.interpolationMatrix) : this._binormals[this._pointAtData.previousPointArrayIndex];
	}
	getDistanceAt(e) {
		return this.length() * e;
	}
	getPreviousPointIndexAt(e) {
		return this._updatePointAtData(e), this._pointAtData.previousPointArrayIndex;
	}
	getSubPositionAt(e) {
		return this._updatePointAtData(e), this._pointAtData.subPosition;
	}
	getClosestPositionTo(e) {
		let t = Number.MAX_VALUE, n = 0;
		for (let i = 0; i < this._curve.length - 1; i++) {
			let a = this._curve[i + 0], o = this._curve[i + 1].subtract(a).normalize(), s = this._distances[i + 1] - this._distances[i + 0], c = Math.min(Math.max(r.Dot(o, e.subtract(a).normalize()), 0) * r.Distance(a, e) / s, 1), l = r.Distance(a.add(o.scale(c * s)), e);
			l < t && (t = l, n = (this._distances[i + 0] + s * c) / this.length());
		}
		return n;
	}
	slice(e = 0, t = 1) {
		if (e < 0 && (e = 1 - e * -1 % 1), t < 0 && (t = 1 - t * -1 % 1), e > t) {
			let n = e;
			e = t, t = n;
		}
		let n = this.getCurve(), r = this.getPointAt(e), a = this.getPreviousPointIndexAt(e), o = this.getPointAt(t), s = this.getPreviousPointIndexAt(t) + 1, c = [];
		return e !== 0 && (a++, c.push(r)), c.push(...n.slice(a, s)), (t !== 1 || e === 1) && c.push(o), new i(c, this.getNormalAt(e), this._raw, this._alignTangentsWithPath);
	}
	update(e, t = null, n = !1) {
		for (let t = 0; t < e.length; t++) this._curve[t].x = e[t].x, this._curve[t].y = e[t].y, this._curve[t].z = e[t].z;
		return this._compute(t, n), this;
	}
	_compute(e, t = !1) {
		let n = this._curve.length;
		if (n < 2) return;
		this._tangents[0] = this._getFirstNonNullVector(0), this._raw || this._tangents[0].normalize(), this._tangents[n - 1] = this._curve[n - 1].subtract(this._curve[n - 2]), this._raw || this._tangents[n - 1].normalize();
		let i = this._tangents[0], a = this._normalVector(i, e);
		this._normals[0] = a, this._raw || this._normals[0].normalize(), this._binormals[0] = r.Cross(i, this._normals[0]), this._raw || this._binormals[0].normalize(), this._distances[0] = 0;
		let o, s, c, l, u;
		for (let e = 1; e < n; e++) o = this._getLastNonNullVector(e), e < n - 1 && (s = this._getFirstNonNullVector(e), this._tangents[e] = t ? s : o.add(s), this._tangents[e].normalize()), this._distances[e] = this._distances[e - 1] + this._curve[e].subtract(this._curve[e - 1]).length(), c = this._tangents[e], u = this._binormals[e - 1], this._normals[e] = r.Cross(u, c), this._raw || (this._normals[e].length() === 0 ? (l = this._normals[e - 1], this._normals[e] = l.clone()) : this._normals[e].normalize()), this._binormals[e] = r.Cross(c, this._normals[e]), this._raw || this._binormals[e].normalize();
		this._pointAtData.id = NaN;
	}
	_getFirstNonNullVector(e) {
		let t = 1, n = this._curve[e + t].subtract(this._curve[e]);
		for (; n.length() === 0 && e + t + 1 < this._curve.length;) t++, n = this._curve[e + t].subtract(this._curve[e]);
		return n;
	}
	_getLastNonNullVector(e) {
		let t = 1, n = this._curve[e].subtract(this._curve[e - t]);
		for (; n.length() === 0 && e > t;) t++, n = this._curve[e].subtract(this._curve[e - t]);
		return n;
	}
	_normalVector(t, n) {
		let i, a = t.length();
		if (a === 0 && (a = 1), n == null) {
			let n;
			n = e(Math.abs(t.y) / a, 1, .001) ? e(Math.abs(t.x) / a, 1, .001) ? e(Math.abs(t.z) / a, 1, .001) ? r.Zero() : new r(0, 0, 1) : new r(1, 0, 0) : new r(0, -1, 0), i = r.Cross(t, n);
		} else i = r.Cross(t, n), r.CrossToRef(i, t, i);
		return i.normalize(), i;
	}
	_updatePointAtData(e, t = !1) {
		if (this._pointAtData.id === e) return this._pointAtData.interpolateReady || this._updateInterpolationMatrix(), this._pointAtData;
		this._pointAtData.id = e;
		let n = this.getPoints();
		if (e <= 0) return this._setPointAtData(0, 0, n[0], 0, t);
		if (e >= 1) return this._setPointAtData(1, 1, n[n.length - 1], n.length - 1, t);
		let i = n[0], a, o = 0, s = e * this.length();
		for (let c = 1; c < n.length; c++) {
			a = n[c];
			let l = r.Distance(i, a);
			if (o += l, o === s) return this._setPointAtData(e, 1, a, c, t);
			if (o > s) {
				let n = (o - s) / l, r = i.subtract(a), u = a.add(r.scaleInPlace(n));
				return this._setPointAtData(e, 1 - n, u, c - 1, t);
			}
			i = a;
		}
		return this._pointAtData;
	}
	_setPointAtData(e, t, n, r, i) {
		return this._pointAtData.point = n, this._pointAtData.position = e, this._pointAtData.subPosition = t, this._pointAtData.previousPointArrayIndex = r, this._pointAtData.interpolateReady = i, i && this._updateInterpolationMatrix(), this._pointAtData;
	}
	_updateInterpolationMatrix() {
		this._pointAtData.interpolationMatrix = t.Identity();
		let e = this._pointAtData.previousPointArrayIndex;
		if (e !== this._tangents.length - 1) {
			let t = e + 1, r = this._tangents[e].clone(), i = this._normals[e].clone(), a = this._binormals[e].clone(), o = this._tangents[t].clone(), s = this._normals[t].clone(), c = this._binormals[t].clone(), l = n.RotationQuaternionFromAxis(i, a, r), u = n.RotationQuaternionFromAxis(s, c, o);
			n.Slerp(l, u, this._pointAtData.subPosition).toRotationMatrix(this._pointAtData.interpolationMatrix);
		}
	}
}, s = class e {
	constructor() {
		this._easingMode = e.EASINGMODE_EASEIN;
	}
	setEasingMode(e) {
		let t = Math.min(Math.max(e, 0), 2);
		this._easingMode = t;
	}
	getEasingMode() {
		return this._easingMode;
	}
	easeInCore(e) {
		throw Error("You must implement this method");
	}
	ease(t) {
		switch (this._easingMode) {
			case e.EASINGMODE_EASEIN: return this.easeInCore(t);
			case e.EASINGMODE_EASEOUT: return 1 - this.easeInCore(1 - t);
		}
		return t >= .5 ? (1 - this.easeInCore((1 - t) * 2)) * .5 + .5 : this.easeInCore(t * 2) * .5;
	}
};
s.EASINGMODE_EASEIN = 0, s.EASINGMODE_EASEOUT = 1, s.EASINGMODE_EASEINOUT = 2;
var c = class extends s {
	easeInCore(e) {
		return e = Math.max(0, Math.min(1, e)), 1 - Math.sqrt(1 - e * e);
	}
}, l = class extends s {
	constructor(e = 1) {
		super(), this.amplitude = e;
	}
	easeInCore(e) {
		let t = Math.max(0, this.amplitude);
		return e ** 3 - e * t * Math.sin(3.141592653589793 * e);
	}
}, u = class extends s {
	constructor(e = 3, t = 2) {
		super(), this.bounces = e, this.bounciness = t;
	}
	easeInCore(e) {
		let t = Math.max(0, this.bounces), n = this.bounciness;
		n <= 1 && (n = 1.001);
		let r = n ** +t, i = 1 - n, a = (1 - r) / i + r * .5, o = e * a, s = Math.log(-o * (1 - n) + 1) / Math.log(n), c = Math.floor(s), l = c + 1, u = (1 - n ** +c) / (i * a), d = (u + (1 - n ** +l) / (i * a)) * .5, f = e - d, p = d - u;
		return -((1 / n) ** (t - c)) / (p * p) * (f - p) * (f + p);
	}
}, d = class extends s {
	easeInCore(e) {
		return e * e * e;
	}
}, f = class extends s {
	constructor(e = 3, t = 3) {
		super(), this.oscillations = e, this.springiness = t;
	}
	easeInCore(e) {
		let t, n = Math.max(0, this.oscillations), r = Math.max(0, this.springiness);
		return t = r === 0 ? e : (Math.exp(r * e) - 1) / (Math.exp(r) - 1), t * Math.sin((6.283185307179586 * n + 1.5707963267948966) * e);
	}
}, p = class extends s {
	constructor(e = 2) {
		super(), this.exponent = e;
	}
	easeInCore(e) {
		return this.exponent <= 0 ? e : (Math.exp(this.exponent * e) - 1) / (Math.exp(this.exponent) - 1);
	}
}, m = class extends s {
	constructor(e = 0, t = 0, n = 1, r = 1) {
		super(), this.x1 = e, this.y1 = t, this.x2 = n, this.y2 = r;
	}
	easeInCore(e) {
		return a.Interpolate(e, this.x1, this.y1, this.x2, this.y2);
	}
};
//#endregion
export { d as a, p as c, c as i, o as l, m as n, s as o, u as r, f as s, l as t };
