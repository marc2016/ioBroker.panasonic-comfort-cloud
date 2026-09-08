/*
 * Created with @iobroker/create-adapter v1.16.0
 */

// The adapter-core module gives you access to the core ioBroker functions
// you need to create an adapter
import * as utils from '@iobroker/adapter-core';

import type { Device, Group, Parameters } from 'panasonic-comfort-cloud-client';
import { ComfortCloudClient, TokenExpiredError, ServiceError, DataMode } from 'panasonic-comfort-cloud-client';

import axios from 'axios';
import { deviceStates, readonlyStateNames, getHistoryStates } from './lib/state-definitions';

const REFRESH_INTERVAL_IN_MINUTES_DEFAULT = 5;

class PanasonicComfortCloud extends utils.Adapter {
    private comfortCloudClient: ComfortCloudClient = new ComfortCloudClient();

    private refreshTimeout: ioBroker.Timeout | undefined;
    private refreshHistoryTimeout: ioBroker.Timeout | undefined;
    private refreshIntervalInMinutes = REFRESH_INTERVAL_IN_MINUTES_DEFAULT;
    private readonly historyRefreshIntervalInMinutes = 15;
    private deviceRefreshInProgress = false;
    private historyRefreshInProgress = false;
    private consecutiveRefreshErrors = 0;
    private reauthenticationPromise: Promise<void> | undefined;
    public constructor(options: Partial<utils.AdapterOptions> = {}) {
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
        this.refreshIntervalInMinutes = this.config?.refreshInterval ?? REFRESH_INTERVAL_IN_MINUTES_DEFAULT;
        this.subscribeStates('*');

        await this.ensureDiagnosticStates();
        await this.setStateAsync('info.connection', false, true);
        await this.setStateAsync('info.refreshInProgress', false, true);
        await this.setStateAsync('info.historyRefreshInProgress', false, true);

        const loadedAppVersion = await this.getCurrentAppVersion();
        this.log.info(`Loaded app version from App store: ${loadedAppVersion}`);
        if (loadedAppVersion && this.trimAll(this.config?.appVersionFromAppStore) != this.trimAll(loadedAppVersion)) {
            this.updateConfig({
                appVersionFromAppStore: this.trimAll(loadedAppVersion),
                password: this.encrypt(this.config?.password),
            });
            return;
        }

        if (!this.config?.username || !this.config?.password) {
            this.log.error('Can not start without username or password. Please open config.');
        } else {
            if (this.config?.appVersionFromAppStore != '' && this.config?.useAppVersionFromAppStore) {
                this.log.debug(`Use AppVersion from App Store ${this.config?.appVersionFromAppStore}.`);
                this.comfortCloudClient = new ComfortCloudClient(this.config?.appVersionFromAppStore);
            } else if (this.config?.appVersion != '') {
                this.log.debug(`Use configured AppVersion ${this.config?.appVersion}.`);
                this.comfortCloudClient = new ComfortCloudClient(this.config?.appVersion);
            } else {
                this.log.debug(`Use default AppVersion.`);
                this.comfortCloudClient = new ComfortCloudClient();
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
            } catch (error) {
                await this.handleClientError(error);
            }
        }
    }

    private async refreshHistory(groups: Group[]): Promise<void> {
        if (this.historyRefreshInProgress) {
            this.log.debug('Skip history refresh because another history refresh is still running.');
            return;
        }

        this.historyRefreshInProgress = true;
        await this.setStateAsync('info.historyRefreshInProgress', true, true);
        await this.setStateAsync('info.lastHistoryRefreshAttempt', new Date().toISOString(), true);

        try {
            const devicesFromService = groups.flatMap(g => g.devices);
            const deviceInfos = devicesFromService.map(d => {
                return { guid: d.guid, name: d.name };
            });

            for (const deviceInfo of deviceInfos) {
                const modes: Record<string, DataMode> = {
                    day: DataMode.Day,
                    month: DataMode.Month,
                };

                for (const [modeName, dataMode] of Object.entries(modes)) {
                    try {
                        this.log.debug(`Fetching ${modeName} history for ${deviceInfo.name}`);
                        const history = await this.withTokenRetry(
                            () => this.comfortCloudClient.getDeviceHistoryData(deviceInfo.guid, new Date(), dataMode),
                            `fetch ${modeName} history for ${deviceInfo.name}`,
                        );

                        if (history && history.historyDataList) {
                            let latestData: any = null;
                            for (let i = 0; i < history.historyDataList.length; i++) {
                                const data = history.historyDataList[i];
                                const index = i.toString().padStart(2, '0');
                                const prefix = `${deviceInfo.name}.history.${modeName}.${index}`;

                                await this.setStateChangedIfDefinedAsync(
                                    `${prefix}.dataTime`,
                                    this.formatHistoryDate(data.dataTime),
                                    true,
                                );
                                await this.setStateChangedIfDefinedAsync(
                                    `${prefix}.averageSettingTemp`,
                                    data.averageSettingTemp,
                                    true,
                                );
                                await this.setStateChangedIfDefinedAsync(
                                    `${prefix}.averageInsideTemp`,
                                    data.averageInsideTemp,
                                    true,
                                );
                                await this.setStateChangedIfDefinedAsync(
                                    `${prefix}.averageOutsideTemp`,
                                    data.averageOutsideTemp,
                                    true,
                                );
                                await this.setStateChangedIfDefinedAsync(
                                    `${prefix}.consumption`,
                                    data.consumption,
                                    true,
                                );
                                await this.setStateChangedIfDefinedAsync(`${prefix}.cost`, data.cost, true);
                                await this.setStateChangedIfDefinedAsync(
                                    `${prefix}.heatConsumptionRate`,
                                    data.heatConsumptionRate,
                                    true,
                                );
                                await this.setStateChangedIfDefinedAsync(
                                    `${prefix}.coolConsumptionRate`,
                                    data.coolConsumptionRate,
                                    true,
                                );

                                // Update current hour
                                // We use the latest available data for "current" to handle API lag
                                // The API returns -255 for future/invalid values, so we must filter those out
                                if (modeName === 'day') {
                                    if (data.consumption !== -255) {
                                        if (!latestData || data.dataTime > latestData.dataTime) {
                                            latestData = data;
                                        }
                                    }

                                    // Update lastHour
                                    // We check if the data entry corresponds to the previous hour
                                    const currentHour = new Date().getHours();
                                    const previousHour = currentHour === 0 ? 23 : currentHour - 1;
                                    // Only check for same day previous hour (0-23 if same day, or 23 if we had yesterday's data but we don't here)
                                    // Since we only requested TODAY's data, we can only fill lastHour if previousHour >= 0 AND it is same day.
                                    // Limitation: At 00:xx we probably won't find data for 23:xx of yesterday because we only fetched today.
                                    if (currentHour > 0) {
                                        let hourStr = '';
                                        if (data.dataTime.length === 10) {
                                            // YYYYMMDDHH
                                            hourStr = data.dataTime.substring(8, 10);
                                        } else if (data.dataTime.length === 11) {
                                            // YYYYMMDD HH
                                            hourStr = data.dataTime.substring(9, 11);
                                        }

                                        const dataHour = parseInt(hourStr, 10);
                                        if (dataHour === previousHour) {
                                            const lastHourPrefix = `${deviceInfo.name}.history.lastHour`;
                                            await this.setStateChangedIfDefinedAsync(
                                                `${lastHourPrefix}.dataTime`,
                                                this.formatHistoryDate(data.dataTime),
                                                true,
                                            );
                                            await this.setStateChangedIfDefinedAsync(
                                                `${lastHourPrefix}.averageSettingTemp`,
                                                data.averageSettingTemp,
                                                true,
                                            );
                                            await this.setStateChangedIfDefinedAsync(
                                                `${lastHourPrefix}.averageInsideTemp`,
                                                data.averageInsideTemp,
                                                true,
                                            );
                                            await this.setStateChangedIfDefinedAsync(
                                                `${lastHourPrefix}.averageOutsideTemp`,
                                                data.averageOutsideTemp,
                                                true,
                                            );
                                            await this.setStateChangedIfDefinedAsync(
                                                `${lastHourPrefix}.consumption`,
                                                data.consumption,
                                                true,
                                            );
                                            await this.setStateChangedIfDefinedAsync(
                                                `${lastHourPrefix}.cost`,
                                                data.cost,
                                                true,
                                            );
                                            await this.setStateChangedIfDefinedAsync(
                                                `${lastHourPrefix}.heatConsumptionRate`,
                                                data.heatConsumptionRate,
                                                true,
                                            );
                                            await this.setStateChangedIfDefinedAsync(
                                                `${lastHourPrefix}.coolConsumptionRate`,
                                                data.coolConsumptionRate,
                                                true,
                                            );
                                        }
                                    }
                                }
                            }

                            if (modeName === 'day' && latestData) {
                                this.log.debug(
                                    `Updating history.current using latest available data: ${latestData.dataTime}`,
                                );
                                const currentPrefix = `${deviceInfo.name}.history.current`;
                                // User requested minute precision for the timestamp to track updates
                                // We use current system time to indicate WHEN we fetched this value
                                const now = new Date();
                                const formattedTime = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

                                await this.setStateChangedIfDefinedAsync(
                                    `${currentPrefix}.dataTime`,
                                    formattedTime,
                                    true,
                                );
                                await this.setStateChangedIfDefinedAsync(
                                    `${currentPrefix}.averageSettingTemp`,
                                    latestData.averageSettingTemp,
                                    true,
                                );
                                await this.setStateChangedIfDefinedAsync(
                                    `${currentPrefix}.averageInsideTemp`,
                                    latestData.averageInsideTemp,
                                    true,
                                );
                                await this.setStateChangedIfDefinedAsync(
                                    `${currentPrefix}.averageOutsideTemp`,
                                    latestData.averageOutsideTemp,
                                    true,
                                );
                                await this.setStateChangedIfDefinedAsync(
                                    `${currentPrefix}.consumption`,
                                    latestData.consumption,
                                    true,
                                );
                                await this.setStateChangedIfDefinedAsync(
                                    `${currentPrefix}.cost`,
                                    latestData.cost,
                                    true,
                                );
                                await this.setStateChangedIfDefinedAsync(
                                    `${currentPrefix}.heatConsumptionRate`,
                                    latestData.heatConsumptionRate,
                                    true,
                                );
                                await this.setStateChangedIfDefinedAsync(
                                    `${currentPrefix}.coolConsumptionRate`,
                                    latestData.coolConsumptionRate,
                                    true,
                                );
                            }
                        }
                    } catch (e) {
                        this.log.warn(`Failed to fetch history ${modeName} for ${deviceInfo.name}: ${String(e)}`);
                    }
                }
            }

            await this.setStateAsync('info.lastSuccessfulHistoryRefresh', new Date().toISOString(), true);
        } finally {
            this.historyRefreshInProgress = false;
            await this.setStateAsync('info.historyRefreshInProgress', false, true);
        }
    }

    private async setStateChangedIfDefinedAsync(
        id: string,
        val: string | number | boolean | null | undefined,
        ack: boolean,
    ): Promise<void> {
        if (val !== undefined && val !== null) {
            await this.setStateChangedAsync(id, val, ack);
        }
    }

    private isCurrentHour(dataTime: string): boolean {
        let hourStr = '';
        if (dataTime.length === 10) {
            // YYYYMMDDHH
            hourStr = dataTime.substring(8, 10);
        } else if (dataTime.length === 11) {
            // YYYYMMDD HH
            hourStr = dataTime.substring(9, 11);
        } else {
            return false;
        }

        const hour = parseInt(hourStr, 10);
        return hour === new Date().getHours();
    }

    private formatHistoryDate(dataTime: string): string {
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
        } else if (dataTime.length === 11) {
            // YYYYMMDD HH
            const year = dataTime.substring(0, 4);
            const month = dataTime.substring(4, 6);
            const day = dataTime.substring(6, 8);
            const hour = dataTime.substring(9, 11);
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
        this.log.debug(`Refresh device ${device.name} (${device.guid}).`);
        this.log.debug(`${device.name}: guid => ${device.guid}.`);

        for (const stateDef of deviceStates) {
            if (stateDef.id === 'guid') {
                continue;
            } // guid is special, not a state on the device object in the same way

            const value = (device as any)[stateDef.id];
            this.log.debug(`${device.name}: ${stateDef.id} => ${value}.`);

            if (value !== undefined) {
                await this.setStateChangedAsync(`${device.name}.${stateDef.id}`, value, true);
            } else if (stateDef.id === 'connected') {
                // Connected is always true when we reached this point
                await this.setStateChangedAsync(`${device.name}.connected`, true, true);
            }
        }
        this.log.debug(`Refresh device ${device.name} finished.`);
    }

    private async refreshDevice(guid: string, deviceName: string): Promise<void> {
        try {
            const encodedGuid = this.encodeGuidForPath(guid);
            const device = await this.withTokenRetry(
                () => this.comfortCloudClient.getDevice(encodedGuid, deviceName),
                `refresh device ${deviceName}`,
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

    private async refreshDevices(): Promise<void> {
        if (this.deviceRefreshInProgress) {
            this.log.debug('Skip device refresh because another refresh is still running.');
            return;
        }

        this.deviceRefreshInProgress = true;
        await this.setStateAsync('info.refreshInProgress', true, true);
        await this.setStateAsync('info.lastRefreshAttempt', new Date().toISOString(), true);

        try {
            this.log.debug('Refresh all devices.');
            const groups = await this.withTokenRetry(
                () => this.comfortCloudClient.getGroups(),
                'refresh device groups',
            );
            await this.setStateAsync('info.connection', true, true);
            const devices = groups.flatMap(g => g.devices);
            const deviceInfos = devices.map(d => {
                return { guid: d.guid, name: d.name };
            });
            await Promise.all(
                deviceInfos.map(async deviceInfo => {
                    try {
                        const encodedGuid = this.encodeGuidForPath(deviceInfo.guid);
                        const device = await this.withTokenRetry(
                            () => this.comfortCloudClient.getDevice(encodedGuid, deviceInfo.name),
                            `refresh device ${deviceInfo.name}`,
                        );
                        if (device != null) {
                            device.name = deviceInfo.name;
                            device.guid = deviceInfo.guid;
                            await this.refreshDeviceStates(device);
                        }
                    } catch (error) {
                        await this.handleDeviceError(deviceInfo.name, error);
                    }
                }),
            );
            this.consecutiveRefreshErrors = 0;
            await this.setStateAsync('info.consecutiveErrors', 0, true);
            await this.setStateAsync('info.lastError', '', true);
            await this.setStateAsync('info.lastSuccessfulRefresh', new Date().toISOString(), true);
        } catch (error) {
            this.consecutiveRefreshErrors++;
            await this.setStateAsync('info.consecutiveErrors', this.consecutiveRefreshErrors, true);
            await this.setStateAsync('info.lastError', this.formatError(error), true);
            await this.handleClientError(error);
        } finally {
            this.deviceRefreshInProgress = false;
            await this.setStateAsync('info.refreshInProgress', false, true);
        }
    }

    private async createDevices(groups: Array<Group>): Promise<void> {
        const devicesFromService = groups.flatMap(g => g.devices);
        const deviceInfos = devicesFromService.map(d => {
            return { guid: d.guid, name: d.name };
        });
        await Promise.all(
            deviceInfos.map(async deviceInfo => {
                this.log.debug(`Device info from group ${deviceInfo.guid}, ${deviceInfo.name}.`);
                let device: Device | null = null;
                try {
                    const encodedGuid = this.encodeGuidForPath(deviceInfo.guid);
                    device = await this.withTokenRetry(
                        () => this.comfortCloudClient.getDevice(encodedGuid, deviceInfo.name),
                        `create device ${deviceInfo.name}`,
                    );
                } catch (error) {
                    await this.handleDeviceError(deviceInfo.name, error);
                    return;
                }

                if (device != null) {
                    await this.setObjectNotExistsAsync(deviceInfo.name, {
                        type: 'device',
                        common: {
                            name: deviceInfo.name,
                        },
                        native: {},
                    });

                    for (const stateDef of deviceStates) {
                        const common: ioBroker.StateCommon = {
                            name: stateDef.id,
                            role: stateDef.role,
                            write: stateDef.write,
                            type: stateDef.type as ioBroker.CommonType,
                            read: stateDef.read !== undefined ? stateDef.read : true, // default read to true
                            def:
                                stateDef.id === 'guid'
                                    ? deviceInfo.guid
                                    : stateDef.def !== undefined
                                      ? stateDef.def
                                      : (device as any)[stateDef.id],
                        };

                        if (stateDef.states) {
                            common.states = stateDef.states;
                        }

                        await this.setObjectNotExistsAsync(`${deviceInfo.name}.${stateDef.id}`, {
                            type: 'state',
                            common: common,
                            native: {},
                        });
                    }

                    this.log.info(`Device ${deviceInfo.name} created.`);

                    if (this.config?.historyEnabled) {
                        await this.setObjectNotExistsAsync(`${deviceInfo.name}.history`, {
                            type: 'channel',
                            common: { name: 'History Data', role: 'info' },
                            native: {},
                        });

                        // Create sub-channels
                        await this.setObjectNotExistsAsync(`${deviceInfo.name}.history.current`, {
                            type: 'channel',
                            common: { name: 'Current Hourly History', role: 'info' },
                            native: {},
                        });

                        await this.setObjectNotExistsAsync(`${deviceInfo.name}.history.lastHour`, {
                            type: 'channel',
                            common: { name: 'Last Completed Hour History', role: 'info' },
                            native: {},
                        });

                        await this.setObjectNotExistsAsync(`${deviceInfo.name}.history.day`, {
                            type: 'channel',
                            common: { name: 'Daily History', role: 'info' },
                            native: {},
                        });
                        for (let i = 0; i <= 24; i++) {
                            const index = i.toString().padStart(2, '0');
                            await this.setObjectNotExistsAsync(`${deviceInfo.name}.history.day.${index}`, {
                                type: 'channel',
                                common: { name: `Hour ${index}`, role: 'info' },
                                native: {},
                            });
                        }

                        await this.setObjectNotExistsAsync(`${deviceInfo.name}.history.month`, {
                            type: 'channel',
                            common: { name: 'Monthly History', role: 'info' },
                            native: {},
                        });
                        for (let i = 0; i <= 31; i++) {
                            const index = i.toString().padStart(2, '0');
                            await this.setObjectNotExistsAsync(`${deviceInfo.name}.history.month.${index}`, {
                                type: 'channel',
                                common: { name: `Day ${index}`, role: 'info' },
                                native: {},
                            });
                        }

                        const historyStates = getHistoryStates();
                        for (const [id, def] of Object.entries(historyStates)) {
                            await this.setObjectNotExistsAsync(`${deviceInfo.name}.${id}`, {
                                type: 'state',
                                common: def,
                                native: {},
                            });
                        }
                    }
                }
            }),
        );
        this.log.debug('Device creation completed.');
    }

    private async updateDevice(deviceName: string, stateName: string, state: ioBroker.State): Promise<void> {
        if (readonlyStateNames.includes(stateName)) {
            return;
        }
        if (!state.ack) {
            const stateObj = await this.getObjectAsync(`${deviceName}.${stateName}`);
            const stateCommon = stateObj?.common as ioBroker.StateCommon;
            if (stateCommon?.write == false) {
                return;
            }

            const guidState = await this.getStateAsync(`${deviceName}.guid`);

            this.log.debug(`Update device guid=${guidState?.val} state=${stateName}`);
            const parameters: Parameters = {};
            parameters[stateName] = state.val;
            if (!guidState?.val) {
                return;
            }
            try {
                this.log.debug(`Set device parameter ${JSON.stringify(parameters)} for device ${guidState?.val}`);
                await this.withTokenRetry(
                    () => this.comfortCloudClient.setParameters(guidState?.val as string, parameters),
                    `update ${deviceName}.${stateName}`,
                );
                this.log.debug(`Refresh device ${deviceName}`);
                await this.refreshDevice(guidState?.val as string, deviceName);
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
    private onUnload(callback: () => void): void {
        try {
            if (this.refreshTimeout) {
                this.clearTimeout(this.refreshTimeout);
            }
            if (this.refreshHistoryTimeout) {
                this.clearTimeout(this.refreshHistoryTimeout);
            }

            this.log.info('cleaned everything up...');
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
     *
     * @param id
     * @param state
     */
    private async onStateChange(id: string, state: ioBroker.State | null | undefined): Promise<void> {
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
                } catch (error) {
                    await this.handleClientError(error);
                }
                await this.setStateAsync(id, false, true);
            } else if (stateName == 'refreshHistory' && state.val) {
                try {
                    const groups = await this.withTokenRetry(
                        () => this.comfortCloudClient.getGroups(),
                        'manual history refresh',
                    );
                    await this.refreshHistory(groups);
                    await this.setStateAsync(id, state, true);
                } catch (error) {
                    await this.handleClientError(error);
                }
                await this.setStateAsync(id, false, true);
            }
        } else if (!id.includes('.info.')) {
            const elements = id.split('.');
            const deviceName = elements[elements.length - 2];
            const stateName = elements[elements.length - 1];
            try {
                await this.updateDevice(deviceName, stateName, state);
            } catch (error) {
                await this.handleClientError(error);
            }

            // The state was changed
            this.log.info(`state ${id} changed: ${state.val} (ack = ${state.ack})`);
        }
    }

    private async getCurrentAppVersion(): Promise<string> {
        try {
            const response = await axios.get('https://itunes.apple.com/lookup?id=1348640525', { timeout: 10000 });
            if (response.status !== 200 || !response.data?.results?.[0]?.version) {
                return '';
            }
            return response.data.results[0].version;
        } catch (error) {
            this.log.warn(`Could not load Panasonic app version: ${this.formatError(error)}`);
            return '';
        }
    }

    private async handleDeviceError(deviceName: string, error: unknown): Promise<void> {
        this.log.debug(`Try to handle device error for ${deviceName}.`);

        await this.setStateChangedAsync(`${deviceName}.connected`, false, true);

        if (error instanceof ServiceError) {
            this.log.error(
                `Service error when connecting to device ${deviceName}: ${error.message}. Code=${error.code}. Stack: ${error.stack}`,
            );
        } else if (error instanceof Error) {
            this.log.error(`Unknown error when connecting to device ${deviceName}: ${error}. Stack: ${error.stack}`);
        }
    }

    private async handleClientError(error: unknown): Promise<void> {
        this.log.debug('Try to handle error.');

        if (error instanceof TokenExpiredError) {
            this.log.info(
                `Token of comfort cloud client expired. Trying to login again. Code=${error.code}. Stack: ${error.stack}`,
            );
            await this.setStateAsync('info.connection', false, true);
            await this.comfortCloudClient.login(this.config.username, this.config.password);
            await this.setStateAsync('info.connection', true, true);
            this.log.info('Login successful.');
        } else if (error instanceof ServiceError) {
            await this.setStateAsync('info.connection', false, true);
            this.log.error(`Service error: ${error.message}. Code=${error.code}. Stack: ${error.stack}`);
        } else if (error instanceof Error) {
            this.log.error(`Unknown error: ${error}. Stack: ${error.stack}`);
        }
    }

    private async withTokenRetry<T>(operation: () => Promise<T>, context: string): Promise<T> {
        try {
            return await operation();
        } catch (error) {
            if (!(error instanceof TokenExpiredError)) {
                throw error;
            }

            this.log.warn(`Comfort Cloud token expired while trying to ${context}; logging in again.`);
            await this.setStateAsync('info.connection', false, true);
            await this.reauthenticate();
            return operation();
        }
    }

    private async reauthenticate(): Promise<void> {
        if (!this.reauthenticationPromise) {
            this.reauthenticationPromise = (async () => {
                await this.comfortCloudClient.login(this.config.username, this.config.password);
                await this.setStateAsync('info.connection', true, true);
                this.log.info('Re-login successful.');
            })().finally(() => {
                this.reauthenticationPromise = undefined;
            });
        }
        await this.reauthenticationPromise;
    }

    private formatError(error: unknown): string {
        if (error instanceof ServiceError) {
            return `${error.message}${error.code !== undefined ? ` (code ${error.code})` : ''}`;
        }
        return error instanceof Error ? error.message : String(error);
    }

    private async ensureDiagnosticStates(): Promise<void> {
        const definitions: Record<string, ioBroker.StateCommon> = {
            'info.lastRefreshAttempt': {
                name: 'Last device refresh attempt',
                role: 'date',
                type: 'string',
                read: true,
                write: false,
                def: '',
            },
            'info.lastSuccessfulRefresh': {
                name: 'Last successful device refresh',
                role: 'date',
                type: 'string',
                read: true,
                write: false,
                def: '',
            },
            'info.lastError': {
                name: 'Last refresh error',
                role: 'text',
                type: 'string',
                read: true,
                write: false,
                def: '',
            },
            'info.consecutiveErrors': {
                name: 'Consecutive refresh errors',
                role: 'value',
                type: 'number',
                read: true,
                write: false,
                def: 0,
            },
            'info.refreshInProgress': {
                name: 'Device refresh in progress',
                role: 'indicator.working',
                type: 'boolean',
                read: true,
                write: false,
                def: false,
            },
            'info.lastHistoryRefreshAttempt': {
                name: 'Last history refresh attempt',
                role: 'date',
                type: 'string',
                read: true,
                write: false,
                def: '',
            },
            'info.lastSuccessfulHistoryRefresh': {
                name: 'Last successful history refresh',
                role: 'date',
                type: 'string',
                read: true,
                write: false,
                def: '',
            },
            'info.historyRefreshInProgress': {
                name: 'History refresh in progress',
                role: 'indicator.working',
                type: 'boolean',
                read: true,
                write: false,
                def: false,
            },
        };

        for (const [id, common] of Object.entries(definitions)) {
            await this.setObjectNotExistsAsync(id, { type: 'state', common, native: {} });
        }
    }

    private setupRefreshTimeout(): void {
        this.log.debug('setupRefreshTimeout');
        if (this.refreshTimeout) {
            this.clearTimeout(this.refreshTimeout);
        }
        const refreshIntervalInMilliseconds = this.refreshIntervalInMinutes * 60 * 1000;
        this.log.debug(`refreshIntervalInMilliseconds=${refreshIntervalInMilliseconds}`);
        this.refreshTimeout = this.setTimeout(this.refreshTimeoutFunc.bind(this), refreshIntervalInMilliseconds);
    }

    private async refreshTimeoutFunc(): Promise<void> {
        this.log.debug(`refreshTimeoutFunc started.`);
        try {
            await this.refreshDevices();
            this.setupRefreshTimeout();
        } catch (error) {
            await this.handleClientError(error);
        }
    }

    private setupHistoryRefreshTimeout(): void {
        this.log.debug('setupHistoryRefreshTimeout');
        if (this.refreshHistoryTimeout) {
            this.clearTimeout(this.refreshHistoryTimeout);
        }
        const refreshIntervalInMilliseconds = this.historyRefreshIntervalInMinutes * 60 * 1000;
        this.refreshHistoryTimeout = this.setTimeout(
            this.refreshHistoryTimeoutFunc.bind(this),
            refreshIntervalInMilliseconds,
        );
    }

    private async refreshHistoryTimeoutFunc(): Promise<void> {
        this.log.debug(`refreshHistoryTimeoutFunc started.`);
        try {
            if (this.config?.historyEnabled) {
                const groups = await this.comfortCloudClient.getGroups();
                await this.refreshHistory(groups);
            }
            this.setupHistoryRefreshTimeout();
        } catch (error) {
            this.log.warn(`Failed to refresh history: ${String(error)}`);
            // Retry later even on error
            this.setupHistoryRefreshTimeout();
        } finally {
            if (this.historyRefreshInProgress) {
                this.historyRefreshInProgress = false;
                await this.setStateAsync('info.historyRefreshInProgress', false, true);
            }
        }
    }

    private trimAll(text: string): string {
        const newText = text.trim().replace(/(\r\n|\n|\r)/gm, '');
        return newText;
    }

    private encodeGuidForPath(guid: string): string {
        try {
            return encodeURIComponent(decodeURIComponent(guid));
        } catch {
            return encodeURIComponent(guid);
        }
    }
}

if (module.parent) {
    // Export the constructor in compact mode
    module.exports = (options: Partial<utils.AdapterOptions> | undefined) => new PanasonicComfortCloud(options);
} else {
    // otherwise start the instance directly
    (() => new PanasonicComfortCloud())();
}
