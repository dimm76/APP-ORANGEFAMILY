import { execFileSync } from 'node:child_process';
const base = process.argv[2] ?? 'origin/main';
const output = execFileSync('git', ['diff', '--name-only', `${base}...HEAD`], { encoding: 'utf8' });
process.stdout.write(output);
