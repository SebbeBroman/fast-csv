> Private source workspace for `@sebbro/fast-csv`; this package is not published separately. Browser consumers should import `@sebbro/fast-csv/browser`.

## Local ESM/browser fork

This fork includes the optimized parser and ships native ESM only. Node stream APIs remain available through the normal package import. Older CommonJS consumers must migrate to ESM or dynamic imports.

For browser parsing, import the explicit browser subpath. It has no Node runtime dependencies or polyfills:

```js
import { parseText, parseTextWithInfo } from '@fast-csv/parse/browser';

const rows = parseText('name,value\nAlice,1', { headers: true });
// [{ name: 'Alice', value: '1' }]
```

`parseText` parses an already-decoded string synchronously. It supports headers, quoting, custom delimiters/escapes, comments, trimming, skipping/limiting rows, and synchronous transforms/validation. `parseTextWithInfo` additionally returns headers, invalid rows with reasons, and row counts. File decoding is the caller's responsibility. The browser entry point exposes parsing; formatting remains in the Node API.

<p align="center">
  <a href="https://c2fo.github.io/fast-csv" target="blank"><img src="https://c2fo.github.io/fast-csv/img/logo.svg" width="200" alt="fast-csv Logo" /></a>
</p>

[![npm version](https://img.shields.io/npm/v/@fast-csv/parse.svg)](https://www.npmjs.org/package/@fast-csv/parse)
[![Build Status](https://travis-ci.org/C2FO/fast-csv.svg?branch=master)](https://travis-ci.org/C2FO/fast-csv)
[![Coverage Status](https://coveralls.io/repos/github/C2FO/fast-csv/badge.svg?branch=master)](https://coveralls.io/github/C2FO/fast-csv?branch=master)
[![Known Vulnerabilities](https://snyk.io/test/github/C2FO/fast-csv/badge.svg?targetFile=packages/parse/package.json)](https://snyk.io/test/github/C2FO/fast-csv?targetFile=packages/parse/package.json)

# `@fast-csv/parse`

`fast-csv` package to parse CSVs.

## Installation

[Install Guide](https://c2fo.github.io/fast-csv/docs/introduction/install)

## Usage

To get started with `@fast-csv/parse` [check out the docs](https://c2fo.github.io/fast-csv/docs/parsing/getting-started)
