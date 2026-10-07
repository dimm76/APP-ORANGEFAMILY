# OrangeFamily agent rules

- Apply the minimum change. Reuse before creating; do not refactor unrelated code, add speculative abstractions/dependencies, duplicate logic, or expand scope.
- Read only the canonical documentation and current code needed for the current decision.
- Context economy is mandatory: search/index first, then read targeted ranges; do not repeatedly dump full specs, docs, source files, diffs, or logs.
- Treat a long specification as canonical source material, not permanent prompt payload. Build a compact execution brief during preflight and consult the original only by relevant section/range afterward.
- Prefer deterministic project scripts and directed tests. Persist full command output under .agent-runtime/; surface compact PASS/FAIL summaries and relevant failure excerpts.
- Do not fan out exploratory subagents. Keep one executor; allow at most one additional specialized reviewer/verifier/security subagent at a time, only when its gate adds independent evidence on a stable diff.
- React and Android are untrusted clients. Node validates input, authentication, authorization, family membership, module access, ownership, resource access, and response fields.
- Full technical access is not authority. Authority is Task Contract -> allowed_paths -> authorized_operations -> gates.
- Human intervention is reserved for material decisions, missing authorization/secrets/MFA, destructive/security risk, real Git conflict, non-automatable physical/visual interaction, or demonstrated technical impossibility.
- CONTINUE is not a handoff. Ordinary in-scope failures are diagnose -> minimum fix -> directed re-test -> continue.
- Group findings by root cause. Avoid reviewer/verifier cycles after microchanges; re-review only when the diff changed materially or a finding requires it.
- Changes under mobile/orange-photos-sync-agent/** activate Android rules. API contract changes review affected consumers.
