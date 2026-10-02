# Browser parsing in this fork

This fork ships ESM-only packages, keeps the optimized CSV parser, and adds a synchronous browser entry point. It parses already-decoded strings without Node streams, filesystem APIs, Buffer, process, or runtime dependencies. It also works inside a Web Worker.

```ts
import { parseText, parseTextWithInfo } from 'fast-csv/browser';
// Or import from '@fast-csv/parse/browser' to depend only on the parser package.

const rows = parseText('name,value\nAlice,1\nBob,2', { headers: true });
// [{ name: 'Alice', value: '1' }, { name: 'Bob', value: '2' }]

const csv = await file.text();
const imported = parseText(csv, { headers: true, trim: true });
```

Without options, `parseText` returns `string[][]`. Options use the existing CSV parsing rules: delimiter, quote, escape, comments, trimming, ignoring empty rows, headers and header transforms, renaming headers, strict column handling, discarding extra columns, skipping lines/rows, and limiting data rows.

For typed objects and transformations:

```ts
const rows = parseText<{ name: string; value: string }, { name: string; value: number }>(csv, {
    headers: true,
    transform: (row) => ({ name: row.name, value: Number(row.value) }),
    validate: (row) => Number.isFinite(row.value),
});
```

Transforms and validators are synchronous. Return `null` from a transform to filter out a row. Malformed CSV, duplicate headers, and non-strict header mismatches throw errors.

`parseTextWithInfo` returns `{ rows, headers, invalidRows, rowCount }`. Strict column mismatches and failed validations appear in `invalidRows`, with one-based data row numbers. Invalid and filtered rows count toward `maxRows`; skipped rows and the header row do not. `parseText` returns only valid rows, so use `parseTextWithInfo` when you need validation feedback. Strict mismatch reasons are retained here, even though the upstream Node stream currently drops them.

This API parses the complete string before mapping/filtering rows. `maxRows` limits processed data rows; it does not limit scanning the input. It is intended for small and moderate tables. Use a worker for large inputs if parsing would otherwise block the UI. Decoding files and network responses is the caller's responsibility (`File.text()`, `Response.text()`, or `TextDecoder`). Node file APIs, streams, encoding selection, and callback-based asynchronous transforms are not part of this browser entry point. CSV formatting remains available through the Node entry point.

The parser speedup is already included. [Benchmarks](examples/benchmark/parser-performance.md) cover Node performance and memory. The native browser smoke test covers ESM loading, Unicode, escaped quotes, header mapping, comments, strict mismatch feedback, transforms, validation, and 20–400-row parsing. Browser timing figures are illustrative warm-up measurements rather than cross-version comparisons. In Chrome 154, this browser path took approximately 0.006/0.011 ms for 20 unquoted/quoted rows and 0.058/0.191 ms for 400 rows, including header mapping. [Recorded browser results](examples/benchmark/browser-smoke-results.json) include all three table sizes.

## ESM-only packaging

All three packages ship native ESM JavaScript and TypeScript declarations. The Node root exports retain the parsing/formatting stream APIs; import them with ESM:

```js
import { parseString, writeToString } from 'fast-csv';
```

No CommonJS build is shipped, and historical deep imports into `build/src` are not supported. Existing CommonJS consumers must migrate to `import`/dynamic `import()`, or use a Node version that supports loading synchronous ESM with `require()`. Browser imports use the explicit `/browser` subpath; importing the Node root still brings Node stream/filesystem dependencies. The umbrella browser entry point exposes parsing; formatting remains in the Node root.

To use this local fork without publishing, build and pack all three packages, then install all three generated archives in your application:

```sh
pnpm -r --filter './packages/*' run build
pnpm -r --filter './packages/*' pack --pack-destination /tmp/fast-csv-fork
npm install /tmp/fast-csv-fork/fast-csv-parse-5.0.7.tgz /tmp/fast-csv-fork/fast-csv-format-5.0.7.tgz /tmp/fast-csv-fork/fast-csv-5.0.7.tgz
```

Installing only the umbrella archive can resolve its dependencies to upstream packages; install the parser and formatter archives too. For a parser-only browser application, install just the parser archive and import `@fast-csv/parse/browser`.

## Development checks

```sh
pnpm -r --filter './packages/*' run build
pnpm exec jest --runInBand
node scripts/verify-packages.cjs
python3 -m http.server 8765 --bind 127.0.0.1
```

Open `http://127.0.0.1:8765/scripts/browser-smoke.html` for the native browser check. The import map in that development page connects the umbrella package to the local parser build; bundlers resolve the package subpath directly. The package verification script checks runtime exports, traverses the entire browser module graph to reject Node imports/globals, and type-checks browser consumers without Node declarations.

The existing upstream package names are retained for local development. Nothing is published by building or verifying this fork. Choose a separate package scope/version before any public release.
