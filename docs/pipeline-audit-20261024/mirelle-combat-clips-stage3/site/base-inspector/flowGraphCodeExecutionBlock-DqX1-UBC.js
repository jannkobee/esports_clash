import { t as e } from "./flowGraphBlock-BTSj91tT.js";
import { n as t } from "./flowGraphRichTypes.pure-BpKU4EZT.js";
//#region node_modules/@babylonjs/core/FlowGraph/Blocks/Data/Utils/flowGraphCodeExecutionBlock.js
var n = class extends e {
	constructor(e) {
		super(e), this.config = e, this.executionFunction = this.registerDataInput("function", t), this.value = this.registerDataInput("value", t), this.result = this.registerDataOutput("result", t);
	}
	_updateOutputs(e) {
		let t = this.executionFunction.getValue(e), n = this.value.getValue(e);
		t && this.result.setValue(t(n, e), e);
	}
	getClassName() {
		return "FlowGraphCodeExecutionBlock";
	}
};
//#endregion
export { n as FlowGraphCodeExecutionBlock };
