import { ParserOptions } from '../ParserOptions.js';
import { MaybeToken, Token } from './Token.js';

/** JS `\s` minus LF/CR — those stay tokens. */
const isSkippableWhitespace = (code: number): boolean => {
    switch (code) {
        case 0x09:
        case 0x0b:
        case 0x0c:
        case 0x20:
        case 0xa0:
        case 0x1680:
        case 0x2028:
        case 0x2029:
        case 0x202f:
        case 0x205f:
        case 0x3000:
        case 0xfeff:
            return true;
        default:
            return code >= 0x2000 && code <= 0x200a;
    }
};

export interface ScannerArgs {
    line: string;
    parserOptions: ParserOptions;
    hasMoreData: boolean;
    cursor?: number;
}

export class Scanner {
    public line: string;

    public readonly delimiterCode: number;

    public lineLength: number;

    public readonly hasMoreData: boolean;

    public cursor = 0;

    public constructor(args: ScannerArgs) {
        this.line = args.line;
        this.lineLength = this.line.length;
        this.delimiterCode = args.parserOptions.delimiter.charCodeAt(0);
        this.hasMoreData = args.hasMoreData;
        this.cursor = args.cursor || 0;
    }

    public get hasMoreCharacters(): boolean {
        return this.lineLength > this.cursor;
    }

    public findNextNonSpace(): number {
        const { line, cursor, lineLength, delimiterCode } = this;
        for (let i = cursor; i < lineLength; i += 1) {
            const code = line.charCodeAt(i);
            if (code === 10 || code === 13 || code === delimiterCode || !isSkippableWhitespace(code)) {
                return i;
            }
        }
        return -1;
    }

    public get nextNonSpaceToken(): MaybeToken {
        const i = this.findNextNonSpace();
        if (i === -1) {
            return null;
        }
        const code = this.line.charCodeAt(i);
        if (code === 13 && i + 1 < this.lineLength && this.line.charCodeAt(i + 1) === 10) {
            return new Token({
                token: '\r\n',
                startCursor: i,
                endCursor: i + 1,
            });
        }
        return new Token({
            token: this.line[i],
            startCursor: i,
            endCursor: i,
        });
    }

    public get nextCharacterToken(): MaybeToken {
        const { cursor, lineLength } = this;
        if (lineLength <= cursor) {
            return null;
        }
        return new Token({
            token: this.line[cursor],
            startCursor: cursor,
            endCursor: cursor,
        });
    }

    public get lineFromCursor(): string {
        return this.line.substr(this.cursor);
    }

    public advancePastLine(): Scanner | null {
        const { line, lineLength } = this;
        for (let i = this.cursor; i < lineLength; i += 1) {
            const code = line.charCodeAt(i);
            if (code === 10 || code === 13) {
                // A final CR may be the first half of a CRLF in the next chunk.
                if (code === 13 && i + 1 === lineLength && this.hasMoreData) {
                    return null;
                }
                this.cursor = code === 13 && line.charCodeAt(i + 1) === 10 ? i + 2 : i + 1;
                return this;
            }
        }
        if (this.hasMoreData) {
            return null;
        }
        this.cursor = lineLength;
        return this;
    }

    public advanceTo(cursor: number): Scanner {
        this.cursor = cursor;
        return this;
    }

    // Kept for consumers of the internal scanner API; the parser uses cursors directly.
    public advanceToToken(token: Token): Scanner {
        return this.advanceTo(token.startCursor);
    }

    public advancePastToken(token: Token): Scanner {
        return this.advanceTo(token.endCursor + 1);
    }

    public truncateToCursor(): Scanner {
        this.line = this.lineFromCursor;
        this.lineLength = this.line.length;
        this.cursor = 0;
        return this;
    }
}
