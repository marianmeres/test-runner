const path = require('path');
const { TestRunner } = require('../dist');

const suite = new TestRunner(path.basename(__filename));

suite.test('This would pass', () => {});

suite.test('And this too', () => {});

suite.only("If this woldn't be marked as 'only'", () => {});

// run suite if this file is executed directly
if (require.main === module) {
	suite.run();
}

// this is important for `runAll`
// for ES6 modules type: export default suite
module.exports = suite;
