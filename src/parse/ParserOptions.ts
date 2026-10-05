import { HeaderArray, HeaderTransformFunction } from './types.js';

// TODO(major): use native RegExp.escape once engines require Node >=24 (available since Node 24)
/** Escape special characters for use in a RegExp. */
const escapeRegExp = (value: string): string => {
    return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
};

/** Encodings supported by the Node adapter, without requiring Node types in the parser core. */
export type CsvEncoding =
    | 'ascii'
    | 'utf8'
    | 'utf-8'
    | 'utf16le'
    | 'utf-16le'
    | 'ucs2'
    | 'ucs-2'
    | 'base64'
    | 'base64url'
    | 'latin1'
    | 'binary'
    | 'hex';

export interface ParserOptionsArgs {
    objectMode?: boolean;
    delimiter?: string;
    quote?: string | null;
    escape?: string;
    headers?: boolean | HeaderTransformFunction | HeaderArray;
    renameHeaders?: boolean;
    ignoreEmpty?: boolean;
    comment?: string;
    strictColumnHandling?: boolean;
    discardUnmappedColumns?: boolean;
    trim?: boolean;
    ltrim?: boolean;
    rtrim?: boolean;
    encoding?: string;
    maxRows?: number;
    skipLines?: number;
    skipRows?: number;
}

export class ParserOptions {
    public get escapedDelimiter(): string {
        return escapeRegExp(this.delimiter);
    }

    public readonly objectMode: boolean = true;

    public readonly delimiter: string = ',';

    public readonly ignoreEmpty: boolean = false;

    public readonly quote: string | null = '"';

    public readonly escape: string | null = null;

    public readonly escapeChar: string | null = this.quote;

    public readonly comment: string | null = null;

    public readonly supportsComments: boolean = false;

    public readonly ltrim: boolean = false;

    public readonly rtrim: boolean = false;

    public readonly trim: boolean = false;

    public readonly headers: boolean | HeaderTransformFunction | HeaderArray | null = null;

    public readonly renameHeaders: boolean = false;

    public readonly strictColumnHandling: boolean = false;

    public readonly discardUnmappedColumns: boolean = false;

    public readonly carriageReturn: string = '\r';

    private nextTokenRegexp?: RegExp;

    /** Lazily retained for compatibility; cursor parsing does not use token regexes. */
    public get NEXT_TOKEN_REGEXP(): RegExp {
        return (this.nextTokenRegexp ??= new RegExp(`([^\\s]|\\r\\n|\\n|\\r|${this.escapedDelimiter})`));
    }

    public readonly encoding: CsvEncoding = 'utf8';

    public readonly limitRows: boolean = false;

    public readonly maxRows: number = 0;

    public readonly skipLines: number = 0;

    public readonly skipRows: number = 0;

    public constructor(opts?: ParserOptionsArgs) {
        Object.assign(this, opts || {});
        if (this.delimiter.length > 1) {
            throw new Error('delimiter option must be one character long');
        }
        this.escapeChar = this.escape ?? this.quote;
        this.supportsComments = this.comment != null;

        if (this.maxRows > 0) {
            this.limitRows = true;
        }
    }
}
