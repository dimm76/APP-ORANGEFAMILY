import assert from 'node:assert/strict'
import test from 'node:test'
import { execFileSync, spawnSync } from 'node:child_process'
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { tmpdir } from 'node:os'

const bootstrap = resolve('.codex/autonomous-bootstrap.mjs')

function git(cwd, args, options = {}) {
  return execFileSync('git', args, { cwd, encoding: 'utf8', ...options }).trim()
}

function initRepo(prefix) {
  const root = mkdtempSync(join(tmpdir(), prefix))
  git(root, ['init'])
  git(root, ['config', 'user.email', 'bootstrap@test.local'])
  git(root, ['config', 'user.name', 'Bootstrap Test'])
  writeFileSync(join(root, 'seed.txt'), 'base\n')
  git(root, ['add', 'seed.txt'])
  git(root, ['commit', '-m', 'base'])
  git(root, ['branch', '-M', 'main'])
  return root
}

function writeInputs(root, taskId, extra = {}) {
  const runtime = join(root, '.agent-runtime', taskId)
  mkdirSync(runtime, { recursive: true })
  const prompt = join(runtime, 'prompt.md')
  const contract = join(runtime, 'task-contract.json')
  const baseSha = git(root, ['rev-parse', 'HEAD'])
  writeFileSync(prompt, 'Verify the deterministic bootstrap fixture.\n')
  writeFileSync(contract, JSON.stringify({
    task_id: taskId,
    objective: 'Verify deterministic bootstrap fixture',
    base_ref: 'main',
    base_sha: baseSha,
    working_branch: `agent/${taskId}`,
    allowed_paths: ['seed.txt'],
    acceptance_criteria: [{ id: 'fixture', description: 'Fixture reaches prepared state' }],
    out_of_scope: [],
    required_checks: [],
    hard_stop_conditions: [],
    state: 'AUTO_CONTINUE',
    ...extra,
  }, null, 2))
  return { prompt, contract, baseSha }
}

function targetFor(root, taskId) {
  return resolve(root, '.agent-worktrees', taskId)
}

function runPrepare(root, prompt, contract) {
  return spawnSync(process.execPath, [
    bootstrap,
    '--prompt-file', prompt,
    '--contract', contract,
    '--prepare-only',
  ], {
    cwd: root,
    encoding: 'utf8',
    env: {
      ...process.env,
      NODE_ENV: 'test',
      AUTONOMOUS_BOOTSTRAP_TEST_MODE: '1',
    },
  })
}

function cleanup(root, taskId) {
  const target = targetFor(root, taskId)
  if (existsSync(root)) {
    spawnSync('git', ['worktree', 'remove', '--force', target], { cwd: root, stdio: 'ignore' })
    spawnSync('git', ['branch', '-D', `agent/${taskId}`], { cwd: root, stdio: 'ignore' })
  }
  rmSync(target, { recursive: true, force: true })
  rmSync(root, { recursive: true, force: true })
}

test('protected bootstrap creates deterministic isolated worktree', () => {
  const taskId = 'bootstrap-fixture'
  const root = initRepo('autonomous-bootstrap-')
  const target = targetFor(root, taskId)
  try {
    const { prompt, contract, baseSha } = writeInputs(root, taskId)
    const result = runPrepare(root, prompt, contract)
    assert.equal(result.status, 0, result.stderr)
    assert.equal(existsSync(target), true)
    assert.equal(target.startsWith(resolve(root, '.agent-worktrees')), true)
    assert.equal(git(target, ['branch', '--show-current']), `agent/${taskId}`)
    assert.equal(git(target, ['rev-parse', 'HEAD']), baseSha)
    assert.equal(readFileSync(join(target, '.agent-runtime', taskId, 'prompt.md'), 'utf8'), readFileSync(prompt, 'utf8'))
    assert.deepEqual(
      JSON.parse(readFileSync(join(target, '.agent-runtime', taskId, 'task-contract.json'), 'utf8')),
      JSON.parse(readFileSync(contract, 'utf8')),
    )
    assert.match(result.stdout, /"status":"PREPARED"/)
  } finally {
    cleanup(root, taskId)
  }
})

test('protected bootstrap accepts Windows UTF-8 BOM and normalizes runtime files', () => {
  const taskId = 'bootstrap-bom'
  const root = initRepo('autonomous-bootstrap-bom-')
  const target = targetFor(root, taskId)
  try {
    const { prompt, contract } = writeInputs(root, taskId)
    writeFileSync(prompt, `\uFEFF${readFileSync(prompt, 'utf8')}`, 'utf8')
    writeFileSync(contract, `\uFEFF${readFileSync(contract, 'utf8')}`, 'utf8')
    const result = runPrepare(root, prompt, contract)
    assert.equal(result.status, 0, result.stderr)
    const targetPrompt = readFileSync(join(target, '.agent-runtime', taskId, 'prompt.md'), 'utf8')
    const targetContract = readFileSync(join(target, '.agent-runtime', taskId, 'task-contract.json'), 'utf8')
    assert.equal(targetPrompt.startsWith('\uFEFF'), false)
    assert.equal(targetContract.startsWith('\uFEFF'), false)
    assert.doesNotThrow(() => JSON.parse(targetContract))
  } finally {
    cleanup(root, taskId)
  }
})

test('protected bootstrap rejects tracked dirty source before creating worktree', () => {
  const taskId = 'bootstrap-dirty'
  const root = initRepo('autonomous-bootstrap-dirty-')
  const target = targetFor(root, taskId)
  try {
    const { prompt, contract } = writeInputs(root, taskId)
    writeFileSync(join(root, 'seed.txt'), 'dirty\n')
    const result = runPrepare(root, prompt, contract)
    assert.equal(result.status, 3)
    assert.match(result.stderr, /tracked changes/)
    assert.equal(existsSync(target), false)
    assert.notEqual(git(root, ['branch', '--list', `agent/${taskId}`]), `agent/${taskId}`)
  } finally {
    cleanup(root, taskId)
  }
})

test('protected automatic bootstrap refuses additional repository capability', () => {
  const taskId = 'bootstrap-multirepo'
  const root = initRepo('autonomous-bootstrap-multirepo-')
  const target = targetFor(root, taskId)
  try {
    const { prompt, contract } = writeInputs(root, taskId, {
      authorized_repositories: [{
        name: 'other',
        path: join(dirname(root), `other-agent-${taskId}`),
        base_ref: 'main',
        base_sha: '0'.repeat(40),
        working_branch: `agent/${taskId}`,
        allowed_paths: ['**'],
        role: 'supporting',
      }],
    })
    const result = runPrepare(root, prompt, contract)
    assert.equal(result.status, 3)
    assert.match(result.stderr, /single-repository/)
    assert.equal(existsSync(target), false)
  } finally {
    cleanup(root, taskId)
  }
})


test('protected bootstrap rejects source branch/base mismatch', () => {
  const taskId = 'bootstrap-branch-mismatch'
  const root = initRepo('autonomous-bootstrap-branch-')
  const target = targetFor(root, taskId)
  try {
    const { prompt, contract } = writeInputs(root, taskId, { base_ref: 'other-branch' })
    git(root, ['branch', 'other-branch'])
    const result = runPrepare(root, prompt, contract)
    assert.equal(result.status, 3)
    assert.match(result.stderr, /base_ref must match the current source branch/)
    assert.equal(existsSync(target), false)
  } finally {
    cleanup(root, taskId)
  }
})
