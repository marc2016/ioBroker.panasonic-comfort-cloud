const proxyquire = require('proxyquire');
const sinon = require('sinon');
const { expect } = require('chai');
const lib = require('panasonic-comfort-cloud-client');
const appVersion = require('../../build/lib/app-version.js');

const { AppType, AppVersionRejectedError, AuthenticationError } = lib;

const rejected = (version, appType) =>
    new AppVersionRejectedError('New version app has been published', 4106, 401, version, appType);

function setup({ config = {}, play = '5.1.0', appStore = '5.1.1', loginResults = [] } = {}) {
    const clients = [];
    let logins = 0;
    class ClientMock {
        constructor(version, appType = AppType.ANDROID) {
            this.appVersion = version ?? '5.1.0';
            this.appType = appType;
            this.login = sinon.stub().callsFake(() => {
                const result = loginResults[logins++];
                return result instanceof Error ? Promise.reject(result) : Promise.resolve('');
            });
            this.getGroups = sinon.stub().resolves([]);
            this.dispose = sinon.spy();
            clients.push(this);
        }
    }

    const adapter = {
        on: sinon.stub(),
        subscribeStates: sinon.stub(),
        setStateAsync: sinon.stub().resolves(),
        setStateChangedAsync: sinon.stub().resolves(),
        setObjectNotExistsAsync: sinon.stub().resolves(),
        getObjectAsync: sinon.stub().resolves(null),
        updateConfig: sinon.stub().resolves(),
        restart: sinon.stub(),
        setTimeout: sinon.stub(),
        clearTimeout: sinon.stub(),
        log: { info: sinon.stub(), debug: sinon.stub(), warn: sinon.stub(), error: sinon.stub() },
        config: {
            username: 'user',
            password: 'secret',
            automaticRefreshEnabled: false,
            historyEnabled: false,
            useAppVersionFromAppStore: true,
            appVersion: '',
            appType: 'android',
            appVersionFromAppStore: appStore ?? '',
            appVersionFromPlayStore: play ?? '',
            ...config,
        },
    };
    class AdapterMock {
        constructor() {
            Object.assign(this, adapter);
        }
    }

    const lookups = {
        getPlayStoreVersion: sinon.stub().resolves(play),
        getAppStoreVersion: sinon.stub().resolves(appStore),
    };
    const create = proxyquire.noCallThru().noPreserveCache()('../../build/main.js', {
        '@iobroker/adapter-core': { Adapter: AdapterMock },
        'panasonic-comfort-cloud-client': { ...lib, ComfortCloudClient: ClientMock },
        './lib/app-version': { ...appVersion, ...lookups },
    });
    const instance = create();
    // drop the placeholder client the adapter creates in its constructor
    clients.length = 0;
    const onReady = adapter.on.getCalls().find(c => c.args[0] === 'ready').args[1];
    const logged = level => adapter.log[level].getCalls().map(c => c.args[0]).join('\n');
    return { adapter, clients, instance, onReady, lookups, logged };
}

describe('login with app version fallback', () => {
    it('falls back to the App Store version on iOS when the Android version is rejected', async () => {
        const t = setup({ loginResults: [rejected('5.1.0', AppType.ANDROID)] });
        await t.onReady();

        expect(t.clients.map(c => [c.appVersion, c.appType])).to.deep.equal([
            ['5.1.0', AppType.ANDROID],
            ['5.1.1', AppType.IOS],
        ]);
        expect(t.clients[0].dispose.calledOnce).to.be.true;
        expect(t.clients[1].dispose.called).to.be.false;
        expect(t.adapter.setStateAsync.calledWith('info.connection', true, true)).to.be.true;
        expect(t.logged('warn')).to.contain('5.1.0 (Android) was rejected').and.contain('4106');
        expect(t.logged('info')).to.contain('Login successful with app version 5.1.1 (iOS)');
    });

    it('logs all tried pairs and stays disconnected when every version is rejected', async () => {
        const t = setup({
            play: '5.0.9',
            loginResults: [
                rejected('5.0.9', AppType.ANDROID),
                rejected('5.1.1', AppType.IOS),
                rejected('5.1.0', AppType.ANDROID),
            ],
        });
        await t.onReady();

        expect(t.clients).to.have.length(3);
        expect(t.clients.every(c => c.dispose.calledOnce)).to.be.true;
        expect(t.adapter.setStateAsync.calledWith('info.connection', true, true)).to.be.false;
        expect(t.logged('error'))
            .to.contain('5.0.9 (Android), 5.1.1 (iOS), 5.1.0 (Android)')
            .and.contain('Code=4106');
        expect(t.adapter.restart.called).to.be.false;
    });

    it('stops at wrong credentials without trying further versions', async () => {
        const t = setup({ loginResults: [new AuthenticationError('HTTP 401: Wrong email or password.', 401)] });
        await t.onReady();

        expect(t.clients).to.have.length(1);
        expect(t.logged('error')).to.contain('check username and password').and.contain('Wrong email or password.');
    });

    it('uses only the manual version and platform without store lookups', async () => {
        const t = setup({ config: { useAppVersionFromAppStore: false, appVersion: '5.1.1', appType: 'ios' } });
        await t.onReady();

        expect(t.lookups.getPlayStoreVersion.called).to.be.false;
        expect(t.lookups.getAppStoreVersion.called).to.be.false;
        expect(t.adapter.updateConfig.called).to.be.false;
        expect(t.clients.map(c => [c.appVersion, c.appType])).to.deep.equal([['5.1.1', AppType.IOS]]);
    });

    it('restarts once on a 4106 at runtime, but not at start-up', async () => {
        const t = setup();
        await t.onReady();
        expect(t.adapter.restart.called).to.be.false;

        const error = rejected('5.1.0', AppType.ANDROID);
        await t.instance.handleClientError(error);
        await t.instance.handleDeviceError('Kitchen', error);

        expect(t.adapter.restart.calledOnce).to.be.true;
        expect(t.adapter.setStateAsync.calledWith('info.connection', false, true)).to.be.true;
        expect(t.logged('warn')).to.contain('5.1.0 (Android) is no longer accepted');
    });

    it('disposes the client on unload', async () => {
        const t = setup();
        await t.onReady();
        const onUnload = t.adapter.on.getCalls().find(c => c.args[0] === 'unload').args[1];
        const callback = sinon.spy();

        onUnload(callback);

        expect(t.clients[0].dispose.calledOnce).to.be.true;
        expect(callback.calledOnce).to.be.true;
    });
});

describe('config persistence (#140)', () => {
    it('writes only the changed store versions and never the credentials', async () => {
        const t = setup({ config: { appVersionFromAppStore: '5.1.0', appVersionFromPlayStore: '5.1.0' } });
        await t.onReady();

        expect(t.adapter.updateConfig.calledOnceWith({ appVersionFromAppStore: '5.1.1' })).to.be.true;
        expect(t.clients).to.have.length(0);
    });

    it('does not write the config when the versions are unchanged', async () => {
        const t = setup();
        await t.onReady();

        expect(t.adapter.updateConfig.called).to.be.false;
        expect(t.clients).to.have.length(1);
    });
});
