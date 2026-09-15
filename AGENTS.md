# Shared skills agent instructions

## Task workflow

Load and follow
[`repository-task-ledger`](skills/repository-task-ledger/SKILL.md) only when
the user explicitly invokes `task-new`, invokes `task-exec`, or asks to manage
an existing repository task. Then apply the repository profile in
[`tasks/README.md`](tasks/README.md). Ordinary implementation requests remain
task-free regardless of which files they change, their size, or their duration.

- Never create a task automatically. When work would benefit from durable
  coordination, suggest that the user invoke `task-new`, but treat the
  suggestion as neither authorization nor a prerequisite for task-free work.
- After the user invokes `task-new`, create a task only for accepted work that
  will change files outside this repository's `tasks/**`; read-only work,
  validation, external-only operations, and task-ledger maintenance remain
  ineligible.
- Once a task exists, keep managing it until completion, abandonment, or an
  explicit handoff. The opt-in rule does not release existing task ownership.
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

## npm releases

- Before preparing, tagging, rerunning, or troubleshooting a package release,
  read and follow the canonical
  [`npm package release guide`](docs/npm-package-releases.md).
- Publish only through `.github/workflows/publish-npm.yml` by pushing an
  authorized `npm/<release-key>/v<version>` tag whose commit is on
  `origin/main` and whose version exactly matches the selected package
  manifest.
- Do not publish from a development machine or add `NPM_TOKEN` or
  `NODE_AUTH_TOKEN` secrets. npm authentication uses the `npm` GitHub
  environment and OIDC trusted publishing.
- Treat npm versions and release tags as immutable. Rerun the same workflow
  only for transient infrastructure failures; source or validation fixes
  require a new committed version and a new tag.

## Skill boundaries

- Keep generic reusable workflow guidance under `skills/`.
- Keep repository-specific execution state and research under `tasks/`.
- Run `pnpm check` for CLI, configuration, and task-ledger validation.
- Validate skill discovery with `pnpm check:skills` after changing a skill's
  frontmatter or structure.
- Do not commit secrets, credentials, tokens, or private customer data.