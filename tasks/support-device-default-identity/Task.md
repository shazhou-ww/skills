# Support a device default task identity

Created: 2026-09-15

## Goal

Allow a device-wide default identity to simplify task-ledger setup across
repositories while keeping every worktree's explicit identity binding
authoritative.

## Context

A device commonly uses the same actor identity across one worktree in each of
several repositories. Re-entering that identity is repetitive, but treating a
global value as an automatic binding could let an uninitialized worktree claim
tasks under the wrong identity.

The intended default for this device is `scottwei-office-pc`. That name will be
visible in repository paths and Git history wherever it is registered.

## Scope

- Define an optional Git global `task-ledger.defaultIdentity` value as an
  initialization suggestion.
- Keep worktree-scoped `task-ledger.identity` as the only authoritative local
  binding.
- Require repository registration and explicit worktree binding before using
  the suggested identity.
- Document explicit overrides for additional worktrees on the same device.
- Migrate this worktree and its active claims from `copilot-shared-skills` to
  `scottwei-office-pc` after the new identity is published.

## Out of scope

- Falling back automatically from a missing worktree binding to a global
  identity.
- Creating a centralized identity registry shared by unrelated repositories.
- Synchronizing a device-specific value across machines.

## Acceptance criteria

- [x] The skill distinguishes a device default from an authoritative worktree
      binding.
- [x] Initialization may read the global default but must validate repository
      registration and write an explicit worktree value before task work.
- [x] A missing or invalid worktree binding still stops task work.
- [x] Guidance covers explicit overrides for multiple worktrees of one
      repository on the same device.
- [x] This worktree and its active claims use the registered
      `scottwei-office-pc` identity.
- [x] The old identity is retired only after no active task or worktree uses it.
- [x] Skill discovery, links, identity validation, and diff hygiene pass.

## Constraints

- Reserve and publish the new repository identity before binding or handoff.
- Preserve active task history and unrelated worktree changes.
- Keep machine-local defaults out of tracked repository configuration.

## References

- [Repository task ledger skill](https://github.com/shazhou-ww/repoledger/blob/main/skills/repoledger/SKILL.md)
- [Project adoption guide](https://github.com/shazhou-ww/repoledger/blob/main/skills/repoledger/references/adoption.md)
