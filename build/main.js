"use strict";
/*
 * Created with @iobroker/create-adapter v1.16.0
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
// The adapter-core module gives you access to the core ioBroker functions
// you need to create an adapter
const utils = __importStar(require("@iobroker/adapter-core"));
const panasonic_comfort_cloud_client_1 = require("panasonic-comfort-cloud-client");
const axios_1 = __importDefault(require("axios"));
const state_definitions_1 = require("./lib/state-definitions");
const REFRESH_INTERVAL_IN_MINUTES_DEFAULT = 5;
class PanasonicComfortCloud extends utils.Adapter {
    comfortCloudClient = new panasonic_comfort_cloud_client_1.ComfortCloudClient();
    refreshTimeout;
    refreshHistoryTimeout;
    refreshIntervalInMinutes = REFRESH_INTERVAL_IN_MINUTES_DEFAULT;
    historyRefreshIntervalInMinutes = 15;
    constructor(options = {}) {
        super({
            ...options,
            name: 'panasonic-comfort-cloud',
        });
        this.on('ready', this.onReady.bind(this));
        this.on('objectChange', this.onObjectChange.bind(this));
        this.on('stateChange', this.onStateChange.bind(this));
        // this.on('message', this.onMessage.bind(this));
        this.on('unload', this.onUnload.bind(this));
    }
    /**
     * Is called when databases are connected and adapter received configuration.
     */
    async onReady() {
        this.refreshIntervalInMinutes = this.config?.refreshInterval ?? REFRESH_INTERVAL_IN_MINUTES_DEFAULT;
        this.subscribeStates('*');
        await this.setStateAsync('info.connection', false, true);
        const loadedAppVersion = await this.getCurrentAppVersion();
        this.log.info(`Loaded app version from App store: ${loadedAppVersion}`);
        if (loadedAppVersion && this.trimAll(this.config?.appVersionFromAppStore) != this.trimAll(loadedAppVersion)) {
            this.updateConfig({ appVersionFromAppStore: this.trimAll(loadedAppVersion), password: this.encrypt(this.config?.password) });
            return;
        }
        if (!this.config?.username || !this.config?.password) {
            this.log.error('Can not start without username or password. Please open config.');
        }
        else {
            if (this.config?.appVersionFromAppStore != '' && this.config?.useAppVersionFromAppStore) {
                this.log.debug(`Use AppVersion from App Store ${this.config?.appVersionFromAppStore}.`);
                this.comfortCloudClient = new panasonic_comfort_cloud_client_1.ComfortCloudClient(this.config?.appVersionFromAppStore);
            }
            else if (this.config?.appVersion != '') {
                this.log.debug(`Use configured AppVersion ${this.config?.appVersion}.`);
                this.comfortCloudClient = new panasonic_comfort_cloud_client_1.ComfortCloudClient(this.config?.appVersion);
            }
            else {
                this.log.debug(`Use default AppVersion.`);
                this.comfortCloudClient = new panasonic_comfort_cloud_client_1.ComfortCloudClient();
            }
            try {
                this.log.debug(`Try to login with username ${this.config.username}.`);
                await this.comfortCloudClient.login(this.config.username, this.config.password);
                this.log.info('Login successful.');
                await this.setStateAsync('info.connection', true, true);
                this.log.debug('Create devices.');
                const groups = await this.comfortCloudClient.getGroups();
                await this.createDevices(groups);
                this.log.debug(`Automativ refresh is set to ${this.config?.automaticRefreshEnabled}.`);
                if (this.config?.automaticRefreshEnabled) {
                    this.setupRefreshTimeout();
                }
                if (this.config?.historyEnabled) {
                    this.log.debug(`History enabled. Refreshing history.`);
                    await this.refreshHistory(groups);
                    this.setupHistoryRefreshTimeout();
                }
            }
            catch (error) {
                await this.handleClientError(error);
            }
        }
    }
    async refreshHistory(groups) {
        const devicesFromService = groups.flatMap(g => g.devices);
        const deviceInfos = devicesFromService.map(d => { return { guid: d.guid, name: d.name }; });
        for (const deviceInfo of deviceInfos) {
            const modes = {
                'day': panasonic_comfort_cloud_client_1.DataMode.Day,
                'month': panasonic_comfort_cloud_client_1.DataMode.Month
            };
            for (const [modeName, dataMode] of Object.entries(modes)) {
                try {
                    this.log.debug(`Fetching ${modeName} history for ${deviceInfo.name}`);
                    const history = await this.comfortCloudClient.getDeviceHistoryData(deviceInfo.guid, new Date(), dataMode);
                    if (history && history.historyDataList) {
                        let latestData = null;
                        for (let i = 0; i < history.historyDataList.length; i++) {
                            const data = history.historyDataList[i];
                            const index = i.toString().padStart(2, '0');
                            const prefix = `${deviceInfo.name}.history.${modeName}.${index}`;
                            await this.setStateChangedIfDefinedAsync(`${prefix}.dataTime`, this.formatHistoryDate(data.dataTime), true);
                            await this.setStateChangedIfDefinedAsync(`${prefix}.averageSettingTemp`, data.averageSettingTemp, true);
                            await this.setStateChangedIfDefinedAsync(`${prefix}.averageInsideTemp`, data.averageInsideTemp, true);
                            await this.setStateChangedIfDefinedAsync(`${prefix}.averageOutsideTemp`, data.averageOutsideTemp, true);
                            await this.setStateChangedIfDefinedAsync(`${prefix}.consumption`, data.consumption, true);
                            await this.setStateChangedIfDefinedAsync(`${prefix}.cost`, data.cost, true);
                            await this.setStateChangedIfDefinedAsync(`${prefix}.heatConsumptionRate`, data.heatConsumptionRate, true);
                            await this.setStateChangedIfDefinedAsync(`${prefix}.coolConsumptionRate`, data.coolConsumptionRate, true);
                            // Update current hour
                            // We use the latest available data for "current" to handle API lag
                            // The API returns -255 for future/invalid values, so we must filter those out
                            if (modeName === 'day') {
                                if (data.consumption !== -255) {
                                    if (!latestData || data.dataTime > latestData.dataTime) {
                                        latestData = data;
                                    }
                                }
                            }
                        }
                        if (modeName === 'day' && latestData) {
                            this.log.debug(`Updating history.current using latest available data: ${latestData.dataTime}`);
                            const currentPrefix = `${deviceInfo.name}.history.current`;
                            await this.setStateChangedIfDefinedAsync(`${currentPrefix}.dataTime`, this.formatHistoryDate(latestData.dataTime), true);
                            await this.setStateChangedIfDefinedAsync(`${currentPrefix}.averageSettingTemp`, latestData.averageSettingTemp, true);
                            await this.setStateChangedIfDefinedAsync(`${currentPrefix}.averageInsideTemp`, latestData.averageInsideTemp, true);
                            await this.setStateChangedIfDefinedAsync(`${currentPrefix}.averageOutsideTemp`, latestData.averageOutsideTemp, true);
                            await this.setStateChangedIfDefinedAsync(`${currentPrefix}.consumption`, latestData.consumption, true);
                            await this.setStateChangedIfDefinedAsync(`${currentPrefix}.cost`, latestData.cost, true);
                            await this.setStateChangedIfDefinedAsync(`${currentPrefix}.heatConsumptionRate`, latestData.heatConsumptionRate, true);
                            await this.setStateChangedIfDefinedAsync(`${currentPrefix}.coolConsumptionRate`, latestData.coolConsumptionRate, true);
                        }
                    }
                }
                catch (e) {
                    this.log.warn(`Failed to fetch history ${modeName} for ${deviceInfo.name}: ${e}`);
                }
            }
        }
    }
    async setStateChangedIfDefinedAsync(id, val, ack) {
        if (val !== undefined && val !== null) {
            await this.setStateChangedAsync(id, val, ack);
        }
    }
    isCurrentHour(dataTime) {
        let hourStr = '';
        if (dataTime.length === 10) {
            // YYYYMMDDHH
            hourStr = dataTime.substring(8, 10);
        }
        else if (dataTime.length === 11) {
            // YYYYMMDD HH
            hourStr = dataTime.substring(9, 11);
        }
        else {
            return false;
        }
        const hour = parseInt(hourStr, 10);
        return hour === new Date().getHours();
    }
    formatHistoryDate(dataTime) {
        // Format YYYYMMDDHH to YYYY-MM-DD HH:mm:ss
        // or YYYYMMDD to YYYY-MM-DD
        // or YYYYMMDD HH to YYYY-MM-DD HH:mm:ss
        if (dataTime.length === 10) {
            // YYYYMMDDHH
            const year = dataTime.substring(0, 4);
            const month = dataTime.substring(4, 6);
            const day = dataTime.substring(6, 8);
            const hour = dataTime.substring(8, 10);
            return `${year}-${month}-${day} ${hour}:00:00`;
        }
        else if (dataTime.length === 11) {
            // YYYYMMDD HH
            const year = dataTime.substring(0, 4);
            const month = dataTime.substring(4, 6);
            const day = dataTime.substring(6, 8);
            const hour = dataTime.substring(9, 11);
            return `${year}-${month}-${day} ${hour}:00:00`;
        }
        else if (dataTime.length === 8) {
            // YYYYMMDD
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
        for (const stateDef of state_definitions_1.deviceStates) {
            if (stateDef.id === 'guid')
                continue; // guid is special, not a state on the device object in the same way
            const value = device[stateDef.id];
            this.log.debug(`${device.name}: ${stateDef.id} => ${value}.`);
            if (value !== undefined) {
                await this.setStateChangedAsync(`${device.name}.${stateDef.id}`, value, true);
            }
            else if (stateDef.id === 'connected') {
                // Connected is always true when we reached this point
                await this.setStateChangedAsync(`${device.name}.connected`, true, true);
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
        }
        catch (error) {
            await this.handleDeviceError(deviceName, error);
        }
    }
    async refreshDevices() {
        try {
            this.log.debug('Refresh all devices.');
            const groups = await this.comfortCloudClient.getGroups();
            await this.setStateAsync('info.connection', true, true);
            const devices = groups.flatMap(g => g.devices);
            const deviceInfos = devices.map(d => { return { guid: d.guid, name: d.name }; });
            await Promise.all(deviceInfos.map(async (deviceInfo) => {
                try {
                    const device = await this.comfortCloudClient.getDevice(deviceInfo.guid, deviceInfo.name);
                    if (device != null) {
                        device.name = deviceInfo.name;
                        device.guid = deviceInfo.guid;
                        await this.refreshDeviceStates(device);
                    }
                }
                catch (error) {
                    await this.handleDeviceError(deviceInfo.name, error);
                }
            }));
        }
        catch (error) {
            await this.handleClientError(error);
        }
    }
    async createDevices(groups) {
        const devicesFromService = groups.flatMap(g => g.devices);
        const deviceInfos = devicesFromService.map(d => { return { guid: d.guid, name: d.name }; });
        await Promise.all(deviceInfos.map(async (deviceInfo) => {
            this.log.debug(`Device info from group ${deviceInfo.guid}, ${deviceInfo.name}.`);
            let device = null;
            try {
                device = await this.comfortCloudClient.getDevice(deviceInfo.guid, deviceInfo.name);
            }
            catch (error) {
                await this.handleDeviceError(deviceInfo.name, error);
                return;
            }
            if (device != null) {
                await this.setObjectNotExistsAsync(deviceInfo.name, {
                    type: 'device',
                    common: {
                        name: deviceInfo.name
                    },
                    native: {}
                });
                for (const stateDef of state_definitions_1.deviceStates) {
                    const common = {
                        name: stateDef.id,
                        role: stateDef.role,
                        write: stateDef.write,
                        type: stateDef.type,
                        read: stateDef.read !== undefined ? stateDef.read : true, // default read to true
                        def: stateDef.id === 'guid' ? deviceInfo.guid : (stateDef.def !== undefined ? stateDef.def : device[stateDef.id]),
                    };
                    if (stateDef.states) {
                        common.states = stateDef.states;
                    }
                    await this.setObjectNotExistsAsync(`${deviceInfo.name}.${stateDef.id}`, {
                        type: 'state',
                        common: common,
                        native: {}
                    });
                }
                this.log.info(`Device ${deviceInfo.name} created.`);
                if (this.config?.historyEnabled) {
                    await this.setObjectNotExistsAsync(`${deviceInfo.name}.history`, {
                        type: 'channel',
                        common: { name: 'History Data', role: 'info' },
                        native: {}
                    });
                    // Create sub-channels
                    await this.setObjectNotExistsAsync(`${deviceInfo.name}.history.current`, {
                        type: 'channel',
                        common: { name: 'Current Hourly History', role: 'info' },
                        native: {}
                    });
                    await this.setObjectNotExistsAsync(`${deviceInfo.name}.history.day`, {
                        type: 'channel',
                        common: { name: 'Daily History', role: 'info' },
                        native: {}
                    });
                    for (let i = 0; i <= 24; i++) {
                        const index = i.toString().padStart(2, '0');
                        await this.setObjectNotExistsAsync(`${deviceInfo.name}.history.day.${index}`, {
                            type: 'channel',
                            common: { name: `Hour ${index}`, role: 'info' },
                            native: {}
                        });
                    }
                    await this.setObjectNotExistsAsync(`${deviceInfo.name}.history.month`, {
                        type: 'channel',
                        common: { name: 'Monthly History', role: 'info' },
                        native: {}
                    });
                    for (let i = 0; i <= 31; i++) {
                        const index = i.toString().padStart(2, '0');
                        await this.setObjectNotExistsAsync(`${deviceInfo.name}.history.month.${index}`, {
                            type: 'channel',
                            common: { name: `Day ${index}`, role: 'info' },
                            native: {}
                        });
                    }
                    const historyStates = (0, state_definitions_1.getHistoryStates)();
                    for (const [id, def] of Object.entries(historyStates)) {
                        await this.setObjectNotExistsAsync(`${deviceInfo.name}.${id}`, {
                            type: 'state',
                            common: def,
                            native: {}
                        });
                    }
                }
            }
        }));
        this.log.debug('Device creation completed.');
    }
    async updateDevice(deviceName, stateName, state) {
        if (state_definitions_1.readonlyStateNames.includes(stateName)) {
            return;
        }
        if (!state.ack) {
            const stateObj = await this.getObjectAsync(`${deviceName}.${stateName}`);
            const stateCommon = stateObj?.common;
            if (stateCommon?.write == false) {
                return;
            }
            const guidState = await this.getStateAsync(`${deviceName}.guid`);
            this.log.debug(`Update device guid=${guidState?.val} state=${stateName}`);
            const parameters = {};
            parameters[stateName] = state.val;
            if (!guidState?.val) {
                return;
            }
            try {
                this.log.debug(`Set device parameter ${JSON.stringify(parameters)} for device ${guidState?.val}`);
                await this.comfortCloudClient.setParameters(guidState?.val, parameters);
                this.log.debug(`Refresh device ${deviceName}`);
                await this.refreshDevice(guidState?.val, deviceName);
            }
            catch (error) {
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
            this.log.info('cleaned everything up...');
            callback();
        }
        catch (e) {
            callback();
        }
    }
    /**
     * Is called if a subscribed object changes
     */
    onObjectChange(id, obj) {
        if (obj) {
            // The object was changed
            this.log.info(`object ${id} changed: ${JSON.stringify(obj)}`);
        }
        else {
            // The object was deleted
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
        if (id.includes('.commands.')) {
            const elements = id.split('.');
            const stateName = elements[elements.length - 1];
            if (stateName == 'manualRefresh' && state.val) {
                try {
                    await this.refreshDevices();
                    await this.setStateAsync(id, state, true);
                }
                catch (error) {
                    await this.handleClientError(error);
                }
                await this.setStateAsync(id, false, true);
            }
            else if (stateName == 'refreshHistory' && state.val) {
                try {
                    const groups = await this.comfortCloudClient.getGroups();
                    await this.refreshHistory(groups);
                    await this.setStateAsync(id, state, true);
                }
                catch (error) {
                    await this.handleClientError(error);
                }
                await this.setStateAsync(id, false, true);
            }
        }
        else if (!id.includes('.info.')) {
            const elements = id.split('.');
            const deviceName = elements[elements.length - 2];
            const stateName = elements[elements.length - 1];
            try {
                await this.updateDevice(deviceName, stateName, state);
            }
            catch (error) {
                await this.handleClientError(error);
            }
            // The state was changed
            this.log.info(`state ${id} changed: ${state.val} (ack = ${state.ack})`);
        }
    }
    async getCurrentAppVersion() {
        const response = await axios_1.default.get('https://itunes.apple.com/lookup?id=1348640525');
        if (response.status !== 200)
            return '';
        const version = await response.data.results[0].version;
        return version;
    }
    async handleDeviceError(deviceName, error) {
        this.log.debug(`Try to handle device error for ${deviceName}.`);
        await this.setStateChangedAsync(`${deviceName}.connected`, false, true);
        if (error instanceof panasonic_comfort_cloud_client_1.ServiceError) {
            this.log.error(`Service error when connecting to device ${deviceName}: ${error.message}. Code=${error.code}. Stack: ${error.stack}`);
        }
        else if (error instanceof Error) {
            this.log.error(`Unknown error when connecting to device ${deviceName}: ${error}. Stack: ${error.stack}`);
        }
    }
    async handleClientError(error) {
        this.log.debug('Try to handle error.');
        if (error instanceof panasonic_comfort_cloud_client_1.TokenExpiredError) {
            this.log.info(`Token of comfort cloud client expired. Trying to login again. Code=${error.code}. Stack: ${error.stack}`);
            await this.setStateAsync('info.connection', false, true);
            await this.comfortCloudClient.login(this.config.username, this.config.password);
            await this.setStateAsync('info.connection', true, true);
            this.log.info('Login successful.');
        }
        else if (error instanceof panasonic_comfort_cloud_client_1.ServiceError) {
            await this.setStateAsync('info.connection', false, true);
            this.log.error(`Service error: ${error.message}. Code=${error.code}. Stack: ${error.stack}`);
        }
        else if (error instanceof Error) {
            this.log.error(`Unknown error: ${error}. Stack: ${error.stack}`);
        }
    }
    setupRefreshTimeout() {
        this.log.debug('setupRefreshTimeout');
        const refreshIntervalInMilliseconds = this.refreshIntervalInMinutes * 60 * 1000;
        this.log.debug(`refreshIntervalInMilliseconds=${refreshIntervalInMilliseconds}`);
        this.refreshTimeout = setTimeout(this.refreshTimeoutFunc.bind(this), refreshIntervalInMilliseconds);
    }
    async refreshTimeoutFunc() {
        this.log.debug(`refreshTimeoutFunc started.`);
        try {
            await this.refreshDevices();
            this.setupRefreshTimeout();
        }
        catch (error) {
            await this.handleClientError(error);
        }
    }
    setupHistoryRefreshTimeout() {
        this.log.debug('setupHistoryRefreshTimeout');
        const refreshIntervalInMilliseconds = this.historyRefreshIntervalInMinutes * 60 * 1000;
        this.refreshHistoryTimeout = setTimeout(this.refreshHistoryTimeoutFunc.bind(this), refreshIntervalInMilliseconds);
    }
    async refreshHistoryTimeoutFunc() {
        this.log.debug(`refreshHistoryTimeoutFunc started.`);
        try {
            if (this.config?.historyEnabled) {
                const groups = await this.comfortCloudClient.getGroups();
                await this.refreshHistory(groups);
            }
            this.setupHistoryRefreshTimeout();
        }
        catch (error) {
            this.log.warn(`Failed to refresh history: ${error}`);
            // Retry later even on error
            this.setupHistoryRefreshTimeout();
        }
    }
    trimAll(text) {
        const newText = text.trim().replace(/(\r\n|\n|\r)/gm, '');
        return newText;
    }
}
if (module.parent) {
    // Export the constructor in compact mode
    module.exports = (options) => new PanasonicComfortCloud(options);
}
else {
    // otherwise start the instance directly
    (() => new PanasonicComfortCloud())();
}
//# sourceMappingURL=main.js.map