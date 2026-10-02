const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const zlib = require('node:zlib');
const esbuild = require('esbuild');
const root = path.resolve(__dirname, '..');
const scenarios = [
    ['browser parser', 'export { parseText, parseTextWithInfo } from "@sebbro/fast-csv/browser";', 'browser'],
    ['browser formatter', 'export { writeToString } from "@sebbro/fast-csv/browser";', 'browser'],
    ['browser: all exports', 'export * from "@sebbro/fast-csv/browser";', 'browser'],
    [
        'unused browser import',
        'import { parseText } from "@sebbro/fast-csv/browser"; export const answer = 42;',
        'browser',
    ],
    [
        'Node parser',
        'export { parse, parseString, parseStream, parseFile, ParserOptions, CsvParserStream } from "@sebbro/fast-csv/node";',
        'node',
    ],
    ['Node: all exports', 'export * from "@sebbro/fast-csv/node";', 'node'],
];
async function main() {
    const results = [];
    for (const [name, contents, platform] of scenarios) {
        const build = esbuild.buildSync({
            absWorkingDir: root,
            stdin: { contents, resolveDir: path.join(root, 'packages/fast-csv'), sourcefile: 'consumer.mjs' },
            platform,
            target: 'es2022',
            format: 'esm',
            bundle: true,
            minify: true,
            treeShaking: true,
            sourcemap: false,
            write: false,
            metafile: true,
            legalComments: 'none',
        });
        const code = build.outputFiles[0].contents;
        const output = Object.values(build.metafile.outputs)[0];
        const externalImports = output.imports.filter((item) => item.external).map((item) => item.path);
        if (platform === 'browser') {
            assert.deepEqual(externalImports, [], `${name}: unexpected runtime dependencies`);
            const csv = await import(`data:text/javascript;base64,${Buffer.from(code).toString('base64')}`);
            if (csv.parseText) assert.deepEqual(csv.parseText('a,b\nx,y', { headers: true }), [{ a: 'x', b: 'y' }]);
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
            modules: Object.entries(output.inputs)
                .filter(([, input]) => input.bytesInOutput > 0)
                .map(([file, input]) => ({ file, bytesInOutput: input.bytesInOutput })),
        });
    }
    const report = {
        esbuildVersion: esbuild.version,
        target: 'es2022',
        format: 'esm',
        notes: 'Production minified bundles, no source maps; gzip level 9 / Brotli quality 11. Node builtins remain external. Bytes exclude application code and transport headers.',
        results,
    };
    const reportPath = path.join(root, 'examples/benchmark/bundle-size-results.json');
    const prettier = require('prettier');
    const formatted = await prettier.format(JSON.stringify(report), {
        ...(await prettier.resolveConfig(reportPath)),
        filepath: reportPath,
    });
    fs.writeFileSync(reportPath, formatted);
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
