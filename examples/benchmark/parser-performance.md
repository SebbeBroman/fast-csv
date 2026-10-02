# Parser performance rewrite

Measured October 2, 2026 on macOS arm64, Node v24.21.0. Baseline: upstream `4f36559`; candidate: the restored and corrected rewrite on `codex/parser-performance`. Raw measurements are in [parser-performance-results.json](./parser-performance-results.json).

## Compared with upstream

| Workload             | Wall time, ms (before → after) | CPU time, ms (before → after) | Peak RSS, MiB (before → after) |
| -------------------- | -----------------------------: | ----------------------------: | -----------------------------: |
| stream-nonquoted     |                  225.4 → 122.6 |                 236.8 → 125.0 |                  206.9 → 126.4 |
| stream-quoted        |                  298.6 → 157.2 |                 347.6 → 158.5 |                  208.8 → 130.2 |
| parser-nonquoted     |                   122.9 → 17.1 |                  149.5 → 33.3 |                  268.6 → 302.8 |
| parser-quoted        |                   193.5 → 59.6 |                  233.6 → 99.4 |                  314.0 → 329.8 |
| parser-custom-escape |                      3.9 → 1.1 |                     5.8 → 1.7 |                    78.3 → 54.7 |
| parser-comments      |                    89.2 → 15.7 |                  109.0 → 23.6 |                  267.0 → 210.4 |
| parser-ignore-empty  |                   171.2 → 25.7 |                  194.1 → 36.3 |                  260.2 → 254.9 |

Streaming 100,000 rows takes 46–47% less wall time, 47–54% less CPU, and 38–39% less peak RSS. Whole-buffer parser benchmarks are faster but use about 5–13% more peak RSS. Keep that memory tradeoff visible; streaming and whole-buffer parsing have different allocation and garbage-collection behavior. These measurements do not establish the cause of the RSS increase.

## Further gains beyond the stash

| Workload             | Restored stash, ms | Corrected rewrite, ms |
| -------------------- | -----------------: | --------------------: |
| parser-custom-escape |              52.28 |                  1.04 |
| parser-comments      |              18.54 |                 16.76 |
| parser-ignore-empty  |              37.72 |                 26.79 |

- Cache the next quote when scanning custom escapes. The stashed implementation rescanned the remaining suffix for every escape, producing quadratic work. The 100,000-character stress case improves by roughly 50× compared with the stash.
- Scan comment line endings directly without slicing the remaining input and applying a regex. The comment workload improves by about 10%.
- Detect empty rows by testing fields and stopping at the first non-whitespace field, avoiding a joined string and replacement. The `ignoreEmpty` workload improves by about 29%.

## Correctness changes

- Preserve existing behavior for multi-character quote, escape, and comment options; comparing only their first character changed parsing behavior.
- Wait for the next chunk after a comment ends with CR, so a split CRLF does not emit an extra empty row.
- Preserve malformed-column error previews, and keep scanner compatibility methods.
- Add regressions that split representative CSV inputs at every character and UTF-8 byte boundary, including embedded newlines, escaped quotes, custom escapes, whitespace delimiters, Unicode, comments, and ignored empty rows.

## Method

Each workload/version runs in three fresh, sequential Node processes, alternating version order. Each child warms up once, then runs five measured iterations. Reported time and CPU metrics are the median of the three per-process averages. CPU is user plus system CPU time from `process.cpuUsage()` and includes garbage-collector threads, so it can exceed wall time. Raw JSON keeps user and system CPU separate. RSS is the median of the process peak resident sets from `process.resourceUsage().maxRSS`, including initialization and warm-up; it is not an allocation delta. No forced garbage collection is used.

Streaming cases use the existing 100,000-row benchmark assets, headers, and the same property-renaming transform as `index.js`. File I/O is included. Parser cases parse an entire input buffer and count/validate the resulting rows; file loading is outside the timed region. Synthetic cases cover a long quoted field containing 50,000 custom escapes, 100,000 comments plus data rows, and 100,000 empty/data row pairs.

Benchmarking is observational, without timing assertions. Stream row processing, transforms, and validation remain unchanged. Very large incomplete records are still reparsed when new chunks arrive; maintaining parser state across chunks would require a separate change.

## Reproduce

From the repository root:

```sh
pnpm --filter @fast-csv/parse run build
node examples/benchmark/compare.js git:origin/main packages/parse/build/src
node examples/benchmark/compare.js 'git:stash@{0}' packages/parse/build/src
```

`git:<ref>` compiles that source revision into a temporary directory without changing the checkout and removes the directory when finished. Both version arguments also accept compiled source directories. Pin the recorded commit hashes when reproducing after refs move.

## Small tables: 20–400 rows

These cases use the first 20, 100, or 400 data rows plus their header from the same four-column assets. Unlike the large streaming benchmark, the input is an already-loaded Buffer; filesystem I/O is excluded. The public stream includes header mapping and the same property-renaming transform. The core parser includes creating a fresh parser and parser options.

Each workload/version runs in three fresh sequential processes with alternating version order. Warm up 200 times, then measure 1,000 stream parses or 2,000 core parses per process. Report the median of the process averages. RSS is again the median of process peaks across all iterations, not the memory cost of a single small table. These are warm measurements and do not include starting Node or loading modules.

| Workload             | Wall time, ms (before → after) | CPU time, ms (before → after) | Peak RSS, MiB (before → after) |
| -------------------- | -----------------------------: | ----------------------------: | -----------------------------: |
| stream-nonquoted-20  |                  0.110 → 0.087 |                 0.153 → 0.123 |                    89.1 → 92.8 |
| stream-quoted-20     |                  0.125 → 0.094 |                 0.159 → 0.138 |                    91.8 → 92.8 |
| parser-nonquoted-20  |                  0.024 → 0.005 |                 0.029 → 0.011 |                    82.8 → 80.3 |
| parser-quoted-20     |                  0.041 → 0.012 |                 0.046 → 0.018 |                    87.5 → 87.7 |
| stream-nonquoted-100 |                  0.288 → 0.170 |                 0.299 → 0.180 |                   100.2 → 97.9 |
| stream-quoted-100    |                  0.375 → 0.217 |                 0.397 → 0.231 |                   103.1 → 91.0 |
| parser-nonquoted-100 |                  0.108 → 0.013 |                 0.112 → 0.018 |                    82.3 → 83.0 |
| parser-quoted-100    |                  0.190 → 0.053 |                 0.195 → 0.057 |                    87.3 → 87.8 |
| stream-nonquoted-400 |                  0.987 → 0.579 |                 0.965 → 0.541 |                  126.7 → 101.1 |
| stream-quoted-400    |                  1.346 → 0.706 |                 1.322 → 0.684 |                  131.7 → 103.9 |
| parser-nonquoted-400 |                  0.426 → 0.046 |                 0.430 → 0.048 |                    98.7 → 83.0 |
| parser-quoted-400    |                  0.740 → 0.203 |                 0.746 → 0.206 |                   136.3 → 87.9 |

For the public stream, wall time falls by about 21–25% at 20 rows, 41–42% at 100 rows, and 41–48% at 400 rows. The absolute savings are about 23–31 microseconds, 118–159 microseconds, and 408–640 microseconds respectively. At the smallest sizes, stream construction, header handling, and transforms account for a larger share of total time. CPU falls by 13–20%, 40–42%, and 44–48% respectively.

RSS at 20 rows is mixed and slightly higher for the candidate; at 400 rows, repeated public-stream parsing peaks at 101–104 MiB instead of 127–132 MiB. This does not imply that each 400-row table consumes that much memory. Core parsing alone is roughly 5–9× faster for unquoted fields and 3–4× faster for quoted fields.

```sh
node examples/benchmark/compare.js git:origin/main packages/parse/build/src --small
```
