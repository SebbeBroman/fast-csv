const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const ts = require('typescript');
const root = path.resolve(__dirname, '..');
const directory = root;
const manifest = JSON.parse(fs.readFileSync(path.join(directory, 'package.json'), 'utf8'));
assert.equal(manifest.name, '@sebbebroman/fast-csv');
assert.equal(manifest.type, 'module');
assert.equal(manifest.private, undefined);
assert.deepEqual(manifest.dependencies ?? {}, {});
assert.ok(!fs.existsSync(path.join(directory, 'dist/index.cjs')), 'Unexpected CommonJS output');

const visited = new Set();
function checkBrowserGraph(file) {
    if (visited.has(file)) return;
    visited.add(file);
    const source = ts.createSourceFile(file, fs.readFileSync(file, 'utf8'), ts.ScriptTarget.ES2022, true);
    function visit(node) {
        if (ts.isIdentifier(node)) {
            assert.ok(
                !['require', 'process', 'Buffer', 'setImmediate', '__dirname', '__filename'].includes(node.text),
                `${file}: Node global ${node.text}`,
            );
        }
        if ((ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) && node.moduleSpecifier) {
            const specifier = node.moduleSpecifier.text;
            assert.ok(specifier.startsWith('.'), `${file}: external runtime dependency ${specifier}`);
            checkBrowserGraph(path.resolve(path.dirname(file), specifier));
        }
        ts.forEachChild(node, visit);
    }
    visit(source);
}
checkBrowserGraph(path.join(directory, 'dist/index.js'));
assert.deepEqual(manifest.exports['./browser'], manifest.exports['.']);
console.log(`Portable root graph: ${visited.size} modules, no Node imports/globals or external runtime dependencies`);

const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'sebbro-fast-csv-package-'));
try {
    const packed = JSON.parse(
        execFileSync('pnpm', ['pack', '--json', '--pack-destination', temporary], {
            cwd: directory,
            encoding: 'utf8',
        }),
    );
    assert.equal(packed.version, manifest.version);
    assert.ok(packed.files.some((file) => file.path === 'LICENSE'));
    for (const file of packed.files) {
        if (file.path.endsWith('.d.ts')) {
            assert.ok(
                !fs.readFileSync(path.join(directory, file.path), 'utf8').includes('@fast-csv/'),
                `${file.path}: upstream declaration dependency`,
            );
        }
    }
    fs.writeFileSync(path.join(temporary, 'package.json'), '{"private":true,"type":"module"}');
    execFileSync(
        'npm',
        [
            'install',
            '--offline',
            '--ignore-scripts',
            '--no-audit',
            '--no-fund',
            path.resolve(temporary, packed.filename),
        ],
        { cwd: temporary, stdio: 'pipe' },
    );
    assert.ok(!fs.existsSync(path.join(temporary, 'node_modules/@fast-csv')));
    const consumerScript = `
        import assert from 'node:assert/strict';
        import * as csv from '@sebbebroman/fast-csv';
        import * as node from '@sebbebroman/fast-csv/node';
        import * as browser from '@sebbebroman/fast-csv/browser';
        import { createRequire } from 'node:module';
        const manifest = createRequire(import.meta.url)('@sebbebroman/fast-csv/package.json');
        assert.equal(manifest.name, '@sebbebroman/fast-csv');
        assert.equal(csv.parseText, browser.parseText);
        assert.equal(csv.writeToString, browser.writeToString);
        assert.equal(csv.parseString, undefined);
        assert.deepEqual(csv.parseText('a,b'), [['a', 'b']]);
        assert.equal(await csv.writeToString([['a,b', 'c']]), '"a,b",c');
        const rows = [];
        for await (const row of node.parseString('a,b\\nx,y', { headers: true })) rows.push(row);
        assert.deepEqual(rows, [{ a: 'x', b: 'y' }]);
        assert.equal(await node.writeToString([['a,b', 'c']]), '"a,b",c');
        assert.deepEqual(browser.parseText('a,b'), [['a', 'b']]);
        assert.equal(await browser.writeToString([['a,b', 'c']]), '"a,b",c');
        assert.equal(await browser.writeToString([['x']], { transform: (row, cb) => queueMicrotask(() => cb(null, [row[0].toUpperCase()])) }), 'X');
    `;
    execFileSync(process.execPath, ['--input-type=module', '-e', consumerScript], { cwd: temporary, stdio: 'inherit' });
    fs.writeFileSync(
        path.join(temporary, 'consumer.mts'),
        `
        import { parseText, parseTextWithInfo, writeToString } from '@sebbebroman/fast-csv';
        import { parseText as browserParseText } from '@sebbebroman/fast-csv/browser';
        const browserCell: string = browserParseText('a,b')[0][0];
        void browserCell;
        const cell: string = parseText('a,b')[0][0];
        const name: string = parseText('name\\nAlice', { headers: true })[0].name;
        const typedName: string = parseText<{ name: string }>('name\\nAlice', { headers: true })[0].name;
        const formatted: Promise<string> = writeToString([{ name: 'Alice' }], { headers: true });
        const count: number = parseTextWithInfo('a,b').rowCount;
        void cell; void name; void typedName; void formatted; void count;
    `,
    );
    for (const [module, moduleResolution] of [
        ['NodeNext', 'NodeNext'],
        ['ES2022', 'bundler'],
        ['ES2022', 'node'],
    ]) {
        fs.writeFileSync(
            path.join(temporary, 'tsconfig.json'),
            JSON.stringify({
                compilerOptions: {
                    module,
                    moduleResolution,
                    target: 'ES2022',
                    lib: ['ES2022', 'DOM'],
                    types: [],
                    strict: true,
                    noEmit: true,
                },
                include: ['consumer.mts'],
            }),
        );
        execFileSync(
            process.execPath,
            [require.resolve('typescript/bin/tsc'), '-p', path.join(temporary, 'tsconfig.json')],
            { stdio: 'inherit' },
        );
    }
    console.log(
        `Packed ${manifest.name}@${manifest.version}: portable root, /browser alias, /node exports and portable declarations pass; no upstream packages installed`,
    );
    console.log(`Package archive: ${fs.statSync(path.resolve(temporary, packed.filename)).size} bytes`);
} finally {
    fs.rmSync(temporary, { recursive: true, force: true });
}
