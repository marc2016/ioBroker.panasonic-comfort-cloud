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
  getHistoryStates: () => getHistoryStates,
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
    // Will be set dynamically from device info
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
function getHistoryStates() {
  const states = {};
  const modes = ["day", "month"];
  const limit = { day: 24, month: 31 };
  for (const mode of modes) {
    for (let i = 0; i <= limit[mode]; i++) {
      const index = i.toString().padStart(2, "0");
      const prefix = `history.${mode}.${index}`;
      states[`${prefix}.dataTime`] = { role: "value.time", name: "Data Time", type: "string", read: true, write: false, def: "" };
      states[`${prefix}.averageSettingTemp`] = { role: "value.temperature", name: "Average Setting Temp", type: "number", unit: "\xB0C", read: true, write: false, def: 0 };
      states[`${prefix}.averageInsideTemp`] = { role: "value.temperature", name: "Average Inside Temp", type: "number", unit: "\xB0C", read: true, write: false, def: 0 };
      states[`${prefix}.averageOutsideTemp`] = { role: "value.temperature", name: "Average Outside Temp", type: "number", unit: "\xB0C", read: true, write: false, def: 0 };
      states[`${prefix}.consumption`] = { role: "value.power.consumption", name: "Consumption", type: "number", unit: "kWh", read: true, write: false, def: 0 };
      states[`${prefix}.cost`] = { role: "value.cost", name: "Cost", type: "number", read: true, write: false, def: 0 };
      states[`${prefix}.heatConsumptionRate`] = { role: "value", name: "Heat Consumption Rate", type: "number", read: true, write: false, def: 0 };
      states[`${prefix}.coolConsumptionRate`] = { role: "value", name: "Cool Consumption Rate", type: "number", read: true, write: false, def: 0 };
    }
  }
  const currentPrefix = `history.current`;
  states[`${currentPrefix}.dataTime`] = { role: "value.time", name: "Data Time", type: "string", read: true, write: false, def: "" };
  states[`${currentPrefix}.averageSettingTemp`] = { role: "value.temperature", name: "Average Setting Temp", type: "number", unit: "\xB0C", read: true, write: false, def: 0 };
  states[`${currentPrefix}.averageInsideTemp`] = { role: "value.temperature", name: "Average Inside Temp", type: "number", unit: "\xB0C", read: true, write: false, def: 0 };
  states[`${currentPrefix}.averageOutsideTemp`] = { role: "value.temperature", name: "Average Outside Temp", type: "number", unit: "\xB0C", read: true, write: false, def: 0 };
  states[`${currentPrefix}.consumption`] = { role: "value.power.consumption", name: "Consumption", type: "number", unit: "kWh", read: true, write: false, def: 0 };
  states[`${currentPrefix}.cost`] = { role: "value.cost", name: "Cost", type: "number", read: true, write: false, def: 0 };
  states[`${currentPrefix}.heatConsumptionRate`] = { role: "value", name: "Heat Consumption Rate", type: "number", read: true, write: false, def: 0 };
  states[`${currentPrefix}.coolConsumptionRate`] = { role: "value", name: "Cool Consumption Rate", type: "number", read: true, write: false, def: 0 };
  return states;
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  deviceStates,
  getHistoryStates,
  readonlyStateNames
});
//# sourceMappingURL=state-definitions.js.map
