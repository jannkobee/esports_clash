import { n as e } from "./typeStore-pENEWnX2.js";
import { t } from "./flowGraphExecutionBlock-CX4ysaWA.js";
import { c as n, s as r } from "./utils-Cc6lHVNn.js";
import { n as i } from "./flowGraphRichTypes.pure-BpKU4EZT.js";
//#region node_modules/@babylonjs/core/FlowGraph/Blocks/Execution/ControlFlow/flowGraphSwitchBlock.pure.js
var a = class extends t {
	constructor(e) {
		super(e), this.config = e, this.default = this._registerSignalOutput("default"), this._caseToOutputFlow = /* @__PURE__ */ new Map(), this.case = this.registerDataInput("case", i);
		let t = this.config.cases || [];
		for (let e of t) this._caseToOutputFlow.set(e, this._registerSignalOutput(`out_${e}`));
	}
	_execute(e, t) {
		let i = this.case.getValue(e), a;
		a = n(i) ? this._getOutputFlowForCase(r(i)) : this._getOutputFlowForCase(i), a ? a._activateSignal(e) : this.default._activateSignal(e);
	}
	addCase(e) {
		this.config.cases.includes(e) || (this.config.cases.push(e), this._caseToOutputFlow.set(e, this._registerSignalOutput(`out_${e}`)));
	}
	removeCase(e) {
		if (!this.config.cases.includes(e)) return;
		let t = this.config.cases.indexOf(e);
		this.config.cases.splice(t, 1), this._caseToOutputFlow.delete(e);
	}
	_getOutputFlowForCase(e) {
		return this._caseToOutputFlow.get(e);
	}
	getClassName() {
		return "FlowGraphSwitchBlock";
	}
	serialize(e) {
		super.serialize(e), e.cases = this.config.cases;
	}
}, o = !1;
function s() {
	o || (o = !0, e("FlowGraphSwitchBlock", a));
}
//#endregion
export { a as FlowGraphSwitchBlock, s as RegisterFlowGraphSwitchBlock };
