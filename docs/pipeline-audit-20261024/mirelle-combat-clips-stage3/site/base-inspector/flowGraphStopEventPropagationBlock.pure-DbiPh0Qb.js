import { n as e } from "./typeStore-pENEWnX2.js";
import { t } from "./flowGraphExecutionBlockWithOutSignal-XngQvXka.js";
import { r as n, u as r } from "./flowGraphRichTypes.pure-BpKU4EZT.js";
//#region node_modules/@babylonjs/core/FlowGraph/Blocks/Event/flowGraphStopEventPropagationBlock.pure.js
var i = class extends t {
	constructor(e) {
		super(e), this.event = this.registerDataInput("event", r), this.stopImmediate = this.registerDataInput("stopImmediate", n, !1);
	}
	_execute(e) {
		let t = this.event.getValue(e), n = this.stopImmediate.getValue(e);
		e.configuration.coordinator.stopEventPropagation(t, n), this.out._activateSignal(e);
	}
	getClassName() {
		return "FlowGraphStopEventPropagationBlock";
	}
}, a = !1;
function o() {
	a || (a = !0, e("FlowGraphStopEventPropagationBlock", i));
}
//#endregion
export { i as FlowGraphStopEventPropagationBlock, o as RegisterFlowGraphStopEventPropagationBlock };
