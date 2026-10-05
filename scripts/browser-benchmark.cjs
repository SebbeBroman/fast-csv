// Compare the browser APIs with a git revision, using isolated Node processes.
// node scripts/browser-benchmark.cjs git:069a97c .
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { pathToFileURL } = require('node:url');
const { execFileSync, spawnSync } = require('node:child_process');
const { performance } = require('node:perf_hooks');
const root = path.resolve(__dirname, '..');
const runs = 2000;
const warmups = 500;
const samples = 3;
const median = (values) => [...values].sort((a, b) => a - b)[Math.floor(values.length / 2)];
const temporary = [];
function resolveVersion(argument) {
    if (!argument.startsWith('git:')) return path.resolve(argument);
    const revision = argument.slice(4);
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'fast-csv-browser-bench-'));
    temporary.push(directory);
    const ts = require('typescript');
    for (const name of ['parse', 'format']) {
        const prefix = execFileSync('git', ['ls-tree', '-r', '--name-only', revision, `src/${name}/`], {
            cwd: root,
            encoding: 'utf8',
        }).trim()
            ? `src/${name}/`
            : `packages/${name}/src/`;
        const files = execFileSync('git', ['ls-tree', '-r', '--name-only', revision, prefix], {
            cwd: root,
            encoding: 'utf8',
        });
        const dest = path.join(directory, 'packages', name, 'build/esm');
        fs.mkdirSync(dest, { recursive: true });
        fs.writeFileSync(path.join(dest, 'package.json'), '{"type":"module"}');
        for (const file of files
            .trim()
            .split('\n')
            .filter((item) => item.endsWith('.ts'))) {
            const output = path.join(dest, 'src', file.slice(prefix.length).replace(/\.ts$/, '.js'));
            fs.mkdirSync(path.dirname(output), { recursive: true });
            const source = execFileSync('git', ['show', `${revision}:${file}`], { cwd: root, encoding: 'utf8' });
            fs.writeFileSync(
                output,
                ts.transpileModule(source, {
                    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ES2022 },
                }).outputText,
            );
        }
    }
    return directory;
}
async function worker(directory) {
    const consolidated = path.join(directory, 'dist/browser.js');
    const { parseText } = await import(
        pathToFileURL(
            fs.existsSync(consolidated)
                ? consolidated
                : path.join(directory, 'packages/parse/build/esm/src/browser.js'),
        ).href
    );
    const { writeToString } = await import(
        pathToFileURL(
            fs.existsSync(consolidated)
                ? consolidated
                : path.join(directory, 'packages/format/build/esm/src/browser.js'),
        ).href
    );
    const results = {};
    for (const quoted of [false, true]) {
        const asset = fs.readFileSync(
            path.join(root, 'examples/benchmark/assets', `1000.${quoted ? 'quoted' : 'nonquoted'}.csv`),
            'utf8',
        );
        for (const rows of [20, 100, 400]) {
            const input = asset
                .split('\n')
                .slice(0, rows + 1)
                .join('\n');
            const data = parseText(input, { headers: true });
            for (const kind of ['arrays', 'headers', 'format']) {
                const options = kind === 'headers' ? { headers: true } : {};
                const execute =
                    kind === 'format' ? () => writeToString(data, { headers: true }) : () => parseText(input, options);
                if (kind === 'format') assert.equal(typeof (await execute()), 'string');
                else assert.equal(execute().length, rows + (kind === 'arrays' ? 1 : 0));
                for (let i = 0; i < warmups; i++) {
                    if (kind === 'format') await execute();
                    else execute();
                }
                const usageBefore = process.cpuUsage();
                const start = performance.now();
                for (let i = 0; i < runs; i++) {
                    if (kind === 'format') await execute();
                    else execute();
                }
                const wallMs = (performance.now() - start) / runs;
                const cpu = process.cpuUsage(usageBefore);
                results[`${kind}-${quoted ? 'quoted' : 'nonquoted'}-${rows}`] = {
                    wallMs,
                    cpuMs: (cpu.user + cpu.system) / 1000 / runs,
                };
            }
        }
    }
    process.stdout.write(JSON.stringify({ results, peakRssMiB: process.resourceUsage().maxRSS / 1024 }));
}
async function main() {
    if (process.argv[2] === '--worker') return worker(process.argv[3]);
    assert.ok(process.argv[2] && process.argv[3], 'Provide git:<ref> or checkout paths for both versions');
    const versions = { baseline: resolveVersion(process.argv[2]), candidate: resolveVersion(process.argv[3]) };
    const measurements = { baseline: [], candidate: [] };
    for (let i = 0; i < samples; i++) {
        for (const version of i % 2 ? ['candidate', 'baseline'] : ['baseline', 'candidate']) {
            const child = spawnSync(process.execPath, [__filename, '--worker', versions[version]], {
                encoding: 'utf8',
            });
            assert.equal(child.status, 0, child.stderr || child.error?.message);
            measurements[version].push(JSON.parse(child.stdout));
            console.log(`Finished sample ${i + 1}: ${version}`);
        }
    }
    const results = {};
    for (const key of Object.keys(measurements.baseline[0].results)) {
        results[key] = {};
        for (const version of ['baseline', 'candidate']) {
            results[key][version] = Object.fromEntries(
                ['wallMs', 'cpuMs'].map((metric) => [
                    metric,
                    median(measurements[version].map((item) => item.results[key][metric])),
                ]),
            );
        }
    }
    const peakRssMiB = Object.fromEntries(
        ['baseline', 'candidate'].map((version) => [
            version,
            median(measurements[version].map((item) => item.peakRssMiB)),
        ]),
    );
    const report = {
        node: process.version,
        platform: process.platform,
        arch: process.arch,
        baseline: process.argv[2],
        candidate: process.argv[3],
        runs,
        warmups,
        samples,
        notes: 'Browser APIs measured in Node/V8, not Chromium. Median of three process means; sequential alternating versions. CPU includes user+system. RSS is peak for the complete repeated suite, not per table. Inputs decoded before timing.',
        results,
        peakRssMiB,
        measurements,
    };
    const output = path.join(root, 'examples/benchmark/browser-optimization-results.json');
    fs.writeFileSync(output, JSON.stringify(report, null, 4) + '\n');
    require('node:child_process').execFileSync('pnpm', ['exec', 'oxfmt', '--write', output], {
        cwd: root,
        stdio: 'pipe',
    });
    console.log(JSON.stringify({ results, peakRssMiB }, null, 2));
}
main()
    .catch((error) => {
        console.error(error);
        process.exitCode = 1;
    })
    .finally(() => temporary.forEach((directory) => fs.rmSync(directory, { recursive: true, force: true })));
