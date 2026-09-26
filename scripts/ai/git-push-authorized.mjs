const [contractFile, target = 'feature'] = process.argv.slice(2);
const contract = JSON.parse(await import('node:fs/promises').then(fs => fs.readFile(contractFile, 'utf8')));
const op = target === 'main' ? 'git.push_main' : 'git.push_feature';
if (!contract.authorized_operations?.includes(op)) { console.error(`HARD_STOP: ${op} is not authorized`); process.exit(2); }
console.log(`PASS: ${op}`);
