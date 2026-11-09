import { n as e } from "./typeStore-pENEWnX2.js";
import { t } from "./flowGraphExecutionBlockWithOutSignal-XngQvXka.js";
import { c as n } from "./flowGraphRichTypes.pure-BpKU4EZT.js";
//#region node_modules/@babylonjs/core/FlowGraph/Blocks/Execution/ControlFlow/flowGraphCounterBlock.pure.js
var r = class extends t {
	constructor(e) {
		super(e), this.count = this.registerDataOutput("count", n), this.reset = this._registerSignalInput("reset");
	}
	_execute(e, t) {
		if (t === this.reset) {
			e._setExecutionVariable(this, "count", 0), this.count.setValue(0, e);
			return;
		}
		let n = e._getExecutionVariable(this, "count", 0) + 1;
		e._setExecutionVariable(this, "count", n), this.count.setValue(n, e), this.out._activateSignal(e);
	}
	getClassName() {
		return "FlowGraphCallCounterBlock";
	}
}, i = !1;
function a() {
	i || (i = !0, e("FlowGraphCallCounterBlock", r));
}
//#endregion
export { r as FlowGraphCallCounterBlock, a as RegisterFlowGraphCounterBlock };
