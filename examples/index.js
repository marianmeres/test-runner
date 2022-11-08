import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { TestRunner } from '../dist/mjs/index.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const args = process.argv.slice(2);
const verbose = args.includes('-v');
const whitelist = args.filter((v) => v !== '-v');

TestRunner.runAll([__dirname], { verbose, whitelist }).catch(console.error);
