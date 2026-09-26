const [state] = process.argv.slice(2);
if (state === 'BLOCKED' && !process.env.RECOVERY_ATTEMPTS) { console.error('FAIL: BLOCKED requires recovery_attempts'); process.exit(2); }
if (!['COMPLETE', 'BLOCKED', 'AUTO_CONTINUE'].includes(state)) { console.error('FAIL: invalid state'); process.exit(2); }
console.log(`PASS: ${state}`);
