"use strict";
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);
var app_version_exports = {};
__export(app_version_exports, {
  buildCandidates: () => buildCandidates,
  getAppStoreVersion: () => getAppStoreVersion,
  getPlayStoreVersion: () => getPlayStoreVersion,
  parsePlayStoreVersion: () => parsePlayStoreVersion,
  platformName: () => platformName
});
module.exports = __toCommonJS(app_version_exports);
var import_axios = __toESM(require("axios"));
var import_panasonic_comfort_cloud_client = require("panasonic-comfort-cloud-client");
const APP_STORE_LOOKUP_URL = "https://itunes.apple.com/lookup?id=1348640525";
const PLAY_STORE_URL = "https://play.google.com/store/apps/details?id=com.panasonic.ACCsmart&hl=en&gl=US";
const LOOKUP_TIMEOUT_MS = 1e4;
const VERSION_PATTERN = /^\d+\.\d+\.\d+$/;
function validVersion(version) {
  if (typeof version !== "string") {
    return void 0;
  }
  const trimmed = version.trim();
  return VERSION_PATTERN.test(trimmed) ? trimmed : void 0;
}
function platformName(appType) {
  return appType === import_panasonic_comfort_cloud_client.AppType.IOS ? "iOS" : "Android";
}
function parsePlayStoreVersion(html) {
  const match = /\[\[\["(\d+\.\d+\.\d+)"\]\]/.exec(html);
  return validVersion(match == null ? void 0 : match[1]);
}
async function getAppStoreVersion() {
  var _a, _b, _c;
  try {
    const response = await import_axios.default.get(APP_STORE_LOOKUP_URL, { timeout: LOOKUP_TIMEOUT_MS });
    return validVersion((_c = (_b = (_a = response.data) == null ? void 0 : _a.results) == null ? void 0 : _b[0]) == null ? void 0 : _c.version);
  } catch {
    return void 0;
  }
}
async function getPlayStoreVersion() {
  try {
    const response = await import_axios.default.get(PLAY_STORE_URL, {
      timeout: LOOKUP_TIMEOUT_MS,
      responseType: "text",
      headers: { "User-Agent": "Mozilla/5.0" }
    });
    return typeof response.data === "string" ? parsePlayStoreVersion(response.data) : void 0;
  } catch {
    return void 0;
  }
}
function buildCandidates(options) {
  var _a, _b;
  if (!options.automatic) {
    const manualVersion = (_a = options.manualVersion) == null ? void 0 : _a.trim();
    return manualVersion ? [{ version: manualVersion, appType: (_b = options.manualAppType) != null ? _b : import_panasonic_comfort_cloud_client.AppType.ANDROID }] : [{ version: void 0, appType: import_panasonic_comfort_cloud_client.AppType.ANDROID }];
  }
  const candidates = [];
  const add = (version, appType) => {
    if (!candidates.some((c) => c.version === version && c.appType === appType)) {
      candidates.push({ version, appType });
    }
  };
  const playStoreVersion = validVersion(options.playStoreVersion);
  const appStoreVersion = validVersion(options.appStoreVersion);
  if (playStoreVersion) {
    add(playStoreVersion, import_panasonic_comfort_cloud_client.AppType.ANDROID);
  }
  if (appStoreVersion) {
    add(appStoreVersion, import_panasonic_comfort_cloud_client.AppType.IOS);
  }
  add(void 0, import_panasonic_comfort_cloud_client.AppType.ANDROID);
  return candidates;
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  buildCandidates,
  getAppStoreVersion,
  getPlayStoreVersion,
  parsePlayStoreVersion,
  platformName
});
//# sourceMappingURL=app-version.js.map
