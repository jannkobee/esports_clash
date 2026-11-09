import { n as e } from "./typeStore-pENEWnX2.js";
import { t } from "./flowGraphExecutionBlockWithOutSignal-XngQvXka.js";
import { n } from "./flowGraphRichTypes.pure-BpKU4EZT.js";
//#region node_modules/@babylonjs/core/FlowGraph/Blocks/Execution/Audio/flowGraphPauseSoundBlock.pure.js
var r = class extends t {
	constructor(e) {
		super(e), this.sound = this.registerDataInput("sound", n);
	}
	_execute(e, t) {
		let n = this.sound.getValue(e);
		n ? (n.state === 5 ? n.resume() : (n.state === 2 || n.state === 3) && n.pause(), this.out._activateSignal(e)) : (this._reportError(e, "No sound provided"), this.out._activateSignal(e));
	}
	getClassName() {
		return "FlowGraphPauseSoundBlock";
	}
}, i = !1;
function a() {
	i || (i = !0, e("FlowGraphPauseSoundBlock", r));
}
//#endregion
export { r as FlowGraphPauseSoundBlock, a as RegisterFlowGraphPauseSoundBlock };
