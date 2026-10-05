import * as fs from 'fs';
import { Readable } from 'stream';
import { ParserOptions, ParserOptionsArgs } from './ParserOptions.js';
import { CsvParserStream } from './CsvParserStream.js';
import { Row } from './types.js';

export * from './types.js';
export { CsvParserStream } from './CsvParserStream.js';
export { ParserOptions, type ParserOptionsArgs } from './ParserOptions.js';

export const parse = <I extends Row, O extends Row>(args?: ParserOptionsArgs): CsvParserStream<I, O> => {
    return new CsvParserStream(new ParserOptions(args));
};

export const parseStream = <I extends Row, O extends Row>(
    stream: NodeJS.ReadableStream,
    options?: ParserOptionsArgs,
): CsvParserStream<I, O> => {
    return stream.pipe(new CsvParserStream(new ParserOptions(options)));
};

export const parseFile = <I extends Row, O extends Row>(
    location: string,
    options: ParserOptionsArgs = {},
): CsvParserStream<I, O> => {
    return fs.createReadStream(location).pipe(new CsvParserStream(new ParserOptions(options)));
};

export const parseString = <I extends Row, O extends Row>(
    string: string,
    options?: ParserOptionsArgs,
): CsvParserStream<I, O> => {
    const rs = new Readable();
    rs.push(string);
    rs.push(null);
    return rs.pipe(new CsvParserStream(new ParserOptions(options)));
};
