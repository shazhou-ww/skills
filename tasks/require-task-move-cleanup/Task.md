# Require task move cleanup

Created: 2026-09-15

## Goal

Require every task lifecycle move to remove its source task directory so stale
empty folders cannot make one task appear in multiple status locations.

## Context

Task files were moved to their canonical locations, but empty source folders
remained locally because Git does not track directories. The workflow requires
one canonical task location but does not explicitly require checking that the
old directory itself disappeared.

## Scope

- Require source task directories to be absent after claim, handoff, archive,
  and migration moves.
- Make suggested structural validation reject stale empty task directories.
- Remove the currently observed stale empty task directories.

## Out of scope

- Changing task admission, identity, ownership, or publication rules.
- Adding a repository-specific validation program.

## Acceptance criteria

- [x] The skill explicitly requires cleanup and verification of the source
      directory after every task move.
- [x] Adoption validation guidance treats every task-position directory as a
      task and therefore rejects empty stale directories.
- [x] The observed stale directories no longer exist locally.
- [x] Skill discovery, links, and diff hygiene validate.

## Constraints

- Preserve identity-lane `.gitkeep` files and unrelated active task content.
- Never use recursive cleanup where an unexpected file could be deleted.

## References

- [Repository task ledger skill](../../skills/repoledger/SKILL.md)
- [Project adoption guide](../../skills/repoledger/references/adoption.md)
