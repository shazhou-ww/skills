# Require autonomous task publication

Created: 2026-09-15

## Goal

Make repository-task-ledger agents autonomously publish task claims,
substantive implementation progress, implementation completion, and archival
through the repository's shared primary branch.

## Context

The workflow currently says to commit and publish claims, handoffs, and archive
moves, but agents may still pause to ask whether they should commit. It also
does not define implementation completion as a publication milestone distinct
from task archival, require substantive checkpoint commits, or provide a
durable user-facing acceptance guide when manual acceptance is a prerequisite.

## Scope

- Define claim, implementation-complete, and archive publication milestones.
- Require autonomous commits and shared-primary-branch integration at each
  milestone through the repository's normal non-force path.
- Require meaningful substantive progress to be committed and published at
  intermediate checkpoints.
- Define a standalone user acceptance guide for tasks that require manual user
  acceptance before completion.
- Update the reusable templates and repository guidance needed to make the
  lifecycle actionable and auditable.

## Out of scope

- Prescribing one hosting provider, pull-request implementation, or branching
  strategy for every repository.
- Bypassing authentication, branch protection, required review, or unresolved
  integration conflicts.
- Requiring user acceptance for tasks whose automated acceptance criteria are
  sufficient.

## Acceptance criteria

- [ ] The skill requires agents to commit and integrate the claim onto the
  refreshed shared primary branch before substantive implementation, without
  asking for routine commit or push permission.
- [ ] The skill requires substantive intermediate progress to be committed and
  published at meaningful checkpoints.
- [ ] Implementation completion is committed and integrated before acceptance
  or archival, and the task records that publication as a distinct milestone.
- [ ] Tasks requiring manual user acceptance contain a standalone acceptance
  guide with prerequisites, exact steps, expected results, and a clear way to
  report the outcome.
- [ ] After acceptance is satisfied, the agent autonomously archives and
  publishes the task through the shared primary branch.
- [ ] A completed task normally has at least three distinct shared-primary-
  branch integrations: claim, implementation completion, and archive.
- [ ] Guidance preserves normal safeguards for authentication, protected
  branches, required review, push rejection, and conflicts, and forbids force
  publication as a shortcut.
- [ ] Skill discovery, repository-local links, whitespace checks, and focused
  lifecycle wording checks pass.

## Constraints

- Keep the workflow hosting- and branching-strategy-neutral by treating
  `main`, `master`, or a repository-declared equivalent as the shared primary
  branch.
- Keep generic protocol in the reusable skill and repository-specific policy
  in the local task profile.
- Preserve unrelated work and concurrent changes; never force-push or overwrite
  the remote primary branch.

## References

- [Repository task ledger skill](/skills/repository-task-ledger/SKILL.md)
- [Skills repository task profile](/tasks/README.md)