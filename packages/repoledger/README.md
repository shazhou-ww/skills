# repoledger

Inspect, validate, initialize, and safely move repository-owned task ledgers
with the deterministic companion CLI for the `repository-task-ledger` Agent
Skill.

## Requirements

- Node.js 22 or newer on Windows, macOS, or Linux.
- Git for publication-history checks and `doctor`.
- A repository that follows the canonical `tasks/backlog`, identity-scoped
  `tasks/ongoing`, and `tasks/archived` layout.

## Usage

Run without installation:

```sh
npx repoledger@0.2.0 check
npx repoledger@0.2.0 doctor
```

For CI, install and lock a development dependency instead of resolving
`latest` on every run:

```sh
pnpm add --save-dev repoledger@0.2.0
pnpm exec repoledger check
```

`check` reads repository content and existing local Git refs without network
access or a developer identity. `doctor` additionally validates the real
worktree-scoped identity, refreshes the configured shared branch, and verifies
the remote identity lane. `doctor --offline` skips the fetch and emits a
degraded-freshness warning; it is not sufficient before claiming or resuming
task work.

The complete command surface is:

```sh
repoledger status [--archived]
repoledger check [--task <task-name>]
repoledger doctor [--offline]
repoledger init [--identity <identity>] [--dry-run | --apply]
repoledger plan claim <task-name> [--take-from <identity>] [--apply]
repoledger plan archive <task-name> [--apply]
```

`status` lists deterministic task positions and the local identity without
fetching. `check --task` focuses task content and publication checks while
retaining repository-wide configuration, layout, identity-lane, and duplicate
position validation.

`init` previews by default. It can scaffold a missing configuration and
canonical task directories without overwriting conflicts. An explicit
`--identity` may safely enable worktree configuration and create an identity
lane; the worktree is bound only after that lane is visible on the refreshed
shared branch. `--dry-run` is an explicit preview alias, while `--apply`
recomputes and applies the local plan.

Every `plan` command previews by default and reports its source, destination,
preconditions, blockers, and Markdown reference edits. `plan claim` moves
backlog work to the current identity. `--take-from <identity>` instead requires
the task to remain ongoing under exactly that source identity before moving it
to the current worktree. `plan archive` requires an already completed or
abandoned current task. Only `--apply` performs the recomputed move.

Applied moves preserve the complete task directory and update affected inbound
and outbound repository-local Markdown links. References from archived task
history block the operation instead of being rewritten. File changes are
journaled and rolled back on ordinary failures.

Use `--json` for a complete structured report. Successful validation exits
with status `0`, ledger failures use `1`, and CLI usage errors use `2`.

## Configuration

Create `repoledger.json` at the repository root:

```json
{
  "$schema": "./node_modules/repoledger/schema/v1.json",
  "tasksDirectory": "tasks",
  "remote": "origin",
  "branch": "main"
}
```

The pinned package provides the schema locally for offline editor validation.
Its canonical `$id` is the GitHub-hosted
[`schema/v1.json`](https://github.com/shazhou-ww/skills/blob/main/packages/repoledger/schema/v1.json),
which is the configuration contract and carries its version in the path. A
future incompatible contract uses a different schema rather than a second
version field.

Markdown references to targets inside the current task directory must use
file-relative paths so they remain valid when the task moves. Other
repository-local references may begin with `/` to resolve from the repository
root or use ordinary file-relative paths. URI references such as HTTPS links
are external and are not resolved as repository files.

`check` requires complete Git history and the configured remote ref so it can
verify publication evidence without silently weakening the protocol. It never
fetches. CI therefore checks out full history, while `doctor` refreshes the
remote before running the same validation. Archived records that predate the
current publication milestone format remain legacy history and receive
informational diagnostics rather than migration edits.

## Validation Coverage

`check` validates:

- canonical status and identity directories, `.gitkeep` registration markers,
  portable names, task-directory types, and unique task positions;
- required `Task.md`, state-dependent `Progress.md`, task acceptance
  checklists, final outcomes, and publication milestone tables;
- five-part human review plans for active tasks, consistent approval states,
  dated decision evidence, and completed delivery approval for new-format
  archives;
- optional `UserAcceptance.md` structure, numbered steps and results,
  reporting instructions, and accepted status for completed archives;
- move-stable task-local links and repository-local Markdown links under the
  declared renderer convention;
- recorded published commit references, shared-branch reachability, archive
  move history, and distinct lifecycle integrations when history is present.

`doctor` adds:

- `extensions.worktreeConfig=true`;
- a lowercase kebab-case `task-ledger.identity` from worktree scope;
- separation from the optional device-global default identity;
- configured branch validity, fetch success, and the identity's `.gitkeep` on
  the refreshed remote branch.

`status`, `check`, initialization previews, and transition previews are
read-only. `doctor` and apply operations may refresh remote refs. Only explicit
`init --apply` and `plan ... --apply` operations modify local task files or Git
worktree configuration. The CLI never stages, commits, pushes, merges,
force-updates, or rewrites archived task history. Admission, ownership consent,
completion, acceptance, and archive decisions remain in the Agent Skill.

## Development

From the repository root:

```sh
pnpm install --frozen-lockfile
pnpm check
pnpm check:skills
```

`pnpm --filter repoledger pack:check` verifies the npm tarball contains only
the public package files. The package is currently marked `UNLICENSED`, matching
the source repository's absence of an explicit software license.