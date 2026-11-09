//#region node_modules/@babylonjs/loaders/glTF/2.0/Extensions/KHR_interactivity/interactivityReferences.js
var e = "/extensions/KHR_interactivity/events/", t = "/extensions/KHR_interactivity/delays/";
function n(t) {
	return e + t;
}
function r(e) {
	return i(e) ? e.substring(37) : void 0;
}
function i(e) {
	return typeof e == "string" && e.startsWith("/extensions/KHR_interactivity/events/");
}
//#endregion
export { r as i, e as n, n as r, t };
