import path from 'path';
import { totalist } from 'totalist/sync/index.js';
import { Renderer } from './renderer.js';
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
export class TestRunner {
    label;
    config;
    render;
    _tests = [];
    _wasTimedOut = [];
    constructor(label, config = {}, render) {
        this.label = label;
        this.config = config;
        this.render = render;
        this.render = this.render || new Renderer();
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
    async run(verbose = true, context = {}, { errorExitOnFirstFail, exitOnTimeout, } = {}) {
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
                results = await this._withTimeout(() => this._run({ index, results, label, testFn, totalToRun }, context), timeout);
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
    }
    async _run({ index, results, label, testFn, totalToRun }, context = {}) {
        const start = Date.now();
        let error;
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
            error = e;
            if (error instanceof MissingTestFnErr)
                error.stack = null;
        }
        // and continue with "post" hooks (even if error might have happened above)
        error = await this._catch(error, () => this._execHook('afterEach', meta));
        if (index === totalToRun - 1) {
            error = await this._catch(error, () => this._execHook('after', meta));
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
    }
    async _execHook(which, { label, suite }) {
        if (isFn(this.config[which])) {
            return await this.config[which]({ __test__: label, __suite__: suite });
        }
        return {};
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
    /**
     * Used in TestRunner.runAll to detect test files. Can be customized if needed...
     * @type {RegExp}
     */
    static testFileRegex = /\.tests?\.([tj]sx?|mjs)$/;
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
        const testFiles = ((_dirs) => {
            // normalize + unique-ize
            if (!Array.isArray(_dirs))
                _dirs = [_dirs];
            _dirs = [...new Set(_dirs.map(path.normalize))];
            const isWhitelisted = (f) => {
                for (let i = 0; i < whitelist.length; i++) {
                    if (!whitelist[i].test(f))
                        return false;
                }
                return true;
            };
            const out = [];
            for (let dir of _dirs) {
                totalist(dir, (name, abs, stats) => {
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
        const render = new Renderer(verbose, !!testFiles.length);
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
                const suite = (await import(f)).default;
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
            catch (error) {
                render.runAllSuiteError({ error, name });
                invalid.push({ label: path.basename(f), error });
            }
        }
        render.runAllStats({ stats: totals, invalid });
        // finally, if we're not verbose, still render compact error summary if enabled
        // prettier-ignore
        !verbose && enableErrorsSummaryOnNonVerbose && render.runAllErrorsSummary({
            errorDetails, invalid,
        });
    }
}
