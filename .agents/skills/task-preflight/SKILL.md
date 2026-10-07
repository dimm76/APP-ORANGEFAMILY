---
name: task-preflight
description: Build and validate task preflight facts, boundaries, checks, authorizations and acceptance criteria before implementation.
---

# Task preflight

Read the relevant `docs/` and current code, record objective, allowed paths, acceptance criteria, boundaries, risks, required checks, and human steps. Stop on missing functional, architectural, permission, ownership, schema, or security decisions.

Before work starts, identify `base_ref`, immutable `base_sha`, `working_branch`,
`allowed_paths`, `authorized_operations`, any `authorized_repositories`,
`interactive_human_steps`, `hard_stop_conditions`, `required_checks`, and
`acceptance_criteria`. Every authorized repository must declare its Git root,
base ref/SHA, working branch and non-empty allowed paths. Interactive human
steps are the only planned checkpoints that may return control to the user;
deterministic milestones are not handoffs.
