import { execFileSync, spawnSync } from 'node:child_process';
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

const base = resolveHarnessBaseRef({
  override: process.env.HARNESS_BASE_REF ?? '',
  eventName: process.env.GITHUB_EVENT_NAME ?? '',
  payload,
});
const files = taskFiles({ base });
const contractFile = process.env.HARNESS_TASK_CONTRACT;
const contract = contractFile && fs.existsSync(contractFile)
  ? JSON.parse(fs.readFileSync(contractFile, 'utf8'))
  : {};
const checks = selectChecks(files, contract);
const taskId = contract.task_id || 'verification';
const logDir = path.resolve('.agent-runtime', taskId, 'verify');
fs.mkdirSync(logDir, { recursive: true });

function safeName(value) {
  return value.replace(/[^a-z0-9._-]+/gi, '-').replace(/^-+|-+$/g, '') || 'check';
}

function failureExcerpt(output, maxLines = 40, maxChars = 6000) {
  const lines = String(output ?? '').split(/\r?\n/).filter(Boolean);
  let excerpt = lines.slice(-maxLines).join('\n');
  if (excerpt.length > maxChars) excerpt = excerpt.slice(-maxChars);
  return excerpt;
}

function runCompact(name, command, commandArgs, cwd = process.cwd(), { fatal = true } = {}) {
  const isWindowsCmd = process.platform === 'win32' && command.endsWith('.cmd');
  const result = spawnSync(
    isWindowsCmd ? 'cmd.exe' : command,
    isWindowsCmd ? ['/d', '/s', '/c', command, ...commandArgs] : commandArgs,
    { cwd, encoding: 'utf8' },
  );
  const output = [result.stdout, result.stderr].filter(Boolean).join('\n');
  const logPath = path.join(logDir, `${safeName(name)}.log`);
  fs.writeFileSync(logPath, output, 'utf8');

  if (result.status === 0) {
    console.log(JSON.stringify({ check: name, status: 'PASS', log: path.relative(process.cwd(), logPath) }));
    return true;
  }

  console.error(JSON.stringify({
    check: name,
    status: 'FAIL',
    exit_code: result.status,
    log: path.relative(process.cwd(), logPath),
    excerpt: failureExcerpt(output),
  }));
  if (fatal) process.exit(result.status ?? 1);
  return false;
}

function runScope(file, changed) {
  return runCompact('scope', process.execPath, ['scripts/ai/scope-check.mjs', file, ...changed]);
}

console.log(JSON.stringify({ checks, files: files.length, log_dir: path.relative(process.cwd(), logDir) }));

if (contractFile) runScope(contractFile, files);
runCompact('diff-check', 'git', ['diff', '--check']);

if (checks.includes('frontend')) {
  runCompact('frontend-build', process.platform === 'win32' ? 'npm.cmd' : 'npm', ['run', 'build']);
  const lintFiles = files.filter(file => /\.(mjs|js|jsx|ts|tsx)$/.test(file));
  if (lintFiles.length) {
    runCompact('frontend-eslint', process.platform === 'win32' ? 'npx.cmd' : 'npx', ['eslint', ...lintFiles]);
  }
}

if (checks.includes('backend')) {
  const current = runCheck(
    process.platform === 'win32' ? 'npm.cmd' : 'npm',
    ['test', '--prefix', 'backend'],
    process.cwd(),
  );
  let baseline = null;
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'orangefamily-baseline-'));
  try {
    runCompact('baseline-worktree-add', 'git', ['worktree', 'add', '--detach', temp, process.env.HARNESS_BASE_SHA ?? base]);
    runCompact('baseline-backend-ci', process.platform === 'win32' ? 'npm.cmd' : 'npm', ['ci', '--prefix', 'backend'], temp);
    baseline = runCheck(
      process.platform === 'win32' ? 'npm.cmd' : 'npm',
      ['test', '--prefix', 'backend'],
      temp,
    );
  } finally {
    spawnSync('git', ['worktree', 'remove', '--force', temp], { encoding: 'utf8' });
  }
  const delta = compareResults(baseline, current);
  const backendSummary = {
    check: 'backend-tests',
    status: delta.status,
    current_failures: current.failed,
    baseline_failures: baseline?.failed ?? [],
    added_failures: delta.added,
    removed_failures: delta.removed,
  };
  console.log(JSON.stringify(backendSummary));
  if (!['PASS', 'PASS_WITH_BASELINE', 'PASS_IMPROVED'].includes(delta.status)) process.exit(4);
}

if (checks.includes('database')) {
  runCompact('database', process.execPath, ['scripts/ai/migration-schema-check.mjs', ...files]);
}
if (checks.includes('documentation')) {
  runCompact('documentation', process.execPath, [
    'scripts/ai/docs-impact.mjs',
    ...(contractFile ? ['--contract', contractFile] : []),
    '--files',
    ...files,
  ]);
}
if (checks.includes('security')) {
  runCompact('security', process.execPath, ['scripts/ai/security-risk.mjs', ...files]);
}
if (checks.includes('android')) {
  const androidDir = 'mobile/orange-photos-sync-agent';
  const gradle = process.platform === 'win32' ? 'gradlew.bat' : './gradlew';
  if (!fs.existsSync(`${androidDir}/${gradle}`)) {
    console.error(JSON.stringify({ check: 'android', status: 'BLOCKED', reason: 'Gradle wrapper unavailable' }));
    process.exit(3);
  }
  runCompact('android-unit-tests', gradle, [':app:testDebugUnitTest', '--no-configuration-cache'], androidDir);
  runCompact('android-assemble', gradle, [':app:assembleDebug', '--no-configuration-cache'], androidDir);
}
if (checks.includes('harness')) {
  runCompact('harness', process.execPath, [
    '--test',
    'scripts/ai/harness.test.mjs',
    'scripts/ai/autonomous-run.test.mjs',
    'scripts/ai/autonomous-bootstrap.test.mjs',
  ]);
}

if (args.includes('--final')) console.log(JSON.stringify({ final_verification: 'PASS' }));
