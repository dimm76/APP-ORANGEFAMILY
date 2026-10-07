import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { basename, dirname, join, resolve } from 'node:path'
import { spawnSync } from 'node:child_process'

function parseArgs(argv) {
  const args = {}
  for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index]
    const next = () => argv[++index]
    if (value === '--prompt-file') args.promptFile = next()
    else if (value === '--contract') args.contract = next()
    else if (value === '--prepare-only') args.prepareOnly = true
    else throw new Error(`Unknown argument: ${value}`)
  }
  return args
}

function run(command, args, cwd, stdio = 'pipe') {
  return spawnSync(command, args, {
    cwd,
    encoding: stdio === 'pipe' ? 'utf8' : undefined,
    stdio,
    shell: false,
    env: process.env,
    maxBuffer: 64 * 1024 * 1024,
  })
}

function git(cwd, args, allowFailure = false) {
  const result = run('git', args, cwd)
  if (!allowFailure && result.status !== 0) {
    throw new Error(`git ${args.join(' ')} failed in ${cwd}: ${String(result.stderr || '').trim()}`)
  }
  return result
}

function fail(reason, evidence, exitCode = 3) {
  console.error(JSON.stringify({ status: 'HARD_STOP', reason, evidence }))
  process.exit(exitCode)
}

function readJson(path) {
  try {
    return JSON.parse(readFileSync(path, 'utf8').replace(/^\uFEFF/, ''))
  } catch (error) {
    throw new Error(`Invalid JSON ${path}: ${error.message}`)
  }
}

function assertTaskId(value) {
  if (typeof value !== 'string' || !/^[a-z0-9][a-z0-9-]*$/.test(value)) {
    throw new Error('task_id must be kebab-case')
  }
}

function assertSha(value, label) {
  if (typeof value !== 'string' || !/^[0-9a-f]{40}$/.test(value)) {
    throw new Error(`${label} must be a 40-character lowercase SHA`)
  }
}

function assertRepoRoot(path, label) {
  if (!existsSync(path)) throw new Error(`${label} source repository does not exist: ${path}`)
  const actual = resolve(String(git(path, ['rev-parse', '--show-toplevel']).stdout).trim())
  if (actual !== resolve(path)) throw new Error(`${label} is not a Git root: ${path}`)
}

function assertCleanTracked(path, label) {
  const status = String(git(path, ['status', '--porcelain=v1', '--untracked-files=no']).stdout).trim()
  if (status) throw new Error(`${label} has tracked changes; refusing autonomous bootstrap`)
}

function assertSourceState({ sourceRoot, baseRef, baseSha, workingBranch, target, label, taskId }) {
  assertRepoRoot(sourceRoot, label)
  assertSha(baseSha, `${label}.base_sha`)

  if (workingBranch !== `agent/${taskId}`) {
    throw new Error(`${label}.working_branch must be agent/${taskId}`)
  }

  const currentBranch = String(git(sourceRoot, ['branch', '--show-current']).stdout).trim()
  if (!currentBranch) throw new Error(`${label} source checkout must be on a named branch`)
  if (currentBranch !== baseRef) {
    throw new Error(`${label}.base_ref must match the current source branch (${currentBranch})`)
  }
  const head = String(git(sourceRoot, ['rev-parse', 'HEAD']).stdout).trim()
  if (head !== baseSha) throw new Error(`${label}.base_sha does not match source HEAD`)

  const resolvedBase = String(git(sourceRoot, ['rev-parse', '--verify', `${baseRef}^{commit}`]).stdout).trim()
  if (resolvedBase !== baseSha) throw new Error(`${label}.base_ref moved from base_sha`)

  assertCleanTracked(sourceRoot, label)

  const expectedTarget = resolve(dirname(sourceRoot), `${basename(sourceRoot)}-agent-${taskId}`)
  if (resolve(target) !== expectedTarget) throw new Error(`${label} target must be ${expectedTarget}`)
  if (existsSync(target)) throw new Error(`${label} target already exists: ${target}`)

  const branchExists = git(sourceRoot, ['show-ref', '--verify', '--quiet', `refs/heads/${workingBranch}`], true)
  if (branchExists.status === 0) throw new Error(`${label} branch already exists: ${workingBranch}`)
}

const args = parseArgs(process.argv.slice(2))
if (!args.promptFile || !args.contract) {
  fail('invalid_bootstrap_arguments', 'Usage: node .codex/autonomous-bootstrap.mjs --prompt-file <file> --contract <file>', 2)
}
if (args.prepareOnly && !(process.env.NODE_ENV === 'test' && process.env.AUTONOMOUS_BOOTSTRAP_TEST_MODE === '1')) {
  fail('prepare_only_not_allowed', '--prepare-only is restricted to deterministic test mode', 2)
}

const root = resolve(process.cwd())
let contract
let created = []

try {
  assertRepoRoot(root, 'primary repository')
  contract = readJson(resolve(root, args.contract))
  assertTaskId(contract.task_id)

  if (!Array.isArray(contract.allowed_paths) || contract.allowed_paths.length === 0) {
    throw new Error('allowed_paths must contain at least one path')
  }
  if (!Array.isArray(contract.acceptance_criteria) || contract.acceptance_criteria.length === 0) {
    throw new Error('acceptance_criteria must contain at least one criterion')
  }
  if (Array.isArray(contract.authorized_repositories) && contract.authorized_repositories.length > 0) {
    throw new Error('automatic autonomous bootstrap is single-repository; additional repositories require explicit multi-repository setup')
  }

  const draftRoot = resolve(root, '.codex', 'runtime', contract.task_id)
  const promptPath = resolve(root, args.promptFile)
  const contractPath = resolve(root, args.contract)
  if (promptPath !== join(draftRoot, 'prompt.md') || contractPath !== join(draftRoot, 'task-contract.json')) {
    throw new Error(`bootstrap inputs must be .codex/runtime/${contract.task_id}/prompt.md and task-contract.json`)
  }
  if (!existsSync(promptPath)) throw new Error(`prompt file not found: ${promptPath}`)

  const primaryTarget = resolve(dirname(root), `${basename(root)}-agent-${contract.task_id}`)
  const entry = {
    label: 'primary repository',
    sourceRoot: root,
    target: primaryTarget,
    baseRef: contract.base_ref,
    baseSha: contract.base_sha,
    workingBranch: contract.working_branch,
  }

  assertSourceState({ ...entry, taskId: contract.task_id })

  const worktree = git(root, ['worktree', 'add', primaryTarget, '-b', contract.working_branch, contract.base_sha], true)
  if (worktree.status !== 0) {
    throw new Error(`failed to create primary repository worktree: ${String(worktree.stderr || '').trim()}`)
  }
  created.push(entry)

  const targetRuntime = join(primaryTarget, '.codex', 'runtime', contract.task_id)
  mkdirSync(targetRuntime, { recursive: true })
  const targetPrompt = join(targetRuntime, 'prompt.md')
  const targetContract = join(targetRuntime, 'task-contract.json')
  const targetReport = join(targetRuntime, 'completion-report.json')

  const prompt = readFileSync(promptPath, 'utf8').replace(/^\uFEFF/, '')
  writeFileSync(targetPrompt, prompt, 'utf8')
  writeFileSync(targetContract, `${JSON.stringify(contract, null, 2)}\n`, 'utf8')

  const prepared = {
    status: 'PREPARED',
    task_id: contract.task_id,
    worktree: primaryTarget,
    working_branch: contract.working_branch,
    contract: targetContract,
    prompt: targetPrompt,
    completion_report: targetReport,
  }
  console.log(JSON.stringify(prepared))

  if (args.prepareOnly) process.exit(0)

  const supervisor = join(primaryTarget, 'scripts', 'ai', 'autonomous-run.mjs')
  if (!existsSync(supervisor)) throw new Error(`supervisor not found in prepared worktree: ${supervisor}`)

  const result = run(process.execPath, [
    supervisor,
    '--prompt-file', targetPrompt,
    '--contract', targetContract,
    '--completion-report', targetReport,
  ], primaryTarget, 'inherit')

  const status = Number.isInteger(result.status) ? result.status : 1
  console.log(JSON.stringify({
    status: status === 0 ? 'COMPLETE' : 'TERMINAL',
    task_id: contract.task_id,
    worktree: primaryTarget,
    working_branch: contract.working_branch,
    supervisor_exit: status,
  }))
  process.exit(status)
} catch (error) {
  for (const entry of created.reverse()) {
    git(entry.sourceRoot, ['worktree', 'remove', '--force', entry.target], true)
    git(entry.sourceRoot, ['branch', '-D', entry.workingBranch], true)
    if (existsSync(entry.target)) rmSync(entry.target, { recursive: true, force: true })
  }
  fail('autonomous_bootstrap_failed', error.message)
}
