import { n as e } from "./typeStore-pENEWnX2.js";
import { t } from "./flowGraphExecutionBlockWithOutSignal-XngQvXka.js";
import { n, u as r } from "./flowGraphRichTypes.pure-BpKU4EZT.js";
import { t as i } from "./flowGraphAnimationHelpers-Cw0WGn23.js";
//#region node_modules/@babylonjs/core/FlowGraph/Blocks/Execution/flowGraphSetPropertyBlock.pure.js
var a = class extends t {
	constructor(e) {
		super(e), this.config = e, this.object = this.registerDataInput("object", n, e.target), this.value = this.registerDataInput("value", n), this.propertyName = this.registerDataInput("propertyName", r, e.propertyName), this.customSetFunction = this.registerDataInput("customSetFunction", n);
	}
	_execute(e, t) {
		try {
			let t = this.object.getValue(e), n = this.value.getValue(e), r = this.propertyName.getValue(e);
			this.config.stopOnError || this._stopRunningAnimations(e, t, r);
			let i = this.customSetFunction.getValue(e);
			i ? i(t, r, n, e) : this._setPropertyValue(t, r, n), this.config.stopOnError && this._stopRunningAnimations(e, t, r);
		} catch (t) {
			if (this._reportError(e, t), this.config.stopOnError) return;
		}
		this.out._activateSignal(e);
	}
	_stopRunningAnimations(e, t, n) {
		let r = e._getGlobalContextVariable("currentlyRunningAnimationGroups", []);
		for (let a = r.length - 1; a >= 0; a--) {
			let o = r[a], s = e.assetsContext.animationGroups.find((e) => e.uniqueId === o);
			if (s) {
				for (let a of s.targetedAnimations) if (a.target === t && a.animation.targetProperty === n) {
					i(e, s)?._cleanupAfterExternalStop(e, s), s.stop(!0), s.dispose();
					let t = r.indexOf(o);
					t !== -1 && (r.splice(t, 1), e._setGlobalContextVariable("currentlyRunningAnimationGroups", r));
					break;
				}
			}
		}
	}
	_setPropertyValue(e, t, n) {
		let r = t.split("."), i = e;
		for (let e = 0; e < r.length - 1; e++) {
			let t = r[e];
			i[t] === void 0 && (i[t] = {}), i = i[t];
		}
		i[r[r.length - 1]] = n;
	}
	getClassName() {
		return "FlowGraphSetPropertyBlock";
	}
}, o = !1;
function s() {
	o || (o = !0, e("FlowGraphSetPropertyBlock", a));
}
//#endregion
export { a as FlowGraphSetPropertyBlock, s as RegisterFlowGraphSetPropertyBlock };
