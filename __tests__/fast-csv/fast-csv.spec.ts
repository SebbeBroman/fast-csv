import * as csvFormat from '../../src/format';
import * as csv from '../../src';

describe('formatting function', () => {
    describe('format', () => {
        it('should expose the format function', () => {
            expect(csv.format).toBe(csvFormat.format);
        });
    });
});
