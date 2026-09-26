import { inAllowedPaths } from './harness-lib.mjs';
const [contractFile, ...providedFiles] = process.argv.slice(2);
const contract = JSON.parse(await import('node:fs/promises').then(fs => fs.readFile(contractFile, 'utf8')));
const { taskFiles } = await import('./harness-lib.mjs');
const files = providedFiles.length ? providedFiles : taskFiles({ base: contract.base_ref ?? 'origin/main' });
const outside = files.filter(file => !inAllowedPaths(file, contract.allowed_paths));
if (outside.length) { console.error(`HARD_STOP: files outside allowed_paths\n${outside.join('\n')}`); process.exit(2); }
console.log('PASS: scope');
