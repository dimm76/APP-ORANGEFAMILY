import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { resolveHarnessBaseRef, selectChecks, taskFiles } from './harness-lib.mjs';
import { compareResults, runCheck } from './baseline-delta.mjs';
const args = process.argv.slice(2);
const eventPath = process.env.GITHUB_EVENT_PATH;
let payload = {};
if (eventPath && fs.existsSync(eventPath) && fs.statSync(eventPath).isFile()) {
  try { payload = JSON.parse(fs.readFileSync(eventPath, 'utf8')); } catch { payload = {}; }
}
const base = resolveHarnessBaseRef({ override: process.env.HARNESS_BASE_REF ?? '', eventName: process.env.GITHUB_EVENT_NAME ?? '', payload });
const files = taskFiles({ base });
const contractFile = process.env.HARNESS_TASK_CONTRACT;
const contract = contractFile && fs.existsSync(contractFile) ? JSON.parse(fs.readFileSync(contractFile, 'utf8')) : {};
const checks = selectChecks(files, contract);
const run = (command, commandArgs, cwd = process.cwd()) => execFileSync(command, commandArgs, {
  cwd,
  stdio: 'inherit',
  shell: process.platform === 'win32' && command.endsWith('.cmd'),
});
console.log(`checks: ${checks.join(', ')}`);
if (contractFile) runScope(contractFile, files);
execFileSync('git', ['diff', '--check'], { stdio: 'inherit' });
function runScope(file, changed) { run(process.execPath, ['scripts/ai/scope-check.mjs', file, ...changed]); }
if (checks.includes('frontend')) { run(process.platform === 'win32' ? 'npm.cmd' : 'npm', ['run', 'build']); run(process.platform === 'win32' ? 'npx.cmd' : 'npx', ['eslint', ...files.filter(file => /\.(mjs|js|jsx|ts|tsx)$/.test(file))]); }
if (checks.includes('backend')) {
  const current = runCheck(process.platform === 'win32' ? 'npm.cmd' : 'npm', ['test', '--prefix', 'backend'], process.cwd());
  let baseline = null;
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'orangefamily-baseline-'));
  try {
    run('git', ['worktree', 'add', '--detach', temp, process.env.HARNESS_BASE_SHA ?? base]);
    run(process.platform === 'win32' ? 'npm.cmd' : 'npm', ['ci', '--prefix', 'backend'], temp);
    baseline = runCheck(process.platform === 'win32' ? 'npm.cmd' : 'npm', ['test', '--prefix', 'backend'], temp);
  } finally {
    run('git', ['worktree', 'remove', '--force', temp]);
  }
  const delta = compareResults(baseline, current);
  console.log(`backend current: ${current.status} (${current.failed.length} failures)`);
  console.log(`backend baseline: ${baseline?.status ?? 'unavailable'} (${baseline?.failed?.length ?? 0} failures)`);
  console.log(`backend delta: ${delta.status}`);
  if (!['PASS', 'PASS_WITH_BASELINE', 'PASS_IMPROVED'].includes(delta.status)) process.exit(4);
}
if (checks.includes('database')) run(process.execPath, ['scripts/ai/migration-schema-check.mjs', ...files]);
if (checks.includes('documentation')) run(process.execPath, ['scripts/ai/docs-impact.mjs', ...(contractFile ? ['--contract', contractFile] : []), '--files', ...files]);
if (checks.includes('security')) run(process.execPath, ['scripts/ai/security-risk.mjs', ...files]);
if (checks.includes('android')) {
  const androidDir = 'mobile/orange-photos-sync-agent';
  const gradle = process.platform === 'win32' ? 'gradlew.bat' : './gradlew';
  if (!fs.existsSync(`${androidDir}/${gradle}`)) { console.error('BLOCKED: Android Gradle wrapper unavailable'); process.exit(3); }
  run(gradle, [':app:testDebugUnitTest', '--no-configuration-cache'], androidDir);
  run(gradle, [':app:assembleDebug', '--no-configuration-cache'], androidDir);
}
if (checks.includes('harness')) run(process.execPath, ['--test', 'scripts/ai/harness.test.mjs', 'scripts/ai/autonomous-run.test.mjs']);
if (args.includes('--final')) console.log('final verification: PASS');
