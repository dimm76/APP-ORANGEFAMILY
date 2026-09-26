import { taskFiles } from './harness-lib.mjs';
process.stdout.write(`${taskFiles({ base: process.argv[2] ?? 'origin/main' }).join('\n')}\n`);
