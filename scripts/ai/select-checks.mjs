import { classifyChangedFiles } from './harness-lib.mjs';
process.stdout.write(`${classifyChangedFiles(process.argv.slice(2)).join('\n')}\n`);
