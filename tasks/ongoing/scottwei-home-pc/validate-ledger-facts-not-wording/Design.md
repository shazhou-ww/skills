# Fact-based validation design

## Source of truth

- Task position (`backlog`, `ongoing`, or `archived`) is the current lifecycle
  state.
- Git history is the publication and ownership chronology.
- `Task.md` defines planned work, acceptance criteria, and review
  applicability.
- `Progress.md` records human decisions, current context, validation, blockers,
  and outcome. It does not reproduce Git publication history.
- `UserAcceptance.md` records a manual test protocol and its reported result
  when manual testing is required.

## Parsing boundary

Content validation separates parsing from invariant checks. Parsers return a
canonical fact or no result; validators do not compare the original prose.

Enumerated table cells accept an exact canonical phrase followed by either the
end of the cell or an annotation introduced by `:`, `-`, an en dash, or an em
dash. Whitespace around the separator is ignored. An annotation must be
non-empty and must not introduce another canonical value from the same enum.
Matching remains case-sensitive so generated and hand-authored records have a
stable portable representation.

Examples:

| Input | Parsed fact | Result |
| --- | --- | --- |
| `Pending` | `Pending` | Valid |
| `Pending — artifact ready` | `Pending` | Valid |
| `Approved: reviewed on 2026-09-17` | `Approved` | Valid when evidence also satisfies approval invariants |
| `Pending review` | None | Invalid because no annotation separator is present |
| `Pending — now Approved` | None | Invalid because the annotation introduces a second status |
| `Done` | None | Invalid because no canonical status is present |

Human approval canonical values remain `Pending`, `Approved`, `Not
applicable`, and `Reopened`. Review applicability canonical values remain
`Required`, `Not applicable`, and `Assess during execution`; the latter two
still require a non-empty rationale or trigger annotation.

Outcome accepts `Completed` or `Abandoned` as the first canonical token, with
optional punctuation and explanatory prose after it. A second outcome token
is ambiguous and invalid. Invariants consume only the parsed outcome.

User acceptance Status has a deliberately explicit result grammar:

- `Pending`, optionally followed by a separated annotation.
- `Accepted`, optionally followed by a separated annotation.
- `Failed at step <positive integer>: <non-empty observed result>`.

Consequently, `Not Accepted` and prose that merely contains `Accepted` do not
parse as acceptance. The Report outcome section remains required but its
instructions are human-authored and are not checked for exact template
phrases.

## Invariants

- Required review checkpoints cannot be marked `Not applicable`.
- Not-applicable review checkpoints must have a not-applicable approval state.
- Approved checkpoints require dated decision evidence.
- Completed current-schema archives require all Task.md acceptance criteria,
  required approvals, and any present UserAcceptance.md result to be accepted.
- Unknown, missing, contradictory, or ambiguous canonical facts are errors.
- Pending and reopened approvals remain warnings until their gate is reached.

The free-form Progress checklist is not a completion source of truth and is no
longer validated by searching item wording. Task acceptance criteria and
explicit approval and acceptance facts enforce completion.

Placeholder detection recognizes only the explicit unresolved sentinel values
emitted by current task templates. It does not treat every angle-bracket span,
email autolink, or explanatory fragment as a placeholder.

## Publication milestones removal

The `Publication milestones` section is removed from the required Progress
headings, template, generated claim progress, validators, diagnostics, tests,
and documentation. Existing files may retain the section; repoledger ignores
it, which preserves compatibility without rewriting archive history.

Current-schema detection no longer depends on a milestone cell containing
`Complete`. An archived task with a Human review checkpoints plan uses the
current content contract; an archive without that structural plan retains
legacy compatibility. This bases compatibility on document structure rather
than historical prose.

The repository workflow continues to require distinct claim,
implementation-complete, and archive integrations. Agents verify those facts
from refreshed Git history as part of publication workflow, outside local
content validation. `check` and `doctor` remain deterministic and do not fetch
remotes.

## Compatibility and diagnostics

- Existing canonical 0.6.0 approval, applicability, outcome, and acceptance
  values continue to parse.
- Existing Progress milestone tables are tolerated but no longer interpreted.
- Existing archived tasks are not rewritten solely for migration.
- Removed `progress.milestones.*` diagnostics are not replaced with prose
  heuristics.
- Existing diagnostic codes remain for invalid facts where their meaning is
  unchanged; messages describe accepted fact syntax rather than required
  sentences.

## Test strategy

Each parser boundary gets canonical, annotated, paraphrased, unknown,
ambiguous, and negated cases. Content integration tests verify plan conflicts,
dated approval evidence, archive completion, legacy archives without milestone
inference, generated Progress without milestone rows, and acceptance rejection
for `Not Accepted`. Transition tests continue to prove the three directory
moves independently of duplicated publication cells.
