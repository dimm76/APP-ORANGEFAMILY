# Code review gate

Review the diff independently for scope, architecture, duplication, regressions, API compatibility, ownership, privacy, and semantic-boundary evidence. Check React -> Node, Android -> Node, Node -> PostgreSQL/Wasabi where applicable.

Classify findings as `IN_SCOPE_FIX`, `SCOPE_EXPANSION`, `HUMAN_DECISION`, or
`HARD_STOP`. For `IN_SCOPE_FIX`, correct within `allowed_paths`, verify, and
review again, for at most two cycles per finding. Stop only for real scope or
architecture expansion, a missing human decision, or a hard stop.

When persisted discriminators change (`status`, `source`, `type`, `kind`, enum,
or equivalent), inspect writers, readers, database constraints/enums,
migrations, normalizers, processors, reconcile scripts, jobs, API contracts,
and tests. When global or long-running async state changes, inspect start,
double-start, cancel, reset, logout, recreation/rotation, late callbacks,
stale state, successive generations, user isolation, and terminal states.
Review every UI action's effective callback, enabled state, dismiss behavior,
and observable result; a visible action without its documented effect is an
`IN_SCOPE_FIX`. Structured numbered Markdown requires an automatic sequence
check.
