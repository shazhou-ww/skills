# Repository tasks

This directory is the repository-owned task ledger for shared skill
implementation. The local
[`repository-task-ledger`](/skills/repository-task-ledger/SKILL.md) defines
the generic lifecycle; this file is the skills-repository profile.

## Admission boundary

Begin new task intake only when the user explicitly invokes `task-new` through
the client. Ordinary implementation requests remain task-free regardless of
their size, duration, or expected files. Agents may recommend `task-new` when
durable coordination would help, but they must not invoke it for the user or
treat the recommendation as a prerequisite.

After explicit opt-in, create a task only when accepted work is expected to
add, modify, rename, or delete at least one file outside this repository's
`tasks/**` directory. This repository-local boundary is an eligibility filter,
not an automatic trigger; changes in another checkout do not by themselves
admit a task here.

Do not create a task for skill learning, questions, read-only investigation,
planning or review without implementation, validation-only commands,
external-only operations, or task-ledger maintenance. If task-free work later
requires an edit outside this repository's `tasks/**`, continue task-free
unless the user explicitly opts into `task-new`.

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
the repository root is the workspace root. Links to targets stored inside the
same task directory use file-relative paths such as `./Progress.md`; those
targets move together with the task. For repository-local targets outside the
task directory, new or edited backlog and ongoing task artifacts use
`/path/from/repository/root`. This is a renderer-specific convention, not
standard Markdown behavior.

Leave external URLs and fragment-only links unchanged. Link checks resolve
leading `/` targets from the Git repository root, reject that form for targets
inside the current task directory, and resolve ordinary relative targets from
the directory containing the Markdown file. Do not rewrite archived task
history solely to change its link style.

## Identity

- Read the current identity with `git config --get task-ledger.identity`.
- Accept a global identity or a worktree-scoped override; repoledger does not
  manage the underlying Git configuration.
- Verify that `tasks/ongoing/<identity>/.gitkeep` exists locally.
- With workspace dependencies installed, `pnpm exec repoledger doctor` performs
  these local checks. Refresh and reconcile the remote separately before
  publication.
- Never infer identity from a path, branch, user, agent name, or visible lane.

## Publication path

The shared primary branch is `origin/main`. The normal integration path is a
non-force push to a refreshed `main` after reconciling concurrent changes and
running the relevant checks. If branch protection or required review blocks
that path, use the hosting platform's required integration flow and ask only
for the action that cannot be completed autonomously.

Accepted task work authorizes routine commits and publication through this
path; agents do not pause merely to ask whether they should commit or push.
A milestone is published only when its commit is reachable from the refreshed
`origin/main`.

Every completed task has at least three distinct integrations on `origin/main`:
the claim before substantive implementation, implementation completion while
the task is ongoing, and the archive move after acceptance. Commit and publish
additional substantive work at meaningful validated checkpoints.

Each new task plans scope, interface, business and data model, architecture,
and delivery review checkpoints. Scope and delivery are required; classify the
middle checkpoints against the actual impact. At each applicable gate, publish
the review artifact and pending state, obtain explicit human approval, then
record and publish the decision in `Progress.md` before continuing. Routine Git
authorization is not approval. When manual user testing is required, publish a
task-specific `UserAcceptance.md` with the implementation and keep the task
ongoing until the user reports the result. Record explicit delivery approval
separately before completion and archival.

## Skill repository profile

- The canonical source for each reusable skill lives under `skills/`.
- Track source changes in this repository; downstream installation refreshes
  should reference the source task rather than silently becoming its owner.
- Keep generic guidance in the skill and task-specific state in the owning task
  folder.
- Run `pnpm check` after CLI, task, or configuration changes.
- After skill changes, also run `pnpm check:skills`; verify local links and
  inspect `git diff --check` before archiving the task.