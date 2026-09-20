# repoledger

Query, validate, and publish Git-native repository task lifecycle state.

## Requirements

- Node.js 22 or newer.
- Git access to an existing primary repository and branch.
- Stable task directories under the configured task directory.

## Storage

`repoledger.yaml` names the coordination target:

```yaml
version: 2
tasksDirectory: tasks
primaryRepository: https://github.com/shazhou-ww/skills.git
primaryBranch: main
```

`primaryRepository` is a canonical credential-free HTTPS URL shared by every
clone. Local remote names are irrelevant. Git credential helpers and
`url.*.insteadOf` or `url.*.pushInsteadOf` may provide machine-specific access.

`tasks/status.yaml` contains one sorted record per `tasks/<task-name>/`
directory:

```yaml
version: 2
tasks:
  example-task:
    state: ongoing
    sourceBranch: task/example-task
    createdAt: "2026-09-19T10:00:00Z"
    updatedAt: "2026-09-19T10:01:00Z"
```

States are `backlog`, `ongoing`, `completed`, and `abandoned`. Every ongoing
record requires `sourceBranch`; `sourceRepository` is stored only for a fork
and otherwise inherits `primaryRepository`. Terminal and backlog records reject
both source fields. Records never store a person, device, worktree, credential,
or local remote name.

## Commands

```text
repoledger init --primary-repository <https-url> --primary-branch <branch>
                [--tasks-directory <path>]
repoledger task list [--state <state>...] [--created-since <timestamp>]
                     [--created-before <timestamp>] [--updated-since <timestamp>]
                     [--updated-before <timestamp>] [--sort <name|created|updated>]
                     [--limit <count>] [--local]
repoledger status <task-name> [--local]
repoledger check [<task-name>] [--remote]
repoledger task register <task-name>
repoledger task start <task-name> [--source-repository <https-url>]
                                  [--source-branch <branch>]
repoledger task complete <task-name> --approved-commit <commit>
repoledger task abandon <task-name>
```

Remote reads fetch configured primary by URL and inspect an isolated temporary
worktree. `--local` explicitly reads the current worktree snapshot. List and
status report the effective source locator without fetching it. Time filters
use half-open intervals: `since` is inclusive and `before` is exclusive.

Mutation commands fetch primary, build and validate an isolated commit, push
without overwriting concurrent refs, fetch again, and verify publication. A
same-repository start atomically creates the source branch and advances
primary. A fork start publishes source first and reports an explicit recoverable
partial result if primary publication then fails. Completion requires the
fetched source tip to be contained in the approved primary commit; terminal
transitions remove the locator but never delete the branch. Commands leave the
caller's branch, index, staged files, and unrelated working files unchanged.

Use `--json` for stable structured reports. Exit status `0` means success, `1`
means validation or operational failure, and `2` means invalid CLI usage.

## Validation

`check` validates strict canonical YAML, stable directory correspondence,
lifecycle records and timestamps, source-ref uniqueness, required task
artifacts, human review facts, acceptance state, and repository-local Markdown
links. `check --remote` reads from refreshed primary and verifies every selected
ongoing source branch and its start ancestry.

The current package schema at `schema/v2.json` defines both configuration and
task status record shapes. `schema/v1.json` remains historical; v2 commands
return `config.migration-required` instead of interpreting its clone-local
remote name. Runtime parsing additionally rejects duplicate keys, comments,
directives, anchors, aliases, merge keys, custom tags, noncanonical property
order, unsafe URLs, and invalid timestamp ordering.

## Migrating version 1

Migration is one coordinated repository change. Select and review a canonical
HTTPS URL for the primary repository, assign every ongoing task a unique source
branch, then change both YAML files to version 2 in one candidate. Preserve
task states, creation times, artifacts, and terminal update times; advance the
changed ongoing records' update times. Atomically publish same-repository
source branches with primary, publish fork refs first, and finish with
`repoledger check --remote`. See the repository-task-ledger adoption guide for
the complete procedure.

The exported `prepareV1Migration` helper parses canonical v1 configuration and
status sources and returns validated `configSource` and `statusSource` for
review. It has no filesystem or Git side effects; migration publication remains
an explicit coordinated repository operation.

## Development

```sh
pnpm install --frozen-lockfile
pnpm check
pnpm check:skills
```
