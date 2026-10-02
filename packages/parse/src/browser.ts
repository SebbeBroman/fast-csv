import { Parser } from './parser/Parser.js';
import { ParserOptions, ParserOptionsArgs } from './ParserOptions.js';
import { HeaderTransformer } from './transforms/HeaderTransformer.js';
import { HeaderArray, HeaderTransformFunction, Row, RowArray, RowMap } from './types.js';

export type { Row, RowArray, RowMap, HeaderArray, HeaderTransformFunction } from './types.js';

/** Options for parsing an already-decoded CSV string, without Node streams. */
export interface BrowserParseOptions<I extends Row = Row, O extends Row = I> extends Pick<
    ParserOptionsArgs,
    | 'delimiter'
    | 'quote'
    | 'escape'
    | 'headers'
    | 'renameHeaders'
    | 'ignoreEmpty'
    | 'comment'
    | 'strictColumnHandling'
    | 'discardUnmappedColumns'
    | 'trim'
    | 'ltrim'
    | 'rtrim'
    | 'maxRows'
    | 'skipLines'
    | 'skipRows'
> {
    transform?: (row: I) => O | null;
    validate?: (row: O) => boolean;
}

type ArrayParseOptions = BrowserParseOptions<RowArray<string>> & { headers?: false; transform?: undefined };
type ObjectParseOptions = BrowserParseOptions<RowMap<string>> & {
    headers: true | HeaderArray | HeaderTransformFunction;
    transform?: undefined;
};

export interface InvalidBrowserRow<R extends Row = Row> {
    row: R;
    /** One-based data row number, including invalid rows and excluding skipped rows. */
    rowNumber: number;
    reason?: string;
}

export interface BrowserParseResult<R extends Row = Row> {
    rows: R[];
    headers: HeaderArray | null;
    invalidRows: InvalidBrowserRow[];
    /** Number of processed data rows, including invalid or filtered rows. */
    rowCount: number;
}

/** Parse CSV text synchronously, returning rows and header/validation information. */
export function parseTextWithInfo(text: string, options?: ArrayParseOptions): BrowserParseResult<RowArray<string>>;
export function parseTextWithInfo(text: string, options: ObjectParseOptions): BrowserParseResult<RowMap<string>>;
export function parseTextWithInfo<I extends Row = Row, O extends Row = I>(
    text: string,
    options: BrowserParseOptions<I, O>,
): BrowserParseResult<O>;
export function parseTextWithInfo<I extends Row = Row, O extends Row = I>(
    text: string,
    options: BrowserParseOptions<I, O> = {},
): BrowserParseResult<O> {
    const parserOptions = new ParserOptions(options);
    const parser = new Parser(parserOptions);
    const headerTransformer = new HeaderTransformer<I>(parserOptions);
    const parsed = parser.parse(text, false).rows;
    const result: BrowserParseResult<O> = { rows: [], headers: null, invalidRows: [], rowCount: 0 };
    let parsedRowCount = 0;
    for (let i = 0; i < parsed.length; i += 1) {
        if (i < parserOptions.skipLines) {
            continue;
        }
        if (parserOptions.limitRows && result.rowCount >= parserOptions.maxRows) {
            break;
        }
        const raw = parsed[i];
        const mapped = headerTransformer.transformRow(raw);
        if (mapped.row === null) {
            continue;
        }
        parsedRowCount += 1;
        if (parsedRowCount <= parserOptions.skipRows) {
            continue;
        }
        result.rowCount += 1;
        if (!mapped.isValid) {
            result.invalidRows.push({ row: raw, rowNumber: result.rowCount, reason: mapped.reason });
            continue;
        }
        const row = options.transform ? options.transform(mapped.row) : (mapped.row as unknown as O);
        if (row === null) {
            continue;
        }
        if (options.validate && !options.validate(row)) {
            result.invalidRows.push({ row, rowNumber: result.rowCount });
            continue;
        }
        result.rows.push(row);
    }
    result.headers = headerTransformer.headers;
    return result;
}

/** Parse CSV text synchronously. Use parseTextWithInfo to inspect invalid rows. */
export function parseText(text: string, options?: ArrayParseOptions): RowArray<string>[];
export function parseText(text: string, options: ObjectParseOptions): RowMap<string>[];
export function parseText<I extends Row = Row, O extends Row = I>(
    text: string,
    options: BrowserParseOptions<I, O>,
): O[];
export function parseText<I extends Row = Row, O extends Row = I>(
    text: string,
    options: BrowserParseOptions<I, O> = {},
): O[] {
    return parseTextWithInfo(text, options).rows;
}
