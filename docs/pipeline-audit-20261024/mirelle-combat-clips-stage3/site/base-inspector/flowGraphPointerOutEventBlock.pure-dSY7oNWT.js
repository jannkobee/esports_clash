import { n as e } from "./typeStore-pENEWnX2.js";
import { a as t } from "./utils-Cc6lHVNn.js";
import { t as n } from "./flowGraphEventBlock-Dyv9PqYT.js";
import { c as r, n as i } from "./flowGraphRichTypes.pure-BpKU4EZT.js";
//#region node_modules/@babylonjs/core/FlowGraph/Blocks/Event/flowGraphPointerOutEventBlock.pure.js
var a = class extends n {
	constructor(e) {
		super(e), this.type = "PointerOut", this.pointerId = this.registerDataOutput("pointerId", r), this.targetMesh = this.registerDataInput("targetMesh", i, e?.targetMesh), this.meshOutOfPointer = this.registerDataOutput("meshOutOfPointer", i);
	}
	_executeEvent(e, n) {
		let r = this.targetMesh.getValue(e);
		return this.meshOutOfPointer.setValue(n.mesh, e), this.pointerId.setValue(n.pointerId, e), (!n.over || n.over !== r && !t(n.over, r)) && (n.mesh === r || t(n.mesh, r)) ? (this._execute(e), !this.config?.stopPropagation) : !0;
	}
	_getReferencedMesh(e) {
		return this.targetMesh.getValue(e);
	}
	_preparePendingTasks(e) {}
	_cancelPendingTasks(e) {}
	getClassName() {
		return "FlowGraphPointerOutEventBlock";
	}
}, o = !1;
function s() {
	o || (o = !0, e("FlowGraphPointerOutEventBlock", a));
}
//#endregion
export { a as FlowGraphPointerOutEventBlock, s as RegisterFlowGraphPointerOutEventBlock };
