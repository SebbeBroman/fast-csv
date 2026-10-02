import { parseText, parseTextWithInfo } from '../src/browser';
import { parseString, Row, ParserOptionsArgs } from '../src';
import { BrowserParseOptions } from '../src/browser';

const collectNode = async (text: string, options: ParserOptionsArgs) => {
    const rows: Row[] = [];
    const invalidRows: { row: Row; rowNumber: number; reason?: string }[] = [];
    let headers: (string | null | undefined)[] | null = null;
    let rowCount = 0;
    const stream = parseString(text, options);
    await new Promise<void>((resolve, reject) => {
        stream.on('data', (row: Row) => {
            rows.push(row);
        });
        stream.on('data-invalid', (row: Row, rowNumber: number, reason?: string) => {
            invalidRows.push({ row, rowNumber, ...(reason === undefined ? {} : { reason }) });
        });
        stream.on('headers', (value: string[]) => {
            headers = value;
        });
        stream.on('error', reject);
        stream.on('end', (count: number) => {
            rowCount = count;
            resolve();
        });
    });
    return { rows, invalidRows, headers, rowCount };
};

describe('browser parser', () => {
    const cases: { name: string; text: string; options: BrowserParseOptions }[] = [
        { name: 'arrays and quoted newlines', text: '"a,b","c\r\nd"\n,,\n', options: {} },
        { name: 'headers', text: 'name,value\nAlice,1\nBob,2', options: { headers: true } },
        { name: 'custom headers', text: 'Alice,1\nBob,2', options: { headers: ['name', 'value'] } },
        {
            name: 'header transform',
            text: 'Name,Value\nAlice,1',
            options: {
                headers: (headers) => {
                    return headers.map((h) => {
                        return h?.toLowerCase();
                    });
                },
            },
        },
        {
            name: 'renamed headers',
            text: 'Name,Value\nAlice,1',
            options: { headers: ['name', 'value'], renameHeaders: true },
        },
        { name: 'short mapped rows', text: 'a,b\nx', options: { headers: true } },
        {
            name: 'strict invalid rows',
            text: 'a,b\nx\ny,z,w\nu,v',
            options: { headers: true, strictColumnHandling: true },
        },
        { name: 'discarded columns', text: 'a,b\nx,y,z', options: { headers: true, discardUnmappedColumns: true } },
        {
            name: 'skip lines and rows and limit',
            text: 'ignored\na,b\nx,y\nu,v\np,q',
            options: { headers: true, skipLines: 1, skipRows: 1, maxRows: 1 },
        },
        {
            name: 'invalid rows count toward maxRows',
            text: 'a,b\nx\nu,v',
            options: { headers: true, strictColumnHandling: true, maxRows: 1 },
        },
        {
            name: 'empty rows, comments and trimming',
            text: '#skip\n,\n a , b \n',
            options: { comment: '#', ignoreEmpty: true, trim: true },
        },
        {
            name: 'Unicode and custom escapes',
            text: '\ufeff"hé\\"😀"\t"ß"\r\n',
            options: { delimiter: '\t', escape: '\\' },
        },
        { name: 'empty input', text: '', options: {} },
        { name: 'header-only input', text: 'a,b', options: { headers: true } },
    ];
    it.each(cases)('matches the Node stream: $name', async ({ text, options }) => {
        const browser = parseTextWithInfo(text, options);
        const node = await collectNode(text, options);
        // The Node stream currently drops strict-column mismatch reasons; the browser retains them.
        const invalidRows = (rows: typeof browser.invalidRows) => {
            return rows.map(({ row, rowNumber }) => {
                return { row, rowNumber };
            });
        };
        expect({ ...browser, invalidRows: invalidRows(browser.invalidRows) }).toEqual({
            ...node,
            invalidRows: invalidRows(node.invalidRows),
        });
    });

    it('reports strict-column mismatch reasons', () => {
        expect(parseTextWithInfo('a,b\nx', { headers: true, strictColumnHandling: true }).invalidRows).toEqual([
            { row: ['x'], rowNumber: 1, reason: 'Column header mismatch expected: 2 columns got: 1' },
        ]);
    });

    it('returns arrays by default', () => {
        expect(parseText('a,b\nx,y')).toEqual([
            ['a', 'b'],
            ['x', 'y'],
        ]);
    });

    it('supports synchronous transforms, filtered rows, and validation', () => {
        const result = parseTextWithInfo<{ name: string; value: string }, { name: string; value: number }>(
            'name,value\nAlice,1\nSkip,2\nBob,-1\nCarol,3',
            {
                headers: true,
                transform: (row) => {
                    return row.name === 'Skip' ? null : { name: row.name, value: Number(row.value) };
                },
                validate: (row) => {
                    return row.value > 0;
                },
            },
        );
        expect(result).toEqual({
            rows: [
                { name: 'Alice', value: 1 },
                { name: 'Carol', value: 3 },
            ],
            headers: ['name', 'value'],
            rowCount: 4,
            invalidRows: [{ row: { name: 'Bob', value: -1 }, rowNumber: 3 }],
        });
    });

    it('throws for malformed CSV and duplicate headers', () => {
        expect(() => {
            parseText('"unterminated');
        }).toThrow('missing closing');
        expect(() => {
            parseText('a,a\nx,y', { headers: true });
        }).toThrow('Duplicate headers');
        expect(() => {
            parseText('a\nx,y', { headers: true });
        }).toThrow('column header mismatch');
    });
});
