import { n as e } from "./typeStore-pENEWnX2.js";
import { t } from "./flowGraphBlock-BTSj91tT.js";
import { n, r } from "./flowGraphRichTypes.pure-BpKU4EZT.js";
//#region node_modules/@babylonjs/core/FlowGraph/Blocks/Data/flowGraphConditionalDataBlock.pure.js
var i = class extends t {
	constructor(e) {
		super(e), this.condition = this.registerDataInput("condition", r), this.onTrue = this.registerDataInput("onTrue", n), this.onFalse = this.registerDataInput("onFalse", n), this.output = this.registerDataOutput("output", n);
	}
	_updateOutputs(e) {
		let t = this.condition.getValue(e);
		this.output.setValue(t ? this.onTrue.getValue(e) : this.onFalse.getValue(e), e);
	}
	getClassName() {
		return "FlowGraphConditionalBlock";
	}
}, a = !1;
function o() {
	a || (a = !0, e("FlowGraphConditionalBlock", i));
}
//#endregion
export { i as FlowGraphConditionalDataBlock, o as RegisterFlowGraphConditionalDataBlock };
