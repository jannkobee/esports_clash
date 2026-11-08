import { n as e } from "./typeStore-pENEWnX2.js";
import { t } from "./flowGraphExecutionBlock-CX4ysaWA.js";
//#region node_modules/@babylonjs/core/FlowGraph/Blocks/Execution/ControlFlow/flowGraphSequenceBlock.pure.js
var n = class extends t {
	constructor(e) {
		super(e), this.config = e, this.executionSignals = [], this.setNumberOfOutputSignals(this.config.outputSignalCount);
	}
	_execute(e) {
		for (let t = 0; t < this.executionSignals.length; t++) this.executionSignals[t]._activateSignal(e);
	}
	setNumberOfOutputSignals(e = 1) {
		for (; this.executionSignals.length > e;) {
			let e = this.executionSignals.pop();
			e && (e.disconnectFromAll(), this._unregisterSignalOutput(e.name));
		}
		for (; this.executionSignals.length < e;) this.executionSignals.push(this._registerSignalOutput(`out_${this.executionSignals.length}`));
	}
	getClassName() {
		return "FlowGraphSequenceBlock";
	}
}, r = !1;
function i() {
	r || (r = !0, e("FlowGraphSequenceBlock", n));
}
//#endregion
export { n as FlowGraphSequenceBlock, i as RegisterFlowGraphSequenceBlock };
