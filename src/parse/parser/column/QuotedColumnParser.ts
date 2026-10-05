import { ColumnFormatter } from './ColumnFormatter.js';
import { ParserOptions } from '../../ParserOptions.js';
import { CoreScanner } from '../CoreScanner.js';

export class QuotedColumnParser {
    private readonly parserOptions: ParserOptions;

    private readonly columnFormatter: ColumnFormatter;

    private readonly quoteCode: number;

    private readonly escapeCode: number;

    public constructor(parserOptions: ParserOptions) {
        this.parserOptions = parserOptions;
        this.columnFormatter = new ColumnFormatter(parserOptions);
        this.quoteCode = parserOptions.quote?.length === 1 ? parserOptions.quote.charCodeAt(0) : -1;
        this.escapeCode = parserOptions.escapeChar?.length === 1 ? parserOptions.escapeChar.charCodeAt(0) : -1;
    }

    public parse(scanner: CoreScanner): string | null {
        if (!scanner.hasMoreCharacters) {
            return null;
        }
        const originalCursor = scanner.cursor;
        const col = this.gatherDataBetweenQuotes(scanner);
        if (col === null) {
            scanner.advanceTo(originalCursor);
            if (!scanner.hasMoreData) {
                throw new Error(
                    `Parse Error: missing closing: '${
                        this.parserOptions.quote || ''
                    }' in line: at '${scanner.lineFromCursor.replace(/[\r\n]/g, "\\n'")}'`,
                );
            }
            return null;
        }
        this.checkForMalformedColumn(scanner);
        return col;
    }

    private gatherDataBetweenQuotes(scanner: CoreScanner): string | null {
        const { parserOptions, columnFormatter, quoteCode, escapeCode } = this;
        const { line, lineLength } = scanner;
        let i = scanner.cursor;

        if (quoteCode === -1) {
            scanner.advanceTo(lineLength);
            return null;
        }

        const quote = parserOptions.quote as string;
        const opening = line.indexOf(quote, i);
        if (opening === -1) {
            scanner.advanceTo(lineLength);
            return null;
        }
        i = opening + 1;
        const contentStart = i;
        const escapeChar = parserOptions.escapeChar;
        const sameEscape = escapeCode === quoteCode;

        let foundClosingQuote = false;
        let parts: string[] | null = null;
        let spanStart = contentStart;

        let nextQuoteIndex = sameEscape ? -1 : line.indexOf(quote, i);
        while (i < lineLength) {
            if (sameEscape) {
                const quoteIndex = line.indexOf(quote, i);
                if (quoteIndex === -1) {
                    break;
                }
                if (quoteIndex + 1 < lineLength && line.charCodeAt(quoteIndex + 1) === quoteCode) {
                    if (parts === null) {
                        parts = [];
                    }
                    if (quoteIndex > spanStart) {
                        parts.push(line.slice(spanStart, quoteIndex));
                    }
                    parts.push(quote);
                    i = quoteIndex + 2;
                    spanStart = i;
                    continue;
                }
                if (parts !== null && quoteIndex > spanStart) {
                    parts.push(line.slice(spanStart, quoteIndex));
                }
                i = quoteIndex + 1;
                foundClosingQuote = true;
                break;
            }

            const quoteIndex = nextQuoteIndex;
            const escapeIndex = escapeCode === -1 || escapeChar === null ? -1 : line.indexOf(escapeChar, i);
            if (escapeIndex !== -1 && (quoteIndex === -1 || escapeIndex < quoteIndex)) {
                const nextCode = escapeIndex + 1 < lineLength ? line.charCodeAt(escapeIndex + 1) : -1;
                if (nextCode === quoteCode || nextCode === escapeCode) {
                    if (parts === null) {
                        parts = [];
                    }
                    if (escapeIndex > spanStart) {
                        parts.push(line.slice(spanStart, escapeIndex));
                    }
                    parts.push(line[escapeIndex + 1]);
                    i = escapeIndex + 2;
                    if (nextCode === quoteCode) {
                        nextQuoteIndex = line.indexOf(quote, i);
                    }
                    spanStart = i;
                    continue;
                }
                i = escapeIndex + 1;
                continue;
            }
            if (quoteIndex === -1) {
                break;
            }
            if (parts !== null && quoteIndex > spanStart) {
                parts.push(line.slice(spanStart, quoteIndex));
            }
            i = quoteIndex + 1;
            foundClosingQuote = true;
            break;
        }

        scanner.advanceTo(foundClosingQuote ? i : lineLength);

        if (!foundClosingQuote) {
            return null;
        }

        const raw = parts === null ? line.slice(contentStart, i - 1) : parts.join('');
        return columnFormatter.format(raw);
    }

    private checkForMalformedColumn(scanner: CoreScanner): void {
        const { parserOptions } = this;
        const pos = scanner.findNextNonSpace();
        if (pos !== -1) {
            const code = scanner.line.charCodeAt(pos);
            const isDelimiter = code === scanner.delimiterCode;
            const isRowDelimiter = code === 10 || code === 13;
            if (!(isDelimiter || isRowDelimiter)) {
                const linePreview = scanner.line.slice(scanner.cursor, scanner.cursor + 10).replace(/[\r\n]/g, "\\n'");
                throw new Error(
                    `Parse Error: expected: '${parserOptions.escapedDelimiter}' OR new line got: '${scanner.line[pos]}'. at '${linePreview}'`,
                );
            }
            scanner.advanceTo(pos);
        } else if (!scanner.hasMoreData) {
            scanner.advancePastLine();
        }
    }
}
