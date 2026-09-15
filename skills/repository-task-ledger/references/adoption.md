# Project adoption

## Admission boundary

Use the ledger for accepted implementation work: a new task is required in the
repository that owns the outcome only when that outcome adds, modifies,
renames, or deletes at least one file outside that same repository's own
`tasks/**`. This includes source, tests, docs, configuration, workflows,
scripts, instructions, and skills.

Do not create a task merely because work is lengthy or multi-step. Learning
the skill, answering questions, read-only investigation or review, running
validation, external-only operations, and changes confined to `tasks/**` do
not create a new task. If one of those activities later reveals a required
edit outside `tasks/**`, stop and claim accepted implementation work before
the first such edit.

The boundary controls admission, not the lifecycle of an existing task. Keep
an admitted task current through read-only phases until completion, abandonment,
or handoff.

### Cross-repository ownership

Apply admission to each independently owned implementation outcome, not to
every checkout touched while delivering one outcome:

- The repository that owns the primary design and implementation owns the
   source task.
- A generated artifact, installed copy, lockfile refresh, or equivalent
   downstream update that mechanically consumes the source change remains part
   of the source task. Reference that task when practical; do not mirror it.
- Downstream-specific design, adaptation, tests, configuration, or other
   independently maintained changes outside that downstream repository's own
   `tasks/**` require a task there before implementation.
- When multiple repositories independently own implementation, create linked
   tasks in those repositories instead of copying one task between them.

## Required project instruction

Installation makes this skill discoverable. A checked-in project instruction
must define when agents are required to load it. Adapt this example to the
repository:

```markdown
## Task workflow

For accepted work owned by this repository and expected to modify its files
outside its own `tasks/**`, and when managing an existing repository task, load
and follow the `repository-task-ledger` skill. Do not create a task solely to
learn the skill, perform read-only work, or maintain files under `tasks/**`.

- Keep accepted work under `tasks/`.
- If task-free work discovers a required edit outside `tasks/**`, stop and
   claim the implementation before that edit.
- Resolve the current identity from the worktree-scoped Git key
   `task-ledger.identity`; do not use `.env`.
- Before implementation, claim the task under
  `tasks/ongoing/<identity>/<task-name>/`.
- Keep `Progress.md` current and archive the task when work ends.
```

Keep repository-specific commands, boundaries, and exceptions in the project
instruction or `tasks/README.md`; do not fork the generic lifecycle without a
project need.

## Worktree identity setup

The committed identity lane and local binding answer different questions:

| Record | Scope | Meaning |
| --- | --- | --- |
| `tasks/ongoing/<identity>/.gitkeep` | Shared `main` history | This name is registered and reserved. |
| `task-ledger.identity` | Current Git worktree | This worktree uses that registered name. |

For an ordinary non-bare repository with no configured `core.worktree`, enable
worktree configuration once:

```sh
git config --local extensions.worktreeConfig true
```

Before enabling it in a nonstandard repository, inspect `core.worktree` and
`core.bare` and follow Git's documented migration requirements. Worktree config
is unsupported by older Git clients; all tools accessing the repository must
support the extension.

After a unique `.gitkeep` reservation has been pushed successfully to `main`,
bind the worktree:

```sh
git config --worktree task-ledger.identity <identity>
```

At the start of task work, agents must read and validate it:

```sh
git config --local --get extensions.worktreeConfig
git config --show-origin --show-scope --get task-ledger.identity
```

The extension must be enabled, the value must be lowercase kebab-case, the
origin must be worktree config, and the matching `.gitkeep` must exist on the
latest shared `main`. Stop task work until any missing or stale binding is
resolved. Do not guess from paths, branches, usernames, agent names, or visible
lanes.

## Suggested validation invariants

Automated checks should verify at least:

- only `backlog`, `ongoing`, and `archived` are canonical status directories;
- task and identity names use the project's portable naming convention;
- every non-hidden backlog and archived entry is a task directory;
- every non-hidden ongoing entry is an identity directory;
- every identity contains `.gitkeep`;
- every non-hidden entry below an identity is a task directory;
- every task-position directory is treated as a task even when it is empty and
   contains `Task.md` with the required headings;
- no task name appears in more than one backlog, ongoing identity, or archived
   position;
- backlog tasks do not contain `Progress.md`;
- ongoing and archived tasks contain `Progress.md`;
- archived progress records an outcome;
- local links in task artifacts resolve.

CI checks structure after the fact. They complement, but do not replace, the
early identity reservation and claim publication protocol. CI cannot validate a
developer's local `config.worktree`; agents and local tooling validate that at
the start of task work.

## Migrating a flat ongoing directory

When a repository currently uses `tasks/ongoing/<task-name>`:

1. Choose and register an identity for each active worktree.
2. Identify the actual current actor for every active task; do not infer
   ownership from Git authorship alone.
3. Move each active folder to `tasks/ongoing/<identity>/<task-name>` with
   `git mv`.
4. Verify each destination contains all task artifacts and each source task
   directory no longer exists. Remove an empty source directory, but stop and
   reconcile unexpected contents instead of deleting recursively.
5. Update project instructions, documentation, and validation in the same
   migration.
6. Enable worktree config and bind each worktree to its registered identity.
7. Publish the migration before accepting new claims under the revised layout.

Do not add an identity layer to `backlog` or `archived`; unclaimed and inactive
tasks have no current execution owner.