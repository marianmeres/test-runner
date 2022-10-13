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
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.TestRunner = void 0;
const path_1 = __importDefault(require("path"));
const index_js_1 = require("totalist/sync/index.js");
const renderer_js_1 = require("./renderer.js");
class TimeoutErr extends Error {
}
class SkipErr extends Error {
}
class MissingTestFnErr extends Error {
}
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
    constructor(label, config = {}, render) {
        this.label = label;
        this.config = config;
        this.render = render;
        this._tests = [];
        this._wasTimedOut = [];
        this.render = this.render || new renderer_js_1.Renderer();
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
        // prettier-ignore
        testFn = isFn(testFn) ? testFn : () => { throw new MissingTestFnErr(`Missing test function`); };
        this._tests.push({ label: `${label}` || 'untitled', testFn, timeout, type });
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
    /**
     * Main run API
     *
     * @param verbose
     * @param context
     * @param errorExitOnFirstFail
     * @param exitOnTimeout
     */
    run(verbose = true, context = {}, { errorExitOnFirstFail, exitOnTimeout, } = {}) {
        return __awaiter(this, void 0, void 0, function* () {
            // if undefined then fallback (which still can be undef)
            const uf = (v, f) => (v === void 0 ? f : v);
            errorExitOnFirstFail = uf(errorExitOnFirstFail, this.config.errorExitOnFirstFail);
            exitOnTimeout = uf(exitOnTimeout, this.config.exitOnTimeout);
            this.render.verbose = verbose;
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
            const totalStart = Date.now();
            const totalToRun = this._tests.reduce((m, t) => {
                if (t.type === TEST)
                    m++;
                return m;
            }, 0);
            this.render.suiteName({ suiteName: this.label });
            let results = { ok: 0, errors: 0, skip: 0, todo: 0, details: [] };
            for (let [index, { label, testFn, timeout, type }] of this._tests.entries()) {
                if (type !== TEST) {
                    results[type]++;
                    this.render.result({ type, label });
                    continue;
                }
                const start = Date.now();
                try {
                    results = yield this._withTimeout(() => this._run({ index, results, label, testFn, totalToRun }, context), timeout);
                }
                catch (error) {
                    results.errors++;
                    // the timeouts are tricky as we can't really kill (or cancel) the testFn
                    // (We could have spawn each test run into child process, but intentionally not doing so)
                    // So, results with TimeoutErr might be sometimes unexpected
                    // prettier-ignore
                    if (error instanceof TimeoutErr) {
                        // saving timed-out so we can omit late render, hm...
                        this._wasTimedOut.push(index);
                        if (exitOnTimeout) {
                            this.render.log('warn', `${error.toString()} (see exitOnTimeout option in docs)`);
                            process.exit(errorExitOnFirstFail ? 1 : 0);
                        }
                    }
                    else {
                        this.render.log('error', 'Internal TestRunner Error: expecting TimeoutErr');
                    }
                    // anyway, act as a regular error, but render no stack here
                    const duration = Date.now() - start;
                    error.stack = null;
                    const data = { type, label, error, duration };
                    results.details.push(data);
                    this.render.result(data);
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
            this.render.stats(info);
            return info;
        });
    }
    _run({ index, results, label, testFn, totalToRun }, context = {}) {
        return __awaiter(this, void 0, void 0, function* () {
            const start = Date.now();
            let error;
            const meta = { label, suite: this.label };
            // start trying with "pre" hooks up until the testFn...
            try {
                if (!index) {
                    yield this._execHook('before', meta);
                }
                const beResult = yield this._execHook('beforeEach', meta);
                // pass merged context and "beforeEach" result to each testFn
                yield testFn(JSON.parse(JSON.stringify(Object.assign(Object.assign({}, (context || {})), (beResult || {})))));
                results.ok++;
            }
            catch (e) {
                error = e;
                if (error instanceof MissingTestFnErr)
                    error.stack = null;
            }
            // and continue with "post" hooks (even if error might have happened above)
            error = yield this._catch(error, () => this._execHook('afterEach', meta));
            if (index === totalToRun - 1) {
                error = yield this._catch(error, () => this._execHook('after', meta));
            }
            let _wasRuntimeSkipped = false;
            if (error) {
                // runtime skip detection - render as 'skip' type and do not act as error at all
                if (error instanceof SkipErr) {
                    results.skip++;
                    error.stack = null;
                    this.render.result({ type: SKIP, label, error });
                    _wasRuntimeSkipped = true;
                }
                // regular error
                else {
                    results.errors++;
                }
            }
            const duration = Date.now() - start;
            results.details.push({ label, error, duration, suiteName: this.label });
            // trying to prevent late render after test was rejected via timeout catch
            // still not perfect...
            if (!_wasRuntimeSkipped && !this._wasTimedOut.includes(index)) {
                this.render.result({ type: TEST, label, error, duration });
            }
            return results;
        });
    }
    _execHook(which, { label, suite }) {
        return __awaiter(this, void 0, void 0, function* () {
            if (isFn(this.config[which])) {
                return yield this.config[which]({ __test__: label, __suite__: suite });
            }
            return {};
        });
    }
    // prettier-ignore
    _catch(previousErr, fn) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                yield fn();
            }
            catch (e) {
                previousErr = previousErr || e;
            } // keep first error
            return previousErr;
        });
    }
    _withTimeout(promise, ms) {
        return __awaiter(this, void 0, void 0, function* () {
            ms = ms || this.config.timeout || 1000;
            let tid;
            const timer = new Promise((_, rej) => {
                tid = setTimeout(() => rej(new TimeoutErr(`Timed out! (${ms} ms)`)), ms);
            });
            try {
                return yield Promise.race([promise(), timer]);
            }
            catch (e) {
                throw e;
            }
            finally {
                clearTimeout(tid);
            }
        });
    }
    /**
     * Will run all tests (see `TestRunner.testFileRegex`) under given directories,
     * respecting options
     *
     * @param dirs
     * @param options
     */
    static runAll(dirs, options = {}) {
        return __awaiter(this, void 0, void 0, function* () {
            let { whitelist = [], verbose = false, rootDir = process.cwd(), context = {}, errorExitOnFirstFail = false, enableErrorsSummaryOnNonVerbose = false, exitOnTimeout = false, } = options;
            if (!Array.isArray(whitelist))
                whitelist = [whitelist];
            whitelist = whitelist.map((v) => new RegExp(v, 'i'));
            whitelist.unshift(new RegExp(TestRunner.testFileRegex, 'i'));
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
                    (0, index_js_1.totalist)(dir, (name, abs, stats) => {
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
            const render = new renderer_js_1.Renderer(verbose, !!testFiles.length);
            let which = [];
            if (whitelist.length > 1) {
                which = [...whitelist].splice(1); // remove TestRunner.testFileRegex
            }
            render.runAllTitle({ whitelist: which });
            const totals = { ok: 0, errors: 0, skip: 0, todo: 0, duration: 0 };
            const invalid = [];
            let errorDetails = {};
            let counter = 0;
            for (let [f, name] of testFiles) {
                try {
                    // each suite must be exported as default
                    const suite = (yield Promise.resolve().then(() => __importStar(require(f)))).default;
                    let { ok, errors, skip, todo, duration, details } = yield suite.run(verbose, context, { errorExitOnFirstFail, exitOnTimeout });
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
                catch (error) {
                    render.runAllSuiteError({ error, name });
                    invalid.push({ label: path_1.default.basename(f), error });
                }
            }
            render.runAllStats({ stats: totals, invalid });
            // finally, if we're not verbose, still render compact error summary if enabled
            // prettier-ignore
            !verbose && enableErrorsSummaryOnNonVerbose && render.runAllErrorsSummary({
                errorDetails, invalid,
            });
        });
    }
}
exports.TestRunner = TestRunner;
/**
 * Used in TestRunner.runAll to detect test files. Can be customized if needed...
 * @type {RegExp}
 */
TestRunner.testFileRegex = /\.tests?\.([tj]sx?|mjs)$/;
