/*
 * Created with @iobroker/create-adapter v1.16.0
 */

// The adapter-core module gives you access to the core ioBroker functions
// you need to create an adapter
import * as utils from "@iobroker/adapter-core"

import {
    Device,
    Group,
    ComfortCloudClient,
    Parameters,
    Power,
    AirSwingLR,
    AirSwingUD,
    FanAutoMode,
    EcoMode,
    OperationMode,
    FanSpeed,
    TokenExpiredError,
    ServiceError,
    NanoeMode
} from "panasonic-comfort-cloud-client"
import { scheduleJob, Job } from "node-schedule"
import * as _ from "lodash"

declare global {
    // eslint-disable-next-line @typescript-eslint/no-namespace
    namespace ioBroker {
        interface AdapterConfig {
            // Define the shape of your options here (recommended)
            username: string
            password: string
            refreshInterval: number

            // Or use a catch-all approach
            [key: string]: any
        }
    }
}

const comfortCloudClient = new ComfortCloudClient()

class PanasonicComfortCloud extends utils.Adapter {
    private refreshJob: Job | undefined

    public constructor(options: Partial<utils.AdapterOptions> = {}) {
        super({
            ...options,
            name: "panasonic-comfort-cloud",
        })
        this.on("ready", this.onReady.bind(this))
        this.on("objectChange", this.onObjectChange.bind(this))
        this.on("stateChange", this.onStateChange.bind(this))
        // this.on('message', this.onMessage.bind(this));
        this.on("unload", this.onUnload.bind(this))
    }

    /**
     * Is called when databases are connected and adapter received configuration.
     */
    private async onReady(): Promise<void> {
        const refreshInterval = this.config.refreshInterval ?? 5
        this.refreshJob = scheduleJob(
            `*/${refreshInterval} * * * *`,
            this.refreshDevices.bind(this)
        )

        this.subscribeStates("*")

        try {
            this.log.debug(`Try to login with username ${this.config.username}.`)
            await comfortCloudClient.login(
                this.config.username,
                this.config.password
            )
            this.log.info("Login successful.")
            this.log.debug("Create devices.")
            const groups = await comfortCloudClient.getGroups()
            this.createDevices(groups)
        } catch (error) {
            this.handleClientError(error)
        }
    }

    private refreshDeviceStates(device: Device) {
        this.log.debug(`Refresh device ${device.name} (${device.guid}).`)
        this.log.debug(`${device.name}: guid => ${device.guid}.`)
        this.setStateChangedAsync(`${device.name}.guid`, device.guid, true)
        this.log.debug(`${device.name}: operate => ${device.operate}.`)
        this.setStateChangedAsync(
            `${device.name}.operate`,
            device.operate,
            true
        )
        this.log.debug(`${device.name}: temperatureSet => ${device.temperatureSet}.`)
        this.setStateChangedAsync(
            `${device.name}.temperatureSet`,
            device.temperatureSet,
            true
        )
        this.log.debug(`${device.name}: insideTemperature => ${device.insideTemperature}.`)
        this.setStateChangedAsync(
            `${device.name}.insideTemperature`,
            device.insideTemperature,
            true
        )
        this.log.debug(`${device.name}: outTemperature => ${device.outTemperature}.`)
        this.setStateChangedAsync(
            `${device.name}.outTemperature`,
            device.outTemperature,
            true
        )
        this.log.debug(`${device.name}: airSwingLR => ${device.airSwingLR}.`)
        this.setStateChangedAsync(
            `${device.name}.airSwingLR`,
            device.airSwingLR,
            true
        )
        this.log.debug(`${device.name}: airSwingUD => ${device.airSwingUD}.`)
        this.setStateChangedAsync(
            `${device.name}.airSwingUD`,
            device.airSwingUD,
            true
        )
        this.log.debug(`${device.name}: fanAutoMode => ${device.fanAutoMode}.`)
        this.setStateChangedAsync(
            `${device.name}.fanAutoMode`,
            device.fanAutoMode,
            true
        )
        this.log.debug(`${device.name}: ecoMode => ${device.ecoMode}.`)
        this.setStateChangedAsync(
            `${device.name}.ecoMode`,
            device.ecoMode,
            true
        )
        this.log.debug(`${device.name}: operationMode => ${device.operationMode}.`)
        this.setStateChangedAsync(
            `${device.name}.operationMode`,
            device.operationMode,
            true
        )
        this.log.debug(`${device.name}: fanSpeed => ${device.fanSpeed}.`)
        this.setStateChangedAsync(
            `${device.name}.fanSpeed`,
            device.fanSpeed,
            true
        )
        this.log.debug(`${device.name}: actualNanoe => ${device.actualNanoe}.`)
        this.setStateChangedAsync(
            `${device.name}.actualNanoe`,
            device.actualNanoe,
            true
        )
        this.log.debug(`Refresh device ${device.name} finished.`)
    }

    private async refreshDevice(guid: string, deviceName: string) {
        try {
            const device = await comfortCloudClient.getDevice(guid)
            if (!device) {
                return
            }
            if (!device.name) {
                device.name = deviceName
            }
            this.refreshDeviceStates(device)
        } catch (error) {
            this.handleClientError(error)
        }
    }

    private async refreshDevices() {
        try {
            this.log.debug("Refresh all devices.")
            const groups = await comfortCloudClient.getGroups()
            const devices = _.flatMap(groups, g => g.devices)
            const deviceInfos = _.map(devices, d => { return{guid: d.guid, name: d.name}})
            await Promise.all(deviceInfos.map(async (deviceInfo) => {
                const device = await comfortCloudClient.getDevice(deviceInfo.guid)
                if(device != null) {
                    device.name = deviceInfo.name
                    device.guid = deviceInfo.guid
                    this.refreshDeviceStates(device)
                }
            }));
        } catch (error) {
            this.handleClientError(error)
        }
    }

    private async createDevices(groups: Array<Group>) {
        const devices = await this.getDevicesAsync()
        const names = _.map(devices, (value) => {
            return value.common.name
        })
        const devicesFromService = _.flatMap(groups, g => g.devices)
        const deviceInfos = _.map(devicesFromService, d => { return {guid: d.guid, name: d.name}})
        await Promise.all(deviceInfos.map(async (deviceInfo) => {
            this.log.debug(`Device info from group ${deviceInfo.guid}, ${deviceInfo.name}.`)
            const device = await comfortCloudClient.getDevice(deviceInfo.guid)
            if(device != null) {
                if (_.includes(names, deviceInfo.name)) {
                    return
                }
                this.createDevice(deviceInfo.name)
                this.createState(
                    deviceInfo.name,
                    "",
                    "guid",
                    { role: "text", write: false, def: deviceInfo.guid, type: "string" },
                    undefined
                )
                this.createState(
                    deviceInfo.name,
                    "",
                    "operate",
                    {
                        role: "state",
                        states: { 0: Power[0], 1: Power[1] },
                        write: true,
                        def: device.operate,
                        type: "array",
                    },
                    undefined
                )
                this.createState(
                    deviceInfo.name,
                    "",
                    "temperatureSet",
                    {
                        role: "level.temperature",
                        write: true,
                        def: device.temperatureSet,
                        type: "number",
                    },
                    undefined
                )
                this.createState(
                    deviceInfo.name,
                    "",
                    "insideTemperature",
                    {
                        role: "state",
                        write: false,
                        def: device.insideTemperature,
                        type: "number",
                    },
                    undefined
                )
                this.createState(
                    deviceInfo.name,
                    "",
                    "outTemperature",
                    {
                        role: "state",
                        write: false,
                        def: device.outTemperature,
                        type: "number",
                    },
                    undefined
                )
                this.createState(
                    deviceInfo.name,
                    "",
                    "airSwingLR",
                    {
                        role: "state",
                        states: {
                            0: AirSwingLR[0],
                            1: AirSwingLR[1],
                            2: AirSwingLR[2],
                            3: AirSwingLR[3],
                            4: AirSwingLR[4],
                        },
                        write: true,
                        def: device.airSwingLR,
                        type: "array",
                    },
                    undefined
                )
                this.createState(
                    deviceInfo.name,
                    "",
                    "airSwingUD",
                    {
                        role: "state",
                        states: {
                            0: AirSwingUD[0],
                            1: AirSwingUD[1],
                            2: AirSwingUD[2],
                            3: AirSwingUD[3],
                            4: AirSwingUD[4],
                        },
                        write: true,
                        def: device.airSwingUD,
                        type: "array",
                    },
                    undefined
                )
                this.createState(
                    deviceInfo.name,
                    "",
                    "fanAutoMode",
                    {
                        role: "state",
                        states: {
                            0: FanAutoMode[0],
                            1: FanAutoMode[1],
                            2: FanAutoMode[2],
                            3: FanAutoMode[3],
                        },
                        write: true,
                        def: device.fanAutoMode,
                        type: "array",
                    },
                    undefined
                )
                this.createState(
                    deviceInfo.name,
                    "",
                    "ecoMode",
                    {
                        role: "state",
                        states: { 0: EcoMode[0], 1: EcoMode[1], 2: EcoMode[2] },
                        write: true,
                        def: device.ecoMode,
                        type: "array",
                    },
                    undefined
                )
                this.createState(
                    deviceInfo.name,
                    "",
                    "operationMode",
                    {
                        role: "state",
                        states: {
                            0: OperationMode[0],
                            1: OperationMode[1],
                            2: OperationMode[2],
                            3: OperationMode[3],
                            4: OperationMode[4],
                        },
                        write: true,
                        def: device.operationMode,
                        type: "array",
                    },
                    undefined
                )
                this.createState(
                    deviceInfo.name,
                    "",
                    "fanSpeed",
                    {
                        role: "state",
                        states: {
                            0: FanSpeed[0],
                            1: FanSpeed[1],
                            2: FanSpeed[2],
                            3: FanSpeed[3],
                            4: FanSpeed[4],
                            5: FanSpeed[5],
                        },
                        write: true,
                        def: device.fanSpeed,
                        type: "array",
                    },
                    undefined
                )
                this.createState(
                    deviceInfo.name,
                    "",
                    "actualNanoe",
                    {
                        role: "state",
                        states: {
                            0: NanoeMode[0],
                            1: NanoeMode[1],
                            2: NanoeMode[2],
                            3: NanoeMode[3],
                            4: NanoeMode[4],
                        },
                        write: true,
                        def: device.actualNanoe,
                        type: "array",
                    },
                    undefined
                )

                this.log.info(`Device ${deviceInfo.name} created.`)
            }
        }));
        this.log.debug("Device creation completed.")
    }

    private async updateDevice(
        deviceName: string,
        stateName: string,
        state: ioBroker.State
    ) {
        if(stateName == 'guid') {
            return
        }
        if (!state.ack) {
            const stateObj = await this.getObjectAsync(`${deviceName}.${stateName}`)
            const stateCommon = stateObj?.common as ioBroker.StateCommon
            if(stateCommon?.write == false) {
                return
            }

            const guidState = await this.getStateAsync(`${deviceName}.guid`)
            
            this.log.debug(
                `Update device guid=${guidState?.val} state=${stateName}`
            )
            const parameters: Parameters = {}
            parameters[stateName] = state.val
            if (!guidState?.val) {
                return
            }
            try {
                this.log.debug(`Set device parameter ${JSON.stringify(parameters)} for device ${guidState?.val}`)
                await comfortCloudClient.setParameters(
                    guidState?.val as string,
                    parameters
                )
                this.log.debug(`Refresh device ${deviceName}`)
                await this.refreshDevice(guidState?.val as string, deviceName)
            } catch (error) {
                this.handleClientError(error)
            }
        }
    }

    /**
     * Is called when adapter shuts down - callback has to be called under any circumstances!
     */
    private onUnload(callback: () => void): void {
        try {
            this.log.info("cleaned everything up...")
            this.refreshJob?.cancel()
            callback()
        } catch (e) {
            callback()
        }
    }

    /**
     * Is called if a subscribed object changes
     */
    private onObjectChange(
        id: string,
        obj: ioBroker.Object | null | undefined
    ): void {
        if (obj) {
            // The object was changed
            this.log.info(`object ${id} changed: ${JSON.stringify(obj)}`)
        } else {
            // The object was deleted
            this.log.info(`object ${id} deleted`)
        }
    }

    /**
     * Is called if a subscribed state changes
     */
    private onStateChange(
        id: string,
        state: ioBroker.State | null | undefined
    ): void {
        if (state) {
            const elements = id.split(".")
            const deviceName = elements[elements.length - 2]
            const stateName = elements[elements.length - 1]
            this.updateDevice(deviceName, stateName, state)
            // The state was changed
            this.log.info(
                `state ${id} changed: ${state.val} (ack = ${state.ack})`
            )
        } else {
            // The state was deleted
            this.log.info(`state ${id} deleted`)
        }
    }

    private async handleClientError(error: Error) {
        this.log.debug("Try to handle error.")
        
        if (error instanceof TokenExpiredError) {
            this.log.info(
                `Token of comfort cloud client expired. Trying to login again. Code=${error.code}. Stack: ${error.stack}`
            )
            await comfortCloudClient.login(
                this.config.username,
                this.config.password
            )
            this.log.info("Login successful.")
        } else if (error instanceof ServiceError) {
            this.log.error(
                `Service error: ${error.message}. Code=${error.code}. Stack: ${error.stack}`
            )
        } else {
            this.log.error(`Unknown error: ${error}. Stack: ${error.stack}`)
        }
    }
}

if (module.parent) {
    // Export the constructor in compact mode
    module.exports = (options: Partial<utils.AdapterOptions> | undefined) =>
        new PanasonicComfortCloud(options)
} else {
    // otherwise start the instance directly
    ;(() => new PanasonicComfortCloud())()
}
