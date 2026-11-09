import { n as e } from "./typeStore-pENEWnX2.js";
import { a as t } from "./utils-Cc6lHVNn.js";
import { t as n } from "./flowGraphEventBlock-Dyv9PqYT.js";
import { c as r, n as i } from "./flowGraphRichTypes.pure-BpKU4EZT.js";
//#region node_modules/@babylonjs/core/FlowGraph/Blocks/Event/flowGraphPointerOverEventBlock.pure.js
var a = class extends n {
	constructor(e) {
		super(e), this.type = "PointerOver", this.pointerId = this.registerDataOutput("pointerId", r), this.targetMesh = this.registerDataInput("targetMesh", i, e?.targetMesh), this.meshUnderPointer = this.registerDataOutput("meshUnderPointer", i);
	}
	_executeEvent(e, n) {
		let r = this.targetMesh.getValue(e);
		this.meshUnderPointer.setValue(n.mesh, e);
		let i = n.out && (n.out === r || t(n.out, r));
		return this.pointerId.setValue(n.pointerId, e), !i && (n.mesh === r || t(n.mesh, r)) ? (this._execute(e), !this.config?.stopPropagation) : !0;
	}
	_getReferencedMesh(e) {
		return this.targetMesh.getValue(e);
	}
	_preparePendingTasks(e) {}
	_cancelPendingTasks(e) {}
	getClassName() {
		return "FlowGraphPointerOverEventBlock";
	}
}, o = !1;
function s() {
	o || (o = !0, e("FlowGraphPointerOverEventBlock", a));
}
//#endregion
export { a as FlowGraphPointerOverEventBlock, s as RegisterFlowGraphPointerOverEventBlock };
