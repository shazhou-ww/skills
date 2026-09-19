# Progress

Updated: 2026-09-19

## Current state

Implementation is complete in the current candidate: repoledger uses strict
YAML and stable task paths, queries and mutations operate against primary, the
skills enforce implementation-linked progress, and all 15 repository tasks are
migrated. Publish and verify this candidate, then request delivery acceptance.

## Decisions

- Keep the storage model, use cases, and command design as task-specific review
  artifacts in this task directory rather than stable project documentation.
- Expose task inventory through `repoledger task list`, with repeatable state
  filters, creation and update time windows, sorting, and a result limit.
- Do not store or manage a task source branch. Primary is the authoritative
  collaboration, review, and completion target; optional contributor branches
  remain outside repoledger.
- Admit tasks only for accepted changes outside the configured task directory.
  Update `Progress.md` only in the same publication as those implementation
  changes; do not create commits for procedural narration alone.
- Transfer ownership to the current worktree identity, `scottwei-home-pc`,
  without changing the approved review surface or bypassing pending approvals.
- Do not publish the consolidated `docs/task-collaboration-workflow.md` draft.
  Replace it with the three focused storage-model, use-case, and command-design
  documents requested by the user.
- Treat `tasks/status.yaml` and task artifacts on the remote primary branch as
  canonical state, and keep task directories stable for their full lifetime.
- Refocus repoledger on read-only queries and validated state transitions. Task
  mutations own fetch, isolated commit construction, non-force primary push,
  post-publication verification, and structured conflict reporting.
- Preserve historical terminal task narratives while updating only links that
  changed because of the one-time stable-path migration.

## Human approvals

| Checkpoint | Status | Review artifact and decision evidence |
| --- | --- | --- |
| Scope | Approved | User approved the scope and acceptance contract at commit `529e93a` on 2026-09-19. |
| Business and data model | Approved | User approved the branchless status records, artifact rules, lifecycle, timestamps, and migration at commit `529e93a` on 2026-09-19. |
| Interface | Approved | User approved the task-list filters, reports, examples, primary-only Git effects, idempotency, and failures at commit `529e93a` on 2026-09-19. |
| Architecture | Approved | User approved primary-only collaboration, isolated publication, and implementation-linked progress updates at commit `529e93a` on 2026-09-19. |
| Delivery acceptance | Pending | Review Published implementation, migrated repository, validation evidence, and final diff against the approved designs. with User. |

## Validation

- `pnpm check` passed: 36 repoledger tests, package allowlist and installed
  tarball smoke checks, 12 release tests, 4 review-skill tests, and the complete
  migrated 15-task ledger check.
- Real bare-remote tests cover init, register/start/complete publication,
  idempotent retries, approved-commit binding, caller dirt preservation, and
  rejection of bookkeeping-only Progress history.
- `pnpm check:skills` discovered all six repository skills, including the
  revised task entry and core lifecycle skills.
- Local ledger validation found all 15 stable task directories and records,
  with only historical legacy-format info and the expected pending delivery
  warning for this task.
- Package checks produced a 16-file tarball and passed installation, exports,
  help, local check, and task-list smoke tests.
- VS Code diagnostics and `git diff --check` passed for active source,
  instructions, skills, and repository documentation.

## Blockers

- Delivery acceptance is required for the published implementation commit.

## Outcome

Implementation complete; delivery acceptance pending.
