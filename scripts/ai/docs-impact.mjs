import { classifyChangedFiles } from './harness-lib.mjs';
import fs from 'node:fs';
const [contractFile, ...provided] = process.argv.slice(2);
const files = provided.length ? provided : [];
const contract = contractFile?.endsWith('.json') && fs.existsSync(contractFile) ? JSON.parse(fs.readFileSync(contractFile, 'utf8')) : {};
const required = contract.required_docs?.length > 0 || classifyChangedFiles(files).includes('documentation');
const missing = (contract.required_docs ?? []).filter(file => !fs.existsSync(file));
if (required && missing.length) { console.error(`FAIL: required documentation missing\n${missing.join('\n')}`); process.exit(2); }
console.log(required ? 'documentation:verified' : 'documentation:not-required');
