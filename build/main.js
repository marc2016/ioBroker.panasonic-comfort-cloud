"use strict";
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));
var utils = __toESM(require("@iobroker/adapter-core"));
var import_panasonic_comfort_cloud_client = require("panasonic-comfort-cloud-client");
var _ = __toESM(require("lodash"));
var import_axios = __toESM(require("axios"));
const REFRESH_INTERVAL_IN_MINUTES_DEFAULT = 5;
class PanasonicComfortCloud extends utils.Adapter {
  constructor(options = {}) {
    super({
      ...options,
      name: "panasonic-comfort-cloud"
    });
    this.comfortCloudClient = new import_panasonic_comfort_cloud_client.ComfortCloudClient();
    this.refreshIntervalInMinutes = REFRESH_INTERVAL_IN_MINUTES_DEFAULT;
    this.readonlyStateNames = [];
    this.on("ready", this.onReady.bind(this));
    this.on("objectChange", this.onObjectChange.bind(this));
    this.on("stateChange", this.onStateChange.bind(this));
    this.on("unload", this.onUnload.bind(this));
  }
  async onReady() {
    var _a, _b, _c, _d, _e, _f, _g, _h, _i, _j, _k, _l, _m, _n, _o;
    this.refreshIntervalInMinutes = (_b = (_a = this.config) == null ? void 0 : _a.refreshInterval) != null ? _b : REFRESH_INTERVAL_IN_MINUTES_DEFAULT;
    this.subscribeStates("*");
    this.setState("info.connection", false, true);
    const loadedAppVersion = await this.getCurrentAppVersion();
    this.log.info(`Loaded app version from GitHub: ${loadedAppVersion}`);
    if (loadedAppVersion && this.trimAll((_c = this.config) == null ? void 0 : _c.appVersionFromGithub) != this.trimAll(loadedAppVersion)) {
      this.updateConfig({ appVersionFromGithub: this.trimAll(loadedAppVersion), password: this.encrypt((_d = this.config) == null ? void 0 : _d.password) });
      return;
    }
    if (!((_e = this.config) == null ? void 0 : _e.username) || !((_f = this.config) == null ? void 0 : _f.password)) {
      this.log.error("Can not start without username or password. Please open config.");
    } else {
      if (((_g = this.config) == null ? void 0 : _g.appVersionFromGithub) != "" && ((_h = this.config) == null ? void 0 : _h.useAppVersionFromGithub)) {
        this.log.debug(`Use AppVersion from Github ${(_i = this.config) == null ? void 0 : _i.appVersionFromGithub}.`);
        this.comfortCloudClient = new import_panasonic_comfort_cloud_client.ComfortCloudClient((_j = this.config) == null ? void 0 : _j.appVersionFromGithub);
      } else if (((_k = this.config) == null ? void 0 : _k.appVersion) != "") {
        this.log.debug(`Use configured AppVersion ${(_l = this.config) == null ? void 0 : _l.appVersion}.`);
        this.comfortCloudClient = new import_panasonic_comfort_cloud_client.ComfortCloudClient((_m = this.config) == null ? void 0 : _m.appVersion);
      } else {
        this.log.debug(`Use default AppVersion.`);
        this.comfortCloudClient = new import_panasonic_comfort_cloud_client.ComfortCloudClient();
      }
      try {
        this.log.debug(`Try to login with username ${this.config.username}.`);
        await this.comfortCloudClient.login(
          this.config.username,
          this.config.password
        );
        this.log.info("Login successful.");
        this.setState("info.connection", true, true);
        this.log.debug("Create devices.");
        const groups = await this.comfortCloudClient.getGroups();
        await this.createDevices(groups);
        this.log.debug(`Automativ refresh is set to ${(_n = this.config) == null ? void 0 : _n.automaticRefreshEnabled}.`);
        if ((_o = this.config) == null ? void 0 : _o.automaticRefreshEnabled) {
          this.setupRefreshTimeout();
        }
      } catch (error) {
        await this.handleClientError(error);
      }
    }
  }
  async refreshDeviceStates(device) {
    this.log.debug(`Refresh device ${device.name} (${device.guid}).`);
    this.log.debug(`${device.name}: guid => ${device.guid}.`);
    this.log.debug(`${device.name}: operate => ${device.operate}.`);
    await this.setStateChangedAsync(
      `${device.name}.operate`,
      device.operate,
      true
    );
    this.log.debug(`${device.name}: temperatureSet => ${device.temperatureSet}.`);
    await this.setStateChangedAsync(
      `${device.name}.temperatureSet`,
      device.temperatureSet,
      true
    );
    this.log.debug(`${device.name}: insideTemperature => ${device.insideTemperature}.`);
    await this.setStateChangedAsync(
      `${device.name}.insideTemperature`,
      device.insideTemperature,
      true
    );
    this.log.debug(`${device.name}: outTemperature => ${device.outTemperature}.`);
    await this.setStateChangedAsync(
      `${device.name}.outTemperature`,
      device.outTemperature,
      true
    );
    this.log.debug(`${device.name}: airSwingLR => ${device.airSwingLR}.`);
    await this.setStateChangedAsync(
      `${device.name}.airSwingLR`,
      device.airSwingLR,
      true
    );
    this.log.debug(`${device.name}: airSwingUD => ${device.airSwingUD}.`);
    await this.setStateChangedAsync(
      `${device.name}.airSwingUD`,
      device.airSwingUD,
      true
    );
    this.log.debug(`${device.name}: fanAutoMode => ${device.fanAutoMode}.`);
    await this.setStateChangedAsync(
      `${device.name}.fanAutoMode`,
      device.fanAutoMode,
      true
    );
    this.log.debug(`${device.name}: ecoMode => ${device.ecoMode}.`);
    await this.setStateChangedAsync(
      `${device.name}.ecoMode`,
      device.ecoMode,
      true
    );
    this.log.debug(`${device.name}: operationMode => ${device.operationMode}.`);
    await this.setStateChangedAsync(
      `${device.name}.operationMode`,
      device.operationMode,
      true
    );
    this.log.debug(`${device.name}: fanSpeed => ${device.fanSpeed}.`);
    await this.setStateChangedAsync(
      `${device.name}.fanSpeed`,
      device.fanSpeed,
      true
    );
    this.log.debug(`${device.name}: actualNanoe => ${device.actualNanoe}.`);
    await this.setStateChangedAsync(
      `${device.name}.actualNanoe`,
      device.actualNanoe,
      true
    );
    await this.setStateChangedAsync(
      `${device.name}.connected`,
      true,
      true
    );
    this.log.debug(`Refresh device ${device.name} finished.`);
  }
  async refreshDevice(guid, deviceName) {
    try {
      const device = await this.comfortCloudClient.getDevice(guid, deviceName);
      if (!device) {
        return;
      }
      if (!device.name) {
        device.name = deviceName;
      }
      await this.refreshDeviceStates(device);
    } catch (error) {
      await this.handleDeviceError(deviceName, error);
    }
  }
  async refreshDevices() {
    try {
      this.log.debug("Refresh all devices.");
      const groups = await this.comfortCloudClient.getGroups();
      this.setState("info.connection", true, true);
      const devices = _.flatMap(groups, (g) => g.devices);
      const deviceInfos = _.map(devices, (d) => {
        return { guid: d.guid, name: d.name };
      });
      await Promise.all(deviceInfos.map(async (deviceInfo) => {
        try {
          const device = await this.comfortCloudClient.getDevice(deviceInfo.guid, deviceInfo.name);
          if (device != null) {
            device.name = deviceInfo.name;
            device.guid = deviceInfo.guid;
            await this.refreshDeviceStates(device);
          }
        } catch (error) {
          await this.handleDeviceError(deviceInfo.name, error);
        }
      }));
    } catch (error) {
      await this.handleClientError(error);
    }
  }
  async createDevices(groups) {
    const devicesFromService = _.flatMap(groups, (g) => g.devices);
    const deviceInfos = _.map(devicesFromService, (d) => {
      return { guid: d.guid, name: d.name };
    });
    await Promise.all(deviceInfos.map(async (deviceInfo) => {
      this.log.debug(`Device info from group ${deviceInfo.guid}, ${deviceInfo.name}.`);
      let device = null;
      try {
        device = await this.comfortCloudClient.getDevice(deviceInfo.guid, deviceInfo.name);
      } catch (error) {
        await this.handleDeviceError(deviceInfo.name, error);
        return;
      }
      if (device != null) {
        this.createDevice(deviceInfo.name);
        this.createState(
          deviceInfo.name,
          "",
          "guid",
          { role: "info.address", write: false, def: deviceInfo.guid, type: "string" },
          void 0
        );
        this.readonlyStateNames.push("guid");
        this.createState(
          deviceInfo.name,
          "",
          "operate",
          {
            role: "switch.power",
            states: { 0: import_panasonic_comfort_cloud_client.Power[0], 1: import_panasonic_comfort_cloud_client.Power[1] },
            write: true,
            def: device.operate,
            type: "number"
          },
          void 0
        );
        this.createState(
          deviceInfo.name,
          "",
          "temperatureSet",
          {
            role: "level.temperature",
            write: true,
            def: device.temperatureSet,
            type: "number"
          },
          void 0
        );
        this.createState(
          deviceInfo.name,
          "",
          "insideTemperature",
          {
            role: "level.temperature",
            write: false,
            def: device.insideTemperature,
            type: "number"
          },
          void 0
        );
        this.readonlyStateNames.push("insideTemperature");
        this.createState(
          deviceInfo.name,
          "",
          "outTemperature",
          {
            role: "level.temperature",
            write: false,
            def: device.outTemperature,
            type: "number"
          },
          void 0
        );
        this.readonlyStateNames.push("outTemperature");
        this.createState(
          deviceInfo.name,
          "",
          "airSwingLR",
          {
            role: "state",
            states: {
              0: import_panasonic_comfort_cloud_client.AirSwingLR[0],
              1: import_panasonic_comfort_cloud_client.AirSwingLR[1],
              2: import_panasonic_comfort_cloud_client.AirSwingLR[2],
              3: import_panasonic_comfort_cloud_client.AirSwingLR[3],
              4: import_panasonic_comfort_cloud_client.AirSwingLR[4]
            },
            write: true,
            def: device.airSwingLR,
            type: "number"
          },
          void 0
        );
        this.createState(
          deviceInfo.name,
          "",
          "airSwingUD",
          {
            role: "state",
            states: {
              0: import_panasonic_comfort_cloud_client.AirSwingUD[0],
              1: import_panasonic_comfort_cloud_client.AirSwingUD[1],
              2: import_panasonic_comfort_cloud_client.AirSwingUD[2],
              3: import_panasonic_comfort_cloud_client.AirSwingUD[3],
              4: import_panasonic_comfort_cloud_client.AirSwingUD[4]
            },
            write: true,
            def: device.airSwingUD,
            type: "number"
          },
          void 0
        );
        this.createState(
          deviceInfo.name,
          "",
          "fanAutoMode",
          {
            role: "state",
            states: {
              0: import_panasonic_comfort_cloud_client.FanAutoMode[0],
              1: import_panasonic_comfort_cloud_client.FanAutoMode[1],
              2: import_panasonic_comfort_cloud_client.FanAutoMode[2],
              3: import_panasonic_comfort_cloud_client.FanAutoMode[3]
            },
            write: true,
            def: device.fanAutoMode,
            type: "number"
          },
          void 0
        );
        this.createState(
          deviceInfo.name,
          "",
          "ecoMode",
          {
            role: "state",
            states: { 0: import_panasonic_comfort_cloud_client.EcoMode[0], 1: import_panasonic_comfort_cloud_client.EcoMode[1], 2: import_panasonic_comfort_cloud_client.EcoMode[2] },
            write: true,
            def: device.ecoMode,
            type: "number"
          },
          void 0
        );
        this.createState(
          deviceInfo.name,
          "",
          "operationMode",
          {
            role: "state",
            states: {
              0: import_panasonic_comfort_cloud_client.OperationMode[0],
              1: import_panasonic_comfort_cloud_client.OperationMode[1],
              2: import_panasonic_comfort_cloud_client.OperationMode[2],
              3: import_panasonic_comfort_cloud_client.OperationMode[3],
              4: import_panasonic_comfort_cloud_client.OperationMode[4]
            },
            write: true,
            def: device.operationMode,
            type: "number"
          },
          void 0
        );
        this.createState(
          deviceInfo.name,
          "",
          "fanSpeed",
          {
            role: "state",
            states: {
              0: import_panasonic_comfort_cloud_client.FanSpeed[0],
              1: import_panasonic_comfort_cloud_client.FanSpeed[1],
              2: import_panasonic_comfort_cloud_client.FanSpeed[2],
              3: import_panasonic_comfort_cloud_client.FanSpeed[3],
              4: import_panasonic_comfort_cloud_client.FanSpeed[4],
              5: import_panasonic_comfort_cloud_client.FanSpeed[5]
            },
            write: true,
            def: device.fanSpeed,
            type: "number"
          },
          void 0
        );
        this.createState(
          deviceInfo.name,
          "",
          "actualNanoe",
          {
            role: "state",
            states: {
              0: import_panasonic_comfort_cloud_client.NanoeMode[0],
              1: import_panasonic_comfort_cloud_client.NanoeMode[1],
              2: import_panasonic_comfort_cloud_client.NanoeMode[2],
              3: import_panasonic_comfort_cloud_client.NanoeMode[3],
              4: import_panasonic_comfort_cloud_client.NanoeMode[4]
            },
            write: true,
            def: device.actualNanoe,
            type: "number"
          },
          void 0
        );
        this.createState(
          deviceInfo.name,
          "",
          "connected",
          { role: "state", read: true, write: false, def: false, type: "boolean" },
          void 0
        );
        this.log.info(`Device ${deviceInfo.name} created.`);
      }
    }));
    this.log.debug("Device creation completed.");
  }
  async updateDevice(deviceName, stateName, state) {
    if (this.readonlyStateNames.includes(stateName)) {
      return;
    }
    if (!state.ack) {
      const stateObj = await this.getObjectAsync(`${deviceName}.${stateName}`);
      const stateCommon = stateObj == null ? void 0 : stateObj.common;
      if ((stateCommon == null ? void 0 : stateCommon.write) == false) {
        return;
      }
      const guidState = await this.getStateAsync(`${deviceName}.guid`);
      this.log.debug(
        `Update device guid=${guidState == null ? void 0 : guidState.val} state=${stateName}`
      );
      const parameters = {};
      parameters[stateName] = state.val;
      if (!(guidState == null ? void 0 : guidState.val)) {
        return;
      }
      try {
        this.log.debug(`Set device parameter ${JSON.stringify(parameters)} for device ${guidState == null ? void 0 : guidState.val}`);
        await this.comfortCloudClient.setParameters(
          guidState == null ? void 0 : guidState.val,
          parameters
        );
        this.log.debug(`Refresh device ${deviceName}`);
        await this.refreshDevice(guidState == null ? void 0 : guidState.val, deviceName);
      } catch (error) {
        await this.handleClientError(error);
      }
    }
  }
  onUnload(callback) {
    try {
      if (this.refreshTimeout)
        clearTimeout(this.refreshTimeout);
      this.log.info("cleaned everything up...");
      callback();
    } catch (e) {
      callback();
    }
  }
  onObjectChange(id, obj) {
    if (obj) {
      this.log.info(`object ${id} changed: ${JSON.stringify(obj)}`);
    } else {
      this.log.info(`object ${id} deleted`);
    }
  }
  async onStateChange(id, state) {
    if (!state || state.ack) {
      return;
    }
    if (id.includes(".commands.")) {
      const elements = id.split(".");
      const stateName = elements[elements.length - 1];
      if (stateName == "manualRefresh" && state.val) {
        try {
          await this.refreshDevices();
          await this.setStateAsync(id, state, true);
        } catch (error) {
          await this.handleClientError(error);
        }
        await this.setStateAsync(id, false, true);
      }
    } else if (!id.includes(".info.")) {
      const elements = id.split(".");
      const deviceName = elements[elements.length - 2];
      const stateName = elements[elements.length - 1];
      try {
        await this.updateDevice(deviceName, stateName, state);
      } catch (error) {
        await this.handleClientError(error);
      }
      this.log.info(
        `state ${id} changed: ${state.val} (ack = ${state.ack})`
      );
    }
  }
  async getCurrentAppVersion() {
    const response = await import_axios.default.get("https://raw.githubusercontent.com/marc2016/ioBroker.panasonic-comfort-cloud/master/.currentAppVersion");
    if (response.status !== 200)
      return "";
    const text = await response.data;
    return text;
  }
  async handleDeviceError(deviceName, error) {
    this.log.debug(`Try to handle device error for ${deviceName}.`);
    await this.setStateChangedAsync(
      `${deviceName}.connected`,
      false,
      true
    );
    if (error instanceof import_panasonic_comfort_cloud_client.ServiceError) {
      this.log.error(
        `Service error when connecting to device ${deviceName}: ${error.message}. Code=${error.code}. Stack: ${error.stack}`
      );
    } else if (error instanceof Error) {
      this.log.error(`Unknown error when connecting to device ${deviceName}: ${error}. Stack: ${error.stack}`);
    }
  }
  async handleClientError(error) {
    this.log.debug("Try to handle error.");
    if (error instanceof import_panasonic_comfort_cloud_client.TokenExpiredError) {
      this.log.info(
        `Token of comfort cloud client expired. Trying to login again. Code=${error.code}. Stack: ${error.stack}`
      );
      this.setState("info.connection", false, true);
      await this.comfortCloudClient.login(
        this.config.username,
        this.config.password
      );
      this.setState("info.connection", true, true);
      this.log.info("Login successful.");
    } else if (error instanceof import_panasonic_comfort_cloud_client.ServiceError) {
      this.setState("info.connection", false, true);
      this.log.error(
        `Service error: ${error.message}. Code=${error.code}. Stack: ${error.stack}`
      );
    } else if (error instanceof Error) {
      this.log.error(`Unknown error: ${error}. Stack: ${error.stack}`);
    }
  }
  setupRefreshTimeout() {
    this.log.debug("setupRefreshTimeout");
    const refreshIntervalInMilliseconds = this.refreshIntervalInMinutes * 60 * 1e3;
    this.log.debug(`refreshIntervalInMilliseconds=${refreshIntervalInMilliseconds}`);
    this.refreshTimeout = setTimeout(this.refreshTimeoutFunc.bind(this), refreshIntervalInMilliseconds);
  }
  async refreshTimeoutFunc() {
    this.log.debug(`refreshTimeoutFunc started.`);
    try {
      await this.refreshDevices();
      this.setupRefreshTimeout();
    } catch (error) {
      await this.handleClientError(error);
    }
  }
  trimAll(text) {
    const newText = text.trim().replace(/(\r\n|\n|\r)/gm, "");
    return newText;
  }
}
if (module.parent) {
  module.exports = (options) => new PanasonicComfortCloud(options);
} else {
  (() => new PanasonicComfortCloud())();
}
//# sourceMappingURL=main.js.map
