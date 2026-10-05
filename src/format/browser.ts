import { FormatterOptions, FormatterOptionsArgs } from './FormatterOptions.js';
import { RowFormatter } from './formatter/RowFormatter.js';
import { Row } from './types.js';

export type { FormatterOptionsArgs } from './FormatterOptions.js';
export type { Row, RowArray, RowMap, RowHashArray } from './types.js';

/** Format decoded rows without Node streams. Supports sync and callback transforms. */
export async function writeToString<I extends Row, O extends Row>(
    rows: I[],
    options: FormatterOptionsArgs<I, O> = {},
): Promise<string> {
    const opts = new FormatterOptions(options);
    const formatter = new RowFormatter(opts);
    const chunks: string[] = opts.writeBOM && rows.length > 0 ? [opts.BOM] : [];
    if (!options.transform || options.transform.length < 2) {
        const collectSync = (error: Error | null, data?: string[]): void => {
            if (error) {
                throw error;
            }
            if (data) {
                chunks.push(...data);
            }
        };
        for (const row of rows) {
            formatter.format(row, collectSync);
        }
        formatter.finish(collectSync);
        return chunks.join('');
    }
    const collect = (run: (cb: (error: Error | null, data?: string[]) => void) => void): Promise<void> => {
        return new Promise((resolve, reject) => {
            run((error, data) => {
                if (error) {
                    reject(error);
                } else {
                    if (data) chunks.push(...data);
                    resolve();
                }
            });
        });
    };
    for (const row of rows) {
        await collect((cb) => {
            return formatter.format(row, cb);
        });
    }
    await collect((cb) => {
        return formatter.finish(cb);
    });
    return chunks.join('');
}
