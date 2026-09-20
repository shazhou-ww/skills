# Rename the core skill to repoledger

Created: 2026-09-20

## Goal

Rename the hidden core Agent Skill from `repository-task-ledger` to
`repoledger` so its installed identity matches the npm package while
preserving `task-new` and `task-exec` as the user-facing workflow entries.

## Context

The core lifecycle skill and the npm CLI are two parts of the same Repoledger
product, but they currently use different discoverable names. The longer
`repository-task-ledger` name describes the implementation rather than the
product and makes installation, documentation, and skill composition harder to
remember.

The entry skills load the core by name, Agent Skills require the frontmatter
name to match the containing directory, and repository instructions, tests,
installation examples, and historical task links refer to the current path.
The rename therefore needs to update the complete live contract rather than
only moving one directory.

## Scope

- Rename `skills/repository-task-ledger/` to `skills/repoledger/` and change the
  core skill frontmatter name to `repoledger` without changing its lifecycle
  responsibilities.
- Update `task-new` and `task-exec` to load `repoledger` as their required core
  skill while retaining their existing user-facing names and fail-closed
  behavior.
- Update scope and interface review guidance so `task-exec` gives the user a
  clickable path to the canonical `Task.md` and does not require the user to
  repeat a commit ID when approving those checkpoints. The agent remains
  responsible for associating the decision with the authoritative revision.
- Update repository instructions, the repository task profile, public README
  content, install examples, package documentation, and focused tests to use
  and distinguish the Repoledger skill and Repoledger CLI.
- Repair repository-local links that would break after the directory move,
  including links in completed task artifacts, while preserving historical
  prose where it describes the former name at that point in time.
- Validate skill discovery, Markdown links, repository checks, and whitespace.

## Out of scope

- Renaming the `task-new` or `task-exec` entry skills.
- Changing the npm package name, CLI command, task lifecycle, ledger layout, or
  publication behavior.
- Removing exact-commit approval from final delivery or changing the
  `task complete --approved-commit` contract.
- Keeping a duplicate `repository-task-ledger` compatibility skill or alias.
- Rewriting historical task narratives solely to make their terminology
  current.

## Acceptance criteria

- [ ] Skill discovery exposes a valid hidden core skill named `repoledger` from
  `skills/repoledger/` and no live skill named `repository-task-ledger`.
- [ ] `task-new` and `task-exec` load `repoledger` by name, still fail closed
  when the core is unavailable, and remain the only user-invocable task
  workflow entries.
- [ ] Scope and interface review requests from `task-exec` link to the
  canonical `Task.md` and let the user approve without supplying a commit ID,
  while final delivery approval remains bound to the exact primary commit.
- [ ] Repository instructions and current documentation consistently identify
  the skill as Repoledger, distinguish it from the Repoledger CLI where needed,
  and install it with `--skill repoledger`.
- [ ] Repository-local links continue to resolve after the directory move;
  completed task prose that records the former name remains historically
  accurate.
- [ ] No compatibility alias or duplicate source of lifecycle policy remains
  under `skills/repository-task-ledger/`.
- [ ] `pnpm check`, `pnpm check:skills`, skill discovery, Markdown-link checks,
  and `git diff --check` pass.

## Constraints

- Preserve the core skill as the single authoritative lifecycle protocol and
  keep it non-user-invocable.
- Treat the skill name as a public installation and composition contract; move
  the directory and frontmatter name atomically with all live consumers.
- Keep approval traceability as an agent responsibility rather than making the
  user transcribe commit identifiers for scope and interface reviews.
- Preserve unrelated work and avoid changes to npm package behavior or task
  lifecycle semantics.

## Human review checkpoints

Task creation records this plan, not approval.

| Checkpoint | Applicability | Reviewer | Planned review artifact | Approval required before |
| --- | --- | --- | --- | --- |
| Scope | Required | User | Goal, scope, exclusions, constraints, and acceptance criteria in this task. | Substantive implementation. |
| Interface | Required | User | Proposed skill identity, installation syntax, entry-skill dependency name, no-alias compatibility decision, and clickable-path approval interaction. | Renaming the skill and updating its consumers. |
| Business and data model | Not applicable: no business rules, entities, schemas, or persisted ledger data change. | Not applicable | Not applicable | Not applicable |
| Architecture | Not applicable: the existing core and entry-skill responsibilities remain unchanged. | Not applicable | Not applicable | Not applicable |
| Delivery acceptance | Required | User | Published rename, updated references, and validation evidence. | Running `task complete` for the exact approved primary commit. |

## References

- [Current core skill](/skills/repository-task-ledger/SKILL.md)
- [task-new entry skill](/skills/task-new/SKILL.md)
- [task-exec entry skill](/skills/task-exec/SKILL.md)
- [Repository task profile](/docs/repository-tasks.md)
- [Repoledger package](/packages/repoledger/package.json)