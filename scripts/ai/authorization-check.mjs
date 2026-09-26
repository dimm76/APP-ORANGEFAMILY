const [contractFile, operation] = process.argv.slice(2);
const contract = JSON.parse(await import('node:fs/promises').then(fs => fs.readFile(contractFile, 'utf8')));
if (!contract.authorized_operations?.includes(operation)) { console.error(`HARD_STOP: unauthorized operation ${operation}`); process.exit(2); }
console.log('PASS: authorization');
