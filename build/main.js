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
  historyRefreshIntervalInMinutes = 15;
  deviceRefreshInProgress = false;
  historyRefreshInProgress = false;
  consecutiveRefreshErrors = 0;
  reauthenticationPromise;
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
    await this.ensureDiagnosticStates();
    await this.setStateAsync("info.connection", false, true);
    await this.setStateAsync("info.refreshInProgress", false, true);
    await this.setStateAsync("info.historyRefreshInProgress", false, true);
    const loadedAppVersion = await this.getCurrentAppVersion();
    this.log.info(`Loaded app version from App store: ${loadedAppVersion}`);
    if (loadedAppVersion && this.trimAll((_c = this.config) == null ? void 0 : _c.appVersionFromAppStore) != this.trimAll(loadedAppVersion)) {
      this.updateConfig({
        appVersionFromAppStore: this.trimAll(loadedAppVersion),
        password: this.encrypt((_d = this.config) == null ? void 0 : _d.password)
      });
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
        await this.comfortCloudClient.login(this.config.username, this.config.password);
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
    if (this.historyRefreshInProgress) {
      this.log.debug("Skip history refresh because another history refresh is still running.");
      return;
    }
    this.historyRefreshInProgress = true;
    await this.setStateAsync("info.historyRefreshInProgress", true, true);
    await this.setStateAsync("info.lastHistoryRefreshAttempt", (/* @__PURE__ */ new Date()).toISOString(), true);
    try {
      const devicesFromService = groups.flatMap((g) => g.devices);
      const deviceInfos = devicesFromService.map((d) => {
        return { guid: d.guid, name: d.name };
      });
      for (const deviceInfo of deviceInfos) {
        const modes = {
          day: import_panasonic_comfort_cloud_client.DataMode.Day,
          month: import_panasonic_comfort_cloud_client.DataMode.Month
        };
        for (const [modeName, dataMode] of Object.entries(modes)) {
          try {
            this.log.debug(`Fetching ${modeName} history for ${deviceInfo.name}`);
            const history = await this.withTokenRetry(
              () => this.comfortCloudClient.getDeviceHistoryData(deviceInfo.guid, /* @__PURE__ */ new Date(), dataMode),
              `fetch ${modeName} history for ${deviceInfo.name}`
            );
            if (history && history.historyDataList) {
              let latestData = null;
              for (let i = 0; i < history.historyDataList.length; i++) {
                const data = history.historyDataList[i];
                const index = i.toString().padStart(2, "0");
                const prefix = `${deviceInfo.name}.history.${modeName}.${index}`;
                await this.setStateChangedIfDefinedAsync(
                  `${prefix}.dataTime`,
                  this.formatHistoryDate(data.dataTime),
                  true
                );
                await this.setStateChangedIfDefinedAsync(
                  `${prefix}.averageSettingTemp`,
                  data.averageSettingTemp,
                  true
                );
                await this.setStateChangedIfDefinedAsync(
                  `${prefix}.averageInsideTemp`,
                  data.averageInsideTemp,
                  true
                );
                await this.setStateChangedIfDefinedAsync(
                  `${prefix}.averageOutsideTemp`,
                  data.averageOutsideTemp,
                  true
                );
                await this.setStateChangedIfDefinedAsync(
                  `${prefix}.consumption`,
                  data.consumption,
                  true
                );
                await this.setStateChangedIfDefinedAsync(`${prefix}.cost`, data.cost, true);
                await this.setStateChangedIfDefinedAsync(
                  `${prefix}.heatConsumptionRate`,
                  data.heatConsumptionRate,
                  true
                );
                await this.setStateChangedIfDefinedAsync(
                  `${prefix}.coolConsumptionRate`,
                  data.coolConsumptionRate,
                  true
                );
                if (modeName === "day") {
                  if (data.consumption !== -255) {
                    if (!latestData || data.dataTime > latestData.dataTime) {
                      latestData = data;
                    }
                  }
                  const currentHour = (/* @__PURE__ */ new Date()).getHours();
                  const previousHour = currentHour === 0 ? 23 : currentHour - 1;
                  if (currentHour > 0) {
                    let hourStr = "";
                    if (data.dataTime.length === 10) {
                      hourStr = data.dataTime.substring(8, 10);
                    } else if (data.dataTime.length === 11) {
                      hourStr = data.dataTime.substring(9, 11);
                    }
                    const dataHour = parseInt(hourStr, 10);
                    if (dataHour === previousHour) {
                      const lastHourPrefix = `${deviceInfo.name}.history.lastHour`;
                      await this.setStateChangedIfDefinedAsync(
                        `${lastHourPrefix}.dataTime`,
                        this.formatHistoryDate(data.dataTime),
                        true
                      );
                      await this.setStateChangedIfDefinedAsync(
                        `${lastHourPrefix}.averageSettingTemp`,
                        data.averageSettingTemp,
                        true
                      );
                      await this.setStateChangedIfDefinedAsync(
                        `${lastHourPrefix}.averageInsideTemp`,
                        data.averageInsideTemp,
                        true
                      );
                      await this.setStateChangedIfDefinedAsync(
                        `${lastHourPrefix}.averageOutsideTemp`,
                        data.averageOutsideTemp,
                        true
                      );
                      await this.setStateChangedIfDefinedAsync(
                        `${lastHourPrefix}.consumption`,
                        data.consumption,
                        true
                      );
                      await this.setStateChangedIfDefinedAsync(
                        `${lastHourPrefix}.cost`,
                        data.cost,
                        true
                      );
                      await this.setStateChangedIfDefinedAsync(
                        `${lastHourPrefix}.heatConsumptionRate`,
                        data.heatConsumptionRate,
                        true
                      );
                      await this.setStateChangedIfDefinedAsync(
                        `${lastHourPrefix}.coolConsumptionRate`,
                        data.coolConsumptionRate,
                        true
                      );
                    }
                  }
                }
              }
              if (modeName === "day" && latestData) {
                this.log.debug(
                  `Updating history.current using latest available data: ${latestData.dataTime}`
                );
                const currentPrefix = `${deviceInfo.name}.history.current`;
                const now = /* @__PURE__ */ new Date();
                const formattedTime = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}${String(now.getDate()).padStart(2, "0")} ${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
                await this.setStateChangedIfDefinedAsync(
                  `${currentPrefix}.dataTime`,
                  formattedTime,
                  true
                );
                await this.setStateChangedIfDefinedAsync(
                  `${currentPrefix}.averageSettingTemp`,
                  latestData.averageSettingTemp,
                  true
                );
                await this.setStateChangedIfDefinedAsync(
                  `${currentPrefix}.averageInsideTemp`,
                  latestData.averageInsideTemp,
                  true
                );
                await this.setStateChangedIfDefinedAsync(
                  `${currentPrefix}.averageOutsideTemp`,
                  latestData.averageOutsideTemp,
                  true
                );
                await this.setStateChangedIfDefinedAsync(
                  `${currentPrefix}.consumption`,
                  latestData.consumption,
                  true
                );
                await this.setStateChangedIfDefinedAsync(
                  `${currentPrefix}.cost`,
                  latestData.cost,
                  true
                );
                await this.setStateChangedIfDefinedAsync(
                  `${currentPrefix}.heatConsumptionRate`,
                  latestData.heatConsumptionRate,
                  true
                );
                await this.setStateChangedIfDefinedAsync(
                  `${currentPrefix}.coolConsumptionRate`,
                  latestData.coolConsumptionRate,
                  true
                );
              }
            }
          } catch (e) {
            this.log.warn(`Failed to fetch history ${modeName} for ${deviceInfo.name}: ${String(e)}`);
          }
        }
      }
      await this.setStateAsync("info.lastSuccessfulHistoryRefresh", (/* @__PURE__ */ new Date()).toISOString(), true);
    } finally {
      this.historyRefreshInProgress = false;
      await this.setStateAsync("info.historyRefreshInProgress", false, true);
    }
  }
  async setStateChangedIfDefinedAsync(id, val, ack) {
    if (val !== void 0 && val !== null) {
      await this.setStateChangedAsync(id, val, ack);
    }
  }
  isCurrentHour(dataTime) {
    let hourStr = "";
    if (dataTime.length === 10) {
      hourStr = dataTime.substring(8, 10);
    } else if (dataTime.length === 11) {
      hourStr = dataTime.substring(9, 11);
    } else {
      return false;
    }
    const hour = parseInt(hourStr, 10);
    return hour === (/* @__PURE__ */ new Date()).getHours();
  }
  formatHistoryDate(dataTime) {
    if (dataTime.length === 10) {
      const year = dataTime.substring(0, 4);
      const month = dataTime.substring(4, 6);
      const day = dataTime.substring(6, 8);
      const hour = dataTime.substring(8, 10);
      return `${year}-${month}-${day} ${hour}:00:00`;
    } else if (dataTime.length === 11) {
      const year = dataTime.substring(0, 4);
      const month = dataTime.substring(4, 6);
      const day = dataTime.substring(6, 8);
      const hour = dataTime.substring(9, 11);
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
      if (stateDef.id === "guid") {
        continue;
      }
      const value = device[stateDef.id];
      this.log.debug(`${device.name}: ${stateDef.id} => ${value}.`);
      if (value !== void 0) {
        await this.setStateChangedAsync(`${device.name}.${stateDef.id}`, value, true);
      } else if (stateDef.id === "connected") {
        await this.setStateChangedAsync(`${device.name}.connected`, true, true);
      }
    }
    this.log.debug(`Refresh device ${device.name} finished.`);
  }
  async refreshDevice(guid, deviceName) {
    try {
      const encodedGuid = this.encodeGuidForPath(guid);
      const device = await this.withTokenRetry(
        () => this.comfortCloudClient.getDevice(encodedGuid, deviceName),
        `refresh device ${deviceName}`
      );
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
    if (this.deviceRefreshInProgress) {
      this.log.debug("Skip device refresh because another refresh is still running.");
      return;
    }
    this.deviceRefreshInProgress = true;
    await this.setStateAsync("info.refreshInProgress", true, true);
    await this.setStateAsync("info.lastRefreshAttempt", (/* @__PURE__ */ new Date()).toISOString(), true);
    try {
      this.log.debug("Refresh all devices.");
      const groups = await this.withTokenRetry(
        () => this.comfortCloudClient.getGroups(),
        "refresh device groups"
      );
      await this.setStateAsync("info.connection", true, true);
      const devices = groups.flatMap((g) => g.devices);
      const deviceInfos = devices.map((d) => {
        return { guid: d.guid, name: d.name };
      });
      await Promise.all(
        deviceInfos.map(async (deviceInfo) => {
          try {
            const encodedGuid = this.encodeGuidForPath(deviceInfo.guid);
            const device = await this.withTokenRetry(
              () => this.comfortCloudClient.getDevice(encodedGuid, deviceInfo.name),
              `refresh device ${deviceInfo.name}`
            );
            if (device != null) {
              device.name = deviceInfo.name;
              device.guid = deviceInfo.guid;
              await this.refreshDeviceStates(device);
            }
          } catch (error) {
            await this.handleDeviceError(deviceInfo.name, error);
          }
        })
      );
      this.consecutiveRefreshErrors = 0;
      await this.setStateAsync("info.consecutiveErrors", 0, true);
      await this.setStateAsync("info.lastError", "", true);
      await this.setStateAsync("info.lastSuccessfulRefresh", (/* @__PURE__ */ new Date()).toISOString(), true);
    } catch (error) {
      this.consecutiveRefreshErrors++;
      await this.setStateAsync("info.consecutiveErrors", this.consecutiveRefreshErrors, true);
      await this.setStateAsync("info.lastError", this.formatError(error), true);
      await this.handleClientError(error);
    } finally {
      this.deviceRefreshInProgress = false;
      await this.setStateAsync("info.refreshInProgress", false, true);
    }
  }
  async createDevices(groups) {
    const devicesFromService = groups.flatMap((g) => g.devices);
    const deviceInfos = devicesFromService.map((d) => {
      return { guid: d.guid, name: d.name };
    });
    await Promise.all(
      deviceInfos.map(async (deviceInfo) => {
        var _a;
        this.log.debug(`Device info from group ${deviceInfo.guid}, ${deviceInfo.name}.`);
        let device = null;
        try {
          const encodedGuid = this.encodeGuidForPath(deviceInfo.guid);
          device = await this.withTokenRetry(
            () => this.comfortCloudClient.getDevice(encodedGuid, deviceInfo.name),
            `create device ${deviceInfo.name}`
          );
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
              common: { name: "History Data", role: "info" },
              native: {}
            });
            await this.setObjectNotExistsAsync(`${deviceInfo.name}.history.current`, {
              type: "channel",
              common: { name: "Current Hourly History", role: "info" },
              native: {}
            });
            await this.setObjectNotExistsAsync(`${deviceInfo.name}.history.lastHour`, {
              type: "channel",
              common: { name: "Last Completed Hour History", role: "info" },
              native: {}
            });
            await this.setObjectNotExistsAsync(`${deviceInfo.name}.history.day`, {
              type: "channel",
              common: { name: "Daily History", role: "info" },
              native: {}
            });
            for (let i = 0; i <= 24; i++) {
              const index = i.toString().padStart(2, "0");
              await this.setObjectNotExistsAsync(`${deviceInfo.name}.history.day.${index}`, {
                type: "channel",
                common: { name: `Hour ${index}`, role: "info" },
                native: {}
              });
            }
            await this.setObjectNotExistsAsync(`${deviceInfo.name}.history.month`, {
              type: "channel",
              common: { name: "Monthly History", role: "info" },
              native: {}
            });
            for (let i = 0; i <= 31; i++) {
              const index = i.toString().padStart(2, "0");
              await this.setObjectNotExistsAsync(`${deviceInfo.name}.history.month.${index}`, {
                type: "channel",
                common: { name: `Day ${index}`, role: "info" },
                native: {}
              });
            }
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
      })
    );
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
      this.log.debug(`Update device guid=${guidState == null ? void 0 : guidState.val} state=${stateName}`);
      const parameters = {};
      parameters[stateName] = state.val;
      if (!(guidState == null ? void 0 : guidState.val)) {
        return;
      }
      try {
        this.log.debug(`Set device parameter ${JSON.stringify(parameters)} for device ${guidState == null ? void 0 : guidState.val}`);
        await this.withTokenRetry(
          () => this.comfortCloudClient.setParameters(guidState == null ? void 0 : guidState.val, parameters),
          `update ${deviceName}.${stateName}`
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
   *
   * @param callback
   */
  onUnload(callback) {
    try {
      if (this.refreshTimeout) {
        this.clearTimeout(this.refreshTimeout);
      }
      if (this.refreshHistoryTimeout) {
        this.clearTimeout(this.refreshHistoryTimeout);
      }
      this.log.info("cleaned everything up...");
      callback();
    } catch {
      callback();
    }
  }
  /**
   * Is called if a subscribed object changes
   *
   * @param id
   * @param obj
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
   *
   * @param id
   * @param state
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
          const groups = await this.withTokenRetry(
            () => this.comfortCloudClient.getGroups(),
            "manual history refresh"
          );
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
      this.log.info(`state ${id} changed: ${state.val} (ack = ${state.ack})`);
    }
  }
  async getCurrentAppVersion() {
    var _a, _b, _c;
    try {
      const response = await import_axios.default.get("https://itunes.apple.com/lookup?id=1348640525", { timeout: 1e4 });
      if (response.status !== 200 || !((_c = (_b = (_a = response.data) == null ? void 0 : _a.results) == null ? void 0 : _b[0]) == null ? void 0 : _c.version)) {
        return "";
      }
      return response.data.results[0].version;
    } catch (error) {
      this.log.warn(`Could not load Panasonic app version: ${this.formatError(error)}`);
      return "";
    }
  }
  async handleDeviceError(deviceName, error) {
    this.log.debug(`Try to handle device error for ${deviceName}.`);
    await this.setStateChangedAsync(`${deviceName}.connected`, false, true);
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
      await this.comfortCloudClient.login(this.config.username, this.config.password);
      await this.setStateAsync("info.connection", true, true);
      this.log.info("Login successful.");
    } else if (error instanceof import_panasonic_comfort_cloud_client.ServiceError) {
      await this.setStateAsync("info.connection", false, true);
      this.log.error(`Service error: ${error.message}. Code=${error.code}. Stack: ${error.stack}`);
    } else if (error instanceof Error) {
      this.log.error(`Unknown error: ${error}. Stack: ${error.stack}`);
    }
  }
  async withTokenRetry(operation, context) {
    try {
      return await operation();
    } catch (error) {
      if (!(error instanceof import_panasonic_comfort_cloud_client.TokenExpiredError)) {
        throw error;
      }
      this.log.warn(`Comfort Cloud token expired while trying to ${context}; logging in again.`);
      await this.setStateAsync("info.connection", false, true);
      await this.reauthenticate();
      return operation();
    }
  }
  async reauthenticate() {
    if (!this.reauthenticationPromise) {
      this.reauthenticationPromise = (async () => {
        await this.comfortCloudClient.login(this.config.username, this.config.password);
        await this.setStateAsync("info.connection", true, true);
        this.log.info("Re-login successful.");
      })().finally(() => {
        this.reauthenticationPromise = void 0;
      });
    }
    await this.reauthenticationPromise;
  }
  formatError(error) {
    if (error instanceof import_panasonic_comfort_cloud_client.ServiceError) {
      return `${error.message}${error.code !== void 0 ? ` (code ${error.code})` : ""}`;
    }
    return error instanceof Error ? error.message : String(error);
  }
  async ensureDiagnosticStates() {
    const definitions = {
      "info.lastRefreshAttempt": {
        name: "Last device refresh attempt",
        role: "date",
        type: "string",
        read: true,
        write: false,
        def: ""
      },
      "info.lastSuccessfulRefresh": {
        name: "Last successful device refresh",
        role: "date",
        type: "string",
        read: true,
        write: false,
        def: ""
      },
      "info.lastError": {
        name: "Last refresh error",
        role: "text",
        type: "string",
        read: true,
        write: false,
        def: ""
      },
      "info.consecutiveErrors": {
        name: "Consecutive refresh errors",
        role: "value",
        type: "number",
        read: true,
        write: false,
        def: 0
      },
      "info.refreshInProgress": {
        name: "Device refresh in progress",
        role: "indicator.working",
        type: "boolean",
        read: true,
        write: false,
        def: false
      },
      "info.lastHistoryRefreshAttempt": {
        name: "Last history refresh attempt",
        role: "date",
        type: "string",
        read: true,
        write: false,
        def: ""
      },
      "info.lastSuccessfulHistoryRefresh": {
        name: "Last successful history refresh",
        role: "date",
        type: "string",
        read: true,
        write: false,
        def: ""
      },
      "info.historyRefreshInProgress": {
        name: "History refresh in progress",
        role: "indicator.working",
        type: "boolean",
        read: true,
        write: false,
        def: false
      }
    };
    for (const [id, common] of Object.entries(definitions)) {
      await this.setObjectNotExistsAsync(id, { type: "state", common, native: {} });
    }
  }
  setupRefreshTimeout() {
    this.log.debug("setupRefreshTimeout");
    if (this.refreshTimeout) {
      this.clearTimeout(this.refreshTimeout);
    }
    const refreshIntervalInMilliseconds = this.refreshIntervalInMinutes * 60 * 1e3;
    this.log.debug(`refreshIntervalInMilliseconds=${refreshIntervalInMilliseconds}`);
    this.refreshTimeout = this.setTimeout(this.refreshTimeoutFunc.bind(this), refreshIntervalInMilliseconds);
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
    if (this.refreshHistoryTimeout) {
      this.clearTimeout(this.refreshHistoryTimeout);
    }
    const refreshIntervalInMilliseconds = this.historyRefreshIntervalInMinutes * 60 * 1e3;
    this.refreshHistoryTimeout = this.setTimeout(
      this.refreshHistoryTimeoutFunc.bind(this),
      refreshIntervalInMilliseconds
    );
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
      this.log.warn(`Failed to refresh history: ${String(error)}`);
      this.setupHistoryRefreshTimeout();
    } finally {
      if (this.historyRefreshInProgress) {
        this.historyRefreshInProgress = false;
        await this.setStateAsync("info.historyRefreshInProgress", false, true);
      }
    }
  }
  trimAll(text) {
    const newText = text.trim().replace(/(\r\n|\n|\r)/gm, "");
    return newText;
  }
  encodeGuidForPath(guid) {
    try {
      return encodeURIComponent(decodeURIComponent(guid));
    } catch {
      return encodeURIComponent(guid);
    }
  }
}
if (module.parent) {
  module.exports = (options) => new PanasonicComfortCloud(options);
} else {
  (() => new PanasonicComfortCloud())();
}
//# sourceMappingURL=main.js.map
