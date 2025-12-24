const { expect } = require('chai');
const { getHistoryStates } = require('../../build/lib/state-definitions');

describe('getHistoryStates', () => {
    it('should generate states for day only', () => {
        const states = getHistoryStates();
        expect(states).to.be.an('object');
        
        // check day and month
        expect(states['history.day.00.consumption']).to.exist;
        expect(states['history.day.24.consumption']).to.exist;
        expect(states['history.month.01.consumption']).to.exist;

        // check absence of week and year
        expect(states['history.week.00.consumption']).to.not.exist;
        expect(states['history.year.01.consumption']).to.not.exist;
    });

    it('should have correct role and unit for consumption', () => {
        const states = getHistoryStates();
        const consumption = states['history.day.00.consumption'];
        expect(consumption.role).to.equal('value.power.consumption');
        expect(consumption.unit).to.equal('kWh');
        expect(consumption.type).to.equal('number');
    });
});
