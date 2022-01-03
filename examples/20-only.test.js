import path from 'path';
import { strict as assert } from 'assert';
import { TestRunner } from "../dist/index.js";
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const suite = new TestRunner(path.basename(__filename));

suite.test('This would normally pass', () => {});

suite.test('And this would too', () => {});

suite.only("If this wouldn't be marked as 'only'", () => {});

// run suite if this file is executed directly
// if (require.main === module) {
// 	suite.run();
// }

// this is important for `runAll`
// for ES6 modules type: export default suite
// module.exports = suite;
export default suite;
