const fs = require('fs');
const path = require('path');
const proxyquire = require('proxyquire');
const sinon = require('sinon');
const { expect } = require('chai');
const { AppType } = require('panasonic-comfort-cloud-client');

const fixture = fs.readFileSync(path.join(__dirname, '../fixtures/play-store-snippet.html'), 'utf-8');

function loadModule(get) {
    return proxyquire('../../build/lib/app-version.js', {
        axios: { default: { get }, get },
    });
}

describe('app-version', () => {
    describe('parsePlayStoreVersion', () => {
        const { parsePlayStoreVersion } = require('../../build/lib/app-version.js');

        it('extracts the version from the Play Store page', () => {
            expect(parsePlayStoreVersion(fixture)).to.equal('5.1.0');
        });

        it('returns undefined for malformed HTML', () => {
            expect(parsePlayStoreVersion('<html><body>no version here</body></html>')).to.be.undefined;
            expect(parsePlayStoreVersion('[[["5.1"]]')).to.be.undefined;
        });
    });

    describe('store lookups', () => {
        it('getPlayStoreVersion returns the parsed version', async () => {
            const { getPlayStoreVersion } = loadModule(sinon.stub().resolves({ data: fixture }));
            expect(await getPlayStoreVersion()).to.equal('5.1.0');
        });

        it('getPlayStoreVersion returns undefined on network errors', async () => {
            const { getPlayStoreVersion } = loadModule(sinon.stub().rejects(new Error('timeout')));
            expect(await getPlayStoreVersion()).to.be.undefined;
        });

        it('getAppStoreVersion returns the App Store version', async () => {
            const { getAppStoreVersion } = loadModule(sinon.stub().resolves({ data: { results: [{ version: ' 5.1.1 ' }] } }));
            expect(await getAppStoreVersion()).to.equal('5.1.1');
        });

        it('getAppStoreVersion returns undefined on errors and invalid data', async () => {
            expect(await loadModule(sinon.stub().rejects(new Error('offline'))).getAppStoreVersion()).to.be.undefined;
            expect(await loadModule(sinon.stub().resolves({ data: { results: [] } })).getAppStoreVersion()).to.be.undefined;
        });
    });

    describe('buildCandidates', () => {
        const { buildCandidates } = require('../../build/lib/app-version.js');

        it('orders Play/Android, App Store/iOS, default/Android when both stores answer', () => {
            expect(buildCandidates({ automatic: true, playStoreVersion: '5.1.0', appStoreVersion: '5.1.1' })).to.deep.equal([
                { version: '5.1.0', appType: AppType.ANDROID },
                { version: '5.1.1', appType: AppType.IOS },
                { version: undefined, appType: AppType.ANDROID },
            ]);
        });

        it('starts with the App Store when Google Play fails', () => {
            expect(buildCandidates({ automatic: true, appStoreVersion: '5.1.1' })).to.deep.equal([
                { version: '5.1.1', appType: AppType.IOS },
                { version: undefined, appType: AppType.ANDROID },
            ]);
        });

        it('only tries the library default when both lookups fail', () => {
            expect(buildCandidates({ automatic: true })).to.deep.equal([{ version: undefined, appType: AppType.ANDROID }]);
        });

        it('uses exactly the manual version and platform in manual mode', () => {
            expect(
                buildCandidates({ automatic: false, manualVersion: '5.1.1', manualAppType: AppType.IOS, appStoreVersion: '9.9.9' }),
            ).to.deep.equal([{ version: '5.1.1', appType: AppType.IOS }]);
        });

        it('defaults the manual platform to Android', () => {
            expect(buildCandidates({ automatic: false, manualVersion: '5.1.0' })).to.deep.equal([
                { version: '5.1.0', appType: AppType.ANDROID },
            ]);
        });

        it('falls back to the Android default in manual mode without a version', () => {
            expect(buildCandidates({ automatic: false, manualVersion: '', manualAppType: AppType.IOS })).to.deep.equal([
                { version: undefined, appType: AppType.ANDROID },
            ]);
        });
    });
});
