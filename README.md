# Simple testing framework for node.js

Simple, sequential, exception based test runner for node js.

## Features

- usual `test`, `skip`, `only`, `todo` api
- usual `before`, `beforeEach`, `afterEach`, `after` hooks
- async support
- speed
- timeout checks

#### Intentionally absent features

- parallel testing
- assertions ([tip](https://nodejs.org/api/assert.html))
- CLI (read more below)

## Installation

```shell
npm i -D @marianmeres/test-runner
```

## Quick start

```js
const suite = new TestRunner('My suite');

suite.test('My test', () => {
    if (false) {
        throw new Error('...')
    }
});

suite.run();
```

See [examples](examples/) for more.

## CLI

```shell
npx test-runner [-d some-dir] [-d another-dir]
```

Or there is a `TestRunner.runAll` api, so something like this should work fine:

```js
// tests/index.js
const args = process.argv.slice(2);
const verbose = args.includes('-v');
const whitelist = args.filter((v) => v !== '-v');

TestRunner.runAll([__dirname, '../src'], { verbose, whitelist });
```
runnable as
```shell
$ node tests [-v] [whitelist]
```
or also watchable as
```bash
$ nodemon -q tests -- [-v] [whitelist]
```

#### How to `TestRunner.runAll([dirs], options)` ?

The `TestRunner.runAll` looks by default for `[<path>/]<file>.test.[tj]s`. Each test file must
have the suite instance "default exported":

```js
// src/some.test.js
const suite = new TestRunner('My suite');

// tests definitions here...

export default suite;
// or depending on your env:
// module.exports = suite;
```

See [examples](examples/) for more.

## Screenshots

Screenshots are taken from [examples](examples/).

#### `node examples` (non verbose)

![Non verbose mode](https://github.com/marianmeres/test-runner/blob/master/screenshots/non-verbose.png?raw=true)

#### `node examples -v` (verbose)

![Verbose mode](https://github.com/marianmeres/test-runner/blob/master/screenshots/verbose.png?raw=true)

## Limitations

This runner does not spawn the actual tests executions into separate child processes.
This is an intentional choice, but it comes with the price of not beeing able to truly
isolate/kill/cancel the test execution and its context (such as pending `setTimeout`s)
which can sometimes lead to unexpected results.

## Api

Check the [definition](./dist/mjs/test-runner.d.ts)
[files](./dist/mjs/renderer.d.ts).

