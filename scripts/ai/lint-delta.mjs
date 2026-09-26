import { spawnSync } from 'node:child_process';
const files = process.argv.slice(2).filter(file => /\.(mjs|js|jsx|ts|tsx)$/.test(file));
if (!files.length) process.exit(0);
process.exit(spawnSync('npx', ['eslint', ...files], { stdio: 'inherit', shell: process.platform === 'win32' }).status ?? 1);
