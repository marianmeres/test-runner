#!/usr/bin/env node

import { TestRunner } from './test-runner.js';
import minimist from 'minimist';
import { bold, gray, red } from 'kleur/colors';
import fs from 'node:fs';

// better safe than sorry...
if (process.env.NODE_ENV === 'production') {
	console.log(red("ERROR: 'production' env detected. Tests will not run!"));
	console.log(gray('(To override, use: `NODE_ENV=testing npm run test`'));
	process.exit(1);
}

//
const args = minimist(process.argv.slice(2));
const verbose = !!args.v || !!args.verbose;
const whitelist = args._.join(' ').trim() || undefined;

if (args.h || args.help) {
	console.log(`
--> Usage: node ./dist/mjs/cli.js [test-name-filter] [test-name-filter2] [...] [-v|--verbose]
`);
	process.exit();
}

// console.log(args, verbose, whitelist); process.exit();

let dirs = args.d || ['./tests', './src'];
if (!Array.isArray(dirs)) dirs = [dirs];
let _dirs = dirs;
dirs = (dirs).filter(d => d && fs.existsSync(d));

if (!dirs.length) {
	console.log(red(`ERROR: none of the dirs (${bold(_dirs.join(', '))}) were found...`));
	console.log(gray('Please specify test dir via `-d ./some/path` arg'));
	process.exit(1);
}

//
TestRunner.runAll(dirs, { verbose, whitelist }).catch(console.error);
