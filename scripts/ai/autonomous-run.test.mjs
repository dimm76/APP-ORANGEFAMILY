import assert from 'node:assert/strict'
import test from 'node:test'
import { execFileSync, spawnSync } from 'node:child_process'
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'

const runtimeRoot = join(tmpdir(), 'orangefamily-agent-autonomy-tests')
mkdirSync(runtimeRoot, { recursive: true })

function runSupervisor(dir, mode, extraArgs = [], extraContract = {}, options = {}) {
  const taskId = extraContract.task_id || 'supervisor-test'
  const prompt = join(dir, 'prompt.md')
  const contract = join(dir, 'contract.json')
  const report = join(dir, 'completion-report.json')
  const state = join(dir, 'fake-state.txt')
  const argvPath = join(dir, 'fake-argv.json')
  writeFileSync(prompt, 'Complete the deterministic fake task.')
  const branch = execFileSync('git', ['branch', '--show-current'], { cwd: process.cwd(), encoding: 'utf8' }).trim()
  const head = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: process.cwd(), encoding: 'utf8' }).trim()
  writeFileSync(contract, JSON.stringify({
    task_id: taskId,
    objective: 'Deterministic supervisor fixture',
    base_ref: 'HEAD',
    base_sha: head,
    working_branch: branch,
    allowed_paths: ['**'],
    acceptance_criteria: [{ id: 'done', description: 'done' }],
    out_of_scope: [],
    change_types: ['workflow'],
    required_checks: [],
    state: 'AUTO_CONTINUE',
    ...extraContract,
  }))
  const result = spawnSync(process.execPath, [
    'scripts/ai/autonomous-run.mjs',
    '--prompt-file', prompt,
    '--contract', contract,
    '--completion-report', report,
    '--max-minutes', '2',
    ...extraArgs,
  ], {
    cwd: process.cwd(),
    encoding: 'utf8',
    env: {
      ...process.env,
      NODE_ENV: 'test',
      AUTONOMOUS_RUN_TEST_MODE: '1',
      AUTONOMOUS_RUN_TEST_ALLOW_PROTECTED_BRANCH: options.allowProtectedBranch === false ? '0' : '1',
      FAKE_MODE: mode,
      FAKE_TASK_ID: taskId,
      FAKE_STATE: state,
      FAKE_ARGV_PATH: argvPath,
      FAKE_REPORT: report,
      FAKE_PROVIDER: process.env.FAKE_PROVIDER || '',
      AUTONOMOUS_RUN_RUNTIME_ROOT: runtimeRoot,
    },
  })
  return { result, report, state, taskId, argvPath }
}

test('supervisor auto-continues incomplete work until COMPLETE', () => {
  const dir = mkdtempSync(join(runtimeRoot, 'supervisor-continue-'))
  try {
    const { result, state } = runSupervisor(dir, 'continue', ['--max-iterations', '3'])
    assert.equal(result.status, 0, result.stderr)
    assert.equal(readFileSync(state, 'utf8'), '2')
    assert.match(result.stdout, /"status":"CONTINUE"/)
    assert.match(result.stdout, /"status":"COMPLETE"/)
  } finally { rmSync(dir, { recursive: true, force: true }) }
})

test('supervisor retries recoverable BLOCKED but stops immediately on authorization blockers', () => {
  const recoverDir = mkdtempSync(join(runtimeRoot, 'supervisor-recover-'))
  const terminalDir = mkdtempSync(join(runtimeRoot, 'supervisor-terminal-'))
  try {
    const recovered = runSupervisor(recoverDir, 'recoverable', ['--max-iterations', '3', '--blocked-retries', '2'])
    assert.equal(recovered.result.status, 0, recovered.result.stderr)
    assert.equal(readFileSync(recovered.state, 'utf8'), '2')

    const terminal = runSupervisor(terminalDir, 'terminal', ['--max-iterations', '3', '--blocked-retries', '3'])
    assert.equal(terminal.result.status, 3, terminal.result.stderr)
    assert.equal(readFileSync(terminal.state, 'utf8'), '1')
    assert.match(terminal.result.stderr, /terminal_blocker/)
  } finally {
    rmSync(recoverDir, { recursive: true, force: true })
    rmSync(terminalDir, { recursive: true, force: true })
  }
})

test('authorized provider-only changes count as supervisor progress', () => {
  const dir = mkdtempSync(join(runtimeRoot, 'supervisor-multirepo-'))
  const provider = join(dir, 'provider')
  mkdirSync(provider, { recursive: true })
  execFileSync('git', ['init'], { cwd: provider, stdio: 'ignore' })
  execFileSync('git', ['config', 'user.email', 'supervisor@test.local'], { cwd: provider })
  execFileSync('git', ['config', 'user.name', 'Supervisor Test'], { cwd: provider })
  writeFileSync(join(provider, 'progress.txt'), 'base\n')
  execFileSync('git', ['add', 'progress.txt'], { cwd: provider })
  execFileSync('git', ['commit', '-m', 'base'], { cwd: provider, stdio: 'ignore' })
  const providerBranch = execFileSync('git', ['branch', '--show-current'], { cwd: provider, encoding: 'utf8' }).trim()
  const providerBaseSha = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: provider, encoding: 'utf8' }).trim()
  const previousProvider = process.env.FAKE_PROVIDER
  process.env.FAKE_PROVIDER = provider
  try {
    const { result, state } = runSupervisor(
      dir,
      'multi',
      ['--max-iterations', '4', '--max-stagnant', '1'],
      { authorized_repositories: [{ name: 'provider', path: provider, base_ref: 'HEAD', base_sha: providerBaseSha, working_branch: providerBranch, allowed_paths: ['progress.txt'], role: 'provider' }] },
    )
    assert.equal(result.status, 0, result.stderr)
    assert.equal(readFileSync(state, 'utf8'), '3')
  } finally {
    if (previousProvider === undefined) delete process.env.FAKE_PROVIDER
    else process.env.FAKE_PROVIDER = previousProvider
    rmSync(dir, { recursive: true, force: true })
  }
})

test('supervisor enforces isolated workspace-write and rejects approval bypass flags', () => {
  const defaultDir = mkdtempSync(join(runtimeRoot, 'supervisor-least-privilege-'))
  try {
    const normal = runSupervisor(defaultDir, 'redact', ['--max-iterations', '1'], { task_id: 'supervisor-least-privilege' })
    assert.equal(normal.result.status, 0, normal.result.stderr)
    const normalArgs = JSON.parse(readFileSync(normal.argvPath, 'utf8'))
    assert.equal(normalArgs.includes('--approve-for-me'), false)
    assert.ok(normalArgs.includes('workspace-write'))
    assert.ok(normalArgs.includes('--ignore-user-config'))
    assert.ok(normalArgs.includes('--ignore-rules'))
    assert.ok(normalArgs.includes('sandbox_workspace_write.network_access=false'))

    const denied = runSupervisor(defaultDir, 'redact', ['--max-iterations', '1', '--approve-for-me'], { task_id: 'supervisor-autoapprove-denied' })
    assert.notEqual(denied.result.status, 0)
    assert.match(denied.result.stderr, /Unknown argument: --approve-for-me/)

    const bypass = runSupervisor(defaultDir, 'redact', ['--max-iterations', '1', '--dangerously-bypass-approvals-and-sandbox'], { task_id: 'supervisor-bypass-denied' })
    assert.notEqual(bypass.result.status, 0)
    assert.match(bypass.result.stderr, /Unknown argument: --dangerously-bypass-approvals-and-sandbox/)
  } finally {
    rmSync(defaultDir, { recursive: true, force: true })
  }
})

test('supervisor rejects privileged production operations even when present in the contract', () => {
  const dir = mkdtempSync(join(runtimeRoot, 'supervisor-privileged-op-'))
  try {
    const attempt = runSupervisor(dir, 'redact', ['--max-iterations', '1'], {
      task_id: 'supervisor-privileged-op',
      authorized_operations: ['git.push_main', 'database.production_migrate'],
    })
    assert.notEqual(attempt.result.status, 0)
    assert.match(attempt.result.stderr, /privileged operations are not permitted in unattended agent:run/)
  } finally { rmSync(dir, { recursive: true, force: true }) }
})

test('supervisor rejects writable add-dir outside authorized_repositories', () => {
  const dir = mkdtempSync(join(runtimeRoot, 'supervisor-add-dir-'))
  const outside = mkdtempSync(join(runtimeRoot, 'supervisor-unrelated-'))
  try {
    const attempt = runSupervisor(dir, 'redact', ['--max-iterations', '1', '--add-dir', outside], { task_id: 'supervisor-add-dir' })
    assert.notEqual(attempt.result.status, 0)
    assert.match(attempt.result.stderr, /outside authorized_repositories/)
  } finally {
    rmSync(dir, { recursive: true, force: true })
    rmSync(outside, { recursive: true, force: true })
  }
})

test('supervisor rejects a primary branch mismatch before invoking Codex', () => {
  const dir = mkdtempSync(join(runtimeRoot, 'supervisor-primary-branch-'))
  try {
    const attempt = runSupervisor(dir, 'redact', ['--max-iterations', '1'], {
      task_id: 'supervisor-primary-branch',
      working_branch: 'definitely-not-the-current-branch',
    })
    assert.notEqual(attempt.result.status, 0)
    assert.match(attempt.result.stderr, /primary branch mismatch/)
    assert.equal(existsSync(attempt.state), false)
  } finally { rmSync(dir, { recursive: true, force: true }) }
})

test('supervisor hard-stops provider writes outside declared allowed_paths', () => {
  const dir = mkdtempSync(join(runtimeRoot, 'supervisor-provider-scope-'))
  const provider = join(dir, 'provider')
  mkdirSync(provider, { recursive: true })
  execFileSync('git', ['init'], { cwd: provider, stdio: 'ignore' })
  execFileSync('git', ['config', 'user.email', 'supervisor@test.local'], { cwd: provider })
  execFileSync('git', ['config', 'user.name', 'Supervisor Test'], { cwd: provider })
  writeFileSync(join(provider, 'progress.txt'), 'base\n')
  execFileSync('git', ['add', 'progress.txt'], { cwd: provider })
  execFileSync('git', ['commit', '-m', 'base'], { cwd: provider, stdio: 'ignore' })
  const providerBranch = execFileSync('git', ['branch', '--show-current'], { cwd: provider, encoding: 'utf8' }).trim()
  const providerBaseSha = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: provider, encoding: 'utf8' }).trim()
  const previousProvider = process.env.FAKE_PROVIDER
  process.env.FAKE_PROVIDER = provider
  try {
    const attempt = runSupervisor(
      dir,
      'multi-outside',
      ['--max-iterations', '2'],
      {
        task_id: 'supervisor-provider-scope',
        authorized_repositories: [{
          name: 'provider',
          path: provider,
          base_ref: 'HEAD',
          base_sha: providerBaseSha,
          working_branch: providerBranch,
          allowed_paths: ['progress.txt'],
          role: 'provider',
        }],
      },
    )
    assert.equal(attempt.result.status, 3, attempt.result.stderr)
    assert.match(attempt.result.stderr, /repository_boundary_violation/)
    assert.match(attempt.result.stderr, /outside\.txt/)
  } finally {
    if (previousProvider === undefined) delete process.env.FAKE_PROVIDER
    else process.env.FAKE_PROVIDER = previousProvider
    rmSync(dir, { recursive: true, force: true })
  }
})

test('supervisor rejects empty allowed_paths before invoking Codex', () => {
  const dir = mkdtempSync(join(runtimeRoot, 'supervisor-empty-scope-'))
  try {
    const attempt = runSupervisor(dir, 'redact', ['--max-iterations', '1'], {
      task_id: 'supervisor-empty-scope',
      allowed_paths: [],
    })
    assert.notEqual(attempt.result.status, 0)
    assert.match(attempt.result.stderr, /allowed_paths/)
    assert.equal(existsSync(attempt.state), false)
  } finally { rmSync(dir, { recursive: true, force: true }) }
})

test('supervisor rejects protected production branches before invoking Codex', () => {
  for (const protectedBranch of ['main']) {
    const dir = mkdtempSync(join(runtimeRoot, 'supervisor-protected-branch-'))
    try {
      const attempt = runSupervisor(dir, 'redact', ['--max-iterations', '1'], {
        task_id: `supervisor-protected-${protectedBranch}`,
        working_branch: protectedBranch,
      }, { allowProtectedBranch: false })
      assert.notEqual(attempt.result.status, 0)
      assert.match(attempt.result.stderr, /protected branch/)
      assert.equal(existsSync(attempt.state), false)
    } finally { rmSync(dir, { recursive: true, force: true }) }
  }
})

test('supervisor evaluates completion in-process instead of executing mutable workspace gate code', () => {
  const source = readFileSync('scripts/ai/autonomous-run.mjs', 'utf8')
  assert.match(source, /completionResult\(contract, report\)/)
  assert.doesNotMatch(source, /completion-gate\.mjs/)
})

test('supervisor redacts common secrets from persisted raw logs', () => {
  const dir = mkdtempSync(join(runtimeRoot, 'supervisor-redaction-'))
  const taskId = 'supervisor-redaction'
  try {
    const run = runSupervisor(dir, 'redact', ['--max-iterations', '1'], { task_id: taskId })
    assert.equal(run.result.status, 0, run.result.stderr)
    const persisted = join(runtimeRoot, taskId, 'supervisor')
    const stdout = readFileSync(join(persisted, 'iteration-01.stdout.jsonl'), 'utf8')
    const stderr = readFileSync(join(persisted, 'iteration-01.stderr.log'), 'utf8')
    assert.doesNotMatch(stdout, /super-secret-value|json-secret-value|session-secret-value|bearer-secret-value|csrf-secret-value|jwt-secret-value|json-cookie-secret/)
    assert.doesNotMatch(stderr, /secret-bearer-value|secret-cookie-value|stderr-session-secret|stderr-cookie-secret|stderr-jwt-secret/)
    assert.match(stdout, /TOKEN=\[REDACTED\]/)
    assert.match(stdout, /\\"access_token\\":\\"\[REDACTED\]\\"/)
    assert.match(stderr, /Authorization: Bearer \[REDACTED\]/)
    assert.match(stderr, /Cookie: \[REDACTED\]/)
  } finally {
    rmSync(dir, { recursive: true, force: true })
    rmSync(join(runtimeRoot, taskId), { recursive: true, force: true })
  }
})

test('supervisor revalidates boundaries before every Codex turn', () => {
  const source = readFileSync('scripts/ai/autonomous-run.mjs', 'utf8')
  assert.match(source, /assertAllBoundaries\(\)[\s\S]*?const result = run\(codexBin/)
  assert.match(source, /const result = run\(codexBin[\s\S]*?assertAllBoundaries\(\)/)
})
