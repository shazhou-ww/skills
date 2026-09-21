# Support ergonomic time filter inputs

Created: 2026-09-20

## Goal

Make repoledger task-list time filters accept easy-to-write date-only,
timezone-aware, and relative shorthand inputs, normalize them deterministically
to UTC, and show actionable syntax examples when an input is invalid.

## Context

The four task-list time filters currently require exact
`YYYY-MM-DDTHH:mm:ssZ` values. A routine query such as
`repoledger task list --state completed --updated-since 2026-09-20` fails, and
the error names only the strict storage timestamp format. Users must manually
construct a full UTC timestamp even when they mean a calendar-day boundary or
already know their UTC offset.

Routine recency queries are also unnecessarily verbose. Expressions such as
`today`, `6h`, `6h30m`, and `5d12h` should provide concise UTC day and relative
duration boundaries without relying on the machine's local timezone.

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
- Accept `today` as the current UTC date's `00:00:00Z` boundary.
- Accept positive relative durations composed from days, hours, and minutes in
  descending unit order, including `6h`, `6h30m`, and `5d12h`. Resolve each
  expression to the command reference instant minus that duration.
- Use one UTC reference instant captured at command start for every relative
  bound in that invocation, then truncate the normalized result to exact
  second precision.
- Normalize every accepted bound to the canonical UTC
  `YYYY-MM-DDTHH:mm:ssZ` form before range validation and filtering.
- Preserve the existing half-open interval rules and report normalized bounds
  in structured command results.
- Improve usage errors and command documentation with copyable date-only, UTC,
  offset, `today`, and relative-duration examples, including the required
  two-digit colonized offset and ordered duration units.
- Add focused parser, CLI, filtering, documentation, and package tests.

## Out of scope

- Changing the canonical timestamp format stored in `tasks/status.yaml`.
- Inferring the machine's local timezone or accepting timezone abbreviations
  such as `PST` or IANA names such as `Asia/Shanghai`.
- Other calendar keywords or natural language such as `yesterday`,
  `this-week`, or `last Friday`.
- Relative units other than days, hours, and minutes, including months, years,
  weeks, and seconds; signed, future, decimal, repeated, or out-of-order units.
- Fractional seconds, minute-only times, or permissive correction of malformed
  ISO/RFC 3339 text.
- Changing task-list sorting, state filtering, limit behavior, or half-open
  interval semantics.
- Adding time filters to commands other than `task list`.

## Acceptance criteria

- [x] `repoledger task list --state completed --updated-since 2026-09-20`
  succeeds and applies `2026-09-20T00:00:00Z` as the inclusive lower bound.
- [x] All four time-filter options accept date-only, canonical UTC, and
  second-precision RFC 3339 offset inputs.
- [x] `2026-09-20T00:00:00+08:00` normalizes to
  `2026-09-19T16:00:00Z` before comparison and filtering.
- [x] With a command reference instant of `2026-09-20T12:30:00Z`, `today`
  normalizes to `2026-09-20T00:00:00Z`, `6h` to
  `2026-09-20T06:30:00Z`, `6h30m` to `2026-09-20T06:00:00Z`, and `5d12h`
  to `2026-09-15T00:30:00Z`.
- [x] All four time-filter options accept `today` and valid `d`, `h`, and `m`
  duration combinations; `--updated-since 6h` means records updated within
  the six hours preceding the command reference instant.
- [x] Existing exact `YYYY-MM-DDTHH:mm:ssZ` invocations remain compatible.
- [x] Structured reports expose the normalized UTC bounds that were actually
  applied rather than ambiguous or machine-local values.
- [x] Range validation occurs after normalization and still enforces
  `since < before` for each half-open interval.
- [x] Invalid calendar dates, offsets, incomplete times, timezone-less
  date-times, zero-duration expressions, unsupported units, repeated or
  out-of-order units, and unsupported relative text fail as CLI usage errors
  with copyable valid examples.
- [x] Documentation explains that date-only values use UTC midnight and that
  local day boundaries require an explicit offset such as `+08:00`; it also
  explains that `today` is the UTC day and durations subtract from one captured
  command reference instant.
- [x] Focused tests and `pnpm check` pass without changing stored task
  timestamps or unrelated command behavior.

## Constraints

- Parsing and normalization must be deterministic across operating systems,
  locales, clones, and local timezone configuration.
- Capture the command reference instant once and make it injectable in tests;
  do not call the clock independently for each option.
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
| Interface | Required | User | CLI input/output contract, examples, compatibility, and diagnostics in [Design.md](./Design.md). | Changing CLI option parsing, help text, or reports. |
| Business and data model | Required | User | UTC boundary, reference-instant, normalization, comparison, and storage semantics in [Design.md](./Design.md). | Implementing parsing or filter-boundary behavior. |
| Architecture | Not applicable: normalization remains private to CLI orchestration and affects only `task list`; reopen if that boundary changes. | User | Ownership and reopen trigger in [Design.md](./Design.md). | Exporting or sharing the parser, or expanding command scope. |
| Delivery acceptance | Required | User | Published implementation, command examples, validation evidence, and final package diff. | Running `task complete` for the exact approved primary commit. |

## References

- [Time filter contract](./Design.md)
- [Repoledger package documentation](https://github.com/shazhou-ww/repoledger/blob/main/README.md)
- [Repository task profile](/docs/repository-tasks.md)