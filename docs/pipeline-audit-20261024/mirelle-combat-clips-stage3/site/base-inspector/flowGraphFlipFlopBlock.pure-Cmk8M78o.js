import { n as e } from "./typeStore-pENEWnX2.js";
import { t } from "./flowGraphExecutionBlock-CX4ysaWA.js";
import { r as n } from "./flowGraphRichTypes.pure-BpKU4EZT.js";
//#region node_modules/@babylonjs/core/FlowGraph/Blocks/Execution/ControlFlow/flowGraphFlipFlopBlock.pure.js
var r = class extends t {
	constructor(e) {
		super(e), this.onOn = this._registerSignalOutput("onOn"), this.onOff = this._registerSignalOutput("onOff"), this.value = this.registerDataOutput("value", n);
	}
	_execute(e, t) {
		let n = e._getExecutionVariable(this, "value", typeof this.config?.startValue == "boolean" && !this.config.startValue);
		n = !n, e._setExecutionVariable(this, "value", n), this.value.setValue(n, e), n ? this.onOn._activateSignal(e) : this.onOff._activateSignal(e);
	}
	getClassName() {
		return "FlowGraphFlipFlopBlock";
	}
}, i = !1;
function a() {
	i || (i = !0, e("FlowGraphFlipFlopBlock", r));
}
//#endregion
export { r as FlowGraphFlipFlopBlock, a as RegisterFlowGraphFlipFlopBlock };
