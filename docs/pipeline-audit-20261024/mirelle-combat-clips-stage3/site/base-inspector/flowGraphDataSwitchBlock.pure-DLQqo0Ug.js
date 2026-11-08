import { n as e } from "./typeStore-pENEWnX2.js";
import { t } from "./flowGraphBlock-BTSj91tT.js";
import { c as n, s as r } from "./utils-Cc6lHVNn.js";
import { n as i } from "./flowGraphRichTypes.pure-BpKU4EZT.js";
//#region node_modules/@babylonjs/core/FlowGraph/Blocks/Data/flowGraphDataSwitchBlock.pure.js
var a = class extends t {
	constructor(e) {
		super(e), this.config = e, this._inputCases = /* @__PURE__ */ new Map(), this.case = this.registerDataInput("case", i, NaN), this.default = this.registerDataInput("default", i), this.value = this.registerDataOutput("value", i);
		let t = this.config.cases || [];
		for (let e of t) {
			if (e = r(e), this.config.treatCasesAsIntegers && (e |= 0, this._inputCases.has(e))) return;
			this._inputCases.set(e, this.registerDataInput(`in_${e}`, i));
		}
	}
	_updateOutputs(e) {
		let t = this.case.getValue(e), i;
		n(t) && (i = this._getOutputValueForCase(r(t), e)), i ||= this.default.getValue(e), this.value.setValue(i, e);
	}
	_getOutputValueForCase(e, t) {
		return this._inputCases.get(e)?.getValue(t);
	}
	getClassName() {
		return "FlowGraphDataSwitchBlock";
	}
}, o = !1;
function s() {
	o || (o = !0, e("FlowGraphDataSwitchBlock", a));
}
//#endregion
export { a as FlowGraphDataSwitchBlock, s as RegisterFlowGraphDataSwitchBlock };
