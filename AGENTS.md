# Shared skills agent instructions

## Task workflow

For accepted work expected to add, modify, rename, or delete repository files
outside this repository's `tasks/**`, and when managing an existing repository
task, load and follow
[`repository-task-ledger`](skills/repository-task-ledger/SKILL.md). Then apply
the repository profile in [`tasks/README.md`](tasks/README.md).

- Do not create a task solely to learn or use the skill, perform read-only
  work, run validation, operate external systems, or maintain `tasks/**`.
- If task-free work discovers a required edit outside this repository's
  `tasks/**`, stop before that edit and create or claim accepted work.
- Resolve identity only from the worktree-scoped Git key
  `task-ledger.identity`; verify its `.gitkeep` lane on `origin/main`.
- When workspace dependencies are available, run
  `pnpm exec repoledger doctor` for deterministic identity and ledger checks
  before task work; do not treat offline mode as a fresh remote check.
- Inspect all active claims and backlog tasks before creating or claiming work.
- Create accepted work in `tasks/backlog/<task-name>/Task.md`, then move the
  whole folder under `tasks/ongoing/<identity>/` and add `Progress.md` before
  implementation.
- Treat accepted task work as authorization for routine non-force commits and
  pushes to `origin/main`; do not ask for confirmation solely for those steps.
- Publish the claim before substantial implementation, then commit and publish
  meaningful validated checkpoints with current `Progress.md` evidence.
- Publish implementation completion while the task remains ongoing. If manual
  user acceptance is required, include `UserAcceptance.md` and wait for the
  documented result without archiving.
- After all acceptance passes, move the task to `tasks/archived/` and publish
  that move as a separate final commit. Completed tasks require at least claim,
  implementation-complete, and archive commits on `origin/main`.
- Preserve unrelated work and never copy one task into multiple locations.

## Skill boundaries

- Keep generic reusable workflow guidance under `skills/`.
- Keep repository-specific execution state and research under `tasks/`.
- Run `pnpm check` for CLI, configuration, and task-ledger validation.
- Validate skill discovery with `pnpm check:skills` after changing a skill's
  frontmatter or structure.
- Do not commit secrets, credentials, tokens, or private customer data.