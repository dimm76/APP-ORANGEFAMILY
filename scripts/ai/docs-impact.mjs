import { classifyChangedFiles } from './harness-lib.mjs';
import fs from 'node:fs';
const args = process.argv.slice(2);
const contractIndex = args.indexOf('--contract');
const filesIndex = args.indexOf('--files');
const contractFile = contractIndex >= 0 ? args[contractIndex + 1] : null;
const files = filesIndex >= 0 ? args.slice(filesIndex + 1) : [];
const contract = contractFile && fs.existsSync(contractFile) ? JSON.parse(fs.readFileSync(contractFile, 'utf8')) : {};
const required = contract.required_docs?.length > 0 || classifyChangedFiles(files).includes('documentation');
const missing = (contract.required_docs ?? []).filter(file => !fs.existsSync(file));
if (required && missing.length) { console.error(`FAIL: required documentation missing\n${missing.join('\n')}`); process.exit(2); }
console.log(required ? 'documentation:verified' : 'documentation:not-required');
