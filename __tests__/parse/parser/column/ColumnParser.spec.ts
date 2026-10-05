import { ParserOptions } from '../../../../src/parse';
import { ColumnParser } from '../../../../src/parse/parser/column';
import { Scanner } from '../../../../src/parse/parser';

describe('ColumnParser', () => {
    describe('#parse', () => {
        describe('with un-quoted data', () => {
            it('should call the nonQuotedColumnParser', () => {
                const line = 'HELLO';
                const parserOptions = new ParserOptions({});
                const lineParser = new ColumnParser(parserOptions);
                const scanner = new Scanner({ line, parserOptions, hasMoreData: true });
                const expectedResult = 'HELLO';
                const mock = vi.spyOn(lineParser.nonQuotedColumnParser, 'parse').mockReturnValue(expectedResult);
                expect(lineParser.parse(scanner)).toEqual(expectedResult);
                expect(mock).toHaveBeenCalledExactlyOnceWith(scanner);
            });
        });
        describe('with quoted data', () => {
            it('should call the quotedColumnParser', () => {
                const line = '"HELLO"';
                const parserOptions = new ParserOptions({});
                const lineParser = new ColumnParser(parserOptions);
                const scanner = new Scanner({ line, parserOptions, hasMoreData: true });
                const expectedResult = 'HELLO';
                const mock = vi.spyOn(lineParser.quotedColumnParser, 'parse').mockReturnValue(expectedResult);
                expect(lineParser.parse(scanner)).toEqual(expectedResult);
                expect(mock).toHaveBeenCalledExactlyOnceWith(scanner);
            });
        });
    });
});
