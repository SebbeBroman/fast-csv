// jest.config.js
module.exports = {
    // [...]
    // Replace `ts-jest` with the preset you want to use
    // from the above list
    preset: 'ts-jest',
    moduleNameMapper: {
        '^(\\.{1,2}/.*)\\.js$': '$1',
        '^@fast-csv/(parse|format)$': '<rootDir>/packages/$1/src/index.ts',
        '^@sebbro/fast-csv/node$': '<rootDir>/packages/fast-csv/src/index.ts',
        '^@sebbro/fast-csv/browser$': '<rootDir>/packages/fast-csv/src/browser.ts',
        '^@fast-csv/parse/browser$': '<rootDir>/packages/parse/src/browser.ts',
    },
    collectCoverageFrom: ['packages/**/*.ts', '!**/__tests__/**', '!**/build/**', '!**/node_modules/**'],
    testMatch: ['**/__tests__/**/*.spec.ts'],
};
