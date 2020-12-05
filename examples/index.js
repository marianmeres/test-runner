const { TestRunner } = require('../dist');

const args = process.argv.slice(2);
const verbose = args.includes('-v');
const whitelist = args.filter((v) => v !== '-v');

TestRunner.runAll([__dirname], { verbose, whitelist });
