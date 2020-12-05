const assert = require('assert').strict;
const path = require('path');
const { TestRunner } = require('../dist');

let DB = null;

const suite = new TestRunner(path.basename(__filename), {
	before: async () => {
		// simulate connect to DB
		return new Promise((resolve) => {
			DB = {};
			resolve();
		});
	},
	beforeEach: async () => {
		// assert "connected"
		if (!DB) {
			throw new Error('Not connected...');
		}
		// simulate some data fixtures
		DB['1'] = { name: 'foo' };
		// returned value will be passed as (deep cloned) { arg } to testFn
		return { DB };
	},
	afterEach: async () => {
		// reset db
		DB = {};
	},
	after: async () => {
		// simulate disconnect
		DB = null;
	},
});

suite.test('Working with data fixtures', ({ DB }) => {
	assert(DB['1'].name === 'foo'); // asserts the expected fixture
	DB['2'] = { name: 'bar' }; // touch the DB
});

suite.test('Means they must stay fixed', ({ DB }) => {
	assert(DB['1'].name === 'foo'); // asserts the expected fixture
	assert(!DB['2']); // assert the touch from above was reset
});

// run suite if this file is executed directly
if (require.main === module) {
	suite.run();
}

// this is important for `runAll`
// for ES6 modules type: export default suite
module.exports = suite;
