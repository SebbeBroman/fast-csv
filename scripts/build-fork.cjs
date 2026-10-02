const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const root = path.resolve(__dirname, '..');
const directory = path.join(root, 'packages/fast-csv');
const sources = path.join(directory, 'build/.sources');
const configPath = path.join(directory, 'build/fork-tsconfig.json');
const imports = {
    '@fast-csv/parse': '../parse/index.js',
    '@fast-csv/format': '../format/index.js',
    '@fast-csv/parse/browser': '../parse/browser.js',
    '@fast-csv/format/browser': '../format/browser.js',
};
try {
    for (const name of ['parse', 'format']) {
        fs.cpSync(path.join(root, 'packages', name, 'src'), path.join(sources, name), { recursive: true });
    }
    fs.cpSync(path.join(directory, 'src'), path.join(sources, 'src'), { recursive: true });
    for (const name of ['index.ts', 'browser.ts']) {
        const file = path.join(sources, 'src', name);
        fs.writeFileSync(
            file,
            fs.readFileSync(file, 'utf8').replace(/from '([^']+)'/g, (match, specifier) => {
                if (!imports[specifier]) throw new Error(`Unexpected package import: ${specifier}`);
                return `from '${imports[specifier]}'`;
            }),
        );
    }
    fs.writeFileSync(
        configPath,
        JSON.stringify({
            extends: path.join(root, 'tsconfig.build.json'),
            compilerOptions: {
                module: 'ES2022',
                moduleResolution: 'bundler',
                rootDir: './.sources',
                outDir: './esm',
                composite: false,
                incremental: false,
                inlineSources: true,
            },
            include: ['./.sources/**/*.ts'],
            exclude: [],
        }),
    );
    execFileSync(process.execPath, [require.resolve('typescript/bin/tsc'), '-p', configPath], { stdio: 'inherit' });
    fs.writeFileSync(path.join(directory, 'build/esm/package.json'), '{"type":"module"}\n');
    fs.copyFileSync(path.join(root, 'LICENSE'), path.join(directory, 'build/esm/LICENSE'));
} finally {
    fs.rmSync(sources, { recursive: true, force: true });
    fs.rmSync(configPath, { force: true });
}
