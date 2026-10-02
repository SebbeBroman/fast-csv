import { writeToString as writeBrowser } from '../src/browser';
import { writeToString as writeNode, FormatterOptionsArgs, Row } from '../src';

describe('browser formatter', () => {
    const cases: { name: string; rows: Row[]; options: FormatterOptionsArgs<Row, Row> }[] = [
        { name: 'quoted Unicode fields', rows: [['hé😀', 'a,b', 'a"b', 'a\nb']], options: {} },
        {
            name: 'inferred object headers',
            rows: [
                { a: 'x', b: 'y' },
                { a: 'u', b: 'v' },
            ],
            options: { headers: true },
        },
        {
            name: 'array headers',
            rows: [
                ['a', 'b'],
                ['x', 'y'],
            ],
            options: { headers: true },
        },
        {
            name: 'hash arrays',
            rows: [
                [
                    ['a', 'x'],
                    ['b', 'y'],
                ],
            ],
            options: { headers: true },
        },
        {
            name: 'BOM and CRLF',
            rows: [['x'], ['y']],
            options: { writeBOM: true, rowDelimiter: '\r\n', includeEndRowDelimiter: true },
        },
        {
            name: 'empty input and explicit headers',
            rows: [],
            options: { headers: ['a', 'b'], alwaysWriteHeaders: true },
        },
        { name: 'suppressed headers', rows: [{ a: 'x' }], options: { headers: ['a'], writeHeaders: false } },
        {
            name: 'custom escapes and selective quoting',
            rows: [['a"b', 'c']],
            options: { escape: '\\', quoteColumns: [false, true] },
        },
        { name: 'disabled quoting', rows: [['x', 'y']], options: { quote: false } },
    ];
    it.each(cases)('matches the Node API: $name', async ({ rows, options }) => {
        await expect(writeBrowser(rows, options)).resolves.toBe(await writeNode(rows, options));
    });

    it('supports synchronous transforms', async () => {
        await expect(
            writeBrowser([{ a: 'x' }], {
                headers: true,
                transform: (row: { a: string }) => {
                    return { b: row.a };
                },
            }),
        ).resolves.toBe('b\nx');
    });

    it('supports callback transforms', async () => {
        await expect(
            writeBrowser([['x'], ['y']], {
                transform: (row, cb) => {
                    queueMicrotask(() => {
                        return cb(null, [row[0].toUpperCase()]);
                    });
                },
            }),
        ).resolves.toBe('X\nY');
    });

    it('rejects transform errors and invalid header configuration', async () => {
        await expect(
            writeBrowser([['x']], {
                transform: () => {
                    throw new Error('transform failed');
                },
            }),
        ).rejects.toThrow('transform failed');
        await expect(
            writeBrowser([['x']], {
                transform: (_row, cb) => {
                    queueMicrotask(() => {
                        return cb(new Error('callback failed'));
                    });
                },
            }),
        ).rejects.toThrow('callback failed');
        await expect(writeBrowser([], { alwaysWriteHeaders: true })).rejects.toThrow('headers');
    });

    it.each(['.', '|', '*', '[', '\\'])('treats quote %s literally', async (quote) => {
        const field = `a${quote}b`;
        const expected = `${quote}a${quote}${quote}b${quote}`;
        await expect(writeBrowser([[field]], { quote })).resolves.toBe(expected);
        await expect(writeNode([[field]], { quote })).resolves.toBe(expected);
    });

    it.each([']', '[', '-', '\\', '^', '|'])('treats delimiter %s literally', async (delimiter) => {
        const expected = `"a${delimiter}b"${delimiter}c`;
        await expect(writeBrowser([[`a${delimiter}b`, 'c']], { delimiter })).resolves.toBe(expected);
        await expect(writeNode([[`a${delimiter}b`, 'c']], { delimiter })).resolves.toBe(expected);
    });

    it('does not quote pipes with default options', async () => {
        await expect(writeBrowser([['a|b']])).resolves.toBe('a|b');
    });
    it('rejects Promise-returning transforms', async () => {
        await expect(
            writeBrowser([['x']], {
                transform: (row: Row) => {
                    return Promise.resolve(row);
                },
            }),
        ).rejects.toThrow('use a callback');
    });

    it('treats hyphens in row delimiters literally', async () => {
        await expect(writeBrowser([['m'], ['n']], { rowDelimiter: 'a-z' })).resolves.toBe('ma-zn');
    });
    it('accepts a synchronous transform without a row parameter', async () => {
        const options = {
            transform: () => {
                return ['constant'];
            },
        };
        await expect(writeBrowser([['x']], options)).resolves.toBe('constant');
        await expect(writeNode([['x']], options)).resolves.toBe('constant');
    });
    it('matches BOM handling for empty input', async () => {
        const options = { writeBOM: true, headers: ['a'], alwaysWriteHeaders: true };
        await expect(writeBrowser([], options)).resolves.toBe(await writeNode([], options));
    });
});
