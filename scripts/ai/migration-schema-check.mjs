const files = process.argv.slice(2);
if (files.some(file => /migration|\.sql$/i.test(file))) console.log('database migration review required; no migration applied');
else console.log('database: not affected');
