const [file] = process.argv.slice(2);
const contract = JSON.parse(await import('node:fs/promises').then(fs => fs.readFile(file, 'utf8')));
const fail = message => { console.error(`FAIL: ${message}`); process.exitCode = 2; };
if (!['COMPLETE', 'BLOCKED', 'AUTO_CONTINUE', 'HARD_STOP'].includes(contract.state)) fail('invalid state');
if (contract.state === 'HARD_STOP') { console.error('HARD_STOP: task cannot complete'); process.exit(2); }
if (contract.state === 'COMPLETE' && (contract.blockers ?? []).some(blocker => blocker.resolved !== true)) fail('COMPLETE has unresolved blockers');
if (contract.state === 'BLOCKED' && !(contract.blockers?.some(blocker => blocker.evidence) && contract.recovery_attempts?.length > 0)) fail('BLOCKED requires blocker evidence and recovery_attempts');
for (const criterion of contract.acceptance_criteria ?? []) if (!(criterion.evidence?.length > 0 && criterion.satisfied === true)) fail(`acceptance criterion lacks evidence: ${criterion.id ?? 'unknown'}`);
for (const boundary of contract.semantic_boundaries ?? []) if (boundary.required !== false && !(boundary.evidence?.length > 0 && boundary.satisfied === true)) fail(`semantic boundary lacks evidence: ${boundary.boundary ?? 'unknown'}`);
if (contract.visual_validation?.required === true && !(contract.visual_validation.performed === true && contract.visual_validation.evidence)) fail('required visual validation lacks evidence');
if ((contract.blockers ?? []).some(blocker => blocker.resolved !== true)) fail('unresolved blockers');
const accepted = new Set(['PASS', 'PASS_WITH_BASELINE', 'PASS_IMPROVED']);
for (const check of contract.required_checks ?? []) { const result = (contract.check_results ?? []).find(item => item.check === check); if (!result || !accepted.has(result.status) || !result.evidence) fail(`required check lacks acceptable evidence: ${check}`); }
if (contract.documentation_impact?.required === true) {
  const impact = contract.documentation_impact;
  if (!impact.resolution) fail('documentation impact requires UPDATED or NO_CHANGE_REQUIRED');
  if (!impact.evidence) fail('documentation impact requires evidence');
  if (impact.resolution === 'UPDATED' && !(impact.canonical_docs?.length > 0)) fail('UPDATED requires canonical_docs');
}
if (process.exitCode) process.exit(process.exitCode);
console.log(`PASS: ${contract.state}`);
