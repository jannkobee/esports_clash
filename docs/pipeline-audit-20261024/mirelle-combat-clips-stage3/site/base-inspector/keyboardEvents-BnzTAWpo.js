//#region node_modules/@babylonjs/core/Events/keyboardEvents.js
var e = class {};
e.KEYDOWN = 1, e.KEYUP = 2;
var t = class {
	constructor(e, t) {
		this.type = e, this.event = t;
	}
}, n = class extends t {
	get skipOnPointerObservable() {
		return this.skipOnKeyboardObservable;
	}
	set skipOnPointerObservable(e) {
		this.skipOnKeyboardObservable = e;
	}
	constructor(e, t) {
		super(e, t), this.type = e, this.event = t, this.skipOnKeyboardObservable = !1;
	}
};
//#endregion
export { t as n, n as r, e as t };
