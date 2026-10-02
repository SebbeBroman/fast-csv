import { Scanner } from './Scanner';
import { RowParser } from './RowParser';
import { ParserOptions } from '../ParserOptions';
import { RowArray } from '../types';

export interface ParseResult {
    line: string;
    rows: RowArray<string>[];
}
export class Parser {
    private static removeBOM(line: string): string {
        // Catches EFBBBF (UTF-8 BOM) because the buffer-to-string
        // conversion translates it to FEFF (UTF-16 BOM)
        if (line && line.charCodeAt(0) === 0xfeff) {
            return line.slice(1);
        }
        return line;
    }

    private readonly parserOptions: ParserOptions;

    private readonly rowParser: RowParser;

    public constructor(parserOptions: ParserOptions) {
        this.parserOptions = parserOptions;
        this.rowParser = new RowParser(this.parserOptions);
    }

    public parse(line: string, hasMoreData: boolean): ParseResult {
        const scanner = new Scanner({
            line: Parser.removeBOM(line),
            parserOptions: this.parserOptions,
            hasMoreData,
        });
        if (this.parserOptions.supportsComments) {
            return this.parseWithComments(scanner);
        }
        return this.parseWithoutComments(scanner);
    }

    private parseWithoutComments(scanner: Scanner): ParseResult {
        const rows: RowArray<string>[] = [];
        let rowStart = scanner.cursor;
        let shouldContinue = true;
        while (shouldContinue) {
            shouldContinue = this.parseRow(scanner, rows);
            if (shouldContinue) {
                rowStart = scanner.cursor;
            }
        }
        return { line: scanner.line.slice(rowStart), rows };
    }

    private parseWithComments(scanner: Scanner): ParseResult {
        const comment = this.parserOptions.comment;
        const commentCode = comment?.length === 1 ? comment.charCodeAt(0) : -1;
        const rows: RowArray<string>[] = [];
        let rowStart = scanner.cursor;
        while (scanner.hasMoreCharacters) {
            if (scanner.line.charCodeAt(scanner.cursor) === commentCode) {
                const cursor = scanner.advancePastLine();
                if (cursor === null) {
                    return { line: scanner.line.slice(rowStart), rows };
                }
                if (!scanner.hasMoreCharacters) {
                    return { line: scanner.line.slice(scanner.cursor), rows };
                }
                rowStart = scanner.cursor;
            } else if (!this.parseRow(scanner, rows)) {
                break;
            } else {
                rowStart = scanner.cursor;
            }
        }
        return { line: scanner.line.slice(rowStart), rows };
    }

    private parseRow(scanner: Scanner, rows: RowArray<string>[]): boolean {
        if (scanner.findNextNonSpace() === -1) {
            return false;
        }
        const row = this.rowParser.parse(scanner);
        if (row === null) {
            return false;
        }
        if (this.parserOptions.ignoreEmpty && RowParser.isEmptyRow(row)) {
            return true;
        }
        rows.push(row);
        return true;
    }
}
