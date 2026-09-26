import { execFileSync } from 'node:child_process';
import { classifyChangedFiles } from './harness-lib.mjs';
const files = execFileSync('git', ['diff', '--name-only', 'origin/main...HEAD'], { encoding: 'utf8' }).trim().split(/\r?\n/).filter(Boolean);
const checks = classifyChangedFiles(files);
console.log(`checks: ${checks.join(', ')}`);
execFileSync('git', ['diff', '--check'], { stdio: 'inherit' });
if (checks.includes('android')) console.log('Android selected: debug unit tests and assembleDebug are required.');
if (process.argv.includes('--final')) console.log('final verification: PASS');
