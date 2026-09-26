const files = process.argv.slice(2);
const migrations = files.filter(file => /^(docs\/30-database\/migration|database\/.*migration).*\.sql$/i.test(file));
const historical = migrations.filter(file => /docs\/30-database\/migration\//i.test(file) && !/^[^/]+$/.test(file));
if (files.some(file => /\.sql$/i.test(file)) && !migrations.length) { console.error('FAIL: SQL path is outside the real OrangeFamily migration structure'); process.exit(2); }
if (historical.some(file => !/\d{8,}/.test(file))) { console.error('FAIL: migration filename is not versioned'); process.exit(2); }
if (migrations.length) console.log('database migration structure verified; execution remains unauthorized by default');
else console.log('database: not affected');
