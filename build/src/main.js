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
        return __awaiter(this, void 0, void 0, function* () {
            // Initialize your adapter here
            // The adapters config (in the instance object everything under the attribute 'native') is accessible via
            /*
            For every state in the system there has to be also an object of type state
            Here a simple template for a boolean variable named 'testVariable'
            Because every adapter instance uses its own unique namespace variable names can't collide with other adapters variables
            */
            var j = node_schedule_1.scheduleJob("*/5 * * * *", this.refreshDevices.bind(this));
            // in this template all states changes inside the adapters namespace are subscribed
            this.subscribeStates("*");
            yield comfortCloudClient.login(this.config.username, this.config.password, 6);
            this.log.info("Login successful.");
            const groups = yield comfortCloudClient.getGroups();
            this.createDevices(groups);
            // /*
            // setState examples
            // you will notice that each setState will cause the stateChange event to fire (because of above subscribeStates cmd)
            // */
            // // the variable testVariable is set to true as command (ack=false)
            // await this.setStateAsync('testVariable', true);
            // // same thing, but the value is flagged 'ack'
            // // ack should be always set to true if the value is received from or acknowledged from the target system
            // await this.setStateAsync('testVariable', { val: true, ack: true });
            // // same thing, but the state is deleted after 30s (getState will return null afterwards)
            // await this.setStateAsync('testVariable', { val: true, ack: true, expire: 30 });
            // // examples for the checkPassword/checkGroup functions
            // let result = await this.checkPasswordAsync('admin', 'iobroker');
            // this.log.info('check user admin pw ioboker: ' + result);
            // result = await this.checkGroupAsync('admin', 'admin');
            // this.log.info('check group user admin group admin: ' + result);
        });
    }
    refreshDevices() {
        return __awaiter(this, void 0, void 0, function* () {
            this.log.debug("refreshDevice was triggered.");
            const groups = yield comfortCloudClient.getGroups();
            groups.forEach((group) => {
                var devices = group.devices;
                devices.forEach((device) => {
                    this.setStateChangedAsync(`${device.name}.guid`, device.guid, true);
                    this.setStateChangedAsync(`${device.name}.operate`, device.operate, true);
                    this.setStateChangedAsync(`${device.name}.temperatureSet`, device.temperatureSet, true);
                    this.setStateChangedAsync(`${device.name}.airSwingLR`, device.airSwingLR, true);
                    this.setStateChangedAsync(`${device.name}.airSwingUD`, device.airSwingUD, true);
                    this.setStateChangedAsync(`${device.name}.fanAutoMode`, device.fanAutoMode, true);
                    this.setStateChangedAsync(`${device.name}.ecoMode`, device.ecoMode, true);
                });
            });
        });
    }
    createDevices(groups) {
        groups.forEach((group) => {
            var devices = group.devices;
            devices.forEach((device) => {
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
            });
        });
    }
    updateDevice(deviceName, stateName, state) {
        return __awaiter(this, void 0, void 0, function* () {
            const guidState = yield this.getStateAsync(`${deviceName}.guid`);
            this.log.debug(`guid=${guidState === null || guidState === void 0 ? void 0 : guidState.val} state=${state}`);
            const parameters = {};
            parameters[stateName] = state.val;
            yield comfortCloudClient.setParameters(guidState === null || guidState === void 0 ? void 0 : guidState.val, parameters);
        });
    }
    /**
     * Is called when adapter shuts down - callback has to be called under any circumstances!
     */
    onUnload(callback) {
        try {
            this.log.info("cleaned everything up...");
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
