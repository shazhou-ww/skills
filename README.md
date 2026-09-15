# Shared agent skills

Reusable Agent Skills maintained for projects under `shazhou-ww`.

## Available skills

### repository-task-ledger

Keeps accepted work in a repository-owned `tasks/` ledger. Issues remain the
intake surface, while task state, worktree claims, decisions, handoffs, and
validation travel with the code.

Install it interactively with:

```sh
npx skills add shazhou-ww/skills --skill repository-task-ledger
```

Projects should also require the skill from their checked-in agent
instructions. Installation makes the skill discoverable; project instructions
decide when it must be followed.