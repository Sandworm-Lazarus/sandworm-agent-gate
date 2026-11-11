#!/usr/bin/env node
'use strict';
const fs = require('node:fs');
const gate = require('../dist/engine.js');
async function main() {
  if (process.argv.length !== 4) {
    process.stderr.write('Usage: node scripts/audit.cjs <policy.json> <calls.json>\n');
    process.exitCode = 2; return;
  }
  try {
    const read = file => {
      const size = fs.statSync(file).size;
      if (size > gate.limits.maxBytes) throw new Error();
      return new TextDecoder('utf-8', {fatal:true}).decode(fs.readFileSync(file));
    };
    const report = await gate.audit(read(process.argv[2]), read(process.argv[3]));
    process.stdout.write(JSON.stringify(report,null,2) + '\n');
  } catch (_) {
    process.stderr.write('Unable to audit: check UTF-8 JSON inputs, schema and size limits.\n');
    process.exitCode = 2;
  }
}
main();
