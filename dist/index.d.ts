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
export declare class TestRunner {
    label: string;
    config: Partial<{
        before: Function;
        beforeEach: Function;
        after: Function;
        afterEach: Function;
        timeout: number;
        skip: boolean;
        errorExitOnFirstFail: boolean;
        exitOnTimeout: boolean;
    }>;
    protected _tests: any[];
    protected _wasTimedOut: any[];
    constructor(label: string, config?: Partial<{
        before: Function;
        beforeEach: Function;
        after: Function;
        afterEach: Function;
        timeout: number;
        skip: boolean;
        errorExitOnFirstFail: boolean;
        exitOnTimeout: boolean;
    }>);
    static write(s?: string, nlCount?: number, nlChar?: string): void;
    static skip(message?: string): void;
    protected _add(label: string | Function, testFn?: Function, timeout?: number, type?: string): this;
    skip(label: string | Function, testFn?: Function, timeout?: number): this;
    only(label: string | Function, testFn?: Function, timeout?: number): this;
    todo(label: string | Function, testFn?: Function, timeout?: number): this;
    test(label: string | Function, testFn?: Function, timeout?: number): this;
    protected _execHook(which: any, { label, suite }: {
        label: any;
        suite: any;
    }): Promise<any>;
    static sanitize(e: Error): string;
    protected _catch(previousErr: any, fn: Function): Promise<any>;
    protected _withTimeout(promise: any, ms: any): Promise<any>;
    protected _run(index: any, results: any, label: any, testFn: any, verbose: any, totalToRun: any, context?: {}): Promise<any>;
    /**
     * Main run API
     *
     * @param verbose
     * @param context
     * @param errorExitOnFirstFail
     * @param exitOnTimeout
     */
    run(verbose?: boolean, context?: {}, { errorExitOnFirstFail, exitOnTimeout, }?: Partial<{
        errorExitOnFirstFail: boolean;
        exitOnTimeout: boolean;
    }>): Promise<{
        ok: number;
        errors: number;
        skip: number;
        todo: number;
        duration: number;
        details: any[];
        errorExitOnFirstFail: boolean;
    }>;
    protected _renderNonTestType(type: any, label: any, verbose: any): void;
    static renderStats(stats: any, prefix?: string, output?: boolean): string | void;
    static renderResult(r: any, verbose: any, output?: boolean): string;
    /**
     * Used in TestRunner.runAll to detect test files. Can be customized if needed...
     * @type {RegExp}
     */
    static testFileRegex: RegExp;
    /**
     * Will run all tests (see `TestRunner.testFileRegex`) under given directories,
     * respecting options
     *
     * @param dirs
     * @param options
     */
    static runAll(dirs: string | string[], options?: Partial<{
        whitelist: any[];
        verbose: boolean;
        rootDir: string;
        context: object;
        errorExitOnFirstFail: boolean;
        enableErrorsSummaryOnNonVerbose: boolean;
        exitOnTimeout: boolean;
    }>): Promise<void>;
}
