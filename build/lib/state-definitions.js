"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.readonlyStateNames = exports.deviceStates = void 0;
exports.getHistoryStates = getHistoryStates;
const panasonic_comfort_cloud_client_1 = require("panasonic-comfort-cloud-client");
exports.deviceStates = [
    {
        id: 'guid',
        role: 'info.address',
        write: false,
        type: 'string',
        def: undefined // Will be set dynamically from device info
    },
    {
        id: 'operate',
        role: 'switch.power',
        write: true,
        type: 'number',
        states: { 0: panasonic_comfort_cloud_client_1.Power[0], 1: panasonic_comfort_cloud_client_1.Power[1] }
    },
    {
        id: 'temperatureSet',
        role: 'level.temperature',
        write: true,
        type: 'number'
    },
    {
        id: 'insideTemperature',
        role: 'level.temperature',
        write: false,
        type: 'number'
    },
    {
        id: 'outTemperature',
        role: 'level.temperature',
        write: false,
        type: 'number'
    },
    {
        id: 'airSwingLR',
        role: 'state',
        write: true,
        type: 'number',
        states: {
            0: panasonic_comfort_cloud_client_1.AirSwingLR[0],
            1: panasonic_comfort_cloud_client_1.AirSwingLR[1],
            2: panasonic_comfort_cloud_client_1.AirSwingLR[2],
            3: panasonic_comfort_cloud_client_1.AirSwingLR[3],
            4: panasonic_comfort_cloud_client_1.AirSwingLR[4],
        }
    },
    {
        id: 'airSwingUD',
        role: 'state',
        write: true,
        type: 'number',
        states: {
            0: panasonic_comfort_cloud_client_1.AirSwingUD[0],
            1: panasonic_comfort_cloud_client_1.AirSwingUD[1],
            2: panasonic_comfort_cloud_client_1.AirSwingUD[2],
            3: panasonic_comfort_cloud_client_1.AirSwingUD[3],
            4: panasonic_comfort_cloud_client_1.AirSwingUD[4],
        }
    },
    {
        id: 'fanAutoMode',
        role: 'state',
        write: true,
        type: 'number',
        states: {
            0: panasonic_comfort_cloud_client_1.FanAutoMode[0],
            1: panasonic_comfort_cloud_client_1.FanAutoMode[1],
            2: panasonic_comfort_cloud_client_1.FanAutoMode[2],
            3: panasonic_comfort_cloud_client_1.FanAutoMode[3],
        }
    },
    {
        id: 'ecoMode',
        role: 'state',
        write: true,
        type: 'number',
        states: { 0: panasonic_comfort_cloud_client_1.EcoMode[0], 1: panasonic_comfort_cloud_client_1.EcoMode[1], 2: panasonic_comfort_cloud_client_1.EcoMode[2] }
    },
    {
        id: 'operationMode',
        role: 'state',
        write: true,
        type: 'number',
        states: {
            0: panasonic_comfort_cloud_client_1.OperationMode[0],
            1: panasonic_comfort_cloud_client_1.OperationMode[1],
            2: panasonic_comfort_cloud_client_1.OperationMode[2],
            3: panasonic_comfort_cloud_client_1.OperationMode[3],
            4: panasonic_comfort_cloud_client_1.OperationMode[4],
        }
    },
    {
        id: 'fanSpeed',
        role: 'state',
        write: true,
        type: 'number',
        states: {
            0: panasonic_comfort_cloud_client_1.FanSpeed[0],
            1: panasonic_comfort_cloud_client_1.FanSpeed[1],
            2: panasonic_comfort_cloud_client_1.FanSpeed[2],
            3: panasonic_comfort_cloud_client_1.FanSpeed[3],
            4: panasonic_comfort_cloud_client_1.FanSpeed[4],
            5: panasonic_comfort_cloud_client_1.FanSpeed[5],
        }
    },
    {
        id: 'actualNanoe',
        role: 'state',
        write: true,
        type: 'number',
        states: {
            0: panasonic_comfort_cloud_client_1.NanoeMode[0],
            1: panasonic_comfort_cloud_client_1.NanoeMode[1],
            2: panasonic_comfort_cloud_client_1.NanoeMode[2],
            3: panasonic_comfort_cloud_client_1.NanoeMode[3],
            4: panasonic_comfort_cloud_client_1.NanoeMode[4],
        }
    },
    {
        id: 'connected',
        role: 'state',
        write: false,
        read: true,
        type: 'boolean',
        def: false
    }
];
exports.readonlyStateNames = exports.deviceStates
    .filter(s => !s.write)
    .map(s => s.id);
function getHistoryStates() {
    const states = {};
    const modes = ['day', 'month'];
    const limit = { day: 24, month: 31 };
    for (const mode of modes) {
        for (let i = 0; i <= limit[mode]; i++) {
            const index = i.toString().padStart(2, '0');
            const prefix = `history.${mode}.${index}`;
            states[`${prefix}.dataTime`] = { role: 'value.time', name: 'Data Time', type: 'string', read: true, write: false, def: '' };
            states[`${prefix}.averageSettingTemp`] = { role: 'value.temperature', name: 'Average Setting Temp', type: 'number', unit: '°C', read: true, write: false, def: 0 };
            states[`${prefix}.averageInsideTemp`] = { role: 'value.temperature', name: 'Average Inside Temp', type: 'number', unit: '°C', read: true, write: false, def: 0 };
            states[`${prefix}.averageOutsideTemp`] = { role: 'value.temperature', name: 'Average Outside Temp', type: 'number', unit: '°C', read: true, write: false, def: 0 };
            states[`${prefix}.consumption`] = { role: 'value.power.consumption', name: 'Consumption', type: 'number', unit: 'kWh', read: true, write: false, def: 0 };
            states[`${prefix}.cost`] = { role: 'value.cost', name: 'Cost', type: 'number', read: true, write: false, def: 0 };
            states[`${prefix}.heatConsumptionRate`] = { role: 'value', name: 'Heat Consumption Rate', type: 'number', read: true, write: false, def: 0 };
            states[`${prefix}.coolConsumptionRate`] = { role: 'value', name: 'Cool Consumption Rate', type: 'number', read: true, write: false, def: 0 };
        }
    }
    const currentPrefix = `history.current`;
    states[`${currentPrefix}.dataTime`] = { role: 'value.time', name: 'Data Time', type: 'string', read: true, write: false, def: '' };
    states[`${currentPrefix}.averageSettingTemp`] = { role: 'value.temperature', name: 'Average Setting Temp', type: 'number', unit: '°C', read: true, write: false, def: 0 };
    states[`${currentPrefix}.averageInsideTemp`] = { role: 'value.temperature', name: 'Average Inside Temp', type: 'number', unit: '°C', read: true, write: false, def: 0 };
    states[`${currentPrefix}.averageOutsideTemp`] = { role: 'value.temperature', name: 'Average Outside Temp', type: 'number', unit: '°C', read: true, write: false, def: 0 };
    states[`${currentPrefix}.consumption`] = { role: 'value.power.consumption', name: 'Consumption', type: 'number', unit: 'kWh', read: true, write: false, def: 0 };
    states[`${currentPrefix}.cost`] = { role: 'value.cost', name: 'Cost', type: 'number', read: true, write: false, def: 0 };
    states[`${currentPrefix}.heatConsumptionRate`] = { role: 'value', name: 'Heat Consumption Rate', type: 'number', read: true, write: false, def: 0 };
    states[`${currentPrefix}.coolConsumptionRate`] = { role: 'value', name: 'Cool Consumption Rate', type: 'number', read: true, write: false, def: 0 };
    return states;
}
//# sourceMappingURL=state-definitions.js.map