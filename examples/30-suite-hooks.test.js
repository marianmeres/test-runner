import { strict as assert } from 'node:assert';
import { dirname, basename } from 'node:path';
import { fileURLToPath } from 'node:url';
import { TestRunner } from '../dist/mjs/index.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

let DB = null;

const suite = new TestRunner(basename(__filename), {
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

export default suite;
