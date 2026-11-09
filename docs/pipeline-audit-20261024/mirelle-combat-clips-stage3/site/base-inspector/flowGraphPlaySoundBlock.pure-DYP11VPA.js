import { n as e } from "./typeStore-pENEWnX2.js";
import { t } from "./flowGraphExecutionBlockWithOutSignal-XngQvXka.js";
import { c as n, n as r, r as i } from "./flowGraphRichTypes.pure-BpKU4EZT.js";
//#region node_modules/@babylonjs/core/FlowGraph/Blocks/Execution/Audio/flowGraphPlaySoundBlock.pure.js
var a = class extends t {
	constructor(e) {
		super(e), this.sound = this.registerDataInput("sound", r), this.volume = this.registerDataInput("volume", n, 1), this.startOffset = this.registerDataInput("startOffset", n, 0), this.loop = this.registerDataInput("loop", i, !1);
	}
	_execute(e, t) {
		let n = this.sound.getValue(e);
		if (!n) {
			this._reportError(e, "No sound provided"), this.out._activateSignal(e);
			return;
		}
		let r = this.volume.getValue(e), i = this.startOffset.getValue(e), a = this.loop.getValue(e);
		n.play({
			volume: r,
			startOffset: i,
			loop: a
		}), this.out._activateSignal(e);
	}
	getClassName() {
		return "FlowGraphPlaySoundBlock";
	}
}, o = !1;
function s() {
	o || (o = !0, e("FlowGraphPlaySoundBlock", a));
}
//#endregion
export { a as FlowGraphPlaySoundBlock, s as RegisterFlowGraphPlaySoundBlock };
