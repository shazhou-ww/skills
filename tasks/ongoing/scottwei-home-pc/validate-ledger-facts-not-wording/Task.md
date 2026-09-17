# Validate ledger facts, not wording

Created: 2026-09-17

## Goal

Make repoledger validate task facts and lifecycle invariants without rejecting
clear human annotations or duplicating Git lifecycle history in `Progress.md`.

## Context

Repoledger 0.6.0 compares several Markdown cells and sections with exact words,
punctuation, or phrases. For example, `Pending — artifact ready` is rejected as
an invalid human approval status even though its canonical state is clear.
Other checks infer protocol facts from checklist wording, outcome punctuation,
and acceptance phrases; the acceptance check can also mistake `Not Accepted`
for acceptance.

`Progress.md` additionally repeats claim, implementation-complete, and archive
publication milestones even though repository position and Git history are the
authoritative lifecycle record. Maintaining that table adds opportunities for
stale or circular self-reported evidence.

## Scope

- Parse canonical human approval and review applicability facts separately
  from optional human-readable annotations.
- Replace brittle outcome, checklist, placeholder, and user-acceptance phrase
  checks with validation of explicit facts and invariants.
- Prevent negated or ambiguous acceptance text from satisfying acceptance.
- Remove `Publication milestones` from the current `Progress.md` contract,
  templates, generated progress, validation, diagnostics, and documentation.
- Preserve lifecycle publication requirements in Git-backed workflow guidance
  without requiring duplicate milestone rows in task artifacts.
- Add positive paraphrase and annotation tests plus negative unknown-state,
  ambiguity, and negation tests for each changed parser boundary.

## Out of scope

- Changing the backlog, ongoing, and archived directory lifecycle.
- Removing the separate claim, implementation-complete, and archive
  integrations required by the repository workflow.
- Fetching remotes from `check`, `doctor`, or content validation.
- Rewriting archived task records solely to match the new template.
- Accepting arbitrary text when a canonical fact cannot be parsed reliably.

## Acceptance criteria

- [ ] Human approval values such as `Pending — artifact ready` resolve to the
  canonical `Pending` state while unknown or ambiguous states remain errors.
- [ ] Review applicability, outcome, checklist, placeholder, and user
  acceptance checks enforce their underlying facts without requiring template
  punctuation or exact explanatory phrases.
- [ ] Negated acceptance such as `Not Accepted` cannot satisfy a completed
  task's acceptance requirement.
- [ ] Current `Progress.md` files no longer require or generate a `Publication
  milestones` section, and milestone diagnostics are removed.
- [ ] Existing archived records remain readable without using milestone wording
  to infer their schema or lifecycle state.
- [ ] Templates, repository-task-ledger guidance, repoledger documentation, and
  tests consistently identify Git history and task position as lifecycle truth.
- [ ] Focused repoledger tests and the repository-wide `pnpm check` pass.

## Constraints

- Keep strict validation for actual protocol fields, including task position,
  identity, checkpoint identity, known canonical states, and path safety.
- Preserve compatibility with existing canonical 0.6.0 task documents during
  migration and avoid requiring edits to archived history.
- Keep validation local and deterministic; remote publication verification
  remains a workflow responsibility outside content parsing.
- Separate parsing and normalization from invariant checks so annotations do
  not silently weaken approval, acceptance, or lifecycle gates.

## Human review checkpoints

Task creation records this plan, not approval. Scope alignment and delivery
acceptance are always required for completed work.

| Checkpoint | Applicability | Reviewer | Planned review artifact | Approval required before |
| --- | --- | --- | --- | --- |
| Scope | Required | User | Goal, scope, boundaries, constraints, and acceptance criteria in this task. | Substantive implementation. |
| Interface | Required | User | Proposed accepted Markdown forms, canonical parsing rules, diagnostics, and compatibility behavior. | Changing CLI-visible validation behavior. |
| Business and data model | Required | User | Revised `Task.md`, `Progress.md`, and `UserAcceptance.md` facts and source-of-truth model. | Changing task artifact validation and templates. |
| Architecture | Required | User | Parsing boundaries and the division of responsibility between Git history, task position, and Markdown content. | Restructuring content validation and transition generation. |
| Delivery acceptance | Required | User | Published implementation, migration behavior, documentation, and complete validation evidence. | Marking the task completed and archiving it. |

## References

- [Repoledger content validation](/packages/repoledger/src/content.js)
- [Progress template](/skills/repository-task-ledger/assets/Progress.md)
- [Repository task profile](/tasks/README.md)