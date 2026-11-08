import { n as e } from "./typeStore-pENEWnX2.js";
import { t } from "./flowGraphExecutionBlockWithOutSignal-XngQvXka.js";
import { c as n } from "./flowGraphRichTypes.pure-BpKU4EZT.js";
//#region node_modules/@babylonjs/core/FlowGraph/Blocks/Execution/ControlFlow/flowGraphThrottleBlock.pure.js
var r = class extends t {
	constructor(e) {
		super(e), this.reset = this._registerSignalInput("reset"), this.duration = this.registerDataInput("duration", n), this.lastRemainingTime = this.registerDataOutput("lastRemainingTime", n, NaN);
	}
	_execute(e, t) {
		if (t === this.reset) {
			this.lastRemainingTime.setValue(NaN, e), e._setExecutionVariable(this, "lastRemainingTime", NaN), e._setExecutionVariable(this, "timestamp", 0);
			return;
		}
		let n = this.duration.getValue(e);
		if (n < 0 || n === 0 && !this.config?.allowZeroDuration || isNaN(n) || !isFinite(n)) return this._reportError(e, "Invalid duration in Throttle block");
		let r = e._getExecutionVariable(this, "lastRemainingTime", NaN), i = Date.now();
		if (isNaN(r)) return this.lastRemainingTime.setValue(0, e), e._setExecutionVariable(this, "lastRemainingTime", 0), e._setExecutionVariable(this, "timestamp", i), this.out._activateSignal(e);
		{
			let t = i - e._getExecutionVariable(this, "timestamp", 0), r = n * 1e3;
			if (r <= t) return this.lastRemainingTime.setValue(0, e), e._setExecutionVariable(this, "lastRemainingTime", 0), e._setExecutionVariable(this, "timestamp", i), this.out._activateSignal(e);
			{
				let n = r - t;
				this.lastRemainingTime.setValue(n / 1e3, e), e._setExecutionVariable(this, "lastRemainingTime", n);
			}
		}
	}
	getClassName() {
		return "FlowGraphThrottleBlock";
	}
}, i = !1;
function a() {
	i || (i = !0, e("FlowGraphThrottleBlock", r));
}
//#endregion
export { r as FlowGraphThrottleBlock, a as RegisterFlowGraphThrottleBlock };
