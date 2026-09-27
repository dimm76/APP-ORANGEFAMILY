import { classifyChangedFiles, documentationCandidates } from './harness-lib.mjs';
import fs from 'node:fs';
const args = process.argv.slice(2);
const contractIndex = args.indexOf('--contract');
const filesIndex = args.indexOf('--files');
const contractFile = contractIndex >= 0 ? args[contractIndex + 1] : null;
const files = filesIndex >= 0 ? args.slice(filesIndex + 1) : [];
const contract = contractFile && fs.existsSync(contractFile) ? JSON.parse(fs.readFileSync(contractFile, 'utf8')) : {};
const candidates = documentationCandidates(files);
const impact = contract.documentation_impact;
const required = impact?.required === true || contract.required_docs?.length > 0;
const missing = (contract.required_docs ?? []).filter(file => !fs.existsSync(file));
if (required && missing.length) { console.error(`FAIL: required documentation missing\n${missing.join('\n')}`); process.exit(2); }
const trivialEvidence = /^(no|n\/a|not needed|none|unchanged|no change required)\.?$/i;
if (candidates.length && contractFile && !impact) { console.error(`FAIL: documentation impact resolution is required\n${candidates.join('\n')}`); process.exit(2); }
if (required && impact?.resolution === 'NO_CHANGE_REQUIRED' && (!impact.evidence || trivialEvidence.test(impact.evidence.trim()))) { console.error('FAIL: NO_CHANGE_REQUIRED requires concrete evidence'); process.exit(2); }
if (required && impact?.resolution === 'UPDATED') {
  const changed = new Set(files);
  const absent = (impact.canonical_docs ?? []).filter(file => !changed.has(file));
  if (absent.length) { console.error(`FAIL: UPDATED canonical docs are not changed\n${absent.join('\n')}`); process.exit(2); }
}
if (candidates.length && !impact && !contractFile) console.log(`documentation:candidates=${candidates.join(',')}; resolution required in Task Contract`);
else console.log(required ? 'documentation:verified' : candidates.length ? 'documentation:no-impact-resolution-required' : 'documentation:not-required');
