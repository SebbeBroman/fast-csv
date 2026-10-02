# Browser CSV in this fork

The `@sebbro/fast-csv` fork ships one ESM-only package, keeps the optimized CSV parser, and adds browser parsing and formatting entry points. It parses already-decoded strings without Node streams, filesystem APIs, Buffer, process, or runtime dependencies. It also works inside a Web Worker.

```ts
import { parseText, parseTextWithInfo } from '@sebbro/fast-csv/browser';

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

Parser transforms and validators are synchronous; Promise-returning callbacks throw an error. Return `null` from a transform to filter out a row. Malformed CSV, duplicate headers, and non-strict header mismatches throw errors.

`parseTextWithInfo` returns `{ rows, headers, invalidRows, rowCount }`. Strict column mismatches and failed validations appear in `invalidRows`, with one-based data row numbers. Invalid and filtered rows count toward `maxRows`; skipped rows and the header row do not. `parseText` returns only valid rows, so use `parseTextWithInfo` when you need validation feedback. Strict mismatch reasons are retained here, even though the upstream Node stream currently drops them.

This API parses the complete string before mapping/filtering rows. `maxRows` limits processed data rows; it does not limit scanning the input. It is intended for small and moderate tables. Use a worker for large inputs if parsing would otherwise block the UI. Decoding files and network responses is the caller's responsibility (`File.text()`, `Response.text()`, or `TextDecoder`). Node file APIs, streams, encoding selection, and callback-based asynchronous transforms are not part of this browser entry point. Browser formatting uses the existing formatter rules, including headers, escaping, BOMs, and synchronous or callback-based transforms:

```ts
import { writeToString } from '@sebbro/fast-csv/browser';
const exported = await writeToString(imported, { headers: true });
```

Formatting returns a Promise of the full CSV string and does not use Node streams.

The parser speedup is already included. [Benchmarks](examples/benchmark/parser-performance.md) cover Node performance and memory. The native browser smoke test covers ESM loading, Unicode, escaped quotes, header mapping, comments, strict mismatch feedback, transforms, validation, and 20–400-row parsing. Browser timing figures are illustrative warm-up measurements rather than cross-version comparisons. In Chrome 154, this browser path took approximately 0.006/0.011 ms for 20 unquoted/quoted rows and 0.058/0.191 ms for 400 rows, including header mapping. [Recorded browser results](examples/benchmark/browser-smoke-results.json) include all three table sizes.

## Bundle size

The browser parser is 9.8 kB minified / 3.3 kB gzip / 3.0 kB Brotli. Parser and formatter together are 14.4 kB / 4.6 kB / 4.2 kB. Parser-only imports from `@sebbro/fast-csv/browser` remove the formatter. These are ES2022 production bundles with no Node polyfills, source maps, or application code. [Measurements and reproduction](examples/benchmark/bundle-size.md). [Further optimizations](examples/benchmark/browser-optimization.md) include CPU, time, and RSS comparisons for 20–400 rows.

## ESM-only packaging

One package ships native ESM JavaScript and TypeScript declarations, with no runtime dependencies. The `/node` exports retain the parsing/formatting stream APIs; import them with ESM:

```js
import { parseString, writeToString } from '@sebbro/fast-csv/node';
```

No CommonJS build is shipped, and historical deep imports into `build/src` are not supported. Existing CommonJS consumers must migrate to `import`/dynamic `import()`, or use a Node version that supports loading synchronous ESM with `require()`. The package root aliases `/node`. Browser imports use the explicit `/browser` subpath; importing the Node root still brings Node stream/filesystem dependencies. The browser entry point exposes parsing and formatting. Imports are tree-shaken, so parser-only consumers do not bundle the formatter.

To use this local fork without publishing, build and pack one package, then install its archive in your application:

```sh
pnpm --filter @sebbro/fast-csv run build
pnpm --filter @sebbro/fast-csv pack --pack-destination /tmp/fast-csv-fork
npm install /tmp/fast-csv-fork/sebbro-fast-csv-1.0.0.tgz
```

The private parser/formatter workspaces are compiled into the package. The archive needs no upstream packages. Version `1.0.0` starts this fork's independent version history.

## Development checks

```sh
pnpm --filter @sebbro/fast-csv run build
pnpm exec jest --runInBand
node scripts/verify-packages.cjs
pnpm run bundle:size
python3 -m http.server 8765 --bind 127.0.0.1
```

Open `http://127.0.0.1:8765/scripts/browser-smoke.html` for the native browser check. The development page loads the single package build and its relative internal modules; bundlers resolve the browser subpath directly. The package verification script checks runtime exports, traverses the entire browser module graph to reject Node imports/globals, and type-checks browser consumers without Node declarations.

Only `@sebbro/fast-csv` is publishable; the source parser/formatter packages remain private. Building, verifying, and packing do not publish or push anything.
