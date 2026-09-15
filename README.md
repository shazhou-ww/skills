# Shared agent skills

Reusable Agent Skills maintained for projects under `shazhou-ww`.

## User-facing entry skills

### task-new

[`task-new`](skills/task-new/SKILL.md) discusses and triages a candidate
implementation idea, checks current task state for overlap, and records it in
backlog only after acceptance and repository-task admission both pass. On
clients that expose user-invocable skills as commands, use:

```text
/task-new <implementation idea>
```

### task-exec

[`task-exec`](skills/task-exec/SKILL.md) resolves one existing backlog or
ongoing task, then claims or resumes it and follows the repository lifecycle to
completion or a genuine external blocker. On clients that expose
user-invocable skills as commands, use:

```text
/task-exec <task name or description>
```

## Protocol core

### repository-task-ledger

[`repository-task-ledger`](skills/repository-task-ledger/SKILL.md) is the single
authoritative protocol shared by both entry skills. It keeps accepted
implementation work in a repository-owned `tasks/` ledger when that repository
owns changes outside its own `tasks/**`. Issues remain the open intake surface,
while task state, worktree claims, decisions, handoffs, and validation travel
with the code.

Claims, meaningful implementation checkpoints, implementation completion, and
archival are published autonomously through the repository's shared primary
branch. Tasks that need manual user acceptance carry a standalone, user-facing
guide while they remain ongoing.

Install all three skills together with:

```sh
npx skills add shazhou-ww/skills --skill repository-task-ledger --skill task-new --skill task-exec
```

Each skill remains independently discoverable and installable, but the entry
skills deliberately stop when the core is missing. Agent Skills do not define
runtime-enforced dependencies: each entry asks the agent to load
`repository-task-ledger` by name, so composition is model-mediated. The core
uses `user-invocable: false`; clients that honor this extension hide its direct
slash entry while retaining model loading, and other clients may ignore it or
present skills without slash commands.

Projects should still require the core skill from their checked-in agent
instructions. Installation makes the skills discoverable; project instructions
make the protocol mandatory even when users work through natural-language
requests instead of the two explicit entry points.

## Deterministic validation

[`repoledger`](packages/repoledger/README.md) is the npm-distributed companion
CLI for facts such as task layout, Markdown artifacts, publication evidence,
Git history, and worktree identity configuration. It does not replace the
skill's judgment or lifecycle rules.

```sh
npx repoledger@0.1.0 check
npx repoledger@0.1.0 doctor
```

Repositories should pin the package for CI. `check` is network-free and
requires full existing Git history; `doctor` refreshes the configured shared
branch and validates the local identity before task work. The versioned
configuration contract is the GitHub-hosted
[`schema/v1.json`](packages/repoledger/schema/v1.json).