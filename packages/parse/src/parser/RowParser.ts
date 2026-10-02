import { Scanner } from './Scanner';
import { ColumnParser } from './column';
import { ParserOptions } from '../ParserOptions';
import { RowArray } from '../types';

const NON_WHITESPACE = /\S/;

export class RowParser {
    static isEmptyRow(row: RowArray): boolean {
        for (const column of row) {
            if (column != null && NON_WHITESPACE.test(column)) {
                return false;
            }
        }
        return true;
    }

    private readonly delimiterCode: number;

    private readonly columnParser: ColumnParser;

    public constructor(parserOptions: ParserOptions) {
        this.delimiterCode = parserOptions.delimiter.charCodeAt(0);
        this.columnParser = new ColumnParser(parserOptions);
    }

    public parse(scanner: Scanner): RowArray<string> | null {
        const { hasMoreData } = scanner;
        const columns: RowArray<string> = [];
        let pos = this.getStartPos(scanner, columns);
        while (pos !== -1) {
            const code = scanner.line.charCodeAt(pos);
            if (code === 13 || code === 10) {
                const isCR = code === 13;
                const isCRLF = isCR && pos + 1 < scanner.lineLength && scanner.line.charCodeAt(pos + 1) === 10;
                scanner.advanceTo(isCRLF ? pos + 2 : pos + 1);
                if (!scanner.hasMoreCharacters && isCR && !isCRLF && hasMoreData) {
                    return null;
                }
                return columns;
            }
            if (!this.shouldSkipColumnParse(scanner, pos, columns)) {
                const item = this.columnParser.parse(scanner);
                if (item === null) {
                    return null;
                }
                columns.push(item);
            }
            pos = scanner.findNextNonSpace();
        }
        if (!hasMoreData) {
            return columns;
        }
        return null;
    }

    private getStartPos(scanner: Scanner, columns: RowArray<string>): number {
        const pos = scanner.findNextNonSpace();
        if (pos !== -1 && scanner.line.charCodeAt(pos) === this.delimiterCode) {
            columns.push('');
        }
        return pos;
    }

    private shouldSkipColumnParse(scanner: Scanner, pos: number, columns: RowArray<string>): boolean {
        if (scanner.line.charCodeAt(pos) !== this.delimiterCode) {
            return false;
        }
        scanner.advanceTo(pos + 1);
        if (!scanner.hasMoreCharacters) {
            columns.push('');
            return true;
        }
        const nextCode = scanner.line.charCodeAt(scanner.cursor);
        if (nextCode === 10 || nextCode === 13 || nextCode === this.delimiterCode) {
            columns.push('');
            return true;
        }
        return false;
    }
}
