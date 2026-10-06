import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const normalize = value => value.replaceAll('\\', '/').replace(/^\.\//, '');
const matches = (file, pattern) => {
  const p = normalize(pattern);
  if (p.endsWith('/**')) return file.startsWith(p.slice(0, -3));
  if (p.includes('**')) {
    const [prefix, suffix] = p.split('**');
    return file.startsWith(prefix) && file.endsWith(suffix.replace(/^\//, ''));
  }
  return file === p || file.startsWith(`${p}/`);
};

export function inAllowedPaths(file, allowedPaths = []) {
  return allowedPaths.some(pattern => matches(normalize(file), pattern));
}

export function classifyChangedFiles(files) {
  const normalized = files.map(normalize);
  const checks = new Set(['diff']);
  for (const file of normalized) {
    if (file.startsWith('src/') || /^vite|^eslint|^package\.json$/.test(file)) checks.add('frontend');
    if (file.startsWith('src/') && /\.(css|jsx|tsx)$/.test(file) || file === 'docs/10-architecture/UI-STYLE-GUIDE.md') checks.add('ui');
    if (file.startsWith('backend/')) checks.add('backend');
    if (file.startsWith('mobile/orange-photos-sync-agent/')) checks.add('android');
    if (file.startsWith('docs/') || file === 'AGENTS.md' || file.startsWith('.agents/')) checks.add('documentation');
    if (file.startsWith('docs/30-database/migration/') || file.startsWith('database/')) checks.add('database');
    if (/auth|permission|ownership|membership|module_access|session|cookie|cors|upload|download|public|share|token|password|\.sql$|workflow|package-lock|build\.gradle|AndroidManifest|network.security|MediaStore|Room|WorkManager|filesystem|Wasabi/i.test(file)) checks.add('security');
    if (file.startsWith('scripts/ai/') || file.startsWith('.codex/') || file.startsWith('.agents/') || file === 'AGENTS.md') checks.add('harness');
  }
  return [...checks];
}

export function selectChecks(files, contract = {}) {
  const checks = new Set(classifyChangedFiles(files));
  for (const check of contract.required_checks ?? []) checks.add(check);
  if (contract.change_types?.includes('api-contract') || (contract.semantic_boundaries ?? []).some(item => /Android|React.*Node|Node.*API/i.test(item.boundary ?? ''))) checks.add('android');
  if (contract.requires_security_review === true) checks.add('security');
  return [...checks];
}

export function securityRisk(files, contents = '') {
  const text = `${files.join('\n')}\n${contents}`;
  const significant = /secret|credential|keystore|cleartext|exported|AndroidManifest|FileProvider|WebView|auth bypass|public route|force.?push|production|(?:^|[\\/])\.env(?:\.|$)|id_(?:rsa|ed25519)/i.test(text);
  return { level: significant ? 'significant' : /auth|permission|upload|download|AndroidManifest|Room|WorkManager/i.test(text) ? 'review' : 'low', significant };
}

export function semanticBoundaryEvidence(boundary, evidence = []) {
  return evidence.some(item => item.boundary === boundary && item.entrypoint && item.downstream && item.test_file && item.integration_test === true && item.observed === true);
}

export function validateCompletionContract(contract = {}) {
  const errors = [];
  const unresolvedBlockers = (contract.blockers ?? []).filter(blocker => blocker.resolved !== true);
  const criteriaPending = (contract.acceptance_criteria ?? []).filter(criterion => !(criterion.satisfied === true && criterion.evidence?.length > 0));
  const boundariesPending = (contract.semantic_boundaries ?? []).filter(boundary => boundary.required !== false && !(boundary.satisfied === true && boundary.evidence?.length > 0));
  const accepted = new Set(['PASS', 'PASS_WITH_BASELINE', 'PASS_IMPROVED']);
  const checksPending = (contract.required_checks ?? []).filter(check => {
    const result = (contract.check_results ?? []).find(item => item.check === check);
    return !result || !accepted.has(result.status) || !result.evidence;
  });
  const visualPending = contract.visual_validation?.required === true && !(contract.visual_validation.performed === true && contract.visual_validation.evidence);
  if (contract.state === 'HARD_STOP') return { valid: false, errors: ['HARD_STOP: task cannot complete'] };
  if (!['AUTO_CONTINUE', 'BLOCKED', 'COMPLETE'].includes(contract.state)) return { valid: false, errors: ['invalid state'] };
  if (contract.state === 'AUTO_CONTINUE') {
    if (unresolvedBlockers.length > 0) errors.push('AUTO_CONTINUE has unresolved blockers');
    if (criteriaPending.length === 0 && boundariesPending.length === 0 && checksPending.length === 0 && !visualPending) errors.push('AUTO_CONTINUE has no pending work; use COMPLETE');
  }
  if (contract.state === 'COMPLETE') {
    if (unresolvedBlockers.length > 0) errors.push('COMPLETE has unresolved blockers');
    if (criteriaPending.length > 0) errors.push(`acceptance criteria pending: ${criteriaPending.map(item => item.id ?? 'unknown').join(', ')}`);
    if (boundariesPending.length > 0) errors.push(`semantic boundaries pending: ${boundariesPending.map(item => item.boundary ?? 'unknown').join(', ')}`);
    if (checksPending.length > 0) errors.push(`required checks pending: ${checksPending.join(', ')}`);
    if (visualPending) errors.push('required visual validation pending');
  }
  if (contract.state === 'BLOCKED') {
    if (unresolvedBlockers.length === 0 || !unresolvedBlockers.some(blocker => blocker.evidence)) errors.push('BLOCKED requires blocker evidence');
    if (!(contract.recovery_attempts?.length > 0)) errors.push('BLOCKED requires recovery_attempts');
  }
  return { valid: errors.length === 0, errors };
}

export function completionResult(contract = {}, report = {}) {
  if (!contract?.task_id || report?.task_id !== contract.task_id) return { status: 'CONTINUE', reason: 'task_id_mismatch' };

  const expectedCriteria = contract.acceptance_criteria ?? [];
  const actualCriteria = report.acceptance_criteria ?? [];
  const expectedIds = expectedCriteria.map(item => item.id);
  const actualIds = actualCriteria.map(item => item?.id);
  if (actualIds.length !== expectedIds.length || new Set(actualIds).size !== actualIds.length || actualIds.some(id => !expectedIds.includes(id))) {
    return { status: 'CONTINUE', reason: 'acceptance_criteria_mismatch' };
  }

  const unresolvedBlockers = (report.blockers ?? []).filter(blocker => blocker?.resolved !== true);
  if (report.state === 'BLOCKED' || report.state === 'HARD_STOP') {
    const hasEvidence = unresolvedBlockers.length > 0
      && unresolvedBlockers.every(blocker => blocker?.category && blocker?.reason && blocker?.evidence);
    const hasRecovery = Array.isArray(report.recovery_attempts) && report.recovery_attempts.length > 0;
    if (!hasEvidence || !hasRecovery) return { status: 'CONTINUE', reason: 'invalid_blocker_evidence' };
    return { status: 'BLOCKED', reason: 'documented_blocked' };
  }

  const criteriaPending = actualCriteria.filter(item => !(item?.satisfied === true && item.evidence?.length > 0));
  if (criteriaPending.length > 0) return { status: 'CONTINUE', reason: 'acceptance_pending' };

  const expectedBoundaries = (contract.semantic_boundaries ?? []).filter(item => item.required !== false);
  const actualBoundaries = report.semantic_boundaries ?? [];
  for (const boundary of expectedBoundaries) {
    const actual = actualBoundaries.find(item => item?.boundary === boundary.boundary);
    if (!(actual?.satisfied === true && actual.evidence?.length > 0)) {
      return { status: 'CONTINUE', reason: 'semantic_boundary_pending' };
    }
  }

  const accepted = new Set(['PASS', 'PASS_WITH_BASELINE', 'PASS_IMPROVED']);
  for (const check of contract.required_checks ?? []) {
    const result = (report.check_results ?? []).find(item => item?.check === check);
    if (!result || !accepted.has(result.status) || !result.evidence) {
      return { status: 'CONTINUE', reason: `required_check_pending:${check}` };
    }
  }

  if (contract.visual_validation?.required === true) {
    if (!(report.visual_validation?.performed === true && report.visual_validation?.evidence)) {
      return { status: 'CONTINUE', reason: 'visual_validation_pending' };
    }
  }

  if (unresolvedBlockers.length > 0) return { status: 'CONTINUE', reason: 'unresolved_blockers_without_blocked_state' };
  return { status: 'COMPLETE', reason: 'all_required_evidence_present' };
}

export function extractNumberedHeadings(markdown = '') {
  return [...markdown.matchAll(/^## (\d+)\./gm)].map(match => Number(match[1]));
}

export function validateHeadingSequence(markdown = '') {
  const numbers = extractNumberedHeadings(markdown);
  const errors = [];
  for (let index = 1; index < numbers.length; index += 1) {
    if (numbers[index] <= numbers[index - 1]) errors.push(`duplicate or descending heading: ${numbers[index]}`);
    if (numbers[index] !== numbers[index - 1] + 1) errors.push(`non-consecutive heading: ${numbers[index - 1]} -> ${numbers[index]}`);
  }
  return { valid: errors.length === 0, numbers, errors };
}

export function resolveHarnessBaseRef({ override = '', eventName = '', payload = {} } = {}) {
  if (override.trim()) return override;
  if (eventName === 'pull_request') {
    const sha = payload.pull_request?.base?.sha;
    if (typeof sha === 'string' && /^[0-9a-f]{40}$/i.test(sha)) return sha;
  }
  if (eventName === 'push') {
    const before = payload.before;
    if (typeof before === 'string' && /^[0-9a-f]{40}$/i.test(before) && !/^0{40}$/.test(before)) return before;
  }
  return 'origin/main';
}

export function taskFiles({ base = 'origin/main', includeWorkingTree = true } = {}) {
  const names = new Set();
  const add = output => output.split(/\r?\n/).map(normalize).filter(Boolean).forEach(file => names.add(file));
  add(execFileSync('git', ['diff', '--name-only', `${base}...HEAD`], { encoding: 'utf8' }));
  if (includeWorkingTree) {
    add(execFileSync('git', ['diff', '--name-only'], { encoding: 'utf8' }));
    add(execFileSync('git', ['diff', '--cached', '--name-only'], { encoding: 'utf8' }));
    add(execFileSync('git', ['ls-files', '--others', '--exclude-standard'], { encoding: 'utf8' }));
  }
  return [...names];
}

export function readJson(file) { return JSON.parse(fs.readFileSync(path.resolve(file), 'utf8')); }
