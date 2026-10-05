import { writeToStream } from '@sebbro/fast-csv';

const rows = [
    ['a', 'b'],
    ['a1', 'b1'],
    ['a2', 'b2'],
];
writeToStream(process.stdout, rows);

// Output:
// a,b
// a1,b1
// a2,b2
