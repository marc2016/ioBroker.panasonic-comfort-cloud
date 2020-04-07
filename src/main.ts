/*
 * Created with @iobroker/create-adapter v1.16.0
 */

// The adapter-core module gives you access to the core ioBroker functions
// you need to create an adapter
import * as utils from '@iobroker/adapter-core'

import { $enum } from "ts-enum-util";
import { Device, Group, ComfortCloudClient, Parameters, Power, AirSwingLR, AirSwingUD, FanAutoMode, EcoMode, OperationMode } from 'panasonic-comfort-cloud-client'
import { scheduleJob } from 'node-schedule'
import * as _ from 'lodash'

// Load your modules here, e.g.:
// import * as fs from 'fs';

// Augment the adapter.config object with the actual types
// TODO: delete this in the next version
declare global {
    // eslint-disable-next-line @typescript-eslint/no-namespace
    namespace ioBroker {
        interface AdapterConfig {
            // Define the shape of your options here (recommended)
            username: string
            password: string

            // Or use a catch-all approach
            [key: string]: any
        }
    }
}

const comfortCloudClient = new ComfortCloudClient()

class PanasonicComfortCloud extends utils.Adapter {

    public constructor(options: Partial<ioBroker.AdapterOptions> = {}) {
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
    private async onReady(): Promise<void> {
        // Initialize your adapter here

        // The adapters config (in the instance object everything under the attribute 'native') is accessible via

        /*
        For every state in the system there has to be also an object of type state
        Here a simple template for a boolean variable named 'testVariable'
        Because every adapter instance uses its own unique namespace variable names can't collide with other adapters variables
        */

        var j = scheduleJob('*/5 * * * *', this.refreshDevices.bind(this));

        // in this template all states changes inside the adapters namespace are subscribed
        this.subscribeStates('*');

        await comfortCloudClient.login(this.config.username, this.config.password, 6)
        this.log.info("Login successful.")

        const groups = await comfortCloudClient.getGroups()
        this.createDevices(groups)

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
    }

    private async refreshDevices() {
        this.log.debug('refreshDevice was triggered.')
        const groups = await comfortCloudClient.getGroups()
        groups.forEach(group => {
            var devices = group.devices
            devices.forEach(device => {
                this.setStateChangedAsync(`${device.name}.guid`, device.guid, true)
                this.setStateChangedAsync(`${device.name}.operate`, device.operate, true)
                this.setStateChangedAsync(`${device.name}.temperatureSet`, device.operate, true)
                this.setStateChangedAsync(`${device.name}.airSwingLR`, device.operate, true)
                this.setStateChangedAsync(`${device.name}.airSwingUD`, device.operate, true)
                this.setStateChangedAsync(`${device.name}.fanAutoMode`, device.operate, true)
                this.setStateChangedAsync(`${device.name}.ecoMode`, device.operate, true)
            })
        });
    }

    private createDevices(groups: Array<Group>) {
        groups.forEach(group => {
            var devices = group.devices
            devices.forEach(device => {
                this.createDevice(device.name)
                this.createState(device.name, '', 'guid', { role: 'text', write: false, def: device.guid }, undefined)
                this.createState(device.name, '', 'operate', { role: 'state', states: { 0: Power[0], 1: Power[1] }, write: true, def: device.operate }, undefined)
                this.createState(device.name, '', 'temperatureSet', { role: 'level.temperature', write: true, def: device.temperatureSet }, undefined)
                this.createState(device.name, '', 'airSwingLR', { role: 'state', states: { 0: AirSwingLR[0], 1: AirSwingLR[1], 2: AirSwingLR[2], 3: AirSwingLR[3], 4: AirSwingLR[4], }, write: true, def: device.airSwingLR }, undefined)
                this.createState(device.name, '', 'airSwingUD', { role: 'state', states: { 0: AirSwingUD[0], 1: AirSwingUD[1], 2: AirSwingUD[2], 3: AirSwingUD[3], 4: AirSwingUD[4], }, write: true, def: device.airSwingUD }, undefined)
                this.createState(device.name, '', 'fanAutoMode', { role: 'state', states: { 0: FanAutoMode[0], 1: FanAutoMode[1], 2: FanAutoMode[2], 3: FanAutoMode[3], }, write: true, def: device.fanAutoMode }, undefined)
                this.createState(device.name, '', 'ecoMode', { role: 'state', states: { 0: EcoMode[0], 1: EcoMode[1], 2: EcoMode[2], }, write: true, def: device.ecoMode }, undefined)
                this.createState(device.name, '', 'operationMode', { role: 'state', states: { 0: OperationMode[0], 1: OperationMode[1], 2: OperationMode[2], 3: OperationMode[3], 4: OperationMode[4], }, write: true, def: device.operationMode }, undefined)
            })
        });
    }

    private async updateDevice(deviceName: string, stateName: string, state: ioBroker.State) {
        const guidState = await this.getStateAsync(`${deviceName}.guid`)
        this.log.debug(`guid=${guidState?.val} state=${state}`)
        const parameters: Parameters = {}
        parameters[stateName] = state.val
        await comfortCloudClient.setParameters(guidState?.val, parameters)
    }

    /**
     * Is called when adapter shuts down - callback has to be called under any circumstances!
     */
    private onUnload(callback: () => void): void {
        try {
            this.log.info('cleaned everything up...');
            callback();
        } catch (e) {
            callback();
        }
    }

    /**
     * Is called if a subscribed object changes
     */
    private onObjectChange(id: string, obj: ioBroker.Object | null | undefined): void {
        if (obj) {
            // The object was changed
            this.log.info(`object ${id} changed: ${JSON.stringify(obj)}`);
        } else {
            // The object was deleted
            this.log.info(`object ${id} deleted`);
        }
    }

    /**
     * Is called if a subscribed state changes
     */
    private onStateChange(id: string, state: ioBroker.State | null | undefined): void {
        if (state) {
            const elements = id.split('.')
            const deviceName = elements[elements.length - 2]
            const stateName = elements[elements.length - 1]
            this.updateDevice(deviceName, stateName, state)
            // The state was changed
            this.log.info(`state ${id} changed: ${state.val} (ack = ${state.ack})`);
        } else {
            // The state was deleted
            this.log.info(`state ${id} deleted`);
        }
    }

    // /**
    //  * Some message was sent to this instance over message box. Used by email, pushover, text2speech, ...
    //  * Using this method requires 'common.message' property to be set to true in io-package.json
    //  */
    // private onMessage(obj: ioBroker.Message): void {
    // 	if (typeof obj === 'object' && obj.message) {
    // 		if (obj.command === 'send') {
    // 			// e.g. send email or pushover or whatever
    // 			this.log.info('send command');

    // 			// Send response in callback if required
    // 			if (obj.callback) this.sendTo(obj.from, obj.command, 'Message received', obj.callback);
    // 		}
    // 	}
    // }

}

if (module.parent) {
    // Export the constructor in compact mode
    module.exports = (options: Partial<ioBroker.AdapterOptions> | undefined) => new PanasonicComfortCloud(options);
} else {
    // otherwise start the instance directly
    (() => new PanasonicComfortCloud())();
}