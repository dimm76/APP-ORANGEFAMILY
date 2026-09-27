# Documentation maintenance

Before closing, classify whether the task changes behavior, decisions, architecture, API, data model, permissions/ownership, security, integration, Android, storage, operations, deployment, or development/release workflow. If so, identify and update the existing canonical document in the same task, or record `NO_CHANGE_REQUIRED` with a concrete reason. Use `IMPLEMENTATION_STATUS.md`, `DECISIONS.md`, API, DATABASE, security, Android, UI, and operations documents only when their subject changed; do not duplicate documentation.

`docs-impact.mjs` must produce a deterministic candidate/resolution. Missing required docs, `UPDATED` without a changed canonical document, or `NO_CHANGE_REQUIRED` without evidence fails completion. The docs remain the source of truth; the harness enforces consultation and evidence rather than copying their prose.
