# Repoledger command design

Status: Proposed for scope, interface, and architecture review

## Decision requested

Approve the command surface, option semantics, Git publication algorithm,
structured reports, idempotency rules, and failure behavior in this document.
Approval unlocks changes to the repoledger CLI and its public package contract.

The stored data is defined in
[repoledger storage model](./repoledger-storage-model.md). Actor flows and
operation boundaries are defined in
[repoledger use cases](./repoledger-use-cases.md).

## Command surface

```text
repoledger init --remote <remote> --primary-branch <branch> [--tasks-directory <path>]
repoledger task list [--state <state>...] [--created-since <timestamp>] [--updated-since <timestamp>]
                     [--sort <name|created|updated>] [--limit <count>] [--local]
repoledger status <task-name> [--local]
repoledger check [<task-name>] [--remote]
repoledger task register <task-name>
repoledger task start <task-name>
repoledger task complete <task-name> --approved-commit <commit>
repoledger task abandon <task-name>
```

Every command accepts `--root <path>` and `--json`. The root defaults to the
current directory. The configuration path is fixed at
`<root>/repoledger.yaml`; there is no `--config` option.

Mutation commands execute the validated operation and publish it. There is no
preview/`--apply` pair because the transition is small, constrained, and
compare-and-swap protected. Read commands never publish.

## Common reports

Text output is concise and intended for humans. `--json` returns the complete
stable report:

```ts
export type CommandReport<T> = {
  command: string;
  ok: boolean;
  root: string;
  diagnostics: Diagnostic[];
  result: T | null;
};

export type Diagnostic = {
  code: string;
  level: "error" | "warning" | "info";
  message: string;
  remediation: string;
  task?: string;
  path?: string;
  expected?: unknown;
  actual?: unknown;
};
```

Exit code `0` means success, `1` means validation, state, Git, network, or
publication failure, and `2` means invalid CLI usage. Expected operational
conflicts are diagnostics, not uncaught exceptions.

Mutation results additionally report:

```ts
export type PublicationResult = {
  task: string;
  transition: string;
  publication: "published" | "already-published";
  primaryBefore: string;
  primaryAfter: string;
  commit: string;
};
```

List results additionally report:

```ts
export type TaskSummary = {
   task: string;
   state: "backlog" | "ongoing" | "completed" | "abandoned";
   createdAt: string;
   updatedAt: string;
};

export type TaskListResult = {
   source: "remote" | "local";
   primary?: string;
   sort: "name" | "created" | "updated";
   tasks: TaskSummary[];
};
```

Commit IDs are full object IDs in JSON. Text output may show an unambiguous
short form.

## Output examples

The following examples use illustrative paths, timestamps, and commit IDs.
Text output favors scanning, while JSON retains the complete stable report.

Tasks updated since midnight, limited to backlog and ongoing work:

```text
$ repoledger task list --state backlog --state ongoing \
   --updated-since 2026-09-19T00:00:00Z --sort updated --limit 10
TASK                                      STATE     CREATED               UPDATED
redesign-repoledger-state-management     ongoing   2026-09-18T08:30:00Z  2026-09-19T10:15:42Z
add-release-provenance                    backlog   2026-09-19T09:12:08Z  2026-09-19T09:12:08Z

2 tasks from origin/main@4f6d2a9816d8, sorted by updated (newest first)
```

Remote status for one ongoing task:

```text
$ repoledger status redesign-repoledger-state-management
redesign-repoledger-state-management  ongoing
   created     2026-09-18T08:30:00Z
   updated     2026-09-19T10:15:42Z
   primary     origin/main@4f6d2a9816d8
```

Successful remote validation:

```text
$ repoledger check redesign-repoledger-state-management --remote
OK redesign-repoledger-state-management (ongoing)
   primary      origin/main@4f6d2a9816d8
   diagnostics  0 errors, 0 warnings
```

Successful start publication with `--json`:

```json
{
   "command": "task start",
   "ok": true,
   "root": "/work/skills",
   "diagnostics": [],
   "result": {
      "task": "redesign-repoledger-state-management",
      "transition": "backlog -> ongoing",
      "publication": "published",
      "primaryBefore": "4f6d2a9816d8bf9856ef472a94d91cb7b4a95f22",
      "primaryAfter": "7bd3e4c6293e7ad7f084ac5ef3d66e3476c8a41e",
      "commit": "7bd3e4c6293e7ad7f084ac5ef3d66e3476c8a41e"
   }
}
```

A start rejected because another actor already started the task:

```json
{
   "command": "task start",
   "ok": false,
   "root": "/work/skills",
   "diagnostics": [
      {
         "code": "task.state.conflict",
         "level": "error",
         "message": "Task redesign-repoledger-state-management is no longer backlog.",
         "remediation": "Refresh status and coordinate with the active collaborator.",
         "task": "redesign-repoledger-state-management",
         "path": "tasks/status.yaml",
         "expected": {
            "state": "backlog"
         },
         "actual": {
            "state": "ongoing"
         }
      }
   ],
   "result": null
}
```

## Git publication algorithm

Every `repoledger task` mutation owns the complete publication cycle. The
caller does not separately pull, stage, commit, or push the status change.

1. Discover the repository root and load strict `repoledger.yaml`.
2. Fetch the configured primary branch.
3. Read configuration, status, and task artifacts from explicit commits; do
   not assume the checked-out branch is current.
4. Verify the command's expected task state, primary tip, artifact facts, and
   operation-specific preconditions.
5. Build the prospective tree from the fetched primary commit in an isolated
   temporary worktree or index. Import only operation-owned local paths when a
   command requires them.
6. Apply the pure state transition, maintain timestamps, serialize canonical
   YAML, and run complete prospective validation.
7. Create a commit with the configured Git author and a command-owned message.
8. Push the primary ref non-force with the fetched tip as the expected base.
9. Fetch primary again and verify the expected commit, state, and reachability.
10. Remove temporary state while leaving the caller's branch, index, staged
    files, and unrelated working files unchanged.

The implementation never runs unrestricted `git pull` in the caller's
worktree. It never force-pushes or guesses conflict resolutions. Repoledger
does not create, update, delete, or record source branches; optional branch or
pull-request workflows remain repository policy outside the task ledger.

If primary moves because only unrelated task records changed, repoledger
refetches, reapplies the operation to the new canonical status, and retries a
bounded number of times. A same-task change, owned-path change, unexpected ref
tip, invalid prospective tree, or exhausted retry reports a conflict and
publishes nothing.

## `repoledger init`

```text
repoledger init --remote <remote> --primary-branch <branch> [--tasks-directory <path>]
```

Creates `repoledger.yaml`, the configured task directory, and an empty
`status.yaml`, then commits and publishes them to the named primary branch.
`--tasks-directory` defaults to `tasks`. Remote and primary branch are required
so the coordination target is never inferred.

The command requires a Git repository, the named configured remote, an
existing remote primary branch, absent configuration/status paths, and an
absent or empty configured task directory. It fails rather than overwriting an
existing or partial ledger. A repository with existing task directories uses
the task-specific migration procedure, not this initializer.

## `repoledger task list`

```text
repoledger task list [--state <state>...] [--created-since <timestamp>] [--updated-since <timestamp>]
                     [--sort <name|created|updated>] [--limit <count>] [--local]
```

Fetches primary and lists task summaries without changing the worktree.
`--state` is repeatable; repeated values are ORed. `--created-since` and
`--updated-since` accept exact UTC second-precision timestamps and are inclusive.
Different filter classes are ANDed. `--sort name` is the default ascending
order; `created` and `updated` sort newest first with task name as the stable
tie-breaker. `--limit` is a positive integer applied after filtering and
sorting. No match is a successful empty result.

`--local` performs no network call and reads the worktree snapshot, clearly
labeling it local. It never silently falls back to local data after a fetch
failure. Invalid states, timestamps, sort keys, and limits are usage errors.

## `repoledger status`

```text
repoledger status <task-name> [--local]
```

Fetches primary and returns exactly one task record plus its source primary
commit. `--local` has the same explicit offline semantics as `task list`.
Missing tasks fail with a diagnostic; listing and filtering belong only to
`task list`.

## `repoledger check`

```text
repoledger check [<task-name>] [--remote]
```

Validates configuration, status syntax and canonical form, lifecycle fields,
timestamps, directory correspondence, and task artifacts. A task name limits
content checks while retaining repository-wide uniqueness and structural
invariants.

`--remote` fetches and additionally validates the configured primary ref,
lifecycle history, commit reachability referenced by task artifacts, and the
post-migration `Progress.md` commit rule. Local check is network-free and
cannot validate history-only invariants. This command replaces `doctor`; there
is no identity or source-branch readiness state left to diagnose.

## `repoledger task register`

```text
repoledger task register <task-name>
```

Transition: absent to `backlog`.

The agent prepares `tasks/<task-name>/Task.md` before invocation. Repoledger
requires a portable name, an absent remote record and directory, a valid local
task directory, and no unexpected symlinks. It snapshots that directory,
refetches primary, and fails if the snapshot changes during publication.

It sets equal `createdAt` and `updatedAt`, adds the sorted record, imports only
the prepared task directory and status file into the isolated tree, commits
with `task: register <task-name>`, pushes primary non-force, and verifies the
published record and artifacts.

An exact already-published task and commit is an idempotent success. A
same-name task with different content or state is a conflict.

## `repoledger task start`

```text
repoledger task start <task-name>
```

Transition: `backlog` to `ongoing`.

Repoledger requires the latest record to remain backlog. It changes only that
record's state and `updatedAt`, creates one start commit on the latest primary
commit, pushes primary non-force, and verifies the published record. It does
not create or record a source branch.

## `repoledger task complete`

```text
repoledger task complete <task-name> --approved-commit <commit>
```

Transition: `ongoing` to `completed`.

The skill permits invocation only after completed acceptance criteria, required
human approvals including delivery, and any required user acceptance.
`--approved-commit` names the exact full or unambiguous abbreviated commit the
human accepted for delivery. The CLI resolves it and requires it to equal the
fetched primary tip; any primary movement requires the agent to refresh,
revalidate, and obtain delivery approval for the new tip. This binds completion
without a `Progress.md`-only approval commit. The CLI validates artifact facts
that are present in the repository but does not infer or manufacture a human
decision.

The command changes `state`, advances `updatedAt`, commits with
`task: complete <task-name>`, pushes primary non-force, and verifies the
published terminal record. A reachability failure or moved primary leaves the
task ongoing.

## `repoledger task abandon`

```text
repoledger task abandon <task-name>
```

Transitions: `backlog` to `abandoned`, or `ongoing` to `abandoned`.

The skill permits invocation only after an explicit human or accountable-owner
decision. Backlog abandonment writes the terminal status and publishes one
primary commit; it does not create `Progress.md` for work that never changed a
path outside the task directory.

For ongoing abandonment, existing useful findings remain in the most recent
implementation-linked `Progress.md`. The command changes only the selected
status record and publishes one primary commit. Optional contributor-branch
content is outside repoledger and is never merged or deleted by this command.

## Idempotency and conflicts

After any interrupted mutation, repoledger fetches before retrying:

- if primary and the task record already match the verified result,
  return `already-published` without changing `updatedAt`;
- if primary did not advance, safely retry the same publication;
- if only unrelated records advanced, recompose and bounded-retry;
- otherwise return a conflict with expected and actual records, ref commit
  IDs, affected paths, and one concrete remediation.

Authentication, permissions, protected branches, failed validation, and
non-fast-forward rejection remain explicit failures. The CLI does not prompt
interactively or conceal stderr in JSON mode.

## Removed commands and options

- `task claim` becomes `task start`.
- `task archive` becomes explicit `task complete` and `task abandon`.
- `doctor` is covered by `check --remote`.
- Worktree identity setup, takeover, and handoff commands disappear.
- Task source-branch fields and `task start --branch` disappear; repoledger
   reads and publishes only the configured primary branch.
- `--identity`, `--all-identities`, `--archived`, `--take-from`,
  `--update-all-refs`, `--config`, and mutation `--apply` disappear with their
  underlying concepts.
- There is no generic `set-state`, `touch`, `rename`, `delete`, or checkpoint
  command. Dedicated lifecycle commands enforce distinct Git and validation
  preconditions; checkpoint work does not mutate task status.
