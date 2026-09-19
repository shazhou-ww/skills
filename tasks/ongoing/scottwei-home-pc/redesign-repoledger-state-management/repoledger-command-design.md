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
repoledger status [<task-name>] [--state <state>] [--sort <name|created|updated>] [--local]
repoledger check [<task-name>] [--remote]
repoledger task register <task-name>
repoledger task start <task-name> [--branch <branch>]
repoledger task complete <task-name>
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
  branch?: string;
  branchBefore?: string | null;
  branchAfter?: string | null;
  commit: string;
};
```

Commit IDs are full object IDs in JSON. Text output may show an unambiguous
short form.

## Output examples

The following examples use illustrative paths, timestamps, and commit IDs.
Text output favors scanning, while JSON retains the complete stable report.

Remote status for one ongoing task:

```text
$ repoledger status redesign-repoledger-state-management
redesign-repoledger-state-management  ongoing
   branch      task/redesign-repoledger-state-management
   branch tip  7bd3e4c6293e
   created     2026-09-18T08:30:00Z
   updated     2026-09-19T10:15:42Z
   source      origin/main@4f6d2a9816d8
```

Successful remote validation:

```text
$ repoledger check redesign-repoledger-state-management --remote
OK redesign-repoledger-state-management (ongoing)
   primary      origin/main@4f6d2a9816d8
   branch       task/redesign-repoledger-state-management@7bd3e4c6293e
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
      "branch": "task/redesign-repoledger-state-management",
      "branchBefore": null,
      "branchAfter": "7bd3e4c6293e7ad7f084ac5ef3d66e3476c8a41e",
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
            "state": "ongoing",
            "branch": "task/redesign-repoledger-state-management"
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
2. Fetch the configured primary branch and any relevant collaboration ref.
3. Read configuration, status, and task artifacts from explicit commits; do
   not assume the checked-out branch is current.
4. Verify the command's expected task state, ref tips, artifact facts, and
   operation-specific preconditions.
5. Build the prospective tree from the fetched primary commit in an isolated
   temporary worktree or index. Import only operation-owned local paths when a
   command requires them.
6. Apply the pure state transition, maintain timestamps, serialize canonical
   YAML, and run complete prospective validation.
7. Create a commit with the configured Git author and a command-owned message.
8. Push all required ref updates non-force, using `git push --atomic` for every
   multi-ref operation.
9. Fetch the affected refs again and verify the expected commit, state, and
   reachability.
10. Remove temporary state while leaving the caller's branch, index, staged
    files, and unrelated working files unchanged.

The implementation never runs unrestricted `git pull` in the caller's
worktree. It never force-pushes, guesses conflict resolutions, or falls back
from atomic to sequential multi-ref publication.

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
existing remote primary branch, and absent configuration/status paths. It
fails rather than overwriting an existing or partial ledger. Adoption from
layout v1 uses the task-specific migration procedure, not this initializer.

## `repoledger status`

```text
repoledger status [<task-name>] [--state <state>] [--sort <name|created|updated>] [--local]
```

By default, fetches primary and reads its status blob without changing the
worktree. With a task name it returns exactly that record; with no name it
lists records. `--state` accepts one lifecycle state and applies only to list
mode. `--sort name` is the default ascending order; `created` and `updated`
sort newest first with task name as the stable tie-breaker.

For ongoing tasks, remote mode also reports the collaboration ref and fetched
tip. `--local` performs no network call and reads the worktree snapshot,
clearly labeling it local. It never silently falls back to local data after a
fetch failure.

## `repoledger check`

```text
repoledger check [<task-name>] [--remote]
```

Validates configuration, status syntax and canonical form, lifecycle fields,
timestamps, directory correspondence, and task artifacts. A task name limits
content checks while retaining repository-wide uniqueness and structural
invariants.

`--remote` fetches and additionally validates primary reachability, every
ongoing branch, branch uniqueness, and recorded Git facts. Local check is
network-free. This command replaces `doctor`; there is no identity readiness
state left to diagnose.

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
repoledger task start <task-name> [--branch <branch>]
```

Transition: `backlog` to `ongoing`.

The branch defaults to `task/<task-name>`. Repoledger requires the latest
record to remain backlog, the branch name to be valid and unused by any record,
and the remote ref not to exist. It adds `branch`, advances only that record's
`updatedAt`, and creates one claim commit on the latest primary commit.

One atomic push advances primary to the claim commit and creates the task ref
at that same commit. If either compare-and-swap condition fails or the remote
does not support atomic pushes, neither ref changes. Verification requires
both fetched refs to equal the claim commit.

## `repoledger task complete`

```text
repoledger task complete <task-name>
```

Transition: `ongoing` to `completed`.

Repoledger requires the latest primary artifacts to record completed
acceptance criteria, all required human approvals including delivery, and any
required user acceptance. The collaboration ref must exist, and its tip plus
all reviewed implementation commits must be reachable from primary.

The command removes `branch`, changes `state`, advances `updatedAt`, and
commits with `task: complete <task-name>`. One atomic push advances primary
and deletes the verified task ref. A reachability failure, moved ref, or
partial publication capability leaves the task ongoing.

## `repoledger task abandon`

```text
repoledger task abandon <task-name>
```

Transitions: `backlog` to `abandoned`, or `ongoing` to `abandoned`.

The task artifacts must contain an explicit human decision, reason, useful
findings, and next action. Backlog abandonment writes the terminal status and
publishes one primary commit.

For ongoing abandonment, the command also fetches the collaboration tip. It
constructs a terminal commit with primary and the task tip as parents, retains
the task's durable artifacts from the branch, changes only the selected status
record, and keeps all other primary-tree content. This makes abandoned branch
history reachable without delivering its unapproved implementation tree. It
then atomically advances primary and deletes the exact fetched task ref.

If task-local artifacts cannot be separated unambiguously from implementation
changes, the command reports the affected paths and requires the agent to
prepare a safe abandonment candidate before retrying.

## Idempotency and conflicts

After any interrupted mutation, repoledger fetches before retrying:

- if all expected refs and the task record already match the verified result,
  return `already-published` without changing `updatedAt`;
- if no required ref advanced, safely recompute from current primary;
- if only unrelated records advanced, recompose and bounded-retry;
- otherwise return a conflict with expected and actual records, ref commit
  IDs, affected paths, and one concrete remediation.

Authentication, permissions, protected branches, failed validation, unsupported
atomic push, and non-fast-forward rejection remain explicit failures. The CLI
does not prompt interactively or conceal stderr in JSON mode.

## Removed commands and options

- `task claim` becomes `task start`.
- `task archive` becomes explicit `task complete` and `task abandon`.
- `doctor` is covered by `check --remote`.
- Worktree identity setup, takeover, and handoff commands disappear.
- `--identity`, `--all-identities`, `--archived`, `--take-from`,
  `--update-all-refs`, `--config`, and mutation `--apply` disappear with their
  underlying concepts.
- There is no generic `set-state`, `touch`, `rename`, `delete`, or checkpoint
  command. Dedicated lifecycle commands enforce distinct Git and validation
  preconditions; checkpoint work does not mutate task status.
