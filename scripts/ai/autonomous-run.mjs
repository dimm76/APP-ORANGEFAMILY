import { createHash } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { spawnSync } from 'node:child_process'
import { completionResult, inAllowedPaths } from './harness-lib.mjs'

const HARD_STOP_BLOCKER_CATEGORIES = new Set([
  'human_decision',
  'missing_authorization',
  'destructive_risk',
  'security_risk',
  'git_conflict',
])

const FORBIDDEN_AUTONOMOUS_OPERATION = /^(?:git\.push_main|git\.(?:force|destructive)|deploy(?:\.|$)|release(?:\.|$)|tag(?:\.|$)|vps(?:\.|$)|database\.(?:production|write|migrate))/
const PROTECTED_BRANCHES = new Set(['main'])
const TEST_ALLOW_PROTECTED_BRANCH = process.env.NODE_ENV === 'test'
  && process.env.AUTONOMOUS_RUN_TEST_MODE === '1'
  && process.env.AUTONOMOUS_RUN_TEST_ALLOW_PROTECTED_BRANCH === '1'
const SENSITIVE_KEY = /^(?:access[_-]?token|refresh[_-]?token|auth[_-]?token|session[_-]?token|bearer[_-]?token|csrf[_-]?token|jwt|password|passwd|secret|api[_-]?key|private[_-]?key|client[_-]?secret|database[_-]?url|authorization|cookie|set-cookie)$/i

function parseArgs(argv) {
  const args = {
    addDirs: [],
    maxIterations: 40,
    blockedRetries: 3,
    maxStagnant: 4,
    maxMinutes: 480,
  }
  for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index]
    const next = () => argv[++index]
    if (value === '--prompt-file') args.promptFile = next()
    else if (value === '--contract') args.contract = next()
    else if (value === '--completion-report') args.completionReport = next()
    else if (value === '--add-dir') args.addDirs.push(next())
    else if (value === '--max-iterations') args.maxIterations = Number(next())
    else if (value === '--blocked-retries') args.blockedRetries = Number(next())
    else if (value === '--max-stagnant') args.maxStagnant = Number(next())
    else if (value === '--max-minutes') args.maxMinutes = Number(next())
    else if (value === '--model') args.model = next()
    else if (value === '--help' || value === '-h') args.help = true
    else throw new Error(`Unknown argument: ${value}`)
  }
  return args
}

function usage() {
  return [
    'Usage:',
    '  node scripts/ai/autonomous-run.mjs --prompt-file <file> --contract <file> --completion-report <file> [options]',
    '',
    'Options:',
    '  --add-dir <dir>           Additional writable repo already declared in authorized_repositories; repeatable',
    '  --max-iterations <n>      Maximum Codex turns (default: 40)',
    '  --blocked-retries <n>     Recovery turns for recoverable BLOCKED states (default: 3)',
    '  --max-stagnant <n>        Stop after repeated no-progress turns (default: 4)',
    '  --max-minutes <n>         Supervisor wall-clock safety limit (default: 480 / 8h)',
    '  --model <name>             Optional Codex model override',
  ].join('\n')
}

function assertPositiveInteger(value, name, allowZero = false) {
  if (!Number.isInteger(value) || value < (allowZero ? 0 : 1)) {
    throw new Error(`${name} must be an integer >= ${allowZero ? 0 : 1}`)
  }
}

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: options.cwd,
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
    timeout: options.timeoutMs,
  })
  return {
    status: Number.isInteger(result.status) ? result.status : 1,
    stdout: result.stdout || '',
    stderr: result.stderr || '',
    error: result.error || null,
    timedOut: result.error?.code === 'ETIMEDOUT',
  }
}

function findThreadId(jsonl) {
  const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
  const keys = new Set(['thread_id', 'threadId', 'session_id', 'sessionId'])
  const search = value => {
    if (!value || typeof value !== 'object') return null
    for (const [key, item] of Object.entries(value)) {
      if (keys.has(key) && typeof item === 'string' && uuid.test(item)) return item
      const nested = search(item)
      if (nested) return nested
    }
    return null
  }
  for (const line of jsonl.split(/\r?\n/)) {
    if (!line.trim()) continue
    try {
      const id = search(JSON.parse(line))
      if (id) return id
    } catch {
      // Ignore non-JSON diagnostic output.
    }
  }
  return null
}

function readJson(path) {
  if (!existsSync(path)) return null
  try { return JSON.parse(readFileSync(path, 'utf8')) } catch { return null }
}

function redactPlainText(value) {
  return String(value ?? '')
    .replace(/("(?:access[_-]?token|refresh[_-]?token|auth[_-]?token|session[_-]?token|bearer[_-]?token|csrf[_-]?token|jwt|password|passwd|secret|api[_-]?key|private[_-]?key|client[_-]?secret|database[_-]?url|authorization|cookie|set-cookie)"\s*:\s*")([^"]+)(")/gi, '$1[REDACTED]$3')
    .replace(/(\\"(?:access[_-]?token|refresh[_-]?token|auth[_-]?token|session[_-]?token|bearer[_-]?token|csrf[_-]?token|jwt|password|passwd|secret|api[_-]?key|private[_-]?key|client[_-]?secret|database[_-]?url|authorization|cookie|set-cookie)\\"\s*:\s*\\")([^"\\]+)(\\")/gi, '$1[REDACTED]$3')
    .replace(/((?:DATABASE_URL|PASSWORD|PASS(?:WORD)?|ACCESS[_-]?TOKEN|REFRESH[_-]?TOKEN|AUTH[_-]?TOKEN|SESSION[_-]?TOKEN|BEARER[_-]?TOKEN|CSRF[_-]?TOKEN|JWT|TOKEN|SECRET|API[_-]?KEY|PRIVATE[_-]?KEY|CLIENT[_-]?SECRET)\s*[=:]\s*)([^\s"']+)/gi, '$1[REDACTED]')
    .replace(/(Authorization\s*:\s*(?:Bearer|Basic)\s+)([^\s"']+)/gi, '$1[REDACTED]')
    .replace(/((?:Set-Cookie|Cookie)\s*:\s*)([^\r\n]+)/gi, '$1[REDACTED]')
    .replace(/([a-z][a-z0-9+.-]*:\/\/)([^\s/@:]+):([^\s/@]+)@/gi, '$1[REDACTED]@')
}

function redactStructured(value, key = '') {
  if (SENSITIVE_KEY.test(key)) return '[REDACTED]'
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value)
      if (parsed && typeof parsed === 'object') return JSON.stringify(redactStructured(parsed))
    } catch {}
    return redactPlainText(value)
  }
  if (Array.isArray(value)) return value.map(item => redactStructured(item))
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([childKey, childValue]) => [childKey, redactStructured(childValue, childKey)]))
  }
  return value
}

function redactLog(value) {
  const source = String(value ?? '')
  const trailingNewline = /\r?\n$/.test(source)
  const lines = source.split(/\r?\n/)
  const redacted = lines.map(line => {
    if (!line.trim()) return line
    try {
      return JSON.stringify(redactStructured(JSON.parse(line)))
    } catch {
      return redactPlainText(line)
    }
  }).join('\n')
  return trailingNewline && !redacted.endsWith('\n') ? `${redacted}\n` : redacted
}

function gate(contract, reportPath) {
  if (!existsSync(reportPath)) return { status: 'CONTINUE', reason: 'missing_completion_report', exitCode: 4 }
  const report = readJson(reportPath)
  if (!report) return { status: 'CONTINUE', reason: 'invalid_completion_report', exitCode: 4 }
  const result = completionResult(contract, report)
  if (result.status === 'COMPLETE') return { status: 'COMPLETE', reason: result.reason || 'complete', exitCode: 0 }
  if (result.status === 'BLOCKED') return { status: 'BLOCKED', reason: result.reason || 'documented_blocked', exitCode: 3 }
  return { status: 'CONTINUE', reason: result.reason || 'completion_gate_failed', exitCode: 4 }
}

function outstandingSummary(contract, report) {
  if (!contract || !Array.isArray(contract.acceptance_criteria)) return ''
  const actual = new Map((report?.acceptance_criteria || []).map(item => [item?.id, item]))
  const pending = contract.acceptance_criteria.filter(criterion => {
    const item = actual.get(criterion.id)
    return !(item?.satisfied === true && item.evidence?.length > 0)
  })
  return pending.length
    ? `Outstanding acceptance criteria:\n- ${pending.map(item => `${item.id}: ${item.description}`).join('\n- ')}`
    : ''
}

function collectBlockers(report) {
  return (report?.blockers || [])
    .filter(blocker => blocker?.resolved !== true)
    .map(blocker => ({ scope: blocker.category || 'task', ...blocker }))
}

function hardStopBlockers(report) {
  return collectBlockers(report).filter(blocker => HARD_STOP_BLOCKER_CATEGORIES.has(blocker.category))
}

function assertNonEmptyString(value, label) {
  if (typeof value !== 'string' || !value.trim()) throw new Error(`invalid task contract: ${label} must be a non-empty string`)
}

function assertStringArray(value, label, { minItems = 0 } = {}) {
  if (!Array.isArray(value) || value.length < minItems || value.some(item => typeof item !== 'string' || !item.trim())) {
    throw new Error(`invalid task contract: ${label} must be an array of non-empty strings${minItems ? ` with at least ${minItems} item(s)` : ''}`)
  }
}

function assertWritableBranch(branch, label) {
  if (PROTECTED_BRANCHES.has(branch) && !TEST_ALLOW_PROTECTED_BRANCH) {
    throw new Error(`${label} uses protected branch ${branch}; unattended agent:run requires a feature/fix branch`)
  }
}

function validateContractShape(contract) {
  if (!contract || typeof contract !== 'object' || Array.isArray(contract)) throw new Error('invalid task contract: expected object')
  if (!/^[a-z0-9][a-z0-9-]*$/.test(contract.task_id || '')) throw new Error('invalid task contract: task_id')
  for (const field of ['objective', 'base_ref', 'working_branch']) assertNonEmptyString(contract[field], field)
  if (!/^[0-9a-f]{40}$/.test(contract.base_sha || '')) throw new Error('invalid task contract: base_sha must be a 40-character lowercase SHA')
  assertWritableBranch(contract.working_branch, 'primary repository')
  assertStringArray(contract.allowed_paths, 'allowed_paths', { minItems: 1 })
  if (!Array.isArray(contract.acceptance_criteria) || contract.acceptance_criteria.length === 0) {
    throw new Error('invalid task contract: acceptance_criteria must contain at least one criterion')
  }
  for (const [index, criterion] of contract.acceptance_criteria.entries()) {
    if (!criterion || typeof criterion !== 'object') throw new Error(`invalid task contract: acceptance_criteria[${index}]`)
    assertNonEmptyString(criterion.id, `acceptance_criteria[${index}].id`)
    assertNonEmptyString(criterion.description, `acceptance_criteria[${index}].description`)
  }
  for (const field of ['out_of_scope', 'change_types', 'required_checks']) assertStringArray(contract[field], field)
  if (contract.authorized_operations !== undefined) assertStringArray(contract.authorized_operations, 'authorized_operations')
  if (contract.authorized_repositories !== undefined && !Array.isArray(contract.authorized_repositories)) {
    throw new Error('invalid task contract: authorized_repositories must be an array')
  }
  const names = new Set()
  const paths = new Set()
  for (const [index, repo] of (contract.authorized_repositories || []).entries()) {
    if (!repo || typeof repo !== 'object' || Array.isArray(repo)) throw new Error(`invalid task contract: authorized_repositories[${index}]`)
    for (const field of ['name', 'path', 'base_ref', 'working_branch']) assertNonEmptyString(repo[field], `authorized_repositories[${index}].${field}`)
    if (!/^[0-9a-f]{40}$/.test(repo.base_sha || '')) throw new Error(`invalid task contract: authorized_repositories[${index}].base_sha`)
    assertWritableBranch(repo.working_branch, `authorized repository ${repo.name}`)
    assertStringArray(repo.allowed_paths, `authorized_repositories[${index}].allowed_paths`, { minItems: 1 })
    if (names.has(repo.name)) throw new Error(`invalid task contract: duplicate authorized repository name ${repo.name}`)
    if (paths.has(repo.path)) throw new Error(`invalid task contract: duplicate authorized repository path ${repo.path}`)
    names.add(repo.name)
    paths.add(repo.path)
  }
}

function resolveAuthorizedRepositories(contract, cwd) {
  const repositories = []
  for (const repo of contract?.authorized_repositories || []) {
    if (!repo?.path) continue
    const path = resolve(cwd, repo.path)
    if (!existsSync(path)) throw new Error(`authorized repository path not found: ${path}`)
    const top = run('git', ['rev-parse', '--show-toplevel'], { cwd: path })
    if (top.status !== 0 || resolve(top.stdout.trim()) !== path) {
      throw new Error(`authorized repository path is not a git root: ${path}`)
    }
    const base = run('git', ['rev-parse', '--verify', `${repo.base_ref}^{commit}`], { cwd: path })
    if (base.status !== 0) throw new Error(`authorized repository base_ref not found in ${path}: ${repo.base_ref}`)
    if (base.stdout.trim() !== repo.base_sha) {
      throw new Error(`authorized repository base_ref moved in ${path}: ${repo.base_ref}`)
    }
    const branch = run('git', ['branch', '--show-current'], { cwd: path }).stdout.trim()
    assertWritableBranch(branch, `authorized repository ${repo.name}`)
    if (branch !== repo.working_branch) {
      throw new Error(`authorized repository branch mismatch in ${path}: expected ${repo.working_branch}, got ${branch || '(detached)'}`)
    }
    repositories.push({ ...repo, path })
  }
  return repositories
}

function gitLines(root, args) {
  const result = run('git', args, { cwd: root })
  if (result.status !== 0) throw new Error(`git ${args.join(' ')} failed in ${root}: ${result.stderr.trim()}`)
  return result.stdout.trim().split(/\r?\n/).filter(Boolean)
}

function changedFilesForRepo(root, baseRef) {
  const committed = gitLines(root, ['diff', '--name-only', `${baseRef}...HEAD`])
  const staged = gitLines(root, ['diff', '--cached', '--name-only'])
  const unstaged = gitLines(root, ['diff', '--name-only'])
  const untracked = gitLines(root, ['status', '--porcelain=v1', '--untracked-files=all'])
    .filter(line => line.startsWith('?? '))
    .map(line => line.slice(3))
  return [...new Set([...committed, ...staged, ...unstaged, ...untracked])]
}

function assertRepoScope(root, baseRef, allowedPaths, label) {
  if (!Array.isArray(allowedPaths) || allowedPaths.length === 0) throw new Error(`${label} has no allowed_paths; refusing unattended writes`)
  const unexpected = changedFilesForRepo(root, baseRef).filter(file => !inAllowedPaths(file, allowedPaths))
  if (unexpected.length) {
    throw new Error(`${label} has out-of-scope changes: ${unexpected.join(', ')}`)
  }
}

function validatePrimaryRepository(cwd, contract) {
  const top = run('git', ['rev-parse', '--show-toplevel'], { cwd })
  if (top.status !== 0 || resolve(top.stdout.trim()) !== cwd) throw new Error(`supervisor cwd is not the primary git root: ${cwd}`)
  const base = run('git', ['rev-parse', '--verify', `${contract.base_ref}^{commit}`], { cwd })
  if (base.status !== 0) throw new Error(`primary base_ref not found: ${contract.base_ref}`)
  if (base.stdout.trim() !== contract.base_sha) throw new Error(`primary base_ref moved: ${contract.base_ref}`)
  const branch = run('git', ['branch', '--show-current'], { cwd }).stdout.trim()
  assertWritableBranch(branch, 'primary repository')
  if (branch !== contract.working_branch) {
    throw new Error(`primary branch mismatch: expected ${contract.working_branch}, got ${branch || '(detached)'}`)
  }
  assertRepoScope(cwd, contract.base_ref, contract.allowed_paths, 'primary repository')
}

function validateAutonomousOperations(contract) {
  const forbidden = (contract.authorized_operations || []).filter(operation => FORBIDDEN_AUTONOMOUS_OPERATION.test(operation))
  if (forbidden.length) {
    throw new Error(`privileged operations are not permitted in unattended agent:run: ${forbidden.join(', ')}`)
  }
}

function gitState(root) {
  const top = run('git', ['rev-parse', '--show-toplevel'], { cwd: root })
  if (top.status !== 0) return `PATH ${root}\nNOT_GIT_REPOSITORY`
  const branch = run('git', ['branch', '--show-current'], { cwd: root }).stdout.trim()
  const head = run('git', ['rev-parse', 'HEAD'], { cwd: root }).stdout.trim()
  const status = run('git', ['status', '--porcelain=v1', '--untracked-files=all'], { cwd: root }).stdout
  const diff = run('git', ['diff', '--no-ext-diff', '--binary'], { cwd: root }).stdout
  const staged = run('git', ['diff', '--cached', '--no-ext-diff', '--binary'], { cwd: root }).stdout
  return [`PATH ${root}`, `BRANCH ${branch}`, `HEAD ${head}`, status, diff, staged].join('\n')
}

function stateFingerprint(repoRoots, reportPath, gateState) {
  const repositories = repoRoots.map(gitState).join('\n===== REPOSITORY =====\n')
  const report = existsSync(reportPath) ? readFileSync(reportPath, 'utf8') : ''
  return createHash('sha256')
    .update([repositories, report, gateState.status, gateState.reason].join('\n---\n'))
    .digest('hex')
}

function recoveryGuidance({ contract, report, gateState }) {
  const blockers = collectBlockers(report)
  const categories = new Set(blockers.map(item => item.category))
  const runtimeRestartAuthorized = (contract?.authorized_operations || []).includes('runtime.restart_local')
  const localTestAuthAuthorized = (contract?.authorized_operations || []).includes('local.test_auth_write')
  const guidance = [
    'RECOVERY PLAYBOOK — apply only what is relevant:',
    '- Pending QA, an ordinary feature bug, a failing affected test/build/lint, or work not yet executed is CONTINUE/AUTO_FIX, not a terminal BLOCKED.',
    '- Before claiming missing credentials/access/tooling, inspect project scripts/docs/helpers and configuration key presence without exposing secrets, then perform a safe capability probe when possible.',
    '- Treat failures already present on the declared base as baseline. Use delta/targeted checks; do not make hundreds of unrelated global lint errors a task blocker.',
    '- For authorized multi-repo tasks, continue across provider/consumer repos. A repo boundary is not a blocker when declared in authorized_repositories.',
    '- Intermediate distribution/install guards may fail while provider work is intentionally uncommitted or not yet recorded. Finish the canonical provider -> consumer workflow, then evaluate the final gate.',
    '- After provider sync or hot module replacement, reproduce surprising React/browser runtime errors in a clean browser/runtime before attributing them to code.',
    '- If Playwright-managed browsers are missing, check for an already-installed system Chrome/Edge/Chromium and use an executablePath fallback when the project tooling supports it; do not install software unless authorized.',
    '- Preserve already-passing work and correct the root cause once; do not retry the same command blindly.',
  ]
  if (runtimeRestartAuthorized) {
    guidance.push('- `runtime.restart_local` is authorized: you may restart only task-owned/local dev processes after verifying command/cwd/port ownership; never kill unrelated user processes.')
  } else {
    guidance.push('- Local process restart is NOT authorized unless the process was started by this run. Prefer a fresh browser/session and safe runtime probes; request authorization only if restart becomes truly necessary.')
  }
  if (localTestAuthAuthorized) {
    guidance.push('- `local.test_auth_write` is authorized: local test-session helpers may be used for Browser QA, limited to their intended local test writes.')
  }
  if (categories.has('technical_unavailable') || categories.has('unexpected_state')) {
    guidance.push('- The current blocker is technical/runtime. Exhaust the capability-discovery and clean-runtime fallbacks above before keeping BLOCKED.')
  }
  if (categories.has('ci_deploy_failure')) {
    guidance.push('- Inspect the exact CI/deploy job and separate code regression from infrastructure/baseline failure. Retry only when evidence indicates a transient external failure.')
  }
  guidance.push(`- Current deterministic gate: ${gateState.status} (${gateState.reason}).`)
  return guidance.join('\n')
}

const args = parseArgs(process.argv.slice(2))
if (args.help) {
  console.log(usage())
  process.exit(0)
}

if (!args.promptFile || !args.contract || !args.completionReport) {
  console.error(usage())
  process.exit(2)
}
assertPositiveInteger(args.maxIterations, '--max-iterations')
assertPositiveInteger(args.blockedRetries, '--blocked-retries', true)
assertPositiveInteger(args.maxStagnant, '--max-stagnant', true)
assertPositiveInteger(args.maxMinutes, '--max-minutes')

const cwd = resolve(process.cwd())
const testMode = process.env.NODE_ENV === 'test' && process.env.AUTONOMOUS_RUN_TEST_MODE === '1'
const codexBin = testMode ? process.execPath : 'codex'
const codexPrefixArgs = testMode ? [resolve(cwd, 'scripts', 'ai', 'fixtures', 'fake-codex.mjs')] : []
const promptPath = resolve(cwd, args.promptFile)
const contractPath = resolve(cwd, args.contract)
const reportPath = resolve(cwd, args.completionReport)
for (const [name, path] of [['prompt', promptPath], ['contract', contractPath]]) {
  if (!existsSync(path)) throw new Error(`${name} file not found: ${path}`)
}

const contract = readJson(contractPath)
if (!contract) throw new Error(`Invalid contract JSON: ${contractPath}`)
validateContractShape(contract)
const prompt = readFileSync(promptPath, 'utf8').trim()
if (!prompt) throw new Error('Prompt file is empty')

validatePrimaryRepository(cwd, contract)
validateAutonomousOperations(contract)
const runtimeBase = testMode && process.env.AUTONOMOUS_RUN_RUNTIME_ROOT
  ? resolve(process.env.AUTONOMOUS_RUN_RUNTIME_ROOT)
  : resolve(cwd, '.codex', 'runtime')
const runtimeDir = resolve(runtimeBase, contract.task_id || 'autonomous-run', 'supervisor')
mkdirSync(runtimeDir, { recursive: true })
const authorizedRepositories = resolveAuthorizedRepositories(contract, cwd)
const contractRepoPaths = authorizedRepositories.map(repo => repo.path)
const requestedAddDirs = args.addDirs.map(path => resolve(cwd, path))
const authorizedRepoPathSet = new Set(contractRepoPaths)
for (const path of requestedAddDirs) {
  if (!authorizedRepoPathSet.has(path)) {
    throw new Error(`--add-dir is outside authorized_repositories: ${path}`)
  }
}
for (const repo of authorizedRepositories) {
  assertRepoScope(repo.path, repo.base_ref, repo.allowed_paths, `authorized repository ${repo.name}`)
}
const repoRoots = [...new Set([cwd, ...contractRepoPaths])]
const addDirs = repoRoots.filter(path => path !== cwd)
const startedAt = Date.now()

function codexArgsBase() {
  const values = [
    'exec', '--json', '-C', cwd,
    '-s', 'workspace-write',
    '--ignore-user-config', '--ignore-rules', '--strict-config',
    '-c', 'shell_environment_policy.inherit="core"',
    '-c', 'sandbox_workspace_write.network_access=false',
  ]
  for (const dir of addDirs) values.push('--add-dir', dir)
  if (args.model) values.push('--model', args.model)
  return values
}

function assertAllBoundaries() {
  validatePrimaryRepository(cwd, contract)
  const currentAuthorizedRepositories = resolveAuthorizedRepositories(contract, cwd)
  for (const repo of currentAuthorizedRepositories) {
    assertRepoScope(repo.path, repo.base_ref, repo.allowed_paths, `authorized repository ${repo.name}`)
  }
}

let threadId = null
let blockedCount = 0
let stagnantCount = 0
let previousFingerprint = null
let lastGate = { status: 'CONTINUE', reason: 'not_started' }

for (let iteration = 1; iteration <= args.maxIterations; iteration += 1) {
  const elapsedMinutes = (Date.now() - startedAt) / 60_000
  if (elapsedMinutes >= args.maxMinutes) {
    console.error(JSON.stringify({ status: 'BLOCKED', reason: 'supervisor_time_limit', iteration, max_minutes: args.maxMinutes }))
    process.exit(5)
  }

  const report = readJson(reportPath)
  const outstanding = outstandingSummary(contract, report)
  const continuation = iteration === 1
    ? [
        'SUPERVISED AUTONOMOUS RUN. Work until the deterministic completion gate is COMPLETE or a real HARD_STOP exists. CONTINUE is not a handoff.',
        `Task contract: ${contractPath}`,
        `Completion report to create/update: ${reportPath}`,
        'Read the task contract before acting and keep the completion report current with concrete evidence.',
        prompt,
      ].join('\n\n')
    : [
        'AUTO_CONTINUE. Do not hand off or summarize as final.',
        `The deterministic completion gate returned ${lastGate.status}: ${lastGate.reason}.`,
        'Continue from the current workspace state. Preserve already-passing work; diagnose root cause, make the minimum correction, run affected checks, and update the completion report.',
        lastGate.status === 'BLOCKED'
          ? recoveryGuidance({ contract, report, gateState: lastGate })
          : 'Incomplete work or pending executable verification is CONTINUE: perform it now rather than returning it to the user.',
        outstanding,
        'Do not perform unauthorized deploy, production writes, destructive Git operations, main push, release, or tag.',
      ].filter(Boolean).join('\n\n')

  const resumeSafetyArgs = [
    '--json', '--ignore-user-config', '--ignore-rules', '--strict-config',
    '-c', 'shell_environment_policy.inherit="core"',
    '-c', 'sandbox_workspace_write.network_access=false',
  ]
  const commandArgs = threadId
    ? ['exec', 'resume', ...resumeSafetyArgs, threadId, continuation]
    : [...codexArgsBase(), continuation]
  const remainingMs = Math.max(1_000, args.maxMinutes * 60_000 - (Date.now() - startedAt))
  try {
    assertAllBoundaries()
  } catch (error) {
    console.error(JSON.stringify({ status: 'HARD_STOP', reason: 'repository_boundary_violation', iteration, evidence: error.message }))
    process.exit(3)
  }
  const result = run(codexBin, [...codexPrefixArgs, ...commandArgs], { cwd, timeoutMs: remainingMs })
  writeFileSync(resolve(runtimeDir, `iteration-${String(iteration).padStart(2, '0')}.stdout.jsonl`), redactLog(result.stdout))
  writeFileSync(resolve(runtimeDir, `iteration-${String(iteration).padStart(2, '0')}.stderr.log`), redactLog(result.stderr))

  if (result.timedOut) {
    console.error(JSON.stringify({ status: 'BLOCKED', reason: 'supervisor_turn_timeout', iteration, max_minutes: args.maxMinutes }))
    process.exit(5)
  }

  if (!threadId) threadId = findThreadId(result.stdout)
  if (!threadId) {
    console.error(JSON.stringify({ status: 'HARD_STOP', reason: 'codex_thread_id_not_found', iteration, codex_exit: result.status }))
    process.exit(6)
  }

  try {
    assertAllBoundaries()
  } catch (error) {
    console.error(JSON.stringify({ status: 'HARD_STOP', reason: 'repository_boundary_violation', iteration, evidence: error.message }))
    process.exit(3)
  }

  lastGate = gate(contract, reportPath)
  const currentReport = readJson(reportPath)
  const terminalBlockers = lastGate.status === 'BLOCKED' ? hardStopBlockers(currentReport) : []
  const event = {
    iteration,
    thread_id: threadId,
    codex_exit: result.status,
    gate: lastGate,
    blocked_recovery_count: blockedCount,
    elapsed_minutes: Number(((Date.now() - startedAt) / 60_000).toFixed(2)),
  }
  console.log(JSON.stringify(event))
  writeFileSync(resolve(runtimeDir, 'latest-state.json'), redactLog(JSON.stringify({ ...event, repo_roots: repoRoots, blockers: collectBlockers(currentReport) }, null, 2)))

  if (lastGate.status === 'COMPLETE') process.exit(0)

  if (terminalBlockers.length) {
    console.error(redactLog(JSON.stringify({ status: 'HARD_STOP', reason: 'terminal_blocker', iteration, blockers: terminalBlockers.map(({ scope, category, evidence }) => ({ scope, category, evidence })) })))
    process.exit(3)
  }

  const fingerprint = stateFingerprint(repoRoots, reportPath, lastGate)
  stagnantCount = fingerprint === previousFingerprint ? stagnantCount + 1 : 0
  previousFingerprint = fingerprint
  if (args.maxStagnant > 0 && stagnantCount >= args.maxStagnant) {
    console.error(JSON.stringify({ status: 'BLOCKED', reason: 'supervisor_no_progress', iteration, stagnant_turns: stagnantCount, repo_roots: repoRoots }))
    process.exit(5)
  }

  if (lastGate.status === 'BLOCKED') {
    if (blockedCount >= args.blockedRetries) {
      console.error(JSON.stringify({ status: 'BLOCKED', reason: 'recovery_exhausted', iteration, recovery_turns: blockedCount }))
      process.exit(3)
    }
    blockedCount += 1
    continue
  }

  blockedCount = 0
}

console.error(JSON.stringify({ status: 'BLOCKED', reason: 'supervisor_iteration_limit', max_iterations: args.maxIterations }))
process.exit(5)
