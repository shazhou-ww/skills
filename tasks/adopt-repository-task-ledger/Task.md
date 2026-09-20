# Adopt the repository task ledger

Created: 2026-09-15

## Goal

Configure the shared skills repository to maintain accepted implementation
state under a repository-owned `tasks/` ledger.

## Context

The repository owns the `repository-task-ledger` source but did not yet use the
workflow itself. Canonical task directories and the `copilot-shared-skills`
identity reservation now exist, and this worktree is bound to that identity.

## Scope

- Add repository-level agent instructions requiring the local task-ledger
  skill for admitted work and existing tasks.
- Add a skills-repository task profile documenting admission, identity,
  lifecycle, and validation expectations.
- Record the current adoption and admission-boundary work under the registered
  identity lane.
- Verify the task layout, local identity source, links, and repository state.

## Out of scope

- Completing the admission-boundary semantic refinement.
- Adding an external issue tracker or deployment workflow.
- Changing the task-ledger lifecycle beyond repository-specific adoption.

## Acceptance criteria

- [x] `AGENTS.md` requires the local skill for work expected to modify files
      outside this repository's `tasks/**` and for existing task lifecycle work.
- [x] `tasks/README.md` documents this repository's admission and identity
      profile.
- [x] The worktree identity resolves from worktree-scoped Git config to a lane
      registered on `origin/main`.
- [x] Current accepted work exists in exactly one canonical task location.
- [x] Task links and repository diff hygiene validate.

## Constraints

- Do not create a task for skill learning, read-only work, or changes confined
  to this repository's `tasks/**`.
- Preserve the published shared skill history and unrelated changes.
- Keep project-specific policy concise; the local skill owns the generic
  lifecycle.

## References

- [Repository task ledger skill](../../skills/repoledger/SKILL.md)
- [Project adoption guide](../../skills/repoledger/references/adoption.md)