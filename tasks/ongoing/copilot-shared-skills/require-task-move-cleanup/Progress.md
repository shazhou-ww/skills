# Progress

Updated: 2026-09-15

## Checklist

- [x] Confirm and remove the observed stale empty task directories.
- [x] Create and claim this focused lifecycle task.
- [x] Add source-directory cleanup requirements to task moves.
- [x] Tighten structural validation guidance for empty stale directories.
- [x] Validate skill discovery, links, layout, and diff hygiene.
- [ ] Publish the implementation and archive this task.

## Current state

The stale `adopt-repository-task-ledger` directories under backlog and ongoing,
and the stale `define-task-admission-boundary` backlog directory, were empty
and have been removed without recursive deletion. The skill now makes source
directory absence an explicit postcondition of every task move, and the
adoption guide treats empty task-position directories as invalid. The next
action is to publish these changes and archive this task.

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

## Blockers

- Publishing requires an explicitly authorized commit and push.

## Outcome

In progress. Implementation and local validation are complete; publication
and archival remain.