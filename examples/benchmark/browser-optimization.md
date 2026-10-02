# Additional browser optimizations

Compared with local commit `069a97c` on 2026-10-02. These changes keep parser options and formatter callbacks available while avoiding work in the common browser paths:

- The parser now uses `CoreScanner`; the legacy Scanner/Token helpers remain separately available to internal consumers and are excluded from parser bundles.
- Plain array parsing returns the parsed rows directly when no mapping, filtering, skipping or limits are requested.
- Legacy delimiter escaping and token regex construction happen only when accessed, rather than on every parse.
- Quoted fields return a string or null directly, removing an intermediate result object for each field.
- Formatting without asynchronous callback transforms collects rows synchronously and returns one Promise for the completed output, avoiding a Promise and await per row. The callback transform path remains supported.

## Measured performance

Browser APIs measured in **Node/V8**, not Chromium: 500 warm-ups and 2,000 measured calls per scenario, three fresh process samples per version, sequential alternating versions. Values below are medians of process means. File reading/decoding happens before timing. CPU includes user and system time; short scenarios can include JIT or garbage collection work and should not be treated as exact percentage predictions for an application.

| API     | Rows | CSV       | Wall before µs | Wall after µs | CPU before µs | CPU after µs |
| ------- | ---: | --------- | -------------: | ------------: | ------------: | -----------: |
| arrays  |   20 | nonquoted |           4.05 |          3.48 |         10.75 |         7.82 |
| headers |   20 | nonquoted |           4.96 |          4.56 |          8.45 |         7.93 |
| format  |   20 | nonquoted |          14.04 |         11.76 |         28.98 |        20.90 |
| arrays  |  100 | nonquoted |          12.72 |         11.17 |         12.69 |        11.17 |
| headers |  100 | nonquoted |          19.24 |         18.31 |         19.38 |        18.53 |
| format  |  100 | nonquoted |          54.51 |         45.43 |         55.47 |        49.62 |
| arrays  |  400 | nonquoted |          47.14 |         44.15 |         49.92 |        44.89 |
| headers |  400 | nonquoted |          71.82 |         67.85 |         71.64 |        71.65 |
| format  |  400 | nonquoted |         207.46 |        173.48 |        207.11 |       173.18 |
| arrays  |   20 | quoted    |          10.24 |          9.64 |         10.32 |         9.83 |
| headers |   20 | quoted    |          11.77 |         11.04 |         11.75 |        11.04 |
| format  |   20 | quoted    |          17.15 |         14.87 |         17.04 |        16.08 |
| arrays  |  100 | quoted    |          48.93 |         45.96 |         48.77 |        45.93 |
| headers |  100 | quoted    |          54.17 |         53.09 |         54.71 |        53.79 |
| format  |  100 | quoted    |          76.72 |         67.66 |         79.28 |        69.01 |
| arrays  |  400 | quoted    |         192.12 |        187.23 |        192.20 |       187.02 |
| headers |  400 | quoted    |         216.44 |        208.00 |        216.19 |       207.61 |
| format  |  400 | quoted    |         302.26 |        268.70 |        301.69 |       268.19 |

The measured changes reduce parsing time by approximately 2–14%, and formatting time by 11–17%, across these fixtures. Small differences are within normal measurement variability. CPU reductions vary by case; notably, 400-row unquoted parsing with headers shows essentially unchanged CPU despite a lower wall-time mean.

Median peak RSS for the **complete repeated suite** was 92.72 → 93.00 MiB. This is not per-table memory, and shows no meaningful RSS improvement.

Reproduce after building the candidate:

```sh
pnpm -r --filter './packages/*' run build
node scripts/browser-benchmark.cjs git:069a97c .
```

The script compiles the baseline revision into temporary native ESM modules and runs the built candidate. [Raw samples, CPU and timing results](browser-optimization-results.json). The native Chromium browser smoke check also passes for parsing and formatting without Node polyfills; its timings are illustrative, without a controlled baseline comparison.

## Size and remaining opportunities

Parser-only bundle: 10,902 → 9,806 bytes minified; gzip 3,559 → 3,304 bytes. Combined browser exports: 15,388 → 14,438 bytes; gzip 4,852 → 4,645 bytes. The synchronous formatter fast path adds 146 minified bytes / 41 gzip bytes, trading a small formatter-only size increase for less per-row overhead. [Current bundle measurements](bundle-size.md).

For larger files, incremental parsing could avoid materializing all input rows and make `maxRows` stop scanning early. That would require explicit handling of chunk boundaries, headers and validation; it remains outside this small-table optimization. A worker can keep parsing off the UI thread but does not make parsing itself faster. A reusable configured parser could also reduce setup costs across many tiny tables, if that pattern becomes important in the application.
