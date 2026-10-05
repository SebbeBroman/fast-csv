import * as csv from '@sebbebroman/fast-csv/node';

const stream = csv.format({ delimiter: '\t' });
stream.pipe(process.stdout);

stream.write(['a', 'b']);
stream.write(['a1', 'b1']);
stream.write(['a2', 'b2']);
stream.end();

// Output:
// a	b
// a1	b1
// a2	b2
