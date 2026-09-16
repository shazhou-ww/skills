# Repoledger CLI expansion design

Updated: 2026-09-16
Status: Proposed for scope, interface, business and data model, and architecture review

## Decision request

Approve the command contracts, lifecycle rules, reference behavior, and module
boundaries below before implementation. This design deliberately changes the
original all-read-only CLI boundary only for explicit `--apply` operations.
It does not authorize the CLI to decide admission, ownership consent, human
approval, acceptance, completion, commits, or publication.

## Scope

The implementation adds four related capabilities:

1. `status` inventories canonical task positions and the local worktree
   identity without network access.
2. `check --task` validates one unambiguously selected task while retaining
   repository-wide configuration and layout safety checks.
3. `init` plans repository scaffolding and applies only explicitly requested,
   conflict-free local changes.
4. `plan` previews claim, handoff, and archive moves and applies a freshly
   recomputed plan only with `--apply`.

An applied move preserves both sides of the Markdown reference graph:

- inbound links from repository Markdown outside the moving task are updated
  when they resolve inside the old task directory; and
- relative outbound links from Markdown inside the moving task are updated
  when the new source location would otherwise change their resolved target.

Root-relative links that remain valid, task-local links that move with the
folder, external URLs, fragment-only links, and raw HTML are unchanged. An
inbound link from an existing `tasks/archived/**` document blocks the whole
apply operation. The CLI never silently rewrites archived history.

## Command interface

All commands retain the existing common options:

```text
-c, --config <path>   configuration path relative to the repository root
    --json            emit the complete machine-readable report
-r, --root <path>     repository root
```

The additive command grammar is:

```text
repoledger status [--archived] [common options]
repoledger check [--task <task-name>] [common options]

repoledger init [--identity <identity>]
  [--tasks-directory <path>] [--remote <name>] [--branch <name>]
  [--dry-run | --apply] [common options]

repoledger plan claim <task-name> [--apply] [common options]
repoledger plan handoff <task-name> --to <identity> [--apply] [common options]
repoledger plan archive <task-name> [--apply] [common options]
```

`init` and every `plan` operation default to preview. `init --dry-run` is an
explicit preview alias for scripts and documentation. Combining `--dry-run`
with `--apply` is a usage error. Commands are non-interactive; missing or
ambiguous input is reported rather than prompted for.

`plan claim` always uses the authoritative current worktree identity and has no
identity override. `plan handoff --to` names the already registered destination
identity. `plan archive` reads the outcome already recorded in `Progress.md`;
it has no option that decides completion or abandonment.

## Output and exit codes

Every JSON report retains the existing common fields where applicable:

```json
{
  "command": "status",
  "ok": true,
  "root": "C:/repository",
  "configPath": "C:/repository/repoledger.json",
  "schema": "https://example.invalid/schema.json",
  "diagnostics": [],
  "summary": {}
}
```

Repository-relative paths in structured output always use `/`, including on
Windows. Diagnostics retain the existing `code`, `level`, `path`, `message`,
and `remediation` fields.

Exit codes remain:

- `0`: successful inspection, validation, preview, no-op initialization, or
  fully applied and post-verified local change;
- `1`: invalid repository state, missing or duplicate task selection, blocked
  precondition, failed apply, or failed rollback; and
- `2`: command grammar or option usage error.

Human output is deterministic and concise. Preview output names the operation,
source, destination, identity, planned changes, reference edits, blockers, and
`Preview only; rerun with --apply`. Apply output never says success unless
postconditions pass. JSON is written to stdout; human diagnostics retain the
existing stdout/stderr behavior.

## Status model

`status` loads configuration and canonical layout but does not validate task
content, publication history, remote freshness, or remote identity
registration. It reads the local Git identity binding without falling back to
the device default.

By default it includes backlog and ongoing tasks. `--archived` adds archived
tasks. Entries are sorted by state, identity, and task name:

```json
{
  "identity": {
    "value": "scottwei-office-pc",
    "scope": "worktree"
  },
  "includeArchived": false,
  "tasks": [
    {
      "name": "example",
      "state": "ongoing",
      "identity": "scottwei-office-pc",
      "path": "tasks/ongoing/scottwei-office-pc/example"
    }
  ]
}
```

A missing or incorrectly scoped local identity is represented explicitly; it
does not prevent task inventory. Configuration, path, and duplicate-position
errors still make the report fail. An empty valid ledger exits `0`.

## Focused check model

`check --task <task-name>` performs configuration and layout checks across the
whole ledger, including canonical directories, identity lanes, portable names,
and duplicate positions. It then runs content, link, and publication-history
checks only for the unique selected task.

No match produces `task.selection.missing`. Multiple positions retain the
repository-wide `task.duplicate-position` error and add
`task.selection.ambiguous`. The JSON report adds:

```json
{
  "selection": {
    "name": "example",
    "matches": 1,
    "checked": 1
  },
  "summary": {
    "tasks": 1,
    "totalTasks": 12
  }
}
```

Calling `check` without `--task` preserves its current behavior and report
shape exactly.

## Initialization model

Initialization requires an existing non-bare Git worktree. It never runs
`git init`, stages files, commits, pushes, merges, or force-updates refs.

When no valid configuration exists, values are resolved as follows:

1. explicit CLI option;
2. `origin` when present, otherwise the sole configured remote;
3. the selected remote's symbolic default branch, otherwise the current branch
   only when its upstream belongs to the selected remote; and
4. `tasks` as the default task directory.

Ambiguity is a blocker. A newly generated config uses the canonical schema URL
so it remains valid when the command was invoked through `npx` rather than a
persistently installed dependency. Existing valid configuration is preserved;
explicit options that disagree with it are blockers. Invalid JSON, unsupported
schema, non-directory collisions, and existing conflicting content are never
overwritten.

The filesystem plan may create only:

- the selected configuration file;
- `<tasksDirectory>/backlog/.gitkeep`;
- `<tasksDirectory>/ongoing/.gitkeep`;
- `<tasksDirectory>/archived/.gitkeep`; and
- `<tasksDirectory>/ongoing/<identity>/.gitkeep` when `--identity` is explicit.

Identity initialization follows the protocol in phases:

1. `--identity` must be explicit and portable; the device default is reported
   only as a suggestion.
2. `core.worktree` and `core.bare` safety checks must pass before enabling
   `extensions.worktreeConfig`.
3. Apply may enable the extension and create a missing local identity lane.
4. Apply refreshes the selected remote branch before testing registration.
5. A newly created lane is not bound until the caller commits and publishes
   it. The report gives those next actions.
6. A later apply may bind `task-ledger.identity` only after the lane is visible
   on the refreshed remote branch and the explicit identity still matches.

Initialization is idempotent. Without `--identity`, it scaffolds only tracked
repository prerequisites and leaves identity setup pending.

## Lifecycle transition model

Every preview is local and network-independent. `--apply` discards the preview,
refreshes the configured remote branch, reruns identity and repository checks,
recomputes references, and applies only the new plan.

The common structured report is:

```json
{
  "command": "plan",
  "operation": "claim",
  "mode": "preview",
  "task": "example",
  "source": "tasks/backlog/example",
  "destination": "tasks/ongoing/scottwei-office-pc/example",
  "currentIdentity": "scottwei-office-pc",
  "destinationIdentity": "scottwei-office-pc",
  "preconditions": [],
  "changes": [],
  "referenceEdits": [],
  "applied": false,
  "nextActions": [],
  "ok": true,
  "diagnostics": [],
  "summary": {}
}
```

### Claim

- The task must exist exactly once in backlog.
- The current worktree identity must be valid, correctly scoped, and registered
  on the refreshed shared branch at apply time.
- The destination must not exist.
- Apply moves the complete directory and creates `Progress.md` atomically from
  the packaged canonical template. Human review applicability is copied from
  `Task.md`; required and assessed checkpoints remain `Pending`, and
  not-applicable rationales are preserved. No approval, decision, validation,
  or publication evidence is invented.
- Claim publication remains pending after local apply. The report instructs
  the caller to review the generated progress, commit and publish the claim,
  then record its immutable hash.

### Handoff

- The task must exist exactly once under the current worktree identity.
- `--to` must differ from the current identity and identify a lane registered
  on the refreshed shared branch.
- `Progress.md` must already record the handoff context and pass active-task
  content checks. The CLI cannot infer consent or write that narrative.
- Apply moves the complete directory and references without changing progress
  content. Publication remains the caller's next action.

### Archive

- The task must exist exactly once under the current worktree identity.
- `Progress.md` must explicitly record `Completed` or `Abandoned`; there is no
  outcome flag.
- A completed task must already satisfy acceptance, implementation publication,
  user acceptance when present, and every required human checkpoint. An
  abandoned task must retain its reason and follow-up.
- The task artifacts must be prospectively valid in archived state except for
  archive-commit reachability, which cannot exist before the caller commits.
- Apply moves the complete directory and references without inventing outcome
  or approval evidence. The report requires a separate archive commit and
  publication as the next action.

Wrong source state, another identity's ownership, destination collisions,
stale or unregistered identities, unresolved archived references, and any
existing repository error relevant to the operation are blockers, not no-ops.

## Markdown reference model

Candidate Markdown files come from Git's tracked and non-ignored untracked file
set, not from an unrestricted filesystem walk through dependencies or build
outputs. Every candidate and resolved target is checked against the real
repository root to reject traversal and symlink escapes.

Use `mdast-util-from-markdown` for CommonMark node types and source offsets and
`mdast-util-to-markdown` to serialize only affected link, image, or definition
nodes. Existing `marked` validation remains unchanged to reduce regression
risk. Reference-style links are changed at their definitions. When an affected
parent and child overlap, mutate both nodes in memory and replace only the
outermost source span. Text outside affected spans is byte-for-byte unchanged.

For each URL:

1. split and preserve query and fragment suffixes;
2. ignore external, protocol-relative, fragment-only, raw HTML, and non-file
   URI targets;
3. decode and resolve the path using POSIX Markdown rules and the existing
   repository-root convention;
4. determine whether the move changes an inbound or outbound relationship;
5. retain root-relative style or recompute a portable relative path from the
   referring file's post-move location; and
6. reattach the untouched query and fragment.

The plan records old and new destinations for each source file. Duplicate
references in one definition produce one text edit. Edits are sorted by file
and descending source offset before application.

## Apply transaction

Preflight completes before the first visible mutation. It verifies task
selection, source and destination types, identity markers, root confinement,
all Markdown parses, archived blockers, file hashes, and every planned output
collision.

The transaction then:

1. writes replacement Markdown and generated files to exclusive sibling temp
   files with original modes;
2. records a rollback journal under Git's private directory;
3. renames the task directory within the same task root;
4. replaces external Markdown files through backup renames;
5. verifies the destination, absent source, identity markers, exactly one task
   position, rewritten link resolution, and unchanged input hashes; and
6. removes backups and the journal only after postconditions pass.

On an ordinary error, completed file replacements and the directory move are
reversed in journal order. A rollback failure is reported explicitly and exits
`1`; success is never claimed. A later apply detects an unfinished journal and
requires recovery before another mutation. The CLI never stages the resulting
working-tree changes.

## Module boundaries

- `layout.js`: retain canonical discovery and expose deterministic task
  selection without duplicating traversal.
- `identity.js`: extract local binding, Git safety, refresh, and registration
  checks currently embedded in `doctor.js`.
- `status.js`: compose configuration, layout, and local identity inventory.
- `init.js`: build and apply idempotent initialization plans.
- `transitions.js`: build claim, handoff, and archive plans and verify their
  state-specific preconditions.
- `references.js`: discover and rewrite structured Markdown references.
- `transaction.js`: stage, journal, apply, verify, and roll back local changes.
- `cli.js`: remain responsible for Commander grammar and human/JSON rendering.
- `index.js`: extend `checkRepository` with optional task selection while
  preserving its existing no-option contract.

Filesystem and Git adapters remain injectable so failure and rollback paths can
be tested without platform-specific monkey-patching.

## Validation plan

Focused unit and CLI tests will cover:

- status ordering, identity states, archived inclusion, and empty ledgers;
- focused check selection, missing and duplicate tasks, retained global layout
  diagnostics, and unchanged unfiltered reports;
- init preview, explicit dry-run, apply, idempotency, inference ambiguity,
  invalid existing content, identity registration phases, and no staging;
- preview and apply for claim, handoff, and completed or abandoned archive;
- generated claim progress without fabricated approvals;
- inline links, images, reference definitions, root-relative and relative
  paths, inbound and outbound links, fragments, queries, encoded paths,
  external URLs, raw HTML exclusions, and Windows separators;
- archived inbound blockers before mutation, destination collisions, changed
  inputs, injected write and rename failures, successful rollback, failed
  rollback diagnostics, and exactly-once postconditions;
- real Git remote and worktree identity behavior; and
- existing `check`, `doctor`, help, JSON, exit codes, package allowlist, and
  packed-package smoke behavior.

The repository runs `pnpm check` and `pnpm check:skills` before implementation
completion. No configuration schema change is planned. Package versioning and
npm publication remain separate release work.

## Compatibility statement

Existing `check` and `doctor` behavior remains compatible. `status`, focused
check, init preview, and all plan previews are read-only. `doctor` and apply
operations may refresh remote refs for freshness. Only explicit
`init --apply` and `plan ... --apply` may modify local files or Git config.
No command stages, commits, pushes, merges, force-updates, or rewrites archived
task history.