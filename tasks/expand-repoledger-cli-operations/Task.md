# Expand repoledger CLI operations

Created: 2026-09-16

## Goal

Add deterministic CLI support for ledger discovery, safe repository
initialization, focused task validation, and previewable lifecycle transitions
that preserve valid cross-document references without taking over human or
agent lifecycle decisions.

## Context

`repoledger` currently exposes `check` for repository validation and `doctor`
for local task-work readiness. Agents and maintainers must still enumerate
task positions manually, scaffold an adopted repository, isolate diagnostics
for one task, and move task directories while finding and repairing inbound
Markdown links.

The initial CLI intentionally excluded mutating lifecycle commands. This task
retains that safety boundary by separating deterministic planning from an
explicit local apply operation and by leaving admission, ownership, overlap,
approval, publication, and completion decisions in the Agent Skill.

## Scope

- Add a read-only `status` command that reports the current worktree identity
  and deterministic backlog, ongoing, and optionally archived task positions,
  with stable human-readable and JSON output.
- Add focused validation through `check --task <task-name>`, including clear
  handling for missing or duplicate task positions and any repository-wide
  invariant needed to keep the focused result truthful.
- Add an `init` workflow with a dry-run mode that can safely scaffold missing
  repository configuration and canonical task layout, plan explicit identity
  setup where applicable, refuse conflicting existing content, and leave Git
  commits and publication to the caller.
- Add `plan claim` with an explicit receiver-initiated
  `--take-from <identity>` mode, plus `plan archive`. Planning is non-mutating
  by default; an explicit `--apply` recomputes and validates the plan before
  changing local files.
- When applying a transition, move the complete task directory, preserve every
  artifact, remove the source task position, preserve identity lanes, and
  verify that the task occupies exactly one canonical position.
- Find inbound repository-local Markdown links whose resolved target is inside
  the moved task directory and update them to the destination when they occur
  outside archived task history. Also update relative outbound links from
  Markdown inside the moved task when its new location would otherwise change
  their resolved target. Preserve link fragments, external URLs, fragment-only
  links, and links that remain valid without rewriting.
- Treat an inbound reference from `tasks/archived/**` as a blocking precondition
  and make no partial move or reference edits, rather than rewriting archived
  history automatically.
- Extend package documentation, Agent Skill guidance, structured output, and
  cross-platform tests for the new behavior while preserving existing `check`
  and `doctor` compatibility.

## Out of scope

- Deciding task admission, semantic scope overlap, ownership, transfer consent,
  human approval, acceptance, completion, or abandonment.
- Automatically committing, pushing, force-updating, merging, or publishing
  task transitions or identity registrations.
- Rewriting archived task artifacts, external URLs, fragment-only references,
  or arbitrary non-Markdown path-like text.
- Silently overwriting existing configuration or task content, applying a plan
  with unresolved blockers, or auto-fixing unrelated ledger diagnostics.
- Replacing `task-new`, `task-exec`, or the authoritative
  `repository-task-ledger` lifecycle with CLI policy.
- Publishing a new npm package version as part of this implementation task.

## Acceptance criteria

- [x] `repoledger status` deterministically lists active task positions and the
      current identity; an explicit option includes archived positions, and
      JSON output exposes stable task name, state, identity, and path fields.
- [x] `repoledger check --task <task-name>` focuses task-scoped diagnostics,
      fails clearly for no match or duplicate positions, retains required
      repository-wide safety checks, and does not change existing unfiltered
      `check` behavior.
- [x] `repoledger init --dry-run` reports every proposed repository and identity
      setup action without mutation; applying initialization creates only safe
      missing prerequisites, refuses conflicts, and never commits or publishes.
- [x] Each supported `repoledger plan` transition reports its exact source,
      destination, preconditions, blockers, and reference edits without
      changing files unless `--apply` is supplied.
- [x] A successful `plan --apply` moves every task artifact, leaves no source
      task directory, preserves identity markers, and leaves exactly one task
      position; failed preconditions produce no partial filesystem changes.
- [x] Applied moves rewrite affected inbound links outside archived task
  history and relative outbound links from the moving task while preserving
  targets, valid syntax, queries, and fragments; archived inbound
  references block the entire apply operation.
- [x] Existing `check`, `doctor`, configuration, human-readable output, JSON
      contracts, and exit-code behavior remain backward compatible except for
      documented additive fields or options.
- [x] Automated tests cover preview versus apply, claim,
      `claim --take-from <identity>`, and archive, duplicate and missing tasks,
      source-identity races, conflicting initialization, relative and
      repository-root links, archived-reference blockers, Windows paths, and
      rollback or no-partial-write behavior.
- [x] Package and skill documentation explain the command boundaries, mutation
      guarantees, remaining human decisions, and the required publication
      steps after local initialization or transition application.

## Constraints

- Use structured Markdown parsing and path resolution rather than regex-only
  replacement of link text.
- Constrain every discovered, created, moved, or rewritten path to the
  configured repository and task roots; reject ambiguous, escaping, or
  conflicting paths.
- Preflight all planned mutations before applying any of them and preserve
  unrelated worktree changes.
- Keep read-only commands network-independent. Do not imply remote freshness or
  task-work readiness where only local state was inspected.
- Require an explicit identity and the protocol's Git safety checks before any
  initialization or transition action changes worktree-scoped configuration.
- Keep the public package compatible with its documented Node.js and Git
  versions on Windows, macOS, and Linux.
- Preserve archived task history and the existing configuration schema unless
  an explicitly reviewed schema change is necessary.

## Human review checkpoints

Task creation records this plan, not approval. Scope alignment and delivery
acceptance are always required for completed work.

| Checkpoint | Applicability | Reviewer | Planned review artifact | Approval required before |
| --- | --- | --- | --- | --- |
| Scope | Required | User | Goal, included commands, mutation boundaries, exclusions, constraints, and acceptance criteria in this task. | Substantive implementation. |
| Interface | Required | User | Exact command grammar, options, defaults, human and JSON output, exit codes, prompts, and compatibility behavior. | Implementing the public CLI interface. |
| Business and data model | Required | User | Lifecycle transition preconditions, initialization states, reference graph rules, archived-history policy, and failure atomicity. | Implementing initialization or transition mutations. |
| Architecture | Required | User or repository maintainer | Module boundaries for discovery, focused validation, planning, Markdown reference rewriting, preflight, and apply behavior. | Adding the shared planning and mutation implementation. |
| Delivery acceptance | Required | User | Integrated revision, package tests, cross-platform and packed-package evidence, documentation, and any required manual CLI exercise. | Marking the task completed and archiving it. |

## References

- [CLI expansion design](./Design.md)
- [Current CLI routing](/packages/repoledger/src/cli.js)
- [Current layout inspection](/packages/repoledger/src/layout.js)
- [Current Markdown parsing](/packages/repoledger/src/markdown.js)
- [Package documentation](/packages/repoledger/README.md)
- [Repository task ledger skill](/skills/repoledger/SKILL.md)
- [Initial CLI scope decision](/tasks/build-repoledger-cli/Task.md)
- [Repository-root link decision](/tasks/use-repository-root-task-links/Task.md)
