import { green, magenta, red, yellow, cyan, bold, gray, white } from 'kleur/colors';
import tinydate from 'tinydate';
import { RenderData } from './test-runner.js';

const T2C = { error: red, test: green, skip: yellow, todo: magenta, warn: yellow };

const ONLY = 'only';
const TEST = 'test';
const TODO = 'todo';
const SKIP = 'skip';

export class Renderer {
	constructor(public verbose = true, clear = false) {
		clear && console.clear();
	}

	static write(s = '', nlCount = 1, nlChar = '\n') {
		process.stdout.write(`${s}` + `${nlChar}`.repeat(nlCount));
	}

	suiteName({ suiteName }: Partial<RenderData>) {
		if (this.verbose) {
			Renderer.write(white(bold(`\n--> ${suiteName} `)), 2);
		}
	}

	result({ type, label, error, duration }: Partial<RenderData>) {
		// NOTE: "test type" and "color type" are not the same
		let ctype = error && type === TEST ? 'error' : type;

		if (!this.verbose) {
			return Renderer.write(T2C[ctype]('•') + ' ', 0);
		}

		const icon = T2C[ctype](`[${ctype === TEST && !error ? 'x' : ' '}] `);
		let e = Renderer.sanitizeError(error);
		if (e) {
			e = gray(' - ') + (type !== TEST ? gray : white)(e);
		}

		const prefix = type === TEST ? '' : `(${type}) `;

		Renderer.write(T2C[ctype](`    ${icon}${prefix}${label}${e}`));
		if (error && error.stack) {
			Renderer.write(`        ${gray(Renderer.sanitizeStack(error.stack))}`);
		}
	}

	stats(stats, prefix = 'Summary: ', output = true) {
		let summary = [
			stats.ok ? T2C.test(`OK ${stats.ok}`) : gray('0 tests'),
			stats.errors ? T2C.error(`errors ${stats.errors}`) : '',
			stats.skip ? T2C.skip(`skipped ${stats.skip}`) : '',
			stats.todo ? T2C.todo(`todo ${stats.todo}`) : '',
		]
			.filter(Boolean)
			.join(gray(', '));

		let dur = '';
		if (stats.duration > 1000) {
			dur = gray(` (${Math.round(stats.duration / 1000)} s)`);
		} else {
			dur = gray(` (${stats.duration} ms)`);
		}

		let out = `\n    ${gray(bold(prefix))}${summary}${dur}\n`;

		if (!output) return out;

		this.verbose && Renderer.write(out);
	}

	runAllTitle({ whitelist }) {
		if (whitelist.length) {
			whitelist = ' for ' + gray('[ ' + white(bold(whitelist.join(gray(', ')))) + ' ]');
		} else {
			whitelist = '...';
		}
		// prettier-ignore
		if (!this.verbose) {
			Renderer.write(white(`\n--> Running tests${whitelist}`) + gray(' (use -v param for details)'));
			Renderer.write('\n    ', 0);
		} else {
			Renderer.write(gray(`\n    Running tests${whitelist}`));
		}
	}

	runAllSuiteError({ error, name }) {
		error = Renderer.sanitizeError(error);
		if (this.verbose) {
			Renderer.write(`\n--> ${T2C.error(name)} ${gray('--> ' + error)}\n`);
		} else {
			Renderer.write(T2C.skip('•') + ' ', 0);
		}
	}

	runAllStats({ stats, invalid }) {
		const title = tinydate('[{HH}:{mm}:{ss}] Summary: ')();
		const warn = invalid.length ? yellow(` (invalid test files: ${invalid.length})`) : '';

		if (!this.verbose) {
			Renderer.write(''); // extra \n
		}

		// prettier-ignore
		Renderer.write(
			'\n--> ' + `${this.stats(stats, title, false)}`.trim() + `${warn}\n`
		);
	}

	runAllErrorsSummary({ errorDetails, invalid }) {
		const errors = Object.entries(errorDetails);
		if (errors.length) {
			Renderer.write(red(`\n    Errors summary`));
			errors.forEach(([suiteName, list]) => {
				Renderer.write(gray(`\n--> `) + white(suiteName));
				(list as any).forEach(({ label, error }) => {
					error = Renderer.sanitizeError(error);
					Renderer.write(T2C.error(`    ${label}`) + gray(` - ${error}`));
				});
			});
			Renderer.write(''); // extra \n
		}
		if (invalid.length) {
			Renderer.write(T2C.skip(`\n    Invalid files summary`), 2);
			invalid.forEach(({ label, error }) => {
				error = Renderer.sanitizeError(error);
				Renderer.write(gray(`--> `) + T2C.skip(label) + gray(` --> ${error}`), 2);
			});
			Renderer.write(''); // extra \n
		}
	}

	// manual, direct output
	log(type, s) {
		Renderer.write((T2C[type] || gray)(`[LOG]: ${s}`));
	}

	// view helpers

	static sanitizeError(e: Error): string {
		try {
			return (e || '')
				.toString()
				.replace(/^(Error:\s*)/i, '')
				.replace(process.cwd(), '')
				.replace(' [ERR_ASSERTION]', '')
				.replace(/\s\s+/g, ' ')
				.trim();
		} catch (e2) {
			// hm... this happens if using ts-node
			const m = 'Unable to convert error to string.';
			console.error(red(m), e);
			return m;
		}
	}

	static sanitizeStack(stack): string {
		return (
			(stack || '')
				.split('\n')
				// shorten long absolute node_modules paths as relative
				.map((v) => v.replace(/(\([^\(]+node_modules)/, '(node_modules'))
				.map((v) => v.replace(process.cwd(), ''))
				.map((v) => v.replace(/\s\s+/g, ' ').trim())
				.filter(Boolean)
				.slice(1, 5) // skip first line (rendered via e.toString()) and reduce noise
				.join('\n        ')
				.trim()
		);
	}
}
