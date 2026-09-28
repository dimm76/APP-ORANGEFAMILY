# Task preflight

Read the relevant `docs/` and current code, record objective, allowed paths, acceptance criteria, boundaries, risks, required checks, and human steps. Stop on missing functional, architectural, permission, ownership, schema, or security decisions.

Before work starts, identify `allowed_paths`, `authorized_operations`,
`interactive_human_steps`, `hard_stop_conditions`, `required_checks`, and
`acceptance_criteria`. Interactive human steps are the only planned checkpoints
that may return control to the user; deterministic milestones are not handoffs.
