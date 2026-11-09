import { t as e } from "./logger-DQIzSR_y.js";
import { n as t } from "./typeStore-pENEWnX2.js";
import { t as n } from "./flowGraphInteger.pure-DqL1vt3x.js";
import { t as r } from "./flowGraphExecutionBlockWithOutSignal-XngQvXka.js";
import { s as i } from "./utils-Cc6lHVNn.js";
import { c as a, i as o, n as s } from "./flowGraphRichTypes.pure-BpKU4EZT.js";
//#region node_modules/@babylonjs/core/FlowGraph/Blocks/Execution/ControlFlow/flowGraphForLoopBlock.pure.js
var c = class t extends r {
	constructor(e) {
		super(e), this.startIndex = this.registerDataInput("startIndex", s, 0), this.endIndex = this.registerDataInput("endIndex", s), this.step = this.registerDataInput("step", a, 1), this.index = this.registerDataOutput("index", o, new n(i(e?.initialIndex ?? 0))), this.executionFlow = this._registerSignalOutput("executionFlow"), this.completed = this._registerSignalOutput("completed"), this._unregisterSignalOutput("out");
	}
	_execute(r) {
		let a = i(this.startIndex.getValue(r)), o = this.step.getValue(r), s = i(this.endIndex.getValue(r)), c = this.config?.maxLoopIterations ?? t.MaxLoopIterations, l = 0, u = !1;
		this.config?.incrementIndexWhenLoopDone && !(a < s) && this.index.setValue(new n(a), r);
		for (let e = a; e < s; e += o) if (this.index.setValue(new n(e), r), this.executionFlow._activateSignal(r), s = i(this.endIndex.getValue(r)), ++l >= c) {
			u = !0;
			break;
		}
		u && e.Warn(`FlowGraphForLoopBlock: loop stopped after reaching the ${c}-iteration safety cap before its range completed.`), this.config?.incrementIndexWhenLoopDone && l > 0 && this.index.setValue(new n(i(this.index.getValue(r)) + o), r), this.completed._activateSignal(r);
	}
	getClassName() {
		return "FlowGraphForLoopBlock";
	}
};
c.MaxLoopIterations = 1e3;
var l = !1;
function u() {
	l || (l = !0, t("FlowGraphForLoopBlock", c));
}
//#endregion
export { c as FlowGraphForLoopBlock, u as RegisterFlowGraphForLoopBlock };
