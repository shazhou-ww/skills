# Progress

Updated: 2026-09-15

## Checklist

- [x] Publish the claim to the shared primary branch.
- [x] Commit and publish substantive work at meaningful checkpoints.
- [x] Publish implementation completion while the task is still ongoing.
- [x] Complete documented user acceptance, if required. Not required because
  every acceptance criterion is agent-verifiable.
- [x] Archive and publish the task as its final action.

## Current state

Claim commit `844b0e1` and implementation commit `17027a5` are published on
`origin/main`. The two user-facing entry skills are implemented and validated,
the protocol core is hidden from command menus that honor `user-invocable`, and
repository documentation explains the complete installation and compatibility
boundary. Every acceptance criterion passes, and this final record accompanies
the task's archive commit on `origin/main`.

## Decisions

- Keep `repository-task-ledger` as the single authoritative protocol and add
  `task-new` and `task-exec` as small intent-specific Agent Skills.
- Use Agent Skills rather than client-specific prompt files so the entry points
  remain portable across skills-compatible agents.
- Treat entry-to-core composition as a model-mediated contract because the
  Agent Skills specification does not enforce dependencies between skills.
- No manual user acceptance is required; discovery, routing contracts,
  documentation, links, and repository state can all be validated locally.

## Publication milestones

| Milestone | Evidence | Status |
| --- | --- | --- |
| Claim | Commit `844b0e1` on `origin/main`. | Complete |
| Implementation complete | Commit `17027a5` on `origin/main`. | Complete |
| Archive | This final archive commit on `origin/main`; its immutable ID is the commit containing this row. | Complete |

## Validation

- Refreshed `origin/main` at `ae41fa2e9d74ae22eb42cbedf03c81a8a59cfbac`
  and confirmed local `HEAD` matched before the claim.
- Verified `extensions.worktreeConfig=true`, the worktree-scoped identity is
  `scottwei-office-pc`, and its registration exists on `origin/main`.
- Inspected all backlog and ongoing tasks; `add-task-entry-skills` was the only
  active task and appeared only in backlog before the claim.
- Verified the moved task contains `Task.md`, its backlog source directory no
  longer exists, and it now has exactly one ledger position.
- Verified claim commit `844b0e1` is reachable from refreshed `origin/main`,
  both task artifacts exist in the identity lane on that branch, and the
  backlog source is absent.
- `npx skills use . --skill task-new` printed `TASK_NEW_ROUTE_VALID` after
  verifying the generated prompt loads the core protocol, checks active work,
  gates backlog admission, and stops before execution.
- `npx skills use . --skill task-exec` printed `TASK_EXEC_ROUTE_VALID` after
  verifying unique resolution, backlog, current-owner, other-owner, and archive
  routes, plus the completion boundary.
- `npx skills add . --list` printed `THREE_SKILL_DISCOVERY_VALID` and listed
  exactly `repository-task-ledger`, `task-new`, and `task-exec`.
- Contract assertions loaded all three skills independently, confirmed both
  entry skills fail closed without the core, and found no copied identity,
  Git-move, user-acceptance-file, or identity-marker details in either entry.
- Documentation assertions confirmed README and adoption guidance install all
  three skills together and describe model-mediated dependencies and
  client-specific slash presentation.
- The root-aware Markdown check resolved every local link, expected-path checks
  found only the six implementation and progress files, and `git diff --check`
  reported no errors.
- Editor diagnostics reported no errors in the core, both entry skills,
  adoption guide, README, task, or progress record.
- Verified implementation commit `17027a5` is the refreshed `origin/main` tip,
  both entry skills and ongoing task evidence exist there, the core has
  `user-invocable: false`, and no premature archive existed in that milestone.
- The archive move check found both task artifacts in the archive, confirmed
  the ongoing source directory is absent, found exactly one canonical task
  position, and preserved the `scottwei-office-pc` identity marker.

## Blockers

- None.

## Outcome

Completed. Users now have portable `task-new` and `task-exec` intent entry
skills backed by one authoritative `repository-task-ledger` protocol, with
fail-closed composition and documented cross-agent presentation limits.