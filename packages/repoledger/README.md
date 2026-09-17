# repoledger

Inspect, validate, initialize, and safely move repository-owned task ledgers
with the deterministic companion CLI for the `repository-task-ledger` Agent
Skill.

## Requirements

- Node.js 22 or newer on Windows, macOS, or Linux.
- Git only when reading or writing the worktree-scoped identity.
- A repository that follows the canonical `tasks/backlog`, identity-scoped
  `tasks/ongoing`, and `tasks/archived` layout.

## Usage

Run without installation:

```sh
npx repoledger@0.5.0 check
npx repoledger@0.5.0 doctor
```

For CI, install and lock a development dependency instead of resolving
`latest` on every run:

```sh
pnpm add --save-dev repoledger@0.5.0
pnpm exec repoledger check --all-identities --archived
```

`check` validates local files without network access, commit history, or remote
refs. It reads `task-ledger.identity` from worktree-scoped Git config only to
select the current ongoing lane. Without that binding, it checks backlog and
skips ongoing tasks. `doctor` additionally requires a valid local worktree
identity and identity lane.

The complete command surface is:

```sh
repoledger status [--archived]
repoledger check [--task <task-name>] [--all-identities] [--archived]
repoledger doctor
repoledger init [--identity <identity>] [--dry-run | --apply]
repoledger task claim <task-name> [--take-from <identity>] [--update-all-refs] [--apply]
repoledger task archive <task-name> [--update-all-refs] [--apply]
```

`status` lists deterministic task positions and the local identity. By default,
`check` inspects backlog plus the current identity's ongoing lane. Use
`--all-identities` to include every ongoing lane and `--archived` to include
archived tasks. `check --task` focuses content checks within that selected
scope. It does not detect competing remote claims; normal Git integration
reports those conflicts.

`init` previews by default. It can scaffold a missing configuration and
canonical task directories without overwriting conflicts. An explicit
`--identity` safely enables worktree configuration, creates the local identity
lane, and binds the worktree in one apply. `--dry-run` is an explicit preview
alias, while `--apply` recomputes and applies the local plan.

Every `task` command previews by default and reports its source, destination,
preconditions, blockers, and Markdown reference decisions. `task claim` moves
backlog work to the current identity. `--take-from <identity>` instead requires
the task to remain ongoing under exactly that source identity before moving it
to the current worktree. `task archive` requires an already completed or
abandoned current task. Only `--apply` performs the recomputed move.

Applied moves preserve the complete task directory. By default, affected
repository-local Markdown references are reported but left unchanged; this
does not block `--apply`. Pass `--update-all-refs` to rewrite every affected
inbound and outbound reference, including archived task history, in the same
journaled transaction. File changes are rolled back on ordinary failures.

Use `--json` for a complete structured report. Successful validation exits
with status `0`, ledger failures use `1`, and CLI usage errors use `2`.

## Configuration

Create `repoledger.json` at the repository root:

```json
{
  "$schema": "./node_modules/repoledger/schema/v1.json",
  "tasksDirectory": "tasks"
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

CI can run `repoledger check --all-identities --archived` when repository-wide
coverage is desired. Archived records that predate the current publication
milestone format remain legacy history and receive informational diagnostics
rather than migration edits.

## Validation Coverage

`check` validates:

- canonical status and identity directories, `.gitkeep` registration markers,
  portable names, and task-directory types within the selected scope;
- required `Task.md`, state-dependent `Progress.md`, task acceptance
  checklists, final outcomes, and publication milestone tables;
- five-part human review plans for active tasks, consistent approval states,
  and dated decision evidence; unresolved human approval is a warning;
- optional `UserAcceptance.md` structure, numbered steps and results,
  reporting instructions, and accepted status for completed archives;
- move-stable task-local links and repository-local Markdown links under the
  declared renderer convention.

`doctor` adds:

- `extensions.worktreeConfig=true`;
- a lowercase kebab-case `task-ledger.identity` from worktree scope;
- separation from the optional device-global default identity;
- the identity's local ongoing lane.

`status`, `check`, `doctor`, initialization previews, and transition previews
are read-only. Only explicit `init --apply` and `task ... --apply` operations
modify local task files or Git worktree configuration. The CLI never fetches,
stages, commits, pushes, merges, or inspects commit history. It rewrites task
references only with the explicit `--update-all-refs` option. Admission,
ownership consent, completion, acceptance, and archive decisions remain in the
Agent Skill.

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
