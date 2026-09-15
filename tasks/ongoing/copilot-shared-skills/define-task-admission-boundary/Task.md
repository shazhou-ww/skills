# Define the repository task admission boundary

Created: 2026-09-15

## Goal

Create a repository task only when accepted work is expected to modify files
outside that same repository's `tasks/**` directory, and keep the task in the
repository that owns the implementation.

## Context

The task ledger previously admitted planned or multi-step work too broadly,
which could create tasks merely to learn the skill. Initial task-free-work
wording was published in commit `d0a5c01`, but repository ownership and
cross-repository scope still need to be made explicit.

## Scope

- Define the per-repository `tasks/**` admission boundary in the shared skill.
- Define task ownership for work spanning source and downstream repositories.
- Keep skill learning, read-only work, and task-only maintenance task-free.
- Publish the shared skill and refresh downstream installed copies and project
  profiles where applicable.

## Out of scope

- Changing identity, claim, handoff, archive, or overlap rules after admission.
- Creating mirrored tasks for mechanical downstream installation updates.
- Rewriting completed task history in downstream repositories.

## Acceptance criteria

- [ ] Admission is based only on expected file changes outside the current
      repository's own `tasks/**` directory.
- [ ] The task lives in the repository that owns the primary implementation.
- [ ] Cross-repository guidance distinguishes source ownership, mechanical
      downstream sync, and independently owned implementation changes.
- [ ] Learning or using the skill does not itself require a task.
- [ ] Published source and downstream installed copies agree.
- [ ] Skill discovery and downstream workflow checks pass.

## Constraints

- Keep the admission test mechanical and path-based.
- Count source, tests, docs, configuration, workflows, scripts, instructions,
  and skills outside this repository's `tasks/**` as implementation-bearing.
- Preserve unrelated changes in every repository.

## References

- [Repository task ledger skill](../../../../skills/repository-task-ledger/SKILL.md)
- [Project adoption guide](../../../../skills/repository-task-ledger/references/adoption.md)