# Shared skills agent instructions

## Task workflow

Load and follow
[`repoledger`](https://github.com/shazhou-ww/repoledger/blob/main/skills/repoledger/SKILL.md)
only when the user explicitly invokes `/repoledger`, or asks to manage an
existing repository task. Then apply the repository profile in
[`docs/repository-tasks.md`](docs/repository-tasks.md). Ordinary implementation
requests remain task-free regardless of which files they change, their size,
or their duration.

- Never create a task automatically. When work would benefit from durable
  coordination, suggest that the user invoke `/repoledger new`, but treat the
  suggestion as neither authorization nor a prerequisite for task-free work.
- After the user invokes `/repoledger new`, create a task only for accepted work that
  will change files outside this repository's `tasks/**`; read-only work,
  validation, external-only operations, and task-ledger maintenance remain
  ineligible.
- Once a task exists, keep managing it until completion, abandonment, or an
  explicit terminal state. The opt-in rule does not release existing work.
- Use `repoledger task list`, `status`, and `check --remote` to read canonical
  state from the configured primary repository and branch before task work.
- Create accepted work at `tasks/<task-name>/Task.md`, publish it with
  `repoledger task register`, and use `repoledger task start` before
  implementation.
- Plan scope, interface, business and data model, architecture, and delivery
  checkpoints in `Task.md`. Scope and delivery approval are always required;
  classify the middle checkpoints for the specific task.
- Treat accepted task work as authorization for routine non-force source-ref
  publication and integration to the configured primary branch; do not ask for
  confirmation solely for those steps.
- Create or update `Progress.md` only in a commit that also changes at least one
  path outside `tasks/**`. Never publish procedural progress-only commits.
- At each applicable human review gate, publish the artifact to primary and
  obtain explicit approval for that immutable commit. Approval alone does not
  require another commit.
- Publish implementation completion and progress evidence together. Manual
  testing does not replace explicit delivery approval.
- After delivery approval for the exact current primary commit, run
  `repoledger task complete <task-name> --approved-commit <commit>`.
- Task paths remain stable. There are no identity lanes, ownership claims,
  handoff moves, or archive moves. Every ongoing task advertises one shared
  source repository and branch for cross-device and cross-person continuation.
- Preserve unrelated work and never force-push.

## Skill boundaries

- Keep generic reusable workflow guidance under `skills/`.
- Keep repository-specific execution state and research under `tasks/`.
- Run `pnpm check` for review-skill and task-ledger validation.
- Validate skill discovery with `pnpm check:skills` after changing a skill's
  frontmatter or structure.
- Do not commit secrets, credentials, tokens, or private customer data.
