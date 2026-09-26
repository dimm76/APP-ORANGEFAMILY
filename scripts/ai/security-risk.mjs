import { securityRisk } from './harness-lib.mjs';
console.log(JSON.stringify(securityRisk(process.argv.slice(2))));
