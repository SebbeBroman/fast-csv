const fs = require('node:fs');
const { execFileSync } = require('node:child_process');
execFileSync(process.execPath, [require.resolve('typescript/bin/tsc'), '-p', 'tsconfig.esm.json'], {
    stdio: 'inherit',
});
fs.writeFileSync('build/esm/package.json', '{"type":"module"}\n');
fs.copyFileSync(require('node:path').join(__dirname, '../LICENSE'), 'build/esm/LICENSE');
