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
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
// The adapter-core module gives you access to the core ioBroker functions
// you need to create an adapter
const utils = __importStar(require("@iobroker/adapter-core"));
const panasonic_comfort_cloud_client_1 = require("panasonic-comfort-cloud-client");
const _ = __importStar(require("lodash"));
const axios_1 = __importDefault(require("axios"));
const REFRESH_INTERVAL_IN_MINUTES_DEFAULT = 5;
class PanasonicComfortCloud extends utils.Adapter {
    constructor(options = {}) {
        super({
            ...options,
            name: 'panasonic-comfort-cloud',
        });
        this.comfortCloudClient = new panasonic_comfort_cloud_client_1.ComfortCloudClient();
        this.refreshIntervalInMinutes = REFRESH_INTERVAL_IN_MINUTES_DEFAULT;
        this.readonlyStateNames = [];
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
        this.setState('info.connection', false, true);
        const loadedAppVersion = await this.getCurrentAppVersion();
        this.log.info(`Loaded app version from GitHub: ${loadedAppVersion}`);
        if (loadedAppVersion && this.trimAll(this.config?.appVersionFromGithub) != this.trimAll(loadedAppVersion)) {
            this.updateConfig({ appVersionFromGithub: this.trimAll(loadedAppVersion), password: this.encrypt(this.config?.password) });
            return;
        }
        if (!this.config?.username || !this.config?.password) {
            this.log.error('Can not start without username or password. Please open config.');
        }
        else {
            if (this.config?.appVersionFromGithub != '' && this.config?.useAppVersionFromGithub) {
                this.log.debug(`Use AppVersion from Github ${this.config?.appVersionFromGithub}.`);
                this.comfortCloudClient = new panasonic_comfort_cloud_client_1.ComfortCloudClient(this.config?.appVersionFromGithub);
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
                this.setState('info.connection', true, true);
                this.log.debug('Create devices.');
                const groups = await this.comfortCloudClient.getGroups();
                await this.createDevices(groups);
                this.setupRefreshTimeout();
            }
            catch (error) {
                await this.handleClientError(error);
            }
        }
    }
    async refreshDeviceStates(device) {
        this.log.debug(`Refresh device ${device.name} (${device.guid}).`);
        this.log.debug(`${device.name}: guid => ${device.guid}.`);
        this.log.debug(`${device.name}: operate => ${device.operate}.`);
        await this.setStateChangedAsync(`${device.name}.operate`, device.operate, true);
        this.log.debug(`${device.name}: temperatureSet => ${device.temperatureSet}.`);
        await this.setStateChangedAsync(`${device.name}.temperatureSet`, device.temperatureSet, true);
        this.log.debug(`${device.name}: insideTemperature => ${device.insideTemperature}.`);
        await this.setStateChangedAsync(`${device.name}.insideTemperature`, device.insideTemperature, true);
        this.log.debug(`${device.name}: outTemperature => ${device.outTemperature}.`);
        await this.setStateChangedAsync(`${device.name}.outTemperature`, device.outTemperature, true);
        this.log.debug(`${device.name}: airSwingLR => ${device.airSwingLR}.`);
        await this.setStateChangedAsync(`${device.name}.airSwingLR`, device.airSwingLR, true);
        this.log.debug(`${device.name}: airSwingUD => ${device.airSwingUD}.`);
        await this.setStateChangedAsync(`${device.name}.airSwingUD`, device.airSwingUD, true);
        this.log.debug(`${device.name}: fanAutoMode => ${device.fanAutoMode}.`);
        await this.setStateChangedAsync(`${device.name}.fanAutoMode`, device.fanAutoMode, true);
        this.log.debug(`${device.name}: ecoMode => ${device.ecoMode}.`);
        await this.setStateChangedAsync(`${device.name}.ecoMode`, device.ecoMode, true);
        this.log.debug(`${device.name}: operationMode => ${device.operationMode}.`);
        await this.setStateChangedAsync(`${device.name}.operationMode`, device.operationMode, true);
        this.log.debug(`${device.name}: fanSpeed => ${device.fanSpeed}.`);
        await this.setStateChangedAsync(`${device.name}.fanSpeed`, device.fanSpeed, true);
        this.log.debug(`${device.name}: actualNanoe => ${device.actualNanoe}.`);
        await this.setStateChangedAsync(`${device.name}.actualNanoe`, device.actualNanoe, true);
        await this.setStateChangedAsync(`${device.name}.connected`, true, true);
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
            await this.setStateChangedAsync(`${deviceName}.connected`, false, true);
        }
    }
    async refreshDevices() {
        try {
            this.log.debug('Refresh all devices.');
            const groups = await this.comfortCloudClient.getGroups();
            this.setState('info.connection', true, true);
            const devices = _.flatMap(groups, g => g.devices);
            const deviceInfos = _.map(devices, d => { return { guid: d.guid, name: d.name }; });
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
                    await this.setStateChangedAsync(`${deviceInfo.name}.connected`, false, true);
                }
            }));
        }
        catch (error) {
            await this.handleClientError(error);
        }
    }
    async createDevices(groups) {
        const devices = await this.getDevicesAsync();
        const names = _.map(devices, (value) => {
            return value.common.name;
        });
        const devicesFromService = _.flatMap(groups, g => g.devices);
        const deviceInfos = _.map(devicesFromService, d => { return { guid: d.guid, name: d.name }; });
        await Promise.all(deviceInfos.map(async (deviceInfo) => {
            this.log.debug(`Device info from group ${deviceInfo.guid}, ${deviceInfo.name}.`);
            let device = null;
            try {
                device = await this.comfortCloudClient.getDevice(deviceInfo.guid, deviceInfo.name);
            }
            catch (error) {
                await this.handleClientError(error);
            }
            if (device != null) {
                if (_.includes(names, deviceInfo.name)) {
                    return;
                }
                this.createDevice(deviceInfo.name);
                this.createState(deviceInfo.name, '', 'guid', { role: 'info.address', write: false, def: deviceInfo.guid, type: 'string' }, undefined);
                this.readonlyStateNames.push('guid');
                this.createState(deviceInfo.name, '', 'operate', {
                    role: 'switch.power',
                    states: { 0: panasonic_comfort_cloud_client_1.Power[0], 1: panasonic_comfort_cloud_client_1.Power[1] },
                    write: true,
                    def: device.operate,
                    type: 'number',
                }, undefined);
                this.createState(deviceInfo.name, '', 'temperatureSet', {
                    role: 'level.temperature',
                    write: true,
                    def: device.temperatureSet,
                    type: 'number',
                }, undefined);
                this.createState(deviceInfo.name, '', 'insideTemperature', {
                    role: 'level.temperature',
                    write: false,
                    def: device.insideTemperature,
                    type: 'number',
                }, undefined);
                this.readonlyStateNames.push('insideTemperature');
                this.createState(deviceInfo.name, '', 'outTemperature', {
                    role: 'level.temperature',
                    write: false,
                    def: device.outTemperature,
                    type: 'number',
                }, undefined);
                this.readonlyStateNames.push('outTemperature');
                this.createState(deviceInfo.name, '', 'airSwingLR', {
                    role: 'state',
                    states: {
                        0: panasonic_comfort_cloud_client_1.AirSwingLR[0],
                        1: panasonic_comfort_cloud_client_1.AirSwingLR[1],
                        2: panasonic_comfort_cloud_client_1.AirSwingLR[2],
                        3: panasonic_comfort_cloud_client_1.AirSwingLR[3],
                        4: panasonic_comfort_cloud_client_1.AirSwingLR[4],
                    },
                    write: true,
                    def: device.airSwingLR,
                    type: 'number',
                }, undefined);
                this.createState(deviceInfo.name, '', 'airSwingUD', {
                    role: 'state',
                    states: {
                        0: panasonic_comfort_cloud_client_1.AirSwingUD[0],
                        1: panasonic_comfort_cloud_client_1.AirSwingUD[1],
                        2: panasonic_comfort_cloud_client_1.AirSwingUD[2],
                        3: panasonic_comfort_cloud_client_1.AirSwingUD[3],
                        4: panasonic_comfort_cloud_client_1.AirSwingUD[4],
                    },
                    write: true,
                    def: device.airSwingUD,
                    type: 'number',
                }, undefined);
                this.createState(deviceInfo.name, '', 'fanAutoMode', {
                    role: 'state',
                    states: {
                        0: panasonic_comfort_cloud_client_1.FanAutoMode[0],
                        1: panasonic_comfort_cloud_client_1.FanAutoMode[1],
                        2: panasonic_comfort_cloud_client_1.FanAutoMode[2],
                        3: panasonic_comfort_cloud_client_1.FanAutoMode[3],
                    },
                    write: true,
                    def: device.fanAutoMode,
                    type: 'number',
                }, undefined);
                this.createState(deviceInfo.name, '', 'ecoMode', {
                    role: 'state',
                    states: { 0: panasonic_comfort_cloud_client_1.EcoMode[0], 1: panasonic_comfort_cloud_client_1.EcoMode[1], 2: panasonic_comfort_cloud_client_1.EcoMode[2] },
                    write: true,
                    def: device.ecoMode,
                    type: 'number',
                }, undefined);
                this.createState(deviceInfo.name, '', 'operationMode', {
                    role: 'state',
                    states: {
                        0: panasonic_comfort_cloud_client_1.OperationMode[0],
                        1: panasonic_comfort_cloud_client_1.OperationMode[1],
                        2: panasonic_comfort_cloud_client_1.OperationMode[2],
                        3: panasonic_comfort_cloud_client_1.OperationMode[3],
                        4: panasonic_comfort_cloud_client_1.OperationMode[4],
                    },
                    write: true,
                    def: device.operationMode,
                    type: 'number',
                }, undefined);
                this.createState(deviceInfo.name, '', 'fanSpeed', {
                    role: 'state',
                    states: {
                        0: panasonic_comfort_cloud_client_1.FanSpeed[0],
                        1: panasonic_comfort_cloud_client_1.FanSpeed[1],
                        2: panasonic_comfort_cloud_client_1.FanSpeed[2],
                        3: panasonic_comfort_cloud_client_1.FanSpeed[3],
                        4: panasonic_comfort_cloud_client_1.FanSpeed[4],
                        5: panasonic_comfort_cloud_client_1.FanSpeed[5],
                    },
                    write: true,
                    def: device.fanSpeed,
                    type: 'number',
                }, undefined);
                this.createState(deviceInfo.name, '', 'actualNanoe', {
                    role: 'state',
                    states: {
                        0: panasonic_comfort_cloud_client_1.NanoeMode[0],
                        1: panasonic_comfort_cloud_client_1.NanoeMode[1],
                        2: panasonic_comfort_cloud_client_1.NanoeMode[2],
                        3: panasonic_comfort_cloud_client_1.NanoeMode[3],
                        4: panasonic_comfort_cloud_client_1.NanoeMode[4],
                    },
                    write: true,
                    def: device.actualNanoe,
                    type: 'number',
                }, undefined);
                this.createState(deviceInfo.name, '', 'connected', { role: 'state', read: true, write: false, def: false, type: 'boolean' }, undefined);
                this.log.info(`Device ${deviceInfo.name} created.`);
            }
        }));
        this.log.debug('Device creation completed.');
    }
    async updateDevice(deviceName, stateName, state) {
        if (this.readonlyStateNames.includes(stateName)) {
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
        if (state) {
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
        else {
            // The state was deleted
            this.log.info(`state ${id} deleted`);
        }
    }
    async getCurrentAppVersion() {
        const response = await axios_1.default.get('https://raw.githubusercontent.com/marc2016/ioBroker.panasonic-comfort-cloud/master/.currentAppVersion');
        if (response.status !== 200)
            return '';
        const text = await response.data;
        return text;
    }
    async handleClientError(error) {
        this.log.debug('Try to handle error.');
        if (error instanceof panasonic_comfort_cloud_client_1.TokenExpiredError) {
            this.log.info(`Token of comfort cloud client expired. Trying to login again. Code=${error.code}. Stack: ${error.stack}`);
            this.setState('info.connection', false, true);
            await this.comfortCloudClient.login(this.config.username, this.config.password);
            this.setState('info.connection', true, true);
            this.log.info('Login successful.');
        }
        else if (error instanceof panasonic_comfort_cloud_client_1.ServiceError) {
            this.setState('info.connection', false, true);
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