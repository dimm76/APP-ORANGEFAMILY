const command = process.argv.slice(2).join(' ');
if (/git\s+reset\s+--hard|git\s+clean\s+-fd|git\s+push\s+.*--force|git\s+push\s+.*\bmain\b/i.test(command)) { console.error('BLOCKED: dangerous or direct-main Git operation'); process.exit(2); }
