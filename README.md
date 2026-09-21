# Shared agent skills

Reusable Agent Skills maintained for projects under `shazhou-ww`.

## Review communication skills

### ui-change-review

[`ui-change-review`](skills/ui-change-review/SKILL.md) creates a focused,
build-free before/after HTML review bundle for an existing UI change. Its
standard entry template loads focused scenario files in an iframe, keeping
shared review chrome small while each current/proposed comparison remains
directly openable. It implements only decision-relevant interaction and
validates the rendered desktop and mobile result without turning the artifact
into a full prototype.

```text
/ui-change-review [affected UI or review goal]
```

Install it independently with:

```sh
npx skills add shazhou-ww/skills --skill ui-change-review
```

### business-data-model-review

[`business-data-model-review`](skills/business-data-model-review/SKILL.md)
creates a compact Mermaid ER review centered on business ownership,
relationships, invariants, migration, and lifecycle. It defines append-only
`<<AO>>` and ephemeral immutable `<<EI>>` stereotypes and requires their
concrete lifecycle rules to accompany the diagram.

```text
/business-data-model-review [model change or review goal]
```

Install it independently with:

```sh
npx skills add shazhou-ww/skills --skill business-data-model-review
```

Both skills optimize the primary artifact for a five-minute human review. They
can be used independently of each other and of the repository task ledger.

## Repoledger

Repoledger now lives in the standalone
[`shazhou-ww/repoledger`](https://github.com/shazhou-ww/repoledger) repository.
That repository owns the npm CLI, schema, release workflow, and the single
user-facing Agent Skill.

```sh
npm install --save-dev repoledger
npx skills add shazhou-ww/repoledger --skill repoledger
```

Use `/repoledger new`, `/repoledger exec`, `/repoledger status`,
`/repoledger complete`, or `/repoledger abandon`. Ordinary implementation
requests remain task-free; only the explicit `new` route creates a task.

Repoledger development through version `0.8.2` remains available in this
repository's history. Subsequent development and releases use the standalone
repository.
