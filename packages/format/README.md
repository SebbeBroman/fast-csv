> Private source workspace for `@sebbro/fast-csv`; this package is not published separately. Browser consumers should import `@sebbro/fast-csv/browser`.

## Local ESM/browser fork

This fork ships native ESM only. Browser formatting has no Node dependencies or polyfills:

```js
import { writeToString } from '@fast-csv/format/browser';

const text = await writeToString([{ name: 'Alice', value: 'a,b' }], { headers: true });
// name,value\nAlice,"a,b"
```

This returns the full CSV string using the existing formatter options, including headers, quoting, escaping, BOMs, row delimiters, and synchronous or callback-based transforms. Promise-returning transforms are rejected; use a callback for asynchronous work. Import the package root for Node streaming APIs.

<p align="center">
  <a href="https://c2fo.github.io/fast-csv" target="blank"><img src="https://c2fo.github.io/fast-csv/img/logo.svg" width="200" alt="fast-csv Logo" /></a>
</p>

[![npm version](https://img.shields.io/npm/v/@fast-csv/format.svg)](https://www.npmjs.org/package/@fast-csv/format)
[![Build Status](https://travis-ci.org/C2FO/fast-csv.svg?branch=master)](https://travis-ci.org/C2FO/fast-csv)
[![Coverage Status](https://coveralls.io/repos/github/C2FO/fast-csv/badge.svg?branch=master)](https://coveralls.io/github/C2FO/fast-csv?branch=master)
[![Known Vulnerabilities](https://snyk.io/test/github/C2FO/fast-csv/badge.svg?targetFile=packages/format/package.json)](https://snyk.io/test/github/C2FO/fast-csv?targetFile=packages/format/package.json)

# `@fast-csv/format`

`fast-csv` package to format CSVs.

## Installation

[Install Guide](https://c2fo.github.io/fast-csv/docs/introduction/install)

## Usage

To get started with `@fast-csv/format` [check out the docs](https://c2fo.github.io/fast-csv/docs/formatting/getting-started)
