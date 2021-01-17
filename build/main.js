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
const node_schedule_1 = require("node-schedule");
const _ = require("lodash");
const comfortCloudClient = new panasonic_comfort_cloud_client_1.ComfortCloudClient();
class PanasonicComfortCloud extends utils.Adapter {
    constructor(options = {}) {
        super(Object.assign(Object.assign({}, options), { name: "panasonic-comfort-cloud" }));
        this.on("ready", this.onReady.bind(this));
        this.on("objectChange", this.onObjectChange.bind(this));
        this.on("stateChange", this.onStateChange.bind(this));
        // this.on('message', this.onMessage.bind(this));
        this.on("unload", this.onUnload.bind(this));
    }
    /**
     * Is called when databases are connected and adapter received configuration.
     */
    onReady() {
        var _a;
        return __awaiter(this, void 0, void 0, function* () {
            const refreshInterval = (_a = this.config.refreshInterval) !== null && _a !== void 0 ? _a : 5;
            this.refreshJob = node_schedule_1.scheduleJob(`*/${refreshInterval} * * * *`, this.refreshDevices.bind(this));
            this.subscribeStates("*");
            try {
                this.log.debug(`Try to login with username ${this.config.username}.`);
                yield comfortCloudClient.login(this.config.username, this.config.password);
                this.log.info("Login successful.");
                const groups = yield comfortCloudClient.getGroups();
                this.createDevices(groups);
            }
            catch (error) {
                this.handleClientError(error);
            }
        });
    }
    refreshDeviceStates(device) {
        this.log.debug(`Refresh device ${device.name}`);
        this.setStateChangedAsync(`${device.name}.guid`, device.guid, true);
        this.setStateChangedAsync(`${device.name}.operate`, device.operate, true);
        this.setStateChangedAsync(`${device.name}.temperatureSet`, device.temperatureSet, true);
        this.setStateChangedAsync(`${device.name}.airSwingLR`, device.airSwingLR, true);
        this.setStateChangedAsync(`${device.name}.airSwingUD`, device.airSwingUD, true);
        this.setStateChangedAsync(`${device.name}.fanAutoMode`, device.fanAutoMode, true);
        this.setStateChangedAsync(`${device.name}.ecoMode`, device.ecoMode, true);
        this.setStateChangedAsync(`${device.name}.operationMode`, device.operationMode, true);
        this.setStateChangedAsync(`${device.name}.fanSpeed`, device.fanSpeed, true);
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
                this.refreshDeviceStates(device);
            }
            catch (error) {
                this.handleClientError(error);
            }
        });
    }
    refreshDevices() {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                this.log.debug("Refresh all devices.");
                const groups = yield comfortCloudClient.getGroups();
                groups.forEach((group) => {
                    var devices = group.devices;
                    devices.forEach((device) => {
                        this.refreshDeviceStates(device);
                    });
                });
            }
            catch (error) {
                this.handleClientError(error);
            }
        });
    }
    createDevices(groups) {
        return __awaiter(this, void 0, void 0, function* () {
            const devices = yield this.getDevicesAsync();
            const names = _.map(devices, (value) => {
                return value.common.name;
            });
            groups.forEach((group) => {
                var devices = group.devices;
                devices.forEach((device) => {
                    if (_.includes(names, device.name)) {
                        return;
                    }
                    this.createDevice(device.name);
                    this.createState(device.name, "", "guid", { role: "text", write: false, def: device.guid }, undefined);
                    this.createState(device.name, "", "operate", {
                        role: "state",
                        states: { 0: panasonic_comfort_cloud_client_1.Power[0], 1: panasonic_comfort_cloud_client_1.Power[1] },
                        write: true,
                        def: device.operate,
                    }, undefined);
                    this.createState(device.name, "", "temperatureSet", {
                        role: "level.temperature",
                        write: true,
                        def: device.temperatureSet,
                    }, undefined);
                    this.createState(device.name, "", "airSwingLR", {
                        role: "state",
                        states: {
                            0: panasonic_comfort_cloud_client_1.AirSwingLR[0],
                            1: panasonic_comfort_cloud_client_1.AirSwingLR[1],
                            2: panasonic_comfort_cloud_client_1.AirSwingLR[2],
                            3: panasonic_comfort_cloud_client_1.AirSwingLR[3],
                            4: panasonic_comfort_cloud_client_1.AirSwingLR[4],
                        },
                        write: true,
                        def: device.airSwingLR,
                    }, undefined);
                    this.createState(device.name, "", "airSwingUD", {
                        role: "state",
                        states: {
                            0: panasonic_comfort_cloud_client_1.AirSwingUD[0],
                            1: panasonic_comfort_cloud_client_1.AirSwingUD[1],
                            2: panasonic_comfort_cloud_client_1.AirSwingUD[2],
                            3: panasonic_comfort_cloud_client_1.AirSwingUD[3],
                            4: panasonic_comfort_cloud_client_1.AirSwingUD[4],
                        },
                        write: true,
                        def: device.airSwingUD,
                    }, undefined);
                    this.createState(device.name, "", "fanAutoMode", {
                        role: "state",
                        states: {
                            0: panasonic_comfort_cloud_client_1.FanAutoMode[0],
                            1: panasonic_comfort_cloud_client_1.FanAutoMode[1],
                            2: panasonic_comfort_cloud_client_1.FanAutoMode[2],
                            3: panasonic_comfort_cloud_client_1.FanAutoMode[3],
                        },
                        write: true,
                        def: device.fanAutoMode,
                    }, undefined);
                    this.createState(device.name, "", "ecoMode", {
                        role: "state",
                        states: { 0: panasonic_comfort_cloud_client_1.EcoMode[0], 1: panasonic_comfort_cloud_client_1.EcoMode[1], 2: panasonic_comfort_cloud_client_1.EcoMode[2] },
                        write: true,
                        def: device.ecoMode,
                    }, undefined);
                    this.createState(device.name, "", "operationMode", {
                        role: "state",
                        states: {
                            0: panasonic_comfort_cloud_client_1.OperationMode[0],
                            1: panasonic_comfort_cloud_client_1.OperationMode[1],
                            2: panasonic_comfort_cloud_client_1.OperationMode[2],
                            3: panasonic_comfort_cloud_client_1.OperationMode[3],
                            4: panasonic_comfort_cloud_client_1.OperationMode[4],
                        },
                        write: true,
                        def: device.operationMode,
                    }, undefined);
                    this.createState(device.name, "", "fanSpeed", {
                        role: "state",
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
                    }, undefined);
                    this.log.info(`Device ${device.name} created.`);
                });
            });
        });
    }
    updateDevice(deviceName, stateName, state) {
        return __awaiter(this, void 0, void 0, function* () {
            if (!state.ack) {
                const guidState = yield this.getStateAsync(`${deviceName}.guid`);
                this.log.debug(`Update device guid=${guidState === null || guidState === void 0 ? void 0 : guidState.val} state=${state}`);
                const parameters = {};
                parameters[stateName] = state.val;
                if (!(guidState === null || guidState === void 0 ? void 0 : guidState.val)) {
                    return;
                }
                try {
                    yield comfortCloudClient.setParameters(guidState === null || guidState === void 0 ? void 0 : guidState.val, parameters);
                    yield this.refreshDevice(guidState === null || guidState === void 0 ? void 0 : guidState.val, deviceName);
                }
                catch (error) {
                    this.handleClientError(error);
                }
            }
        });
    }
    /**
     * Is called when adapter shuts down - callback has to be called under any circumstances!
     */
    onUnload(callback) {
        var _a;
        try {
            this.log.info("cleaned everything up...");
            (_a = this.refreshJob) === null || _a === void 0 ? void 0 : _a.cancel();
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
        if (state) {
            const elements = id.split(".");
            const deviceName = elements[elements.length - 2];
            const stateName = elements[elements.length - 1];
            this.updateDevice(deviceName, stateName, state);
            // The state was changed
            this.log.info(`state ${id} changed: ${state.val} (ack = ${state.ack})`);
        }
        else {
            // The state was deleted
            this.log.info(`state ${id} deleted`);
        }
    }
    handleClientError(error) {
        return __awaiter(this, void 0, void 0, function* () {
            this.log.debug("Try to handle error.");
            if (error instanceof panasonic_comfort_cloud_client_1.TokenExpiredError) {
                this.log.info(`Token of comfort cloud client expired. Trying to login again. Code=${error.code}`);
                yield comfortCloudClient.login(this.config.username, this.config.password);
                this.log.info("Login successful.");
            }
            else if (error instanceof panasonic_comfort_cloud_client_1.ServiceError) {
                this.log.error(`Service error: ${error.message}. Code=${error.code}`);
                this.disable();
            }
            else {
                this.log.error(`Unknown error: ${error}.`);
                this.disable();
            }
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
