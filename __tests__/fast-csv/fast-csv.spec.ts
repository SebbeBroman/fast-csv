import * as csvFormat from '../../src/format';
import * as node from '@sebbebroman/fast-csv/node';
import * as csv from '@sebbebroman/fast-csv';
import * as browser from '@sebbebroman/fast-csv/browser';

describe('package entry points', () => {
    it('provides portable parsing and formatting from the root in Node.js', async () => {
        expect(csv.parseText('name,value\nAlice,1', { headers: true })).toEqual([{ name: 'Alice', value: '1' }]);
        expect(csv.parseTextWithInfo('a,b').rowCount).toBe(1);
        expect(await csv.writeToString([['a,b', 'c']])).toBe('"a,b",c');
        expect(csv).not.toHaveProperty('parseFile');
        expect(csv).not.toHaveProperty('CsvParserStream');
    });

    it('keeps /browser as an alias for the portable root API', () => {
        expect(browser).toEqual(csv);
    });

    it('exposes Node stream formatting under /node', () => {
        expect(node.format).toBe(csvFormat.format);
        expect(node.writeToString).toBe(csvFormat.writeToString);
        expect(node.writeToString).not.toBe(csv.writeToString);
    });
});
