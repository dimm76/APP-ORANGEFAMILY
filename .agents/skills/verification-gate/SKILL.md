# Verification gate

Select affected deterministic checks. Always run scope and `git diff --check`; use the real frontend, backend, database, documentation, security, and Android commands. Never claim instrumented tests without a device or emulator.

Continue through deterministic checks without an intermediate handoff. Ordinary
syntax, lint, compilation, test, build, diff-check, import, or documentation
structure failures are recoverable in scope: diagnose, make the minimum change,
rerun, and record `recovery_attempts` before using `BLOCKED`.
