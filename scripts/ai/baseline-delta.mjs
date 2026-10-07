import { spawnSync } from 'node:child_process';

export function stableFailures(output) {
  const failures = new Set();
  for (const line of String(output).split(/\r?\n/)) {
    const match = line.match(/^\s*(?:✖|not ok)\s+(.+?)\s*(?:\(|$)/);
    if (match && match[1].trim() !== 'failing tests:') failures.add(match[1].trim());
  }
  return [...failures].sort();
}

export function compareResults(baseline, current) {
  if (!baseline || !current || !Array.isArray(baseline.failed) || !Array.isArray(current.failed)) return { status: 'BLOCKED_BASELINE', added: [], removed: [] };
  const base = new Set(baseline.failed);
  const now = new Set(current.failed);
  const added = [...now].filter(item => !base.has(item)).sort();
  const removed = [...base].filter(item => !now.has(item)).sort();
  if (baseline.status === 'pass' && current.status === 'pass') return { status: 'PASS', added, removed };
  if (baseline.status === 'pass' && current.status === 'fail') return { status: 'FAIL_NEW', added: current.failed, removed };
  if (baseline.status !== 'fail' || current.status !== 'fail') return { status: 'BLOCKED_BASELINE', added, removed };
  if (added.length) return { status: 'FAIL_NEW', added, removed };
  return { status: removed.length ? 'PASS_IMPROVED' : 'PASS_WITH_BASELINE', added, removed };
}

export function runCheck(command, args, cwd) {
  const isWindowsCmd = process.platform === 'win32' && command.endsWith('.cmd');
  const result = spawnSync(
    isWindowsCmd ? 'cmd.exe' : command,
    isWindowsCmd ? ['/d', '/s', '/c', command, ...args] : args,
    { cwd, encoding: 'utf8' },
  );
  return { status: result.status === 0 ? 'pass' : 'fail', failed: stableFailures(`${result.stdout ?? ''}\n${result.stderr ?? ''}`), exitCode: result.status };
}
