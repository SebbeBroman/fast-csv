import { defineConfig } from 'vitest/config';

export default defineConfig({
    resolve: {
        alias: {
            '@sebbro/fast-csv/browser': new URL('./src/index.ts', import.meta.url).pathname,
            '@sebbro/fast-csv/node': new URL('./src/node.ts', import.meta.url).pathname,
            '@sebbro/fast-csv': new URL('./src/index.ts', import.meta.url).pathname,
        },
    },
    test: {
        globals: true,
        include: ['__tests__/**/*.spec.ts'],
        restoreMocks: true,
        coverage: {
            provider: 'v8',
            include: ['src/**/*.ts'],
            reporter: ['text', 'html', 'lcov'],
        },
    },
});
