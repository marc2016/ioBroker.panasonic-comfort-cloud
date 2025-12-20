const proxyquire = require('proxyquire');
const sinon = require('sinon');
const { expect } = require('chai');

// Force proxyquire to not call throught to original modules
proxyquire.noCallThru();

// Mock for @iobroker/adapter-core
const adapterMock = {
    on: sinon.stub(),
    setState: sinon.stub(),
    setStateAsync: sinon.stub(),
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
        appVersionFromAppStore: '0.0.0'
    },
    updateConfig: sinon.stub(),
    subscribeStates: sinon.stub(),
    encrypt: (val) => val,
    trimAll: (val) => val,
    getObjectAsync: sinon.stub().resolves(null)
};

const AdapterClassMock = class {
    constructor(options) {
        Object.assign(this, adapterMock);
        // The real adapter calls this.on('ready', ...) in constructor
        // We simulate this by ensuring our stubs are ready
        return this;
    }
};

// Mock for panasonic-comfort-cloud-client
class ComfortCloudClientMock {
    constructor() {}
    login(user, pass) { return Promise.resolve(); }
    getGroups() { return Promise.resolve([]); }
}

const loginStub = sinon.spy(ComfortCloudClientMock.prototype, 'login');
const getGroupsStub = sinon.spy(ComfortCloudClientMock.prototype, 'getGroups');

// Mock for axios
const axiosMock = {
    get: sinon.stub().resolves({ 
        status: 200, 
        data: { 
            results: [{ version: '0.0.0' }] 
        } 
    })
};

describe('Client Mocking', () => {
    let main;
    let onReadyHandler;

    before(() => {
        // Load the main file with mocks
        const mainConstructor = proxyquire('../../build/main.js', {
            '@iobroker/adapter-core': {
                Adapter: AdapterClassMock
            },
            'panasonic-comfort-cloud-client': {
                ComfortCloudClient: ComfortCloudClientMock
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

    beforeEach(async () => {
        loginStub.resetHistory();
        getGroupsStub.resetHistory();
        adapterMock.setStateAsync.resetHistory();
        adapterMock.setObjectNotExistsAsync.resetHistory();
        
        // Execute the handler fresh for each test
        await onReadyHandler();
    });

    it('should register onReady handler', () => {
        expect(onReadyHandler).to.be.a('function');
    });

    it('should login with config credentials', () => {
        expect(loginStub.calledOnce).to.be.true;
        expect(loginStub.calledWith('testuser', 'testpassword')).to.be.true;
    });

    it('should fetch groups after login', () => {
        expect(getGroupsStub.called).to.be.true;
    });

    it('should set connection state to true', () => {
        // First false (start), then true (login success)
        const calls = adapterMock.setStateAsync.getCalls();
        const connectionTrue = calls.find(c => c.args[0] === 'info.connection' && c.args[1] === true);
        expect(connectionTrue).to.exist;
    });
});
