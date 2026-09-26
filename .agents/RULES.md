# OrangeFamily agent rules

- Apply the minimum change. Do not refactor unrelated code, add speculative abstractions, add dependencies, or duplicate logic.
- Read canonical documentation and current code before relying on assumptions.
- Reuse existing components, helpers, hooks, services, endpoints, middleware, and utilities before creating new ones.
- React and Android are untrusted clients. Node validates input, authentication, authorization, family membership, module access, ownership, resource access, and response fields.
- Full technical access is not authority. Authority is `Task Contract -> allowed_paths -> authorized_operations -> gates`.
- The agent runs Git, tests, lint, builds, local HTTP checks, and diff inspection itself. Human intervention is reserved for decisions, secrets, MFA/OAuth/captcha, non-automatable visual checks, hardware, production, and destructive actions.
- Changes under `mobile/orange-photos-sync-agent/**` activate Android rules. API contract changes review both React and Android consumers.
