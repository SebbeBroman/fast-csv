import { ParserOptions } from '../../ParserOptions.js';
import { ColumnFormatter } from './ColumnFormatter.js';
import { Scanner } from '../Scanner.js';

export class NonQuotedColumnParser {
    private readonly delimiterCode: number;

    private readonly columnFormatter: ColumnFormatter;

    public constructor(parserOptions: ParserOptions) {
        this.delimiterCode = parserOptions.delimiter.charCodeAt(0);
        this.columnFormatter = new ColumnFormatter(parserOptions);
    }

    public parse(scanner: Scanner): string | null {
        if (!scanner.hasMoreCharacters) {
            return null;
        }
        const { line, cursor, lineLength } = scanner;
        const { delimiterCode } = this;
        let i = cursor;
        for (; i < lineLength; i += 1) {
            const code = line.charCodeAt(i);
            if (code === delimiterCode || code === 10 || code === 13) {
                break;
            }
        }
        scanner.advanceTo(i);
        return this.columnFormatter.format(line.slice(cursor, i));
    }
}
