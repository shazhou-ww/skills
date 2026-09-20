# Use repository-root task links

Created: 2026-09-15

## Goal

Keep repository-local references in task documents valid when tasks move among
backlog, identity-scoped ongoing, and archived locations.

## Context

Task documents currently use file-relative Markdown links. Backlog and archived
tasks are one directory shallower than ongoing tasks, so every claim and archive
can require rewriting otherwise unchanged references.

GitHub resolves Markdown targets beginning with `/` from the repository root,
and VS Code resolves them from the current workspace root. Standard Markdown
does not define a repository root, so the convention needs an explicit
compatibility boundary and a fallback for other renderers.

## Scope

- Define repository-root-relative task links using `/path/from/repository/root`
  for projects whose supported renderers provide that behavior.
- Configure this repository's task profile and templates to use stable root
  links.
- Make task-link validation resolve leading `/` from the Git repository root.
- Document a portable fallback for projects using other Markdown renderers.
- Update active and backlog task references without rewriting archived task
  history.

## Out of scope

- Replacing `tasks/ongoing/<identity>/<task-name>` with dynamic
  `tasks/ongoing-<identity>/<task-name>` status directories.
- Treating repository-root resolution as standard Markdown behavior.
- Changing external URLs or fragment-only links.
- Rewriting completed task history solely for link style consistency.

## Acceptance criteria

- [x] The skill distinguishes renderer-supported repository-root links from
      portable file-relative links.
- [x] This repository declares GitHub and VS Code root-link compatibility.
- [x] New task artifacts use stable `/...` references for repository-local
      files.
- [x] Link validation resolves `/...` from the repository root and still
      validates ordinary relative links.
- [x] Claiming, handing off, or archiving a task does not require rewriting its
      repository-local references.
- [x] The identity-scoped ongoing layout remains unchanged.
- [x] Skill discovery, link checks, and diff hygiene pass.

## Constraints

- Preserve support for projects that do not render leading `/` from the
  repository or workspace root.
- Preserve unrelated active-task changes and archived history.
- Do not couple links to a repository owner, remote URL, branch, or local
  filesystem path.

## References

- [Repository task ledger skill](/skills/repoledger/SKILL.md)
- [Project adoption guide](/skills/repoledger/references/adoption.md)
- [GitHub relative links](https://docs.github.com/en/get-started/writing-on-github/getting-started-with-writing-and-formatting-on-github/basic-writing-and-formatting-syntax#relative-links)
- [VS Code Markdown path completions](https://code.visualstudio.com/docs/languages/markdown#_path-completions)
