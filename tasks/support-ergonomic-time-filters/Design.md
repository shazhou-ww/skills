# Ergonomic time filter contract

Status: Proposed for scope, interface, and business/data-model review.

## Scope alignment

This change broadens only the four `repoledger task list` time-bound options.
Stored task timestamps, lifecycle transitions, sorting, state filters, limits,
and the existing half-open interval semantics remain unchanged.

All four options use the same input grammar and normalization rules:

- `--created-since <time>`: inclusive creation lower bound.
- `--created-before <time>`: exclusive creation upper bound.
- `--updated-since <time>`: inclusive update lower bound.
- `--updated-before <time>`: exclusive update upper bound.

## CLI input contract

| Input family | Accepted form | Example | Canonical UTC result |
| --- | --- | --- | --- |
| UTC date | Calendar-valid `YYYY-MM-DD` | `2026-09-20` | `2026-09-20T00:00:00Z` |
| UTC timestamp | Calendar-valid `YYYY-MM-DDTHH:mm:ssZ` | `2026-09-20T12:30:00Z` | unchanged |
| Offset timestamp | Calendar-valid `YYYY-MM-DDTHH:mm:ss+HH:MM` or `YYYY-MM-DDTHH:mm:ss-HH:MM` | `2026-09-20T00:00:00+08:00` | `2026-09-19T16:00:00Z` |
| UTC day keyword | Exact lowercase `today` | `today` | captured UTC date at `00:00:00Z` |
| Lookback duration | Positive integer `d`, `h`, and `m` components, each used at most once in descending order | `5d12h`, `6h30m`, `15m` | captured reference instant minus the duration |

Date and timestamp fields use fixed-width ASCII digits. `T` and `Z` are
uppercase. Offset hours and minutes are two digits separated by a colon.
Times require seconds and reject fractional seconds. Calendar fields, clock
fields, and offsets must be valid rather than relying on permissive `Date`
parsing or rollover.

Each duration component that appears is a positive base-10 integer. A duration
contains no whitespace, sign, decimal, repeated unit, or omitted number.
Components appear only in `d`, `h`, `m` order; omitted units are allowed.
Thus `1d2h3m`, `6h`, `6h30m`, and `15m` are valid, while `0m`, `1h2d`,
`1h30h`, `1.5h`, `-2h`, `2w`, and `soon` are invalid.

The option metavar changes from `<timestamp>` to `<time>` so help output does
not imply that date-only, keyword, and duration forms are invalid. Command help
and package documentation will include copyable examples from every input
family and state that local calendar-day boundaries require an explicit offset.

An invalid bound remains a CLI usage error with exit code `2`. Its diagnostic
identifies the option and includes these valid forms:

```text
2026-09-20
2026-09-20T00:00:00Z
2026-09-20T00:00:00+08:00
today
6h30m
```

The diagnostic also states that offsets require `+HH:MM` or `-HH:MM` and that
duration units may appear once in `d`, `h`, `m` order.

## Time-boundary model

The task-list command captures one reference instant before normalizing any
bound. Every `today` or duration value in that invocation uses that same
instant, including values supplied to different options. Tests inject the
reference instant; production uses the system clock.

`today` means midnight at the start of the captured instant's UTC date. It
never uses the machine's local timezone. A duration is an elapsed lookback
from the captured instant, including when used as a `before` bound. After
duration subtraction, the result is truncated, not rounded, to whole seconds.

For a captured instant of `2026-09-20T12:30:00Z`:

| Input | Canonical UTC result |
| --- | --- |
| `today` | `2026-09-20T00:00:00Z` |
| `6h` | `2026-09-20T06:30:00Z` |
| `6h30m` | `2026-09-20T06:00:00Z` |
| `5d12h` | `2026-09-15T00:30:00Z` |

Absolute offsets identify instants, not local filtering modes. For example,
`2026-09-20T00:00:00+08:00` represents the start of that local date and is
converted once to `2026-09-19T16:00:00Z`.

Every accepted input becomes canonical `YYYY-MM-DDTHH:mm:ssZ` before range
validation. The existing `since < before` rule is then applied to normalized
instants, and filtering continues to compare canonical UTC strings. Stored
values in `tasks/status.yaml` are neither rewritten nor reinterpreted.

## Reports and compatibility

Plain task rows remain unchanged. In JSON output, each supplied time filter in
`result.filters` contains the canonical UTC value actually applied. State
filters and all other report fields retain their current shape.

Existing canonical UTC invocations remain valid. The programmatic `listTasks`
boundary continues to accept and validate canonical timestamps only; ergonomic
input parsing belongs to CLI orchestration before `listTasks` is called.

## Implementation boundary

Normalization remains private to `src/cli.js`, where command options and usage
errors are already owned. The command captures an injectable clock value once,
normalizes the four options, validates normalized ranges, and passes canonical
filters to the unchanged `src/status.js` filtering contract.

This does not create a shared or exported parser and does not affect another
command, so the architecture checkpoint is not currently applicable. If the
implementation requires an exported parser, a shared module, or use outside
`task list`, architecture review must be reopened before making that change.
