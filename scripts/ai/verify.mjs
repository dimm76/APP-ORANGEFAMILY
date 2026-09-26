import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import { selectChecks, taskFiles } from './harness-lib.mjs';
const args = process.argv.slice(2);
const base = process.env.HARNESS_BASE_REF ?? 'origin/main';
const files = taskFiles({ base });
const contractFile = process.env.HARNESS_TASK_CONTRACT;
const contract = contractFile && fs.existsSync(contractFile) ? JSON.parse(fs.readFileSync(contractFile, 'utf8')) : {};
const checks = selectChecks(files, contract);
const run = (command, commandArgs, cwd = process.cwd()) => execFileSync(command, commandArgs, { cwd, stdio: 'inherit' });
console.log(`checks: ${checks.join(', ')}`);
if (contractFile) runScope(contractFile, files);
execFileSync('git', ['diff', '--check'], { stdio: 'inherit' });
function runScope(file, changed) { run(process.execPath, ['scripts/ai/scope-check.mjs', file, ...changed]); }
if (checks.includes('frontend')) { run(process.platform === 'win32' ? 'npm.cmd' : 'npm', ['run', 'build']); run(process.platform === 'win32' ? 'npx.cmd' : 'npx', ['eslint', ...files.filter(file => /\.(mjs|js|jsx|ts|tsx)$/.test(file))]); }
if (checks.includes('backend')) run(process.platform === 'win32' ? 'npm.cmd' : 'npm', ['test', '--prefix', 'backend']);
if (checks.includes('database')) run(process.execPath, ['scripts/ai/migration-schema-check.mjs', ...files]);
if (checks.includes('documentation')) run(process.execPath, ['scripts/ai/docs-impact.mjs', ...files]);
if (checks.includes('security')) run(process.execPath, ['scripts/ai/security-risk.mjs', ...files]);
if (checks.includes('android')) {
  const androidDir = 'mobile/orange-photos-sync-agent';
  const gradle = process.platform === 'win32' ? 'gradlew.bat' : './gradlew';
  if (!fs.existsSync(`${androidDir}/${gradle}`)) { console.error('BLOCKED: Android Gradle wrapper unavailable'); process.exit(3); }
  run(gradle, [':app:testDebugUnitTest', '--no-configuration-cache'], androidDir);
  run(gradle, [':app:assembleDebug', '--no-configuration-cache'], androidDir);
}
if (args.includes('--final')) console.log('final verification: PASS');
