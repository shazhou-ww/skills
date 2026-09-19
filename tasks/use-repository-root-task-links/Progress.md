# Progress

Updated: 2026-09-15

## Checklist

- [x] Inventory task-link guidance, templates, validation examples, and current
      non-archived task references.
- [x] Define the renderer compatibility boundary and portable fallback.
- [x] Configure this repository and its task templates to use stable root links.
- [x] Update link validation to resolve leading `/` from the repository root.
- [x] Update active and backlog references without rewriting archived history.
- [x] Run skill discovery, link checks, and diff hygiene validation.

## Current state

The skill now defines renderer-supported root links and the portable
file-relative fallback. The adoption guide specifies profile selection and
root-aware validation, while this repository profile declares GitHub and VS
Code compatibility and applies `/...` to new or edited non-archived task
artifacts. Both artifact templates defer to the declared project convention.
The active task references already use root links, backlog has no task to
update, and archived history is unchanged. The complete prepublish validation
passes, and implementation commit `62bb2da` is published on `origin/main`.
The completed task is now in its canonical archive location with unchanged
repository-local references. Next, publish the archive move.

## Decisions

- Keep the identity-scoped ongoing layout unchanged.
- Treat leading `/` links as a renderer capability rather than standard
  Markdown behavior, with file-relative links retained as the portable fallback.
- Resolve leading `/` from the Git repository root during validation, never
  from the process working directory or filesystem root.
- Keep the generic templates conditional so projects with other supported
  Markdown renderers can retain file-relative links.

## Validation

- Confirmed `extensions.worktreeConfig=true` and worktree identity
  `scottwei-office-pc` registered on current `origin/main`.
- Verified the backlog source directory is absent, the destination `Task.md`
  exists, and the task appears in exactly one ledger position after the move.
- Focused policy, adoption-guide, profile, and template assertions passed.
- `npx skills add . --list` discovered `repository-task-ledger`.
- A root-aware check resolved all links across 17 tracked Markdown files,
  including 3 root links and 13 ordinary relative links.
- Editor diagnostics reported no errors in the five implementation files.
- The combined prepublish check printed `PREPUBLISH_ROOT_LINKS_OK` after also
  verifying current task-link style, unique task ownership, the registered
  identity lane, unchanged archived history, template formatting, and diff
  hygiene.
- Implementation commit `62bb2da` is published on `origin/main`.
- The post-move check printed `ARCHIVE_MOVE_AND_REFERENCES_OK` after verifying
  both archive artifacts, source cleanup, unique task position, identity lane
  preservation, completed state, and unchanged `## References` content.

## Blockers

- None.

## Outcome

Completed. Repository-local task references can now remain stable across
lifecycle moves in projects that declare compatible renderers, while projects
requiring portable Markdown retain the file-relative fallback.