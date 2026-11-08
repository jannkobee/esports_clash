import { n as e } from "./typeStore-pENEWnX2.js";
import { t } from "./flowGraphExecutionBlockWithOutSignal-XngQvXka.js";
import { c as n, n as r } from "./flowGraphRichTypes.pure-BpKU4EZT.js";
//#region node_modules/@babylonjs/core/FlowGraph/Blocks/Execution/Audio/flowGraphSetSoundVolumeBlock.pure.js
var i = class extends t {
	constructor(e) {
		super(e), this.sound = this.registerDataInput("sound", r), this.volume = this.registerDataInput("volume", n, 1);
	}
	_execute(e, t) {
		let n = this.sound.getValue(e);
		n ? (n.volume = this.volume.getValue(e), this.out._activateSignal(e)) : (this._reportError(e, "No sound provided"), this.out._activateSignal(e));
	}
	getClassName() {
		return "FlowGraphSetSoundVolumeBlock";
	}
}, a = !1;
function o() {
	a || (a = !0, e("FlowGraphSetSoundVolumeBlock", i));
}
//#endregion
export { i as FlowGraphSetSoundVolumeBlock, o as RegisterFlowGraphSetSoundVolumeBlock };
