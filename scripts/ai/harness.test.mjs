import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { compareResults, stableFailures } from './baseline-delta.mjs';
import { classifyChangedFiles, completionResult, inAllowedPaths, resolveHarnessBaseRef, securityRisk, selectChecks, semanticBoundaryEvidence, validateCompletionContract, validateHeadingSequence } from './harness-lib.mjs';

test('allowed paths and outside scope', () => { assert.equal(inAllowedPaths('scripts/ai/verify.mjs', ['scripts/ai/**']), true); assert.equal(inAllowedPaths('src/App.jsx', ['scripts/ai/**']), false); });
test('security secrets and dangerous Android files', () => { assert.equal(securityRisk(['AndroidManifest.xml']).significant, true); assert.equal(securityRisk(['auth-service.js']).level, 'review'); });
test('selects frontend, backend, database and Android', () => { assert.deepEqual(classifyChangedFiles(['src/App.jsx']), ['diff', 'frontend', 'ui']); assert.ok(classifyChangedFiles(['backend/app.js']).includes('backend')); assert.ok(classifyChangedFiles(['docs/30-database/migration/1.sql']).includes('database')); assert.deepEqual(classifyChangedFiles(['mobile/orange-photos-sync-agent/app/src/main/X.kt']), ['diff', 'android']); });
test('Android manifest selects security', () => { assert.ok(classifyChangedFiles(['mobile/orange-photos-sync-agent/app/src/main/AndroidManifest.xml']).includes('security')); });
test('semantic boundary requires concrete evidence', () => { assert.equal(semanticBoundaryEvidence('Android Worker -> API Node', []), false); assert.equal(semanticBoundaryEvidence('Android Worker -> API Node', [{ boundary: 'Android Worker -> API Node', entrypoint: 'worker', downstream: 'api', test_file: 'test.js', integration_test: true, observed: true }]), true); });
test('API contract changes activate Android only when declared by surface', () => { assert.ok(classifyChangedFiles(['docs/20-development/API.md']).includes('documentation')); assert.ok(!classifyChangedFiles(['docs/20-development/API.md']).includes('android')); });
test('API contract task selects Android consumer review', () => { assert.ok(selectChecks(['backend/src/api.js'], { change_types: ['api-contract'] }).includes('android')); });
test('workflow and storage changes are security-sensitive', () => { assert.ok(classifyChangedFiles(['.github/workflows/verify.yml']).includes('security')); assert.ok(classifyChangedFiles(['backend/src/wasabi.js']).includes('security')); });
test('documentation paths are classified', () => { assert.ok(classifyChangedFiles(['AGENTS.md']).includes('documentation')); assert.ok(classifyChangedFiles(['.agents/RULES.md']).includes('documentation')); });
test('scope supports nested allowed paths', () => { assert.equal(inAllowedPaths('mobile/orange-photos-sync-agent/app/src/main/X.kt', ['mobile/orange-photos-sync-agent/**']), true); });
test('security risk distinguishes ordinary files', () => { assert.equal(securityRisk(['src/App.jsx']).level, 'low'); assert.equal(securityRisk(['AndroidManifest.xml']).level, 'significant'); });
test('boundary evidence needs entrypoint, downstream and test file', () => { assert.equal(semanticBoundaryEvidence('React -> Node', [{ boundary: 'React -> Node', entrypoint: 'handler', downstream: 'endpoint' }]), false); });
test('database migration is selected only for real migration paths', () => { assert.ok(classifyChangedFiles(['docs/30-database/migration/20260101_init.sql']).includes('database')); assert.ok(!classifyChangedFiles(['docs/10-architecture/DATABASE.md']).includes('database')); });
test('frontend source classification covers TypeScript and Vite', () => { assert.ok(classifyChangedFiles(['src/main.tsx']).includes('frontend')); assert.ok(classifyChangedFiles(['vite.config.js']).includes('frontend')); });
test('API/backend and Android remain separate checks', () => { const checks = classifyChangedFiles(['backend/app.js', 'mobile/orange-photos-sync-agent/app/src/main/X.kt']); assert.ok(checks.includes('backend')); assert.ok(checks.includes('android')); });
test('public/auth changes select security', () => { assert.ok(classifyChangedFiles(['backend/src/auth.js']).includes('security')); assert.ok(classifyChangedFiles(['backend/src/publicRoutes.js']).includes('security')); });
test('UI style guide selects UI and documentation', () => { const checks = classifyChangedFiles(['docs/10-architecture/UI-STYLE-GUIDE.md']); assert.ok(checks.includes('ui')); assert.ok(checks.includes('documentation')); });
test('sensitive filenames are classified without reading content', () => { assert.ok(securityRisk(['.env.production']).significant); assert.ok(securityRisk(['id_ed25519']).significant); });
test('task schema declares autonomous boundary and completion fields', () => { const schema = JSON.parse(fs.readFileSync('.codex/task-contract.schema.json', 'utf8')); assert.ok(schema.required.includes('state')); assert.ok(schema.required.includes('base_sha')); assert.ok(schema.required.includes('working_branch')); assert.ok(schema.properties.allowed_paths.minItems === 1); assert.ok(schema.properties.authorized_repositories); assert.ok(schema.properties.required_checks.items.enum.includes('harness')); assert.deepEqual(schema.properties.state.enum, ['AUTO_CONTINUE', 'BLOCKED', 'HARD_STOP', 'COMPLETE']); assert.ok(schema.properties.blockers); assert.ok(schema.properties.recovery_attempts); assert.ok(schema.properties.check_results); });
test('baseline identical failures are accepted', () => { assert.equal(compareResults({ status: 'fail', failed: ['A', 'B'] }, { status: 'fail', failed: ['B', 'A'] }).status, 'PASS_WITH_BASELINE'); });
test('baseline new failure is rejected', () => { const result = compareResults({ status: 'fail', failed: ['A'] }, { status: 'fail', failed: ['A', 'B'] }); assert.equal(result.status, 'FAIL_NEW'); assert.deepEqual(result.added, ['B']); });
test('baseline improvement is accepted', () => { assert.equal(compareResults({ status: 'fail', failed: ['A', 'B'] }, { status: 'fail', failed: ['A'] }).status, 'PASS_IMPROVED'); });
test('uncomparable baseline is blocked', () => { assert.equal(compareResults(null, { status: 'fail', failed: ['A'] }).status, 'BLOCKED_BASELINE'); });
test('node test failure parser produces stable identifiers', () => { assert.deepEqual(stableFailures('✖ test one (1ms)\n✖ test two (2ms)\n✖ test one (3ms)'), ['test one', 'test two']); });
test('harness files activate the harness check', () => { assert.ok(classifyChangedFiles(['scripts/ai/harness-lib.mjs']).includes('harness')); assert.ok(classifyChangedFiles(['.codex/task-contract.schema.json']).includes('harness')); });
test('release workflow numbered headings are consecutive', () => { const markdown = fs.readFileSync('docs/40-features/orange-photos/ANDROID_RELEASE_WORKFLOW.md', 'utf8'); const result = validateHeadingSequence(markdown); assert.equal(result.valid, true, result.errors.join('; ')); assert.equal(validateHeadingSequence('## 17. one\n## 18. updater\n## 18. duplicate').valid, false); });
test('AUTO_CONTINUE accepts pending work without blockers', () => { const result = validateCompletionContract({ state: 'AUTO_CONTINUE', acceptance_criteria: [{ id: 'pending', satisfied: false }], blockers: [] }); assert.equal(result.valid, true); });
test('AUTO_CONTINUE rejects completed work and blockers', () => { assert.equal(validateCompletionContract({ state: 'AUTO_CONTINUE', acceptance_criteria: [{ id: 'done', satisfied: true, evidence: [{}] }], blockers: [] }).valid, false); assert.equal(validateCompletionContract({ state: 'AUTO_CONTINUE', acceptance_criteria: [{ id: 'pending', satisfied: false }], blockers: [{ resolved: false, evidence: 'blocked' }] }).valid, false); });
test('COMPLETE remains strict', () => { const base = { state: 'COMPLETE', acceptance_criteria: [{ id: 'ok', satisfied: true, evidence: [{}] }], required_checks: ['harness'], check_results: [{ check: 'harness', status: 'PASS', evidence: 'pass' }], blockers: [] }; assert.equal(validateCompletionContract(base).valid, true); assert.equal(validateCompletionContract({ ...base, acceptance_criteria: [{ id: 'pending', satisfied: false }] }).valid, false); assert.equal(validateCompletionContract({ ...base, required_checks: ['harness', 'diff'] }).valid, false); assert.equal(validateCompletionContract({ ...base, visual_validation: { required: true, performed: false } }).valid, false); });
test('BLOCKED requires evidence and recovery', () => { const blocked = { state: 'BLOCKED', blockers: [{ resolved: false, evidence: 'concrete' }], recovery_attempts: [{ action: 'retry', result: 'failed' }] }; assert.equal(validateCompletionContract(blocked).valid, true); assert.equal(validateCompletionContract({ ...blocked, recovery_attempts: [] }).valid, false); assert.equal(validateCompletionContract({ ...blocked, blockers: [{ resolved: false }] }).valid, false); });
test('HARD_STOP is always terminal', () => { assert.equal(validateCompletionContract({ state: 'HARD_STOP' }).valid, false); });
test('external completion result continues until deterministic evidence is complete', () => { const contract = { task_id: 'task', acceptance_criteria: [{ id: 'done', description: 'done' }], required_checks: ['harness'] }; const pending = { task_id: 'task', state: 'AUTO_CONTINUE', acceptance_criteria: [{ id: 'done', description: 'done', satisfied: false, evidence: [] }], blockers: [], check_results: [] }; assert.equal(completionResult(contract, pending).status, 'CONTINUE'); const complete = { ...pending, state: 'COMPLETE', acceptance_criteria: [{ id: 'done', description: 'done', satisfied: true, evidence: [{}] }], check_results: [{ check: 'harness', status: 'PASS', evidence: 'node tests passed' }] }; assert.equal(completionResult(contract, complete).status, 'COMPLETE'); });
test('external completion result preserves recoverable BLOCKED for supervisor recovery', () => { const contract = { task_id: 'task', acceptance_criteria: [{ id: 'done', description: 'done' }], required_checks: [] }; const report = { task_id: 'task', state: 'BLOCKED', acceptance_criteria: [{ id: 'done', description: 'done', satisfied: false, evidence: [] }], blockers: [{ category: 'technical_unavailable', reason: 'runtime unavailable', evidence: 'safe probes failed', resolved: false }], recovery_attempts: [{ action: 'probe', result: 'failed' }], check_results: [] }; assert.equal(completionResult(contract, report).status, 'BLOCKED'); });
test('completion contract validates required semantic boundaries', () => { const base = { state: 'COMPLETE', acceptance_criteria: [{ id: 'ok', satisfied: true, evidence: [{}] }], required_checks: ['harness'], check_results: [{ check: 'harness', status: 'PASS', evidence: 'pass' }], blockers: [] }; const pending = { boundary: 'Android -> Node', required: true, satisfied: false, evidence: [] }; assert.equal(validateCompletionContract({ ...base, semantic_boundaries: [pending] }).valid, false); assert.equal(validateCompletionContract({ ...base, semantic_boundaries: [{ ...pending, satisfied: true, evidence: [{}] }] }).valid, true); });
test('harness base ref prioritizes explicit override', () => { assert.equal(resolveHarnessBaseRef({ override: 'custom-ref', eventName: 'push', payload: { before: 'b'.repeat(40) } }), 'custom-ref'); });
test('harness base ref uses pull request base sha', () => { const sha = 'a'.repeat(40); assert.equal(resolveHarnessBaseRef({ eventName: 'pull_request', payload: { pull_request: { base: { sha } } } }), sha); });
test('harness base ref uses push before sha', () => { const sha = 'b'.repeat(40); assert.equal(resolveHarnessBaseRef({ eventName: 'push', payload: { before: sha } }), sha); });
test('harness base ref rejects branch creation zero sha', () => { assert.equal(resolveHarnessBaseRef({ eventName: 'push', payload: { before: '0'.repeat(40) } }), 'origin/main'); });
test('harness base ref falls back locally', () => { assert.equal(resolveHarnessBaseRef(), 'origin/main'); });

test("AGENTS routes semantically complex implementation tasks to the autonomous skill", () => {
  const agents = fs.readFileSync("AGENTS.md", "utf8");
  assert.match(agents, /clasificación es semántica/i);
  assert.match(agents, /No se exigen palabras mágicas/i);
  assert.match(agents, /\.agents\/skills\/autonomous-task\/SKILL\.md/);
  assert.match(agents, /\.codex\/autonomous-bootstrap\.mjs/);
  assert.match(agents, /complejidad no equivale a autorización/i);
});

test("autonomous task skill materializes a complete supervisor handoff", () => {
  const skill = fs.readFileSync(".agents/skills/autonomous-task/SKILL.md", "utf8");
  for (const field of [
    "task_id",
    "objective",
    "base_ref",
    "base_sha",
    "working_branch",
    "allowed_paths",
    "acceptance_criteria",
    "out_of_scope",
    "required_checks",
    "hard_stop_conditions",
  ]) {
    assert.match(skill, new RegExp(field));
  }
  assert.match(skill, /Activation is semantic/i);
  assert.match(skill, /Never require magic words/i);
  assert.match(skill, /\.codex\/autonomous-bootstrap\.mjs/);
  assert.match(skill, /agent\/<task-id>/);
  assert.match(skill, /prompt\.md/);
  assert.match(skill, /task-contract\.json/);
  assert.match(skill, /Complexity is not authorization/i);
  assert.match(skill, /Do not tell the user to manually run the bootstrap/i);
  assert.match(fs.readFileSync(".codex/rules/default.rules", "utf8"), /pattern\s*=\s*\["node", "\.codex\/autonomous-bootstrap\.mjs"\]/);
  assert.match(fs.readFileSync(".codex/config.toml", "utf8"), /default_permissions\s*=\s*":workspace"/);
});
