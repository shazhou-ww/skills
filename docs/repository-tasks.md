# Repository tasks

This repository uses the local
[`repository-task-ledger`](/skills/repository-task-ledger/SKILL.md) with
`repoledger.yaml` and `tasks/status.yaml`.

## Admission

Begin intake only after explicit `task-new` invocation. Admit one accepted
outcome only when it is expected to change at least one path outside `tasks/**`.
Questions, planning-only work, validation-only work, external-only work, and
task-ledger maintenance remain task-free.

## Layout

```text
tasks/
|-- status.yaml
|-- <task-name>/
|   |-- Task.md
|   |-- Progress.md       # after implementation publication
|   `-- UserAcceptance.md # only when required
`-- <another-task>/
    `-- Task.md
```

Task paths never change with lifecycle state. `tasks/status.yaml` is canonical
and sorted by task name. Use file-relative links within one task directory and
repository-root links for repository-local targets elsewhere.

## Publication

The shared authority is `origin/main`. Repoledger mutations fetch primary,
build an isolated validated commit, push without force, fetch again, and verify
publication. Optional contributor branches and pull requests are transport
choices outside task state.

Accepted task work authorizes routine non-force publication. Never force-push,
discard concurrent commits, or infer semantic conflict resolution.

Use:

```sh
repoledger task list
repoledger status <task-name>
repoledger check <task-name> --remote
repoledger task register <task-name>
repoledger task start <task-name>
repoledger task complete <task-name> --approved-commit <commit>
repoledger task abandon <task-name>
```

## Progress And Review

Create or update `Progress.md` only in a commit that also changes at least one
path outside `tasks/**`. Record implementation facts, material decisions,
validation, blockers, and next action. Do not create progress-only commits for
checks, pushes, hashes, approvals, resumes, handoffs, or status transitions.

Scope and delivery review are required. Interface, business/data model, and
architecture review apply when affected. Every approval names an immutable
commit reachable from primary. Approval alone does not require a metadata
commit. Completion uses the exact delivery-approved primary commit.

## Repository Checks

- Run `pnpm check` after CLI, task, configuration, or migration changes.
- Run `pnpm check:skills` after skill changes.
- Validate Markdown links, Mermaid diagrams, package contents, installed-package
  smoke behavior, and `git diff --check` before delivery review.
- The canonical source for reusable skills remains under `skills/`.
