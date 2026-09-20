# Progress

Updated: 2026-09-20

## Current state

Implementation and agent-verifiable acceptance criteria are complete. Publish
the source branch, integrate it into primary, then request delivery approval for
the exact integrated primary commit.

## Decisions

- Derive `unregistered` from valid task directories absent from the canonical
  status map; never persist it in `tasks/status.yaml`.
- Return unregistered tasks from list and status without timestamps. Time
  filters exclude them, and time sorting places them after timestamped tasks
  with a stable name tie-breaker.
- Validate unregistered task artifacts using pre-start lifecycle rules:
  `Task.md` is required, while `Progress.md` and `UserAcceptance.md` are not
  allowed before registration and start.
- Register an already-published unregistered directory only when its content
  hash matches the caller's task directory; report a content conflict instead
  of overwriting divergent primary content.
- The layout, status, and content diagnostic audit found no additional result
  states to introduce. Missing requested tasks remain query failures; pending
  approvals and legacy terminal formats already use non-failing warning or info
  diagnostics; malformed, unsafe, contradictory, and incomplete state remains
  diagnostic.

## Human approvals

| Checkpoint | Status | Review artifact and decision evidence |
| --- | --- | --- |
| Scope | Approved | User approved the goal, audit boundary, exclusions, constraints, and acceptance criteria in the canonical Task.md on 2026-09-20. |
| Interface | Approved | User approved the proposed text and JSON forms, filtering, sorting, status-query, and exit behavior for `unregistered` on 2026-09-20. |
| Business and data model | Approved | User approved the distinction between persisted lifecycle states and derived `unregistered`, including registration as its only transition, on 2026-09-20. |
| Architecture | Not applicable | Implementation remains within existing layout discovery, status query, content validation, rendering, and publication responsibilities; no shared abstraction or boundary move was introduced. |
| Delivery acceptance | Pending | Awaiting review of the integrated implementation and validation evidence. |

## Validation

- `node --test test/status.test.js`: 6 passed.
- `node --test test/check.test.js test/cli.test.js`: 20 passed.
- `node --test test/publication.test.js`: 11 passed.
- `node --test test/content.test.js test/check.test.js`: 15 passed.
- `pnpm --filter repoledger test`: 66 passed.
- `pnpm check`: package tests, package-content check, installed-package smoke,
  release tests, review-skill tests, and ledger validation passed.

## Blockers

- Delivery approval is required after integration to primary.

## Outcome

Repoledger now treats a valid unregistered task directory as observable task
state rather than a diagnostic, preserves strict validation for invalid state,
and safely registers matching task content already published on primary.