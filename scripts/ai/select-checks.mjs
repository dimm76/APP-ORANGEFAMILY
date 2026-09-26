import fs from 'node:fs';
import { selectChecks } from './harness-lib.mjs';
const args = process.argv.slice(2);
const contractFile = args[0]?.endsWith('.json') ? args.shift() : null;
const contract = contractFile && fs.existsSync(contractFile) ? JSON.parse(fs.readFileSync(contractFile, 'utf8')) : {};
process.stdout.write(`${selectChecks(args, contract).join('\n')}\n`);
