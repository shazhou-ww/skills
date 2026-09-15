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
- Inspect all active claims and backlog tasks before creating or claiming work.
- Create accepted work in `tasks/backlog/<task-name>/Task.md`, then move the
  whole folder under `tasks/ongoing/<identity>/` and add `Progress.md` before
  implementation.
- Publish claims before substantial implementation, keep Progress current, and
  move completed or abandoned work to `tasks/archived/`.
- Preserve unrelated work and never copy one task into multiple locations.

## Skill boundaries

- Keep generic reusable workflow guidance under `skills/`.
- Keep repository-specific execution state and research under `tasks/`.
- Validate skill discovery with `npx skills add . --list` after changing a
  skill's frontmatter or structure.
- Do not commit secrets, credentials, tokens, or private customer data.