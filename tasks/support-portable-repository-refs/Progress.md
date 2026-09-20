# Progress

Updated: 2026-09-20

## Current state

Implementation is complete against the approved portable repository-ref
design. The v2 configuration and status contracts, URL-based Git operations,
source-ref lifecycle publication, remote validation, CLI, schemas, migration
helper, reusable skills, repository policy, and documentation are ready for
publication and delivery review.

## Decisions

- Use canonical credential-free HTTPS URLs as shared repository identity and
  leave transport rewrites and credentials in each participant's Git config.
- Store `sourceRepository` only when it differs from `primaryRepository`, but
  always expose the effective value in status and list reports.
- Create same-repository source refs atomically with the primary start commit;
  use source-first publication with an explicit recoverable partial result for
  cross-repository starts.
- Require the advertised source tip to be contained in the delivery-approved
  primary commit, and retain source branches after completion or abandonment.

## Human approvals

| Checkpoint | Status | Review artifact and decision evidence |
| --- | --- | --- |
| Scope | Approved | User approved the scope in [Task.md](./Task.md) at commit `f2524915117c01ac1771592fd5a8f33f07ffd6d8` on 2026-09-20. |
| Interface | Approved | User approved the CLI and reporting contract in [Design.md](./Design.md) at commit `f2524915117c01ac1771592fd5a8f33f07ffd6d8` on 2026-09-20. |
| Business and data model | Approved | User approved the v2 repository and source-ref model in [Design.md](./Design.md) at commit `f2524915117c01ac1771592fd5a8f33f07ffd6d8` on 2026-09-20. |
| Architecture | Approved | User approved the URL resolution, ref namespace, and publication boundaries in [Design.md](./Design.md) at commit `f2524915117c01ac1771592fd5a8f33f07ffd6d8` on 2026-09-20. |
| Delivery acceptance | Pending | Review the published implementation and final validation evidence. |

## Validation

- `pnpm check` passes: 54 repoledger tests, the exact 19-file package allowlist,
  installed-tarball smoke checks, 12 release tests, 4 review-skill tests, and
  the complete migrated ledger check.
- Repoledger integration tests use real temporary bare repositories and cover
  URL rewrite portability without a named remote, atomic same-repository
  start, successful fork start and completion, create-only branch collision,
  source-only partial recovery after source advancement, primary movement,
  missing source detection, and completion reachability.
- The side-effect-free v1 migration helper preserves lifecycle facts and
  produces the exact v2 YAML now staged for this repository; Git clean-filter
  checks confirm both canonical YAML blobs contain LF-only bytes.
- Git diagnostics redact URL credentials and token-like query values before
  entering text or JSON reports.
- `pnpm check:skills` discovers all six skills. Task links, Markdown content,
  Mermaid rendering, editor diagnostics, and `git diff --check` pass.

## Blockers

- Delivery acceptance is required for the exact published implementation
  commit.

## Outcome

Implementation complete; publish and verify the candidate, then request
delivery acceptance for its exact primary commit.