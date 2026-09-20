# Relax nonblocking ledger diagnostics

Created: 2026-09-20

## Goal

Make repoledger report recoverable local task-layout drift as warnings when it
can still produce a trustworthy command result, while preserving errors for
conditions that make ledger state invalid or ambiguous.

## Context

`repoledger task list --local --state backlog` currently fails when a task
directory has no matching `tasks/status.yaml` record. An unregistered directory
does not prevent the command from identifying registered backlog tasks, so the
`task.record.missing` diagnostic should inform the user without making the
listing fail.

The current validation surface may contain other diagnostics whose severity is
stricter than the command's ability to produce a trustworthy result requires.
Those cases need a focused audit using the same distinction between recoverable
drift and invalid or ambiguous canonical state.

## Scope

- Reclassify `task.record.missing` as a warning for read-only local listing and
  checking where registered task results remain trustworthy.
- Define and apply a consistent severity rule: warnings describe recoverable
  repository drift that does not invalidate the requested result; errors
  describe malformed, contradictory, unsafe, or insufficient canonical state.
- Audit existing layout, status, and content diagnostics for clearly similar
  over-strict cases and reclassify only those supported by focused tests.
- Keep warning diagnostics visible with actionable remediation while allowing
  commands containing warnings but no errors to succeed.
- Update CLI documentation and focused tests for affected text and JSON output,
  filtering behavior, and exit status.

## Out of scope

- Automatically registering or deleting unexpected task directories.
- Weakening lifecycle transition preconditions or allowing mutations from
  malformed, contradictory, stale, or ambiguous canonical state.
- Changing the task status schema, lifecycle states, stable directory layout,
  or Git publication protocol.
- Reclassifying diagnostics merely to make checks pass without demonstrating
  that the requested result remains trustworthy.

## Acceptance criteria

- [ ] `repoledger task list --local --state backlog` reports each task directory
  without a status record as `WARNING task.record.missing`, returns the valid
  registered backlog results, and exits successfully when no error remains.
- [ ] Local and remote checks use the documented severity rule consistently,
  without allowing an unregistered directory to participate as a registered
  task or lifecycle transition target.
- [ ] Every existing layout, status, and content diagnostic is reviewed against
  the severity rule; each additional reclassification is documented and
  covered by a focused positive and negative test, or the audit records that no
  additional case qualifies.
- [ ] Malformed YAML, invalid task records, duplicate or contradictory facts,
  unsafe paths, and state that prevents a trustworthy result remain errors and
  continue to produce a failing exit status.
- [ ] Human-readable and JSON output preserve diagnostic codes, levels, paths,
  and remediation, and warning-only reports have a successful result contract.
- [ ] Focused repoledger tests and the repository-wide `pnpm check` pass.

## Constraints

- Base severity on whether the requested operation can produce a trustworthy
  result, not on whether remediation is optional or convenient.
- Preserve backward-compatible diagnostic codes and remediation text unless a
  clearer message is required by a reclassified case.
- Keep mutation validation stricter where a warning-level read operation would
  otherwise permit an unsafe or ambiguous state change.
- Keep the audit bounded to existing repoledger diagnostics; new repair or
  suppression features require separate scope.

## Human review checkpoints

Task creation records this plan, not approval. Scope alignment and delivery
acceptance are always required for completed work.

| Checkpoint | Applicability | Reviewer | Planned review artifact | Approval required before |
| --- | --- | --- | --- | --- |
| Scope | Required | User | Goal, severity rule, audit boundary, exclusions, constraints, and acceptance criteria in this task. | Substantive implementation. |
| Interface | Required | User | Proposed diagnostic severity matrix and examples of text output, JSON output, result availability, and exit status for affected commands. | Changing CLI-visible diagnostic behavior. |
| Business and data model | Not applicable: task records, lifecycle states, schemas, and persistence semantics do not change. | Not applicable | Not applicable | Not applicable |
| Architecture | Not applicable: the change remains within existing validation and diagnostic boundaries. | Not applicable | Not applicable | Not applicable |
| Delivery acceptance | Required | User | Published implementation, diagnostic audit results, and validation evidence. | Running `task complete` for the exact approved primary commit. |

## References

- [Repoledger layout validation](/packages/repoledger/src/layout.js)
- [Repoledger command reporting](/packages/repoledger/src/cli.js)
- [Repoledger check tests](/packages/repoledger/test/check.test.js)
- [Repoledger package documentation](/packages/repoledger/README.md)