# Add task-new and task-exec entry skills

Created: 2026-09-15

## Goal

Provide portable `task-new` and `task-exec` Agent Skills as the two user-facing
entry points for repository task intake and execution while keeping
`repository-task-ledger` as the single authoritative lifecycle protocol.

## Context

The current `repository-task-ledger` skill combines reusable task-lifecycle
knowledge with its only user-invocable entry point. In practice, users approach
the ledger through two distinct intents: discuss and admit a new implementation
idea, or advance an existing backlog or ongoing task.

Agent Skills do not currently define aliases or enforce dependencies between
skills. The two entry skills therefore need a portable, fail-closed composition
contract that asks the agent to load the installed core skill without copying
its lifecycle rules or pretending the dependency is runtime-enforced.

## Scope

- Add a `task-new` Agent Skill for idea discussion, overlap checks, acceptance,
  admission decisions, and creation of accepted backlog tasks.
- Add a `task-exec` Agent Skill for locating, claiming, resuming, and completing
  backlog or ongoing tasks through the core lifecycle.
- Retain `repository-task-ledger` as the canonical source for admission,
  identity, publication, handoff, acceptance, abandonment, and archival rules.
- Define fail-closed behavior when the core skill is unavailable or the target
  task and ownership state are ambiguous.
- Update discovery, installation, and adoption documentation for the three-skill
  package and its cross-agent compatibility boundary.
- Add focused validation for skill discovery and each entry skill's routing
  contract.

## Out of scope

- Changing the repository task lifecycle, directory layout, or publication
  milestones for reasons unrelated to the new entry points.
- Adding VS Code-only prompt files, custom agents, or other client-specific
  command wrappers as the primary interface.
- Claiming that the Agent Skills standard provides runtime-enforced skill
  dependencies or universal slash-command presentation.
- Migrating or rewriting archived task history.

## Acceptance criteria

- [x] Skill discovery lists `task-new`, `task-exec`, and
  `repository-task-ledger` as valid independently installable Agent Skills.
- [x] Invoking `task-new` with an idea directs the agent to load the core
  protocol, inspect current task state for overlap, refine the proposal, and
  create a backlog task only after acceptance and admission both pass.
- [x] Invoking `task-exec` with a task name or description directs the agent to
  load the core protocol, resolve the task and ownership state, and claim or
  resume it through completion without bypassing identity or publication rules.
- [x] Both entry skills stop with an actionable explanation when the core skill
  is unavailable, and stop for clarification rather than guessing when task or
  ownership resolution is ambiguous.
- [x] Lifecycle policy remains authoritative in `repository-task-ledger`; the
  entry skills contain only intent-specific routing and do not duplicate rules
  that can drift from the core.
- [x] The core skill is hidden as a direct slash entry on clients that support
  that control while remaining available for model loading and composition;
  documentation states how other clients may differ.
- [x] Repository documentation explains the two user-facing commands, installs
  all required skills together, and accurately describes the model-mediated
  cross-agent composition boundary.
- [x] Focused validation exercises both routing paths, confirms local Markdown
  links, passes `npx skills add . --list`, and reports no `git diff --check`
  errors.

## Constraints

- Keep all reusable lifecycle rules in the core skill and make the entry skills
  intentionally small.
- Use standard Agent Skills structure for the portable interface; optional
  client metadata must degrade safely when unsupported.
- Do not proceed under a partially installed package: missing core knowledge
  must be visible to the user rather than reconstructed by the entry skill.
- Preserve the repository's admission boundary and autonomous publication
  requirements.

## References

- [Repository task ledger](https://github.com/shazhou-ww/repoledger/blob/main/skills/repoledger/SKILL.md)
- [Project adoption guide](https://github.com/shazhou-ww/repoledger/blob/main/skills/repoledger/references/adoption.md)
- [Skills repository profile](/docs/repository-tasks.md)
- [Agent Skills specification](https://agentskills.io/specification)
