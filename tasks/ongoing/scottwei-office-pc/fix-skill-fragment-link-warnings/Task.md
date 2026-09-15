# Fix skill fragment-link warnings

Created: 2026-09-15

## Goal

Make the repository-task-ledger skill's same-document section links navigate to
their existing headings without editor nonexistent-file warnings.

## Context

The editor reports all four fragment-only links in the skill as missing files,
even though the referenced headings exist in the same document. The diagnostic
resolver is interpreting targets such as `#verify-every-task-move` as paths.

## Scope

- Express the four same-document links with an explicit current-file path and
  their existing heading fragments.
- Verify the editor diagnostics, skill discovery, ledger state, and Markdown
  formatting after the change.

## Out of scope

- Renaming headings or changing the task lifecycle guidance.
- Rewriting unrelated links or changing editor/validator configuration.

## Acceptance criteria

- [ ] Each affected link still targets its intended heading in the same skill
      document.
- [ ] The skill document has no nonexistent-file diagnostics for those links.
- [ ] Repository and skill checks pass after the change.

## Constraints

- Preserve the existing prose and heading anchors.
- Keep the change limited to the canonical skill source and task artifacts.

## References

- [Repository Task Ledger skill](/skills/repository-task-ledger/SKILL.md)