const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const zlib = require('node:zlib');

const root = path.resolve(__dirname, '..');
const scenarios = [
    ['browser parser', 'export { parseText, parseTextWithInfo } from "@sebbro/fast-csv";', 'browser'],
    ['browser formatter', 'export { writeToString } from "@sebbro/fast-csv";', 'browser'],
    ['browser: all exports', 'export * from "@sebbro/fast-csv";', 'browser'],
    ['unused browser import', 'import { parseText } from "@sebbro/fast-csv"; export const answer = 42;', 'browser'],
    [
        'Node parser',
        'export { parse, parseString, parseStream, parseFile, ParserOptions, CsvParserStream } from "@sebbro/fast-csv/node";',
        'node',
    ],
    ['Node: all exports', 'export * from "@sebbro/fast-csv/node";', 'node'],
];
async function main() {
    const { build, version, createLogger } = await import('vite');
    const results = [];
    for (const [name, contents, platform] of scenarios) {
        const result = await build({
            configFile: false,
            logLevel: 'silent',
            customLogger: {
                ...createLogger('silent'),
                warn(message) {
                    throw new Error(message);
                },
            },
            plugins: [
                {
                    name: 'consumer-entry',
                    resolveId(id) {
                        if (id === path.join(root, '__consumer__.mjs')) return '\0consumer';
                    },
                    load(id) {
                        if (id === '\0consumer') return contents;
                    },
                },
            ],
            resolve: {
                alias: {
                    '@sebbro/fast-csv/node': path.join(root, 'dist/node.js'),
                    '@sebbro/fast-csv': path.join(root, 'dist/index.js'),
                },
            },
            build: {
                target: 'es2022',
                minify: true,
                write: false,
                lib: { entry: path.join(root, '__consumer__.mjs'), formats: ['es'] },
                rolldownOptions: {
                    external: platform === 'node' ? ['fs', 'stream', 'util', 'string_decoder'] : [],
                    output: { minify: true, comments: false },
                },
            },
        });
        const output = (Array.isArray(result) ? result[0] : result).output.find(
            (chunk) => chunk.type === 'chunk' && chunk.isEntry,
        );
        const code = Buffer.from(output.code);
        const externalImports = output.imports;
        if (platform === 'browser') {
            assert.deepEqual(externalImports, [], `${name}: unexpected runtime dependencies`);
            const csv = await import(`data:text/javascript;base64,${Buffer.from(code).toString('base64')}`);
            if (csv.parseText) assert.deepEqual(csv.parseText('a,b\nx,y', { headers: true }), [{ a: 'x', b: 'y' }]);
            if (name === 'unused browser import')
                assert.equal(
                    Object.keys(output.modules).filter((id) => id !== '\0consumer').length,
                    0,
                    'Unused import retained library modules',
                );
            if (csv.writeToString) assert.equal(await csv.writeToString([['a,b', 'c']]), '"a,b",c');
        }
        results.push({
            name,
            platform,
            minifiedBytes: code.length,
            gzipBytes: zlib.gzipSync(code, { level: 9 }).length,
            brotliBytes: zlib.brotliCompressSync(code, { params: { [zlib.constants.BROTLI_PARAM_QUALITY]: 11 } })
                .length,
            externalImports,
            modules: Object.entries(output.modules)
                .filter(([, input]) => input.renderedLength > 0)
                .map(([file, input]) => ({
                    file: path.relative(root, file),
                    renderedBytesBeforeMinification: input.renderedLength,
                })),
        });
    }
    const report = {
        viteVersion: version,
        target: 'es2022',
        format: 'esm',
        notes: 'Production minified bundles, no source maps; gzip level 9 / Brotli quality 11. Node builtins remain external. Bytes exclude application code and transport headers.',
        results,
    };
    const reportPath = path.join(root, 'examples/benchmark/bundle-size-results.json');
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 4) + '\n');
    require('node:child_process').execFileSync('pnpm', ['exec', 'oxfmt', '--write', reportPath], {
        cwd: root,
        stdio: 'pipe',
    });
    console.table(
        results.map(({ name, minifiedBytes, gzipBytes, brotliBytes }) => ({
            name,
            minifiedBytes,
            gzipBytes,
            brotliBytes,
        })),
    );
}
main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
