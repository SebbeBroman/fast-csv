# @sebbebroman/fast-csv

An isomorphic, ESM-only fork of [C2FO/fast-csv](https://github.com/C2FO/fast-csv) with an optimized parser and browser APIs that need no Node polyfills. One package includes parsing, formatting, and Node stream adapters, with no runtime dependencies.

## Install

```sh
npm install @sebbebroman/fast-csv
```

## Browsers, workers, and Node.js

```ts
import { parseText, parseTextWithInfo, writeToString } from '@sebbebroman/fast-csv';

const rows = parseText('name,value\nAlice,1\nBob,2', { headers: true });
// [{ name: 'Alice', value: '1' }, { name: 'Bob', value: '2' }]

const exported = await writeToString(rows, { headers: true });
```

`parseText` parses decoded text synchronously and returns `string[][]` by default. It supports headers, quoting, custom delimiters/escapes, comments, trimming, skipping/limiting rows, and synchronous transforms/validation. `parseTextWithInfo` also returns `{ rows, headers, invalidRows, rowCount }`, including strict column mismatch reasons. Return `null` from a transform to filter a row. Promise-returning parser callbacks are rejected.

`writeToString` returns a Promise of the full CSV string and supports formatter options and synchronous or callback-based transforms. Promise-returning formatter transforms are rejected; use a callback for asynchronous work.

The package root works in browsers, workers, and Node.js without Node streams, filesystem APIs, Buffer, or runtime dependencies. They also work in a Web Worker. File decoding is the caller's responsibility. Parsing materializes the full input before processing rows; `maxRows` does not stop scanning early. For large files, use a worker to avoid blocking the UI or use Node streams where available.

The parser-only browser bundle is approximately **9.7 kB minified / 3.2 kB gzip**. Parsing and formatting together are approximately **14.2 kB / 4.5 kB gzip**. Importing only parsing functions excludes the formatter when bundled. Measurements use Vite, an ES2022 target, and no source maps; application bundlers can produce slightly different sizes.

## Node.js streams and files

```js
import { parseString, writeToString } from '@sebbebroman/fast-csv/node';

const rows = [];
for await (const row of parseString('name,value\nAlice,1', { headers: true })) {
    rows.push(row);
}
const csv = await writeToString(rows, { headers: true });
```

The `/node` entry point retains the parsing and formatting stream APIs, including `parse`, `parseString`, `parseStream`, `parseFile`, `format`, `write`, and the `writeTo*` helpers. Node.js 20 or newer is required by this adapter. The root always exposes the portable text API, including when imported in Node.js. `/browser` is a compatibility alias for the root. There is no environment-dependent switching of exports.

## Migrating from fast-csv

- Install only `@sebbebroman/fast-csv`; separate upstream parser/formatter packages are unnecessary.
- Replace stream/file imports from `fast-csv` or earlier fork versions with `@sebbebroman/fast-csv/node`.
- Use `@sebbebroman/fast-csv` for portable text parsing and formatting in any environment. Existing `/browser` imports continue to work.
- Native ESM and TypeScript declarations are shipped. CommonJS builds and historical `build/src` deep imports are not shipped; CommonJS applications can use dynamic `import()`.
- Fork versions start at `0.1.0` and do not track upstream version numbers. `0.x` means the API may still change before `1.0.0`. The root exposes the text API; the Node API retains the upstream interface with parser performance and correctness fixes.

See [upstream API documentation](https://c2fo.github.io/fast-csv) for Node parsing/formatting options. Those docs describe upstream package names; use this fork's imports above.

## Development

```sh
# Development requires Node.js 22.12+ (the published Node API supports Node.js 20+)
pnpm install --frozen-lockfile
pnpm run build
pnpm run test:unit
node scripts/verify-packages.cjs
pnpm run bundle:size
pnpm pack --pack-destination /tmp/fast-csv-fork
```

The library lives in `src/parse` and `src/format` within one root package. Vite builds the ESM entry points and TypeScript emits declarations. Vitest runs tests; Oxlint and Oxfmt handle linting and formatting. There are no commit hooks. Examples are private workspace projects. Build, tests, verification, and packing do not publish anything. `pnpm run release` publishes only `@sebbebroman/fast-csv` to npm; it does not create a GitHub release or push Git changes.

## Attribution and license

Forked from fast-csv by Doug Martin and C2FO. The upstream project and its contributors are credited for the original parser, formatter, and stream APIs. MIT licensed; the upstream copyright and license notice are included in the package.

This is an unofficial fork. It is not affiliated with, sponsored, or endorsed by C2FO. The `fast-csv` name and related trademarks belong to their respective owners and are used here only to identify the origin of the project. Bug reports about this fork belong in [this repository](https://github.com/SebbeBroman/fast-csv/issues); bugs in upstream `fast-csv` belong in [C2FO/fast-csv](https://github.com/C2FO/fast-csv/issues).
