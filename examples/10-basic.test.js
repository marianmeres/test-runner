import { dirname, basename } from 'node:path';
import { fileURLToPath } from 'node:url';
import { TestRunner } from '../dist/mjs/index.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const suite = new TestRunner(basename(__filename));

suite.test('Will always pass', () => {});

// async tests are supported
suite.test('Will always fail', async () => {
	return new Promise((res, rej) => rej(new Error('Told you...')));
});

// Basic skip notation
suite.skip('Will run this later', () => {});

// Runtime skip notation
suite.test('Thinking about running...', () => {
	TestRunner.skip('but decided not to at runtime');
});

// basic "to do" notation
suite.todo('To be implemented');

// Default timeout limit is set to 1000ms and can be customized
// per test or per suite (via ctor options).
// BUT, this can get tricky... read more in README.md
// prettier-ignore
suite.test('Too late Marlene', async () => {
	await new Promise((res) => setTimeout(res, 10));
}, 5);

export default suite;
