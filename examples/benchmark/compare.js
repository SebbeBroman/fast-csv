// Compare compiled parser versions in isolated processes without rewriting README.md.
// node examples/benchmark/compare.js /path/to/baseline/src /path/to/candidate/src
// A git:<ref> argument compiles that revision into a temporary directory.
// Append --small to measure 20, 100, and 400 rows already loaded in memory.
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { execFileSync, spawnSync } = require('child_process');
const { performance } = require('perf_hooks');
const { Readable } = require('stream');

const scenarios = [
    'stream-nonquoted',
    'stream-quoted',
    'parser-nonquoted',
    'parser-quoted',
    'parser-custom-escape',
    'parser-comments',
    'parser-ignore-empty',
];
const runs = 5;
const samples = 3;

async function worker(modulePath, scenario) {
    const small = /^(stream|parser)-(nonquoted|quoted)-(20|100|400)$/.exec(scenario);
    const rowCount = small ? Number(small[3]) : 100000;
    const measuredRuns = small ? (small[1] === 'parser' ? 2000 : 1000) : runs;
    const warmups = small ? 200 : 1;
    const { Parser } = require(path.join(modulePath, 'parser/Parser.js'));
    const { ParserOptions } = require(path.join(modulePath, 'ParserOptions.js'));
    const { parse } = require(path.join(modulePath, 'index.js'));
    const quoted = small ? small[2] === 'quoted' : scenario.endsWith('-quoted');
    const file = path.join(__dirname, 'assets', `100000.${quoted ? 'quoted' : 'nonquoted'}.csv`);
    const options = {};
    let expectedRows = rowCount + 1;
    let data;
    if (small) {
        data = fs
            .readFileSync(file, 'utf8')
            .split('\n')
            .slice(0, rowCount + 1)
            .join('\n');
    } else if (scenario === 'parser-custom-escape') {
        options.escape = '\\';
        data = `"${'\\x'.repeat(50000)}",tail\n`;
        expectedRows = 1;
    } else if (scenario === 'parser-comments') {
        options.comment = '#';
        data = '# ignored comment\na,b,c\n'.repeat(100000);
        expectedRows = 100000;
    } else if (scenario === 'parser-ignore-empty') {
        options.ignoreEmpty = true;
        data = ' , , \na,b,c\n'.repeat(100000);
        expectedRows = 100000;
    } else if (scenario.startsWith('parser-')) {
        data = fs.readFileSync(file, 'utf8');
    }
    const buffer = small ? Buffer.from(data) : null;
    async function execute() {
        if (scenario.startsWith('stream-')) {
            let count = 0;
            const source = small ? Readable.from([buffer]) : fs.createReadStream(file);
            const stream = source.pipe(parse({ headers: true })).transform((row) => {
                const result = {};
                ['first_name', 'last_name', 'email_address'].forEach((property) => {
                    result[property.replace(/_(.)/g, (match, character) => character.toUpperCase())] = row[property];
                });
                result.address = row.address;
                return result;
            });
            await new Promise((resolve, reject) => {
                stream
                    .on('data', () => {
                        count += 1;
                    })
                    .on('error', reject)
                    .on('end', resolve);
            });
            assert.strictEqual(count, rowCount);
        } else {
            const parser = new Parser(new ParserOptions(options));
            const result = parser.parse(data, false);
            assert.strictEqual(result.rows.length, expectedRows);
            assert.strictEqual(result.line, '');
            if (scenario === 'parser-custom-escape') {
                assert.strictEqual(result.rows[0][0], '\\x'.repeat(50000));
            }
        }
    }
    await execute(); // Warm-up is excluded from timing and included in peak RSS.
    for (let i = 1; i < warmups; i += 1) {
        await execute();
    }
    const timings = [];
    const usageBefore = process.cpuUsage();
    for (let i = 0; i < measuredRuns; i += 1) {
        const start = performance.now();
        await execute();
        timings.push(performance.now() - start);
    }
    const cpu = process.cpuUsage(usageBefore);
    const usage = process.resourceUsage();
    process.stdout.write(
        JSON.stringify({
            wallMs: timings.reduce((sum, n) => sum + n, 0) / measuredRuns,
            userMs: cpu.user / 1000 / measuredRuns,
            systemMs: cpu.system / 1000 / measuredRuns,
            peakRssMiB: usage.maxRSS / 1024,
        }),
    );
}

function median(values) {
    return values.sort((a, b) => a - b)[Math.floor(values.length / 2)];
}

const temporaryDirectories = [];
function resolveVersion(argument) {
    if (!argument.startsWith('git:')) {
        const resolved = path.resolve(argument);
        const sourceDirectory = fs.existsSync(path.join(resolved, 'src/parse'))
            ? path.join(resolved, 'src/parse')
            : resolved;
        if (!fs.existsSync(path.join(sourceDirectory, 'ParserOptions.ts'))) return resolved;
        const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'fast-csv-benchmark-'));
        temporaryDirectories.push(directory);
        const ts = require('typescript');
        for (const entry of fs.readdirSync(sourceDirectory, { recursive: true })) {
            if (!entry.endsWith('.ts')) continue;
            const output = path.join(directory, entry.replace(/\.ts$/, '.js'));
            fs.mkdirSync(path.dirname(output), { recursive: true });
            fs.writeFileSync(
                output,
                ts.transpileModule(fs.readFileSync(path.join(sourceDirectory, entry), 'utf8'), {
                    compilerOptions: {
                        target: ts.ScriptTarget.ES2022,
                        module: ts.ModuleKind.CommonJS,
                        esModuleInterop: true,
                    },
                }).outputText,
            );
        }
        return directory;
    }
    const revision = argument.slice(4);
    const sourcePrefix = execFileSync('git', ['ls-tree', '-r', '--name-only', revision, 'src/parse/'], {
        encoding: 'utf8',
    }).trim()
        ? 'src/parse/'
        : 'packages/parse/src/';
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'fast-csv-benchmark-'));
    temporaryDirectories.push(directory);
    const ts = require('typescript');
    const files = execFileSync('git', ['ls-tree', '-r', '--name-only', revision, sourcePrefix], { encoding: 'utf8' });
    for (const file of files
        .trim()
        .split('\n')
        .filter((name) => name.endsWith('.ts'))) {
        const source = execFileSync('git', ['show', `${revision}:${file}`], { encoding: 'utf8' });
        const output = path.join(directory, file.slice(sourcePrefix.length).replace(/\.ts$/, '.js'));
        fs.mkdirSync(path.dirname(output), { recursive: true });
        fs.writeFileSync(
            output,
            ts.transpileModule(source, {
                compilerOptions: {
                    target: ts.ScriptTarget.ES2022,
                    module: ts.ModuleKind.CommonJS,
                    esModuleInterop: true,
                },
            }).outputText,
        );
    }
    return directory;
}

async function main() {
    if (process.argv[2] === '--worker') {
        await worker(process.argv[3], process.argv[4]);
        return;
    }
    assert.ok(process.argv[2] && process.argv[3], 'Provide baseline and candidate compiled src directories');
    const versions = { baseline: resolveVersion(process.argv[2]), candidate: resolveVersion(process.argv[3]) };
    const results = {};
    const smallTables = process.argv.includes('--small');
    const selectedScenarios = smallTables
        ? [20, 100, 400].flatMap((rows) =>
              ['stream', 'parser'].flatMap((mode) => ['nonquoted', 'quoted'].map((type) => `${mode}-${type}-${rows}`)),
          )
        : scenarios;
    for (const scenario of selectedScenarios) {
        const measurements = { baseline: [], candidate: [] };
        for (let sample = 0; sample < samples; sample += 1) {
            // Alternate order to reduce systematic warm-cache bias.
            const order = sample % 2 === 0 ? ['baseline', 'candidate'] : ['candidate', 'baseline'];
            for (const version of order) {
                const child = spawnSync(process.execPath, [__filename, '--worker', versions[version], scenario], {
                    encoding: 'utf8',
                });
                assert.strictEqual(child.status, 0, child.stderr || child.error?.message);
                measurements[version].push(JSON.parse(child.stdout));
            }
        }
        results[scenario] = {};
        for (const version of ['baseline', 'candidate']) {
            results[scenario][version] = Object.fromEntries(
                ['wallMs', 'userMs', 'systemMs', 'peakRssMiB'].map((metric) => [
                    metric,
                    median(measurements[version].map((r) => r[metric])),
                ]),
            );
        }
        console.log(JSON.stringify({ scenario, ...results[scenario] }));
    }
    console.log(
        JSON.stringify({
            node: process.version,
            platform: process.platform,
            arch: process.arch,
            runs,
            samples,
            ...(smallTables
                ? { runs: { stream: 1000, parser: 2000 }, warmups: 200, streamSource: 'in-memory Buffer' }
                : {}),
            baseline: process.argv[2],
            candidate: process.argv[3],
            results,
        }),
    );
}

main()
    .catch((error) => {
        console.error(error);
        process.exitCode = 1;
    })
    .finally(() => {
        for (const directory of temporaryDirectories) {
            fs.rmSync(directory, { recursive: true, force: true });
        }
    });
