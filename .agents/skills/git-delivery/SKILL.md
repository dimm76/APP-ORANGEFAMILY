---
name: git-delivery
description: Apply OrangeFamily Git delivery rules for selective staging, scoped commits, authorized pushes and protected main integration.
---

# Git delivery

Use selective staging only. Normal delivery is clean base -> feature branch -> checks -> scoped commit -> authorized feature push -> review. Never reset, clean, force-push, or push main through a normal task.

If the Task Contract explicitly authorizes `git.push_main`, review is approved,
mandatory checks pass, the branch is ahead with behind=0, and fast-forward is
possible, perform `pull --ff-only`, `merge --ff-only`, and `push main` directly
without an intermediate handoff. Keep reset, `clean -fd`, unrequested rebase,
force push, and unauthorized amend prohibited.
