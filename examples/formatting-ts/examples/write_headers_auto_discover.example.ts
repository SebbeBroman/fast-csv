import { format } from '@sebbebroman/fast-csv/node';

const csvStream = format({ headers: true, writeHeaders: false });

csvStream.pipe(process.stdout).on('end', () => {
    return process.exit();
});

csvStream.write({ header1: 'value1a', header2: 'value2a' });
csvStream.write({ header1: 'value1a', header2: 'value2a' });
csvStream.write({ header1: 'value1a', header2: 'value2a' });
csvStream.write({ header1: 'value1a', header2: 'value2a' });
csvStream.end();

// Output:
// value1a,value2a
// value1a,value2a
// value1a,value2a
// value1a,value2a
