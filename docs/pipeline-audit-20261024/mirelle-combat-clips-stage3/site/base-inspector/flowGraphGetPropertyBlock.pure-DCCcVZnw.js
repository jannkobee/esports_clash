import { n as e } from "./typeStore-pENEWnX2.js";
import { n as t, u as n } from "./flowGraphRichTypes.pure-BpKU4EZT.js";
import { t as r } from "./flowGraphCachedOperationBlock-BsIcMusH.js";
//#region node_modules/@babylonjs/core/FlowGraph/Blocks/Data/flowGraphGetPropertyBlock.pure.js
function i(e, t) {
	if (e === null || typeof e != "object" && typeof e != "function") return e;
	let n = t ?? /* @__PURE__ */ new Map();
	if (n.has(e)) return n.get(e);
	let r = e.clone;
	if (typeof r == "function") {
		let t = r.call(e);
		return n.set(e, t), t;
	}
	let a = Object.getPrototypeOf(e);
	if (!Array.isArray(e) && a !== Object.prototype && a !== null) {
		let t = structuredClone(e);
		return n.set(e, t), t;
	}
	let o = Array.isArray(e) ? Array(e.length) : Object.create(a);
	n.set(e, o);
	for (let t of Reflect.ownKeys(e)) {
		let r = Object.getOwnPropertyDescriptor(e, t);
		"value" in r ? r.value = i(r.value, n) : (r.value = i(Reflect.get(e, t), n), delete r.get, delete r.set, r.writable = !0), Object.defineProperty(o, t, r);
	}
	return o;
}
var a = class extends r {
	constructor(e) {
		super(t, e), this.config = e, this.object = this.registerDataInput("object", t, e.object), this.propertyName = this.registerDataInput("propertyName", n, e.propertyName), this.customGetFunction = this.registerDataInput("customGetFunction", t);
	}
	_doOperation(e) {
		let t = this.customGetFunction.getValue(e), n;
		if (t) n = t(this.object.getValue(e), this.propertyName.getValue(e), e);
		else {
			let t = this.object.getValue(e), r = this.propertyName.getValue(e);
			n = t && r ? this._getPropertyValue(t, r) : void 0;
		}
		return n;
	}
	_getPropertyValue(e, t) {
		let n = t.split("."), r = e;
		for (let e of n) if (r = r[e], r === void 0) return;
		return r;
	}
	_getInvalidOutputValue(e) {
		return Object.prototype.hasOwnProperty.call(this.config, "invalidValue") ? i(this.config.invalidValue) : super._getInvalidOutputValue(e);
	}
	getClassName() {
		return "FlowGraphGetPropertyBlock";
	}
}, o = !1;
function s() {
	o || (o = !0, e("FlowGraphGetPropertyBlock", a));
}
//#endregion
export { a as FlowGraphGetPropertyBlock, s as RegisterFlowGraphGetPropertyBlock };
