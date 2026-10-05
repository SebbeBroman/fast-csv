import { ParserOptions } from '../../ParserOptions.js';
import { NonQuotedColumnParser } from './NonQuotedColumnParser.js';
import { QuotedColumnParser } from './QuotedColumnParser.js';
import { CoreScanner } from '../CoreScanner.js';

export class ColumnParser {
    private readonly quoteCode: number;

    public readonly nonQuotedColumnParser: NonQuotedColumnParser;

    public readonly quotedColumnParser: QuotedColumnParser;

    public constructor(parserOptions: ParserOptions) {
        this.quoteCode = parserOptions.quote?.length === 1 ? parserOptions.quote.charCodeAt(0) : -1;
        this.quotedColumnParser = new QuotedColumnParser(parserOptions);
        this.nonQuotedColumnParser = new NonQuotedColumnParser(parserOptions);
    }

    public parse(scanner: CoreScanner): string | null {
        const pos = scanner.findNextNonSpace();
        if (pos !== -1 && scanner.line.charCodeAt(pos) === this.quoteCode) {
            scanner.advanceTo(pos);
            return this.quotedColumnParser.parse(scanner);
        }
        return this.nonQuotedColumnParser.parse(scanner);
    }
}
