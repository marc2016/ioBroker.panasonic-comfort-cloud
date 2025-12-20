const expect = require('chai').expect;
const { deviceStates, readonlyStateNames } = require('../../build/lib/state-definitions');

describe('state-definitions', () => {
    it('should export deviceStates array', () => {
        expect(deviceStates).to.be.an('array');
        expect(deviceStates.length).to.be.greaterThan(0);
    });

    it('should have unique IDs for all states', () => {
        const ids = deviceStates.map(s => s.id);
        const uniqueIds = new Set(ids);
        expect(ids.length).to.equal(uniqueIds.size);
    });

    it('should have valid roles for all states', () => {
        deviceStates.forEach(state => {
            expect(state.role).to.be.a('string');
            expect(state.role).to.not.be.empty;
        });
    });

    it('should have valid types for all states', () => {
        const validTypes = ['number', 'string', 'boolean', 'array', 'object', 'mixed', 'file'];
        deviceStates.forEach(state => {
            expect(validTypes).to.include(state.type, `State ${state.id} has invalid type ${state.type}`);
        });
    });

    it('should generate readonlyStateNames correctly', () => {
        expect(readonlyStateNames).to.be.an('array');
        // Check a known read-only state
        const insideTemp = deviceStates.find(s => s.id === 'insideTemperature');
        if (insideTemp && !insideTemp.write) {
            expect(readonlyStateNames).to.include('insideTemperature');
        }
    });

    it('should correctly define states object', () => {
        const operate = deviceStates.find(s => s.id === 'operate');
        expect(operate).to.exist;
        if (operate) {
            expect(operate.states).to.be.an('object');
            if (operate.states) {
                expect(operate.states['0']).to.exist;
            }
        }
    });
});
