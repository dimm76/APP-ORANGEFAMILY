---
name: autonomous-task
description: Route complex implementation requests into the supervised autonomous Task Contract and bootstrap workflow.
---

# Autonomous task

Use this skill when the current user request clearly needs supervised end-to-end execution rather than a normal single Codex turn.

## Semantic trigger

Activation is semantic. Never require magic words, delimiters, or a literal START/END envelope.

Use this workflow when the request itself establishes a terminal implementation objective and autonomous continuity is materially useful, for example when one or more of these are true:

- the user explicitly asks to continue until the objective is complete, verified, working end-to-end, or otherwise not to stop at intermediate milestones;
- the task is a substantial implementation, migration, investigation-plus-fix, or multi-step change with dependent phases;
- completion requires implementation plus several deterministic checks, review/recovery cycles, or coordinated changes across multiple parts of the same repository;
- the user provides a plan/spec with acceptance outcomes that should be driven to completion;
- the task is long enough that a normal Codex turn may finish before the objective is actually satisfied.

Do not activate merely because the prompt is long. Do not activate for explanation-only requests, analysis without implementation, tiny/local edits, wording/documentation-only changes, one deterministic command, or tasks that already require an immediate human decision before implementation can begin.

Words such as START, END, "de principio a fin", "hasta completar" or "no pares" may be evidence of intent, but none is required and none is a parser-level trigger.

Do not recurse: prompts beginning with `SUPERVISED AUTONOMOUS RUN` or `AUTO_CONTINUE` belong to an already active supervisor and must never start another bootstrap.

## Responsibility of the entry turn

The entry Codex turn is bootstrap/Lead only. It must not implement the requested feature first and then attempt to wrap the remaining work in the supervisor.

It must:

1. review the relevant project documentation and current code;
2. perform task preflight and identify any real missing decision;
3. derive the smallest safe Task Contract;
4. write the bootstrap inputs under `.agent-runtime/<task-id>/` in the current checkout;
5. invoke the protected repository bootstrap;
6. stay attached to that process until COMPLETE or a real terminal stop;
7. report the terminal result.

The entry turn must not create worktrees or agent branches with free-form Git commands. `.codex/autonomous-bootstrap.mjs` owns that operation deterministically.

## Local bootstrap authorization

Routing a request into this autonomous workflow authorizes only the reversible local preparation needed to execute the already-requested implementation:

- read repository documentation/code and Git state;
- write `.agent-runtime/<task-id>/prompt.md` and `task-contract.json`;
- invoke the repository-owned bootstrap;
- let that bootstrap create an isolated `.agent-worktrees/<task-id>` worktree inside the current checkout and an `agent/<task-id>` branch;
- execute deterministic local checks and in-scope recovery through the supervisor.

It does not implicitly authorize:

- commit or push;
- merge/push to `main`;
- deploy, release or tags;
- production/VPS operations;
- production database writes or migrations;
- destructive/force Git;
- new dependencies;
- architecture changes;
- functional decisions not present in the request/docs;
- scope expansion.

Complexity is not authorization. If the requested outcome requires one of those decisions and the user's request did not already authorize it, record the missing decision/authorization and HARD_STOP instead of guessing.

If the user explicitly requested an architecture change, dependency addition, or another normally restricted operation, preserve that authorization in the Task Contract only to the extent allowed by the existing unattended supervisor. Operations the supervisor itself forbids remain outside the unattended loop.

## Preflight before bootstrap

Apply the normal `task-preflight` skill. Review relevant `docs/` and current code first. Resolve repository facts yourself instead of asking the user for information that can be inspected safely.

Derive and record:

- `task_id` in kebab-case;
- `objective`;
- `base_ref` equal to the current named source branch;
- immutable `base_sha` equal to that branch's current HEAD;
- `working_branch: "agent/<task-id>"`;
- non-empty minimal `allowed_paths`;
- independently verifiable `acceptance_criteria`;
- `semantic_boundaries` when productive provider/consumer evidence is required;
- `out_of_scope`;
- `change_types`;
- `required_checks`;
- `authorized_operations`;
- `visual_validation`;
- `hard_stop_conditions`;
- `interactive_human_steps`;
- `required_docs`;
- `risk`;
- `requires_security_review`;
- initial `state: "AUTO_CONTINUE"`.

Do not broaden `allowed_paths` merely to make the task easier. Do not invent files, endpoints, schema, components, dependencies, permissions, ownership rules or authorizations.

The automatic bootstrap is single-repository. If the task genuinely requires another repository, HARD_STOP and request explicit multi-repository preparation instead of silently expanding capability. The external supervisor itself retains its existing explicit multi-repository support.

## Source checkout requirements

Preserve the user's active checkout. Never discard, stash, clean, reset, overwrite or absorb unrelated changes.

The protected bootstrap requires the source checkout to have no tracked modifications. Ignored/untracked files outside the runtime do not authorize reading or modifying them.

Use the current named source branch as `base_ref` and its exact HEAD as `base_sha`. For normal OrangeFamily work this will usually be the synchronized local `main`; when validating an entrypoint feature before integration it may be that clean feature branch instead.

Never set `main` as `working_branch`.

## Bootstrap inputs

In the current checkout create only:

`.agent-runtime/<task-id>/prompt.md`
: Preserve the user's actual request as the terminal objective. Do not require or strip START/END delimiters.

`.agent-runtime/<task-id>/task-contract.json`
: Must conform to `.codex/task-contract.schema.json` and reflect the completed preflight.

Do not create the target worktree manually. Do not implement the requested feature in the source checkout.

## Protected launch

From the repository root run exactly:

```powershell
node .codex/autonomous-bootstrap.mjs `
  --prompt-file .agent-runtime/<task-id>/prompt.md `
  --contract .agent-runtime/<task-id>/task-contract.json
```

The bootstrap validates repository root, immutable base SHA, clean tracked source, task id, branch name, scope prerequisites and deterministic target path. It then creates the isolated worktree/agent branch, copies runtime inputs and launches `scripts/ai/autonomous-run.mjs`.

After launch, do not start a second independent implementation thread. The external supervisor owns continuity and must preserve/resume its Codex thread until a terminal state.

## Terminal behavior

- Exit 0 / `COMPLETE`: report completed scope, evidence/checks, modified files and explicitly excluded delivery steps.
- `HARD_STOP`: return the exact missing human decision/authorization or concrete risk with evidence.
- Operational limits/recovery exhaustion: report the supervisor's latest state/evidence; do not silently fall back to ordinary one-turn execution.
- Never reinterpret `CONTINUE` as completion.

The entry turn must remain attached to the bootstrap/supervisor invocation until terminal. Do not tell the user to manually run the bootstrap or `npm run agent:run`.
