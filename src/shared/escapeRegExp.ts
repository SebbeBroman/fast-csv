/**
 * Escape literal regex patterns for Node.js 20 and browsers without RegExp.escape.
 * When used inside a character class, callers must also escape hyphens.
 */
export const escapeRegExp = (value: string): string => {
    return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
};
