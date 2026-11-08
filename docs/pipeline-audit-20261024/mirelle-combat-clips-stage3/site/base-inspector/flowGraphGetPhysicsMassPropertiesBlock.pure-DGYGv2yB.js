import { n as e } from "./typeStore-pENEWnX2.js";
import { t } from "./flowGraphBlock-BTSj91tT.js";
import { c as n, f as r, n as i } from "./flowGraphRichTypes.pure-BpKU4EZT.js";
//#region node_modules/@babylonjs/core/FlowGraph/Blocks/Data/Physics/flowGraphGetPhysicsMassPropertiesBlock.pure.js
var a = class extends t {
	constructor(e) {
		super(e), this.body = this.registerDataInput("body", i), this.mass = this.registerDataOutput("mass", n), this.centerOfMass = this.registerDataOutput("centerOfMass", r), this.inertia = this.registerDataOutput("inertia", r);
	}
	_updateOutputs(e) {
		let t = this.body.getValue(e);
		if (!t) return;
		let n = t.getMassProperties();
		n.mass !== void 0 && this.mass.setValue(n.mass, e), n.centerOfMass && this.centerOfMass.setValue(n.centerOfMass, e), n.inertia && this.inertia.setValue(n.inertia, e);
	}
	getClassName() {
		return "FlowGraphGetPhysicsMassPropertiesBlock";
	}
}, o = !1;
function s() {
	o || (o = !0, e("FlowGraphGetPhysicsMassPropertiesBlock", a));
}
//#endregion
export { a as FlowGraphGetPhysicsMassPropertiesBlock, s as RegisterFlowGraphGetPhysicsMassPropertiesBlock };
