import { n as e } from "./typeStore-pENEWnX2.js";
import { t } from "./flowGraphExecutionBlockWithOutSignal-XngQvXka.js";
import { n } from "./flowGraphRichTypes.pure-BpKU4EZT.js";
import { t as r } from "./flowGraphAnimationHelpers-Cw0WGn23.js";
//#region node_modules/@babylonjs/core/FlowGraph/Blocks/Execution/flowGraphSetVariableBlock.pure.js
var i = class extends t {
	constructor(e) {
		if (super(e), e.variables && e.variable) throw Error("FlowGraphSetVariableBlock: variable and variables are both defined");
		if (e.variables) for (let t of e.variables) this.registerDataInput(t, n);
		else this.registerDataInput("value", n);
	}
	_execute(e, t) {
		if (this.config?.variables) {
			let t = this.config.variables, n;
			if (this.config.evaluateInputsBeforeWrite) {
				n = [];
				for (let r of t) n.push(this.getDataInput(r)?.getValue(e));
			}
			for (let r = 0; r < t.length; r++) this._saveVariable(e, t[r], n?.[r], n ? void 0 : t[r]);
		} else this._saveVariable(e, this.config?.variable, void 0, "value");
		this.out._activateSignal(e);
	}
	_saveVariable(e, t, n, i) {
		let a = e._getGlobalContextVariable("currentlyRunningAnimationGroups", []);
		for (let n of a) {
			let i = e.assetsContext.animationGroups.find((e) => e.uniqueId == n);
			if (i) {
				for (let o of i.targetedAnimations) if ((o.target === e || this.config?.cancelVariableAnimations && o.target === e.userVariables) && o.animation.targetProperty === t) {
					this.config?.cancelVariableAnimations ? (r(e, i)?._cleanupAfterExternalStop(e, i), i.stop(!0), i.dispose()) : i.stop();
					let t = a.indexOf(n);
					t > -1 && a.splice(t, 1), e._setGlobalContextVariable("currentlyRunningAnimationGroups", a);
					break;
				}
			}
		}
		e.setVariable(t, i === void 0 ? n : this.getDataInput(i)?.getValue(e));
	}
	getClassName() {
		return "FlowGraphSetVariableBlock";
	}
	serialize(e) {
		super.serialize(e), e.config.variable = this.config?.variable;
	}
}, a = !1;
function o() {
	a || (a = !0, e("FlowGraphSetVariableBlock", i));
}
//#endregion
export { i as FlowGraphSetVariableBlock, o as RegisterFlowGraphSetVariableBlock };
