# Progress

Updated: 2026-09-20

## Current state

Implementation is complete and validated against the approved time-filter
contract. The CLI, documentation, focused tests, and installed-package smoke
coverage are ready for publication and delivery review.

## Decisions

- Keep ergonomic parsing private to CLI orchestration and preserve the strict
  canonical timestamp contract of the programmatic `listTasks` API.
- Capture one injectable reference instant for each task-list invocation and
  normalize every supplied bound before range validation or filtering.
- Require fixed-width calendar and offset fields, uppercase `T` and `Z`, and
  positive duration components used at most once in `d`, `h`, `m` order.
- Keep stored task timestamps, half-open intervals, sorting, state filtering,
  limits, and plain task-row output unchanged.

## Human approvals

| Checkpoint | Status | Review artifact and decision evidence |
| --- | --- | --- |
| Scope | Approved | User approved [Task.md](./Task.md) at commit `17751675cd38f76a1f9313002221ed02d8bd86ba` on 2026-09-20. |
| Interface | Approved | User approved the CLI and reporting contract in [Design.md](./Design.md) at commit `17751675cd38f76a1f9313002221ed02d8bd86ba` on 2026-09-20. |
| Business and data model | Approved | User approved the time-boundary and normalization model in [Design.md](./Design.md) at commit `17751675cd38f76a1f9313002221ed02d8bd86ba` on 2026-09-20. |
| Architecture | Not applicable | Normalization remains private to `src/cli.js` and affects only `task list`, as approved in [Design.md](./Design.md). |
| Delivery acceptance | Pending | Review the published implementation, command examples, package diff, and validation evidence. |

## Validation

- `node --test packages/repoledger/test/cli.test.js packages/repoledger/test/status.test.js`
  passes all 16 focused CLI and filtering tests.
- The exact date-only acceptance command succeeds with
  `updatedSince: 2026-09-20T00:00:00Z` in its JSON report.
- The installed-tarball smoke test accepts date-only and offset bounds and
  reports their canonical UTC values.
- `pnpm check` passes: 59 repoledger tests, the exact 19-file package
  allowlist, installed-tarball smoke checks, 12 release tests, 4 review-skill
  tests, and the complete ledger check.
- Editor diagnostics and `git diff --check` pass for the implementation.

## Blockers

- Delivery acceptance is required for the exact published implementation
  commit before completing the task.

## Outcome

Implementation complete; publish and verify the candidate, then request
delivery acceptance for its exact primary commit.