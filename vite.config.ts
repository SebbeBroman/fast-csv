import { builtinModules } from 'node:module';
import { defineConfig } from 'vite';

export default defineConfig({
    build: {
        target: 'es2022',
        minify: false,
        sourcemap: true,
        lib: {
            entry: { index: 'src/index.ts', browser: 'src/browser.ts' },
            formats: ['es'],
            fileName: (_format, name) => `${name}.js`,
        },
        rolldownOptions: {
            external: [...builtinModules, ...builtinModules.map((name) => `node:${name}`)],
        },
    },
});
