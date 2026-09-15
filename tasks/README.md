# Repository tasks

This directory is the repository-owned task ledger for shared skill
implementation. The local
[`repository-task-ledger`](/skills/repository-task-ledger/SKILL.md) defines
the generic lifecycle; this file is the skills-repository profile.

## Admission boundary

Create a new task only when accepted work is expected to add, modify, rename,
or delete at least one file outside this repository's `tasks/**` directory.
The boundary is repository-local: changes in another checkout do not by
themselves admit a task here.

Do not create a task for skill learning, questions, read-only investigation,
planning or review without implementation, validation-only commands,
external-only operations, or task-ledger maintenance. If that work later
requires an edit outside this repository's `tasks/**`, stop before the first
edit and create or claim the implementation task.

## Layout

```text
tasks/
├── backlog/
│   └── <task-name>/Task.md
├── ongoing/
│   └── <identity>/
│       ├── .gitkeep
│       └── <task-name>/
│           ├── Task.md
│           └── Progress.md
└── archived/
    └── <task-name>/
        ├── Task.md
        └── Progress.md
```

The first directory is the task status. Only ongoing work has an identity
layer. Keep task and identity names in lowercase kebab-case, and keep each task
in exactly one status location.

## Task links

This repository supports task artifacts rendered on GitHub and in VS Code when
the repository root is the workspace root. Both resolve a leading `/` from that
root, so new or edited backlog and ongoing task artifacts use
`/path/from/repository/root` for repository-local references. This is a
renderer-specific convention, not standard Markdown behavior.

Leave external URLs and fragment-only links unchanged. Link checks resolve
leading `/` targets from the Git repository root and ordinary relative targets
from the directory containing the Markdown file. Do not rewrite archived task
history solely to change its link style.

## Identity

- Require `extensions.worktreeConfig=true`.
- Read the current identity with
  `git config --worktree --get task-ledger.identity`.
- Verify the value comes from worktree scope and that
  `tasks/ongoing/<identity>/.gitkeep` exists on current `origin/main`.
- Never infer identity from a path, branch, user, agent name, or visible lane.

## Skill repository profile

- The canonical source for each reusable skill lives under `skills/`.
- Track source changes in this repository; downstream installation refreshes
  should reference the source task rather than silently becoming its owner.
- Keep generic guidance in the skill and task-specific state in the owning task
  folder.
- After skill changes, run `npx skills add . --list`, verify local links, and
  inspect `git diff --check` before archiving the task.