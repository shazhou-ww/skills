# Progress

Updated: 2026-09-15

## Checklist

- [x] Confirm and remove the observed stale empty task directories.
- [x] Create and claim this focused lifecycle task.
- [x] Add source-directory cleanup requirements to task moves.
- [x] Tighten structural validation guidance for empty stale directories.
- [x] Validate skill discovery, links, layout, and diff hygiene.
- [x] Publish the implementation in commit `927f84d`.
- [x] Archive this completed task.

## Current state

The stale `adopt-repository-task-ledger` directories under backlog and ongoing,
and the stale `define-task-admission-boundary` backlog directory, were empty
and have been removed without recursive deletion. The skill now makes source
directory absence an explicit postcondition of every task move, and the
adoption guide treats empty task-position directories as invalid. Commit
`927f84d` is published on `origin/main`, and this task is now in its canonical
archive location. This progress record is the task's final lifecycle state.

## Decisions

- State the cleanup rule once as a common postcondition and reference it from
  each move path rather than duplicating detailed cleanup instructions.
- Treat every non-hidden directory in a task position as a task candidate so
  structural validation catches empty stale directories.
- Complete this focused lifecycle change before resuming
  `define-task-admission-boundary`, because both tasks edit the skill and its
  adoption guide.

## Validation

- Non-recursive removal completed successfully, proving the three stale
  directories contained no files or child directories.
- A follow-up path check found no stale directories and preserved the backlog
  and identity `.gitkeep` files plus the active admission-boundary claim.
- The focused lifecycle assertion printed `TASK_MOVE_GUIDANCE_OK`.
- The complete task-layout and link check printed
  `LEDGER_STRUCTURE_OK tasks=4`.
- `npx skills add . --list` discovered `repository-task-ledger`.
- Editor diagnostics and `git diff --check` reported no errors.
- The combined release check printed `PREPUBLISH_CHECK_OK` after validating
  unique task positions, local links, and the registered worktree identity.
- The post-move checks printed `TASK_ARCHIVE_MOVE_OK` and `ARCHIVED_TASKS_OK`,
  confirming complete archive artifacts, absent source directories, completed
  checklists, and resolving links.

## Blockers

- None.

## Outcome

Completed. Task moves now require destination verification, source-directory
cleanup, and a unique-position check that includes empty directories. The
implementation is published in commit `927f84d`.