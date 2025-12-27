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
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));
var utils = __toESM(require("@iobroker/adapter-core"));
var import_panasonic_comfort_cloud_client = require("panasonic-comfort-cloud-client");
var import_axios = __toESM(require("axios"));
var import_state_definitions = require("./lib/state-definitions");
const REFRESH_INTERVAL_IN_MINUTES_DEFAULT = 5;
class PanasonicComfortCloud extends utils.Adapter {
  comfortCloudClient = new import_panasonic_comfort_cloud_client.ComfortCloudClient();
  refreshTimeout;
  refreshHistoryTimeout;
  refreshIntervalInMinutes = REFRESH_INTERVAL_IN_MINUTES_DEFAULT;
  historyRefreshIntervalInMinutes = 60;
  constructor(options = {}) {
    super({
      ...options,
      name: "panasonic-comfort-cloud"
    });
    this.on("ready", this.onReady.bind(this));
    this.on("objectChange", this.onObjectChange.bind(this));
    this.on("stateChange", this.onStateChange.bind(this));
    this.on("unload", this.onUnload.bind(this));
  }
  /**
   * Is called when databases are connected and adapter received configuration.
   */
  async onReady() {
    var _a, _b, _c, _d, _e, _f, _g, _h, _i, _j, _k, _l, _m, _n, _o, _p;
    this.refreshIntervalInMinutes = (_b = (_a = this.config) == null ? void 0 : _a.refreshInterval) != null ? _b : REFRESH_INTERVAL_IN_MINUTES_DEFAULT;
    this.subscribeStates("*");
    await this.setStateAsync("info.connection", false, true);
    const loadedAppVersion = await this.getCurrentAppVersion();
    this.log.info(`Loaded app version from App store: ${loadedAppVersion}`);
    if (loadedAppVersion && this.trimAll((_c = this.config) == null ? void 0 : _c.appVersionFromAppStore) != this.trimAll(loadedAppVersion)) {
      this.updateConfig({ appVersionFromAppStore: this.trimAll(loadedAppVersion), password: this.encrypt((_d = this.config) == null ? void 0 : _d.password) });
      return;
    }
    if (!((_e = this.config) == null ? void 0 : _e.username) || !((_f = this.config) == null ? void 0 : _f.password)) {
      this.log.error("Can not start without username or password. Please open config.");
    } else {
      if (((_g = this.config) == null ? void 0 : _g.appVersionFromAppStore) != "" && ((_h = this.config) == null ? void 0 : _h.useAppVersionFromAppStore)) {
        this.log.debug(`Use AppVersion from App Store ${(_i = this.config) == null ? void 0 : _i.appVersionFromAppStore}.`);
        this.comfortCloudClient = new import_panasonic_comfort_cloud_client.ComfortCloudClient((_j = this.config) == null ? void 0 : _j.appVersionFromAppStore);
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
        await this.setStateAsync("info.connection", true, true);
        this.log.debug("Create devices.");
        const groups = await this.comfortCloudClient.getGroups();
        await this.createDevices(groups);
        this.log.debug(`Automativ refresh is set to ${(_n = this.config) == null ? void 0 : _n.automaticRefreshEnabled}.`);
        if ((_o = this.config) == null ? void 0 : _o.automaticRefreshEnabled) {
          this.setupRefreshTimeout();
        }
        if ((_p = this.config) == null ? void 0 : _p.historyEnabled) {
          this.log.debug(`History enabled. Refreshing history.`);
          await this.refreshHistory(groups);
          this.setupHistoryRefreshTimeout();
        }
      } catch (error) {
        await this.handleClientError(error);
      }
    }
  }
  async refreshHistory(groups) {
    const devicesFromService = groups.flatMap((g) => g.devices);
    const deviceInfos = devicesFromService.map((d) => {
      return { guid: d.guid, name: d.name };
    });
    for (const deviceInfo of deviceInfos) {
      const modes = {
        "day": import_panasonic_comfort_cloud_client.DataMode.Day,
        "month": import_panasonic_comfort_cloud_client.DataMode.Month
      };
      for (const [modeName, dataMode] of Object.entries(modes)) {
        try {
          this.log.debug(`Fetching ${modeName} history for ${deviceInfo.name}`);
          const history = await this.comfortCloudClient.getDeviceHistoryData(deviceInfo.guid, /* @__PURE__ */ new Date(), dataMode);
          if (history && history.historyDataList) {
            for (let i = 0; i < history.historyDataList.length; i++) {
              const data = history.historyDataList[i];
              const index = i.toString().padStart(2, "0");
              const prefix = `${deviceInfo.name}.history.${modeName}.${index}`;
              await this.setStateChangedAsync(`${prefix}.dataTime`, this.formatHistoryDate(data.dataTime), true);
              await this.setStateChangedAsync(`${prefix}.averageSettingTemp`, data.averageSettingTemp, true);
              await this.setStateChangedAsync(`${prefix}.averageInsideTemp`, data.averageInsideTemp, true);
              await this.setStateChangedAsync(`${prefix}.averageOutsideTemp`, data.averageOutsideTemp, true);
              await this.setStateChangedAsync(`${prefix}.consumption`, data.consumption, true);
              await this.setStateChangedAsync(`${prefix}.cost`, data.cost, true);
              await this.setStateChangedAsync(`${prefix}.heatConsumptionRate`, data.heatConsumptionRate, true);
              await this.setStateChangedAsync(`${prefix}.coolConsumptionRate`, data.coolConsumptionRate, true);
              if (modeName === "day" && i === (/* @__PURE__ */ new Date()).getHours()) {
                const currentPrefix = `${deviceInfo.name}.history.current`;
                await this.setStateChangedAsync(`${currentPrefix}.dataTime`, this.formatHistoryDate(data.dataTime), true);
                await this.setStateChangedAsync(`${currentPrefix}.averageSettingTemp`, data.averageSettingTemp, true);
                await this.setStateChangedAsync(`${currentPrefix}.averageInsideTemp`, data.averageInsideTemp, true);
                await this.setStateChangedAsync(`${currentPrefix}.averageOutsideTemp`, data.averageOutsideTemp, true);
                await this.setStateChangedAsync(`${currentPrefix}.consumption`, data.consumption, true);
                await this.setStateChangedAsync(`${currentPrefix}.cost`, data.cost, true);
                await this.setStateChangedAsync(`${currentPrefix}.heatConsumptionRate`, data.heatConsumptionRate, true);
                await this.setStateChangedAsync(`${currentPrefix}.coolConsumptionRate`, data.coolConsumptionRate, true);
              }
            }
          }
        } catch (e) {
          this.log.warn(`Failed to fetch history ${modeName} for ${deviceInfo.name}: ${e}`);
        }
      }
    }
  }
  formatHistoryDate(dataTime) {
    if (dataTime.length === 10) {
      const year = dataTime.substring(0, 4);
      const month = dataTime.substring(4, 6);
      const day = dataTime.substring(6, 8);
      const hour = dataTime.substring(8, 10);
      return `${year}-${month}-${day} ${hour}:00:00`;
    } else if (dataTime.length === 8) {
      const year = dataTime.substring(0, 4);
      const month = dataTime.substring(4, 6);
      const day = dataTime.substring(6, 8);
      return `${year}-${month}-${day}`;
    }
    return dataTime;
  }
  async refreshDeviceStates(device) {
    this.log.debug(`Refresh device ${device.name} (${device.guid}).`);
    this.log.debug(`${device.name}: guid => ${device.guid}.`);
    for (const stateDef of import_state_definitions.deviceStates) {
      if (stateDef.id === "guid") continue;
      const value = device[stateDef.id];
      this.log.debug(`${device.name}: ${stateDef.id} => ${value}.`);
      if (value !== void 0) {
        await this.setStateChangedAsync(
          `${device.name}.${stateDef.id}`,
          value,
          true
        );
      } else if (stateDef.id === "connected") {
        await this.setStateChangedAsync(
          `${device.name}.connected`,
          true,
          true
        );
      }
    }
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
      await this.setStateAsync("info.connection", true, true);
      const devices = groups.flatMap((g) => g.devices);
      const deviceInfos = devices.map((d) => {
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
    const devicesFromService = groups.flatMap((g) => g.devices);
    const deviceInfos = devicesFromService.map((d) => {
      return { guid: d.guid, name: d.name };
    });
    await Promise.all(deviceInfos.map(async (deviceInfo) => {
      var _a;
      this.log.debug(`Device info from group ${deviceInfo.guid}, ${deviceInfo.name}.`);
      let device = null;
      try {
        device = await this.comfortCloudClient.getDevice(deviceInfo.guid, deviceInfo.name);
      } catch (error) {
        await this.handleDeviceError(deviceInfo.name, error);
        return;
      }
      if (device != null) {
        await this.setObjectNotExistsAsync(deviceInfo.name, {
          type: "device",
          common: {
            name: deviceInfo.name
          },
          native: {}
        });
        for (const stateDef of import_state_definitions.deviceStates) {
          const common = {
            name: stateDef.id,
            role: stateDef.role,
            write: stateDef.write,
            type: stateDef.type,
            read: stateDef.read !== void 0 ? stateDef.read : true,
            // default read to true
            def: stateDef.id === "guid" ? deviceInfo.guid : stateDef.def !== void 0 ? stateDef.def : device[stateDef.id]
          };
          if (stateDef.states) {
            common.states = stateDef.states;
          }
          await this.setObjectNotExistsAsync(`${deviceInfo.name}.${stateDef.id}`, {
            type: "state",
            common,
            native: {}
          });
        }
        this.log.info(`Device ${deviceInfo.name} created.`);
        if ((_a = this.config) == null ? void 0 : _a.historyEnabled) {
          await this.setObjectNotExistsAsync(`${deviceInfo.name}.history`, {
            type: "channel",
            common: { name: "History Data" },
            native: {}
          });
          const historyStates = (0, import_state_definitions.getHistoryStates)();
          for (const [id, def] of Object.entries(historyStates)) {
            await this.setObjectNotExistsAsync(`${deviceInfo.name}.${id}`, {
              type: "state",
              common: def,
              native: {}
            });
          }
        }
      }
    }));
    this.log.debug("Device creation completed.");
  }
  async updateDevice(deviceName, stateName, state) {
    if (import_state_definitions.readonlyStateNames.includes(stateName)) {
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
  /**
   * Is called when adapter shuts down - callback has to be called under any circumstances!
   */
  onUnload(callback) {
    try {
      if (this.refreshTimeout)
        clearTimeout(this.refreshTimeout);
      if (this.refreshHistoryTimeout)
        clearTimeout(this.refreshHistoryTimeout);
      this.log.info("cleaned everything up...");
      callback();
    } catch (e) {
      callback();
    }
  }
  /**
   * Is called if a subscribed object changes
   */
  onObjectChange(id, obj) {
    if (obj) {
      this.log.info(`object ${id} changed: ${JSON.stringify(obj)}`);
    } else {
      this.log.info(`object ${id} deleted`);
    }
  }
  /**
   * Is called if a subscribed state changes
   */
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
      } else if (stateName == "refreshHistory" && state.val) {
        try {
          const groups = await this.comfortCloudClient.getGroups();
          await this.refreshHistory(groups);
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
    const response = await import_axios.default.get("https://itunes.apple.com/lookup?id=1348640525");
    if (response.status !== 200)
      return "";
    const version = await response.data.results[0].version;
    return version;
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
      await this.setStateAsync("info.connection", false, true);
      await this.comfortCloudClient.login(
        this.config.username,
        this.config.password
      );
      await this.setStateAsync("info.connection", true, true);
      this.log.info("Login successful.");
    } else if (error instanceof import_panasonic_comfort_cloud_client.ServiceError) {
      await this.setStateAsync("info.connection", false, true);
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
  setupHistoryRefreshTimeout() {
    this.log.debug("setupHistoryRefreshTimeout");
    const refreshIntervalInMilliseconds = this.historyRefreshIntervalInMinutes * 60 * 1e3;
    this.refreshHistoryTimeout = setTimeout(this.refreshHistoryTimeoutFunc.bind(this), refreshIntervalInMilliseconds);
  }
  async refreshHistoryTimeoutFunc() {
    var _a;
    this.log.debug(`refreshHistoryTimeoutFunc started.`);
    try {
      if ((_a = this.config) == null ? void 0 : _a.historyEnabled) {
        const groups = await this.comfortCloudClient.getGroups();
        await this.refreshHistory(groups);
      }
      this.setupHistoryRefreshTimeout();
    } catch (error) {
      this.log.warn(`Failed to refresh history: ${error}`);
      this.setupHistoryRefreshTimeout();
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
