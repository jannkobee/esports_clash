import { c as e, u as t } from "./math.color.pure-CPmbqLkh.js";
import { n } from "./typeStore-pENEWnX2.js";
import { t as r } from "./flowGraphBlock-BTSj91tT.js";
import { f as i, n as a } from "./flowGraphRichTypes.pure-BpKU4EZT.js";
//#region node_modules/@babylonjs/core/FlowGraph/Blocks/Data/flowGraphTransformCoordinatesSystemBlock.pure.js
var o = class extends r {
	constructor(e) {
		super(e), this.sourceSystem = this.registerDataInput("sourceSystem", a), this.destinationSystem = this.registerDataInput("destinationSystem", a), this.inputCoordinates = this.registerDataInput("inputCoordinates", i), this.outputCoordinates = this.registerDataOutput("outputCoordinates", i);
	}
	_updateOutputs(n) {
		let r = this.sourceSystem.getValue(n), i = this.destinationSystem.getValue(n), a = this.inputCoordinates.getValue(n), o = r.getWorldMatrix(), s = i.getWorldMatrix(), c = e.Matrix[0].copyFrom(s);
		c.invert();
		let l = e.Matrix[1];
		c.multiplyToRef(o, l);
		let u = this.outputCoordinates.getValue(n);
		t.TransformCoordinatesToRef(a, l, u);
	}
	getClassName() {
		return "FlowGraphTransformCoordinatesSystemBlock";
	}
}, s = !1;
function c() {
	s || (s = !0, n("FlowGraphTransformCoordinatesSystemBlock", o));
}
//#endregion
export { o as FlowGraphTransformCoordinatesSystemBlock, c as RegisterFlowGraphTransformCoordinatesSystemBlock };
