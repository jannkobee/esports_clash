import { n as e } from "./typeStore-pENEWnX2.js";
import { t } from "./flowGraphBlock-BTSj91tT.js";
import { n } from "./flowGraphRichTypes.pure-BpKU4EZT.js";
//#region node_modules/@babylonjs/core/FlowGraph/Blocks/Data/flowGraphGetVariableBlock.pure.js
var r = class extends t {
	constructor(e) {
		super(e), this.config = e, this.value = this.registerDataOutput("value", n, e.initialValue);
	}
	_updateOutputs(e) {
		let t = this.config.variable;
		e.hasVariable(t) && this.value.setValue(e.getVariable(t), e);
	}
	serialize(e) {
		super.serialize(e), e.config.variable = this.config.variable;
	}
	getClassName() {
		return "FlowGraphGetVariableBlock";
	}
}, i = !1;
function a() {
	i || (i = !0, e("FlowGraphGetVariableBlock", r));
}
//#endregion
export { r as FlowGraphGetVariableBlock, a as RegisterFlowGraphGetVariableBlock };
