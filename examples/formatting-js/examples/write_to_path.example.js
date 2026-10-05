import { fileURLToPath } from 'node:url';
const __dirname = fileURLToPath(new URL('.', import.meta.url));
import * as fs from 'fs';
import * as path from 'path';
import * as csv from '@sebbro/fast-csv';

const rows = [
    ['a', 'b'],
    ['a1', 'b1'],
    ['a2', 'b2'],
];
const filePath = path.resolve(__dirname, 'write_to_path.tmp.csv');
csv.writeToPath(filePath, rows)
    .on('error', (err) => console.error(err))
    .on('finish', () => {
        console.log('File Contents:');
        console.log(fs.readFileSync(filePath).toString());
    });

// Output:
// File Contents:
// a,b
// a1,b1
// a2,b2
