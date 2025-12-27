/*
 * Created with @iobroker/create-adapter v1.16.0
 */

// The adapter-core module gives you access to the core ioBroker functions
// you need to create an adapter
import * as utils from '@iobroker/adapter-core'

import {
    Device,
    Group,
    ComfortCloudClient,
    Parameters,
    TokenExpiredError,
    ServiceError,
    DataMode,
} from 'panasonic-comfort-cloud-client'

import axios from 'axios'
import { deviceStates, readonlyStateNames, getHistoryStates } from './lib/state-definitions'

const REFRESH_INTERVAL_IN_MINUTES_DEFAULT = 5

class PanasonicComfortCloud extends utils.Adapter {

    private comfortCloudClient: ComfortCloudClient = new ComfortCloudClient()

    private refreshTimeout: NodeJS.Timeout | undefined
    private refreshHistoryTimeout: NodeJS.Timeout | undefined
    private refreshIntervalInMinutes = REFRESH_INTERVAL_IN_MINUTES_DEFAULT
    private readonly historyRefreshIntervalInMinutes = 60
    public constructor(options: Partial<utils.AdapterOptions> = {}) {
        super({
            ...options,
            name: 'panasonic-comfort-cloud',
        })

        this.on('ready', this.onReady.bind(this))
        this.on('objectChange', this.onObjectChange.bind(this))
        this.on('stateChange', this.onStateChange.bind(this))
        // this.on('message', this.onMessage.bind(this));
        this.on('unload', this.onUnload.bind(this))
    }

    /**
     * Is called when databases are connected and adapter received configuration.
     */
    private async onReady(): Promise<void> {
        this.refreshIntervalInMinutes = this.config?.refreshInterval ?? REFRESH_INTERVAL_IN_MINUTES_DEFAULT
        this.subscribeStates('*')

        await this.setStateAsync('info.connection', false, true);

        const loadedAppVersion = await this.getCurrentAppVersion()
        this.log.info(`Loaded app version from App store: ${loadedAppVersion}`)
        if(loadedAppVersion && this.trimAll(this.config?.appVersionFromAppStore) != this.trimAll(loadedAppVersion)) {
            this.updateConfig({ appVersionFromAppStore: this.trimAll(loadedAppVersion), password: this.encrypt(this.config?.password) }) 
            return
        }

        if(!this.config?.username || !this.config?.password) {
            this.log.error('Can not start without username or password. Please open config.')
        } else {
            if(this.config?.appVersionFromAppStore != '' && this.config?.useAppVersionFromAppStore)
            {
                this.log.debug(`Use AppVersion from App Store ${this.config?.appVersionFromAppStore}.`)
                this.comfortCloudClient = new ComfortCloudClient(this.config?.appVersionFromAppStore)
            }
            else if(this.config?.appVersion != '')
            {
                this.log.debug(`Use configured AppVersion ${this.config?.appVersion}.`)
                this.comfortCloudClient = new ComfortCloudClient(this.config?.appVersion)
            }
            else
            {
                this.log.debug(`Use default AppVersion.`)
                this.comfortCloudClient = new ComfortCloudClient()
            }

            try {
                this.log.debug(`Try to login with username ${this.config.username}.`)
                await this.comfortCloudClient.login(
                    this.config.username,
                    this.config.password
                )
                this.log.info('Login successful.')
                await this.setStateAsync('info.connection', true, true)
                this.log.debug('Create devices.')
                const groups = await this.comfortCloudClient.getGroups()
                await this.createDevices(groups)

                this.log.debug(`Automativ refresh is set to ${this.config?.automaticRefreshEnabled}.`)
                if(this.config?.automaticRefreshEnabled) {
                    this.setupRefreshTimeout()
                }

                if (this.config?.historyEnabled) {
                    this.log.debug(`History enabled. Refreshing history.`)
                    await this.refreshHistory(groups)
                    this.setupHistoryRefreshTimeout()
                }

            } catch (error) {
                await this.handleClientError(error)
            }
        }
    }

    private async refreshHistory(groups: Group[]): Promise<void> {
        const devicesFromService = groups.flatMap(g => g.devices)
        const deviceInfos = devicesFromService.map(d => { return {guid: d.guid, name: d.name}})

        for (const deviceInfo of deviceInfos) {
            const modes: Record<string, DataMode> = { 
                'day': DataMode.Day,
                'month': DataMode.Month
            };

            for (const [modeName, dataMode] of Object.entries(modes)) {
                try {
                    this.log.debug(`Fetching ${modeName} history for ${deviceInfo.name}`);
                    const history = await this.comfortCloudClient.getDeviceHistoryData(deviceInfo.guid, new Date(), dataMode);
                    
                    if (history && history.historyDataList) {
                        for (let i = 0; i < history.historyDataList.length; i++) {
                            const data = history.historyDataList[i];
                            const index = i.toString().padStart(2, '0');
                            const prefix = `${deviceInfo.name}.history.${modeName}.${index}`;
                            
                            await this.setStateChangedAsync(`${prefix}.dataTime`, this.formatHistoryDate(data.dataTime), true);
                            await this.setStateChangedAsync(`${prefix}.averageSettingTemp`, data.averageSettingTemp, true);
                            await this.setStateChangedAsync(`${prefix}.averageInsideTemp`, data.averageInsideTemp, true);
                            await this.setStateChangedAsync(`${prefix}.averageOutsideTemp`, data.averageOutsideTemp, true);
                            await this.setStateChangedAsync(`${prefix}.consumption`, data.consumption, true);
                            await this.setStateChangedAsync(`${prefix}.cost`, data.cost, true);
                            await this.setStateChangedAsync(`${prefix}.heatConsumptionRate`, data.heatConsumptionRate, true);
                            await this.setStateChangedAsync(`${prefix}.coolConsumptionRate`, data.coolConsumptionRate, true);

                            // Update current hour
                            if (modeName === 'day' && i === new Date().getHours()) {
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
                } catch(e) {
                    this.log.warn(`Failed to fetch history ${modeName} for ${deviceInfo.name}: ${e}`);
                }
            }
        }
    }

    private formatHistoryDate(dataTime: string): string {
        // Format YYYYMMDDHH to YYYY-MM-DD HH:mm:ss
        // or YYYYMMDD to YYYY-MM-DD
        if (dataTime.length === 10) {
            // YYYYMMDDHH
            const year = dataTime.substring(0, 4);
            const month = dataTime.substring(4, 6);
            const day = dataTime.substring(6, 8);
            const hour = dataTime.substring(8, 10);
            return `${year}-${month}-${day} ${hour}:00:00`;
        } else if (dataTime.length === 8) {
            // YYYYMMDD
            const year = dataTime.substring(0, 4);
            const month = dataTime.substring(4, 6);
            const day = dataTime.substring(6, 8);
            return `${year}-${month}-${day}`;
        }
        return dataTime;
    }

    private async refreshDeviceStates(device: Device): Promise<void> {
        this.log.debug(`Refresh device ${device.name} (${device.guid}).`)
        this.log.debug(`${device.name}: guid => ${device.guid}.`)
        
        for (const stateDef of deviceStates) {
            if (stateDef.id === 'guid') continue; // guid is special, not a state on the device object in the same way

            const value = (device as any)[stateDef.id];
            this.log.debug(`${device.name}: ${stateDef.id} => ${value}.`)
            
            if (value !== undefined) {
                await this.setStateChangedAsync(
                    `${device.name}.${stateDef.id}`,
                    value,
                    true
                )
            } else if (stateDef.id === 'connected') {
                // Connected is always true when we reached this point
                await this.setStateChangedAsync(
                    `${device.name}.connected`,
                    true,
                    true
                )
            }
        }
        this.log.debug(`Refresh device ${device.name} finished.`)
    }

    private async refreshDevice(guid: string, deviceName: string): Promise<void> {
        try {
            const device = await this.comfortCloudClient.getDevice(guid, deviceName)
            if (!device) {
                return
            }
            if (!device.name) {
                device.name = deviceName
            }
            await this.refreshDeviceStates(device)
        } catch (error) {
            await this.handleDeviceError(deviceName, error)
        }
    }

    private async refreshDevices(): Promise<void> {
        try {
            this.log.debug('Refresh all devices.')
            const groups = await this.comfortCloudClient.getGroups()
            await this.setStateAsync('info.connection', true, true);
            const devices = groups.flatMap(g => g.devices)
            const deviceInfos = devices.map(d => { return{guid: d.guid, name: d.name}})
            await Promise.all(deviceInfos.map(async (deviceInfo) => {
                try {
                    const device = await this.comfortCloudClient.getDevice(deviceInfo.guid, deviceInfo.name)
                    if(device != null) {
                        device.name = deviceInfo.name
                        device.guid = deviceInfo.guid
                        await this.refreshDeviceStates(device)
                    }
                } catch (error) {
                    await this.handleDeviceError(deviceInfo.name, error)
                }
            }))
        } catch (error) {
            await this.handleClientError(error)
        }
    }

    private async createDevices(groups: Array<Group>): Promise<void> {
        const devicesFromService = groups.flatMap(g => g.devices)
        const deviceInfos = devicesFromService.map(d => { return {guid: d.guid, name: d.name}})
        await Promise.all(deviceInfos.map(async (deviceInfo) => {
            this.log.debug(`Device info from group ${deviceInfo.guid}, ${deviceInfo.name}.`)
            let device: Device | null = null
            try {
                device = await this.comfortCloudClient.getDevice(deviceInfo.guid, deviceInfo.name)
            } catch(error) {
                await this.handleDeviceError(deviceInfo.name, error)
                return
            }
            
            if(device != null) {
                await this.setObjectNotExistsAsync(deviceInfo.name, {
                    type: 'device',
                    common: {
                        name: deviceInfo.name
                    },
                    native: {}
                });

                for (const stateDef of deviceStates) {
                    const common: ioBroker.StateCommon = {
                        name: stateDef.id,
                        role: stateDef.role,
                        write: stateDef.write,
                        type: stateDef.type as ioBroker.CommonType,
                        read: stateDef.read !== undefined ? stateDef.read : true, // default read to true
                        def: stateDef.id === 'guid' ? deviceInfo.guid : (stateDef.def !== undefined ? stateDef.def : (device as any)[stateDef.id]),
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

                this.log.info(`Device ${deviceInfo.name} created.`)

                if (this.config?.historyEnabled) {
                    await this.setObjectNotExistsAsync(`${deviceInfo.name}.history`, {
                        type: 'channel',
                        common: { name: 'History Data' },
                        native: {}
                    });

                    const historyStates = getHistoryStates();
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
        this.log.debug('Device creation completed.')
    }

    private async updateDevice(
        deviceName: string,
        stateName: string,
        state: ioBroker.State
    ): Promise<void> {
        if(readonlyStateNames.includes(stateName)) {
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
                await this.comfortCloudClient.setParameters(
                    guidState?.val as string,
                    parameters
                )
                this.log.debug(`Refresh device ${deviceName}`)
                await this.refreshDevice(guidState?.val as string, deviceName)
            } catch (error) {
                await this.handleClientError(error)
            }
        }
    }

    /**
     * Is called when adapter shuts down - callback has to be called under any circumstances!
     */
    private onUnload(callback: () => void): void {
        try {
            if(this.refreshTimeout)
                clearTimeout(this.refreshTimeout)
            if(this.refreshHistoryTimeout)
                clearTimeout(this.refreshHistoryTimeout)

            this.log.info('cleaned everything up...')
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
    private async onStateChange(
        id: string,
        state: ioBroker.State | null | undefined
    ): Promise<void> {
        if(!state || state.ack) {
            return
        }

        if(id.includes('.commands.')) {
            const elements = id.split('.')
            const stateName = elements[elements.length - 1]
            if(stateName == 'manualRefresh' && state.val) {
                try {
                    await this.refreshDevices()
                    await this.setStateAsync(id, state, true)
                } catch (error) {
                    await this.handleClientError(error)
                }
                await this.setStateAsync(id, false, true)
            } else if(stateName == 'refreshHistory' && state.val) {
                try {
                    const groups = await this.comfortCloudClient.getGroups()
                    await this.refreshHistory(groups)
                    await this.setStateAsync(id, state, true)
                } catch (error) {
                    await this.handleClientError(error)
                }
                await this.setStateAsync(id, false, true)
            }
        }
        else if (!id.includes('.info.')) {
            const elements = id.split('.')
            const deviceName = elements[elements.length - 2]
            const stateName = elements[elements.length - 1]
            try {
                await this.updateDevice(deviceName, stateName, state)    
            } catch (error) {
                await this.handleClientError(error)
            }
            
            // The state was changed
            this.log.info(
                `state ${id} changed: ${state.val} (ack = ${state.ack})`
            )
        }
    }

    private async getCurrentAppVersion() : Promise<string> {
        const response = await axios.get('https://itunes.apple.com/lookup?id=1348640525')
        if(response.status !== 200)
            return ''
        const version = await response.data.results[0].version
        return version
    }

    private async handleDeviceError(deviceName: string, error: unknown): Promise<void> {
        this.log.debug(`Try to handle device error for ${deviceName}.`)

        await this.setStateChangedAsync(
            `${deviceName}.connected`,
            false,
            true
        )
        
        if (error instanceof ServiceError) {
            this.log.error(
                `Service error when connecting to device ${deviceName}: ${error.message}. Code=${error.code}. Stack: ${error.stack}`
            )
        } else if (error instanceof Error){
            this.log.error(`Unknown error when connecting to device ${deviceName}: ${error}. Stack: ${error.stack}`)
        }
    }

    private async handleClientError(error: unknown): Promise<void> {
        this.log.debug('Try to handle error.')
        
        if (error instanceof TokenExpiredError) {
            this.log.info(
                `Token of comfort cloud client expired. Trying to login again. Code=${error.code}. Stack: ${error.stack}`
            )
            await this.setStateAsync('info.connection', false, true);
            await this.comfortCloudClient.login(
                this.config.username,
                this.config.password
            )
            await this.setStateAsync('info.connection', true, true);
            this.log.info('Login successful.')
        } else if (error instanceof ServiceError) {
            await this.setStateAsync('info.connection', false, true);
            this.log.error(
                `Service error: ${error.message}. Code=${error.code}. Stack: ${error.stack}`
            )
        } else if (error instanceof Error){
            this.log.error(`Unknown error: ${error}. Stack: ${error.stack}`)
        }
    }

    private setupRefreshTimeout(): void {
        this.log.debug('setupRefreshTimeout')
        const refreshIntervalInMilliseconds = this.refreshIntervalInMinutes * 60 * 1000
        this.log.debug(`refreshIntervalInMilliseconds=${refreshIntervalInMilliseconds}`)
        this.refreshTimeout = setTimeout(this.refreshTimeoutFunc.bind(this), refreshIntervalInMilliseconds);
    }

    private async refreshTimeoutFunc(): Promise<void> {
        this.log.debug(`refreshTimeoutFunc started.`)
        try {
            await this.refreshDevices()
            this.setupRefreshTimeout()
        } catch (error) {
            await this.handleClientError(error)
        }
        
    }

    private setupHistoryRefreshTimeout(): void {
        this.log.debug('setupHistoryRefreshTimeout')
        const refreshIntervalInMilliseconds = this.historyRefreshIntervalInMinutes * 60 * 1000
        this.refreshHistoryTimeout = setTimeout(this.refreshHistoryTimeoutFunc.bind(this), refreshIntervalInMilliseconds);
    }

    private async refreshHistoryTimeoutFunc(): Promise<void> {
        this.log.debug(`refreshHistoryTimeoutFunc started.`)
        try {
            if (this.config?.historyEnabled) {
                const groups = await this.comfortCloudClient.getGroups()
                await this.refreshHistory(groups)
            }
            this.setupHistoryRefreshTimeout()
        } catch (error) {
            this.log.warn(`Failed to refresh history: ${error}`)
            // Retry later even on error
            this.setupHistoryRefreshTimeout() 
        }
    }

    private trimAll(text: string): string {
        const newText = text.trim().replace(/(\r\n|\n|\r)/gm, '');
        return newText
    }
}

if (module.parent) {
    // Export the constructor in compact mode
    module.exports = (options: Partial<utils.AdapterOptions> | undefined) =>
        new PanasonicComfortCloud(options)
} else {
    // otherwise start the instance directly
    (() => new PanasonicComfortCloud())()
}
