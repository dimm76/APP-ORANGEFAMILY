---
name: scoped-implementation
description: Implement the smallest authorized change inside Task Contract allowed_paths and recover from ordinary in-scope failures.
---

# Scoped implementation

Implement the smallest change inside `allowed_paths`. Reuse existing solutions, keep React/API/PostgreSQL/Android boundaries intact, and treat ordinary syntax, lint, test, and build failures as recoverable.

For an ordinary in-scope failure, diagnose it, apply the minimum correction
inside `allowed_paths`, and rerun the check. Record each distinct attempt in
`recovery_attempts`; use at most two technically different attempts for the
same problem before returning `BLOCKED` with concrete evidence.
