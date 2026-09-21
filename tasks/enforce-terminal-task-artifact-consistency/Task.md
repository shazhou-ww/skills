# Enforce terminal task artifact consistency

Created: 2026-09-21

## Goal

Prevent a repository task from becoming `completed` while its Task acceptance
criteria, Progress lifecycle checklist, or required human approval rows still
record incomplete work.

## Context

A downstream UniCAS task exposed that `repoledger task complete` could publish
a terminal transition while the task artifacts still contained unchecked
acceptance criteria and a pending Delivery acceptance row. Some completed-task
validation is tied to an optional Progress `Outcome: Completed` value instead
of the canonical lifecycle state, so omitting that prose can weaken the
validation applied before publication.

This behavior is owned by the repoledger package rather than by an individual
consumer patch. The originating UniCAS task is being retired in favor of this
package-level implementation task.

## Scope

- Make canonical `completed` state require every Task acceptance criterion to
  be checked for tasks using the current artifact schema, independent of an
  optional Progress Outcome section.
- Require every item in the current-schema Progress lifecycle checklist to be
  checked before a completed state is accepted.
- Require every applicable human review checkpoint, including Delivery
  acceptance, to be `Approved` before completion; preserve valid `Not
  applicable` classifications.
- Make `repoledger task complete` reject the transition before publication when
  acceptance, lifecycle, or approval evidence is unresolved.
- Add isolated temporary-Git-repository tests for unchecked acceptance,
  unchecked Progress lifecycle work, pending required approval, a fully
  reconciled successful completion, and remote validation of the published
  result.
- Keep package documentation and diagnostics aligned with the `completed`
  terminal state; do not introduce an archive lifecycle or command.

## Out of scope

- Changing task states, adding reopen/archive transitions, or rewriting
  existing primary-branch history.
- Automatically checking acceptance criteria, synthesizing approval evidence,
  or treating a Git commit or silence as human approval.
- Reworking legacy terminal tasks that intentionally predate the current human
  review schema.
- Publishing a new npm release or updating downstream consumer dependencies or
  patches; release and adoption are separate delivery steps.

## Acceptance criteria

- [ ] `repoledger check` reports an error for a current-schema completed task
      with any unchecked Task acceptance criterion, even when Progress omits an
      explicit Outcome section.
- [ ] A current-schema completed task fails validation when its Progress
      lifecycle checklist contains an unchecked item or an applicable human
      review checkpoint is not `Approved`.
- [ ] `repoledger task complete` refuses to publish a terminal transition when
      acceptance, lifecycle, or approval evidence is unresolved, leaving the
      canonical task state unchanged.
- [ ] A fully reconciled task with explicit approval of the exact current
      primary commit completes successfully and passes remote validation.
- [ ] Legacy terminal-task compatibility and existing hardened forward-revert
      validation continue to pass without weakening either rule.
- [ ] Focused repoledger fixtures and the complete repository check pass from a
      clean checkout.

## Constraints

- Treat lifecycle state in `tasks/status.yaml` as canonical; optional prose or
  Outcome headings must not weaken terminal validation.
- Keep approval semantic: required checkpoints need explicit `Approved`
  evidence, while genuinely non-applicable checkpoints remain valid only under
  the existing plan and status rules.
- Validate before publication so a failed completion does not require history
  rewriting or a corrective lifecycle commit.
- Preserve repoledger's non-force publication model and existing remote-primary
  concurrency checks.
- Keep validation deterministic and cover behavior with temporary-repository
  fixtures rather than relying on this repository's current task history.

## Human review checkpoints

Task creation records this plan, not approval. Each required checkpoint must be
explicitly approved before its protected step.

| Checkpoint | Applicability | Reviewer | Planned review artifact | Approval required before |
| --- | --- | --- | --- | --- |
| Scope | Required | User or accountable repository owner | This task's validation rules, compatibility exclusions, constraints, and acceptance criteria. | Substantive implementation. |
| Interface | Required | User or accountable repository owner | Proposed completion failures and diagnostics for unresolved terminal artifacts. | Changing CLI-visible validation behavior. |
| Business and data model | Required | User or accountable repository owner | Completed-state invariants for acceptance, lifecycle work, and review evidence, including legacy compatibility. | Changing terminal lifecycle validation. |
| Architecture | Not applicable: this is a narrow validation correction within the existing content-validation and publication boundaries. | Not applicable | Not applicable | Not applicable |
| Delivery acceptance | Required | User or accountable repository owner | Integrated package implementation, isolated completion fixtures, full repository check, and remote validation evidence. | Marking the task completed. |

## References

- [Repoledger content validation](/packages/repoledger/src/content.js)
- [Repoledger publication flow](/packages/repoledger/src/publication.js)
- [Repoledger content tests](/packages/repoledger/test/content.test.js)
- [Repoledger publication tests](/packages/repoledger/test/publication.test.js)
- [Repoledger package documentation](/packages/repoledger/README.md)
- [Repository task workflow](/docs/repository-tasks.md)
- [Originating UniCAS task](https://github.com/shazhou-ww/unicas/blob/main/tasks/enforce-terminal-task-artifact-consistency/Task.md)