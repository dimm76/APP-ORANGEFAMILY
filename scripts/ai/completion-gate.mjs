import fs from 'node:fs';
import { validateCompletionContract } from './harness-lib.mjs';

const [file] = process.argv.slice(2);
const contract = JSON.parse(fs.readFileSync(file, 'utf8'));
const result = validateCompletionContract(contract);
if (!result.valid) {
  for (const error of result.errors) console.error(`FAIL: ${error}`);
  process.exit(2);
}
console.log(`PASS: ${contract.state}`);
