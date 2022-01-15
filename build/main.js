"use strict";
/*
 * Created with @iobroker/create-adapter v1.16.0
 */
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
// The adapter-core module gives you access to the core ioBroker functions
// you need to create an adapter
const utils = require("@iobroker/adapter-core");
const panasonic_comfort_cloud_client_1 = require("panasonic-comfort-cloud-client");
const _ = require("lodash");
const REFRESH_INTERVAL_IN_MINUTES_DEFAULT = 5;
const comfortCloudClient = new panasonic_comfort_cloud_client_1.ComfortCloudClient();
class PanasonicComfortCloud extends utils.Adapter {
    constructor(options = {}) {
        super(Object.assign(Object.assign({}, options), { name: 'panasonic-comfort-cloud' }));
        this.refreshIntervalInMinutes = REFRESH_INTERVAL_IN_MINUTES_DEFAULT;
        this.on('ready', this.onReady.bind(this));
        this.on('objectChange', this.onObjectChange.bind(this));
        this.on('stateChange', this.onStateChange.bind(this));
        // this.on('message', this.onMessage.bind(this));
        this.on('unload', this.onUnload.bind(this));
    }
    /**
     * Is called when databases are connected and adapter received configuration.
     */
    onReady() {
        var _a, _b, _c, _d;
        return __awaiter(this, void 0, void 0, function* () {
            this.refreshIntervalInMinutes = (_b = (_a = this.config) === null || _a === void 0 ? void 0 : _a.refreshInterval) !== null && _b !== void 0 ? _b : REFRESH_INTERVAL_IN_MINUTES_DEFAULT;
            this.subscribeStates('*');
            this.setState('info.connection', false, true);
            if (!((_c = this.config) === null || _c === void 0 ? void 0 : _c.username) || !((_d = this.config) === null || _d === void 0 ? void 0 : _d.password)) {
                this.log.error('Can not start without username or password. Please open config.');
            }
            else {
                try {
                    this.log.debug(`Try to login with username ${this.config.username}.`);
                    yield comfortCloudClient.login(this.config.username, this.config.password);
                    this.log.info('Login successful.');
                    this.setState('info.connection', true, true);
                    this.log.debug('Create devices.');
                    const groups = yield comfortCloudClient.getGroups();
                    yield this.createDevices(groups);
                    this.setupRefreshTimeout();
                }
                catch (error) {
                    yield this.handleClientError(error);
                }
            }
        });
    }
    refreshDeviceStates(device) {
        return __awaiter(this, void 0, void 0, function* () {
            this.log.debug(`Refresh device ${device.name} (${device.guid}).`);
            this.log.debug(`${device.name}: guid => ${device.guid}.`);
            this.log.debug(`${device.name}: operate => ${device.operate}.`);
            yield this.setStateChangedAsync(`${device.name}.operate`, device.operate, true);
            this.log.debug(`${device.name}: temperatureSet => ${device.temperatureSet}.`);
            yield this.setStateChangedAsync(`${device.name}.temperatureSet`, device.temperatureSet, true);
            this.log.debug(`${device.name}: insideTemperature => ${device.insideTemperature}.`);
            yield this.setStateChangedAsync(`${device.name}.insideTemperature`, device.insideTemperature, true);
            this.log.debug(`${device.name}: outTemperature => ${device.outTemperature}.`);
            yield this.setStateChangedAsync(`${device.name}.outTemperature`, device.outTemperature, true);
            this.log.debug(`${device.name}: airSwingLR => ${device.airSwingLR}.`);
            yield this.setStateChangedAsync(`${device.name}.airSwingLR`, device.airSwingLR, true);
            this.log.debug(`${device.name}: airSwingUD => ${device.airSwingUD}.`);
            yield this.setStateChangedAsync(`${device.name}.airSwingUD`, device.airSwingUD, true);
            this.log.debug(`${device.name}: fanAutoMode => ${device.fanAutoMode}.`);
            yield this.setStateChangedAsync(`${device.name}.fanAutoMode`, device.fanAutoMode, true);
            this.log.debug(`${device.name}: ecoMode => ${device.ecoMode}.`);
            yield this.setStateChangedAsync(`${device.name}.ecoMode`, device.ecoMode, true);
            this.log.debug(`${device.name}: operationMode => ${device.operationMode}.`);
            yield this.setStateChangedAsync(`${device.name}.operationMode`, device.operationMode, true);
            this.log.debug(`${device.name}: fanSpeed => ${device.fanSpeed}.`);
            yield this.setStateChangedAsync(`${device.name}.fanSpeed`, device.fanSpeed, true);
            this.log.debug(`${device.name}: actualNanoe => ${device.actualNanoe}.`);
            yield this.setStateChangedAsync(`${device.name}.actualNanoe`, device.actualNanoe, true);
            this.log.debug(`Refresh device ${device.name} finished.`);
        });
    }
    refreshDevice(guid, deviceName) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const device = yield comfortCloudClient.getDevice(guid);
                if (!device) {
                    return;
                }
                if (!device.name) {
                    device.name = deviceName;
                }
                yield this.refreshDeviceStates(device);
            }
            catch (error) {
                yield this.handleClientError(error);
            }
        });
    }
    refreshDevices() {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                this.log.debug('Refresh all devices.');
                const groups = yield comfortCloudClient.getGroups();
                this.setState('info.connection', true, true);
                const devices = _.flatMap(groups, g => g.devices);
                const deviceInfos = _.map(devices, d => { return { guid: d.guid, name: d.name }; });
                yield Promise.all(deviceInfos.map((deviceInfo) => __awaiter(this, void 0, void 0, function* () {
                    const device = yield comfortCloudClient.getDevice(deviceInfo.guid);
                    if (device != null) {
                        device.name = deviceInfo.name;
                        device.guid = deviceInfo.guid;
                        yield this.refreshDeviceStates(device);
                    }
                })));
            }
            catch (error) {
                yield this.handleClientError(error);
            }
        });
    }
    createDevices(groups) {
        return __awaiter(this, void 0, void 0, function* () {
            const devices = yield this.getDevicesAsync();
            const names = _.map(devices, (value) => {
                return value.common.name;
            });
            const devicesFromService = _.flatMap(groups, g => g.devices);
            const deviceInfos = _.map(devicesFromService, d => { return { guid: d.guid, name: d.name }; });
            yield Promise.all(deviceInfos.map((deviceInfo) => __awaiter(this, void 0, void 0, function* () {
                this.log.debug(`Device info from group ${deviceInfo.guid}, ${deviceInfo.name}.`);
                let device = null;
                try {
                    device = yield comfortCloudClient.getDevice(deviceInfo.guid);
                }
                catch (error) {
                    yield this.handleClientError(error);
                }
                if (device != null) {
                    if (_.includes(names, deviceInfo.name)) {
                        return;
                    }
                    this.createDevice(deviceInfo.name);
                    this.createState(deviceInfo.name, '', 'guid', { role: 'text', write: false, def: deviceInfo.guid, type: 'string' }, undefined);
                    this.createState(deviceInfo.name, '', 'operate', {
                        role: 'state',
                        states: { 0: panasonic_comfort_cloud_client_1.Power[0], 1: panasonic_comfort_cloud_client_1.Power[1] },
                        write: true,
                        def: device.operate,
                        type: 'array',
                    }, undefined);
                    this.createState(deviceInfo.name, '', 'temperatureSet', {
                        role: 'level.temperature',
                        write: true,
                        def: device.temperatureSet,
                        type: 'number',
                    }, undefined);
                    this.createState(deviceInfo.name, '', 'insideTemperature', {
                        role: 'state',
                        write: false,
                        def: device.insideTemperature,
                        type: 'number',
                    }, undefined);
                    this.createState(deviceInfo.name, '', 'outTemperature', {
                        role: 'state',
                        write: false,
                        def: device.outTemperature,
                        type: 'number',
                    }, undefined);
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
                        type: 'string',
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
                        type: 'string',
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
                        type: 'string',
                    }, undefined);
                    this.createState(deviceInfo.name, '', 'ecoMode', {
                        role: 'state',
                        states: { 0: panasonic_comfort_cloud_client_1.EcoMode[0], 1: panasonic_comfort_cloud_client_1.EcoMode[1], 2: panasonic_comfort_cloud_client_1.EcoMode[2] },
                        write: true,
                        def: device.ecoMode,
                        type: 'string',
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
                        type: 'string',
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
                        type: 'string',
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
                        type: 'string',
                    }, undefined);
                    this.log.info(`Device ${deviceInfo.name} created.`);
                }
            })));
            this.log.debug('Device creation completed.');
        });
    }
    updateDevice(deviceName, stateName, state) {
        return __awaiter(this, void 0, void 0, function* () {
            if (stateName == 'guid') {
                return;
            }
            if (!state.ack) {
                const stateObj = yield this.getObjectAsync(`${deviceName}.${stateName}`);
                const stateCommon = stateObj === null || stateObj === void 0 ? void 0 : stateObj.common;
                if ((stateCommon === null || stateCommon === void 0 ? void 0 : stateCommon.write) == false) {
                    return;
                }
                const guidState = yield this.getStateAsync(`${deviceName}.guid`);
                this.log.debug(`Update device guid=${guidState === null || guidState === void 0 ? void 0 : guidState.val} state=${stateName}`);
                const parameters = {};
                parameters[stateName] = state.val;
                if (!(guidState === null || guidState === void 0 ? void 0 : guidState.val)) {
                    return;
                }
                try {
                    this.log.debug(`Set device parameter ${JSON.stringify(parameters)} for device ${guidState === null || guidState === void 0 ? void 0 : guidState.val}`);
                    yield comfortCloudClient.setParameters(guidState === null || guidState === void 0 ? void 0 : guidState.val, parameters);
                    this.log.debug(`Refresh device ${deviceName}`);
                    yield this.refreshDevice(guidState === null || guidState === void 0 ? void 0 : guidState.val, deviceName);
                }
                catch (error) {
                    yield this.handleClientError(error);
                }
            }
        });
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
    onStateChange(id, state) {
        return __awaiter(this, void 0, void 0, function* () {
            if (state) {
                const elements = id.split('.');
                const deviceName = elements[elements.length - 2];
                const stateName = elements[elements.length - 1];
                yield this.updateDevice(deviceName, stateName, state);
                // The state was changed
                this.log.info(`state ${id} changed: ${state.val} (ack = ${state.ack})`);
            }
            else {
                // The state was deleted
                this.log.info(`state ${id} deleted`);
            }
        });
    }
    handleClientError(error) {
        return __awaiter(this, void 0, void 0, function* () {
            this.log.debug('Try to handle error.');
            if (error instanceof panasonic_comfort_cloud_client_1.TokenExpiredError) {
                this.log.info(`Token of comfort cloud client expired. Trying to login again. Code=${error.code}. Stack: ${error.stack}`);
                this.setState('info.connection', false, true);
                yield comfortCloudClient.login(this.config.username, this.config.password);
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
        });
    }
    setupRefreshTimeout() {
        this.log.debug('setupRefreshTimeout');
        const refreshIntervalInMilliseconds = this.refreshIntervalInMinutes * 60 * 1000;
        this.log.debug(`refreshIntervalInMilliseconds=${refreshIntervalInMilliseconds}`);
        this.refreshTimeout = setTimeout(this.refreshTimeoutFunc.bind(this), refreshIntervalInMilliseconds);
    }
    refreshTimeoutFunc() {
        return __awaiter(this, void 0, void 0, function* () {
            this.log.debug(`refreshTimeoutFunc started.`);
            yield this.refreshDevices();
            this.setupRefreshTimeout();
        });
    }
}
if (module.parent) {
    // Export the constructor in compact mode
    module.exports = (options) => new PanasonicComfortCloud(options);
}
else {
    // otherwise start the instance directly
    ;
    (() => new PanasonicComfortCloud())();
}
