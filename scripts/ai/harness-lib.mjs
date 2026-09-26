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
