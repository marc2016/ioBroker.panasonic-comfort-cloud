const proxyquire = require('proxyquire');
const sinon = require('sinon');
const { expect } = require('chai');

// Force proxyquire to not call throught to original modules
proxyquire.noCallThru();

// Mock for @iobroker/adapter-core
const adapterMock = {
    on: sinon.stub(),
    setState: sinon.stub(),
    setStateAsync: sinon.stub().resolves(),
    setStateChangedAsync: sinon.stub().callsFake((id, val, _ack) => {
        console.log(`[DEBUG] setStateChangedAsync called: ${id} = ${val}`);
        return Promise.resolve();
    }),
    getStateAsync: sinon.stub().resolves(null),
    setObjectNotExistsAsync: sinon.stub().resolves(),
    log: {
        info: sinon.stub(),
        debug: sinon.stub(),
        error: sinon.stub(),
        warn: sinon.stub()
    },
    config: {
        username: 'testuser',
        password: 'testpassword',
        automaticRefreshEnabled: false,
        historyEnabled: true,
        appVersionFromAppStore: '0.0.0'
    },
    updateConfig: sinon.stub(),
    subscribeStates: sinon.stub(),
    encrypt: (val) => val,
    trimAll: (val) => val,
    getObjectAsync: sinon.stub().resolves(null)
};

const AdapterClassMock = class {
    constructor(_options) {
        Object.assign(this, adapterMock);
        return this;
    }
};

// Mock Data
const mockDevice = { guid: 'device1', name: 'TestDevice' };
const mockHistoryData = {
    temperatureUnit: 0,
    historyDataList: [
        {
            // Previous hour (19:00)
            dataTime: '20251228 19',
            consumption: 1.5,
            averageSettingTemp: 22,
            averageInsideTemp: 21,
            averageOutsideTemp: 5,
            cost: 0.5,
            heatConsumptionRate: 0,
            coolConsumptionRate: 0
        },
        {
            // Current hour (20:00) - Should be picked as latest VALID
            dataTime: '20251228 20',
            consumption: 0.8,
            averageSettingTemp: 22,
            averageInsideTemp: 21.5,
            averageOutsideTemp: 4.5,
            cost: 0.3,
            heatConsumptionRate: 0,
            coolConsumptionRate: 0
        },
        {
            // Future hour (21:00) - Invalid data
            dataTime: '20251228 21',
            consumption: -255,
            averageSettingTemp: -255,
            averageInsideTemp: -255,
            averageOutsideTemp: -255,
            cost: -255,
            heatConsumptionRate: 0,
            coolConsumptionRate: 0
        }
    ]
};

// Mock for ServiceError
class ServiceError extends Error {
    constructor(message, code) {
        super(message);
        this.code = code;
    }
}

class TokenExpiredError extends Error {
    constructor(message, code) {
        super(message);
        this.code = code;
    }
}

// Mock for panasonic-comfort-cloud-client
class ComfortCloudClientMock {
    constructor() {}
    login(_user, _pass) { return Promise.resolve(); }
    getGroups() { 
        console.log('[DEBUG] ComfortCloudClientMock.getGroups called');
        return Promise.resolve([{ 
            id: 1, 
            name: 'Group1', 
            devices: [mockDevice] 
        }]); 
    }
    getDevice(guid, name) {
        // console.log(`[DEBUG] ComfortCloudClientMock.getDevice called for ${guid}`);
        return Promise.resolve({
            guid: guid,
            name: name,
            operate: 1,
            operationMode: 1,
            temperatureSet: 22,
            tankStatus: 128
        });
    }
    getDeviceHistoryData(_guid, _date, _mode) {
        console.log(`[DEBUG] ComfortCloudClientMock.getDeviceHistoryData called for mode ${_mode}`);
        return Promise.resolve(mockHistoryData);
    }
}

// Mock for axios
const axiosMock = {
    get: sinon.stub().resolves({ 
        status: 200, 
        data: { 
            results: [{ version: '0.0.0' }] 
        } 
    })
};

describe('History Updates Logic', () => {
    let mainConstructor;
    let onReadyHandler;
    let clock;

    before(() => {
        // Mock time to 2025-12-28 20:15:00
        // This makes "current hour" = 20, "previous hour" = 19
        const now = new Date('2025-12-28T20:15:00');
        clock = sinon.useFakeTimers(now.getTime());

// Mock DataMode enum
const DataMode = {
    Day: 'Day',
    Week: 'Week',
    Month: 'Month',
    Year: 'Year'
};

// ...

        // Load the main file with mocks
        mainConstructor = proxyquire('../../build/main.js', {
            '@iobroker/adapter-core': {
                Adapter: AdapterClassMock
            },
            'panasonic-comfort-cloud-client': {
                ComfortCloudClient: ComfortCloudClientMock,
                ServiceError: ServiceError,
                TokenExpiredError: TokenExpiredError,
                DataMode: DataMode
            },
            'axios': {
                default: axiosMock,
                ...axiosMock
            }
        });

        // Initialize adapter
        adapterMock.on.reset();
        mainConstructor();

        // Extract the 'ready' handler
        const readyCall = adapterMock.on.getCalls().find(call => call.args[0] === 'ready');
        if (readyCall) {
            onReadyHandler = readyCall.args[1];
        } else {
            throw new Error('No ready handler registered');
        }
    });

    after(() => {
        clock.restore();
    });

    beforeEach(async () => {
        adapterMock.setStateAsync.resetHistory();
        adapterMock.setStateChangedAsync.resetHistory(); // refreshHistory uses setStateChangedIfDefinedAsync which calls this
        
        // Execute the handler
        await onReadyHandler();
    });

    it('should update history.current with latest VALID data (filtering -255)', () => {
        // history.current.consumption should be 0.8 (from hour 20), not -255 (from hour 21)
        
        // Check for specific state update call
        // The adapter helper `setStateChangedIfDefinedAsync` calls `setStateChangedAsync`
        const calls = adapterMock.setStateChangedAsync.getCalls();
        
        const consumptionCall = calls.find(c => c.args[0] === 'TestDevice.history.current.consumption');
        
        expect(consumptionCall, 'history.current.consumption not set').to.exist;
        expect(consumptionCall.args[1]).to.equal(0.8);
    });

    it('should update history.current.dataTime with current fetch time', () => {
        const calls = adapterMock.setStateChangedAsync.getCalls();
        const timeCall = calls.find(c => c.args[0] === 'TestDevice.history.current.dataTime');
        
        expect(timeCall, 'history.current.dataTime not set').to.exist;
        // Since we mocked time to 20:15, expect user-friendly format (check implementation format)
        // Implementation: YYYYMMDD HH:mm
        // const formattedTime = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
        // 20251228 20:15
        expect(timeCall.args[1]).to.equal('20251228 20:15');
    });

    it('should update history.lastHour with data from previous hour', () => {
        // Previous hour is 19. Data should be consumption: 1.5
        const calls = adapterMock.setStateChangedAsync.getCalls();
        const consumptionCall = calls.find(c => c.args[0] === 'TestDevice.history.lastHour.consumption');
        
        expect(consumptionCall, 'history.lastHour.consumption not set').to.exist;
        expect(consumptionCall.args[1]).to.equal(1.5);
    });

    it('should update history.lastHour.dataTime with original cloud timestamp', () => {
        // Previous hour is 19. Data time: '20251228 19'
        const calls = adapterMock.setStateChangedAsync.getCalls();
        const timeCall = calls.find(c => c.args[0] === 'TestDevice.history.lastHour.dataTime');
        
        expect(timeCall, 'history.lastHour.dataTime not set').to.exist;
        // Implementation adds :00:00
        expect(timeCall.args[1]).to.equal('2025-12-28 19:00:00');
    });
});
