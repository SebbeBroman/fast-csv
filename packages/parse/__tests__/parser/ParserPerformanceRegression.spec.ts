import { Readable } from 'stream';
import { parseStream, ParserOptions, ParserOptionsArgs } from '../../src';
import { Parser } from '../../src/parser';

type Case = { name: string; input: string; options: ParserOptionsArgs; rows: string[][] };
const cases: Case[] = [
    {
        name: 'doubled quotes and embedded CRLF',
        input: 'a,b\r\n"a""b","c\r\nd"\r\n,,',
        options: {},
        rows: [
            ['a', 'b'],
            ['a"b', 'c\r\nd'],
            ['', '', ''],
        ],
    },
    {
        name: 'custom escapes',
        input: '"a\\"b","c\\\\d","e\\xf"\r\n',
        options: { escape: '\\' },
        rows: [['a"b', 'c\\d', 'e\\xf']],
    },
    { name: 'comments with CRLF', input: '# comment\r\na,b\r\n# last', options: { comment: '#' }, rows: [['a', 'b']] },
    {
        name: 'tabs as delimiters',
        input: '\t"a"\t\r\nx\t\ty\n',
        options: { delimiter: '\t' },
        rows: [
            ['', 'a', ''],
            ['x', '', 'y'],
        ],
    },
    { name: 'spaces as delimiters', input: ' "a" \n', options: { delimiter: ' ' }, rows: [['', 'a', '']] },
    { name: 'Unicode whitespace and UTF-8', input: '\u2003"hé😀",\u00a0"ß"\n', options: {}, rows: [['hé😀', 'ß']] },
    { name: 'disabled quotes', input: '"a",b\n', options: { quote: null }, rows: [['"a"', 'b']] },
    { name: 'multiple character quote option', input: 'aabbaa,c\n', options: { quote: 'aa' }, rows: [['aabbaa', 'c']] },
    { name: 'multiple character escape option', input: '"xxy",z\n', options: { escape: 'xx' }, rows: [['xxy', 'z']] },
    {
        name: 'multiple character comment option',
        input: '#keep\n##keep\n',
        options: { comment: '##' },
        rows: [['#keep'], ['##keep']],
    },
    {
        name: 'ignored empty rows',
        input: ' ,\t\n"",\u2003\r\nx,y\n',
        options: { ignoreEmpty: true },
        rows: [['x', 'y']],
    },
];

describe('parser rewrite regressions', () => {
    it.each(cases)('preserves rows at every character boundary: $name', ({ input, options, rows }) => {
        for (let split = 0; split <= input.length; split += 1) {
            const parser = new Parser(new ParserOptions(options));
            const first = parser.parse(input.slice(0, split), true);
            const last = parser.parse(first.line + input.slice(split), false);
            expect({ rows: [...first.rows, ...last.rows], line: last.line }).toEqual({ rows, line: '' });
        }
    });

    it.each(cases)('preserves rows at every UTF-8 byte boundary: $name', async ({ input, options, rows }) => {
        const bytes = Buffer.from(input);
        for (let split = 0; split <= bytes.length; split += 1) {
            const stream = parseStream(Readable.from([bytes.subarray(0, split), bytes.subarray(split)]), options);
            const actual: string[][] = [];
            for await (const row of stream) {
                actual.push(row as string[]);
            }
            expect(actual).toEqual(rows);
        }
    });

    it('preserves an incomplete row after completed rows', () => {
        const parser = new Parser(new ParserOptions());
        expect(parser.parse('a,b\nc,"unterminated', true)).toEqual({ rows: [['a', 'b']], line: 'c,"unterminated' });
    });

    it('handles many custom escapes before a distant closing quote', () => {
        const value = '\\x'.repeat(50000);
        const parser = new Parser(new ParserOptions({ escape: '\\' }));
        expect(parser.parse(`"${value}",tail\n`, false)).toEqual({ rows: [[value, 'tail']], line: '' });
    });

    it('skips all ECMAScript whitespace except the delimiter and row endings', () => {
        const whitespace =
            '\t\v\f \u00a0\u1680\u2000\u2001\u2002\u2003\u2004\u2005\u2006\u2007\u2008\u2009\u200a\u2028\u2029\u202f\u205f\u3000\ufeff';
        const parser = new Parser(new ParserOptions());
        expect(parser.parse(`${whitespace}"value"\n`, false)).toEqual({ rows: [['value']], line: '' });
    });
});
