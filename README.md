# @sebbro/fast-csv

An ESM-only fork of [C2FO/fast-csv](https://github.com/C2FO/fast-csv) with an optimized parser and browser APIs that need no Node polyfills. One package includes parsing, formatting, and Node stream adapters, with no runtime dependencies.

## Install

```sh
npm install @sebbro/fast-csv
```

## Browser

```ts
import { parseText, parseTextWithInfo, writeToString } from '@sebbro/fast-csv/browser';

const rows = parseText('name,value\nAlice,1\nBob,2', { headers: true });
// [{ name: 'Alice', value: '1' }, { name: 'Bob', value: '2' }]

const imported = parseText(await file.text(), { headers: true, trim: true });
const exported = await writeToString(imported, { headers: true });
```

`parseText` parses decoded text synchronously and returns `string[][]` by default. It supports headers, quoting, custom delimiters/escapes, comments, trimming, skipping/limiting rows, and synchronous transforms/validation. `parseTextWithInfo` also returns `{ rows, headers, invalidRows, rowCount }`, including strict column mismatch reasons. Return `null` from a transform to filter a row. Promise-returning parser callbacks are rejected.

`writeToString` returns a Promise of the full CSV string and supports formatter options and synchronous or callback-based transforms. Promise-returning formatter transforms are rejected; use a callback for asynchronous work.

Browser imports work without Node streams, filesystem APIs, Buffer, or runtime dependencies. They also work in a Web Worker. File decoding is the caller's responsibility. Parsing materializes the full input before processing rows; `maxRows` does not stop scanning early. For large files, use a worker to avoid blocking the UI or use Node streams where available.

The parser-only browser bundle is approximately **9.7 kB minified / 3.3 kB gzip**. Parsing and formatting together are approximately **14.3 kB / 4.6 kB gzip**. Importing only parsing functions excludes the formatter when bundled. Measurements use Vite, an ES2022 target, and no source maps; application bundlers can produce slightly different sizes.

## Node.js

```js
import { parseString, writeToString } from '@sebbro/fast-csv/node';

const rows = [];
for await (const row of parseString('name,value\nAlice,1', { headers: true })) {
    rows.push(row);
}
const csv = await writeToString(rows, { headers: true });
```

The Node entry point retains the parsing and formatting stream APIs, including `parse`, `parseString`, `parseStream`, `parseFile`, `format`, `write`, and the `writeTo*` helpers. The package root is an alias for `/node`. The explicit `/browser` entry excludes Node builtins and exposes the text API; `/node` is an optional alias. Conditional exports are avoided because the two environments expose different APIs. Node.js 20 or newer is required by the Node adapter.

## Migrating from fast-csv

- Install only `@sebbro/fast-csv`; separate upstream parser/formatter packages are unnecessary.
- Replace `fast-csv` imports with `@sebbro/fast-csv/node`, or the root alias `@sebbro/fast-csv`.
- Use `@sebbro/fast-csv/browser` for browser applications. Node imports contain Node builtins.
- Native ESM and TypeScript declarations are shipped. CommonJS builds and historical `build/src` deep imports are not shipped; CommonJS applications can use dynamic `import()`.
- Fork versions start at `1.0.0` and do not track upstream version numbers. Browser APIs are additions; the Node API retains the upstream interface with parser performance and correctness fixes.

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

The library lives in `src/parse` and `src/format` within one root package. Vite builds the ESM entry points and TypeScript emits declarations. Vitest runs tests; Oxlint and Oxfmt handle linting and formatting. There are no commit hooks. Examples and documentation are private workspace projects. Build, tests, verification, and packing do not publish anything. `pnpm run release` publishes only `@sebbro/fast-csv` to npm; it does not create a GitHub release or push Git changes.

## Attribution and license

Forked from fast-csv by Doug Martin and C2FO. The upstream project and its contributors are credited for the original parser, formatter, and stream APIs. MIT licensed; the upstream copyright and license notice are included in the package.
