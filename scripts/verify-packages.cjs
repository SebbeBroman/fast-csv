const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const ts = require('typescript');
const root = path.resolve(__dirname, '..');
const packages = { parse: '@fast-csv/parse', format: '@fast-csv/format', 'fast-csv': 'fast-csv' };

for (const [directory, name] of Object.entries(packages)) {
    const cwd = path.join(root, 'packages', directory);
    const script = `
        import assert from 'node:assert/strict';
        import * as csv from ${JSON.stringify(name)};
        ${
            directory === 'parse' || directory === 'fast-csv'
                ? `
            const rows = [];
            const stream = csv.parseString('a,b\\nx,y', { headers: true });
            for await (const row of stream) rows.push(row);
            assert.deepEqual(rows, [{ a: 'x', b: 'y' }]);
            const browser = await import(${JSON.stringify(`${name}/browser`)});
            assert.deepEqual(browser.parseText('a,b'), [['a', 'b']]);
        `
                : ''
        }
        ${
            directory === 'format' || directory === 'fast-csv'
                ? `
            assert.equal(await csv.writeToString([['a', 'b']]), 'a,b');
            const browserFormat = await import(${JSON.stringify(`${name}/browser`)});
            assert.equal(await browserFormat.writeToString([['a,b', 'c']]), '"a,b",c');
        `
                : ''
        }
    `;
    execFileSync(process.execPath, ['--input-type=module', '-e', script], { cwd, stdio: 'inherit' });
    assert.ok(!fs.existsSync(path.join(cwd, 'build/src')), 'Unexpected CommonJS output');
    assert.equal(
        fs.readFileSync(path.join(cwd, 'build/esm/LICENSE'), 'utf8'),
        fs.readFileSync(path.join(root, 'LICENSE'), 'utf8'),
    );
    console.log(`${name}: native ESM exports pass; no CommonJS output`);
}

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
            if (specifier === '@fast-csv/parse/browser' || specifier === '@fast-csv/format/browser') {
                const directory = specifier.includes('/parse/') ? 'parse' : 'format';
                checkBrowserGraph(path.join(root, `packages/${directory}/build/esm/src/browser.js`));
            } else {
                assert.ok(specifier.startsWith('.'), `${file}: external runtime dependency ${specifier}`);
                checkBrowserGraph(path.resolve(path.dirname(file), specifier));
            }
        }
        ts.forEachChild(node, visit);
    }
    visit(source);
}
checkBrowserGraph(path.join(root, 'packages/fast-csv/build/esm/src/browser.js'));
console.log(`Browser graph: ${visited.size} modules, no Node imports/globals or external runtime dependencies`);

const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'fast-csv-browser-types-'));
try {
    fs.mkdirSync(path.join(temporary, 'node_modules/@fast-csv'), { recursive: true });
    fs.symlinkSync(path.join(root, 'packages/format'), path.join(temporary, 'node_modules/@fast-csv/format'));
    fs.symlinkSync(path.join(root, 'packages/parse'), path.join(temporary, 'node_modules/@fast-csv/parse'));
    fs.symlinkSync(path.join(root, 'packages/fast-csv'), path.join(temporary, 'node_modules/fast-csv'));
    fs.writeFileSync(
        path.join(temporary, 'consumer.mts'),
        `
        import { parseText, parseTextWithInfo, writeToString } from 'fast-csv/browser';
        const rows = parseText('a,b');
        const cell: string = rows[0][0];
        const objects = parseText<{ name: string }>('name\\nAlice', { headers: true });
        const name: string = objects[0].name;
        const inferred = parseText('name\\nAlice', { headers: true });
        const inferredName: string = inferred[0].name;
        void inferredName;
        const formatted: Promise<string> = writeToString([{ name: 'Alice' }], { headers: true });
        void formatted;
        const result = parseTextWithInfo('a,b');
        const count: number = result.rowCount;
        void cell; void name; void count;
    `,
    );
    fs.writeFileSync(
        path.join(temporary, 'tsconfig.json'),
        JSON.stringify({
            compilerOptions: {
                module: 'NodeNext',
                moduleResolution: 'NodeNext',
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
    console.log('Browser consumer declarations: compile with types: [] and no @types/node');
} finally {
    fs.rmSync(temporary, { recursive: true, force: true });
}
