# repoledger

Query, validate, and publish Git-native repository task lifecycle state.

## Requirements

- Node.js 22 or newer.
- Git with an existing remote primary branch.
- Stable task directories under the configured task directory.

## Storage

`repoledger.yaml` names the coordination target:

```yaml
version: 1
tasksDirectory: tasks
remote: origin
primaryBranch: main
```

`tasks/status.yaml` contains one sorted record per `tasks/<task-name>/`
directory:

```yaml
version: 1
tasks:
  example-task:
    state: ongoing
    createdAt: "2026-09-19T10:00:00Z"
    updatedAt: "2026-09-19T10:01:00Z"
```

States are `backlog`, `ongoing`, `completed`, and `abandoned`. Task records do
not store a person, device, worktree, or source branch.

## Commands

```text
repoledger init --remote <remote> --primary-branch <branch> [--tasks-directory <path>]
repoledger task list [--state <state>...] [--created-since <timestamp>]
                     [--created-before <timestamp>] [--updated-since <timestamp>]
                     [--updated-before <timestamp>] [--sort <name|created|updated>]
                     [--limit <count>] [--local]
repoledger status <task-name> [--local]
repoledger check [<task-name>] [--remote]
repoledger task register <task-name>
repoledger task start <task-name>
repoledger task complete <task-name> --approved-commit <commit>
repoledger task abandon <task-name>
```

Remote reads fetch configured primary and inspect an isolated temporary
worktree. `--local` explicitly reads the current worktree snapshot. Time
filters use half-open intervals: `since` is inclusive and `before` is
exclusive.

Mutation commands fetch primary, build and validate an isolated commit, push
primary without force, fetch again, and verify publication. They leave the
caller's branch, index, staged files, and unrelated working files unchanged.
Optional contributor branches and pull requests are outside the task-state
protocol.

Use `--json` for stable structured reports. Exit status `0` means success, `1`
means validation or operational failure, and `2` means invalid CLI usage.

## Validation

`check` validates strict canonical YAML, stable directory correspondence,
lifecycle records and timestamps, required task artifacts, human review facts,
acceptance state, and repository-local Markdown links. `check --remote` reads
from refreshed primary.

The package schema at `schema/v1.json` defines both configuration and task
status record shapes. Runtime parsing additionally rejects duplicate keys,
comments, directives, anchors, aliases, merge keys, custom tags, noncanonical
property order, and invalid timestamp ordering.

## Development

```sh
pnpm install --frozen-lockfile
pnpm check
pnpm check:skills
```
