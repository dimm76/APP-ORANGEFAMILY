import { inAllowedPaths } from './harness-lib.mjs';
const [contractFile, ...files] = process.argv.slice(2);
const contract = JSON.parse(await import('node:fs/promises').then(fs => fs.readFile(contractFile, 'utf8')));
const outside = files.filter(file => !inAllowedPaths(file, contract.allowed_paths));
if (outside.length) { console.error(`HARD_STOP: files outside allowed_paths\n${outside.join('\n')}`); process.exit(2); }
console.log('PASS: scope');
