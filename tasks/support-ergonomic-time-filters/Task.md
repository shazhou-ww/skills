# Support ergonomic time filter inputs

Created: 2026-09-20

## Goal

Make repoledger task-list time filters accept easy-to-write date-only and
standard timezone-aware inputs, normalize them deterministically to UTC, and
show actionable syntax examples when an input is invalid.

## Context

The four task-list time filters currently require exact
`YYYY-MM-DDTHH:mm:ssZ` values. A routine query such as
`repoledger task list --state completed --updated-since 2026-09-20` fails, and
the error names only the strict storage timestamp format. Users must manually
construct a full UTC timestamp even when they mean a calendar-day boundary or
already know their UTC offset.

This work is distinct from the ongoing portable repository-ref task, but it
should be release-ready before the next repoledger package release so the CLI
ergonomics can ship with the revised protocol.

## Scope

- Update `--created-since`, `--created-before`, `--updated-since`, and
  `--updated-before` to accept date-only `YYYY-MM-DD` input.
- Interpret date-only input as that date's `00:00:00Z` boundary so results are
  deterministic across devices and local timezone settings.
- Accept RFC 3339 second-precision timestamps with `Z` or a colonized numeric
  offset such as `2026-09-20T00:00:00+08:00`.
- Normalize every accepted bound to the canonical UTC
  `YYYY-MM-DDTHH:mm:ssZ` form before range validation and filtering.
- Preserve the existing half-open interval rules and report normalized bounds
  in structured command results.
- Improve usage errors and command documentation with copyable date-only, UTC,
  and offset examples, including the required two-digit colonized offset.
- Add focused parser, CLI, filtering, documentation, and package tests.

## Out of scope

- Changing the canonical timestamp format stored in `tasks/status.yaml`.
- Inferring the machine's local timezone or accepting timezone abbreviations
  such as `PST` or IANA names such as `Asia/Shanghai`.
- Natural-language or relative inputs such as `today`, `yesterday`, or `24h`.
- Fractional seconds, minute-only times, or permissive correction of malformed
  ISO/RFC 3339 text.
- Changing task-list sorting, state filtering, limit behavior, or half-open
  interval semantics.
- Adding time filters to commands other than `task list`.

## Acceptance criteria

- [ ] `repoledger task list --state completed --updated-since 2026-09-20`
  succeeds and applies `2026-09-20T00:00:00Z` as the inclusive lower bound.
- [ ] All four time-filter options accept date-only, canonical UTC, and
  second-precision RFC 3339 offset inputs.
- [ ] `2026-09-20T00:00:00+08:00` normalizes to
  `2026-09-19T16:00:00Z` before comparison and filtering.
- [ ] Existing exact `YYYY-MM-DDTHH:mm:ssZ` invocations remain compatible.
- [ ] Structured reports expose the normalized UTC bounds that were actually
  applied rather than ambiguous or machine-local values.
- [ ] Range validation occurs after normalization and still enforces
  `since < before` for each half-open interval.
- [ ] Invalid calendar dates, offsets, incomplete times, timezone-less
  date-times, and unsupported relative text fail as CLI usage errors with
  copyable valid examples.
- [ ] Documentation explains that date-only values use UTC midnight and that
  local day boundaries require an explicit offset such as `+08:00`.
- [ ] Focused tests and `pnpm check` pass without changing stored task
  timestamps or unrelated command behavior.

## Constraints

- Parsing and normalization must be deterministic across operating systems,
  locales, clones, and local timezone configuration.
- Do not silently accept JavaScript `Date` implementation-dependent formats or
  normalize impossible calendar values.
- Keep filtering comparisons on canonical UTC strings after validating actual
  instants.
- Preserve exit code `2` for invalid CLI usage and stable JSON report shape
  except for replacing accepted filter values with their normalized UTC form.
- Coordinate package delivery with the pending repoledger release rather than
  publishing an intermediate version solely for this task.

## Human review checkpoints

Task creation records this plan, not approval. Scope alignment and delivery
acceptance are always required for completed work.

| Checkpoint | Applicability | Reviewer | Planned review artifact | Approval required before |
| --- | --- | --- | --- | --- |
| Scope | Required | User | Goal, accepted input families, exclusions, constraints, and acceptance criteria in this task. | Substantive implementation. |
| Interface | Required | User | CLI input/output table covering accepted syntax, normalization, examples, compatibility, and diagnostics. | Changing CLI option parsing, help text, or reports. |
| Business and data model | Required | User | Time-boundary semantics covering UTC date-only interpretation, offset conversion, normalized comparison, and unchanged storage timestamps. | Implementing parsing or filter-boundary behavior. |
| Architecture | Assess during execution: required if parsing becomes a shared or exported API or affects commands beyond `task list`. | User | Proposed parser ownership, call sites, and compatibility boundary if the trigger is reached. | Introducing the shared/exported parser or expanding command scope. |
| Delivery acceptance | Required | User | Published implementation, command examples, validation evidence, and final package diff. | Running `task complete` for the exact approved primary commit. |

## References

- [Repoledger package documentation](/packages/repoledger/README.md)
- [Repository task profile](/docs/repository-tasks.md)