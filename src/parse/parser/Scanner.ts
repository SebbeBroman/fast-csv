import { CoreScanner } from './CoreScanner.js';
import { MaybeToken, Token } from './Token.js';

export type { ScannerArgs } from './CoreScanner.js';

/** Compatibility helpers for consumers of the internal token-based scanner. */
export class Scanner extends CoreScanner {
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
