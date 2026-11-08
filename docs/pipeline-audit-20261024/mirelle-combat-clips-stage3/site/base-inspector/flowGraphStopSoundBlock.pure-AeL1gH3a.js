import { n as e } from "./typeStore-pENEWnX2.js";
import { t } from "./flowGraphExecutionBlockWithOutSignal-XngQvXka.js";
import { n } from "./flowGraphRichTypes.pure-BpKU4EZT.js";
//#region node_modules/@babylonjs/core/FlowGraph/Blocks/Execution/Audio/flowGraphStopSoundBlock.pure.js
var r = class extends t {
	constructor(e) {
		super(e), this.sound = this.registerDataInput("sound", n);
	}
	_execute(e, t) {
		let n = this.sound.getValue(e);
		n ? (n.stop(), this.out._activateSignal(e)) : (this._reportError(e, "No sound provided"), this.out._activateSignal(e));
	}
	getClassName() {
		return "FlowGraphStopSoundBlock";
	}
}, i = !1;
function a() {
	i || (i = !0, e("FlowGraphStopSoundBlock", r));
}
//#endregion
export { r as FlowGraphStopSoundBlock, a as RegisterFlowGraphStopSoundBlock };
