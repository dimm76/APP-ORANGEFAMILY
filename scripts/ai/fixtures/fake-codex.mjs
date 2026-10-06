import { appendFileSync, existsSync, readFileSync, writeFileSync } from 'node:fs'

const statePath = process.env.FAKE_STATE
const reportPath = process.env.FAKE_REPORT
const providerPath = process.env.FAKE_PROVIDER
const argvPath = process.env.FAKE_ARGV_PATH
const mode = process.env.FAKE_MODE
const taskId = process.env.FAKE_TASK_ID || 'supervisor-test'

if (!statePath || !reportPath || !mode) {
  console.error('fake-codex fixture missing required environment')
  process.exit(2)
}

const count = (existsSync(statePath) ? Number(readFileSync(statePath, 'utf8')) : 0) + 1
writeFileSync(statePath, String(count))
if (argvPath) writeFileSync(argvPath, JSON.stringify(process.argv.slice(2)))
if (providerPath && mode === 'multi') appendFileSync(`${providerPath}/progress.txt`, `turn-${count}\n`)
if (providerPath && mode === 'multi-outside') appendFileSync(`${providerPath}/outside.txt`, `turn-${count}\n`)

const pass = () => writeFileSync(reportPath, JSON.stringify({
  task_id: taskId,
  state: 'COMPLETE',
  acceptance_criteria: [{ id: 'done', description: 'done', satisfied: true, evidence: [{ source: 'fake completed' }] }],
  blockers: [],
  recovery_attempts: [],
  check_results: [],
}))
const block = category => writeFileSync(reportPath, JSON.stringify({
  task_id: taskId,
  state: 'BLOCKED',
  acceptance_criteria: [{ id: 'done', description: 'done', satisfied: false, evidence: [] }],
  blockers: [{ category, reason: 'fake blocker', evidence: 'fake blocker', resolved: false }],
  recovery_attempts: [{ action: 'safe probe attempted', result: 'failed' }],
  check_results: [],
}))

if (mode === 'continue' && count >= 2) pass()
if (mode === 'recoverable') {
  if (count === 1) block('technical_unavailable')
  else pass()
}
if (mode === 'terminal') block('missing_authorization')
if (mode === 'multi' && count >= 3) pass()
if (mode === 'redact') {
  pass()
  console.log(JSON.stringify({
    type: 'item.completed',
    item: {
      aggregated_output: '{"access_token":"json-secret-value","session-token":"session-secret-value","bearer_token":"bearer-secret-value","CSRF-TOKEN":"csrf-secret-value","JWT":"jwt-secret-value","Cookie":"json-cookie-secret"}\nTOKEN=super-secret-value',
    },
  }))
  console.error('Authorization: Bearer secret-bearer-value')
  console.error('Cookie: session=secret-cookie-value')
  console.error(JSON.stringify({ session_token: 'stderr-session-secret', 'Set-Cookie': 'stderr-cookie-secret', nested: { jwt: 'stderr-jwt-secret' } }))
}

if (count === 1) console.log(JSON.stringify({ thread_id: '0199f2de-1234-7abc-8def-123456789abc' }))
else console.log(JSON.stringify({ type: 'turn.completed', count }))
