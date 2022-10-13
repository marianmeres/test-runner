import { dirname, basename } from 'node:path';
import { fileURLToPath } from 'node:url';
import { TestRunner } from "../dist/mjs/index.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const suite = new TestRunner(basename(__filename));

suite.test('This would normally pass', () => {});

suite.test('And this would too', () => {});

suite.only("If this wouldn't be marked as 'only'", () => {});

export default suite;
