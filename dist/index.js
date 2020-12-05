"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    Object.defineProperty(o, k2, { enumerable: true, get: function() { return m[k]; } });
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.TestRunner = void 0;
const kleur_1 = require("kleur");
const colors_1 = require("kleur/colors");
const path_1 = __importDefault(require("path"));
const tinydate_1 = __importDefault(require("tinydate"));
const sync_1 = require("totalist/sync");
class TimeoutErr extends Error {
}
class SkipErr extends Error {
}
class MissingTestFnErr extends Error {
}
// "T2C" -> type to color
const T2C = {
    error: kleur_1.red,
    test: kleur_1.green,
    skip: kleur_1.yellow,
    todo: kleur_1.magenta,
};
// test type constants
const ONLY = 'only';
const TEST = 'test';
const TODO = 'todo';
const SKIP = 'skip';
const isFn = (v) => typeof v === 'function';
/**
 * Simple testing framework. Basic usage:
 *
 * 	const suite = new TestRunner('my suite');
 * 	suite.test('truth and nothing but the truth', () => {
 * 	    if (false) {
 * 	        throw new Error('Gimme some truth!');
 * 	    }
 * 	})
 * 	suite.run();
 */
class TestRunner {
    constructor(label, config = {}) {
        this.label = label;
        this.config = config;
        this._tests = [];
        this._wasTimedOut = [];
    }
    // hackable output renderer
    static write(s = '', nlCount = 1, nlChar = '\n') {
        process.stdout.write(`${s}` + `${nlChar}`.repeat(nlCount));
    }
    static skip(message = '') {
        throw new SkipErr(message || 'Skipped');
    }
    _add(label, testFn, timeout = null, type = TEST) {
        // support for no label signature
        if (isFn(label) && !isFn(testFn)) {
            testFn = label;
            label = 'untitled';
        }
        label = `${label}` || 'untitled';
        // prettier-ignore
        testFn = isFn(testFn) ? testFn : () => {
            throw new MissingTestFnErr(`Missing test function`);
        };
        this._tests.push({ label, testFn, timeout, type });
        return this;
    }
    skip(label, testFn, timeout = null) {
        return this._add(label, testFn, timeout, SKIP);
    }
    only(label, testFn, timeout = null) {
        return this._add(label, testFn, timeout, ONLY);
    }
    todo(label, testFn, timeout = null) {
        return this._add(label, testFn, timeout, TODO);
    }
    test(label, testFn, timeout = null) {
        return this._add(label, testFn, timeout, TEST);
    }
    async _execHook(which, { label, suite }) {
        if (isFn(this.config[which])) {
            return await this.config[which]({ __test__: label, __suite__: suite });
        }
        return {};
    }
    static sanitize(e) {
        return e
            .toString()
            .replace(/^(Error:\s*)/i, '')
            .replace(process.cwd(), '')
            .replace(' [ERR_ASSERTION]', '')
            .replace(/\s\s+/g, ' ')
            .trim();
    }
    // prettier-ignore
    async _catch(previousErr, fn) {
        try {
            await fn();
        }
        catch (e) {
            previousErr = previousErr || e;
        } // keep first error
        return previousErr;
    }
    async _withTimeout(promise, ms) {
        ms = ms || this.config.timeout || 1000;
        let tid;
        const timer = new Promise((_, rej) => {
            tid = setTimeout(() => rej(new TimeoutErr(`Timed out! (${ms} ms)`)), ms);
        });
        try {
            return await Promise.race([promise(), timer]);
        }
        catch (e) {
            throw e;
        }
        finally {
            clearTimeout(tid);
        }
    }
    async _run(index, results, label, testFn, verbose, totalToRun, context = {}) {
        const start = Date.now();
        let error, stack, _err;
        const meta = { label, suite: this.label };
        // start trying with "pre" hooks up until the testFn...
        try {
            if (!index) {
                await this._execHook('before', meta);
            }
            const beResult = await this._execHook('beforeEach', meta);
            // pass merged context and "beforeEach" result to each testFn
            await testFn(JSON.parse(JSON.stringify({ ...(context || {}), ...(beResult || {}) })));
            results.ok++;
        }
        catch (e) {
            _err = e;
            if (_err instanceof MissingTestFnErr)
                _err.stack = null;
        }
        // and continue with "post" hooks (even if error might have happened above)
        _err = await this._catch(_err, () => this._execHook('afterEach', meta));
        if (index === totalToRun) {
            _err = await this._catch(_err, () => this._execHook('after', meta));
        }
        let _wasRuntimeSkipped = false;
        if (_err) {
            error = TestRunner.sanitize(_err);
            // runtime skip detection - render as 'skip' type and do not act as error at all
            if (_err instanceof SkipErr) {
                results.skip++;
                this._renderNonTestType(SKIP, `${label}${kleur_1.gray(` - ${error}`)}`, verbose);
                _wasRuntimeSkipped = true;
            }
            // regular error
            else {
                stack = _err.stack;
                results.errors++;
            }
        }
        const duration = Date.now() - start;
        results.details.push({ label, error, stack, duration, suiteName: this.label });
        // trying to prevent late render after test was rejected via timeout catch
        // still not perfect...
        if (!_wasRuntimeSkipped && !this._wasTimedOut.includes(index)) {
            TestRunner.renderResult({ index, label, error, stack, duration }, verbose);
        }
        return results;
    }
    /**
     * Main run API
     *
     * @param verbose
     * @param context
     * @param errorExitOnFirstFail
     * @param exitOnTimeout
     */
    async run(verbose = true, context = {}, { errorExitOnFirstFail, exitOnTimeout, } = {}) {
        // if undefined then fallback (which still can be undef)
        const uf = (v, f) => v === void 0 ? f : v;
        errorExitOnFirstFail = uf(errorExitOnFirstFail, this.config.errorExitOnFirstFail);
        exitOnTimeout = uf(exitOnTimeout, this.config.exitOnTimeout);
        // skip all config flag
        if (this.config.skip) {
            this._tests = this._tests.map((t) => {
                if (t.type === TEST)
                    t.type = SKIP;
                return t;
            });
        }
        // if at least one "only" exist, mark all other non-only as "skip"
        if (this._tests.some((t) => t.type === ONLY)) {
            const switchMap = { [TEST]: SKIP, [ONLY]: TEST };
            this._tests = this._tests.map((t) => {
                if (switchMap[t.type])
                    t.type = switchMap[t.type];
                return t;
            });
        }
        const totalToRun = this._tests.reduce((m, t) => {
            if (t.type === TEST)
                m++;
            return m;
        }, 0);
        const totalStart = Date.now();
        let results = { ok: 0, errors: 0, skip: 0, todo: 0, details: [] };
        verbose && TestRunner.write(kleur_1.white(colors_1.bold(`\n--> ${this.label} `)), 2);
        for (let [index, { label, testFn, timeout, type }] of this._tests.entries()) {
            if (type !== TEST) {
                results[type]++;
                this._renderNonTestType(type, label, verbose);
                continue;
            }
            const start = Date.now();
            try {
                results = await this._withTimeout(() => this._run(index, results, label, testFn, verbose, totalToRun, context), timeout);
            }
            catch (e) {
                const error = TestRunner.sanitize(e);
                results.errors++;
                // the timeouts are tricky as we can't really kill (or cancel) the testFn
                // (We could have spawn each test run into child process, but intentionally not doing so)
                // So, results with TimeoutErr might be sometimes unexpected
                if (e instanceof TimeoutErr) {
                    // saving timed-out so we can omit late render, hm...
                    this._wasTimedOut.push(index);
                    if (exitOnTimeout) {
                        TestRunner.write(kleur_1.yellow(`    ${error} (see exitOnTimeout option in docs)`));
                        process.exit(errorExitOnFirstFail ? 1 : 0);
                    }
                }
                else {
                    TestRunner.write(kleur_1.red('Internal TestRunner Error: expecting TimeoutErr'));
                }
                // anyway, act as a regular error, but render no stack here
                const duration = Date.now() - start;
                const details = { label, error, stack: null, duration, suiteName: this.label };
                results.details.push(details);
                TestRunner.renderResult(details, verbose);
            }
            if (results.errors && errorExitOnFirstFail) {
                process.exit(1);
            }
        }
        const info = {
            ok: results.ok,
            errors: results.errors,
            skip: results.skip,
            todo: results.todo,
            duration: Date.now() - totalStart,
            details: results.details,
            errorExitOnFirstFail,
        };
        verbose && TestRunner.renderStats(info);
        return info;
    }
    _renderNonTestType(type, label, verbose) {
        if (verbose) {
            TestRunner.write(T2C[type](`    [ ] (${type}) ${label}`));
        }
        else {
            TestRunner.write(T2C[type]('•') + ' ', 0);
        }
    }
    static renderStats(stats, prefix = 'Summary: ', output = true) {
        let summary = [
            stats.ok ? T2C.test(`OK ${stats.ok}`) : kleur_1.gray('0 tests'),
            stats.errors ? T2C.error(`errors ${stats.errors}`) : '',
            stats.skip ? T2C.skip(`skipped ${stats.skip}`) : '',
            stats.todo ? T2C.todo(`todo ${stats.todo}`) : '',
        ]
            .filter(Boolean)
            .join(kleur_1.gray(', '));
        let dur = '';
        if (stats.duration > 1000) {
            dur = kleur_1.gray(` (${Math.round(stats.duration / 1000)} s)`);
        }
        else {
            dur = kleur_1.gray(` (${stats.duration} ms)`);
        }
        let out = `\n    ${kleur_1.gray().bold(prefix)}${summary}${dur}\n`;
        return output ? TestRunner.write(out) : out;
    }
    static renderResult(r, verbose, output = true) {
        const _renderStack = (stack) => stack
            .split('\n')
            // shorten long absolute node_modules paths as relative
            .map((v) => v.replace(/(\([^\(]+node_modules)/, '(node_modules'))
            .map((v) => v.replace(process.cwd(), ''))
            .map((v) => v.replace(/\s\s+/g, ' ').trim())
            .filter(Boolean)
            .slice(1, 5) // skip first line (rendered via e.toString()) and reduce noise
            .join('\n        ')
            .trim();
        const icon = r.error ? T2C.error('[ ] ') : T2C.test('[x] ');
        const label = r.error ? T2C.error().bold(r.label) : T2C.test(r.label);
        const err = r.error ? kleur_1.gray(' - ') + kleur_1.white(r.error) : '';
        let out = '    ' + `${icon}${label}${err}`.replace(/\s\s+/g, ' ').trim();
        if (r.stack)
            out += `\n        ${kleur_1.gray(_renderStack(r.stack))}`;
        if (!output)
            return out;
        if (verbose) {
            TestRunner.write(out);
        }
        else {
            TestRunner.write(T2C[err ? 'error' : 'test']('•') + ' ', 0);
        }
    }
    /**
     * Will run all tests (see `TestRunner.testFileRegex`) under given directories,
     * respecting options
     *
     * @param dirs
     * @param options
     */
    static async runAll(dirs, options = {}) {
        let { whitelist = [], verbose = false, rootDir = process.cwd(), context = {}, errorExitOnFirstFail = false, enableErrorsSummaryOnNonVerbose = false, exitOnTimeout = false, } = options;
        if (!Array.isArray(whitelist))
            whitelist = [whitelist];
        whitelist = whitelist.map((v) => new RegExp(v, 'i'));
        whitelist.unshift(new RegExp(TestRunner.testFileRegex, 'i'));
        let which = '...';
        if (whitelist.length > 1) {
            which = [...whitelist].splice(1); // remove TestRunner.testFileRegex
            which = ' for ' + kleur_1.gray('[ ' + kleur_1.white().bold(which.join(kleur_1.gray(', '))) + ' ]');
        }
        const testFiles = ((_dirs) => {
            // normalize + unique-ize
            if (!Array.isArray(_dirs))
                _dirs = [_dirs];
            _dirs = [...new Set(_dirs.map(path_1.default.normalize))];
            const isWhitelisted = (f) => {
                for (let i = 0; i < whitelist.length; i++) {
                    if (!whitelist[i].test(f))
                        return false;
                }
                return true;
            };
            const out = [];
            for (let dir of _dirs) {
                sync_1.totalist(dir, (name, abs, stats) => {
                    // hard blacklist check first
                    if (/node_modules/.test(abs))
                        return;
                    // this may not work if provided dirs are outside of rootDir...
                    const relpath = abs.substr(rootDir.length + 1);
                    if (isWhitelisted(relpath))
                        out.push([abs, name]);
                });
            }
            return out;
        })(dirs);
        // clear screen only if about to go running
        testFiles.length && console.clear();
        // prettier-ignore
        if (!verbose) {
            TestRunner.write(kleur_1.white(`\n--> Running tests${which}`) + kleur_1.gray(' (use -v param for details)'));
            TestRunner.write('\n    ', 0);
        }
        else {
            TestRunner.write(kleur_1.gray(`\n    Running tests${which}`));
        }
        const totals = { ok: 0, errors: 0, skip: 0, todo: 0, duration: 0 };
        const invalid = [];
        let errorDetails = {};
        let counter = 0;
        for (let [f, name] of testFiles) {
            try {
                // each suite must be exported as default
                const suite = (await Promise.resolve().then(() => __importStar(require(f)))).default;
                let { ok, errors, skip, todo, duration, details } = await suite.run(verbose, context, { errorExitOnFirstFail, exitOnTimeout });
                totals.ok += ok;
                totals.errors += errors;
                totals.skip += skip;
                totals.todo += todo;
                totals.duration += duration;
                counter++;
                errorDetails = details.reduce((memo, d) => {
                    const { error, label, suiteName } = d;
                    if (error) {
                        memo[suiteName] = memo[suiteName] || [];
                        memo[suiteName].push({ label, error });
                    }
                    return memo;
                }, errorDetails);
            }
            catch (err) {
                const error = TestRunner.sanitize(err);
                if (verbose) {
                    TestRunner.write(`\n--> ${T2C.error(name)} ${kleur_1.gray('--> ' + error)}\n`);
                }
                else {
                    TestRunner.write(T2C.skip('•') + ' ', 0);
                }
                invalid.push({ label: path_1.default.basename(f), error });
            }
        }
        const warn = invalid.length ? kleur_1.yellow(` (invalid test files: ${invalid.length})`) : '';
        !verbose && TestRunner.write(''); // extra \n
        const title = tinydate_1.default('[{HH}:{mm}:{ss}] Summary: ')();
        // prettier-ignore
        TestRunner.write('\n--> ' + `${TestRunner.renderStats(totals, title, false)}`.trim() + `${warn}\n`);
        // finally, if we're not verbose, still render compact error summary if enabled
        if (!verbose && enableErrorsSummaryOnNonVerbose) {
            const errors = Object.entries(errorDetails);
            if (errors.length) {
                TestRunner.write(kleur_1.red(`\n    Errors summary`));
                errors.forEach(([suiteName, list]) => {
                    TestRunner.write(kleur_1.gray(`\n--> `) + kleur_1.white(suiteName));
                    list.forEach(({ label, error }) => {
                        TestRunner.write(T2C.error(`    ${label}`) + kleur_1.gray(` - ${error}`));
                    });
                });
                TestRunner.write(''); // extra \n
            }
            if (invalid.length) {
                TestRunner.write(T2C.skip(`\n    Invalid files summary`), 2);
                invalid.forEach(({ label, error }) => {
                    TestRunner.write(kleur_1.gray(`--> `) + T2C.skip(label) + kleur_1.gray(` --> ${error}`), 2);
                });
                TestRunner.write(''); // extra \n
            }
        }
    }
}
exports.TestRunner = TestRunner;
/**
 * Used in TestRunner.runAll to detect test files. Can be customized if needed...
 * @type {RegExp}
 */
TestRunner.testFileRegex = /\.tests?\.[tj]sx?$/;
