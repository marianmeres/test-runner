"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const test_runner_js_1 = require("./test-runner.js");
const minimist_1 = __importDefault(require("minimist"));
const colors_1 = require("kleur/colors");
const node_fs_1 = __importDefault(require("node:fs"));
// better safe than sorry...
if (process.env.NODE_ENV === 'production') {
    console.log((0, colors_1.red)("ERROR: 'production' env detected. Tests will not run!"));
    console.log((0, colors_1.gray)('(To override, use: `NODE_ENV=testing npm run test`'));
    process.exit(1);
}
//
const args = (0, minimist_1.default)(process.argv.slice(2));
const verbose = !!args.v;
const whitelist = args._.join(' ').trim() || undefined;
// console.log(args, verbose, whitelist); process.exit();
let dirs = args.d || ['./tests', './src'];
if (!Array.isArray(dirs))
    dirs = [dirs];
let _dirs = dirs;
dirs = (dirs).filter(d => d && node_fs_1.default.existsSync(d));
if (!dirs.length) {
    console.log((0, colors_1.red)(`ERROR: none of the dirs (${(0, colors_1.bold)(_dirs.join(', '))}) were found...`));
    console.log((0, colors_1.gray)('Please specify test dir via `-d ./some/path` arg'));
    process.exit(1);
}
//
test_runner_js_1.TestRunner.runAll(dirs, { verbose, whitelist }).catch(console.error);
