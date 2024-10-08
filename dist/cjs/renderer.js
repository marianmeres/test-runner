"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.Renderer = void 0;
const colors_1 = require("kleur/colors");
const tinydate_1 = __importDefault(require("tinydate"));
const T2C = { error: colors_1.red, test: colors_1.green, skip: colors_1.yellow, todo: colors_1.magenta, warn: colors_1.yellow };
const ONLY = 'only';
const TEST = 'test';
const TODO = 'todo';
const SKIP = 'skip';
class Renderer {
    verbose;
    constructor(verbose = true, clear = false) {
        this.verbose = verbose;
        clear && console.clear();
    }
    static write(s = '', nlCount = 1, nlChar = '\n') {
        process.stdout.write(`${s}` + `${nlChar}`.repeat(nlCount));
    }
    suiteName({ suiteName }) {
        if (this.verbose) {
            Renderer.write((0, colors_1.white)((0, colors_1.bold)(`\n--> ${suiteName} `)), 2);
        }
    }
    result({ type, label, error, duration }) {
        // NOTE: "test type" and "color type" are not the same
        let ctype = error && type === TEST ? 'error' : type;
        if (!this.verbose) {
            return Renderer.write(T2C[ctype]('•') + ' ', 0);
        }
        const icon = T2C[ctype](`[${ctype === TEST && !error ? 'x' : ' '}] `);
        let e = Renderer.sanitizeError(error);
        if (e) {
            e = (0, colors_1.gray)(' - ') + (type !== TEST ? colors_1.gray : colors_1.white)(e);
        }
        const prefix = type === TEST ? '' : `(${type}) `;
        Renderer.write(T2C[ctype](`    ${icon}${prefix}${label}${e}`));
        if (error && error.stack) {
            Renderer.write(`        ${(0, colors_1.gray)(Renderer.sanitizeStack(error.stack))}`);
        }
    }
    stats(stats, prefix = 'Summary: ', output = true) {
        let summary = [
            stats.ok ? T2C.test(`OK ${stats.ok}`) : (0, colors_1.gray)('0 tests'),
            stats.errors ? T2C.error(`errors ${stats.errors}`) : '',
            stats.skip ? T2C.skip(`skipped ${stats.skip}`) : '',
            stats.todo ? T2C.todo(`todo ${stats.todo}`) : '',
        ]
            .filter(Boolean)
            .join((0, colors_1.gray)(', '));
        let dur = '';
        if (stats.duration > 1000) {
            dur = (0, colors_1.gray)(` (${Math.round(stats.duration / 1000)} s)`);
        }
        else {
            dur = (0, colors_1.gray)(` (${stats.duration} ms)`);
        }
        let out = `\n    ${(0, colors_1.gray)((0, colors_1.bold)(prefix))}${summary}${dur}\n`;
        if (!output)
            return out;
        this.verbose && Renderer.write(out);
    }
    runAllTitle({ whitelist }) {
        if (whitelist.length) {
            whitelist = ' for ' + (0, colors_1.gray)('[ ' + (0, colors_1.white)((0, colors_1.bold)(whitelist.join((0, colors_1.gray)(', ')))) + ' ]');
        }
        else {
            whitelist = '...';
        }
        // prettier-ignore
        if (!this.verbose) {
            Renderer.write((0, colors_1.white)(`\n--> Running tests${whitelist}`) + (0, colors_1.gray)(' (use -v param for details)'));
            Renderer.write('\n    ', 0);
        }
        else {
            Renderer.write((0, colors_1.gray)(`\n    Running tests${whitelist}`));
        }
    }
    runAllSuiteError({ error, name }) {
        error = Renderer.sanitizeError(error);
        if (this.verbose) {
            Renderer.write(`\n--> ${T2C.error(name)} ${(0, colors_1.gray)('--> ' + error)}\n`);
        }
        else {
            Renderer.write(T2C.skip('•') + ' ', 0);
        }
    }
    runAllStats({ stats, invalid }) {
        const title = (0, tinydate_1.default)('[{HH}:{mm}:{ss}] Summary: ')();
        const warn = invalid.length ? (0, colors_1.yellow)(` (invalid test files: ${invalid.length})`) : '';
        if (!this.verbose) {
            Renderer.write(''); // extra \n
        }
        // prettier-ignore
        Renderer.write('\n--> ' + `${this.stats(stats, title, false)}`.trim() + `${warn}\n`);
    }
    runAllErrorsSummary({ errorDetails, invalid }) {
        const errors = Object.entries(errorDetails);
        if (errors.length) {
            Renderer.write((0, colors_1.red)(`\n    Errors summary`));
            errors.forEach(([suiteName, list]) => {
                Renderer.write((0, colors_1.gray)(`\n--> `) + (0, colors_1.white)(suiteName));
                list.forEach(({ label, error }) => {
                    error = Renderer.sanitizeError(error);
                    Renderer.write(T2C.error(`    ${label}`) + (0, colors_1.gray)(` - ${error}`));
                });
            });
            Renderer.write(''); // extra \n
        }
        if (invalid.length) {
            Renderer.write(T2C.skip(`\n    Invalid files summary`), 2);
            invalid.forEach(({ label, error }) => {
                error = Renderer.sanitizeError(error);
                Renderer.write((0, colors_1.gray)(`--> `) + T2C.skip(label) + (0, colors_1.gray)(` --> ${error}`), 2);
            });
            Renderer.write(''); // extra \n
        }
    }
    // manual, direct output
    log(type, s) {
        Renderer.write((T2C[type] || colors_1.gray)(`[LOG]: ${s}`));
    }
    // view helpers
    static sanitizeError(e) {
        try {
            return (e || '')
                .toString()
                .replace(/^(Error:\s*)/i, '')
                .replace(process.cwd(), '')
                .replace(' [ERR_ASSERTION]', '')
                .replace(/\s\s+/g, ' ')
                .trim();
        }
        catch (e2) {
            // hm... this happens if using ts-node
            const m = 'Unable to convert error to string.';
            console.error((0, colors_1.red)(m), e);
            return m;
        }
    }
    static sanitizeStack(stack) {
        return ((stack || '')
            .split('\n')
            // shorten long absolute node_modules paths as relative
            .map((v) => v.replace(/(\([^\(]+node_modules)/, '(node_modules'))
            .map((v) => v.replace(process.cwd(), ''))
            .map((v) => v.replace(/\s\s+/g, ' ').trim())
            .filter(Boolean)
            .slice(1, 5) // skip first line (rendered via e.toString()) and reduce noise
            .join('\n        ')
            .trim());
    }
}
exports.Renderer = Renderer;
