import { classifyChangedFiles } from './harness-lib.mjs';
console.log(classifyChangedFiles(process.argv.slice(2)).includes('documentation') ? 'documentation:required' : 'documentation:not-required');
