# Represent unregistered task directories

Created: 2026-09-20

## Goal

Make repoledger represent task directories without status records as the
derived `unregistered` inventory state instead of diagnostics, while
preserving errors for conditions that make registered ledger state invalid or
ambiguous.

## Context

`repoledger task list --local --state backlog` currently fails when a task
directory has no matching `tasks/status.yaml` record. An unregistered directory
is a normal pre-registration condition and does not prevent the command from
identifying registered backlog tasks. It should therefore appear as
`unregistered` when requested, rather than producing an error or warning.

The current validation surface may contain other diagnostics whose severity is
stricter than the command's ability to produce a trustworthy result requires.
Those cases need a focused audit that distinguishes valid observable states
from malformed or ambiguous canonical state instead of indiscriminately
downgrading errors to warnings.

## Scope

- Discover task directories without status records and expose them as
  read-only inventory entries whose derived state is `unregistered`.
- Allow list and status queries to select and display `unregistered` tasks
  without emitting `task.record.missing` or another warning or error solely
  because the status record is absent.
- Keep `unregistered` outside the persisted lifecycle-state schema and prevent
  it from participating in lifecycle transitions other than registration.
- Define and apply a consistent classification rule: valid observable
  conditions belong in command results, while diagnostics describe malformed,
  contradictory, unsafe, or insufficient state.
- Audit existing layout, status, and content diagnostics for clearly similar
  over-strict cases and remodel only those that have a meaningful observable
  state and focused test coverage.
- Update CLI documentation and focused tests for affected text and JSON output,
  filtering behavior, and exit status.

## Out of scope

- Automatically registering or deleting unexpected task directories.
- Weakening lifecycle transition preconditions or allowing mutations from
  malformed, contradictory, stale, or ambiguous canonical state.
- Adding `unregistered` to the persisted task status schema or changing the
  four lifecycle states, stable directory layout, or Git publication protocol.
- Reclassifying diagnostics merely to make checks pass without demonstrating
  that the requested result remains trustworthy.

## Acceptance criteria

- [ ] `repoledger task list --local --state backlog` returns the registered
  backlog tasks and exits successfully when unregistered directories are
  present, without emitting diagnostics for those directories.
- [ ] List filtering accepts `unregistered`, and list and status output expose
  matching directories with `state: unregistered` in text and JSON results.
- [ ] Unregistered entries do not receive fabricated creation or update
  timestamps; time filtering and sorting behavior is documented and
  deterministic when registered and unregistered entries are combined.
- [ ] Local and remote checks accept an unregistered directory as a valid
  pre-registration condition, while registration remains the only operation
  that can add it to the canonical status ledger.
- [ ] Every existing layout, status, and content diagnostic is reviewed against
  the classification rule; each additional result-state change is documented
  and covered by focused positive and negative tests, or the audit records that
  no additional case qualifies.
- [ ] Malformed YAML, invalid task records, duplicate or contradictory facts,
  unsafe paths, and state that prevents a trustworthy result remain errors and
  continue to produce a failing exit status.
- [ ] Human-readable and JSON output preserve diagnostic codes, levels, paths,
  and remediation for actual diagnostics, while valid unregistered state is
  represented only in command results.
- [ ] Focused repoledger tests and the repository-wide `pnpm check` pass.

## Constraints

- Base classification on whether the condition is a valid domain state and
  whether the requested operation can produce a trustworthy result.
- Preserve backward-compatible diagnostic codes and remediation text for
  conditions that remain diagnostics.
- Keep mutation validation strict where observing unregistered state would
  otherwise permit an unsafe or ambiguous state change.
- Keep the audit bounded to existing repoledger diagnostics; new repair or
  suppression features require separate scope.

## Human review checkpoints

Task creation records this plan, not approval. Scope alignment and delivery
acceptance are always required for completed work.

| Checkpoint | Applicability | Reviewer | Planned review artifact | Approval required before |
| --- | --- | --- | --- | --- |
| Scope | Required | User | Goal, derived-state rule, audit boundary, exclusions, constraints, and acceptance criteria in this task. | Substantive implementation. |
| Interface | Required | User | Proposed text and JSON forms plus filtering, sorting, status-query, and exit behavior for `unregistered`. | Changing CLI-visible inventory behavior. |
| Business and data model | Required | User | Distinction between persisted lifecycle states and the derived `unregistered` inventory state, including allowed operations. | Implementing state discovery and filtering. |
| Architecture | Assess during execution: required if derived-state support moves discovery responsibility or introduces a shared state abstraction. | User | Proposed module and type boundary changes, if the implementation cannot remain within existing layout and status responsibilities. | Restructuring validation or state-query modules. |
| Delivery acceptance | Required | User | Published implementation, over-strict validation audit results, and validation evidence. | Running `task complete` for the exact approved primary commit. |

## References

- [Repoledger layout validation](/packages/repoledger/src/layout.js)
- [Repoledger command reporting](/packages/repoledger/src/cli.js)
- [Repoledger check tests](/packages/repoledger/test/check.test.js)
- [Repoledger package documentation](/packages/repoledger/README.md)