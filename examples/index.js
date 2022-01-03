import { TestRunner } from '../dist/index.js';
import { dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const args = process.argv.slice(2);
const verbose = args.includes('-v');
const whitelist = args.filter((v) => v !== '-v');

TestRunner.runAll([__dirname], { verbose, whitelist });
