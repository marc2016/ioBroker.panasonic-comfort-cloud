"use strict";
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
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
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);
var state_definitions_exports = {};
__export(state_definitions_exports, {
  deviceStates: () => deviceStates,
  readonlyStateNames: () => readonlyStateNames
});
module.exports = __toCommonJS(state_definitions_exports);
var import_panasonic_comfort_cloud_client = require("panasonic-comfort-cloud-client");
const deviceStates = [
  {
    id: "guid",
    role: "info.address",
    write: false,
    type: "string",
    def: void 0
  },
  {
    id: "operate",
    role: "switch.power",
    write: true,
    type: "number",
    states: { 0: import_panasonic_comfort_cloud_client.Power[0], 1: import_panasonic_comfort_cloud_client.Power[1] }
  },
  {
    id: "temperatureSet",
    role: "level.temperature",
    write: true,
    type: "number"
  },
  {
    id: "insideTemperature",
    role: "level.temperature",
    write: false,
    type: "number"
  },
  {
    id: "outTemperature",
    role: "level.temperature",
    write: false,
    type: "number"
  },
  {
    id: "airSwingLR",
    role: "state",
    write: true,
    type: "number",
    states: {
      0: import_panasonic_comfort_cloud_client.AirSwingLR[0],
      1: import_panasonic_comfort_cloud_client.AirSwingLR[1],
      2: import_panasonic_comfort_cloud_client.AirSwingLR[2],
      3: import_panasonic_comfort_cloud_client.AirSwingLR[3],
      4: import_panasonic_comfort_cloud_client.AirSwingLR[4]
    }
  },
  {
    id: "airSwingUD",
    role: "state",
    write: true,
    type: "number",
    states: {
      0: import_panasonic_comfort_cloud_client.AirSwingUD[0],
      1: import_panasonic_comfort_cloud_client.AirSwingUD[1],
      2: import_panasonic_comfort_cloud_client.AirSwingUD[2],
      3: import_panasonic_comfort_cloud_client.AirSwingUD[3],
      4: import_panasonic_comfort_cloud_client.AirSwingUD[4]
    }
  },
  {
    id: "fanAutoMode",
    role: "state",
    write: true,
    type: "number",
    states: {
      0: import_panasonic_comfort_cloud_client.FanAutoMode[0],
      1: import_panasonic_comfort_cloud_client.FanAutoMode[1],
      2: import_panasonic_comfort_cloud_client.FanAutoMode[2],
      3: import_panasonic_comfort_cloud_client.FanAutoMode[3]
    }
  },
  {
    id: "ecoMode",
    role: "state",
    write: true,
    type: "number",
    states: { 0: import_panasonic_comfort_cloud_client.EcoMode[0], 1: import_panasonic_comfort_cloud_client.EcoMode[1], 2: import_panasonic_comfort_cloud_client.EcoMode[2] }
  },
  {
    id: "operationMode",
    role: "state",
    write: true,
    type: "number",
    states: {
      0: import_panasonic_comfort_cloud_client.OperationMode[0],
      1: import_panasonic_comfort_cloud_client.OperationMode[1],
      2: import_panasonic_comfort_cloud_client.OperationMode[2],
      3: import_panasonic_comfort_cloud_client.OperationMode[3],
      4: import_panasonic_comfort_cloud_client.OperationMode[4]
    }
  },
  {
    id: "fanSpeed",
    role: "state",
    write: true,
    type: "number",
    states: {
      0: import_panasonic_comfort_cloud_client.FanSpeed[0],
      1: import_panasonic_comfort_cloud_client.FanSpeed[1],
      2: import_panasonic_comfort_cloud_client.FanSpeed[2],
      3: import_panasonic_comfort_cloud_client.FanSpeed[3],
      4: import_panasonic_comfort_cloud_client.FanSpeed[4],
      5: import_panasonic_comfort_cloud_client.FanSpeed[5]
    }
  },
  {
    id: "actualNanoe",
    role: "state",
    write: true,
    type: "number",
    states: {
      0: import_panasonic_comfort_cloud_client.NanoeMode[0],
      1: import_panasonic_comfort_cloud_client.NanoeMode[1],
      2: import_panasonic_comfort_cloud_client.NanoeMode[2],
      3: import_panasonic_comfort_cloud_client.NanoeMode[3],
      4: import_panasonic_comfort_cloud_client.NanoeMode[4]
    }
  },
  {
    id: "connected",
    role: "state",
    write: false,
    read: true,
    type: "boolean",
    def: false
  }
];
const readonlyStateNames = deviceStates.filter((s) => !s.write).map((s) => s.id);
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  deviceStates,
  readonlyStateNames
});
//# sourceMappingURL=state-definitions.js.map
